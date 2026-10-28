/*
 * Optional AI writing via the Claude API, called straight from the browser.
 * The demo works fully without it (built-in templates). When a key is set, Buddy Loop uses Claude to
 * write product briefs, interview scripts and review replies in Thai.
 *
 * Security: a key used in the browser is visible to anyone using this browser. Use a personal or
 * low-limit key for demos. For production, call Claude from your own backend instead.
 */
(function (root) {
  'use strict';
  var KEY = 'buddyloop.ai';
  var mem = { apiKey: '', model: 'claude-sonnet-5-5', remember: false };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var o = JSON.parse(raw); mem.apiKey = o.apiKey || ''; mem.model = o.model || mem.model; mem.remember = true; }
    } catch (e) { /* storage unavailable: keep in memory only */ }
  }
  function save(cfg) {
    if (typeof cfg.apiKey === 'string' && cfg.apiKey.trim()) mem.apiKey = cfg.apiKey.trim();
    mem.model = (cfg.model || 'claude-sonnet-5-5').trim();
    mem.remember = !!cfg.remember;
    try {
      if (mem.remember && mem.apiKey) localStorage.setItem(KEY, JSON.stringify({ apiKey: mem.apiKey, model: mem.model }));
      else localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }
  function clear() { mem.apiKey = ''; mem.remember = false; try { localStorage.removeItem(KEY); } catch (e) {} }
  function configured() { return !!mem.apiKey; }
  function config() { return { model: mem.model, remember: mem.remember, hasKey: !!mem.apiKey }; }

  var SYSTEM = 'คุณคือ Buddy Loop ผู้ช่วย AI ของ Bizbuddy ที่ดูแลแบรนด์ retail ไทย เขียนภาษาไทยที่กระชับ ชัดเจน ใช้ได้จริง ' +
    'ไม่แต่งตัวเลขที่ไม่มีในข้อมูล ถ้าข้อมูลไม่พอให้บอกว่าต้องเก็บข้อมูลอะไรเพิ่ม';

  function ask(prompt, opts) {
    opts = opts || {};
    if (!mem.apiKey) return Promise.reject(new Error('ยังไม่ได้ใส่ API key ในแท็บข้อมูล'));
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': mem.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: mem.model,
        max_tokens: opts.maxTokens || 1200,
        system: opts.system || SYSTEM,
        messages: [{ role: 'user', content: prompt }]
      })
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          var msg = (body && body.error && body.error.message) || ('HTTP ' + res.status);
          if (res.status === 401) msg = 'API key ไม่ถูกต้อง (401) ตรวจ key ในแท็บข้อมูล';
          if (res.status === 404) msg = 'ไม่พบโมเดล "' + mem.model + '" ลองเปลี่ยนชื่อโมเดลในแท็บข้อมูล';
          throw new Error(msg);
        }
        return (body.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
      });
    }, function () {
      throw new Error('เชื่อมต่อ api.anthropic.com ไม่ได้ ถ้าเปิดไฟล์จากเครื่องหรือในหน้าที่บล็อกการเชื่อมต่อ ให้เปิดผ่าน GitHub Pages แทน');
    });
  }

  load();
  root.BuddyAI = { ask: ask, save: save, clear: clear, configured: configured, config: config };
})(window);
