/* 议题索引页渲染器 */
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

  Promise.all([getJSON("thinkers.json"), getJSON("debates/index.json")])
    .then(function (res) {
      var TK = {};
      res[0].thinkers.forEach(function (c) { TK[c.id] = c; });
      var debates = (res[1].debates || []).slice();

      if (!debates.length) {
        document.getElementById("list").innerHTML = '<div class="empty">还没有辩论。</div>';
        return;
      }

      var html = debates.map(function (d, i) {
        var seats = (d.participants || []).map(function (id) {
          var c = TK[id] || { char: "?", color: "#888", fg: "#fff" };
          return '<span class="av" style="background:' + c.color + ';color:' + c.fg + '">' + esc(c.char) + "</span>";
        }).join("");
        var n = (d.participants || []).length;
        return '<a class="topic-card" href="debate.html?d=' + esc(d.id) + '">' +
          '<div class="idx">第 ' + (i + 1) + ' 场</div>' +
          '<div class="q">' + esc(d.question) + "</div>" +
          '<div class="seats">' + seats + '<span class="more">' + n + " 位思想家 + 三方 AI 收尾</span></div>" +
          '<div class="meta"><span><i class="ti ti-calendar" style="font-size:13px;vertical-align:-2px"></i> ' +
          esc(d.date || "") + '</span><span class="go">进入辩论 →</span></div></a>';
      }).join("");

      document.getElementById("list").innerHTML = html;
    })
    .catch(function (e) {
      document.getElementById("list").innerHTML =
        '<div class="empty">无法加载议题列表（' + esc(e.message) +
        "）。本地预览请用 <code>python3 -m http.server</code> 打开。</div>";
    });
})();
