import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import AdminCampaigns from "@/components/AdminCampaigns";
import { getZapmailStatus } from "@/lib/core";
import { getSettings } from "@/lib/settings";
import { computeReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isStaff(s)) redirect("/dashboard");

  const [lists, campaigns, zap, cfg] = await Promise.all([
    db.callList.findMany({ orderBy: { createdAt: "desc" } }),
    db.outreachCampaign.findMany({ orderBy: { createdAt: "desc" }, include: { list: true } }),
    getZapmailStatus(),
    getSettings(["mailboxDailyCap", "callsPerMinDefault", "sendWindowHours"]),
  ]);
  const mailboxDailyCap = parseInt(cfg.mailboxDailyCap || "40", 10);
  const sendWindowHours = parseFloat(cfg.sendWindowHours || "8.5");
  const readiness = {
    ...computeReadiness(zap.activeMailboxes || zap.storedMailboxes, mailboxDailyCap, sendWindowHours),
    mailboxEmails: zap.mailboxes.map((m) => m.email),
    zapOk: zap.ok,
    callsPerMinDefault: parseInt(cfg.callsPerMinDefault || "30", 10),
  };

  const rows = campaigns.map((c) => ({
    id: c.id, name: c.name, status: c.status,
    listId: c.listId, listName: c.list?.name || "", listCount: c.list?.rowCount || 0,
    states: (() => { try { return JSON.parse(c.states) as string[]; } catch { return []; } })(),
    bidCents: c.bidCents, hoursStart: c.hoursStart, hoursEnd: c.hoursEnd, tz: c.tz,
    outboundAudioUrl: c.outboundAudioUrl, followupAudioUrl: c.followupAudioUrl,
    afterHoursMessage: c.afterHoursMessage, followupMessage: c.followupMessage,
    mode: c.mode, emailDelayMin: c.emailDelayMin, callsPerMin: c.callsPerMin,
    emailSubject: c.emailSubject, emailBody: c.emailBody,
    dialedCount: c.dialedCount, connectedCount: c.connectedCount, revenueCents: c.revenueCents,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <header className="bg-white border-b border-[color:var(--line)]">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto" /><span className="rounded-full bg-[color:var(--brand)] text-white text-[11px] font-bold px-2 py-0.5 uppercase">{s.role}</span></div>
          <div className="flex items-center gap-3 text-sm"><a href="/admin" className="btn btn-ghost text-sm">← Admin</a><LogoutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-bold mb-5">Outbound campaigns</h1>
        <AdminCampaigns lists={lists.map((l) => ({ id: l.id, name: l.name, rowCount: l.rowCount, createdAt: l.createdAt.toISOString() }))} rows={rows} readiness={readiness} />
      </main>
    </div>
  );
}
