# v5 acceptance tests: data findings (flood availability, place wording, transport messages, photo dates), the full
# analysis page, click-to-enlarge viewers, the unified Comparison workspace, the section view with evidence-based
# detail and annotations, touch drawing controls, phone/iPad layouts in three languages, and downloaded exports that
# are opened and checked (PDF with pdfinfo/pdftoppm, PNG with Pillow, SVG parsed as XML, GIS with validate_export).
# Run: python3 tests/ui_test_v5.py [output_dir]
import json, os, re, subprocess, sys, time, zipfile, io, xml.dom.minidom
from playwright.sync_api import sync_playwright
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui_test_v3 as V3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
PORT = 8772; V3.PORT = PORT; V3.V2.PORT = PORT
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  — ' + str(extra)[:300]) if extra != '' else '')); (None if cond else fails.append(name))
def wait(pg, js, timeout=60000): pg.wait_for_function(js, timeout=timeout)

def open_pdf(path):  # → (pages, first page rendered and not blank)
    info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout; pages = int(re.search(r'Pages:\s+(\d+)', info).group(1))
    png = path + '.p1'; subprocess.run(['pdftoppm', '-r', '30', '-f', '1', '-l', '1', '-png', path, png], check=True)
    f = [x for x in os.listdir(os.path.dirname(png)) if x.startswith(os.path.basename(png))][0]; im = Image.open(os.path.join(os.path.dirname(png), f)).convert('L')
    ext = im.getextrema(); return pages, ext[0] < 200 and ext[1] > 200, im.size
def open_png(path): im = Image.open(path); im.load(); ext = im.convert('L').getextrema(); return im.size, ext[0] < 200

OVER = '''() => { const W = innerWidth; const bad = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return; if (e.closest('.maplibregl-canvas-container, [hidden]')) return; let p = e.parentElement, clipped = false; while (p && p !== document.body) { if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; } p = p.parentElement; } if (clipped) return; if (r.right > W + 1 || r.left < -1) bad.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }); return bad.slice(0, 8); }'''
NAVOV = '''() => { const bs = [...document.querySelectorAll('.topbar button, .phone-bar button')].filter(b => b.offsetWidth && getComputedStyle(b).visibility !== 'hidden'); const o = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect(); const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 1 && iy > 1) o.push(bs[i].innerText.trim() + ' × ' + bs[j].innerText.trim()); } return o; }'''
PANELS = '''() => { const B = document.body.classList; const l = !B.contains('left-collapsed'), r = !B.contains('right-collapsed'); return { l, r }; }'''

def stub5(pg):
    V3.stub3(pg)
    # SNCZI: Darro reach modelled for T10/T100/T500 but not T50; a minor stream modelled for T50 nearby (as in the real service)
    def wfs(r):
        u = r.request.url; poly = {'type': 'Polygon', 'coordinates': [[[-3.6010, 37.1760], [-3.5990, 37.1760], [-3.5990, 37.1772], [-3.6010, 37.1772], [-3.6010, 37.1760]]]}
        far = {'type': 'Polygon', 'coordinates': [[[-3.62, 37.16], [-3.619, 37.16], [-3.619, 37.161], [-3.62, 37.161], [-3.62, 37.16]]]}
        wide = re.search(r'bbox=([\d.\-]+),([\d.\-]+),([\d.\-]+),([\d.\-]+)', u); span = abs(float(wide.group(3)) - float(wide.group(1))) if wide else 0
        if 'Zi_arpsi' in u: return r.fulfill(json={'type': 'FeatureCollection', 'features': []})
        if 'q50' in u: feats = [{'type': 'Feature', 'properties': {'rio': 'Río Dilar', 'estudio': 'SNCZI test'}, 'geometry': far}] if span > 0.01 else []
        else: feats = [{'type': 'Feature', 'properties': {'rio': 'Río Darro; Río Genil', 'estudio': 'SNCZI test', 'fecha_apro': '2020-01-01'}, 'geometry': poly}]
        r.fulfill(json={'type': 'FeatureCollection', 'features': feats})
    pg.route('https://gis.miteco.gob.es/geoserver/agua/wfs**', wfs)
    def commons(r):
        if 'prop=imageinfo' in r.request.url and 'generator' not in r.request.url: return r.fallback()
        mk = lambda i, d: {'pageid': i, 'title': f'File:Test {i}.jpg', 'coordinates': [{'lat': 37.1766, 'lon': -3.5995, 'primary': ''}], 'imageinfo': [{'thumburl': f'http://127.0.0.1:{PORT}/tests/px.png', 'descriptionurl': 'https://commons.wikimedia.org/', 'mime': 'image/jpeg', 'extmetadata': {'Artist': {'value': 'Tester'}, 'LicenseShortName': {'value': 'CC BY-SA 4.0'}, 'DateTimeOriginal': {'value': d}}}]}
        r.fulfill(json={'query': {'pages': {'1': mk(1, 'Taken on 3 March 2019'), '2': mk(2, '20 September 2019 10:00'), '3': mk(3, 'circa 1900')}}})
    pg.route('https://commons.wikimedia.org/**', commons)

