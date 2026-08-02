#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""形状自评（反模板）：写完一场后跑，把本场的『结构指纹』和最近几场逐项对比，
照出你在哪些维度上又落进了模板——尤其是静态规则没法预知的『措辞坍缩』（每场 insight
都同一个开头、每帖都同一个起手式）。看到连号/雷同，就故意在其中至少一处偏离。
用法: python3 shape_review.py debates/<slug>.json [最近N场=5]
这是『让未知维度的过拟合也变得可见』——配合一遍你自己的挑剔通读，专门破模板。
"""
import json, sys, glob, os, re
from collections import Counter

if len(sys.argv) < 2:
    print("用法: python3 shape_review.py debates/<slug>.json [N]"); sys.exit(2)
target_path = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 5

idx = json.load(open("debates/index.json"))["debates"]
order = [e["id"] for e in idx]
tgt = json.load(open(target_path))
tid = tgt["id"]
pos = order.index(tid) if tid in order else len(order)
recent_ids = order[max(0, pos - N):pos]

def load(eid):
    p = "debates/%s.json" % eid
    return json.load(open(p)) if os.path.exists(p) else None

def _cn(t):
    return len(re.findall(r"[\u4e00-\u9fff]", t or ""))

def _sum_open_kind(s):
    """summary \u7684\u8d77\u624b\u5957\u8def\u5206\u7c7b\u3002\u5148\u5f52\u7c7b\u518d\u8de8\u573a\u6bd4\uff0c\u514d\u5f97\u6362\u4e2a\u6570\u5b57\u5c31\u4ee5\u4e3a\u81ea\u5df1\u6362\u4e86\u5199\u6cd5\u3002"""
    t = re.sub(r"[\*\s]", "", s or "")[:40]
    if re.match(r"^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+(\u4f4d|\u4e2a)?\u4eba", t):
        return "\u70b9\u540d\u82b1\u540d\u518c(N\u4e2a\u4eba\u2026)"
    if re.match(r"^(\u5148\u8bf4|\u8fd9\u573a|\u672c\u573a)?(\u6700\u5927\u7684)?\u5171\u8bc6", t) or re.match(r"^(\u5148\u8bf4|\u9996\u5148)", t):
        return "\u5148\u8bf4\u5171\u8bc6\u8d77\u624b"
    return t[:6]

def _r3_everyday_turn(posts):
    """总结陈词里用同一句『过渡语』拐向日常建议的帖数（给普通人／落到日常／本周就能…）。
    第3轮要落到可操作建议是要求，但若每帖都用同一副转场口令，一整轮读起来就是同一个
    模板换了署名——它不在字数、不在反驳结构上，静态规则查不出，只能逐场比。"""
    r3 = [p.get("text", "") or "" for p in posts if p.get("round") == 3]
    pat = re.compile(r"给普通人|落到日常|落到家常|落到实处|常人处世|日常里|日常中|今天就能|本周就能|用在人间")
    return "%d/%d" % (sum(1 for t in r3 if pat.search(t)), len(r3)) if r3 else "-"


def _r3_countdown(posts):
    """总结陈词里『我说三件事／三条建议／吾终之以三事』这类数数起手式占几帖。
    一场里几乎人人都用数字开场清单，读起来就是同一个模子印的——它不在字数、
    也不在反驳结构上，静态规则查不出，只能作为指纹逐场比。"""
    r3 = [p.get("text", "") or "" for p in posts if p.get("round") == 3]
    pat = re.compile(r"^.{0,14}?[二三四两]\s*(?:件|条|事|点|句|端)")
    return "%d/%d" % (sum(1 for t in r3 if pat.search(t)), len(r3)) if r3 else "-"

def _r3_ratio(posts):
    """第3轮均长 ÷ 第1轮均长——照出『总结陈词一律拉到上限』这种未被覆盖的形状坍缩。"""
    a = [_cn(p.get("text", "")) for p in posts if p.get("round") == 1]
    b = [_cn(p.get("text", "")) for p in posts if p.get("round") == 3]
    if not a or not b:
        return 0.0
    return round((sum(b) / len(b)) / max(1.0, sum(a) / len(a)), 2)

def _order_repeat(posts, rounds):
    """后面各轮里，有几轮的发言顺序与第1轮一字不差。每场都按同一个次序轮流开口，
    读起来就是同一张点名表念了三遍——它不在人数、不在反驳结构上，静态规则查不出。
    0 = 每轮都换了次序（想要的样子），所以 0 不算模板、不报连号。"""
    seq = {r: [p["thinker"] for p in posts if p["round"] == r] for r in rounds}
    base = seq.get(rounds[0], [])
    later = list(rounds[1:])
    return sum(1 for r in later if seq[r] == base)


def _r1_monologue(posts):
    """第1轮里 reply_to 为空的比例。每场第1轮都清一色独白（N/N），
    读起来就是八个人各念一段稿子、彼此不知道对方存在——第2轮才突然开始对话。
    第1轮里有人直接接住前面某帖，开场就有火星；这维度不在人数、也不在反驳
    结构上，静态规则查不出，只能逐场比。N/N = 全独白（最容易坍缩的样子）。"""
    r1 = [p for p in posts if p.get("round") == 1]
    return "%d/%d" % (sum(1 for p in r1 if not p.get("reply_to")), len(r1)) if r1 else "-"


def feats(d):
    posts = d.get("posts", [])
    rounds = sorted({p["round"] for p in posts})
    ppr = tuple(sum(1 for p in posts if p["round"] == r) for r in rounds)
    by_id = {p["id"]: p for p in posts}
    # 第2轮反驳是否每帖都 reply 第1轮
    r2 = [p for p in posts if p["round"] == 2]
    r2_to_r1 = sum(1 for p in r2 if p.get("reply_to") and by_id.get(p["reply_to"], {}).get("round") == 1)
    # 第2轮内部的『追击』：反驳的是同一轮里刚说完的人，而不是清一色回头打第1轮
    r2_chain = sum(1 for p in r2 if p.get("reply_to") and by_id.get(p["reply_to"], {}).get("round") == 2)
    rk = frozenset(k for p in posts for k in (p.get("reactions") or {}))
    hooks = d.get("hooks") or []
    hb = Counter(h.get("from") for h in hooks)
    _ai = {"claude", "gpt", "gemini"}
    _hai = sum(1 for h in hooks if h.get("from") in _ai)
    sums = d.get("summaries", [])
    def has_num(s):
        return bool(re.search(r"[①②③]|[1-3][\.、)]", s or ""))
    return {
        "人数": len(d.get("participants", [])),
        "轮数": len(rounds),
        "每轮帖数": ppr,
        "钩子数": len(hooks),
        "钩子分布": tuple(sorted("%s:%d" % (k, v) for k, v in hb.items())),
        "钩子作者类型": "AI%d/思想家%d" % (_hai, len(hooks) - _hai) if hooks else "-",
        "二轮全反一轮": "%d/%d" % (r2_to_r1, len(r2)) if r2 else "-",
        # 二轮里有多少帖是接着同轮的人往下打（0 = 每帖都回头打第1轮，结构最单调）
        "二轮同轮追击": "%d/%d" % (r2_chain, len(r2)) if r2 else "-",
        # 第1轮有几帖是不接任何人的独白（N/N = 人人各念各的，开场没有交锋）
        "首轮全独白": _r1_monologue(posts),
        # 后面各轮里有几轮照抄了第1轮的发言顺序（0 = 每轮都换了次序，正是想要的）
        "轮内照抄顺序": _order_repeat(posts, rounds),
        "表态档集合": tuple(sorted(rk)),
        "用了疑惑": "疑惑" in rk,
        "带glossary帖数": sum(1 for p in posts if p.get("glossary")),
        "古文帖数": sum(1 for p in posts if p.get("vernacular")),
        "建议带①②③": sum(1 for s in sums if has_num(s.get("advice", ""))),
        "帖均加粗处": round(sum((p.get("text", "").count("**")) // 2 for p in posts) / max(1, len(posts)), 2),
        # 总结陈词是否一律被拉长到上限（第3轮均长 ÷ 第1轮均长；每场都 ~2.0 即是形状定型）
        "总结膨胀比": _r3_ratio(posts),
        # 总结陈词有多少帖用『三件事/三条建议』这类数数起手（人人如此＝同一个模子）
        "总结数数起手": _r3_countdown(posts),
        # 总结陈词有多少帖用同一副『转向日常』的过渡语（给普通人／落到日常／本周就能…）
        "总结转日常": _r3_everyday_turn(posts),
        # 措辞指纹（开头几字）
        # summary 起手式：先归成『套路种类』再比——最爱复读的两种是
        # 『N 个人从…进来，没有一个…』的点名花名册，和『先说共识／最大的共识是…』
        "_summary_open": [(s.get("ai", "?"), _sum_open_kind(s.get("summary", ""))) for s in sums],
        "_insight_open": [(s.get("ai", "?"), (s.get("insight", "") or "")[:5]) for s in sums],
        "_advice_open": [(s.get("ai", "?"), (s.get("advice", "") or "")[:6]) for s in sums],
        "_post_open": [(p.get("text", "") or "")[:3] for p in posts],
    }

T = feats(tgt)
R = [(eid, feats(load(eid))) for eid in recent_ids if load(eid)]

print("=" * 70)
print("形状自评 ·", tid, "· 对比最近", len(R), "场:", "、".join(eid for eid, _ in R) or "(无)")
print("=" * 70)

SCALARS = ["人数","轮数","每轮帖数","钩子数","钩子分布","钩子作者类型","二轮全反一轮","二轮同轮追击","轮内照抄顺序","首轮全独白","表态档集合",
           "用了疑惑","带glossary帖数","古文帖数","建议带①②③","帖均加粗处","总结膨胀比","总结数数起手","总结转日常"]
flags = []
print("\n%-14s %-22s %s" % ("维度", "本场", "最近几场"))
print("-" * 70)
for k in SCALARS:
    recent_vals = [f[k] for _, f in R]
    cur = T[k]
    # 连号判定：与最近≥2场全部相同 → 模板（但「空/0/False」是『该特征没用上』，不算模板，跳过）
    same_tail = recent_vals[-2:] if len(recent_vals) >= 2 else recent_vals
    trivial = cur in (0, 0.0, False, "", (), None)
    streak = (not trivial) and len(same_tail) >= 2 and all(v == cur for v in same_tail)
    mark = " ⚠️ 连号" if streak else ""
    if streak:
        flags.append(k)
    print("%-14s %-22s %s%s" % (k, str(cur), " | ".join(str(v) for v in recent_vals), mark))

# ---- 措辞坍缩：summary 开头 ----（『N个人从…进来』『先说共识』最易跨场复读）
print("\n【summary 起手式】（先共识后分歧是要求，但开场句式别每场同一副模子）")
allso = Counter()
for eid, f in R:
    for ai, op in f.get("_summary_open", []):
        allso[op] += 1
for ai, op in T["_summary_open"]:
    reuse = allso.get(op, 0)
    tag = " ⚠️ 最近%d场也这么开头" % reuse if reuse >= 2 else ""
    print("  %-7s 「%s」%s" % (ai, op, tag))
    if reuse >= 2:
        flags.append("summary起手:%s" % op)

# ---- 措辞坍缩：insight 开头 ----
print("\n【insight 开头】（同一开头跨场复用＝套路；每家换个起手式）")
allio = Counter()
for eid, f in R:
    for ai, op in f["_insight_open"]:
        allio[op] += 1
for ai, op in T["_insight_open"]:
    reuse = allio.get(op, 0)
    tag = " ⚠️ 最近%d场也这么开头" % reuse if reuse >= 2 else ""
    print("  %-7s 「%s…」%s" % (ai, op, tag))
    if reuse >= 2:
        flags.append("insight开头:%s" % op)

# ---- 措辞坍缩：advice 开头 ----（"三件今天就能试的事"/"本周可做三件事" 最易跨场复读）
print("\n【advice 开头】（每家换个起手式，别每场都从同一句数数开始）")
allao = Counter()
for eid, f in R:
    for ai, op in f.get("_advice_open", []):
        allao[op] += 1
for ai, op in T["_advice_open"]:
    reuse = allao.get(op, 0)
    tag = " ⚠️ 最近%d场也这么开头" % reuse if reuse >= 2 else ""
    print("  %-7s 「%s…」%s" % (ai, op, tag))
    if reuse >= 2:
        flags.append("advice开头:%s" % op)

# ---- 帖子起手式：本场内部单调 + 跨场复用 ----
print("\n【帖子起手式】（本场内大量同起手 or 跨场复用＝套路）")
cur_open = Counter(T["_post_open"])
top = cur_open.most_common(3)
nposts = len(T["_post_open"])
for op, c in top:
    if c >= max(3, round(nposts * 0.35)):
        print("  ⚠️ 本场 %d/%d 帖以「%s…」起手——太单调" % (c, nposts, op))
        flags.append("帖起手:%s" % op)
recent_open = Counter(op for _, f in R for op in f["_post_open"])
cross = [(op, c) for op, c in cur_open.items() if recent_open.get(op, 0) >= nposts]  # 最近场也高频
for op, c in cross[:3]:
    print("  ⚠️ 「%s…」起手在最近几场也反复出现（跨场套路）" % op)
    flags.append("跨场帖起手:%s" % op)

print("\n" + "=" * 70)
if flags:
    print("⚠️ 检出 %d 处模板化：%s" % (len(flags), "，".join(flags)))
    print("→ 至少**故意改掉一处**（换人数/换钩子数/换反驳结构/换开头措辞…），别让形状定型。")
else:
    print("✓ 结构指纹与最近几场差异够大，未见明显模板化。")
print("另：再用挑剔的眼光通读一遍，找上面没编码进来的新套路（这才防得住未知维度的坍缩）。")
