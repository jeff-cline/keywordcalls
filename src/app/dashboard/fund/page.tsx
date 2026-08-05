import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { stripeConfigured } from "@/lib/stripe";
import FundForm from "@/components/FundForm";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function FundPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (["god", "vp", "regional", "manager", "rep"].includes(s.role)) redirect("/admin");
  const acct = await db.account.findUnique({ where: { id: s.uid }, include: { customer: true } });
  if (!acct?.customer) redirect("/dashboard");

  const [minFund, ready] = await Promise.all([getSetting("minFundCents", "50000"), stripeConfigured()]);

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-4xl px-5 h-16 flex items-center justify-between">
          <a href="/dashboard"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /></a>
          <div className="flex items-center gap-3 text-sm"><a href="/dashboard" className="text-[color:var(--muted)] hover:text-[color:var(--ink)]">← Dashboard</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-bold mb-1">Fund your account 🚀</h1>
        <p className="text-sm text-[color:var(--muted)] mb-6">Top up your pre-paid balance — your first call is free once you&apos;re funded. Calls are charged against this balance.</p>
        <FundForm minFundCents={parseInt(minFund, 10)} balanceCents={acct.customer.balanceCents} stripeReady={ready} />
      </main>
    </div>
  );
}
