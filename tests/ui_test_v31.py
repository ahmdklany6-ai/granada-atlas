"""v31 — build 5.33: Exercise 1.3 — one button turns all five maps artistic (or architectural); the human dimension has
one artistic version (the axonometric drawing); the climate map is the approved stack of four layers draped on the terrain.
Usage: python3 tests/ui_test_v31.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, base64, io
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
import _nointro
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8831; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v31shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def b64img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1]))).convert('RGB')
T = ['density', 'morphology', 'centre', 'climate', 'human']
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script('window.__noPanelHook = true; window.__noIntro = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html?nointro'); pg.wait_for_function('window.GA && GA.app && GA.ex13', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.33' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('() => { const p = GA.app.store.get(); p.ex13 = Object.assign(p.ex13 || {}, { students: "Keep Me" }); const e = GA.ex13.E(); ["density","morphology","centre","climate","human"].forEach(k => e.maps[k].style = "arch"); GA.app.store.save(); }')
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(1)
        check(pg.evaluate('document.querySelectorAll("input[name=x20-style-human]").length') == 2, 'human: two choices only (architectural / artistic)')
        check(pg.locator('[data-x31all="art"]').count() == 1 and pg.locator('[data-x31all="arch"]').count() == 1, 'buttons "All maps artistic" / "All maps architectural" present')
        pg.click('[data-x31all="art"]'); pg.wait_for_function('[...document.querySelectorAll("[data-x20player]")].every(e => !e.hidden)', timeout=240000); time.sleep(1)
        st = pg.evaluate('(() => { const e = GA.app.store.get().ex13.maps; return ["density","morphology","centre","climate","human"].map(k => e[k].style); })()')
        check(st == ['art'] * 5 and all(pg.evaluate(f'GA.ex13.artOn("{k}")') for k in T), f'all five maps artistic and saved {st}')
        check(all(pg.evaluate(f'document.querySelector("input[name=x20-style-{k}][value=art]").checked') for k in T), 'every switch shows Artistic')
        check(pg.evaluate('GA.ex13art.keys("climate").join()') == 'terrain,veg,built,heat', 'climate: the four draped layers')
        r = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("climate", 100); return { u: c.toDataURL("image/jpeg", .8), l: c.__layout }; })()'); im = b64img(r['u']); im.save(f'{OUT}/climate.jpg')
        check(r['l']['bottom'] <= r['l']['footerY'], 'climate page fits'); check(any('south-west' in s for s in pg.evaluate('GA.ex13.content("climate").src')), 'climate limits explain the view')
        r = pg.evaluate('(async () => { const c = await GA.ex13.pageCanvas("human", 100); return c.toDataURL("image/jpeg", .8); })()'); b64img(r).save(f'{OUT}/human.jpg')
        check(pg.evaluate('GA.ex13.legendItems("human").length') == 6, 'human artistic = the axonometric drawing (six objects)')
        pg.evaluate('() => { GA.ex13.E().maps.human.style = "art"; }'); check(pg.evaluate('GA.ex13.legendItems("human").length') == 6, 'an older saved "art" on human also opens the axonometric drawing')
        pg.screenshot(path=f'{OUT}/page.png')
        pg.click('[data-x31all="arch"]'); time.sleep(4)
        st = pg.evaluate('(() => { const e = GA.app.store.get().ex13.maps; return ["density","morphology","centre","climate","human"].map(k => e[k].style); })()'); check(st == ['arch'] * 5, f'all maps back to architectural {st}')
        for lang in ['ar', 'he']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); check(all(not pg.evaluate(f'GA.i18n.t("{k}")').startswith('x') for k in ['x31.allArt', 'x31.allArch', 'x25.k.heat', 'x25.lg.terrain']), f'{lang}: strings present')
        check(pg.evaluate('GA.app.store.get().ex13.students') == 'Keep Me', 'saved work kept')
        check(not errs, 'no page errors', errs[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
