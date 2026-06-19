/* 议题投票页 · 中/EN 双语 · giscus(GitHub Discussions) 投票+评论 */
(function () {
  "use strict";
  var LANG = localStorage.getItem("ta_lang") === "en" ? "en" : "zh";
  var UI = {
    zh: { title: "议题投票 · 思想家圆桌辩论", crumb: "议题投票", h1: "议题投票",
      sub: "想看哪场辩论？给议题点赞，净票最高的下一场就开。",
      howto: "用 GitHub 账号 👍 = 投 +1 票，👎 = −1 票（其他表情只是表态、不计票）；点开卡片就能看到该题当前票数与讨论。每跑一场，云端自动挑当时净票最高的来开，并把好评论收进灵感库。",
      candLabel: "候选议题 · 净票决定下一场", doneLabel: "已经辩过的", votes: "净票",
      voteBtn: "投票 / 讨论", loading: "加载投票与评论中…", topTip: "暂列第一",
      enter: "看辩论 →",
      openQLabel: "提个新议题", openQTitle: "没有你想看的？在这儿提一个",
      openQNote: "把你想看的辩题写进评论——被采纳就会进入上面的候选名单，一起接受投票。",
      openQBtn: "提议新议题 / 讨论",
      failPre: "无法加载（", failPost: "）。本地预览请用 " },
    en: { title: "Vote on Topics · Thinkers' Round Table", crumb: "Vote", h1: "Vote on the Next Debate",
      sub: "Which debate do you want to see? Upvote a topic — the highest net score goes next.",
      howto: "With your GitHub account, 👍 = +1 vote, 👎 = −1 (other reactions are just sentiment — no vote); open a card to see its current count and discussion. After each debate, the cloud auto-picks the highest net-voted topic and folds the best comments into the backlog.",
      candLabel: "Candidates · net votes decide the next debate", doneLabel: "Already debated", votes: "net",
      voteBtn: "Vote / discuss", loading: "Loading votes & comments…", topTip: "leading",
      enter: "see debate →",
      openQLabel: "Propose a new topic", openQTitle: "Don't see the one you want? Suggest it here",
      openQNote: "Write the debate question you'd like in the comments — good ones get promoted into the candidate list above for voting.",
      openQBtn: "Suggest a topic / discuss",
      failPre: "Couldn't load (", failPost: "). For local preview run " }
  };
  function T(k) { return UI[LANG][k]; }
  // 主题分组（语言无关 key 存在 ideas.json 的 cat 字段；标签在这里双语）
  var CATS = [
    { key: "work",   zh: "职场 · 组织 · 领导",   en: "Work, org & leadership" },
    { key: "self",   zh: "处世 · 自我 · 成长",   en: "Self, growth & living" },
    { key: "life",   zh: "人生 · 生死 · 家庭",   en: "Life, family & mortality" },
    { key: "ethics", zh: "伦理 · 政治 · 社会",   en: "Ethics, politics & society" },
    { key: "meta",   zh: "形而上 · 认识 · 文明", en: "Mind, reality & civilization" },
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

  var GISCUS = null;

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

  // giscus 就绪(发回元数据)时撤掉「加载中」提示；票数直接看 giscus 自己的反应栏
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://giscus.app") return;
    if (!e.data || typeof e.data !== "object" || !e.data.giscus) return;
    var openTerm = document.body.getAttribute("data-open-term");
    if (!openTerm) return;
    var oc = document.querySelector('.topic-card[data-term="' + openTerm + '"] .giscus-loading');
    if (oc) oc.style.display = "none";
  });

  function candCard(c, posInCat, isTop) {
    var term = GISCUS.termPrefix + c.id;
    var note = pick(c, "note");
    var html =
      '<div class="topic-card" data-term="' + esc(term) + '">' +
      '<div class="tc-head">' +
      '<div class="rank' + (isTop ? " top" : "") + '">' + (isTop ? "★" : posInCat) + "</div>" +
      '<div class="tc-body">' +
      '<div class="tc-q">' + esc(pick(c, "q")) + "</div>" +
      (note ? '<div class="tc-note">' + esc(note) + "</div>" : "") +
      '<div class="tc-actions">' +
      '<button class="vote-pill" data-term="' + esc(term) + '"><i class="ti ti-thumb-up"></i> ' +
      T("voteBtn") + "</button>" +
      (isTop ? '<span class="badge-top">★ ' + T("topTip") + "</span>" : "") +
      "</div>" +
      '<div class="giscus-wrap"><div class="giscus-loading">' + T("loading") + "</div></div>" +
      "</div></div></div>";
    return html;
  }

  function render(data) {
    GISCUS = data.giscus;
    // 全局按净票排序，定出当前票王(★) —— 决定下一场的仍是全局净票最高者
    var cands = (data.candidates || []).slice().sort(function (a, b) { return (b.votes || 0) - (a.votes || 0); });
    var maxVotes = cands.reduce(function (m, c) { return Math.max(m, c.votes || 0); }, 0);
    var topId = maxVotes > 0 ? cands[0].id : null;
    var html = '<div class="sec-label">' + T("candLabel") + "</div>";
    // 按主题分组展示(组内仍按净票降序，因 cands 已全局排好序、过滤保持相对序)
    CATS.forEach(function (cat) {
      var members = cands.filter(function (c) { return (c.cat || "other") === cat.key; });
      if (!members.length) return;
      html += '<div class="cat-head"><span class="cat-name">' + esc(catLabel(cat)) +
        '</span><span class="cat-count">' + members.length + "</span></div>";
      html += members.map(function (c, i) { return candCard(c, i + 1, c.id === topId); }).join("");
    });

    // 开放征题：观众提自己的议题（独立 giscus 讨论，term=open-questions）
    html += '<div class="sec-label">' + T("openQLabel") + "</div>";
    html += '<div class="topic-card open-q" data-term="open-questions">' +
      '<div class="tc-head">' +
      '<div class="rank" style="background:rgba(255,255,255,0.06);color:#9aa3bd"><i class="ti ti-bulb"></i></div>' +
      '<div class="tc-body">' +
      '<div class="tc-q">' + T("openQTitle") + "</div>" +
      '<div class="tc-note">' + T("openQNote") + "</div>" +
      '<div class="tc-actions"><button class="vote-pill" data-term="open-questions"><i class="ti ti-message-plus"></i> ' + T("openQBtn") + "</button></div>" +
      '<div class="giscus-wrap"><div class="giscus-loading">' + T("loading") + "</div></div>" +
      "</div></div></div>";

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
