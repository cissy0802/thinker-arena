# ARCHITECTURE · 数据从哪来、到哪去

思想家圆桌辩论是一个**纯静态站**（GitHub Pages），辩论内容都是提交进仓库的 JSON。
但「投票 / 评论 / 邮件订阅」这类**动态数据**需要一个持久后端。这份文档说明它们怎么流转。

## 三层

```
浏览器（ideas.js / topics.js，GitHub Pages 静态站）
        │  fetch(HTTPS)
        ▼
Cloudflare Worker  ——  远程 API：https://bigcat-engage.cissychen.workers.dev
   /votes-net · 投票 up/down · /comments · /subscribe
        │
        ▼
Cloudflare D1  ——  数据库（serverless SQLite）：持久存 票 / 评论 / 订阅者
```

- **前端**：静态页直接 `fetch` Worker，实时显示票数与评论。
- **后端**：一个 Cloudflare **Worker**（无服务器函数）。源码在本机 `~/Desktop/cissy0802.github.io/engage-backend/`，用 `wrangler` 部署到 Cloudflare。
- **数据库**：Cloudflare **D1** 就是那个数据库（免服务器、有免费额度）。**是的，需要数据库——D1 就是。**
- 为什么自建（而非早期的 giscus/GitHub Discussions）：**让人不登录 GitHub 也能投票/评论**，降低门槛。
- 约定：每个议题一个投票 poll，key＝`topic:`+id；评论按 `page` 归类（`topic:`+id 是候选讨论，`thinker-open-questions` 是观众提新题）。

## 一堵墙：云端 routine 够不到后端

云端选题/生成 routine 跑在一个 container 里，出站走 **agent 出口代理**，该代理**不放行**
`bigcat-engage…workers.dev`（返回 403）。所以 routine 自己**读不到票、也读不到评论**。
（浏览器和 GitHub Actions runner 都不在这堵墙后面，够得到。）

**桥**：用 GitHub Action（`.github/workflows/refresh-votes.yml`，runner 能连后端）每 12h：
- `refresh_votes.py` → 把净票写进 `ideas.json` 的 `candidates[].votes`；
- `refresh_inbox.py` → 把评论快照进 `audience_inbox.json`。

于是 routine **只读仓库里的文件**就拿到了后端数据，无需连后端。

## 选题闭环（ENGINE.md §0 / §4）

```
观众投票/提案 → Worker → D1
        │  Action 每12h 拉
        ▼
ideas.json(votes) · audience_inbox.json(comments)  ← 提交进仓库
        │  routine 读文件
        ▼
§0 选题：① 置顶队列(IDEAS.md ## 下一场) → ② 票王(votes 最高) → ③ 自拟
§4 收尾：读 audience_inbox.json，把好提案提炼成新候选
```

## 各文件职责

| 文件 | 作用 | 谁写 |
|---|---|---|
| `IDEAS.md` | 候选清单（人手编辑源，行尾 `<!--id-->`）+ 置顶队列 + 钩子 | 人 / routine |
| `ideas.json` | 投票页数据源（候选/已辩 + votes） | `sync_ideas.py`(从 IDEAS.md) + `refresh_votes.py`(票) |
| `audience_inbox.json` | 观众评论快照 | `refresh_inbox.py`（Action，勿手改） |
| `thinkers.json` | 人设卡注册表（权威名册） | 人 / routine |
| `profiles.json` | 人物图鉴 | 人 / routine |
| `debates/*.json` | 每场辩论 | routine（`/think` 或云端） |
| `debates/index.json` | 已辩清单（索引页读它） | routine |

## GitHub Actions

- `sync-ideas.yml` — IDEAS.md 改动时，把候选同步进 ideas.json（按 `<!--id-->` 保住票/英文）。
- `refresh-votes.yml` — 每 12h 拉后端的票 + 评论进 `ideas.json` / `audience_inbox.json`。
