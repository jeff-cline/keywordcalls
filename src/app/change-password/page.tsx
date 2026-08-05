"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    if (pw.length < 8) { setErr("Use at least 8 characters."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed.");
      router.push(["god", "vp", "regional", "manager", "rep"].includes(data.role) ? "/admin" : "/dashboard");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--soft)] px-5">
      <a href="/" className="mb-6"><img src="/logo.png" alt="KeywordCalls" className="h-12 w-auto" /></a>
      <div className="card w-full max-w-sm p-7">
        <h1 className="text-xl font-bold mb-1">Set a new password</h1>
        <p className="text-sm text-[color:var(--muted)] mb-5">For security, choose your own password before continuing.</p>
        {err && <div className="mb-4 rounded border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">New password</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></div>
          <div><label className="label">Confirm password</label><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          <button className="btn w-full" disabled={busy}>{busy ? "Saving…" : "Save & continue 🚀"}</button>
        </form>
      </div>
    </div>
  );
}
