# ENGINE.md · 思想家圆桌辩论 · 云端自主生成规则

这是云端 routine 的执行说明（本地交互版见各人电脑上的 `/think` 命令）。你是引擎本身（Opus），**自主完成、不等任何人确认**。当前工作目录已挂载本仓库（`github.com/cissy0802/thinker-arena`）。

## 0. 选题
- **优先级 1**：若 `IDEAS.md` 顶部有一行 `## 下一场：<议题>`，用它作为本场议题，并在完成后**删掉该行**。
- **优先级 2**：否则从 `IDEAS.md`「议题清单」里挑一个**未勾选 `- [ ]`** 的候选议题。
- **优先级 3**：若清单全勾完，自拟一个有思想张力的新题。
- 给议题起一个英文短横线 `slug`（如 `attention-and-meaning`）。

## 1. 选角（6–10 位）
- 读 `thinkers.json`（74 人名册，每人含 `system` 人设、`cat` 类别）。
- 规则：**多样性优先**（跨传统/古今/学科，凑出对立阵营）；**倾向**带一个佛学视角（如唯识学）+ 一个现代科学（脑科学）视角，**但不强行关联**。
- **优先从名册 `id` 选**；唯一例外：为带进真实脑科学研究，可临时引入名册外的相关科学家——若如此，**先往 `thinkers.json` 补一张该人的卡**（id/name/handle/school/era/region/**name_en/school_en/region_en/cat_en/char/char_en**/color/fg/classical/system/tenets/cat；**古代人物的 `era` 还要配 `era_en`**，如「前384–前322」→「384–322 BC」、「约4–5世纪」→「c. 4th–5th century CE」），否则前端头像会是灰问号/汉字章、英文页露出中文年代。
- **人物图鉴必补（非可选）**：选定阵容后，**每位选中的思想家若在 `profiles.json` 里还没有条目，必须为他补一条**（键＝该人 id），含 `bio/ideas/assessments[{by,text}]/quotes/works/lineage/trivia` **且每个字段都配 `_en`**（`bio_en`/`ideas_en`/`assessments_en`/`quotes_en`/`works_en`/`lineage_en`/`trivia_en`，英文要地道）。评价与名言只用**真实公认史料，严禁编造**；拿不准的名言改写成「大意 / paraphrased」。否则辩论页点选角条头像跳进图鉴是空的「待补充」。

## 2. 撰写辩论（你亲自写，零外部 API）
- **默认 3 轮**：第1轮各陈己见 → 第2轮交锋反驳（一轮，针锋相对、接地气）→ 第3轮**总结陈词**（综合他人+自己、给最终结论，可稍长、再往深挖，落到**给普通人的可操作建议**；别强调「免费/不要钱」，像打广告）。
- **每一轮，每位选中的思想家都要发言**（N 人 × 3 轮 = N×3 帖）。每帖 ~100–150 字（总结陈词可长些）、第一人称、有锋芒、可 `@反驳`。
- **接地气**：照顾普通人真实处境（钱/健康/关系/时间/社会结构/生理机制），多给可操作建议。
- 每帖结构：`{ "id":"pNN", "round", "thinker", "reply_to", "text", "text_en", "vernacular", "vernacular_en", "glossary", "glossary_en", "reactions" }`
  - `reply_to`：指向被反驳的**具体某帖 id**；没有则 `null`。
  - `vernacular`：仅 `classical:true` 的思想家、且发言是文言时，给**整段白话**；否则 `null`。
  - `glossary`：`{ "术语":"定义" }`，把专业术语/外来概念收进来（术语须原样出现在 `text` 里）；**中文术语的定义带上英文**（异化 alienation、多巴胺 dopamine、皮质醇 cortisol…）；本身是外文/希腊语的（eudaimonia、ataraxia、PERMA）无需再加。
  - **双语 `_en`（必填）**：`text_en` 给地道英译；`glossary_en` 是 `{ 英文术语: 英文定义 }`（术语须原样出现在 `text_en` 里）；古文帖的 `vernacular_en` 设为 `""`（空串，英文正文本就是白话、不再显「plain」徽标）。
  - `reactions`：其他在场者各从 6 级表态里投至多一种 `{强烈赞同/轻微赞同/中立/轻微反对/强烈反对/疑惑}`→reactor id 列表，只留非空档。reactor 必须是本场参与者。

## 3. 三方 AI 收尾（每场必有）
- `summaries` 三条：`{ "ai":"claude|gpt|gemini", "engine", "engine_en", "summary", "insight", "summary_en", "insight_en" }`（**双语 `_en` 全必填**，英文地道；`engine_en` 是 engine 的英文版，如 `Opus · subscription (native)`、降级版 `fallback: Opus role-play (no key)`）。
- **每条 `summary` 先共识、后分歧**：开头点出最大共识（最值得带走的），再讲分歧焦点。
- `claude`：你亲自写，`engine:"Opus · 订阅(原生)"`／`engine_en:"Opus · subscription (native)"`。`insight` 是审慎权衡的独到观察。
- `gpt`/`gemini`：先写降级占位（`engine:"降级:Opus 扮演(未配 KEY)"`／`engine_en:"fallback: Opus role-play (no key)"`，连同 `summary_en`/`insight_en`）。**然后运行 `node summarize-external.mjs debates/<slug>.json`**——若仓库有 `.env`（含 `OPENAI_API_KEY`/`GEMINI_API_KEY`）就会升级为真实 gpt-5.5(high)/gemini-3.1-pro-preview；拿不到 key 就保持降级，**辩论照样完整**。它俩的 `insight` 须明确指出「这场（Claude 模拟的）辩论被漏掉/低估/可质疑之处」。

## 4. 写文件 + 登记 + 校验
- 写 `debates/<slug>.json`（顶层含 `question`+`question_en`；`casting[]` 每人含 `reason`+`reason_en`）。
- 在 `debates/index.json` 的 `debates` 数组**追加一条** `{id, question, question_en, date(今天 UTC), participants}`。
- **补人物图鉴**：把第 1 步为新人写的 `profiles.json` 条目落盘（每位选角都要在 `profiles.json` 里有条目，含全套 `_en`）。
- 若议题来自 `IDEAS.md`「议题清单」，把那行勾成 `- [x]` 标日期；若来自顶部「下一场」行，删掉该行。
- 把三家 `insight` 里值得记的新钩子追加到 `IDEAS.md`「各场留下的钩子」（按本议题加小节）；适合成题的提炼成新候选项 `- [ ]`。
- 用 `python3 -c` 校验：两个 JSON 合法；`thinker`/`reaction key`/`reply_to`/`ai`/`participants` 引用都在册；每轮人人到齐；`glossary` 术语在各自 `text` 里、`glossary_en` 术语在各自 `text_en` 里；**每帖有 `text_en`、每条 summary 有 `summary_en`/`insight_en`、`question_en` 在场**；**每位 `participants` 都在 `profiles.json` 里有条目**。

## 5. 发布
```
git add -A && git commit -m "新增辩论：<议题>" && git push origin main
```
（GitHub Pages 自动部署。`.env` 已 gitignore，不会被提交。）

## 6. 推送手机通知
完成后调用 **PushNotification**（`status:"proactive"`，一行 <200 字符、无 markdown）：
`新辩论已上线：<议题> · N位思想家+三方AI收尾 · cissy0802.github.io/thinker-arena`
（若该工具不可用就跳过，不报错。）
