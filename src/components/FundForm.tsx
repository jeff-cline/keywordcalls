"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US");

export default function FundForm({ minFundCents, balanceCents, stripeReady }: { minFundCents: number; balanceCents: number; stripeReady: boolean }) {
  const router = useRouter();
  const [dollars, setDollars] = useState(String(minFundCents / 100));
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ kind: string; chargeCents: number; creditCents: number; desc: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const amountCents = Math.round((parseFloat(dollars) || 0) * 100);

  const applyCoupon = async () => {
    setErr(null); setMsg(null);
    const res = await fetch("/api/coupon/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, amountCents }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) { setCoupon(null); setErr(data.error || "Invalid code."); return; }
    setCoupon({ kind: data.kind, chargeCents: data.chargeCents, creditCents: data.creditCents, desc: data.desc, code: data.code });
    setMsg(`Coupon applied — ${data.desc}.`);
  };

  const redeemFree = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/coupon/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: coupon!.code }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not redeem.");
      router.push("/dashboard?funded=1");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  const payWithStripe = async () => {
    if (amountCents < minFundCents) { setErr(`Minimum funding is ${usd(minFundCents)}.`); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents, couponCode: coupon?.kind === "percent" ? coupon.code : "" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start checkout.");
      window.location.href = data.url;
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); setBusy(false); }
  };

  const chargeCents = coupon?.kind === "percent" ? coupon.chargeCents : amountCents;

  return (
    <div className="card p-6 max-w-md">
      <div className="text-sm text-[color:var(--muted)]">Current balance</div>
      <div className="text-2xl font-extrabold mb-4">{usd(balanceCents)}</div>

      {err && <div className="mb-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
      {msg && <div className="mb-3 rounded border border-[color:#22c55e] bg-green-50 text-green-700 text-sm px-3 py-2">{msg}</div>}

      <label className="label">Amount to add (minimum {usd(minFundCents)})</label>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg font-semibold text-[color:var(--muted)]">$</span>
        <input className="input" type="number" min={minFundCents / 100} step="50" value={dollars} onChange={(e) => setDollars(e.target.value)} />
      </div>

      <label className="label">Coupon code (optional)</label>
      <div className="flex gap-2 mb-4">
        <input className="input" value={code} onChange={(e) => { setCode(e.target.value); setCoupon(null); }} placeholder="Enter a code" />
        <button className="btn btn-ghost" onClick={applyCoupon} disabled={!code.trim()}>Apply</button>
      </div>

      {coupon?.kind === "add_funds" ? (
        <>
          <div className="rounded-xl bg-[color:var(--soft)] p-3 text-sm mb-4">This code adds <b>{usd(coupon.creditCents)}</b> free to your balance — no payment needed.</div>
          <button className="btn w-full" disabled={busy} onClick={redeemFree}>{busy ? "Redeeming…" : `Redeem ${usd(coupon.creditCents)} free 🚀`}</button>
        </>
      ) : (
        <>
          {coupon?.kind === "percent" && <div className="rounded-xl bg-[color:var(--soft)] p-3 text-sm mb-4">{coupon.desc}: you pay <b>{usd(coupon.chargeCents)}</b>, your balance gets <b>{usd(coupon.creditCents)}</b>.</div>}
          <button className="btn w-full" disabled={busy || !stripeReady} onClick={payWithStripe}>
            {busy ? "Starting checkout…" : stripeReady ? `Pay ${usd(chargeCents)} with card 🚀` : "Card payments coming online shortly"}
          </button>
          {!stripeReady && <div className="mt-2 text-xs text-[color:var(--muted)]">Billing is being finalized — you&apos;ll be able to fund by card here shortly.</div>}
        </>
      )}
    </div>
  );
}
