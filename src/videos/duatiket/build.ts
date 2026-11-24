// Procedural 3D sets & props for "Dia Selalu Membeli Dua Tiket": ticket hall (loket), waiting room + platform, train car.
// Built on the proven two-tone Lambert + InkPass + hand-painted Canvas2D texture pipeline of the template.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, ctex, rep, planksHD, beamHD } from "./paint";
import { twoTone } from "./shade";
import { NOINK } from "./ink";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached, all two-tone shaded) ----------------
const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = twoTone(new THREE.MeshLambertMaterial(make()));
    mats.set(key, m);
  }
  return m;
};

const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};

export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

/** Helper to draw auto-fitted text inside Canvas2D textures so it never clips */
const fitText = (
  g: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxW: number,
  startPx: number,
  weight = "900",
  family = "sans-serif"
) => {
  let sz = startPx;
  g.font = `${weight} ${sz}px ${family}`;
  while (g.measureText(text).width > maxW && sz > 16) {
    sz -= 2;
    g.font = `${weight} ${sz}px ${family}`;
  }
  g.fillText(text, cx, cy);
};

// ---------------- Hand-Painted Custom Canvas2D Textures ----------------


const INKC = "#241726";
const basicMats = new Map<string, THREE.MeshBasicMaterial>();
/** unlit material for painted signs/screens (a side-lit sign goes grey and unreadable: skill gotcha) */
export const sign = (key: string, map: () => THREE.Texture, tint = 1) => {
  let m = basicMats.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ map: map(), color: new THREE.Color(tint, tint, tint) }); basicMats.set(key, m); }
  return m;
};
const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });
const M4 = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), V(1, 1, 1));
const box = (b: Batch, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, ry = 0, rx = 0) =>
  b.add(new THREE.BoxGeometry(w, h, d), m, M4(x, y, z, ry, rx));
const cyl = (b: Batch, r0: number, r1: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 12, rx = 0, rz = 0) =>
  b.add(new THREE.CylinderGeometry(r0, r1, h, seg), m, M4(x, y, z, 0, rx, rz));
/** sign plane facing +z (or rotated by ry) */
const plane = (g: THREE.Group, w: number, h: number, x: number, y: number, z: number, m: THREE.Material, ry = 0) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.receiveShadow = false;
  g.add(mesh); return mesh;
};

