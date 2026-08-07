import { db } from "@/lib/db";
import { getTwilioCfg } from "@/lib/twilio";
import { getSettings } from "@/lib/settings";

const dollarsToCents = (v: string | undefined) => Math.round(Math.abs(parseFloat(v || "0")) * 100) || 0;

async function twilioGet(path: string, cfg: { sid: string; token: string }) {
  const auth = "Basic " + Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64");
  return fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}${path}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15000) })
    .then((r) => r.json()).catch(() => null);
}

// Quick balances for the top-nav widget.
export async function quickBalances() {
  const cfg = await getTwilioCfg();
  const st = await getSettings(["jdiCostPerDropCents", "jdiCreditBalance", "jdiCreditBalanceAt"]);
  let twilioBalanceCents = 0;
  if (cfg) { const b = await twilioGet(`/Balance.json`, cfg); twilioBalanceCents = dollarsToCents(b?.balance); }
  const delivered = (await db.outreachCampaign.aggregate({ _sum: { deliveredCount: true } }))._sum.deliveredCount || 0;
  // JDI credits: user enters portal balance + the delivered count at that time → remaining ticks down.
  const enteredBal = parseInt(st.jdiCreditBalance || "0", 10) || 0;
  const enteredAt = parseInt(st.jdiCreditBalanceAt || "0", 10) || 0;
  const jdiUsedSinceEntry = Math.max(0, delivered - enteredAt);
  const jdiRemaining = enteredBal ? Math.max(0, enteredBal - jdiUsedSinceEntry) : null;
  return { twilioBalanceCents, jdiCreditsUsed: delivered, jdiCreditsRemaining: jdiRemaining };
}

// Full accounting for the /admin/accounting page.
export async function computeAccounting() {
  const cfg = await getTwilioCfg();
  const st = await getSettings(["jdiCostPerDropCents", "jdiCreditBalance", "jdiCreditBalanceAt", "jdiCentsPerCredit"]);
  const dropCents = parseFloat(st.jdiCostPerDropCents || "2");
  const centsPerCredit = parseFloat(st.jdiCentsPerCredit || String(dropCents)); // $ per JDI credit

  // ---- Twilio (real) ----
  let twilioBalanceCents = 0, twilioAllTimeCents = 0;
  const twilioDaily: { date: string; cents: number }[] = [];
  const twilioCategories: { category: string; cents: number }[] = [];
  if (cfg) {
    const bal = await twilioGet(`/Balance.json`, cfg); twilioBalanceCents = dollarsToCents(bal?.balance);
    const all = await twilioGet(`/Usage/Records/AllTime.json?Category=totalprice`, cfg);
    twilioAllTimeCents = dollarsToCents(all?.usage_records?.[0]?.price);
    const daily = await twilioGet(`/Usage/Records/Daily.json?Category=totalprice&PageSize=31`, cfg);
    for (const r of (daily?.usage_records || []).slice(0, 31)) twilioDaily.push({ date: r.start_date, cents: dollarsToCents(r.price) });
    const month = await twilioGet(`/Usage/Records/ThisMonth.json?PageSize=100`, cfg);
    for (const r of (month?.usage_records || [])) { const c = dollarsToCents(r.price); if (c > 0) twilioCategories.push({ category: r.category, cents: c }); }
    twilioCategories.sort((a, b) => b.cents - a.cents);
  }

  // ---- JDI (credits used = delivered drops) ----
  const camps = await db.outreachCampaign.findMany({ where: { rolloutGroup: { not: "" } }, orderBy: { rolloutGroup: "asc" }, select: { name: true, rolloutGroup: true, deliveredCount: true, filteredCount: true } });
  const jdiByCampaign = camps.map((c) => ({ group: c.rolloutGroup, name: c.name, delivered: c.deliveredCount, costCents: Math.round(c.deliveredCount * centsPerCredit) }));
  const jdiCreditsUsed = camps.reduce((a, c) => a + c.deliveredCount, 0);
  const jdiSpendCents = Math.round(jdiCreditsUsed * centsPerCredit);
  const enteredBal = parseInt(st.jdiCreditBalance || "0", 10) || 0;
  const enteredAt = parseInt(st.jdiCreditBalanceAt || "0", 10) || 0;
  const jdiRemaining = enteredBal ? Math.max(0, enteredBal - Math.max(0, jdiCreditsUsed - enteredAt)) : null;

  // ---- Test calls (saved from-number + recording) ----
  const testCalls = (await db.testCall.findMany({ orderBy: { at: "desc" }, take: 50 }))
    .map((t) => ({ id: t.id, fromNumber: t.fromNumber, toNumber: t.toNumber, campaignName: t.campaignName, hasRecording: !!t.recordingUrl, at: t.at }));

  return {
    twilio: { balanceCents: twilioBalanceCents, allTimeCents: twilioAllTimeCents, daily: twilioDaily, categories: twilioCategories.slice(0, 12) },
    jdi: { creditsUsed: jdiCreditsUsed, spendCents: jdiSpendCents, byCampaign: jdiByCampaign, enteredBalance: enteredBal, remaining: jdiRemaining, centsPerCredit },
    testCalls,
  };
}
