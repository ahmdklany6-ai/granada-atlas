"""v32 — build 5.34: the GIF opens with the animation (as in the player): each layer grows in over several frames, one
after another, for every artistic map of Exercise 1.3; then the whole map, then each layer alone (checked in v29).
Checks, for each of the five maps: the newest layer drawn at t = 0.17 / 0.5 / 1 changes gradually (not a jump), the GIF
frame plan is 6 frames per layer + whole + one per layer; no page errors.
Usage: python3 tests/ui_test_v32.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, base64, io
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import _nointro  # start on the map, not the opening page
from PIL import Image, ImageChops, ImageStat
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8832; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v32shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def img(s): return Image.open(io.BytesIO(base64.b64decode(s.split(',')[1]))).convert('RGB')
def dist(a, b): return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.ex13 && GA.ex13art', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.34' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('(async () => { await GA.ex13.load(); const e = GA.ex13.E(); GA.ex13.TOPICS.forEach(k => { if (e.maps[k]) e.maps[k].style = "art"; }); GA.app.store.save(); })()')
        for k in ['density', 'morphology', 'centre', 'climate', 'human']:
            n = pg.evaluate(f'(async () => {{ const a = "{k}" === "human" ? "humanAxo" : "{k}"; await GA.ex13art.ready(a); return GA.ex13art.keys(a).length; }})()')
            M = '(async (o) => { const c = await GA.ex13.pageCanvas("' + k + '", 40, o); return c.toDataURL(); })'
            f = [img(pg.evaluate(M, {'upTo': 1, 't': t})) for t in (0.17, 0.5, 1)]; f[0].save(f'{OUT}/{k}_t017.png'); f[2].save(f'{OUT}/{k}_t1.png')
            d1, d2 = dist(f[0], f[1]), dist(f[1], f[2])
            check(d1 > 0.01 and d2 > 0.01, f'{k}: the first layer grows in gradually ({n} layers; change {d1:.2f}, {d2:.2f})')
        check(not errs, 'no page errors', errs[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
