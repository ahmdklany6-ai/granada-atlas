"""v19 — build 5.21: the "Southern axis" page (#/south) with the team's two boards.
Checks: nav button in ar/he/en; both boards load in the interface language (data/boards/south_<id>_<lang>.jpg, real pixels);
"Open large" opens the image viewer; "Show on the map" closes the page, keeps/turns the layers on and frames the axis;
the download link points at the same file; panels stay closed; no page errors.
Usage: python3 tests/ui_test_v19.py  (OUT=/dir)"""
import sys, os, time, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _nointro  # 5.27: start on the map, not the opening page
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8819; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v19shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
for b in ('escuzar', 'metro_tram'):
    for l in ('ar', 'he', 'en'):
        f = os.path.join(ROOT, 'data', 'boards', f'south_{b}_{l}.jpg'); check(os.path.exists(f) and os.path.getsize(f) > 200000, f'board file {b} {l}')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.pages && GA.southPage', timeout=90000); time.sleep(1)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.21' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        for lang in ('ar', 'he', 'en'):
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4)
            btn = pg.locator('.tb-btn[data-page="south"]'); check(btn.count() == 1 and btn.inner_text().strip() == pg.evaluate('GA.i18n.t("v19.nav")'), f'{lang}: nav button')
            btn.evaluate("e => e.click()"); pg.wait_for_function('document.querySelectorAll(".sb-board img").length === 2', timeout=20000)
            pg.wait_for_function('[...document.querySelectorAll(".sb-board img")].every(i => i.complete && i.naturalWidth > 3000)', timeout=60000)
            srcs = pg.evaluate('[...document.querySelectorAll(".sb-board img")].map(i => i.getAttribute("src"))')
            check(all(f'_{lang}.jpg' in s for s in srcs), f'{lang}: boards in the interface language', srcs)
            dl = pg.evaluate('[...document.querySelectorAll("[data-sb=dl]")].map(a => a.getAttribute("href"))'); check(dl == srcs, f'{lang}: download links = shown files')
            check('v19.' not in pg.inner_text('#page'), f'{lang}: no missing strings')
            pg.screenshot(path=os.path.join(OUT, f'south_page_{lang}.png'))
            pg.click('.sb-board[data-board="escuzar"] .sb-img'); time.sleep(1)
            check(pg.evaluate('!!(GA.lastViewer && GA.lastViewer.kind === "image") && !!document.querySelector(".vw-imgstage img")'), f'{lang}: board opens large')
            pg.keyboard.press('Escape'); time.sleep(0.5)
            pg.evaluate('GA.pages.close()'); time.sleep(0.4)
        pg.evaluate('GA.i18n.setLang("ar"); GA.app.L.setOn("escuzar_pole", false)'); time.sleep(0.4)
        pg.evaluate('document.querySelector(\'.tb-btn[data-page="south"]\').click()'); pg.wait_for_selector('.sb-board[data-board="escuzar"] [data-sb=map]')
        pg.click('.sb-board[data-board="escuzar"] [data-sb=map]'); time.sleep(2.5)
        check(pg.evaluate('!GA.pages.current'), 'Show on the map closes the page')
        check(pg.evaluate('GA.app.L.S.escuzar_pole.on && GA.app.L.S.south_metro.on'), 'Show on the map switches the board layers on')
        bb = pg.evaluate('GA.app.map.getBounds().toArray()'); check(bb[0][0] < -3.79 and bb[1][0] > -3.60, 'Show on the map frames the axis', bb)
        check(not any(pg.evaluate('["analysis","study","layers"].map(k => GA.panels.isOpen(k))')), 'panels stay closed')
        check(not errs, 'no page errors', errs[:3]); b.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)))
sys.exit(1 if fails else 0)
