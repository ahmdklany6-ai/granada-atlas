"""Exercise 2.1 print pages, the base over time (owner request, 15 Nov 2026):
  hist   — one sheet with the same frame in ten pictures, 1931 map → 2022 photo (exports/ex21_time/hist/*.jpg, fetched
           from the IGN WMS: primera-edicion-mtn MTN50, pnoa-historico, pnoa-ma), today's fence drawn over each;
           plus each picture alone (frames/), for a film or a GIF;
  built / density / edge — a 1:10,000 map (640 × 560 mm) with its chart and its numbers (data/ex21/time.json).
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/time.py <out folder> [en|he|ar] [hist,built,density,edge]
Not part of the site or the tests."""
import sys, time, base64, subprocess, os
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else ['hist', 'built', 'density', 'edge']
PORT = 8856; V3.PORT = PORT; V3.V2.PORT = PORT; KF = 3.8
HIST = [('mtn50', '1931', 'map'), ('ams1956', '1956–1957', 'photo'), ('inter1973', '1973–1986', 'photo'), ('nac1981', '1981–1986', 'photo'), ('olistat1997', '1997–1998', 'photo'),
        ('sigpac2000', '1997–2003', 'photo'), ('pnoa2004', '2004', 'photo'), ('pnoa2010', '2010', 'photo'), ('pnoa2016', '2016', 'photo'), ('pnoa2022', '2022', 'photo')]
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
COMMON = r'''const D = 200 / 25.4, mm = (v) => Math.round(v * D); const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl';
  const wrap = (x, s, maxW) => { const out = []; let line = ''; s.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); if (line) out.push(line); return out; };
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });'''
JS_HIST = r'''async ([HIST, one]) => { await GA.ex21.ready(); await GA.ex21.readyTime(); ''' + COMMON + r'''
  const TD = GA.ex21.time; const imgs = await Promise.all(HIST.map(h => load('/exports/ex21_time/hist/' + h[0] + '.jpg')));
  const lab = (h) => h[0] === 'mtn50' ? t('x36.hist.1931', { ha: Math.round(TD.aerodrome_1931_ha) }) : h[1];
  if (one != null) { const h = HIST[one], w = 1600, hh = 1400, c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d');
    GA.ex21.drawTime(x, 0, 0, w, hh, { t, only: 'photo', photo: imgs[one], k: 1.6 });
    x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '700 64px ' + F; const s = lab(h); const tw = Math.min(x.measureText(s).width, w - 120); x.fillRect(40, 40, tw + 48, 92); x.fillStyle = GA.palette.red; x.textBaseline = 'middle'; x.textAlign = 'left'; x.direction = 'ltr'; x.fillText(s, 64, 88, w - 140);
    return c.toDataURL('image/png'); }
  const cols = 5, fw = mm(150), fh = Math.round(fw * 5600 / 6400), g = mm(8), L = mm(20), W = L * 2 + cols * fw + (cols - 1) * g, top = mm(44), H = top + 2 * (fh + mm(14)) + mm(40);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); const R = W - L;
  x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink; x.font = '700 ' + mm(12) + 'px ' + F; x.fillText(t('x36.hist.title'), rtl ? R : L, mm(24));
  x.font = '500 ' + mm(5.5) + 'px ' + F; x.fillStyle = GA.palette.red; x.fillText(t('x36.hist.sub'), rtl ? R : L, mm(35));
  HIST.forEach((h, i) => { const col = rtl ? cols - 1 - (i % cols) : i % cols, fx = L + col * (fw + g), fy = top + Math.floor(i / cols) * (fh + mm(14)) + mm(10);
    x.font = '700 ' + mm(6) + 'px ' + F; x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.fillText(lab(h), rtl ? fx + fw : fx, fy - mm(2.5), fw);
    GA.ex21.drawTime(x, fx, fy, fw, fh, { t, only: 'photo', photo: imgs[i], k: fw / 1000 * 1.5, noScale: i !== 0, noNorth: i !== 0 }); });
  x.font = '600 ' + mm(5) + 'px ' + F; x.fillStyle = GA.palette.ink; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; let yy = H - mm(30);
  x.fillText(t('x36.box.growth', { a: Math.round(TD.aerodrome_1931_ha), b: Math.round(TD.base_ha_today) }), rtl ? R : L, yy); yy += mm(8);
  x.font = '400 ' + mm(3.8) + 'px ' + F; x.fillStyle = GA.palette.ink3; wrap(x, t('x36.hist.src'), R - L).forEach(ln => { x.fillText(ln, rtl ? R : L, yy); yy += mm(5.2); });
  return c.toDataURL('image/png'); }'''
