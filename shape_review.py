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

def feats(d):
    posts = d.get("posts", [])
    rounds = sorted({p["round"] for p in posts})
    ppr = tuple(sum(1 for p in posts if p["round"] == r) for r in rounds)
    by_id = {p["id"]: p for p in posts}
    # 第2轮反驳是否每帖都 reply 第1轮
    r2 = [p for p in posts if p["round"] == 2]
    r2_to_r1 = sum(1 for p in r2 if p.get("reply_to") and by_id.get(p["reply_to"], {}).get("round") == 1)
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
        "表态档集合": tuple(sorted(rk)),
        "用了疑惑": "疑惑" in rk,
        "带glossary帖数": sum(1 for p in posts if p.get("glossary")),
        "古文帖数": sum(1 for p in posts if p.get("vernacular")),
        "建议带①②③": sum(1 for s in sums if has_num(s.get("advice", ""))),
        "帖均加粗处": round(sum((p.get("text", "").count("**")) // 2 for p in posts) / max(1, len(posts)), 2),
        # 措辞指纹（开头几字）
        "_insight_open": [(s.get("ai", "?"), (s.get("insight", "") or "")[:5]) for s in sums],
        "_post_open": [(p.get("text", "") or "")[:3] for p in posts],
    }

T = feats(tgt)
R = [(eid, feats(load(eid))) for eid in recent_ids if load(eid)]

print("=" * 70)
print("形状自评 ·", tid, "· 对比最近", len(R), "场:", "、".join(eid for eid, _ in R) or "(无)")
print("=" * 70)

SCALARS = ["人数","轮数","每轮帖数","钩子数","钩子分布","钩子作者类型","二轮全反一轮","表态档集合",
           "用了疑惑","带glossary帖数","古文帖数","建议带①②③","帖均加粗处"]
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
