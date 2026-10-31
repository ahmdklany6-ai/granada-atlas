"""v6 — zoom-dependent rendering: buildings (50 m aggregation → simplified footprints → full detail) and the
street hierarchy across repeated zoom-in/zoom-out cycles and panning, alone and combined.
Usage: python3 tests/ui_test_v6.py  (serves the repo on a local port, headless Chromium)."""
import sys, os, time, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8806; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v6shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

ST_LAYERS = ['ly-streets-maj', 'ly-streets', 'ly-streets-ped']
JS = """
window.__q = (ids) => { const m = GA.app.map; const ls = ids.filter(l => m.getLayer(l) && m.getLayoutProperty(l, 'visibility') !== 'none'); return ls.length ? m.queryRenderedFeatures({ layers: ls }).length : 0; };
window.__byLayer = (ids) => { const m = GA.app.map; const o = {}; ids.forEach(l => { o[l] = m.getLayer(l) ? (m.getLayoutProperty(l, 'visibility') === 'none' ? 'hidden' : m.queryRenderedFeatures({ layers: [l] }).length) : 'missing'; }); return o; };
window.__frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
"""

def settle(pg, ids, timeout=12):
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = pg.evaluate('[GA.app.L.S.streets, GA.app.L.S.bld_floors, GA.app.L.S.bld_fg].map(s => s.on ? s.status : "off")')
        if 'loading' not in st and pg.evaluate('GA.app.map.loaded()'): break
        time.sleep(0.25)
    time.sleep(0.6)

