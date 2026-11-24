// Render look-dev stills: node scripts/stills.mjs <Comp> <outPrefix> <f1,f2,...> [scale]
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [comp = "DuaTiket", prefix = "out/duatiket/stills/x_", framesArg = "0", scaleArg = "0.5"] = process.argv.slice(2);
const remTmp = process.env.REMOTION_TMP || path.resolve("/tmp/remotion-tmp");
fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP = remTmp;
fs.mkdirSync(path.dirname(path.resolve(prefix)), { recursive: true });

const browserExecutable = process.env.BROWSER || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable, chromiumOptions });
for (const f of framesArg.split(",").map(Number)) {
  const t0 = Date.now();
  const output = path.resolve(`${prefix}${String(f).padStart(4, "0")}.jpg`);
  await renderStill({ composition, serveUrl, output, frame: f, imageFormat: "jpeg", jpegQuality: 92, scale: Number(scaleArg), browserExecutable, chromiumOptions, timeoutInMilliseconds: 240000 });
  console.log(`frame ${f} -> ${output} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
