import { useState } from "react";
import { Plus, X, ChevronRight, ArrowRight, Building2, Phone, Mail, MapPin, DollarSign, Edit2 } from "lucide-react";

const STAGES = [
  { id: "lead", name: "Lead", color: "#6366f1" },
  { id: "site-walk", name: "Site Walk", color: "#8b5cf6" },
  { id: "design", name: "Design", color: "#3b82f6" },
  { id: "bid", name: "Bid", color: "#0ea5e9" },
];

const PROJECT_TYPES = ["Access Control","Video Surveillance","Intrusion Detection","Structured Cabling","Network Infrastructure"];

function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

export default function SalesPipeline({ opportunities, onUpdate, onConvertToProject }) {
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState(null);
  const [stageFilter, setStageFilter] = useState("all");

  const opps = opportunities || [];
  const filtered = stageFilter === "all" ? opps : opps.filter(o => o.stage === stageFilter);

  const iS = { width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #1e293b", background:"#0f1729", color:"#e2e8f0", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none" };
  const lS = { fontSize:11, fontWeight:600, color:"#64748b", marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:"0.05em" };

  function addOpp(opp) {
    onUpdate([...opps, { ...opp, id: genId(), stage: "lead", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    setShowNew(false);
  }
  function updateOpp(id, updates) {
    onUpdate(opps.map(o => o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o));
  }
  function removeOpp(id) { onUpdate(opps.filter(o => o.id !== id)); setEditId(null); }
  function advanceStage(opp) {
    const idx = STAGES.findIndex(s => s.id === opp.stage);
    if (idx < STAGES.length - 1) updateOpp(opp.id, { stage: STAGES[idx + 1].id });
  }

  function handleConvert(opp) {
    if (window.confirm(`Convert "${opp.name}" to an active project? This will move it to the Project Board.`)) {
      onConvertToProject(opp);
      onUpdate(opps.filter(o => o.id !== opp.id));
    }
  }

  const stageCounts = {};
  STAGES.forEach(s => { stageCounts[s.id] = opps.filter(o => o.stage === s.id).length; });
  const totalBidValue = opps.reduce((s, o) => s + (parseFloat(o.bidAmount) || 0), 0);

  return (
    <div style={{ maxWidth:800, margin:"0 auto", padding:"24px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:"#fff", fontFamily:"'Outfit',sans-serif", margin:0 }}>Sales Pipeline</h2>
          <p style={{ fontSize:13, color:"#64748b", margin:"4px 0 0" }}>Track leads, site walks, designs, and bids. Convert to projects when awarded.</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, border:"none", background:"#6366f1", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}><Plus size={15}/> New Opportunity</button>
      </div>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:10, marginBottom:20 }}>
        {STAGES.map(s => (
          <div key={s.id} style={{ background:"#1a2332", borderRadius:10, padding:"12px 14px", borderTop:`3px solid ${s.color}`, cursor:"pointer" }} onClick={() => setStageFilter(stageFilter === s.id ? "all" : s.id)}>
            <div style={{ fontSize:20, fontWeight:700, color:s.color, fontFamily:"'Outfit',sans-serif" }}>{stageCounts[s.id]}</div>
            <div style={{ fontSize:11, color:"#64748b" }}>{s.name}</div>
          </div>
        ))}
        <div style={{ background:"#1a2332", borderRadius:10, padding:"12px 14px", borderTop:"3px solid #f59e0b" }}>
          <div style={{ fontSize:16, fontWeight:700, color:"#f59e0b", fontFamily:"'Outfit',sans-serif" }}>${totalBidValue.toLocaleString()}</div>
          <div style={{ fontSize:11, color:"#64748b" }}>Pipeline Value</div>
        </div>
      </div>

      {/* Stage filter */}
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        <button onClick={() => setStageFilter("all")} style={{ padding:"5px 14px", borderRadius:20, border:stageFilter==="all"?"2px solid #6366f1":"1px solid #1e293b", background:stageFilter==="all"?"#6366f122":"transparent", color:stageFilter==="all"?"#818cf8":"#64748b", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>All ({opps.length})</button>
        {STAGES.map(s => (
          <button key={s.id} onClick={() => setStageFilter(stageFilter === s.id ? "all" : s.id)} style={{ padding:"5px 14px", borderRadius:20, border:stageFilter===s.id?`2px solid ${s.color}`:"1px solid #1e293b", background:stageFilter===s.id?s.color+"22":"transparent", color:stageFilter===s.id?s.color:"#64748b", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{s.name}</button>
        ))}
      </div>

      {/* Opportunity List */}
      {filtered.map(opp => {
        const stage = STAGES.find(s => s.id === opp.stage);
        const isEditing = editId === opp.id;
        return (
          <div key={opp.id} style={{ background:"#1a2332", borderRadius:12, border:"1px solid #1e293b", padding:"16px 18px", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:(stage?.color||"#6366f1")+"22", color:stage?.color, fontWeight:600 }}>{stage?.name}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:"#fff" }}>{opp.name}</div>
                <div style={{ fontSize:12, color:"#64748b" }}>{opp.customer}{opp.bidAmount ? ` · $${parseFloat(opp.bidAmount).toLocaleString()}` : ""}</div>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                {opp.stage !== "bid" && <button onClick={() => advanceStage(opp)} title="Advance stage" style={{ padding:"5px 10px", borderRadius:6, border:"1px solid #1e293b", background:"transparent", color:"#94a3b8", fontSize:11, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:3 }}>Next <ChevronRight size={12}/></button>}
                {opp.stage === "bid" && <button onClick={() => handleConvert(opp)} style={{ padding:"5px 12px", borderRadius:6, border:"none", background:"#10b981", color:"#fff", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}><ArrowRight size={12}/> Awarded</button>}
                <button onClick={() => setEditId(isEditing ? null : opp.id)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer" }}><Edit2 size={13}/></button>
                <button onClick={() => removeOpp(opp.id)} style={{ background:"none", border:"none", color:"#334155", cursor:"pointer" }}><X size={13}/></button>
              </div>
            </div>

            {isEditing && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14, paddingTop:14, borderTop:"1px solid #1e293b" }}>
                <div><label style={lS}>Opportunity Name</label><input style={iS} value={opp.name} onChange={e => updateOpp(opp.id, { name: e.target.value })}/></div>
                <div><label style={lS}>Customer</label><input style={iS} value={opp.customer} onChange={e => updateOpp(opp.id, { customer: e.target.value })}/></div>
                <div><label style={lS}>Contact Name</label><input style={iS} value={opp.contactName||""} onChange={e => updateOpp(opp.id, { contactName: e.target.value })}/></div>
                <div><label style={lS}>Phone</label><input style={iS} value={opp.contactPhone||""} onChange={e => updateOpp(opp.id, { contactPhone: e.target.value })}/></div>
                <div><label style={lS}>Email</label><input style={iS} value={opp.contactEmail||""} onChange={e => updateOpp(opp.id, { contactEmail: e.target.value })}/></div>
                <div><label style={lS}>Site Address</label><input style={iS} value={opp.siteAddress||""} onChange={e => updateOpp(opp.id, { siteAddress: e.target.value })}/></div>
                <div><label style={lS}>Bid Amount</label><input style={iS} value={opp.bidAmount||""} onChange={e => updateOpp(opp.id, { bidAmount: e.target.value })} placeholder="$"/></div>
                <div><label style={lS}>Type</label><select style={iS} value={opp.type||"retrofit"} onChange={e => updateOpp(opp.id, { type: e.target.value })}><option value="retrofit">Retrofit</option><option value="new-construction">New Construction</option></select></div>
                <div><label style={lS}>Stage</label><select style={iS} value={opp.stage} onChange={e => updateOpp(opp.id, { stage: e.target.value })}>{STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label style={lS}>Systems</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {PROJECT_TYPES.map(pt => (<button key={pt} onClick={() => { const t = opp.systems||[]; updateOpp(opp.id, { systems: t.includes(pt)?t.filter(x=>x!==pt):[...t,pt] }); }} style={{ padding:"3px 8px", borderRadius:6, border:"1px solid #1e293b", fontSize:10, cursor:"pointer", fontFamily:"inherit", background:(opp.systems||[]).includes(pt)?"#6366f1":"transparent", color:(opp.systems||[]).includes(pt)?"#fff":"#94a3b8" }}>{pt}</button>))}
                  </div>
                </div>
                <div style={{ gridColumn:"1/-1" }}><label style={lS}>Notes</label><textarea style={{ ...iS, minHeight:60, resize:"vertical" }} value={opp.notes||""} onChange={e => updateOpp(opp.id, { notes: e.target.value })}/></div>
              </div>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && <div style={{ textAlign:"center", padding:40, color:"#334155", fontSize:13 }}>{opps.length === 0 ? "No opportunities yet. Add your first lead above." : "No opportunities match this filter."}</div>}

      {/* New Opportunity Modal */}
      {showNew && <NewOppModal onSave={addOpp} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewOppModal({ onSave, onClose }) {
  const [name, setName] = useState(""); const [customer, setCustomer] = useState("");
  const [contactName, setContactName] = useState(""); const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(""); const [address, setAddress] = useState("");
  const [type, setType] = useState("retrofit"); const [systems, setSystems] = useState([]);
  const [notes, setNotes] = useState("");
  const iS = { width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #1e293b", background:"#0f1729", color:"#e2e8f0", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none" };
  const lS = { fontSize:11, fontWeight:600, color:"#64748b", marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:"0.05em" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
      <div style={{ background:"#1a2332", borderRadius:16, border:"1px solid #1e293b", padding:24, width:520, maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:"#fff", fontFamily:"'Outfit',sans-serif", margin:0 }}>New Opportunity</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={18}/></button>
        </div>
        <div style={{ display:"grid", gap:12 }}>
          <div><label style={lS}>Opportunity Name *</label><input style={iS} value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Acme Corp Camera Upgrade"/></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={lS}>Customer *</label><input style={iS} value={customer} onChange={e => setCustomer(e.target.value)}/></div>
            <div><label style={lS}>Contact Name</label><input style={iS} value={contactName} onChange={e => setContactName(e.target.value)}/></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={lS}>Phone</label><input style={iS} value={phone} onChange={e => setPhone(e.target.value)}/></div>
            <div><label style={lS}>Email</label><input style={iS} value={email} onChange={e => setEmail(e.target.value)}/></div>
          </div>
          <div><label style={lS}>Site Address</label><input style={iS} value={address} onChange={e => setAddress(e.target.value)}/></div>
          <div><label style={lS}>Type</label><select style={iS} value={type} onChange={e => setType(e.target.value)}><option value="retrofit">Retrofit</option><option value="new-construction">New Construction</option></select></div>
          <div><label style={lS}>Systems</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {PROJECT_TYPES.map(pt => (<button key={pt} onClick={() => setSystems(s => s.includes(pt)?s.filter(x=>x!==pt):[...s,pt])} style={{ padding:"5px 12px", borderRadius:6, border:"1px solid #1e293b", fontSize:12, cursor:"pointer", fontFamily:"inherit", background:systems.includes(pt)?"#6366f1":"transparent", color:systems.includes(pt)?"#fff":"#94a3b8" }}>{pt}</button>))}
            </div>
          </div>
          <div><label style={lS}>Notes</label><textarea style={{ ...iS, minHeight:60, resize:"vertical" }} value={notes} onChange={e => setNotes(e.target.value)}/></div>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:20 }}>
          <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:"#94a3b8", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          <button onClick={() => { if(name.trim()&&customer.trim()) onSave({ name:name.trim(), customer:customer.trim(), contactName, contactPhone:phone, contactEmail:email, siteAddress:address, type, systems, notes, bidAmount:"" }); }} style={{ padding:"9px 20px", borderRadius:8, border:"none", background:"#6366f1", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:name.trim()&&customer.trim()?1:0.4 }}>Create Opportunity</button>
        </div>
      </div>
    </div>
  );
}
