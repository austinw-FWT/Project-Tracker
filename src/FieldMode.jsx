import { useState, useEffect, useRef } from "react";
import { LABOR_PHASES, genId } from "./App.jsx";
import { remainingHours } from "./laborMath.js";
import { storage, storageRef, uploadBytes, getDownloadURL } from "./firebase.js";

/**
 * FieldMode — the technician's home screen.
 *
 * Built from the approved mockup: bottom tab navigation, Today screen with
 * the Site Brain card and My Week, and a one-thumb daily log (hour chips,
 * no keyboard for hours; category pills; camera in the log flow; copy last
 * log; duplicate-date warning; localStorage draft so a dead zone never eats
 * a half-finished entry).
 *
 * Data contracts match the rest of the app exactly:
 *   - submits through the same onSubmit(updatedLogs, projectLogs) path as
 *     MyDailyLog, so hours ledger math, project records, and the office's
 *     view are identical regardless of which screen a log came from
 *   - reads schedule[dateISO][memberName] = projectId for Today / My Week
 *   - reads project.siteInfo for the Site Brain card
 */

const THEMES = {
  daylight: {
    name: "Daylight", bg: "#EFF1EC", card: "#FFFFFF", cardAlt: "#F7F8F5",
    ink: "#13202F", inkSoft: "#44546A", inkFaint: "#7A8699",
    line: "#D8DCD3", lineStrong: "#B9BFB2",
    green: "#3A8230", greenBright: "#4BA53C", greenWash: "#E5F1E0",
    navy: "#0F1E3C", amber: "#9A5B00", amberWash: "#FBEFD9",
    red: "#B42318", chip: "#EDEFE9", chipOn: "#0F1E3C", chipOnInk: "#FFFFFF",
  },
  office: {
    name: "Office", bg: "#0A192F", card: "#0F2444", cardAlt: "#132B4F",
    ink: "#F1F5F9", inkSoft: "#A8B6C9", inkFaint: "#64748B",
    line: "#1A3050", lineStrong: "#2A4470",
    green: "#69BE28", greenBright: "#69BE28", greenWash: "#69BE2820",
    navy: "#0F1E3C", amber: "#F0A93B", amberWash: "#F59E0B22",
    red: "#F87171", chip: "#1A3050", chipOn: "#69BE28", chipOnInk: "#0A192F",
  },
};

const HOUR_CHIPS = [8, 9, 10];
const DRAFT_KEY = "fwt-fieldmode-draft";
const THEME_KEY = "fwt-fieldmode-theme";

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const isoFor = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Client-side photo compression: ~1600px long edge, JPEG q0.8.
    Turns 10MB phone shots into ~300KB uploads that survive one bar of LTE. */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const s = MAX / Math.max(width, height);
        width = Math.round(width * s); height = Math.round(height * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("compress failed")), "image/jpeg", 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src = url;
  });
}

