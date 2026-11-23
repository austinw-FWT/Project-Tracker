import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { jobSummary, STAGES, dayOf, daysBetween } from "./workflow.js";
import { LABOR_PHASES } from "./App.jsx";

/**
 * PM Command Center — every active job on one screen, worst first.
 * Overdue workflow steps, steps due in the next week, invoices ready to send,
 * and schedule/hours risk. Clicking a job opens its Workflow tab.
 */
const C = { card: "#0F2444", deep: "#0A192F", line: "#1A3050", text: "#e2e8f0", sub: "#94a3b8", mute: "#64748b", green: "#69BE28", amber: "#f59e0b", red: "#ef4444", blue: "#38bdf8" };
const fmt = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";
const money = n => "$" + Math.round(n || 0).toLocaleString();

export default function PMCenter({ projects, phases, schedule, myName, canSeeMoney, onOpen, isMobile }) {
  const ctx = { phases, schedule, laborPhases: LABOR_PHASES, money: !!canSeeMoney };
  const active = (projects || []).filter(p => !p.movedToWarranty);
  const first = String(myName || "").trim().split(/\s+/)[0].toLowerCase();
  const isMine = p => first && String(p.projectManager || "").toLowerCase().split(/[\s,/&]+/).includes(first);
  const anyMine = active.some(isMine);
  const [scope, setScope] = useState(anyMine ? "mine" : "all");
  const jobs = active.filter(p => scope === "all" || isMine(p)).map(p => ({ p, s: jobSummary(p, ctx) })).sort((a, b) => b.s.score - a.s.score);
  const today = dayOf(new Date());

  const overdue = jobs.reduce((n, j) => n + j.s.overdue.length, 0);
  const soon = jobs.reduce((n, j) => n + j.s.soon.length, 0);
  const toInvoice = jobs.flatMap(j => j.s.toInvoice.map(b => ({ ...b, job: j.p })));
  const atRisk = jobs.filter(j => j.s.flags.some(f => f.level === "bad")).length;
  const noDates = jobs.filter(j => j.s.flags.some(f => f.id === "nodates")).length;
  const upcoming = jobs.flatMap(j => j.s.open.filter(m => m.due && m.due >= today && daysBetween(today, m.due) <= 14).map(m => ({ m, p: j.p })))
    .sort((a, b) => a.m.due.localeCompare(b.m.due));
  const phaseName = id => (phases.find(x => x.id === id) || {}).name || id;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? 14 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Every active job's workflow — what's late, what's due, what to bill.</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["mine", "My jobs"], ["all", "All jobs"]].map(([id, l]) => (
            <button key={id} onClick={() => setScope(id)} style={{ padding: "7px 13px", borderRadius: 16, border: `1px solid ${scope === id ? C.green : C.line}`, background: scope === id ? C.green + "22" : "transparent", color: scope === id ? C.green : C.sub, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      {scope === "mine" && !anyMine && <div style={{ fontSize: 12.5, color: C.amber, marginBottom: 12 }}>No jobs list you as PM. Set Project Manager on each job's Overview.</div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${canSeeMoney ? 5 : 4}, 1fr)`, gap: 10, marginBottom: 18 }}>
        <Tile label="Overdue steps" value={overdue} color={overdue ? C.red : C.green} />
        <Tile label="Due this week" value={soon} color={soon ? C.amber : C.green} />
        {canSeeMoney && <Tile label="Ready to invoice" value={toInvoice.length} sub={toInvoice.length ? money(toInvoice.reduce((s, b) => s + b.amount, 0)) : ""} color={toInvoice.length ? C.amber : C.green} />}
        <Tile label="Jobs at risk" value={atRisk} color={atRisk ? C.red : C.green} />
        <Tile label="Missing dates" value={noDates} color={noDates ? C.amber : C.green} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 16, alignItems: "start" }}>
        <div>
          {jobs.length === 0 && <div style={{ background: C.card, border: `1px dashed ${C.line}`, borderRadius: 12, padding: 30, textAlign: "center", color: C.mute, fontSize: 13 }}>No active jobs.</div>}
          {jobs.map(({ p, s }) => {
            const worst = s.overdue.length || s.flags.some(f => f.level === "bad") || s.toInvoice.some(b => b.status === "late") ? C.red : s.soon.length || s.toInvoice.length || s.flags.length ? C.amber : C.green;
            return (
              <button key={p.id} data-job={p.id} onClick={() => onOpen(p, "workflow")} style={{ width: "100%", textAlign: "left", display: "block", background: C.card, border: `1px solid ${C.line}`, borderLeft: `4px solid ${worst}`, borderRadius: 11, padding: "12px 14px", marginBottom: 8, cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {p.jobNumber && <span style={{ fontSize: 12.5, fontWeight: 800, color: C.green }}>#{p.jobNumber}</span>}
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", flex: 1, minWidth: 0 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: C.sub }}>{phaseName(p.phaseId)} · {(STAGES.find(x => x.id === s.stage) || {}).label}</span>
                  <ChevronRight size={15} style={{ color: C.mute }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: C.deep, overflow: "hidden" }}><div style={{ width: `${s.pct}%`, height: "100%", background: C.green }} /></div>
                  <span style={{ fontSize: 11, color: C.mute, width: 34, textAlign: "right" }}>{s.pct}%</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8, fontSize: 12.5 }}>
                  {s.overdue.slice(0, 3).map(m => <div key={m.id} style={{ color: "#fca5a5" }}>● {m.label} — {m.daysLate}d late</div>)}
                  {s.overdue.length > 3 && <div style={{ color: "#fca5a5" }}>+ {s.overdue.length - 3} more overdue</div>}
                  {s.toInvoice.map(b => <div key={b.id} style={{ color: b.status === "late" ? "#fca5a5" : "#fcd34d" }}>$ Invoice "{b.label}" {money(b.amount)}{b.status === "late" ? " — late" : " — ready"}</div>)}
                  {s.flags.map(f => <div key={f.id} style={{ color: f.level === "bad" ? "#fca5a5" : "#fcd34d", display: "flex", gap: 5, alignItems: "center" }}><AlertTriangle size={11} /> {f.label}</div>)}
                  {!s.overdue.length && s.next && <div style={{ color: C.sub }}>Next: {s.next.label}{s.next.due ? ` — ${fmt(s.next.due)}` : ""}</div>}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 8 }}>Next 14 days</div>
          {upcoming.length === 0 && <div style={{ fontSize: 12.5, color: C.mute }}>Nothing due.</div>}
          {upcoming.map(({ m, p }) => (
            <button key={p.id + m.id} onClick={() => onOpen(p, "workflow")} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `1px solid ${C.line}`, padding: "8px 0", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: m.status === "soon" ? C.amber : C.sub }}>{fmt(m.due)}</div>
              <div style={{ fontSize: 12.5, color: C.text }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: C.mute }}>{p.jobNumber ? `#${p.jobNumber} ` : ""}{p.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.sub }}>{sub}</div>}
    </div>
  );
}
