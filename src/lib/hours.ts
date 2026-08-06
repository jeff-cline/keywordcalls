// Is "now" within the customer's configured call hours? Days + start/end evaluated in America/Chicago.
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isWithinHours(hours: { days?: string[]; start?: string; end?: string } | null | undefined, now: Date = new Date(), tz = "America/Chicago"): boolean {
  if (!hours) return true; // no schedule set → always on
  const days = Array.isArray(hours.days) ? hours.days : [];
  const start = hours.start || "00:00";
  const end = hours.end || "23:59";
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const parts: Record<string, string> = {};
  for (const x of p.formatToParts(now)) if (x.type !== "literal") parts[x.type] = x.value;
  const wd = parts.weekday; // "Mon"
  let hh = parseInt(parts.hour, 10); if (hh === 24) hh = 0;
  const cur = hh * 60 + parseInt(parts.minute, 10);
  if (days.length && !days.includes(wd)) return false;
  const toMin = (t: string) => { const [h, m] = t.split(":").map((n) => parseInt(n, 10)); return (h || 0) * 60 + (m || 0); };
  const s = toMin(start), e = toMin(end);
  return s <= e ? cur >= s && cur <= e : cur >= s || cur <= e; // handle overnight
}

export const dayName = (d: number) => DAY[d];
