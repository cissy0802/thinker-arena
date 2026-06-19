#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""人物图鉴『贴题过拟合』体检：写完图鉴后跑，照出哪几位的图鉴最沾本场议题的词。
图鉴该「对本场议题盲」、通用可复用；若某人图鉴塞满本场关键词，多半是为贴题挑了料。
靠英文侧检测（question_en 关键词 × profile 的 *_en 字段，分词可靠、免中文分词）。
高命中≠一定是问题——若那词本就是此人核心思想就留；只是为呼应本场才挑的，换成更有代表性的料。
用法: python3 profile_audit.py debates/<slug>.json
"""
import json, sys, re

if len(sys.argv) != 2:
    print("用法: python3 profile_audit.py debates/<slug>.json"); sys.exit(2)

d = json.load(open(sys.argv[1]))
prof = json.load(open("profiles.json"))["profiles"]
parts = d["participants"]

# 议题无关 / 太泛的词，不算「贴题」
STOP = set("""the a an and or but of to in on for with without by from as at into over under
is are was were be been being do does did done has have had can could should would will may might must
this that these those it its they them their our we us you your i me my he she his her who whom whose
what which when where why how not no nor so than then there here also just only very more most much many
about against between among across after before during while until though although because if whether
really actually simply truly even still yet ever never always often sometimes maybe perhaps
age world life human humans people person self mind thing things matter matters mean means meaning
make makes made making want wants wanted need needs go goes going get gets got become becomes
good better best bad worse worst right wrong true false real time times day days year years
question questions debate debates topic answer answers idea ideas way ways kind sort
one two three first second new old big small high low long short""".split())

def words(s):
    toks = re.findall(r"[a-zA-Z][a-zA-Z'-]*", (s or "").lower())
    out = set()
    for t in toks:
        t = t.strip("'-")
        if len(t) < 4 or t in STOP:
            continue
        out.add(t[:-1] if t.endswith("s") and len(t) > 4 else t)  # 粗略去复数
    return out

# 议题关键词：question_en + slug 词
kw = words(d.get("question_en", ""))
kw |= {w for w in re.split(r"[-_]", d["id"]) if len(w) >= 4 and w not in STOP}

def prof_en_text(e):
    out = []
    for k, v in e.items():
        if not k.endswith("_en"):
            continue
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, list):
            for it in v:
                if isinstance(it, str):
                    out.append(it)
                elif isinstance(it, dict):
                    out.append(it.get("text", ""))
    return " ".join(out)

# 绑定本场的元语言（中英）——绝不该进通用图鉴
BIND = ["本题","本场","本议题","这一议题","这场辩论","这道辩题","该议题","针对本题","回应本题",
        "直击","切中","这一框架直击","this debate","the question at hand","the topic at hand","this very question"]

print("=" * 64)
print("图鉴贴题体检 ·", d["id"], "·", d.get("question", ""))
print("议题关键词(en):", "、".join(sorted(kw)) or "(无)")
print("=" * 64)

rows = []
for pid in parts:
    e = prof.get(pid)
    if not e:
        rows.append((pid, -1, [], [])); continue
    txt = prof_en_text(e).lower()
    toks = words(txt)
    hits = sorted(k for k in kw if k in toks)
    # 绑定语扫描（中英全字段）
    allt = json.dumps(e, ensure_ascii=False)
    binds = [w for w in BIND if w in allt]
    rows.append((pid, len(hits), hits, binds))

rows.sort(key=lambda r: (-r[1], r[0]))
print("\n按『贴题命中数』降序（命中多的优先复核）：")
for pid, n, hits, binds in rows:
    if n < 0:
        print("  ⚠️ %-16s 无图鉴条目！" % pid); continue
    bar = "█" * n
    print("  %-16s %2d %s %s" % (pid, n, bar, "、".join(hits)))
    if binds:
        print("       ⛔ 绑定语(必删):", "、".join(binds))

worst = [r for r in rows if r[1] >= 3]
print("\n复核清单（命中≥3）：%s" % ("、".join(p for p, *_ in worst) if worst else "无，分布良好"))
print("逐项自检：这些词是该人**一生最核心**的思想/名言吗？")
print("  是 → 留；只是和本场撞词、为贴题才挑的 → 换成更具代表性、换个议题也成立的料。")
if any(r[3] for r in rows):
    print("⛔ 有图鉴出现『绑定本场』的元语言，必须删除（图鉴要通用可复用）。")
