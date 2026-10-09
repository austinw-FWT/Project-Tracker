/**
 * writeIns.js — daily-log hours on work that isn't a project in the app:
 * helping another crew for a couple of hours, an older job that predates the
 * app, a quick service call.
 *
 * Stored in a shared collection (tracker/writeInLogs/{id}) — NOT on any
 * project — so the office can see them and log compliance counts the day,
 * but no project's labor burn, invoice gap, or "where we stand" is touched.
 */
import { crewLabel, guestFields } from "./guestCrew.js";

export const WRITE_IN_ID = "__writein";

export const WRITE_IN_KINDS = [
  { id: "help",   label: "Helped another crew",   placeholder: "Whose job? e.g. Dennis — Costco Kirkland" },
  { id: "legacy", label: "Job not in the app",    placeholder: "Job name, e.g. Bellevue SD — Odle MS" },
  { id: "other",  label: "Service call / other",  placeholder: "What was it? e.g. Service call — Redmond Ridge HOA" },
];
export const kindLabel = id => (WRITE_IN_KINDS.find(k => k.id === id) || WRITE_IN_KINDS[2]).label;

/** One write-in log record. `crewMembers`: [{ name, guest?, guestFrom?, allocations:[{hours, category}] }] */
export function buildWriteInLog({ id, date, member, jobName, jobNumber, kind, crewMembers, activities, photos, phaseName }) {
  const crew = (crewMembers || [])
    .map(c => ({ name: c.name, ...guestFields(c), allocations: (c.allocations || []).filter(a => (parseFloat(a.hours) || 0) > 0).map(a => ({ hours: parseFloat(a.hours), category: a.category || "" })) }))
    .filter(c => c.allocations.length);
  const hours = crew.reduce((s, c) => s + c.allocations.reduce((t, a) => t + a.hours, 0), 0);
  const lines = crew.map(c => `${crewLabel(c)}: ${c.allocations.map(a => `${a.hours}h${phaseName && a.category ? ` [${phaseName(a.category)}]` : ""}`).join(" + ")}`);
  return {
    id, date, member,
    jobName: (jobName || "").trim(), jobNumber: (jobNumber || "").trim(), kind: kind || "other",
    hours, crewBreakdown: crew,
    activities: (activities || "") + (lines.length ? `\nCrew: ${lines.join("; ")}` : ""),
    ...(photos && photos.length ? { photos } : {}),
    createdAt: new Date().toISOString(),
  };
}

/** tracker.writeInLogs (keyed object) → array, newest first. */
export function writeInList(raw) {
  const arr = !raw ? [] : Array.isArray(raw) ? raw.filter(Boolean) : Object.values(raw);
  return arr.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
}