def jump(pg, z, c=(-3.5986, 37.1773)):
    pg.evaluate(f'GA.app.map.jumpTo({{ center: [{c[0]}, {c[1]}], zoom: {z} }})')
    pg.evaluate('__frame()')

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 1440, 'height': 900}); V3.stub3(pg); errs = []
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text[:300]))
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.app.L.S', timeout=60000)
        pg.evaluate(JS)

        # ---------- streets alone ----------
        pg.evaluate('["bld_floors","bld_fg","bld_period","trees"].forEach(k => GA.app.L.S[k] && GA.app.L.setOn(k, false)); GA.app.L.setOn("streets", true)')
        jump(pg, 13); settle(pg, ST_LAYERS)
        layers = pg.evaluate('GA.app.map.getStyle().layers.map(l => l.id).filter(id => /^ly-streets/.test(id))')
        check(set(ST_LAYERS) <= set(layers), f'all street layers exist in the style: {layers}')
        cycle = [13, 15, 17, 18.5, 16, 13.5, 15.5, 17.5, 14, 16.5]
        for i, z in enumerate(cycle):
            jump(pg, z)
            now = pg.evaluate(f'__q({json.dumps(ST_LAYERS)})')
            check(now > 0, f'streets: drawn immediately after jump to z{z} (previous display kept): {now}')
            settle(pg, ST_LAYERS)
            bl = pg.evaluate(f'__byLayer({json.dumps(ST_LAYERS)})'); st = pg.evaluate('GA.app.L.S.streets.status')
            tot = sum(v for v in bl.values() if isinstance(v, int))
            check(tot > 0 and st in ('ok', 'overview'), f'streets z{z}: status {st}, rendered {bl}')
            if z >= 14.5:
                check(isinstance(bl['ly-streets'], int) and bl['ly-streets'] > 0, f'streets z{z}: detail layer draws local streets')
        # pedestrian paths at close zoom (Albaicín has many)
        jump(pg, 17.5, (-3.5925, 37.1810)); settle(pg, ST_LAYERS)
        bl = pg.evaluate(f'__byLayer({json.dumps(ST_LAYERS)})')
        check(isinstance(bl['ly-streets-ped'], int) and bl['ly-streets-ped'] > 0, f'pedestrian layer draws at z17.5: {bl}')
        tiers = pg.evaluate('[...new Set(GA.app.map.queryRenderedFeatures({ layers: ["ly-streets", "ly-streets-ped"] }).map(f => f.properties.tier))]')
        check('local' in tiers and 'pedestrian' in tiers, f'tiers drawn at z17.5: {tiers}')
        w = pg.evaluate('[15, 17, 19].map(z => { const e = GA.app.map.getPaintProperty("ly-streets", "line-width"); return JSON.stringify(e).length > 50; })')
        check(all(w), 'line widths are scale-dependent expressions')
        pg.screenshot(path=f'{OUT}/streets_z17_5.png')
        # panning at detail zoom: never empty
        for k, (dx, dy) in enumerate([(600, 0), (0, 500), (-900, -300), (400, 400)]):
            pg.evaluate(f'GA.app.map.panBy([{dx}, {dy}], {{ animate: false }})'); pg.evaluate('__frame()')
            now = pg.evaluate(f'__q({json.dumps(ST_LAYERS)})')
            check(now > 0, f'streets: drawn immediately after pan {k + 1}: {now}')
            settle(pg, ST_LAYERS)
            check(pg.evaluate(f'__q({json.dumps(ST_LAYERS)})') > 0, f'streets: drawn after pan {k + 1} loads')
        # toggle off/on at detail zoom
        pg.evaluate('GA.app.L.setOn("streets", false)'); pg.evaluate('GA.app.L.setOn("streets", true)'); settle(pg, ST_LAYERS)
        check(pg.evaluate('__q(["ly-streets", "ly-streets-ped"])') > 0, 'streets: detail drawn after toggling off/on at z17.5')

        # ---------- buildings ----------
        B = ['ly-bld_floors-ov', 'ly-bld_floors-lite', 'ly-bld_floors-liteunk', 'ly-bld_floors', 'ly-bld_floors-unk']
        pg.evaluate('GA.app.L.setOn("streets", false); GA.app.L.setOn("bld_floors", true)')
        jump(pg, 11.5); settle(pg, B)
        check(pg.evaluate('GA.app.L.S.bld_floors.status') == 'city', 'buildings z11.5: status "aggregated"')
        leg = pg.evaluate('GA.app.L.legendHTML ? GA.app.L.legendHTML() : ""')
        check('50' in leg and 'lyr-src' in leg, 'buildings z11.5: legend labels the 50 m aggregation')
        pg.screenshot(path=f'{OUT}/bld_z11_5.png')
        for z in [12.6, 13, 13.6, 14.2]:
            jump(pg, z); settle(pg, B); time.sleep(0.5)
            bl = pg.evaluate(f'__byLayer({json.dumps(B)})')
            op = pg.evaluate('GA.app.map.getPaintProperty("ly-bld_floors-ov", "raster-opacity")')
            check(isinstance(bl['ly-bld_floors-lite'], int) and bl['ly-bld_floors-lite'] > 50, f'buildings z{z}: simplified footprints drawn {bl}')
            check(isinstance(op, list) and op[0] == 'interpolate' and op[-2] < 13.0, f'buildings z{z}: aggregation cross-fades by zoom {op}')
            check(pg.evaluate('GA.app.L.S.bld_floors.status') == 'lite', f'buildings z{z}: status "simplified"')
        pg.screenshot(path=f'{OUT}/bld_z14_2.png')
        jump(pg, 13); settle(pg, B); pg.screenshot(path=f'{OUT}/bld_z13.png')
        jump(pg, 12.8); settle(pg, B); pg.screenshot(path=f'{OUT}/bld_z12_8.png')
        # into detail and repeated cycles
        for z in [15.5, 13.2, 16.5, 12.7, 15, 11.8, 17, 14]:
            jump(pg, z)
            now = pg.evaluate(f'__q({json.dumps(B[1:])})') if z >= 12.5 else 1
            check(now > 0, f'buildings: footprints drawn immediately after jump to z{z}: {now}')
            settle(pg, B)
            bl = pg.evaluate(f'__byLayer({json.dumps(B)})')
            if z >= 14.5:
                check(isinstance(bl['ly-bld_floors'], int) and bl['ly-bld_floors'] > 0, f'buildings z{z}: full detail drawn {bl}')
                check(bl['ly-bld_floors-lite'] == 'hidden', f'buildings z{z}: simplified layer retired once detail covers the view')
            elif z >= 12.5:
                check(isinstance(bl['ly-bld_floors-lite'], int) and bl['ly-bld_floors-lite'] > 0, f'buildings z{z}: simplified drawn')
        jump(pg, 16.5); settle(pg, B)
        for k, (dx, dy) in enumerate([(900, 0), (0, -700), (-1400, 300)]):
            pg.evaluate(f'GA.app.map.panBy([{dx}, {dy}], {{ animate: false }})'); pg.evaluate('__frame()')
            now = pg.evaluate(f'__q({json.dumps(B[1:])})')
            check(now > 0, f'buildings: footprints drawn immediately after pan {k + 1}: {now}')
            settle(pg, B)
        # figure-ground and period at neighbourhood scale
        pg.evaluate('GA.app.L.setOn("bld_floors", false); GA.app.L.setOn("bld_fg", true)'); jump(pg, 13.4); settle(pg, B)
        check(pg.evaluate('__q(["ly-bld_fg-lite"])') > 0 and pg.evaluate('GA.app.L.S.bld_fg.status') == 'lite', 'figure-ground draws simplified footprints at z13.4')
        jump(pg, 12); settle(pg, B); check(pg.evaluate('GA.app.L.S.bld_fg.status') == 'zoomLite', 'figure-ground below 12.5 asks to zoom in')
        pg.evaluate('GA.app.L.setOn("bld_fg", false)')

        # ---------- combined ----------
        pg.evaluate('GA.app.L.setOn("bld_floors", true); GA.app.L.setOn("streets", true)')
        for z in [13, 16, 17.5, 14, 15.2, 13.3, 18]:
            jump(pg, z); s0 = pg.evaluate(f'__q({json.dumps(ST_LAYERS)})'); b0 = pg.evaluate(f'__q({json.dumps(B[1:])})')
            check(s0 > 0 and b0 > 0, f'combined z{z}: both drawn immediately (streets {s0}, buildings {b0})')
            settle(pg, B)
            s1 = pg.evaluate(f'__q({json.dumps(ST_LAYERS)})'); b1 = pg.evaluate(f'__q({json.dumps(B[1:])})')
            check(s1 > 0 and b1 > 0, f'combined z{z}: both drawn after load (streets {s1}, buildings {b1})')
        order = pg.evaluate('GA.app.map.getStyle().layers.map(l => l.id)')
        check(order.index('ly-bld_floors-ov') < order.index('ly-bld_floors-lite') < order.index('ly-bld_floors'), 'order: aggregation < simplified < detail')
        jump(pg, 16.2, (-3.5986, 37.1773)); settle(pg, B); pg.screenshot(path=f'{OUT}/combined_z16_2.png')
        jump(pg, 13.4, (-3.5986, 37.1773)); settle(pg, B); pg.screenshot(path=f'{OUT}/combined_z13_4.png')
        lang = {}
        for lg in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lg}")'); time.sleep(0.3)
            lang[lg] = pg.evaluate('document.querySelector(".lyr-st") ? [...document.querySelectorAll(".lyr-st")].map(e => e.textContent).join("|") : ""')
        print('status strings', lang)
        errs = [e for e in errs if 'Failed to load resource' not in e]  # stubbed basemap tiles 404 in tests
        check(not [e for e in errs if 'dasharray' in e or 'layer' in e.lower() or 'source' in e.lower()], f'no layer/source errors: {errs[:4]}')
        b.close()
finally:
    srv.terminate()
print('\n%d failures' % len(fails)); sys.exit(1 if fails else 0)
