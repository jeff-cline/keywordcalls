"use client";
import { useRef, useState } from "react";

// Test the buyer line from the laptop: buys a FRESH Twilio number (so Ringba never sees a duplicate
// caller ID), then places a real WebRTC call through the browser that dials the buyer — you talk
// through your speakers/mic. Each press buys a new number and drops the previous one.
/* eslint-disable @typescript-eslint/no-explicit-any */
export default function BuyerTestCall({ campaignId, routingNumber }: { campaignId: string; routingNumber: string }) {
  const [phase, setPhase] = useState<"idle" | "prep" | "live" | "ended">("idle");
  const [msg, setMsg] = useState("");
  const [num, setNum] = useState("");
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);

  function cleanup() { try { deviceRef.current?.destroy(); } catch {} deviceRef.current = null; callRef.current = null; }

  async function startTest() {
    if (!routingNumber) { setMsg("Set a buyer routing number first."); return; }
    try {
      setPhase("prep"); setMsg("Buying a fresh number (unique caller ID)…");
      const nr = await fetch("/api/rollout/test-number", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId }) }).then((r) => r.json());
      if (!nr.ok) { setPhase("idle"); setMsg(nr.error || "Could not buy a number."); return; }
      setNum(nr.number);
      setMsg("Starting the call…");
      const tk = await fetch("/api/rollout/voice-token").then((r) => r.json());
      if (!tk.token) { setPhase("idle"); setMsg(tk.error || "Browser calling isn't set up yet."); return; }
      const { Device } = await import("@twilio/voice-sdk");
      const device = new Device(tk.token, { logLevel: "error", codecPreferences: ["opus", "pcmu"] as any });
      deviceRef.current = device;
      setMsg("Connecting your mic — allow the browser prompt…");
      const call = await device.connect({ params: { callerId: nr.number, campaignId } });
      callRef.current = call;
      setPhase("live"); setMsg(`📞 Live from ${nr.number} — you'll hear it ring, then the buyer. Talk when they pick up.`);
      call.on("disconnect", () => { setPhase("ended"); setMsg("Call ended."); cleanup(); });
      call.on("error", (e: any) => { setPhase("idle"); setMsg("Call error: " + (e?.message || e)); cleanup(); });
    } catch (e: any) {
      setPhase("idle"); setMsg("Error: " + (e?.message || String(e))); cleanup();
    }
  }
  function hangup() { try { callRef.current?.disconnect(); } catch {} setPhase("ended"); setMsg("Call ended."); cleanup(); }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {phase === "live"
          ? <button className="btn !bg-[color:#dc2626] text-white !border-0 !py-2" onClick={hangup}>■ Hang up</button>
          : <button className="btn !bg-[color:#16a34a] text-white !border-0 !py-2" disabled={phase === "prep"} onClick={startTest}>{phase === "prep" ? "Connecting…" : "🧪 Test call (fresh #)"}</button>}
      </div>
      {msg && <div className={`text-xs ${phase === "live" ? "text-[color:#16a34a] font-semibold" : "text-[color:var(--muted)]"}`}>{msg}</div>}
    </div>
  );
}
