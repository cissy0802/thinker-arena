# ENGINE.md · 思想家圆桌辩论 · 云端自主生成规则

这是云端 routine 的执行说明（本地交互版见各人电脑上的 `/think` 命令）。你是引擎本身（Opus），**自主完成、不等任何人确认**。当前工作目录已挂载本仓库（`github.com/cissy0802/thinker-arena`）。

## 0. 选题（按投票）
- **优先级 1（人工置顶）**：若 `IDEAS.md` 顶部有一行 `## 下一场：<议题>`，用它，并在完成后**删掉该行**。
- **优先级 2（默认：选净票王）**：读 `ideas.json` 的 `candidates`，用 `gh api graphql` 查每个议题对应 giscus 讨论（标题＝`topic:`+id）的 👍/👎 数，**选净票最高的那条**：
  ```
  gh api graphql -f query='{repository(owner:"cissy0802",name:"cissy0802.github.io"){discussions(first:100,categoryId:"DIC_kwDOShlsYc4C9f-A"){nodes{title url up:reactions(content:THUMBS_UP){totalCount} down:reactions(content:THUMBS_DOWN){totalCount} comments{totalCount}}}}}'
  ```
  把每个 `candidates[].id` 对到标题 `topic:<id>` 的**净票＝👍−👎**（其他表情不计）；选净票最高者为本场议题（平票或全 0，取清单里最靠前的）。`slug` 直接用该候选的 `id`。
  - **降级**：若云端环境没有 `gh` / 拿不到 token、查不到票数，就直接取 `ideas.json` `candidates` 里**最靠前**的那条（顺序即人工优先级），辩论照常完整——别因为读不到票就卡住。
- **优先级 3**：`candidates` 空了，自拟一个有思想张力的新题（`slug` 用英文短横线）。

## 1. 选角（6–10 位）
- 读 `thinkers.json`（74 人名册，每人含 `system` 人设、`cat` 类别）。
- 规则：**多样性优先**（跨传统/古今/学科，凑出对立阵营）；**倾向**带一个佛学视角（如唯识学）+ 一个现代科学（脑科学）视角，**但不强行关联**。
- **控制重复、用满名册（重要）**：先读 `debates/index.json` 最近几场的 `participants`。名册近 80 人，但目前高度集中在少数几位（Frankl/Naval/Marx/Nietzsche/Harari/Altman/Sapolsky/世亲 反复出场，约 2/3 的人从没上过）。本场选角时：① **最近 2 场出现过的人，最多留 2–3 个**（除非这题确实非他不可）；② 其余席位**优先选最近没用过、甚至从没上场的合适人选**——名册里大量未启用：老子/庄子/孔子/孟子/苏轼/王阳明/慧能/龙树、维特根斯坦/休谟/康德/柏拉图/笛卡尔、波伏娃/阿伦特/努斯鲍姆、斯密/哈耶克/凯恩斯、爱因斯坦/玻尔/达尔文/图灵 等；③ 佛学位与脑科学位**轮换人选**（佛学：佛陀/龙树/世亲/慧能 换着来；脑科学：萨波尔斯基/哈里斯/达马西奥/拉马钱德兰/Wolf 换着来），别每次都同一个。目标：**同一个人别隔一场就又出现，让整个名册转起来**。
- **优先从名册 `id` 选**；唯一例外：为带进真实脑科学研究，可临时引入名册外的相关科学家——若如此，**先往 `thinkers.json` 补一张该人的卡**（id/name/handle/school/era/region/**name_en/school_en/region_en/cat_en/char/char_en/tenets_en**/color/fg/classical/system/tenets/cat；**古代人物的 `era` 还要配 `era_en`**，如「前384–前322」→「384–322 BC」、「约4–5世纪」→「c. 4th–5th century CE」。`tenets_en` 与 `tenets` 同序等长，是招牌概念的英文，如「仁/礼」→「Benevolence/Ritual propriety」），否则前端头像会是灰问号/汉字章、英文页露出中文年代或中文关键词。
- **人物图鉴必补（非可选）**：选定阵容后，**每位选中的思想家若在 `profiles.json` 里还没有条目，必须为他补一条**（键＝该人 id），含 `bio/ideas/assessments[{by,text}]/quotes/works/lineage/trivia` **且每个字段都配 `_en`**（`bio_en`/`ideas_en`/`assessments_en`/`quotes_en`/`works_en`/`lineage_en`/`trivia_en`，英文要地道）。评价与名言只用**真实公认史料，严禁编造**；拿不准的名言改写成「大意 / paraphrased」。**人物图鉴是通用、可复用的介绍——不要把这个人和本场议题绑定**（别写「这一框架直击本题」之类的话；该人在本场的立场/入选理由只写进 `casting[].reason`/`reason_en`）。否则辩论页点选角条头像跳进图鉴是空的「待补充」。

