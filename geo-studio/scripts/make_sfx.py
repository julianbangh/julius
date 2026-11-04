"""Procedural sound effects for Geo Studio (no sample libraries needed).

Usage: python -I scripts/make_sfx.py  -> writes assets/sfx/*.wav (48 kHz stereo)
Every effect is synthesised from noise, oscillators and envelopes, so the files are
original and free to use.
"""
import os
import wave

import numpy as np

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sfx")
rng = np.random.default_rng(7)


def t(d):
    return np.arange(int(SR * d)) / SR


def lowpass(x, fc):
    # one-pole low-pass, applied twice
    a = np.exp(-2 * np.pi * fc / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        x = y
    return x


def lp_fast(x, fc):
    # FFT brick-ish low-pass with smooth roll-off (fast for long signals)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / fc) ** 4)
    return np.fft.irfft(X, len(x))


def bp_fast(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / hi) ** 4))
    return np.fft.irfft(X, len(x))


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def stereo(x, width=0.0, delay_ms=0.0):
    d = int(SR * delay_ms / 1000)
    r = np.concatenate([np.zeros(d), x])[: len(x)] if d else x
    l = x * (1 - width / 2) + r * width / 2
    rr = r * (1 - width / 2) + x * width / 2
    return np.stack([l, rr], 1)


def save(name, x):
    os.makedirs(OUT, exist_ok=True)
    if x.ndim == 1:
        x = stereo(x)
    x = np.clip(x, -1, 1)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    print(name, f"{len(x) / SR:.2f}s")


def reverb(x, decay=1.8, mix=0.35):
    n = int(SR * decay)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * decay / 6))
    ir = lp_fast(ir, 3500)
    y = np.fft.irfft(np.fft.rfft(np.concatenate([x, np.zeros(n)])) * np.fft.rfft(np.concatenate([ir, np.zeros(len(x))])), len(x) + n)
    y = norm(y, np.max(np.abs(x)))
    out = np.concatenate([x, np.zeros(n)]) * (1 - mix) + y * mix
    return out


def env(d, a, dec):
    tt = t(d)
    return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-tt / dec)


def nuke(d=7.5):
    tt = t(d)
    crack = rng.standard_normal(len(tt)) * np.exp(-tt / 0.08) * 1.0
    body = lp_fast(rng.standard_normal(len(tt)), 380) * np.minimum(1, tt / 0.03) * np.exp(-tt / 2.2) * 5
    sub = np.sin(2 * np.pi * (34 + 40 * np.exp(-tt / 0.5)) * tt) * np.minimum(1, tt / 0.02) * np.exp(-tt / 2.6) * 0.9
    rumble = lp_fast(rng.standard_normal(len(tt)), 120) * (np.exp(-tt / 3.5)) * 8 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * tt) ** 2)
    debris = bp_fast(rng.standard_normal(len(tt)), 1500, 6000) * np.exp(-((tt - 1.4) ** 2) / 0.8) * 0.12
    x = crack * 0.5 + norm(body) * 0.8 + sub + norm(rumble) * 0.7 + debris
    return stereo(norm(reverb(x, 2.5, 0.3), 0.95), 0.6, 9)


def boom(d=3.5, pitch=1.0):
    tt = t(d)
    crack = bp_fast(rng.standard_normal(len(tt)), 400, 9000) * np.exp(-tt / 0.05)
    body = lp_fast(rng.standard_normal(len(tt)), 700 * pitch) * np.exp(-tt / 0.6) * 4
    sub = np.sin(2 * np.pi * (48 * pitch + 60 * np.exp(-tt / 0.15)) * tt) * np.exp(-tt / 0.7)
    x = crack * 0.6 + norm(body) * 0.8 + sub * 0.8
    return stereo(norm(reverb(x, 1.6, 0.28), 0.92), 0.5, 6)


def impact(d=3.0):
    tt = t(d)
    sub = np.sin(2 * np.pi * (30 + 110 * np.exp(-tt / 0.09)) * tt) * np.exp(-tt / 0.9)
    hit = lp_fast(rng.standard_normal(len(tt)), 2500) * np.exp(-tt / 0.08) * 3
    x = sub + norm(hit) * 0.5
    return stereo(norm(reverb(x, 2.2, 0.35), 0.95), 0.5, 11)


