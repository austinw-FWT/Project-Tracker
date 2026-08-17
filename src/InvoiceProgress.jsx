import { useState } from "react";
import { laborTotals } from "./laborMath.js";

/**
 * InvoiceProgress — admin panel: where's the money, and what needs billing.
 *
 * The headline metric isn't "how much have we invoiced" — it's the GAP
 * between work completed and work billed. Labor burn is the best proxy for
 * completion the app has (hours are logged daily by the crews), so a job at
 * 80% of its hours with 40% invoiced is roughly 40 points of finished work
 * sitting unbilled. That's the number worth surfacing every week.
 *
 * Data sources, in priority order:
 *   1. project.invoicing  — synced from the PIF's Schedule of Values by the
 *      OneDrive scan (contractTotal / invoicedToDate / pctInvoiced /
 *      lineItems). Authoritative when present; shows its sync date.
 *   2. project.invoices[] — invoices entered in the app.
 * Both are read-only here; nothing is written or overwritten.
 */

const money = v => "$" + Math.round(v || 0).toLocaleString();
const num = v => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;

/** Roll one project's billing picture up from whichever source it has. */
export function invoiceSnapshot(project) {
  const pif = project.invoicing;
  const contract = num(project.contractAmount) || num(project.bidAmount) || num(pif?.contractTotal);
  const entered = (project.invoices || []).reduce((s, i) => s + num(i.amount), 0);
  const collected = (project.invoices || []).filter(i => i.status === "paid").reduce((s, i) => s + num(i.amount), 0);

  const usePif = pif && num(pif.contractTotal) > 0;
  const invoiced = usePif ? num(pif.invoicedToDate) : entered;
  const base = usePif ? num(pif.contractTotal) : contract;
  const pctInvoiced = base > 0 ? invoiced / base : 0;

  const t = laborTotals(project);
  const pctComplete = t.bid > 0 ? Math.min(t.used / t.bid, 1.5) : null;   // labor burn as completion proxy
  const gapPct = pctComplete === null ? null : pctComplete - pctInvoiced;

  return {
    contract: base, invoiced, collected,
    outstanding: Math.max(base - invoiced, 0),
    unpaid: Math.max(invoiced - collected, 0),
    pctInvoiced, pctComplete, gapPct,
    source: usePif ? "PIF" : "app",
    syncedAt: usePif ? pif.syncedAt : null,
    lineItems: usePif ? (pif.lineItems || []) : [],
  };
}

