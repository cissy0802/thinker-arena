#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 giscus 讨论的净票(👍 − 👎)回写进 ideas.json 的 candidates[].votes。

为什么用 REST 而不是 GraphQL：云端 routine 环境里 `gh` CLI 往往不存在，且 Anthropic
的 GitHub token 代理只转发 REST、不转发 GraphQL（GraphQL 会被 403 "GraphQL proxying
is not enabled" 拦截）。GitHub Discussions 的 REST 列表接口已自带 `reactions` 汇总
（含 `+1`/`-1` 计数），足够算净票，所以这里走 REST。

用法:
    GH_TOKEN=<token> python3 refresh_votes.py            # 回写并保存 ideas.json
    GH_TOKEN=<token> python3 refresh_votes.py --dry-run  # 只打印、不写文件

读不到票/无 token 时：不报错、不清零，保留 ideas.json 现有 votes（避免把真实票冲掉）。
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
IDEAS = os.path.join(ROOT, "ideas.json")


def fetch_discussions(repo, token):
    """用 REST 拉全部讨论(分页)，返回 [{title, net}]，失败抛异常。"""
    out = []
    page = 1
    while True:
        url = ("https://api.github.com/repos/%s/discussions?per_page=100&page=%d"
               % (repo, page))
        cmd = ["curl", "-sS", "--fail-with-body",
               "-H", "Authorization: bearer %s" % token,
               "-H", "Accept: application/vnd.github+json", url]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError("curl 失败: %s" % (res.stderr or res.stdout)[:300])
        batch = json.loads(res.stdout)
        if not isinstance(batch, list):
            raise RuntimeError("非预期响应: %s" % res.stdout[:300])
        if not batch:
            break
        for d in batch:
            r = d.get("reactions") or {}
            out.append({"title": d.get("title", ""),
                        "net": int(r.get("+1", 0)) - int(r.get("-1", 0))})
        if len(batch) < 100:
            break
        page += 1
    return out


def main():
    dry = "--dry-run" in sys.argv
    with open(IDEAS, encoding="utf-8") as f:
        data = json.load(f)

    repo = data["giscus"]["repo"]
    prefix = data["giscus"].get("termPrefix", "topic:")
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        print("[skip] 无 GH_TOKEN/GITHUB_TOKEN，保留现有 votes，未改动。")
        return 0

    try:
        discussions = fetch_discussions(repo, token)
    except Exception as e:  # noqa: BLE001 — 取票失败就保留原值，别清零
        print("[skip] 取票失败，保留现有 votes：%s" % e)
        return 0

    net_by_id = {}
    for d in discussions:
        t = d["title"]
        if t.startswith(prefix):
            net_by_id[t[len(prefix):]] = d["net"]

    changed = []
    for c in data.get("candidates", []):
        new = net_by_id.get(c["id"], 0)
        old = c.get("votes", 0)
        if new != old:
            changed.append((c["id"], old, new))
        c["votes"] = new

    print("讨论数: %d · 命中候选: %d · votes 变更: %d"
          % (len(discussions), len(net_by_id), len(changed)))
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
