import { useState, useEffect, useRef } from "react";
import { auth, signOut } from "./firebase.js";
import { LABOR_PHASES, genId } from "./App.jsx";
import {
  readGuest, readGuestProject, readGuestHours, readGuestPrivate, patchGuest,
  putProjectDailyLog, putGuestPrivateLog, putGuestCrewNames,
} from "./db.js";
import { guestState, guestProjectIds, guestIsMine, guestHoursWithMine, buildGuestLog, fmtDate } from "./guestAccess.js";
import { uploadLogPhotos, describeUploadError, previewUrl } from "./photoUtils.js";

/**
 * GuestMode — the whole app, as a guest sees it.
 *
 * A guest gets the jobs they were given and a daily log, and that is all.
 * They never load the tracker: every read here goes to /guests,
 * /guestProjects or their own /guestPrivate, which is all the database rules
 * will give a guest account. See guestAccess.js.
 */

const THEMES = {
  daylight: {
    bg: "#EFF1EC", card: "#FFFFFF", cardAlt: "#F7F8F5", ink: "#13202F", inkSoft: "#44546A", inkFaint: "#7A8699",
    line: "#D8DCD3", lineStrong: "#B9BFB2", green: "#3A8230", greenWash: "#E5F1E0", navy: "#0F1E3C",
    amber: "#9A5B00", amberWash: "#FBEFD9", red: "#B42318", chip: "#EDEFE9", chipOn: "#0F1E3C", chipOnInk: "#FFFFFF",
  },
  office: {
    bg: "#0A192F", card: "#0F2444", cardAlt: "#132B4F", ink: "#F1F5F9", inkSoft: "#A8B6C9", inkFaint: "#64748B",
    line: "#1A3050", lineStrong: "#2A4470", green: "#69BE28", greenWash: "#69BE2820", navy: "#0F1E3C",
    amber: "#F0A93B", amberWash: "#F59E0B22", red: "#F87171", chip: "#1A3050", chipOn: "#69BE28", chipOnInk: "#0A192F",
  },
};
const HOUR_CHIPS = [8, 9, 10];
const THEME_KEY = "fwt-guest-theme";
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const phaseName = id => LABOR_PHASES.find(l => l.id === id)?.name || id;
const firstPhase = () => LABOR_PHASES[0]?.id || "";

