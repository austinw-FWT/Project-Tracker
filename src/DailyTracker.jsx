import { useState, useEffect, useMemo } from "react";
import { Plus, X, CheckCircle2, Circle, Archive, ChevronDown, ChevronUp } from "lucide-react";

export const TRACKER_SECTIONS = [
  { id: "priority", icon: "🎯", title: "Today's #1 Priority", color: "#ff6b6b", time: "Do this first", type: "tasks" },
  { id: "hotlist", icon: "🔥", title: "Hot List", color: "#ffa94d", time: "Max 3 items", type: "tasks" },
  { id: "bids", icon: "📐", title: "Bids & Estimates", color: "#ffd43b", time: "~30 min block", type: "tasks" },
  { id: "projects", icon: "🏗️", title: "Active Projects", color: "#38d9a9", time: "~30 min block", type: "tasks" },
  { id: "comms", icon: "📞", title: "Calls & Emails to Return", color: "#74c0fc", time: "~20 min block", type: "tasks" },
  { id: "orders", icon: "📦", title: "Orders & Submittals", color: "#b197fc", time: "~15 min block", type: "tasks" },
  { id: "scheduling", icon: "📅", title: "Scheduling & Coordination", color: "#f06595", time: "~15 min block", type: "tasks" },
  { id: "parking", icon: "🅿️", title: "Parking Lot", color: "#9a96b0", time: "Brain dump zone", type: "notes" },
  { id: "eod", icon: "🌙", title: "End of Day Check-In", color: "#69db7c", time: "~5 min", type: "tasks" },
];

const WEEKLY_SECTIONS = [
  { id: "monday", icon: "🟦", title: "Monday — Week Setup", color: "#74c0fc", time: "~45 min", items: [
    { id: "m1", text: "Review all active project statuses & timelines", done: false },
    { id: "m2", text: "Check open bids — follow-ups or deadlines?", done: false },
    { id: "m3", text: "Review crew schedule & assignments", done: false },
    { id: "m4", text: "Check material lead times & outstanding POs", done: false },
    { id: "m5", text: "Review project budgets — flag overages", done: false },
    { id: "m6", text: "Confirm site access / badging", done: false },
  ]},
  { id: "wednesday", icon: "🟧", title: "Wednesday — Mid-Week Check", color: "#ffa94d", time: "~45 min", items: [
    { id: "w1", text: "QuickBooks: review hours vs. budget", done: false },
    { id: "w2", text: "QuickBooks: check overdue invoices", done: false },
    { id: "w3", text: "Review submittals — outstanding approvals?", done: false },
    { id: "w4", text: "Check permit status on active jobs", done: false },
    { id: "w5", text: "Follow up on open RFIs", done: false },
    { id: "w6", text: "Verify materials arriving for installs", done: false },
    { id: "w7", text: "Review tech time logs", done: false },
  ]},
  { id: "friday", icon: "🟩", title: "Friday — Close the Week", color: "#38d9a9", time: "~60 min", items: [
    { id: "f1", text: "Send project update emails to customers", done: false },
    { id: "f2", text: "Send progress updates to GCs", done: false },
    { id: "f3", text: "Invoice completed milestones / T&M hours", done: false },
    { id: "f4", text: "Log change orders", done: false },
    { id: "f5", text: "Update punch list status", done: false },
    { id: "f6", text: "Update FWT Workspaces board", done: false },
    { id: "f7", text: "File warranty registrations", done: false },
    { id: "f8", text: "Review next week's calendar", done: false },
  ]},
  { id: "asneeded", icon: "🔄", title: "As-Needed Weekly", color: "#b197fc", time: "If applicable", items: [
    { id: "a1", text: "Update as-built drawings", done: false },
    { id: "a2", text: "Review closeout package progress", done: false },
    { id: "a3", text: "Check insurance / license renewals", done: false },
    { id: "a4", text: "Review subcontractor performance", done: false },
    { id: "a5", text: "Safety toolbox talk / documentation", done: false },
    { id: "a6", text: "Back up project files / photos", done: false },
  ]},
  { id: "eow", icon: "✅", title: "End of Week Check-In", color: "#69db7c", time: "~5 min", items: [
    { id: "ew1", text: "Every active project has a current status", done: false },
    { id: "ew2", text: "No invoices sitting unsent", done: false },
    { id: "ew3", text: "No customer emails older than 48 hrs unanswered", done: false },
    { id: "ew4", text: "Next Monday's #1 priority:", done: false, hasInput: true, inputValue: "" },
  ]},
];

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayStr() { return new Date().toISOString().split("T")[0]; }

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function makeDefaultDaily() {
  return TRACKER_SECTIONS.map(sec => ({
    ...sec,
    items: sec.id === "eod" ? [
      { id: genId(), text: "Updated project boards / FWT Workspaces", done: false },
      { id: genId(), text: "Sent any promises I made today", done: false },
      { id: genId(), text: "Moved unfinished Hot List items to tomorrow", done: false },
      { id: genId(), text: "Tomorrow's #1 priority:", done: false, hasInput: true, inputValue: "" },
    ] : [{ id: genId(), text: "", done: false }]
  }));
}

