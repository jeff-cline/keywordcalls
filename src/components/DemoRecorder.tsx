"use client";
import { useRef, useState } from "react";

// Demo voicemail recorder: 3-2-1 countdown, capture, instant playback, saves as the demo audio.
export default function DemoRecorder({ hasAudio, onSaved }: { hasAudio: boolean; onSaved: () => void }) {
  const [phase, setPhase] = useState<"idle" | "count" | "rec" | "saving">("idle");
  const [count, setCount] = useState(3);
  const [localUrl, setLocalUrl] = useState("");
  const [saved, setSaved] = useState(hasAudio);
  const [err, setErr] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function begin() {
    setErr(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setErr("Microphone access denied."); return; }
    setPhase("count");
    for (let n = 3; n >= 1; n--) { setCount(n); await new Promise((r) => setTimeout(r, 700)); }
    const m = new MediaRecorder(stream);
    chunks.current = [];
    m.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    m.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      setLocalUrl(URL.createObjectURL(blob));
      setPhase("saving");
      const fd = new FormData(); fd.append("file", blob, "demo.webm");
      const res = await fetch("/api/demo/record", { method: "POST", body: fd });
      setPhase("idle");
      if (res.ok) { setSaved(true); onSaved(); } else setErr("Save failed.");
    };
    mr.current = m; m.start(); setPhase("rec");
  }
  function stop() { if (mr.current && mr.current.state !== "inactive") mr.current.stop(); }

  return (
    <div>
      <div className="flex items-center gap-3">
        {phase === "idle" && <button className="btn btn-primary" onClick={begin}>{saved ? "● Re-record voicemail" : "● Record voicemail"}</button>}
        {phase === "count" && <div className="text-4xl font-extrabold text-[color:var(--brand)] tabular-nums w-14 text-center">{count}</div>}
        {phase === "rec" && <button className="btn !bg-red-600 text-white animate-pulse" onClick={stop}>■ Stop recording</button>}
        {phase === "saving" && <span className="text-sm text-white/70">Saving…</span>}
        {saved && phase === "idle" && <span className="text-sm text-green-400">✓ voicemail ready</span>}
      </div>
      {phase === "rec" && <div className="mt-2 text-sm text-red-300 flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> Recording — speak now</div>}
      {localUrl && phase === "idle" && <audio controls src={localUrl} className="mt-3 w-full h-9" />}
      {err && <div className="text-sm text-red-400 mt-1">{err}</div>}
    </div>
  );
}
