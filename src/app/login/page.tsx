"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed.");
      if (data.mustChangePassword) { router.push("/change-password"); return; }
      router.push(["god", "vp", "regional", "manager", "rep"].includes(data.role) ? "/admin" : "/dashboard");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--soft)] px-5">
      <a href="/" className="mb-6"><img src="/logo.png" alt="KeywordCalls" className="h-12 w-auto" /></a>
      <div className="card w-full max-w-sm p-7">
        <h1 className="text-xl font-bold mb-1">Log in</h1>
        <p className="text-sm text-[color:var(--muted)] mb-5">Admins and customers both sign in here.</p>
        {err && <div className="mb-4 rounded border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></div>
          <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button className="btn w-full" disabled={busy}>{busy ? "Signing in…" : "Log in"}</button>
        </form>
        <div className="mt-5 text-center text-sm text-[color:var(--muted)]">New here? <a href="/signup" className="text-[color:var(--brand2)] font-semibold">Create an account 🚀</a></div>
      </div>
    </div>
  );
}
