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

  // ---- Per-speaker audio player (full control bar, matching site-wide TTS) ----
  var RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
  var __p = {
    audio: null, order: [], idx: -1, playing: false,
    rate: parseFloat(localStorage.getItem("ta-tts-rate")) || 1
  };
  function bar() { return document.getElementById("ta-tts"); }
  function setActive(pid) {
    document.querySelectorAll(".tts-active").forEach(function (el) { el.classList.remove("tts-active"); });
    if (!pid) return;
    var el = document.getElementById(pid);
    if (el) { el.classList.add("tts-active"); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }
  function fmt(s) { if (!isFinite(s) || s < 0) s = 0; var m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ":" + (x < 10 ? "0" : "") + x; }
  // Play/pause icon + rate + segment index change rarely — only rewrite them
  // on state change, never inside the per-frame ontimeupdate (rewriting the
  // icon font 4-5×/s is what made pause feel laggy).
  function updState() {
    var b = bar(); if (!b) return;
    b.querySelector(".ta-play").innerHTML = __p.playing
      ? '<i class="ti ti-player-pause-filled"></i>' : '<i class="ti ti-player-play-filled"></i>';
    b.querySelector(".ta-rate").textContent = __p.rate + "×";
    var n = __p.order.length, i = __p.idx;
    b.querySelector(".ta-prog").textContent = n ? (Math.max(0, i) + 1) + "/" + n : "–";
  }
  function updProg() {
    var b = bar(); if (!b) return;
    var au = __p.audio, dur = au && isFinite(au.duration) ? au.duration : 0, cur = au ? au.currentTime : 0;
    b.querySelector(".ta-fill").style.width = dur ? (cur / dur * 100) + "%" : "0%";
    b.querySelector(".ta-time").textContent = fmt(cur) + " / " + fmt(dur);
  }
  function updBar() { updState(); updProg(); }
  // Warm the next few posts while the current one plays. Without this each
  // MP3 only starts downloading once the previous post ends, which reads as a
  // gap between speakers now that audio comes from R2 rather than this origin.
  // Keyed by URL so a reordered thread can never hand back the wrong post.
  var __pf = {};
  function prefetchNext(count) {
    for (var i = 1; i <= count; i++) {
      var j = __p.idx + i;
      if (j >= __p.order.length) break;
      var e = window.__AUDIO && window.__AUDIO[__p.order[j]];
      if (!e || !e.audio || __pf[e.audio]) continue;
      var a = new Audio(e.audio); a.preload = "auto";
      __pf[e.audio] = a;
    }
  }
  function clearPrefetch() {
    Object.keys(__pf).forEach(function (u) {
      var a = __pf[u];
      try { a.pause(); } catch (err) {}
      a.removeAttribute("src"); if (a.load) a.load();
    });
    __pf = {};
  }
  function play(pid) {
    var a = window.__AUDIO && window.__AUDIO[pid]; if (!a) return;
    if (__p.audio) { __p.audio.pause(); __p.audio = null; }
    __p.idx = __p.order.indexOf(pid);
    setActive(pid);
    // Reuse the warmed element if we already started fetching this one.
    var au = __pf[a.audio] || new Audio(a.audio);
    delete __pf[a.audio];
    au.playbackRate = __p.rate;
    __p.audio = au; __p.playing = true;
    au.ontimeupdate = updProg;
    au.onloadedmetadata = updProg;
    au.onended = function () { next(true); };
    au.play().catch(function () { pause(); });
    prefetchNext(2);
    updBar();
  }
  function pause() { if (__p.audio) __p.audio.pause(); __p.playing = false; updState(); }
  function resume() { if (__p.audio) { __p.audio.play(); __p.playing = true; updState(); } else if (__p.order.length) play(__p.order[Math.max(0, __p.idx)]); }
  function toggle() { if (__p.playing) pause(); else resume(); }
  function next(auto) {
    if (__p.idx + 1 < __p.order.length) { play(__p.order[__p.idx + 1]); }
    else { pause(); clearPrefetch(); setActive(null); __p.idx = -1; updBar(); }
  }
  function prev() { if (__p.idx > 0) play(__p.order[__p.idx - 1]); else if (__p.audio) __p.audio.currentTime = 0; }
  function skip(d) { if (__p.audio) { __p.audio.currentTime = Math.max(0, Math.min(__p.audio.duration || 0, __p.audio.currentTime + d)); updBar(); } }
  function cycleRate() {
    var i = (RATES.indexOf(__p.rate) + 1) % RATES.length;
    __p.rate = RATES[i]; localStorage.setItem("ta-tts-rate", __p.rate);
    if (__p.audio) __p.audio.playbackRate = __p.rate; updBar();
  }
  function attachAudioControls() {
    if (!window.__AUDIO) return;
    // Playback order = posts, then AI closers, then closing hooks — in DOM order.
    __p.order = Array.prototype.map.call(document.querySelectorAll(".post, .sum-card, .hook"), function (el) { return el.id; })
      .filter(function (id) { return window.__AUDIO[id]; });
    if (!__p.order.length) return;
    // click a post's speaker button → jump to that post
    document.getElementById("thread").addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".tts-play");
      if (!b) return; e.preventDefault(); play(b.getAttribute("data-post"));
    });
    if (bar()) return;
    var el = document.createElement("div");
    el.id = "ta-tts"; el.className = "ta-tts";
    el.innerHTML =
      '<button class="ta-btn ta-prev" title="上一条"><i class="ti ti-player-track-prev-filled"></i></button>' +
      '<span class="ta-sep"></span>' +
      '<button class="ta-btn ta-back" title="后退10秒">−10</button>' +
      '<button class="ta-btn ta-play" title="播放/暂停"><i class="ti ti-player-play-filled"></i></button>' +
      '<button class="ta-btn ta-fwd" title="前进10秒">+10</button>' +
      '<span class="ta-sep"></span>' +
      '<button class="ta-btn ta-next" title="下一条"><i class="ti ti-player-track-next-filled"></i></button>' +
      '<span class="ta-sep"></span>' +
      '<span class="ta-prog">–</span>' +
      '<span class="ta-seek"><span class="ta-track"></span><span class="ta-fill"></span></span>' +
      '<span class="ta-time">0:00 / 0:00</span>' +
      '<button class="ta-rate" title="速度">1×</button>';
    document.body.appendChild(el);
    el.querySelector(".ta-play").onclick = toggle;
    el.querySelector(".ta-prev").onclick = prev;
    el.querySelector(".ta-next").onclick = function () { next(false); };
    el.querySelector(".ta-back").onclick = function () { skip(-10); };
    el.querySelector(".ta-fwd").onclick = function () { skip(10); };
    el.querySelector(".ta-rate").onclick = cycleRate;
    el.querySelector(".ta-seek").onclick = function (ev) {
      if (!__p.audio || !isFinite(__p.audio.duration)) return;
      var r = this.getBoundingClientRect();
      __p.audio.currentTime = (ev.clientX - r.left) / r.width * __p.audio.duration; updBar();
    };
    updBar();
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
      var aid = "ai-" + s.ai;
      var abtn = (window.__AUDIO && window.__AUDIO[aid])
        ? '<button class="tts-play" data-post="' + esc(aid) + '" title="朗读收尾" aria-label="朗读"><i class="ti ti-volume"></i></button>' : "";
      return '<div class="sum-card" id="' + esc(aid) + '"><div class="who">' + avatar(c, 36) +
        '<div><div class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) + abtn + "</div>" +
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
    var items = hooks.map(function (h, i) {
      var c = tk(h.from);
      var hid = "hook-" + i;
      var hbtn = (window.__AUDIO && window.__AUDIO[hid])
        ? '<button class="tts-play" data-post="' + esc(hid) + '" title="朗读" aria-label="朗读"><i class="ti ti-volume"></i></button>' : "";
      var inner = '<div class="hook-who">' + avatar(c, 26) +
        '<span class="nm" style="color:' + c.color + '">' + esc(nameOf(c)) + "</span>" + hbtn + "</div>" +
        '<div class="hook-txt">' + mdBold(esc(pick(h, "text"))) + "</div>";
      var ans = pick(h, "answer");
      if (!ans) return '<div class="hook" id="' + hid + '">' + inner + "</div>";
      return '<div class="hook has-answer" id="' + hid + '"><div class="hook-main" role="button" tabindex="0" aria-expanded="false">' +
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
      '<div class="q">' + esc(pick(debate, "question")) + "</div>" +
      (pick(debate, "sub") ? '<div class="qsub">' + esc(pick(debate, "sub")) + "</div>" : "") + "</div>";
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

  // The baked MP3s left this repo for R2 (they were 591MB of the 598MB here),
  // and are served by the bigcat-audio Worker. The manifest still stores the
  // original repo-relative path — rewriting it here, once, means every
  // consumer downstream (the per-post buttons and the player) is unaware.
  //
  // Sibling of R2_AUDIO_REPOS in hub.cissychen.com/i18n-tts.js; this repo needs
  // its own copy because its debates are rendered client-side from JSON and
  // never carry the data-tts attributes that script keys off.
  var R2_AUDIO_ORIGIN = "https://bigcat-audio.cissychen.workers.dev";
  function resolveAudio(manifest) {
    if (!manifest) return null;
    Object.keys(manifest).forEach(function (k) {
      var e = manifest[k];
      // "audio/debate/<slug>/<hash>.mp3" -> "<origin>/thinker-arena/debate/<slug>/<hash>.mp3"
      if (e && typeof e.audio === "string" && e.audio.indexOf("audio/") === 0) {
        e.audio = R2_AUDIO_ORIGIN + "/thinker-arena/" + e.audio.slice("audio/".length);
      }
    });
    return manifest;
  }

  function boot() {
    var id = new URLSearchParams(location.search).get("d") || "happiness";
    // Optional per-speaker TTS: an audio manifest may exist for this debate.
    // Only for the Chinese page — the baked audio is Chinese, and the EN page
    // is served by the site-wide single-voice i18n-tts.js instead.
    var manifestUrl = "audio/debate/" + id + "/manifest.json";
    var manifestP = (LANG === "zh")
      ? fetch(manifestUrl).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      : Promise.resolve(null);
    Promise.all([
      getJSON("thinkers.json"),
      getJSON("debates/" + id + ".json"),
      manifestP
    ])
      .then(function (res) {
        res[0].thinkers.forEach(function (c) { THINKERS[c.id] = c; });
        (res[0].reactionTypes || []).forEach(function (rt) { REACTS[rt.key] = rt; REACT_ORDER.push(rt.key); });
        window.__AUDIO = resolveAudio(res[2]);
        renderDebate(res[1]);
      })
      .catch(function (e) { fail(esc(e.message || e)); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
