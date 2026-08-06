import { db } from "@/lib/db";
import { getTwilioCfg, searchNumbers, provisionNumber, updateVoiceUrl, areaCodeOf } from "@/lib/twilio";

const norm = (s: string) => (s || "").trim().toLowerCase();

// Get a tracking number for a campaign. Reuses an AVAILABLE number already seasoned for the same
// money word; otherwise buys a fresh one and seasons it. Never takes an in-use number.
// voicePath sets where callbacks route (customer inbound vs outbound-campaign inbound).
export async function acquireForCampaign(input: {
  moneyWord: string; areaCode?: string; customerId?: string; campaignId?: string; campaignName?: string; voicePath?: string;
}): Promise<{ ok: boolean; number?: string; sid?: string; reused?: boolean; error?: string }> {
  const moneyWord = norm(input.moneyWord);
  const voicePath = input.voicePath || "/api/calls/inbound";

  // 1) Reuse an available number seasoned for this exact money word (oldest-idle first).
  const reuse = moneyWord
    ? await db.phoneNumber.findFirst({ where: { status: "available", moneyWord }, orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }] })
    : null;
  if (reuse) {
    const cfg = await getTwilioCfg();
    if (cfg && reuse.sid) await updateVoiceUrl(reuse.sid, voicePath, cfg).catch(() => {});
    await db.phoneNumber.update({ where: { id: reuse.id }, data: { status: "in_use", customerId: input.customerId ?? null, campaignId: input.campaignId ?? null, campaignName: input.campaignName || "", lastUsedAt: new Date() } });
    return { ok: true, number: reuse.number, sid: reuse.sid, reused: true };
  }

  // 2) Buy a new number and season it for this money word.
  const cfg = await getTwilioCfg();
  if (!cfg) return { ok: false, error: "Telephony not configured." };
  const ac = input.areaCode || "";
  const nums = await searchNumbers(ac, cfg);
  if (!nums.length) return { ok: false, error: `No numbers available${ac ? ` in area code ${ac}` : ""}.` };
  const bought = await provisionNumber(nums[0], cfg, voicePath);
  if (!bought) return { ok: false, error: "Number purchase failed at Twilio." };
  await db.phoneNumber.create({ data: {
    number: bought.number, sid: bought.sid, moneyWord, areaCode: ac || areaCodeOf(bought.number),
    status: "in_use", customerId: input.customerId ?? null, campaignId: input.campaignId ?? null, campaignName: input.campaignName || "", lastUsedAt: new Date(),
  } });
  return { ok: true, number: bought.number, sid: bought.sid, reused: false };
}

// Release a customer's number back to the pool — keep it (and its seasoning) for future reuse.
export async function releaseByCustomer(customerId: string): Promise<void> {
  await db.phoneNumber.updateMany({ where: { customerId }, data: { status: "available", customerId: null, campaignId: null, campaignName: "" } });
}

// Track usage on a number by its E.164 value.
export async function bumpCallsIn(number: string): Promise<void> {
  if (number) await db.phoneNumber.updateMany({ where: { number }, data: { callsIn: { increment: 1 } } }).catch(() => {});
}
export async function bumpMonetized(number: string): Promise<void> {
  if (number) await db.phoneNumber.updateMany({ where: { number }, data: { callsMonetized: { increment: 1 } } }).catch(() => {});
}
