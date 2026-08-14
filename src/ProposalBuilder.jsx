import { useState } from "react";
import { Plus, X, Printer, ChevronDown, ChevronUp, FileText, Calculator, Download } from "lucide-react";
import JSZip from "jszip";


function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const n = v => parseFloat(v) || 0;

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

const DEFAULT_EXCLUSIONS = ["Power circuits for customer provided/installed equipment","Power poles, basket trays, surface mount raceways, underfloor raceways, and floor monuments","Conduits, mud rings, back boxes, string within conduits and walls","Sleeves between floors, sleeves within fire-rated walls, floor penetrations, and envelope penetrations","Purchase and installation of patch cords for voice and data networks","Telephone, Internet, and Cable TV services","IT support services and/or network equipment for telephone, LAN, WAN, and CATV networks","Fire-rated plywood backerboard","Gates, gate operators, and overhead roll-up doors","Vehicle detection loops, safety photo-eyes, and other vehicle detection devices","Electronic door locking hardware, sliding doors, and associated door hardware","Elevator travelling cable with adequate conductors, elevator machine room connections and terminations, and elevator cab device installations","Integration with Fire Alarm and/or other life safety systems","General Contractor related work, such as framing, painting, patching, roofing, scaffolding, etc.","Demolition of any kind","Hazardous material identification, abatement, or removal","Trash removal from site"];

const DEFAULT_TERMS = ["50% down payment is required before work can begin.","All work to be performed during normal business hours Monday through Friday 7:00am \u2013 4:00pm","FAR West Technologies (FWT) will provide a project warranty for a period of (1) year unless noted otherwise. The warranty period will begin after the agreed upon completion date. FWT and manufacturer extended warranties are available upon request.","Upon completion of Scope of Work(s) pursuant to the terms of this agreement, customer shall pay to FWT the contract price within 30 days of date shown on invoice, or, in the event of a progress invoice, the completed portion of the Scope of Work(s) as indicated on the progress invoice within 30 days of date shown on the progress invoice. Progress invoice(s) include any costs to date incurred by FWT including labor and/or materials required to complete Scope of Work(s).","Any alterations from the above listed scope of work will result in a change order. All change order materials will be purchased and installed after written approval of the change order is received by FWT.","Customer to provide all necessary keys, badging, and/or personnel needed to gain access throughout customer premises","Customer shall provide (1) host Workstation/Server PC meeting the minimum requirements for system software. FWT will provide minimum requirements documentation for each software suite.","FWT will provide (1) 2-hour end-user training session upon project completion. Please have all required personnel available at the scheduled time. Additional training sessions can be provided for an additional charge.","NETWORK_TERM","FWT will not honor the warranty of any cabling that has been painted. Painting cabling installed by FWT will void all FWT warranties for the cabling. FWT shall not be held responsible for costs associated with replacing painted cabling due to failed inspections.","Existing devices and/or cabling will be reused or repurposed within new systems. Existing devices and/or cabling have not been tested for operation, compatibility, or reliability and are not covered under FWT warranties. Any existing devices and/or cabling that require replacement, repair, or adjustment are not covered within the scope of work and are subject to additional charges.","Software hosting fees will be invoiced as part of a separate contract. FWT Full-Service Protection Plans include this fee as well as parts and labor for regular service of the systems included within this proposal. Pricing available upon request.","When audio surveillance or recording is used, state and federal regulations apply. Refer to Title 18, section 2510 of US Codes. Washington is a \u201Ctwo-party consent\u201D state in which special regulations apply. Customer should consult legal advice as to their rights and liabilities.","The National Electrical Code (NEC) requires abandoned wire and cable to be removed or marked as \u201Cspare\u201D for future use. Formal requirements regarding abandoned wire and cable are determined by the Electrical Inspector. Removal of abandoned wire and cabling is not included within this proposal and is subject to additional charges.","Burglary alarm systems utilizing central station monitoring must have a completed call list to enable emergency dispatch procedures. Central Station monitoring fees will be invoiced as part of a separate contract. Customer must complete call list to activate central station monitoring.","In the event of any default on the part of the Customer including but not limited to failure to make any progress payment or final payment, FWT reserves the right to temporarily disable any equipment or systems installed as part of this proposal, until such time as payments have been received. Delinquent payments are subject to interest at the rate of 1-1/2% per month from the date of delinquency or the maximum lawful rate. Disabling or removing any equipment or systems as herein above set forth shall not be considered to constitute a breach by FWT of this agreement or waiver of FWT to any damages nor shall be considered fulfillment of payment."];

const DEFAULT_LABOR_ROWS = [{ id: "lr", desc: "LABOR - ROUGH IN", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },{ id: "lt", desc: "LABOR - TRIM", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },{ id: "lh", desc: "LABOR - HEAD END", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },{ id: "lp", desc: "LABOR - PROGRAMMING", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },{ id: "lm", desc: "LABOR - PROJECT MGT", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true },{ id: "lv", desc: "LABOR - TRAVEL", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true }];
const DEFAULT_COST_ROWS = [{ id: "cp", manf: "FWT", partNum: "FWT", desc: "PERMIT ALLOWANCE", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true },{ id: "cr", manf: "FWT", partNum: "FWT", desc: "RENTAL EQUIPMENT", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true },{ id: "cd", manf: "FWT", partNum: "FWT", desc: "PER DIEM PER TECH", qty: 0, unit: "DAY", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true },{ id: "cs", manf: "FWT", partNum: "FWT", desc: "VENDOR SHIPPING ALLOWANCE", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true }];
const DEFAULT_RMR_ROWS = [{ id: "r1", manf: "FWT", partNum: "FWT-RMR", desc: "", qty: 1, unit: "MO", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isRmr: true }];

function emptyMaterialRow() { return { id: genId(), manf: "", partNum: "", desc: "", qty: 0, unit: "EA", costPU: 0, markupPct: 25, pricePU: 0, laborHrs: 0, laborRate: 0 }; }

