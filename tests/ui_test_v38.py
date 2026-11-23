"""v38 — build 5.50: the analysis cards that were empty for the owner's "Base" area (report "analysis_Base_1.pdf",
23 Nov 2026: places 0, scheduled buses 0, construction periods 0 of 14,076, trees 0, canopy "Failed to fetch", noise blank).
Checks on a saved 4.5 km square around the air base (the owner's area), with the Copernicus canopy service DOWN (as on
23 Nov 2026): places > 0 (Overture beyond the municipality); scheduled buses: stops and served stops > 0 with the
consortium named; construction periods: most buildings have a year, the Catastro is named as the source; mapped trees > 0;
the canopy falls back to ESA WorldCover and says so (a class, not a density); the noise card asks for the agglomeration,
road and railway maps; hotels unchanged (1 hostel, as in OSM); the key indicators show numbers, not "0".
A synthetic area outside the places / bus data coverage shows "outside the data", never 0. No page errors.
Usage: python3 tests/ui_test_v38.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, re
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
import _nointro
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8838; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v38shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{str(extra)[:400]}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1600, 'height': 900}); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []; noise_urls = []
        pg.route('https://image.discomap.eea.europa.eu/**', lambda r: r.abort())  # the canopy service is down (23 Nov 2026)
        pg.on('request', lambda r: 'evaluacionambiental' in r.url and noise_urls.append(r.url))
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append(str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=120000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.50' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.panels.set("study", true)')
        pg.evaluate('GA.app.sel.setCenterDirect([-3.6437, 37.1300])'); time.sleep(0.3); pg.evaluate('GA.app.sel.setSide(4500)'); time.sleep(0.3)
        pg.fill('#in-name', 'Base'); pg.click('#btn-save'); time.sleep(1)
        aid = pg.evaluate('GA.app.store.get().areas.slice(-1)[0].id')
        pg.evaluate(f'GA.pages.go("fabric", "{aid}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=300000)
        pg.wait_for_function('GA.fabric.state && GA.fabric.state.cards.some(c => c.id === "trees" && !c.gapOnly)', timeout=180000); time.sleep(2)
        C = pg.evaluate('''Object.fromEntries(GA.fabric.state.cards.map(c => [c.id, { ind: (c.ind || []).map(r => [String(r[0]).replace(/<[^>]+>/g, ''), String(r[1]).replace(/<[^>]+>/g, '')]), find: (c.find || []).map(s => String(s).replace(/<[^>]+>/g, '')), src: c.src ? c.src.name : '', gap: !!c.gapOnly, method: c.method || '' }]))''')
        num = lambda s: int(re.sub(r'[^0-9]', '', s.split('(')[0].split('*')[0]) or -1)
        pl = C.get('places', {}); n = num(pl['ind'][0][1]) if pl.get('ind') else -1
        check(n > 500, f'places: {n} mapped places in the base square (was 0)', pl.get('ind'))
        bs = C.get('bus', {}); st, sv = (num(bs['ind'][0][1]), num(bs['ind'][1][1])) if bs.get('ind') else (-1, -1)
        check(st > 30 and sv > 20 and 'consortium' in bs.get('src', ''), f'scheduled buses: {st} stops, {sv} with service, consortium named', bs)
        pe = C.get('periods', {}); yr = num(pe['ind'][0][1]) if pe.get('ind') else -1
        check(yr > 5000 and 'Catastro' in pe.get('src', '') and any('Catastro' in r[1] for r in pe['ind']), f'construction periods: {yr} buildings with a year, Catastro named', pe.get('ind'))
        tr = C.get('trees', {}); tm = num(tr['ind'][1][1]) if tr.get('ind') else -1
        check(tm > 100, f'mapped trees: {tm} (was 0)', tr.get('ind'))
        check('WorldCover' in tr.get('src', '') and 'WorldCover' in tr['ind'][0][0] and re.search(r'\d', tr['ind'][0][1]) and any('did not answer' in f for f in tr['find']), 'canopy: WorldCover tree-cover share, named, with the reason', tr)
        check(any('mer_carretera_lden' in u and 'mer_aglomeracion_lden' in u and 'mer_ferrocarril_lden' in u for u in noise_urls), 'noise: the agglomeration, road and railway maps are requested together', noise_urls[:2])
        check(any('main-road and railway' in f for f in C.get('noise', {}).get('find', [])), 'noise: the card says what exists outside the city')
        sy = C.get('stay', {}); check(sy.get('ind') and num(sy['ind'][0][1]) == 1, 'hotels: 1 (one hostel in OSM, unchanged)', sy.get('ind'))
        ki = pg.evaluate('[...document.querySelectorAll(".ap-hero .ap-kv, .ap-key li, .ap-kp li, .ap-hero li")].map(e => e.innerText)')
        pg.screenshot(path=f'{OUT}/base_fabric.png', full_page=False)
        # the key indicators: places per km² and scheduled stops are numbers > 0
        ind = pg.evaluate('GA.fabric.state.ind'); check((ind.get('places_per_km2') or 0) > 10 and (ind.get('bus_sched') or 0) > 10 and ind.get('canopy_mean') is not None, 'key indicators: places/km², stops with service, tree cover are filled', {k: ind.get(k) for k in ('places_per_km2', 'bus_sched', 'canopy_mean')})
        # an area outside the coverage → "outside the data", not 0
        o = pg.evaluate('[GA.galleryExt.coverOf("places", [10, 50, 11, 51]).share, GA.galleryExt.coverOf("bus_service", [10, 50, 11, 51]).share, GA.galleryExt.coverOf("places", [-3.669, 37.11, -3.618, 37.15]).share]')
        check(o[0] == 0 and o[1] == 0 and o[2] == 1, 'coverage: an area outside the data gets 0 (shown as "outside the data"), the base square 1', o)
        lbl = pg.evaluate('GA.i18n.t("v36.outside")'); check(lbl == 'outside the data', 'the "outside the data" label exists in English')
        for lang in ('ar', 'he'): check(pg.evaluate(f'GA.i18n.setLang("{lang}"), GA.i18n.t("v36.wcFind", {{ p: "17 %" }})') != 'v36.wcFind', f'{lang}: new strings present')
        pg.evaluate('GA.i18n.setLang("en")'); time.sleep(1)
        with pg.expect_download(timeout=180000) as d: pg.evaluate(f'GA.fabric.exportPDF("{aid}")')
        path = os.path.join(OUT, 'base_analysis.pdf'); d.value.save_as(path)
        info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout; check('Pages:' in info, 'the analysis PDF exports', info[:120])
        check(not errs, 'no page errors', errs[:3])
finally:
    srv.terminate()
print(('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)), flush=True)
sys.exit(1 if fails else 0)
