import { redirect } from "next/navigation";
import { getSession, isGod } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import NavBalances from "@/components/NavBalances";
import RolloutConsole from "@/components/RolloutConsole";

export const dynamic = "force-dynamic";

export default async function RolloutPage() {
  const s = await getSession();
  if (!s) redirect("/login?next=/rollout");
  if (!isGod(s)) redirect("/admin"); // God only

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:#ff7a1a] text-white text-[11px] font-bold px-2 py-0.5 uppercase">Rollout · God only</span></div>
          <div className="flex items-center gap-3 text-sm"><NavBalances /><a href="/admin" className="btn btn-ghost text-sm">← Admin</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-bold mb-1">Rollout console 🚀</h1>
        <p className="text-sm text-[color:var(--muted)] mb-5">Throttled batch launches + 30-day callback tracking to learn your send → callback curve. Only you can see this.</p>
        <RolloutConsole />
      </main>
    </div>
  );
}