const iS = { width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" };
const nS = { ...iS, textAlign: "right" };

// ── CSV export helper ──
// RFC 4180 CSV escape: wrap in quotes if value contains comma, quote, or newline; escape quotes by doubling them.
function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(cells) { return cells.map(csvCell).join(","); }

function downloadBOMCsv(takeoffData, label) {
  const n = v => parseFloat(v) || 0;
  const d = takeoffData || {};
  const materials = d.materials || [];
  const labor = d.labor || [];
  const costs = d.costs || [];
  const rmr = d.rmr || [];
  const overheadPct = n(d.overheadPct);

  // Compute totals
  /* ── Price book integration ────────────────────────────────── */
  const catalogItems = Object.values(catalog || {});
  const assemblyList = Object.values(assemblies || {}).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const [catQ, setCatQ] = useState("");
  const [asmId, setAsmId] = useState("");
  const [asmQty, setAsmQty] = useState(1);
  const catMatches = catQ.trim() ? catalogItems.filter(i => `${i.manf} ${i.partNum} ${i.desc} ${i.category || ""}`.toLowerCase().includes(catQ.toLowerCase())).slice(0, 8) : [];

  function rowFromCatalog(cat, qty) {
    return { id: genId(), manf: cat.manf || "", partNum: cat.partNum || "", desc: cat.desc || "", qty: qty || 1, unit: cat.unit || "EA",
      costPU: n(cat.costPU), markupPct: n(cat.markupPct), pricePU: Math.round(n(cat.costPU) * (1 + n(cat.markupPct) / 100) * 100) / 100,
      laborHrs: 0, laborRate: 0, laborUnits: { lr: n(cat.laborUnits?.lr), lt: n(cat.laborUnits?.lt), lh: n(cat.laborUnits?.lh), lp: n(cat.laborUnits?.lp) } };
  }
  function insertCatalogItem(cat) {
    // Reuse a fully-empty row if one exists, otherwise append
    const blankIdx = materials.findIndex(r => !r.manf && !r.partNum && !r.desc && !n(r.qty) && !n(r.costPU));
    const row = rowFromCatalog(cat, 1);
    const updated = blankIdx >= 0 ? materials.map((r, i) => i === blankIdx ? row : r) : [...materials, row];
    setMaterials(updated); save(updated, null, null, null); setCatQ("");
  }
  function insertAssembly() {
    const asm = assemblyList.find(a => a.id === asmId);
    const qty = n(asmQty) || 1;
    if (!asm) return;
    const newRows = [];
    (asm.items || []).forEach(it => {
      const cat = catalogItems.find(c => c.id === it.catalogId);
      if (cat) newRows.push(rowFromCatalog(cat, Math.round(n(it.qtyPer) * qty * 100) / 100));
    });
    // assembly-level labor adders ride on a zero-cost marker row so suggestions stay accurate
    const add = asm.laborAdders || {};
    if (n(add.lr) + n(add.lt) + n(add.lh) + n(add.lp) > 0) {
      newRows.push({ id: genId(), manf: "FWT", partNum: "ASSY", desc: `${asm.name} — assembly labor`, qty, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0,
        laborUnits: { lr: n(add.lr), lt: n(add.lt), lh: n(add.lh), lp: n(add.lp) } });
    }
    if (!newRows.length) return;
    const nonBlank = materials.filter(r => r.manf || r.partNum || r.desc || n(r.qty) || n(r.costPU));
    const updated = [...nonBlank, ...newRows];
    setMaterials(updated); save(updated, null, null, null); setAsmId(""); setAsmQty(1);
  }
  function saveRowToCatalog(row) {
    if (!onSaveCatalogItem || (!row.partNum && !row.desc)) return;
    const existing = catalogItems.find(c => c.partNum && row.partNum && c.partNum.toLowerCase() === row.partNum.toLowerCase() && (c.manf || "").toLowerCase() === (row.manf || "").toLowerCase());
    onSaveCatalogItem({ id: existing?.id || genId(), manf: row.manf || "", partNum: row.partNum || "", desc: row.desc || "", unit: row.unit || "EA",
      costPU: n(row.costPU), markupPct: n(row.markupPct), laborUnits: existing?.laborUnits || row.laborUnits || { lr: 0, lt: 0, lh: 0, lp: 0 } });
    alert(`${existing ? "Updated" : "Saved"} "${row.partNum || row.desc}" in the catalog${existing ? " (cost/markup refreshed, labor units kept)" : ""}.`);
  }

  // Suggested phase hours from row labor units (qty × hrs/unit)
  const PHASE_MAP = [["lr", "ROUGH IN"], ["lt", "TRIM"], ["lh", "HEAD END"], ["lp", "PROGRAMMING"]];
  const suggested = { lr: 0, lt: 0, lh: 0, lp: 0 };
  materials.forEach(r => { if (r.laborUnits) PHASE_MAP.forEach(([k]) => { suggested[k] += n(r.qty) * n(r.laborUnits[k]); }); });
  const suggestedTotal = PHASE_MAP.reduce((t, [k]) => t + suggested[k], 0);
  function applySuggested() {
    const updated = labor.map(r => {
      const hit = PHASE_MAP.find(([, label]) => (r.desc || "").toUpperCase().includes(label));
      return hit ? { ...r, hours: Math.round(suggested[hit[0]] * 4) / 4 } : r;
    });
    setLabor(updated); save(null, updated, null, null);
  }

  const matTotal = materials.reduce((s, r) => s + (n(r.qty) * n(r.pricePU)) + (n(r.laborHrs) * n(r.laborRate)), 0);
  const matExtPrice = materials.reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
  const matExtLabor = materials.reduce((s, r) => s + (n(r.laborHrs) * n(r.laborRate)), 0);
  const laborPrice = labor.reduce((s, r) => s + (n(r.hours) * n(r.ratePerHr)), 0);
  const laborCostTotal = labor.reduce((s, r) => s + (n(r.hours) * n(r.costPerHr)), 0);
  const totalLaborHrs = labor.reduce((s, r) => s + n(r.hours), 0);
  const costTotal = costs.reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
  const rmrTotal = rmr.reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
  const subtotal = matTotal + laborPrice + costTotal + rmrTotal;
  const overhead = subtotal * (overheadPct / 100);
  const grandTotal = subtotal + overhead;
  const matCost = materials.reduce((s, r) => s + (n(r.qty) * n(r.costPU)), 0);
  const costsCost = costs.reduce((s, r) => s + (n(r.qty) * n(r.costPU)), 0);
  const totalCost = matCost + laborCostTotal + costsCost;
  const margin = grandTotal > 0 ? Math.round(((grandTotal - totalCost) / grandTotal) * 100) : 0;

  const fmt$ = v => n(v).toFixed(2);
  const lines = [];

  // Header
  lines.push(csvRow(["FWT Bill of Materials"]));
  if (label) lines.push(csvRow(["Scope:", label]));
  lines.push(csvRow(["Generated:", new Date().toLocaleString()]));
  lines.push("");

  // Summary
  lines.push(csvRow(["SUMMARY"]));
  lines.push(csvRow(["Material Price", fmt$(matTotal)]));
  lines.push(csvRow(["Labor Price (" + totalLaborHrs + " hrs)", fmt$(laborPrice)]));
  lines.push(csvRow(["Project Costs", fmt$(costTotal)]));
  lines.push(csvRow(["RMR (First Month)", fmt$(rmrTotal)]));
  lines.push(csvRow(["Subtotal", fmt$(subtotal)]));
  lines.push(csvRow(["Overhead (" + overheadPct + "%)", fmt$(overhead)]));
  lines.push(csvRow(["QUOTED PRICE", fmt$(grandTotal)]));
  lines.push(csvRow(["Total Cost", fmt$(totalCost)]));
  lines.push(csvRow(["Margin %", margin + "%"]));
  lines.push("");

  // Materials
  lines.push(csvRow(["MATERIALS"]));
  lines.push(csvRow(["Manufacturer", "Part #", "Description", "Qty", "Unit", "Cost/U", "Markup %", "Price/U", "Ext Price", "Labor Hrs", "Labor Rate", "Ext Labor"]));
  materials.forEach(r => {
    lines.push(csvRow([
      r.manf, r.partNum, r.desc,
      n(r.qty), r.unit || "EA",
      fmt$(r.costPU), n(r.markupPct), fmt$(r.pricePU),
      fmt$(n(r.qty) * n(r.pricePU)),
      n(r.laborHrs), fmt$(r.laborRate),
      fmt$(n(r.laborHrs) * n(r.laborRate)),
    ]));
  });
  lines.push(csvRow(["", "", "MATERIALS TOTAL", "", "", "", "", "", fmt$(matExtPrice), "", "", fmt$(matExtLabor)]));
  lines.push("");

  // Labor
  lines.push(csvRow(["FWT LABOR"]));
  lines.push(csvRow(["Description", "Hours", "Cost/Hr", "Labor Cost", "Rate/Hr", "Labor Price"]));
  labor.forEach(r => {
    lines.push(csvRow([
      r.desc, n(r.hours),
      fmt$(r.costPerHr), fmt$(n(r.hours) * n(r.costPerHr)),
      fmt$(r.ratePerHr), fmt$(n(r.hours) * n(r.ratePerHr)),
    ]));
  });
  lines.push(csvRow(["LABOR TOTAL", totalLaborHrs, "", fmt$(laborCostTotal), "", fmt$(laborPrice)]));
  lines.push("");

  // Project Costs
  lines.push(csvRow(["PROJECT COSTS"]));
  lines.push(csvRow(["Manufacturer", "Part #", "Description", "Qty", "Unit", "Cost/U", "Markup %", "Price/U", "Ext Price"]));
  costs.forEach(r => {
    lines.push(csvRow([
      r.manf, r.partNum, r.desc,
      n(r.qty), r.unit || "EA",
      fmt$(r.costPU), n(r.markupPct), fmt$(r.pricePU),
      fmt$(n(r.qty) * n(r.pricePU)),
    ]));
  });
  lines.push(csvRow(["", "", "COSTS TOTAL", "", "", "", "", "", fmt$(costTotal)]));
  lines.push("");

  // RMR
  lines.push(csvRow(["RMR — FIRST MONTH INCLUDED"]));
  lines.push(csvRow(["Manufacturer", "Part #", "Description", "Qty", "Unit", "Cost/U", "Markup %", "Price/U", "Ext Price"]));
  rmr.forEach(r => {
    lines.push(csvRow([
      r.manf, r.partNum, r.desc,
      n(r.qty), r.unit || "MO",
      fmt$(r.costPU), n(r.markupPct), fmt$(r.pricePU),
      fmt$(n(r.qty) * n(r.pricePU)),
    ]));
  });
  lines.push(csvRow(["", "", "RMR TOTAL", "", "", "", "", "", fmt$(rmrTotal)]));
  lines.push("");

  // Notes
  if (d.notes) {
    lines.push(csvRow(["NOTES"]));
    lines.push(csvRow([d.notes]));
  }

  // Combine and trigger download. BOM added so Excel opens it in UTF-8.
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = (label || "BOM").replace(/[^a-zA-Z0-9]+/g, "_");
  a.download = `FWT_BOM_${safe}_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════
   TEMPLATE-BASED XLSX BOM EXPORT
   ═══════════════════════════════════════
   Fills the user's Takeoff_2026 template by overwriting specific cells in
   xl/worksheets/sheet1.xml. The template was preprocessed to convert all
   shared formulas to per-row plain formulas, so cell overwrites are safe
   (no shared-formula chain to break).

   Row ranges (1-indexed):
     Materials:    8–29 (22 slots)
     FWT Labor:    31–36 (6 slots)
     Project Costs: 38–41 (4 slots)
     RMR:          43–46 (4 slots)
*/

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Build replacement XML for a single cell. Preserves the style index.
function buildCellXml(coord, value, styleIdx) {
  const sAttr = styleIdx ? ` s="${styleIdx}"` : "";
  if (value === null || value === undefined || value === "") {
    return `<c r="${coord}"${sAttr}/>`;
  }
  if (typeof value === "number" && isFinite(value)) {
    // Strip trailing zeros; keep reasonable precision
    const rounded = Math.round(value * 10000) / 10000;
    return `<c r="${coord}"${sAttr}><v>${rounded}</v></c>`;
  }
  return `<c r="${coord}"${sAttr} t="inlineStr"><is><t>${escXml(value)}</t></is></c>`;
}

// Replace (or create if missing) a cell in the sheet XML. Preserves style attr.
function replaceCellInXml(xml, coord, value) {
  // Match either <c r="coord" .../> (self-closing) or <c r="coord" ...>...</c>
  const re = new RegExp(`<c r="${coord}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
  const m = re.exec(xml);
  if (m) {
    // Extract style index s="N" from the matched cell
    const styleMatch = /\s+s="(\d+)"/.exec(m[0]);
    const styleIdx = styleMatch ? styleMatch[1] : null;
    return xml.replace(re, buildCellXml(coord, value, styleIdx));
  }
  // Cell doesn't exist in the sheet XML — insert inside the relevant <row>.
  // (Template has all cells in data rows, so this branch is a safety net.)
  const rowNum = coord.match(/\d+$/)[0];
  const rowRe = new RegExp(`(<row r="${rowNum}"[^>]*>)([\\s\\S]*?)(</row>)`);
  const rm = rowRe.exec(xml);
  if (rm) {
    return xml.replace(rowRe, rm[1] + rm[2] + buildCellXml(coord, value, null) + rm[3]);
  }
  return xml;
}

async function downloadBOMToTemplate(takeoffData, label) {
  const d = takeoffData || {};
  const materials = d.materials || [];
  const labor = d.labor || [];
  const costs = d.costs || [];
  const rmr = d.rmr || [];

  // Template row ranges
  const MAT_START = 8,   MAT_COUNT = 22;
  const LABOR_START = 31, LABOR_COUNT = 6;
  const COST_START = 38,  COST_COUNT = 4;
  const RMR_START = 43,   RMR_COUNT = 4;

  // Warn about overflow
  const warnings = [];
  if (materials.length > MAT_COUNT)
    warnings.push(`${materials.length - MAT_COUNT} material row(s) exceed the template's ${MAT_COUNT}-row capacity and will be omitted.`);
  if (labor.length > LABOR_COUNT)
    warnings.push(`${labor.length - LABOR_COUNT} labor row(s) exceed the template's ${LABOR_COUNT}-row capacity and will be omitted.`);
  if (costs.length > COST_COUNT)
    warnings.push(`${costs.length - COST_COUNT} cost row(s) exceed the template's ${COST_COUNT}-row capacity and will be omitted.`);
  if (rmr.length > RMR_COUNT)
    warnings.push(`${rmr.length - RMR_COUNT} RMR row(s) exceed the template's ${RMR_COUNT}-row capacity and will be omitted.`);
  if (warnings.length > 0) {
    if (!confirm("⚠ Export warnings:\n\n" + warnings.join("\n") + "\n\nProceed anyway?")) return;
  }

  const { TAKEOFF_TEMPLATE_B64 } = await import("./takeoffTemplate");
  const zip = await JSZip.loadAsync(b64ToArrayBuffer(TAKEOFF_TEMPLATE_B64));
  const sheetPath = "xl/worksheets/sheet1.xml";
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) { alert("Template is missing xl/worksheets/sheet1.xml — cannot export."); return; }
  let xml = await sheetFile.async("string");

  // Clear ALL data rows first (rows 8–46). Writes empty/zero to inputs.
  // Leave formula cells (H, I, K, N, O, P, Q) intact — they recompute from our inputs.
  for (let r = MAT_START; r <= RMR_START + RMR_COUNT - 1; r++) {
    ["A","B","C","D","E"].forEach(c => { xml = replaceCellInXml(xml, `${c}${r}`, ""); });
    ["F","J"].forEach(c => { xml = replaceCellInXml(xml, `${c}${r}`, 0); });
    // G, L, M are formula cells; we'll overwrite them with values only when filling a row.
    // R = user-input system totals (default 0).
    xml = replaceCellInXml(xml, `R${r}`, 0);
  }

  // MATERIALS (rows 8–29)
  // Fill with app data. Overwrite G (price/unit), L (labor cost/unit), M (labor rate/unit)
  // with computed values so per-row markup + laborRate from the app are preserved.
  materials.slice(0, MAT_COUNT).forEach((m, i) => {
    const r = MAT_START + i;
    xml = replaceCellInXml(xml, `A${r}`, m.manf || "");
    xml = replaceCellInXml(xml, `B${r}`, m.partNum || "");
    xml = replaceCellInXml(xml, `C${r}`, m.desc || "");
    xml = replaceCellInXml(xml, `D${r}`, n(m.qty));
    xml = replaceCellInXml(xml, `E${r}`, m.unit || "EA");
    xml = replaceCellInXml(xml, `F${r}`, n(m.costPU));
    xml = replaceCellInXml(xml, `G${r}`, n(m.pricePU));
    xml = replaceCellInXml(xml, `J${r}`, n(m.laborHrs));
    // L = labor cost per unit. Template default uses $39/hr; app stores only a bill rate.
    // Keep $39/hr convention for material-install labor cost.
    xml = replaceCellInXml(xml, `L${r}`, 39 * n(m.laborHrs));
    // M = labor price per unit: app's laborRate × hours/unit
    xml = replaceCellInXml(xml, `M${r}`, n(m.laborRate) * n(m.laborHrs));
  });

  // FWT LABOR (rows 31–36)
  // Convention: D=1 (qty), J=total hours, L=costPerHr × hours, M=ratePerHr × hours
  // (F/G left at 0 since labor doesn't have material cost/price)
  labor.slice(0, LABOR_COUNT).forEach((lr, i) => {
    const r = LABOR_START + i;
    const hours = n(lr.hours);
    xml = replaceCellInXml(xml, `A${r}`, "FWT");
    xml = replaceCellInXml(xml, `B${r}`, "FWT");
    xml = replaceCellInXml(xml, `C${r}`, lr.desc || "");
    xml = replaceCellInXml(xml, `D${r}`, 1);
    xml = replaceCellInXml(xml, `J${r}`, hours);
    xml = replaceCellInXml(xml, `F${r}`, 0);
    xml = replaceCellInXml(xml, `G${r}`, 0);
    xml = replaceCellInXml(xml, `L${r}`, n(lr.costPerHr) * hours);
    xml = replaceCellInXml(xml, `M${r}`, n(lr.ratePerHr) * hours);
  });

  // PROJECT COSTS (rows 38–41)
  costs.slice(0, COST_COUNT).forEach((c, i) => {
    const r = COST_START + i;
    xml = replaceCellInXml(xml, `A${r}`, c.manf || "FWT");
    xml = replaceCellInXml(xml, `B${r}`, c.partNum || "FWT");
    xml = replaceCellInXml(xml, `C${r}`, c.desc || "");
    xml = replaceCellInXml(xml, `D${r}`, n(c.qty));
    xml = replaceCellInXml(xml, `E${r}`, c.unit || "EA");
    xml = replaceCellInXml(xml, `F${r}`, n(c.costPU));
    xml = replaceCellInXml(xml, `G${r}`, n(c.pricePU));
    xml = replaceCellInXml(xml, `J${r}`, 0);
    xml = replaceCellInXml(xml, `L${r}`, 0);
    xml = replaceCellInXml(xml, `M${r}`, 0);
  });

  // RMR (rows 43–46)
  rmr.slice(0, RMR_COUNT).forEach((rm, i) => {
    const r = RMR_START + i;
    xml = replaceCellInXml(xml, `A${r}`, rm.manf || "FWT");
    xml = replaceCellInXml(xml, `B${r}`, rm.partNum || "FWT-RMR");
    xml = replaceCellInXml(xml, `C${r}`, rm.desc || "");
    xml = replaceCellInXml(xml, `D${r}`, n(rm.qty));
    xml = replaceCellInXml(xml, `E${r}`, rm.unit || "MO");
    xml = replaceCellInXml(xml, `F${r}`, n(rm.costPU));
    xml = replaceCellInXml(xml, `G${r}`, n(rm.pricePU));
    xml = replaceCellInXml(xml, `J${r}`, 0);
    xml = replaceCellInXml(xml, `L${r}`, 0);
    xml = replaceCellInXml(xml, `M${r}`, 0);
  });

  // Override the template's hardcoded overhead (P48 = 0.42) with the app's overheadPct
  // so the template's margin formula (Q48) reflects the user's chosen overhead.
  xml = replaceCellInXml(xml, "P48", n(d.overheadPct) / 100);

  // Ensure Excel recalculates formulas when the file opens
  let wbXml = await zip.file("xl/workbook.xml").async("string");
  if (!/fullCalcOnLoad/.test(wbXml)) {
    if (/<calcPr\b[^/>]*\/>/.test(wbXml)) {
      wbXml = wbXml.replace(/<calcPr\b([^/>]*)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
    } else if (/<calcPr\b[^>]*>/.test(wbXml)) {
      wbXml = wbXml.replace(/<calcPr\b([^>]*)>/, '<calcPr$1 fullCalcOnLoad="1">');
    } else {
      wbXml = wbXml.replace(/<\/workbook>/, '<calcPr fullCalcOnLoad="1"/></workbook>');
    }
    zip.file("xl/workbook.xml", wbXml);
  }

  zip.file(sheetPath, xml);
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = (label || "BOM").replace(/[^a-zA-Z0-9]+/g, "_");
  a.download = `FWT_Takeoff_${safe}_${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function TakeoffBuilder({ takeoff, onSave, scopeTitle, catalog, assemblies, estDefaults, onSaveCatalogItem }) {
  const dft = estDefaults || {};
  const newMatRow = () => ({ ...emptyMaterialRow(), markupPct: dft.defaultMarkupPct ?? 25 });
  const data = takeoff || {
    materials: Array(5).fill(null).map(newMatRow),
    labor: DEFAULT_LABOR_ROWS.map(r => ({ ...r, id: genId(), costPerHr: dft.laborCostPerHr || 0, ratePerHr: dft.laborRatePerHr || 0 })),
    costs: DEFAULT_COST_ROWS.map(r => ({ ...r, id: genId() })),
    rmr: DEFAULT_RMR_ROWS.map(r => ({ ...r, id: genId() })),
    overheadPct: dft.defaultOverheadPct || 0, notes: "",
  };
  const [materials, setMaterials] = useState(data.materials);
  const [labor, setLabor] = useState(data.labor);
  const [costs, setCosts] = useState(data.costs);
  const [rmr, setRmr] = useState(data.rmr);
  const [overheadPct, setOverheadPct] = useState(data.overheadPct || 0);
  const [notes, setNotes] = useState(data.notes || "");
  function save(m, l, c, r, oh, nt) { onSave({ materials: m || materials, labor: l || labor, costs: c || costs, rmr: r || rmr, overheadPct: oh !== undefined ? oh : overheadPct, notes: nt !== undefined ? nt : notes }); }
  function updRow(arr, setArr, idx, field, val, section) { const updated = arr.map((r, i) => { if (i !== idx) return r; const row = { ...r, [field]: field === "desc" || field === "manf" || field === "partNum" || field === "unit" ? val : parseFloat(val) || 0 }; if (field === "costPU" || field === "markupPct") { const cost = field === "costPU" ? (parseFloat(val) || 0) : n(row.costPU); const markup = field === "markupPct" ? (parseFloat(val) || 0) : n(row.markupPct); row.pricePU = Math.round(cost * (1 + markup / 100) * 100) / 100; } return row; }); setArr(updated); if (section === "materials") save(updated, null, null, null); else if (section === "costs") save(null, null, updated, null); else if (section === "rmr") save(null, null, null, updated); }
  function updLaborRow(idx, field, val) { const updated = labor.map((r, i) => i === idx ? { ...r, [field]: field === "desc" ? val : parseFloat(val) || 0 } : r); setLabor(updated); save(null, updated, null, null); }
  function addLaborRow() { const updated = [...labor, { id: genId(), desc: "", hours: 0, costPerHr: 0, ratePerHr: 0, isLabor: true }]; setLabor(updated); save(null, updated, null, null); }
  function removeLaborRow(idx) { const updated = labor.filter((_, i) => i !== idx); setLabor(updated); save(null, updated, null, null); }
  function addRow(arr, setArr, template, section) { const updated = [...arr, template()]; setArr(updated); if (section === "materials") save(updated, null, null, null); else if (section === "costs") save(null, null, updated, null); else if (section === "rmr") save(null, null, null, updated); }
  function removeRow(arr, setArr, idx, section) { const updated = arr.filter((_, i) => i !== idx); setArr(updated); if (section === "materials") save(updated, null, null, null); else if (section === "costs") save(null, null, updated, null); else if (section === "rmr") save(null, null, null, updated); }
  /* ── Price book integration ────────────────────────────────── */
  const catalogItems = Object.values(catalog || {});
  const assemblyList = Object.values(assemblies || {}).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const [catQ, setCatQ] = useState("");
  const [asmId, setAsmId] = useState("");
  const [asmQty, setAsmQty] = useState(1);
  const catMatches = catQ.trim() ? catalogItems.filter(i => `${i.manf} ${i.partNum} ${i.desc} ${i.category || ""}`.toLowerCase().includes(catQ.toLowerCase())).slice(0, 8) : [];

  function rowFromCatalog(cat, qty) {
    return { id: genId(), manf: cat.manf || "", partNum: cat.partNum || "", desc: cat.desc || "", qty: qty || 1, unit: cat.unit || "EA",
      costPU: n(cat.costPU), markupPct: n(cat.markupPct), pricePU: Math.round(n(cat.costPU) * (1 + n(cat.markupPct) / 100) * 100) / 100,
      laborHrs: 0, laborRate: 0, laborUnits: { lr: n(cat.laborUnits?.lr), lt: n(cat.laborUnits?.lt), lh: n(cat.laborUnits?.lh), lp: n(cat.laborUnits?.lp) } };
  }
  function insertCatalogItem(cat) {
    // Reuse a fully-empty row if one exists, otherwise append
    const blankIdx = materials.findIndex(r => !r.manf && !r.partNum && !r.desc && !n(r.qty) && !n(r.costPU));
    const row = rowFromCatalog(cat, 1);
    const updated = blankIdx >= 0 ? materials.map((r, i) => i === blankIdx ? row : r) : [...materials, row];
    setMaterials(updated); save(updated, null, null, null); setCatQ("");
  }
  function insertAssembly() {
    const asm = assemblyList.find(a => a.id === asmId);
    const qty = n(asmQty) || 1;
    if (!asm) return;
    const newRows = [];
    (asm.items || []).forEach(it => {
      const cat = catalogItems.find(c => c.id === it.catalogId);
      if (cat) newRows.push(rowFromCatalog(cat, Math.round(n(it.qtyPer) * qty * 100) / 100));
    });
    // assembly-level labor adders ride on a zero-cost marker row so suggestions stay accurate
    const add = asm.laborAdders || {};
    if (n(add.lr) + n(add.lt) + n(add.lh) + n(add.lp) > 0) {
      newRows.push({ id: genId(), manf: "FWT", partNum: "ASSY", desc: `${asm.name} — assembly labor`, qty, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0,
        laborUnits: { lr: n(add.lr), lt: n(add.lt), lh: n(add.lh), lp: n(add.lp) } });
    }
    if (!newRows.length) return;
    const nonBlank = materials.filter(r => r.manf || r.partNum || r.desc || n(r.qty) || n(r.costPU));
    const updated = [...nonBlank, ...newRows];
    setMaterials(updated); save(updated, null, null, null); setAsmId(""); setAsmQty(1);
  }
  function saveRowToCatalog(row) {
    if (!onSaveCatalogItem || (!row.partNum && !row.desc)) return;
    const existing = catalogItems.find(c => c.partNum && row.partNum && c.partNum.toLowerCase() === row.partNum.toLowerCase() && (c.manf || "").toLowerCase() === (row.manf || "").toLowerCase());
    onSaveCatalogItem({ id: existing?.id || genId(), manf: row.manf || "", partNum: row.partNum || "", desc: row.desc || "", unit: row.unit || "EA",
      costPU: n(row.costPU), markupPct: n(row.markupPct), laborUnits: existing?.laborUnits || row.laborUnits || { lr: 0, lt: 0, lh: 0, lp: 0 } });
    alert(`${existing ? "Updated" : "Saved"} "${row.partNum || row.desc}" in the catalog${existing ? " (cost/markup refreshed, labor units kept)" : ""}.`);
  }

  // Suggested phase hours from row labor units (qty × hrs/unit)
  const PHASE_MAP = [["lr", "ROUGH IN"], ["lt", "TRIM"], ["lh", "HEAD END"], ["lp", "PROGRAMMING"]];
  const suggested = { lr: 0, lt: 0, lh: 0, lp: 0 };
  materials.forEach(r => { if (r.laborUnits) PHASE_MAP.forEach(([k]) => { suggested[k] += n(r.qty) * n(r.laborUnits[k]); }); });
  const suggestedTotal = PHASE_MAP.reduce((t, [k]) => t + suggested[k], 0);
  function applySuggested() {
    const updated = labor.map(r => {
      const hit = PHASE_MAP.find(([, label]) => (r.desc || "").toUpperCase().includes(label));
      return hit ? { ...r, hours: Math.round(suggested[hit[0]] * 4) / 4 } : r;
    });
    setLabor(updated); save(null, updated, null, null);
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
  function renderSection(title, color, rows, setRows, section, addFn, hideMarkup) { const lastCol = section === "materials" ? "44px" : "24px"; return (<div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>{rows.map((row, idx) => (<div key={row.id} style={{ display: "grid", gridTemplateColumns: hideMarkup ? `80px 90px 1fr 50px 40px 80px 80px 80px 50px 60px 80px ${lastCol}` : `80px 90px 1fr 50px 40px 80px 55px 80px 80px 50px 60px 80px ${lastCol}`, gap: 4, marginBottom: 3, alignItems: "center" }}><input style={iS} value={row.manf} onChange={e => updRow(rows, setRows, idx, "manf", e.target.value, section)} placeholder="Manf" /><input style={iS} value={row.partNum} onChange={e => updRow(rows, setRows, idx, "partNum", e.target.value, section)} placeholder="Part #" /><input style={iS} value={row.desc} onChange={e => updRow(rows, setRows, idx, "desc", e.target.value, section)} placeholder="Description" /><input type="number" style={nS} value={row.qty || ""} onChange={e => updRow(rows, setRows, idx, "qty", e.target.value, section)} placeholder="0" /><input style={iS} value={row.unit} onChange={e => updRow(rows, setRows, idx, "unit", e.target.value, section)} placeholder="EA" /><input type="number" step="0.01" style={nS} value={row.costPU || ""} onChange={e => updRow(rows, setRows, idx, "costPU", e.target.value, section)} placeholder="Cost" />{!hideMarkup && <input type="number" step="1" style={{ ...nS, color: "#f59e0b" }} value={row.markupPct ?? ""} onChange={e => updRow(rows, setRows, idx, "markupPct", e.target.value, section)} placeholder="%" />}{hideMarkup ? (<input type="number" step="0.01" style={nS} value={row.pricePU || ""} onChange={e => updRow(rows, setRows, idx, "pricePU", e.target.value, section)} placeholder="Rate" />) : (<div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${n(row.pricePU).toFixed(2)}</div>)}<div style={{ fontSize: 12, color: "#e2e8f0", textAlign: "right", fontWeight: 600 }}>${(n(row.qty) * n(row.pricePU)).toFixed(2)}</div><input type="number" step="0.5" style={nS} value={row.laborHrs || ""} onChange={e => updRow(rows, setRows, idx, "laborHrs", e.target.value, section)} placeholder="Hrs" /><input type="number" step="0.01" style={nS} value={row.laborRate || ""} onChange={e => updRow(rows, setRows, idx, "laborRate", e.target.value, section)} placeholder="Rate" /><div style={{ fontSize: 12, color: "#f59e0b", textAlign: "right", fontWeight: 600 }}>${(n(row.laborHrs) * n(row.laborRate)).toFixed(2)}</div><div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>{section === "materials" && onSaveCatalogItem && (row.partNum || row.desc) ? <button title="Save to price book" onClick={() => saveRowToCatalog(row)} style={{ background: "none", border: "none", color: "#69BE28", cursor: "pointer", padding: 1, fontSize: 11 }}>💾</button> : null}<button onClick={() => removeRow(rows, setRows, idx, section)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", padding: 1 }}><X size={12} /></button></div></div>))}<button onClick={() => addFn()} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, background: "none", border: "none", color: "#69BE28", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "4px 0" }}><Plus size={12} /> Add Row</button></div>); }
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}><div style={{ background: "#0A192F", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #69BE28" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Material Price</div><div style={{ fontSize: 18, fontWeight: 700, color: "#69BE28", fontFamily: "'Outfit',sans-serif" }}>${matTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div><div style={{ background: "#0A192F", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #f59e0b" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Labor ({totalLaborHrs}h)</div><div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", fontFamily: "'Outfit',sans-serif" }}>${laborPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div><div style={{ background: "#0A192F", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #10b981" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Total Cost</div><div style={{ fontSize: 18, fontWeight: 700, color: "#10b981", fontFamily: "'Outfit',sans-serif" }}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div><div style={{ background: "#0A192F", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #3b82f6" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Quoted Price</div><div style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6", fontFamily: "'Outfit',sans-serif" }}>${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div><div style={{ background: "#0A192F", borderRadius: 10, padding: "12px 14px", borderLeft: `3px solid ${margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444"}` }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Margin</div><div style={{ fontSize: 18, fontWeight: 700, color: margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444", fontFamily: "'Outfit',sans-serif" }}>{margin}%</div></div></div>
    {(catalogItems.length > 0 || assemblyList.length > 0) && (
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ position: "relative", flex: 2, minWidth: 240 }}>
          <input style={{ ...iS, padding: "8px 12px" }} value={catQ} onChange={e => setCatQ(e.target.value)} placeholder="🔎 Search price book — type part #, manf, or description to insert…" />
          {catMatches.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#13294d", border: "1px solid #1A3050", borderRadius: 8, zIndex: 20, maxHeight: 240, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              {catMatches.map(m => (
                <button key={m.id} onClick={() => insertCatalogItem(m)} style={{ display: "flex", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", borderBottom: "1px solid #1A3050", color: "#e2e8f0", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", alignItems: "baseline" }}>
                  <strong style={{ color: "#69BE28" }}>{m.partNum}</strong>
                  <span style={{ flex: 1, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.manf} — {m.desc}</span>
                  {m.category && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "#69BE2818", color: "#69BE28", fontWeight: 700, whiteSpace: "nowrap" }}>{m.category}</span>}
                  <span style={{ color: "#10b981", fontWeight: 600 }}>${(n(m.costPU) * (1 + n(m.markupPct) / 100)).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {assemblyList.length > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 260 }}>
            <select style={{ ...iS, flex: 1, padding: "8px 10px" }} value={asmId} onChange={e => setAsmId(e.target.value)}>
              <option value="">+ Insert assembly…</option>
              {assemblyList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input type="number" min="1" style={{ ...nS, width: 64, padding: "8px 8px" }} value={asmQty} onChange={e => setAsmQty(e.target.value)} title="Quantity of assemblies" />
            <button onClick={insertAssembly} disabled={!asmId} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: asmId ? "#8b5cf6" : "#1A3050", color: asmId ? "#fff" : "#475569", fontSize: 12.5, fontWeight: 700, cursor: asmId ? "pointer" : "default", fontFamily: "inherit" }}>Insert</button>
          </div>
        )}
      </div>
    )}
    <div style={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 50px 40px 80px 55px 80px 80px 50px 60px 80px 44px", gap: 4, marginBottom: 8, padding: "0 0 6px", borderBottom: "1px solid #1A3050" }}>{["Manf", "Part #", "Description", "Qty", "Unit", "Cost/U", "Mkup%", "Price/U", "Ext Price", "Hrs", "Rate", "Ext Labor", ""].map(h => (<div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</div>))}</div>
    {renderSection("Materials", "#69BE28", materials, setMaterials, "materials", () => addRow(materials, setMaterials, newMatRow, "materials"))}
    <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>FWT Labor</div>
    {suggestedTotal > 0 && (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#f59e0b11", border: "1px solid #f59e0b33", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#f59e0b" }}>⚡ Suggested from takeoff labor units:</span>
        {PHASE_MAP.map(([k, label]) => <span key={k} style={{ fontSize: 11.5, color: suggested[k] > 0 ? "#e2e8f0" : "#475569" }}>{label.charAt(0) + label.slice(1).toLowerCase()}: <strong>{(Math.round(suggested[k] * 4) / 4)}h</strong></span>)}
        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>· Total <strong style={{ color: "#fff" }}>{Math.round(suggestedTotal * 4) / 4}h</strong></span>
        <button onClick={applySuggested} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, border: "none", background: "#f59e0b", color: "#0A192F", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Apply to labor rows</button>
      </div>
    )}<div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginBottom: 6, padding: "0 0 6px", borderBottom: "1px solid #1A3050" }}>{["Description", "Hours", "Cost/Hr", "Labor Cost", "Rate/Hr", "Labor Price", ""].map(h => (<div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</div>))}</div>{labor.map((row, idx) => (<div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginBottom: 3, alignItems: "center" }}><input style={iS} value={row.desc} onChange={e => updLaborRow(idx, "desc", e.target.value)} placeholder="Labor description" /><input type="number" step="0.5" style={nS} value={row.hours || ""} onChange={e => updLaborRow(idx, "hours", e.target.value)} placeholder="0" /><input type="number" step="0.01" style={nS} value={row.costPerHr || ""} onChange={e => updLaborRow(idx, "costPerHr", e.target.value)} placeholder="$/hr" /><div style={{ fontSize: 12, color: "#ef4444", textAlign: "right", fontWeight: 600 }}>${(n(row.hours) * n(row.costPerHr)).toFixed(2)}</div><input type="number" step="0.01" style={nS} value={row.ratePerHr || ""} onChange={e => updLaborRow(idx, "ratePerHr", e.target.value)} placeholder="$/hr" /><div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${(n(row.hours) * n(row.ratePerHr)).toFixed(2)}</div><button onClick={() => removeLaborRow(idx)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button></div>))}<div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 90px 80px 90px 24px", gap: 4, marginTop: 6, padding: "8px 0 0", borderTop: "1px solid #1A3050" }}><div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>LABOR TOTALS</div><div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textAlign: "right" }}>{totalLaborHrs}h</div><div></div><div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textAlign: "right" }}>${laborCostTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div></div><div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textAlign: "right" }}>${laborPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div></div></div><button onClick={addLaborRow} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, background: "none", border: "none", color: "#f59e0b", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "4px 0" }}><Plus size={12} /> Add Labor Row</button></div>
    {renderSection("Project Costs", "#ef4444", costs, setCosts, "costs", () => addRow(costs, setCosts, () => ({ id: genId(), manf: "FWT", partNum: "FWT", desc: "", qty: 1, unit: "EA", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isCost: true }), "costs"))}
    {renderSection("RMR \u2014 First Month Included", "#8b5cf6", rmr, setRmr, "rmr", () => addRow(rmr, setRmr, () => ({ id: genId(), manf: "FWT", partNum: "FWT-RMR", desc: "", qty: 1, unit: "MO", costPU: 0, markupPct: 0, pricePU: 0, laborHrs: 0, laborRate: 0, isRmr: true }), "rmr"))}
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 0", borderTop: "2px solid #1A3050", marginTop: 8, flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12, color: "#64748b" }}>Overhead %:</span><input type="number" step="0.5" style={{ ...nS, width: 70 }} value={overheadPct || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; setOverheadPct(v); save(null, null, null, null, v); }} placeholder="0" /><span style={{ fontSize: 12, color: "#94a3b8" }}>(${overhead.toFixed(2)})</span></div><button onClick={() => downloadBOMCsv({ materials, labor, costs, rmr, overheadPct, notes }, scopeTitle)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #10b981", background: "#10b98122", color: "#10b981", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }} title="Export BOM as CSV — opens in Excel"><Download size={14} /> Export CSV</button><button onClick={() => downloadBOMToTemplate({ materials, labor, costs, rmr, overheadPct, notes }, scopeTitle)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #3b82f6", background: "#3b82f622", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }} title="Fill your Takeoff_2026 template and download as .xlsx"><Download size={14} /> Export to Template</button><div style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>TOTAL: ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
    <div style={{ marginTop: 12 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>Project Notes</div><textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={notes} onChange={e => { setNotes(e.target.value); save(null, null, null, null, undefined, e.target.value); }} placeholder="Notes, assumptions, special conditions..." /></div>
  </div>);
}

