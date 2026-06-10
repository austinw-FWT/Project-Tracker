import { useState } from "react";
import { readTracker, readUsers, putTrackerRoot } from "./db.js";
import { genId } from "./App.jsx";

/**
 * MigrationTool — the one-time data migration, run from inside the app.
 *
 * No terminal, no Node, no service-account key. The signed-in admin's own
 * credentials are used. Three guarded steps:
 *   1. Download a full backup JSON to your computer  (required first)
 *   2. Preview — runs the conversion in memory and shows what will change
 *   3. Migrate — writes the converted tree
 *
 * What it converts (same logic as the original migrate.js):
 *   - projects array  → keyed object  (enables safe concurrent writes)
 *   - dailyLogs array → keyed object  (each log its own record)
 *   - labor hours     → ledger model: keeps bid, computes logged hours from
 *     the logs, and writes a per-category adjustment so today's remaining
 *     balances carry over EXACTLY
 *   - memberPrivate   → re-keyed from display names to account uids
 */

function loggedHoursFor(logsArr, cat) {
  let sum = 0;
  for (const log of logsArr) {
    for (const crew of log.crewBreakdown || []) {
      for (const a of crew.allocations || []) {
        if (a.category === cat) sum += parseFloat(a.hours) || 0;
      }
    }
  }
  return sum;
}

function transform(tracker, users) {
  const notes = [];

  // projects → keyed object
  let projectsIn = tracker.projects || {};
  const projectsArr = Array.isArray(projectsIn)
    ? projectsIn.filter(Boolean)
    : Object.entries(projectsIn).map(([k, p]) => ({ ...p, id: p.id || k }));

  const projectsOut = {};
  for (const p of projectsArr) {
    const pid = p.id || genId();
    const proj = { ...p, id: pid };

    const logsArr = Array.isArray(proj.dailyLogs)
      ? proj.dailyLogs.filter(Boolean)
      : Object.values(proj.dailyLogs || {});
    const logsObj = {};
    for (const l of logsArr) { const lid = l.id || genId(); logsObj[lid] = { ...l, id: lid }; }
    proj.dailyLogs = logsObj;

    if (proj.laborHours) {
      const adjustments = { ...(proj.laborAdjustments || {}) };
      const newLH = {};
      for (const [cat, v] of Object.entries(proj.laborHours)) {
        const bid = parseFloat(v?.bid) || 0;
        newLH[cat] = { bid };
        if (v && v.remaining !== undefined) {
          const oldUsed = bid - (parseFloat(v.remaining) || 0);
          const logged = loggedHoursFor(logsArr, cat);
          const adj = Math.round((oldUsed - logged) * 100) / 100;
          if (adj !== 0) adjustments[cat] = adj;
          if (Math.abs(adj) > 0.01) notes.push({ type: "labor", text: `${proj.name} · ${cat}: logs total ${logged.toFixed(1)}h, balance implied ${oldUsed.toFixed(1)}h used → true-up ${adj > 0 ? "+" : ""}${adj}h (your current remaining is preserved exactly)` });
        }
      }
      proj.laborHours = newLH;
      if (Object.keys(adjustments).length) proj.laborAdjustments = adjustments;
    }
    projectsOut[pid] = proj;
  }

  // memberPrivate names → uids
  const byName = {}, byEmail = {};
  for (const [uid, u] of Object.entries(users || {})) {
    if (u.displayName) byName[u.displayName] = uid;
    if (u.email) { byEmail[u.email] = uid; byName[u.email] = uid; }
  }
  const mpIn = tracker.memberPrivate || {};
  const mpOut = {};
  for (const [key, val] of Object.entries(mpIn)) {
    if (users && users[key]) { mpOut[key] = val; continue; }
    const uid = byName[key] || byEmail[key];
    if (uid) {
      mpOut[uid] = { ...(mpOut[uid] || {}), ...val };
      notes.push({ type: "rekey", text: `Personal space "${key}" → linked to their account` });
    } else {
      mpOut[key] = val;
      notes.push({ type: "keep", text: `Personal space "${key}" — no matching account; kept as-is (still readable via fallback)` });
    }
  }

  return { out: { ...tracker, projects: projectsOut, memberPrivate: mpOut }, notes, projectCount: projectsArr.length };
}

