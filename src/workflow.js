/**
 * workflow.js — the repeatable PM workflow every job runs through.
 *
 * STAGES and MILESTONES
 *   Each milestone has a due date worked out from the job's key dates:
 *     award       workflow.awardedAt (falls back to createdAt)
 *     start       anticipatedStart
 *     target      targetCompletion
 *     completion  workflow.completedAt — set when the job enters Punch List
 *   Many milestones complete themselves from the job's data (materials
 *   statuses, documents, checklist items, board phase). The rest a PM marks
 *   done (with the date) or N/A.
 *
 * ENFORCEMENT (gates)
 *   A milestone with `gate` must be done (or N/A) before the job can enter
 *   that board phase ("installation", "punch-list", "closeout") or be moved
 *   to Warranties ("warranty"). Non-admins are blocked; admins can override
 *   with a written reason, which is logged on the job. Checklist hold points
 *   with a gate are enforced the same way.
 *
 * MILESTONE BILLING
 *   Each job carries a billing plan (stored with the job's money, /money):
 *   rows of { label, pct, trigger } where trigger is "award" or a milestone
 *   id. A row is READY TO INVOICE once its trigger is done, LATE 7 days after.
 *
 * SCHEDULE vs HOURS
 *   Risk flags: past target completion, hours burning ahead of the calendar,
 *   hours over budget, active job without dates.
 *
 * Stored on the project:
 *   workflow.milestones[id] = { done, date, by, at, na, note, due }   (due = override)
 *   workflow.awardedAt, workflow.completedAt, workflow.leadDays
 *   workflow.overrides[id]  = { to, reason, by, at, missing[] }
 *   billingPlan (money)     = { items: { id: { label, pct, trigger, order, invoiceNumber, invoicedAt } } }
 */
import { checklistState, holdsBlocking } from "./checklist.js";
import { laborTotals } from "./laborMath.js";

export const STAGES = [
  { id: "setup",    label: "Setup" },
  { id: "design",   label: "Design & submittals" },
  { id: "procure",  label: "Procurement" },
  { id: "install",  label: "Installation" },
  { id: "closeout", label: "Closeout" },
];
export const GATE_LABELS = { installation: "Installation", "punch-list": "Punch List", closeout: "Closeout", warranty: "Warranty" };
export const DEFAULT_LEAD_DAYS = 14;

const ORDERED = new Set(["PO Issued", "Ordered", "Backordered", "Shipped", "Delivered", "Installed"]);
const RECEIVED = new Set(["Delivered", "Installed"]);

/* due: [anchor, days offset]; "lead" means minus the job's parts lead time */
export const MILESTONES = [
  { id: "kickoff",       stage: "setup",    label: "Kickoff & estimator handoff",   due: ["award", 7],     auto: "kickoff",  gate: "installation",
    help: "Checks itself when the checklist's handoff item is done." },
  { id: "dates",         stage: "setup",    label: "Start and target completion set", due: ["award", 7],   auto: "dates",    gate: "installation",
    help: "Every due date in this workflow is worked out from these. Set them on Overview." },
  { id: "design",        stage: "design",   label: "Design / layout drawings complete", due: ["start", -21], gate: "installation",
    help: "Device layout, riser, door/camera schedules. Mark N/A for small service jobs." },
  { id: "subSent",       stage: "design",   label: "Submittals sent",               due: ["start", -14],  auto: "submittalDoc",
    help: "Checks itself when a document with type Submittal is in Docs." },
  { id: "subApproved",   stage: "design",   label: "Submittals approved",           due: ["start", -7],   gate: "installation",
    help: "Approved by the customer / GC / engineer. Note who approved it." },
  { id: "partsOrdered",  stage: "procure",  label: "All parts ordered",             due: ["start", "lead"], auto: "ordered", gate: "installation",
    help: "Checks itself when every material line is PO Issued, Ordered, Shipped or later. Due one lead time before start." },
  { id: "partsReceived", stage: "procure",  label: "All parts received",            due: ["start", -2],   auto: "received",
    help: "Checks itself when every material line is Delivered or Installed." },
  { id: "roughIn",       stage: "install",  label: "Rough-in complete",             due: ["mid", 0],
    help: "Usually triggers the progress invoice." },
  { id: "tested",        stage: "install",  label: "Programming & testing signed off", due: ["target", 0], auto: "tested", gate: "closeout",
    help: "Checks itself when the checklist's device test item is done." },
  { id: "installDone",   stage: "install",  label: "Installation complete",         due: ["target", 0],   auto: "installDone",
    help: "Checks itself when the job moves to Punch List (that sets the completion date)." },
  { id: "closeoutPkg",   stage: "closeout", label: "Closeout package delivered",    due: ["completion", 14], auto: "closeoutPkg", gate: "warranty",
    help: "Checks itself when the checklist's as-builts item is done." },
  { id: "training",      stage: "closeout", label: "Customer training signed off",  due: ["completion", 14], auto: "training", gate: "warranty",
    help: "Checks itself when the checklist's training item is done." },
  { id: "finalInvoice",  stage: "closeout", label: "Final invoice sent",            due: ["completion", 21], auto: "finalInvoice", gate: "warranty",
    help: "Checks itself when the last row of the billing plan is invoiced." },
  { id: "warranty",      stage: "closeout", label: "Moved to Warranties",           due: ["completion", 30], auto: "warranty" },
];

