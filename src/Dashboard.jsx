import { useState, useEffect } from "react";
import { AlertCircle, Clock, DollarSign, CheckCircle2, Calendar, ArrowRight, TrendingUp, Package } from "lucide-react";
import { laborTotals } from "./laborMath.js";
import { scheduleEntries } from "./db.js";
import { resolveJobRole } from "./permissions.js";

export default function Dashboard({ data, myName, onSelectProject, onNavigate, perms, teamRoster }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const projects = data.projects || [];
  const myPrivate = (data.memberPrivate || {})[myName] || {};
  const schedule = data.schedule || {};
  const today = new Date().toISOString().split("T")[0];

  // My assigned projects
  const myProjects = projects.filter(p => (p.teamMembers || []).includes(myName));

  // Today's schedule — handle both legacy (string) and new (array of entries) formats
  const rawAssignment = schedule[today]?.[myName];
  let todayProject = null;
  if (typeof rawAssignment === "string" && rawAssignment) {
    todayProject = projects.find(p => p.id === rawAssignment) || null;
  } else if (Array.isArray(rawAssignment)) {
    const projEntry = rawAssignment.find(e => e.type === "project" && e.id);
    if (projEntry) todayProject = projects.find(p => p.id === projEntry.id) || null;
  }

  // Overdue tasks across my projects
  const overdueTasks = [];
  myProjects.forEach(p => {
    (p.tasks || []).filter(t => !t.done && t.assignee === myName).forEach(t => overdueTasks.push({ ...t, projectName: p.name, projectId: p.id }));
  });

  // Hours budget warnings
  const budgetWarnings = myProjects.filter(p => {
    const t = laborTotals(p);
    return t.bid > 0 && t.remaining / t.bid < 0.15;
  });

  // Overdue invoices
  const overdueInvoices = [];
  myProjects.forEach(p => {
    (p.invoices || []).filter(i => i.status === "overdue").forEach(i => overdueInvoices.push({ ...i, projectName: p.name }));
  });

  // Backordered materials
  const backorderedItems = [];
  myProjects.forEach(p => {
    (p.materials || []).filter(m => m.status === "Backordered").forEach(m => backorderedItems.push({ ...m, projectName: p.name }));
  });

  // My daily tracker progress
  const dt = myPrivate.dailyTracker?.dailySections || [];
  let dtDone = 0, dtTotal = 0;
  dt.forEach(s => { if (s.type === "tasks") s.items.forEach(i => { dtTotal++; if (i.done) dtDone++; }); });

  // My opportunities
  const opps = myPrivate.opportunities || [];

  // Upcoming deadlines (projects with tasks)
  const pendingTasks = [];
  myProjects.forEach(p => { (p.tasks || []).filter(t => !t.done).forEach(t => pendingTasks.push({ ...t, projectName: p.name, projectId: p.id })); });

  const iS = { background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", padding: "18px 20px" };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: isMobile ? "16px 14px" : "20px 24px" }}>
      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 24, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: "0 0 4px" }}>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {myName.split(" ")[0]}</h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      </div>

      {perms?.isAdminRole && <LogCompliance projects={data.projects} teamRoster={teamRoster || data.teamRoster} schedule={schedule} isMobile={isMobile} onSelectProject={onSelectProject} />}

      {/* Top Row: Today + Daily Progress */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={iS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={14} /> Today's Assignment</div>
          {todayProject ? (
            <div onClick={() => onSelectProject(todayProject)} style={{ cursor: "pointer", padding: "12px 14px", background: "#0A192F", borderRadius: 8, border: "1px solid #1A3050" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{todayProject.name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{todayProject.customer}</div>
            </div>
          ) : <div style={{ fontSize: 13, color: "#334155" }}>No assignment today</div>}
        </div>
        <div style={iS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={14} /> Daily Task Progress</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: dtTotal > 0 && dtDone === dtTotal ? "#10b981" : "#fff", fontFamily: "'Outfit',sans-serif" }}>{dtDone}/{dtTotal}</div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: "#0A192F", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${dtTotal > 0 ? (dtDone / dtTotal) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg, #69BE28, #10b981)", borderRadius: 4, transition: "width 0.3s" }} /></div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{dtTotal > 0 ? Math.round((dtDone / dtTotal) * 100) : 0}% complete</div>
            </div>
            <button onClick={() => onNavigate("myspace", "daily")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Open →</button>
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[
          { label: "My Tasks", value: overdueTasks.length, color: overdueTasks.length > 0 ? "#f59e0b" : "#10b981", icon: CheckCircle2 },
          { label: "Budget Alerts", value: budgetWarnings.length, color: budgetWarnings.length > 0 ? "#ef4444" : "#10b981", icon: TrendingUp },
          { label: "Overdue Invoices", value: overdueInvoices.length, color: overdueInvoices.length > 0 ? "#ef4444" : "#10b981", icon: DollarSign },
          { label: "Backordered", value: backorderedItems.length, color: backorderedItems.length > 0 ? "#ef4444" : "#10b981", icon: Package },
        ].map((a, i) => (
          <div key={i} style={{ background: "#0F2444", borderRadius: 10, padding: "14px 16px", border: "1px solid #1A3050", borderLeft: `3px solid ${a.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><a.icon size={13} style={{ color: a.color }} /><span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>{a.label}</span></div>
            <div style={{ fontSize: 22, fontWeight: 700, color: a.color, fontFamily: "'Outfit',sans-serif" }}>{a.value}</div>
          </div>
        ))}
      </div>

      {/* My Projects + Opportunities */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={iS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>My Active Projects ({myProjects.length})</span>
            <button onClick={() => onNavigate("board")} style={{ fontSize: 11, color: "#69BE28", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>View Board →</button>
          </div>
          {myProjects.slice(0, 6).map(p => {
            const t = laborTotals(p);
            const bid = t.bid, rem = t.remaining;
            const pct = t.pctUsed;
            const openTasks = (p.tasks || []).filter(t => !t.done).length;
            return (
              <div key={p.id} onClick={() => onSelectProject(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #0A192F", cursor: "pointer" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{p.customer}</div>
                </div>
                {bid > 0 && <div style={{ width: 50, height: 4, borderRadius: 2, background: "#0A192F", overflow: "hidden" }}><div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: pct > 90 ? "#ef4444" : "#69BE28", borderRadius: 2 }} /></div>}
                {openTasks > 0 && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#f59e0b22", color: "#f59e0b" }}>{openTasks} tasks</span>}
                <ArrowRight size={12} style={{ color: "#334155" }} />
              </div>
            );
          })}
          {myProjects.length === 0 && <div style={{ fontSize: 12, color: "#334155", padding: 12 }}>No projects assigned to you yet.</div>}
        </div>
        <div style={iS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Opportunities ({opps.length})</span>
            <button onClick={() => onNavigate("myspace", "opportunities")} style={{ fontSize: 11, color: "#69BE28", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>View All →</button>
          </div>
          {opps.slice(0, 5).map(o => (
            <div key={o.id} style={{ padding: "8px 0", borderBottom: "1px solid #0A192F" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{o.name}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>{o.customer}{o.bidAmount ? ` · $${o.bidAmount}` : ""}</div>
            </div>
          ))}
          {opps.length === 0 && <div style={{ fontSize: 12, color: "#334155", padding: 12 }}>No opportunities yet.</div>}
        </div>
      </div>

      {/* Budget Warnings Detail */}
      {budgetWarnings.length > 0 && (
        <div style={{ ...iS, marginBottom: 16, borderLeft: "3px solid #ef4444" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><AlertCircle size={14} /> Budget Alerts</div>
          {budgetWarnings.map(p => {
            const t = laborTotals(p);
            const bid = t.bid, rem = t.remaining;
            return (
              <div key={p.id} onClick={() => onSelectProject(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #0A192F", cursor: "pointer" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{rem.toFixed(1)}h remaining of {bid.toFixed(1)}h</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Backordered Materials */}
      {backorderedItems.length > 0 && (
        <div style={{ ...iS, borderLeft: "3px solid #ef4444" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Package size={14} /> Backordered Materials</div>
          {backorderedItems.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #0A192F" }}>
              <span style={{ fontSize: 13, color: "#fff", flex: 1 }}>{m.item}</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>{m.projectName}</span>
              {m.deliveryDate && <span style={{ fontSize: 11, color: "#f59e0b" }}>ETA: {m.deliveryDate}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/**
 * LogCompliance — "who hasn't logged today", admin-only.
 *
 * Only FOREMEN are required to submit daily logs at FWT (PMs/estimators are
 * admins; techs and apprentices may log but aren't on the hook). Role comes
 * from the Team roster, so this list stays correct as crews change.
 *
 * A person counts as having logged when any project daily log for the date
 * carries their name as the submitting member. Reads existing data only.
 */
function LogCompliance({ projects, teamRoster, schedule, isMobile, onSelectProject }) {
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = iso(new Date());
  const isWorkday = d => d.getDay() !== 0 && d.getDay() !== 6;

  // Last 5 workdays, oldest → newest
  const days = [];
  for (let back = 0; days.length < 5 && back < 14; back++) {
    const d = new Date(); d.setDate(d.getDate() - back);
    if (isWorkday(d)) days.unshift(iso(d));
  }

  const foremen = (teamRoster || []).filter(m => (m.jobRole || "") === "foreman");
  const allLogs = [];
  (projects || []).forEach(p => (p.dailyLogs || []).forEach(l => allLogs.push({ ...l, projectId: p.id, projectName: p.name, jobNumber: p.jobNumber })));

  const loggedOn = (name, date) => allLogs.some(l => l.member === name && l.date === date);
  const lastLogged = name => {
    const mine = allLogs.filter(l => l.member === name).map(l => l.date).sort();
    return mine.length ? mine[mine.length - 1] : null;
  };
  const daysAgo = dateStr => {
    if (!dateStr) return null;
    return Math.round((new Date(today + "T12:00:00") - new Date(dateStr + "T12:00:00")) / 86400000);
  };
  const scheduledToday = name => {
    const entries = scheduleEntries((schedule || {})[today]?.[name]);
    return entries.filter(e => e.type === "project").map(e => (projects || []).find(p => p.id === e.id)).filter(Boolean);
  };

  if (foremen.length === 0) {
    return (
      <div style={{ background: "#0F2444", border: "1px dashed #1A3050", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Daily log compliance</div>
        <div style={{ fontSize: 12.5, color: "#64748b" }}>No one is marked as a Foreman yet. Open <strong style={{ color: "#82CC4A" }}>Team</strong> and set roles — foremen are the ones expected to submit daily logs.</div>
      </div>
    );
  }

  const missingToday = foremen.filter(m => !loggedOn(m.name, today));
  const allIn = missingToday.length === 0;

  return (
    <div style={{ background: "#0F2444", border: `1px solid ${allIn ? "#69BE2844" : "#f59e0b44"}`, borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Daily log compliance</span>
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 800, background: allIn ? "#69BE2822" : "#f59e0b22", color: allIn ? "#82CC4A" : "#f59e0b" }}>
          {allIn ? `ALL ${foremen.length} IN` : `${missingToday.length} OF ${foremen.length} MISSING TODAY`}
        </span>
        <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>Foremen only</span>
      </div>

      {/* header strip of dates */}
      {!isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: "150px repeat(5, 38px) 1fr", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <span />
          {days.map(d => (<span key={d} style={{ fontSize: 9.5, color: d === today ? "#82CC4A" : "#475569", textAlign: "center", fontWeight: 700 }}>{new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2).toUpperCase()}</span>))}
          <span />
        </div>
      )}

      {foremen.map(m => {
        const okToday = loggedOn(m.name, today);
        const last = lastLogged(m.name);
        const ago = daysAgo(last);
        const jobs = scheduledToday(m.name);
        return (
          <div key={m.id} style={{ display: isMobile ? "flex" : "grid", gridTemplateColumns: isMobile ? undefined : "150px repeat(5, 38px) 1fr", gap: isMobile ? 8 : 6, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #13294d", flexWrap: isMobile ? "wrap" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: isMobile ? 120 : undefined }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: okToday ? "#69BE28" : "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
            </div>
            {!isMobile && days.map(d => {
              const hit = loggedOn(m.name, d);
              return (<div key={d} title={`${d}: ${hit ? "logged" : "no log"}`} style={{ height: 20, borderRadius: 5, background: hit ? "#69BE2833" : "#1A3050", border: d === today ? `1px solid ${hit ? "#69BE28" : "#ef4444"}` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: hit ? "#82CC4A" : "#334155", fontWeight: 800 }}>{hit ? "✓" : "–"}</div>);
            })}
            <div style={{ fontSize: 11.5, color: okToday ? "#64748b" : "#f59e0b", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {okToday
                ? <span>Logged today{jobs.length ? ` · ${jobs.map(j => j.jobNumber ? "#" + j.jobNumber : j.name).join(", ")}` : ""}</span>
                : <span style={{ fontWeight: 700 }}>{last ? `Last log ${ago === 1 ? "yesterday" : ago + " days ago"}` : "No logs on record"}{jobs.length ? ` · scheduled at ${jobs.map(j => j.name).join(", ")}` : " · not scheduled today"}</span>}
              {!okToday && jobs.length > 0 && onSelectProject && (
                <button onClick={() => onSelectProject(jobs[0])} style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid #1A3050", background: "transparent", color: "#64748b", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Open job</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
