// Timeline of "Dia Selalu Membeli Dua Tiket": 16 shots locked to voice/Dua Tiket.words.json (VO 52.44 s; picture 55 s).
// Camera grammar from skill/references/reports/motion.md: every hold creeps (push-in 0.15-0.35 %/f), smootherstep glides
// 18-40 f, hard cuts on big reframes, 7-frame sign-flipping kicks on punch words (soft here: it is a quiet story),
// white flashes on the hook cut and into the flashback, crossfades on place/time changes.
import { LightName } from "./lights";

export const FPS = 30;
export const TOTAL = 1650;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type SetKind = "loket" | "tunggu" | "kereta";
export type ShotDef = { id: number; a: number; b: number; light: LightName; set: SetKind; sunAz?: number; sunEl?: number; note: string };

// word frames (start): tiket 95, sendirian 158, hafal 214, "Pak 333, Memangnya 393, tersenyum 451, Ada 484, bercanda 622,
// keesokan 667, datang 735, membeli 759, tiket 777, duduk 801, memperhatikan 905, kursinya 928, Ternyata 953, kursi 1018,
// pagi 1088, satu 1158, "Hari 1230, dua 1256, pelan 1307, Anak 1332, Dulu 1400, bonekanya 1459, berani 1499, Sekarang 1536
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 120, light: "day", set: "loket", sunAz: 145, sunEl: 42, note: "Selama hampir sebulan, seorang pria selalu membeli dua tiket kereta," },
  { id: 2, a: 120, b: 180, light: "day", set: "tunggu", sunAz: 35, sunEl: 42, note: "padahal dia berangkat sendirian." },
  { id: 3, a: 180, b: 250, light: "day", set: "loket", sunAz: 145, sunEl: 42, note: "Petugas loket sampai hafal wajahnya." },
  { id: 4, a: 250, b: 432, light: "day", set: "loket", sunAz: 145, sunEl: 42, note: "Suatu hari ... Memangnya ada yang ikut?" },
  { id: 5, a: 432, b: 556, light: "day", set: "loket", sunAz: 145, sunEl: 42, note: "Pria itu tersenyum dan menjawab, Ada. Cuma belum tentu datang." },
  { id: 6, a: 556, b: 646, light: "day", set: "loket", sunAz: 145, sunEl: 42, note: "Petugas itu mengira pria tersebut sedang bercanda." },
  { id: 7, a: 646, b: 792, light: "golden", set: "loket", sunAz: 150, sunEl: 24, note: "Tapi keesokan harinya ... membeli dua tiket," },
  { id: 8, a: 792, b: 862, light: "golden", set: "tunggu", sunAz: 50, sunEl: 20, note: "lalu duduk sendirian di ruang tunggu." },
  { id: 9, a: 862, b: 952, light: "golden", set: "loket", sunAz: 150, sunEl: 24, note: "Karena penasaran ... nomor kursinya." },
  { id: 10, a: 952, b: 1062, light: "day", set: "kereta", sunAz: 30, sunEl: 45, note: "Ternyata, tiket kedua selalu untuk kursi di sebelahnya." },
  { id: 11, a: 1062, b: 1182, light: "golden", set: "loket", sunAz: 150, sunEl: 24, note: "Sampai suatu pagi ... membeli satu tiket." },
  { id: 12, a: 1182, b: 1288, light: "golden", set: "loket", sunAz: 150, sunEl: 24, note: "Petugas loket bertanya, Hari ini nggak beli dua, Pak?" },
  { id: 13, a: 1288, b: 1334, light: "golden", set: "loket", sunAz: 150, sunEl: 24, note: "Pria itu menjawab pelan," },
  { id: 14, a: 1334, b: 1400, light: "day", set: "tunggu", sunAz: 35, sunEl: 42, note: "Anak saya sudah bisa pulang sendiri dari sekolah sekarang." },
  { id: 15, a: 1400, b: 1534, light: "golden", set: "kereta", sunAz: 60, sunEl: 18, note: "Dulu, saya selalu membelikan tiket untuk bonekanya supaya dia berani naik kereta." },
  { id: 16, a: 1534, b: TOTAL, light: "golden", set: "loket", sunAz: 150, sunEl: 24, note: "Sekarang dia sudah besar." },
];

export const XFADE: Record<number, number> = { 2: 8, 7: 12, 8: 8, 10: 10, 11: 12, 14: 8, 16: 10 };
export const FLASHES = [178, 1398];
export const FLASH_AT = FLASHES[0];

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export type WorldState = { id: number; f: number; t: number; u: number; set: SetKind; flashback: boolean };
export const worldState = (id: number, f: number): WorldState => {
  const s = SHOTS[id - 1];
  return { id, f, t: f / FPS, u: clamp01((f - s.a) / Math.max(1, s.b - s.a)), set: s.set, flashback: id === 15 };
};

// ---------------- camera engine (template) ----------------
export type CamPose = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<CamPose> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
const mix = (a: CamPose, b: CamPose, k: number): CamPose => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3,
  look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k,
  roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): CamPose => ({ fov: 38, roll: 0, ...c });
