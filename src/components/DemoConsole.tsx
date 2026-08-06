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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [drops, setDrops] = useState(0);
  const [callbacks, setCallbacks] = useState(0);
  const feedRef = useRef<HTMLDivElement | null>(null);

  async function poll() {
    const res = await fetch("/api/demo/events");
    if (!res.ok) return;
    const j = await res.json();
    setEvents(j.events || []); setDrops(j.drops || 0); setCallbacks(j.callbacks || 0);
    if (j.demoNumber) setDemoNumber(j.demoNumber);
    setHasAudio(j.hasAudio);
  }
  useEffect(() => { poll(); const id = setInterval(poll, 2500); return () => clearInterval(id); }, []);

  async function getNumber() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/demo/provision", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setDemoNumber(j.number); setMsg(`Demo number ready: ${j.number}`); } else setMsg(j.error || "Could not get a number.");
  }
  async function go() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/demo/go", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numbers }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `🚀 Left ${j.left} voicemail${j.left === 1 ? "" : "s"} of ${j.attempted}.` : (j.error || "Failed."));
    poll();
  }

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
              <div className="text-sm font-bold uppercase tracking-wide text-white/50 mb-2">2 · Phone numbers</div>
              <textarea className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white text-sm" rows={4} placeholder="One per line — e.g. (972) 800-6670" value={numbers} onChange={(e) => setNumbers(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn !bg-[color:#ff7a1a] text-white !border-0 text-base !px-7" disabled={busy || !hasAudio} onClick={go}>🚀 Go — leave the voicemails</button>
              {!hasAudio && <span className="text-xs text-white/50">record a voicemail first</span>}
            </div>
            {msg && <div className="text-sm text-green-300">{msg}</div>}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-sm text-white/60">Have people call back:</div>
              {demoNumber
                ? <div className="text-2xl font-extrabold tracking-wide">{demoNumber}</div>
                : <button className="btn btn-primary mt-1" disabled={busy} onClick={getNumber}>Get a demo call-back number</button>}
            </div>
          </div>

          {/* Live board */}
          <div className="rounded-2xl bg-black/30 border border-white/10 p-5">
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div><div className="text-3xl font-extrabold text-[#2f6bff]">{drops}</div><div className="text-[11px] uppercase text-white/50">VMs left</div></div>
              <div><div className="text-3xl font-extrabold text-[#16d6a5]">{callbacks}</div><div className="text-[11px] uppercase text-white/50">Callbacks</div></div>
              <div><div className="text-3xl font-extrabold text-[#ff7a1a]">{liveRoas ? liveRoas.toFixed(1) + "×" : "—"}</div><div className="text-[11px] uppercase text-white/50">Live ROAS</div></div>
            </div>
            <div ref={feedRef} className="space-y-2 max-h-80 overflow-y-auto">
              {events.length === 0 && <div className="text-sm text-white/40 py-8 text-center">Waiting for activity…</div>}
              {events.map((e) => (
                <div key={e.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${e.kind === "callback" ? "bg-[#16d6a5]/15" : "bg-white/5"}`}>
                  <span>{e.kind === "callback" ? "📞" : "📨"}</span>
                  <span className="flex-1">{e.kind === "callback" ? "Callback — live lead!" : "Voicemail left"} · {mask(e.phone)}</span>
                  <span className="text-white/40 text-xs">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

