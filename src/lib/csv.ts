// Minimal RFC-4180 CSV parser: handles quoted fields, escaped "" quotes, commas and newlines
// inside quotes. Returns an array of string[] rows (including the header row).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (v: string) => (v === "\\N" || v == null ? "" : v.trim());
function e164(n: string): string {
  const d = (n || "").replace(/[^\d]/g, "");
  if (d.length === 11 && d[0] === "1") return "+" + d;
  if (d.length === 10) return "+1" + d;
  return "";
}
// split a "+1..., +1..." multi-number cell into normalized E.164 numbers
function phones(cell: string): string[] {
  return clean(cell).split(/[,;]/).map((x) => e164(x)).filter(Boolean);
}

export type Contact = { firstName: string; lastName: string; phone: string; altPhones: string; email: string; city: string; state: string; zip: string };

// Column indices resolved from a header row (personal_phone / mobile_phone / personal_state…).
type ColIdx = ReturnType<typeof headerIndex>;
export function headerIndex(headerRow: string[]) {
  const header = headerRow.map((h) => clean(h).toLowerCase());
  const col = (name: string) => header.indexOf(name);
  return {
    iFirst: col("first_name"), iLast: col("last_name"),
    iPhone: col("personal_phone"), iMobile: col("mobile_phone"), iDirect: col("direct_number"),
    iEmail: col("personal_emails"), iState: col("personal_state"), iCity: col("personal_city"), iZip: col("personal_zip"),
  };
}

// Map a single CSV row → Contact (null when the row has no usable phone).
export function rowToContact(idx: ColIdx, row: string[]): Contact | null {
  if (!row || row.length < 2) return null;
  const all = [...(idx.iPhone >= 0 ? phones(row[idx.iPhone]) : []), ...(idx.iMobile >= 0 ? phones(row[idx.iMobile]) : []), ...(idx.iDirect >= 0 ? phones(row[idx.iDirect]) : [])];
  const uniq = [...new Set(all)];
  if (!uniq.length) return null; // must have a phone
  const email = idx.iEmail >= 0 ? clean(row[idx.iEmail]).split(/[,;]/)[0].trim() : "";
  return {
    firstName: idx.iFirst >= 0 ? clean(row[idx.iFirst]).slice(0, 80) : "",
    lastName: idx.iLast >= 0 ? clean(row[idx.iLast]).slice(0, 80) : "",
    phone: uniq[0],
    altPhones: JSON.stringify(uniq.slice(1, 6)),
    email: email.slice(0, 160),
    city: idx.iCity >= 0 ? clean(row[idx.iCity]).slice(0, 80) : "",
    state: (idx.iState >= 0 ? clean(row[idx.iState]) : "").toUpperCase().slice(0, 2),
    zip: idx.iZip >= 0 ? clean(row[idx.iZip]).slice(0, 10) : "",
  };
}

// Map parsed CSV rows → contacts (small files / in-memory path).
export function contactsFromRows(rows: string[][]): Contact[] {
  if (rows.length < 2) return [];
  const idx = headerIndex(rows[0]);
  const out: Contact[] = [];
  for (let r = 1; r < rows.length; r++) { const c = rowToContact(idx, rows[r]); if (c) out.push(c); }
  return out;
}

// Stream a CSV file row-by-row without ever holding the whole thing in memory — the state machine
// carries quote/field state across chunk boundaries so huge lead files parse with flat memory.
export async function* streamCsvRows(stream: ReadableStream<Uint8Array>): AsyncGenerator<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let field = "", row: string[] = [], inQuotes = false, quotePending = false, first = true;
  const flushRow = () => { row.push(field); field = ""; const r = row; row = []; return r; };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    let chunk = decoder.decode(value, { stream: true });
    if (first && chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1); // strip BOM
    first = false;
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (quotePending) { quotePending = false; if (ch === '"') { field += '"'; continue; } inQuotes = false; }
      if (inQuotes) { if (ch === '"') quotePending = true; else field += ch; }
      else if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") yield flushRow();
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) yield flushRow();
}
