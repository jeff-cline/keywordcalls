"use client";
import { useEffect, useState } from "react";

type Daily = { date: string; cents: number };
type Cat = { category: string; cents: number };
type Camp = { group: string; name: string; delivered: number; costCents: number };
type TestCall = { id: string; fromNumber: string; toNumber: string; campaignName: string; hasRecording: boolean; at: string };
type Data = {
  twilio: { balanceCents: number; allTimeCents: number; daily: Daily[]; categories: Cat[] };
  jdi: { creditsUsed: number; spendCents: number; byCampaign: Camp[]; enteredBalance: number; remaining: number | null; centsPerCredit: number };
  testCalls: TestCall[];
};
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function AccountingView() {
  const [d, setD] = useState<Data | null>(null);
  const [bal, setBal] = useState("");
  const [cpc, setCpc] = useState("");
  const [saved, setSaved] = useState("");
  async function load() { const r = await fetch("/api/admin/accounting"); if (r.ok) setD(await r.json()); }
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  async function saveJdi() {
    const r = await fetch("/api/admin/accounting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ balance: bal || undefined, centsPerCredit: cpc || undefined }) });
    if (r.ok) { setSaved("Saved ✓"); setBal(""); setCpc(""); load(); setTimeout(() => setSaved(""), 2500); }
  }
  if (!d) return <div className="text-sm text-[color:var(--muted)]">Loading…</div>;
  const maxDay = Math.max(1, ...d.twilio.daily.map((x) => x.cents));

  return (
    <div className="space-y-6">
      {/* Balances */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Twilio balance</div><div className="text-3xl font-extrabold">{usd(d.twilio.balanceCents)}</div><div className="text-xs text-[color:var(--muted)]">live from Twilio</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Twilio spent (all-time)</div><div className="text-3xl font-extrabold">{usd(d.twilio.allTimeCents)}</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">JDI credits remaining</div><div className={`text-3xl font-extrabold ${d.jdi.remaining != null && d.jdi.remaining < 500 ? "text-[color:#dc2626]" : ""}`}>{d.jdi.remaining != null ? d.jdi.remaining.toLocaleString() : "—"}</div><div className="text-xs text-[color:var(--muted)]">{d.jdi.remaining == null ? "enter your balance below" : `${d.jdi.creditsUsed.toLocaleString()} used`}</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">JDI spend (est.)</div><div className="text-3xl font-extrabold">{usd(d.jdi.spendCents)}</div><div className="text-xs text-[color:var(--muted)]">{d.jdi.creditsUsed.toLocaleString()} drops @ {usd(d.jdi.centsPerCredit)}</div></div>
      </div>

      {/* Enter JDI balance */}
      <div className="card p-5">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-1">Sync your JDI balance</div>
        <p className="text-xs text-[color:var(--muted)] mb-3">JDI doesn&apos;t expose the balance over the API, so read the credits off your <a href="https://portal.justdeliverit.net/dashboard.php" target="_blank" rel="noopener" className="text-[color:var(--brand2)] underline">JDI portal</a> and enter it here — remaining then ticks down as new drops deliver. Re-enter whenever you top up.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="label">Current JDI credits<input className="input !w-36" value={bal} onChange={(e) => setBal(e.target.value)} placeholder="e.g. 20745" /></label>
          <label className="label">Cost per credit (¢)<input className="input !w-32" value={cpc} onChange={(e) => setCpc(e.target.value)} placeholder={`${d.jdi.centsPerCredit}`} /></label>
          <button className="btn btn-primary !py-2.5" onClick={saveJdi}>Save</button>
          {saved && <span className="text-sm text-green-700">{saved}</span>}
        </div>
      </div>

      {/* By campaign (JDI) */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">JDI spend by campaign</div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Campaign</th><th className="py-2 px-4">Delivered (credits)</th><th className="py-2 px-4">Est. cost</th></tr></thead>
          <tbody>
            {d.jdi.byCampaign.length === 0 && <tr><td colSpan={3} className="py-4 px-4 text-[color:var(--muted)]">No campaigns yet.</td></tr>}
            {d.jdi.byCampaign.map((c) => (<tr key={c.group} className="border-b border-[color:var(--line)] last:border-0"><td className="py-2 px-4 font-medium">{c.name}</td><td className="py-2 px-4">{c.delivered.toLocaleString()}</td><td className="py-2 px-4">{usd(c.costCents)}</td></tr>))}
          </tbody>
        </table></div>
      </div>

      {/* Twilio by day */}
      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Twilio spend by day (last 31)</div>
        {d.twilio.daily.length === 0 ? <div className="text-sm text-[color:var(--muted)]">No usage yet.</div> : (
          <div className="space-y-1">
            {d.twilio.daily.filter((x) => x.cents > 0).slice(0, 20).map((x) => (
              <div key={x.date} className="flex items-center gap-3 text-sm">
                <div className="w-24 text-[color:var(--muted)] shrink-0">{x.date}</div>
                <div className="flex-1 h-5 rounded bg-[color:var(--soft)] overflow-hidden"><div className="h-full rounded bg-[color:var(--brand2)]" style={{ width: `${(x.cents / maxDay) * 100}%` }} /></div>
                <div className="w-20 text-right tabular-nums">{usd(x.cents)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Twilio by category */}
      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Twilio spend this month by category</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {d.twilio.categories.length === 0 && <div className="text-sm text-[color:var(--muted)]">No spend this month.</div>}
          {d.twilio.categories.map((c) => (<div key={c.category} className="flex justify-between text-sm border-b border-[color:var(--line)] py-1"><span className="text-[color:var(--muted)]">{c.category}</span><span className="tabular-nums font-medium">{usd(c.cents)}</span></div>))}
        </div>
      </div>

      {/* Saved test calls */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Saved test calls — dialed-from number + recording</div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">When</th><th className="py-2 px-4">Dialed from</th><th className="py-2 px-4">To buyer</th><th className="py-2 px-4">Campaign</th><th className="py-2 px-4">Recording</th></tr></thead>
          <tbody>
            {d.testCalls.length === 0 && <tr><td colSpan={5} className="py-4 px-4 text-[color:var(--muted)]">No test calls yet.</td></tr>}
            {d.testCalls.map((t) => (
              <tr key={t.id} className="border-b border-[color:var(--line)] last:border-0">
                <td className="py-2 px-4 text-[color:var(--muted)] whitespace-nowrap">{new Date(t.at).toLocaleString()}</td>
                <td className="py-2 px-4 font-medium tabular-nums">{t.fromNumber}</td>
                <td className="py-2 px-4 tabular-nums">{t.toNumber || "—"}</td>
                <td className="py-2 px-4 text-[color:var(--muted)]">{t.campaignName || "—"}</td>
                <td className="py-2 px-4">{t.hasRecording ? <audio controls preload="none" src={`/api/campaigns/recording-audio?tc=${t.id}`} className="h-8" /> : <span className="text-[color:var(--muted)] text-xs">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
