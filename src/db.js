/**
 * db.js — path-level Firebase RTDB data layer.
 *
 * WHY THIS EXISTS
 * The previous data layer PUT the entire /tracker node on every save.
 * With multiple users, that is last-write-wins across the whole database:
 * a tech submitting a daily log and a PM editing a material at the same
 * moment would silently erase each other's changes.
 *
 * This module writes only the path that changed:
 *   - adding a daily log writes /tracker/projects/{pid}/dailyLogs/{logId}
 *   - editing a project field PATCHes /tracker/projects/{pid}
 *   - personal data writes /private/{uid}; job money writes /money/{pid}
 *
 * Projects and their dailyLogs are stored as KEYED OBJECTS in the database
 * (not arrays). Arrays in RTDB get rewritten wholesale and re-index on
 * delete; keyed objects support surgical writes. The app converts them to
 * sorted arrays for the UI via normalize() below.
 *
 * Small, rarely-edited lists (phases, teamRoster, contacts, schedule days)
 * are still written as whole sections — the conflict window on those is
 * negligible and it keeps the code simple. The dangerous blob was the root.
 */

import { auth } from "./firebase.js";

export const FB_URL = "https://fwt-lv-tracker-default-rtdb.firebaseio.com";
const ROOT = "/tracker";

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function token() {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken();
}

/* ── write tracking ────────────────────────────────────────────────
   The live mirror (liveSync.js) needs two things from every write:
   - when it's CONFIRMED, apply it to the mirror (no flicker back to old data)
   - while ANY write is in flight, hold off redrawing from the mirror, so a
     half-saved state never replaces what the user is looking at. */
let pendingWrites = 0;
const ackListeners = new Set();
const idleListeners = new Set();
export const onWriteAck = fn => { ackListeners.add(fn); return () => ackListeners.delete(fn); };
export const onWritesIdle = fn => { idleListeners.add(fn); return () => idleListeners.delete(fn); };
export const writesPending = () => pendingWrites;

