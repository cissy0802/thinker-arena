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

const basePrompt = (who, lens) => `下面是一场关于「${debate.question}」的思想家圆桌辩论实录。

重要：这场辩论里所有思想家的发言，都是由 Claude(Anthropic 的 AI)模拟生成的。因此它可能带有 Claude 自身的视角与盲点。你是 ${who}，一个不同的模型——你的价值，正在于提供 Claude 想不到、或会忽略的东西。

${transcript}

请输出两段中文，严格以 JSON 返回：
{"summary": "综述：务必『先共识、后分歧』——开头先明确点出这场最大的共识/共同点(往往是最值得带走的)，再讲分歧的真正焦点。不要一上来就强调歧义(150~240字)",
 "insight": "你的独到见解：作为 ${who}(${lens})，明确指出这场辩论及其框架被忽略、低估或可质疑之处，给出与 Claude 不同的视角(150~220字)"}
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
  return { ...obj, engine: `openai · ${model}${effort ? " · " + effort : ""}(真实API)` };
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
  return { ...obj, engine: `google · ${model}(真实API)` };
}

function replaceSummary(ai, payload) {
  const i = debate.summaries.findIndex((s) => s.ai === ai);
  const entry = { ai, engine: payload.engine, summary: payload.summary, insight: payload.insight };
  if (i === -1) debate.summaries.push(entry);
  else debate.summaries[i] = entry;
  console.log(`✓ ${ai} 已升级为真实 API（${payload.engine}）`);
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
