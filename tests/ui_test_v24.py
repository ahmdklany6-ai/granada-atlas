"""v24 — build 5.26 fixes, one section per item:
  1. no letter-spacing / upper-casing on Arabic or Hebrew text (CSS everywhere + map labels).
Usage: python3 tests/ui_test_v24.py  (OUT=/dir)  [items: ITEMS=1,2,... to run a subset]"""
import sys, os, time, json, subprocess, warnings
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8824; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v24shots'); os.makedirs(OUT, exist_ok=True)
ITEMS = set((os.environ.get('ITEMS') or '1,2,3,4').split(','))
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)

# every element whose OWN text contains Arabic / Hebrew letters; its computed letter-spacing and text-transform
SPACED = r'''(re) => { const R = new RegExp(re); const bad = [];
  document.querySelectorAll('body *').forEach(e => { if (!e.offsetWidth && !e.offsetHeight) return;
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(); if (!own || !R.test(own)) return;
    const cs = getComputedStyle(e); const ls = cs.letterSpacing;
    if (!(ls === 'normal' || parseFloat(ls) === 0) || cs.textTransform !== 'none') bad.push((e.id || e.className || e.tagName) + ': ' + ls + ' ' + cs.textTransform + ' «' + own.slice(0, 20) + '»'); });
  return bad; }'''
AR, HE = '[؀-ۿ]', '[֐-׿]'

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(vp, mobile=False, lang='en'):
            ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile); ctx.add_init_script('window.__noPanelHook = true; window.__gaLegacyView = false;'); pg = ctx.new_page(); V3.stub3(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready', timeout=120000); time.sleep(1.5)
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.6)
            return ctx, pg, errs
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']
        # ---------- 1. letter-spacing ----------
        if '1' in ITEMS:
            for lang, RE in [('ar', AR), ('he', HE), ('en', AR)]:
                ctx, pg, errs = boot({'width': 1440, 'height': 900}, False, lang)
                states = [('start', None), ('menu', 'document.querySelector("#atl-burger").click()'), ('topic', 'document.querySelector("#atl-side-x").click(); GA.atlas.setTopic("density")'),
                          ('metro', 'GA.atlas.setArea("metro")'), ('panels', 'GA.panels.set("analysis", true); GA.panels.set("study", true)'),
                          ('ex13', 'GA.panels.set("analysis", false); GA.panels.set("study", false); GA.pages.go("ex13")'), ('history', 'GA.pages.go("history")'), ('south', 'GA.pages.go("south")')]
                for name, js in states:
                    if js: pg.evaluate(js); time.sleep(2.5 if name in ('ex13', 'history', 'south', 'topic', 'metro') else 0.6)
                    bad = pg.evaluate(SPACED, RE)
                    check(not bad, f'{lang} {name}: no letter-spacing / upper-casing on {"Arabic" if RE == AR else "Hebrew"} text', bad[:4])
                if lang != 'en':
                    pg.evaluate('GA.pages.close()'); time.sleep(0.5)
                    ls = pg.evaluate('["label-sea", "label-country"].map(id => GA.app.map.getLayoutProperty(id, "text-letter-spacing"))')
                    check(all(v == 0 for v in ls), f'{lang}: map sea / country names without tracking {ls}')
                    if lang == 'ar': pg.screenshot(path=f'{OUT}/i1_ar_panel.png')
                check(not errs, f'{lang}: no page errors', errs[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
