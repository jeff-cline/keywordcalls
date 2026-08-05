"use client";
import { useRouter } from "next/navigation";
export default function LogoutButton() {
  const router = useRouter();
  return <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }} className="btn-ghost btn !py-1.5 !px-3 text-sm">Log out</button>;
}
