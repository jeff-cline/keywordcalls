// Push leads/signups into the shared medigap CORE (CRM + JV + data append + notify).
// Best-effort — never throws into a request. Uses a CORE API key from env.
const BASE = process.env.CORE_API_BASE || "https://medigap.plus";

export async function pushLeadToCore(input: { name?: string; email?: string; phone?: string; notes?: string; creatorRef?: string }): Promise<{ ok: boolean; leadId?: string }> {
  const key = process.env.CORE_KEY;
  const secret = process.env.CORE_SECRET;
  if (!key || !secret) return { ok: false }; // not configured yet
  try {
    const res = await fetch(`${BASE}/api/core/lead`, {
      method: "POST",
      headers: { "x-core-key": key, "x-core-secret": secret, "content-type": "application/json" },
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
