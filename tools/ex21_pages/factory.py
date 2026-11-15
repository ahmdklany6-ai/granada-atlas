"""Exercise 2.1 print pages, the factory: the four maps of the Escúzar estate and the village at TRUE 1:10,000
(5.4 × 4.4 km = 540 × 440 mm), each with title, legend and sources. Third argument: comma list of estate,access,land,time.
Env: DPI (200), KF (3.4 = line and label weight for print).
Usage (from the repo root; Playwright + Chromium): python3 tools/ex21_pages/factory.py <out folder> [en|he|ar] [maps]
Writes PNG at 200 dpi from the page canvas; it starts its own local server and loads js/ex21.js + js/i18n_v33.js
into the atlas page (Exercise 2.1 is not in index.html yet). Not part of the site or of the tests."""
import sys, time, base64, subprocess, os
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else ['estate', 'access', 'land', 'time', 'photo']
DPI = float(os.environ.get('DPI', 200)); KF = float(os.environ.get('KF', 3.4)); PORT = 8855; V3.PORT = PORT; V3.V2.PORT = PORT
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
# one page per city map at TRUE 1:10,000: the frame 6400 × 5600 m = 640 × 560 mm; title, scale, legend and sources around it
JS = r'''async ([m, DPI, KF]) => { await GA.ex21.ready(); await GA.ex21.readyFactory(); const FD = GA.ex21.factory; const D = DPI / 25.4, mm = (v) => Math.round(v * D);
  const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl';
  const wrap = (x, s, maxW) => { const out = []; let line = ''; s.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); if (line) out.push(line); return out; };
  const MW = mm(540), MH = mm(440), mg = mm(20), W = MW + 2 * mg, mapY = mm(46); const items = GA.ex21.factoryLegend(m, t); const cols = 3, rows = Math.ceil(items.length / cols);
  const tb = m === 'estate' ? FD.plots.filter(q => q.jobs || q.inv || q.opened) : []; const tbH = tb.length ? mm(16) + tb.length * mm(8) : 0;
  const legY = mapY + MH + mm(12), tbY = legY + rows * mm(13) + mm(6), srcY = tbY + tbH + mm(4), H = srcY + mm(24);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); const L = mg, R = W - mg;
  const img = m === 'photo' ? await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('exports/ex21_factory/aerial_frame.jpg is missing')); im.src = '/exports/ex21_factory/aerial_frame.jpg?r=' + Date.now(); }) : null; const FLIGHT = '2022-08';
  const title = { photo: t('x35.m.photo', { d: FLIGHT }), estate: t('x35.m.estate', { ha: GA.ex21.km2(FD.estate.ha), pop: FD.village.pop }), access: t('x35.m.access', { km: FD.gap_metro_km }), land: t('x35.m.land', { ha: GA.ex21.km2(FD.land_ha.solar || 0) }), time: t('x35.m.time', { v: FD.village.first_year, e: FD.estate.first_year }) }[m];
  x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink;
  x.font = '700 ' + mm(11) + 'px ' + F; x.fillText(title, rtl ? R : L, mm(24), R - L);
  x.font = '500 ' + mm(6.5) + 'px ' + F; x.fillStyle = GA.palette.red; x.direction = 'ltr'; x.fillText('1:10,000', rtl ? R : L, mm(37)); x.direction = rtl ? 'rtl' : 'ltr';
  GA.ex21.drawFactory(x, L, mapY, MW, MH, { t, only: m, k: KF, aerial: img });
  const cw = (R - L) / cols, sw = mm(16), sh = mm(7);
  items.forEach((it, j) => { const col = j % cols, lx = rtl ? R - (col + 1) * cw : L + col * cw, yy = legY + Math.floor(j / cols) * mm(13) + mm(5); x.font = '500 ' + mm(4.6) + 'px ' + F; x.textBaseline = 'middle';
    const sx = rtl ? lx + cw - sw : lx;
    if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sx, yy - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = it.stroke || '#8C817A'; x.lineWidth = it.stroke ? 4 : 2; x.strokeRect(sx, yy - sh / 2, sw, sh); }
    if (it.sym === 'stop') { x.beginPath(); x.arc(sx + sw / 2, yy, 5.2 * KF, 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.line; x.lineWidth = 2.4 * KF; x.stroke(); }
    else if (it.line) { x.globalAlpha = it.alpha || 1; x.strokeStyle = it.line; x.lineWidth = (it.w || 1) * KF * 1.3; x.setLineDash(it.dash ? [9 * KF, 5 * KF] : it.dots ? [1 * KF, 4.5 * KF] : []); x.lineCap = it.dots ? 'round' : 'butt'; x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; x.lineCap = 'butt'; }
    x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.fillText(it.label, rtl ? sx - mm(4) : sx + sw + mm(4), yy, cw - sw - mm(10)); });
  if (tb.length) { const cx = [0, 0.26, 0.5, 0.78].map(f => L + (R - L) * f); x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink; x.font = '700 ' + mm(4.6) + 'px ' + F; x.fillText(t('x35.tb.title'), rtl ? R : L, tbY + mm(5));
    x.direction = 'ltr'; x.textAlign = 'left'; x.font = '600 ' + mm(3.6) + 'px ' + F; x.fillStyle = GA.palette.ink3; ['x35.tb.plot', 'x35.tb.since', 'x35.tb.jobs', 'x35.tb.inv'].forEach((key, i) => x.fillText(t(key), cx[i], tbY + mm(12)));
    x.strokeStyle = '#C5C0B3'; x.lineWidth = 2; x.beginPath(); x.moveTo(L, tbY + mm(13.6)); x.lineTo(R, tbY + mm(13.6)); x.stroke();
    tb.forEach((q, i) => { const yy = tbY + mm(19.5) + i * mm(8); x.font = '600 ' + mm(3.8) + 'px ' + F; x.fillStyle = GA.palette.ink; x.fillText(q.nm, cx[0], yy, cx[1] - cx[0] - mm(4)); x.font = '400 ' + mm(3.8) + 'px ' + F; [q.opened || '—', q.jobs || '—', q.inv || '—'].forEach((v, c2) => x.fillText(v, cx[c2 + 1], yy, (c2 < 2 ? cx[c2 + 2] - cx[c2 + 1] : R - cx[3]) - mm(4))); }); }
  x.font = '400 ' + mm(3.8) + 'px ' + F; x.fillStyle = GA.palette.ink3; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr';
  wrap(x, t('x35.src.' + m, { y: FD.village.pop_year, d: FLIGHT }), R - L).forEach((ln, i) => x.fillText(ln, rtl ? R : L, srcY + mm(4) + i * mm(5.6)));
  return c.toDataURL('image/png'); }'''
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawFactory)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    for i, m in enumerate(ONLY):
      d = pg.evaluate(JS, [m, DPI, KF]); n = {'estate': '01_estate', 'access': '02_access', 'land': '03_land', 'time': '04_time', 'photo': '05_aerial'}[m]
      open(os.path.join(OUTD, f'factory_{n}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(m, 'ok', len(d) // 1000, 'kB b64')
    print('errors:', errs[:5])
finally: srv.terminate()
