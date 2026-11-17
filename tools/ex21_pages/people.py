"""Exercise 2.1 print pages: who lives around the base (owner request, 16 Nov 2026), from data/ex21/people.json.
  ages  — mean age by census section at 1:10,000 (640 × 560 mm) and five small maps (under 18, 65+, Spanish nationality,
          income per person, one-person households);
  work  — what the employed residents do, by town (census), the soldiers question, the five towns in numbers.
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/people.py <out folder> [en|he|ar] [ages,work]"""
import sys, time, base64, subprocess, os
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else ['ages', 'work']
PORT = 8857; V3.PORT = PORT; V3.V2.PORT = PORT; KF = 3.8
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([m, KF]) => { await GA.ex21.ready(); await GA.ex21.readyPeople(); const PD = GA.ex21.people; const D = 200 / 25.4, mm = (v) => Math.round(v * D);
  const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl';
  const wrap = (x, s, maxW) => { const out = []; let line = ''; s.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); if (line) out.push(line); return out; };
  const leg = (x, items, lx, ly, cw, cols, sz) => items.forEach((it, j) => { const col = j % cols, xx = rtl ? lx + (cols - 1 - col) * cw : lx + col * cw, yy = ly + Math.floor(j / cols) * mm(sz * 2.3); const sw = mm(sz * 2.6), sh = mm(sz * 1.2); const sx = rtl ? xx + cw - sw : xx;
    x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sx, yy - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = '#8C817A'; x.lineWidth = 2; x.strokeRect(sx, yy - sh / 2, sw, sh);
    x.font = '500 ' + mm(sz) + 'px ' + F; x.fillStyle = GA.palette.ink; x.textBaseline = 'middle'; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.fillText(it.label, rtl ? sx - mm(sz * 0.6) : sx + sw + mm(sz * 0.6), yy, cw - sw - mm(sz)); });
  if (m === 'ages') { const MW = mm(640), MH = mm(560), mg = mm(20), W = MW + 2 * mg, mapY = mm(20); const L = mg, R = W - mg; const sw = (R - L - 4 * mm(8)) / 5, sh = sw * 5600 / 6400;
    const legY = mapY + MH + mm(10), smY = legY + mm(22), H = smY + mm(4) + sh + mm(36) + mm(30);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink;
    // the titles are written on the maps themselves, in grey (owner, Map Studio 17 Nov 2026)
    GA.ex21.drawPeople(x, L, mapY, MW, MH, { t, only: 'age', k: KF, title: t('x37.title', { y: PD.adrh_year }) + ' · 1:10,000', titlePx: mm(7.5) });
    leg(x, GA.ex21.peopleLegend('age', t).map((q, i) => i === 0 ? Object.assign(q, { label: t('x37.m.age') + ': ' + q.label }) : q), L, legY, (R - L) / 5, 5, 5);
    ['u18', 'o65', 'es', 'inc', 'one'].forEach((key, i) => { const sx = rtl ? R - (i + 1) * sw - i * mm(8) : L + i * (sw + mm(8)); x.font = '700 ' + mm(5.5) + 'px ' + F; x.fillStyle = GA.palette.ink; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr';
      GA.ex21.drawPeople(x, sx, smY + mm(2), sw, sh, { t, only: key, k: sw / 1000 * 1.6, small: true, title: t('x37.m.' + key), titlePx: mm(4) });
      leg(x, GA.ex21.peopleLegend(key, t), sx, smY + mm(8) + sh, sw / 2, 2, 3.4); });
    x.font = '400 ' + mm(4) + 'px ' + F; x.fillStyle = GA.palette.ink3; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr';
    wrap(x, t('x37.src', { y: PD.adrh_year }), R - L).forEach((ln, i) => x.fillText(ln, rtl ? R : L, H - mm(22) + i * mm(5.6)));
    return c.toDataURL('image/png'); }
  // work page (A2 landscape 594 × 420 mm)
  const W = mm(594), H = mm(420), L = mm(18), R = W - mm(18); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const T = PD.towns, FIVE = GA.ex21.TFIVE; const yr = T.Armilla.census_year || T.Armilla.activity_year;
  x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = GA.palette.ink3; x.font = '600 ' + mm(9) + 'px ' + F; x.fillText(t('x37.work.title', { y: yr }), rtl ? R : L, mm(20), R - L);   // every title in grey (owner, Map Studio 17 Nov 2026)
  const items = GA.ex21.drawBranchBars(x, L, mm(30), R - L, mm(120), { t, k: KF * 1.1 });
  leg(x, items, L, mm(160), (R - L) / 3, 3, 4);
  const pubs = FIVE.map(tn => T[tn].branch.public / T[tn].employed * 100); x.font = '600 ' + mm(5) + 'px ' + F; x.fillStyle = GA.palette.red; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr';
  let yy = mm(206); wrap(x, t('x37.soldiers', { a: Math.min(...pubs).toFixed(1), b: Math.max(...pubs).toFixed(1), g: (T.Granada.branch.public / T.Granada.employed * 100).toFixed(1) }), R - L).forEach(ln => { x.fillText(ln, rtl ? R : L, yy); yy += mm(7); });
  // the table
  yy += mm(8); x.fillStyle = GA.palette.ink3; x.font = '600 ' + mm(6) + 'px ' + F; x.fillText(t('x37.tb.title'), rtl ? R : L, yy); yy += mm(10);
  const cols = ['town', 'pop', 'age', 'u18', 'o65', 'foreign', 'hh', 'inc', 'unemp', 'higher']; const cw = (R - L) / (cols.length + 1.2); const cx = (i) => rtl ? R - (i === 0 ? 0 : (i + 1.2) * cw) : L + (i === 0 ? 0 : (i + 1.2) * cw);
  x.direction = 'ltr'; x.font = '600 ' + mm(4) + 'px ' + F; x.fillStyle = GA.palette.ink3; cols.forEach((k2, i) => { x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.fillText(t('x37.tb.' + k2), cx(i), yy, i === 0 ? 2.1 * cw : cw - mm(2)); });
  x.strokeStyle = '#C5C0B3'; x.lineWidth = 2; x.beginPath(); x.moveTo(L, yy + mm(2.5)); x.lineTo(R, yy + mm(2.5)); x.stroke(); yy += mm(9);
  FIVE.concat(['Granada']).forEach(tn => { const o = T[tn], a = o.adrh, ed = o.education15, edT = Object.values(ed).reduce((p, q) => p + q, 0);
    const v = [tn === 'Granada' ? t('x37.granada') : tn, Math.round(a.pop).toLocaleString('en-US'), a.age.toFixed(1), a.u18.toFixed(1) + ' %', a.o65.toFixed(1) + ' %', (100 - a.es).toFixed(1) + ' %', a.hh.toFixed(1), a.inc ? '€' + Math.round(a.inc).toLocaleString('en-US') : '—', o.unemployment_pct + ' %', (ed.higher / edT * 100).toFixed(0) + ' %'];
    x.font = (tn === 'Granada' ? '400 ' : '600 ') + mm(4.4) + 'px ' + F; x.fillStyle = tn === 'Granada' ? GA.palette.ink3 : GA.palette.ink; v.forEach((s0, i) => { x.textAlign = rtl ? 'right' : 'left'; x.direction = i === 0 && rtl ? 'rtl' : 'ltr'; x.fillText(s0, cx(i), yy, i === 0 ? 2.1 * cw : cw - mm(2)); }); yy += mm(8); });
  x.font = '400 ' + mm(3.6) + 'px ' + F; x.fillStyle = GA.palette.ink3; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; yy = H - mm(16);
  wrap(x, t('x37.src2', { y: yr, a: PD.adrh_year }), R - L).forEach(ln => { x.fillText(ln, rtl ? R : L, yy); yy += mm(5); });
  return c.toDataURL('image/png'); }'''
# print resolution (env DPI, default 200); line weights given in mm scale with it
DPI = float(os.environ.get('DPI', 200))
JS = JS.replace('const D = 200 / 25.4', f'const D = {DPI} / 25.4')
KF = KF * DPI / 200
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/palette.js', 'js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawPeople)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    for m in ONLY:
      d = pg.evaluate(JS, [m, KF]); n = {'ages': '01_ages', 'work': '02_work'}[m]
      open(os.path.join(OUTD, f'people_{n}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(m, 'ok')
    print('errors:', errs[:5])
finally: srv.terminate()
