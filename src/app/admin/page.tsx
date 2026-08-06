import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default async function Admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");

  const [customers, contacts, plans, keywords, recent, callAgg, inboundCalls, liveCampaigns, funded, emailsSent, emailCogsSetting] = await Promise.all([
    db.customer.count(),
    db.contactLead.count(),
    db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    db.keyword.findMany({ orderBy: { sortOrder: "asc" } }),
    db.account.findMany({ where: { role: "customer" }, orderBy: { createdAt: "desc" }, take: 15, include: { customer: true } }),
    db.call.aggregate({ where: { billed: true }, _count: true, _sum: { chargedCents: true, costCents: true } }),
    db.call.count(),
    db.customer.count({ where: { status: "live" } }),
    db.customer.aggregate({ _sum: { balanceCents: true } }),
    db.emailLog.count({ where: { ok: true } }),
    db.setting.findUnique({ where: { key: "emailCogsCents" } }),
  ]);

  // Economics: revenue = per-call charges to customers; cost = real Twilio + email COGS (5¢/email).
  const revenueCents = callAgg._sum.chargedCents || 0;
  const emailCogsCents = parseInt(emailCogsSetting?.value || "5", 10);
  const emailCostCents = emailsSent * emailCogsCents;
  const twilioCostCents = callAgg._sum.costCents || 0;
  const totalCostCents = twilioCostCents + emailCostCents;
  const marginCents = revenueCents - totalCostCents;
  const roas = totalCostCents > 0 ? revenueCents / totalCostCents : 0;
  const balanceOnHand = funded._sum.balanceCents || 0;

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 uppercase">{s.role}</span></div>
          <div className="flex items-center gap-3 text-sm"><span className="text-[color:var(--muted)]">{s.name}</span><LogoutButton /></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">Admin 🚀</h1>
          <div className="flex gap-2">
            <a href="/admin/customers" className="btn btn-primary text-sm">Customers & campaigns</a>
            <a href="/admin/campaigns" className="btn btn-ghost text-sm">📣 Outbound campaigns</a>
            <a href="/rollout" className="btn btn-ghost text-sm">🧪 Rollout</a>
            <a href="/admin/leads" className="btn btn-ghost text-sm">🧲 Leads</a>
            <a href="/admin/demoed" className="btn btn-ghost text-sm">🎯 Demoed</a>
            <a href="/admin/calls" className="btn btn-ghost text-sm">📞 Call marketplace</a>
            <a href="/admin/settings" className="btn btn-ghost text-sm">⚙️ Integrations & coupons</a>
          </div>
        </div>

        {/* Economics dashboard */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Revenue (calls)</div><div className="text-3xl font-extrabold">{usd(revenueCents)}</div><div className="text-xs text-[color:var(--muted)]">{callAgg._count} billed</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Cost to run</div><div className="text-3xl font-extrabold">{usd(totalCostCents)}</div><div className="text-xs text-[color:var(--muted)]">Twilio {usd(twilioCostCents)} · email {usd(emailCostCents)}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Margin</div><div className="text-3xl font-extrabold text-[color:#16a34a]">{usd(marginCents)}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">ROAS</div><div className="text-3xl font-extrabold">{roas ? roas.toFixed(1) + "×" : "—"}</div><div className="text-xs text-[color:var(--muted)]">revenue ÷ cost</div></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Inbound calls</div><div className="text-3xl font-extrabold">{inboundCalls}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Live campaigns</div><div className="text-3xl font-extrabold">{liveCampaigns}<span className="text-base font-medium text-[color:var(--muted)]"> / {customers}</span></div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Customer balances</div><div className="text-3xl font-extrabold">{usd(balanceOnHand)}</div><div className="text-xs text-[color:var(--muted)]">funds on hand</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Emails sent</div><div className="text-3xl font-extrabold">{emailsSent}</div><div className="text-xs text-[color:var(--muted)]">@ {usd(emailCogsCents)} ea</div></div>
        </div>

        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Recent customers</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)]"><th className="py-2">Name</th><th className="py-2">Email</th><th className="py-2">Keywords</th><th className="py-2">Balance</th><th className="py-2">Joined</th></tr></thead>
              <tbody>
                {recent.length === 0 && <tr><td colSpan={5} className="py-4 text-[color:var(--muted)]">No customers yet.</td></tr>}
                {recent.map((r) => {
                  let kws: string[] = []; try { kws = JSON.parse(r.customer?.keywords || "[]"); } catch {}
                  return (
                    <tr key={r.id} className="border-b border-[color:var(--line)] last:border-0">
                      <td className="py-2 font-medium">{r.firstName} {r.lastName}</td>
                      <td className="py-2 text-[color:var(--muted)]">{r.email}</td>
                      <td className="py-2">{kws.join(", ") || "—"}</td>
                      <td className="py-2">{usd(r.customer?.balanceCents || 0)}</td>
                      <td className="py-2 text-[color:var(--muted)]">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-6 text-sm text-[color:var(--muted)]">
          <b className="text-[color:var(--ink)]">Live now:</b> account creation + campaign activation (area-code-matched tracking numbers), the keyword-bid call marketplace with per-call billing, and owner alerts (call · text · email) when a campaign goes live. <b className="text-[color:var(--ink)]">Coming next:</b> the campaign voicemail engine (upload list · record/replay · run), team/affiliate tiers, and accounting + reports + unified comms.
        </div>
      </main>
    </div>
  );
}
