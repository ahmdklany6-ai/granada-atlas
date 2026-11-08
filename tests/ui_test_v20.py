"""v20 — build 5.22: Exercise 1.3 morphology in the artistic map language (notation on a 250 m grid).
Checks: the switch is saved per project and defaults to architectural; the artistic map draws only palette colours
(cell tones, the dark-brown edge of compact fabric, the squares lattice) and the legend lists the same layers with
shares that add up to 100 %; focus (one layer full, others faint) and build-up change the drawing; the preview player
plays, highlights a layer and stops; the per-layer PNG ZIP holds one A3 page per layer plus the whole map; ar / he / en
strings exist; the architectural map is unchanged when the switch is off; saved work is kept.
Usage: python3 tests/ui_test_v20.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, base64, io, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8820; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v20shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def b64img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1])))
def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def near(im, rgb, tol=10):
    px = list(im.convert('RGB').get_flattened_data()) if hasattr(im, 'get_flattened_data') else im.convert('RGB').getdata(); return sum(1 for p in px if abs(p[0] - rgb[0]) <= tol and abs(p[1] - rgb[1]) <= tol and abs(p[2] - rgb[2]) <= tol)

MAP = '''(async (o) => { await GA.ex13.load(); const c = document.createElement('canvas'); c.width = c.height = 800; GA.ex13.drawMap('morphology', c.getContext('2d'), 0, 0, 800, o); return c.toDataURL(); })'''
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.ex13 && GA.ex13art', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.22' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('''() => { const p = GA.app.store.get(); p.ex13 = Object.assign(p.ex13 || {}, { students: 'Keep Me', maps: { density: { finding: 'Our own density sentence.', surprise: '' } } }); GA.app.store.save(); }''')
        pg.evaluate('GA.ex13.load()'); time.sleep(1)
        A = pg.evaluate('GA.palette.ex13art')
        check(pg.evaluate('GA.ex13.artOn("morphology")') is False, 'default is the architectural map (switch off)')
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('document.fonts.ready'); time.sleep(0.3)
        arch = pg.evaluate(MAP + '()')  # same language as the final comparison (the map text uses the language's font)
        legA = pg.evaluate('GA.ex13.legendItems("morphology").length')
        # switch on (as the page radio does) and draw
        pg.evaluate('() => { GA.ex13.E().maps.morphology.style = "art"; GA.app.store.save(); }')
        check(pg.evaluate('GA.ex13.artOn("morphology")') and pg.evaluate('GA.app.store.get().ex13.maps.morphology.style') == 'art', 'artistic switch saved in the project')
        art = pg.evaluate(MAP + '()'); im = b64img(art); im.save(f'{OUT}/art_map.png')
        check(art != arch, 'artistic map differs from the architectural one')
        check(near(im, hexrgb(A['edge']), 6) > 500, 'dark-brown edge of compact fabric drawn in the palette colour', near(im, hexrgb(A['edge']), 6))
        check(near(im, hexrgb(A['square']), 14) > 50, 'squares lattice drawn in the palette blue', near(im, hexrgb(A['square']), 14))
        G = pg.evaluate('(() => { const g = GA.ex13art.prepare(GA.ex13.data); return { n: g.n, shares: g.shares, cells: Array.from(g.cells) }; })()')
        G2 = pg.evaluate('(() => { const D = GA.ex13.data; GA.ex13art.prepare(Object.assign({}, D)); return GA.ex13art.grid.shares; })()')
        check(max(abs(x - y) for x, y in zip(G['shares'], G2)) < 1e-9, 'built shares identical when recomputed (no dependence on resampling)')
        check(G['n'] == 40 and abs(sum(G['shares']) - 100) < 0.01 and sum(G['cells']) == 1600, f'40 × 40 cells of 250 m; built shares add up to 100 % {[round(s, 1) for s in G["shares"]]}')
        L = pg.evaluate('GA.ex13.legendItems("morphology").map(i => ({ label: i.label, layer: i.layer, sw: i.sw || i.edge || i.lattice || i.line }))')
        check([i['layer'] for i in L if i['layer'] is not None] == [0, 1, 2, 3, 4] and L[0]['sw'] == A['sparse'] and L[2]['sw'] == A['compact'] and L[3]['sw'] == A['edge'] and L[4]['sw'] == A['square'], 'legend: five layers in drawing order, colours read from the palette')
        check(all('%' in L[i]['label'] for i in range(3)), 'legend: each fabric class shows its share of the built area')
        foc = b64img(pg.evaluate(MAP + '({ focus: 3 })')); up = pg.evaluate(MAP + '({ upTo: 1 })')
        check(near(foc, hexrgb(A['edge']), 6) > 500 and near(foc, hexrgb(A['square']), 14) < near(im, hexrgb(A['square']), 14), 'focus: the chosen layer stays full, the others fade')
        check(near(b64img(up), hexrgb(A['edge']), 6) < 20, 'build-up: later layers are not drawn yet')
        same = pg.evaluate(MAP + '()') == art; check(same, 'deterministic redraw')
        c = pg.evaluate('GA.ex13.content("morphology")'); check(c['chart'] and len(c['chart']) == 3 and not any('gap' in r[0].lower() for r in c['ind']), 'page: built-share bar; no data-gap indicators in the artistic version')
        # page, player
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(1)
        check(pg.evaluate('document.querySelector("input[name=x20-style][value=art]").checked'), 'page: switch shows the saved choice')
        check(pg.evaluate('!document.querySelector("[data-x20player]").hidden && document.querySelectorAll(".x20-chip").length') == 5, 'player: visible with five layer buttons')
        pg.click('.x20-chip[data-x20layer="2"]'); time.sleep(1.2); check(pg.evaluate('document.querySelector(".x20-chip[data-x20layer=\\"2\\"]").classList.contains("on")'), 'player: clicking a layer highlights it')
        pg.click('[data-x20play]'); time.sleep(4); check('❚❚' in pg.evaluate('document.querySelector("[data-x20play]").textContent'), 'player: plays')
        pg.click('[data-x20play]'); time.sleep(0.8); check('▶' in pg.evaluate('document.querySelector("[data-x20play]").textContent'), 'player: stops')
        pg.screenshot(path=f'{OUT}/page_en.png')
        # per-layer ZIP
        zb = pg.evaluate('(async () => { const bl = await GA.ex13.layersZip("morphology"); const u8 = new Uint8Array(await bl.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); })()')
        z = zipfile.ZipFile(io.BytesIO(base64.b64decode(zb))); names = z.namelist(); sizes = {Image.open(io.BytesIO(z.read(n))).size for n in names}
        check(len(names) == 6 and names[-1].endswith('_all.png') and sizes == {(2339, 3307)}, f'per-layer ZIP: 5 layers + all, A3 at 200 dpi {names} {sizes}')
        # languages
        for lang in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            labs = pg.evaluate('GA.ex13.legendItems("morphology").map(i => i.label)'); check(all(l and not l.startswith('x20.') for l in labs), f'{lang}: legend strings present')
            r = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("morphology", 100); return c.toDataURL("image/jpeg", .8); })()'); b64img(r).save(f'{OUT}/{lang}_morphology_art.jpg')
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(0.5)
        check(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'en: no horizontal overflow')
        # switch back: the architectural map is exactly what it was
        pg.click('input[name=x20-style][value=arch]'); time.sleep(0.5)
        check(pg.evaluate('GA.app.store.get().ex13.maps.morphology.style') == 'arch', 'switching back saved')
        arch2 = pg.evaluate(MAP + '()'); b64img(arch).save(f'{OUT}/arch_before.png'); b64img(arch2).save(f'{OUT}/arch_after.png')
        from PIL import ImageChops, ImageStat
        # the browser may resample the 4 m raster more smoothly once it has been decoded at full size, so compare what the
        # map says (share of dark building pixels, and the palette colours present), not the exact anti-aliasing
        dark = lambda im: sum(1 for v in im.convert('L').resize((400, 400)).get_flattened_data() if v < 110) / 160000
        d0, d1 = dark(b64img(arch)), dark(b64img(arch2))
        check(abs(d0 - d1) < 0.02 and near(b64img(arch2), hexrgb(A['edge']), 6) < 50, f'switching back: architectural figure-ground as before (dark share {d0:.3f} vs {d1:.3f}), no artistic marks')
        check(pg.evaluate('GA.ex13.legendItems("morphology").length') == legA, 'switching back: architectural legend unchanged')
        check(pg.evaluate('document.querySelector("[data-x20player]").hidden'), 'player hidden for the architectural map')
        check(pg.evaluate('GA.app.store.get().ex13.students') == 'Keep Me' and pg.evaluate('GA.ex13.content("density").sentence') == 'Our own density sentence.', 'saved work kept')
        check(not errs, 'no page errors', errs[:3])
        ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
