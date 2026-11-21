/**
 * dataSplit.js — the one-time move of protected data out of /tracker.
 *
 *   /tracker/projects/{pid}  money fields      → /money/{pid}
 *   /tracker/memberPrivate/{uid}               → /private/{uid}
 *   /tracker/catalog, assemblies, estimatingDefaults → /estimating
 *   roster jobRole                             → /users/{uid}/jobRole (what the rules check)
 *   then /meta/dataSplit = true, which makes the rules refuse money and
 *   private data written back into /tracker by an out-of-date app.
 *
 * Safe to run twice: anything already in a new location wins over the old
 * copy, and old copies are only removed after the new one is written.
 * planDataSplit is pure (tested); runDataSplit performs the plan in order.
 */
import { splitProjectMoney, MONEY_KEYS } from "./db.js";

const EST_KEYS = ["catalog", "assemblies", "estimatingDefaults"];
const has = v => v !== undefined && v !== null;
const isObj = v => v && typeof v === "object" && !Array.isArray(v);

/** Roster role → account record, for every roster entry linked to an account. */
export function planRoleSync(roster, users) {
  const ops = [];
  (roster || []).forEach(m => {
    if (!m || !m.uid || !users || !users[m.uid]) return;
    const want = m.jobRole === "admin" || m.jobRole === "foreman" || m.jobRole === "tech" ? m.jobRole : null;
    if (!want) return;
    if (users[m.uid].jobRole !== want) ops.push({ method: "PUT", path: `/users/${m.uid}/jobRole`, value: want, label: `${m.name}: ${want}` });
  });
  return ops;
}

/**
 * @param tracker   raw /tracker
 * @param money     raw /money (may be null)
 * @param priv      raw /private (may be null)
 * @param est       raw /estimating (may be null)
 * @param users     raw /users
 * @returns { ops: [{method, path, value, label}], summary }
 */
export function planDataSplit({ tracker, money, priv, est, users }) {
  const t = tracker || {};
  const ops = [];
  const summary = { roles: 0, estimating: 0, privateRecords: 0, projectsWithMoney: 0, materialCosts: 0, coAmounts: 0 };

  // 1. Roles first — foremen need them to read /money once it's populated
  const roleOps = planRoleSync(t.teamRoster, users);
  ops.push(...roleOps);
  summary.roles = roleOps.length;

  // 2. Estimating
  const e = est || {};
  EST_KEYS.forEach(k => {
    if (!has(t[k])) return;
    let value = t[k];
    if (isObj(t[k]) && isObj(e[k])) value = { ...t[k], ...e[k] };   // new location wins per item
    else if (has(e[k])) value = e[k];
    ops.push({ method: "PUT", path: `/estimating/${k}`, value, label: `Price book: ${k}` });
    summary.estimating++;
  });

  // 3. Private records
  const mp = t.memberPrivate || {};
  const p = priv || {};
  Object.entries(mp).forEach(([key, rec]) => {
    if (!isObj(rec)) return;
    const value = isObj(p[key]) ? { ...rec, ...p[key] } : rec;
    ops.push({ method: "PUT", path: `/private/${key}`, value, label: `Private: ${key}` });
    summary.privateRecords++;
  });

  // 4. Job money
  const projects = isObj(t.projects) ? t.projects : {};
  Object.entries(projects).forEach(([pid, proj]) => {
    if (!isObj(proj)) return;
    const picked = {};
    MONEY_KEYS.forEach(k => { if (k in proj) picked[k] = proj[k]; });
    if (Array.isArray(proj.materials)) picked.materials = proj.materials;
    if (Array.isArray(proj.changeOrders)) picked.changeOrders = proj.changeOrders;
    if (!Object.keys(picked).length) return;
    const { pub, money: m } = splitProjectMoney(picked);
    const prev = (money || {})[pid] || {};
    const merged = {};
    MONEY_KEYS.forEach(k => {
      const v = has(prev[k]) ? prev[k] : m[k];
      if (has(v) && v !== "") merged[k] = v;
    });
    const mc = { ...(m.materialCost || {}), ...(prev.materialCost || {}) };
    const ca = { ...(m.coAmount || {}), ...(prev.coAmount || {}) };
    if (Object.keys(mc).length) merged.materialCost = mc;
    if (Object.keys(ca).length) merged.coAmount = ca;

    // Strip from /tracker: money keys removed, lines rewritten without costs
    const strip = {};
    MONEY_KEYS.forEach(k => { if (k in proj) strip[k] = null; });
    const hadCosts = Array.isArray(proj.materials) && proj.materials.some(x => x && has(x.cost));
    const hadAmts = Array.isArray(proj.changeOrders) && proj.changeOrders.some(x => x && has(x.amount));
    const needIds = l => Array.isArray(l) && l.some(x => x && typeof x === "object" && !x.id);
    if (hadCosts || needIds(proj.materials)) strip.materials = pub.materials;
    if (hadAmts || needIds(proj.changeOrders)) strip.changeOrders = pub.changeOrders;
    // Nothing left in /tracker to move for this job (already done)
    const trackerHasMoney = MONEY_KEYS.some(k => has(proj[k]) && proj[k] !== "") || hadCosts || hadAmts;
    if (!trackerHasMoney && !Object.keys(strip).length) return;

    if (Object.keys(merged).length) {
      ops.push({ method: "PUT", path: `/money/${pid}`, value: merged, label: `Money: ${proj.jobNumber || proj.name || pid}` });
      summary.projectsWithMoney++;
      summary.materialCosts += Object.keys(mc).length;
      summary.coAmounts += Object.keys(ca).length;
    }
    // Only after the money copy is written (ops run in order)
    if (Object.keys(strip).length) ops.push({ method: "PATCH", path: `/tracker/projects/${pid}`, value: strip, label: `Clean job: ${proj.jobNumber || proj.name || pid}` });
  });

  // 5. Remove the old copies — after every new copy above
  EST_KEYS.forEach(k => { if (has(t[k])) ops.push({ method: "DELETE", path: `/tracker/${k}`, label: `Remove old ${k}` }); });
  if (Object.keys(mp).length) ops.push({ method: "DELETE", path: "/tracker/memberPrivate", label: "Remove old private records" });

  // 6. Done — the rules now refuse these fields in /tracker
  ops.push({ method: "PUT", path: "/meta/dataSplit", value: true, label: "Lock old locations" });
  return { ops, summary };
}

/** Perform the plan in order. Stops at the first failure (re-running is safe). */
export async function runDataSplit(ops, { dbPut, dbPatch, dbDelete }, onProgress) {
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (onProgress) onProgress(i, ops.length, op.label);
    if (op.method === "PUT") await dbPut(op.path, op.value);
    else if (op.method === "PATCH") await dbPatch(op.path, op.value);
    else if (op.method === "DELETE") await dbDelete(op.path);
  }
  if (onProgress) onProgress(ops.length, ops.length, "");
}
