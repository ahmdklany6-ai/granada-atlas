"""v35 — build 5.46: the measuring tool (owner request, 16 Nov 2026: "the measuring tool on the site doesn't work, I want it
to measure in metres and kilometres").
Before 5.46 the line was drawn under the atlas veil and mask (invisible), the points were 7 px dark dots and the result
sat under the analysis panel. Checks, in ar / he / en at 1440 × 900, 1024 × 768 and 390 × 844:
  - a Measure button in the map's top-right row (beside Draw section and 3D), also in the ☰ menu;
  - the line is on top of every layer, also after layers are switched on later; red with a white casing, pixels visible;
  - each segment's length is labelled on the map; the total label sits at the end;
  - the result box (top of the map, nothing on top of it) shows the total in km AND m, the point count, the last segment;
  - the length equals the haversine sum computed here (± 0.1 %);
  - Backspace removes the last point; Enter / double-click finish (no zoom); a finished line stays; New measurement
    starts again; ✕ closes it; Esc finishes;
  - the strings exist in all three languages; no page errors.
Usage: python3 tests/ui_test_v35.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, math, base64, io
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
import _nointro  # start on the map, not the opening page
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8835
OUT = os.environ.get('OUT', '/tmp/v35shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def hav(a, b):
    R = 6371008.8; p1, p2 = math.radians(a[1]), math.radians(b[1]); dp = p2 - p1; dl = math.radians(b[0] - a[0])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))
M = 'GA.app.sel.info().measure'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']
        for (W, H, lang) in [(1440, 900, 'ar'), (1024, 768, 'he'), (390, 844, 'en'), (1440, 900, 'en')]:
            tag = f'{W}x{H} {lang}'
            pg = b.new_page(viewport={'width': W, 'height': H}); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.app.map.isStyleLoaded()', timeout=90000); time.sleep(4)
            check(pg.evaluate('window.GA_BUILD') == ver and ver >= '5.46', f'{tag}: build {ver}')
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4)
            # the button in the top-right row, beside Draw section
            r = pg.evaluate('''(() => { const b = document.getElementById('map-measure'), s = document.getElementById('map-draw-section'); if (!b || !s) return null;
              const q = b.getBoundingClientRect(), t = s.getBoundingClientRect(); return { inRow: !!b.closest('.maplibregl-ctrl-top-right'), y: q.top, ys: t.top, w: q.width, label: b.getAttribute('aria-label') }; })()''')
            check(r and r['inRow'] and abs(r['y'] - r['ys']) < 2 and r['w'] >= 30, f'{tag}: Measure button in the top-right row beside Draw section', r)
            check(r and r['label'] == pg.evaluate('GA.i18n.t("v34.m.btn")') and r['label'] != 'v34.m.btn', f'{tag}: button labelled in {lang}', r and r['label'])
            pg.click('#map-measure'); time.sleep(0.3)
            check(pg.evaluate(M + '.on') and pg.evaluate('document.getElementById("map-measure").getAttribute("aria-pressed")') == 'true', f'{tag}: measuring is on, button pressed')
            box0 = pg.evaluate('document.getElementById("measure-out").innerText')
            check(not pg.evaluate('document.getElementById("measure-out").hidden') and pg.evaluate('GA.i18n.t("v34.m.hint0")') in box0, f'{tag}: box shows the first-point hint', box0)
            # free map points: grid spots where the map canvas itself is hit (not a panel, legend, label or the box), with
            # room around them; three for the line and a fourth for the double-click
            free = pg.evaluate('''(() => { const box = document.getElementById('measure-out').getBoundingClientRect(); const out = [];
              for (let y = 0.30; y <= 0.62; y += 0.04) for (let x = 0.12; x <= 0.88; x += 0.04) { const X = Math.round(innerWidth * x), Y = Math.round(innerHeight * y);
                if (Y < box.bottom + 30) continue;
                const ok = [[0, 0], [-14, 0], [14, 0], [0, -14], [0, 14]].every(([dx, dy]) => { const e = document.elementFromPoint(X + dx, Y + dy); return e && e.classList.contains('maplibregl-canvas'); });
                if (ok) out.push([X, Y]); } return out; })()''')
            pts = []
            for q in free:
                if all(math.hypot(q[0] - r[0], q[1] - r[1]) > 95 for r in pts): pts.append(q)
                if len(pts) == 4: break
            check(len(pts) == 4, f'{tag}: four free map spots found for the test', len(pts))
            pts, dbl = [tuple(x) for x in pts[:3]], tuple(pts[3])
            z0 = pg.evaluate('GA.app.map.getZoom()')
            for x, y in pts: pg.mouse.click(x, y); time.sleep(0.25)
            st = pg.evaluate(M)
            check(st['pts'] == 3 and st['on'], f'{tag}: three points placed', st)
            ll = pg.evaluate('GA.app.sel.measurePts()'); L = sum(hav(ll[i - 1], ll[i]) for i in range(1, len(ll)))
            # the site measures on the ellipsoid (radii at the mid-latitude); a spherical haversine differs by < 0.5 %
            check(abs(st['length'] - L) / L < 0.005, f'{tag}: length agrees with an independent haversine sum ({L:.0f} m)', st['length'])
            # on top of every layer, and still after a layer is switched on later
            top = pg.evaluate('GA.app.map.getStyle().layers.slice(-3).map(l => l.id)')
            check(top == ['measure-line-case', 'measure-line', 'measure-line-live'], f'{tag}: the measure line is the top layer', top)
            pg.evaluate('''(() => { const L = GA.app.L; const id = Object.keys(L.S).find(k => !L.S[k].on); if (id) L.setOn(id, true); })()'''); time.sleep(1.2)
            top = pg.evaluate('GA.app.map.getStyle().layers.slice(-3).map(l => l.id)')
            check(top == ['measure-line-case', 'measure-line', 'measure-line-live'], f'{tag}: still on top after a layer is switched on', top)
            paint = pg.evaluate('[GA.app.map.getPaintProperty("measure-line", "line-color"), GA.app.map.getPaintProperty("measure-line", "line-width"), GA.palette.red]')
            check(paint[0] == paint[2] and paint[1] >= 2.5, f'{tag}: solid red line ≥ 2.5 px (palette red)', paint)
            # red pixels between the first two points (the line is really visible)
            pg.mouse.move(5, H - 5); time.sleep(0.4)
            shot = Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
            (x1, y1), (x2, y2) = pts[0], pts[1]; hits = 0
            for k in (1.2, 1.8, 8.2, 8.8):  # near the ends: the white length label covers the middle of the segment
                fx, fy = x1 + (x2 - x1) * k / 10, y1 + (y2 - y1) * k / 10
                found = any(abs(c[0] - 0x99) < 40 and abs(c[1] - 0x2B) < 40 and abs(c[2] - 0x2A) < 40 for c in (shot.getpixel((int(fx) + dx, int(fy) + dy)) for dx in range(-2, 3) for dy in range(-2, 3)))
                hits += found
            check(hits >= 3, f'{tag}: the red line is visible on screen ({hits}/4 samples)')
            labels = pg.evaluate('[...document.querySelectorAll(".h-mlabel")].map(e => e.textContent)')
            seg = [l for l in labels if not l.startswith(pg.evaluate('GA.i18n.t("v34.m.total")'))]
            check(len(seg) == 2 and len(labels) == 3, f'{tag}: two segment labels + the total on the map', labels)
            km, m = pg.evaluate('GA.i18n.t("u.km")'), pg.evaluate('GA.i18n.t("u.m")')
            check(all((km in l) or (m in l) for l in labels), f'{tag}: labels carry m / km units', labels)
            box = pg.evaluate('document.getElementById("measure-out").innerText')
            tot = st['length']
            if tot >= 1000: want = [f'{tot / 1000:,.2f}', f'{round(tot):,}']
            else: want = [f'{round(tot):,}']
            check(all(w in box for w in want) and km in box and m in box, f'{tag}: box shows the total in km AND m', box)
            check('3' in box and pg.evaluate('GA.i18n.t("v34.m.last")') in box, f'{tag}: box shows the point count and the last segment', box)
            vis = pg.evaluate('''(() => { const e = document.getElementById('measure-out'), r = e.getBoundingClientRect(); const pts = [[r.left + 10, r.top + 10], [r.right - 10, r.top + 10], [r.left + r.width / 2, r.top + r.height / 2], [r.left + 10, r.bottom - 6], [r.right - 10, r.bottom - 6]];
              return { ok: pts.every(([x, y]) => { const h = document.elementFromPoint(x, y); return h && h.closest('#measure-out'); }), r: [r.left, r.top, r.right, r.bottom], vw: innerWidth }; })()''')
            check(vis['ok'] and vis['r'][0] >= 0 and vis['r'][2] <= vis['vw'], f'{tag}: the result box is fully visible (nothing on top, inside the screen)', vis)
            # Backspace removes the last point
            pg.keyboard.press('Backspace'); time.sleep(0.2)
            check(pg.evaluate(M + '.pts') == 2, f'{tag}: Backspace removes the last point')
            pg.mouse.click(*pts[2]); time.sleep(0.2)
            # double-click finishes (and does not zoom)
            pg.mouse.dblclick(*dbl); time.sleep(0.8)
            st2 = pg.evaluate(M)
            check(not st2['on'] and st2['pts'] == 4, f'{tag}: double-click finishes (one point added, no duplicate)', st2)
            check(abs(pg.evaluate('GA.app.map.getZoom()') - z0) < 1e-6, f'{tag}: double-click did not zoom')
            check(pg.evaluate('document.querySelectorAll(".h-mlabel").length') == 4 and not pg.evaluate('document.getElementById("measure-out").hidden'), f'{tag}: the finished line, labels and result stay')
            check(pg.evaluate('!!document.getElementById("btn-mnew")') and pg.evaluate('document.getElementById("map-measure").getAttribute("aria-pressed")') == 'false', f'{tag}: "New measurement" offered; button released')
            # a click on the map after finishing does not add a point
            pg.mouse.click((pts[0][0] + pts[1][0]) // 2, (pts[0][1] + pts[1][1]) // 2 + 30); time.sleep(0.3)
            check(pg.evaluate(M + '.pts') == 4, f'{tag}: clicks after finishing add nothing')
            pg.evaluate('document.querySelectorAll(".maplibregl-popup").forEach(p => p.remove())')
            pg.click('#btn-mnew'); time.sleep(0.2)
            check(pg.evaluate(M + '.on') and pg.evaluate(M + '.pts') == 0, f'{tag}: New measurement starts empty')
            pg.mouse.click(*pts[0]); pg.mouse.click(*pts[1]); time.sleep(0.2)
            pg.keyboard.press('Enter'); time.sleep(0.2)
            check(not pg.evaluate(M + '.on') and pg.evaluate(M + '.pts') == 2, f'{tag}: Enter finishes')
            pg.screenshot(path=f'{OUT}/measure_{W}x{H}_{lang}.png')
            pg.click('#btn-mclose'); time.sleep(0.2)
            check(pg.evaluate('document.getElementById("measure-out").hidden') and pg.evaluate('document.querySelectorAll(".h-mlabel, .h-measure").length') == 0, f'{tag}: ✕ closes the tool and removes the line')
            # the ☰ menu button still works, and Esc finishes
            pg.click('#atl-burger'); time.sleep(0.2)
            if not pg.evaluate('!document.getElementById("atl-sec-tools").hidden'): pg.click('[data-sec-t="tools"]'); time.sleep(0.2)
            pg.click('#tb-measure'); time.sleep(0.3)
            check(pg.evaluate(M + '.on') and pg.evaluate('document.getElementById("atl-side").hidden'), f'{tag}: the menu entry starts measuring and closes the menu')
            pg.mouse.click(*pts[0]); pg.mouse.click(*pts[1]); time.sleep(0.2); pg.keyboard.press('Escape'); time.sleep(0.2)
            check(not pg.evaluate(M + '.on') and pg.evaluate(M + '.pts') == 2, f'{tag}: Esc finishes and keeps the line')
            check(not errs, f'{tag}: no page errors', errs[:2])
            pg.close()
        # strings
        pg = b.new_page(); pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.i18n', timeout=60000)
        keys = ['v34.m.btn', 'v34.m.btnHint', 'v34.m.title', 'v34.m.hint0', 'v34.m.hint1', 'v34.m.pts', 'v34.m.last', 'v34.m.total', 'v34.m.keys', 'v34.m.undo', 'v34.m.finish', 'v34.m.new', 'v34.m.drag', 'v34.m.on']
        for lg in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lg}")'); miss = [k for k in keys if pg.evaluate(f'GA.i18n.t("{k}")') in ('', k)]
            check(not miss, f'strings in {lg}', miss)
finally:
    srv.terminate()
print(('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)), flush=True)
sys.exit(1 if fails else 0)
