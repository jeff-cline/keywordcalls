import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US");

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (["god", "vp", "regional", "manager", "rep"].includes(s.role)) redirect("/admin");
  const sp = await searchParams;

  const acct = await db.account.findUnique({ where: { id: s.uid }, include: { customer: true } });
  if (!acct) redirect("/login");
  const c = acct.customer;
  const kws = (() => { try { return JSON.parse(c?.keywords || "[]") as string[]; } catch { return []; } })();
  const hours = (() => { try { return JSON.parse(c?.hours || "{}"); } catch { return {}; } })();
  const minFund = await db.setting.findUnique({ where: { key: "minFundCents" } });
  const minFundCents = parseInt(minFund?.value || "50000", 10);

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-4xl px-5 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" />
          <div className="flex items-center gap-3 text-sm"><span className="text-[color:var(--muted)]">{acct.firstName} {acct.lastName}</span><LogoutButton /></div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 space-y-5">
        {sp.welcome && <div className="rounded-xl bg-[color:var(--brand)] text-white p-5 text-center">🚀 Your account is live! Fund it below to unlock your <b>first free call</b>.</div>}

        {/* Fund gate (Phase 2 — Stripe) */}
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm text-[color:var(--muted)]">Account balance</div>
              <div className="text-3xl font-extrabold">{usd(c?.balanceCents || 0)}</div>
            </div>
            <button className="btn" disabled>Add funds (min {usd(minFundCents)}) — coming soon</button>
          </div>
          <p className="mt-3 text-sm text-[color:var(--muted)]">Your first call is free — top up your account (minimum {usd(minFundCents)}) to unlock it. Calls are then charged against your balance. <b>Billing is being finalized.</b></p>
        </div>

        {/* Campaign summary */}
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Your campaign</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><div className="label">Keywords</div><div className="font-medium">{kws.length ? kws.join(", ") : "—"}</div></div>
            <div><div className="label">Coverage</div><div className="font-medium capitalize">{c?.geoType || "—"}</div></div>
            <div><div className="label">Route calls to</div><div className="font-medium">{c?.routingNumber || "—"}</div></div>
            <div><div className="label">Call hours</div><div className="font-medium">{hours.start ? `${(hours.days || []).join(", ")} · ${hours.start}–${hours.end}` : "—"}</div></div>
            <div><div className="label">Your tracking number</div><div className="font-medium text-[color:var(--muted)]">assigned after funding</div></div>
            <div><div className="label">Agreement</div><div className="font-medium">{c?.agreementSignedAt ? "✓ Signed" : "—"}</div></div>
          </div>
        </div>

        <div className="card p-6 text-center">
          <div className="font-semibold mb-2">Want a hand getting set up?</div>
          <a href="https://calendly.com/jdcline/book-onboarding-call" target="_blank" rel="noreferrer" className="btn btn-accent">Book an onboarding call 🚀</a>
        </div>
      </main>
    </div>
  );
}
