import { db } from "@/lib/db";
import { getTwilioCfg, searchNumbers, provisionNumber, areaCodeOf } from "@/lib/twilio";
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

  const cfg = await getTwilioCfg();
  if (!cfg) return { ok: false, error: "Telephony not configured — add Twilio keys in Integrations first." };

  const ac = customer.areaCode || areaCodeOf(customer.account.phone) || areaCodeOf(customer.routingNumber);
  const nums = await searchNumbers(ac || "", cfg);
  if (!nums.length) return { ok: false, error: `No numbers available${ac ? ` in area code ${ac}` : ""}.` };

  const bought = await provisionNumber(nums[0], cfg);
  if (!bought) return { ok: false, error: "Number purchase failed at Twilio." };

  const updated = await db.customer.update({
    where: { id: customerId },
    data: { twilioNumber: bought.number, twilioNumberSid: bought.sid, areaCode: ac || areaCodeOf(bought.number), status: "live" },
    include: { account: true },
  });
  if (opts.notify !== false) await fireLive(updated);
  return { ok: true, number: bought.number };
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
