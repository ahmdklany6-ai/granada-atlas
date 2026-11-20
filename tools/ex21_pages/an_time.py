"""Exercise 2.1 — the base over time in the ANALYSIS print style (owner, 20 Nov 2026): black, greys and white, ONE red per map.
English only. Four sheets, series "EX 2.1 · TIME" (the content of tools/ex21_pages/time.py, restyled):
  history  01  the same frame in ten pictures, 1931 → 2022 (five columns × two rows; each frame 150 × 131.25 mm = 1:42,667):
               every picture printed in grey, today's fence black and white on each     red = each town's built-up edge at the picture's date
  built    02  how the built-up grew (1:10,000, 640 × 560 mm) + dwellings by decade     red = built since 2000 (grey = before 2000)
  density  03  crowding: dwellings per km² + residents 1996–2025                         red = the dwellings per km² (one ramp)
  edge     04  how it could grow: open land next to the towns + residents to 2045       red = open land under the aeronautical ceiling (one ramp)
  frames       each of the ten pictures alone (1600 × 1400 px, its date written on it) into <out>/frames/, for a film or a GIF
The furniture (title block, corner marks, key, notes, sources) comes from tools/ex21_pages/_analysis.py; the maps and charts from
GA.ex21.drawTime / drawDwellChart / drawPopChart after GA.ex21.setStyle('analysis'). Every number on a sheet is read from
data/ex21/time.json or data/ex21/town_edges.json at run time (or sits in an i18n string of js/i18n_v33.js), never typed in.
The pictures are exports/ex21_time/hist/*.jpg (IGN WMS, as served); they are printed in grey, nothing in them is edited.
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/an_time.py <out folder> [history,built,density,edge,frames]   (env DPI, default 200)"""
import sys, time, subprocess, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _analysis import AN_JS, launch, save
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; ALL = ['history', 'built', 'density', 'edge']; ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else ALL
DPI = float(os.environ.get('DPI', 200)); PORT = 8864
# picture key (file name and key of town_edges.json) · the date IGN publishes · map or photo · the series' name as in the source sentence (x36.hist.src)
HIST = [('mtn50', '1931', 'map', 'MTN50, first edition'), ('ams1956', '1956–1957', 'photo', 'American flight'), ('inter1973', '1973–1986', 'photo', 'Interministerial flight'),
        ('nac1981', '1981–1986', 'photo', 'Nacional flight'), ('olistat1997', '1997–1998', 'photo', 'OLISTAT flight'), ('sigpac2000', '1997–2003', 'photo', 'SIGPAC flight'),
        ('pnoa2004', '2004', 'photo', 'PNOA'), ('pnoa2010', '2010', 'photo', 'PNOA'), ('pnoa2016', '2016', 'photo', 'PNOA'), ('pnoa2022', '2022', 'photo', 'PNOA')]
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([m, DPI, HIST, one]) => { await GA.ex21.ready(); await GA.ex21.readyTime(); await GA.ex21.readyTownEdges(); GA.ex21.setStyle('analysis'); ''' + AN_JS + r'''
  const t = (k, v) => GA.i18n.t(k, v), TD = GA.ex21.time, TE = GA.ex21.townEdges, FIVE = GA.ex21.TFIVE, mm = AN.mm, km2 = GA.ex21.km2, n0 = (v) => Math.round(v).toLocaleString('en-US');
  const KF = 3.8 * DPI / 200; const SERIES = 'EX 2.1 · TIME';   // KF = the line and label weight of a 1:10,000 map
  const split = (s) => { const i = s.indexOf(':'); return i > 0 ? [s.slice(0, i).toUpperCase(), s.slice(i + 1).trim()] : [s.toUpperCase(), '']; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });
  const pic = (h) => load('/exports/ex21_time/hist/' + h[0] + '.jpg');
  const lab = (h) => h[0] === 'mtn50' ? t('x36.hist.1931', { ha: km2(TD.aerodrome_1931_ha) }) : h[1];
  const growth = t('x36.box.growth', { a: km2(TD.aerodrome_1931_ha), b: km2(TD.base_ha_today) });
  const PRINT = ' Printed in black, greys and one red; the base is drawn as a white void behind its fence.';
  // ---- one picture alone, its date written on it (for a film or a GIF) ----
  if (m === 'frame') { const h = HIST[one], c = document.createElement('canvas'); c.width = 1600; c.height = 1400; const x = c.getContext('2d');
    GA.ex21.drawTime(x, 0, 0, 1600, 1400, { t, only: 'photo', photo: await pic(h), k: 1.6, title: lab(h), titlePx: 56, edges: h[0] }); return c.toDataURL('image/png'); }
  // ---- 01 the same frame in ten pictures ----
  if (m === 'history') { AN.u = 1.4; const u = AN.u, E = GA.ex21.CITY, cols = 5, fw = 150, fh = fw * (E.y1 - E.y0) / (E.x1 - E.x0), gx = 13, capH = 13 * u, gy = 9 * u, L = 30 * u, R = 22 * u, top = 46 * u; const imgs = await Promise.all(HIST.map(pic));
    const gridW = cols * fw + (cols - 1) * gx, rows = Math.ceil(HIST.length / cols), footY = top + rows * (fh + capH) + (rows - 1) * gy, wmm = L + gridW + R, hmm = footY + 72 * u;
    const [c, x] = AN.sheet(wmm, hmm), W = c.width, H = c.height; const KH = mm(fw) / 1000 * 1.5, den = '1:' + n0((E.x1 - E.x0) / (fw / 1000));   // 6400 m on 150 mm
    AN.head(x, W, { title: t('x36.hist.title').toUpperCase(), sub: t('x41.hist.sub'), code: SERIES + ' · ' + den, num: '01 / 04', left: L, right: R });
    HIST.forEach((h, i) => { const fx = mm(L + (i % cols) * (fw + gx)), fy = mm(top + Math.floor(i / cols) * (fh + capH + gy)), bw = Math.round(mm(fw)), bh = Math.round(mm(fh));
      GA.ex21.drawTime(x, fx, fy, bw, bh, { t, only: 'photo', photo: imgs[i], k: KH, noScale: true, noNorth: true, edges: h[0] }); AN.frame(x, [fx, fy, fx + bw, fy + bh]);
      // the caption: the date IGN publishes for the picture, what it is, and the year its red edges are drawn for (town_edges.json)
      const s = lab(h), j = s.indexOf(' · '), date = j > 0 ? s.slice(0, j) : s, rest = j > 0 ? s.slice(j + 3) : ''; const cy = fy + bh + mm(6.2 * u);
      AN.txt(x, date, fx, cy, 3.1 * u, 700, AN.INK); const dw = AN.width(x, date, 3.1 * u, 700);
      AN.txt(x, (rest ? cap(rest) : (h[2] === 'map' ? 'Map' : 'Aerial photo') + ' · ' + h[3]), fx + dw + mm(3 * u), cy, 2.5 * u, 500, AN.GR, 'left', bw - dw - mm(3 * u));
      AN.txt(x, (rest ? h[3] + ' · ' : '') + 'red edge drawn for ' + TE.years[h[0]], fx, cy + mm(4.4 * u), 2.5 * u, 500, AN.GR, 'left', bw); });
    // under the pictures: scale and north (the same for all ten), then the key at the left and the notes in three columns
    const bx = mm(L); const y = AN.scale(x, [bx, 0, bx, mm(footY)], mm(fw) / (E.x1 - E.x0), 1000, { dy: 12, scale: den + ' · the same frame in every picture, ' + (E.x1 - E.x0) / 1000 + ' × ' + (E.y1 - E.y0) / 1000 + ' km' }) + mm(9 * u);
    AN.key(x, [{ fence: true, label: 'The base fence today (OSM), drawn over every picture' }, GA.ex21.townEdgeLegend(t, HIST[0][0])[0]], bx, y, { cols: 1, colW: 300, kk: KH });
    const nw = 150, ng = 12, nx = (i) => bx + mm(gridW - (3 - i) * nw - (2 - i) * ng);
    AN.note(x, nx(0), y, nw, 'THE EDGES', cap(t('x39.lg')) + '.', AN.RED); AN.note(x, nx(1), y, nw, 'DATES AND GAPS', t('x39.note')); AN.note(x, nx(2), y, nw, 'THE BASE', growth + '.');
    AN.src(x, W, H, 'Sources: ' + t('x36.hist.src') + ' Town edges: ' + TE.source + '. Fence: OpenStreetMap contributors (ODbL). The pictures are printed in grey (greyscale and a white veil); nothing in them is edited.', { left: L, right: R });
    return c.toDataURL('image/png'); }
  // ---- 02–04 one map at 1:10,000 with its chart and its numbers ----
  const NW = 190 * 1.4, CH = 92;   // the notes column (as AN.mapSheet's) and the chart's height, mm
  const page = (o) => AN.mapSheet(Object.assign({ mapW: 640, mapH: 560, u: 1.4, code: SERIES + ' · 1:10,000', metres: 1000, pxPerM: mm(640) / 6400, scale: '1:10,000', keyCols: 2, kk: KF * 0.8, noteW: NW,
    draw: (x, bx, by, bw, bh) => GA.ex21.drawTime(x, bx, by, bw, bh, { t, only: m, k: KF, noNorth: true, noScale: true }) }, o));
  // under the key: the chart at the left (as wide as the key) with its heading, its notes in the notes column at the right
  const block = (head, towns, draw, notes) => { const u = 1.4, hs = head.split('; ');
    return { extraH: (2 + 5 + (hs[1] ? 5 : 0) + (towns ? 8 : 0) + 4) * u + CH, extra: (x, px, py, wmm) => { const cw = wmm - NW - 12 * u; let y = py + mm(2 * u);
      AN.txt(x, '+ ' + hs[0].toUpperCase(), px, y, 2.6 * u, 700, AN.INK); y += mm(5 * u); if (hs[1]) { AN.txt(x, cap(hs[1]), px, y, 2.75 * u, 400, AN.GR); y += mm(5 * u); }
      if (towns) { const col = GA.ex21.tcol(); AN.key(x, FIVE.map(tn => ({ sw: col[tn], label: tn })), px, y + mm(1.5 * u), { cols: 5, colW: cw / 5 }); y += mm(8 * u); }
      draw(x, px, y, mm(cw), mm(CH), mm(2.5 * u) / 9); let yn = py + mm(2 * u); (notes || []).forEach(([h0, b0, red]) => { yn = AN.note(x, px + mm(wmm - NW), yn, NW, h0, b0, red ? AN.RED : AN.INK); });
      return Math.max(y + mm(CH), yn); } }; };
  if (m === 'built') { const [ttl, sub] = split(t('x36.m.built')), fp = TD.footprint_ha_by_period; const since = TD.periods.filter(q => q[1] >= 2000).reduce((a, q) => a + (fp[q[0]] || 0), 0), all = Object.values(fp).reduce((a, v) => a + v, 0);
    const d2000 = FIVE.reduce((a, tn) => a + (TD.towns[tn].dwellings_by_decade['2000'] || 0), 0), dall = FIVE.reduce((a, tn) => a + TD.towns[tn].dwellings, 0);
    const c = await page(Object.assign({ title: ttl, sub: cap(sub), num: '02 / 04', key: GA.ex21.timeLegend('built', t),
      notes: [['BUILT SINCE 2000', `${km2(since)} km² of the ${km2(all)} km² of building footprints standing in this frame carry a year of construction from 2000 on (${Math.round(since / all * 100)} %; Catastro).`, true]],
      src: t('x36.src.built') + ` Buildings with no year on record (${km2(fp.none || 0)} km² of footprints) are left white. Streets: OpenStreetMap contributors (ODbL).` + PRINT },
      block(t('x36.ch.dw'), true, (x, px, py, w, h, k) => GA.ex21.drawDwellChart(x, px, py, w, h, { t, k, markFrom: TD.periods.filter(q => q[1] >= 2000)[0][1] }),
        [['THE 2000s', `Of the ${n0(dall)} dwellings recorded today in the five towns, ${n0(d2000)} are in buildings dated 2000–2009 (${Math.round(d2000 / dall * 100)} %).`], ['THE BASE', growth + '.']])));
    return c.toDataURL('image/png'); }
  if (m === 'density') { const [ttl, sub] = split(t('x36.m.density'));
    const c = await page(Object.assign({ title: ttl, sub: cap(sub), num: '03 / 04', key: GA.ex21.timeLegend('density', t),
      notes: [['CROWDING', `One cell is 100 × 100 m. Half of the cells that hold homes have fewer than ${n0(TD.base_scenario.median_dw_per_ha * 100)} dwellings per km² (the median of the frame).`, true]],
      src: t('x36.src.density') + ' Buildings, streets and the base: OpenStreetMap contributors (ODbL).' + PRINT },
      block(t('x36.ch.pop0'), false, (x, px, py, w, h, k) => GA.ex21.drawPopChart(x, px, py, w, h, { t, k, noProj: true }),
        [['RESIDENTS PER DWELLING', FIVE.map(tn => tn.replace(' de la Vega', '') + ' ' + TD.towns[tn].persons_per_dwelling).join(' · ') + ' — ' + t('x36.ppd') + '.']])));
    return c.toDataURL('image/png'); }
  if (m === 'edge') { const [ttl, sub] = split(t('x36.m.edge')), eh = TD.edge_ha, P5 = TD.projection.five, S = TD.base_scenario; const under = Object.keys(eh).filter(c => c !== 'free').reduce((a, c) => a + eh[c], 0), all = Object.values(eh).reduce((a, v) => a + v, 0);
    const c = await page(Object.assign({ title: ttl, sub: cap(sub), num: '04 / 04', key: GA.ex21.timeLegend('edge', t),
      notes: [['UNDER THE CEILING', `${km2(under)} km² of the ${km2(all)} km² of open land next to the towns lie under an aeronautical ceiling lower than 60 m (${Math.round(under / all * 100)} %).`, true]],
      src: t('x36.src.edge') + ' Residents: INE. Buildings, streets and the base: OpenStreetMap contributors (ODbL).' + PRINT },
      block(t('x36.ch.pop'), false, (x, px, py, w, h, k) => GA.ex21.drawPopChart(x, px, py, w, h, { t, k }),
        [['IF THE PACE CONTINUED (A SCENARIO)', t('x36.box.need', { a: n0(P5['2025']), b: n0(P5['2045']), n: n0(P5.dwellings_needed_2045), p: S.persons_per_dwelling }) + '.'],
          ['THE BASE AS LAND (HYPOTHETICAL)', t('x36.box.scen', { ha: km2(S.base_ha), d: n0(S.median_dw_per_ha * 100), n: n0(S.dwellings), r: n0(S.residents) }) + '.']])));
    return c.toDataURL('image/png'); }
  throw new Error('unknown sheet: ' + m); }'''
NAME = {'history': '01_history', 'built': '02_built', 'density': '03_density', 'edge': '04_growth'}
try:
  with sync_playwright() as p:
    b, pg, errs = launch(p, PORT)
    for m in ONLY:
      if m == 'frames':
        for i, h in enumerate(HIST): save(pg.evaluate(JS, ['frame', DPI, HIST, i]), os.path.join(OUTD, 'frames', f'{i:02d}_{h[0]}.png'))
      else: save(pg.evaluate(JS, [m, DPI, HIST, None]), os.path.join(OUTD, f'an_time_{NAME[m]}.png'))
      print(m, 'ok', flush=True)
    print('errors:', errs[:5])
finally: srv.terminate()
