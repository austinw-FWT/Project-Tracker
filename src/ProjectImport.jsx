import { useState, useRef, useEffect } from "react";
import { FolderOpen, FilePlus, Check, X, AlertTriangle, FileSpreadsheet, FileText, File as FileIcon, Image as ImageIcon, Loader, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import {
  makeEntry, setEntryUse, setEntryDocType, usesFor, parseEntries, entriesFromFolderScan,
  defaultApplyOptions, buildProjectChanges, summarizeChanges, uploadEntryDocuments,
  scopeWithExclusions, DOC_TYPES, FILE_USES, INFO_FIELDS, LABOR_PHASES,
} from "./projectImport.js";
import { genId } from "./App.jsx";

/**
 * ProjectImport — pick the files, say where each goes, review, then add.
 *
 *  1. Choose files (any folder, any number of batches — "+ Add files" keeps
 *     adding to the same job), or scan a whole folder of jobs.
 *  2. Each file gets two choices: what the app READS from it (PIF, proposal,
 *     takeoff, invoice, nothing) and whether a copy is SAVED to Documents
 *     (type + field-visible or office-only).
 *  3. "Where it goes" shows every section the files will fill — the full scope
 *     of work is editable before it's saved.
 *  4. Add as a new project, or update one that's already in the app.
 *
 * Nothing is written until the Add / Update button is pressed.
 */

const C = { card: "#0F2444", line: "#1A3050", deep: "#0A192F", green: "#69BE28", greenT: "#82CC4A", amber: "#f59e0b", text: "#e2e8f0", sub: "#94a3b8", mute: "#64748b", dim: "#475569" };
const edge = (color = C.line, left) => ({ borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}`, borderBottom: `1px solid ${color}`, borderLeft: left || `1px solid ${color}` });
const card = { background: C.card, ...edge(), borderRadius: 12 };
const sel = { padding: "6px 8px", borderRadius: 7, border: `1px solid ${C.line}`, background: C.deep, color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none" };
const money = v => (v ? "$" + Math.round(Number(v)).toLocaleString() : "—");
const phaseName = id => LABOR_PHASES.find(l => l.id === id)?.name || id;
const kb = b => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

function fileIcon(name) {
  const n = name.toLowerCase();
  if (/\.xls[xm]?$/.test(n)) return <FileSpreadsheet size={14} style={{ color: C.green }} />;
  if (/\.(jpe?g|png|heic|gif|webp)$/.test(n)) return <ImageIcon size={14} style={{ color: C.amber }} />;
  if (/\.(docx?|pdf)$/.test(n)) return <FileText size={14} style={{ color: "#3b82f6" }} />;
  return <FileIcon size={14} style={{ color: C.mute }} />;
}

function newDraft(entries, folder = "") {
  return { id: genId(), folder, entries, cand: null, parsing: true, target: null, targetTouched: false, opts: null, optsTouched: false, scopeText: "", scopeEdited: false, showSkipped: false, done: null, busy: "", error: "" };
}

export default function ProjectImport({ existingProjects, onAddProject, onUpdateProject, onOpenProject, isMobile }) {
  const [drafts, setDrafts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [scanNote, setScanNote] = useState("");
  const pickRef = useRef(null);
  const dirRef = useRef(null);
  const addRef = useRef(null);
  const addTarget = useRef(null);
  const parseSeq = useRef({});
  const projects = existingProjects || [];
  const projById = id => projects.find(p => p.id === id) || null;

  const patch = (id, fn) => setDrafts(list => list.map(d => (d.id === id ? { ...d, ...(typeof fn === "function" ? fn(d) : fn) } : d)));

  /* Re-read the files whenever a draft's entries change. A sequence number
     drops results from an older parse that finishes late. */
  async function reparse(id, entries) {
    const seq = (parseSeq.current[id] || 0) + 1;
    parseSeq.current[id] = seq;
    patch(id, { entries, parsing: true });
    let cand;
    try { cand = await parseEntries(entries); }
    catch (e) { cand = { warnings: [`Couldn't read these files: ${e.message}`], contacts: [], laborHours: {}, materials: [], invoices: [], exclusions: [], proposals: [], takeoffScopes: [], scopeText: "" }; }
    if (parseSeq.current[id] !== seq) return;
    setDrafts(list => list.map(d => {
      if (d.id !== id) return d;
      let target = d.target;
      if (!d.targetTouched) {
        const match = cand.jobNumber && projects.find(p => String(p.jobNumber || "").trim() === String(cand.jobNumber).trim());
        target = match ? match.id : "new";
      }
      const existing = target && target !== "new" ? projById(target) : null;
      return {
        ...d, cand, parsing: false, target,
        opts: d.optsTouched ? d.opts : defaultApplyOptions(cand, existing),
        scopeText: d.scopeEdited ? d.scopeText : (cand.scopeText || ""),
      };
    }));
  }

  function startDraft(files, { folder = "", fromFolderScan = false } = {}) {
    const entries = files.map(f => makeEntry(f, { fromFolderScan }));
    const d = newDraft(entries, folder);
    setDrafts(list => [d, ...list]);
    reparse(d.id, entries);
    return d.id;
  }

  function onPick(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const id = startDraft(files);
    setOpenId(id);
    setScanNote("");
  }

  function onScanFolder(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const groups = entriesFromFolderScan(files);
    const made = groups.map(g => {
      const d = newDraft(g.entries, g.folder);
      return d;
    });
    setDrafts(list => [...made, ...list]);
    made.forEach(d => reparse(d.id, d.entries));
    setOpenId(made.length === 1 ? made[0].id : null);
    setScanNote(made.length > 1 ? `Found ${made.length} job folders in that folder — open one to review it.` : "");
  }

  function addFiles(id, fileList) {
    const files = Array.from(fileList || []);
    const d = drafts.find(x => x.id === id);
    if (!files.length || !d) return;
    const have = new Set(d.entries.map(e => `${e.name}|${e.size}`));
    const fresh = files.filter(f => !have.has(`${f.name}|${f.size || 0}`)).map(f => makeEntry(f));
    if (fresh.length) reparse(id, [...d.entries, ...fresh]);
  }

  function changeEntry(id, entryId, fn, needsParse) {
    const d = drafts.find(x => x.id === id);
    if (!d) return;
    const entries = d.entries.map(e => (e.id === entryId ? fn(e) : e));
    if (needsParse) reparse(id, entries); else patch(id, { entries });
  }
  const removeEntry = (id, entryId) => {
    const d = drafts.find(x => x.id === id);
    if (d) reparse(id, d.entries.filter(e => e.id !== entryId));
  };

  function setTarget(d, target) {
    const existing = target !== "new" ? projById(target) : null;
    patch(d.id, { target, targetTouched: true, opts: d.cand ? defaultApplyOptions(d.cand, existing) : d.opts, optsTouched: false });
  }
  const setOpt = (d, k, v) => patch(d.id, { opts: { ...d.opts, [k]: v }, optsTouched: true });

  async function apply(d) {
    const isNew = d.target === "new";
    const projectId = isNew ? genId() : d.target;
    const existing = isNew ? null : projById(projectId);
    if (!isNew && !existing) { patch(d.id, { error: "That project isn't in the app anymore — pick another target." }); return; }
    let docs = [];
    const toUpload = d.entries.filter(e => e.keepDoc && e.use !== "skip");
    if (toUpload.length) {
      patch(d.id, { busy: `Uploading 1/${toUpload.length}…`, error: "" });
      try {
        docs = await uploadEntryDocuments(d.entries, projectId, (i, n, name) => patch(d.id, { busy: i < n ? `Uploading ${i + 1}/${n} — ${name}` : "Saving…" }));
      } catch (e) {
        docs = e.uploaded || [];
        patch(d.id, { busy: "" });
        if (!confirm(`${e.message}\n\nSave the project anyway with the ${docs.length} document(s) that did upload?`)) return;
      }
    }
    // Build from the freshest copy of the project so nothing someone else
    // changed while this screen was open gets overwritten.
    const latest = isNew ? null : (projById(projectId) || existing);
    const changes = buildProjectChanges(d.cand, d.opts, latest, { scopeText: d.scopeText, uploadedDocs: docs, entries: d.entries });
    if (isNew) onAddProject({ ...changes, id: projectId });
    else if (Object.keys(changes).length) onUpdateProject(projectId, changes);
    patch(d.id, { busy: "", done: { isNew, projectId, docs: docs.length, name: changes.name || latest?.name || d.cand.name, jobNumber: changes.jobNumber || latest?.jobNumber || d.cand.jobNumber, empty: !isNew && !Object.keys(changes).length } });
    setOpenId(null);
  }

  const discard = id => { setDrafts(list => list.filter(x => x.id !== id)); if (openId === id) setOpenId(null); };

  // A project deleted elsewhere while a draft targets it falls back to "new"
  useEffect(() => {
    setDrafts(list => list.map(d => (d.target && d.target !== "new" && !d.done && !projects.some(p => p.id === d.target) ? { ...d, target: "new" } : d)));
  }, [projects.length]);

  const pending = drafts.filter(d => !d.done);
  const sorted = [...drafts].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.cand?.assignedToTeam ? 1 : 0) - (a.cand?.assignedToTeam ? 1 : 0));

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: isMobile ? 14 : 24 }}>
      <p style={{ fontSize: 13, color: C.mute, margin: "0 0 16px", lineHeight: 1.6 }}>
        Choose the files for a job — from as many folders as you need — and set where each one goes.
        You'll see exactly what lands in the project before anything is saved.
      </p>

      <input ref={pickRef} type="file" multiple style={{ display: "none" }} onChange={e => { onPick(e.target.files); e.target.value = ""; }} />
      <input ref={dirRef} type="file" webkitdirectory="" directory="" multiple style={{ display: "none" }} onChange={e => { onScanFolder(e.target.files); e.target.value = ""; }} />
      <input ref={addRef} type="file" multiple style={{ display: "none" }} onChange={e => { if (addTarget.current) addFiles(addTarget.current, e.target.files); e.target.value = ""; }} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <button onClick={() => pickRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 10, border: "none", background: C.green, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <FilePlus size={15} /> Choose files
        </button>
        <button onClick={() => dirRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.sub, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <FolderOpen size={15} /> Scan a whole folder
        </button>
        {drafts.some(d => d.done) && (
          <button onClick={() => setDrafts(list => list.filter(d => !d.done))} style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: "transparent", color: C.dim, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}>Clear finished</button>
        )}
      </div>
      {scanNote && <div style={{ fontSize: 12.5, color: C.greenT, fontWeight: 700, marginBottom: 12 }}>{scanNote}</div>}

      {pending.length === 0 && !drafts.length && (
        <div style={{ ...card, borderTopStyle: "dashed", borderRightStyle: "dashed", borderBottomStyle: "dashed", borderLeftStyle: "dashed", padding: "40px 24px", textAlign: "center" }}>
          <FilePlus size={30} style={{ color: "#334155", marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: C.sub, marginBottom: 6 }}>No files chosen yet</div>
          <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6, maxWidth: 500, margin: "0 auto" }}>
            Pick the PIF, proposal, takeoffs, drawings, submittals — whatever belongs to the job. The app reads the PIF, proposal (.docx),
            takeoffs, and invoices; anything else is saved to the project's Documents. You can add more files to the same job before saving.
          </div>
        </div>
      )}

      {sorted.map(d => {
        if (d.done) return (
          <div key={d.id} style={{ ...card, ...edge(C.green + "55"), padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Check size={16} style={{ color: C.green }} />
            <span style={{ fontSize: 13.5, color: C.greenT, fontWeight: 700, flex: 1 }}>
              {d.done.empty ? "Nothing new for" : d.done.isNew ? "Added" : "Updated"} {d.done.jobNumber ? `#${d.done.jobNumber} ` : ""}{d.done.name}
              {d.done.docs ? ` · ${d.done.docs} document${d.done.docs > 1 ? "s" : ""} saved` : ""}
            </span>
            {onOpenProject && !d.done.empty && <button onClick={() => onOpenProject(d.done.projectId)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.green}`, background: "transparent", color: C.greenT, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Open project</button>}
          </div>
        );
        const open = openId === d.id;
        const c = d.cand;
        const used = d.entries.filter(e => e.use !== "skip").length;
        const title = c?.name || d.folder || d.entries[0]?.name || "New job";
        return (
          <div key={d.id} style={{ ...card, ...edge(C.line, `3px solid ${c?.assignedToTeam === false ? "#334155" : C.green}`), marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => setOpenId(open ? null : d.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: isMobile ? "13px 14px" : "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", flexWrap: "wrap" }}>
              {open ? <ChevronDown size={16} style={{ color: C.mute }} /> : <ChevronRight size={16} style={{ color: C.mute }} />}
              {c?.jobNumber && <span style={{ fontSize: 13, fontWeight: 800, color: C.green }}>#{c.jobNumber}</span>}
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{title}</span>
              {c?.projectManager && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: c.assignedToTeam ? C.green + "22" : "#33415544", color: c.assignedToTeam ? C.greenT : C.mute }}>PM: {c.projectManager}</span>}
              {d.target && d.target !== "new" && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: C.amber + "22", color: C.amber }}>ALREADY IN APP</span>}
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.mute }}>{d.parsing ? "reading…" : `${used} of ${d.entries.length} file${d.entries.length > 1 ? "s" : ""} in use`}</span>
            </button>
            {open && (
              <DraftEditor d={d} isMobile={isMobile} projects={projects} existing={d.target && d.target !== "new" ? projById(d.target) : null}
                onUse={(eid, use) => changeEntry(d.id, eid, e => setEntryUse(e, use), true)}
                onDoc={(eid, fn) => changeEntry(d.id, eid, fn, false)}
                onRemove={eid => removeEntry(d.id, eid)}
                onAddFiles={() => { addTarget.current = d.id; addRef.current?.click(); }}
                onTarget={t => setTarget(d, t)}
                onOpt={(k, v) => setOpt(d, k, v)}
                onScope={text => patch(d.id, { scopeText: text, scopeEdited: true })}
                onResetScope={() => patch(d.id, { scopeText: d.cand?.scopeText || "", scopeEdited: false })}
                onToggleSkipped={() => patch(d.id, { showSkipped: !d.showSkipped })}
                onApply={() => apply(d)}
                onDiscard={() => discard(d.id)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── One job's review ─────────────────────────────────────────── */
function DraftEditor({ d, isMobile, projects, existing, onUse, onDoc, onRemove, onAddFiles, onTarget, onOpt, onScope, onResetScope, onToggleSkipped, onApply, onDiscard }) {
  const c = d.cand;
  const o = d.opts || {};
  const isNew = d.target === "new" || !existing;
  const shown = d.entries.filter(e => e.use !== "skip" || d.showSkipped);
  const skipped = d.entries.filter(e => e.use === "skip").length;
  const summary = c ? summarizeChanges(c, o, existing, d.scopeText) : null;
  const docEntries = d.entries.filter(e => e.keepDoc && e.use !== "skip");
  const hours = Object.entries(c?.laborHours || {});
  const busy = !!d.busy || d.parsing;
  const finalScope = scopeWithExclusions(d.scopeText, o.exclusions ? c?.exclusions : []);
  const sortedProjects = [...projects].sort((a, b) => String(b.jobNumber || "").localeCompare(String(a.jobNumber || "")) || String(a.name || "").localeCompare(String(b.name || "")));

  return (
    <div style={{ padding: isMobile ? "0 14px 14px" : "0 18px 18px" }}>
      {/* Target */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>Save to</span>
        <select aria-label="Save to" value={d.target || "new"} onChange={e => onTarget(e.target.value)} style={{ ...sel, fontSize: 13, padding: "8px 10px", minWidth: isMobile ? "100%" : 320 }}>
          <option value="new">New project</option>
          {sortedProjects.map(p => <option key={p.id} value={p.id}>{p.jobNumber ? `#${p.jobNumber} — ` : ""}{p.name || "Untitled"}</option>)}
        </select>
        {!isNew && <span style={{ fontSize: 11.5, color: C.amber }}>Updating an existing project — only the sections you tick below change.</span>}
      </div>

      {/* Files */}
      <Section title="Files" note="What the app reads from each file, and whether a copy is saved to the project's Documents.">
        {shown.map(e => (
          <FileRow key={e.id} e={e} isMobile={isMobile} onUse={u => onUse(e.id, u)} onDoc={fn => onDoc(e.id, fn)} onRemove={() => onRemove(e.id)} />
        ))}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <button onClick={onAddFiles} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.green}`, background: C.green + "18", color: C.greenT, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <FilePlus size={13} /> Add files
          </button>
          {skipped > 0 && (
            <button onClick={onToggleSkipped} style={{ background: "none", border: "none", color: C.mute, fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", padding: 0 }}>
              {d.showSkipped ? "Hide" : "Show"} {skipped} file{skipped > 1 ? "s" : ""} not being imported
            </button>
          )}
        </div>
      </Section>

      {d.parsing && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.sub, margin: "6px 0 14px" }}><Loader size={14} /> Reading files…</div>}

      {c && !d.parsing && (<>
        <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 800, margin: "18px 0 8px" }}>Where it goes</div>

        {/* Job info */}
        {INFO_FIELDS.some(([k]) => c[k]) && (
          <Section title="Job info" lands="Overview" control={!isNew && (
            <select aria-label="Job info" value={o.info} onChange={e => onOpt("info", e.target.value)} style={sel}>
              <option value="blanks">Fill blank fields only</option>
              <option value="all">Overwrite with the file values</option>
              <option value="none">Don't change</option>
            </select>
          )}>
            {isNew ? (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "4px 18px", fontSize: 12.5 }}>
                {INFO_FIELDS.filter(([k]) => c[k]).map(([k, l]) => (
                  <div key={k}><span style={{ color: C.mute }}>{l}: </span><span style={{ color: C.text }}>{k.endsWith("Amount") ? money(c[k]) : String(c[k])}</span></div>
                ))}
                {c.contacts?.length > 0 && <div style={{ gridColumn: "1 / -1" }}><span style={{ color: C.mute }}>Contacts: </span><span style={{ color: C.text }}>{c.contacts.map(x => x.name + (x.email ? ` (${x.email})` : "")).join(" · ")}</span></div>}
              </div>
            ) : o.info === "none" ? <Muted>No changes to job info.</Muted> : (summary.info.length || summary.newContacts) ? (
              <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                {summary.info.map(x => (
                  <div key={x.key}><span style={{ color: C.mute }}>{x.label}: </span>{x.from ? <><span style={{ color: C.dim, textDecoration: "line-through" }}>{String(x.from)}</span> → </> : null}<span style={{ color: C.text }}>{x.key.endsWith("Amount") ? money(x.to) : String(x.to)}</span></div>
                ))}
                {summary.newContacts > 0 && <div style={{ color: C.text }}>+ {summary.newContacts} new contact{summary.newContacts > 1 ? "s" : ""}</div>}
              </div>
            ) : <Muted>Already filled in — nothing to change.</Muted>}
          </Section>
        )}

        {/* Scope */}
        <Section title="Scope of work" lands="Overview › Scope Notes · the field crew reads this" control={!isNew && (
          <select aria-label="Scope mode" value={o.scope} onChange={e => onOpt("scope", e.target.value)} style={sel}>
            <option value="replace">Replace the current scope</option>
            <option value="append">Add below the current scope</option>
            <option value="keep">Don't change</option>
          </select>
        )}>
          {!isNew && o.scope === "keep" ? <Muted>Keeping the project's current scope ({String(existing?.scopeNotes || "").length.toLocaleString()} characters).</Muted> : (<>
            <div style={{ fontSize: 11.5, color: C.mute, marginBottom: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span>{c.scopeSource ? `From ${c.scopeSource}` : "No proposal selected — set a Word proposal to \"Proposal\" to pull the scope, or type it here."}</span>
              <span>{d.scopeText.length.toLocaleString()} characters</span>
              {d.scopeEdited && c.scopeText && <button onClick={onResetScope} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.greenT, fontSize: 11.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}><RotateCcw size={11} /> Back to the proposal text</button>}
            </div>
            <textarea aria-label="Scope of work" value={d.scopeText} onChange={e => onScope(e.target.value)} rows={isMobile ? 12 : 16}
              placeholder="Scope of work…"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.deep, color: C.text, fontSize: 12.5, lineHeight: 1.55, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", resize: "vertical", outline: "none", whiteSpace: "pre-wrap" }} />
            {c.exclusions?.length > 0 && (
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, fontSize: 12.5, color: C.text, cursor: "pointer" }}>
                <input type="checkbox" checked={!!o.exclusions} onChange={e => onOpt("exclusions", e.target.checked)} style={{ marginTop: 2 }} />
                <span>List the {c.exclusions.length} checked exclusions under the scope <span style={{ color: C.mute }}>("Not included"), so the crew knows what's by others</span>
                  <details style={{ marginTop: 4 }}><summary style={{ color: C.mute, fontSize: 11.5, cursor: "pointer" }}>see them</summary>
                    <div style={{ color: C.sub, fontSize: 11.5, lineHeight: 1.6, marginTop: 4 }}>{c.exclusions.map((x, i) => <div key={i}>• {x}</div>)}</div>
                  </details>
                </span>
              </label>
            )}
            {!isNew && o.scope === "append" && <Muted>The current scope stays; this goes underneath it.</Muted>}
            {!finalScope.trim() && <Muted>Nothing will be written to Scope Notes.</Muted>}
          </>)}
        </Section>

        {/* Hours */}
        {hours.length > 0 && (
          <Section title="Bid hours" lands="Hours tab" check={{ checked: !!o.hours, onChange: v => onOpt("hours", v), label: isNew ? "Set bid hours from the takeoffs" : "Replace these phases' bid hours" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", opacity: o.hours ? 1 : 0.45 }}>
              {hours.map(([id, v]) => {
                const cur = parseFloat(existing?.laborHours?.[id]?.bid) || 0;
                return <span key={id} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 14, background: C.deep, color: C.text }}>{phaseName(id)} {!isNew && cur ? <><span style={{ color: C.dim, textDecoration: "line-through" }}>{cur}h</span> → </> : null}<strong>{v.bid}h</strong></span>;
              })}
            </div>
            <Muted>{c.takeoffHours}h total from {c.takeoffScopes.length} takeoff{c.takeoffScopes.length > 1 ? "s" : ""}{c.pifBidHours ? ` · PIF says ${c.pifBidHours}h` : ""}. Approved change order hours are added on top automatically.</Muted>
          </Section>
        )}

        {/* Materials */}
        {c.materials?.length > 0 && (
          <Section title="Materials" lands="Materials tab" check={{ checked: !!o.materials, onChange: v => onOpt("materials", v), label: isNew ? `Add ${c.materials.length} material lines` : `Add ${summary.materialsAdded} new material line${summary.materialsAdded === 1 ? "" : "s"}` }}>
            <Muted>{c.takeoffScopes.map(t => `${t.scope || t.file}: ${t.items} lines`).join(" · ")}{!isNew && summary.materialsDup > 0 ? ` · ${summary.materialsDup} already on the project (skipped)` : ""}</Muted>
          </Section>
        )}

        {/* Invoices */}
        {(c.invoices?.length > 0 || c.invoicing) && (
          <Section title="Invoices" lands="Invoices tab">
            {c.invoices?.length > 0 && (<>
              <Check2 checked={!!o.invoices} onChange={v => onOpt("invoices", v)} label={isNew ? `Add ${c.invoices.length} invoice${c.invoices.length > 1 ? "s" : ""}` : `Add ${summary.invoicesAdded} new invoice${summary.invoicesAdded === 1 ? "" : "s"}${summary.invoicesDup ? ` (${summary.invoicesDup} already recorded)` : ""}`} />
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, margin: "4px 0 8px 24px", opacity: o.invoices ? 1 : 0.45 }}>
                {c.invoices.map((iv, i) => <div key={i}>{iv.invoiceNumber} — {iv.amount ? money(iv.amount) : "amount not readable"}{iv.date ? ` · ${iv.date}` : ""}{iv.sourceFile ? <span style={{ color: C.dim }}> · {iv.sourceFile}</span> : ""}</div>)}
              </div>
            </>)}
            {c.invoicing && <Check2 checked={!!o.sov} onChange={v => onOpt("sov", v)} label={`Update invoice progress from the PIF (${money(c.invoicing.invoicedToDate)} of ${money(c.invoicing.contractTotal)} billed)`} />}
          </Section>
        )}

        {/* Documents */}
        <Section title="Documents" lands="Docs tab">
          {docEntries.length ? (
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.7 }}>
              {docEntries.map(e => <div key={e.id}>{e.restricted ? "🔒" : "👷"} {e.name} <span style={{ color: C.mute }}>· {DOC_TYPES.find(t => t.id === e.docType)?.label || e.docType}</span></div>)}
              <Muted>👷 the field crew can open it · 🔒 office only (admins and foremen)</Muted>
            </div>
          ) : <Muted>No files are set to save a copy.</Muted>}
        </Section>

        {c.warnings?.length > 0 && (
          <div style={{ background: C.amber + "0f", border: `1px solid ${C.amber}33`, borderRadius: 8, padding: "8px 12px", margin: "4px 0 12px" }}>
            {c.warnings.map((w, i) => <div key={i} style={{ fontSize: 11.5, color: "#f0a93b", lineHeight: 1.5 }}>⚠ {w}</div>)}
          </div>
        )}
      </>)}

      {d.error && <div style={{ fontSize: 12.5, color: "#fca5a5", margin: "6px 0 10px" }}><AlertTriangle size={13} /> {d.error}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
        <button onClick={onApply} disabled={busy || !c} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 22px", borderRadius: 9, border: "none", background: busy || !c ? C.line : C.green, color: busy || !c ? C.dim : "#fff", fontSize: 13.5, fontWeight: 700, cursor: busy || !c ? "default" : "pointer", fontFamily: "inherit" }}>
          <Check size={14} /> {d.busy ? "Saving…" : isNew ? "Add project" : `Update ${existing?.jobNumber ? "#" + existing.jobNumber : "project"}`}
        </button>
        {d.busy && <span style={{ fontSize: 11.5, color: C.greenT, fontWeight: 600 }}>{d.busy}</span>}
        <button onClick={onDiscard} disabled={!!d.busy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 16px", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.sub, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <X size={14} /> Discard
        </button>
      </div>
    </div>
  );
}

function FileRow({ e, isMobile, onUse, onDoc, onRemove }) {
  const uses = usesFor(e.name);
  const off = e.use === "skip";
  return (
    <div data-file={e.name} style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.line}`, flexWrap: isMobile ? "wrap" : "nowrap", opacity: off ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flex: isMobile ? "1 1 100%" : "1 1 auto", minWidth: 0 }}>
        {fileIcon(e.name)}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.path || e.name}>{e.name}</div>
          <div style={{ fontSize: 10.5, color: C.dim }}>{e.subfolder ? `${e.subfolder} · ` : ""}{kb(e.size)}</div>
        </div>
      </div>
      <select aria-label={`Use ${e.name} as`} value={e.use} onChange={ev => onUse(ev.target.value)} style={{ ...sel, width: isMobile ? "auto" : 150, flexShrink: 0 }} title={FILE_USES.find(u => u.id === e.use)?.lands || ""}>
        {uses.map(u => <option key={u.id} value={u.id}>{u.id === "doc" || u.id === "skip" ? u.label : `Read as ${u.label}`}</option>)}
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: off ? C.dim : C.sub, flexShrink: 0, cursor: off ? "default" : "pointer" }} title="Save a copy in the project's Documents">
        <input type="checkbox" aria-label={`Save ${e.name} to Documents`} disabled={off || e.use === "doc"} checked={!off && (e.keepDoc || e.use === "doc")} onChange={ev => onDoc(x => ({ ...x, keepDoc: ev.target.checked }))} />
        Docs
      </label>
      <select aria-label={`Document type for ${e.name}`} disabled={off || !(e.keepDoc || e.use === "doc")} value={e.docType} onChange={ev => onDoc(x => setEntryDocType(x, ev.target.value))} style={{ ...sel, width: 112, flexShrink: 0, opacity: off || !(e.keepDoc || e.use === "doc") ? 0.4 : 1 }}>
        {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <button aria-label={`Visibility for ${e.name}`} disabled={off || !(e.keepDoc || e.use === "doc")} onClick={() => onDoc(x => ({ ...x, restricted: !x.restricted }))}
        title={e.restricted ? "Office only — tap to let the field crew see it" : "Field crew can see it — tap to make it office only"}
        style={{ ...sel, padding: "5px 8px", width: 84, textAlign: "center", cursor: "pointer", flexShrink: 0, color: e.restricted ? C.amber : C.greenT, opacity: off || !(e.keepDoc || e.use === "doc") ? 0.4 : 1, whiteSpace: "nowrap" }}>
        {e.restricted ? "🔒 Office" : "👷 Field"}
      </button>
      <button aria-label={`Remove ${e.name}`} onClick={onRemove} title="Remove from this import" style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", padding: 4, flexShrink: 0 }}><X size={13} /></button>
    </div>
  );
}

function Section({ title, lands, note, control, check, children }) {
  return (
    <div style={{ background: C.deep, borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{title}</span>
        {lands && <span style={{ fontSize: 11, color: C.greenT }}>→ {lands}</span>}
        {control && <span style={{ marginLeft: "auto" }}>{control}</span>}
      </div>
      {note && <div style={{ fontSize: 11.5, color: C.mute, marginBottom: 6 }}>{note}</div>}
      {check && <div style={{ marginBottom: 6 }}><Check2 {...check} /></div>}
      {children}
    </div>
  );
}
function Check2({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.text, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  );
}
const Muted = ({ children }) => <div style={{ fontSize: 11.5, color: C.mute, marginTop: 5, lineHeight: 1.5 }}>{children}</div>;