export const DEFAULT_BILLING = [
  { label: "Deposit",             pct: 30, trigger: "award" },
  { label: "Rough-in complete",   pct: 40, trigger: "roughIn" },
  { label: "Final",               pct: 30, trigger: "training" },
];

/* ── dates ─────────────────────────────────────────────────────── */
export const dayOf = d => {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const x = new Date(d);
  if (isNaN(x)) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return dayOf(d); };
export const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

export function keyDates(p) {
  const wf = (p && p.workflow) || {};
  const award = dayOf(wf.awardedAt) || dayOf(p && p.createdAt);
  const start = dayOf(p && p.anticipatedStart);
  const target = dayOf(p && p.targetCompletion);
  const completion = dayOf(wf.completedAt);
  const mid = start && target ? addDays(start, Math.floor(daysBetween(start, target) / 2)) : null;
  const leadDays = Number.isFinite(+wf.leadDays) && wf.leadDays !== "" && wf.leadDays !== null ? +wf.leadDays : DEFAULT_LEAD_DAYS;
  return { award, start, target, completion, mid, leadDays };
}

function dueFor(m, kd) {
  const [anchor, off] = m.due;
  const base = kd[anchor];
  if (!base) return null;
  return addDays(base, off === "lead" ? -kd.leadDays : off);
}

/* ── automatic completion from job data ────────────────────────── */
function autoState(p, ctx) {
  const cl = Object.fromEntries(checklistState(p, ctx).map(s => [s.id, s]));
  const doneCl = id => !!(cl[id] && (cl[id].done || cl[id].na));
  // Lines with a quantity (or no quantity field at all) count; zero-qty lines don't
  const mats = (p.materials || []).filter(m => m && (m.qtyNeeded === undefined || m.qtyNeeded === "" ? !!m.item : (parseFloat(m.qtyNeeded) || 0) > 0));
  const phases = (ctx && ctx.phases) || [];
  const order = phases.map(x => x.id);
  const atOrPast = id => order.indexOf(p.phaseId) >= 0 && order.indexOf(id) >= 0 && order.indexOf(p.phaseId) >= order.indexOf(id);
  const plan = billingRows(p);
  const last = plan[plan.length - 1];
  const clAt = id => dayOf(cl[id] && cl[id].rec && cl[id].rec.at);
  const dates = {
    kickoff: clAt("k-handoff"), tested: clAt("p-test"), closeoutPkg: clAt("c-asbuilts"), training: clAt("c-training"),
    installDone: dayOf(p.workflow && p.workflow.completedAt), warranty: dayOf(p.warrantyStartDate),
  };
  return {
    _dates: dates,
    kickoff: doneCl("k-handoff"),
    dates: !!(p.anticipatedStart && p.targetCompletion),
    submittalDoc: (p.documents || []).some(d => d && String(d.type || "").toLowerCase() === "submittal"),
    ordered: mats.length > 0 && mats.every(m => ORDERED.has(m.status)),
    received: mats.length > 0 && mats.every(m => RECEIVED.has(m.status)),
    tested: doneCl("p-test"),
    installDone: !!(p.workflow && p.workflow.completedAt) || atOrPast("punch-list") || !!p.movedToWarranty,
    closeoutPkg: doneCl("c-asbuilts"),
    training: doneCl("c-training"),
    finalInvoice: !!(last && last.invoiceNumber),
    warranty: !!p.movedToWarranty,
  };
}

