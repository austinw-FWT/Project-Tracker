import { useState, useEffect } from "react";
import { Plus, X, Edit2, Search, Building2, Phone, Mail, MapPin, User } from "lucide-react";

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function Contacts({ contacts, projects, onSave }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ company: "", contactName: "", phone: "", email: "", address: "", notes: "", type: "customer" });
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
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
    <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "16px 14px" : 24 }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", marginBottom: 16, gap: 10 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: isMobile ? "100%" : 320 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 8, border: "1px solid #1A3050", background: "#1A3050", color: "#e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ company: "", contactName: "", phone: "", email: "", address: "", notes: "", type: "customer" }); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", minHeight: 44, flexShrink: 0 }}><Plus size={16} /> Add Contact</button>
      </div>

      {/* Summary — 2 cols on phone, 5 cols on desktop */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
        {[["Customers", "customer"], ["GCs", "gc"], ["Vendors", "vendor"], ["Subs", "subcontractor"], ["Other", "other"]].map(([label, type]) => {
          const c = (contacts || []).filter(ct => ct.type === type).length;
          return (<div key={type} style={{ background: "#0F2444", borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${typeColors[type]}`, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: typeColors[type], fontFamily: "'Outfit',sans-serif" }}>{c}</div>
          </div>);
        })}
      </div>

      {/* Contact List */}
      {filtered.map(contact => (
        <div key={contact.id} style={{ background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", padding: isMobile ? "14px 14px" : "16px 20px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: (typeColors[contact.type] || "#6b7280") + "22", display: "flex", alignItems: "center", justifyContent: "center", color: typeColors[contact.type], flexShrink: 0 }}><Building2 size={18} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", wordBreak: "break-word" }}>{contact.company}</div>
                <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: (typeColors[contact.type] || "#6b7280") + "22", color: typeColors[contact.type], fontWeight: 700, textTransform: "capitalize" }}>{contact.type}</span>
                {projectCount(contact) > 0 && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "#0A192F", color: "#94a3b8", fontWeight: 600 }}>{projectCount(contact)} projects</span>}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#94a3b8", flexWrap: "wrap" }}>
                {contact.contactName && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={12} /> {contact.contactName}</span>}
                {contact.phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {contact.phone}</span>}
                {contact.email && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={12} /> {contact.email}</span>}
              </div>
              {contact.address && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {contact.address}</div>}
              {contact.notes && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{contact.notes}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              <button onClick={() => { setForm(contact); setEditId(contact.id); setShowForm(true); }} style={{ width: 32, height: 32, borderRadius: 6, background: "transparent", border: "1px solid #1A3050", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit2 size={14} /></button>
              <button onClick={() => onSave((contacts || []).filter(c => c.id !== contact.id))} style={{ width: 32, height: 32, borderRadius: 6, background: "transparent", border: "1px solid #1A3050", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 14 }}>No contacts yet.</div>}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{
            background: "#0F2444",
            borderRadius: isMobile ? "16px 16px 0 0" : 16,
            border: "1px solid #1A3050",
            padding: 20,
            width: isMobile ? "100%" : 480,
            maxWidth: "100%",
            maxHeight: isMobile ? "92vh" : "85vh",
            overflowY: "auto",
            paddingBottom: isMobile ? "max(20px, env(safe-area-inset-bottom))" : 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: 0 }}>{editId ? "Edit" : "New"} Contact</h2><button onClick={() => setShowForm(false)} style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: "#0A192F", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button></div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 12 }}>
                <div><label style={lS}>Company *</label><input style={iS} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
                <div><label style={lS}>Type</label><select style={iS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="customer">Customer</option><option value="gc">General Contractor</option><option value="vendor">Vendor</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></select></div>
              </div>
              <div><label style={lS}>Contact Name</label><input style={iS} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div><label style={lS}>Phone</label><input style={iS} type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label style={lS}>Email</label><input style={iS} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><label style={lS}>Address</label><input style={iS} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><label style={lS}>Notes</label><textarea style={{ ...iS, minHeight: 70, resize: "vertical" }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: isMobile ? 1 : "0 0 auto", padding: "12px 20px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#cbd5e1", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Cancel</button>
              <button onClick={save} style={{ flex: isMobile ? 2 : "0 0 auto", padding: "12px 24px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: form.company.trim() ? 1 : 0.4 }}>{editId ? "Save" : "Add Contact"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
