#!/usr/bin/env python3
"""Bake one debate: per-speaker voices with optional pitch/rate (elder tuning).
   Bakes each post + each AI closer (summary+insight+advice as one segment)."""
import json, os, sys, hashlib, re, requests
from pathlib import Path

REPO = Path(os.path.expanduser("~/Desktop/repos/thinker-arena"))
KEY = os.environ["AZURE_SPEECH_KEY"]; REGION = os.environ["AZURE_SPEECH_REGION"]
ENDPOINT = f"https://{REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
VOICES = json.load(open(REPO / "voices.json"))
DEFAULT = {"voice": "zh-CN-XiaoxiaoMultilingualNeural"}

# ---- Voice character pools, used to (a) assign unseen thinkers and (b) find
#      a same-character fallback when two speakers in ONE debate would collide.
_th = json.load(open(REPO / "thinkers.json"))
THINKERS = {t["id"]: t for t in (_th.get("thinkers") if isinstance(_th, dict) else _th)}
FEMALE = {"arendt","beauvoir","nussbaum","sontag","carstensen","dweck","wood","wolf","boroditsky"}
FEMALE_V = ["zh-CN-XiaochenMultilingualNeural","zh-CN-XiaoshuangMultilingualNeural","zh-CN-XiaoyouMultilingualNeural",
            "zh-CN-XiaoyuMultilingualNeural","zh-CN-XiaohanNeural","zh-CN-XiaomengNeural","zh-CN-XiaoxiaoMultilingualNeural","zh-CN-XiaoyanNeural"]
MALE_CN = ["zh-CN-YunyeNeural","zh-CN-YunzeNeural","zh-CN-YunjianNeural","zh-CN-YunfengNeural","zh-CN-YunhaoNeural",
           "zh-CN-YunyangNeural","zh-CN-YunxiNeural","zh-CN-YunjieNeural","zh-CN-YunxiaNeural"]
MALE_MU = ["zh-CN-YunyiMultilingualNeural","zh-CN-YunfanMultilingualNeural","zh-CN-YunxiaoMultilingualNeural"]

def _birth(era):
    if not era: return 2000
    m = re.search(r"前(\d+)", era)
    if m: return -int(m.group(1))
    m = re.search(r"(\d{3,4})", era)
    if m: return int(m.group(1))
    m = re.search(r"(\d+)\s*世纪", era)
    if m: return int(m.group(1)) * 100 - 50
    return 2000

def _western(region):
    return not any(k in (region or "") for k in ["中国","印度","日本","波斯","古印度","台湾"])

def candidate_sigs(tid):
    """Preferred signature first (voices.json), then same-character alternates.
    A 'signature' is (voice, pitch, rate); differing pitch on the same voice
    reads as a different person, so it multiplies the usable pool."""
    t = THINKERS.get(tid, {}); by = _birth(t.get("era","")); west = _western(t.get("region","")); fem = tid in FEMALE
    out = []
    pref = VOICES.get(tid)
    if isinstance(pref, dict):
        out.append((pref["voice"], pref.get("pitch",""), pref.get("rate","")))
    elif isinstance(pref, str):
        out.append((pref, "", ""))
    if fem:
        for v in FEMALE_V: out.append((v, "", ""))
        return out
    if by < 0:      pitches = ["-15%","-13%","-17%","-11%","-9%"]
    elif by < 1500: pitches = ["-13%","-11%","-15%","-9%"]
    elif by < 1900: pitches = ["-9%","-11%","-7%","-13%"]
    else:           pitches = ["","-4%","-6%","-2%"]
    voices = (MALE_MU + MALE_CN) if west else (MALE_CN + MALE_MU)
    for p in pitches:
        for v in voices:
            out.append((v, p, "-3%" if p else ""))
    return out

def assign_debate_voices(participant_ids):
    """Deterministic, collision-free per-debate assignment. Same input list →
    same output, so a CI re-run is stable. Each thinker keeps their preferred
    voice unless an earlier speaker in THIS debate already took its signature."""
    used = set(); result = {}
    for tid in participant_ids:
        chosen = None
        for sig in candidate_sigs(tid):
            if sig not in used:
                chosen = sig; break
        if chosen is None:
            chosen = candidate_sigs(tid)[0]  # pool exhausted (won't happen for ≤ ~40 speakers)
        used.add(chosen)
        result[tid] = {"voice": chosen[0]}
        if chosen[1]: result[tid]["pitch"] = chosen[1]
        if chosen[2]: result[tid]["rate"] = chosen[2]
    return result

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

# Collision-free voices for THIS debate's speakers (stable, stateless — the
# same participant list always yields the same mapping, so CI re-runs match).
PARTICIPANTS = list(dict.fromkeys(p["thinker"] for p in d["posts"]))
DVOICES = assign_debate_voices(PARTICIPANTS)
def voice_of(tid):
    return DVOICES.get(tid) or cfg(tid)

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
    bake(p["id"], voice_of(p["thinker"]), p["text"])

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
    # a hook may be posed by an AI (e.g. "gpt") rather than a thinker; a thinker
    # asker keeps the collision-free voice they were given in this debate.
    c = cfg("_ai_" + frm) if ("_ai_" + frm) in VOICES else voice_of(frm)
    bake("hook-%d" % i, c, hook_text(hk))

json.dump(manifest, open(outdir/"manifest.json","w"), ensure_ascii=False, indent=1)
# clean orphans
used = {v["audio"].split("/")[-1] for v in manifest.values()}
import glob
for f in glob.glob(str(outdir/"*.mp3")):
    if os.path.basename(f) not in used: os.remove(f)
print(f"✅ {len(manifest)} 段（含 3 AI 收尾）→ manifest.json")
