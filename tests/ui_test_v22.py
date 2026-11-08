"""v22 — build 5.24: Exercise 1.3 density in the artistic map language (needles per 100 m cell seen from the south-west,
five colour classes from the palette, a top view of the same cells beside the legend).
Checks: per-topic switch (density on, others untouched); needles = every inhabited 100 m cell inside the frame, classes
by palette breaks, counts add up; the drawing is not the architectural map; build-up raises the needles gradually; focus
fades the other classes; the top view follows focus; legend = 9 layers with needle swatches in the palette colours;
residents-by-class bar uses the same colours; page fits (nothing below the footer); player plays / highlights / stops for
density; PNG per layer ZIP (9 + all); ar / he / en strings; switching back restores the architectural map; saved work kept.
Usage: python3 tests/ui_test_v22.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, base64, io, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8822; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v22shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def b64img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1]))).convert('RGB')
def hexrgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def near(im, rgb, tol=12): return sum(1 for p in im.get_flattened_data() if abs(p[0] - rgb[0]) <= tol and abs(p[1] - rgb[1]) <= tol and abs(p[2] - rgb[2]) <= tol)
MAP = """(async (o) => { await GA.ex13.load(); await GA.ex13art.ready("density"); const c = document.createElement('canvas'); c.width = c.height = 800; GA.ex13.drawMap('density', c.getContext('2d'), 0, 0, 800, o); return c.toDataURL(); })"""
TOP = """(async (o) => { await GA.ex13art.ready("density"); const c = document.createElement('canvas'); c.width = c.height = 400; GA.ex13art.drawDensityTop(c.getContext('2d'), GA.ex13.data, 0, 0, 400, o); return c.toDataURL(); })"""
den = json.load(open(os.path.join(ROOT, 'data/ex13/density.json')))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.ex13 && GA.ex13art', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.24' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate("""() => { const p = GA.app.store.get(); p.ex13 = Object.assign(p.ex13 || {}, { students: 'Keep Me' }); GA.app.store.save(); }""")
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.ex13.load()'); time.sleep(0.5)
        PAL = pg.evaluate('GA.palette.ex13art')
        check(len(PAL['needles']) == 5 and len(set(PAL['needles'])) == 5 and PAL['needleBreaks'] == [5000, 10000, 20000, 30000], 'palette: five distinct needle colours and their breaks')
        arch = b64img(pg.evaluate(MAP + '()')); legA = pg.evaluate('GA.ex13.legendItems("density").length')
        pg.evaluate('() => { GA.ex13.E().maps.density.style = "art"; GA.app.store.save(); }')
        check(pg.evaluate('GA.ex13.artOn("density") && !GA.ex13.artOn("centre") && !GA.ex13.artOn("morphology")'), 'switch is per topic (density on, others untouched)')
        st = pg.evaluate('(async () => { await GA.ex13art.ready("density"); const d = GA.ex13art.densityStats(GA.ex13.data); return { n: d.list.length, count: d.count, top: d.top.v, ks: [...new Set(d.list.map(x => x.k))].sort() }; })()')
        inh = sum(1 for row in den['pop'] for v in row if v and v > 0)
        check(0 < st['n'] <= inh and sum(st['count']) == st['n'] and st['ks'] == [0, 1, 2, 3, 4], f'needles: {st["n"]} inhabited cells inside the frame (of {inh}), five classes, counts add up {st["count"]}')
        check(abs(st['top'] - den['stats']['peak']) < 1, f'tallest needle = the peak cell ({st["top"]:.0f} vs {den["stats"]["peak"]})')
        art = b64img(pg.evaluate(MAP + '()')); art.save(f'{OUT}/density_art.png')
        check(sum(abs(a - b2) for a, b2 in zip(ImageStat.Stat(art).mean, ImageStat.Stat(arch).mean)) > 5, 'artistic map differs from the architectural one')
        check(all(near(art, hexrgb(c)) > 30 for c in PAL['needles'][:4]), 'needles drawn in the palette class colours')
        dk = lambda im: sum(1 for v in im.convert('L').resize((200, 200)).get_flattened_data() if v < 150)
        g0 = b64img(pg.evaluate(MAP + '({ upTo: 6, t: 0 })')); g5 = b64img(pg.evaluate(MAP + '({ upTo: 6, t: 0.5 })')); g1 = b64img(pg.evaluate(MAP + '({ upTo: 6, t: 1 })'))
        check(dk(g0) < dk(g5) < dk(g1), f'needles rise gradually ({dk(g0)} < {dk(g5)} < {dk(g1)})')
        f6 = b64img(pg.evaluate(MAP + '({ focus: 6 })')); check(near(f6, hexrgb(PAL['needles'][3])) > near(f6, hexrgb(PAL['needles'][2])), 'focus: the chosen class stays full, the others fade')
        t0 = b64img(pg.evaluate(TOP + '()')); t6 = b64img(pg.evaluate(TOP + '({ focus: 6 })'))
        check(near(t0, hexrgb(PAL['needles'][2])) > 200 and near(t6, hexrgb(PAL['needles'][2])) < near(t0, hexrgb(PAL['needles'][2])) / 3, 'top view: true cells in the class colours, follows focus')
        L = pg.evaluate('GA.ex13.legendItems("density").map(i => ({ layer: i.layer, n: i.needles || null }))')
        check([i['layer'] for i in L] == list(range(9)) and [i['n'] for i in L[3:8]] == PAL['needles'], 'legend: nine layers, needle swatches in the palette colours')
        c = pg.evaluate('GA.ex13.content("density")'); check([x['col'] for x in c['chart']] == PAL['needles'] and 'south-west' in ' '.join(c['src']), 'residents-by-class bar in the needle colours; limits explain the view')
        lay = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("density", 100); return c.__layout; })()')
        check(lay['top'] and lay['bottom'] <= lay['footerY'], f'page: top view placed, nothing below the footer ({lay["bottom"]} <= {lay["footerY"]})')
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(1)
        check(pg.evaluate('document.querySelector("input[name=x20-style-density][value=art]").checked'), 'page: switch shows the saved choice')
        check(pg.evaluate('!document.querySelector("[data-x20player=density]").hidden && document.querySelectorAll("[data-x20player=density] .x20-chip").length') == 9, 'player: nine layer buttons')
        pg.click('[data-x20player=density] .x20-chip[data-x20layer="5"]'); time.sleep(0.5)
        check(pg.evaluate('document.querySelector("[data-x20player=density] .x20-chip[data-x20layer=\\"5\\"]").classList.contains("on")'), 'player: clicking a layer highlights it')
        pg.click('[data-x20player=density] [data-x20play]'); time.sleep(6); check('❚❚' in pg.evaluate('document.querySelector("[data-x20player=density] [data-x20play]").textContent'), 'player: plays')
        pg.locator('[data-e13="density"]').screenshot(path=f'{OUT}/player.png')
        pg.click('[data-x20player=density] [data-x20play]'); time.sleep(0.5); check('▶' in pg.evaluate('document.querySelector("[data-x20player=density] [data-x20play]").textContent'), 'player: stops')
        zb = pg.evaluate('(async () => { const bl = await GA.ex13.layersZip("density"); const u8 = new Uint8Array(await bl.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); })()')
        z = zipfile.ZipFile(io.BytesIO(base64.b64decode(zb))); names = z.namelist(); check(len(names) == 10 and names[-1].endswith('_all.png'), f'per-layer ZIP: 9 layers + all ({len(names)})')
        for lang in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            labs = pg.evaluate('GA.ex13.legendItems("density").map(i => i.label)'); check(all(l and 'x22.' not in l for l in labs), f'{lang}: legend strings present')
            r = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("density", 100); return { u: c.toDataURL("image/jpeg", .8), l: c.__layout }; })()'); b64img(r['u']).save(f'{OUT}/{lang}_density_art.jpg'); check(r['l']['bottom'] <= r['l']['footerY'], f'{lang}: page fits')
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(0.5)
        pg.click('input[name=x20-style-density][value=arch]'); time.sleep(1); pg.evaluate('GA.i18n.setLang("en")')
        arch2 = b64img(pg.evaluate(MAP + '()')); diff = sum(abs(a - b2) for a, b2 in zip(ImageStat.Stat(arch).mean, ImageStat.Stat(arch2).mean))
        check(pg.evaluate('GA.app.store.get().ex13.maps.density.style') == 'arch' and diff < 2 and pg.evaluate('GA.ex13.legendItems("density").length') == legA, f'switching back restores the architectural map and legend ({diff:.2f})')
        check(pg.evaluate('GA.app.store.get().ex13.students') == 'Keep Me', 'saved work kept')
        check(not errs, 'no page errors', errs[:3])
        ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
