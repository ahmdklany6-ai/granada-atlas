"""v37 — build 5.48: the layers are no longer empty at the air base (owner request, 23 Nov 2026: "some of the layers we
made are empty at the base — bring everything at the base and around it into the site").
The five Exercise 1.3 analyses had one frame over the city that ends at y = 4,110,000, through the base. Now the base is a
fourth study area with its own 12 × 10 km frame (data/ex13b, same method, classes and colours), and the 10 m contours
reach the frame around the base (lines marked ext, drawn from the site's own MDT25).
Checks: the base is a study area (sidebar, card, marker) named in ar/he/en; each analysis is drawn there from the base frame
(layers ~b visible, data under the base), with base figures, in the panel's language; the legend names the base frame;
the city and factory frames are unchanged; the contours cover the base; no page errors.
Usage: python3 tests/ui_test_v37.py  (OUT=/dir)"""
import sys, os, time, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import _nointro  # start on the map, not the opening page
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8837; OUT = os.environ.get('OUT', '/tmp/v37shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{str(extra)[:300]}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
# data: the frame around the base, the contours around it
fr = json.load(open(os.path.join(ROOT, 'data/ex13b/frame.json'))); check(fr['id'] == 'base' and [fr['x0'], fr['y0'], fr['x1'], fr['y1']] == [437500, 4103500, 449500, 4113500], 'data/ex13b frame around the base (12 × 10 km)')
city = json.load(open(os.path.join(ROOT, 'data/ex13/frame.json'))); check(city['y0'] == 4110000, 'the city frame still ends at y = 4,110,000 (why the base needed its own)')
for n in ['density', 'morphology', 'centre', 'climate', 'human']: check(os.path.getsize(os.path.join(ROOT, 'data/ex13b', n + '.json')) > 1000, f'data/ex13b/{n}.json present')
cl = json.load(open(os.path.join(ROOT, 'data/ex13b/climate.json')))['stats']; check(cl['estate'] is not None and cl['missing_cells'] == 0, 'surface temperature measured inside the base, no missing cells', cl)
co = json.load(open(os.path.join(ROOT, 'data/vec/contours_10m.json')))['features']
ext = [f for f in co if f['properties'].get('ext')]; pts = [p for f in ext for l in f['geometry']['coordinates'] for p in l]
check(len(ext) > 20 and all(f['properties']['idx'] == (1 if f['properties']['elev'] % 50 == 0 else 0) for f in co), f'{len(ext)} extended 10 m contour levels, every 50 m indexed')
check(min(p[1] for p in pts) < 37.09 and max(p[0] for p in pts) > -3.58 and min(p[0] for p in pts) < -3.70, 'the contours reach south, east and west of the base')
man = json.load(open(os.path.join(ROOT, 'data/manifest.json'))); check('ex13b' in man and man['layers']['contours_10m']['features'] == len(co), 'manifest lists the base frame and the contour count')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader']); pg = b.new_page(viewport={'width': 1500, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append(str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready', timeout=120000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.48' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        for lang, word in [('ar', 'القاعدة'), ('he', 'הבסיס'), ('en', 'The base')]:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            side = pg.evaluate('document.querySelector("#atl-sec-areas [data-area=base]") && document.querySelector("#atl-sec-areas [data-area=base]").innerText')
            card = pg.evaluate('document.querySelector("#atl-panel .atl-card[data-area=base]") && document.querySelector("#atl-panel .atl-card[data-area=base]").innerText')
            mk = pg.evaluate('document.querySelector(".atl-mk-base") && document.querySelector(".atl-mk-base").innerText')
            check(bool(side) and word in side and bool(card) and word in card and bool(mk), f'{lang}: the base in the study-area list, as a card and as a map marker', (side, card, mk))
        pg.evaluate('GA.atlas.setArea("base")'); time.sleep(2.5)
        st = pg.evaluate('GA.atlas.state'); check(st['area'] == 'base', 'the base opens as the study area')
        intro = pg.evaluate('document.querySelector("#atl-panel").innerText'); check('371' in intro and '8.7' in intro and '42' in intro, 'the panel gives the base area, perimeter and the housing share of the fence', intro[:300])
        c = pg.evaluate('GA.app.map.getCenter().toArray()'); check(-3.66 < c[0] < -3.62 and 37.12 < c[1] < 37.14, 'the map flies to the base', c)
        for k in ['density', 'morphology', 'centre', 'climate', 'human']:
            pg.evaluate(f'GA.atlas.setTopic("{k}")'); time.sleep(4.5)
            cov = pg.evaluate('GA.atlas.coverage("base")'); ids = pg.evaluate(f'GA.atlas.topicLayers("{k}")')
            vis = pg.evaluate(f'GA.atlas.topicLayers("{k}").filter(id => GA.app.map.getLayoutProperty(id, "visibility") === "visible")')
            other = pg.evaluate(f'["{k}"].flatMap(() => GA.app.map.getStyle().layers.map(l => l.id)).filter(id => /^atl-/.test(id) && !/~b$/.test(id) && /^(atl-(den|fg|gap|cen|hist|peaks|lst|veg|far|park|square|pt))/.test(id) && GA.app.map.getLayoutProperty(id, "visibility") === "visible")')
            check(cov.get('ok') and cov.get('frame') == 'base' and ids and all(i.endswith('~b') for i in ids) and len(vis) == len(ids) and not other, f'{k}: drawn from the base frame ({len(vis)} layers ~b), no city/factory layer shown', (cov, ids, vis, other))
            ind = pg.evaluate(f'GA.atlas.indicators("{k}")'); txt = ' '.join(a + ' ' + b for a, b in ind)
            check(len(ind) >= 3 and ('base' in txt or 'fence' in txt) and 'estate' not in txt, f'{k}: {len(ind)} figures for the base', ind)
            lg = pg.evaluate('document.querySelector("#atl-panel .atl-lg").innerText'); check('around the base' in lg, f'{k}: the legend names the base frame')
            pg.screenshot(path=f'{OUT}/base_{k}.png')
        ind = pg.evaluate('GA.atlas.indicators("climate")'); check(any('51.3' in b for a, b in ind), 'climate inside the base: 51.3 °C (data/ex13b)', ind)
        pg.evaluate('GA.i18n.setLang("ar")'); time.sleep(0.5); ind = pg.evaluate('GA.atlas.indicators("climate")')
        check(any('القاعدة' in a for a, b in ind), 'the figures follow the language (Arabic)', ind)
        pg.evaluate('GA.i18n.setLang("en")')
        # the other frames are unchanged
        pg.evaluate('GA.atlas.setArea("factory")'); time.sleep(2); pg.evaluate('GA.atlas.setTopic("climate")'); time.sleep(3); ids = pg.evaluate('GA.atlas.topicLayers("climate")')
        check(ids and all(i.endswith('~f') for i in ids) and 'estate' in ' '.join(a for a, b in pg.evaluate('GA.atlas.indicators("climate")')), 'the factory keeps its own frame and figures')
        pg.evaluate('GA.atlas.setArea("city")'); time.sleep(2); pg.evaluate('GA.atlas.setTopic("climate")'); time.sleep(3); ids = pg.evaluate('GA.atlas.topicLayers("climate")')
        check(ids and not any(i.endswith(('~f', '~b')) for i in ids), 'the city keeps the city frame')
        check(not errs, 'no page errors', errs[:3])
finally:
    srv.terminate()
print(('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)), flush=True)
sys.exit(1 if fails else 0)
