"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Coupon = { id: string; code: string; kind: string; value: number; active: boolean; maxRedemptions: number; redeemed: number };
type Props = {
  hasSecret: boolean; hasWebhook: boolean;
  publishableKey: string; notifyEmail: string; minFundDollars: string; calendlyUrl: string;
  coupons: Coupon[];
};

export default function AdminSettings({ hasSecret, hasWebhook, publishableKey, notifyEmail, minFundDollars, calendlyUrl, coupons }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [sk, setSk] = useState("");
  const [pk, setPk] = useState(publishableKey);
  const [wh, setWh] = useState("");
  const [email, setEmail] = useState(notifyEmail);
  const [minFund, setMinFund] = useState(minFundDollars);
  const [cal, setCal] = useState(calendlyUrl);

  const saveSettings = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const body: Record<string, string> = { stripePublishableKey: pk, notifyEmail: email, minFundCents: String(Math.round((parseFloat(minFund) || 0) * 100)), calendlyUrl: cal };
      if (sk.trim()) body.stripeSecretKey = sk.trim();
      if (wh.trim()) body.stripeWebhookSecret = wh.trim();
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Save failed.");
      setMsg("Saved."); setSk(""); setWh(""); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  };

  const couponAction = async (b: unknown) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed.");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {msg && <div className="rounded border border-[color:#22c55e] bg-green-50 text-green-700 text-sm px-3 py-2">{msg}</div>}
      {err && <div className="rounded border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}

      {/* Integrations */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-1">Integrations & billing</h2>
        <p className="text-sm text-[color:var(--muted)] mb-4">Your Stripe keys power funding + coupons. Secret keys are write-only and never shown again.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Stripe secret key {hasSecret && <span className="text-[color:#16a34a]">· set ✓</span>}</label><input className="input" type="password" placeholder={hasSecret ? "•••••••• (leave blank to keep)" : "sk_live_… or sk_test_…"} value={sk} onChange={(e) => setSk(e.target.value)} /></div>
          <div><label className="label">Stripe publishable key</label><input className="input" placeholder="pk_live_… / pk_test_…" value={pk} onChange={(e) => setPk(e.target.value)} /></div>
          <div><label className="label">Stripe webhook signing secret {hasWebhook && <span className="text-[color:#16a34a]">· set ✓</span>}</label><input className="input" type="password" placeholder={hasWebhook ? "•••••••• (leave blank to keep)" : "whsec_…"} value={wh} onChange={(e) => setWh(e.target.value)} /></div>
          <div><label className="label">Notify email (new signups)</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label">Minimum funding ($)</label><input className="input" type="number" value={minFund} onChange={(e) => setMinFund(e.target.value)} /></div>
          <div><label className="label">Calendly URL</label><input className="input" value={cal} onChange={(e) => setCal(e.target.value)} /></div>
        </div>
        <div className="mt-4 text-xs text-[color:var(--muted)]">Webhook endpoint for Stripe: <code className="bg-[color:var(--soft)] px-1.5 py-0.5 rounded">https://keywordcalls.com/api/stripe/webhook</code> (event: <b>checkout.session.completed</b>)</div>
        <button className="btn mt-4" disabled={busy} onClick={saveSettings}>{busy ? "Saving…" : "Save integrations"}</button>
      </div>

      {/* Coupons */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-3">Coupons</h2>
        <NewCoupon busy={busy} onCreate={couponAction} />
        <div className="mt-4 space-y-2">
          {coupons.length === 0 && <div className="text-sm text-[color:var(--muted)]">No coupons yet.</div>}
          {coupons.map((c) => (
            <div key={c.id} className={`flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--line)] px-3 py-2 text-sm ${c.active ? "" : "opacity-60"}`}>
              <span className="font-mono font-bold">{c.code}</span>
              <span className="text-[color:var(--muted)]">{c.kind === "percent" ? `${c.value}% off` : `+$${(c.value / 100).toLocaleString("en-US")} free`}</span>
              <span className="text-xs text-[color:var(--muted)]">redeemed {c.redeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</span>
              <div className="ml-auto flex gap-2">
                <button className="btn-ghost btn !py-1 !px-2 text-xs" disabled={busy} onClick={() => couponAction({ action: "update", id: c.id, kind: c.kind, value: c.kind === "percent" ? c.value : c.value / 100, maxRedemptions: c.maxRedemptions, active: !c.active })}>{c.active ? "🟢 On" : "⚪ Off"}</button>
                <button className="text-xs text-red-600" disabled={busy} onClick={() => { if (confirm(`Delete ${c.code}?`)) couponAction({ action: "delete", id: c.id }); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewCoupon({ busy, onCreate }: { busy: boolean; onCreate: (b: unknown) => void }) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("percent");
  const [value, setValue] = useState("");
  const [max, setMax] = useState("");

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div><label className="label">Code</label><input className="input !w-32" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAVE20" /></div>
      <div><label className="label">Type</label><select className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="percent">% off</option><option value="add_funds">Free funds ($)</option></select></div>
      <div><label className="label">{kind === "percent" ? "Percent" : "Dollars"}</label><input className="input !w-24" type="number" value={value} onChange={(e) => setValue(e.target.value)} /></div>
      <div><label className="label">Max uses (0=∞)</label><input className="input !w-24" type="number" value={max} onChange={(e) => setMax(e.target.value)} /></div>
      <button className="btn" disabled={busy || !code.trim() || !value} onClick={() => onCreate({ action: "create", code, kind, value: Number(value), maxRedemptions: Number(max) || 0 })}>+ Add</button>
    </div>
  );
}