/* ═══════════════════════════════════════
   TEMPLATE-BASED DOCX GENERATION
   ═══════════════════════════════════════ */

function replaceSDT(xml, alias, newText) {
  const sdtRegex = /<w:sdt>[\s\S]*?<\/w:sdt>/g;
  const searchStr = 'w:val="' + alias + '"';
  let replaced = false;
  return xml.replace(sdtRegex, (sdtBlock) => {
    if (replaced) return sdtBlock;
    if (sdtBlock.includes(searchStr)) {
      replaced = true;
      let result = sdtBlock.replace(/<w:showingPlcHdr\/>/, "");
      const esc = newText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const nc = '<w:sdtContent><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/></w:rPr><w:t xml:space="preserve">' + esc + '</w:t></w:r></w:sdtContent>';
      result = result.replace(/<w:sdtContent>[\s\S]*?<\/w:sdtContent>/, nc);
      while (result.includes(searchStr)) { result = result.replace(searchStr, 'w:val="' + alias + '_DONE"'); }
      return result;
    }
    return sdtBlock;
  });
}

function replaceSDTAll(xml, alias, newText) {
  let r = xml, i = 0;
  while (r.includes('w:val="' + alias + '"') && i < 20) { r = replaceSDT(r, alias, newText); i++; }
  return r;
}

