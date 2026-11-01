"""v10 — build 5.9: colour hierarchy (map paint = legend = palette), separate boundary layers, construction-period
coverage, water and runoff (flow paths, drains, culverts), infrastructure, seasonal wind and rainfall (Open-Meteo stubbed
with synthetic series — real values are only fetched by visitors), historical landmark geometries, print layout (paper
size, true scale, PDF/PNG), desktop / iPad / phone. Usage: python3 tests/ui_test_v10.py"""
import sys, os, time, json, subprocess, random, datetime, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8810; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v10shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(msg)

def open_meteo(route):
    u = route.request.url; random.seed(7)
    if 'hourly' in u:
        t, s, d = [], [], []; x = datetime.datetime(2015, 1, 1)
        while x.year < 2017:
            t.append(x.strftime('%Y-%m-%dT%H:%M')); m = x.month
            s.append(round(abs(random.gauss(3 if m in (6, 7, 8) else 2, 1.5)), 1)); d.append(round((270 if m in (12, 1, 2) else 90) + random.gauss(0, 30)) % 360); x += datetime.timedelta(hours=1)
        return route.fulfill(json={'latitude': 37.25, 'longitude': -3.5, 'hourly': {'time': t, 'wind_speed_10m': s, 'wind_direction_10m': d}})
    t, p = [], []; x = datetime.date(1991, 1, 1)
    while x.year < 1993: t.append(x.isoformat()); p.append(round(max(0, random.gauss(2 if x.month in (11, 12, 1, 2, 3) else 0.2, 3)), 1)); x += datetime.timedelta(days=1)
    route.fulfill(json={'latitude': 37.25, 'longitude': -3.5, 'daily': {'time': t, 'precipitation_sum': p}})

