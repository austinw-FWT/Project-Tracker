import { useState, useEffect, useMemo } from "react";
import { Plus, X, CheckCircle2, Circle } from "lucide-react";

const DEFAULT_SECTIONS = [
  { id: "priority", icon: "🎯", title: "Today's #1 Priority", color: "#ff6b6b", time: "Do this first", type: "tasks", items: [{ id: "p1", text: "", done: false }] },
  { id: "hotlist", icon: "🔥", title: "Hot List", color: "#ffa94d", time: "Max 3 items", type: "tasks", items: [{ id: "h1", text: "", done: false }, { id: "h2", text: "", done: false }, { id: "h3", text: "", done: false }] },
  { id: "bids", icon: "📐", title: "Bids & Estimates", color: "#ffd43b", time: "~30 min block", type: "tasks", items: [{ id: "b1", text: "", done: false }, { id: "b2", text: "", done: false }, { id: "b3", text: "", done: false }] },
  { id: "projects", icon: "🏗️", title: "Active Projects", color: "#38d9a9", time: "~30 min block", type: "tasks", items: [{ id: "pr1", text: "", done: false }, { id: "pr2", text: "", done: false }, { id: "pr3", text: "", done: false }] },
  { id: "comms", icon: "📞", title: "Calls & Emails to Return", color: "#74c0fc", time: "~20 min block", type: "tasks", items: [{ id: "c1", text: "", done: false }, { id: "c2", text: "", done: false }, { id: "c3", text: "", done: false }] },
  { id: "orders", icon: "📦", title: "Orders & Submittals", color: "#b197fc", time: "~15 min block", type: "tasks", items: [{ id: "o1", text: "", done: false }, { id: "o2", text: "", done: false }] },
  { id: "scheduling", icon: "📅", title: "Scheduling & Coordination", color: "#f06595", time: "~15 min block", type: "tasks", items: [{ id: "s1", text: "", done: false }, { id: "s2", text: "", done: false }] },
  { id: "parking", icon: "🅿️", title: "Parking Lot", color: "#9a96b0", time: "Brain dump zone", type: "notes", items: [{ id: "pk1", text: "" }, { id: "pk2", text: "" }, { id: "pk3", text: "" }, { id: "pk4", text: "" }] },
  { id: "eod", icon: "🌙", title: "End of Day Check-In", color: "#69db7c", time: "~5 min", type: "tasks", items: [
    { id: "e1", text: "Updated project boards / FWT Workspaces", done: false },
    { id: "e2", text: "Sent any promises I made today", done: false },
    { id: "e3", text: "Moved unfinished Hot List items to tomorrow", done: false },
    { id: "e4", text: "Tomorrow's #1 priority:", done: false, hasInput: true, inputValue: "" },
  ]},
];

