import { useState } from "react";
import { Plus, X, Printer, ChevronDown, ChevronUp, FileText, Calculator, Download } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType, PageBreak, ShadingType, VerticalAlign } from "docx";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const n = v => parseFloat(v) || 0;

function b64ToUint8(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

const FWT_LOGO_B64 = "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";

const FWT_SIG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAQgAAAB8CAMAAACi7N6uAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAL9UExURf///5GRkTo6OhkZGQMDAwAAAAEBAenp6ZiYmAoKChQUFCUlJYGBgePj4/v7+9jY2H9/fx8fHxYWFn19fd7e3js7OyEhIerq6jMzMw0NDXd3d3Jycujo6MnJyY+Pj/r6+u/v7wICArS0tOLi4khISGRkZCcnJy4uLv39/fX19SQkJBMTE/j4+BoaGg4ODvb29isrK87OztPT0wsLCxcXF0ZGRiYmJr6+vlRUVCgoKA8PD/Dw8F5eXv7+/uHh4U1NTZaWlm9vb8XFxRsbG83Nzfz8/EtLS7CwsBgYGMPDwwYGBvf39zAwMNzc3Hh4eDIyMvT09GpqagUFBQcHB7q6uqWlpYCAgAwMDJ+fn9DQ0IWFhZWVlQQEBJeXl2ZmZhwcHJ2dnaKioszMzDY2NmlpadbW1uvr60JCQsDAwF9fX8vLy2FhYVFRUbGxsREREVVVVQgICN/f3yAgIIeHh1JSUjU1NUlJSfHx8S8vL9vb266urnV1dQkJCfn5+WxsbEdHRzg4ONHR0ebm5lNTU05OThUVFampqR0dHc/Pz9fX12tra4qKil1dXT8/P7Kysu3t7crKynFxcZubm3BwcHt7e1paWllZWbu7u9nZ2b29veDg4NTU1O7u7nl5eUpKSufn51ZWVioqKi0tLcfHx3Nzc/Pz84aGhvLy8qenp7W1tdra2qurq1dXVzQ0NMbGxoyMjLi4uB4eHqampkFBQcTExEBAQHZ2dmdnZ62trcLCwqSkpBAQELy8vHx8fD09PVBQUOXl5aioqMHBwSMjIxISEqCgoFhYWLm5uUVFRVxcXJOTk09PT5qamtXV1TExMY2NjUxMTHp6er+/v7e3t6ysrCkpKZKSkoODg25ubpycnOTk5J6enq+vr5SUlHR0dIKCgpCQkD4+Pm1tbYiIiGJiYoSEhDc3N46Ojt3d3WVlZezs7KGhobOzsywsLENDQ9LS0ltbW5mZmTw8PKOjo35+fjk5OSIiIqqqqomJiWBgYGhoaERERLa2tsjIyAAAAPa40KIAAAD/dFJOU///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AGb8ilkAAAAJcEhZcwAAIdUAACHVAQSctJ0AAAk1SURBVHhe7V07euMgEE7DHfg4HAUHgOPQcDs1tGpQQbMzgF62JMYxsrOW/yRr7CQO/Jo3g/bniy+++OKLL/5H9FyzEeWl68H1jOnQufL0okT4TjPd+fIMwEMZXAkugCaIURQSBFs9vQSUZqEv4xGO2TK6DHxkcqERBeFyihGYLqMl9MUsJUhDuJeGH8WuJQ8OaFBlvIRlpoyuAYicymgNdSkeQCn4ljRAbMlEGV0BiukN24CIbCijK0CzbWmAuPpK7kKysBc1Cl4GF4Bk+0HjcBl5cIId2ADFujL6dECefZtULNAzWUYfDq8PPYK5ir9Q7NASSrbjUD8Mju+6zARz/O2PgWH6sNASr1GHGZg+rrOYS/CgdM0tXkMv9LGRBMQLxFHObJZeVggX8BdgHKpCLy9gHxhB983n64VksYwO8Pl6Ab6C4ArCG/XiNZWwSBEHt1nLfxVeoZNgJAkS76uO9UwM5+e6kGZSCgvvLVer8wWCU7QCpWZfSd35loM2ySegNCf5AXlUo5Gn1/TN2dbJEOVdH7tNe3I525+82+4ZMSx48+6mO9k8CaLi+fDmXb2Tuw4oETVCvHu3W56qdx3jJFtfqeG+AOpMAwERNW15VPU5EWcaCEOV9koN9xXozlMMFys1yRGu4jVfgvM0s6c6faffmWQVxIM5MPFETOsO9/GWsG9NsgrUkW5KbPiMw6/IkERn8Yq4mQBf22D1QwQywrr9tQ5FjR3QTL7fPIDw0xLCgL3xRpHZMGRfCMF3Gb0VD4RyVnAkoyeQYQk16gLxN1rlHi1COIVG465B+gaRvrjw/ugh4VcV0nSGJAx7iu0ieXF/ppNW/3YefpBABpf9/ZItPSSQf6UT5smtJC9BTRjTZhk8crpaUEsUp6Nr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";

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
   DOCX GENERATION FUNCTION
   ═══════════════════════════════════════ */
async function generateProposalDocx(d, opp) {
  const fmt = v => "$" + parseFloat(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const totalPrice = d.scopes.reduce((s, sc) => s + (parseFloat(sc.price) || 0), 0);
  const noB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: noB, bottom: noB, left: noB, right: noB };
  const thinB = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  const borders = { top: thinB, bottom: thinB, left: thinB, right: thinB };
  const cellPad = { top: 40, bottom: 40, left: 80, right: 80 };
  const SYSTEM_TYPES = ["Access Control", "Intrusion Alarm", "Security Cameras", "Sound Masking"];

  function tc(text, opts = {}) { return new TableCell({ borders: opts.noBorder ? noBorders : borders, width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined, margins: cellPad, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: opts.align || AlignmentType.LEFT, children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, font: "Calibri", size: opts.size || 22 })] })] }); }

  function emptyCell(w, nb) { return new TableCell({ borders: nb ? noBorders : borders, width: w ? { size: w, type: WidthType.DXA } : undefined, margins: cellPad, children: [new Paragraph({ children: [] })] }); }

  function sectionHeader(text) { return new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text, bold: true, italics: true, underline: {}, font: "Calibri", size: 22 })] }); }

  const children = [];

  // ── Header Table (no borders) ──
  const hdrRows = [
    [opp.customer || "<Client\u2019s Company>", "", "Date:", d.date],
    [opp.siteAddress || "<Client Street Addr>", "", "Project Name:", opp.name || "<Project Name>"],
    [opp.siteCity || "<Client City, State, ZIP>", "", "Expiration:", d.expiration + " days from above date"],
    ["Attn: " + (opp.contactName || "<Client Name>"), "", "Prepared by:", d.pmName || "<PM Name>"],
  ];
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4200, 1200, 1500, 2460],
    rows: hdrRows.map(r => new TableRow({ children: [
      tc(r[0], { noBorder: true, width: 4200 }),
      emptyCell(1200, true),
      tc(r[2], { noBorder: true, width: 1500, bold: true, align: AlignmentType.RIGHT }),
      tc(r[3], { noBorder: true, width: 2460 }),
    ] }))
  }));

  children.push(new Paragraph({ spacing: { before: 200 }, children: [] }));

  // ── Project Title ──
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: opp.name || "<Project Name>", bold: true, underline: {}, font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ spacing: { before: 100 }, children: [] }));

  // ── Cover Letter ──
  children.push(new Paragraph({ children: [new TextRun({ text: (opp.contactName || "<Client Name>") + ",", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ spacing: { before: 100 }, indent: { firstLine: 720 }, children: [new TextRun({ text: "Thank you for the opportunity to submit a proposal for the " + (opp.name || "<Project Name>") + " project. We understand there are many choices to be made when selecting a technology solutions contractor. At FAR West Technologies (FWT), we leverage the latest technologies and solutions coupled with our expert staff to continuously exceed our customer\u2019s expectations. We believe that you will be completely satisfied with our design, installation, project management, and overall support throughout the project.", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ spacing: { before: 100 }, indent: { firstLine: 720 }, children: [new TextRun({ text: "The following proposal is based on the project information that was provided to us, including " + (d.projectInfo || "<specifications, drawings, site walk dated 01-01-2025, etc>") + ". The proposal will remain in effect for the duration listed above and reflects all labor and material costs to complete the project.", font: "Calibri", size: 22 })] }));
  children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "The following information is included within this proposal:", font: "Calibri", size: 22 })] }));
  ["Scope of Work", "Exclusions", "Terms & Conditions", "Project Pricing", "Acceptance Form"].forEach(item => {
    children.push(new Paragraph({ numbering: undefined, indent: { left: 720 }, children: [new TextRun({ text: "\u2022 " + item, font: "Calibri", size: 22 })] }));
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
      children.push(new Paragraph({ spacing: { before: 80 }, indent: { left: 360 }, children: [new TextRun({ text: "\u2022 Field Devices:", bold: true, font: "Calibri", size: 22 })] }));
      scope.fieldDevices.split("\n").filter(l => l.trim()).forEach(line => {
        children.push(new Paragraph({ indent: { left: 1080 }, children: [new TextRun({ text: "\u2022 " + line.trim(), font: "Calibri", size: 22 })] }));
      });
    }
    if (scope.headendDevices && scope.headendDevices.trim()) {
      children.push(new Paragraph({ spacing: { before: 80 }, indent: { left: 360 }, children: [new TextRun({ text: "\u2022 Headend Devices:", bold: true, font: "Calibri", size: 22 })] }));
      scope.headendDevices.split("\n").filter(l => l.trim()).forEach(line => {
        children.push(new Paragraph({ indent: { left: 1080 }, children: [new TextRun({ text: "\u2022 " + line.trim(), font: "Calibri", size: 22 })] }));
      });
    }
  });

  // ── Exclusions ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(sectionHeader("Exclusions"));
  children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "The following items are not provided within this proposal but can be provided upon request. Please inform FAR West Technologies if you desire to have any of the following included within this proposal, or for clarification on any of these items.", font: "Calibri", size: 20 })] }));
  const exclRows = d.exclusions.filter(e => e.included).map(ex => new TableRow({ children: [
    tc("\u2612", { width: 400, align: AlignmentType.CENTER }),
    tc(ex.text, { width: 8960, size: 20 }),
  ] }));
  if (exclRows.length > 0) {
    children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [400, 8960], rows: exclRows }));
  }

  // ── Terms & Conditions ──
  children.push(sectionHeader("Terms & Conditions"));
  const termRows = d.terms.filter(t => t.included).map(term => {
    let text = term.text;
    if (text === "NETWORK_TERM") {
      const sys = d.systemTypes || {};
      const parts = SYSTEM_TYPES.map(st => (sys[st] ? "\u2611" : "\u2610") + " " + st).join("    ");
      text = "Customer shall provide minimum (1) LAN & WAN network connection for each of the following systems:\n" + parts;
    }
    return new TableRow({ children: [
      tc("\u2612", { width: 400, align: AlignmentType.CENTER }),
      tc(text, { width: 8960, size: 20 }),
    ] });
  });
  if (termRows.length > 0) {
    children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [400, 8960], rows: termRows }));
  }

  // ── Project Pricing ──
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(sectionHeader("Project Pricing"));
  children.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: "Project Reference Name: ", font: "Calibri", size: 22 }), new TextRun({ text: opp.name || "<Project Name>", bold: true, font: "Calibri", size: 22 })] }));
  const priceRows = d.scopes.map(s => new TableRow({ children: [
    tc((s.title || "<Scope>") + " Price:", { width: 7000 }),
    tc(fmt(s.price), { width: 2360, align: AlignmentType.RIGHT }),
  ] }));
  priceRows.push(new TableRow({ children: [emptyCell(7000, false), emptyCell(2360, false)] }));
  priceRows.push(new TableRow({ children: [
    tc("TOTAL PROJECT PRICE:", { width: 7000, bold: true, italic: true }),
    tc(fmt(totalPrice), { width: 2360, bold: true, italic: true, align: AlignmentType.RIGHT }),
  ] }));
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [7000, 2360], rows: priceRows }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: "(Washington state sales tax is NOT included in the above pricing and will be added to each invoice)", italics: true, font: "Calibri", size: 18 })] }));

  // ── Customer Acceptance Form ──
  children.push(sectionHeader("Customer Acceptance Form"));
  children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: "Customer Information:", font: "Calibri", size: 22 })] }));
  const custInfoRows = [
    ["Company Name:", "", "Accepted by (printed):", ""],
    ["Company Address 1:", "", "Accepted by (signature):", ""],
    ["Company Address 2:", "", "Title:", ""],
    ["Company City, State, ZIP:", "", "Email:", ""],
    ["Contact Phone Number:", "", "Date:", ""],
  ].map(r => new TableRow({ children: [
    tc(r[0], { width: 1800, bold: true, size: 18 }), emptyCell(2880, false),
    tc(r[2], { width: 1800, bold: true, size: 18 }), emptyCell(2880, false),
  ] }));
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1800, 2880, 1800, 2880], rows: custInfoRows }));

  children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: "Billing Information:", font: "Calibri", size: 22 })] }));
  const billInfoRows = [
    ["Bill to Company Name:", "", "Billing Contact Person:", ""],
    ["Bill to Company Address 1:", "", "Billing Contact Phone Number:", ""],
    ["Bill to Company Address 2:", "", "Billing Contact Email:", ""],
    ["Bill to Company City, State, ZIP:", "", "Purchase Order Number:", ""],
    ["Billing Dept. Email Address:", "", "**Resale Certification #:", ""],
  ].map(r => new TableRow({ children: [
    tc(r[0], { width: 1800, bold: true, size: 18 }), emptyCell(2880, false),
    tc(r[2], { width: 1800, bold: true, size: 18 }), emptyCell(2880, false),
  ] }));
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1800, 2880, 1800, 2880], rows: billInfoRows }));
  children.push(new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: "(**Non-taxable/resale only, please attach copy of Reseller Certificate to Acceptance Form.)", font: "Calibri", size: 18 })] }));

  // ── FWT Acceptance Form ──
  children.push(sectionHeader("FAR West Technologies Acceptance Form"));
  children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: "FAR West Technologies Representative:", font: "Calibri", size: 22 })] }));
  const fwtRows = [
    ["Name (printed):", "", "Title:", ""],
    ["Name (signature):", "", "Date:", ""],
  ].map(r => new TableRow({ children: [
    tc(r[0], { width: 1500, bold: true, size: 18 }), emptyCell(3180, false),
    tc(r[2], { width: 1000, bold: true, size: 18 }), emptyCell(3680, false),
  ] }));
  children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1500, 3180, 1000, 3680], rows: fwtRows }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "This agreement is not valid until properly executed by both parties.", bold: true, font: "Calibri", size: 22 })] }));

  // ── Build & Download ──
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }]
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
   PROPOSAL BUILDER COMPONENT
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
