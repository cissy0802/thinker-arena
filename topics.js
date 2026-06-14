/* 议题索引页渲染器（中/EN 双语） */
(function () {
  "use strict";
  var LANG = localStorage.getItem("ta_lang") === "en" ? "en" : "zh";
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
    lt.onclick = function () { localStorage.setItem("ta_lang", LANG === "zh" ? "en" : "zh"); location.reload(); };
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

      var html = debates.map(function (d, i) {
        var seats = (d.participants || []).map(function (id) {
          var c = TK[id] || { char: "?", color: "#888", fg: "#fff" };
          var g = (LANG === "en" && c.char_en) ? c.char_en : c.char;
          return '<span class="av" style="background:' + c.color + ';color:' + c.fg + '">' + esc(g) + "</span>";
        }).join("");
        var n = (d.participants || []).length;
        return '<a class="topic-card" href="debate.html?d=' + esc(d.id) + '">' +
          '<div class="idx">' + esc(T("session").replace("%N", i + 1)) + "</div>" +
          '<div class="q">' + esc(pick(d, "question")) + "</div>" +
          '<div class="seats">' + seats + '<span class="more">' + n + esc(T("panel")) + "</span></div>" +
          '<div class="meta"><span><i class="ti ti-calendar" style="font-size:13px;vertical-align:-2px"></i> ' +
          esc(d.date || "") + '</span><span class="go">' + T("enter") + "</span></div></a>";
      }).join("");

      document.getElementById("list").innerHTML = html;
    })
    .catch(function (e) {
      document.getElementById("list").innerHTML =
        '<div class="empty">' + T("failPre") + esc(e.message) +
        T("failPost") + "<code>python3 -m http.server</code></div>";
    });
})();