// Template has 10 body scope blocks and 10 pricing-table rows. If the user has
// fewer than 10 scopes, delete the unused body blocks AND unused pricing rows
// so the generated document doesn't show empty "Scope of Work –" headings.
function removeUnusedBodyScopes(xml, scopeCount) {
  if (scopeCount >= 10) return xml;
  // Find the positions of the first 10 "Type of Work" SDTs (the body scope headings)
  const towRegex = /<w:sdt>[\s\S]{0,400}?<w:alias w:val="Type of Work"/g;
  const positions = [];
  let m;
  while ((m = towRegex.exec(xml)) !== null) {
    positions.push(m.index);
    if (positions.length >= 10) break;
  }
  if (positions.length < 10) return xml; // template doesn't match expectations; skip
  // Find the <w:p> that each SDT lives in
  const paraStarts = positions.map(pos => {
    const p1 = xml.lastIndexOf("<w:p ", pos);
    const p2 = xml.lastIndexOf("<w:p>", pos);
    return Math.max(p1, p2);
  });
  // Find the Exclusions section AFTER scope block 10 (earlier "Exclusions" occurrences
  // are in the intro bullet list)
  const scope10Start = paraStarts[9];
  const exclusionsIdx = xml.indexOf("Exclusions", scope10Start + 500);
  if (exclusionsIdx < 0) return xml;
  const p1 = xml.lastIndexOf("<w:p ", exclusionsIdx);
  const p2 = xml.lastIndexOf("<w:p>", exclusionsIdx);
  const exclusionsParaStart = Math.max(p1, p2);
  if (exclusionsParaStart < 0) return xml;
  // Cut from the start of the first unused scope block to the start of Exclusions
  return xml.slice(0, paraStarts[scopeCount]) + xml.slice(exclusionsParaStart);
}

