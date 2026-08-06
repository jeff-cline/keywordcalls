import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default async function AdminCalls() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");

  const calls = await db.call.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { customer: { include: { account: true } } } });
  const billed = calls.filter((c) => c.billed);
  const revenue = billed.reduce((a, c) => a + c.chargedCents, 0);
  const cost = calls.reduce((a, c) => a + c.costCents, 0);
  const margin = revenue - cost;

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 uppercase">{s.role}</span></div>
          <div className="flex items-center gap-3 text-sm"><a href="/admin" className="btn btn-ghost text-sm">← Admin</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Call marketplace</h1>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Billed calls</div><div className="text-3xl font-extrabold">{billed.length}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Revenue (charged)</div><div className="text-3xl font-extrabold">{usd(revenue)}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Twilio cost</div><div className="text-3xl font-extrabold">{usd(cost)}</div></div>
          <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">Margin</div><div className="text-3xl font-extrabold text-[color:#16a34a]">{usd(margin)}</div></div>
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">When</th><th className="py-2 px-4">Customer</th><th className="py-2 px-4">Caller</th><th className="py-2 px-4">Keyword</th><th className="py-2 px-4">Talk</th><th className="py-2 px-4">Charged</th><th className="py-2 px-4">Cost</th><th className="py-2 px-4">Status</th></tr></thead>
              <tbody>
                {calls.length === 0 && <tr><td colSpan={8} className="py-6 px-4 text-[color:var(--muted)]">No calls yet.</td></tr>}
                {calls.map((c) => (
                  <tr key={c.id} className="border-b border-[color:var(--line)] last:border-0">
                    <td className="py-2 px-4 whitespace-nowrap text-[color:var(--muted)]">{new Date(c.createdAt).toLocaleString()}</td>
                    <td className="py-2 px-4">{`${c.customer.account.firstName} ${c.customer.account.lastName}`.trim() || c.customer.account.email}</td>
                    <td className="py-2 px-4">{c.fromNumber}</td>
                    <td className="py-2 px-4">{c.keyword || "—"}</td>
                    <td className="py-2 px-4">{mmss(c.connectSec)}</td>
                    <td className="py-2 px-4 font-medium">{c.billed ? usd(c.chargedCents) : "—"}</td>
                    <td className="py-2 px-4 text-[color:var(--muted)]">{c.costCents ? usd(c.costCents) : "—"}</td>
                    <td className="py-2 px-4 capitalize text-[color:var(--muted)]">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
