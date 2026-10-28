/*
 * Buddy Loop engine — simulates one brand's market day by day and runs every
 * Run / Grow / Learn engine against the owner's policy.
 * Pure logic: no DOM. Works in the browser (window.BuddyEngine) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var START_UTC = Date.UTC(2026, 10, 1); // 1 Nov 2026 = day 0
  var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var COMMISSION = 0.15; // blended marketplace fees as share of revenue

  var ENGINES = {
    replenish: { lane: 'run', name: 'Replenish', th: 'เติมสต็อก' },
    price: { lane: 'run', name: 'Price & Promo', th: 'ราคาและโปร' },
    ads: { lane: 'run', name: 'Ads', th: 'แอด' },
    clearance: { lane: 'run', name: 'Clearance', th: 'เคลียร์สต็อก' },
    reviews: { lane: 'run', name: 'Reviews', th: 'รีวิว' },
    service: { lane: 'run', name: 'Service', th: 'บริการลูกค้า' },
    sense: { lane: 'grow', name: 'Sense', th: 'จับสัญญาณ' },
    ask: { lane: 'grow', name: 'Ask', th: 'ถามลูกค้า' },
    make: { lane: 'grow', name: 'Make', th: 'ทำต้นแบบ' },
    test: { lane: 'grow', name: 'Test', th: 'ทดสอบขาย' },
    launch: { lane: 'grow', name: 'Launch', th: 'เปิดตัว' },
    learn: { lane: 'learn', name: 'Learn', th: 'เรียนรู้' }
  };

  var THEME_LABEL = {
    irritation: 'แสบ/ระคายเคือง', sticky: 'เหนียวเหนอะหนะ', dry: 'แห้งตึง', scent: 'กลิ่นแรง',
    shipping: 'ส่งช้า', price: 'ราคาแพง', packaging: 'แพ็กเกจเสียหาย', small: 'ขนาดเล็กไป',
    good_texture: 'เนื้อดี ซึมไว', good_result: 'เห็นผลดี', good_value: 'คุ้มราคา', good_scent: 'กลิ่นหอมอ่อน'
  };
  var NEG_THEMES = ['irritation', 'sticky', 'dry', 'scent', 'shipping', 'price', 'packaging', 'small'];
  var THEME_KEYWORDS = [
    ['irritation', ['แสบ', 'ระคาย', 'คัน', 'แดง', 'แพ้']],
    ['sticky', ['เหนียว', 'เหนอะ', 'มัน']],
    ['dry', ['แห้ง', 'ตึง']],
    ['scent', ['กลิ่นแรง', 'เหม็น', 'ฉุน']],
    ['shipping', ['ส่งช้า', 'รอนาน', 'ขนส่ง']],
    ['price', ['แพง']],
    ['packaging', ['แตก', 'รั่ว', 'บุบ', 'เสียหาย']],
    ['small', ['เล็ก', 'น้อย', 'หมดไว']],
    ['good_scent', ['หอม']],
    ['good_texture', ['ซึม', 'บางเบา', 'เนื้อดี']],
    ['good_value', ['คุ้ม', 'ถูก']],
    ['good_result', ['ดี', 'ชอบ', 'เห็นผล', 'ใส', 'ปัง']]
  ];

  /* ---------- helpers ---------- */
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) >>> 0;
    var t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function between(s, a, b) { return a + (b - a) * rand(s); }
  function pick(s, arr) { return arr[Math.floor(rand(s) * arr.length)]; }
  function round(n, d) { var f = Math.pow(10, d || 0); return Math.round(n * f) / f; }
  function sum(arr, f) { var t = 0; for (var i = 0; i < arr.length; i++) t += f ? f(arr[i]) : arr[i]; return t; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function uid(s, prefix) { s.seq = (s.seq || 0) + 1; return prefix + s.seq; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function dateOf(day) { return new Date(START_UTC + day * 86400000); }
  function fmtDate(day) {
    var d = dateOf(day);
    return d.getUTCDate() + ' ' + TH_MONTHS[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear() + 543).slice(2);
  }
  function campaignOf(day) {
    var d = dateOf(day), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    if (m === dd) return { name: m + '.' + dd, lift: 2.6, type: 'mega', target: 0.15 };
    if (dd === 25) return { name: 'Payday', lift: 1.5, type: 'payday', target: 0.08 };
    return null;
  }
  function nextCampaign(day, within) {
    for (var k = 1; k <= within; k++) { var c = campaignOf(day + k); if (c) return { c: c, inDays: k, day: day + k }; }
    return null;
  }

  function classifyText(text) {
    var t = String(text || '');
    for (var i = 0; i < THEME_KEYWORDS.length; i++) {
      var kws = THEME_KEYWORDS[i][1];
      for (var j = 0; j < kws.length; j++) if (t.indexOf(kws[j]) !== -1) return THEME_KEYWORDS[i][0];
    }
    return 'good_result';
  }

  /* ---------- product maths ---------- */
  function avgDaily(p) {
    var h = p.history || [];
    if (!h.length) return p.baseDaily;
    var last = h.slice(-7);
    return Math.max(0.1, sum(last) / last.length);
  }
  function daysCover(p) { return p.stock / Math.max(0.1, avgDaily(p)); }
  function onOrderQty(p) { return sum(p.onOrder || [], function (o) { return o.qty; }); }
  function unitMargin(price, cost) { return (price * (1 - COMMISSION) - cost) / price; }
  function maxDiscountForFloor(p, floor) {
    // price*(1-d)*(1-COMMISSION) - cost >= floor*price*(1-d)
    var need = p.cost / (1 - COMMISSION - floor);
    return clamp(1 - need / p.price, 0, 0.9);
  }
  function effectivePrice(p) { return p.price * (1 - (p.promo ? p.promo.discount : 0)); }
  function productStatus(p, policy) {
    var cover = daysCover(p);
    if (p.stock <= 0) return { key: 'out', label: 'ของหมด' };
    if (cover < 7) return { key: 'low', label: 'ใกล้หมด' };
    if (cover > policy.clearance.bundle) return { key: 'over', label: 'ค้างสต็อก' };
    if (p.promo) return { key: 'promo', label: p.promo.label };
    return { key: 'ok', label: 'ปกติ' };
  }

  /* ---------- state ---------- */
  function defaultPolicy() {
    return {
      marginFloor: 0.25,
      maxDiscount: 0.40,
      adDailyCap: 9000,
      poApproveAbove: 100000,
      safetyDays: 14,
      refundAutoMax: 1000,
      testBudgetCap: 15000,
      senseMinEvidence: 60,
      askPassScore: 60,
      test: { days: 14, scale: 2.5, kill: 0.8 },
      clearance: { bundle: 60, flash: 90, outlet: 120 },
      autonomy: {
        replenish: 'auto', price: 'auto', ads: 'auto', clearance: 'auto', reviews: 'auto', service: 'auto',
        sense: 'auto', ask: 'auto', make: 'auto', test: 'auto', launch: 'approve'
      }
    };
  }

  function createState(sample, opts) {
    opts = opts || {};
    var s = {
      version: 2,
      brand: sample.brand,
      rng: opts.seed || 20261101,
      seq: 0,
      day: 0,
      policy: defaultPolicy(),
      products: clone(sample.products),
      concepts: clone(sample.concepts),
      trends: clone(sample.trends),
      oems: clone(sample.oems),
      signals: [],
      pending: [],
      log: [],
      ledger: [],
      daily: [],
      counters: { auto: 0, approved: 0, rejected: 0 }
    };
    s.products.forEach(function (p) {
      p.history = p.history || [];
      p.onOrder = p.onOrder || [];
      p.promo = p.promo || null;
      p.adPaused = false;
      p.clear = p.clear || null;
      p.fixed = p.fixed || {};
      p.revenue30 = 0;
      if (!p.history.length) for (var i = 0; i < 7; i++) p.history.push(round(p.baseDaily * between(s, 0.85, 1.15), 1));
    });
    (sample.reviews || []).forEach(function (r) { addSignal(s, 'review', r.sku, r.text, classifyText(r.text), r.rating); });
    s.playbook = null;
    if (sample.playbook) applyPlaybook(s, sample.playbook, { keepTrends: true });
    return s;
  }

  /* ---------- playbooks: the repeatable part ----------
   * A playbook is everything that carries over from one brand to the next in the same category:
   * policy (guardrails, gates, autonomy), OEM network, trend watchlist, and an anonymised benchmark.
   * No brand's products, reviews or sales ever go into a playbook. */
  function applyPlaybook(s, pb, opts) {
    opts = opts || {};
    var base = defaultPolicy();
    var pol = pb.policy || {};
    Object.keys(pol).forEach(function (k) {
      if (pol[k] && typeof pol[k] === 'object' && !Array.isArray(pol[k])) base[k] = Object.assign({}, base[k], pol[k]);
      else base[k] = pol[k];
    });
    s.policy = base;
    if (pb.oems && pb.oems.length) s.oems = clone(pb.oems);
    if (!opts.keepTrends && pb.trends) s.trends = clone(pb.trends).map(function (t) { t.used = false; return t; });
    s.playbook = { id: pb.id, name: pb.name, category: pb.category, version: pb.version || '1.0', benchmark: clone(pb.benchmark || { tests: 0, passed: 0, rates: [], brands: 0 }) };
    return s;
  }

  function newBrand(pb, brandName, opts) {
    opts = opts || {};
    var s = createState({ brand: { name: brandName || 'แบรนด์ใหม่', note: (pb.category || '') + ' · เริ่มด้วย playbook ' + pb.name, category: pb.category }, products: [], concepts: [], trends: pb.trends || [], oems: pb.oems || [] }, { seed: opts.seed || 777 });
    applyPlaybook(s, pb);
    // first week runs in careful mode while the owner learns to trust the drafts
    ['replenish', 'price', 'make', 'launch'].forEach(function (k) { s.policy.autonomy[k] = 'approve'; });
    s.onboarding = { startDay: 0, carefulUntil: 7 };
    return s;
  }

  function benchmarkOf(s) {
    var b = (s.playbook && s.playbook.benchmark) || { tests: 0, passed: 0, rates: [], brands: 0 };
    var own = s.concepts.filter(function (c) { return c.rate != null && (c.stage === 'launched' || c.stage === 'killed' || c.stage === 'scale'); });
    var rates = (b.rates || []).concat(own.map(function (c) { return c.rate; })).sort(function (x, y) { return x - y; });
    var tests = (b.tests || 0) + own.length;
    var passed = (b.passed || 0) + own.filter(function (c) { return c.stage === 'launched' || c.stage === 'scale'; }).length;
    var median = rates.length ? (rates.length % 2 ? rates[(rates.length - 1) / 2] : (rates[rates.length / 2 - 1] + rates[rates.length / 2]) / 2) : null;
    return { tests: tests, passed: passed, passRate: tests ? passed / tests : null, median: median == null ? null : round(median, 2), brands: (b.brands || 0) + 1, ownTests: own.length };
  }

  function exportPlaybook(s) {
    var pb = s.playbook || { id: 'custom', name: 'Playbook', category: s.brand.category || '', version: '1.0' };
    var own = s.concepts.filter(function (c) { return c.rate != null && (c.stage === 'launched' || c.stage === 'killed' || c.stage === 'scale'); });
    var b = pb.benchmark || { tests: 0, passed: 0, rates: [], brands: 0 };
    var ver = String(pb.version || '1.0').split('.');
    return {
      type: 'buddy-playbook', id: pb.id, name: pb.name, category: pb.category,
      version: ver[0] + '.' + ((parseInt(ver[1], 10) || 0) + 1),
      policy: clone(s.policy), oems: clone(s.oems),
      trends: s.trends.map(function (t) { return { query: t.query, title: t.title, growth: t.growth, score: Math.round(t.score), appeal: t.appeal, price: t.price, cost: t.cost }; }),
      benchmark: { tests: (b.tests || 0) + own.length, passed: (b.passed || 0) + own.filter(function (c) { return c.stage !== 'killed'; }).length, rates: (b.rates || []).concat(own.map(function (c) { return c.rate; })).slice(-200), brands: (b.brands || 0) + 1 },
      note: 'มีเฉพาะกติกา เครือข่าย OEM รายการเทรนด์ และ benchmark แบบไม่ระบุแบรนด์ ไม่มีสินค้า รีวิว หรือยอดขายของแบรนด์ใด'
    };
  }

  /* ---------- log / pending ---------- */
  function log(s, engine, action, detail, mode, impact) {
    var e = { id: uid(s, 'L'), day: s.day, engine: engine, lane: ENGINES[engine].lane, action: action, detail: detail || '', mode: mode || 'auto', impact: impact || 0 };
    s.log.push(e);
    if (s.log.length > 1500) s.log.splice(0, s.log.length - 1500);
    if (e.mode === 'auto') s.counters.auto++;
    return e;
  }
  function hasPending(s, type, key) {
    return s.pending.some(function (p) { return p.type === type && p.key === key; });
  }
  function propose(s, engine, type, key, title, detail, value, payload, reason) {
    if (hasPending(s, type, key)) return null;
    var item = { id: uid(s, 'P'), day: s.day, engine: engine, lane: ENGINES[engine].lane, type: type, key: key, title: title, detail: detail, value: value || 0, payload: payload || {}, reason: reason || '' };
    s.pending.push(item);
    log(s, engine, 'รออนุมัติ: ' + title, reason || detail, 'pending', value);
    return item;
  }
  function modeFor(s, engine) { return s.policy.autonomy[engine] || 'auto'; }

  function addSignal(s, type, sku, text, theme, rating) {
    s.signals.push({ id: uid(s, 'S'), day: s.day, type: type, sku: sku || null, text: text, theme: theme, rating: rating || null });
    if (s.signals.length > 1200) s.signals.splice(0, s.signals.length - 1200);
  }

  /* ---------- RUN engines ---------- */
  function placeOrder(s, p, qty, mode) {
    var eta = s.day + p.leadTime;
    p.onOrder.push({ qty: qty, eta: eta });
    var oem = p.oem || 'OEM';
    log(s, 'replenish', 'สั่งผลิต ' + p.name + ' ' + qty.toLocaleString() + ' ชิ้น', 'ส่ง PO ให้ ' + oem + ' ทาง LINE · ของเข้า ' + fmtDate(eta), mode, -qty * p.cost);
  }

  function runReplenish(s, p) {
    var mode = modeFor(s, 'replenish');
    if (mode === 'off' || p.discontinued) return;
    var horizon = p.leadTime + s.policy.safetyDays;
    var daily = avgDaily(p);
    var lift = 0;
    for (var k = 1; k <= horizon; k++) { var c = campaignOf(s.day + k); if (c) lift += (c.lift - 1); }
    var need = daily * (horizon + lift);
    var position = p.stock + onOrderQty(p);
    // owner hasn't answered a big PO and stock will run out before goods could arrive:
    // place an emergency lot that stays inside the auto-approval cap, keep the rest in the inbox
    var waiting = s.pending.filter(function (x) { return x.type === 'po' && x.key === p.sku; })[0];
    if (waiting && mode === 'auto' && s.day - waiting.day >= 2 && p.emergencyFor !== waiting.id && daysCover(p) < p.leadTime + 3) {
      var eq = Math.floor(s.policy.poApproveAbove / p.cost / p.moq) * p.moq;
      if (eq >= p.moq) {
        p.emergencyFor = waiting.id;
        placeOrder(s, p, eq, 'auto');
        log(s, 'replenish', 'สั่งล็อตฉุกเฉินภายในเพดาน: ' + p.name, 'PO ใหญ่รอคุณมา ' + (s.day - waiting.day) + ' วัน และของจะหมดก่อนของใหม่มา จึงสั่ง ' + eq.toLocaleString() + ' ชิ้น (ไม่เกิน ฿' + s.policy.poApproveAbove.toLocaleString() + ') ส่วนที่เหลือยังรอคุณอนุมัติ', 'auto');
        waiting.payload.qty = Math.max(p.moq, waiting.payload.qty - eq);
        waiting.value = waiting.payload.qty * p.cost;
        waiting.title = 'สั่งผลิต ' + p.name + ' ' + waiting.payload.qty.toLocaleString() + ' ชิ้น (ส่วนที่เหลือ)';
      }
      return;
    }
    if (position >= need) return;
    var qty = Math.ceil((need * 1.4 - position) / p.moq) * p.moq;
    qty = Math.max(qty, p.moq);
    var value = qty * p.cost;
    var reason = 'คาดว่าจะขาย ' + Math.round(need).toLocaleString() + ' ชิ้นใน ' + horizon + ' วัน (รวมแคมเปญ) แต่มีอยู่และกำลังมา ' + Math.round(position).toLocaleString() + ' ชิ้น';
    if (mode === 'approve' || value > s.policy.poApproveAbove) {
      propose(s, 'replenish', 'po', p.sku, 'สั่งผลิต ' + p.name + ' ' + qty.toLocaleString() + ' ชิ้น', reason, value, { sku: p.sku, qty: qty },
        value > s.policy.poApproveAbove ? 'มูลค่า PO ฿' + Math.round(value).toLocaleString() + ' เกินเพดานอนุมัติอัตโนมัติ ฿' + s.policy.poApproveAbove.toLocaleString() : 'โหมดอนุมัติ');
    } else {
      placeOrder(s, p, qty, 'auto');
    }
  }

  function setPromo(s, p, promo, mode) {
    p.promo = promo;
    log(s, 'price', 'ตั้งโปร ' + promo.label + ' ' + p.name + ' ลด ' + Math.round(promo.discount * 100) + '%', 'Shopee + TikTok Shop + Lazada · ถึง ' + fmtDate(promo.until) + ' · มาร์จินหลังลด ' + Math.round(unitMargin(effectivePrice(p), p.cost) * 100) + '%', mode);
  }

  function runPrice(s, p) {
    var mode = modeFor(s, 'price');
    if (mode === 'off' || p.discontinued) return;
    if (p.promo && s.day > p.promo.until) { log(s, 'price', 'จบโปร ' + p.promo.label + ' ' + p.name, 'กลับราคาปกติ ฿' + p.price, 'auto'); p.promo = null; }
    var cover = daysCover(p);
    if (p.promo && p.promo.kind === 'campaign' && cover < 5) {
      log(s, 'price', 'หยุดโปร ' + p.name + ' ก่อนกำหนด', 'ของเหลือ ' + cover.toFixed(1) + ' วัน กันของขาดช่วงแคมเปญ', 'auto');
      p.promo = null; return;
    }
    if (p.promo) return;
    var up = nextCampaign(s.day, 3);
    if (!up) return;
    if (cover < 10) { log(s, 'price', 'ไม่ร่วมแคมเปญ ' + up.c.name + ': ' + p.name, 'ของเหลือแค่ ' + cover.toFixed(1) + ' วัน', 'auto'); p.skipCampaign = up.day; return; }
    if (p.skipCampaign === up.day) return;
    var maxD = Math.min(maxDiscountForFloor(p, s.policy.marginFloor), s.policy.maxDiscount);
    var d = Math.min(up.c.target, maxD);
    if (d < 0.03) {
      if (p.blockedCampaign !== up.day) { p.blockedCampaign = up.day; log(s, 'price', 'ไม่ลดราคา ' + p.name + ' ช่วง ' + up.c.name, 'ถ้าลดจะต่ำกว่ามาร์จินขั้นต่ำ ' + Math.round(s.policy.marginFloor * 100) + '% · ใช้ bundle ของแถมแทน', 'auto'); }
      return;
    }
    d = Math.floor(d * 100) / 100;
    var promo = { kind: 'campaign', discount: d, until: up.day, label: up.c.name };
    if (mode === 'approve') propose(s, 'price', 'promo', p.sku + '@' + up.day, 'โปร ' + up.c.name + ' ' + p.name + ' ลด ' + Math.round(d * 100) + '%', 'เริ่มอุ่นโปรล่วงหน้า ' + up.inDays + ' วัน', 0, { sku: p.sku, promo: promo }, 'โหมดอนุมัติ');
    else setPromo(s, p, promo, 'auto');
  }

  function runAds(s) {
    var mode = modeFor(s, 'ads');
    if (mode === 'off') return;
    var live = s.products.filter(function (p) { return !p.discontinued; });
    live.forEach(function (p) {
      var cover = daysCover(p);
      var tot = sum(Object.keys(p.ads), function (k) { return p.ads[k]; });
      if (!p.adPaused && cover < 7 && tot > 0) {
        p.adPaused = true; p.savedAds = clone(p.ads);
        Object.keys(p.ads).forEach(function (k) { p.ads[k] = 0; });
        log(s, 'ads', 'หยุดแอด ' + p.name, 'ของเหลือ ' + cover.toFixed(1) + ' วัน ไม่จ่ายเงินดึงคนมาเจอของหมด · ประหยัด ฿' + Math.round(tot).toLocaleString() + '/วัน', 'auto', tot);
      } else if (p.adPaused && cover > 14) {
        p.adPaused = false; p.ads = p.savedAds || p.ads;
        log(s, 'ads', 'เปิดแอด ' + p.name + ' อีกครั้ง', 'สต็อกกลับมา ' + Math.round(cover) + ' วัน', 'auto');
      }
    });
    if (s.day % 7 === 0) {
      live.forEach(function (p) {
        if (p.adPaused) return;
        var ch = Object.keys(p.roas);
        var best = ch.reduce(function (a, b) { return p.roas[a] >= p.roas[b] ? a : b; });
        var worst = ch.reduce(function (a, b) { return p.roas[a] <= p.roas[b] ? a : b; });
        if (best !== worst && p.roas[best] > p.roas[worst] * 1.3 && p.ads[worst] > 50) {
          var move = Math.round(p.ads[worst] * 0.25);
          p.ads[worst] -= move; p.ads[best] += move;
          log(s, 'ads', 'ย้ายงบแอด ' + p.name + ' ฿' + move + '/วัน', worst + ' (ROAS ' + p.roas[worst].toFixed(1) + ') → ' + best + ' (ROAS ' + p.roas[best].toFixed(1) + ')', 'auto');
        }
      });
    }
    var total = sum(live, function (p) { return sum(Object.keys(p.ads), function (k) { return p.ads[k]; }); });
    if (total > s.policy.adDailyCap) {
      var f = s.policy.adDailyCap / total;
      live.forEach(function (p) { Object.keys(p.ads).forEach(function (k) { p.ads[k] = Math.round(p.ads[k] * f); }); });
      log(s, 'ads', 'ปรับงบแอดรวมให้อยู่ใต้เพดาน', '฿' + Math.round(total).toLocaleString() + ' → ฿' + s.policy.adDailyCap.toLocaleString() + '/วัน ตามกติกา', 'auto');
    }
  }

  function runClearance(s, p) {
    var mode = modeFor(s, 'clearance');
    if (mode === 'off' || p.discontinued) return;
    var cover = daysCover(p);
    var c = s.policy.clearance;
    if (p.clear && s.day < p.clear.until) return;
    var tier = null;
    if (cover > c.outlet) tier = 'outlet'; else if (cover > c.flash) tier = 'flash'; else if (cover > c.bundle) tier = 'bundle';
    if (!tier) { p.clear = null; return; }
    var floorD = clamp(1 - (p.cost * 1.05) / (p.price * (1 - COMMISSION)), 0, s.policy.maxDiscount);
    var d, label, detail;
    if (tier === 'bundle') { d = Math.min(0.10, floorD); label = 'Bundle'; detail = 'จับคู่กับตัวขายดี ลดชิ้นที่ 2 · ของเหลือ ' + Math.round(cover) + ' วันขาย'; }
    else if (tier === 'flash') { d = Math.min(0.25, floorD); label = 'Flash sale'; detail = 'Shopee shop flash sale + TikTok flash deal · ไม่ต่ำกว่าทุน · ของเหลือ ' + Math.round(cover) + ' วันขาย'; }
    else { d = floorD; label = 'Outlet'; detail = 'ย้าย 30% ไปเป็นของแถม/ช่อง outlet · ของเหลือ ' + Math.round(cover) + ' วันขาย'; }
    if (p.promo && p.promo.kind === 'campaign') return;
    var plan = { sku: p.sku, tier: tier, discount: round(d, 2), label: label, detail: detail };
    if (mode === 'approve') {
      propose(s, 'clearance', 'clearance', p.sku + ':' + tier, label + ' ' + p.name + ' ลด ' + Math.round(d * 100) + '%', detail, 0, plan, 'โหมดอนุมัติ');
      return;
    }
    applyClearance(s, p, plan, 'auto');
  }
  function applyClearance(s, p, plan, mode) {
    p.clear = { tier: plan.tier, until: s.day + 14 };
    p.promo = { kind: 'clearance', discount: plan.discount, until: s.day + 14, label: plan.label };
    var detail = plan.detail;
    if (plan.tier === 'outlet') {
      var moved = Math.floor(p.stock * 0.3);
      p.stock -= moved;
      p.outletUnits = (p.outletUnits || 0) + moved;
      detail += ' · ' + moved.toLocaleString() + ' ชิ้น';
    }
    log(s, 'clearance', plan.label + ' ' + p.name + ' ลด ' + Math.round(plan.discount * 100) + '%', detail, mode);
  }

  function runReviewsService(s, p, unitsSold) {
    var revMode = modeFor(s, 'reviews');
    var svcMode = modeFor(s, 'service');
    var nReviews = Math.floor(unitsSold * 0.04 + rand(s));
    var replied = 0;
    for (var i = 0; i < nReviews; i++) {
      var neg = rand(s) < p.negRate;
      var theme = neg ? pick(s, p.negThemes) : pick(s, p.posThemes);
      if (neg && p.fixed[theme]) { if (rand(s) < 0.75) theme = pick(s, p.posThemes); }
      var rating = NEG_THEMES.indexOf(theme) >= 0 ? (rand(s) < 0.5 ? 2 : 3) : (rand(s) < 0.7 ? 5 : 4);
      addSignal(s, 'review', p.sku, THEME_LABEL[theme], theme, rating);
      p.ratingSum = (p.ratingSum || p.rating * 50) + rating; p.ratingN = (p.ratingN || 50) + 1;
      p.rating = round(p.ratingSum / p.ratingN, 2);
      replied++;
    }
    if (replied && revMode !== 'off') {
      p.repliesToday = (p.repliesToday || 0) + replied;
    }
    if (revMode !== 'off') detectIssue(s, p);

    if (svcMode === 'off') return { chats: 0, auto: 0 };
    var chats = Math.floor(unitsSold * 0.06 + rand(s));
    var refund = rand(s) < Math.min(0.2, unitsSold * 0.004);
    if (refund) {
      var amt = Math.round(effectivePrice(p) * (rand(s) < 0.5 ? 1 : 2));
      if (amt <= s.policy.refundAutoMax && svcMode === 'auto') {
        log(s, 'service', 'คืนเงินอัตโนมัติ ฿' + amt, p.name + ' · ลูกค้าแจ้งของเสียหาย พร้อมรูป', 'auto', -amt);
        addSignal(s, 'return', p.sku, 'คืนสินค้า: แพ็กเกจเสียหาย', 'packaging', 1);
      } else {
        propose(s, 'service', 'refund', uid(s, 'R'), 'คืนเงิน ฿' + amt + ' (' + p.name + ')', 'ลูกค้าแจ้งว่าใช้แล้ว ' + THEME_LABEL[pick(s, p.negThemes)], amt, { sku: p.sku, amount: amt },
          'เกินเพดานคืนเงินอัตโนมัติ ฿' + s.policy.refundAutoMax);
      }
    }
    return { chats: chats, auto: Math.round(chats * 0.88) };
  }

  function detectIssue(s, p) {
    var since = s.day - 14;
    var counts = {};
    s.signals.forEach(function (g) {
      if (g.sku === p.sku && g.day >= since && NEG_THEMES.indexOf(g.theme) >= 0) counts[g.theme] = (counts[g.theme] || 0) + 1;
    });
    Object.keys(counts).forEach(function (theme) {
      if (counts[theme] < 3 || p.fixed[theme]) return;
      if (theme === 'shipping' || theme === 'price') return; // handled by ops, not product
      var exists = s.concepts.some(function (c) { return c.kind === 'improve' && c.sku === p.sku && c.theme === theme && (c.stage !== 'killed' || s.day - c.stageDay < 45); });
      if (exists) return;
      var idea = improveIdea(p, theme);
      var c = {
        id: uid(s, 'C'), kind: 'improve', sku: p.sku, theme: theme, title: idea.title, source: 'รีวิว "' + THEME_LABEL[theme] + '" ' + counts[theme] + ' ครั้งใน 14 วัน',
        stage: 'sense', evidence: clamp(50 + counts[theme] * 6, 0, 95), appeal: idea.appeal, createdDay: s.day, stageDay: s.day, history: []
      };
      s.concepts.push(c);
      log(s, 'reviews', 'เจอปัญหาซ้ำ: ' + THEME_LABEL[theme] + ' (' + p.name + ')', 'ส่ง brief ปรับของเดิมเข้า Grow: ' + idea.title, 'auto');
    });
  }

  function improveIdea(p, theme) {
    var map = {
      irritation: ' สูตรอ่อนโยน (ตัดน้ำหอม/แอลกอฮอล์)', sticky: ' เนื้อบางเบาขึ้น', dry: ' เพิ่มความชุ่มชื้น',
      scent: ' กลิ่นอ่อนลง', packaging: ' แพ็กเกจกันรั่ว', small: ' ขนาดใหญ่ขึ้น/รีฟิล'
    };
    return { title: p.name + (map[theme] || ' ปรับปรุง'), appeal: 0.7 };
  }

  /* ---------- market simulation per product ---------- */
  function simulateProduct(s, p, camp) {
    // receive orders
    var arrived = 0;
    p.onOrder = p.onOrder.filter(function (o) { if (o.eta <= s.day) { p.stock += o.qty; arrived += o.qty; return false; } return true; });
    if (arrived) log(s, 'replenish', 'ของเข้าโกดัง ' + p.name + ' ' + arrived.toLocaleString() + ' ชิ้น', 'อัปเดตสต็อกใน ZORT ทุกช่องทาง', 'auto');

    if (p.discontinued) { p.history.push(0); return { units: 0, revenue: 0, cogs: 0, ad: 0, stockout: false }; }
    var adSpend = sum(Object.keys(p.ads), function (k) { return p.ads[k]; });
    var adFactor = 0.75 + 0.5 * Math.min(1, adSpend / Math.max(1, p.baseDaily * p.price * 0.12));
    var promoLift = p.promo ? 1 + p.promo.discount * 3.2 : 1;
    var ratingFactor = clamp(0.6 + (p.rating - 3.5) * 0.4, 0.6, 1.3);
    var lift = camp ? (p.promo && p.promo.kind === 'campaign' ? camp.lift : 1 + (camp.lift - 1) * 0.35) : 1;
    var demand = p.baseDaily * adFactor * promoLift * ratingFactor * lift * between(s, 0.78, 1.22);
    var units = Math.min(p.stock, Math.round(demand));
    var stockout = units < Math.round(demand) && p.stock <= Math.round(demand);
    p.stock -= units;
    var outletSold = 0;
    if (p.outletUnits) { outletSold = Math.min(p.outletUnits, Math.round(p.baseDaily * 0.5)); p.outletUnits -= outletSold; }
    var revenue = units * effectivePrice(p) + outletSold * p.cost;
    var cogs = (units + outletSold) * p.cost;
    p.history.push(units);
    if (p.history.length > 60) p.history.shift();
    p.ageDays++;
    // ROAS drift
    Object.keys(p.roas).forEach(function (k) { p.roas[k] = clamp(p.roas[k] * between(s, 0.96, 1.04), 1.2, 14); });
    return { units: units, revenue: revenue, cogs: cogs, ad: adSpend, stockout: stockout, lostUnits: stockout ? Math.round(demand) - units : 0 };
  }

  /* ---------- GROW engines ---------- */
  function senseTick(s) {
    var mode = modeFor(s, 'sense');
    if (mode === 'off') return;
    // trend momentum moves every day
    s.trends.forEach(function (t) { t.score = clamp(t.score * between(s, 0.99, 1.05), 0, 100); });
    if (s.day % 7 !== 0) {
      advanceSense(s, mode);
      return;
    }
    var fresh = s.trends.filter(function (t) { return !t.used && t.score >= 45; }).sort(function (a, b) { return b.score - a.score; })[0];
    if (fresh) {
      fresh.used = true;
      var c = { id: uid(s, 'C'), kind: 'new', title: fresh.title, source: 'เทรนด์ "' + fresh.query + '" +' + Math.round(fresh.growth) + '% ใน 90 วัน', stage: 'sense', evidence: Math.round(fresh.score), appeal: fresh.appeal, createdDay: s.day, stageDay: s.day, price: fresh.price, cost: fresh.cost, history: [] };
      s.concepts.push(c);
      log(s, 'sense', 'การ์ดใหม่: ' + c.title, c.source + ' · คะแนนหลักฐาน ' + c.evidence, 'auto');
    }
    advanceSense(s, mode);
  }
  function advanceSense(s, mode) {
    s.concepts.forEach(function (c) {
      if (c.stage !== 'sense') return;
      if (c.kind === 'new') {
        var t = s.trends.filter(function (x) { return x.title === c.title; })[0];
        if (t) c.evidence = Math.round(Math.max(c.evidence, t.score));
      }
      if (c.evidence >= s.policy.senseMinEvidence) moveStage(s, c, 'ask', 'sense', 'หลักฐาน ' + c.evidence + ' ≥ ' + s.policy.senseMinEvidence + ' เริ่มสัมภาษณ์ลูกค้า');
    });
  }

  function moveStage(s, c, to, engine, why) {
    c.history.push({ day: s.day, from: c.stage, to: to, why: why });
    c.stage = to; c.stageDay = s.day;
    var verb = { ask: 'ไปขั้นถามลูกค้า', make: 'ไปขั้นทำต้นแบบ', test: 'เริ่มทดสอบขาย', scale: 'ผ่านการทดสอบ', launched: 'เปิดตัวแล้ว', killed: 'ตัดทิ้ง' }[to] || to;
    log(s, engine, c.title + ': ' + verb, why, 'auto');
  }

  function askTick(s) {
    if (modeFor(s, 'ask') === 'off') return;
    s.concepts.forEach(function (c) {
      if (c.stage !== 'ask') return;
      c.interviews = (c.interviews || 0) + 10;
      if (c.interviews < 30) return;
      c.interviewScore = Math.round(clamp(c.appeal * 100 + between(s, -12, 12), 5, 98));
      c.syntheticRank = Math.round(clamp(c.appeal * 100 + between(s, -20, 20), 5, 98));
      var quotes = c.interviewScore >= 60 ? ['อยากได้มานานแล้ว', 'ถ้าราคาไม่เกินตัวเดิมซื้อแน่', 'ขอแบบพกพาด้วย'] : ['ยังใช้ของเดิมได้อยู่', 'ไม่แน่ใจว่าต่างกันยังไง', 'ราคาน่าจะแพงไป'];
      c.quotes = quotes;
      if (c.interviewScore >= s.policy.askPassScore) moveStage(s, c, 'make', 'ask', 'สัมภาษณ์ลูกค้าจริง 30 คนผ่าน LINE · คะแนน ' + c.interviewScore + ' (ลูกค้าจำลองจัดอันดับ ' + c.syntheticRank + ')');
      else { moveStage(s, c, 'killed', 'ask', 'สัมภาษณ์ 30 คน · คะแนน ' + c.interviewScore + ' ต่ำกว่าเกณฑ์ ' + s.policy.askPassScore); addLesson(s, c, 'ลูกค้าไม่ตอบรับตั้งแต่ขั้นถาม ประหยัดค่าทำต้นแบบ'); }
    });
  }

  function makeTick(s) {
    var mode = modeFor(s, 'make');
    if (mode === 'off') return;
    s.concepts.forEach(function (c) {
      if (c.stage !== 'make' || c.awaitingBudget) return;
      if (!c.oem) {
        var cat = c.kind === 'improve' ? 'reform' : 'new';
        var o = s.oems.filter(function (x) { return x.can.indexOf(cat) >= 0; }).sort(function (a, b) { return a.moq - b.moq; })[0] || s.oems[0];
        c.oem = o.name; c.moq = o.moq; c.leadTime = o.leadTime;
        c.budget = Math.min(12000, 6000 + Math.round(c.appeal * 6000));
        log(s, 'make', 'Brief + OEM: ' + c.title, 'จับคู่ ' + o.name + ' (MOQ ' + o.moq + ' ชิ้น, ' + o.leadTime + ' วัน) · ทำม็อกอัปและ listing พรีออเดอร์', 'auto');
      }
      if (s.day - c.stageDay < 2) return;
      if (mode === 'approve' || c.budget > s.policy.testBudgetCap) {
        c.awaitingBudget = true;
        propose(s, 'make', 'testBudget', c.id, 'งบทดสอบ ฿' + c.budget.toLocaleString() + ': ' + c.title, 'พรีออเดอร์ ' + s.policy.test.days + ' วัน · ' + c.oem, c.budget, { id: c.id },
          c.budget > s.policy.testBudgetCap ? 'เกินเพดานงบทดสอบ ฿' + s.policy.testBudgetCap.toLocaleString() : 'โหมดอนุมัติ');
      } else startTest(s, c, 'auto');
    });
  }

  function startTest(s, c, mode) {
    c.awaitingBudget = false;
    c.testDay = 0; c.visits = 0; c.preorders = 0; c.spent = 0;
    moveStage(s, c, 'test', 'test', 'เปิดพรีออเดอร์บน Shopee + แคมเปญทดสอบ Meta/TikTok งบ ฿' + c.budget.toLocaleString() + (mode === 'approved' ? ' (เจ้าของอนุมัติ)' : ''));
  }

  function testTick(s) {
    if (modeFor(s, 'test') === 'off') return;
    var r = s.policy.test;
    s.concepts.forEach(function (c) {
      if (c.stage !== 'test') return;
      c.testDay++;
      var dailyBudget = c.budget / r.days;
      var visits = Math.round(dailyBudget / between(s, 3.5, 5.5));
      var rate = Math.max(0, c.appeal * 4.6 * between(s, 0.7, 1.3) / 100);
      var pre = 0; for (var i = 0; i < visits; i++) if (rand(s) < rate) pre++;
      c.visits += visits; c.preorders += pre; c.spent += dailyBudget;
      c.rate = c.visits ? round(c.preorders / c.visits * 100, 2) : 0;
      if (c.testDay === 7 && c.rate < r.kill * 0.5) {
        moveStage(s, c, 'killed', 'test', 'ตัดเร็ววันที่ 7 · พรีออเดอร์ ' + c.rate + '% ต่ำกว่าครึ่งของเกณฑ์ตัด · คืนงบที่เหลือ ฿' + Math.round(c.budget - c.spent).toLocaleString());
        log(s, 'test', 'คืนเงินพรีออเดอร์ ' + c.preorders + ' ราย', c.title + ' · ส่งข้อความขอบคุณพร้อมคูปองสินค้าเดิม', 'auto');
        addLesson(s, c, 'ตัดเร็วตั้งแต่วันที่ 7 ประหยัดงบครึ่งหนึ่ง'); return;
      }
      if (c.testDay < r.days) return;
      if (c.rate >= r.scale) {
        moveStage(s, c, 'scale', 'test', 'พรีออเดอร์ ' + c.rate + '% ≥ ' + r.scale + '% · ' + c.preorders + ' ออเดอร์จาก ' + c.visits.toLocaleString() + ' คน');
        requestLaunch(s, c);
      } else if (c.rate <= r.kill || c.iterated) {
        moveStage(s, c, 'killed', 'test', 'พรีออเดอร์ ' + c.rate + '% ' + (c.iterated ? 'หลังปรับแล้ว 1 รอบ' : '≤ ' + r.kill + '%'));
        log(s, 'test', 'คืนเงินพรีออเดอร์ ' + c.preorders + ' ราย', c.title + ' · ส่งคูปองสินค้าเดิมแทน', 'auto');
        addLesson(s, c, 'ไม่ผ่านการทดสอบด้วยเงินจริง เสียงบ ฿' + Math.round(c.spent).toLocaleString() + ' แทนที่จะเสียค่าผลิตทั้งล็อต');
      } else {
        c.iterated = true; c.appeal = clamp(c.appeal + between(s, 0.02, 0.12), 0, 1);
        c.testDay = 0; c.visits = 0; c.preorders = 0;
        log(s, 'test', 'ปรับแล้วทดสอบซ้ำ: ' + c.title, 'ผล ' + c.rate + '% อยู่ระหว่างเกณฑ์ · AI ปรับรูป หัวข้อ และราคา แล้วเริ่มรอบที่ 2', 'auto');
      }
    });
  }

  function requestLaunch(s, c) {
    var mode = modeFor(s, 'launch');
    var detail = c.kind === 'improve' ? 'แทนที่สูตรเดิมของ ' + c.sku + ' · ล็อตแรกจาก ' + c.oem : 'สร้าง SKU ใหม่ · PO แรก 1,000 ชิ้นจาก ' + c.oem;
    if (mode === 'auto') launch(s, c, 'auto');
    else propose(s, 'launch', 'launch', c.id, 'เปิดตัว: ' + c.title, detail + ' · พรีออเดอร์ ' + c.rate + '%', c.kind === 'improve' ? 0 : 1000 * (c.cost || 100), { id: c.id }, 'การเปิดตัวสินค้าเป็นการตัดสินใจของเจ้าของ');
  }

  function launch(s, c, mode) {
    if (c.kind === 'improve') {
      var p = findProduct(s, c.sku);
      if (p) {
        p.fixed[c.theme] = true;
        p.baseDaily = round(p.baseDaily * 1.12, 1);
        p.negRate = round(p.negRate * 0.6, 3);
        p.version = (p.version || 1) + 1;
        p.name = p.name.replace(/ \(สูตร \d+\)$/, '') + ' (สูตร ' + p.version + ')';
      }
      moveStage(s, c, 'launched', 'launch', 'สูตรใหม่ขึ้นขายแทนของเดิม · Run ดูแลต่อ' + (mode === 'approved' ? ' (เจ้าของอนุมัติ)' : ''));
      addLesson(s, c, 'ปัญหาจากรีวิวกลายเป็นสินค้าเวอร์ชันใหม่ในเวลา ' + (s.day - c.createdDay) + ' วัน');
    } else {
      var sku = 'NEW-' + c.id;
      var price = c.price || 390, cost = c.cost || 95;
      var np = {
        sku: sku, name: c.title, category: 'ใหม่', price: price, cost: cost, stock: Math.max(0, Math.max(c.moq || 300, 300) * 2 - c.preorders), baseDaily: round(c.appeal * 24, 1),
        leadTime: c.leadTime || 25, moq: c.moq || 300, ageDays: 0, rating: 4.5, oem: c.oem, isNew: true, bornDay: s.day,
        roas: { Shopee: 6, TikTok: 7, Lazada: 4 }, ads: { Shopee: 400, TikTok: 500, Lazada: 150 },
        negRate: 0.08, negThemes: ['small', 'price'], posThemes: ['good_result', 'good_texture'],
        history: [], onOrder: [{ qty: 1000, eta: s.day + (c.leadTime || 25) }], promo: null, fixed: {}
      };
      for (var i = 0; i < 7; i++) np.history.push(np.baseDaily);
      s.products.push(np);
      moveStage(s, c, 'launched', 'launch', 'SKU ' + sku + ' เข้า Run · ล็อตแรก ' + (Math.max(c.moq || 300, 300) * 2) + ' ชิ้น (ส่งพรีออเดอร์ ' + c.preorders + ' ราย) · PO ถัดไป 1,000 ชิ้น' + (mode === 'approved' ? ' (เจ้าของอนุมัติ)' : ''));
      addLesson(s, c, 'จากเทรนด์ถึงขายจริงใน ' + (s.day - c.createdDay) + ' วัน');
    }
  }

  function addLesson(s, c, text) {
    s.ledger.push({ day: s.day, title: c.title, kind: c.kind, outcome: c.stage, text: text, rate: c.rate || null, score: c.interviewScore || null });
  }

  /* ---------- approvals ---------- */
  function resolve(s, id, approve) {
    var i = -1;
    for (var k = 0; k < s.pending.length; k++) if (s.pending[k].id === id) i = k;
    if (i < 0) return false;
    var item = s.pending.splice(i, 1)[0];
    var pl = item.payload;
    if (approve) s.counters.approved++; else s.counters.rejected++;
    var p, c;
    if (item.type === 'po') {
      p = findProduct(s, pl.sku);
      if (approve && p) placeOrder(s, p, pl.qty, 'approved');
      else log(s, 'replenish', 'ไม่สั่งผลิต ' + (p ? p.name : pl.sku), 'เจ้าของไม่อนุมัติ · จะเสนอใหม่เมื่อสต็อกต่ำกว่าเกณฑ์อีกครั้ง', 'rejected');
    } else if (item.type === 'promo') {
      p = findProduct(s, pl.sku);
      if (approve && p) setPromo(s, p, pl.promo, 'approved');
      else log(s, 'price', 'ไม่ทำโปร ' + (p ? p.name : ''), 'เจ้าของไม่อนุมัติ', 'rejected');
    } else if (item.type === 'testBudget') {
      c = findConcept(s, pl.id);
      if (c && approve) startTest(s, c, 'approved');
      else if (c) { moveStage(s, c, 'killed', 'make', 'เจ้าของไม่อนุมัติงบทดสอบ'); c.awaitingBudget = false; }
    } else if (item.type === 'launch') {
      c = findConcept(s, pl.id);
      if (c && approve) launch(s, c, 'approved');
      else if (c) { moveStage(s, c, 'killed', 'launch', 'เจ้าของไม่เปิดตัว'); addLesson(s, c, 'ผ่านการทดสอบแต่เจ้าของตัดสินใจไม่เปิดตัว'); }
    } else if (item.type === 'clearance') {
      p = findProduct(s, pl.sku);
      if (approve && p) applyClearance(s, p, pl, 'approved');
      else if (p) { p.clear = { tier: pl.tier, until: s.day + 14 }; log(s, 'clearance', 'ไม่เคลียร์สต็อก ' + p.name, 'เจ้าของไม่อนุมัติ · จะเสนอใหม่ใน 14 วัน', 'rejected'); }
    } else if (item.type === 'refund') {
      if (approve) log(s, 'service', 'คืนเงิน ฿' + pl.amount, 'เจ้าของอนุมัติ · แจ้งลูกค้าใน LINE แล้ว', 'approved', -pl.amount);
      else log(s, 'service', 'เสนอเปลี่ยนสินค้าแทนคืนเงิน', 'ส่งข้อความเสนอเปลี่ยนเป็นสูตรอ่อนโยนหรือคูปอง', 'rejected');
    }
    // the item's own log line flips from pending to resolved
    s.log.forEach(function (e) { if (e.mode === 'pending' && e.action === 'รออนุมัติ: ' + item.title) e.mode = approve ? 'approved' : 'rejected'; });
    return true;
  }

  function findProduct(s, sku) { for (var i = 0; i < s.products.length; i++) if (s.products[i].sku === sku) return s.products[i]; return null; }
  function findConcept(s, id) { for (var i = 0; i < s.concepts.length; i++) if (s.concepts[i].id === id) return s.concepts[i]; return null; }

  /* ---------- weekly learn ---------- */
  function learnTick(s) {
    if (s.day % 7 !== 6) return;
    var week = s.daily.slice(-7);
    var rev = sum(week, function (d) { return d.revenue; });
    var since = s.day - 7;
    var themes = {};
    s.signals.forEach(function (g) { if (g.day > since && NEG_THEMES.indexOf(g.theme) >= 0) themes[g.theme] = (themes[g.theme] || 0) + 1; });
    var top = Object.keys(themes).sort(function (a, b) { return themes[b] - themes[a]; })[0];
    var autos = s.log.filter(function (e) { return e.day > since && e.mode === 'auto'; }).length;
    var text = 'ยอดขาย ฿' + Math.round(rev).toLocaleString() + ' · AI ทำงานเอง ' + autos + ' รายการ' + (top ? ' · ปัญหาที่ลูกค้าพูดถึงมากสุด: ' + THEME_LABEL[top] + ' (' + themes[top] + ')' : '');
    s.ledger.push({ day: s.day, title: 'สรุปสัปดาห์ที่ ' + Math.floor(s.day / 7 + 1), kind: 'week', outcome: 'week', text: text });
    log(s, 'learn', 'สรุปบทเรียนประจำสัปดาห์', text, 'auto');
  }

  /* ---------- the day ---------- */
  function runDay(s) {
    var camp = campaignOf(s.day);
    var day = { day: s.day, revenue: 0, cogs: 0, ad: 0, units: 0, stockouts: 0, lost: 0, newRevenue: 0, chats: 0, chatsAuto: 0, replies: 0 };
    if (camp) log(s, 'price', 'วันแคมเปญ ' + camp.name, 'ทุกช่องทางเปิดโปรตามแผนที่ตั้งไว้', 'auto');

    s.products.forEach(function (p) {
      var r = simulateProduct(s, p, camp);
      day.revenue += r.revenue; day.cogs += r.cogs; day.ad += r.ad; day.units += r.units;
      if (r.stockout) { day.stockouts++; day.lost += r.lostUnits * effectivePrice(p); }
      if (p.isNew) day.newRevenue += r.revenue;
      p.repliesToday = 0;
      var sv = runReviewsService(s, p, r.units);
      day.chats += sv.chats; day.chatsAuto += sv.auto; day.replies += p.repliesToday;
    });
    if (day.replies) log(s, 'reviews', 'ตอบรีวิว ' + day.replies + ' รายการ', 'ตอบด้วยน้ำเสียงของแบรนด์ บน Shopee + TikTok Shop', 'auto');
    if (day.chats) log(s, 'service', 'ตอบแชทลูกค้า ' + day.chatsAuto + '/' + day.chats + ' เรื่อง', 'คำถามเรื่องวิธีใช้ การจัดส่ง และส่วนผสม · ที่เหลือส่งต่อทีม', 'auto');

    s.products.forEach(function (p) { runReplenish(s, p); runPrice(s, p); runClearance(s, p); });
    runAds(s);

    senseTick(s); askTick(s); makeTick(s); testTick(s);

    day.gross = day.revenue * (1 - COMMISSION) - day.cogs - day.ad;
    var stockValue = sum(s.products, function (p) { return p.stock * p.cost; });
    var deadValue = sum(s.products, function (p) { return daysCover(p) > s.policy.clearance.bundle ? p.stock * p.cost : 0; });
    day.stockValue = stockValue; day.deadValue = deadValue;
    s.daily.push(day);
    if (s.daily.length > 400) s.daily.shift();
    learnTick(s);
    s.day++;
    return day;
  }

  function runDays(s, n) { for (var i = 0; i < n; i++) runDay(s); return s; }

  function kpis(s, window) {
    window = window || 30;
    var d = s.daily.slice(-window);
    var rev = sum(d, function (x) { return x.revenue; });
    var gross = sum(d, function (x) { return x.gross; });
    var ad = sum(d, function (x) { return x.ad; });
    var newRev = sum(d, function (x) { return x.newRevenue; });
    var lost = sum(d, function (x) { return x.lost; });
    var last = s.daily[s.daily.length - 1] || {};
    var c = s.counters;
    var human = c.approved + c.rejected + s.pending.length;
    return {
      days: d.length, revenue: rev, gross: gross, grossPct: rev ? gross / rev : 0, ad: ad, roas: ad ? rev / ad : 0,
      newShare: rev ? newRev / rev : 0, newRevenue: newRev, lostSales: lost, stockouts: sum(d, function (x) { return x.stockouts; }),
      stockValue: last.stockValue || sum(s.products, function (p) { return p.stock * p.cost; }),
      deadValue: last.deadValue || 0,
      automation: (c.auto + human) ? c.auto / (c.auto + human) : 1,
      autoCount: c.auto, humanCount: human,
      pipeline: s.concepts.filter(function (x) { return ['sense', 'ask', 'make', 'test', 'scale'].indexOf(x.stage) >= 0; }).length,
      launched: s.concepts.filter(function (x) { return x.stage === 'launched'; }).length,
      killed: s.concepts.filter(function (x) { return x.stage === 'killed'; }).length
    };
  }

  /* ---------- import ---------- */
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    text = String(text).replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) { var o = {}; head.forEach(function (h, j) { o[h] = (r[j] || '').trim(); }); return o; });
  }

  function importProducts(s, rows) {
    var errors = [], added = [];
    rows.forEach(function (r, i) {
      var price = parseFloat(r.price), cost = parseFloat(r.cost), stock = parseInt(r.stock, 10), daily = parseFloat(r.daily_sales);
      if (!r.sku || !r.name || !(price > 0) || !(cost >= 0) || isNaN(stock) || !(daily >= 0)) { errors.push('แถว ' + (i + 2) + ': ต้องมี sku, name, price, cost, stock, daily_sales'); return; }
      var p = {
        sku: r.sku, name: r.name, category: r.category || 'ทั่วไป', price: price, cost: cost, stock: stock, baseDaily: daily,
        leadTime: parseInt(r.lead_time_days, 10) || 21, moq: parseInt(r.moq, 10) || 300, ageDays: parseInt(r.age_days, 10) || 180,
        rating: parseFloat(r.rating) || 4.5, oem: r.oem || 'OEM หลัก',
        roas: { Shopee: parseFloat(r.roas_shopee) || 5, TikTok: parseFloat(r.roas_tiktok) || 6, Lazada: parseFloat(r.roas_lazada) || 4 },
        ads: { Shopee: parseFloat(r.ad_shopee) || Math.round(daily * price * 0.04), TikTok: parseFloat(r.ad_tiktok) || Math.round(daily * price * 0.05), Lazada: parseFloat(r.ad_lazada) || Math.round(daily * price * 0.02) },
        negRate: 0.1, negThemes: ['sticky', 'shipping', 'small'], posThemes: ['good_result', 'good_value', 'good_texture'],
        history: [], onOrder: [], promo: null, fixed: {}
      };
      for (var k = 0; k < 7; k++) p.history.push(daily);
      var old = findProduct(s, p.sku);
      if (old) s.products[s.products.indexOf(old)] = p; else s.products.push(p);
      added.push(p.sku);
    });
    return { added: added, errors: errors };
  }

  function importReviews(s, rows) {
    var n = 0, errors = [];
    rows.forEach(function (r, i) {
      if (!r.text) { errors.push('แถว ' + (i + 2) + ': ไม่มีข้อความรีวิว (text)'); return; }
      var theme = classifyText(r.text);
      addSignal(s, 'review', r.sku || null, r.text, theme, parseFloat(r.rating) || null);
      n++;
    });
    s.products.forEach(function (p) { detectIssue(s, p); });
    return { added: n, errors: errors };
  }

  var api = {
    ENGINES: ENGINES, THEME_LABEL: THEME_LABEL, NEG_THEMES: NEG_THEMES, COMMISSION: COMMISSION,
    createState: createState, defaultPolicy: defaultPolicy, applyPlaybook: applyPlaybook, newBrand: newBrand, benchmarkOf: benchmarkOf, exportPlaybook: exportPlaybook, runDay: runDay, runDays: runDays, resolve: resolve, kpis: kpis,
    fmtDate: fmtDate, campaignOf: campaignOf, nextCampaign: nextCampaign, daysCover: daysCover, avgDaily: avgDaily,
    onOrderQty: onOrderQty, effectivePrice: effectivePrice, unitMargin: unitMargin, productStatus: productStatus,
    classifyText: classifyText, parseCSV: parseCSV, importProducts: importProducts, importReviews: importReviews,
    findProduct: findProduct, findConcept: findConcept
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BuddyEngine = api;
})(typeof window !== 'undefined' ? window : this);