const run = (keys: Key[], f: number): CamPose => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 28) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 7, (n - i - 0.5) / 7));
  return Math.exp(-s);
};
/** a framing that creeps toward `look` from f0 (rate %/f /100), optional punch */
const D = (pos: V3, look: V3, fov: number, roll: number, f0: number, rate = 0.0025, punch = 0, n = 28) => (f: number): Shot => {
  const k = pushK(f, f0, rate, punch, n);
  return { pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, fov, roll: roll * (Math.PI / 180) };
};
/** pull-back: creeps away from `look` */
const P = (pos: V3, look: V3, fov: number, roll: number, f0: number, rate = 0.002) => (f: number): Shot => {
  const k = Math.exp(rate * Math.max(0, f - f0));
  return { pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, fov, roll: roll * (Math.PI / 180) };
};

/** frontal two-shot at the window: father right (near), clerk left behind the glass; dx shifts the angle */
const TS = (f0: number, rate = 0.002, dx = 0, roll = 0, fov = 42) => D([0.45 + dx, 1.6, 2.35], [0.16, 1.34, -1.0], fov, roll, f0, rate);

// character anchor points (heads) used by cameras and the focus of the lens blur
export const MAN_LOKET: V3 = [0.5, 1.29, -0.35];
export const CLERK: V3 = [-0.25, 1.43, -1.62];
export const MAN_BENCH: V3 = [0.0, 1.12, -0.9];
export const MAN_SEAT: V3 = [0.0, 1.12, -0.98];
export const KID_SEAT: V3 = [0.0, 0.98, -0.98];
/** walk-in path for shot 7 (x of the father) */
export const walkX7 = (f: number) => lerp(2.9, 0.5, smooth((f - 684) / 70));
export const walkX2 = (f: number) => lerp(-2.6, 0.9, (f - 112) / 72);
export const walkX14 = (f: number) => lerp(2.4, -1.2, (f - 1326) / 78);

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: D([1.1, 1.9, 4.7], [0.12, 1.5, -1.0], 40, -1.5, 0, 0.0022) },                 // wide hall: father at LOKET 1
    { f: 46, dur: 34, s: TS(46, 0.0022, 0.15, 2.0) },      // glide round to the side two-shot
    { f: 95, cut: true, s: D([0.84, 1.24, 0.75], [0.52, 1.05, -0.38], 30, -3, 95, 0.0032, 0.007, 20) }, // insert: two tickets in his hand
  ],
  2: [
    { f: 112, s: (f) => D([walkX2(f) + 0.9, 1.55, 3.1], [walkX2(f) + 0.1, 1.05, -0.2], 38, 2, 112, 0.0)(f) }, // track the lone walk
  ],
  3: [
    { f: 180, s: D([-0.95, 1.52, 0.35], [-0.25, 1.42, -1.62], 33, -2.5, 180, 0.003, 0.0055, 26) },  // clerk MCU through the glass
  ],
  4: [
    { f: 250, s: TS(250, 0.002, 0.25, 2.5) },                // side two-shot
    { f: 290, dur: 30, s: TS(290, 0.0026, -0.2, -3.0, 41) },   // creep in as she leans forward
    { f: 333, cut: true, s: D([-0.9, 1.5, 0.25], [-0.25, 1.43, -1.62], 31, -3.5, 333, 0.0032, 0.0065, 22) }, // "Pak," clerk CU
    { f: 393, dur: 26, s: TS(393, 0.0024, 0.1, 2.0) },     // "Memangnya ada yang ikut?" two-shot
  ],
  5: [
    { f: 432, s: D([-0.78, 1.45, -2.05], [0.5, 1.25, -0.35], 38, 2.5, 432, 0.0024) },             // father MCU from the booth
    { f: 478, dur: 30, s: D([-0.62, 1.4, -1.85], [0.5, 1.27, -0.35], 35, 3.5, 478, 0.0026, 0.005, 26) },
  ],
  6: [
    { f: 556, s: D([-0.95, 1.55, 0.45], [-0.25, 1.42, -1.62], 33, -2.0, 556, 0.0026) },             // clerk chuckles
    { f: 618, dur: 20, s: D([-0.8, 1.48, 0.15], [-0.25, 1.43, -1.62], 31, -4.0, 618, 0.003, 0.006, 22) },
  ],
  7: [
    { f: 640, s: D([0.9, 1.85, 4.5], [0.6, 1.35, -0.8], 40, -1.5, 640, 0.0018) },                  // next morning: wide, he walks in
    { f: 744, dur: 34, s: TS(744, 0.0022, 0.2, 2.5) },      // to the counter two-shot
  ],
  8: [
    { f: 788, s: D([0.8, 1.55, 2.6], [0.3, 1.0, -0.9], 36, -2.0, 788, 0.002) },               // sits alone, empty seat
    { f: 816, dur: 40, s: P([1.6, 3.1, 4.2], [0.25, 0.85, -0.9], 40, -1.0, 816, 0.0016) },       // crane up: lonely high angle
  ],
  9: [
    { f: 862, s: D([-0.95, 1.5, 0.3], [-0.18, 1.42, -1.6], 33, 2.5, 862, 0.0028) },                // curious clerk
    { f: 905, cut: true, s: D([0.55, 1.45, -2.35], [0.56, 1.28, -1.36], 31, -2.0, 905, 0.004, 0.008, 24) }, // seat map insert
  ],
  10: [
    { f: 947, s: D([3.0, 1.75, -0.3], [0.0, 0.95, -0.72], 40, 2.0, 947, 0.0022) },               // train: father + the empty seat
    { f: 1006, dur: 34, s: D([2.8, 1.6, -0.6], [0.0, 0.82, -0.8], 37, 3.5, 1006, 0.0022, 0.005, 24) }, // push to the empty seat
  ],
  11: [
    { f: 1056, s: D([1.0, 1.9, 4.4], [0.15, 1.38, -0.9], 40, -1.5, 1056, 0.0018) },                 // one morning: wide
    { f: 1140, cut: true, s: D([0.82, 1.3, 1.05], [0.52, 1.12, -0.36], 31, -3, 1140, 0.0032, 0.007, 22) }, // one ticket only
  ],
  12: [
    { f: 1182, s: D([-0.95, 1.5, 0.3], [-0.25, 1.42, -1.62], 33, -2.5, 1182, 0.0026) },             // clerk notices
    { f: 1228, dur: 22, s: D([-0.8, 1.47, 0.05], [-0.25, 1.43, -1.62], 30, -3.5, 1228, 0.003, 0.006, 24) },
  ],
  13: [
    { f: 1288, s: D([-0.72, 1.42, -1.95], [0.5, 1.26, -0.35], 36, 2.5, 1288, 0.003, 0.005, 26) },  // father answers softly
  ],
  14: [
    { f: 1326, s: (f) => D([walkX14(f) - 0.9, 1.35, 2.9], [walkX14(f) - 0.1, 0.95, -0.2], 37, -2, 1326, 0)(f) }, // daughter walks home alone
  ],
  15: [
    { f: 1400, s: D([2.35, 1.45, -0.3], [0.0, 0.85, -0.72], 38, -2.0, 1400, 0.0024) },              // flashback: little girl + doll
    { f: 1470, dur: 30, s: D([2.65, 1.35, -0.78], [0.0, 0.86, -0.76], 38, -3.0, 1470, 0.0022, 0.005, 26) },
  ],
  16: [
    { f: 1529, s: TS(1529, 0.0024, 0.1, 2.0) },               // now: both smile
    { f: 1566, dur: 40, s: P([0.5, 1.65, 2.5], [0.16, 1.36, -1.0], 42, 0.5, 1566, 0.0026) },    // slow pull back to end
  ],
};

