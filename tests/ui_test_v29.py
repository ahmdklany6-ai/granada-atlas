"""v29 — build 5.31: the map's bottom-left group (owner request).
  - the north arrow sits to the RIGHT of the scale bar in every language (not mirrored), gap 4–10 px, bottoms within 1 px;
  - the arrow glyph is centred in its box: triangle horizontal centre and the glyph (triangle + "N") centre = box centre
    within 1 px, at device scale 1 and 2;
  - the group never overlaps the atlas panel (open / folded / phone sheet), the tour card ("Step 1 of 3") or the
    attribution.
Widths 375, 390, 768, 1024, 1280, 1440 px in ar / he / en.  Usage: python3 tests/ui_test_v29.py (OUT=/dir)"""
import sys, os, time, subprocess, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
import _nointro
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8829
OUT = os.environ.get('OUT', '/tmp/v29shots'); os.makedirs(OUT, exist_ok=True)
WIDTHS = [375, 390, 768, 1024, 1280, 1440]; H = {375: 812, 390: 844, 768: 1024, 1024: 768, 1280: 800, 1440: 900}
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def stub(pg):
    def route(r):
        u = r.request.url
        if u.startswith(f'http://127.0.0.1:{PORT}/'): return r.continue_()
        if u.rstrip('/').endswith('/planet'): return r.fulfill(json={'tilejson': '3.0.0', 'tiles': ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14})
        if 'fonts.googleapis.com' in u: return r.fulfill(status=200, body='', content_type='text/css')
        return r.fulfill(status=404, body='')
    pg.route('**/*', route)
GEOM = r'''() => { const R = (e) => { if (!e || !e.offsetWidth || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; };
  const box = document.querySelector('.ga-north'); const cs = box ? getComputedStyle(box) : null; const bw = cs ? parseFloat(cs.borderLeftWidth) : 0;
  const inner = box ? (() => { const r = box.getBoundingClientRect(); return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; })() : null;
  const SR = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; }; // SVG parts: geometry boxes
  const tri = SR(document.querySelector('.ga-north .ga-n-tri')), nn = SR(document.querySelector('.ga-north .ga-n-n')), svg = SR(document.querySelector('.ga-north svg'));
  const glyph = tri && nn ? { cx: (Math.min(tri.l, nn.l) + Math.max(tri.r, nn.r)) / 2, cy: (Math.min(tri.t, nn.t) + Math.max(tri.b, nn.b)) / 2 } : null;
  return { north: R(box), scale: R(document.querySelector('.maplibregl-ctrl-scale')), inner, tri, glyph, svg, panel: R(document.querySelector('#atl-panel')), tour: R(document.querySelector('#tour-card')),
    attr: R(document.querySelector('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib')), stage: R(document.querySelector('.stage')) }; }'''
def ov(a, b):
    return bool(a and b and a['l'] < b['r'] and b['l'] < a['r'] and a['t'] < b['b'] and b['t'] < a['b'])
def judge(G, tag):
    n, s = G['north'], G['scale']
    check(n and s and n['l'] >= s['r'] and 4 <= n['l'] - s['r'] <= 10, f'{tag}: the north arrow is to the right of the scale bar, gap {n and s and round(n["l"] - s["r"], 1)} px', (n, s))
    check(n and s and abs(n['b'] - s['b']) <= 1, f'{tag}: bottoms aligned ({n and s and round(n["b"] - s["b"], 2)} px)')
    c, g, tr = G['inner'], G['glyph'], G['tri']
    check(c and g and tr and abs(tr['cx'] - c['cx']) <= 1 and abs(g['cx'] - c['cx']) <= 1 and abs(g['cy'] - c['cy']) <= 1, f'{tag}: the arrow glyph is centred in its box (dx {c and tr and round(tr["cx"] - c["cx"], 2)}, dy {c and g and round(g["cy"] - c["cy"], 2)} px)', (c, g, tr))
    hits = [k for k in ('panel', 'tour', 'attr') if ov(n, G[k]) or ov(s, G[k])]
    check(not hits, f'{tag}: the group overlaps nothing (panel, tour card, attribution)', hits)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(w, lang, dsf=1, init=''):
            mob = w < 700; ctx = b.new_context(viewport={'width': w, 'height': H[w]}, device_scale_factor=dsf, is_mobile=mob, has_touch=mob)
            ctx.add_init_script(f"window.__noPanelHook = true; {init} try {{ localStorage.setItem('granada-atlas.lang', '{lang}'); }} catch (e) {{ }}")
            pg = ctx.new_page(); stub(pg); errs = []; pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append(str(e)[:200]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready', timeout=120000); time.sleep(2)
            return ctx, pg, errs
        for lang in ('ar', 'he', 'en'):
            for w in WIDTHS:
                ctx, pg, errs = boot(w, lang); tag = f'{w}px {lang}'
                judge(pg.evaluate(GEOM), tag)
                pg.evaluate('document.querySelector("#atl-panel [data-atl-min]").click()'); time.sleep(0.8); judge(pg.evaluate(GEOM), tag + ' (panel folded)')
                if w in (390, 1440):
                    G = pg.evaluate(GEOM); x0 = max(0, int(G['scale']['l']) - 12); y0 = int(G['north']['t']) - 14
                    pg.screenshot(path=f'{OUT}/corner_{lang}_{w}.png', clip={'x': x0, 'y': y0, 'width': 220, 'height': int(G['north']['b'] - y0) + 12})
                check(not errs, f'{tag}: no page errors', errs[:2]); ctx.close()
        # 200 % zoom (device scale 2), and the tour's "Step 1 of 3" card
        for lang, w in (('en', 1440), ('ar', 1440), ('he', 390), ('en', 390)):
            ctx, pg, errs = boot(w, lang, dsf=2); judge(pg.evaluate(GEOM), f'{w}px {lang} @2x')
            pg.screenshot(path=f'{OUT}/zoom2_{lang}_{w}.png'); ctx.close()
        for lang, w in (('en', 1440), ('ar', 1024), ('he', 390)):
            ctx = b.new_context(viewport={'width': w, 'height': H[w]}, is_mobile=w < 700, has_touch=w < 700)
            ctx.add_init_script(f"window.__noPanelHook = true; try {{ localStorage.setItem('granada-atlas.lang', '{lang}'); }} catch (e) {{ }}")
            pg = ctx.new_page(); stub(pg); pg.goto(f'http://127.0.0.1:{PORT}/index.html#/tour/1'); pg.wait_for_function('GA.tour && GA.tour.state.built && GA.tour.state.step === 1', timeout=120000); time.sleep(3)
            G = pg.evaluate(GEOM); check(G['tour'] is not None, f'{w}px {lang} tour: "Step 1 of 3" card shown'); judge(G, f'{w}px {lang} tour step 1')
            pg.screenshot(path=f'{OUT}/tour_{lang}_{w}.png'); ctx.close()
        b.close()
finally:
    srv.terminate()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED:\n  ' + '\n  '.join(fails))
sys.exit(1 if fails else 0)
