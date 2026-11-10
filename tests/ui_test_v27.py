"""v27 — build 5.29: the main map screen (owner request with an annotated screenshot) and the model workshop preset.
  1. no zoom + / − buttons; the + / − keys (and wheel / pinch / double-click) still zoom.
  2. "A–B Draw section" and "3D" in one row in the top-right corner of the map, right under the top chrome, clear of the
     legend, the ☰ button and menu, the atlas panel, the language buttons and the topic row (bounding boxes).
  3. the north arrow sits beside the scale bar in the bottom-left corner (one group), never under the atlas panel
     (open, folded, phone bottom sheet).
  4. three language buttons always visible in the top bar; switching keeps the map view, the area, the topic and the open
     panels; the Display section's language buttons still work (one state).
  5. the five analyses (+ "no topic") always on screen, menu closed and open; the current one marked; they set the topic.
  6. model workshop (40 × 40 cm): the scale is the next standard scale (1:379 → 1:500); every exported sheet has that
     same scale; A3 landscape pages; the model outline measures 400 mm on paper (plan, aerial) and the section is drawn at
     the same scale (horizontal = vertical).
Widths 375, 390, 768, 1024, 1280, 1440 px in ar / he / en.
Usage: python3 tests/ui_test_v27.py  (OUT=/dir)  [ITEMS=1,2,3,4,5,6]"""
import sys, os, time, json, subprocess, warnings, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
import _nointro
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8827
OUT = os.environ.get('OUT', '/tmp/v27shots'); os.makedirs(OUT, exist_ok=True)
ITEMS = set((os.environ.get('ITEMS') or '1,2,3,4,5,6').split(','))
WIDTHS = [375, 390, 768, 1024, 1280, 1440]; H = {375: 812, 390: 844, 768: 1024, 1024: 768, 1280: 800, 1440: 900}
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
from PIL import Image
_b = io.BytesIO(); Image.new('RGB', (64, 64), (120, 140, 110)).save(_b, 'JPEG'); JPG = _b.getvalue()
def stub(pg):
    def route(r):
        u = r.request.url
        if u.startswith(f'http://127.0.0.1:{PORT}/'): return r.continue_()
        if u.rstrip('/').endswith('/planet'): return r.fulfill(json={'tilejson': '3.0.0', 'tiles': ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14})
        if 'ign.es/wms-inspire/pnoa-ma' in u: return r.fulfill(status=200, body=JPG, content_type='image/jpeg', headers={'Access-Control-Allow-Origin': '*'})
        if 'fonts.googleapis.com' in u: return r.fulfill(status=200, body='', content_type='text/css')
        return r.fulfill(status=404, body='')
    pg.route('**/*', route)

BOXES = r'''() => { const R = (s) => { const e = typeof s === 'string' ? document.querySelector(s) : s; if (!e || !e.offsetWidth || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  return { sec: R('#map-draw-section'), d3: R('.ga-3dctl'), ctl: R('.maplibregl-ctrl-top-right'), map: R('#map'), stage: R('.stage'), top: R('.topbar'), legend: R('#legend'), burger: R('#atl-burger'), side: R('#atl-side'),
    panel: R('#atl-panel'), lang: R('#tb-lang'), topics: R('#atl-topics'), back: R('#atl-back'), north: R('.ga-north'), scale: R('.maplibregl-ctrl-scale'), brand: R('.brand-name'),
    zoom: document.querySelectorAll('.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-zoom-out').length, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth }; }'''
