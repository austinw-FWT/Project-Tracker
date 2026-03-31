import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Users, Settings, LayoutGrid, Search, Edit2, Trash2, FileText, Camera, ClipboardList, MapPin, Phone, Mail, DollarSign, Cable, ChevronDown, ChevronUp, Clock, User, Building2, ArrowLeft, CheckCircle2, Circle, Layers, CalendarDays, Wifi, WifiOff, RefreshCw, Zap, ChevronLeft, ChevronRight, StickyNote, ListTodo, LogOut, Shield } from "lucide-react";
import { auth, googleProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut, updateProfile } from "./firebase.js";

const FB_URL = "https://fwt-lv-tracker-default-rtdb.firebaseio.com";
const DB_PATH = "/tracker";

const DEFAULT_PHASES = [
  { id: "lead", name: "Lead", color: "#6366f1" },
  { id: "site-walk", name: "Site Walk", color: "#8b5cf6" },
  { id: "design", name: "Design", color: "#3b82f6" },
  { id: "bid", name: "Bid", color: "#0ea5e9" },
  { id: "awarded", name: "Awarded", color: "#10b981" },
  { id: "installation", name: "Installation", color: "#f59e0b" },
  { id: "punch-list", name: "Punch List", color: "#ef4444" },
  { id: "closeout", name: "Closeout", color: "#6b7280" },
];
const PROJECT_TYPES = ["Access Control", "Video Surveillance", "Intrusion Detection", "Structured Cabling", "Network Infrastructure"];

const LABOR_PHASES = [
  { id: "rough-in", name: "Rough In" },
  { id: "trim-out", name: "Trim Out" },
  { id: "head-in", name: "Head In" },
  { id: "programming", name: "Programming" },
  { id: "commissioning", name: "System Commissioning" },
  { id: "training", name: "Customer Training" },
  { id: "pm", name: "Project Management" },
  { id: "misc", name: "Miscellaneous" },
];

function defaultLaborHours() {
  const h = {};
  LABOR_PHASES.forEach(lp => { h[lp.id] = { bid: 0, remaining: 0 }; });
  return h;
}

const EMPTY_PROJECT = { id: "", name: "", customer: "", contactName: "", contactPhone: "", contactEmail: "", siteAddress: "", projectTypes: [], phaseId: "", type: "retrofit", scopeNotes: "", bidAmount: "", contractAmount: "", devices: [], cableRuns: [], tasks: [], documents: [], notes: [], teamMembers: [], laborHours: null, createdAt: "", updatedAt: "" };

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const DEFAULTS = { projects: [], phases: DEFAULT_PHASES, teamRoster: [], timesheets: [], schedule: {}, memberPrivate: {} };

