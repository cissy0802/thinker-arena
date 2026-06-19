#!/usr/bin/env node
// 三方 AI 收尾 · 真实 API 升级
// 把一场辩论里 GPT / Gemini 的总结，从「Opus 扮演」升级为各自本尊的真实 API 输出。
// Claude 的总结保持引擎(Opus 订阅)原生不变。
//
// 用法:
//   node summarize-external.mjs debates/happiness.json
//   (从 .env 或环境变量读 OPENAI_API_KEY / GEMINI_API_KEY；缺哪个就跳过哪个)
//
// 设计:辩论主体零 API，只有这一步对 GPT、Gemini 各发 1 次调用，
//       输入≈transcript(几千 token)+输出几百 token，一场几分钱。

import { readFileSync, writeFileSync, existsSync } from "node:fs";

// --- 极简 .env 读取(不引第三方依赖) ---
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const path = process.argv[2];
if (!path) { console.error("用法: node summarize-external.mjs <debates/xxx.json>"); process.exit(1); }

const debate = JSON.parse(readFileSync(path, "utf8"));
const roster = JSON.parse(readFileSync("thinkers.json", "utf8"));
const nameOf = Object.fromEntries(roster.thinkers.map((t) => [t.id, t.name]));

// 把辩论压成 transcript
const transcript = debate.posts
  .map((p) => `[第${p.round}轮] ${nameOf[p.thinker] || p.thinker}：${p.text}`)
  .join("\n");

const basePrompt = (who, lens) => `下面是一场关于「${debate.question}」的思想家圆桌辩论实录。这些发言都由 Claude 生成，你是另一个模型（${who}），视角自然不同——请如实补上你这一路的东西；该认同的共识照说，不必预设这场「有盲点」要去挑刺。${lens ? `你尤其擅长：${lens}。` : ""}

${transcript}

请严格以 JSON 返回中英双语六段。**每段约 150–250 字，写清楚即可；各家独立、互不参照（只管你自己写，不用管别家）**。**每段把最关键的一句结论用 \`**…**\`（Markdown 粗体）标出——克制，每段 1 处、至多 2 处，别整段加粗；中文段标中文、英文段标对应英文**：
{"summary": "综述(中文，约 150–250 字)：务必『先共识、后分歧』——开头先点出这场最大的共识/共同点(往往最值得带走)，再讲分歧的真正焦点。不要一上来就强调歧义",
 "insight": "独到见解(中文，约 150–250 字)：给出一条你认为最值得加的、与全场不同的观察，并把它讲透（为什么成立、对普通人意味着什么）。可以是被忽略的角度、一个具体反例、一种更好的重构、普通人真正会反驳之处、或一个务实的纠偏——**挑这场最该说的那一条；别为了显得深刻而每次都套同一种『太抽象/太文本/太精英化』的框架批判**；若全场已相当周全，直接说『哪一条最该照做、为什么』也好",
 "advice": "给普通人的可操作建议(中文，约 150–250 字)：结合综述与洞察，给 2~3 条当天或本周就能上手的具体行动。可点名援引本场某位思想家最实用的建议，也可补你自己的；落到具体动作，别空泛",
 "summary_en": "The summary in natural, idiomatic English (not a stiff literal translation).",
 "insight_en": "The insight in natural, idiomatic English.",
 "advice_en": "The advice in natural, idiomatic English."}
只返回 JSON，不要任何额外文字。`;

function extractJSON(text) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("响应非 JSON: " + text.slice(0, 120));
  return JSON.parse(text.slice(s, e + 1));
}

async function callOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { console.log("· 跳过 GPT：未配 OPENAI_API_KEY"); return null; }
  // 默认用 OpenAI 当前旗舰 GPT-5.5 + 高 effort(reasoning_effort 支持 high/xhigh)。
  // 想要极限可改 OPENAI_MODEL=gpt-5.5-pro 或 OPENAI_REASONING_EFFORT=xhigh；
  // 改用非推理模型时把 OPENAI_REASONING_EFFORT 留空。
  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const effort = process.env.OPENAI_REASONING_EFFORT === undefined ? "high" : process.env.OPENAI_REASONING_EFFORT;
  const body = {
    model,
    messages: [{ role: "user", content: basePrompt("GPT，OpenAI 的 AI", "务实、可操作、平衡多方") }],
    response_format: { type: "json_object" },
  };
  if (effort) body.reasoning_effort = effort;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("OpenAI HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  const obj = extractJSON(data.choices[0].message.content);
  const tail = `openai · ${model}${effort ? " · " + effort : ""}`;
  return { ...obj, engine: `${tail}(真实API)`, engine_en: `${tail} (live API)` };
}

async function callGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.log("· 跳过 Gemini：未配 GEMINI_API_KEY"); return null; }
  // 默认用 Gemini 当前最先进的 Pro(自带高强度 thinking)，而非 flash。
  // 注意 API id 带 -preview 后缀(2026-02 起，旧 gemini-3-pro 已停用)。
  const model = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: basePrompt("Gemini，Google 的多模态 AI", "广博综合、补全事实与跨域视角") }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) throw new Error("Gemini HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  const obj = extractJSON(data.candidates[0].content.parts[0].text);
  return { ...obj, engine: `google · ${model}(真实API)`, engine_en: `google · ${model} (live API)` };
}

function replaceSummary(ai, payload) {
  const i = debate.summaries.findIndex((s) => s.ai === ai);
  const prev = i === -1 ? {} : debate.summaries[i];
  const entry = {
    ai, engine: payload.engine, engine_en: payload.engine_en || prev.engine_en || payload.engine,
    summary: payload.summary, insight: payload.insight, advice: payload.advice || prev.advice || "",
    // 双语：模型应返回 _en；若没返回，保留原有降级版的 _en，避免英文页空缺
    summary_en: payload.summary_en || prev.summary_en || payload.summary,
    insight_en: payload.insight_en || prev.insight_en || payload.insight,
    advice_en: payload.advice_en || prev.advice_en || payload.advice || "",
  };
  if (i === -1) debate.summaries.push(entry);
  else debate.summaries[i] = entry;
  console.log(`✓ ${ai} 已升级为真实 API（${payload.engine}）${payload.summary_en ? " · 含英文" : " · 英文回退"}`);
}

const [gpt, gemini] = await Promise.all([
  callOpenAI().catch((e) => { console.error("× GPT 失败：" + e.message); return null; }),
  callGemini().catch((e) => { console.error("× Gemini 失败：" + e.message); return null; }),
]);

if (gpt) replaceSummary("gpt", gpt);
if (gemini) replaceSummary("gemini", gemini);

if (gpt || gemini) {
  writeFileSync(path, JSON.stringify(debate, null, 2) + "\n");
  console.log("已写回 " + path);
} else {
  console.log("没有可用的 key，未改动（页面继续显示 Opus 扮演的降级版）。");
}
