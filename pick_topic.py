#!/usr/bin/env python3
"""选题：从 ideas.json 的 candidates 里挑本场议题（票王 + 分类均衡随机）。

对应 ENGINE.md §0 优先级2 的平票处理。历史行为是「平票取清单最靠前的一条」，
于是永远落在候选清单最前面那个 category（处世·自我）。本脚本改为：

  取净票最高值 mx → 平票集 = 所有 votes==mx 的候选：
    · 平票集只有 1 条            → 直接选它（清晰票王，无需随机）。
    · 平票集 >1 条（含全 0 平票）→ 按 cat 分组，每个 category 取组内【最靠前】
                                   的一条当"该类票王"，再从这些类冠军里【随机
                                   抽一个】——保证跨 category 轮换，而不是永远
                                   选最上面那个类。
  candidates 为空 → 打印 __SELFPICK__，routine 转 §0 优先级3 自拟新题。

随机源：默认用「当天日期 + 参与随机的类冠军 id 集合」做种子——同一天、同一副
平票牌面可复现（便于测试与日志核对），跨天或牌面变化即换结果。可用环境变量
PICK_SEED 覆盖（测试固定用）。

输出（stdout）：
  第一行机器可读： PICK<TAB>id<TAB>cat<TAB>votes<TAB>reason
  其后为问题原文与候选 note，routine 可直接落地（slug 用该 id）。
完整平票集与各类冠军池打到 stderr，便于日志核对。
"""
import json
import sys
import os
import random
import datetime

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
        # 每个 category 取组内最靠前的一条当"该类票王"（dict 按插入序 = 列表序）
        champs = {}
        for c in tie:
            champs.setdefault(c.get("cat", "other"), c)
        champ_list = list(champs.values())

        if len(champ_list) == 1:
            # 平票全挤在同一个 category——退化为该类最靠前那条，无从"跨类随机"
            win, reason = champ_list[0], "single-cat-tie"
        else:
            seed = os.environ.get("PICK_SEED") or (
                datetime.date.today().isoformat()
                + "|"
                + ",".join(sorted(c["id"] for c in champ_list))
            )
            win = random.Random(seed).choice(champ_list)
            reason = "tie-random(%d类)" % len(champ_list)

        print("平票集（净票 %d，共 %d 条）：" % (mx, len(tie)), file=sys.stderr)
        for c in tie:
            print("  - [%-6s] %-28s %s" % (c.get("cat", "?"), c["id"], c.get("q", "")), file=sys.stderr)
        print("各类票王（随机抽取池）：", file=sys.stderr)
        for cat, c in champs.items():
            mark = " ← 抽中" if c is win else ""
            print("  * %-6s → %s%s" % (cat, c["id"], mark), file=sys.stderr)

    print("PICK\t%s\t%s\t%d\t%s" % (win["id"], win.get("cat", "other"), win.get("votes", 0), reason))
    print(win.get("q", ""))
    if win.get("note"):
        print(win["note"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
