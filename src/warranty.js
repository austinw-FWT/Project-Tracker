/**
 * warranty.js — one place that answers "when does this job's warranty end?"
 *
 * FWT's standard term is 1 year from completion (see the proposal T&Cs), so
 * a project moved to warranty defaults to 12 months from warrantyStartDate.
 * Office can override per job:
 *   warrantyMonths   — a different term (24, 36, 60 for extended warranties)
 *   warrantyEndDate  — an exact end date, wins over the term when set
 *
 * Nothing here writes data; every screen (Warranties log, project banner,
 * Field Mode) reads through these helpers so they always agree.
 */

export const DEFAULT_WARRANTY_MONTHS = 12;
export const WARRANTY_TERMS = [12, 24, 36, 60];

const DAY = 24 * 60 * 60 * 1000;

/** Parse "2026-10-01" as a local date (not UTC midnight, which shows a day early in PT). */
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : new Date(s);
  return isNaN(d) ? null : d;
}

export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/** "YYYY-MM-DD" in local time, for <input type="date"> values. */
export function isoDay(d) {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtDay(d) {
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}

/**
 * Full warranty picture for one project.
 * status: "active" | "expiring-90" | "expiring-30" | "expired" | "unknown" (no start date)
 */
export function projectWarranty(project, now = new Date()) {
  const start = toDate(project?.warrantyStartDate);
  const months = parseInt(project?.warrantyMonths) || DEFAULT_WARRANTY_MONTHS;
  const override = toDate(project?.warrantyEndDate);
  const end = override || (start ? addMonths(start, months) : null);

  if (!end) return { start, end: null, months, custom: false, daysLeft: null, pctElapsed: null, status: "unknown" };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const daysLeft = Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12) - today) / DAY);
  const total = start ? Math.max((end - start) / DAY, 1) : null;
  const pctElapsed = start ? Math.min(Math.max((today - start) / DAY / total, 0), 1) : null;
  const status = daysLeft < 0 ? "expired" : daysLeft <= 30 ? "expiring-30" : daysLeft <= 90 ? "expiring-90" : "active";

  return { start, end, months, custom: !!override, daysLeft, pctElapsed, status };
}

export const WARRANTY_STATUS = {
  "active":      { label: "In warranty",       color: "#10b981" },
  "expiring-90": { label: "Ends within 90 days", color: "#f59e0b" },
  "expiring-30": { label: "Ends within 30 days", color: "#ef4444" },
  "expired":     { label: "Warranty ended",     color: "#6b7280" },
  "unknown":     { label: "No start date",      color: "#64748b" },
};

/** "214 days left" / "Ends today" / "Ended 12 days ago" */
export function daysLeftLabel(w) {
  if (w.daysLeft === null) return "Set a start date";
  if (w.daysLeft > 1) return `${w.daysLeft} days left`;
  if (w.daysLeft === 1) return "Ends tomorrow";
  if (w.daysLeft === 0) return "Ends today";
  return `Ended ${Math.abs(w.daysLeft)} day${w.daysLeft === -1 ? "" : "s"} ago`;
}
