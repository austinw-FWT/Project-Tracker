/**
 * projectImport.js — turns a job folder's files into a project record.
 *
 * You pick the files (any folder, any number of batches) and say what each
 * one is for; the readers below pull the data out and the review screen shows
 * exactly where it will land before anything is written:
 *
 *   PIF-<job>.xlsx       backbone — job #, PM, addresses, contacts, billing,
 *                        bid $/hours, and the Schedule of Values that drives
 *                        invoice progress. Fixed cell addresses, so these are
 *                        direct reads rather than pattern guesses.
 *   01_TAKEOFF… / 01_TO…   materials line items + labor hours by category.
 *   03_PRO… / …Proposal    the full Scope of Work section (bullets and nesting
 *                        kept, no length cap), the checked Exclusions, and the
 *                        price breakdown when it's inline rather than an image.
 *   Closeout invoices      invoice numbers/dates, amounts from the PIF's SOV.
 *   Anything else          saved to Documents with a type and visibility.
 *
 * Everything runs in the browser: SheetJS for Excel, JSZip for .docx (both
 * already dependencies, both lazy-loaded so field techs never download them).
 *
 * Nothing here writes to the database. buildProjectChanges() returns the
 * record (new job) or update (existing job) and App.jsx writes it.
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

/* ── grouping: which files belong to the same job ─────────────
   A job folder normally contains subfolders (02_PIF, 01_Takeoffs,
   04_Closeout…), so grouping by a file's immediate parent would treat every
   subfolder as its own project. Instead we locate the JOB FOLDER itself:
     1. a path segment carrying a job number (2xxxxx) marks it;
     2. failing that, each PIF defines a job — its root is the shallowest
        ancestor not shared with another PIF;
     3. failing that, the whole selection is a single job.
   Files attach to the longest matching root, so anything nested at any
   depth lands on the right project. */
export function groupFilesByJob(files) {
  const pathOf = f => f.webkitRelativePath || f.name;
  const split = p => p.split("/").filter(Boolean);
  const JOB_SEG = /\b(2\d{5})\b/;
  const isPifPath = p => classifyFile(split(p).pop() || "", p) === "pif";

  const paths = files.map(pathOf);
  const roots = new Set();
  for (const p of paths) {
    const seg = split(p);
    // Only FOLDER segments can be a job root. Without this guard a filename
    // carrying the job number (PIF-260349.xlsx) is mistaken for the job
    // folder, so the PIF splits off alone and its siblings fall through to
    // __unmatched__ — which is what made subfolders look like separate jobs.
    const folders = seg.slice(0, -1);
    const i = folders.findIndex(x => JOB_SEG.test(x));
    if (i >= 0) roots.add(folders.slice(0, i + 1).join("/"));
  }
  if (roots.size === 0) {
    const pifs = paths.filter(isPifPath);
    if (pifs.length > 1) {
      for (const p of pifs) {
        const seg = split(p);
        for (let d = 1; d < seg.length; d++) {
          const anc = seg.slice(0, d).join("/");
          if (!pifs.some(q => q !== p && (q === anc || q.startsWith(anc + "/")))) { roots.add(anc); break; }
        }
      }
    }
  }

  const groups = new Map();
  if (roots.size === 0) { groups.set("", files); return groups; }
  const sorted = [...roots].sort((a, b) => b.length - a.length);
  for (const f of files) {
    const p = pathOf(f);
    const root = sorted.find(r => p === r || p.startsWith(r + "/")) ?? "__unmatched__";
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(f);
  }
  return groups;
}