def whoosh(d=1.4, peak=0.65, lo=300, hi=5000):
    tt = t(d)
    n = rng.standard_normal(len(tt))
    shape = np.exp(-((tt - d * peak) ** 2) / (2 * (d * 0.18) ** 2))
    # sweep by mixing two bands with moving balance
    a = bp_fast(n, lo, hi * 0.4)
    b = bp_fast(n, hi * 0.3, hi)
    bal = np.clip(tt / (d * peak), 0, 1)
    x = (a * (1 - bal) + b * bal) * shape
    pan = np.clip((tt / d) * 2 - 0.5, 0, 1)
    x = norm(x, 0.8)
    return np.stack([x * (1 - pan * 0.6), x * (0.4 + pan * 0.6)], 1)


def click(d=0.35):
    tt = t(d)
    x = np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt / 0.006) + np.sin(2 * np.pi * 420 * tt) * np.exp(-tt / 0.03) * 0.7
    x += bp_fast(rng.standard_normal(len(tt)), 2000, 8000) * np.exp(-tt / 0.004) * 0.4
    thunk = np.sin(2 * np.pi * (90 + 60 * np.exp(-tt / 0.02)) * tt) * np.exp(-tt / 0.06)
    return norm(x * 0.6 + thunk, 0.9)


def siren(d=4.5):
    tt = t(d)
    f = 520 + 300 * (0.5 - 0.5 * np.cos(2 * np.pi * tt / 2.2))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    x *= np.minimum(1, tt / 0.3) * np.minimum(1, (d - tt) / 0.6)
    return stereo(norm(reverb(x, 1.5, 0.4), 0.7), 0.7, 14)


def whistle(d=2.2):
    tt = t(d)
    f = 2400 * np.exp(-tt / d * 1.3) + 380
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.minimum(1, tt / 0.1) * (0.4 + 0.6 * tt / d)
    x += bp_fast(rng.standard_normal(len(tt)), 2000, 6000) * 0.05
    return norm(x, 0.6)


def pop(d=0.25):
    tt = t(d)
    f = 900 * np.exp(-tt / 0.03) + 300
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.05)
    return norm(x, 0.7)


def tick(d=0.06):
    tt = t(d)
    return norm(np.sin(2 * np.pi * 3200 * tt) * np.exp(-tt / 0.005) + bp_fast(rng.standard_normal(len(tt)), 3000, 9000) * np.exp(-tt / 0.002), 0.5)


def ticker(d=1.6, rate=18):
    x = np.zeros(int(SR * d))
    tk = tick()
    for i in range(int(d * rate)):
        s = int(i / rate * SR)
        x[s : s + len(tk)] += tk[: len(x) - s] * (0.6 + 0.4 * (i % 2))
    return norm(x, 0.55)


def phone(d=3.2):
    tt = t(d)
    bell = (np.sin(2 * np.pi * 1300 * tt) + np.sin(2 * np.pi * 1750 * tt) * 0.6) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 22 * tt)))
    gate = ((tt % 1.6) < 0.9).astype(float)
    x = bell * gate * np.minimum(1, (d - tt) / 0.1)
    return stereo(norm(reverb(lp_fast(x, 5000), 0.6, 0.2), 0.55), 0.3, 4)


def drain(d=5.0):
    tt = t(d)
    n = bp_fast(rng.standard_normal(len(tt)), 150, 1400)
    gurgle = 0.5 + 0.5 * np.sin(2 * np.pi * (3 + 2 * np.sin(2 * np.pi * 0.4 * tt)) * tt)
    x = n * gurgle * np.minimum(1, tt / 0.5) * np.minimum(1, (d - tt) / 1.0)
    return stereo(norm(x, 0.6), 0.8, 12)


def launch(d=2.4):
    tt = t(d)
    roar = bp_fast(rng.standard_normal(len(tt)), 200, 3500) * np.minimum(1, tt / 0.08) * np.exp(-tt / 1.0)
    sweep = whoosh(d, 0.45, 300, 6000)[:, 0]
    return stereo(norm(roar * 0.7 + sweep * 0.5, 0.85), 0.6, 8)


def riser(d=2.5):
    tt = t(d)
    n = rng.standard_normal(len(tt))
    x = np.zeros_like(tt)
    for k, (lo, hi) in enumerate([(200, 800), (800, 2500), (2500, 8000)]):
        x += bp_fast(n, lo, hi) * np.clip(tt / d * 3 - k, 0, 1)
    tone = np.sin(2 * np.pi * np.cumsum(200 + 600 * (tt / d) ** 2) / SR) * 0.3
    x = (norm(x) * 0.7 + tone) * (tt / d) ** 1.5
    return stereo(norm(x, 0.7), 0.6, 10)


def rumble(d=6.0):
    tt = t(d)
    x = lp_fast(rng.standard_normal(len(tt)), 90) * np.minimum(1, tt / 1.5) * np.minimum(1, (d - tt) / 1.5)
    return stereo(norm(x, 0.8), 0.7, 15)


