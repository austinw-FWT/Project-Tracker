import { useMemo, useState } from "react";
import { CheckCircle2, Circle, ArrowRight, RotateCcw } from "lucide-react";
import { scheduleEntries } from "./db.js";

/**
 * Briefing.jsx — "The Briefing": a ranked morning plan computed from the
 * tracker itself. No new data model; it reads what already exists:
 *
 *   • project tasks (mine or unassigned, not done)      → check = completes the real task
 *   • materials in "Backordered" / "Pending Quote"      → check = cleared for today only
 *   • invoices marked "overdue"                         → check = cleared for today only
 *   • today's Team Schedule assignments                 → informational field block
 *   • Mon/Wed/Fri weekly ritual from Daily Task Board   → opens the board
 *   • my Daily Task Board #1 Priority / Hot List items  → check = completes the real item
 *   • timesheet nag if nothing logged in 5 days         → opens My Timesheets
 *
 * Scoring is deterministic and explainable — see score() below. "Cleared for
 * today" items live in memberPrivate.briefing = { date, done: {id:true} } so
 * they reset every morning and never touch shared data.
 */

const C = {
  bg: "#0F2444", border: "#1A3050", chipBg: "#132b52", chipTx: "#7da2d6",
  text: "#e2e8f0", dim: "#94a3b8", faint: "#64748b", green: "#69BE28",
  red: "#ef4444", amber: "#f59e0b", blue: "#3b82f6",
};
const WORKDAY_HOURS = 7.5;      // capacity denominator
const FIELD_BLOCK_HOURS = 2.5;  // assumed length of one scheduled site visit

