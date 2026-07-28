#!/usr/bin/env python3
"""Bake one debate: per-speaker voices with optional pitch/rate (elder tuning).
   Bakes each post + each AI closer (summary+insight+advice as one segment)."""
import json, os, sys, hashlib, re, requests
from pathlib import Path

# Repo root = this script's own directory. Must NOT be a hardcoded ~/Desktop
# path: on GitHub Actions ~ is /home/runner, so voices.json/thinkers.json/
# debates/ all vanish and every CI bake dies with FileNotFoundError.
REPO = Path(__file__).parent.resolve()
KEY = os.environ["AZURE_SPEECH_KEY"]; REGION = os.environ["AZURE_SPEECH_REGION"]
# A missing GitHub secret arrives as an empty string, not as an unset variable,
# so os.environ[...] happily returns "". That produced a URL of
# "https://.tts.speech.microsoft.com/..." and an InvalidURL raised deep inside
# requests, ten frames from the actual cause. Say it plainly instead.
if not KEY or not REGION:
    missing = [n for n, v in (("AZURE_SPEECH_KEY", KEY), ("AZURE_SPEECH_REGION", REGION)) if not v]
    sys.exit(f"ERROR: {', '.join(missing)} is empty — add it to this repo's "
             f"Actions secrets. Nothing was baked.")
ENDPOINT = f"https://{REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
VOICES = json.load(open(REPO / "voices.json"))
DEFAULT = {"voice": "zh-CN-XiaoxiaoMultilingualNeural"}

# ---- Voice character pools, used to (a) assign unseen thinkers and (b) find
#      a same-character fallback when two speakers in ONE debate would collide.
_th = json.load(open(REPO / "thinkers.json"))
THINKERS = {t["id"]: t for t in (_th.get("thinkers") if isinstance(_th, dict) else _th)}
FEMALE = {"arendt","beauvoir","nussbaum","sontag","carstensen","dweck","wood","wolf","boroditsky"}
# NB: Xiaoshuang / Xiaoyou are Azure's CHILD voices — excluded so no thinker
# or AI closer sounds like a kid. Pool is adult/mature female voices only.
# Preferred first: Xiaohan/Xiaoyan/Xiaozhen (natural, unfussy). Xiaorui is
# theatrical (audiobook narrator) so it sits last as a fallback only.
FEMALE_V = ["zh-CN-XiaohanNeural","zh-CN-XiaoyanNeural","zh-CN-XiaozhenNeural",
            "zh-CN-XiaochenMultilingualNeural","zh-CN-XiaoxiaoMultilingualNeural","zh-CN-XiaoyuMultilingualNeural",
            "zh-CN-XiaomoNeural"]
MALE_CN = ["zh-CN-YunyeNeural","zh-CN-YunzeNeural","zh-CN-YunjianNeural","zh-CN-YunfengNeural","zh-CN-YunhaoNeural",
           "zh-CN-YunyangNeural","zh-CN-YunxiNeural","zh-CN-YunjieNeural"]
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

# ---- Where the MP3s go -----------------------------------------------------
# They used to be committed here: 591MB of this repo's 598MB. Now they go to
# R2 (bucket bigcat-audio, key thinker-arena/debate/<slug>/<hash>.mp3) and are
# served by the bigcat-audio Worker. The manifest stays in git — it is small,
# it is the index app.js reads, and keeping it tracked is what lets CI tell
# which debates still need baking without the MP3s being present.
#
# R2 mode switches on when the three R2_* env vars are set, so a local run
# without credentials still writes audio/ and behaves exactly as before.
class LocalStore:
    label = "local audio/"
    def __init__(self, root): self.root = root
    def has(self, rel): return (self.root/rel).exists()
    def put(self, rel, data):
        p = self.root/rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data)
    def prune(self, keep_dir, keep_names):
        import glob as _g
        for f in _g.glob(str(self.root/keep_dir/"*.mp3")):
            if os.path.basename(f) not in keep_names: os.remove(f)


class R2Store:
    def __init__(self, acct, ak, sk, bucket, prefix):
        import boto3
        from botocore.config import Config
        self.bucket, self.prefix = bucket, prefix.strip("/")
        self.label = f"r2://{bucket}/{self.prefix}"
        self.c = boto3.client("s3", endpoint_url=f"https://{acct}.r2.cloudflarestorage.com",
                              aws_access_key_id=ak, aws_secret_access_key=sk, region_name="auto",
                              config=Config(signature_version="s3v4", retries={"max_attempts": 5}))
    def _key(self, rel): return f"{self.prefix}/{rel}"
    def _list(self, rel_dir):
        keys, tok = set(), None
        while True:
            kw = {"Bucket": self.bucket, "Prefix": f"{self.prefix}/{rel_dir}/"}
            if tok: kw["ContinuationToken"] = tok
            r = self.c.list_objects_v2(**kw)
            for o in r.get("Contents", []): keys.add(o["Key"])
            if not r.get("IsTruncated"): return keys
            tok = r["NextContinuationToken"]
    def has(self, rel):
        d = os.path.dirname(rel)
        if not hasattr(self, "_cache"): self._cache = {}
        if d not in self._cache: self._cache[d] = self._list(d)
        return self._key(rel) in self._cache[d]
    def put(self, rel, data):
        self.c.put_object(Bucket=self.bucket, Key=self._key(rel), Body=data,
                          ContentType="audio/mpeg",
                          CacheControl="public, max-age=31536000, immutable")
        self._cache.setdefault(os.path.dirname(rel), set()).add(self._key(rel))
    def prune(self, keep_dir, keep_names):
        stale = [k for k in self._list(keep_dir) if os.path.basename(k) not in keep_names
                 and k.endswith(".mp3")]
        for i in range(0, len(stale), 1000):
            self.c.delete_objects(Bucket=self.bucket,
                                  Delete={"Objects": [{"Key": k} for k in stale[i:i+1000]],
                                          "Quiet": True})
        if stale: print(f"  pruned {len(stale)} stale objects")


def make_store():
    e = {k: os.environ.get(k) for k in
         ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")}
    if not all(e.values()):
        if any(e.values()):
            print("WARNING: partial R2 config, baking to disk instead", file=sys.stderr)
        return LocalStore(REPO/"audio")
    return R2Store(e["R2_ACCOUNT_ID"], e["R2_ACCESS_KEY_ID"], e["R2_SECRET_ACCESS_KEY"],
                   os.environ.get("R2_BUCKET", "bigcat-audio"),
                   os.environ.get("R2_PREFIX", "thinker-arena"))


slug = sys.argv[1]
d = json.load(open(REPO/f"debates/{slug}.json"))
outdir = REPO/"audio"/"debate"/slug; outdir.mkdir(parents=True, exist_ok=True)
store = make_store()
print(f"Audio store: {store.label}")
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
    rel = f"debate/{slug}/{h}.mp3"
    if not store.has(rel):
        store.put(rel, synth(c, text))
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
# Drop segments this bake no longer uses — editing a post changes its hash and
# strands the old file. Doing it per debate is why this repo has no dead audio
# to prune, unlike the ones baked by bake-tts.py.
used = {v["audio"].split("/")[-1] for v in manifest.values()}
store.prune(f"debate/{slug}", used)
print(f"✅ {len(manifest)} 段（含 3 AI 收尾）→ manifest.json")
