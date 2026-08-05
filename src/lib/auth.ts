import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

const COOKIE = "kwc_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "kwc_dev_secret");

export type Session = { uid: string; email: string; role: string; name: string };

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash).catch(() => false);
}

export async function createSession(acct: { id: string; email: string; role: string; firstName: string; lastName: string }): Promise<void> {
  const token = await new SignJWT({ email: acct.email, role: acct.role, name: `${acct.firstName} ${acct.lastName}`.trim() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(acct.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { uid: String(payload.sub || ""), email: String(payload.email || ""), role: String(payload.role || ""), name: String(payload.name || "") };
  } catch {
    return null;
  }
}

export const isGod = (s: Session | null) => s?.role === "god";
export const isStaff = (s: Session | null) => !!s && ["god", "vp", "regional", "manager", "rep"].includes(s.role);
export const isAdmin = (s: Session | null) => !!s && ["god", "vp", "regional", "manager"].includes(s.role);

// Load the full account (for guards that need more than the token).
export async function currentAccount() {
  const s = await getSession();
  if (!s) return null;
  return db.account.findUnique({ where: { id: s.uid } });
}
