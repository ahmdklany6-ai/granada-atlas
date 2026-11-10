"""v23 — build 5.25: the Atlas shell. One slim bar with ☰; the sidebar holds the five research requirements, the study
areas, every GIS layer (the Layers panel moved in), historical maps, tools and pages (the old navigation), display and
export. WHERE (city / factory / metro) × WHAT (five topics) drive the map: topic layers from data/ex13, a reveal
animation, the context panel (indicators for the selected area, legend from the palette classes, sources), the city
growth animation from the documented built-up extents, markers, Back to Granada. The factory lies outside the analysis
frame → "no data" with what is missing; metro-corridor figures are cross-checked with shapely. ar / he / en, phone.
Usage: python3 tests/ui_test_v23.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, warnings
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _nointro  # 5.27: start on the map, not the opening page
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8823; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v23shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)

# ---------- independent reference values (shapely) for the metro corridor ----------
from shapely.geometry import shape, Point
from shapely.ops import transform as T
from pyproj import Transformer
u = Transformer.from_crs('EPSG:4326', 'EPSG:25830', always_xy=True)
tr = [f for f in json.load(open(os.path.join(ROOT, 'data/vec/south_metro.json')))['features'] if f['properties']['k'] == 'track'][0]
corr = T(lambda x, y, z=None: u.transform(x, y), shape(tr['geometry'])).buffer(600)
den = json.load(open(os.path.join(ROOT, 'data/ex13/density.json'))); cx, cy = den['corners']['x'], den['corners']['y']; ref_pop = 0.0
for r, row in enumerate(den['pop']):
    for q, p in enumerate(row):
        if p and corr.contains(Point((cx[r][q] + cx[r + 1][q + 1]) / 2, (cy[r][q] + cy[r + 1][q + 1]) / 2)): ref_pop += p
cen = json.load(open(os.path.join(ROOT, 'data/ex13/centre.json'))); ref_places = sum(1 for p in cen['points'] if corr.contains(Point(p[0], p[1])))
print(f'reference: corridor residents {ref_pop:.0f}, places {ref_places}', flush=True)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(vp, mobile=False):
            ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile); ctx.add_init_script('window.__noPanelHook = true; window.__gaLegacyView = false;'); pg = ctx.new_page(); V3.stub3(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready', timeout=120000); time.sleep(1.5)
            return ctx, pg, errs
        ctx, pg, errs = boot({'width': 1440, 'height': 900})
        pg.evaluate('GA.i18n.setLang("en")'); time.sleep(0.6)  # the English pass (the site opens in Arabic)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.25' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        # ---------- shell ----------
        r = pg.evaluate('''(() => { const v = (e) => !!e && !!(e.offsetWidth || e.offsetHeight) && getComputedStyle(e).visibility !== 'hidden';
            return { atlas: document.body.classList.contains('atlas'), burger: v(document.querySelector('#atl-burger')), navInSide: !!document.querySelector('#atl-side #tb-nav'), navVisible: v(document.querySelector('#tb-nav')),
              layersInSide: !!document.querySelector('#atl-side #panel-layers'), tabs: [...document.querySelectorAll('.pn-tabs')].some(v), phoneBar: v(document.querySelector('#phone-bar')), langInSide: !!document.querySelector('#atl-side #lang'),
              topH: document.querySelector('.topbar').offsetHeight }; })()''')
        check(r['atlas'] and r['burger'] and r['navInSide'] and not r['navVisible'] and r['layersInSide'] and r['langInSide'] and not r['tabs'] and not r['phoneBar'], 'one ☰ button; navigation, language and Layers panel moved into the closed sidebar; no panel tabs or phone bar', r)
        check(r['topH'] <= 50, f'slim top bar ({r["topH"]} px)')
        st = pg.evaluate('GA.atlas.state'); check(st['area'] == 'city' and st['topic'] is None, 'opens on the whole city, no study area, no topic', st)
        bb = pg.evaluate('(() => { const b = GA.app.map.getBounds(); return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; })()')
        check(bb[0] < -3.762 and bb[1] < 37.081 and bb[2] > -3.59 and bb[3] > 37.20, 'the first view holds the whole city and both study areas', bb)
        check(pg.evaluate('document.querySelectorAll(".atl-mk").length') == 2, 'two clickable study-area markers (factory, metro)')
        check(st['growing'], 'the city animation runs at start (documented built-up extents)')
        g1 = pg.evaluate('GA.app.map.getSource("atl-growth")._data.features.length'); time.sleep(3.2); g2 = pg.evaluate('GA.app.map.getSource("atl-growth")._data.features.length')
        check(g1 != g2 or g1 > 0, f'growth animation advances ({g1} → {g2} extents)')
        pg.screenshot(path=f'{OUT}/en_start.png')
        pg.click('#atl-burger'); time.sleep(0.5)
        secs = pg.evaluate('[...document.querySelectorAll("#atl-side .atl-sec-h .atl-sec-n")].map(e => e.innerText)')
        check(len(secs) == 7 and pg.evaluate('!document.querySelector("#atl-side").hidden'), f'sidebar with 7 sections {secs}')
        topics = pg.evaluate('[...document.querySelectorAll("#atl-sec-research [data-topic]")].filter(b => b.dataset.topic).map(b => b.innerText.replace(/\\s+/g, " ").trim())')
        names = pg.evaluate('["density","morphology","centre","climate","human"].map(k => GA.i18n.t("e13.t." + k))')
        check(len(topics) == 5 and all(n in tpc for n, tpc in zip(names, topics)), f'the five research requirements, named as in Exercise 1.3 {topics}')
        pg.screenshot(path=f'{OUT}/en_menu.png')
        # layers in the sidebar: checkbox, opacity, reset
        pg.click('[data-sec-t="layers"]'); time.sleep(0.4)
        check(pg.evaluate('!document.querySelector("#atl-sec-layers").hidden && document.querySelectorAll("#atl-sec-layers [data-ly]").length') > 20, 'every GIS layer listed in the sidebar with its checkbox')
        pg.check('#atl-sec-layers input[data-ly="parks"]'); time.sleep(0.8); check(pg.evaluate('GA.app.L.S.parks.on'), 'a layer switches on from the sidebar')
        check(pg.evaluate('!!document.querySelector("#atl-sec-layers [data-ly-op=parks]")'), 'opacity control for an active layer')
        pg.click('[data-atl-reset="layers"]'); time.sleep(0.6); check(not pg.evaluate('GA.app.L.S.parks.on') and pg.evaluate('GA.app.L.S.south_metro.on'), 'Reset layers restores the documented defaults')
        pg.click('#atl-side-x'); time.sleep(0.3)
        # ---------- WHAT at city scale ----------
        pg.evaluate('GA.atlas.setTopic("density")'); time.sleep(6)
        vis = pg.evaluate('GA.atlas.topicLayers("density").map(id => [GA.app.map.getLayoutProperty(id, "visibility"), GA.app.map.getPaintProperty(id, "fill-opacity")])')
        check(len(vis) == 6 and all(v[0] == 'visible' and v[1] > 0 for v in vis), 'density: six class layers shown after the reveal', vis)
        check(pg.evaluate('GA.app.map.getLayoutProperty("atl-veil", "visibility")') == 'visible', 'unrelated layers subdued (veil), not removed')
        lg = pg.evaluate('document.querySelectorAll("#atl-panel .atl-lg li").length'); check(lg >= 7, f'legend under the panel: classes + frame ({lg})')
        txt = pg.evaluate('document.querySelector("#atl-panel").innerText'); check('325,935' in txt and '39,785' in txt, 'city indicators = the audited frame values')
        cols = pg.evaluate('GA.atlas.topicLayers("density").map(id => GA.app.map.getPaintProperty(id, "fill-color"))'); check(cols == pg.evaluate('GA.palette.ex13.density'), 'map classes use the palette (same as the legend and the A3 page)')
        pg.screenshot(path=f'{OUT}/en_city_density.png')
        # ---------- WHERE: metro, keep the topic ----------
        pg.click('.atl-mk-metro'); time.sleep(3)
        st = pg.evaluate('GA.atlas.state'); check(st['area'] == 'metro' and st['topic'] == 'density', 'metro marker → metro area, density analysis kept', st)
        check(pg.evaluate('!document.querySelector("#atl-back").hidden'), 'Back to Granada visible')
        check(pg.evaluate('GA.app.map.getLayoutProperty("atl-corr", "visibility")') == 'visible', 'corridor shown, outside faded')
        ind = pg.evaluate('GA.atlas.indicators("density")'); pop = float(ind[0][1].split(' ')[0].replace(',', ''))
        check(abs(pop - ref_pop) <= max(30, ref_pop * 0.01), f'corridor residents {pop:.0f} = shapely reference {ref_pop:.0f} (± 1 %, rounded to 10)')
        ip = pg.evaluate('GA.atlas.indicators("centre")'); n = int(ip[0][1].split(' ')[0].replace(',', ''))
        check(abs(n - ref_places) <= 2, f'corridor shops and services {n} = shapely reference {ref_places}')
        z0 = pg.evaluate('[GA.app.map.getZoom(), GA.app.map.getCenter().lng, GA.app.map.getCenter().lat]')
        pg.evaluate('GA.atlas.setTopic("climate")'); time.sleep(6)
        z1 = pg.evaluate('[GA.app.map.getZoom(), GA.app.map.getCenter().lng, GA.app.map.getCenter().lat]')
        check(abs(z0[0] - z1[0]) < 0.01 and abs(z0[1] - z1[1]) < 1e-5, 'switching topic keeps the geographic focus (no re-zoom)', (z0, z1))
        lst = pg.evaluate('GA.atlas.indicators("climate")'); check(lst and '°C' in lst[0][1], f'corridor climate indicator {lst[:1]}')
        check(pg.evaluate('GA.atlas.topicLayers("density").every(id => GA.app.map.getLayoutProperty(id, "visibility") === "none")'), 'previous topic hidden on switch')
        pg.screenshot(path=f'{OUT}/en_metro_climate.png')
        # ---------- WHERE: factory — since 5.26 it has its own analysis frame (data/ex13f; checked in depth by ui_test_v24 item 12) ----------
        pg.evaluate('document.querySelector(".atl-mk-factory").click()'); time.sleep(4)  # the marker may lie off-screen at metro zoom
        txt = pg.evaluate('document.querySelector("#atl-panel").innerText'); c = pg.evaluate('GA.atlas.coverage("factory")')
        check(c['ok'] and c.get('frame') == 'factory' and 'No data for this area' not in txt and '°C' in txt, 'factory: its own analysis frame — real climate values, no "no data" block', (c, txt[:200]))
        pg.screenshot(path=f'{OUT}/en_factory_climate.png')
        pg.click('#atl-back'); time.sleep(2.5)
        st = pg.evaluate('GA.atlas.state'); check(st['area'] == 'city' and pg.evaluate('document.querySelector("#atl-back").hidden'), 'Back to Granada → city', st)
        pg.evaluate('GA.atlas.setTopic(null)'); time.sleep(1.5); check(pg.evaluate('GA.atlas.state.growing'), 'no topic at city scale → the city animation runs again')
        for k in ['morphology', 'centre', 'human']:
            pg.evaluate(f'GA.atlas.setTopic("{k}")'); time.sleep(6)
            ids = pg.evaluate(f'GA.atlas.topicLayers("{k}")'); shown = pg.evaluate(f'GA.atlas.topicLayers("{k}").filter(id => GA.app.map.getLayoutProperty(id, "visibility") === "visible").length')
            check(len(ids) > 0 and shown == len(ids), f'{k}: {shown}/{len(ids)} layers shown'); pg.screenshot(path=f'{OUT}/en_city_{k}.png')
        # panel collapses without turning the analysis off
        pg.click('#atl-panel [data-atl-min]'); time.sleep(0.3); check(pg.evaluate('document.querySelector("#atl-panel").classList.contains("min") && GA.atlas.state.topic === "human"'), 'panel collapses, analysis stays on')
        # the old pages still open from the menu
        pg.click('#atl-burger'); time.sleep(0.3); pg.click('[data-sec-t="tools"]'); time.sleep(0.3); pg.click('#atl-sec-tools .tb-btn[data-page="history"]'); time.sleep(2)
        check(pg.evaluate('GA.pages.current && GA.pages.current.name') == 'history' and pg.evaluate('document.querySelector("#atl-side").hidden'), 'a page opens from the menu and the menu closes')
        pg.evaluate('GA.pages.close()'); time.sleep(0.5)
        check(not errs, 'no page errors', errs[:3]); ctx.close()
        # ---------- RTL and phone ----------
        for lang, vp, mob in [('ar', {'width': 1280, 'height': 860}, False), ('he', {'width': 390, 'height': 844}, True)]:
            ctx, pg, errs = boot(vp, mob); pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.6)
            check(pg.evaluate('document.documentElement.dir') == 'rtl', f'{lang}: right-to-left')
            pg.click('#atl-burger'); time.sleep(0.5); sb = pg.evaluate('(() => { const r = document.querySelector("#atl-side").getBoundingClientRect(); return [r.left, r.right, innerWidth]; })()')
            check(sb[1] >= sb[2] - 2, f'{lang}: the sidebar opens from the same side as the ☰ button (right in RTL)', sb); pg.screenshot(path=f'{OUT}/{lang}_menu.png'); pg.click('#atl-side-x')
            pg.evaluate('GA.atlas.setArea("metro")'); time.sleep(2.5); pg.evaluate('GA.atlas.setTopic("human")'); time.sleep(6)
            check(pg.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'{lang}: no horizontal overflow')
            if mob: r = pg.evaluate('(() => { const r = document.querySelector("#atl-panel").getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; })()'); check(r[1] >= r[2] - 2 and r[0] > r[2] * 0.45, f'phone: the panel is a bottom sheet {r}')
            pg.screenshot(path=f'{OUT}/{lang}_metro_human.png'); check(not errs, f'{lang}: no page errors', errs[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
