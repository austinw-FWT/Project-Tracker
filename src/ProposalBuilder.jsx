import { useState } from "react";
import { Plus, X, Printer, ChevronDown, ChevronUp, FileText, Calculator, Download } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType, PageBreak, ShadingType, VerticalAlign, LevelFormat, PageNumber } from "docx";
import { FWT_CIRCULAR_LOGO_B64, FWT_TEXT_LOGO_B64, FWT_GRADIENT_BAR_B64, FWT_NBS_TEXT_B64, FWT_SIG_B64 } from "./fwtImages";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const n = v => parseFloat(v) || 0;

function b64ToUint8(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

const DEFAULT_EXCLUSIONS = [
  "Power circuits for customer provided/installed equipment",
  "Power poles, basket trays, surface mount raceways, underfloor raceways, and floor monuments",
  "Conduits, mud rings, back boxes, string within conduits and walls",
  "Sleeves between floors, sleeves within fire-rated walls, floor penetrations, and envelope penetrations",
  "Purchase and installation of patch cords for voice and data networks",
  "Telephone, Internet, and Cable TV services",
  "IT support services and/or network equipment for telephone, LAN, WAN, and CATV networks",
  "Fire-rated plywood backerboard",
  "Gates, gate operators, and overhead roll-up doors",
  "Vehicle detection loops, safety photo-eyes, and other vehicle detection devices",
  "Electronic door locking hardware, sliding doors, and associated door hardware",
  "Elevator travelling cable with adequate conductors, elevator machine room connections and terminations, and elevator cab device installations",
  "Integration with Fire Alarm and/or other life safety systems",
  "General Contractor related work, such as framing, painting, patching, roofing, scaffolding, etc.",
  "Demolition of any kind",
  "Hazardous material identification, abatement, or removal",
  "Trash removal from site",
];

const DEFAULT_TERMS = [
  "50% down payment is required before work can begin.",
  "All work to be performed during normal business hours Monday through Friday 7:00am \u2013 4:00pm",
  "FAR West Technologies (FWT) will provide a project warranty for a period of (1) year unless noted otherwise. The warranty period will begin after the agreed upon completion date. FWT and manufacturer extended warranties are available upon request.",
  "Upon completion of Scope of Work(s) pursuant to the terms of this agreement, customer shall pay to FWT the contract price within 30 days of date shown on invoice, or, in the event of a progress invoice, the completed portion of the Scope of Work(s) as indicated on the progress invoice within 30 days of date shown on the progress invoice. Progress invoice(s) include any costs to date incurred by FWT including labor and/or materials required to complete Scope of Work(s).",
  "Any alterations from the above listed scope of work will result in a change order. All change order materials will be purchased and installed after written approval of the change order is received by FWT.",
  "Customer to provide all necessary keys, badging, and/or personnel needed to gain access throughout customer premises",
  "Customer shall provide (1) host Workstation/Server PC meeting the minimum requirements for system software. FWT will provide minimum requirements documentation for each software suite.",
  "FWT will provide (1) 2-hour end-user training session upon project completion. Please have all required personnel available at the scheduled time. Additional training sessions can be provided for an additional charge.",
  "NETWORK_TERM",
  "FWT will not honor the warranty of any cabling that has been painted. Painting cabling installed by FWT will void all FWT warranties for the cabling. FWT shall not be held responsible for costs associated with replacing painted cabling due to failed inspections.",
  "Existing devices and/or cabling will be reused or repurposed within new systems. Existing devices and/or cabling have not been tested for operation, compatibility, or reliability and are not covered under FWT warranties. Any existing devices and/or cabling that require replacement, repair, or adjustment are not covered within the scope of work and are subject to additional charges.",
  "Software hosting fees will be invoiced as part of a separate contract. FWT Full-Service Protection Plans include this fee as well as parts and labor for regular service of the systems included within this proposal. Pricing available upon request.",
  "When audio surveillance or recording is used, state and federal regulations apply. Refer to Title 18, section 2510 of US Codes. Washington is a \u201Ctwo-party consent\u201D state in which special regulations apply. Customer should consult legal advice as to their rights and liabilities.",
  "The National Electrical Code (NEC) requires abandoned wire and cable to be removed or marked as \u201Cspare\u201D for future use. Formal requirements regarding abandoned wire and cable are determined by the Electrical Inspector. Removal of abandoned wire and cabling is not included within this proposal and is subject to additional charges.",
  "Burglary alarm systems utilizing central station monitoring must have a completed call list to enable emergency dispatch procedures. Central Station monitoring fees will be invoiced as part of a separate contract. Customer must complete call list to activate central station monitoring.",
  "In the event of any default on the part of the Customer including but not limited to failure to make any progress payment or final payment, FWT reserves the right to temporarily disable any equipment or systems installed as part of this proposal, until such time as payments have been received. Delinquent payments are subject to interest at the rate of 1-1/2% per month from the date of delinquency or the maximum lawful rate. Disabling or removing any equipment or systems as herein above set forth shall not be considered to constitute a breach by FWT of this agreement or waiver of FWT to any damages nor shall be considered fulfillment of payment.",
];

const DEFAULT_LABOR_ROWS = [
  { id: "lr", desc: "LABOR - ROUGH IN", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },
  { id: "lt", desc: "LABOR - TRIM", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },
  { id: "lh", desc: "LABOR - HEAD END", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },
  { id: "lp", desc: "LABOR - PROGRAMMING", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },
  { id: "lm", desc: "LABOR - PROJECT MGT", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },
  { id: "lv", desc: "LABOR - TRAVEL", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },
];
const DEFAULT_COST_ROWS = [
  { id: "cp", manf: "FWT", partNum: "FWT", desc: "PERMIT ALLOWANCE", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true },
  { id: "cr", manf: "FWT", partNum: "FWT", desc: "RENTAL EQUIPMENT", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true },
  { id: "cd", manf: "FWT", partNum: "FWT", desc: "PER DIEM PER TECH", qty: 0, unit: "DAY", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true },
  { id: "cs", manf: "FWT", partNum: "FWT", desc: "VENDOR SHIPPING ALLOWANCE", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true },
];
const DEFAULT_RMR_ROWS = [
  { id: "r1", manf: "FWT", partNum: "FWT-RMR", desc: "", qty: 1, unit: "MO", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isRmr: true },
];

function emptyMaterialRow() { return { id: genId(), manf: "", partNum: "", desc: "", qty: 0, unit: "EA", costPU: 0, markupPct: 25, pricePU: 0, laborHrs: 0, laborRate: 0 }; }

const iS = { width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" };
const nS = { ...iS, textAlign: "right" };

/* ═══════════════════════════════════════
   TAKEOFF BUILDER  (unchanged)
   ═══════════════════════════════════════ */
export function TakeoffBuilder({ takeoff, onSave }) {
  const data = takeoff || { materials: Array(5).fill(null).map(() => emptyMaterialRow()), labor: DEFAULT_LABOR_ROWS.map(r => ({ ...r, id: genId() })), costs: DEFAULT_COST_ROWS.map(r => ({ ...r, id: genId() })), rmr: DEFAULT_RMR_ROWS.map(r => ({ ...r, id: genId() })), overheadPct: 0, notes: "" };
  const [materials, setMaterials] = useState(data.materials);
  const [labor, setLabor] = useState(data.labor);
  const [costs, setCosts] = useState(data.costs);
  const [rmr, setRmr] = useState(data.rmr);
  const [overheadPct, setOverheadPct] = useState(data.overheadPct || 0);
  const [notes, setNotes] = useState(data.notes || "");
  function save(m, l, c, r, oh, nt) { onSave({ materials: m || materials, labor: l || labor, costs: c || costs, rmr: r || rmr, overheadPct: oh !== undefined ? oh : overheadPct, notes: nt !== undefined ? nt : notes }); }
  function updRow(arr, setArr, idx, field, val, section) {
    const updated = arr.map((r, i) => { if (i !== idx) return r; const row = { ...r, [field]: field === "desc" || field === "manf" || field === "partNum" || field === "unit" ? val : parseFloat(val) || 0 }; if (field === "costPU" || field === "markupPct") { const cost = field === "costPU" ? (parseFloat(val) || 0) : n(row.costPU); const markup = field === "markupPct" ? (parseFloat(val) || 0) : n(row.markupPct); row.pricePU = Math.round(cost * (1 + markup / 100) * 100) / 100; } return row; });
    setArr(updated);
    if (section === "materials") save(updated, null, null, null); else if (section === "costs") save(null, null, updated, null); else if (section === "rmr") save(null, null, null, updated);
  }
  function updLaborRow(idx, field, val) { const updated = labor.map((r, i) => i === idx ? { ...r, [field]: field === "desc" ? val : parseFloat(val) || 0 } : r); setLabor(updated); save(null, updated, null, null); }
  function addLaborRow() { const updated = [...labor, { id: genId(), desc: "", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true }]; setLabor(updated); save(null, updated, null, null); }
  function removeLaborRow(idx) { const updated = labor.filter((_, i) => i !== idx); setLabor(updated); save(null, updated, null, null); }
  function addRow(arr, setArr, template, section) { const updated = [...arr, template()]; setArr(updated); if (section === "materials") save(updated, null, null, null); else if (section === "costs") save(null, null, updated, null); else if (section === "rmr") save(null, null, null, updated); }
  function removeRow(arr, setArr, idx, section) { const updated = arr.filter((_, i) => i !== idx); setArr(updated); if (section === "materials") save(updated, null, null, null); else if (section === "costs") save(null, null, updated, null); else if (section === "rmr") save(null, null, null, updated); }
  const matTotal = materials.reduce((s, r) => s + (n(r.qty) * n(r.pricePU)) + (n(r.laborHrs) * n(r.laborRate)), 0);
  const laborPrice = labor.reduce((s, r) => s + (n(r.hours) * n(r.ratePerHr)), 0);
  const laborCostTotal = labor.reduce((s, r) => s + (n(r.hours) * n(r.costPerHr)), 0);
  const totalLaborHrs = labor.reduce((s, r) => s + n(r.hours), 0);
  const costTotal = costs.reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
  const rmrTotal = rmr.reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
  const subtotal = matTotal + laborPrice + costTotal + rmrTotal;
  const overhead = subtotal * (n(overheadPct) / 100);
  const grandTotal = subtotal + overhead;
  const matCost = materials.reduce((s, r) => s + (n(r.qty) * n(r.costPU)), 0);
  const costsCost = costs.reduce((s, r) => s + (n(r.qty) * n(r.costPU)), 0);
  const totalCost = matCost + laborCostTotal + costsCost;
  const margin = grandTotal > 0 ? Math.round(((grandTotal - totalCost) / grandTotal) * 100) : 0;
  function renderSection(title, color, rows, setRows, section, addFn, hideMarkup) {
    return (<div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      {rows.map((row, idx) => (<div key={row.id} style={{ display: "grid", gridTemplateColumns: hideMarkup ? "80px 90px 1fr 50px 40px 80px 80px 80px 50px 60px 80px 24px" : "80px 90px 1fr 50px 40px 80px 55px 80px 80px 50px 60px 80px 24px", gap: 4, marginBottom: 3, alignItems: "center" }}>
        <input style={iS} value={row.manf} onChange={e => updRow(rows, setRows, idx, "manf", e.target.value, section)} placeholder="Manf" />
        <input style={iS} value={row.partNum} onChange={e => updRow(rows, setRows, idx, "partNum", e.target.value, section)} placeholder="Part #" />
        <input style={iS} value={row.desc} onChange={e => updRow(rows, setRows, idx, "desc", e.target.value, section)} placeholder="Description" />
        <input type="number" style={nS} value={row.qty || ""} onChange={e => updRow(rows, setRows, idx, "qty", e.target.value, section)} placeholder="0" />
        <input style={iS} value={row.unit} onChange={e => updRow(rows, setRows, idx, "unit", e.target.value, section)} placeholder="EA" />
        <input type="number" step="0.01" style={nS} value={row.costPU || ""} onChange={e => updRow(rows, setRows, idx, "costPU", e.target.value, section)} placeholder="Cost" />
        {!hideMarkup && <input type="number" step="1" style={{ ...nS, color: "#f59e0b" }} value={row.markupPct ?? ""} onChange={e => updRow(rows, setRows, idx, "markupPct", e.target.value, section)} placeholder="%" />}
        {hideMarkup ? (<input type="number" step="0.01" style={nS} value={row.pricePU || ""} onChange={e => updRow(rows, setRows, idx, "pricePU", e.target.value, section)} placeholder="Rate" />) : (<div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${n(row.pricePU).toFixed(2)}</div>)}
        <div style={{ fontSize: 12, color: "#e2e8f0", textAlign: "right", fontWeight: 600 }}>${(n(row.qty) * n(row.pricePU)).toFixed(2)}</div>
        <input type="number" step="0.5" style={nS} value={row.laborHrs || ""} onChange={e => updRow(rows, setRows, idx, "laborHrs", e.target.value, section)} placeholder="Hrs" />
        <input type="number" step="0.01" style={nS} value={row.laborRate || ""} onChange={e => updRow(rows, setRows, idx, "laborRate", e.target.value, section)} placeholder="Rate" />
        <div style={{ fontSize: 12, color: "#f59e0b", textAlign: "right", fontWeight: 600 }}>${(n(row.laborHrs) * n(row.laborRate)).toFixed(2)}</div>
        <button onClick={() => removeRow(rows, setRows, idx, section)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
      </div>))}
      <button onClick={() => addFn()} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "4px 0" }}><Plus size={12} /> Add Row</button>
    </div>);
  }
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
      <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #6366f1" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Material Price</div><div style={{ fontSize: 18, fontWeight: 700, color: "#6366f1", fontFamily: "'Outfit',sans-serif" }}>${matTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
      <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #f59e0b" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Labor ({totalLaborHrs}h)</div><div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", fontFamily: "'Outfit',sans-serif" }}>${laborPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
      <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #10b981" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Total Cost</div><div style={{ fontSize: 18, fontWeight: 700, color: "#10b981", fontFamily: "'Outfit',sans-serif" }}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
      <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #3b82f6" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Quoted Price</div><div style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6", fontFamily: "'Outfit',sans-serif" }}>${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
      <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444"}` }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Margin</div><div style={{ fontSize: 18, fontWeight: 700, color: margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444", fontFamily: "'Outfit',sans-serif" }}>{margin}%</div></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 50px 40px 80px 55px 80px 80px 50px 60px 80px 24px", gap: 4, marginBottom: 8, padding: "0 0 6px", borderBottom: "1px solid #1e293b" }}>
      {["Manf", "Part #", "Description", "Qty", "Unit", "Cost/U", "Mkup%", "Price/U", "Ext Price", "Hrs", "Rate", "Ext Labor", ""].map(h => (<div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</div>))}
    </div>
    {renderSection("Materials", "#6366f1", materials, setMaterials, "materials", () => addRow(materials, setMaterials, emptyMaterialRow, "materials"))}
    <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>FWT Labor</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginBottom: 6, padding: "0 0 6px", borderBottom: "1px solid #1e293b" }}>{["Description", "Hours", "Cost/Hr", "Labor Cost", "Rate/Hr", "Labor Price", ""].map(h => (<div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</div>))}</div>
      {labor.map((row, idx) => (<div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginBottom: 3, alignItems: "center" }}>
        <input style={iS} value={row.desc} onChange={e => updLaborRow(idx, "desc", e.target.value)} placeholder="Labor description" />
        <input type="number" step="0.5" style={nS} value={row.hours || ""} onChange={e => updLaborRow(idx, "hours", e.target.value)} placeholder="0" />
        <input type="number" step="0.01" style={nS} value={row.costPerHr || ""} onChange={e => updLaborRow(idx, "costPerHr", e.target.value)} placeholder="$/hr" />
        <div style={{ fontSize: 12, color: "#ef4444", textAlign: "right", fontWeight: 600 }}>${(n(row.hours) * n(row.costPerHr)).toFixed(2)}</div>
        <input type="number" step="0.01" style={nS} value={row.ratePerHr || ""} onChange={e => updLaborRow(idx, "ratePerHr", e.target.value)} placeholder="$/hr" />
        <div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${(n(row.hours) * n(row.ratePerHr)).toFixed(2)}</div>
        <button onClick={() => removeLaborRow(idx)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
      </div>))}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginTop: 6, padding: "8px 0 0", borderTop: "1px solid #1e293b" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>LABOR TOTALS</div><div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textAlign: "right" }}>{totalLaborHrs}h</div><div></div><div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textAlign: "right" }}>${laborCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div></div><div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textAlign: "right" }}>${laborPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div></div>
      </div>
      <button onClick={addLaborRow} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, background: "none", border: "none", color: "#f59e0b", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "4px 0" }}><Plus size={12} /> Add Labor Row</button>
    </div>
    {renderSection("Project Costs", "#ef4444", costs, setCosts, "costs", () => addRow(costs, setCosts, () => ({ id: genId(), manf: "FWT", partNum: "FWT", desc: "", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true }), "costs"))}
    {renderSection("RMR \u2014 First Month Included", "#8b5cf6", rmr, setRmr, "rmr", () => addRow(rmr, setRmr, () => ({ id: genId(), manf: "FWT", partNum: "FWT-RMR", desc: "", qty: 1, unit: "MO", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isRmr: true }), "rmr"))}
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 0", borderTop: "2px solid #1e293b", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12, color: "#64748b" }}>Overhead %:</span><input type="number" step="0.5" style={{ ...nS, width: 70 }} value={overheadPct || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; setOverheadPct(v); save(null, null, null, null, v); }} placeholder="0" /><span style={{ fontSize: 12, color: "#94a3b8" }}>(${overhead.toFixed(2)})</span></div>
      <div style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>TOTAL: ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
    </div>
    <div style={{ marginTop: 12 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Project Notes</div><textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={notes} onChange={e => { setNotes(e.target.value); save(null, null, null, null, undefined, e.target.value); }} placeholder="Notes, assumptions, special conditions..." /></div>
  </div>);
}

