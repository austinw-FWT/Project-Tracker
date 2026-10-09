/**
 * projectSchedule.js — scheduling crew onto a job from inside the project.
 *
 * There is ONE schedule: tracker/schedule/{YYYY-MM-DD}/{rosterName} = [entries],
 * the same data the Team Schedule grid and Field Mode read. Assigning
 * "Jacob, Mon–Fri" from a project writes project entries into those day
 * slots, so it shows up on Jacob's Field Mode Today screen and on the office
 * grid with no double entry. Removing it here removes it there.
 *
 * All dates are LOCAL calendar days ("2026-10-12"), never toISOString(),
 * which flips to tomorrow after 5pm Pacific.
 */
import { scheduleEntries } from "./db.js";

export function localIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseIso(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}
export const todayIso = () => localIso(new Date());

/** Monday of the week containing `d` (offset in weeks). */
export function mondayOf(d, weekOffset = 0) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const dow = x.getDay();
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  return x;
}

/** Every day from..to inclusive; weekdaysOnly drops Sat/Sun. Capped at 120 days as a typo guard. */
export function datesInRange(fromIso, toIso, weekdaysOnly = true) {
  if (!fromIso || !toIso) return [];
  let a = parseIso(fromIso), b = parseIso(toIso);
  if (a > b) [a, b] = [b, a];
  const out = [];
  for (let d = new Date(a); d <= b && out.length < 120; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (weekdaysOnly && (dow === 0 || dow === 6)) continue;
    out.push(localIso(d));
  }
  return out;
}

const isThisJob = pid => e => e.type === "project" && e.id === pid;

/**
 * Put `names` on project `pid` for each of `dates`. Skips anyone already on
 * this job that day. Returns the new schedule plus exactly which days changed
 * (so only those days are written) and how many slots were added.
 */
export function assignToProject(schedule, pid, names, dates) {
  const next = { ...(schedule || {}) };
  const changed = new Set();
  let added = 0;
  for (const d of dates) {
    for (const n of names) {
      const cur = scheduleEntries(next[d]?.[n]);
      if (cur.some(isThisJob(pid))) continue;
      next[d] = { ...(next[d] || {}), [n]: [...cur, { type: "project", id: pid }] };
      changed.add(d); added++;
    }
  }
  return { schedule: next, changedDates: [...changed], added };
}

/** Take `name` off project `pid` on the given dates (leaves their other jobs alone). */
export function unassignFromProject(schedule, pid, name, dates) {
  const next = { ...(schedule || {}) };
  const changed = new Set();
  for (const d of dates) {
    const cur = scheduleEntries(next[d]?.[name]);
    if (!cur.some(isThisJob(pid))) continue;
    const rest = cur.filter(e => !isThisJob(pid)(e));
    const day = { ...(next[d] || {}) };
    if (rest.length) day[name] = rest; else delete day[name];
    next[d] = day;
    changed.add(d);
  }
  return { schedule: next, changedDates: [...changed] };
}

/** [{ date, names: [...] }] for this job, sorted by date, optionally from a start date. */
export function projectDays(schedule, pid, fromIso = null) {
  const out = [];
  for (const [d, day] of Object.entries(schedule || {})) {
    if (fromIso && d < fromIso) continue;
    const names = Object.entries(day || {}).filter(([, raw]) => scheduleEntries(raw).some(isThisJob(pid))).map(([n]) => n);
    if (names.length) out.push({ date: d, names: names.sort() });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** What else is `name` booked on that day (other jobs + write-ins), for conflict hints. */
export function otherBookings(schedule, name, date, pid, projects) {
  return scheduleEntries(schedule?.[date]?.[name])
    .filter(e => !isThisJob(pid)(e))
    .map(e => {
      if (e.type === "note") return e.text;
      const p = (projects || []).find(x => x.id === e.id);
      return p ? (p.jobNumber ? `#${p.jobNumber}` : p.name) : "another job";
    });
}

/** Collapse sorted ISO dates into readable runs: "Mon Oct 12 – Fri Oct 16, Mon Oct 19". */
export function summarizeDates(dates) {
  if (!dates.length) return "";
  const fmt = s => { const d = parseIso(s); return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.toLocaleDateString("en-US", { month: "short" })} ${d.getDate()}`; };
  const runs = [];
  let start = dates[0], prev = dates[0];
  const nextWorkday = s => { const d = parseIso(s); do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); return localIso(d); };
  for (let i = 1; i <= dates.length; i++) {
    const cur = dates[i];
    if (cur && (cur === nextWorkday(prev) || cur === localIso(new Date(parseIso(prev).getTime() + 864e5)))) { prev = cur; continue; }
    runs.push(start === prev ? fmt(start) : `${fmt(start)} – ${fmt(prev)}`);
    start = prev = cur;
  }
  return runs.join(", ");
}
