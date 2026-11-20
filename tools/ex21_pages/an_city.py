"""Exercise 2.1 — the city maps in the ANALYSIS print style (owner, 20 Nov 2026): black, greys and white, ONE red per map.
One sheet per map at TRUE 1:10,000 (the frame 6400 x 5600 m = 640 x 560 mm), English only:
  island   01  the closed island            red = the base
  walk     02  walking                      red = the detours and the dead ends
  growth   03  growing towns and the metro  red = the metro
  height   04  the ceiling                  red = the height limits (a ramp of the red)
  strategy 05  the strategy (proposal)      red = the proposal
  key          where the 1:500 areas sit    red = the windows (1:25,000)
  gaps         the gaps panel (three small maps and bars, A3 landscape)
The furniture (title block, corner marks, key, notes, sources) comes from tools/ex21_pages/_analysis.py; the maps from
GA.ex21.draw* after GA.ex21.setStyle('analysis'). Numbers in the notes are read from the data at run time, never typed in.
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/an_city.py <out folder> [island,walk,…]   (env DPI, default 200)"""
import sys, time, subprocess, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _analysis import AN_JS, launch, save
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; ALL = ['island', 'walk', 'growth', 'height', 'strategy', 'key', 'gaps']; ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else ALL
DPI = float(os.environ.get('DPI', 200)); PORT = 8863
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([m, DPI]) => { await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); GA.ex21.setStyle('analysis'); ''' + AN_JS + r'''
  const t = (k, v) => GA.i18n.t(k, v), D0 = GA.ex21.data, E = GA.ex21.CITY, mm = AN.mm; const KF = 3.8 * DPI / 200;   // the line and label weight of a 1:10,000 map
  const base = D0.edge.find(f => f.p.k === 'base').p; const SERIES = 'EX 2.1 · CITY · 1:10,000';
  // what a map's title says after its number ("01 · The closed island: …" → "THE CLOSED ISLAND", "the base, its 300 m band …")
  const split = (s) => { const q = s.replace(/^\d+\s*·\s*/, ''); const i = q.indexOf(':'); return i > 0 ? [q.slice(0, i).toUpperCase(), q.slice(i + 1).trim()] : [q.toUpperCase(), '']; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const page = (o) => AN.mapSheet(Object.assign({ mapW: 640, mapH: 560, u: 1.4, code: SERIES, metres: 1000, pxPerM: mm(640) / 6400, scale: '1:10,000', keyCols: 2, kk: KF * 0.8 }, o));
  if (m === 'island') { const [ttl, sub] = split(t('x34.m.island'));
    const fence = D0.edge.filter(f => f.p.k === 'fence'); const len = {}; let tot = 0; fence.forEach(f => f.g.forEach(r => { for (let i = 1; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); len[f.p.c] = (len[f.p.c] || 0) + d; tot += d; } }));
    const pc = (c) => Math.round((len[c] || 0) / tot * 100);
    const c = await page({ title: ttl, sub: cap(sub), num: '01 / 05', key: GA.ex21.mapLegend('island', t),
      draw: (x, bx, by, bw, bh) => GA.ex21.drawCity(x, bx, by, bw, bh, { t, only: 'island', k: KF, noNorth: true, noScale: true }),
      notes: [['THE ISLAND', `${GA.ex21.km2(base.area_ha)} km² of closed land behind ${base.perimeter_km} km of fence, in the middle of five towns that keep growing.`, true],
        ['WHAT LIES ALONG THE FENCE', `By length of fence (OSM land use just outside it): housing ${pc('housing')} %, open land ${pc('open')} %, a main road ${pc('road')} %, industry ${pc('industry')} %, parks or green ${pc('green')} %.`]],
      src: t('x34.src.island').replace(/^Sources:\s*/, 'Sources: ') + ' The 300 m band is a distance drawn from the outline, not a legal zone. Printed in black, greys and one red; the base is drawn as a white void behind its fence.' });
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
