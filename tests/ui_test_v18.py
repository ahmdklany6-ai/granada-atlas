"""v18 — build 5.20: the "Essentials: southern axis" layers.
A. Data files: valid GeoJSON, metro track 4.4–5.0 km ending at Las Gabias, tram line and two 1931 stations, the Escúzar estate
   with IFMIF-DONES / Lidl / Amazon / Knauf, the village (826) and the terminus → accelerator gap (≈ 10.7 km); manifest entries
   with source, licence and limitations; dataVersion bumped.
B. First visit (empty browser storage): the three layers are ON, their group is first in the Layers panel, they load (status ok,
   feature counts as in the files) and all panels stay closed.
C. A returning visitor whose saved layer state predates 5.20 also gets them ON (new layers are not hidden by an old save).
D. Paint = legend = palette.south; legends in ar / he / en have no missing keys; the legend shows the measured lengths/areas.
E. "Show on the map" fits the layer; clicking the IFMIF-DONES plot and the metro terminus opens popups with the cited figures.
Usage: python3 tests/ui_test_v18.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, math
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8818; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v18shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
IDS = ['south_metro', 'tram_1931', 'escuzar_pole']
KX = 111320 * math.cos(math.radians(37.12)); KY = 110540
def length_m(c): return sum(math.hypot((c[i + 1][0] - c[i][0]) * KX, (c[i + 1][1] - c[i][1]) * KY) for i in range(len(c) - 1))

# ---------- A. data ----------
J = {k: json.load(open(os.path.join(ROOT, 'data', 'vec', k + '.json'), encoding='utf-8')) for k in IDS}
man = json.load(open(os.path.join(ROOT, 'data', 'manifest.json'), encoding='utf-8'))
track = [f for f in J['south_metro']['features'] if f['properties']['k'] == 'track'][0]
L = length_m(track['geometry']['coordinates'])
check(4400 < L < 5000 and abs(L - track['properties']['len_m']) < 2, f'metro track {L:.0f} m (official 4.6–4.7 km)')
end = track['geometry']['coordinates'][-1]; term = [f for f in J['south_metro']['features'] if f['properties']['k'] == 'terminus'][0]['geometry']['coordinates']
check(end == term and -3.67 < end[0] < -3.66 and 37.13 < end[1] < 37.14, 'track ends at the Las Gabias terminus (Plaza Estación de Tranvías)', end)
tr = J['tram_1931']['features']
check(sum(f['properties']['k'] == 'station' for f in tr) == 2 and any(f['properties']['k'] == 'gabia' for f in tr), 'tram 1931: Gabia line and two printed stations')
pk = [f['properties'] for f in J['escuzar_pole']['features']]
for k in ('estate', 'science', 'logistics', 'industry', 'village', 'gap'): check(any(p['k'] == k for p in pk), f'Escúzar pole has a "{k}" feature')
vil = [p for p in pk if p['k'] == 'village'][0]; gap = [p for p in pk if p['k'] == 'gap'][0]
check(vil['pop'] == 826 and vil['pop_year'] == 2025, 'village population 826 (INE 2025)')
check(10 <= gap['km'] <= 11.5, f'terminus → IFMIF-DONES gap {gap["km"]} km')
for k in IDS:
    m = man['layers'].get(k) or {}
    check(all(m.get(x) for x in ('source', 'license', 'date', 'limitations')) and m.get('features') == len(J[k]['features']), f'manifest entry {k} (source, licence, date, limitations, count)')
check(man['dataVersion'] >= '2026-11-07', 'dataVersion bumped', man['dataVersion'])

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(saved=None):
            ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script('window.__noPanelHook = true;')
            if saved is not None: ctx.add_init_script(f'try {{ localStorage.setItem("granada-atlas.layers.v1", {json.dumps(json.dumps(saved))}); }} catch (e) {{}}')
            pg = ctx.new_page(); V3.stub3(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.app.L', timeout=90000)
            pg.wait_for_function('["south_metro","tram_1931","escuzar_pole"].every(k => GA.app.L.S[k] && GA.app.L.S[k].status === "ok")', timeout=120000)
            return ctx, pg, errs
        # ---------- B. first visit ----------
        ctx, pg, errs = boot()
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.20' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        st = pg.evaluate('Object.fromEntries(["south_metro","tram_1931","escuzar_pole"].map(k => [k, [GA.app.L.S[k].on, GA.app.L.S[k].status, GA.app.L.S[k].statusExtra]]))')
        for k in IDS: check(st[k][0] is True and st[k][1] == 'ok' and st[k][2] == len(J[k]['features']), f'{k} on at first visit and loaded ({st[k]})')
        vis = pg.evaluate('["ly-smetro","ly-tram","ly-pole-fill","ly-pole-estate","ly-pole-vil"].map(l => GA.app.map.getLayer(l) && GA.app.map.getLayoutProperty(l, "visibility"))')
        check(all(v == 'visible' for v in vis), 'map layers visible', vis)
        closed = pg.evaluate('["analysis","study","layers"].map(k => GA.panels.isOpen(k))'); check(not any(closed), 'all panels closed at start', closed)
        pg.evaluate('GA.panels.set("layers", true)'); time.sleep(0.6)
        first = pg.evaluate('(document.querySelector("#panel-layers .lyr-group") || {}).textContent');
        check(first == pg.evaluate('GA.i18n.t("ly.g.south")'), 'southern-axis group is first in the Layers panel', first)
        # ---------- D. palette and legends ----------
        P = pg.evaluate('GA.palette.south')
        paint = pg.evaluate('({ metro: GA.app.map.getPaintProperty("ly-smetro","line-color"), tram: GA.app.map.getPaintProperty("ly-tram","line-color"), estate: GA.app.map.getPaintProperty("ly-pole-estate","line-color") })')
        check(paint['metro'] == P['metro'] and paint['tram'] == P['tram'] and paint['estate'] == P['estate'], 'paint colours come from palette.south', paint)
        for lang in ('ar', 'he', 'en'):
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.5)
            lg = pg.evaluate('GA.app.L.legendHTML()')
            blk = [x for x in IDS if f'data-ly="{x}"' in lg]
            check(len(blk) == 3 and 'v18.' not in lg and 'ly.g.' not in lg, f'{lang}: three legend blocks, no missing strings')
            for c in (P['metro'], P['tram'], P['estate'], P['science'], P['logistics'], P['industry']): check(c in lg, f'{lang}: legend swatch {c}')
            check('4.7' in lg and '10.7' in lg and '826' in lg, f'{lang}: legend shows 4.7 km, 10.7 km, 826')
        pg.evaluate('GA.i18n.setLang("en")'); time.sleep(0.4)
        # ---------- E. fit + popups ----------
        pg.click('[data-ly-ctl="escuzar_pole"][data-k="fit"]'); time.sleep(2.5)
        bb = pg.evaluate('GA.app.map.getBounds().toArray()')
        check(bb[0][0] < -3.79 and bb[1][0] > -3.75 and bb[0][1] < 37.065 and bb[1][1] > 37.085, 'Show on the map fits the Escúzar estate', bb)
        dones = [f for f in J['escuzar_pole']['features'] if f['properties']['k'] == 'science'][0]['geometry']['coordinates'][0]
        def inside(x, y, r):
            c = False
            for i in range(len(r) - 1):
                (x1, y1), (x2, y2) = r[i], r[i + 1]
                if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
            return c
        xs = [x for x, y in dones]; ys = [y for x, y in dones]  # a point inside the (concave) plot, on a fine grid
        cx, cy = next((min(xs) + (max(xs) - min(xs)) * i / 20, min(ys) + (max(ys) - min(ys)) * j / 20) for i in range(1, 20) for j in range(1, 20) if inside(min(xs) + (max(xs) - min(xs)) * i / 20, min(ys) + (max(ys) - min(ys)) * j / 20, dones))
        pg.evaluate(f'GA.app.map.jumpTo({{ center: [{cx}, {cy}], zoom: 16 }})'); time.sleep(3)
        h = pg.evaluate(f'(() => {{ const pt = GA.app.map.project([{cx}, {cy}]); const r = GA.app.L.popupAt(pt); return r && r.html; }})()') or ''
        check('IFMIF-DONES' in h and '730' in h, 'IFMIF-DONES popup with the announced investment', h[:200])
        pg.evaluate(f'GA.app.map.jumpTo({{ center: {json.dumps(end)}, zoom: 16 }})'); time.sleep(3)
        h = pg.evaluate(f'(() => {{ const pt = GA.app.map.project({json.dumps(end)}); const r = GA.app.L.popupAt(pt); return r && r.html; }})()') or ''
        check('Las Gabias' in h, 'metro terminus popup', h[:200])
        pg.click('[data-ly-ctl="south_metro"][data-k="axis"]'); time.sleep(3)
        pg.evaluate('GA.panels.set("layers", false)'); time.sleep(1.5); pg.screenshot(path=os.path.join(OUT, 'axis_en.png'))
        pg.evaluate('GA.i18n.setLang("ar")'); time.sleep(1); pg.evaluate('GA.panels.set("layers", true)'); time.sleep(1); pg.screenshot(path=os.path.join(OUT, 'axis_ar_layers.png'))
        check(not errs, 'no page errors', errs[:3]); ctx.close()
        # ---------- C. returning visitor with a pre-5.20 save ----------
        ctx, pg, errs = boot({'layers': {'streets': {'on': True, 'opacity': 1}, 'bld_floors': {'on': False, 'opacity': 1}}, 'order': ['streets', 'bld_floors'], 'scope': 'city'})
        st = pg.evaluate('["south_metro","tram_1931","escuzar_pole"].map(k => GA.app.L.S[k].on)')
        check(all(st) and pg.evaluate('GA.app.L.S.streets.on') is True, 'old saved state: the new layers are on, the saved choices kept', st)
        order = pg.evaluate('GA.app.L.order'); check(order[:3] == IDS or set(order[:3]) == set(IDS), 'new layers on top of the drawing order', order[:5])
        check(not errs, 'no page errors (returning visitor)', errs[:3]); ctx.close()
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)))
sys.exit(1 if fails else 0)