/**
 * Every milestone with its status for `today` (YYYY-MM-DD):
 *   done | na | overdue | soon (due within 7 days) | upcoming | nodate
 */
export function milestoneStates(p, ctx = {}) {
  const today = ctx.today || dayOf(new Date());
  const kd = keyDates(p);
  const rec = (p.workflow && p.workflow.milestones) || {};
  const auto = autoState(p, ctx);
  return MILESTONES.map(m => {
    const r = rec[m.id] || {};
    const due = dayOf(r.due) || dueFor(m, kd);
    const autoDone = m.auto ? !!auto[m.auto] : false;
    const done = !r.na && (autoDone || !!r.done);
    let status;
    if (r.na) status = "na";
    else if (done) status = "done";
    else if (!due) status = "nodate";
    else if (due < today) status = "overdue";
    else if (daysBetween(today, due) <= 7) status = "soon";
    else status = "upcoming";
    const doneDate = done ? (dayOf(r.date) || (autoDone ? auto._dates[m.auto] : null) || dayOf(r.at)) : null;
    return { ...m, rec: r, due, autoDone, done, doneDate, na: !!r.na, status, daysLate: due && status === "overdue" ? daysBetween(due, today) : 0 };
  });
}

/* ── gates ─────────────────────────────────────────────────────── */
/**
 * What stops this job entering `target` (a board phase id, or "warranty").
 * Milestone gates and checklist hold points, both counted for every gate at
 * or before the target phase.
 */
export function gateBlockers(p, target, ctx = {}) {
  const phases = ctx.phases || [];
  const order = [...phases.map(x => x.id), "warranty"];
  const to = order.indexOf(target);
  if (to < 0) return [];
  const reached = g => { const i = order.indexOf(g); return i >= 0 && i <= to; };
  const ms = milestoneStates(p, ctx).filter(m => m.gate && reached(m.gate) && !m.done && !m.na)
    .map(m => ({ kind: "milestone", id: m.id, label: m.label, gate: m.gate }));
  const holds = target === "warranty"
    ? checklistState(p, ctx).filter(s => s.hold && !s.done && !s.na && s.gate && reached(s.gate))
    : holdsBlocking(p, target, phases, ctx);
  return [...ms, ...holds.map(h => ({ kind: "hold", id: h.id, label: h.text, gate: h.gate }))];
}

