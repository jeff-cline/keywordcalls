import PDFDocument from "pdfkit";
import path from "path";
import { resultsFor, usd } from "@/lib/results";

// Brand palette lifted from the site's CSS variables.
const BRAND = "#1b2a8f", BRAND2 = "#2f6bff", ORANGE = "#ff7a1a", INK = "#0f1115", MUTED = "#6b7280", SOFT = "#f4f6ff", LINE = "#e6e8ee", GREEN = "#16a34a";
const SITE = "https://keywordcalls.com";

type TestRow = { phone: string; name: string; at: Date };
const mask = (n: string) => n; // full numbers — this is the operator's own test data
function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} min` : `${Math.round(m / 60)} hr`;
}
const time = (d: Date) => new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(d);

// Branded, interactive results PDF: the LTV→ROAS example + the real live-test data. One page,
// spilling to a second only when there are enough test rows to fill it.
export async function resultsPdf(opts: { name: string; ltvCents: number; drops: TestRow[]; callbacks: TestRow[] }): Promise<Buffer> {
  const { name, ltvCents } = opts;
  const drops = [...opts.drops].sort((a, b) => a.at.getTime() - b.at.getTime());
  const callbacks = [...opts.callbacks].sort((a, b) => a.at.getTime() - b.at.getTime());
  const r = resultsFor(ltvCents);

  const doc = new PDFDocument({ size: "LETTER", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width, M = 40, CW = W - M * 2;
  const button = (x: number, y: number, w: number, label: string, url: string, fill: string, fg = "#ffffff") => {
    doc.roundedRect(x, y, w, 30, 7).fill(fill);
    doc.fillColor(fg).font("Helvetica-Bold").fontSize(11).text(label, x, y + 10, { width: w, align: "center" });
    doc.link(x, y, w, 30, url);
    doc.fillColor(INK);
  };

  // ---- Header band ----
  doc.rect(0, 0, W, 78).fill(BRAND);
  try { doc.image(path.join(process.cwd(), "public", "logo.png"), M, 22, { height: 34 }); } catch { doc.fillColor("#fff").font("Helvetica-Bold").fontSize(20).text("KEYWORDCALLS", M, 28); }
  doc.fillColor("#dbe4ff").font("Helvetica-Bold").fontSize(10).text(`Results for ${name || "your business"}`, M, 52, { width: CW });
  doc.fillColor("#dbe4ff").font("Helvetica").fontSize(9).text("Inbound calls are 33x more valuable than clicks.", W - M - 240, 30, { width: 240, align: "right" });
  doc.y = 96;

  // ---- Results row (from the LTV entered on the test form) ----
  const boxY = doc.y;
  doc.roundedRect(M, boxY, CW, 74, 9).fill(SOFT);
  const cellW = CW / 4;
  const stat = (i: number, label: string, val: string, color = INK) => {
    const x = M + i * cellW;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(label.toUpperCase(), x + 12, boxY + 14, { width: cellW - 16 });
    doc.fillColor(color).font("Helvetica-Bold").fontSize(22).text(val, x + 12, boxY + 30, { width: cellW - 16 });
  };
  stat(0, "Est. calls", String(r.calls), BRAND2);
  stat(1, "Your cost", usd(r.costCents));
  stat(2, "Value created", usd(r.revenueCents), BRAND2);
  stat(3, "ROAS", r.roas.toFixed(1) + "x", GREEN);
  doc.y = boxY + 84;
  doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(`Based on the lifetime value you entered — ${usd(ltvCents)}: 10 high-intent calls, one becomes a customer = ${usd(r.revenueCents)} created for ${usd(r.costCents)}, a ${r.roas.toFixed(1)}x return. Every call after that only widens the gap.`, M, doc.y, { width: CW, lineGap: 1 });

  // ---- Your live test ----
  doc.moveDown(0.7);
  doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(13).text("Your live test");
  let speed = "";
  if (drops.length && callbacks.length) speed = ` · first callback in ${ago(callbacks[0].at.getTime() - drops[0].at.getTime())}`;
  doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(`We left ${drops.length} voicemail${drops.length === 1 ? "" : "s"} and received ${callbacks.length} live callback${callbacks.length === 1 ? "" : "s"}${speed}. Here's exactly what happened:`, { width: CW });
  doc.moveDown(0.4);

  // table
  const rows: { phone: string; who: string; outcome: string; color: string; at: Date }[] = [
    ...drops.map((d) => ({ phone: d.phone, who: d.name || "—", outcome: "Voicemail left", color: BRAND2, at: d.at })),
    ...callbacks.map((c) => ({ phone: c.phone, who: c.name || "—", outcome: "Called back (live lead, $75)", color: GREEN, at: c.at })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const drawHeader = () => {
    const y = doc.y;
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8);
    doc.text("NUMBER", M, y, { width: 130, continued: false });
    doc.text("WHO", M + 135, y, { width: 150 });
    doc.text("OUTCOME", M + 290, y, { width: 150 });
    doc.text("TIME", M + 460, y, { width: CW - 460, align: "right" });
    doc.moveTo(M, y + 12).lineTo(M + CW, y + 12).strokeColor(LINE).stroke();
    doc.y = y + 16;
  };
  drawHeader();
  const bottomLimit = doc.page.height - 130; // leave room for CTA
  let shown = 0;
  for (const row of rows) {
    if (doc.y > bottomLimit) {
      // only add a page if there is enough left to justify it
      if (rows.length - shown >= 6) { doc.addPage(); doc.y = M; drawHeader(); }
      else { doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8.5).text(`… +${rows.length - shown} more`, M, doc.y); break; }
    }
    const y = doc.y;
    doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(mask(row.phone), M, y, { width: 130 });
    doc.fillColor(INK).text(row.who, M + 135, y, { width: 150 });
    doc.fillColor(row.color).font("Helvetica-Bold").fontSize(9).text(row.outcome, M + 290, y, { width: 165 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(time(row.at), M + 460, y, { width: CW - 460, align: "right" });
    doc.y = y + 15;
    shown++;
  }
  if (rows.length === 0) doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9.5).text("Run a drop from the demo to populate your live test data here.", M, doc.y);

  // ---- CTA buttons (interactive) ----
  const btnY = Math.min(doc.y + 16, doc.page.height - 108);
  doc.y = btnY;
  const bw = (CW - 14) / 2;
  button(M, btnY, bw, "Visit KeywordCalls.com  →", SITE, ORANGE);
  button(M + bw + 14, btnY, bw, "View your results online", `${SITE}/results`, BRAND);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Your first call is free · When you scale, ExitOptimization.com helps you double — even triple — your exit.", M, btnY + 40, { width: CW, align: "center" });

  doc.end();
  return done;
}
