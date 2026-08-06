import { db } from "@/lib/db";
import SignupWizard from "@/components/SignupWizard";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const sp = await searchParams;
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, scope: true, priceCents: true, multiAgent: true } });
  return <SignupWizard plans={plans} refSlug={sp.ref || ""} />;
}