export default function MigrationTool({ onDone }) {
  const [backedUp, setBackedUp] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const card = { background: "#0F2444", border: "1px solid #1A3050", borderRadius: 12, padding: "18px 20px", marginBottom: 12 };
  const btn = (bg, disabled) => ({ padding: "12px 20px", borderRadius: 10, border: "none", background: disabled ? "#1A3050" : bg, color: disabled ? "#475569" : "#fff", fontSize: 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", minHeight: 44 });
  const stepNum = (n, active, complete) => (
    <div style={{ width: 28, height: 28, borderRadius: "50%", background: complete ? "#69BE28" : active ? "#1A3050" : "#0A192F", border: `2px solid ${complete ? "#69BE28" : active ? "#69BE28" : "#1A3050"}`, color: complete ? "#0A192F" : active ? "#69BE28" : "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{complete ? "✓" : n}</div>
  );

  async function downloadBackup() {
    setBusy(true); setError("");
    try {
      const [tracker, users] = await Promise.all([readTracker(), readUsers()]);
      const blob = new Blob([JSON.stringify({ tracker, users, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lv-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setBackedUp(true);
    } catch (e) { setError("Backup failed: " + e.message); }
    setBusy(false);
  }

  async function runPreview() {
    setBusy(true); setError("");
    try {
      const [tracker, users] = await Promise.all([readTracker(), readUsers()]);
      if (!tracker) throw new Error("No data found at /tracker");
      setPreview(transform(tracker, users));
    } catch (e) { setError("Preview failed: " + e.message); }
    setBusy(false);
  }

  async function runMigration() {
    if (!confirm("Run the migration now?\n\nThe converted data will replace the current structure. Your backup file is your undo button.")) return;
    setBusy(true); setError("");
    try {
      // Re-read fresh at the moment of writing, then convert and write once.
      const [tracker, users] = await Promise.all([readTracker(), readUsers()]);
      const { out } = transform(tracker, users);
      await putTrackerRoot(out);
      setDone(true);
      setTimeout(() => onDone && onDone(), 1500);
    } catch (e) { setError("Migration failed — nothing partial was written. " + e.message); }
    setBusy(false);
  }

  if (done) return (
    <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#69BE28", fontFamily: "'Outfit',sans-serif" }}>Migration complete</div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>Reloading the app with the new data structure…</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif", marginBottom: 4 }}>Data Migration</h2>
      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 20 }}>
        One-time upgrade to the new data structure: projects and daily logs become individually-saved records (so two people can work at once without overwriting each other), and labor hours become self-correcting. Your current numbers carry over exactly. Three steps, in order.
      </p>

      {error && <div style={{ background: "#7f1d1d33", border: "1px solid #7f1d1d", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {/* Step 1 — backup */}
      <div style={card}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {stepNum(1, !backedUp, backedUp)}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Download a backup</div>
            <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 12 }}>Saves a complete copy of the database to your computer. If anything ever looks wrong, this file restores everything — keep it somewhere safe.</div>
            <button onClick={downloadBackup} disabled={busy} style={btn("#3b82f6", busy)}>{backedUp ? "Download again" : "Download backup"}</button>
            {backedUp && <span style={{ fontSize: 12, color: "#69BE28", fontWeight: 700, marginLeft: 12 }}>✓ Saved to your Downloads</span>}
          </div>
        </div>
      </div>

      {/* Step 2 — preview */}
      <div style={{ ...card, opacity: backedUp ? 1 : 0.5 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {stepNum(2, backedUp && !preview, !!preview)}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Preview the changes</div>
            <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 12 }}>Runs the whole conversion in memory and shows you a summary. Nothing is written in this step.</div>
            <button onClick={runPreview} disabled={!backedUp || busy} style={btn("#8b5cf6", !backedUp || busy)}>Preview migration</button>

            {preview && (
              <div style={{ marginTop: 14, background: "#0A192F", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, color: "#69BE28", fontWeight: 700, marginBottom: 8 }}>✓ {preview.projectCount} projects will be converted</div>
                {preview.notes.length === 0 && <div style={{ fontSize: 12.5, color: "#94a3b8" }}>No labor true-ups needed — your logs and balances already agree.</div>}
                {preview.notes.map((n, i) => (
                  <div key={i} style={{ fontSize: 12, color: n.type === "labor" ? "#f59e0b" : "#94a3b8", padding: "5px 0", borderBottom: "1px solid #13294d", lineHeight: 1.5 }}>
                    {n.type === "labor" ? "⚖️ " : n.type === "rekey" ? "🔗 " : "ℹ️ "}{n.text}
                  </div>
                ))}
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 10 }}>True-ups happen when a log was deleted or hours were hand-edited in the past — the old system never reconciled those. Your remaining balances stay exactly as they are today.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 3 — migrate */}
      <div style={{ ...card, opacity: preview ? 1 : 0.5, border: preview ? "1px solid #69BE2855" : "1px solid #1A3050" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {stepNum(3, !!preview, false)}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Run the migration</div>
            <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 12 }}>Writes the converted structure. Takes a few seconds. Best done when nobody else is in the app.</div>
            <button onClick={runMigration} disabled={!preview || busy} style={btn("#69BE28", !preview || busy)}>{busy ? "Working…" : "Run migration"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
