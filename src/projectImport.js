/**
 * projectImport.js — turns a job folder's files into a project record.
 *
 * Parses the three FWT document types and merges them into one candidate
 * that the review queue displays before anything is created:
 *
 *   PIF-<job>.xlsx       backbone — job #, PM, addresses, contacts, billing,
 *                        bid $/hours, and the Schedule of Values that drives
 *                        invoice progress. Fixed cell addresses, so these are
 *                        direct reads rather than pattern guesses.
 *   01_TAKEOFF… / 01_TO…   materials line items + labor hours by category.
 *   03_PRO… / …Proposal    scope narrative and, when the pricing table is inline
 *                        rather than an embedded image, the price breakdown.
 *
 * Everything runs in the browser: SheetJS for Excel, JSZip for .docx (both
 * already dependencies, both lazy-loaded so field techs never download them).
 *
 * Nothing here writes to the database. It returns a candidate for review.
 */

import { LABOR_PHASES, genId } from "./App.jsx";

/** PM names that mean "this is our team's job". Matched loosely on purpose —
 *  real PIFs contain AUSTIM, and initials/typos are common. */
export const DEFAULT_TEAM_NAMES = ["austin", "austim", "tim", "aw", "tb"];

const cellNum = v => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
};
const clean = v => (typeof v === "string" ? v.trim() : v ?? "");

