#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把投票后端的评论拉成 audience_inbox.json 快照，供云端选题 routine 收观众提案。

为什么要这个：云端 routine 的 container 走 agent 出口代理，够不到投票后端
(bigcat-engage…workers.dev，返回 403)，因此读不到评论、收不了观众提案。
GitHub Action 的 runner 不在这堵墙后面，能直连后端——所以由它把评论拉成这份
文件，routine 只读文件即可（见 ENGINE.md §4 step③）。本地跑 /think 时后端可达，
可直接查后端、以后端为准。

用法: python3 refresh_inbox.py [--dry-run]
拉不到时不清空旧快照（保留 audience_inbox.json 现有内容），别因为读不到就把观众提案抹掉。
"""
import json, os, sys, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
IDEAS = os.path.join(ROOT, "ideas.json")
INBOX = os.path.join(ROOT, "audience_inbox.json")
# 与 ideas.js / refresh_votes.py 一致；可用环境变量覆盖(便于本地/预发测试)。
API = os.environ.get("ENGAGE_API", "https://bigcat-engage.cissychen.workers.dev")
OPEN_PAGE = "thinker-open-questions"   # 观众「提个新议题」的提案汇总页
UA = "bigcat-refresh-inbox/1.0"        # 默认 Python-urllib UA 会被 Cloudflare 403


def fetch_comments(page):
    """GET /comments?page=<page> -> [评论...]，失败抛异常。"""
    url = "%s/comments?page=%s" % (API.rstrip("/"), urllib.parse.quote(page))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not data.get("ok"):
        raise RuntimeError("后端 ok=false: %s" % data.get("error"))
    return data.get("comments") or []


def slim(comments):
    """只留 routine 需要的字段，去噪。"""
    return [{k: c[k] for k in ("name", "body", "created", "id") if k in c} for c in comments]


def main():
    dry = "--dry-run" in sys.argv
    with open(IDEAS, encoding="utf-8") as f:
        cand_ids = [c["id"] for c in json.load(f).get("candidates", [])]

    try:
        open_q = slim(fetch_comments(OPEN_PAGE))
    except Exception as e:  # noqa: BLE001 — 主源拉不到就整体放弃、保留旧快照
        print("[skip] 拉观众提案失败，保留旧快照：%s" % e)
        return 0

    per_topic = {}
    for cid in cand_ids:
        try:
            cs = fetch_comments("topic:" + cid)
        except Exception as e:  # noqa: BLE001 — 单个话题失败只跳过它
            print("  · topic:%s 拉取失败(跳过)：%s" % (cid, e))
            continue
        if cs:
            per_topic[cid] = slim(cs)

    inbox = {
        "_note": "GitHub Action(refresh-votes.yml)每12h从投票后端拉的评论快照。云端 routine 够不到后端(403)，收观众提案时改读这份文件(见 ENGINE §4③)；本地能连后端时以后端为准。别手改此文件——它会被自动覆盖。",
        "source": API,
        "open_questions": open_q,
        "per_topic": per_topic,
    }
    n = len(open_q) + sum(len(v) for v in per_topic.values())
    print("拉到评论：观众提案 %d 条 · %d 个候选下有讨论 · 合计 %d 条" % (len(open_q), len(per_topic), n))

    if dry:
        print("[dry-run] 未写文件。")
        return 0
    with open(INBOX, "w", encoding="utf-8") as f:
        json.dump(inbox, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("已写 %s" % INBOX)
    return 0


if __name__ == "__main__":
    sys.exit(main())
