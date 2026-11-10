"""v34 — build 5.40: the identity map (Exercise 1.3 page 00) as an illustrated map: central Granada 5 × 5 km with its
landmarks drawn in 3D line at their real positions (owner request with a reference image, 10 Nov 2026).
Checks: default stays the locator map; the page-00 switch saves 'art' and the page changes; the drawing uses the studio
red and every landmark sits inside the 5 km extent; the all-artistic button switches page 00 too, the all-architectural
button switches it back; the schematic-drawing note and legend strings exist in ar / he / en; saved work is kept;
no page errors. Usage: python3 tests/ui_test_v34.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, base64, io
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import _nointro  # start on the map, not the opening page
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8834; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v34shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1]))).convert('RGB')
def reds(im): return sum(1 for p in im.resize((300, 424)).get_flattened_data() if abs(p[0] - 0x99) < 30 and abs(p[1] - 0x2B) < 30 and abs(p[2] - 0x2A) < 30)
PAGE = '(async () => { const c = await GA.ex13.pageCanvas("identity", 60); return c.toDataURL("image/png"); })()'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.ex13 && GA.ex13ident', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= "5.40" and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('''() => { const p = GA.app.store.get(); p.ex13 = Object.assign(p.ex13 || {}, { students: 'Keep Me' }); GA.app.store.save(); }''')
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.ex13.load()'); time.sleep(0.5)
        check(pg.evaluate('GA.ex13.idArt()') is False, 'default: the locator map')
        arch = img(pg.evaluate(PAGE)); arch.save(f'{OUT}/identity_arch.png')
        L = pg.evaluate('GA.ex13ident.LANDMARKS.map(m => [m.id, m.x, m.y])'); E = pg.evaluate('GA.ex13ident.EXTENT')
        check(len(L) >= 12 and all(E['x0'] < x < E['x1'] and E['y0'] < y < E['y1'] for _, x, y in L), f'{len(L)} landmarks, all inside the 5 km extent')
        # page and switch
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=180000); time.sleep(0.5)
        check(pg.evaluate('document.querySelector("input[name=x20-style-identity][value=arch]").checked'), 'page 00 switch shows architectural')
        pg.click('input[name=x20-style-identity][value=art]'); time.sleep(3)
        check(pg.evaluate('GA.app.store.get().ex13.idStyle') == 'art' and pg.evaluate('GA.ex13.idArt()'), 'switch saves the artistic identity map')
        art = img(pg.evaluate(PAGE)); art.save(f'{OUT}/identity_art.png')
        corner = lambda im: reds(im.crop((int(im.size[0] * .6), int(im.size[1] * .03), im.size[0], int(im.size[1] * .2))).resize((im.size[0], im.size[1])))
        check(corner(art) > corner(arch) + 300, f'artistic page: the information written in red in the top end corner ({corner(arch)} → {corner(art)} red pixels)')
        D = sum(abs(a - b2) for a, b2 in zip(arch.convert('L').resize((100, 141)).get_flattened_data(), art.convert('L').resize((100, 141)).get_flattened_data()))
        check(D > 50000, f'artistic page differs from the locator page (difference {D})')
        pg.locator('[data-e13="identity"]').screenshot(path=f'{OUT}/preview.png')
        # all-architectural / all-artistic buttons
        pg.click('[data-x31all="arch"]'); time.sleep(4)
        check(pg.evaluate('GA.app.store.get().ex13.idStyle') == 'arch' and pg.evaluate('document.querySelector("input[name=x20-style-identity][value=arch]").checked'), 'all-architectural button switches page 00 back')
        pg.click('[data-x31all="art"]'); time.sleep(6)
        check(pg.evaluate('GA.app.store.get().ex13.idStyle') == 'art' and all(pg.evaluate(f'GA.ex13.artOn("{k}")') for k in ['density', 'morphology', 'centre', 'climate', 'human']), 'all-artistic button switches page 00 and the five maps')
        for lang in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            ks = ['x32.styleHint', 'x32.note', 'x32.lg.streets', 'x32.lg.rivers', 'x32.lg.hills', 'x32.lg.city', 'x32.lg.landmarks']
            check(all(not pg.evaluate(f'GA.i18n.t("{k}")').startswith('x32.') for k in ks) and 'schematic' not in (pg.evaluate('GA.i18n.t("x32.note")') if lang != 'en' else ''), f'{lang}: strings present')
            img(pg.evaluate(PAGE)).save(f'{OUT}/identity_art_{lang}.png')
        check(pg.evaluate('GA.app.store.get().ex13.students') == 'Keep Me', 'saved work kept')
        check(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'no horizontal overflow')
        check(not errs, 'no page errors', errs[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
