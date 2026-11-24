"""v40 — build 5.52: the research tour (14 chapters, js/tour_research.js + js/tour.js).
  A. Structure: 14 chapters, 50 slides; #/tour/1 still opens on the base (the 5.42 slide); every slide renders a title, a
     finding ("What the data show"), the link to the base and — on new slides — sources with data-kind badges; no raw
     keys, no {placeholders}, no error box; the visible tour layers are exactly the slide's groups; in ar / he / en.
  B. Timelines: the construction-period slide plays by itself, Pause stops it, the slider sets a frame (map filter and
     label follow); reduced motion shows the last frame without playing.
  C. Interaction: the pyramid's town picker outlines the town in red; the scenario buttons restyle the base; the indicator
     buttons change the map labels; hovering a chart row outlines the town; the contents menu jumps to a chapter; the data
     inventory opens (≥ 40 rows + the missing-data list) and Esc closes it.
  D. Keys: Space = next slide, Shift+Space = previous, Enter = next chapter, Backspace = previous chapter, P = play/pause,
     Esc = leave; the last Enter opens the normal map with every tour layer and source removed and the saved layer state
     unchanged; #/tour/12/1 deep-links to chapter 12.
  E. Phone (390 px): the card is a bottom sheet, every button reachable, no horizontal overflow. RTL: charts stay LTR.
Usage: python3 tests/ui_test_v40.py (OUT=/dir)"""
import sys, os, time, json, subprocess, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _nointro  # noqa: F401 — the deep links skip the opening page anyway
from playwright.sync_api import sync_playwright
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8840
OUT = os.environ.get('OUT', '/tmp/v40shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{str(extra)[:400]}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def stub(pg):
    def route(r):
        u = r.request.url
        if u.startswith(f'http://127.0.0.1:{PORT}/'): return r.continue_()
        if u.rstrip('/').endswith('/planet'): return r.fulfill(json={'tilejson': '3.0.0', 'tiles': ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14})
        if 'fonts.googleapis.com' in u: return r.fulfill(status=200, body='', content_type='text/css')
        return r.fulfill(status=404, body='')
    pg.route('**/*', route)
VIS = '() => GA.app.map.getStyle().layers.filter(l => l.id.startsWith("tour-") && (l.layout || {}).visibility !== "none").map(l => l.id).sort()'
WANT = '() => { const s = GA.tour.state, out = new Set(); s.groups.forEach(g => (GA.tour.GROUPS[g] || []).forEach(n => GA.app.map.getLayer(GA.tour.ID(n)) && out.add(GA.tour.ID(n)))); return [...out].sort(); }'
CARD = '''() => { const c = document.querySelector('#tour-card'); const tx = c.innerText; return { slide: GA.tour.state.slide, title: (c.querySelector('.tour-c-t') || {}).textContent || '',
  find: !!c.querySelector('.tr-find'), link: !!c.querySelector('.tr-link .tr-lk'), badges: c.querySelectorAll('.tr-srcs .tr-kind').length, raw: (tx.match(/\\br\\.[a-z0-9]+\\.[a-zA-Z0-9.]+/) || [null])[0],
  brace: (tx.match(/\\{[a-zA-Z0-9]+\\}/) || [null])[0], err: !!c.querySelector('.error'), old: !!(GA.tourResearch.CH[GA.tour.state.step - 1].slides[GA.tour.state.layer - 1].old) }; }'''
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(vp=(1440, 900), lang='en', path='#/tour/1', motion='no-preference', device=None):
            opts = dict(p.devices[device]) if device else {'viewport': {'width': vp[0], 'height': vp[1]}}
            ctx = b.new_context(reduced_motion=motion, **opts)
            ctx.add_init_script(f"try {{ localStorage.setItem('granada-atlas.lang', '{lang}'); }} catch (e) {{ }} window.__noPanelHook = true;")
            pg = ctx.new_page(); stub(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append(str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html{path}')
            pg.wait_for_function('window.GA && GA.tour && GA.app && GA.app.map' + (' && GA.tour.state.built && GA.tour.state.on' if path else ''), timeout=120000); time.sleep(1.5)
            return ctx, pg, errs
        def at(pg, c, s, t=60000):
            pg.wait_for_function(f'GA.tour.state.step === {c} && GA.tour.state.layer === {s} && document.querySelector("#tour-card").dataset.layer == "{s}" && document.querySelector("#tour-card").dataset.step == "{c}"', timeout=t); time.sleep(0.9)

        # ---------- A. every slide in three languages ----------
        for lang in ('en', 'ar', 'he'):
            ctx, pg, errs = boot(lang=lang)
            st = pg.evaluate('GA.tour.state')
            check(st['step'] == 1 and st['layer'] == 1 and st['chapters'] == 14 and st['slide'] == 'i2', f'{lang}: #/tour/1 opens chapter 1 on the base slide (14 chapters)', st)
            n = pg.evaluate('GA.tourResearch.CH.map(c => c.slides.length)'); check(sum(n) == 50, f'{lang}: 50 slides', n)
            bad = []
            for c, k in enumerate(n, 1):
                for s in range(1, k + 1):
                    pg.evaluate(f'GA.tour.go({c}, {s}, true)'); at(pg, c, s)
                    C = pg.evaluate(CARD); vis, want = pg.evaluate(VIS), pg.evaluate(WANT)
                    probs = []
                    if not C['title'].strip(): probs.append('title')
                    if not C['find']: probs.append('finding')
                    if not C['link']: probs.append('link')
                    if not C['old'] and C['badges'] < 1 and C['slide'] != 'n3': probs.append('badges')
                    if C['raw']: probs.append('raw ' + C['raw'])
                    if C['brace']: probs.append('placeholder ' + C['brace'])
                    if C['err']: probs.append('error box')
                    if vis != want: probs.append('layers ' + str(sorted(set(vis) ^ set(want)))[:160])
                    if probs: bad.append(f'{c}/{s} {C["slide"]}: ' + ', '.join(probs))
            check(not bad, f'{lang}: every slide complete (title, finding, link, badges, layers = groups)', bad[:6])
            if lang == 'ar':
                pg.evaluate('GA.tour.go(3, 3, true)'); at(pg, 3, 3)
                d = pg.evaluate('''() => ({ side: (() => { const r = document.querySelector('#tour-card').getBoundingClientRect(); return r.left + r.width / 2 > innerWidth / 2 ? 'right' : 'left'; })(), svg: getComputedStyle(document.querySelector('.tr-chart')).direction })''')
                check(d['side'] == 'right' and d['svg'] == 'ltr', 'ar: the card on the right, charts drawn left-to-right', d)
                pg.screenshot(path=f'{OUT}/ar_3_3.png')
            check(not errs, f'{lang}: no page errors', errs[:3]); ctx.close()

        # ---------- B. timelines ----------
        ctx, pg, errs = boot(path='#/tour/2/2'); at(pg, 2, 2)
        pg.wait_for_function('GA.tourResearch.X.anim && GA.tourResearch.X.anim.i >= 2', timeout=20000)
        check(True, 'the construction-period slide plays by itself')
        pg.click('[data-tour="play"]'); i0 = pg.evaluate('GA.tourResearch.X.anim.i'); time.sleep(2.8)
        check(pg.evaluate('GA.tourResearch.X.anim.i') == i0 and not pg.evaluate('GA.tourResearch.X.anim.playing'), 'Pause stops the timeline', pg.evaluate('GA.tourResearch.X.anim'))
        pg.evaluate('''() => { const r = document.querySelector('#tr-tl input'); r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true })); }'''); time.sleep(0.5)
        f = pg.evaluate('JSON.stringify(GA.app.map.getFilter("tour-r-grid"))'); lab = pg.evaluate('document.querySelector("#tr-tl output").textContent')
        check('1' in f and lab == '1900–1939', 'the slider sets the frame (map filter and label follow)', (f, lab))
        pg.keyboard.press('p'); time.sleep(1.6); check(pg.evaluate('GA.tourResearch.X.anim.playing') or pg.evaluate('GA.tourResearch.X.anim.i') > 1, 'P plays again')
        check(not errs, 'B: no page errors', errs[:3]); ctx.close()
        ctx, pg, errs = boot(path='#/tour/4/2', motion='reduce'); at(pg, 4, 2); time.sleep(1.5)
        check(pg.evaluate('GA.tourResearch.X.anim.i') == 2 and not pg.evaluate('GA.tourResearch.X.anim.playing'), 'reduced motion: the flood slide shows its last frame without playing', pg.evaluate('GA.tourResearch.X.anim'))
        ctx.close()

        # ---------- C. interaction ----------
        ctx, pg, errs = boot(path='#/tour/7/2'); at(pg, 7, 2)
        check(pg.evaluate('JSON.stringify(GA.app.map.getFilter("tour-r-hi"))').find('Armilla') > 0, 'pyramid: Armilla outlined in red at first')
        pg.click('[data-muni-pick="Granada"]'); time.sleep(0.6)
        check('Granada' in pg.evaluate('JSON.stringify(GA.app.map.getFilter("tour-r-hi"))') and 'Granada' in pg.evaluate('document.querySelector(".tr-chart").getAttribute("aria-label")'), 'pyramid: the picker switches the town (map outline and chart)')
        pg.evaluate('GA.tour.go(14, 2, true)'); at(pg, 14, 2)
        pg.click('[data-scen="B"]'); time.sleep(0.5)
        check(pg.evaluate('GA.app.map.getPaintProperty("tour-r-scen-fill", "fill-pattern")') == 'tour-hatch' and 'B' in pg.evaluate('document.querySelector(".tr-pick [aria-pressed=true]").dataset.scen'), 'scenario B restyles the base (hatch) and the button')
        pg.evaluate('GA.tour.go(13, 2, true)'); at(pg, 13, 2)
        l0 = pg.evaluate('[...document.querySelectorAll("#tour-lbls .tour-lbl")].map(e => e.textContent).join("|")')
        pg.click('[data-ind="age"]'); time.sleep(0.8)
        l1 = pg.evaluate('[...document.querySelectorAll("#tour-lbls .tour-lbl")].map(e => e.textContent).join("|")')
        check(l0 != l1 and '41.2' in l1, 'indicator buttons change the map labels', (l0[:80], l1[:80]))
        pg.evaluate('GA.tour.go(1, 4, true)'); at(pg, 1, 4)
        pg.hover('.tr-chart [data-muni="Ogíjares"]'); time.sleep(0.3)
        check('Ogíjares' in pg.evaluate('JSON.stringify(GA.app.map.getFilter("tour-r-hi"))'), 'hovering a chart row outlines the town on the map')
        pg.click('[data-tour="toc"]'); check(pg.evaluate('!document.querySelector("#tr-toc").hidden') and pg.evaluate('document.querySelectorAll("#tr-toc [data-go]").length') == 14, 'the contents menu lists 14 chapters')
        pg.click('#tr-toc [data-go="9"]'); at(pg, 9, 1); check(True, 'the contents menu jumps to chapter 9')
        pg.click('[data-tour="inv"]'); time.sleep(0.4)
        inv = pg.evaluate('({ rows: document.querySelectorAll("#tr-inv .tr-invt tr").length - 1, miss: document.querySelectorAll("#tr-inv .tr-gaps li").length, badges: document.querySelectorAll("#tr-inv .tr-kind").length })')
        check(inv['rows'] >= 40 and inv['miss'] >= 10 and inv['badges'] == inv['rows'], 'the data inventory lists every dataset with a kind badge, then the missing data', inv)
        pg.keyboard.press('Escape'); time.sleep(0.3); check(not pg.evaluate('!!document.querySelector("#tr-inv")') and pg.evaluate('GA.tour.state.on'), 'Esc closes the inventory, the tour stays')
        check(not errs, 'C: no page errors', errs[:3]); ctx.close()

        # ---------- D. keys, exit, deep link ----------
        ctx, pg, errs = boot(path='')
        pg.wait_for_function('GA.app && GA.app.map', timeout=60000); time.sleep(1); before = pg.evaluate('localStorage.getItem("granada-atlas.layers.v1")')
        pg.evaluate('location.hash = "#/tour/1"'); at(pg, 1, 1)
        pg.keyboard.press('Space'); at(pg, 1, 2); pg.keyboard.press('Shift+Space'); at(pg, 1, 1)
        pg.keyboard.press('Enter'); at(pg, 2, 1); check(pg.evaluate('location.hash') == '#/tour/2/1', 'Enter = next chapter (URL #/tour/2/1)', pg.evaluate('location.hash'))
        pg.keyboard.press('Backspace'); at(pg, 1, 1); check(True, 'Backspace = previous chapter')
        pg.evaluate('GA.tour.go(14, 3, true)'); at(pg, 14, 3); pg.keyboard.press('Enter'); time.sleep(1.2)
        st = pg.evaluate('''() => ({ on: GA.tour.state.on, layers: GA.app.map.getStyle().layers.filter(l => l.id.startsWith('tour-')).length, srcs: Object.keys(GA.app.map.getStyle().sources).filter(s => s.startsWith('tour-')).length, hash: location.hash })''')
        check(not st['on'] and st['layers'] == 0 and st['srcs'] == 0 and st['hash'] == '', 'the last Enter opens the normal map: no tour layers or sources left', st)
        check(pg.evaluate('localStorage.getItem("granada-atlas.layers.v1")') == before, 'the saved layer state is unchanged by the tour')
        pg.goto(f'http://127.0.0.1:{PORT}/index.html#/tour/12/1'); pg.wait_for_function('GA.tour && GA.tour.state.built', timeout=120000); at(pg, 12, 1)
        check(pg.evaluate('GA.tour.state.slide') == 'u1', '#/tour/12/1 deep-links to chapter 12')
        pg.keyboard.press('Escape'); time.sleep(0.8); check(not pg.evaluate('GA.tour.state.on'), 'Esc leaves the tour')
        check(not errs, 'D: no page errors', errs[:3]); ctx.close()

        # ---------- E. phone ----------
        ctx, pg, errs = boot(device='iPhone 13', path='#/tour/3/1'); at(pg, 3, 1)
        g = pg.evaluate('''() => { const r = document.querySelector('#tour-card').getBoundingClientRect(); const btn = [...document.querySelectorAll('#tour-card [data-tour]')].filter(b => b.offsetParent).every(b => { const q = b.getBoundingClientRect(); return q.bottom <= innerHeight + 1 && q.top >= 0; });
          return { sheet: r.left <= 1 && r.right >= innerWidth - 1, btn, over: document.documentElement.scrollWidth > innerWidth }; }''')
        check(g['sheet'] and g['btn'] and not g['over'], 'phone: bottom sheet, every button reachable, no horizontal overflow', g)
        pg.screenshot(path=f'{OUT}/phone_3_1.png'); check(not errs, 'E: no page errors', errs[:3]); ctx.close()
        b.close()
finally:
    srv.terminate()
print(f'\n{len(fails)} failed' if fails else '\nall passed'); sys.exit(1 if fails else 0)
