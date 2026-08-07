"use client";
import { useEffect, useMemo, useState } from "react";
import RecordButton from "@/components/RecordButton";

type CB = { phone: string; name: string; email: string; city: string; state: string; landedAt: string; connectSec: number; billable: boolean; at: string };
type Target = { phone: string; name: string; email: string; city: string; state: string; calledBack: boolean; calledBackAt: string | null; landedAt: string; connectSec: number; billable: boolean; sentAt: string };
type Batch = { id: string; label: string; size: number; throttle: number; launchedAt: string; status: string; delivered: number; hopper: number };
type Data = {
  campaign: { id: string; name: string; hasAudio: boolean; campaignNumber: string; routingNumber: string; listCount: number; sentTotal: number; remaining: number; combined?: boolean; paused?: boolean } | null;
  delivered: number; filtered: number; loaded: number; undelivered: number; inQueue: number; processing: boolean; sendingNow?: boolean; withinWindow?: boolean; billableCount: number; calledBackCount: number; sentCount: number; batches: Batch[]; callbacks: CB[]; targets: Target[];
  tests: { id: string; name: string; rolloutGroup: string }[]; cap: { maxPerHour: number };
};
type AhRow = { phone: string; name: string; email: string; city: string; state: string; outcome: string; redropped: boolean; redroppedAt: string | null; at: string };
type AhData = { ok: boolean; afterhours: true; template: { id: string; name: string; hasAfterHoursAudio: boolean } | null; summary: { missed: number; pending: number; recovered: number }; rows: AhRow[] };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const mask = (n: string) => (n && n.length >= 4 ? `${n.slice(0, -4)}••${n.slice(-2)}` : n || "unknown");
const HOUR = 3600e3, DAY = 24 * HOUR;

