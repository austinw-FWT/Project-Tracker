/**
 * guestAccess.js — guest access to specific jobs, for people outside the team.
 *
 * A guest is someone borrowed for a job (a foreman from another PM's crew, a
 * sub) who needs to read the job and turn in daily logs, and nothing else.
 *
 * How it is put together:
 *
 *   /guests/{code}         The guest record. The code in the link is its key.
 *                          Holds the name, whose crew they are from, which
 *                          projects they can open, and when access ends. An
 *                          admin can change any of it at any time and it takes
 *                          effect immediately.
 *   /users/{uid}           The guest's account, status "guest". Every existing
 *                          rule asks for status "approved", so a guest account
 *                          is locked out of the tracker by default.
 *   /guestProjects/{pid}   A cut-down copy of each shared job: address, site
 *                          info, scope, approved change order scope, shared
 *                          documents. No dollars, no hours budget, no other
 *                          crews' logs. This is the ONLY project data a guest
 *                          can read. Full users' apps keep it current.
 *   /tracker/projects/{pid}/dailyLogs/{logId}
 *                          Guests may WRITE their own log here (never read the
 *                          job, never touch anyone else's log), so guest hours
 *                          land in the same ledger as everyone's.
 *   /guestPrivate/{uid}    The guest's own copy of what they submitted, and
 *                          the crew names they have typed before.
 *
 * Unlike permissions.js, this IS enforced by the database rules
 * (database.rules.json), not just by what the screen shows.
 */

import { bidHours, usedHours } from "./laborMath.js";

export const GUEST_PARAM = "guest";
const QUICK_PARAM = "nl";                       // "no login"
const GUEST_KEY = "fwt-pending-guest";
const QUICK_KEY = "fwt-pending-guest-quick";
/** No-login links are for short jobs. The database rules refuse anything longer. */
export const NO_LOGIN_MAX_DAYS = 14;

/** Pull ?guest=CODE out of the URL, stash it for after sign-in, and clean the
 *  address bar. Returns the pending code, if any. */
export function captureGuestFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get(GUEST_PARAM);
    if (code) {
      sessionStorage.setItem(GUEST_KEY, code.trim().toUpperCase());
      if (params.get(QUICK_PARAM) === "1") sessionStorage.setItem(QUICK_KEY, "1"); else sessionStorage.removeItem(QUICK_KEY);
      params.delete(GUEST_PARAM); params.delete(QUICK_PARAM);
      const clean = window.location.pathname + (params.toString() ? "?" + params : "");
      window.history.replaceState({}, "", clean);
    }
    return sessionStorage.getItem(GUEST_KEY);
  } catch { return null; }
}
export function clearPendingGuest() { try { sessionStorage.removeItem(GUEST_KEY); sessionStorage.removeItem(QUICK_KEY); } catch { /* private mode */ } }
/** True when the pending link is a no-login link that has not been tried yet. */
export function pendingGuestIsQuick() { try { return !!sessionStorage.getItem(GUEST_KEY) && sessionStorage.getItem(QUICK_KEY) === "1"; } catch { return false; } }
/** The no-login attempt did not work out: fall back to the normal sign-in screen, keeping the code. */
export function clearPendingQuick() { try { sessionStorage.removeItem(QUICK_KEY); } catch { /* private mode */ } }
export function peekPendingGuest() { try { return sessionStorage.getItem(GUEST_KEY); } catch { return null; } }

export function guestLink(g) {
  const code = typeof g === "string" ? g : g.code;
  const quick = typeof g === "object" && g.noLogin ? `&${QUICK_PARAM}=1` : "";
  return `${window.location.origin}${window.location.pathname}?${GUEST_PARAM}=${code}${quick}`;
}

/** How many phones or browsers have opened a no-login link. */
export function guestDeviceCount(g) { return Object.values((g && g.devices) || {}).filter(v => v === true).length; }

/** Is this signed-in account one that holds the guest record?
 *  Sign-in guests: the one account that claimed it. No-login guests: any
 *  device that opened the link. Mirrors the check in database.rules.json. */
export function guestIsMine(g, uid) {
  if (!g || !uid) return false;
  if (g.usedBy === uid) return true;
  return g.noLogin === true && (g.devices || {})[uid] === true;
}

/** "unopened" | "active" | "expired" | "revoked" */
export function guestState(g, now = Date.now()) {
  if (!g) return "revoked";
  if (g.revoked) return "revoked";
  if (!(Number(g.expiresAt) > now)) return "expired";
  return (g.usedBy || guestDeviceCount(g) > 0) ? "active" : "unopened";
}

