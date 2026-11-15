"""Exercise 2.1 print pages: one page per 1:500 area on the PNOA aerial photo, with the fence, dead ends and section line.
Needs the print-size photos first: SIZE=2080 OUT=exports/ex21_aerial python3 tools/build_ex21_aerial.py
Usage (from the repo root; Playwright + Chromium): python3 tools/ex21_pages/aerial.py <out folder> [en|he|ar]
Writes PNG at 200 dpi from the page canvas; it starts its own local server and loads js/ex21.js + js/i18n_v33.js
into the atlas page (Exercise 2.1 is not in index.html yet). Not part of the site or of the tests."""
import sys, time, base64, subprocess, os
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
import json
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; SET = os.environ.get('SET', 'base'); PORT = 8854
# SET=factory: the six windows of the Escúzar estate and village (photos in exports/ex21_factory/aerial)
IDS = [a['id'] for a in json.load(open('data/ex21/' + ('factory_areas.json' if SET == 'factory' else 'areas.json')))['areas']]
AER = '/exports/ex21_factory/aerial/' if SET == 'factory' else '/exports/ex21_aerial/'
V3.PORT = PORT; V3.V2.PORT = PORT
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
# one page per area: 297 mm wide at 200 dpi; the PNOA aerial photo of the 1:500 window (130 m = 260 mm) with the fence, dead ends and section line over it
JS = r'''async ([id, SET, AER]) => { await GA.ex21.readyAreas(SET); const D = 200 / 25.4, mm = (v) => Math.round(v * D);
  const img = await GA.ex21.loadAerial(id, AER); const idx = (await (await fetch(AER + 'index.json?r=' + Date.now())).json()).areas[id];
  const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl'; const items = GA.ex21.aerialLegend(t, id);
  const wrap = (x, s, maxW) => { const out = []; let line = ''; s.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); if (line) out.push(line); return out; };
  const W = mm(297), mapY = mm(30), M = mm(260), legY = mapY + M + mm(7), rows = Math.ceil(items.length / 2), noteY = legY + rows * mm(9) + mm(5), H = noteY + mm(26);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const L = mm(18.5), R = W - mm(18.5);
  x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink;
  x.font = '700 ' + mm(6.5) + 'px ' + F; x.fillText(t('x34.a.' + id), rtl ? R : L, mm(17));
  x.font = '500 ' + mm(3.6) + 'px ' + F; x.fillStyle = GA.palette.red; x.fillText(t('x34.aer.sub'), rtl ? R : L, mm(24));
  GA.ex21.drawArea(x, (W - M) / 2, mapY, M, id, { t, k: M / 1000 * 1.05, aerial: img });
  const cw = (R - L) / 2;
  items.forEach((it, j) => { const col = j % 2, lx = rtl ? R - (col + 1) * cw : L + col * cw, yy = legY + Math.floor(j / 2) * mm(9) + mm(4); x.font = '500 ' + mm(2.9) + 'px ' + F; x.textBaseline = 'middle';
    const sx = rtl ? lx + cw - mm(10) : lx, sw = mm(9);
    if (it.sym === 'dead') { const r = mm(1.9), cx = sx + sw / 2; x.beginPath(); x.arc(cx, yy, r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.line; x.lineWidth = mm(0.6); x.stroke(); x.beginPath(); x.moveTo(cx - r * 0.6, yy); x.lineTo(cx + r * 0.6, yy); x.stroke(); }
    else if (it.line) { x.strokeStyle = it.line; x.lineWidth = (it.w || 1) * 4; x.setLineDash(it.dash ? [14, 8] : []); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]);
      if (it.rail) { x.strokeStyle = '#fff'; x.lineWidth = 4; x.setLineDash([10, 10]); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); } }
    x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.fillText(it.label, rtl ? sx - mm(2) : sx + mm(11), yy, cw - mm(14)); });
  x.textBaseline = 'alphabetic'; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; let yy = noteY + mm(3);
  const A = GA.ex21.areas.areas.find(a => a.id === id), fy = idx.flight ? parseInt(idx.flight.slice(0, 4), 10) : null, late = fy ? (A.buildings || []).filter(b => b.y && b.y > fy) : [];
  if (late.length) { x.font = '600 ' + mm(3) + 'px ' + F; x.fillStyle = GA.palette.ink; const ys = [...new Set(late.map(b => b.y))].sort(); wrap(x, t('x34.aer.older', { d: idx.flight, n: late.length, y: ys.length > 1 ? ys[0] + '–' + ys[ys.length - 1] : ys[0] }), R - L).forEach(ln => { x.fillText(ln, rtl ? R : L, yy); yy += mm(4.6); }); yy += mm(1.5); }
  const p = idx.base_blurred_share; if (p != null) { x.font = '600 ' + mm(3) + 'px ' + F; x.fillStyle = GA.palette.ink; wrap(x, p >= 0.15 ? t('x34.aer.blur', { p: Math.round(p * 100) }) : t('x34.aer.noblur'), R - L).forEach(ln => { x.fillText(ln, rtl ? R : L, yy); yy += mm(4.6); }); yy += mm(1.5); }
  x.font = '400 ' + mm(2.4) + 'px ' + F; x.fillStyle = GA.palette.ink3; wrap(x, t('x34.aer.src', { d: idx.flight || '—', r: idx.resolution_m != null ? idx.resolution_m : '—' }), R - L).forEach(ln => { x.fillText(ln, rtl ? R : L, yy); yy += mm(3.8); });
  return c.toDataURL('image/png'); }'''
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.loadAerial)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    for aid in IDS:
      d = pg.evaluate(JS, [aid, SET, AER]); open(os.path.join(OUTD, f'aerial_{aid}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(aid, 'ok')
    print('errors:', errs[:5])
finally: srv.terminate()
