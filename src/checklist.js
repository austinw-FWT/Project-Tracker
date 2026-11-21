/**
 * checklist.js — the project completion checklist.
 *
 * Three layers (see the Checklist tab):
 *   1. STANDARD — the same on every job (below).
 *   2. SYSTEM ADD-ONS — added automatically from the job's Systems field.
 *   3. JOB ITEMS — one-offs a PM adds to this job only (e.g. scope
 *      discrepancies found in the estimate review).
 *
 * Every item has an OWNER so each person sees their own list:
 *   pm      — PM / estimator side (admins)
 *   field   — foreman and crew
 *   office  — billing / admin
 *
 * HOLD items are the stop points. Some are tied to a board phase (`gate`):
 * moving the job into that phase with the hold still open asks first.
 * AUTO items are checked by the app itself from the job's data.
 *
 * Item ids are permanent: ticks are stored by id on the project
 * (project.checklist.items[id]), so wording can be improved during the beta
 * without losing anyone's progress. Never reuse an id for a different item.
 *
 * Stored on the project:
 *   checklist.items[id]  = { done, by, at, note }
 *   checklist.na[id]     = { by, at }            not applicable to this job
 *   checklist.custom[id] = { text, detail, phase, owner, hold, by, at }
 */

export const CHECK_PHASES = [
  { id: "kickoff",  label: "Kickoff & pre-con",       short: "Kickoff" },
  { id: "roughin",  label: "Rough-in & infrastructure", short: "Rough-in" },
  { id: "trim",     label: "Trim & head-end",          short: "Trim" },
  { id: "program",  label: "Programming & testing",    short: "Test" },
  { id: "inspect",  label: "Permits & inspection",     short: "Permits" },
  { id: "closeout", label: "Closeout & training",      short: "Closeout" },
];

export const OWNERS = {
  pm:     { label: "PM",     color: "#8b5cf6" },
  field:  { label: "Field",  color: "#69BE28" },
  office: { label: "Office", color: "#3b82f6" },
};

