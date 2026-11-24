// Indonesian subtitles synced to voice/Dua Tiket.words.json (chunks of 1-3 words, see scripts/gen-subs.py).
// Style from the repo README: Poppins 900, pure white, 7 px black outline, 1.12x micro-pop, no background chip.
import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import chunks from "./subtitles.json";

type Chunk = { text: string; start: number; end: number };
const FONT = "PoppinsLocal";

const useFont = () => {
  const [handle] = useState(() => delayRender("load Poppins"));
  useEffect(() => {
    const ff = new FontFace(FONT, `url(${staticFile("fonts/poppins-latin-900-normal.woff2")}) format("woff2")`, { weight: "900" });
    ff.load().then((f) => { document.fonts.add(f); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);
};

export const DuaTiketSubtitles: React.FC<{ bg?: string }> = ({ bg }) => {
  useFont();
  const f = useCurrentFrame(), time = f / 30;
  const c = (chunks as Chunk[]).find((x) => time >= x.start && time < x.end);
  const el = c ? Math.max(0, time - c.start) : 0, pop = 1 + 0.12 * Math.pow(1 - Math.min(1, el / 0.08), 2);
  return (
    <AbsoluteFill style={{ backgroundColor: bg || "transparent", justifyContent: "flex-end", alignItems: "center", paddingBottom: 430, pointerEvents: "none" }}>
      {c && (
        <span style={{
          fontFamily: `'${FONT}', 'Poppins', 'Inter', sans-serif`, fontWeight: 900, fontSize: 74, lineHeight: 1.15,
          color: "#ffffff", WebkitTextStroke: "14px #000000", paintOrder: "stroke fill",
          textShadow: "0 6px 16px rgba(0,0,0,0.55)", textAlign: "center", maxWidth: "86%", display: "inline-block",
          transform: `scale(${pop.toFixed(3)})`,
        }}>{c.text}</span>
      )}
    </AbsoluteFill>
  );
};
