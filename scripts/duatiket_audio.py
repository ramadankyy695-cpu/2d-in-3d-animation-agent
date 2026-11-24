"""Soundtrack of "Dia Selalu Membeli Dua Tiket" built with the skill's own DSP kit (skill/templates/audio: dsp.py,
instruments.py, sfx_gen.py). Picture timing mirrored from src/videos/duatiket/story.ts + cast.ts (frame / 30).
Voice = the delivered VO, gain only. Music = original gentle score (music box, plucked strings, vibes, glock, warm pad)
ducked under speech. SFX = station / train ambience + foley. Master -15 LUFS integrated, true peak <= -1.5 dBTP,
exactly 55.000 s, 48 kHz stereo 24-bit.
usage: python scripts/duatiket_audio.py  ->  public/duatiket_mix.wav, out/duatiket/audio/{stems, cues.md}"""
import os, sys, json
import numpy as np
from scipy import ndimage, signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "skill", "templates", "audio"))
from dsp import (SR, TAU, ns, tt, dbg, rng, lp, hp, bp, colored, smooth_noise, ramp, fades, modal, pan, st, place, widen,
                 make_ir, convolve_st, integrated, true_peak, momentary, read_wav, write_wav)
from instruments import m2f, musicbox, pluck, vibes, glock, pad
from sfx_gen import whoosh, babble, stroll_step

FPS, TOTAL = 30, 1650
DUR = TOTAL / FPS
N = ns(DUR)
F = lambda f: f / FPS
OUT = os.path.join(ROOT, "out", "duatiket", "audio")
os.makedirs(OUT, exist_ok=True)
CUES = []
def cue(t, name, note=""):
    CUES.append((t, name, note))

# ------------------------------------------------------------------ picture timeline (mirrors story.ts)
SHOTS = [(0, 120, "loket"), (120, 180, "tunggu"), (180, 250, "loket"), (250, 432, "loket"), (432, 556, "loket"),
         (556, 646, "loket"), (646, 792, "loket"), (792, 862, "tunggu"), (862, 952, "loket"), (952, 1062, "kereta"),
         (1062, 1182, "loket"), (1182, 1288, "loket"), (1288, 1334, "loket"), (1334, 1400, "tunggu"),
         (1400, 1534, "kereta_fb"), (1534, 1650, "loket")]
XFADE = {2: 8, 7: 12, 8: 8, 10: 10, 11: 12, 14: 8, 16: 10}
smooth01 = lambda u: (lambda x: x * x * (3 - 2 * x))(min(1, max(0, u)))
lerp = lambda a, b, t: a + (b - a) * t
walkX2 = lambda f: lerp(-2.6, 0.9, (f - 112) / 72)
walkX7 = lambda f: lerp(2.9, 0.5, smooth01((f - 684) / 70))
walkX14 = lambda f: lerp(2.4, -1.2, (f - 1326) / 78)

def footfalls(xf, f0, f1, x0, stride):
    """frames where the walk phase crosses a half cycle (cast.ts: phase = |x - x0| / (2 * stride)); one step per stride"""
    out, last = [], None
    for f in np.arange(f0, f1, 0.25):
        k = int(abs(xf(f) - x0) / stride + 1e-9)
        if last is not None and k != last: out.append(f)
        last = k
    return out

def set_env(kind):
    """0..1 envelope over the timeline for every shot of a set, with crossfades"""
    t = np.arange(N) / SR
    e = np.zeros(N)
    for i, (a, b, k) in enumerate(SHOTS, 1):
        if k != kind: continue
        xa, xb = XFADE.get(i, 0), XFADE.get(i + 1, 0)
        e = np.maximum(e, np.clip(np.minimum((t - F(a - xa / 2)) / max(F(xa), 0.05) , (F(b + xb / 2) - t) / max(F(xb), 0.05)), 0, 1))
    return e

