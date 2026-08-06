import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomBytes } from "crypto";

// Convert browser-recorded WebM/Opus audio to telephony MP3 (Twilio <Play> only supports mp3/wav).
export async function convertToMp3(input: Buffer): Promise<Buffer | null> {
  const base = path.join(tmpdir(), "kwc-" + randomBytes(6).toString("hex"));
  const inp = base + ".webm", outp = base + ".mp3";
  try {
    await writeFile(inp, input);
    const code = await new Promise<number>((resolve) => {
      const p = spawn("ffmpeg", ["-y", "-i", inp, "-vn", "-ar", "8000", "-ac", "1", "-codec:a", "libmp3lame", "-q:a", "5", outp]);
      p.on("error", () => resolve(1));
      p.on("close", (c) => resolve(c ?? 1));
    });
    if (code !== 0) return null;
    return await readFile(outp);
  } catch {
    return null;
  } finally {
    unlink(inp).catch(() => {});
    unlink(outp).catch(() => {});
  }
}