JS_MAP = r'''async ([m, KF]) => { await GA.ex21.ready(); await GA.ex21.readyTime(); ''' + COMMON + r'''
  const TD = GA.ex21.time; const MW = mm(640), MH = mm(560), mg = mm(20), W = MW + 2 * mg, mapY = mm(46); const items = GA.ex21.timeLegend(m, t); const cols = 3, rows = Math.ceil(items.length / cols);
  const legY = mapY + MH + mm(12), chY = legY + rows * mm(13) + mm(10), chH = mm(150), boxY = chY + chH + mm(8), srcY = boxY + mm(26), H = srcY + mm(26);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); const L = mg, R = W - mg;
  x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink; x.font = '700 ' + mm(12) + 'px ' + F; x.fillText(t('x36.m.' + m), rtl ? R : L, mm(24), R - L);
  x.font = '500 ' + mm(6.5) + 'px ' + F; x.fillStyle = GA.palette.red; x.direction = 'ltr'; x.fillText('1:10,000', rtl ? R : L, mm(37)); x.direction = rtl ? 'rtl' : 'ltr';
  GA.ex21.drawTime(x, L, mapY, MW, MH, { t, only: m, k: KF });
  const cw = (R - L) / cols, sw = mm(16), sh = mm(7);
  items.forEach((it, j) => { const col = j % cols, lx = rtl ? R - (col + 1) * cw : L + col * cw, yy = legY + Math.floor(j / cols) * mm(13) + mm(5); x.font = '500 ' + mm(5) + 'px ' + F; x.textBaseline = 'middle'; const sx = rtl ? lx + cw - sw : lx;
    if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sx, yy - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = '#8C817A'; x.lineWidth = 2; x.strokeRect(sx, yy - sh / 2, sw, sh); }
    if (it.line) { x.strokeStyle = it.line; x.lineWidth = (it.w || 1) * KF * 1.4; x.setLineDash(it.dash ? [9 * KF, 4 * KF] : []); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); }
    x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.fillText(it.label, rtl ? sx - mm(4) : sx + sw + mm(4), yy, cw - sw - mm(10)); });
  // chart + its key (the five towns' colours)
  x.textBaseline = 'alphabetic'; x.font = '700 ' + mm(5.5) + 'px ' + F; x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.fillText(t(m === 'built' ? 'x36.ch.dw' : m === 'edge' ? 'x36.ch.pop' : 'x36.ch.pop0'), rtl ? R : L, chY, R - L);
  const col = GA.ex21.tcol(); let kx = L; x.font = '500 ' + mm(4.4) + 'px ' + F; x.textBaseline = 'middle'; x.direction = 'ltr'; x.textAlign = 'left';
  if (m === 'built') GA.ex21.TFIVE.forEach(tn => { x.fillStyle = col[tn]; x.fillRect(kx, chY + mm(6), mm(8), mm(4)); x.fillStyle = GA.palette.ink; x.fillText(tn, kx + mm(10), chY + mm(8)); kx += x.measureText(tn).width + mm(22); });
  if (m === 'built') GA.ex21.drawDwellChart(x, L, chY + mm(14), R - L, chH - mm(14), { t, k: KF * 1.25 }); else GA.ex21.drawPopChart(x, L, chY + mm(6), R - L, chH - mm(6), { t, k: KF * 1.25, noProj: m !== 'edge' });
  // the numbers
  x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic'; x.font = '600 ' + mm(5) + 'px ' + F; x.fillStyle = GA.palette.ink; let yy = boxY + mm(6);
  const P = TD.projection.five, S = TD.base_scenario; const lines = m === 'edge' ? [t('x36.box.need', { a: P['2025'].toLocaleString('en-US'), b: P['2045'].toLocaleString('en-US'), n: P.dwellings_needed_2045.toLocaleString('en-US'), p: S.persons_per_dwelling }), t('x36.box.scen', { ha: S.base_ha, d: S.median_dw_per_ha, n: S.dwellings.toLocaleString('en-US'), r: S.residents.toLocaleString('en-US') })]
    : m === 'built' ? [t('x36.box.growth', { a: Math.round(TD.aerodrome_1931_ha), b: Math.round(TD.base_ha_today) })] : [GA.ex21.TFIVE.map(tn => tn.replace(' de la Vega', '') + ': ' + TD.towns[tn].persons_per_dwelling).join(' · ') + '  ·  ' + t('x36.ppd')];
  lines.forEach(s => wrap(x, s, R - L).forEach(ln => { x.fillText(ln, rtl ? R : L, yy); yy += mm(7); }));
  x.font = '400 ' + mm(4) + 'px ' + F; x.fillStyle = GA.palette.ink3; wrap(x, t('x36.src.' + m), R - L).forEach((ln, i) => x.fillText(ln, rtl ? R : L, srcY + mm(4) + i * mm(5.6)));
  return c.toDataURL('image/png'); }'''
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/palette.js', 'js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawTime)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    for m in ONLY:
      if m == 'hist':
        d = pg.evaluate(JS_HIST, [HIST, None]); open(os.path.join(OUTD, f'time_01_history_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print('hist ok')
        os.makedirs(os.path.join(OUTD, 'frames'), exist_ok=True)
        for i, h in enumerate(HIST):
          d = pg.evaluate(JS_HIST, [HIST, i]); open(os.path.join(OUTD, 'frames', f'{i:02d}_{h[0]}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1]))
      else:
        d = pg.evaluate(JS_MAP, [m, KF]); n = {'built': '02_built', 'density': '03_density', 'edge': '04_growth'}[m]
        open(os.path.join(OUTD, f'time_{n}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(m, 'ok')
    print('errors:', errs[:5])
finally: srv.terminate()
