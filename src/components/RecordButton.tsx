"use client";
import { useRef, useState } from "react";

// Record a voicemail in the browser and save it to a campaign (outbound or follow-up).
export default function RecordButton({ campaignId, type, existingUrl, label }: { campaignId: string; type: "outbound" | "followup"; existingUrl: string; label: string }) {
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(existingUrl);
  const [err, setErr] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      chunks.current = [];
      m.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      m.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        await upload(blob);
      };
      mr.current = m; m.start(); setRec(true);
    } catch { setErr("Microphone access denied."); }
  }
  function stop() { mr.current?.stop(); setRec(false); }

  async function upload(blob: Blob) {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.append("file", blob, `${type}.webm`);
    fd.append("campaignId", campaignId);
    fd.append("type", type);
    const res = await fetch("/api/admin/campaigns/audio", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && j.url) setUrl(j.url); else setErr(j.error || "Save failed.");
  }

  return (
    <div className="rounded-lg border border-[color:var(--line)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{label} {url && <span className="text-[color:#16a34a] text-xs">· recorded ✓</span>}</div>
        {!rec
          ? <button type="button" className="btn btn-ghost !py-1 !px-3 text-xs" disabled={busy} onClick={start}>{busy ? "Saving…" : url ? "● Re-record" : "● Record"}</button>
          : <button type="button" className="btn !py-1 !px-3 text-xs !bg-red-600" onClick={stop}>■ Stop</button>}
      </div>
      {url && <audio controls src={url} className="mt-2 w-full h-9" />}
      {err && <div className="text-xs text-red-600 mt-1">{err}</div>}
    </div>
  );
}
