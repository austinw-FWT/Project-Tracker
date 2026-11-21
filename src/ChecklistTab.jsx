import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, X, Lock, Zap, Check } from "lucide-react";
import { CHECK_PHASES, OWNERS, checklistState, checklistProgress, isMine } from "./checklist.js";

/**
 * Checklist tab — project completion checklist (see checklist.js).
 *
 * onSet(key, value) writes one path under project.checklist, e.g.
 *   ("items/r-photos", { done: true, by, at })   ("na/k-po", {...} | null)
 *   ("custom/x1", {...} | null)
 * One item per write, so two people ticking at once never undo each other.
 *
 * compact: the Field Mode version — bigger touch targets, field items only.
 */
export default function ChecklistTab({ project, jobRole, myName, schedule, onSet, isMobile, compact, theme }) {
  const isAdmin = jobRole === "admin";
  const [mineOnly, setMineOnly] = useState(!isAdmin);
  const [hideDone, setHideDone] = useState(false);
  const [openPhases, setOpenPhases] = useState(null);
  const states = checklistState(project, { schedule });
  const inView = s => !mineOnly || isMine(s, jobRole);
  // Counts follow the view: "My items" shows my progress, not the whole job's
  const prog = checklistProgress(states.filter(inView));
  // Start with the first phase that still has work open
  const firstOpen = CHECK_PHASES.find(ph => prog.by[ph.id] && prog.by[ph.id].done < prog.by[ph.id].total);
  const shownPhases = openPhases || new Set(firstOpen ? [firstOpen.id] : []);
  const [expanded, setExpanded] = useState(null);
  const [adding, setAdding] = useState(false);
  const T = theme || DARK;

  const visible = s => inView(s) && (!hideDone || !s.done);
  const openHolds = states.filter(s => s.hold && !s.done && !s.na && inView(s));
  const stamp = () => ({ by: myName || "", at: new Date().toISOString() });

  const toggle = s => {
    if (s.autoDone || s.na) return;
    const cur = s.rec || {};
    onSet(`items/${s.id}`, s.done ? (cur.note ? { done: false, note: cur.note } : null) : { ...cur, done: true, ...stamp() });
  };
  const saveNote = (s, note) => {
    const cur = s.rec || {};
    const clean = note.trim();
    if ((cur.note || "") === clean) return;
    onSet(`items/${s.id}`, !clean && !cur.done ? null : { ...cur, note: clean || null });
  };
  const togglePhase = id => setOpenPhases(() => { const n = new Set(shownPhases); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const pad = compact ? "14px 14px" : isMobile ? "12px 12px" : "11px 14px";
  const box = compact ? 26 : 20;

  return (
    <div data-checklist style={{ color: T.text }}>
      {/* Overall */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 220px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.sub, marginBottom: 5 }}>
            <span><strong style={{ color: T.text, fontSize: 15 }}>{prog.pct}%</strong> complete</span>
            <span>{prog.done} of {prog.total}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: T.track, overflow: "hidden" }}>
            <div style={{ width: `${prog.pct}%`, height: "100%", background: T.green }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Pill on={mineOnly} onClick={() => setMineOnly(true)} T={T}>{isAdmin ? "Field items" : "My items"}</Pill>
          <Pill on={!mineOnly} onClick={() => setMineOnly(false)} T={T}>Everything</Pill>
          <Pill on={hideDone} onClick={() => setHideDone(!hideDone)} T={T}>Hide done</Pill>
        </div>
      </div>
      {isAdmin && mineOnly && <div style={{ fontSize: 11.5, color: T.mute, marginTop: -6, marginBottom: 10 }}>Showing what the crew sees.</div>}

      {openHolds.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px", borderRadius: 9, background: "#ef444412", border: "1px solid #ef444444", marginBottom: 12, fontSize: 12.5, color: T.holdText, lineHeight: 1.5 }}>
          <Lock size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span><strong>{openHolds.length} hold point{openHolds.length > 1 ? "s" : ""} open.</strong> These are stop points — don't move past them until they're checked.</span>
        </div>
      )}
      {!(project.projectTypes || []).length && !compact && (
        <div style={{ fontSize: 12, color: T.mute, marginBottom: 10 }}>Tip: set Systems on the Overview tab to add the access, video, intrusion, cabling or network items.</div>
      )}

      {CHECK_PHASES.map(ph => {
        const items = states.filter(s => s.phase === ph.id && visible(s));
        const pg = prog.by[ph.id] || { total: 0, done: 0, holdsOpen: 0 };
        if (!items.length && (hideDone || mineOnly)) return null;
        const open = shownPhases.has(ph.id);
        const complete = pg.total > 0 && pg.done === pg.total;
        return (
          <div key={ph.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, marginBottom: 8, overflow: "hidden" }}>
            <button onClick={() => togglePhase(ph.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: pad, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              {open ? <ChevronDown size={16} style={{ color: T.mute }} /> : <ChevronRight size={16} style={{ color: T.mute }} />}
              <span style={{ fontSize: compact ? 15 : 14, fontWeight: 800, color: T.text, flex: 1 }}>{ph.label}</span>
              {pg.holdsOpen > 0 && <span title="Open hold points" style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800, color: "#ef4444" }}><Lock size={11} />{pg.holdsOpen}</span>}
              <span style={{ fontSize: 12, fontWeight: 700, color: complete ? T.green : T.sub }}>{complete ? "✓ " : ""}{pg.done}/{pg.total}</span>
            </button>
            {open && (
              <div style={{ borderTop: `1px solid ${T.line}` }}>
                {items.length === 0 && <div style={{ padding: pad, fontSize: 12.5, color: T.mute }}>Nothing here for this view.</div>}
                {items.map(s => {
                  const ex = expanded === s.id;
                  return (
                    <div key={s.id} data-item={s.id} style={{ borderBottom: `1px solid ${T.line}`, opacity: s.na ? 0.5 : 1 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: pad }}>
                        <button aria-label={`${s.done ? "Uncheck" : "Check"} ${s.text}`} onClick={() => toggle(s)} disabled={s.autoDone || s.na}
                          title={s.autoDone ? "Checked by the app from the job's data" : s.na ? "Not applicable to this job" : ""}
                          style={{ width: box, height: box, minWidth: box, borderRadius: 6, marginTop: 1, border: `2px solid ${s.done ? T.green : s.hold ? "#ef4444" : T.boxLine}`, background: s.done ? T.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: s.autoDone || s.na ? "default" : "pointer", padding: 0 }}>
                          {s.done && <Check size={box - 8} style={{ color: "#fff" }} strokeWidth={3} />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setExpanded(ex ? null : s.id)}>
                          <div style={{ fontSize: compact ? 15 : 13.5, color: s.done ? T.sub : T.text, lineHeight: 1.45, textDecoration: s.na ? "line-through" : "none" }}>{s.text}</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                            <Badge color={OWNERS[s.owner]?.color || T.mute}>{OWNERS[s.owner]?.label || s.owner}</Badge>
                            {s.hold && <Badge color="#ef4444"><Lock size={9} /> HOLD</Badge>}
                            {s.auto && <Badge color="#0ea5e9"><Zap size={9} /> AUTO</Badge>}
                            {s.system && <Badge color={T.mute}>{s.system}</Badge>}
                            {s.custom && <Badge color="#f59e0b">This job</Badge>}
                            {s.na && <Badge color={T.mute}>N/A</Badge>}
                            {s.rec && s.rec.done && s.rec.by && <span style={{ fontSize: 11, color: T.mute }}>{s.rec.by} · {fmt(s.rec.at)}</span>}
                            {s.rec && s.rec.note && !ex && <span style={{ fontSize: 11, color: T.mute }}>· 📝 note</span>}
                          </div>
                        </div>
                      </div>
                      {ex && (
                        <div style={{ padding: compact ? "0 14px 14px 50px" : "0 14px 12px 44px" }}>
                          {s.detail && <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, marginBottom: 8 }}>{s.detail}</div>}
                          {s.autoDone && <div style={{ fontSize: 12, color: "#38bdf8", marginBottom: 8 }}>Checked by the app from the job's data.</div>}
                          {s.auto && !s.autoDone && <div style={{ fontSize: 12, color: T.mute, marginBottom: 8 }}>Checks itself once this is filled in on the job.</div>}
                          <NoteBox initial={(s.rec && s.rec.note) || ""} onSave={v => saveNote(s, v)} T={T} compact={compact} />
                          {isAdmin && (
                            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              <button onClick={() => onSet(`na/${s.id}`, s.na ? null : stamp())} style={smallBtn(T)}>{s.na ? "Applies to this job" : "Not applicable"}</button>
                              {s.custom && <button onClick={() => { if (confirm("Delete this job item?")) { onSet(`custom/${s.id}`, null); onSet(`items/${s.id}`, null); } }} style={{ ...smallBtn(T), color: "#fca5a5" }}>Delete item</button>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {isAdmin && !compact && (
        adding ? <AddItem T={T} onCancel={() => setAdding(false)} onAdd={item => { onSet(`custom/c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, { ...item, ...stamp() }); setAdding(false); setOpenPhases(new Set([...shownPhases, item.phase])); }} />
          : <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: `1px dashed ${T.green}`, background: "transparent", color: T.green, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>
              <Plus size={14} /> Add a job item
            </button>
      )}
    </div>
  );
}

function AddItem({ T, onAdd, onCancel }) {
  const [text, setText] = useState(""); const [detail, setDetail] = useState("");
  const [phase, setPhase] = useState("kickoff"); const [owner, setOwner] = useState("pm"); const [hold, setHold] = useState(false);
  const inp = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.input, color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none" };
  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, padding: 14, marginTop: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Add an item to this job only</div>
      <input aria-label="Item text" value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Confirm keypad count (proposal 3, takeoff 4) with the customer" style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
      <textarea aria-label="Item detail" value={detail} onChange={e => setDetail(e.target.value)} placeholder="Details (optional)" rows={2} style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 8, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select aria-label="Item phase" value={phase} onChange={e => setPhase(e.target.value)} style={inp}>{CHECK_PHASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        <select aria-label="Item owner" value={owner} onChange={e => setOwner(e.target.value)} style={inp}>{Object.entries(OWNERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}><input type="checkbox" checked={hold} onChange={e => setHold(e.target.checked)} /> Hold point</label>
        <span style={{ flex: 1 }} />
        <button onClick={onCancel} style={smallBtn(T)}><X size={12} /> Cancel</button>
        <button disabled={!text.trim()} onClick={() => onAdd({ text: text.trim(), detail: detail.trim(), phase, owner, hold })} style={{ ...smallBtn(T), background: text.trim() ? T.green : T.line, color: "#fff", border: "none" }}>Add item</button>
      </div>
    </div>
  );
}

function NoteBox({ initial, onSave, T, compact }) {
  const [v, setV] = useState(initial);
  return <textarea aria-label="Item note" value={v} onChange={e => setV(e.target.value)} onBlur={() => onSave(v)} rows={compact ? 3 : 2}
    placeholder="Note — permit #, inspector, who witnessed it, what's blocking…"
    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.input, color: T.text, fontSize: compact ? 15 : 12.5, fontFamily: "inherit", resize: "vertical", outline: "none" }} />;
}
const Pill = ({ on, onClick, children, T }) => (
  <button onClick={onClick} style={{ padding: "6px 11px", borderRadius: 16, border: `1px solid ${on ? T.green : T.line}`, background: on ? T.green + "22" : "transparent", color: on ? T.green : T.sub, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{children}</button>
);
const Badge = ({ color, children }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 8, background: color + "22", color, letterSpacing: "0.03em" }}>{children}</span>
);
const smallBtn = T => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 11px", borderRadius: 7, border: `1px solid ${T.line}`, background: "transparent", color: T.sub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" });
const fmt = iso => { try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return ""; } };
const DARK = { text: "#e2e8f0", sub: "#94a3b8", mute: "#64748b", card: "#0F2444", line: "#1A3050", track: "#0A192F", input: "#0A192F", green: "#69BE28", boxLine: "#475569", holdText: "#fca5a5" };
export const CHECKLIST_LIGHT = { text: "#0F1E3C", sub: "#475569", mute: "#64748b", card: "#ffffff", line: "#dbe2ea", track: "#ECEEF2", input: "#f8fafc", green: "#4BA53C", boxLine: "#94a3b8", holdText: "#b91c1c" };
