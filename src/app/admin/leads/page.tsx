import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import { resultsFor, usd } from "@/lib/results";

export const dynamic = "force-dynamic";

// A "lead" = someone who ran the demo / Get Results flow and generated a branded PDF (they left a name).
export default async function LeadsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");

  const accts = await db.account.findMany({
    where: { role: "customer", customer: { resultsToken: { not: "" } } },
    orderBy: { createdAt: "desc" }, take: 300, include: { customer: true },
  });
  const rows = accts.map((a) => {
    const ltv = a.customer?.ltvCents || 0;
    return { name: `${a.firstName} ${a.lastName}`.trim() || "—", email: a.email, ltvCents: ltv, roas: resultsFor(ltv).roas, token: a.customer?.resultsToken || "", createdAt: a.createdAt };
  });

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 uppercase">{s.role}</span></div>
          <div className="flex items-center gap-3 text-sm"><a href="/admin" className="btn btn-ghost text-sm">← Admin</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-2xl font-bold mb-1">Leads 🧲</h1>
        <p className="text-sm text-[color:var(--muted)] mb-5">Everyone who ran the demo / created a results PDF — {rows.length} on file. These are real, named inbound leads.</p>
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Name</th><th className="py-2 px-4">Email</th><th className="py-2 px-4">Lifetime value</th><th className="py-2 px-4">ROAS</th><th className="py-2 px-4">Their PDF</th><th className="py-2 px-4">Created</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="py-6 px-4 text-[color:var(--muted)]">No leads yet — they appear here when someone runs Get Results on the demo.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.email} className="border-b border-[color:var(--line)] last:border-0">
                    <td className="py-2 px-4 font-medium">{r.name}</td>
                    <td className="py-2 px-4 text-[color:var(--muted)]">{r.email}</td>
                    <td className="py-2 px-4">{usd(r.ltvCents)}</td>
                    <td className="py-2 px-4 text-[color:#16a34a] font-semibold">{r.roas.toFixed(1)}×</td>
                    <td className="py-2 px-4">{r.token ? <a href={`/api/results/pdf?t=${r.token}`} target="_blank" rel="noopener" className="text-[color:var(--brand2)] underline">📄 View PDF</a> : "—"}</td>
                    <td className="py-2 px-4 text-[color:var(--muted)]">{new Date(r.createdAt).toLocaleString()}</td>
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
