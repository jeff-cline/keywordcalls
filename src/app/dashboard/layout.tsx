import { getSession } from "@/lib/auth";
import ImpersonationBanner from "@/components/ImpersonationBanner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <>
      {s?.imp && <ImpersonationBanner name={s.name} />}
      {children}
    </>
  );
}