/* ── file classification by name ─────────────────────────────── */
export function classifyFile(name, path) {
  const n = name.toLowerCase();
  const inCloseout = /close[\s_-]?out/i.test(path || "");
  // Invoices live in the job's closeout folder. Accept any document there
  // that looks like an invoice, plus INV-named files found anywhere.
  if (/\.(pdf|docx?|xlsx?)$/.test(n) && (/(^|[^a-z])(inv|invoice|pi)[-_ #]?\d|billing/.test(n) || inCloseout)) {
    if (!/^pif|[-_]pif[-_]/.test(n)) return "invoice";
  }
  if (/^pif|[-_]pif[-_]|pif-\d/.test(n) && /\.xlsx?$/.test(n)) return "pif";
  if (/\.xlsx?$/.test(n) && /(takeoff|^01_to|_to\d{2}_|bom)/.test(n)) return "takeoff";
  if (/\.docx$/.test(n) && /(pro\d{2}|proposal|_pro_)/.test(n)) return "proposal";
  if (/\.xlsx?$/.test(n)) return "takeoff";     // spreadsheets in a job folder are usually takeoffs
  if (/\.docx$/.test(n)) return "proposal";
  return "other";
}

/** Job number from a filename like PIF-260349.xlsx, or from folder path. */
export function jobNumberFromName(name, path) {
  const m = (path || name).match(/\b(2[0-9]{5})\b/);
  return m ? m[1] : null;
}

/* ── Invoices (closeout folder) ───────────────────────────────
   Amounts come from the PIF's Schedule of Values, which is authoritative.
   These files supply the invoice numbers, dates, and the documents
   themselves — and give us something to reconcile the SOV against. */
export function parseInvoiceFile(file) {
  const name = file.name.replace(/\.[^.]+$/, "");
  // invoice number: INV-1234, INV 1234, PI#02, 260349-PI01, or a bare 4-6 digit run
  let number = "";
  const patterns = [
    /(?:inv(?:oice)?)[-_ #]*([A-Za-z0-9]{2,12})/i,
    /\bpi[-_ #]*0*(\d{1,2})\b/i,
    /\b(\d{4,6})\b/,
  ];
  for (const re of patterns) { const m = name.match(re); if (m) { number = m[1]; break; } }
  if (/\bpi[-_ #]*0*\d{1,2}\b/i.test(name) && number && !/^inv/i.test(number)) number = "PI#" + String(number).padStart(2, "0");

  // date: 2026-03-08 / 03-08-2026 / 030826, else the file's own timestamp
  let date = "";
  const d1 = name.match(/\b(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})\b/);
  const d2 = name.match(/\b(\d{2})[-_.](\d{2})[-_.](20\d{2})\b/);
  if (d1) date = `${d1[1]}-${d1[2]}-${d1[3]}`;
  else if (d2) date = `${d2[3]}-${d2[1]}-${d2[2]}`;
  else if (file.lastModified) date = new Date(file.lastModified).toISOString().split("T")[0];

  const amt = name.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  return {
    fileName: file.name,
    path: file.webkitRelativePath || "",
    number, date,
    amountFromName: amt ? parseFloat(amt[1].replace(/,/g, "")) : null,
    sizeKB: Math.round((file.size || 0) / 1024),
  };
}

/** Build invoice records: SOV progress columns give the amounts, closeout
 *  files give numbers/dates/documents. Matched in order when counts line up. */
export function reconcileInvoices(pif, invoiceFiles) {
  const out = { records: [], warnings: [] };
  const sovCols = [];
  if (pif?.invoicing?.progressDraws?.length) sovCols.push(...pif.invoicing.progressDraws);

  const files = [...invoiceFiles].sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.fileName.localeCompare(b.fileName));

  if (sovCols.length === 0 && files.length === 0) return out;

  if (sovCols.length && files.length && sovCols.length !== files.length) {
    out.warnings.push(`PIF shows ${sovCols.length} progress invoice${sovCols.length > 1 ? "s" : ""} billed but the closeout folder has ${files.length} invoice file${files.length > 1 ? "s" : ""} — check for a missing or extra copy.`);
  }

  const n = Math.max(sovCols.length, files.length);
  for (let i = 0; i < n; i++) {
    const draw = sovCols[i], f = files[i];
    out.records.push({
      id: genId(),
      invoiceNumber: f?.number || draw?.label || `PI#${String(i + 1).padStart(2, "0")}`,
      amount: draw ? String(Math.round(draw.amount * 100) / 100) : (f?.amountFromName != null ? String(f.amountFromName) : ""),
      date: f?.date || "",
      description: draw ? `${draw.label} — ${Math.round(draw.pct * 100)}% progress billing` : "From closeout folder",
      status: "sent",
      sourceFile: f?.fileName || "",
      amountSource: draw ? "PIF schedule of values" : (f?.amountFromName != null ? "filename" : "unknown"),
      createdAt: new Date().toISOString(),
    });
  }
  const noAmt = out.records.filter(r => !r.amount).length;
  if (noAmt) out.warnings.push(`${noAmt} invoice${noAmt > 1 ? "s have" : " has"} no readable amount — set them by hand after import.`);
  return out;
}

/* ── PIF ──────────────────────────────────────────────────────── */
export async function parsePIF(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = wb.Sheets["PIF 2024"] || wb.Sheets[wb.SheetNames[0]];
  const at = addr => (sheet[addr] ? clean(sheet[addr].v) : "");
  const numAt = addr => cellNum(sheet[addr]?.v);

  const jobNumber = String(at("C9") || at("F3") || "").replace(/\.0$/, "");
  const addrLine = [at("C21"), at("C22")].filter(Boolean).join(" ");
  const cityLine = [at("C23"), at("C24"), at("C25")].filter(Boolean).join(", ").replace(/, ([A-Z]{2}), /, ", $1 ");

  // Schedule of values → invoice progress (rows 56–65, D..J are PI#01..07)
  const lineItems = [];
  let invoiced = 0;
  for (let r = 56; r <= 65; r++) {
    const label = at(`A${r}`), total = numAt(`C${r}`);
    if (!label || !total) continue;
    let lineInv = 0;
    for (const col of ["D", "E", "F", "G", "H", "I", "J"]) lineInv += cellNum(sheet[`${col}${r}`]?.v) * total;
    invoiced += lineInv;
    lineItems.push({ item: String(label).trim(), total, pctToDate: numAt(`K${r}`), invoicedToDate: Math.round(lineInv * 100) / 100 });
  }
  const contractTotal = numAt("C66") || numAt("C69") || numAt("C68");
  // Each PI# column that carries value is one progress invoice already billed.
  const progressDraws = [];
  ["D", "E", "F", "G", "H", "I", "J"].forEach((col, idx) => {
    let drawTotal = 0;
    for (let r = 56; r <= 65; r++) drawTotal += cellNum(sheet[`${col}${r}`]?.v) * numAt(`C${r}`);
    if (drawTotal > 0) progressDraws.push({
      label: clean(sheet[`${col}55`]?.v) || `PI#${String(idx + 1).padStart(2, "0")}`,
      amount: Math.round(drawTotal * 100) / 100,
      pct: contractTotal ? drawTotal / contractTotal : 0,
    });
  });

  // "Name <email> Name2 <email2>" jammed into one cell — split into contacts
  const blob = `${at("C20")} ${at("C28")}`;
  const contacts = [];
  const re = /([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)*)\s*<([^>]+)>/g;
  let m;
  while ((m = re.exec(blob))) {
    const email = m[2].trim().toLowerCase();
    if (!contacts.some(c => c.email === email)) contacts.push({ id: genId(), name: m[1].trim(), email, phone: "" });
  }
  if (contacts.length === 0 && at("C20")) contacts.push({ id: genId(), name: at("C20"), email: at("C28") || "", phone: "" });
  if (contacts[0]) { contacts[0].primary = true; contacts[0].phone = at("C26") || ""; }

  return {
    jobNumber,
    name: at("C8"),
    projectManager: at("C13"),
    prevailingWage: String(at("C14")).toUpperCase() === "YES",
    taxable: String(at("C12")).toUpperCase() === "YES",
    siteCompany: at("C19"),
    siteAddress: [addrLine, cityLine].filter(Boolean).join(", "),
    contacts,
    contactName: contacts[0]?.name || "",
    contactEmail: contacts[0]?.email || "",
    contactPhone: at("C26") || "",
    customer: at("C42") || at("C19"),
    billingContact: at("C43"),
    billingEmail: at("C51"),
    poNumber: at("C52"),
    bidAmount: numAt("C68") || contractTotal,
    contractAmount: numAt("C69") || contractTotal,
    pifBidHours: numAt("C71"),
    pifScope: at("A76"),
    invoicing: contractTotal > 0 ? {
      contractTotal,
      invoicedToDate: Math.round(invoiced * 100) / 100,
      pctInvoiced: contractTotal ? Math.round((invoiced / contractTotal) * 10000) / 10000 : 0,
      lineItems,
      progressDraws,
      source: "PIF",
      syncedAt: new Date().toISOString(),
    } : null,
  };
}

/* ── Takeoff ──────────────────────────────────────────────────── */
/** Map a takeoff labor description to one of the app's labor phases.
 *  Newer takeoffs spell the phase out ("LABOR - ROUGH IN"); legacy ones use
 *  shorthand like "LABOR INSTALL" or "LABOR PROG-ELEV-PM", so ordering here
 *  matters — the most specific patterns are checked first. */
const LABOR_RULES = [
  [/ROUGH/, "rough-in"],
  [/TRIM/, "trim-out"],
  [/HEAD\s*(END|IN)/, "head-in"],
  [/COMMISSION/, "commissioning"],
  [/TRAIN/, "training"],
  [/PROG/, "programming"],
  [/PROJECT\s*MG|(^|[^A-Z])PM([^A-Z]|$)/, "pm"],
  [/TRAVEL|PERDIEM/, "misc"],
  [/INSTALL|^LABOR$/, "rough-in"],
];
export function mapLaborCategory(desc) {
  const d = String(desc || "").toUpperCase();
  for (const [re, id] of LABOR_RULES) if (re.test(d)) return id;
  return "misc";
}

export async function parseTakeoff(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets["Takeoff"] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const scope = file.name.replace(/\.[^.]+$/, "").replace(/^01_(TAKEOFF|TO\d{2})_/i, "").replace(/_/g, " ").trim();

  const materials = [], labor = {};
  let totalHours = 0;
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i] || [];
    const [manf, part, desc, qty, unit, costPU, pricePU] = [r[0], r[1], r[2], r[3], r[4], r[5], r[6]];
    const hrs = cellNum(r[10]);                       // K = Total Hrs This Item
    if (String(manf || "").toLowerCase().startsWith("total")) continue;
    if (!desc) continue;
    if (hrs > 0) {
      const cat = mapLaborCategory(desc);
      labor[cat] = (labor[cat] || 0) + hrs;
      totalHours += hrs;
    } else if (cellNum(qty) > 0 && cellNum(costPU) > 0) {
      materials.push({
        id: genId(),
        item: String(desc).trim(),
        manufacturer: clean(manf) || "",
        partNumber: clean(part) || "",     // often blank — imported as-is
        vendor: "",
        qtyNeeded: cellNum(qty),
        qtyOnHand: "",
        poNumber: "",
        status: "Pending Quote",
        deliveryDate: "",
        cost: cellNum(costPU),
        notes: scope ? `Takeoff: ${scope}` : "",
      });
    }
  }
  return { scope, materials, labor, totalHours };
}

/* ── Proposal (.docx) ─────────────────────────────────────────── */
/** Minimal docx → text. Paragraphs become lines; table rows become
 *  pipe-delimited lines so the pricing table can be read positionally. */
async function docxToLines(file) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml").async("string");
  const textOf = frag => frag
    .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, "")     // field codes, not content
    .replace(/<w:tab\b[^>]*\/>/g, " ")
    .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, "")           // quote-aware tag strip

    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

  const lines = [];
  // Walk tables and paragraphs in document order
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
  let m;
  while ((m = re.exec(xml))) {
    const chunk = m[0];
    if (chunk.startsWith("<w:tbl")) {
      const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
      let rm;
      while ((rm = rowRe.exec(chunk))) {
        const cells = (rm[0].match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(textOf);
        if (cells.some(Boolean)) lines.push("| " + cells.join(" | ") + " |");
      }
    } else {
      const t = textOf(chunk);
      if (t) lines.push(t);
    }
  }
  return lines;
}