# ------------------------------------------------------------------ voice
def load_voice():
    x, sr = read_wav(os.path.join(ROOT, "voice", "Dua Tiket.wav"))
    v = x.mean(0)
    if sr != SR:
        g = np.gcd(SR, sr); v = signal.resample_poly(v, SR // g, sr // g)
    out = np.zeros(N); out[: min(N, len(v))] = v[:N]
    return st(out)

WORDS = json.load(open(os.path.join(ROOT, "voice", "Dua Tiket.words.json"), encoding="utf-8"))
def speech_spans(merge=0.3):
    sp = []
    for w in WORDS:
        s, e = w["start"], w["end"]
        if sp and s - sp[-1][1] < merge: sp[-1][1] = max(sp[-1][1], e)
        else: sp.append([s, e])
    return sp

def duck_curve(depth=-3.5, pre=0.08, post=0.15, att=0.07, rel=0.5):
    ctrl = 1000; nc = int(DUR * ctrl) + 2
    va = np.zeros(nc)
    for s, e in speech_spans(): va[max(0, int((s - pre) * ctrl)): int((e + post) * ctrl)] = 1
    ka, kr = 1 - np.exp(-1 / (att * ctrl)), 1 - np.exp(-1 / (rel * ctrl))
    env = np.zeros(nc); e = 0.0
    for i in range(nc):
        e += (va[i] - e) * (ka if va[i] > e else kr); env[i] = e
    return np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, depth * env)

# ------------------------------------------------------------------ SFX + ambience
def hall_tone(r):
    """station hall room tone: brown rumble + air + far murmur through a big-room reverb"""
    room = lp(colored(N, r, 2.0), 260) * 0.5 + hp(lp(colored(N, r, 1.0), 2500), 300) * 0.06
    room *= 1 + 0.25 * smooth_noise(N, r, 0.2)
    mur = np.zeros(N)
    for k in range(6):
        b = babble(DUR, rng(100 + k), base=r.uniform(95, 230), scale=r.uniform(0.9, 1.2), rate=4.0, active=0.55)
        mur += lp(b, 2200) * r.uniform(0.5, 1.0)
    ir = make_ir(1.9, 7, hf=1.4)
    wet = convolve_st(mur / (np.std(mur) + 1e-9), ir)
    return st(room) + 0.11 * wet

def pa_chime(r, t0):
    """station announcement chime: three soft vibraphone notes in a big hall"""
    y = np.zeros(ns(4.0))
    for i, m in enumerate([76, 72, 79]):
        v = vibes(m2f(m), 0.6, r, dur=2.6, trem_depth=0.12)
        i0 = ns(i * 0.42); y[i0:i0 + len(v)] += v[: len(y) - i0]
    wet = convolve_st(y, make_ir(2.2, 3, hf=1.2))
    cue(t0, "PA chime (station)", "vibes E5 C5 G5 + hall")
    return 0.35 * st(y) + 0.9 * wet

def train_hum(r):
    """parked train idling beyond the glass: low motor harmonics + compressor chug"""
    t = np.arange(N) / SR
    y = sum(np.sin(TAU * f * t + r.uniform(0, TAU)) / k for k, f in enumerate([58, 116, 174, 232], 1))
    y = y * (0.8 + 0.2 * np.sin(TAU * 0.7 * t)) + 0.3 * lp(colored(N, r, 1.5), 400)
    return st(lp(y, 600))

def horn(r, t0, dur=1.3):
    """distant two-tone train horn (homeward train) in open air"""
    t = tt(dur)
    env = np.clip(t / 0.08, 0, 1) * np.clip((dur - t) / 0.25, 0, 1)
    y = np.zeros_like(t)
    for f in (311.1, 370.0):
        for k in range(1, 8):
            y += np.sin(TAU * f * k * t + r.uniform(0, TAU)) / k ** 1.3
    y = lp(y * env, 1800)
    cue(t0, "distant train horn", "two-tone 311/370 Hz")
    return convolve_st(y, make_ir(2.6, 11, hf=1.6)) * 0.6 + 0.25 * st(y)

def train_ride(r):
    """inside the moving car: rumble, rail-joint clacks every 1.05 s (pairs), faint window rattle"""
    t = np.arange(N) / SR
    rum = lp(colored(N, r, 2.0), 170) * (1 + 0.2 * np.sin(TAU * 0.35 * t)) + 0.25 * bp(colored(N, r, 1.0), 300, 900)
    y = rum * 0.6
    clk = np.zeros(N)
    tc = 0.3
    while tc < DUR:
        for dt in (0.0, 0.13):
            c = modal(0.25, [(r.uniform(70, 90), 1.0, 0.05), (r.uniform(180, 240), 0.5, 0.03), (r.uniform(900, 1300), 0.15, 0.01)], r)
            i = ns(tc + dt); j = min(N, i + len(c))
            if j > i: clk[i:j] += c[: j - i] * r.uniform(0.7, 1.0)
        tc += 1.05
    rat = hp(colored(N, r, 0.5), 2500) * (0.5 + 0.5 * smooth_noise(N, r, 3)) * 0.03
    return widen(y + 0.9 * clk + rat, r, 9, 0.7)