const KICKS: [number, number][] = [
  [95, 0.6], [333, 0.7], [622, 0.8], [777, 0.5], [928, 0.8], [1018, 0.5], [1158, 1.0], [1256, 0.6], [1499, 0.6],
];
export const kickAt = (f: number) => {
  let a = 0;
  for (const [f0, g] of KICKS) { const n = f - f0; if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5; }
  return a;
};
export const camAt = (id: number, f: number): CamPose => {
  const c = run(CAMS[id] ?? CAMS[1], f), a = kickAt(f);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

/** lens blur per beat: close-ups 11-14 px, medium 8-10, wides sharp; focus on the eyes of the subject */
export const dofAt = (f: number): { cInf: number; focus?: (frame: number) => V3 } => {
  const s = shotAt(f), id = s.id;
  if (id === 1) return f < 46 ? { cInf: 0 } : f < 95 ? { cInf: 5, focus: () => MAN_LOKET } : { cInf: 13, focus: () => [0.52, 1.05, -0.38] };
  if (id === 2 || id === 14) return { cInf: 6, focus: (fr) => [id === 2 ? walkX2(fr) : walkX14(fr), 1.1, 0.3] };
  if (id === 3 || id === 6 || id === 12) return { cInf: 12, focus: () => CLERK };
  if (id === 4) return f >= 333 && f < 393 ? { cInf: 12, focus: () => CLERK } : { cInf: 5, focus: () => MAN_LOKET };
  if (id === 5 || id === 13) return { cInf: 13, focus: () => MAN_LOKET };
  if (id === 7) return f < 744 ? { cInf: 0 } : { cInf: 5, focus: () => MAN_LOKET };
  if (id === 8) return f < 816 ? { cInf: 9, focus: () => MAN_BENCH } : { cInf: 0 };
  if (id === 9) return f < 905 ? { cInf: 12, focus: () => CLERK } : { cInf: 14, focus: () => [0.62, 1.28, -1.36] };
  if (id === 10) return { cInf: 10, focus: () => (f < 1006 ? MAN_SEAT : [0, 0.8, -0.46]) };
  if (id === 11) return f < 1140 ? { cInf: 0 } : { cInf: 13, focus: () => [0.52, 1.12, -0.36] };
  if (id === 15) return { cInf: 11, focus: () => KID_SEAT };
  return f < 1566 ? { cInf: 5, focus: () => MAN_LOKET } : { cInf: 4, focus: () => MAN_LOKET };
};
