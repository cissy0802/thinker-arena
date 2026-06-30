/* 思想实验田 · 渲染器（中/EN 双语） */
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
    zh: { topic: "本场议题", net: "净支持", aiPanel: "三方 AI 收尾", summary: "综述", insight: "洞察", advice: "给普通人的建议",
      stance: "本场立场", viewProfile: "点击看完整介绍 →", allProfiles: "全部人物图鉴", plainBadge: "悬停看白话",
      plainLabel: "白话", opening: "各陈己见", rebuttal: "交锋反驳", closing: "总结陈词", roundWord: "第 %N 轮",
      members: "位", chanTitle: "圆桌辩论", docTitle: "思想家圆桌辩论",
      hooks: "延伸 · 本场留下的钩子", hooksSub: "三方 AI 在辩论之外看见、本场未及展开的角度",
      railServers: "服务器", backToTopics: "返回议题列表", allTopics: "全部议题" },
    en: { topic: "Topic", net: "Net", aiPanel: "AI panel", summary: "Summary", insight: "Insight", advice: "What to actually do",
      stance: "Stance in this debate", viewProfile: "View full profile →", allProfiles: "All thinkers", plainBadge: "plain reading",
      plainLabel: "Plain", opening: "Opening statements", rebuttal: "Rebuttal", closing: "Closing statements", roundWord: "Round %N",
      members: "", chanTitle: "round-table", docTitle: "Thinkers' Round Table",
      hooks: "Open threads · where this debate points next", hooksSub: "Angles the three AIs saw beyond the room — left for next time",
      railServers: "Servers", backToTopics: "Back to topics", allTopics: "All topics" }
  };
  function T(k) { return UI[LANG][k]; }
  function pick(o, f) { return (LANG === "en" && o && o[f + "_en"] != null) ? o[f + "_en"] : (o ? o[f] : undefined); }

  var THINKERS = {}, REACTS = {}, REACT_ORDER = [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // 把已转义文本里的 **加粗** 标记渲染成 <strong>；* 不被 esc 转义，故标记完整保留
  function mdBold(s) {
    return String(s == null ? "" : s).replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  }
  function tk(id) { return THINKERS[id] || { name: id, name_en: id, char: "?", color: "#888", fg: "#fff", school: "" }; }
  function nameOf(c) { return pick(c, "name"); }
  function glyph(card) { return (LANG === "en" && card.char_en) ? card.char_en : card.char; }
  function avatar(card, size) {
    var fs = Math.round(size * 0.42);
    return '<div class="av" style="width:' + size + 'px;height:' + size + 'px;font-size:' + fs +
      'px;background:' + card.color + ';color:' + card.fg + '">' + esc(glyph(card)) + "</div>";
  }
  function reactorRows(ids) {
    return ids.map(function (id) {
      var c = tk(id);
      return '<div class="rrow">' + avatar(c, 24) + '<span class="nm">' + esc(nameOf(c)) + "</span></div>";
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
      var lbl = LANG === "en" ? rt.label_en : rt.label;
      var head = '<div class="rhead" style="color:' + rt.color + '"><i class="ti ' + rt.icon +
        '" style="font-size:14px"></i><span>' + esc(lbl) + " · " + ids.length + "</span></div>";
      pills.push('<span class="rwrap"><button class="pill" style="border-color:' + rt.color + '">' +
        '<i class="ti ' + rt.icon + '" style="font-size:15px;color:' + rt.color + '"></i>' + ids.length +
        '</button><span class="tip rtip">' + head + reactorRows(ids) + "</span></span>");
    });
    if (!pills.length) return "";
    var netHtml = "";
    if (hasScore) {
      var col = net > 0 ? "#7FCF9A" : net < 0 ? "#ED4245" : "var(--txt-muted)";
      var sign = net > 0 ? "+" + net : "" + net;
      netHtml = '<span class="net">' + T("net") + ' <b style="color:' + col + '">' + sign + "</b></span>";
    }
    return '<div class="reacts">' + pills.join("") + netHtml + "</div>";
  }

  function renderReply(post) {
    if (!post.reply_to) return "";
    var target = (window.__POSTS || {})[post.reply_to];
    if (!target) return "";
    var c = tk(target.thinker);
    var snip = String(pick(target, "text") || "").slice(0, LANG === "en" ? 30 : 16) + "…";
    return '<div class="reply" role="button" tabindex="0" data-target="' + esc(post.reply_to) + '">' +
      '<i class="ti ti-arrow-back-up" style="font-size:14px"></i>' +
      '<span class="at" style="color:' + c.color + '">@' + esc(nameOf(c)) + "</span>" +
      '<span class="quote">' + esc(snip) + "</span>" +
      '<i class="ti ti-arrow-up-right jump"></i></div>';
  }

  function applyGlossary(text, glossary) {
    var safe = esc(text);
    if (!glossary) return safe;
    var terms = Object.keys(glossary).sort(function (a, b) { return b.length - a.length; });
    var map = {};
    terms.forEach(function (term, i) {
      var token = "" + i + "";
      safe = safe.split(esc(term)).join(token);
      map[token] = { term: term, def: glossary[term] };
    });
    Object.keys(map).forEach(function (token) {
      var g = map[token];
      safe = safe.split(token).join('<span class="gloss" role="button" tabindex="0">' + esc(g.term) +
        '<span class="tip gloss-tip"><span class="g-term">' + esc(g.term) + "</span>" +
        '<span class="g-def">' + esc(g.def) + "</span></span></span>");
    });
    return safe;
  }

  function renderBody(post) {
    var c = tk(post.thinker);
    var vern = pick(post, "vernacular");
    if (vern) {
      return '<div class="htext" role="button" tabindex="0">' +
        '<span class="text">' + mdBold(esc(pick(post, "text"))) +
        '<span class="badge-cls"><i class="ti ti-language" style="font-size:12px"></i>' + T("plainBadge") + "</span></span>" +
        '<span class="tip">' +
        '<span class="badge-bai" style="background:' + c.color + ';color:' + c.fg + '">' + T("plainLabel") + "</span>" +
        '<span class="bai">' + mdBold(esc(vern)) + "</span></span></div>";
    }
    return '<div class="text">' + mdBold(applyGlossary(pick(post, "text"), pick(post, "glossary"))) + "</div>";
  }

  function postAvatar(card) {
    var reason = (window.__REASONS || {})[card.id];
    var alt = (LANG === "zh" && card.name_en && card.name_en !== card.name) ? card.name_en : "";
    return '<div class="av-wrap" role="button" tabindex="0">' + avatar(card, 42) +
      '<span class="tip av-tip">' +
      '<span class="at-name" style="color:' + card.color + '">' + esc(nameOf(card)) + "</span>" +
      '<span class="at-handle">' + esc(card.handle || "") + "</span>" +
      (alt ? '<div class="at-name-en">' + esc(alt) + "</div>" : "") +
      '<div class="at-school">' + esc([pick(card, "school"), pick(card, "era")].filter(Boolean).join(" · ")) + "</div>" +
      (reason ? '<div class="at-reason"><b>' + T("stance") + '</b><br>' + esc(reason) + "</div>" : "") +
      "</span></div>";
  }

  function roundLabel(round, maxR) {
    var phase = round === 1 ? T("opening") : (round === maxR && maxR >= 3 ? T("closing") : T("rebuttal"));
    return T("roundWord").replace("%N", round) + " · " + phase;
  }

  function renderPost(post, maxR) {
    var c = tk(post.thinker);
    return '<div class="post" id="' + esc(post.id) + '">' + postAvatar(c) +
      '<div class="body">' + renderReply(post) +
      '<div class="meta"><span class="name" style="color:' + c.color + '">' + esc(nameOf(c)) + "</span>" +
      '<span class="info">' + esc(pick(c, "school")) + " · " + roundLabel(post.round, maxR).split(" · ").pop() + "</span></div>" +
      renderBody(post) + renderReactions(post) + "</div></div>";
  }

  function renderLineup(casting) {
    if (!casting || !casting.length) return "";
    var seats = casting.map(function (s) {
      var c = tk(s.id);
      var reason = pick(s, "reason");
      var tip = (reason ? esc(reason) + "<br>" : "") + '<span style="color:#a29bfe">' + T("viewProfile") + "</span>";
      return '<a class="seat" href="' + PG("profiles") + '#' + esc(s.id) + '">' + avatar(c, 24) +
        '<span class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) + "</span>" +
        '<span class="tip seat-tip">' + tip + "</span></a>";
    }).join("");
    return '<div class="lineup">' + seats + '<a class="seat-all" href="' + PG("profiles") + '">' +
      '<i class="ti ti-users"></i> ' + T("allProfiles") + "</a></div>";
  }

  function renderSummaries(summaries) {
    if (!summaries || !summaries.length) return "";
    var cards = summaries.map(function (s) {
      var c = tk(s.ai);
      return '<div class="sum-card"><div class="who">' + avatar(c, 36) +
        '<div><div class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) + "</div>" +
        '<div class="eng">' + esc(pick(s, "engine") || "") + "</div></div></div>" +
        '<div class="sec-lbl"><i class="ti ti-list" style="font-size:14px"></i>' + T("summary") + "</div>" +
        '<div class="sec-txt">' + mdBold(esc(pick(s, "summary"))) + "</div>" +
        '<div class="sec-lbl" style="margin-top:12px"><i class="ti ti-bulb" style="font-size:14px"></i>' + T("insight") + "</div>" +
        '<div class="sec-txt">' + mdBold(esc(pick(s, "insight"))) + "</div>" +
        (pick(s, "advice") ? '<div class="sec-lbl" style="margin-top:12px"><i class="ti ti-checklist" style="font-size:14px"></i>' + T("advice") + "</div>" +
          '<div class="sec-txt">' + mdBold(esc(pick(s, "advice"))) + "</div>" : "") +
        "</div>";
    }).join("");
    return '<div class="summaries"><div class="sum-head"><span class="ln"></span>' +
      '<span class="lbl"><i class="ti ti-robot" style="font-size:16px"></i>' + T("aiPanel") + "</span>" +
      '<span class="ln"></span></div><div class="sum-grid">' + cards + "</div></div>";
  }

  function renderHooks(hooks) {
    if (!hooks || !hooks.length) return "";
    var items = hooks.map(function (h) {
      var c = tk(h.from);
      return '<div class="hook"><div class="hook-who">' + avatar(c, 26) +
        '<span class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) + "</span></div>" +
        '<div class="hook-txt">' + mdBold(esc(pick(h, "text"))) + "</div></div>";
    }).join("");
    return '<div class="hooks"><div class="sum-head"><span class="ln"></span>' +
      '<span class="lbl"><i class="ti ti-bulb" style="font-size:16px"></i>' + T("hooks") + "</span>" +
      '<span class="ln"></span></div>' +
      '<div class="hooks-sub">' + esc(T("hooksSub")) + "</div>" +
      '<div class="hooks-list">' + items + "</div></div>";
  }

  function renderDebate(debate) {
    window.__POSTS = {};
    debate.posts.forEach(function (p) { window.__POSTS[p.id] = p; });
    window.__REASONS = {};
    (debate.casting || []).forEach(function (c) { window.__REASONS[c.id] = pick(c, "reason"); });
    var maxR = debate.rounds || debate.posts.reduce(function (m, p) { return Math.max(m, p.round); }, 1);

    var html = '<div class="topic"><div class="label"><i class="ti ti-pin" style="font-size:14px"></i>' + T("topic") + "</div>" +
      '<div class="q">' + esc(pick(debate, "question")) + "</div></div>";
    html += renderLineup(debate.casting);
    var cur = null;
    debate.posts.forEach(function (p) {
      if (p.round !== cur) {
        cur = p.round;
        html += '<div class="round-div"><span class="ln"></span><span class="lbl">' + roundLabel(cur, maxR) +
          '</span><span class="ln"></span></div>';
      }
      html += renderPost(p, maxR);
    });
    html += renderSummaries(debate.summaries);
    html += renderHooks(debate.hooks);
    document.getElementById("thread").innerHTML = html;
    setHeader(debate);
    attachInteractions();
  }

  function setHeader(debate) {
    document.title = T("docTitle");
    var ct = document.getElementById("chan-title");
    if (ct) ct.textContent = T("chanTitle");
    var rail = document.querySelector(".rail"); if (rail) rail.setAttribute("aria-label", T("railServers"));
    var srv = document.querySelector(".rail .server"); if (srv) srv.title = T("backToTopics");
    var back = document.querySelector(".chan-header .back"); if (back) back.title = T("allTopics");
    document.getElementById("chan-sub").textContent = pick(debate, "question");
    document.getElementById("member-count").textContent =
      (debate.participants ? debate.participants.length : "") + (T("members") ? " " + T("members") : "");
    var hdr = document.querySelector(".chan-header");
    if (hdr && !document.getElementById("lang-toggle")) {
      var b = document.createElement("button");
      b.id = "lang-toggle"; b.className = "lang-toggle";
      b.textContent = LANG === "zh" ? "EN" : "中";
      b.title = "中 / English";
      b.onclick = function () { location.href = OTHER_LANG_URL(); };
      var members = hdr.querySelector(".members");
      hdr.insertBefore(b, members);
    }
  }

  function placeTip(wrap) {
    var tip = wrap.querySelector(".tip");
    if (!tip) return;
    tip.style.left = "0px";
    var r = tip.getBoundingClientRect();
    var vw = document.documentElement.clientWidth, pad = 8, dx = 0;
    if (r.right > vw - pad) dx = (vw - pad) - r.right;
    if (r.left + dx < pad) dx = pad - r.left;
    if (dx) tip.style.left = Math.round(dx) + "px";
  }

  function attachInteractions() {
    function jump(el) {
      var t = document.getElementById(el.getAttribute("data-target"));
      if (!t) return;
      t.scrollIntoView({ behavior: "smooth", block: "center" });
      t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash");
    }
    document.querySelectorAll(".reply").forEach(function (el) {
      el.addEventListener("click", function () { jump(el); });
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump(el); } });
    });
    function toggle(el) {
      var was = el.classList.contains("open");
      document.querySelectorAll(".rwrap.open,.htext.open,.av-wrap.open,.gloss.open").forEach(function (o) { o.classList.remove("open"); });
      if (!was) { el.classList.add("open"); placeTip(el); }
    }
    document.querySelectorAll(".rwrap,.htext,.av-wrap,.gloss").forEach(function (el) {
      el.addEventListener("mouseenter", function () { placeTip(el); });
      el.addEventListener("click", function (e) { e.stopPropagation(); toggle(el); });
    });
    document.querySelectorAll(".lineup .seat").forEach(function (el) {
      el.addEventListener("mouseenter", function () { placeTip(el); });
    });
    document.addEventListener("click", function () {
      document.querySelectorAll(".rwrap.open,.htext.open,.av-wrap.open,.gloss.open").forEach(function (o) { o.classList.remove("open"); });
    });
  }

  function fail(msg) {
    document.getElementById("thread").innerHTML =
      '<div class="err"><p><b>无法加载数据 / Failed to load</b></p><p>' + msg + "</p>" +
      "<p>本地预览请先起服务器: <code>python3 -m http.server 8080</code></p></div>";
  }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " HTTP " + r.status); return r.json(); }); }

  function boot() {
    var id = new URLSearchParams(location.search).get("d") || "happiness";
    Promise.all([getJSON("thinkers.json"), getJSON("debates/" + id + ".json")])
      .then(function (res) {
        res[0].thinkers.forEach(function (c) { THINKERS[c.id] = c; });
        (res[0].reactionTypes || []).forEach(function (rt) { REACTS[rt.key] = rt; REACT_ORDER.push(rt.key); });
        renderDebate(res[1]);
      })
      .catch(function (e) { fail(esc(e.message || e)); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
