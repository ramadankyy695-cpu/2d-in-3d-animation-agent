// 2D character cast for "Dia Selalu Membeli Dua Tiket": lit card sprites (cardShade), contact/cast shadows, blinks,
// walk cycles and expression swaps timed 0-3 frames before their words. Machinery from the template cast.ts.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxShadow, fxContact,
  Outfit, FrontOpts, SideOpts, INK, Expr, dollCard,
  PRIA_OUTFIT, PETUGAS_OUTFIT, ANAK_KECIL_OUTFIT, ANAK_BESAR_OUTFIT,
} from "./toon";
import { FPS, SHOTS, clamp01, smooth, WorldState, walkX2, walkX7, walkX14 } from "./story";
import { LOKET, TUNGGU, KERETA } from "./build";
import { LightName } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
const ROOTS = new Set<THREE.Object3D>();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}

export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else {
      this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0;
    }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;

const tier = (d: number): [number, number, number] =>
  d < 8.5 ? [1800, 3000, 3.0] : d < 14 ? [1080, 1800, 1.8] : [480, 800, 0.8];

const SUN = new THREE.Vector3(0.5, 0.75, 0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: LightName = "golden";

const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

// ---------------- blinks, expression swaps & micro-motion helpers ----------------
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 48 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
const liveTilt = (t: number, seed: number, amp = 2.6) => q(amp * Math.sin(t * 3.2 + seed), 30);
const liveHead = (t: number, seed: number, amp = 4.0) => q(amp * Math.sin(t * 2.4 + seed * 1.7) + (amp * 0.4) * Math.cos(t * 4.1 + seed), 30);

/** Parabolic hop/jump arc with a 3-frame crouch anticipation */
const hopY = (t: number, t0: number, dur = 0.42, height = 0.16): number => {
  const dt = t - t0;
  if (dt < -0.08 || dt > dur) return 0;
  if (dt < 0) return -0.025 * Math.sin(((dt + 0.08) / 0.08) * Math.PI);
  const u = dt / dur;
  return height * 4 * u * (1 - u);
};

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, side: boolean, mirror: boolean, fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const m = side && mirror, light = light2D(cam, m), seed = ((who.i * 5 + 3) % 7) + 1;
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror: m,
    draw: (p) => (side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

const CONTACT: Record<LightName, [number, number, number]> = {
  space: [0.18, 0.16, 0.32],
  night: [0.18, 0.16, 0.30],
  golden: [0.24, 0.20, 0.33],
  day: [0.20, 0.21, 0.33],
};
const TAIL: [number, number, number] = [0.38, 0.36, 0.56];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");

const blob = (out: Stage, x: number, _y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  const el = Math.asin(Math.min(0.99, Math.max(0.15, SUN.y)));
  const len = Math.min(2.2, Math.max(0.5, 1.4 / Math.tan(el))) * sc, h = len + 0.5 * sc, c = 0.3 * h;
  const tc = hexOf(TAIL, k);
  out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: 0.022, z: z + oz * 0.03 * sc, w: 0.54 * sc, h: 0.42 * sc, flat: true, rot });
};

// ---------------- small comic FX cards ----------------
/** comic "?" with a pop-in scale; 260 x 300 canvas */
const fxQuestion = (p: Pen) => {
  const g = p.g;
  g.font = "900 250px 'Poppins', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = 26; g.strokeStyle = INK; g.strokeText("?", 130, 160);
  g.fillStyle = "#f6c445"; g.fillText("?", 130, 160);
};
/** a single train ticket lying flat (top view); 256 x 128 canvas */
const fxTicketFlat = (p: Pen) => {
  const g = p.g;
  g.fillStyle = INK; g.beginPath(); g.roundRect(6, 6, 244, 116, 12); g.fill();
  g.fillStyle = "#fff6e2"; g.beginPath(); g.roundRect(14, 14, 228, 100, 8); g.fill();
  g.fillStyle = "#f08a2c"; g.fillRect(14, 14, 228, 26);
  g.fillStyle = INK; for (let k = 0; k < 9; k++) g.fillRect(150 + k * 9, 58, k % 2 ? 3 : 6, 40);
  g.font = "900 34px 'Poppins', Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("7B", 34, 78);
};
/** soft warm sparkle for the brave moment; 300 x 300 */
const fxSparkle = (p: Pen, ph: number) => {
  const g = p.g;
  for (const [x, y, r, o] of [[80, 90, 34, 0], [220, 70, 26, 1.7], [190, 210, 22, 3.1], [70, 220, 18, 4.4]] as const) {
    const k = 0.75 + 0.25 * Math.sin(ph * 6 + o);
    g.fillStyle = "#fff3b0"; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = (i % 2 ? 0.38 : 1) * r * k; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.stroke();
  }
};

