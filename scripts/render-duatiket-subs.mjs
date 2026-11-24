// Transparent subtitle layer (ProRes 4444 with alpha) for compositing over the 3D picture.
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
const out = process.argv[2] || "out/duatiket/subs_alpha.mov";
const remTmp = "/tmp/remotion-tmp"; fs.mkdirSync(remTmp, { recursive: true });
process.env.TEMP = process.env.TMP = remTmp;
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "DuaTiketSubtitles", browserExecutable });
await renderMedia({ composition, serveUrl, codec: "prores", proResProfile: "4444", imageFormat: "png", pixelFormat: "yuva444p10le",
  outputLocation: out, muted: true, browserExecutable, concurrency: 1 });
console.log("done", out);
