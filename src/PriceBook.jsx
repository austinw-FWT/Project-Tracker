import { useState, useRef } from "react";
import { Plus, X, Search, Package, Layers, Settings, Upload, Edit2 } from "lucide-react";
import { genId } from "./App.jsx";

/**
 * PriceBook — the estimating brain.
 *
 *  Catalog:    persistent parts list (manf / part# / desc / unit / cost /
 *              markup) with LABOR UNITS per estimating phase — hours per
 *              unit for Rough In, Trim, Head End, Programming. These flow
 *              into takeoffs automatically.
 *  Assemblies: kits of catalog items with per-unit quantities (e.g. one
 *              "Interior IP Dome" = camera + mount + 150 ft Cat6 + jack)
 *              plus optional assembly-level labor adders. Insert into a
 *              takeoff with a quantity and the whole BOM scales.
 *  Defaults:   labor cost/rate, markup %, overhead % — prefilled on every
 *              new takeoff so nothing starts from zero.
 *
 * The catalog is shared company-wide and mostly builds itself: every
 * takeoff row has a "save to catalog" action.
 */

export const LABOR_UNIT_PHASES = [
  { key: "lr", label: "Rough In" },
  { key: "lt", label: "Trim" },
  { key: "lh", label: "Head End" },
  { key: "lp", label: "Programming" },
];

export function emptyLaborUnits() { return { lr: 0, lt: 0, lh: 0, lp: 0 }; }
const n = v => parseFloat(v) || 0;

const iS = { width: "100%", padding: "7px 10px", borderRadius: 7, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 12.5, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" };
const nS = { ...iS, textAlign: "right" };
const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
const btnG = { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

export default function PriceBook({ catalog, assemblies, defaults, onSaveItem, onDeleteItem, onSaveAssembly, onDeleteAssembly, onSaveDefaults, isMobile }) {
  const [tab, setTab] = useState("catalog");
  const items = Object.values(catalog || {}).sort((a, b) => (a.manf + a.partNum).localeCompare(b.manf + b.partNum));
  const asms = Object.values(assemblies || {}).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const tabs = [
    { id: "catalog", label: `Catalog (${items.length})`, icon: Package },
    { id: "assemblies", label: `Assemblies (${asms.length})`, icon: Layers },
    { id: "defaults", label: "Defaults", icon: Settings },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? 14 : 24 }}>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Your price book powers every takeoff: parts with labor units, assemblies that drop whole device kits in at once, and defaults so nothing starts from zero.</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid #1A3050", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: tab === t.id ? "2px solid #69BE28" : "2px solid transparent", color: tab === t.id ? "#69BE28" : "#64748b", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "catalog" && <CatalogTab items={items} onSave={onSaveItem} onDelete={onDeleteItem} isMobile={isMobile} />}
      {tab === "assemblies" && <AssembliesTab asms={asms} items={items} onSave={onSaveAssembly} onDelete={onDeleteAssembly} />}
      {tab === "defaults" && <DefaultsTab defaults={defaults} onSave={onSaveDefaults} />}
    </div>
  );
}

