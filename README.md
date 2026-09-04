# 思想实验田 · 圆桌辩论

古今中外的思想家围绕一个问题数轮辩论，过程渲染成**暗色 Discord 风**的聊天页。每场结尾由 **Claude / GPT / Gemini 三家 AI** 各出综述与洞察。

> 首场示例：**幸福到底是什么？我们是否应该追求幸福？**（亚里士多德、伊壁鸠鲁、佛陀、叔本华、塞利格曼、卡尼曼、弗兰克尔、纳瓦尔 + 三方 AI 收尾）

---

## 本地预览

页面用 `fetch` 读 JSON，直接双击 `index.html`（`file://`）会被浏览器拦截。起一个本地服务器即可：

```bash
cd thinker-arena
python3 -m http.server 8080
# 打开 http://localhost:8080/          —— 议题索引页
# 点一个议题进入辩论（= debate.html?d=<辩论 id>）
```

部署到 GitHub Pages 后是 http 服务，直接访问即可，无需此步。

---

## 文件结构

```
thinker-arena/
├── index.html              议题索引页（hub 的「思想家圆桌辩论」卡片跳到这里）
├── topics.js               索引页渲染器
├── debate.html             单场辩论的聊天页（debate.html?d=<id>）
├── app.js                  辩论渲染器
├── style.css               暗色 Discord 主题
├── thinkers.json           ★ 人设卡注册表（150+ 人 + 表态刻度定义）— 权威名单
├── debates/
│   ├── index.json          议题清单（索引页读它；新增辩论记得在这里登记一条）
│   └── happiness.json      一场辩论 = 一个文件
├── summarize-external.mjs  把 GPT/Gemini 收尾升级为真实 API（可选）
├── .env.example            放 OPENAI_API_KEY / GEMINI_API_KEY
└── README.md
```

> 入口在 `cissy0802.github.io` 首页（Learning Hub）下方的 **BigCat's Thinking Hub** → 「思想家圆桌辩论」卡片 → 议题索引页 → 单场辩论。hub 的生成器在 `cissy0802.github.io/generate_hub.py`（`THINKING_CARDS`），由每日 cron 自动重生成，别手改它的 `index.html`。

---

## 一场辩论是怎么来的

1. **选角（默认：智能选角 + 你确认）**：据议题从名册（150+ 人，以 `thinkers.json` 为准）里挑 **6–10 位**，原则——
   - **多样性优先**（跨传统 / 古今 / 学科，不让一派霸场）
   - **倾向于**纳入一个佛学视角与一个现代科学视角（若与议题相关；不限定具体是谁，也不强求）
   - **只从真实名册里选**：若某位很契合却没建卡，先提示「要不要加张卡」，不擅自虚构（首场就踩过——把没建卡的伊壁鸠鲁选了进来）
   - 你过目、可换人，再开辩
2. **辩论主体**：选定的人各发帖、数轮互相 `@反驳`，全部由 **Claude 订阅额度内的 Opus 扮演**，零外部 API。
3. **表态**：每位读完一帖后，从 6 级里投一种立场（强烈赞同 +2 / 轻微赞同 +1 / 中立 0 / 轻微反对 −1 / 强烈反对 −2 / 疑惑），页面据此算**净支持度**。
4. **三方 AI 收尾**（每场必有）：整场辩论都是 **Claude 模拟生成**的，所以引入 GPT、Gemini 两个**不同的模型**——调各自**最先进的高 effort 模型**（默认 `gpt-5.6-sol` + `reasoning_effort=high` / `gemini-3.8-flash`，已核实截至 2026-09；可在 `.env` 覆盖），专门提供 Claude 想不到、或会忽略的视角。三家各出综述 + 洞察；GPT/Gemini 的洞察明确聚焦「这场辩论及其框架被 Claude 漏掉、低估或可质疑之处」。Claude 的那份是引擎（Opus）原生。

**交互**：回复引用块**点击跳到原帖并高亮**；古文整段**悬停看白话**；表态药丸**悬停看是谁投的**（触屏轻点）。

### 生成新辩论