const WEEKLY_SECTIONS = [
  { id: "monday", icon: "🟦", title: "Monday — Week Setup", color: "#74c0fc", time: "~45 min", items: [
    { id: "m1", text: "Review all active project statuses & timelines", done: false },
    { id: "m2", text: "Check open bids — any follow-ups or deadlines this week?", done: false },
    { id: "m3", text: "Review crew schedule & assignments for the week", done: false },
    { id: "m4", text: "Check material lead times & outstanding POs", done: false },
    { id: "m5", text: "Review project budgets — flag anything trending over", done: false },
    { id: "m6", text: "Confirm site access / badging for the week's jobs", done: false },
  ]},
  { id: "wednesday", icon: "🟧", title: "Wednesday — Mid-Week Check", color: "#ffa94d", time: "~45 min", items: [
    { id: "w1", text: "QuickBooks: review project hours vs. budget", done: false },
    { id: "w2", text: "QuickBooks: check overdue invoices, send reminders", done: false },
    { id: "w3", text: "Review submittals — any outstanding approvals?", done: false },
    { id: "w4", text: "Check permit status on active jobs", done: false },
    { id: "w5", text: "Follow up on open RFIs or design questions", done: false },
    { id: "w6", text: "Verify parts & materials arriving for upcoming installs", done: false },
    { id: "w7", text: "Review tech time logs — anyone under/over-allocated?", done: false },
  ]},
  { id: "friday", icon: "🟩", title: "Friday — Close the Week", color: "#38d9a9", time: "~60 min", items: [
    { id: "f1", text: "Send project update emails to customers", done: false },
    { id: "f2", text: "Send progress updates to GCs (if subbing)", done: false },
    { id: "f3", text: "Invoice completed milestones / T&M hours", done: false },
    { id: "f4", text: "Log change orders — any pending approvals?", done: false },
    { id: "f5", text: "Update punch list status on jobs nearing closeout", done: false },
    { id: "f6", text: "Update FWT Workspaces board with current statuses", done: false },
    { id: "f7", text: "File warranty registrations from completed installs", done: false },
    { id: "f8", text: "Review next week's calendar for conflicts", done: false },
  ]},
  { id: "asneeded", icon: "🔄", title: "As-Needed Weekly", color: "#b197fc", time: "If applicable", items: [
    { id: "a1", text: "Update as-built drawings", done: false },
    { id: "a2", text: "Review closeout package progress (O&Ms, training docs, certs)", done: false },
    { id: "a3", text: "Check insurance / license renewals or compliance deadlines", done: false },
    { id: "a4", text: "Review subcontractor or vendor performance issues", done: false },
    { id: "a5", text: "Safety toolbox talk / documentation", done: false },
    { id: "a6", text: "Back up project files / photos to server", done: false },
  ]},
  { id: "eow", icon: "✅", title: "End of Week Check-In", color: "#69db7c", time: "~5 min", items: [
    { id: "ew1", text: "Every active project has a current status", done: false },
    { id: "ew2", text: "No invoices sitting unsent", done: false },
    { id: "ew3", text: "No customer emails older than 48 hrs unanswered", done: false },
    { id: "ew4", text: "Next Monday's #1 priority:", done: false, hasInput: true, inputValue: "" },
  ]},
];

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function DailyTracker({ data, onSave }) {
  const trackerData = data || {};
  const [dateText, setDateText] = useState(trackerData.dateText || "");
  const [dailySections, setDailySections] = useState(trackerData.dailySections || DEFAULT_SECTIONS);
  const [weeklySections, setWeeklySections] = useState(trackerData.weeklySections || WEEKLY_SECTIONS);

  function save(daily, weekly, dt) {
    const d = daily || dailySections, w = weekly || weeklySections;
    onSave({ dateText: dt !== undefined ? dt : dateText, dailySections: d, weeklySections: w });
  }

  // Daily section handlers
  function updateDailyItem(secIdx, itemIdx, updates) {
    const ns = dailySections.map((s, si) => si === secIdx ? { ...s, items: s.items.map((it, ii) => ii === itemIdx ? { ...it, ...updates } : it) } : s);
    setDailySections(ns); save(ns, null);
  }
  function addDailyItem(secIdx) {
    const ns = dailySections.map((s, si) => si === secIdx ? { ...s, items: [...s.items, { id: genId(), text: "", done: false }] } : s);
    setDailySections(ns); save(ns, null);
  }
  function removeDailyItem(secIdx, itemIdx) {
    const ns = dailySections.map((s, si) => si === secIdx ? { ...s, items: s.items.filter((_, ii) => ii !== itemIdx) } : s);
    setDailySections(ns); save(ns, null);
  }

  // Weekly section handlers
  function updateWeeklyItem(secIdx, itemIdx, updates) {
    const ns = weeklySections.map((s, si) => si === secIdx ? { ...s, items: s.items.map((it, ii) => ii === itemIdx ? { ...it, ...updates } : it) } : s);
    setWeeklySections(ns); save(null, ns);
  }
  function addWeeklyItem(secIdx) {
    const ns = weeklySections.map((s, si) => si === secIdx ? { ...s, items: [...s.items, { id: genId(), text: "", done: false }] } : s);
    setWeeklySections(ns); save(null, ns);
  }
  function removeWeeklyItem(secIdx, itemIdx) {
    const ns = weeklySections.map((s, si) => si === secIdx ? { ...s, items: s.items.filter((_, ii) => ii !== itemIdx) } : s);
    setWeeklySections(ns); save(null, ns);
  }

  // Progress
  const { checked, total } = useMemo(() => {
    let c = 0, t = 0;
    dailySections.forEach(s => { if (s.type === "tasks") s.items.forEach(it => { t++; if (it.done) c++; }); });
    return { checked: c, total: t };
  }, [dailySections]);
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const iS = { width: "100%", padding: "6px 0", background: "transparent", border: "none", borderBottom: "1px dashed #4a4570", color: "#e8e6f0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" };

  const cues = { priority: "#1 done? Nice. Now pick from the Hot List ↓", hotlist: "Now batch the rest by category ↓", scheduling: "Almost done. Close out the day ↓" };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", paddingBottom: 12, borderBottom: "2px solid #333355", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e8e6f0", fontFamily: "'Outfit',sans-serif" }}>Daily Task Board</h1>
        <div style={{ marginTop: 8 }}>
          <input value={dateText} onChange={e => { setDateText(e.target.value); save(null, null, e.target.value); }} placeholder="Today's date..." style={{ background: "transparent", border: "none", borderBottom: "1px dashed #6b6785", color: "#9a96b0", fontFamily: "inherit", fontSize: 14, width: 180, textAlign: "center", outline: "none", padding: "2px 4px" }} />
        </div>
      </div>

      {/* Reminder */}
      <div style={{ background: "rgba(177,151,252,0.1)", borderLeft: "3px solid #b197fc", padding: "10px 16px", borderRadius: "0 8px 8px 0", marginBottom: 20, fontSize: 13, color: "#b197fc" }}>
        You don't have to do everything. You have to do the next thing. Start at the top. Work down. That's it.
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b6785", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
          <span>Today's Progress</span><span>{checked} / {total}</span>
        </div>
        <div style={{ height: 6, background: "#2d2d4a", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #38d9a9, #69db7c)", borderRadius: 3, transition: "width 0.5s" }} />
        </div>
      </div>
      {checked === total && total > 0 && <div style={{ textAlign: "center", padding: 16, fontSize: 16, fontWeight: 500, color: "#69db7c", marginBottom: 16 }}>🎉 Everything checked off. You crushed it today.</div>}

      {/* Daily Sections */}
      {dailySections.map((sec, si) => (
        <div key={sec.id}>
          <div style={{ background: "#22223a", borderRadius: 12, padding: "18px 20px", marginBottom: 12, border: "1px solid #333355" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>{sec.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: sec.color }}>{sec.title}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b6785", background: "#2d2d4a", padding: "3px 10px", borderRadius: 20 }}>{sec.time}</span>
            </div>
            {sec.items.map((item, ii) => (
              <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: ii < sec.items.length - 1 ? "1px solid rgba(51,51,85,0.4)" : "none" }}>
                {sec.type === "tasks" ? (
                  <button onClick={() => updateDailyItem(si, ii, { done: !item.done })} style={{ background: "none", border: "none", cursor: "pointer", color: item.done ? "#69db7c" : "#6b6785", flexShrink: 0, marginTop: 2 }}>
                    {item.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                ) : (
                  <span style={{ color: "#6b6785", fontSize: 18, marginTop: 2, flexShrink: 0 }}>•</span>
                )}
                <input style={{ ...iS, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#5a5678" : "#e8e6f0", flex: 1 }} value={item.text} onChange={e => updateDailyItem(si, ii, { text: e.target.value })} placeholder={sec.type === "notes" ? "Brain dump..." : "Task..."} />
                {item.hasInput && <input style={{ ...iS, maxWidth: 220 }} value={item.inputValue || ""} onChange={e => updateDailyItem(si, ii, { inputValue: e.target.value })} placeholder="..." />}
                {sec.items.length > 1 && <button onClick={() => removeDailyItem(si, ii)} style={{ background: "none", border: "none", color: "#4a4570", cursor: "pointer", flexShrink: 0, marginTop: 4 }}><X size={14} /></button>}
              </div>
            ))}
            <button onClick={() => addDailyItem(si)} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, background: "none", border: "none", color: "#6b6785", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>
              <Plus size={13} /> Add line
            </button>
          </div>
          {cues[sec.id] && <div style={{ textAlign: "center", padding: "8px 0", fontSize: 12, color: "#6b6785", fontStyle: "italic" }}>{cues[sec.id]}</div>}
        </div>
      ))}

      {/* Divider */}
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #333355, transparent)", margin: "28px 0" }} />

      {/* Weekly Header */}
      <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#e8e6f0", fontFamily: "'Outfit',sans-serif" }}>Weekly Recurring Tasks</h2>
        <p style={{ fontSize: 13, color: "#6b6785", marginTop: 4 }}>Batched by day so you never have to wonder "did I do that this week?"</p>
      </div>

      {/* Weekly Sections */}
      {weeklySections.map((sec, si) => (
        <div key={sec.id} style={{ background: "#22223a", borderRadius: 12, padding: "18px 20px", marginBottom: 12, border: "1px solid #333355" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>{sec.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: sec.color }}>{sec.title}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b6785", background: "#2d2d4a", padding: "3px 10px", borderRadius: 20 }}>{sec.time}</span>
          </div>
          {sec.items.map((item, ii) => (
            <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderBottom: ii < sec.items.length - 1 ? "1px solid rgba(51,51,85,0.4)" : "none" }}>
              <button onClick={() => updateWeeklyItem(si, ii, { done: !item.done })} style={{ background: "none", border: "none", cursor: "pointer", color: item.done ? "#69db7c" : "#6b6785", flexShrink: 0, marginTop: 2 }}>
                {item.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <input style={{ ...iS, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#5a5678" : "#e8e6f0", flex: 1 }} value={item.text} onChange={e => updateWeeklyItem(si, ii, { text: e.target.value })} placeholder="Task..." />
              {item.hasInput && <input style={{ ...iS, maxWidth: 220 }} value={item.inputValue || ""} onChange={e => updateWeeklyItem(si, ii, { inputValue: e.target.value })} placeholder="..." />}
              {sec.items.length > 1 && <button onClick={() => removeWeeklyItem(si, ii)} style={{ background: "none", border: "none", color: "#4a4570", cursor: "pointer", flexShrink: 0, marginTop: 4 }}><X size={14} /></button>}
            </div>
          ))}
          <button onClick={() => addWeeklyItem(si)} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, background: "none", border: "none", color: "#6b6785", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>
            <Plus size={13} /> Add line
          </button>
        </div>
      ))}
    </div>
  );
}
