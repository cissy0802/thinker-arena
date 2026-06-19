#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""选角/写钩子前先跑这个：把最近若干场的『分布统计』打给你看，
而不是给你几整场可照抄的样例——破掉「读最近样例→模仿其形状」的过拟合回路。
用法: python3 diversity_report.py [最近N场，默认10]
读 thinkers.json(名册) + debates/index.json(参与者/日期) + 各 debates/*.json(钩子数)。
"""
import json, sys, glob, os
from collections import Counter

N = int(sys.argv[1]) if len(sys.argv) > 1 else 10
roster = json.load(open("thinkers.json"))["thinkers"]
ROSTER = {t["id"]: (t.get("name") or t["id"]) for t in roster}
JUDGES = {"claude", "gpt", "gemini"}            # 收尾评委，不算辩手
pool = {i for i in ROSTER if i not in JUDGES}

idx = json.load(open("debates/index.json"))["debates"]
recent = idx[-N:]

def hooks_of(eid):
    p = "debates/%s.json" % eid
    if not os.path.exists(p):
        return None
    return json.load(open(p)).get("hooks") or []

freq_all = Counter(p for e in idx for p in e.get("participants", []))
freq_recent = Counter(p for e in recent for p in e.get("participants", []))
never = sorted(pool - set(freq_all))

print("=" * 64)
print("选角/钩子 多样性体检 · 共 %d 场，名册 %d 人(不含3评委)" % (len(idx), len(pool)))
print("=" * 64)

print("\n【人数序列】最近场依次（别和它们雷同；6–10 自由取）：")
print("  " + " → ".join(str(len(e.get("participants", []))) for e in recent))

print("\n【钩子数序列】最近场依次（别都锚成 3；应随议题浮动 3–7）：")
seq = []
for e in recent:
    h = hooks_of(e["id"])
    seq.append("?" if h is None else str(len(h)))
print("  " + " → ".join(seq))

print("\n【过度集中】近 %d 场出场 ≥3 次的辩手（除非非他不可，别再选）：" % N)
hot = [(c, i) for i, c in freq_recent.items() if c >= 3]
for c, i in sorted(hot, reverse=True):
    print("  %2d×  %s (%s)" % (c, ROSTER.get(i, i), i))
if not hot:
    print("  （无人近 %d 场出场≥3，分布尚可）" % N)
twice = sorted(ROSTER.get(i, i) for i, c in freq_recent.items() if c == 2)
if twice:
    print("  （出场 2 次的：%s）" % "、".join(twice))

print("\n【从未上场】名册里还没用过的辩手（优先启用，%d 人）：" % len(never))
if never:
    line = "  "
    for i in never:
        chunk = "%s(%s)  " % (ROSTER.get(i, i), i)
        if len(line) + len(chunk) > 76:
            print(line); line = "  "
        line += chunk
    if line.strip():
        print(line)
else:
    print("  （名册已全部启用过）")

print("\n【上一场参与者】（本场与之重叠别 >50%，换血）：")
if recent:
    last = recent[-1]
    print("  %s：%s" % (last["id"], "、".join(ROSTER.get(p, p) for p in last.get("participants", []))))

print("\n提示：以上是统计，不是样例——按『欠曝光优先 + 别和最近雷同』选，")
print("      人数/钩子数都让它随议题自然浮动，别凑成最近那几场的数。")