def ship_horn(d=3.0):
    tt = t(d)
    f = 110
    x = sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 8)) * np.minimum(1, tt / 0.2) * np.minimum(1, (d - tt) / 0.5)
    return stereo(norm(reverb(lp_fast(x, 1200), 2.0, 0.4), 0.7), 0.5, 20)


def cash(d=1.2):
    tt = t(d)
    bell = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / dd) for f, dd in [(2093, 0.5), (2637, 0.4), (3136, 0.3)])
    drawer = bp_fast(rng.standard_normal(len(tt)), 300, 3000) * np.exp(-((tt - 0.05) ** 2) / 0.002) * 0.6
    return norm(bell * 0.5 + drawer, 0.7)


def jet(d=2.6):
    tt = t(d)
    n = rng.standard_normal(len(tt))
    roar = bp_fast(n, 250, 5000)
    shape = np.exp(-((tt - d * 0.45) ** 2) / (2 * (d * 0.16) ** 2))
    whine = np.sin(2 * np.pi * np.cumsum(2200 - 900 * (tt / d)) / SR) * 0.08
    x = norm(roar) * shape + whine * shape
    pan = np.clip(tt / d, 0, 1)
    x = norm(x, 0.85)
    return np.stack([x * (1 - pan * 0.7), x * (0.3 + pan * 0.7)], 1)


def gunfire(d=1.2, rate=14):
    x = np.zeros(int(SR * d))
    for i in range(int(d * rate)):
        st = int(i / rate * SR + rng.integers(0, 400))
        sh = boom(0.25, 4.0)[:, 0][: len(x) - st] * (0.6 + 0.4 * rng.random())
        x[st : st + len(sh)] += sh
    return stereo(norm(x, 0.8), 0.4, 3)


def sonar(d=2.5):
    tt = t(d)
    x = np.sin(2 * np.pi * 1350 * tt) * np.exp(-tt / 0.25) + 0.4 * np.sin(2 * np.pi * 1350 * (tt - 0.9)) * np.exp(-np.maximum(0, tt - 0.9) / 0.3) * (tt > 0.9)
    return stereo(norm(reverb(x, 2.0, 0.5), 0.6), 0.6, 18)


def glitch(d=1.0):
    x = np.zeros(int(SR * d))
    pos = 0
    while pos < len(x):
        L = int(SR * (0.02 + 0.08 * rng.random()))
        kind = rng.integers(0, 3)
        tt = np.arange(L) / SR
        if kind == 0: seg = np.sign(np.sin(2 * np.pi * rng.integers(80, 2000) * tt)) * 0.5
        elif kind == 1: seg = rng.standard_normal(L) * 0.6
        else: seg = np.round(np.sin(2 * np.pi * rng.integers(200, 900) * tt) * 4) / 4
        x[pos : pos + L] = seg[: len(x) - pos] * (rng.random() > 0.25)
        pos += L
    return stereo(norm(x, 0.55), 0.8, 7)


def torpedo(d=1.8):
    tt = t(d)
    x = lp_fast(rng.standard_normal(len(tt)), 600) * np.minimum(1, tt / 0.1) * np.exp(-tt / 1.2)
    bub = bp_fast(rng.standard_normal(len(tt)), 800, 3000) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * tt)) * 0.2
    return stereo(norm(x + bub, 0.7), 0.5, 9)


def ko(d=3.5):
    tt = t(d)
    x = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / dd) for f, dd in [(98, 2.2), (196, 1.6), (294, 1.1), (392, 0.8)])
    im = impact(d)[:, 0]; x[: len(im)] += im[: len(x)] * 0.8
    return stereo(norm(reverb(x, 2.5, 0.35), 0.95), 0.5, 12)


if __name__ == "__main__":
    save("nuke", nuke())
    save("boom", boom())
    save("boom_small", boom(2.0, 1.8))
    save("impact", impact())
    save("whoosh", whoosh())
    save("whoosh_fast", whoosh(0.7, 0.6))
    save("click", click())
    save("siren", siren())
    save("whistle", whistle())
    save("pop", pop())
    save("ticker", ticker())
    save("phone", phone())
    save("drain", drain())
    save("launch", launch())
    save("riser", riser())
    save("rumble", rumble())
    save("horn", ship_horn())
    save("cash", cash())
    save("jet", jet())
    save("gunfire", gunfire())
    save("sonar", sonar())
    save("glitch", glitch())
    save("torpedo", torpedo())
    save("ko", ko())
