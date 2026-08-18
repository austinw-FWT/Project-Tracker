import { useState, useRef, useEffect } from "react";
import { Plus, X, Send, ChevronDown, ChevronUp, Clock, Users, Briefcase, Archive, Trash2, Camera, Image as ImageIcon } from "lucide-react";
import { LABOR_PHASES } from "./App.jsx";
import { remainingHours } from "./laborMath.js";
import { openOutlookCompose } from "./emailHelper.js";
import { uploadLogPhotos, previewUrl } from "./photoUtils.js";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0F2444", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

const FB_URL = "https://fwt-lv-tracker-default-rtdb.firebaseio.com";

async function getAdminEmails() {
  try {
    const { getAuth } = await import("firebase/auth");
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch(`${FB_URL}/users.json${token ? `?auth=${token}` : ""}`);
    const users = await r.json();
    if (!users) return [];
    return Object.values(users).filter(u => u.role === "admin" && u.status === "approved" && u.email).map(u => u.email);
  } catch (e) { console.error("Failed to fetch admin emails:", e); return []; }
}

const getCategoryName = id => (LABOR_PHASES.find(l => l.id === id)?.name) || id || "—";

// Normalize crew member to always have an `allocations` array.
// Handles legacy shape: { hours, category } → single-allocation array
function getAllocations(crew) {
  if (Array.isArray(crew.allocations)) return crew.allocations;
  if (crew.hours !== undefined || crew.category !== undefined) {
    return [{ id: crew.id + "_legacy", hours: crew.hours || 0, category: crew.category || "" }];
  }
  return [];
}

function totalCrewHours(crew) {
  return getAllocations(crew).reduce((s, a) => s + (parseFloat(a.hours) || 0), 0);
}

/** Photo picker for one project entry: camera on phones, file picker on
    desktop, thumbnails with remove. Files upload (compressed) at submit. */
