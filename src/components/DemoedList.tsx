"use client";
import { useState } from "react";
type Row = { phone: string; name: string; email: string; city: string; state: string; zip: string; timesDemoed: number; lastDemoedAt: string };
const mask = (n: string) => n;
export default function DemoedList({ rows }: { rows: Row[] }) {
  const [sel, setSel] = useState<Row | null>(null);
  const [more, setMore] = useState<Record<string, string> | null>(null);
  async function open(r: Row) {
    setSel(r); setMore(null);
    const res = await fetch(`/api/demo/lead?phone=${encodeURIComponent(r.phone)}`);
    const j = await res.json().catch(() => null);
    if (j?.found && j.lead) setMore(j.lead);
  }
  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Name</th><th className="py-2 px-4">Phone</th><th className="py-2 px-4">Location</th><th className="py-2 px-4">Times</th><th className="py-2 px-4">Last demoed</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="py-6 px-4 text-[color:var(--muted)]">No one demoed yet — drops from /demo show up here.</td></tr>}
            {rows.map((r) => (
              <tr key={r.phone} className="border-b border-[color:var(--line)] last:border-0 cursor-pointer hover:bg-[color:var(--soft)]" onClick={() => open(r)}>
                <td className="py-2 px-4 font-medium text-[color:var(--brand2)] underline">{r.name || "(unknown)"}</td>
                <td className="py-2 px-4">{mask(r.phone)}</td>
                <td className="py-2 px-4 text-[color:var(--muted)]">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="py-2 px-4">{r.timesDemoed}</td>
                <td className="py-2 px-4 text-[color:var(--muted)]">{new Date(r.lastDemoedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><div className="text-lg font-bold">{sel.name || "Lead"}</div><button className="text-[color:var(--muted)] text-xl" onClick={() => setSel(null)}>×</button></div>
            <div className="text-sm text-[color:var(--muted)] mb-3">{sel.phone}</div>
            <div className="space-y-1 text-sm">
              {(more?.email || sel.email) && <div><b>Email:</b> {more?.email || sel.email}</div>}
              <div><b>Location:</b> {[more?.city || sel.city, more?.state || sel.state, more?.zip || sel.zip].filter(Boolean).join(", ") || "—"}</div>
              <div className="mt-3 text-xs text-[color:var(--muted)]">Appended from our data network. This is who saw the demo.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
