/* Buddy Loop — UI. Renders the engine state into views and turns clicks into engine calls. */
(function () {
  'use strict';
  var E = window.BuddyEngine, AI = window.BuddyAI, SAMPLE = window.BUDDY_SAMPLE;
  var STORE = 'buddyloop.state.v2';
  var VIEWS = [
    { id: 'today', label: 'วันนี้' },
    { id: 'run', label: 'Run · ของเดิม' },
    { id: 'grow', label: 'Grow · ของใหม่' },
    { id: 'learn', label: 'Learn' },
    { id: 'rules', label: 'กติกา' },
    { id: 'playbook', label: 'Playbook' },
    { id: 'data', label: 'ข้อมูล & AI' },
    { id: 'guide', label: 'วิธีใช้' }
  ];
  var STAGES = [
    { id: 'sense', label: 'จับสัญญาณ' }, { id: 'ask', label: 'ถามลูกค้า' }, { id: 'make', label: 'ทำต้นแบบ' },
    { id: 'test', label: 'ทดสอบขาย' }, { id: 'done', label: 'ผ่าน & เปิดตัว' }, { id: 'killed', label: 'ตัดทิ้ง' }
  ];
  var MODE_LABEL = { auto: 'ทำเอง', pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' };
  var LANE_LABEL = { run: 'Run', grow: 'Grow', learn: 'Learn' };

  var S = load();
  var ui = { view: 'today', sku: null, concept: null, feed: 'all', ai: {}, confirmReset: false, showAdd: false };
  var timer = null;

  /* ---------- utils ---------- */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function baht(n) { return '฿' + Math.round(n || 0).toLocaleString('th-TH'); }
  function bahtK(n) { n = n || 0; if (Math.abs(n) >= 1e6) return '฿' + (n / 1e6).toFixed(2) + 'M'; if (Math.abs(n) >= 1e4) return '฿' + Math.round(n / 1e3) + 'k'; return baht(n); }
  function pct(n, d) { return (n * 100).toFixed(d == null ? 0 : d) + '%'; }
  function $(id) { return document.getElementById(id); }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 2200); }

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (raw) { var s = JSON.parse(raw); if (s && s.version === 2) { if (!s.playbook && SAMPLE.playbook) E.applyPlaybook(s, SAMPLE.playbook, { keepTrends: true }); return s; } }
    } catch (e) { /* fall through to a fresh demo */ }
    return fresh();
  }
  function fresh() {
    var s = E.createState(SAMPLE, { seed: 20261101 });
    E.runDays(s, 14); // open on a realistic working state: two weeks of history and a live inbox
    return s;
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage full or blocked: keep running in memory */ } }

  /* ---------- run controls ---------- */
  function run(n) {
    var before = S.log.length;
    E.runDays(S, n);
    save();
    var added = S.log.slice(before);
    var autos = added.filter(function (e) { return e.mode === 'auto'; }).length;
    var asks = added.filter(function (e) { return e.mode === 'pending'; }).length;
    render();
    toast('รัน ' + n + ' วัน · Buddy ทำเอง ' + autos + ' งาน' + (asks ? ' · รอคุณ ' + asks + ' เรื่อง' : ''));
  }
  function setAuto(on) {
    if (on && !timer) timer = setInterval(function () { E.runDay(S); save(); render(true); }, 1300);
    if (!on && timer) { clearInterval(timer); timer = null; save(); }
    $('autoplay').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('autoplay').textContent = on ? 'หยุด Autopilot' : 'Autopilot';
  }

  /* ---------- shell ---------- */
  function renderShell() {
    $('brandLine').textContent = (S.brand && S.brand.name ? S.brand.name + ' · ' : '') + 'by Bizbuddy';
    $('clockDate').textContent = E.fmtDate(S.day);
    var c = E.campaignOf(S.day), up = E.nextCampaign(S.day, 5);
    $('clockCamp').innerHTML = c ? '<span class="camp">วันนี้ ' + esc(c.name) + '</span>' : (up ? '<span class="camp">อีก ' + up.inDays + ' วัน ' + esc(up.c.name) + '</span>' : '');
    $('tabs').innerHTML = VIEWS.map(function (v) {
      var count = v.id === 'today' && S.pending.length ? '<span class="count">' + S.pending.length + '</span>' : '';
      return '<button class="tab" type="button" data-act="nav" data-view="' + v.id + '"' + (ui.view === v.id ? ' aria-current="page"' : '') + '>' + v.label + count + '</button>';
    }).join('');
  }

  function render(soft) {
    renderShell();
    var html = { today: vToday, run: vRun, grow: vGrow, learn: vLearn, rules: vRules, playbook: vPlaybook, data: vData, guide: vGuide }[ui.view]();
    var main = $('view');
    var keepScroll = soft ? window.scrollY : 0;
    main.innerHTML = html;
    if (soft) window.scrollTo(0, keepScroll);
    bindForms();
  }

  /* ---------- views ---------- */
  function kpiCard(v, l, s, hl) { return '<div class="kpi' + (hl ? ' hl' : '') + '"><span class="v">' + v + '</span><span class="l">' + l + '</span>' + (s ? '<span class="s">' + s + '</span>' : '') + '</div>'; }

  function vToday() {
    var k = E.kpis(S, 30);
    var html = '<div class="view-head"><div><span class="eyebrow">' + esc(S.brand.note || '') + '</span><h1>วันนี้ Buddy ทำอะไรไปแล้ว</h1><p>Buddy ดูแลสินค้าเดิมและสร้างสินค้าใหม่เองภายในกติกาที่คุณตั้งไว้ งานที่เกินกรอบเท่านั้นที่จะมารออยู่ใน Inbox ด้านล่าง</p></div></div>';
    html += '<div class="grid g-kpi">' +
      kpiCard(pct(k.automation, 1), 'Automation rate', k.autoCount.toLocaleString() + ' งานทำเอง · ' + k.humanCount + ' งานใช้คน', true) +
      kpiCard(bahtK(k.revenue), 'ยอดขาย ' + k.days + ' วันล่าสุด', 'ROAS รวม ' + k.roas.toFixed(1)) +
      kpiCard(pct(k.grossPct, 1), 'กำไรขั้นต้นหลังค่าธรรมเนียมและแอด', bahtK(k.gross)) +
      kpiCard(pct(k.newShare, 1), 'ยอดขายจาก SKU ที่เกิดใน loop', bahtK(k.newRevenue)) +
      kpiCard(bahtK(k.lostSales), 'ยอดที่เสียเพราะของหมด', k.stockouts + ' SKU-วัน') +
      kpiCard(bahtK(k.deadValue), 'มูลค่าสต็อกค้าง (เกิน ' + S.policy.clearance.bundle + ' วันขาย)', 'สต็อกทั้งหมด ' + bahtK(k.stockValue)) +
      '</div>';
    html += '<div class="grid g-2"><div class="grid" style="align-content:start">' + pInbox() + pFeed() + '</div><div class="grid" style="align-content:start">' + pLoop() + pRevenue() + pLaneSplit() + '</div></div>';
    return html;
  }

  function pInbox() {
    var items = S.pending.slice().sort(function (a, b) { return b.value - a.value; });
    var body = items.length ? items.map(function (p) {
      return '<div class="ask"><div><div class="tags"><span class="chip ' + p.lane + '">' + LANE_LABEL[p.lane] + ' · ' + esc(E.ENGINES[p.engine].th) + '</span><span class="chip">' + E.fmtDate(p.day) + '</span>' + (p.value ? '<span class="chip mono">' + baht(Math.abs(p.value)) + '</span>' : '') + '</div>' +
        '<h3>' + esc(p.title) + '</h3><p class="why">' + esc(p.detail) + '</p><p class="why"><b>ทำไมมาถึงคุณ:</b> ' + esc(p.reason) + '</p></div>' +
        '<div class="acts"><button class="btn good sm" type="button" data-act="approve" data-id="' + p.id + '">อนุมัติ</button><button class="btn sm" type="button" data-act="reject" data-id="' + p.id + '">ไม่อนุมัติ</button></div></div>';
    }).join('') : '<div class="empty">ไม่มีเรื่องรอคุณ Buddy จัดการทุกอย่างภายในกติกาแล้ว</div>';
    return '<section class="panel"><div class="panel-h"><h2>Inbox ข้อยกเว้น · ' + items.length + ' เรื่อง</h2>' + (items.length > 1 ? '<button class="btn sm" type="button" data-act="approveAll">อนุมัติทั้งหมด</button>' : '') + '</div><div class="inbox">' + body + '</div></section>';
  }

  function pFeed() {
    var since = S.day - 3;
    var items = S.log.filter(function (e) {
      if (e.day < since) return false;
      if (ui.feed === 'all') return true;
      if (ui.feed === 'human') return e.mode !== 'auto';
      return e.lane === ui.feed;
    }).slice(-120).reverse();
    var f = [['all', 'ทั้งหมด'], ['run', 'Run'], ['grow', 'Grow'], ['learn', 'Learn'], ['human', 'ที่ใช้คน']].map(function (x) {
      return '<button class="btn sm" type="button" data-act="feed" data-f="' + x[0] + '" aria-pressed="' + (ui.feed === x[0]) + '">' + x[1] + '</button>';
    }).join('');
    var body = items.length ? items.map(evRow).join('') : '<div class="empty">ยังไม่มีงานในช่วงนี้ กด "รัน 1 วัน" เพื่อให้ Buddy เริ่มทำงาน</div>';
    return '<section class="panel"><div class="panel-h"><h2>บันทึกการทำงาน 3 วันล่าสุด</h2><div class="filters">' + f + '</div></div><div class="feed">' + body + '</div></section>';
  }
  function evRow(e) {
    return '<div class="ev"><span class="d">' + E.fmtDate(e.day) + '</span><div class="t"><b>' + esc(e.action) + '</b>' + (e.detail ? '<span class="x">' + esc(e.detail) + '</span>' : '') +
      '<span class="meta"><span class="chip ' + e.lane + '">' + LANE_LABEL[e.lane] + ' · ' + esc(E.ENGINES[e.engine].th) + '</span><span class="chip ' + e.mode + '">' + MODE_LABEL[e.mode] + '</span></span></div></div>';
  }

  function stageCount(id) {
    return S.concepts.filter(function (c) { return id === 'done' ? (c.stage === 'scale' || c.stage === 'launched') : c.stage === id; }).length;
  }
  function pLoop() {
    var cells = STAGES.map(function (st) { return '<div class="st"><b>' + stageCount(st.id) + '</b><span>' + st.label + '</span></div>'; }).join('');
    var imp = S.concepts.filter(function (c) { return c.kind === 'improve' && c.stage !== 'killed'; }).length;
    return '<section class="panel"><div class="panel-h"><h2>Grow pipeline</h2><button class="btn sm ghost" type="button" data-act="nav" data-view="grow">เปิด Grow</button></div><div class="loop">' + cells + '</div>' +
      '<p class="note">' + imp + ' ไอเดียมาจากปัญหาของสินค้าเดิม (Run → Learn → Grow) และ ' + S.products.filter(function (p) { return p.isNew; }).length + ' SKU ใหม่ส่งกลับไปให้ Run ดูแลต่อแล้ว</p></section>';
  }

  function pRevenue() {
    var d = S.daily.slice(-30);
    if (!d.length) return '';
    var W = 600, H = 150, L = 50, B = 22, T = 8;
    var max = Math.max.apply(null, d.map(function (x) { return x.revenue; }));
    var step = niceStep(max / 3); var top = Math.ceil(max / step) * step || 1;
    var bw = (W - L - 6) / d.length;
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var bars = d.map(function (x, i) {
      var cx = L + i * bw + 1, w = Math.max(2, bw - 2);
      var camp = E.campaignOf(x.day);
      var core = x.revenue - x.newRevenue;
      return '<rect x="' + cx.toFixed(1) + '" y="' + y(core).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (y(0) - y(core)).toFixed(1) + '" fill="var(--run)" opacity="' + (camp ? 1 : 0.7) + '"><title>' + E.fmtDate(x.day) + ' · ' + baht(x.revenue) + '</title></rect>' +
        (x.newRevenue > 0 ? '<rect x="' + cx.toFixed(1) + '" y="' + y(x.revenue).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (y(core) - y(x.revenue)).toFixed(1) + '" fill="var(--grow)"/>' : '');
    }).join('');
    var ticks = [0, step, step * 2, step * 3].filter(function (v) { return v <= top; }).map(function (v) {
      return '<line x1="' + L + '" x2="' + W + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">' + bahtK(v) + '</text>';
    }).join('');
    var lab = '<text x="' + L + '" y="' + (H - 6) + '" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">' + E.fmtDate(d[0].day) + '</text><text x="' + W + '" y="' + (H - 6) + '" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">' + E.fmtDate(d[d.length - 1].day) + '</text>';
    return '<section class="panel"><div class="panel-h"><h2>ยอดขายรายวัน</h2><span class="small muted"><span style="color:var(--run)">■</span> สินค้าเดิม <span style="color:var(--grow)">■</span> SKU ใหม่จาก loop</span></div>' +
      '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="ยอดขายรายวัน 30 วันล่าสุด">' + ticks + bars + lab + '</svg><p class="note">แท่งเข้มคือวันแคมเปญ (11.11, 12.12, Payday)</p></section>';
  }
  function niceStep(x) { if (x <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(x))); var m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

  function pLaneSplit() {
    var since = S.day - 7, c = { run: 0, grow: 0, learn: 0 };
    var eng = {};
    S.log.forEach(function (e) { if (e.day >= since && e.mode === 'auto') { c[e.lane]++; eng[e.engine] = (eng[e.engine] || 0) + 1; } });
    var tot = c.run + c.grow + c.learn || 1;
    var rows = Object.keys(E.ENGINES).map(function (k) { return { k: k, n: eng[k] || 0 }; }).filter(function (r) { return r.n; }).sort(function (a, b) { return b.n - a.n; });
    var max = rows.length ? rows[0].n : 1;
    return '<section class="panel"><div class="panel-h"><h2>งานที่ Buddy ทำเอง 7 วัน</h2><span class="small muted">Run ' + pct(c.run / tot) + ' · Grow ' + pct(c.grow / tot) + ' · Learn ' + pct(c.learn / tot) + '</span></div><div class="themes">' +
      rows.map(function (r) { var en = E.ENGINES[r.k]; return '<div class="th-row pos"><span>' + esc(en.th) + ' <span class="muted small">' + en.name + '</span></span><span class="b"><i style="width:' + (r.n / max * 100).toFixed(0) + '%;background:var(--' + en.lane + ')"></i></span><span class="n">' + r.n + '</span></div>'; }).join('') + '</div></section>';
  }

  /* Run */
  function vRun() {
    var k = E.kpis(S, 30);
    var live = S.products.filter(function (p) { return !p.discontinued; });
    var html = '<div class="view-head"><div><span class="eyebrow">Run · บริการของเดิม</span><h1>สินค้าเดิม ' + live.length + ' SKU</h1><p>Buddy forecast รวม 3 marketplace, สั่งผลิต, ตั้งโปรก่อนแคมเปญ, ย้ายงบแอด, เคลียร์ของค้าง, ตอบรีวิวและแชททุกวัน คลิกแถวเพื่อดูว่าทำอะไรกับสินค้านั้นไปบ้าง</p></div></div>';
    html += '<div class="grid g-kpi">' + kpiCard(bahtK(k.stockValue), 'มูลค่าสต็อก') + kpiCard(bahtK(k.deadValue), 'สต็อกค้าง') + kpiCard(bahtK(k.ad), 'ค่าแอด 30 วัน', 'ROAS ' + k.roas.toFixed(1)) + kpiCard(String(k.stockouts), 'SKU-วันที่ของหมด (30 วัน)') + '</div>';
    var rows = live.map(function (p) {
      var cover = E.daysCover(p), st = E.productStatus(p, S.policy);
      var m = E.unitMargin(E.effectivePrice(p), p.cost);
      var adTot = Object.keys(p.ads).reduce(function (a, k2) { return a + p.ads[k2]; }, 0);
      var coverCls = cover < 7 ? 'bad' : cover > S.policy.clearance.bundle ? 'warn' : '';
      return '<tr tabindex="0" data-act="sku" data-sku="' + esc(p.sku) + '"' + (ui.sku === p.sku ? ' class="sel"' : '') + '>' +
        '<td><span class="nm">' + esc(p.name) + (p.isNew ? ' <span class="chip new">ใหม่</span>' : '') + '</span><span class="sk">' + esc(p.sku) + '</span></td>' +
        '<td><span class="chip ' + st.key + '">' + esc(st.label) + '</span></td>' +
        '<td class="r num">' + p.stock.toLocaleString() + '</td>' +
        '<td><div class="bar-cell"><span class="minibar ' + coverCls + '"><i style="width:' + Math.min(100, cover / 120 * 100).toFixed(0) + '%"></i></span><span class="num">' + (cover > 999 ? '999+' : Math.round(cover)) + ' วัน</span></div></td>' +
        '<td class="r num">' + (E.onOrderQty(p) ? E.onOrderQty(p).toLocaleString() : '–') + '</td>' +
        '<td class="r num">' + E.avgDaily(p).toFixed(1) + '</td>' +
        '<td class="r num">' + baht(E.effectivePrice(p)) + (p.promo ? ' <span class="chip promo">-' + Math.round(p.promo.discount * 100) + '%</span>' : '') + '</td>' +
        '<td class="r num">' + pct(m) + '</td>' +
        '<td class="r num">' + baht(adTot) + (p.adPaused ? ' <span class="chip low">หยุด</span>' : '') + '</td>' +
        '<td class="r num">' + p.rating.toFixed(2) + '</td></tr>';
    }).join('');
    if (!live.length) return html + '<div class="empty">ยังไม่มีสินค้า ไปที่แท็บ "ข้อมูล & AI" เพื่อนำเข้าสินค้าของแบรนด์เป็น CSV แล้วกด "รัน 1 วัน"</div>';
    html += '<div class="tbl"><table><thead><tr><th>สินค้า</th><th>สถานะ</th><th class="r">สต็อก</th><th>พอขาย</th><th class="r">กำลังมา</th><th class="r">ขาย/วัน</th><th class="r">ราคาขาย</th><th class="r">มาร์จิน</th><th class="r">แอด/วัน</th><th class="r">คะแนน</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    var p = ui.sku && E.findProduct(S, ui.sku);
    if (p) html += skuDetail(p);
    return html;
  }

  function skuDetail(p) {
    var base = p.name.split(' (สูตร')[0];
    var acts = S.log.filter(function (e) { return (e.action + ' ' + e.detail).indexOf(base) !== -1; }).slice(-14).reverse();
    var since = S.day - 30, themes = {};
    S.signals.forEach(function (g) { if (g.sku === p.sku && g.day >= since) themes[g.theme] = (themes[g.theme] || 0) + 1; });
    var tk = Object.keys(themes).sort(function (a, b) { return themes[b] - themes[a]; });
    var max = tk.length ? themes[tk[0]] : 1;
    var h = p.history.slice(-30), hm = Math.max.apply(null, h.concat([1]));
    var spark = '<svg viewBox="0 0 300 60" style="width:100%;height:60px" role="img" aria-label="ยอดขายรายวัน"><polyline fill="none" stroke="var(--run)" stroke-width="2" points="' + h.map(function (v, i) { return (i / Math.max(1, h.length - 1) * 300).toFixed(1) + ',' + (56 - v / hm * 50).toFixed(1); }).join(' ') + '"/></svg>';
    var orders = p.onOrder.length ? p.onOrder.map(function (o) { return o.qty.toLocaleString() + ' ชิ้น → ' + E.fmtDate(o.eta); }).join('<br>') : 'ไม่มี';
    var ads = Object.keys(p.ads).map(function (c) { return esc(c) + ' ' + baht(p.ads[c]) + ' (ROAS ' + p.roas[c].toFixed(1) + ')'; }).join('<br>');
    return '<section class="panel detail"><div class="panel-h"><h2>' + esc(p.name) + '</h2><button class="btn sm" type="button" data-act="sku" data-sku="">ปิด</button></div><div class="grid g-2e">' +
      '<div class="grid" style="align-content:start"><dl class="kv"><dt>ราคาปกติ / ทุน</dt><dd>' + baht(p.price) + ' / ' + baht(p.cost) + '</dd><dt>โปรตอนนี้</dt><dd>' + (p.promo ? esc(p.promo.label) + ' -' + Math.round(p.promo.discount * 100) + '% ถึง ' + E.fmtDate(p.promo.until) : 'ไม่มี') + '</dd>' +
      '<dt>Lead time / MOQ</dt><dd>' + p.leadTime + ' วัน / ' + p.moq.toLocaleString() + '</dd><dt>OEM</dt><dd>' + esc(p.oem || '-') + '</dd><dt>PO ที่กำลังมา</dt><dd>' + orders + '</dd><dt>งบแอดต่อวัน</dt><dd>' + ads + '</dd></dl>' +
      '<div><span class="eyebrow">ขายต่อวัน 30 วัน</span>' + spark + '</div>' +
      '<div class="themes"><span class="eyebrow">ลูกค้าพูดถึง (30 วัน)</span>' + (tk.length ? tk.map(function (t) { var neg = E.NEG_THEMES.indexOf(t) >= 0; return '<div class="th-row' + (neg ? '' : ' pos') + '"><span>' + esc(E.THEME_LABEL[t] || t) + '</span><span class="b"><i style="width:' + (themes[t] / max * 100).toFixed(0) + '%"></i></span><span class="n">' + themes[t] + '</span></div>'; }).join('') : '<span class="muted small">ยังไม่มีรีวิว</span>') + '</div></div>' +
      '<div><span class="eyebrow">สิ่งที่ Buddy ทำกับสินค้านี้</span><div class="feed" style="max-height:480px">' + (acts.length ? acts.map(evRow).join('') : '<div class="empty">ยังไม่มี</div>') + '</div></div></div></section>';
  }

  /* Grow */
  function vGrow() {
    var html = '<div class="view-head"><div><span class="eyebrow">Grow · สร้างของใหม่ และเวอร์ชันใหม่ของของเดิม</span><h1>Pipeline ไอเดีย</h1><p>ไอเดียมาจาก 3 ทาง: เทรนด์ที่ Sense จับได้, ปัญหาซ้ำในรีวิวสินค้าเดิม และไอเดียที่คุณเพิ่มเอง ทุกใบผ่านประตูเดียวกัน คือหลักฐาน → ลูกค้าจริง → เงินจริง</p></div><button class="btn primary" type="button" data-act="toggleAdd">' + (ui.showAdd ? 'ปิดฟอร์ม' : 'เพิ่มไอเดีย') + '</button></div>';
    if (ui.showAdd) html += addForm();
    html += '<div class="kanban">' + STAGES.map(function (st) {
      var cards = S.concepts.filter(function (c) { return st.id === 'done' ? (c.stage === 'scale' || c.stage === 'launched') : c.stage === st.id; });
      if (st.id === 'killed' || st.id === 'done') cards = cards.slice(-8).reverse();
      return '<div class="col' + (st.id === 'killed' ? ' killed' : '') + '"><div class="col-h"><b>' + st.label + '</b><span>' + cards.length + '</span></div>' + (cards.length ? cards.map(cCard).join('') : '<div class="empty small">ว่าง</div>') + '</div>';
    }).join('') + '</div>';
    var c = ui.concept && E.findConcept(S, ui.concept);
    if (c) html += cDetail(c);
    return html;
  }

  function cCard(c) {
    var r = S.policy.test, m = '';
    if (c.stage === 'sense') m = '<div class="m"><span>หลักฐาน</span><span>' + c.evidence + '/' + S.policy.senseMinEvidence + '</span></div><div class="prog"><i style="width:' + Math.min(100, c.evidence / S.policy.senseMinEvidence * 100) + '%"></i></div>';
    else if (c.stage === 'ask') m = '<div class="m"><span>สัมภาษณ์</span><span>' + (c.interviews || 0) + '/30</span></div><div class="prog"><i style="width:' + ((c.interviews || 0) / 30 * 100) + '%"></i></div>';
    else if (c.stage === 'make') m = '<div class="m"><span>' + esc(c.oem || 'กำลังหา OEM') + '</span><span>' + (c.budget ? baht(c.budget) : '') + '</span></div>' + (c.awaitingBudget ? '<span class="chip pending">รออนุมัติงบ</span>' : '');
    else if (c.stage === 'test') m = '<div class="m"><span>วัน ' + c.testDay + '/' + r.days + (c.iterated ? ' · รอบ 2' : '') + '</span><span>' + (c.rate || 0) + '%</span></div><div class="prog"><i style="width:' + (c.testDay / r.days * 100) + '%"></i></div><div class="m muted"><span>ตัด ≤' + r.kill + '%</span><span>ขยาย ≥' + r.scale + '%</span></div>';
    else if (c.stage === 'scale') m = '<span class="chip pending">ผ่าน ' + c.rate + '% · รอเจ้าของเปิดตัว</span>';
    else if (c.stage === 'launched') m = '<span class="chip approved">เปิดตัวแล้ว' + (c.rate ? ' · ' + c.rate + '%' : '') + '</span>';
    else if (c.stage === 'killed') { var last = c.history[c.history.length - 1]; m = '<span class="src">' + esc(last ? last.why : '') + '</span>'; }
    return '<div class="card' + (ui.concept === c.id ? ' sel' : '') + '" tabindex="0" data-act="concept" data-id="' + esc(c.id) + '"><span><span class="chip ' + c.kind + '">' + (c.kind === 'improve' ? 'ปรับของเดิม' : 'ของใหม่') + '</span></span><h4>' + esc(c.title) + '</h4><span class="src">' + esc(c.source) + '</span>' + m + '</div>';
  }

  function cDetail(c) {
    var tl = (c.history || []).map(function (h) { return '<div><b>' + E.fmtDate(h.day) + '</b>' + esc(h.why) + '</div>'; }).join('') || '<div class="muted">ยังไม่มีการเปลี่ยนขั้น</div>';
    var quotes = (c.quotes || []).map(function (q) { return '<p class="quote">“' + esc(q) + '”</p>'; }).join('');
    var out = ui.ai[c.id];
    return '<section class="panel detail"><div class="panel-h"><div><span class="chip ' + c.kind + '">' + (c.kind === 'improve' ? 'ปรับของเดิม · ' + esc(c.sku) : 'ของใหม่') + '</span><h2 style="margin-top:6px">' + esc(c.title) + '</h2></div><button class="btn sm" type="button" data-act="concept" data-id="">ปิด</button></div>' +
      '<div class="grid g-2e"><div class="grid" style="align-content:start"><dl class="kv"><dt>ที่มา</dt><dd style="font-family:var(--f-body)">' + esc(c.source) + '</dd><dt>หลักฐาน</dt><dd>' + (c.evidence || '-') + '</dd><dt>สัมภาษณ์จริง</dt><dd>' + (c.interviewScore != null ? c.interviewScore + ' (ลูกค้าจำลอง ' + c.syntheticRank + ')' : (c.interviews || 0) + '/30') + '</dd>' +
      '<dt>OEM</dt><dd style="font-family:var(--f-body)">' + esc(c.oem || '-') + (c.moq ? ' · MOQ ' + c.moq : '') + '</dd><dt>ทดสอบ</dt><dd>' + (c.visits ? c.visits.toLocaleString() + ' คน · ' + c.preorders + ' พรีออเดอร์ · ' + c.rate + '%' : '-') + '</dd><dt>งบที่ใช้</dt><dd>' + (c.spent ? baht(c.spent) + ' / ' + baht(c.budget) : '-') + '</dd></dl>' +
      (quotes ? '<div class="grid" style="gap:6px"><span class="eyebrow">เสียงลูกค้าจากการสัมภาษณ์</span>' + quotes + '</div>' : '') +
      benchLine(c) +
      '<div><span class="eyebrow">เส้นทาง</span><div class="timeline">' + tl + '</div></div></div>' +
      '<div class="grid" style="align-content:start"><div class="panel-h"><span class="eyebrow">ให้ Buddy เขียน</span><span class="small muted">' + (AI.configured() ? 'ใช้ Claude (' + esc(AI.config().model) + ')' : 'ยังไม่เชื่อม AI · ใช้เทมเพลต') + '</span></div>' +
      '<div class="filters"><button class="btn sm" type="button" data-act="write" data-kind="brief" data-id="' + esc(c.id) + '">Product brief</button><button class="btn sm" type="button" data-act="write" data-kind="interview" data-id="' + esc(c.id) + '">สคริปต์สัมภาษณ์ลูกค้า</button><button class="btn sm" type="button" data-act="write" data-kind="listing" data-id="' + esc(c.id) + '">หน้า listing พรีออเดอร์</button></div>' +
      (out ? '<div class="ai-out" aria-live="polite">' + esc(out) + '</div><div><button class="btn sm" type="button" data-act="copy" data-id="' + esc(c.id) + '">คัดลอก</button></div>' : '<p class="note">เลือกเอกสารที่ต้องการ Buddy จะร่างจากข้อมูลของไอเดียนี้</p>') + '</div></div></section>';
  }

  function addForm() {
    var opts = S.products.map(function (p) { return '<option value="' + esc(p.sku) + '">' + esc(p.name) + '</option>'; }).join('');
    return '<section class="panel"><h2>เพิ่มไอเดียเข้า loop</h2><form id="addIdea" class="form">' +
      '<div class="field"><label for="ai-title">ชื่อไอเดีย</label><input type="text" id="ai-title" required placeholder="เช่น บริการตรวจผิวฟรีผ่าน LINE"></div>' +
      '<div class="field"><label for="ai-kind">ประเภท</label><select id="ai-kind"><option value="new">ของใหม่ (สินค้า/บริการ/ระบบ)</option><option value="improve">ปรับของเดิม</option></select></div>' +
      '<div class="field"><label for="ai-sku">สินค้าเดิมที่เกี่ยวข้อง</label><select id="ai-sku"><option value="">ไม่มี</option>' + opts + '</select></div>' +
      '<div class="field"><label for="ai-src">ที่มา/หลักฐาน</label><input type="text" id="ai-src" placeholder="เช่น ลูกค้าถามในแชท 20 ครั้ง/เดือน"></div>' +
      '<div class="field"><label for="ai-price">ราคาขายตั้งต้น (฿)</label><input type="number" id="ai-price" min="1" value="390"></div>' +
      '<div class="field"><label for="ai-cost">ต้นทุนต่อชิ้น (฿)</label><input type="number" id="ai-cost" min="0" value="95"></div>' +
      '<div class="field" style="justify-content:flex-end"><button class="btn primary" type="submit">ส่งเข้า Sense</button></div></form>' +
      '<p class="note">ไอเดียจากคนได้คะแนนหลักฐานเริ่มต้น 60 แล้วต้องผ่านการสัมภาษณ์ลูกค้าจริงและการทดสอบด้วยเงินจริงเหมือนไอเดียอื่น ในเดโม ความชอบของตลาดจะถูกสุ่มขึ้นมา</p></section>';
  }

  /* Learn */
  function vLearn() {
    var since = S.day - 30, themes = {}, bySku = {};
    S.signals.forEach(function (g) { if (g.day >= since) { themes[g.theme] = (themes[g.theme] || 0) + 1; if (E.NEG_THEMES.indexOf(g.theme) >= 0 && g.sku) bySku[g.sku] = (bySku[g.sku] || 0) + 1; } });
    var keys = Object.keys(themes).sort(function (a, b) { return themes[b] - themes[a]; });
    var max = keys.length ? themes[keys[0]] : 1;
    var neg = keys.filter(function (k) { return E.NEG_THEMES.indexOf(k) >= 0; }), pos = keys.filter(function (k) { return E.NEG_THEMES.indexOf(k) < 0; });
    function rows(list, cls) { var mx = list.length ? themes[list[0]] : 1; return list.map(function (t) { return '<div class="th-row ' + cls + '"><span>' + esc(E.THEME_LABEL[t] || t) + '</span><span class="b"><i style="width:' + (themes[t] / mx * 100).toFixed(0) + '%"></i></span><span class="n">' + themes[t] + '</span></div>'; }).join('') || '<span class="muted small">ยังไม่มี</span>'; }
    var skuRows = Object.keys(bySku).sort(function (a, b) { return bySku[b] - bySku[a]; }).slice(0, 5).map(function (sku) { var p = E.findProduct(S, sku); return '<div class="th-row"><span>' + esc(p ? p.name : sku) + '</span><span class="b"><i style="width:' + (bySku[sku] / (bySku[Object.keys(bySku).sort(function (a, b) { return bySku[b] - bySku[a]; })[0]]) * 100).toFixed(0) + '%"></i></span><span class="n">' + bySku[sku] + '</span></div>'; }).join('');
    var ledger = S.ledger.slice(-40).reverse().map(function (l) {
      var chip = l.kind === 'week' ? '<span class="chip learn">สัปดาห์</span>' : '<span class="chip ' + l.kind + '">' + (l.kind === 'improve' ? 'ปรับของเดิม' : 'ของใหม่') + '</span> <span class="chip ' + (l.outcome === 'launched' ? 'approved' : 'rejected') + '">' + (l.outcome === 'launched' ? 'เปิดตัว' : 'ตัดทิ้ง') + '</span>';
      return '<div class="lesson"><span class="d">' + E.fmtDate(l.day) + '</span><div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:2px">' + chip + '</div><b>' + esc(l.title) + '</b><p class="muted small">' + esc(l.text) + '</p></div></div>';
    }).join('') || '<div class="empty">ยังไม่มีบทเรียน รันระบบต่อเพื่อให้ Learn สรุป</div>';
    var sig = S.signals.slice(-30).reverse().map(function (g) {
      var p = g.sku && E.findProduct(S, g.sku);
      return '<div class="ev"><span class="d">' + E.fmtDate(g.day) + '</span><div class="t"><b>' + esc(g.text) + '</b><span class="x">' + esc(p ? p.name : 'ทั่วไป') + (g.rating ? ' · ' + g.rating + '★' : '') + ' · ' + esc(g.type) + '</span></div></div>';
    }).join('');
    var out = ui.ai.__learn;
    return '<div class="view-head"><div><span class="eyebrow">Learn · สมองกลาง</span><h1>สิ่งที่ลูกค้ากำลังบอก</h1><p>รีวิว การคืนสินค้า และแชท ถูกจัดกลุ่มทุกวัน ปัญหาที่ซ้ำ 3 ครั้งใน 14 วันจะกลายเป็นไอเดีย "ปรับของเดิม" ใน Grow โดยอัตโนมัติ ส่วนผลทดสอบทุกครั้งถูกเก็บเป็นบทเรียนของหมวดนี้</p></div><button class="btn primary" type="button" data-act="write" data-kind="learn" data-id="__learn">สรุปรอบถัดไปให้ strategist</button></div>' +
      (out ? '<section class="panel"><h2>ร่างสรุปสำหรับ Loop Review</h2><div class="ai-out">' + esc(out) + '</div><div><button class="btn sm" type="button" data-act="copy" data-id="__learn">คัดลอก</button></div></section>' : '') +
      '<div class="grid g-2e"><section class="panel"><h2>ปัญหาที่ลูกค้าพูดถึง (30 วัน)</h2><div class="themes">' + rows(neg, '') + '</div><h2>สิ่งที่ลูกค้าชม</h2><div class="themes">' + rows(pos, 'pos') + '</div><h2>สินค้าที่มีปัญหามากสุด</h2><div class="themes">' + (skuRows || '<span class="muted small">ยังไม่มี</span>') + '</div></section>' +
      '<section class="panel"><h2>Learn ledger</h2><div class="ledger feed" style="max-height:620px">' + ledger + '</div></section></div>' +
      '<section class="panel"><h2>สัญญาณล่าสุด</h2><div class="feed" style="max-height:360px">' + sig + '</div></section>';
  }

  /* Rules */
  function num(id, label, val, hint, unit, step) {
    return '<div class="field"><label for="' + id + '">' + label + (unit ? ' (' + unit + ')' : '') + '</label><input type="number" id="' + id + '" data-rule="' + id + '" value="' + val + '" step="' + (step || 1) + '">' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }
  function vRules() {
    var P = S.policy;
    var html = '<div class="view-head"><div><span class="eyebrow">กติกา · strategist ตั้งครั้งเดียวต่อรอบ 90 วัน</span><h1>กรอบที่ Buddy ทำงานได้เอง</h1><p>ภายในกรอบนี้ Buddy ทำเองทั้งหมด ถ้าเกินกรอบจะส่งเข้า Inbox ทุกค่าที่เปลี่ยนมีผลกับวันถัดไปทันที</p></div>' +
      '<div class="filters"><button class="btn sm" type="button" data-act="preset" data-p="max">อัตโนมัติสูงสุด</button><button class="btn sm" type="button" data-act="preset" data-p="careful">ระมัดระวัง</button><button class="btn sm" type="button" data-act="preset" data-p="default">ค่าเริ่มต้น</button></div></div>';
    html += '<section class="panel"><h2>ระดับอัตโนมัติรายเครื่องยนต์</h2><div class="auton">' + Object.keys(P.autonomy).map(function (k) {
      var en = E.ENGINES[k];
      return '<div class="row"><span>' + esc(en.th) + '<small>' + LANE_LABEL[en.lane] + ' · ' + en.name + '</small></span><select id="au-' + k + '" data-auto="' + k + '" aria-label="ระดับของ ' + esc(en.th) + '">' +
        ['auto', 'approve', 'off'].map(function (m) { return '<option value="' + m + '"' + (P.autonomy[k] === m ? ' selected' : '') + '>' + { auto: 'ทำเอง', approve: 'ขออนุมัติ', off: 'ปิด' }[m] + '</option>'; }).join('') + '</select></div>';
    }).join('') + '</div></section>';
    html += '<section class="panel"><h2>Run · เงินและสต็อก</h2><div class="form">' +
      num('marginFloor', 'มาร์จินขั้นต่ำหลังลดราคา', Math.round(P.marginFloor * 100), 'Price & Promo จะไม่ลดราคาจนต่ำกว่านี้', '%') +
      num('maxDiscount', 'ส่วนลดสูงสุด', Math.round(P.maxDiscount * 100), 'ใช้กับทุกโปรรวมถึงการเคลียร์สต็อก', '%') +
      num('adDailyCap', 'งบแอดรวมต่อวัน', P.adDailyCap, 'ทุก SKU ทุกช่องทางรวมกัน', '฿', 100) +
      num('poApproveAbove', 'PO มูลค่าเกินนี้ต้องอนุมัติ', P.poApproveAbove, 'ต่ำกว่านี้ Buddy ส่ง PO ให้ OEM เอง', '฿', 1000) +
      num('safetyDays', 'สต็อกกันชน', P.safetyDays, 'เผื่อนอกเหนือจาก lead time', 'วัน') +
      num('refundAutoMax', 'คืนเงินอัตโนมัติไม่เกิน', P.refundAutoMax, '', '฿', 50) +
      num('clear-bundle', 'เริ่ม bundle เมื่อของพอขายเกิน', P.clearance.bundle, '', 'วัน') +
      num('clear-flash', 'flash sale เมื่อเกิน', P.clearance.flash, '', 'วัน') +
      num('clear-outlet', 'outlet / ของแถม เมื่อเกิน', P.clearance.outlet, '', 'วัน') + '</div></section>';
    html += '<section class="panel"><h2>Grow · ประตูตัดสิน</h2><div class="form">' +
      num('senseMinEvidence', 'คะแนนหลักฐานขั้นต่ำ', P.senseMinEvidence, 'ผ่านแล้วเริ่มสัมภาษณ์ลูกค้าเอง', '0–100') +
      num('askPassScore', 'คะแนนสัมภาษณ์ที่ผ่าน', P.askPassScore, 'จากลูกค้าจริง 30 คน', '0–100') +
      num('testBudgetCap', 'งบทดสอบต่อไอเดียไม่เกิน', P.testBudgetCap, 'เกินนี้ต้องอนุมัติ', '฿', 500) +
      num('test-days', 'ระยะทดสอบ', P.test.days, 'ตัดเร็วที่ครึ่งทางถ้าแย่มาก', 'วัน') +
      num('test-scale', 'ขยายเมื่อพรีออเดอร์ ≥', P.test.scale, '', '%', 0.1) +
      num('test-kill', 'ตัดเมื่อพรีออเดอร์ ≤', P.test.kill, '', '%', 0.1) + '</div></section>';
    return html;
  }


  /* Playbook */
  function benchLine(c) {
    var b = E.benchmarkOf(S);
    if (!b.tests || b.median == null) return '';
    var vs = c.rate != null ? (c.rate >= b.median ? 'สูงกว่า' : 'ต่ำกว่า') + 'ค่ากลางของหมวด' : '';
    return '<div class="warnbox" style="background:var(--cyan-soft)"><b>Benchmark หมวด ' + esc(S.playbook ? S.playbook.name : '') + ':</b> พรีออเดอร์ค่ากลาง ' + b.median + '% · ผ่าน ' + pct(b.passRate) + ' จาก ' + b.tests + ' การทดสอบ ใน ' + b.brands + ' แบรนด์ (ไม่ระบุชื่อ)' + (vs ? ' · ไอเดียนี้ ' + c.rate + '% ' + vs : '') + '</div>';
  }

  function vPlaybook() {
    var pb = S.playbook || { name: 'ยังไม่มี', category: '', version: '-' };
    var b = E.benchmarkOf(S);
    var sampleNote = S.playbook && S.playbook.benchmark && S.playbook.benchmark.sample ? ' (ค่าตั้งต้นเป็นตัวอย่าง)' : '';
    var steps = [
      ['เลือก playbook ของหมวด', !!S.playbook, 'ได้กติกา เกณฑ์ทดสอบ เครือข่าย OEM และรายการเทรนด์ของหมวดทันที'],
      ['นำเข้าสินค้า (CSV)', S.products.length > 0, 'แท็บ "ข้อมูล & AI" · ส่งออกจาก Shopee Seller Centre หรือ ZORT'],
      ['นำเข้ารีวิว (CSV)', S.signals.some(function (g) { return g.type === 'review'; }), 'Learn เริ่มจัดกลุ่มปัญหา และสร้างไอเดียปรับของเดิมได้ทันที'],
      ['รัน 7 วันในโหมดระมัดระวัง', S.day >= 7, 'Buddy ร่าง PO โปร งบทดสอบ และการเปิดตัวให้เจ้าของอนุมัติก่อน'],
      ['เปลี่ยนเป็นระดับอัตโนมัติของ playbook', S.day >= 7 && S.policy.autonomy.replenish === 'auto' && S.policy.autonomy.price === 'auto', 'ทำเองทุกอย่างในกรอบ ยกเว้นการเปิดตัว']
    ];
    var done = steps.filter(function (x) { return x[1]; }).length;
    var opts = '<option value="current">' + esc(pb.name) + ' v' + esc(pb.version) + ' (ที่ใช้อยู่ ' + 'รวมสิ่งที่เรียนรู้จากแบรนด์นี้)</option>' +
      (SAMPLE.playbooks || []).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + ' v' + esc(p.version) + ' (ตั้งต้น)</option>'; }).join('');
    return '<div class="view-head"><div><span class="eyebrow">Playbook · ทำซ้ำได้ ไม่ผูกลูกค้ารายเดียว</span><h1>ใช้ระบบเดียวกันกับแบรนด์ถัดไป</h1><p>Playbook คือสิ่งที่ส่งต่อจากแบรนด์หนึ่งไปอีกแบรนด์ในหมวดเดียวกัน ได้แก่ กติกา ประตูตัดสิน เครือข่าย OEM รายการเทรนด์ และ benchmark แบบไม่ระบุแบรนด์ ข้อมูลสินค้า รีวิว และยอดขายของแต่ละแบรนด์ไม่ถูกส่งต่อ</p></div></div>' +
      '<div class="grid g-2e"><section class="panel"><div class="panel-h"><h2>Playbook ที่ใช้อยู่</h2><span class="chip learn">v' + esc(pb.version) + '</span></div>' +
      '<dl class="kv"><dt>หมวด</dt><dd style="font-family:var(--f-body)">' + esc(pb.name) + '</dd><dt>กติกาและประตูตัดสิน</dt><dd>' + (Object.keys(S.policy).length + Object.keys(S.policy.autonomy).length) + ' ค่า</dd><dt>เครือข่าย OEM</dt><dd>' + S.oems.length + ' ราย</dd><dt>รายการเทรนด์</dt><dd>' + S.trends.length + ' รายการ</dd>' +
      '<dt>Benchmark</dt><dd>' + (b.median != null ? 'พรีออเดอร์ค่ากลาง ' + b.median + '% · ผ่าน ' + pct(b.passRate) : '-') + '</dd><dt>มาจาก</dt><dd>' + b.tests + ' การทดสอบ · ' + b.brands + ' แบรนด์' + sampleNote + '</dd><dt>จากแบรนด์นี้</dt><dd>' + b.ownTests + ' การทดสอบ</dd></dl>' +
      '<div class="filters"><button class="btn primary" type="button" data-act="exportPlaybook">ส่งออก playbook v' + esc(nextVer(pb.version)) + '</button></div>' +
      '<div class="field"><label for="pbFile">นำเข้า playbook (JSON) มาใช้กับแบรนด์นี้</label><input type="file" id="pbFile" accept=".json,application/json"></div>' +
      '<p class="note">ทุกครั้งที่ส่งออก ผลทดสอบของแบรนด์นี้จะถูกรวมเข้า benchmark แบบไม่ระบุชื่อ แบรนด์ถัดไปจึงเริ่มด้วยเกณฑ์ที่แม่นขึ้น</p></section>' +
      '<section class="panel"><div class="panel-h"><h2>Onboarding แบรนด์นี้</h2><span class="chip ' + (done === steps.length ? 'approved' : 'pending') + '">' + done + '/' + steps.length + '</span></div><ol class="steps">' +
      steps.map(function (x) { return '<li style="' + (x[1] ? 'opacity:.7' : '') + '"><div><b>' + (x[1] ? '✓ ' : '') + esc(x[0]) + '</b><span class="muted small">' + esc(x[2]) + '</span></div></li>'; }).join('') + '</ol>' +
      (S.day >= 7 && !steps[4][1] ? '<div><button class="btn good" type="button" data-act="graduate">เปลี่ยนเป็นระดับอัตโนมัติของ playbook</button></div>' : '') +
      '<p class="note">เป้าหมาย: onboard แบรนด์ใหม่ให้ครบภายใน 7 วัน ด้วย playbook เดิม ไม่ต้องตั้งระบบใหม่ทุกลูกค้า</p></section></div>' +
      '<section class="panel"><h2>เริ่มแบรนด์ใหม่ด้วย playbook</h2><form id="newBrand" class="form">' +
      '<div class="field"><label for="nb-name">ชื่อแบรนด์</label><input type="text" id="nb-name" required placeholder="เช่น Nara Beauty"></div>' +
      '<div class="field"><label for="nb-pb">Playbook</label><select id="nb-pb">' + opts + '</select></div>' +
      '<div class="field" style="justify-content:flex-end"><button class="btn primary" type="submit">' + (ui.confirmNew ? 'กดอีกครั้งเพื่อยืนยัน' : 'เริ่มแบรนด์ใหม่') + '</button></div></form>' +
      '<p class="note">ข้อมูลของแบรนด์ปัจจุบันจะถูกแทนที่ในเบราว์เซอร์นี้ ถ้าต้องการเก็บไว้ ให้กด "สำรองทั้งหมด (JSON)" ในแท็บข้อมูลก่อน แบรนด์ใหม่เริ่มในโหมดระมัดระวัง 7 วัน แล้วจึงเปลี่ยนเป็นอัตโนมัติ</p></section>';
  }
  function nextVer(v) { var p = String(v || '1.0').split('.'); return p[0] + '.' + ((parseInt(p[1], 10) || 0) + 1); }

  /* Data */
  var PRODUCT_TEMPLATE = 'sku,name,category,price,cost,stock,daily_sales,lead_time_days,moq,age_days,rating,oem\nMY-001,กันแดดสูตรน้ำ 50ml,กันแดด,390,95,1200,40,21,500,300,4.6,OEM A\nMY-002,เซรั่มวิตามินซี 30ml,เซรั่ม,590,140,300,25,30,300,200,4.4,OEM B';
  var REVIEW_TEMPLATE = 'sku,rating,text\nMY-001,5,เนื้อบางเบา ซึมไว\nMY-002,2,ใช้แล้วแสบหน้า\nMY-002,2,แสบมาก ผิวแดง\nMY-002,1,ระคายเคือง ต้องหยุดใช้';
  function vData() {
    var cfg = AI.config();
    return '<div class="view-head"><div><span class="eyebrow">ข้อมูล & AI</span><h1>ใช้ข้อมูลจริงของแบรนด์</h1><p>นำเข้าสินค้าและรีวิวเป็น CSV (ส่งออกจาก Shopee Seller Centre, ZORT หรือ Excel แล้วจัดคอลัมน์ตามตัวอย่าง) ข้อมูลทั้งหมดเก็บในเบราว์เซอร์ของคุณเท่านั้น</p></div></div>' +
      '<div class="grid g-2e"><section class="panel"><h2>1. สินค้า</h2><div class="field"><label for="prodFile">เลือกไฟล์ CSV</label><input type="file" id="prodFile" accept=".csv,text/csv"></div><div class="field"><label for="prodCsv">หรือวางข้อมูล</label><textarea id="prodCsv">' + esc(PRODUCT_TEMPLATE) + '</textarea><span class="hint">ต้องมี: sku, name, price, cost, stock, daily_sales · ไม่บังคับ: category, lead_time_days, moq, age_days, rating, oem, roas_shopee, roas_tiktok, roas_lazada, ad_shopee, ad_tiktok, ad_lazada</span></div>' +
      '<label class="small"><input type="checkbox" id="prodReplace"> ลบสินค้าตัวอย่างทั้งหมดก่อนนำเข้า</label><div><button class="btn primary" type="button" data-act="importProducts">นำเข้าสินค้า</button></div><p class="note" id="prodMsg"></p></section>' +
      '<section class="panel"><h2>2. รีวิว / แชท / การคืนสินค้า</h2><div class="field"><label for="revFile">เลือกไฟล์ CSV</label><input type="file" id="revFile" accept=".csv,text/csv"></div><div class="field"><label for="revCsv">หรือวางข้อมูล</label><textarea id="revCsv">' + esc(REVIEW_TEMPLATE) + '</textarea><span class="hint">คอลัมน์: sku, rating, text · Buddy จัดกลุ่มปัญหาจากคำในข้อความ ถ้าซ้ำ 3 ครั้งจะสร้างไอเดีย "ปรับของเดิม" ทันที</span></div>' +
      '<div><button class="btn primary" type="button" data-act="importReviews">นำเข้ารีวิว</button></div><p class="note" id="revMsg"></p></section></div>' +
      '<div class="grid g-2e"><section class="panel"><h2>3. เชื่อม Claude (ไม่บังคับ)</h2><p class="note">ถ้าใส่ API key Buddy จะใช้ Claude เขียน product brief, สคริปต์สัมภาษณ์, หน้า listing และสรุป Loop Review ถ้าไม่ใส่ จะใช้เทมเพลตในตัว</p>' +
      '<div class="field"><label for="aiKey">Anthropic API key</label><input type="password" id="aiKey" autocomplete="off" placeholder="' + (cfg.hasKey ? 'ตั้งค่าแล้ว · ใส่ใหม่เพื่อเปลี่ยน' : 'sk-ant-...') + '"></div>' +
      '<div class="field"><label for="aiModel">โมเดล</label><input type="text" id="aiModel" value="' + esc(cfg.model) + '"><span class="hint">ค่าเริ่มต้น claude-sonnet-5-5 · ถ้าอยากได้เร็วและถูกลองใช้ claude-haiku-5-5</span></div>' +
      '<label class="small"><input type="checkbox" id="aiRemember"' + (cfg.remember ? ' checked' : '') + '> จำ key ไว้ในเบราว์เซอร์นี้</label>' +
      '<div class="filters"><button class="btn primary" type="button" data-act="aiSave">บันทึก</button><button class="btn" type="button" data-act="aiTest">ทดสอบการเชื่อมต่อ</button><button class="btn" type="button" data-act="aiClear">ลบ key</button></div><p class="note" id="aiMsg"></p>' +
      '<div class="warnbox">key ที่ใช้ในเบราว์เซอร์ คนที่ใช้เครื่องนี้มองเห็นได้ ใช้ key ส่วนตัวที่ตั้งวงเงินต่ำสำหรับเดโม และอย่าใส่ key ลงในโค้ดที่ขึ้น GitHub สำหรับใช้งานจริงให้เรียก Claude ผ่าน backend ของคุณ</div></section>' +
      '<section class="panel"><h2>4. สำรอง / ส่งออก / เริ่มใหม่</h2><div class="filters"><button class="btn" type="button" data-act="exportLog">ส่งออกบันทึกงาน (CSV)</button><button class="btn" type="button" data-act="exportState">สำรองทั้งหมด (JSON)</button></div>' +
      '<div class="field"><label for="stateFile">กู้คืนจากไฟล์ JSON</label><input type="file" id="stateFile" accept=".json,application/json"></div>' +
      '<div><button class="btn" type="button" data-act="reset">' + (ui.confirmReset ? 'กดอีกครั้งเพื่อยืนยันการล้าง' : 'เริ่มเดโมใหม่ (ล้างข้อมูลทั้งหมด)') + '</button></div>' +
      '<p class="note">ไฟล์ตัวอย่างอยู่ในโฟลเดอร์ <span class="mono">data/</span> ของ repo: products-template.csv และ reviews-template.csv</p></section></div>';
  }

  /* Guide */
  function vGuide() {
    var steps = [
      ['เปิดแท็บ "วันนี้"', 'ดู Automation rate, ยอดขาย และ Inbox ข้อยกเว้น ระบบเปิดมาพร้อมข้อมูลจำลอง 14 วันของแบรนด์ตัวอย่าง Mira Skin'],
      ['กด "รัน 1 วัน"', 'Buddy จำลองตลาด 1 วัน แล้วให้ทุกเครื่องยนต์ทำงาน ดูบันทึกการทำงานว่าทำอะไรไปเองบ้าง และอะไรมารอคุณ'],
      ['เคลียร์ Inbox', 'อนุมัติหรือไม่อนุมัติ PO ใหญ่ งบทดสอบ การคืนเงิน และการเปิดตัวสินค้า แต่ละเรื่องบอกเหตุผลว่าทำไมต้องใช้คน'],
      ['ดู Run · ของเดิม', 'คลิกสินค้าเพื่อดู PO ที่กำลังมา งบแอด และสิ่งที่ Buddy ทำ เช่น หยุดแอดเมื่อของใกล้หมด หรือเคลียร์สต็อกค้าง'],
      ['ดู Grow · ของใหม่', 'ไอเดียเดินจากจับสัญญาณ → ถามลูกค้า → ทำต้นแบบ → ทดสอบ → เปิดตัว คลิกการ์ดแล้วกด "Product brief" ให้ Buddy เขียนเอกสาร'],
      ['ดู Learn', 'ปัญหาซ้ำในรีวิวสินค้าเดิมจะกลายเป็นไอเดีย "ปรับของเดิม" ใน Grow เอง กด "สรุปรอบถัดไป" เพื่อเตรียม Loop Review'],
      ['ลองเปลี่ยนกติกา', 'ปรับมาร์จินขั้นต่ำ หรือเปลี่ยน Launch เป็น "ทำเอง" แล้วรัน 30 วัน ดูว่า Automation rate และผลลัพธ์เปลี่ยนไปอย่างไร'],
      ['ทำซ้ำกับแบรนด์ถัดไป', 'แท็บ Playbook ส่งออก playbook ของหมวด แล้วเริ่มแบรนด์ใหม่ด้วย playbook เดิม ระบบพร้อมใช้ภายใน 7 วันโดยไม่ต้องตั้งใหม่'],
      ['ใส่ข้อมูลจริง', 'แท็บ "ข้อมูล & AI" นำเข้าสินค้าและรีวิวของแบรนด์เป็น CSV แล้วรันต่อ ใส่ Claude API key ได้ถ้าต้องการให้ AI เขียนเอกสารจริง']
    ];
    return '<div class="view-head"><div><span class="eyebrow">วิธีใช้</span><h1>เดโม Buddy Loop ใน 9 ขั้น</h1><p>คู่มือฉบับเต็ม สคริปต์เดโมสำหรับลูกค้า และวิธีขึ้น GitHub Pages อยู่ใน README.md และ docs/DEMO-SCRIPT.md ของ repo</p></div></div>' +
      '<section class="panel"><ol class="steps">' + steps.map(function (s) { return '<li><div><b>' + s[0] + '</b><span class="muted">' + s[1] + '</span></div></li>'; }).join('') + '</ol></section>' +
      '<section class="panel"><h2>Buddy คิดอย่างไร</h2><div class="grid g-2e"><div><h3 style="color:var(--run)">Run · ของเดิม</h3><p class="note">เติมสต็อกจาก forecast รวมแคมเปญ · ตั้งโปรก่อน mega sale 3 วันโดยไม่ต่ำกว่ามาร์จินขั้นต่ำ · หยุดแอดเมื่อของเหลือไม่ถึง 7 วัน · ย้ายงบไปช่องที่ ROAS สูงทุกสัปดาห์ · เคลียร์ของค้างตาม 60/90/120 วัน · ตอบรีวิวและแชททุกวัน</p></div>' +
      '<div><h3 style="color:var(--grow)">Grow · ของใหม่</h3><p class="note">เทรนด์และปัญหาจากรีวิวกลายเป็นการ์ด · สัมภาษณ์ลูกค้าจริง 30 คน · จับคู่ OEM ล็อตเล็ก · เปิดพรีออเดอร์ 14 วัน ตัดเร็วที่วันที่ 7 · ตัวที่ผ่านกลายเป็น SKU ใน Run หรือแทนสูตรเดิม</p></div></div>' +
      '<p class="warnbox">เดโมนี้จำลองตลาดในเบราว์เซอร์ ตัวเลขทั้งหมดเป็นตัวอย่าง เวอร์ชันใช้งานจริงต้องเชื่อม Shopee / TikTok Shop / Lazada / ZORT / LINE ผ่าน backend ตามที่อธิบายไว้ใน README</p></section>';
  }

  /* ---------- writing (AI or template) ---------- */
  function contextOf(c) {
    var p = c.sku && E.findProduct(S, c.sku);
    return {
      brand: S.brand.name, category: S.brand.category, idea: c.title, kind: c.kind === 'improve' ? 'ปรับสินค้าเดิม' : 'สินค้าใหม่', source: c.source,
      existing_product: p ? { name: p.name, price: p.price, rating: p.rating } : null,
      interview_score: c.interviewScore, quotes: c.quotes, test: c.visits ? { visits: c.visits, preorders: c.preorders, rate_pct: c.rate } : null,
      price: c.price, cost: c.cost, oem: c.oem, moq: c.moq, thresholds: S.policy.test
    };
  }
  function tplBrief(c) {
    var x = contextOf(c);
    return ['PRODUCT BRIEF · ' + c.title, 'ประเภท: ' + x.kind + (x.existing_product ? ' (' + x.existing_product.name + ')' : ''), 'แบรนด์: ' + x.brand, '',
      '1. ปัญหาของลูกค้า', '   ' + c.source, (c.quotes || []).map(function (q) { return '   "' + q + '"'; }).join('\n'), '',
      '2. สิ่งที่จะทำ', '   ' + (c.kind === 'improve' ? 'แก้ต้นเหตุตามรีวิว โดยคงจุดเด่นเดิมที่ลูกค้าชม' : 'สินค้าที่ตอบความต้องการข้างต้นโดยตรง ใช้ฐานลูกค้าเดิมเป็นกลุ่มทดสอบแรก'), '',
      '3. ตัวเลขตั้งต้น', '   ราคาขาย: ' + (x.price ? baht(x.price) : 'ยังไม่กำหนด') + ' · ต้นทุน: ' + (x.cost ? baht(x.cost) : 'รอ OEM เสนอ'), '   OEM: ' + (x.oem || 'รอจับคู่') + (x.moq ? ' · MOQ ' + x.moq : ''), '',
      '4. เกณฑ์ตัดสิน (ตั้งไว้ก่อนเริ่ม)', '   ทดสอบ ' + x.thresholds.days + ' วัน · ขยายเมื่อพรีออเดอร์ ≥ ' + x.thresholds.scale + '% · ตัดเมื่อ ≤ ' + x.thresholds.kill + '%',
      x.test ? '   ผลตอนนี้: ' + x.test.visits + ' คน · ' + x.test.preorders + ' พรีออเดอร์ · ' + x.test.rate_pct + '%' : '', '',
      '5. สิ่งที่ต้องเตรียม', '   - ม็อกอัปแพ็กเกจ 2 แบบ', '   - หน้า listing พรีออเดอร์ (ส่งภายใน 15 วัน)', '   - แคมเปญทดสอบ Meta/TikTok งบไม่เกิน ' + baht(S.policy.testBudgetCap), '   - ข้อความคืนเงิน/คูปอง ถ้าไอเดียถูกตัด', '',
      '(ร่างจากเทมเพลต · เชื่อม Claude ในแท็บข้อมูลเพื่อให้ได้ brief ที่เขียนจากข้อมูลจริงละเอียดกว่านี้)'].filter(function (l) { return l !== null; }).join('\n');
  }
  function tplInterview(c) {
    return ['สคริปต์สัมภาษณ์ลูกค้าผ่าน LINE · ' + c.title, 'เป้าหมาย: ลูกค้าจริง 30 คน ภายใน 3 วัน · ใช้เวลา 5–7 นาที', '',
      'เปิด: "สวัสดีค่ะ ' + S.brand.name + ' ขอเวลา 5 นาทีถามความเห็นเรื่องสินค้าใหม่ ตอบครบรับคูปอง 50 บาทค่ะ (ผู้ช่วย AI ของแบรนด์เป็นคนถามนะคะ)"', '',
      '1. ปกติคุณดูแล/แก้ปัญหาเรื่องนี้อย่างไร ใช้อะไรอยู่', '2. ครั้งล่าสุดที่รู้สึกว่าของที่ใช้ "ยังไม่ตอบโจทย์" คือเมื่อไหร่ เกิดอะไรขึ้น', '3. ถ้ามี "' + c.title + '" คุณคิดว่าจะช่วยเรื่องไหน',
      '4. อะไรที่จะทำให้คุณไม่ซื้อ', '5. ราคาเท่าไหร่ที่ "คุ้ม" และเท่าไหร่ที่ "แพงไป"', '6. ปกติซื้อจากช่องทางไหน Shopee / TikTok / Lazada / หน้าร้าน', '7. ถ้าเปิดพรีออเดอร์วันนี้ จะสั่งไหม (ใช่ / ไม่แน่ใจ / ไม่)', '8. มีอะไรอยากให้เราทำเพิ่ม',
      '', 'การให้คะแนน: ข้อ 7 "ใช่" = 3, "ไม่แน่ใจ" = 1 · ข้อ 5 ราคาคุ้ม ≥ ราคาตั้งต้น = +1 · รวมแล้วปรับเป็น 0–100', '(ร่างจากเทมเพลต)'].join('\n');
  }
  function tplListing(c) {
    return ['หน้า listing พรีออเดอร์ · ' + c.title, '', 'ชื่อสินค้า: [พรีออเดอร์] ' + c.title + ' | ' + S.brand.name, 'ราคา: ' + (c.price ? baht(c.price) : '[ราคา]') + ' · ส่งภายใน 15 วัน',
      '', 'จุดเด่น 3 ข้อ', '• แก้เรื่อง: ' + c.source, '• ผลิตล็อตแรกจำนวนจำกัด', '• ไม่พอใจคืนเงินเต็มจำนวน', '', 'คำอธิบาย', 'เราทำสินค้านี้เพราะลูกค้าบอกเรา พรีออเดอร์ล็อตแรกเพื่อยืนยันว่ามีคนต้องการจริงก่อนผลิตจำนวนมาก ถ้าล็อตนี้ไม่ได้ผลิต เราคืนเงินพร้อมคูปองทันที', '', '(ร่างจากเทมเพลต)'].join('\n');
  }
  function tplLearn() {
    var since = S.day - 30, themes = {};
    S.signals.forEach(function (g) { if (g.day >= since && E.NEG_THEMES.indexOf(g.theme) >= 0) themes[g.theme] = (themes[g.theme] || 0) + 1; });
    var top = Object.keys(themes).sort(function (a, b) { return themes[b] - themes[a]; }).slice(0, 3);
    var k = E.kpis(S, 30);
    var won = S.ledger.filter(function (l) { return l.outcome === 'launched'; }).slice(-5), lost = S.ledger.filter(function (l) { return l.outcome === 'killed'; }).slice(-5);
    return ['LOOP REVIEW · ' + S.brand.name + ' · ' + E.fmtDate(S.day), '', 'ภาพรวม 30 วัน',
      '• ยอดขาย ' + bahtK(k.revenue) + ' · กำไรขั้นต้นหลังแอด ' + pct(k.grossPct, 1) + ' · ROAS ' + k.roas.toFixed(1),
      '• ยอดจาก SKU ที่เกิดใน loop ' + pct(k.newShare, 1) + ' · Automation rate ' + pct(k.automation, 1), '• ยอดที่เสียเพราะของหมด ' + bahtK(k.lostSales) + ' · สต็อกค้าง ' + bahtK(k.deadValue), '',
      'ลูกค้าบ่นเรื่องอะไร', top.map(function (t) { return '• ' + E.THEME_LABEL[t] + ' ' + themes[t] + ' ครั้ง'; }).join('\n') || '• ไม่มีปัญหาเด่น', '',
      'ชนะ', won.map(function (l) { return '• ' + l.title + ': ' + l.text; }).join('\n') || '• ยังไม่มี', '', 'ตัดทิ้ง', lost.map(function (l) { return '• ' + l.title + ': ' + l.text; }).join('\n') || '• ยังไม่มี', '',
      'ข้อเสนอสำหรับรอบถัดไป', '• เพิ่มงบ Sense ในธีมที่ชนะ และตั้งเป้าทดสอบ 3 ไอเดียต่อเดือน', '• ตรวจกติกา PO ถ้ายอดเสียจากของหมดสูงกว่าสต็อกค้าง ให้เพิ่มสต็อกกันชน', '• ปัญหาที่ซ้ำแต่ไม่ใช่ตัวสินค้า (ส่งช้า, ราคา) ส่งให้ทีม ops แก้นอก loop', '', '(ร่างจากเทมเพลต)'].join('\n');
  }

  function write(kind, id) {
    var c = id === '__learn' ? null : E.findConcept(S, id);
    var tpl = kind === 'learn' ? tplLearn() : kind === 'brief' ? tplBrief(c) : kind === 'interview' ? tplInterview(c) : tplListing(c);
    if (!AI.configured()) { ui.ai[id] = tpl; render(true); return; }
    ui.ai[id] = 'Buddy กำลังเขียน…'; render(true);
    var prompt;
    if (kind === 'learn') {
      var k = E.kpis(S, 30);
      prompt = 'เขียน Loop Review สำหรับ strategist ของ Bizbuddy ภาษาไทย ไม่เกิน 350 คำ มีหัวข้อ: ภาพรวม, ลูกค้ากำลังบอกอะไร, อะไรชนะ/แพ้และทำไม, 3 การตัดสินใจสำหรับรอบ 90 วันถัดไป (ทั้งของเดิมและของใหม่), กติกาที่ควรปรับ\n\nข้อมูล:\n' +
        JSON.stringify({ brand: S.brand, kpi30: k, policy: S.policy, ledger: S.ledger.slice(-20), signal_counts: themeCounts(30), products: S.products.map(function (p) { return { name: p.name, stock: p.stock, cover_days: Math.round(E.daysCover(p)), rating: p.rating, promo: p.promo && p.promo.label }; }) });
    } else {
      var what = { brief: 'product brief ภาษาไทย มีหัวข้อ: ลูกค้าและปัญหา, สิ่งที่จะทำ, ทำไมจะชนะ, ตัวเลขตั้งต้น, เกณฑ์ตัดสิน, ความเสี่ยงและสิ่งที่ต้องเช็ก (อย./PDPA/แพลตฟอร์ม)', interview: 'สคริปต์สัมภาษณ์ลูกค้าผ่าน LINE ภาษาไทย 8 คำถาม ไม่ชี้นำ บอกลูกค้าว่าเป็นผู้ช่วย AI พร้อมวิธีให้คะแนน 0–100', listing: 'หน้า listing พรีออเดอร์บน Shopee ภาษาไทย: ชื่อสินค้า (ไม่เกิน 100 ตัวอักษร), จุดเด่น 3 ข้อ, คำอธิบาย, เงื่อนไขพรีออเดอร์และการคืนเงิน ห้ามอ้างผลลัพธ์ทางการแพทย์' }[kind];
      prompt = 'เขียน' + what + '\n\nข้อมูลไอเดีย:\n' + JSON.stringify(contextOf(c));
    }
    AI.ask(prompt).then(function (txt) { ui.ai[id] = txt; render(true); }, function (err) { ui.ai[id] = 'เชื่อม Claude ไม่สำเร็จ: ' + err.message + '\n\nใช้ร่างจากเทมเพลตแทน:\n\n' + tpl; render(true); });
  }
  function themeCounts(days) { var since = S.day - days, t = {}; S.signals.forEach(function (g) { if (g.day >= since) t[E.THEME_LABEL[g.theme] || g.theme] = (t[E.THEME_LABEL[g.theme] || g.theme] || 0) + 1; }); return t; }

  /* ---------- files ---------- */
  function download(name, text, type) {
    try {
      var blob = new Blob([text], { type: type });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('ดาวน์โหลด ' + name);
    } catch (e) { toast('เบราว์เซอร์นี้ดาวน์โหลดไฟล์ไม่ได้'); }
  }
  function readFile(input, cb) {
    var f = input && input.files && input.files[0];
    if (!f) return false;
    var r = new FileReader(); r.onload = function () { cb(String(r.result)); }; r.readAsText(f, 'utf-8');
    return true;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    switch (act) {
      case 'nav': go(t.getAttribute('data-view')); break;
      case 'approve': case 'reject':
        E.resolve(S, t.getAttribute('data-id'), act === 'approve'); save(); render(true); toast(act === 'approve' ? 'อนุมัติแล้ว Buddy ดำเนินการต่อ' : 'บันทึกว่าไม่อนุมัติแล้ว'); break;
      case 'approveAll':
        S.pending.slice().forEach(function (p) { E.resolve(S, p.id, true); }); save(); render(true); toast('อนุมัติทั้งหมดแล้ว'); break;
      case 'feed': ui.feed = t.getAttribute('data-f'); render(true); break;
      case 'sku': ui.sku = t.getAttribute('data-sku') || null; render(true); break;
      case 'concept': ui.concept = t.getAttribute('data-id') || null; render(true); break;
      case 'toggleAdd': ui.showAdd = !ui.showAdd; render(true); break;
      case 'write': write(t.getAttribute('data-kind'), t.getAttribute('data-id')); break;
      case 'copy': copyText(ui.ai[t.getAttribute('data-id')] || ''); break;
      case 'preset': preset(t.getAttribute('data-p')); break;
      case 'importProducts': importProducts(); break;
      case 'importReviews': importReviews(); break;
      case 'aiSave': aiSave(); break;
      case 'aiTest': aiTest(); break;
      case 'aiClear': AI.clear(); render(true); toast('ลบ key แล้ว'); break;
      case 'exportLog': exportLog(); break;
      case 'exportPlaybook': var pbx = E.exportPlaybook(S); download('playbook-' + (pbx.id || 'custom') + '-v' + pbx.version + '.json', JSON.stringify(pbx, null, 2), 'application/json'); break;
      case 'graduate': S.policy.autonomy = E.defaultPolicy().autonomy; save(); render(true); toast('เปลี่ยนเป็นระดับอัตโนมัติของ playbook แล้ว'); break;
      case 'exportState': download('buddy-loop-backup-day' + S.day + '.json', JSON.stringify(S), 'application/json'); break;
      case 'reset':
        if (!ui.confirmReset) { ui.confirmReset = true; render(true); setTimeout(function () { ui.confirmReset = false; if (ui.view === 'data') render(true); }, 4000); }
        else { setAuto(false); S = fresh(); ui = { view: 'today', sku: null, concept: null, feed: 'all', ai: {}, confirmReset: false, showAdd: false }; save(); location.hash = 'today'; render(); toast('เริ่มเดโมใหม่แล้ว'); }
        break;
    }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var t = ev.target.closest('tr[data-act], .card[data-act]');
    if (t) { ev.preventDefault(); t.click(); }
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('คัดลอกแล้ว'); }, function () { toast('คัดลอกไม่ได้ ให้เลือกข้อความเอง'); });
    else toast('คัดลอกไม่ได้ ให้เลือกข้อความเอง');
  }

  function preset(kind) {
    var a = S.policy.autonomy;
    if (kind === 'default') S.policy = E.defaultPolicy();
    else if (kind === 'max') Object.keys(a).forEach(function (k) { a[k] = 'auto'; });
    else if (kind === 'careful') { Object.keys(a).forEach(function (k) { a[k] = 'auto'; }); a.replenish = 'approve'; a.price = 'approve'; a.make = 'approve'; a.launch = 'approve'; }
    save(); render(true); toast('ใช้ชุดกติกา "' + { max: 'อัตโนมัติสูงสุด', careful: 'ระมัดระวัง', default: 'ค่าเริ่มต้น' }[kind] + '" แล้ว');
  }

  function bindForms() {
    var main = $('view');
    main.querySelectorAll('[data-rule]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var v = parseFloat(inp.value), P = S.policy, id = inp.getAttribute('data-rule');
        if (isNaN(v) || v < 0) { toast('ใส่ตัวเลขตั้งแต่ 0 ขึ้นไป'); return; }
        if (id === 'marginFloor' || id === 'maxDiscount') P[id] = Math.min(v, 90) / 100;
        else if (id.indexOf('clear-') === 0) P.clearance[id.slice(6)] = v;
        else if (id.indexOf('test-') === 0) P.test[id.slice(5)] = v;
        else P[id] = v;
        save(); renderShell(); toast('บันทึกกติกาแล้ว มีผลตั้งแต่วันถัดไป');
      });
    });
    main.querySelectorAll('[data-auto]').forEach(function (sel) {
      sel.addEventListener('change', function () { S.policy.autonomy[sel.getAttribute('data-auto')] = sel.value; save(); toast('เปลี่ยนระดับอัตโนมัติแล้ว'); });
    });
    var f = $('addIdea');
    if (f) f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var title = $('ai-title').value.trim();
      if (!title) { toast('ใส่ชื่อไอเดียก่อน'); return; }
      var kind = $('ai-kind').value, sku = $('ai-sku').value || null;
      S.seq = (S.seq || 0) + 1;
      S.concepts.push({ id: 'U' + S.seq, kind: kind, sku: sku, theme: null, title: title, source: $('ai-src').value.trim() || 'ไอเดียจากทีม', stage: 'sense', evidence: 60, appeal: 0.3 + Math.random() * 0.5,
        createdDay: S.day, stageDay: S.day, price: parseFloat($('ai-price').value) || 390, cost: parseFloat($('ai-cost').value) || 95, history: [] });
      ui.showAdd = false; save(); render(true); toast('ส่งไอเดียเข้า Sense แล้ว จะเริ่มสัมภาษณ์ในวันถัดไป');
    });
    var nb = $('newBrand');
    if (nb) nb.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = $('nb-name').value.trim();
      if (!name) { toast('ใส่ชื่อแบรนด์ก่อน'); return; }
      if (!ui.confirmNew) { ui.confirmNew = true; var keep = name, sel = $('nb-pb').value; render(true); $('nb-name').value = keep; $('nb-pb').value = sel; setTimeout(function () { ui.confirmNew = false; }, 5000); return; }
      ui.confirmNew = false;
      var choice = $('nb-pb').value;
      var pb = choice === 'current' ? E.exportPlaybook(S) : (SAMPLE.playbooks || []).filter(function (p) { return p.id === choice; })[0];
      setAuto(false);
      S = E.newBrand(pb, name, { seed: Date.now() % 100000 });
      ui.sku = null; ui.concept = null; ui.ai = {};
      save(); go('data'); toast('เริ่ม ' + name + ' ด้วย playbook ' + pb.name + ' แล้ว นำเข้าสินค้าเพื่อเริ่มทำงาน');
    });
    var pf = $('pbFile');
    if (pf) pf.addEventListener('change', function () {
      readFile(pf, function (txt) {
        try { var pb = JSON.parse(txt); if (!pb || pb.type !== 'buddy-playbook') throw new Error(); E.applyPlaybook(S, pb); save(); render(true); toast('ใช้ playbook ' + pb.name + ' v' + pb.version + ' แล้ว'); }
        catch (e) { toast('ไฟล์นี้ไม่ใช่ playbook ของ Buddy Loop'); }
      });
    });
    var sf = $('stateFile');
    if (sf) sf.addEventListener('change', function () {
      readFile(sf, function (txt) {
        try { var s = JSON.parse(txt); if (!s || s.version !== 2 || !s.products) throw new Error(); setAuto(false); S = s; save(); render(); toast('กู้คืนข้อมูลแล้ว'); }
        catch (e) { toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Buddy Loop'); }
      });
    });
  }

  function importProducts() {
    var go = function (txt) {
      var rows = E.parseCSV(txt);
      if (!rows.length) { $('prodMsg').textContent = 'ไม่พบข้อมูล ตรวจว่ามีแถวหัวตาราง'; return; }
      if ($('prodReplace').checked) { S.products = []; S.concepts = S.concepts.filter(function (c) { return c.kind === 'new'; }); S.signals = []; }
      var r = E.importProducts(S, rows); save();
      $('prodMsg').textContent = 'นำเข้า ' + r.added.length + ' สินค้า' + (r.errors.length ? ' · ข้าม ' + r.errors.length + ' แถว: ' + r.errors.slice(0, 3).join(' / ') : '');
      renderShell(); toast('นำเข้าสินค้าแล้ว ไปดูที่แท็บ Run');
    };
    if (!readFile($('prodFile'), go)) go($('prodCsv').value);
  }
  function importReviews() {
    var go = function (txt) {
      var rows = E.parseCSV(txt);
      if (!rows.length) { $('revMsg').textContent = 'ไม่พบข้อมูล'; return; }
      var before = S.concepts.length;
      var r = E.importReviews(S, rows); save();
      var made = S.concepts.length - before;
      $('revMsg').textContent = 'นำเข้า ' + r.added + ' รายการ' + (made ? ' · สร้างไอเดียปรับของเดิม ' + made + ' ใบใน Grow' : '') + (r.errors.length ? ' · ข้าม ' + r.errors.length + ' แถว' : '');
      renderShell(); toast('นำเข้ารีวิวแล้ว');
    };
    if (!readFile($('revFile'), go)) go($('revCsv').value);
  }
  function aiSave() {
    var key = $('aiKey').value.trim(), cfg = AI.config();
    if (!key && !cfg.hasKey) { $('aiMsg').textContent = 'ใส่ API key ก่อน'; return; }
    AI.save({ apiKey: key || undefined, model: $('aiModel').value, remember: $('aiRemember').checked });
    $('aiMsg').textContent = 'บันทึกแล้ว' + ($('aiRemember').checked ? ' (จำไว้ในเบราว์เซอร์นี้)' : ' (ใช้ได้จนกว่าจะปิดหน้านี้)');
    $('aiKey').value = '';
  }
  function aiTest() {
    $('aiMsg').textContent = 'กำลังทดสอบ…';
    AI.ask('ตอบคำเดียวว่า "พร้อม"', { maxTokens: 20 }).then(function (t) { $('aiMsg').textContent = 'เชื่อมต่อสำเร็จ: ' + t.trim(); }, function (e) { $('aiMsg').textContent = e.message; });
  }
  function exportLog() {
    var head = 'date,lane,engine,mode,action,detail,impact_thb\n';
    var q = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    var body = S.log.map(function (e) { return [E.fmtDate(e.day), e.lane, e.engine, e.mode, q(e.action), q(e.detail), Math.round(e.impact || 0)].join(','); }).join('\n');
    download('buddy-loop-log.csv', '﻿' + head + body, 'text/csv;charset=utf-8');
  }

  /* ---------- routing ---------- */
  function go(view) {
    if (!VIEWS.some(function (v) { return v.id === view; })) view = 'today';
    ui.view = view;
    if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', function () { var v = location.hash.slice(1); if (v && v !== ui.view) go(v); });

  $('run1').addEventListener('click', function () { run(1); });
  $('run7').addEventListener('click', function () { run(7); });
  $('run30').addEventListener('click', function () { run(30); });
  $('autoplay').addEventListener('click', function () { setAuto(!timer); });

  save();
  go(location.hash.slice(1) || 'today');
})();
