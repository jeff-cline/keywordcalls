"use client";
import { useMemo, useState } from "react";
import RecordButton from "@/components/RecordButton";

type ListT = { id: string; name: string; rowCount: number; createdAt: string };
type Row = {
  id: string; name: string; status: string; listId: string | null; listName: string; listCount: number;
  states: string[]; bidCents: number; hoursStart: string; hoursEnd: string; tz: string;
  outboundAudioUrl: string; followupAudioUrl: string; afterHoursMessage: string; followupMessage: string;
  dialedCount: number; connectedCount: number; revenueCents: number; createdAt: string;
};
const US = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 0 });

export default function AdminCampaigns({ lists, rows }: { lists: ListT[]; rows: Row[] }) {
  const [tab, setTab] = useState<"current" | "past">("current");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let r = rows;
    if (s) r = r.filter((x) => (x.name + " " + x.listName + " " + x.states.join(" ")).toLowerCase().includes(s));
    return tab === "past" ? [...r].sort((a, b) => b.revenueCents - a.revenueCents) : r;
  }, [rows, q, tab]);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/admin/campaigns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, ...extra }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) { alert(j.error || "Action failed."); return null; }
    return j;
  }

  return (
    <div className="space-y-6">
      {/* Lists */}
      <ListsPanel lists={lists} />

      {/* Tabs + search + new */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-[color:var(--line)] overflow-hidden">
          <button className={`px-4 py-1.5 text-sm font-medium ${tab === "current" ? "bg-[color:var(--brand)] text-white" : "bg-white"}`} onClick={() => setTab("current")}>Campaigns</button>
          <button className={`px-4 py-1.5 text-sm font-medium ${tab === "past" ? "bg-[color:var(--brand)] text-white" : "bg-white"}`} onClick={() => setTab("past")}>Past campaigns</button>
        </div>
        <input className="input !py-1.5 flex-1 min-w-[180px]" placeholder="🔎 Search campaigns…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setEditing("new")}>+ New campaign</button>
      </div>

      {editing && <CampaignEditor lists={lists} campaign={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      {/* Campaigns table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Campaign</th><th className="py-2 px-4">Revenue</th><th className="py-2 px-4">List</th><th className="py-2 px-4">Dialed</th><th className="py-2 px-4">Status</th><th className="py-2 px-4">Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="py-6 px-4 text-[color:var(--muted)]">No campaigns{q ? " match your search" : " yet"}.</td></tr>}
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[color:var(--line)] last:border-0 align-top">
                  <td className="py-2 px-4"><div className="font-medium">{c.name}</div><div className="text-xs text-[color:var(--muted)]">{c.states.length} states · {usd(c.bidCents)}/call · {c.hoursStart}–{c.hoursEnd} {c.tz.split("/")[1]?.replace("_", " ")}</div></td>
                  <td className="py-2 px-4 font-bold">{usd(c.revenueCents)}</td>
                  <td className="py-2 px-4">{c.listName || "—"}<div className="text-xs text-[color:var(--muted)]">{c.listCount.toLocaleString()} contacts</div></td>
                  <td className="py-2 px-4">{c.dialedCount.toLocaleString()}</td>
                  <td className="py-2 px-4"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "on" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{c.status === "on" ? "● ON" : "OFF"}</span></td>
                  <td className="py-2 px-4">
                    <div className="flex flex-wrap gap-1">
                      <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setEditing(c)}>Manage</button>
                      <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={async () => { const r = await act(c.id, "testcall"); if (r?.ok) alert("Test call placed to your number."); }}>Test call</button>
                      <button className={`btn !py-1 !px-2 text-xs ${c.status === "on" ? "!bg-gray-600 text-white" : "btn-primary"}`} onClick={async () => { const r = await act(c.id, "toggle"); if (r) location.reload(); }}>{c.status === "on" ? "Turn OFF" : "Turn ON"}</button>
                      <button className="btn btn-ghost !py-1 !px-2 text-xs" onClick={async () => { const r = await act(c.id, "duplicate"); if (r) location.reload(); }}>Duplicate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ListsPanel({ lists }: { lists: ListT[] }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("file", file); if (name) fd.append("name", name);
    const res = await fetch("/api/admin/lists/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setMsg(`Imported ${j.count?.toLocaleString()} contacts.`); setTimeout(() => location.reload(), 1200); }
    else setMsg(j.error || "Upload failed.");
  }
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Call lists</div>
        <div className="flex items-center gap-2">
          <input className="input !py-1.5 !w-48" placeholder="List name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="btn btn-ghost text-sm cursor-pointer">{busy ? "Importing…" : "⬆ Upload CSV"}<input type="file" accept=".csv" className="hidden" onChange={upload} disabled={busy} /></label>
        </div>
      </div>
      {msg && <div className="text-sm text-[color:var(--brand2)] mb-2">{msg}</div>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lists.length === 0 && <div className="text-sm text-[color:var(--muted)]">No lists yet — upload a CSV to call &amp; email.</div>}
        {lists.map((l) => (
          <div key={l.id} className="rounded-lg border border-[color:var(--line)] p-3">
            <div className="font-medium text-sm">{l.name}</div>
            <div className="text-xs text-[color:var(--muted)]">{l.rowCount.toLocaleString()} contacts · {new Date(l.createdAt).toLocaleDateString()} {new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-[color:var(--muted)] mt-3">Very large lists (tens of thousands of rows) are imported server-side — just say the word.</div>
    </div>
  );
}

function CampaignEditor({ lists, campaign, onClose }: { lists: ListT[]; campaign: Row | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: campaign?.name || "", listId: campaign?.listId || "",
    bidDollars: campaign ? String(campaign.bidCents / 100) : "", hoursStart: campaign?.hoursStart || "08:30", hoursEnd: campaign?.hoursEnd || "17:00", tz: campaign?.tz || "America/New_York",
    afterHoursMessage: campaign?.afterHoursMessage || "", followupMessage: campaign?.followupMessage || "",
  });
  const [states, setStates] = useState<string[]>(campaign?.states || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggleState = (s: string) => setStates((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  async function save() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/admin/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: campaign?.id, ...f, states }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error || "Save failed."); return; }
    location.reload();
  }

  const missing: string[] = [];
  if (!f.listId) missing.push("list"); if (!parseFloat(f.bidDollars)) missing.push("bid"); if (!states.length) missing.push("states");
  if (!campaign?.outboundAudioUrl) missing.push("outbound recording"); if (!campaign?.followupAudioUrl) missing.push("follow-up recording");

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between"><div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">{campaign ? "Manage campaign" : "New campaign"}</div><button className="text-[color:var(--muted)] text-xl" onClick={onClose}>×</button></div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Campaign name<input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Broker Calls" /></label>
        <label className="label">List<select className="input" value={f.listId} onChange={(e) => set("listId", e.target.value)}><option value="">— pick a list —</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.rowCount.toLocaleString()})</option>)}</select></label>
        <label className="label">Bid — pay per delivered call ($)<input className="input" value={f.bidDollars} onChange={(e) => set("bidDollars", e.target.value)} placeholder="75" /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="label">Start (EST)<input type="time" className="input" value={f.hoursStart} onChange={(e) => set("hoursStart", e.target.value)} /></label>
          <label className="label">End (EST)<input type="time" className="input" value={f.hoursEnd} onChange={(e) => set("hoursEnd", e.target.value)} /></label>
        </div>
      </div>

      <div>
        <div className="label mb-1">Call in these states ({states.length})</div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">{US.map((s) => <button key={s} type="button" onClick={() => toggleState(s)} className={`rounded px-2 py-1 text-xs border ${states.includes(s) ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)]"}`}>{s}</button>)}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">After-hours message (played on callback)<textarea className="input" rows={2} value={f.afterHoursMessage} onChange={(e) => set("afterHoursMessage", e.target.value)} placeholder="Sorry, we're closed. Can we follow up during normal business hours?" /></label>
        <label className="label">Follow-up voicemail text (fallback)<textarea className="input" rows={2} value={f.followupMessage} onChange={(e) => set("followupMessage", e.target.value)} placeholder="I tried to follow up earlier. Please give me a call back." /></label>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}
      <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : campaign ? "Save changes" : "Create campaign"}</button>

      {campaign && (
        <div className="border-t border-[color:var(--line)] pt-5 space-y-4">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Recordings</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RecordButton campaignId={campaign.id} type="outbound" existingUrl={campaign.outboundAudioUrl} label="Outbound voicemail (played to their machine)" />
            <RecordButton campaignId={campaign.id} type="followup" existingUrl={campaign.followupAudioUrl} label="Next-day follow-up voicemail" />
          </div>

          <div className={`rounded-lg p-3 text-sm ${missing.length ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
            {missing.length ? <>⚠️ Before you can turn this on: <b>{missing.join(", ")}</b>.</> : <>✓ Setup complete — ready to turn on.</>}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost text-sm" onClick={async () => { const res = await fetch("/api/admin/campaigns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: campaign.id, action: "testcall" }) }); const j = await res.json().catch(() => ({})); alert(j.ok ? "Test call placed to your number 🚀" : (j.error || "Test failed.")); }}>📞 Test call to my number</button>
            <button className={`btn text-sm ${campaign.status === "on" ? "!bg-gray-600 text-white" : "btn-primary"}`} onClick={async () => { const res = await fetch("/api/admin/campaigns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: campaign.id, action: "toggle" }) }); const j = await res.json().catch(() => ({})); if (!res.ok) { alert(j.error); return; } location.reload(); }}>{campaign.status === "on" ? "Turn campaign OFF" : "Turn campaign ON 🚀"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
