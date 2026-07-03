/* 议题投票页 · 中/EN 双语 · 免登录投票+评论（Cloudflare Worker 后端，取代 giscus/GitHub） */
(function () {
  "use strict";

  // ======= CONFIG ===========================================================
  var API = "https://bigcat-engage.cissychen.workers.dev"; // 同源已在 Worker CORS 放行
  var VOTE_PREFIX = "topic:";        // 每议题一个 poll：topic:<id>
  var OPEN_TERM = "thinker-open-questions"; // 观众提新议题的评论区
  // ==========================================================================

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
    zh: { title: "议题投票 · 思想家圆桌辩论", crumb: "议题投票", h1: "议题投票",
      sub: "想看哪场辩论？给议题点赞，净票最高的下一场就开。",
      howto: "👍 = +1 票，👎 = −1 票（净票 = 赞 − 踩，无需登录）；点「讨论」看该题当前评论、也能直接留言。每跑一场，云端自动挑净票最高的来开，并把好评论收进灵感库。",
      candLabel: "候选议题 · 净票决定下一场", doneLabel: "已经辩过的", votes: "净票",
      discuss: "讨论", loading: "加载中…", topTip: "暂列第一",
      enter: "看辩论 →",
      openQLabel: "提个新议题", openQTitle: "没有你想看的？在这儿提一个",
      openQNote: "把你想看的辩题写下来——被采纳就会进入上面的候选名单，一起接受投票。",
      namePh: "名字（可选）", bodyPh: "写下你的想法…", topicBodyPh: "提个新议题 / 说说你的看法…",
      send: "发表", empty: "还没有评论，来做第一个。", posted: "已发表，谢谢！",
      rate: "发得太快啦，稍等一下。", cerr: "发表失败，检查一下再试。", net: "网络出错，请重试。",
      failPre: "无法加载（", failPost: "）。本地预览请用 " },
    en: { title: "Vote on Topics · Thinkers' Round Table", crumb: "Vote", h1: "Vote on the Next Debate",
      sub: "Which debate do you want to see? Upvote a topic — the highest net score goes next.",
      howto: "👍 = +1, 👎 = −1 (net = ups − downs, no login needed); hit “Discuss” to read or add comments. After each debate the cloud auto-picks the highest net-voted topic and folds the best comments into the backlog.",
      candLabel: "Candidates · net votes decide the next debate", doneLabel: "Already debated", votes: "net",
      discuss: "Discuss", loading: "Loading…", topTip: "leading",
      enter: "see debate →",
      openQLabel: "Propose a new topic", openQTitle: "Don't see the one you want? Suggest it here",
      openQNote: "Write the debate question you'd like — good ones get promoted into the candidate list above for voting.",
      namePh: "Name (optional)", bodyPh: "Share your thoughts…", topicBodyPh: "Suggest a topic / share your view…",
      send: "Post", empty: "No comments yet — be the first.", posted: "Posted. Thanks!",
      rate: "You're posting too fast — wait a moment.", cerr: "Couldn't post — check and retry.", net: "Network error — try again.",
      failPre: "Couldn't load (", failPost: "). For local preview run " }
  };
  function T(k) { return UI[LANG][k]; }

  var CATS = [
    { key: "self",   zh: "处世 · 自我 · 成长",   en: "Self, growth & living" },
    { key: "life",   zh: "人生 · 生死 · 家庭",   en: "Life, family & mortality" },
    { key: "ethics", zh: "伦理 · 政治 · 社会",   en: "Ethics, politics & society" },
    { key: "meta",   zh: "形而上 · 认识 · 文明", en: "Mind, reality & civilization" },
    { key: "work",   zh: "职场 · 组织 · 领导",   en: "Work, org & leadership" },
    { key: "other",  zh: "其他",                en: "More" }
  ];
  function catLabel(c) { return LANG === "en" ? c.en : c.zh; }
  function pick(o, f) { return (LANG === "en" && o && o[f + "_en"] != null) ? o[f + "_en"] : (o ? o[f] : undefined); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " HTTP " + r.status); return r.json(); }); }

  // ---- voter identity + this browser's own vote per topic ----
  var voter = localStorage.getItem("bigcat_voter");
  if (!voter) { voter = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("bigcat_voter", voter); }
  function myVotes() { try { return JSON.parse(localStorage.getItem("bigcat_topicvotes") || "{}"); } catch (e) { return {}; } }
  function setMyVote(term, dir) { var m = myVotes(); m[term] = dir; localStorage.setItem("bigcat_topicvotes", JSON.stringify(m)); }

  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleDateString(LANG === "en" ? "en-US" : "zh-CN",
        { year: "numeric", month: "short", day: "numeric" });
    } catch (e) { return ""; }
  }

  // ---- comment thread (list + form), lazy-built ----
  function buildThread(term, bodyPlaceholder) {
    var wrap = document.createElement("div");
    wrap.className = "thread";
    var list = document.createElement("div");
    list.className = "th-list";
    list.innerHTML = '<div class="th-empty">' + T("loading") + "</div>";
    var form = document.createElement("form");
    form.className = "th-form";
    form.style.position = "relative";
    form.innerHTML =
      '<input class="th-name" type="text" maxlength="40" placeholder="' + esc(T("namePh")) + '">' +
      '<textarea class="th-body" maxlength="2000" placeholder="' + esc(bodyPlaceholder) + '" required></textarea>' +
      '<input class="th-hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" name="website">' +
      '<div class="th-row"><button type="submit" class="th-send">' + esc(T("send")) + '</button>' +
      '<span class="th-msg"></span></div>';
    wrap.appendChild(list);
    wrap.appendChild(form);

    function renderList(comments) {
      list.innerHTML = "";
      if (!comments || !comments.length) {
        list.innerHTML = '<div class="th-empty">' + T("empty") + "</div>";
        return;
      }
      comments.forEach(function (c) { list.appendChild(renderItem(c)); });
    }
    function renderItem(c) {
      var it = document.createElement("div");
      it.className = "th-item";
      var meta = document.createElement("div");
      meta.className = "th-meta";
      var b = document.createElement("b");
      b.textContent = c.name;                       // textContent = XSS-safe
      meta.appendChild(b);
      meta.appendChild(document.createTextNode(" · " + fmtDate(c.ts)));
      var body = document.createElement("div");
      body.className = "th-text";
      body.textContent = c.body;                    // textContent = XSS-safe
      it.appendChild(meta); it.appendChild(body);
      return it;
    }

    fetch(API + "/comments?page=" + encodeURIComponent(term))
      .then(function (r) { return r.json(); })
      .then(function (d) { renderList(d.ok ? d.comments : []); })
      .catch(function () { list.innerHTML = ""; });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ta = form.querySelector(".th-body"), name = form.querySelector(".th-name");
      var hp = form.querySelector(".th-hp"), msg = form.querySelector(".th-msg");
      var send = form.querySelector(".th-send");
      var text = ta.value.trim();
      if (!text) return;
      send.disabled = true; msg.className = "th-msg"; msg.textContent = "…";
      fetch(API + "/comment", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: term, name: name.value.trim(), body: text, website: hp.value })
      })
        .then(function (r) { return r.json().then(function (d) { return { s: r.status, d: d }; }); })
        .then(function (res) {
          if (res.d.ok) {
            msg.className = "th-msg ok"; msg.textContent = T("posted");
            if (res.d.comment) {
              var empty = list.querySelector(".th-empty"); if (empty) empty.remove();
              list.appendChild(renderItem(res.d.comment));
            }
            ta.value = "";
          } else if (res.s === 429) { msg.className = "th-msg err"; msg.textContent = T("rate"); }
          else { msg.className = "th-msg err"; msg.textContent = T("cerr"); }
        })
        .catch(function () { msg.className = "th-msg err"; msg.textContent = T("net"); })
        .finally(function () { send.disabled = false; });
    });

    return wrap;
  }

  // ---- vote casting ----
  function castVote(term, dir, ctl) {
    fetch(API + "/vote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poll: term, choice: dir, voter: voter })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) return;
        setMyVote(term, dir);
        var up = (d.tally && d.tally.up) || 0, down = (d.tally && d.tally.down) || 0;
        ctl.querySelector(".net").textContent = up - down;
        ctl.querySelector(".vbtn.up").classList.toggle("on", dir === "up");
        ctl.querySelector(".vbtn.down").classList.toggle("on", dir === "down");
      })
      .catch(function () {});
  }

  function candCard(c, posInCat, isTop) {
    var term = VOTE_PREFIX + c.id;
    var note = pick(c, "note");
    var mine = myVotes()[term];
    return '<div class="topic-card" data-term="' + esc(term) + '">' +
      '<div class="tc-head">' +
      '<div class="rank' + (isTop ? " top" : "") + '">' + (isTop ? "★" : posInCat) + "</div>" +
      '<div class="tc-body">' +
      '<div class="tc-q">' + esc(pick(c, "q")) + "</div>" +
      (note ? '<div class="tc-note">' + esc(note) + "</div>" : "") +
      '<div class="tc-actions">' +
      '<div class="vote-ctl" data-term="' + esc(term) + '">' +
      '<button class="vbtn up' + (mine === "up" ? " on" : "") + '" data-dir="up" title="+1"><i class="ti ti-thumb-up"></i></button>' +
      '<span class="net">' + (c.votes || 0) + "</span>" +
      '<button class="vbtn down' + (mine === "down" ? " on" : "") + '" data-dir="down" title="-1"><i class="ti ti-thumb-down"></i></button>' +
      "</div>" +
      '<button class="discuss-pill" data-term="' + esc(term) + '"><i class="ti ti-message"></i> ' + T("discuss") + "</button>" +
      (isTop ? '<span class="badge-top">★ ' + T("topTip") + "</span>" : "") +
      "</div>" +
      '<div class="thread-wrap"></div>' +
      "</div></div></div>";
  }

  function render(data) {
    var cands = (data.candidates || []).slice().sort(function (a, b) { return (b.votes || 0) - (a.votes || 0); });
    var maxVotes = cands.reduce(function (m, c) { return Math.max(m, c.votes || 0); }, 0);
    var topId = maxVotes > 0 ? cands[0].id : null;
    var done = (data.debated || []).slice();
    function doneCard(d) {
      return '<a class="done-card" href="' + PG("debate") + '?d=' + esc(d.id) + '">' +
        '<i class="ti ti-circle-check dcheck"></i>' +
        '<span class="dq">' + esc(pick(d, "q")) + "</span>" +
        '<span class="dgo">' + T("enter") + "</span></a>";
    }
    var html = '<div class="sec-label">' + T("candLabel") + "</div>";
    CATS.forEach(function (cat) {
      var members = cands.filter(function (c) { return (c.cat || "other") === cat.key; });
      var dmem = done.filter(function (d) { return (d.cat || "other") === cat.key; });
      if (!members.length && !dmem.length) return;
      html += '<div class="cat-head"><span class="cat-name">' + esc(catLabel(cat)) +
        '</span><span class="cat-count">' + (members.length + dmem.length) + "</span></div>";
      html += members.map(function (c, i) { return candCard(c, i + 1, c.id === topId); }).join("");
      if (dmem.length) {
        dmem.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
        html += '<div class="done-sub"><i class="ti ti-circle-check"></i> ' + T("doneLabel") + "</div>";
        html += dmem.map(doneCard).join("");
      }
    });

    // 开放征题
    html += '<div class="sec-label">' + T("openQLabel") + "</div>";
    html += '<div class="topic-card open-q" data-term="' + esc(OPEN_TERM) + '">' +
      '<div class="tc-head">' +
      '<div class="rank" style="background:rgba(255,255,255,0.06);color:#9aa3bd"><i class="ti ti-bulb"></i></div>' +
      '<div class="tc-body">' +
      '<div class="tc-q">' + T("openQTitle") + "</div>" +
      '<div class="tc-note">' + T("openQNote") + "</div>" +
      '<div class="tc-actions"><button class="discuss-pill open" data-term="' + esc(OPEN_TERM) + '"><i class="ti ti-message-plus"></i> ' + T("openQLabel") + "</button></div>" +
      '<div class="thread-wrap"></div>' +
      "</div></div></div>";

    document.getElementById("content").innerHTML = html;

    // 投票按钮
    document.querySelectorAll(".vote-ctl").forEach(function (ctl) {
      var term = ctl.getAttribute("data-term");
      ctl.querySelectorAll(".vbtn").forEach(function (btn) {
        btn.addEventListener("click", function () { castVote(term, btn.getAttribute("data-dir"), ctl); });
      });
    });

    // 讨论/征题：点开懒加载评论区
    document.querySelectorAll(".discuss-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".topic-card");
        var term = btn.getAttribute("data-term");
        var host = card.querySelector(".thread-wrap");
        var open = host.classList.toggle("show");
        btn.classList.toggle("active", open);
        if (open && !host.getAttribute("data-loaded")) {
          host.setAttribute("data-loaded", "1");
          var isOpenQ = btn.classList.contains("open");
          host.appendChild(buildThread(term, isOpenQ ? T("topicBodyPh") : T("bodyPh")));
        }
      });
    });
  }

  // 静态文案 + 语言开关
  document.title = T("title");
  var setTxt = function (id, k) { var el = document.getElementById(id); if (el) el.textContent = T(k); };
  setTxt("crumb-tail", "crumb"); setTxt("h1", "h1"); setTxt("sub", "sub"); setTxt("howto", "howto");
  var lt = document.getElementById("lang-toggle");
  if (lt) {
    lt.textContent = LANG === "zh" ? "EN" : "中";
    lt.title = "中 / English";
    lt.onclick = function () { location.href = OTHER_LANG_URL(); };
  }

  // 先拉候选，再用后端实时净票覆盖 votes（拿不到就用 ideas.json 里的值）
  getJSON("ideas.json").then(function (data) {
    return fetch(API + "/votes-net?prefix=" + encodeURIComponent(VOTE_PREFIX))
      .then(function (r) { return r.json(); })
      .then(function (v) {
        if (v && v.ok && v.votes) {
          (data.candidates || []).forEach(function (c) {
            var row = v.votes[VOTE_PREFIX + c.id];
            if (row) c.votes = row.net;
          });
        }
        return data;
      })
      .catch(function () { return data; });
  }).then(render).catch(function (e) {
    document.getElementById("content").innerHTML =
      '<p style="text-align:center;color:#9aa3bd;padding:40px">' + T("failPre") + esc(e.message) +
      T("failPost") + "<code>python3 -m http.server</code></p>";
  });
})();
