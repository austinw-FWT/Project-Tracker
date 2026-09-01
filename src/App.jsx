import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Users, Settings, LayoutGrid, Search, ArrowLeft, Layers, CalendarDays, Wifi, WifiOff, RefreshCw, Zap, LogOut, Shield, UserCheck, UserX, User, Clock, ChevronDown, ChevronUp, Home, BookUser, ShieldCheck, Zap as ZapIcon, Copy, Menu } from "lucide-react";
import { auth, googleProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, onAuthStateChanged, signOut, updateProfile } from "./firebase.js";
import DailyTracker from "./DailyTracker.jsx";
import MyDailyLog from "./MyDailyLog.jsx";
import Opportunities from "./Opportunities.jsx";
import ProjectDetail from "./ProjectDetail.jsx";
import TimesheetView from "./TimesheetView.jsx";
import Dashboard from "./Dashboard.jsx";
import Contacts from "./Contacts.jsx";
import WarrantyTracker from "./WarrantyTracker.jsx";
import MigrationTool from "./MigrationTool.jsx";
import FieldMode from "./FieldMode.jsx";
import PriceBook from "./PriceBook.jsx";
import ProjectImport from "./ProjectImport.jsx";
import { resolveJobRole, getPermissions, JOB_ROLES, ROLE_LABEL, ROLE_COLOR } from "./permissions.js";
import Briefing from "./Briefing.jsx";

import {
  FB_URL, dbGet, readTracker, putSection, putScheduleDay,
  putProject, patchProject, deleteProject as dbDeleteProject,
  putProjectDailyLog, putMemberPrivate,
  putCatalogItem, deleteCatalogItem, putAssembly, deleteAssembly, putEstimatingDefaults,
  readInvite, putInvite, patchInvite, deleteInvite, listInvites, genInviteCode,
  scheduleEntries,
  readUsers, putUser, deleteUser as dbDeleteUser,
  normalizeTracker, denormalizeProjectUpdates,
} from "./db.js";

const DB_PATH = "/tracker";

const DEFAULT_PHASES = [
  { id: "awarded", name: "Awarded", color: "#10b981" },
  { id: "installation", name: "Installation", color: "#f59e0b" },
  { id: "punch-list", name: "Punch List", color: "#ef4444" },
  { id: "closeout", name: "Closeout", color: "#6b7280" },
];
export const PROJECT_TYPES = ["Access Control", "Video Surveillance", "Intrusion Detection", "Structured Cabling", "Network Infrastructure"];
export const LABOR_PHASES = [
  { id: "rough-in", name: "Rough In" }, { id: "trim-out", name: "Trim Out" }, { id: "head-in", name: "Head In" },
  { id: "programming", name: "Programming" }, { id: "commissioning", name: "System Commissioning" },
  { id: "training", name: "Customer Training" }, { id: "pm", name: "Project Management" }, { id: "misc", name: "Miscellaneous" },
];
export const MATERIAL_STATUSES = ["Pending Quote", "Quoted", "PO Issued", "Ordered", "Backordered", "Shipped", "Delivered", "Installed", "Returned"];
export const TASK_CATEGORIES = [
  { id: "priority", label: "Today's #1 Priority", icon: "🎯" },
  { id: "hotlist", label: "Hot List", icon: "🔥" },
  { id: "bids", label: "Bids & Estimates", icon: "📐" },
  { id: "projects", label: "Active Projects", icon: "🏗️" },
  { id: "comms", label: "Calls & Emails", icon: "📞" },
  { id: "orders", label: "Orders & Submittals", icon: "📦" },
  { id: "scheduling", label: "Scheduling", icon: "📅" },
];
export const EMPTY_PROJECT = { id: "", name: "", jobNumber: "", customer: "", contactName: "", contactPhone: "", contactEmail: "", siteAddress: "", projectTypes: [], phaseId: "awarded", type: "retrofit", scopeNotes: "", bidAmount: "", contractAmount: "", devices: [], cableRuns: [], tasks: [], documents: [], notes: [], teamMembers: [], laborHours: null, laborAdjustments: null, siteInfo: null, materials: [], invoices: [], dailyLogs: [], createdAt: "", updatedAt: "" };

export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const DEFAULTS = { projects: [], phases: DEFAULT_PHASES, teamRoster: [], schedule: {}, memberPrivate: {}, contacts: [], adminSettings: { predefinedEmail: "" } };

const PROJECT_TEMPLATES = [
  { name: "Access Control Retrofit", projectTypes: ["Access Control"], type: "retrofit", tasks: [{ text: "Site survey — verify door hardware", category: "projects" }, { text: "Program controllers", category: "programming" }, { text: "Enroll credentials", category: "programming" }, { text: "Test all doors", category: "commissioning" }, { text: "Customer training", category: "training" }], devices: [{ name: "Card Reader", qty: "1", location: "" }, { name: "Door Controller", qty: "1", location: "" }, { name: "Electric Strike", qty: "1", location: "" }] },
  { name: "Video Surveillance Retrofit", projectTypes: ["Video Surveillance"], type: "retrofit", tasks: [{ text: "Camera placement walkthrough", category: "projects" }, { text: "Run cable pathways", category: "projects" }, { text: "Mount and aim cameras", category: "projects" }, { text: "Configure NVR", category: "programming" }, { text: "Set up remote viewing", category: "programming" }, { text: "Customer training", category: "training" }], devices: [{ name: "IP Camera", qty: "1", location: "" }, { name: "NVR", qty: "1", location: "MDF" }] },
  { name: "Structured Cabling — New Construction", projectTypes: ["Structured Cabling"], type: "new-construction", tasks: [{ text: "Review floor plans / drawings", category: "bids" }, { text: "Rough-in cable pathways", category: "projects" }, { text: "Pull cables", category: "projects" }, { text: "Terminate patch panels", category: "projects" }, { text: "Test and certify", category: "commissioning" }, { text: "As-built documentation", category: "projects" }], devices: [{ name: "Cat6 Cable (boxes)", qty: "1", location: "" }, { name: "Patch Panel 24-port", qty: "1", location: "MDF" }] },
  { name: "Intrusion Detection System", projectTypes: ["Intrusion Detection"], type: "retrofit", tasks: [{ text: "Zone planning", category: "projects" }, { text: "Install sensors", category: "projects" }, { text: "Program alarm panel", category: "programming" }, { text: "Central station setup", category: "programming" }, { text: "Test all zones", category: "commissioning" }, { text: "Customer training", category: "training" }], devices: [{ name: "Alarm Panel", qty: "1", location: "" }, { name: "Motion Sensor", qty: "1", location: "" }, { name: "Door Contact", qty: "1", location: "" }] },
];

async function getToken() { if (!auth.currentUser) return null; return await auth.currentUser.getIdToken(); }
// Reads/writes now go through db.js (path-level). These thin wrappers keep
// the existing call sites readable.
const fbRead = readTracker;
const fbReadUsers = async () => (await readUsers()) || {};
const fbWriteUser = putUser;
const fbDeleteUser = dbDeleteUser;

/* ═══ MOBILE HOOK ═══ */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

/* ═══ AUTH WRAPPER ═══ */
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRecord, setUserRecord] = useState(null);
  const [checkingApproval, setCheckingApproval] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        setCheckingApproval(true);
        try {
          // Read only OUR record — security rules allow self-read but block
          // unapproved users from listing everyone.
          const existing = await dbGet(`/users/${u.uid}`);
          if (existing) {
            // Already signed up (probably sitting in the pending queue) and
            // now opening an invite link — redeem it rather than ignore it.
            let rec = existing;
            const code = captureInviteFromUrl();
            if (code && existing.status !== "approved") {
              try {
                const inv = await readInvite(code);
                const expired = inv?.expiresAt && new Date(inv.expiresAt) < new Date();
                if (inv && !inv.usedBy && !expired) {
                  const upgraded = { ...existing, status: "approved", role: inv.accountRole === "admin" ? "admin" : "member", inviteCode: code };
                  await fbWriteUser(u.uid, upgraded);
                  await patchInvite(code, { usedBy: u.uid, usedAt: new Date().toISOString(), usedEmail: u.email });
                  try { sessionStorage.setItem("fwt-invite-link", JSON.stringify({ memberId: inv.memberId || "", name: inv.name || "", jobRole: inv.jobRole || "tech" })); } catch {}
                  rec = upgraded;
                }
              } catch { /* invalid or spent code — leave them pending */ }
              try { sessionStorage.removeItem(INVITE_KEY); } catch {}
            }
            setUserRecord(rec);
          }
          else {
            // Bootstrap: the rules permit an admin/approved self-write ONLY
            // when /users is empty (first user ever). Try it; if the rules
            // reject it, we're not first — create a pending record instead.
            const base = { email: u.email, displayName: u.displayName || u.email, createdAt: new Date().toISOString() };
            let nr = null;

            // 1) Invited? Redeem it — the rules let an invitee self-approve
            //    only when they present a valid, unused, unexpired code.
            const code = captureInviteFromUrl();
            if (code) {
              try {
                const inv = await readInvite(code);
                const expired = inv?.expiresAt && new Date(inv.expiresAt) < new Date();
                if (inv && !inv.usedBy && !expired) {
                  const candidate = { ...base, status: "approved", role: inv.accountRole === "admin" ? "admin" : "member", inviteCode: code };
                  await fbWriteUser(u.uid, candidate);
                  await patchInvite(code, { usedBy: u.uid, usedAt: new Date().toISOString(), usedEmail: u.email });
                  nr = candidate;
                  try { sessionStorage.setItem("fwt-invite-link", JSON.stringify({ memberId: inv.memberId || "", name: inv.name || "", jobRole: inv.jobRole || "tech" })); } catch {}
                }
              } catch { /* bad or already-used code → fall through to normal flow */ }
              try { sessionStorage.removeItem(INVITE_KEY); } catch {}
            }

            // 2) First user ever bootstraps as admin; the rules reject this
            //    for everyone after, and they land as pending for approval.
            if (!nr) {
              nr = { ...base, status: "approved", role: "admin" };
              try { await fbWriteUser(u.uid, nr); }
              catch {
                nr = { ...base, status: "pending", role: "member" };
                await fbWriteUser(u.uid, nr);
              }
            }
            setUserRecord(nr);
          }
        } catch { setUserRecord({ status: "error" }); }
        setCheckingApproval(false);
      } else { setUserRecord(null); }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  if (authLoading || checkingApproval) return <LoadingScreen text="Loading..." />;
  if (!user) return <LoginScreen />;
  if (!userRecord || userRecord.status === "pending") return <PendingScreen user={user} error={userRecord?.status === "error"} />;
  return <Tracker user={user} userRecord={userRecord} />;
}

