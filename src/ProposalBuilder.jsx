import { useState, useRef } from "react";
import { Plus, X, Printer, ChevronDown, ChevronUp, FileText, Calculator } from "lucide-react";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Safe number coercion — treats undefined, null, "", NaN all as 0
const n = v => parseFloat(v) || 0;

const FWT_SIGNATURE = "data:image/png;base64,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";

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
    const updated = arr.map((r, i) => {
      if (i !== idx) return r;
      const row = { ...r, [field]: field === "desc" || field === "manf" || field === "partNum" || field === "unit" ? val : parseFloat(val) || 0 };
      if (field === "costPU" || field === "markupPct") {
        const cost = field === "costPU" ? (parseFloat(val) || 0) : n(row.costPU);
        const markup = field === "markupPct" ? (parseFloat(val) || 0) : n(row.markupPct);
        row.pricePU = Math.round(cost * (1 + markup / 100) * 100) / 100;
      }
      return row;
    });
    setArr(updated);
    if (section === "materials") save(updated, null, null, null);
    else if (section === "costs") save(null, null, updated, null);
    else if (section === "rmr") save(null, null, null, updated);
  }

  function updLaborRow(idx, field, val) {
    const updated = labor.map((r, i) => i === idx ? { ...r, [field]: field === "desc" ? val : parseFloat(val) || 0 } : r);
    setLabor(updated);
    save(null, updated, null, null);
  }

  function addLaborRow() { const updated = [...labor, { id: genId(), desc: "", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true }]; setLabor(updated); save(null, updated, null, null); }
  function removeLaborRow(idx) { const updated = labor.filter((_, i) => i !== idx); setLabor(updated); save(null, updated, null, null); }

  function addRow(arr, setArr, template, section) {
    const updated = [...arr, template()];
    setArr(updated);
    if (section === "materials") save(updated, null, null, null);
    else if (section === "costs") save(null, null, updated, null);
    else if (section === "rmr") save(null, null, null, updated);
  }

  function removeRow(arr, setArr, idx, section) {
    const updated = arr.filter((_, i) => i !== idx);
    setArr(updated);
    if (section === "materials") save(updated, null, null, null);
    else if (section === "costs") save(null, null, updated, null);
    else if (section === "rmr") save(null, null, null, updated);
  }

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
              <div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${n(row.pricePU).toFixed(2)}</div>
            )}
            <div style={{ fontSize: 12, color: "#e2e8f0", textAlign: "right", fontWeight: 600 }}>${(n(row.qty) * n(row.pricePU)).toFixed(2)}</div>
            <input type="number" step="0.5" style={nS} value={row.laborHrs || ""} onChange={e => updRow(rows, setRows, idx, "laborHrs", e.target.value, section)} placeholder="Hrs" />
            <input type="number" step="0.01" style={nS} value={row.laborRate || ""} onChange={e => updRow(rows, setRows, idx, "laborRate", e.target.value, section)} placeholder="Rate" />
            <div style={{ fontSize: 12, color: "#f59e0b", textAlign: "right", fontWeight: 600 }}>${(n(row.laborHrs) * n(row.laborRate)).toFixed(2)}</div>
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
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #6366f1" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Material Price</div><div style={{ fontSize: 18, fontWeight: 700, color: "#6366f1", fontFamily: "'Outfit',sans-serif" }}>${matTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #f59e0b" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Labor ({totalLaborHrs}h)</div><div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", fontFamily: "'Outfit',sans-serif" }}>${laborPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #10b981" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Total Cost</div><div style={{ fontSize: 18, fontWeight: 700, color: "#10b981", fontFamily: "'Outfit',sans-serif" }}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #3b82f6" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Quoted Price</div><div style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6", fontFamily: "'Outfit',sans-serif" }}>${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
        <div style={{ background: "#0f1729", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444"}` }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Margin</div><div style={{ fontSize: 18, fontWeight: 700, color: margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444", fontFamily: "'Outfit',sans-serif" }}>{margin}%</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 50px 40px 80px 55px 80px 80px 50px 60px 80px 24px", gap: 4, marginBottom: 8, padding: "0 0 6px", borderBottom: "1px solid #1e293b" }}>
        {["Manf", "Part #", "Description", "Qty", "Unit", "Cost/U", "Mkup%", "Price/U", "Ext Price", "Hrs", "Rate", "Ext Labor", ""].map(h => (
          <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>
      {renderSection("Materials", "#6366f1", materials, setMaterials, "materials", () => addRow(materials, setMaterials, emptyMaterialRow, "materials"))}
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
            <div style={{ fontSize: 12, color: "#ef4444", textAlign: "right", fontWeight: 600 }}>${(n(row.hours) * n(row.costPerHr)).toFixed(2)}</div>
            <input type="number" step="0.01" style={nS} value={row.ratePerHr || ""} onChange={e => updLaborRow(idx, "ratePerHr", e.target.value)} placeholder="$/hr" />
            <div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${(n(row.hours) * n(row.ratePerHr)).toFixed(2)}</div>
            <button onClick={() => removeLaborRow(idx)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginTop: 6, padding: "8px 0 0", borderTop: "1px solid #1e293b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>LABOR TOTALS</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textAlign: "right" }}>{totalLaborHrs}h</div>
          <div></div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textAlign: "right" }}>${laborCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div></div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textAlign: "right" }}>${laborPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div></div>
        </div>
        <button onClick={addLaborRow} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, background: "none", border: "none", color: "#f59e0b", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "4px 0" }}><Plus size={12} /> Add Labor Row</button>
      </div>
      {renderSection("Project Costs", "#ef4444", costs, setCosts, "costs", () => addRow(costs, setCosts, () => ({ id: genId(), manf: "FWT", partNum: "FWT", desc: "", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true }), "costs"))}
      {renderSection("RMR \u2014 First Month Included", "#8b5cf6", rmr, setRmr, "rmr", () => addRow(rmr, setRmr, () => ({ id: genId(), manf: "FWT", partNum: "FWT-RMR", desc: "", qty: 1, unit: "MO", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isRmr: true }), "rmr"))}
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 0", borderTop: "2px solid #1e293b", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Overhead %:</span>
          <input type="number" step="0.5" style={{ ...nS, width: 70 }} value={overheadPct || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; setOverheadPct(v); save(null, null, null, null, v); }} placeholder="0" />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>(${overhead.toFixed(2)})</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>TOTAL: ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Project Notes</div>
        <textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={notes} onChange={e => { setNotes(e.target.value); save(null, null, null, null, undefined, e.target.value); }} placeholder="Notes, assumptions, special conditions..." />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   PROPOSAL BUILDER  (updated)
   ═══════════════════════════════════════ */
