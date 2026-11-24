// node tests/research.test.js — build 5.52 research tour: chapters, strings in three languages, sources, data file
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0; const ok = (n, c, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' ' + extra : '')); if (!c) fails++; };
const ROOT = path.join(__dirname, '..');
// a minimal window with the i18n dictionary: collect every add() call
const dict = {}; const win = { GA: { i18n: { add: (o) => Object.assign(dict, o), t: (k) => k } }, matchMedia: () => ({ matches: false }) };
win.window = win; vm.createContext(win);
fs.readdirSync(path.join(ROOT, 'js')).filter(f => /^i18n.*\.js$/.test(f) && f !== 'i18n.js').forEach(f => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), win); } catch (e) { /* files that need more of the app */ } });
win.GA.palette = require(path.join(ROOT, 'js', 'palette.js'));
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'tour_research.js'), 'utf8'), win);
const R = win.GA.tourResearch, CH = R.CH;
ok('14 chapters', CH.length === 14, CH.length);
const ids = CH.flatMap(c => c.slides.map(s => s.id)); ok('slide ids unique', new Set(ids).size === ids.length, ids.length + ' slides');
ok('the tour opens on the base (chapter 1, slide 1 = the 5.42 base slide)', CH[0].slides[0].old && CH[0].slides[0].old.join() === '1,1');
// every 5.27–5.51 slide is still in the tour (nothing removed)
const OLD = ['1,1', '2,1', '2,2', '2,3', '2,4', '2,5', '2,6', '2,7', '3,1', '3,2', '3,3', '3,4'];
const have = CH.flatMap(c => c.slides.filter(s => s.old).map(s => s.old.join()));
ok('all 12 earlier slides kept', OLD.every(o => have.includes(o)), OLD.filter(o => !have.includes(o)).join(' '));
// strings: each slide has its finding and link; new slides also question and explanation — in ar / he / en, non-empty
const tri = (k) => Array.isArray(dict[k]) && dict[k].length === 3 && dict[k].every(v => typeof v === 'string' && v.trim());
const miss = [];
CH.forEach(c => { if (!tri('r.c.' + c.k)) miss.push('r.c.' + c.k); c.slides.forEach(s => { (s.old ? ['c', 'l'] : ['t', 'b', 'c', 'l']).forEach(p => { const k = `r.${s.id}.${p}`; if (!tri(k)) miss.push(k); }); }); });
ok('every slide text in three languages', !miss.length, miss.slice(0, 8).join(' '));
// the same placeholders in the three languages of a string
const ph = (s) => (s.match(/\{[a-zA-Z0-9]+\}/g) || []).sort().join();
const bad = Object.keys(dict).filter(k => k.startsWith('r.') && tri(k) && !(ph(dict[k][0]) === ph(dict[k][2]) && ph(dict[k][1]) === ph(dict[k][2])));
ok('placeholders agree across languages', !bad.length, bad.slice(0, 6).join(' '));
// every key the module asks for exists
const src = fs.readFileSync(path.join(ROOT, 'js', 'tour_research.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js', 'tour.js'), 'utf8');
const used = [...new Set((src.match(/t\('(r\.[a-zA-Z0-9.]+)'/g) || []).map(m => m.slice(3, -1)).filter(k => !k.endsWith('.')))];
const absent = used.filter(k => !tri(k)); ok('every literal r.* key used by the code exists', !absent.length, absent.join(' '));
['kind', 'lk', 'rel', 'st', 'invc', 'miss', 'missw', 'sc', 'ind', 'fl', 'short'].forEach(g => ok(`group r.${g}.* present`, Object.keys(dict).some(k => k.startsWith(`r.${g}.`))));
Object.keys(R.KIND).forEach(k => ok('kind label ' + k, tri('r.kind.' + k)));
R.MISS.forEach(k => ok('missing-data item ' + k, tri('r.miss.' + k) && tri('r.missw.' + k)));
// data file
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', 'research.json'), 'utf8'));
const FIVE = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares'];
ok('research.json: five towns + Granada', FIVE.concat(['Granada']).every(n => D.munis[n]));
ok('population series 1996–2025 for each', FIVE.every(n => D.munis[n].pop['1996'] > 0 && D.munis[n].pop['2025'] > 0));
ok('pyramids 2012 and 2022 (21 groups × 2 sexes)', FIVE.every(n => ['2012', '2022'].every(y => D.munis[n].pyr[y].Hombres.length === 21 && D.munis[n].pyr[y].Mujeres.every(v => v >= 0))));
ok('base area 371 ha split across municipalities', Math.abs(Object.values(D.base.by_muni).reduce((a, b) => a + b, 0) - D.base.area_ha) < 2, JSON.stringify(D.base.by_muni));
// 5.53: coverage by buildings, not by area — Las Gabias and Alhendín have ≥ 99 % of their buildings in the frame, so they get figures
// (flagged frame_part); Granada (≈ 24 % in the frame) stays null — missing, never 0
ok('Las Gabias and Alhendín: figures for the part inside the frame (≥ 95 % of their buildings), flagged', ['Las Gabias', 'Alhendín'].every(n => D.munis[n].sp.bld_frame_pct >= 95 && D.munis[n].sp.frame_part === true && D.munis[n].sp.lst > 0 && D.munis[n].sp.ghs_pop > 0 && D.munis[n].sp.n_square != null));
ok('Granada (mostly outside the frame): frame figures stay null, never 0', D.munis.Granada.sp.lst === null && D.munis.Granada.sp.ghs_pop === null);
const GR = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ref', 'research_growth.json'), 'utf8'));
ok('town outlines by year: 5 towns × 7 years (1996–2025), each growing or equal', FIVE.every(n => { const a = GR.features.filter(f => f.properties.name === n).sort((x, y) => x.properties.y - y.properties.y); return a.length === 7 && a.every((f, i) => !i || f.properties.ha >= a[i - 1].properties.ha - 0.5); }));
ok('RD 511/1989 runway thresholds 676 m / 700 m', D.rd1989.thr18[2] === 676 && D.rd1989.thr36[2] === 700);
// every source key of every slide resolves (research.json sources or the module's layer sources)
const unknown = []; CH.forEach(c => c.slides.forEach(s => (s.src || []).forEach(k => { if (!D.sources[k] && !['base_edge', 'towns', 'history', 'ams', 'pnoa', 'noise', 'water', 'flow', 'landuse', 'fac', 'stay', 'centre', 'human', 'ghs', 'lstimg', 'ndvi', 'wcimg', 'tour_area', 'metro', 'band1981', 'routes', 'scen', 'proj', 'photos'].includes(k)) unknown.push(s.id + ':' + k); })));
ok('every slide source resolves', !unknown.length, unknown.join(' '));
Object.entries(D.sources).forEach(([k, s]) => ok('source ' + k + ' has kind, year and method', Object.keys(R.KIND).includes(s.kind) && s.year && s.method));
// inventory rows: 8 columns, a known kind, reliability and status
ok('inventory rows well formed', R.INV.every(r => r.length === 8 && R.KIND[r[4]] && ['high', 'med', 'low'].includes(r[5]) && ['used', 'unused'].includes(r[7])), R.INV.length + ' rows');
// colours only from the palette
const hex = (fs.readFileSync(path.join(ROOT, 'js', 'tour_research.js'), 'utf8').match(/#[0-9A-Fa-f]{6}\b/g) || []);
ok('no hard-coded colours in tour_research.js', !hex.length, hex.join(' '));
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