/* ── file classification by name ─────────────────────────────── */
export function classifyFile(name, path) {
  const n = (name || "").toLowerCase();
  const inCloseout = /close[\s_-]?out/i.test(path || "");
  if (/\.(pdf|docx?|xlsx?)$/.test(n) && (/(^|[^a-z])(inv|invoice|pi)[-_ #]?\d|billing/.test(n) || inCloseout)) {
    if (!/^pif|[-_]pif[-_]/.test(n)) return "invoice";
  }
  if (/^pif|[-_]pif[-_]|pif-\d/.test(n) && /\.xlsx?$/.test(n)) return "pif";
  if (/\.xlsx?$/.test(n) && /(takeoff|^01_to|_to\d{2}_|bom)/.test(n)) return "takeoff";
  if (/\.docx$/.test(n) && /(pro\d{2}|proposal|_pro_)/.test(n)) return "proposal";
  if (/\.xlsx?$/.test(n)) return "takeoff";
  if (/\.docx$/.test(n)) return "proposal";
  return "other";
}

/** Job number from a filename like PIF-260349.xlsx, or from the folder path. */
export function jobNumberFromName(name, path) {
  const m = (path || name || "").match(/\b(2[0-9]{5})\b/);
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
    // "CONTRACT TBP", "TBD", "N/A" and similar are placeholders, not numbers
    poNumber: /^(contract|n\/?a|none|tbd|tbp|pending|-+)$|\b(tbd|tbp|pending|to be (provided|determined))\b/i.test(String(at("C52")).trim()) ? "" : at("C52"),
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
const xmlText = frag => frag
  .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, "")     // field codes, not content
  .replace(/<w:tab\b[^>]*\/>/g, " ")
  .replace(/<w:br\b[^>]*\/>/g, " ")
  .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, "")           // quote-aware tag strip
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/\s+/g, " ").trim();

/** docx → structured lines, in document order.
 *  Paragraph:  { text, list, level, fmt }  (list items keep their indent level)
 *  Table row:  { text: "| a | b |", cells: [a, b] }
 *  The pipe text keeps the header/pricing readers below working positionally. */
export async function docxToBlocks(buf) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml").async("string");

  // numbering.xml says whether a list is bullets or numbers, per level
  const fmts = {};
  const numXml = zip.file("word/numbering.xml") ? await zip.file("word/numbering.xml").async("string") : "";
  if (numXml) {
    const abs = {};
    for (const a of numXml.match(/<w:abstractNum\b[\s\S]*?<\/w:abstractNum>/g) || []) {
      const id = (a.match(/w:abstractNumId="(\d+)"/) || [])[1];
      abs[id] = {};
      for (const l of a.match(/<w:lvl\b[\s\S]*?<\/w:lvl>/g) || []) {
        const lv = (l.match(/w:ilvl="(\d+)"/) || [])[1];
        abs[id][lv] = (l.match(/<w:numFmt w:val="([^"]+)"/) || [])[1] || "bullet";
      }
    }
    for (const n of numXml.match(/<w:num\b[\s\S]*?<\/w:num>/g) || []) {
      const id = (n.match(/w:numId="(\d+)"/) || [])[1];
      const a = (n.match(/<w:abstractNumId w:val="(\d+)"/) || [])[1];
      if (id) fmts[id] = abs[a] || {};
    }
  }

  const out = [];
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
  let m;
  while ((m = re.exec(xml))) {
    const chunk = m[0];
    if (chunk.startsWith("<w:tbl")) {
      for (const row of chunk.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || []) {
        const cells = (row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(xmlText);
        if (cells.some(Boolean)) out.push({ text: "| " + cells.join(" | ") + " |", cells });
      }
    } else {
      const text = xmlText(chunk);
      if (!text) continue;
      const np = chunk.match(/<w:numPr>[\s\S]*?<\/w:numPr>/);
      if (np) {
        const level = parseInt((np[0].match(/<w:ilvl w:val="(\d+)"/) || [])[1] || "0", 10);
        const numId = (np[0].match(/<w:numId w:val="(\d+)"/) || [])[1];
        if (numId !== "0") { out.push({ text, list: true, level, numId, fmt: (fmts[numId] || {})[level] || "bullet" }); continue; }
      }
      out.push({ text });
    }
  }
  return out;
}