// Find the last <w:tr> or <w:tr ...> open tag strictly before endIdx.
// (must not match <w:trPr> which also starts with "<w:tr")
function findTableRowStartBefore(xml, endIdx) {
  let idx = endIdx;
  while (idx > 0) {
    idx = xml.lastIndexOf("<w:tr", idx);
    if (idx < 0) return -1;
    const nxt = xml[idx + 5];
    if (nxt === " " || nxt === ">") return idx;
    idx -= 1;
  }
  return -1;
}

function removeUnusedPricingRows(xml, scopeCount) {
  if (scopeCount >= 10) return xml;
  // Delete pricing rows for SoW #(scopeCount+1) through SoW #10, in reverse order
  // so positions of earlier rows stay stable as we splice
  for (let n = 10; n > scopeCount; n--) {
    const marker = `w:val="SoW #${n} Price"`;
    const sdtIdx = xml.indexOf(marker);
    if (sdtIdx < 0) continue;
    const trStart = findTableRowStartBefore(xml, sdtIdx);
    if (trStart < 0) continue;
    const trEnd = xml.indexOf("</w:tr>", sdtIdx);
    if (trEnd < 0) continue;
    xml = xml.slice(0, trStart) + xml.slice(trEnd + "</w:tr>".length);
  }
  return xml;
}

