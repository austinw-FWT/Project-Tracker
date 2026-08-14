/**
 * permissions.js — who can see and do what.
 *
 * FWT has three functional roles, stored as `jobRole` on the person's Team
 * roster entry (admins set it in Team). Roster entries are bound to real
 * accounts by uid, so the role follows the person, not the device.
 *
 *   admin    — Austin, Tim, Roy, and the PM/Estimator side. Everything.
 *   foreman  — runs a crew. Required to submit daily logs. Sees job money
 *              (bid/contract/invoices) because they run the job.
 *   tech     — technician / apprentice. Field work. No financials, no
 *              estimating. Can submit logs, but isn't required to.
 *
 * IMPORTANT — this is a UI guardrail, not a security boundary. Firebase
 * rules currently grant every approved user the whole tracker, so a
 * determined person could still read financial data through the API.
 * Hiding it properly would mean splitting financials into separate database
 * nodes with their own rules. For a nine-person shop where everyone has
 * legitimate access, this keeps screens clean and prevents accidental
 * exposure — it does not defend against an insider.
 */

export const JOB_ROLES = [
  { id: "admin",   label: "Admin / PM / Estimator", desc: "Full access, including estimating and user administration" },
  { id: "foreman", label: "Foreman",                desc: "Runs a crew · daily log required · sees job financials" },
  { id: "tech",    label: "Technician / Apprentice", desc: "Field work · no financials or estimating" },
];

export const ROLE_LABEL = { admin: "Admin / PM", foreman: "Foreman", tech: "Technician" };
export const ROLE_COLOR = { admin: "#8b5cf6", foreman: "#69BE28", tech: "#3b82f6" };

/**
 * Resolve a person's functional role.
 * @param rosterEntry the person's Team roster record (may be undefined)
 * @param isAccountAdmin true when /users/{uid}.role === "admin"
 *
 * Falls back to the account's admin flag so existing admins never lose
 * access before roles are assigned; everyone else defaults to the least
 * privileged role until an admin sets it in Team.
 */
export function resolveJobRole(rosterEntry, isAccountAdmin) {
  const explicit = rosterEntry?.jobRole;
  if (explicit === "admin" || explicit === "foreman" || explicit === "tech") return explicit;
  return isAccountAdmin ? "admin" : "tech";
}

export function getPermissions(jobRole) {
  const admin = jobRole === "admin";
  const foreman = jobRole === "foreman";
  return {
    jobRole,
    isAdminRole: admin,
    /** bid/contract amounts, invoices, profit, material costs, dealer pricing */
    seeFinancials: admin || foreman,
    /** opportunities, price book, proposals, takeoffs */
    seeEstimating: admin,
    /** shows up in the daily-log compliance view; expected to log every workday */
    logRequired: foreman,
    /** lands in Field Mode on phones (still gets the full app on desktop) */
    fieldFirst: foreman || jobRole === "tech",
    /** can see other people's timesheets */
    seeTeamTimesheets: admin,
  };
}