/* Section headings that end the Scope of Work. */
const AFTER_SCOPE = /^(exclusions|terms\s*(&|and)\s*conditions|project pricing|pricing|customer acceptance|acceptance form)\b/i;
const plain = t => String(t || "").replace(/\*+/g, "").trim();
/** Text-box / image-anchor residue, e.g. "3013710889000504825153035". */
const isJunk = t => /^[\d\s]{9,}$/.test(t);

/**
 * The full Scope of Work, formatted for reading on a phone:
 * headings get a blank line before them, list items keep their nesting
 * ("•" top level, "–" below, indented two spaces per level), numbered lists
 * keep their numbers. No length cap — the field crew needs all of it.
 */
export function extractScope(blocks) {
  const isHead = b => !b.list && !b.cells;
  let s = blocks.findIndex(b => isHead(b) && /^scope of work\b/i.test(plain(b.text)));
  // Fallback: scope heading styled as a list paragraph — skip the bare
  // "Scope of Work" entry in the cover letter's table of contents.
  if (s < 0) s = blocks.findIndex(b => /^scope of work\s*[–—-]/i.test(plain(b.text)));
  if (s < 0) return { scope: "", exclusions: [] };
  let e = blocks.findIndex((b, i) => i > s && isHead(b) && AFTER_SCOPE.test(plain(b.text)));
  if (e < 0) e = blocks.length;

  const counters = {};
  const lines = [];
  for (const b of blocks.slice(s, e)) {
    const t = plain(b.text);
    if (!t || isJunk(t)) continue;
    if (b.cells) {
      lines.push(b.cells.map(plain).filter(Boolean).join(" — "));
    } else if (b.list) {
      const pad = "  ".repeat(b.level);
      let mark = b.level === 0 ? "•" : "–";
      if (b.fmt && b.fmt !== "bullet" && b.fmt !== "none") {
        const k = `${b.numId}:${b.level}`;
        counters[k] = (counters[k] || 0) + 1;
        // deeper levels restart when a shallower item appears
        Object.keys(counters).forEach(key => { const [n, l] = key.split(":"); if (n === b.numId && +l > b.level) delete counters[key]; });
        const c = counters[k];
        mark = /letter/i.test(b.fmt) ? `${String.fromCharCode(96 + ((c - 1) % 26) + 1)}.` : /roman/i.test(b.fmt) ? `${["i","ii","iii","iv","v","vi","vii","viii","ix","x"][c - 1] || c}.` : `${c}.`;
      }
      lines.push(`${pad}${mark} ${t}`);
    } else {
      if (/^scope of work\b/i.test(t) && lines.length) lines.push("");
      lines.push(t);
    }
  }
  return { scope: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), exclusions: extractExclusions(blocks) };
}

/** Checked rows (☒) in the Exclusions table — what is NOT in our scope. */
export function extractExclusions(blocks) {
  const s = blocks.findIndex(b => !b.list && !b.cells && /^exclusions\b/i.test(plain(b.text)));
  if (s < 0) return [];
  const out = [];
  for (const b of blocks.slice(s + 1)) {
    if (!b.cells && !b.list && AFTER_SCOPE.test(plain(b.text))) break;
    if (!b.cells) continue;
    const box = b.cells.findIndex(c => /[☒☑✓✔xX]/.test(c) && c.trim().length <= 2);
    if (box < 0 || !/[☒☑✓✔]/.test(b.cells[box]) && !/^[xX]$/.test(b.cells[box].trim())) continue;
    const label = b.cells.filter((_, i) => i !== box).map(plain).filter(Boolean).join(" ");
    if (label) out.push(label);
  }
  return out;
}

/** Scope text as it lands on the project, with exclusions listed under it. */
export function scopeWithExclusions(scope, exclusions) {
  const s = String(scope || "").trim();
  if (!exclusions || !exclusions.length) return s;
  return `${s}${s ? "\n\n" : ""}NOT INCLUDED (proposal exclusions):\n${exclusions.map(x => `• ${x}`).join("\n")}`;
}

const moneyIn = t => {
  const m = String(t || "").match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
};