function rolloverDay(oldSections) {
  const newSections = makeDefaultDaily();
  const unfinished = [];
  (oldSections || []).forEach(sec => {
    if (sec.type !== "tasks" || sec.id === "eod") return;
    sec.items.forEach(item => {
      if (!item.done && item.text.trim()) {
        unfinished.push({ ...item, id: genId(), done: false, fromSection: sec.id });
      }
    });
  });
  const hotlistUnfinished = unfinished.filter(u => u.fromSection === "hotlist");
  const otherUnfinished = unfinished.filter(u => u.fromSection !== "hotlist");
  return newSections.map(sec => {
    if (sec.id === "priority" && hotlistUnfinished.length > 0) {
      return { ...sec, items: [{ ...hotlistUnfinished[0], fromSection: undefined }] };
    }
    if (sec.id === "hotlist") {
      const remaining = hotlistUnfinished.slice(1);
      if (remaining.length > 0) {
        return { ...sec, items: [...remaining.map(r => ({ ...r, fromSection: undefined })), ...sec.items] };
      }
    }
    const sectionCarryover = otherUnfinished.filter(u => u.fromSection === sec.id);
    if (sectionCarryover.length > 0) {
      return { ...sec, items: [...sectionCarryover.map(c => ({ ...c, fromSection: undefined })), ...sec.items] };
    }
    return sec;
  });
}