export default function FieldMode({ projects, teamRoster, schedule, myName, myLogs, onSubmit, onOpenFullApp, onUpdateProject, isAdmin }) {
  const [themeKey, setThemeKey] = useState(() => { try { return localStorage.getItem(THEME_KEY) || "daylight"; } catch { return "daylight"; } });
  const T = THEMES[themeKey] || THEMES.daylight;
  const [tab, setTab] = useState("today");
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(null);

  /* ── log state (draft-persisted) ── */
  const [date, setDate] = useState(todayIso());
  const [projectId, setProjectId] = useState("");
  const [crew, setCrew] = useState([]);
  const [activities, setActivities] = useState("");
  const [photos, setPhotos] = useState([]); // File objects, compressed at submit
  const [submitting, setSubmitting] = useState(false);
  const [crewSheet, setCrewSheet] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const fileRef = useRef(null);
  const restored = useRef(false);

  const activeProjects = (projects || []).filter(p => !p.movedToWarranty);
  const proj = activeProjects.find(p => p.id === projectId);
  const today = todayIso();
  const todaysProjectId = (schedule || {})[today]?.[myName] || "";
  const todaysProject = activeProjects.find(p => p.id === todaysProjectId);

  /* draft restore / persist — a dead zone or killed tab never eats an entry */
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.date === todayIso()) { // only restore same-day drafts
          setDate(d.date); setProjectId(d.projectId || ""); setCrew(d.crew || []); setActivities(d.activities || "");
          if ((d.crew || []).length || d.activities) setToast("Restored your unsent draft");
        } else localStorage.removeItem(DRAFT_KEY);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (crew.length === 0 && !activities) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ date, projectId, crew, activities }));
    } catch {}
  }, [date, projectId, crew, activities]);

  useEffect(() => { try { localStorage.setItem(THEME_KEY, themeKey); } catch {} }, [themeKey]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(null), 1500); return () => clearTimeout(t); }, [copied]);

  /* ── crew helpers ── */
  function memberTotal(c) { return c.allocations.reduce((s, a) => s + (parseFloat(a.hours) || 0), 0); }
  const totalHrs = crew.reduce((s, c) => s + memberTotal(c), 0);

  function startLog(pid) {
    setProjectId(pid);
    if (crew.length === 0) setCrew([{ id: genId(), name: myName, allocations: [{ id: genId(), hours: 0, category: LABOR_PHASES[0]?.id || "" }] }]);
    setTab("log");
  }
  function setAlloc(cid, aid, field, val) {
    setCrew(crew.map(c => c.id !== cid ? c : { ...c, allocations: c.allocations.map(a => a.id === aid ? { ...a, [field]: val } : a) }));
  }
  function bump(cid, aid, delta) {
    setCrew(crew.map(c => c.id !== cid ? c : { ...c, allocations: c.allocations.map(a => a.id === aid ? { ...a, hours: Math.max(0, Math.round(((parseFloat(a.hours) || 0) + delta) * 2) / 2) } : a) }));
  }
  function copyLastLog() {
    const last = (myLogs || [])[0];
    if (!last || !last.entries?.length) { setToast("No previous log to copy"); return; }
    const e = last.entries[0];
    setProjectId(e.projectId || "");
    setCrew((e.crewMembers || []).map(c => ({
      id: genId(), name: c.name,
      allocations: (c.allocations?.length ? c.allocations : [{ hours: 0, category: LABOR_PHASES[0]?.id || "" }]).map(a => ({ id: genId(), hours: parseFloat(a.hours) || 0, category: a.category || LABOR_PHASES[0]?.id || "" })),
    })));
    setToast(`Copied crew & phases from ${last.date}`);
  }

  const dupPersonal = (myLogs || []).some(l => l.date === date && (l.entries || []).some(e => e.projectId === projectId));
  const dupOnProject = proj && (proj.dailyLogs || []).some(l => l.date === date && l.member === myName);
  const loggedTodayForAssigned = todaysProjectId && (myLogs || []).some(l => l.date === today && (l.entries || []).some(e => e.projectId === todaysProjectId));

  /* ── submit ── */
  async function submit() {
    if (!proj || totalHrs === 0 || submitting) return;
    setSubmitting(true);
    try {
      const logId = genId();
      // photos: compress + upload first so URLs ride inside the log record
      let photoUrls = [];
      if (photos.length) {
        setToast(`Uploading ${photos.length} photo${photos.length > 1 ? "s" : ""}…`);
        try {
          photoUrls = await Promise.all(photos.map(async (f, i) => {
            const blob = await compressImage(f);
            const r = storageRef(storage, `projects/${proj.id}/dailyLogs/${logId}/${i}-${Date.now()}.jpg`);
            await uploadBytes(r, blob);
            return await getDownloadURL(r);
          }));
        } catch {
          if (!confirm("Photo upload failed (weak signal?).\n\nSubmit the log without photos? You can add them later from better signal.")) { setSubmitting(false); return; }
          photoUrls = [];
        }
      }

      const crewMembers = crew.map(c => ({
        name: c.name,
        allocations: c.allocations.filter(a => (parseFloat(a.hours) || 0) > 0).map(a => ({ hours: parseFloat(a.hours), category: a.category })),
      })).filter(c => c.allocations.length > 0);

      const entry = { projectId: proj.id, activities, crewMembers };
      const personalLog = { id: genId(), date, submittedBy: myName, entries: [entry], createdAt: new Date().toISOString() };

      const crewLines = crewMembers.map(c => `${c.name}: ${c.allocations.map(a => `${a.hours}h [${LABOR_PHASES.find(l => l.id === a.category)?.name || a.category}]`).join(" + ")}`);
      const projectLog = {
        id: logId, date, member: myName, hours: totalHrs,
        activities: activities + (crewLines.length ? `\nCrew: ${crewLines.join("; ")}` : ""),
        crewBreakdown: crewMembers,
        ...(photoUrls.length ? { photos: photoUrls } : {}),
        createdAt: new Date().toISOString(),
      };

      onSubmit([personalLog, ...(myLogs || [])], [{ pid: proj.id, log: projectLog }]);

      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setCrew([]); setActivities(""); setPhotos([]); setProjectId(""); setDate(todayIso());
      setTab("today");
      setToast(`Log saved ✓ ${totalHrs}h on ${proj.jobNumber ? "#" + proj.jobNumber : proj.name}${photoUrls.length ? ` · ${photoUrls.length} photos` : ""}`);
    } finally { setSubmitting(false); }
  }

  /* ── styles ── */
  const card = { background: T.card, borderRadius: 14, border: `1px solid ${T.line}`, boxShadow: themeKey === "daylight" ? "0 1px 3px rgba(19,32,47,0.10)" : "0 1px 3px rgba(0,0,0,0.35)" };
  const eyebrow = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkFaint };

  function copySite(label, val) {
    if (!val || val === "—") return;
    try { navigator.clipboard?.writeText(val); } catch {}
    setCopied(label); setToast(`${label} copied — ${val}`);
  }

  /* ════════ TODAY ════════ */
  const week = [0, 1, 2, 3, 4].map(o => {
    const iso = isoFor(o);
    const pid = (schedule || {})[iso]?.[myName];
    const p = activeProjects.find(x => x.id === pid);
    const d = new Date(iso + "T12:00:00");
    return { iso, day: d.toLocaleDateString(undefined, { weekday: "short" }), date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), proj: p, today: iso === today, logged: (myLogs || []).some(l => l.date === iso && (l.entries || []).some(e => e.projectId === pid)) };
  });

  const si = todaysProject?.siteInfo || {};
  const siteTiles = [["Gate code", si.gateCode], ["Lockbox", si.lockbox], ["Site contact", si.siteContact], ["IDF / Head end", si.idf]].filter(([, v]) => v);

  const ScreenToday = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 25, fontWeight: 800, color: T.ink, lineHeight: 1.1 }}>
          {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {myName.split(" ")[0]}
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 3 }}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      </div>

      {todaysProject ? (!loggedTodayForAssigned ? (
        <button onClick={() => startLog(todaysProject.id)} style={{ ...card, border: `1.5px solid ${T.green}`, padding: "14px 16px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T.greenWash, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>📋</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>You're scheduled at {todaysProject.name}</div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 1 }}>No log yet for today</div>
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 10, background: T.green, color: "#fff", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>Start log</div>
        </button>
      ) : (
        <div style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderLeft: `4px solid ${T.green}` }}>
          <div style={{ fontSize: 19 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Today's log is in for {todaysProject.name}</div>
        </div>
      )) : (
        <div style={{ ...card, padding: "14px 16px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Nothing on the schedule for you today</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>You can still log hours from the Log tab.</div>
        </div>
      )}

      {todaysProject && (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ background: T.navy, padding: "14px 16px" }}>
            <div style={{ ...eyebrow, color: "#9FB1CC" }}>Today's assignment</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              {todaysProject.jobNumber && <span style={{ fontSize: 13, fontWeight: 800, color: "#69BE28" }}>#{todaysProject.jobNumber}</span>}
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 19, fontWeight: 800, color: "#fff" }}>{todaysProject.name}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#9FB1CC", marginTop: 2 }}>{todaysProject.customer}{todaysProject.siteAddress ? ` · ${todaysProject.siteAddress}` : ""}</div>
          </div>
          <div style={{ padding: "12px 16px 14px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Site brain — tap to copy</div>
            {siteTiles.length === 0 && <div style={{ fontSize: 12.5, color: T.inkFaint }}>No site info added yet — the office can fill this in on the project's Overview.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {siteTiles.map(([label, val]) => (
                <button key={label} onClick={() => copySite(label, val)} style={{ background: copied === label ? T.greenWash : T.cardAlt, border: `1px solid ${copied === label ? T.green : T.line}`, borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", minHeight: 58 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: copied === label ? T.green : T.ink, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{copied === label ? "Copied ✓" : val}</div>
                </button>
              ))}
            </div>
            {si.parking && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", borderRadius: 10, background: T.amberWash, border: `1px solid ${T.amber}30` }}>
                <span style={{ fontSize: 13 }}>🚧</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: T.amber }}>{si.parking}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ ...eyebrow, marginBottom: 10 }}>My week</div>
        {week.map(d => (
          <div key={d.iso} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.line}`, opacity: d.proj ? 1 : 0.55 }}>
            <div style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: d.today ? T.green : T.inkSoft }}>{d.day}</div>
              <div style={{ fontSize: 10.5, color: T.inkFaint }}>{d.date}</div>
            </div>
            <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: d.today ? T.green : T.line }} />
            <div style={{ flex: 1, fontSize: 14, fontWeight: d.today ? 800 : 600, color: d.proj ? T.ink : T.inkFaint, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.proj ? `${d.proj.jobNumber ? "#" + d.proj.jobNumber + " " : ""}${d.proj.name}` : "Off"}
            </div>
            {d.logged && <span style={{ fontSize: 11, fontWeight: 800, color: T.green, flexShrink: 0 }}>LOGGED ✓</span>}
            {d.today && !d.logged && <span style={{ fontSize: 11, fontWeight: 800, color: T.amber, flexShrink: 0 }}>TODAY</span>}
          </div>
        ))}
      </div>
    </div>
  );

  /* ════════ LOG ════════ */
  const rosterNames = (teamRoster || []).map(t => t.name);
  const ScreenLog = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: T.ink }}>Daily log</div>
        <button onClick={copyLastLog} style={{ padding: "9px 14px", borderRadius: 10, border: `1.5px dashed ${T.green}`, background: T.greenWash, color: T.green, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", minHeight: 42 }}>↻ Copy last log</button>
      </div>

      <div style={{ ...card, padding: "13px 16px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...eyebrow, marginBottom: 6 }}>Date</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${(dupPersonal || dupOnProject) ? T.amber : T.line}`, background: T.cardAlt, color: T.ink, fontSize: 16, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        </div>
        {(dupPersonal || dupOnProject) && projectId && (
          <div style={{ padding: "9px 12px", borderRadius: 10, background: T.amberWash, border: `1px solid ${T.amber}40`, fontSize: 12.5, fontWeight: 700, color: T.amber, marginBottom: 10 }}>
            ⚠ You already submitted a log for this job on {date} — this would add a second one.
          </div>
        )}
        <div style={{ ...eyebrow, marginBottom: 8 }}>Project</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 250, overflowY: "auto" }}>
          {activeProjects.map(p => (
            <button key={p.id} onClick={() => startLog(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 11, border: projectId === p.id ? `2px solid ${T.green}` : `1px solid ${T.line}`, background: projectId === p.id ? T.greenWash : T.cardAlt, cursor: "pointer", fontFamily: "inherit", minHeight: 52, textAlign: "left" }}>
              {p.jobNumber && <span style={{ fontSize: 12.5, fontWeight: 800, color: T.green, flexShrink: 0 }}>#{p.jobNumber}</span>}
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              {projectId === p.id && <span style={{ color: T.green, fontWeight: 900 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {proj && (
        <div style={{ ...card, padding: "13px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={eyebrow}>Crew & hours</div>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 800, color: totalHrs > 0 ? T.green : T.inkFaint }}>{totalHrs}h total</div>
          </div>

          {crew.map(c => (
            <div key={c.id} style={{ background: T.cardAlt, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 12px 10px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: memberTotal(c) > 0 ? T.green : T.inkFaint }}>{memberTotal(c)}h</span>
                <button onClick={() => setCrew(crew.filter(x => x.id !== c.id))} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", color: T.inkFaint, fontSize: 16, cursor: "pointer" }}>✕</button>
              </div>

              {c.allocations.map(a => {
                const rem = remainingHours(proj, a.category);
                const after = rem - (parseFloat(a.hours) || 0);
                const over = (parseFloat(a.hours) || 0) > 0 && after < 0;
                return (
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
                    {(parseFloat(a.hours) || 0) > 0 && (
                      <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700, color: over ? T.red : after < rem * 0.2 ? T.amber : T.inkFaint }}>
                        {over ? `⚠ Overruns ${LABOR_PHASES.find(l => l.id === a.category)?.name || ""} by ${Math.abs(after).toFixed(1)}h — only ${rem.toFixed(1)}h remained` : `${rem.toFixed(1)}h left on ${LABOR_PHASES.find(l => l.id === a.category)?.name || ""} → ${after.toFixed(1)}h after this`}
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={() => setCrew(crew.map(x => x.id === c.id ? { ...x, allocations: [...x.allocations, { id: genId(), hours: 0, category: LABOR_PHASES[0]?.id || "" }] } : x))} style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>+ Split another phase</button>
            </div>
          ))}

          <button onClick={() => setCrewSheet(true)} style={{ width: "100%", minHeight: 46, borderRadius: 11, border: `1.5px dashed ${T.lineStrong}`, background: "transparent", color: T.inkSoft, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add crew member</button>
        </div>
      )}

      {proj && (
        <div style={{ ...card, padding: "13px 16px" }}>
          <div style={{ ...eyebrow, marginBottom: 8 }}>Work performed</div>
          <textarea value={activities} onChange={e => setActivities(e.target.value)} placeholder="Finished Bldg C camera trim, terminated IDF-2, gate operator parts arrived…"
            style={{ width: "100%", minHeight: 84, padding: "11px 13px", borderRadius: 11, border: `1px solid ${T.line}`, background: T.cardAlt, color: T.ink, fontSize: 16, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }}
            onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setPhotos([...photos, ...fs]); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, minHeight: 50, borderRadius: 11, border: `1.5px solid ${T.green}`, background: T.greenWash, color: T.green, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              📷 Add photos{photos.length > 0 ? ` (${photos.length})` : ""}
            </button>
            {photos.length > 0 && <button onClick={() => setPhotos([])} style={{ minHeight: 50, padding: "0 16px", borderRadius: 11, border: `1px solid ${T.line}`, background: "transparent", color: T.inkSoft, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>}
          </div>
          {photos.length > 0 && <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 8 }}>{photos.length} photo{photos.length > 1 ? "s" : ""} ready — they compress on your phone before upload, so this works on one bar.</div>}
        </div>
      )}

      {proj && (
        <button onClick={submit} disabled={totalHrs === 0 || submitting} style={{ width: "100%", minHeight: 56, borderRadius: 14, border: "none", background: totalHrs > 0 && !submitting ? T.green : T.chip, color: totalHrs > 0 && !submitting ? "#fff" : T.inkFaint, fontSize: 17, fontWeight: 800, fontFamily: "'Outfit',sans-serif", cursor: totalHrs > 0 && !submitting ? "pointer" : "default" }}>
          {submitting ? "Saving…" : `Submit log — ${totalHrs}h${photos.length ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}`}
        </button>
      )}
      <div style={{ height: 4 }} />
    </div>
  );

  /* ════════ PROJECTS ════════ */
  const detail = activeProjects.find(p => p.id === detailId);

  const ProjectDetailScreen = detail && (() => {
    const psi = detail.siteInfo || {};
    const siteRows = [["Gate code", psi.gateCode], ["Lockbox", psi.lockbox], ["Site contact", psi.siteContact], ["IDF / Head end", psi.idf]].filter(([, v]) => v);
    const myTasks = (detail.tasks || []).filter(t => !t.done && (!t.assignee || t.assignee === myName));
    const docs = detail.documents || [];
    const recentLogs = (detail.dailyLogs || []).slice(0, 3);
    const mapsUrl = detail.siteAddress ? `https://maps.google.com/?q=${encodeURIComponent(detail.siteAddress)}` : null;
    const telUrl = detail.contactPhone ? `tel:${detail.contactPhone.replace(/[^\d+]/g, "")}` : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => setDetailId(null)} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "9px 14px 9px 10px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.card, color: T.inkSoft, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 42 }}>‹ All projects</button>

        {/* Header */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ background: T.navy, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              {detail.jobNumber && <span style={{ fontSize: 13, fontWeight: 800, color: "#69BE28" }}>#{detail.jobNumber}</span>}
              <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 19, fontWeight: 800, color: "#fff" }}>{detail.name}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#9FB1CC", marginTop: 2 }}>{detail.customer}{detail.type ? ` · ${detail.type === "retrofit" ? "Retrofit" : "New Construction"}` : ""}</div>
          </div>
          {(mapsUrl || telUrl) && (
            <div style={{ display: "flex", gap: 8, padding: "10px 12px" }}>
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ flex: 1, minHeight: 46, borderRadius: 10, background: T.greenWash, border: `1px solid ${T.green}50`, color: T.green, fontSize: 13.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, textDecoration: "none" }}>🧭 Directions</a>}
              {telUrl && <a href={telUrl} style={{ flex: 1, minHeight: 46, borderRadius: 10, background: T.cardAlt, border: `1px solid ${T.line}`, color: T.ink, fontSize: 13.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, textDecoration: "none" }}>📞 {detail.contactName ? detail.contactName.split(" ")[0] : "Call"}</a>}
            </div>
          )}
          {detail.siteAddress && <div style={{ padding: "0 16px 12px", fontSize: 12.5, color: T.inkSoft }}>📍 {detail.siteAddress}</div>}
        </div>

        {/* Site brain */}
        {(siteRows.length > 0 || psi.parking) && (
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Site brain — tap to copy</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {siteRows.map(([label, val]) => (
                <button key={label} onClick={() => copySite(label, val)} style={{ background: copied === label ? T.greenWash : T.cardAlt, border: `1px solid ${copied === label ? T.green : T.line}`, borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", minHeight: 58 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: copied === label ? T.green : T.ink, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{copied === label ? "Copied ✓" : val}</div>
                </button>
              ))}
            </div>
            {psi.parking && <div style={{ marginTop: 8, padding: "9px 12px", borderRadius: 10, background: T.amberWash, border: `1px solid ${T.amber}30`, fontSize: 12.5, fontWeight: 600, color: T.amber }}>🚧 {psi.parking}</div>}
          </div>
        )}

        {/* Scope */}
        {detail.scopeNotes && (
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Scope of work</div>
            <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{detail.scopeNotes}</div>
          </div>
        )}

        {/* My tasks */}
        {myTasks.length > 0 && (
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Open tasks{myTasks.some(t => t.assignee === myName) ? " (yours + unassigned)" : ""}</div>
            {myTasks.map(t => (
              <button key={t.id} onClick={() => { if (onUpdateProject && confirm(`Mark done: "${t.text}"?`)) { onUpdateProject(detail.id, { tasks: detail.tasks.map(x => x.id === t.id ? { ...x, done: true } : x) }); setToast("Task checked off ✓"); } }}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "10px 4px", border: "none", borderBottom: `1px solid ${T.line}`, background: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", minHeight: 44 }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${T.lineStrong}`, flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{t.text}</div>
                  {t.assignee && <div style={{ fontSize: 11, color: t.assignee === myName ? T.green : T.inkFaint, fontWeight: 700 }}>{t.assignee === myName ? "Assigned to you" : t.assignee}</div>}
                </div>
              </button>
            ))}
            <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 8 }}>Tap a task to check it off.</div>
          </div>
        )}

        {/* Documents */}
        {docs.length > 0 && (
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Documents & drawings</div>
            {docs.map((d, i) => d.fileUrl ? (
              <a key={i} href={d.fileUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: `1px solid ${T.line}`, textDecoration: "none", minHeight: 48 }}>
                <span style={{ fontSize: 17 }}>{/pdf/i.test(d.fileName || d.name) ? "📕" : /dwg|plan|drawing/i.test(d.type || "") ? "📐" : "📄"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name || d.fileName}</div>
                  {d.type && <div style={{ fontSize: 11, color: T.inkFaint }}>{d.type}</div>}
                </div>
                <span style={{ color: T.green, fontWeight: 800, fontSize: 13 }}>Open ›</span>
              </a>
            ) : (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: `1px solid ${T.line}`, opacity: 0.6, minHeight: 48 }}>
                <span style={{ fontSize: 17 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: T.inkFaint }}>No file attached — ask the office</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent logs */}
        {recentLogs.length > 0 && (
          <div style={{ ...card, padding: "13px 16px" }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Recent daily logs</div>
            {recentLogs.map((l, i) => (
              <div key={l.id || i} style={{ padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>{l.date}</span>
                  {l.member && <span style={{ fontSize: 11.5, color: T.inkFaint }}>{l.member}</span>}
                  {l.hours > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: T.amber }}>{l.hours}h</span>}
                </div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.5, whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.activities}</div>
                {l.photos?.length > 0 && (
                  <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                    {l.photos.slice(0, 4).map((u, pi) => <a key={pi} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.line}` }} /></a>)}
                    {l.photos.length > 4 && <span style={{ fontSize: 11, color: T.inkFaint, alignSelf: "center" }}>+{l.photos.length - 4}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={() => startLog(detail.id)} style={{ width: "100%", minHeight: 52, borderRadius: 13, border: "none", background: T.green, color: "#fff", fontSize: 15.5, fontWeight: 800, fontFamily: "'Outfit',sans-serif", cursor: "pointer" }}>Log hours on this job</button>
        <div style={{ height: 4 }} />
      </div>
    );
  })();

  const ScreenProjects = detail ? ProjectDetailScreen : (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 2 }}>Projects</div>
      {activeProjects.map(p => {
        const psi = p.siteInfo || {};
        const docCount = (p.documents || []).length;
        const taskCount = (p.tasks || []).filter(t => !t.done && (!t.assignee || t.assignee === myName)).length;
        return (
          <button key={p.id} onClick={() => setDetailId(p.id)} style={{ ...card, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              {p.jobNumber && <span style={{ fontSize: 12.5, fontWeight: 800, color: T.green }}>#{p.jobNumber}</span>}
              <span style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span style={{ color: T.inkFaint, fontWeight: 800 }}>›</span>
            </div>
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 2 }}>{p.customer}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, color: T.inkFaint, fontWeight: 600, flexWrap: "wrap" }}>
              {p.siteAddress && <span>📍 {p.siteAddress.split(",")[0]}</span>}
              {docCount > 0 && <span>📄 {docCount} doc{docCount > 1 ? "s" : ""}</span>}
              {taskCount > 0 && <span style={{ color: T.amber }}>✓ {taskCount} task{taskCount > 1 ? "s" : ""}</span>}
              {psi.gateCode && <span>🔑 Gate {psi.gateCode}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );

  /* ════════ MORE ════════ */
  const ScreenMore = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 800, color: T.ink }}>More</div>
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ ...eyebrow, marginBottom: 10 }}>Display</div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(THEMES).map(([k, th]) => (
            <button key={k} onClick={() => setThemeKey(k)} style={{ flex: 1, minHeight: 64, borderRadius: 12, border: themeKey === k ? `2.5px solid ${T.green}` : `1px solid ${T.line}`, background: th.bg, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <span style={{ fontSize: 17 }}>{k === "daylight" ? "☀️" : "🌙"}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: th.ink }}>{th.name}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 8 }}>Daylight is built for direct sun. Your choice is remembered on this phone.</div>
      </div>
      <button onClick={onOpenFullApp} style={{ ...card, padding: "16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
        <span style={{ fontSize: 19 }}>⚙️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>Open full app</div>
          <div style={{ fontSize: 12, color: T.inkFaint }}>Board, timesheets, materials, everything else</div>
        </div>
        <span style={{ color: T.inkFaint }}>›</span>
      </button>
      <div style={{ fontSize: 11, color: T.inkFaint, textAlign: "center" }}>FWT Workspaces · Field Mode</div>
    </div>
  );

  const TABS = [
    { id: "today", icon: "🏠", label: "Today" },
    { id: "log", icon: "📝", label: "Log" },
    { id: "projects", icon: "🗂", label: "Projects" },
    { id: "more", icon: "•••", label: "More" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: T.navy, padding: "14px 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#4BA53C", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 13, color: "#fff" }}>FWT</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1 }}>Field Mode</div>
          <div style={{ fontSize: 10.5, color: "#8FA3C2", marginTop: 2 }}>FWT Workspaces</div>
        </div>
        <button onClick={() => setThemeKey(themeKey === "daylight" ? "office" : "daylight")} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #2A4470", background: "transparent", cursor: "pointer", fontSize: 15 }}>{themeKey === "daylight" ? "🌙" : "☀️"}</button>
      </div>

      <div style={{ flex: 1, padding: "16px 14px 100px", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {tab === "today" && ScreenToday}
        {tab === "log" && ScreenLog}
        {tab === "projects" && ScreenProjects}
        {tab === "more" && ScreenMore}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.card, borderTop: `1px solid ${T.line}`, display: "flex", paddingBottom: "max(8px, env(safe-area-inset-bottom))", zIndex: 30 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { if (t.id === "projects" && tab === "projects") setDetailId(null); setTab(t.id); if (t.id === "log" && !projectId && todaysProject) startLog(todaysProject.id); }} style={{ flex: 1, minHeight: 58, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <span style={{ fontSize: 19, filter: tab === t.id ? "none" : "grayscale(1) opacity(0.55)" }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: tab === t.id ? T.green : T.inkFaint }}>{t.label}</span>
          </button>
        ))}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 48px)", maxWidth: 440, background: T.navy, color: "#fff", borderRadius: 13, padding: "13px 16px", fontSize: 14, fontWeight: 700, zIndex: 60, boxShadow: "0 6px 24px rgba(0,0,0,0.30)", display: "flex", alignItems: "center", gap: 9, border: "1px solid #4BA53C55" }}>
          <span style={{ color: "#4BA53C", fontSize: 16 }}>●</span> {toast}
        </div>
      )}

      {crewSheet && (
        <>
          <div onClick={() => setCrewSheet(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 70 }} />
          <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 520, background: T.card, borderRadius: "18px 18px 0 0", padding: "16px 16px max(20px, env(safe-area-inset-bottom))", zIndex: 71, maxHeight: "70vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.lineStrong, margin: "0 auto 14px" }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>Add crew member</div>
            {rosterNames.filter(n => !crew.some(c => c.name === n)).map(n => (
              <button key={n} onClick={() => { setCrew([...crew, { id: genId(), name: n, allocations: [{ id: genId(), hours: 0, category: LABOR_PHASES[0]?.id || "" }] }]); setCrewSheet(false); }} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 54, padding: "0 14px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.cardAlt, cursor: "pointer", fontFamily: "inherit", marginBottom: 7, textAlign: "left" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.greenWash, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>{n[0]}</div>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: T.ink }}>{n}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
