/* 人物图鉴渲染器 · 按类别分页 */
(function () {
  "use strict";
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
    return '<div class="sec"><div class="lbl"><i class="ti ' + icon + '"></i>' + label + "</div>" + inner + "</div>";
  }
  function list(arr, cls) {
    return "<ul>" + arr.map(function (x) { return '<li class="' + (cls || "") + '">' + esc(x) + "</li>"; }).join("") + "</ul>";
  }

  var THINKERS = {}, GROUPS = {}, ORDER = [], PROF = {};

  function profileCard(c) {
    var p = PROF[c.id];
    var metaArr = [c.school, c.era, c.region].filter(Boolean);
    if (c.region && c.school && c.school.indexOf(c.region) !== -1) metaArr = [c.school, c.era].filter(Boolean);
    var head = '<div class="head">' + av(c, 52) +
      '<div><div class="nm" style="color:' + c.color + '">' + esc(c.name) +
      ' <span class="handle">' + esc(c.handle || "") + "</span></div>" +
      '<div class="meta">' + metaArr.map(esc).join(" · ") + "</div></div></div>";
    var body = "";
    if (p) {
      if (p.bio) body += sec("生平", "ti-user", "<p>" + esc(p.bio) + "</p>");
      if (p.ideas) body += sec("主要思想", "ti-bulb", "<p>" + esc(p.ideas) + "</p>");
      if (p.assessments && p.assessments.length) {
        body += sec("他人评价", "ti-quote", p.assessments.map(function (a) {
          return '<div class="assess"><div class="by">' + esc(a.by) + '</div><div class="txt">' + esc(a.text) + "</div></div>";
        }).join(""));
      }
      if (p.quotes && p.quotes.length) body += sec("代表名言", "ti-message-2", list(p.quotes, "quote"));
      if (p.works && p.works.length) body += sec("代表作 · 延伸阅读", "ti-book", list(p.works));
      if (p.lineage) body += sec("思想谱系", "ti-git-branch", "<p>" + esc(p.lineage) + "</p>");
      if (p.trivia) body += sec("趣闻与争议", "ti-sparkles", "<p>" + esc(p.trivia) + "</p>");
    } else {
      var tags = (c.tenets || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      body += sec("关键词", "ti-tags", '<div class="tags">' + tags + "</div>");
      body += '<div class="todo">完整介绍待补充。</div>';
    }
    return '<div class="card" id="' + esc(c.id) + '">' + head + body +
      '<a class="toplink" href="#content">↑ 回到顶部</a></div>';
  }

  function renderMenu() {
    var html = '<div class="cat-menu">' + ORDER.map(function (cat) {
      var members = GROUPS[cat];
      var avs = members.slice(0, 7).map(function (c) { return av(c, 26); }).join("");
      return '<a class="cat-card" href="profiles.html?cat=' + encodeURIComponent(cat) + '">' +
        '<div class="cname">' + esc(cat) + '<span class="ccount">' + members.length + " 位</span></div>" +
        '<div class="cavs">' + avs + "</div></a>";
    }).join("") + "</div>";
    document.getElementById("content").innerHTML = html;
  }

  function renderCategory(cat, scrollId) {
    var members = GROUPS[cat] || [];
    var nav = '<div class="cat-nav">' + ORDER.map(function (c) {
      return '<a class="' + (c === cat ? "cur" : "") + '" href="profiles.html?cat=' + encodeURIComponent(c) + '">' + esc(c) + "</a>";
    }).join("") + "</div>";
    var chips = '<div class="index">' + members.map(function (c) {
      return '<a class="chip" href="#' + esc(c.id) + '">' + av(c, 22) + '<span class="nm">' + esc(c.name) + "</span></a>";
    }).join("") + "</div>";
    var cards = members.map(profileCard).join("");
    document.getElementById("content").innerHTML =
      '<a class="back-link" href="profiles.html"><i class="ti ti-chevron-left"></i>所有类别</a>' +
      '<div class="cat-title">' + esc(cat) + '</div>' + nav + chips + cards;
    if (scrollId) {
      var t = document.getElementById(scrollId);
      if (t) setTimeout(function () { t.scrollIntoView({ block: "start" }); }, 90);
    }
  }

  Promise.all([getJSON("thinkers.json"), getJSON("profiles.json")])
    .then(function (res) {
      res[0].thinkers.forEach(function (t) {
        THINKERS[t.id] = t;
        var cat = t.cat || "其他";
        if (!GROUPS[cat]) { GROUPS[cat] = []; ORDER.push(cat); }
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
        '<p style="text-align:center;color:#9aa3bd;padding:40px">无法加载（' + esc(e.message) +
        "）。本地预览请用 <code>python3 -m http.server</code> 打开。</p>";
    });
})();