def printer(r, t0):
    d = 0.7; t = tt(d)
    buzz = signal.sawtooth(TAU * 118 * t) * 0.3 + bp(r.standard_normal(len(t)), 800, 3000) * 0.5
    buzz *= np.clip(t / 0.02, 0, 1) * np.clip((0.55 - t) / 0.03, 0, 1)
    tear = np.zeros_like(t); a = ns(0.56)
    tl = ns(0.12); nz = bp(r.standard_normal(tl), 1200, 7000) * (0.5 + 0.5 * (r.uniform(size=tl) > 0.6))
    tear[a:a + tl] = nz * np.exp(-np.arange(tl) / SR / 0.05) * 1.4
    cue(t0, "ticket printer buzz + tear")
    return lp(buzz, 4000) * 0.5 + tear

def paper(r, t0, dur=0.25, gain=1.0):
    t = tt(dur); y = bp(r.standard_normal(len(t)), 1500, 8000) * np.sin(np.pi * t / dur) ** 2
    cue(t0, "ticket paper swish")
    return y * 0.6 * gain

def step_tile(r, gain=1.0):
    s = stroll_step(r, 0.3)
    t = tt(0.3)
    s = s + bp(r.standard_normal(len(t)), 2000, 6000) * np.exp(-t / 0.004) * 0.5   # hard heel on tiles
    return hp(s, 70) * gain

def thump(r, g=1.0):
    t = tt(0.35)
    y = np.sin(TAU * (55 + 40 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.12)
    return y * g

def pop(r, up=True):
    t = tt(0.22)
    f = 380 * (1 + (1.2 if up else -0.4) * (1 - np.exp(-t / 0.05)))
    y = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.07) + 0.2 * hp(r.standard_normal(len(t)), 3000) * np.exp(-t / 0.003)
    return y * 0.6

def beep(f0=1250, n=2, gap=0.12, d=0.07):
    out = np.zeros(ns(n * gap + d + 0.05))
    for i in range(n):
        t = tt(d); b = np.sin(TAU * f0 * t) * np.clip(t / 0.004, 0, 1) * np.clip((d - t) / 0.01, 0, 1)
        out[ns(i * gap): ns(i * gap) + len(b)] += b
    return out * 0.35

def shimmer(r, notes, step=0.07, vel=0.5, inst=glock):
    y = np.zeros(ns(len(notes) * step + 2.2))
    for i, m in enumerate(notes):
        g = inst(m2f(m), vel, r, dur=2.0); i0 = ns(i * step); y[i0:i0 + len(g)] += g[: len(y) - i0]
    return y

def build_sfx():
    r = rng(2024)
    sfx = np.zeros((2, N))
    amb = np.zeros((2, N))
    # ambience beds per set
    e_hall = np.maximum(set_env("loket"), set_env("tunggu"))
    amb += hall_tone(r) * (0.55 + 0.45 * e_hall)[None, :] * e_hall[None, :]
    amb += 0.18 * train_hum(r) * set_env("tunggu")[None, :]
    ride = train_ride(r)
    amb += ride * (set_env("kereta") + 0.55 * set_env("kereta_fb"))[None, :]
    place(amb, pa_chime(r, F(8)), F(8), 0.55)
    place(amb, pa_chime(r, F(652)), F(652), 0.45)                    # "Tapi keesokan harinya": a new morning
    place(amb, horn(r, F(1345)), F(1345), 0.5)                        # daughter heading home alone
    # foley
    place(sfx, printer(r, F(56)), F(56), 0.8); place(sfx, paper(r, F(70)), F(70))
    place(sfx, printer(r, F(752)), F(752), 0.8); place(sfx, paper(r, F(766)), F(766))
    place(sfx, printer(r, F(1092)), F(1092), 0.8); place(sfx, paper(r, F(1104), gain=0.8), F(1104))
    for f in footfalls(walkX2, 112, 186, -2.6, 0.725):
        place(sfx, pan(step_tile(r, 0.55), -0.2 + 0.4 * (walkX2(f) + 2.6) / 3.5), F(f)); cue(F(f), "footstep (father, waiting room)")
    for f in footfalls(walkX7, 684, 760, 2.9, 0.725):
        place(sfx, pan(step_tile(r, 0.45), 0.5 * (walkX7(f) - 0.5) / 2.4), F(f)); cue(F(f), "footstep (father walks to the window)")
    for f in footfalls(walkX14, 1326, 1404, 2.4, 0.6):
        place(sfx, pan(step_tile(r, 0.4), 0.3 * walkX14(f) / 2.4), F(f)); cue(F(f), "footstep (daughter, light)")
    # camera grammar: whooshes on hard cuts, soft thumps on the kicks, the flashes
    for f, g in [(95, 0.5), (333, 0.45), (905, 0.5), (1140, 0.5), (46, 0.3), (744, 0.3), (1006, 0.3)]:
        place(sfx, widen(whoosh(0.6, r, peak=0.12, tail=0.2), r), F(f) - 0.1, g); cue(F(f), "whoosh (camera move/cut)")
    for f, g in [(95, 0.6), (333, 0.6), (622, 0.7), (777, 0.5), (928, 0.7), (1018, 0.5), (1158, 0.9), (1256, 0.6), (1499, 0.5)]:
        place(sfx, thump(r, g), F(f)); cue(F(f), "soft impact thump (kick)")
    place(sfx, widen(shimmer(r, [84, 88, 91, 96]), r), F(176), 0.45); cue(F(176), "white flash shimmer (glock C6-C7)")
    place(sfx, widen(shimmer(r, [96, 91, 88, 84, 79], 0.09, 0.45, musicbox), r), F(1394), 0.55); cue(F(1394), "flashback shimmer (music box, falling)")
    for f in (395, 872, 1256):
        place(sfx, pop(r), F(f)); cue(F(f), "comic '?' pop")
    place(sfx, beep(), F(908)); cue(F(908), "monitor beeps (seat map)")
    place(sfx, beep(1650, 1), F(928)); cue(F(928), "seat highlight blip")
    place(sfx, widen(shimmer(r, [91, 95, 98, 103], 0.06, 0.4, musicbox), r), F(1499), 0.5); cue(F(1499), "brave sparkle")
    return sfx, amb

