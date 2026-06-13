/* 人物图鉴渲染器 */
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

  Promise.all([getJSON("thinkers.json"), getJSON("profiles.json")])
    .then(function (res) {
      var thinkers = res[0].thinkers;
      var P = res[1].profiles || {};

      document.getElementById("index").innerHTML = thinkers.map(function (c) {
        return '<a class="chip" href="#' + esc(c.id) + '">' + av(c, 22) +
          '<span class="nm">' + esc(c.name) + "</span></a>";
      }).join("");

      document.getElementById("profiles").innerHTML = thinkers.map(function (c) {
        var p = P[c.id];
        var metaArr = [c.school, c.era, c.region].filter(Boolean);
        if (c.region && c.school && c.school.indexOf(c.region) !== -1) metaArr = [c.school, c.era].filter(Boolean);
        var meta = metaArr.map(esc).join(" · ");
        var head = '<div class="head">' + av(c, 52) +
          '<div><div class="nm" style="color:' + c.color + '">' + esc(c.name) +
          ' <span class="handle">' + esc(c.handle || "") + "</span></div>" +
          '<div class="meta">' + meta + "</div></div></div>";

        var body = "";
        if (p) {
          if (p.bio) body += sec("生平", "ti-user", "<p>" + esc(p.bio) + "</p>");
          if (p.ideas) body += sec("主要思想", "ti-bulb", "<p>" + esc(p.ideas) + "</p>");
          if (p.assessments && p.assessments.length) {
            body += sec("他人评价", "ti-quote", p.assessments.map(function (a) {
              return '<div class="assess"><div class="by">' + esc(a.by) + "</div><div class=\"txt\">" + esc(a.text) + "</div></div>";
            }).join(""));
          }
          if (p.quotes && p.quotes.length) body += sec("代表名言", "ti-message-2", list(p.quotes, "quote"));
          if (p.works && p.works.length) body += sec("代表作 · 延伸阅读", "ti-book", list(p.works));
          if (p.lineage) body += sec("思想谱系", "ti-git-branch", "<p>" + esc(p.lineage) + "</p>");
          if (p.trivia) body += sec("趣闻与争议", "ti-sparkles", "<p>" + esc(p.trivia) + "</p>");
        } else {
          var tags = (c.tenets || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
          body += sec("关键词", "ti-tags", '<div class="tags">' + tags + "</div>");
          if (c.system) body += '<div class="todo">完整介绍待补充。一句话定位见上方关键词。</div>';
        }

        return '<div class="card" id="' + esc(c.id) + '">' + head + body +
          '<a class="toplink" href="#index">↑ 回到顶部</a></div>';
      }).join("");

      // 异步渲染完成后，若 URL 带 #id，手动滚过去
      if (location.hash && location.hash.length > 1) {
        var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (t) setTimeout(function () { t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
      }
    })
    .catch(function (e) {
      document.getElementById("profiles").innerHTML =
        '<p style="text-align:center;color:#9aa3bd;padding:40px">无法加载（' + esc(e.message) +
        "）。本地预览请用 <code>python3 -m http.server</code> 打开。</p>";
    });
})();
