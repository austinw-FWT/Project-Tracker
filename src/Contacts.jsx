import { useState } from "react";
import { Plus, X, Edit2, Search, Building2, Phone, Mail, MapPin, User } from "lucide-react";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function Contacts({ contacts, projects, onSave }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ company: "", contactName: "", phone: "", email: "", address: "", notes: "", type: "customer" });

  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  function save() {
    if (!form.company.trim()) return;
    if (editId) { onSave((contacts || []).map(c => c.id === editId ? { ...c, ...form, updatedAt: new Date().toISOString() } : c)); setEditId(null); }
    else { onSave([...(contacts || []), { ...form, id: genId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]); }
    setForm({ company: "", contactName: "", phone: "", email: "", address: "", notes: "", type: "customer" }); setShowForm(false);
  }

  const filtered = (contacts || []).filter(c => !search || c.company.toLowerCase().includes(search.toLowerCase()) || (c.contactName || "").toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.company.localeCompare(b.company));

  const typeColors = { customer: "#10b981", gc: "#3b82f6", vendor: "#8b5cf6", subcontractor: "#f59e0b", other: "#6b7280" };

  // Count projects per contact
  function projectCount(contact) { return projects.filter(p => p.customer === contact.company).length; }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid #1e293b", background: "#1e293b", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ company: "", contactName: "", phone: "", email: "", address: "", notes: "", type: "customer" }); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /> Add Contact</button>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20 }}>
        {[["Customers", "customer"], ["GCs", "gc"], ["Vendors", "vendor"], ["Subs", "subcontractor"], ["Other", "other"]].map(([label, type]) => {
          const c = (contacts || []).filter(ct => ct.type === type).length;
          return (<div key={type} style={{ background: "#1a2332", borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${typeColors[type]}`, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: typeColors[type], fontFamily: "'Outfit',sans-serif" }}>{c}</div>
          </div>);
        })}
      </div>

      {/* Contact List */}
      {filtered.map(contact => (
        <div key={contact.id} style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: "16px 20px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: (typeColors[contact.type] || "#6b7280") + "22", display: "flex", alignItems: "center", justifyContent: "center", color: typeColors[contact.type], flexShrink: 0 }}><Building2 size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{contact.company}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748b", flexWrap: "wrap", marginTop: 2 }}>
                {contact.contactName && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={11} /> {contact.contactName}</span>}
                {contact.phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {contact.phone}</span>}
                {contact.email && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} /> {contact.email}</span>}
              </div>
            </div>
            <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: (typeColors[contact.type] || "#6b7280") + "22", color: typeColors[contact.type], fontWeight: 600, textTransform: "capitalize" }}>{contact.type}</span>
            {projectCount(contact) > 0 && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "#0f1729", color: "#94a3b8" }}>{projectCount(contact)} projects</span>}
            <button onClick={() => { setForm(contact); setEditId(contact.id); setShowForm(true); }} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><Edit2 size={13} /></button>
            <button onClick={() => onSave((contacts || []).filter(c => c.id !== contact.id))} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
          </div>
          {contact.address && <div style={{ fontSize: 12, color: "#475569", marginTop: 8, paddingLeft: 52, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {contact.address}</div>}
          {contact.notes && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, paddingLeft: 52 }}>{contact.notes}</div>}
        </div>
      ))}
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>No contacts yet.</div>}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#1a2332", borderRadius: 16, border: "1px solid #1e293b", padding: 24, width: 480, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}><h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: 0 }}>{editId ? "Edit" : "New"} Contact</h2><button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={18} /></button></div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div><label style={lS}>Company *</label><input style={iS} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
                <div><label style={lS}>Type</label><select style={iS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="customer">Customer</option><option value="gc">General Contractor</option><option value="vendor">Vendor</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></select></div>
              </div>
              <div><label style={lS}>Contact Name</label><input style={iS} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lS}>Phone</label><input style={iS} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label style={lS}>Email</label><input style={iS} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><label style={lS}>Address</label><input style={iS} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><label style={lS}>Notes</label><textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={save} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: form.company.trim() ? 1 : 0.4 }}>{editId ? "Save" : "Add Contact"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