const moneyIn = t => {
  const m = String(t || "").match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
};

export async function parseProposal(file) {
  const lines = await docxToLines(file);
  const out = { pricingFound: false, pricingSource: null };

  // Header table: Date / Project Name / Prepared by (label spelling varies)
  const hdr = label => {
    for (const l of lines.slice(0, 14)) {
      if (!l.includes("|")) continue;
      const cells = l.split("|").map(c => c.trim());
      for (let i = 0; i < cells.length; i++) {
        if (new RegExp(`^${label}\\s*:?$`, "i").test(cells[i].replace(/\*/g, "")) && cells[i + 1]) return cells[i + 1];
      }
    }
    return "";
  };
  out.proposalDate = hdr("Date");
  out.projectName = hdr("Project ?Name");
  out.preparedBy = hdr("Prepared by");

  const firstRow = (lines.find(l => l.includes("|")) || "").split("|").map(c => c.trim()).filter(Boolean);
  out.customer = firstRow[0] || "";
  const addr = [];
  for (const l of lines.slice(0, 8)) {
    if (!l.includes("|")) continue;
    const c = l.split("|").map(x => x.trim());
    const v = c[1] || "";
    if (!v || v.startsWith("---") || v.includes("**")) continue;
    if (/^attn\s*:/i.test(v)) { out.contactName = v.replace(/^attn\s*:\s*/i, "").trim(); break; }
    addr.push(v.replace(/,$/, ""));
  }
  out.siteAddress = addr.join(", ");

  // Pricing — inline table, or flagged when it lives in an embedded image
  let pi = -1;
  lines.forEach((l, i) => { if (/project pricing/i.test(l.replace(/\*/g, ""))) pi = i; });
  if (pi >= 0) {
    for (const l of lines.slice(pi, pi + 25)) {
      if (!l.includes("|")) continue;
      const cells = l.split("|").map(c => c.replace(/\*/g, "").trim());
      const label = (cells[1] || "").toLowerCase();
      const val = moneyIn(l);
      if (val == null) continue;
      out.pricingFound = true;
      if (/total project price/.test(label)) out.totalPrice = val;
      else if (/part|material/.test(label)) out.materialPrice = val;
      else if (/labor/.test(label)) out.laborPrice = val;
    }
    if (out.pricingFound) out.pricingSource = "inline";
    else if (lines.slice(pi, pi + 25).some(l => /attachment/i.test(l))) out.pricingSource = "attachment-image";
  }

  // Scope narrative: Scope of Work → Exclusions
  const s = lines.findIndex(l => /scope of work\s*\**\s*[–-]/i.test(l.replace(/\*/g, "")));
  let e = -1;
  lines.forEach((l, i) => { if (e < 0 && i > s && /^\**exclusions/i.test(l.replace(/\*/g, "").trim())) e = i; });
  if (s >= 0) {
    out.scopeNotes = lines.slice(s, e > s ? e : undefined)
      .map(l => l.replace(/\*+/g, "").trim()).filter(Boolean).join("\n").slice(0, 4000);
  }
  return out;
}

