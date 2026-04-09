import { useState, useRef } from "react";
import { Plus, X, Printer, ChevronDown, ChevronUp, FileText, Calculator } from "lucide-react";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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
  "All work to be performed during normal business hours Monday through Friday 7:00am – 4:00pm",
  "FAR West Technologies (FWT) will provide a project warranty for a period of (1) year unless noted otherwise. The warranty period will begin after the agreed upon completion date. FWT and manufacturer extended warranties are available upon request.",
  "Upon completion of Scope of Work(s) pursuant to the terms of this agreement, customer shall pay to FWT the contract price within 30 days of date shown on invoice, or, in the event of a progress invoice, the completed portion of the Scope of Work(s) as indicated on the progress invoice within 30 days of date shown on the progress invoice.",
  "Any alterations from the above listed scope of work will result in a change order. All change order materials will be purchased and installed after written approval of the change order is received by FWT.",
  "Customer to provide all necessary keys, badging, and/or personnel needed to gain access throughout customer premises",
  "Customer shall provide (1) host Workstation/Server PC meeting the minimum requirements for system software. FWT will provide minimum requirements documentation for each software suite.",
  "FWT will provide (1) 2-hour end-user training session upon project completion. Additional training sessions can be provided for an additional charge.",
  "Customer shall provide minimum (1) LAN & WAN network connection for each applicable system.",
  "FWT will not honor the warranty of any cabling that has been painted. Painting cabling installed by FWT will void all FWT warranties for the cabling.",
  "Existing devices and/or cabling will be reused or repurposed within new systems. Existing devices and/or cabling have not been tested for operation, compatibility, or reliability and are not covered under FWT warranties.",
  "Software hosting fees will be invoiced as part of a separate contract.",
  "The National Electrical Code (NEC) requires abandoned wire and cable to be removed or marked as 'spare' for future use. Removal of abandoned wire and cabling is not included within this proposal and is subject to additional charges.",
  "In the event of any default on the part of the Customer including but not limited to failure to make any progress payment or final payment, FWT reserves the right to temporarily disable any equipment or systems installed as part of this proposal.",
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
   TAKEOFF BUILDER
   ═══════════════════════════════════════ */
