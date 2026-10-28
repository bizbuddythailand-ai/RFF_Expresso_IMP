const E = require('../js/engine.js');
const S = require('../js/sample-data.js');
const s = E.createState(S, { seed: 20261101 });
let errs = 0;
function check(c, m){ if(!c){ console.log('FAIL', m); errs++; } }
for (let d = 0; d < 60; d++) {
  E.runDay(s);
  // owner clears inbox like a demo user: approve all
  while (s.pending.length) E.resolve(s, s.pending[0].id, true);
}
const k = E.kpis(s, 30);
console.log('day', s.day, 'revenue30', Math.round(k.revenue), 'gross%', (k.grossPct*100).toFixed(1), 'automation', (k.automation*100).toFixed(1)+'%', 'auto', k.autoCount, 'human', k.humanCount);
console.log('launched', k.launched, 'killed', k.killed, 'pipeline', k.pipeline, 'newShare', (k.newShare*100).toFixed(1)+'%', 'stockouts', k.stockouts, 'dead', Math.round(k.deadValue));
console.log('concepts:'); s.concepts.forEach(c => console.log(' ', c.id, c.kind, c.stage, c.title, c.rate ?? '', c.interviewScore ?? ''));
const byEngine = {}; s.log.forEach(e => byEngine[e.engine] = (byEngine[e.engine]||0)+1); console.log(byEngine);
s.products.forEach(p => { check(p.stock >= 0, 'neg stock '+p.sku); check(!isNaN(p.rating), 'rating nan '+p.sku); });
s.daily.forEach(d => check(Number.isFinite(d.revenue) && Number.isFinite(d.gross), 'nan day'));
// promo never below floor
s.products.forEach(p => { if (p.promo && p.promo.kind==='campaign') check(E.unitMargin(E.effectivePrice(p), p.cost) >= s.policy.marginFloor - 1e-9, 'promo under floor '+p.sku); });
// csv
const rows = E.parseCSV('sku,name,price,cost,stock,daily_sales\nX1,"ทดสอบ, หนึ่ง",100,30,50,5\n');
check(rows.length===1 && rows[0].name==='ทดสอบ, หนึ่ง', 'csv quote');
const r = E.importProducts(s, rows); check(r.added.length===1, 'import');
const rv = E.importReviews(s, E.parseCSV('sku,rating,text\nX1,2,แสบมาก\nX1,2,ใช้แล้วแสบ\nX1,1,แสบหน้า\n'));
check(rv.added===3, 'reviews import');
check(s.concepts.some(c=>c.sku==='X1' && c.kind==='improve'), 'improve brief from imported reviews');
// serialisable
JSON.parse(JSON.stringify(s));
// reject path
const s2 = E.createState(S, { seed: 7 }); s2.policy.autonomy.replenish='approve';
for (let d=0; d<20; d++){ E.runDay(s2); while (s2.pending.length) E.resolve(s2, s2.pending[0].id, false); }
check(s2.counters.rejected > 0, 'rejections recorded');
// playbook: export carries no brand data, new brand starts careful and runs
const pb = E.exportPlaybook(s);
check(pb.type==='buddy-playbook' && !pb.products && !pb.signals && !pb.concepts, 'playbook has no brand data');
const nb = E.newBrand(pb, 'Nara Beauty');
check(nb.products.length===0 && nb.policy.autonomy.replenish==='approve', 'new brand careful start');
E.importProducts(nb, E.parseCSV('sku,name,price,cost,stock,daily_sales\nN1,ทดสอบ,300,80,500,20\n')); E.runDays(nb, 10);
check(nb.daily.length===10 && E.benchmarkOf(nb).tests >= pb.benchmark.tests, 'new brand runs with benchmark');
console.log(errs ? errs+' FAILURES' : 'ALL CHECKS PASSED');
process.exit(errs?1:0);
