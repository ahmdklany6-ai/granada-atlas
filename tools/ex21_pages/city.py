"""Exercise 2.1 print pages: the four city maps at TRUE 1:10,000 (640 × 560 mm each) and the gaps panel (A3 landscape).
Third argument: comma list of island,walk,growth,height,gaps. Env: DPI (200), KF (3.8 = line and label weight for print).
Usage (from the repo root; Playwright + Chromium): python3 tools/ex21_pages/city.py <out folder> [en|he|ar]
Writes PNG at 200 dpi from the page canvas; it starts its own local server and loads js/ex21.js + js/i18n_v33.js
into the atlas page (Exercise 2.1 is not in index.html yet). Not part of the site or of the tests."""
import sys, time, base64, subprocess, os
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else ['island', 'walk', 'growth', 'height', 'gaps']
DPI = float(os.environ.get('DPI', 200)); KF = float(os.environ.get('KF', 3.8)); PORT = 8853; V3.PORT = PORT; V3.V2.PORT = PORT
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
# one page per city map at TRUE 1:10,000: the frame 6400 × 5600 m = 640 × 560 mm; title, scale, legend and sources around it
JS = r'''async ([m, DPI, KF]) => { await GA.ex21.ready(); const D = DPI / 25.4, mm = (v) => Math.round(v * D);
  const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl';
  const wrap = (x, s, maxW) => { const out = []; let line = ''; s.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); if (line) out.push(line); return out; };
  if (m === 'gaps') { const W = mm(420), H = mm(297), mg = mm(15); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink; x.font = '700 ' + mm(7.5) + 'px ' + F; x.fillText(t('x34.gap.title'), rtl ? W - mg : mg, mm(22));
    GA.ex21.drawGaps(x, mg, mm(32), W - 2 * mg, H - mm(32) - mm(30), { t });
    x.font = '400 ' + mm(2.9) + 'px ' + F; x.fillStyle = GA.palette.ink3; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; wrap(x, t('x34.src.gaps'), W - 2 * mg).forEach((ln, i) => x.fillText(ln, rtl ? W - mg : mg, H - mm(16) + i * mm(4.4)));
    return c.toDataURL('image/png'); }
  const MW = mm(640), MH = mm(560), mg = mm(20), W = MW + 2 * mg, mapY = mm(46); const items = GA.ex21.mapLegend(m, t); const cols = 3, rows = Math.ceil(items.length / cols);
  const legY = mapY + MH + mm(12), srcY = legY + rows * mm(13) + mm(8), H = srcY + mm(22);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); const L = mg, R = W - mg;
  x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink;
  x.font = '700 ' + mm(12) + 'px ' + F; x.fillText(t('x34.m.' + m), rtl ? R : L, mm(24));
  x.font = '500 ' + mm(6.5) + 'px ' + F; x.fillStyle = GA.palette.red; x.direction = 'ltr'; x.fillText('1:10,000', rtl ? R : L, mm(37)); x.direction = rtl ? 'rtl' : 'ltr';
  GA.ex21.drawCity(x, L, mapY, MW, MH, { t, only: m, k: KF });
  const cw = (R - L) / cols, sw = mm(16), sh = mm(7);
  items.forEach((it, j) => { const col = j % cols, lx = rtl ? R - (col + 1) * cw : L + col * cw, yy = legY + Math.floor(j / cols) * mm(13) + mm(5); x.font = '500 ' + mm(5) + 'px ' + F; x.textBaseline = 'middle';
    const sx = rtl ? lx + cw - sw : lx;
    if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sx, yy - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = '#8C817A'; x.lineWidth = 2; x.strokeRect(sx, yy - sh / 2, sw, sh); }
    if (it.hatch) { x.save(); x.beginPath(); x.rect(sx, yy - sh / 2, sw, sh); x.clip(); x.strokeStyle = it.hatch; x.lineWidth = 3; for (let q = -sh; q < sw; q += mm(2.2)) { x.beginPath(); x.moveTo(sx + q, yy + sh / 2); x.lineTo(sx + q + sh, yy - sh / 2); x.stroke(); } x.restore(); x.strokeStyle = it.hatch; x.lineWidth = 2; x.strokeRect(sx, yy - sh / 2, sw, sh); }
    if (it.sym === 'dead') { const r = 4.2 * KF, cx = sx + sw / 2; x.beginPath(); x.arc(cx, yy, r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.line; x.lineWidth = 2 * KF; x.stroke(); x.beginPath(); x.moveTo(cx - 2.4 * KF, yy); x.lineTo(cx + 2.4 * KF, yy); x.stroke(); }
    else if (it.line) { x.strokeStyle = it.line; x.lineWidth = (it.w || 1) * KF * 1.4; x.setLineDash(it.dash ? [9 * KF, 4 * KF] : []); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]);
      if (it.rail) { x.strokeStyle = '#fff'; x.lineWidth = 2.2 * KF; x.setLineDash([7 * KF, 7 * KF]); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); } }
    x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.fillText(it.label, rtl ? sx - mm(4) : sx + sw + mm(4), yy, cw - sw - mm(10)); });
  x.font = '400 ' + mm(4) + 'px ' + F; x.fillStyle = GA.palette.ink3; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr';
  wrap(x, t('x34.src.' + m), R - L).forEach((ln, i) => x.fillText(ln, rtl ? R : L, srcY + mm(4) + i * mm(6)));
  return c.toDataURL('image/png'); }'''
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.keyLegend)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    for i, m in enumerate(ONLY):
      d = pg.evaluate(JS, [m, DPI, KF]); n = {'island': '01_island', 'walk': '02_walk', 'growth': '03_growth', 'height': '04_height', 'gaps': '05_gaps'}[m]
      open(os.path.join(OUTD, f'city_{n}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(m, 'ok', len(d) // 1000, 'kB b64')
    print('errors:', errs[:5])
finally: srv.terminate()
