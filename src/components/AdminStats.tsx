"use client";
import { useEffect, useState } from "react";
import type { AdminStats } from "@/lib/adminStats";

const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

// Live-updating economics cards — polls /api/admin/stats every 5s so revenue/cost/margin/ROAS
// move in real time as rollout callbacks bill and drops deliver.
export default function AdminStats({ initial }: { initial: AdminStats }) {
  const [d, setD] = useState<AdminStats>(initial);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let on = true;
    const load = async () => { const r = await fetch("/api/admin/stats"); if (r.ok && on) { setD(await r.json()); setLive(true); } };
    load(); const id = setInterval(load, 5000); return () => { on = false; clearInterval(id); };
  }, []);

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
        <span className={`inline-block w-2 h-2 rounded-full ${live ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
        {live ? "Live — updates every 5s" : "Loading…"}
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Revenue</div><div className="text-3xl font-extrabold">{usd(d.revenueCents)}</div><div className="text-xs text-[color:var(--muted)]">{d.billedCount} billed · rollout {usd(d.rolloutRevenueCents)}</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Cost to run</div><div className="text-3xl font-extrabold">{usd(d.costCents)}</div><div className="text-xs text-[color:var(--muted)]">ringless {usd(d.ringlessCostCents)} · Twilio {usd(d.twilioCostCents)} · email {usd(d.emailCostCents)}</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Margin</div><div className={`text-3xl font-extrabold ${d.marginCents >= 0 ? "text-[color:#16a34a]" : "text-[color:#dc2626]"}`}>{usd(d.marginCents)}</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">ROAS</div><div className="text-3xl font-extrabold">{d.roas ? d.roas.toFixed(1) + "×" : "—"}</div><div className="text-xs text-[color:var(--muted)]">revenue ÷ cost</div></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Rollout callbacks</div><div className="text-3xl font-extrabold">{d.rolloutCallbacks}</div><div className="text-xs text-[color:var(--muted)]">{d.rolloutBillable} billable (120s+)</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Ringless delivered</div><div className="text-3xl font-extrabold">{d.rolloutDelivered.toLocaleString()}</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Live campaigns</div><div className="text-3xl font-extrabold">{d.liveCampaigns}<span className="text-base font-medium text-[color:var(--muted)]"> / {d.customers}</span></div></div>
        <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Customer balances</div><div className="text-3xl font-extrabold">{usd(d.balanceCents)}</div><div className="text-xs text-[color:var(--muted)]">funds on hand</div></div>
      </div>
    </>
  );
}
