import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import LogoutButton from "@/components/LogoutButton";
import DemoConsole from "@/components/DemoConsole";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const s = await getSession();
  if (!s) redirect("/login?next=/demo");
  const cfg = await getSettings(["demoNumber", "demoAudioUrl"]);
  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" />
          <div className="flex items-center gap-3 text-sm"><a href="/admin/campaigns" className="btn btn-ghost text-sm">← Back</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">
        <DemoConsole initialDemoNumber={cfg.demoNumber || ""} initialHasAudio={!!cfg.demoAudioUrl} />
      </main>
    </div>
  );
}
