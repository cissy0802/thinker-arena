/* 思想实验田 · 渲染器 */
(function () {
  "use strict";

  var THINKERS = {};      // id -> card
  var REACTS = {};        // key -> {icon,color,score,label}
  var REACT_ORDER = [];   // [key,...] 渲染顺序

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function tk(id) { return THINKERS[id] || { name: id, char: "?", color: "#888", fg: "#fff", school: "" }; }

  function avatar(card, size) {
    var fs = Math.round(size * 0.42);
    return '<div class="av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + fs +
      'px;background:' + card.color + ';color:' + card.fg + '">' + esc(card.char) + "</div>";
  }

  function reactorRows(ids) {
    return ids.map(function (id) {
      var c = tk(id);
      return '<div class="rrow">' + avatar(c, 24) + '<span class="nm">' + esc(c.name) + "</span></div>";
    }).join("");
  }

  function renderReactions(post) {
    var r = post.reactions || {};
    var pills = [], net = 0, hasScore = false;
    REACT_ORDER.forEach(function (key) {
      var ids = r[key];
      if (!ids || !ids.length) return;
      var rt = REACTS[key];
      if (rt.score != null) { net += rt.score * ids.length; hasScore = true; }
      var head = '<div class="rhead" style="color:' + rt.color + '"><i class="ti ' + rt.icon +
        '" style="font-size:14px"></i><span>' + esc(rt.label) + " · " + ids.length + "</span></div>";
      pills.push(
        '<span class="rwrap"><button class="pill" style="border-color:' + rt.color + '">' +
        '<i class="ti ' + rt.icon + '" style="font-size:15px;color:' + rt.color + '"></i>' + ids.length +
        '</button><span class="tip rtip">' + head + reactorRows(ids) + "</span></span>"
      );
    });
    if (!pills.length) return "";
    var netHtml = "";
    if (hasScore) {
      var col = net > 0 ? "#7FCF9A" : net < 0 ? "#ED4245" : "var(--txt-muted)";
      var sign = net > 0 ? "+" + net : "" + net;
      netHtml = '<span class="net">净支持 <b style="color:' + col + '">' + sign + "</b></span>";
    }
    return '<div class="reacts">' + pills.join("") + netHtml + "</div>";
  }

  function renderReply(post) {
    if (!post.reply_to) return "";
    var target = (window.__POSTS || {})[post.reply_to];
    if (!target) return "";
    var c = tk(target.thinker);
    var snip = String(target.text || "").slice(0, 16) + "…";
    return '<div class="reply" role="button" tabindex="0" data-target="' + esc(post.reply_to) + '">' +
      '<i class="ti ti-arrow-back-up" style="font-size:14px"></i>' +
      '<span class="at" style="color:' + c.color + '">@' + esc(c.name) + "</span>" +
      '<span class="quote">' + esc(snip) + "</span>" +
      '<i class="ti ti-arrow-up-right jump"></i></div>';
  }

  function renderBody(post) {
    var c = tk(post.thinker);
    if (post.vernacular) {
      return '<div class="htext" role="button" tabindex="0">' +
        '<span class="text">' + esc(post.text) +
        '<span class="badge-cls"><i class="ti ti-language" style="font-size:12px"></i>悬停看白话</span></span>' +
        '<span class="tip">' +
        '<span class="badge-bai" style="background:' + c.color + ';color:' + c.fg + '">白话</span>' +
        '<span class="bai">' + esc(post.vernacular) + "</span></span></div>";
    }
    return '<div class="text">' + esc(post.text) + "</div>";
  }

  function postAvatar(card) {
    var reason = (window.__REASONS || {})[card.id];
    return '<div class="av-wrap" role="button" tabindex="0">' + avatar(card, 42) +
      '<span class="tip av-tip">' +
      '<span class="at-name" style="color:' + card.color + '">' + esc(card.name) + "</span>" +
      '<span class="at-handle">' + esc(card.handle || "") + "</span>" +
      '<div class="at-school">' + esc(card.school || "") + " · " + esc(card.era || "") + "</div>" +
      (reason ? '<div class="at-reason"><b>本场立场</b><br>' + esc(reason) + "</div>" : "") +
      "</span></div>";
  }

  function renderPost(post) {
    var c = tk(post.thinker);
    return '<div class="post" id="' + esc(post.id) + '">' + postAvatar(c) +
      '<div class="body">' +
      renderReply(post) +
      '<div class="meta"><span class="name" style="color:' + c.color + '">' + esc(c.name) + "</span>" +
      '<span class="info">' + esc(c.school) + " · 第" + post.round + "轮</span></div>" +
      renderBody(post) +
      renderReactions(post) +
      "</div></div>";
  }

  function renderLineup(casting) {
    if (!casting || !casting.length) return "";
    var seats = casting.map(function (s) {
      var c = tk(s.id);
      return '<span class="seat">' + avatar(c, 24) +
        '<span class="nm" style="color:' + c.color + '">' + esc(c.name) + "</span>" +
        (s.reason ? '<span class="tip seat-tip">' + esc(s.reason) + "</span>" : "") +
        "</span>";
    }).join("");
    return '<div class="lineup">' + seats + "</div>";
  }

  function renderSummaries(summaries) {
    if (!summaries || !summaries.length) return "";
    var cards = summaries.map(function (s) {
      var c = tk(s.ai);
      return '<div class="sum-card">' +
        '<div class="who">' + avatar(c, 36) +
        '<div><div class="nm" style="color:' + c.color + '">' + esc(c.name) + "</div>" +
        '<div class="eng">' + esc(s.engine || "") + "</div></div></div>" +
        '<div class="sec-lbl"><i class="ti ti-list" style="font-size:14px"></i>综述</div>' +
        '<div class="sec-txt">' + esc(s.summary) + "</div>" +
        '<div class="sec-lbl" style="margin-top:12px"><i class="ti ti-bulb" style="font-size:14px"></i>洞察</div>' +
        '<div class="sec-txt">' + esc(s.insight) + "</div></div>";
    }).join("");
    return '<div class="summaries"><div class="sum-head"><span class="ln"></span>' +
      '<span class="lbl"><i class="ti ti-robot" style="font-size:16px"></i>三方 AI 收尾</span>' +
      '<span class="ln"></span></div><div class="sum-grid">' + cards + "</div></div>";
  }

  function renderDebate(debate) {
    window.__POSTS = {};
    debate.posts.forEach(function (p) { window.__POSTS[p.id] = p; });
    window.__REASONS = {};
    (debate.casting || []).forEach(function (c) { window.__REASONS[c.id] = c.reason; });

    var html = "";
    html += '<div class="topic"><div class="label"><i class="ti ti-pin" style="font-size:14px"></i>本场议题</div>' +
      '<div class="q">' + esc(debate.question) + "</div></div>";
    html += renderLineup(debate.casting);

    var curRound = null;
    debate.posts.forEach(function (p) {
      if (p.round !== curRound) {
        curRound = p.round;
        var lbl = curRound === 1 ? "第 1 轮 · 各陈己见" : "第 " + curRound + " 轮 · 交锋反驳";
        html += '<div class="round-div"><span class="ln"></span><span class="lbl">' + lbl +
          '</span><span class="ln"></span></div>';
      }
      html += renderPost(p);
    });

    html += renderSummaries(debate.summaries);

    document.getElementById("thread").innerHTML = html;
    setHeader(debate);
    attachInteractions();
  }

  function setHeader(debate) {
    document.getElementById("chan-title").textContent = "圆桌辩论";
    document.getElementById("chan-sub").textContent = debate.question;
    document.getElementById("member-count").textContent =
      debate.participants ? debate.participants.length : "";
  }

  function attachInteractions() {
    // 回复引用块 → 跳转 + 高亮
    function jump(el) {
      var t = document.getElementById(el.getAttribute("data-target"));
      if (!t) return;
      t.scrollIntoView({ behavior: "smooth", block: "center" });
      t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
    }
    document.querySelectorAll(".reply").forEach(function (el) {
      el.addEventListener("click", function () { jump(el); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(el); }
      });
    });

    // 触屏降级:轻点 reaction / 古文块展开提示,点别处收起(桌面仍可纯 hover)
    function toggle(el) {
      var was = el.classList.contains("open");
      document.querySelectorAll(".rwrap.open,.htext.open,.av-wrap.open").forEach(function (o) { o.classList.remove("open"); });
      if (!was) el.classList.add("open");
    }
    document.querySelectorAll(".rwrap,.htext,.av-wrap").forEach(function (el) {
      el.addEventListener("click", function (e) { e.stopPropagation(); toggle(el); });
    });
    document.addEventListener("click", function () {
      document.querySelectorAll(".rwrap.open,.htext.open,.av-wrap.open").forEach(function (o) { o.classList.remove("open"); });
    });
  }

  function fail(msg) {
    document.getElementById("thread").innerHTML =
      '<div class="err"><p><b>无法加载数据</b></p><p>' + msg + "</p>" +
      "<p>本地预览请在本目录起一个服务器再打开(直接双击 file:// 会被浏览器拦截 fetch):</p>" +
      "<p><code>python3 -m http.server 8080</code> &nbsp;然后访问 &nbsp;<code>http://localhost:8080/</code></p>" +
      "<p>部署到 GitHub Pages 后可直接访问，无需此步。</p></div>";
  }

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.json();
    });
  }

  function boot() {
    var id = new URLSearchParams(location.search).get("d") || "happiness";
    Promise.all([getJSON("thinkers.json"), getJSON("debates/" + id + ".json")])
      .then(function (res) {
        var roster = res[0], debate = res[1];
        roster.thinkers.forEach(function (c) { THINKERS[c.id] = c; });
        (roster.reactionTypes || []).forEach(function (rt) {
          REACTS[rt.key] = rt; REACT_ORDER.push(rt.key);
        });
        renderDebate(debate);
      })
      .catch(function (e) { fail(esc(e.message || e)); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
