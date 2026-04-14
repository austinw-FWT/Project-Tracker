import { useState } from "react";
import { Plus, X, Send, ChevronDown, ChevronUp, Clock, Users, Briefcase, Archive, Trash2 } from "lucide-react";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

const FB_FUNCTIONS_URL = "https://us-central1-fwt-lv-tracker.cloudfunctions.net";

async function callFunction(name, data) {
  try {
    const { getAuth } = await import("firebase/auth");
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch(`${FB_FUNCTIONS_URL}/${name}`, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ data }),
    });
    return await r.json();
  } catch (e) { console.error(`Function ${name} failed:`, e); return null; }
}

export default function MyDailyLog({ dailyLogs, projects, teamRoster, myName, onSave, onUpdateProject }) {
  const [tab, setTab] = useState("new");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
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
      crewMembers: [{ id: genId(), name: myName, hours: 0 }],
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
      return { ...e, crewMembers: [...e.crewMembers, { id: genId(), name: memberName, hours: 0 }] };
    }));
  }

  function removeCrewMember(entryId, crewId) {
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      return { ...e, crewMembers: e.crewMembers.filter(c => c.id !== crewId) };
    }));
  }

  function updateCrewHours(entryId, crewId, hours) {
    setEntries(entries.map(e => {
      if (e.id !== entryId) return e;
      return { ...e, crewMembers: e.crewMembers.map(c => c.id === crewId ? { ...c, hours: parseFloat(hours) || 0 } : c) };
    }));
  }

  // ── Submit ──
  async function submit() {
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

    // Save to user's archive
    const updated = [log, ...logs];
    onSave(updated);

    // Push summary to each project's dailyLogs
    validEntries.forEach(entry => {
      const proj = projects.find(p => p.id === entry.projectId);
      if (proj && onUpdateProject) {
        const totalHours = entry.crewMembers.reduce((s, c) => s + c.hours, 0);
        const memberSummary = entry.crewMembers.filter(c => c.hours > 0).map(c => `${c.name}: ${c.hours}h`).join(", ");
        const projectLog = {
          id: genId(),
          date,
          member: myName,
          hours: totalHours,
          activities: entry.activities + (memberSummary ? `\nCrew: ${memberSummary}` : ""),
          createdAt: new Date().toISOString(),
        };
        onUpdateProject(entry.projectId, {
          dailyLogs: [projectLog, ...(proj.dailyLogs || [])],
        });
      }
    });

    // Email
    setSending(true);
    try {
      await callFunction("emailDailyLog", {
        projectName: validEntries.map(e => e.projectName).join(", "),
        log: {
          date,
          member: myName,
          hours: validEntries.reduce((s, e) => s + e.crewMembers.reduce((s2, c) => s2 + c.hours, 0), 0),
          activities: validEntries.map(e => {
            const crew = e.crewMembers.filter(c => c.hours > 0).map(c => `  ${c.name}: ${c.hours}h`).join("\n");
            return `${e.projectName}:\n${e.activities}${crew ? `\nCrew Hours:\n${crew}` : ""}`;
          }).join("\n\n"),
        },
      });
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (e) { console.error("Email failed:", e); }
    setSending(false);

    // Reset form
    setEntries([]);
  }

  function deleteLog(logId) { onSave(logs.filter(l => l.id !== logId)); }

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
          {entries.map(entry => (
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
                  <span style={lS}>Crew &amp; Hours</span>
                </div>
                {entry.crewMembers.map(crew => (
                  <div key={crew.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1, minWidth: 120 }}>{crew.name}</span>
                    <input type="number" step="0.25" min="0" style={{ ...iS, width: 80, textAlign: "right" }} value={crew.hours || ""} onChange={e => updateCrewHours(entry.id, crew.id, e.target.value)} placeholder="0" />
                    <span style={{ fontSize: 12, color: "#64748b" }}>hrs</span>
                    {entry.crewMembers.length > 1 && (
                      <button onClick={() => removeCrewMember(entry.id, crew.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
                    )}
                  </div>
                ))}
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
          ))}

          {entries.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>
              Select a project above to start your daily log.
            </div>
          )}

          {/* Submit */}
          {entries.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", marginTop: 16 }}>
              {sent && <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>✓ Email sent to admins</span>}
              {sending && <span style={{ fontSize: 12, color: "#6366f1" }}>Sending email...</span>}
              <button onClick={submit} disabled={sending} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, border: "none", background: sending ? "#475569" : "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, cursor: sending ? "wait" : "pointer", fontFamily: "inherit" }}>
                <Send size={14} /> Submit & Email Daily Log
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
                          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                            <span style={{ color: "#94a3b8" }}>{c.name}</span>
                            <span style={{ color: "#f59e0b", fontWeight: 600 }}>{c.hours}h</span>
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
