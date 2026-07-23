#!/usr/bin/env python3
"""Bake one debate: per-speaker voices with optional pitch/rate (elder tuning).
   Bakes each post + each AI closer (summary+insight+advice as one segment)."""
import json, os, sys, hashlib, re, requests
from pathlib import Path

REPO = Path(os.path.expanduser("~/Desktop/repos/thinker-arena"))
KEY = os.environ["AZURE_SPEECH_KEY"]; REGION = os.environ["AZURE_SPEECH_REGION"]
ENDPOINT = f"https://{REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
VOICES = json.load(open("/tmp/voicemap.json"))
DEFAULT = {"voice": "zh-CN-XiaoxiaoMultilingualNeural"}

def cfg(key):
    v = VOICES.get(key, DEFAULT)
    return v if isinstance(v, dict) else {"voice": v}

def strip_md(t):
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"\*(.+?)\*", r"\1", t)
    t = re.sub(r"[（(][a-zA-Z ]+[)）]", "", t)
    return t.strip()

def esc(t): return t.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

def synth(c, text):
    voice = c["voice"]; lang = "-".join(voice.split("-")[:2])
    inner = esc(text)
    pitch, rate = c.get("pitch"), c.get("rate")
    if pitch or rate:
        attrs = (f' pitch="{pitch}"' if pitch else "") + (f' rate="{rate}"' if rate else "")
        inner = f'<prosody{attrs}>{inner}</prosody>'
    body = f'<speak version="1.0" xml:lang="{lang}"><voice name="{voice}">{inner}</voice></speak>'.encode()
    import time
    for attempt in range(4):
        try:
            r = requests.post(ENDPOINT, data=body, timeout=120, headers={
                "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"})
            if r.status_code == 200: return r.content
            if r.status_code not in (429, 500, 503): raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
        except requests.exceptions.RequestException:
            if attempt == 3: raise
        time.sleep(2 ** attempt)
    raise RuntimeError("retries exhausted")

slug = sys.argv[1]
d = json.load(open(REPO/f"debates/{slug}.json"))
outdir = REPO/"audio"/"debate"/slug; outdir.mkdir(parents=True, exist_ok=True)
manifest = {}

def bake(seg_id, c, text):
    text = strip_md(text)
    if not text: return
    # hash includes voice+pitch+rate so retuning produces a fresh file
    sig = c["voice"] + "|" + (c.get("pitch") or "") + "|" + (c.get("rate") or "") + "|" + text
    h = hashlib.sha1(sig.encode()).hexdigest()[:16]
    fp = outdir/f"{h}.mp3"
    if not fp.exists():
        fp.write_bytes(synth(c, text))
        tag = c["voice"].replace("zh-CN-","")[:20] + (f" {c.get('pitch','')}" if c.get('pitch') else "")
        print(f"  {seg_id:<12} {tag:<26} {len(text)}字")
    manifest[seg_id] = {"audio": f"audio/debate/{slug}/{h}.mp3", "voice": c["voice"]}

for p in d["posts"]:
    bake(p["id"], cfg(p["thinker"]), p["text"])

# AI closers: prefix each block with its section label so the three parts
# ("综述… 洞察… 给普通人的建议…") are audibly separated, not run together.
for s in d.get("summaries", []):
    ai = s.get("ai", "")
    c = cfg("_ai_" + ai)
    blocks = [("综述", s.get("summary","")), ("洞察", s.get("insight","")),
              ("给普通人的建议", s.get("advice",""))]
    text = "。".join(f"{lbl}。{body.strip().rstrip('。')}" for lbl, body in blocks if body and body.strip())
    bake("ai-" + ai, c, text)

# Closing hooks: each is a lingering question posed by one thinker; read it
# (and its answer, if any) in that thinker's voice.
def hook_text(hk):
    # question + answer's prose lead/tail; the table is visual, left unread.
    parts = [hk.get("text","")]
    ans = hk.get("answer")
    if isinstance(ans, dict):
        parts += [ans.get("lead",""), ans.get("tail","")]
    elif isinstance(ans, str):
        parts.append(ans)
    return "。".join(p.strip().rstrip("。") for p in parts if p and str(p).strip())

for i, hk in enumerate(d.get("hooks", [])):
    frm = hk.get("from", "")
    # a hook may be posed by an AI (e.g. "gpt") rather than a thinker
    c = cfg("_ai_" + frm) if ("_ai_" + frm) in VOICES else cfg(frm)
    bake("hook-%d" % i, c, hook_text(hk))

json.dump(manifest, open(outdir/"manifest.json","w"), ensure_ascii=False, indent=1)
# clean orphans
used = {v["audio"].split("/")[-1] for v in manifest.values()}
import glob
for f in glob.glob(str(outdir/"*.mp3")):
    if os.path.basename(f) not in used: os.remove(f)
print(f"✅ {len(manifest)} 段（含 3 AI 收尾）→ manifest.json")
