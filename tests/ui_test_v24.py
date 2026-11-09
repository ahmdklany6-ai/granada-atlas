"""v24 — build 5.26: Exercise 1.3 human dimension in the artistic map language (each layer a 3D object over a line drawing
seen from the south-west, a top view of the same layers).
Checks: assets exist and agree with the frame; per-topic switch; the drawing differs from the architectural map and uses the
palette's human colours; build-up raises objects gradually; focus fades the other layers; top view follows focus; legend =
six layers; limits name the scales and what is not drawn; page fits; player plays / highlights / stops; PNG per layer ZIP
(6 + all); ar / he / en strings; switching back restores the architectural map; saved work kept.
Usage: python3 tests/ui_test_v24.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, base64, io, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8824; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v24shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def b64img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1]))).convert('RGB')
def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def near(im, rgb, tol=14): return sum(1 for p in im.get_flattened_data() if abs(p[0] - rgb[0]) <= tol and abs(p[1] - rgb[1]) <= tol and abs(p[2] - rgb[2]) <= tol)
A = json.load(open(os.path.join(ROOT, 'data/ex13/art/human_art.json')))
check(len(A['residents']) > 100 and len(A['peaks']) == 6 and len(A['streets']) == 6 and len(A['stops']) == 20 and len(A['hotels']) > 100, f'assets: residents {len(A["residents"])}, 6 peaks, 6 streets, 20 stops, {len(A["hotels"])} hotels')
check(all(0 <= p['x'] <= 1000 and 0 <= p['y'] <= 1000 for p in A['peaks'] + A['stops']) and Image.open(os.path.join(ROOT, 'data/ex13/art/human_ground.png')).size == (2000, 2000), 'assets inside the frame; ground drawing 2000 px')
check([s['t'] for s in A['stops']] == sorted([s['t'] for s in A['stops']], reverse=True) and all(s['per100'] > 0 and s['len'] >= 250 and s['n'] >= 20 for s in A['streets']), 'stops ranked by trips; shop streets meet the rule')
MAP = """(async (o) => { await GA.ex13.load(); await GA.ex13art.ready("human"); const c = document.createElement('canvas'); c.width = c.height = 800; GA.ex13.drawMap('human', c.getContext('2d'), 0, 0, 800, o); return c.toDataURL(); })"""
TOP = """(async (o) => { await GA.ex13art.ready("human"); const c = document.createElement('canvas'); c.width = c.height = 400; GA.ex13art.drawHumanTop(c.getContext('2d'), GA.ex13.data, 0, 0, 400, o); return c.toDataURL(); })"""
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.ex13 && GA.ex13art', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.26' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate("""() => { const p = GA.app.store.get(); p.ex13 = Object.assign(p.ex13 || {}, { students: 'Keep Me' }); GA.app.store.save(); }""")
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.ex13.load()'); time.sleep(0.5)
        H = pg.evaluate('GA.palette.ex13art.human')
        arch = b64img(pg.evaluate(MAP + '()')); legA = pg.evaluate('GA.ex13.legendItems("human").length')
        pg.evaluate('() => { GA.ex13.E().maps.human.style = "art"; GA.app.store.save(); }')
        check(pg.evaluate('GA.ex13.artOn("human") && !GA.ex13.artOn("density") && !GA.ex13.artOn("centre")'), 'switch is per topic (human on, others untouched)')
        art = b64img(pg.evaluate(MAP + '()')); art.save(f'{OUT}/human_art.png')
        check(sum(abs(a - b2) for a, b2 in zip(ImageStat.Stat(art).mean, ImageStat.Stat(arch).mean)) > 3, 'artistic map differs from the architectural one')
        check(near(art, hexrgb(H['gold'])) > 50 and near(art, hexrgb(H['street'])) > 50 and near(art, hexrgb(H['hotel'])) > 30, 'objects drawn in the palette colours (columns, walls, hotels)')
        dk = lambda im: sum(1 for v in im.convert('L').resize((200, 200)).get_flattened_data() if v < 150)
        g0 = b64img(pg.evaluate(MAP + '({ upTo: 2, t: 0 })')); g5 = b64img(pg.evaluate(MAP + '({ upTo: 2, t: 0.5 })')); g1 = b64img(pg.evaluate(MAP + '({ upTo: 2, t: 1 })'))
        gc = lambda im: near(im, hexrgb(H['gold']), 30); check(gc(g0) < gc(g5) < gc(g1), f'columns rise gradually ({gc(g0)} < {gc(g5)} < {gc(g1)})')
        f1 = b64img(pg.evaluate(MAP + '({ focus: 1 })')); check(near(f1, hexrgb(H['gold'])) > near(f1, hexrgb(H['hotel'])), 'focus: the chosen layer stays full, the others fade')
        t0 = b64img(pg.evaluate(TOP + '()')); t2 = b64img(pg.evaluate(TOP + '({ focus: 2 })'))
        check(near(t0, hexrgb(H['res'][0])) > near(t2, hexrgb(H['res'][0])), 'top view follows focus')
        L = pg.evaluate('GA.ex13.legendItems("human").map(i => i.layer)'); check(L == list(range(6)), 'legend: six layers')
        src = ' '.join(pg.evaluate('GA.ex13.content("human").src')); check('not a real height' in src and 'Not drawn' in src, 'limits name the height scale and what is not drawn')
        lay = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("human", 100); return c.__layout; })()'); check(lay['top'] and lay['bottom'] <= lay['footerY'], f'page fits ({lay["bottom"]} <= {lay["footerY"]})')
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(1)
        check(pg.evaluate('document.querySelector("input[name=x20-style-human][value=art]").checked') and pg.evaluate('document.querySelectorAll("[data-x20player=human] .x20-chip").length') == 6, 'page: saved choice shown, player with six layers')
        pg.click('[data-x20player=human] .x20-chip[data-x20layer="3"]'); time.sleep(0.5)
        check(pg.evaluate('document.querySelector("[data-x20player=human] .x20-chip[data-x20layer=\\"3\\"]").classList.contains("on")'), 'player: clicking a layer highlights it')
        pg.click('[data-x20player=human] [data-x20play]'); time.sleep(5); check('❚❚' in pg.evaluate('document.querySelector("[data-x20player=human] [data-x20play]").textContent'), 'player: plays')
        pg.locator('[data-e13="human"]').screenshot(path=f'{OUT}/player.png')
        pg.click('[data-x20player=human] [data-x20play]'); time.sleep(0.5); check('▶' in pg.evaluate('document.querySelector("[data-x20player=human] [data-x20play]").textContent'), 'player: stops')
        zb = pg.evaluate('(async () => { const bl = await GA.ex13.layersZip("human"); const u8 = new Uint8Array(await bl.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); })()')
        names = zipfile.ZipFile(io.BytesIO(base64.b64decode(zb))).namelist(); check(len(names) == 7 and names[-1].endswith('_all.png'), f'per-layer ZIP: 6 layers + all ({len(names)})')
        for lang in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            labs = pg.evaluate('GA.ex13.legendItems("human").map(i => i.label)'); check(all(l and 'x24.' not in l for l in labs), f'{lang}: legend strings present')
            r = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("human", 100); return { u: c.toDataURL("image/jpeg", .8), l: c.__layout }; })()'); b64img(r['u']).save(f'{OUT}/{lang}_human_art.jpg'); check(r['l']['bottom'] <= r['l']['footerY'], f'{lang}: page fits')
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(0.5)
        pg.click('input[name=x20-style-human][value=arch]'); time.sleep(1); pg.evaluate('GA.i18n.setLang("en")')
        arch2 = b64img(pg.evaluate(MAP + '()')); diff = sum(abs(a - b2) for a, b2 in zip(ImageStat.Stat(arch).mean, ImageStat.Stat(arch2).mean))
        check(pg.evaluate('GA.app.store.get().ex13.maps.human.style') == 'arch' and diff < 2 and pg.evaluate('GA.ex13.legendItems("human").length') == legA, f'switching back restores the architectural map ({diff:.2f})')
        check(pg.evaluate('GA.app.store.get().ex13.students') == 'Keep Me', 'saved work kept')
        check(not errs, 'no page errors', errs[:3])
        ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
