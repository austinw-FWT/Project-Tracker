import { useState } from "react";
import { AlertCircle, Clock, DollarSign, CheckCircle2, Calendar, ArrowRight, TrendingUp, Package } from "lucide-react";

export default function Dashboard({ data, myName, onSelectProject, onNavigate }) {
  const projects = data.projects || [];
  const myPrivate = (data.memberPrivate || {})[myName] || {};
  const schedule = data.schedule || {};
  const today = new Date().toISOString().split("T")[0];

  // My assigned projects
  const myProjects = projects.filter(p => (p.teamMembers || []).includes(myName));

  // Today's schedule
  const todayAssignment = schedule[today]?.[myName];
  const todayProject = todayAssignment ? projects.find(p => p.id === todayAssignment) : null;

  // Overdue tasks across my projects
  const overdueTasks = [];
  myProjects.forEach(p => {
    (p.tasks || []).filter(t => !t.done && t.assignee === myName).forEach(t => overdueTasks.push({ ...t, projectName: p.name, projectId: p.id }));
  });

  // Hours budget warnings
  const budgetWarnings = myProjects.filter(p => {
    const lh = p.laborHours || {};
    const totalBid = Object.values(lh).reduce((s, v) => s + (v.bid || 0), 0);
    const totalRemaining = Object.values(lh).reduce((s, v) => s + (v.remaining || 0), 0);
    return totalBid > 0 && totalRemaining / totalBid < 0.15;
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

  const iS = { background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: "18px 20px" };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px" }}>
      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: "0 0 4px" }}>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {myName.split(" ")[0]}</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      </div>

      {/* Top Row: Today + Daily Progress */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={iS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={14} /> Today's Assignment</div>
          {todayProject ? (
            <div onClick={() => onSelectProject(todayProject)} style={{ cursor: "pointer", padding: "12px 14px", background: "#0f1729", borderRadius: 8, border: "1px solid #1e293b" }}>
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
              <div style={{ height: 8, background: "#0f1729", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${dtTotal > 0 ? (dtDone / dtTotal) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg, #6366f1, #10b981)", borderRadius: 4, transition: "width 0.3s" }} /></div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{dtTotal > 0 ? Math.round((dtDone / dtTotal) * 100) : 0}% complete</div>
            </div>
            <button onClick={() => onNavigate("myspace", "daily")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Open →</button>
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "My Tasks", value: overdueTasks.length, color: overdueTasks.length > 0 ? "#f59e0b" : "#10b981", icon: CheckCircle2 },
          { label: "Budget Alerts", value: budgetWarnings.length, color: budgetWarnings.length > 0 ? "#ef4444" : "#10b981", icon: TrendingUp },
          { label: "Overdue Invoices", value: overdueInvoices.length, color: overdueInvoices.length > 0 ? "#ef4444" : "#10b981", icon: DollarSign },
          { label: "Backordered", value: backorderedItems.length, color: backorderedItems.length > 0 ? "#ef4444" : "#10b981", icon: Package },
        ].map((a, i) => (
          <div key={i} style={{ background: "#1a2332", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e293b", borderLeft: `3px solid ${a.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><a.icon size={13} style={{ color: a.color }} /><span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>{a.label}</span></div>
            <div style={{ fontSize: 22, fontWeight: 700, color: a.color, fontFamily: "'Outfit',sans-serif" }}>{a.value}</div>
          </div>
        ))}
      </div>

      {/* My Projects + Opportunities */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={iS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>My Active Projects ({myProjects.length})</span>
            <button onClick={() => onNavigate("board")} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>View Board →</button>
          </div>
          {myProjects.slice(0, 6).map(p => {
            const lh = p.laborHours || {};
            const bid = Object.values(lh).reduce((s, v) => s + (v.bid || 0), 0);
            const rem = Object.values(lh).reduce((s, v) => s + (v.remaining || 0), 0);
            const pct = bid > 0 ? Math.round(((bid - rem) / bid) * 100) : 0;
            const openTasks = (p.tasks || []).filter(t => !t.done).length;
            return (
              <div key={p.id} onClick={() => onSelectProject(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #0f1729", cursor: "pointer" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{p.customer}</div>
                </div>
                {bid > 0 && <div style={{ width: 50, height: 4, borderRadius: 2, background: "#0f1729", overflow: "hidden" }}><div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: pct > 90 ? "#ef4444" : "#6366f1", borderRadius: 2 }} /></div>}
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
            <button onClick={() => onNavigate("myspace", "opportunities")} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>View All →</button>
          </div>
          {opps.slice(0, 5).map(o => (
            <div key={o.id} style={{ padding: "8px 0", borderBottom: "1px solid #0f1729" }}>
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
            const lh = p.laborHours || {};
            const bid = Object.values(lh).reduce((s, v) => s + (v.bid || 0), 0);
            const rem = Object.values(lh).reduce((s, v) => s + (v.remaining || 0), 0);
            return (
              <div key={p.id} onClick={() => onSelectProject(p)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #0f1729", cursor: "pointer" }}>
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
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #0f1729" }}>
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