/**
 * Turn a guest link into a guest account. Returns { record } on success or
 * { problem } with a sentence the person can act on.
 *
 * It never creates a pending account. A pending account is one tap from
 * being approved onto the whole tracker, which is the opposite of what a
 * guest link is for. The database rules are the real gate: the account can
 * only be written as a guest, only against a live code, and only the account
 * that claims the code gets any access.
 *
 * @param u     the signed-in Firebase user
 * @param code  the code from the link
 * @param io    { readGuest, putUser, patchGuest, claimGuestDevice } from db.js
 */
export async function redeemGuestLink(u, code, io, now = Date.now()) {
  let g = null;
  try { g = await io.readGuest(code); }
  catch { return { problem: "Couldn't check this guest link. Check your signal and open the link again." }; }
  if (!g) return { problem: "This guest link is no longer valid. Ask the office to send a new one." };
  const st = guestState(g, now);
  if (st === "revoked") return { problem: "This guest access has been turned off. Ask the office if you still need it." };
  if (st === "expired") return { problem: "This guest link has expired. Ask the office to extend it, then open the same link again." };
  if (u.isAnonymous && !g.noLogin) return { problem: "This guest link needs a sign-in.", needsSignIn: true };
  if (!g.noLogin && g.usedBy && g.usedBy !== u.uid) {
    return { problem: `This link was already opened with a different sign-in${g.usedEmail ? ` (${g.usedEmail})` : ""}. Sign out and use that account, or ask the office to reset the link.` };
  }
  const record = { email: u.email || "", displayName: u.displayName || g.name || u.email || "", status: "guest", role: "guest", guestCode: code, createdAt: new Date(now).toISOString() };
  try { await io.putUser(u.uid, record); }
  catch { return { problem: "Guest access isn't switched on for this app yet. Let the office know: the database rules need to be published." }; }
  if (g.noLogin) {
    if (!(g.devices || {})[u.uid]) {
      try { await io.claimGuestDevice(code, u.uid); }
      catch { return { problem: "Couldn't open this guest link. Ask the office to check that it is still turned on." }; }
    }
  } else if (!g.usedBy) {
    try { await io.patchGuest(code, { usedBy: u.uid, usedAt: now, usedEmail: u.email || "" }); }
    catch { return { problem: "Someone else opened this link a moment ago. Ask the office to reset it." }; }
  }
  return { record };
}

/**
 * What to do with a signed-in session, as far as guest links go. Kept out of
 * the React code so every branch can be tested.
 *
 * Returns { action, record?, clear? }:
 *   "continue"  not a guest matter: carry on with the normal team sign-in path
 *   "record"    use this account record (a guest, or a guest-problem notice)
 *   "signOut"   end this session (an anonymous session with nothing to open,
 *               or a no-login attempt on a link that needs a real sign-in)
 * clear: "all" forgets the pending link, "quick" only stops retrying no-login.
 */
export async function guestAuthStep(u, existing, guestCode, io, now = Date.now()) {
  if (guestCode && existing?.status === "approved") return { action: "continue", clear: "all" };   // already on the team
  if (guestCode) {
    const res = await redeemGuestLink(u, guestCode, io, now);
    if (res.needsSignIn) return { action: "signOut", clear: "quick" };
    if (res.record) return { action: "record", record: res.record, clear: "all" };
    if (existing?.status === "guest") return { action: "record", record: existing, clear: "all" };   // keep the access they had
    return { action: "record", record: { status: "guest-problem", problem: res.problem }, clear: "all" };
  }
  // An anonymous session exists only to open a no-login guest link. It must
  // never fall through into the team sign-up path.
  if (u.isAnonymous && existing?.status !== "guest") return { action: "signOut" };
  return { action: "continue" };
}

export function guestProjectIds(g) {
  return Object.entries((g && g.projects) || {}).filter(([, v]) => v === true).map(([k]) => k);
}

/** Every project some live guest can open (opened or not yet opened). */
export function sharedProjectIds(guests, now = Date.now()) {
  const out = new Set();
  Object.values(guests || {}).forEach(g => {
    const st = guestState(g, now);
    if (st === "active" || st === "unopened") guestProjectIds(g).forEach(pid => out.add(pid));
  });
  return out;
}

/* ── The cut-down project a guest is allowed to read ─────────────── */

/** Drop empty values so the copy we build compares equal to what the database
 *  hands back (it does not store nulls, empty lists or empty objects). */
