/**
 * whereWeStand.js — one-glance status for a job, computed from data the app
 * already has. Nothing here is typed in except the optional status note.
 *
 * Each row has a level: "ok" | "watch" | "alert" | "info". The headline is
 * the worst level present, so a job reads "On track" only if nothing is off.
 */
import { laborTotals } from "./laborMath.js";
import { invoiceSnapshot } from "./InvoiceProgress.jsx";
import { projectDays, parseIso, todayIso } from "./projectSchedule.js";

const DAY = 864e5;
const fmt = s => parseIso(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / DAY);
const firstNames = names => names.map(n => n.split(" ")[0]).join(", ");

export function whereWeStand(project, { phaseMap = {}, schedule = {}, canSeeMoney = true, laborPhases, today = todayIso() } = {}) {
  const rows = [];
  const logs = [...(project.dailyLogs || [])].filter(l => l?.date).sort((a, b) => a.date.localeCompare(b.date));
  const phase = phaseMap[project.phaseId];

  // ── Start ──
  if (logs.length) {
    rows.push({ key: "start", label: "Started", level: "info", value: fmt(logs[0].date),
      sub: project.anticipatedStart && project.anticipatedStart !== logs[0].date ? `Anticipated ${fmt(project.anticipatedStart)}` : "" });
  } else if (project.anticipatedStart) {
    const d = daysBetween(today, project.anticipatedStart);
    rows.push({ key: "start", label: "Anticipated start", value: fmt(project.anticipatedStart),
      level: d < 0 ? "watch" : "info",
      sub: d > 1 ? `in ${d} days` : d === 1 ? "tomorrow" : d === 0 ? "today" : `${-d} day${d === -1 ? "" : "s"} ago — no hours logged yet` });
  } else {
    rows.push({ key: "start", label: "Start", level: "info", value: "Not set", sub: "Add an anticipated start date in Edit" });
  }

  // ── Crew: last on site / next scheduled ──
  const last = logs[logs.length - 1];
  const upcoming = projectDays(schedule, project.id, today);
  const next = upcoming[0];
  const lastNames = last ? [...new Set([last.member, ...(last.crewBreakdown || []).map(c => c.name)].filter(Boolean))] : [];
  rows.push({ key: "crew", label: "On site", level: "info",
    value: next ? `${next.date === today ? "Today" : fmt(next.date)} · ${firstNames(next.names)}` : "Nothing scheduled",
    sub: [
      upcoming.length > 1 ? `${upcoming.length} days scheduled ahead` : "",
      last ? `Last logged ${fmt(last.date)}${lastNames.length ? ` (${firstNames(lastNames)})` : ""}` : "",
    ].filter(Boolean).join(" · ") });

  // ── Labor ──
  const t = laborTotals(project, laborPhases);
  if (t.bid > 0) {
    const over = t.remaining < 0;
    rows.push({ key: "labor", label: "Labor", value: `${t.used.toFixed(1)} of ${t.bid.toFixed(1)}h · ${t.pctUsed}%`,
      level: over ? "alert" : t.pctUsed > 90 ? "watch" : "ok", pct: Math.min(t.pctUsed, 100) / 100,
      sub: over ? `Over by ${Math.abs(t.remaining).toFixed(1)}h` : `${t.remaining.toFixed(1)}h remaining` });
  }

  // ── Billing (admins + foremen) ──
  if (canSeeMoney) {
    const s = invoiceSnapshot(project);
    if (s.contract > 0) {
      const gap = s.gapPct !== null && s.gapPct >= 0.15 && s.outstanding > 0;
      rows.push({ key: "billing", label: "Billing", value: `${Math.round(s.pctInvoiced * 100)}% invoiced`,
        level: gap ? "watch" : "ok", pct: Math.min(s.pctInvoiced, 1),
        sub: gap ? `~${Math.round((Math.min(s.pctComplete, 1) - s.pctInvoiced) * 100)} pts of finished work unbilled` : s.unpaid > 0 ? `$${Math.round(s.unpaid).toLocaleString()} awaiting payment` : s.outstanding > 0 ? `$${Math.round(s.outstanding).toLocaleString()} left to invoice` : "Fully invoiced" });
    }
  }

  // ── Open items ──
  const open = [];
  const tasks = (project.tasks || []).filter(x => !x.done).length;
  const punch = (project.punchList || []).filter(x => !x.done).length;
  const rfis = (project.rfis || []).filter(x => x.status === "open" || x.status === "submitted").length;
  const backordered = (project.materials || []).filter(m => m.status === "Backordered").length;
  const waitingMat = (project.materials || []).filter(m => ["Pending Quote", "Quoted", "PO Issued", "Ordered", "Shipped"].includes(m.status)).length;
  const pendingCO = (project.changeOrders || []).filter(c => c.status === "pending").length;
  if (backordered) open.push(`${backordered} backordered`);
  if (tasks) open.push(`${tasks} task${tasks > 1 ? "s" : ""}`);
  if (punch) open.push(`${punch} punch item${punch > 1 ? "s" : ""}`);
  if (rfis) open.push(`${rfis} open RFI/submittal${rfis > 1 ? "s" : ""}`);
  if (waitingMat) open.push(`${waitingMat} material${waitingMat > 1 ? "s" : ""} not delivered`);
  if (pendingCO && canSeeMoney) open.push(`${pendingCO} pending CO${pendingCO > 1 ? "s" : ""}`);
  rows.push({ key: "open", label: "Open items", value: open.length ? open.slice(0, 2).join(" · ") : "Nothing open",
    sub: open.slice(2).join(" · "), level: backordered ? "watch" : "info" });

  const rank = { alert: 3, watch: 2, ok: 1, info: 0 };
  const worst = rows.reduce((w, r) => rank[r.level] > rank[w] ? r.level : w, "info");
  const headline = worst === "alert" ? { text: "Needs attention", level: "alert" }
    : worst === "watch" ? { text: "Keep an eye on it", level: "watch" }
    : { text: "On track", level: "ok" };

  return { phase: phase ? { name: phase.name, color: phase.color } : null, headline, rows, note: project.statusNote || null };
}
