import { db } from "@/lib/db";
import { areaCodeOf } from "@/lib/twilio";
import { acquireForCampaign } from "@/lib/numbers";
import { notifyOwner } from "@/lib/notify";

type CustomerWithAccount = Awaited<ReturnType<typeof loadCustomer>>;
function loadCustomer(id: string) {
  return db.customer.findUnique({ where: { id }, include: { account: true } });
}
function parseList(s: string): string[] { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } }

// Provision an area-code-matched tracking number, point it at us, flip the customer to LIVE,
// and alert the owner. Idempotent: if a number already exists we just (re)mark live + notify.
export async function activateCustomer(customerId: string, opts: { notify?: boolean } = {}): Promise<{ ok: boolean; number?: string; error?: string }> {
  const customer = await loadCustomer(customerId);
  if (!customer) return { ok: false, error: "Customer not found." };

  if (customer.twilioNumber) {
    await db.customer.update({ where: { id: customerId }, data: { status: "live" } });
    if (opts.notify !== false) await fireLive({ ...customer, status: "live" });
    return { ok: true, number: customer.twilioNumber };
  }

  // Draw from the seasoned-number pool: reuse a number already seasoned for this money word,
  // otherwise buy a fresh one. Each customer campaign gets its own dedicated number.
  const ac = customer.areaCode || areaCodeOf(customer.account.phone) || areaCodeOf(customer.routingNumber);
  const moneyWord = parseList(customer.keywords)[0] || "";
  const got = await acquireForCampaign({
    moneyWord, areaCode: ac || undefined, customerId,
    campaignName: `${customer.account.firstName} ${customer.account.lastName}`.trim() || customer.account.email,
  });
  if (!got.ok || !got.number) return { ok: false, error: got.error || "Could not get a number." };

  const updated = await db.customer.update({
    where: { id: customerId },
    data: { twilioNumber: got.number, twilioNumberSid: got.sid || "", areaCode: ac || areaCodeOf(got.number), status: "live" },
    include: { account: true },
  });
  if (opts.notify !== false) await fireLive(updated);
  return { ok: true, number: got.number };
}

async function fireLive(customer: NonNullable<CustomerWithAccount>): Promise<void> {
  await notifyOwner("KeywordCalls campaign is LIVE", [
    `Customer: ${`${customer.account.firstName} ${customer.account.lastName}`.trim() || customer.account.email}`,
    `Keywords: ${parseList(customer.keywords).join(", ") || "—"}`,
    `Tracking number: ${customer.twilioNumber}`,
    `Routes to: ${customer.routingNumber || "—"}`,
    `Balance: $${(customer.balanceCents / 100).toFixed(2)}`,
  ]);
}
