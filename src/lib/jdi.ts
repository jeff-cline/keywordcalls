import dns from "dns";
import { getSettings } from "@/lib/settings";

// The JDI/RVMPRO host resolves oddly for Node's default DNS order — force IPv4 (curl-equivalent).
dns.setDefaultResultOrder("ipv4first");

const BASE = "https://api.23.rvmpro.com";
let cached: { jwt: string; exp: number } | null = null;

export async function jdiConfigured(): Promise<boolean> {
  const s = await getSettings(["jdiApiToken"]);
  return !!s.jdiApiToken;
}

// Exchange the API token for a short-lived JWT (cached ~55 min).
async function getJwt(): Promise<string | null> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.jwt;
  const s = await getSettings(["jdiApiToken", "jdiEmail"]);
  if (!s.jdiApiToken) return null;
  try {
    const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: s.jdiApiToken, email: s.jdiEmail || "" }), signal: AbortSignal.timeout(15000) });
    const j = await res.json().catch(() => ({}));
    const jwt = j?.data?.accessToken;
    if (!jwt) return null;
    cached = { jwt, exp: Date.now() + 55 * 60_000 };
    return jwt;
  } catch { return null; }
}

async function jdi(path: string, opts: { method?: string; json?: unknown } = {}): Promise<{ ok: boolean; data?: any; error?: string }> {
  const jwt = await getJwt();
  if (!jwt) return { ok: false, error: "JDI not configured / auth failed." };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: opts.method || "GET",
      headers: { Authorization: `Bearer ${jwt}`, ...(opts.json ? { "Content-Type": "application/json" } : {}) },
      body: opts.json ? JSON.stringify(opts.json) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: !!j.success, data: j.data, error: j.error?.message };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "request failed" }; }
}

// Upload an MP3 (from our public URL) into JDI's audio library → returns the JDI audio URL for cWav.
export async function jdiUploadAudioFromUrl(audioUrl: string): Promise<string | null> {
  const jwt = await getJwt();
  if (!jwt || !audioUrl) return null;
  try {
    const a = await fetch(audioUrl, { signal: AbortSignal.timeout(20000) });
    if (!a.ok) return null;
    const buf = Buffer.from(await a.arrayBuffer());
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "voicemail.mp3");
    const res = await fetch(`${BASE}/api/audio/upload`, { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: fd, signal: AbortSignal.timeout(30000) });
    const j = await res.json().catch(() => ({}));
    return j?.data?.url || j?.data?.wav || j?.data?.cWav || null;
  } catch { return null; }
}

// Is this number on our DNC blacklist? (best-effort; false on error)
export async function jdiIsBlacklisted(number: string): Promise<boolean> {
  const digits = number.replace(/\D/g, "");
  if (!digits) return false;
  const r = await jdi(`/api/blacklist/check/${digits}`);
  return r.ok && (r.data === true || r.data?.blacklisted === true || r.data?.isBlacklisted === true);
}

// Scrub a list against the DNC blacklist (per-number, capped for latency). Returns kept + removed.
export async function jdiScrub(numbers: string[], cap = 60): Promise<{ kept: string[]; removed: string[] }> {
  const kept: string[] = [], removed: string[] = [];
  for (let i = 0; i < numbers.length; i++) {
    if (i >= cap) { kept.push(numbers[i]); continue; } // beyond cap, rely on JDI load-time DNC suppression
    if (await jdiIsBlacklisted(numbers[i])) removed.push(numbers[i]); else kept.push(numbers[i]);
  }
  return { kept, removed };
}

// Add opt-outs / complainers to the DNC blacklist so they're never called again.
export async function jdiBlacklistAdd(numbers: string[], note = "opt-out"): Promise<boolean> {
  const r = await jdi(`/api/blacklist/bulk`, { method: "POST", json: { numbers: numbers.map((n) => n.replace(/\D/g, "")), note } });
  return r.ok;
}

// Create a ringless voicemail campaign. Compliance filters (state/carrier + performance) always on.
export async function jdiCreateCampaign(opts: {
  name: string; wavUrl: string; callback: string; numbers: string[];
  throttle?: number; startTime?: string; stopTime?: string; runDays?: string; timezone?: string; autoStart?: boolean;
}): Promise<{ ok: boolean; campaignId?: string; error?: string }> {
  const body: Record<string, unknown> = {
    cName: opts.name.slice(0, 25) || "KWC Campaign",
    cWav: opts.wavUrl,
    cCallback: opts.callback,
    cNumbers: opts.numbers.map((n) => n.replace(/\D/g, "")),
    cStateCheck: true,   // LRN state/carrier filtering — compliance
    cPerformance: true,  // skip known-unreceptive destinations
    cStart: opts.autoStart !== false,
  };
  if (opts.throttle) body.cThrottle = opts.throttle;
  if (opts.startTime) body.cStartTime = opts.startTime;
  if (opts.stopTime) body.cStopTime = opts.stopTime;
  if (opts.runDays) body.cRunDays = opts.runDays;
  if (opts.timezone) body.cTimezone = opts.timezone;
  const r = await jdi(`/api/campaigns`, { method: "POST", json: body });
  return { ok: r.ok, campaignId: r.data?.id || r.data?.campaignId || r.data?.cId, error: r.error };
}

// Delivery numbers for a campaign (delivered / undelivered / etc.).
export async function jdiOverview(campaignId: string): Promise<any | null> {
  const r = await jdi(`/api/campaigns/overview/${campaignId}`);
  return r.ok ? r.data : null;
}
