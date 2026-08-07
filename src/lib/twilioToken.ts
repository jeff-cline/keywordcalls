import crypto from "crypto";

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Build a Twilio Voice access token (JWT) for the browser Voice SDK — signed with the API Key secret.
export function makeVoiceToken(opts: { accountSid: string; apiKeySid: string; apiKeySecret: string; twimlAppSid: string; identity: string; ttl?: number }): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts.ttl || 3600;
  const header = { cty: "twilio-fpa;v=1", typ: "JWT", alg: "HS256" };
  const payload = {
    jti: `${opts.apiKeySid}-${now}`, iss: opts.apiKeySid, sub: opts.accountSid, iat: now, nbf: now, exp: now + ttl,
    grants: { identity: opts.identity, voice: { incoming: { allow: true }, outgoing: { application_sid: opts.twimlAppSid } } },
  };
  const seg = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.createHmac("sha256", opts.apiKeySecret).update(seg).digest();
  return `${seg}.${b64url(sig)}`;
}