/* ── Merge into one review candidate ──────────────────────────── */
export async function buildCandidate(files, teamNames = DEFAULT_TEAM_NAMES) {
  const cand = { id: genId(), files: [], warnings: [], takeoffScopes: [] };
  let pif = null, proposal = null;
  const materials = [], labor = {}, invoiceFiles = [];

  for (const f of files) {
    const kind = classifyFile(f.name, f.webkitRelativePath);
    cand.files.push({ name: f.name, kind });
    try {
      if (kind === "pif" && !pif) pif = await parsePIF(f);
      else if (kind === "takeoff") {
        const t = await parseTakeoff(f);
        materials.push(...t.materials);
        Object.entries(t.labor).forEach(([k, v]) => { labor[k] = (labor[k] || 0) + v; });
        cand.takeoffScopes.push({ scope: t.scope, items: t.materials.length, hours: t.totalHours });
      } else if (kind === "proposal" && !proposal) proposal = await parseProposal(f);
    } catch (err) {
      cand.warnings.push(`Couldn't read ${f.name}: ${err.message}`);
    }
  }

  if (!pif) {
    cand.warnings.push("No PIF found — job number, contacts, and invoicing can't be filled in.");
    cand.jobNumber = jobNumberFromName(files[0]?.name || "", files[0]?.webkitRelativePath) || "";
  }

  const p = pif || {};
  const pm = String(p.projectManager || "");
  cand.projectManager = pm;
  cand.assignedToTeam = !pm || teamNames.some(t => pm.toLowerCase().includes(t.toLowerCase()));
  cand.jobNumber = p.jobNumber || cand.jobNumber || "";
  cand.name = p.name || proposal?.projectName || "";
  cand.customer = p.customer || proposal?.customer || "";
  cand.siteAddress = p.siteAddress || proposal?.siteAddress || "";
  cand.contacts = p.contacts || (proposal?.contactName ? [{ id: genId(), name: proposal.contactName, email: "", phone: "", primary: true }] : []);
  cand.scopeNotes = proposal?.scopeNotes || p.pifScope || "";
  cand.prevailingWage = !!p.prevailingWage;
  cand.poNumber = p.poNumber || "";
  cand.billingContact = p.billingContact || "";
  cand.billingEmail = p.billingEmail || "";
  cand.invoicing = p.invoicing || null;
  cand.materials = materials;

  const rec = reconcileInvoices(p, invoiceFiles);
  cand.invoices = rec.records;
  cand.invoiceFiles = invoiceFiles;
  rec.warnings.forEach(w => cand.warnings.push(w));

  // Price: PIF is authoritative; proposal fills in when the PIF has none
  cand.bidAmount = p.bidAmount || proposal?.totalPrice || 0;
  cand.contractAmount = p.contractAmount || proposal?.totalPrice || 0;
  cand.proposalPricing = proposal && proposal.pricingFound
    ? { total: proposal.totalPrice, material: proposal.materialPrice, labor: proposal.laborPrice }
    : null;
  if (proposal && proposal.pricingSource === "attachment-image") {
    cand.warnings.push("Proposal pricing is an embedded image (Attachment A) — using the PIF figure instead.");
  }

  // Labor: takeoff hours become the bid per phase
  cand.laborHours = {};
  Object.entries(labor).forEach(([cat, hrs]) => { cand.laborHours[cat] = { bid: Math.round(hrs * 10) / 10 }; });
  cand.takeoffHours = Math.round(Object.values(labor).reduce((a, b) => a + b, 0) * 10) / 10;
  cand.pifBidHours = p.pifBidHours || 0;
  if (cand.pifBidHours && cand.takeoffHours && Math.abs(cand.pifBidHours - cand.takeoffHours) > 0.5) {
    cand.warnings.push(`Takeoff hours (${cand.takeoffHours}) don't match the PIF's bid hours (${cand.pifBidHours}).`);
  }
  if (!cand.jobNumber) cand.warnings.push("No job number found — set one before adding.");
  return cand;
}