LL = {'Alhambra': [-3.5881, 37.1761], 'Albaicín': [-3.5925, 37.1810], 'Sacromonte': [-3.5850, 37.1815], 'Catedral_de_Granada': [-3.5992, 37.1763], 'Plaza_de_Bib-Rambla': [-3.5996, 37.1749], 'Plaza_Nueva_(Granada)': [-3.5960, 37.1765], 'Gran_Vía_de_Colón': [-3.5990, 37.1780], 'Realejo-San_Matías': [-3.5935, 37.1725], 'Cartuja_de_Granada': [-3.5995, 37.1940], 'Almanjáyar': [-3.6080, 37.1990], 'Generalife': [-3.5845, 37.1772]}
def wiki(route):
    u = urllib.parse.unquote(route.request.url); ks = [k for k in LL if u.endswith('/' + k)]; k = ks[0] if ks else None
    th = {'thumbnail': {'source': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Catedral_test.jpg/320px-Catedral_test.jpg'}} if k == 'Catedral_de_Granada' else {}
    route.fulfill(json={**th, 'title': (k or 'Test').replace('_', ' '), 'extract': 'Test extract.', 'content_urls': {'desktop': {'page': 'https://es.wikipedia.org/wiki/' + (k or 'Test')}}, 'coordinates': {'lat': LL[k][1], 'lon': LL[k][0]} if k else None, 'timestamp': '2026-01-01T00:00:00Z'})

def boot(b, vp, lang='en', mobile=False):
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, accept_downloads=True); pg = ctx.new_page(); V3.stub3(pg)
    pg.route('https://archive-api.open-meteo.com/**', open_meteo); pg.route('https://es.wikipedia.org/api/rest_v1/page/summary/**', wiki); errs = []
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(m.text[:300])); pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=90000)
    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4); return ctx, pg, errs

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx, pg, errs = boot(b, {'width': 1440, 'height': 900}, 'en')
        P = pg.evaluate('JSON.parse(JSON.stringify(GA.palette))')
        on = lambda *ks: [pg.evaluate(f'GA.app.L.setOn("{k}", true)') for k in ks]
        off = lambda *ks: [pg.evaluate(f'GA.app.L.setOn("{k}", false)') for k in ks]
        paint = lambda l, prop: json.dumps(pg.evaluate(f'GA.app.map.getPaintProperty("{l}", "{prop}")'))
        leg = lambda: pg.evaluate('document.querySelector("#legend").innerHTML')
        # ---------- 1. colour hierarchy ----------
        check(P['band']['9+'] == P['base']['oxblood'] and P['bus']['High'] == P['base']['oxblood'], 'red ramps end in oxblood (no brown/black at the dark end)')
        on('bus_stops'); time.sleep(1.5); check(P['red'] in paint('ly-bus', 'circle-color'), 'public-transport stops are red', paint('ly-bus', 'circle-color'))
        on('bus_service'); time.sleep(2); bp = paint('ly-bussvc', 'circle-color'); check(all(P['bus'][k] in bp for k in ['High', 'Medium-high', 'Medium-low', 'Low']) and P['base']['brown'] not in bp, 'bus frequency uses the light→dark red ramp, no brown')
        on('trees'); time.sleep(2); check(paint('ly-trees', 'circle-stroke-color') == json.dumps(P['red']) and paint('ly-trees', 'circle-color') == '"#FFFFFF"', 'mapped trees: red ring (distinct from filled red points)')
        check(P['red'] in leg() or '153, 43, 42' in leg(), 'tree legend shows the red ring')
        noise = P['noise']; check(len(set(noise)) == 6 and noise[4] == P['red'] and noise[5] == P['base']['oxblood'], 'noise scale pale → dark red, six ordered classes')
        lu = list(P['landuse'].values()); check(len(set(lu)) == len(lu), f'land-use categories all distinct ({len(lu)} colours)')
        on('landuse'); time.sleep(2); lp = paint('ly-landuse', 'fill-color'); check(all(c in lp for c in lu), 'land-use paint uses the palette categories'); lg = leg(); check(sum(1 for c in lu if c in lg or ','.join(str(int(c[i:i + 2], 16)) for i in (1, 3, 5)) in lg.replace(' ', '')) >= len(lu) - 1, 'land-use legend shows the same colours')
        off('bus_stops', 'bus_service', 'trees', 'landuse')
        # ---------- 6. boundaries ----------
        ids = pg.evaluate('Object.keys(GA.app.L.byId)'); check(all(k in ids for k in ['municipality', 'neighbourhoods', 'boundaries']), 'independent municipality / neighbourhood / district layers')
        on('municipality', 'neighbourhoods', 'barrios'); time.sleep(2)
        mf = pg.evaluate('GA.app.map.getSource("ly-municipality")._data.features.map(f => f.properties.kind)'); check(mf == ['municipio'], f'municipality layer = the municipio outer boundary only {mf}')
        nf_ = pg.evaluate('new Set(GA.app.map.getSource("ly-neighbourhoods")._data.features.map(f => f.properties.kind)).size === 1 && GA.app.map.getSource("ly-neighbourhoods")._data.features.length'); check(nf_ == 32, f'neighbourhood layer = 32 barrios {nf_}')
        check(paint('ly-neighbourhoods', 'line-color') == json.dumps(P['red']) and paint('ly-barrios-ln', 'line-color') == json.dumps(P['red']), 'neighbourhood lines red, also over the choropleth')
        check(all(c in paint('ly-barrios', 'fill-color') for c in P['choro'][1:]), 'neighbourhood choropleth uses the red ramp')
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.60, 37.18], zoom: 12.5 })'); time.sleep(3); pg.screenshot(path=f'{OUT}/boundaries.png')
        off('municipality', 'neighbourhoods', 'barrios')
        # ---------- construction period ----------
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5960, 37.1765], zoom: 13.5 })'); on('bld_period'); pg.wait_for_function('GA.app.L.S.bld_period.status !== "loading"', timeout=60000); time.sleep(4)
        lg = leg(); check('hatch' in lg and 'start_date' in lg and 'Catastro' in lg, 'unknown construction period hatched, coverage and better source stated')
        check(bool(__import__('re').search(r'Only [\d,]+ of 101,674 buildings', lg)), 'legend states how many buildings carry a date', lg[:200])
        off('bld_period')
        # ---------- 4. water and runoff ----------
        on('flow_paths'); pg.wait_for_function('GA.app.L.S.flow_paths.status === "ok"', timeout=30000); n = pg.evaluate('GA.app.L.S.flow_paths.statusExtra'); check(n > 1000, f'terrain-derived flow paths loaded ({n} lines)')
        lg = leg(); check('Approximation' in lg and 'kerbs' in lg and 'flood' in lg, 'flow paths labelled as an approximation, 25 m limits and separation from the flood layer stated')
        mz = pg.evaluate('["c0","c1","c2","c3"].map(c => GA.app.map.getLayer("ly-flow-" + c).minzoom)'); check(mz[0] > mz[1] > mz[2], f'smaller upslope classes appear only when zoomed in {mz}')
        on('drains', 'culverts'); time.sleep(2); check('not the municipal stormwater' in leg(), 'drains layer says it is not the municipal stormwater/sewer network')
        cf = pg.evaluate('JSON.stringify(GA.app.map.getFilter("ly-culvert"))'); check('tunnel' in cf and 'covered' in leg() or 'Covered' in leg(), 'culverted watercourses: OSM tunnel segments, dashed, documented source', cf)
        off('flow_paths', 'drains', 'culverts')
        # ---------- 2. infrastructure ----------
        on('rail', 'stations', 'utilities'); time.sleep(2)
        check(pg.evaluate('!!GA.app.map.getLayer("ly-rail") && !!GA.app.map.getLayer("ly-metro") && !!GA.app.map.getLayer("ly-metro-tun")'), 'railway and metro (surface / tunnel) are separate layers')
        check(paint('ly-metro', 'line-color') == json.dumps(P['red']), 'metro in red, conventional rail in ink')
        lg = leg(); check('disused or proposed' in lg and 'Not connected' in lg and 'does not mean there is no infrastructure' in lg, 'disused/proposed limitation and utility gap stated honestly')
        off('rail', 'stations', 'utilities')
        # ---------- 3. wind ----------
        on('wind'); pg.wait_for_function('GA.app.L.S.wind.status === "ok"', timeout=30000); time.sleep(1)
        lg = leg(); check('Winter' in lg and 'from): W' in lg and 'not a forecast' in lg and '25 km' in lg and 'street-level' in lg, 'winter wind rose: prevailing direction, climatology statement, resolution, not street-level', lg[:300])
        check(pg.evaluate('GA.app.map.hasImage("ga-wind-rose") && !!GA.app.map.getSource("ly-wind-cell")._data.features.length'), 'rose drawn on the map, model grid cell outlined')
        pg.select_option('#panel-layers select[data-ly-ctl=wind]', 'jja'); time.sleep(1.2); lg = leg(); check('Summer' in lg and 'from): E' in lg, 'season selector switches to summer statistics')
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5986, 37.1773], zoom: 11.5 })'); time.sleep(2); pg.screenshot(path=f'{OUT}/wind_summer.png')
        off('wind'); on('rain'); pg.wait_for_function('GA.app.L.S.rain.status === "ok"', timeout=30000); time.sleep(1)
        lg = leg(); check('<svg' in lg and 'mm' in lg and 'not station measurements' in lg and '1991' in lg, 'rainfall: monthly chart, seasonal total, period and reanalysis caveat')
        st = pg.evaluate('GA.climate.windStats({ time: ["2020-01-01T00:00", "2020-01-01T01:00", "2020-01-01T02:00", "2020-07-01T00:00"], wind_speed_10m: [3, 4, 0.2, 5], wind_direction_10m: [270, 268, 10, 90] })')
        check(st['djf']['prevailing'] == 'W' and abs(st['djf']['calmPct'] - 100 / 3) < 0.01 and st['jja']['prevailing'] == 'E', 'wind statistics: sectors, calm share and seasons computed correctly')
        rs = pg.evaluate('GA.climate.rainStats({ time: ["2001-01-01", "2001-01-02", "2002-01-05", "2001-07-01"], precipitation_sum: [10, 2, 4, 0] })')
        check(abs(rs['month'][0]['mm'] - 8) < 1e-9 and rs['years'] == 2, 'rainfall statistics: monthly mean over years', rs['month'][0])
        off('rain')
        # ---------- 5. historical landmarks ----------
        pg.evaluate('GA.pages.go("history")')
        pg.wait_for_function('document.querySelectorAll("#hx-places .hx-place").length >= 10', timeout=120000); time.sleep(20)
        txt = pg.evaluate('document.querySelector("#page").innerText'); check('present-day' in txt and 'position only' in txt, 'historical view legend: present-day shapes, points only where no boundary')
        figs = pg.evaluate('[...document.querySelectorAll("#hx-places .hx-fig")].map(f => [f.dataset.file, f.innerText])'); noimg = pg.evaluate('document.querySelectorAll("#hx-places .hx-noimg").length')
        check(len(figs) == 1 and figs[0][0] == 'Catedral_test.jpg' and 'Wikimedia Commons' in figs[0][1], f'image under the paragraph: the article\'s own Commons lead image with attribution {figs}')
        check(noimg >= 10, f'places without an image say so instead of showing a filler ({noimg})')
        pg.evaluate('document.querySelector("[data-hx-fly=\'3\']").click()'); time.sleep(5); pg.screenshot(path=f'{OUT}/history_cathedral.png')
        pg.evaluate('GA.pages.close()'); time.sleep(0.5)
        # ---------- 8. print layout: arrange map, legend, section and image on one page ----------
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5960, 37.1765], zoom: 15 })'); on('neighbourhoods'); time.sleep(2)
        pg.evaluate('''() => { const p = GA.app.store.get(); p.sections = [{ id: GA.app.store.uid('sec'), name: 'Print section', pts: [[-3.5930, 37.1752], [-3.5930, 37.1738]], floorH: 3, created: new Date().toISOString() }]; GA.app.store.save(); }''')
        pg.evaluate('GA.pages.go("print")'); time.sleep(1); pg.fill('[data-pl=title]', 'Print test')
        opts = pg.evaluate('[...document.querySelectorAll("select[data-slot=\'2\'] option")].map(o => o.value)'); check(any(o.startswith('section:') for o in opts) and 'legend' in opts and 'map' in opts, 'slot choices: map, legend, saved sections', opts)
        sec = [o for o in opts if o.startswith('section:')][0]; pg.select_option('select[data-slot="2"][data-sk=item]', sec); time.sleep(0.5)
        pg.set_input_files('[data-pl=image]', os.path.join(ROOT, 'tests', 'px.png')); time.sleep(1)
        check(pg.evaluate('GA.printLayout.st.slots[3].type') == 'image', 'an added image goes into the next free slot')
        pg.fill('[data-img="0"][data-ik=source]', 'Test photo, CC BY 4.0'); pg.press('[data-img="0"][data-ik=source]', 'Tab')
        pg.fill('[data-slot="0"][data-sk=caption]', 'Centro at 1:5,000'); pg.press('[data-slot="0"][data-sk=caption]', 'Tab')
        pg.click('[data-mv="2:1"]'); time.sleep(0.3); order = pg.evaluate('GA.printLayout.st.slots.slice(0, 4).map(s => s.type)'); check(order == ['map', 'legend', 'image', 'section'], f'slots can be reordered {order}')
        pg.click('[data-pl-act=preview]'); pg.wait_for_function('document.querySelector("#pl-sheet canvas")', timeout=180000); time.sleep(1); pg.screenshot(path=f'{OUT}/print_arranged_preview.png')
        check('1:5,0' in pg.evaluate('document.querySelector("#pl-msg").innerText'), 'preview reports the measured scale')
        pg.select_option('[data-pl=dpi]', '150')
        with pg.expect_download(timeout=300000) as dl: pg.click('[data-pl-act=pdf]')
        pdf = os.path.join(OUT, 'print_A3L.pdf'); dl.value.save_as(pdf); info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
        check('1190.55 x 841.89' in info, 'PDF page is A3 landscape (420 × 297 mm) with map, legend, image and section', info)
        subprocess.run(['pdftoppm', '-r', '40', '-png', pdf, os.path.join(OUT, 'print_A3L')])
        lp = pg.evaluate('GA.lastPrint.maps'); check(len(lp) == 1 and abs(lp[0]['measured'] - 5000) / 5000 < 0.005, f'map scale correct at 100 %: measured 1:{round(lp[0]["measured"])} for 1:5,000')
        # two maps at different scales on a 2 × 2 grid, A2 landscape and A4 portrait
        pg.select_option('[data-pl=template]', 'grid'); time.sleep(0.4)
        pg.select_option('select[data-slot="1"][data-sk=item]', 'map'); time.sleep(0.4); pg.select_option('select[data-slot="1"][data-sk=denom]', '10000')
        for paper, orient in [('A2', 'landscape'), ('A4', 'portrait')]:
            pg.select_option('[data-pl=paper]', paper); pg.select_option('[data-pl=orient]', orient)
            with pg.expect_download(timeout=300000) as dl: pg.click('[data-pl-act=png]')
            png = os.path.join(OUT, f'print_{paper}.png'); dl.value.save_as(png); im = Image.open(png)
            mm = {'A4': (210, 297), 'A2': (594, 420)}[paper]; exp = (round(mm[0] / 25.4 * 150), round(mm[1] / 25.4 * 150))
            check(abs(im.size[0] - exp[0]) <= 1 and abs(im.size[1] - exp[1]) <= 1, f'{paper} {orient}: PNG {im.size} = paper size at 150 dpi {exp}')
            lp = pg.evaluate('GA.lastPrint.maps.map(m => [m.denom, Math.round(m.measured)])'); check(len(lp) == 2 and all(abs(b - a) / a < 0.005 for a, b in lp), f'{paper}: two maps, each at its own scale {lp}')
        pg.evaluate('GA.pages.close()')
        check(not errs, 'desktop: no page errors', errs[:3])
        ctx.close()
        # ---------- languages, iPad, phone ----------
        for tag, vp, mob, lang in [('ipad_he', {'width': 820, 'height': 1180}, True, 'he'), ('phone_ar', {'width': 390, 'height': 844}, True, 'ar')]:
            ctx, pg, errs2 = boot(b, vp, lang, mob)
            pg.evaluate('GA.panels.set("layers", true)'); time.sleep(0.6)
            grp = pg.evaluate('[...document.querySelectorAll("#panel-layers .lyr-group")].map(e => e.innerText.trim())')
            check(len([g for g in grp if g]) >= 12 and not any(g.startswith('ly.') for g in grp), f'{tag}: layer groups translated, incl. infrastructure, water, climate', grp)
            pg.evaluate('GA.panels.set("layers", false); GA.pages.go("print")'); time.sleep(1)
            ov = pg.evaluate('[...document.querySelectorAll(".pl *")].some(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); })')
            check(not ov, f'{tag}: print page fits the screen'); pg.screenshot(path=f'{OUT}/{tag}_print.png')
            check(not errs2, f'{tag}: no page errors', errs2[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
