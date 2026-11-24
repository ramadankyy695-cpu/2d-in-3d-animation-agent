"""Build subtitle chunks (1-3 words) from the aligned VO word timings.
usage: python scripts/gen-subs.py "voice/Dua Tiket.words.json" src/videos/duatiket/subtitles.json"""
import json, sys
words = json.load(open(sys.argv[1], encoding="utf-8"))
chunks, cur = [], []
def flush():
    if cur: chunks.append({"text": " ".join(w["text"] for w in cur), "start": cur[0]["start"], "end": cur[-1]["end"]})
    cur.clear()
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    chars = sum(len(x["text"]) for x in cur)
    end_punct = w["text"][-1] in ',.?!"'
    if end_punct or not nxt or len(cur) >= 3 or chars >= 13 or (nxt and nxt["start"] - w["end"] > 0.3) \
       or (nxt and chars + len(nxt["text"]) > 16):
        flush()
# hold each chunk until the next one starts when the gap is short (no flicker), else 0.25 s tail
for a, b in zip(chunks, chunks[1:]):
    a["end"] = round(b["start"] if b["start"] - a["end"] < 0.45 else a["end"] + 0.25, 3)
chunks[-1]["end"] = round(chunks[-1]["end"] + 0.6, 3)
json.dump(chunks, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(chunks), "chunks;", " | ".join(c["text"] for c in chunks))
# guard: the subtitles must reproduce the VO script word for word
assert " ".join(c["text"] for c in chunks) == " ".join(w["text"] for w in words)