/** Candidate → the app's project record. */
export function candidateToProject(c) {
  return {
    name: c.name || `Job ${c.jobNumber}`,
    jobNumber: c.jobNumber || "",
    customer: c.customer || "",
    contactName: c.contacts?.[0]?.name || "",
    contactPhone: c.contacts?.[0]?.phone || "",
    contactEmail: c.contacts?.[0]?.email || "",
    contacts: c.contacts || [],
    siteAddress: c.siteAddress || "",
    scopeNotes: c.scopeNotes || "",
    bidAmount: c.bidAmount ? String(c.bidAmount) : "",
    contractAmount: c.contractAmount ? String(c.contractAmount) : "",
    prevailingWage: !!c.prevailingWage,
    poNumber: c.poNumber || "",
    projectManager: c.projectManager || "",
    laborHours: Object.keys(c.laborHours || {}).length ? c.laborHours : null,
    materials: c.materials || [],
    invoicing: c.invoicing || null,
    invoices: (c.invoices || []).map(({ file, ...rest }) => rest),
    documents: (c.invoiceFiles || []).map(f => ({
      name: f.number ? `Invoice ${f.number}` : f.fileName,
      type: "Invoice",
      fileName: f.fileName,
      sourcePath: f.path,
      addedAt: new Date().toISOString(),
    })),
    importedFrom: { files: (c.files || []).map(f => f.name), importedAt: new Date().toISOString() },
  };
}

export { LABOR_PHASES };