# ------------------------------------------------------------------ original score (A minor -> C major)
CHORDS = [(0.0, "Am"), (3.33, "F"), (6.67, "C"), (10.0, "G"), (13.33, "Am"), (16.67, "F"), (20.0, "Gsus"), (21.6, "C"),
          (25.0, "G"), (28.3, "Dm"), (31.3, "Esus"), (32.3, "E"), (33.3, "Am"), (35.5, "F"), (38.8, "C"), (42.1, "G"),
          (44.4, "Am"), (46.6, "F"), (48.6, "G"), (50.0, "Esus"), (50.6, "E"), (51.2, "C"), (DUR, None)]
CH = {"Am": [57, 60, 64], "F": [53, 57, 60], "C": [48, 55, 60, 64], "G": [55, 59, 62], "Gsus": [55, 60, 62], "Dm": [50, 57, 62, 65],
      "Esus": [52, 57, 59], "E": [52, 56, 59], "Em": [52, 55, 59]}
MEL = {"Am": [76, 72, 71, 72], "F": [77, 76, 72, 69], "C": [79, 76, 74, 72], "G": [74, 71, 74, 79], "Gsus": [74, 72, 74, None],
       "Dm": [77, 74, 72, 74], "Esus": [76, None, None, None], "E": [75, 76, None, None], "Em": [79, 76, 71, 76]}

def build_music():
    r = rng(77)
    mus = np.zeros((2, N))
    beat = 60 / 72
    for (t0, name), (t1, _) in zip(CHORDS, CHORDS[1:]):
        if name is None: break
        dur = t1 - t0
        notes = CH[name]
        # warm pad (fills more in the flashback and the ending)
        warm = 1.0 if t0 < 46.5 else 1.6
        place(mus, pad([m2f(m) for m in notes], dur + 0.4, 0.22 * warm, r, att=0.5, rel=0.8, warm=700), t0)
        # bass note
        place(mus, pan(pluck(m2f(notes[0] - 12), 0.5, r, dur=min(2.5, dur + 0.5), bright=0.2), -0.1), t0)
        # plucked arpeggio in eighths (thins out under the quiet answer 42-46 s)
        arp = [notes[0], notes[1], notes[-1] + (12 if len(notes) < 4 else 0), notes[1]]
        k, t = 0, t0
        while t < t1 - 0.05:
            if not (42.1 <= t < 46.6) or k % 2 == 0:
                place(mus, pan(pluck(m2f(arp[k % 4] + 12), 0.28, r, dur=0.8, bright=0.4), 0.3 * ((k % 4) - 1.5) / 1.5), t)
            k += 1; t += beat / 2
        # music-box melody on beats 1..4 (two notes per bar), skipping the busiest dialogue
        for i, m in enumerate(MEL[name]):
            tm = t0 + i * beat
            if m is None or tm >= t1 - 0.1: continue
            if 11.0 <= tm < 14.4 or 39.2 <= tm < 42.4: continue
            inst = vibes if t0 >= 46.5 else musicbox
            place(mus, pan(inst(m2f(m), 0.42, r, dur=1.8), 0.15), tm)
    # resolution on "Sekarang dia sudah besar": glock + vibes C-major arpeggio up, long tail into the end
    for i, m in enumerate([72, 76, 79, 84, 88]):
        place(mus, pan(glock(m2f(m), 0.35, r, dur=2.6), -0.3 + 0.15 * i), 51.2 + i * 0.16)
    place(mus, pad([m2f(m) for m in [48, 55, 60, 64, 67]], DUR - 51.2 - 0.6, 0.3, r, att=1.0, rel=1.2, warm=900), 51.2)
    ir = make_ir(1.6, 21, hf=1.1)
    mus = 0.82 * mus + 0.35 * convolve_st(mus, ir)
    return mus

