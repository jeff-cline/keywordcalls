import { getSettings } from "@/lib/settings";

const BASE_URL = "https://keywordcalls.com";

export async function getTwilioCfg(): Promise<{ sid: string; token: string } | null> {
  const s = await getSettings(["twilioAccountSid", "twilioAuthToken"]);
  if (!s.twilioAccountSid || !s.twilioAuthToken) return null;
  return { sid: s.twilioAccountSid, token: s.twilioAuthToken };
}
function auth(c: { sid: string; token: string }) {
  return "Basic " + Buffer.from(`${c.sid}:${c.token}`).toString("base64");
}
export function e164(n: string): string {
  const d = (n || "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") return "+" + d;
  if (d.length === 10) return "+1" + d;
  return n.startsWith("+") ? n : "+" + d;
}
export function areaCodeOf(n: string): string {
  const d = (n || "").replace(/\D/g, "");
  const ten = d.length === 11 && d[0] === "1" ? d.slice(1) : d.slice(-10);
  return ten.slice(0, 3);
}

// Find available local numbers in an area code (falls back to nationwide if none).
export async function searchNumbers(areaCode: string, cfg: { sid: string; token: string }): Promise<string[]> {
  const q = (extra: string) => `https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/AvailablePhoneNumbers/US/Local.json?VoiceEnabled=true&${extra}`;
  for (const url of [q(`AreaCode=${areaCode}&PageSize=5`), q(`InRegion=&PageSize=5`)]) {
    const res = await fetch(url, { headers: { Authorization: auth(cfg) }, signal: AbortSignal.timeout(12000) }).catch(() => null);
    if (!res || !res.ok) continue;
    const j = await res.json().catch(() => null) as { available_phone_numbers?: { phone_number: string }[] } | null;
    const nums = (j?.available_phone_numbers || []).map((n) => n.phone_number);
    if (nums.length) return nums;
  }
  return [];
}

// Buy a number and point its Voice webhook at our inbound handler. Returns { number, sid } or null.
export async function provisionNumber(phoneNumber: string, cfg: { sid: string; token: string }, voicePath = "/api/calls/inbound"): Promise<{ number: string; sid: string } | null> {
  const body = new URLSearchParams({ PhoneNumber: phoneNumber, VoiceUrl: `${BASE_URL}${voicePath}`, VoiceMethod: "POST", StatusCallback: `${BASE_URL}/api/calls/status`, StatusCallbackMethod: "POST" });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/IncomingPhoneNumbers.json`, {
    method: "POST", headers: { Authorization: auth(cfg), "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const j = await res.json().catch(() => null) as { phone_number?: string; sid?: string } | null;
  return j?.phone_number && j?.sid ? { number: j.phone_number, sid: j.sid } : null;
}

// Repoint an existing number's Voice webhook (e.g. when a pooled number is reused by a new campaign).
export async function updateVoiceUrl(numberSid: string, voicePath: string, cfg: { sid: string; token: string }): Promise<boolean> {
  if (!numberSid) return false;
  const body = new URLSearchParams({ VoiceUrl: `${BASE_URL}${voicePath}`, VoiceMethod: "POST" });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/IncomingPhoneNumbers/${numberSid}.json`, {
    method: "POST", headers: { Authorization: auth(cfg), "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  return !!res && res.ok;
}

export async function releaseNumber(numberSid: string, cfg: { sid: string; token: string }): Promise<boolean> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/IncomingPhoneNumbers/${numberSid}.json`, {
    method: "DELETE", headers: { Authorization: auth(cfg) }, signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  return !!res && (res.status === 204 || res.ok);
}

// Send an SMS. Returns true on 2xx.
export async function sendSms(to: string, body: string, from: string, cfg: { sid: string; token: string }): Promise<boolean> {
  const b = new URLSearchParams({ To: e164(to), From: e164(from), Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
    method: "POST", headers: { Authorization: auth(cfg), "Content-Type": "application/x-www-form-urlencoded" }, body: b, signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  return !!res && res.ok;
}

// Place an outbound call that runs a TwiML URL, from a specific number (our own Twilio account).
// opts.amd → Answering-Machine Detection (waits for the beep; passes AnsweredBy to the TwiML URL).
export async function placeCallTwiml(to: string, twimlUrl: string, from: string, cfg: { sid: string; token: string }, opts: { amd?: boolean; statusCallback?: string } = {}): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const b = new URLSearchParams({ To: e164(to), From: e164(from), Url: twimlUrl, Method: "POST" });
  if (opts.amd) { b.set("MachineDetection", "DetectMessageEnd"); b.set("MachineDetectionTimeout", "30"); }
  if (opts.statusCallback) { b.set("StatusCallback", opts.statusCallback); b.set("StatusCallbackEvent", "completed"); b.set("StatusCallbackMethod", "POST"); }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Calls.json`, {
    method: "POST", headers: { Authorization: auth(cfg), "Content-Type": "application/x-www-form-urlencoded" }, body: b, signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  const j = res ? await res.json().catch(() => ({})) : {};
  if (!res || !res.ok) return { ok: false, error: (j as { message?: string }).message || "call failed" };
  return { ok: true, sid: (j as { sid?: string }).sid };
}

// Place an outbound voice call that speaks a message (inline TwiML). Returns true on 2xx.
export async function placeCall(to: string, spokenMessage: string, from: string, cfg: { sid: string; token: string }): Promise<boolean> {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">${spokenMessage.replace(/[<&]/g, " ")}</Say></Response>`;
  const b = new URLSearchParams({ To: e164(to), From: e164(from), Twiml: twiml });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Calls.json`, {
    method: "POST", headers: { Authorization: auth(cfg), "Content-Type": "application/x-www-form-urlencoded" }, body: b, signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  return !!res && res.ok;
}

// Real Twilio price for a completed call (absolute cents), or null if not priced yet.
export async function callPriceCents(callSid: string, cfg: { sid: string; token: string }): Promise<number | null> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Calls/${callSid}.json`, { headers: { Authorization: auth(cfg) }, signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!res || !res.ok) return null;
  const j = await res.json().catch(() => null) as { price?: string | null } | null;
  return j && j.price != null && j.price !== "" ? Math.round(Math.abs(parseFloat(j.price)) * 100) : null;
}
