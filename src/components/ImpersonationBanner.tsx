"use client";
import { useState } from "react";

// Shown at the top of a customer view when a God/staff account is impersonating them.
export default function ImpersonationBanner({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  async function exit() {
    setBusy(true);
    const res = await fetch("/api/admin/impersonate/exit", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    location.href = j.redirect || "/admin/customers";
  }
  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-black text-sm font-medium">
      <div className="mx-auto max-w-6xl px-5 py-2 flex items-center justify-between gap-3">
        <span>👁️ Viewing as <b>{name || "customer"}</b> (impersonating)</span>
        <button className="rounded-lg bg-black/85 text-white px-3 py-1 text-xs font-semibold disabled:opacity-60" disabled={busy} onClick={exit}>{busy ? "Exiting…" : "Exit impersonation"}</button>
      </div>
    </div>
  );
}
