"use client";
import { useEffect, useMemo, useState } from "react";
import RecordButton from "@/components/RecordButton";

type CB = { phone: string; name: string; email: string; city: string; state: string; landedAt: string; connectSec: number; billable: boolean; at: string };
type Batch = { id: string; label: string; size: number; throttle: number; launchedAt: string };
type Data = {
  campaign: { id: string; name: string; hasAudio: boolean; campaignNumber: string; listCount: number; sentTotal: number; remaining: number } | null;
  delivered: number; filtered: number; billableCount: number; batches: Batch[]; callbacks: CB[];
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const mask = (n: string) => (n && n.length >= 4 ? `${n.slice(0, -4)}••${n.slice(-2)}` : n || "unknown");
const HOUR = 3600e3, DAY = 24 * HOUR;

export default function RolloutConsole() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [goal, setGoal] = useState("3");
  const [customAmt, setCustomAmt] = useState("1000");
  const [customThr, setCustomThr] = useState("1000");

  async function load() { const r = await fetch("/api/rollout/data"); if (r.ok) setD(await r.json()); }
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, []);

  async function launch(size: number, throttle: number, label: string) {
    if (!d?.campaign) return;
    if (!confirm(`Launch ${size} REAL ringless voicemails now (throttled to ${throttle}/hr)?`)) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/rollout/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: d.campaign.id, size, throttle, label }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `🚀 Launched ${j.sent} — watch the callbacks roll in.` : (j.error || "Launch failed."));
    load();
  }

  const cbs = d?.callbacks || [];
  const t0 = d?.batches[0] ? new Date(d.batches[0].launchedAt).getTime() : (cbs[0] ? new Date(cbs[0].at).getTime() : 0);
  const now = Date.now();
  const elapsedH = t0 ? Math.max(0.01, (now - t0) / HOUR) : 0;

  const win = (ms: number) => (t0 ? cbs.filter((c) => new Date(c.at).getTime() <= t0 + ms).length : 0);
  const sent = d?.campaign?.sentTotal || 0;
  const delivered = d?.delivered || 0;
  const callbacks = cbs.length;
  const billable = d?.billableCount || 0;
  const rate = delivered ? billable / delivered : 0;        // BILLABLE calls (120s+) per delivered drop
  const perHour = t0 ? billable / elapsedH : 0;             // billable calls/hour (the goal metric)
  const neededSends = rate > 0 ? Math.ceil((parseFloat(goal) || 0) / rate) : 0; // drops to yield goal billable calls

  // per-hour buckets since t0 (cap 48 bars)
  const { bars, cum } = useMemo(() => {
    if (!t0 || cbs.length === 0) return { bars: [] as number[], cum: [] as { t: number; n: number }[] };
    const hours = Math.min(48, Math.ceil((now - t0) / HOUR) + 1);
    const bars = Array(hours).fill(0);
    const cum: { t: number; n: number }[] = [];
    let running = 0;
    for (const c of cbs) { const h = Math.floor((new Date(c.at).getTime() - t0) / HOUR); if (h >= 0 && h < hours) bars[h]++; running++; cum.push({ t: (new Date(c.at).getTime() - t0) / HOUR, n: running }); }
    return { bars, cum };
  }, [cbs, t0, now]);

  const maxBar = Math.max(1, ...bars);
  const cumMax = Math.max(1, callbacks);
  const cumSpanH = Math.max(1, cum.length ? cum[cum.length - 1].t : 1);

  return (
    <div className="space-y-6">
      {/* Record outbound voicemail — right here */}
      {d?.campaign && (
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-2">Outbound voicemail</div>
          {d.campaign.hasAudio && <div className="text-sm text-[color:#16a34a] mb-2">✓ Recorded — re-record any time below.</div>}
          <RecordButton campaignId={d.campaign.id} type="outbound" existingUrl="" label="Record your outbound voicemail" />
        </div>
      )}

      {/* Launch */}
      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Launch batches — {d?.campaign?.name || "…"}</div>
          <div className="text-xs text-[color:var(--muted)]">{d?.campaign ? `${sent.toLocaleString()} sent · ${d.campaign.remaining.toLocaleString()} left in list` : ""}</div>
        </div>
        {!d?.campaign?.hasAudio && <div className="text-sm text-amber-700 mb-3">⚠️ Record the outbound voicemail above before launching.</div>}
        <div className="grid gap-3 sm:grid-cols-3">
          <button className="btn btn-primary !py-3 text-base" disabled={busy || !d?.campaign?.hasAudio} onClick={() => launch(100, 300, "Batch 1 · 100 / 20 min")}>🚀 Batch 1 (100)</button>
          <button className="btn btn-primary !py-3 text-base" disabled={busy || !d?.campaign?.hasAudio} onClick={() => launch(500, 500, "Batch 2 · 500 / hr")}>🚀 Batch 2 (500)</button>
          <button className="btn !bg-[color:#ff7a1a] text-white !border-0 !py-3 text-base" disabled={busy || !d?.campaign?.hasAudio} onClick={() => launch(1000, 1000, "Batch 3 · 1,000")}>🚀 Batch 3 (1,000)</button>
        </div>

        {/* Custom batch — pick any amount of the remaining leads */}
        <div className="mt-4 rounded-xl bg-[color:var(--soft)] p-4">
          <div className="text-sm font-semibold mb-2">Custom batch (Batch {(d?.batches.length || 0) + 1}) — {d?.campaign?.remaining.toLocaleString() || 0} leads left</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="label">How many to send<input className="input !w-32" value={customAmt} onChange={(e) => setCustomAmt(e.target.value)} placeholder="e.g. 2500" /></label>
            <label className="label">Per hour (throttle)<input className="input !w-32" value={customThr} onChange={(e) => setCustomThr(e.target.value)} /></label>
            <button className="btn btn-primary !py-2.5" disabled={busy || !d?.campaign?.hasAudio} onClick={() => { const n = parseInt(customAmt, 10) || 0; if (n > 0) launch(n, parseInt(customThr, 10) || 1000, `Batch ${(d?.batches.length || 0) + 1} · ${n.toLocaleString()}`); }}>🚀 Go — custom</button>
          </div>
        </div>

        {msg && <div className="text-sm text-green-700 mt-2">{msg}</div>}
        {d?.campaign?.campaignNumber && <div className="text-xs text-[color:var(--muted)] mt-2">Callback number: {d.campaign.campaignNumber}</div>}
      </div>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-5">
        <Stat label="Sent" value={sent.toLocaleString()} />
        <Stat label="Delivered (ringless)" value={delivered.toLocaleString()} sub={d?.filtered ? `${d.filtered.toLocaleString()} DNC-scrubbed` : ""} color="#16a34a" />
        <Stat label="Callbacks" value={callbacks.toLocaleString()} color="#2f6bff" />
        <Stat label="Billable (120s+)" value={(d?.billableCount || 0).toLocaleString()} sub="counts toward the goal" color="#16a34a" />
        <Stat label="Calls / hour" value={perHour ? perHour.toFixed(1) : "—"} sub={t0 ? `over ${elapsedH.toFixed(1)}h` : ""} color="#ff7a1a" />
      </div>

      {/* Time windows */}
      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Callbacks by time window (30-day tracking)</div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
          {[["1 hour", HOUR], ["8 hours", 8 * HOUR], ["2 days", 2 * DAY], ["7 days", 7 * DAY], ["30 days", 30 * DAY]].map(([lbl, ms]) => (
            <div key={lbl as string} className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-2xl font-extrabold">{win(ms as number)}</div><div className="text-[11px] uppercase text-[color:var(--muted)]">{lbl}</div></div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Callbacks per hour</div>
          {bars.length === 0 ? <div className="text-sm text-[color:var(--muted)] py-8 text-center">Launch a batch to start collecting data.</div> : (
            <div className="flex items-end gap-1 h-40">
              {bars.map((v, i) => <div key={i} className="flex-1 rounded-t bg-[color:var(--brand2)]" style={{ height: `${(v / maxBar) * 100}%` }} title={`hr ${i}: ${v}`} />)}
            </div>
          )}
          <div className="text-[11px] text-[color:var(--muted)] mt-1">hours since first launch →</div>
        </div>
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Cumulative callbacks</div>
          {cum.length === 0 ? <div className="text-sm text-[color:var(--muted)] py-8 text-center">No callbacks yet.</div> : (
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-40">
              <polyline fill="rgba(47,107,255,0.15)" stroke="none" points={`0,40 ${cum.map((p) => `${(p.t / cumSpanH) * 100},${40 - (p.n / cumMax) * 38}`).join(" ")} 100,40`} />
              <polyline fill="none" stroke="#2f6bff" strokeWidth="0.8" points={cum.map((p) => `${(p.t / cumSpanH) * 100},${40 - (p.n / cumMax) * 38}`).join(" ")} />
            </svg>
          )}
        </div>
      </div>

      {/* Goal calculator */}
      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-2">Goal → how many to send</div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>I want</span><input className="input !w-20 !py-1" value={goal} onChange={(e) => setGoal(e.target.value)} /><span>billable calls (120s+) / hour.</span>
          <span className="text-[color:var(--muted)]">Observed billable rate: <b className="text-[color:var(--ink)]">{(rate * 100).toFixed(2)}%</b> of delivered.</span>
        </div>
        <div className="mt-3 text-lg">
          {rate > 0
            ? <>To net <b>{goal}</b> billable calls you need to deliver <b className="text-[color:var(--brand2)]">{neededSends.toLocaleString()}</b> ringless drops. At {perHour.toFixed(1)} billable calls/hr observed, scale sends proportionally.</>
            : <span className="text-[color:var(--muted)]">Collecting data — the billable rate appears once 120s+ callbacks come in.</span>}
        </div>
      </div>

      {/* Live callbacks + append */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Callbacks — who called, where it landed, how long they talked</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">When</th><th className="py-2 px-4">Name</th><th className="py-2 px-4">Caller</th><th className="py-2 px-4">Landed at</th><th className="py-2 px-4">Talk time</th><th className="py-2 px-4">Bill?</th></tr></thead>
            <tbody>
              {cbs.length === 0 && <tr><td colSpan={6} className="py-6 px-4 text-[color:var(--muted)]">No callbacks yet.</td></tr>}
              {[...cbs].reverse().slice(0, 100).map((c, i) => (
                <tr key={i} className="border-b border-[color:var(--line)] last:border-0">
                  <td className="py-2 px-4 text-[color:var(--muted)] whitespace-nowrap">{new Date(c.at).toLocaleTimeString()}</td>
                  <td className="py-2 px-4 font-medium">{c.name || <span className="text-[color:var(--muted)]">unknown</span>}{c.state ? <span className="text-[color:var(--muted)] font-normal text-xs"> · {c.state}</span> : null}</td>
                  <td className="py-2 px-4">{mask(c.phone)}</td>
                  <td className="py-2 px-4 text-[color:var(--muted)]">{c.landedAt || "—"}</td>
                  <td className="py-2 px-4 font-medium">{c.connectSec ? mmss(c.connectSec) : <span className="text-[color:var(--muted)]">—</span>}</td>
                  <td className="py-2 px-4">{c.billable ? <span className="rounded-full bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5">✓ 120s+</span> : c.connectSec ? <span className="text-[color:var(--muted)] text-xs">under 120s</span> : <span className="text-[color:var(--muted)] text-xs">…</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color = "#0f1115" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">{label}</div><div className="text-3xl font-extrabold" style={{ color }}>{value}</div>{sub ? <div className="text-xs text-[color:var(--muted)]">{sub}</div> : null}</div>
  );
}
