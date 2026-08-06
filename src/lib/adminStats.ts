import { db } from "@/lib/db";

export type AdminStats = {
  revenueCents: number; billedCount: number;
  costCents: number; twilioCostCents: number; emailCostCents: number; ringlessCostCents: number;
  marginCents: number; roas: number;
  inboundCalls: number; liveCampaigns: number; customers: number;
  balanceCents: number; emailsSent: number; emailCogsCents: number;
  // rollout detail
  rolloutRevenueCents: number; rolloutDelivered: number; rolloutBillable: number; rolloutCallbacks: number;
};

// One source of truth for the admin economics — combines the inbound keyword-call marketplace
// (Call table) with the outbound /rollout ringless campaigns (OutreachCampaign + CampaignCallback).
export async function computeAdminStats(): Promise<AdminStats> {
  const [callAgg, inboundCalls, liveCampaigns, customers, funded, emailsSent, emailCogsSetting, dropCostSetting, twMinSetting, campAgg, cbBillable, cbTotal, cbSecAgg] = await Promise.all([
    db.call.aggregate({ where: { billed: true }, _count: true, _sum: { chargedCents: true, costCents: true } }),
    db.call.count(),
    db.customer.count({ where: { status: "live" } }),
    db.customer.count(),
    db.customer.aggregate({ _sum: { balanceCents: true } }),
    db.emailLog.count({ where: { ok: true } }),
    db.setting.findUnique({ where: { key: "emailCogsCents" } }),
    db.setting.findUnique({ where: { key: "jdiCostPerDropCents" } }),
    db.setting.findUnique({ where: { key: "twilioPerMinCents" } }),
    db.outreachCampaign.aggregate({ _sum: { revenueCents: true, deliveredCount: true } }),
    db.campaignCallback.count({ where: { billable: true } }),
    db.campaignCallback.count(),
    db.campaignCallback.aggregate({ _sum: { connectSec: true } }),
  ]);

  const emailCogsCents = parseInt(emailCogsSetting?.value || "5", 10);
  const dropCostCents = parseFloat(dropCostSetting?.value || "2");   // ringless cost per delivered drop
  const twMinCents = parseFloat(twMinSetting?.value || "3");         // Twilio cost per connected minute (both legs)

  const inboundRevenue = callAgg._sum.chargedCents || 0;
  const rolloutRevenueCents = campAgg._sum.revenueCents || 0;        // billable callbacks × bid, credited on connect
  const revenueCents = inboundRevenue + rolloutRevenueCents;

  const twilioCostCents = (callAgg._sum.costCents || 0) + Math.round(((cbSecAgg._sum.connectSec || 0) / 60) * twMinCents);
  const emailCostCents = emailsSent * emailCogsCents;
  const rolloutDelivered = campAgg._sum.deliveredCount || 0;
  const ringlessCostCents = Math.round(rolloutDelivered * dropCostCents);
  const costCents = twilioCostCents + emailCostCents + ringlessCostCents;

  return {
    revenueCents, billedCount: (callAgg._count || 0) + cbBillable,
    costCents, twilioCostCents, emailCostCents, ringlessCostCents,
    marginCents: revenueCents - costCents, roas: costCents > 0 ? revenueCents / costCents : 0,
    inboundCalls, liveCampaigns, customers,
    balanceCents: funded._sum.balanceCents || 0, emailsSent, emailCogsCents,
    rolloutRevenueCents, rolloutDelivered, rolloutBillable: cbBillable, rolloutCallbacks: cbTotal,
  };
}
