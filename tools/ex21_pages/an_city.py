"""Exercise 2.1 — the city maps in the ANALYSIS print style (owner, 20 Nov 2026): black, greys and white, ONE red per map.
One sheet per map at TRUE 1:10,000 (the frame 6400 x 5600 m = 640 x 560 mm), English only:
  island   01  the closed island            red = the base
  walk     02  walking                      red = the two detours and the dead ends (the straight lines black, dashed)
  growth   03  growing towns and the metro  red = the metro (line 1 and its extension); the towns' change 2015→2025 in black
  height   04  the ceiling                  red = the height limits (one ramp of the red, darker = lower)
  strategy 05  the strategy (proposal)      red = the proposal (strip, joined dead ends, four places, corridor), drawn schematically
  key          where the 1:500 areas sit    red = the windows (1:25,000, 256 x 224 mm)
  gaps         the gaps panel               three small maps of the agglomeration at 1:500,000 and the bars (A3 landscape)
The furniture (title block, corner marks, key, notes, sources) comes from tools/ex21_pages/_analysis.py; the maps from
GA.ex21.draw* after GA.ex21.setStyle('analysis'). Every number in a note is read from the data at run time, never typed in
(counts, km, ratios, shares; the "80 m" of the dead ends is read from the layer's method text in data/manifest.json).
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/an_city.py <out folder> [island,walk,…]   (env DPI, default 200)"""
import sys, time, subprocess, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _analysis import AN_JS, launch, save
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; ALL = ['island', 'walk', 'growth', 'height', 'strategy', 'key', 'gaps']; ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else ALL
DPI = float(os.environ.get('DPI', 200)); PORT = 8863
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([m, DPI]) => { await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); GA.ex21.setStyle('analysis'); ''' + AN_JS + r'''
  const t = (k, v) => GA.i18n.t(k, v), D0 = GA.ex21.data, E = GA.ex21.CITY, mm = AN.mm; const KF = AN.K;   // the line and label weight of a 1:10,000 map
  const base = D0.edge.find(f => f.p.k === 'base').p, C = AN.pal.ex21, SERIES = 'EX 2.1 · CITY · 1:10,000';
  // what a map's title says after its number ("01 · The closed island: …" → "THE CLOSED ISLAND", "the base, its 300 m band …")
  const split = (s) => { const q = s.replace(/^\d+\s*·\s*/, ''); const i = q.indexOf(': '); return i > 0 ? [q.slice(0, i).toUpperCase(), q.slice(i + 2).trim()] : [q.toUpperCase(), '']; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // a figure stays on one line with its unit (a no-break space: the paragraphs wrap at ordinary spaces only)
  const NB = String.fromCharCode(160), nb = (s) => s.replace(/(\d) (%|km²|km|min|m)(?=[\s,.;:)]|$)/g, '$1' + NB + '$2');
  const fmt = (v) => Math.round(v).toLocaleString('en-US'), sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + ' %';
  const towns5 = D0.edge.filter(f => f.p.k === 'town').map(f => f.p.nm), deadEnds = D0.edge.filter(f => f.p.k === 'deadend').length;
  // a string of another sheet family's group (x41.time.*), so the same thing reads the same on every sheet; fb = the wording if the key is gone
  const tf = (k, v, fb) => { const s = t(k, v); return s === k ? fb : s; };
  // the grey ground every map is printed on, as key rows (the same colours, widths and dashes drawCity draws)
  const ground = (muni) => [{ sw: C.built, label: t('x34.lg.built') }, { line: C.street, wk: 0.9, label: t('x40.lg.roads') }].concat(muni === false ? [] : [{ line: C.muni, wk: 1.1, dk: [6, 4], label: tf('x41.time.muni', null, 'Municipal boundary (IGN via es-atlas, simplified)') }])
    .concat([{ line: C.runway, wk: 1.2, dk: [10, 6], label: 'Runway axis, between its two thresholds (RD 118/2019, art. 3)' }]);
  const GROUND = ' Ground: buildings and main roads from OpenStreetMap, municipal boundaries from IGN via es-atlas, printed in grey; the base is drawn as a white void behind its fence (a black line with white dashes).';
  const city = (x, bx, by, bw, bh, opt) => GA.ex21.drawCity(x, bx, by, bw, bh, Object.assign({ t, k: KF, noNorth: true, noScale: true, tidy: true }, opt));
  // the five city sheets share ONE trim size (712.8 x 772.8 mm): the block under the map is as tall as the longest key needs (the strategy's
  // ten rows = 60 mm x u); a shorter sheet gets the difference as white above its sources
  const UNDER = 60, page = (o) => { const own = Math.max(Math.ceil((o.key || []).length / 2) * 5.4 + 6, (o.noteH || 40 * 1.4) / 1.4);
    return AN.mapSheet(Object.assign({ mapW: 640, mapH: 560, u: 1.4, code: SERIES, metres: 1000, pxPerM: mm(640) / 6400, scale: '1:10,000', keyCols: 2, kk: KF * 0.8, addH: Math.max(0, UNDER - own) * 1.4 }, o, { notes: (o.notes || []).map(q => [q[0], nb(q[1]), q[2]]) })); };

  if (m === 'island') { const [ttl, sub] = split(t('x34.m.island'));
    const fence = D0.edge.filter(f => f.p.k === 'fence'); const len = {}; let tot = 0; fence.forEach(f => f.g.forEach(r => { for (let i = 1; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); len[f.p.c] = (len[f.p.c] || 0) + d; tot += d; } }));
    const pc = (c) => Math.round((len[c] || 0) / tot * 100);
    const c = await page({ title: ttl, sub: cap(sub), num: '01 / 05', key: GA.ex21.mapLegend('island', t).concat(ground()),
      draw: (x, bx, by, bw, bh) => city(x, bx, by, bw, bh, { only: 'island' }),
      notes: [['THE ISLAND', `${GA.ex21.km2(base.area_ha)} km² of closed land behind ${base.perimeter_km} km of fence, in the middle of five towns that keep growing.`, true],
        ['WHAT LIES ALONG THE FENCE', `By length of fence (OSM land use just outside it): housing ${pc('housing')} %, open land ${pc('open')} %, a main road ${pc('road')} %, industry ${pc('industry')} %, parks or green ${pc('green')} %.`]],
      src: t('x34.src.island') + ' The 300 m band is a distance drawn from the outline, not a legal zone. Municipal boundaries: IGN via es-atlas. Printed in black, greys and one red; the base is drawn as a white void behind its fence.' });
    return c.toDataURL('image/png'); }

  if (m === 'walk') { const [ttl, sub] = split(t('x34.m.walk')); const MAN = await fetch('data/manifest.json').then(r => r.json()).catch(() => null);
    const plain = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(), townOf = (id) => towns5.find(n => plain(n).split(' ').includes(id)) || id;   // 'alhendin' → 'Alhendín'
    const routes = D0.edge.filter(f => f.p.k === 'route').map(f => { const [a, b] = f.p.r.split('_').map(townOf); return `${a} → ${b}: ${(f.p.walk_m / 1000).toFixed(1)} km on foot against ${(f.p.straight_m / 1000).toFixed(1)} km in a straight line (×${f.p.ratio.toFixed(2)})`; });
    const near = MAN && /within (\d+) m of the fence/.exec(((MAN.layers || {}).base_edge || {}).method || '');
    const c = await page({ title: ttl, sub: cap(sub), num: '02 / 05', key: GA.ex21.mapLegend('walk', t).concat(ground()),
      draw: (x, bx, by, bw, bh) => city(x, bx, by, bw, bh, { only: 'walk' }),
      notes: [['THE DETOUR', `The shortest way on foot around the base (OSM walking network). ${routes.join('. ')}.`, true],
        ['DEAD ENDS AT THE FENCE', `${deadEnds} streets and paths stop at the fence: the ends of the walking network found outside the base${near ? `, within ${near[1]} m of the fence` : ''}.`, true]],
      src: t('x34.src.walk') + GROUND });
    return c.toDataURL('image/png'); }

  if (m === 'growth') { const [ttl] = split(t('x34.m.growth')); const L1 = D0.l1.meta, trk = D0.metro.find(f => f.p.k === 'track');
    const five = D0.area.filter(a => a.p.five).sort((a, b) => b.p.chg - a.p.chg), p15 = five.reduce((s, a) => s + a.p.pop2015, 0), p25 = five.reduce((s, a) => s + a.p.pop2025, 0), gr = D0.area.find(a => a.p.name === 'Granada');
    const key = GA.ex21.mapLegend('growth', t); key.splice(3, 0, { sym: 'stop', line: AN.RED, label: 'Stops of line 1 (OSM); the two larger rings are the ends of the extension' });
    const c = await page({ title: ttl, sub: 'Residents 2015→2025 in each of the five towns (INE), and line 1 of the Metro de Granada with its extension (OSM)', num: '03 / 05', key: key.concat(ground(false)), noteH: 46 * 1.4,
      draw: (x, bx, by, bw, bh) => city(x, bx, by, bw, bh, { only: 'growth' }),
      notes: [['THE METRO', `Line 1 today: ${L1.stops.length} stops, ${L1.duration_min} min from ${L1.from} to ${L1.to}, every ${L1.interval_min} min (as tagged in OSM, not a timetable). Its extension to Las Gabias, ${(trk.p.len_m / 1000).toFixed(1)} km, is under construction in OSM. The new stops are not drawn: no source publishes their positions with a reuse licence.`, true],
        ['THE TOWNS', `Residents 1 Jan 2015 → 1 Jan 2025 (INE): ${five.map(a => `${a.p.name} ${sg(a.p.chg)}`).join(', ')}. The five together: ${fmt(p15)} → ${fmt(p25)} (${sg((p25 / p15 - 1) * 100)}). Granada city in the same years: ${sg(gr.p.chg)}.`]],
      src: t('x34.src.growth') + ' Inset: the whole line 1 and the extension; grey = the municipality of Granada, black = the base.' + GROUND });
    return c.toDataURL('image/png'); }

  if (m === 'height') { const [ttl, sub] = split(t('x34.m.height')); const e = D0.ease.extent, im = D0.hImg, s = im.naturalWidth / (e[2] - e[0]);
    // the share of this frame under each ceiling: counted on the picture itself (its own grid), the base's land left out
    const fw = Math.round((E.x1 - E.x0) * s), fh = Math.round((E.y1 - E.y0) * s), cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, -(E.x0 - e[0]) * s, -(e[3] - E.y1) * s); const px = g.getImageData(0, 0, fw, fh).data; g.clearRect(0, 0, fw, fh); g.beginPath();
    D0.edge.find(f => f.p.k === 'base').g.forEach(r => r.forEach((p, i) => { const u = (p[0] - E.x0) * s, v = (E.y1 - p[1]) * s; if (i) g.lineTo(u, v); else g.moveTo(u, v); })); g.closePath(); g.fillStyle = '#FFFFFF'; g.fill('evenodd'); const bm = g.getImageData(0, 0, fw, fh).data;
    const cls = D0.ease.classes, n = {}; let out = 0; cls.forEach(c => { n[c[2]] = 0; });
    for (let i = 0; i < px.length; i += 4) { if (bm[i + 3] > 127) continue; out++; if (px[i + 3] < 8) continue; let best = null, bd = 1e9; cls.forEach(c => { const q = (c[3][0] - px[i]) ** 2 + (c[3][1] - px[i + 1]) ** 2 + (c[3][2] - px[i + 2]) ** 2; if (q < bd) { bd = q; best = c[2]; } }); n[best]++; }
    const pc = (c) => n[c] / out * 100, f1 = (v) => (v < 10 ? v.toFixed(1) : String(Math.round(v))), all = cls.reduce((a, c) => a + n[c[2]], 0) / out * 100, outKm2 = out / (s * s) / 1e6;
    const tw = D0.ease.towns, byH = Object.keys(tw).sort((a, b) => tw[a].allowed - tw[b].allowed);
    const c = await page({ title: ttl, sub: cap(sub), num: '04 / 05', key: GA.ex21.mapLegend('height', t).concat(ground()), noteH: 52 * 1.4,
      draw: (x, bx, by, bw, bh) => city(x, bx, by, bw, bh, { only: 'height' }),
      notes: [['THE CEILING', `Allowed height above the ground, drawn where the limit surface leaves less than 60 m: one red, darker = lower. Of the ${outKm2.toFixed(1)} km² of this frame outside the base, about ${Math.round(all)} % lie under such a ceiling: ${f1(pc('30-60'))} % with 30–60 m, ${f1(pc('15-30'))} % with 15–30 m, ${f1(pc('0-15'))} % with less than 15 m, and on ${f1(pc('above'))} % the ground is already above the surface (counted on this picture).`, true],
        ['AT THE TOWN CENTRES', `Limit surface minus ground at each town's centre point: ${byH.map(nm => `${nm} ≈ ${tw[nm].allowed} m`).join(', ')}.`]],
      src: t('x34.src.height') + GROUND });
    return c.toDataURL('image/png'); }

  if (m === 'strategy') { const [ttl, sub] = split(t('x38.title')), TDd = GA.ex21.time, S = AN.pal.ex21s;
    // the key in reading order: the proposal (red) first, then what it stands on. The same items as GA.ex21.strategyLegend, regrouped.
    const all = GA.ex21.strategyLegend(t), used = new Set(), take = (f) => all.filter(it => !used.has(it) && f(it) && used.add(it));
    const prop = take(it => it.line === S.strip || it.stroke === S.corridorLine), nums = take(it => it.num != null), bs = take(it => it.base), met = take(it => it.line === C.metro), open = take(() => true);
    const above = TDd && TDd.edge_ha ? TDd.edge_ha.above : 0; if (above) open.push({ sw: GA.ex21.an.edgeCtx.above, alpha: 0.45, label: tf('x41.time.above', { ha: GA.ex21.km2(above) }, `Open land, ground already above the height-limit surface: ${GA.ex21.km2(above)} km²`) });
    met.forEach(it => { it.label = it.label.replace(/,? with its stops/, ''); });   // (this map draws the line without its stops)
    const g = ground();   // first column: the proposal, its four places, the ground; second column: the base, the metro, the open-land cells
    const c = await page({ title: ttl, sub: cap(sub), num: '05 / 05', key: prop.concat(nums, g.slice(0, 3), bs, g.slice(3), met, open), noteH: 56 * 1.4,
      draw: (x, bx, by, bw, bh) => GA.ex21.drawStrategy(x, bx, by, bw, bh, { t, k: KF, noNorth: true, noScale: true, tidy: true }),
      notes: [['THE PROPOSAL — DRAWN SCHEMATICALLY', `The base stays; its edges open. A public walking strip outside the whole fence (${base.perimeter_km} km round), the ${deadEnds} dead ends of today joined to it, the four places it links (1–4) and a green corridor between Ogíjares and Alhendín past the base's south tip. A proposal drawn on today's map: not an approved plan, not a survey.`, true],
        ['THE GREY CELLS', `Open land next to the towns today, in 100 m cells, darker where the aeronautical ceiling is lower: open cells beside built cells, a reading of today's map and not a plan.`]],
      src: t('x38.src') + GROUND });
    return c.toDataURL('image/png'); }

  if (m === 'key') { const AR = GA.ex21.areas.areas, [ttl] = split(t('x34.key.title')), side = AR[0].side_m, k25 = mm(256) / 1000;
    const items = GA.ex21.keyLegend(t), win = items.filter(it => it.stroke === AN.RED), names = AR.map(a => ({ num: a.id, label: t('x34.a.' + a.id).replace(/^\S+\s*·\s*/, '') }));
    const c = await AN.mapSheet({ mapW: 256, mapH: 224, u: 1, title: ttl, sub: `${AR.length} windows of ${side} × ${side} m on the fence; each is drawn at 1:500 with a section across the fence`, code: 'EX 2.1 · KEY MAP', num: '1:25,000 · 01 / 01',
      metres: 1000, pxPerM: mm(256) / 6400, scale: '1:25,000', keyCols: 2, kk: k25 * 0.8, key: win.concat(items.filter(it => !win.includes(it)), ground()),
      draw: (x, bx, by, bw, bh) => GA.ex21.drawAreaKey(x, bx, by, bw, bh, { t, k: bw / 1000, noNorth: true, noScale: true }),
      extraH: 40, extra: (x, px, py, wmm) => { AN.txt(x, `+ THE ${AR.length} AREAS`, px, py, 2.6, 700, AN.RED); return AN.key(x, names, px, py + mm(7), { cols: 2, colW: wmm / 2, sw: 6 }); },
      src: 'Sources: OpenStreetMap contributors (ODbL): buildings, streets, the base outline and what lies along it; the base edge and the 300 m band are derived from OSM (the band is a distance drawn from the outline, not a legal zone). Municipal boundaries: IGN via es-atlas. Printed in black, greys and one red; the base is drawn as a white void behind its fence.' });
    return c.toDataURL('image/png'); }

  if (m === 'gaps') { AN.u = 1; const Wmm = 420, Hmm = 297, L = 28, R = 22, [c, x] = AN.sheet(Wmm, Hmm), W = c.width, H = c.height, T = AN.pal.tour, [ttl, sub] = split(t('x34.gap.title'));
    AN.head(x, W, { title: ttl, sub: cap(sub), code: 'EX 2.1 · THE GAPS', num: '1:500,000 · 01 / 01', left: L, right: R, top: 22 });
    // three windows at 1:500,000 (1 km = 2 mm); kq = the line and label unit of the small maps and of the bars
    const gp = 11, ww = (Wmm - L - R - 2 * gp) / 3, wh = 108, top = 50, pxPerM = mm(1000) / 500000, kq = mm(0.27), eu = (v) => '€' + fmt(v), pl = (v) => (v ? '+' + v : '0');
    const vars = [['chg', T.chgBreaks, T.chg, 'x34.gap.chg', (lo, hi) => lo == null ? 'Fewer residents than in 2015' : hi == null ? `${pl(lo)} % or more` : `${pl(lo)} to ${pl(hi)} %`, '0 %'],
      ['inc', T.incBreaks, T.inc, 'x34.gap.inc', (lo, hi) => lo == null ? `Under ${eu(hi)}` : hi == null ? `${eu(lo)} or more` : `${eu(lo)} to ${eu(hi)}`, '€0'],
      ['rent', T.rentBreaks, T.rent, 'x34.gap.rent', (lo, hi) => lo == null ? `Index under ${hi}` : hi == null ? `${lo} or more` : `${lo} to ${hi}`, '100']];
    const barsH = 36; let yEnd = 0;
    vars.forEach((v, i) => { const bx = Math.round(mm(L + i * (ww + gp))), by = Math.round(mm(top)), bw = Math.round(mm(ww)), bh = Math.round(mm(wh)), V = [bx, by, bx + bw, by + bh];
      AN.txt(x, '+ ' + t(v[3]).toUpperCase(), bx, by - mm(5.5), 2.6, 700, AN.INK);
      const r = GA.ex21.drawGaps(x, bx, by, bw, bh, { t, k: kq, part: 'map', key: v[0], sc: pxPerM }); if (!r || !r.fits) throw new Error('the gaps map does not fit its window');
      AN.frame(x, V); const ys = AN.scale(x, V, pxPerM, 10000, { scale: '1:500,000', labels: [['0', 0], ['5', 0.5], ['10 km', 1]], dy: 7 });
      // the key of this map: its classes (the same breaks and colours the map is drawn from), and the hatch where a value is missing
      const items = v[2].map((col, j) => ({ sw: col, label: v[4](j ? v[1][j - 1] : null, j < v[1].length ? v[1][j] : null) })).concat(r.missing ? [{ hatch: T.missing, dir: 1, label: `No index published (${r.missing} of ${r.n})` }] : []);
      const yk = AN.key(x, items, bx, ys + mm(7), { cols: 2, colW: ww / 2, kk: kq }), yb = yk + mm(5);
      // the same value as bars: Granada city and the five towns; a thin line marks where the bars start (the rent index starts at 100 = 2015)
      const b = GA.ex21.drawGaps(x, bx, yb, bw, mm(barsH), { t, k: kq, part: 'bars', key: v[0] });
      x.save(); x.strokeStyle = AN.INK; x.lineWidth = Math.max(1, mm(0.2)); x.beginPath(); x.moveTo(b.x0, yb); x.lineTo(b.x0, yb + mm(barsH)); x.stroke(); x.restore(); AN.txt(x, v[5], b.x0, yb - mm(1.4), 2.2, 500, AN.GR, 'center');
      yEnd = Math.max(yEnd, yb + mm(barsH)); });
    // what the three maps share
    let y = AN.key(x, [{ sw: C.base, label: t('x34.base') + ' (OSM outline)' }, { line: AN.INK, wk: 1.8, label: 'The five towns around the base' }, { line: C.metro, wk: 2.4, dk: [4.5, 2.8], label: 'Granada city (the municipality)' }], mm(L), yEnd + mm(9), { cols: 3, colW: ww + gp, kk: kq });
    const five = D0.area.filter(a => a.p.five), gr = D0.area.find(a => a.p.name === 'Granada'), p15 = five.reduce((s, a) => s + a.p.pop2015, 0), p25 = five.reduce((s, a) => s + a.p.pop2025, 0), lo = (k0) => Math.min(...five.map(a => a.p[k0])), hi = (k0) => Math.max(...five.map(a => a.p[k0]));
    AN.note(x, mm(L), y + mm(5), Wmm - L - R, 'THE GAP', nb(`Residents 2015→2025: the five towns together ${sg((p25 / p15 - 1) * 100)} (${fmt(p15)} → ${fmt(p25)}), Granada city ${sg(gr.p.chg)}. Net income per person in ${gr.p.incYear}: ${eu(lo('inc'))} to ${eu(hi('inc'))} in the five towns, ${eu(gr.p.inc)} in the city. Rent index ${gr.p.rentYear} (2015 = 100): ${lo('rent')} to ${hi('rent')} in the towns, ${gr.p.rent} in the city — the index measures the change since 2015, not the level of rent.`));
    AN.src(x, W, H, t('x34.src.gaps') + ' One ramp of the red per value; grey = fewer residents than in 2015; grey hatch = no value. Bars: Granada city and the five towns, coloured by the same classes.', { left: L, right: R });
    return c.toDataURL('image/png'); }
  throw new Error('not written yet: ' + m); }'''
try:
  with sync_playwright() as p:
    b, pg, errs = launch(p, PORT)
    for m in ONLY:
      n = {'island': '01_island', 'walk': '02_walk', 'growth': '03_growth', 'height': '04_ceiling', 'strategy': '05_strategy', 'key': '06_key_map', 'gaps': '07_gaps'}[m]
      save(pg.evaluate(JS, [m, DPI]), os.path.join(OUTD, f'an_city_{n}.png')); print(m, 'ok', flush=True)
    print('errors:', errs[:5])
finally: srv.terminate()
