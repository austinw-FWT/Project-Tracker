import { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, ClipboardList, Clock, Cable, CheckCircle2, Circle, FileText, Camera, MapPin, Phone, Mail, DollarSign, Building2, User, Layers, Package, Receipt, BookOpen, AlertTriangle, Image, FileSearch, TrendingUp, ClipboardCheck } from "lucide-react";
import { PROJECT_TYPES, LABOR_PHASES, MATERIAL_STATUSES, TASK_CATEGORIES, genId } from "./App.jsx";

const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
const sS = { fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 3, display: "block", textTransform: "uppercase" };
function IR({ icon: Icon, label, value }) { return (<div><div style={lS}>{label}</div><div style={{ fontSize: 13, color: value ? "#e2e8f0" : "#334155", display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} style={{ color: "#475569" }} />{value || "—"}</div></div>); }
function SC({ label, value, color }) { return (<div style={{ background: "#0f1729", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${color}` }}><div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Outfit',sans-serif" }}>{value}</div></div>); }

const FB_FUNCTIONS_URL = "https://us-central1-fwt-lv-tracker.cloudfunctions.net";

async function callFunction(name, data) {
  try {
    const { getAuth } = await import("firebase/auth");
    const token = await getAuth().currentUser?.getIdToken();
    const r = await fetch(`${FB_FUNCTIONS_URL}/${name}`, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ data }),
    });
    return await r.json();
  } catch (e) { console.error(`Function ${name} failed:`, e); return null; }
}

export default function ProjectDetail({ project, phases, phaseMap, teamRoster, onUpdate, onDelete, detailTab, setDetailTab, assignTaskToMember }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(project);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { if (!editMode) setForm(project); }, [project, editMode]);

  const tabs = [
    { id: "overview", label: "Overview", icon: ClipboardList },
    { id: "hours", label: "Hours", icon: Clock },
    { id: "materials", label: "Materials", icon: Package },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "changeorders", label: "Change Orders", icon: AlertTriangle },
    { id: "scope", label: "Scope", icon: Cable },
    { id: "tasks", label: "Tasks", icon: CheckCircle2 },
    { id: "dailylog", label: "Daily Log", icon: BookOpen },
    { id: "photos", label: "Photos", icon: Image },
    { id: "rfis", label: "RFIs", icon: FileSearch },
    { id: "profit", label: "Profit", icon: TrendingUp },
    { id: "punchlist", label: "Punch List", icon: ClipboardCheck },
    { id: "docs", label: "Docs", icon: FileText },
    { id: "notes", label: "Activity", icon: Clock },
  ];
  const cp = phaseMap[project.phaseId];

  return (
    <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: 0 }}>{project.name}</h1>
            {cp && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: cp.color + "22", color: cp.color, fontWeight: 600 }}>{cp.name}</span>}
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{project.customer}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setForm(project); setEditMode(!editMode); }} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Edit2 size={13} /> Edit</button>
          {!confirmDelete ? <button onClick={() => setConfirmDelete(true)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #7f1d1d", background: "transparent", color: "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Trash2 size={13} /> Delete</button>
          : <button onClick={onDelete} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Confirm Delete</button>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {phases.map(ph => (<button key={ph.id} onClick={() => onUpdate({ phaseId: ph.id })} style={{ padding: "5px 12px", borderRadius: 20, border: project.phaseId === ph.id ? `2px solid ${ph.color}` : "1px solid #1e293b", background: project.phaseId === ph.id ? ph.color + "22" : "transparent", color: project.phaseId === ph.id ? ph.color : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{ph.name}</button>))}
      </div>

      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid #1e293b", overflowX: "auto", paddingBottom: 1 }}>
        {tabs.map(tab => (<button key={tab.id} onClick={() => setDetailTab(tab.id)} style={{ padding: "9px 12px", border: "none", background: "none", cursor: "pointer", color: detailTab === tab.id ? "#fff" : "#64748b", borderBottom: detailTab === tab.id ? "2px solid #6366f1" : "2px solid transparent", fontSize: 11, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}><tab.icon size={12} /> {tab.label}</button>))}
      </div>

      <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20 }}>
        {detailTab === "overview" && <OverviewTab project={project} form={form} setForm={setForm} editMode={editMode} setEditMode={setEditMode} onUpdate={onUpdate} teamRoster={teamRoster} />}
        {detailTab === "hours" && <HoursTab project={project} onUpdate={onUpdate} />}
        {detailTab === "materials" && <MaterialsTab project={project} onUpdate={onUpdate} />}
        {detailTab === "invoices" && <InvoiceTab project={project} onUpdate={onUpdate} />}
        {detailTab === "changeorders" && <ChangeOrdersTab project={project} onUpdate={onUpdate} />}
        {detailTab === "scope" && <ScopeTab project={project} onUpdate={onUpdate} />}
        {detailTab === "tasks" && <TasksTab project={project} onUpdate={onUpdate} teamRoster={teamRoster} assignTaskToMember={assignTaskToMember} />}
        {detailTab === "dailylog" && <DailyLogTab project={project} onUpdate={onUpdate} />}
        {detailTab === "photos" && <PhotoLogTab project={project} onUpdate={onUpdate} />}
        {detailTab === "rfis" && <RFITab project={project} onUpdate={onUpdate} />}
        {detailTab === "profit" && <ProfitTab project={project} />}
        {detailTab === "punchlist" && <PunchListTab project={project} onUpdate={onUpdate} />}
        {detailTab === "docs" && <DocsTab project={project} onUpdate={onUpdate} />}
        {detailTab === "notes" && <NotesTab project={project} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}

/* ── OVERVIEW ── */
function OverviewTab({ project, form, setForm, editMode, setEditMode, onUpdate, teamRoster }) {
  if (editMode) return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div><label style={lS}>Project Name</label><input style={iS} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div><label style={lS}>Customer</label><input style={iS} value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} /></div>
      <div><label style={lS}>Contact</label><input style={iS} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
      <div><label style={lS}>Phone</label><input style={iS} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
      <div><label style={lS}>Email</label><input style={iS} value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
      <div><label style={lS}>Site Address</label><input style={iS} value={form.siteAddress} onChange={e => setForm({ ...form, siteAddress: e.target.value })} /></div>
      <div><label style={lS}>Type</label><select style={iS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="retrofit">Retrofit</option><option value="new-construction">New Construction</option></select></div>
      <div><label style={lS}>Systems</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{PROJECT_TYPES.map(pt => (<button key={pt} onClick={() => { const t = form.projectTypes || []; setForm({ ...form, projectTypes: t.includes(pt) ? t.filter(x => x !== pt) : [...t, pt] }); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #1e293b", fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: (form.projectTypes || []).includes(pt) ? "#6366f1" : "transparent", color: (form.projectTypes || []).includes(pt) ? "#fff" : "#94a3b8" }}>{pt}</button>))}</div></div>
      <div><label style={lS}>Bid Amount</label><input style={iS} value={form.bidAmount} onChange={e => setForm({ ...form, bidAmount: e.target.value })} placeholder="$" /></div>
      <div><label style={lS}>Contract Amount</label><input style={iS} value={form.contractAmount} onChange={e => setForm({ ...form, contractAmount: e.target.value })} placeholder="$" /></div>
      <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, justifyContent: "flex-end" }}><button onClick={() => setEditMode(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button><button onClick={() => { onUpdate(form); setEditMode(false); }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button></div>
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <IR icon={Building2} label="Customer" value={project.customer} /><IR icon={User} label="Contact" value={project.contactName} />
      <IR icon={Phone} label="Phone" value={project.contactPhone} /><IR icon={Mail} label="Email" value={project.contactEmail} />
      <IR icon={MapPin} label="Site Address" value={project.siteAddress} /><IR icon={Layers} label="Type" value={project.type === "retrofit" ? "Retrofit" : "New Construction"} />
      <IR icon={DollarSign} label="Bid Amount" value={project.bidAmount} /><IR icon={DollarSign} label="Contract Amount" value={project.contractAmount} />
      <div style={{ gridColumn: "1/-1" }}><div style={lS}>Systems</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(project.projectTypes || []).map(t => <span key={t} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#6366f122", color: "#818cf8" }}>{t}</span>)}{!project.projectTypes?.length && <span style={{ fontSize: 12, color: "#475569" }}>None</span>}</div></div>
      <div style={{ gridColumn: "1/-1" }}><div style={lS}>Team</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(project.teamMembers || []).map(tm => (<span key={tm} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#1e293b", color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}><User size={11} /> {tm}<button onClick={() => onUpdate({ teamMembers: project.teamMembers.filter(m => m !== tm) })} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 0 }}><X size={11} /></button></span>))}</div>
      {teamRoster.length > 0 && <select style={{ ...iS, maxWidth: 200, marginTop: 8, fontSize: 12 }} value="" onChange={e => { if (e.target.value && !(project.teamMembers || []).includes(e.target.value)) onUpdate({ teamMembers: [...(project.teamMembers || []), e.target.value] }); }}><option value="">+ Assign</option>{teamRoster.filter(t => !(project.teamMembers || []).includes(t.name)).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>}</div>
    </div>
  );
}

/* ── HOURS ── */
function HoursTab({ project, onUpdate }) {
  const lh = project.laborHours || {};
  function upd(pid, f, v) { onUpdate({ laborHours: { ...lh, [pid]: { ...(lh[pid] || { bid: 0, remaining: 0 }), [f]: parseFloat(v) || 0 } } }); }
  const tB = LABOR_PHASES.reduce((s, l) => s + (lh[l.id]?.bid || 0), 0), tR = LABOR_PHASES.reduce((s, l) => s + (lh[l.id]?.remaining || 0), 0), tU = tB - tR, tP = tB > 0 ? Math.round(tU / tB * 100) : 0;
  const hS = { ...iS, background: "#0f1729", textAlign: "center" };
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}><SC label="Total Bid" value={`${tB.toFixed(1)}h`} color="#6366f1" /><SC label="Used" value={`${tU.toFixed(1)}h`} color="#f59e0b" /><SC label="Remaining" value={`${tR.toFixed(1)}h`} color="#10b981" /><SC label="Complete" value={`${tP}%`} color={tP > 90 ? "#ef4444" : tP > 70 ? "#f59e0b" : "#10b981"} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "0 12px 10px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}><span>Phase</span><span style={{ textAlign: "center" }}>Bid</span><span style={{ textAlign: "center" }}>Used</span><span style={{ textAlign: "center" }}>Remaining</span><span style={{ textAlign: "center" }}>%</span></div>
    {LABOR_PHASES.map(lp => { const b = lh[lp.id]?.bid || 0, r = lh[lp.id]?.remaining || 0, u = b - r, p = b > 0 ? Math.round(u / b * 100) : 0, o = r < 0; return (
      <div key={lp.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "10px 12px", background: "#0f1729", borderRadius: 8, marginBottom: 4, border: o ? "1px solid #7f1d1d" : "1px solid transparent" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{lp.name}</span>
        <input type="number" step="0.5" min="0" style={hS} value={b || ""} onChange={e => upd(lp.id, "bid", e.target.value)} placeholder="0" />
        <div style={{ textAlign: "center", fontSize: 13, color: o ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>{u.toFixed(1)}h</div>
        <input type="number" step="0.5" style={hS} value={r || ""} onChange={e => upd(lp.id, "remaining", e.target.value)} placeholder="0" />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1e293b", overflow: "hidden" }}><div style={{ width: `${Math.min(p, 100)}%`, height: "100%", borderRadius: 3, background: o ? "#ef4444" : p > 90 ? "#f59e0b" : "#10b981" }} /></div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, minWidth: 28, textAlign: "right" }}>{p}%</span></div>
      </div>); })}
  </div>);
}

/* ── MATERIALS ── */
function MaterialsTab({ project, onUpdate }) {
  const [item, setItem] = useState(""); const [mfr, setMfr] = useState(""); const [qty, setQty] = useState(""); const [vendor, setVendor] = useState(""); const [status, setStatus] = useState("Pending Quote"); const [cost, setCost] = useState("");
  const [filter, setFilter] = useState("all"); const [editIdx, setEditIdx] = useState(null);
  const materials = project.materials || [];
  const sC = { "Pending Quote": "#f59e0b", Quoted: "#6366f1", "PO Issued": "#8b5cf6", Ordered: "#3b82f6", Backordered: "#ef4444", Shipped: "#0ea5e9", Delivered: "#10b981", Installed: "#6b7280", Returned: "#f06595" };
  function add() { if (!item.trim()) return; onUpdate({ materials: [...materials, { id: genId(), item: item.trim(), manufacturer: mfr, vendor, qtyNeeded: qty, qtyOnHand: "", poNumber: "", status, deliveryDate: "", cost, notes: "" }] }); setItem(""); setMfr(""); setQty(""); setVendor(""); setStatus("Pending Quote"); setCost(""); }
  function upd(idx, f, v) { onUpdate({ materials: materials.map((m, i) => i === idx ? { ...m, [f]: v } : m) }); }
  const filtered = filter === "all" ? materials : materials.filter(m => m.status === filter);
  const totalCost = materials.reduce((s, m) => s + (parseFloat(m.cost) || 0) * (parseInt(m.qtyNeeded) || 1), 0);
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}><SC label="Items" value={materials.length} color="#6366f1" /><SC label="Delivered" value={materials.filter(m => m.status === "Delivered" || m.status === "Installed").length} color="#10b981" /><SC label="Backordered" value={materials.filter(m => m.status === "Backordered").length} color="#ef4444" /><SC label="Est. Cost" value={`$${totalCost.toLocaleString()}`} color="#f59e0b" /></div>
    <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
      <button onClick={() => setFilter("all")} style={{ padding: "4px 10px", borderRadius: 20, border: filter === "all" ? "2px solid #6366f1" : "1px solid #1e293b", background: filter === "all" ? "#6366f122" : "transparent", color: filter === "all" ? "#818cf8" : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>All</button>
      {MATERIAL_STATUSES.map(s => { const c = materials.filter(m => m.status === s).length; return c > 0 ? <button key={s} onClick={() => setFilter(s)} style={{ padding: "4px 10px", borderRadius: 20, border: filter === s ? `2px solid ${sC[s]}` : "1px solid #1e293b", background: filter === s ? sC[s] + "22" : "transparent", color: filter === s ? sC[s] : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s} ({c})</button> : null; })}
    </div>
    {filtered.map(m => { const idx = materials.indexOf(m); return (
      <div key={m.id} style={{ background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", padding: "12px 14px", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: (sC[m.status] || "#6b7280") + "22", color: sC[m.status], fontWeight: 600 }}>{m.status}</span>
          <div style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.item}</span><span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>{m.manufacturer}{m.vendor ? ` · ${m.vendor}` : ""}</span></div>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>×{m.qtyNeeded || 0}</span>
          <button onClick={() => setEditIdx(editIdx === idx ? null : idx)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><Edit2 size={12} /></button>
          <button onClick={() => onUpdate({ materials: materials.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
        </div>
        {editIdx === idx && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, paddingTop: 10, marginTop: 10, borderTop: "1px solid #1e293b" }}>
          <div><label style={sS}>Item</label><input style={{ ...iS, fontSize: 12 }} value={m.item} onChange={e => upd(idx, "item", e.target.value)} /></div>
          <div><label style={sS}>Manufacturer</label><input style={{ ...iS, fontSize: 12 }} value={m.manufacturer} onChange={e => upd(idx, "manufacturer", e.target.value)} /></div>
          <div><label style={sS}>Vendor</label><input style={{ ...iS, fontSize: 12 }} value={m.vendor} onChange={e => upd(idx, "vendor", e.target.value)} /></div>
          <div><label style={sS}>Qty</label><input type="number" style={{ ...iS, fontSize: 12 }} value={m.qtyNeeded} onChange={e => upd(idx, "qtyNeeded", e.target.value)} /></div>
          <div><label style={sS}>Status</label><select style={{ ...iS, fontSize: 12 }} value={m.status} onChange={e => upd(idx, "status", e.target.value)}>{MATERIAL_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label style={sS}>Unit Cost</label><input type="number" step="0.01" style={{ ...iS, fontSize: 12 }} value={m.cost} onChange={e => upd(idx, "cost", e.target.value)} /></div>
          <div><label style={sS}>PO #</label><input style={{ ...iS, fontSize: 12 }} value={m.poNumber} onChange={e => upd(idx, "poNumber", e.target.value)} /></div>
          <div><label style={sS}>Delivery</label><input type="date" style={{ ...iS, fontSize: 12 }} value={m.deliveryDate} onChange={e => upd(idx, "deliveryDate", e.target.value)} /></div>
          <div><label style={sS}>Notes</label><input style={{ ...iS, fontSize: 12 }} value={m.notes} onChange={e => upd(idx, "notes", e.target.value)} /></div>
        </div>)}
      </div>); })}
    {filtered.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#334155", fontSize: 13 }}>No materials{filter !== "all" ? " match filter" : " yet"}.</div>}
    <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
      <input style={{ ...iS, flex: 2 }} placeholder="Item name *" value={item} onChange={e => setItem(e.target.value)} />
      <input style={{ ...iS, flex: 1 }} placeholder="Manufacturer" value={mfr} onChange={e => setMfr(e.target.value)} />
      <input style={{ ...iS, flex: 0.5 }} placeholder="Qty" type="number" value={qty} onChange={e => setQty(e.target.value)} />
      <button onClick={add} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: item.trim() ? 1 : 0.4 }}><Plus size={14} /></button>
    </div>
  </div>);
}

/* ── INVOICES ── */
function InvoiceTab({ project, onUpdate }) {
  const [num, setNum] = useState(""); const [amt, setAmt] = useState(""); const [date, setDate] = useState(new Date().toISOString().split("T")[0]); const [desc, setDesc] = useState(""); const [st, setSt] = useState("requested");
  const inv = project.invoices || [];
  const contract = parseFloat(project.contractAmount) || 0;
  const totalInv = inv.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const pct = contract > 0 ? Math.round((totalInv / contract) * 100) : 0;
  const paid = inv.filter(i => i.status === "paid").reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  // Status config: value → { label, color }
  const STATUS_OPTIONS = [
    { value: "requested", label: "Invoice Requested", color: "#f59e0b" },
    { value: "sent",      label: "Invoice Approved/Sent", color: "#3b82f6" },
    { value: "paid",      label: "Paid",                  color: "#10b981" },
    { value: "overdue",   label: "Overdue",               color: "#ef4444" },
  ];
  const statusMap = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

  function add() {
    if (!num.trim() || !amt) return;
    onUpdate({ invoices: [...inv, { id: genId(), invoiceNumber: num, amount: amt, date, description: desc, status: st, createdAt: new Date().toISOString() }] });
    setNum(""); setAmt(""); setDesc("");
  }

  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
      <SC label="Contract"   value={contract ? `$${contract.toLocaleString()}` : "—"} color="#6366f1" />
      <SC label="Invoiced"   value={`$${totalInv.toLocaleString()}`}                  color="#f59e0b" />
      <SC label="Collected"  value={`$${paid.toLocaleString()}`}                      color="#10b981" />
      <SC label="% Invoiced" value={`${pct}%`}                                        color={pct >= 100 ? "#10b981" : "#f59e0b"} />
    </div>
    {pct > 0 && <div style={{ height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}><div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "linear-gradient(90deg, #6366f1, #10b981)", borderRadius: 4 }} /></div>}

    {inv.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((v, idx) => {
      const s = statusMap[v.status] || statusMap["requested"];
      return (
        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}>
          <div style={{ width: 36, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#818cf8" }}>#{v.invoiceNumber}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>${parseFloat(v.amount).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{v.date}{v.description ? ` — ${v.description}` : ""}</div>
          </div>
          <select
            value={v.status}
            onChange={e => onUpdate({ invoices: inv.map((x, i) => i === idx ? { ...x, status: e.target.value } : x) })}
            style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #1e293b", background: s.color + "22", color: s.color, fontSize: 11, fontWeight: 600, fontFamily: "inherit", outline: "none", cursor: "pointer" }}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => onUpdate({ invoices: inv.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
        </div>
      );
    })}

    {inv.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#334155", fontSize: 13 }}>No invoices yet.</div>}

    <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
      <input style={{ ...iS, flex: 0.5 }} placeholder="Inv #" value={num} onChange={e => setNum(e.target.value)} />
      <input type="number" step="0.01" style={{ ...iS, flex: 0.8 }} placeholder="Amount" value={amt} onChange={e => setAmt(e.target.value)} />
      <input type="date" style={{ ...iS, flex: 0.8 }} value={date} onChange={e => setDate(e.target.value)} />
      <input style={{ ...iS, flex: 1.5 }} placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
      <select style={{ ...iS, flex: 1 }} value={st} onChange={e => setSt(e.target.value)}>
        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button onClick={add} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: num.trim() && amt ? 1 : 0.4 }}><Plus size={14} /></button>
    </div>
  </div>);
}

/* ── CHANGE ORDERS ── */
function ChangeOrdersTab({ project, onUpdate }) {
  const [desc, setDesc] = useState(""); const [amt, setAmt] = useState(""); const [st, setSt] = useState("pending");
  const cos = project.changeOrders || [];
  const approved = cos.filter(c => c.status === "approved");
  const totalApproved = approved.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const origContract = parseFloat(project.contractAmount) || 0;
  const stC = { pending: "#f59e0b", approved: "#10b981", rejected: "#ef4444" };
  function add() { if (!desc.trim()) return; onUpdate({ changeOrders: [...cos, { id: genId(), description: desc.trim(), amount: amt, status: st, date: new Date().toISOString().split("T")[0], createdAt: new Date().toISOString() }] }); setDesc(""); setAmt(""); }
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
      <SC label="Original Contract" value={origContract ? `$${origContract.toLocaleString()}` : "—"} color="#6366f1" />
      <SC label="Approved COs" value={`$${totalApproved.toLocaleString()}`} color="#10b981" />
      <SC label="Adjusted Total" value={`$${(origContract + totalApproved).toLocaleString()}`} color="#f59e0b" />
    </div>
    {cos.map((co, idx) => (
      <div key={co.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>CO-{idx + 1}</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{co.description}</div><div style={{ fontSize: 11, color: "#64748b" }}>{co.date}</div></div>
        {co.amount && <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>${parseFloat(co.amount).toLocaleString()}</span>}
        <select value={co.status} onChange={e => onUpdate({ changeOrders: cos.map((c, i) => i === idx ? { ...c, status: e.target.value } : c) })} style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #1e293b", background: (stC[co.status]) + "22", color: stC[co.status], fontSize: 11, fontWeight: 600, fontFamily: "inherit", outline: "none", cursor: "pointer" }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
        <button onClick={() => onUpdate({ changeOrders: cos.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
      </div>
    ))}
    {cos.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#334155", fontSize: 13 }}>No change orders.</div>}
    <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
      <input style={{ ...iS, flex: 2 }} placeholder="Change order description *" value={desc} onChange={e => setDesc(e.target.value)} />
      <input type="number" step="0.01" style={{ ...iS, flex: 0.8 }} placeholder="Amount" value={amt} onChange={e => setAmt(e.target.value)} />
      <button onClick={add} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: desc.trim() ? 1 : 0.4 }}><Plus size={14} /></button>
    </div>
  </div>);
}

/* ── SCOPE ── */
function ScopeTab({ project, onUpdate }) {
  const [ndN, setNdN] = useState(""); const [ndQ, setNdQ] = useState(""); const [ndL, setNdL] = useState("");
  const [ncT, setNcT] = useState(""); const [ncQ, setNcQ] = useState(""); const [ncF, setNcF] = useState(""); const [ncTo, setNcTo] = useState("");
  return (<div>
    <div style={{ marginBottom: 24 }}><label style={lS}>Scope Notes</label><textarea style={{ ...iS, minHeight: 80, resize: "vertical" }} value={project.scopeNotes || ""} onChange={e => onUpdate({ scopeNotes: e.target.value })} placeholder="Describe scope..." /></div>
    <div style={{ marginBottom: 24 }}><div style={{ ...lS, marginBottom: 10 }}>Device Schedule</div>
      {(project.devices || []).map((d, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}><span style={{ color: "#94a3b8", minWidth: 30, textAlign: "right" }}>{d.qty}x</span><span style={{ color: "#e2e8f0", flex: 1 }}>{d.name}</span><span style={{ color: "#64748b", fontSize: 11 }}>{d.location}</span><button onClick={() => onUpdate({ devices: project.devices.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={13} /></button></div>))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}><input style={{ ...iS, flex: 0.5 }} placeholder="Qty" value={ndQ} onChange={e => setNdQ(e.target.value)} /><input style={{ ...iS, flex: 2 }} placeholder="Device" value={ndN} onChange={e => setNdN(e.target.value)} /><input style={{ ...iS, flex: 1.5 }} placeholder="Location" value={ndL} onChange={e => setNdL(e.target.value)} /><button onClick={() => { if (!ndN.trim()) return; onUpdate({ devices: [...(project.devices || []), { name: ndN.trim(), qty: ndQ || "1", location: ndL.trim() }] }); setNdN(""); setNdQ(""); setNdL(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer" }}><Plus size={14} /></button></div>
    </div>
    <div><div style={{ ...lS, marginBottom: 10 }}>Cable Runs</div>
      {(project.cableRuns || []).map((c, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}><span style={{ color: "#94a3b8", minWidth: 30, textAlign: "right" }}>{c.qty}x</span><span style={{ color: "#0ea5e9" }}>{c.type}</span><span style={{ color: "#64748b" }}>{c.from} → {c.to}</span><button onClick={() => onUpdate({ cableRuns: project.cableRuns.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginLeft: "auto" }}><X size={13} /></button></div>))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}><input style={{ ...iS, flex: 0.5 }} placeholder="Qty" value={ncQ} onChange={e => setNcQ(e.target.value)} /><input style={{ ...iS, flex: 1 }} placeholder="Type" value={ncT} onChange={e => setNcT(e.target.value)} /><input style={{ ...iS, flex: 1 }} placeholder="From" value={ncF} onChange={e => setNcF(e.target.value)} /><input style={{ ...iS, flex: 1 }} placeholder="To" value={ncTo} onChange={e => setNcTo(e.target.value)} /><button onClick={() => { if (!ncT.trim()) return; onUpdate({ cableRuns: [...(project.cableRuns || []), { type: ncT.trim(), qty: ncQ || "1", from: ncF.trim(), to: ncTo.trim() }] }); setNcT(""); setNcQ(""); setNcF(""); setNcTo(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer" }}><Plus size={14} /></button></div>
    </div>
  </div>);
}

/* ── TASKS ── */
function TasksTab({ project, onUpdate, teamRoster, assignTaskToMember }) {
  const [nt, setNt] = useState(""); const [na, setNa] = useState(""); const [nc, setNc] = useState("projects");
  function add() {
    if (!nt.trim()) return;
    const task = { text: nt.trim(), assignee: na, category: nc, done: false, id: genId() };
    onUpdate({ tasks: [...(project.tasks || []), task] });
    if (na && assignTaskToMember) {
      assignTaskToMember(nt.trim(), na, nc);
      const member = teamRoster.find(t => t.name === na);
      if (member?.email) {
        callFunction("emailTaskAssignment", { projectName: project.name, task, assigneeEmail: member.email });
      }
    }
    setNt(""); setNa("");
  }
  return (<div>
    {(project.tasks || []).map((t, i) => (
      <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: "1px solid #1e293b" }}>
        <button onClick={() => { const nt2 = [...project.tasks]; nt2[i] = { ...nt2[i], done: !nt2[i].done }; onUpdate({ tasks: nt2 }); }} style={{ background: "none", border: "none", cursor: "pointer", color: t.done ? "#10b981" : "#334155" }}>{t.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
        <span style={{ flex: 1, fontSize: 13, color: t.done ? "#64748b" : "#e2e8f0", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
        {t.category && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "#0f1729", color: "#94a3b8" }}>{TASK_CATEGORIES.find(c => c.id === t.category)?.icon} {TASK_CATEGORIES.find(c => c.id === t.category)?.label || t.category}</span>}
        {t.assignee && <span style={{ fontSize: 11, color: "#64748b", background: "#0f1729", padding: "2px 8px", borderRadius: 10 }}>{t.assignee}</span>}
        <button onClick={() => onUpdate({ tasks: project.tasks.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={12} /></button>
      </div>
    ))}
    <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
      <input style={{ ...iS, flex: 2, minWidth: 180 }} placeholder="New task..." value={nt} onChange={e => setNt(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
      <select style={{ ...iS, flex: 0.8 }} value={nc} onChange={e => setNc(e.target.value)}>{TASK_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select>
      <select style={{ ...iS, flex: 0.8 }} value={na} onChange={e => setNa(e.target.value)}><option value="">Unassigned</option>{teamRoster.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
      <button onClick={add} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0 }}><Plus size={14} /></button>
    </div>
  </div>);
}

/* ── DAILY LOG ── */
function DailyLogTab({ project, onUpdate }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]); const [member, setMember] = useState(""); const [hours, setHours] = useState(""); const [act, setAct] = useState("");
  const [sending, setSending] = useState(false); const [sent, setSent] = useState(false);
  const logs = project.dailyLogs || [];
  function add() {
    if (!act.trim()) return;
    const log = { id: genId(), date, member, hours: parseFloat(hours) || 0, activities: act.trim(), createdAt: new Date().toISOString() };
    onUpdate({ dailyLogs: [log, ...logs] });
    setSending(true);
    callFunction("emailDailyLog", { projectName: project.name, log }).then(r => {
      if (r?.result?.success) { setSent(true); setTimeout(() => setSent(false), 3000); }
      setSending(false);
    });
    setAct(""); setHours("");
  }
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
      <div><label style={sS}>Date</label><input type="date" style={iS} value={date} onChange={e => setDate(e.target.value)} /></div>
      <div><label style={sS}>Member</label><input style={iS} value={member} onChange={e => setMember(e.target.value)} /></div>
      <div><label style={sS}>Hours</label><input type="number" step="0.25" style={iS} value={hours} onChange={e => setHours(e.target.value)} /></div>
    </div>
    <div><label style={sS}>Activities</label><textarea style={{ ...iS, minHeight: 50, resize: "vertical" }} value={act} onChange={e => setAct(e.target.value)} placeholder="Work performed..." /></div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, marginBottom: 16, gap: 8, alignItems: "center" }}>
      {sent && <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>✓ Email sent to admins</span>}
      {sending && <span style={{ fontSize: 12, color: "#6366f1" }}>Sending email...</span>}
      <button onClick={add} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: act.trim() ? 1 : 0.4 }}><Plus size={14} /> Post & Email Log</button>
    </div>
    {logs.map((l, i) => (<div key={l.id} style={{ padding: "12px 14px", background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{l.date}</span>{l.member && <span style={{ fontSize: 11, color: "#64748b" }}>· {l.member}</span>}{l.hours > 0 && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>{l.hours}h</span>}<button onClick={() => onUpdate({ dailyLogs: logs.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", marginLeft: "auto" }}><X size={12} /></button></div>
      <div style={{ fontSize: 13, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>{l.activities}</div>
    </div>))}
    {logs.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#334155", fontSize: 13 }}>No daily logs yet.</div>}
  </div>);
}

/* ── PHOTO LOG ── */
function PhotoLogTab({ project, onUpdate }) {
  const [caption, setCaption] = useState(""); const [phase, setPhase] = useState("pre-existing"); const [location, setLocation] = useState("");
  const photos = project.photoLog || [];
  const phases = ["Pre-Existing Conditions", "Rough-In", "Trim Out", "Final Install", "Punch List", "Closeout", "Other"];
  function add() { if (!caption.trim()) return; onUpdate({ photoLog: [...photos, { id: genId(), caption: caption.trim(), phase, location: location.trim(), date: new Date().toISOString().split("T")[0], addedAt: new Date().toISOString() }] }); setCaption(""); setLocation(""); }
  const grouped = {};
  photos.forEach(p => { const k = p.phase || "Other"; if (!grouped[k]) grouped[k] = []; grouped[k].push(p); });
  return (<div>
    <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Log photos by phase for documentation and closeout packages.</p>
    {Object.entries(grouped).map(([phase, items]) => (
      <div key={phase} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 8 }}>{phase} ({items.length})</div>
        {items.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #0f1729" }}>
            <Camera size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <div style={{ flex: 1 }}><span style={{ fontSize: 13, color: "#e2e8f0" }}>{p.caption}</span>{p.location && <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>📍 {p.location}</span>}</div>
            <span style={{ fontSize: 11, color: "#475569" }}>{p.date}</span>
            <button onClick={() => onUpdate({ photoLog: photos.filter(x => x.id !== p.id) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
          </div>
        ))}
      </div>
    ))}
    {photos.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#334155", fontSize: 13, marginBottom: 16 }}>No photos logged yet.</div>}
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <input style={{ ...iS, flex: 2 }} placeholder="Photo description *" value={caption} onChange={e => setCaption(e.target.value)} />
      <select style={{ ...iS, flex: 1 }} value={phase} onChange={e => setPhase(e.target.value)}>{phases.map(p => <option key={p} value={p}>{p}</option>)}</select>
      <input style={{ ...iS, flex: 1 }} placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
      <button onClick={add} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: caption.trim() ? 1 : 0.4 }}><Plus size={14} /></button>
    </div>
  </div>);
}

/* ── RFI / SUBMITTALS ── */
function RFITab({ project, onUpdate }) {
  const [type, setType] = useState("rfi"); const [subj, setSubj] = useState(""); const [to, setTo] = useState(""); const [st, setSt] = useState("open");
  const items = project.rfis || [];
  const stC = { open: "#f59e0b", submitted: "#3b82f6", approved: "#10b981", rejected: "#ef4444", closed: "#6b7280" };
  function add() { if (!subj.trim()) return; onUpdate({ rfis: [...items, { id: genId(), type, subject: subj.trim(), to: to.trim(), status: st, sentDate: new Date().toISOString().split("T")[0], responseDate: "", notes: "", createdAt: new Date().toISOString() }] }); setSubj(""); setTo(""); }
  function upd(idx, f, v) { onUpdate({ rfis: items.map((x, i) => i === idx ? { ...x, [f]: v } : x) }); }
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
      <SC label="Open RFIs" value={items.filter(i => i.type === "rfi" && i.status === "open").length} color="#f59e0b" />
      <SC label="Open Submittals" value={items.filter(i => i.type === "submittal" && (i.status === "open" || i.status === "submitted")).length} color="#3b82f6" />
      <SC label="Approved" value={items.filter(i => i.status === "approved").length} color="#10b981" />
      <SC label="Total" value={items.length} color="#6366f1" />
    </div>
    {items.map((item, idx) => (
      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: item.type === "rfi" ? "#f59e0b22" : "#3b82f622", color: item.type === "rfi" ? "#f59e0b" : "#3b82f6", fontWeight: 700, textTransform: "uppercase" }}>{item.type}</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{item.subject}</div><div style={{ fontSize: 11, color: "#64748b" }}>To: {item.to || "—"} · Sent: {item.sentDate}{item.responseDate ? ` · Response: ${item.responseDate}` : ""}</div></div>
        <select value={item.status} onChange={e => upd(idx, "status", e.target.value)} style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #1e293b", background: (stC[item.status]) + "22", color: stC[item.status], fontSize: 11, fontWeight: 600, fontFamily: "inherit", outline: "none", cursor: "pointer" }}><option value="open">Open</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="closed">Closed</option></select>
        <button onClick={() => onUpdate({ rfis: items.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
      </div>
    ))}
    {items.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#334155", fontSize: 13 }}>No RFIs or submittals yet.</div>}
    <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
      <select style={{ ...iS, flex: 0.5 }} value={type} onChange={e => setType(e.target.value)}><option value="rfi">RFI</option><option value="submittal">Submittal</option></select>
      <input style={{ ...iS, flex: 2 }} placeholder="Subject *" value={subj} onChange={e => setSubj(e.target.value)} />
      <input style={{ ...iS, flex: 1 }} placeholder="To (GC, Architect...)" value={to} onChange={e => setTo(e.target.value)} />
      <button onClick={add} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: subj.trim() ? 1 : 0.4 }}><Plus size={14} /></button>
    </div>
  </div>);
}

/* ── PROFIT ── */
function ProfitTab({ project }) {
  const contract = parseFloat(project.contractAmount) || 0;
  const cos = (project.changeOrders || []).filter(c => c.status === "approved");
  const coTotal = cos.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const adjustedContract = contract + coTotal;
  const lh = project.laborHours || {};
  const totalBid = Object.values(lh).reduce((s, v) => s + (v.bid || 0), 0);
  const totalUsed = totalBid - Object.values(lh).reduce((s, v) => s + (v.remaining || 0), 0);
  const laborRate = 75;
  const laborCost = totalUsed * laborRate;
  const materialCost = (project.materials || []).reduce((s, m) => s + (parseFloat(m.cost) || 0) * (parseInt(m.qtyNeeded) || 1), 0);
  const totalCost = laborCost + materialCost;
  const profit = adjustedContract - totalCost;
  const margin = adjustedContract > 0 ? Math.round((profit / adjustedContract) * 100) : 0;
  const invoiced = (project.invoices || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const collected = (project.invoices || []).filter(i => i.status === "paid").reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  const rows = [
    { label: "Original Contract", value: contract, color: "#6366f1" },
    { label: "Approved Change Orders", value: coTotal, color: "#10b981" },
    { label: "Adjusted Contract", value: adjustedContract, color: "#fff", bold: true },
    { label: `Labor Cost (${totalUsed.toFixed(1)}h × $${laborRate}/hr)`, value: -laborCost, color: "#ef4444" },
    { label: "Material Cost", value: -materialCost, color: "#ef4444" },
    { label: "Estimated Profit", value: profit, color: profit >= 0 ? "#10b981" : "#ef4444", bold: true },
  ];

  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
      <SC label="Contract" value={`$${adjustedContract.toLocaleString()}`} color="#6366f1" />
      <SC label="Est. Profit" value={`$${profit.toLocaleString()}`} color={profit >= 0 ? "#10b981" : "#ef4444"} />
      <SC label="Margin" value={`${margin}%`} color={margin >= 20 ? "#10b981" : margin >= 10 ? "#f59e0b" : "#ef4444"} />
      <SC label="Collected" value={`$${collected.toLocaleString()}`} color="#3b82f6" />
    </div>
    <div style={{ background: "#0f1729", borderRadius: 10, padding: 16 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < rows.length - 1 ? "1px solid #1e293b" : "none" }}>
          <span style={{ fontSize: 13, color: r.bold ? "#fff" : "#94a3b8", fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: r.color, fontFamily: "'Outfit',sans-serif" }}>{r.value < 0 ? "-" : ""}${Math.abs(r.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 16, background: "#0f1729", borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Billing Status</div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e293b" }}><span style={{ fontSize: 13, color: "#94a3b8" }}>Total Invoiced</span><span style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>${invoiced.toLocaleString()}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e293b" }}><span style={{ fontSize: 13, color: "#94a3b8" }}>Collected</span><span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>${collected.toLocaleString()}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}><span style={{ fontSize: 13, color: "#94a3b8" }}>Outstanding</span><span style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>${(invoiced - collected).toLocaleString()}</span></div>
    </div>
    <div style={{ marginTop: 12, fontSize: 11, color: "#475569", fontStyle: "italic" }}>* Labor cost uses estimated burdened rate of ${laborRate}/hr. Adjust in future settings.</div>
  </div>);
}

/* ── PUNCH LIST ── */
function PunchListTab({ project, onUpdate }) {
  const [desc, setDesc] = useState(""); const [loc, setLoc] = useState(""); const [assignee, setAssignee] = useState("");
  const items = project.punchList || [];
  const done = items.filter(i => i.done).length;
  function add() { if (!desc.trim()) return; onUpdate({ punchList: [...items, { id: genId(), description: desc.trim(), location: loc.trim(), assignee, done: false, photo: "", createdAt: new Date().toISOString() }] }); setDesc(""); setLoc(""); }
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
      <SC label="Total Items" value={items.length} color="#6366f1" />
      <SC label="Completed" value={done} color="#10b981" />
      <SC label="Remaining" value={items.length - done} color={items.length - done > 0 ? "#ef4444" : "#10b981"} />
    </div>
    {items.length > 0 && <div style={{ height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}><div style={{ width: `${items.length > 0 ? (done / items.length) * 100 : 0}%`, height: "100%", background: "#10b981", borderRadius: 4 }} /></div>}
    {items.map((item, idx) => (
      <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: item.done ? "#10b98108" : "#0f1729", borderRadius: 10, border: `1px solid ${item.done ? "#10b98133" : "#1e293b"}`, marginBottom: 6 }}>
        <button onClick={() => onUpdate({ punchList: items.map((x, i) => i === idx ? { ...x, done: !x.done } : x) })} style={{ background: "none", border: "none", cursor: "pointer", color: item.done ? "#10b981" : "#334155", flexShrink: 0, marginTop: 2 }}>{item.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: item.done ? "#64748b" : "#fff", textDecoration: item.done ? "line-through" : "none" }}>{item.description}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{item.location && `📍 ${item.location}`}{item.assignee && ` · ${item.assignee}`}</div>
        </div>
        <button onClick={() => onUpdate({ punchList: items.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button>
      </div>
    ))}
    {items.length === 0 && <div style={{ textAlign: "center", padding: 20, color: "#334155", fontSize: 13 }}>No punch list items.</div>}
    <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
      <input style={{ ...iS, flex: 2 }} placeholder="Punch list item *" value={desc} onChange={e => setDesc(e.target.value)} />
      <input style={{ ...iS, flex: 1 }} placeholder="Location" value={loc} onChange={e => setLoc(e.target.value)} />
      <input style={{ ...iS, flex: 0.8 }} placeholder="Assignee" value={assignee} onChange={e => setAssignee(e.target.value)} />
      <button onClick={add} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0, opacity: desc.trim() ? 1 : 0.4 }}><Plus size={14} /></button>
    </div>
  </div>);
}

/* ── DOCS ── */
function DocsTab({ project, onUpdate }) {
  const [name, setName] = useState(""); const [type, setType] = useState("document");
  return (<div>
    {(project.documents || []).map((doc, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e293b" }}>{doc.type === "photo" ? <Camera size={14} style={{ color: "#f59e0b" }} /> : <FileText size={14} style={{ color: "#3b82f6" }} />}<span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{doc.name}</span><span style={{ fontSize: 11, color: "#64748b" }}>{doc.type}</span><span style={{ fontSize: 11, color: "#475569" }}>{new Date(doc.addedAt).toLocaleDateString()}</span><button onClick={() => onUpdate({ documents: project.documents.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={12} /></button></div>))}
    <div style={{ display: "flex", gap: 6, marginTop: 12 }}><input style={{ ...iS, flex: 2 }} placeholder="Document name..." value={name} onChange={e => setName(e.target.value)} /><select style={{ ...iS, flex: 0.8 }} value={type} onChange={e => setType(e.target.value)}><option value="document">Document</option><option value="photo">Photo</option><option value="drawing">Drawing</option><option value="proposal">Proposal</option><option value="contract">Contract</option><option value="submittal">Submittal</option><option value="closeout">Closeout Pkg</option></select><button onClick={() => { if (!name.trim()) return; onUpdate({ documents: [...(project.documents || []), { name: name.trim(), type, addedAt: new Date().toISOString() }] }); setName(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer" }}><Plus size={14} /></button></div>
  </div>);
}

/* ── NOTES ── */
function NotesTab({ project, onUpdate }) {
  const [note, setNote] = useState("");
  return (<div>
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}><input style={{ ...iS, flex: 1 }} placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && note.trim()) { onUpdate({ notes: [{ text: note.trim(), date: new Date().toISOString() }, ...(project.notes || [])] }); setNote(""); } }} /><button onClick={() => { if (!note.trim()) return; onUpdate({ notes: [{ text: note.trim(), date: new Date().toISOString() }, ...(project.notes || [])] }); setNote(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer" }}><Plus size={14} /></button></div>
    {(project.notes || []).map((n, i) => (<div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #1e293b", display: "flex", gap: 10 }}><Clock size={14} style={{ color: "#475569", marginTop: 2, flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, color: "#e2e8f0" }}>{n.text}</div><div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{new Date(n.date).toLocaleString()}</div></div><button onClick={() => onUpdate({ notes: project.notes.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button></div>))}
  </div>);
}