export async function parseProposal(file) {
  const blocks = await docxToBlocks(await file.arrayBuffer());
  const lines = blocks.map(b => b.text);
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

  // Scope narrative: the whole Scope of Work section, structure kept
  const { scope, exclusions } = extractScope(blocks);
  out.scopeNotes = scope;
  out.exclusions = exclusions;
  return out;
}

/* ══════════════════════════════════════════════════════════════
   File-by-file import
   Every file the user picks becomes an ENTRY with two independent choices:
     use      — what the app reads out of it (job info, scope, hours…)
     keepDoc  — whether a copy is saved in the project's Documents, under
                which type, and whether the field crew can see it.
   The parse is rebuilt from the entries whenever a choice changes, so the
   review always shows exactly what will be written.
   ══════════════════════════════════════════════════════════════ */

/** What a file can be used for, and where its information lands. */
export const FILE_USES = [
  { id: "pif",      label: "PIF",              lands: "Job info, contacts, billing, schedule of values" },
  { id: "proposal", label: "Proposal",         lands: "Scope of work (+ price if it's in the document)" },
  { id: "takeoff",  label: "Takeoff",          lands: "Materials list and bid hours" },
  { id: "invoice",  label: "Invoice",          lands: "Invoices" },
  { id: "doc",      label: "Document only",    lands: "Documents" },
  { id: "skip",     label: "Don't import",     lands: "" },
];
/** Which uses each file type can be read as. */
export function usesFor(name) {
  const n = String(name || "").toLowerCase();
  const u = ["doc", "skip"];
  if (/\.xls[xm]?$/.test(n)) u.unshift("pif", "takeoff", "invoice");
  else if (/\.docx$/.test(n)) u.unshift("proposal", "invoice");
  else if (/\.pdf$/.test(n)) u.unshift("invoice");
  return FILE_USES.filter(x => u.includes(x.id));
}

/** Document types — same values the Docs tab uses. */
export const DOC_TYPES = [
  { id: "proposal",  label: "Proposal" },
  { id: "drawing",   label: "Drawing" },
  { id: "submittal", label: "Submittal" },
  { id: "contract",  label: "Contract" },
  { id: "takeoff",   label: "Takeoff" },
  { id: "invoice",   label: "Invoice" },
  { id: "pif",       label: "PIF" },
  { id: "closeout",  label: "Closeout Pkg" },
  { id: "photo",     label: "Photo" },
  { id: "document",  label: "Document" },
];
/** Types that carry pricing, hours, or margin — office only by default. */
const OFFICE_ONLY_TYPES = new Set(["pif", "takeoff", "invoice", "contract"]);

