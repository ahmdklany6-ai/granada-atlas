"""Live check of the analysis board on the PUBLIC site (GitHub runner, real services): four test study areas are written into
the runner's own fresh browser storage (never a visitor's), the analysis page of area 1 is opened (canvas only — no map
movement, which software WebGL on the runner cannot do), the analysis PDF is exported and each page is rasterised into the
job log; the real IGN PNOA 2024 response is checked in the browser. PART b tries the A1 print export (WebGL) with a limit."""
import base64, io, json, os, time, urllib.request
from playwright.sync_api import sync_playwright
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'; EXPECT = os.environ.get('EXPECT_BUILD') or json.load(open('version.json'))['build']; PART = os.environ.get('PART', 'a')
PROJ = open(os.path.join(os.path.dirname(__file__), 'four_areas_project.json')).read()
def step(m): print(time.strftime('%H:%M:%S'), '·', m, flush=True)
res = []
def check(c, m, x=''): res.append((bool(c), m)); print(('ok   ' if c else 'FAIL ') + m + (f'  [{x}]' if x != '' and not c else ''), flush=True)
def img(name, png_bytes, q=72, maxw=1600):
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB');
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q); s = base64.b64encode(b.getvalue()).decode(); print(f'===IMG {name}.jpg==='); [print(s[i:i + 8000]) for i in range(0, len(s), 8000)]; print('===END===', flush=True)
for i in range(40):
    try:
        v = json.load(urllib.request.urlopen(SITE + 'version.json?n=' + str(time.time()), timeout=20))['build']; print('live version.json', v, flush=True)
        if v == EXPECT: break
    except Exception as e: print(e)
    time.sleep(20)
