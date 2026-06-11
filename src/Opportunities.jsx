import { useState } from "react";
import { Plus, X, Edit2, ArrowRight, Calculator, FileText } from "lucide-react";
import { TakeoffBuilder, ProposalBuilder } from "./ProposalBuilder.jsx";
import SiteWalkCanvas from "./SiteWalkCanvas.jsx";

const STAGES = [
  { id: "lead", name: "Lead", color: "#69BE28", icon: "📥" },
  { id: "site-walk", name: "Site Walk", color: "#8b5cf6", icon: "🚶" },
  { id: "design", name: "Design", color: "#3b82f6", icon: "📐" },
  { id: "bid", name: "Bid Submitted", color: "#0ea5e9", icon: "💰" },
];
const PROJECT_TYPES = ["Access Control", "Video Surveillance", "Intrusion Detection", "Structured Cabling", "Network Infrastructure"];

const CLOSED_STAGES = {
  "won":    { name: "Won",    color: "#10b981", icon: "🏆" },
  "lost":   { name: "Lost",   color: "#ef4444", icon: "❌" },
  "no-bid": { name: "No Bid", color: "#64748b", icon: "🚫" },
};
const LOST_REASONS = ["Price too high", "Lost to competitor", "Went with incumbent", "Project cancelled / postponed", "Timing / schedule conflict", "No response / went dark", "Other"];
const NOBID_REASONS = ["Too busy / no capacity", "Outside our wheelhouse", "Bad fit / too much risk", "Couldn't meet schedule", "Customer / payment concerns", "Other"];
const money = v => parseFloat(String(v || "").replace(/[^0-9.]/g, "")) || 0;
const fmtMoney = v => "$" + Math.round(v).toLocaleString();
function dueBadge(opp) {
  if (!opp.bidDueDate) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(opp.bidDueDate + "T00:00:00");
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "#ef4444" };
  if (days === 0) return { text: "Due today", color: "#ef4444" };
  if (days <= 3) return { text: `Due in ${days}d`, color: "#f59e0b" };
  return { text: `Due ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, color: "#64748b" };
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export default function Opportunities({ opportunities, onSave, onConvert, catalog, assemblies, estDefaults, onSaveCatalogItem }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const EMPTY_FORM = { name: "", customer: "", contactName: "", contactPhone: "", contactEmail: "", siteAddress: "", projectTypes: [], type: "retrofit", stage: "lead", bidAmount: "", bidDueDate: "", scopeNotes: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewTab, setViewTab] = useState("pipeline");
  const [outcomeModal, setOutcomeModal] = useState(null); // { opp, type: "lost"|"no-bid" }
  const [convertJobNum, setConvertJobNum] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [confirmConvert, setConfirmConvert] = useState(null);
  const [expandedOpp, setExpandedOpp] = useState(null);
  const [oppTab, setOppTab] = useState("details");
  const [activeSiteWalk, setActiveSiteWalk] = useState(null); // { oppId, walkId }

  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
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

  const openOpps = opportunities.filter(o => !CLOSED_STAGES[o.stage]);
  const closedOpps = opportunities.filter(o => CLOSED_STAGES[o.stage]).sort((a, b) => (b.closedAt || "").localeCompare(a.closedAt || ""));
  const filtered = filterStage === "all" ? openOpps : openOpps.filter(o => o.stage === filterStage);

  function closeOut(opp, type, details) {
    onSave(opportunities.map(o => o.id === opp.id ? { ...o, stage: type, closedAt: new Date().toISOString(), outcome: details, updatedAt: new Date().toISOString() } : o));
    setOutcomeModal(null);
  }
  const tabBar = (
    <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid #1A3050" }}>
      {[{ id: "pipeline", label: `Pipeline (${openOpps.length})` }, { id: "bidlog", label: `Bid Log & Stats (${closedOpps.length})` }].map(t => (
        <button key={t.id} onClick={() => setViewTab(t.id)} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: viewTab === t.id ? "2px solid #69BE28" : "2px solid transparent", color: viewTab === t.id ? "#69BE28" : "#64748b", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>
      ))}
    </div>
  );

  if (viewTab === "bidlog") return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {tabBar}
      <BidLogView closed={closedOpps}
        onReopen={opp => onSave(opportunities.map(o => o.id === opp.id ? { ...o, stage: "bid", closedAt: null, outcome: null, updatedAt: new Date().toISOString() } : o))}
        onDelete={opp => { if (confirm(`Permanently delete the bid record for "${opp.name}"?`)) onSave(opportunities.filter(o => o.id !== opp.id)); }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      {tabBar}
      {outcomeModal && <OutcomeModal modal={outcomeModal} onClose={() => setOutcomeModal(null)} onSave={closeOut} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Track leads, site walks, designs, and bids. Convert to projects when awarded.</p>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: "", customer: "", contactName: "", contactPhone: "", contactEmail: "", siteAddress: "", projectTypes: [], type: "retrofit", stage: "lead", bidAmount: "", scopeNotes: "" }); }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /> New Opportunity</button>
      </div>

      {/* Stage summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {STAGES.map(s => { const c = openOpps.filter(o => o.stage === s.id).length; return (
          <button key={s.id} onClick={() => setFilterStage(filterStage === s.id ? "all" : s.id)}
            style={{ padding: "14px 16px", borderRadius: 10, border: filterStage === s.id ? `2px solid ${s.color}` : "1px solid #1A3050", background: "#0F2444", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
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
          <div key={opp.id} style={{ background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", marginBottom: 10, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{stage?.icon}</span>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { setExpandedOpp(isExpanded ? null : opp.id); setOppTab("details"); }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{opp.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{opp.customer}{opp.bidAmount ? ` · ${opp.bidAmount}` : ""}</div>
                </div>
                {(() => { const b = dueBadge(opp); return b ? <span style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 20, background: b.color + "22", color: b.color, fontWeight: 700 }}>⏰ {b.text}</span> : null; })()}
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: (stage?.color || "#6b7280") + "22", color: stage?.color, fontWeight: 600 }}>{stage?.name}</span>
                {stageIdx < STAGES.length - 1 && (
                  <button onClick={() => advanceStage(opp)} title={`Move to ${STAGES[stageIdx + 1]?.name}`}
                    style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><ArrowRight size={12} /> {STAGES[stageIdx + 1]?.name}</button>
                )}
                {opp.stage === "bid" && (
                  confirmConvert === opp.id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <input value={convertJobNum} onChange={e => setConvertJobNum(e.target.value)} placeholder="Job # (260300)" style={{ width: 110, padding: "5px 8px", borderRadius: 8, border: "1px solid #10b981", background: "#0A192F", color: "#fff", fontSize: 11, fontFamily: "inherit", outline: "none" }} />
                      <button onClick={() => {
                        onConvert({ ...opp, jobNumber: convertJobNum.trim() });
                        onSave(opportunities.map(o => o.id === opp.id ? { ...o, stage: "won", closedAt: new Date().toISOString(), wonAmount: money(o.bidAmount), updatedAt: new Date().toISOString() } : o));
                        setConfirmConvert(null); setConvertJobNum("");
                      }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Confirm</button>
                      <button onClick={() => setConfirmConvert(null)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmConvert(opp.id)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🏆 Award</button>
                  )
                )}
                {opp.stage === "bid" && confirmConvert !== opp.id && (
                  <button onClick={() => setOutcomeModal({ opp, type: "lost" })} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #7f1d1d", background: "transparent", color: "#f87171", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Lost</button>
                )}
                {confirmConvert !== opp.id && (
                  <button title="No Bid" onClick={() => setOutcomeModal({ opp, type: "no-bid" })} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>🚫</button>
                )}
                <button onClick={() => { setForm({ ...EMPTY_FORM, ...opp }); setEditId(opp.id); setShowForm(true); }} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><Edit2 size={13} /></button>
                <button onClick={() => onSave(opportunities.filter(o => o.id !== opp.id))} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
              </div>
              {opp.scopeNotes && !isExpanded && <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8", paddingLeft: 28 }}>{opp.scopeNotes}</div>}
              {opp.projectTypes?.length > 0 && !isExpanded && <div style={{ display: "flex", gap: 4, marginTop: 6, paddingLeft: 28 }}>{opp.projectTypes.map(t => <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#0A192F", color: "#94a3b8" }}>{t}</span>)}</div>}
            </div>

            {/* Expanded View with Tabs */}
            {isExpanded && (
              <div style={{ borderTop: "1px solid #1A3050" }}>
                <div style={{ display: "flex", gap: 2, padding: "0 20px", background: "#0A192F" }}>
                  {[{ id: "details", label: "Details", icon: "📋" }, { id: "sitewalks", label: "Site Walks", icon: "📝" }, { id: "takeoff", label: "Scope BOMs", icon: "📊" }, { id: "proposal", label: "Proposal", icon: "📄" }].map(tab => (
                    <button key={tab.id} onClick={() => setOppTab(tab.id)} style={{ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", color: oppTab === tab.id ? "#fff" : "#64748b", borderBottom: oppTab === tab.id ? "2px solid #69BE28" : "2px solid transparent", fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>{tab.icon} {tab.label}</button>
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
                      {opp.projectTypes?.length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 10 }}>{opp.projectTypes.map(t => <span key={t} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#69BE2822", color: "#82CC4A" }}>{t}</span>)}</div>}
                    </div>
                  )}
                  {oppTab === "sitewalks" && (() => {
                    const siteWalks = opp.siteWalks || [];
                    function saveWalks(next) {
                      onSave(opportunities.map(o => o.id === opp.id ? { ...o, siteWalks: next, updatedAt: new Date().toISOString() } : o));
                    }
                    function addWalk() {
                      const id = genId();
                      const newWalk = { id, title: `Site Walk ${siteWalks.length + 1}`, date: new Date().toISOString().split("T")[0], canvas: { width: 1400, height: 2000, strokes: [], images: [], textBoxes: [] }, createdAt: new Date().toISOString() };
                      saveWalks([...siteWalks, newWalk]);
                      setActiveSiteWalk({ oppId: opp.id, walkId: id });
                    }
                    function renameWalk(walkId, title) {
                      saveWalks(siteWalks.map(w => w.id === walkId ? { ...w, title } : w));
                    }
                    function deleteWalk(walkId) {
                      if (!confirm("Delete this site walk and all its notes/drawings?")) return;
                      saveWalks(siteWalks.filter(w => w.id !== walkId));
                    }
                    return (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Freehand notes + photos for each site visit. Uses stylus/pen input, auto-saves as you draw.</p>
                          <button onClick={addWalk} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            <Plus size={14} /> New Site Walk
                          </button>
                        </div>
                        {siteWalks.length === 0 && (
                          <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>
                            No site walks yet. Click <strong style={{ color: "#82CC4A" }}>New Site Walk</strong> to start a blank page for notes, drawings, and photos.
                          </div>
                        )}
                        {siteWalks.map(walk => {
                          const strokeCount = walk.canvas?.strokes?.length || 0;
                          const imageCount = walk.canvas?.images?.length || 0;
                          const textCount = walk.canvas?.textBoxes?.length || 0;
                          return (
                            <div key={walk.id} style={{ background: "#0A192F", borderRadius: 10, border: "1px solid #1A3050", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 38, height: 38, borderRadius: 8, background: "#8b5cf622", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: 18 }}>📝</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <input
                                  value={walk.title}
                                  onChange={e => renameWalk(walk.id, e.target.value)}
                                  style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", fontFamily: "inherit" }}
                                />
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                  {walk.date} · {strokeCount} stroke{strokeCount !== 1 ? "s" : ""} · {imageCount} image{imageCount !== 1 ? "s" : ""} · {textCount} note{textCount !== 1 ? "s" : ""}
                                </div>
                              </div>
                              <button onClick={() => setActiveSiteWalk({ oppId: opp.id, walkId: walk.id })} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #69BE28", background: "#69BE2822", color: "#82CC4A", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                Open
                              </button>
                              <button onClick={() => deleteWalk(walk.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }} title="Delete"><X size={14} /></button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {oppTab === "takeoff" && (() => {
                    const scopes = opp.proposal?.scopes || [];
                    if (scopes.length === 0) return (
                      <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                        <div style={{ fontSize: 14, marginBottom: 8 }}>No scopes defined yet.</div>
                        <div style={{ fontSize: 12 }}>Add scopes in the <strong style={{ color: "#82CC4A" }}>Proposal</strong> tab first, then build a BOM for each scope here.</div>
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
                              }} style={{ padding: "8px 14px", borderRadius: 8, border: (opp._expandedScopeBOM || {})[si] ? "2px solid #69BE28" : "1px solid #1A3050", background: (opp._expandedScopeBOM || {})[si] ? "#69BE2822" : "#0A192F", color: (opp._expandedScopeBOM || {})[si] ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
                              <TakeoffBuilder catalog={catalog} assemblies={assemblies} estDefaults={estDefaults} onSaveCatalogItem={onSaveCatalogItem} takeoff={sc.takeoff} scopeTitle={`${opp.name || "Opportunity"} — ${sc.title || `Scope ${si + 1}`}`} onSave={tk => {
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
                    <ProposalBuilder catalog={catalog} assemblies={assemblies} estDefaults={estDefaults} onSaveCatalogItem={onSaveCatalogItem} opportunity={opp} proposal={opp.proposal} onSave={pr => onSave(opportunities.map(o => o.id === opp.id ? { ...o, proposal: pr, updatedAt: new Date().toISOString() } : o))} />
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
          <div style={{ background: "#0F2444", borderRadius: 16, border: "1px solid #1A3050", padding: 24, width: 520, maxHeight: "85vh", overflowY: "auto" }}>
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
              <div><label style={lS}>Bid Due Date</label><input type="date" style={iS} value={form.bidDueDate || ""} onChange={e => setForm({ ...form, bidDueDate: e.target.value })} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lS}>Phone</label><input style={iS} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
                <div><label style={lS}>Email</label><input style={iS} value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
              </div>
              <div><label style={lS}>Site Address</label><input style={iS} value={form.siteAddress} onChange={e => setForm({ ...form, siteAddress: e.target.value })} /></div>
              <div><label style={lS}>Scope Notes</label><input style={iS} value={form.scopeNotes} onChange={e => setForm({ ...form, scopeNotes: e.target.value })} placeholder="Brief description..." /></div>
              <div><label style={lS}>Systems</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{PROJECT_TYPES.map(pt => (<button key={pt} onClick={() => { const t = form.projectTypes || []; setForm({ ...form, projectTypes: t.includes(pt) ? t.filter(x => x !== pt) : [...t, pt] }); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #1A3050", fontSize: 12, cursor: "pointer", fontFamily: "inherit", background: (form.projectTypes || []).includes(pt) ? "#69BE28" : "transparent", color: (form.projectTypes || []).includes(pt) ? "#fff" : "#94a3b8" }}>{pt}</button>))}</div></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={addOpp} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: form.name.trim() && form.customer.trim() ? 1 : 0.4 }}>{editId ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Site Walk fullscreen canvas overlay */}
      {activeSiteWalk && (() => {
        const opp = opportunities.find(o => o.id === activeSiteWalk.oppId);
        if (!opp) { setActiveSiteWalk(null); return null; }
        const walk = (opp.siteWalks || []).find(w => w.id === activeSiteWalk.walkId);
        if (!walk) { setActiveSiteWalk(null); return null; }
        return (
          <SiteWalkCanvas
            walkId={walk.id}
            walkTitle={`${opp.name} — ${walk.title}`}
            canvas={walk.canvas}
            uploadPathPrefix={`opportunities/${opp.id}/sitewalks`}
            onSave={canvas => {
              onSave(opportunities.map(o => o.id === opp.id ? { ...o, siteWalks: (o.siteWalks || []).map(w => w.id === walk.id ? { ...w, canvas } : w), updatedAt: new Date().toISOString() } : o));
            }}
            onClose={() => setActiveSiteWalk(null)}
          />
        );
      })()}
    </div>
  );
}


/* ════════ OUTCOME MODAL ════════ */
function OutcomeModal({ modal, onClose, onSave }) {
  const { opp, type } = modal;
  const reasons = type === "lost" ? LOST_REASONS : NOBID_REASONS;
  const [reason, setReason] = useState(reasons[0]);
  const [competitor, setCompetitor] = useState("");
  const [winningPrice, setWinningPrice] = useState("");
  const [notes, setNotes] = useState("");
  const iS2 = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const lS2 = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase" };
  const cs = CLOSED_STAGES[type];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0F2444", borderRadius: 14, border: "1px solid #1A3050", padding: 22, width: "100%", maxWidth: 480 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: cs.color, fontFamily: "'Outfit',sans-serif", marginBottom: 4 }}>{cs.icon} Mark as {cs.name}</div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>{opp.name} · {opp.customer}{opp.bidAmount ? ` · ${opp.bidAmount}` : ""}</div>
        <div style={{ marginBottom: 12 }}>
          <label style={lS2}>Reason</label>
          <select style={iS2} value={reason} onChange={e => setReason(e.target.value)}>{reasons.map(r => <option key={r} value={r}>{r}</option>)}</select>
        </div>
        {type === "lost" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={lS2}>Who won? (if known)</label><input style={iS2} value={competitor} onChange={e => setCompetitor(e.target.value)} placeholder="Competitor name" /></div>
            <div><label style={lS2}>Winning price (if known)</label><input style={iS2} value={winningPrice} onChange={e => setWinningPrice(e.target.value)} placeholder="$" /></div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={lS2}>Notes — future-you will thank you</label>
          <textarea style={{ ...iS2, minHeight: 64, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder={type === "lost" ? "GC said we were 12% high; they value price over local service…" : "Why we passed…"} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => onSave(opp, type, { reason, competitor, winningPrice, notes })} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: cs.color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save outcome</button>
        </div>
      </div>
    </div>
  );
}

/* ════════ BID LOG & STATS ════════ */
function BidLogView({ closed, onReopen, onDelete }) {
  const won = closed.filter(o => o.stage === "won");
  const lost = closed.filter(o => o.stage === "lost");
  const nobid = closed.filter(o => o.stage === "no-bid");
  const decided = won.length + lost.length;
  const hitRate = decided > 0 ? Math.round((won.length / decided) * 100) : null;
  const wonDollars = won.reduce((s, o) => s + (o.wonAmount || money(o.bidAmount)), 0);
  const lostDollars = lost.reduce((s, o) => s + money(o.bidAmount), 0);
  const dollarRate = (wonDollars + lostDollars) > 0 ? Math.round((wonDollars / (wonDollars + lostDollars)) * 100) : null;

  // hit rate by system type
  const byType = {};
  [...won, ...lost].forEach(o => (o.projectTypes || []).forEach(t => {
    byType[t] = byType[t] || { won: 0, lost: 0 };
    byType[t][o.stage === "won" ? "won" : "lost"]++;
  }));

  // top loss reasons
  const lossReasons = {};
  lost.forEach(o => { const r = o.outcome?.reason || "Unrecorded"; lossReasons[r] = (lossReasons[r] || 0) + 1; });
  const topLoss = Object.entries(lossReasons).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const SC2 = ({ label, value, sub, color }) => (
    <div style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'Outfit',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        <SC2 label="Hit Rate (count)" value={hitRate === null ? "—" : hitRate + "%"} sub={`${won.length}W / ${lost.length}L${nobid.length ? ` · ${nobid.length} no-bid` : ""}`} color={hitRate === null ? "#64748b" : hitRate >= 40 ? "#10b981" : hitRate >= 25 ? "#f59e0b" : "#ef4444"} />
        <SC2 label="Hit Rate ($)" value={dollarRate === null ? "—" : dollarRate + "%"} sub={`${fmtMoney(wonDollars)} won`} color="#3b82f6" />
        <SC2 label="$ Won" value={fmtMoney(wonDollars)} sub={won.length + " jobs"} color="#10b981" />
        <SC2 label="$ Lost" value={fmtMoney(lostDollars)} sub={lost.length + " bids"} color="#ef4444" />
      </div>

      {(Object.keys(byType).length > 0 || topLoss.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {Object.keys(byType).length > 0 && (
            <div style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>Hit rate by system</div>
              {Object.entries(byType).map(([t, v]) => {
                const r = Math.round((v.won / (v.won + v.lost)) * 100);
                return (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{t}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1A3050", overflow: "hidden" }}><div style={{ width: r + "%", height: "100%", background: r >= 40 ? "#10b981" : r >= 25 ? "#f59e0b" : "#ef4444" }} /></div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", width: 70, textAlign: "right" }}>{r}% ({v.won}/{v.won + v.lost})</span>
                  </div>
                );
              })}
            </div>
          )}
          {topLoss.length > 0 && (
            <div style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 10 }}>Why we lose</div>
              {topLoss.map(([r, c]) => (
                <div key={r} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 7 }}>
                  <span style={{ color: "#94a3b8" }}>{r}</span><span style={{ color: "#ef4444", fontWeight: 700 }}>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {closed.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: 13, background: "#0F2444", borderRadius: 12, border: "1px dashed #1A3050" }}>
          <div style={{ fontSize: 26, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>No closed bids yet</div>
          <div>Award, Lost, and No-Bid outcomes land here — and your hit rate builds itself.</div>
        </div>
      )}

      {closed.map(o => {
        const cs = CLOSED_STAGES[o.stage];
        return (
          <div key={o.id} style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 10, padding: "12px 16px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16 }}>{cs.icon}</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>{o.name}</div>
              <div style={{ fontSize: 11.5, color: "#64748b" }}>{o.customer}{o.closedAt ? ` · ${new Date(o.closedAt).toLocaleDateString()}` : ""}{o.outcome?.reason ? ` · ${o.outcome.reason}` : ""}{o.outcome?.competitor ? ` → ${o.outcome.competitor}` : ""}</div>
              {o.outcome?.notes && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3, fontStyle: "italic" }}>"{o.outcome.notes}"</div>}
            </div>
            {money(o.bidAmount) > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: cs.color }}>{fmtMoney(money(o.bidAmount))}</span>}
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: cs.color + "22", color: cs.color, fontWeight: 700 }}>{cs.name}</span>
            {o.stage !== "won" && <button onClick={() => onReopen(o)} style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Reopen</button>}
            <button onClick={() => onDelete(o)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}
