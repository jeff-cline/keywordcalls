"use client";
import { useState } from "react";

const KINDS: { key: string; label: string }[] = [
  { key: "press", label: "Press" },
  { key: "investor", label: "Investor Relations" },
  { key: "partnership", label: "Strategic Partnership" },
  { key: "advertise", label: "Advertise With Us" },
  { key: "sponsor", label: "Sponsor" },
];

export default function Footer() {
  const [open, setOpen] = useState<string | null>(null);
  const active = KINDS.find((k) => k.key === open);

  return (
    <footer className="mt-20 border-t border-[color:var(--line)] bg-[color:var(--soft)]">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xs">
            <img src="/logo.png" alt="KeywordCalls" className="h-8 w-auto mb-3" />
            <p className="text-sm text-[color:var(--muted)]">High-intent, keyword-targeted phone calls delivered to your line in real time. 🚀</p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Company</div>
            <div className="flex flex-col gap-2 text-sm">
              {KINDS.map((k) => (
                <button key={k.key} onClick={() => setOpen(k.key)} className="text-left text-[color:var(--ink)] hover:text-[color:var(--brand2)]">{k.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Get started</div>
            <div className="flex flex-col gap-2 text-sm">
              <a href="/signup" className="hover:text-[color:var(--brand2)]">Create an account</a>
              <a href="/login" className="hover:text-[color:var(--brand2)]">Log in</a>
              <a href="https://calendly.com/jdcline/book-onboarding-call" target="_blank" rel="noreferrer" className="hover:text-[color:var(--brand2)]">Book an onboarding call</a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[color:var(--line)] text-xs text-[color:var(--muted)]">© {2026} KeywordCalls · Powered by PredictiveData.org + R0cketShip 🚀</div>
      </div>

      {active && <ContactModal kind={active.key} label={active.label} onClose={() => setOpen(null)} />}
    </footer>
  );
}

function ContactModal({ kind, label, onClose }: { kind: string; label: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", phone: "", email: "", company: "", website: "", reason: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name.trim() || !f.email.trim()) { setErr("Name and email are required."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...f }) });
      if (!res.ok) throw new Error("Could not send.");
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-[color:var(--brand)]">{label}</h3>
          <button onClick={onClose} className="text-[color:var(--muted)] hover:text-[color:var(--ink)]">✕</button>
        </div>
        {done ? (
          <div className="py-8 text-center">
            <div className="text-3xl mb-2">🚀</div>
            <div className="font-semibold">Thanks — we got it.</div>
            <div className="text-sm text-[color:var(--muted)] mt-1">Our team will reach out shortly.</div>
            <button onClick={onClose} className="btn btn-ghost mt-4">Close</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-[color:var(--muted)] mb-4">Tell us a bit and we&apos;ll be in touch.</p>
            {err && <div className="mb-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Name*</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div><label className="label">Email*</label><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><label className="label">Company</label><input className="input" value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="label">Website</label><input className="input" value={f.website} onChange={(e) => set("website", e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="label">Reason for contact</label><textarea className="input min-h-[90px]" value={f.reason} onChange={(e) => set("reason", e.target.value)} /></div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send 🚀"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
