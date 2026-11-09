/**
 * laborMath.js — labor hours as a LEDGER, not a mutated balance.
 *
 * OLD MODEL (removed): laborHours[cat] = { bid, remaining } where every
 * daily-log submit subtracted from `remaining` in place. Deleting a log
 * never credited hours back, edits were impossible, and a double-submit
 * double-deducted. The number drifted away from the truth with no way
 * to audit it.
 *
 * NEW MODEL:
 *   stored:   laborHours[cat].bid          — the estimate (office-editable)
 *             laborAdjustments[cat]        — manual ± true-up (office-editable;
 *                                            also written once by migrate.js to
 *                                            preserve the pre-migration balance)
 *   computed: used(cat)      = Σ log.crewBreakdown[*].allocations where category === cat
 *                              + adjustment(cat)
 *             remaining(cat) = bid(cat) − used(cat)
 *
 * Deleting or editing a log now self-corrects the balance, and "where did
 * the hours go, by person, by week" falls out for free.
 */

/** Hours actually logged against one category, summed from the project's daily logs. */
export function loggedHours(project, categoryId) {
  let sum = 0;
  for (const log of project.dailyLogs || []) {
    for (const crew of log.crewBreakdown || []) {
      for (const a of crew.allocations || []) {
        if (a.category === categoryId) sum += parseFloat(a.hours) || 0;
      }
    }
  }
  return sum;
}

export function adjustment(project, categoryId) {
  return parseFloat((project.laborAdjustments || {})[categoryId]) || 0;
}

/** The original bid for a phase: the number typed on the Hours tab. */
export function baseBidHours(project, categoryId) {
  return parseFloat((project.laborHours || {})[categoryId]?.bid) || 0;
}

/** Change orders that count toward hours. Only APPROVED ones do: pending and
 *  rejected change orders are not work the crew should be burning hours on. */
export function approvedChangeOrders(project) {
  return (project.changeOrders || []).filter(c => c && c.status === "approved");
}

/** Hours added to a phase by approved change orders. Computed from the change
 *  orders themselves, never written into the bid, so un-approving, editing or
 *  deleting a change order corrects the budget by itself. */
export function changeOrderHours(project, categoryId) {
  let sum = 0;
  for (const co of approvedChangeOrders(project)) sum += parseFloat((co.hours || {})[categoryId]) || 0;
  return sum;
}

/** Hours on one change order, across every phase. */
export function changeOrderTotalHours(co) {
  return Object.values((co && co.hours) || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
}

/** The working budget for a phase: original bid plus approved change orders. */
export function bidHours(project, categoryId) {
  return baseBidHours(project, categoryId) + changeOrderHours(project, categoryId);
}

/** used = logged + manual adjustment */
export function usedHours(project, categoryId) {
  return loggedHours(project, categoryId) + adjustment(project, categoryId);
}

export function remainingHours(project, categoryId) {
  return bidHours(project, categoryId) - usedHours(project, categoryId);
}

/** Totals across all categories present in either bids or logs. */
export function laborTotals(project, laborPhases) {
  const cats = new Set([
    ...Object.keys(project.laborHours || {}),
    ...(laborPhases || []).map(l => l.id),
  ]);
  // a change order can add hours to a phase the original bid never had
  approvedChangeOrders(project).forEach(co => Object.keys(co.hours || {}).forEach(c => cats.add(c)));
  let bid = 0, used = 0, baseBid = 0, coHours = 0;
  cats.forEach(c => {
    bid += bidHours(project, c); used += usedHours(project, c);
    baseBid += baseBidHours(project, c); coHours += changeOrderHours(project, c);
  });
  return { bid, used, baseBid, coHours, remaining: bid - used, pctUsed: bid > 0 ? Math.round((used / bid) * 100) : 0 };
}

/** Per-person hours on a project (for burn reporting / future autopsy report). */
export function hoursByPerson(project) {
  const out = {};
  for (const log of project.dailyLogs || []) {
    for (const crew of log.crewBreakdown || []) {
      let s = 0;
      for (const a of crew.allocations || []) s += parseFloat(a.hours) || 0;
      if (s > 0) out[crew.name] = (out[crew.name] || 0) + s;
    }
  }
  return out;
}
