#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""辩论校验 + 字数 lint。
用法: python3 validate.py debates/<slug>.json
退出码非 0 即有 ERROR（阻断 commit）；WARN 仅提示、不阻断。

校验：JSON 合法 / thinker·reaction·reply_to·ai·participants 引用在册 /
      每轮人人到齐 / glossary 术语在各自 text、glossary_en 术语在各自 text_en /
      每帖有 text_en / 每条 summary 有 summary_en·insight_en / question_en 在场 /
      每位 participants 在 profiles.json 有条目（含全套 _en）。
字数 lint（中文字数，区间 150–250）：
      三家 AI 收尾的 summary / insight / advice 各段——
      上限 250 对三家硬卡(ERROR)；下限 150 对 claude 硬卡(ERROR)，
      对 gpt/gemini 仅 WARN(真实 API 产出，不为凑字数注水)。
      帖子正文：第1/2轮 >230 或 第3轮 >340 仅 WARN。
"""
import json, re, sys

LO, HI = 150, 250
RT = {"强烈赞同", "轻微赞同", "中立", "轻微反对", "强烈反对", "疑惑"}

def cn(s):
    return len(re.findall(r"[一-鿿]", s or ""))

def main(path):
    errs, warns = [], []
    th = {t["id"] for t in json.load(open("thinkers.json"))["thinkers"]}
    prof = json.load(open("profiles.json"))["profiles"]
    d = json.load(open(path))
    parts = d["participants"]
    ids = {p["id"] for p in d["posts"]}

    if not d.get("question_en"):
        errs.append("缺 question_en")
    for c in d.get("casting", []):
        if not c.get("reason_en"):
            errs.append(f"casting {c['id']} 缺 reason_en")
        if c["id"] not in parts:
            errs.append(f"casting {c['id']} 不在 participants")
    for p in parts:
        if p not in th:
            errs.append(f"participant {p} 不在 thinkers.json")
        if p not in prof:
            errs.append(f"participant {p} 不在 profiles.json")
        else:
            for k in ("bio", "ideas", "assessments", "quotes", "works", "lineage", "trivia"):
                if k not in prof[p] or (k + "_en") not in prof[p]:
                    errs.append(f"profile {p} 缺 {k}/{k}_en")

    rounds = {}
    for p in d["posts"]:
        rounds.setdefault(p["round"], set()).add(p["thinker"])
        if p["thinker"] not in parts:
            errs.append(f"{p['id']} thinker 不在 participants")
        if not p.get("text_en"):
            errs.append(f"{p['id']} 缺 text_en")
        rt = p.get("reply_to")
        if rt is not None and rt not in ids:
            errs.append(f"{p['id']} reply_to 无效: {rt}")
        for term in (p.get("glossary") or {}):
            if term not in p["text"]:
                errs.append(f"{p['id']} glossary 术语不在 text: {term}")
        for term in (p.get("glossary_en") or {}):
            if term not in p["text_en"]:
                errs.append(f"{p['id']} glossary_en 术语不在 text_en: {term}")
        for lvl, who in (p.get("reactions") or {}).items():
            if lvl not in RT:
                errs.append(f"{p['id']} 非法 reaction 档: {lvl}")
            for w in who:
                if w not in parts:
                    errs.append(f"{p['id']} reactor 不在 participants: {w}")
                if w == p["thinker"]:
                    errs.append(f"{p['id']} 自我表态: {w}")
        n = cn(p["text"])
        cap = 340 if p["round"] == 3 else 230
        if n > cap:
            warns.append(f"{p['id']}(第{p['round']}轮) 正文 {n} 字，偏长(>{cap})")

    for r in sorted(rounds):
        miss = set(parts) - rounds[r]
        if miss:
            errs.append(f"第{r}轮缺席: {miss}")

    # 本场钩子（前端渲染的双语延伸角度）：缺失仅 WARN；若有，逐条校验 from/text/text_en
    hooks = d.get("hooks")
    if not hooks:
        warns.append("缺 hooks（三方 AI 留下的延伸钩子，前端「延伸 · 本场留下的钩子」会空着）")
    else:
        for i, h in enumerate(hooks):
            frm = h.get("from")
            if frm not in th:
                errs.append(f"hooks[{i}] from 不在 thinkers.json: {frm}")
            for k in ("text", "text_en"):
                if not h.get(k):
                    errs.append(f"hooks[{i}] 缺 {k}")

    ais = {s["ai"] for s in d["summaries"]}
    if ais != {"claude", "gpt", "gemini"}:
        errs.append(f"summaries 的 ai 应为 claude/gpt/gemini，实为 {ais}")
    for s in d["summaries"]:
        for k in ("summary", "insight", "advice", "summary_en", "insight_en",
                  "advice_en", "engine", "engine_en"):
            if not s.get(k):
                errs.append(f"summary[{s['ai']}] 缺 {k}")
        for k in ("summary", "insight", "advice"):
            if not s.get(k):
                continue
            n = cn(s[k])
            if n > HI:
                errs.append(f"summary[{s['ai']}].{k} = {n} 字，超上限 {HI}")
            elif n < LO:
                msg = f"summary[{s['ai']}].{k} = {n} 字，低于下限 {LO}"
                (errs if s["ai"] == "claude" else warns).append(
                    msg + ("" if s["ai"] == "claude" else "（真实 API，仅提示）"))

    for w in warns:
        print("WARN:", w)
    for e in errs:
        print("ERROR:", e)
    if errs:
        print(f"\n✗ {len(errs)} 个 ERROR，{len(warns)} 个 WARN")
        sys.exit(1)
    print(f"\n✓ 全部校验通过（{len(warns)} 个 WARN）")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("用法: python3 validate.py debates/<slug>.json")
        sys.exit(2)
    main(sys.argv[1])
