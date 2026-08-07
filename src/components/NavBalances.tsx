"use client";
import { useEffect, useState } from "react";

type B = { twilioBalanceCents: number; jdiCreditsUsed: number; jdiCreditsRemaining: number | null };
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

// Top-nav money widget: Twilio balance (live) + JDI credits used / remaining. Links to accounting.
export default function NavBalances() {
  const [b, setB] = useState<B | null>(null);
  useEffect(() => {
    let on = true;
    const load = async () => { const r = await fetch("/api/admin/balances"); if (r.ok && on) setB(await r.json()); };
    load(); const id = setInterval(load, 30000); return () => { on = false; clearInterval(id); };
  }, []);
  if (!b) return null;
  const jdi = b.jdiCreditsRemaining != null ? `${b.jdiCreditsRemaining.toLocaleString()} left` : `${b.jdiCreditsUsed.toLocaleString()} used`;
  const low = b.jdiCreditsRemaining != null && b.jdiCreditsRemaining < 500;
  return (
    <a href="/admin/accounting" title="Accounting & spend" className="hidden sm:flex items-center gap-2 rounded-lg bg-[color:var(--soft)] px-3 py-1.5 text-xs font-semibold hover:opacity-80">
      <span className="text-[color:var(--muted)]">Twilio</span> <span className="tabular-nums">{usd(b.twilioBalanceCents)}</span>
      <span className="text-[color:var(--line)]">|</span>
      <span className="text-[color:var(--muted)]">JDI</span> <span className={`tabular-nums ${low ? "text-[color:#dc2626]" : ""}`}>{jdi}</span>
    </a>
  );
}
