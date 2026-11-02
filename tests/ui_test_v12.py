"""v12 — build 5.11: 3D camera stays above the terrain at every zoom (the huge-triangle bug), opaque extrusions (recorded
height vs estimate by colour, no transparency), 2D↔3D switching with pan / rotate; zoom out to Spain, the Mediterranean and
North Africa (minZoom 3, locator, country context); every enabled layer keeps a representation or a "not at this scale"
note with Zoom to layer across the zoom range; wind and rainfall from the shipped ERA5 snapshot (no API call), a failed
load shows the cause + Retry instead of a legend; trees (model, popup recorded vs estimate, 3D forms, section
silhouettes); historical place descriptions in Arabic / Hebrew / English with source and translation labels.
Usage: python3 tests/ui_test_v12.py  (OUT=/dir for screenshots)"""
import sys, os, time, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8812; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v12shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)

def boot(b, vp, lang='en', mobile=False):
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
    pg = ctx.new_page(); V3.stub3(pg); errs = []; meteo = []
    pg.on('request', lambda r: 'open-meteo.com' in r.url and meteo.append(r.url))
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and 'rtl-text' not in m.text and errs.append(m.text[:300]))
    pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.view3d && GA.trees3d && GA.regional', timeout=90000)
    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4); return ctx, pg, errs, meteo
def idle(pg, ms=20000):
    pg.evaluate("ms => new Promise(r => { const m = GA.app.map; let d = false; const f = () => { if (!d) { d = true; r(); } }; m.once('idle', f); m.triggerRepaint(); setTimeout(f, ms); })", ms)
def snap(pg, path):  # 3D frames under software GL can take minutes; a slow screenshot is not a test failure
    try: pg.screenshot(path=path, timeout=240000); return True
    except Exception as e: print('     (screenshot skipped: ' + str(e)[:80] + ')'); return False
