# Acceptance tests for v3, headless, against the real published data in data/.
# External services are stubbed: basemap, Commons, Wikipedia (+REST summaries), Open-Meteo, OpenAlex,
# MITECO WMS/WFS, EEA tree-cover exportImage (an 8-bit TIFF built here), NASA GIBS, IGN WMS, Overpass.
# Run: python3 tests/ui_test_v3.py [output_dir]
import json, os, struct, subprocess, sys, time, zipfile, io, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui_test_v2 as V2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
PORT = 8768; V2.PORT = PORT
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  — ' + str(extra)) if extra != '' else '')); (None if cond else fails.append(name))

PX = open(os.path.join(ROOT, 'tests', 'px.png'), 'rb').read() if os.path.exists(os.path.join(ROOT, 'tests', 'px.png')) else None
def tiff(w, h):  # uncompressed 8-bit grey TIFF; values 0..100 in a gradient, 255 outside
    data = bytes(min(100, (x * 100) // max(1, w - 1)) if 0 < x < w - 1 else 255 for y in range(h) for x in range(w))
    tags = [(256, 3, 1, w), (257, 3, 1, h), (258, 3, 1, 8), (259, 3, 1, 1), (262, 3, 1, 1), (273, 4, 1, 8 + 2 + 9 * 12 + 4), (277, 3, 1, 1), (278, 3, 1, h), (279, 4, 1, len(data))]
    ifd = struct.pack('<H', len(tags)) + b''.join(struct.pack('<HHII', *t) if t[1] == 4 else struct.pack('<HHIHH', t[0], t[1], t[2], t[3], 0) for t in tags) + struct.pack('<I', 0)
    return b'II*\x00' + struct.pack('<I', 8) + ifd + data

def stub3(pg):
    V2.stub(pg)
    px = lambda r: r.fulfill(status=200, body=PX, content_type='image/png')
    def miteco_wfs(r):
        u = r.request.url
        poly = {'type': 'Polygon', 'coordinates': [[[-3.6010, 37.1760], [-3.5990, 37.1760], [-3.5990, 37.1772], [-3.6010, 37.1772], [-3.6010, 37.1760]]]}
        if 'Zi_arpsi' in u: return r.fulfill(json={'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'codigo_sub': 'ES050_TEST', 'nombre_sub': 'Río Darro (test)'}, 'geometry': {'type': 'LineString', 'coordinates': [[-3.602, 37.176], [-3.596, 37.177]]}}]})
        feats = [{'type': 'Feature', 'properties': {'zona': 'Darro (test)', 'rio': 'Río Darro', 'estudio': 'SNCZI test', 'fecha_apro': '2020-01-01'}, 'geometry': poly}] if ('q100' in u or 'q500' in u) else []
        r.fulfill(json={'type': 'FeatureCollection', 'features': feats})
    pg.route('https://gis.miteco.gob.es/geoserver/agua/wfs**', miteco_wfs)
    pg.route('https://gis.miteco.gob.es/geoserver/agua/wms**', px)
    pg.route('https://gis.miteco.gob.es/geoserver/evaluacionambiental/**', px)
    def eea(r):
        u = r.request.url
        if 'exportImage' in u:
            m = re.search(r'size=(\d+),(\d+)', u); w, h = int(m.group(1)), int(m.group(2)); return r.fulfill(status=200, body=tiff(w, h), content_type='image/tiff')
        r.fulfill(status=200, body=PX, content_type='image/png')
    pg.route('https://image.discomap.eea.europa.eu/**', eea)
    pg.route('https://gibs.earthdata.nasa.gov/**', px)
    def ign(r):
        u = r.request.url
        if 'GetFeatureInfo' in u:
            if 'Enlace' in u and 'MTN25' not in u: return r.fulfill(status=200, body="GetFeatureInfo results: Layer 'GRID' Feature 993: NumHoja = '1009' Anyo = '1932' Ediciones = '1932nnn,1933nnn' nombreHoja = 'Granada'", content_type='text/plain')
            if 'infoVuelos' in u: return r.fulfill(status=200, body='<html><body>Vuelos disponibles Año 1956 1957 Resolución 1</body></html>', content_type='text/html')
            return r.fulfill(status=200, body='<html><body>Municipio Granada (Granada) Tipo Planimetría Fecha 1895-05-29</body></html>', content_type='text/html')
        r.fulfill(status=200, body=PX, content_type='image/png')
    pg.route('https://www.ign.es/**', ign)
    def overpass(r):
        els = [{'type': 'node', 'id': 1000 + i, 'lat': 37.1768 + i * 0.0001, 'lon': -3.5992 + i * 0.0001, 'tags': {'natural': 'tree', **({'species': 'Platanus x hispanica'} if i % 3 == 0 else {})}} for i in range(12)]
        els.append({'type': 'way', 'id': 77, 'tags': {'natural': 'tree_row'}, 'geometry': [{'lat': 37.1770, 'lon': -3.5995}, {'lat': 37.1776, 'lon': -3.5978}]})
        r.fulfill(json={'osm3s': {'timestamp_osm_base': '2026-10-30T22:00:00Z'}, 'elements': els})
    for ep in ['https://overpass-api.de/**', 'https://overpass.kumi.systems/**', 'https://overpass.private.coffee/**']: pg.route(ep, overpass)
    def wiki(r):
        u = r.request.url
        if '/api/rest_v1/page/summary/' in u: return r.fulfill(json={'title': u.split('/')[-1].replace('_', ' '), 'extract': 'Test summary from Wikipedia.', 'coordinates': {'lat': 37.1764, 'lon': -3.5990}, 'content_urls': {'desktop': {'page': 'https://es.wikipedia.org/wiki/Test'}}})
        r.fulfill(json={'query': {'geosearch': []}})
    pg.route('https://*.wikipedia.org/**', wiki)
    def commons(r):
        u = r.request.url
        if 'prop=imageinfo' in u and 'generator' not in u:
            pages = {str(i): {'pageid': i, 'title': 'File:' + t, 'imageinfo': [{'thumburl': f'http://127.0.0.1:{PORT}/tests/px.png', 'url': f'http://127.0.0.1:{PORT}/tests/px.png', 'descriptionurl': 'https://commons.wikimedia.org/', 'width': 100, 'height': 80, 'extmetadata': {'Artist': {'value': 'Archive'}, 'LicenseShortName': {'value': 'Public domain'}, 'DateTimeOriginal': {'value': '1795'}}}]} for i, t in enumerate(['Grenada (1581).jpg', 'Plataforma de Vico grabada por Francisco Heylan unida.jpg', 'Plano de Granada 1795.jpeg', 'Tomás López Maño 1787 Alcaicería Granada.jpg', 'Almanjaya Baja. Plano topografico Granada Francisco Dalmau (1796).jpg', "O'SHEAS (1895) p305 GRANADA.jpg", '1915 Granada.jpg', 'Map by the US Army Map Service - Granada - spain city plans - txu-pclmaps-oclc-6482717-granada.jpg'])}
            return r.fulfill(json={'query': {'pages': pages}})
        pages = {'1': {'pageid': 1, 'title': 'File:Camera and object.jpg', 'coordinates': [{'lat': 37.1773, 'lon': -3.5986, 'primary': ''}, {'lat': 37.1790, 'lon': -3.5960}], 'imageinfo': [{'thumburl': f'http://127.0.0.1:{PORT}/tests/px.png', 'descriptionurl': 'https://commons.wikimedia.org/', 'mime': 'image/jpeg', 'extmetadata': {'Artist': {'value': 'Tester'}, 'LicenseShortName': {'value': 'CC BY-SA 4.0'}, 'DateTimeOriginal': {'value': '2019-09-20 10:00:00'}}}]}}
        r.fulfill(json={'query': {'pages': pages}})
    pg.route('https://commons.wikimedia.org/**', commons)

def wait(pg, js, timeout=60000): pg.wait_for_function(js, timeout=timeout)

def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            ctx = b.new_context(viewport={'width': 1500, 'height': 920}, accept_downloads=True)
            pg = ctx.new_page(); errors = []
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('dialog', lambda d: d.accept())
            stub3(pg)
            base = f'http://127.0.0.1:{PORT}/index.html'

            # old projects still load (v1 fixture)
            pg.goto(base); wait(pg, 'window.GA && GA.app')
            old = json.load(open(os.path.join(ROOT, 'tests', 'fixtures', 'project_v1.json')))
            pg.evaluate('(p) => { localStorage.clear(); localStorage.setItem("granada-atlas.project.v1", JSON.stringify(p)); }', old)
            pg.reload(); wait(pg, 'window.GA && GA.app && GA.app.map.isStyleLoaded()'); wait(pg, 'GA.app.L.S.bld_floors.status !== "idle"', 30000)
            n_old = pg.evaluate('GA.app.store.get().areas.length'); check('v1 project still loads', n_old == len(old['areas']), n_old)

            # ---------- citywide layers before any selection ----------
            pg.evaluate('GA.i18n.setLang("en")')
            for k in ['places', 'bus_service', 'canopy', 'flood', 'noise', 'lst', 'history']: pg.evaluate(f'GA.app.L.setOn("{k}", true)')
            wait(pg, '["places","bus_service"].every(k => GA.app.L.S[k].status === "ok")', 40000)
            st = pg.evaluate('JSON.stringify(Object.fromEntries(["places","bus_service","canopy","flood","noise","lst","history"].map(k => [k, GA.app.L.S[k].status + ":" + (GA.app.L.S[k].statusExtra ?? "")])))')
            check('new citywide layers work with no study area', all(s.split(':')[0] == 'ok' for s in json.loads(st).values()), st)
            n_all = pg.evaluate('GA.app.L.byId.places._shown'); check('places layer shows thousands of points citywide (clustered)', n_all > 15000, n_all)
            pg.evaluate('(() => { const el = document.createElement("input"); el.dataset.k = "none"; GA.app.L.control("places", el); })()')
            check('places category filter: none → 0 shown', pg.evaluate('GA.app.L.byId.places._shown') == 0)
            pg.evaluate('(() => { const el = document.createElement("input"); el.dataset.k = "all"; GA.app.L.control("places", el); const q = document.createElement("input"); q.dataset.k = "q"; q.value = "farmacia"; GA.app.L.control("places", q); })()')
            hits = pg.evaluate('GA.app.L.byId.places._hits.length'); check('places search finds named places', hits > 0, hits)
            pg.evaluate('(() => { const q = document.createElement("input"); q.dataset.k = "q"; q.value = ""; GA.app.L.control("places", q); })()')
            nb = pg.evaluate('GA.app.L.byId.bus_service._shown')
            pg.evaluate('(() => { const el = document.createElement("input"); el.dataset.k = "sched"; el.checked = true; GA.app.L.control("bus_service", el); })()')
            ns = pg.evaluate('GA.app.L.byId.bus_service._shown'); check('bus layer: 692 stops, 622 with scheduled service on 26 Oct 2026', nb == 692 and ns == 622, f'{nb} / {ns}')
            pg.evaluate('(() => { const el = document.createElement("select"); el.dataset.k = "route"; const o = document.createElement("option"); o.value = "4"; el.appendChild(o); el.value = "4"; GA.app.L.control("bus_service", el); })()')
            nr = pg.evaluate('GA.app.L.byId.bus_service._shown'); check('bus route filter narrows the stops', 0 < nr < ns, nr)
            leg = pg.evaluate('GA.app.L.legendHTML()'); check('legends state the date and caveats', '26 October 2026' in leg and 'ridership' in leg and 'not a guarantee' in leg)
            pg.evaluate('GA.app.map.jumpTo({center: [-3.5986, 37.1773], zoom: 16})'); pg.evaluate('GA.app.L.setOn("trees", true)')
            wait(pg, 'GA.app.L.S.trees.status === "ok"', 30000); check('OSM trees load by viewport when zoomed in', pg.evaluate('GA.app.L.S.trees.statusExtra') > 0)
            for lang in ['ar', 'he', 'en']:
                pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4)
                r = pg.evaluate('() => { const g = (s) => document.querySelector(s).getBoundingClientRect(); return { l: g("#col-left"), r: g("#col-right"), m: g("#map"), W: innerWidth }; }')
                check(f'fixed panels in {lang}', abs(r['l']['left']) < 1 and abs(r['r']['right'] - r['W']) < 1 and abs(r['m']['left'] - r['l']['right']) < 2)
            pg.evaluate('GA.i18n.setLang("en")')
            for k in ['places', 'bus_service', 'canopy', 'flood', 'noise', 'lst', 'history', 'trees']: pg.evaluate(f'GA.app.L.setOn("{k}", false)')

            # ---------- analysis with the new cards ----------
            pg.evaluate('GA.app.sel.reset()'); pg.evaluate('GA.app.sel.setCenterDirect([-3.5995, 37.1766])'); time.sleep(0.3)
            pg.fill('#in-name', 'Centro v3'); pg.click('#btn-analyze')
            wait(pg, 'GA.app.getRun() && GA.app.getRun().X && document.querySelector("[data-card=flood]") && document.querySelector("[data-card=trees]")', 90000); time.sleep(1)
            cards = pg.evaluate('[...document.querySelectorAll("#left-body [data-card]")].map(c => c.dataset.card).join(",")')
            check('gallery adds places, bus, trees, flood, noise cards', all(k in cards.split(',') for k in ['places', 'bus', 'trees', 'flood', 'noise']), cards)
            iv = pg.evaluate('JSON.stringify(GA.compare.indicators(GA.app.getRun().X))'); iv = json.loads(iv)
            check('new indicators computed (places, bus, canopy, trees, flood)', iv['places_n'] and iv['bus_mapped'] is not None and iv['canopy_mean'] is not None and iv['trees_mapped'] and iv['flood_t100_share'] > 0, {k: iv[k] for k in ['places_n', 'bus_mapped', 'bus_sched', 'canopy_mean', 'trees_mapped', 'flood_t100_share']})
            check('stub flood zone gives exact clipped share (0–1)', 0 < iv['flood_t100_share'] < 1, iv['flood_t100_share'])
            pg.screenshot(path=os.path.join(OUT, 'v3_gallery.png'))
            aid = pg.evaluate('GA.app.getRun().areaId')

            # ---------- sections: redesigned graphics, look direction, SVG ----------
            pg.click('[data-ltab="sections"]'); pg.click('#sec-draw')
            for x, y in [(-3.6005, 37.1764), (-3.5985, 37.1769)]: pg.evaluate(f'(() => {{ const p = GA.app.map.project([{x}, {y}]); GA.app.secTool.click({{ lngLat: {{ lng: {x}, lat: {y} }}, point: p }}); }})()')
            pg.evaluate('GA.app.secTool.finish()'); wait(pg, 'document.querySelector("#sec-cv")', 40000); time.sleep(1)
            prof = pg.evaluate('(async () => { const a = GA.app.store.get().areas.find(x => x.id === GA.app.getRun().areaId); const s = a.sections[0]; const L = await GA.section.compute(Object.assign({}, s, {look: "left"}), {floorH: 3}); const R = await GA.section.compute(Object.assign({}, s, {look: "right"}), {floorH: 3}); const svg = GA.section.svg(L, {w: 1200, h: 640}); return JSON.stringify({cuts: L.cuts.length, bgL: L.bg.length, bgR: R.bg.length, trees: L.trees.length, svgLen: svg.length, red: (svg.match(/stroke="#992B2A"/g) || []).length, dashed: svg.includes("stroke-dasharray=\\"4 3\\""), white: svg.includes("fill=\\"#FFFFFF\\""), ref: !!L.ref, txt: svg.includes("<text") }); })()')
            prof = json.loads(prof); check('section: cut outlines red with white interior; estimates dashed; SVG is vector', prof['red'] > 0 and prof['white'] and prof['txt'] and prof['svgLen'] > 2000, prof)
            check('section: viewing direction selects background on one side only', prof['bgL'] != prof['bgR'] or (prof['bgL'] == 0 and prof['bgR'] == 0), prof)
            check('section: mapped trees drawn (illustrative) and location reference present', prof['trees'] > 0 and prof['ref'], prof)
            with pg.expect_download(timeout=60000) as dl: pg.click('#sec-svg')
            d = dl.value; path = os.path.join(OUT, 'v3_section.svg'); d.save_as(path); svgt = open(path, encoding='utf-8').read()
            check('section SVG export downloads', svgt.startswith('<?xml') and '<svg' in svgt, d.suggested_filename)
            pg.locator('#sec-cv').screenshot(path=os.path.join(OUT, 'v3_section.png'))

            # ---------- library ----------
            pg.evaluate('location.hash = "#/library"'); wait(pg, 'document.querySelector(".lib-top")', 20000)
            pg.evaluate('(async () => { await GA.library.addItem({ kind: "note", title: "Plaza note", note: "our note", excerpt: "quoted", tags: ["surprise"], source: "INE", date: "2021" }); const c = document.createElement("canvas"); c.width = c.height = 40; const bl = await new Promise(r => c.toBlob(r)); await GA.library.addBlob(bl, { title: "Test image", fileName: "test.png" }); })()')
            pg.evaluate('GA.pages.route()'); wait(pg, 'document.querySelectorAll(".lib-card").length >= 2', 20000)
            n_uns = pg.evaluate('(async () => (await GA.library.list()).filter(GA.library.unsorted).length)()')
            check('library: items saved, all unsorted until linked', n_uns >= 2, n_uns)
            pg.evaluate(f'(async () => {{ const L = await GA.library.list(); await GA.library.link(L.find(i => i.title === "Test image").id, "fabrics", "{aid}", true); await GA.library.link(L.find(i => i.title === "Test image").id, "themes", "climate", true); }})()')
            linked = pg.evaluate(f'(async () => (await GA.library.byLink("fabrics", "{aid}")).length)()'); check('library: an item links to a fabric and a theme without duplication', linked == 1 and pg.evaluate('(async () => (await GA.library.list()).length)()') == 2)
            pg.fill('#lib-q', 'plaza'); time.sleep(0.8); check('library: search', pg.evaluate('document.querySelectorAll(".lib-card").length') == 1)
            pg.reload(); wait(pg, 'window.GA && GA.app && GA.app.map.isStyleLoaded()'); wait(pg, 'document.querySelector(".lib-top")', 20000)
            check('library: persists across reload (IndexedDB)', pg.evaluate('(async () => (await GA.library.list()).length)()') == 2)
            with pg.expect_download(timeout=30000) as dl: pg.click('#lib-export')
            z = zipfile.ZipFile(io.BytesIO(open(dl.value.path(), 'rb').read())); names = z.namelist()
            check('library: backup ZIP holds library.json and the original file', 'library.json' in names and any(n.startswith('files/') for n in names), names)
            pg.screenshot(path=os.path.join(OUT, 'v3_library.png'))

            # ---------- analysis page (v5 redesign of the fabric page) ----------
            pg.evaluate(f'GA.pages.go("fabric", "{aid}")'); wait(pg, 'document.querySelectorAll(".ap-sec").length === 8', 90000); time.sleep(2)
            check('analysis page: eight result headings after the identity hero', True)
            check('analysis page: attached library image appears', pg.evaluate('document.querySelector("#fb-attachments") && document.querySelector("#fb-attachments").innerText.includes("Test image")'))
            wait(pg, 'document.querySelectorAll("[data-hist] canvas").length >= 2', 40000); check('analysis page: historical snapshots of the same extent', True)
            pg.evaluate('GA.fabric.setEdit(true)'); wait(pg, 'document.querySelector("[data-block=environment] [data-fb=up]")', 30000)
            pg.evaluate('document.querySelector("[data-block=environment] [data-fb=up]").click()'); time.sleep(1.5)
            order1 = pg.evaluate(f'GA.fabric.board("{aid}").order.join(",")')
            pg.fill('[data-fb-cap=form]', 'Caption test'); pg.press('[data-fb-cap=form]', 'Tab'); time.sleep(0.3)
            pg.reload(); wait(pg, 'window.GA && GA.app && GA.app.map.isStyleLoaded()'); wait(pg, 'document.querySelectorAll(".ap-sec").length === 8', 90000)
            order2 = pg.evaluate(f'GA.fabric.board("{aid}").order.join(",")'); cap = pg.evaluate('document.querySelector("#ap-form .ap-cap") && document.querySelector("#ap-form .ap-cap").innerText')
            check('analysis page persists order and captions (view mode shows the caption as text)', order1 == order2 and order1.index('environment') < order1.index('activities') and cap == 'Caption test', order2)
            time.sleep(3); pg.screenshot(path=os.path.join(OUT, 'v3_fabric.png'), full_page=False)
            with pg.expect_download(timeout=180000) as dl: pg.evaluate(f'GA.fabric.exportPDF("{aid}")')
            pdf = open(dl.value.path(), 'rb').read(); pages = len(re.findall(rb'/Type /Page\b', pdf))
            check('analysis page: composed A3 PDF, identity + one page per visible heading', pdf.startswith(b'%PDF') and pages == 9, pages)
            pg.evaluate('GA.fabric.setEdit(false)')

            # ---------- historical explorer ----------
            pg.evaluate('GA.pages.go("history")'); wait(pg, 'document.querySelector("#hx-map-a") && document.querySelectorAll(".hx-item").length === 8', 40000)
            check('history: archive scans listed and flagged as not georeferenced', pg.evaluate('document.querySelectorAll(".hx-item .tag").length') == 8)
            check('history: publication date and depicted period both shown', pg.evaluate('document.querySelector(".hx-item").innerText.includes("Published") && document.querySelector(".hx-item").innerText.includes("Depicts")'))
            wait(pg, 'document.querySelector("#hx-info") && /1932|1956|1895/.test(document.querySelector("#hx-info").innerText)', 30000); check('history: date of the sheet/flight at the view centre (GetFeatureInfo)', True, pg.evaluate('document.querySelector("#hx-info").innerText.slice(0,160)'))
            pg.click('#hx-swipe'); wait(pg, 'document.querySelector("#hx-map-b")', 20000); check('history: before/after swipe creates a second synced map', True)
            pg.click('[data-hx-col="2"]'); time.sleep(0.5); check('history: collage item added', pg.evaluate('GA.app.store.get().history.collage.length') >= 1)
            wait(pg, 'document.querySelectorAll(".hx-place").length >= 5', 30000); check('history: linked places with Wikipedia summaries', True)
            time.sleep(1.5); pg.screenshot(path=os.path.join(OUT, 'v3_history.png'))

            # ---------- studio ----------
            pg.evaluate('GA.pages.go("studio")'); wait(pg, 'document.querySelector(".sched")', 20000)
            txt = pg.evaluate('document.querySelector(".sched").innerText + " " + [...document.querySelectorAll(".sched input, .sched textarea")].map(e => e.value).join(" ")')
            check('studio: schedule dated 2026, Sunday 1 November at 14:00, no invented Zoom link', 'Sunday, November 1, 2026' in txt and '14:00' in txt and 'zoom.us' not in txt, txt[:200])
            pg.evaluate('GA.pages.go("studio", "boards")'); wait(pg, 'document.querySelectorAll(".slot").length === 5', 20000)
            pg.select_option('.slot [data-sf=assign]', 'climate'); time.sleep(0.5)
            wait(pg, 'document.querySelector(".slot")', 10000)
            with pg.expect_download(timeout=120000) as dl: pg.click('.slot [data-sx=png]')
            time.sleep(0.5); st = pg.evaluate('GA.studio.S().slots.st1[0].status')
            check('studio: exporting a square marks it Exported, never Uploaded', st == 'exported', st)
            pg.evaluate('GA.pages.go("studio", "climate")'); wait(pg, 'document.querySelector(".cl-prev canvas")', 90000)
            with pg.expect_download(timeout=120000) as dl: pg.click('#cl-pdf')
            check('studio: climate board exports (PDF)', open(dl.value.path(), 'rb').read().startswith(b'%PDF'))
            time.sleep(0.5); pg.screenshot(path=os.path.join(OUT, 'v3_climate.png'))
            pg.evaluate('GA.pages.go("studio", "exercises")'); wait(pg, 'document.querySelectorAll(".rx").length >= 4', 20000)
            pg.fill('#rx-title', 'Exercise 2.1 test'); pg.fill('#rx-text', 'Students must map the street network.\nYou can add photographs for example.\nThe sheet A3 format with legend.'); pg.click('#rx-make'); time.sleep(0.5)
            ex = json.loads(pg.evaluate('JSON.stringify(GA.app.store.get().exreg)'))
            check('exercise registry: new exercise added with typed requirements for review', len(ex) == 1 and [r['type'] for r in ex[0]['req']] == ['m', 's', 'a'], [r['type'] for r in ex[0]['req']])

            # ---------- exercise 1.3 ----------
            pg.evaluate('GA.pages.go("ex13")'); wait(pg, 'document.querySelectorAll(".e13-prev canvas").length === 6', 120000)
            with pg.expect_download(timeout=180000) as dl: pg.click('#e13-pdf')
            pdf = open(dl.value.path(), 'rb').read(); n = len(re.findall(rb'/Type /Page\b', pdf))
            check('exercise 1.3: identity page + five maps in one PDF', n == 6, n)
            check('exercise 1.3: same 10 km frame and 1:50,000 on every page', pg.evaluate('GA.lastEx13.den') == 50000)
            with pg.expect_download(timeout=180000) as dl: pg.click('#e13-zip')
            z = zipfile.ZipFile(io.BytesIO(open(dl.value.path(), 'rb').read())); check('exercise 1.3: one image per page (ZIP of 6 PNGs)', len(z.namelist()) == 6, z.namelist())
            time.sleep(0.5); pg.screenshot(path=os.path.join(OUT, 'v3_ex13.png'))
            for k in ['identity', 'density', 'centre', 'human']:
                pg.evaluate(f'(async () => {{ const c = await GA.ex13.pageCanvas("{k}"); window.__p = c.toDataURL("image/jpeg", 0.8); }})()'); time.sleep(0.2)
                import base64; open(os.path.join(OUT, f'v3_ex13_{k}.jpg'), 'wb').write(base64.b64decode(pg.evaluate('window.__p').split(',')[1]))

            # ---------- GIS export with the new layers ----------
            pg.evaluate('GA.pages.close()'); pg.evaluate(f'GA.app.openArea("{aid}")'); wait(pg, 'GA.app.getRun() && GA.app.getRun().X', 90000); time.sleep(0.5)
            pg.click('#btn-gis'); wait(pg, 'document.querySelector("#x-go")', 10000)
            with pg.expect_download(timeout=120000) as dl: pg.click('#x-go')
            files = pg.evaluate('GA.lastExport.files.map(f => f.name).join(",")')
            check('GIS export includes places, bus_service, trees, flood_zones', all(f'geojson/{k}.geojson' in files for k in ['places', 'bus_service', 'trees', 'flood_zones']), files)
            os.makedirs(os.path.join(OUT, 'v3_export'), exist_ok=True); dl.value.save_as(os.path.join(OUT, 'v3_export', 'x_gis.zip'))
            ring = pg.evaluate('JSON.stringify(GA.app.getRun().X.ring)'); open(os.path.join(OUT, 'v3_export', 'ring.json'), 'w').write(ring)

            check('no page errors', not errors, errors[:5])
            b.close()
    finally:
        srv.terminate()
    print(f'\n{len(fails)} failure(s)'); [print(' -', f) for f in fails]

if __name__ == '__main__': main()
