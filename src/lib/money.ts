import { db } from "@/lib/db";

// Move money on a customer's pre-funded balance and record a ledger entry. Idempotent per stripeRef.
export async function creditBalance(customerId: string, amountCents: number, kind: string, note: string, stripeRef = ""): Promise<{ balance: number; already: boolean }> {
  return db.$transaction(async (tx) => {
    if (stripeRef) {
      const dup = await tx.ledgerEntry.findFirst({ where: { customerId, stripeRef } });
      if (dup) { const c = await tx.customer.findUnique({ where: { id: customerId } }); return { balance: c?.balanceCents || 0, already: true }; }
    }
    const c = await tx.customer.findUnique({ where: { id: customerId } });
    if (!c) return { balance: 0, already: false };
    const bal = c.balanceCents + amountCents;
    await tx.customer.update({ where: { id: customerId }, data: { balanceCents: bal, ...(kind === "fund" || kind === "coupon" ? { status: c.status === "new" ? "funded" : c.status } : {}) } });
    await tx.ledgerEntry.create({ data: { customerId, kind, amountCents, balanceAfterCents: bal, note, stripeRef } });
    return { balance: bal, already: false };
  });
}
