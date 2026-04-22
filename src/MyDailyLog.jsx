import { useState } from "react";
import { Plus, X, Send, ChevronDown, ChevronUp, Clock, Users, Briefcase, Archive, Trash2 } from "lucide-react";
import { LABOR_PHASES } from "./App.jsx";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
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

// Opens default mail client (Outlook on Windows) with pre-filled message.
function openMailto({ to, cc, subject, body }) {
  const params = [];
  if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const url = `mailto:${encodeURIComponent(to || "")}${params.length ? "?" + params.join("&") : ""}`;
  window.location.href = url;
}

const getCategoryName = id => (LABOR_PHASES.find(l => l.id === id)?.name) || id || "—";

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
      crewMembers: [{ id: genId(), name: myName, hours: 0, category: LABOR_PHASES[0]?.id || "" }],
      activities: "",
    }]);
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
      return { ...e, crewMembers: [...e.crewMembers, { id: genId(), name: memberName, hours: 0, category: LABOR_PHASES[0]?.id || "" }] };
    }));
  }

  function removeCrewMember(entryId, crewId) {
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      return { ...e, crewMembers: e.crewMembers.filter(c => c.id !== crewId) };
    }));
  }

  function updateCrewField(entryId, crewId, field, value) {
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      return { ...e, crewMembers: e.crewMembers.map(c => c.id === crewId ? { ...c, [field]: field === "hours" ? (parseFloat(value) || 0) : value } : c) };
    }));
  }

  // ── Submit ──
  function submit() {
    if (entries.length === 0) return;
    const validEntries = entries.filter(e => e.activities.trim() || e.crewMembers.some(c => c.hours > 0));
    if (validEntries.length === 0) return;

    const log = {
      id: genId(),
      date,
      submittedBy: myName,
      entries: validEntries,
      createdAt: new Date().toISOString(),
    };

    // Build project updates — append daily log entry AND deduct from laborHours.remaining per category
    const projectUpdates = [];
    validEntries.forEach(entry => {
      const proj = projects.find(p => p.id === entry.projectId);
      if (!proj) return;

      const totalHours = entry.crewMembers.reduce((s, c) => s + (c.hours || 0), 0);
      const memberSummary = entry.crewMembers.filter(c => c.hours > 0)
        .map(c => `${c.name}: ${c.hours}h [${getCategoryName(c.category)}]`).join(", ");

      const projectLog = {
        id: genId(),
        date,
        member: myName,
        hours: totalHours,
        activities: entry.activities + (memberSummary ? `\nCrew: ${memberSummary}` : ""),
        crewBreakdown: entry.crewMembers.filter(c => c.hours > 0).map(c => ({ name: c.name, hours: c.hours, category: c.category })),
        createdAt: new Date().toISOString(),
      };

      // Deduct hours from laborHours[category].remaining per crew member
      const newLaborHours = { ...(proj.laborHours || {}) };
      entry.crewMembers.forEach(c => {
        if (!c.hours || c.hours <= 0 || !c.category) return;
        const existing = newLaborHours[c.category] || { bid: 0, remaining: 0 };
        newLaborHours[c.category] = {
          ...existing,
          remaining: (parseFloat(existing.remaining) || 0) - c.hours,
        };
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
          const crew = e.crewMembers.filter(c => c.hours > 0)
            .map(c => `  ${c.name}: ${c.hours}h  [${getCategoryName(c.category)}]`).join("\n");
          return `${e.projectName}:\n${e.activities}${crew ? "\nCrew Hours:\n" + crew : ""}`;
        }).join("\n\n");

        const totalHrs = validEntries.reduce((s, e) => s + e.crewMembers.reduce((s2, c) => s2 + c.hours, 0), 0);

        const body = [
          `Daily Log submitted by ${myName}`,
          `Date: ${date}`,
          `Total Hours: ${totalHrs}h`,
          "",
          logBody,
          "",
          "— Sent from FWT Workspaces",
        ].join("\n");

        openMailto({
          to: recipients.join(","),
          cc: myEmail || "",
          subject: `FWT Daily Log — ${myName} — ${date}`,
          body,
        });
      } catch (err) {
        console.error("Mailto failed:", err);
      }
    })();

    // Reset form
    setEntries([]);
  }

  function deleteLog(logId) { onDeleteLog(logs.filter(l => l.id !== logId)); }

  const totalHoursToday = entries.reduce((s, e) => s + e.crewMembers.reduce((s2, c) => s2 + c.hours, 0), 0);
  const usedProjectIds = entries.map(e => e.projectId);
  const availableProjects = projects.filter(p => !usedProjectIds.includes(p.id));

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 24px" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        <button onClick={() => setTab("new")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: tab === "new" ? "#6366f1" : "#1a2332", color: tab === "new" ? "#fff" : "#64748b" }}>New Entry</button>
        <button onClick={() => setTab("archive")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: tab === "archive" ? "#6366f1" : "#1a2332", color: tab === "archive" ? "#fff" : "#64748b" }}><Archive size={14} /> Archive ({logs.length})</button>
      </div>

      {tab === "new" ? (
        <div>
          {/* Date + Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#0f1729", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #6366f1" }}>
              <label style={lS}>Date</label>
              <input type="date" style={{ ...iS, background: "#0f1729" }} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div style={{ background: "#0f1729", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #f59e0b" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Projects</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b", fontFamily: "'Outfit',sans-serif" }}>{entries.length}</div>
            </div>
            <div style={{ background: "#0f1729", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #10b981" }}>
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
              <div key={entry.id} style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Briefcase size={16} style={{ color: "#6366f1" }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{entry.projectName}</span>
                  </div>
                  <button onClick={() => removeEntry(entry.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={16} /></button>
                </div>

                {/* Crew Members */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Users size={13} style={{ color: "#64748b" }} />
                    <span style={lS}>Crew, Hours &amp; Category</span>
                  </div>
                  {entry.crewMembers.map(crew => {
                    const remaining = parseFloat(laborHours[crew.category]?.remaining) || 0;
                    const remainingAfter = remaining - (crew.hours || 0);
                    const overrun = remainingAfter < 0 && (crew.hours || 0) > 0;
                    return (
                      <div key={crew.id} style={{ background: "#0f1729", borderRadius: 8, padding: "10px 12px", marginBottom: 6, border: overrun ? "1px solid #7f1d1d" : "1px solid #1e293b" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, minWidth: 120, flex: "1 1 120px" }}>{crew.name}</span>
                          <select
                            style={{ ...iS, flex: "2 1 180px", minWidth: 160, background: "#1a2332", fontSize: 12 }}
                            value={crew.category || ""}
                            onChange={e => updateCrewField(entry.id, crew.id, "category", e.target.value)}
                          >
                            {LABOR_PHASES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <input
                              type="number" step="0.25" min="0"
                              style={{ ...iS, width: 70, textAlign: "right", background: "#1a2332" }}
                              value={crew.hours || ""}
                              onChange={e => updateCrewField(entry.id, crew.id, "hours", e.target.value)}
                              placeholder="0"
                            />
                            <span style={{ fontSize: 12, color: "#64748b" }}>hrs</span>
                            {entry.crewMembers.length > 1 && (
                              <button onClick={() => removeCrewMember(entry.id, crew.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
                            )}
                          </div>
                        </div>
                        {crew.category && (
                          <div style={{ fontSize: 11, marginTop: 6, color: overrun ? "#ef4444" : (remainingAfter < remaining * 0.2 ? "#f59e0b" : "#475569") }}>
                            {overrun
                              ? `⚠ Will overrun by ${Math.abs(remainingAfter).toFixed(1)}h (only ${remaining.toFixed(1)}h remaining on ${getCategoryName(crew.category)})`
                              : `${remaining.toFixed(1)}h remaining on ${getCategoryName(crew.category)} → ${remainingAfter.toFixed(1)}h after this log`}
                          </div>
                        )}
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
              <span style={{ fontSize: 11, color: "#64748b" }}>Opens in Outlook after saving</span>
              <button onClick={submit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
            const totalHrs = log.entries.reduce((s, e) => s + e.crewMembers.reduce((s2, c) => s2 + c.hours, 0), 0);
            return (
              <div key={log.id} style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", marginBottom: 8, overflow: "hidden" }}>
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
                      <div key={entry.id} style={{ background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", padding: 14, marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{entry.projectName}</div>
                        {entry.crewMembers.filter(c => c.hours > 0).map(c => (
                          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12, gap: 8 }}>
                            <span style={{ color: "#94a3b8" }}>{c.name}</span>
                            <span style={{ color: "#64748b", fontSize: 11, flex: 1, textAlign: "right" }}>{getCategoryName(c.category)}</span>
                            <span style={{ color: "#f59e0b", fontWeight: 600, minWidth: 40, textAlign: "right" }}>{c.hours}h</span>
                          </div>
                        ))}
                        {entry.activities && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e293b", whiteSpace: "pre-wrap" }}>{entry.activities}</div>}
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