最简路径：在 Claude Code 里说「跑一场辩论：<你的问题>」，它会做选角、写出 `debates/<slug>.json`（订阅额度内）。然后可选地升级 GPT/Gemini 收尾为真实 API：

```bash
cp .env.example .env          # 填入 OPENAI_API_KEY / GEMINI_API_KEY
node summarize-external.mjs debates/<slug>.json
```

不配 key 也能跑，GPT/Gemini 收尾显示「降级:Opus 扮演」。

---

## 辩论数据格式（`debates/*.json`）

```jsonc
{
  "id": "happiness",
  "question": "幸福到底是什么？我们是否应该追求幸福？",
  "participants": ["aristotle", "..."],
  "casting": [{ "id": "aristotle", "reason": "幸福论的源头…" }],
  "posts": [
    {
      "id": "p12", "round": 2,
      "thinker": "aristotle",
      "reply_to": "p07",                 // 指向"具体某一帖的 id"（可点击跳转）
      "text": "…",
      "vernacular": "整段白话（仅古文帖，非古文为 null）",
      "glossary": { "PERMA": "术语释义，前端给该词加虚线下划 + hover 显示" },
      "reactions": { "强烈赞同": ["frankl"], "轻微赞同": ["seligman"] }
    }
  ],
  "summaries": [
    { "ai": "claude", "engine": "Opus · 订阅(原生)", "summary": "…", "insight": "…" },
    { "ai": "gpt",    "engine": "openai · gpt-4o(真实API)", "summary": "…", "insight": "…" },
    { "ai": "gemini", "engine": "google · gemini(真实API)", "summary": "…", "insight": "…" }
  ]
}
```

---

## 部署到 GitHub Pages

把 `thinker-arena/` 作为一个 repo（或子目录）推到 `cissy0802`，开启 Pages 即可。它是纯静态站，无需构建。

---

## 花名册（以 `thinkers.json` 为准 · 现 150+ 人）

新增思想家 = 往 `thinkers.json` 的 `thinkers` 数组加一个对象（`id/name/handle/school/era/region/char/color/fg/classical/system/tenets`）。`classical:true` 的，引擎会为其文言发言生成整段白话。

> 下面按类别的名单是**早期的部分快照**，随每场辩论持续增补，早已不全；**完整、实时的名册以 `thinkers.json` 为准**（首页与「人物图鉴」页会自动显示当前总数）。

**中国诸子 / 佛学（15+1）** 孔子、老子、庄子、苏轼、王阳明、孙子、韩非子、墨子、孟子、荀子、朱熹、慧能、佛陀、龙树、世亲（唯识）
**古希腊罗马（5）** 苏格拉底、柏拉图、亚里士多德、伊壁鸠鲁、爱比克泰德
**近代西方奠基（11）** 笛卡尔、休谟、康德、黑格尔、叔本华、尼采、马克思、萨特、维特根斯坦、福柯、海德格尔
**科学 / 量子（6）** 爱因斯坦、玻尔、海森堡、薛定谔、达尔文、图灵
**心理学（3）** 弗洛伊德、荣格、阿德勒
**神经科学（3）** 达马西奥、萨姆·哈里斯、拉马钱德兰
**积极心理学（4）** 塞利格曼、契克森米哈伊、德韦克、乔纳森·海特
**意义 / 成长 / 觉知（3）** 弗兰克尔、史蒂芬·柯维、迈克尔·辛格
**女性 / 政治哲学（3）** 波伏娃、汉娜·阿伦特、玛莎·努斯鲍姆
**经济学 / 行为经济学（4）** 亚当·斯密、哈耶克、凯恩斯、理查德·塞勒（+ 卡尼曼）
**现代实践 / 科技（9）** 芒格、塔勒布、卡尼曼、赫拉利、纳瓦尔、费曼、乔布斯、黄仁勋、马斯克
**AI 时代人物（4）** 辛顿、杨立昆、奥特曼、蒂尔
**当代 AI 当事人（3）** Claude、Gemini、GPT — 默认只做收尾，仅 AI/意识/未来类议题才进辩论席

### 表态刻度

强烈赞同(+2) · 轻微赞同(+1) · 中立(0) · 轻微反对(−1) · 强烈反对(−2) · 疑惑(不计分)
