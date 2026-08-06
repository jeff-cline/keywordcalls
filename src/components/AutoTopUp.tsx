"use client";
import { useState } from "react";

// Customer preference: auto-refill when balance runs low. Charges a saved card once one is on file.
export default function AutoTopUp({ enabled, amountDollars }: { enabled: boolean; amountDollars: number }) {
  const [on, setOn] = useState(enabled);
  const [amt, setAmt] = useState(amountDollars ? String(amountDollars) : "500");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save(next: boolean) {
    setBusy(true); setNote(null);
    const res = await fetch("/api/customer/autotopup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next, amountDollars: amt }) });
    setBusy(false);
    if (res.ok) { setOn(next); setNote(next ? "Auto top-up on." : "Auto top-up off."); }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} onClick={() => save(!on)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? "bg-[color:var(--brand)]" : "bg-gray-300"}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${on ? "translate-x-5" : "translate-x-1"}`} />
      </button>
      <span className="text-sm">Auto top-up when I&apos;m running low</span>
      <span className="flex items-center gap-1 text-sm text-[color:var(--muted)]">add $<input className="input !py-1 w-24" value={amt} onChange={(e) => setAmt(e.target.value)} onBlur={() => on && save(true)} /></span>
      {note && <span className="text-xs text-green-700">{note}</span>}
      <span className="w-full text-xs text-[color:var(--muted)]">We&apos;ll charge your card on file automatically so your campaign never pauses. (Add a card at Top up →.)</span>
    </div>
  );
}
