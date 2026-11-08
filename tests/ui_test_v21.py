"""v21 — build 5.23: Exercise 1.3 city centre in the artistic map language (500 m grid over the whole map, Granada at
full strength, surroundings faded, centre as black-and-white aerial squares).
Checks: the assets exist and agree with the frame (2000 px, 20 × 20 cells, tiles >= 500 places/km2, densest first, all
touching the city); the switch is per topic and saved; the drawing fades the surroundings and keeps Granada strong; the
squares fade in (build-up with t); focus fades the other layers; legend = layers in drawing order with the PNOA source in
the limits; the preview player plays / highlights / stops for the centre while morphology keeps its own switch; PNG per
layer ZIP; ar / he / en strings; switching back restores the architectural map; saved work kept.
Usage: python3 tests/ui_test_v21.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, base64, io, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8821; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v21shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def b64img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1]))).convert('RGB')

A = os.path.join(ROOT, 'data/ex13/art'); meta = json.load(open(os.path.join(A, 'centre_art.json')))
sizes = {f: Image.open(os.path.join(A, f)).size for f in ['centre_base.jpg', 'centre_aerial.jpg', 'centre_city.png', 'centre_edge.png']}
check(set(sizes.values()) == {(2000, 2000)} and meta['frame_px'] == 2000 and meta['grid_n'] == 20 and meta['cell_m'] == 500, f'assets: four 2000 px images in the shared frame, 20 × 20 cells of 500 m {sizes}')
vs = [t[2] for t in meta['tiles']]; check(len(vs) > 5 and min(vs) >= 500 and vs == sorted(vs, reverse=True), f'tiles: {len(vs)} cells, all >= 500 places/km², densest first')
city = Image.open(os.path.join(A, 'centre_city.png')).split()[-1]; C = 2000 // 20
touch = all(city.crop((i * C, j * C, (i + 1) * C, (j + 1) * C)).getextrema()[1] > 127 for i, j, v in meta['tiles']); check(touch, 'every tile touches the city shape')
check('PNOA' in meta['sources']['aerial'] and 'CC BY 4.0' in meta['sources']['aerial'] and 5 < meta['city_km2'] < 60, f'sources and city area recorded ({meta["city_km2"]} km²)')
MAP = '''(async (o) => { await GA.ex13.load(); await GA.ex13art.ready("centre"); const c = document.createElement('canvas'); c.width = c.height = 800; GA.ex13.drawMap('centre', c.getContext('2d'), 0, 0, 800, o); return c.toDataURL(); })'''
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.ex13 && GA.ex13art', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.23' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('''() => { const p = GA.app.store.get(); p.ex13 = Object.assign(p.ex13 || {}, { students: 'Keep Me' }); GA.app.store.save(); }''')
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.ex13.load()'); time.sleep(0.5)
        check(pg.evaluate('GA.ex13.artOn("centre")') is False, 'default: architectural centre map')
        arch = b64img(pg.evaluate(MAP + '()')); legA = pg.evaluate('GA.ex13.legendItems("centre").length')
        pg.evaluate('() => { GA.ex13.E().maps.centre.style = "art"; GA.app.store.save(); }')
        check(pg.evaluate('GA.ex13.artOn("centre") && !GA.ex13.artOn("morphology")'), 'switch is per topic (centre on, morphology untouched)')
        art = b64img(pg.evaluate(MAP + '()')); art.save(f'{OUT}/centre_art.png')
        # Granada strong, surroundings faded: compare the contrast inside / outside the city shape at the map scale
        m = city.resize((800, 800)); inside = ImageStat.Stat(art.convert('L'), m.point(lambda v: 255 if v > 127 else 0)); outside = ImageStat.Stat(art.convert('L'), m.point(lambda v: 0 if v > 127 else 255))
        check(inside.stddev[0] > outside.stddev[0] * 1.6 and inside.mean[0] < outside.mean[0], f'Granada at full strength, surroundings faded (σ in {inside.stddev[0]:.0f} vs out {outside.stddev[0]:.0f})')
        t0 = b64img(pg.evaluate(MAP + '({ upTo: 2, t: 0 })')); th = b64img(pg.evaluate(MAP + '({ upTo: 2, t: 0.5 })')); t1 = b64img(pg.evaluate(MAP + '({ upTo: 2, t: 1 })'))
        dk = lambda im: sum(1 for v in im.convert('L').resize((200, 200)).get_flattened_data() if v < 70)
        check(dk(t0) < dk(th) < dk(t1), f'aerial squares fade in gradually (dark pixels {dk(t0)} < {dk(th)} < {dk(t1)})')
        f1 = b64img(pg.evaluate(MAP + '({ focus: 1 })')); f0 = b64img(pg.evaluate(MAP + '({ focus: 0 })'))
        check(dk(f1) > dk(f0), 'focus: the chosen layer stays full, the others fade')
        L = pg.evaluate('GA.ex13.legendItems("centre").map(i => ({ label: i.label, layer: i.layer, patch: !!i.patch }))')
        check([i['layer'] for i in L if i['layer'] is not None] == [0, 1, 2, 3, 4] and L[1]['patch'], 'legend: five layers in drawing order, aerial patch swatch')
        src = ' '.join(pg.evaluate('GA.ex13.content("centre").src')); check('PNOA' in src and 'Armilla' in src, 'limits: PNOA source and the C2 note')
        # page and player
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(1)
        check(pg.evaluate('document.querySelector("input[name=x20-style-centre][value=art]").checked && document.querySelector("input[name=x20-style-morphology][value=arch]").checked'), 'page: each topic shows its own saved choice')
        check(pg.evaluate('!document.querySelector("[data-x20player=centre]").hidden && document.querySelector("[data-x20player=morphology]").hidden'), 'player shown for the centre only')
        pg.click('[data-x20player=centre] .x20-chip[data-x20layer="1"]'); time.sleep(0.5)
        check(pg.evaluate('document.querySelector("[data-x20player=centre] .x20-chip[data-x20layer=\\"1\\"]").classList.contains("on")'), 'player: clicking a layer highlights it')
        pg.click('[data-x20player=centre] [data-x20play]'); time.sleep(9.5)
        check('❚❚' in pg.evaluate('document.querySelector("[data-x20player=centre] [data-x20play]").textContent'), 'player: plays')
        pg.locator('[data-e13="centre"]').screenshot(path=f'{OUT}/player.png')
        pg.click('[data-x20player=centre] [data-x20play]'); time.sleep(0.5); check('▶' in pg.evaluate('document.querySelector("[data-x20player=centre] [data-x20play]").textContent'), 'player: stops')
        zb = pg.evaluate('(async () => { const bl = await GA.ex13.layersZip("centre"); const u8 = new Uint8Array(await bl.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); })()')
        z = zipfile.ZipFile(io.BytesIO(base64.b64decode(zb))); names = z.namelist(); sz = {Image.open(io.BytesIO(z.read(n))).size for n in names}
        check(len(names) == 6 and names[-1].endswith('_all.png') and sz == {(2339, 3307)}, f'per-layer ZIP: 5 layers + all, A3 at 200 dpi {names}')
        for lang in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            labs = pg.evaluate('GA.ex13.legendItems("centre").map(i => i.label)'); check(all(l and 'x21.' not in l for l in labs), f'{lang}: legend strings present')
            r = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("centre", 100); return c.toDataURL("image/jpeg", .8); })()'); b64img(r).save(f'{OUT}/{lang}_centre_art.jpg')
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(0.5)
        pg.click('input[name=x20-style-centre][value=arch]'); time.sleep(1)
        pg.evaluate('GA.i18n.setLang("en")'); arch2 = b64img(pg.evaluate(MAP + '()'))
        dm = sum(ImageStat.Stat(Image.eval(Image.blend(arch, arch2, 0.5), lambda v: v)).mean) / 3; diff = sum(abs(a - b2) for a, b2 in zip(ImageStat.Stat(arch).mean, ImageStat.Stat(arch2).mean))
        check(pg.evaluate('GA.app.store.get().ex13.maps.centre.style') == 'arch' and diff < 2 and pg.evaluate('GA.ex13.legendItems("centre").length') == legA, f'switching back restores the architectural map and legend (mean colour difference {diff:.2f})')
        check(pg.evaluate('GA.app.store.get().ex13.students') == 'Keep Me', 'saved work kept')
        check(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'no horizontal overflow')
        check(not errs, 'no page errors', errs[:3])
        ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
