/**
 * liveSync.js — keep a local mirror of a database branch current by applying
 * only what changed.
 *
 * WHY
 * The previous sync opened a stream on /tracker and, on every change by
 * anyone, re-downloaded the entire tracker. With a crew logging all day that
 * is (open devices × changes × whole database) of download, and it got
 * slower with every daily log. Firebase's stream already says exactly what
 * changed — a path and its new value — so we apply that to a mirror instead.
 *
 * A branch is downloaded in full once when its stream opens (and again only
 * when the stream has to reconnect). Everything after that is the change.
 *
 * Writes this device makes are applied to the mirror as soon as Firebase
 * confirms them (see onWriteAck in db.js), so the screen never flickers back
 * to an old value while waiting for the stream to echo the write.
 */

/* ── tree edits (immutable; only the changed path is copied) ───────── */
const segs = p => String(p || "").split("/").filter(Boolean);
const isObj = v => v && typeof v === "object";

function copyNode(n) { return Array.isArray(n) ? n.slice() : { ...n }; }
function isEmpty(n) { return !isObj(n) || (Array.isArray(n) ? n.every(v => v == null) : Object.keys(n).length === 0); }

/** Set (or with null/undefined, delete) the value at `path` inside `tree`. */
export function setIn(tree, path, value) {
  const s = Array.isArray(path) ? path : segs(path);
  if (!s.length) return value == null ? null : value;
  const [k, ...rest] = s;
  const base = isObj(tree) ? tree : {};
  const child = rest.length ? setIn(isObj(base[k]) ? base[k] : null, rest, value) : value;
  const out = copyNode(base);
  if (child == null || (rest.length && isEmpty(child))) {
    if (Array.isArray(out)) { out[k] = null; } else delete out[k];
  } else out[k] = child;
  // Firebase drops empty branches; mirror that so the copy matches the server
  return isEmpty(out) ? null : out;
}

/** A stream event: "put" replaces the value at path, "patch" merges children. */
export function applyEvent(tree, type, path, data) {
  if (type === "put") return setIn(tree, path, data);
  if (type === "patch" && isObj(data)) {
    let t = tree;
    for (const [k, v] of Object.entries(data)) t = setIn(t, [...segs(path), ...segs(k)], v);
    return t;
  }
  return tree;
}

/** A confirmed REST write ({ path, method, value }) applied to the mirror of `root`. */
export function applyWrite(tree, root, { path, method, value }) {
  const r = segs(root), p = segs(path);
  if (p.length < r.length || r.some((x, i) => p[i] !== x)) return tree;   // not under this root
  const rel = p.slice(r.length);
  if (method === "PUT") return setIn(tree, rel, value);
  if (method === "DELETE") return setIn(tree, rel, null);
  if (method === "PATCH") return applyEvent(tree, "patch", rel.join("/"), value);
  return tree;
}

/**
 * Open a live stream on `path`. Calls onChange(tree, { initial }) with the
 * whole mirrored branch after each event. Resolves `ready` with the first
 * snapshot, or rejects if the branch can't be read (no permission / offline).
 *
 * Reconnects with a fresh sign-in token when Firebase revokes the old one
 * (tokens last an hour) or the connection drops.
 */
export function openLive(url, path, { getToken, onChange, onStatus, EventSourceImpl }) {
  const ES = EventSourceImpl || (typeof EventSource !== "undefined" ? EventSource : null);
  let es = null, closed = false, tree = null, gotFirst = false, retry = null, attempts = 0;
  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });

  async function connect() {
    if (closed || !ES) return;
    let token = null;
    try { token = await getToken(); } catch { /* signed out */ }
    if (closed) return;
    es = new ES(`${url}${path}.json${token ? `?auth=${token}` : ""}`);
    const handle = type => e => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (!msg || typeof msg.path !== "string") return;
      const first = !gotFirst && type === "put" && msg.path === "/";
      tree = applyEvent(first ? null : tree, type, msg.path, msg.data);
      attempts = 0;
      if (first) { gotFirst = true; resolveReady(tree); }
      if (gotFirst) onChange(tree, { initial: first });
    };
    es.addEventListener("put", handle("put"));
    es.addEventListener("patch", handle("patch"));
    es.onopen = () => onStatus && onStatus("synced");
    // Token expired or permission changed: reopen with a fresh token
    es.addEventListener("auth_revoked", () => reconnect(500));
    es.addEventListener("cancel", () => {
      // The rules refuse this branch. Don't retry forever.
      if (!gotFirst) rejectReady(Object.assign(new Error(`No access to ${path}`), { code: "PERMISSION_DENIED" }));
      shutdown();
    });
    es.onerror = () => {
      onStatus && onStatus("reconnecting");
      // A refused first connection (401) also lands here — give up after a few tries
      if (!gotFirst && attempts >= 2) { rejectReady(Object.assign(new Error(`Couldn't open ${path}`), { code: "UNAVAILABLE" })); }
      reconnect(Math.min(30000, 1000 * 2 ** attempts));
    };
  }
  function shutdown() { if (es) { es.close(); es = null; } }
  function reconnect(ms) {
    shutdown();
    if (closed) return;
    attempts++;
    clearTimeout(retry);
    retry = setTimeout(connect, ms);
  }
  connect();
  return {
    ready,
    get tree() { return tree; },
    /** Apply a write this device made, once Firebase confirmed it. */
    applyWrite(w, root) { if (gotFirst) { tree = applyWrite(tree, root || path, w); onChange(tree, { initial: false, own: true }); } },
    close() { closed = true; clearTimeout(retry); shutdown(); },
  };
}