/* ═══════════════════════════════════════
   DOCX GENERATION FUNCTION (CORRECTED)
   Matches Austin's FWT Proposal Template
   ═══════════════════════════════════════ */
async function generateProposalDocx(d, opp) {
  const fmt = v => "$" + parseFloat(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const totalPrice = d.scopes.reduce((s, sc) => s + (parseFloat(sc.price) || 0), 0);
  const SYSTEM_TYPES = ["Access Control", "Intrusion Alarm", "Security Cameras", "Sound Masking"];

  // ── Template-matched constants ──
  // Content width = 12240 - 720 - 720 = 10800 DXA (0.5" margins)
  const CW = 10800;
  const noB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: noB, bottom: noB, left: noB, right: noB };
  const thinB = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  const borders = { top: thinB, bottom: thinB, left: thinB, right: thinB };
  const cellPad = { top: 40, bottom: 40, left: 80, right: 80 };

  function tc(text, opts = {}) {
    return new TableCell({
      borders: opts.noBorder ? noBorders : borders,
      width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
      margins: cellPad,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, font: "Calibri", size: opts.size || 22 })]
      })]
    });
  }

  function emptyCell(w, nb) {
    return new TableCell({
      borders: nb ? noBorders : borders,
      width: w ? { size: w, type: WidthType.DXA } : undefined,
      margins: cellPad,
      children: [new Paragraph({ children: [] })]
    });
  }

  function sectionHeader(text) {
    return new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [new TextRun({ text, bold: true, italics: true, underline: {}, font: "Calibri", size: 22 })]
    });
  }

  // ── Build header with FWT branding ──
  function makeHeader() {
    const hdrChildren = [];
    try {
      hdrChildren.push(new Paragraph({
        children: [
          new ImageRun({ data: b64ToUint8(FWT_CIRCULAR_LOGO_B64), transformation: { width: 41, height: 17 }, type: "jpg" }),
          new TextRun("  "),
          new ImageRun({ data: b64ToUint8(FWT_TEXT_LOGO_B64), transformation: { width: 86, height: 19 }, type: "png" }),
        ],
        alignment: AlignmentType.RIGHT,
      }));
    } catch (e) {
      hdrChildren.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "FAR WEST TECHNOLOGIES", bold: true, font: "Calibri", size: 18 })] }));
    }
    return new Header({ children: hdrChildren });
  }

  // ── Build footer with INITIAL line, address, page number ──
  function makeFooter(includeInitial) {
    const ftrChildren = [];
    if (includeInitial) {
      ftrChildren.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 40 },
        children: [new TextRun({ text: "INITIAL:  _____ / _____", font: "Calibri", size: 16 })]
      }));
    }
    ftrChildren.push(new Paragraph({
      children: [
        new TextRun({ text: "606 E Main Suite B, Puyallup, WA 98372 | farwesttechnologies.com", font: "Copperplate Gothic Bold", size: 16, color: "FFFFFF" }),
        new TextRun({ text: "                                                                                              ", font: "Copperplate Gothic Bold", size: 16, color: "FFFFFF" }),
        new TextRun({ text: "page ", font: "Copperplate Gothic Bold", size: 16, color: "FFFFFF" }),
        new TextRun({ children: [PageNumber.CURRENT], font: "Copperplate Gothic Bold", size: 16, color: "FFFFFF" }),
      ]
    }));
    return new Footer({ children: ftrChildren });
  }

  const children = [];

  // ── Header Table (no borders) — matched to template widths ──
  const hdrCols = [4945, 1530, 1535, 2790];
  const hdrRows = [
    [opp.customer || "<Client\u2019s Company>", "", "Date:", d.date],
    [opp.siteAddress || "<Client Street Addr>", "", "Project Name:", opp.name || "<Project Name>"],
    [opp.siteCity || "<Client City, State, ZIP>", "", "Expiration:", d.expiration + " days from above date"],
    ["Attn: " + (opp.contactName || "<Client Name>"), "", "Prepared by:", d.pmName || "<PM Name>"],
  ];
  children.push(new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: hdrCols,
    rows: hdrRows.map(r => new TableRow({ children: [
      tc(r[0], { noBorder: true, width: hdrCols[0] }),
      emptyCell(hdrCols[1], true),
      tc(r[2], { noBorder: true, width: hdrCols[2], bold: true, align: AlignmentType.RIGHT }),
      tc(r[3], { noBorder: true, width: hdrCols[3] }),
    ] }))
  }));

  children.push(new Paragraph({ spacing: { before: 200 }, children: [] }));

  // ── Project Title ──
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: opp.name || "<Project Name>", bold: true, underline: {}, font: "Calibri", size: 22 })]
  }));
  children.push(new Paragraph({ spacing: { before: 100 }, children: [] }));

  // ── Cover Letter ──
  children.push(new Paragraph({ children: [new TextRun({ text: (opp.contactName || "<Client Name>") + ",", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ spacing: { before: 100 }, indent: { firstLine: 720 }, children: [new TextRun({ text: "Thank you for the opportunity to submit a proposal for the " + (opp.name || "<Project Name>") + " project. We understand there are many choices to be made when selecting a technology solutions contractor. At FAR West Technologies (FWT), we leverage the latest technologies and solutions coupled with our expert staff to continuously exceed our customer\u2019s expectations. We believe that you will be completely satisfied with our design, installation, project management, and overall support throughout the project.", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ spacing: { before: 100 }, indent: { firstLine: 720 }, children: [new TextRun({ text: "The following proposal is based on the project information that was provided to us, including " + (d.projectInfo || "<specifications, drawings, site walk dated 01-01-2025, etc>") + ". The proposal will remain in effect for the duration listed above and reflects all labor and material costs to complete the project.", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "The following information is included within this proposal:", font: "Calibri", size: 22 })] }));
  ["Scope of Work", "Exclusions", "Terms & Conditions", "Project Pricing", "Acceptance Form"].forEach(item => {
    children.push(new Paragraph({
      numbering: { reference: "bullets", level: 0 },
      children: [new TextRun({ text: item, font: "Calibri", size: 22 })]
    }));
  });
  children.push(new Paragraph({ spacing: { before: 120 }, indent: { firstLine: 720 }, children: [new TextRun({ text: "Once again, thank you for your support and the opportunity you have shown FAR West Technologies. Please feel free to contact me with any questions or concerns you may have.", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "Sincerely,", font: "Calibri", size: 22 })] }));

  // Signature image
  try {
    children.push(new Paragraph({ spacing: { before: 100 }, children: [new ImageRun({ data: b64ToUint8(FWT_SIG_B64), transformation: { width: 114, height: 53 }, type: "png" })] }));
  } catch (e) { children.push(new Paragraph({ spacing: { before: 100 }, children: [] })); }

  children.push(new Paragraph({ children: [new TextRun({ text: d.pmName || "Austin Wright", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: d.pmTitle || "Project Manager", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: d.pmPhone || "", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: d.pmEmail || "", font: "Calibri", size: 22, color: "2B579A" })] }));

  // ── Scopes of Work ──
  d.scopes.forEach((scope, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(sectionHeader("Scope of Work \u2013 " + (scope.title || "<Type of Work>")));
    children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: scope.description || "FAR West Technologies will provide and install...", font: "Calibri", size: 22 })] }));
    if (scope.fieldDevices && scope.fieldDevices.trim()) {
      children.push(new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 80 },
        children: [new TextRun({ text: "Field Devices:", bold: true, font: "Calibri", size: 22 })]
      }));
      scope.fieldDevices.split("\n").filter(l => l.trim()).forEach(line => {
        children.push(new Paragraph({
          numbering: { reference: "bullets", level: 1 },
          children: [new TextRun({ text: line.trim(), font: "Calibri", size: 22 })]
        }));
      });
    }
    if (scope.headendDevices && scope.headendDevices.trim()) {
      children.push(new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 80 },
        children: [new TextRun({ text: "Headend Devices:", bold: true, font: "Calibri", size: 22 })]
      }));
      scope.headendDevices.split("\n").filter(l => l.trim()).forEach(line => {
        children.push(new Paragraph({
          numbering: { reference: "bullets", level: 1 },
          children: [new TextRun({ text: line.trim(), font: "Calibri", size: 22 })]
        }));
      });
    }
  });

  // ── Exclusions ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(sectionHeader("Exclusions"));
  children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "The following items are not provided within this proposal but can be provided upon request. Please inform FAR West Technologies if you desire to have any of the following included within this proposal, or for clarification on any of these items.", font: "Calibri", size: 20 })] }));
  const exclCols = [500, CW - 500];
  const exclRows = d.exclusions.filter(e => e.included).map(ex => new TableRow({ children: [
    tc("\u2612", { width: exclCols[0], align: AlignmentType.CENTER }),
    tc(ex.text, { width: exclCols[1], size: 20 }),
  ] }));
  if (exclRows.length > 0) {
    children.push(new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: exclCols, rows: exclRows }));
  }

  // ── Terms & Conditions ──
  children.push(sectionHeader("Terms & Conditions"));
  const termCols = [500, CW - 500];
  const termRows = d.terms.filter(t => t.included).map(term => {
    let text = term.text;
    if (text === "NETWORK_TERM") {
      const sys = d.systemTypes || {};
      const parts = SYSTEM_TYPES.map(st => (sys[st] ? "\u2611" : "\u2610") + " " + st).join("    ");
      text = "Customer shall provide minimum (1) LAN & WAN network connection for each of the following systems:\n" + parts;
    }
    return new TableRow({ children: [
      tc("\u2612", { width: termCols[0], align: AlignmentType.CENTER }),
      tc(text, { width: termCols[1], size: 20 }),
    ] });
  });
  if (termRows.length > 0) {
    children.push(new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: termCols, rows: termRows }));
  }

  // ── Project Pricing ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(sectionHeader("Project Pricing"));
  children.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "Project Reference Name: ", font: "Calibri", size: 22 }), new TextRun({ text: opp.name || "<Project Name>", bold: true, font: "Calibri", size: 22 })] }));
  const priceCols = [CW - 2800, 2800];
  const priceRows = d.scopes.map(s => new TableRow({ children: [
    tc((s.title || "<Scope>") + " Price:", { width: priceCols[0] }),
    tc(fmt(s.price), { width: priceCols[1], align: AlignmentType.RIGHT }),
  ] }));
  priceRows.push(new TableRow({ children: [emptyCell(priceCols[0], false), emptyCell(priceCols[1], false)] }));
  priceRows.push(new TableRow({ children: [
    tc("TOTAL PROJECT PRICE:", { width: priceCols[0], bold: true, italic: true }),
    tc(fmt(totalPrice), { width: priceCols[1], bold: true, italic: true, align: AlignmentType.RIGHT }),
  ] }));
  children.push(new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: priceCols, rows: priceRows }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "(Washington state sales tax is NOT included in the above pricing and will be added to each invoice)", italics: true, font: "Calibri", size: 18 })] }));

  // ── Customer Acceptance Form ──
  children.push(sectionHeader("Customer Acceptance Form"));
  children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: "Customer Information:", font: "Calibri", size: 22 })] }));
  const accCols = [2200, 3200, 2200, 3200];
  const custInfoRows = [
    ["Company Name:", "", "Accepted by (printed):", ""],
    ["Company Address 1:", "", "Accepted by (signature):", ""],
    ["Company Address 2:", "", "Title:", ""],
    ["Company City, State, ZIP:", "", "Email:", ""],
    ["Contact Phone Number:", "", "Date:", ""],
  ].map(r => new TableRow({ children: [
    tc(r[0], { width: accCols[0], bold: true, size: 18 }), emptyCell(accCols[1], false),
    tc(r[2], { width: accCols[2], bold: true, size: 18 }), emptyCell(accCols[3], false),
  ] }));
  children.push(new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: accCols, rows: custInfoRows }));

  children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: "Billing Information:", font: "Calibri", size: 22 })] }));
  const billInfoRows = [
    ["Bill to Company Name:", "", "Billing Contact Person:", ""],
    ["Bill to Company Address 1:", "", "Billing Contact Phone Number:", ""],
    ["Bill to Company Address 2:", "", "Billing Contact Email:", ""],
    ["Bill to Company City, State, ZIP:", "", "Purchase Order Number:", ""],
    ["Billing Dept. Email Address:", "", "**Resale Certification #:", ""],
  ].map(r => new TableRow({ children: [
    tc(r[0], { width: accCols[0], bold: true, size: 18 }), emptyCell(accCols[1], false),
    tc(r[2], { width: accCols[2], bold: true, size: 18 }), emptyCell(accCols[3], false),
  ] }));
  children.push(new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: accCols, rows: billInfoRows }));
  children.push(new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: "(**Non-taxable/resale only, please attach copy of Reseller Certificate to Acceptance Form.)", font: "Calibri", size: 18 })] }));

  // ── FWT Acceptance Form ──
  children.push(sectionHeader("FAR West Technologies Acceptance Form"));
  children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: "FAR West Technologies Representative:", font: "Calibri", size: 22 })] }));
  const fwtCols = [1800, 3600, 1200, 4200];
  const fwtRows = [
    ["Name (printed):", "", "Title:", ""],
    ["Name (signature):", "", "Date:", ""],
  ].map(r => new TableRow({ children: [
    tc(r[0], { width: fwtCols[0], bold: true, size: 18 }), emptyCell(fwtCols[1], false),
    tc(r[2], { width: fwtCols[2], bold: true, size: 18 }), emptyCell(fwtCols[3], false),
  ] }));
  children.push(new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: fwtCols, rows: fwtRows }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "This agreement is not valid until properly executed by both parties.", bold: true, font: "Calibri", size: 22 })] }));

  // ── Build & Download ──
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 720, right: 720, bottom: 720, left: 720, header: 720, footer: 389 }
        },
        titlePage: true,
      },
      headers: {
        default: makeHeader(),
        first: makeHeader(),
      },
      footers: {
        default: makeFooter(true),
        first: makeFooter(false),
      },
      children
    }]
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "FWT_Proposal_" + (opp.name || "Proposal").replace(/[^a-zA-Z0-9]/g, "_") + ".docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════
   PROPOSAL BUILDER COMPONENT (unchanged)
   ═══════════════════════════════════════ */