## 2. 撰写辩论（你亲自写，零外部 API）
- **默认 3 轮**：第1轮各陈己见 → 第2轮交锋反驳（一轮，针锋相对、接地气）→ 第3轮**总结陈词**（综合他人+自己、给最终结论，可稍长、再往深挖，落到**给普通人的可操作建议**；别强调「免费/不要钱」，像打广告）。
- **每一轮，每位选中的思想家都要发言**（N 人 × 3 轮 = N×3 帖）。每帖 ~100–150 字（总结陈词可长些）、第一人称、有锋芒、可 `@反驳`。
- **接地气**：照顾普通人真实处境（钱/健康/关系/时间/社会结构/生理机制），多给可操作建议。
- 每帖结构：`{ "id":"pNN", "round", "thinker", "reply_to", "text", "text_en", "vernacular", "vernacular_en", "glossary", "glossary_en", "reactions" }`
  - `reply_to`：指向被反驳的**具体某帖 id**；没有则 `null`。
  - `vernacular`：仅 `classical:true` 的思想家、且发言是文言时，给**整段白话**；否则 `null`。
  - `glossary`：`{ "术语":"定义" }`，把专业术语/外来概念收进来（术语须原样出现在 `text` 里）；**中文术语的定义必须以英文开头**（统一 `英文（中文）：定义`，如 "alienation（异化）：…"、"der letzte Mensch（末人）：…"）——别把英文埋在句中或漏掉；本身是外文/希腊/梵文的（eudaimonia、ataraxia、PERMA、ālaya-vijñāna）已是英文，照常放开头。
  - **双语 `_en`（必填）**：`text_en` 给地道英译；`glossary_en` 是 `{ 英文术语: 英文定义 }`（术语须原样出现在 `text_en` 里）；古文帖的 `vernacular_en` 设为 `""`（空串，英文正文本就是白话、不再显「plain」徽标）。
  - `reactions`：其他在场者各从 6 级表态里投至多一种 `{强烈赞同/轻微赞同/中立/轻微反对/强烈反对/疑惑}`→reactor id 列表，只留非空档。reactor 必须是本场参与者。

## 3. 三方 AI 收尾（每场必有）
- `summaries` 三条：`{ "ai":"claude|gpt|gemini", "engine", "engine_en", "summary", "insight", "advice", "summary_en", "insight_en", "advice_en" }`（**双语 `_en` 全必填**，英文地道；`engine_en` 是 engine 的英文版，如 `Opus 4.8 · subscription (native)`、降级版 `fallback: Opus role-play (no key)`）。三段：`summary`(综述) + `insight`(独到见解) + `advice`(给普通人的可操作建议)。
- **每条 `summary` 先共识、后分歧**：开头点出最大共识（最值得带走的），再讲分歧焦点。
- **`insight` 别套同一种批判**：给一条这场最该说的、与全场不同的观察（被忽略的角度／一个反例／更好的重构／普通人会反驳处／务实纠偏皆可）；**别每次都做『太抽象/太文本/太精英化』的框架批判**——那是 prompt 容易诱发的套路，挑真正最该说的。
- **`advice`**：结合综述与洞察，给 2~3 条当天/本周就能上手的具体行动；可点名援引本场某位思想家最实用的建议，也可补自己的。
- **别泄漏生成过程**：summary / insight / advice 里不要出现「这一版 / 之前的版本 / this version / had been missing」等元信息。
- `claude`：你亲自写，`engine:"Opus 4.8 · 订阅(原生)"`／`engine_en:"Opus 4.8 · subscription (native)"`；`summary`/`insight`/`advice` 三段都要写（含 `_en`）。
- `gpt`/`gemini`：先写降级占位（`engine:"降级:Opus 扮演(未配 KEY)"`／`engine_en:"fallback: Opus role-play (no key)"`，连同 `summary_en`/`insight_en`/`advice`/`advice_en`）。**然后运行 `node summarize-external.mjs debates/<slug>.json`**——若仓库有 `.env`（含 `OPENAI_API_KEY`/`GEMINI_API_KEY`）就会升级为真实 gpt-5.5(high)/gemini-3.1-pro-preview（连 advice 一并产出）；拿不到 key 就保持降级，**辩论照样完整**。它俩 `insight` 给与 Claude 不同的独到观察即可（脚本 prompt 已去掉「专挑 Claude 盲点」的诱导，避免每次都套同一种框架批判）。

## 4. 写文件 + 登记 + 校验
- 写 `debates/<slug>.json`（顶层含 `question`+`question_en`；`casting[]` 每人含 `reason`+`reason_en`）。
- 在 `debates/index.json` 的 `debates` 数组**追加一条** `{id, question, question_en, date(今天 UTC), participants}`。
- **补人物图鉴**：把第 1 步为新人写的 `profiles.json` 条目落盘（每位选角都要在 `profiles.json` 里有条目，含全套 `_en`）。
- 若议题来自 `IDEAS.md`「议题清单」，把那行勾成 `- [x]` 标日期；若来自顶部「下一场」行，删掉该行。
- **维护 `ideas.json`（投票数据）**：① 把本场议题从 `candidates` 移到 `debated`（带 `q`/`q_en`/`date`）；② 用第 0 步查到的**净票（👍−👎）**回写其余 `candidates[].votes`；③ **读观众提案**——标题为 `open-questions` 的讨论（观众在「提个新议题」里提的）+ 各候选讨论里的评论，把**好的新议题/新角度**提炼成新 `candidates`（`id`+`q`+`q_en`，votes:0），并同步加到 `IDEAS.md` 候选清单——这就是「好评论/提案收录进灵感库」。
- 把三家 `insight` 里值得记的新钩子追加到 `IDEAS.md`「各场留下的钩子」（按本议题加小节）。**提炼成新候选要克制**：只有当某钩子的角度**与已辩议题和现有候选都十分不同**时，才立成新候选 `- [ ]`（并加进 `ideas.json` 的 `candidates`）；若只是对某场的补充/延伸，**只留在钩子区、别塞进候选**——候选池求异、换血，别堆同质题（已辩多为 AI/现代生活类，新候选优先往非 AI、跨学科的母题引，好把冷板凳思想家带出来）。**并每次顺手 ruthlessly prune 候选池**：合并/删掉与已辩或现有候选重复、纯补充的题，保持精炼；直接改 `IDEAS.md`/`ideas.json` 即可，**别记录「已砍」历史**。
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
