#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 IDEAS.md「议题清单」里的候选(- [ ])同步进 ideas.json 的 candidates。
- 人编辑 IDEAS.md(markdown 友好)；本脚本让 ideas.json(网页数据源)跟随。
- 每条候选靠行尾隐形 id 标记 <!--id--> 锚定，改写问题文字也不丢 id/票/英文/副标题。
- 已存在的 id：更新中文问题 q，保留 q_en/note/note_en/votes。
- 新候选(无 <!--id-->)：报出来，让人补 id + 英文 + 副标题(脚本不臆造)。
- IDEAS.md 里删掉的候选：从 ideas.json 一并删掉。
- debated 区不动(由 routine/发布流程维护)。
用法: python3 sync_ideas.py
"""
import json, re, sys
md = open("IDEAS.md", encoding="utf-8").read()
d = json.load(open("ideas.json", encoding="utf-8"))
existing = {c["id"]: c for c in d["candidates"]}

parsed, missing = [], []
for ln in md.splitlines():
    m = re.match(r'^- \[ \] (.*)$', ln)
    if not m:
        continue
    body = m.group(1)
    idm = re.search(r'<!--\s*([a-z0-9][a-z0-9-]*)\s*-->', body)
    q = re.sub(r'\s*<!--.*?-->\s*$', '', body).strip()
    if idm:
        parsed.append((idm.group(1), q))
    else:
        missing.append(q)

new_cands, stubs = [], []
for cid, q in parsed:
    if cid in existing:
        c = existing[cid]; c["q"] = q
    else:
        c = {"id": cid, "votes": 0, "q": q, "q_en": "", "note": "", "note_en": ""}
        stubs.append(cid)
    new_cands.append(c)

dropped = [cid for cid in existing if cid not in {c["id"] for c in new_cands}]
d["candidates"] = new_cands
json.dump(d, open("ideas.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"同步完成：候选 {len(new_cands)} 条。")
if dropped:  print("  删除:", dropped)
if stubs:    print("  ⚠️ 新候选(已建占位，需补 q_en/note):", stubs)
if missing:  print("  ⚠️ 这些候选行没有 <!--id--> 标记(请补 id 后再同步):")
for q in missing: print("       -", q)
# 校验缺英文/副标题的(便于补全)
incomplete = [c["id"] for c in new_cands if not c.get("q_en") or not c.get("note")]
if incomplete: print("  待补英文/副标题:", incomplete)
