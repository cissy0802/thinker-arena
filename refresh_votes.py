#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把后端净票(👍 − 👎)回写进 ideas.json 的 candidates[].votes。

数据源已从 giscus/GitHub Discussions 迁到自建的 Cloudflare Worker + D1
(见 ~/Desktop/cissy0802.github.io/engage-backend/)。投票免 GitHub 登录，
本脚本只需一个公开 GET，不再需要 GH_TOKEN / GraphQL。

用法:
    python3 refresh_votes.py            # 回写并保存 ideas.json
    python3 refresh_votes.py --dry-run  # 只打印、不写文件

读不到票/网络失败时：不报错、不清零，保留 ideas.json 现有 votes（避免把真实票冲掉）。
"""
import json
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
IDEAS = os.path.join(ROOT, "ideas.json")

# 与 ideas.js 保持一致；可用环境变量覆盖(便于本地/预发测试)。
API = os.environ.get("ENGAGE_API", "https://bigcat-engage.cissychen.workers.dev")
PREFIX = "topic:"  # 每议题一个 poll：topic:<id>


def fetch_net_by_id():
    """GET /votes-net?prefix=topic: -> {id: net}，失败抛异常。"""
    url = "%s/votes-net?prefix=%s" % (API.rstrip("/"), urllib.parse.quote(PREFIX))
    # Cloudflare 403s the default Python-urllib UA; send a normal one.
    req = urllib.request.Request(url, headers={"User-Agent": "bigcat-refresh-votes/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not data.get("ok"):
        raise RuntimeError("后端返回 ok=false: %s" % data.get("error"))
    net_by_id = {}
    for poll, row in (data.get("votes") or {}).items():
        if poll.startswith(PREFIX):
            net_by_id[poll[len(PREFIX):]] = int(row.get("net", 0))
    return net_by_id


def main():
    dry = "--dry-run" in sys.argv
    with open(IDEAS, encoding="utf-8") as f:
        data = json.load(f)

    try:
        net_by_id = fetch_net_by_id()
    except Exception as e:  # noqa: BLE001 — 取票失败就保留原值，别清零
        print("[skip] 取票失败，保留现有 votes：%s" % e)
        return 0

    changed = []
    for c in data.get("candidates", []):
        new = net_by_id.get(c["id"], 0)
        old = c.get("votes", 0)
        if new != old:
            changed.append((c["id"], old, new))
        c["votes"] = new

    print("命中议题: %d · votes 变更: %d" % (len(net_by_id), len(changed)))
    for cid, old, new in changed:
        print("  %-32s %d -> %d" % (cid, old, new))

    if dry:
        print("[dry-run] 未写文件。")
        return 0
    if not changed:
        print("无变更，未写文件。")
        return 0

    with open(IDEAS, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("已写回 %s" % IDEAS)
    return 0


if __name__ == "__main__":
    sys.exit(main())
