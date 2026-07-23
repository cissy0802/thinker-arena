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
      hooks: "延伸 · 本场留下的钩子", hooksSub: "三方 AI 在辩论之外看见、本场未及展开的角度", seeAnswer: "点开看答案",
      railServers: "服务器", backToTopics: "返回议题列表", allTopics: "全部议题" },
    en: { topic: "Topic", net: "Net", aiPanel: "AI panel", summary: "Summary", insight: "Insight", advice: "What to actually do",
      stance: "Stance in this debate", viewProfile: "View full profile →", allProfiles: "All thinkers", plainBadge: "plain reading",
      plainLabel: "Plain", opening: "Opening statements", rebuttal: "Rebuttal", closing: "Closing statements", roundWord: "Round %N",
      members: "", chanTitle: "round-table", docTitle: "Thinkers' Round Table",
      hooks: "Open threads · where this debate points next", hooksSub: "Angles the three AIs saw beyond the room — left for next time", seeAnswer: "see the answer",
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

  function ttsBtn(post) {
    var a = window.__AUDIO && window.__AUDIO[post.id];
    if (!a) return "";
    return '<button class="tts-play" data-post="' + esc(post.id) + '" data-src="' +
      esc(a.audio) + '" title="朗读这条" aria-label="朗读"><i class="ti ti-volume"></i></button>';
  }

  function renderPost(post, maxR) {
    var c = tk(post.thinker);
    return '<div class="post" id="' + esc(post.id) + '">' + postAvatar(c) +
      '<div class="body">' + renderReply(post) +
      '<div class="meta"><span class="name" style="color:' + c.color + '">' + esc(nameOf(c)) + "</span>" +
      '<span class="info">' + esc(pick(c, "school")) + " · " + roundLabel(post.round, maxR).split(" · ").pop() + "</span>" +
      ttsBtn(post) + "</div>" +
      renderBody(post) + renderReactions(post) + "</div></div>";
  }

  // ---- Per-speaker audio playback ----
  var __player = { audio: null, order: [], idx: -1, playing: false };
  function stopPlayer() {
    if (__player.audio) { __player.audio.pause(); __player.audio = null; }
    __player.playing = false;
    document.querySelectorAll(".post.tts-active").forEach(function (el) { el.classList.remove("tts-active"); });
    var fab = document.getElementById("tts-fab");
    if (fab) fab.innerHTML = '<i class="ti ti-player-play"></i><span>朗读全场</span>';
  }
  function playPost(pid, chain) {
    var a = window.__AUDIO && window.__AUDIO[pid];
    if (!a) return;
    if (__player.audio) { __player.audio.pause(); __player.audio = null; }
    document.querySelectorAll(".post.tts-active").forEach(function (el) { el.classList.remove("tts-active"); });
    var postEl = document.getElementById(pid);
    if (postEl) { postEl.classList.add("tts-active"); postEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
    var au = new Audio(a.audio);
    au.playbackRate = __player.rate || 1;
    __player.audio = au; __player.playing = true;
    au.onended = function () {
      if (postEl) postEl.classList.remove("tts-active");
      if (chain) {
        var i = __player.order.indexOf(pid);
        if (i >= 0 && i + 1 < __player.order.length) { __player.idx = i + 1; playPost(__player.order[i + 1], true); return; }
      }
      stopPlayer();
    };
    au.play().catch(function () { stopPlayer(); });
  }
  function playAll() {
    if (!window.__AUDIO) return;
    __player.order = Array.prototype.map.call(document.querySelectorAll(".post"), function (el) { return el.id; })
      .filter(function (id) { return window.__AUDIO[id]; });
    if (!__player.order.length) return;
    var fab = document.getElementById("tts-fab");
    if (__player.playing) { stopPlayer(); return; }
    if (fab) fab.innerHTML = '<i class="ti ti-player-stop"></i><span>停止</span>';
    __player.idx = 0; playPost(__player.order[0], true);
  }
  function attachAudioControls() {
    if (!window.__AUDIO) return;
    var thread = document.getElementById("thread");
    thread.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".tts-play");
      if (!b) return;
      e.preventDefault();
      playPost(b.getAttribute("data-post"), false);
    });
    if (!document.getElementById("tts-fab")) {
      var fab = document.createElement("button");
      fab.id = "tts-fab"; fab.className = "tts-fab";
      fab.innerHTML = '<i class="ti ti-player-play"></i><span>朗读全场</span>';
      fab.addEventListener("click", playAll);
      document.body.appendChild(fab);
    }
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

  function renderHookAnswer(a) {
    var h = "";
    if (a.lead) h += '<p class="ha-lead">' + mdBold(esc(a.lead)) + "</p>";
    if (a.table && a.table.rows) {
      var t = a.table;
      h += '<div class="ha-tablewrap"><table class="ha-table"><thead><tr>';
      (t.head || []).forEach(function (col) { h += "<th>" + mdBold(esc(col)) + "</th>"; });
      h += "</tr></thead><tbody>";
      t.rows.forEach(function (row) {
        h += "<tr>";
        row.forEach(function (cell) { h += "<td>" + mdBold(esc(cell)) + "</td>"; });
        h += "</tr>";
      });
      h += "</tbody></table></div>";
    }
    if (a.tail) h += '<p class="ha-tail">' + mdBold(esc(a.tail)) + "</p>";
    return h;
  }
  function renderHooks(hooks) {
    if (!hooks || !hooks.length) return "";
    var items = hooks.map(function (h) {
      var c = tk(h.from);
      var inner = '<div class="hook-who">' + avatar(c, 26) +
        '<span class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) + "</span></div>" +
        '<div class="hook-txt">' + mdBold(esc(pick(h, "text"))) + "</div>";
      var ans = pick(h, "answer");
      if (!ans) return '<div class="hook">' + inner + "</div>";
      return '<div class="hook has-answer"><div class="hook-main" role="button" tabindex="0" aria-expanded="false">' +
        inner + '<div class="hook-toggle"><i class="ti ti-chevron-down"></i><span>' + esc(T("seeAnswer")) + "</span></div></div>" +
        '<div class="hook-answer">' + renderHookAnswer(ans) + "</div></div>";
    }).join("");
    return '<div class="hooks"><div class="sum-head"><span class="ln"></span>' +
      '<span class="lbl"><i class="ti ti-bulb" style="font-size:16px"></i>' + T("hooks") + "</span>" +
      '<span class="ln"></span></div>' +
      '<div class="hooks-sub">' + esc(T("hooksSub")) + "</div>" +
      '<div class="hooks-list">' + items + "</div></div>";
  }

  // ---- login-free comments for this debate (shared Cloudflare Worker) ----
  var CAPI = "https://bigcat-engage.cissychen.workers.dev";
  var TURNSTILE_SITEKEY = "0x4AAAAAADu325m36GEOOMP-"; // Cloudflare Turnstile site key
  var tsLoaded = false;
  function ensureTurnstile() {
    if (!TURNSTILE_SITEKEY || tsLoaded) return;
    tsLoaded = true;
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }
  function mountTurnstile(form, onToken) {
    if (!TURNSTILE_SITEKEY) return;
    ensureTurnstile();
    var slot = document.createElement("div");
    slot.style.marginTop = "10px";
    form.insertBefore(slot, form.querySelector(".dc-row"));
    (function render() {
      if (window.turnstile && window.turnstile.render) {
        window.turnstile.render(slot, { sitekey: TURNSTILE_SITEKEY, theme: "dark", callback: onToken });
      } else { setTimeout(render, 200); }
    })();
  }
  function buildDebateComments(pageKey) {
    var ct = LANG === "en"
      ? { head: "💬 Comments", sub: "No account needed — leave a name (optional) and your comment.",
          namePh: "Name (optional)", bodyPh: "What did you think of this debate?", send: "Post",
          empty: "Be the first to comment.", ok: "Posted. Thanks!", rate: "Too fast — wait a moment.",
          err: "Couldn't post — check and retry.", net: "Network error — try again.", loading: "Loading comments…" }
      : { head: "💬 评论 · Comments", sub: "无需登录 —— 填个名字（可选）就能留言。",
          namePh: "名字（可选）", bodyPh: "这场辩论你怎么看？", send: "发表",
          empty: "还没有评论，来做第一个。", ok: "已发表，谢谢！", rate: "发得太快啦，稍等一下。",
          err: "发表失败，检查一下再试。", net: "网络出错，请重试。", loading: "加载评论中…" };

    var box = document.createElement("section");
    box.className = "dcomments";
    var h = document.createElement("h3"); h.className = "dc-head"; h.textContent = ct.head;
    var sub = document.createElement("div"); sub.className = "dc-sub"; sub.textContent = ct.sub;
    box.appendChild(h); box.appendChild(sub);

    var form = document.createElement("form");
    form.className = "dc-form"; form.style.position = "relative";
    form.innerHTML =
      '<input class="dc-name" type="text" maxlength="40" placeholder="' + esc(ct.namePh) + '">' +
      '<textarea class="dc-body" maxlength="2000" placeholder="' + esc(ct.bodyPh) + '" required></textarea>' +
      '<input class="dc-hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" name="website">' +
      '<div class="dc-row"><button type="submit" class="dc-send">' + esc(ct.send) + '</button><span class="dc-msg"></span></div>';
    var list = document.createElement("div");
    list.className = "dc-list";
    list.innerHTML = '<div class="dc-empty">' + ct.loading + "</div>";
    box.appendChild(form); box.appendChild(list);
    var tsToken = "";
    mountTurnstile(form, function (tok) { tsToken = tok; });

    function fmt(ts) {
      try {
        return new Date(ts).toLocaleDateString(LANG === "en" ? "en-US" : "zh-CN",
          { year: "numeric", month: "short", day: "numeric" });
      } catch (e) { return ""; }
    }
    function item(c) {
      var it = document.createElement("div"); it.className = "dc-item";
      var meta = document.createElement("div"); meta.className = "dc-meta";
      var b = document.createElement("b"); b.textContent = c.name;      // safe
      meta.appendChild(b); meta.appendChild(document.createTextNode(" · " + fmt(c.ts)));
      var body = document.createElement("div"); body.className = "dc-text";
      body.textContent = c.body;                                        // safe
      it.appendChild(meta); it.appendChild(body); return it;
    }
    function renderList(cs) {
      list.innerHTML = "";
      if (!cs || !cs.length) { list.innerHTML = '<div class="dc-empty">' + ct.empty + "</div>"; return; }
      cs.forEach(function (c) { list.appendChild(item(c)); });
    }
    fetch(CAPI + "/comments?page=" + encodeURIComponent(pageKey))
      .then(function (r) { return r.json(); })
      .then(function (d) { renderList(d.ok ? d.comments : []); })
      .catch(function () { list.innerHTML = ""; });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ta = form.querySelector(".dc-body"), name = form.querySelector(".dc-name");
      var hp = form.querySelector(".dc-hp"), msg = form.querySelector(".dc-msg"), send = form.querySelector(".dc-send");
      var text = ta.value.trim(); if (!text) return;
      send.disabled = true; msg.className = "dc-msg"; msg.textContent = "…";
      fetch(CAPI + "/comment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageKey, name: name.value.trim(), body: text, website: hp.value, token: tsToken })
      })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          if (res.d.ok) {
            msg.className = "dc-msg ok"; msg.textContent = ct.ok;
            if (res.d.comment) { var em = list.querySelector(".dc-empty"); if (em) em.remove(); list.appendChild(item(res.d.comment)); }
            ta.value = "";
          } else if (res.s === 429) { msg.className = "dc-msg err"; msg.textContent = ct.rate; }
          else { msg.className = "dc-msg err"; msg.textContent = ct.err; }
        })
        .catch(function () { msg.className = "dc-msg err"; msg.textContent = ct.net; })
        .finally(function () { send.disabled = false; });
    });
    return box;
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
    attachAudioControls();
    // login-free comment section, keyed per debate id
    var debId = (debate && debate.id) || new URLSearchParams(location.search).get("d") || "happiness";
    document.getElementById("thread").appendChild(buildDebateComments("debate:" + debId));
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
    // 钩子答案：点开/收起
    document.querySelectorAll(".hook.has-answer .hook-main").forEach(function (el) {
      function tog() { var open = el.parentNode.classList.toggle("open"); el.setAttribute("aria-expanded", open ? "true" : "false"); }
      el.addEventListener("click", tog);
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(); } });
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
    // Optional per-speaker TTS: an audio manifest may exist for this debate.
    // Missing manifest just means no audio yet — the page renders as before.
    var manifestUrl = "audio/debate/" + id + "/manifest.json";
    Promise.all([
      getJSON("thinkers.json"),
      getJSON("debates/" + id + ".json"),
      fetch(manifestUrl).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ])
      .then(function (res) {
        res[0].thinkers.forEach(function (c) { THINKERS[c.id] = c; });
        (res[0].reactionTypes || []).forEach(function (rt) { REACTS[rt.key] = rt; REACT_ORDER.push(rt.key); });
        window.__AUDIO = res[2] || null;
        renderDebate(res[1]);
      })
      .catch(function (e) { fail(esc(e.message || e)); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