export default function GuestMode({ user, userRecord }) {
  const code = userRecord.guestCode;
  const draftKey = `fwt-guest-draft-${user.uid}`;

  const [themeKey, setThemeKey] = useState(() => { try { return localStorage.getItem(THEME_KEY) || "daylight"; } catch { return "daylight"; } });
  const T = THEMES[themeKey] || THEMES.daylight;
  const [guest, setGuest] = useState(null);
  const [projects, setProjects] = useState([]);
  const [missing, setMissing] = useState(0);
  const [hours, setHours] = useState({});          // { pid: hours copy }, only when the office switched hours on
  const [priv, setPriv] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("jobs");
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  // log form
  const [date, setDate] = useState(todayIso());
  const [projectId, setProjectId] = useState("");
  const [crew, setCrew] = useState([]);
  const [activities, setActivities] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [crewSheet, setCrewSheet] = useState(false);
  const [typedName, setTypedName] = useState("");
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const restored = useRef(false);

  async function load() {
    setLoadError("");
    try {
      const g = await readGuest(code);
      setGuest(g || null);
      if (g && guestState(g) === "active" && guestIsMine(g, user.uid)) {
        const pids = guestProjectIds(g);
        const res = await Promise.allSettled(pids.map(pid => readGuestProject(pid)));
        const got = res.map((r, i) => (r.status === "fulfilled" && r.value ? { ...r.value, id: pids[i] } : null)).filter(Boolean);
        setProjects(got.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
        setMissing(pids.length - got.length);
        if (g.showHours) {
          const hr = await Promise.allSettled(pids.map(pid => readGuestHours(pid)));
          const h = {};
          hr.forEach((r, i) => { if (r.status === "fulfilled" && r.value) h[pids[i]] = r.value; });
          setHours(h);
        } else setHours({});
        try { setPriv((await readGuestPrivate(user.uid)) || {}); } catch { /* first visit: nothing saved yet */ }
        patchGuest(code, { lastSeenAt: Date.now() }).catch(() => {});
      }
    } catch {
      setLoadError("Couldn't load your jobs. Check your signal and try again.");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);                                    // eslint-disable-line
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  useEffect(() => { try { localStorage.setItem(THEME_KEY, themeKey); } catch { /* ignore */ } }, [themeKey]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2800); return () => clearTimeout(t); }, [toast]);

  // A dead zone or a closed tab should never eat a half-written log.
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (d && d.date === todayIso()) {
        setProjectId(d.projectId || ""); setCrew(d.crew || []); setActivities(d.activities || "");
        if ((d.crew || []).length || d.activities) setToast("Restored your unsent log");
      }
    } catch { /* ignore */ }
  }, []);                                                              // eslint-disable-line
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (!crew.length && !activities) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ date, projectId, crew, activities }));
    } catch { /* ignore */ }
  }, [date, projectId, crew, activities]);                             // eslint-disable-line

  const state = guest ? guestState(guest) : "revoked";
  const mine = guestIsMine(guest, user.uid);
  const myLogs = Object.values(priv.logs || {}).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const savedCrew = Array.isArray(priv.crew) ? priv.crew : [];
  const proj = projects.find(p => p.id === projectId);
  const detail = projects.find(p => p.id === detailId);
  const memberTotal = c => c.allocations.reduce((s, a) => s + (parseFloat(a.hours) || 0), 0);
  const totalHrs = crew.reduce((s, c) => s + memberTotal(c), 0);
  const loggedOn = (pid, d) => myLogs.some(l => l.pid === pid && l.date === d);
  // Hours for a job, or null when this guest is not shown hours (or none are set).
  const hoursFor = pid => (guest && guest.showHours && hours[pid] && hours[pid].phases) ? guestHoursWithMine(hours[pid], myLogs, pid, LABOR_PHASES) : null;
  const signOutLabel = user.isAnonymous ? "Close on this phone" : "Sign out";
  const whoAmI = user.email ? `Signed in as ${user.email}` : "Opened with a no-login guest link";

  const card = { background: T.card, borderRadius: 14, border: `1px solid ${T.line}` };
  const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkFaint };
  const shell = { minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column" };
  const fonts = <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />;

  function startLog(pid) {
    setProjectId(pid);
    if (crew.length === 0 && guest) setCrew([{ id: genId(), name: guest.name, allocations: [{ id: genId(), hours: 0, category: firstPhase() }] }]);
    setTab("log");
  }
  function setAlloc(cid, aid, field, val) {
    setCrew(crew.map(c => c.id !== cid ? c : { ...c, allocations: c.allocations.map(a => a.id === aid ? { ...a, [field]: val } : a) }));
  }
  function bump(cid, aid, delta) {
    setCrew(crew.map(c => c.id !== cid ? c : { ...c, allocations: c.allocations.map(a => a.id === aid ? { ...a, hours: Math.max(0, Math.round(((parseFloat(a.hours) || 0) + delta) * 2) / 2) } : a) }));
  }
  function addCrew(name) {
    const clean = (name || "").trim().replace(/\s+/g, " ");
    if (!clean || crew.some(c => c.name.toLowerCase() === clean.toLowerCase())) return;
    setCrew([...crew, { id: genId(), name: clean, allocations: [{ id: genId(), hours: 0, category: firstPhase() }] }]);
    setTypedName(""); setCrewSheet(false);
  }
  function copyText(label, val) {
    if (!val) return;
    try { navigator.clipboard?.writeText(val); } catch { /* ignore */ }
    setToast(`${label} copied`);
  }

  async function submit() {
    if (!proj || totalHrs === 0 || submitting) return;
    setSubmitting(true); setSaveError("");
    try {
      const logId = genId();
      let photoUrls = [];
      if (photos.length) {
        setToast(`Uploading ${photos.length} photo${photos.length > 1 ? "s" : ""}…`);
        try {
          photoUrls = await uploadLogPhotos(photos, proj.id, logId, (done, total) => setToast(`Uploading photos… ${done}/${total}`));
        } catch (e) {
          const why = e?.message || describeUploadError(e);
          if (!confirm(`${why}\n\nSubmit the log WITHOUT photos?\n\nOK = submit now\nCancel = keep everything and try again`)) { setSaveError(why); return; }
          photoUrls = [];
        }
      }
      const log = buildGuestLog({ id: logId, date, guest, code, crew, activities, photos: photoUrls, phaseName });

      // Wait for the real write before saying it saved or clearing the form.
      try { await putProjectDailyLog(proj.id, log); }
      catch {
        setSaveError("Couldn't send your log. It is still here. If this keeps happening, your guest access may have ended — check with the office.");
        return;
      }

      const mineCopy = { ...log, pid: proj.id, projectName: proj.name || "", jobNumber: proj.jobNumber || "" };
      const names = [...new Set([...savedCrew, ...crew.map(c => c.name)].filter(n => n && n !== guest.name))].slice(0, 40);
      setPriv(p => ({ ...p, logs: { ...(p.logs || {}), [logId]: mineCopy }, crew: names }));
      // The log itself is in. These two only feed "My logs" and the crew list.
      putGuestPrivateLog(user.uid, logId, mineCopy).catch(() => setToast("Log sent. It may not show under My logs on other devices."));
      putGuestCrewNames(user.uid, names).catch(() => {});
      patchGuest(code, { lastLogAt: Date.now() }).catch(() => {});

      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setCrew([]); setActivities(""); setPhotos([]); setProjectId(""); setDate(todayIso());
      setTab("mine");
      setToast(`Log sent ✓ ${log.hours}h on ${proj.jobNumber ? "#" + proj.jobNumber : proj.name}${photoUrls.length ? ` · ${photoUrls.length} photos` : ""}`);
    } finally { setSubmitting(false); }
  }

  /* ── not-in states ── */
  if (loading) return <div style={{ ...shell, alignItems: "center", justifyContent: "center", color: T.inkSoft }}>{fonts}Loading your jobs…</div>;

  if (loadError || !guest || !mine || state !== "active") {
    const title = loadError ? "Can't reach the server"
      : !guest || state === "revoked" ? "Guest access has ended"
      : state === "expired" ? "Guest access has expired"
      : guest.noLogin ? "Open your guest link again"
      : "This guest link belongs to another sign-in";
    const body = loadError ? loadError
      : !guest || state === "revoked" ? "The office has closed this guest access. If you are still on the job, ask them for a new link."
      : state === "expired" ? `Your access ended ${fmtDate(guest.expiresAt)}. Ask the office to extend it — your same link will work again once they do.`
      : guest.noLogin ? "This phone was signed out of the guest link. Open the link from your message again."
      : "Sign out and sign back in with the account you first opened the link with.";
    return (
      <div style={{ ...shell, alignItems: "center", justifyContent: "center", padding: 20 }}>{fonts}
        <div style={{ ...card, padding: 26, maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, fontFamily: "'Outfit',sans-serif", marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14, color: T.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>{body}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => { setLoading(true); load(); }} style={{ padding: "11px 20px", borderRadius: 10, border: `1px solid ${T.line}`, background: "transparent", color: T.inkSoft, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
            <button onClick={() => signOut(auth)} style={{ padding: "11px 20px", borderRadius: 10, border: "none", background: T.green, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{signOutLabel}</button>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 16 }}>{whoAmI}</div>
        </div>
      </div>
    );
  }

  /* ── JOBS ── */
  const JobDetail = detail && (() => {
    const si = detail.siteInfo || {};
    const tiles = [["Gate code", si.gateCode], ["Lockbox", si.lockbox], ["Site contact", si.siteContact], ["IDF / Head end", si.idf]].filter(([, v]) => v);
    const mapsUrl = detail.siteAddress ? `https://maps.google.com/?q=${encodeURIComponent(detail.siteAddress)}` : null;
    const telUrl = detail.contactPhone ? `tel:${String(detail.contactPhone).replace(/[^\d+]/g, "")}` : null;
    const cos = detail.changeOrders || [];
    const docs = detail.documents || [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => setDetailId(null)} style={{ alignSelf: "flex-start", padding: "9px 14px 9px 10px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.card, color: T.inkSoft, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 42 }}>‹ My jobs</button>

        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ background: T.navy, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              {detail.jobNumber && <span style={{ fontSize: 13, fontWeight: 800, color: "#69BE28" }}>#{detail.jobNumber}</span>}
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 19, fontWeight: 800, color: "#fff" }}>{detail.name}</span>
            </div>
            {detail.customer && <div style={{ fontSize: 12.5, color: "#9FB1CC", marginTop: 2 }}>{detail.customer}</div>}
          </div>
          {(mapsUrl || telUrl) && (
            <div style={{ display: "flex", gap: 8, padding: "10px 12px" }}>
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ flex: 1, minHeight: 46, borderRadius: 10, background: T.greenWash, border: `1px solid ${T.green}50`, color: T.green, fontSize: 13.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Directions</a>}
              {telUrl && <a href={telUrl} style={{ flex: 1, minHeight: 46, borderRadius: 10, background: T.cardAlt, border: `1px solid ${T.line}`, color: T.ink, fontSize: 13.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Call {detail.contactName ? detail.contactName.split(" ")[0] : "site contact"}</a>}
            </div>
          )}
          {detail.siteAddress && <div style={{ padding: "0 16px 12px", fontSize: 12.5, color: T.inkSoft }}>{detail.siteAddress}</div>}
        </div>

        {(tiles.length > 0 || si.parking) && (
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Site info — tap to copy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {tiles.map(([label, val]) => (
                <button key={label} onClick={() => copyText(label, val)} style={{ background: T.cardAlt, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", minHeight: 58 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
                </button>
              ))}
            </div>
            {si.parking && <div style={{ marginTop: 8, padding: "9px 12px", borderRadius: 10, background: T.amberWash, border: `1px solid ${T.amber}30`, fontSize: 12.5, fontWeight: 600, color: T.amber }}>{si.parking}</div>}
          </div>
        )}

        {(() => {
          const h = hoursFor(detail.id);
          if (!h || !h.rows.length) return null;
          const over = h.remaining < 0;
          const tone = (o, pct) => o ? T.red : pct > 90 ? T.amber : T.green;
          return (
            <div style={{ ...card, padding: "13px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={eyebrow}>Hours on this job</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: tone(over, h.pctUsed) }}>{h.used.toFixed(1)} of {h.bid.toFixed(1)}h · {h.pctUsed}%</div>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: T.chip, overflow: "hidden", marginBottom: 4 }}>
                <div style={{ width: `${Math.min(h.pctUsed, 100)}%`, height: "100%", borderRadius: 5, background: tone(over, h.pctUsed) }} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: over ? T.red : T.inkSoft, marginBottom: 12 }}>{over ? `Over by ${Math.abs(h.remaining).toFixed(1)}h` : `${h.remaining.toFixed(1)}h remaining`}</div>
              {h.rows.map(r => {
                const pct = r.bid > 0 ? Math.round((r.used / r.bid) * 100) : 100, o = r.remaining < 0;
                return (
                  <div key={r.id} style={{ marginBottom: 9 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, flex: 1 }}>{phaseName(r.id)}</span>
                      <span style={{ fontSize: 12, color: T.inkFaint }}>{r.used.toFixed(1)} / {r.bid.toFixed(1)}h</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: o ? T.red : r.remaining < r.bid * 0.2 ? T.amber : T.green, width: 58, textAlign: "right" }}>{o ? `+${Math.abs(r.remaining).toFixed(1)}` : r.remaining.toFixed(1)}h</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: T.chip, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 3, background: tone(o, pct) }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 4 }}>Counts every crew's logs on this job, including the ones you send.</div>
            </div>
          );
        })()}

        {detail.scopeNotes && (
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Scope of work</div>
            <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{detail.scopeNotes}</div>
          </div>
        )}

        {cos.length > 0 && (
          <div style={{ ...card, padding: "13px 16px", borderLeft: `4px solid ${T.amber}` }}>
            <div style={{ ...eyebrow, marginBottom: 10 }}>Change orders</div>
            {cos.map((co, i) => (
              <div key={co.n} style={{ paddingBottom: i < cos.length - 1 ? 12 : 0, marginBottom: i < cos.length - 1 ? 12 : 0, borderBottom: i < cos.length - 1 ? `1px solid ${T.line}` : "none" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: T.amber }}>CO-{co.n}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, flex: 1 }}>{co.description}</span>
                </div>
                {co.scope
                  ? <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{co.scope}</div>
                  : <div style={{ fontSize: 12.5, color: T.inkFaint }}>No scope written up yet. Ask the office before starting this work.</div>}
              </div>
            ))}
          </div>
        )}

        {docs.length > 0 && (
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Documents &amp; drawings</div>
            {docs.map((d, i) => (
              <a key={i} href={d.fileUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: i < docs.length - 1 ? `1px solid ${T.line}` : "none", textDecoration: "none", minHeight: 48 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: T.inkFaint }}>{[d.type, d.fileSize ? `${Math.max(1, Math.round(d.fileSize / 1024))} KB` : ""].filter(Boolean).join(" · ")}</div>
                </div>
                <span style={{ color: T.green, fontWeight: 800, fontSize: 13 }}>Open ›</span>
              </a>
            ))}
          </div>
        )}

        <button onClick={() => startLog(detail.id)} style={{ width: "100%", minHeight: 52, borderRadius: 13, border: "none", background: T.green, color: "#fff", fontSize: 15.5, fontWeight: 800, fontFamily: "'Outfit',sans-serif", cursor: "pointer" }}>Log hours on this job</button>
      </div>
    );
  })();

  const ScreenJobs = detail ? JobDetail : (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 24, fontWeight: 800, color: T.ink, lineHeight: 1.1 }}>Hi {String(guest.name || "").split(" ")[0]}</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>Guest access through {fmtDate(guest.expiresAt)}</div>
      </div>
      {projects.length === 0 && (
        <div style={{ ...card, padding: "16px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>No jobs to show yet</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>The office hasn't finished setting up your job. Pull down to refresh in a minute, or give them a call.</div>
        </div>
      )}
      {missing > 0 && projects.length > 0 && <div style={{ fontSize: 12, color: T.amber, fontWeight: 600 }}>{missing} job{missing > 1 ? "s are" : " is"} still being set up by the office.</div>}
      {projects.map(p => {
        const done = loggedOn(p.id, todayIso());
        return (
          <div key={p.id} style={{ ...card, padding: "14px 16px" }}>
            <button onClick={() => setDetailId(p.id)} style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                {p.jobNumber && <span style={{ fontSize: 12.5, fontWeight: 800, color: T.green }}>#{p.jobNumber}</span>}
                <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <span style={{ color: T.inkFaint, fontWeight: 800 }}>›</span>
              </div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{[p.customer, p.siteAddress].filter(Boolean).join(" · ")}</div>
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
              <button onClick={() => startLog(p.id)} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "none", background: done ? T.greenWash : T.green, color: done ? T.green : "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{done ? "✓ Logged today · add another" : "Start today's log"}</button>
              <button onClick={() => setDetailId(p.id)} style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, border: `1px solid ${T.line}`, background: "transparent", color: T.inkSoft, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Job info</button>
            </div>
          </div>
        );
      })}
      <button onClick={() => { setLoading(true); load(); }} style={{ alignSelf: "center", marginTop: 4, padding: "9px 16px", borderRadius: 10, border: "none", background: "transparent", color: T.inkFaint, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Refresh</button>
    </div>
  );

  /* ── LOG ── */
  const dup = proj && loggedOn(proj.id, date);
  const ScreenLog = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: T.ink }}>Daily log</div>

      <div style={{ ...card, padding: "13px 16px" }}>
        <div style={{ ...eyebrow, marginBottom: 6 }}>Date</div>
        <input type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${dup ? T.amber : T.line}`, background: T.cardAlt, color: T.ink, fontSize: 16, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />
        {dup && <div style={{ padding: "9px 12px", borderRadius: 10, background: T.amberWash, border: `1px solid ${T.amber}40`, fontSize: 12.5, fontWeight: 700, color: T.amber, marginBottom: 10 }}>You already sent a log for this job on {date}. This would add a second one.</div>}
        <div style={{ ...eyebrow, marginBottom: 8 }}>Job</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {projects.map(p => (
            <button key={p.id} onClick={() => startLog(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 11, border: projectId === p.id ? `2px solid ${T.green}` : `1px solid ${T.line}`, background: projectId === p.id ? T.greenWash : T.cardAlt, cursor: "pointer", fontFamily: "inherit", minHeight: 52, textAlign: "left" }}>
              {p.jobNumber && <span style={{ fontSize: 12.5, fontWeight: 800, color: T.green, flexShrink: 0 }}>#{p.jobNumber}</span>}
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              {projectId === p.id && <span style={{ color: T.green, fontWeight: 900 }}>✓</span>}
            </button>
          ))}
          {projects.length === 0 && <div style={{ fontSize: 12.5, color: T.inkFaint }}>No jobs available yet.</div>}
        </div>
      </div>

      {proj && (
        <div style={{ ...card, padding: "13px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={eyebrow}>Crew &amp; hours</div>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 800, color: totalHrs > 0 ? T.green : T.inkFaint }}>{totalHrs}h total</div>
          </div>
          {crew.map(c => (
            <div key={c.id} style={{ background: T.cardAlt, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 12px 10px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: memberTotal(c) > 0 ? T.green : T.inkFaint }}>{memberTotal(c)}h</span>
                <button aria-label={`Remove ${c.name}`} onClick={() => setCrew(crew.filter(x => x.id !== c.id))} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: T.inkFaint, fontSize: 16, cursor: "pointer" }}>✕</button>
              </div>
              {c.allocations.map(a => (
                <div key={a.id} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: c.allocations.length > 1 ? `1px dashed ${T.line}` : "none" }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {HOUR_CHIPS.map(h => (
                      <button key={h} onClick={() => setAlloc(c.id, a.id, "hours", h)} style={{ flex: 1, minHeight: 46, borderRadius: 10, border: "none", background: a.hours === h ? T.chipOn : T.chip, color: a.hours === h ? T.chipOnInk : T.ink, fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>{h}</button>
                    ))}
                    <button onClick={() => bump(c.id, a.id, 0.5)} style={{ flex: 0.8, minHeight: 46, borderRadius: 10, border: `1px solid ${T.lineStrong}`, background: "transparent", color: T.ink, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>+½</button>
                    <button onClick={() => bump(c.id, a.id, -0.5)} style={{ flex: 0.8, minHeight: 46, borderRadius: 10, border: `1px solid ${T.lineStrong}`, background: "transparent", color: T.ink, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>−½</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {LABOR_PHASES.map(lp => (
                      <button key={lp.id} onClick={() => setAlloc(c.id, a.id, "category", lp.id)} style={{ padding: "8px 12px", minHeight: 38, borderRadius: 20, border: a.category === lp.id ? `2px solid ${T.green}` : `1px solid ${T.line}`, background: a.category === lp.id ? T.greenWash : "transparent", color: a.category === lp.id ? T.green : T.inkSoft, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{lp.name}</button>
                    ))}
                  </div>
                  {(() => {
                    const h = hoursFor(proj.id), hrs = parseFloat(a.hours) || 0;
                    if (!h || !hrs) return null;
                    // what is left on this phase, less everything else on this form for the same phase
                    const row = h.rows.find(r => r.id === a.category);
                    const others = crew.reduce((s2, cc) => s2 + cc.allocations.reduce((t2, aa) => t2 + (aa.id !== a.id && aa.category === a.category ? (parseFloat(aa.hours) || 0) : 0), 0), 0);
                    const rem = (row ? row.remaining : 0) - others, after = rem - hrs;
                    return (
                      <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700, color: after < 0 ? T.red : T.inkFaint }}>
                        {after < 0 ? `Goes over ${phaseName(a.category)} by ${Math.abs(after).toFixed(1)}h (${Math.max(rem, 0).toFixed(1)}h was left)` : `${rem.toFixed(1)}h left on ${phaseName(a.category)}, ${after.toFixed(1)}h after this`}
                      </div>
                    );
                  })()}
                </div>
              ))}
              <button onClick={() => setCrew(crew.map(x => x.id === c.id ? { ...x, allocations: [...x.allocations, { id: genId(), hours: 0, category: firstPhase() }] } : x))} style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>+ Split another phase</button>
            </div>
          ))}
          <button onClick={() => setCrewSheet(true)} style={{ width: "100%", minHeight: 46, borderRadius: 11, border: `1.5px dashed ${T.lineStrong}`, background: "transparent", color: T.inkSoft, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add crew member</button>
        </div>
      )}

      {proj && (
        <div style={{ ...card, padding: "13px 16px" }}>
          <div style={{ ...eyebrow, marginBottom: 8 }}>Work performed</div>
          <textarea value={activities} onChange={e => setActivities(e.target.value)} placeholder="What got done today, what is left, anything holding you up…" style={{ width: "100%", minHeight: 96, padding: "11px 13px", borderRadius: 11, border: `1px solid ${T.line}`, background: T.cardAlt, color: T.ink, fontSize: 16, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setPhotos([...photos, ...fs]); e.target.value = ""; }} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setPhotos([...photos, ...fs]); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, minHeight: 50, borderRadius: 11, border: `1.5px solid ${T.green}`, background: T.greenWash, color: T.green, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Add photos{photos.length ? ` (${photos.length})` : ""}</button>
            <button onClick={() => camRef.current?.click()} style={{ minHeight: 50, padding: "0 16px", borderRadius: 11, border: `1px solid ${T.lineStrong}`, background: "transparent", color: T.ink, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Camera</button>
          </div>
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {photos.map((f, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={previewUrl(f) || ""} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 9, border: `1px solid ${T.line}` }} />
                  <button aria-label="Remove photo" onClick={() => setPhotos(photos.filter((_, x) => x !== i))} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: T.navy, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {saveError && <div style={{ padding: "12px 14px", borderRadius: 12, background: T.amberWash, border: `1.5px solid ${T.red}`, color: T.red, fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{saveError}</div>}
      {proj && (
        <button onClick={submit} disabled={totalHrs === 0 || submitting} style={{ width: "100%", minHeight: 56, borderRadius: 14, border: "none", background: totalHrs > 0 && !submitting ? T.green : T.chip, color: totalHrs > 0 && !submitting ? "#fff" : T.inkFaint, fontSize: 17, fontWeight: 800, fontFamily: "'Outfit',sans-serif", cursor: totalHrs > 0 && !submitting ? "pointer" : "default" }}>
          {submitting ? "Sending…" : totalHrs === 0 ? "Enter hours to send" : `Send log — ${totalHrs}h${photos.length ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}`}
        </button>
      )}
    </div>
  );

  /* ── MY LOGS ── */
  const ScreenMine = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: T.ink }}>My logs</div>
      {myLogs.length === 0 && <div style={{ ...card, padding: 16, fontSize: 13, color: T.inkSoft }}>Logs you send show up here.</div>}
      {myLogs.map(l => (
        <div key={l.id} style={{ ...card, padding: "13px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{l.date}</span>
            <span style={{ fontSize: 12.5, color: T.inkSoft, flex: 1 }}>{l.jobNumber ? `#${l.jobNumber} ` : ""}{l.projectName}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.green }}>{l.hours}h</span>
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{l.activities}</div>
          {l.photos?.length > 0 && (
            <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
              {l.photos.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.line}` }} /></a>)}
            </div>
          )}
        </div>
      ))}
      <button onClick={() => signOut(auth)} style={{ alignSelf: "center", marginTop: 10, padding: "10px 18px", borderRadius: 10, border: `1px solid ${T.line}`, background: "transparent", color: T.inkSoft, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{signOutLabel}</button>
      <div style={{ fontSize: 11, color: T.inkFaint, textAlign: "center" }}>{whoAmI}</div>
    </div>
  );

  const TABS = [["jobs", "My jobs"], ["log", "Daily log"], ["mine", "My logs"]];
  return (
    <div style={shell}>{fonts}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: T.navy, padding: "14px 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#4BA53C", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 13, color: "#fff" }}>FWT</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1 }}>Guest access</div>
          <div style={{ fontSize: 10.5, color: "#8FA3C2", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{guest.name}{guest.team ? ` · ${guest.team}` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 20, background: online ? "#4BA53C22" : "#B4231822", border: `1px solid ${online ? "#4BA53C55" : "#F8717155"}` }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: online ? "#4BA53C" : "#F87171" }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: online ? "#82CC4A" : "#F87171" }}>{online ? "ONLINE" : "OFFLINE"}</span>
        </div>
        <button aria-label="Switch light or dark" onClick={() => setThemeKey(themeKey === "daylight" ? "office" : "daylight")} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #2A4470", background: "transparent", cursor: "pointer", fontSize: 15 }}>{themeKey === "daylight" ? "🌙" : "☀️"}</button>
      </div>
      {!online && <div style={{ background: "#B42318", color: "#fff", padding: "8px 16px", fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>No signal. What you have typed is saved on this phone. Send once you are back online.</div>}

      <div style={{ flex: 1, padding: "16px 14px 100px", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {tab === "jobs" && ScreenJobs}
        {tab === "log" && ScreenLog}
        {tab === "mine" && ScreenMine}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.card, borderTop: `1px solid ${T.line}`, display: "flex", paddingBottom: "max(8px, env(safe-area-inset-bottom))", zIndex: 30 }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => { if (id === "jobs" && tab === "jobs") setDetailId(null); setTab(id); if (id === "log" && !projectId && projects.length === 1) startLog(projects[0].id); }} style={{ flex: 1, minHeight: 56, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, color: tab === id ? T.green : T.inkFaint, borderTop: tab === id ? `3px solid ${T.green}` : "3px solid transparent" }}>{label}</button>
        ))}
      </div>

      {toast && <div role="status" style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 48px)", maxWidth: 440, background: T.navy, color: "#fff", borderRadius: 13, padding: "13px 16px", fontSize: 14, fontWeight: 700, zIndex: 60, boxShadow: "0 6px 24px rgba(0,0,0,0.30)" }}>{toast}</div>}

      {crewSheet && (
        <>
          <div onClick={() => setCrewSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 70 }} />
          <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 520, background: T.card, borderRadius: "18px 18px 0 0", padding: "16px 16px max(20px, env(safe-area-inset-bottom))", zIndex: 71, maxHeight: "70vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>Add crew member</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input autoFocus value={typedName} onChange={e => setTypedName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCrew(typedName); }} placeholder="Name" style={{ flex: 1, padding: "12px 13px", borderRadius: 11, border: `1px solid ${T.line}`, background: T.cardAlt, color: T.ink, fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              <button onClick={() => addCrew(typedName)} disabled={!typedName.trim()} style={{ padding: "0 18px", borderRadius: 11, border: "none", background: typedName.trim() ? T.green : T.chip, color: typedName.trim() ? "#fff" : T.inkFaint, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
            {[guest.name, ...savedCrew].filter((n, i, a) => n && a.indexOf(n) === i && !crew.some(c => c.name.toLowerCase() === n.toLowerCase())).map(n => (
              <button key={n} onClick={() => addCrew(n)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "0 14px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.cardAlt, cursor: "pointer", fontFamily: "inherit", marginBottom: 7, textAlign: "left", fontSize: 15.5, fontWeight: 700, color: T.ink }}>{n}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
