"use client";
import { useEffect, useRef, useState } from "react";
import DemoRecorder from "@/components/DemoRecorder";

type Ev = { id: string; kind: string; phone: string; note: string; at: string };
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const mask = (n: string) => (n && n.length >= 4 ? `${n.slice(0, -4)}••${n.slice(-2)}` : n || "unknown");

export default function DemoConsole({ initialDemoNumber, initialHasAudio }: { initialDemoNumber: string; initialHasAudio: boolean }) {
  // ---- LTV → ROAS calculator ----
  const [ltv, setLtv] = useState("3000");
  const ltvNum = parseFloat(ltv) || 0;
  const valuePerCall = ltvNum / 10;   // revenue per qualified call (~10% close)
  const pricePerCall = ltvNum / 30;   // fair price per call
  const roas = pricePerCall > 0 ? valuePerCall / pricePerCall : 0; // = 3.0x

  // ---- "calls live now" — changes every 10 seconds ----
  const [callsLive, setCallsLive] = useState(66);
  useEffect(() => {
    const id = setInterval(() => setCallsLive(() => 58 + Math.floor(Math.random() * 18)), 10_000);
    return () => clearInterval(id);
  }, []);

  // ---- live demo tool ----
  const [demoNumber, setDemoNumber] = useState(initialDemoNumber);
  const [hasAudio, setHasAudio] = useState(initialHasAudio);
  const [numbers, setNumbers] = useState("");
  const [callbackTarget, setCallbackTarget] = useState("");
  const [targetSaved, setTargetSaved] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [rf, setRf] = useState({ name: "", email: "", password: "" });
  const [resultsUrl, setResultsUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [drops, setDrops] = useState(0);
  const [callbacks, setCallbacks] = useState(0);
  const [notConnected, setNotConnected] = useState(0);
  const feedRef = useRef<HTMLDivElement | null>(null);

  async function poll() {
    const res = await fetch("/api/demo/events");
    if (!res.ok) return;
    const j = await res.json();
    setEvents(j.events || []); setDrops(j.drops || 0); setCallbacks(j.callbacks || 0); setNotConnected(j.notConnected || 0);
    if (j.demoNumber) setDemoNumber(j.demoNumber);
    setHasAudio(j.hasAudio);
  }
  useEffect(() => { poll(); const id = setInterval(poll, 2500); return () => clearInterval(id); }, []);

  async function saveTarget() {
    const res = await fetch("/api/demo/target", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number: callbackTarget }) });
    setTargetSaved(res.ok);
  }
  async function go() {
    setMsg(null);
    // Ensure the backend Twilio number exists (silent — never shown to prospects).
    if (!demoNumber) { const pr = await fetch("/api/demo/provision", { method: "POST" }); const pj = await pr.json().catch(() => ({})); if (pj.number) setDemoNumber(pj.number); }
    if (callbackTarget && !targetSaved) await saveTarget();
    setLaunching(true);
    const res = await fetch("/api/demo/go", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numbers }) });
    const j = await res.json().catch(() => ({}));
    // Keep the rocket + "Processing" up for 7s so the voicemails land, then reveal results.
    setTimeout(() => { setLaunching(false); setMsg(res.ok ? `🚀 Dropped ${j.placed} voicemail${j.placed === 1 ? "" : "s"} — watch the board.` : (j.error || "Failed.")); poll(); }, 7000);
  }
  async function getResults() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/results/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...rf, ltvDollars: ltv }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setResultsUrl(j.url); else setMsg(j.error || "Could not create your results.");
  }

  const [lead, setLead] = useState<{ phone: string; found: boolean; lead?: { name: string; email: string; city: string; state: string; zip: string } } | null>(null);
  async function openLead(phone: string) {
    setLead({ phone, found: false });
    const res = await fetch(`/api/demo/lead?phone=${encodeURIComponent(phone)}`);
    const j = await res.json().catch(() => null);
    if (j?.ok) setLead(j);
  }
  const lastCallback = events.find((e) => e.kind === "callback");
  const lastDrop = events.find((e) => e.kind === "drop");

  const roiConversions = callbacks; // callbacks are the live leads
  const liveRevenue = roiConversions * valuePerCall;
  const liveSpend = drops * pricePerCall;
  const liveRoas = liveSpend > 0 ? liveRevenue / liveSpend : 0;

  return (
    <div className="space-y-16">
      {/* HERO */}
      <section className="text-center pt-6">
        <img src="/logo.png" alt="KeywordCalls" className="mx-auto w-[380px] max-w-[80%] h-auto" />
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[color:#ff7a1a]/15 text-[color:#ff7a1a] px-4 py-1.5 text-sm font-bold">🚀 LIVE DEMO</div>
        <h1 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight text-[color:var(--ink)]">What&apos;s the lifelong value<br />of a customer?</h1>

        {/* LTV → ROAS calculator */}
        <div className="mt-8 mx-auto max-w-2xl card p-6">
          <label className="label">Enter a customer&apos;s lifetime value</label>
          <div className="flex items-center justify-center gap-2 text-3xl font-extrabold">
            <span className="text-[color:var(--muted)]">$</span>
            <input className="input !text-3xl !font-extrabold !w-48 text-center" value={ltv} onChange={(e) => setLtv(e.target.value)} />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div><div className="text-xs uppercase text-[color:var(--muted)]">Revenue / call</div><div className="text-2xl font-extrabold text-[color:var(--brand2)]">{money(valuePerCall)}</div><div className="text-[11px] text-[color:var(--muted)]">LTV ÷ 10</div></div>
            <div><div className="text-xs uppercase text-[color:var(--muted)]">Your price / call</div><div className="text-2xl font-extrabold">{money(pricePerCall)}</div><div className="text-[11px] text-[color:var(--muted)]">LTV ÷ 30</div></div>
            <div><div className="text-xs uppercase text-[color:var(--muted)]">ROAS</div><div className="text-2xl font-extrabold text-[color:#16a34a]">{roas.toFixed(1)}×</div><div className="text-[11px] text-[color:var(--muted)]">every $1 → ${roas.toFixed(0)}</div></div>
          </div>
        </div>
      </section>

      {/* FEATURED — orange band, blue "33× more valuable" */}
      <section className="rounded-3xl bg-[color:#ff7a1a] text-white text-center px-6 py-14">
        <img src="/logo.png" alt="KeywordCalls" className="mx-auto w-[220px] max-w-[70%] h-auto mb-6 brightness-0 invert" />
        <div className="text-3xl md:text-5xl font-extrabold">Inbound calls are <span className="text-[color:var(--brand2)]">33× more valuable</span><br />than clicks. 🚀</div>
      </section>

      {/* CALLS LIVE NOW */}
      <section>
        <div className="rounded-3xl bg-[#0b1020] text-white p-8 md:p-12">
          <div className="flex items-center justify-between mb-8">
            <div className="text-sm font-bold uppercase tracking-widest text-white/50">Network · live</div>
            <div className="flex items-center gap-2 text-sm text-green-400"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" /> real-time</div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <img src="/logo.png" alt="KeywordCalls" className="w-[220px] max-w-[70%] h-auto brightness-0 invert" />
            <div className="text-center">
              <div className="text-7xl md:text-8xl font-extrabold tabular-nums text-[color:#ff7a1a]">{callsLive}</div>
              <div className="text-sm uppercase tracking-widest text-white/50 mt-1">Calls live now</div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE DEMO TOOL */}
      <section className="rounded-3xl bg-[#0b1020] text-white p-8 md:p-12">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center">See it work — right now 🚀</h2>
        <p className="text-center text-white/60 mt-2">Record a voicemail, drop it to real phones, and watch callbacks light up the board live.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div><div className="text-sm font-bold uppercase tracking-wide text-white/50 mb-2">1 · Record your voicemail</div><DemoRecorder hasAudio={hasAudio} onSaved={() => setHasAudio(true)} /></div>
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-white/50 mb-2">2 · Set number to receive callbacks</div>
              <input className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white text-sm" placeholder="Your phone — rings when they call back" value={callbackTarget} onChange={(e) => { setCallbackTarget(e.target.value); setTargetSaved(false); }} onBlur={saveTarget} />
              {targetSaved && <div className="text-xs text-green-400 mt-1">✓ callbacks will ring this number</div>}
            </div>
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-white/50 mb-2">3 · Phone numbers to test</div>
              <textarea className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white text-sm" rows={4} placeholder="One per line — e.g. (972) 800-6670" value={numbers} onChange={(e) => setNumbers(e.target.value)} />
            </div>
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-white/50 mb-2">4 · Click Go to leave voicemails</div>
              <button className="btn !bg-[color:#ff7a1a] text-white !border-0 text-base !px-7 w-full" disabled={launching || !hasAudio} onClick={go}>🚀 Go — leave the voicemails</button>
              {!hasAudio && <span className="text-xs text-white/50 block mt-1">record a voicemail first</span>}
            </div>
            {msg && <div className="text-sm text-green-300">{msg}</div>}
          </div>

          <div className="space-y-6">
          {/* Live board */}
          <div className="rounded-2xl bg-black/30 border border-white/10 p-5">
            {/* Activation success */}
            <div className={`rounded-xl p-4 mb-4 ${lastCallback ? "bg-[#16d6a5]/15 border border-[#16d6a5]/40" : "bg-white/5 border border-white/10"}`}>
              <div className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">Activation</div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className={`flex items-center gap-1 ${lastDrop ? "text-white" : "text-white/40"}`}>📨 Outbound {lastDrop ? "✓" : "—"}</span>
                <span className="text-white/30">→</span>
                <span className={`flex items-center gap-1 ${lastCallback ? "text-[#16d6a5]" : "text-white/40"}`}>📞 Inbound {lastCallback ? "✓" : "…"}</span>
                <span className="text-white/30">→</span>
                <span className={`font-extrabold ${lastCallback ? "text-[#ff7a1a]" : "text-white/40"}`}>$75 value</span>
              </div>
              {lastCallback && <button className="mt-2 text-xs underline text-white/70" onClick={() => openLead(lastCallback.phone)}>See who this lead is →</button>}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              <div><div className="text-2xl font-extrabold text-[#2f6bff]">{drops}</div><div className="text-[10px] uppercase text-white/50">VMs left</div></div>
              <div><div className="text-2xl font-extrabold text-white/40">{notConnected}</div><div className="text-[10px] uppercase text-white/50">Not conn.</div></div>
              <div><div className="text-2xl font-extrabold text-[#16d6a5]">{callbacks}</div><div className="text-[10px] uppercase text-white/50">Callbacks</div></div>
              <div><div className="text-2xl font-extrabold text-[#ff7a1a]">{liveRoas ? liveRoas.toFixed(1) + "×" : "—"}</div><div className="text-[10px] uppercase text-white/50">Live ROAS</div></div>
            </div>
            <div ref={feedRef} className="space-y-2 max-h-80 overflow-y-auto">
              {events.length === 0 && <div className="text-sm text-white/40 py-8 text-center">Waiting for activity…</div>}
              {events.map((e) => {
                const label = e.kind === "callback" ? "Callback — live lead!" : e.kind === "notconnected" ? (e.note || "Not connected") : "Voicemail left";
                const icon = e.kind === "callback" ? "📞" : e.kind === "notconnected" ? "📵" : "📨";
                const bg = e.kind === "callback" ? "bg-[#16d6a5]/15" : e.kind === "notconnected" ? "bg-white/[0.03] text-white/50" : "bg-white/5";
                const clickable = e.kind === "callback";
                return (
                  <div key={e.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${bg} ${clickable ? "cursor-pointer hover:bg-[#16d6a5]/25" : ""}`} onClick={clickable ? () => openLead(e.phone) : undefined}>
                    <span>{icon}</span>
                    <span className="flex-1">{label} · {mask(e.phone)}{clickable && <span className="text-[#ff7a1a] font-bold"> · $75</span>}</span>
                    <span className="text-white/40 text-xs">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Get Results → account + PDF */}
          <div className="rounded-2xl bg-white text-[color:var(--ink)] p-5">
            <div className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted)]">Get your results</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]"><b className="text-[color:var(--ink)]">{drops}</b> voicemails left · <b className="text-[color:var(--ink)]">{callbacks}</b> callbacks · lifelong value <b className="text-[color:var(--ink)]">${(parseFloat(ltv) || 0).toLocaleString()}</b></div>
            {resultsUrl ? (
              <div className="mt-3 space-y-2">
                <div className="text-sm text-green-700 font-medium">✓ Account created — we emailed your results.</div>
                <div className="flex flex-wrap gap-2">
                  <a href={resultsUrl} target="_blank" rel="noopener" className="btn btn-primary text-sm">View my results →</a>
                  <a href={`/api/results/pdf?ltv=${(parseFloat(ltv) || 0).toFixed(0)}`} target="_blank" rel="noopener" className="btn btn-ghost text-sm">⬇ Download PDF</a>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                <input className="input !py-2" placeholder="Your name" value={rf.name} onChange={(e) => setRf((p) => ({ ...p, name: e.target.value }))} />
                <input className="input !py-2" placeholder="Email" value={rf.email} onChange={(e) => setRf((p) => ({ ...p, email: e.target.value }))} />
                <input className="input !py-2" type="password" placeholder="Pick a password" value={rf.password} onChange={(e) => setRf((p) => ({ ...p, password: e.target.value }))} />
                <button className="btn !bg-[color:#ff7a1a] text-white !border-0" disabled={busy} onClick={getResults}>{busy ? "Creating…" : "Get results & create account 🚀"}</button>
                <div className="text-[11px] text-[color:var(--muted)]">We&apos;ll create your account and email your branded results PDF.</div>
              </div>
            )}
          </div>
          </div>
        </div>
      </section>

      {/* Launch animation overlay */}
      {launching && (
        <div className="fixed inset-0 z-[100] bg-[#0b1020] flex flex-col items-center justify-center overflow-hidden">
          <div className="kwc-rocket absolute text-7xl" style={{ bottom: 0 }}>🚀</div>
          <img src="/logo.png" alt="KeywordCalls" className="kwc-spin w-28 h-auto brightness-0 invert" />
          <div className="mt-6 text-white font-extrabold text-2xl tracking-widest uppercase">Processing…</div>
          <div className="mt-2 text-white/50 text-sm">Leaving your voicemails</div>
        </div>
      )}

      {/* Lead-append modal */}
      {lead && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setLead(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold">Live lead · <span className="text-[color:#ff7a1a]">$75</span></div>
              <button className="text-[color:var(--muted)] text-xl" onClick={() => setLead(null)}>×</button>
            </div>
            <div className="text-sm text-[color:var(--muted)] mb-3">{lead.phone}</div>
            {lead.found && lead.lead ? (
              <div className="space-y-1 text-sm">
                <div><b>{lead.lead.name || "—"}</b></div>
                {lead.lead.email && <div>{lead.lead.email}</div>}
                <div>{[lead.lead.city, lead.lead.state, lead.lead.zip].filter(Boolean).join(", ")}</div>
                <div className="mt-3 text-xs text-[color:var(--muted)]">Appended from our data network. This is the high-intent lead that just called back.</div>
              </div>
            ) : lead.found === false && lead.lead === undefined ? (
              <div className="text-sm text-[color:var(--muted)]">Looking up…</div>
            ) : (
              <div className="text-sm text-[color:var(--muted)]">No appended data on file for this number.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