export default function DailyTracker({ data, onSave }) {
  const trackerData = data || {};
  const today = todayStr();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (trackerData.currentDate && trackerData.currentDate !== today && trackerData.dailySections) {
      const archives = { ...(trackerData.archives || {}) };
      archives[trackerData.currentDate] = {
        dailySections: trackerData.dailySections,
        weeklySections: trackerData.weeklySections,
      };
      const newDaily = rolloverDay(trackerData.dailySections);
      onSave({
        ...trackerData,
        currentDate: today,
        dailySections: newDaily,
        weeklySections: trackerData.weeklySections || WEEKLY_SECTIONS,
        archives,
      });
    }
  }, []);

  const currentDate = trackerData.currentDate || today;
  const [dailySections, setDailySections] = useState(trackerData.dailySections || makeDefaultDaily());
  const [weeklySections, setWeeklySections] = useState(trackerData.weeklySections || WEEKLY_SECTIONS);
  const [showArchive, setShowArchive] = useState(false);
  const [viewingArchive, setViewingArchive] = useState(null);
  // Track which sections are collapsed (mobile: start collapsed except priority/hotlist)
  const [collapsedSections, setCollapsedSections] = useState(() => {
    if (window.innerWidth < 768) {
      return TRACKER_SECTIONS.reduce((acc, s) => {
        acc[s.id] = !["priority", "hotlist"].includes(s.id);
        return acc;
      }, {});
    }
    return {};
  });
  const [collapsedWeekly, setCollapsedWeekly] = useState(() =>
    window.innerWidth < 768 ? WEEKLY_SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: true }), {}) : {}
  );

  const archives = trackerData.archives || {};
  const archiveDates = Object.keys(archives).sort().reverse();

  function save(daily, weekly) {
    const d = daily || dailySections, w = weekly || weeklySections;
    setDailySections(d); setWeeklySections(w);
    onSave({ ...trackerData, currentDate: today, dailySections: d, weeklySections: w, archives });
  }

  function updateDailyItem(si, ii, updates) {
    const ns = dailySections.map((s, i) => i === si ? { ...s, items: s.items.map((it, j) => j === ii ? { ...it, ...updates } : it) } : s);
    save(ns, null);
  }
  function addDailyItem(si) {
    const ns = dailySections.map((s, i) => i === si ? { ...s, items: [...s.items, { id: genId(), text: "", done: false }] } : s);
    save(ns, null);
  }
  function removeDailyItem(si, ii) {
    const ns = dailySections.map((s, i) => i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s);
    save(ns, null);
  }
  function updateWeeklyItem(si, ii, updates) {
    const ns = weeklySections.map((s, i) => i === si ? { ...s, items: s.items.map((it, j) => j === ii ? { ...it, ...updates } : it) } : s);
    save(null, ns);
  }
  function addWeeklyItem(si) {
    const ns = weeklySections.map((s, i) => i === si ? { ...s, items: [...s.items, { id: genId(), text: "", done: false }] } : s);
    save(null, ns);
  }
  function removeWeeklyItem(si, ii) {
    const ns = weeklySections.map((s, i) => i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s);
    save(null, ns);
  }
  function toggleSection(id) {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  }
  function toggleWeekly(id) {
    setCollapsedWeekly(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const { checked, total } = useMemo(() => {
    let c = 0, t = 0;
    dailySections.forEach(s => { if (s.type === "tasks") s.items.forEach(it => { t++; if (it.done) c++; }); });
    return { checked: c, total: t };
  }, [dailySections]);
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  // Styles
  const iS = {
    flex: 1, padding: isMobile ? "10px 4px" : "6px 0",
    background: "transparent", border: "none",
    borderBottom: "1px dashed #4a4570",
    color: "#e8e6f0", fontSize: isMobile ? 15 : 14,
    fontFamily: "'DM Sans',sans-serif", outline: "none",
    minHeight: isMobile ? 44 : "auto",
  };
  const cues = { priority: "#1 done? Nice. Now pick from the Hot List ↓", hotlist: "Now batch the rest by category ↓", scheduling: "Almost done. Close out the day ↓" };

  // Archive viewer
  if (viewingArchive) {
    const arch = archives[viewingArchive];
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px" }}>
        <button onClick={() => setViewingArchive(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontFamily: "inherit", marginBottom: 16, padding: "8px 0" }}>← Back to Today</button>
        <div style={{ textAlign: "center", padding: "12px 0 20px", borderBottom: "2px solid #333355", marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e8e6f0", fontFamily: "'Outfit',sans-serif" }}>Archived: {viewingArchive}</h1>
          <div style={{ fontSize: 12, color: "#6b6785", marginTop: 4 }}>Read-only view</div>
        </div>
        {(arch?.dailySections || []).map(sec => (
          <div key={sec.id} style={{ background: "#22223a", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid #333355", opacity: 0.8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>{sec.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: sec.color }}>{sec.title}</span>
            </div>
            {sec.items.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 14, color: item.done ? "#5a5678" : "#e8e6f0", textDecoration: item.done ? "line-through" : "none" }}>
                {sec.type === "tasks" && (item.done ? <CheckCircle2 size={18} style={{ color: "#69db7c", flexShrink: 0 }} /> : <Circle size={18} style={{ color: "#6b6785", flexShrink: 0 }} />)}
                {sec.type === "notes" && <span style={{ color: "#6b6785", flexShrink: 0 }}>•</span>}
                <span>{item.text || "(empty)"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: isMobile ? "16px 12px 100px" : "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "2px solid #333355", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: "#e8e6f0", fontFamily: "'Outfit',sans-serif", margin: 0 }}>Daily Task Board</h1>
          <div style={{ fontSize: 13, color: "#6b6785", marginTop: 4 }}>{today}</div>
        </div>
        {archiveDates.length > 0 && (
          <button onClick={() => setShowArchive(!showArchive)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit", minHeight: 44 }}>
            <Archive size={14} />{isMobile ? archiveDates.length : `Archives (${archiveDates.length})`}
          </button>
        )}
      </div>

      {/* Archive list */}
      {showArchive && (
        <div style={{ background: "#22223a", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid #333355" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#9a96b0", marginBottom: 10, textTransform: "uppercase" }}>Past Days</div>
          {archiveDates.map(d => (
            <button key={d} onClick={() => { setViewingArchive(d); setShowArchive(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "12px", borderRadius: 8, border: "none", background: "transparent", color: "#e8e6f0", fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginBottom: 2, minHeight: 44 }}
              onMouseEnter={e => e.currentTarget.style.background = "#2a2a45"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Reminder */}
      <div style={{ background: "rgba(177,151,252,0.1)", borderLeft: "3px solid #b197fc", padding: "10px 14px", borderRadius: "0 8px 8px 0", marginBottom: 18, fontSize: isMobile ? 14 : 13, color: "#b197fc", lineHeight: 1.5 }}>
        You don't have to do everything. You have to do the next thing. Start at the top. Work down.
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b6785", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
          <span>Today's Progress</span><span style={{ fontWeight: 700, color: pct === 100 ? "#69db7c" : "#9a96b0" }}>{checked} / {total}</span>
        </div>
        <div style={{ height: isMobile ? 8 : 6, background: "#2d2d4a", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #38d9a9, #69db7c)", borderRadius: 4, transition: "width 0.5s" }} />
        </div>
      </div>
      {checked === total && total > 0 && (
        <div style={{ textAlign: "center", padding: "14px 12px", fontSize: 15, fontWeight: 600, color: "#69db7c", marginBottom: 14, background: "rgba(105,219,124,0.08)", borderRadius: 10, border: "1px solid rgba(105,219,124,0.2)" }}>
          🎉 Everything checked off. You crushed it today.
        </div>
      )}

      {/* Daily Sections */}
      {dailySections.map((sec, si) => {
        const doneCount = sec.type === "tasks" ? sec.items.filter(i => i.done).length : 0;
        const totalCount = sec.type === "tasks" ? sec.items.length : 0;
        const isCollapsed = isMobile && collapsedSections[sec.id];

        return (
          <div key={sec.id}>
            <div style={{ background: "#22223a", borderRadius: 12, marginBottom: 8, border: "1px solid #333355", overflow: "hidden" }}>
              {/* Section header — always tap-friendly */}
              <div
                onClick={() => isMobile && toggleSection(sec.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "14px 16px" : "16px 18px", cursor: isMobile ? "pointer" : "default", minHeight: isMobile ? 56 : "auto" }}
              >
                <span style={{ fontSize: 20 }}>{sec.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: sec.color, flex: 1 }}>{sec.title}</span>
                {isMobile ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {sec.type === "tasks" && (
                      <span style={{ fontSize: 12, color: doneCount === totalCount && totalCount > 0 ? "#69db7c" : "#6b6785", fontWeight: 600 }}>
                        {doneCount}/{totalCount}
                      </span>
                    )}
                    {isCollapsed ? <ChevronDown size={16} style={{ color: "#6b6785" }} /> : <ChevronUp size={16} style={{ color: "#6b6785" }} />}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "#6b6785", background: "#2d2d4a", padding: "3px 10px", borderRadius: 20 }}>{sec.time}</span>
                )}
              </div>

              {/* Section body */}
              {!isCollapsed && (
                <div style={{ padding: isMobile ? "0 16px 14px" : "0 18px 16px" }}>
                  {!isMobile && (
                    <div style={{ fontSize: 11, color: "#6b6785", marginBottom: 10, paddingTop: 2 }}>{sec.time}</div>
                  )}
                  {sec.items.map((item, ii) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "8px 0" : "6px 0", borderBottom: ii < sec.items.length - 1 ? "1px solid rgba(51,51,85,0.4)" : "none", minHeight: isMobile ? 52 : "auto" }}>
                      {sec.type === "tasks" ? (
                        <button
                          onClick={() => updateDailyItem(si, ii, { done: !item.done })}
                          style={{ background: "none", border: "none", cursor: "pointer", color: item.done ? "#69db7c" : "#6b6785", flexShrink: 0, padding: isMobile ? "4px" : "2px", minWidth: isMobile ? 36 : "auto", minHeight: isMobile ? 36 : "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          {item.done ? <CheckCircle2 size={isMobile ? 22 : 18} /> : <Circle size={isMobile ? 22 : 18} />}
                        </button>
                      ) : (
                        <span style={{ color: "#6b6785", fontSize: 16, flexShrink: 0, paddingTop: 2 }}>•</span>
                      )}
                      <input
                        style={{ ...iS, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#5a5678" : "#e8e6f0" }}
                        value={item.text}
                        onChange={e => updateDailyItem(si, ii, { text: e.target.value })}
                        placeholder={sec.type === "notes" ? "Brain dump..." : "Task..."}
                      />
                      {item.hasInput && (
                        <input
                          style={{ ...iS, maxWidth: isMobile ? 120 : 200 }}
                          value={item.inputValue || ""}
                          onChange={e => updateDailyItem(si, ii, { inputValue: e.target.value })}
                          placeholder="..."
                        />
                      )}
                      {sec.items.length > 1 && (
                        <button
                          onClick={() => removeDailyItem(si, ii)}
                          style={{ background: "none", border: "none", color: "#4a4570", cursor: "pointer", flexShrink: 0, padding: isMobile ? "4px" : "2px", minWidth: isMobile ? 36 : "auto", minHeight: isMobile ? 36 : "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <X size={isMobile ? 16 : 13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addDailyItem(si)}
                    style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, background: "none", border: "none", color: "#6b6785", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: isMobile ? "8px 0" : "4px 0", minHeight: isMobile ? 44 : "auto" }}
                  >
                    <Plus size={14} /> Add line
                  </button>
                </div>
              )}
            </div>
            {!isMobile && cues[sec.id] && (
              <div style={{ textAlign: "center", padding: "6px 0", fontSize: 12, color: "#6b6785", fontStyle: "italic" }}>{cues[sec.id]}</div>
            )}
          </div>
        );
      })}

      {/* Divider */}
      <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #333355, transparent)", margin: "24px 0" }} />

      {/* Weekly Header */}
      <div style={{ textAlign: "center", padding: "8px 0 14px" }}>
        <h2 style={{ fontSize: isMobile ? 17 : 18, fontWeight: 700, color: "#e8e6f0", fontFamily: "'Outfit',sans-serif" }}>Weekly Recurring Tasks</h2>
      </div>

      {/* Weekly Sections */}
      {weeklySections.map((sec, si) => {
        const isCollapsed = isMobile && collapsedWeekly[sec.id];
        const doneCount = sec.items.filter(i => i.done).length;
        return (
          <div key={sec.id} style={{ background: "#22223a", borderRadius: 12, marginBottom: 8, border: "1px solid #333355", overflow: "hidden" }}>
            <div
              onClick={() => isMobile && toggleWeekly(sec.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "14px 16px" : "16px 18px", cursor: isMobile ? "pointer" : "default", minHeight: isMobile ? 56 : "auto" }}
            >
              <span style={{ fontSize: 20 }}>{sec.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: sec.color, flex: 1 }}>{sec.title}</span>
              {isMobile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: doneCount === sec.items.length ? "#69db7c" : "#6b6785", fontWeight: 600 }}>{doneCount}/{sec.items.length}</span>
                  {isCollapsed ? <ChevronDown size={16} style={{ color: "#6b6785" }} /> : <ChevronUp size={16} style={{ color: "#6b6785" }} />}
                </div>
              ) : (
                <span style={{ fontSize: 11, color: "#6b6785", background: "#2d2d4a", padding: "3px 10px", borderRadius: 20 }}>{sec.time}</span>
              )}
            </div>

            {!isCollapsed && (
              <div style={{ padding: isMobile ? "0 16px 14px" : "0 18px 16px" }}>
                {sec.items.map((item, ii) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "8px 0" : "6px 0", borderBottom: ii < sec.items.length - 1 ? "1px solid rgba(51,51,85,0.4)" : "none", minHeight: isMobile ? 52 : "auto" }}>
                    <button
                      onClick={() => updateWeeklyItem(si, ii, { done: !item.done })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: item.done ? "#69db7c" : "#6b6785", flexShrink: 0, padding: isMobile ? "4px" : "2px", minWidth: isMobile ? 36 : "auto", minHeight: isMobile ? 36 : "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {item.done ? <CheckCircle2 size={isMobile ? 22 : 18} /> : <Circle size={isMobile ? 22 : 18} />}
                    </button>
                    <input
                      style={{ ...iS, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#5a5678" : "#e8e6f0" }}
                      value={item.text}
                      onChange={e => updateWeeklyItem(si, ii, { text: e.target.value })}
                      placeholder="Task..."
                    />
                    {item.hasInput && (
                      <input
                        style={{ ...iS, maxWidth: isMobile ? 120 : 200 }}
                        value={item.inputValue || ""}
                        onChange={e => updateWeeklyItem(si, ii, { inputValue: e.target.value })}
                        placeholder="..."
                      />
                    )}
                    {sec.items.length > 1 && (
                      <button
                        onClick={() => removeWeeklyItem(si, ii)}
                        style={{ background: "none", border: "none", color: "#4a4570", cursor: "pointer", flexShrink: 0, padding: isMobile ? "4px" : "2px", minWidth: isMobile ? 36 : "auto", minHeight: isMobile ? 36 : "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <X size={isMobile ? 16 : 13} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addWeeklyItem(si)}
                  style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, background: "none", border: "none", color: "#6b6785", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: isMobile ? "8px 0" : "4px 0", minHeight: isMobile ? 44 : "auto" }}
                >
                  <Plus size={14} /> Add line
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
