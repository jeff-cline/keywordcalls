import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US");

export default async function Admin() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");

  const [customers, contacts, plans, keywords, recent] = await Promise.all([
    db.customer.count(),
    db.contactLead.count(),
    db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    db.keyword.findMany({ orderBy: { sortOrder: "asc" } }),
    db.account.findMany({ where: { role: "customer" }, orderBy: { createdAt: "desc" }, take: 15, include: { customer: true } }),
  ]);

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
          <a href="/admin/settings" className="btn btn-ghost text-sm">⚙️ Integrations & coupons</a>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Customers</div><div className="text-3xl font-extrabold">{customers}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Contact leads</div><div className="text-3xl font-extrabold">{contacts}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Plans</div><div className="text-3xl font-extrabold">{plans.length}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Keywords</div><div className="text-3xl font-extrabold">{keywords.length}</div></div>
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
          <b className="text-[color:var(--ink)]">Coming next (later phases):</b> Stripe billing + coupons, per-customer Twilio numbers (area-code matched), the keyword-bid call marketplace + live-call tracking, the campaign voicemail engine (upload list · record/replay · run), team/affiliate tiers, and accounting + reports + the unified comms portal.
        </div>
      </main>
    </div>
  );
}
