import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("TEMP!234", 10);

  // God account — forced password change on first login.
  await db.account.upsert({
    where: { email: "jeff.cline@me.com" },
    update: {},
    create: { email: "jeff.cline@me.com", passwordHash: hash, role: "god", firstName: "Jeff", lastName: "Cline", mustChangePassword: true, refSlug: "jeff-cline" },
  });

  // Plans (editable prices).
  const plans = [
    { name: "Local", scope: "local", priceCents: 75000, multiAgent: false, sortOrder: 1 },
    { name: "Statewide", scope: "statewide", priceCents: 300000, multiAgent: true, sortOrder: 2 },
    { name: "Regional", scope: "regional", priceCents: 750000, multiAgent: true, sortOrder: 3 },
    { name: "National", scope: "national", priceCents: 1500000, multiAgent: true, sortOrder: 4 },
  ];
  for (const p of plans) {
    const existing = await db.plan.findFirst({ where: { scope: p.scope } });
    if (!existing) await db.plan.create({ data: p });
  }

  // Keyword catalog + per-call price.
  const keywords = [
    { name: "Health Insurance", priceCents: 9000, sortOrder: 1 },
    { name: "Peptides", priceCents: 7500, sortOrder: 2 },
    { name: "Medicare Specialist", priceCents: 3500, sortOrder: 3 },
  ];
  for (const k of keywords) {
    await db.keyword.upsert({ where: { name: k.name }, update: {}, create: k });
  }

  // God-editable knobs.
  const settings: Record<string, string> = {
    setupFeeCents: "40000",       // $400 programmatic setup (locked once running)
    minFundCents: "50000",         // $500 minimum funding
    calendlyUrl: "https://calendly.com/jdcline/book-onboarding-call",
    notifyEmail: "jeff.cline@me.com",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log("✅ keywordcalls seed complete — God: jeff.cline@me.com / TEMP!234 (must change on first login)");
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); db.$disconnect(); process.exit(1); });
