import { useState } from "react";
import { ChevronDown, ChevronRight, Lock, Zap, AlertTriangle, Plus, X } from "lucide-react";
import {
  STAGES, GATE_LABELS, milestoneStates, billingStatus, riskFlags, keyDates, jobSummary,
  defaultBillingPlan, BILLING_TRIGGERS, DEFAULT_LEAD_DAYS, dayOf,
} from "./workflow.js";
import { LABOR_PHASES } from "./App.jsx";

/**
 * Workflow tab — the job's repeatable PM workflow (see workflow.js):
 * key dates, every milestone with its due date and status, the milestone
 * billing plan, and the log of admin overrides.
 *
 * onSet(path, value) writes one nested value on the project
 * ("workflow/milestones/design", "billingPlan/items/x", …).
 * onUpdate(fields) writes top-level fields (start / target dates, invoices).
 */
const C = { card: "#0F2444", deep: "#0A192F", line: "#1A3050", text: "#e2e8f0", sub: "#94a3b8", mute: "#64748b", green: "#69BE28", greenT: "#82CC4A", amber: "#f59e0b", red: "#ef4444", blue: "#38bdf8" };
const STATUS = {
  done:     { label: "Done",      color: C.green },
  na:       { label: "N/A",       color: C.mute },
  overdue:  { label: "Overdue",   color: C.red },
  soon:     { label: "Due soon",  color: C.amber },
  upcoming: { label: "Upcoming",  color: C.sub },
  nodate:   { label: "No date",   color: C.mute },
};
const fmt = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
const money = n => "$" + Math.round(n || 0).toLocaleString();
const inp = { padding: "7px 9px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.deep, color: C.text, fontSize: 12.5, fontFamily: "inherit", outline: "none", colorScheme: "dark" };
const btn = (color = C.sub) => ({ padding: "6px 11px", borderRadius: 7, border: `1px solid ${C.line}`, background: "transparent", color, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });

export default function WorkflowTab({ project, phases, jobRole, canSeeMoney, myName, schedule, onSet, onUpdate, genId, isMobile }) {
  const isAdmin = jobRole === "admin";
  const canEdit = isAdmin || jobRole === "foreman";
  const ctx = { phases, schedule, laborPhases: LABOR_PHASES };
  const sum = jobSummary(project, { ...ctx, money: !!canSeeMoney });
  const ms = sum.milestones;
  const kd = keyDates(project);
  const [open, setOpen] = useState(() => new Set([sum.stage]));
  const [expanded, setExpanded] = useState(null);
  const stamp = () => ({ by: myName || "", at: new Date().toISOString() });
  const today = dayOf(new Date());

  const markDone = m => onSet(`workflow/milestones/${m.id}`, { ...(m.rec || {}), done: true, date: today, ...stamp() });
  const undo = m => onSet(`workflow/milestones/${m.id}`, m.rec && (m.rec.note || m.rec.due) ? { note: m.rec.note || null, due: m.rec.due || null } : null);
  const setRec = (m, patch) => {
    const next = { ...(m.rec || {}), ...patch };
    Object.keys(next).forEach(k => { if (next[k] === null || next[k] === "" || next[k] === false) delete next[k]; });
    onSet(`workflow/milestones/${m.id}`, Object.keys(next).length ? next : null);
  };
  const overrides = Object.entries((project.workflow && project.workflow.overrides) || {}).map(([id, o]) => ({ id, ...o })).sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Tile label="Workflow" value={`${sum.pct}%`} sub={`${ms.filter(m => m.done || m.na).length} of ${ms.length} steps`} color={C.green} />
        <Tile label="Overdue" value={sum.overdue.length} sub={sum.overdue[0] ? sum.overdue[0].label : "Nothing late"} color={sum.overdue.length ? C.red : C.green} />
        <Tile label="Next step" value={sum.next ? fmt(sum.next.due) : "—"} sub={sum.next ? sum.next.label : "All done"} color={C.blue} />
        {canSeeMoney && <Tile label="To invoice" value={sum.toInvoice.length} sub={sum.toInvoice[0] ? `${sum.toInvoice[0].label} · ${money(sum.toInvoice[0].amount)}` : "Nothing ready"} color={sum.toInvoice.length ? C.amber : C.green} />}
      </div>
      {sum.flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {sum.flags.map(f => (
            <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 9, background: (f.level === "bad" ? C.red : C.amber) + "14", border: `1px solid ${(f.level === "bad" ? C.red : C.amber)}44`, fontSize: 12.5, color: f.level === "bad" ? "#fca5a5" : "#fcd34d" }}>
              <AlertTriangle size={14} /> {f.label}
            </div>
          ))}
        </div>
      )}

      {/* Key dates */}
      <Section title="Key dates" note="Every due date below is worked out from these.">
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10 }}>
          <DateField label="Awarded" value={kd.award} disabled={!isAdmin} onChange={v => onSet("workflow/awardedAt", v || null)} />
          <DateField label="Start" value={kd.start} disabled={!canEdit} onChange={v => onUpdate({ anticipatedStart: v })} warn={!kd.start} />
          <DateField label="Target completion" value={kd.target} disabled={!canEdit} onChange={v => onUpdate({ targetCompletion: v })} warn={!kd.target} />
          <DateField label="Install completed" value={kd.completion} disabled={!isAdmin} onChange={v => onSet("workflow/completedAt", v || null)} hint="Set when the job enters Punch List" />
          <div>
            <div style={lab}>Parts lead time</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input aria-label="Parts lead time" type="number" min="0" disabled={!isAdmin} defaultValue={project.workflow?.leadDays ?? ""} placeholder={String(DEFAULT_LEAD_DAYS)}
                onBlur={e => onSet("workflow/leadDays", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0))} style={{ ...inp, width: 70 }} />
              <span style={{ fontSize: 12, color: C.mute }}>days</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Stages */}
      {STAGES.map(st => {
        const list = ms.filter(m => m.stage === st.id);
        const done = list.filter(m => m.done || m.na).length;
        const late = list.filter(m => m.status === "overdue").length;
        const isOpen = open.has(st.id);
        return (
          <div key={st.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 11, marginBottom: 8, overflow: "hidden" }}>
            <button onClick={() => setOpen(p => { const n = new Set(p); n.has(st.id) ? n.delete(st.id) : n.add(st.id); return n; })}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              {isOpen ? <ChevronDown size={16} style={{ color: C.mute }} /> : <ChevronRight size={16} style={{ color: C.mute }} />}
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text, flex: 1 }}>{st.label}</span>
              {late > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: C.red }}>{late} overdue</span>}
              <span style={{ fontSize: 12, fontWeight: 700, color: done === list.length ? C.green : C.sub }}>{done}/{list.length}</span>
            </button>
            {isOpen && list.map(m => {
              const s = STATUS[m.status];
              const ex = expanded === m.id;
              return (
                <div key={m.id} data-milestone={m.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: s.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setExpanded(ex ? null : m.id)}>
                      <div style={{ fontSize: 13.5, color: m.done || m.na ? C.sub : C.text, textDecoration: m.na ? "line-through" : "none" }}>{m.label}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3, alignItems: "center", fontSize: 11.5 }}>
                        <span style={{ color: s.color, fontWeight: 700 }}>
                          {m.status === "done" ? `Done${m.doneDate ? ` ${fmt(m.doneDate)}` : ""}${m.rec.by ? ` · ${m.rec.by}` : ""}` : m.status === "overdue" ? `${m.daysLate} day${m.daysLate > 1 ? "s" : ""} late · was due ${fmt(m.due)}` : m.status === "nodate" ? "No due date yet" : m.status === "na" ? "Not applicable" : `Due ${fmt(m.due)}`}
                        </span>
                        {m.gate && !m.done && !m.na && <Badge color={C.red}><Lock size={9} /> Required before {GATE_LABELS[m.gate] || m.gate}</Badge>}
                        {m.auto && <Badge color={C.blue}><Zap size={9} /> Auto</Badge>}
                        {m.rec.note && !ex && <span style={{ color: C.mute }}>📝</span>}
                      </div>
                    </div>
                    {canEdit && !m.autoDone && !m.na && (m.done
                      ? <button onClick={() => undo(m)} style={btn()}>Undo</button>
                      : <button aria-label={`Mark ${m.label} done`} onClick={() => markDone(m)} style={{ ...btn(C.greenT), borderColor: C.green }}>Mark done</button>)}
                  </div>
                  {ex && (
                    <div style={{ padding: "0 14px 12px 34px" }}>
                      <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.55, marginBottom: 8 }}>{m.help}</div>
                      <NoteBox initial={m.rec.note || ""} disabled={!canEdit} onSave={v => setRec(m, { note: v.trim() || null })} />
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                          {m.done && !m.autoDone && <DateField inline label="Done on" value={dayOf(m.rec.date)} onChange={v => setRec(m, { date: v || null })} />}
                          <DateField inline label="Due date" value={dayOf(m.rec.due)} placeholder={m.due} onChange={v => setRec(m, { due: v || null })} hint={m.rec.due ? "Overridden" : "Calculated"} />
                          <button onClick={() => setRec(m, { na: !m.na, done: null })} style={btn()}>{m.na ? "Applies to this job" : "Not applicable"}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Billing plan */}
      {canSeeMoney && <BillingPlan project={project} ctx={ctx} canEdit={canEdit} isAdmin={isAdmin} onSet={onSet} onUpdate={onUpdate} genId={genId} isMobile={isMobile} />}

      {/* Overrides */}
      {overrides.length > 0 && (
        <Section title="Overrides" note="Moves made with required steps still open.">
          {overrides.map(o => (
            <div key={o.id} style={{ fontSize: 12.5, color: C.text, padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
              <strong>{o.by || "Admin"}</strong> moved the job to <strong>{GATE_LABELS[o.to] || (phases.find(p => p.id === o.to) || {}).name || o.to}</strong> on {fmt(dayOf(o.at))}: <span style={{ color: "#fcd34d" }}>"{o.reason}"</span>
              {o.missing && o.missing.length > 0 && <div style={{ fontSize: 11.5, color: C.mute, marginTop: 2 }}>Open at the time: {o.missing.join(" · ")}</div>}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function BillingPlan({ project, ctx, canEdit, isAdmin, onSet, onUpdate, genId }) {
  const rows = billingStatus(project, ctx);
  const total = rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);
  const contract = parseFloat(String(project.contractAmount || "").replace(/[^0-9.]/g, "")) || 0;
  const setRow = (r, patch) => {
    const { id, amount, status, readySince, triggerLabel, ...stored } = r;   // eslint-disable-line no-unused-vars
    onSet(`billingPlan/items/${id}`, { ...stored, ...patch });
  };
  const invoice = r => {
    const num = window.prompt(`Invoice number for "${r.label}" (${money(r.amount)}):`);
    if (!num || !num.trim()) return;
    const date = dayOf(new Date());
    setRow(r, { invoiceNumber: num.trim(), invoicedAt: date });
    // Also record it on the Invoices tab so payment can be tracked there
    onUpdate({ invoices: [...(project.invoices || []), { id: genId(), invoiceNumber: num.trim(), amount: String(r.amount), date, description: r.label, status: "sent", createdAt: new Date().toISOString(), billingRow: r.id }] });
  };
  const S = { waiting: [C.mute, "Waiting on"], ready: [C.amber, "Ready to invoice"], late: [C.red, "Invoice is late"], invoiced: [C.green, "Invoiced"] };
  return (
    <Section title="Billing plan" note={contract ? `Milestone billing on ${money(contract)} contract. Each row is ready to invoice when its trigger is done; late after 7 days.` : "Enter the contract amount on Overview to see dollar amounts."}>
      {!rows.length ? (
        canEdit ? <button onClick={() => onSet("billingPlan", defaultBillingPlan(genId))} style={{ ...btn(C.greenT), borderColor: C.green }}>Set up billing plan (30% deposit · 40% rough-in · 30% final)</button>
          : <div style={{ fontSize: 12.5, color: C.mute }}>No billing plan yet.</div>
      ) : (
        <>
          {rows.map(r => {
            const [color, word] = S[r.status];
            return (
              <div key={r.id} data-billing={r.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "9px 0", borderTop: `1px solid ${C.line}` }}>
                <input aria-label="Billing label" disabled={!isAdmin || r.status === "invoiced"} defaultValue={r.label} onBlur={e => e.target.value.trim() && e.target.value !== r.label && setRow(r, { label: e.target.value.trim() })} style={{ ...inp, flex: "1 1 140px" }} />
                <input aria-label="Billing percent" type="number" disabled={!isAdmin || r.status === "invoiced"} defaultValue={r.pct} onBlur={e => +e.target.value !== +r.pct && setRow(r, { pct: parseFloat(e.target.value) || 0 })} style={{ ...inp, width: 64 }} />
                <span style={{ fontSize: 12, color: C.mute }}>%</span>
                <span style={{ fontSize: 13, color: C.text, fontWeight: 700, width: 90, textAlign: "right" }}>{money(r.amount)}</span>
                <select aria-label="Billing trigger" disabled={!isAdmin || r.status === "invoiced"} value={r.trigger} onChange={e => setRow(r, { trigger: e.target.value })} style={{ ...inp, flex: "1 1 180px" }}>
                  {BILLING_TRIGGERS.map(t => <option key={t.id} value={t.id}>When: {t.label}</option>)}
                </select>
                <span style={{ flexBasis: "100%", height: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 800, color, flex: 1 }}>{r.status === "invoiced" ? `${word} #${r.invoiceNumber}` : r.status === "waiting" ? `${word}: ${r.triggerLabel}` : word}</span>
                {canEdit && r.status !== "invoiced" && r.status !== "waiting" && <button onClick={() => invoice(r)} style={{ ...btn(C.amber), borderColor: C.amber }}>Mark invoiced</button>}
                {isAdmin && r.status === "invoiced" && <button onClick={() => setRow(r, { invoiceNumber: null, invoicedAt: null })} style={btn()}>Undo</button>}
                {isAdmin && r.status !== "invoiced" && <button aria-label="Remove billing row" onClick={() => onSet(`billingPlan/items/${r.id}`, null)} style={{ ...btn(), padding: "6px 8px" }}><X size={12} /></button>}
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
            {isAdmin && <button onClick={() => onSet(`billingPlan/items/${genId()}`, { label: "Progress", pct: 0, trigger: "roughIn", order: rows.length })} style={btn(C.greenT)}><Plus size={12} /> Add row</button>}
            <span style={{ fontSize: 12, color: Math.round(total) === 100 ? C.mute : C.amber }}>{Math.round(total) === 100 ? "Totals 100%" : `Totals ${total}% — should be 100%`}</span>
          </div>
        </>
      )}
    </Section>
  );
}

const lab = { fontSize: 11, color: C.mute, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 };
function DateField({ label, value, onChange, disabled, warn, hint, inline, placeholder }) {
  return (
    <div style={inline ? { display: "flex", alignItems: "center", gap: 6 } : {}}>
      <div style={inline ? { fontSize: 12, color: C.mute } : lab}>{label}</div>
      <input aria-label={label} type="date" disabled={disabled} value={value || ""} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        style={{ ...inp, width: inline ? 150 : "100%", boxSizing: "border-box", borderColor: warn ? C.amber : C.line }} />
      {hint && <div style={{ fontSize: 10.5, color: C.mute, marginTop: inline ? 0 : 3 }}>{hint}</div>}
    </div>
  );
}
function Tile({ label, value, sub, color }) {
  return (
    <div style={{ flex: "1 1 160px", background: C.card, border: `1px solid ${C.line}`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{value}</div>
      <div style={{ fontSize: 11.5, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
    </div>
  );
}
function Section({ title, note, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 11, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{title}</div>
      {note && <div style={{ fontSize: 11.5, color: C.mute, margin: "2px 0 10px" }}>{note}</div>}
      {children}
    </div>
  );
}
const Badge = ({ color, children }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 8, background: color + "22", color }}>{children}</span>;
function NoteBox({ initial, onSave, disabled }) {
  const [v, setV] = useState(initial);
  return <textarea aria-label="Milestone note" disabled={disabled} value={v} onChange={e => setV(e.target.value)} onBlur={() => v !== initial && onSave(v)} rows={2}
    placeholder="Note — who approved it, PO #, what's holding it up…" style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />;
}
