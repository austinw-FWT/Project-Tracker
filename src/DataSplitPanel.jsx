import { useState, useEffect } from "react";
import { ShieldCheck, Loader, Check, AlertTriangle } from "lucide-react";
import { dbGet, dbPut, dbPatch, dbDelete } from "./db.js";
import { planDataSplit, runDataSplit } from "./dataSplit.js";

/**
 * User Admin → "Data security". One button that moves job money, price book
 * and everyone's private data out of the shared tracker (see dataSplit.js).
 * Shows what it will move before doing anything.
 */
export default function DataSplitPanel({ onDone }) {
  const [state, setState] = useState("loading");   // loading | ready | running | done | error
  const [plan, setPlan] = useState(null);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setState("loading"); setError("");
    try {
      const [tracker, money, priv, est, users, meta] = await Promise.all([
        dbGet("/tracker"), dbGet("/money"), dbGet("/private"), dbGet("/estimating"), dbGet("/users"), dbGet("/meta"),
      ]);
      setDone(!!(meta && meta.dataSplit));
      setPlan(planDataSplit({ tracker, money, priv, est, users }));
      setState("ready");
    } catch (e) {
      setError(/401|403|denied/i.test(String(e.message)) || e.status === 401
        ? "The new database rules aren't published yet. Publish database.rules.json from this release, then reopen this page."
        : `Couldn't read the database: ${e.message}`);
      setState("error");
    }
  }
  useEffect(() => { load(); }, []);

  async function run() {
    if (!plan) return;
    setState("running");
    try {
      await runDataSplit(plan.ops, { dbPut, dbPatch, dbDelete }, (i, n, label) => setProgress(i < n ? `${i + 1} of ${n} — ${label}` : "Finishing…"));
      setDone(true);
      setState("done");
      if (onDone) onDone();
      load();
    } catch (e) {
      setError(`Stopped: ${e.message}. Nothing is lost — run it again to finish.`);
      setState("error");
    }
  }

  const s = plan?.summary;
  const pending = plan ? plan.ops.filter(o => o.path !== "/meta/dataSplit").length : 0;
  return (
    <div style={{ background: "#0F2444", border: `1px solid ${done && !pending ? "#69BE2855" : "#f59e0b55"}`, borderRadius: 12, padding: 18, marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <ShieldCheck size={17} style={{ color: done && !pending ? "#69BE28" : "#f59e0b" }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Data security</span>
        {done && !pending && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "#69BE2822", color: "#82CC4A" }}>DONE</span>}
      </div>
      <div style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, marginBottom: 12 }}>
        Moves job dollars (bid, contract, invoices, material costs, change order amounts) where only admins and foremen can read them,
        the price book where only admins can, and each person's board, logs, timesheets and opportunities where only they can.
        Technicians' phones stop downloading any of it. Screens don't change.
      </div>

      {state === "loading" && <div style={{ fontSize: 12.5, color: "#94a3b8", display: "flex", gap: 8, alignItems: "center" }}><Loader size={14} /> Checking…</div>}

      {plan && state !== "loading" && (
        pending > 0 ? (
          <div style={{ fontSize: 12.5, color: "#e2e8f0", lineHeight: 1.7, marginBottom: 12 }}>
            {s.projectsWithMoney > 0 && <div>• Money on {s.projectsWithMoney} job{s.projectsWithMoney > 1 ? "s" : ""} ({s.materialCosts} material costs, {s.coAmounts} change order amounts)</div>}
            {s.privateRecords > 0 && <div>• {s.privateRecords} people's private records</div>}
            {s.estimating > 0 && <div>• Price book and estimating defaults</div>}
            {s.roles > 0 && <div>• Roles copied to {s.roles} account{s.roles > 1 ? "s" : ""} (so foremen can read job money)</div>}
            {done && <div style={{ color: "#f59e0b" }}>• Some data was written back to the old location — moving it again.</div>}
          </div>
        ) : <div style={{ fontSize: 12.5, color: "#82CC4A" }}><Check size={13} /> Everything is in its protected location.</div>
      )}

      {state === "running" && <div style={{ fontSize: 12, color: "#82CC4A", marginBottom: 10 }}><Loader size={13} /> {progress}</div>}
      {error && <div style={{ fontSize: 12.5, color: "#fca5a5", marginBottom: 10, lineHeight: 1.5 }}><AlertTriangle size={13} /> {error}</div>}

      {plan && pending > 0 && state !== "running" && (
        <button onClick={run} style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Move the data now
        </button>
      )}
      {state === "error" && !plan && <button onClick={load} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Try again</button>}
    </div>
  );
}
