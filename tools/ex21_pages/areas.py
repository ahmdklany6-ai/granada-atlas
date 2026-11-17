"""Exercise 2.1 print pages: one page per 1:500 area — the map (130 m = 260 mm) with its section under it and the legend.
Needs the section SVGs first: STYLE=detail OUT=exports/ex21_sec python3 tools/export_ex21_sections_svg.py
Usage (from the repo root; Playwright + Chromium): python3 tools/ex21_pages/areas.py <out folder> [en|he|ar]
Writes PNG at 200 dpi from the page canvas; it starts its own local server and loads js/ex21.js + js/i18n_v33.js
into the atlas page (Exercise 2.1 is not in index.html yet). Not part of the site or of the tests."""
import sys, time, base64, subprocess, os
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
import json
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; SET = os.environ.get('SET', 'base'); PORT = 8851
# SET=factory: the six windows of the Escúzar estate and village (data/ex21/factory_areas.json, sections in exports/ex21_factory/sec)
IDS = os.environ['IDS'].split(',') if os.environ.get('IDS') else [a['id'] for a in json.load(open('data/ex21/' + ('factory_areas.json' if SET == 'factory' else 'areas.json')))['areas']]
SEC = '/exports/ex21_factory/sec/section_' if SET == 'factory' else '/exports/ex21_sec/section_'
SRC = ('D. G. del Catastro (buildings, floors) · OpenStreetMap (ODbL) · IGN MDT05 & PNOA (CC BY 4.0) · heights = floors × 3 m (estimate); sheds and churches: height not measured' if SET == 'factory' else
       'OpenStreetMap (ODbL) · IGN MDT25 & PNOA (CC BY 4.0) · Origen de los datos: Ministerio de Defensa (RD 118/2019) · heights = floors × 3 m (estimate)')
V3.PORT = PORT; V3.V2.PORT = PORT
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
# one page per area: 297 mm wide at 200 dpi; the 1:500 map (130 m = 260 mm) with its section (1:500) under it, then the legend
JS = r'''async ([id, SET, SEC, SRC]) => { await GA.ex21.readyAreas(SET); const D = 200 / 25.4, mm = (v) => Math.round(v * D), u = D * 25.4 / 200;
  const img = new Image(); img.src = SEC + id + '.svg?r=' + Date.now(); await img.decode();
  const sw = mm(280), sh = Math.round(sw * img.naturalHeight / img.naturalWidth);
  const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl'; const items = GA.ex21.areaLegend(t);
  const W = mm(297), mapY = mm(14), M = mm(260), secY = mapY + M + mm(8), legY = secY + sh + mm(4), rows = Math.ceil(items.length / 3), H = legY + rows * mm(9) + mm(14);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const L = mm(18.5), R = W - mm(18.5);
  x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink;
  // the title is written on the map itself, in grey (owner, Map Studio 17 Nov 2026)
  GA.ex21.drawArea(x, (W - M) / 2, mapY, M, id, { t, k: M / 1000 * 1.05, title: t('x34.a.' + id) + ' · 1:500', titlePx: mm(4.6) });
  x.drawImage(img, (W - sw) / 2, secY, sw, sh);
  items.forEach((it, j) => { const cw = (R - L) / 3, col = j % 3, lx = rtl ? R - (col + 1) * cw : L + col * cw, yy = legY + Math.floor(j / 3) * mm(9) + mm(4); x.font = '500 ' + mm(2.9) + 'px ' + F; x.textBaseline = 'middle';
    const sx = rtl ? lx + cw - mm(10) : lx;
    if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sx, yy - mm(2), mm(9), mm(4)); x.globalAlpha = 1; x.strokeStyle = it.stroke || '#8C817A'; x.lineWidth = (it.stroke ? 3 : 1) * u; x.setLineDash(it.dashed ? [8 * u, 5 * u] : []); x.strokeRect(sx, yy - mm(2), mm(9), mm(4)); x.setLineDash([]); }
    if (it.sym === 'dead') { const r = mm(1.9), cx = sx + mm(4.5); x.beginPath(); x.arc(cx, yy, r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.line; x.lineWidth = mm(0.6); x.stroke(); x.beginPath(); x.moveTo(cx - r * 0.6, yy); x.lineTo(cx + r * 0.6, yy); x.stroke(); }
    else if (it.line) { x.strokeStyle = it.line; x.lineWidth = (it.w || 1) * 4 * u; x.setLineDash(it.dash ? [14 * u, 8 * u] : []); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + mm(9), yy); x.stroke(); x.setLineDash([]); }
    x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.fillText(it.label, rtl ? sx - mm(2) : sx + mm(11), yy, cw - mm(13)); });
  x.font = '400 ' + mm(2.3) + 'px ' + F; x.fillStyle = GA.palette.ink3; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic';
  x.fillText(SRC, rtl ? R : L, H - mm(6), R - L);
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
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawArea)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    for aid in IDS:
      d = pg.evaluate(JS, [aid, SET, SEC, SRC]); open(os.path.join(OUTD, f'area_{aid}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(aid, 'ok')
    print('errors:', errs[:5])
finally: srv.terminate()