// ---------------- Hand-painted Canvas2D textures ----------------
/** warm station floor: cream + terracotta tiles with dark grout seams */
export const tileTex = (key: string, a: string, b: string, grout: string) => ctex("dtTile" + key, 1024, 1024, (g, r) => {
  const N = 8, T = 1024 / N;
  g.fillStyle = grout; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = new THREE.Color((x + y) % 2 ? a : b).offsetHSL(0, 0, (r() - 0.5) * 0.04);
    g.fillStyle = "#" + c.getHexString(); g.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
    g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(x * T + 10, y * T + 10, T - 40, 8);
  }
});
/** painted plaster wall with a darker wainscot band and a dado rail */
export const wallTex = (key: string, top: string, low: string) => ctex("dtWall" + key, 512, 512, (g, r) => {
  g.fillStyle = top; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(80,60,50,${0.02 + r() * 0.03})`; g.fillRect(r() * 512, r() * 330, 2 + r() * 10, 2 + r() * 10); }
  g.fillStyle = low; g.fillRect(0, 340, 512, 172);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(x, 340, 3, 172); }
  g.fillStyle = INKC; g.fillRect(0, 332, 512, 10);
});
const label = (key: string, w: number, h: number, bg: string, fg: string, lines: [string, number][], border = INKC) =>
  ctex("dtLabel" + key, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = border; g.lineWidth = Math.max(8, h * 0.05); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    const n = lines.length;
    lines.forEach(([t, px], i) => fitText(g, t, w / 2, h * (i + 1) / (n + 1) + (n > 1 ? (i ? 0.06 : -0.04) * h : 0), w * 0.86, px, "900", "'Poppins', Arial, sans-serif"));
  });
export const clockTex = (hr: number, mn: number) => ctex(`dtClock${hr}_${mn}`, 512, 512, (g) => {
  g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(256, 256, 236, 0, Math.PI * 2); g.fill();
  g.lineWidth = 26; g.strokeStyle = INKC; g.stroke();
  g.fillStyle = INKC;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(256 + Math.sin(a) * 190, 256 - Math.cos(a) * 190); g.rotate(a); g.fillRect(-7, -18, 14, i % 3 ? 26 : 40); g.restore(); }
  const hand = (a: number, L: number, W: number, c: string) => { g.save(); g.translate(256, 256); g.rotate(a); g.fillStyle = c; g.fillRect(-W / 2, -L, W, L + 20); g.restore(); };
  hand(((hr % 12) + mn / 60) / 12 * Math.PI * 2, 120, 20, INKC);
  hand(mn / 60 * Math.PI * 2, 175, 12, INKC);
  g.fillStyle = "#d9382e"; g.beginPath(); g.arc(256, 256, 16, 0, Math.PI * 2); g.fill();
});
/** departure board (dark blue LED style) */
export const jadwalTex = () => ctex("dtJadwal", 1024, 640, (g) => {
  g.fillStyle = "#13213f"; g.fillRect(0, 0, 1024, 640);
  g.strokeStyle = INKC; g.lineWidth = 22; g.strokeRect(11, 11, 1002, 618);
  g.fillStyle = "#f6c445"; g.fillRect(22, 22, 980, 104);
  g.fillStyle = INKC; g.textAlign = "center"; g.textBaseline = "middle";
  fitText(g, "KEBERANGKATAN", 512, 76, 900, 70, "900", "'Poppins', Arial, sans-serif");
  const rows = [["07:15", "BANDUNG", "2"], ["07:40", "YOGYAKARTA", "1"], ["08:05", "CIREBON", "3"], ["08:30", "SEMARANG", "2"]];
  g.textAlign = "left";
  rows.forEach(([t, d, j], i) => {
    const y = 192 + i * 112;
    g.fillStyle = i === 0 ? "#7cf0a0" : "#ffe9a8"; g.font = "800 54px 'Poppins', Arial, sans-serif";
    g.fillText(t, 60, y); g.fillText(d, 280, y); g.textAlign = "right"; g.fillText("JALUR " + j, 966, y); g.textAlign = "left";
    g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(40, y + 44, 944, 4);
  });
});
/** travel poster: mountain + train */
export const posterTex = (key: string, bg: string, title: string) => ctex("dtPoster" + key, 512, 720, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, 512, 720);
  g.fillStyle = "#ffd98a"; g.beginPath(); g.arc(360, 200, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3f7a52"; g.beginPath(); g.moveTo(0, 520); g.lineTo(170, 250); g.lineTo(300, 430); g.lineTo(390, 330); g.lineTo(512, 500); g.lineTo(512, 720); g.lineTo(0, 720); g.fill();
  g.fillStyle = "#2f5f3f"; g.fillRect(0, 520, 512, 200);
  g.fillStyle = "#f4efe2"; g.fillRect(60, 470, 300, 60); g.fillStyle = "#2d5fa8"; g.fillRect(60, 500, 300, 14);
  g.fillStyle = "#9fd4ff"; for (let i = 0; i < 5; i++) g.fillRect(78 + i * 56, 478, 36, 18);
  g.fillStyle = "#fffaf0"; g.textAlign = "center"; g.textBaseline = "middle";
  fitText(g, title, 256, 610, 440, 64, "900", "'Poppins', Arial, sans-serif");
  g.strokeStyle = INKC; g.lineWidth = 18; g.strokeRect(9, 9, 494, 702);
});
/** clerk's monitor: seat map of car 3 with seats 7A + 7B highlighted (the reveal) */
export const seatMapTex = () => ctex("dtSeatMap", 1024, 640, (g) => {
  g.fillStyle = "#e8f1fb"; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#2d5fa8"; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = "#ffffff"; g.textAlign = "left"; g.textBaseline = "middle";
  g.font = "900 46px 'Poppins', Arial, sans-serif"; g.fillText("GERBONG 3", 36, 50);
  g.textAlign = "right"; g.font = "800 38px 'Poppins', Arial, sans-serif"; g.fillText("2 TIKET", 990, 50);
  g.textAlign = "center";
  for (let c = 0; c < 9; c++) for (let rr = 0; rr < 4; rr++) {
    const x = 90 + c * 104, y = 170 + rr * 104 + (rr >= 2 ? 40 : 0);
    const hit = c === 6 && (rr === 0 || rr === 1);
    g.fillStyle = hit ? "#f6c445" : (c * 7 + rr * 3) % 5 === 0 ? "#b9c4d4" : "#ffffff";
    g.fillRect(x - 40, y - 40, 80, 80);
    g.lineWidth = hit ? 10 : 5; g.strokeStyle = hit ? "#d9382e" : "#6f7d93"; g.strokeRect(x - 40, y - 40, 80, 80);
    g.fillStyle = hit ? INKC : "#6f7d93"; g.font = `900 ${hit ? 34 : 26}px 'Poppins', Arial, sans-serif`;
    g.fillText(`${c + 1}${"ABCD"[rr]}`, x, y + 2);
  }
  g.strokeStyle = INKC; g.lineWidth = 20; g.strokeRect(10, 10, 1004, 620);
});
/** painted countryside seen from the train: sky band, volcano, rice paddies, palms, poles (tiles horizontally) */
export const landscapeTex = () => ctex("dtLandscape", 2048, 512, (g, r) => {
  const sky = g.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, "#5f9be0"); sky.addColorStop(1, "#cfe3f5");
  g.fillStyle = sky; g.fillRect(0, 0, 2048, 512);
  g.fillStyle = "#ffffff";
  for (let i = 0; i < 7; i++) { const x = r() * 2048, y = 50 + r() * 90; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + k * 34, y - (k % 2) * 14, 46, 26, 0, 0, Math.PI * 2); g.fill(); } }
  g.fillStyle = "#7d8fb8";
  g.beginPath(); g.moveTo(300, 300); g.lineTo(620, 120); g.lineTo(700, 120); g.lineTo(1050, 300); g.fill();
  g.beginPath(); g.moveTo(1300, 300); g.lineTo(1520, 170); g.lineTo(1780, 300); g.fill();
  g.fillStyle = "#68a04a"; g.fillRect(0, 290, 2048, 222);
  for (let y = 300; y < 512; y += 34) { g.fillStyle = y % 68 ? "#86bd5a" : "#5d9a43"; g.fillRect(0, y, 2048, 18); }
  g.fillStyle = "#9fd0e8"; for (let i = 0; i < 18; i++) g.fillRect(r() * 2048, 330 + r() * 160, 90 + r() * 120, 6);
  for (let i = 0; i < 14; i++) {
    const x = i * 146 + r() * 60, h = 90 + r() * 70;
    g.fillStyle = "#6e4a2e"; g.fillRect(x - 5, 300 - h, 10, h);
    g.fillStyle = i % 2 ? "#3f8a3c" : "#4d9a40";
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 30, 300 - h + Math.sin(a) * 10, 36, 10, a, 0, Math.PI * 2); g.fill(); }
  }
  g.fillStyle = INKC; for (let x = 60; x < 2048; x += 512) { g.fillRect(x, 170, 9, 180); g.fillRect(x - 28, 180, 64, 7); }
  g.strokeStyle = "rgba(36,23,38,0.7)"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 190); for (let x = 0; x <= 2048; x += 64) g.lineTo(x, 190 + 14 * Math.sin((x / 512) * Math.PI)); g.stroke();
});
/** parked train side: cream body, blue + red stripes, windows, door */
export const liveryTex = () => ctex("dtLivery", 2048, 512, (g) => {
  g.fillStyle = "#f2ede0"; g.fillRect(0, 0, 2048, 512);
  g.fillStyle = "#2d5fa8"; g.fillRect(0, 330, 2048, 52); g.fillStyle = "#d9382e"; g.fillRect(0, 390, 2048, 20);
  g.fillStyle = "#8f9aa8"; g.fillRect(0, 470, 2048, 42);
  for (let x = 40; x < 2048; x += 170) {
    if ((x / 170 | 0) % 6 === 2) { g.fillStyle = "#cfd6df"; g.fillRect(x, 90, 110, 380); g.strokeStyle = INKC; g.lineWidth = 8; g.strokeRect(x, 90, 110, 380); g.fillStyle = "#9fd4ff"; g.fillRect(x + 18, 120, 74, 120); continue; }
    g.fillStyle = "#2b3a55"; g.fillRect(x, 120, 130, 150);
    g.fillStyle = "#7fb6e0"; g.fillRect(x + 8, 128, 114, 60);
    g.strokeStyle = INKC; g.lineWidth = 8; g.strokeRect(x, 120, 130, 150);
  }
  g.fillStyle = INKC; g.fillRect(0, 0, 2048, 10); g.fillRect(0, 500, 2048, 12);
});
/** blue train seat fabric */
export const fabricTex = () => ctex("dtFabric", 256, 256, (g, r) => {
  g.fillStyle = "#2f5d9e"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 256, r() * 256, 3, 3); }
  g.strokeStyle = "rgba(246,196,69,0.35)"; g.lineWidth = 6; for (let y = 32; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
});

/** shared station props */
const bench3 = (b: Batch, x: number, z: number, ry: number, seatM: THREE.Material, metalM: THREE.Material) => {
  // three moulded seats on a steel beam, solid skirt in front so seated cards' feet read as tucked in
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (dx: number, dz: number): [number, number] => [x + dx * c + dz * s, z - dx * s + dz * c];
  for (const dx of [-0.62, 0, 0.62]) {
    let [px, pz] = P(dx, 0); box(b, 0.56, 0.08, 0.5, px, 0.46, pz, seatM, ry);
    [px, pz] = P(dx, -0.24); box(b, 0.56, 0.5, 0.07, px, 0.74, pz, seatM, ry, -0.12);
  }
  let [px, pz] = P(0, 0.02); box(b, 1.9, 0.38, 0.42, px, 0.22, pz, metalM, ry);
  [px, pz] = P(0, -0.05); box(b, 1.96, 0.05, 0.6, px, 0.42, pz, metalM, ry);
};
const lampPendant = (g: THREE.Group, b: Batch, x: number, y: number, z: number, shadeM: THREE.Material, bulbM: THREE.Material, len = 0.9) => {
  cyl(b, 0.012, 0.012, len, x, y + len / 2 + 0.12, z, shadeM, 6);
  b.add(new THREE.ConeGeometry(0.26, 0.2, 16, 1, true), shadeM, M4(x, y + 0.1, z));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), bulbM); bulb.position.set(x, y, z); bulb.layers.set(NOINK); g.add(bulb);
};

// =============================================================================================================
// SET 1: LOKET — the ticket hall. Counter front at z = -1.0 (customer side z > -1, clerk booth z < -1, floor +0.25).
// The father stands at (0, 0, -0.35); the clerk at (0, 0.25, -1.62) behind the window, legs hidden by the counter.
// =============================================================================================================
export const LOKET = { counterZ: -1.0, manZ: -0.35, clerkZ: -1.62, boothFloor: 0.25, monitor: V(0.62, 1.28, -1.36) };
export const buildLoketSet = () => {
  const g = new THREE.Group(), b = new Batch(), nb = new Batch(); // nb: architecture that receives but never casts shadows
  const floorM = lam("lkFloor", () => ({ map: rep(tileTex("lk", "#efe2c8", "#c9744f", "#5b3a2e"), 5, 5) }));
  const boothFloorM = lam("lkBoothFloor", () => ({ map: rep(planksHD(), 2, 1) }));
  const wallM = lam("lkWall", () => ({ map: rep(wallTex("lk", "#f3e6c9", "#4f7a6a"), 3, 1) }));
  const boothWallM = lam("lkBoothWall", () => ({ color: "#cfe0d6" }));
  const counterM = lam("lkCounter", () => ({ map: rep(beamHD(), 3, 1), color: "#d7a675" }));
  const panelM = lam("lkPanel", () => ({ color: "#2f6b5c" }));
  const frameM = lam("lkFrame", () => ({ color: "#6b4a34" }));
  const metalM = lam("lkMetal", () => ({ color: "#9aa3ad" }));
  const darkM = lam("lkDark", () => ({ color: "#2b2730" }));
  const seatM = lam("lkSeat", () => ({ color: "#d9573e" }));
  const potM = lam("lkPot", () => ({ color: "#b8643e" }));
  const leafM = lam("lkLeaf", () => ({ color: "#4c9a3f" }));
  const ropeM = lam("lkRope", () => ({ color: "#b8323a" }));
  const printerM = lam("lkPrinter", () => ({ color: "#e9e5dc" }));

  // floors + walls of the hall
  box(nb, 12, 0.3, 14, 0, -0.15, 2.0, floorM);
  box(b, 6.2, 0.25, 2.5, 0, 0.125, -2.25, boothFloorM);
  box(nb, 0.3, 4.2, 14, -4.3, 2.1, 2.0, wallM);
  box(nb, 0.3, 4.2, 14, 4.3, 2.1, 2.0, wallM);
  box(nb, 9, 4.2, 0.3, 0, 2.1, 7.2, wallM);
  box(nb, 9, 4.2, 0.25, 0, 2.1, -3.55, boothWallM);
  // ---- the counter: wood front, green panels, ledge, window mullions, header wall ----
  box(b, 6.0, 1.05, 0.3, 0, 0.525, -1.0, counterM);
  for (const px of [-2.2, -0.9, 0.9, 2.2]) box(b, 1.0, 0.62, 0.04, px, 0.52, -0.84, panelM);
  box(b, 6.2, 0.07, 0.62, 0, 1.085, -0.98, counterM);
  for (const px of [-3.0, -1.95, -0.66, 0.66, 1.95, 3.0]) box(b, 0.1, 1.22, 0.12, px, 1.72, -1.0, frameM);
  box(b, 6.1, 0.12, 0.16, 0, 2.36, -1.0, frameM);
  box(nb, 6.1, 1.5, 0.28, 0, 3.17, -1.0, wallM);
  box(b, 0.5, 0.05, 0.16, 0.2, 1.13, -0.86, darkM);               // ticket tray slot
  // neighbouring windows are closed with blinds
  for (const px of [-1.3, 1.3, -2.48, 2.48]) {
    const w = Math.abs(px) > 2 ? 0.95 : 1.2;
    box(b, w, 1.1, 0.04, px, 1.72, -1.02, lam("lkBlind", () => ({ map: rep(ctex("dtBlind", 64, 256, (gg) => { gg.fillStyle = "#d8cdb6"; gg.fillRect(0, 0, 64, 256); gg.fillStyle = "#a89a80"; for (let y = 0; y < 256; y += 16) gg.fillRect(0, y, 64, 3); }), 1, 4) })));
  }
  // ---- booth interior: clerk desk, monitor (screen faces the clerk = -z), ticket printer, back wall dressing ----
  box(b, 5.8, 0.07, 0.6, 0, 1.0, -1.42, counterM);
  box(b, 0.62, 0.42, 0.06, LOKET.monitor.x, LOKET.monitor.y, LOKET.monitor.z + 0.04, darkM);
  box(b, 0.1, 0.22, 0.1, LOKET.monitor.x, 1.1, LOKET.monitor.z + 0.06, darkM);
  box(b, 0.36, 0.2, 0.3, -0.55, 1.13, -1.42, printerM);
  box(b, 0.2, 0.02, 0.12, -0.55, 1.24, -1.3, lam("lkTicketOut", () => ({ color: "#fff6e2" })));
  box(b, 1.4, 1.0, 0.5, -2.0, 0.75, -3.15, frameM);                // filing cabinet
  box(b, 0.5, 0.06, 0.4, 1.9, 1.62, -3.3, frameM);                 // shelf
  cyl(b, 0.09, 0.09, 0.2, 1.75, 1.75, -3.3, lam("lkMug", () => ({ color: "#e2453c" })));
  // ---- customer hall: queue stanchions + rope, benches, plants ----
  for (const px of [-0.72, 0.72]) for (const pz of [0.35, 1.55, 2.75]) {
    cyl(b, 0.03, 0.03, 0.95, px, 0.48, pz, metalM, 8); cyl(b, 0.16, 0.16, 0.04, px, 0.02, pz, metalM, 14); b.add(new THREE.SphereGeometry(0.05, 10, 8), metalM, M4(px, 0.98, pz));
  }
  for (const px of [-0.72, 0.72]) for (const pz of [0.95, 2.15]) cyl(b, 0.022, 0.022, 1.2, px, 0.86, pz, ropeM, 6, Math.PI / 2);
  bench3(b, -3.55, 2.4, Math.PI / 2, seatM, metalM);
  bench3(b, 3.55, 3.4, -Math.PI / 2, seatM, metalM);
  for (const [px, pz] of [[-3.7, 0.0], [3.7, 0.6], [-3.7, 5.6]] as const) {
    cyl(b, 0.26, 0.2, 0.5, px, 0.25, pz, potM, 12);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.add(new THREE.SphereGeometry(0.22, 10, 8), leafM, M4(px + Math.cos(a) * 0.16, 0.78 + (i % 2) * 0.2, pz + Math.sin(a) * 0.16)); }
    b.add(new THREE.SphereGeometry(0.26, 10, 8), leafM, M4(px, 1.12, pz));
  }
  // entrance doors on the far wall (bright daylight beyond)
  for (const px of [-1.1, 1.1]) box(b, 0.16, 2.8, 0.36, px, 1.4, 7.0, frameM);
  box(b, 2.36, 0.16, 0.36, 0, 2.86, 7.0, frameM);
  b.build(g, true); nb.build(g, false);

  // signs & screens (unlit)
  plane(g, 1.7, 0.56, 0, 2.86, -0.855, sign("lkSign", () => label("loket", 1024, 336, "#2d5fa8", "#ffffff", [["LOKET 1", 150], ["TIKET KERETA API", 64]])));
  plane(g, 1.0, 0.3, -1.95, 2.72, -0.855, sign("lkSign2", () => label("info", 640, 192, "#f6c445", INKC, [["INFORMASI", 92]])));
  plane(g, 1.0, 0.3, 1.95, 2.72, -0.855, sign("lkSign3", () => label("tutup", 640, 192, "#d9382e", "#ffffff", [["LOKET 2 TUTUP", 80]])));
  plane(g, 0.62, 0.62, -1.1, 2.55, -3.41, sign("lkClock", () => clockTex(7, 5)));
  plane(g, 1.5, 0.94, 1.0, 2.35, -3.41, sign("lkJadwal", () => jadwalTex()));
  plane(g, 0.56, 0.36, LOKET.monitor.x, LOKET.monitor.y, LOKET.monitor.z - 0.001, sign("lkSeatMap", () => seatMapTex(), 1.05), Math.PI);
  plane(g, 0.9, 1.26, -4.14, 2.1, 1.6, sign("lkPoster1", () => posterTex("a", "#e98a4f", "JELAJAH JAWA")), Math.PI / 2);
  plane(g, 0.9, 1.26, 4.14, 2.1, 2.2, sign("lkPoster2", () => posterTex("b", "#4f8fc4", "NAIK KERETA")), -Math.PI / 2);
  plane(g, 0.9, 1.26, -4.14, 2.1, 4.2, sign("lkJadwalSide", () => jadwalTex()), Math.PI / 2);
  plane(g, 2.2, 2.66, 0, 1.33, 7.04, glow(1.35, 1.5, 1.6), Math.PI);   // daylight in the doorway
  plane(g, 1.4, 0.36, 0, 3.25, 6.98, sign("lkMasuk", () => label("masuk", 768, 200, "#2d5fa8", "#ffffff", [["PINTU MASUK", 96]])), Math.PI);
  // pendant lamps (motivated light: warm bulbs, bloom)
  const lb = new Batch(), shadeM = lam("lkLampShade", () => ({ color: "#2f6b5c" })), bulbM = glow(3.4, 2.6, 1.4);
  for (const [px, pz] of [[-1.6, 0.6], [1.6, 0.6], [-1.6, 3.4], [1.6, 3.4], [0, -2.3]] as const) lampPendant(g, lb, px, 3.0, pz, shadeM, bulbM, 1.0);
  lb.build(g, false);
  return g;
};

// =============================================================================================================
// SET 2: RUANG TUNGGU — waiting room with a glass wall onto the platform and a parked train.
// Bench seats (facing +z) at z = -0.9, seat x = -0.62 / 0 / +0.62, seat top y = 0.5.
// =============================================================================================================
export const TUNGGU = { benchZ: -0.9, seatY: 0.5 };
export const buildTungguSet = () => {
  const g = new THREE.Group(), b = new Batch(), nb = new Batch();
  const floorM = lam("tgFloor", () => ({ map: rep(tileTex("tg", "#dcd6c8", "#c8c0ae", "#6b6157"), 5, 5) }));
  const wallM = lam("tgWall", () => ({ map: rep(wallTex("tg", "#f1e3c4", "#b8643e"), 3, 1) }));
  const frameM = lam("tgFrame", () => ({ color: "#2f6b5c" }));
  const seatM = lam("tgSeat", () => ({ color: "#e08a2e" }));
  const metalM = lam("tgMetal", () => ({ color: "#8f98a3" }));
  const platM = lam("tgPlat", () => ({ map: rep(tileTex("pl", "#b9b3a6", "#aaa395", "#5f5a52"), 8, 2) }));
  const edgeM = lam("tgEdge", () => ({ color: "#f6c445" }));
  const trainM = lam("tgTrain", () => ({ map: rep(liveryTex(), 3, 1) }));
  const roofM = lam("tgRoof", () => ({ color: "#7d8a96" }));
  const ballastM = lam("tgBallast", () => ({ color: "#6d6258" }));
  const potM = lam("tgPot", () => ({ color: "#b8643e" }));
  const leafM = lam("tgLeaf", () => ({ color: "#4c9a3f" }));

  box(nb, 14, 0.3, 10, 0, -0.15, 2.0, floorM);
  // glass wall at z = -2.6: sill, mullions, transom
  box(b, 11, 0.8, 0.3, 0, 0.4, -2.6, wallM);
  for (let px = -5.4; px <= 5.41; px += 1.8) box(b, 0.14, 2.6, 0.18, px, 2.1, -2.6, frameM);
  box(b, 11, 0.16, 0.22, 0, 1.55, -2.6, frameM);
  box(nb, 11, 0.2, 0.24, 0, 3.4, -2.6, frameM);
  box(nb, 11, 0.9, 0.3, 0, 3.95, -2.6, wallM);
  box(nb, 0.3, 4.4, 10, -5.5, 2.2, 2.4, wallM);
  box(nb, 0.3, 4.4, 10, 5.5, 2.2, 2.4, wallM);
  box(nb, 11, 4.4, 0.3, 0, 2.2, 7.2, wallM);
  // outside: platform, yellow edge, tracks, parked train, canopy
  box(b, 40, 0.3, 3.0, 0, -0.15, -4.1, platM);
  box(b, 40, 0.04, 0.3, 0, 0.02, -5.45, edgeM);
  box(b, 40, 0.3, 4, 0, -1.05, -7.2, ballastM);
  for (const rz of [-6.6, -7.6]) box(b, 40, 0.12, 0.1, 0, -0.84, rz, metalM);
  box(b, 40, 3.1, 2.8, -2, 1.05, -7.1, trainM);
  box(b, 40, 0.3, 2.6, -2, 2.7, -7.1, roofM);
  box(nb, 40, 0.12, 5.2, 0, 3.75, -4.6, roofM);
  for (let px = -12; px <= 12; px += 4) cyl(b, 0.08, 0.08, 3.75, px, 1.87, -3.3, frameM, 10);
  // benches + plants
  bench3(b, 0, TUNGGU.benchZ, 0, seatM, metalM);
  bench3(b, -2.6, TUNGGU.benchZ, 0, seatM, metalM);
  bench3(b, 2.6, TUNGGU.benchZ, 0, seatM, metalM);
  bench3(b, -4.6, 2.2, Math.PI / 2, seatM, metalM);
  for (const [px, pz] of [[-1.35, -1.6], [1.35, -1.6], [4.8, 0.8]] as const) {
    cyl(b, 0.22, 0.17, 0.44, px, 0.22, pz, potM, 12);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; b.add(new THREE.SphereGeometry(0.2, 10, 8), leafM, M4(px + Math.cos(a) * 0.14, 0.68 + (i % 2) * 0.16, pz + Math.sin(a) * 0.14)); }
  }
  // hanging clock + departure board on rods
  for (const px of [1.55, 2.25]) cyl(b, 0.015, 0.015, 0.9, px, 3.55, -0.2, metalM, 6);
  box(b, 1.5, 0.94, 0.12, 1.9, 2.65, -0.2, frameM);
  b.build(g, true); nb.build(g, false);
  plane(g, 1.4, 0.86, 1.9, 2.65, -0.135, sign("tgJadwal", () => jadwalTex()));
  plane(g, 0.62, 0.62, -1.9, 2.75, 7.04, sign("tgClock", () => clockTex(7, 20)), Math.PI);
  plane(g, 0.9, 1.26, -5.34, 2.1, 0.6, sign("tgPoster1", () => posterTex("c", "#7a5ac9", "LIBURAN SERU")), Math.PI / 2);
  plane(g, 1.6, 0.34, 0, 3.95, -2.44, sign("tgSign", () => label("tunggu", 1024, 220, "#2d5fa8", "#ffffff", [["RUANG TUNGGU", 120]])));
  plane(g, 1.0, 0.3, 4.2, 0.72, -2.44, sign("tgJalur", () => label("jalur", 640, 192, "#f6c445", INKC, [["JALUR 2", 110]])));
  const lb = new Batch(), shadeM = lam("tgLampShade", () => ({ color: "#2f6b5c" })), bulbM = glow(3.4, 2.6, 1.4);
  for (const [px, pz] of [[-2.2, 0.4], [2.2, 0.4], [0, 2.8]] as const) lampPendant(g, lb, px, 3.1, pz, shadeM, bulbM, 1.1);
  lb.build(g, false);
  return g;
};

// =============================================================================================================
// SET 3: KERETA — inside the train car (runs along x). Seat pairs face +x; window seat z = -0.98, aisle seat z = -0.46,
// seat cushion top y = 0.5, backrest at x - 0.27. Row 7 (A window / B aisle) is at x = 0. Window wall at z = -1.42.
// =============================================================================================================
export const KERETA = { winZ: -0.98, aisleZ: -0.46, seatY: 0.5 };
export const buildKeretaSet = () => {
  const g = new THREE.Group(), b = new Batch(), nb = new Batch();
  const floorM = lam("krFloor", () => ({ color: "#6f6a73" }));
  const wallM = lam("krWall", () => ({ color: "#ece4d3" }));
  const lowM = lam("krLow", () => ({ color: "#2d5fa8" }));
  const seatM = lam("krSeat", () => ({ map: rep(fabricTex(), 1, 1) }));
  const coverM = lam("krCover", () => ({ color: "#f7f3ea" }));
  const frameM = lam("krFrame", () => ({ color: "#4a4f5a" }));
  const rackM = lam("krRack", () => ({ color: "#9aa3ad" }));
  const ceilM = lam("krCeil", () => ({ color: "#f4efe4" }));
  const curtainM = lam("krCurtain", () => ({ color: "#b8323a" }));

  const X0 = -9, X1 = 5, L = X1 - X0, XC = (X0 + X1) / 2;
  box(b, L, 0.2, 3.0, XC, -0.1, 0, floorM);
  box(b, L, 0.06, 0.5, XC, 0.005, -0.12, lam("krAisle", () => ({ color: "#8c3b4a" })));
  box(nb, L, 0.25, 3.2, XC, 2.5, 0, ceilM);
  // both side walls with window openings (windows 1.0 m wide every 1.05 m, sill 0.85, head 1.75)
  for (const side of [-1, 1]) {
    const z = side * 1.45;
    box(b, L, 0.85, 0.12, XC, 0.425, z, lowM);
    box(nb, L, 0.65, 0.12, XC, 2.07, z, wallM);
    for (let x = X0; x <= X1; x += 1.05) box(b, 0.16, 0.92, 0.14, x + 0.525, 1.3, z, wallM);
    box(b, L, 0.06, 0.24, XC, 0.88, z - side * 0.08, frameM);  // sill ledge
    box(nb, L, 0.04, 0.34, XC, 1.98, z - side * 0.22, rackM);   // luggage rack
    for (let x = X0 + 0.3; x <= X1; x += 1.05) box(b, 0.05, 0.03, 0.34, x, 1.95, z - side * 0.22, frameM);
    for (let x = X0; x <= X1; x += 1.05) box(b, 0.12, 0.9, 0.04, x + 0.42, 1.3, z - side * 0.09, curtainM); // tied curtains
  }
  // seat pairs; skip rows that would sit on top of the camera positions (x > 0.6 on the left side)
  const seatPair = (x: number, zs: number[]) => {
    for (const z of zs) {
      box(b, 0.46, 0.4, 0.46, x, 0.2, z, frameM);
      box(b, 0.52, 0.12, 0.48, x, 0.44, z, seatM);
      box(b, 0.12, 0.78, 0.48, x - 0.27, 0.9, z, seatM, 0, 0);
      box(b, 0.14, 0.2, 0.4, x - 0.27, 1.22, z, coverM);
      box(b, 0.42, 0.05, 0.06, x + 0.02, 0.62, z + (z === zs[0] ? -0.27 : 0.27), frameM); // armrest
    }
  };
  for (let x = 0; x >= X0 + 0.5; x -= 1.05) seatPair(x, [KERETA.winZ, KERETA.aisleZ]);
  for (let x = 0.52; x >= X0 + 0.5; x -= 1.05) seatPair(x, [0.98, 0.46].map((v) => v + 0.0));
  // bulkhead + door at the far end
  box(b, 0.15, 2.4, 3.0, X0, 1.2, 0, wallM);
  box(b, 0.17, 1.9, 0.8, X0 + 0.02, 0.95, -0.1, lam("krDoor", () => ({ color: "#9aa3ad" })));
  b.build(g, true); nb.build(g, false);
  // seat number plates above row 7 (between rack and window head) + light strips
  plane(g, 0.5, 0.16, 0.0, 1.84, -1.37, sign("krNo", () => label("no7", 512, 160, "#f7f3ea", INKC, [["7A  7B", 100]])));
  plane(g, 0.5, 0.16, -1.05, 1.84, -1.37, sign("krNo6", () => label("no6", 512, 160, "#f7f3ea", INKC, [["6A  6B", 100]])));
  const strip = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.16), glow(2.6, 2.5, 2.2));
  strip.position.set(XC, 2.36, -0.55); strip.layers.set(NOINK); g.add(strip);
  const strip2 = strip.clone(); strip2.position.z = 0.55; g.add(strip2);
  // scrolling countryside outside both window walls (offset animated in world.ts)
  const scenery: THREE.Texture[] = [];
  for (const side of [-1, 1]) {
    const t = landscapeTex().clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); t.needsUpdate = true; scenery.push(t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(36, 9), new THREE.MeshBasicMaterial({ map: t, fog: false }));
    m.position.set(XC, 1.6, side * 4.2); m.rotation.y = side < 0 ? 0 : Math.PI; m.layers.set(NOINK); g.add(m);
  }
  return { root: g, scenery };
};
