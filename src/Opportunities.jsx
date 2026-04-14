import { useState } from "react";
import { Plus, X, Edit2, ArrowRight, Calculator, FileText } from "lucide-react";
import { TakeoffBuilder, ProposalBuilder } from "./ProposalBuilder.jsx";

const STAGES = [
  { id: "lead", name: "Lead", color: "#6366f1", icon: "📥" },
  { id: "site-walk", name: "Site Walk", color: "#8b5cf6", icon: "🚶" },
  { id: "design", name: "Design", color: "#3b82f6", icon: "📐" },
  { id: "bid", name: "Bid Submitted", color: "#0ea5e9", icon: "💰" },
];
const PROJECT_TYPES = ["Access Control", "Video Surveillance", "Intrusion Detection", "Structured Cabling", "Network Infrastructure"];

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export default function Opportunities({ opportunities, onSave, onConvert }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", customer: "", contactName: "", contactPhone: "", contactEmail: "", siteAddress: "", projectTypes: [], type: "retrofit", stage: "lead", bidAmount: "", scopeNotes: "" });
  const [filterStage, setFilterStage] = useState("all");
  const [confirmConvert, setConfirmConvert] = useState(null);
  const [expandedOpp, setExpandedOpp] = useState(null);
  const [oppTab, setOppTab] = useState("details");

  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  function addOpp() {
    if (!form.name.trim() || !form.customer.trim()) return;
    if (editId) {
      onSave(opportunities.map(o => o.id === editId ? { ...o, ...form, updatedAt: new Date().toISOString() } : o));
      setEditId(null);
    } else {
      onSave([...opportunities, { ...form, id: genId(), notes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    }
    setForm({ name: "", customer: "", contactName: "", contactPhone: "", contactEmail: "", siteAddress: "", projectTypes: [], type: "retrofit", stage: "lead", bidAmount: "", scopeNotes: "" });
    setShowForm(false);
  }

  function advanceStage(opp) {
    const idx = STAGES.findIndex(s => s.id === opp.stage);
    if (idx < STAGES.length - 1) {
      onSave(opportunities.map(o => o.id === opp.id ? { ...o, stage: STAGES[idx + 1].id, updatedAt: new Date().toISOString() } : o));
    }
  }

  const filtered = filterStage === "all" ? opportunities : opportunities.filter(o => o.stage === filterStage);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Track leads, site walks, designs, and bids. Convert to projects when awarded.</p>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", customer: "", contactName: "", contactPhone: "", contactEmail: "", siteAddress: "", projectTypes: [], type: "retrofit", stage: "lead", bidAmount: "", scopeNotes: "" }); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /> New Opportunity</button>
      </div>

      {/* Stage summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {STAGES.map(s => { const c = opportunities.filter(o => o.stage === s.id).length; return (
          <button key={s.id} onClick={() => setFilterStage(filterStage === s.id ? "all" : s.id)}
            style={{ padding: "14px 16px", borderRadius: 10, border: filterStage === s.id ? `2px solid ${s.color}` : "1px solid #1e293b", background: "#1a2332", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>{s.name}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'Outfit',sans-serif" }}>{c}</div>
          </button>
        ); })}
      </div>

      {/* Opportunity List */}
      {filtered.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).map(opp => {
        const stage = STAGES.find(s => s.id === opp.stage);
        const stageIdx = STAGES.findIndex(s => s.id === opp.stage);
        const isExpanded = expandedOpp === opp.id;
        return (
          <div key={opp.id} style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", marginBottom: 10, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{stage?.icon}</span>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { setExpandedOpp(isExpanded ? null : opp.id); setOppTab("details"); }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{opp.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{opp.customer}{opp.bidAmount ? ` · ${opp.bidAmount}` : ""}</div>
                </div>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: (stage?.color || "#6b7280") + "22", color: stage?.color, fontWeight: 600 }}>{stage?.name}</span>
                {stageIdx < STAGES.length - 1 && (
                  <button onClick={() => advanceStage(opp)} title={`Move to ${STAGES[stageIdx + 1]?.name}`}
                    style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><ArrowRight size={12} /> {STAGES[stageIdx + 1]?.name}</button>
                )}
                {opp.stage === "bid" && (
                  confirmConvert === opp.id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => { onConvert(opp); setConfirmConvert(null); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Confirm Award</button>
                      <button onClick={() => setConfirmConvert(null)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmConvert(opp.id)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🏆 Award</button>
                  )
                )}
                <button onClick={() => { setForm(opp); setEditId(opp.id); setShowForm(true); }} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><Edit2 size={13} /></button>
                <button onClick={() => onSave(opportunities.filter(o => o.id !== opp.id))} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
              </div>
              {opp.scopeNotes && !isExpanded && <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8", paddingLeft: 28 }}>{opp.scopeNotes}</div>}
              {opp.projectTypes?.length > 0 && !isExpanded && <div style={{ display: "flex", gap: 4, marginTop: 6, paddingLeft: 28 }}>{opp.projectTypes.map(t => <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#0f1729", color: "#94a3b8" }}>{t}</span>)}</div>}
            </div>

            {/* Expanded View with Tabs */}
            {isExpanded && (
              <div style={{ borderTop: "1px solid #1e293b" }}>
                <div style={{ display: "flex", gap: 2, padding: "0 20px", background: "#0f1729" }}>
                  {[{ id: "details", label: "Details", icon: "📋" }, { id: "takeoff", label: "Scope BOMs", icon: "📊" }, { id: "proposal", label: "Proposal", icon: "📄" }].map(tab => (
                    <button key={tab.id} onClick={() => setOppTab(tab.id)} style={{ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", color: oppTab === tab.id ? "#fff" : "#64748b", borderBottom: oppTab === tab.id ? "2px solid #6366f1" : "2px solid transparent", fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>{tab.icon} {tab.label}</button>
                  ))}
                </div>
                <div style={{ padding: 20 }}>
                  {oppTab === "details" && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                        <div><span style={{ color: "#64748b" }}>Customer:</span> <span style={{ color: "#e2e8f0" }}>{opp.customer || "—"}</span></div>
                        <div><span style={{ color: "#64748b" }}>Contact:</span> <span style={{ color: "#e2e8f0" }}>{opp.contactName || "—"}</span></div>
                        <div><span style={{ color: "#64748b" }}>Phone:</span> <span style={{ color: "#e2e8f0" }}>{opp.contactPhone || "—"}</span></div>
                        <div><span style={{ color: "#64748b" }}>Email:</span> <span style={{ color: "#e2e8f0" }}>{opp.contactEmail || "—"}</span></div>
                        <div><span style={{ color: "#64748b" }}>Address:</span> <span style={{ color: "#e2e8f0" }}>{opp.siteAddress || "—"}</span></div>
                        <div><span style={{ color: "#64748b" }}>Bid Amount:</span> <span style={{ color: "#e2e8f0" }}>{opp.bidAmount ? `${opp.bidAmount}` : "—"}</span></div>
                      </div>
                      {opp.scopeNotes && <div style={{ marginTop: 12, fontSize: 13, color: "#94a3b8" }}><span style={{ color: "#64748b" }}>Scope: </span>{opp.scopeNotes}</div>}
                      {opp.projectTypes?.length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 10 }}>{opp.projectTypes.map(t => <span key={t} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#6366f122", color: "#818cf8" }}>{t}</span>)}</div>}
                    </div>
                  )}
                  {oppTab === "takeoff" && (() => {
                    const scopes = opp.proposal?.scopes || [];
                    if (scopes.length === 0) return (
                      <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                        <div style={{ fontSize: 14, marginBottom: 8 }}>No scopes defined yet.</div>
                        <div style={{ fontSize: 12 }}>Add scopes in the <strong style={{ color: "#818cf8" }}>Proposal</strong> tab first, then build a BOM for each scope here.</div>
                      </div>
                    );
                    return (
                      <div>
                        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
                          {scopes.map((sc, si) => {
                            const tk = sc.takeoff;
                            const scopeTotal = tk ? (() => {
                              const mt = (tk.materials || []).reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.pricePU) || 0) + (parseFloat(r.laborHrs) || 0) * (parseFloat(r.laborRate) || 0), 0);
                              const lt = (tk.labor || []).reduce((s, r) => s + (parseFloat(r.hours) || 0) * (parseFloat(r.ratePerHr) || 0), 0);
                              const ct = (tk.costs || []).reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.pricePU) || 0), 0);
                              const rt = (tk.rmr || []).reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.pricePU) || 0), 0);
                              const sub = mt + lt + ct + rt;
                              return sub + sub * ((parseFloat(tk.overheadPct) || 0) / 100);
                            })() : 0;
                            return (
                              <button key={sc.id} onClick={() => {
                                const expanded = { ...(opp._expandedScopeBOM || {}), [si]: !(opp._expandedScopeBOM || {})[si] };
                                onSave(opportunities.map(o => o.id === opp.id ? { ...o, _expandedScopeBOM: expanded } : o));
                              }} style={{ padding: "8px 14px", borderRadius: 8, border: (opp._expandedScopeBOM || {})[si] ? "2px solid #6366f1" : "1px solid #1e293b", background: (opp._expandedScopeBOM || {})[si] ? "#6366f122" : "#0f1729", color: (opp._expandedScopeBOM || {})[si] ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                {sc.title || `Scope ${si + 1}`}
                                {scopeTotal > 0 && <span style={{ marginLeft: 8, color: "#10b981", fontSize: 11 }}>${scopeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                              </button>
                            );
                          })}
                        </div>
                        {scopes.map((sc, si) => (
                          (opp._expandedScopeBOM || {})[si] && (
                            <div key={sc.id} style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 15 }}>📊</span> BOM — {sc.title || `Scope ${si + 1}`}
                              </div>
                              <TakeoffBuilder takeoff={sc.takeoff} onSave={tk => {
                                const updatedScopes = [...(opp.proposal?.scopes || [])];
                                updatedScopes[si] = { ...updatedScopes[si], takeoff: tk };
                                onSave(opportunities.map(o => o.id === opp.id ? { ...o, proposal: { ...(o.proposal || {}), scopes: updatedScopes }, updatedAt: new Date().toISOString() } : o));
                              }} />
                            </div>
                          )
                        ))}
                      </div>
                    );
                  })()}
                  {oppTab === "proposal" && (
                    <ProposalBuilder opportunity={opp} proposal={opp.proposal} onSave={pr => onSave(opportunities.map(o => o.id === opp.id ? { ...o, proposal: pr, updatedAt: new Date().toISOString() } : o))} />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>No opportunities {filterStage !== "all" ? "in this stage" : "yet"}.</div>}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#1a2332", borderRadius: 16, border: "1px solid #1e293b", padding: 24, width: 520, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}><h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: 0 }}>{editId ? "Edit" : "New"} Opportunity</h2><button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={18} /></button></div>
            <div style={{ display: "grid", gap: 14 }}>
              <div><label style={lS}>Name *</label><input style={iS} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Acme Corp Security Upgrade" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lS}>Customer *</label><input style={iS} value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} /></div>
                <div><label style={lS}>Stage</label><select style={iS} value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>{STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lS}>Contact</label><input style={iS} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
                <div><label style={lS}>Bid Amount</label><input style={iS} value={form.bidAmount} onChange={e => setForm({ ...form, bidAmount: e.target.value })} placeholder="$" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lS}>Phone</label><input style={iS} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
                <div><label style={lS}>Email</label><input style={iS} value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
              </div>
              <div><label style={lS}>Site Address</label><input style={iS} value={form.siteAddress} onChange={e => setForm({ ...form, siteAddress: e.target.value })} /></div>
              <div><label style={lS}>Scope Notes</label><input style={iS} value={form.scopeNotes} onChange={e => setForm({ ...form, scopeNotes: e.target.value })} placeholder="Brief description..." /></div>
              <div><label style={lS}>Systems</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{PROJECT_TYPES.map(pt => (<button key={pt} onClick={() => { const t = form.projectTypes || []; setForm({ ...form, projectTypes: t.includes(pt) ? t.filter(x => x !== pt) : [...t, pt] }); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #1e293b", fontSize: 12, cursor: "pointer", fontFamily: "inherit", background: (form.projectTypes || []).includes(pt) ? "#6366f1" : "transparent", color: (form.projectTypes || []).includes(pt) ? "#fff" : "#94a3b8" }}>{pt}</button>))}</div></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={addOpp} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: form.name.trim() && form.customer.trim() ? 1 : 0.4 }}>{editId ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