def ov(a, b, pad=0):
    return bool(a and b and a['l'] < b['r'] - pad and b['l'] < a['r'] - pad and a['t'] < b['b'] - pad and b['t'] < a['b'] - pad)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(w, lang, mobile=None, downloads=False):
            mob = w < 700 if mobile is None else mobile
            ctx = b.new_context(viewport={'width': w, 'height': H.get(w, 900)}, is_mobile=mob, has_touch=mob, accept_downloads=downloads)
            ctx.add_init_script(f"window.__noPanelHook = true; try {{ if (!sessionStorage.getItem('v27')) {{ sessionStorage.setItem('v27', '1'); localStorage.setItem('granada-atlas.lang', '{lang}'); }} }} catch (e) {{ }}")
            pg = ctx.new_page(); stub(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready', timeout=120000); time.sleep(2)
            return ctx, pg, errs

        if ITEMS & {'1', '2', '3', '4', '5'}:
            for lang in ('ar', 'he', 'en'):
                for w in WIDTHS:
                    ctx, pg, errs = boot(w, lang); tag = f'{w}px {lang}'; B = pg.evaluate(BOXES)
                    # 1. no zoom buttons
                    if '1' in ITEMS:
                        check(B['zoom'] == 0, f'{tag}: no zoom + / − buttons')
                    # 2. section + 3D top-right, one row, clear of everything
                    if '2' in ITEMS:
                        s, d, st = B['sec'], B['d3'], B['stage']
                        row = s and d and abs(s['t'] - d['t']) < 4 and abs(s['b'] - d['b']) < 6
                        corner = s and d and st['r'] - max(s['r'], d['r']) <= 16 and min(s['t'], d['t']) - st['t'] <= 16 and min(s['t'], d['t']) >= st['t'] - 1
                        check(row and corner, f'{tag}: Draw section and 3D side by side in the top-right corner, under the top chrome', (s, d, st))
                        hits = [k for k in ('legend', 'burger', 'panel', 'lang', 'topics', 'back', 'top') if any(ov(x, B[k]) for x in (s, d))]
                        check(not hits and not ov(s, d), f'{tag}: Draw section / 3D overlap nothing (legend, ☰, panel, languages, topics, Back)', hits)
                    # 3. north arrow beside the scale bar, bottom-left, clear of the panel
                    if '3' in ITEMS:
                        n, sc, st = B['north'], B['scale'], B['stage']
                        side = n and sc and (abs(n['r'] - sc['l']) <= 12 or abs(sc['r'] - n['l']) <= 12) and n['t'] < sc['b'] and sc['t'] < n['b']
                        check(side and min(n['l'], sc['l']) - st['l'] <= 20, f'{tag}: north arrow beside the scale bar, bottom-left', (n, sc))
                        check(not ov(n, B['panel']) and not ov(sc, B['panel']) and n['b'] <= st['b'] + 1, f'{tag}: north arrow and scale bar not under the atlas panel', (n, sc, B['panel']))
                        pg.evaluate('document.querySelector("#atl-panel [data-atl-min]") && document.querySelector("#atl-panel [data-atl-min]").click()'); time.sleep(0.8)
                        B2 = pg.evaluate(BOXES); check(not ov(B2['north'], B2['panel']) and not ov(B2['scale'], B2['panel']), f'{tag}: … nor under the folded panel', (B2['north'], B2['panel']))
                        pg.evaluate('document.querySelector("#atl-panel [data-atl-min]") && document.querySelector("#atl-panel [data-atl-min]").click()'); time.sleep(0.5)
                    # 4/5. top bar: language buttons and topic row; no overlaps, no horizontal scroll
                    if '4' in ITEMS or '5' in ITEMS:
                        top = B['top']; parts = {k: B[k] for k in ('burger', 'brand', 'lang')}
                        if w >= 1200: parts['topics'] = B['topics']
                        clash = [f'{a}/{c}' for i, a in enumerate(parts) for c in list(parts)[i + 1:] if ov(parts[a], parts[c], 0.5)]
                        check(not clash and B['sw'] <= B['vw'] + 1, f'{tag}: top bar — ☰, title, languages{", topics" if w >= 1200 else ""} without overlaps, no horizontal scroll', (clash, B['sw']))
                        check(B['brand'] and B['brand']['w'] >= 60, f'{tag}: the site title stays readable', B['brand'])
                    if '4' in ITEMS:
                        L = pg.evaluate('[...document.querySelectorAll("#tb-lang button")].map(b => { const r = b.getBoundingClientRect(); return [b.dataset.lang, b.textContent.trim(), b.getAttribute("aria-pressed"), r.left >= 0 && r.right <= innerWidth && r.width > 0] })')
                        check(len(L) == 3 and [x[1] for x in L] == ['عربي', 'עברית', 'English'] and all(x[3] for x in L), f'{tag}: three language buttons always visible', L)
                        check([x[0] for x in L if x[2] == 'true'] == [lang], f'{tag}: the current language is marked', L)
                        lp = B['lang']; check(lp and (lp['r'] >= B['vw'] - 20 if lang == 'en' else lp['l'] <= 20), f'{tag}: language buttons at the end of the top bar ({"right" if lang == "en" else "left, mirrored"})', lp)
                    if '5' in ITEMS:
                        T = pg.evaluate('''() => { const row = document.querySelector('#atl-topics'); const bs = [...row.querySelectorAll('button')]; const vr = row.getBoundingClientRect();
                          return { n: bs.length, on: bs.filter(b => b.classList.contains('on')).map(b => b.dataset.topic), full: bs.every(b => { const r = b.getBoundingClientRect(); return r.left >= vr.left - 1 && r.right <= vr.right + 1 && r.width > 0; }), scroll: getComputedStyle(row).overflowX, vis: vr.width > 0 && vr.height > 0 }; }''')
                        check(T['n'] == 6 and T['vis'] and T['on'] == [''], f'{tag}: the five analyses + "no topic" on screen, "no topic" marked', T)
                        check(T['full'] if w >= 700 else (T['scroll'] in ('auto', 'scroll')), f'{tag}: {"every analysis button fully visible" if w >= 700 else "a sideways-scrolling row on the phone"}', T)
            # interactions at three widths (one per language)
            for lang, w in (('en', 1440), ('ar', 1024), ('he', 390)):
                ctx, pg, errs = boot(w, lang); tag = f'{w}px {lang}'
                if '5' in ITEMS:
                    pg.click('#atl-topics [data-topic="climate"]'); time.sleep(3)
                    check(pg.evaluate('GA.atlas.state.topic') == 'climate' and pg.evaluate('document.querySelector("#atl-topics .on").dataset.topic') == 'climate', f'{tag}: a topic button sets the analysis and is marked')
                    pg.evaluate('GA.atlas.setTopic("human")'); time.sleep(3)
                    vis5 = pg.evaluate('(() => { const row = document.querySelector("#atl-topics"), on = row.querySelector(".on"); const r = row.getBoundingClientRect(), b = on.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1; })()')
                    check(vis5, f'{tag}: the current analysis is scrolled into view in the row (05, the last one)')
                    pg.click('#atl-burger'); time.sleep(0.6)
                    vis = pg.evaluate('''(() => { const r = document.querySelector('#atl-topics').getBoundingClientRect(); const side = document.querySelector('#atl-side').getBoundingClientRect(); const e = document.elementFromPoint(r.left + Math.min(r.width - 2, 60), r.top + r.height / 2); return r.height > 0 && !!e && !!e.closest('#atl-topics'); })()''')
                    check(vis, f'{tag}: the topic row stays visible with the ☰ menu open')
                    if w >= 768:
                        B = pg.evaluate(BOXES); check(not ov(B['sec'], B['side']) and not ov(B['d3'], B['side']), f'{tag}: Draw section / 3D stay clear of the open ☰ menu', (B['sec'], B['side']))
                    pg.click('#atl-side-x'); time.sleep(0.4)
                if '4' in ITEMS:
                    pg.evaluate('GA.atlas.setArea("metro")'); time.sleep(3); pg.evaluate('GA.atlas.setTopic("density")'); time.sleep(3)
                    if w >= 1000: pg.evaluate('GA.panels.set("study", true)'); time.sleep(0.6)
                    before = pg.evaluate('({ c: GA.app.map.getCenter().toArray(), z: GA.app.map.getZoom(), a: GA.atlas.state.area, t: GA.atlas.state.topic, p: ["analysis", "study"].map(k => GA.panels.isOpen(k)), saved: localStorage.getItem("granada-atlas.store.v1") || localStorage.getItem("granada-atlas.project.v1") })')
                    other = {'en': 'he', 'ar': 'en', 'he': 'ar'}[lang]
                    pg.click(f'#tb-lang [data-lang="{other}"]'); time.sleep(1.2)
                    after = pg.evaluate('({ c: GA.app.map.getCenter().toArray(), z: GA.app.map.getZoom(), a: GA.atlas.state.area, t: GA.atlas.state.topic, p: ["analysis", "study"].map(k => GA.panels.isOpen(k)), saved: localStorage.getItem("granada-atlas.store.v1") || localStorage.getItem("granada-atlas.project.v1"), lang: document.documentElement.lang, dir: document.documentElement.dir })')
                    same = abs(before['c'][0] - after['c'][0]) < 1e-7 and abs(before['c'][1] - after['c'][1]) < 1e-7 and abs(before['z'] - after['z']) < 1e-6
                    check(after['lang'] == other and after['dir'] == ('ltr' if other == 'en' else 'rtl'), f'{tag}: the language button switches to {other}', after)
                    check(same and after['a'] == before['a'] and after['t'] == before['t'] and after['p'] == before['p'] and after['saved'] == before['saved'], f'{tag}: … keeping the map view, area, topic, open panels and saved work', (before, after))
                    pg.click('#atl-burger'); time.sleep(0.4); pg.click('[data-sec-t="display"]'); time.sleep(0.4)
                    pg.click(f'#atl-sec-display #lang button:has-text("{ {"ar": "العربية", "he": "עברית", "en": "English"}[lang] }")'); time.sleep(1)
                    check(pg.evaluate('document.documentElement.lang') == lang and pg.evaluate(f'document.querySelector("#tb-lang [data-lang={lang}]").getAttribute("aria-pressed")') == 'true', f'{tag}: the Display section switch still works and the top bar follows (one state)')
                    pg.click('#atl-side-x'); time.sleep(0.3)
                if '1' in ITEMS:
                    pg.evaluate('document.activeElement && document.activeElement.blur()'); z0 = pg.evaluate('GA.app.map.getZoom()'); pg.keyboard.type('+'); time.sleep(1.2); z1 = pg.evaluate('GA.app.map.getZoom()')
                    pg.keyboard.type('-'); time.sleep(1.2); z2 = pg.evaluate('GA.app.map.getZoom()')
                    check(z1 > z0 + 0.5 and z2 < z1 - 0.5, f'{tag}: the + / − keys zoom the map ({z0:.2f} → {z1:.2f} → {z2:.2f})')
                pg.screenshot(path=f'{OUT}/{lang}_{w}.png')
                check(not errs, f'{tag}: no page errors', errs[:3]); ctx.close()

        # ---------- 6. model workshop sheets ----------
        if '6' in ITEMS:
            ctx, pg, errs = boot(1440, 'en', downloads=True)
            sc = pg.evaluate('[[379, GA.modelPrint.scaleFor(379 * 0.4).denom], [150, GA.modelPrint.scaleFor(150).denom], [4500, GA.modelPrint.scaleFor(4500).denom], [500, GA.modelPrint.scaleFor(500).denom]]')
            check(sc[0][1] == 500 and sc[1][1] == 500 and sc[2][1] is None and sc[3][1] == 2000, 'scale = next standard scale up (1:379 → 1:500; 150 m → 1:500; 500 m → 1:2,000; 4.5 km too large)', sc)
            pg.evaluate('GA.modelPrint.S.square = { center: [-3.5986, 37.1773], side: 151.6 }; GA.modelPrint.S.src = "square"; GA.modelPrint.S.open = true; GA.modelPrint.S.secEW = true; GA.modelPrint.S.secNS = false; GA.modelPrint.S.dpi = 150; GA.pages.go("print")'); time.sleep(2)
            calc = pg.evaluate('document.querySelector("#mp-calc").innerText')
            check('1:500' in calc and '379' in calc and '200 × 200 m' in calc, 'the panel shows 1:379 → 1:500 and the 200 × 200 m model area', calc)
            pg.screenshot(path=f'{OUT}/6_panel.png')
            with pg.expect_download(timeout=600000) as dl: pg.click('[data-mp-act="pdf"]')
            pdf = os.path.join(OUT, 'model.pdf'); dl.value.save_as(pdf); last = pg.evaluate('GA.modelPrint.last')
            info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
            pages = int([l for l in info.splitlines() if l.startswith('Pages:')][0].split()[-1])
            sizes = subprocess.run(['pdfinfo', '-f', '1', '-l', str(pages), pdf], capture_output=True, text=True).stdout
            check(pages == 5 and sizes.count('1190.55 x 841.89') == 5, f'5 A3 landscape sheets (plan ×2, aerial ×2, section) — {pages}', sizes[-300:])
            dn = set(s['denom'] for s in last['sheets']); check(dn == {500} and not any(s['skipped'] for s in last['sheets']), 'every sheet at the same scale 1:500 (none skipped)', last['sheets'])
            mp = [s['measured'] for s in last['sheets'] if s['kind'] == 'plan']; check(all(abs(m / 500 - 1) < 0.005 for m in mp), f'plan sheets: measured map scale 1:{", 1:".join(str(round(m)) for m in mp)}', mp)
            sec = [s for s in last['sheets'] if s['kind'] == 'section'][0]; check(abs(sec['mmPerM'] - 2.0) < 0.01, f'section at the same scale: {sec["mmPerM"]:.3f} mm per metre (1:500 = 2 mm/m), horizontal = vertical', sec)
            # measure the model outline on the paper: red vertical edges at x = 10 and 410 mm, 200 mm tall per sheet
            DPI = 100
            for pno, name in ((1, 'plan N'), (3, 'aerial N'), (4, 'aerial S')):
                subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(pno), '-l', str(pno), '-png', pdf, os.path.join(OUT, f'mp{pno}')], check=True)
                im = Image.open([os.path.join(OUT, f) for f in sorted(os.listdir(OUT)) if f.startswith(f'mp{pno}')][0]).convert('RGB'); W_, H_ = im.size; px = im.load(); mm = DPI / 25.4
                red = lambda c: c[0] > 120 and c[1] < 80 and c[2] < 80 and c[0] - c[1] > 70
                # the outline's own outer edges: the left line lies in 8–12 mm, the right one in 408–412 mm (0.5 mm thick);
                # outer edge to outer edge = 400.5 mm. Rows 60–240 mm (inside the model part, below the red header text).
                ws = []
                for ymm in range(60, 241, 20):
                    y = int(ymm * mm); L_ = [x for x in range(int(8 * mm), int(12 * mm)) if red(px[x, y])]; R_ = [x for x in range(int(408 * mm), int(412 * mm)) if red(px[x, y])]
                    if L_ and R_: ws.append((max(R_) + 1 - min(L_)) / mm - 0.5)
                width = sorted(ws)[len(ws) // 2] if ws else None
                # the left line's run inside 40–270 mm: continuous from the model top to its bottom (or the join)
                col = int(10 * mm); ys = [yy for yy in range(int(40 * mm), int(270 * mm)) if any(red(px[xx, yy]) for xx in range(col - 1, col + 2))]
                height = (max(ys) + 1 - min(ys)) / mm if ys else None; cont = ys and len(ys) >= 0.97 * (max(ys) + 1 - min(ys))
                check(width and abs(width - 400) < 0.6 and height and abs(height - 200) < 1.0 and cont, f'{name}: the model outline measures {width and round(width, 1)} mm wide (400) and {height and round(height, 1)} mm of its height on this sheet (200; two sheets = 400)', (width, height))
            check(not errs, 'no page errors (model sheets)', errs[:3]); ctx.close()
        b.close()
finally:
    srv.terminate()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED:\n  ' + '\n  '.join(fails))
sys.exit(1 if fails else 0)