// ---------------- roster (one fixed outfit each, every shot) ----------------
const WHO_PRIA: Who = { i: 1, o: PRIA_OUTFIT, okey: "pria" };
const WHO_PETUGAS: Who = { i: 2, o: PETUGAS_OUTFIT, okey: "petugas" };
const WHO_KECIL: Who = { i: 3, o: ANAK_KECIL_OUTFIT, okey: "kecil" };
const WHO_BESAR: Who = { i: 4, o: ANAK_BESAR_OUTFIT, okey: "besar" };
const EXTRAS: Who[] = [
  { i: 5, o: { jacket: "#8c3b4a", pants: "#3b3f52", boots: "#2b1d14", hat: "hair", hair: "#2b2220", skin: "#fcf3e8" }, okey: "ex1" },
  { i: 6, o: { jacket: "#5d7a3a", pants: "#3b3f52", boots: "#2b1d14", hat: "hair", hair: "#3a2a22", dress: "#d9a441", skin: "#fcf3e8" }, okey: "ex2" },
  { i: 7, o: { jacket: "#b5653f", pants: "#2f3a4a", boots: "#2b1d14", hat: "cap", cap: "#2f5f6a", skin: "#fcf3e8" }, okey: "ex3" },
];

const SU_ = 0.00216;
/** card y so the hips rest on a seat top: hips sit 0.32 head-heights above the soles in `sit` mode */
const sitY = (seatTop: number, scale: number, kid = false) => seatTop - 0.32 * (kid ? 210 : 222) * SU_ * scale;
/** mouth flap while a line is spoken: open/closed every 4 frames inside [a, b) */
const talk = (f: number, spans: [number, number][], open: Expr, closed: Expr, idle: Expr) => {
  for (const [a, b] of spans) if (f >= a && f < b) return Math.floor((f - a) / 4) % 2 === 0 ? open : closed;
  return idle;
};
const MAN_X = 0.5, CLERK_X = -0.25;