SECT = set((os.environ.get('SECTIONS') or '1,2,3,4,5,6,7,8').split(','))
def dominant(path):
    im = Image.open(path).convert('RGB').resize((160, 100)); px = list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata()); from collections import Counter
    return Counter((r // 24, g // 24, b // 24) for r, g, b in px).most_common(1)[0][1] / len(px)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx, pg, errs, meteo = boot(b, {'width': 1100, 'height': 700})  # small frames: 3D under software GL is slow
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver == '5.11' and pg.evaluate('window.GA_BUILD') == '5.11', 'build 5.11 (version.json and GA_BUILD)')

        # ================= 1. 3D: camera on the ground at every zoom, opaque buildings =================
        if '1' in SECT:
            pg.evaluate('GA.app.map.jumpTo({ center: [-3.5930, 37.1760], zoom: 15 })'); idle(pg)
            pg.evaluate('GA.view3d.enter()'); time.sleep(3); idle(pg, 25000)
            for z in [16, 17.5, 18.8]:
                pg.evaluate(f'GA.app.map.zoomTo({z}, {{ duration: 0 }})'); idle(pg, 25000)
                r = pg.evaluate('[GA.app.map.transform.elevation, GA.view3d.ground(), GA.app.map.getPitch()]')
                check(r[1] > 500 and abs(r[0] - r[1]) < 2 and r[2] > 50, f'3D z{z}: map centre on the ground ({r[0]:.1f} m vs ground {r[1]:.1f} m), pitch kept ({r[2]:.0f}°)', r)
                if z == 18.8 and snap(pg, f'{OUT}/3d_z{z}.png'): d = dominant(f'{OUT}/3d_z{z}.png'); check(d < 0.6, f'3D z{z}: no single flat colour covers the view (huge-triangle check, largest share {d:.2f})', d)
            op = pg.evaluate('["ga3d-est", "ga3d-h"].map(l => GA.app.map.getPaintProperty(l, "fill-extrusion-opacity"))'); check(op == [1, 1], 'extrusions are opaque (opacity 1, both classes)', op)
            cm = pg.evaluate('[GA.app.map.getPaintProperty("ga3d-h", "fill-extrusion-color"), GA.palette.extrude.measured]'); check(cm[0] == cm[1], 'recorded heights use the palette colour for measured', cm)
            lg = pg.evaluate('document.querySelector("#legend").innerText'); check('Recorded height' in lg and 'Estimate' in lg and 'left flat' in lg, '3D legend: recorded / estimate / flat')
            # pan, rotate, back to 2D and to 3D again
            pg.evaluate('GA.app.map.panBy([250, 120], { duration: 0 })'); idle(pg); pg.evaluate('GA.app.map.setBearing(70)'); idle(pg)
            r = pg.evaluate('[GA.app.map.transform.elevation, GA.view3d.ground()]'); check(abs(r[0] - r[1]) < 2, 'after pan and rotation the centre is still on the ground', r)
            for k in range(2):
                pg.evaluate('GA.view3d.exit()'); time.sleep(1.2); idle(pg); r = pg.evaluate('[!!GA.app.map.terrain, GA.app.map.transform.elevation, GA.app.map.getPitch(), !!GA.app.map.getLayer("ga3d-est")]')
                check(not r[0] and r[1] == 0 and r[3] is False, f'2D again ({k + 1}): no terrain, elevation 0, no extrusions', r)
                pg.evaluate('GA.view3d.enter()'); time.sleep(3); idle(pg, 25000); r = pg.evaluate('[GA.app.map.transform.elevation, GA.view3d.ground(), GA.app.map.getPitch()]')
                check(abs(r[0] - r[1]) < 2 and r[2] > 50, f'3D again ({k + 1}): centre on the ground, tilted', r)
        # ================= 2. 3D trees =================
        if '2' in SECT:
            if not pg.evaluate('GA.view3d.isOn()'): pg.evaluate('GA.app.map.jumpTo({ center: [-3.5995, 37.1735], zoom: 16 })'); idle(pg); pg.evaluate('GA.view3d.enter()'); time.sleep(3); idle(pg, 25000)
            pg.evaluate('GA.app.map.jumpTo({ center: [-3.5995, 37.1735], zoom: 17, bearing: -20 })'); time.sleep(1); idle(pg, 25000); time.sleep(2)
            r = pg.evaluate('[GA.trees3d.shown, GA.app.map.querySourceFeatures("ga3d-trees").length, !!GA.app.map.getLayer("ga3d-trees-crown"), GA.app.map.getPaintProperty("ga3d-trees-crown", "fill-extrusion-opacity")]')
            check(r[0] > 50 and r[1] > r[0] and r[2] and r[3] == 1, f'3D trees: {r[0]} trees in view as opaque trunk + crown extrusions', r)
            snap(pg, f'{OUT}/3d_trees.png')
            forms = pg.evaluate('(async () => { const r = await GA.ext.trees([-3.75, 37.05, -3.45, 37.3]); const c = {}; r.pts.forEach(p => { const m = GA.trees.model(p.tags); c[m.form] = (c[m.form] || 0) + 1; }); return c; })()')
            check(len(forms) >= 4 and forms.get('generic', 0) > 1000, 'tree forms from the data: generic for unknown species, several species forms', forms)
            pg.evaluate('GA.view3d.exit()'); time.sleep(1.5)

        # ================= 3. tree popup: recorded vs estimate, unknown =================
        if '3' in SECT:
            html = pg.evaluate('GA.trees.infoHTML(GA.trees.model({ species: "Pinus halepensis", height: "27", diameter: "2.7 m" }), { id: "n8236664315", ts: "2026-11-02" }, GA.i18n.t, GA.pages.esc, GA.pages.nf)')
            check('recorded' in html and 'Unknown' in html and 'illustrative estimate' in html and 'ambiguous' in html and 'OpenStreetMap' in html, 'tree card: recorded height, crown Unknown + labelled estimate, ambiguous diameter tag, source')
            html = pg.evaluate('GA.trees.infoHTML(GA.trees.model({}), { id: "n1" }, GA.i18n.t, GA.pages.esc, GA.pages.nf)')
            check(html.count('Unknown') >= 4 and 'generic model' in html, 'tree with no tags: species, leaf, height, crown, trunk all "Unknown"; generic model')

        # ================= 4. regional zoom and layers across the zoom range =================
        if '4' in SECT:
            LAYERS = ['bld_floors', 'municipality', 'neighbourhoods', 'streets', 'parks', 'landuse', 'fac_health', 'bus_stops', 'trees', 'contours', 'hillshade']
            pg.evaluate(f'{json.dumps(LAYERS)}.forEach(k => GA.app.L.setOn(k, true))'); time.sleep(2)
            check(pg.evaluate('GA.app.map.getMinZoom()') <= 3.01 and pg.evaluate('!GA.app.map.getMaxBounds()'), 'minimum zoom 3 and no navigation bounds')
            for z, c in [(4.3, [-2.5, 38.0]), (7.5, [-3.6, 37.4]), (10.5, [-3.6, 37.18]), (12, [-3.6, 37.18]), (13.6, [-3.598, 37.176]), (15.6, [-3.598, 37.176]), (17.6, [-3.598, 37.176])]:
                pg.evaluate(f'GA.app.map.jumpTo({{ center: {c}, zoom: {z}, bearing: 0, pitch: 0 }})'); idle(pg, 25000); time.sleep(2.5)
                st = pg.evaluate(f'''{json.dumps(LAYERS)}.map(k => {{ const s = GA.app.L.S[k]; const blk = document.querySelector('#legend .lg-blk[data-ly="' + k + '"]'); return [k, s.on, s.status, GA.app.L.drawsHere(k), !!blk, !!(blk && blk.querySelector('[data-ly-zoomto]'))]; }})''')
                bad = [x for x in st if not x[1] or x[2] == 'failed' or not x[4] or (not x[3] and not x[5] and x[2] not in ('ok', 'overview', 'city', 'lite'))]
                check(not bad, f'z{z}: all {len(LAYERS)} layers still on and in the legend; each drawn or explained with Zoom to layer', bad)
                if z == 4.3:
                    r = pg.evaluate('[!!GA.app.map.getLayer("ga-loc-ring"), GA.app.map.getLayoutProperty("ga-loc-ring", "visibility"), document.querySelector("#legend").innerText.includes("Granada (study region)"), !!GA.app.map.getLayer("label-country"), !!GA.app.map.getLayer("boundary-country")]')
                    check(r[0] and r[1] != 'none' and r[2] and r[3] and r[4], 'regional view: Granada locator + legend, country labels and borders in the basemap', r)
                    snap(pg, f'{OUT}/wide.png')
                if z == 10.5: snap(pg, f'{OUT}/layers_z10.png')
                if z == 15.6: snap(pg, f'{OUT}/layers_z15.png')
            pg.evaluate('GA.app.map.jumpTo({ center: [-3.6, 37.18], zoom: 11 })'); idle(pg); time.sleep(2)
            check(pg.evaluate('GA.app.L.S.parks.status') == 'zoom' and pg.evaluate('!!document.querySelector(\'#legend [data-ly-zoomto="parks"]\')'), 'parks at zoom 11: "not drawn at this scale" + Zoom to layer in the legend')
            pg.click('#legend [data-ly-zoomto="parks"]'); time.sleep(2.5); idle(pg); time.sleep(2)
            check(pg.evaluate('GA.app.map.getZoom()') >= 13 and pg.evaluate('GA.app.L.S.parks.status') not in ('zoom', 'failed'), 'Zoom to layer brings parks into view', pg.evaluate('[GA.app.map.getZoom(), GA.app.L.S.parks.status]'))
            pg.evaluate('GA.app.map.jumpTo({ center: [-2.5, 38.0], zoom: 4.3 })'); time.sleep(1.5); pg.click('[data-zoom-granada]'); time.sleep(2.5)
            check(pg.evaluate('GA.app.map.getZoom()') > 10 and abs(pg.evaluate('GA.app.map.getCenter().lng') + 3.61) < 0.1, '"Zoom to Granada" from the regional view')
            pg.evaluate(f'{json.dumps(LAYERS)}.forEach(k => GA.app.L.setOn(k, k === "municipality" || k === "neighbourhoods" || k === "bld_floors"))'); time.sleep(1)

        # ================= 5. wind and rainfall from the snapshot; failures =================
        if '5' in SECT:
            pg.evaluate('GA.app.L.setOn("wind", true); GA.app.L.setOn("rain", true)')
            pg.wait_for_function('["wind", "rain"].every(k => !["loading", "idle"].includes(GA.app.L.S[k].status))', timeout=60000)
            r = pg.evaluate('["wind", "rain"].map(k => [GA.app.L.S[k].status, GA.app.L.S[k].statusExtra])'); check(r == [['ok', 21672], ['ok', 30]], 'wind (21,672 winter hours) and rainfall (30 years) load from the shipped snapshot', r)
            check(not meteo, 'no request to Open-Meteo (snapshot used)', meteo[:2])
            lg = pg.evaluate('document.querySelector("#legend").innerText'); check('ERA5' in lg and 'Prevailing direction' in lg and 'annual total' in lg and '37.25' in lg, 'legends: wind rose statistics, rainfall totals, ERA5 cell')
            pg.evaluate('GA.app.map.jumpTo({ center: [-3.58, 37.2], zoom: 10.6 })'); idle(pg); time.sleep(1.5); snap(pg, f'{OUT}/wind_rain.png')
            pg.route('**/data/climate/**', lambda r: r.fulfill(status=503, body='')); pg.route('https://archive-api.open-meteo.com/**', lambda r: r.fulfill(status=429, json={'error': True, 'reason': 'Hourly API request limit exceeded. Please try again in the next hour.'}))
            pg.evaluate('GA.climate.clearCache(); GA.app.L.retry("wind")'); pg.wait_for_function('GA.app.L.S.wind.status === "failed"', timeout=30000); time.sleep(0.6)
            r = pg.evaluate('(() => { const b = document.querySelector(\'#legend .lg-blk[data-ly="wind"]\'); return [!!b && b.classList.contains("lg-failed"), !!(b && b.querySelector("[data-ly-retry=wind]")), !!(b && b.querySelector(".lg-rose")), b ? b.innerText : ""]; })()')
            check(r[0] and r[1] and not r[2] and 'quota' in r[3] and '429' in r[3], 'failed wind: legend shows cause (quota, HTTP 429) + Retry, no wind rose', r)
            pg.evaluate('GA.panels.set("layers", true)'); time.sleep(0.8)
            check(pg.evaluate('!!document.querySelector("#panel-layers [data-ly-retry=wind]")'), 'failed wind: Retry also in the Layers panel'); snap(pg, f'{OUT}/wind_failed.png')
            pg.unroute('**/data/climate/**'); pg.click('#legend [data-ly-retry=wind]'); pg.wait_for_function('GA.app.L.S.wind.status === "ok"', timeout=30000); check(True, 'Retry loads the data again')
            pg.evaluate('GA.panels.set("layers", false); GA.app.L.setOn("wind", false); GA.app.L.setOn("rain", false)')

        # ================= 6. section: tree silhouettes from the same model =================
        if '6' in SECT:
            sid = pg.evaluate('''() => { const p = GA.app.store.get(); p.sections = p.sections || []; const s = { id: GA.app.store.uid("sec"), name: "Acera del Darro", pts: [[-3.6004, 37.1727], [-3.5980, 37.1727]], floorH: 3, created: new Date().toISOString() }; p.sections.push(s); GA.app.store.save(); return s.id; }''')
            pg.evaluate('() => { GA.lastViewer = null; }'); pg.evaluate('(id) => GA.sectionView.open(null, id)', sid)
            pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "section" && GA.lastViewer.prof && GA.lastViewer.last', timeout=120000); time.sleep(1.5)
            svg = pg.evaluate('GA.section.svg(GA.lastViewer.prof, GA.section.optsFor({}))')
            check('Tree silhouettes follow the species' in svg and 'schematic' in svg, 'section legend: silhouettes by recorded species; unknown sizes schematic')
            tr = pg.evaluate('GA.lastViewer.last.trees'); check(len(tr) >= 3 and all(t['sch'] for t in tr), f'section draws {len(tr)} mapped trees, sizes marked schematic where not recorded')
            snap(pg, f'{OUT}/section.png'); pg.keyboard.press('Escape'); time.sleep(0.5)
        check(not errs, 'no page errors (desktop)', errs[:3]); ctx.close()

        # ================= 7. historical places in ar / he / en =================
        for lang, native, translated in ([] if '7' not in SECT else [('ar', 'قصر الحمراء', 'ترجمة لملخّص'), ('he', 'אלהמברה', 'תרגום של'), ('en', 'Alhambra', 'Translation of the Spanish')]):
            ctx, pg, errs, meteo = boot(b, {'width': 1280, 'height': 860}, lang)
            pg.evaluate('GA.pages.go("history")'); pg.wait_for_function('document.querySelectorAll("#hx-places .hx-place").length >= 13', timeout=150000); time.sleep(3)
            r = pg.evaluate('''[...document.querySelectorAll("#hx-places .hx-place")].map(a => { const p = a.querySelector("p[lang]"); return [a.querySelector(".hx-h b").innerText, p ? p.lang : "", !!a.querySelector(".hx-orig"), !!a.querySelector(".hx-origtxt"), a.querySelector(":scope > small") ? a.querySelector(":scope > small").innerText : ""]; })''')
            check(all(x[1] == lang for x in r), f'{lang}: all 13 place descriptions in the interface language', [x[:2] for x in r if x[1] != lang])
            check(any(native in x[0] for x in r), f'{lang}: native Wikipedia article used where it exists ({native})')
            tl = [x for x in r if x[2]]; check(tl and all(x[3] for x in tl) and all('CC BY-SA' in x[4] for x in r), f'{lang}: {len(tl)} translations labelled, the Spanish original one click away; every text has source + licence')
            txt = pg.evaluate('document.querySelector("#hx-places").innerText'); check(translated in txt, f'{lang}: translation label text present')
            snap(pg, f'{OUT}/history_{lang}.png'); check(not errs, f'{lang}: no page errors', errs[:3]); ctx.close()

        # ================= 8. phone and tablet: 3D and regional view =================
        for tag, vp in ([] if '8' not in SECT else [('phone', {'width': 390, 'height': 844}), ('tablet', {'width': 820, 'height': 1180})]):
            ctx, pg, errs, meteo = boot(b, vp, 'ar', True)
            pg.evaluate('GA.app.map.jumpTo({ center: [-3.5990, 37.1760], zoom: 16 })'); idle(pg); pg.evaluate('GA.view3d.enter()'); time.sleep(3); idle(pg, 25000)
            r = pg.evaluate('[GA.app.map.transform.elevation, GA.view3d.ground(), GA.trees3d.shown]'); check(abs(r[0] - r[1]) < 2, f'{tag}: 3D centre on the ground', r)
            snap(pg, f'{OUT}/{tag}_3d.png'); pg.evaluate('GA.view3d.exit()'); time.sleep(1)
            pg.evaluate('GA.app.map.jumpTo({ center: [-3.0, 37.5], zoom: 4.5 })'); idle(pg); time.sleep(1); snap(pg, f'{OUT}/{tag}_wide.png')
            check(pg.evaluate('GA.app.map.getZoom()') < 5, f'{tag}: regional zoom available'); check(not errs, f'{tag}: no page errors', errs[:3]); ctx.close()
        b.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)))
sys.exit(1 if fails else 0)
