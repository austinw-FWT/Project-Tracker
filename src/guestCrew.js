/**
 * guestCrew.js — helpers borrowed from another crew for the day.
 *
 * A foreman can put a borrowed helper on his daily log by name, without that
 * person having an account or a roster row. The helper is just a crew entry
 * flagged `guest: true` (plus `guestFrom`, whose crew they came from). Their
 * hours go into the same crewBreakdown allocations as everyone else, so labor
 * burn, remaining hours, and invoice gap all count them automatically — see
 * laborMath.js, which sums allocations without caring who the person is.
 *
 * Guests never get a roster entry, schedule slot, timesheet, or login.
 */

/** Display label, e.g. "Mike R. (helper · Dennis's crew)". */
export function crewLabel(c) {
  if (!c?.guest) return c?.name || "";
  return `${c.name} (helper${c.guestFrom ? ` · ${c.guestFrom}'s crew` : ""})`;
}

/** Fields to persist on a crewBreakdown / crewMembers row. Empty for roster members. */
export function guestFields(c) {
  return c?.guest ? { guest: true, guestFrom: (c.guestFrom || "").trim() } : {};
}

/**
 * Helpers anyone has logged before, most recent first, so a foreman can
 * one-tap "Mike R." instead of retyping him. Pulled from every project's
 * daily logs — no separate list to maintain.
 */
export function pastHelpers(projects, rosterNames = []) {
  const roster = new Set(rosterNames.map(n => n.toLowerCase()));
  const seen = new Map();
  for (const p of projects || []) {
    for (const log of p.dailyLogs || []) {
      for (const c of log.crewBreakdown || []) {
        if (!c.guest || !c.name) continue;
        const key = c.name.trim().toLowerCase();
        if (roster.has(key)) continue;
        const prev = seen.get(key);
        const date = log.date || "";
        if (!prev || date > prev.date) seen.set(key, { name: c.name.trim(), guestFrom: c.guestFrom || "", date });
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Turn a typed name into a crew entry. If the name matches someone on the
 * roster, they're added as a normal crew member (no guest flag), so a
 * rostered tech typed by hand doesn't end up split across two identities.
 * Returns null if the name is blank or already on this log.
 */
export function resolveTypedMember(name, guestFrom, rosterNames, existingCrew) {
  const clean = (name || "").trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const key = clean.toLowerCase();
  if ((existingCrew || []).some(c => (c.name || "").trim().toLowerCase() === key)) return null;
  const rosterMatch = (rosterNames || []).find(n => n.toLowerCase() === key);
  if (rosterMatch) return { name: rosterMatch };
  return { name: clean, guest: true, guestFrom: (guestFrom || "").trim() };
}