export function prune(v) {
  if (Array.isArray(v)) {
    const arr = v.map(prune).filter(x => x !== undefined);
    return arr.length ? arr : undefined;
  }
  if (v && typeof v === "object") {
    const out = {};
    Object.keys(v).forEach(k => { const p = prune(v[k]); if (p !== undefined) out[k] = p; });
    return Object.keys(out).length ? out : undefined;
  }
  if (v === null || v === undefined || v === "") return undefined;
  return v;
}

export function stableStringify(v) {
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

/**
 * Build the guest's view of a project. This is an ALLOW list: a field has to
 * be named here to be shared. Anything added to projects later stays private
 * until someone decides otherwise.
 *
 * Deliberately left out: bid and contract amounts, invoices, change order
 * dollars, materials and costs, labor hours budget, tasks, notes, other
 * crews' daily logs, and any document marked office only.
 */
export function guestProjectView(p) {
  if (!p) return undefined;
  const si = p.siteInfo || {};
  const contacts = (p.contacts || []).filter(c => c && (c.name || c.phone || c.email))
    .map(c => ({ name: c.name || "", phone: c.phone || "", email: c.email || "", primary: !!c.primary || undefined }));
  return prune({
    id: p.id,
    name: p.name || "",
    jobNumber: p.jobNumber || "",
    customer: p.customer || "",
    siteAddress: p.siteAddress || "",
    contactName: p.contactName || "",
    contactPhone: p.contactPhone || "",
    contactEmail: p.contactEmail || "",
    contacts,
    siteInfo: { gateCode: si.gateCode, lockbox: si.lockbox, siteContact: si.siteContact, idf: si.idf, parking: si.parking },
    scopeNotes: p.scopeNotes || "",
    changeOrders: (p.changeOrders || [])
      .map((co, i) => ({ co, n: i + 1 }))
      .filter(x => x.co && x.co.status === "approved")
      .map(({ co, n }) => ({ n, description: co.description || "", scope: co.scope || "", date: co.date || "" })),
    documents: (p.documents || [])
      .filter(d => d && !d.restricted && d.fileUrl)
      .map(d => ({ name: d.name || d.fileName || "Document", type: d.type || "", fileUrl: d.fileUrl, fileName: d.fileName || "", fileSize: Number(d.fileSize) || undefined })),
  });
}

/**
 * Work out which cut-down copies need writing or removing.
 * @param projects   full project list (as a full user sees it)
 * @param guests     /guests as loaded
 * @param published  { pid: signature } of what is known to be in the database
 * @returns { puts: [{ pid, view, sig }], deletes: [pid] }
 */
export function planGuestPublish(projects, guests, published, now = Date.now()) {
  const shared = sharedProjectIds(guests, now);
  const byId = new Map((projects || []).map(p => [p.id, p]));
  const puts = [], deletes = [];
  shared.forEach(pid => {
    const p = byId.get(pid);
    if (!p) { if (published[pid] !== undefined) deletes.push(pid); return; }   // job was deleted
    const view = guestProjectView(p);
    const sig = stableStringify(view);
    if (published[pid] !== sig) puts.push({ pid, view, sig });
  });
  Object.keys(published || {}).forEach(pid => { if (!shared.has(pid) && !deletes.includes(pid)) deletes.push(pid); });
  return { puts, deletes };
}

/* ── Hours, for guests switched on to see them ───────────────────── */

/** Jobs where at least one live guest has "show hours" on. */
export function hoursProjectIds(guests, now = Date.now()) {
  const out = new Set();
  Object.values(guests || {}).forEach(g => {
    const st = guestState(g, now);
    if (g.showHours === true && (st === "active" || st === "unopened")) guestProjectIds(g).forEach(pid => out.add(pid));
  });
  return out;
}

/**
 * The hours a guest may see for a job: budget (bid plus approved change
 * orders) and used, per phase. Kept apart from the job copy so it is only
 * readable by guests who have the switch on.
 *
 * `counted` lists the guest-sent logs already inside `used`. A guest's app
 * adds its own logs that are NOT in that list, so hours they sent a minute ago
 * show up straight away without ever being counted twice.
 */
export function guestHoursView(p, phases) {
  if (!p) return undefined;
  const out = {};
  const ids = new Set([...(phases || []).map(l => l.id), ...Object.keys(p.laborHours || {})]);
  (p.changeOrders || []).forEach(co => Object.keys((co && co.hours) || {}).forEach(k => ids.add(k)));
  (p.dailyLogs || []).forEach(l => (l.crewBreakdown || []).forEach(c => (c.allocations || []).forEach(a => a.category && ids.add(a.category))));
  ids.forEach(id => {
    const bid = Math.round(bidHours(p, id) * 100) / 100, used = Math.round(usedHours(p, id) * 100) / 100;
    if (bid || used) out[id] = { bid, used };
  });
  const counted = {};
  (p.dailyLogs || []).forEach(l => { if (l && l.guestLog && l.id) counted[l.id] = true; });
  return prune({ phases: out, counted }) || { none: true };
}

/** Published hours plus this guest's own logs that are not in them yet. */
export function guestHoursWithMine(hoursDoc, myLogs, pid, phases) {
  const base = (hoursDoc && hoursDoc.phases) || {};
  const counted = (hoursDoc && hoursDoc.counted) || {};
  const extra = {};
  (myLogs || []).forEach(l => {
    if (l.pid !== pid || counted[l.id]) return;
    (l.crewBreakdown || []).forEach(c => (c.allocations || []).forEach(a => { extra[a.category] = (extra[a.category] || 0) + (parseFloat(a.hours) || 0); }));
  });
  const order = [...(phases || []).map(l => l.id)];
  [...Object.keys(base), ...Object.keys(extra)].forEach(id => { if (!order.includes(id)) order.push(id); });
  const rows = []; let bid = 0, used = 0;
  order.forEach(id => {
    const b = Number(base[id]?.bid) || 0, u = (Number(base[id]?.used) || 0) + (extra[id] || 0);
    if (!b && !u) return;
    rows.push({ id, bid: b, used: u, remaining: b - u });
    bid += b; used += u;
  });
  return { rows, bid, used, remaining: bid - used, pctUsed: bid > 0 ? Math.round((used / bid) * 100) : 0 };
}

/** Same idea as planGuestPublish, for the hours copies. */
export function planGuestHoursPublish(projects, guests, published, phases, now = Date.now()) {
  const want = hoursProjectIds(guests, now);
  const byId = new Map((projects || []).map(p => [p.id, p]));
  const puts = [], deletes = [];
  want.forEach(pid => {
    const p = byId.get(pid);
    if (!p) { if (published[pid] !== undefined) deletes.push(pid); return; }
    const view = guestHoursView(p, phases);
    const sig = stableStringify(view);
    if (published[pid] !== sig) puts.push({ pid, view, sig });
  });
  Object.keys(published || {}).forEach(pid => { if (!want.has(pid) && !deletes.includes(pid)) deletes.push(pid); });
  return { puts, deletes };
}

/* ── The log a guest turns in ────────────────────────────────────── */

/**
 * Same shape as a Field Mode log, so hours, recaps and photos treat it like
 * any other. `guestCode` is what the database rules check: a guest can only
 * write a log carrying their own code, and can only overwrite their own.
 */
export function buildGuestLog({ id, date, guest, code, crew, activities, photos, phaseName, nowIso }) {
  const from = (guest.team || "").trim();
  const crewBreakdown = (crew || []).map(c => ({
    name: (c.name || "").trim(),
    guest: true,
    guestFrom: from,
    allocations: (c.allocations || [])
      .filter(a => (parseFloat(a.hours) || 0) > 0)
      .map(a => ({ hours: parseFloat(a.hours), category: a.category })),
  })).filter(c => c.name && c.allocations.length > 0);
  const hours = crewBreakdown.reduce((s, c) => s + c.allocations.reduce((t, a) => t + a.hours, 0), 0);
  const crewLines = crewBreakdown.map(c => `${c.name}: ${c.allocations.map(a => `${a.hours}h [${phaseName ? phaseName(a.category) : a.category}]`).join(" + ")}`);
  const text = (activities || "").trim();
  return {
    id, date,
    member: guest.name,
    hours,
    activities: text + (crewLines.length ? `\nCrew: ${crewLines.join("; ")}` : ""),
    crewBreakdown,
    ...(photos && photos.length ? { photos } : {}),
    guestLog: true,
    guestCode: code,
    ...(from ? { guestTeam: from } : {}),
    createdAt: nowIso || new Date().toISOString(),
  };
}

/** "Dave Ruiz (guest · Roy's crew)" */
export function guestLogLabel(log) {
  if (!log || !log.guestLog) return (log && log.member) || "";
  return `${log.member} (guest${log.guestTeam ? ` · ${log.guestTeam}` : ""})`;
}

export function fmtDate(ms) {
  if (!ms) return "";
  return new Date(Number(ms)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
