"use client";
import { useState } from "react";

type Plan = { id: string; name: string; priceCents: number };
const US = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
type Row = {
  accountId: string; customerId: string; name: string; email: string; phone: string;
  keywords: string[]; status: string; twilioNumber: string; routingNumber: string; balanceCents: number; calls: number;
};

const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 0 });
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const badge: Record<string, string> = { live: "bg-green-100 text-green-800", funded: "bg-blue-100 text-blue-800", new: "bg-gray-100 text-gray-700", paused: "bg-amber-100 text-amber-800" };

export default function AdminCustomers({ plans, rows }: { plans: Plan[]; rows: Row[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function viewCustomer(accountId: string) {
    setDetail(null); setDetailLoading(true);
    const res = await fetch(`/api/admin/customer/${accountId}`);
    const j = await res.json().catch(() => null);
    setDetailLoading(false);
    if (res.ok) setDetail(j); else alert(j?.error || "Could not load customer.");
  }
  async function impersonate(accountId: string) {
    const res = await fetch("/api/admin/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { alert(j.error || "Could not impersonate."); return; }
    location.href = j.redirect || "/dashboard";
  }

  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", city: "", geoType: "local", routingNumber: "", planId: "", start: "09:00", end: "18:00", fundDollars: "", tempPassword: "", activate: true });
  const [days, setDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [kw, setKw] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [bids, setBids] = useState<Record<string, string>>({});
  const [geoStates, setGeoStates] = useState<string[]>([]);
  const [geoExclude, setGeoExclude] = useState<string[]>([]);
  const [zips, setZips] = useState<string[]>([]);
  const [zipInput, setZipInput] = useState("");

  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const toggleDay = (d: string) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  const toggle = (arr: string[], v: string, s: (x: string[]) => void) => s(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  function commitKw(raw: string) { const parts = raw.split(",").map((s) => s.trim()).filter(Boolean); if (!parts.length) return; const nk = [...kw]; const nb = { ...bids }; for (const p of parts) if (!nk.some((x) => x.toLowerCase() === p.toLowerCase())) { nk.push(p); nb[p] = nb[p] ?? ""; } setKw(nk); setBids(nb); setKwInput(""); }
  const removeKw = (w: string) => { setKw(kw.filter((x) => x !== w)); setBids((p) => { const n = { ...p }; delete n[w]; return n; }); };
  function commitZip(raw: string) { const parts = raw.split(",").map((s) => s.replace(/[^0-9]/g, "").slice(0, 5)).filter((s) => s.length >= 3); if (!parts.length) return; setZips([...new Set([...zips, ...parts])]); setZipInput(""); }
  const pickState = (s: string) => { if (f.geoType === "statewide") setGeoStates([s]); else if (f.geoType === "regional") { if (geoStates.includes(s)) setGeoStates(geoStates.filter((x) => x !== s)); else if (geoStates.length < 3) setGeoStates([...geoStates, s]); } };

  async function submit() {
    setBusy(true); setErr(null); setMsg(null);
    const bidsOut: Record<string, string> = {};
    for (const k of kw) if (bids[k]) bidsOut[k] = bids[k];
    const payload = {
      ...f, keywords: kw, bids: bidsOut,
      geoStates, geoZips: zips, geoExcludeStates: geoExclude,
      hours: { days, start: f.start, end: f.end },
    };
    const res = await fetch("/api/admin/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error || "Failed to create."); return; }
    let m = `Created ${f.email}. Temp password: ${j.tempPassword} (they change it on first login).`;
    if (j.activation) m += j.activation.ok ? ` Campaign LIVE on ${j.activation.number}.` : ` Activation failed: ${j.activation.error}`;
    setMsg(m);
    setTimeout(() => location.reload(), 1800);
  }

  async function act(customerId: string, action: string, dollars?: string) {
    if (!customerId) return;
    const res = await fetch("/api/admin/customers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, action, dollars }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) { alert(j.error || "Action failed."); return; }
    if (action === "activate" && j.number) alert(`Campaign live on ${j.number}.`);
    location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "+ New customer / upload"}</button>
      </div>

      {open && (
        <div className="card p-6 space-y-5">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Create account &amp; start campaign</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">First name<input className="input" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
            <label className="label">Last name<input className="input" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
            <label className="label">Email<input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
            <label className="label">Phone<input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="area code sets their number" /></label>
            <label className="label">City<input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} /></label>
          </div>

          {/* Money words (typed) + bid per call */}
          <div>
            <div className="label mb-1">Keywords (money words) &amp; bid per call</div>
            <input className="input" value={kwInput} placeholder="Type a keyword, press Enter (e.g. Roofing, Regenerative Medicine)"
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitKw(kwInput); } }}
              onBlur={() => commitKw(kwInput)} />
            {kw.length > 0 && (
              <div className="mt-2 space-y-2">
                {kw.map((w) => (
                  <div key={w} className="flex items-center gap-2 rounded-lg border border-[color:var(--line)] p-2">
                    <span className="flex-1 text-sm font-medium">{w}</span>
                    <span className="flex items-center gap-1 text-sm">$<input className="input !py-1 w-24" value={bids[w] ?? ""} onChange={(e) => setBids((p) => ({ ...p, [w]: e.target.value }))} placeholder="per call" /></span>
                    <button type="button" className="text-[color:var(--muted)] text-lg leading-none" onClick={() => removeKw(w)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">Coverage
              <select className="input" value={f.geoType} onChange={(e) => { set("geoType", e.target.value); setGeoStates([]); setGeoExclude([]); }}>
                <option value="local">Local</option><option value="statewide">Statewide</option><option value="regional">Regional</option><option value="national">National</option>
              </select>
            </label>
            <label className="label">Routing number (calls go here)<input className="input" value={f.routingNumber} onChange={(e) => set("routingNumber", e.target.value)} placeholder="+1…" /></label>
            <label className="label">Plan
              <select className="input" value={f.planId} onChange={(e) => set("planId", e.target.value)}>
                <option value="">— none —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {usd(p.priceCents)}/mo</option>)}
              </select>
            </label>
          </div>

          {/* Geo detail by coverage */}
          {f.geoType === "local" && (
            <div>
              <div className="label mb-1">ZIP code(s) — routes by ZIP</div>
              <input className="input" value={zipInput} placeholder="e.g. 75201, 75204"
                onChange={(e) => setZipInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitZip(zipInput); } }}
                onBlur={() => commitZip(zipInput)} />
              {zips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{zips.map((z) => <span key={z} className="rounded-full bg-[color:var(--brand)] text-white text-xs font-semibold px-2.5 py-1">{z}<button type="button" className="ml-1" onClick={() => setZips(zips.filter((x) => x !== z))}>×</button></span>)}</div>}
            </div>
          )}
          {(f.geoType === "statewide" || f.geoType === "regional") && (
            <div>
              <div className="label mb-1">{f.geoType === "statewide" ? "State" : "Up to 3 states"} ({geoStates.join(", ") || "none"})</div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">{US.map((s) => <button key={s} type="button" onClick={() => pickState(s)} className={`rounded px-2 py-1 text-xs border ${geoStates.includes(s) ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)]"}`}>{s}</button>)}</div>
            </div>
          )}
          {f.geoType === "national" && (
            <div>
              <div className="label mb-1">Nationwide — exclude states {geoExclude.length ? `(excluding ${geoExclude.join(", ")})` : "(all 50 included)"}</div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">{US.map((s) => <button key={s} type="button" onClick={() => toggle(geoExclude, s, setGeoExclude)} className={`rounded px-2 py-1 text-xs border ${geoExclude.includes(s) ? "bg-red-500 text-white border-red-500 line-through" : "border-[color:var(--line)]"}`}>{s}</button>)}</div>
            </div>
          )}

          <div>
            <div className="label mb-1">Call hours</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {DAYS.map((d) => <button key={d} type="button" onClick={() => toggleDay(d)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${days.includes(d) ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)]"}`}>{d}</button>)}
            </div>
            <div className="flex items-center gap-2 text-sm"><input type="time" className="input !w-auto" value={f.start} onChange={(e) => set("start", e.target.value)} /><span>to</span><input type="time" className="input !w-auto" value={f.end} onChange={(e) => set("end", e.target.value)} /><span className="text-xs text-[color:var(--muted)]">Central</span></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">Starting funds ($)<input className="input" value={f.fundDollars} onChange={(e) => set("fundDollars", e.target.value)} placeholder="e.g. 500" /></label>
            <label className="label">Temp password<input className="input" value={f.tempPassword} onChange={(e) => set("tempPassword", e.target.value)} placeholder="TEMP!234" /></label>
          </div>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activate} onChange={(e) => set("activate", e.target.checked)} /> Start the campaign now (buys an area-code number + alerts you by call, text &amp; email)</label>

          {err && <div className="text-sm text-red-600">{err}</div>}
          {msg && <div className="text-sm text-green-700">{msg}</div>}
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create & start"}</button>
        </div>
      )}

      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">All customers</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)]"><th className="py-2">Name</th><th className="py-2">Status</th><th className="py-2">Tracking #</th><th className="py-2">Calls</th><th className="py-2">Balance</th><th className="py-2">Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="py-4 text-[color:var(--muted)]">No customers yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.accountId} className="border-b border-[color:var(--line)] last:border-0 align-top">
                  <td className="py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-[color:var(--muted)]">{r.email}</div><div className="text-xs text-[color:var(--muted)]">{r.keywords.join(", ")}</div></td>
                  <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[r.status] || "bg-gray-100 text-gray-700"}`}>{r.status}</span></td>
                  <td className="py-2">{r.twilioNumber || <span className="text-[color:var(--muted)]">—</span>}</td>
                  <td className="py-2">{r.calls}</td>
                  <td className="py-2">{usd(r.balanceCents)}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => viewCustomer(r.accountId)}>View</button>
                      <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => impersonate(r.accountId)}>Log in as</button>
                      {r.status !== "live" && <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => act(r.customerId, "activate")}>Activate</button>}
                      {r.status === "live" && <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => act(r.customerId, "pause")}>Pause</button>}
                      {r.status === "paused" && <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => act(r.customerId, "resume")}>Resume</button>}
                      <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => { const d = prompt("Credit amount ($, negative to debit):"); if (d) act(r.customerId, "credit", d); }}>+$</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4" onClick={() => { setDetail(null); setDetailLoading(false); }}>
          <div className="card w-full max-w-2xl my-8 p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {detailLoading && <div className="p-8 text-center text-[color:var(--muted)]">Loading…</div>}
            {detail && (
              <>
                <div className="flex items-start justify-between gap-3 p-5 border-b border-[color:var(--line)]">
                  <div>
                    <div className="text-lg font-bold">{detail.account.name || detail.account.email}</div>
                    <div className="text-sm text-[color:var(--muted)]">{detail.account.email} · {detail.account.phone || "no phone"}</div>
                    <div className="text-xs text-[color:var(--muted)]">{[detail.account.city, detail.account.state, detail.account.zip].filter(Boolean).join(", ")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[detail.customer.status] || "bg-gray-100 text-gray-700"}`}>{detail.customer.status}</span>
                    <button className="btn btn-primary !py-1 !px-3 text-xs" onClick={() => impersonate(detail.account.id)}>Log in as</button>
                    <button className="text-[color:var(--muted)] text-xl leading-none" onClick={() => setDetail(null)}>×</button>
                  </div>
                </div>
                <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><div className="label">Balance</div><div className="text-2xl font-extrabold">{usd(detail.customer.balanceCents)}</div>{detail.customer.callsOfHeadroom != null && <div className="text-xs text-[color:var(--muted)]">≈ {detail.customer.callsOfHeadroom} calls of headroom{detail.customer.balanceCents < detail.customer.lowThresholdCents ? " · ⚠️ running low" : ""}</div>}</div>
                    <div><div className="label">Tracking number</div><div className="font-medium">{detail.customer.twilioNumber || "—"}</div><div className="text-xs text-[color:var(--muted)]">routes to {detail.customer.routingNumber || "—"}</div></div>
                    <div><div className="label">Keywords &amp; bids</div><div className="font-medium">{detail.customer.keywords.length ? detail.customer.keywords.map((k: string) => `${k} ($${((detail.customer.bids[k] || 0) / 100).toFixed(0)})`).join(", ") : "—"}</div></div>
                    <div><div className="label">Coverage</div><div className="font-medium capitalize">{detail.customer.geoType}{detail.customer.geoStates.length ? ` · ${detail.customer.geoStates.join(", ")}` : ""}</div></div>
                    <div><div className="label">Call hours</div><div className="font-medium">{detail.customer.hours.start ? `${(detail.customer.hours.days || []).join(", ") || "every day"} · ${detail.customer.hours.start}–${detail.customer.hours.end}` : "always on"}</div></div>
                    <div><div className="label">Auto top-up</div><div className="font-medium">{detail.customer.autoTopUp ? `On · $${(detail.customer.autoTopUpAmountCents / 100).toFixed(0)}` : "Off"}</div></div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 text-center">
                    <div className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-xs uppercase text-[color:var(--muted)]">Billed calls</div><div className="text-xl font-bold">{detail.stats.billedCalls}</div></div>
                    <div className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-xs uppercase text-[color:var(--muted)]">Revenue</div><div className="text-xl font-bold">{usd(detail.stats.revenueCents)}</div></div>
                    <div className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-xs uppercase text-[color:var(--muted)]">Twilio cost</div><div className="text-xl font-bold">{usd(detail.stats.costCents)}</div></div>
                  </div>

                  <div>
                    <div className="label mb-1">Recent calls</div>
                    <div className="text-sm">
                      {detail.calls.length === 0 && <div className="text-[color:var(--muted)]">No calls yet.</div>}
                      {detail.calls.map((c: any) => (
                        <div key={c.id} className="flex justify-between border-b border-[color:var(--line)] py-1 last:border-0">
                          <span className="text-[color:var(--muted)]">{new Date(c.at).toLocaleString()}</span>
                          <span>{c.from} · {c.keyword || "—"}</span>
                          <span>{c.billed ? usd(c.chargedCents) : c.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="label mb-1">Ledger</div>
                    <div className="text-sm">
                      {detail.ledger.length === 0 && <div className="text-[color:var(--muted)]">No entries.</div>}
                      {detail.ledger.map((l: any) => (
                        <div key={l.id} className="flex justify-between border-b border-[color:var(--line)] py-1 last:border-0">
                          <span className="text-[color:var(--muted)]">{new Date(l.at).toLocaleDateString()}</span>
                          <span className="capitalize">{l.kind}{l.note ? ` · ${l.note}` : ""}</span>
                          <span className={l.amountCents < 0 ? "text-red-600" : "text-green-700"}>{l.amountCents < 0 ? "-" : "+"}{usd(Math.abs(l.amountCents))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