export function guessDocType(name, use, path) {
  const n = `${path || ""}/${name || ""}`.toLowerCase();
  const base = String(name || "").toLowerCase();
  if (use === "pif" || use === "takeoff" || use === "invoice" || use === "proposal") return use;
  if (/\.(jpe?g|png|heic|gif|webp)$/.test(base)) return "photo";
  if (/submittal|cut ?sheet|data ?sheet|spec ?sheet|specification/.test(n)) return "submittal";
  if (/\.dwg$|drawing|plans?\b|as[\s_-]?built|floor ?plan|riser|layout|(^|[^a-z])[et][-_ ]?\d{1,3}(\.\d+)?([^0-9]|$)/.test(base)) return "drawing";
  if (/contract|subcontract|agreement|purchase order|(^|[^a-z])po[-_ #]?\d/.test(base)) return "contract";
  if (/close[\s_-]?out|o\s?&\s?m|warranty/.test(n)) return "closeout";
  return "document";
}

/** A fresh entry with sensible defaults.
 *  fromFolderScan: unrecognised files in a scanned folder default to
 *  "Don't import" (a job folder can hold hundreds of photos); files picked
 *  one by one default to "Document only" — you picked them for a reason. */
export function makeEntry(file, { fromFolderScan = false } = {}) {
  const path = file.webkitRelativePath || "";
  const kind = classifyFile(file.name, path);
  const use = kind === "other" ? (fromFolderScan ? "skip" : "doc") : kind;
  const docType = guessDocType(file.name, use, path);
  return {
    id: genId(),
    file,
    name: file.name,
    path,
    subfolder: path.split("/").slice(0, -1).pop() || "",
    size: file.size || 0,
    use,
    keepDoc: use !== "skip" && use !== "pif",   // PIF carries margin — off unless asked
    docType,
    restricted: OFFICE_ONLY_TYPES.has(docType),
  };
}
/** Changing a file's use re-guesses its document type and visibility. */
export function setEntryUse(entry, use) {
  const docType = guessDocType(entry.name, use, entry.path);
  return {
    ...entry, use, docType,
    restricted: OFFICE_ONLY_TYPES.has(docType),
    keepDoc: use === "skip" ? false : use === "doc" ? true : use === "pif" ? false : (entry.use === "skip" ? true : entry.keepDoc),
  };
}
export function setEntryDocType(entry, docType) {
  return { ...entry, docType, restricted: OFFICE_ONLY_TYPES.has(docType) };
}

/* Parsing is the slow part (SheetJS / JSZip). Cache by file + use so
   flipping a checkbox doesn't re-read every spreadsheet. */
const parseCache = new WeakMap();
async function parseAs(file, use) {
  let byUse = parseCache.get(file);
  if (!byUse) { byUse = {}; parseCache.set(file, byUse); }
  if (!byUse[use]) {
    byUse[use] = (use === "pif" ? parsePIF(file)
      : use === "takeoff" ? parseTakeoff(file)
      : use === "proposal" ? parseProposal(file)
      : use === "invoice" ? Promise.resolve(parseInvoiceFile(file))
      : Promise.resolve(null)).catch(err => { delete byUse[use]; throw err; });
  }
  return byUse[use];
}

/** Read every entry according to its use and merge into one review draft. */
export async function parseEntries(entries, teamNames = DEFAULT_TEAM_NAMES) {
  const cand = { warnings: [], takeoffScopes: [], proposals: [] };
  let pif = null;
  const materials = [], labor = {}, invoiceFiles = [];
  const pifs = entries.filter(e => e.use === "pif");

  for (const e of entries) {
    if (e.use === "skip" || e.use === "doc") continue;
    try {
      const r = await parseAs(e.file, e.use);
      if (e.use === "pif") { if (!pif) pif = r; }
      else if (e.use === "takeoff") {
        materials.push(...r.materials.map(m => ({ ...m })));
        Object.entries(r.labor).forEach(([k, v]) => { labor[k] = (labor[k] || 0) + v; });
        cand.takeoffScopes.push({ file: e.name, scope: r.scope, items: r.materials.length, hours: r.totalHours });
      } else if (e.use === "proposal") cand.proposals.push({ file: e.name, ...r });
      else if (e.use === "invoice") invoiceFiles.push(r);
    } catch (err) {
      cand.warnings.push(`Couldn't read ${e.name} as a ${FILE_USES.find(u => u.id === e.use)?.label || e.use}: ${err.message}`);
    }
  }
  if (pifs.length > 1) cand.warnings.push(`${pifs.length} files are set as the PIF — only ${pifs[0].name} is used.`);

  const p = pif || {};
  const proposal = cand.proposals[0] || null;
  const pm = String(p.projectManager || "");
  cand.hasPif = !!pif;
  cand.projectManager = pm;
  cand.assignedToTeam = !pm || teamNames.some(t => pm.toLowerCase().includes(t.toLowerCase()));
  cand.jobNumber = p.jobNumber || entries.map(e => jobNumberFromName(e.name, e.path)).find(Boolean) || "";
  cand.name = p.name || proposal?.projectName || "";
  cand.customer = p.customer || proposal?.customer || "";
  cand.siteAddress = p.siteAddress || proposal?.siteAddress || "";
  cand.contacts = p.contacts?.length ? p.contacts
    : (proposal?.contactName ? [{ id: genId(), name: proposal.contactName, email: "", phone: "", primary: true }] : []);
  cand.prevailingWage = !!p.prevailingWage;
  cand.poNumber = p.poNumber || "";
  cand.taxable = p.taxable;
  cand.billingContact = p.billingContact || "";
  cand.billingEmail = p.billingEmail || "";
  cand.invoicing = p.invoicing || null;

  // Scope: every proposal's full scope; several proposals are labelled
  const scoped = cand.proposals.filter(x => x.scopeNotes);
  cand.scopeText = scoped.length > 1
    ? scoped.map(x => `── ${x.file.replace(/\.[^.]+$/, "")} ──\n${x.scopeNotes}`).join("\n\n")
    : (scoped[0]?.scopeNotes || p.pifScope || "");
  cand.scopeSource = scoped.length ? scoped.map(x => x.file).join(", ") : (p.pifScope ? "PIF" : "");
  const ex = [];
  cand.proposals.forEach(x => (x.exclusions || []).forEach(t => { if (!ex.includes(t)) ex.push(t); }));
  cand.exclusions = ex;
  if (cand.proposals.length && !scoped.length) cand.warnings.push("No \"Scope of Work\" heading found in the proposal — type or paste the scope below.");

  cand.materials = materials;
  const rec = reconcileInvoices(p, invoiceFiles);
  cand.invoices = rec.records;
  rec.warnings.forEach(w => cand.warnings.push(w));

  cand.bidAmount = p.bidAmount || proposal?.totalPrice || 0;
  cand.contractAmount = p.contractAmount || proposal?.totalPrice || 0;
  cand.proposalPricing = proposal && proposal.pricingFound
    ? { total: proposal.totalPrice, material: proposal.materialPrice, labor: proposal.laborPrice } : null;
  if (proposal && proposal.pricingSource === "attachment-image" && !pif) {
    cand.warnings.push("Proposal pricing is an embedded image (Attachment A) — add the contract amount by hand or include the PIF.");
  }

  cand.laborHours = {};
  Object.entries(labor).forEach(([cat, hrs]) => { cand.laborHours[cat] = { bid: Math.round(hrs * 10) / 10 }; });
  cand.takeoffHours = Math.round(Object.values(labor).reduce((a, b) => a + b, 0) * 10) / 10;
  cand.pifBidHours = p.pifBidHours || 0;
  if (cand.pifBidHours && cand.takeoffHours && Math.abs(cand.pifBidHours - cand.takeoffHours) > 0.5) {
    cand.warnings.push(`Takeoff hours (${cand.takeoffHours}) don't match the PIF's bid hours (${cand.pifBidHours}).`);
  }
  return cand;
}

/** Fields the job-info section fills in. */
export const INFO_FIELDS = [
  ["jobNumber", "Job #"], ["name", "Project name"], ["customer", "Customer"], ["siteAddress", "Site address"],
  ["projectManager", "PM"], ["poNumber", "PO #"], ["contractAmount", "Contract $"], ["bidAmount", "Bid $"],
  ["billingContact", "Billing contact"], ["billingEmail", "Invoices to"],
];
const infoValue = (c, k) => {
  if (k === "bidAmount" || k === "contractAmount") return c[k] ? String(c[k]) : "";
  return c[k] || "";
};

/** Default choices for each section, given the target project (or null for new). */
export function defaultApplyOptions(cand, existing) {
  if (!existing) return { info: "all", scope: "replace", exclusions: true, hours: true, materials: true, invoices: true, sov: true };
  const hasBid = Object.values(existing.laborHours || {}).some(v => parseFloat(v?.bid) > 0);
  return {
    info: "blanks",
    scope: String(existing.scopeNotes || "").trim() ? "keep" : "replace",
    exclusions: true,
    hours: !hasBid,
    materials: !(existing.materials || []).length,
    invoices: true,
    sov: true,
  };
}

/** Same line from the same takeoff = duplicate (a re-import). The same part
 *  on a different takeoff is a separate quantity and is kept. */
const matKey = m => [m.item, m.partNumber, m.qtyNeeded, m.notes].map(v => String(v ?? "").trim().toLowerCase()).join("|");

/**
 * What gets written. Returns the full new project (existing = null) or the
 * update object for an existing project. Pure — the screen previews it and
 * App writes it. `scopeText` is the (possibly edited) scope from the screen.
 */
export function buildProjectChanges(cand, opts, existing, { scopeText, uploadedDocs = [], entries = [] } = {}) {
  const o = { ...defaultApplyOptions(cand, existing), ...(opts || {}) };
  const scope = scopeWithExclusions(scopeText ?? cand.scopeText, o.exclusions ? cand.exclusions : []);
  const stamp = { files: entries.filter(e => e.use !== "skip").map(e => e.name), importedAt: new Date().toISOString() };

  if (!existing) {
    return {
      name: cand.name || (cand.jobNumber ? `Job ${cand.jobNumber}` : "Imported job"),
      jobNumber: cand.jobNumber || "",
      customer: cand.customer || "",
      contactName: cand.contacts?.[0]?.name || "",
      contactPhone: cand.contacts?.[0]?.phone || "",
      contactEmail: cand.contacts?.[0]?.email || "",
      contacts: cand.contacts || [],
      siteAddress: cand.siteAddress || "",
      scopeNotes: o.scope === "keep" ? "" : scope,
      bidAmount: cand.bidAmount ? String(cand.bidAmount) : "",
      contractAmount: cand.contractAmount ? String(cand.contractAmount) : "",
      prevailingWage: !!cand.prevailingWage,
      ...(cand.taxable !== undefined ? { taxable: !!cand.taxable } : {}),
      billingContact: cand.billingContact || "",
      billingEmail: cand.billingEmail || "",
      poNumber: cand.poNumber || "",
      projectManager: cand.projectManager || "",
      laborHours: o.hours && Object.keys(cand.laborHours || {}).length ? cand.laborHours : null,
      materials: o.materials ? (cand.materials || []) : [],
      invoicing: o.sov ? (cand.invoicing || null) : null,
      invoices: o.invoices ? (cand.invoices || []) : [],
      documents: uploadedDocs,
      importedFrom: stamp,
    };
  }

  const up = {};
  // Job info
  if (o.info !== "none") {
    for (const [k] of INFO_FIELDS) {
      const v = infoValue(cand, k);
      if (!v) continue;
      if (o.info === "all" || !String(existing[k] || "").trim()) if (String(existing[k] || "") !== v) up[k] = v;
    }
    if (cand.taxable !== undefined && existing.taxable === undefined) up.taxable = !!cand.taxable;
    const have = existing.contacts || [];
    const key = c => (c.email || c.name || "").toLowerCase();
    const add = (cand.contacts || []).filter(c => key(c) && !have.some(h => key(h) === key(c)));
    if (add.length) up.contacts = [...have, ...add.map(c => ({ ...c, primary: have.length ? false : c.primary }))];
    if (!have.length && cand.contacts?.[0]) {
      if (!existing.contactName) up.contactName = cand.contacts[0].name || "";
      if (!existing.contactEmail) up.contactEmail = cand.contacts[0].email || "";
      if (!existing.contactPhone) up.contactPhone = cand.contacts[0].phone || "";
    }
  }
  // Scope
  if (scope && o.scope === "replace") up.scopeNotes = scope;
  else if (scope && o.scope === "append") {
    const cur = String(existing.scopeNotes || "").trim();
    up.scopeNotes = cur ? `${cur}\n\n${scope}` : scope;
  }
  // Bid hours — set phase bids from the takeoffs, keep every other phase
  if (o.hours && Object.keys(cand.laborHours || {}).length) {
    const lh = { ...(existing.laborHours || {}) };
    Object.entries(cand.laborHours).forEach(([cat, v]) => { lh[cat] = { ...(lh[cat] || {}), bid: v.bid }; });
    up.laborHours = lh;
  }
  // Materials — append, skipping lines already on the project
  if (o.materials && cand.materials?.length) {
    const have = {};
    (existing.materials || []).forEach(m => { const k = matKey(m); have[k] = (have[k] || 0) + 1; });
    const add = cand.materials.filter(m => { const k = matKey(m); if (have[k] > 0) { have[k]--; return false; } return true; });
    if (add.length) up.materials = [...(existing.materials || []), ...add];
  }
  // Invoices — append, skipping numbers already recorded
  if (o.invoices && cand.invoices?.length) {
    const have = new Set((existing.invoices || []).map(i => String(i.invoiceNumber || "").toLowerCase()).filter(Boolean));
    const add = cand.invoices.filter(i => !have.has(String(i.invoiceNumber || "").toLowerCase()));
    if (add.length) up.invoices = [...(existing.invoices || []), ...add];
  }
  if (o.sov && cand.invoicing) up.invoicing = cand.invoicing;
  if (uploadedDocs.length) up.documents = [...(existing.documents || []), ...uploadedDocs];
  if (Object.keys(up).length) {
    const prev = existing.importedFrom;
    up.importedFrom = { ...stamp, files: [...new Set([...(prev?.files || []), ...stamp.files])] };
  }
  return up;
}

/** Counts for the review: what each section will actually change. */
export function summarizeChanges(cand, opts, existing, scopeText) {
  const ch = buildProjectChanges(cand, opts, existing, { scopeText });
  const before = existing || {};
  return {
    info: existing ? INFO_FIELDS.filter(([k]) => k in ch).map(([k, l]) => ({ key: k, label: l, from: before[k] || "", to: ch[k] })) : null,
    newContacts: existing ? Math.max(0, (ch.contacts?.length || 0) - (before.contacts?.length || 0)) : (cand.contacts?.length || 0),
    materialsAdded: existing ? (ch.materials ? ch.materials.length - (before.materials || []).length : 0) : (ch.materials?.length || 0),
    materialsDup: existing && opts?.materials ? (cand.materials || []).length - (ch.materials ? ch.materials.length - (before.materials || []).length : 0) : 0,
    invoicesAdded: existing ? (ch.invoices ? ch.invoices.length - (before.invoices || []).length : 0) : (ch.invoices?.length || 0),
    invoicesDup: existing && opts?.invoices ? (cand.invoices || []).length - (ch.invoices ? ch.invoices.length - (before.invoices || []).length : 0) : 0,
  };
}

/** Upload the entries marked "save a copy" into the project's Documents.
 *  Same record shape the Docs tab writes, so they behave identically. */
export async function uploadEntryDocuments(entries, projectId, onProgress) {
  const { storage, storageRef, uploadBytes, getDownloadURL } = await import("./firebase.js");
  const wanted = entries.filter(e => e.keepDoc && e.use !== "skip" && e.file);
  const docs = [];
  for (let i = 0; i < wanted.length; i++) {
    const e = wanted[i];
    if (onProgress) onProgress(i, wanted.length, e.name);
    try {
      const safe = e.name.replace(/[^\w.\- ]+/g, "_");
      const ref = storageRef(storage, `projects/${projectId}/docs/${Date.now()}_${safe}`);
      await uploadBytes(ref, e.file);
      docs.push({
        name: e.name.replace(/\.[^.]+$/, ""),
        type: e.docType || "document",
        restricted: !!e.restricted,
        addedAt: new Date().toISOString(),
        fileUrl: await getDownloadURL(ref),
        fileName: e.name,
        fileSize: e.size || 0,
        source: "import",
      });
    } catch (err) {
      const x = new Error(`Couldn't upload ${e.name}: ${err?.code || err?.message || "unknown error"}`);
      x.uploaded = docs;
      throw x;
    }
  }
  if (onProgress) onProgress(wanted.length, wanted.length, "");
  return docs;
}

/** Group a folder scan into one entry list per job (see groupFilesByJob). */
export function entriesFromFolderScan(files) {
  const groups = groupFilesByJob(files);
  return [...groups.entries()].map(([folder, list]) => ({
    folder: folder && folder !== "__unmatched__" ? folder.split("/").pop() : "",
    entries: list.map(f => makeEntry(f, { fromFolderScan: true })),
  }));
}

export { LABOR_PHASES };
