import { useState, useEffect } from "react";
import { Plus, X, Clock, Users, Send, ChevronDown, ChevronUp } from "lucide-react";

const CATEGORIES = ["Installation", "Programming", "Termination", "Cable Pull", "Site Walk", "Design", "Commissioning", "Punch List", "Training", "Travel", "Other"];
const DEPARTMENTS = ["Low Voltage", "Networking", "Structured Cabling", "Security", "Fire Alarm", "Audio Visual", "General"];

const FB_URL = "https://fwt-lv-tracker-default-rtdb.firebaseio.com";

// ── EmailJS config ──
const EMAILJS_SERVICE_ID = "service_6tx50jm";
const EMAILJS_TEMPLATE_ID = "template_ddiqn66";
const EMAILJS_PUBLIC_KEY = "Xb33ru_cSgS_Ekb-4";

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

async function sendEmailJS(toEmails, templateParams) {
  const r = await fetch("https://api.emailjs.com/api/v1.6/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: { ...templateParams, to_email: toEmails.join(",") },
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`EmailJS error (${r.status}): ${text}`);
  }
  return true;
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
  const [category, setCategory] = useState("Installation");
  const [hoursType, setHoursType] = useState("regular");
  const [notes, setNotes] = useState("");
  const [filterWeek, setFilterWeek] = useState("all");
  const [viewMode, setViewMode] = useState("mine");
  const [showAdminMember, setShowAdminMember] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showForm, setShowForm] = useState(!isMobile); // mobile: form collapsed by default

  async function emailTimesheet() {
    if (filterWeek === "all" || filtered.length === 0) return;
    setSending(true); setSendResult(null);
    try {
      const adminEmails = await getAdminEmails();
      const recipients = [...new Set([...adminEmails, ...(predefinedEmail ? [predefinedEmail] : [])])].filter(Boolean);

      if (recipients.length === 0) {
        setSendResult({ ok: false, msg: "No admin emails found. Add users with admin role in User Admin." });
        setSending(false);
        return;
      }

      const body = filtered.map(e =>
        `${e.date}  |  ${e.jobName || "—"}  |  ${e.hours}h ${e.hoursType === "overtime" ? "(OT)" : ""}  |  ${e.category}${e.notes ? "  |  " + e.notes : ""}`
      ).join("\n");

      const totalHrs = filtered.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);

      await sendEmailJS(recipients, {
        from_name: myName,
        reply_to: myEmail || "",
        date_range: "Week of " + filterWeek,
        total_hours: totalHrs.toFixed(1) + "h",
        timesheet_body: body,
      });

      setSendResult({ ok: true, msg: `Sent to ${recipients.length} recipient(s)` });
    } catch (err) {
      setSendResult({ ok: false, msg: err.message });
    }
    setSending(false);
    setTimeout(() => setSendResult(null), 4000);
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
    onAdd({ jobName: jobName || (pj?.name || ""), jobNumber, department, date, hours: parseFloat(hours), category, hoursType, notes: notes.trim(), projectId: pj?.id || "" });
    setHours(""); setNotes(""); setJobNumber("");
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

  // Mobile entry form as bottom sheet style
  const MobileEntryForm = (
    <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", marginBottom: 16, overflow: "hidden" }}>
      {/* Collapsible header */}
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
          {/* Date + Hours — most important fields first on mobile */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={lS}>Date *</label><input type="date" style={iS} value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label style={lS}>Hours *</label><input type="number" step="0.25" min="0" max="24" style={iS} value={hours} onChange={e => setHours(e.target.value)} placeholder="0.0" /></div>
          </div>

          {/* Hours type — big tap targets */}
          <div style={{ marginBottom: 12 }}>
            <label style={lS}>Hours Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["regular", "overtime"].map(t => (
                <button key={t} onClick={() => setHoursType(t)} style={{ flex: 1, padding: "12px 8px", borderRadius: 10, border: hoursType === t ? `2px solid ${t === "overtime" ? "#f59e0b" : "#10b981"}` : "1px solid #1e293b", background: hoursType === t ? (t === "overtime" ? "#f59e0b22" : "#10b98122") : "transparent", color: hoursType === t ? (t === "overtime" ? "#f59e0b" : "#10b981") : "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Job */}
          <div style={{ marginBottom: 12 }}>
            <label style={lS}>Job Name</label>
            <select style={iS} value={jobName} onChange={e => setJobName(e.target.value)}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          {/* Category */}
          <div style={{ marginBottom: 12 }}>
            <label style={lS}>Category</label>
            <select style={iS} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={lS}>Notes</label>
            <input style={iS} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was done?" />
          </div>

          {/* Submit */}
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
        <button onClick={handleAdd} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: hours && date ? 1 : 0.4 }}><Plus size={14} /> Log Hours</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px 100px" : "24px" }}>

      {/* Admin toggle */}
      {isAdmin && (
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {[{ id: "mine", label: "My Timesheets" }, { id: "team", label: "Team" }].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)} style={{ padding: isMobile ? "10px 16px" : "8px 18px", borderRadius: 8, border: "1px solid #1e293b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: viewMode === v.id ? "#6366f1" : "transparent", color: viewMode === v.id ? "#fff" : "#94a3b8" }}>{v.label}</button>
          ))}
        </div>
      )}

      {viewMode === "mine" && (
        <>
          {/* Entry form */}
          {isMobile ? MobileEntryForm : DesktopEntryForm}

          {/* Summary bar */}
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

          {/* Email export */}
          {filterWeek !== "all" && filtered.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <button onClick={emailTimesheet} disabled={sending} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "12px 20px" : "8px 16px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 600, cursor: sending ? "wait" : "pointer", fontFamily: "inherit", opacity: sending ? 0.6 : 1 }}>
                <Send size={14} /> {sending ? "Sending..." : "Email Timesheet"}
              </button>
              {sendResult && <span style={{ fontSize: 12, color: sendResult.ok ? "#10b981" : "#ef4444", fontWeight: 600 }}>{sendResult.msg}</span>}
            </div>
          )}

          {/* Entries */}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#334155", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏱️</div>
              No time entries yet.
            </div>
          )}

          {filtered.map(entry => (
            <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "14px 16px" : "12px 16px", background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", marginBottom: 8 }}>
              {/* Hours badge */}
              <div style={{ width: isMobile ? 52 : 44, height: isMobile ? 52 : 44, borderRadius: 10, background: entry.hoursType === "overtime" ? "#f59e0b22" : "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", flexShrink: 0 }}>
                <span style={{ fontSize: isMobile ? 16 : 14, fontWeight: 700, color: entry.hoursType === "overtime" ? "#f59e0b" : "#818cf8", fontFamily: "'Outfit',sans-serif" }}>{entry.hours}h</span>
                {entry.hoursType === "overtime" && <span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700, lineHeight: 1 }}>OT</span>}
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 14 : 13, fontWeight: 600, color: "#fff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.jobName || "—"}{entry.jobNumber ? ` · #${entry.jobNumber}` : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#94a3b8" }}>{entry.date}</span>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#94a3b8", fontSize: 11 }}>{entry.category}</span>
                  {!isMobile && <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#64748b", fontSize: 11 }}>{entry.department}</span>}
                  {entry.notes && <span style={{ color: "#475569", fontSize: 12 }}>— {entry.notes}</span>}
                </div>
              </div>

              {/* Delete */}
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
          {/* Filters */}
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
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#94a3b8", fontSize: 11 }}>{entry.category}</span>
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
