"""Geo Studio voice aligner.

Usage: python -I engine/align.py videos/<slug> [--tempo 1.12]

Reads   videos/<slug>/audio/voice_raw.(mp3|wav) and videos/<slug>/script.txt
Writes  videos/<slug>/audio/voice.wav     (tempo-adjusted, trimmed, 48 kHz mono)
        videos/<slug>/timing.json         (per-word and per-line timings)

Timings come from faster-whisper word timestamps, matched back onto the
script's own words, so captions show the script's spelling ("$126",
"Tórshavn") rather than whatever the recogniser heard.
"""
import difflib
import json
import os
import re
import subprocess
import sys


def norm(w):
    w = w.lower().replace("’", "'")
    w = re.sub(r"[^a-z0-9%$']+", "", w)
    return w


NUM_WORDS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "twenty": "20", "hundred": "100",
}


def main():
    vdir = sys.argv[1].rstrip("/")
    tempo = 1.0
    if "--tempo" in sys.argv:
        tempo = float(sys.argv[sys.argv.index("--tempo") + 1])
    adir = os.path.join(vdir, "audio")
    raw = next(
        os.path.join(adir, f)
        for f in ("voice_raw.wav", "voice_raw.mp3", "voice_raw.m4a")
        if os.path.exists(os.path.join(adir, f))
    )
    out = os.path.join(adir, "voice.wav")
    maxpause = 0.32
    if "--maxpause" in sys.argv:
        maxpause = float(sys.argv[sys.argv.index("--maxpause") + 1])
    af = []
    if maxpause > 0:
        # shorten every pause longer than maxpause down to maxpause
        af.append(f"silenceremove=stop_periods=-1:stop_duration={maxpause}:"
                  f"stop_threshold=-42dB:stop_silence={maxpause}")
    if abs(tempo - 1.0) > 1e-3:
        af.append(f"atempo={tempo}")
    # trim leading silence, keep a 0.15 s lead-in
    af.append("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", raw, "-af", ",".join(af),
         "-ar", "48000", "-ac", "1", out],
        check=True,
    )

    from faster_whisper import WhisperModel

    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    script_lines = [l.strip() for l in open(os.path.join(vdir, "script.txt")) if l.strip()]
    prompt = " ".join(script_lines)[:800]
    import numpy as np

    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", out, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
    segs, _ = model.transcribe(audio, word_timestamps=True, initial_prompt=prompt, beam_size=5)
    heard = []
    for s in segs:
        for w in s.words:
            heard.append((w.word.strip(), w.start, w.end))

    # script tokens
    toks = []
    for li, line in enumerate(script_lines):
        for w in line.split():
            toks.append({"w": w, "line": li})
    a = [norm(t["w"]) for t in toks]
    b = [norm(h[0]) for h in heard]
    b = [NUM_WORDS.get(x, x) for x in b]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    times = [None] * len(toks)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            h = heard[blk.b + k]
            times[blk.a + k] = (h[1], h[2])
    # fuzzy fill for single replaced tokens (e.g. "65,000" vs "65000")
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "replace" and i2 - i1 > 0 and j2 - j1 > 0:
            s0, e0 = heard[j1][1], heard[j2 - 1][2]
            n = i2 - i1
            for k in range(n):
                times[i1 + k] = (s0 + (e0 - s0) * k / n, s0 + (e0 - s0) * (k + 1) / n)
    # interpolate unmatched tokens between neighbours
    n = len(toks)
    for i in range(n):
        if times[i] is None:
            j = i
            while j < n and times[j] is None:
                j += 1
            prev_e = times[i - 1][1] if i > 0 else 0.0
            next_s = times[j][0] if j < n else (heard[-1][2] if heard else prev_e + 0.4)
            cnt = j - i
            for k in range(cnt):
                s = prev_e + (next_s - prev_e) * k / cnt
                e = prev_e + (next_s - prev_e) * (k + 1) / cnt
                times[i + k] = (s, e)
    # repair lines whose words were crushed together (recogniser skipped them):
    # spread them over the gap between neighbouring lines by character length
    nlines = len(script_lines)
    for li in range(nlines):
        idx = [i for i, t in enumerate(toks) if t["line"] == li]
        crushed = sum(1 for i in idx if times[i][1] - times[i][0] < 0.07)
        if crushed < max(2, 0.3 * len(idx)):
            continue
        prev = [times[i][1] for i, t in enumerate(toks) if t["line"] == li - 1]
        nxt = [times[i][0] for i, t in enumerate(toks) if t["line"] == li + 1]
        a = (max(prev) + 0.3) if prev else 0.1
        b = (min(nxt) - 0.35) if nxt else times[idx[-1]][1]
        lens = [len(toks[i]["w"]) + 2 for i in idx]
        tot, acc = sum(lens), 0
        for i, L in zip(idx, lens):
            s0 = a + (b - a) * acc / tot
            acc += L
            times[i] = (s0, a + (b - a) * acc / tot)
        print(f"  repaired line {li}: spread {len(idx)} words over {a:.2f}-{b:.2f}")
    words = []
    for t, (s, e) in zip(toks, times):
        words.append({"w": t["w"], "s": round(s, 3), "e": round(max(e, s + 0.05), 3), "line": t["line"]})
    lines = []
    for li, text in enumerate(script_lines):
        ws = [w for w in words if w["line"] == li]
        lines.append({"i": li, "text": text, "s": ws[0]["s"], "e": ws[-1]["e"]})
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
        capture_output=True, text=True, check=True).stdout.strip())
    matched = sum(1 for blk in sm.get_matching_blocks() for _ in range(blk.size))
    json.dump({"duration": dur, "tempo": tempo, "words": words, "lines": lines,
               "heard": " ".join(h[0] for h in heard)},
              open(os.path.join(vdir, "timing.json"), "w"), indent=1, ensure_ascii=False)
    print(f"{vdir}: {dur:.2f}s, {len(words)} words, {matched} matched exactly")
    for l in lines:
        print(f"  [{l['s']:6.2f} - {l['e']:6.2f}] {l['text'][:70]}")


if __name__ == "__main__":
    main()
