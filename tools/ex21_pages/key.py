"""Exercise 2.1 print page: the key map (the city frame at 1:25,000) with the eight 1:500 windows, legend and area names.
Usage (from the repo root; Playwright + Chromium): python3 tools/ex21_pages/key.py <out folder> [en|he|ar]
Writes PNG at 200 dpi from the page canvas; it starts its own local server and loads js/ex21.js + js/i18n_v33.js
into the atlas page (Exercise 2.1 is not in index.html yet). Not part of the site or of the tests."""
import sys, time, base64, subprocess, os
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; SET = os.environ.get('SET', 'base'); PORT = 8852
# SET=factory: the key map of the six windows of the Escúzar estate and village (the 5.4 × 4.4 km frame at 1:20,000)
V3.PORT = PORT; V3.V2.PORT = PORT
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
# the key map page: 297 mm wide at 200 dpi; the city frame (6400 × 5600 m) at 1:25,000 = 256 × 224 mm, the eight windows, legend, area names
JS = r'''async (SET) => { await GA.ex21.ready(); const fac = SET === 'factory'; if (fac) await GA.ex21.readyFactory(); await GA.ex21.readyAreas(SET); const D = 200 / 25.4, mm = (v) => Math.round(v * D), u = D * 25.4 / 200;
  const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl'; const items = fac ? GA.ex21.factoryLegend('estate', t).concat([{ sw: GA.palette.red, alpha: 0.18, stroke: GA.palette.red, label: t('x34.lg.window') }]) : GA.ex21.keyLegend(t); const areas = GA.ex21.areas.areas;
  const W = mm(297), mapY = mm(14), MW = fac ? mm(270) : mm(256), MH = fac ? mm(220) : mm(224), legY = mapY + MH + mm(8), rows = Math.ceil(items.length / 2), namY = legY + rows * mm(9) + mm(6), H = namY + Math.ceil(areas.length / 2) * mm(8) + mm(16);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const L = (W - MW) / 2, R = W - L;
  x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink;
  // the title is written on the map itself, in grey (owner, Map Studio 17 Nov 2026)
  const ttl = t(fac ? 'x35.key.title' : 'x34.key.title') + ' · ' + (fac ? '1:20,000' : '1:25,000');
  if (fac) GA.ex21.drawFactoryKey(x, L, mapY, MW, MH, { t, k: MW / 1000 * 1.25, title: ttl, titlePx: mm(4.4) }); else GA.ex21.drawAreaKey(x, L, mapY, MW, MH, { t, k: MW / 1000, title: ttl, titlePx: mm(4.4) });
  const cw = (R - L) / 2;
  items.forEach((it, j) => { const col = j % 2, lx = rtl ? R - (col + 1) * cw : L + col * cw, yy = legY + Math.floor(j / 2) * mm(9) + mm(4); x.font = '500 ' + mm(3.1) + 'px ' + F; x.textBaseline = 'middle';
    const sx = rtl ? lx + cw - mm(10) : lx, sw = mm(9), sh = mm(4);
    if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sx, yy - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = it.stroke || '#8C817A'; x.lineWidth = (it.stroke ? 4 : 1) * u; x.strokeRect(sx, yy - sh / 2, sw, sh); }
    if (it.hatch) { x.save(); x.beginPath(); x.rect(sx, yy - sh / 2, sw, sh); x.clip(); x.strokeStyle = it.hatch; x.lineWidth = 2 * u; for (let q = -sh; q < sw; q += 10 * u) { x.beginPath(); x.moveTo(sx + q, yy + sh / 2); x.lineTo(sx + q + sh, yy - sh / 2); x.stroke(); } x.restore(); x.strokeStyle = it.hatch; x.lineWidth = 1; x.strokeRect(sx, yy - sh / 2, sw, sh); }
    if (it.line) { x.strokeStyle = it.line; x.lineWidth = (it.w || 1) * 4 * u; x.setLineDash(it.dash ? [14 * u, 8 * u] : it.dots ? [3 * u, 12 * u] : []); x.lineCap = it.dots ? 'round' : 'butt'; x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); }
    x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.fillText(it.label, rtl ? sx - mm(2) : sx + mm(11), yy, cw - mm(14)); });
  areas.forEach((a, j) => { const col = j % 2, lx = rtl ? R - col * cw : L + col * cw, yy = namY + Math.floor(j / 2) * mm(8) + mm(4);
    x.font = '600 ' + mm(3.3) + 'px ' + F; x.textBaseline = 'middle'; x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.fillText(t('x34.a.' + a.id), lx, yy, cw - mm(4)); });
  x.font = '400 ' + mm(2.3) + 'px ' + F; x.fillStyle = GA.palette.ink3; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic'; x.direction = 'ltr';
  x.fillText(fac ? 'OpenStreetMap contributors (ODbL): estate, plots, roads · D. G. del Catastro: buildings · INE: residents' : 'OpenStreetMap contributors (ODbL) · base edge and 300 m band: derived from OSM', rtl ? R : L, H - mm(6));
  return c.toDataURL('image/png'); }'''
# print resolution (env DPI, default 200); line weights given in mm scale with it
DPI = float(os.environ.get('DPI', 200))
JS = JS.replace('const D = 200 / 25.4', f'const D = {DPI} / 25.4')
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.keyLegend)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    d = pg.evaluate(JS, SET); open(os.path.join(OUTD, f'key_map_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1]))
    print('errors:', errs[:5])
finally: srv.terminate()
