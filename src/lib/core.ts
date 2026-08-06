// Push leads/signups into the shared medigap CORE (CRM + JV + data append + notify).
// Best-effort — never throws into a request. Uses a CORE API key from env.
const BASE = process.env.CORE_API_BASE || "https://medigap.plus";

function coreHeaders(): Record<string, string> | null {
  const key = process.env.CORE_KEY, secret = process.env.CORE_SECRET;
  if (!key || !secret) return null;
  return { "x-core-key": key, "x-core-secret": secret, "content-type": "application/json" };
}

export async function pushLeadToCore(input: { name?: string; email?: string; phone?: string; notes?: string; creatorRef?: string }): Promise<{ ok: boolean; leadId?: string }> {
  const h = coreHeaders();
  if (!h) return { ok: false }; // not configured yet
  try {
    const res = await fetch(`${BASE}/api/core/lead`, {
      method: "POST", headers: h,
      body: JSON.stringify({ name: input.name || "", email: input.email || "", phone: input.phone || "", notes: input.notes || "", creatorRef: input.creatorRef || "keywordcalls" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false };
    const j = await res.json().catch(() => ({}));
    return { ok: true, leadId: j.leadId };
  } catch {
    return { ok: false };
  }
}

// Read the Zapmail cold-email account status (mailbox count + emails) from the Core.
export async function getZapmailStatus(): Promise<{ ok: boolean; storedMailboxes: number; activeMailboxes: number; mailboxes: { email: string }[] }> {
  const h = coreHeaders();
  if (!h) return { ok: false, storedMailboxes: 0, activeMailboxes: 0, mailboxes: [] };
  try {
    const res = await fetch(`${BASE}/api/core/zapmail-status`, { headers: h, signal: AbortSignal.timeout(20000) });
    const j = await res.json().catch(() => ({}));
    return { ok: !!j.ok, storedMailboxes: j.storedMailboxes || 0, activeMailboxes: j.activeMailboxes || 0, mailboxes: j.mailboxes || [] };
  } catch { return { ok: false, storedMailboxes: 0, activeMailboxes: 0, mailboxes: [] }; }
}

// Place an outbound call via the Core's Twilio (from 1-800-MEDIGAP). Speaks `message` or runs `twimlUrl`.
export async function coreCall(to: string, opts: { message?: string; twimlUrl?: string }): Promise<{ ok: boolean; callSid?: string; error?: string }> {
  const h = coreHeaders();
  if (!h || !to) return { ok: false, error: "not configured" };
  try {
    const res = await fetch(`${BASE}/api/core/call`, { method: "POST", headers: h, body: JSON.stringify({ to, ...opts }), signal: AbortSignal.timeout(15000) });
    const j = await res.json().catch(() => ({}));
    return { ok: !!j.ok, callSid: j.callSid, error: j.error };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "call failed" }; }
}

// Upload a file (e.g. an audio recording) through the Core → returns a persistent public URL.
export async function coreUpload(file: Blob, filename: string, label = ""): Promise<string> {
  const key = process.env.CORE_KEY, secret = process.env.CORE_SECRET;
  if (!key || !secret) return "";
  try {
    const fd = new FormData();
    fd.append("file", file, filename);
    if (label) fd.append("label", label);
    const res = await fetch(`${BASE}/api/core/upload`, { method: "POST", headers: { "x-core-key": key, "x-core-secret": secret }, body: fd, signal: AbortSignal.timeout(30000) });
    const j = await res.json().catch(() => ({}));
    return j.ok ? String(j.url) : "";
  } catch { return ""; }
}

// Send a transactional email through the Core's SMTP (google_workspace = deliverable transactional).
// Logs every send to email_log so the God dashboard can price email COGS.
export async function sendCoreEmail(to: string, subject: string, html: string, kind = "other"): Promise<boolean> {
  const h = coreHeaders();
  const { db } = await import("@/lib/db");
  if (!h || !to) { await db.emailLog.create({ data: { to, subject, kind, ok: false } }).catch(() => {}); return false; }
  let ok = false;
  try {
    const res = await fetch(`${BASE}/api/core/email`, {
      method: "POST", headers: h,
      body: JSON.stringify({ to, subject, html, provider: "google_workspace" }),
      signal: AbortSignal.timeout(12000),
    });
    const j = await res.json().catch(() => ({}));
    ok = !!j.ok;
  } catch { ok = false; }
  await db.emailLog.create({ data: { to, subject, kind, ok } }).catch(() => {});
  return ok;
}
