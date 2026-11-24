// Render the DuaTiket picture (no audio) in frame-range chunks so long software-GL renders can resume.
// usage: node scripts/render-duatiket.mjs <outDir> [from] [to] [chunk] [concurrency] [scale]
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const [outDir = "out/duatiket/chunks", fromA = "0", toA = "", chunkA = "150", concA = "2", scaleA = "1"] = process.argv.slice(2);
const remTmp = process.env.REMOTION_TMP || "/tmp/remotion-tmp";
fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = remTmp;
fs.mkdirSync(outDir, { recursive: true });
const browserExecutable = process.env.BROWSER || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const inputProps = { mute: true };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP || "DuaTiket", browserExecutable, chromiumOptions, inputProps });
const last = toA === "" ? composition.durationInFrames - 1 : Number(toA);
for (let a = Number(fromA); a <= last; a += Number(chunkA)) {
  const b = Math.min(last, a + Number(chunkA) - 1);
  const out = path.join(outDir, `c_${String(a).padStart(4, "0")}_${String(b).padStart(4, "0")}.mp4`);
  if (fs.existsSync(out)) { console.log("skip", out); continue; }
  const t0 = Date.now();
  await renderMedia({
    composition, serveUrl, codec: "h264", crf: 14, outputLocation: out + ".part.mp4", frameRange: [a, b], inputProps, muted: true,
    browserExecutable, chromiumOptions, concurrency: Number(concA), scale: Number(scaleA), timeoutInMilliseconds: 300000,
    imageFormat: "jpeg", jpegQuality: 95, x264Preset: "medium",
  });
  fs.renameSync(out + ".part.mp4", out);
  const s = (Date.now() - t0) / 1000;
  console.log(`${out}: ${b - a + 1} frames in ${s.toFixed(0)} s (${(s / (b - a + 1)).toFixed(2)} s/frame)`);
}