export default function RolloutConsole() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [goal, setGoal] = useState("3");
  const [customAmt, setCustomAmt] = useState("1000");
  const [customThr, setCustomThr] = useState("1000");
  const [sel, setSel] = useState<Target | null>(null);
  const [routeNum, setRouteNum] = useState("");
  const [routeSaved, setRouteSaved] = useState(false);
  const [tab, setTab] = useState<string>("");            // "" = default (group A), "combined", or a campaignId
  const [showAllSent, setShowAllSent] = useState(false); // sent (not-yet-called-back) rows past the first 10
  const [addBusy, setAddBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);         // the "name your test + pick file" dialog
  const [addName, setAddName] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [ah, setAh] = useState<AhData | null>(null);      // After Hours Callback view data
  const [redropBusy, setRedropBusy] = useState(false);

  const tabQuery = tab === "combined" ? "?combined=1" : tab ? `?campaignId=${encodeURIComponent(tab)}` : "";
  async function load() {
    if (tab === "afterhours") { const r = await fetch("/api/rollout/data?afterhours=1"); if (r.ok) setAh(await r.json()); return; }
    const r = await fetch("/api/rollout/data" + tabQuery); if (r.ok) setD(await r.json());
  }
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [tab]); // eslint-disable-line

  async function togglePause() {
    if (!d?.campaign) return;
    const resume = !!d.campaign.paused;
    if (!confirm(resume ? "Resume this campaign? Held drops will start sending again." : "Pause this campaign? Queued drops will hold until you unpause.")) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/rollout/pause", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: d.campaign.id, action: resume ? "resume" : "pause" }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? (j.paused ? `⏸️ Paused — ${j.affected} batch(es) held.` : `▶️ Resumed — ${j.affected} batch(es) sending.`) : (j.error || "Failed."));
    load();
  }

  async function runRedrop() {
    if (!confirm("Send the recovery voicemail now to everyone who hasn't been re-dropped yet?")) return;
    setRedropBusy(true);
    const r = await fetch("/api/rollout/redrop", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setRedropBusy(false);
    setMsg(r.ok ? `♻️ Recovery sent to ${j.totalSent ?? 0}.` : (j.error || "Re-drop failed."));
    load();
  }

  // Add a new lead-set test: name it + upload a CSV → clones the current settings into a new A/B/C/D campaign.
  async function addTest() {
    if (!addFile || !addName.trim()) return;
    setAddBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("file", addFile); fd.append("name", addName.trim());
    const r = await fetch("/api/rollout/addtest", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setAddBusy(false);
    if (r.ok) {
      setMsg(`✓ Test ${j.group} “${j.name}” created — ${j.count?.toLocaleString()} leads. Switch to its tab to launch.`);
      setAddOpen(false); setAddName(""); setAddFile(null); setTab(j.campaignId); load();
    } else setMsg(j.error || (r.status === 413 ? "That file is too large to upload." : "Could not add test."));
  }
  const isCombined = !!d?.campaign?.combined;
  useEffect(() => { if (d?.campaign?.routingNumber && !routeNum) setRouteNum(d.campaign.routingNumber); }, [d]); // eslint-disable-line
  async function saveRoute() {
    if (!d?.campaign) return;
    const r = await fetch("/api/rollout/routing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: d.campaign.id, number: routeNum }) });
    setRouteSaved(r.ok);
  }

  async function launch(size: number, throttle: number, label: string) {
    if (!d?.campaign) return;
    if (!confirm(`Launch ${size} REAL ringless voicemails now (throttled to ${throttle}/hr)?`)) return;
    setBusy(true); setMsg(null);
    const r = await fetch("/api/rollout/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: d.campaign.id, size, throttle, label }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `🚀 Launched ${j.sent} — watch the callbacks roll in.` : (j.error || "Launch failed."));
    load();
  }

  const cbs = d?.callbacks || [];
  const t0 = d?.batches[0] ? new Date(d.batches[0].launchedAt).getTime() : (cbs[0] ? new Date(cbs[0].at).getTime() : 0);
  const now = Date.now();
  const elapsedH = t0 ? Math.max(0.01, (now - t0) / HOUR) : 0;

  const win = (ms: number) => (t0 ? cbs.filter((c) => new Date(c.at).getTime() <= t0 + ms).length : 0);
  const sent = d?.campaign?.sentTotal || 0;
  const delivered = d?.delivered || 0;
  const callbacks = d?.calledBackCount || 0;
  const billable = d?.billableCount || 0;
  const rate = delivered ? billable / delivered : 0;        // BILLABLE calls (120s+) per delivered drop
  const perHour = t0 ? billable / elapsedH : 0;             // billable calls/hour (the goal metric)
  const neededSends = rate > 0 ? Math.ceil((parseFloat(goal) || 0) / rate) : 0; // drops to yield goal billable calls
  const canLaunch = !!(d?.campaign?.hasAudio && d?.campaign?.routingNumber && !d?.campaign?.combined && !d?.campaign?.paused); // never send without a recording AND a callback number; not while paused or on the combined view

  // per-hour buckets since t0 (cap 48 bars)
  const { bars, cum } = useMemo(() => {
    if (!t0 || cbs.length === 0) return { bars: [] as number[], cum: [] as { t: number; n: number }[] };
    const hours = Math.min(48, Math.ceil((now - t0) / HOUR) + 1);
    const bars = Array(hours).fill(0);
    const cum: { t: number; n: number }[] = [];
    let running = 0;
    for (const c of cbs) { const h = Math.floor((new Date(c.at).getTime() - t0) / HOUR); if (h >= 0 && h < hours) bars[h]++; running++; cum.push({ t: (new Date(c.at).getTime() - t0) / HOUR, n: running }); }
    return { bars, cum };
  }, [cbs, t0, now]);

  const maxBar = Math.max(1, ...bars);
  const cumMax = Math.max(1, callbacks);
  const cumSpanH = Math.max(1, cum.length ? cum[cum.length - 1].t : 1);

  // Response time = how long after we sent the voicemail they called back.
  const fmtWait = (ms: number) => { const m = Math.round(ms / 60000); return m < 1 ? "<1m" : m < 60 ? `${m}m` : `${(m / 60).toFixed(1)}h`; };
  const waits = (d?.targets || []).filter((t) => t.calledBack && t.calledBackAt).map((t) => new Date(t.calledBackAt as string).getTime() - new Date(t.sentAt).getTime()).filter((w) => w >= 0);
  const avgWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;
  const quickN = waits.filter((w) => w < HOUR).length;
  const midN = waits.filter((w) => w >= HOUR && w < 8 * HOUR).length;
  const longN = waits.filter((w) => w >= 8 * HOUR).length;

  // Lead-set tabs: Original (A), then B/C/D tests, then All Combined. Green "Add Test" uploads a new list.
  const tests = d?.tests || [];
  const groupLabel = (g: string, name?: string) => {
    if (g === "A") return "Original (A)";
    // name is stored as "B · MyTest" — strip the redundant "B · " prefix if present
    const clean = (name || "").replace(new RegExp(`^${g}\\s·\\s`), "").trim();
    return clean ? `${g} · ${clean}` : `${g} Test`;
  };
  const activeId = isCombined ? "combined" : d?.campaign?.id || "";

  const sending = !!d?.sendingNow;
  const liveText = sending
    ? `SENDING NOW${d?.inQueue ? ` — ${d.inQueue.toLocaleString()} in the queue` : ""}`
    : d?.campaign?.paused ? "PAUSED — safe to make changes"
    : d?.withinWindow === false ? "Outside sending hours — safe to make changes"
    : "Idle — nothing sending right now — safe to make changes";

  return (
    <div className="space-y-6">
      {/* Live sending indicator — sticky so you always know if it's safe to change things */}
      <div className={`sticky top-0 z-40 -mx-1 rounded-xl px-4 py-3 flex items-center gap-3 font-bold shadow-sm ${sending ? "bg-[color:#dc2626] text-white" : "bg-[color:#e8f5ec] text-[color:#166534]"}`}>
        <span className={`inline-block w-3 h-3 rounded-full ${sending ? "bg-white animate-pulse" : "bg-[color:#16a34a]"}`} />
        <span className="uppercase tracking-wide text-sm">{sending ? "🔴 LIVE · " : "🟢 "}{liveText}</span>
        {sending && <span className="ml-auto text-xs font-medium normal-case opacity-90">Pause before making changes to a running batch</span>}
      </div>

      {/* Lead-set tabs */}
      <div className="card p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {tests.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.rolloutGroup === "A" ? "" : t.id); setShowAllSent(false); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${activeId === t.id ? "bg-[color:var(--brand2)] text-white" : "bg-[color:var(--soft)] text-[color:var(--ink)]"}`}
              title={t.name}>{groupLabel(t.rolloutGroup, t.name)}</button>
          ))}
          <button onClick={() => { setTab("combined"); setShowAllSent(false); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${isCombined ? "bg-[color:var(--brand2)] text-white" : "bg-[color:var(--soft)] text-[color:var(--ink)]"}`}>All Combined</button>
          <button onClick={() => { setTab("afterhours"); setShowAllSent(false); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === "afterhours" ? "bg-[color:#ff7a1a] text-white" : "bg-[color:var(--soft)] text-[color:var(--ink)]"}`}>🌙 After Hours Callback{ah?.summary?.pending ? ` (${ah.summary.pending})` : ""}</button>
          <div className="flex-1" />
          <button onClick={() => { setAddOpen(true); setMsg(null); }} className="px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer text-white bg-[#16a34a] hover:bg-[#15803d]">＋ Add Test</button>
        </div>
        <div className="text-[11px] text-[color:var(--muted)] mt-2">Each test is a separate lead file run with these exact settings — compare which list performs best. “All Combined” totals every test together.</div>
      </div>

      {tab === "afterhours" ? (
        /* ===== After Hours Callback view ===== */
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Missed callbacks" value={(ah?.summary?.missed || 0).toLocaleString()} sub="after-hours + no-answer" color="#ff7a1a" />
            <Stat label="Pending re-drop" value={(ah?.summary?.pending || 0).toLocaleString()} sub="waiting for 10am ET" color="#f59e0b" />
            <Stat label="Recovered (re-dropped)" value={(ah?.summary?.recovered || 0).toLocaleString()} sub="fresh voicemail sent" color="#16a34a" />
          </div>

          <div className="card p-6">
            <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-2">“We missed you” recovery voicemail</div>
            <p className="text-sm text-[color:var(--muted)] mb-3">Played live when the call center doesn&apos;t pick up, and re-dropped automatically at <b>10:00 AM ET</b> (9:00 AM your time) the next morning to everyone we couldn&apos;t connect — asking them to call back during business hours.</p>
            {ah?.template
              ? <>{ah.template.hasAfterHoursAudio && <div className="text-sm text-[color:#16a34a] mb-2">✓ Recorded — re-record any time below.</div>}
                  <RecordButton campaignId={ah.template.id} type="afterhours" existingUrl="" label="Record your after-hours / call-back voicemail" /></>
              : <div className="text-sm text-[color:var(--muted)]">No campaign yet.</div>}
            <div className="mt-3 flex items-center gap-2">
              <button className="btn !bg-[color:#16a34a] text-white !border-0" disabled={redropBusy || !ah?.summary?.pending || !ah?.template?.hasAfterHoursAudio} onClick={runRedrop}>{redropBusy ? "Sending…" : `♻️ Send recovery now (${ah?.summary?.pending || 0})`}</button>
              <span className="text-xs text-[color:var(--muted)]">Or wait for the automatic 10 AM ET re-drop.</span>
            </div>
            {msg && <div className="text-sm text-green-700 mt-2">{msg}</div>}
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="p-4 text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Missed & recovered callbacks</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Why missed</th><th className="py-2 px-4">Name</th><th className="py-2 px-4">Phone</th><th className="py-2 px-4">Location</th><th className="py-2 px-4">Recovery</th><th className="py-2 px-4">Called back</th></tr></thead>
                <tbody>
                  {(!ah?.rows || ah.rows.length === 0) && <tr><td colSpan={6} className="py-6 px-4 text-[color:var(--muted)]">No missed callbacks yet — everyone who called back reached an agent.</td></tr>}
                  {(ah?.rows || []).map((r, i) => (
                    <tr key={i} className="border-b border-[color:var(--line)] last:border-0">
                      <td className="py-2 px-4">{r.outcome === "after_hours" ? <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5">🌙 After hours</span> : <span className="rounded-full bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5">📵 No answer</span>}</td>
                      <td className="py-2 px-4 font-medium">{r.name || <span className="text-[color:var(--muted)]">unknown</span>}</td>
                      <td className="py-2 px-4">{mask(r.phone)}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)]">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="py-2 px-4">{r.redropped ? <span className="text-[color:#16a34a] font-semibold">♻️ Re-dropped{r.redroppedAt ? ` ${new Date(r.redroppedAt).toLocaleDateString()}` : ""}</span> : <span className="text-amber-700 text-xs">pending 10 AM</span>}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)] whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (<>
      {/* Record outbound voicemail — right here */}
      {d?.campaign && !isCombined && (
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-2">Outbound voicemail</div>
          {d.campaign.hasAudio && <div className="text-sm text-[color:#16a34a] mb-2">✓ Recorded — re-record any time below.</div>}
          <RecordButton campaignId={d.campaign.id} type="outbound" existingUrl="" label="Record your outbound voicemail" />
        </div>
      )}

      {/* Launch */}
      {!isCombined && (
      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Launch batches — {d?.campaign?.name || "…"}</div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[color:var(--muted)]">{d?.campaign ? `${sent.toLocaleString()} sent · ${d.campaign.remaining.toLocaleString()} left in list` : ""}</div>
            {d?.campaign && (
              <button onClick={togglePause} disabled={busy}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold text-white ${d.campaign.paused ? "bg-[color:#16a34a] hover:bg-[color:#15803d]" : "bg-[color:#dc2626] hover:bg-[color:#b91c1c]"}`}>
                {d.campaign.paused ? "▶️ Resume campaign" : "⏸️ Pause campaign"}
              </button>
            )}
          </div>
        </div>
        {d?.campaign?.paused && <div className="text-sm font-semibold text-[color:#dc2626] mb-3 rounded-lg bg-red-50 px-3 py-2">⏸️ This campaign is PAUSED — queued drops are holding. Resume to continue sending.</div>}
        {!d?.campaign?.hasAudio && <div className="text-sm text-amber-700 mb-3">⚠️ Record the outbound voicemail above before launching.</div>}
        {!d?.campaign?.routingNumber && <div className="text-sm text-amber-700 mb-3">⚠️ Set a callback number below — nothing can launch without one.</div>}
        <div className="grid gap-3 sm:grid-cols-3">
          <button className="btn btn-primary !py-3 text-base" disabled={busy || !canLaunch} onClick={() => launch(100, 300, "Batch 1 · 100 / 20 min")}>🚀 Batch 1 (100)</button>
          <button className="btn btn-primary !py-3 text-base" disabled={busy || !canLaunch} onClick={() => launch(500, 500, "Batch 2 · 500 / hr")}>🚀 Batch 2 (500)</button>
          <button className="btn !bg-[color:#ff7a1a] text-white !border-0 !py-3 text-base" disabled={busy || !canLaunch} onClick={() => launch(1000, 1000, "Batch 3 · 1,000")}>🚀 Batch 3 (1,000)</button>
        </div>

        {/* Custom batch — pick any amount of the remaining leads */}
        <div className="mt-4 rounded-xl bg-[color:var(--soft)] p-4">
          <div className="text-sm font-semibold mb-2">Custom batch (Batch {(d?.batches.length || 0) + 1}) — {d?.campaign?.remaining.toLocaleString() || 0} leads left</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="label">How many to send<input className="input !w-32" value={customAmt} onChange={(e) => setCustomAmt(e.target.value)} placeholder="e.g. 5000" /></label>
            <label className="label">Per hour (throttle)<input className="input !w-32" value={customThr} onChange={(e) => setCustomThr(e.target.value)} /></label>
            <button className="btn btn-primary !py-2.5" disabled={busy || !canLaunch} onClick={() => { const n = parseInt(customAmt, 10) || 0; if (n > 0) launch(n, parseInt(customThr, 10) || 1000, `Batch ${(d?.batches.length || 0) + 1} · ${n.toLocaleString()}`); }}>🚀 Go — custom</button>
          </div>
          <div className="text-[11px] text-[color:var(--muted)] mt-2">
            <b>Physical cap:</b> your ringless account can deliver up to <b>{(d?.cap?.maxPerHour || 18000).toLocaleString()}/hour</b>. The real limit is prepaid credits (~1 per delivered drop). 5,000 over an hour is well within the cap.
          </div>
        </div>

        {msg && <div className="text-sm text-green-700 mt-2">{msg}</div>}

        {/* Route callbacks to — without this, callbacks are logged but never land anywhere */}
        <div className="mt-4 rounded-xl bg-[color:var(--soft)] p-4">
          <div className="text-sm font-semibold mb-2">📞 Route callbacks to {d?.campaign?.routingNumber ? "" : <span className="text-amber-700">— not set! callbacks won&apos;t land until you add a number</span>}</div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input !w-48" value={routeNum} onChange={(e) => { setRouteNum(e.target.value); setRouteSaved(false); }} onBlur={saveRoute} placeholder="+1… your phone / call center" />
            <button className="btn btn-primary !py-2" onClick={saveRoute}>Save</button>
            {routeSaved && <span className="text-xs text-green-700">✓ callbacks will ring this number</span>}
          </div>
          {d?.campaign?.campaignNumber && <div className="text-xs text-[color:var(--muted)] mt-2">Your campaign line (the number people call back): {d.campaign.campaignNumber}</div>}
        </div>
      </div>
      )}

      {/* Processing status */}
      <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${d?.processing ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>
        {d?.processing
          ? <><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" /> Sending in progress — <b>{delivered.toLocaleString()} delivered</b>, <b>{(d?.inQueue || 0).toLocaleString()} still in queue</b>. Callbacks land as more deliver.</>
          : <><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" /> All batches complete — <b>{delivered.toLocaleString()} delivered</b>, queue empty. Now watching for callbacks.</>}
      </div>

      {/* Batches — per-batch status at a glance */}
      {(d?.batches?.length || 0) > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Batches</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Batch</th><th className="py-2 px-4">Status</th><th className="py-2 px-4">Sent</th><th className="py-2 px-4">Delivered</th><th className="py-2 px-4">In queue</th><th className="py-2 px-4">Throttle</th><th className="py-2 px-4">Launched</th></tr></thead>
              <tbody>
                {(d?.batches || []).slice().reverse().map((b) => (
                  <tr key={b.id} className="border-b border-[color:var(--line)] last:border-0">
                    <td className="py-2 px-4 font-medium">{b.label}</td>
                    <td className="py-2 px-4"><BatchPill status={b.status} hopper={b.hopper} /></td>
                    <td className="py-2 px-4">{b.size.toLocaleString()}</td>
                    <td className="py-2 px-4 text-[color:#16a34a] font-semibold">{b.delivered.toLocaleString()}</td>
                    <td className="py-2 px-4">{b.hopper.toLocaleString()}</td>
                    <td className="py-2 px-4 text-[color:var(--muted)]">{b.throttle.toLocaleString()}/hr</td>
                    <td className="py-2 px-4 text-[color:var(--muted)] whitespace-nowrap">{new Date(b.launchedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Sent" value={sent.toLocaleString()} />
        <Stat label="Delivered (ringless)" value={delivered.toLocaleString()} sub={d?.filtered ? `${d.filtered.toLocaleString()} DNC-scrubbed` : ""} color="#16a34a" />
        <Stat label="In queue" value={(d?.inQueue || 0).toLocaleString()} sub={d?.processing ? "still sending" : "done"} color="#f59e0b" />
        <Stat label="Callbacks" value={callbacks.toLocaleString()} color="#2f6bff" />
        <Stat label="Billable (120s+)" value={(d?.billableCount || 0).toLocaleString()} sub="counts toward the goal" color="#16a34a" />
        <Stat label="Calls / hour" value={perHour ? perHour.toFixed(1) : "—"} sub={t0 ? `over ${elapsedH.toFixed(1)}h` : ""} color="#ff7a1a" />
      </div>

      {/* Delivery funnel — where every submitted number went */}
      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Delivery funnel — where every number went</div>
        {(() => {
          const submitted = sent;
          const loaded = d?.loaded || 0;
          const nonMobile = Math.max(0, submitted - loaded);
          const dnc = d?.filtered || 0;
          const noVm = d?.undelivered || 0;
          const pct = (n: number) => submitted ? `${Math.round((n / submitted) * 100)}%` : "0%";
          const steps = [
            { label: "Submitted", n: submitted, color: "#0f1115", note: "numbers you sent" },
            { label: "Non-mobile / invalid", n: nonMobile, color: "#9ca3af", note: "landlines & VoIP — can't ringless" },
            { label: "Mobile (loaded)", n: loaded, color: "#2f6bff", note: "RVM-eligible cell phones" },
            { label: "DNC / litigator scrubbed", n: dnc, color: "#f59e0b", note: "on the Do-Not-Call list" },
            { label: "No voicemail left", n: noVm, color: "#9ca3af", note: "cleared without a VM" },
            { label: "Delivered ringless", n: delivered, color: "#16a34a", note: "actual voicemails dropped" },
            { label: "Called back", n: callbacks, color: "#16d6a5", note: "high-intent leads" },
          ];
          return (
            <div className="space-y-2">
              {steps.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-44 text-sm shrink-0">{s.label}</div>
                  <div className="flex-1 h-6 rounded bg-[color:var(--soft)] overflow-hidden"><div className="h-full rounded flex items-center px-2 text-white text-xs font-bold" style={{ width: `${submitted ? Math.max(4, (s.n / submitted) * 100) : 0}%`, background: s.color }}>{s.n.toLocaleString()}</div></div>
                  <div className="w-12 text-right text-xs text-[color:var(--muted)]">{pct(s.n)}</div>
                </div>
              ))}
              <div className="text-xs text-[color:var(--muted)] pt-1">Ringless only lands on mobile numbers that aren&apos;t on the DNC list — the biggest drop-offs above tell you your list quality.</div>
            </div>
          );
        })()}
      </div>

      {/* Time windows */}
      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Callbacks by time window (30-day tracking)</div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
          {[["1 hour", HOUR], ["8 hours", 8 * HOUR], ["2 days", 2 * DAY], ["7 days", 7 * DAY], ["30 days", 30 * DAY]].map(([lbl, ms]) => (
            <div key={lbl as string} className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-2xl font-extrabold">{win(ms as number)}</div><div className="text-[11px] uppercase text-[color:var(--muted)]">{lbl}</div></div>
          ))}
        </div>
      </div>

      {/* Response time reporting */}
      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Response time — how long after the voicemail they call back</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-2xl font-extrabold text-[color:var(--brand2)]">{waits.length ? fmtWait(avgWait) : "—"}</div><div className="text-[11px] uppercase text-[color:var(--muted)]">Avg response</div></div>
          <div className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-2xl font-extrabold">{quickN}</div><div className="text-[11px] uppercase text-[color:var(--muted)]">Quick (&lt;1h)</div></div>
          <div className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-2xl font-extrabold">{midN}</div><div className="text-[11px] uppercase text-[color:var(--muted)]">Mid (1–8h)</div></div>
          <div className="rounded-lg bg-[color:var(--soft)] p-3"><div className="text-2xl font-extrabold">{longN}</div><div className="text-[11px] uppercase text-[color:var(--muted)]">Long (8h+)</div></div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Callbacks per hour</div>
          {bars.length === 0 ? <div className="text-sm text-[color:var(--muted)] py-8 text-center">Launch a batch to start collecting data.</div> : (
            <div className="flex items-end gap-1 h-40">
              {bars.map((v, i) => <div key={i} className="flex-1 rounded-t bg-[color:var(--brand2)]" style={{ height: `${(v / maxBar) * 100}%` }} title={`hr ${i}: ${v}`} />)}
            </div>
          )}
          <div className="text-[11px] text-[color:var(--muted)] mt-1">hours since first launch →</div>
        </div>
        <div className="card p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-3">Cumulative callbacks</div>
          {cum.length === 0 ? <div className="text-sm text-[color:var(--muted)] py-8 text-center">No callbacks yet.</div> : (
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-40">
              <polyline fill="rgba(47,107,255,0.15)" stroke="none" points={`0,40 ${cum.map((p) => `${(p.t / cumSpanH) * 100},${40 - (p.n / cumMax) * 38}`).join(" ")} 100,40`} />
              <polyline fill="none" stroke="#2f6bff" strokeWidth="0.8" points={cum.map((p) => `${(p.t / cumSpanH) * 100},${40 - (p.n / cumMax) * 38}`).join(" ")} />
            </svg>
          )}
        </div>
      </div>

      {/* Goal calculator */}
      <div className="card p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)] mb-2">Goal → how many to send</div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>I want</span><input className="input !w-20 !py-1" value={goal} onChange={(e) => setGoal(e.target.value)} /><span>billable calls (120s+) / hour.</span>
          <span className="text-[color:var(--muted)]">Observed billable rate: <b className="text-[color:var(--ink)]">{(rate * 100).toFixed(2)}%</b> of delivered.</span>
        </div>
        <div className="mt-3 text-lg">
          {rate > 0
            ? <>To net <b>{goal}</b> billable calls you need to deliver <b className="text-[color:var(--brand2)]">{neededSends.toLocaleString()}</b> ringless drops. At {perHour.toFixed(1)} billable calls/hr observed, scale sends proportionally.</>
            : <span className="text-[color:var(--muted)]">Collecting data — the billable rate appears once 120s+ callbacks come in.</span>}
        </div>
      </div>

      {/* Sent list — callbacks turn green + pop to top; click a green one for appended data */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Sent list — callbacks light up green &amp; pop to the top</div>
          <div className="text-xs text-[color:var(--muted)]">{(d?.calledBackCount || 0)} of {(d?.sentCount || 0).toLocaleString()} called back</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-[color:var(--muted)] border-b border-[color:var(--line)] bg-[color:var(--soft)]"><th className="py-2 px-4">Status</th><th className="py-2 px-4">Name</th><th className="py-2 px-4">Phone</th><th className="py-2 px-4">Location</th><th className="py-2 px-4">Landed at</th><th className="py-2 px-4">Talk time</th><th className="py-2 px-4">Response</th><th className="py-2 px-4">When</th></tr></thead>
            <tbody>
              {(!d?.targets || d.targets.length === 0) && <tr><td colSpan={8} className="py-6 px-4 text-[color:var(--muted)]">Numbers appear here as batches send. They turn green when they call back.</td></tr>}
              {(() => {
                const all = d?.targets || [];
                const green = all.filter((t) => t.calledBack);
                const notYet = all.filter((t) => !t.calledBack);
                const greenCapped = green.slice(0, 100); // hard-cap green at the first 100
                const sentShown = showAllSent ? notYet : notYet.slice(0, 10);
                const row = (t: Target, i: number, key: string) => {
                  const wait = t.calledBack && t.calledBackAt ? new Date(t.calledBackAt).getTime() - new Date(t.sentAt).getTime() : -1;
                  return (
                    <tr key={key} className={`border-b border-[color:var(--line)] last:border-0 ${t.calledBack ? "bg-[#16a34a]/10 cursor-pointer hover:bg-[#16a34a]/20" : ""}`} onClick={t.calledBack ? () => setSel(t) : undefined}>
                      <td className="py-2 px-4">{t.calledBack ? <span className="rounded-full bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5">📞 Called back</span> : <span className="text-[color:var(--muted)] text-xs">sent</span>}</td>
                      <td className="py-2 px-4 font-medium">{t.name || <span className="text-[color:var(--muted)]">unknown</span>}</td>
                      <td className="py-2 px-4">{mask(t.phone)}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)]">{[t.city, t.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="py-2 px-4">{t.landedAt ? t.landedAt : t.calledBack ? <span className="text-amber-700 text-xs">no route set</span> : <span className="text-[color:var(--muted)]">—</span>}</td>
                      <td className="py-2 px-4">{t.connectSec ? <span className={t.connectSec >= 120 ? "text-[color:#16a34a] font-bold" : "text-[color:var(--ink)]"}>{mmss(t.connectSec)}</span> : <span className="text-[color:var(--muted)]">—</span>}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)]">{wait >= 0 ? fmtWait(wait) : "—"}</td>
                      <td className="py-2 px-4 text-[color:var(--muted)] whitespace-nowrap">{t.calledBackAt ? new Date(t.calledBackAt).toLocaleTimeString() : "—"}</td>
                    </tr>
                  );
                };
                return (
                  <>
                    {greenCapped.map((t, i) => row(t, i, `g${i}`))}
                    {green.length > 100 && (
                      <tr><td colSpan={8} className="py-2 px-4 text-xs text-[color:var(--muted)] bg-[#16a34a]/5">Showing the first 100 of {green.length.toLocaleString()} callbacks.</td></tr>
                    )}
                    {sentShown.map((t, i) => row(t, i, `s${i}`))}
                    {!showAllSent && notYet.length > 10 && (
                      <tr><td colSpan={8} className="py-2 px-4 text-center"><button className="text-sm font-semibold text-[color:var(--brand2)] hover:underline" onClick={() => setShowAllSent(true)}>Show more ({(notYet.length - 10).toLocaleString()} more sent)</button></td></tr>
                    )}
                    {showAllSent && notYet.length > 10 && (
                      <tr><td colSpan={8} className="py-2 px-4 text-center"><button className="text-sm font-semibold text-[color:var(--muted)] hover:underline" onClick={() => setShowAllSent(false)}>Show less</button></td></tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      </>)}

      {/* Add Test dialog — name it, then pick the lead file */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !addBusy && setAddOpen(false)}>
          <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div className="text-lg font-bold">Add a lead-set test</div><button className="text-[color:var(--muted)] text-xl" onClick={() => !addBusy && setAddOpen(false)}>×</button></div>
            <div className="space-y-4">
              <label className="label block">Name this test
                <input className="input w-full mt-1" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. TX seniors — vendor B" autoFocus />
              </label>
              <label className="label block">Lead file (CSV)
                <input type="file" accept=".csv,text/csv" className="mt-1 block w-full text-sm" onChange={(e) => setAddFile(e.target.files?.[0] || null)} />
                {addFile && <span className="text-xs text-[color:var(--muted)]">{addFile.name} · {(addFile.size / 1e6).toFixed(1)} MB</span>}
              </label>
              <div className="text-[11px] text-[color:var(--muted)]">Runs with these exact settings (states, bid, hours, recording, callback number). Needs a phone column (personal_phone / mobile_phone / direct_number).</div>
              <div className="flex justify-end gap-2">
                <button className="btn" onClick={() => setAddOpen(false)} disabled={addBusy}>Cancel</button>
                <button className="btn btn-primary" onClick={addTest} disabled={addBusy || !addFile || !addName.trim()}>{addBusy ? "Uploading…" : "Create test"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Append modal */}
      {sel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><div className="text-lg font-bold">{sel.name || "Lead"} {sel.billable && <span className="text-[color:#16a34a] text-sm">· billable</span>}</div><button className="text-[color:var(--muted)] text-xl" onClick={() => setSel(null)}>×</button></div>
            <div className="space-y-1 text-sm">
              <div><b>Their phone:</b> {sel.phone}</div>
              {sel.email && <div><b>Email:</b> {sel.email}</div>}
              <div><b>Location:</b> {[sel.city, sel.state].filter(Boolean).join(", ") || "—"}</div>
              <div className="pt-2 border-t border-[color:var(--line)] mt-2" />
              <div><b>Voicemail sent:</b> {new Date(sel.sentAt).toLocaleString()}</div>
              <div><b>Called back:</b> {sel.calledBackAt ? new Date(sel.calledBackAt).toLocaleString() : "—"}</div>
              <div><b>Response time:</b> {sel.calledBackAt ? fmtWait(new Date(sel.calledBackAt).getTime() - new Date(sel.sentAt).getTime()) : "—"}</div>
              <div><b>Landed at (routed to):</b> {sel.landedAt || <span className="text-amber-700">no routing number was set</span>}</div>
              <div><b>Talk time:</b> {sel.connectSec ? <span className={sel.connectSec >= 120 ? "text-[color:#16a34a] font-bold" : ""}>{mmss(sel.connectSec)}{sel.billable ? " · billable (120s+)" : ""}</span> : "—"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Per-batch status pill from the live JDI status. A stopped-with-empty-hopper batch reads "Complete".
function BatchPill({ status, hopper }: { status: string; hopper: number }) {
  const s = (status || "").toUpperCase();
  let label = s || "—", cls = "bg-gray-100 text-gray-700";
  if (s === "ACTIVE") { label = hopper > 0 ? "🟢 Active" : "🟢 Active (draining)"; cls = "bg-green-100 text-green-800"; }
  else if (s === "PAUSED") { label = "⏸️ Paused"; cls = "bg-amber-100 text-amber-800"; }
  else if (s === "COMPLETED") { label = "✓ Complete"; cls = "bg-blue-100 text-blue-800"; }
  else if (s === "STOPPED") { label = "■ Stopped"; cls = "bg-gray-200 text-gray-700"; }
  else if (s === "SCHEDULED" || s === "PENDING") { label = "🕒 Scheduled"; cls = "bg-indigo-100 text-indigo-800"; }
  return <span className={`rounded-full text-xs font-semibold px-2 py-0.5 ${cls}`}>{label}</span>;
}

function Stat({ label, value, sub, color = "#0f1115" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-5"><div className="text-xs uppercase text-[color:var(--muted)]">{label}</div><div className="text-3xl font-extrabold" style={{ color }}>{value}</div>{sub ? <div className="text-xs text-[color:var(--muted)]">{sub}</div> : null}</div>
  );
}
