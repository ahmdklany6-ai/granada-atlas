"""v39 — build 5.51: what the independent review of 5.50 found, fixed.
1. Metropolitan bus stops: 5.50 took them from the consortium's general stop list, which leaves out most stops of the
   return direction (542 stops; 74 in the owner's "Base" square). They now come from each line's own stop list (827; 119),
   and departures are inferred from the timetable's timing points by whole names and position on the line (no stop-word
   matches), with Friday / Saturday-only trips left out and the five lines whose timetable changed after 26 Oct kept.
2. Construction years: the map layer's legend, popup and source line said "only 39 of 101,674 buildings have a date in
   OSM" although 70,904 more now carry a Catastro year.
3. Tree cover: the MAP layer (and the studio sheets) still depended on the Copernicus service that does not answer; they
   now fall back to the ESA WorldCover class like the analysis card, a hanging request is given up after 15 s, and the
   indicator names the measure it shows.
Checks — data: stop counts against the manifest, one stop re-counted by hand in HANDOFF §46 (Cno. Bajo de Armilla: 97),
the manifest's period coverage, the raster's grey levels. Browser, with the Copernicus host BLOCKED: the period legend and
source; the canopy layer switches to WorldCover and draws; the bus layer's source and popup; the base-square analysis
(bus card, tree-cover indicator label, Arabic). Browser, with the Copernicus host HANGING: the tree card still arrives
(WorldCover) within 45 s. No page errors.
Usage: python3 tests/ui_test_v39.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, re, io
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
import _nointro
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8839; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v39shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{str(extra)[:400]}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
# ---------- data ----------
M = json.load(open(os.path.join(ROOT, 'data/manifest.json'))); BS = M['layers']['bus_service']; CT = BS.get('ctan') or {}
bus = json.load(open(os.path.join(ROOT, 'data/vec/bus_service.json')))['features']; ct = [f for f in bus if f['properties'].get('src') == 'ctan']
check(len(ct) == CT.get('stops') == 827 and len(bus) == BS['features'] == 692 + 827, f'{len(ct)} consortium stops outside the city (manifest agrees; 692 city stops untouched)', (len(ct), CT.get('stops'), len(bus)))
check(sum(1 for f in ct if f['properties']['trips_day'] > 0) == CT.get('served') and sum(1 for f in ct if f['properties'].get('approx')) == CT.get('approx'), 'served and inferred-between-timing-points counts match the manifest')
check(len({f['properties']['stop_id'] for f in bus}) == len(bus), 'no stop id twice')
B = (-3.669, 37.1098, -3.618, 37.1502); inb = [f['properties'] for f in ct if B[0] < f['geometry']['coordinates'][0] < B[2] and B[1] < f['geometry']['coordinates'][1] < B[3]]
check(len(inb) >= 110 and all(p['trips_day'] > 0 for p in inb), f'the base square has {len(inb)} consortium stops, all with departures (5.50 published 74)')
cb = [p for p in ct if p['properties']['stop_name'] == 'Cno. Bajo de Armilla']
check(len(cb) == 1 and cb[0]['properties']['trips_day'] == 97 and not cb[0]['properties'].get('approx'), 'Cno. Bajo de Armilla: 97 departures (the hand count in HANDOFF §46), covered by its own timing point', [p['properties'] for p in cb])
check(all(p['properties']['service_date'] == '2026-10-26' and p['properties'].get('municipio') and p['properties']['in'] == 0 for p in ct), 'every consortium stop carries the service date, its municipality and in = 0')
check(len(CT.get('later_timetable') or []) == 5 and CT.get('trips_excluded_fri_sat_only', 0) > 0 and any('inside the Granada municipality' in s for s in CT.get('limitations', [])), 'manifest: 5 lines on a later timetable, Friday/Saturday-only trips excluded, the city gap stated', CT.get('later_timetable'))
pc = M['layers']['buildings'].get('periodCoverage') or {}
check(pc.get('dated') == pc.get('osm', 0) + pc.get('catastro', -1) and pc.get('catastro', 0) > 60000 and pc.get('total') == 101674, 'manifest period coverage counts both sources', pc)
from PIL import Image
wc = Image.open(os.path.join(ROOT, 'data', M['canopy']['worldcover']['file'])); hist = wc.convert('L').histogram(); vals = {v for v, n in enumerate(hist) if n}
check(vals <= {0, 60, 255} and hist[255] > 1e6 and hist[60] > 1e6, 'tree-cover raster: only the grey levels 0 / 60 / 255', sorted(vals))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
def boot(p, eea):
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader']); ctx = b.new_context(viewport={'width': 1500, 'height': 900}); ctx.add_init_script('window.__noPanelHook = true;')
    pg = ctx.new_page(); V3.stub3(pg); errs = []
    pg.route('https://image.discomap.eea.europa.eu/**', eea)
    pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.app.L', timeout=120000)
    pg.evaluate('GA.i18n.setLang("en")'); return b, pg, errs
def save_area(pg, lon, lat, side, name):
    pg.evaluate('GA.panels.set("study", true)'); pg.evaluate(f'GA.app.sel.setCenterDirect([{lon}, {lat}])'); time.sleep(0.3); pg.evaluate(f'GA.app.sel.setSide({side})'); time.sleep(0.3)
    pg.fill('#in-name', name); pg.click('#btn-save'); time.sleep(1); return pg.evaluate('GA.app.store.get().areas.slice(-1)[0].id')
strip = lambda s: re.sub(r'<[^>]+>', '', s or '')
try:
    with sync_playwright() as p:
        # ---------- A. the Copernicus host is blocked (fails at once) ----------
        b, pg, errs = boot(p, lambda r: r.abort())
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.51' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5985, 37.1765], zoom: 13.2 })'); time.sleep(1)
        pg.evaluate('GA.app.L.setOn("bld_period", true)'); time.sleep(2)
        lg = strip(pg.evaluate('GA.app.L.byId.bld_period.legend()')); sc = pg.evaluate('GA.app.L.byId.bld_period.src()')
        check('Catastro' in lg and f'{pc["dated"]:,}' in lg and 'Only 39' not in lg and 'Catastro' in sc, 'period layer: legend and source name the Catastro and the real count', lg[-300:])
        pop = strip(pg.evaluate('''(() => { const d = GA.app.L.byId.bld_period; return d.popup.html({ id: 'w1', b: 'yes', cy: 1975 }) + ' || ' + d.popup.html({ id: 'w2', b: 'yes', sd: '1925' }) + ' || ' + d.popup.html({ id: 'w3', b: 'yes' }); })()'''))
        check('1975 Catastro' in pop and '1925 OSM' in pop and pop.count('Catastro') == 1, 'building popup: the year with its source (Catastro / OSM), "no data" without one', pop)
        pg.evaluate('GA.app.L.setOn("bld_period", false)')
        # canopy layer → WorldCover
        pg.screenshot(path=f'{OUT}/canopy_before.png'); t0 = time.time()
        pg.evaluate('GA.app.L.setOn("canopy", true)')
        pg.wait_for_function('GA.app.L.byId.canopy._wc === "on"', timeout=60000); time.sleep(2.5); dt = time.time() - t0
        st = pg.evaluate('''(() => { const m = GA.app.map, d = GA.app.L.byId.canopy, s = m.getSource('ly-canopy-wc'); return { live: GA.ext.canopyState.live, vis: [m.getLayoutProperty('ly-canopy', 'visibility'), m.getLayoutProperty('ly-canopy-wc', 'visibility')],
          url: String(s && s.url || '').slice(0, 22), len: String(s && s.url || '').length, legend: d.legend(), src: d.src(), status: GA.app.L.S.canopy.status }; })()''')
        check(st['live'] is False and st['vis'] == ['none', 'visible'] and st['url'].startswith('data:image/png') and st['len'] > 20000, f'canopy layer: after failed tiles the WorldCover picture is shown ({dt:.0f} s)', {k: st[k] for k in ('live', 'vis', 'url', 'len', 'status')})
        check('WorldCover' in strip(st['legend']) and 'not a density' in strip(st['legend']) and 'WorldCover' in st['src'] and '%' not in strip(st['legend']).split('.')[0], 'canopy layer: its legend and source say WorldCover, a class (no density classes)', strip(st['legend'])[:200])
        pg.screenshot(path=f'{OUT}/canopy_after.png')
        a = Image.open(f'{OUT}/canopy_before.png').convert('RGB'); c = Image.open(f'{OUT}/canopy_after.png').convert('RGB')
        import numpy as np
        A, C = np.asarray(a).astype(int), np.asarray(c).astype(int); ch = (np.abs(A - C).sum(2) > 40)[60:, :]; col = pg.evaluate('GA.ext.TCD_CLASSES[4].col.slice(0, 3)')
        olive = (np.abs(C[60:] - np.array(col)).sum(2) < 90) & ch
        check(ch.mean() > 0.01 and olive.sum() > 2000, f'canopy layer draws: {ch.mean() * 100:.1f} % of the map changed, {int(olive.sum())} pixels in the tree-cover colour', (float(ch.mean()), int(olive.sum())))
        pg.evaluate('GA.app.L.setOn("canopy", false)')
        # bus layer: source and popup
        bsrc = pg.evaluate('GA.app.L.byId.bus_service.src()'); f0 = next(f for f in ct if f['properties'].get('approx')); f1 = next(f for f in bus if f['properties'].get('src') != 'ctan')
        ph = strip(pg.evaluate('(p) => GA.app.L.byId.bus_service.popup.html(p)', f0['properties'])); ph1 = strip(pg.evaluate('(p) => GA.app.L.byId.bus_service.popup.html(p)', f1['properties']))
        check('CTAN' in bsrc and 'CTAN' in ph and 'between timing points' in ph and 'Supplied city file' in ph1 and 'between timing points' not in ph1, 'bus layer: source line and popup tell consortium stops (inferred) from the city file', (bsrc[-120:], ph[-200:]))
        # the base-square analysis
        aid = save_area(pg, -3.6437, 37.1300, 4500, 'Base')
        pg.evaluate(f'GA.pages.go("fabric", "{aid}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=300000)
        pg.wait_for_function('GA.fabric.state && GA.fabric.state.cards.some(c => c.id === "trees" && !c.gapOnly)', timeout=180000); time.sleep(2)
        C0 = pg.evaluate('''Object.fromEntries(GA.fabric.state.cards.map(c => [c.id, { ind: (c.ind || []).map(r => [String(r[0]).replace(/<[^>]+>/g, ''), String(r[1]).replace(/<[^>]+>/g, '')]), find: (c.find || []).map(s => String(s).replace(/<[^>]+>/g, '')), method: String(c.method || '').replace(/<[^>]+>/g, '') }]))''')
        num = lambda s: int(re.sub(r'[^0-9]', '', s.split('(')[0].split('*')[0]) or -1)
        bc = C0['bus']; check(num(bc['ind'][0][1]) >= 110 and num(bc['ind'][1][1]) >= 110 and any('timing points' in f and 'undercounted' in f for f in bc['find']) and '5 lines' in bc['method'], f'bus card: {bc["ind"][0][1]} stops, {bc["ind"][1][1]} with service; the note explains the inference; 5 lines on a later timetable', bc)
        kp = pg.evaluate('[...document.querySelectorAll(".ap-kpis dt")].map(e => e.innerText)'); lab = pg.evaluate('GA.compare.labelOf("canopy_mean", GA.fabric.state.ind)')
        check(lab == 'Tree-cover share (WorldCover)' and lab in kp and 'Mean tree cover' not in kp and pg.evaluate('GA.fabric.state.ind.canopy_src') == 'wc', 'key indicators: the canopy figure is named "Tree-cover share (WorldCover)"', kp)
        pg.evaluate('GA.i18n.setLang("ar")'); time.sleep(1.5)
        kpa = pg.evaluate('[...document.querySelectorAll(".ap-kpis dt")].map(e => e.innerText)'); txt = pg.evaluate('document.querySelector(".ap").innerText')
        check(any('WorldCover' in k for k in kpa) and not re.search(r'\bv3[67]\.[A-Za-z]', txt), 'Arabic: the new labels are translated (no raw keys on the page)', kpa)
        check(not errs, 'no page errors (blocked host)', errs[:3]); b.close()
        # ---------- B. the Copernicus host hangs (never answers) ----------
        b, pg, errs = boot(p, lambda r: None)
        aid = save_area(pg, -3.6230, 37.1440, 600, 'Armilla')
        t0 = time.time(); pg.evaluate(f'GA.pages.go("fabric", "{aid}")')
        pg.wait_for_function('GA.fabric.state && GA.fabric.state.cards.some(c => c.id === "trees" && !c.gapOnly)', timeout=90000); dt = time.time() - t0
        cn = pg.evaluate('(() => { const c = GA.fabric.state.X.R.canopy; return c ? { wc: !!c.wc, err: c.liveErr, mean: c.mean } : null; })()')
        check(cn is not None and cn['wc'] and dt < 45, f'hanging service: the tree card still arrives from WorldCover after {dt:.0f} s (limit 45)', cn)
        check(not errs, 'no page errors (hanging host)', errs[:3]); b.close()
finally:
    srv.terminate()
print(('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)), flush=True)
sys.exit(1 if fails else 0)
