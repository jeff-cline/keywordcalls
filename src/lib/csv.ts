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

// Map parsed CSV rows → contacts using header names (personal_phone / mobile_phone / personal_state…).
export function contactsFromRows(rows: string[][]): Contact[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => clean(h).toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iFirst = col("first_name"), iLast = col("last_name");
  const iPhone = col("personal_phone"), iMobile = col("mobile_phone"), iDirect = col("direct_number");
  const iEmail = col("personal_emails"), iState = col("personal_state"), iCity = col("personal_city"), iZip = col("personal_zip");

  const out: Contact[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    const all = [...(iPhone >= 0 ? phones(row[iPhone]) : []), ...(iMobile >= 0 ? phones(row[iMobile]) : []), ...(iDirect >= 0 ? phones(row[iDirect]) : [])];
    const uniq = [...new Set(all)];
    if (!uniq.length) continue; // must have a phone
    const email = iEmail >= 0 ? clean(row[iEmail]).split(/[,;]/)[0].trim() : "";
    out.push({
      firstName: iFirst >= 0 ? clean(row[iFirst]).slice(0, 80) : "",
      lastName: iLast >= 0 ? clean(row[iLast]).slice(0, 80) : "",
      phone: uniq[0],
      altPhones: JSON.stringify(uniq.slice(1, 6)),
      email: email.slice(0, 160),
      city: iCity >= 0 ? clean(row[iCity]).slice(0, 80) : "",
      state: (iState >= 0 ? clean(row[iState]) : "").toUpperCase().slice(0, 2),
      zip: iZip >= 0 ? clean(row[iZip]).slice(0, 10) : "",
    });
  }
  return out;
}
