/* 议题投票页 · 中/EN 双语 · giscus(GitHub Discussions) 投票+评论 */
(function () {
  "use strict";
  var LANG = localStorage.getItem("ta_lang") === "en" ? "en" : "zh";
  var UI = {
    zh: { title: "议题投票 · 思想家圆桌辩论", crumb: "议题投票", h1: "议题投票",
      sub: "想看哪场辩论？给议题点赞，票最高的下一场就开。",
      howto: "👍 用 GitHub 账号给你想看的议题点赞 = 投一票；想补充角度、提新议题就在下面留言。每跑一场，云端会自动挑当时票数最高的来开，并把好评论收进灵感库。",
      candLabel: "候选议题 · 投票决定下一场", doneLabel: "已经辩过的", votes: "票",
      voteBtn: "投票 / 讨论", loading: "加载投票与评论中…", topTip: "暂列第一",
      enter: "看辩论 →", failPre: "无法加载（", failPost: "）。本地预览请用 " },
    en: { title: "Vote on Topics · Thinkers' Round Table", crumb: "Vote", h1: "Vote on the Next Debate",
      sub: "Which debate do you want to see? Upvote a topic — the top one goes next.",
      howto: "👍 Upvote a topic with your GitHub account = one vote; add an angle or propose a new topic in the comments below. After each debate, the cloud auto-picks the highest-voted topic and folds the best comments into the backlog.",
      candLabel: "Candidates · votes decide the next debate", doneLabel: "Already debated", votes: "votes",
      voteBtn: "Vote / discuss", loading: "Loading votes & comments…", topTip: "leading",
      enter: "see debate →", failPre: "Couldn't load (", failPost: "). For local preview run " }
  };
  function T(k) { return UI[LANG][k]; }
  function pick(o, f) { return (LANG === "en" && o && o[f + "_en"] != null) ? o[f + "_en"] : (o ? o[f] : undefined); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " HTTP " + r.status); return r.json(); }); }

  var GISCUS = null, TERMS = {};   // map term -> {countEl, pillCnt}

  function loadGiscus(term, container) {
    var s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    s.setAttribute("data-repo", GISCUS.repo);
    s.setAttribute("data-repo-id", GISCUS.repoId);
    s.setAttribute("data-category", GISCUS.category);
    s.setAttribute("data-category-id", GISCUS.categoryId);
    s.setAttribute("data-mapping", "specific");
    s.setAttribute("data-term", term);
    s.setAttribute("data-strict", "0");
    s.setAttribute("data-reactions-enabled", "1");
    s.setAttribute("data-emit-metadata", "1");   // 让 giscus 把讨论元数据(含反应数)发回来
    s.setAttribute("data-input-position", "bottom");
    s.setAttribute("data-theme", "noborder_dark");
    s.setAttribute("data-lang", LANG === "en" ? "en" : "zh-CN");
    s.crossOrigin = "anonymous";
    s.async = true;
    container.appendChild(s);
  }

  // giscus 发回元数据时，更新对应议题的实时票数(👍)
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://giscus.app") return;
    if (!e.data || typeof e.data !== "object" || !e.data.giscus) return;
    var d = e.data.giscus.discussion;
    if (!d) return;
    // 找到当前展开的那个 term(giscus 不回传 term，用唯一展开态匹配)
    var openTerm = document.body.getAttribute("data-open-term");
    if (!openTerm || !TERMS[openTerm]) return;
    // giscus 已就绪：撤掉「加载中」提示
    var oc = document.querySelector('.topic-card[data-term="' + openTerm + '"] .giscus-loading');
    if (oc) oc.style.display = "none";
    var up = 0;
    if (d.reactions && d.reactions.THUMBS_UP) up = d.reactions.THUMBS_UP.count;
    else if (typeof d.reactionCount === "number") up = d.reactionCount;
    var ref = TERMS[openTerm];
    if (ref && ref.pillCnt) ref.pillCnt.textContent = up;
  });

  function candCard(c, idx, maxVotes) {
    var term = GISCUS.termPrefix + c.id;
    var isTop = idx === 0 && (c.votes || 0) === maxVotes && maxVotes > 0;
    var note = pick(c, "note");
    var html =
      '<div class="topic-card" data-term="' + esc(term) + '">' +
      '<div class="tc-head">' +
      '<div class="rank' + (isTop ? " top" : "") + '">' + (idx + 1) + "</div>" +
      '<div class="tc-body">' +
      '<div class="tc-q">' + esc(pick(c, "q")) + "</div>" +
      (note ? '<div class="tc-note">' + esc(note) + "</div>" : "") +
      '<div class="tc-actions">' +
      '<button class="vote-pill" data-term="' + esc(term) + '"><i class="ti ti-thumb-up"></i> ' +
      T("voteBtn") + ' · <span class="cnt">' + (c.votes || 0) + "</span> " + T("votes") + "</button>" +
      (isTop ? '<span class="badge-top">★ ' + T("topTip") + "</span>" : "") +
      "</div>" +
      '<div class="giscus-wrap"><div class="giscus-loading">' + T("loading") + "</div></div>" +
      "</div></div></div>";
    return html;
  }

  function render(data) {
    GISCUS = data.giscus;
    var cands = (data.candidates || []).slice().sort(function (a, b) { return (b.votes || 0) - (a.votes || 0); });
    var maxVotes = cands.reduce(function (m, c) { return Math.max(m, c.votes || 0); }, 0);
    var html = '<div class="sec-label">' + T("candLabel") + "</div>";
    html += cands.map(function (c, i) { return candCard(c, i, maxVotes); }).join("");

    var done = data.debated || [];
    if (done.length) {
      html += '<div class="sec-label">' + T("doneLabel") + "</div>";
      html += done.map(function (d) {
        return '<a class="done-card" href="debate.html?d=' + esc(d.id) + '">' +
          '<i class="ti ti-circle-check dcheck"></i>' +
          '<span class="dq">' + esc(pick(d, "q")) + "</span>" +
          '<span class="dgo">' + T("enter") + "</span></a>";
      }).join("");
    }
    document.getElementById("content").innerHTML = html;

    // 投票/讨论按钮：点开即懒加载该议题的 giscus
    document.querySelectorAll(".vote-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".topic-card");
        var term = btn.getAttribute("data-term");
        var wrap = card.querySelector(".giscus-wrap");
        var open = wrap.classList.toggle("show");
        btn.classList.toggle("open", open);
        document.body.setAttribute("data-open-term", open ? term : "");
        if (open && !wrap.getAttribute("data-loaded")) {
          wrap.setAttribute("data-loaded", "1");
          TERMS[term] = { pillCnt: btn.querySelector(".cnt") };
          loadGiscus(term, wrap);
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
    lt.onclick = function () { localStorage.setItem("ta_lang", LANG === "zh" ? "en" : "zh"); location.reload(); };
  }

  getJSON("ideas.json").then(render).catch(function (e) {
    document.getElementById("content").innerHTML =
      '<p style="text-align:center;color:#9aa3bd;padding:40px">' + T("failPre") + esc(e.message) +
      T("failPost") + "<code>python3 -m http.server</code></p>";
  });
})();
