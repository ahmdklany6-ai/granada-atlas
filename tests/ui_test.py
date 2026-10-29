# Headless UI test with stubbed network (synthetic fixtures, not real Granada data).
# Run: python3 tests/ui_test.py  (serves the app on :8765)
import json, math, subprocess, sys, time, os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
C = (-3.5986, 37.1773)
def ll(dx, dy):
    k = math.cos(math.radians(C[1])); R = 6371008.8
    return {'lon': C[0] + math.degrees(dx / (R * k)), 'lat': C[1] + math.degrees(dy / R)}
def sq(x, y, w):
    return [ll(x, y), ll(x + w, y), ll(x + w, y + w), ll(x, y + w), ll(x, y)]

els = []
i = 1
for gx in range(-200, 200, 30):
    for gy in range(-200, 200, 30):
        tags = {'building': 'apartments' if (gx + gy) % 60 == 0 else 'yes'}
        if (gx // 30) % 3 == 0: tags['building:levels'] = str(2 + (abs(gy) // 40) % 9)
        if gy % 120 == 0: tags['start_date'] = str(1900 + (abs(gx) % 120))
        els.append({'type': 'way', 'id': i, 'tags': tags, 'geometry': sq(gx, gy, 18)}); i += 1
els.append({'type': 'way', 'id': 9001, 'tags': {'highway': 'primary', 'name': 'Gran Vía (test)'}, 'geometry': [ll(-600, 10), ll(600, 10)]})
els.append({'type': 'way', 'id': 9002, 'tags': {'highway': 'pedestrian'}, 'geometry': [ll(5, -600), ll(5, 600)]})
els.append({'type': 'way', 'id': 9003, 'tags': {'leisure': 'park', 'name': 'Parque (test)'}, 'geometry': sq(-150, -150, 80)})
els.append({'type': 'node', 'id': 9004, 'lat': C[1], 'lon': C[0], 'tags': {'amenity': 'school', 'name': 'Colegio (test)'}})
els.append({'type': 'node', 'id': 9005, 'lat': ll(40, 40)['lat'], 'lon': ll(40, 40)['lon'], 'tags': {'tourism': 'hotel'}})
els.append({'type': 'area', 'id': 3600000009, 'tags': {'boundary': 'administrative', 'admin_level': '9', 'name': 'Distrito (test)'}})
OVERPASS = json.dumps({'osm3s': {'timestamp_osm_base': '2026-10-29T08:00:00Z'}, 'elements': els})

def elev(route):
    url = route.request.url; n = len(url.split('latitude=')[1].split('&')[0].split(','))
    route.fulfill(json=({'elevation': [680 + 40 * math.sin(i / 6) + i for i in range(n)]}))
def archive(route):
    days = [f'2025-{m:02d}-{d:02d}' for m in range(1, 13) for d in range(1, 29)]
    tmax = [12 + 22 * math.sin(math.pi * (int(t[5:7]) - 1) / 11) for t in days]
    route.fulfill(json={'latitude': 37.18, 'longitude': -3.6, 'elevation': 690, 'daily': {'time': days, 'temperature_2m_max': tmax, 'temperature_2m_min': [x - 13 for x in tmax], 'precipitation_sum': [1.0] * len(days)}})
PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
def commons(route):
    pages = {str(k): {'pageid': k, 'title': f'File:Test {k}.jpg', 'coordinates': [{'lat': ll(k * 10, 0)['lat'], 'lon': ll(k * 10, 0)['lon']}],
             'imageinfo': [{'thumburl': 'http://127.0.0.1:8765/tests/px.png', 'descriptionurl': 'https://commons.wikimedia.org/', 'mime': 'image/jpeg',
             'extmetadata': {'Artist': {'value': 'Tester'}, 'LicenseShortName': {'value': 'CC BY-SA 4.0'}, 'DateTimeOriginal': {'value': '2019-05-01'}}}]} for k in range(1, 7)}
    route.fulfill(json={'query': {'pages': pages}})

server = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import base64; open(os.path.join(ROOT, 'tests', 'px.png'), 'wb').write(base64.b64decode(PIXEL))
time.sleep(1)
fails = []
def check(name, cond):
    print(('PASS ' if cond else 'FAIL ') + name); (None if cond else fails.append(name))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': 1500, 'height': 920}, locale='ar')
        errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        overpass_mode = {'fail_first': True}
        def overpass(route):
            if overpass_mode['fail_first'] and 'overpass-api.de' in route.request.url:
                return route.fulfill(status=504, body='Gateway Timeout')
            route.fulfill(body=OVERPASS, content_type='application/json')
        pg.route('**/api/interpreter', overpass)
        pg.route('**/v1/elevation**', elev)
        pg.route('**/v1/archive**', archive)
        pg.route('https://commons.wikimedia.org/w/api.php**', commons)
        pg.route('https://*.wikipedia.org/w/api.php**', lambda r: r.fulfill(json={'query': {'geosearch': [{'pageid': 1, 'title': 'Artículo (test)', 'dist': 120, 'lat': C[1], 'lon': C[0]}]}}))
        pg.route('https://api.openalex.org/**', lambda r: r.fulfill(status=503, body='down'))
        def tiles(r):
            if r.request.url.rstrip('/').endswith('/planet'):
                return r.fulfill(json={'tilejson': '3.0.0', 'tiles': ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14})
            r.fulfill(status=404, body='')
        pg.route('https://tiles.openfreemap.org/**', tiles)
        pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        pg.route('https://unpkg.com/**', lambda r: r.fulfill(status=404, body=''))
        pg.goto('http://127.0.0.1:8765/index.html')
        pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=20000)
        pg.evaluate('localStorage.clear()')
        box = pg.locator('#map').bounding_box(); cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        # 1) click map → Set Center popup
        pg.mouse.click(cx, cy); pg.wait_for_selector('#btn-setcenter')
        check('set-center popup appears', pg.locator('#btn-setcenter').is_visible())
        pg.click('#btn-setcenter')
        pg.wait_for_selector('[data-tool="circle"]')
        # 2) circle with numeric radius
        pg.click('[data-tool="circle"]'); pg.fill('#in-radius', '300'); pg.press('#in-radius', 'Enter')
        a = pg.evaluate('GA.app.sel.info().area'); check('circle r=300 area ≈ 282,320 m²', abs(a - 282320) / 282320 < 0.01)
        pg.screenshot(path=f'{OUT}/01-circle.png')
        # 3) drag radius handle to resize
        h = pg.locator('.h-edge').bounding_box(); pg.mouse.move(h['x'] + 6, h['y'] + 6); pg.mouse.down(); pg.mouse.move(h['x'] + 60, h['y'] + 6, steps=8); pg.mouse.up()
        r2 = pg.evaluate('GA.app.sel.info().radius'); check('drag resizes radius (now %d m)' % r2, r2 > 300)
        # 4) square
        pg.click('[data-tool="square"]'); pg.fill('#in-side', '400'); pg.press('#in-side', 'Enter')
        a = pg.evaluate('GA.app.sel.info().area'); check('square 400 m area = 160,000 m²', abs(a - 160000) < 200)
        # 5) undo → side back to 500
        pg.click('#btn-undo'); check('undo restores previous side', pg.evaluate('GA.app.sel.info().side') == 500)
        pg.click('[data-tool="square"]') if pg.evaluate('GA.app.sel.info().type') != 'square' else None
        # 6) polygon: 4 clicks then close on first vertex
        pg.click('[data-tool="polygon"]')
        pts = [(cx - 120, cy - 100), (cx + 120, cy - 100), (cx + 140, cy + 110), (cx - 110, cy + 120)]
        for x, y in pts: pg.mouse.click(x, y); pg.wait_for_timeout(120)
        check('4 vertices placed', pg.evaluate('GA.app.sel.info().verts') == 4)
        f = pg.locator('.h-first').bounding_box(); pg.mouse.click(f['x'] + f['width'] / 2, f['y'] + f['height'] / 2)
        check('polygon closed by clicking first vertex', pg.evaluate('GA.app.sel.info().closed'))
        # drag a vertex
        before = pg.evaluate('GA.app.sel.info().area')
        v = pg.locator('.h-vert').nth(2).bounding_box(); pg.mouse.move(v['x'] + 6, v['y'] + 6); pg.mouse.down(); pg.mouse.move(v['x'] + 70, v['y'] + 60, steps=6); pg.mouse.up()
        check('vertex drag changes area', abs(pg.evaluate('GA.app.sel.info().area') - before) > 100)
        # insert vertex via midpoint
        pg.locator('.h-mid').first.click(); check('midpoint inserts vertex', pg.evaluate('GA.app.sel.info().verts') == 5)
        pg.screenshot(path=f'{OUT}/02-polygon.png')
        # 7) back to square 500 and analyze (Overpass first mirror fails → fallback)
        pg.click('[data-tool="square"]'); pg.fill('#in-side', '500'); pg.press('#in-side', 'Enter')
        pg.fill('#in-name', 'عيّنة اختبار'); pg.click('#btn-analyze')
        pg.wait_for_function("GA.app.getRun() && Object.values(GA.app.getRun().tasks).every(t => t.state !== 'running')", timeout=30000)
        run = pg.evaluate('(() => { const r = GA.app.getRun(); return { tasks: r.tasks, n: r.result.osm && r.result.osm.buildings.count, ep: r.result.osmEndpoint, prof: !!r.result.profile, clim: r.result.climate && r.result.climate.hot35, photos: (r.result.photos||[]).length }; })()')
        print(json.dumps(run, ensure_ascii=False)[:400])
        check('OSM fell back to mirror after 504', run['ep'] and 'overpass-api.de' not in run['ep'])
        check('buildings counted inside 500 m square', run['n'] and run['n'] > 100)
        check('terrain profile computed', run['prof'])
        check('climate computed', run['clim'] is not None)
        check('photos listed with licence', run['photos'] == 6)
        check('OpenAlex failure shown with retry', pg.locator('[data-retry="research"]').count() == 1)
        check('report shows evidence badges', pg.locator('#rep-body .badge-doc').count() > 5 and pg.locator('#rep-body .badge-gap').count() >= 5)
        if os.environ.get('DEBUG'):
            print('CENTER', pg.evaluate("[...document.querySelectorAll('.h')].map(e=>e.className+' '+e.style.transform).join(' | ')"))
            print('SEC', pg.evaluate("JSON.stringify(GA.app.getRun().result.sectionLine)"), pg.evaluate("GA.app.map.getStyle().layers.map(l=>l.id).slice(-8).join(',')"), pg.evaluate("GA.app.map.queryRenderedFeatures({layers:['an-sec']}).length"), pg.evaluate("JSON.stringify(GA.app.map.getSource('an-sec')._data).slice(0,200)"), pg.evaluate("GA.app.map.getLayoutProperty('an-sec','visibility')"))
        pg.screenshot(path=f'{OUT}/03-report.png')
        # layers
        pg.click('.tb-btn[data-drawer="layers"]'); pg.check('input[name=theme][value=heights]'); pg.check('#chk-pois'); pg.wait_for_timeout(500)
        check('legend shows heights', 'عدد الطوابق' in pg.inner_text('#legend'))
        pg.click('#btn-close-drawer'); pg.screenshot(path=f'{OUT}/04-layers.png')
        pg.click('#btn-wide'); pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/06-wide.png'); pg.click('#btn-wide')
        # observation
        pg.locator('#topic-obs').scroll_into_view_if_needed(); pg.fill('#obs-text', 'الأرصفة ضيقة جدًا في الشارع الرئيسي'); pg.click('#obs-add')
        check('observation saved', pg.evaluate('GA.app.store.get().observations.length') == 1)
        # 7b) GIS export: GeoPackage + GeoJSON + GeoTIFF (DEM via stubbed elevation)
        pg.click('#btn-gis'); pg.wait_for_selector('#x-go')
        check('export lists ready layers', pg.locator('#drawer-body tr.ready').count() >= 5)
        check('unavailable layers listed with reason', pg.locator('#drawer-body tr.unavailable').count() >= 4)
        pg.check('#x-dem'); pg.wait_for_selector('#x-cell')
        with pg.expect_download(timeout=60000) as dl:
            pg.click('#x-go')
        d = dl.value; xdir = os.path.join(OUT, 'export_ui'); os.makedirs(xdir, exist_ok=True)
        for f in os.listdir(xdir): os.remove(os.path.join(xdir, f))
        d.save_as(os.path.join(xdir, d.suggested_filename))
        open(os.path.join(xdir, 'ring.json'), 'w').write(json.dumps(pg.evaluate('GA.app.sel.ring()')))
        check('download is a GIS zip: ' + d.suggested_filename, d.suggested_filename.endswith('_gis.zip'))
        pg.wait_for_selector('.x-msg .ok'); pg.screenshot(path=f'{OUT}/07-export.png')
        pg.click('#btn-close-drawer')
        # 7c) language switching keeps the selection and the analysis
        area_before = pg.evaluate('GA.app.sel.info().area')
        pg.click('[data-lang="en"]'); pg.wait_for_timeout(400)
        check('English is LTR', pg.evaluate('document.documentElement.dir') == 'ltr' and pg.evaluate('document.documentElement.lang') == 'en')
        check('panel title translated', pg.inner_text('#panel-select h2').strip() == 'Study area')
        check('selection kept after switch', abs(pg.evaluate('GA.app.sel.info().area') - area_before) < 0.01)
        check('report kept after switch', pg.evaluate('!!GA.app.getRun()') and 'Buildings' in pg.inner_text('#rep-body'))
        rb = pg.locator('#panel-report').bounding_box(); sp = pg.locator('#panel-select').bounding_box()
        check('LTR: study panel left, report right', sp['x'] < 100 and rb['x'] > 700)
        pg.screenshot(path=f'{OUT}/08-en.png')
        pg.click('[data-lang="he"]'); pg.wait_for_timeout(400)
        check('Hebrew is RTL', pg.evaluate('document.documentElement.dir') == 'rtl' and pg.inner_text('#panel-select h2').strip() == 'אזור המחקר')
        rb = pg.locator('#panel-report').bounding_box(); sp = pg.locator('#panel-select').bounding_box()
        check('RTL: study panel right, report left', sp['x'] > 1000 and rb['x'] < 10)
        pg.screenshot(path=f'{OUT}/09-he.png')
        untranslated = pg.evaluate("""(() => { const re = /[\u0600-\u06FF]/; const bad = []; document.querySelectorAll('#panel-select, #panel-report .rep-h, #panel-report .key, .topbar, #legend').forEach(el => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (re.test(n.textContent) && !n.parentElement.closest('bdi,[lang=ar],.user-text')) bad.push(n.textContent.trim().slice(0, 40)); } }); return bad; })()""")
        check('no Arabic UI strings left in Hebrew mode: %s' % untranslated[:3], not untranslated)
        pg.click('[data-lang="ar"]'); pg.wait_for_timeout(300)
        # 8) persistence: reload, reopen
        pg.reload(); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=20000)
        check('saved area restored after reload', pg.evaluate('GA.app.store.get().areas.length') == 1)
        check('language remembered (ar)', pg.evaluate('document.documentElement.lang') == 'ar')
        pg.locator('[data-open]').first.click(); pg.wait_for_selector('#rep-body .topic')
        check('report restored from storage', 'عيّنة اختبار' in pg.inner_text('#rep-title'))
        # 9) refresh with changed data → change detection
        els.append({'type': 'way', 'id': 777777, 'tags': {'building': 'yes'}, 'geometry': sq(2, 2, 10)})
        globals()['OVERPASS'] = json.dumps({'osm3s': {'timestamp_osm_base': '2026-10-29T09:00:00Z'}, 'elements': els})
        pg.click('#btn-refresh')
        pg.wait_for_function("GA.app.getRun() && GA.app.getRun().changes && Object.values(GA.app.getRun().tasks).every(t => t.state !== 'running')", timeout=30000)
        ch = pg.evaluate('GA.app.getRun().changes.map(c => c.key)'); check('refresh detects changed building count: %s' % ch[:3], 'buildings.count' in ch)
        # 10) second area + compare
        pg.click('#btn-saveas'); n = pg.evaluate('GA.app.store.get().areas.length'); check('save as new area', n == 2)
        pg.click('.tb-btn[data-drawer="areas"]'); pg.screenshot(path=f'{OUT}/05-areas.png')
        check('no page errors: %s' % errors[:2], not errors)
        b.close()
finally:
    server.terminate()
print('FAILED: %s' % fails if fails else 'ALL UI TESTS PASSED'); sys.exit(1 if fails else 0)