// ---------------- staging per shot ----------------
export const stage = (ws: WorldState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const { id, f, t } = ws;
  LNAME = SHOTS[id - 1].light;
  findSun(cam, SUN);

  const addChar = (who: Who, x: number, y: number, z: number, fo: FrontOpts, scale = 0.9, shadow = true) => {
    out.places.push(person(cam, who, x, y, z, false, false, fo, {}, scale));
    if (shadow) blob(out, x, y, z, scale * 0.95);
  };
  const addDoll = (x: number, y: number, z: number, scale: number, ticket: boolean, bounce = 0) => {
    const d = cam.pos.distanceTo(tmp.set(x, y + 0.3, z)) / scale, [w, h, k] = tier(d);
    out.places.push({ key: `doll|${ticket}`, draw: (p) => dollCard(p, ticket), x, y: y + bounce, z, scale, size: [w, h, k] });
  };
  const flat = (key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, rot = 0) =>
    out.fx.push({ key, cw, ch, draw, x, y, z, w, h, flat: true, rot });
  const pop = (key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, f0: number, f1: number) => {
    if (f < f0 || f >= f1) return;
    const k = Math.min(1, (f - f0 + 1) / 5), s = k < 1 ? 0.4 + 0.75 * k : 1 + 0.05 * Math.sin((f - f0) * 0.35);
    out.fx.push({ key, cw, ch, draw, x, y: y + 0.03 * Math.sin((f - f0) * 0.2), z, w: w * s, h: h * s });
  };
  const idle = (seed: number) => ({ tilt: liveTilt(t, seed, 1.6), headTilt: liveHead(t, seed, 2.6) });

  // ---------- LOKET: the clerk is always at her window; the father at the counter ----------
  const clerk = (expr: Expr, o: Partial<FrontOpts> = {}, swaps: number[] = []) =>
    addChar(WHO_PETUGAS, CLERK_X, LOKET.boothFloor, LOKET.clerkZ, { mode: "stand", phase: q(t * 0.9, 20), expr, blink: lidAt(t, 2, swaps), facing: 1, look: 1, ...idle(2), ...o }, 0.82, false);
  const man = (expr: Expr, o: Partial<FrontOpts> = {}, swaps: number[] = [], x = MAN_X) =>
    addChar(WHO_PRIA, x, 0, LOKET.manZ, { mode: "stand", phase: q(t * 0.8, 20), expr, blink: lidAt(t, 1, swaps), facing: -1, look: -1, ...idle(1), ...o }, 0.9);

  if (ws.set === "loket") {
    if (id === 1) {
      clerk(f < 70 ? "smile" : "smile_closed", { prop: f >= 64 && f < 82 ? "tickets2" : null, wave: f >= 64 && f < 82 ? 1 : undefined });
      man(f < 30 ? "neutral" : "smile_closed", { prop: f >= 80 ? "tickets2" : null, wave: f >= 95 ? 0.6 : undefined }, [30, 80]);
    } else if (id === 3) {
      clerk(f < 212 ? "smile_closed" : "grin", { headTilt: liveHead(t, 2, 2.6) + 5 }, [212]);
      man("neutral", { prop: "tickets2" });
    } else if (id === 4) {
      const lean = smooth((f - 284) / 14) * 6;
      const e: Expr = f < 284 ? "neutral" : f < 330 ? "nervous" : talk(f, [[331, 389], [391, 440]], "relief_open", "smile", "smile");
      clerk(e, { tilt: lean + liveTilt(t, 2, 1.2), headTilt: 6 + liveHead(t, 2, 2), look: f >= 393 ? 1 : 1 }, [284, 331]);
      man(f < 393 ? "neutral" : "smile_closed", { prop: "tickets2", look: -1 }, [393]);
      pop("q|4", 260, 300, fxQuestion, CLERK_X - 0.05, 2.02, LOKET.clerkZ, 0.26, 0.3, 395, 432);
    } else if (id === 5) {
      const e: Expr = f < 449 ? "neutral" : talk(f, [[482, 498], [511, 556]], "relief_open", "smile_closed", "smile_closed");
      man(e, { prop: "tickets2", headTilt: liveHead(t, 1, 2) - 4 }, [449, 482]); // seen over the clerk's shoulder: she is off-card
    } else if (id === 6) {
      const e: Expr = f < 600 ? "smile" : f < 640 ? "laugh" : "grin";
      clerk(e, { tilt: f >= 600 ? 2.5 * Math.sin(f * 0.9) : 0, wave: f >= 606 && f < 640 ? q(Math.sin(f * 0.5), 10) : undefined, prop: null }, [600]);
      man("smile_closed", { prop: "tickets2" });
    } else if (id === 7) {
      const x = walkX7(f), walking = f >= 684 && f < 754;
      clerk(f < 735 ? "neutral" : "smile", { prop: f >= 762 && f < 778 ? "tickets2" : null, wave: f >= 762 && f < 778 ? 1 : undefined }, [735]);
      if (f >= 684 || x < 2.8) man(walking ? "neutral" : "smile_closed", {
        mode: walking ? "stroll" : "stand", phase: walking ? q((2.9 - x) / 1.45, 40) : q(t * 0.8, 20),
        prop: f >= 776 ? "tickets2" : null, facing: walking ? -1 : -1, look: -1,
      }, [754], x);
    } else if (id === 9) {
      clerk(f < 886 ? "neutral" : "nervous", { look: 1, facing: 1, headTilt: 7 + liveHead(t, 2, 1.5) }, [886]);
      man("neutral", { prop: "tickets2" });
      pop("q|9", 260, 300, fxQuestion, CLERK_X - 0.05, 2.02, LOKET.clerkZ, 0.26, 0.3, 872, 905);
    } else if (id === 11) {
      clerk("smile");
      man(f < 1140 ? "neutral" : "smile_closed", { prop: f >= 1100 ? "ticket1" : null, wave: f >= 1150 ? q(smooth((f - 1150) / 8), 10) : undefined }, [1140]);
    } else if (id === 12) {
      const e: Expr = f < 1192 ? "smile" : f < 1226 ? "shock" : talk(f, [[1228, 1272]], "relief_open", "smile", "nervous");
      clerk(e, { headTilt: 5 + liveHead(t, 2, 2) }, [1192, 1228]);
      man("smile_closed", { prop: "ticket1" });
      pop("q|12", 260, 300, fxQuestion, CLERK_X - 0.05, 2.02, LOKET.clerkZ, 0.26, 0.3, 1256, 1288);
    } else if (id === 13) {
      man(talk(f, [[1305, 1334]], "relief_open", "smile_closed", "smile_closed"), { prop: "ticket1", headTilt: -5 + liveHead(t, 1, 1.5) }, [1300]);
    } else if (id === 16) {
      clerk(f < 1566 ? "relief" : "smile_closed", { headTilt: 6 + liveHead(t, 2, 1.8) }, [1566]);
      man(talk(f, [[1534, 1580]], "relief_open", "smile_closed", "smile_closed"), { prop: "ticket1", headTilt: -3 + liveHead(t, 1, 1.5) }, [1582]);
    }
  } else if (ws.set === "tunggu") {
    const seatY = sitY(TUNGGU.seatY, 0.9);
    // other passengers waiting on the side benches (life in the room)
    addChar(EXTRAS[0], -2.6, sitY(TUNGGU.seatY, 0.88), TUNGGU.benchZ, { mode: "sit", expr: "neutral", blink: lidAt(t, 5), facing: 1, ...idle(5) }, 0.88, false);
    addChar(EXTRAS[1], 2.0, sitY(TUNGGU.seatY, 0.86), TUNGGU.benchZ, { mode: "sit", expr: "smile", blink: lidAt(t, 6), facing: -1, ...idle(6) }, 0.86, false);
    if (id === 2) {
      const x = walkX2(f);
      addChar(WHO_PRIA, x, 0, 0.3, { mode: "stroll", phase: q((x + 2.6) / 1.45, 40), expr: "neutral", blink: lidAt(t, 1), facing: 1, look: 1, prop: "tickets2", ...idle(1) }, 0.9);
    } else if (id === 8) {
      addChar(WHO_PRIA, 0, seatY, TUNGGU.benchZ, { mode: "sit", expr: "neutral", blink: lidAt(t, 1), facing: 1, look: 1, prop: "tickets2", headTilt: 4 + liveHead(t, 1, 1.5), tilt: liveTilt(t, 1, 0.8) }, 0.9, false);
      flat("flat|tk|8", 256, 128, fxTicketFlat, 0.62, TUNGGU.seatY + 0.006, TUNGGU.benchZ + 0.02, 0.2, 0.1, 0.25);
    } else if (id === 14) {
      const x = walkX14(f);
      addChar(WHO_BESAR, x, 0, 0.3, { mode: "stroll", phase: q((2.4 - x) / 1.2, 40), expr: f < 1360 ? "smile_closed" : "grin", blink: lidAt(t, 4, [1360]), facing: -1, look: -1, prop: "ticket1", wave: f > 1372 ? q(Math.sin(f * 0.45), 10) : undefined, ...idle(4) }, 1.0);
    }
  } else if (ws.set === "kereta") {
    // passengers a few rows back (day ride only: the flashback carriage is quiet)
    if (id === 10) {
      addChar(EXTRAS[2], -2.1, sitY(KERETA.seatY, 0.86), KERETA.aisleZ, { mode: "sit", expr: "neutral", blink: lidAt(t, 7), facing: 1, ...idle(7) }, 0.86, false);
      addChar(EXTRAS[0], -3.15, sitY(KERETA.seatY, 0.86), KERETA.winZ, { mode: "sit", expr: "smile_closed", blink: lidAt(t, 5), facing: 1, ...idle(5) }, 0.86, false);
      addChar(WHO_PRIA, 0, sitY(KERETA.seatY, 0.9), KERETA.winZ, { mode: "sit", expr: f < 1010 ? "neutral" : "smile_closed", blink: lidAt(t, 1, [1010]), facing: 1, look: 1, prop: "tickets2", headTilt: 3 + liveHead(t, 1, 1.4), tilt: liveTilt(t, 1, 0.6) }, 0.9, false);
      flat("flat|tk|10", 256, 128, fxTicketFlat, 0.03, KERETA.seatY + 0.006, KERETA.aisleZ, 0.2, 0.1, 1.3);
    } else if (id === 15) {
      const brave = f >= 1492, hop = brave ? hopY(t, 1499 / FPS, 0.4, 0.08) : 0;
      addChar(WHO_KECIL, 0, sitY(KERETA.seatY, 0.78, true) + hop, KERETA.winZ, {
        mode: "sit", expr: f < 1468 ? "nervous" : f < 1492 ? "smile" : "laugh", blink: lidAt(t, 3, [1468, 1492]),
        facing: -1, look: f < 1460 ? 1 : -1, headTilt: (f < 1468 ? 6 : -4) + liveHead(t, 3, 2.4), tilt: liveTilt(t, 3, 1.2),
        wave: brave ? q(Math.sin(f * 0.5), 10) : undefined,
      }, 0.78, false);
      addDoll(0.0, KERETA.seatY, KERETA.aisleZ, 0.72, true, 0);
      if (brave) pop("sp|15", 300, 300, (p) => fxSparkle(p, 0), 0.0, 1.32, -0.75, 0.36, 0.36, 1499, 1534);
    }
  }
  return out;
};
