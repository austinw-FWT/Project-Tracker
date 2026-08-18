import { useState, useRef } from "react";
import { FolderOpen, Check, X, AlertTriangle, FileSpreadsheet, FileText, Loader } from "lucide-react";
import { buildCandidate, candidateToProject, classifyFile, groupFilesByJob, LABOR_PHASES } from "./projectImport.js";

/**
 * ProjectImport — the review queue.
 *
 * Drop a job folder in (or several), and each folder becomes a CANDIDATE that
 * is displayed for approval before anything is created. Nothing is written to
 * the project board until you press Add.
 *
 * That review step is deliberate: a stray archive folder or a renamed copy
 * shouldn't be able to spawn a project silently, and the board feeds payroll-
 * adjacent data. Automation proposes; you decide.
 *
 * When the OneDrive scan is wired up later it produces the same candidate
 * shape and lands in this same queue — the only thing that changes is where
 * the files come from.
 */

const card = { background: "#0F2444", border: "1px solid #1A3050", borderRadius: 12 };
const money = v => (v ? "$" + Math.round(v).toLocaleString() : "—");

export default function ProjectImport({ existingProjects, onAddProject, isMobile }) {
  const [candidates, setCandidates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState(null);
  const dirRef = useRef(null);
  const fileRef = useRef(null);

  const existingJobNums = new Set((existingProjects || []).map(p => String(p.jobNumber || "").trim()).filter(Boolean));

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true); setStatus("Reading files…");

    // Group by JOB FOLDER, not by immediate parent — a job's files live in
    // subfolders (02_PIF, 01_Takeoffs, 04_Closeout) and all belong together.
    const relevant = files.filter(f => classifyFile(f.name, f.webkitRelativePath) !== "other");
    if (relevant.length === 0) { setStatus("No PIF, takeoff, proposal, or invoice files found in that selection."); setBusy(false); return; }
    const groups = groupFilesByJob(relevant);

    const found = [];
    let i = 0;
    for (const [folder, groupFiles] of groups) {
      i++; setStatus(`Parsing ${i} of ${groups.size}…`);
      try {
        const c = await buildCandidate(groupFiles);
        c.folder = folder && folder !== "__unmatched__" ? folder.split("/").pop() : "";
        c.alreadyExists = c.jobNumber && existingJobNums.has(String(c.jobNumber).trim());
        found.push(c);
      } catch (e) {
        found.push({ id: "err" + i, folder, fatal: e.message, files: groupFiles.map(f => ({ name: f.name })), warnings: [] });
      }
    }
    // Our jobs first, then everything else
    found.sort((a, b) => (b.assignedToTeam ? 1 : 0) - (a.assignedToTeam ? 1 : 0));
    setCandidates(prev => [...found, ...prev]);
    const mine = found.filter(c => c.assignedToTeam && !c.alreadyExists).length;
    setStatus(`Found ${found.length} job folder${found.length > 1 ? "s" : ""} · ${mine} new for your team`);
    setBusy(false);
  }

  function add(c) {
    onAddProject(candidateToProject(c));
    setCandidates(list => list.map(x => x.id === c.id ? { ...x, added: true } : x));
  }
  const dismiss = c => setCandidates(list => list.filter(x => x.id !== c.id));

  const pending = candidates.filter(c => !c.added);
  const mineCount = pending.filter(c => c.assignedToTeam && !c.alreadyExists && !c.fatal).length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: isMobile ? 14 : 24 }}>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px", lineHeight: 1.6 }}>
        Point this at a job folder — or a whole folder of jobs — and it reads the PIF, takeoffs, and proposal to build each project.
        Nothing is created until you press Add.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <input ref={dirRef} type="file" webkitdirectory="" directory="" multiple style={{ display: "none" }} onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
        <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.xlsm,.docx" style={{ display: "none" }} onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
        <button onClick={() => dirRef.current?.click()} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 10, border: "none", background: busy ? "#1A3050" : "#69BE28", color: busy ? "#475569" : "#fff", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>
          {busy ? <Loader size={15} /> : <FolderOpen size={15} />} {busy ? "Working…" : "Scan a Folder"}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ padding: "12px 18px", borderRadius: 10, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Pick files for one job
        </button>
        {candidates.length > 0 && (
          <button onClick={() => { setCandidates([]); setStatus(""); }} style={{ padding: "12px 18px", borderRadius: 10, border: "none", background: "transparent", color: "#475569", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}>Clear</button>
        )}
      </div>

      {status && (
        <div style={{ fontSize: 12.5, color: mineCount > 0 ? "#82CC4A" : "#64748b", marginBottom: 14, fontWeight: mineCount > 0 ? 700 : 400 }}>{status}</div>
      )}

      {pending.length === 0 && !busy && (
        <div style={{ ...card, borderStyle: "dashed", padding: "40px 24px", textAlign: "center" }}>
          <FolderOpen size={30} style={{ color: "#334155", marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Nothing in the queue</div>
          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
            Scan a folder to get started. A job folder should contain a PIF spreadsheet, one or more takeoffs, and the proposal —
            projects where the PIF names Austin, Tim, or Austim as Project Manager are flagged as yours.
          </div>
        </div>
      )}

      {candidates.map(c => {
        if (c.added) return (
          <div key={c.id} style={{ ...card, borderColor: "#69BE2855", padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <Check size={16} style={{ color: "#69BE28" }} />
            <span style={{ fontSize: 13.5, color: "#82CC4A", fontWeight: 700 }}>Added {c.jobNumber ? `#${c.jobNumber}` : ""} {c.name}</span>
          </div>
        );
        if (c.fatal) return (
          <div key={c.id} style={{ ...card, borderColor: "#7f1d1d", padding: "12px 16px", marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: "#fca5a5" }}><AlertTriangle size={13} /> Couldn't read {c.folder}: {c.fatal}</div>
            <button onClick={() => dismiss(c)} style={{ marginTop: 8, padding: "5px 12px", borderRadius: 7, border: "1px solid #1A3050", background: "transparent", color: "#64748b", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>Dismiss</button>
          </div>
        );

        const open = expanded === c.id;
        const hrs = Object.entries(c.laborHours || {});
        return (
          <div key={c.id} style={{ ...card, borderLeft: `3px solid ${c.alreadyExists ? "#64748b" : c.assignedToTeam ? "#69BE28" : "#334155"}`, padding: isMobile ? "14px" : "16px 18px", marginBottom: 10, opacity: c.assignedToTeam ? 1 : 0.72 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", marginBottom: 8 }}>
              {c.jobNumber && <span style={{ fontSize: 13, fontWeight: 800, color: "#69BE28" }}>#{c.jobNumber}</span>}
              <span style={{ fontSize: 15.5, fontWeight: 700, color: "#fff" }}>{c.name || c.folder || "Unnamed job"}</span>
              {c.projectManager && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: c.assignedToTeam ? "#69BE2822" : "#33415544", color: c.assignedToTeam ? "#82CC4A" : "#64748b" }}>PM: {c.projectManager}</span>}
              {c.alreadyExists && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "#f59e0b22", color: "#f59e0b" }}>ALREADY IN APP</span>}
              {!c.assignedToTeam && <span style={{ fontSize: 10.5, color: "#64748b" }}>not your team</span>}
            </div>

            <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 10 }}>
              {c.customer}{c.siteAddress ? ` · ${c.siteAddress}` : ""}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 8, marginBottom: 10 }}>
              {[["Contract", money(c.contractAmount)], ["Takeoff hours", c.takeoffHours ? `${c.takeoffHours}h` : "—"],
                ["Materials", c.materials?.length ? `${c.materials.length} lines` : "—"],
                ["Invoiced", c.invoicing ? `${Math.round(c.invoicing.pctInvoiced * 100)}%` : "—"],
                ["Invoices", c.invoices?.length ? `${c.invoices.length} found` : "—"]].map(([l, v]) => (
                <div key={l} style={{ background: "#0A192F", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9.5, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e2e8f0", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            {c.warnings?.length > 0 && (
              <div style={{ background: "#f59e0b0f", border: "1px solid #f59e0b33", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                {c.warnings.map((w, i) => <div key={i} style={{ fontSize: 11.5, color: "#f0a93b", lineHeight: 1.5 }}>⚠ {w}</div>)}
              </div>
            )}

            <button onClick={() => setExpanded(open ? null : c.id)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 11.5, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline", marginBottom: open ? 10 : 0 }}>
              {open ? "hide details" : `what was found (${c.files?.length || 0} files)`}
            </button>

            {open && (
              <div style={{ background: "#0A192F", borderRadius: 8, padding: "12px 14px", marginBottom: 10, fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
                <div style={{ marginBottom: 8 }}>
                  {c.files?.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {f.kind === "proposal" ? <FileText size={11} /> : <FileSpreadsheet size={11} />}
                      <span style={{ color: "#e2e8f0" }}>{f.name}</span>
                      <span style={{ color: "#475569", fontSize: 10.5 }}>{f.kind}</span>
                    </div>
                  ))}
                </div>
                {hrs.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <strong style={{ color: "#f59e0b" }}>Labor:</strong>{" "}
                    {hrs.map(([id, v]) => `${LABOR_PHASES.find(l => l.id === id)?.name || id} ${v.bid}h`).join(" · ")}
                  </div>
                )}
                {c.contacts?.length > 0 && (
                  <div style={{ marginBottom: 6 }}><strong style={{ color: "#69BE28" }}>Contacts:</strong> {c.contacts.map(ct => `${ct.name}${ct.email ? ` (${ct.email})` : ""}`).join(" · ")}</div>
                )}
                {c.invoicing?.lineItems?.length > 0 && (
                  <div style={{ marginBottom: 6 }}><strong style={{ color: "#3b82f6" }}>Schedule of values:</strong> {c.invoicing.lineItems.length} lines, {money(c.invoicing.invoicedToDate)} of {money(c.invoicing.contractTotal)} invoiced</div>
                )}
                {c.invoices?.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <strong style={{ color: "#3b82f6" }}>Invoices (closeout):</strong>
                    {c.invoices.map((iv, i) => (
                      <div key={i} style={{ paddingLeft: 12, color: "#94a3b8" }}>
                        {iv.invoiceNumber} — {iv.amount ? "$" + Number(iv.amount).toLocaleString() : "amount not readable"}
                        {iv.date ? ` · ${iv.date}` : ""}
                        <span style={{ color: "#475569", fontSize: 10.5 }}> [{iv.amountSource}]</span>
                        {iv.sourceFile ? <span style={{ color: "#475569", fontSize: 10.5 }}> · {iv.sourceFile}</span> : ""}
                      </div>
                    ))}
                  </div>
                )}
                {c.scopeNotes && (
                  <div><strong style={{ color: "#94a3b8" }}>Scope:</strong> <span style={{ color: "#64748b" }}>{c.scopeNotes.slice(0, 320)}{c.scopeNotes.length > 320 ? "…" : ""}</span></div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => add(c)} disabled={c.alreadyExists} title={c.alreadyExists ? "A project with this job number already exists" : ""}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 9, border: "none", background: c.alreadyExists ? "#1A3050" : "#69BE28", color: c.alreadyExists ? "#475569" : "#fff", fontSize: 13.5, fontWeight: 700, cursor: c.alreadyExists ? "default" : "pointer", fontFamily: "inherit" }}>
                <Check size={14} /> Add to Projects
              </button>
              <button onClick={() => dismiss(c)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 9, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <X size={14} /> Ignore
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
