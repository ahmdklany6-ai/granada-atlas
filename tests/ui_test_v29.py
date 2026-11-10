"""v29 — build 5.31: the layer animation plays inside the large viewer and downloads as a GIF; the build-up comes first
(layers appear one after another, then the whole map), then each layer alone with the others faded.
For each artistic map (density here; the same code serves all five): open large → Play shows progress, then the viewer
image becomes an animated GIF (several frames, loops) that stays zoomable; Stop returns to the still page; "Animated GIF"
downloads the same GIF without making it again; architectural maps have no Play button; ar / he / en strings.
Usage: python3 tests/ui_test_v26.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, io
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8829; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v29shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.ex13', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.31' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        for lang in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); check(all(not pg.evaluate(f'GA.i18n.t("{k}")').startswith('x29.') for k in ['x29.play', 'x29.stop', 'x29.making']), f'{lang}: strings present')
        pg.evaluate('() => { const e = GA.ex13.E(); e.maps.density.style = "art"; e.maps.centre.style = "arch"; GA.app.store.save(); }')
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(1)
        pg.click('[data-e13open="centre"]'); pg.wait_for_selector('.vw-stage img', timeout=60000); time.sleep(0.5)
        check(pg.locator('[data-vtool="play"]').count() == 0, 'architectural map: no Play button'); pg.keyboard.press('Escape'); time.sleep(0.8)
        pg.click('[data-e13open="density"]'); pg.wait_for_selector('[data-vtool="play"]', timeout=60000); time.sleep(0.5)
        still = pg.evaluate('document.querySelector(".vw-stage img").src')
        pg.click('[data-vtool="play"]'); time.sleep(1.5); prog = pg.evaluate('document.querySelector("[data-vtool=play]").textContent')
        check('/' in prog, f'Play shows progress while the animation is made ({prog})')
        pg.wait_for_function('document.querySelector(".vw-stage img").src !== ' + json.dumps(still), timeout=600000); time.sleep(1)
        src = pg.evaluate('document.querySelector(".vw-stage img").src')
        data = pg.evaluate('(async (u) => { const b = await (await fetch(u)).arrayBuffer(); return Array.from(new Uint8Array(b)); })', src)
        im = Image.open(io.BytesIO(bytes(data))); n = getattr(im, 'n_frames', 1)
        check(im.format == 'GIF' and n >= 10 and im.info.get('loop') == 0 and im.size[0] >= 900, f'viewer shows an animated GIF ({im.format}, {n} frames, {im.size}, loop {im.info.get("loop")})')
        durs = []
        for i in range(n): im.seek(i); durs.append(im.info.get('duration'))
        kk = (n - 1) // 2
        check(durs[:kk] == [900] * kk and durs[kk] == 2600 and durs[kk + 1:] == [1400] * kk, f'order: build-up first, whole map, then each layer alone ({durs})')
        im.seek(0); f0 = sum(1 for v in im.convert('L').resize((200, 280)).get_flattened_data() if v < 200); im.seek(kk); fa = sum(1 for v in im.convert('L').resize((200, 280)).get_flattened_data() if v < 200)
        check(f0 < fa, f'the first frame shows one layer, the build-up frame the whole map ({f0} < {fa})')
        check('❚❚' in pg.evaluate('document.querySelector("[data-vtool=play]").textContent'), 'button turns into Stop')
        pg.click('[data-z="in"]'); time.sleep(0.3); check(pg.evaluate('document.querySelector(".vw-stage img").style.transform') != '', 'the playing GIF stays zoomable')
        pg.screenshot(path=f'{OUT}/viewer_playing.png')
        t0 = time.time()
        with pg.expect_download(timeout=60000) as dl: pg.click('[data-vtool="gif"]')
        took = time.time() - t0; got = open(dl.value.path(), 'rb').read()
        check(got == bytes(data) and took < 5, f'Animated GIF downloads the same file without making it again ({took:.1f} s, {len(got)} bytes)')
        pg.click('[data-vtool="play"]'); time.sleep(0.5)
        check(pg.evaluate('document.querySelector(".vw-stage img").src') == still and '▶' in pg.evaluate('document.querySelector("[data-vtool=play]").textContent'), 'Stop returns to the still page')
        check(not errs, 'no page errors', errs[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
