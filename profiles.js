/* 人物图鉴渲染器 · 按类别分页（中/EN 双语） */
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
    zh: { title: "人物图鉴 · 思想家圆桌辩论", crumb: "人物图鉴", h1: "人物图鉴",
      sub: "圆桌上每一位思想家，深入认识一下", bio: "生平", ideas: "主要思想", assess: "他人评价",
      quotes: "代表名言", works: "代表作 · 延伸阅读", lineage: "思想谱系", trivia: "趣闻与争议",
      keywords: "关键词", todo: "完整介绍待补充。", top: "↑ 回到顶部", allCats: "所有类别",
      count: "%N 位", failPre: "无法加载（", failPost: "）。本地预览请用 " },
    en: { title: "Thinkers · Round Table", crumb: "Thinkers", h1: "The Thinkers",
      sub: "Get to know each voice at the round table", bio: "Life", ideas: "Key ideas", assess: "How others judged them",
      quotes: "Notable quotes", works: "Major works · further reading", lineage: "Intellectual lineage", trivia: "Trivia & controversy",
      keywords: "Keywords", todo: "Full profile coming soon.", top: "↑ Back to top", allCats: "All categories",
      count: "%N", failPre: "Couldn't load (", failPost: "). For local preview run " }
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
  function glyph(card) { return (LANG === "en" && card.char_en) ? card.char_en : card.char; }
  function av(card, size) {
    var fs = Math.round(size * 0.42);
    return '<div class="av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + fs +
      'px;background:' + card.color + ';color:' + card.fg + '">' + esc(glyph(card)) + "</div>";
  }
  function sec(label, icon, inner) {
    return '<div class="sec"><div class="lbl"><i class="ti ' + icon + '"></i>' + esc(label) + "</div>" + inner + "</div>";
  }
  function list(arr, cls) {
    if (!Array.isArray(arr)) arr = (arr == null ? [] : [arr]);  // 容错：万一不是数组也不炸
    return "<ul>" + arr.map(function (x) { return '<li class="' + (cls || "") + '">' + esc(x) + "</li>"; }).join("") + "</ul>";
  }
  // 把含换行的长文本拆成多段 <p>，便于阅读（单行文本仍是一个 <p>）
  function paras(t) {
    return String(t == null ? "" : t).split(/\n+/).filter(function (s) { return s.trim(); })
      .map(function (s) { return "<p>" + esc(s) + "</p>"; }).join("");
  }
  function nameOf(c) { return pick(c, "name"); }
  function catLabel(cat) { return CAT_EN[cat] && LANG === "en" ? CAT_EN[cat] : cat; }

  var THINKERS = {}, GROUPS = {}, ORDER = [], PROF = {}, CAT_EN = {};

  function profileCard(c) {
    var p = PROF[c.id];
    var metaArr = [pick(c, "school"), pick(c, "era"), pick(c, "region")].filter(Boolean);
    var sch = pick(c, "school"), reg = pick(c, "region");
    if (reg && sch && sch.indexOf(reg) !== -1) metaArr = [sch, pick(c, "era")].filter(Boolean);
    var alt = (LANG === "zh" && c.name_en && c.name_en !== c.name) ? c.name_en : "";
    var head = '<div class="head">' + av(c, 52) +
      '<div><div class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) +
      ' <span class="handle">' + esc(c.handle || "") + "</span></div>" +
      (alt ? '<div class="nm-en">' + esc(alt) + "</div>" : "") +
      '<div class="meta">' + metaArr.map(esc).join(" · ") + "</div></div></div>";
    var body = "";
    // 关键词(tenets)对每位都显示——有完整介绍的也显示
    var tnt = pick(c, "tenets") || c.tenets || [];
    if (tnt.length) {
      var tags = tnt.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      body += sec(T("keywords"), "ti-tags", '<div class="tags">' + tags + "</div>");
    }
    if (p) {
      if (pick(p, "bio")) body += sec(T("bio"), "ti-user", paras(pick(p, "bio")));
      if (pick(p, "ideas")) body += sec(T("ideas"), "ti-bulb", paras(pick(p, "ideas")));
      var assess = pick(p, "assessments");
      if (Array.isArray(assess) && assess.length) {
        body += sec(T("assess"), "ti-quote", assess.map(function (a) {
          a = a || {};
          return '<div class="assess"><div class="by">' + esc(a.by) + '</div><div class="txt">' + esc(a.text) + "</div></div>";
        }).join(""));
      }
      var quotes = pick(p, "quotes");
      if (Array.isArray(quotes) && quotes.length) body += sec(T("quotes"), "ti-message-2", list(quotes, "quote"));
      var works = pick(p, "works");
      if (Array.isArray(works) && works.length) body += sec(T("works"), "ti-book", list(works));
      if (pick(p, "lineage")) body += sec(T("lineage"), "ti-git-branch", paras(pick(p, "lineage")));
      if (pick(p, "trivia")) body += sec(T("trivia"), "ti-sparkles", paras(pick(p, "trivia")));
    } else {
      body += '<div class="todo">' + T("todo") + "</div>";
    }
    return '<div class="card" id="' + esc(c.id) + '">' + head + body +
      '<a class="toplink" href="#content">' + T("top") + "</a></div>";
  }

  function renderMenu() {
    var html = '<div class="cat-menu">' + ORDER.map(function (cat) {
      var members = GROUPS[cat];
      var avs = members.slice(0, 7).map(function (c) { return av(c, 26); }).join("");
      return '<a class="cat-card" href="' + PG("profiles") + '?cat=' + encodeURIComponent(cat) + '">' +
        '<div class="cname">' + esc(catLabel(cat)) + '<span class="ccount">' + T("count").replace("%N", members.length) + "</span></div>" +
        '<div class="cavs">' + avs + "</div></a>";
    }).join("") + "</div>";
    document.getElementById("content").innerHTML = html;
  }

  function renderCategory(cat, scrollId) {
    var members = GROUPS[cat] || [];
    var nav = '<div class="cat-nav">' + ORDER.map(function (c) {
      return '<a class="' + (c === cat ? "cur" : "") + '" href="' + PG("profiles") + '?cat=' + encodeURIComponent(c) + '">' + esc(catLabel(c)) + "</a>";
    }).join("") + "</div>";
    var chips = '<div class="index">' + members.map(function (c) {
      return '<a class="chip" href="#' + esc(c.id) + '">' + av(c, 22) + '<span class="nm">' + esc(nameOf(c)) + "</span></a>";
    }).join("") + "</div>";
    var cards = members.map(function (c) {
      try { return profileCard(c); }
      catch (e) {  // 单张图鉴数据有误也只跳过这一张，别让整页图鉴白屏
        return '<div class="card" id="' + esc(c.id) + '"><div class="head">' + av(c, 52) +
          '<div><div class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) +
          '</div><div class="meta" style="color:#ED4245">该人物图鉴数据格式有误，已跳过（' + esc(String(e.message || e)) + "）</div></div></div></div>";
      }
    }).join("");
    document.getElementById("content").innerHTML =
      '<a class="back-link" href="' + PG("profiles") + '"><i class="ti ti-chevron-left"></i>' + T("allCats") + "</a>" +
      '<div class="cat-title">' + esc(catLabel(cat)) + '</div>' + nav + chips + cards;
    if (scrollId) {
      var t = document.getElementById(scrollId);
      if (t) setTimeout(function () { t.scrollIntoView({ block: "start" }); }, 90);
    }
  }

  // 静态文案 + 语言开关
  document.title = T("title");
  var ct = document.getElementById("crumb-tail"); if (ct) ct.textContent = T("crumb");
  var h1 = document.getElementById("h1"); if (h1) h1.textContent = T("h1");
  var sub = document.getElementById("sub"); if (sub) sub.textContent = T("sub");
  var lt = document.getElementById("lang-toggle");
  if (lt) {
    lt.textContent = LANG === "zh" ? "EN" : "中";
    lt.title = "中 / English";
    lt.onclick = function () { location.href = OTHER_LANG_URL(); };
  }

  Promise.all([getJSON("thinkers.json"), getJSON("profiles.json")])
    .then(function (res) {
      res[0].thinkers.forEach(function (t) {
        THINKERS[t.id] = t;
        if (t.cat === "当代 AI 当事人") return;   // Claude/Gemini/GPT 是收尾评委，不进人物图鉴
        var cat = t.cat || "其他";
        if (!GROUPS[cat]) { GROUPS[cat] = []; ORDER.push(cat); }
        if (t.cat_en && !CAT_EN[cat]) CAT_EN[cat] = t.cat_en;
        GROUPS[cat].push(t);
      });
      PROF = res[1].profiles || {};

      var cat = new URLSearchParams(location.search).get("cat");
      var hashId = location.hash && location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : "";
      if (!cat && hashId && THINKERS[hashId]) cat = THINKERS[hashId].cat;

      if (cat && GROUPS[cat]) renderCategory(cat, hashId && THINKERS[hashId] && THINKERS[hashId].cat === cat ? hashId : null);
      else renderMenu();
    })
    .catch(function (e) {
      document.getElementById("content").innerHTML =
        '<p style="text-align:center;color:#9aa3bd;padding:40px">' + T("failPre") + esc(e.message) +
        T("failPost") + "<code>python3 -m http.server</code></p>";
    });
})();