function EntryPhotos({ entry, onAdd, onRemove }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const photos = entry.photos || [];
  return (
    <div style={{ marginTop: 12 }}>
      <label style={lS}>Photos</label>
      {/* Library picker is primary — crews shoot photos through the day and
          write the log at the end of it. `capture` would force the camera and
          hide the library entirely, so it lives on its own button. */}
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={e => { onAdd(e.target.files); e.target.value = ""; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={e => { onAdd(e.target.files); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8, border: "1.5px solid #69BE28", background: "#69BE2815", color: "#82CC4A", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 42 }}>
          <ImageIcon size={14} /> Choose Photos{photos.length ? ` (${photos.length})` : ""}
        </button>
        <button type="button" onClick={() => camRef.current?.click()} title="Take a photo now"
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minHeight: 42 }}>
          <Camera size={14} /> Take Photo
        </button>
        {photos.length > 0 && (
          <span style={{ fontSize: 11.5, color: "#64748b" }}>Compressed on your device before upload — works on weak signal.</span>
        )}
      </div>
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {photos.map((f, i) => {
            const src = typeof f === "string" ? f : previewUrl(f);
            return (
              <div key={i} style={{ position: "relative" }}>
                {src
                  ? <img src={src} alt="" style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 8, border: "1px solid #1A3050" }} />
                  : <div style={{ width: 76, height: 76, borderRadius: 8, background: "#0A192F", border: "1px solid #1A3050", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 18 }}>🖼</div>}
                <button type="button" onClick={() => onRemove(i)} title="Remove"
                  style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "#0A192F", color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1, boxShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function useIsMobileLog() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return m;
}

export default function MyDailyLog({ dailyLogs, projects, teamRoster, myName, myEmail, predefinedEmail, onSubmit, onDeleteLog }) {
  const [tab, setTab] = useState("new");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState([]);
  const [expandedArchive, setExpandedArchive] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const isMobile = useIsMobileLog();

  const logs = dailyLogs || [];

  // ── Add a project entry ──
  function addProjectEntry(projectId) {
    if (!projectId || entries.some(e => e.projectId === projectId)) return;
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    setEntries([...entries, {
      id: genId(),
      projectId,
      projectName: proj.name,
      crewMembers: [makeCrewMember(myName)],
      activities: "",
      photos: [],
    }]);
  }

  function makeCrewMember(name) {
    return {
      id: genId(),
      name,
      allocations: [{ id: genId(), hours: 0, category: LABOR_PHASES[0]?.id || "" }],
    };
  }

  function removeEntry(entryId) { setEntries(entries.filter(e => e.id !== entryId)); }

  function updateEntry(entryId, updates) {
    setEntries(entries.map(e => e.id === entryId ? { ...e, ...updates } : e));
  }

  // ── Crew member management within an entry ──
  function addCrewMember(entryId, memberName) {
    if (!memberName) return;
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      if (e.crewMembers.some(c => c.name === memberName)) return e;
      return { ...e, crewMembers: [...e.crewMembers, makeCrewMember(memberName)] };
    }));
  }

  function removeCrewMember(entryId, crewId) {
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      return { ...e, crewMembers: e.crewMembers.filter(c => c.id !== crewId) };
    }));
  }

  // ── Allocation management within a crew member ──
  function addAllocation(entryId, crewId) {
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      return {
        ...e,
        crewMembers: e.crewMembers.map(c => {
          if (c.id !== crewId) return c;
          const allocs = getAllocations(c);
          return { ...c, allocations: [...allocs, { id: genId(), hours: 0, category: LABOR_PHASES[0]?.id || "" }] };
        }),
      };
    }));
  }

  function removeAllocation(entryId, crewId, allocId) {
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      return {
        ...e,
        crewMembers: e.crewMembers.map(c => {
          if (c.id !== crewId) return c;
          const allocs = getAllocations(c).filter(a => a.id !== allocId);
          // Always keep at least one allocation row so the UI doesn't go empty
          return { ...c, allocations: allocs.length > 0 ? allocs : [{ id: genId(), hours: 0, category: LABOR_PHASES[0]?.id || "" }] };
        }),
      };
    }));
  }

  function updateAllocation(entryId, crewId, allocId, field, value) {
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      return {
        ...e,
        crewMembers: e.crewMembers.map(c => {
          if (c.id !== crewId) return c;
          const allocs = getAllocations(c).map(a => a.id === allocId
            ? { ...a, [field]: field === "hours" ? (parseFloat(value) || 0) : value }
            : a);
          return { ...c, allocations: allocs };
        }),
      };
    }));
  }

  // ── Photos ──
  function addPhotos(entryId, files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setEntries(entries.map(e => e.id === entryId ? { ...e, photos: [...(e.photos || []), ...list] } : e));
  }
  function removePhoto(entryId, idx) {
    setEntries(entries.map(e => e.id === entryId ? { ...e, photos: (e.photos || []).filter((_, i) => i !== idx) } : e));
  }

  // ── Submit ──
  async function submit() {
    if (entries.length === 0 || submitting) return;
    const validEntries = entries.filter(e => {
      const anyHours = e.crewMembers.some(c => getAllocations(c).some(a => a.hours > 0));
      return e.activities.trim() || anyHours || (e.photos || []).length > 0;
    });
    if (validEntries.length === 0) return;
    setSubmitting(true);

    // Upload photos BEFORE writing the logs so the URLs ride inside each
    // record. Log ids are generated up front so photos file under them.
    const logIds = {};
    const photoUrlsByEntry = {};
    const totalPhotos = validEntries.reduce((n, e) => n + (e.photos || []).length, 0);
    let uploaded = 0;
    for (const entry of validEntries) {
      logIds[entry.id] = genId();
      const files = entry.photos || [];
      if (!files.length) { photoUrlsByEntry[entry.id] = []; continue; }
      try {
        photoUrlsByEntry[entry.id] = await uploadLogPhotos(files, entry.projectId, logIds[entry.id], () => {
          uploaded++; setUploadMsg(`Uploading photos… ${uploaded}/${totalPhotos}`);
        });
      } catch {
        setUploadMsg("");
        if (!confirm("Photo upload failed — weak signal?\n\nSubmit the log without photos? You can add them later from the project's Daily Log tab.")) {
          setSubmitting(false); return;
        }
        photoUrlsByEntry[entry.id] = [];
      }
    }
    setUploadMsg("");

    // Strip File objects out of the personal archive — store the URLs instead
    const cleanEntries = validEntries.map(e => ({ ...e, photos: photoUrlsByEntry[e.id] || [] }));

    const log = {
      id: genId(),
      date,
      submittedBy: myName,
      entries: cleanEntries,
      createdAt: new Date().toISOString(),
    };

    // Each project gets one keyed log record. Labor hours are COMPUTED from
    // these logs (see laborMath.js) — no balance is mutated here, so edits,
    // deletes, and double-submits can no longer corrupt the remaining hours.
    const projectLogs = [];
    validEntries.forEach(entry => {
      const proj = projects.find(p => p.id === entry.projectId);
      if (!proj) return;

      const crewLines = entry.crewMembers
        .map(c => {
          const allocs = getAllocations(c).filter(a => a.hours > 0);
          if (allocs.length === 0) return null;
          const parts = allocs.map(a => `${a.hours}h [${getCategoryName(a.category)}]`).join(" + ");
          return `${c.name}: ${parts}`;
        })
        .filter(Boolean);

      const totalHours = entry.crewMembers.reduce((s, c) => s + totalCrewHours(c), 0);

      projectLogs.push({
        pid: entry.projectId,
        log: {
          id: logIds[entry.id],
          date,
          member: myName,
          hours: totalHours,
          activities: entry.activities + (crewLines.length > 0 ? `\nCrew: ${crewLines.join("; ")}` : ""),
          crewBreakdown: entry.crewMembers.map(c => ({
            name: c.name,
            allocations: getAllocations(c).filter(a => a.hours > 0).map(a => ({ hours: a.hours, category: a.category })),
          })).filter(c => c.allocations.length > 0),
          ...((photoUrlsByEntry[entry.id] || []).length ? { photos: photoUrlsByEntry[entry.id] } : {}),
          createdAt: new Date().toISOString(),
        },
      });
    });

    const updatedLogs = [log, ...logs];
    // Await the real write — never tell someone it saved when it didn't.
    try {
      await onSubmit(updatedLogs, projectLogs);
      setSaveError("");
    } catch {
      setSaveError("Couldn't reach the server — nothing was lost, your entries are still here. Check your connection and hit Submit again.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);

    // Open email in default client with pre-filled body
    (async () => {
      try {
        const adminEmails = await getAdminEmails();
        const recipients = [...new Set([...adminEmails, ...(predefinedEmail ? [predefinedEmail] : [])])].filter(Boolean);

        const logBody = validEntries.map(e => {
          const crewLines = e.crewMembers
            .map(c => {
              const allocs = getAllocations(c).filter(a => a.hours > 0);
              if (allocs.length === 0) return null;
              const parts = allocs.map(a => `    ${a.hours}h  [${getCategoryName(a.category)}]`).join("\n");
              return `  ${c.name}:\n${parts}`;
            })
            .filter(Boolean)
            .join("\n");
          return `${e.projectName}:\n${e.activities}${crewLines ? "\nCrew Hours:\n" + crewLines : ""}`;
        }).join("\n\n");

        const totalHrs = validEntries.reduce((s, e) =>
          s + e.crewMembers.reduce((s2, c) => s2 + totalCrewHours(c), 0), 0);

        const body = [
          `Daily Log submitted by ${myName}`,
          `Date: ${date}`,
          `Total Hours: ${totalHrs}h`,
          "",
          logBody,
          "",
          "— Sent from FWT Workspaces",
        ].join("\n");

        openOutlookCompose({
          to: recipients.join(","),
          cc: myEmail || "",
          subject: `FWT Daily Log — ${myName} — ${date}`,
          body,
        });
      } catch (err) {
        console.error("Email open failed:", err);
      }
    })();

    setEntries([]);
  }

  function deleteLog(logId) { onDeleteLog(logs.filter(l => l.id !== logId)); }

  const totalHoursToday = entries.reduce((s, e) =>
    s + e.crewMembers.reduce((s2, c) => s2 + totalCrewHours(c), 0), 0);
  const usedProjectIds = entries.map(e => e.projectId);
  const availableProjects = projects.filter(p => !usedProjectIds.includes(p.id));

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "14px 12px 90px" : "20px 24px" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        <button onClick={() => setTab("new")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: tab === "new" ? "#69BE28" : "#0F2444", color: tab === "new" ? "#fff" : "#64748b" }}>New Entry</button>
        <button onClick={() => setTab("archive")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: tab === "archive" ? "#69BE28" : "#0F2444", color: tab === "archive" ? "#fff" : "#64748b" }}><Archive size={14} /> Archive ({logs.length})</button>
      </div>

      {tab === "new" ? (
        <div>
          {/* Date + Stats */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 8 : 12, marginBottom: 20 }}>
            <div style={{ background: "#0A192F", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${logs.some(l => l.date === date) ? "#f59e0b" : "#69BE28"}` }}>
              <label style={lS}>Date</label>
              <input type="date" style={{ ...iS, background: "#0A192F" }} value={date} onChange={e => setDate(e.target.value)} />
              {logs.some(l => l.date === date) && <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, marginTop: 6 }}>⚠ You already submitted a log for this date</div>}
            </div>
            <div style={{ background: "#0A192F", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #f59e0b" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Projects</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b", fontFamily: "'Outfit',sans-serif" }}>{entries.length}</div>
            </div>
            <div style={{ background: "#0A192F", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #10b981" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Total Crew Hours</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#10b981", fontFamily: "'Outfit',sans-serif" }}>{totalHoursToday}h</div>
            </div>
          </div>

          {/* Add Project */}
          <div style={{ marginBottom: 16 }}>
            <label style={lS}>Add a project you worked on today</label>
            <select style={iS} value="" onChange={e => addProjectEntry(e.target.value)}>
              <option value="">Select a project...</option>
              {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.customer}</option>)}
            </select>
          </div>

          {/* Project Entries */}
          {entries.map(entry => {
            const proj = projects.find(p => p.id === entry.projectId);
            return (
              <div key={entry.id} style={{ background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", padding: 20, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Briefcase size={16} style={{ color: "#69BE28" }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{entry.projectName}</span>
                  </div>
                  <button onClick={() => removeEntry(entry.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={16} /></button>
                </div>

                {/* Crew Members */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Users size={13} style={{ color: "#64748b" }} />
                    <span style={lS}>Crew &amp; Hours (split across labor categories as needed)</span>
                  </div>
                  {entry.crewMembers.map(crew => {
                    const allocs = getAllocations(crew);
                    const crewTotal = totalCrewHours(crew);
                    return (
                      <div key={crew.id} style={{ background: "#0A192F", borderRadius: 8, padding: "10px 12px", marginBottom: 6, border: "1px solid #1A3050" }}>
                        {/* Crew member header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 700, flex: 1 }}>{crew.name}</span>
                          <span style={{ fontSize: 12, color: crewTotal > 0 ? "#10b981" : "#64748b", fontWeight: 600 }}>{crewTotal}h total</span>
                          {entry.crewMembers.length > 1 && (
                            <button onClick={() => removeCrewMember(entry.id, crew.id)} title="Remove crew member" style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={14} /></button>
                          )}
                        </div>

                        {/* Allocations (category + hours pairs) */}
                        {allocs.map(alloc => {
                          const remaining = proj ? remainingHours(proj, alloc.category) : 0;
                          const remainingAfter = remaining - (alloc.hours || 0);
                          const overrun = remainingAfter < 0 && (alloc.hours || 0) > 0;
                          return (
                            <div key={alloc.id} style={{ marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <select
                                  style={{ ...iS, flex: "2 1 180px", minWidth: 160, background: "#0F2444", fontSize: 12, borderLeft: overrun ? "3px solid #ef4444" : "1px solid #1A3050" }}
                                  value={alloc.category || ""}
                                  onChange={e => updateAllocation(entry.id, crew.id, alloc.id, "category", e.target.value)}
                                >
                                  {LABOR_PHASES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input
                                  type="number" step="0.25" min="0"
                                  style={{ ...iS, width: 80, textAlign: "right", background: "#0F2444", fontSize: 12 }}
                                  value={alloc.hours || ""}
                                  onChange={e => updateAllocation(entry.id, crew.id, alloc.id, "hours", e.target.value)}
                                  placeholder="0"
                                />
                                <span style={{ fontSize: 12, color: "#64748b", minWidth: 24 }}>hrs</span>
                                {allocs.length > 1 && (
                                  <button onClick={() => removeAllocation(entry.id, crew.id, alloc.id)} title="Remove this category split" style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
                                )}
                              </div>
                              {alloc.category && alloc.hours > 0 && (
                                <div style={{ fontSize: 11, marginTop: 4, marginLeft: 4, color: overrun ? "#ef4444" : (remainingAfter < remaining * 0.2 ? "#f59e0b" : "#475569") }}>
                                  {overrun
                                    ? `⚠ Will overrun by ${Math.abs(remainingAfter).toFixed(1)}h (only ${remaining.toFixed(1)}h remaining on ${getCategoryName(alloc.category)})`
                                    : `${remaining.toFixed(1)}h remaining on ${getCategoryName(alloc.category)} → ${remainingAfter.toFixed(1)}h after`}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Add allocation button */}
                        <button
                          onClick={() => addAllocation(entry.id, crew.id)}
                          style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, background: "none", border: "1px dashed #1A3050", color: "#82CC4A", fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: "4px 10px", borderRadius: 6 }}
                        >
                          <Plus size={11} /> Add Category Split
                        </button>
                      </div>
                    );
                  })}
                  <select style={{ ...iS, marginTop: 6, maxWidth: 220, fontSize: 12 }} value="" onChange={e => addCrewMember(entry.id, e.target.value)}>
                    <option value="">+ Add crew member</option>
                    {teamRoster.filter(t => !entry.crewMembers.some(c => c.name === t.name)).map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Activities */}
                <div>
                  <label style={lS}>Activities / Work Performed</label>
                  <textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={entry.activities} onChange={e => updateEntry(entry.id, { activities: e.target.value })} placeholder="Describe work performed on this project today..." />
                </div>

                {/* Photos */}
                <EntryPhotos entry={entry} onAdd={files => addPhotos(entry.id, files)} onRemove={i => removePhoto(entry.id, i)} />
              </div>
            );
          })}

          {entries.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>
              Select a project above to start your daily log.
            </div>
          )}

          {/* Submit */}
          {entries.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {saveError && <div style={{ padding: "12px 14px", borderRadius: 10, background: "#7f1d1d22", border: "1.5px solid #ef4444", color: "#fca5a5", fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>⚠ {saveError}</div>}
              <div style={{ display: "flex", flexDirection: isMobile ? "column-reverse" : "row", justifyContent: "flex-end", gap: isMobile ? 8 : 8, alignItems: isMobile ? "stretch" : "center" }}>
                <span style={{ fontSize: 11, color: uploadMsg ? "#82CC4A" : "#64748b", textAlign: isMobile ? "center" : "right" }}>{uploadMsg || "Opens Outlook web after saving"}</span>
                <button onClick={submit} disabled={submitting} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: isMobile ? "15px 20px" : "10px 20px", borderRadius: 10, border: "none", background: submitting ? "#1A3050" : "#69BE28", color: submitting ? "#475569" : "#fff", fontSize: isMobile ? 16 : 14, fontWeight: 700, cursor: submitting ? "default" : "pointer", fontFamily: "inherit", minHeight: isMobile ? 52 : 44 }}>
                  <Send size={15} /> {submitting ? "Saving…" : "Submit & Email"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Archive Tab ── */
        <div>
          {logs.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>No daily logs archived yet.</div>}
          {logs.map(log => {
            const isExpanded = expandedArchive === log.id;
            const totalHrs = log.entries.reduce((s, e) =>
              s + e.crewMembers.reduce((s2, c) => s2 + totalCrewHours(c), 0), 0);
            return (
              <div key={log.id} style={{ background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", marginBottom: 8, overflow: "hidden" }}>
                <div onClick={() => setExpandedArchive(isExpanded ? null : log.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{log.date}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{log.entries.length} project{log.entries.length !== 1 ? "s" : ""}</span>
                  <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>{totalHrs}h total</span>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={e => { e.stopPropagation(); deleteLog(log.id); }} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><Trash2 size={13} /></button>
                    {isExpanded ? <ChevronUp size={14} style={{ color: "#64748b" }} /> : <ChevronDown size={14} style={{ color: "#64748b" }} />}
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: "0 16px 16px" }}>
                    {log.entries.map(entry => (
                      <div key={entry.id} style={{ background: "#0A192F", borderRadius: 10, border: "1px solid #1A3050", padding: 14, marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{entry.projectName}</div>
                        {entry.crewMembers.map(crew => {
                          const allocs = getAllocations(crew).filter(a => a.hours > 0);
                          if (allocs.length === 0) return null;
                          const crewTotal = allocs.reduce((s, a) => s + (a.hours || 0), 0);
                          return (
                            <div key={crew.id} style={{ padding: "4px 0", fontSize: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                                <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{crew.name}</span>
                                <span style={{ color: "#f59e0b", fontWeight: 600 }}>{crewTotal}h</span>
                              </div>
                              {allocs.map(a => (
                                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", paddingLeft: 10 }}>
                                  <span>{getCategoryName(a.category)}</span>
                                  <span>{a.hours}h</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                        {entry.activities && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, paddingTop: 6, borderTop: "1px solid #1A3050", whiteSpace: "pre-wrap" }}>{entry.activities}</div>}
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>Submitted {new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

