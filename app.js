/* ============================================================
   熹哥潼妹工作台 · 应用逻辑
   - 纯前端 / 离线可用 / 数据存 localStorage
   - 可装到手机桌面当 App（PWA）
   ============================================================ */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------------- 存储 ---------------- */
  const KEYS = {
    shoot: "xt_shoot", products: "xt_products", work: "xt_work",
    kids: "xt_kids", drafts: "xt_drafts", fetched: "xt_fetched",
    lastUpdate: "xt_last_update", moneyCustom: "xt_money_custom",
    customTopics: "xt_custom_topics", fetchedMoney: "xt_fetched_money",
    hotUrl: "xt_hot_url"
  };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // 基础数据（首次用 SEED，之后用用户自己的）
  let shoot = load(KEYS.shoot, SEED.shootDefault);
  let products = load(KEYS.products, SEED.productsDefault);
  let work = load(KEYS.work, SEED.workDefault);
  let kids = load(KEYS.kids, SEED.kidsDefault);
  let drafts = load(KEYS.drafts, []);
  let fetched = load(KEYS.fetched, []);
  let moneyCustom = load(KEYS.moneyCustom, []);
  let customTopics = load(KEYS.customTopics, []);
  let fetchedMoney = load(KEYS.fetchedMoney, []);
  let hotUrl = load(KEYS.hotUrl, "");
  // 自定义选题入库的临时表单状态
  let ctAge = "1岁";
  let ctType = "痛点";
  let ctRows = [];
  let ctEditId = null;
  // 各板块「就地编辑」状态
  let shootEditIdx = null;
  let kidEditId = null;
  let workEditId = null;
  let prodEditIdx = null;
  let moneyEditId = null;
  let pubEditId = null;
  let draftEditId = null;
  const clearEdits = () => { shootEditIdx = kidEditId = workEditId = prodEditIdx = moneyEditId = pubEditId = draftEditId = null; };

  const allTopics = () => SEED.topics.concat(customTopics);
  const allMoney = () => SEED.money.concat(moneyCustom);
  const findTopic = (id) => allTopics().find((x) => x.id === id) || fetched.find((x) => x.id === id) || null;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // 给默认/历史条目补 id（保证每条都能编辑、删除、勾选）
  const ensureId = (arr) => (arr || []).map((x) => (x && x.id) ? x : Object.assign({}, x, { id: uid() }));
  kids = ensureId(kids); save(KEYS.kids, kids);
  work = ensureId(work); save(KEYS.work, work);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const dayOfYear = () => { const d = new Date(); const s = new Date(d.getFullYear(), 0, 0); return Math.floor((d - s) / 86400000); };

  /* ---------------- 文案生成器 ---------------- */
  function generateCopy(t, type) {
    type = type || t.type;
    let out = "";
    if (type === "痛点") {
      out += (t.pain || "") + "\n\n";
      out += (t.exp || "") + "\n\n";
      out += "我的观点很简单：" + (t.view || "") + "\n";
      if (t.product && t.product.name) out += "\n（带货）我家一直在用「" + t.product.name + "」，" + (t.product.reason || "") + "\n";
      out += "\n最后说一句：" + (t.conclusion || "") + "\n\n";
      out += (t.question || "");
    } else if (type === "步骤") {
      out += (t.intro || "") + "\n\n";
      (t.steps || []).forEach((s, i) => {
        out += (i + 1) + ". " + s.t + "\n";
        out += "　做法：" + s.action + "\n";
        out += "　提醒：" + s.remind + "\n\n";
      });
      out += (t.conclusion || "") + "\n\n" + (t.question || "");
    } else {
      out += (t.intro || "") + "\n\n";
      (t.points || []).forEach((p) => {
        out += "▫️ " + p.t + "\n";
        out += "　做法：" + p.action + "\n";
        out += "　提醒：" + p.remind + "\n\n";
      });
      out += (t.conclusion || "") + "\n\n" + (t.question || "");
    }
    return out.trim();
  }

  // 自定义话题模板
  function customTemplate(type, title) {
    const head = "🎥 口播文案 · " + (title || "（在这里写你的话题）") + "\n";
    if (type === "痛点") {
      return (head + "\n【开头痛点】写一句妈妈真实崩溃的瞬间……\n\n【真实经历】讲一件你自己身上发生的事……\n\n我的观点很简单：【你的看法】\n\n（带货）可写：我在用XX，理由是……\n\n最后说一句：【总结】\n\n【互动提问】评论区问一句，引导留言");
    } else if (type === "步骤") {
      return (head + "\n【引子】一句话说明这件事怎么做。\n\n1. 第1步 标题\n　做法：……\n　提醒：……\n\n2. 第2步 标题\n　做法：……\n　提醒：……\n\n3. 第3步 标题\n　做法：……\n　提醒：……\n\n【结论】\n【互动提问】");
    }
    return (head + "\n【引子】一句话带入。\n\n▫️ 第1点 标题\n　做法：……\n　提醒：……\n\n▫️ 第2点 标题\n　做法：……\n　提醒：……\n\n▫️ 第3点 标题\n　做法：……\n　提醒：……\n\n【结论】\n【互动提问】");
  }

  /* ---------------- 每日热点（轮换 + 联网补抓） ---------------- */
  // 外部数据源（可替换为你自己的免费 RSS/JSON）。失败会自动回退到离线精选。
  // 真实母婴热点改由公开热搜接口（60s.viki.moe）实时抓取，见 fetchHotTopics
  function dailyPicks(n) {
    const list = allTopics();
    const off = dayOfYear() % Math.max(1, list.length);
    const rot = list.slice(off).concat(list.slice(0, off));
    return rot.slice(0, n || 3);
  }
  function dailyMoney() {
    const list = allMoney();
    return list[dayOfYear() % list.length];
  }
  // —— 真实联网抓取：从公开热搜接口拉取，再用母婴关键词筛选 ——
  const LIVE_SRC = ["weibo", "zhihu", "douyin", "toutiao"];
  const SRC_NAME = { weibo: "微博", zhihu: "知乎", douyin: "抖音", toutiao: "头条" };
  const LIVE_KW = ["母婴","育儿","宝宝","婴儿","幼儿","幼儿园","妈妈","宝妈","儿童","亲子","奶粉","辅食","疫苗","怀孕","孕","早教","带娃","托育","生育","产假","育儿补贴","学前","入园","手足口","隔代","婆媳","小学生","纸尿裤","尿布","月子","备孕","哄睡"];
  async function fetchLiveParenting() {
    const all = [];
    await Promise.all(LIVE_SRC.map(async (s) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 7000);
        const r = await fetch("https://60s.viki.moe/v2/" + s, { cache: "no-store", signal: ctrl.signal });
        clearTimeout(timer);
        const j = await r.json();
        const arr = j && j.data;
        if (Array.isArray(arr)) arr.forEach((x) => {
          const t = (x.title || x.hot_word || x.word || "");
          if (t) all.push({ title: t, src: s });
        });
      } catch (e) {}
    }));
    const seen = new Set(); const hits = [];
    for (const h of all) {
      if (seen.has(h.title)) continue;
      if (LIVE_KW.some((k) => h.title.indexOf(k) >= 0)) { seen.add(h.title); hits.push(h); }
    }
    return hits.slice(0, 5);
  }
  function mapLiveToTopic(h, i) {
    const src = SRC_NAME[h.src] || h.src;
    return {
      id: "live" + uid(), age: i % 4 === 0 ? "6岁" : "1岁", type: "痛点", tag: "🔥今日热搜",
      title: h.title.slice(0, 40),
      desc: `来自${src}今日热搜 · 真实热点`,
      pain: h.title + "——这条今天刷屏了，先抛出来聊聊。",
      exp: "我看了下评论区，再结合自家两个娃的经历，有几个真心话想说。",
      view: "热点归热点，别焦虑，适合自家娃的才是对的。",
      conclusion: "理性吃瓜，落地到自家娃要冷静，不盲从。",
      question: "这条你怎么看？你家娃遇到过吗？评论区聊聊～",
      source: src, live: true
    };
  }
  async function fetchHotTopics(silent) {
    const btn = $("#refreshBtn");
    if (!navigator.onLine) {
      if (btn) { btn.disabled = false; btn.textContent = "🔄 获取今日热点"; }
      if (!silent) toast("📴 没网啦～已保留离线精选，联网后会自动补更 ✅");
      save(KEYS.lastUpdate, Date.now());
      return;
    }
    if (btn && !silent) { btn.disabled = true; btn.textContent = "⏳ 抓取中…"; }
    // 1) 优先读用户配置的 GitHub Pages 地址（每日自动抓取 · 最贴合母婴 · 最稳）
    let realTopics = [];
    if (hotUrl) {
      try {
        const base = hotUrl.replace(/\/?$/, "/");
        const hr = await fetch(base + "hot.json", { cache: "no-store", mode: "cors" });
        if (hr.ok) {
          const hj = await hr.json();
          if (hj && hj.date === todayKey() && Array.isArray(hj.topics) && hj.topics.length) {
            realTopics = hj.topics.map((t) => Object.assign({}, t, { tag: t.tag || "🔥今日精选", live: !!t.live }));
            if (Array.isArray(hj.money) && hj.money.length) { fetchedMoney = hj.money; save(KEYS.fetchedMoney, fetchedMoney); }
          }
        }
      } catch (e) {}
    }
    // 2) 同源兜底：站点自带 hot.json（随部署一起发布，断网/热搜源挂了也有内容）
    if (realTopics.length === 0) {
      try {
        const hr = await fetch("./hot.json", { cache: "no-store" });
        if (hr.ok) {
          const hj = await hr.json();
          if (hj && Array.isArray(hj.topics) && hj.topics.length) {
            realTopics = hj.topics.map((t) => Object.assign({}, t, { tag: t.tag || "🔥今日精选", live: !!t.live }));
            if (Array.isArray(hj.money) && hj.money.length) { fetchedMoney = hj.money; save(KEYS.fetchedMoney, fetchedMoney); }
          }
        }
      } catch (e) {}
    }
    // 3) 真实联网抓取公开热搜 → 筛母婴关键词（免费、支持跨域）
    let liveHits = [];
    if (realTopics.length < 5) {
      try { liveHits = await fetchLiveParenting(); } catch (e) {}
    }
    // 3) 用内置母婴库补足，保证板块不空（明确标注「今日精选」）
    let fill = [];
    const need = 5 - realTopics.length - liveHits.length;
    if (need > 0) {
      fill = dailyPicks(need).map((p) => Object.assign({}, p, { tag: "🔥今日精选", live: false }));
    }
    const realTotal = realTopics.length + liveHits.length;
    fetched = realTopics.concat(liveHits.map((h, i) => mapLiveToTopic(h, realTopics.length + i))).concat(fill).slice(0, 6);
    save(KEYS.fetched, fetched);
    save(KEYS.lastUpdate, Date.now());
    if (btn) { btn.disabled = false; btn.textContent = "🔄 获取今日热点"; }
    if (!silent) {
      if (realTotal > 0) toast(`🔥 已联网抓取！今日真实母婴热搜 ${realTotal} 条 + 精选 ${fill.length} 条 ✅`);
      else toast("🌐 联网了，今日热搜里母婴相关较少，已为你精选母婴话题 ✅");
    }
    if (currentPage === "home" || currentPage === "topics" || currentPage === "money") render();
  }

  /* ---------------- 渲染：各页面 ---------------- */
  let currentPage = "home";
  let pendingTopicId = null;

  function render() {
    const view = $("#view");
    if (currentPage === "home") view.innerHTML = renderHome();
    else if (currentPage === "topics") view.innerHTML = renderTopics();
    else if (currentPage === "write") view.innerHTML = renderWrite();
    else if (currentPage === "shoot") view.innerHTML = renderShoot();
    else if (currentPage === "publish") view.innerHTML = renderPublish();
    else if (currentPage === "money") view.innerHTML = renderMoney();
    else if (currentPage === "kids") view.innerHTML = renderKids();
    else if (currentPage === "dairen") view.innerHTML = renderDairen();
    else if (currentPage === "work") view.innerHTML = renderWork();
    bindPage();
  }

  /* ----- 首页 ----- */
  function renderHome() {
    const picks = dailyPicks(3);
    const m = dailyMoney();
    const kidsPending = kids.filter((k) => !k.done).length;
    const hour = new Date().getHours();
    const hi = hour < 11 ? "早安呀 👋" : hour < 18 ? "下午好 ☀️" : "晚上好 🌙";
    const realN = fetched.filter((t) => t.live).length;
    const newFlag = fetched.length ? `<span class="topic-chip chip-new">🔥 今日已联网更新（真实热搜 ${realN} 条）</span>` : "";
    return `
      <div class="hero">
        <h2>${hi} 熹哥潼妹妈妈</h2>
        <p>📅 ${new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</p>
        <p>今天也要好好带娃，顺便搞点小钱 💰</p>
        <div class="stat">
          <div class="pill"><b>${kidsPending}</b><span>待办备忘</span></div>
          <div class="pill"><b>${drafts.length}</b><span>文案草稿</span></div>
          <div class="pill"><b>${products.length}</b><span>带货商品</span></div>
          <div class="pill"><b>${allTopics().length}</b><span>可用选题</span></div>
        </div>
      </div>

      <div class="card">
        <h3>💡 今日选题推荐 ${newFlag}</h3>
        <div>${picks.map((t) => topicChip(t, "home")).join("")}</div>
        <p class="muted" style="margin-top:8px">点任意选题 → 直接生成可发的小红书/抖音/视频号口播文案</p>
      </div>

      <div class="card">
        <h3>💰 今日搞钱灵感</h3>
        <div class="money-card" style="margin:0">
          <h3>${esc(m.title)} <span class="nocourse">不卖课</span></h3>
          <div class="how">${esc(m.how)}</div>
        </div>
        <a class="go" href="#money" data-page="money">查看全部搞钱项目 →</a>
      </div>

      <div class="grid2">
        <div class="card"><h3>🎬 拍摄清单</h3><p class="muted">${shoot.length} 条拍摄要点已备好</p><a class="go" href="#shoot" data-page="shoot">去查看 →</a></div>
        <div class="card"><h3>📝 工作备忘录</h3><p class="muted">${work.length} 条待跟进</p><a class="go" href="#work" data-page="work">去查看 →</a></div>
      </div>

      ${fetchedMoney.length ? `<div class="card"><h3>🔥 今日精选搞钱（每日自动抓取）</h3>
        ${fetchedMoney.map((m) => `<div class="money-card fresh"><h3>${esc(m.title)} <span class="nocourse">不卖课</span></h3><div class="how">${esc(m.how)}</div><div class="risk">⚠️ ${esc(m.risk)}</div></div>`).join("")}
        <a class="go" href="#money" data-page="money">查看全部搞钱项目 →</a></div>` : ""}

      <div class="card">
        <h3>🔗 每日热点数据源（GitHub Pages，选填）</h3>
        <p class="muted">点右上角「🔄 获取今日热点」默认就会<b>实时联网抓取真实母婴热搜</b>（微博/知乎/抖音/头条筛选），无需配置。想让每天早晨自动预载更贴合母婴的精选，可填你的 GitHub Pages 地址（例如 https://你的用户名.github.io/仓库名/ ）。</p>
        <div class="add-bar">
          <input id="hotUrlInput" placeholder="https://xxx.github.io/仓库名/" value="${esc(hotUrl)}" />
          <button class="btn soft" id="hotSave">💾 保存</button>
        </div>
        <p class="muted" style="margin-top:4px">保存后会立即拉取一次。怎么部署看「搞钱灵感」页底部说明。</p>
      </div>
    `;
  }
  function topicChip(t, from) {
    const isHot = (t.tag || "").indexOf("🔥") >= 0;
    const cls = t.age === "6岁" ? "chip-6" : (isHot ? "chip-new" : "chip-1");
    return `<span class="topic-chip ${cls}" data-topic="${esc(t.id)}" data-from="${from}">${t.age === "6岁" ? "👦" : "👶"} ${esc(t.title.slice(0, 16))}</span>`;
  }

  /* ----- 自定义选题入库表单 ----- */
  function ctRowHtml(r, i) {
    return `<div class="ct-row">
      <input class="ct-rt" data-i="${i}" value="${esc(r.t)}" placeholder="小标题" />
      <input class="ct-ra" data-i="${i}" value="${esc(r.action)}" placeholder="具体做法" />
      <input class="ct-rr" data-i="${i}" value="${esc(r.remind)}" placeholder="提醒" />
      <button class="ct-del" data-delrow="${i}" aria-label="删除">🗑</button>
    </div>`;
  }
  function renderCtDynamic() {
    if (ctType === "痛点") {
      return `
        <div class="label">痛点开场型内容</div>
        <textarea id="ctPain" class="ct-area" placeholder="开头痛点：写一句妈妈真实崩溃/焦虑的瞬间"></textarea>
        <textarea id="ctExp" class="ct-area" placeholder="真实经历：讲一件你身上发生的事"></textarea>
        <input id="ctView" class="ct-in" placeholder="我的观点（一句话）" />
        <div class="add-bar">
          <input id="ctProd" placeholder="带货商品名（选填）" />
          <input id="ctProdReason" placeholder="带货理由（选填）" />
        </div>
        <input id="ctConcl" class="ct-in" placeholder="结论句" />
        <input id="ctQuest" class="ct-in" placeholder="互动提问（引导留言）" />`;
    }
    if (ctType !== "痛点" && ctRows.length === 0) ctRows = [{ t: "", action: "", remind: "" }, { t: "", action: "", remind: "" }];
    return `
      <div class="label">${ctType === "步骤" ? "步骤清单" : "分点观点"}内容</div>
      <input id="ctIntro" class="ct-in" placeholder="引子：一句话带入话题" />
      <div id="ctRows">${ctRows.map(ctRowHtml).join("")}</div>
      <button class="btn soft" id="ctAddRow">➕ 再加一条</button>
      <input id="ctConcl" class="ct-in" placeholder="结论句" />
      <input id="ctQuest" class="ct-in" placeholder="互动提问（引导留言）" />`;
  }

  /* ----- 选题 ----- */
  let topicFilter = "all";
  function renderTopics() {
    let list = allTopics();
    if (topicFilter === "1") list = list.filter((t) => t.age === "1岁");
    if (topicFilter === "6") list = list.filter((t) => t.age === "6岁");
    const fresh = fetched;
    const showFresh = topicFilter === "all" || topicFilter === "1";
    const count1 = allTopics().filter((t) => t.age === "1岁").length;
    const count6 = allTopics().filter((t) => t.age === "6岁").length;
    return `
      <div class="filter-bar">
        <button data-f="all" class="${topicFilter === "all" ? "active" : ""}">全部 ${allTopics().length}</button>
        <button data-f="1" class="${topicFilter === "1" ? "active" : ""}">👶1岁 ${count1}</button>
        <button data-f="6" class="${topicFilter === "6" ? "active" : ""}">👦6岁 ${count6}</button>
      </div>
      ${showFresh && fresh.length ? `<div class="card"><h3>🔥 今日联网热点（真实热搜 + 精选）</h3>${fresh.map((t) => topicCard(t)).join("")}</div>` : ""}
      ${list.map((t) => topicCard(t)).join("")}
      <div class="card">
        <h3>➕ 自定义选题入库</h3>
        <p class="muted">把你刷到 / 想到的母婴话题存进选题库，之后点它就能直接生成口播文案。带星号必填。</p>
        <input id="ctTitle" class="ct-in" placeholder="话题标题（必填）*" />
        <div class="label">适合年龄</div>
        <div class="seg" id="ctAgeSeg">
          <button data-age="1岁" class="active">👶 1岁</button>
          <button data-age="6岁">👦 6岁</button>
        </div>
        <div class="label">文案结构</div>
        <div class="seg" id="ctTypeSeg">
          <button data-type="痛点" class="active">痛点开场</button>
          <button data-type="步骤">步骤清单</button>
          <button data-type="分点">分点观点</button>
        </div>
        <input id="ctDesc" class="ct-in" placeholder="一句话简介（选填）" />
        <div id="ctDynamic"></div>
        <button class="btn" id="ctAdd">📥 入库</button>
      </div>
    `;
  }
  function topicCard(t) {
    const isHot = (t.tag || "").indexOf("🔥") >= 0;
    const cls = t.age === "6岁" ? "chip-6" : (isHot ? "chip-new" : "chip-1");
    const isCustom = !!(t.custom || t.tag === "我的选题");
    // 真实热搜卡片：右上角加「来源小角标」，标明来自哪个平台
    const srcBadge = (t.live && t.source)
      ? `<span class="src-badge">📡 ${esc(t.source)}热搜</span>`
      : "";
    const actions = isCustom
      ? `<div class="t-actions">
           <button class="mini" data-edit-topic="${esc(t.id)}">✏️ 编辑</button>
           <button class="mini del" data-del-custom="${esc(t.id)}">🗑 删除</button>
         </div>`
      : "";
    return `
      <div class="topic-card" data-topic="${esc(t.id)}" data-from="topics">
        ${srcBadge}
        <div class="t-title${srcBadge ? " has-badge" : ""}">${esc(t.title)}</div>
        <div class="t-meta">
          <span class="topic-chip ${cls}">${esc(t.age)}</span>
          <span class="topic-chip chip-1">${esc(t.type)}型</span>
          <span class="topic-chip chip-1">${esc(t.tag || "")}</span>
        </div>
        <div class="t-desc">${esc(t.desc || "")}</div>
        <span class="go">点我 → 直接生成口播文案 ✍️</span>
        ${actions}
      </div>`;
  }

  /* ----- 写文案 ----- */
  function renderWrite() {
    const list = allTopics().concat(fetched);
    const opts = list.map((t) => `<option value="${esc(t.id)}">${(t.tag === "🔥新鲜" || t.tag === "🔥当日精选" ? "🔥 " : (t.age === "6岁" ? "👦 " : "👶 "))}${esc(t.title)}</option>`).join("");
    let initial = "";
    let titleVal = "";
    if (pendingTopicId) {
      const t = findTopic(pendingTopicId);
      if (t) { titleVal = t.title; initial = generateCopy(t); }
      pendingTopicId = null;
    }
    return `
      <div class="editor">
        <div class="card">
          <h3>✍️ 选话题 / 写文案</h3>
          <div class="label">① 选一个话题（自动套结构生成），或选「自定义」自己写</div>
          <select id="topicSel">
            <option value="">— 自定义话题（自己写）—</option>
            ${opts}
          </select>
          <input id="titleInput" placeholder="文案标题 / 话题名" value="${esc(titleVal)}" />

          <div class="label">② 结构（自定义时生效）</div>
          <div class="seg" id="typeSeg">
            <button data-t="痛点" class="active">痛点开场型</button>
            <button data-t="步骤">步骤清单型</button>
            <button data-t="分点">分点观点型</button>
          </div>

          <div class="label">③ 文案正文（已按结构生成，可直接改）</div>
          <textarea id="copyArea" placeholder="选话题后会自动生成；选自定义则点「套用模板」">${esc(initial)}</textarea>

          <div class="toolbar">
            <button class="btn soft" id="tplBtn">📋 套用模板</button>
            <button class="btn soft" id="regenBtn">🔁 重新生成</button>
          </div>
          <div class="btn-row">
            <button class="btn" id="genBtn">✨ 生成 / 刷新文案</button>
            <button class="btn ghost" id="saveDraftBtn">💾 存为草稿</button>
            <button class="btn ghost" id="copyBtn">📋 复制</button>
            <button class="btn ghost" id="txtBtn">⬇️ 导出TXT</button>
            <button class="btn ghost" id="mdBtn">⬇️ 导出MD</button>
          </div>
          <p class="muted" style="margin-top:8px">结构：开头痛点→真实经历→观点(+带货)→结论→互动提问；步骤/分点每条含「做法+提醒」。口语化·约1分钟·原创。</p>
        </div>

        <div class="card">
          <h3>📂 我的草稿（${drafts.length}）</h3>
          ${drafts.length ? drafts.map((d) => `<div class="item"><div class="body"><div class="t">${esc(d.title)}</div><div class="sub">${esc(d.updated)} · ${esc(d.content.length)}字</div></div><div class="actions"><button class="mini" data-edit-draft="${esc(d.id)}">✏️ 编辑</button><button class="mini del" data-del-draft="${esc(d.id)}">🗑 删除</button></div></div>`).join("") : '<p class="muted">还没有草稿，写一条存起来吧～</p>'}
        </div>
      </div>`;
  }

  /* ----- 拍摄清单 ----- */
  function renderShoot() {
    return `
      <div class="card">
        <h3>🎬 拍摄清单（勾完打钩 · 可改可删）</h3>
        ${shoot.map((s, i) => (shootEditIdx === i
          ? `<div class="item edit"><div class="body" style="flex:1">
               <input class="edit-input" id="shootEditInput" value="${esc(s.text)}" />
               <div class="actions"><button class="mini" id="shootSave">💾 保存</button><button class="mini" id="shootCancel">✕ 取消</button></div>
             </div></div>`
          : `<div class="item">
               <div class="chk ${s.done ? "done" : ""}" data-shoot="${i}">${s.done ? "✓" : ""}</div>
               <div class="body"><div class="t ${s.done ? "done" : ""}">${esc(s.text)}</div></div>
               <div class="actions"><button class="mini" data-edit-shoot="${i}">✏️ 编辑</button><button class="mini del" data-del-shoot="${i}">🗑 删除</button></div>
             </div>`
        )).join("")}
        <div class="add-bar"><input id="shootInput" placeholder="加一条拍摄要点" /><button class="btn soft" id="shootAdd">➕</button></div>
        <button class="btn ghost" id="shootReset">↺ 恢复默认清单</button>
      </div>`;
  }

  /* ----- 发布记录 ----- */
  function renderPublish() {
    const rec = load("xt_publish", []);
    return `
      <div class="card">
        <h3>📲 新增发布记录</h3>
        <div class="add-bar">
          <select id="pPlatform"><option>小红书</option><option>抖音</option><option>视频号</option><option>其他</option></select>
          <input id="pTopic" placeholder="发布的话题" />
        </div>
        <div class="add-bar">
          <input id="pDate" type="date" />
          <input id="pLink" placeholder="链接（选填）" />
        </div>
        <input id="pNote" placeholder="备注：播放/点赞/转化等（选填）" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:11px;margin-bottom:10px" />
        <button class="btn" id="pAdd">➕ 记录</button>
      </div>
      <div class="card">
        <h3>📒 历史记录（${rec.length}）</h3>
        ${rec.length ? rec.map((r) => (pubEditId === r.id
          ? `<div class="item edit"><div class="body" style="flex:1">
               <div class="add-bar"><select class="edit-input" id="pEditPlatform"><option ${r.platform==="小红书"?"selected":""}>小红书</option><option ${r.platform==="抖音"?"selected":""}>抖音</option><option ${r.platform==="视频号"?"selected":""}>视频号</option><option ${r.platform==="其他"?"selected":""}>其他</option></select><input class="edit-input" id="pEditTopic" value="${esc(r.topic)}" placeholder="话题" /></div>
               <div class="add-bar"><input class="edit-input" id="pEditDate" type="date" value="${esc(r.date||"")}" /><input class="edit-input" id="pEditLink" value="${esc(r.link||"")}" placeholder="链接" /></div>
               <input class="edit-input" id="pEditNote" value="${esc(r.note||"")}" placeholder="备注：播放/点赞/转化等" />
               <div class="actions"><button class="mini" id="pRecSave">💾 保存</button><button class="mini" id="pRecCancel">✕ 取消</button></div>
             </div></div>`
          : `<div class="item"><div class="body"><div class="t">${esc(r.platform)} · ${esc(r.topic)}</div><div class="sub">${esc(r.date || "")} ${esc(r.link ? "· " + r.link : "")} ${esc(r.note ? "· " + r.note : "")}</div></div><div class="actions"><button class="mini" data-edit-pub="${esc(r.id)}">✏️ 编辑</button><button class="mini del" data-del-pub="${esc(r.id)}">🗑 删除</button></div></div>`
        )).join("") : '<p class="muted">还没有发布记录，发完顺手记一笔～</p>'}
      </div>`;
  }

  /* ----- 搞钱灵感 ----- */
  function renderMoney() {
    const list = allMoney();
    return `
      ${fetchedMoney.length ? `<div class="card"><h3>🔥 今日精选搞钱（每日自动抓取·不卖课）</h3>
        ${fetchedMoney.map((m) => `<div class="money-card fresh"><h3>${esc(m.title)} <span class="nocourse">不卖课</span></h3><div class="how">${esc(m.how)}</div><div class="risk">⚠️ 风险提醒：${esc(m.risk)}</div></div>`).join("")}
        <p class="muted">来自 GitHub Actions 每天早晨自动抓取，联网后点右上角「获取今日热点」即可刷新。</p></div>` : ""}
      <div class="card"><h3>💰 搞钱灵感（真实·低门槛·<span class="nocourse">不卖课</span>）</h3>
      <p class="muted">以下项目均不要求交学费/买课，靠信息差+执行力起步。</p></div>
      ${list.map((m) => {
        const editable = !!m.custom;
        if (editable && moneyEditId === m.id) {
          return `<div class="money-card edit">
            <input class="edit-input" id="mEditTitle" value="${esc(m.title)}" placeholder="项目名称" />
            <textarea class="edit-input" id="mEditHow" placeholder="具体做法">${esc(m.how)}</textarea>
            <input class="edit-input" id="mEditRisk" value="${esc(m.risk)}" placeholder="风险提醒" />
            <div class="actions"><button class="mini" id="mSave">💾 保存</button><button class="mini" id="mCancel">✕ 取消</button></div>
          </div>`;
        }
        const act = editable ? `<div class="m-actions"><button class="mini" data-edit-money="${esc(m.id)}">✏️ 编辑</button><button class="mini del" data-del-money="${esc(m.id)}">🗑 删除</button></div>` : "";
        return `<div class="money-card"><h3>${esc(m.title)} <span class="nocourse">不卖课</span></h3><div class="how">${esc(m.how)}</div><div class="risk">⚠️ 风险提醒：${esc(m.risk)}</div>${act}</div>`;
      }).join("")}
      <div class="card"><h3>➕ 添加我的搞钱项目</h3>
        <input id="mTitle" placeholder="项目名称" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:11px;margin-bottom:8px" />
        <textarea id="mHow" placeholder="具体做法" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:11px;min-height:70px;margin-bottom:8px"></textarea>
        <input id="mRisk" placeholder="风险提醒" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:11px;margin-bottom:8px" />
        <button class="btn soft" id="mAdd">➕ 添加</button>
      </div>
      <div class="card">
        <h3>🛠️ 怎么让"每天自动抓取"真正跑起来（免费）</h3>
        <p class="muted">本工作台自带"按日期轮换"保底内容；要每天从外部真抓取并更新，用 GitHub 免费方案：</p>
        <p style="font-size:13px;line-height:1.7;margin:6px 0">
        ① 注册免费 GitHub 账号；<br>
        ② 新建一个仓库，把本项目所有文件（含 <code>fetch_topics.py</code>、<code>.github/workflows/daily.yml</code>）上传；<br>
        ③ 仓库 <b>Settings → Pages</b>，Source 选 <b>Deploy from a branch</b> → <b>main / root</b>；<br>
        ④ 工作流每天北京时间 07:30 自动跑，生成 <code>hot.json</code> 并发布；<br>
        ⑤ 把你的 Pages 地址（https://用户名.github.io/仓库名/）填到首页「🔗 数据源」里保存即可。
        </p>
        <p class="muted">这样你手机上的 App 每天打开就会自动吃到最新热点，断网也不怕（有本地保底）。</p>
      </div>`;
  }

  /* ----- 熹哥潼妹备忘录 ----- */
  function renderKids() {
    const kids1 = kids.filter((k) => k.kid && k.kid.indexOf("1岁") >= 0);
    const kids6 = kids.filter((k) => k.kid && k.kid.indexOf("6岁") >= 0);
    const block = (arr, label, tag) => `
      <div class="card"><h3>${label}（可改可删）</h3>
      ${arr.map((k) => (k.id === kidEditId
        ? `<div class="item edit"><div class="body" style="flex:1">
             <input class="edit-input" id="kidEditText" value="${esc(k.text)}" placeholder="要忙的事情" />
             <div class="add-bar"><input class="edit-input" id="kidEditDate" type="date" value="${esc(k.date || "")}" /></div>
             <div class="actions"><button class="mini" id="kidSave">💾 保存</button><button class="mini" id="kidCancel">✕ 取消</button></div>
           </div></div>`
        : `<div class="item">
             <div class="chk ${k.done ? "done" : ""}" data-kid="${esc(k.id)}">${k.done ? "✓" : ""}</div>
             <div class="body"><div class="t ${k.done ? "done" : ""}">${esc(k.text)}</div><div class="sub">${esc(k.date || "未设日期")}</div></div>
             <div class="actions"><button class="mini" data-edit-kid="${esc(k.id)}">✏️ 编辑</button><button class="mini del" data-del-kid="${esc(k.id)}">🗑 删除</button></div>
           </div>`
      )).join("") || '<p class="muted">暂无</p>'}
      </div>`;
    return `
      ${block(kids1, "👶 潼妹备忘录（1岁）", "kid1")}
      ${block(kids6, "👦 熹哥备忘录（6岁）", "kid6")}
      <div class="card"><h3>➕ 记一笔带娃待办</h3>
        <div class="add-bar">
          <select id="kidSel"><option value="潼妹(1岁)">👶 潼妹(1岁)</option><option value="熹哥(6岁)">👦 熹哥(6岁)</option></select>
          <input id="kidText" placeholder="要忙的事情" />
        </div>
        <div class="add-bar"><input id="kidDate" type="date" /><button class="btn soft" id="kidAdd">➕ 添加</button></div>
      </div>`;
  }

  /* ----- 带货 ----- */
  function renderDairen() {
    return `
      <div class="card"><h3>🛒 带货商品（${products.length}·可改可删）</h3>
      ${products.map((p, i) => (prodEditIdx === i
        ? `<div class="item edit"><div class="body" style="flex:1">
             <input class="edit-input" id="pEditName" value="${esc(p.name)}" placeholder="商品名" />
             <div class="add-bar"><input class="edit-input" id="pEditPlat" value="${esc(p.platform || "")}" placeholder="平台" /><input class="edit-input" id="pEditLink" value="${esc(p.link || "")}" placeholder="链接" /></div>
             <input class="edit-input" id="pEditNote" value="${esc(p.note || "")}" placeholder="带货话术/备注" />
             <div class="actions"><button class="mini" id="pSave">💾 保存</button><button class="mini" id="pCancel">✕ 取消</button></div>
           </div></div>`
        : `<div class="item"><div class="body"><div class="t">${esc(p.name)}</div><div class="sub">${esc(p.platform || "")} ${esc(p.link ? "· " + p.link : "")}<br>${esc(p.note || "")}</div></div><div class="actions"><button class="mini" data-edit-prod="${i}">✏️ 编辑</button><button class="mini del" data-del-prod="${i}">🗑 删除</button></div></div>`
      )).join("")}
      </div>
      <div class="card"><h3>➕ 添加商品</h3>
        <input id="pName" placeholder="商品名" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:11px;margin-bottom:8px" />
        <div class="add-bar"><input id="pPlat" placeholder="平台" /><input id="pLink2" placeholder="链接" /></div>
        <input id="pNote2" placeholder="带货话术/备注" style="width:100%;border:1px solid var(--line);border-radius:12px;padding:11px;margin-bottom:8px" />
        <button class="btn soft" id="prodAdd">➕ 添加</button>
      </div>`;
  }

  /* ----- 工作备忘录 ----- */
  function renderWork() {
    return `
      <div class="card"><h3>📝 工作备忘录（${work.length}·可改可删）</h3>
      ${work.map((w) => (w.id === workEditId
        ? `<div class="item edit"><div class="body" style="flex:1">
             <input class="edit-input" id="workEditText" value="${esc(w.text)}" placeholder="工作事项" />
             <div class="add-bar"><input class="edit-input" id="workEditDate" type="date" value="${esc(w.date || "")}" /></div>
             <div class="actions"><button class="mini" id="workSave">💾 保存</button><button class="mini" id="workCancel">✕ 取消</button></div>
           </div></div>`
        : `<div class="item">
             <div class="chk ${w.done ? "done" : ""}" data-work="${esc(w.id)}">${w.done ? "✓" : ""}</div>
             <div class="body"><div class="t ${w.done ? "done" : ""}">${esc(w.text)}</div><div class="sub">${esc(w.date || "未设日期")}</div></div>
             <div class="actions"><button class="mini" data-edit-work="${esc(w.id)}">✏️ 编辑</button><button class="mini del" data-del-work="${esc(w.id)}">🗑 删除</button></div>
           </div>`
      )).join("")}
      </div>
      <div class="card"><h3>➕ 记一笔工作</h3>
        <div class="add-bar"><input id="wText" placeholder="工作事项" /><input id="wDate" type="date" /></div>
        <button class="btn soft" id="wAdd">➕ 添加</button>
      </div>`;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindPage() {
    // 选题卡片点击 → 写文案
    $$("[data-topic]").forEach((el) => el.addEventListener("click", () => {
      pendingTopicId = el.getAttribute("data-topic");
      location.hash = "#write";
    }));

    // 顶部菜单跳转
    $$("[data-page]").forEach((el) => el.addEventListener("click", (e) => {
      e.preventDefault();
      location.hash = "#" + el.getAttribute("data-page");
    }));

    if (currentPage === "topics") {
      $$("[data-f]").forEach((b) => b.addEventListener("click", () => { topicFilter = b.getAttribute("data-f"); render(); }));
      $$("[data-edit-topic]").forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        ctEditId = b.getAttribute("data-edit-topic"); render();
      }));
      $$("[data-del-custom]").forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.getAttribute("data-del-custom");
        customTopics = customTopics.filter((x) => x.id !== id);
        save(KEYS.customTopics, customTopics); render(); toast("已删除该选题 🗑");
      }));
      bindCustomTopic();
    }
    if (currentPage === "home") bindHome();
    if (currentPage === "write") bindWrite();
    if (currentPage === "shoot") bindShoot();
    if (currentPage === "publish") bindPublish();
    if (currentPage === "money") bindMoney();
    if (currentPage === "kids") bindKids();
    if (currentPage === "dairen") bindDairen();
    if (currentPage === "work") bindWork();
  }

  function bindWrite() {
    const sel = $("#topicSel"), title = $("#titleInput"), area = $("#copyArea"), seg = $("#typeSeg");
    let curType = "痛点";
    seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active"); curType = b.getAttribute("data-t");
    }));
    sel.addEventListener("change", () => {
      const t = findTopic(sel.value);
      if (t) { title.value = t.title; area.value = generateCopy(t); }
    });
    $("#tplBtn").addEventListener("click", () => {
      const t = findTopic(sel.value);
      area.value = t ? generateCopy(t) : customTemplate(curType, title.value);
    });
    $("#regenBtn").addEventListener("click", () => {
      const t = findTopic(sel.value);
      area.value = t ? generateCopy(t) : customTemplate(curType, title.value);
      toast("已重新生成 ✅");
    });
    $("#genBtn").addEventListener("click", () => {
      const t = findTopic(sel.value);
      area.value = t ? generateCopy(t) : customTemplate(curType, title.value);
      toast("文案已生成，可直接改 ✍️");
    });
    $("#saveDraftBtn").addEventListener("click", () => {
      if (!area.value.trim()) { toast("先写点内容再存～"); return; }
      if (draftEditId) {
        const d = drafts.find((x) => x.id === draftEditId);
        if (d) { d.title = title.value || "未命名文案"; d.content = area.value; d.updated = todayKey(); }
        draftEditId = null; save(KEYS.drafts, drafts); render(); toast("草稿已更新 ✅");
      } else {
        drafts.unshift({ id: uid(), title: title.value || "未命名文案", content: area.value, updated: todayKey() });
        save(KEYS.drafts, drafts); render(); toast("已存为草稿 💾");
      }
    });
    $("#copyBtn").addEventListener("click", () => { copyText(area.value); toast("已复制 📋"); });
    $("#txtBtn").addEventListener("click", () => download((title.value || "文案") + ".txt", area.value, "text/plain"));
    $("#mdBtn").addEventListener("click", () => download((title.value || "文案") + ".md", "# " + (title.value || "文案") + "\n\n" + area.value, "text/markdown"));
    $$("[data-edit-draft]").forEach((b) => b.addEventListener("click", () => {
      const d = drafts.find((x) => x.id === b.getAttribute("data-edit-draft"));
      if (d) { draftEditId = d.id; $("#topicSel").value = ""; title.value = d.title; area.value = d.content; toast("已载入编辑器，改完点「存为草稿」即更新 ✍️"); }
    }));
    $$("[data-del-draft]").forEach((b) => b.addEventListener("click", () => {
      drafts = drafts.filter((d) => d.id !== b.getAttribute("data-del-draft"));
      if (draftEditId && draftEditId === b.getAttribute("data-del-draft")) draftEditId = null;
      save(KEYS.drafts, drafts); render(); toast("草稿已删");
    }));
  }

  function bindShoot() {
    $$("[data-shoot]").forEach((el) => el.addEventListener("click", () => {
      const i = +el.getAttribute("data-shoot"); shoot[i].done = !shoot[i].done; save(KEYS.shoot, shoot); render();
    }));
    $$("[data-edit-shoot]").forEach((b) => b.addEventListener("click", () => {
      shootEditIdx = +b.getAttribute("data-edit-shoot"); render();
    }));
    $$("[data-del-shoot]").forEach((el) => el.addEventListener("click", () => {
      shootEditIdx = null; shoot.splice(+el.getAttribute("data-del-shoot"), 1); save(KEYS.shoot, shoot); render();
    }));
    $("#shootAdd").addEventListener("click", () => {
      const v = $("#shootInput").value.trim(); if (!v) return;
      shoot.push({ text: v, done: false }); save(KEYS.shoot, shoot); render();
    });
    $("#shootReset").addEventListener("click", () => { shoot = SEED.shootDefault.slice(); save(KEYS.shoot, shoot); render(); toast("已恢复默认清单 ↺"); });
    if (shootEditIdx !== null) {
      const inp = $("#shootEditInput");
      const idx = shootEditIdx;
      $("#shootSave").addEventListener("click", () => {
        const v = inp.value.trim(); if (!v) { toast("内容不能为空～"); return; }
        if (shoot[idx]) shoot[idx] = { text: v, done: shoot[idx].done };
        save(KEYS.shoot, shoot); shootEditIdx = null; render(); toast("已保存 ✅");
      });
      $("#shootCancel").addEventListener("click", () => { shootEditIdx = null; render(); });
    }
  }

  function bindPublish() {
    $("#pAdd").addEventListener("click", () => {
      const rec = load("xt_publish", []);
      rec.unshift({ id: uid(), platform: $("#pPlatform").value, topic: $("#pTopic").value, date: $("#pDate").value, link: $("#pLink").value, note: $("#pNote").value });
      save("xt_publish", rec); render(); toast("已记录 📲");
    });
    $$("[data-edit-pub]").forEach((b) => b.addEventListener("click", () => {
      pubEditId = b.getAttribute("data-edit-pub"); render();
    }));
    $$("[data-del-pub]").forEach((b) => b.addEventListener("click", () => {
      let rec = load("xt_publish", []); rec = rec.filter((r) => r.id !== b.getAttribute("data-del-pub"));
      save("xt_publish", rec); render();
    }));
    if (pubEditId) {
      let rec = load("xt_publish", []);
      const idx = rec.findIndex((r) => r.id === pubEditId);
      if (idx >= 0) {
        $("#pRecSave").addEventListener("click", () => {
          const t = $("#pEditTopic").value.trim(); if (!t) { toast("话题不能为空～"); return; }
          rec[idx] = Object.assign({}, rec[idx], {
            platform: $("#pEditPlatform").value, topic: t,
            date: $("#pEditDate").value, link: $("#pEditLink").value, note: $("#pEditNote").value
          });
          save("xt_publish", rec); pubEditId = null; render(); toast("已保存 ✅");
        });
        $("#pRecCancel").addEventListener("click", () => { pubEditId = null; render(); });
      }
    }
  }

  function bindMoney() {
    $("#mAdd").addEventListener("click", () => {
      const title = $("#mTitle").value.trim(); if (!title) return;
      moneyCustom.unshift({ id: uid(), custom: true, title, how: $("#mHow").value, risk: $("#mRisk").value });
      save(KEYS.moneyCustom, moneyCustom); render(); toast("已添加搞钱项目 💰");
    });
    $$("[data-edit-money]").forEach((b) => b.addEventListener("click", () => {
      moneyEditId = b.getAttribute("data-edit-money"); render();
    }));
    $$("[data-del-money]").forEach((b) => b.addEventListener("click", () => {
      moneyCustom = moneyCustom.filter((x) => x.id !== b.getAttribute("data-del-money"));
      save(KEYS.moneyCustom, moneyCustom); render(); toast("已删除搞钱项目 🗑");
    }));
    if (moneyEditId) {
      const idx = moneyCustom.findIndex((x) => x.id === moneyEditId);
      if (idx >= 0) {
        $("#mSave").addEventListener("click", () => {
          const t = $("#mEditTitle").value.trim(); if (!t) { toast("名称不能为空～"); return; }
          moneyCustom[idx] = Object.assign({}, moneyCustom[idx], { title: t, how: $("#mEditHow").value, risk: $("#mEditRisk").value });
          save(KEYS.moneyCustom, moneyCustom); moneyEditId = null; render(); toast("已保存 ✅");
        });
        $("#mCancel").addEventListener("click", () => { moneyEditId = null; render(); });
      }
    }
  }

  function bindCustomTopic() {
    const ageSeg = $("#ctAgeSeg"), typeSeg = $("#ctTypeSeg"), dyn = $("#ctDynamic");
    // 编辑态：先把要改的话题取出来，决定 ctAge/ctType（影响动态表单渲染）
    let editing = null;
    if (ctEditId) { editing = customTopics.find((x) => x.id === ctEditId); if (editing) { ctAge = editing.age; ctType = editing.type; } }
    ageSeg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      ageSeg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active"); ctAge = b.getAttribute("data-age");
    }));
    typeSeg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      typeSeg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active"); ctType = b.getAttribute("data-type");
      dyn.innerHTML = renderCtDynamic(); bindCtDynamic();
    }));
    dyn.innerHTML = renderCtDynamic();
    bindCtDynamic();
    // 编辑态填充
    if (editing) {
      $("#ctTitle").value = editing.title || "";
      $$("#ctAgeSeg button").forEach((b) => b.classList.toggle("active", b.getAttribute("data-age") === editing.age));
      $$("#ctTypeSeg button").forEach((b) => b.classList.toggle("active", b.getAttribute("data-type") === editing.type));
      $("#ctDesc").value = editing.desc || "";
      if (editing.type === "痛点") {
        $("#ctPain").value = editing.pain || ""; $("#ctExp").value = editing.exp || ""; $("#ctView").value = editing.view || "";
        $("#ctProd").value = editing.product ? editing.product.name : ""; $("#ctProdReason").value = editing.product ? editing.product.reason : "";
        $("#ctConcl").value = editing.conclusion || ""; $("#ctQuest").value = editing.question || "";
      } else {
        $("#ctIntro").value = editing.intro || "";
        const rows = (editing.type === "步骤" ? editing.steps : editing.points) || [];
        ctRows = rows.map((r) => ({ t: r.t || "", action: r.action || "", remind: r.remind || "" }));
        const c = document.querySelector("#ctRows"); if (c) c.innerHTML = ctRows.map(ctRowHtml).join(""); bindCtRows();
        $("#ctConcl").value = editing.conclusion || ""; $("#ctQuest").value = editing.question || "";
      }
      $("#ctAdd").textContent = "💾 保存修改";
    } else {
      $("#ctAdd").textContent = "📥 入库";
    }
    $("#ctAdd").addEventListener("click", () => {
      const wasEdit = !!ctEditId;
      const title = $("#ctTitle").value.trim();
      if (!title) { toast("先填话题标题～"); return; }
      const topic = { age: ctAge, type: ctType, tag: "我的选题", title, desc: $("#ctDesc").value || "" };
      if (ctType === "痛点") {
        topic.pain = $("#ctPain").value; topic.exp = $("#ctExp").value; topic.view = $("#ctView").value;
        topic.conclusion = $("#ctConcl").value; topic.question = $("#ctQuest").value;
        const p = $("#ctProd").value.trim();
        if (p) topic.product = { name: p, reason: $("#ctProdReason").value };
      } else {
        topic.intro = $("#ctIntro").value; topic.conclusion = $("#ctConcl").value; topic.question = $("#ctQuest").value;
        const rows = ctRows.map((r) => ({ t: r.t, action: r.action, remind: r.remind })).filter((x) => x.t || x.action || x.remind);
        if (ctType === "步骤") topic.steps = rows; else topic.points = rows;
      }
      if (wasEdit) {
        const idx = customTopics.findIndex((x) => x.id === ctEditId);
        if (idx >= 0) customTopics[idx] = Object.assign({}, customTopics[idx], topic, { id: ctEditId, custom: true });
        ctEditId = null;
      } else {
        topic.id = uid(); topic.custom = true;
        customTopics.unshift(topic);
      }
      save(KEYS.customTopics, customTopics);
      ctAge = "1岁"; ctType = "痛点"; ctRows = [];
      render();
      toast(wasEdit ? "已保存修改 ✅" : "已入库 📥 点它就能生成文案");
    });
  }

  function bindHome() {
    const saveBtn = $("#hotSave");
    if (saveBtn) saveBtn.addEventListener("click", () => {
      let v = ($("#hotUrlInput").value || "").trim();
      if (v && !/^https?:\/\//.test(v)) v = "https://" + v;
      hotUrl = v; save(KEYS.hotUrl, hotUrl);
      toast("已保存数据源，正在拉取…");
      fetchHotTopics(true);
    });
  }
  function bindCtDynamic() {
    const addRow = $("#ctAddRow");
    if (addRow) addRow.addEventListener("click", () => {
      ctRows.push({ t: "", action: "", remind: "" });
      const c = document.querySelector("#ctRows");
      if (c) c.innerHTML = ctRows.map(ctRowHtml).join("");
      bindCtRows();
    });
    bindCtRows();
  }
  function bindCtRows() {
    $$(".ct-rt").forEach((el) => el.addEventListener("input", () => { ctRows[+el.dataset.i].t = el.value; }));
    $$(".ct-ra").forEach((el) => el.addEventListener("input", () => { ctRows[+el.dataset.i].action = el.value; }));
    $$(".ct-rr").forEach((el) => el.addEventListener("input", () => { ctRows[+el.dataset.i].remind = el.value; }));
    $$(".ct-del").forEach((b) => b.addEventListener("click", () => {
      ctRows.splice(+b.getAttribute("data-delrow"), 1);
      const c = document.querySelector("#ctRows");
      if (c) c.innerHTML = ctRows.map(ctRowHtml).join("");
      bindCtRows();
    }));
  }

  function bindKids() {
    $$("[data-kid]").forEach((el) => el.addEventListener("click", () => {
      const id = el.getAttribute("data-kid"); const k = kids.find((x) => x.id === id); if (k) { k.done = !k.done; save(KEYS.kids, kids); render(); }
    }));
    $$("[data-edit-kid]").forEach((b) => b.addEventListener("click", () => {
      kidEditId = b.getAttribute("data-edit-kid"); render();
    }));
    $$("[data-del-kid]").forEach((b) => b.addEventListener("click", () => {
      kids = kids.filter((k) => k.id !== b.getAttribute("data-del-kid")); save(KEYS.kids, kids); render();
    }));
    if (kidEditId) {
      const k = kids.find((x) => x.id === kidEditId);
      if (k) {
        $("#kidSave").addEventListener("click", () => {
          const v = $("#kidEditText").value.trim(); if (!v) { toast("内容不能为空～"); return; }
          k.text = v; k.date = $("#kidEditDate").value; save(KEYS.kids, kids); kidEditId = null; render(); toast("已保存 ✅");
        });
        $("#kidCancel").addEventListener("click", () => { kidEditId = null; render(); });
      }
    }
    const addBtn = $("#kidAdd");
    if (addBtn) addBtn.addEventListener("click", () => {
      const kid = $("#kidSel").value; const text = $("#kidText").value.trim(); if (!text) return;
      kids.unshift({ id: uid(), kid, text, date: $("#kidDate").value, done: false }); save(KEYS.kids, kids); render();
    });
  }

  function bindDairen() {
    $$("[data-edit-prod]").forEach((b) => b.addEventListener("click", () => {
      prodEditIdx = +b.getAttribute("data-edit-prod"); render();
    }));
    $$("[data-del-prod]").forEach((b) => b.addEventListener("click", () => {
      prodEditIdx = null; products.splice(+b.getAttribute("data-del-prod"), 1); save(KEYS.products, products); render();
    }));
    if (prodEditIdx !== null) {
      const idx = prodEditIdx;
      $("#pSave").addEventListener("click", () => {
        const v = $("#pEditName").value.trim(); if (!v) { toast("商品名不能为空～"); return; }
        if (products[idx]) products[idx] = { name: v, platform: $("#pEditPlat").value, link: $("#pEditLink").value, note: $("#pEditNote").value };
        save(KEYS.products, products); prodEditIdx = null; render(); toast("已保存 ✅");
      });
      $("#pCancel").addEventListener("click", () => { prodEditIdx = null; render(); });
    }
    $("#prodAdd").addEventListener("click", () => {
      const name = $("#pName").value.trim(); if (!name) return;
      products.push({ name, platform: $("#pPlat").value, link: $("#pLink2").value, note: $("#pNote2").value });
      save(KEYS.products, products); render(); toast("已添加商品 🛒");
    });
  }

  function bindWork() {
    $$("[data-work]").forEach((el) => el.addEventListener("click", () => {
      const id = el.getAttribute("data-work"); const w = work.find((x) => x.id === id); if (w) { w.done = !w.done; save(KEYS.work, work); render(); }
    }));
    $$("[data-edit-work]").forEach((b) => b.addEventListener("click", () => {
      workEditId = b.getAttribute("data-edit-work"); render();
    }));
    $$("[data-del-work]").forEach((b) => b.addEventListener("click", () => {
      work = work.filter((w) => w.id !== b.getAttribute("data-del-work")); save(KEYS.work, work); render();
    }));
    if (workEditId) {
      const w = work.find((x) => x.id === workEditId);
      if (w) {
        $("#workSave").addEventListener("click", () => {
          const v = $("#workEditText").value.trim(); if (!v) { toast("内容不能为空～"); return; }
          w.text = v; w.date = $("#workEditDate").value; save(KEYS.work, work); workEditId = null; render(); toast("已保存 ✅");
        });
        $("#workCancel").addEventListener("click", () => { workEditId = null; render(); });
      }
    }
    $("#wAdd").addEventListener("click", () => {
      const text = $("#wText").value.trim(); if (!text) return;
      work.unshift({ id: uid(), text, date: $("#wDate").value, done: false }); save(KEYS.work, work); render(); toast("已添加工作备忘 📝");
    });
  }

  /* ---------------- 工具 ---------------- */
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function copyText(txt) {
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
    else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta);
  }
  function download(name, content, type) {
    const blob = new Blob([content], { type: type + ";charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------------- 路由 / 启动 ---------------- */
  const TITLES = { home: "首页", topics: "选题", write: "写文案", shoot: "拍摄清单", publish: "发布记录", money: "搞钱灵感", kids: "熹哥潼妹备忘录", dairen: "带货", work: "工作备忘录" };
  function route() {
    const page = (location.hash || "#home").replace("#", "");
    currentPage = TITLES[page] ? page : "home";
    clearEdits();
    $$("#nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("data-page") === currentPage));
    $("#topTitle").textContent = TITLES[currentPage];
    render();
    closeSidebar();
  }
  function openSidebar() { $("#sidebar").classList.add("open"); $("#overlay").classList.add("show"); }
  function closeSidebar() { $("#sidebar").classList.remove("open"); $("#overlay").classList.remove("show"); }

  $("#hamburger").addEventListener("click", openSidebar);
  $("#overlay").addEventListener("click", closeSidebar);
  $("#refreshBtn").addEventListener("click", fetchHotTopics);
  window.addEventListener("hashchange", route);
  window.addEventListener("online", () => { setNet(true); fetchHotTopics(true); });
  window.addEventListener("offline", () => setNet(false));
  function setNet(on) { const el = $("#netStatus"); el.textContent = on ? "● 联网" : "● 离线"; el.className = "net " + (on ? "on" : "off"); }

  // 启动
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  setNet(navigator.onLine);
  route();
  // 首次进入或当天未更新：联网时静默补抓一次
  if (navigator.onLine && (!load(KEYS.lastUpdate, 0) || todayKey() !== new Date(load(KEYS.lastUpdate, 0)).toISOString().slice(0, 10))) {
    setTimeout(() => fetchHotTopics(true), 1500);
  }
})();
