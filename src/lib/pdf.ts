import PDFDocument from "pdfkit";
import path from "path";
import { resultsFor, usd } from "@/lib/results";

const BRAND = "#1b2a8f", BRAND2 = "#2f6bff", ORANGE = "#ff7a1a", INK = "#0f1115", MUTED = "#6b7280";

// Build a branded KeywordCalls results PDF for a given name + lifetime value. Returns a Buffer.
export async function resultsPdf(name: string, ltvCents: number): Promise<Buffer> {
  const r = resultsFor(ltvCents);
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width, M = 54, CW = W - M * 2;
  const h = (t: string, c = INK, size = 15) => doc.moveDown(0.8).fillColor(c).font("Helvetica-Bold").fontSize(size).text(t);
  const p = (t: string, c = MUTED) => doc.fillColor(c).font("Helvetica").fontSize(10.5).text(t, { lineGap: 2 });

  // Header band
  doc.rect(0, 0, W, 96).fill(BRAND);
  try { doc.image(path.join(process.cwd(), "public", "logo.png"), M, 30, { height: 38 }); } catch { doc.fillColor("#fff").font("Helvetica-Bold").fontSize(22).text("KEYWORDCALLS", M, 36); }
  doc.fillColor("#dbe4ff").font("Helvetica-Bold").fontSize(11).text("Your high-intent call results", M, 66);
  doc.fillColor(INK).y = 120;

  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text(`Results for ${name || "your business"} 🚀`);
  doc.moveDown(0.3); p("High-intent inbound calls are 33× more valuable than clicks. Here's what that means for you.");

  h("How to get started", BRAND);
  p("1. Create your account and pick your keyword (your money word).\n2. Set what you'll pay per delivered call.\n3. Give us the phone that should ring — we deliver ready-to-talk callers in real time.\n4. Fund your account and go live. Your first call is free.");

  h("How it works", BRAND);
  p("We use PredictiveData and R0cketShip technology across TV, digital, and outreach to find people actively looking for what you sell — then route them to your phone live. You only pay for calls you actually receive.");

  h("Here's your results", ORANGE, 16);
  const boxY = doc.y + 6;
  doc.roundedRect(M, boxY, CW, 96, 10).fill("#f4f6ff");
  const col = (x: number, label: string, val: string, color = INK) => {
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(label.toUpperCase(), x, boxY + 18, { width: CW / 4 - 8 });
    doc.fillColor(color).font("Helvetica-Bold").fontSize(20).text(val, x, boxY + 34, { width: CW / 4 - 8 });
  };
  col(M + 14, "Calls", String(r.calls), BRAND2);
  col(M + 14 + CW / 4, "Cost", usd(r.costCents));
  col(M + 14 + CW / 2, "Value created", usd(r.revenueCents), BRAND2);
  col(M + 14 + (CW * 3) / 4, "ROAS", r.roas.toFixed(1) + "×", "#16a34a");
  doc.y = boxY + 110;

  h("What this looks like for your business", BRAND);
  p(`Based on a lifetime customer value of ${usd(ltvCents)}: we estimate 10 high-intent calls. If just one becomes a customer, that's ${usd(r.revenueCents)} in lifetime value created for a cost of ${usd(r.costCents)} — a ${r.roas.toFixed(1)}× return on ad spend. Every call after that only widens the gap.`);

  h("Ready to scale — then exit?", "#0b7285");
  p("When you're ready to scale and eventually sell, Exit Optimization helps owners double — even triple — their exit valuation. exitoptimization.com");

  doc.moveDown(1);
  doc.roundedRect(M, doc.y, CW, 54, 10).fill(ORANGE);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(14).text("Create your account at keywordcalls.com/signup", M, doc.y - 44, { width: CW, align: "center" });
  doc.fillColor("#fff").font("Helvetica").fontSize(10).text("Your first call is free.", { width: CW, align: "center" });

  doc.end();
  return done;
}