/* ── 1. Standard: every job ───────────────────────────────────── */
export const STANDARD_ITEMS = [
  // Kickoff
  { id: "k-handoff", phase: "kickoff", owner: "pm", hold: true, gate: "installation",
    text: "Estimator → PM → foreman handoff",
    detail: "Walk the scope, takeoff hours, exclusions and anything that doesn't line up between proposal, takeoff and PIF. Log open questions as job items." },
  { id: "k-scope", phase: "kickoff", owner: "pm", auto: "scope",
    text: "Scope of work entered on the job",
    detail: "The full scope from the proposal — the crew reads it in Field Mode." },
  { id: "k-hours", phase: "kickoff", owner: "pm", auto: "hours", text: "Bid hours entered by phase" },
  { id: "k-docs", phase: "kickoff", owner: "pm", auto: "docs",
    text: "Drawings / markups and proposal in Docs", detail: "Anything the crew needs on site, set to Field visibility." },
  { id: "k-po", phase: "kickoff", owner: "office", text: "PO or executed contract number received",
    detail: "Needed before the first progress invoice." },
  { id: "k-contact", phase: "kickoff", owner: "pm", auto: "contact", text: "Customer and on-site contact on the job" },
  { id: "k-access", phase: "kickoff", owner: "pm", auto: "siteinfo",
    text: "Site access info for the crew", detail: "Gate codes, keys/badges, lockbox, parking, after-hours contact — in Site Info." },
  { id: "k-walk", phase: "kickoff", owner: "field",
    text: "Foreman site walk", detail: "Verify every device location against the drawings. Flag anything that doesn't match before material is ordered." },
  { id: "k-network", phase: "kickoff", owner: "pm",
    text: "Customer IT contact, IP scheme and LAN/WAN drops confirmed", detail: "What we need from them per T&C: network drops, IPs/VLANs, host PC specs." },
  { id: "k-material", phase: "kickoff", owner: "pm", hold: true, gate: "installation",
    text: "Material released only after quantities are verified",
    detail: "Device counts and models confirmed against the proposal and site walk." },
  { id: "k-received", phase: "kickoff", owner: "field", text: "Material checked against packing slips",
    detail: "Photograph damage on arrival. Record serial numbers as you unbox." },
  { id: "k-schedule", phase: "kickoff", owner: "pm", auto: "scheduled", text: "Crew scheduled on the job" },
  { id: "k-safety", phase: "kickoff", owner: "field",
    text: "Job safety plan / JHA; lift certs and trainee cards current" },
  { id: "k-prephotos", phase: "kickoff", owner: "field",
    text: "Pre-existing condition photos", detail: "Every device being replaced, the head-end, and every surface we'll penetrate." },
  { id: "k-reuse", phase: "kickoff", owner: "field",
    text: "Test and document existing equipment we're reusing",
    detail: "Reused devices aren't warranted — photograph and note condition before we rely on them." },

  // Rough-in
  { id: "r-label", phase: "roughin", owner: "field", text: "Label both ends of every cable as it's pulled" },
  { id: "r-photos", phase: "roughin", owner: "field", hold: true,
    text: "Photograph every concealed and underground run BEFORE cover",
    detail: "Required for closeout and for any future dispute." },
  { id: "r-support", phase: "roughin", owner: "field", text: "Support, bend radius and separation from power maintained" },
  { id: "r-seal", phase: "roughin", owner: "field", text: "Exterior penetrations sealed; firestopping done" },
  { id: "r-asbuilt", phase: "roughin", owner: "field", text: "As-built markups kept current (daily, not at the end)" },

  // Trim
  { id: "t-devices", phase: "trim", owner: "field", text: "All devices mounted, terminated and weather-sealed" },
  { id: "t-headend", phase: "trim", owner: "field", text: "Head-end dressed and labeled; photo of the finished head-end" },
  { id: "t-power", phase: "trim", owner: "field", text: "Power supplies installed; voltage verified at the device end" },

  // Programming & testing
  { id: "p-schedule", phase: "program", owner: "field",
    text: "Device schedule complete", detail: "Every device: ID, location, model, serial, MAC, IP." },
  { id: "p-test", phase: "program", owner: "field", text: "Every device tested and signed off on the test sheet" },
  { id: "p-powerfail", phase: "program", owner: "field", text: "Power-fail and restore test — system recovers on its own" },
  { id: "p-remote", phase: "program", owner: "field", text: "Remote / mobile access verified from off site" },
  { id: "p-rmr", phase: "program", owner: "pm", hold: true,
    text: "Any RMR / subscription agreement signed before go-live",
    detail: "Cloud licenses, monitoring, hosting. Mark N/A if the job has none." },

  // Permits & inspection
  { id: "i-permit", phase: "inspect", owner: "pm", text: "Permit requirement confirmed (AHJ, L&I) and permit pulled",
    detail: "Record the permit number in the item note. Mark N/A if none is required." },
  { id: "i-rough", phase: "inspect", owner: "field", hold: true,
    text: "Rough-in inspection scheduled before anything is covered",
    detail: "Record inspector, date and result in the note." },
  { id: "i-final", phase: "inspect", owner: "pm", hold: true, gate: "closeout",
    text: "Final inspection passed; signed card in Docs" },

  // Closeout & training
  { id: "c-asbuilts", phase: "closeout", owner: "pm", text: "As-builts, device schedule and network documentation in Docs" },
  { id: "c-photos", phase: "closeout", owner: "field", text: "Closeout photo package (finished installs, head-end front/rear)" },
  { id: "c-return", phase: "closeout", owner: "field",
    text: "Removed equipment returned to the customer — signed receipt",
    detail: "Mark N/A if nothing was removed." },
  { id: "c-cleanup", phase: "closeout", owner: "field", text: "Site cleanup and final walk with site staff" },
  { id: "c-credentials", phase: "closeout", owner: "pm", text: "Admin accounts / credentials handed to the customer; they log in on their own" },
  { id: "c-training", phase: "closeout", owner: "pm", hold: true, gate: "closeout",
    text: "Customer training delivered — signed acknowledgement with attendee names" },
  { id: "c-warranty", phase: "closeout", owner: "office", text: "Warranty letter issued; reused equipment excluded in writing" },
  { id: "c-cos", phase: "closeout", owner: "pm", text: "Every change order written, approved and priced" },
  { id: "c-final-invoice", phase: "closeout", owner: "office", hold: true,
    text: "Final invoice sent only after training and sign-off", detail: "Check sales tax if the job is taxable." },
  { id: "c-debrief", phase: "closeout", owner: "pm",
    text: "Debrief with foreman and estimator", detail: "What went long, what was missing from the takeoff, what we'd bid differently." },
  { id: "c-warranty-move", phase: "closeout", owner: "pm", auto: "warranty", text: "Job moved to Warranties" },
];

