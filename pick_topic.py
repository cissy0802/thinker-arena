#!/usr/bin/env python3
"""选题：从 ideas.json 的 candidates 里挑本场议题（票王 + 跨类轮询）。

对应 ENGINE.md §0 优先级2。

  取净票最高值 mx → 平票集 = 所有 votes==mx 的候选：
    · 平票集只有 1 条            → 直接选它（清晰票王）。
    · 平票集 >1 条（含全 0 平票）→ 按 cat 分组，每个 category 取组内【最靠前】
                                   的一条当"该类队首"，再在各类队首里做【跨类
                                   轮询(LRU)】：挑 category【最久没开过】的那一个
                                   （从未开过的类最优先），保证五大类均衡轮换，
                                   而不是随机、更不是永远落在最上面那类。
  candidates 为空 → 打印 __SELFPICK__，routine 转 §0 优先级3 自拟新题。

跨类轮询完全由 debated 历史推导（每条已辩都带 cat+date），无需额外状态；
且置顶/票王/自拟开出的场都会进 debated，所以轮询对三种来源一视同仁——
例如连开三场 self，LRU 会自动把接下来让给最久没露面的类。确定性、可复现。

输出（stdout）：
  第一行机器可读： PICK<TAB>id<TAB>cat<TAB>votes<TAB>reason
  其后为问题原文与候选 note，routine 可直接落地（slug 用该 id）。
完整平票集与各类队首（含每类上次开场日期）打到 stderr，便于核对。
"""
import json
import sys
import os
from collections import Counter

IDEAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ideas.json")


def main():
    with open(IDEAS, encoding="utf-8") as f:
        data = json.load(f)
    cands = data.get("candidates", [])

    if not cands:
        print("__SELFPICK__")
        print("candidates 为空——转 ENGINE §0 优先级3，自拟一个有张力的新题。", file=sys.stderr)
        return 0

    mx = max(c.get("votes", 0) for c in cands)
    # 平票集：保持 candidates 列表顺序（列表顺序即人工优先级）
    tie = [c for c in cands if c.get("votes", 0) == mx]

    if len(tie) == 1:
        win, reason = tie[0], "clear-winner"
    else:
        # 每个 category 取组内最靠前的一条当"该类队首"（dict 按插入序 = 列表序）
        champs = {}
        for c in tie:
            champs.setdefault(c.get("cat", "other"), c)
        champ_list = list(champs.values())

        # 跨类轮询(LRU)：从 debated 历史推每类"上次开场日期"，挑最久没开的类
        debated = data.get("debated", [])
        last_seen = {}
        for x in debated:
            c, dt = x.get("cat"), x.get("date", "")
            if c and dt > last_seen.get(c, ""):
                last_seen[c] = dt
        total = Counter(x.get("cat") for x in debated)
        # 排序键：上次开场日期越早越优先（从未开过=""最小，最优先）；
        # 并列再按该类累计已辩场数少者优先；再按 cat 名稳定，确保确定性可复现。
        def key(champ):
            c = champ.get("cat", "other")
            return (last_seen.get(c, ""), total.get(c, 0), c)

        win = min(champ_list, key=key)
        reason = ("single-cat-tie" if len(champ_list) == 1
                  else "lru-category(%d类)" % len(champ_list))

        print("平票集（净票 %d，共 %d 条）：" % (mx, len(tie)), file=sys.stderr)
        for c in tie:
            print("  - [%-6s] %-28s %s" % (c.get("cat", "?"), c["id"], c.get("q", "")), file=sys.stderr)
        print("各类队首（跨类轮询池，按上次开场日期排序）：", file=sys.stderr)
        for champ in sorted(champ_list, key=key):
            c = champ.get("cat", "other")
            mark = " ← 轮到" if champ is win else ""
            print("  * %-6s 上次 %-10s 累计 %2d → %s%s"
                  % (c, last_seen.get(c, "从未"), total.get(c, 0), champ["id"], mark),
                  file=sys.stderr)

    print("PICK\t%s\t%s\t%d\t%s" % (win["id"], win.get("cat", "other"), win.get("votes", 0), reason))
    print(win.get("q", ""))
    if win.get("note"):
        print(win["note"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
