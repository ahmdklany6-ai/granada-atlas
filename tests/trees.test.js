// Tree model (js/trees.js): species → form, recorded vs estimated sizes, trunk from circumference, unknown stays unknown;
// climate snapshot decoding (js/layers_v9.js expand) reproduces the Open-Meteo series exactly. Run: node tests/trees.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const store = {}; const ctx = { window: {}, localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, console };
ctx.window.GA = {}; ctx.window.localStorage = ctx.localStorage; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'trees.js'), 'utf8').replace('(window)', '(window)'), ctx);
const T = ctx.window.GA.trees; let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
// unknown tree: nothing invented
let m = T.model({});
ok(m.species === null && m.genus === null && m.form === 'generic' && m.formBasis === 'unknown', 'unknown species → generic model, basis unknown');
ok(!m.hRec && !m.crownRec && m.estimated && m.h === 6 && m.crown === 4, 'unknown size → illustrative 6 m / 4 m, flagged estimate');
// species and genus forms
ok(T.model({ species: 'Phoenix canariensis' }).form === 'palm', 'Phoenix → palm');
ok(T.model({ species: 'Cupressus sempervirens' }).form === 'columnar', 'Cupressus sempervirens → columnar');
ok(T.model({ species: 'Cedrus deodara' }).form === 'conical', 'Cedrus → conical');
ok(T.model({ species: 'Pinus halepensis' }).form === 'spreading', 'Pinus halepensis → spreading (species rule over genus)');
ok(T.model({ genus: 'Magnolia' }).form === 'round' && T.model({ genus: 'Magnolia' }).formBasis === 'genus', 'genus only → basis genus');
ok(T.model({ 'species:es': 'Olivo' }).genus === 'Olea' && T.model({ 'species:es': 'Olivo' }).form === 'round', 'Spanish common name → genus');
ok(T.model({ species: 'Olivo' }).genus === 'Olea', 'Spanish word in species → genus, species kept as tagged');
ok(T.model({ leaf_type: 'needleleaved' }).form === 'conical' && T.model({ leaf_type: 'needleleaved' }).formBasis === 'leaf_type', 'leaf type only → approximate form');
// recorded sizes
m = T.model({ species: 'Pinus halepensis', height: '20', diameter: '3.1 m' });
ok(m.hRec && m.h === 20 && !m.crownRec && Math.abs(m.crown - 20 * 4 / 6) < 1e-9 && m.diameterTag === '3.1 m' && !m.trunkRec, 'recorded height kept; crown estimated in the default proportions; ambiguous diameter tag shown, not used');
m = T.model({ height: '3', diameter_crown: '2.5' }); ok(m.hRec && m.crownRec && !m.estimated && m.h === 3 && m.crown === 2.5, 'small recorded tree stays small');
m = T.model({ height: '2' }); ok(m.crown <= 1.6 + 1e-9, 'estimated crown never wider than 0.8 × recorded height');
m = T.model({ circumference: '1.57' }); ok(m.trunkRec && Math.abs(m.trunk - 0.5) < 0.001, 'trunk diameter = circumference / π');
ok(T.num('65 ft') > 19.8 && T.num('65 ft') < 19.9 && T.num('250 cm') === 2.5 && T.num('abc') === null, 'units parsed (ft, cm), junk rejected');
// silhouettes stay inside the tree's own height and crown
['round', 'spreading', 'columnar', 'conical', 'palm', 'generic'].forEach(f => { const mm = Object.assign(T.model({}), { form: f, h: 10, crown: 6 }); const s = T.slices(mm); const o = T.outline(mm);
  ok(s.trunk[0] === 0 && Math.max(...s.crown.map(c => c[1])) <= 10 + 1e-9 && Math.max(...s.crown.map(c => c[2])) <= 3 + 1e-9, f + ': 3D slices within height and crown radius');
  ok(Math.max(...o.crown.map(p => p[1])) <= 10 + 1e-6 && Math.max(...o.crown.map(p => Math.abs(p[0]))) <= 3 + 1e-6 && o.trunk.every(p => p[1] >= 0), f + ': section outline within height and crown, trunk on the ground'); });
// editable defaults
T.setDefaults(8, 5); m = T.model({}); ok(m.h === 8 && m.crown === 5 && JSON.parse(store['granada-atlas.treeDefaults']).h === 8, 'illustrative size is editable and remembered');
// climate snapshot decoding
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'layers_v9.js'), 'utf8');
const ex = src.slice(src.indexOf('  function expand('), src.indexOf('  function climateData('));
const expand = vm.runInNewContext('(' + ex.trim().replace(/^function expand/, 'function') + ')');
const w = expand('wind', { t0: '2015-01-01T00:00', n: 3, s: [12, null, 5], d: [270, 90, null], latitude: 37.25, longitude: -3.5 });
ok(JSON.stringify(w.hourly.time) === JSON.stringify(['2015-01-01T00:00', '2015-01-01T01:00', '2015-01-01T02:00']) && w.hourly.wind_speed_10m[0] === 1.2 && w.hourly.wind_speed_10m[1] === null && w.hourly.wind_direction_10m[2] === null, 'wind snapshot → hourly series (×10 decoded, nulls kept)');
const r = expand('rain', { t0: '2020-02-28', n: 3, p: [0, 25, null] });
ok(JSON.stringify(r.daily.time) === JSON.stringify(['2020-02-28', '2020-02-29', '2020-03-01']) && r.daily.precipitation_sum[1] === 2.5, 'rain snapshot → daily series across a leap day');
const W = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'climate', 'era5_wind_2015_2024.json'), 'utf8'));
const ew = expand('wind', W); ok(ew.hourly.time.length === 87672 && ew.hourly.time[87671] === '2024-12-31T23:00', 'shipped wind snapshot spans 2015-01-01T00 … 2024-12-31T23 (87,672 h)');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'climate', 'era5_rain_1991_2020.json'), 'utf8'));
const er = expand('rain', R); ok(er.daily.time[0] === '1991-01-01' && er.daily.time[er.daily.time.length - 1] === '2020-12-31', 'shipped rain snapshot spans 1991-01-01 … 2020-12-31');
console.log('trees.test.js: ' + n + ' checks passed');
