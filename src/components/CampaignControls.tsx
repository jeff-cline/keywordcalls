"use client";
import { useState } from "react";

// Customer-side: set per-keyword bids and take the campaign live (provision tracking number).
export default function CampaignControls({ keywords, bids, twilioNumber, funded, hasRouting }: { keywords: string[]; bids: Record<string, number>; twilioNumber: string; funded: boolean; hasRouting: boolean }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const k of keywords) o[k] = bids[k] ? (bids[k] / 100).toFixed(0) : "";
    return o;
  });
  const [num, setNum] = useState(twilioNumber);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function saveBids() {
    setBusy(true); setErr(null); setNote(null);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(vals)) if (v) out[k] = v;
    const res = await fetch("/api/customer/bids", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bids: out }) });
    setBusy(false);
    setNote(res.ok ? "Bids saved." : null);
    if (!res.ok) setErr("Could not save bids.");
  }

  async function goLive() {
    setBusy(true); setErr(null); setNote(null);
    const res = await fetch("/api/customer/provision", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error || "Could not go live."); return; }
    setNum(j.number); setNote(`You're live on ${j.number}! 🚀`);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="label mb-1">What you&apos;ll pay per call</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {keywords.length === 0 && <div className="text-sm text-[color:var(--muted)]">No keywords on your campaign yet.</div>}
          {keywords.map((k) => (
            <div key={k} className="flex items-center gap-2 rounded-lg border border-[color:var(--line)] p-2">
              <span className="flex-1 text-sm font-medium">{k}</span>
              <span className="flex items-center gap-1 text-sm">$<input className="input !py-1 w-24" value={vals[k] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [k]: e.target.value }))} placeholder="per call" /></span>
            </div>
          ))}
        </div>
        {keywords.length > 0 && <button className="btn btn-ghost text-sm mt-2" disabled={busy} onClick={saveBids}>Save bids</button>}
      </div>

      <div className="border-t border-[color:var(--line)] pt-4">
        <div className="label mb-1">Your tracking number</div>
        {num
          ? <div className="text-lg font-bold">{num} <span className="rounded-full bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 align-middle">live</span></div>
          : funded && hasRouting
            ? <button className="btn btn-primary" disabled={busy} onClick={goLive}>{busy ? "Going live…" : "Go live — get my number 🚀"}</button>
            : <div className="text-sm text-[color:var(--muted)]">{!hasRouting ? "Add a routing number first, then " : "Fund your account, then "}you can take your campaign live.</div>}
      </div>

      {note && <div className="text-sm text-green-700">{note}</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
    </div>
  );
}
