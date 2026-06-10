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
 *   - personal data writes /tracker/memberPrivate/{uid}
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

async function req(path, method, body) {
  const t = await token();
  const url = `${FB_URL}${path}.json${t ? `?auth=${t}` : ""}`;
  const r = await fetch(url, {
    method,
    headers: method !== "GET" && method !== "DELETE" ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} failed (${r.status})`);
  if (method === "GET") return await r.json();
  return true;
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

/** One day of the schedule grid. */
export const putScheduleDay = (dateIso, value) => dbPut(`${ROOT}/schedule/${dateIso}`, value);

/* ── projects (keyed object in DB) ──────────────────────────────── */
export const putProject    = (pid, project) => dbPut(`${ROOT}/projects/${pid}`, project);
export const patchProject  = (pid, updates) => dbPatch(`${ROOT}/projects/${pid}`, updates);
export const deleteProject = (pid)          => dbDelete(`${ROOT}/projects/${pid}`);

/** Surgical add — two foremen can submit logs to the same job at the same second safely. */
export const putProjectDailyLog    = (pid, log)   => dbPut(`${ROOT}/projects/${pid}/dailyLogs/${log.id}`, log);
export const deleteProjectDailyLog = (pid, logId) => dbDelete(`${ROOT}/projects/${pid}/dailyLogs/${logId}`);

/* ── member private space (keyed by uid) ────────────────────────── */
export const putMemberPrivate   = (uid, value)   => dbPut(`${ROOT}/memberPrivate/${uid}`, value);
export const patchMemberPrivate = (uid, updates) => dbPatch(`${ROOT}/memberPrivate/${uid}`, updates);

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