async function fbRead() {
  const r = await fetch(`${FB_URL}${DB_PATH}.json`);
  if (!r.ok) throw new Error("Firebase read failed");
  return await r.json();
}
async function fbWrite(data) {
  const r = await fetch(`${FB_URL}${DB_PATH}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Firebase write failed");
}

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function formatDay(ds) {
  const d = new Date(ds + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ─── AUTH WRAPPER ─── */
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  if (authLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f1729", color: "#94a3b8", fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center" }}><Layers size={40} style={{ marginBottom: 12, color: "#6366f1" }} /><div>Loading...</div></div>
    </div>
  );

  if (!user) return <LoginScreen />;

  return <Tracker user={user} />;
}

/* ─── LOGIN SCREEN ─── */
function LoginScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) await updateProfile(cred.user, { displayName: displayName.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msg = err.code === "auth/user-not-found" ? "No account found with that email" : err.code === "auth/wrong-password" ? "Incorrect password" : err.code === "auth/invalid-credential" ? "Invalid email or password" : err.code === "auth/email-already-in-use" ? "An account with that email already exists" : err.code === "auth/weak-password" ? "Password must be at least 6 characters" : err.message;
      setError(msg);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError(""); setLoading(true);
    try { await signInWithPopup(auth, googleProvider); } catch (err) { setError(err.message); }
    setLoading(false);
  }

  const iS = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f1729", fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: 400, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Layers size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: "0 0 4px" }}>LV Tracker</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Project Management for Low Voltage Teams</p>
        </div>

        <div style={{ background: "#1a2332", borderRadius: 16, border: "1px solid #1e293b", padding: 24 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: mode === m ? "#6366f1" : "transparent", color: mode === m ? "#fff" : "#64748b" }}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div>
            {mode === "register" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Full Name</label>
                <input style={iS} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g., John Smith" />
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
              <input style={iS} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
              <input style={iS} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => { if (e.key === "Enter") handleEmail(e); }} />
            </div>

            {error && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#7f1d1d22", border: "1px solid #7f1d1d", color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <button onClick={handleEmail} disabled={loading}
              style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1, marginBottom: 12 }}>
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
              <span style={{ fontSize: 11, color: "#475569" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
            </div>

            <button onClick={handleGoogle} disabled={loading}
              style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "#334155" }}>
            <Shield size={11} /> Secured by Firebase Authentication
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN TRACKER ─── */
function Tracker({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("board");
  const [activeMember, setActiveMember] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [dragItem, setDragItem] = useState(null);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseColor, setNewPhaseColor] = useState("#6366f1");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamRole, setNewTeamRole] = useState("");
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [lastSync, setLastSync] = useState(null);
  const [syncPulse, setSyncPulse] = useState(false);
  const eventSourceRef = useRef(null);
  const saveTimeout = useRef(null);
  const isSaving = useRef(false);
  const latestData = useRef(null);

  useEffect(() => {
    let es = null, alive = true;
    async function init() {
      try {
        const remote = await fbRead();
        const d = remote ? { ...DEFAULTS, ...remote } : { ...DEFAULTS };
        latestData.current = d;
        if (alive) { setData(d); setSyncStatus("synced"); setLastSync(new Date()); setLoading(false); }
        if (!remote) await fbWrite(DEFAULTS);
      } catch (e) {
        if (alive) { setData(DEFAULTS); setSyncStatus("error"); setLoading(false); }
      }
      try {
        es = new EventSource(`${FB_URL}${DB_PATH}.json`);
        eventSourceRef.current = es;
        es.onopen = () => { if (alive) setSyncStatus("synced"); };
        es.addEventListener("put", evt => {
          if (!alive || isSaving.current) return;
          try {
            const parsed = JSON.parse(evt.data);
            if (parsed.path === "/" && parsed.data) {
              const nd = { ...DEFAULTS, ...parsed.data };
              latestData.current = nd; setData(nd);
              setSelectedProject(prev => prev ? nd.projects?.find(p => p.id === prev.id) || null : null);
              setSyncPulse(true); setTimeout(() => setSyncPulse(false), 1200);
              setLastSync(new Date());
            } else if (parsed.path && parsed.path !== "/") {
              fbRead().then(full => {
                if (!alive || isSaving.current) return;
                const nd = full ? { ...DEFAULTS, ...full } : { ...DEFAULTS };
                latestData.current = nd; setData(nd);
                setSelectedProject(prev => prev ? nd.projects?.find(p => p.id === prev.id) || null : null);
                setSyncPulse(true); setTimeout(() => setSyncPulse(false), 1200);
                setLastSync(new Date());
              }).catch(() => {});
            }
          } catch (err) {}
        });
        es.addEventListener("patch", () => {
          if (!alive || isSaving.current) return;
          fbRead().then(full => {
            if (!alive) return;
            const nd = full ? { ...DEFAULTS, ...full } : { ...DEFAULTS };
            latestData.current = nd; setData(nd);
            setSelectedProject(prev => prev ? nd.projects?.find(p => p.id === prev.id) || null : null);
            setSyncPulse(true); setTimeout(() => setSyncPulse(false), 1200); setLastSync(new Date());
          }).catch(() => {});
        });
        es.onerror = () => { if (alive) setSyncStatus("reconnecting"); };
      } catch (err) {}
    }
    init();
    return () => { alive = false; if (es) es.close(); };
  }, []);

  const saveData = useCallback(newData => {
    latestData.current = newData; setData(newData);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    isSaving.current = true; setSyncStatus("saving");
    saveTimeout.current = setTimeout(async () => {
      try { await fbWrite(newData); setSyncStatus("synced"); setLastSync(new Date()); } catch { setSyncStatus("error"); }
      setTimeout(() => { isSaving.current = false; }, 1000);
    }, 300);
  }, []);

  function updateProject(pid, updates) {
    const nd = { ...data, projects: data.projects.map(p => p.id === pid ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p) };
    saveData(nd);
    setSelectedProject(prev => prev?.id === pid ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : prev);
  }
  function addProject(project) {
    const now = new Date().toISOString();
    const np = { ...EMPTY_PROJECT, ...project, id: genId(), phaseId: project.phaseId || data.phases[0]?.id || "lead", createdAt: now, updatedAt: now };
    saveData({ ...data, projects: [...data.projects, np] }); setShowNewProject(false);
  }
  function deleteProject(pid) { saveData({ ...data, projects: data.projects.filter(p => p.id !== pid) }); setSelectedProject(null); }
  function handleDrop(phaseId) { if (dragItem && dragItem.phaseId !== phaseId) updateProject(dragItem.id, { phaseId }); setDragItem(null); }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f1729", color: "#94a3b8" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center" }}><Layers size={40} style={{ marginBottom: 12, color: "#6366f1" }} /><div>Connecting to Firebase...</div></div>
    </div>
  );
  if (!data) return null;

  const filteredProjects = data.projects.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.customer.toLowerCase().includes(searchTerm.toLowerCase()));
  const phaseMap = {}; data.phases.forEach(ph => { phaseMap[ph.id] = ph; });

  const currentView = activeMember ? "member" : view;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans',sans-serif", background: "#0f1729", color: "#e2e8f0", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <div style={{ width: 220, background: "#0b1120", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Layers size={15} color="#fff" /></div>
            LV Tracker
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, paddingLeft: 36 }}>Project Management</div>
        </div>

        <nav style={{ padding: "12px 8px", flex: 1, overflowY: "auto" }}>
          {[{ id: "board", icon: LayoutGrid, label: "Project Board" }, { id: "schedule", icon: CalendarDays, label: "Team Schedule" }, { id: "timesheets", icon: Clock, label: "Timesheets" }, { id: "team", icon: Users, label: "Team" }, { id: "settings", icon: Settings, label: "Phases" }].map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setSelectedProject(null); setActiveMember(null); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: !activeMember && view === item.id ? "#1e293b" : "transparent", color: !activeMember && view === item.id ? "#fff" : "#94a3b8", marginBottom: 2, fontFamily: "inherit", transition: "all 0.15s" }}>
              <item.icon size={16} />{item.label}
            </button>
          ))}

          {/* Team Member Private Sections */}
          {data.teamRoster.length > 0 && (
            <>
              <div style={{ padding: "16px 12px 6px", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>My Space</div>
              {data.teamRoster.map(m => (
                <button key={m.id} onClick={() => { setActiveMember(m.name); setSelectedProject(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: activeMember === m.name ? "#1e293b" : "transparent", color: activeMember === m.name ? "#fff" : "#64748b", marginBottom: 1, fontFamily: "inherit", transition: "all 0.15s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: activeMember === m.name ? "#6366f1" : "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: activeMember === m.name ? "#fff" : "#64748b", flexShrink: 0 }}>
                    {m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b" }}>
          <SyncIndicator status={syncStatus} lastSync={lastSync} pulse={syncPulse} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 0" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {(user.displayName || user.email || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName || user.email}</div>
            </div>
            <button onClick={() => signOut(auth)} title="Sign out" style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 2 }}><LogOut size={14} /></button>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{data.projects.length} project{data.projects.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12, background: "#0f1729", flexShrink: 0 }}>
          {selectedProject ? (
            <button onClick={() => setSelectedProject(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}><ArrowLeft size={16} /> Back to Board</button>
          ) : currentView === "board" ? (
            <>
              <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search projects..." style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid #1e293b", background: "#1e293b", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              </div>
              <button onClick={() => setShowNewProject(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /> New Project</button>
            </>
          ) : currentView === "member" ? (
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{activeMember?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</div>
              {activeMember}'s Space
            </div>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
              {view === "team" ? "Team Roster" : view === "timesheets" ? "Timesheets" : view === "schedule" ? "Team Schedule" : "Phase Management"}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {selectedProject ? (<ProjectDetail project={selectedProject} phases={data.phases} phaseMap={phaseMap} teamRoster={data.teamRoster} onUpdate={u => updateProject(selectedProject.id, u)} onDelete={() => deleteProject(selectedProject.id)} detailTab={detailTab} setDetailTab={setDetailTab} />
          ) : currentView === "member" ? (<MemberPrivateView memberName={activeMember} memberPrivate={data.memberPrivate || {}} projects={data.projects} phaseMap={phaseMap} onUpdate={mp => saveData({ ...data, memberPrivate: mp })} />
          ) : currentView === "board" ? (<KanbanBoard projects={filteredProjects} phases={data.phases} onSelectProject={p => { setSelectedProject(p); setDetailTab("overview"); }} onDragStart={setDragItem} onDrop={handleDrop} dragItem={dragItem} />
          ) : currentView === "schedule" ? (<ScheduleView schedule={data.schedule || {}} teamRoster={data.teamRoster} projects={data.projects} onUpdate={sched => saveData({ ...data, schedule: sched })} />
          ) : currentView === "team" ? (<TeamView teamRoster={data.teamRoster} newTeamName={newTeamName} setNewTeamName={setNewTeamName} newTeamRole={newTeamRole} setNewTeamRole={setNewTeamRole}
              onAdd={() => { if (!newTeamName.trim()) return; saveData({ ...data, teamRoster: [...data.teamRoster, { id: genId(), name: newTeamName.trim(), role: newTeamRole.trim() }] }); setNewTeamName(""); setNewTeamRole(""); }}
              onRemove={id => saveData({ ...data, teamRoster: data.teamRoster.filter(t => t.id !== id) })} />
          ) : currentView === "timesheets" ? (<TimesheetView timesheets={data.timesheets || []} teamRoster={data.teamRoster} projects={data.projects}
              onAdd={entry => { const ne = { ...entry, id: genId(), createdAt: new Date().toISOString() }; saveData({ ...data, timesheets: [...(data.timesheets || []), ne] }); }}
              onRemove={id => saveData({ ...data, timesheets: (data.timesheets || []).filter(t => t.id !== id) })} />
          ) : (<PhaseSettings phases={data.phases} newPhaseName={newPhaseName} setNewPhaseName={setNewPhaseName} newPhaseColor={newPhaseColor} setNewPhaseColor={setNewPhaseColor}
              onAdd={() => { if (!newPhaseName.trim()) return; saveData({ ...data, phases: [...data.phases, { id: genId(), name: newPhaseName.trim(), color: newPhaseColor }] }); setNewPhaseName(""); }}
              onRemove={id => saveData({ ...data, phases: data.phases.filter(p => p.id !== id) })}
              onMoveUp={idx => { if (idx === 0) return; const np = [...data.phases]; [np[idx - 1], np[idx]] = [np[idx], np[idx - 1]]; saveData({ ...data, phases: np }); }}
              onMoveDown={idx => { if (idx === data.phases.length - 1) return; const np = [...data.phases]; [np[idx], np[idx + 1]] = [np[idx + 1], np[idx]]; saveData({ ...data, phases: np }); }} />
          )}
        </div>
      </div>
      {showNewProject && <NewProjectModal phases={data.phases} onSave={addProject} onClose={() => setShowNewProject(false)} />}
    </div>
  );
}

/* ─── SYNC INDICATOR ─── */
function SyncIndicator({ status, lastSync, pulse }) {
  const c = { connecting: { color: "#f59e0b", icon: RefreshCw, text: "Connecting...", spin: true }, synced: { color: "#10b981", icon: Zap, text: "Live — Firebase", spin: false }, saving: { color: "#6366f1", icon: RefreshCw, text: "Saving...", spin: true }, reconnecting: { color: "#f59e0b", icon: RefreshCw, text: "Reconnecting...", spin: true }, error: { color: "#ef4444", icon: WifiOff, text: "Connection lost", spin: false } }[status] || { color: "#10b981", icon: Zap, text: "Live", spin: false };
  const Icon = c.icon;
  return (<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", background: c.color, boxShadow: pulse ? `0 0 8px 3px ${c.color}66` : "none", transition: "box-shadow 0.4s" }} />
    <Icon size={12} style={{ color: c.color, animation: c.spin ? "spin 1s linear infinite" : "none" }} />
    <span style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{c.text}</span>
    {lastSync && status === "synced" && <span style={{ fontSize: 10, color: "#334155", marginLeft: "auto" }}>{lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.5);opacity:0}}`}</style>
  </div>);
}