# ------------------------------------------------------------------ mix
def limiter(x, ceil_db=-1.6):
    c = dbg(ceil_db)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    n = x.shape[1]
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    g = ndimage.minimum_filter1d(gr, 2 * ns(0.003) + 1)
    # release: smooth upward only
    g = np.minimum(g, ndimage.uniform_filter1d(ndimage.minimum_filter1d(g, ns(0.05)), ns(0.03)))
    return x * g[None, :]

def lufs(x):
    v = integrated(x); return v if np.isfinite(v) else -99.0

def main():
    v = load_voice()
    sfx, amb = build_sfx()
    mus = build_music()
    Lv = lufs(v)
    speech = np.zeros(N, bool)
    for s, e in speech_spans(): speech[ns(s): ns(e)] = True
    # music bed: -10 LU under the voice while it speaks ("music +3 dB" standard), ducked -3.5 dB on words,
    # +3 dB swell for the flashback / reveal, opens up after the last word
    Lm = integrated(mus[:, speech]) if speech.any() else lufs(mus)
    mus *= dbg(Lv - 10.0 - Lm)
    auto = duck_curve()
    t = np.arange(N) / SR
    auto += 3.0 * np.clip((t - 46.4) / 0.8, 0, 1) + 2.5 * np.clip((t - 52.5) / 0.8, 0, 1)
    auto += np.where(t > DUR - 1.6, 20 * np.log10(np.clip((DUR - t) / 1.6, 1e-4, 1)), 0)
    mus *= dbg(auto)[None, :]
    # SFX: foley at voice -14 LU, ambience bed at voice -20 LU ("SFX -6 dB" standard)
    sfx *= dbg(Lv - 14.0 - lufs(sfx)); amb *= dbg(Lv - 20.0 - lufs(amb))
    amb *= np.clip((DUR - t) / 1.6, 0, 1)[None, :] ** 1.5
    fx = sfx + amb
    mix = v + mus + fx
    g = dbg(-15.0 - lufs(mix))
    mix = limiter(mix * g)
    mix *= dbg(-15.0 - lufs(mix))
    mix = limiter(mix)
    mix = fades(mix, 0.002, 0.05)
    write_wav(os.path.join(ROOT, "public", "duatiket_mix.wav"), mix)
    for name, x in [("voice", v), ("music", mus), ("sfx", fx)]:
        write_wav(os.path.join(OUT, f"stem_{name}.wav"), x * g)
    rep = {"integrated_LUFS": round(lufs(mix), 2), "true_peak_dBTP": round(true_peak(mix), 2), "duration_s": mix.shape[1] / SR,
           "voice_LUFS_in_mix": round(lufs(v * g), 2), "music_vs_voice_LU": round(integrated((mus * g)[:, speech]) - lufs(v * g), 1),
           "sfx_vs_voice_LU": round(lufs(fx * g) - lufs(v * g), 1)}
    with open(os.path.join(OUT, "cues.md"), "w", encoding="utf-8") as fo:
        fo.write("# Dia Selalu Membeli Dua Tiket - sound cues\n\n")
        fo.write("Loudness: " + json.dumps(rep) + "\n\n| time (s) | frame | cue | note |\n|---|---|---|---|\n")
        for tc, nm, note in sorted(CUES):
            fo.write(f"| {tc:6.2f} | {round(tc * FPS)} | {nm} | {note} |\n")
        fo.write("\n## Music map\n" + "\n".join(f"- {a:5.2f} s {n}" for a, n in CHORDS if n) + "\n")
    print(json.dumps(rep))

if __name__ == "__main__":
    main()