def mk_area(pg, name, ll):
    pg.evaluate('document.querySelector("#btn-reset") && document.querySelector("#btn-reset").click()'); time.sleep(0.2)
    pg.evaluate(f'GA.app.sel.setCenterDirect({json.dumps(ll)})'); time.sleep(0.3); pg.fill('#in-name', name); pg.click('#btn-analyze')
    wait(pg, 'GA.app.getRun() && GA.app.getRun().X && !Object.values(GA.app.getRun().tasks).some(x => x.state === "running")', 120000); time.sleep(0.8)
    return pg.evaluate('GA.app.getRun().areaId')

def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    dl_dir = os.path.join(OUT, 'v5_downloads'); os.makedirs(dl_dir, exist_ok=True)
    def save(dl, name): p = os.path.join(dl_dir, name); dl.value.save_as(p); return p
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); pg = ctx.new_page(); errors = []
            pg.on('pageerror', lambda e: errors.append(str(e))); pg.on('dialog', lambda d: d.accept()); stub5(pg)
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); wait(pg, 'window.GA && GA.app && GA.app.map.isStyleLoaded()')
            old = json.load(open(os.path.join(ROOT, 'tests', 'fixtures', 'project_v1.json')))
            pg.evaluate('(p) => { localStorage.clear(); localStorage.setItem("granada-atlas.project.v1", JSON.stringify(p)); }', old)
            pg.reload(); wait(pg, 'window.GA && GA.app && GA.app.map.isStyleLoaded()')
            check('saved v1 project still loads', pg.evaluate('GA.app.store.get().areas.length') == len(old['areas']))
            pg.evaluate('GA.i18n.setLang("en")')

            # ---------- analysis + data findings ----------
            a1 = mk_area(pg, 'Centro', [-3.5995, 37.1766])
            wait(pg, '!GA.app.getRun().X.extPending', 60000); time.sleep(1)
            fz = json.loads(pg.evaluate('JSON.stringify(Object.fromEntries(Object.entries(GA.app.getRun().X.R.flood.zones).map(([k, v]) => [k, [v.status, v.share]])))'))
            check('flood: T50 is "not modelled" (missing data), not 0 %', fz['q50'][0] == 'not_modelled' and fz['q50'][1] is None and fz['q10'][0] == 'ok' and fz['q10'][1] > 0, fz)
            fl = pg.evaluate('document.querySelector("[data-card=flood]").innerText')
            check('flood card shows "Not modelled here" and explains it', 'Not modelled here' in fl and 'not modelled for the nearby reaches' in fl and 'T50' in fl, fl[:200])
            why = pg.evaluate('GA.compare.indicators(GA.app.getRun().X)._why.flood_t50_share'); check('indicator keeps the reason for a missing value', why == 'not_modelled', why)
            pl = pg.evaluate('document.querySelector("[data-card=places]").innerText')
            check('places: accurate wording with known-operating / unknown / closed counts', 'excluding those marked permanently closed' in pl and 'known operating' in pl and 'status unknown' in pl and 'active places' not in pl, pl[:240])
            tr = pg.evaluate('document.querySelector("[data-card=transit]").innerText')
            check('transport: OSM stop card points to the scheduled-service card (no contradiction)', 'GTFS is not connected' not in tr and 'Scheduled bus service' in tr, tr[-200:])
            pg.click('[data-ltab="notes"]'); time.sleep(1); notes = pg.evaluate('document.querySelector("#left-body").innerText')
            check('photo dates parsed and localised; unreadable dates say "Date unknown"', '3 March 2019' in notes and '20 September 2019' in notes and 'Date unknown' in notes and 'Septemb\n' not in notes, re.findall(r'(?:Taken|Date)[^\n]{0,40}', notes)[:4])
            pg.click('[data-ltab="maps"]'); time.sleep(0.5)

            # ---------- result maps open in a viewer ----------
            pg.click('[data-card=heights] .card-map'); wait(pg, 'document.querySelector(".vw-map .vw-cv")', 10000); time.sleep(1)
            vw = pg.evaluate('(() => { const v = document.querySelector(".vw-map"); return { title: v.querySelector("h2").innerText, legend: v.querySelectorAll(".vw-side .lg li").length, src: v.querySelector(".vw-src").innerText, close: v.querySelector(".vw-close").innerText }; })()')
            check('panel map opens a large viewer with title, legend, source and a labelled Close', 'Building heights' in vw['title'] and vw['legend'] >= 3 and 'OpenStreetMap' in vw['src'] and 'Close' in vw['close'], vw)
            st0 = pg.evaluate('GA.lastViewer.state'); r = pg.evaluate('(() => { const s = document.querySelector(".vw-stage").getBoundingClientRect(); return [s.left + s.width / 2, s.top + s.height / 2, s.width]; })()')
            pg.mouse.move(r[0], r[1]); pg.mouse.wheel(0, -500); time.sleep(0.5); st1 = pg.evaluate('GA.lastViewer.state')
            pg.mouse.move(r[0], r[1]); pg.mouse.down(); pg.mouse.move(r[0] + 120, r[1] + 40, steps=5); pg.mouse.up(); time.sleep(0.3); st2 = pg.evaluate('GA.lastViewer.state')
            check('viewer: wheel zooms, drag pans (redrawn from data)', st1['mpp'] < st0['mpp'] * 0.8 and abs(st2['cx'] - st1['cx']) > 10, (st0, st1, st2))
            pg.keyboard.press('+'); time.sleep(0.3); st3 = pg.evaluate('GA.lastViewer.state'); check('viewer: keyboard zoom (+)', st3['mpp'] < st2['mpp'], st3)
            pg.evaluate('(() => { const s = document.querySelector(".vw-stage").getBoundingClientRect(); const v = GA.lastViewer; const u = GA.proj.EPSG25830.forward([-3.5995, 37.1766]); const st = v.state; v.inspectAt((u[0] - st.cx) / st.mpp + s.width / 2, s.height / 2 - (u[1] - st.cy) / st.mpp); })()'); time.sleep(0.3)
            info = pg.evaluate('document.querySelector(".vw-info").innerText'); check('viewer: clicking a mapped feature shows its information', 'Floors' in info or 'Building' in info, info[:160])
            with pg.expect_download() as dl: pg.click('.vw-map [data-x=png]')
            size, ink = open_png(save(dl, 'viewer.png')); check('viewer PNG downloads and opens (title, map, legend)', size[0] == 1800 and ink, size)
            with pg.expect_download() as dl: pg.click('.vw-map [data-x=pdf]')
            n, ink, _ = open_pdf(save(dl, 'viewer.pdf')); check('viewer PDF downloads and opens', n == 1 and ink, n)
            pg.keyboard.press('Escape'); time.sleep(0.3)
            pg.evaluate('document.querySelector("#left-body").scrollTop = 600'); sc0 = pg.evaluate('document.querySelector("#left-body").scrollTop')
            pg.click('[data-card=heights] .card-map') if pg.evaluate('(() => { const r = document.querySelector("[data-card=heights] .card-map").getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })()') else pg.evaluate('document.querySelector("[data-card=places] .card-map").click()')
            wait(pg, 'GA.viewer.isOpen()', 5000); pg.keyboard.press('Escape'); time.sleep(0.3)
            check('Escape closes the viewer and keeps the panel scroll position', not pg.evaluate('GA.viewer.isOpen()') and pg.evaluate('document.querySelector("#left-body").scrollTop') == sc0)
            pg.click('[data-card=places] [data-act=chart]'); wait(pg, 'document.querySelector(".vw-html .ch-big")', 5000); check('charts open enlarged', True); pg.keyboard.press('Escape')

            # ---------- full analysis page ----------
            pg.click('#btn-view-analysis'); wait(pg, 'document.querySelectorAll(".ap-sec").length === 8', 90000); time.sleep(2)
            ap = json.loads(pg.evaluate('''JSON.stringify({ name: document.querySelector(".ap-name").innerText, nameSize: parseFloat(getComputedStyle(document.querySelector(".ap-name")).fontSize), loc: (() => { const c = document.querySelector("#ap-loc"); return c && c.width > 400; })(),
              heads: [...document.querySelectorAll(".ap-sec h2")].map(h => h.innerText), toc: document.querySelectorAll(".ap-toc a").length, kpis: document.querySelectorAll(".ap-kpis div").length, lg: document.querySelector(".ap-loc figcaption").innerText,
              actions: [...document.querySelectorAll(".pg-h .actions button")].map(b => b.innerText) })'''))
            check('analysis page: large name, large location map with legend, key indicators', ap['name'] == 'Centro' and ap['nameSize'] >= 30 and ap['loc'] and ap['kpis'] == 6 and 'This fabric' in ap['lg'] and 'Landmark' in ap['lg'], ap)
            want = ['Urban form and buildings', 'Streets and mobility', 'Activities and services', 'Trees, climate and environment', 'History and photographs', 'Architectural sections', 'Findings, research questions and design implications']
            check('analysis page: results under the seven required headings + navigation', all(w in ap['heads'] for w in want) and ap['toc'] == 8, ap['heads'])
            check('analysis page: Back to map, Compare and export actions', any('Back to map' in x for x in ap['actions']) and 'Compare' in ap['actions'] and 'Export PDF' in ap['actions'], ap['actions'])
            check('analysis page: view mode shows no editing forms', pg.evaluate('document.querySelectorAll("#page .ap textarea").length') == 0)
            pg.screenshot(path=os.path.join(OUT, 'v5_analysis_page.png'))
            pg.click('[data-ap-loc]'); wait(pg, 'document.querySelector(".vw-map .vw-cv")', 10000); time.sleep(1); check('location map enlarges', 'Location within Granada' in pg.evaluate('document.querySelector(".vw-map h2").innerText')); pg.keyboard.press('Escape')
            pg.evaluate('document.querySelector("#ap-environment").scrollIntoView()'); time.sleep(1.5)
            pg.click('[data-ap-card=flood]'); wait(pg, 'document.querySelector(".vw-map .vw-cv")', 10000); check('analysis page maps open in the viewer', True); pg.keyboard.press('Escape')
            pg.evaluate('GA.fabric.setEdit(true)'); time.sleep(1.5); check('Edit mode reveals captions and editing tools', pg.evaluate('document.querySelectorAll("#page .ap textarea[data-fb-cap]").length') >= 7); pg.evaluate('GA.fabric.setEdit(false)'); time.sleep(1)
            with pg.expect_download(timeout=240000) as dl: pg.evaluate(f'GA.fabric.exportPDF("{a1}")')
            n, ink, _ = open_pdf(save(dl, 'analysis.pdf')); check('analysis page composed PDF downloads and opens (identity + 8 headings)', n == 9 and ink, n)

            # ---------- sections: touch controls, enlarged view, evidence vs illustrative, annotations ----------
            pg.evaluate('GA.pages.close()'); time.sleep(0.5); pg.click('[data-ltab="sections"]'); pg.click('#sec-draw')
            for x, y in [(-3.6005, 37.1764), (-3.5985, 37.1769)]: pg.evaluate(f'(() => {{ const p = GA.app.map.project([{x}, {y}]); GA.app.secTool.click({{ lngLat: {{ lng: {x}, lat: {y} }}, point: p }}); }})()')
            check('section drawing shows Undo / Finish / Cancel buttons on the map', pg.evaluate('!!document.querySelector("#mb-undo") && !!document.querySelector("#mb-finish") && !!document.querySelector("#mb-cancel")'))
            pg.click('#mb-finish'); wait(pg, 'document.querySelector("#sec-cv")', 40000); time.sleep(1)
            pg.click('#sec-enlarge'); wait(pg, 'GA.lastViewer && GA.lastViewer.kind === "section" && GA.lastViewer.last', 40000); time.sleep(0.8)
            pg.click('.vw-sec [data-ve="1"]'); time.sleep(0.8); ve1 = pg.evaluate('GA.lastViewer.last.ve'); check('VE buttons include true scale ×1', ve1 == 1, ve1)
            pg.click('.vw-sec [data-ve="5"]'); time.sleep(0.8); check('VE ×5 is applied and stated', pg.evaluate('GA.lastViewer.last.ve') == 5)
            pg.click('.vw-sec [data-ill="1"]'); time.sleep(0.8); fl1 = pg.evaluate('JSON.stringify(GA.lastViewer.last.flags)')
            pg.click('.vw-sec [data-ill="0"]'); time.sleep(0.8); fl0 = pg.evaluate('JSON.stringify(GA.lastViewer.last.flags)')
            check('illustrative detail only when chosen (labelled); evidence-only draws none', json.loads(fl1)['illustrative'] and not json.loads(fl0)['illustrative'], (fl1, fl0))
            hid = pg.evaluate('(GA.lastViewer.last.hits.find(h => h.kind === "cut" && h.c.h) || {}).id'); pg.evaluate(f'GA.lastViewer.annotate("{hid}")'); time.sleep(0.3)
            pg.select_option('.ann-f [name=wall]', 'brick'); pg.click('.ann-f [type=submit]'); time.sleep(0.3)
            check('annotation is refused without a source', pg.evaluate(f'!(GA.app.store.get().buildingNotes || {{}})["{hid}"]'))
            pg.select_option('.ann-f [name=roof]', 'gabled'); pg.select_option('.ann-f [name=roofMat]', 'tiles'); pg.select_option('.ann-f [name=balconies]', 'yes'); pg.fill('.ann-f [name=balconyFloors]', 'all'); pg.fill('.ann-f [name=source]', 'Field photo (test)'); pg.click('.ann-f [type=submit]'); time.sleep(1)
            note = pg.evaluate(f'JSON.stringify(GA.app.store.get().buildingNotes["{hid}"])'); check('annotation with a source is saved and drawn as documented detail', note and 'Field photo' in note and pg.evaluate('GA.lastViewer.last.flags.documented'), note)
            with pg.expect_download() as dl: pg.click('.vw-sec [data-sx=svg]')
            svgp = save(dl, 'section.svg'); svg = open(svgp, encoding='utf-8').read(); doc = xml.dom.minidom.parseString(svg.encode())
            check('section SVG downloads and parses; red cuts, no distance axis, documented brick band', doc.documentElement.tagName == 'svg' and '#992B2A' in svg and 'Distance from A' not in svg and '#B9785C' in svg, len(svg))
            with pg.expect_download() as dl: pg.click('.vw-sec [data-sx=png]')
            size, ink = open_png(save(dl, 'section.png')); check('section PNG downloads and opens', size[0] >= 3000 and ink, size)
            with pg.expect_download() as dl: pg.click('.vw-sec [data-sx=pdf]')
            n, ink, _ = open_pdf(save(dl, 'section.pdf')); check('section PDF downloads and opens', n == 1 and ink, n)
            pg.screenshot(path=os.path.join(OUT, 'v5_section_view.png')); pg.keyboard.press('Escape'); time.sleep(0.3)
            # polygon drawing with explicit buttons
            pg.click('[data-ltab="maps"]'); pg.evaluate('GA.app.sel.chooseTool("polygon")'); time.sleep(0.3)
            check('polygon drawing shows Undo / Finish / Cancel on the map', pg.evaluate('!!document.querySelector("#pb-finish") && !!document.querySelector("#pb-undo") && !!document.querySelector("#pb-cancel")'))
            pg.click('#pb-cancel'); time.sleep(0.3)

            # ---------- unified comparison ----------
            a2 = mk_area(pg, 'Realejo', [-3.5930, 37.1720]); a3 = mk_area(pg, 'Albaicín', [-3.5930, 37.1810]); a4 = mk_area(pg, 'Zaidín', [-3.5900, 37.1600])
            labels = {}
            for lang in ['en', 'ar', 'he']: pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3); labels[lang] = pg.evaluate('document.querySelector("#tb-compare").innerText.trim()')
            check('navigation label: Comparison / مقارنة / השוואה', labels == {'en': 'Comparison', 'ar': 'مقارنة', 'he': 'השוואה'}, labels)
            pg.evaluate('GA.i18n.setLang("en")')
            pg.evaluate('(ids) => { const p = GA.app.store.get(); p.compare = { ids, unified: true }; GA.app.store.save(); }', [a1, a2]); pg.click('#tb-compare')
            wait(pg, 'document.querySelectorAll("#ws-content canvas[data-cmp]").length === 8', 120000); time.sleep(1)
            two = pg.evaluate('document.querySelector(".ws-status").innerText'); check('two fabrics: a useful comparison, clearly not a complete submission', 'not a complete submission' in two, two)
            check('one workspace holds maps, findings, table and the assignment section', pg.evaluate('!!document.querySelector("#ex-overview") && !!document.querySelector(".cmp-key") && !!document.querySelector("table.cmp") && !!document.querySelector("#ws-assign") && !document.querySelector("[data-ws-tab]")'))
            pg.evaluate('(ids) => { const p = GA.app.store.get(); p.compare.ids = ids; GA.app.store.save(); GA.app.CMP.render(); }', [a1, a2, a3, a4]); wait(pg, 'document.querySelectorAll("#ws-content canvas[data-cmp]").length === 16', 180000); time.sleep(1)
            four = pg.evaluate('document.querySelector(".ws-status").innerText'); check('four fabrics meet the submission minimum', 'meets the submission minimum' in four, four)
            pg.screenshot(path=os.path.join(OUT, 'v5_comparison.png'))
            pg.click('[data-cmp-open="fg"][data-i="2"]'); wait(pg, 'document.querySelector(".vw-map .vw-cv") && GA.lastViewer.state.mpp !== 1', 10000); check('comparison maps open in the viewer at the shared scale', abs(pg.evaluate('GA.lastViewer.state.mpp') - pg.evaluate('document.querySelector("#ws-content")._view.view.mpp')) < 1e-9); pg.keyboard.press('Escape')
            pg.evaluate('document.querySelector("#ws-assign").open = true'); time.sleep(0.3)
            pg.fill(f'[data-ex-just="{a1}"]', 'Compact historic blocks.'); pg.press(f'[data-ex-just="{a1}"]', 'Tab')
            with pg.expect_download(timeout=300000) as dl: pg.click('#ex-pdf')
            n, ink, _ = open_pdf(save(dl, 'comparison.pdf')); check('comparison composed PDF downloads and opens (cover + one A3 sheet per fabric)', n == 5 and ink, n)
            with pg.expect_download(timeout=180000) as dl: pg.click('#ws-gis')
            gis = save(dl, 'x_gis.zip'); z = zipfile.ZipFile(gis); check('comparison GIS ZIP downloads and opens', any(n.endswith('.gpkg') for n in z.namelist()), z.namelist()[:4])
            import sqlite3, tempfile
            gp = [n for n in z.namelist() if n.endswith('.gpkg')][0]; tmpg = os.path.join(dl_dir, 'cmp.gpkg'); open(tmpg, 'wb').write(z.read(gp))
            con = sqlite3.connect(tmpg); tabs = [r[0] for r in con.execute("select table_name from gpkg_contents where data_type='features'")]; nb = con.execute('select count(*), count(distinct area_no) from buildings').fetchone(); con.close()
            check('comparison GeoPackage opens in SQLite: feature tables, buildings tagged with area_no 1–4', 'buildings' in tabs and nb[0] > 100 and nb[1] == 4, (len(tabs), nb))

            # ---------- phones and tablets, three languages ----------
            sizes = [(390, 844, 'phone'), (844, 390, 'phone-landscape'), (820, 1180, 'ipad'), (1180, 820, 'ipad-landscape')]
            for (w, h, nm) in sizes:
                pg.set_viewport_size({'width': w, 'height': h}); time.sleep(0.8)
                for lang in ['ar', 'he', 'en']:
                    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4)
                    for view in ['comparison', 'map', 'analysis-page']:
                        if view == 'comparison': pg.evaluate('GA.app.openWorkspace("compare")'); time.sleep(1.5)
                        elif view == 'map': pg.evaluate('document.querySelector("#ws-close") && document.querySelector("#ws-close").click(); GA.pages.close()'); time.sleep(0.6)
                        else: pg.evaluate(f'GA.pages.go("fabric", "{a1}")'); wait(pg, 'document.querySelectorAll(".ap-sec").length === 8', 60000); time.sleep(1)
                        o = pg.evaluate(OVER); n2 = pg.evaluate(NAVOV); P = pg.evaluate(PANELS)
                        check(f'{nm} {lang} {view}: no horizontal overflow, no overlapping buttons, never two side panels on narrow screens', not o and not n2 and not (w < 1000 and P['l'] and P['r']), (o, n2, P))
                    pg.evaluate('GA.pages.close()'); time.sleep(0.3)
                if nm == 'phone':
                    pg.evaluate('GA.i18n.setLang("ar")'); time.sleep(0.3)
                    pg.click('#phone-bar [data-pv=analysis]'); time.sleep(0.5); P1 = pg.evaluate(PANELS)
                    pg.click('#phone-bar [data-pv=study]'); time.sleep(0.5); P2 = pg.evaluate(PANELS)
                    pg.click('#phone-bar [data-pv=map]'); time.sleep(0.5); P3 = pg.evaluate(PANELS)
                    check('phone: bottom bar switches full-screen views (analysis / study / map)', P1 == {'l': True, 'r': False} and P2 == {'l': False, 'r': True} and P3 == {'l': False, 'r': False}, (P1, P2, P3))
                    pg.click('#tb-menu'); time.sleep(0.3); menu = pg.evaluate('getComputedStyle(document.querySelector("#tb-nav")).display'); check('phone: compact Menu opens the navigation', menu == 'flex', menu)
                    pg.click('#tb-compare'); time.sleep(1.5); check('phone: menu item opens Comparison and closes the menu', pg.evaluate('!document.querySelector("#workspace").hidden && !document.body.classList.contains("menu-open")'))
                    w0 = pg.evaluate('[...document.querySelectorAll("#ws-content canvas[data-cmp=fg]")].map(c => c.style.width + "x" + c.style.height)')
                    check('phone: comparison maps stack at one equal size (same scale)', len(w0) == 4 and len(set(w0)) == 1, w0)
                    pg.screenshot(path=os.path.join(OUT, 'v5_phone_comparison_ar.png'))
                    pg.evaluate('document.querySelector("#ws-close").click()'); time.sleep(0.4)
                    pg.click('#phone-bar [data-pv=analysis]'); time.sleep(0.6); pg.screenshot(path=os.path.join(OUT, 'v5_phone_analysis_ar.png'))
                    pg.click('[data-card=heights] .card-map'); time.sleep(1.2); full = pg.evaluate('(() => { const r = document.querySelector(".vw-box").getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 60; })()')
                    check('phone: map viewer is full-screen', full); pg.screenshot(path=os.path.join(OUT, 'v5_phone_viewer_ar.png')); pg.click('.vw-close'); time.sleep(0.3)
                if nm == 'ipad':
                    pg.evaluate('GA.i18n.setLang("he")'); pg.evaluate(f'GA.pages.go("fabric", "{a1}")'); wait(pg, 'document.querySelectorAll(".ap-sec").length === 8', 60000); time.sleep(2)
                    pg.screenshot(path=os.path.join(OUT, 'v5_ipad_analysis_he.png')); pg.evaluate('GA.pages.close()')
            pg.set_viewport_size({'width': 1440, 'height': 900}); time.sleep(0.6)
            for lang in ['ar', 'he', 'en']:
                pg.evaluate(f'GA.i18n.setLang("{lang}")'); pg.evaluate('document.body.classList.remove("left-collapsed", "right-collapsed")'); time.sleep(0.5)
                r = pg.evaluate('() => { const g = (s) => document.querySelector(s).getBoundingClientRect(); return { l: g("#col-left"), r: g("#col-right"), W: innerWidth }; }')
                check(f'desktop {lang}: analysis physically left, study controls physically right', abs(r['l']['left']) < 1 and abs(r['r']['right'] - r['W']) < 1)
            check('saved projects intact after all of this (areas + sections + notes)', pg.evaluate('GA.app.store.get().areas.length') == len(old['areas']) + 4 and pg.evaluate('Object.keys(GA.app.store.get().buildingNotes || {}).length') == 1)
            check('no page errors', not errors, errors[:4])
            b.close()
    finally:
        srv.terminate()
    print(f'\n{len(fails)} failure(s)'); [print(' -', f) for f in fails]

if __name__ == '__main__': main()