export default function InvoiceProgress({ projects, isMobile, onSelectProject }) {
  const [expanded, setExpanded] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const rows = (projects || [])
    .filter(p => !p.movedToWarranty)
    .map(p => ({ p, s: invoiceSnapshot(p) }))
    .filter(r => r.s.contract > 0);

  if (rows.length === 0) return null;

  const totals = rows.reduce((a, r) => ({
    contract: a.contract + r.s.contract,
    invoiced: a.invoiced + r.s.invoiced,
    collected: a.collected + r.s.collected,
    outstanding: a.outstanding + r.s.outstanding,
    unpaid: a.unpaid + r.s.unpaid,
  }), { contract: 0, invoiced: 0, collected: 0, outstanding: 0, unpaid: 0 });

  // Biggest completed-but-unbilled gaps first — that's the action list.
  const ranked = [...rows].sort((a, b) => (b.s.gapPct ?? -1) - (a.s.gapPct ?? -1));
  const needsBilling = ranked.filter(r => r.s.gapPct !== null && r.s.gapPct >= 0.15 && r.s.outstanding > 0);
  const visible = showAll ? ranked : ranked.slice(0, 6);

  const card = { background: "#0F2444", border: "1px solid #1A3050", borderRadius: 12 };
  const Stat = ({ label, value, sub, color }) => (
    <div style={{ ...card, padding: "12px 14px", borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color, fontFamily: "'Outfit',sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#475569", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  function Bar({ s }) {
    const inv = Math.min(s.pctInvoiced, 1) * 100;
    const comp = s.pctComplete === null ? null : Math.min(s.pctComplete, 1) * 100;
    return (
      <div style={{ position: "relative", height: 8, borderRadius: 4, background: "#1A3050", overflow: "visible" }}>
        <div style={{ width: `${inv}%`, height: "100%", borderRadius: 4, background: "#3b82f6" }} />
        {comp !== null && (
          <div title={`Labor burn ${Math.round(comp)}%`} style={{ position: "absolute", top: -3, left: `calc(${comp}% - 1px)`, width: 2, height: 14, background: "#f59e0b", borderRadius: 1 }} />
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Invoice progress</span>
        {needsBilling.length > 0 && (
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 800, background: "#f59e0b22", color: "#f59e0b" }}>
            {needsBilling.length} JOB{needsBilling.length > 1 ? "S" : ""} READY TO BILL
          </span>
        )}
        <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>{rows.length} active contract{rows.length > 1 ? "s" : ""}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <Stat label="Contract value" value={money(totals.contract)} color="#69BE28" />
        <Stat label="Invoiced" value={money(totals.invoiced)} sub={`${Math.round((totals.invoiced / totals.contract) * 100)}% of contracts`} color="#3b82f6" />
        <Stat label="Left to invoice" value={money(totals.outstanding)} color="#f59e0b" />
        <Stat label="Awaiting payment" value={money(totals.unpaid)} sub={`${money(totals.collected)} collected`} color="#10b981" />
      </div>

      {needsBilling.length > 0 && (
        <div style={{ background: "#f59e0b0f", border: "1px solid #f59e0b33", borderRadius: 10, padding: "11px 14px", marginBottom: 12, fontSize: 12.5, color: "#f0a93b", lineHeight: 1.5 }}>
          <strong>Work ahead of billing.</strong> These jobs have burned more labor than they've invoiced — likely a progress billing is due. The amber tick on each bar is labor burn; the blue fill is invoiced.
        </div>
      )}

      <div style={{ ...card, padding: isMobile ? "10px 12px" : "14px 16px" }}>
        {visible.map(({ p, s }) => {
          const open = expanded === p.id;
          const flag = s.gapPct !== null && s.gapPct >= 0.15 && s.outstanding > 0;
          return (
            <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #13294d" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, flexWrap: "wrap" }}>
                {flag && <span title="Completed work exceeds invoiced" style={{ color: "#f59e0b", fontSize: 13 }}>●</span>}
                <button onClick={() => onSelectProject && onSelectProject(p)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "baseline", gap: 7, flex: 1, minWidth: 140 }}>
                  {p.jobNumber && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#69BE28" }}>#{p.jobNumber}</span>}
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                </button>
                {s.source === "PIF" && <span title={s.syncedAt ? `From the PIF, synced ${new Date(s.syncedAt).toLocaleDateString()}` : "From the PIF"} style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 9, background: "#8b5cf622", color: "#a78bfa" }}>PIF</span>}
                <span style={{ fontSize: 12.5, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{money(s.invoiced)} <span style={{ color: "#475569" }}>/ {money(s.contract)}</span></span>
                <span style={{ fontSize: 13, fontWeight: 800, color: s.pctInvoiced >= 0.99 ? "#10b981" : "#3b82f6", width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(s.pctInvoiced * 100)}%</span>
              </div>
              <Bar s={s} />
              <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                {s.pctComplete !== null && <span>Labor burn {Math.round(s.pctComplete * 100)}%</span>}
                {flag && <span style={{ color: "#f59e0b", fontWeight: 700 }}>~{Math.round(s.gapPct * 100)} pts unbilled</span>}
                {s.outstanding > 0 && <span>{money(s.outstanding)} left to invoice</span>}
                {s.unpaid > 0 && <span>{money(s.unpaid)} awaiting payment</span>}
                {s.lineItems.length > 0 && (
                  <button onClick={() => setExpanded(open ? null : p.id)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 11, fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>
                    {open ? "hide" : `${s.lineItems.length} SOV lines`}
                  </button>
                )}
              </div>
              {open && s.lineItems.length > 0 && (
                <div style={{ marginTop: 8, background: "#0A192F", borderRadius: 8, padding: "8px 12px" }}>
                  {s.lineItems.map((li, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 11.5, padding: "4px 0", color: "#94a3b8" }}>
                      <span style={{ flex: 1 }}>{li.item}</span>
                      <span style={{ color: "#64748b" }}>{Math.round((li.pctToDate || 0) * 100)}%</span>
                      <span style={{ width: 78, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(li.invoicedToDate)}</span>
                      <span style={{ width: 78, textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>/ {money(li.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {ranked.length > 6 && (
          <button onClick={() => setShowAll(!showAll)} style={{ width: "100%", marginTop: 10, padding: "8px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {showAll ? "Show top 6" : `Show all ${ranked.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
