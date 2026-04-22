import { useState, useEffect } from "react";
import { Plus, X, Clock, Users, Send, ChevronDown, ChevronUp } from "lucide-react";
import { LABOR_PHASES } from "./App.jsx";

const DEPARTMENTS = ["Brandon", "Justin", "Service", "Steve", "Tim", "Todd", "Overhead", "Tech Staffing"];

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

// Open user's default mail client (Outlook on Windows) with pre-filled fields.
function openMailto({ to, cc, subject, body }) {
  const params = [];
  if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const url = `mailto:${encodeURIComponent(to || "")}${params.length ? "?" + params.join("&") : ""}`;
  window.location.href = url;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function TimesheetView({ timesheets, projects, myName, myEmail, predefinedEmail, isAdmin, allMemberPrivate, teamRoster, onAdd, onRemove }) {
  const isMobile = useIsMobile();

  const [jobName, setJobName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [department, setDepartment] = useState("Low Voltage");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [hours, setHours] = useState("");
  const [category, setCategory] = useState(LABOR_PHASES[0]?.id || "");
  const [hoursType, setHoursType] = useState("regular");
  const [prevailingWage, setPrevailingWage] = useState(false);
  const [notes, setNotes] = useState("");
  const [filterWeek, setFilterWeek] = useState("all");
  const [viewMode, setViewMode] = useState("mine");
  const [showAdminMember, setShowAdminMember] = useState(null);
  const [showForm, setShowForm] = useState(!isMobile);

  async function emailTimesheet() {
    if (filterWeek === "all" || filtered.length === 0) return;
    const adminEmails = await getAdminEmails();
    const recipients = [...new Set([...adminEmails, ...(predefinedEmail ? [predefinedEmail] : [])])].filter(Boolean);

    const getCatName = id => (LABOR_PHASES.find(l => l.id === id)?.name) || id || "—";
    const body = [
      `Timesheet submitted by ${myName}`,
      `Week of ${filterWeek}`,
      `Total: ${(totalReg + totalOT).toFixed(1)}h (Regular ${totalReg.toFixed(1)}h / OT ${totalOT.toFixed(1)}h)`,
      "",
      ...filtered.map(e =>
        `${e.date}  |  ${e.jobName || "—"}  |  ${e.hours}h${e.hoursType === "overtime" ? " (OT)" : ""}  |  ${getCatName(e.category)}${e.prevailingWage ? "  |  PW" : ""}${e.notes ? "  |  " + e.notes : ""}`
      ),
      "",
      "— Sent from FWT Workspaces",
    ].join("\n");

    openMailto({
      to: recipients.join(","),
      cc: myEmail || "",
      subject: `FWT Timesheet — ${myName} — Week of ${filterWeek}`,
      body,
    });
  }

  const iS = {
    width: "100%",
    padding: isMobile ? "12px 14px" : "8px 12px",
    borderRadius: 8,
    border: "1px solid #1e293b",
    background: "#1a2332",
    color: "#e2e8f0",
    fontSize: isMobile ? 15 : 13,
    fontFamily: "'DM Sans',sans-serif",
    outline: "none",
    minHeight: isMobile ? 48 : "auto",
  };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  function gWK(ds) {
    const d = new Date(ds + "T00:00:00");
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split("T")[0];
  }

  function handleAdd() {
    if (!hours || !date) return;
    const pj = projects.find(p => p.name === jobName || p.id === jobName);
    onAdd({ jobName: jobName || (pj?.name || ""), jobNumber, department, date, hours: parseFloat(hours), category, hoursType, prevailingWage, notes: notes.trim(), projectId: pj?.id || "" });
    setHours(""); setNotes(""); setJobNumber(""); setPrevailingWage(false);
    if (isMobile) setShowForm(false);
  }

  const filtered = timesheets.filter(e => filterWeek === "all" || gWK(e.date) === filterWeek).sort((a, b) => b.date.localeCompare(a.date));
  const weeks = [...new Set(timesheets.map(e => gWK(e.date)))].sort().reverse();
  const totalReg = filtered.filter(e => e.hoursType !== "overtime").reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  const totalOT = filtered.filter(e => e.hoursType === "overtime").reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);

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

  const getCategoryName = id => (LABOR_PHASES.find(l => l.id === id)?.name) || id || "—";

  // Mobile entry form
  const MobileEntryForm = (
    <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", marginBottom: 16, overflow: "hidden" }}>
      <button
        onClick={() => setShowForm(!showForm)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#6366f122", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plus size={18} style={{ color: "#6366f1" }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Log Time Entry</span>
        </div>
        {showForm ? <ChevronUp size={18} style={{ color: "#64748b" }} /> : <ChevronDown size={18} style={{ color: "#64748b" }} />}
      </button>

      {showForm && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={lS}>Date *</label><input type="date" style={iS} value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label style={lS}>Hours *</label><input type="number" step="0.25" min="0" max="24" style={iS} value={hours} onChange={e => setHours(e.target.value)} placeholder="0.0" /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lS}>Hours Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["regular", "overtime"].map(t => (
                <button key={t} onClick={() => setHoursType(t)} style={{ flex: 1, padding: "12px 8px", borderRadius: 10, border: hoursType === t ? `2px solid ${t === "overtime" ? "#f59e0b" : "#10b981"}` : "1px solid #1e293b", background: hoursType === t ? (t === "overtime" ? "#f59e0b22" : "#10b98122") : "transparent", color: hoursType === t ? (t === "overtime" ? "#f59e0b" : "#10b981") : "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lS}>Prevailing Wage</label>
            <button onClick={() => setPrevailingWage(!prevailingWage)} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: prevailingWage ? "2px solid #8b5cf6" : "1px solid #1e293b", background: prevailingWage ? "#8b5cf622" : "transparent", color: prevailingWage ? "#8b5cf6" : "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{prevailingWage ? "✓ Prevailing Wage" : "Not Prevailing Wage"}</button>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lS}>Job Name</label>
            <select style={iS} value={jobName} onChange={e => setJobName(e.target.value)}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lS}>Labor Category</label>
            <select style={iS} value={category} onChange={e => setCategory(e.target.value)}>
              {LABOR_PHASES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lS}>Notes</label>
            <input style={iS} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was done?" />
          </div>
          <button
            onClick={handleAdd}
            disabled={!hours || !date}
            style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontSize: 15, fontWeight: 700, cursor: hours && date ? "pointer" : "default", fontFamily: "inherit", opacity: hours && date ? 1 : 0.4 }}
          >
            Log Hours
          </button>
        </div>
      )}
    </div>
  );

  // Desktop entry form
  const DesktopEntryForm = (
    <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Clock size={15} style={{ color: "#6366f1" }} /> Log Time Entry</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div><label style={lS}>Job Name</label><select style={iS} value={jobName} onChange={e => setJobName(e.target.value)}><option value="">Select or type...</option>{projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
        <div><label style={lS}>Job Number</label><input style={iS} value={jobNumber} onChange={e => setJobNumber(e.target.value)} placeholder="e.g., FWT-2024-042" /></div>
        <div><label style={lS}>Department</label><select style={iS} value={department} onChange={e => setDepartment(e.target.value)}>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
        <div><label style={lS}>Date *</label><input type="date" style={iS} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label style={lS}>Hours *</label><input type="number" step="0.25" min="0" max="24" style={iS} value={hours} onChange={e => setHours(e.target.value)} /></div>
        <div><label style={lS}>Labor Category</label><select style={iS} value={category} onChange={e => setCategory(e.target.value)}>{LABOR_PHASES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label style={lS}>Hours Type</label>
          <div style={{ display: "flex", gap: 4 }}>
            {["regular", "overtime"].map(t => (
              <button key={t} onClick={() => setHoursType(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: hoursType === t ? "2px solid " + (t === "overtime" ? "#f59e0b" : "#10b981") : "1px solid #1e293b", background: hoursType === t ? (t === "overtime" ? "#f59e0b22" : "#10b98122") : "transparent", color: hoursType === t ? (t === "overtime" ? "#f59e0b" : "#10b981") : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{t}</button>
            ))}
          </div>
        </div>
        <div><label style={lS}>Prevailing Wage</label>
          <button onClick={() => setPrevailingWage(!prevailingWage)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: prevailingWage ? "2px solid #8b5cf6" : "1px solid #1e293b", background: prevailingWage ? "#8b5cf622" : "transparent", color: prevailingWage ? "#8b5cf6" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{prevailingWage ? "✓ PW" : "Not PW"}</button>
        </div>
        <div style={{ gridColumn: "span 3" }}><label style={lS}>Notes</label><input style={iS} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was done?" /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button onClick={handleAdd} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: hours && date ? 1 : 0.4 }}><Plus size={14} /> Log Hours</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px 100px" : "24px" }}>

      {isAdmin && (
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {[{ id: "mine", label: "My Timesheets" }, { id: "team", label: "Team" }].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)} style={{ padding: isMobile ? "10px 16px" : "8px 18px", borderRadius: 8, border: "1px solid #1e293b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: viewMode === v.id ? "#6366f1" : "transparent", color: viewMode === v.id ? "#fff" : "#94a3b8" }}>{v.label}</button>
          ))}
        </div>
      )}

      {viewMode === "mine" && (
        <>
          {isMobile ? MobileEntryForm : DesktopEntryForm}

          <div style={{ background: "#1a2332", borderRadius: 10, border: "1px solid #1e293b", padding: isMobile ? "14px 16px" : "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: isMobile ? 12 : 16, flexWrap: "wrap" }}>
            <select
              style={{ ...iS, width: "auto", flex: isMobile ? "1 1 auto" : "none", minWidth: 0, padding: isMobile ? "10px 12px" : "6px 10px" }}
              value={filterWeek}
              onChange={e => setFilterWeek(e.target.value)}
            >
              <option value="all">All Weeks</option>
              {weeks.map(w => <option key={w} value={w}>Week of {w}</option>)}
            </select>
            <div style={{ display: "flex", gap: isMobile ? 12 : 16, marginLeft: "auto", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Regular</div>
                <div style={{ fontSize: isMobile ? 16 : 14, fontWeight: 700, color: "#10b981" }}>{totalReg.toFixed(1)}h</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Overtime</div>
                <div style={{ fontSize: isMobile ? 16 : 14, fontWeight: 700, color: "#f59e0b" }}>{totalOT.toFixed(1)}h</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Total</div>
                <div style={{ fontSize: isMobile ? 18 : 16, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>{(totalReg + totalOT).toFixed(1)}h</div>
              </div>
            </div>
          </div>

          {filterWeek !== "all" && filtered.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <button onClick={emailTimesheet} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "12px 20px" : "8px 16px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <Send size={14} /> Email Timesheet
              </button>
              <span style={{ fontSize: 11, color: "#64748b" }}>Opens in Outlook / your default mail client</span>
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#334155", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏱️</div>
              No time entries yet.
            </div>
          )}

          {filtered.map(entry => (
            <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "14px 16px" : "12px 16px", background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", marginBottom: 8 }}>
              <div style={{ width: isMobile ? 52 : 44, height: isMobile ? 52 : 44, borderRadius: 10, background: entry.hoursType === "overtime" ? "#f59e0b22" : "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", flexShrink: 0 }}>
                <span style={{ fontSize: isMobile ? 16 : 14, fontWeight: 700, color: entry.hoursType === "overtime" ? "#f59e0b" : "#818cf8", fontFamily: "'Outfit',sans-serif" }}>{entry.hours}h</span>
                {entry.hoursType === "overtime" && <span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700, lineHeight: 1 }}>OT</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 14 : 13, fontWeight: 600, color: "#fff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.jobName || "—"}{entry.jobNumber ? ` · #${entry.jobNumber}` : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#94a3b8" }}>{entry.date}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#94a3b8", fontSize: 11 }}>{getCategoryName(entry.category)}</span>
                  {!isMobile && entry.department && <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#64748b", fontSize: 11 }}>{entry.department}</span>}
                  {entry.prevailingWage && <span style={{ padding: "1px 6px", borderRadius: 4, background: "#8b5cf622", color: "#8b5cf6", fontSize: 11, fontWeight: 600 }}>PW</span>}
                  {entry.notes && <span style={{ color: "#475569", fontSize: 12 }}>— {entry.notes}</span>}
                </div>
              </div>
              <button
                onClick={() => onRemove(entry.id)}
                style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", flexShrink: 0, padding: 8, minWidth: isMobile ? 44 : "auto", minHeight: isMobile ? 44 : "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </>
      )}

      {viewMode === "team" && isAdmin && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <select style={{ ...iS, flex: 1, minWidth: 140 }} value={showAdminMember || ""} onChange={e => setShowAdminMember(e.target.value || null)}>
              <option value="">All Members</option>
              {teamRoster.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <select style={{ ...iS, flex: 1, minWidth: 140 }} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
              <option value="all">All Weeks</option>
              {teamWeeks.map(w => <option key={w} value={w}>Week of {w}</option>)}
            </select>
            <div style={{ padding: "10px 16px", background: "#1a2332", borderRadius: 8, border: "1px solid #1e293b", display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>
                {teamFiltered.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0).toFixed(1)}h
              </span>
            </div>
          </div>

          {teamFiltered.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#334155", fontSize: 14 }}>No team entries found.</div>
          )}

          {teamFiltered.map(entry => (
            <div key={entry.id + entry.member} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "14px 16px" : "12px 16px", background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", marginBottom: 8 }}>
              <div style={{ width: isMobile ? 52 : 44, height: isMobile ? 52 : 44, borderRadius: 10, background: entry.hoursType === "overtime" ? "#f59e0b22" : "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", flexShrink: 0 }}>
                <span style={{ fontSize: isMobile ? 16 : 14, fontWeight: 700, color: entry.hoursType === "overtime" ? "#f59e0b" : "#818cf8", fontFamily: "'Outfit',sans-serif" }}>{entry.hours}h</span>
                {entry.hoursType === "overtime" && <span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700, lineHeight: 1 }}>OT</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 14 : 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>
                  <span style={{ color: "#818cf8" }}>{entry.member}</span> · {entry.jobName || "—"}
                  {entry.jobNumber ? ` · #${entry.jobNumber}` : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#94a3b8" }}>{entry.date}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#94a3b8", fontSize: 11 }}>{getCategoryName(entry.category)}</span>
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
