/* 人物图鉴渲染器 · 按类别分页（中/EN 双语） */
(function () {
  "use strict";
  var LANG = localStorage.getItem("ta_lang") === "en" ? "en" : "zh";
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
  function av(card, size) {
    var fs = Math.round(size * 0.42);
    return '<div class="av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + fs +
      'px;background:' + card.color + ';color:' + card.fg + '">' + esc(card.char) + "</div>";
  }
  function sec(label, icon, inner) {
    return '<div class="sec"><div class="lbl"><i class="ti ' + icon + '"></i>' + esc(label) + "</div>" + inner + "</div>";
  }
  function list(arr, cls) {
    return "<ul>" + arr.map(function (x) { return '<li class="' + (cls || "") + '">' + esc(x) + "</li>"; }).join("") + "</ul>";
  }
  function nameOf(c) { return pick(c, "name"); }
  function catLabel(cat) { return CAT_EN[cat] && LANG === "en" ? CAT_EN[cat] : cat; }

  var THINKERS = {}, GROUPS = {}, ORDER = [], PROF = {}, CAT_EN = {};

  function profileCard(c) {
    var p = PROF[c.id];
    var metaArr = [pick(c, "school"), c.era, pick(c, "region")].filter(Boolean);
    var sch = pick(c, "school"), reg = pick(c, "region");
    if (reg && sch && sch.indexOf(reg) !== -1) metaArr = [sch, c.era].filter(Boolean);
    var head = '<div class="head">' + av(c, 52) +
      '<div><div class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) +
      ' <span class="handle">' + esc(c.handle || "") + "</span></div>" +
      '<div class="meta">' + metaArr.map(esc).join(" · ") + "</div></div></div>";
    var body = "";
    if (p) {
      if (pick(p, "bio")) body += sec(T("bio"), "ti-user", "<p>" + esc(pick(p, "bio")) + "</p>");
      if (pick(p, "ideas")) body += sec(T("ideas"), "ti-bulb", "<p>" + esc(pick(p, "ideas")) + "</p>");
      var assess = pick(p, "assessments");
      if (assess && assess.length) {
        body += sec(T("assess"), "ti-quote", assess.map(function (a) {
          return '<div class="assess"><div class="by">' + esc(a.by) + '</div><div class="txt">' + esc(a.text) + "</div></div>";
        }).join(""));
      }
      var quotes = pick(p, "quotes");
      if (quotes && quotes.length) body += sec(T("quotes"), "ti-message-2", list(quotes, "quote"));
      var works = pick(p, "works");
      if (works && works.length) body += sec(T("works"), "ti-book", list(works));
      if (pick(p, "lineage")) body += sec(T("lineage"), "ti-git-branch", "<p>" + esc(pick(p, "lineage")) + "</p>");
      if (pick(p, "trivia")) body += sec(T("trivia"), "ti-sparkles", "<p>" + esc(pick(p, "trivia")) + "</p>");
    } else {
      var tags = (pick(c, "tenets") || c.tenets || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      body += sec(T("keywords"), "ti-tags", '<div class="tags">' + tags + "</div>");
      body += '<div class="todo">' + T("todo") + "</div>";
    }
    return '<div class="card" id="' + esc(c.id) + '">' + head + body +
      '<a class="toplink" href="#content">' + T("top") + "</a></div>";
  }

  function renderMenu() {
    var html = '<div class="cat-menu">' + ORDER.map(function (cat) {
      var members = GROUPS[cat];
      var avs = members.slice(0, 7).map(function (c) { return av(c, 26); }).join("");
      return '<a class="cat-card" href="profiles.html?cat=' + encodeURIComponent(cat) + '">' +
        '<div class="cname">' + esc(catLabel(cat)) + '<span class="ccount">' + T("count").replace("%N", members.length) + "</span></div>" +
        '<div class="cavs">' + avs + "</div></a>";
    }).join("") + "</div>";
    document.getElementById("content").innerHTML = html;
  }

  function renderCategory(cat, scrollId) {
    var members = GROUPS[cat] || [];
    var nav = '<div class="cat-nav">' + ORDER.map(function (c) {
      return '<a class="' + (c === cat ? "cur" : "") + '" href="profiles.html?cat=' + encodeURIComponent(c) + '">' + esc(catLabel(c)) + "</a>";
    }).join("") + "</div>";
    var chips = '<div class="index">' + members.map(function (c) {
      return '<a class="chip" href="#' + esc(c.id) + '">' + av(c, 22) + '<span class="nm">' + esc(nameOf(c)) + "</span></a>";
    }).join("") + "</div>";
    var cards = members.map(profileCard).join("");
    document.getElementById("content").innerHTML =
      '<a class="back-link" href="profiles.html"><i class="ti ti-chevron-left"></i>' + T("allCats") + "</a>" +
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
    lt.onclick = function () { localStorage.setItem("ta_lang", LANG === "zh" ? "en" : "zh"); location.reload(); };
  }

  Promise.all([getJSON("thinkers.json"), getJSON("profiles.json")])
    .then(function (res) {
      res[0].thinkers.forEach(function (t) {
        THINKERS[t.id] = t;
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
