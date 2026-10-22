#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每日抓取母婴热点 + 真实搞钱项目 -> 生成 hot.json（供工作台读取）
免费、无依赖、可跑在 GitHub Actions 上（每天早晨自动执行）。

逻辑：
1. 优先尝试从免费 RSS 源抓取真实母婴热点（失败则跳过，不影响产出）；
2. 无论如何，按"日期轮换 + 1岁占80%"生成当日精选，保证每天都有新内容；
3. 每日轮换 3 条真实低门槛搞钱灵感（不卖课）；
4. 输出 hot.json：{ "date": "YYYY-MM-DD", "topics": [...], "money": [...], "source": ... }
   其中每个 topic 字段与前端 generateCopy 完全对应（痛点/步骤/分点都带齐内容）。
"""
import json, urllib.request, urllib.parse, datetime, random, html

DATE = datetime.date.today().isoformat()
random.seed(DATE)  # 用日期做种子：当天稳定、隔天变化

# 免费公开热搜接口（支持跨域、无需 key）：用来抓真实母婴热点
LIVE_SRC = ["weibo", "zhihu", "douyin", "toutiao"]
LIVE_KW = ["母婴","育儿","宝宝","婴儿","幼儿","幼儿园","妈妈","宝妈","儿童","亲子","奶粉","辅食","疫苗","怀孕","孕","早教","带娃","托育","生育","产假","育儿补贴","学前","入园","手足口","隔代","婆媳","小学生","纸尿裤","尿布","月子","备孕","哄睡"]
SRC_NAME = {"weibo":"微博","zhihu":"知乎","douyin":"抖音","toutiao":"头条"}
# 黑名单：命中就丢弃。避免「XX妈妈涉嫌诈骗」这类命中了关键词、却完全不能当母婴选题的八卦/案件/负面
LIVE_BLACK = ["诈骗","骗局","被骗","传销","被捕","判刑","获刑","入狱","拘留","刑拘","涉嫌","起诉","案件","落马","被查","双开","贪污","受贿","死亡","去世","离世","身亡","猝死","自杀","轻生","坠亡","坠楼","车祸","遇难","性侵","猥亵","强奸","家暴","虐待","虐童","遗弃","拐卖","拐骗","离婚","出轨","塌房","绯闻","封杀","吸毒","赌博","杀人","砍伤","爆炸","失火","中毒","溺亡","走失","失踪"]

# 本地轮换池：真实可行的母婴话题（带完整文案骨架，步骤/分点都给齐）
# 字段约定：age, type(痛点/步骤/分点), title, desc,
#   痛点型: pain, exp, view, conclusion, question
#   步骤/分点型: intro, steps/points=[{t, action, remind}], conclusion, question
POOL = [
    {"age": "1岁", "type": "痛点", "title": "1岁夜醒频繁，是不是哄睡方式错了？",
     "desc": "很多妈妈以为自己不会哄，其实1岁夜醒大多是发育正常现象。",
     "pain": "半夜两小时一醒，抱也不是放也不是，妈妈快崩溃了。",
     "exp": "我家潼妹之前也是，试了一堆方法才摸清门道。",
     "view": "核心就一句：先排查不舒服，再谈哄睡方式，别一上来就怪自己。",
     "conclusion": "夜醒不是你带得差，是娃在长大，慢慢来。",
     "question": "你家娃一夜醒几次？评论区聊聊～"},
    {"age": "1岁", "type": "步骤", "title": "1岁辅食怎么加才不踩坑？",
     "desc": "按阶段、按性状、按过敏观察，三步走最稳。",
     "intro": "新手妈妈别慌，辅食加起来其实就三步。",
     "steps": [
         {"t": "第一步 看信号", "action": "能独坐、挺舌反射消失、对食物感兴趣再开始。", "remind": "别早于4个月，别晚于6个月硬拖。"},
         {"t": "第二步 单一引入", "action": "每次只加一种新食物，连吃3天观察。", "remind": "高铁米粉打头阵，蛋白类往后排。"},
         {"t": "第三步 看性状", "action": "从泥糊过渡到碎末再到小块。", "remind": "别一直吃泥，影响咀嚼发育。"}],
     "conclusion": "顺序是铁律，急不来。",
     "question": "你家娃第一口辅食吃的啥？"},
    {"age": "1岁", "type": "分点", "title": "1岁还在疯狂吃手，要不要强行管？",
     "desc": "吃手是口欲期自我安抚，硬管反而更黏。",
     "intro": "先别急着骂，分三点说清楚。",
     "points": [
         {"t": "这是正常发育", "action": "口欲期靠嘴巴探索世界，1岁内常见。", "remind": "只要不影响吃奶和睡眠，别紧张。"},
         {"t": "硬管会反弹", "action": "打手、涂苦药水容易引发焦虑。", "remind": "越压越想吃，关系还搞僵。"},
         {"t": "用替代转移", "action": "给牙胶、增加互动游戏消耗精力。", "remind": "2岁后还频繁再考虑干预。"}],
     "conclusion": "顺其自然，比强行管更省心。",
     "question": "你家娃吃手你是怎么处理的？"},
    {"age": "1岁", "type": "痛点", "title": "1岁学走路摔了，该不该马上抱？",
     "desc": "一摔就冲过去，可能悄悄废掉娃的抗挫力。",
     "pain": "刚松手走两步就啪嗒摔了，当妈的心都揪起来。",
     "exp": "我家之前也是，一见摔就冲，后来发现娃哭得更凶了。",
     "view": "小摔别秒抱，先给个鼓励的眼神，让他自己爬起来。",
     "conclusion": "摔跤也是课，护得太紧反而难独立。",
     "question": "你家娃摔了你是马上抱还是等等？"},
    {"age": "1岁", "type": "步骤", "title": "1岁牙齿护理从哪天开始？",
     "desc": "第一颗牙冒头就要刷，别等满口牙。",
     "intro": "护牙趁早，跟着做就行。",
     "steps": [
         {"t": "第一颗就刷", "action": "出牙即用婴儿软毛牙刷，米粒大含氟牙膏。", "remind": "别用盐水或纱布糊弄。"},
         {"t": "吃完漱口", "action": "喝完奶喂两口温水。", "remind": "夜奶后必须清洁再睡。"},
         {"t": "定期看牙", "action": "1岁前完成第一次口腔检查。", "remind": "龋坏发展快，别等疼了才去。"}],
     "conclusion": "乳牙也是牙，坏了影响恒牙。",
     "question": "你家娃几颗牙了？护牙咋搞的？"},
    {"age": "1岁", "type": "痛点", "title": "1岁粘人精，上厕所都要跟着，正常吗？",
     "desc": "分离焦虑是安全感足的表现，不是娇气。",
     "pain": "连上厕所都要扒门，感觉没有一分钟自由。",
     "exp": "我一度怀疑是不是惯坏了，后来才懂这是阶段。",
     "view": "粘人说明依恋关系建得好，是好事不是坏事。",
     "conclusion": "给足安全感，他才敢松开手去探索。",
     "question": "你家娃也这么粘人吗？"},
    {"age": "1岁", "type": "分点", "title": "1岁牛奶蛋白过敏，营养跟得上吗？",
     "desc": "避开牛奶也能长肉，关键是替补到位。",
     "intro": "确诊后别慌，分三点安排。",
     "points": [
         {"t": "奶的替补", "action": "深度水解/氨基酸配方，或强化豆奶。", "remind": "普通羊奶牛奶都先停。"},
         {"t": "钙从哪来", "action": "豆腐、绿叶菜、芝麻酱补起来。", "remind": "必要时遵医嘱补钙。"},
         {"t": "蛋白来源", "action": "肉禽鱼蛋黄逐步引入。", "remind": "每次单一种，观察3天。"}],
     "conclusion": "避开了也能养得壮。",
     "question": "过敏娃你都怎么喂养的？"},
    {"age": "1岁", "type": "步骤", "title": "1岁语言爆发期，怎么引导开口？",
     "desc": "不是教，是'泡'在语言里。",
     "intro": "想娃早开口，照这三步。",
     "steps": [
         {"t": "多说当下", "action": "做啥说啥，'我们在穿袜子哦'。", "remind": "别只问'这是什么'，多描述。"},
         {"t": "给选择", "action": "要苹果还是香蕉？留出表达空间。", "remind": "别秒懂秒满足，让他开口。"},
         {"t": "读绘本", "action": "每天固定15分钟指读。", "remind": "指物命名比背儿歌管用。"}],
     "conclusion": "输入够，输出自然来。",
     "question": "你家娃现在会说几个词了？"},
    {"age": "1岁", "type": "分点", "title": "1岁湿疹反复红成一片，护理做对没？",
     "desc": "湿疹七分润肤三分药，保湿是地基。",
     "intro": "别只抹药，分三点讲透。",
     "points": [
         {"t": "猛保湿", "action": "每天厚涂无香霜，洗澡后3分钟内。", "remind": "量要足，别舍不得。"},
         {"t": "控诱因", "action": "纯棉衣物、室温别高、少汗液刺激。", "remind": "羊毛羽绒先收起来。"},
         {"t": "按需用药", "action": "急性期遵医嘱用弱效激素。", "remind": "别谈激素色变，规范用安全。"}],
     "conclusion": "润肤做到位，少发作一大半。",
     "question": "湿疹娃你家用的啥霜？"},
    {"age": "1岁", "type": "痛点", "title": "1岁自己吃饭满地狼藉，还要不要让他自己来？",
     "desc": "乱是暂时的，能力是一辈子的。",
     "pain": "饭撒一地、衣服全脏，收拾到崩溃。",
     "exp": "我试过喂省事，结果越大越难戒。",
     "view": "脏一点换自主进食能力，值。",
     "conclusion": "铺地垫、给勺叉，让他自己来。",
     "question": "你家是喂还是让他自己吃？"},
    {"age": "1岁", "type": "步骤", "title": "1岁一坐餐椅就哭，怎么破？",
     "desc": "先让餐椅变好玩，再谈吃饭。",
     "intro": "别硬按，三步走。",
     "steps": [
         {"t": "先玩后吃", "action": "平时让娃在餐椅上玩玩具。", "remind": "别只在吃饭时塞进去。"},
         {"t": "固定座位", "action": "每次都同一个位置同一个椅。", "remind": "建立'这里=吃饭'的信号。"},
         {"t": "短时多次", "action": "哭就抱出来，下次再来别耗。", "remind": "别在椅上哄骂，越坐越抗拒。"}],
     "conclusion": "关系顺了，吃饭才顺。",
     "question": "你家餐椅战争怎么解决的？"},
    {"age": "1岁", "type": "分点", "title": "1岁一天怎么安排，娃好带又不闹觉？",
     "desc": "固定节奏比完美 schedule 更重要。",
     "intro": "三点搭出好节奏。",
     "points": [
         {"t": "吃玩睡顺序", "action": "清醒时先玩再吃，最后睡。", "remind": "别奶睡，夜醒更难搞。"},
         {"t": "户外放电", "action": "每天保证1-2小时户外。", "remind": "感官刺激够了晚上睡得香。"},
         {"t": "固定睡前", "action": "洗澡-按摩-关灯一套流程。", "remind": "信号稳定，入睡快。"}],
     "conclusion": "节奏稳，妈妈也省心。",
     "question": "你家一天是怎么排的？"},
    {"age": "6岁", "type": "痛点", "title": "6岁幼小衔接，要不要提前学拼音算术？",
     "desc": "提前抢跑容易后劲不足，习惯比知识值钱。",
     "pain": "别家都报班，不学怕跟不上，学了怕厌学。",
     "exp": "我身边抢跑的，二年级就拉开差距反向了。",
     "view": "比起拼音算术，专注力、自理、阅读兴趣更值钱。",
     "conclusion": "养习惯，别刷题。",
     "question": "幼小衔接你报班了吗？"},
    {"age": "6岁", "type": "分点", "title": "6岁写作业磨蹭像树懒，怎么治？",
     "desc": "磨蹭多是能力没跟上，不是故意气你。",
     "intro": "别急着吼，分三点。",
     "points": [
         {"t": "拆小任务", "action": "一张卷子切成3段，做完给休息。", "remind": "一次性甩大任务娃直接宕机。"},
         {"t": "给计时", "action": "番茄钟15分钟专注+5分钟玩。", "remind": "可视化时间，比催管用。"},
         {"t": "减少干扰", "action": "书桌只留文具，远离电视。", "remind": "环境乱，注意力更散。"}],
     "conclusion": "能力上来，自然不磨。",
     "question": "你家写作业咋提速的？"},
    {"age": "6岁", "type": "步骤", "title": "6岁玩手机时间怎么定，才不上瘾？",
     "desc": "堵不如疏，规则一起定才执行得下去。",
     "intro": "三步走，温和立规矩。",
     "steps": [
         {"t": "共定规则", "action": "几点看、看多久，让娃自己提方案。", "remind": "他参与定的，才愿守。"},
         {"t": "内容把关", "action": "优先科普/动画，限短视频。", "remind": "算法投喂最容易上头。"},
         {"t": "替代活动", "action": "准备户外运动/桌游兜底。", "remind": "无聊了才粘手机，有事做就放下。"}],
     "conclusion": "规则清晰，亲子不鸡飞狗跳。",
     "question": "你家手机规矩是咋定的？"},
]

# 真实低门槛搞钱灵感池（不卖课、不交学费，靠信息差+执行力）
MONEY_POOL = [
    {"title": "闲鱼倒卖（本地闲置）", "how": "收小区/废品群低价闲置，清洁拍照后加价出，赚信息差。", "risk": "别碰仿品、违禁品；先小单试水别压货。"},
    {"title": "小区团购团长", "how": "对接源头供货（水果/母婴），群里开团收少量服务费。", "risk": "先小范围试，莫压货；售后要跟紧。"},
    {"title": "手机约拍", "how": "用手机给邻居拍证件照/宠物/孕妇照，按张收费。", "risk": "先免费练手攒作品；注意隐私授权。"},
    {"title": "小红书无货源笔记", "how": "二次创作家居/母婴好物笔记挂商品赚佣金。", "risk": "遵守平台规则，别搬运抄袭；别交'培训费'。"},
    {"title": "本地代跑腿/代排队", "how": "接送、排队、取送，社区群里接单。", "risk": "注意人身安全；平台抽成要算清。"},
    {"title": "二手绘本/童书回收转卖", "how": "收干净绘本消毒后打包转卖或出租。", "risk": "注意卫生与品相；版权书别影印。"},
    {"title": "母婴闲置群代卖", "how": "帮邻居挂闲置抽佣金，你只做信息撮合。", "risk": "钱货两清再放款，防纠纷。"},
    {"title": "手工/烘焙接单", "how": "做辅食冻干、手工玩具，朋友圈/社群接单。", "risk": "食品注意合规；别盲目扩产。"},
]


def clean(s):
    return html.unescape(str(s)).replace("\n", " ").strip()


def fetch_external():
    """抓取公开热搜并筛母婴关键词，返回真实热点列表（失败返回空）。"""
    out = []
    seen = set()
    for s in LIVE_SRC:
        try:
            url = "https://60s.viki.moe/v2/" + s
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=8) as r:
                data = json.load(r)
            arr = (data or {}).get("data", [])
            if not isinstance(arr, list):
                continue
            for i, x in enumerate(arr):
                title = clean(x.get("title") or x.get("hot_word") or x.get("word") or "")
                if not title or title in seen:
                    continue
                if any(k in title for k in LIVE_BLACK):
                    continue
                if any(k in title for k in LIVE_KW):
                    seen.add(title)
                    src = SRC_NAME.get(s, s)
                    out.append({
                        "id": "live_" + s + str(i), "age": "6岁" if i % 4 == 0 else "1岁",
                        "type": "痛点", "tag": "🔥今日热搜", "live": True,
                        "title": title[:40], "desc": "来自%s今日热搜 · 真实热点" % src,
                        "pain": title + "——这条今天刷屏了，先抛出来聊聊。",
                        "exp": "我看了下评论区，再结合自家两个娃的经历，有几个真心话想说。",
                        "view": "热点归热点，别焦虑，适合自家娃的才是对的。",
                        "conclusion": "理性吃瓜，落地到自家娃要冷静，不盲从。",
                        "question": "这条你怎么看？你家娃遇到过吗？评论区聊聊～",
                        "source": src
                    })
        except Exception:
            continue
        if len(out) >= 5:
            break
    return out[:5]


def rotate():
    pool = POOL[:]
    random.shuffle(pool)
    # 抽 5 条，保证 1岁 占 80%（4 条1岁 + 1条6岁）
    one = [p for p in pool if p["age"] == "1岁"][:4]
    six = [p for p in pool if p["age"] == "6岁"][:1]
    chosen = (one + six)[:5]
    topics = []
    for i, p in enumerate(chosen):
        t = {
            "id": "rot" + str(i), "age": p["age"], "type": p["type"], "tag": "🔥当日精选",
            "title": p["title"], "desc": p["desc"],
        }
        if p["type"] == "痛点":
            t.update({"pain": p["pain"], "exp": p["exp"], "view": p["view"],
                      "conclusion": p["conclusion"], "question": p["question"]})
        else:
            key = "steps" if p["type"] == "步骤" else "points"
            t.update({"intro": p["intro"], key: p[key],
                      "conclusion": p["conclusion"], "question": p["question"]})
        topics.append(t)
    return topics


def rotate_money():
    pool = MONEY_POOL[:]
    random.shuffle(pool)
    return [dict(m, tag="今日精选") for m in pool[:3]]


def main():
    ext = fetch_external()
    live_n = len(ext)
    # 真实热点优先；不足 5 条时用本地精选补足，保证每天都有内容
    if live_n < 5:
        base = [dict(t, tag="🔥当日精选") for t in rotate()]
        ext = ext + base[:5 - live_n]
    money = rotate_money()
    out = {"date": DATE, "topics": ext, "money": money,
           "source": "live+rotate" if live_n else "rotate"}
    with open("hot.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("written hot.json with", len(ext), "topics (live=%d)" % live_n, ", ", len(money), "money; source=", out["source"])


if __name__ == "__main__":
    main()
