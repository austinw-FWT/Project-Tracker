/**
 * timesheetFill.js — build a week of timesheet entries from daily logs.
 *
 * Source: every daily log (project logs and write-ins) where this person is
 * on the crew, i.e. the hours their foreman already entered, by job and phase.
 * One entry per day + job + phase.
 *
 * FWT overtime rule: overtime starts after 40 hours WORKED in the week
 * (Monday–Sunday). Holiday, PTO, vacation and sick hours are paid straight
 * time and do NOT count toward the 40 — a week with a holiday and 40 worked
 * hours is 48 hours, all straight pay. No daily overtime.
 * Worked hours are counted in date order: the hours that push the week past
 * 40 become overtime, splitting an entry if it crosses the line.
 *
 * Prevailing wage comes from the project (set from the PIF on import).
 */

export const OT_THRESHOLD = 40;
const TIME_OFF = /\b(PTO|HOLIDAY|VACATION|SICK|BEREAVEMENT|JURY)\b/i;
const r1 = n => Math.round(n * 100) / 100;

/** Holiday / PTO / sick / vacation: paid, but not worked. */
export function isTimeOff(e) {
  return TIME_OFF.test(e.jobName || "") || TIME_OFF.test(e.department || "");
}

/** Monday of the week containing `dateIso` (local), as YYYY-MM-DD. */
export function weekStart(dateIso) {
  const d = new Date(dateIso + "T12:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return iso(d);
}
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function weekDates(monIso) {
  const d = new Date(monIso + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return iso(x); });
}

const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * My hours from the logs for one week → timesheet lines (before overtime).
 * @param name      my roster name (what foremen pick in the crew list)
 * @param projects  app projects (dailyLogs as arrays)
 * @param writeIns  write-in logs (array)
 */
export function logLinesForWeek(name, projects, writeIns, monIso) {
  const days = new Set(weekDates(monIso));
  const acc = new Map();
  const add = (date, key, base, category, hours, logId) => {
    const k = `${date}|${key}|${category || ""}`;
    const cur = acc.get(k) || { ...base, date, category: category || "", hours: 0, logIds: [] };
    cur.hours = r1(cur.hours + hours);
    if (logId && !cur.logIds.includes(logId)) cur.logIds.push(logId);
    acc.set(k, cur);
  };
  for (const p of projects || []) {
    for (const log of p.dailyLogs || []) {
      if (!log || !days.has(log.date)) continue;
      for (const c of log.crewBreakdown || []) {
        if (c.guest || !sameName(c.name, name)) continue;
        for (const a of c.allocations || []) {
          const h = parseFloat(a.hours) || 0;
          if (h > 0) add(log.date, `p:${p.id}`, { projectId: p.id, jobName: p.name || "", jobNumber: p.jobNumber || "", prevailingWage: !!p.prevailingWage }, a.category, h, log.id);
        }
      }
    }
  }
  for (const w of writeIns || []) {
    if (!w || !days.has(w.date)) continue;
    for (const c of w.crewBreakdown || []) {
      if (c.guest || !sameName(c.name, name)) continue;
      for (const a of c.allocations || []) {
        const h = parseFloat(a.hours) || 0;
        if (h > 0) add(w.date, `w:${w.jobName}|${w.jobNumber}`, { projectId: "", jobName: w.jobName || "Write-in", jobNumber: w.jobNumber || "", prevailingWage: false }, a.category, h, w.id);
      }
    }
  }
  return [...acc.values()].sort((a, b) => a.date.localeCompare(b.date) || a.jobName.localeCompare(b.jobName));
}

/**
 * Apply the overtime rule to one week's entries. Returns new entries; an
 * entry that crosses 40 worked hours is split into a regular and an OT part.
 * Time-off entries are left as straight time and don't count.
 */
export function assignOvertime(entries, threshold = OT_THRESHOLD) {
  const order = entries.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date || "").localeCompare(b.e.date || "") || a.i - b.i);
  let worked = 0;
  const out = [];
  for (const { e } of order) {
    const h = parseFloat(e.hours) || 0;
    if (isTimeOff(e)) { out.push({ ...e, hoursType: "regular" }); continue; }
    const regRoom = Math.max(0, threshold - worked);
    worked = r1(worked + h);
    if (h <= regRoom) out.push({ ...e, hoursType: "regular" });
    else if (regRoom <= 0) out.push({ ...e, hoursType: "overtime" });
    else {
      out.push({ ...e, hours: r1(regRoom), hoursType: "regular" });
      out.push({ ...e, id: e.id ? `${e.id}-ot` : undefined, hours: r1(h - regRoom), hoursType: "overtime" });
    }
  }
  return out;
}

