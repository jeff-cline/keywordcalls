"use client";
import { useRef, useState } from "react";

// Record a voicemail in the browser: 3-2-1 countdown, then capture, then instant playback + save.
export default function RecordButton({ campaignId, type, existingUrl, label }: { campaignId: string; type: "outbound" | "followup"; existingUrl: string; label: string }) {
  const [phase, setPhase] = useState<"idle" | "count" | "rec" | "saving">("idle");
  const [count, setCount] = useState(3);
  const [url, setUrl] = useState(existingUrl);      // persistent (uploaded) URL
  const [localUrl, setLocalUrl] = useState("");     // instant local preview
  const [err, setErr] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function begin() {
    setErr(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setErr("Microphone access denied."); return; }

    // tight 3-2-1 countdown, then start capturing (nothing before this is recorded)
    setPhase("count");
    for (let n = 3; n >= 1; n--) { setCount(n); await new Promise((r) => setTimeout(r, 700)); }

    const m = new MediaRecorder(stream);
    chunks.current = [];
    m.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    m.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      setLocalUrl(URL.createObjectURL(blob)); // play immediately
      await upload(blob);
    };
    mr.current = m; m.start(); setPhase("rec");
  }
  function stop() { if (mr.current && mr.current.state !== "inactive") mr.current.stop(); }

  async function upload(blob: Blob) {
    setPhase("saving"); setErr(null);
    const fd = new FormData();
    fd.append("file", blob, `${type}.webm`);
    fd.append("campaignId", campaignId);
    fd.append("type", type);
    const res = await fetch("/api/admin/campaigns/audio", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setPhase("idle");
    if (res.ok && j.url) setUrl(j.url); else setErr(j.error || "Save failed.");
  }

  const playSrc = localUrl || url;
  return (
    <div className="rounded-lg border border-[color:var(--line)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{label} {url && <span className="text-[color:#16a34a] text-xs">· saved ✓</span>}</div>
        {phase === "idle" && <button type="button" className="btn btn-ghost !py-1 !px-3 text-xs" onClick={begin}>{url ? "● Re-record" : "● Record"}</button>}
        {phase === "count" && <span className="text-lg font-extrabold text-[color:var(--brand)] tabular-nums w-8 text-center">{count}</span>}
        {phase === "rec" && <button type="button" className="btn !py-1 !px-3 text-xs !bg-red-600 text-white animate-pulse" onClick={stop}>■ Stop</button>}
        {phase === "saving" && <span className="text-xs text-[color:var(--muted)]">Saving…</span>}
      </div>
      {phase === "rec" && <div className="mt-2 text-xs text-red-600 flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse" /> Recording — speak now</div>}
      {playSrc && phase !== "rec" && phase !== "count" && <audio controls src={playSrc} className="mt-2 w-full h-9" />}
      {err && <div className="text-xs text-red-600 mt-1">{err}</div>}
    </div>
  );
}
