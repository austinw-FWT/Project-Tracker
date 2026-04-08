import { useState } from "react";
import { Plus, X, Clock, Users, Send } from "lucide-react";

const CATEGORIES = ["Installation", "Programming", "Termination", "Cable Pull", "Site Walk", "Design", "Commissioning", "Punch List", "Training", "Travel", "Other"];
const DEPARTMENTS = ["Low Voltage", "Networking", "Structured Cabling", "Security", "Fire Alarm", "Audio Visual", "General"];

const FB_URL = "https://fwt-lv-tracker-default-rtdb.firebaseio.com";

export default function TimesheetView({ timesheets, projects, myName, isAdmin, allMemberPrivate, teamRoster, onAdd, onRemove }) {
  const [jobName, setJobName] = useState(""); const [jobNumber, setJobNumber] = useState(""); const [department, setDepartment] = useState("Low Voltage");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]); const [hours, setHours] = useState(""); const [category, setCategory] = useState("Installation");
  const [hoursType, setHoursType] = useState("regular"); const [notes, setNotes] = useState("");
  const [filterWeek, setFilterWeek] = useState("all"); const [viewMode, setViewMode] = useState("mine");
  const [showAdminMember, setShowAdminMember] = useState(null);
  const [sending, setSending] = useState(false); const [sendResult, setSendResult] = useState(null);

  async function emailTimesheet() {
    if (filterWeek === "all" || filtered.length === 0) return;
    setSending(true); setSendResult(null);
    try {
      // Get auth token
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      // Get project ID for cloud function
      const projectId = await (async () => {
        const r = await fetch(`${FB_URL}/tracker.json?auth=${token}`);
        const d = await r.json();
        return d;
      })();
      // Call the callable function via REST
      const region = "us-central1";
      const projectIdFb = "fwt-lv-tracker";
      const fnUrl = `https://${region}-${projectIdFb}.cloudfunctions.net/emailTimesheet`;
      const resp = await fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ data: { memberName: myName, weekOf: filterWeek, entries: filtered } }),
      });
      const result = await resp.json();
      if (result.result?.success) {
        setSendResult({ ok: true, msg: `Sent to ${result.result.sentTo} recipient(s)` });
      } else {
        setSendResult({ ok: false, msg: result.error?.message || "Failed to send" });
      }
    } catch (err) {
      setSendResult({ ok: false, msg: err.message });
    }
    setSending(false);
    setTimeout(() => setSendResult(null), 4000);
  }

  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  function gWK(ds) { const d = new Date(ds + "T00:00:00"); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)).toISOString().split("T")[0]; }

  function handleAdd() {
    if (!hours || !date) return;
    const pj = projects.find(p => p.name === jobName || p.id === jobName);
    onAdd({ jobName: jobName || (pj?.name || ""), jobNumber, department, date, hours: parseFloat(hours), category, hoursType, notes: notes.trim(), projectId: pj?.id || "" });
    setHours(""); setNotes(""); setJobNumber("");
  }

  const filtered = timesheets.filter(e => filterWeek === "all" || gWK(e.date) === filterWeek).sort((a, b) => b.date.localeCompare(a.date));
  const weeks = [...new Set(timesheets.map(e => gWK(e.date)))].sort().reverse();
  const totalReg = filtered.filter(e => e.hoursType !== "overtime").reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  const totalOT = filtered.filter(e => e.hoursType === "overtime").reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);

  // Admin: gather all team timesheets
  const allTimesheets = [];
  if (isAdmin && allMemberPrivate && viewMode === "team") {
    Object.entries(allMemberPrivate).forEach(([name, mp]) => {
      (mp.timesheets || []).forEach(t => allTimesheets.push({ ...t, member: name }));
    });
    allTimesheets.sort((a, b) => b.date.localeCompare(a.date));
  }
  const teamFiltered = allTimesheets.filter(e => {
    if (showAdminMember && e.member !== showAdminMember) return false;
    if (filterWeek !== "all" && gWK(e.date) !== filterWeek) return false;
    return true;
  });
  const teamWeeks = [...new Set(allTimesheets.map(e => gWK(e.date)))].sort().reverse();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {/* Toggle mine/team for admins */}
      {isAdmin && (
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[{ id: "mine", label: "My Timesheets" }, { id: "team", label: "Team Timesheets" }].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #1e293b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: viewMode === v.id ? "#6366f1" : "transparent", color: viewMode === v.id ? "#fff" : "#94a3b8" }}>{v.label}</button>
          ))}
        </div>
      )}

      {viewMode === "mine" && (
        <>
          {/* Entry Form */}
          <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Clock size={15} style={{ color: "#6366f1" }} /> Log Time Entry</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><label style={lS}>Job Name</label><select style={iS} value={jobName} onChange={e => setJobName(e.target.value)}><option value="">Select or type...</option>{projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
              <div><label style={lS}>Job Number</label><input style={iS} value={jobNumber} onChange={e => setJobNumber(e.target.value)} placeholder="e.g., FWT-2024-042" /></div>
              <div><label style={lS}>Department</label><select style={iS} value={department} onChange={e => setDepartment(e.target.value)}>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
              <div><label style={lS}>Date *</label><input type="date" style={iS} value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><label style={lS}>Hours *</label><input type="number" step="0.25" min="0" max="24" style={iS} value={hours} onChange={e => setHours(e.target.value)} /></div>
              <div><label style={lS}>Category</label><select style={iS} value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={lS}>Hours Type</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {["regular", "overtime"].map(t => (
                    <button key={t} onClick={() => setHoursType(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: hoursType === t ? "2px solid " + (t === "overtime" ? "#f59e0b" : "#10b981") : "1px solid #1e293b", background: hoursType === t ? (t === "overtime" ? "#f59e0b22" : "#10b98122") : "transparent", color: hoursType === t ? (t === "overtime" ? "#f59e0b" : "#10b981") : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lS}>Notes</label><input style={iS} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was done?" /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={handleAdd} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: hours && date ? 1 : 0.4 }}><Plus size={14} /> Log Hours</button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <select style={{ ...iS, width: "auto" }} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}><option value="all">All Weeks</option>{weeks.map(w => <option key={w} value={w}>Week of {w}</option>)}</select>
            <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>Reg: {totalReg.toFixed(1)}h</span>
              <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>OT: {totalOT.toFixed(1)}h</span>
              <span style={{ fontSize: 15, color: "#fff", fontWeight: 700, fontFamily: "'Outfit',sans-serif" }}>Total: {(totalReg + totalOT).toFixed(1)}h</span>
            </div>
          </div>

          {/* Email Export */}
          {filterWeek !== "all" && filtered.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button onClick={emailTimesheet} disabled={sending} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 600, cursor: sending ? "wait" : "pointer", fontFamily: "inherit", opacity: sending ? 0.6 : 1 }}>
                <Send size={14} /> {sending ? "Sending..." : "Email Timesheet"}
              </button>
              {sendResult && <span style={{ fontSize: 12, color: sendResult.ok ? "#10b981" : "#ef4444", fontWeight: 600 }}>{sendResult.msg}</span>}
            </div>
          )}

          {/* Entries */}
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>No time entries yet.</div>}
          {filtered.map(entry => (
            <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#1a2332", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: entry.hoursType === "overtime" ? "#f59e0b22" : "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: entry.hoursType === "overtime" ? "#f59e0b" : "#818cf8", fontFamily: "'Outfit',sans-serif" }}>{entry.hours}h</span>
                {entry.hoursType === "overtime" && <span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700 }}>OT</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{entry.jobName || "—"}{entry.jobNumber ? ` · #${entry.jobNumber}` : ""}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                  <span>{entry.date}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#94a3b8" }}>{entry.category}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#64748b" }}>{entry.department}</span>
                  {entry.notes && <span style={{ color: "#475569" }}>— {entry.notes}</span>}
                </div>
              </div>
              <button onClick={() => onRemove(entry.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", flexShrink: 0 }}><X size={14} /></button>
            </div>
          ))}
        </>
      )}

      {viewMode === "team" && isAdmin && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <select style={{ ...iS, width: "auto" }} value={showAdminMember || ""} onChange={e => setShowAdminMember(e.target.value || null)}><option value="">All Members</option>{teamRoster.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
            <select style={{ ...iS, width: "auto" }} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}><option value="all">All Weeks</option>{teamWeeks.map(w => <option key={w} value={w}>Week of {w}</option>)}</select>
            <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>{teamFiltered.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0).toFixed(1)} hrs total</span>
          </div>
          {teamFiltered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>No team entries found.</div>}
          {teamFiltered.map(entry => (
            <div key={entry.id + entry.member} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#1a2332", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: entry.hoursType === "overtime" ? "#f59e0b22" : "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: entry.hoursType === "overtime" ? "#f59e0b" : "#818cf8", fontFamily: "'Outfit',sans-serif" }}>{entry.hours}h</span>
                {entry.hoursType === "overtime" && <span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700 }}>OT</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}><span style={{ color: "#818cf8" }}>{entry.member}</span> · {entry.jobName || "—"}{entry.jobNumber ? ` · #${entry.jobNumber}` : ""}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                  <span>{entry.date}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#94a3b8" }}>{entry.category}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#64748b" }}>{entry.department}</span>
                  {entry.notes && <span style={{ color: "#475569" }}>— {entry.notes}</span>}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
