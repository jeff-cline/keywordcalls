import { redirect } from "next/navigation";
import { getSession, isGod } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import AdminSettings from "@/components/AdminSettings";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isGod(s)) redirect("/admin");

  const [st, coupons] = await Promise.all([
    getSettings(["stripeSecretKey", "stripePublishableKey", "stripeWebhookSecret", "notifyEmail", "minFundCents", "calendlyUrl", "twilioAccountSid", "twilioAuthToken", "notifyPhone", "notifyFromNumber"]),
    db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-4xl px-5 h-16 flex items-center justify-between">
          <a href="/admin"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /></a>
          <div className="flex items-center gap-3 text-sm"><a href="/admin" className="text-[color:var(--muted)] hover:text-[color:var(--ink)]">← Admin</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-bold mb-5">Integrations 🚀</h1>
        <AdminSettings
          hasSecret={!!st.stripeSecretKey}
          hasWebhook={!!st.stripeWebhookSecret}
          publishableKey={st.stripePublishableKey || ""}
          notifyEmail={st.notifyEmail || ""}
          minFundDollars={String((parseInt(st.minFundCents || "50000", 10)) / 100)}
          calendlyUrl={st.calendlyUrl || ""}
          hasTwilioToken={!!st.twilioAuthToken}
          twilioSid={st.twilioAccountSid || ""}
          notifyPhone={st.notifyPhone || ""}
          notifyFromNumber={st.notifyFromNumber || ""}
          coupons={coupons}
        />
      </main>
    </div>
  );
}
