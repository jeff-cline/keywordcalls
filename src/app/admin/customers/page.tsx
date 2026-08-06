import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import AdminCustomers from "@/components/AdminCustomers";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");

  const [plans, accounts] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.account.findMany({ where: { role: "customer" }, orderBy: { createdAt: "desc" }, take: 60, include: { customer: { include: { _count: { select: { calls: true } } } } } }),
  ]);

  const rows = accounts.map((a) => ({
    accountId: a.id,
    customerId: a.customer?.id || "",
    name: `${a.firstName} ${a.lastName}`.trim() || a.email,
    email: a.email,
    phone: a.phone,
    keywords: (() => { try { return JSON.parse(a.customer?.keywords || "[]") as string[]; } catch { return []; } })(),
    status: a.customer?.status || "—",
    twilioNumber: a.customer?.twilioNumber || "",
    routingNumber: a.customer?.routingNumber || "",
    balanceCents: a.customer?.balanceCents || 0,
    calls: a.customer?._count.calls || 0,
  }));

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 uppercase">{s.role}</span></div>
          <div className="flex items-center gap-3 text-sm"><a href="/admin" className="btn btn-ghost text-sm">← Admin</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Customers &amp; campaigns</h1>
        <AdminCustomers
          plans={plans.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents }))}
          rows={rows}
        />
      </main>
    </div>
  );
}