/* ════════ CATALOG ════════ */
function CatalogTab({ items, onSave, onDelete, isMobile }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // item object being edited (or new)
  const fileRef = useRef(null);
  const [importMsg, setImportMsg] = useState("");

  const filtered = q.trim()
    ? items.filter(i => `${i.manf} ${i.partNum} ${i.desc}`.toLowerCase().includes(q.toLowerCase()))
    : items;

  function newItem() {
    setEditing({ id: genId(), manf: "", partNum: "", desc: "", unit: "EA", costPU: 0, markupPct: 25, laborUnits: emptyLaborUnits() });
  }

  /** CSV import — flexible header matching. Expected-ish columns:
      manufacturer, part number, description, unit, cost, markup. Extra
      columns ignored; labor units default to 0 (edit later). */
  function importCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const rows = text.split(/\r?\n/).filter(r => r.trim());
        const header = rows[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
        const col = names => header.findIndex(h => names.some(nm => h.includes(nm)));
        const ci = { manf: col(["manf", "manufacturer", "brand"]), part: col(["part", "model", "sku", "item #", "item#"]), desc: col(["desc", "description", "name"]), unit: col(["unit", "uom"]), cost: col(["cost", "price", "dealer"]) , markup: col(["markup", "margin"]) };
        if (ci.part < 0 && ci.desc < 0) { setImportMsg("Couldn't find a part number or description column in that file."); return; }
        // naive CSV split that respects simple quotes
        const split = line => { const out = []; let cur = "", inQ = false; for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === "," && !inQ) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map(c => c.trim()); };
        let added = 0;
        for (let r = 1; r < rows.length; r++) {
          const c = split(rows[r]);
          const partNum = ci.part >= 0 ? c[ci.part] : "";
          const desc = ci.desc >= 0 ? c[ci.desc] : "";
          if (!partNum && !desc) continue;
          const item = {
            id: genId(),
            manf: ci.manf >= 0 ? c[ci.manf] || "" : "",
            partNum, desc,
            unit: (ci.unit >= 0 && c[ci.unit]) || "EA",
            costPU: ci.cost >= 0 ? n(c[ci.cost].replace(/[$,]/g, "")) : 0,
            markupPct: ci.markup >= 0 ? n(c[ci.markup]) : 25,
            laborUnits: emptyLaborUnits(),
          };
          onSave(item); added++;
        }
        setImportMsg(`✓ Imported ${added} items. Labor units default to 0 — fill them in as you go.`);
      } catch { setImportMsg("Import failed — is that a CSV file?"); }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input style={{ ...iS, paddingLeft: 30 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search manufacturer, part #, description…" />
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={importCsv} />
        <button onClick={() => fileRef.current?.click()} style={{ ...btnG, background: "#1A3050", color: "#94a3b8" }}><Upload size={13} /> Import CSV</button>
        <button onClick={newItem} style={btnG}><Plus size={14} /> Add Part</button>
      </div>
      {importMsg && <div style={{ fontSize: 12, color: importMsg.startsWith("✓") ? "#69BE28" : "#f59e0b", marginBottom: 10 }}>{importMsg}</div>}

      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: 13, background: "#0F2444", borderRadius: 12, border: "1px dashed #1A3050" }}>
          <Package size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
          <div style={{ fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Your catalog is empty</div>
          <div>Add parts here, import a dealer CSV, or just build takeoffs — every takeoff row has a "save to catalog" button, so it fills itself as you bid.</div>
        </div>
      )}

      {/* header */}
      {filtered.length > 0 && !isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: "90px 110px 1fr 44px 70px 50px 70px repeat(4, 52px) 56px", gap: 5, padding: "0 0 6px", borderBottom: "1px solid #1A3050", marginBottom: 4 }}>
          {["Manf", "Part #", "Description", "Unit", "Cost/U", "Mk%", "Price/U", ...LABOR_UNIT_PHASES.map(p => p.label.split(" ")[0]), ""].map((h, i) => <div key={i} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{h}</div>)}
        </div>
      )}
      {filtered.slice(0, 200).map(item => (
        <div key={item.id} style={isMobile
          ? { background: "#0F2444", border: "1px solid #1A3050", borderRadius: 10, padding: "10px 12px", marginBottom: 6 }
          : { display: "grid", gridTemplateColumns: "90px 110px 1fr 44px 70px 50px 70px repeat(4, 52px) 56px", gap: 5, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #13294d" }}>
          {isMobile ? (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: "#69BE28", fontWeight: 700 }}>{item.manf}</span>
                <span style={{ fontSize: 12.5, color: "#fff", fontWeight: 700, flex: 1 }}>{item.partNum}</span>
                <span style={{ fontSize: 12.5, color: "#10b981", fontWeight: 700 }}>${(n(item.costPU) * (1 + n(item.markupPct) / 100)).toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 6px" }}>{item.desc}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing({ ...item, laborUnits: { ...emptyLaborUnits(), ...(item.laborUnits || {}) } })} style={{ ...btnG, padding: "6px 12px", fontSize: 12, background: "#1A3050", color: "#94a3b8" }}>Edit</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.manf}</div>
              <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.partNum}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</div>
              <div style={{ fontSize: 11.5, color: "#64748b" }}>{item.unit || "EA"}</div>
              <div style={{ fontSize: 12, color: "#e2e8f0", textAlign: "right" }}>${n(item.costPU).toFixed(2)}</div>
              <div style={{ fontSize: 12, color: "#f59e0b", textAlign: "right" }}>{n(item.markupPct)}%</div>
              <div style={{ fontSize: 12, color: "#10b981", textAlign: "right", fontWeight: 600 }}>${(n(item.costPU) * (1 + n(item.markupPct) / 100)).toFixed(2)}</div>
              {LABOR_UNIT_PHASES.map(p => <div key={p.key} style={{ fontSize: 11.5, color: n(item.laborUnits?.[p.key]) > 0 ? "#f59e0b" : "#334155", textAlign: "right" }}>{n(item.laborUnits?.[p.key]) || "—"}</div>)}
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button onClick={() => setEditing({ ...item, laborUnits: { ...emptyLaborUnits(), ...(item.laborUnits || {}) } })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 3 }}><Edit2 size={13} /></button>
                <button onClick={() => { if (confirm(`Delete ${item.partNum || item.desc} from the catalog?`)) onDelete(item.id); }} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", padding: 3 }}><X size={13} /></button>
              </div>
            </>
          )}
        </div>
      ))}
      {filtered.length > 200 && <div style={{ fontSize: 12, color: "#64748b", padding: 10 }}>Showing first 200 — narrow the search.</div>}

      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} onSave={it => { onSave(it); setEditing(null); }} />}
    </div>
  );
}