async function generateProposalDocx(d, opp) {
  const fmt = v => "$" + parseFloat(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const totalPrice = d.scopes.reduce((s, sc) => s + (parseFloat(sc.price) || 0), 0);
  const scopeCount = Math.min(d.scopes.length, 10);

  const { PROPOSAL_TEMPLATE_B64 } = await import("./proposalTemplate");
  const templateData = b64ToArrayBuffer(PROPOSAL_TEMPLATE_B64);
  const zip = await JSZip.loadAsync(templateData);
  let docXml = await zip.file("word/document.xml").async("string");

  // Step 1: strip out the body scope blocks and pricing rows we won't use.
  // Do this BEFORE any SDT fills so the sequential replaceSDT() calls only
  // see the slots we actually want to populate.
  docXml = removeUnusedBodyScopes(docXml, scopeCount);
  docXml = removeUnusedPricingRows(docXml, scopeCount);

  // Step 2: header / client fields (apostrophe in Client's is charcode 39)
  docXml = replaceSDT(docXml, "Client\u0027s Company", opp.customer || "");
  docXml = replaceSDT(docXml, "&lt;Date&gt;", d.date || "");
  docXml = replaceSDT(docXml, "Client Street Address", opp.siteAddress || "");
  docXml = replaceSDT(docXml, "Client City, State, ZIP", opp.siteCity || "");
  docXml = replaceSDT(docXml, "Expiration", String(d.expiration || 30));
  docXml = replaceSDT(docXml, "PM Name", d.pmName || "Austin Wright");
  docXml = replaceSDT(docXml, "Project Info", d.projectInfo || "");
  docXml = replaceSDTAll(docXml, "Project Name", opp.name || "");
  docXml = replaceSDTAll(docXml, "Client Name", opp.contactName || "");

  // Step 3: fill each remaining body scope block (Type of Work heading + SoW Story description)
  for (let i = 0; i < scopeCount; i++) {
    docXml = replaceSDT(docXml, "Type of Work", d.scopes[i].title || "");
    docXml = replaceSDT(docXml, "SoW Story", d.scopes[i].description || "");
  }

  // Step 4: fill the pricing table — each remaining row has one Type of Work
  // (the scope title label) and one uniquely-named SoW #N Price cell.
  for (let i = 0; i < scopeCount; i++) {
    docXml = replaceSDT(docXml, "Type of Work", d.scopes[i].title || "");
    docXml = replaceSDT(docXml, `SoW #${i + 1} Price`, fmt(d.scopes[i].price));
  }

  docXml = replaceSDT(docXml, "Total Price", fmt(totalPrice));

  zip.file("word/document.xml", docXml);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
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
export function ProposalBuilder({ opportunity, proposal, onSave, catalog, assemblies, estDefaults, onSaveCatalogItem }) {
  const SYSTEM_TYPES = ["Access Control", "Intrusion Alarm", "Security Cameras", "Sound Masking"];
  const data = proposal || { date: new Date().toISOString().split("T")[0], expiration: 30, pmName: "Austin Wright", pmTitle: "Project Manager", pmPhone: "239.565.9270", pmEmail: "austinw@farwesttechnologies.com", projectInfo: "", scopes: [{ id: genId(), title: "", description: "", fieldDevices: "", headendDevices: "", price: "" }], exclusions: DEFAULT_EXCLUSIONS.map((e, i) => ({ id: "ex" + i, text: e, included: true })), terms: DEFAULT_TERMS.map((t, i) => ({ id: "tm" + i, text: t, included: true })), systemTypes: { "Access Control": false, "Intrusion Alarm": false, "Security Cameras": false, "Sound Masking": false } };
  const [d, setD] = useState(data);
  const [generating, setGenerating] = useState(false);
  function upd(updates) { const updated = { ...d, ...updates }; setD(updated); onSave(updated); }
  const totalPrice = d.scopes.reduce((s, sc) => s + (parseFloat(sc.price) || 0), 0);
  const opp = opportunity || {};
  const pS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lbS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  function pullFromScopeBOM(scopeIdx) {
    const scope = d.scopes[scopeIdx];
    const tk = scope.takeoff;
    if (!tk) return;
    const matT = (tk.materials || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)) + (n(r.laborHrs) * n(r.laborRate)), 0);
    const labT = (tk.labor || []).reduce((s, r) => s + (n(r.hours) * n(r.ratePerHr)), 0);
    const cosT = (tk.costs || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
    const rmrT = (tk.rmr || []).reduce((s, r) => s + (n(r.qty) * n(r.pricePU)), 0);
    const sub = matT + labT + cosT + rmrT;
    const total = sub + sub * (n(tk.overheadPct) / 100);
    upd({ scopes: d.scopes.map((s, i) => i === scopeIdx ? { ...s, price: total.toFixed(2) } : s) });
  }

  async function handleGenerate() { setGenerating(true); try { await generateProposalDocx(d, opp); } catch (err) { console.error("Proposal generation error:", err); alert("Error generating proposal. Check console for details."); } setGenerating(false); }

  return (<div>
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}><button onClick={handleGenerate} disabled={generating} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: generating ? "#475569" : "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: generating ? "wait" : "pointer", fontFamily: "inherit" }}><Download size={14} /> {generating ? "Generating..." : "Generate Proposal (.docx)"}</button></div>
    <div style={{ background: "#0A192F", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1A3050" }}><div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Cover Page</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}><div><label style={lbS}>Date</label><input type="date" style={pS} value={d.date} onChange={e => upd({ date: e.target.value })} /></div><div><label style={lbS}>Expiration (days)</label><input type="number" style={pS} value={d.expiration} onChange={e => upd({ expiration: parseInt(e.target.value) || 30 })} /></div><div><label style={lbS}>Prepared By</label><input style={pS} value={d.pmName} onChange={e => upd({ pmName: e.target.value })} placeholder="PM Name" /></div><div><label style={lbS}>PM Title</label><input style={pS} value={d.pmTitle} onChange={e => upd({ pmTitle: e.target.value })} /></div><div><label style={lbS}>PM Phone</label><input style={pS} value={d.pmPhone} onChange={e => upd({ pmPhone: e.target.value })} /></div><div><label style={lbS}>PM Email</label><input style={pS} value={d.pmEmail} onChange={e => upd({ pmEmail: e.target.value })} /></div><div style={{ gridColumn: "span 3" }}><label style={lbS}>Project Info Source</label><input style={pS} value={d.projectInfo} onChange={e => upd({ projectInfo: e.target.value })} placeholder="specifications, drawings, site walk dated 01-01-2025, etc." /></div></div></div>
    <div style={{ background: "#0A192F", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1A3050" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Scope(s) of Work (max 10)</span>{d.scopes.length < 10 && <button onClick={() => upd({ scopes: [...d.scopes, { id: genId(), title: "", description: "", fieldDevices: "", headendDevices: "", price: "" }] })} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#69BE28", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}><Plus size={13} /> Add Scope</button>}</div>{d.scopes.map((scope, si) => (<div key={scope.id} style={{ background: "#0F2444", borderRadius: 10, padding: 16, marginBottom: 10, border: "1px solid #1A3050" }}><div style={{ display: "flex", gap: 8, marginBottom: 10 }}><input style={{ ...pS, flex: 2 }} value={scope.title} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, title: e.target.value } : s) })} placeholder="Type of Work (e.g., Security Cameras)" /><input type="number" step="0.01" style={{ ...pS, flex: 0.8 }} value={scope.price} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, price: e.target.value } : s) })} placeholder="Price" />{d.scopes.length > 1 && <button onClick={() => upd({ scopes: d.scopes.filter((_, i) => i !== si) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={14} /></button>}</div><div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Description (do NOT include &quot;FAR West Technologies will provide and install&quot; — already in template):</div><textarea style={{ ...pS, minHeight: 80, resize: "vertical", marginBottom: 10 }} value={scope.description} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, description: e.target.value } : s) })} placeholder="a video surveillance system with 8 cameras, an NVR, and all related equipment..." /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Field Devices (one per line):</div><textarea style={{ ...pS, minHeight: 60, resize: "vertical" }} value={scope.fieldDevices || ""} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, fieldDevices: e.target.value } : s) })} placeholder="Install (8) IP Dome cameras..." /></div><div><div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Headend Devices (one per line):</div><textarea style={{ ...pS, minHeight: 60, resize: "vertical" }} value={scope.headendDevices || ""} onChange={e => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, headendDevices: e.target.value } : s) })} placeholder="Install (1) 16 Port POE+ switch..." /></div></div>
            {/* Per-Scope BOM */}
            <div style={{ marginTop: 12, borderTop: "1px solid #1A3050", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <button onClick={() => { const expanded = { ...(d._expandedBOMs || {}), [si]: !(d._expandedBOMs || {})[si] }; setD({ ...d, _expandedBOMs: expanded }); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #1A3050", borderRadius: 8, padding: "6px 12px", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {(d._expandedBOMs || {})[si] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  📊 Scope BOM / Takeoff
                </button>
                {scope.takeoff && <button onClick={() => pullFromScopeBOM(si)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Calculator size={12} /> Calculate Price from BOM</button>}
              </div>
              {(d._expandedBOMs || {})[si] && (
                <div style={{ background: "#001528", borderRadius: 10, border: "1px solid #1A3050", padding: 16 }}>
                  <TakeoffBuilder takeoff={scope.takeoff} catalog={catalog} assemblies={assemblies} estDefaults={estDefaults} onSaveCatalogItem={onSaveCatalogItem} onSave={tk => upd({ scopes: d.scopes.map((s, i) => i === si ? { ...s, takeoff: tk } : s) })} />
                </div>
              )}
            </div>
          </div>))}<div style={{ textAlign: "right", fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", marginTop: 8 }}>Total: ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
    <div style={{ background: "#0A192F", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1A3050" }}><div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Exclusions</div>{d.exclusions.map((ex, i) => (<div key={ex.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid #1A30500a" }}><button onClick={() => upd({ exclusions: d.exclusions.map((e, idx) => idx === i ? { ...e, included: !e.included } : e) })} style={{ background: "none", border: "none", cursor: "pointer", color: ex.included ? "#10b981" : "#334155", flexShrink: 0, marginTop: 2, fontSize: 14 }}>{ex.included ? "\u2611" : "\u2610"}</button><span style={{ fontSize: 12, color: ex.included ? "#e2e8f0" : "#475569", flex: 1 }}>{ex.text}</span></div>))}<div style={{ display: "flex", gap: 6, marginTop: 10 }}><input id="newExcl" style={{ ...pS, flex: 1 }} placeholder="Add custom exclusion..." onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { upd({ exclusions: [...d.exclusions, { id: genId(), text: e.target.value.trim(), included: true }] }); e.target.value = ""; } }} /></div></div>
    <div style={{ background: "#0A192F", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #1A3050" }}><div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Terms & Conditions</div>{d.terms.map((term, i) => (<div key={term.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid #1A30500a" }}><button onClick={() => upd({ terms: d.terms.map((t, idx) => idx === i ? { ...t, included: !t.included } : t) })} style={{ background: "none", border: "none", cursor: "pointer", color: term.included ? "#10b981" : "#334155", flexShrink: 0, marginTop: 2, fontSize: 14 }}>{term.included ? "\u2611" : "\u2610"}</button><span style={{ fontSize: 12, color: term.included ? "#e2e8f0" : "#475569", flex: 1 }}>{term.text === "NETWORK_TERM" ? (<span>Customer shall provide minimum (1) LAN & WAN network connection for each of the following systems:<div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>{SYSTEM_TYPES.map(st => (<button key={st} onClick={() => upd({ systemTypes: { ...d.systemTypes, [st]: !(d.systemTypes || {})[st] } })} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #1A3050", fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: (d.systemTypes || {})[st] ? "#69BE28" : "transparent", color: (d.systemTypes || {})[st] ? "#fff" : "#64748b" }}>{(d.systemTypes || {})[st] ? "\u2611" : "\u2610"} {st}</button>))}</div></span>) : term.text}</span></div>))}</div>
  </div>);
}
