import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle2, Clock, Plus, X, Edit2 } from "lucide-react";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function WarrantyTracker({ projects, onUpdateProject }) {
  const [filter, setFilter] = useState("all");
  const [expandedProject, setExpandedProject] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const [form, setForm] = useState({ item: "", manufacturer: "", warrantyYears: "", startDate: "", serialNumber: "", notes: "" });

  const iS = { width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 3, display: "block", textTransform: "uppercase" };

  const today = new Date();
  const allWarranties = [];
  projects.forEach(p => {
    (p.warranties || []).forEach(w => {
      const start = new Date(w.startDate);
      const end = new Date(start); end.setFullYear(end.getFullYear() + (parseInt(w.warrantyYears) || 1));
      const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
      const status = daysLeft < 0 ? "expired" : daysLeft <= 30 ? "expiring-30" : daysLeft <= 90 ? "expiring-90" : "active";
      allWarranties.push({ ...w, projectName: p.name, projectId: p.id, endDate: end, daysLeft, status });
    });
  });

  const expiring30 = allWarranties.filter(w => w.status === "expiring-30").length;
  const expiring90 = allWarranties.filter(w => w.status === "expiring-90").length;
  const expired = allWarranties.filter(w => w.status === "expired").length;
  const active = allWarranties.filter(w => w.status === "active").length;

  const filtered = filter === "all" ? allWarranties : allWarranties.filter(w => w.status === filter);
  filtered.sort((a, b) => a.daysLeft - b.daysLeft);

  const stC = { "expiring-30": "#ef4444", "expiring-90": "#f59e0b", expired: "#6b7280", active: "#10b981" };
  const stL = { "expiring-30": "Expires <30 days", "expiring-90": "Expires <90 days", expired: "Expired", active: "Active" };

  function addWarranty(projectId) {
    if (!form.item.trim()) return;
    const p = projects.find(pr => pr.id === projectId);
    if (!p) return;
    onUpdateProject(projectId, { warranties: [...(p.warranties || []), { ...form, id: genId(), registeredAt: new Date().toISOString() }] });
    setForm({ item: "", manufacturer: "", warrantyYears: "", startDate: "", serialNumber: "", notes: "" }); setAddingTo(null);
  }

  function removeWarranty(projectId, warId) {
    const p = projects.find(pr => pr.id === projectId);
    if (!p) return;
    onUpdateProject(projectId, { warranties: (p.warranties || []).filter(w => w.id !== warId) });
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Track warranties across all projects. Get alerted before coverage expires.</p>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Active", value: active, color: "#10b981", f: "active" },
          { label: "Expiring <90d", value: expiring90, color: "#f59e0b", f: "expiring-90" },
          { label: "Expiring <30d", value: expiring30, color: "#ef4444", f: "expiring-30" },
          { label: "Expired", value: expired, color: "#6b7280", f: "expired" },
        ].map(s => (
          <button key={s.f} onClick={() => setFilter(filter === s.f ? "all" : s.f)} style={{ background: "#0F2444", borderRadius: 10, padding: "14px 16px", border: filter === s.f ? `2px solid ${s.color}` : "1px solid #1A3050", cursor: "pointer", textAlign: "left", fontFamily: "inherit", borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'Outfit',sans-serif" }}>{s.value}</div>
          </button>
        ))}
      </div>

      {/* Warranty List */}
      {filtered.map(w => (
        <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#0F2444", borderRadius: 10, border: "1px solid #1A3050", marginBottom: 6, borderLeft: `3px solid ${stC[w.status]}` }}>
          {w.status === "expired" ? <Shield size={18} style={{ color: "#6b7280", flexShrink: 0 }} /> : w.status === "expiring-30" ? <AlertTriangle size={18} style={{ color: "#ef4444", flexShrink: 0 }} /> : w.status === "expiring-90" ? <Clock size={18} style={{ color: "#f59e0b", flexShrink: 0 }} /> : <CheckCircle2 size={18} style={{ color: "#10b981", flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{w.item}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{w.manufacturer}{w.serialNumber ? ` · S/N: ${w.serialNumber}` : ""} · {w.projectName}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: stC[w.status] }}>{w.daysLeft > 0 ? `${w.daysLeft} days left` : `Expired ${Math.abs(w.daysLeft)} days ago`}</div>
            <div style={{ fontSize: 10, color: "#475569" }}>Expires {w.endDate.toLocaleDateString()}</div>
          </div>
          <button onClick={() => removeWarranty(w.projectId, w.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
        </div>
      ))}
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>No warranties {filter !== "all" ? "match this filter" : "registered yet"}.</div>}

      {/* Add Warranty — select project */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Register Warranty</div>
        <select style={{ ...iS, marginBottom: 10 }} value={addingTo || ""} onChange={e => setAddingTo(e.target.value || null)}>
          <option value="">Select a project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.customer}</option>)}
        </select>
        {addingTo && (
          <div style={{ background: "#0F2444", borderRadius: 10, padding: 16, border: "1px solid #1A3050" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div><label style={lS}>Item *</label><input style={iS} value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="e.g., Axis P3245-V Camera" /></div>
              <div><label style={lS}>Manufacturer</label><input style={iS} value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></div>
              <div><label style={lS}>Serial Number</label><input style={iS} value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} /></div>
              <div><label style={lS}>Warranty (years)</label><input type="number" style={iS} value={form.warrantyYears} onChange={e => setForm({ ...form, warrantyYears: e.target.value })} placeholder="e.g., 3" /></div>
              <div><label style={lS}>Start Date</label><input type="date" style={iS} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><label style={lS}>Notes</label><input style={iS} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => addWarranty(addingTo)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: form.item.trim() ? 1 : 0.4 }}><Plus size={14} /> Register</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
