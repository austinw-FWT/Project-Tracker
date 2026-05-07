import { useState } from "react";
import { Plus, X, Send, ChevronDown, ChevronUp, Clock, Users, Briefcase, Archive, Trash2 } from "lucide-react";
import { LABOR_PHASES } from "./App.jsx";
import { openOutlookCompose } from "./emailHelper.js";

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

export default function MyDailyLog({ dailyLogs, projects, teamRoster, myName, myEmail, predefinedEmail, onSubmit, onDeleteLog }) {
  const [tab, setTab] = useState("new");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState([]);
  const [expandedArchive, setExpandedArchive] = useState(null);

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

  // ── Submit ──
  function submit() {
    if (entries.length === 0) return;
    const validEntries = entries.filter(e => {
      const anyHours = e.crewMembers.some(c => getAllocations(c).some(a => a.hours > 0));
      return e.activities.trim() || anyHours;
    });
    if (validEntries.length === 0) return;

    const log = {
      id: genId(),
      date,
      submittedBy: myName,
      entries: validEntries,
      createdAt: new Date().toISOString(),
    };

    // Build project updates — append daily log entry AND deduct from laborHours.remaining per allocation
    const projectUpdates = [];
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

      const projectLog = {
        id: genId(),
        date,
        member: myName,
        hours: totalHours,
        activities: entry.activities + (crewLines.length > 0 ? `\nCrew: ${crewLines.join("; ")}` : ""),
        crewBreakdown: entry.crewMembers.map(c => ({
          name: c.name,
          allocations: getAllocations(c).filter(a => a.hours > 0).map(a => ({ hours: a.hours, category: a.category })),
        })).filter(c => c.allocations.length > 0),
        createdAt: new Date().toISOString(),
      };

      // Deduct hours from laborHours[category].remaining across all allocations
      const newLaborHours = { ...(proj.laborHours || {}) };
      entry.crewMembers.forEach(c => {
        getAllocations(c).forEach(a => {
          if (!a.hours || a.hours <= 0 || !a.category) return;
          const existing = newLaborHours[a.category] || { bid: 0, remaining: 0 };
          newLaborHours[a.category] = {
            ...existing,
            remaining: (parseFloat(existing.remaining) || 0) - a.hours,
          };
        });
      });

      projectUpdates.push({
        pid: entry.projectId,
        updates: {
          dailyLogs: [projectLog, ...(proj.dailyLogs || [])],
          laborHours: newLaborHours,
        },
      });
    });

    const updatedLogs = [log, ...logs];
    onSubmit(updatedLogs, projectUpdates);

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
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 24px" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        <button onClick={() => setTab("new")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: tab === "new" ? "#69BE28" : "#0F2444", color: tab === "new" ? "#fff" : "#64748b" }}>New Entry</button>
        <button onClick={() => setTab("archive")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: tab === "archive" ? "#69BE28" : "#0F2444", color: tab === "archive" ? "#fff" : "#64748b" }}><Archive size={14} /> Archive ({logs.length})</button>
      </div>

      {tab === "new" ? (
        <div>
          {/* Date + Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#0A192F", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #69BE28" }}>
              <label style={lS}>Date</label>
              <input type="date" style={{ ...iS, background: "#0A192F" }} value={date} onChange={e => setDate(e.target.value)} />
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
            const laborHours = proj?.laborHours || {};
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
                          const remaining = parseFloat(laborHours[alloc.category]?.remaining) || 0;
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
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", marginTop: 16 }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>Opens Outlook web after saving</span>
              <button onClick={submit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <Send size={14} /> Submit &amp; Email
              </button>
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

