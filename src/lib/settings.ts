import { db } from "@/lib/db";
export async function getSetting(key: string, dflt = ""): Promise<string> {
  const r = await db.setting.findUnique({ where: { key } }).catch(() => null);
  return r?.value ?? dflt;
}
export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return m;
}