export function ProposalBuilder({ opportunity, proposal, onSave, takeoff }) {
  const SYSTEM_TYPES = ["Access Control", "Intrusion Alarm", "Security Cameras", "Sound Masking"];
  const data = proposal || {
    date: new Date().toISOString().split("T")[0],
    expiration: 30,
    pmName: "Austin Wright",
    pmTitle: "Project Manager",
    pmPhone: "239.565.9270",
    pmEmail: "austinw@farwesttechnologies.com",
    projectInfo: "",
    scopes: [{ id: genId(), title: "", description: "", fieldDevices: "", headendDevices: "", price: "" }],
    exclusions: DEFAULT_EXCLUSIONS.map((e, i) => ({ id: "ex" + i, text: e, included: true })),
    terms: DEFAULT_TERMS.map((t, i) => ({ id: "tm" + i, text: t, included: true })),
    systemTypes: { "Access Control": false, "Intrusion Alarm": false, "Security Cameras": false, "Sound Masking": false },
    additionalTerms: [],
  };

  const [d, setD] = useState(data);
  const [showPrint, setShowPrint] = useState(false);

  function upd(updates) { const updated = { ...d, ...updates }; setD(updated); onSave(updated); }

  const totalPrice = d.scopes.reduce((s, sc) => s + (parseFloat(sc.price) || 0), 0);
  const opp = opportunity || {};

  const pS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lbS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  function printProposal() { setShowPrint(true); setTimeout(() => { window.print(); }, 400); }

  function pullFromTakeoff() {
    if (!takeoff) return;
    const matT = (takeoff.materials || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)) + (n(r.laborHrs) * n(r.laborRate)), 0);
    const labT = (takeoff.labor || []).reduce((s, r) => s + (n(r.hours) * n(r.ratePerHr)), 0);
    const cosT = (takeoff.costs || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
    const rmrT = (takeoff.rmr || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
    const sub = matT + labT + cosT + rmrT;
    const oh = sub * (n(takeoff.overheadPct) / 100);
    const total = sub + oh;
    if (d.scopes.length > 0) { upd({ scopes: d.scopes.map((s, i) => i === 0 ? { ...s, price: total.toFixed(2) } : s) }); }
  }

  function getNetworkTermText() {
    const sys = d.systemTypes || {};
    const parts = SYSTEM_TYPES.map(st => (sys[st] ? "\u2611" : "\u2610") + " " + st);
    return "Customer shall provide minimum (1) LAN & WAN network connection for each of the following systems:\n" + parts.join("    ");
  }

  return (
    <div>
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
          <div><label style={lbS}>PM Title</label><input style={pS} value={d.pmTitle} onChange={e => upd({ pmTitle: e.target.value })} placeholder="Project Manager" /></div>
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
              <input style={{ ...pS, flex: 2 }} value={scope.title} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, title: e.target.value } : s) })} placeholder="Type of Work (e.g., Intercom Upgrade, Camera System)" />
              <input type="number" step="0.01" style={{ ...pS, flex: 0.8 }} value={scope.price} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, price: e.target.value } : s) })} placeholder="Price" />
              {d.scopes.length > 1 && <button onClick={() => upd({ scopes: d.scopes.filter((_, i) => i !== si) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={14} /></button>}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Scope Summary:</div>
            <textarea style={{ ...pS, minHeight: 80, resize: "vertical", marginBottom: 10 }} value={scope.description} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, description: e.target.value } : s) })} placeholder="FAR West Technologies will provide and install..." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Field Devices (one per line):</div>
                <textarea style={{ ...pS, minHeight: 60, resize: "vertical" }} value={scope.fieldDevices || ""} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, fieldDevices: e.target.value } : s) })} placeholder="Install (8) IP Dome cameras..." />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Headend Devices (one per line):</div>
                <textarea style={{ ...pS, minHeight: 60, resize: "vertical" }} value={scope.headendDevices || ""} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, headendDevices: e.target.value } : s) })} placeholder="Install (1) 16 Port POE+ switch..." />
              </div>
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
              {term.text === "NETWORK_TERM" ? (
                <span>
                  Customer shall provide minimum (1) LAN & WAN network connection for each of the following systems:
                  <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                    {SYSTEM_TYPES.map(st => (
                      <button key={st} onClick={() => upd({ systemTypes: { ...d.systemTypes, [st]: !(d.systemTypes || {})[st] } })} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #1e293b", fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: (d.systemTypes || {})[st] ? "#6366f1" : "transparent", color: (d.systemTypes || {})[st] ? "#fff" : "#64748b" }}>
                        {(d.systemTypes || {})[st] ? "\u2611" : "\u2610"} {st}
                      </button>
                    ))}
                  </div>
                </span>
              ) : term.text}
            </span>
          </div>
        ))}
      </div>

      {/* Print Preview */}
      {showPrint && <ProposalPrintView d={d} opp={opp} totalPrice={totalPrice} onClose={() => setShowPrint(false)} getNetworkTermText={getNetworkTermText} />}
    </div>
  );
}

