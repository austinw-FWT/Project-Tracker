import { useState } from "react";
import { CalendarDays, X, Pencil } from "lucide-react";
import { whereWeStand } from "./whereWeStand.js";
import {
  todayIso, localIso, parseIso, mondayOf, datesInRange, assignToProject,
  unassignFromProject, projectDays, otherBookings, summarizeDates,
} from "./projectSchedule.js";

const LEVEL = { alert: "#ef4444", watch: "#f59e0b", ok: "#10b981", info: "#64748b" };
const fmtDay = s => parseIso(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const iS = { padding: "7px 10px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 12.5, fontFamily: "inherit", outline: "none", colorScheme: "dark", boxSizing: "border-box" };
const lS = { fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5, display: "block" };

/* ════════ WHERE WE STAND — top of Overview ════════ */
export function WhereWeStand({ project, phaseMap, schedule, canSeeMoney, laborPhases, onUpdate, myName, onOpenTab, isMobile }) {
  const ws = whereWeStand(project, { phaseMap, schedule, canSeeMoney, laborPhases });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const hc = LEVEL[ws.headline.level];
  const jump = { crew: "schedule", labor: "hours", billing: "invoices", open: "tasks" };

  function saveNote() {
    const text = draft.trim();
    onUpdate({ statusNote: text ? { text, by: myName || "", at: new Date().toISOString() } : null });
    setEditing(false);
  }

  return (
    <div style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 12, padding: isMobile ? 14 : 16, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Where we stand</span>
        <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: hc + "22", color: hc }}>{ws.headline.text.toUpperCase()}</span>
      </div>

      {/* Status note — the one human line */}
      {editing ? (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") setEditing(false); }}
            placeholder="e.g. Waiting on GC for ceiling access in Bldg B — rough-in resumes 10/20" style={{ ...iS, flex: 1, minWidth: 220 }} />
          <button onClick={saveNote} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
          <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={14} /></button>
        </div>
      ) : (
        <button onClick={() => { setDraft(ws.note?.text || ""); setEditing(true); }} style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left", background: "#0A192F", border: "1px dashed #1A3050", borderRadius: 8, padding: "9px 12px", marginBottom: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <Pencil size={12} style={{ color: "#64748b", marginTop: 3, flexShrink: 0 }} />
          {ws.note?.text ? (
            <span style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.45 }}>
              {ws.note.text}
              <span style={{ display: "block", fontSize: 10.5, color: "#475569", marginTop: 2 }}>
                {ws.note.by ? `${ws.note.by} · ` : ""}{new Date(ws.note.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </span>
          ) : <span style={{ fontSize: 12.5, color: "#475569" }}>Add a status note — what's happening, what we're waiting on…</span>}
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
        {ws.rows.map(r => (
          <button key={r.key} onClick={() => jump[r.key] && onOpenTab && onOpenTab(jump[r.key])}
            style={{ textAlign: "left", background: "#0A192F", border: "1px solid #13294d", borderLeft: `3px solid ${LEVEL[r.level]}`, borderRadius: 8, padding: "9px 12px", cursor: jump[r.key] ? "pointer" : "default", fontFamily: "inherit" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{r.label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: r.level === "info" ? "#e2e8f0" : LEVEL[r.level], marginTop: 2 }}>{r.value}</div>
            {r.pct !== undefined && (
              <div style={{ height: 4, borderRadius: 2, background: "#1A3050", marginTop: 5, overflow: "hidden" }}>
                <div style={{ width: `${r.pct * 100}%`, height: "100%", background: LEVEL[r.level] === LEVEL.info ? "#3b82f6" : LEVEL[r.level] }} />
              </div>
            )}
            {r.sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{r.sub}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════ SCHEDULE TAB ════════ */
export function ScheduleTab({ project, schedule, teamRoster, projects, onScheduleChange, canSchedule, isMobile }) {
  const today = todayIso();
  const startDefault = project.anticipatedStart && project.anticipatedStart > today ? project.anticipatedStart : today;
  const mon = mondayOf(parseIso(startDefault));
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  const [who, setWho] = useState([]);
  const [from, setFrom] = useState(localIso(parseIso(startDefault)));
  const [to, setTo] = useState(localIso(fri < parseIso(startDefault) ? parseIso(startDefault) : fri));
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [flash, setFlash] = useState("");

  const names = (teamRoster || []).map(t => t.name);
  const dates = datesInRange(from, to, weekdaysOnly);
  const upcoming = projectDays(schedule, project.id, today);
  const past = projectDays(schedule, project.id).filter(d => d.date < today).slice(-10).reverse();

  // preview of what "Add" will do
  const preview = assignToProject(schedule, project.id, who, dates);
  const already = who.length * dates.length - preview.added;
  const conflicts = [];
  who.forEach(n => dates.forEach(d => {
    const o = otherBookings(schedule, n, d, project.id, projects);
    if (o.length) conflicts.push({ n, d, o });
  }));

  // per-person rollup of upcoming days
  const byPerson = {};
  upcoming.forEach(({ date, names: ns }) => ns.forEach(n => { (byPerson[n] = byPerson[n] || []).push(date); }));

  function setWeek(offset) {
    const m = mondayOf(new Date(), offset);
    const f = new Date(m); f.setDate(m.getDate() + 4);
    setFrom(localIso(m)); setTo(localIso(f)); setWeekdaysOnly(true);
  }
  function add() {
    if (!who.length || !dates.length) return;
    const n = preview.added;
    onScheduleChange(cur => assignToProject(cur, project.id, who, dates));
    setFlash(`Scheduled ${who.map(x => x.split(" ")[0]).join(", ")} · ${n} day-slot${n === 1 ? "" : "s"} added — on the Team Schedule and Field Mode now`);
    setWho([]);
    setTimeout(() => setFlash(""), 4000);
  }
  function removeDays(name, ds, label) {
    if (ds.length > 1 && !confirm(`Take ${name} off this job for ${label}?`)) return;
    onScheduleChange(cur => unassignFromProject(cur, project.id, name, ds));
  }

  const chip = on => ({ padding: "6px 12px", borderRadius: 18, border: on ? "1.5px solid #69BE28" : "1px solid #1A3050", background: on ? "#69BE2822" : "transparent", color: on ? "#82CC4A" : "#94a3b8", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
  const ghost = { padding: "6px 11px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
        This writes to the same Team Schedule the crew sees in Field Mode. Changes here show up there, and vice versa.
        {project.anticipatedStart && <> Anticipated start: <strong style={{ color: "#cbd5e1" }}>{fmtDay(project.anticipatedStart)}</strong>.</>}
      </div>

      {canSchedule && (
        <div style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><CalendarDays size={15} style={{ color: "#69BE28" }} /> Schedule crew on this job</div>

          <label style={lS}>Who</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {names.map(n => <button key={n} onClick={() => setWho(who.includes(n) ? who.filter(x => x !== n) : [...who, n])} style={chip(who.includes(n))}>{n}</button>)}
            {names.length === 0 && <span style={{ fontSize: 12, color: "#475569" }}>Add people in Team first.</span>}
          </div>

          <label style={lS}>When</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} style={iS} />
            <span style={{ color: "#475569", fontSize: 12 }}>to</span>
            <input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} style={iS} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
              <input type="checkbox" checked={weekdaysOnly} onChange={e => setWeekdaysOnly(e.target.checked)} /> Weekdays only
            </label>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            <button onClick={() => setWeek(0)} style={ghost}>This week (Mon–Fri)</button>
            <button onClick={() => setWeek(1)} style={ghost}>Next week</button>
            <button onClick={() => { setFrom(today); setTo(today); }} style={ghost}>Today only</button>
            {project.anticipatedStart && project.anticipatedStart > today && (
              <button onClick={() => { const m = parseIso(project.anticipatedStart); const f = mondayOf(m); f.setDate(f.getDate() + 4); setFrom(project.anticipatedStart); setTo(localIso(f < m ? m : f)); setWeekdaysOnly(true); }} style={ghost}>Start week ({fmtDay(project.anticipatedStart)})</button>
            )}
          </div>

          {who.length > 0 && dates.length > 0 && (
            <div style={{ fontSize: 12.5, color: "#cbd5e1", background: "#0A192F", borderRadius: 8, padding: "9px 12px", marginBottom: 10, lineHeight: 1.5 }}>
              <strong>{who.join(", ")}</strong> · {dates.length} day{dates.length > 1 ? "s" : ""}: {summarizeDates(dates)}
              {already > 0 && <div style={{ color: "#64748b", fontSize: 11.5 }}>{already} already scheduled here; those will be skipped.</div>}
              {conflicts.length > 0 && (
                <div style={{ color: "#f0a93b", fontSize: 11.5, marginTop: 3 }}>
                  Also booked elsewhere: {conflicts.slice(0, 4).map(c => `${c.n.split(" ")[0]} ${fmtDay(c.d)} (${c.o.join(", ")})`).join("; ")}{conflicts.length > 4 ? ` +${conflicts.length - 4} more` : ""}. They'll be on both.
                </div>
              )}
            </div>
          )}
          {dates.length === 0 && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>No working days in that range.</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={add} disabled={!who.length || !preview.added} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 700, cursor: who.length && preview.added ? "pointer" : "default", fontFamily: "inherit", opacity: who.length && preview.added ? 1 : 0.4 }}>Add to schedule</button>
            {flash && <span style={{ fontSize: 12, color: "#82CC4A" }}>✓ {flash}</span>}
          </div>
        </div>
      )}

      {/* Crew rollup */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Scheduled from today</div>
      {Object.keys(byPerson).length === 0 && <div style={{ fontSize: 12.5, color: "#475569", padding: "14px 0" }}>No one is scheduled on this job yet.</div>}
      {Object.entries(byPerson).sort().map(([n, ds]) => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#0A192F", borderRadius: 8, border: "1px solid #13294d", marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", minWidth: 120 }}>{n}</span>
          <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{ds.length} day{ds.length > 1 ? "s" : ""} · {summarizeDates(ds)}</span>
          {canSchedule && <button onClick={() => removeDays(n, ds, "all upcoming days")} style={{ ...ghost, padding: "4px 9px", fontSize: 11 }}>Remove all</button>}
        </div>
      ))}

      {/* Day by day */}
      {upcoming.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: "18px 0 8px" }}>Day by day</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
            {upcoming.map(({ date, names: ns }) => (
              <div key={date} style={{ background: date === today ? "#69BE2810" : "#0A192F", border: `1px solid ${date === today ? "#69BE2844" : "#13294d"}`, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: date === today ? "#82CC4A" : "#94a3b8", marginBottom: 5 }}>{date === today ? "Today · " : ""}{fmtDay(date)}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {ns.map(n => (
                    <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "3px 8px", borderRadius: 6, background: "#69BE2814", color: "#82CC4A", fontWeight: 600 }}>
                      {n.split(" ")[0]}
                      {canSchedule && <button onClick={() => removeDays(n, [date])} title={`Take ${n} off this day`} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 12 }}>×</button>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setShowPast(!showPast)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>{showPast ? "Hide" : "Show"} recent past days</button>
          {showPast && past.map(({ date, names: ns }) => (
            <div key={date} style={{ fontSize: 12, color: "#64748b", padding: "4px 0" }}>{fmtDay(date)} — {ns.join(", ")}</div>
          ))}
        </div>
      )}
    </div>
  );
}