const DEFAULT_DEPT = "Low Voltage";

/**
 * Plan filling one week.
 * Keeps every entry typed by hand. Replaces entries this tool made before
 * (source "logs") with fresh ones. Skips a log line when there's already a
 * hand-typed entry for the same day and job (so nothing is counted twice),
 * and reports it. Then applies overtime across the whole week.
 *
 * @returns { week: entries for that week after filling, others: entries
 *   outside the week (untouched), added, skipped, totals }
 */
export function planWeekFill({ timesheets, name, projects, writeIns, monIso, genId, nowIso }) {
  const days = new Set(weekDates(monIso));
  const all = timesheets || [];
  const others = all.filter(e => !days.has(e.date));
  // Hand-typed entries; one that an earlier fill split at the 40-hour line
  // ("x" + "x-ot") is joined back so the rule is applied fresh
  const manual = rejoinSplits(all.filter(e => days.has(e.date) && e.source !== "logs"));
  const lines = logLinesForWeek(name, projects, writeIns, monIso);

  const jobKey = e => (e.projectId ? `p:${e.projectId}` : `n:${String(e.jobNumber || "").trim().toLowerCase() || String(e.jobName || "").trim().toLowerCase()}`);
  const matches = (m, l) => m.date === l.date && (
    (m.projectId && l.projectId && m.projectId === l.projectId) ||
    (String(m.jobNumber || "").trim() && String(m.jobNumber).trim() === String(l.jobNumber || "").trim()) ||
    (!m.projectId && !l.projectId && jobKey(m) === jobKey(l)));
  const skipped = [], added = [];
  for (const l of lines) {
    if (manual.some(m => matches(m, l))) { skipped.push(l); continue; }
    added.push({
      id: genId(), date: l.date, jobName: l.jobName, jobNumber: l.jobNumber, projectId: l.projectId,
      department: DEFAULT_DEPT, hours: l.hours, category: l.category, prevailingWage: l.prevailingWage,
      notes: "From daily log", source: "logs", logIds: l.logIds, member: name, createdAt: nowIso,
    });
  }
  // Overtime across hand-typed + filled entries; manual entries keep their
  // own split rows (a split adds an "-ot" row)
  const merged = assignOvertime([...manual.map(m => ({ ...m, hours: parseFloat(m.hours) || 0 })), ...added]);
  const sum = f => r1(merged.filter(f).reduce((s, e) => s + (parseFloat(e.hours) || 0), 0));
  const totals = {
    worked: sum(e => !isTimeOff(e)),
    regular: sum(e => !isTimeOff(e) && e.hoursType !== "overtime"),
    overtime: sum(e => e.hoursType === "overtime"),
    timeOff: sum(e => isTimeOff(e)),
    fromLogs: r1(added.reduce((s, e) => s + e.hours, 0)),
  };
  const before = all.filter(e => days.has(e.date) && e.source !== "logs");
  const changedManual = manual.filter(m => {
    const was = before.filter(x => x.id === m.id || x.id === `${m.id}-ot`).map(x => `${x.hoursType || "regular"}:${r1(parseFloat(x.hours) || 0)}`).sort().join();
    const now = merged.filter(x => x.id === m.id || x.id === `${m.id}-ot`).map(x => `${x.hoursType}:${r1(parseFloat(x.hours) || 0)}`).sort().join();
    return was !== now;
  }).length;
  return { week: merged, others, added, skipped, totals, changedManual };
}

function rejoinSplits(list) {
  const out = [], byId = new Map();
  const isOt = e => e.id && /-ot$/.test(e.id);
  for (const e of [...list.filter(x => !isOt(x)), ...list.filter(isOt)]) {
    const base = e.id && /-ot$/.test(e.id) ? e.id.replace(/-ot$/, "") : null;
    if (base && byId.has(base)) { const b = byId.get(base); b.hours = r1((parseFloat(b.hours) || 0) + (parseFloat(e.hours) || 0)); continue; }
    const copy = { ...e };
    out.push(copy);
    if (e.id) byId.set(e.id, copy);
  }
  return out;
}

/** Per-day comparison for the week: hours in logs vs on the timesheet. */
export function dayCompare(timesheetWeek, logLines, monIso) {
  return weekDates(monIso).map(date => {
    const logged = r1(logLines.filter(l => l.date === date).reduce((s, l) => s + l.hours, 0));
    const onSheet = r1(timesheetWeek.filter(e => e.date === date && !isTimeOff(e)).reduce((s, e) => s + (parseFloat(e.hours) || 0), 0));
    return { date, logged, onSheet, diff: r1(onSheet - logged) };
  });
}
