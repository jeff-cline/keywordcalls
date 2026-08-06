import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const mask = (n: string) => (n && n.length >= 4 ? `${n.slice(0, -4)}••${n.slice(-2)}` : n);

export default async function CustomerCalls() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (["god", "vp", "regional", "manager", "rep"].includes(s.role)) redirect("/admin");
  const acct = await db.account.findUnique({ where: { id: s.uid }, include: { customer: true } });
  if (!acct?.customer) redirect("/dashboard");

  const calls = await db.call.findMany({ where: { customerId: acct.customer.id }, orderBy: { createdAt: "desc" }, take: 200 });
  const billed = calls.filter((c) => c.billed);
  const spent = billed.reduce((a, c) => a + c.chargedCents, 0);

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-4xl px-5 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" />
          <div className="flex items-center gap-3 text-sm"><a href="/dashboard" className="btn btn-ghost text-sm">← Dashboard</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">Your calls</h1>
          <div className="text-sm text-[color:var(--muted)]"><b className="text-[color:var(--ink)]">{billed.length}</b> billed · <b className="text-[color:var(--ink)]">{usd(spent)}</b> spent</div>
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">When</th><th className="py-2 px-4">Caller</th><th className="py-2 px-4">Keyword</th><th className="py-2 px-4">Talk time</th><th className="py-2 px-4">Charge</th><th className="py-2 px-4">Status</th></tr></thead>
              <tbody>
                {calls.length === 0 && <tr><td colSpan={6} className="py-6 px-4 text-[color:var(--muted)]">No calls yet. When someone calls your tracking number, it shows here.</td></tr>}
                {calls.map((c) => (
                  <tr key={c.id} className="border-b border-[color:var(--line)] last:border-0">
                    <td className="py-2 px-4 whitespace-nowrap text-[color:var(--muted)]">{new Date(c.createdAt).toLocaleString()}</td>
                    <td className="py-2 px-4">{mask(c.fromNumber)}</td>
                    <td className="py-2 px-4">{c.keyword || "—"}</td>
                    <td className="py-2 px-4">{mmss(c.connectSec)}</td>
                    <td className="py-2 px-4 font-medium">{c.billed ? usd(c.chargedCents) : <span className="text-[color:var(--muted)]">—</span>}</td>
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
