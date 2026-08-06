"use client";
import { useEffect, useState } from "react";

type Biz = { total: number; lists: { name: string; rowCount: number }[]; sample: { name: string; phone: string; email: string; city: string; state: string }[] };
type ConsumerRow = { name: string; phone: string; email: string; city: string; state: string; connectSec: number; billable: boolean; revenueCents: number; at: string };
type Consumer = { count: number; revenueCents: number; rows: ConsumerRow[] };
type Data = { business: Biz; consumer: Consumer };

const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const mask = (n: string) => (n && n.length >= 4 ? `${n.slice(0, -4)}••${n.slice(-2)}` : n || "—");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function LeadsTabs() {
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<"business" | "consumer">("consumer");
  useEffect(() => {
    let on = true;
    const load = async () => { const r = await fetch("/api/admin/leads"); if (r.ok && on) setD(await r.json()); };
    load(); const id = setInterval(load, 8000); return () => { on = false; clearInterval(id); };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => setTab("consumer")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === "consumer" ? "bg-[color:var(--brand2)] text-white" : "bg-[color:var(--soft)] text-[color:var(--ink)]"}`}>💰 Consumer leads{d ? ` (${d.consumer.count})` : ""}</button>
        <button onClick={() => setTab("business")} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === "business" ? "bg-[color:var(--brand2)] text-white" : "bg-[color:var(--soft)] text-[color:var(--ink)]"}`}>🏢 Business leads{d ? ` (${d.business.total.toLocaleString()})` : ""}</button>
      </div>

      {tab === "consumer" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Connected consumer leads</div><div className="text-3xl font-extrabold">{d?.consumer.count ?? "—"}</div><div className="text-xs text-[color:var(--muted)]">called back &amp; talked to an agent</div></div>
            <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Revenue from these leads</div><div className="text-3xl font-extrabold text-[color:#16a34a]">{d ? usd(d.consumer.revenueCents) : "—"}</div><div className="text-xs text-[color:var(--muted)]">billable connects (120s+) × bid</div></div>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="p-4 text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Consumer leads — connected callbacks (Core-appended)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Name</th><th className="py-2 px-4">Phone</th><th className="py-2 px-4">Email</th><th className="py-2 px-4">Location</th><th className="py-2 px-4">Talk time</th><th className="py-2 px-4">Revenue</th><th className="py-2 px-4">When</th></tr></thead>
                <tbody>
                  {d && d.consumer.rows.length === 0 && <tr><td colSpan={7} className="py-6 px-4 text-[color:var(--muted)]">No connected consumer leads yet — they appear here when a callback talks to an agent.</td></tr>}
                  {(d?.consumer.rows || []).map((r, i) => (
                    <tr key={i} className="border-b border-[color:var(--line)] last:border-0">
                      <td className="py-2 px-4 font-medium">{r.name || <span className="text-[color:var(--muted)]">unknown</span>}</td>
                      <td className="py-2 px-4">{mask(r.phone)}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)]">{r.email || "—"}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)]">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="py-2 px-4"><span className={r.connectSec >= 120 ? "text-[color:#16a34a] font-bold" : ""}>{mmss(r.connectSec)}</span></td>
                      <td className="py-2 px-4 font-semibold text-[color:#16a34a]">{r.revenueCents ? usd(r.revenueCents) : <span className="text-[color:var(--muted)] font-normal">—</span>}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)] whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card p-5">
            <div className="text-xs uppercase text-[color:var(--muted)] mb-1">Business leads (prospect pool)</div>
            <div className="text-3xl font-extrabold">{d ? d.business.total.toLocaleString() : "—"}</div>
            <div className="text-xs text-[color:var(--muted)] mt-2">{(d?.business.lists || []).map((l) => `${l.name} (${l.rowCount.toLocaleString()})`).join(" · ") || "no lists yet"}</div>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="p-4 text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Business leads — everyone we&apos;re reaching out to (first 200)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Name</th><th className="py-2 px-4">Phone</th><th className="py-2 px-4">Email</th><th className="py-2 px-4">Location</th></tr></thead>
                <tbody>
                  {d && d.business.sample.length === 0 && <tr><td colSpan={4} className="py-6 px-4 text-[color:var(--muted)]">No business leads uploaded yet.</td></tr>}
                  {(d?.business.sample || []).map((r, i) => (
                    <tr key={i} className="border-b border-[color:var(--line)] last:border-0">
                      <td className="py-2 px-4 font-medium">{r.name || <span className="text-[color:var(--muted)]">unknown</span>}</td>
                      <td className="py-2 px-4">{mask(r.phone)}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)]">{r.email || "—"}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)]">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
