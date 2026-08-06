import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import CampaignControls from "@/components/CampaignControls";
import AutoTopUp from "@/components/AutoTopUp";
import { PRIORITY_COPY } from "@/lib/priority";

export const dynamic = "force-dynamic";
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US");

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ welcome?: string; funded?: string }> }) {
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
  const funded = (c?.balanceCents || 0) >= minFundCents;
  const bids = (() => { try { return JSON.parse(c?.bidsJson || "{}") as Record<string, number>; } catch { return {}; } })();
  const callAgg = c ? await db.call.aggregate({ where: { customerId: c.id, billed: true }, _count: true, _sum: { chargedCents: true } }) : null;

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-4xl px-5 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" />
          <div className="flex items-center gap-3 text-sm"><span className="text-[color:var(--muted)]">{acct.firstName} {acct.lastName}</span><LogoutButton /></div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 space-y-5">
        {sp.funded && <div className="rounded-xl bg-[color:#22c55e] text-white p-5 text-center">✅ Funded! Your first call is unlocked and your campaign is ready to go live. 🚀</div>}
        {sp.welcome && !sp.funded && <div className="rounded-xl bg-[color:var(--brand)] text-white p-5 text-center">🚀 Your account is live! Fund it below to unlock your <b>first free call</b>.</div>}

        {/* Balance + fund gate */}
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm text-[color:var(--muted)]">Account balance</div>
              <div className="text-3xl font-extrabold">{usd(c?.balanceCents || 0)}</div>
            </div>
            <a href="/dashboard/fund" className="btn">{funded ? "Add more funds" : `Fund your account (min ${usd(minFundCents)}) 🚀`}</a>
          </div>
          {funded
            ? <p className="mt-3 text-sm text-[color:#16a34a] font-medium">✓ You&apos;re funded — your first call is unlocked. Calls are charged against your balance.</p>
            : <p className="mt-3 text-sm text-[color:var(--muted)]">Your first call is free — fund your account (minimum {usd(minFundCents)}) to unlock it. Calls are then charged against your balance.</p>}
          <div className="mt-4 border-t border-[color:var(--line)] pt-4">
            <AutoTopUp enabled={!!c?.autoTopUp} amountDollars={(c?.autoTopUpAmountCents || 0) / 100} />
          </div>
        </div>

        {/* Campaign summary */}
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Your campaign</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><div className="label">Keywords</div><div className="font-medium">{kws.length ? kws.join(", ") : "—"}</div></div>
            <div><div className="label">Coverage</div><div className="font-medium capitalize">{c?.geoType || "—"}</div></div>
            <div><div className="label">Route calls to</div><div className="font-medium">{c?.routingNumber || "—"}</div></div>
            <div><div className="label">Call hours</div><div className="font-medium">{hours.start ? `${(hours.days || []).join(", ")} · ${hours.start}–${hours.end}` : "—"}</div></div>
            <div><div className="label">Agreement</div><div className="font-medium">{c?.agreementSignedAt ? "✓ Signed" : "—"}</div></div>
          </div>
        </div>

        {/* Bids + go live */}
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Bids &amp; tracking number</div>
          <CampaignControls keywords={kws} bids={bids} twilioNumber={c?.twilioNumber || ""} funded={funded} hasRouting={!!c?.routingNumber} />
        </div>

        {/* Call activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Call activity</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]"><b className="text-[color:var(--ink)]">{callAgg?._count || 0}</b> billed calls · <b className="text-[color:var(--ink)]">{usd(callAgg?._sum.chargedCents || 0)}</b> spent</div>
            </div>
            <a href="/dashboard/calls" className="btn btn-ghost text-sm">View calls →</a>
          </div>
        </div>

        {/* How billing + priority works */}
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-2">How your calls are prioritized</div>
          <p className="text-sm text-[color:var(--ink)] leading-relaxed">{PRIORITY_COPY}</p>
        </div>

        <div className="card p-6 text-center">
          <div className="font-semibold mb-2">Want a hand getting set up?</div>
          <a href="/book" className="btn btn-accent">Book an onboarding call 🚀</a>
        </div>
      </main>
    </div>
  );
}