async function req(path, method, body) {
  const write = method !== "GET";
  if (write) pendingWrites++;
  let ok = false;
  try {
    const t = await token();
    const url = `${FB_URL}${path}.json${t ? `?auth=${t}` : ""}`;
    const r = await fetch(url, {
      method,
      headers: write && method !== "DELETE" ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw Object.assign(new Error(`${method} ${path} failed (${r.status})`), { status: r.status });
    if (!write) return await r.json();
    ok = true;
    return true;
  } finally {
    if (write) {
      if (ok) ackListeners.forEach(fn => { try { fn({ path, method, value: body === undefined ? null : body }); } catch { /* listener bug must not fail the write */ } });
      pendingWrites--;
      if (pendingWrites === 0) idleListeners.forEach(fn => { try { fn({ failed: !ok }); } catch { /* ignore */ } });
      else if (!ok) idleListeners.forEach(fn => { try { fn({ failed: true, partial: true }); } catch { /* ignore */ } });
    }
  }
}

/* ── generic path ops ───────────────────────────────────────────── */
export const dbGet    = (path)        => req(path, "GET");
export const dbPut    = (path, value) => req(path, "PUT", value);
export const dbPatch  = (path, value) => req(path, "PATCH", value);
export const dbDelete = (path)        => req(path, "DELETE");

/* ── tracker tree ───────────────────────────────────────────────── */
export const readTracker = () => dbGet(ROOT);

/** Whole-section write for small low-contention lists (phases, roster, contacts, adminSettings). */
export const putSection = (section, value) => dbPut(`${ROOT}/${section}`, value);

/** Schedule entries: a member's day is either a legacy string (one project
    id) or an array of { type: "project", id } / { type: "note", text }.
    Always read through this so old data keeps working. */
export function scheduleEntries(raw) {
  if (!raw) return [];
  if (typeof raw === "string") return [{ type: "project", id: raw }];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return [];
}

/** One day of the schedule grid. */
export const putScheduleDay = (dateIso, value) => dbPut(`${ROOT}/schedule/${dateIso}`, value);

/* ── projects (keyed object in DB) ──────────────────────────────── */
export const putProject    = (pid, project) => routeProject(pid, project, true);
export const patchProject  = (pid, updates) => routeProject(pid, updates, false);
export const deleteProject = (pid)          => Promise.all([
  dbDelete(`${ROOT}/projects/${pid}`),
  moneyAccess ? dbDelete(`${MONEY_ROOT}/${pid}`).catch(() => true) : true,
]).then(() => true);

/** Surgical add — two foremen can submit logs to the same job at the same second safely. */
export const putProjectDailyLog    = (pid, log)   => dbPut(`${ROOT}/projects/${pid}/dailyLogs/${log.id}`, log);
export const deleteProjectDailyLog = (pid, logId) => dbDelete(`${ROOT}/projects/${pid}/dailyLogs/${logId}`);

/* ── write-in logs: hours on work that isn't an app project (see writeIns.js) ── */
export const putWriteInLog    = (id, log) => dbPut(`${ROOT}/writeInLogs/${id}`, log);
export const deleteWriteInLog = (id)      => dbDelete(`${ROOT}/writeInLogs/${id}`);

/* ── personal space: /private/{uid} ──────────────────────────────
   Each person's own board, logs, timesheets and opportunities. Only that
   person (and admins, for support) can read it — it is no longer part of
   the tracker every phone downloads. */
export const PRIVATE_ROOT = "/private";
export const putMemberPrivate   = (uid, value)   => dbPut(`${PRIVATE_ROOT}/${uid}`, value);
export const patchMemberPrivate = (uid, updates) => dbPatch(`${PRIVATE_ROOT}/${uid}`, updates);
/** Hand someone a task without being able to read their board: it lands in
    their inbox and their own app moves it onto the board. */
export const putInboxTask    = (uid, id, task) => dbPut(`${PRIVATE_ROOT}/${uid}/inbox/${id}`, task);
export const deleteInboxTask = (uid, id)       => dbDelete(`${PRIVATE_ROOT}/${uid}/inbox/${id}`);

/* ── estimating: price book, assemblies, defaults (admins only) ─── */
export const EST_ROOT = "/estimating";
export const putCatalogItem    = (id, item) => dbPut(`${EST_ROOT}/catalog/${id}`, item);
export const deleteCatalogItem = (id)       => dbDelete(`${EST_ROOT}/catalog/${id}`);
export const putAssembly       = (id, asm)  => dbPut(`${EST_ROOT}/assemblies/${id}`, asm);
export const deleteAssembly    = (id)       => dbDelete(`${EST_ROOT}/assemblies/${id}`);
export const putEstimatingDefaults = (d)    => dbPut(`${EST_ROOT}/estimatingDefaults`, d);

/* ── job money: /money/{pid} (admins and foremen only) ────────────
   Bid and contract amounts, invoices, the PIF billing schedule, material
   unit costs and change order amounts. Everything else about a job stays in
   /tracker where the whole crew can read it. The split happens here, on the
   way out, so screens keep working with one project object. */
export const MONEY_ROOT = "/money";
export const MONEY_KEYS = ["bidAmount", "contractAmount", "invoices", "invoicing", "billingPlan"];
let moneyAccess = false;
/** Set once this device has loaded /money. Until then (and always for
    technicians) money is never written — a device that can't see the costs
    must not overwrite them with blanks. */
export const setMoneyAccess = v => { moneyAccess = !!v; };
export const hasMoneyAccess = () => moneyAccess;

const blank = v => v === undefined || v === null || v === "";
/** Project fields → { pub: crew-visible part, money: money part }. Lines in
    materials / changeOrders get ids so their costs can be matched back. */
export function splitProjectMoney(updates) {
  const pub = { ...updates };
  const money = {};
  MONEY_KEYS.forEach(k => { if (k in pub) { money[k] = pub[k] === "" ? null : pub[k]; delete pub[k]; } });
  // Deep paths ("billingPlan/items/x") go with their top-level key
  Object.keys(pub).forEach(k => { if (k.includes("/") && MONEY_KEYS.includes(k.split("/")[0])) { money[k] = pub[k]; delete pub[k]; } });
  if (Array.isArray(pub.materials)) {
    const costs = {};
    pub.materials = pub.materials.map(m => {
      if (!m || typeof m !== "object") return m;
      const { cost, ...rest } = m;
      const id = m.id || genId();
      if (!blank(cost)) costs[id] = cost;
      return { ...rest, id };
    });
    money.materialCost = Object.keys(costs).length ? costs : null;
  }
  if (Array.isArray(pub.changeOrders)) {
    const amts = {};
    pub.changeOrders = pub.changeOrders.map(c => {
      if (!c || typeof c !== "object") return c;
      const { amount, ...rest } = c;
      const id = c.id || genId();
      if (!blank(amount)) amts[id] = amount;
      return { ...rest, id };
    });
    money.coAmount = Object.keys(amts).length ? amts : null;
  }
  return { pub, money };
}

/** Put a job's money back onto the project object the screens use. */
export function mergeProjectMoney(p, m) {
  if (!p || !m) return p;
  const out = { ...p };
  MONEY_KEYS.forEach(k => { if (m[k] !== undefined && m[k] !== null) out[k] = m[k]; });
  if (Array.isArray(out.materials) && m.materialCost) {
    out.materials = out.materials.map(x => (x && x.id && m.materialCost[x.id] !== undefined ? { ...x, cost: m.materialCost[x.id] } : x));
  }
  if (Array.isArray(out.changeOrders) && m.coAmount) {
    out.changeOrders = out.changeOrders.map(x => (x && x.id && m.coAmount[x.id] !== undefined ? { ...x, amount: m.coAmount[x.id] } : x));
  }
  return out;
}

/** A device without money access writes the project as it has it (before the
    data move a technician's copy still carries costs; after it, it has none).
    A device with access sends money to /money and the rest to /tracker. */
function routeProject(pid, updates, whole) {
  if (!moneyAccess) return whole ? dbPut(`${ROOT}/projects/${pid}`, updates) : dbPatch(`${ROOT}/projects/${pid}`, updates);
  const { pub, money } = splitProjectMoney(updates);
  const writes = [];
  if (whole) writes.push(dbPut(`${ROOT}/projects/${pid}`, pub));
  else if (Object.keys(pub).length) writes.push(dbPatch(`${ROOT}/projects/${pid}`, pub));
  const mKeys = Object.keys(money);
  if (whole) { if (mKeys.some(k => money[k] !== null)) writes.push(dbPut(`${MONEY_ROOT}/${pid}`, money)); }
  else if (mKeys.length) writes.push(dbPatch(`${MONEY_ROOT}/${pid}`, money));
  return Promise.all(writes).then(() => true);
}

/* ── invites ────────────────────────────────────────────────────
   Invites live OUTSIDE /tracker because an invitee must read theirs
   before they're an approved user. The code is the secret: /invites is
   not listable, but a specific /invites/{code} is readable by any signed-in
   user. See database.rules.json. */
export const readInvite   = (code)        => dbGet(`/invites/${code}`);
export const putInvite    = (code, inv)   => dbPut(`/invites/${code}`, inv);
export const patchInvite  = (code, upd)   => dbPatch(`/invites/${code}`, upd);
export const deleteInvite = (code)        => dbDelete(`/invites/${code}`);
export const listInvites  = ()            => dbGet("/invites");

/* ── guests ─────────────────────────────────────────────────────
   Guest access to specific jobs. See guestAccess.js for the model and
   database.rules.json for what each path allows. The record is keyed by the
   code in the guest's link. */
export const readGuest    = (code)      => dbGet(`/guests/${code}`);
export const listGuests   = ()          => dbGet("/guests");
export const putGuest     = (code, g)   => dbPut(`/guests/${code}`, g);
export const patchGuest   = (code, upd) => dbPatch(`/guests/${code}`, upd);
export const deleteGuest  = (code)      => dbDelete(`/guests/${code}`);

/** A no-login link is claimed per device: each phone that opens it adds itself. */
export const claimGuestDevice = (code, uid) => dbPut(`/guests/${code}/devices/${uid}`, true);

/** Hours budget and burn for a shared job, readable only by guests with "show hours" on. */
export const readGuestHours   = (pid)       => dbGet(`/guestHours/${pid}`);
export const listGuestHours   = ()          => dbGet("/guestHours");
export const putGuestHours    = (pid, view) => dbPut(`/guestHours/${pid}`, view);
export const deleteGuestHours = (pid)       => dbDelete(`/guestHours/${pid}`);

/** The cut-down copy of a job that guests read instead of the real project. */
export const readGuestProject   = (pid)       => dbGet(`/guestProjects/${pid}`);
export const listGuestProjects  = ()          => dbGet("/guestProjects");
export const putGuestProject    = (pid, view) => dbPut(`/guestProjects/${pid}`, view);
export const deleteGuestProject = (pid)       => dbDelete(`/guestProjects/${pid}`);

/** A guest's own copy of their submitted logs, and their saved crew names. */
export const readGuestPrivate   = (uid)          => dbGet(`/guestPrivate/${uid}`);
export const putGuestPrivateLog = (uid, id, rec) => dbPut(`/guestPrivate/${uid}/logs/${id}`, rec);
export const putGuestCrewNames  = (uid, names)   => dbPut(`/guestPrivate/${uid}/crew`, names);

/** Short, unambiguous, hard to guess. No 0/O/1/I so it can be read aloud. */
export function genInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const rnd = (typeof crypto !== "undefined" && crypto.getRandomValues)
    ? Array.from(crypto.getRandomValues(new Uint32Array(12)))
    : Array.from({ length: 12 }, () => Math.floor(Math.random() * 4294967296));
  rnd.forEach(n => { out += alphabet[n % alphabet.length]; });
  return out;
}

/* ── users node ─────────────────────────────────────────────────── */
export const readUsers  = ()         => dbGet("/users");
export const putUser    = (uid, rec) => dbPut(`/users/${uid}`, rec);
export const deleteUser = (uid)      => dbDelete(`/users/${uid}`);

/* ── normalization: DB shape → UI shape ─────────────────────────── */

/** dailyLogs object → array, newest first. Tolerates legacy array form. */
export function normalizeLogs(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw.filter(Boolean) : Object.values(raw);
  return arr.sort((a, b) => (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || ""));
}

/** project record → UI project (logs as array). */
export function normalizeProject(p) {
  if (!p) return p;
  return { ...p, dailyLogs: normalizeLogs(p.dailyLogs) };
}

/**
 * Full tracker tree → UI data object.
 * - projects: keyed object (or legacy array) → array sorted by createdAt
 * - guarantees every project has an id matching its key
 */
export function normalizeTracker(remote, defaults) {
  const d = { ...defaults, ...(remote || {}) };
  let projects = d.projects || {};
  if (Array.isArray(projects)) {
    // Legacy array form — readable, but path-level writes would corrupt it,
    // so the app shows the migration gate until this is converted.
    d.legacyFormat = true;
    projects = projects.filter(Boolean);
  } else {
    projects = Object.entries(projects).map(([key, p]) => ({ ...p, id: p.id || key }));
  }
  d.projects = projects
    .map(normalizeProject)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return d;
}

/**
 * All the mirrored branches → the one data object the screens use.
 * The new locations win; the old ones are read only until the admin runs
 * the data move (so nothing disappears in between).
 *   tracker     /tracker (everyone)
 *   money       /money (admins + foremen), merged into each project
 *   estimating  /estimating (admins) → catalog, assemblies, estimatingDefaults
 *   privateMine /private/{uid} → memberPrivate[uid]
 *   privateAll  /private (admins only, for the team timesheet view)
 */
export function normalizeAll({ tracker, money, estimating, privateMine, privateAll, uid }, defaults) {
  const d = normalizeTracker(tracker, defaults);
  if (estimating) ["catalog", "assemblies", "estimatingDefaults"].forEach(k => { if (estimating[k] !== undefined) d[k] = estimating[k]; });
  // Layered over the old record (per top-level key) until the move removes
  // it — a task handed to me early must not hide the rest of my board.
  // Admins mirror everyone's (team timesheet view); same layering per person
  if (privateAll) {
    const mp = { ...(d.memberPrivate || {}) };
    Object.entries(privateAll).forEach(([k, v]) => { if (v && typeof v === "object") mp[k] = { ...(mp[k] || {}), ...v }; });
    d.memberPrivate = mp;
  }
  if (uid && privateMine && !privateAll) d.memberPrivate = { ...(d.memberPrivate || {}), [uid]: { ...((d.memberPrivate || {})[uid] || {}), ...privateMine } };
  if (money) d.projects = d.projects.map(p => mergeProjectMoney(p, money[p.id]));
  return d;
}

/**
 * UI updates → DB-safe updates for patchProject.
 * If a component hands back a full dailyLogs ARRAY (e.g. delete from the
 * project Daily Log tab), convert it to the keyed-object form before writing.
 */
export function denormalizeProjectUpdates(updates) {
  const out = { ...updates };
  if (Array.isArray(out.dailyLogs)) {
    const obj = {};
    out.dailyLogs.forEach(l => { const id = l.id || genId(); obj[id] = { ...l, id }; });
    out.dailyLogs = obj;
  }
  return out;
}

/** Migration-only: the single sanctioned whole-tree write. */
export const putTrackerRoot = (value) => dbPut(ROOT, value);
