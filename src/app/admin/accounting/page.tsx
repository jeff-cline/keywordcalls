import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import AccountingView from "@/components/AccountingView";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 uppercase">{s.role}</span></div>
          <div className="flex items-center gap-3 text-sm"><a href="/admin" className="btn btn-ghost text-sm">← Admin</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-2xl font-bold mb-1">Accounting 💰</h1>
        <p className="text-sm text-[color:var(--muted)] mb-5">What you&apos;ve spent on ringless (JDI) and Twilio — by day and by campaign. Twilio is live; JDI credits track against the balance you enter.</p>
        <AccountingView />
      </main>
    </div>
  );
}
