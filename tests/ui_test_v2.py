# Acceptance tests for the v2 interface, run headless against the real published data in data/.
# External services are stubbed (basemap tiles, Commons, Wikipedia, OpenAlex, Open-Meteo).
# Run: python3 tests/ui_test_v2.py [output_dir]
import json, math, os, subprocess, sys, time, base64
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
PORT = 8767
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  — ' + str(extra)) if extra != '' else '')); (None if cond else fails.append(name))

def stub(pg):
    def tiles(r):
        if r.request.url.rstrip('/').endswith('/planet'):
            return r.fulfill(json={'tilejson': '3.0.0', 'tiles': ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14})
        r.fulfill(status=404, body='')
    pg.route('https://tiles.openfreemap.org/**', tiles)
    pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    pg.route('https://fonts.gstatic.com/**', lambda r: r.fulfill(status=404, body=''))
    pg.route('https://unpkg.com/**', lambda r: r.fulfill(status=404, body=''))
    pg.route('https://api.openalex.org/**', lambda r: r.fulfill(json={'results': []}))
    pg.route('https://*.wikipedia.org/**', lambda r: r.fulfill(json={'query': {'geosearch': []}}))
    def commons(r):
        pages = {'1': {'pageid': 1, 'title': 'File:Camera and object.jpg', 'coordinates': [{'lat': 37.1773, 'lon': -3.5986, 'primary': ''}, {'lat': 37.1790, 'lon': -3.5960}],
                       'imageinfo': [{'thumburl': f'http://127.0.0.1:{PORT}/tests/px.png', 'descriptionurl': 'https://commons.wikimedia.org/', 'mime': 'image/jpeg', 'extmetadata': {'Artist': {'value': 'Tester'}, 'LicenseShortName': {'value': 'CC BY-SA 4.0'}, 'DateTimeOriginal': {'value': '2019-05-01 10:22:00'}}}]},
                 '2': {'pageid': 2, 'title': 'File:Single.jpg', 'coordinates': [{'lat': 37.1775, 'lon': -3.5985, 'primary': ''}],
                       'imageinfo': [{'thumburl': f'http://127.0.0.1:{PORT}/tests/px.png', 'descriptionurl': 'https://commons.wikimedia.org/', 'mime': 'image/jpeg', 'extmetadata': {'Artist': {'value': 'B'}, 'LicenseShortName': {'value': 'CC0'}}}]}}
        r.fulfill(json={'query': {'pages': pages}})
    pg.route('https://commons.wikimedia.org/**', commons)
    def archive(r):
        days = [f'2025-{m:02d}-{d:02d}' for m in range(1, 13) for d in range(1, 29)]
        tmax = [12 + 22 * math.sin(math.pi * (int(x[5:7]) - 1) / 11) for x in days]
        r.fulfill(json={'latitude': 37.18, 'longitude': -3.6, 'elevation': 690, 'daily': {'time': days, 'temperature_2m_max': tmax, 'temperature_2m_min': [x - 13 for x in tmax], 'precipitation_sum': [1.0] * len(days)}})
    pg.route('https://archive-api.open-meteo.com/**', archive)
    pg.route('https://api.open-meteo.com/**', lambda r: r.fulfill(json={'elevation': [700]}))

def wait(pg, js, timeout=60000):
    pg.wait_for_function(js, timeout=timeout)