function ItemEditor({ item, onSave, onClose }) {
  const [f, setF] = useState(item);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0F2444", borderRadius: 14, border: "1px solid #1A3050", padding: 22, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif", marginBottom: 16 }}>{item.manf || item.partNum ? "Edit Part" : "New Part"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={lS}>Manufacturer</label><input style={iS} value={f.manf} onChange={e => setF({ ...f, manf: e.target.value })} placeholder="Axis" /></div>
          <div><label style={lS}>Part Number</label><input style={iS} value={f.partNum} onChange={e => setF({ ...f, partNum: e.target.value })} placeholder="P3265-LV" /></div>
        </div>
        <div style={{ marginBottom: 12 }}><label style={lS}>Description</label><input style={iS} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="2MP Indoor Dome, IR, vandal" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div><label style={lS}>Unit</label><input style={iS} value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></div>
          <div><label style={lS}>Cost / Unit</label><input type="number" step="0.01" style={nS} value={f.costPU || ""} onChange={e => setF({ ...f, costPU: n(e.target.value) })} /></div>
          <div><label style={lS}>Markup %</label><input type="number" style={nS} value={f.markupPct ?? ""} onChange={e => setF({ ...f, markupPct: n(e.target.value) })} /></div>
          <div><label style={lS}>Price / Unit</label><div style={{ ...iS, background: "transparent", border: "none", color: "#10b981", fontWeight: 700, textAlign: "right", paddingTop: 9 }}>${(n(f.costPU) * (1 + n(f.markupPct) / 100)).toFixed(2)}</div></div>
        </div>
        <div style={{ background: "#0A192F", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>Labor units — hours per unit installed</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {LABOR_UNIT_PHASES.map(p => (
              <div key={p.key}><label style={lS}>{p.label}</label><input type="number" step="0.05" style={nS} value={f.laborUnits?.[p.key] || ""} onChange={e => setF({ ...f, laborUnits: { ...f.laborUnits, [p.key]: n(e.target.value) } })} placeholder="0" /></div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>Example: an interior dome might be 0.75 rough, 0.5 trim, 0.1 head end, 0.25 programming. These roll into takeoff labor automatically.</div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...btnG, background: "transparent", border: "1px solid #1A3050", color: "#94a3b8" }}>Cancel</button>
          <button onClick={() => { if (!f.partNum.trim() && !f.desc.trim()) return; onSave(f); }} style={btnG}>Save Part</button>
        </div>
      </div>
    </div>
  );
}

/* ════════ ASSEMBLIES ════════ */
function AssembliesTab({ asms, items, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);

  function assemblyTotals(asm) {
    let mat = 0; const labor = emptyLaborUnits();
    (asm.items || []).forEach(it => {
      const cat = items.find(c => c.id === it.catalogId);
      if (!cat) return;
      mat += n(it.qtyPer) * n(cat.costPU) * (1 + n(cat.markupPct) / 100);
      LABOR_UNIT_PHASES.forEach(p => { labor[p.key] += n(it.qtyPer) * n(cat.laborUnits?.[p.key]); });
    });
    LABOR_UNIT_PHASES.forEach(p => { labor[p.key] += n(asm.laborAdders?.[p.key]); });
    const hrs = LABOR_UNIT_PHASES.reduce((s, p) => s + labor[p.key], 0);
    return { mat, labor, hrs };
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setEditing({ id: genId(), name: "", desc: "", items: [], laborAdders: emptyLaborUnits() })} style={btnG}><Plus size={14} /> New Assembly</button>
      </div>
      {asms.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: 13, background: "#0F2444", borderRadius: 12, border: "1px dashed #1A3050" }}>
          <Layers size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
          <div style={{ fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>No assemblies yet</div>
          <div>An assembly is a device kit — "Interior IP Dome" = camera + mount + cable + jack + labor. Build one once; estimating a 40-camera job becomes typing one number.</div>
        </div>
      )}
      {asms.map(a => {
        const t = assemblyTotals(a);
        return (
          <div key={a.id} style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 12, padding: "14px 18px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>{a.name || "Untitled assembly"}</div>
                {a.desc && <div style={{ fontSize: 12, color: "#64748b" }}>{a.desc}</div>}
              </div>
              <div style={{ textAlign: "right", marginRight: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>${t.mat.toFixed(2)}/ea</div>
                <div style={{ fontSize: 11, color: "#f59e0b" }}>{t.hrs.toFixed(2)}h labor/ea</div>
              </div>
              <button onClick={() => setEditing({ ...a, laborAdders: { ...emptyLaborUnits(), ...(a.laborAdders || {}) } })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4 }}><Edit2 size={14} /></button>
              <button onClick={() => { if (confirm(`Delete assembly "${a.name}"?`)) onDelete(a.id); }} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", padding: 4 }}><X size={14} /></button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {(a.items || []).map((it, i) => {
                const cat = items.find(c => c.id === it.catalogId);
                return <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "#0A192F", border: "1px solid #1A3050", color: cat ? "#94a3b8" : "#ef4444" }}>{n(it.qtyPer)}× {cat ? (cat.partNum || cat.desc) : "missing part"}</span>;
              })}
            </div>
          </div>
        );
      })}
      {editing && <AssemblyEditor asm={editing} items={items} onClose={() => setEditing(null)} onSave={a => { onSave(a); setEditing(null); }} />}
    </div>
  );
}