check(v == EXPECT, f'public site serves build {EXPECT}', v)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script('if (!sessionStorage.getItem("ga-test-seeded")) { localStorage.setItem("granada-atlas.project.v1", ' + json.dumps(PROJ) + '); sessionStorage.setItem("ga-test-seeded", "1"); } window.__noPanelHook = true;')
    pg = ctx.new_page(); pg.set_default_timeout(600000); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    step('boot'); pg.goto(SITE + '?v=' + EXPECT, wait_until='load', timeout=180000); pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.fabric', timeout=300000)
    check(pg.evaluate('window.GA_BUILD') == EXPECT, f'page runs build {EXPECT}')
    check(pg.evaluate('GA.fabricStyle.numbered().map(x => x.no).join(",")') == '1,2,3,4', 'four saved test areas numbered 1–4', pg.evaluate('GA.fabricStyle.numbered().map(x => x.no)'))
    ids = pg.evaluate('GA.app.store.get().areas.map(a => a.id)')
    if PART == 'a':
        r = pg.evaluate('''async () => { const X = GA.ext; const u = "https://www.ign.es/wms/pnoa-historico?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=PNOA2024&STYLES=&SRS=EPSG:25830&BBOX=446300,4114300,447300,4115100&WIDTH=320&HEIGHT=256&FORMAT=image/jpeg";
          const im = await X.loadImage(u, 40000); const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d"); g.drawImage(im, 0, 0, 32, 32); let d; try { d = g.getImageData(0, 0, 32, 32).data; } catch (e) { return { readable: false, err: e.message }; }
          let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); } return { readable: true, min: mn, max: mx }; }''')
        check(r.get('readable') and r['min'] == r['max'], 'live IGN PNOA2024 over Granada is a readable, uniform (blank) image — the browser can detect it', r)
        step('analysis page'); pg.evaluate(f'GA.pages.go("fabric", "{ids[0]}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=600000); time.sleep(8)
        pg.evaluate('GA.fabric.state.paintAllNow && GA.fabric.state.paintAllNow()'); step('history'); pg.evaluate('GA.fabric.ensureHistory()'); time.sleep(5)
        h = pg.evaluate('(() => { const s = GA.fabric.state.hist || {}; return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { canvas: !!(v && v.canvas), used: v && v.used, skipped: v && v.skipped, unavailable: v && v.unavailable }])); })()'); print('HIST', json.dumps(h), flush=True)
        check(h.get('pnoa2024', {}).get('canvas') and h['pnoa2024'].get('used') != 'PNOA2024', 'live: PNOA 2024 frame shows the most recent flight with imagery (not a blank)', h.get('pnoa2024'))
        check(all(x.get('canvas') or x.get('unavailable') for x in h.values()), 'live: every historical frame is an image or an explicit unavailable state', h)
        el = pg.query_selector('#ap-loc'); img('L1_live_location_map_all_areas', el.screenshot()); print('LOCNOTE', pg.evaluate('(document.querySelector("#ap-loc-out") || {}).textContent'), flush=True)
        fig = pg.query_selector('[data-hist="pnoa2024"]'); fig.scroll_into_view_if_needed(); time.sleep(2); img('L2_live_pnoa_figure', fig.screenshot())
        tr = pg.query_selector('article.card[data-card="trees"]')
        if tr: tr.scroll_into_view_if_needed(); time.sleep(3); img('L3_live_trees_card', tr.screenshot())
        step('export PDF'); pg.evaluate(f'GA.fabric.exportPDF("{ids[0]}")'); pg.wait_for_function('window.GA.lastFabricPDF && GA.lastFabricPDF.bytes', timeout=900000)
        b64 = pg.evaluate('(() => { const u = GA.lastFabricPDF.bytes; let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); })()')
        pdf = base64.b64decode(b64); import fitz; doc = fitz.open(stream=pdf, filetype='pdf'); check(doc.page_count >= 6, f'live analysis PDF: {doc.page_count} A3 pages, {len(pdf) // 1024} KB', doc.page_count)
        for i, page in enumerate(doc): pm = page.get_pixmap(dpi=60); img(f'P{i + 1:02d}_live_analysis_pdf_page', pm.tobytes('png'), maxw=1400)
    if PART == 'b':
        step('A1 print export (WebGL map render)')
        pg.evaluate('GA.app.L.setOn("canopy", true); GA.app.L.setOn("trees", true); GA.pages.go("print")'); time.sleep(4)
        pg.evaluate("""(() => { const s = GA.printLayout.st; s.paper = 'A1'; s.orient = 'landscape'; s.dpi = 150; s.template = 'side'; s.title = 'Granada — study areas 1 to 4'; s.subtitle = 'Tree cover and mapped trees (live)'; s.slots = [{ type: 'map', denom: 10000, caption: 'Study areas 1–4 at 1:10,000' }, { type: 'legend', caption: '' }, { type: 'none', caption: '' }, { type: 'none', caption: '' }]; GA.pages.route(); })()""")
        time.sleep(3); pg.click('[data-pl-act="pdf"]')
        try:
            pg.wait_for_function('window.GA.lastPrintPDF', timeout=1800000)
            b64 = pg.evaluate('(() => { const u = GA.lastPrintPDF; let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); })()')
            import fitz; doc = fitz.open(stream=base64.b64decode(b64), filetype='pdf'); r = doc[0].rect; check(abs(r.width - 2384) < 3 and abs(r.height - 1684) < 3, f'live A1 PDF: {round(r.width)} × {round(r.height)} pt'); img('A1_live_print_page', doc[0].get_pixmap(dpi=14).tobytes('png'), maxw=1600)
        except Exception as e: check(False, 'live A1 print export finished within 30 min (software WebGL on the runner)', str(e)[:120])
    check(not errs, 'no page errors', errs[:3]); b.close()
n = sum(1 for c, _ in res if not c); print(f'\nLIVE RESULT part {PART}: {len(res) - n}/{len(res)} passed' + ('' if not n else ' — FAILED: ' + '; '.join(m for c, m in res if not c)), flush=True)
