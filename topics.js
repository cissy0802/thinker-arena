/* 议题索引页渲染器（中/EN 双语） */
(function () {
  "use strict";
  var LANG = /\.en\.html$/i.test(location.pathname) ? "en" : "zh";
  function PG(n) { return n + (LANG === "en" ? ".en.html" : ".html"); }
  function OTHER_LANG_URL() {
    var p = location.pathname, np;
    if (/\.en\.html$/i.test(p)) np = p.replace(/\.en\.html$/i, ".html");
    else if (/\.html$/i.test(p)) np = p.replace(/\.html$/i, ".en.html");
    else np = p.replace(/\/?$/, "/") + "index.en.html";
    return np + location.search + location.hash;
  }
  var UI = {
    zh: { h1: "思想家圆桌辩论", tagline: "古今中外的思想家，就一个问题数轮辩论 · 三家 AI 收尾",
      profiles: "人物图鉴 →", ideas: "议题投票 →", session: "第 %N 场", panel: "位思想家 + 三方 AI 收尾", enter: "进入辩论 →",
      empty: "还没有辩论。", loading: "加载中…", failPre: "无法加载议题列表（", failPost: "）。本地预览请用 ",
      title: "思想家圆桌辩论 · BigCat's Thinking Hub" },
    en: { h1: "Thinkers' Round Table", tagline: "Great minds across eras and traditions debate one question over rounds · closed by an AI panel",
      profiles: "All thinkers →", ideas: "Vote on topics →", session: "Debate %N", panel: " thinkers + AI panel", enter: "Enter debate →",
      empty: "No debates yet.", loading: "Loading…", failPre: "Couldn't load the topic list (", failPost: "). For local preview run ",
      title: "Thinkers' Round Table · BigCat's Thinking Hub" }
  };
  function T(k) { return UI[LANG][k]; }
  // 主题分组（与 ideas 投票页一致；cat 存在 debates/index.json 每场的 cat 字段）
  var CATS = [
    { key: "self",   zh: "处世 · 自我 · 成长",   en: "Self, growth & living" },
    { key: "life",   zh: "人生 · 生死 · 家庭",   en: "Life, family & mortality" },
    { key: "ethics", zh: "伦理 · 政治 · 社会",   en: "Ethics, politics & society" },
    { key: "meta",   zh: "形而上 · 认识 · 文明", en: "Mind, reality & civilization" },
    { key: "work",   zh: "职场 · 组织 · 领导",   en: "Work, org & leadership" },
    { key: "other",  zh: "其他",                en: "More" }
  ];
  function catLabel(c) { return LANG === "en" ? c.en : c.zh; }
  function pick(o, f) { return (LANG === "en" && o && o[f + "_en"] != null) ? o[f + "_en"] : (o ? o[f] : undefined); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getJSON(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " HTTP " + r.status); return r.json(); });
  }

  // 静态文案 + 语言开关
  document.title = T("title");
  var h1 = document.getElementById("h1"); if (h1) h1.textContent = T("h1");
  var tg = document.getElementById("tagline"); if (tg) tg.textContent = T("tagline");
  var pl = document.querySelector("#profiles-link span"); if (pl) pl.textContent = T("profiles");
  var il = document.querySelector("#ideas-link span"); if (il) il.textContent = T("ideas");
  var lt = document.getElementById("lang-toggle");
  if (lt) {
    lt.textContent = LANG === "zh" ? "EN" : "中";
    lt.title = "中 / English";
    lt.onclick = function () { location.href = OTHER_LANG_URL(); };
  }

  Promise.all([getJSON("thinkers.json"), getJSON("debates/index.json")])
    .then(function (res) {
      var TK = {};
      res[0].thinkers.forEach(function (c) { TK[c.id] = c; });
      var debates = (res[1].debates || []).slice();

      if (!debates.length) {
        document.getElementById("list").innerHTML = '<div class="empty">' + T("empty") + "</div>";
        return;
      }

      // 每场记真实场次号（按 index.json 原序），再按主题分组、组内最新在前
      debates.forEach(function (d, i) { d.__n = i + 1; });
      function card(d) {
        var seats = (d.participants || []).map(function (id) {
          var c = TK[id] || { char: "?", color: "#888", fg: "#fff" };
          var g = (LANG === "en" && c.char_en) ? c.char_en : c.char;
          return '<span class="av" style="background:' + c.color + ';color:' + c.fg + '">' + esc(g) + "</span>";
        }).join("");
        var n = (d.participants || []).length;
        return '<a class="topic-card" href="' + PG("debate") + '?d=' + esc(d.id) + '">' +
          '<div class="idx">' + esc(T("session").replace("%N", d.__n)) + "</div>" +
          '<div class="q">' + esc(pick(d, "question")) + "</div>" +
          '<div class="seats">' + seats + '<span class="more">' + n + esc(T("panel")) + "</span></div>" +
          '<div class="meta"><span><i class="ti ti-calendar" style="font-size:13px;vertical-align:-2px"></i> ' +
          esc(d.date || "") + '</span><span class="go">' + T("enter") + "</span></div></a>";
      }
      var html = "";
      CATS.forEach(function (cat) {
        var members = debates.filter(function (d) { return (d.cat || "other") === cat.key; });
        if (!members.length) return;
        members.sort(function (a, b) { return b.__n - a.__n; }); // 最新场在前
        html += '<div class="cat-sec">' +
          '<button class="cat-head" type="button" aria-expanded="false">' +
          '<i class="ti ti-chevron-right chev"></i>' +
          '<span class="cat-name">' + esc(catLabel(cat)) + "</span>" +
          '<span class="cat-count">' + members.length + "</span></button>" +
          '<div class="cat-body">' + members.map(card).join("") + "</div></div>";
      });
      document.getElementById("list").innerHTML = html;
      // 每个主题可折叠（默认收起，点表头展开）——议题多了不必一直往下滑
      document.querySelectorAll(".cat-sec .cat-head").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var open = btn.parentNode.classList.toggle("open");
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
      });
    })
    .catch(function (e) {
      document.getElementById("list").innerHTML =
        '<div class="empty">' + T("failPre") + esc(e.message) +
        T("failPost") + "<code>python3 -m http.server</code></div>";
    });
})();