/* ── billing plan ──────────────────────────────────────────────── */
export function billingRows(p) {
  const items = (p && p.billingPlan && p.billingPlan.items) || {};
  return Object.entries(items).filter(([, r]) => r && r.label)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export function defaultBillingPlan(genId) {
  const items = {};
  DEFAULT_BILLING.forEach((r, i) => { items[genId()] = { ...r, order: i }; });
  return { items };
}
/** Each billing row: amount, and waiting | ready | late | invoiced. */
export function billingStatus(p, ctx = {}) {
  const today = ctx.today || dayOf(new Date());
  const ms = Object.fromEntries(milestoneStates(p, ctx).map(m => [m.id, m]));
  const contract = parseFloat(String(p.contractAmount || "").replace(/[^0-9.]/g, "")) || 0;
  const kd = keyDates(p);
  return billingRows(p).map(r => {
    const amount = Math.round(contract * (parseFloat(r.pct) || 0)) / 100;
    if (r.invoiceNumber) return { ...r, amount, status: "invoiced" };
    let readySince = null;
    if (r.trigger === "award") readySince = kd.award;
    else if (ms[r.trigger] && ms[r.trigger].done) readySince = ms[r.trigger].doneDate || today;
    if (!readySince) return { ...r, amount, status: "waiting", triggerLabel: triggerLabel(r.trigger) };
    const late = daysBetween(readySince, today) > 7;
    return { ...r, amount, status: late ? "late" : "ready", readySince, triggerLabel: triggerLabel(r.trigger) };
  });
}
export function triggerLabel(t) { return t === "award" ? "Award" : (MILESTONES.find(m => m.id === t) || {}).label || t; }
export const BILLING_TRIGGERS = [{ id: "award", label: "Award" }, ...MILESTONES.filter(m => m.id !== "warranty" && m.id !== "finalInvoice").map(m => ({ id: m.id, label: m.label }))];

/* ── schedule vs hours ─────────────────────────────────────────── */
export function riskFlags(p, ctx = {}) {
  const today = ctx.today || dayOf(new Date());
  const kd = keyDates(p);
  const flags = [];
  const ms = Object.fromEntries(milestoneStates(p, ctx).map(m => [m.id, m]));
  const installed = ms.installDone && ms.installDone.done;
  if (!kd.start || !kd.target) flags.push({ id: "nodates", level: "warn", label: "No start / target completion dates" });
  if (kd.target && !installed && today > kd.target) flags.push({ id: "late", level: "bad", label: `${daysBetween(kd.target, today)} days past target completion` });
  const lt = laborTotals(p, ctx.laborPhases);
  if (lt.bid > 0) {
    const hrsPct = lt.used / lt.bid;
    if (lt.used > lt.bid) flags.push({ id: "over", level: "bad", label: `Hours over budget (${Math.round(lt.used)} / ${Math.round(lt.bid)}h)` });
    else if (!installed && hrsPct >= 0.9) flags.push({ id: "burn", level: "warn", label: `${Math.round(hrsPct * 100)}% of hours used before install is complete` });
    if (kd.start && kd.target && !installed && today >= kd.start) {
      const span = Math.max(1, daysBetween(kd.start, kd.target));
      const timePct = Math.min(1, daysBetween(kd.start, today) / span);
      if (hrsPct - timePct > 0.25 && lt.used <= lt.bid) flags.push({ id: "pace", level: "warn", label: `Hours ahead of the calendar (${Math.round(hrsPct * 100)}% of hours, ${Math.round(timePct * 100)}% of time)` });
    }
  }
  return flags;
}

/* ── one job's summary for the command center ──────────────────── */
export function jobSummary(p, ctx = {}) {
  const ms = milestoneStates(p, ctx);
  const open = ms.filter(m => !m.done && !m.na);
  const overdue = open.filter(m => m.status === "overdue").sort((a, b) => b.daysLate - a.daysLate);
  const soon = open.filter(m => m.status === "soon").sort((a, b) => a.due.localeCompare(b.due));
  const next = [...open].filter(m => m.due).sort((a, b) => a.due.localeCompare(b.due))[0] || open[0] || null;
  const billing = ctx.money === false ? [] : billingStatus(p, ctx);
  const toInvoice = billing.filter(b => b.status === "ready" || b.status === "late");
  const flags = riskFlags(p, ctx);
  const doneCount = ms.filter(m => m.done || m.na).length;
  const stage = (STAGES.find(s => ms.some(m => m.stage === s.id && !m.done && !m.na)) || STAGES[STAGES.length - 1]).id;
  const score = overdue.length * 100 + overdue.reduce((s, m) => s + Math.min(m.daysLate, 60), 0)
    + toInvoice.filter(b => b.status === "late").length * 80 + toInvoice.length * 20
    + flags.filter(f => f.level === "bad").length * 60 + flags.filter(f => f.level === "warn").length * 15 + soon.length * 5;
  return { milestones: ms, open, overdue, soon, next, billing, toInvoice, flags, pct: Math.round((doneCount / ms.length) * 100), stage, score };
}
