import { useState, useEffect } from "react";
import { Plus, X, Edit2, Trash2, ClipboardList, Clock, Cable, CheckCircle2, Circle, FileText, Camera, MapPin, Phone, Mail, DollarSign, Building2, User, Layers, Package, Receipt, BookOpen } from "lucide-react";
import { PROJECT_TYPES, LABOR_PHASES, MATERIAL_STATUSES, TASK_CATEGORIES, genId } from "./App.jsx";

const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
function IR({ icon: Icon, label, value }) { return (<div><div style={lS}>{label}</div><div style={{ fontSize: 13, color: value ? "#e2e8f0" : "#334155", display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} style={{ color: "#475569" }} />{value || "—"}</div></div>); }
function SC({ label, value, color }) { return (<div style={{ background: "#0f1729", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${color}` }}><div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Outfit',sans-serif" }}>{value}</div></div>); }

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
    { id: "scope", label: "Scope", icon: Cable },
    { id: "tasks", label: "Tasks", icon: CheckCircle2 },
    { id: "dailylog", label: "Daily Log", icon: BookOpen },
    { id: "docs", label: "Docs", icon: FileText },
    { id: "notes", label: "Activity", icon: Clock },
  ];
  const cp = phaseMap[project.phaseId];

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px 24px" }}>
      {/* Header */}
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

      {/* Phase selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {phases.map(ph => (<button key={ph.id} onClick={() => onUpdate({ phaseId: ph.id })} style={{ padding: "5px 12px", borderRadius: 20, border: project.phaseId === ph.id ? `2px solid ${ph.color}` : "1px solid #1e293b", background: project.phaseId === ph.id ? ph.color + "22" : "transparent", color: project.phaseId === ph.id ? ph.color : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{ph.name}</button>))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid #1e293b", overflowX: "auto" }}>
        {tabs.map(tab => (<button key={tab.id} onClick={() => setDetailTab(tab.id)} style={{ padding: "10px 14px", border: "none", background: "none", cursor: "pointer", color: detailTab === tab.id ? "#fff" : "#64748b", borderBottom: detailTab === tab.id ? "2px solid #6366f1" : "2px solid transparent", fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><tab.icon size={13} /> {tab.label}</button>))}
      </div>

      <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20 }}>
        {detailTab === "overview" && <OverviewTab project={project} form={form} setForm={setForm} editMode={editMode} setEditMode={setEditMode} onUpdate={onUpdate} teamRoster={teamRoster} />}
        {detailTab === "hours" && <HoursTab project={project} onUpdate={onUpdate} />}
        {detailTab === "materials" && <MaterialsTab project={project} onUpdate={onUpdate} />}
        {detailTab === "invoices" && <InvoiceTab project={project} onUpdate={onUpdate} />}
        {detailTab === "scope" && <ScopeTab project={project} onUpdate={onUpdate} />}
        {detailTab === "tasks" && <TasksTab project={project} onUpdate={onUpdate} teamRoster={teamRoster} assignTaskToMember={assignTaskToMember} />}
        {detailTab === "dailylog" && <DailyLogTab project={project} onUpdate={onUpdate} />}
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
  const hS = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", textAlign: "center" };
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
      <SC label="Total Bid" value={`${tB.toFixed(1)}h`} color="#6366f1" /><SC label="Used" value={`${tU.toFixed(1)}h`} color="#f59e0b" /><SC label="Remaining" value={`${tR.toFixed(1)}h`} color="#10b981" /><SC label="Complete" value={`${tP}%`} color={tP > 90 ? "#ef4444" : tP > 70 ? "#f59e0b" : "#10b981"} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "0 12px 10px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}><span>Phase</span><span style={{ textAlign: "center" }}>Bid</span><span style={{ textAlign: "center" }}>Used</span><span style={{ textAlign: "center" }}>Remaining</span><span style={{ textAlign: "center" }}>Progress</span></div>
    {LABOR_PHASES.map(lp => { const b = lh[lp.id]?.bid || 0, r = lh[lp.id]?.remaining || 0, u = b - r, p = b > 0 ? Math.round(u / b * 100) : 0, o = r < 0; return (
      <div key={lp.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "10px 12px", background: "#0f1729", borderRadius: 8, marginBottom: 4, border: o ? "1px solid #7f1d1d" : "1px solid transparent" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{lp.name}</span>
        <input type="number" step="0.5" min="0" style={hS} value={b || ""} onChange={e => upd(lp.id, "bid", e.target.value)} placeholder="0" />
        <div style={{ textAlign: "center", fontSize: 13, color: o ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>{u.toFixed(1)}h</div>
        <input type="number" step="0.5" style={hS} value={r || ""} onChange={e => upd(lp.id, "remaining", e.target.value)} placeholder="0" />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1e293b", overflow: "hidden" }}><div style={{ width: `${Math.min(p, 100)}%`, height: "100%", borderRadius: 3, background: o ? "#ef4444" : p > 90 ? "#f59e0b" : "#10b981" }} /></div><span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, minWidth: 32, textAlign: "right" }}>{p}%</span></div>
      </div>); })}
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: 12, background: "#1e293b", borderRadius: 8, marginTop: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>TOTALS</span>
      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#6366f1", fontFamily: "'Outfit',sans-serif" }}>{tB.toFixed(1)}h</div>
      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#f59e0b", fontFamily: "'Outfit',sans-serif" }}>{tU.toFixed(1)}h</div>
      <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#10b981", fontFamily: "'Outfit',sans-serif" }}>{tR.toFixed(1)}h</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ flex: 1, height: 6, borderRadius: 3, background: "#0f1729", overflow: "hidden" }}><div style={{ width: `${Math.min(tP, 100)}%`, height: "100%", borderRadius: 3, background: tP > 90 ? "#f59e0b" : "#10b981" }} /></div><span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, minWidth: 32, textAlign: "right" }}>{tP}%</span></div>
    </div>
  </div>);
}

/* ── MATERIALS ── */
function MaterialsTab({ project, onUpdate }) {
  const [item, setItem] = useState(""); const [mfr, setMfr] = useState(""); const [qty, setQty] = useState(""); const [oh, setOh] = useState("");
  const [po, setPo] = useState(""); const [vendor, setVendor] = useState(""); const [status, setStatus] = useState("Pending Quote");
  const [dd, setDd] = useState(""); const [cost, setCost] = useState(""); const [mn, setMn] = useState("");
  const [filter, setFilter] = useState("all"); const [editIdx, setEditIdx] = useState(null);
  const materials = project.materials || [];
  const sC = { "Pending Quote": "#f59e0b", "Quoted": "#6366f1", "PO Issued": "#8b5cf6", "Ordered": "#3b82f6", "Backordered": "#ef4444", "Shipped": "#0ea5e9", "Delivered": "#10b981", "Installed": "#6b7280", "Returned": "#f06595" };
  const mS = { width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const mL = { fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 3, display: "block", textTransform: "uppercase" };
  function add() { if (!item.trim()) return; onUpdate({ materials: [...materials, { id: genId(), item: item.trim(), manufacturer: mfr, vendor, qtyNeeded: qty, qtyOnHand: oh, poNumber: po, status, deliveryDate: dd, cost, notes: mn }] }); setItem(""); setMfr(""); setQty(""); setOh(""); setPo(""); setVendor(""); setStatus("Pending Quote"); setDd(""); setCost(""); setMn(""); }
  function upd(idx, f, v) { onUpdate({ materials: materials.map((m, i) => i === idx ? { ...m, [f]: v } : m) }); }
  const filtered = filter === "all" ? materials : materials.filter(m => m.status === filter);
  const totalCost = materials.reduce((s, m) => s + (parseFloat(m.cost) || 0) * (parseInt(m.qtyNeeded) || 1), 0);
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
      <SC label="Items" value={materials.length} color="#6366f1" /><SC label="Delivered" value={materials.filter(m => m.status === "Delivered" || m.status === "Installed").length} color="#10b981" /><SC label="Backordered" value={materials.filter(m => m.status === "Backordered").length} color="#ef4444" /><SC label="Est. Cost" value={`$${totalCost.toLocaleString()}`} color="#f59e0b" />
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
      <button onClick={() => setFilter("all")} style={{ padding: "4px 12px", borderRadius: 20, border: filter === "all" ? "2px solid #6366f1" : "1px solid #1e293b", background: filter === "all" ? "#6366f122" : "transparent", color: filter === "all" ? "#818cf8" : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>All</button>
      {MATERIAL_STATUSES.map(s => { const c = materials.filter(m => m.status === s).length; return c > 0 ? <button key={s} onClick={() => setFilter(s)} style={{ padding: "4px 12px", borderRadius: 20, border: filter === s ? `2px solid ${sC[s]}` : "1px solid #1e293b", background: filter === s ? sC[s] + "22" : "transparent", color: filter === s ? sC[s] : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s} ({c})</button> : null; })}
    </div>
    {filtered.map(m => { const idx = materials.indexOf(m); return (
      <div key={m.id} style={{ background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", padding: "14px 16px", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: (sC[m.status] || "#6b7280") + "22", color: sC[m.status], fontWeight: 600 }}>{m.status}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.item}</div><div style={{ fontSize: 11, color: "#64748b" }}>{m.manufacturer}{m.vendor ? ` · ${m.vendor}` : ""}{m.poNumber ? ` · PO: ${m.poNumber}` : ""}</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#94a3b8" }}>Qty: {m.qtyNeeded || 0}</div>{m.cost && <div style={{ fontSize: 11, color: "#f59e0b" }}>${m.cost} ea</div>}</div>
          <button onClick={() => setEditIdx(editIdx === idx ? null : idx)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><Edit2 size={13} /></button>
          <button onClick={() => onUpdate({ materials: materials.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
        </div>
        {editIdx === idx && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingTop: 12, marginTop: 12, borderTop: "1px solid #1e293b" }}>
            <div><label style={mL}>Item</label><input style={mS} value={m.item} onChange={e => upd(idx, "item", e.target.value)} /></div>
            <div><label style={mL}>Manufacturer</label><input style={mS} value={m.manufacturer} onChange={e => upd(idx, "manufacturer", e.target.value)} /></div>
            <div><label style={mL}>Vendor</label><input style={mS} value={m.vendor} onChange={e => upd(idx, "vendor", e.target.value)} /></div>
            <div><label style={mL}>Qty Needed</label><input type="number" style={mS} value={m.qtyNeeded} onChange={e => upd(idx, "qtyNeeded", e.target.value)} /></div>
            <div><label style={mL}>On Hand</label><input type="number" style={mS} value={m.qtyOnHand} onChange={e => upd(idx, "qtyOnHand", e.target.value)} /></div>
            <div><label style={mL}>PO #</label><input style={mS} value={m.poNumber} onChange={e => upd(idx, "poNumber", e.target.value)} /></div>
            <div><label style={mL}>Status</label><select style={mS} value={m.status} onChange={e => upd(idx, "status", e.target.value)}>{MATERIAL_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label style={mL}>Delivery</label><input type="date" style={mS} value={m.deliveryDate} onChange={e => upd(idx, "deliveryDate", e.target.value)} /></div>
            <div><label style={mL}>Unit Cost</label><input type="number" step="0.01" style={mS} value={m.cost} onChange={e => upd(idx, "cost", e.target.value)} /></div>
            <div style={{ gridColumn: "1/-1" }}><label style={mL}>Notes</label><input style={mS} value={m.notes} onChange={e => upd(idx, "notes", e.target.value)} /></div>
          </div>
        )}
      </div>); })}
    {filtered.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#334155", fontSize: 13 }}>No materials{filter !== "all" ? " match this filter" : " yet"}.</div>}
    <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Add Material</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div><label style={mL}>Item *</label><input style={mS} value={item} onChange={e => setItem(e.target.value)} /></div>
        <div><label style={mL}>Manufacturer</label><input style={mS} value={mfr} onChange={e => setMfr(e.target.value)} /></div>
        <div><label style={mL}>Vendor</label><input style={mS} value={vendor} onChange={e => setVendor(e.target.value)} /></div>
        <div><label style={mL}>Qty</label><input type="number" style={mS} value={qty} onChange={e => setQty(e.target.value)} /></div>
        <div><label style={mL}>Status</label><select style={mS} value={status} onChange={e => setStatus(e.target.value)}>{MATERIAL_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label style={mL}>Unit Cost</label><input type="number" step="0.01" style={mS} value={cost} onChange={e => setCost(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button onClick={add} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: item.trim() ? 1 : 0.4 }}><Plus size={14} /> Add</button></div>
    </div>
  </div>);
}

/* ── INVOICES ── */
function InvoiceTab({ project, onUpdate }) {
  const [num, setNum] = useState(""); const [amt, setAmt] = useState(""); const [date, setDate] = useState(new Date().toISOString().split("T")[0]); const [desc, setDesc] = useState(""); const [status, setStatus] = useState("sent");
  const invoices = project.invoices || [];
  const contractAmt = parseFloat(project.contractAmount) || 0;
  const totalInvoiced = invoices.reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
  const pctInvoiced = contractAmt > 0 ? Math.round((totalInvoiced / contractAmt) * 100) : 0;
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
  function add() { if (!num.trim() || !amt) return; onUpdate({ invoices: [...invoices, { id: genId(), invoiceNumber: num.trim(), amount: amt, date, description: desc.trim(), status, createdAt: new Date().toISOString() }] }); setNum(""); setAmt(""); setDesc(""); }
  const stC = { sent: "#3b82f6", paid: "#10b981", overdue: "#ef4444" };
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
      <SC label="Contract" value={contractAmt ? `$${contractAmt.toLocaleString()}` : "—"} color="#6366f1" />
      <SC label="Invoiced" value={`$${totalInvoiced.toLocaleString()}`} color="#f59e0b" />
      <SC label="Collected" value={`$${totalPaid.toLocaleString()}`} color="#10b981" />
      <SC label="% Invoiced" value={`${pctInvoiced}%`} color={pctInvoiced >= 100 ? "#10b981" : "#f59e0b"} />
    </div>
    {pctInvoiced > 0 && <div style={{ height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden", marginBottom: 20 }}><div style={{ width: `${Math.min(pctInvoiced, 100)}%`, height: "100%", background: "linear-gradient(90deg, #6366f1, #10b981)", borderRadius: 4, transition: "width 0.3s" }} /></div>}
    {invoices.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((inv, idx) => (
      <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8", fontWeight: 700, fontSize: 11, fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}>#{inv.invoiceNumber}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>${parseFloat(inv.amount).toLocaleString()}</div><div style={{ fontSize: 11, color: "#64748b" }}>{inv.date}{inv.description ? ` — ${inv.description}` : ""}</div></div>
        <select value={inv.status} onChange={e => onUpdate({ invoices: invoices.map((v, i) => i === idx ? { ...v, status: e.target.value } : v) })} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #1e293b", background: (stC[inv.status] || "#6b7280") + "22", color: stC[inv.status], fontSize: 11, fontWeight: 600, fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
          <option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
        </select>
        <button onClick={() => onUpdate({ invoices: invoices.filter((_, i) => i !== idx) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
      </div>
    ))}
    {invoices.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#334155", fontSize: 13 }}>No invoices yet.</div>}
    <div style={{ background: "#1e293b", borderRadius: 10, padding: 16, marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Add Invoice</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <div><label style={{ ...lS, fontSize: 10 }}>Invoice # *</label><input style={iS} value={num} onChange={e => setNum(e.target.value)} /></div>
        <div><label style={{ ...lS, fontSize: 10 }}>Amount *</label><input type="number" step="0.01" style={iS} value={amt} onChange={e => setAmt(e.target.value)} /></div>
        <div><label style={{ ...lS, fontSize: 10 }}>Date</label><input type="date" style={iS} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label style={{ ...lS, fontSize: 10 }}>Status</label><select style={iS} value={status} onChange={e => setStatus(e.target.value)}><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></div>
      </div>
      <div style={{ marginTop: 8 }}><label style={{ ...lS, fontSize: 10 }}>Description</label><input style={iS} value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g., Progress billing #2 — rough-in complete" /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button onClick={add} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: num.trim() && amt ? 1 : 0.4 }}><Plus size={14} /> Add Invoice</button></div>
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

/* ── TASKS (with categories) ── */
function TasksTab({ project, onUpdate, teamRoster, assignTaskToMember }) {
  const [newTask, setNewTask] = useState(""); const [newAssignee, setNewAssignee] = useState(""); const [newCategory, setNewCategory] = useState("projects");
  function addTask() {
    if (!newTask.trim()) return;
    const task = { text: newTask.trim(), assignee: newAssignee, category: newCategory, done: false, id: genId() };
    onUpdate({ tasks: [...(project.tasks || []), task] });
    if (newAssignee && assignTaskToMember) assignTaskToMember(newTask.trim(), newAssignee, newCategory);
    setNewTask(""); setNewAssignee("");
  }
  return (<div>
    {(project.tasks || []).map((task, i) => (
      <div key={task.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
        <button onClick={() => { const nt = [...project.tasks]; nt[i] = { ...nt[i], done: !nt[i].done }; onUpdate({ tasks: nt }); }} style={{ background: "none", border: "none", cursor: "pointer", color: task.done ? "#10b981" : "#334155" }}>{task.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
        <span style={{ flex: 1, fontSize: 13, color: task.done ? "#64748b" : "#e2e8f0", textDecoration: task.done ? "line-through" : "none" }}>{task.text}</span>
        {task.category && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#0f1729", color: "#94a3b8" }}>{TASK_CATEGORIES.find(c => c.id === task.category)?.icon} {TASK_CATEGORIES.find(c => c.id === task.category)?.label || task.category}</span>}
        {task.assignee && <span style={{ fontSize: 11, color: "#64748b", background: "#0f1729", padding: "2px 8px", borderRadius: 10 }}>{task.assignee}</span>}
        <button onClick={() => onUpdate({ tasks: project.tasks.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={13} /></button>
      </div>
    ))}
    <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
      <input style={{ ...iS, flex: 2, minWidth: 200 }} placeholder="New task..." value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTask(); }} />
      <select style={{ ...iS, flex: 0.8 }} value={newCategory} onChange={e => setNewCategory(e.target.value)}>{TASK_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select>
      <select style={{ ...iS, flex: 0.8 }} value={newAssignee} onChange={e => setNewAssignee(e.target.value)}><option value="">Unassigned</option>{teamRoster.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
      <button onClick={addTask} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0 }}><Plus size={14} /></button>
    </div>
  </div>);
}

/* ── DAILY LOG ── */
function DailyLogTab({ project, onUpdate }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]); const [member, setMember] = useState(""); const [hours, setHours] = useState(""); const [activities, setActivities] = useState("");
  const logs = project.dailyLogs || [];
  function add() { if (!activities.trim()) return; onUpdate({ dailyLogs: [{ id: genId(), date, member, hours: parseFloat(hours) || 0, activities: activities.trim(), createdAt: new Date().toISOString() }, ...logs] }); setActivities(""); setHours(""); }
  return (<div>
    <div style={{ background: "#0f1729", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Log Today's Work</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div><label style={{ ...lS, fontSize: 10 }}>Date</label><input type="date" style={iS} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label style={{ ...lS, fontSize: 10 }}>Team Member</label><input style={iS} value={member} onChange={e => setMember(e.target.value)} placeholder="Name" /></div>
        <div><label style={{ ...lS, fontSize: 10 }}>Hours Worked</label><input type="number" step="0.25" style={iS} value={hours} onChange={e => setHours(e.target.value)} /></div>
      </div>
      <div><label style={{ ...lS, fontSize: 10 }}>Activities</label><textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={activities} onChange={e => setActivities(e.target.value)} placeholder="Describe work performed today..." /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button onClick={add} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: activities.trim() ? 1 : 0.4 }}><Plus size={14} /> Log Entry</button></div>
    </div>
    {logs.map((log, i) => (
      <div key={log.id} style={{ padding: "14px 16px", background: "#0f1729", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{log.date}</span>
          {log.member && <span style={{ fontSize: 11, color: "#64748b" }}>· {log.member}</span>}
          {log.hours > 0 && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>{log.hours}h</span>}
          <button onClick={() => onUpdate({ dailyLogs: logs.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", marginLeft: "auto" }}><X size={13} /></button>
        </div>
        <div style={{ fontSize: 13, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>{log.activities}</div>
      </div>
    ))}
    {logs.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#334155", fontSize: 13 }}>No daily logs yet.</div>}
  </div>);
}

/* ── DOCS ── */
function DocsTab({ project, onUpdate }) {
  const [name, setName] = useState(""); const [type, setType] = useState("document");
  return (<div>
    {(project.documents || []).map((doc, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e293b" }}>{doc.type === "photo" ? <Camera size={16} style={{ color: "#f59e0b" }} /> : <FileText size={16} style={{ color: "#3b82f6" }} />}<span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{doc.name}</span><span style={{ fontSize: 11, color: "#64748b" }}>{doc.type}</span><span style={{ fontSize: 11, color: "#475569" }}>{new Date(doc.addedAt).toLocaleDateString()}</span><button onClick={() => onUpdate({ documents: project.documents.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={13} /></button></div>))}
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