export function ProposalBuilder({ opportunity, proposal, onSave, takeoff }) {
  const SYSTEM_TYPES = ["Access Control", "Intrusion Alarm", "Security Cameras", "Sound Masking"];
  const data = proposal || {
    date: new Date().toISOString().split("T")[0], expiration: 30,
    pmName: "Austin Wright", pmTitle: "Project Manager", pmPhone: "239.565.9270", pmEmail: "austinw@farwesttechnologies.com",
    projectInfo: "",
    scopes: [{ id: genId(), title: "", description: "", fieldDevices: "", headendDevices: "", price: "" }],
    exclusions: DEFAULT_EXCLUSIONS.map((e, i) => ({ id: "ex" + i, text: e, included: true })),
    terms: DEFAULT_TERMS.map((t, i) => ({ id: "tm" + i, text: t, included: true })),
    systemTypes: { "Access Control": false, "Intrusion Alarm": false, "Security Cameras": false, "Sound Masking": false },
  };
  const [d, setD] = useState(data);
  const [generating, setGenerating] = useState(false);
  function upd(updates) { const updated = { ...d, ...updates }; setD(updated); onSave(updated); }
  const totalPrice = d.scopes.reduce((s, sc) => s + (parseFloat(sc.price) || 0), 0);
  const opp = opportunity || {};
  const pS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lbS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  function pullFromTakeoff() {
    if (!takeoff) return;
    const matT = (takeoff.materials || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)) + (n(r.laborHrs) * n(r.laborRate)), 0);
    const labT = (takeoff.labor || []).reduce((s, r) => s + (n(r.hours) * n(r.ratePerHr)), 0);
    const cosT = (takeoff.costs || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
    const rmrT = (takeoff.rmr || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
    const sub = matT + labT + cosT + rmrT;
    const total = sub + sub * (n(takeoff.overheadPct) / 100);
    if (d.scopes.length > 0) upd({ scopes: d.scopes.map((s, i) => i === 0 ? { ...s, price: total.toFixed(2) } : s) });
  }

  async function handleGenerate() {
    setGenerating(true);
    try { await generateProposalDocx(d, opp); } catch (err) { console.error("Proposal generation error:", err); alert("Error generating proposal. Check console for details."); }
    setGenerating(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={handleGenerate} disabled={generating} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: generating ? "#475569" : "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: generating ? "wait" : "pointer", fontFamily: "inherit" }}><Download size={14} /> {generating ? "Generating..." : "Generate Proposal (.docx)"}</button>
        {takeoff && <button onClick={pullFromTakeoff} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Calculator size={14} /> Pull Price from Takeoff</button>}
      </div>

      {/* Cover Page Fields */}
      <div style={{ background: "#0f1729", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Cover Page</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div><label style={lbS}>Date</label><input type="date" style={pS} value={d.date} onChange={e => upd({ date: e.target.value })} /></div>
          <div><label style={lbS}>Expiration (days)</label><input type="number" style={pS} value={d.expiration} onChange={e => upd({ expiration: parseInt(e.target.value) || 30 })} /></div>
          <div><label style={lbS}>Prepared By</label><input style={pS} value={d.pmName} onChange={e => upd({ pmName: e.target.value })} placeholder="PM Name" /></div>
          <div><label style={lbS}>PM Title</label><input style={pS} value={d.pmTitle} onChange={e => upd({ pmTitle: e.target.value })} /></div>
          <div><label style={lbS}>PM Phone</label><input style={pS} value={d.pmPhone} onChange={e => upd({ pmPhone: e.target.value })} /></div>
          <div><label style={lbS}>PM Email</label><input style={pS} value={d.pmEmail} onChange={e => upd({ pmEmail: e.target.value })} /></div>
          <div style={{ gridColumn: "span 3" }}><label style={lbS}>Project Info Source</label><input style={pS} value={d.projectInfo} onChange={e => upd({ projectInfo: e.target.value })} placeholder="specifications, drawings, site walk dated 01-01-2025, etc." /></div>
        </div>
      </div>

      {/* Scopes of Work */}
      <div style={{ background: "#0f1729", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1e293b" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Scope(s) of Work</span>
          <button onClick={() => upd({ scopes: [...d.scopes, { id: genId(), title: "", description: "", fieldDevices: "", headendDevices: "", price: "" }] })} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6366f1", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}><Plus size={13} /> Add Scope</button>
        </div>
        {d.scopes.map((scope, si) => (
          <div key={scope.id} style={{ background: "#1a2332", borderRadius: 10, padding: 16, marginBottom: 10, border: "1px solid #1e293b" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ ...pS, flex: 2 }} value={scope.title} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, title: e.target.value } : s) })} placeholder="Type of Work (e.g., Intercom Upgrade)" />
              <input type="number" step="0.01" style={{ ...pS, flex: 0.8 }} value={scope.price} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, price: e.target.value } : s) })} placeholder="Price" />
              {d.scopes.length > 1 && <button onClick={() => upd({ scopes: d.scopes.filter((_, i) => i !== si) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={14} /></button>}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Scope Summary:</div>
            <textarea style={{ ...pS, minHeight: 80, resize: "vertical", marginBottom: 10 }} value={scope.description} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, description: e.target.value } : s) })} placeholder="FAR West Technologies will provide and install..." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Field Devices (one per line):</div><textarea style={{ ...pS, minHeight: 60, resize: "vertical" }} value={scope.fieldDevices || ""} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, fieldDevices: e.target.value } : s) })} placeholder="Install (8) IP Dome cameras..." /></div>
              <div><div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Headend Devices (one per line):</div><textarea style={{ ...pS, minHeight: 60, resize: "vertical" }} value={scope.headendDevices || ""} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, headendDevices: e.target.value } : s) })} placeholder="Install (1) 16 Port POE+ switch..." /></div>
            </div>
          </div>
        ))}
        <div style={{ textAlign: "right", fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", marginTop: 8 }}>Total: ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>

      {/* Exclusions */}
      <div style={{ background: "#0f1729", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Exclusions</div>
        {d.exclusions.map((ex, i) => (
          <div key={ex.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid #1e293b0a" }}>
            <button onClick={() => upd({ exclusions: d.exclusions.map((e, idx) => idx === i ? { ...e, included: !e.included } : e) })} style={{ background: "none", border: "none", cursor: "pointer", color: ex.included ? "#10b981" : "#334155", flexShrink: 0, marginTop: 2, fontSize: 14 }}>{ex.included ? "\u2611" : "\u2610"}</button>
            <span style={{ fontSize: 12, color: ex.included ? "#e2e8f0" : "#475569", flex: 1 }}>{ex.text}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input id="newExcl" style={{ ...pS, flex: 1 }} placeholder="Add custom exclusion..." onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { upd({ exclusions: [...d.exclusions, { id: genId(), text: e.target.value.trim(), included: true }] }); e.target.value = ""; } }} />
        </div>
      </div>

      {/* Terms & Conditions */}
      <div style={{ background: "#0f1729", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Terms & Conditions</div>
        {d.terms.map((term, i) => (
          <div key={term.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid #1e293b0a" }}>
            <button onClick={() => upd({ terms: d.terms.map((t, idx) => idx === i ? { ...t, included: !t.included } : t) })} style={{ background: "none", border: "none", cursor: "pointer", color: term.included ? "#10b981" : "#334155", flexShrink: 0, marginTop: 2, fontSize: 14 }}>{term.included ? "\u2611" : "\u2610"}</button>
            <span style={{ fontSize: 12, color: term.included ? "#e2e8f0" : "#475569", flex: 1 }}>
              {term.text === "NETWORK_TERM" ? (<span>Customer shall provide minimum (1) LAN & WAN network connection for each of the following systems:<div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>{SYSTEM_TYPES.map(st => (<button key={st} onClick={() => upd({ systemTypes: { ...d.systemTypes, [st]: !(d.systemTypes || {})[st] } })} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #1e293b", fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: (d.systemTypes || {})[st] ? "#6366f1" : "transparent", color: (d.systemTypes || {})[st] ? "#fff" : "#64748b" }}>{(d.systemTypes || {})[st] ? "\u2611" : "\u2610"} {st}</button>))}</div></span>) : term.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