/* ── 2. System add-ons: from the job's Systems field ──────────── */
export const SYSTEM_ITEMS = {
  "Access Control": [
    { id: "ac-credentials", phase: "program", owner: "field", text: "Valid and invalid credential test at every reader — events logged" },
    { id: "ac-egress", phase: "program", owner: "field", text: "Door hardware, REX and egress verified at every door", detail: "Free egress always; fire alarm release where required." },
    { id: "ac-schedules", phase: "program", owner: "pm", text: "Users, access levels and schedules set up per the customer" },
    { id: "ac-gate", phase: "program", owner: "field", text: "Gate / door operator interface tested with site staff present", detail: "Note who witnessed it. Mark N/A if no gates." },
    { id: "ac-train", phase: "closeout", owner: "pm", text: "Training: add/remove credentials, schedules, event review" },
  ],
  "Video Surveillance": [
    { id: "vs-fov", phase: "roughin", owner: "field", text: "Camera locations and field of view approved by the customer before mounting" },
    { id: "vs-online", phase: "trim", owner: "field", text: "Each camera online to the recorder before leaving its location" },
    { id: "vs-aim", phase: "program", owner: "field", text: "Aim, focus and lock every camera; names follow a site standard" },
    { id: "vs-night", phase: "program", owner: "field", text: "Night image check on every exterior camera" },
    { id: "vs-retention", phase: "program", owner: "pm", text: "Retention verified at the configured settings — matches what we sold" },
    { id: "vs-soak", phase: "program", owner: "field", text: "24-hour soak: no dropouts; playback and clip export work" },
    { id: "vs-train", phase: "closeout", owner: "pm", text: "Training: live view, search, playback, clip export, mobile app" },
  ],
  "Intrusion Detection": [
    { id: "id-zones", phase: "program", owner: "field", text: "Every zone walk-tested and matches the zone list" },
    { id: "id-central", phase: "program", owner: "field", text: "Signals verified with the central station; account and call list confirmed" },
    { id: "id-codes", phase: "program", owner: "pm", text: "User codes set up; installer code changed from default" },
    { id: "id-train", phase: "closeout", owner: "pm", text: "Training: arm/disarm, bypass, false-alarm and cancel procedure" },
  ],
  "Structured Cabling": [
    { id: "sc-cert", phase: "program", owner: "field", text: "Every new cable run tested and certified; results saved for closeout" },
    { id: "sc-label", phase: "trim", owner: "field", text: "Patch panels, jacks and faceplates labeled to the standard" },
    { id: "sc-rack", phase: "trim", owner: "field", text: "Rack dressed, grounded/bonded; photos front and rear" },
  ],
  "Network Infrastructure": [
    { id: "ni-config", phase: "program", owner: "field", text: "IP addressing, VLANs and port map documented" },
    { id: "ni-wireless", phase: "program", owner: "field", text: "Wireless links / coverage tested under real load", detail: "Mark N/A if no wireless." },
    { id: "ni-ups", phase: "trim", owner: "field", text: "UPS runtime covers the network and head-end gear" },
    { id: "ni-creds", phase: "closeout", owner: "pm", text: "Network credentials documented and handed over securely" },
  ],
};

/* ── what the app can check itself ────────────────────────────── */
export function autoChecks(project, { schedule } = {}) {
  const p = project || {};
  const si = p.siteInfo || {};
  const scheduled = Object.values(schedule || {}).some(day => Object.values(day || {}).some(v =>
    v === p.id || (Array.isArray(v) && v.some(e => e && e.type === "project" && e.id === p.id))));
  return {
    scope: String(p.scopeNotes || "").trim().length >= 40,
    hours: Object.values(p.laborHours || {}).some(v => parseFloat(v && v.bid) > 0),
    docs: (p.documents || []).some(d => d && (d.fileUrl || d.url)),
    contact: !!(String(p.contactName || "").trim() || (p.contacts || []).some(c => c && c.name)),
    siteinfo: !!(si.gateCode || si.lockbox || si.siteContact || si.parking || si.idf || si.notes),
    scheduled,
    warranty: !!p.movedToWarranty,
  };
}

/** The job's full item list (standard + its systems + its own items). */
export function checklistItems(project) {
  const systems = (project && project.projectTypes) || [];
  const sys = systems.flatMap(s => (SYSTEM_ITEMS[s] || []).map(i => ({ ...i, system: s })));
  const custom = Object.entries((project && project.checklist && project.checklist.custom) || {})
    .filter(([, c]) => c && c.text)
    .map(([id, c]) => ({ id, phase: c.phase || "kickoff", owner: c.owner || "pm", text: c.text, detail: c.detail || "", hold: !!c.hold, custom: true, by: c.by, at: c.at }));
  return [...STANDARD_ITEMS, ...sys, ...custom];
}

/** Each item with its state: done (by a person or the app), n/a, open. */
export function checklistState(project, opts = {}) {
  const cl = (project && project.checklist) || {};
  const auto = autoChecks(project, opts);
  return checklistItems(project).map(i => {
    const rec = (cl.items || {})[i.id] || null;
    const na = !!(cl.na || {})[i.id];
    const autoDone = i.auto ? !!auto[i.auto] : false;
    return { ...i, rec, na, autoDone, done: !na && (autoDone || !!(rec && rec.done)) };
  });
}

/** Progress by phase and overall; n/a items don't count. */
export function checklistProgress(states) {
  const by = {};
  CHECK_PHASES.forEach(ph => { by[ph.id] = { total: 0, done: 0, holdsOpen: 0 }; });
  let total = 0, done = 0;
  for (const s of states) {
    if (s.na) continue;
    const b = by[s.phase] || (by[s.phase] = { total: 0, done: 0, holdsOpen: 0 });
    b.total++; total++;
    if (s.done) { b.done++; done++; } else if (s.hold) b.holdsOpen++;
  }
  return { by, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Items each role sees under "Mine". Admins see everything. */
export function isMine(item, jobRole) {
  if (jobRole === "admin") return true;
  return item.owner === "field";
}

/** Open holds that block entering a board phase. `phases` = board phases in order. */
export function holdsBlocking(project, targetPhaseId, phases, opts = {}) {
  const order = (phases || []).map(p => p.id);
  const to = order.indexOf(targetPhaseId);
  if (to < 0) return [];
  return checklistState(project, opts).filter(s => {
    if (!s.hold || s.done || s.na || !s.gate) return false;
    const g = order.indexOf(s.gate);
    return g >= 0 && to >= g;
  });
}