function LoadingScreen({ text }) {
  return (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A192F", color: "#94a3b8", fontFamily: "'DM Sans',sans-serif" }}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
    <div style={{ textAlign: "center" }}><img src="/FWT_LOGO_FULL.png" alt="FWT" style={{ width: 60, height: 60, objectFit: "contain", marginBottom: 12 }} onError={e => { e.target.style.display = "none"; }} /><div>{text}</div></div>
  </div>);
}

/* ═══ LOGIN ═══ */
const INVITE_KEY = "fwt-pending-invite";
/** Pull ?invite=CODE out of the URL, stash it, and clean the address bar so
    the code isn't left sitting in history or copied into a screenshot. */
function captureInviteFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) {
      sessionStorage.setItem(INVITE_KEY, code);
      params.delete("invite");
      const clean = window.location.pathname + (params.toString() ? "?" + params : "");
      window.history.replaceState({}, "", clean);
      return code;
    }
    return sessionStorage.getItem(INVITE_KEY);
  } catch { return null; }
}

function LoginScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function handleEmail(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      if (mode === "register") { const c = await createUserWithEmailAndPassword(auth, email, password); if (displayName.trim()) await updateProfile(c.user, { displayName: displayName.trim() }); }
      else { await signInWithEmailAndPassword(auth, email, password); }
    } catch (err) { setError(err.code === "auth/invalid-credential" ? "Invalid email or password" : err.code === "auth/email-already-in-use" ? "Account exists" : err.code === "auth/weak-password" ? "Password must be 6+ characters" : err.message); }
    setLoading(false);
  }
  async function handleGoogle() { setError(""); setLoading(true); try { await signInWithPopup(auth, googleProvider); } catch (err) { setError(err.message); } setLoading(false); }
  const iS = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0A192F", fontFamily: "'DM Sans',sans-serif", padding: 16 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/FWT_LOGO_FULL.png" alt="Far West Technologies" style={{ width: 120, height: 120, objectFit: "contain", marginBottom: 16 }} onError={e => { e.target.style.display = "none"; }} />
          <div style={{ height: 3, width: 60, background: "#69BE28", borderRadius: 2, margin: "0 auto 14px" }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: "0 0 4px", letterSpacing: "0.02em" }}>FWT Workspaces</h1>
          <p style={{ fontSize: 13, color: "#A5ACAF", margin: 0 }}>Far West Technologies Project Management</p>
        </div>
        <div style={{ background: "#0F2444", borderRadius: 16, border: "1px solid #1A3050", padding: 24 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {["login", "register"].map(m => (<button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: mode === m ? "#69BE28" : "transparent", color: mode === m ? "#fff" : "#64748b" }}>{m === "login" ? "Sign In" : "Register"}</button>))}
          </div>
          {mode === "register" && <div style={{ marginBottom: 12 }}><label style={lS}>Full Name</label><input style={iS} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="John Smith" /></div>}
          <div style={{ marginBottom: 12 }}><label style={lS}>Email</label><input style={iS} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></div>
          <div style={{ marginBottom: 16 }}><label style={lS}>Password</label><input style={iS} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => { if (e.key === "Enter") handleEmail(e); }} /></div>
          {error && <div style={{ padding: "10px 12px", borderRadius: 8, background: "#7f1d1d22", border: "1px solid #7f1d1d", color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button onClick={handleEmail} disabled={loading} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#69BE28", color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1, marginBottom: 12 }}>{loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}</button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}><div style={{ flex: 1, height: 1, background: "#1A3050" }} /><span style={{ fontSize: 11, color: "#475569" }}>or</span><div style={{ flex: 1, height: 1, background: "#1A3050" }} /></div>
          <button onClick={handleGoogle} disabled={loading} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingScreen({ user, error }) {
  return (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A192F", fontFamily: "'DM Sans',sans-serif", padding: 16 }}>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
    <div style={{ width: "100%", maxWidth: 420, padding: 32, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: error ? "#7f1d1d22" : "#f59e0b22", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: error ? "#ef4444" : "#f59e0b" }}><Clock size={28} /></div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: "0 0 8px" }}>{error ? "Connection Error" : "Awaiting Approval"}</h2>
      <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 24px" }}>{error ? "Unable to verify your account." : `Your account (${user.email}) is pending admin approval.`}</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={() => window.location.reload()} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #1A3050", background: "#0F2444", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Refresh</button>
        <button onClick={() => signOut(auth)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Sign Out</button>
      </div>
    </div>
  </div>);
}

/* ═══ MAIN TRACKER ═══ */
function Tracker({ user, userRecord }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [mySpaceTab, setMySpaceTab] = useState("daily");
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [dragItem, setDragItem] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState(""); const [newPhaseColor, setNewPhaseColor] = useState("#69BE28");
  const [newTeamName, setNewTeamName] = useState(""); const [newTeamRole, setNewTeamRole] = useState("");
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [lastSync, setLastSync] = useState(null);
  const [syncPulse, setSyncPulse] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const eventSourceRef = useRef(null);
  const isSaving = useRef(false);
  const latestData = useRef(null);
  const isAdmin = userRecord.role === "admin";
  const accountName = user.displayName || user.email;
  /* Resolve this account to a roster entry. Everything downstream — schedule
     lookups, log attribution, timesheets, crew picker — uses the ROSTER name
     so the office and the field always agree on who someone is. */
  const rosterEntry = (data?.teamRoster || []).find(m => m.uid === user.uid)
    || (data?.teamRoster || []).find(m => m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase())
    || (data?.teamRoster || []).find(m => m.name === accountName);
  const myName = rosterEntry?.name || accountName;
  const jobRole = resolveJobRole(rosterEntry, isAdmin);
  const perms = getPermissions(jobRole);
  const isMobile = useIsMobile();

  useEffect(() => {
    let es = null, alive = true;
    async function init() {
      try {
        const remote = await fbRead();
        const d = normalizeTracker(remote, DEFAULTS);
        latestData.current = d;
        if (alive) {
          setData(d); setSyncStatus("synced"); setLastSync(new Date()); setLoading(false);
          // Identity is resolved against the roster by uid → email → exact
          // name (see rosterEntry below). We deliberately do NOT auto-create
          // a roster row from the account's display name: that produced a
          // duplicate ("Dennis" typed by the office vs "Dennis Martinez" from
          // Google), and since the schedule is keyed by roster name, the
          // duplicate left the tech with a permanently empty Today screen.
          // Unmatched users get the link screen instead.
        }
        if (!remote) await putSection("phases", DEFAULT_PHASES);
      } catch { if (alive) { setData(DEFAULTS); setSyncStatus("error"); setLoading(false); } }
      try {
        const token = await getToken();
        es = new EventSource(`${FB_URL}${DB_PATH}.json${token ? `?auth=${token}` : ""}`);
        eventSourceRef.current = es;
        es.onopen = () => { if (alive) setSyncStatus("synced"); };
        const handleUpdate = () => {
          if (!alive || isSaving.current) return;
          fbRead().then(full => {
            if (!alive || isSaving.current) return;
            const nd = normalizeTracker(full, DEFAULTS);
            latestData.current = nd; setData(nd);
            setSelectedProject(prev => prev ? nd.projects?.find(p => p.id === prev.id) || null : null);
            setSyncPulse(true); setTimeout(() => setSyncPulse(false), 1200); setLastSync(new Date());
          }).catch(() => {});
        };
        es.addEventListener("put", handleUpdate);
        es.addEventListener("patch", handleUpdate);
        es.onerror = () => { if (alive) setSyncStatus("reconnecting"); };
      } catch {}
    }
    init();
    return () => { alive = false; if (es) es.close(); };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      try {
        const token = await getToken();
        const es = new EventSource(`${FB_URL}${DB_PATH}.json${token ? `?auth=${token}` : ""}`);
        eventSourceRef.current = es;
        es.onopen = () => setSyncStatus("synced");
        const h = () => { if (isSaving.current) return; fbRead().then(full => { const nd = normalizeTracker(full, DEFAULTS); latestData.current = nd; setData(nd); setSyncPulse(true); setTimeout(() => setSyncPulse(false), 1200); setLastSync(new Date()); }).catch(() => {}); };
        es.addEventListener("put", h); es.addEventListener("patch", h);
        es.onerror = () => setSyncStatus("reconnecting");
      } catch {}
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  /* ── WRITE LAYER ──────────────────────────────────────────────
     applyLocal: optimistic local state update (UI responds instantly).
     persist:    fire the path-level write, drive the sync pill, and
                 briefly suppress the SSE echo of our own write.
     No call here ever PUTs the root — concurrent users can no longer
     overwrite each other's data. */
  const applyLocal = useCallback(newData => { latestData.current = newData; setData(newData); }, []);
  const persist = useCallback(writePromise => {
    isSaving.current = true; setSyncStatus("saving");
    // Returns the promise so callers that must confirm a real save (daily
    // log submit) can await it instead of assuming success.
    return Promise.resolve(writePromise)
      .then(r => { setSyncStatus("synced"); setLastSync(new Date()); return r; })
      .catch(e => { setSyncStatus("error"); throw e; })
      .finally(() => setTimeout(() => { isSaving.current = false; }, 1000));
  }, []);
  /** Small low-contention sections: phases, teamRoster, contacts, adminSettings. */
  const saveSection = useCallback((section, value, newData) => { applyLocal(newData); persist(putSection(section, value)); }, [applyLocal, persist]);

  function updateProject(pid, updates) {
    const stamped = { ...updates, updatedAt: new Date().toISOString() };
    const nd = { ...latestData.current, projects: latestData.current.projects.map(p => p.id === pid ? { ...p, ...stamped } : p) };
    applyLocal(nd);
    persist(patchProject(pid, denormalizeProjectUpdates(stamped)));
    setSelectedProject(prev => prev?.id === pid ? { ...prev, ...stamped } : prev);
  }
  function addProject(project) {
    const now = new Date().toISOString();
    const np = { ...EMPTY_PROJECT, ...project, id: project.id || genId(), phaseId: project.phaseId || data.phases[0]?.id || "awarded", createdAt: now, updatedAt: now };
    applyLocal({ ...latestData.current, projects: [...latestData.current.projects, np] });
    persist(putProject(np.id, denormalizeProjectUpdates(np)));
    setShowNewProject(false);
  }
  function deleteProject(pid) {
    applyLocal({ ...latestData.current, projects: latestData.current.projects.filter(p => p.id !== pid) });
    persist(dbDeleteProject(pid));
    setSelectedProject(null);
  }
  function handleDrop(phaseId, explicitProjectId) {
    // Two call patterns:
    //  - Drag-and-drop on desktop kanban: onDrop(phaseId), pulls from dragItem state
    //  - Tap "Move →" on mobile list view: onDrop(phaseId, projectId), explicit
    if (explicitProjectId) {
      const proj = data.projects.find(p => p.id === explicitProjectId);
      if (proj && proj.phaseId !== phaseId) updateProject(explicitProjectId, { phaseId });
      return;
    }
    if (dragItem && dragItem.phaseId !== phaseId) updateProject(dragItem.id, { phaseId });
    setDragItem(null);
  }
  // Field Mode: techs land here on mobile by default; admins opt in.
  const [fieldMode, setFieldMode] = useState(null);
  const fieldModeOn = fieldMode === null ? (perms.fieldFirst && isMobile) : fieldMode;

  /** Shared daily-log submit path — Field Mode and the classic My Daily Log
      screen both go through here, so the data is identical either way. */
  /** Returns a promise that REJECTS if the log did not actually reach
      Firebase. Callers must await it before telling a tech "saved" — a
      false confirmation in a dead zone loses hours and payroll data. */
  async function submitDailyLogs(updatedPersonalLogs, projectLogs) {
    const prev = latestData.current;
    const merged = { ...getMyPrivate(), dailyLogs: updatedPersonalLogs };
    let nd = { ...latestData.current, memberPrivate: { ...(latestData.current.memberPrivate || {}), [user.uid]: merged } };
    const writes = [putMemberPrivate(user.uid, merged)];
    (projectLogs || []).forEach(({ pid, log }) => {
      nd = { ...nd, projects: nd.projects.map(p => p.id === pid ? { ...p, dailyLogs: [log, ...(p.dailyLogs || [])], updatedAt: new Date().toISOString() } : p) };
      writes.push(putProjectDailyLog(pid, log));
    });
    applyLocal(nd);
    try {
      await persist(Promise.all(writes));
    } catch (e) {
      applyLocal(prev);   // don't leave a phantom log sitting in the UI
      throw e;
    }
  }

  /* Private space is keyed by uid (stable) with a fallback read of the
     legacy display-name key so pre-migration data still appears. */
  function getMyPrivate() {
    const mp = latestData.current?.memberPrivate || {};
    return mp[user.uid] || mp[myName] || {};
  }
  function saveMyPrivate(updates) {
    const merged = { ...getMyPrivate(), ...updates };
    const nd = { ...latestData.current, memberPrivate: { ...(latestData.current.memberPrivate || {}), [user.uid]: merged } };
    applyLocal(nd);
    persist(putMemberPrivate(user.uid, merged));
  }

  function assignTaskToMember(taskText, memberName, category) {
    const mpAll = latestData.current.memberPrivate || {};
    // Resolve the member's storage key: uid if they have an account, else legacy name key.
    const rosterEntry = (latestData.current.teamRoster || []).find(t => t.name === memberName);
    const uidKey = rosterEntry?.uid || Object.keys(mpAll).find(k => k === memberName) || memberName;
    const mp = mpAll[uidKey] || mpAll[memberName] || {};
    const dt = mp.dailyTracker || {};
    const sections = dt.dailySections || [];
    const secIdx = sections.findIndex(s => s.id === (category || "projects"));
    if (secIdx >= 0) {
      const ns = sections.map((s, i) => i === secIdx ? { ...s, items: [...s.items, { id: genId(), text: taskText, done: false }] } : s);
      const merged = { ...mp, dailyTracker: { ...dt, dailySections: ns } };
      applyLocal({ ...latestData.current, memberPrivate: { ...mpAll, [uidKey]: merged } });
      persist(putMemberPrivate(uidKey, merged));
    }
  }

  /** Quick Add with no project → my private Daily Task Board.
      Internal/company items land in the chosen board section (created if the
      board has never been opened); notes are prefixed 📝. */
  function addInternalItem(category, text, kind) {
    const mp = getMyPrivate();
    const dt = mp.dailyTracker || {};
    let sections = dt.dailySections || [];
    if (!sections.some(s => s.id === category)) {
      const meta = TASK_CATEGORIES.find(c => c.id === category);
      sections = [...sections, { id: category, label: meta?.label || category, icon: meta?.icon || "", items: [] }];
    }
    const item = { id: genId(), text: kind === "note" ? `📝 ${text}` : text, done: false };
    sections = sections.map(s => s.id === category ? { ...s, items: [...(s.items || []), item] } : s);
    saveMyPrivate({ dailyTracker: { ...dt, dailySections: sections } });
  }

  // Close sidebar when navigating on mobile
  function navigate(viewId, spaceTab) {
    setView(viewId);
    if (spaceTab) setMySpaceTab(spaceTab);
    setSelectedProject(null);
    if (isMobile) setSidebarOpen(false);
  }

  if (loading) return <LoadingScreen text="Connecting to Firebase..." />;
  if (!data) return null;

  // Legacy data format detected: path-level writes would corrupt an
  // array-shaped tree, so the app is gated until migration runs. Admins
  // see the migration tool; everyone else sees a hold message.
  if (data.legacyFormat) {
    const reload = async () => {
      try { const remote = await fbRead(); const d = normalizeTracker(remote, DEFAULTS); latestData.current = d; setData(d); } catch {}
    };
    return (
      <div style={{ minHeight: "100vh", background: "#0A192F", padding: "48px 20px", fontFamily: "'DM Sans',sans-serif" }}>
        {isAdmin ? (
          <MigrationTool onDone={reload} />
        ) : (
          <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🔧</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>Quick maintenance in progress</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8, lineHeight: 1.6 }}>The system is being upgraded — check back in a few minutes. Nothing is lost.</div>
          </div>
        )}
      </div>
    );
  }

  // An invite already said who this person is — bind them and skip the
  // picker entirely. Runs once; afterwards rosterEntry resolves by uid.
  if (!rosterEntry) {
    let pending = null;
    try { const raw = sessionStorage.getItem("fwt-invite-link"); if (raw) pending = JSON.parse(raw); } catch {}
    if (pending) {
      const roster = data.teamRoster || [];
      const target = pending.memberId ? roster.find(m => m.id === pending.memberId && !m.uid) : null;
      const next = target
        ? roster.map(m => m.id === target.id ? { ...m, uid: user.uid, email: m.email || user.email, jobRole: m.jobRole || pending.jobRole } : m)
        : [...roster, { id: genId(), name: pending.name || accountName, role: ROLE_LABEL[pending.jobRole] || "Technician", jobRole: pending.jobRole || "tech", email: user.email, uid: user.uid }];
      try { sessionStorage.removeItem("fwt-invite-link"); } catch {}
      saveSection("teamRoster", next, { ...latestData.current, teamRoster: next });
      return <LoadingScreen text="Setting up your account..." />;
    }
  }

  // Unlinked and uninvited: make the person pick who they are ONCE. Without
  // this the schedule (keyed by roster name) never matches and Field Mode
  // looks empty.
  if (!rosterEntry) {
    const unlinked = (data.teamRoster || []).filter(m => !m.uid);
    const linkTo = member => {
      const roster = (data.teamRoster || []).map(m => m.id === member.id ? { ...m, uid: user.uid, email: m.email || user.email } : m);
      saveSection("teamRoster", roster, { ...latestData.current, teamRoster: roster });
    };
    const addSelf = () => {
      const roster = [...(data.teamRoster || []), { id: genId(), name: accountName, role: isAdmin ? "Admin / PM" : "Technician", email: user.email, uid: user.uid }];
      saveSection("teamRoster", roster, { ...latestData.current, teamRoster: roster });
    };
    return (
      <div style={{ minHeight: "100vh", background: "#0A192F", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 16, padding: 26, width: "100%", maxWidth: 440 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif", marginBottom: 6 }}>Who are you?</div>
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 18 }}>
            Tap your name so your schedule, hours, and daily logs line up with the office. You only do this once.
          </div>
          {unlinked.map(m => (
            <button key={m.id} onClick={() => linkTo(m)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 58, padding: "0 16px", borderRadius: 12, border: "1px solid #1A3050", background: "#0A192F", cursor: "pointer", fontFamily: "inherit", marginBottom: 8, textAlign: "left" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#69BE2822", color: "#82CC4A", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15 }}>{(m.name || "?")[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{m.name}</div>
                {m.role && <div style={{ fontSize: 11.5, color: "#64748b" }}>{m.role}</div>}
              </div>
            </button>
          ))}
          {unlinked.length === 0 && <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>Everyone on the roster is already linked to an account.</div>}
          <button onClick={addSelf} style={{ width: "100%", minHeight: 48, borderRadius: 12, border: "1px dashed #1A3050", background: "transparent", color: "#94a3b8", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
            I'm not listed — add me as "{accountName}"
          </button>
          <div style={{ fontSize: 11.5, color: "#475569", marginTop: 14, lineHeight: 1.5 }}>Signed in as {user.email}. Picked wrong? An admin can fix it under Team.</div>
        </div>
      </div>
    );
  }

  if (fieldModeOn) {
    return <FieldMode
      projects={data.projects}
      teamRoster={data.teamRoster || []}
      schedule={data.schedule || {}}
      myName={myName}
      myLogs={getMyPrivate().dailyLogs || []}
      onSubmit={submitDailyLogs}
      onOpenFullApp={() => setFieldMode(false)}
      onUpdateProject={updateProject}
      perms={perms}
      isAdmin={isAdmin}
    />;
  }

  const filteredProjects = data.projects.filter(p =>
    !p.movedToWarranty &&
    (!searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.customer.toLowerCase().includes(searchTerm.toLowerCase()) || (p.jobNumber || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const phaseMap = {}; data.phases.forEach(ph => { phaseMap[ph.id] = ph; });

  const sC = { connecting: { c: "#f59e0b", t: "Connecting...", s: true }, synced: { c: "#10b981", t: "Live", s: false }, saving: { c: "#69BE28", t: "Saving...", s: true }, reconnecting: { c: "#f59e0b", t: "Reconnecting...", s: true }, error: { c: "#ef4444", t: "Offline", s: false } }[syncStatus] || { c: "#10b981", t: "Live", s: false };

  const navItems = [
    { id: "dashboard", icon: Home, label: "Dashboard" },
    { id: "board", icon: LayoutGrid, label: "Project Board" },
    { id: "schedule", icon: CalendarDays, label: "Team Schedule" },
    { id: "contacts", icon: BookUser, label: "Contacts" },
    { id: "warranties", icon: ShieldCheck, label: "Warranties" },
    { id: "team", icon: Users, label: "Team" },
    { id: "settings", icon: Settings, label: "Phases" },
    ...(isAdmin ? [{ id: "admin", icon: Shield, label: "User Admin" }] : []),
  ];

  const mySpaceItems = [
    { id: "briefing", label: "The Briefing", icon: "🧭" },
    { id: "daily", label: "Daily Task Board", icon: "📋" },
    { id: "dailylog", label: "Daily Log", icon: "📝" },
    ...(perms.seeEstimating ? [
      { id: "opportunities", label: "Opportunities", icon: "🎯" },
      { id: "pricebook", label: "Price Book", icon: "💲" },
      { id: "import", label: "Import Projects", icon: "📥" },
    ] : []),
    { id: "timesheets", label: "My Timesheets", icon: "⏱️" },
  ];

  const currentPageTitle = selectedProject ? selectedProject.name
    : view === "myspace" ? (mySpaceTab === "briefing" ? "The Briefing" : mySpaceTab === "daily" ? "Daily Task Board" : mySpaceTab === "dailylog" ? "Daily Log" : mySpaceTab === "opportunities" ? "Opportunities" : mySpaceTab === "pricebook" ? "Price Book" : mySpaceTab === "import" ? "Import Projects" : "My Timesheets")
    : view === "team" ? "Team Roster" : view === "schedule" ? "Team Schedule" : view === "admin" ? "User Admin"
    : view === "contacts" ? "Contacts" : view === "warranties" ? "Warranties" : view === "dashboard" ? "Dashboard"
    : view === "board" ? "Project Board" : "Phase Settings";

  const SidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #1A3050", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/FWT_LOGO_FULL.png" alt="FWT" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4 }} onError={e => { e.target.style.display = "none"; }} />
          <div>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 16, fontWeight: 800, color: "#fff" }}>FWT Workspaces</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Project Management</div>
          </div>
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 8px", flex: 1, overflowY: "auto" }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => navigate(item.id)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: isMobile ? "13px 12px" : "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: view === item.id && !selectedProject ? "#1A3050" : "transparent", color: view === item.id && !selectedProject ? "#fff" : "#94a3b8", marginBottom: 2, fontFamily: "inherit" }}>
            <item.icon size={16} />{item.label}
          </button>
        ))}

        <button onClick={() => setFieldMode(true)} style={{ display: "flex", alignItems: "center", gap: 10, width: "calc(100% - 16px)", margin: "12px 8px 0", padding: "11px 12px", borderRadius: 10, border: "1.5px solid #69BE28", background: "#69BE2815", color: "#82CC4A", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", minHeight: 44 }}>
          <span>⚡</span> Field Mode
        </button>
        <div style={{ padding: "16px 12px 6px", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>My Space</div>
        {mySpaceItems.map(item => (
          <button key={item.id} onClick={() => navigate("myspace", item.id)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: isMobile ? "12px 12px" : "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: view === "myspace" && mySpaceTab === item.id ? "#1A3050" : "transparent", color: view === "myspace" && mySpaceTab === item.id ? "#fff" : "#64748b", marginBottom: 1, fontFamily: "inherit" }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1A3050" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: sC.c }} />
          <RefreshCw size={12} style={{ color: sC.c, animation: sC.s ? "spin 1s linear infinite" : "none" }} />
          <span style={{ fontSize: 11, color: sC.c, fontWeight: 600 }}>{sC.t}</span>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#69BE28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{myName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myName}</div>
            {isAdmin && <div style={{ fontSize: 9, color: "#69BE28", fontWeight: 700, textTransform: "uppercase" }}>Admin</div>}
          </div>
          <button onClick={() => signOut(auth)} title="Sign out" style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4 }}><LogOut size={14} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans',sans-serif", background: "#0A192F", color: "#e2e8f0", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
      {/* Mobile-friendly overrides — bumps form controls to touch-friendly sizes on phones.
          16px input font also prevents iOS auto-zoom on input focus. */}
      <style>{`
        @media (max-width: 768px) {
          input, select, textarea {
            font-size: 16px !important;
            min-height: 44px;
            box-sizing: border-box;
          }
          input[type="checkbox"], input[type="radio"] {
            min-height: 0 !important;
            width: 20px;
            height: 20px;
          }
          input[type="date"], input[type="time"], input[type="datetime-local"] {
            min-height: 44px;
          }
          textarea {
            min-height: 88px;
          }
          button {
            min-height: 40px;
            font-size: 13px;
          }
          /* Buttons that are clearly icon-only (small fixed size) keep their dimensions */
          button[style*="width: 22px"], button[style*="width: 24px"],
          button[style*="width: 28px"], button[style*="width: 30px"],
          button[style*="width: 32px"], button[style*="width: 36px"] {
            min-height: 0;
          }
          /* Modal dialogs become full-screen-ish on phones */
          [data-mobile-fullscreen="true"] {
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />
      )}

      {/* Sidebar — desktop: always visible, mobile: slide-in drawer */}
      {isMobile ? (
        <div style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: 260,
          background: "#001528", borderRight: "1px solid #1A3050",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease", zIndex: 50, display: "flex", flexDirection: "column"
        }}>
          {SidebarContent}
        </div>
      ) : (
        <div style={{ width: 220, background: "#001528", borderRight: "1px solid #1A3050", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {SidebarContent}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ padding: isMobile ? "10px 16px" : "12px 24px", borderBottom: "1px solid #1A3050", display: "flex", alignItems: "center", gap: 10, background: "#0A192F", flexShrink: 0 }}>
          {/* Hamburger on mobile */}
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4, flexShrink: 0 }}>
              <Menu size={22} />
            </button>
          )}

          {selectedProject ? (
            <button onClick={() => setSelectedProject(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
              <ArrowLeft size={16} />{!isMobile && "Back to Board"}
            </button>
          ) : null}

          {!selectedProject && view === "board" && !isMobile ? (
            <>
              <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search name, customer, job #..." style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, border: "1px solid #1A3050", background: "#1A3050", color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              </div>
              <button onClick={() => setShowNewProject(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /> New Project</button>
            </>
          ) : (
            <div style={{ fontSize: isMobile ? 15 : 15, fontWeight: 600, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentPageTitle}
            </div>
          )}

          {/* Mobile board actions */}
          {isMobile && view === "board" && !selectedProject && (
            <button onClick={() => setShowNewProject(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", cursor: "pointer", flexShrink: 0 }}>
              <Plus size={18} />
            </button>
          )}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {selectedProject ? (
            <ProjectDetail perms={perms} project={selectedProject} phases={data.phases} phaseMap={phaseMap} teamRoster={data.teamRoster} onUpdate={u => updateProject(selectedProject.id, u)} onDelete={() => deleteProject(selectedProject.id)} detailTab={detailTab} setDetailTab={setDetailTab} assignTaskToMember={assignTaskToMember} />
          ) : view === "dashboard" ? (
            <Dashboard perms={perms} teamRoster={data.teamRoster || []} data={data} myName={myName} onSelectProject={p => { setSelectedProject(p); setDetailTab("overview"); }} onNavigate={(v, tab) => { setView(v); if (tab) setMySpaceTab(tab); }} />
          ) : view === "board" ? (
            <KanbanBoard projects={filteredProjects} phases={data.phases} onSelectProject={p => { setSelectedProject(p); setDetailTab("overview"); }} onDragStart={setDragItem} onDrop={handleDrop} dragItem={dragItem} isMobile={isMobile} />
          ) : view === "contacts" ? (
            <Contacts contacts={data.contacts || []} projects={data.projects} onSave={c => saveSection("contacts", c, { ...latestData.current, contacts: c })} />
          ) : view === "warranties" ? (
            <WarrantyTracker projects={data.projects} onUpdateProject={(pid, u) => updateProject(pid, u)} />
          ) : view === "myspace" && mySpaceTab === "briefing" ? (
            <Briefing data={data} myPrivate={getMyPrivate()} myName={myName} isMobile={isMobile}
              onUpdateProject={updateProject} onSaveMyPrivate={saveMyPrivate}
              onSelectProject={(p, tab) => { setSelectedProject(p); setDetailTab(tab || "overview"); }}
              onNavigate={navigate} />
          ) : view === "myspace" && mySpaceTab === "daily" ? (
            <DailyTracker data={getMyPrivate().dailyTracker} archivedDays={getMyPrivate().archivedDays || []} onSave={dt => saveMyPrivate({ dailyTracker: dt })} onArchive={archive => saveMyPrivate({ archivedDays: archive })} />
          ) : view === "myspace" && mySpaceTab === "dailylog" ? (
            <MyDailyLog dailyLogs={getMyPrivate().dailyLogs || []} projects={data.projects} teamRoster={data.teamRoster} myName={myName} myEmail={user.email} predefinedEmail={data.adminSettings?.predefinedEmail || ""}
              onSubmit={submitDailyLogs}
              onDeleteLog={logs => saveMyPrivate({ dailyLogs: logs })} />
          ) : view === "myspace" && mySpaceTab === "import" && perms.seeEstimating ? (
            <ProjectImport existingProjects={data.projects} isMobile={isMobile} onAddProject={addProject} />
          ) : view === "myspace" && mySpaceTab === "pricebook" && perms.seeEstimating ? (
            <PriceBook catalog={data.catalog || {}} assemblies={data.assemblies || {}} defaults={data.estimatingDefaults || {}} isMobile={isMobile}
              onSaveItem={item => { applyLocal({ ...latestData.current, catalog: { ...(latestData.current.catalog || {}), [item.id]: item } }); persist(putCatalogItem(item.id, item)); }}
              onDeleteItem={id => { const c = { ...(latestData.current.catalog || {}) }; delete c[id]; applyLocal({ ...latestData.current, catalog: c }); persist(deleteCatalogItem(id)); }}
              onSaveAssembly={a => { applyLocal({ ...latestData.current, assemblies: { ...(latestData.current.assemblies || {}), [a.id]: a } }); persist(putAssembly(a.id, a)); }}
              onDeleteAssembly={id => { const a = { ...(latestData.current.assemblies || {}) }; delete a[id]; applyLocal({ ...latestData.current, assemblies: a }); persist(deleteAssembly(id)); }}
              onSaveDefaults={d => { applyLocal({ ...latestData.current, estimatingDefaults: d }); persist(putEstimatingDefaults(d)); }} />
          ) : view === "myspace" && mySpaceTab === "opportunities" && perms.seeEstimating ? (
            <Opportunities catalog={data.catalog || {}} assemblies={data.assemblies || {}} estDefaults={data.estimatingDefaults || {}} onSaveCatalogItem={item => { applyLocal({ ...latestData.current, catalog: { ...(latestData.current.catalog || {}), [item.id]: item } }); persist(putCatalogItem(item.id, item)); }} opportunities={getMyPrivate().opportunities || []} onSave={opps => saveMyPrivate({ opportunities: opps })} onConvert={opp => addProject({ ...opp, phaseId: "awarded" })} />
          ) : view === "myspace" && mySpaceTab === "timesheets" ? (
            <TimesheetView timesheets={getMyPrivate().timesheets || []} projects={data.projects} myName={myName} myEmail={user.email} predefinedEmail={data.adminSettings?.predefinedEmail || ""} isAdmin={isAdmin} allMemberPrivate={isAdmin ? (data.memberPrivate || {}) : null} teamRoster={data.teamRoster}
              onAdd={entry => saveMyPrivate({ timesheets: [...(getMyPrivate().timesheets || []), { ...entry, id: genId(), member: myName, createdAt: new Date().toISOString() }] })}
              onRemove={id => saveMyPrivate({ timesheets: (getMyPrivate().timesheets || []).filter(t => t.id !== id) })} />
          ) : view === "schedule" ? (
            <ScheduleView schedule={data.schedule || {}} teamRoster={data.teamRoster} projects={data.projects} onUpdate={(s, changedDate) => { applyLocal({ ...latestData.current, schedule: s }); persist(changedDate ? putScheduleDay(changedDate, s[changedDate] || null) : putSection("schedule", s)); }} />
          ) : view === "team" ? (
            <TeamView teamRoster={data.teamRoster} newTeamName={newTeamName} setNewTeamName={setNewTeamName} newTeamRole={newTeamRole} setNewTeamRole={setNewTeamRole}
              onAdd={() => { if (!newTeamName.trim()) return; const r = [...data.teamRoster, { id: genId(), name: newTeamName.trim(), role: newTeamRole.trim() }]; saveSection("teamRoster", r, { ...latestData.current, teamRoster: r }); setNewTeamName(""); setNewTeamRole(""); }}
              onRemove={id => { const r = data.teamRoster.filter(t => t.id !== id); saveSection("teamRoster", r, { ...latestData.current, teamRoster: r }); }} />
          ) : view === "admin" && isAdmin ? (
            <UserAdminView teamRoster={data.teamRoster || []} />
          ) : (
            <PhaseSettings phases={data.phases} newPhaseName={newPhaseName} setNewPhaseName={setNewPhaseName} newPhaseColor={newPhaseColor} setNewPhaseColor={setNewPhaseColor}
              onAdd={() => { if (!newPhaseName.trim()) return; const ph = [...data.phases, { id: genId(), name: newPhaseName.trim(), color: newPhaseColor }]; saveSection("phases", ph, { ...latestData.current, phases: ph }); setNewPhaseName(""); }}
              onRemove={id => { const ph = data.phases.filter(p => p.id !== id); saveSection("phases", ph, { ...latestData.current, phases: ph }); }}
              onMoveUp={i => { if (i === 0) return; const np = [...data.phases]; [np[i - 1], np[i]] = [np[i], np[i - 1]]; saveSection("phases", np, { ...latestData.current, phases: np }); }}
              onMoveDown={i => { if (i === data.phases.length - 1) return; const np = [...data.phases]; [np[i], np[i + 1]] = [np[i + 1], np[i]]; saveSection("phases", np, { ...latestData.current, phases: np }); }} />
          )}
        </div>
      </div>

      {showNewProject && <NewProjectModal phases={data.phases} onSave={addProject} onClose={() => setShowNewProject(false)} templates={PROJECT_TEMPLATES} />}
      <QuickAddButton projects={data.projects} isMobile={isMobile}
        onAddInternal={addInternalItem}
        onAddTask={(pid, task) => updateProject(pid, { tasks: [...((data.projects.find(p => p.id === pid)?.tasks) || []), { ...task, id: genId(), done: false }] })}
        onAddNote={(pid, note) => updateProject(pid, { notes: [{ text: note, date: new Date().toISOString() }, ...((data.projects.find(p => p.id === pid)?.notes) || [])] })}
        onAddMaterial={(pid, item) => updateProject(pid, { materials: [...((data.projects.find(p => p.id === pid)?.materials) || []), { id: genId(), item, manufacturer: "", vendor: "", qtyNeeded: "1", qtyOnHand: "", poNumber: "", status: "Pending Quote", deliveryDate: "", cost: "", notes: "" }] })} />
    </div>
  );
}

/* ═══ KANBAN BOARD ═══
   On wide screens, horizontal Kanban with drag-and-drop.
   On narrow screens (< 900px — phones and iPad portrait), vertical phase-grouped lists
   with a "Move →" button per project that opens a bottom-sheet phase picker.
   Drag-and-drop is unreliable on touch devices, so we replace it on narrow screens. */
function KanbanBoard({ projects, phases, onSelectProject, onDragStart, onDrop, dragItem, isMobile }) {
  // Use a separate breakpoint for the kanban list/board switch, since iPad portrait
  // is 768px (above isMobile) but still benefits from the list view.
  const [useListView, setUseListView] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const handler = () => setUseListView(window.innerWidth < 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const orphaned = projects.filter(p => !phases.some(ph => ph.id === p.phaseId));

  // ── LIST VIEW (mobile + iPad portrait) ──
  if (useListView) {
    return <KanbanListView projects={projects} phases={phases} orphaned={orphaned} onSelectProject={onSelectProject} onMovePhase={(pid, newPhaseId) => onDrop(newPhaseId, pid)} />;
  }

  // ── BOARD VIEW (desktop + iPad landscape) — original drag-and-drop kanban ──
  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 20px", height: "100%", overflowX: "auto", alignItems: "flex-start" }}>
      {orphaned.length > 0 && (
        <div style={{ minWidth: 280, maxWidth: 280, background: "#0F2444", borderRadius: 12, border: "2px dashed #f59e0b", display: "flex", flexDirection: "column", maxHeight: "100%", flexShrink: 0 }}>
          <div style={{ padding: "14px 14px 10px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1A3050" }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} /><span style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", flex: 1 }}>Needs Reassignment</span><span style={{ fontSize: 11, color: "#64748b", background: "#0A192F", borderRadius: 10, padding: "2px 8px" }}>{orphaned.length}</span></div>
          <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {orphaned.map(p => (<div key={p.id} onClick={() => onSelectProject(p)} style={{ padding: 12, borderRadius: 8, background: "#0A192F", border: "1px solid #f59e0b33", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 4 }}>Phase "{p.phaseId}" no longer exists</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{p.customer}</div>
            </div>))}
          </div>
        </div>
      )}
      {phases.map(phase => { const pp = projects.filter(p => p.phaseId === phase.id); const isOver = dragItem && dragItem.phaseId !== phase.id; return (
        <div key={phase.id} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(phase.id)} style={{ minWidth: 280, maxWidth: 280, background: "#0F2444", borderRadius: 12, border: isOver ? `2px dashed ${phase.color}` : "1px solid #1A3050", display: "flex", flexDirection: "column", maxHeight: "100%", flexShrink: 0 }}>
          <div style={{ padding: "14px 14px 10px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1A3050" }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: phase.color }} /><span style={{ fontSize: 13, fontWeight: 600, color: "#fff", flex: 1 }}>{phase.name}</span><span style={{ fontSize: 11, color: "#64748b", background: "#0A192F", borderRadius: 10, padding: "2px 8px" }}>{pp.length}</span></div>
          <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {pp.map(p => (<div key={p.id} draggable onDragStart={() => onDragStart(p)} onClick={() => onSelectProject(p)} style={{ padding: 12, borderRadius: 8, background: "#0A192F", border: "1px solid #1A3050", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.borderColor = phase.color} onMouseLeave={e => e.currentTarget.style.borderColor = "#1A3050"}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{p.jobNumber && <span style={{ color: "#69BE28", marginRight: 6 }}>#{p.jobNumber}</span>}{p.name}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{p.customer}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{p.projectTypes?.map(t => <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#1A3050", color: "#94a3b8" }}>{t}</span>)}</div>
              {p.tasks?.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>✓ {p.tasks.filter(t => t.done).length}/{p.tasks.length} tasks</div>}
            </div>))}
            {pp.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#334155" }}>Drag projects here</div>}
          </div>
        </div>); })}
    </div>
  );
}

/* ── Mobile/portrait list view: phases as collapsible sections ── */
function KanbanListView({ projects, phases, orphaned, onSelectProject, onMovePhase }) {
  // Collapsed state per phase. Default: expand phases that have projects.
  const [collapsed, setCollapsed] = useState(() => {
    const init = {};
    phases.forEach(ph => {
      const count = projects.filter(p => p.phaseId === ph.id).length;
      init[ph.id] = count === 0; // collapsed if empty
    });
    return init;
  });
  const [movePickerFor, setMovePickerFor] = useState(null); // project being moved

  function toggle(phaseId) {
    setCollapsed(c => ({ ...c, [phaseId]: !c[phaseId] }));
  }

  function ProjectCard({ p, phase }) {
    const taskCount = p.tasks?.length || 0;
    const doneCount = (p.tasks || []).filter(t => t.done).length;
    return (
      <div
        onClick={() => onSelectProject(p)}
        style={{
          background: "#0A192F",
          borderRadius: 10,
          border: `1px solid ${phase ? phase.color + "44" : "#7f1d1d"}`,
          borderLeft: `4px solid ${phase ? phase.color : "#f59e0b"}`,
          padding: "14px 14px 12px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.25, wordBreak: "break-word" }}>{p.jobNumber && <span style={{ color: "#69BE28", marginRight: 6 }}>#{p.jobNumber}</span>}{p.name}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{p.customer || "—"}</div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setMovePickerFor(p); }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#0F2444",
              color: "#cbd5e1",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              minHeight: 38,
            }}
          >
            Move →
          </button>
        </div>

        {p.projectTypes?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {p.projectTypes.map(t => (
              <span key={t} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#1A3050", color: "#94a3b8" }}>{t}</span>
            ))}
          </div>
        )}

        {taskCount > 0 && (
          <div style={{ fontSize: 12, color: doneCount === taskCount ? "#10b981" : "#64748b" }}>
            ✓ {doneCount}/{taskCount} tasks
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Orphaned projects */}
      {orphaned.length > 0 && (
        <div style={{ background: "#0F2444", borderRadius: 12, border: "2px dashed #f59e0b", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", flex: 1 }}>Needs Reassignment</span>
            <span style={{ fontSize: 12, color: "#f59e0b", background: "#0A192F", borderRadius: 10, padding: "3px 10px", fontWeight: 600 }}>{orphaned.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orphaned.map(p => <ProjectCard key={p.id} p={p} phase={null} />)}
          </div>
        </div>
      )}

      {/* Each phase as a collapsible section */}
      {phases.map(phase => {
        const pp = projects.filter(p => p.phaseId === phase.id);
        const isCollapsed = collapsed[phase.id];
        return (
          <div key={phase.id} style={{ background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", overflow: "hidden" }}>
            <button
              onClick={() => toggle(phase.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "14px 16px",
                background: "transparent", border: "none",
                cursor: "pointer", fontFamily: "inherit",
                color: "#fff", textAlign: "left",
                minHeight: 56,
                borderLeft: `4px solid ${phase.color}`,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>{phase.name}</span>
              <span style={{ fontSize: 13, color: phase.color, background: phase.color + "22", borderRadius: 12, padding: "3px 12px", fontWeight: 700, minWidth: 30, textAlign: "center" }}>
                {pp.length}
              </span>
              <ChevronDown size={20} style={{ color: "#64748b", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.15s" }} />
            </button>
            {!isCollapsed && pp.length > 0 && (
              <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                {pp.map(p => <ProjectCard key={p.id} p={p} phase={phase} />)}
              </div>
            )}
            {!isCollapsed && pp.length === 0 && (
              <div style={{ padding: "12px 16px 16px", fontSize: 13, color: "#475569", fontStyle: "italic" }}>
                No projects in this phase
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom-sheet move-to-phase picker */}
      {movePickerFor && (
        <>
          <div onClick={() => setMovePickerFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }} />
          <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0,
            background: "#0F2444", borderTop: "1px solid #334155",
            borderRadius: "16px 16px 0 0",
            padding: 16,
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            zIndex: 201, maxHeight: "75vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Move project to phase</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 }}>{movePickerFor.name}</div>
              </div>
              <button onClick={() => setMovePickerFor(null)} style={{ width: 40, height: 40, borderRadius: 8, border: "none", background: "#0A192F", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {phases.map(ph => {
                const isCurrent = ph.id === movePickerFor.phaseId;
                return (
                  <button
                    key={ph.id}
                    onClick={() => {
                      if (!isCurrent) onMovePhase(movePickerFor.id, ph.id);
                      setMovePickerFor(null);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "14px 14px",
                      borderRadius: 10,
                      border: isCurrent ? `2px solid ${ph.color}` : "1px solid #334155",
                      background: isCurrent ? ph.color + "22" : "#0A192F",
                      cursor: isCurrent ? "default" : "pointer",
                      fontFamily: "inherit",
                      minHeight: 56,
                      textAlign: "left",
                      opacity: isCurrent ? 0.7 : 1,
                    }}
                  >
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: ph.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 15, color: "#fff", fontWeight: 600 }}>{ph.name}</span>
                    {isCurrent && <span style={{ fontSize: 11, color: ph.color, fontWeight: 700, textTransform: "uppercase" }}>Current</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══ SCHEDULE VIEW ═══ */
function ScheduleView({ schedule, teamRoster, projects, onUpdate }) {
  const [wo, setWo] = useState(0);
  function getWeekDates(off) { const now = new Date(); const d = now.getDay(); const m = new Date(now); m.setDate(now.getDate() - (d === 0 ? 6 : d - 1) + off * 7); const ds = []; for (let i = 0; i < 7; i++) { const x = new Date(m); x.setDate(m.getDate() + i); ds.push(x.toISOString().split("T")[0]); } return ds; }
  const dates = getWeekDates(wo); const today = new Date().toISOString().split("T")[0];
  const fmt = ds => new Date(ds + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const iS = { width: "100%", padding: "4px 6px", borderRadius: 6, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 11, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  return (<div style={{ padding: "20px 24px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setWo(w => w - 1)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #1A3050", background: "#0F2444", color: "#94a3b8", cursor: "pointer" }}>←</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>{fmt(dates[0])} — {fmt(dates[6])}</span>
        <button onClick={() => setWo(w => w + 1)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #1A3050", background: "#0F2444", color: "#94a3b8", cursor: "pointer" }}>→</button>
      </div>
      <button onClick={() => setWo(0)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #1A3050", background: wo === 0 ? "#69BE28" : "#0F2444", color: wo === 0 ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>This Week</button>
    </div>
    {teamRoster.length === 0 ? <div style={{ textAlign: "center", padding: 48, color: "#334155" }}>Add team members first.</div> : (
      <div style={{ overflowX: "auto" }}><div style={{ display: "grid", gridTemplateColumns: "160px repeat(7, 1fr)", gap: 1, minWidth: 900 }}>
        <div style={{ padding: "10px 12px", background: "#0F2444", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Team Member</div>
        {dates.map(d => <div key={d} style={{ padding: "10px 8px", background: d === today ? "#69BE2822" : "#0F2444", textAlign: "center", fontSize: 11, fontWeight: 600, color: d === today ? "#82CC4A" : "#94a3b8" }}>{fmt(d)}</div>)}
        {teamRoster.map(member => (<>
          <div key={`n-${member.id}`} style={{ padding: "10px 12px", background: "#001528", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1A3050" }}><div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{member.name}</div></div>
          {dates.map(d => <div key={`${member.id}-${d}`} style={{ padding: "5px 4px", background: d === today ? "#69BE2808" : "#0A192F", borderBottom: "1px solid #1A3050" }}>
            <ScheduleCell raw={schedule[d]?.[member.name]} projects={projects}
              onChange={entries => { const dd = { ...(schedule[d] || {}) }; if (entries.length) dd[member.name] = entries; else delete dd[member.name]; onUpdate({ ...schedule, [d]: dd }, d); }} />
          </div>)}
        </>))}
      </div></div>
    )}
  </div>);
}

/** One member-day cell: stack of assignment chips (projects and free-text
    write-ins), an add-select, and an inline write-in input. A member can be
    on multiple jobs a day, or on work the app doesn't track (service calls,
    shop day, PTO) without forcing a fake project. */
function ScheduleCell({ raw, projects, onChange }) {
  const entries = scheduleEntries(raw);
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState("");
  const sS = { width: "100%", padding: "4px 6px", borderRadius: 6, border: "1px dashed #1A3050", background: "transparent", color: "#475569", fontSize: 10.5, fontFamily: "'DM Sans',sans-serif", outline: "none", cursor: "pointer" };
  function add(entry) { onChange([...entries, entry]); }
  function removeAt(i) { onChange(entries.filter((_, x) => x !== i)); }
  function commitNote() { const t = noteText.trim(); if (t) add({ type: "note", text: t }); setNoteText(""); setNoteMode(false); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {entries.map((e, i) => {
        const proj = e.type === "project" ? projects.find(p => p.id === e.id) : null;
        const label = e.type === "project" ? (proj ? `${proj.jobNumber ? "#" + proj.jobNumber + " " : ""}${proj.name}` : "(removed project)") : e.text;
        const isNote = e.type === "note";
        return (
          <div key={i} title={label} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 6px", borderRadius: 6, background: isNote ? "#f59e0b14" : "#69BE2814", border: `1px solid ${isNote ? "#f59e0b33" : "#69BE2833"}` }}>
            <span style={{ flex: 1, fontSize: 10.5, fontWeight: 600, color: isNote ? "#f0a93b" : "#82CC4A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: isNote ? "italic" : "normal" }}>{isNote ? "✏ " : ""}{label}</span>
            <button onClick={() => removeAt(i)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
          </div>
        );
      })}
      {noteMode ? (
        <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commitNote(); if (e.key === "Escape") { setNoteText(""); setNoteMode(false); } }}
          onBlur={commitNote} placeholder="Service call, shop, PTO…"
          style={{ width: "100%", padding: "4px 6px", borderRadius: 6, border: "1px solid #f59e0b", background: "#0A192F", color: "#f0a93b", fontSize: 10.5, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" }} />
      ) : (
        <select style={sS} value="" onChange={e => { const v = e.target.value; if (v === "__note") setNoteMode(true); else if (v) add({ type: "project", id: v }); }}>
          <option value="">{entries.length ? "+ add" : "— Off —"}</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.jobNumber ? `#${p.jobNumber} ` : ""}{p.name}</option>)}
          <option value="__note">✏ Write-in…</option>
        </select>
      )}
    </div>
  );
}

/* ═══ TEAM, PHASES, ADMIN ═══ */
function TeamView({ teamRoster, newTeamName, setNewTeamName, newTeamRole, setNewTeamRole, onAdd, onRemove, onSetRole, isAdmin }) {
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0F2444", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  return (<div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}><input style={{ ...iS, flex: 1 }} placeholder="Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} /><input style={{ ...iS, flex: 1 }} placeholder="Role" value={newTeamRole} onChange={e => setNewTeamRole(e.target.value)} /><button onClick={onAdd} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /></button></div>
    {teamRoster.map(m => (<div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#0F2444", borderRadius: 10, border: "1px solid #1A3050", marginBottom: 8 }}><div style={{ width: 36, height: 36, borderRadius: "50%", background: "#69BE2822", display: "flex", alignItems: "center", justifyContent: "center", color: "#82CC4A" }}><User size={16} /></div><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>{m.name}{m.uid ? <span title={m.email || "Linked to an app account"} style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 10, background: "#69BE2822", color: "#82CC4A", letterSpacing: "0.04em" }}>APP LINKED</span> : <span title="No one has signed in as this person yet" style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 7px", borderRadius: 10, background: "#64748b22", color: "#64748b", letterSpacing: "0.04em" }}>NOT LINKED</span>}</div><div style={{ fontSize: 12, color: "#64748b" }}>{m.role || "Team Member"}{m.email ? ` · ${m.email}` : ""}</div>
      {isAdmin && (
        <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
          {JOB_ROLES.map(r => {
            const on = (m.jobRole || "") === r.id;
            return (<button key={r.id} title={r.desc} onClick={() => onSetRole(m.id, r.id)}
              style={{ padding: "4px 10px", borderRadius: 14, border: on ? `1.5px solid ${ROLE_COLOR[r.id]}` : "1px solid #1A3050", background: on ? ROLE_COLOR[r.id] + "22" : "transparent", color: on ? ROLE_COLOR[r.id] : "#475569", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {ROLE_LABEL[r.id]}</button>);
          })}
          {!m.jobRole && <span style={{ fontSize: 10.5, color: "#f59e0b", fontWeight: 700, alignSelf: "center", marginLeft: 4 }}>← set role</span>}
        </div>
      )}
      </div><button onClick={() => { if (m.uid && !confirm(`Remove ${m.name}?\n\nTheir account is linked — they'll be asked to pick a name again next time they open the app.`)) return; onRemove(m.id); }} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={16} /></button></div>))}
  </div>);
}

function PhaseSettings({ phases, newPhaseName, setNewPhaseName, newPhaseColor, setNewPhaseColor, onAdd, onRemove, onMoveUp, onMoveDown }) {
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0F2444", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const cols = ["#002244", "#8b5cf6", "#3b82f6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6b7280", "#14b8a6"];
  return (<div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><input style={{ ...iS, flex: 1 }} placeholder="New phase" value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onAdd(); }} /><div style={{ display: "flex", gap: 4 }}>{cols.map(c => <button key={c} onClick={() => setNewPhaseColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: newPhaseColor === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer" }} />)}</div><button onClick={onAdd} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Plus size={15} /></button></div>
    <div style={{ marginTop: 16 }}>{phases.map((p, i) => (<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0F2444", borderRadius: 10, border: "1px solid #1A3050", marginBottom: 6 }}><div style={{ width: 14, height: 14, borderRadius: "50%", background: p.color }} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.name}</span><button onClick={() => onMoveUp(i)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><ChevronUp size={16} /></button><button onClick={() => onMoveDown(i)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><ChevronDown size={16} /></button><button onClick={() => onRemove(p.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={16} /></button></div>))}</div>
  </div>);
}

function PredefinedEmailSetting() {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const t = await getToken();
        const r = await fetch(`${FB_URL}/tracker/adminSettings.json${t ? `?auth=${t}` : ""}`);
        const d = await r.json();
        if (d?.predefinedEmail) setEmail(d.predefinedEmail);
      } catch {}
      setLoading(false);
    })();
  }, []);
  async function save() {
    try {
      const t = await getToken();
      await fetch(`${FB_URL}/tracker/adminSettings.json${t ? `?auth=${t}` : ""}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ predefinedEmail: email.trim() }) });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
  }
  const eS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  if (loading) return <div style={{ fontSize: 12, color: "#475569" }}>Loading...</div>;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input style={{ ...eS, flex: 1 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="additional-recipient@company.com" />
      <button onClick={save} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: saved ? "#10b981" : "#69BE28", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{saved ? "✓ Saved" : "Save"}</button>
    </div>
  );
}

/**
 * InvitePanel — admin-generated invite links.
 *
 * No email server needed: the app mints a single-use code, and you share the
 * link however you already talk to your crew (text, Outlook, in person).
 * Redeeming it auto-approves the account, sets the role, and binds the person
 * to their Team roster entry — so they skip both the approval wait and the
 * "Who are you?" screen and land straight in Field Mode.
 */
/** Storage self-test: uploads a tiny file and deletes it. Turns "the guys say
 *  photos aren't attaching" into a definite answer in one tap. */
function StorageCheck() {
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  async function run() {
    setState("running"); setMsg("");
    try {
      const { storage, storageRef, uploadBytes, getDownloadURL } = await import("./firebase.js");
      const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
      const ref = storageRef(storage, `projects/__storage_check__/${Date.now()}.png`);
      await uploadBytes(ref, blob);
      await getDownloadURL(ref);
      setState("ok"); setMsg("Uploads are working. Photos will attach to daily logs.");
    } catch (e) {
      const { describeUploadError } = await import("./photoUtils.js");
      setState("fail"); setMsg(`${describeUploadError(e)}  [${e?.code || "no code"}]`);
    }
  }
  const color = state === "ok" ? "#69BE28" : state === "fail" ? "#ef4444" : "#64748b";
  return (
    <div style={{ background: "#0F2444", border: "1px solid #1A3050", borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>Photo upload check</span>
        <span style={{ fontSize: 11.5, color: "#64748b", flex: 1 }}>Verifies Firebase Storage accepts uploads.</span>
        <button onClick={run} disabled={state === "running"} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {state === "running" ? "Testing…" : "Run check"}
        </button>
      </div>
      {msg && <div style={{ fontSize: 12, color, marginTop: 8, fontWeight: 600, lineHeight: 1.5 }}>{state === "ok" ? "✓ " : "✗ "}{msg}</div>}
    </div>
  );
}

function InvitePanel({ teamRoster }) {
  // Local input style. This was previously referencing an `iS` that only
  // existed inside other components, which threw a ReferenceError and took
  // the whole User Admin page down when it rendered.
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" };
  const [invites, setInvites] = useState({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("existing");     // existing roster member | brand new person
  const [memberId, setMemberId] = useState("");
  const [newName, setNewName] = useState("");
  const [jobRole, setJobRole] = useState("tech");
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() { setLoading(true); try { setInvites(await listInvites() || {}); } catch {} setLoading(false); }

  const unlinked = (teamRoster || []).filter(m => !m.uid);
  const inviteUrl = code => `${window.location.origin}${window.location.pathname}?invite=${code}`;

  async function create() {
    const member = unlinked.find(m => m.id === memberId);
    const name = mode === "existing" ? member?.name : newName.trim();
    if (!name) return;
    setBusy(true);
    const code = genInviteCode();
    const inv = {
      code, name,
      memberId: mode === "existing" ? memberId : "",
      jobRole,
      accountRole: jobRole === "admin" ? "admin" : "member",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (parseInt(days) || 7) * 86400000).toISOString(),
    };
    try { await putInvite(code, inv); setInvites({ ...invites, [code]: inv }); setNewName(""); setMemberId(""); }
    catch (e) { alert("Couldn't create the invite: " + (e?.message || "unknown error")); }
    setBusy(false);
  }
  async function revoke(code) {
    if (!confirm("Revoke this invite? The link stops working immediately.")) return;
    try { await deleteInvite(code); const n = { ...invites }; delete n[code]; setInvites(n); } catch {}
  }
  function copy(code) {
    const url = inviteUrl(code);
    try { navigator.clipboard?.writeText(url); } catch {}
    setCopied(code); setTimeout(() => setCopied(""), 1800);
  }

  const list = Object.values(invites).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const active = list.filter(i => !i.usedBy && (!i.expiresAt || new Date(i.expiresAt) > new Date()));
  const spent = list.filter(i => i.usedBy || (i.expiresAt && new Date(i.expiresAt) <= new Date()));

  return (
    <div style={{ background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 6, textTransform: "uppercase" }}>Invite Someone</div>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>Creates a single-use link. Whoever opens it gets approved automatically, with the role you pick, already linked to their name on the Team roster — no approval step, no setup questions.</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["existing", "Someone on the roster"], ["new", "Someone new"]].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)} style={{ padding: "7px 14px", borderRadius: 8, border: mode === id ? "1.5px solid #69BE28" : "1px solid #1A3050", background: mode === id ? "#69BE2818" : "transparent", color: mode === id ? "#82CC4A" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 0.7fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>{mode === "existing" ? "Who" : "Their name"}</label>
          {mode === "existing"
            ? <select style={iS} value={memberId} onChange={e => { setMemberId(e.target.value); const m = unlinked.find(x => x.id === e.target.value); if (m?.jobRole) setJobRole(m.jobRole); }}>
                <option value="">Select a person…</option>
                {unlinked.map(m => <option key={m.id} value={m.id}>{m.name}{m.jobRole ? ` — ${ROLE_LABEL[m.jobRole]}` : ""}</option>)}
              </select>
            : <input style={iS} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Travis" />}
        </div>
        <div>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Role</label>
          <select style={iS} value={jobRole} onChange={e => setJobRole(e.target.value)}>
            {JOB_ROLES.map(r => <option key={r.id} value={r.id}>{ROLE_LABEL[r.id]}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Expires</label>
          <select style={iS} value={days} onChange={e => setDays(e.target.value)}>
            <option value="2">2 days</option><option value="7">7 days</option><option value="30">30 days</option>
          </select>
        </div>
        <button onClick={create} disabled={busy || (mode === "existing" ? !memberId : !newName.trim())} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: (mode === "existing" ? memberId : newName.trim()) ? "#69BE28" : "#1A3050", color: (mode === "existing" ? memberId : newName.trim()) ? "#fff" : "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", height: 38 }}>Create Link</button>
      </div>
      {mode === "existing" && unlinked.length === 0 && <div style={{ fontSize: 11.5, color: "#f59e0b", marginTop: 8 }}>Everyone on the roster already has an account. Use "Someone new" to add a person.</div>}

      {!loading && active.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Active invites</div>
          {active.map(i => (
            <div key={i.code} style={{ background: "#0A192F", borderRadius: 10, border: "1px solid #1A3050", padding: "10px 12px", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{i.name}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: (ROLE_COLOR[i.jobRole] || "#64748b") + "22", color: ROLE_COLOR[i.jobRole] || "#64748b", fontWeight: 800 }}>{ROLE_LABEL[i.jobRole] || "Technician"}</span>
                <span style={{ fontSize: 11, color: "#475569" }}>expires {new Date(i.expiresAt).toLocaleDateString()}</span>
                <button onClick={() => revoke(i.code)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Revoke</button>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <button onClick={() => copy(i.code)} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #69BE28", background: copied === i.code ? "#69BE28" : "transparent", color: copied === i.code ? "#fff" : "#82CC4A", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{copied === i.code ? "Copied ✓" : "Copy link"}</button>
                <a href={`sms:?&body=${encodeURIComponent(`${i.name} — here's your login for the FWT project app. Tap to set it up: ${inviteUrl(i.code)}`)}`} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #1A3050", color: "#94a3b8", fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}>Text it</a>
                <a href={`mailto:?subject=${encodeURIComponent("Your FWT Workspaces login")}&body=${encodeURIComponent(`${i.name},\n\nHere's your access to the FWT project tracking app. Open this link on your phone and sign in — everything else is set up for you:\n\n${inviteUrl(i.code)}\n\nThis link works once and expires ${new Date(i.expiresAt).toLocaleDateString()}.`)}`} style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid #1A3050", color: "#94a3b8", fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}>Email it</a>
                <code style={{ padding: "7px 10px", borderRadius: 7, background: "#13294d", color: "#64748b", fontSize: 11, letterSpacing: "0.05em" }}>{i.code.slice(0, 6)}…</code>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && spent.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 6 }}>Used / expired</div>
          {spent.slice(0, 6).map(i => (
            <div key={i.code} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#475569", padding: "4px 0" }}>
              <span>{i.usedBy ? "✓" : "⌛"}</span><span style={{ color: "#64748b" }}>{i.name}</span>
              <span>{i.usedBy ? `joined ${new Date(i.usedAt).toLocaleDateString()}${i.usedEmail ? ` · ${i.usedEmail}` : ""}` : "expired"}</span>
              <button onClick={() => revoke(i.code)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 11 }}>Clear</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserAdminView({ teamRoster }) {
  const [users, setUsers] = useState({}); const [loading, setLoading] = useState(true);
  useEffect(() => { load(); }, []);
  async function load() { setLoading(true); try { setUsers(await fbReadUsers() || {}); } catch {} setLoading(false); }
  async function approve(uid) { const u = users[uid]; await fbWriteUser(uid, { ...u, status: "approved" }); load(); }
  async function toggleAdmin(uid) { const u = users[uid]; await fbWriteUser(uid, { ...u, role: u.role === "admin" ? "member" : "admin" }); load(); }
  async function remove(uid) { await fbDeleteUser(uid); load(); }
  const pending = Object.entries(users).filter(([, u]) => u.status === "pending");
  const approved = Object.entries(users).filter(([, u]) => u.status === "approved");
  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading...</div>;
  return (<div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
    <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Manage who can access FWT Workspaces.</p>
    <StorageCheck />
    <InvitePanel teamRoster={teamRoster} />
    <div style={{ background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 10, textTransform: "uppercase" }}>Email Notifications</div>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Daily logs, timesheets, and task notifications are automatically emailed to all admins. Add an additional recipient below (e.g., office manager, payroll).</p>
      <PredefinedEmailSetting />
    </div>
    {pending.length > 0 && <><div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 10, textTransform: "uppercase" }}>Pending ({pending.length})</div>
      {pending.map(([uid, u]) => (<div key={uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#0F2444", borderRadius: 10, border: "1px solid #f59e0b33", marginBottom: 6 }}><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{u.displayName}</div><div style={{ fontSize: 12, color: "#64748b" }}>{u.email}</div></div><button onClick={() => approve(uid)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Approve</button><button onClick={() => remove(uid)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #7f1d1d", background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Deny</button></div>))}</>}
    <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 10, marginTop: pending.length > 0 ? 20 : 0, textTransform: "uppercase" }}>Approved ({approved.length})</div>
    {approved.map(([uid, u]) => (<div key={uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#0F2444", borderRadius: 10, border: "1px solid #1A3050", marginBottom: 6 }}><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{u.displayName}{u.role === "admin" && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#69BE28", color: "#fff", fontWeight: 700, marginLeft: 6 }}>ADMIN</span>}</div><div style={{ fontSize: 12, color: "#64748b" }}>{u.email}</div></div><button onClick={() => toggleAdmin(uid)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{u.role === "admin" ? "Remove Admin" : "Make Admin"}</button>{u.role !== "admin" && <button onClick={() => remove(uid)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer" }}><X size={14} /></button>}</div>))}
  </div>);
}

/* ═══ QUICK ADD BUTTON ═══ */
function QuickAddButton({ projects, onAddTask, onAddNote, onAddMaterial, onAddInternal, isMobile }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("task");
  const [pid, setPid] = useState(""); // "" = internal — no project (tasks & notes)
  const [category, setCategory] = useState("hotlist"); // board section for internal items
  const [text, setText] = useState("");
  const needsProject = type === "material"; // materials live on a project's material list
  const canSubmit = !!text.trim() && (!!pid || !needsProject);
  const qS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  function submit() {
    if (!canSubmit) return;
    if (!pid) onAddInternal(category, text.trim(), type);
    else if (type === "task") onAddTask(pid, { text: text.trim(), assignee: "", category: "projects" });
    else if (type === "note") onAddNote(pid, text.trim());
    else if (type === "material") onAddMaterial(pid, text.trim());
    setText(""); setOpen(false);
  }
  const panelWidth = isMobile ? "calc(100vw - 32px)" : 340;
  const panelRight = isMobile ? 16 : 24;
  return (<>
    <button onClick={() => setOpen(!open)} style={{ position: "fixed", bottom: 24, right: 24, width: 52, height: 52, borderRadius: "50%", border: "none", background: "linear-gradient(135deg, #69BE28, #002244)", color: "#fff", fontSize: 24, cursor: "pointer", boxShadow: "0 4px 20px rgba(105,190,40,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "none" }}><Plus size={24} /></button>
    {open && (
      <div style={{ position: "fixed", bottom: 88, right: panelRight, width: panelWidth, background: "#0F2444", borderRadius: 16, border: "1px solid #1A3050", padding: 20, zIndex: 90, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>⚡ Quick Add</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {["task", "note", "material"].map(t => (<button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: type === t ? "#69BE28" : "transparent", color: type === t ? "#fff" : "#64748b", textTransform: "capitalize" }}>{t}</button>))}
        </div>
        <select style={{ ...qS, marginBottom: 8 }} value={pid} onChange={e => setPid(e.target.value)}>
          <option value="">{needsProject ? "Select project..." : "🏢 Internal — no project"}</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {!pid && !needsProject && (<>
          <select style={{ ...qS, marginBottom: 4 }} value={category} onChange={e => setCategory(e.target.value)}>
            {TASK_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
          <div style={{ fontSize: 11, color: "#64748b", margin: "0 2px 10px" }}>Goes to your Daily Task Board{category === "priority" || category === "hotlist" ? " · shows in your Briefing" : ""}</div>
        </>)}
        {!pid && needsProject && <div style={{ fontSize: 11, color: "#f59e0b", margin: "0 2px 10px" }}>Materials need a project.</div>}
        <input style={qS} value={text} onChange={e => setText(e.target.value)} placeholder={type === "task" ? "Task description..." : type === "note" ? "Note..." : "Material item..."} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button onClick={submit} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: canSubmit ? 1 : 0.4 }}>Add</button>
        </div>
      </div>
    )}
  </>);
}

/* ═══ NEW PROJECT MODAL ═══ */
function NewProjectModal({ phases, onSave, onClose, templates }) {
  const [form, setForm] = useState({ ...EMPTY_PROJECT, phaseId: phases[0]?.id || "" });
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
  const cols = isMobile ? "1fr" : "1fr 1fr";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 100, padding: isMobile ? 0 : 16 }}>
      <div style={{
        background: "#0F2444",
        borderRadius: isMobile ? "16px 16px 0 0" : 16,
        border: "1px solid #1A3050",
        padding: isMobile ? 18 : 24,
        width: "100%",
        maxWidth: isMobile ? "100%" : 520,
        maxHeight: isMobile ? "94vh" : "90vh",
        overflowY: "auto",
        paddingBottom: isMobile ? "max(18px, env(safe-area-inset-bottom))" : 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif", margin: 0 }}>New Project</h2><button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: "#0A192F", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button></div>
        {templates && templates.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>Start from template</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {templates.map((t, i) => (<button key={i} onClick={() => setForm({ ...form, name: form.name || t.name, projectTypes: t.projectTypes || [], type: t.type || "retrofit", tasks: (t.tasks || []).map(tk => ({ ...tk, id: genId(), done: false })), devices: t.devices || [] })} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#cbd5e1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, minHeight: 36 }}><Copy size={12} /> {t.name}</button>))}
            </div>
          </div>
        )}
        <div style={{ display: "grid", gap: 14 }}>
          <div><label style={lS}>Project Name *</label><input style={iS} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}><div><label style={lS}>Job Number</label><input style={iS} value={form.jobNumber} onChange={e => setForm({ ...form, jobNumber: e.target.value })} placeholder="260300" /></div><div><label style={lS}>Customer *</label><input style={iS} value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} /></div></div>
          <div><label style={lS}>Contact</label><input style={iS} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}><div><label style={lS}>Phone</label><input style={iS} type="tel" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div><div><label style={lS}>Email</label><input style={iS} type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div></div>
          <div><label style={lS}>Site Address</label><input style={iS} value={form.siteAddress} onChange={e => setForm({ ...form, siteAddress: e.target.value })} /></div>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}><div><label style={lS}>Phase</label><select style={iS} value={form.phaseId} onChange={e => setForm({ ...form, phaseId: e.target.value })}>{phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div><label style={lS}>Type</label><select style={iS} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="retrofit">Retrofit</option><option value="new-construction">New Construction</option></select></div></div>
          <div><label style={lS}>Systems</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{PROJECT_TYPES.map(pt => (<button key={pt} onClick={() => { const t = form.projectTypes || []; setForm({ ...form, projectTypes: t.includes(pt) ? t.filter(x => x !== pt) : [...t, pt] }); }} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #1A3050", fontSize: 12, cursor: "pointer", fontFamily: "inherit", background: (form.projectTypes || []).includes(pt) ? "#69BE28" : "transparent", color: (form.projectTypes || []).includes(pt) ? "#fff" : "#94a3b8", minHeight: 36, fontWeight: 600 }}>{pt}</button>))}</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}><button onClick={onClose} style={{ flex: isMobile ? 1 : "0 0 auto", padding: "12px 20px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#cbd5e1", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Cancel</button><button onClick={() => { if (form.name.trim() && form.customer.trim()) onSave(form); }} style={{ flex: isMobile ? 2 : "0 0 auto", padding: "12px 24px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: form.name.trim() && form.customer.trim() ? 1 : 0.4 }}>Create Project</button></div>
      </div>
    </div>
  );
}