/* ─── TEAM SCHEDULE VIEW ─── */
function ScheduleView({ schedule, teamRoster, projects, onUpdate }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const dates = getWeekDates(weekOffset);
  const today = new Date().toISOString().split("T")[0];
  const iS = { width: "100%", padding: "4px 6px", borderRadius: 6, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none" };

  function setAssignment(date, memberName, projectId) {
    const dayData = { ...(schedule[date] || {}) };
    if (projectId) { dayData[memberName] = projectId; } else { delete dayData[memberName]; }
    onUpdate({ ...schedule, [date]: dayData });
  }

  const weekStart = formatDay(dates[0]);
  const weekEnd = formatDay(dates[6]);

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#94a3b8", cursor: "pointer", fontFamily: "inherit" }}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>{weekStart} — {weekEnd}</span>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#94a3b8", cursor: "pointer", fontFamily: "inherit" }}><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => setWeekOffset(0)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #1e293b", background: weekOffset === 0 ? "#6366f1" : "#1a2332", color: weekOffset === 0 ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>This Week</button>
      </div>

      {teamRoster.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#334155", fontSize: 13 }}>Add team members first to start scheduling.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `160px repeat(7, 1fr)`, gap: 1, minWidth: 900 }}>
            {/* Header */}
            <div style={{ padding: "10px 12px", background: "#1a2332", borderRadius: "8px 0 0 0", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Team Member</div>
            {dates.map(d => (
              <div key={d} style={{ padding: "10px 8px", background: d === today ? "#6366f122" : "#1a2332", textAlign: "center", fontSize: 11, fontWeight: 600, color: d === today ? "#818cf8" : "#94a3b8", borderBottom: d === today ? "2px solid #6366f1" : "none" }}>
                {formatDay(d)}
              </div>
            ))}

            {/* Rows */}
            {teamRoster.map(member => (
              <>
                <div key={`name-${member.id}`} style={{ padding: "10px 12px", background: "#0b1120", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1e293b" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#818cf8", flexShrink: 0 }}>{member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{member.name}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>{member.role}</div>
                  </div>
                </div>
                {dates.map(d => {
                  const assigned = schedule[d]?.[member.name] || "";
                  return (
                    <div key={`${member.id}-${d}`} style={{ padding: "6px 4px", background: d === today ? "#6366f108" : "#0f1729", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center" }}>
                      <select style={iS} value={assigned} onChange={e => setAssignment(d, member.name, e.target.value)}>
                        <option value="">— Off —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MEMBER PRIVATE VIEW ─── */
function MemberPrivateView({ memberName, memberPrivate, projects, phaseMap, onUpdate }) {
  const [newNote, setNewNote] = useState("");
  const [newTodo, setNewTodo] = useState("");
  const [tab, setTab] = useState("todos");

  const mp = memberPrivate[memberName] || { notes: [], todos: [] };

  function save(updates) {
    onUpdate({ ...memberPrivate, [memberName]: { ...mp, ...updates } });
  }

  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px" }}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Personal workspace for {memberName}. Notes, to-dos, and tasks are saved here.</p>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e293b" }}>
        {[{ id: "todos", label: "To-Do List", icon: ListTodo }, { id: "notes", label: "Notes", icon: StickyNote }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", color: tab === t.id ? "#fff" : "#64748b", borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "todos" && (
        <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <input style={{ ...iS, flex: 1 }} placeholder="Add a to-do..." value={newTodo} onChange={e => setNewTodo(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newTodo.trim()) { save({ todos: [...(mp.todos || []), { id: genId(), text: newTodo.trim(), done: false, createdAt: new Date().toISOString() }] }); setNewTodo(""); } }} />
            <button onClick={() => { if (!newTodo.trim()) return; save({ todos: [...(mp.todos || []), { id: genId(), text: newTodo.trim(), done: false, createdAt: new Date().toISOString() }] }); setNewTodo(""); }}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0 }}><Plus size={14} /></button>
          </div>

          {/* Active todos */}
          {(mp.todos || []).filter(t => !t.done).map(todo => (
            <div key={todo.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
              <button onClick={() => save({ todos: mp.todos.map(t => t.id === todo.id ? { ...t, done: true } : t) })}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", flexShrink: 0 }}><Circle size={18} /></button>
              <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{todo.text}</span>
              <button onClick={() => save({ todos: mp.todos.filter(t => t.id !== todo.id) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={13} /></button>
            </div>
          ))}

          {/* Completed */}
          {(mp.todos || []).filter(t => t.done).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", marginTop: 16, marginBottom: 8, letterSpacing: "0.05em" }}>Completed</div>
              {(mp.todos || []).filter(t => t.done).map(todo => (
                <div key={todo.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e293b0a" }}>
                  <button onClick={() => save({ todos: mp.todos.map(t => t.id === todo.id ? { ...t, done: false } : t) })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#10b981", flexShrink: 0 }}><CheckCircle2 size={18} /></button>
                  <span style={{ flex: 1, fontSize: 13, color: "#475569", textDecoration: "line-through" }}>{todo.text}</span>
                  <button onClick={() => save({ todos: mp.todos.filter(t => t.id !== todo.id) })} style={{ background: "none", border: "none", color: "#1e293b", cursor: "pointer" }}><X size={13} /></button>
                </div>
              ))}
            </>
          )}

          {(mp.todos || []).length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#334155", fontSize: 13 }}>No to-dos yet. Add one above.</div>}
        </div>
      )}

      {tab === "notes" && (
        <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <textarea style={{ ...iS, minHeight: 60, resize: "vertical" }} placeholder="Write a note..." value={newNote} onChange={e => setNewNote(e.target.value)} />
            <button onClick={() => { if (!newNote.trim()) return; save({ notes: [{ id: genId(), text: newNote.trim(), date: new Date().toISOString() }, ...(mp.notes || [])] }); setNewNote(""); }}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0, alignSelf: "flex-start" }}><Plus size={14} /></button>
          </div>

          {(mp.notes || []).map(note => (
            <div key={note.id} style={{ padding: "14px 0", borderBottom: "1px solid #1e293b", display: "flex", gap: 10 }}>
              <StickyNote size={14} style={{ color: "#f59e0b", marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>{note.text}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>{new Date(note.date).toLocaleString()}</div>
              </div>
              <button onClick={() => save({ notes: mp.notes.filter(n => n.id !== note.id) })} style={{ background: "none", border: "none", color: "#1e293b", cursor: "pointer", alignSelf: "flex-start" }}><X size={13} /></button>
            </div>
          ))}

          {(mp.notes || []).length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#334155", fontSize: 13 }}>No notes yet. Write one above.</div>}
        </div>
      )}
    </div>
  );
}

/* ─── KANBAN BOARD ─── */
function KanbanBoard({ projects, phases, onSelectProject, onDragStart, onDrop, dragItem }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 20px", height: "100%", overflowX: "auto", alignItems: "flex-start" }}>
      {phases.map(phase => {
        const pp = projects.filter(p => p.phaseId === phase.id);
        const isOver = dragItem && dragItem.phaseId !== phase.id;
        return (
          <div key={phase.id} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(phase.id)}
            style={{ minWidth: 260, maxWidth: 260, background: "#1a2332", borderRadius: 12, border: isOver ? `2px dashed ${phase.color}` : "1px solid #1e293b", display: "flex", flexDirection: "column", maxHeight: "100%", flexShrink: 0 }}>
            <div style={{ padding: "14px 14px 10px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1e293b" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: phase.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", flex: 1 }}>{phase.name}</span>
              <span style={{ fontSize: 11, color: "#64748b", background: "#0f1729", borderRadius: 10, padding: "2px 8px" }}>{pp.length}</span>
            </div>
            <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {pp.map(project => (
                <div key={project.id} draggable onDragStart={() => onDragStart(project)} onClick={() => onSelectProject(project)}
                  style={{ padding: "12px", borderRadius: 8, background: "#0f1729", border: "1px solid #1e293b", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = phase.color} onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{project.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{project.customer}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{project.projectTypes?.map(t => (<span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#1e293b", color: "#94a3b8" }}>{t}</span>))}</div>
                  {project.tasks?.length > 0 && <div style={{ marginTop: 8, fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={11} />{project.tasks.filter(t => t.done).length}/{project.tasks.length} tasks</div>}
                </div>
              ))}
              {pp.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#334155" }}>Drag projects here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── PROJECT DETAIL ─── */
function ProjectDetail({ project, phases, phaseMap, teamRoster, onUpdate, onDelete, detailTab, setDetailTab }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(project);
  const [newTask, setNewTask] = useState(""); const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newDocName, setNewDocName] = useState(""); const [newDocType, setNewDocType] = useState("document");
  const [newNote, setNewNote] = useState("");
  const [newDeviceName, setNewDeviceName] = useState(""); const [newDeviceQty, setNewDeviceQty] = useState(""); const [newDeviceLocation, setNewDeviceLocation] = useState("");
  const [newCableType, setNewCableType] = useState(""); const [newCableQty, setNewCableQty] = useState(""); const [newCableFrom, setNewCableFrom] = useState(""); const [newCableTo, setNewCableTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (!editMode) setForm(project); }, [project, editMode]);

  const tabs = [{ id: "overview", label: "Overview", icon: ClipboardList }, { id: "hours", label: "Hours", icon: Clock }, { id: "scope", label: "Scope & Devices", icon: Cable }, { id: "tasks", label: "Tasks", icon: CheckCircle2 }, { id: "docs", label: "Documents", icon: FileText }, { id: "notes", label: "Activity", icon: Clock }];
  const currentPhase = phaseMap[project.phaseId];
  function saveEdit() { onUpdate(form); setEditMode(false); }

  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: 0 }}>{project.name}</h1>
            {currentPhase && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: currentPhase.color + "22", color: currentPhase.color, fontWeight: 600 }}>{currentPhase.name}</span>}
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{project.customer}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setForm(project); setEditMode(!editMode); }} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Edit2 size={13} /> Edit</button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #7f1d1d", background: "transparent", color: "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Trash2 size={13} /> Delete</button>
          ) : (<button onClick={onDelete} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Confirm Delete</button>)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {phases.map(ph => (<button key={ph.id} onClick={() => onUpdate({ phaseId: ph.id })} style={{ padding: "5px 12px", borderRadius: 20, border: project.phaseId === ph.id ? `2px solid ${ph.color}` : "1px solid #1e293b", background: project.phaseId === ph.id ? ph.color + "22" : "transparent", color: project.phaseId === ph.id ? ph.color : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{ph.name}</button>))}
      </div>

      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid #1e293b" }}>
        {tabs.map(tab => (<button key={tab.id} onClick={() => setDetailTab(tab.id)} style={{ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", color: detailTab === tab.id ? "#fff" : "#64748b", borderBottom: detailTab === tab.id ? "2px solid #6366f1" : "2px solid transparent", fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><tab.icon size={14} /> {tab.label}</button>))}
      </div>

      <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20 }}>
        {detailTab === "overview" && (
          editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div><label style={lS}>Project Name</label><input style={iS} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label style={lS}>Customer</label><input style={iS} value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} /></div>
              <div><label style={lS}>Contact Name</label><input style={iS} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
              <div><label style={lS}>Contact Phone</label><input style={iS} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
              <div><label style={lS}>Contact Email</label><input style={iS} value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
              <div><label style={lS}>Site Address</label><input style={iS} value={form.siteAddress} onChange={e => setForm({ ...form, siteAddress: e.target.value })} /></div>
              <div><label style={lS}>Project Type</label><select style={iS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="retrofit">Retrofit</option><option value="new-construction">New Construction</option></select></div>
              <div><label style={lS}>Systems</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{PROJECT_TYPES.map(pt => (<button key={pt} onClick={() => { const t = form.projectTypes || []; setForm({ ...form, projectTypes: t.includes(pt) ? t.filter(x => x !== pt) : [...t, pt] }); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #1e293b", fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: (form.projectTypes || []).includes(pt) ? "#6366f1" : "transparent", color: (form.projectTypes || []).includes(pt) ? "#fff" : "#94a3b8" }}>{pt}</button>))}</div></div>
              <div><label style={lS}>Bid Amount</label><input style={iS} value={form.bidAmount} onChange={e => setForm({ ...form, bidAmount: e.target.value })} placeholder="$" /></div>
              <div><label style={lS}>Contract Amount</label><input style={iS} value={form.contractAmount} onChange={e => setForm({ ...form, contractAmount: e.target.value })} placeholder="$" /></div>
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setEditMode(false)} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={saveEdit} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <InfoRow icon={Building2} label="Customer" value={project.customer} /><InfoRow icon={User} label="Contact" value={project.contactName} />
              <InfoRow icon={Phone} label="Phone" value={project.contactPhone} /><InfoRow icon={Mail} label="Email" value={project.contactEmail} />
              <InfoRow icon={MapPin} label="Site Address" value={project.siteAddress} /><InfoRow icon={Layers} label="Type" value={project.type === "retrofit" ? "Retrofit" : "New Construction"} />
              <InfoRow icon={DollarSign} label="Bid Amount" value={project.bidAmount} /><InfoRow icon={DollarSign} label="Contract Amount" value={project.contractAmount} />
              <div style={{ gridColumn: "1/-1" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Systems</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(project.projectTypes || []).map(t => <span key={t} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#6366f122", color: "#818cf8" }}>{t}</span>)}{(!project.projectTypes || project.projectTypes.length === 0) && <span style={{ fontSize: 12, color: "#475569" }}>None specified</span>}</div>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Team</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(project.teamMembers || []).map(tm => (<span key={tm} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#1e293b", color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}><User size={11} /> {tm}<button onClick={() => onUpdate({ teamMembers: project.teamMembers.filter(m => m !== tm) })} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 0, marginLeft: 2 }}><X size={11} /></button></span>))}</div>
                {teamRoster.length > 0 && (<select style={{ ...iS, maxWidth: 200, marginTop: 8, fontSize: 12 }} value="" onChange={e => { if (e.target.value && !(project.teamMembers || []).includes(e.target.value)) onUpdate({ teamMembers: [...(project.teamMembers || []), e.target.value] }); }}><option value="">+ Assign team member</option>{teamRoster.filter(t => !(project.teamMembers || []).includes(t.name)).map(t => <option key={t.id} value={t.name}>{t.name} — {t.role}</option>)}</select>)}
              </div>
            </div>
          )
        )}

        {detailTab === "hours" && <LaborHoursTab project={project} onUpdate={onUpdate} />}

        {detailTab === "scope" && (
          <div>
            <div style={{ marginBottom: 24 }}><label style={lS}>Scope Notes</label><textarea style={{ ...iS, minHeight: 80, resize: "vertical" }} value={project.scopeNotes || ""} onChange={e => onUpdate({ scopeNotes: e.target.value })} placeholder="Describe the project scope..." /></div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...lS, marginBottom: 10 }}>Device Schedule</div>
              {(project.devices || []).map((d, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}><span style={{ color: "#94a3b8", minWidth: 30, textAlign: "right" }}>{d.qty}x</span><span style={{ color: "#e2e8f0", flex: 1 }}>{d.name}</span><span style={{ color: "#64748b", fontSize: 11 }}>{d.location}</span><button onClick={() => onUpdate({ devices: project.devices.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={13} /></button></div>))}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input style={{ ...iS, flex: 0.5 }} placeholder="Qty" value={newDeviceQty} onChange={e => setNewDeviceQty(e.target.value)} />
                <input style={{ ...iS, flex: 2 }} placeholder="Device" value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} />
                <input style={{ ...iS, flex: 1.5 }} placeholder="Location" value={newDeviceLocation} onChange={e => setNewDeviceLocation(e.target.value)} />
                <button onClick={() => { if (!newDeviceName.trim()) return; onUpdate({ devices: [...(project.devices || []), { name: newDeviceName.trim(), qty: newDeviceQty || "1", location: newDeviceLocation.trim() }] }); setNewDeviceName(""); setNewDeviceQty(""); setNewDeviceLocation(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0 }}><Plus size={14} /></button>
              </div>
            </div>
            <div>
              <div style={{ ...lS, marginBottom: 10 }}>Cable Runs</div>
              {(project.cableRuns || []).map((c, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13 }}><span style={{ color: "#94a3b8", minWidth: 30, textAlign: "right" }}>{c.qty}x</span><span style={{ color: "#0ea5e9" }}>{c.type}</span><span style={{ color: "#64748b" }}>{c.from} → {c.to}</span><button onClick={() => onUpdate({ cableRuns: project.cableRuns.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginLeft: "auto" }}><X size={13} /></button></div>))}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input style={{ ...iS, flex: 0.5 }} placeholder="Qty" value={newCableQty} onChange={e => setNewCableQty(e.target.value)} />
                <input style={{ ...iS, flex: 1 }} placeholder="Cable type" value={newCableType} onChange={e => setNewCableType(e.target.value)} />
                <input style={{ ...iS, flex: 1 }} placeholder="From" value={newCableFrom} onChange={e => setNewCableFrom(e.target.value)} />
                <input style={{ ...iS, flex: 1 }} placeholder="To" value={newCableTo} onChange={e => setNewCableTo(e.target.value)} />
                <button onClick={() => { if (!newCableType.trim()) return; onUpdate({ cableRuns: [...(project.cableRuns || []), { type: newCableType.trim(), qty: newCableQty || "1", from: newCableFrom.trim(), to: newCableTo.trim() }] }); setNewCableType(""); setNewCableQty(""); setNewCableFrom(""); setNewCableTo(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0 }}><Plus size={14} /></button>
              </div>
            </div>
          </div>
        )}

        {detailTab === "tasks" && (
          <div>
            {(project.tasks || []).map((task, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e293b" }}><button onClick={() => { const nt = [...project.tasks]; nt[i] = { ...nt[i], done: !nt[i].done }; onUpdate({ tasks: nt }); }} style={{ background: "none", border: "none", cursor: "pointer", color: task.done ? "#10b981" : "#334155", flexShrink: 0 }}>{task.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button><span style={{ flex: 1, fontSize: 13, color: task.done ? "#64748b" : "#e2e8f0", textDecoration: task.done ? "line-through" : "none" }}>{task.text}</span>{task.assignee && <span style={{ fontSize: 11, color: "#64748b", background: "#0f1729", padding: "2px 8px", borderRadius: 10 }}>{task.assignee}</span>}<button onClick={() => onUpdate({ tasks: project.tasks.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={13} /></button></div>))}
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <input style={{ ...iS, flex: 2 }} placeholder="New task..." value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) { onUpdate({ tasks: [...(project.tasks || []), { text: newTask.trim(), assignee: newTaskAssignee.trim(), done: false }] }); setNewTask(""); setNewTaskAssignee(""); } }} />
              <input style={{ ...iS, flex: 1 }} placeholder="Assignee" value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} />
              <button onClick={() => { if (!newTask.trim()) return; onUpdate({ tasks: [...(project.tasks || []), { text: newTask.trim(), assignee: newTaskAssignee.trim(), done: false }] }); setNewTask(""); setNewTaskAssignee(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0 }}><Plus size={14} /></button>
            </div>
          </div>
        )}

        {detailTab === "docs" && (
          <div>
            {(project.documents || []).map((doc, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1e293b" }}>{doc.type === "photo" ? <Camera size={16} style={{ color: "#f59e0b" }} /> : <FileText size={16} style={{ color: "#3b82f6" }} />}<span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{doc.name}</span><span style={{ fontSize: 11, color: "#64748b" }}>{doc.type}</span><span style={{ fontSize: 11, color: "#475569" }}>{new Date(doc.addedAt).toLocaleDateString()}</span><button onClick={() => onUpdate({ documents: project.documents.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={13} /></button></div>))}
            <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center" }}>
              <input style={{ ...iS, flex: 2 }} placeholder="Document name..." value={newDocName} onChange={e => setNewDocName(e.target.value)} />
              <select style={{ ...iS, flex: 0.8 }} value={newDocType} onChange={e => setNewDocType(e.target.value)}><option value="document">Document</option><option value="photo">Photo</option><option value="drawing">Drawing</option><option value="proposal">Proposal</option><option value="contract">Contract</option><option value="submittal">Submittal</option><option value="closeout">Closeout Pkg</option></select>
              <button onClick={() => { if (!newDocName.trim()) return; onUpdate({ documents: [...(project.documents || []), { name: newDocName.trim(), type: newDocType, addedAt: new Date().toISOString() }] }); setNewDocName(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0 }}><Plus size={14} /></button>
            </div>
          </div>
        )}

        {detailTab === "notes" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <input style={{ ...iS, flex: 1 }} placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newNote.trim()) { onUpdate({ notes: [{ text: newNote.trim(), date: new Date().toISOString() }, ...(project.notes || [])] }); setNewNote(""); } }} />
              <button onClick={() => { if (!newNote.trim()) return; onUpdate({ notes: [{ text: newNote.trim(), date: new Date().toISOString() }, ...(project.notes || [])] }); setNewNote(""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", flexShrink: 0 }}><Plus size={14} /></button>
            </div>
            {(project.notes || []).map((note, i) => (<div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #1e293b", display: "flex", gap: 10 }}><Clock size={14} style={{ color: "#475569", marginTop: 2, flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, color: "#e2e8f0" }}>{note.text}</div><div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{new Date(note.date).toLocaleString()}</div></div><button onClick={() => onUpdate({ notes: project.notes.filter((_, idx) => idx !== i) })} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer" }}><X size={12} /></button></div>))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── LABOR HOURS TAB ─── */
function LaborHoursTab({ project, onUpdate }) {
  const lh = project.laborHours || defaultLaborHours();
  const iS = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", textAlign: "center" };
  function upd(phaseId, field, val) { const num = parseFloat(val) || 0; onUpdate({ laborHours: { ...lh, [phaseId]: { ...lh[phaseId], [field]: num } } }); }
  const totalBid = LABOR_PHASES.reduce((s, lp) => s + (lh[lp.id]?.bid || 0), 0);
  const totalRemaining = LABOR_PHASES.reduce((s, lp) => s + (lh[lp.id]?.remaining || 0), 0);
  const totalUsed = totalBid - totalRemaining;
  const totalPct = totalBid > 0 ? Math.round((totalUsed / totalBid) * 100) : 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <SummaryCard label="Total Bid" value={`${totalBid.toFixed(1)}h`} color="#6366f1" />
        <SummaryCard label="Hours Used" value={`${totalUsed.toFixed(1)}h`} color="#f59e0b" />
        <SummaryCard label="Remaining" value={`${totalRemaining.toFixed(1)}h`} color="#10b981" />
        <SummaryCard label="Complete" value={`${totalPct}%`} color={totalPct > 90 ? "#ef4444" : totalPct > 70 ? "#f59e0b" : "#10b981"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "0 12px 10px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <span>Labor Phase</span><span style={{ textAlign: "center" }}>Hours Bid</span><span style={{ textAlign: "center" }}>Hours Used</span><span style={{ textAlign: "center" }}>Remaining</span><span style={{ textAlign: "center" }}>Progress</span>
      </div>
      {LABOR_PHASES.map(lp => {
        const bid = lh[lp.id]?.bid || 0, remaining = lh[lp.id]?.remaining || 0, used = bid - remaining, pct = bid > 0 ? Math.round((used / bid) * 100) : 0, over = remaining < 0;
        return (
          <div key={lp.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "10px 12px", background: "#0f1729", borderRadius: 8, marginBottom: 4, border: over ? "1px solid #7f1d1d" : "1px solid transparent" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{lp.name}</span>
            <input type="number" step="0.5" min="0" style={iS} value={bid || ""} onChange={e => upd(lp.id, "bid", e.target.value)} placeholder="0" />
            <div style={{ textAlign: "center", fontSize: 13, color: over ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>{used.toFixed(1)}h</div>
            <input type="number" step="0.5" style={iS} value={remaining || ""} onChange={e => upd(lp.id, "remaining", e.target.value)} placeholder="0" />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1e293b", overflow: "hidden" }}><div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 3, background: over ? "#ef4444" : pct > 90 ? "#f59e0b" : "#10b981", transition: "width 0.3s" }} /></div>
              <span style={{ fontSize: 11, color: over ? "#ef4444" : "#64748b", fontWeight: 600, minWidth: 32, textAlign: "right" }}>{pct}%</span>
            </div>
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "12px 12px", background: "#1e293b", borderRadius: 8, marginTop: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>TOTALS</span>
        <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#6366f1", fontFamily: "'Outfit',sans-serif" }}>{totalBid.toFixed(1)}h</div>
        <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#f59e0b", fontFamily: "'Outfit',sans-serif" }}>{totalUsed.toFixed(1)}h</div>
        <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#10b981", fontFamily: "'Outfit',sans-serif" }}>{totalRemaining.toFixed(1)}h</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#0f1729", overflow: "hidden" }}><div style={{ width: `${Math.min(totalPct, 100)}%`, height: "100%", borderRadius: 3, background: totalPct > 90 ? "#f59e0b" : "#10b981" }} /></div>
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, minWidth: 32, textAlign: "right" }}>{totalPct}%</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (<div style={{ background: "#0f1729", borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
    <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Outfit',sans-serif" }}>{value}</div>
  </div>);
}

function InfoRow({ icon: Icon, label, value }) {
  return (<div><div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div><div style={{ fontSize: 13, color: value ? "#e2e8f0" : "#334155", display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} style={{ color: "#475569" }} />{value || "—"}</div></div>);
}

/* ─── NEW PROJECT MODAL ─── */
function NewProjectModal({ phases, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_PROJECT, phaseId: phases[0]?.id || "" });
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f1729", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#1a2332", borderRadius: 16, border: "1px solid #1e293b", padding: 24, width: 520, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: 0 }}>New Project</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <div><label style={lS}>Project Name *</label><input style={iS} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Acme Corp HQ Camera Upgrade" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={lS}>Customer *</label><input style={iS} value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} /></div>
            <div><label style={lS}>Contact Name</label><input style={iS} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={lS}>Phone</label><input style={iS} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div><label style={lS}>Email</label><input style={iS} value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
          </div>
          <div><label style={lS}>Site Address</label><input style={iS} value={form.siteAddress} onChange={e => setForm({ ...form, siteAddress: e.target.value })} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={lS}>Starting Phase</label><select style={iS} value={form.phaseId} onChange={e => setForm({ ...form, phaseId: e.target.value })}>{phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label style={lS}>Project Type</label><select style={iS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="retrofit">Retrofit</option><option value="new-construction">New Construction</option></select></div>
          </div>
          <div><label style={lS}>Systems</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{PROJECT_TYPES.map(pt => (<button key={pt} onClick={() => { const t = form.projectTypes || []; setForm({ ...form, projectTypes: t.includes(pt) ? t.filter(x => x !== pt) : [...t, pt] }); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #1e293b", fontSize: 12, cursor: "pointer", fontFamily: "inherit", background: (form.projectTypes || []).includes(pt) ? "#6366f1" : "transparent", color: (form.projectTypes || []).includes(pt) ? "#fff" : "#94a3b8" }}>{pt}</button>))}</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => { if (form.name.trim() && form.customer.trim()) onSave(form); }} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: form.name.trim() && form.customer.trim() ? 1 : 0.4 }}>Create Project</button>
        </div>
      </div>
    </div>
  );
}

/* ─── TEAM VIEW ─── */
function TeamView({ teamRoster, newTeamName, setNewTeamName, newTeamRole, setNewTeamRole, onAdd, onRemove }) {
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px" }}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Manage your installation team. Team members can be assigned to projects and tasks.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input style={{ ...iS, flex: 1 }} placeholder="Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
        <input style={{ ...iS, flex: 1 }} placeholder="Role (e.g., Lead Tech)" value={newTeamRole} onChange={e => setNewTeamRole(e.target.value)} />
        <button onClick={onAdd} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}><Plus size={15} /></button>
      </div>
      {teamRoster.map(member => (
        <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#1a2332", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8" }}><User size={16} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{member.name}</div><div style={{ fontSize: 12, color: "#64748b" }}>{member.role || "Team Member"}</div></div>
          <button onClick={() => onRemove(member.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={16} /></button>
        </div>
      ))}
      {teamRoster.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#334155", fontSize: 13 }}>No team members yet. Add your crew above.</div>}
    </div>
  );
}

/* ─── TIMESHEET VIEW ─── */
function TimesheetView({ timesheets, teamRoster, projects, onAdd, onRemove }) {
  const [member, setMember] = useState(""); const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [hours, setHours] = useState(""); const [category, setCategory] = useState("Installation"); const [description, setDescription] = useState("");
  const [filterMember, setFilterMember] = useState("all"); const [filterProject, setFilterProject] = useState("all"); const [filterWeek, setFilterWeek] = useState("all"); const [summaryView, setSummaryView] = useState("entries");
  const CATEGORIES = ["Installation", "Programming", "Termination", "Cable Pull", "Site Walk", "Design", "Commissioning", "Punch List", "Training", "Travel", "Other"];
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
  const projectMap = {}; projects.forEach(p => { projectMap[p.id] = p; });
  function getWeekKey(ds) { const d = new Date(ds + "T00:00:00"); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)).toISOString().split("T")[0]; }
  const filtered = timesheets.filter(e => { if (filterMember !== "all" && e.member !== filterMember) return false; if (filterProject !== "all" && e.projectId !== filterProject) return false; if (filterWeek !== "all" && getWeekKey(e.date) !== filterWeek) return false; return true; }).sort((a, b) => b.date.localeCompare(a.date));
  const totalHours = filtered.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  const byProject = {}, byMember = {}, byCategory = {};
  filtered.forEach(e => { const pN = projectMap[e.projectId]?.name || "Unknown"; byProject[pN] = (byProject[pN] || 0) + (parseFloat(e.hours) || 0); byMember[e.member] = (byMember[e.member] || 0) + (parseFloat(e.hours) || 0); byCategory[e.category || "Other"] = (byCategory[e.category || "Other"] || 0) + (parseFloat(e.hours) || 0); });
  const weeks = [...new Set(timesheets.map(e => getWeekKey(e.date)))].sort().reverse();
  function handleAdd() { if (!member || !projectId || !hours || !date) return; onAdd({ member, projectId, date, hours: parseFloat(hours), category, description: description.trim() }); setHours(""); setDescription(""); }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Log hours for each team member against their assigned projects.</p>
      <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><CalendarDays size={15} style={{ color: "#6366f1" }} /> Log Time Entry</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div><label style={lS}>Team Member *</label><select style={iS} value={member} onChange={e => setMember(e.target.value)}><option value="">Select member</option>{teamRoster.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></div>
          <div><label style={lS}>Project *</label><select style={iS} value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Select project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.customer}</option>)}</select></div>
          <div><label style={lS}>Date *</label><input type="date" style={iS} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label style={lS}>Hours *</label><input type="number" step="0.25" min="0" max="24" style={iS} value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g., 8" /></div>
          <div><label style={lS}>Category</label><select style={iS} value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={lS}>Description</label><input style={iS} value={description} onChange={e => setDescription(e.target.value)} placeholder="What was done?" /></div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={handleAdd} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: member && projectId && hours && date ? 1 : 0.4 }}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Log Hours</span></button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <select style={{ ...iS, width: "auto", flex: "0 0 auto" }} value={filterMember} onChange={e => setFilterMember(e.target.value)}><option value="all">All Members</option>{teamRoster.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
        <select style={{ ...iS, width: "auto", flex: "0 0 auto" }} value={filterProject} onChange={e => setFilterProject(e.target.value)}><option value="all">All Projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select style={{ ...iS, width: "auto", flex: "0 0 auto" }} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}><option value="all">All Weeks</option>{weeks.map(w => <option key={w} value={w}>Week of {w}</option>)}</select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>{[{ id: "entries", label: "Entries" }, { id: "summary", label: "Summary" }].map(v => (<button key={v.id} onClick={() => setSummaryView(v.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #1e293b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: summaryView === v.id ? "#6366f1" : "transparent", color: summaryView === v.id ? "#fff" : "#94a3b8" }}>{v.label}</button>))}</div>
      </div>
      <div style={{ background: "#1a2332", borderRadius: 10, border: "1px solid #1e293b", padding: "12px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#94a3b8" }}>Showing {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>{totalHours.toFixed(1)} hrs</span>
      </div>
      {summaryView === "entries" ? (
        <div>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#334155", fontSize: 13 }}>No time entries yet.</div>}
          {filtered.map(entry => (<div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#1a2332", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}><div style={{ width: 40, height: 40, borderRadius: 8, background: "#6366f122", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8", fontWeight: 700, fontSize: 14, fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}>{entry.hours}h</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}><span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{entry.member}</span><span style={{ fontSize: 11, color: "#475569" }}>•</span><span style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{projectMap[entry.projectId]?.name || "Unknown"}</span></div><div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}><span>{entry.date}</span><span style={{ padding: "1px 6px", borderRadius: 4, background: "#0f1729", color: "#94a3b8" }}>{entry.category}</span>{entry.description && <span style={{ color: "#475569" }}>— {entry.description}</span>}</div></div><button onClick={() => onRemove(entry.id)} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", flexShrink: 0 }}><X size={14} /></button></div>))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hours by Project</div>{Object.entries(byProject).sort((a, b) => b[1] - a[1]).map(([n, h]) => (<div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #0f1729", fontSize: 13 }}><span style={{ color: "#e2e8f0" }}>{n}</span><span style={{ color: "#818cf8", fontWeight: 600 }}>{h.toFixed(1)}h</span></div>))}{Object.keys(byProject).length === 0 && <div style={{ fontSize: 12, color: "#334155" }}>No data</div>}</div>
          <div style={{ background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hours by Team Member</div>{Object.entries(byMember).sort((a, b) => b[1] - a[1]).map(([n, h]) => (<div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #0f1729", fontSize: 13 }}><span style={{ color: "#e2e8f0" }}>{n}</span><span style={{ color: "#10b981", fontWeight: 600 }}>{h.toFixed(1)}h</span></div>))}{Object.keys(byMember).length === 0 && <div style={{ fontSize: 12, color: "#334155" }}>No data</div>}</div>
          <div style={{ gridColumn: "1/-1", background: "#1a2332", borderRadius: 12, border: "1px solid #1e293b", padding: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hours by Category</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, hrs]) => { const pct = totalHours > 0 ? (hrs / totalHours * 100).toFixed(0) : 0; return (<div key={cat} style={{ background: "#0f1729", borderRadius: 8, padding: "10px 14px", minWidth: 120 }}><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{cat}</div><div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>{hrs.toFixed(1)}</span><span style={{ fontSize: 11, color: "#64748b" }}>hrs ({pct}%)</span></div></div>); })}</div>{Object.keys(byCategory).length === 0 && <div style={{ fontSize: 12, color: "#334155" }}>No data</div>}</div>
        </div>
      )}
    </div>
  );
}

/* ─── PHASE SETTINGS ─── */
function PhaseSettings({ phases, newPhaseName, setNewPhaseName, newPhaseColor, setNewPhaseColor, onAdd, onRemove, onMoveUp, onMoveDown }) {
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1e293b", background: "#1a2332", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const colorOptions = ["#6366f1", "#8b5cf6", "#3b82f6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6b7280", "#14b8a6"];
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px" }}>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Customize your project phases.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <input style={{ ...iS, flex: 1 }} placeholder="New phase name" value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onAdd(); }} />
        <div style={{ display: "flex", gap: 4 }}>{colorOptions.map(c => (<button key={c} onClick={() => setNewPhaseColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: newPhaseColor === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", flexShrink: 0 }} />))}</div>
        <button onClick={onAdd} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}><Plus size={15} /></button>
      </div>
      <div style={{ marginTop: 16 }}>
        {phases.map((phase, idx) => (<div key={phase.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#1a2332", borderRadius: 10, border: "1px solid #1e293b", marginBottom: 6 }}><div style={{ width: 14, height: 14, borderRadius: "50%", background: phase.color, flexShrink: 0 }} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#fff" }}>{phase.name}</span><button onClick={() => onMoveUp(idx)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><ChevronUp size={16} /></button><button onClick={() => onMoveDown(idx)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><ChevronDown size={16} /></button><button onClick={() => onRemove(phase.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={16} /></button></div>))}
      </div>
    </div>
  );
}
