import { useState } from "react";
import { Plus, X, Copy, Check, Share2, Mail, Edit2, RotateCcw, Ban } from "lucide-react";
import { putGuest, patchGuest, deleteGuest, genInviteCode } from "./db.js";
import { guestState, guestProjectIds, guestLink, guestDeviceCount, fmtDate, NO_LOGIN_MAX_DAYS } from "./guestAccess.js";

/**
 * GuestAdmin — create and manage guest links (User Admin page).
 *
 * A guest link gives one person outside the team a login that can open only
 * the jobs picked here, read the field information for them, and turn in
 * daily logs, until the end date. See guestAccess.js for what they can and
 * cannot see.
 */

const DAY = 86400000;
const LENGTHS = [[7, "1 week"], [14, "2 weeks"], [30, "30 days"], [60, "60 days"], [90, "90 days"]];
// No-login links are kept short: the link itself is the key.
const QUICK_LENGTHS = [[1, "1 day"], [3, "3 days"], [7, "1 week"], [NO_LOGIN_MAX_DAYS, "2 weeks"]];
const STATE_LABEL = { unopened: "LINK NOT OPENED", active: "ACTIVE", expired: "EXPIRED", revoked: "TURNED OFF" };
const STATE_COLOR = { unopened: "#f59e0b", active: "#69BE28", expired: "#64748b", revoked: "#ef4444" };
const isoDay = ms => { const d = new Date(Number(ms)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const endOfDay = iso => new Date(iso + "T23:59:59").getTime();

export default function GuestAdmin({ guests, projects, myName, onChange, loadError }) {
  const iS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #1A3050", background: "#0A192F", color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box" };
  const lS = { fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
  const blank = { name: "", team: "", email: "", projects: {}, days: 30, noLogin: false, showHours: false };

  const [form, setForm] = useState(null);       // null = closed. { code? , ...fields, until? }
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [fresh, setFresh] = useState("");       // code just created, to put its link front and centre

  const active = (projects || []).filter(p => !p.movedToWarranty);
  const projName = pid => { const p = (projects || []).find(x => x.id === pid); return p ? `${p.jobNumber ? "#" + p.jobNumber + " " : ""}${p.name}` : "(deleted job)"; };
  const list = Object.values(guests || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const shown = active.filter(p => !q.trim() || `${p.jobNumber || ""} ${p.name || ""} ${p.customer || ""}`.toLowerCase().includes(q.toLowerCase()));

  async function save() {
    setErr("");
    const name = form.name.trim();
    const pids = guestProjectIds(form);
    if (!name) { setErr("Enter the guest's name."); return; }
    if (!pids.length) { setErr("Pick at least one job."); return; }
    if (form.code && form.noLogin && endOfDay(form.until) > Date.now() + NO_LOGIN_MAX_DAYS * DAY) {
      setErr(`A no-login link can run at most ${NO_LOGIN_MAX_DAYS} days from today. For longer, make a sign-in guest link.`); return;
    }
    setBusy(true);
    try {
      if (form.code) {
        const upd = { name, team: form.team.trim(), email: form.email.trim(), projects: form.projects, expiresAt: endOfDay(form.until), showHours: !!form.showHours, updatedAt: Date.now() };
        await patchGuest(form.code, upd);
        onChange({ ...guests, [form.code]: { ...guests[form.code], ...upd } });
      } else {
        const code = genInviteCode();
        // A no-login link's days count from now, not to the end of the last
        // day, so "1 day" cannot quietly stretch and the 14-day limit holds.
        const expiresAt = form.noLogin ? Date.now() + form.days * DAY : endOfDay(isoDay(Date.now() + form.days * DAY));
        const g = { code, name, team: form.team.trim(), email: form.email.trim(), projects: form.projects, expiresAt, showHours: !!form.showHours, ...(form.noLogin ? { noLogin: true } : {}), createdAt: Date.now(), createdBy: myName || "" };
        await putGuest(code, g);
        onChange({ ...guests, [code]: g });
        setFresh(code);
      }
      setForm(null); setQ("");
    } catch (e) {
      setErr(`Couldn't save: ${e?.message || "unknown error"}. If this is the first guest, the database rules in this release may not be published yet.`);
    }
    setBusy(false);
  }
  async function setRevoked(g, revoked) {
    if (revoked && !confirm(`Turn off guest access for ${g.name}?\n\nThey are locked out immediately. Logs they already sent stay on the job. You can turn it back on later.`)) return;
    try { await patchGuest(g.code, { revoked }); onChange({ ...guests, [g.code]: { ...g, revoked } }); }
    catch (e) { alert("Couldn't update: " + (e?.message || "unknown error")); }
  }
  async function clearDevices(g) {
    if (!confirm(`Sign out every phone that has opened ${g.name}'s link?\n\nThe link still works: anyone who has it can open it again. To cut access off, use Turn off.`)) return;
    try { await patchGuest(g.code, { devices: null }); const n = { ...g }; delete n.devices; onChange({ ...guests, [g.code]: n }); }
    catch (e) { alert("Couldn't update: " + (e?.message || "unknown error")); }
  }
  async function resetLink(g) {
    if (!confirm(`Let ${g.name} open the link again with a different sign-in?\n\nUse this if they signed in with the wrong account or got a new phone. Whoever opened it before (${g.usedEmail || "unknown"}) loses access.`)) return;
    try { await patchGuest(g.code, { usedBy: null, usedAt: null, usedEmail: null }); const n = { ...g }; delete n.usedBy; delete n.usedAt; delete n.usedEmail; onChange({ ...guests, [g.code]: n }); }
    catch (e) { alert("Couldn't reset: " + (e?.message || "unknown error")); }
  }
  async function remove(g) {
    if (!confirm(`Delete the guest record for ${g.name}?\n\nThe link stops working for good. Logs they already sent stay on the job.`)) return;
    try { await deleteGuest(g.code); const n = { ...guests }; delete n[g.code]; onChange(n); }
    catch (e) { alert("Couldn't delete: " + (e?.message || "unknown error")); }
  }

  const message = g => `You have guest access to FWT Workspaces for ${guestProjectIds(g).map(projName).join(", ")}.\n\n${g.noLogin ? "Open this link. No sign-in needed." : "Open this link and sign in (Google, or make a password)."} You'll see the job info and can send your daily logs there:\n${guestLink(g)}\n\nAccess runs through ${fmtDate(g.expiresAt)}.${g.noLogin ? " Please don't forward this link." : ""}`;
  function copy(g) { try { navigator.clipboard?.writeText(guestLink(g)); } catch { /* ignore */ } setCopied(g.code); setTimeout(() => setCopied(""), 1800); }
  async function share(g) {
    if (navigator.share) { try { await navigator.share({ title: "FWT guest access", text: message(g) }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(message(g)); setCopied(g.code + "-msg"); setTimeout(() => setCopied(""), 1800); } catch { prompt("Copy this message:", message(g)); }
  }
  const mailto = g => `mailto:${encodeURIComponent(g.email || "")}?subject=${encodeURIComponent("FWT Workspaces guest access")}&body=${encodeURIComponent(message(g))}`;
  const sBtn = { display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 7, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" };

  return (
    <div style={{ background: "#0F2444", borderRadius: 12, border: "1px solid #1A3050", padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", flex: 1 }}>Guest Access</div>
        {!form && <button onClick={() => { setErr(""); setForm({ ...blank }); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#69BE28", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} /> New Guest Link</button>}
      </div>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.55 }}>
        For someone outside your team working one of your jobs, like a foreman borrowed from another crew. They can open only the jobs you pick: address, site info, scope, approved change order scope and shared documents. They send daily logs with photos. They cannot see pricing, other crews' logs, the schedule or any other job, and they see the hours budget only if you switch it on for them.
      </p>
      {loadError && <div style={{ fontSize: 12.5, color: "#f0a93b", background: "#f59e0b12", border: "1px solid #f59e0b33", borderRadius: 8, padding: "9px 12px", marginBottom: 12 }}>{loadError}</div>}

      {form && (
        <div style={{ background: "#0A192F", borderRadius: 10, border: "1px solid #69BE2855", padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>{form.code ? `Edit ${form.name || "guest"}` : "New guest link"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div><label style={lS}>Name *</label><input style={iS} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dave Ruiz" /></div>
            <div><label style={lS}>Whose crew or company</label><input style={iS} value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} placeholder="Roy's crew" /></div>
            <div><label style={lS}>Email (optional)</label><input style={iS} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="For sending the link" /></div>
          </div>

          <label style={lS}>Jobs they can open *</label>
          {active.length > 8 && <input style={{ ...iS, marginBottom: 8 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search jobs…" />}
          <div style={{ maxHeight: 190, overflowY: "auto", border: "1px solid #1A3050", borderRadius: 8, marginBottom: 12 }}>
            {shown.map(p => {
              const on = form.projects[p.id] === true;
              return (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid #13294d", cursor: "pointer", background: on ? "#69BE2812" : "transparent" }}>
                  <input type="checkbox" checked={on} onChange={() => { const n = { ...form.projects }; if (on) delete n[p.id]; else n[p.id] = true; setForm({ ...form, projects: n }); }} />
                  {p.jobNumber && <span style={{ fontSize: 12, fontWeight: 800, color: "#69BE28" }}>#{p.jobNumber}</span>}
                  <span style={{ fontSize: 13, color: "#e2e8f0", flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: "#475569" }}>{p.customer}</span>
                </label>
              );
            })}
            {shown.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "#475569" }}>No jobs match.</div>}
          </div>

          <label style={lS}>How they get in</label>
          {form.code
            ? <div style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 12 }}>{form.noLogin ? "No-login link" : "Sign-in required"} (set when the link was made)</div>
            : <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {[[false, "Sign-in required"], [true, "No-login link"]].map(([v, label]) => (
                  <button key={label} onClick={() => setForm({ ...form, noLogin: v, days: v ? 3 : 30 })} style={{ padding: "7px 13px", borderRadius: 8, border: form.noLogin === v ? "1.5px solid #69BE28" : "1px solid #1A3050", background: form.noLogin === v ? "#69BE2818" : "transparent", color: form.noLogin === v ? "#82CC4A" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
                ))}
              </div>}
          {form.noLogin && (
            <div style={{ fontSize: 12, color: "#f0a93b", background: "#f59e0b12", border: "1px solid #f59e0b33", borderRadius: 8, padding: "9px 12px", marginBottom: 12, lineHeight: 1.5 }}>
              The link is the key. Anyone who has it can open these jobs and send logs under this name until it ends, with no sign-in. Use it for short jobs, {NO_LOGIN_MAX_DAYS} days at most, and turn it off when the work is done.
            </div>
          )}
          {!form.noLogin && !form.code && <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 12 }}>They sign in with Google or a password. The link only works for the first account that opens it.</div>}

          <label style={lS}>{form.code ? "Access ends" : "Access length"}</label>
          {form.code
            ? <input type="date" style={{ ...iS, maxWidth: 200, marginBottom: 12 }} value={form.until} max={form.noLogin ? isoDay(Date.now() + (NO_LOGIN_MAX_DAYS - 1) * DAY) : undefined} onChange={e => setForm({ ...form, until: e.target.value })} />
            : <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {(form.noLogin ? QUICK_LENGTHS : LENGTHS).map(([d, label]) => <button key={d} onClick={() => setForm({ ...form, days: d })} style={{ padding: "7px 13px", borderRadius: 16, border: form.days === d ? "1.5px solid #69BE28" : "1px solid #1A3050", background: form.days === d ? "#69BE2818" : "transparent", color: form.days === d ? "#82CC4A" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>)}
              </div>}

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={!!form.showHours} onChange={e => setForm({ ...form, showHours: e.target.checked })} style={{ marginTop: 2 }} />
            <span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Show the hours budget</span>
              <span style={{ display: "block", fontSize: 11.5, color: "#64748b", lineHeight: 1.5 }}>They see budgeted, used and remaining hours by phase on these jobs, and get the overrun warning while logging. Still no dollars.</span>
            </span>
          </label>

          {err && <div style={{ fontSize: 12.5, color: "#fca5a5", marginBottom: 10 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setForm(null); setErr(""); setQ(""); }} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #1A3050", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={save} disabled={busy} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: busy ? "#1A3050" : "#69BE28", color: busy ? "#475569" : "#fff", fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>{busy ? "Saving…" : form.code ? "Save changes" : "Create guest link"}</button>
          </div>
        </div>
      )}

      {list.length === 0 && !form && <div style={{ fontSize: 12.5, color: "#475569" }}>No guests yet.</div>}
      {list.map(g => {
        const st = guestState(g);
        const pids = guestProjectIds(g);
        const live = st === "active" || st === "unopened";
        return (
          <div key={g.code} style={{ background: "#0A192F", borderRadius: 10, border: `1px solid ${fresh === g.code ? "#69BE2866" : "#1A3050"}`, padding: "12px 14px", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{g.name}</span>
              {g.team && <span style={{ fontSize: 12, color: "#64748b" }}>{g.team}</span>}
              <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: STATE_COLOR[st] + "22", color: STATE_COLOR[st], letterSpacing: "0.04em" }}>{STATE_LABEL[st]}</span>
              {g.noLogin && <span title="Opens without a sign-in. Anyone holding the link can use it." style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "#f59e0b22", color: "#f59e0b", letterSpacing: "0.04em" }}>NO LOGIN</span>}
              {g.showHours && <span title="Can see the hours budget on their jobs" style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "#a78bfa22", color: "#a78bfa", letterSpacing: "0.04em" }}>HOURS</span>}
              <span style={{ fontSize: 11.5, color: "#64748b", marginLeft: "auto" }}>{st === "expired" ? "ended" : "through"} {fmtDate(g.expiresAt)}</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
              {pids.map(pid => <span key={pid} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "#0F2444", border: "1px solid #1A3050", color: "#94a3b8" }}>{projName(pid)}</span>)}
            </div>
            <div style={{ fontSize: 11.5, color: "#475569", marginTop: 7 }}>
              {g.noLogin
                ? (guestDeviceCount(g) ? `Opened on ${guestDeviceCount(g)} device${guestDeviceCount(g) > 1 ? "s" : ""}` : "Not opened yet")
                : (g.usedBy ? `Opened by ${g.usedEmail || "an account"}${g.usedAt ? ` on ${fmtDate(g.usedAt)}` : ""}` : "Not opened yet")}
              {g.lastLogAt ? ` · last log ${fmtDate(g.lastLogAt)}` : (g.usedBy || guestDeviceCount(g)) ? " · no logs yet" : ""}
            </div>
            {fresh === g.code && live && <div style={{ fontSize: 12, color: "#82CC4A", fontWeight: 600, marginTop: 8 }}>Link ready. Send it to {g.name}: {g.noLogin ? "it opens straight to the job, no sign-in." : "it works for the first account that opens it."}</div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {live && <button onClick={() => copy(g)} style={{ ...sBtn, color: copied === g.code ? "#82CC4A" : "#94a3b8" }}>{copied === g.code ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}</button>}
              {live && <button onClick={() => share(g)} style={{ ...sBtn, color: copied === g.code + "-msg" ? "#82CC4A" : "#94a3b8" }}><Share2 size={12} /> {copied === g.code + "-msg" ? "Message copied" : "Text it"}</button>}
              {live && <a href={mailto(g)} style={sBtn}><Mail size={12} /> Email it</a>}
              <button onClick={() => { setErr(""); setFresh(""); setForm({ ...blank, ...g, noLogin: !!g.noLogin, showHours: !!g.showHours, team: g.team || "", email: g.email || "", projects: { ...(g.projects || {}) }, until: isoDay(Math.max(Number(g.expiresAt) || 0, Date.now())) }); }} style={sBtn}><Edit2 size={12} /> {st === "expired" ? "Extend / edit" : "Edit"}</button>
              {!g.noLogin && g.usedBy && live && <button onClick={() => resetLink(g)} style={sBtn}><RotateCcw size={12} /> Reset sign-in</button>}
              {g.noLogin && guestDeviceCount(g) > 0 && live && <button onClick={() => clearDevices(g)} style={sBtn}><RotateCcw size={12} /> Sign out devices</button>}
              {g.revoked
                ? <button onClick={() => setRevoked(g, false)} style={sBtn}><RotateCcw size={12} /> Turn back on</button>
                : <button onClick={() => setRevoked(g, true)} style={{ ...sBtn, color: "#f87171" }}><Ban size={12} /> Turn off</button>}
              <button aria-label={`Delete guest ${g.name}`} onClick={() => remove(g)} style={{ ...sBtn, border: "none", color: "#334155", marginLeft: "auto" }}><X size={13} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
