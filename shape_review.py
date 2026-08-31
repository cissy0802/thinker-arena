#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""形状自评（反模板）：写完一场后跑，把本场的『结构指纹』和最近几场逐项对比，
照出你在哪些维度上又落进了模板——尤其是静态规则没法预知的『措辞坍缩』（每场 insight
都同一个开头、每帖都同一个起手式）。看到连号/雷同，就故意在其中至少一处偏离。
用法: python3 shape_review.py debates/<slug>.json [最近N场=5]
这是『让未知维度的过拟合也变得可见』——配合一遍你自己的挑剔通读，专门破模板。
"""
import json, sys, glob, os, re
from collections import Counter

if len(sys.argv) < 2:
    print("用法: python3 shape_review.py debates/<slug>.json [N]"); sys.exit(2)
target_path = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 5

idx = json.load(open("debates/index.json"))["debates"]
order = [e["id"] for e in idx]
tgt = json.load(open(target_path))
tid = tgt["id"]
pos = order.index(tid) if tid in order else len(order)
recent_ids = order[max(0, pos - N):pos]

def load(eid):
    p = "debates/%s.json" % eid
    return json.load(open(p)) if os.path.exists(p) else None

def _cn(t):
    return len(re.findall(r"[\u4e00-\u9fff]", t or ""))

def _sum_open_kind(s):
    """summary \u7684\u8d77\u624b\u5957\u8def\u5206\u7c7b\u3002\u5148\u5f52\u7c7b\u518d\u8de8\u573a\u6bd4\uff0c\u514d\u5f97\u6362\u4e2a\u6570\u5b57\u5c31\u4ee5\u4e3a\u81ea\u5df1\u6362\u4e86\u5199\u6cd5\u3002"""
    t = re.sub(r"[\*\s]", "", s or "")[:40]
    if re.match(r"^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+(\u4f4d|\u4e2a)?\u4eba", t):
        return "\u70b9\u540d\u82b1\u540d\u518c(N\u4e2a\u4eba\u2026)"
    if re.match(r"^(\u5148\u8bf4|\u8fd9\u573a|\u672c\u573a)?(\u6700\u5927\u7684)?\u5171\u8bc6", t) or re.match(r"^(\u5148\u8bf4|\u9996\u5148)", t):
        return "\u5148\u8bf4\u5171\u8bc6\u8d77\u624b"
    return t[:6]

def _r3_everyday_turn(posts):
    """总结陈词里用同一句『过渡语』拐向日常建议的帖数（给普通人／落到日常／本周就能…）。
    第3轮要落到可操作建议是要求，但若每帖都用同一副转场口令，一整轮读起来就是同一个
    模板换了署名——它不在字数、不在反驳结构上，静态规则查不出，只能逐场比。"""
    r3 = [p.get("text", "") or "" for p in posts if p.get("round") == 3]
    pat = re.compile(r"给普通人|落到日常|落到家常|落到实处|常人处世|日常里|日常中|今天就能|本周就能|用在人间")
    return "%d/%d" % (sum(1 for t in r3 if pat.search(t)), len(r3)) if r3 else "-"


def _advice_item_counts(sums):
    """三家 AI 的 advice 各列了几条建议（如 claude3/gpt3/gemini3）。
    每场三家都恰好凑三条，是一处静态规则和字数都查不出的坍缩：建议条数本该
    随议题浮动——有的题只值得说两件，有的能给四五件——一律三条就是流水线。"""
    pat = re.compile(r"第[一二三四五六七]|其[一二三四五]|[①②③④⑤]")
    out = []
    for s in sums:
        txt = s.get("advice", "") or ""
        n = len(set(pat.findall(txt)))
        out.append("%s%d" % (s.get("ai", "?"), n))
    return "/".join(out) if out else "-"


def _advice_enum_shape(sums):
    """三家 AI 的 advice 有几家把建议写成『第一/第二/第三』的编号清单（如 3/3）。
    条数(_advice_item_counts)查的是几条，这里查的是**体例**：连续多场三家全都
    是编号清单，读者看到的就是同一张表格换了内容——建议本可以写成连贯的一段话、
    一个先后顺序、或干脆只给一件最要紧的事。三家齐刷刷带编号即是体例坍缩。"""
    pat = re.compile(r"第[一二三四五六七][，、,]|其[一二三四五][，、,]|[①②③④⑤]")
    hit = sum(1 for s in sums if len(set(pat.findall(s.get("advice", "") or ""))) >= 2)
    return "%d/%d" % (hit, len(sums)) if sums else "-"


def _advice_time_anchor(sums):
    """三家 AI 的 advice 有几家把建议挂在『今天／本周／这个月』这类时间锚上（如 3/3）。
    _advice_enum_shape 查的是编号体例，这里查的是另一条更隐蔽的模子：把行动按
    今天→本周→这个月排成一串日程，读起来像同一张打卡表换了内容。建议本可以按
    场景分（在家／在公司）、按对象分（对自己／对别人）、按难度分，或干脆只给一件
    最要紧的事，不必每场都从『今天先做一件小的』起手。"""
    pat = re.compile(r"今天|明天|本周|这个月|下个月|这一周|一周之内")
    hit = sum(1 for s in sums if pat.search(s.get("advice", "") or ""))
    return "%d/%d" % (hit, len(sums)) if sums else "-"


def _advice_open_norm(txt):
    """advice 起手式的『去水版』：把随场次变动的填充词抹掉再比，
    好让『结合全场智慧』『综合各家智慧』『结合诸家之言』这类同模子异措辞撞在一起。"""
    t = re.sub(r"[，。：、\s]", "", txt or "")[:14]
    # 最顽固的一副模子：『综合/结合 + 全场/各家/诸家 + 智慧/之言』——只换填充词，逐字比撞不上
    if re.match(r"^(综合|结合|汇总|纵观|综观)(全场|各家|诸家|场上|大家|各位|上述)", t):
        return "综合＊家＊"
    t = re.sub(r"本周|这周|今天|当下|眼下|马上|即刻", "＊", t)
    t = re.sub(r"[一二三四五六两]", "N", t)
    return t[:6]


def _r3_countdown(posts):
    """总结陈词里『我说三件事／三条建议／吾终之以三事』这类数数起手式占几帖。
    一场里几乎人人都用数字开场清单，读起来就是同一个模子印的——它不在字数、
    也不在反驳结构上，静态规则查不出，只能作为指纹逐场比。"""
    r3 = [p.get("text", "") or "" for p in posts if p.get("round") == 3]
    pat = re.compile(r"^.{0,14}?[二三四两]\s*(?:件|条|事|点|句|端)")
    return "%d/%d" % (sum(1 for t in r3 if pat.search(t)), len(r3)) if r3 else "-"

def _insight_gap_frame(sums):
    """三家 insight 里有几条是用『全场都在谈 X，可没人提 Y』这副框架开场的。
    「指出全场的盲点」本身是 insight 该做的事，但每场都从同一句『整场/全场…漏掉了』
    进入，就把独到观察压成了一个固定模板——它不在字数也不在开头几字上（换个词
    就绕过了 _insight_open 的比对），只能单列一维逐场看。N/3 连场不降＝该换进入方式：
    直接从现象、从一个反例、从一条实务纠偏切进去，别每次先站到全场对面报幕。"""
    pat = re.compile(r"^.{0,12}?(?:整场|全场|这场|本场|诸位|大家|七|八|九|十)"
                     r".{0,24}?(?:漏|没人|无人|都没|忽略|低估|未被|没有谁|争的是|讨论的都是|谈的都是)")
    n = sum(1 for s in sums if pat.search((s.get("insight", "") or "").strip()))
    return "%d/%d" % (n, len(sums)) if sums else "-"

def _r3_enum_list(posts):
    """第3轮里有多少帖在正文中段列了『第一/其一/一曰/①』这类三件套清单。
    与『总结数数起手』互补：那个只看开头，这个照出把清单藏在中段的同一副模子——
    人人都在结尾发一张三条建议的清单，读起来同样是流水线。"""
    r3 = [p for p in posts if p.get("round") == 3]
    pat = re.compile(r"(第一[，、,]|其一[，、,]|一曰|一，|①)")
    return "%d/%d" % (sum(1 for p in r3 if pat.search(p.get("text", "") or "")), len(r3)) if r3 else "-"

def _r3_ratio(posts):
    """第3轮均长 ÷ 第1轮均长——照出『总结陈词一律拉到上限』这种未被覆盖的形状坍缩。"""
    a = [_cn(p.get("text", "")) for p in posts if p.get("round") == 1]
    b = [_cn(p.get("text", "")) for p in posts if p.get("round") == 3]
    if not a or not b:
        return 0.0
    return round((sum(b) / len(b)) / max(1.0, sum(a) / len(a)), 2)

def _order_repeat(posts, rounds):
    """后面各轮里，有几轮的发言顺序与第1轮一字不差。每场都按同一个次序轮流开口，
    读起来就是同一张点名表念了三遍——它不在人数、不在反驳结构上，静态规则查不出。
    0 = 每轮都换了次序（想要的样子），所以 0 不算模板、不报连号。"""
    seq = {r: [p["thinker"] for p in posts if p["round"] == r] for r in rounds}
    base = seq.get(rounds[0], [])
    later = list(rounds[1:])
    return sum(1 for r in later if seq[r] == base)


def _r1_monologue(posts):
    """第1轮里 reply_to 为空的比例。每场第1轮都清一色独白（N/N），
    读起来就是八个人各念一段稿子、彼此不知道对方存在——第2轮才突然开始对话。
    第1轮里有人直接接住前面某帖，开场就有火星；这维度不在人数、也不在反驳
    结构上，静态规则查不出，只能逐场比。N/N = 全独白（最容易坍缩的样子）。"""
    r1 = [p for p in posts if p.get("round") == 1]
    return "%d/%d" % (sum(1 for p in r1 if not p.get("reply_to")), len(r1)) if r1 else "-"


_TH_NAME = {t["id"]: t["name"] for t in json.load(open("thinkers.json"))["thinkers"]}


def _r2_callout_open(posts, by_id):
    """第2轮有多少帖是『直呼被驳者的名字』起手（「桑德尔，你的…」「贝克尔说…」）。
    单帖这么写很自然，整轮 N/N 全这么写就是一条流水线——反驳的进入方式本该有变化：
    先复述对方的论证再拆、先讲一个例子、先承认一半、直接从数据切入……
    """
    r2 = [p for p in posts if p["round"] == 2 and p.get("reply_to")]
    if not r2:
        return "-"
    n = 0
    for p in r2:
        tgt_id = by_id.get(p["reply_to"], {}).get("thinker")
        nm = _TH_NAME.get(tgt_id)
        if nm and nm in (p.get("text", "") or "")[:12]:
            n += 1
    return "%d/%d" % (n, len(r2))


def _bold_spread(posts):
    """本场加粗处数的分布（如 1处×30）。均值会把『每一帖都恰好一处』抹平成 1.0，
    看不出整场加粗节奏完全同一；分布能照出这种场内单调——重点该随内容起伏，
    而不是每帖都机械地标一句。"""
    c = Counter((p.get("text", "") or "").count("**") // 2 for p in posts)
    return "/".join("%d处x%d" % (k, c[k]) for k in sorted(c)) if c else "-"


def _bold_at_tail(posts):
    """加粗那一句落在帖子末尾的比例。ENGINE 只说『每帖标一处重点』，没说标在哪；
    实际写起来最省事的位置永远是最后一句——于是整场读下来，每一帖都是『铺陈…然后
    金句收尾』的同一副节奏。它不在加粗处数、也不在分布里（那两维只数多少），静态
    规则查不出。N/N＝重点清一色压在帖尾，该把若干帖的重点提到开头或中段去。"""
    tot = hit = 0
    for p in posts:
        t = p.get("text", "") or ""
        end = t.rfind("**")
        if end < 0 or t.count("**") < 2:
            continue
        tot += 1
        if end >= len(t) * 0.8:
            hit += 1
    return "%d/%d" % (hit, tot) if tot else "-"


def _gloss_round_spread(posts):
    """glossary 落在各轮的条数（R1:n/R2:n/R3:n）。一处静态规则查不出的坍缩：术语被当成
    开场的自我介绍道具——每人第 1 轮抛两个概念，第 2、3 轮再不引入任何新概念，于是
    『带 glossary 帖数』看着正常，实际是每场都长成同一副『先报家门、后白话对骂』的形状。
    交锋轮与总结轮同样会用到新概念（对方抛出的、收束时才需要的），别让它恒为 R1 独占。"""
    c = Counter(p["round"] for p in posts if p.get("glossary"))
    rs = sorted({p["round"] for p in posts})
    return "/".join("R%s:%d" % (r, c.get(r, 0)) for r in rs)


def _term_bolding(posts):
    """glossary 术语被 `**` 包起来的比例。ENGINE 只要求把『最关键的一句话』加粗；
    顺手把每个术语也加粗，看起来更醒目，实际是把重点摊薄成满屏黑体——而且它是整场
    一次性发作的（写第一帖时顺手，后面照抄），均值/分布都只照出『加粗变多了』，
    照不出多出来的那些其实全是术语。N/N 即整场术语无一漏网，该收回来。"""
    tot = hit = 0
    for p in posts:
        for t in (p.get("glossary") or {}):
            tot += 1
            if ("**%s**" % t) in (p.get("text", "") or ""):
                hit += 1
    return "%d/%d" % (hit, tot) if tot else "-"


def _casting_tone_tail(d):
    """选角 reason 是不是每条都用一句『语气X、爱用Y』收尾。
    这是最容易在无意间锚死的一处措辞：写第一条时顺手带上人物语气，
    后面八条便照抄同一个收尾模具，读起来像同一张表格填了九遍。
    整场全中 → 该给若干人换个收束方式（落到一句主张、一个动作、一处让步）。"""
    cs = d.get("casting") or []
    if not cs:
        return "-"
    hit = sum(1 for c in cs if re.search(r"语气|口吻", (c.get("reason") or "")[-40:]))
    return "%d/%d" % (hit, len(cs))


def _casting_open_pronoun(d):
    """选角 reason 里有几条是直接以『他/她/他们』开头。写第一条时这么起手最顺，
    后面九条便照抄同一个开场，整条选角带读下来像同一张表格填了十遍——而且它和
    『语气X收尾』是两头：那一维只看结尾，这一维照出开头。ENGINE 要求 reason 用
    陈述句写此人对本题怎么想，并没有规定必须从代词起步：可以从他的一句主张、
    一条规矩、一个提问、一处生平事实切入。N/N 即整条选角全是同一副开场。"""
    cs = d.get("casting") or []
    if not cs:
        return "-"
    hit = sum(1 for c in cs if re.match(r"^[他她]们?", (c.get("reason") or "").lstrip()))
    return "%d/%d" % (hit, len(cs))


_TH_CAT = {t["id"]: t.get("cat", "?") for t in json.load(open("thinkers.json"))["thinkers"]}


def _answer_slot(hooks):
    """带可点开答案表的钩子排在钩子列表的第几条。ENGINE 限每场至多 1 条，
    『钩子带答案表』只数有没有；这一维照出的是它的位置——每场都压在最后一条
    （或每场都排头一条），同样是一副没被编码过的模子。"""
    if not hooks:
        return "-"
    slots = [i + 1 for i, h in enumerate(hooks) if h.get("answer")]
    return ("%s/%d" % (",".join(map(str, slots)), len(hooks))) if slots else "-/%d" % len(hooks)


def _hook_question_tail(hooks):
    """钩子正文以问号收尾的比例。钩子本就该留白引人往下想，但『每条都以一个问句收束』
    是一副没被编码过的模子：最近几场几乎清一色 N/N，读下来每条钩子的结尾都是同一个
    节拍。留白也可以由一句把张力点破的陈述句完成——这一维照出的是收束方式的单一化。"""
    if not hooks:
        return "-"
    q = sum(1 for h in hooks if (h.get("text") or "").rstrip().endswith(("？", "?")))
    return "%d/%d" % (q, len(hooks))


def _closing_cat(posts):
    """收尾帖发言者所属的名册类别。谁说最后一句，读者记得最牢；若每场都固定由
    同一路人（最常见的是东方古人念一段文言收束）压轴，整个系列的结尾就是同一种腔调。
    它不在人数、不在反驳结构、也不在措辞指纹里，静态规则查不出，只能逐场比。"""
    if not posts:
        return "-"
    last_round = max(p["round"] for p in posts)
    tail = [p for p in posts if p["round"] == last_round]
    return _TH_CAT.get(tail[-1]["thinker"], "?") if tail else "-"


def _cast_order_is_r1(d):
    """第1轮的发言次序是不是照着 casting 名单从头念了一遍。选角条与首轮几乎总是同序，
    读者一进页面就先看名单、再看同样次序的九段独白，开场的节奏因此每场一模一样。
    它不在人数、不在反驳结构里（『轮内照抄顺序』只比第2、3轮与第1轮），静态规则查不出。"""
    cast = [c.get("id") for c in d.get("casting", [])]
    r1 = [p["thinker"] for p in d.get("posts", []) if p.get("round") == 1]
    if not cast or not r1:
        return "-"
    return "是" if cast == r1 else "否"


def _last_round_detached(posts):
    """末轮（总结陈词）里 reply_to 为空的帖数。总结不必逐条反驳是对的，但若每场都是
    N/N 全断连，最后一轮就永远是各念各的独白，读者看不到任何人把话接住再收。"""
    if not posts:
        return "-"
    last_round = max(p["round"] for p in posts)
    tail = [p for p in posts if p["round"] == last_round]
    return "%d/%d" % (sum(1 for p in tail if not p.get("reply_to")), len(tail))


def _react_coverage(d, posts):
    """每帖表态人数 ÷ 在场其他人数，取全场平均。趋近 1.00 说明表态被当成必填表格
    逐帖填满，于是『谁选择不开口』这个本身有意味的信号被抹平；每场都同一个数值，
    则是连表态密度都被锚死了。"""
    n = len(d.get("participants", []))
    if n < 2 or not posts:
        return "-"
    tot = 0
    for p in posts:
        tot += sum(len(v) for v in (p.get("reactions") or {}).values())
    return round(tot / len(posts) / (n - 1), 2)


def feats(d):
    posts = d.get("posts", [])
    rounds = sorted({p["round"] for p in posts})
    ppr = tuple(sum(1 for p in posts if p["round"] == r) for r in rounds)
    by_id = {p["id"]: p for p in posts}
    # 第2轮反驳是否每帖都 reply 第1轮
    r2 = [p for p in posts if p["round"] == 2]
    r2_to_r1 = sum(1 for p in r2 if p.get("reply_to") and by_id.get(p["reply_to"], {}).get("round") == 1)
    # 第2轮内部的『追击』：反驳的是同一轮里刚说完的人，而不是清一色回头打第1轮
    r2_chain = sum(1 for p in r2 if p.get("reply_to") and by_id.get(p["reply_to"], {}).get("round") == 2)
    # 第2轮的火力散布：被反驳的目标有几个不同的帖（全都压在同一两帖上＝交锋面窄；
    # 每场都恰好 N/N 一一对应＝另一种定型）
    r2_targets = len({p.get("reply_to") for p in r2 if p.get("reply_to")})
    rk = frozenset(k for p in posts for k in (p.get("reactions") or {}))
    hooks = d.get("hooks") or []
    hb = Counter(h.get("from") for h in hooks)
    _ai = {"claude", "gpt", "gemini"}
    _hai = sum(1 for h in hooks if h.get("from") in _ai)
    sums = d.get("summaries", [])
    def has_num(s):
        return bool(re.search(r"[①②③]|[1-3][\.、)]", s or ""))
    return {
        "人数": len(d.get("participants", [])),
        "轮数": len(rounds),
        "每轮帖数": ppr,
        "钩子数": len(hooks),
        "钩子分布": tuple(sorted("%s:%d" % (k, v) for k, v in hb.items())),
        "钩子作者类型": "AI%d/思想家%d" % (_hai, len(hooks) - _hai) if hooks else "-",
        "选角语气收尾": _casting_tone_tail(d),
        "选角代词起手": _casting_open_pronoun(d),
        "二轮全反一轮": "%d/%d" % (r2_to_r1, len(r2)) if r2 else "-",
        # 二轮里有多少帖是接着同轮的人往下打（0 = 每帖都回头打第1轮，结构最单调）
        "二轮同轮追击": "%d/%d" % (r2_chain, len(r2)) if r2 else "-",
        # 二轮有多少帖直呼被驳者的名字起手（N/N = 整轮同一个进入方式，反驳节奏坍缩）
        "二轮点名起手": _r2_callout_open(posts, by_id),
        # 第1轮有几帖是不接任何人的独白（N/N = 人人各念各的，开场没有交锋）
        "首轮全独白": _r1_monologue(posts),
        # 后面各轮里有几轮照抄了第1轮的发言顺序（0 = 每轮都换了次序，正是想要的）
        "轮内照抄顺序": _order_repeat(posts, rounds),
        # 二轮反驳目标的散度（不同目标数/二轮帖数；1/N＝全场围攻一帖，N/N＝一一对应）
        "二轮火力散布": "%d/%d" % (r2_targets, len(r2)) if r2 else "-",
        # 带可点开答案表的钩子数（ENGINE 限每场至多 1；每场都恰好 1 也是一种定型，宁缺毋滥）
        "钩子带答案表": sum(1 for h in hooks if h.get("answer")),
        # 带答案表的钩子排在第几条（『答案永远压轴』也是一种没被编码过的定型；-/N＝本场没有）
        "答案表位次": _answer_slot(hooks),
        # 钩子正文以问号收尾的比例（N/N＝每条都用一个问句收束，收尾节拍单一）
        "钩子问号收尾": _hook_question_tail(hooks),
        # 收尾帖发言者所属的名册类别。每场都让同一路人（尤其东方古人）说最后一句，
        # 是一处静态规则查不出的收束定型：结尾的分量该随议题给不同传统，别固定归谁。
        "收尾帖类别": _closing_cat(posts),
        # 第1轮是不是照着选角名单的次序念了一遍（每场都『是』＝开场节奏被锁死）
        "首轮序=选角序": _cast_order_is_r1(d),
        # 末轮有多少帖不接任何人（N/N＝总结轮永远是九段互不相干的独白）
        "末轮断连": _last_round_detached(posts),
        "表态档集合": tuple(sorted(rk)),
        "用了疑惑": "疑惑" in rk,
        # 每帖平均有多少比例的在场者表了态（1.00＝每帖都被全员表态一遍）。
        # 静态规则查不出的一处坍缩：表态被当成必填表格逐帖填满，于是『谁选择不表态』
        # 这个本身有意味的信号消失了。该让它随帖子浮动——有的帖子该激起满场反应，
        # 有的（技术性的、无人接得住的）本就只有两三个人会开口。
        "表态覆盖率": _react_coverage(d, posts),
        "带glossary帖数": sum(1 for p in posts if p.get("glossary")),
        # 术语只在第 1 轮出现＝『先报家门、后白话对骂』的固定形状（见函数注释）
        "术语轮次分布": _gloss_round_spread(posts),
        # glossary 术语顺手也加粗＝把重点摊薄成满屏黑体（重点只该是那一句）
        "术语加粗": _term_bolding(posts),
        # 加粗那一句是不是清一色压在帖尾（N/N＝每帖都『铺陈+金句收尾』的同一副节奏）
        "加粗压帖尾": _bold_at_tail(posts),
        "古文帖数": sum(1 for p in posts if p.get("vernacular")),
        "建议带①②③": sum(1 for s in sums if has_num(s.get("advice", ""))),
        "帖均加粗处": round(sum((p.get("text", "").count("**")) // 2 for p in posts) / max(1, len(posts)), 2),
        # 场内加粗节奏：每帖都恰好一处（1处xN）＝机械化的重点标注，均值查不出
        "加粗处分布": _bold_spread(posts),
        # 总结陈词是否一律被拉长到上限（第3轮均长 ÷ 第1轮均长；每场都 ~2.0 即是形状定型）
        "总结膨胀比": _r3_ratio(posts),
        # 总结陈词有多少帖用『三件事/三条建议』这类数数起手（人人如此＝同一个模子）
        "总结数数起手": _r3_countdown(posts),
        # 总结陈词有多少帖在中段列了『第一/其一/一曰』的三件套清单（人人如此＝清单流水线）
        "总结列清单": _r3_enum_list(posts),
        # 总结陈词有多少帖用同一副『转向日常』的过渡语（给普通人／落到日常／本周就能…）
        "总结转日常": _r3_everyday_turn(posts),
        # 三家 AI 的 advice 各列几条（每场都 3/3/3＝建议条数被锚成定值，该随议题浮动）
        "收尾建议条数": _advice_item_counts(sums),
        # 建议的**体例**：几家把 advice 写成『第一/第二/第三』的编号清单（连场 3/3＝同一张表换内容）
        "建议编号体例": _advice_enum_shape(sums),
        "建议时间锚": _advice_time_anchor(sums),
        # 措辞指纹（开头几字）
        # summary 起手式：先归成『套路种类』再比——最爱复读的两种是
        # 『N 个人从…进来，没有一个…』的点名花名册，和『先说共识／最大的共识是…』
        "_summary_open": [(s.get("ai", "?"), _sum_open_kind(s.get("summary", ""))) for s in sums],
        # insight 有几条用『整场都在谈 X、可没人提 Y』的报幕式框架开场（连场不降＝独到
        # 观察被压成固定模板；换个词就骗过开头几字的比对，所以单列一维）
        "insight报幕式": _insight_gap_frame(sums),
        "_insight_open": [(s.get("ai", "?"), (s.get("insight", "") or "")[:5]) for s in sums],
        "_advice_open": [(s.get("ai", "?"), (s.get("advice", "") or "")[:6]) for s in sums],
        "_advice_open_norm": [(s.get("ai", "?"), _advice_open_norm(s.get("advice", ""))) for s in sums],
        "_post_open": [(p.get("text", "") or "")[:3] for p in posts],
    }

T = feats(tgt)
R = [(eid, feats(load(eid))) for eid in recent_ids if load(eid)]

print("=" * 70)
print("形状自评 ·", tid, "· 对比最近", len(R), "场:", "、".join(eid for eid, _ in R) or "(无)")
print("=" * 70)

SCALARS = ["人数","轮数","每轮帖数","钩子数","钩子分布","钩子作者类型","钩子带答案表","选角语气收尾","选角代词起手","二轮全反一轮","二轮同轮追击","二轮点名起手","二轮火力散布","轮内照抄顺序","首轮全独白","答案表位次","钩子问号收尾","收尾帖类别","首轮序=选角序","末轮断连","表态档集合",
           "用了疑惑","表态覆盖率","带glossary帖数","术语轮次分布","术语加粗","加粗压帖尾","古文帖数","建议带①②③","帖均加粗处","加粗处分布","总结膨胀比","总结数数起手","总结列清单","总结转日常","收尾建议条数","建议编号体例","建议时间锚","insight报幕式"]
flags = []
print("\n%-14s %-22s %s" % ("维度", "本场", "最近几场"))
print("-" * 70)
for k in SCALARS:
    recent_vals = [f[k] for _, f in R]
    cur = T[k]
    # 连号判定：与最近≥2场全部相同 → 模板（但「空/0/False」是『该特征没用上』，不算模板，跳过）
    same_tail = recent_vals[-2:] if len(recent_vals) >= 2 else recent_vals
    trivial = cur in (0, 0.0, False, "", (), None)
    streak = (not trivial) and len(same_tail) >= 2 and all(v == cur for v in same_tail)
    mark = " ⚠️ 连号" if streak else ""
    if streak:
        flags.append(k)
    print("%-14s %-22s %s%s" % (k, str(cur), " | ".join(str(v) for v in recent_vals), mark))

# ---- 措辞坍缩：summary 开头 ----（『N个人从…进来』『先说共识』最易跨场复读）
print("\n【summary 起手式】（先共识后分歧是要求，但开场句式别每场同一副模子）")
allso = Counter()
for eid, f in R:
    for ai, op in f.get("_summary_open", []):
        allso[op] += 1
for ai, op in T["_summary_open"]:
    reuse = allso.get(op, 0)
    tag = " ⚠️ 最近%d场也这么开头" % reuse if reuse >= 2 else ""
    print("  %-7s 「%s」%s" % (ai, op, tag))
    if reuse >= 2:
        flags.append("summary起手:%s" % op)

# ---- 措辞坍缩：insight 开头 ----
print("\n【insight 开头】（同一开头跨场复用＝套路；每家换个起手式）")
allio = Counter()
for eid, f in R:
    for ai, op in f["_insight_open"]:
        allio[op] += 1
for ai, op in T["_insight_open"]:
    reuse = allio.get(op, 0)
    tag = " ⚠️ 最近%d场也这么开头" % reuse if reuse >= 2 else ""
    print("  %-7s 「%s…」%s" % (ai, op, tag))
    if reuse >= 2:
        flags.append("insight开头:%s" % op)

# ---- 措辞坍缩：advice 开头 ----（"三件今天就能试的事"/"本周可做三件事" 最易跨场复读）
print("\n【advice 开头】（每家换个起手式，别每场都从同一句数数开始）")
allao = Counter()
for eid, f in R:
    for ai, op in f.get("_advice_open", []):
        allao[op] += 1
for ai, op in T["_advice_open"]:
    reuse = allao.get(op, 0)
    tag = " ⚠️ 最近%d场也这么开头" % reuse if reuse >= 2 else ""
    print("  %-7s 「%s…」%s" % (ai, op, tag))
    if reuse >= 2:
        flags.append("advice开头:%s" % op)

# ---- 措辞坍缩：advice 起手『去水版』----（"结合全场智慧"/"综合各家智慧" 只差两字，逐字比不出来）
allan = Counter()
for eid, f in R:
    for ai, op in f.get("_advice_open_norm", []):
        allan[op] += 1
for ai, op in T.get("_advice_open_norm", []):
    reuse = allan.get(op, 0)
    if reuse >= 2:
        print("  ⚠️ %-7s 起手去水后是「%s」——最近 %d 场同模子（只换了填充词不算换）" % (ai, op, reuse))
        flags.append("advice起手同模子:%s" % ai)

# ---- 帖子起手式：本场内部单调 + 跨场复用 ----
print("\n【帖子起手式】（本场内大量同起手 or 跨场复用＝套路）")
cur_open = Counter(T["_post_open"])
top = cur_open.most_common(3)
nposts = len(T["_post_open"])
for op, c in top:
    if c >= max(3, round(nposts * 0.35)):
        print("  ⚠️ 本场 %d/%d 帖以「%s…」起手——太单调" % (c, nposts, op))
        flags.append("帖起手:%s" % op)
recent_open = Counter(op for _, f in R for op in f["_post_open"])
cross = [(op, c) for op, c in cur_open.items() if recent_open.get(op, 0) >= nposts]  # 最近场也高频
for op, c in cross[:3]:
    print("  ⚠️ 「%s…」起手在最近几场也反复出现（跨场套路）" % op)
    flags.append("跨场帖起手:%s" % op)

print("\n" + "=" * 70)
if flags:
    print("⚠️ 检出 %d 处模板化：%s" % (len(flags), "，".join(flags)))
    print("→ 至少**故意改掉一处**（换人数/换钩子数/换反驳结构/换开头措辞…），别让形状定型。")
else:
    print("✓ 结构指纹与最近几场差异够大，未见明显模板化。")
print("另：再用挑剔的眼光通读一遍，找上面没编码进来的新套路（这才防得住未知维度的坍缩）。")