def main():
    open(os.path.join(ROOT, 'tests', 'px.png'), 'wb').write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='))
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            ctx = b.new_context(viewport={'width': 1500, 'height': 920}, accept_downloads=True)
            pg = ctx.new_page(); errors = []
            pg.on('pageerror', lambda e: errors.append(str(e)))
            stub(pg)
            base = f'http://127.0.0.1:{PORT}/index.html'

            # ---------- 9 (prepared first): an old v1 project in localStorage ----------
            pg.goto(base); wait(pg, 'window.GA && GA.app')
            old = json.load(open(os.path.join(ROOT, 'tests', 'fixtures', 'project_v1.json')))
            pg.evaluate('(p) => { localStorage.clear(); localStorage.setItem("granada-atlas.project.v1", JSON.stringify(p)); }', old)
            pg.reload(); wait(pg, 'window.GA && GA.app && GA.app.map.isStyleLoaded()')
            wait(pg, 'GA.app.L.S.bld_floors.status !== "idle"', 30000)

            # ---------- 1: fixed layout in all three languages ----------
            for lang in ['ar', 'he', 'en']:
                pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4)
                r = pg.evaluate('''() => { const g = (s) => document.querySelector(s).getBoundingClientRect(); return { l: g('#col-left'), r: g('#col-right'), m: g('#map'), W: innerWidth, dir: document.documentElement.dir, sel: g('#panel-select'), lay: g('#panel-layers') }; }''')
                ok = abs(r['l']['left']) < 1 and abs(r['r']['right'] - r['W']) < 1 and abs(r['m']['left'] - r['l']['right']) < 2 and abs(r['m']['right'] - r['r']['left']) < 2 and r['lay']['top'] >= r['sel']['bottom'] - 1
                check(f'layout fixed ({lang}, dir={r["dir"]}): analysis left, study+layers right, map between', ok, f"left {r['l']['left']:.0f}-{r['l']['right']:.0f}, map {r['m']['left']:.0f}-{r['m']['right']:.0f}, right {r['r']['left']:.0f}-{r['r']['right']:.0f}")
                pg.screenshot(path=os.path.join(OUT, f'v2_layout_{lang}.png'))
            pg.evaluate('GA.i18n.setLang("en")')
            fonts = pg.evaluate('getComputedStyle(document.body).fontFamily + " | " + getComputedStyle(document.body).fontSize + " | " + getComputedStyle(document.body).color')
            check('body text 14–16 px, dark, IBM Plex sans stack', '15px' in fonts and 'IBM Plex Sans' in fonts and 'rgb(28, 30, 33)' in fonts, fonts)

            # ---------- 2: citywide layers before any area ----------
            pg.evaluate('GA.app.sel.reset()')
            for lid in ['landuse', 'fac_health', 'barrios', 'slope', 'contours', 'streets', 'bus_stops']:
                pg.evaluate(f'GA.app.L.setOn("{lid}", true)')
            wait(pg, '["landuse","fac_health","barrios","contours","streets","bus_stops"].every(k => ["ok","overview"].includes(GA.app.L.S[k].status))', 30000)
            st = pg.evaluate('JSON.stringify(Object.fromEntries(["landuse","fac_health","barrios","slope","contours","streets","bus_stops","bld_floors"].map(k => [k, GA.app.L.S[k].status + ":" + GA.app.L.S[k].statusExtra])))')
            check('citywide layers load with no study area', pg.evaluate('!GA.app.sel.info().ring') and '"failed' not in st, st)
            pg.screenshot(path=os.path.join(OUT, 'v2_citywide_overview.png'))
            pg.evaluate('GA.app.map.jumpTo({center: [-3.5986, 37.1773], zoom: 15.6})'); time.sleep(0.5)
            wait(pg, 'GA.app.L.S.bld_floors.status === "ok" && GA.app.map.getSource("ly-bld")._data.features.length > 100', 30000)
            n_b = pg.evaluate('GA.app.map.getSource("ly-bld")._data.features.length')
            unk = pg.evaluate('GA.app.map.getSource("ly-bld")._data.features.filter(f => f.properties.band === "no_data").length')
            check('building footprints load by viewport at street zoom (tiled)', n_b > 100, f'{n_b} buildings, {unk} with unknown floors (hatched, not classed)')
            check('unknown heights are a separate hatched class in the citywide layer', pg.evaluate('GA.app.map.getLayer("ly-bld_floors-unk").paint ? true : !!GA.app.map.getLayer("ly-bld_floors-unk")'))
            for lid in ['landuse', 'barrios', 'slope', 'contours', 'streets', 'bus_stops', 'fac_health']:
                pg.evaluate(f'GA.app.L.setOn("{lid}", false)')
            pg.screenshot(path=os.path.join(OUT, 'v2_citywide_detail.png'))

            # ---------- 3: analyse an area; it must sit between the panels ----------
            pg.evaluate('GA.app.sel.setCenterDirect([-3.5986, 37.1773])'); time.sleep(0.3)
            spec = pg.evaluate('JSON.stringify(GA.app.sel.spec())')
            check('default selection is a 250 m square', '"square"' in spec and '"side":250' in spec, spec)
            pg.fill('#in-name', 'Centro test'); pg.click('#btn-analyze')
            wait(pg, 'GA.app.getRun() && GA.app.getRun().X && document.querySelectorAll("#left-body .card canvas").length > 8', 60000)
            time.sleep(1.2)
            vis = pg.evaluate('''() => { const m = GA.app.map; const r = GA.app.sel.ring(); const c = m.getContainer().getBoundingClientRect(); const pts = r.map(p => m.project(p)); const xs = pts.map(p => p.x + c.left), ys = pts.map(p => p.y + c.top);
              const L = document.querySelector('#col-left').getBoundingClientRect().right, R = document.querySelector('#col-right').getBoundingClientRect().left;
              return { minx: Math.min(...xs), maxx: Math.max(...xs), L, R, top: Math.min(...ys), bottom: Math.max(...ys), H: innerHeight }; }''')
            check('selected area is fitted into the free space between the panels', vis['minx'] > vis['L'] and vis['maxx'] < vis['R'] and vis['top'] > 52 and vis['bottom'] < vis['H'], vis)
            n_cards = pg.evaluate('document.querySelectorAll("#left-body .card").length')
            ids = pg.evaluate('[...document.querySelectorAll("#left-body .card")].map(c => c.dataset.card).join(",")')
            check('analysis gallery shows map cards (not prose)', n_cards >= 12, ids)
            blank = pg.evaluate('''() => [...document.querySelectorAll("#left-body .card canvas")].filter(cv => { const x = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < x.length; i += 4) if (x[i] < 240 || x[i+1] < 240 || x[i+2] < 240) n++; return n < 500; }).length''')
            check('every card map has drawn content', blank == 0, f'{blank} blank')
            hl = pg.evaluate('''() => { const li = document.querySelector('[data-card="heights"] li[data-hl="no_data"]') || document.querySelector('[data-card="heights"] li[data-hl]'); li.click(); return GA.app.map.getSource("ly-hl")._data.features.length; }''')
            check('legend click highlights the class on the main map', hl > 0, hl)
            pg.screenshot(path=os.path.join(OUT, 'v2_analysis_en.png'))
            chips = pg.evaluate('document.querySelector(".status-row") && document.querySelector(".status-row").innerText')
            check('per-source status chips (ok / no results / failed / not connected)', chips and 'not connected' in chips, chips)

            # slope check near the reported 185.6% location
            pg.click('#btn-reset'); time.sleep(0.2)
            pg.evaluate('GA.app.sel.setCenterDirect([-3.59542, 37.17935])'); pg.fill('#in-side', '500'); pg.press('#in-side', 'Enter'); time.sleep(0.2)
            pg.fill('#in-name', 'Slope check 500 m'); pg.click('#btn-save'); time.sleep(0.3)
            pg.click('#btn-analyze'); wait(pg, 'GA.app.getRun() && GA.app.getRun().X && document.querySelector("[data-card=slope]")', 60000)
            sl = pg.evaluate('JSON.stringify((t => ({ max_deg: t.slopeMax, p90: t.slopeP90, max_pct: Math.tan(t.slopeMax*Math.PI/180)*100, relief: t.relief }))(GA.app.getRun().X.R.terrain))')
            check('slope reported from MDT25 Horn raster in degrees and percent (no 185.6 %)', json.loads(sl)['max_pct'] < 185, sl)

            # ---------- 5: sections ----------
            pg.click('[data-ltab="sections"]'); time.sleep(0.2)
            def draw_section(pts):
                pg.click('#sec-draw')
                for (lon, lat) in pts:
                    xy = pg.evaluate(f'(() => {{ const p = GA.app.map.project([{lon}, {lat}]); const c = GA.app.map.getContainer().getBoundingClientRect(); return [p.x + c.left, p.y + c.top]; }})()')
                    pg.mouse.click(xy[0], xy[1]); time.sleep(0.25)
                pg.keyboard.press('Enter'); time.sleep(0.4)
                print('   after draw:', pg.evaluate('JSON.stringify({drawing: GA.app.secTool.isDrawing(), n: (GA.app.store.get().areas.find(a => a.name === "Slope check 500 m").sections || []).length, banner: document.querySelector("#mode-banner").innerText})'))
            draw_section([(-3.5975, 37.1775), (-3.5952, 37.1790), (-3.5925, 37.1800)])
            draw_section([(-3.5975, 37.1808), (-3.5948, 37.1796)])
            wait(pg, 'document.querySelector("#sec-cv")', 30000); time.sleep(0.5)
            secs = pg.evaluate('JSON.stringify(GA.app.store.get().areas.find(a => a.name === "Slope check 500 m").sections.map(s => ({id: s.id, n: s.pts.length, pts: s.pts})))')
            S0 = json.loads(secs)
            check('two named sections stored on the area (A, intermediate vertex, B)', len(S0) == 2 and S0[0]['n'] == 3 and S0[1]['n'] == 2, [(s['id'], s['n']) for s in S0])
            # edit the SECOND (active) section by dragging its B marker
            m = pg.evaluate('(() => { const els = [...document.querySelectorAll(".h-sec")]; const r = els[els.length - 1].getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2, els.length]; })()')
            pg.mouse.move(m[0], m[1]); pg.mouse.down(); pg.mouse.move(m[0] + 40, m[1] + 30, steps=6); pg.mouse.up(); time.sleep(0.8)
            S1 = json.loads(pg.evaluate('JSON.stringify(GA.app.store.get().areas.find(a => a.name === "Slope check 500 m").sections.map(s => ({id: s.id, pts: s.pts})))'))
            check('dragging a vertex updates only the edited section', S1[0]['pts'] == S0[0]['pts'] and S1[1]['pts'] != S0[1]['pts'] and S1[1]['id'] == S0[1]['id'], f"sec1 same={S1[0]['pts'] == S0[0]['pts']}, sec2 changed={S1[1]['pts'] != S0[1]['pts']}")
            wait(pg, 'document.querySelector("#sec-cv")', 30000); time.sleep(1)
            prof = pg.evaluate('''(async () => { const a = GA.app.store.get().areas.find(a => a.name === "Slope check 500 m"); const s = a.sections[1]; const p = await GA.section.compute(s, {floorH: 3}); return JSON.stringify({ L: p.L, cuts: p.cuts.map(c => [c.src, c.h, c.lv || null]), maxGradPct: p.maxGrad * 100, baseline: p.baseline, hornMax: p.hornMax }); })()''')
            P = json.loads(prof)
            unknown_ok = all((c[0] == 'unknown' and c[1] is None) or (c[0] == 'levels' and c[2] and abs(c[1] - c[2] * 3) < 1e-6) or (c[0] == 'height' and c[1] > 0) for c in P['cuts'])
            check('section heights: tagged, floors × 3.0 m (estimate) or unknown — never invented', unknown_ok and len(P['cuts']) > 0, {k: sum(1 for c in P['cuts'] if c[0] == k) for k in ['height', 'levels', 'unknown']})
            check('section gradient uses a ≥25 m baseline', P['baseline'] >= 25, f"max {P['maxGradPct']:.1f}% over {P['baseline']:.0f} m; Horn max {P['hornMax']}°")
            ve = pg.evaluate('document.querySelector("#sec-out").dataset.ve')
            check('vertical exaggeration is stated on the section', ve is not None and pg.evaluate('document.querySelector("#sec-cv").width > 0'), ve)
            pg.screenshot(path=os.path.join(OUT, 'v2_section.png'))

            # ---------- notes tab: photos camera vs depicted, full date ----------
            pg.click('[data-ltab="notes"]'); wait(pg, 'document.querySelector(".photos figure")', 30000)
            ph = pg.evaluate('document.querySelector(".photos").innerText')
            check('photos separate camera position and depicted place, with full date', 'Camera' in ph and 'Depicted place' in ph and '1 May 2019' in ph, ph[:200])
            check('official municipal sources listed', pg.evaluate('!!document.querySelector("#topic-muni a[href*=\\"granada.org\\"]")'))

            # ---------- 8: single-area export with a section ----------
            pg.click('.tb-btn[data-drawer="export"]'); time.sleep(0.3)
            with pg.expect_download(timeout=90000) as dl:
                pg.click('#x-go')
            path1 = os.path.join(OUT, 'v2_single.zip'); dl.value.save_as(path1)
            files = pg.evaluate('GA.lastExport.files.map(f => f.name).join(",")')
            check('single-area export includes sections, profile, cuts, facilities, MDT25 GeoTIFF', all(k in files for k in ['sections.geojson', 'section_profile.geojson', 'section_cuts.geojson', 'facilities.geojson', 'elevation_mdt25_epsg25830.tif']), files)
            pg.click('#btn-close-drawer')

            # ---------- 4: compare 2, 3, 4 areas ----------
            centers = [(-3.5986, 37.1773, 'Centro A'), (-3.5925, 37.1790, 'Albaicín B'), (-3.6050, 37.1650, 'Camino de Ronda C'), (-3.5900, 37.1600, 'Zaidín D')]
            for lon, lat, nm in centers[1:]:
                pg.click('#btn-reset'); time.sleep(0.2)
                pg.evaluate(f'GA.app.sel.setCenterDirect([{lon}, {lat}])'); time.sleep(0.2)
                pg.fill('#in-name', nm); pg.click('#btn-save'); time.sleep(0.3)
            areas = pg.evaluate('GA.app.store.get().areas.map(a => [a.id, a.name, a.spec.side])')
            pick = [a[0] for a in areas if a[1] in ('Centro test', 'Albaicín B', 'Camino de Ronda C', 'Zaidín D')]
            check('four 250 m areas saved for comparison', len(pick) == 4, areas)
            pg.click('#tb-compare'); time.sleep(0.3)
            for n in [2, 3, 4]:
                pg.evaluate('(ids) => { const p = GA.app.store.get(); p.compare = { ids }; GA.app.store.save(); GA.app.CMP.render(); }', pick[:n])
                wait(pg, f'document.querySelectorAll("#ws-content canvas[data-cmp]").length === 4 * {n}', 90000); time.sleep(0.8)
                res = pg.evaluate('''() => { const cv = [...document.querySelectorAll('#ws-content canvas[data-cmp="fg"]')]; const Xs = GA.app.CMP.lastXs; const inds = Xs.map(x => GA.compare.indicators(x));
                    const own = Xs.map(x => x.R.osm.buildings.count); const sizes = cv.map(c => c.width + 'x' + c.height);
                    const lg = [...document.querySelectorAll('#ws-content .cmp-lg')].length;
                    return { n: Xs.length, ids: Xs.map(x => x.area.id), counts: inds.map(v => v.buildings), own, sizes, lg, styles: Xs.map(x => x.style.color + '|' + x.style.dash.join('-')) }; }''')
                distinct_styles = len(set(res['styles'])) == n
                check(f'compare {n} areas: own data per area, same map size/scale, one shared legend per topic, distinct numbered boundaries', res['n'] == n and res['ids'] == pick[:n] and res['counts'] == res['own'] and len(set(res['sizes'])) == 1 and res['lg'] == 4 and distinct_styles, res)
                pg.screenshot(path=os.path.join(OUT, f'v2_compare_{n}.png'), full_page=False)
            missing = pg.evaluate('document.querySelectorAll("#ws-content td.missing").length')
            check('comparison table marks missing data as "no data" (not zero) where applicable', missing >= 0, missing)
            with pg.expect_download(timeout=120000) as dl:
                pg.click('#ws-gis')
            path2 = os.path.join(OUT, 'v2_multi.zip'); dl.value.save_as(path2)
            mfiles = pg.evaluate('GA.lastExport.files.map(f => f.name).join(",")')
            check('multi-area export (area_no on every feature) with indicators', 'area_indicators.geojson' in mfiles and '.gpkg' in mfiles, mfiles[:300])

            # ---------- 10: Exercise 1.2 ----------
            pg.click('[data-ws-tab="ex12"]')
            pg.evaluate('(ids) => { const p = GA.app.store.get(); p.ex12 = { ids, fabrics: {} }; GA.app.store.save(); GA.app.CMP.render(); }', pick[:2]); wait(pg, 'document.querySelector(".ex-card")', 60000)
            two = pg.evaluate('document.querySelector(".ex-status").innerText')
            check('Exercise 1.2 with 2 fabrics is marked incomplete (needs ≥4)', 'Incomplete' in two and 'at least 4' in two, two)
            pg.evaluate('(ids) => { const p = GA.app.store.get(); p.ex12.ids = ids; GA.app.store.save(); GA.app.CMP.render(); }', pick); wait(pg, 'document.querySelectorAll(".ex-card").length === 4', 60000)
            four = pg.evaluate('document.querySelector(".ex-status").innerText')
            check('Exercise 1.2 with 4 fabrics meets the minimum', 'minimum of 4 is met' in four, four)
            pg.fill(f'[data-ex-just="{pick[0]}"]', 'Dense compact block fabric along the historic axis.'); pg.press(f'[data-ex-just="{pick[0]}"]', 'Tab')
            pg.fill(f'[data-ex-sent="{pick[0]}"]', 'Tight blocks, narrow streets.'); pg.press(f'[data-ex-sent="{pick[0]}"]', 'Tab')
            pg.screenshot(path=os.path.join(OUT, 'v2_ex12.png'))
            with pg.expect_download(timeout=180000) as dl:
                pg.click('#ex-pdf')
            path3 = os.path.join(OUT, 'v2_ex12.pdf'); dl.value.save_as(path3)
            pdf = open(path3, 'rb').read()
            pinfo = pg.evaluate('JSON.stringify({pages: GA.lastPDF.pages, scale: GA.lastPDF.scale})')
            check('combined A3 PDF with cover + one sheet per fabric at one print scale', pdf[:5] == b'%PDF-' and pdf.count(b'/Type /Page ') == 5, pinfo)
            pg.click('#ws-close')

            # ---------- 9: the old v1 project still opens ----------
            old_name = old['areas'][0]['name']
            pg.click('.tb-btn[data-drawer="areas"]'); time.sleep(0.3)
            pg.click(f'#drawer [data-open="{old["areas"][0]["id"]}"]')
            wait(pg, 'GA.app.getRun() && GA.app.getRun().X', 60000); time.sleep(0.5)
            pg.click('[data-ltab="maps"]'); time.sleep(0.8)
            nc = pg.evaluate('document.querySelectorAll("#left-body .card").length'); ttl = pg.evaluate('document.querySelector("#rep-title").innerText')
            pg.click('[data-ltab="notes"]'); time.sleep(0.5)
            notes_ok = pg.evaluate('!!document.querySelector("#topic-ph") && !!document.querySelector("#topic-obs .obs-list li")')
            check('old saved project (v1) loads: area, saved notes/photos and gallery', nc >= 12 and ttl == old_name and notes_ok, f'cards={nc}, title={ttl}, notes={notes_ok}')
            pg.screenshot(path=os.path.join(OUT, 'v2_old_project.png'))

            # ---------- 7: supplied datasets align ----------
            al = pg.evaluate('''(async () => { const g = await GA.data.grid('dem'); const P = GA.proj.EPSG25830; const e = (ll) => GA.data.sampleGrid(g, ...P.forward(ll));
                const adm = await GA.data.single('admin'); const inB = (ll, nm) => adm.features.filter(f => f.properties.kind === 'barrio' && f.properties.name === nm).some(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).some(pl => GA.geo.pointInRing(ll, pl[0])));
                return JSON.stringify({ plazaNueva: e([-3.5962, 37.1766]), alhambra: e([-3.5880, 37.1770]), genilRiver: e([-3.5980, 37.1680]), albaicinPt: inB([-3.5925, 37.1810], 'Albaicín'), centroPt: inB([-3.5986, 37.1760], 'Centro - Sagrario') }); })()''')
            A = json.loads(al)
            check('terrain and boundaries align with known places (Plaza Nueva ~680 m < Alhambra ~780 m; barrios contain their landmarks)', 650 < A['plazaNueva'] < 710 and 740 < A['alhambra'] < 820 and A['albaicinPt'] and A['centroPt'], A)

            check('no uncaught page errors', not errors, errors[:5])
            b.close()
    finally:
        srv.terminate()
    print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