function AssemblyEditor({ asm, items, onSave, onClose }) {
  const [f, setF] = useState(asm);
  const [q, setQ] = useState("");
  const matches = q.trim() ? items.filter(i => `${i.manf} ${i.partNum} ${i.desc}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0F2444", borderRadius: 14, border: "1px solid #1A3050", padding: 22, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif", marginBottom: 16 }}>{asm.name ? "Edit Assembly" : "New Assembly"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, marginBottom: 14 }}>
          <div><label style={lS}>Name</label><input style={iS} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Interior IP Dome" /></div>
          <div><label style={lS}>Description</label><input style={iS} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="Camera, mount, Cat6 avg run, jack" /></div>
        </div>

        <div style={{ background: "#0A192F", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#69BE28", textTransform: "uppercase", marginBottom: 8 }}>Components (qty per ONE assembly)</div>
          {(f.items || []).map((it, i) => {
            const cat = items.find(c => c.id === it.catalogId);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr 24px", gap: 8, alignItems: "center", marginBottom: 5 }}>
                <input type="number" step="0.5" style={nS} value={it.qtyPer || ""} onChange={e => setF({ ...f, items: f.items.map((x, xi) => xi === i ? { ...x, qtyPer: n(e.target.value) } : x) })} />
                <div style={{ fontSize: 12.5, color: cat ? "#e2e8f0" : "#ef4444" }}>{cat ? `${cat.manf} ${cat.partNum} — ${cat.desc}` : "Part no longer in catalog"}{cat?.unit && cat.unit !== "EA" ? ` (${cat.unit})` : ""}</div>
                <button onClick={() => setF({ ...f, items: f.items.filter((_, xi) => xi !== i) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
              </div>
            );
          })}
          <div style={{ position: "relative", marginTop: 8 }}>
            <input style={iS} value={q} onChange={e => setQ(e.target.value)} placeholder="Search catalog to add a component…" />
            {matches.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#13294d", border: "1px solid #1A3050", borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: "auto" }}>
                {matches.map(m => (
                  <button key={m.id} onClick={() => { setF({ ...f, items: [...(f.items || []), { catalogId: m.id, qtyPer: 1 }] }); setQ(""); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", borderBottom: "1px solid #1A3050", color: "#e2e8f0", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                    <strong style={{ color: "#69BE28" }}>{m.partNum}</strong> {m.manf} — {m.desc}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>Cable runs: set the part's unit to FT in the catalog, then qty here = average run length (e.g. 150).</div>
        </div>

        <div style={{ background: "#0A192F", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>Extra labor per assembly (beyond component labor units)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {LABOR_UNIT_PHASES.map(p => (
              <div key={p.key}><label style={lS}>{p.label}</label><input type="number" step="0.05" style={nS} value={f.laborAdders?.[p.key] || ""} onChange={e => setF({ ...f, laborAdders: { ...f.laborAdders, [p.key]: n(e.target.value) } })} placeholder="0" /></div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...btnG, background: "transparent", border: "1px solid #1A3050", color: "#94a3b8" }}>Cancel</button>
          <button onClick={() => { if (!f.name.trim()) return; onSave(f); }} style={btnG}>Save Assembly</button>
        </div>
      </div>
    </div>
  );
}

/* ════════ DEFAULTS ════════ */
function DefaultsTab({ defaults, onSave }) {
  const [f, setF] = useState({ laborCostPerHr: 0, laborRatePerHr: 0, defaultMarkupPct: 25, defaultOverheadPct: 0, ...(defaults || {}) });
  const [saved, setSaved] = useState(false);
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>These prefill every new takeoff so nothing starts at zero. You can still override per estimate.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div><label style={lS}>Labor Cost / Hr (burdened)</label><input type="number" step="0.5" style={nS} value={f.laborCostPerHr || ""} onChange={e => setF({ ...f, laborCostPerHr: n(e.target.value) })} placeholder="55" /></div>
          <div><label style={lS}>Labor Rate / Hr (billed)</label><input type="number" step="0.5" style={nS} value={f.laborRatePerHr || ""} onChange={e => setF({ ...f, laborRatePerHr: n(e.target.value) })} placeholder="125" /></div>
          <div><label style={lS}>Default Material Markup %</label><input type="number" style={nS} value={f.defaultMarkupPct ?? ""} onChange={e => setF({ ...f, defaultMarkupPct: n(e.target.value) })} /></div>
          <div><label style={lS}>Default Overhead %</label><input type="number" style={nS} value={f.defaultOverheadPct ?? ""} onChange={e => setF({ ...f, defaultOverheadPct: n(e.target.value) })} /></div>
        </div>
        <button onClick={() => { onSave(f); setSaved(true); setTimeout(() => setSaved(false), 1800); }} style={btnG}>{saved ? "✓ Saved" : "Save Defaults"}</button>
      </div>
    </div>
  );
}