export function TakeoffBuilder({ takeoff, onSave }) {
  const data = takeoff || { materials: Array(5).fill(null).map(() => emptyMaterialRow()), labor: DEFAULT_LABOR_ROWS.map(r => ({ ...r, id: genId() })), costs: DEFAULT_COST_ROWS.map(r => ({ ...r, id: genId() })), rmr: DEFAULT_RMR_ROWS.map(r => ({ ...r, id: genId() })), overheadPct: 0, notes: "" };

  const [materials, setMaterials] = useState(data.materials);
  const [labor, setLabor] = useState(data.labor);
  const [costs, setCosts] = useState(data.costs);
  const [rmr, setRmr] = useState(data.rmr);
  const [overheadPct, setOverheadPct] = useState(data.overheadPct || 0);
  const [notes, setNotes] = useState(data.notes || "");

  function save(m, l, c, r, oh, n) { onSave({ materials: m || materials, labor: l || labor, costs: c || costs, rmr: r || rmr, overheadPct: oh !== undefined ? oh : overheadPct, notes: n !== undefined ? n : notes }); }

  function updRow(arr, setArr, idx, field, val, section) {
    const n = arr.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: field === "desc" || field === "manf" || field === "partNum" || field === "unit" ? val : parseFloat(val) || 0 };
      if (field === "costPU" || field === "markupPct") {
        const cost = field === "costPU" ? (parseFloat(val) || 0) : updated.costPU;
        const markup = field === "markupPct" ? (parseFloat(val) || 0) : updated.markupPct;
        updated.pricePU = Math.round(cost * (1 + markup / 100) * 100) / 100;
      }
      return updated;
    });
    setArr(n);
    if (section === "materials") save(n, null, null, null);
    else if (section === "costs") save(null, null, n, null);
    else if (section === "rmr") save(null, null, null, n);
  }

  function updLaborRow(idx, field, val) {
    const n = labor.map((r, i) => i === idx ? { ...r, [field]: field === "desc" ? val : parseFloat(val) || 0 } : r);
    setLabor(n);
    save(null, n, null, null);
  }

  function addLaborRow() {
    const n = [...labor, { id: genId(), desc: "", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true }];
    setLabor(n);
    save(null, n, null, null);
  }

  function removeLaborRow(idx) {
    const n = labor.filter((_, i) => i !== idx);
    setLabor(n);
    save(null, n, null, null);
  }

  function addRow(arr, setArr, template, section) {
    const n = [...arr, template()];
    setArr(n);
    if (section === "materials") save(n, null, null, null);
    else if (section === "labor") save(null, n, null, null);
    else if (section === "costs") save(null, null, n, null);
    else if (section === "rmr") save(null, null, null, n);
  }

  function removeRow(arr, setArr, idx, section) {
    const n = arr.filter((_, i) => i !== idx);
    setArr(n);
    if (section === "materials") save(n, null, null, null);
    else if (section === "labor") save(null, n, null, null);
    else if (section === "costs") save(null, null, n, null);
    else if (section === "rmr") save(null, null, null, n);
  }

  // Calculations
  const matTotal = materials.reduce((s, r) => s + (r.qty * r.pricePU) + (r.laborHrs * r.laborRate), 0);
  const laborPrice = labor.reduce((s, r) => s + (r.hours * r.ratePerHr), 0);
  const laborCostTotal = labor.reduce((s, r) => s + (r.hours * r.costPerHr), 0);
  const totalLaborHrs = labor.reduce((s, r) => s + (r.hours || 0), 0);
  const costTotal = costs.reduce((s, r) => s + (r.qty * r.pricePU), 0);
  const rmrTotal = rmr.reduce((s, r) => s + (r.qty * r.pricePU), 0);
  const subtotal = matTotal + laborPrice + costTotal + rmrTotal;
  const overhead = subtotal * (overheadPct / 100);
  const grandTotal = subtotal + overhead;

  const matCost = materials.reduce((s, r) => s + (r.qty * r.costPU), 0);
  const costsCost = costs.reduce((s, r) => s + (r.qty * r.costPU), 0);
  const totalCost = matCost + laborCostTotal + costsCost;
  const margin = grandTotal > 0 ? Math.round(((grandTotal - totalCost) / grandTotal) * 100) : 0;

  function renderSection(title, color, rows, setRows, section, addFn, hideMarkup) {
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>{title}</div>
        {rows.map((row, idx) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: hideMarkup ? "80px 90px 1fr 50px 40px 80px 80px 80px 50px 60px 80px 24px" : "80px 90px 1fr 50px 40px 80px 55px 80px 80px 50px 60px 80px 24px", gap: 4, marginBottom: 3, alignItems: "center" }}>
            <input style={iS} value={row.manf} onChange={e => updRow(rows, setRows, idx, "manf", e.target.value, section)} placeholder="Manf" />
            <input style={iS} value={row.partNum} onChange={e => updRow(rows, setRows, idx, "partNum", e.target.value, section)} placeholder="Part #" />
            <input style={iS} value={row.desc} onChange={e => updRow(rows, setRows, idx, "desc", e.target.value, section)} placeholder="Description" />
            <input type="number" style={nS} value={row.qty || ""} onChange={e => updRow(rows, setRows, idx, "qty", e.target.value, section)} placeholder="0" />
            <input style={iS} value={row.unit} onChange={e => updRow(rows, setRows, idx, "unit", e.target.value, section)} placeholder="EA" />
            <input type="number" step="0.01" style={nS} value={row.costPU || ""} onChange={e => updRow(rows, setRows, idx, "costPU", e.target.value, section)} placeholder="Cost" />
            {!hideMarkup && <input type="number" step="1" style={{ ...nS, color: "#f59e0b" }} value={row.markupPct ?? ""} onChange={e => updRow(rows, setRows, idx, "markupPct", e.target.value, section)} placeholder="%" />}
            {hideMarkup ? (
              <input type="number" step="0.01" style={nS} value={row.pricePU || ""} onChange={e => updRow(rows, setRows, idx, "pricePU", e.target.value, section)} placeholder="Rate" />
            ) : (
              <div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${(row.pricePU || 0).toFixed(2)}</div>
            )}
            <div style={{ fontSize: 12, color: "#e2e8f0", textAlign: "right", fontWeight: 600 }}>${(row.qty * (row.pricePU || 0)).toFixed(2)}</div>
            <input type="number" step="0.5" style={nS} value={row.laborHrs || ""} onChange={e => updRow(rows, setRows, idx, "laborHrs", e.target.value, section)} placeholder="Hrs" />
            <input type="number" step="0.01" style={nS} value={row.laborRate || ""} onChange={e => updRow(rows, setRows, idx, "laborRate", e.target.value, section)} placeholder="Rate" />
            <div style={{ fontSize: 12, color: "#f59e0b", textAlign: "right", fontWeight: 600 }}>${(row.laborHrs * row.laborRate).toFixed(2)}</div>
            <button onClick={() => removeRow(rows, setRows, idx, section)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
          </div>
        ))}
        <button onClick={() => addFn()} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "4px 0" }}><Plus size={12} /> Add Row</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #6366f1" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Material Price</div><div style={{ fontSize: 18, fontWeight: 700, color: "#6366f1", fontFamily: "'Outfit',sans-serif" }}>${matTotal.toLocaleString()}</div></div>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #f59e0b" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Labor ({totalLaborHrs}h)</div><div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", fontFamily: "'Outfit',sans-serif" }}>${laborPrice.toLocaleString()}</div></div>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #10b981" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Total Cost</div><div style={{ fontSize: 18, fontWeight: 700, color: "#10b981", fontFamily: "'Outfit',sans-serif" }}>${totalCost.toLocaleString()}</div></div>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #3b82f6" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Quoted Price</div><div style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6", fontFamily: "'Outfit',sans-serif" }}>${grandTotal.toLocaleString()}</div></div>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444"}` }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Margin</div><div style={{ fontSize: 18, fontWeight: 700, color: margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444", fontFamily: "'Outfit',sans-serif" }}>{margin}%</div></div>
      </div>

      {/* Column Headers */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 50px 40px 80px 55px 80px 80px 50px 60px 80px 24px", gap: 4, marginBottom: 8, padding: "0 0 6px", borderBottom: "1px solid #1e293b" }}>
        {["Manf", "Part #", "Description", "Qty", "Unit", "Cost/U", "Mkup%", "Price/U", "Ext Price", "Hrs", "Rate", "Ext Labor", ""].map(h => (
          <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>

      {/* Material Items */}
      {renderSection("Materials", "#6366f1", materials, setMaterials, "materials", () => addRow(materials, setMaterials, emptyMaterialRow, "materials"))}

      {/* Labor */}
      {/* FWT Labor */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>FWT Labor</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginBottom: 6, padding: "0 0 6px", borderBottom: "1px solid #1e293b" }}>
          {["Description", "Hours", "Cost/Hr", "Labor Cost", "Rate/Hr", "Labor Price", ""].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>
        {labor.map((row, idx) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginBottom: 3, alignItems: "center" }}>
            <input style={iS} value={row.desc} onChange={e => updLaborRow(idx, "desc", e.target.value)} placeholder="Labor description" />
            <input type="number" step="0.5" style={nS} value={row.hours || ""} onChange={e => updLaborRow(idx, "hours", e.target.value)} placeholder="0" />
            <input type="number" step="0.01" style={nS} value={row.costPerHr || ""} onChange={e => updLaborRow(idx, "costPerHr", e.target.value)} placeholder="$/hr" />
            <div style={{ fontSize: 12, color: "#ef4444", textAlign: "right", fontWeight: 600 }}>${((row.hours || 0) * (row.costPerHr || 0)).toFixed(2)}</div>
            <input type="number" step="0.01" style={nS} value={row.ratePerHr || ""} onChange={e => updLaborRow(idx, "ratePerHr", e.target.value)} placeholder="$/hr" />
            <div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${((row.hours || 0) * (row.ratePerHr || 0)).toFixed(2)}</div>
            <button onClick={() => removeLaborRow(idx)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginTop: 6, padding: "8px 0 0", borderTop: "1px solid #1e293b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>LABOR TOTALS</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textAlign: "right" }}>{totalLaborHrs}h</div>
          <div></div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textAlign: "right" }}>${laborCostTotal.toLocaleString()}</div>
          <div></div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textAlign: "right" }}>${laborPrice.toLocaleString()}</div>
          <div></div>
        </div>
        <button onClick={addLaborRow} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, background: "none", border: "none", color: "#f59e0b", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "4px 0" }}><Plus size={12} /> Add Labor Row</button>
      </div>

      {/* Project Costs */}
      {renderSection("Project Costs", "#ef4444", costs, setCosts, "costs", () => addRow(costs, setCosts, () => ({ id: genId(), manf: "FWT", partNum: "FWT", desc: "", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true }), "costs"))}

      {/* RMR */}
      {renderSection("RMR — First Month Included", "#8b5cf6", rmr, setRmr, "rmr", () => addRow(rmr, setRmr, () => ({ id: genId(), manf: "FWT", partNum: "FWT-RMR", desc: "", qty: 1, unit: "MO", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isRmr: true }), "rmr"))}

      {/* Overhead & Total */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 0", borderTop: "2px solid #1e293b", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Overhead %:</span>
          <input type="number" step="0.5" style={{ ...nS, width: 70 }} value={overheadPct || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; setOverheadPct(v); save(null, null, null, null, v); }} placeholder="0" />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>(${overhead.toFixed(2)})</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>TOTAL: ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>

      {/* Notes */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Project Notes</div>
        <textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={notes} onChange={e => { setNotes(e.target.value); save(null, null, null, null, undefined, e.target.value); }} placeholder="Notes, assumptions, special conditions..." />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   PROPOSAL BUILDER
   ═══════════════════════════════════════ */
export function ProposalBuilder({ opportunity, proposal, onSave, takeoff }) {
  const data = proposal || {
    date: new Date().toISOString().split("T")[0],
    expiration: 30,
    pmName: "",
    pmPhone: "",
    pmEmail: "",
    projectInfo: "",
    scopes: [{ id: genId(), title: "", description: "", bullets: [], price: "" }],
    exclusions: DEFAULT_EXCLUSIONS.map((e, i) => ({ id: "ex" + i, text: e, included: true })),
    terms: DEFAULT_TERMS,
    additionalTerms: [],
  };

  const [d, setD] = useState(data);
  const [showPrint, setShowPrint] = useState(false);
  const printRef = useRef(null);

  function upd(updates) { const n = { ...d, ...updates }; setD(n); onSave(n); }

  const totalPrice = d.scopes.reduce((s, sc) => s + (parseFloat(sc.price) || 0), 0);
  const opp = opportunity || {};

  const pS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lbS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  function printProposal() { setShowPrint(true); setTimeout(() => { window.print(); setShowPrint(false); }, 300); }

  // Auto-fill from takeoff if available
  function pullFromTakeoff() {
    if (!takeoff) return;
    const matTotal = (takeoff.materials || []).reduce((s, r) => s + (r.qty * r.pricePU) + (r.laborHrs * r.laborRate), 0);
    const laborTotal = (takeoff.labor || []).reduce((s, r) => s + ((r.hours || 0) * (r.ratePerHr || 0)), 0);
    const costTotal = (takeoff.costs || []).reduce((s, r) => s + (r.qty * r.pricePU), 0);
    const rmrTotal = (takeoff.rmr || []).reduce((s, r) => s + (r.qty * r.pricePU), 0);
    const sub = matTotal + laborTotal + costTotal + rmrTotal;
    const oh = sub * ((takeoff.overheadPct || 0) / 100);
    const total = sub + oh;
    if (d.scopes.length > 0) {
      upd({ scopes: d.scopes.map((s, i) => i === 0 ? { ...s, price: total.toFixed(2) } : s) });
    }
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={printProposal} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Printer size={14} /> Print / Download</button>
        {takeoff && <button onClick={pullFromTakeoff} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Calculator size={14} /> Pull Price from Takeoff</button>}
      </div>

      {/* Cover Page Fields */}
      <div style={{ background: "#0f1729", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Cover Page</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div><label style={lbS}>Date</label><input type="date" style={pS} value={d.date} onChange={e => upd({ date: e.target.value })} /></div>
          <div><label style={lbS}>Expiration (days)</label><input type="number" style={pS} value={d.expiration} onChange={e => upd({ expiration: parseInt(e.target.value) || 30 })} /></div>
          <div><label style={lbS}>Prepared By</label><input style={pS} value={d.pmName} onChange={e => upd({ pmName: e.target.value })} placeholder="PM Name" /></div>
          <div><label style={lbS}>PM Phone</label><input style={pS} value={d.pmPhone} onChange={e => upd({ pmPhone: e.target.value })} /></div>
          <div><label style={lbS}>PM Email</label><input style={pS} value={d.pmEmail} onChange={e => upd({ pmEmail: e.target.value })} /></div>
          <div><label style={lbS}>Project Info Source</label><input style={pS} value={d.projectInfo} onChange={e => upd({ projectInfo: e.target.value })} placeholder="specs, drawings, site walk dated..." /></div>
        </div>
      </div>

      {/* Scopes of Work */}
      <div style={{ background: "#0f1729", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1e293b" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Scope(s) of Work</span>
          <button onClick={() => upd({ scopes: [...d.scopes, { id: genId(), title: "", description: "", bullets: [], price: "" }] })} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6366f1", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}><Plus size={13} /> Add Scope</button>
        </div>
        {d.scopes.map((scope, si) => (
          <div key={scope.id} style={{ background: "#1a2332", borderRadius: 10, padding: 16, marginBottom: 10, border: "1px solid #1e293b" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ ...pS, flex: 2 }} value={scope.title} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, title: e.target.value } : s) })} placeholder="Scope title (e.g., Video Surveillance)" />
              <input type="number" step="0.01" style={{ ...pS, flex: 0.8 }} value={scope.price} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, price: e.target.value } : s) })} placeholder="Price" />
              {d.scopes.length > 1 && <button onClick={() => upd({ scopes: d.scopes.filter((_, i) => i !== si) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={14} /></button>}
            </div>
            <textarea style={{ ...pS, minHeight: 80, resize: "vertical", marginBottom: 10 }} value={scope.description} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, description: e.target.value } : s) })} placeholder="FAR West Technologies will provide and install..." />
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Bullet Points (one per line):</div>
            <textarea style={{ ...pS, minHeight: 60, resize: "vertical" }} value={(scope.bullets || []).join("\n")} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, bullets: e.target.value.split("\n") } : s) })} placeholder="• Workstation Cabling:&#10;  - Install (40) new outlets..." />
          </div>
        ))}
        <div style={{ textAlign: "right", fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", marginTop: 8 }}>Total: ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>

      {/* Exclusions */}
      <div style={{ background: "#0f1729", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Exclusions</div>
        {d.exclusions.map((ex, i) => (
          <div key={ex.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid #1e293b0a" }}>
            <button onClick={() => upd({ exclusions: d.exclusions.map((e, idx) => idx === i ? { ...e, included: !e.included } : e) })} style={{ background: "none", border: "none", cursor: "pointer", color: ex.included ? "#10b981" : "#334155", flexShrink: 0, marginTop: 2 }}>{ex.included ? "☑" : "☐"}</button>
            <span style={{ fontSize: 12, color: ex.included ? "#e2e8f0" : "#475569", flex: 1 }}>{ex.text}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input id="newExcl" style={{ ...pS, flex: 1 }} placeholder="Add custom exclusion..." onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { upd({ exclusions: [...d.exclusions, { id: genId(), text: e.target.value.trim(), included: true }] }); e.target.value = ""; } }} />
        </div>
      </div>

      {/* Print Preview */}
      {showPrint && <ProposalPrintView d={d} opp={opp} totalPrice={totalPrice} />}
    </div>
  );
}

/* ═══ PRINT VIEW ═══ */
function ProposalPrintView({ d, opp, totalPrice }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 9999, overflow: "auto", color: "#000", fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 13, lineHeight: 1.6 }}>
      <style>{`@media print { body * { visibility: hidden; } .print-proposal, .print-proposal * { visibility: visible; } .print-proposal { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <div className="print-proposal" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 50px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}>
          <div style={{ fontSize: 13 }}>
            <div>{opp.customer || "<Client's Company>"}</div>
            <div>{opp.siteAddress || "<Client Address>"}</div>
            <div>Attn: {opp.contactName || "<Client Name>"}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13 }}>
            <div><strong>Date:</strong> {d.date}</div>
            <div><strong>Project Name:</strong> {opp.name || "<Project Name>"}</div>
            <div><strong>Expiration:</strong> {d.expiration} days from above date</div>
            <div><strong>Prepared by:</strong> {d.pmName || "<PM Name>"}</div>
          </div>
        </div>

        <h1 style={{ textAlign: "center", fontSize: 22, borderBottom: "2px solid #1a3a5c", paddingBottom: 10, marginBottom: 30 }}>{opp.name || "<Project Name>"}</h1>

        <p>{opp.contactName || "<Client Name>"},</p>
        <p style={{ marginTop: 10 }}>Thank you for the opportunity to submit a proposal for the {opp.name || "<Project Name>"} project. We understand there are many choices to be made when selecting a technology solutions contractor. At FAR West Technologies (FWT), we leverage the latest technologies and solutions coupled with our expert staff to continuously exceed our customer's expectations.</p>
        <p style={{ marginTop: 10 }}>The following proposal is based on the project information that was provided to us, including {d.projectInfo || "<specifications, drawings, site walk>"}. The proposal will remain in effect for the duration listed above and reflects all labor and material costs to complete the project.</p>

        <p style={{ marginTop: 16 }}>The following information is included within this proposal:</p>
        <ul style={{ marginLeft: 20, marginTop: 8 }}>
          <li>Scope of Work</li><li>Exclusions</li><li>Terms & Conditions</li><li>Project Pricing</li><li>Acceptance Form</li>
        </ul>

        <p style={{ marginTop: 16 }}>Sincerely,</p>
        <p style={{ marginTop: 8 }}>{d.pmName}<br />{d.pmPhone}<br />{d.pmEmail}</p>

        {/* Scopes */}
        {d.scopes.map((scope, i) => (
          <div key={scope.id} style={{ marginTop: 40, pageBreakBefore: i > 0 ? "always" : "auto" }}>
            <h2 style={{ fontSize: 18, borderBottom: "1px solid #1a3a5c", paddingBottom: 6 }}>Scope of Work - {scope.title || "<Type of Work>"}</h2>
            <p style={{ marginTop: 10 }}>{scope.description || "FAR West Technologies will provide and install..."}</p>
            {scope.bullets?.filter(b => b.trim()).length > 0 && (
              <div style={{ marginTop: 10, whiteSpace: "pre-wrap", paddingLeft: 16 }}>{scope.bullets.filter(b => b.trim()).join("\n")}</div>
            )}
            <p style={{ marginTop: 16, textAlign: "right", fontWeight: 700, color: "#1a3a5c" }}>Price for this Scope of Work: ${parseFloat(scope.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        ))}

        {/* Exclusions */}
        <div style={{ marginTop: 40, pageBreakBefore: "always" }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #1a3a5c", paddingBottom: 6 }}>Exclusions</h2>
          <p style={{ marginTop: 8, fontSize: 12 }}>The following items are not provided within this proposal but can be provided upon request.</p>
          {d.exclusions.filter(e => e.included).map(ex => (
            <div key={ex.id} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 12 }}>☐ {ex.text}</div>
          ))}
        </div>

        {/* Terms */}
        <div style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #1a3a5c", paddingBottom: 6 }}>Terms & Conditions</h2>
          {d.terms.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 11 }}>☐ {t}</div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{ marginTop: 40, pageBreakBefore: "always" }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #1a3a5c", paddingBottom: 6 }}>Project Pricing</h2>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 600 }}>Project Reference Name: {opp.name}</div>
            {d.scopes.map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee" }}>
                <span>{s.title || "<Scope>"}</span>
                <span>${parseFloat(s.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 700, fontSize: 16 }}>
              <span>TOTAL PROJECT PRICE:</span>
              <span>${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <p style={{ fontSize: 11, color: "#666", textAlign: "center" }}>(Washington state sales tax is NOT included in the above pricing and will be added to each invoice)</p>
          </div>
        </div>

        {/* Acceptance */}
        <div style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #1a3a5c", paddingBottom: 6 }}>Customer Acceptance Form</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 12 }}>
            <tbody>
              {[["Company Name:", "Accepted by (printed):"], ["Company Address:", "Accepted by (signature):"], ["City, State, ZIP:", "Title:"], ["Contact Phone:", "Email:"], ["", "Date:"]].map(([l, r], i) => (
                <tr key={i}><td style={{ padding: "8px", border: "1px solid #ccc", width: "50%", fontWeight: 600 }}>{l}</td><td style={{ padding: "8px", border: "1px solid #ccc", fontWeight: 600 }}>{r}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 16 }}>FAR West Technologies Acceptance</h2>
          <table style={{ width: "50%", borderCollapse: "collapse", marginTop: 10, fontSize: 12 }}>
            <tbody>
              {[["Name (printed):", "Title:"], ["Name (signature):", "Date:"]].map(([l, r], i) => (
                <tr key={i}><td style={{ padding: "8px", border: "1px solid #ccc", fontWeight: 600 }}>{l}</td><td style={{ padding: "8px", border: "1px solid #ccc", fontWeight: 600 }}>{r}</td></tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 16, textAlign: "center", fontWeight: 700, fontSize: 14 }}>This agreement is not valid until properly executed by both parties.</p>
        </div>

        <button onClick={() => window.location.reload()} style={{ position: "fixed", top: 20, right: 20, padding: "10px 20px", background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✕ Close Preview</button>
      </div>
    </div>
  );
}
