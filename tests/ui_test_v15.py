"""v15 — build 5.16: Exercise 1.3 City identity card. Six A3 portrait pages in ONE shared frame (data/ex13/frame.json):
same map position, size, extent and scale on all five maps; legends built from the palette classes; nothing below the
footer; ar / he / en; the #/ex13 page with six previews, the large viewer, the combined PDF (6 pages, A3 portrait), the
PNG ZIP (6 × 2339 × 3307 px), the GIS ZIP (GeoJSON that parses, frame identical in every layer extent), "Exported" kept
apart from "Uploaded to Miro", saved work preserved; data integrity of the processed layers and the cross-checks.
Usage: python3 tests/ui_test_v15.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, base64, io, re, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8815; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v15shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def b64img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1])))
J = lambda n: json.load(open(os.path.join(ROOT, 'data/ex13', n + '.json'), encoding='utf-8'))

# ---------- data integrity (no browser) ----------
fr = J('frame'); den = J('density'); mor = J('morphology'); cen = J('centre'); cli = J('climate'); hum = J('human'); chk = J('checks')
check(fr['x1'] - fr['x0'] == fr['y1'] - fr['y0'] == 10000 and fr['scale'] == 40000 and fr['map_mm'] == 250, f'frame stored once: 10 × 10 km, 250 mm, 1:{fr["scale"]}')
check(abs(fr['map_mm'] / 1000 * fr['scale'] - 10000) < 1, 'printed map size × scale = frame width (250 mm × 40,000 = 10 km)')
check(cli['grid']['x0'] == cen['grid']['x0'] == mor['grid']['x0'] == fr['x0'] and cli['grid']['y1'] == cen['grid']['y1'] == mor['grid']['y1'] == fr['y1'], 'every gridded layer is anchored to the same frame corner')
check(all(v is None or v >= 0 for row in den['pop'] for v in row), 'density: no negative residents; missing cells stay null (never zero-filled)')
check(den['kind'] == 'modelled' and 'counts' in den['cell_values'], 'density: source cells are counts (verified) and labelled modelled')
check(cli['stats']['missing_cells'] == 0 and cli['stats']['min_obs'] >= 3, f'climate: every 90 m cell has ≥ 3 clear observations (min {cli["stats"]["min_obs"]})')
check('not air temperature'.lower() in cli['what'].lower(), 'climate: land surface temperature explicitly not air temperature')
check(cen['kernel']['radius_m'] == 300 and cen['stats']['duplicates'] >= 0 and all(p.get('rank') for p in cen['peaks']), 'centre: kernel radius, duplicates and peak ranks recorded')
check(abs(chk['density']['diff_pct']) < 1 and abs(chk['morphology']['coverage_vector_pct'] - chk['morphology']['coverage_raster_build_pct']) < 0.5, f'cross-checks: population area-weighted vs centres {chk["density"]["diff_pct"]} %, coverage vector vs raster')
check(abs(chk['centre']['c1_kernel_direct'] - chk['centre']['c1_kernel_build']) <= 5 and abs(chk['climate']['plaza_nueva_median_of_block_obs'] - chk['climate']['plaza_nueva_block_build']) < 0.5 and abs(chk['human']['reach_nearest_pct'] - chk['human']['reach_build_pct']) < 1, 'cross-checks: C1 kernel, Plaza Nueva LST, residents within 300 m agree')
P = json.load(open(os.path.join(ROOT, 'data/manifest.json')))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.ex13', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.16' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        # saved work: an existing finding survives the new module
        pg.evaluate('''() => { const p = GA.app.store.get(); p.ex13 = Object.assign(p.ex13 || {}, { maps: { density: { finding: 'Our own density sentence.', surprise: '' } } }); GA.app.store.save(); }''')
        pg.evaluate('GA.ex13.load()'); time.sleep(1)
        PAL = pg.evaluate('GA.palette.ex13')
        for lang in ['en', 'ar', 'he']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            lays = {}
            for k in ['identity', 'density', 'morphology', 'centre', 'climate', 'human']:
                r = pg.evaluate(f'(async () => {{ const c = await GA.ex13.pageCanvas("{k}", 100); return {{ l: c.__layout, w: c.width, h: c.height, u: c.toDataURL("image/jpeg", .8) }}; }})()')
                lays[k] = r['l']; b64img(r['u']).save(f'{OUT}/{lang}_{k}.jpg')
                check(r['l']['bottom'] < r['l']['footerY'] - 2, f'{lang} {k}: text ends above the footer (no clipping) {round(r["l"]["bottom"])} < {round(r["l"]["footerY"])}')
            maps = {k: (v['mapX'], v['mapY'], v['mapS']) for k, v in lays.items() if k != 'identity'}
            check(len(set(maps.values())) == 1, f'{lang}: all five maps at the same position and size {set(maps.values())}')
        pg.evaluate('GA.i18n.setLang("en")'); time.sleep(0.3)
        # legends use the palette classes that colour the map
        for k, key in [('density', 'density'), ('centre', 'centre'), ('climate', 'lst')]:
            sw = pg.evaluate(f'GA.ex13.legendItems("{k}").filter(i => i.sw && i.sw !== "#FFFFFF").map(i => i.sw)')
            check(sw == PAL[key], f'legend {k}: swatches are exactly the map classes ({len(sw)})', sw)
        lab = pg.evaluate('GA.ex13.legendItems("density").map(i => i.label).join(" | ")').replace('\u200e', ''); check('1,000–5,000' in lab and '> 30,000' in lab and 'residents/km²' in lab, 'density legend: numeric ranges and units', lab)
        lab = pg.evaluate('GA.ex13.legendItems("climate").map(i => i.label).join(" | ")').replace('\u200e', ''); check('°C' in lab and '47–49' in lab, 'climate legend: °C ranges', lab)
        sent = pg.evaluate('GA.ex13.content("density").sentence'); check(sent == 'Our own density sentence.', 'saved finding replaces the generated sentence (saved work kept)')
        # one map drawn twice from the stored frame is identical (no auto-fit)
        same = pg.evaluate('''(async () => { await GA.ex13.load(); const a = document.createElement('canvas'); a.width = a.height = 300; const b = document.createElement('canvas'); b.width = b.height = 300;
            GA.ex13.drawMap('density', a.getContext('2d'), 0, 0, 300); GA.ex13.drawMap('density', b.getContext('2d'), 0, 0, 300); return a.toDataURL() === b.toDataURL(); })()''')
        check(same, 'maps are drawn from the stored frame (deterministic, nothing auto-fitted)')
        # ---------- the page ----------
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(1)
        pg.screenshot(path=f'{OUT}/page_en.png', full_page=False)
        check(pg.evaluate('document.querySelectorAll(".x13-tbl tbody tr").length') == 6, 'data audit table: five maps + identity')
        miss = pg.evaluate('[...document.querySelectorAll("#e13-sub .sub-miss [data-sub-go]")].map(b => b.textContent)'); check(len(miss) == 1, f'only the student names are missing {miss}')
        pg.fill('[data-e="students"]', 'Test Student A, Test Student B'); time.sleep(1.2)
        r = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("identity", 100); return c.toDataURL("image/jpeg", .8); })()'); b64img(r).save(f'{OUT}/en_identity_named.jpg')
        check(pg.evaluate('GA.app.store.get().ex13.students') == 'Test Student A, Test Student B', 'student names saved')
        pg.click('[data-e13open="climate"]'); pg.wait_for_selector('.vw-sheet img', timeout=120000); time.sleep(1)
        check(pg.evaluate('document.querySelector(".vw-sheet img").naturalWidth') == 2339, 'map page opens large in the viewer (2339 px wide, 200 dpi)')
        pg.keyboard.press('Escape'); time.sleep(0.5)
        with pg.expect_download(timeout=600000) as dl: pg.click('#e13-pdf')
        path = f'{OUT}/granada_1-3.pdf'; dl.value.save_as(path)
        info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout
        check(re.search(r'Pages:\s+6\b', info) and '841.89 x 1190.55' in info, 'combined PDF: 6 pages, A3 portrait', info)
        subprocess.run(['pdftoppm', '-r', '40', '-jpeg', path, f'{OUT}/pdf'], check=False)
        pdfp = sorted(f for f in os.listdir(OUT) if f.startswith('pdf-'))
        blank = [f for f in pdfp if Image.open(f'{OUT}/{f}').convert('L').getextrema()[0] > 200]; check(len(pdfp) == 6 and not blank, f'PDF pages rasterised, none blank {pdfp}')
        lays = pg.evaluate('GA.lastEx13.layouts'); check(len({(l['mapX'], l['mapY'], l['mapS']) for l in lays[1:]}) == 1, 'PDF: same map box on the five map pages')
        with pg.expect_download(timeout=600000) as dl: pg.click('#e13-zip')
        z = zipfile.ZipFile(io.BytesIO(open(dl.value.path(), 'rb').read())); names = z.namelist()
        sizes = {Image.open(io.BytesIO(z.read(n))).size for n in names}
        check(len(names) == 6 and sizes == {(2339, 3307)}, f'PNG ZIP: six pages at 2339 × 3307 px (A3, 200 dpi) {sizes}')
        with pg.expect_download(timeout=600000) as dl: pg.click('#e13-gis')
        gz = zipfile.ZipFile(io.BytesIO(open(dl.value.path(), 'rb').read())); gn = gz.namelist(); bad = []; counts = {}
        for n in gn:
            if n.endswith('.geojson'):
                try: j = json.loads(gz.read(n)); counts[n.split('/')[-1]] = len(j['features'])
                except Exception as e: bad.append(n)
        check(len(counts) >= 9 and not bad and all(v > 0 for v in counts.values()), f'GIS ZIP: {len(counts)} GeoJSON layers parse, none empty', counts)
        check(any(n.endswith('README_sources_and_licences.txt') for n in gn) and b'ODbL' in gz.read([n for n in gn if n.endswith('.txt')][0]), 'GIS ZIP: README with sources and licences')
        st = pg.evaluate('[...document.querySelectorAll("#e13-sub .ss")].map(e => e.className.includes("ok"))'); check(st[2] and not st[3], 'exports recorded as "exported", not "uploaded to Miro"', st)
        check(pg.evaluate('!GA.app.store.get().ex13.uploaded'), 'upload flag untouched by exporting')
        # RTL page in the browser
        pg.evaluate('GA.i18n.setLang("he")'); time.sleep(0.5); pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(1)
        pg.screenshot(path=f'{OUT}/page_he.png'); check(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'he: no horizontal overflow')
        check(not errs, 'no page errors', errs[:3])
        ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
