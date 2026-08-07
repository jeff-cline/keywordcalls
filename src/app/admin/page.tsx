import { redirect } from "next/navigation";
import { getSession, isStaff, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import AdminStats from "@/components/AdminStats";
import NavBalances from "@/components/NavBalances";
import { computeAdminStats } from "@/lib/adminStats";

export const dynamic = "force-dynamic";
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default async function Admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");

  // Live economics (inbound marketplace + outbound rollout) — initial values; AdminStats then polls.
  const [recent, stats] = await Promise.all([
    db.account.findMany({ where: { role: "customer" }, orderBy: { createdAt: "desc" }, take: 15, include: { customer: true } }),
    computeAdminStats(),
  ]);

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 uppercase">{s.role}</span>{isGod(s) && <a href="/rollout" className="rounded-full bg-[color:#ff7a1a] hover:bg-[color:#e86d0f] text-white text-[11px] font-bold px-3 py-0.5 uppercase">🚀 Rollout</a>}</div>
          <div className="flex items-center gap-3 text-sm"><NavBalances /><span className="text-[color:var(--muted)]">{s.name}</span><LogoutButton /></div>
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
            <a href="/admin/accounting" className="btn btn-ghost text-sm">💰 Accounting</a>
            <a href="/admin/settings" className="btn btn-ghost text-sm">⚙️ Integrations & coupons</a>
          </div>
        </div>

        {/* Economics dashboard — live (inbound marketplace + outbound rollout) */}
        <AdminStats initial={stats} />

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