const DAY_RITUALS = {
  1: { secId: "monday",    label: "Monday — week setup",      est: 45 },
  3: { secId: "wednesday", label: "Wednesday — mid-week check", est: 45 },
  5: { secId: "friday",    label: "Friday — close the week",  est: 60 },
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function daysAgoIso(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }

function phaseBoost(p) {
  return { "punch-list": 16, installation: 12, closeout: 14, awarded: 4 }[p.phaseId] || 6;
}
function catBoost(cat) {
  return { priority: 20, hotlist: 14, orders: 8, bids: 6, comms: 4, scheduling: 4 }[cat] || 0;
}

/** Pure scoring pass — exported so it can be unit-tested. */
export function computeBriefing({ projects, phases, schedule, teamRoster, myPrivate, myName }) {
  const today = todayStr();
  const items = [];
  const active = (projects || []).filter(p => !p.movedToWarranty);
  const phaseMap = {}; (phases || []).forEach(ph => { phaseMap[ph.id] = ph; });

  const phaseChip = p => {
    const ph = phaseMap[p.phaseId];
    return ph ? { label: "● " + ph.name.toUpperCase(), color: ph.color, bg: ph.color + "22" } : null;
  };
  const srcChip = label => ({ label, color: C.chipTx, bg: C.chipBg });

  /* ── materials at risk ── */
  active.forEach(p => (p.materials || []).forEach(m => {
    if (m.status === "Backordered") {
      items.push({
        id: `mat-${p.id}-${m.id}`, kind: "clear", projectId: p.id, tab: "materials",
        score: clamp(70 + phaseBoost(p), 25, 97), est: 20,
        title: `Resolve backorder — ${m.item}`,
        why: `${p.name}${m.vendor ? ` · ${m.vendor}` : ""} · find an alt vendor or get a hard ETA`,
        chips: [srcChip(`📦 ${p.jobNumber || "MATERIALS"}`), phaseChip(p), m.poNumber ? srcChip(`PO ${m.poNumber}`) : null].filter(Boolean),
      });
    } else if (m.status === "Pending Quote") {
      items.push({
        id: `mat-${p.id}-${m.id}`, kind: "clear", projectId: p.id, tab: "materials",
        score: clamp(42 + phaseBoost(p), 25, 97), est: 15,
        title: `Chase quote — ${m.item}`,
        why: `${p.name}${m.vendor ? ` · ${m.vendor}` : ""}`,
        chips: [srcChip(`📦 ${p.jobNumber || "MATERIALS"}`), phaseChip(p)].filter(Boolean),
      });
    }
  }));

  /* ── my open project tasks ── */
  active.forEach(p => (p.tasks || []).forEach(t => {
    if (t.done || !(t.text || "").trim()) return;
    if (t.assignee && t.assignee !== myName) return; // mine or unassigned only
    items.push({
      id: `task-${p.id}-${t.id}`, kind: "task", projectId: p.id, taskId: t.id, tab: "tasks",
      score: clamp(41 + phaseBoost(p) + catBoost(t.category) + (t.assignee === myName ? 6 : 0), 25, 97),
      est: t.category === "priority" ? 45 : 30,
      title: t.text,
      why: `${p.name}${t.assignee ? "" : " · unassigned — grab it or hand it off"}`,
      chips: [srcChip(`🏗️ ${p.jobNumber || "PROJECT"}`), phaseChip(p)].filter(Boolean),
    });
  }));

  /* ── overdue invoices ── */
  active.forEach(p => (p.invoices || []).forEach(v => {
    if (v.status !== "overdue") return;
    const amt = parseFloat(v.amount) || 0;
    items.push({
      id: `inv-${p.id}-${v.id}`, kind: "clear", projectId: p.id, tab: "invoices",
      score: clamp(64 + (amt >= 5000 ? 8 : 0), 25, 97), est: 15,
      title: `Chase invoice ${v.invoiceNumber || ""} — ${p.customer || p.name}`,
      why: amt ? `$${amt.toLocaleString()} outstanding` : "marked overdue",
      chips: [srcChip(`🧾 ${p.jobNumber || "INVOICE"}`)],
    });
  }));

  /* ── today's schedule ── */
  const me = (teamRoster || []).find(t => t.name === myName);
  const fieldProjects = [];
  if (me) {
    scheduleEntries((schedule || {})[today]?.[me.id]).forEach(en => {
      if (en.type === "project") {
        const p = active.find(x => x.id === en.id);
        if (p) {
          fieldProjects.push(p);
          items.push({
            id: `sched-${p.id}`, kind: "open", projectId: p.id, tab: "overview",
            score: clamp(58 + phaseBoost(p), 25, 97), est: FIELD_BLOCK_HOURS * 60,
            title: `On site — ${p.name}`,
            why: `${p.siteAddress || "scheduled today"} · from Team Schedule`,
            chips: [srcChip("📅 SCHEDULE"), phaseChip(p)].filter(Boolean),
          });
        }
      } else if (en.type === "note" && (en.text || "").trim()) {
        items.push({
          id: `schednote-${en.text.slice(0, 20)}`, kind: "clear",
          score: 56, est: 30, title: en.text, why: "from Team Schedule",
          chips: [srcChip("📅 SCHEDULE")],
        });
      }
    });
  }

  /* ── weekly ritual (Mon/Wed/Fri) ── */
  const rit = DAY_RITUALS[new Date().getDay()];
  let ritualOpen = 0;
  if (rit) {
    const sec = (myPrivate.dailyTracker?.weeklySections || []).find(s => s.id === rit.secId);
    ritualOpen = sec ? sec.items.filter(i => !i.done).length : -1; // -1 = board never opened
    if (ritualOpen !== 0) {
      items.push({
        id: `ritual-${rit.secId}`, kind: "nav", nav: ["myspace", "daily"],
        score: 62, est: rit.est, title: rit.label,
        why: ritualOpen > 0 ? `${ritualOpen} checklist items open` : `~${rit.est} min · opens your Daily Task Board`,
        chips: [srcChip("📋 WEEKLY RITUAL")],
      });
    }
  }

  /* ── my Daily Task Board: #1 priority + hot list ── */
  (myPrivate.dailyTracker?.dailySections || []).forEach(sec => {
    if (sec.id !== "priority" && sec.id !== "hotlist") return;
    (sec.items || []).forEach(it => {
      if (it.done || !(it.text || "").trim() || it.hasInput) return;
      items.push({
        id: `mine-${sec.id}-${it.id}`, kind: "personal", secId: sec.id, itemId: it.id,
        score: sec.id === "priority" ? 80 : 60, est: sec.id === "priority" ? 45 : 30,
        title: it.text, why: "from your Daily Task Board",
        chips: [srcChip(sec.id === "priority" ? "🎯 #1 PRIORITY" : "🔥 HOT LIST")],
      });
    });
  });

  /* ── timesheet nag ── */
  const cutoff = daysAgoIso(5);
  const recentTs = (myPrivate.timesheets || []).some(e => (e.date || "") >= cutoff);
  if (!recentTs) {
    items.push({
      id: "ts-nag", kind: "nav", nav: ["myspace", "timesheets"],
      score: 55, est: 10, title: "Log your hours",
      why: "nothing logged in the last 5 days",
      chips: [srcChip("⏱️ TIMESHEETS")],
    });
  }

  /* ── clear dismissed-today, rank, group ── */
  const br = myPrivate.briefing || {};
  const dismissed = br.date === today ? (br.done || {}) : {};
  const live = items.filter(i => !dismissed[i.id]).sort((a, b) => b.score - a.score);
  const clearedCount = items.length - live.length;
  const shown = live.slice(0, 12);
  const groups = [
    { id: "first", label: "Do first", color: C.red, items: shown.filter(i => i.score >= 78) },
    { id: "then", label: "Then", color: C.amber, items: shown.filter(i => i.score >= 60 && i.score < 78) },
    { id: "iftime", label: "If time", color: C.faint, items: shown.filter(i => i.score < 60) },
  ].filter(g => g.items.length);

  /* ── capacity (estimated) ── */
  const fieldH = fieldProjects.length * FIELD_BLOCK_HOURS;
  const deskH = shown.filter(i => !i.id.startsWith("sched-")).slice(0, 8).reduce((s, i) => s + i.est, 0) / 60;
  const pct = Math.round(((deskH + fieldH) / WORKDAY_HOURS) * 100);

  /* ── coach line ── */
  const backorders = shown.filter(i => i.title.startsWith("Resolve backorder"));
  const parts = [];
  if (backorders.length) parts.push(`${backorders.length} material${backorders.length > 1 ? "s are" : " is"} backordered — resolve th${backorders.length > 1 ? "ose" : "at"} before installs slip.`);
  else if (shown[0]) parts.push(`Start with “${shown[0].title}.”`);
  if (rit && ritualOpen !== 0) parts.push(`It's ${rit.label.split(" — ")[0]}, so ${rit.label.split(" — ")[1]} is on deck.`);
  if (fieldProjects.length) parts.push(`You're on site: ${fieldProjects.map(p => p.name).join(", ")}.`);
  const top3h = shown.slice(0, 3).reduce((s, i) => s + i.est, 0) / 60;
  if (shown.length) parts.push(`Top three ≈ ${top3h % 1 ? top3h.toFixed(1) : top3h} hr${top3h !== 1 ? "s" : ""}.`);
  const coach = parts.join(" ") || "Runway clear — nothing urgent in the tracker.";

  return { groups, coach, clearedCount, capacity: { deskH, fieldH, pct }, hiddenCount: live.length - shown.length };
}

/* ═══ UI ═══ */

function scoreColor(s) { return s >= 78 ? C.red : s >= 60 ? C.amber : C.faint; }

export default function Briefing({ data, myPrivate, myName, isMobile, onUpdateProject, onSaveMyPrivate, onSelectProject, onNavigate }) {
  const today = todayStr();
  const [, bump] = useState(0); // computeBriefing reads latest props; bump forces re-run after optimistic writes

  const b = useMemo(() => computeBriefing({
    projects: data.projects, phases: data.phases, schedule: data.schedule || {},
    teamRoster: data.teamRoster || [], myPrivate: myPrivate || {}, myName,
  }), [data, myPrivate, myName]);

  function check(item) {
    if (item.kind === "task") {
      const p = data.projects.find(x => x.id === item.projectId);
      if (!p) return;
      onUpdateProject(p.id, { tasks: (p.tasks || []).map(t => t.id === item.taskId ? { ...t, done: true } : t) });
    } else if (item.kind === "personal") {
      const dt = myPrivate.dailyTracker || {};
      const ds = (dt.dailySections || []).map(s => s.id === item.secId
        ? { ...s, items: s.items.map(it => it.id === item.itemId ? { ...it, done: true } : it) } : s);
      onSaveMyPrivate({ dailyTracker: { ...dt, dailySections: ds } });
    } else if (item.kind === "nav") {
      onNavigate(...item.nav); return;
    } else { // "clear" / "open" → cleared for today only (personal, resets tomorrow)
      const br = myPrivate.briefing || {};
      const done = br.date === today ? { ...(br.done || {}) } : {};
      done[item.id] = true;
      onSaveMyPrivate({ briefing: { date: today, done } });
    }
    bump(n => n + 1);
  }

  function open(item) {
    if (item.projectId) {
      const p = data.projects.find(x => x.id === item.projectId);
      if (p) onSelectProject(p, item.tab || "overview");
    } else if (item.nav) onNavigate(...item.nav);
  }

  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const cap = b.capacity;
  const capOver = Math.max(0, cap.pct - 100);
  const deskPctBar = Math.min(100, (cap.deskH / WORKDAY_HOURS) * 100);
  const fieldPctBar = Math.min(100 - Math.min(100, deskPctBar), (cap.fieldH / WORKDAY_HOURS) * 100);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 14px 40px" : "24px 24px 48px", fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: C.text, fontFamily: "'Outfit',sans-serif" }}>The Briefing</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{dateLabel}</div>
      </div>

      {/* coach message */}
      <div style={{ padding: "15px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ranked from your tracker</div>
        </div>
        <div style={{ fontSize: isMobile ? 14 : 15, lineHeight: 1.55, color: C.text }}>{b.coach}</div>
      </div>

      {/* groups */}
      {b.groups.map(g => (
        <div key={g.id} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", color: g.color, textTransform: "uppercase", marginBottom: 9 }}>{g.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map(item => (
              <div key={item.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 11 }}>
                <div style={{ flex: "none", width: 34, textAlign: "center" }}>
                  <div style={{ fontSize: 19, fontWeight: 800, fontFamily: "'Outfit',sans-serif", color: scoreColor(item.score), lineHeight: 1 }}>{item.score}</div>
                  <div style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: "0.1em", color: "#475569", marginTop: 2 }}>SCORE</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div onClick={() => open(item)} style={{ fontSize: isMobile ? 13.5 : 14, fontWeight: 600, color: C.text, cursor: item.projectId || item.nav ? "pointer" : "default" }}>{item.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
                    {item.chips.map((ch, i) => (
                      <span key={i} style={{ fontSize: 9, fontWeight: 600, padding: "3px 7px", background: ch.bg, color: ch.color, borderRadius: 5, whiteSpace: "nowrap" }}>{ch.label}</span>
                    ))}
                    <span style={{ fontSize: 11, color: C.dim }}>{item.why} · ~{item.est >= 60 ? `${(item.est / 60) % 1 ? (item.est / 60).toFixed(1) : item.est / 60} hr` : `${item.est} min`}</span>
                  </div>
                </div>
                {(item.projectId || item.nav) && (
                  <button onClick={() => open(item)} title="Open" style={{ flex: "none", background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 4 }}><ArrowRight size={16} /></button>
                )}
                <button onClick={() => check(item)} title={item.kind === "task" || item.kind === "personal" ? "Mark done" : item.kind === "nav" ? "Open" : "Clear for today"}
                  style={{ flex: "none", background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 4 }}>
                  {item.kind === "nav" ? <ArrowRight size={19} /> : <Circle size={19} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {b.groups.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: C.faint }}>
          <CheckCircle2 size={28} style={{ color: C.green, marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "'Outfit',sans-serif" }}>Runway clear</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>No open tasks, material risks, or rituals for today.</div>
        </div>
      )}

      {/* capacity */}
      {b.groups.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginTop: 4, padding: "12px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 11 }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Outfit',sans-serif", color: cap.pct > 100 ? C.amber : C.green, lineHeight: 1 }}>{cap.pct}%</div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 7, borderRadius: 4, background: C.chipBg, display: "flex", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(deskPctBar, 100)}%`, background: C.green }} />
              <div style={{ width: `${fieldPctBar}%`, background: C.blue }} />
              {capOver > 0 && <div style={{ width: `${Math.min(capOver, 25)}%`, background: C.red }} />}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontWeight: 500, color: C.faint, marginTop: 5 }}>
              <span style={{ color: C.green }}>■ desk ~{cap.deskH.toFixed(1)}h</span>
              <span style={{ color: C.blue }}>■ field ~{cap.fieldH.toFixed(1)}h (schedule)</span>
              <span>{WORKDAY_HOURS}h day · estimated</span>
            </div>
          </div>
        </div>
      )}

      {(b.clearedCount > 0 || b.hiddenCount > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontSize: 12, color: C.faint }}>
          {b.clearedCount > 0 && (
            <button onClick={() => { onSaveMyPrivate({ briefing: { date: today, done: {} } }); bump(n => n + 1); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.faint, fontSize: 12, padding: 0, fontFamily: "inherit" }}>
              <RotateCcw size={12} /> {b.clearedCount} cleared from today's briefing — restore
            </button>
          )}
          {b.hiddenCount > 0 && <span>+{b.hiddenCount} lower-priority items not shown</span>}
        </div>
      )}
    </div>
  );
}