/* ═══════════════════════════════════════
   PRINT VIEW  (matches Word template)
   ═══════════════════════════════════════ */
function ProposalPrintView({ d, opp, totalPrice, onClose, getNetworkTermText }) {
  const ps = { fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif", fontSize: "11pt", lineHeight: 1.5, color: "#000" };
  const sectionTitle = { fontSize: "11pt", fontWeight: 700, fontStyle: "italic", textDecoration: "underline", margin: "24pt 0 8pt" };
  const cb = "\u2612";
  const cbEmpty = "\u2610";
  const fmt = v => parseFloat(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 9999, overflow: "auto", ...ps }}>
      <style>{`@media print { body * { visibility: hidden !important; } .fwt-print, .fwt-print * { visibility: visible !important; } .fwt-print { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } @page { margin: 0.75in 1in; } }`}</style>
      <button className="no-print" onClick={onClose} style={{ position: "fixed", top: 16, right: 16, padding: "10px 20px", background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, zIndex: 10000 }}>Close Preview</button>

      <div className="fwt-print" style={{ maxWidth: 720, margin: "0 auto", padding: "30px 40px" }}>

        {/* ── FWT Header ── */}
        <div style={{ textAlign: "center", marginBottom: 6, borderBottom: "3px solid #1a3a5c", paddingBottom: 8 }}>
          <div style={{ fontSize: "18pt", fontWeight: 700, letterSpacing: 1 }}><span style={{ color: "#1a3a5c" }}>FAR </span><span style={{ color: "#4a9f3f" }}>WEST</span></div>
          <div style={{ fontSize: "10pt", color: "#1a3a5c", letterSpacing: 3, fontWeight: 600 }}>TECHNOLOGIES INC.</div>
          <div style={{ fontSize: "7pt", color: "#6b7f99", letterSpacing: 4, marginTop: 2 }}>N E T W O R K &nbsp; B A S E D &nbsp; S O L U T I O N S</div>
        </div>

        {/* ── Header Table ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: "10pt" }}>
          <tbody>
            <tr>
              <td style={{ width: "50%", verticalAlign: "top", padding: "3px 0" }}>{opp.customer || "<Client\u2019s Company>"}</td>
              <td style={{ width: "15%", textAlign: "right", fontWeight: 700, padding: "3px 4px" }}>Date:</td>
              <td style={{ width: "35%", padding: "3px 0" }}>{d.date}</td>
            </tr>
            <tr>
              <td style={{ padding: "3px 0" }}>{opp.siteAddress || "<Client Street Addr>"}</td>
              <td style={{ textAlign: "right", fontWeight: 700, padding: "3px 4px" }}>Project Name:</td>
              <td style={{ padding: "3px 0" }}>{opp.name || "<Project Name>"}</td>
            </tr>
            <tr>
              <td style={{ padding: "3px 0" }}>{opp.siteCity || "<Client City, State, ZIP>"}</td>
              <td style={{ textAlign: "right", fontWeight: 700, padding: "3px 4px" }}>Expiration:</td>
              <td style={{ padding: "3px 0" }}>{d.expiration} days from above date</td>
            </tr>
            <tr>
              <td style={{ padding: "3px 0" }}>Attn: {opp.contactName || "<Client Name>"}</td>
              <td style={{ textAlign: "right", fontWeight: 700, padding: "3px 4px" }}>Prepared by:</td>
              <td style={{ padding: "3px 0" }}>{d.pmName || "<PM Name>"}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Project Title ── */}
        <p style={{ textAlign: "center", fontWeight: 700, textDecoration: "underline", fontSize: "11pt", margin: "16pt 0" }}>{opp.name || "<Project Name>"}</p>

        {/* ── Cover Letter ── */}
        <p>{opp.contactName || "<Client Name>"},</p>
        <p style={{ textIndent: "0.5in", marginTop: 8 }}>Thank you for the opportunity to submit a proposal for the {opp.name || "<Project Name>"} project. We understand there are many choices to be made when selecting a technology solutions contractor. At FAR West Technologies (FWT), we leverage the latest technologies and solutions coupled with our expert staff to continuously exceed our customer&#39;s expectations. We believe that you will be completely satisfied with our design, installation, project management, and overall support throughout the project.</p>
        <p style={{ textIndent: "0.5in", marginTop: 8 }}>The following proposal is based on the project information that was provided to us, including {d.projectInfo || "<specifications, drawings, site walk dated 01-01-2025, etc>"}. The proposal will remain in effect for the duration listed above and reflects all labor and material costs to complete the project.</p>
        <p style={{ marginTop: 12 }}>The following information is included within this proposal:</p>
        <ul style={{ marginLeft: 24, marginTop: 6, marginBottom: 12 }}>
          <li>Scope of Work</li>
          <li>Exclusions</li>
          <li>Terms & Conditions</li>
          <li>Project Pricing</li>
          <li>Acceptance Form</li>
        </ul>
        <p style={{ textIndent: "0.5in" }}>Once again, thank you for your support and the opportunity you have shown FAR West Technologies. Please feel free to contact me with any questions or concerns you may have.</p>
        <p style={{ marginTop: 16 }}>Sincerely,</p>
        <img src={FWT_SIGNATURE} alt="Signature" style={{ height: 36, marginTop: 8, marginBottom: 4 }} />
        <p style={{ margin: 0 }}>{d.pmName || "Austin Wright"}</p>
        <p style={{ margin: 0 }}>{d.pmTitle || "Project Manager"}</p>
        <p style={{ margin: 0 }}>{d.pmPhone}</p>
        <p style={{ margin: 0 }}><a href={"mailto:" + d.pmEmail} style={{ color: "#2b579a" }}>{d.pmEmail}</a></p>

        {/* ── Scopes of Work ── */}
        {d.scopes.map((scope, i) => (
          <div key={scope.id} style={{ marginTop: 30, pageBreakBefore: i > 0 ? "always" : "auto" }}>
            <p style={sectionTitle}>Scope of Work {"\u2013"} {scope.title || "<Type of Work>"}</p>
            <p style={{ marginTop: 6 }}>{scope.description || "FAR West Technologies will provide and install..."}</p>
            {scope.fieldDevices && scope.fieldDevices.trim() && (
              <div style={{ marginTop: 10 }}>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Field Devices:</strong></li>
                  {scope.fieldDevices.split("\n").filter(l => l.trim()).map((line, li) => (
                    <li key={li} style={{ marginLeft: 20 }}>{line.trim()}</li>
                  ))}
                </ul>
              </div>
            )}
            {scope.headendDevices && scope.headendDevices.trim() && (
              <div style={{ marginTop: 6 }}>
                <ul style={{ marginLeft: 20 }}>
                  <li><strong>Headend Devices:</strong></li>
                  {scope.headendDevices.split("\n").filter(l => l.trim()).map((line, li) => (
                    <li key={li} style={{ marginLeft: 20 }}>{line.trim()}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        {/* ── Exclusions ── */}
        <div style={{ marginTop: 30, pageBreakBefore: "always" }}>
          <p style={sectionTitle}>Exclusions</p>
          <p style={{ fontSize: "10pt", marginBottom: 8 }}>The following items are not provided within this proposal but can be provided upon request. Please inform FAR West Technologies if you desire to have any of the following included within this proposal, or for clarification on any of these items.</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
            <tbody>
              {d.exclusions.filter(e => e.included).map(ex => (
                <tr key={ex.id}>
                  <td style={{ width: 30, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center", verticalAlign: "top" }}>{cb}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #ccc" }}>{ex.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Terms & Conditions ── */}
        <div style={{ marginTop: 24 }}>
          <p style={sectionTitle}>Terms & Conditions</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
            <tbody>
              {d.terms.filter(t => t.included).map(term => (
                <tr key={term.id}>
                  <td style={{ width: 30, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center", verticalAlign: "top" }}>{cb}</td>
                  <td style={{ padding: "4px 8px", border: "1px solid #ccc", whiteSpace: "pre-line" }}>
                    {term.text === "NETWORK_TERM" ? getNetworkTermText() : term.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Project Pricing ── */}
        <div style={{ marginTop: 30, pageBreakBefore: "always" }}>
          <p style={sectionTitle}>Project Pricing</p>
          <p style={{ marginTop: 8 }}>Project Reference Name: <strong>{opp.name || "<Project Name>"}</strong></p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: "10pt" }}>
            <tbody>
              {d.scopes.map(s => (
                <tr key={s.id}>
                  <td style={{ padding: "6px 8px", border: "1px solid #ccc" }}>{s.title || "<Scope>"} Price:</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #ccc", textAlign: "right", width: 140 }}>${fmt(s.price)}</td>
                </tr>
              ))}
              <tr><td style={{ padding: "4px 8px", border: "1px solid #ccc" }}></td><td style={{ padding: "4px 8px", border: "1px solid #ccc" }}></td></tr>
              <tr>
                <td style={{ padding: "6px 8px", border: "1px solid #ccc", fontWeight: 700, fontStyle: "italic" }}>TOTAL PROJECT PRICE:</td>
                <td style={{ padding: "6px 8px", border: "1px solid #ccc", textAlign: "right", fontWeight: 700, fontStyle: "italic" }}>${fmt(totalPrice)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ textAlign: "center", fontSize: "9pt", fontStyle: "italic", marginTop: 8 }}>(Washington state sales tax is NOT included in the above pricing and will be added to each invoice)</p>
        </div>

        {/* ── Customer Acceptance Form ── */}
        <div style={{ marginTop: 24 }}>
          <p style={sectionTitle}>Customer Acceptance Form</p>
          <p style={{ marginTop: 8 }}>Customer Information:</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: "10pt" }}>
            <tbody>
              {[["Company Name:", "", "Accepted by (printed):", ""],["Company Address 1:", "", "Accepted by (signature):", ""],["Company Address 2:", "", "Title:", ""],["Company City, State, ZIP:", "", "Email:", ""],["Contact Phone Number:", "", "Date:", ""]].map(([l1, v1, l2, v2], i) => (
                <tr key={i}>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", fontWeight: 600, width: "18%", fontSize: "9pt" }}>{l1}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", width: "32%" }}>{v1}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", fontWeight: 600, width: "18%", fontSize: "9pt" }}>{l2}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", width: "32%" }}>{v2}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 16 }}>Billing Information:</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: "10pt" }}>
            <tbody>
              {[["Bill to Company Name:", "", "Billing Contact Person:", ""],["Bill to Company Address 1:", "", "Billing Contact Phone Number:", ""],["Bill to Company Address 2:", "", "Billing Contact Email:", ""],["Bill to Company City, State, ZIP:", "", "Purchase Order Number:", ""],["Billing Dept. Email Address:", "", "**Resale Certification #:", ""]].map(([l1, v1, l2, v2], i) => (
                <tr key={i}>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", fontWeight: 600, width: "18%", fontSize: "9pt" }}>{l1}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", width: "32%" }}>{v1}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", fontWeight: 600, width: "18%", fontSize: "9pt" }}>{l2}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", width: "32%" }}>{v2}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: "9pt", marginTop: 4 }}>(**Non-taxable/resale only, please attach copy of Reseller Certificate to Acceptance Form.)</p>
        </div>

        {/* ── FWT Acceptance Form ── */}
        <div style={{ marginTop: 24 }}>
          <p style={sectionTitle}>FAR West Technologies Acceptance Form</p>
          <p style={{ marginTop: 8 }}>FAR West Technologies Representative:</p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: "10pt" }}>
            <tbody>
              {[["Name (printed):", "", "Title:", ""],["Name (signature):", "", "Date:", ""]].map(([l1, v1, l2, v2], i) => (
                <tr key={i}>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", fontWeight: 600, width: "15%", fontSize: "9pt" }}>{l1}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", width: "35%" }}>{v1}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", fontWeight: 600, width: "10%", fontSize: "9pt" }}>{l2}</td>
                  <td style={{ padding: "6px 8px", border: "1px solid #999", width: "40%" }}>{v2}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ textAlign: "center", fontWeight: 700, marginTop: 16, fontSize: "11pt" }}>This agreement is not valid until properly executed by both parties.</p>
        </div>

      </div>
    </div>
  );
}
