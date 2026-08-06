import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import DemoedList from "@/components/DemoedList";

export const dynamic = "force-dynamic";

export default async function DemoedPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");
  const contacts = await db.demoContact.findMany({ orderBy: { lastDemoedAt: "desc" }, take: 500 });
  const rows = contacts.map((c) => ({ phone: c.phone, name: c.name, email: c.email, city: c.city, state: c.state, zip: c.zip, timesDemoed: c.timesDemoed, lastDemoedAt: c.lastDemoedAt.toISOString() }));
  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 uppercase">{s.role}</span></div>
          <div className="flex items-center gap-3 text-sm"><a href="/admin" className="btn btn-ghost text-sm">← Admin</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-2xl font-bold mb-1">Demoed 🚀</h1>
        <p className="text-sm text-[color:var(--muted)] mb-5">Everyone we&apos;ve dropped a demo voicemail to — {rows.length} on file. Click a name to see appended data.</p>
        <DemoedList rows={rows} />
      </main>
    </div>
  );
}
