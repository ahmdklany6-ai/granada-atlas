"""v25 — build 5.27: the opening page and the story tour (js/tour.js).
  A. the plain URL shows the opening page (ar / he / en: title, names, two buttons, language switch), again after a reload,
     no "don't show again" control; deep links skip it; #/tour reopens it; window.__noIntro / ?nointro switch it off.
  B. the white button gives the normal map: opening page gone, panels closed, essentials layers on, no tour layers.
  C. the red button: step 1 framed on the base; Enter → step 2 with the five town centres in view; Space ×5 cycles the five
     layers (each alone: the right tour layers visible, card title / legend change, dot indicator advances); Shift+Space and ←
     go back; Enter → step 3 shows the agglomeration; Space cycles its layers (the rent layer shows its source and the
     missing €/m² state); the last Enter returns to the normal map with the tour layers removed and the saved layer state
     unchanged; Backspace = previous step; Esc = leave; state in the URL (#/tour/2/3 reopens step 2 layer 3); Space never
     scrolls nor double-counts on a focused button; keys typed into an input are ignored; real data values on the cards.
  D. on-screen buttons on a 390 px phone (bottom sheet) and an iPad do the same; no horizontal overflow.
  E. prefers-reduced-motion: no animated flight. F. RTL: the card sits on the right; signed numbers / € stay left-to-right.
Usage: python3 tests/ui_test_v25.py  (OUT=/dir)  [ITEMS=A,B,... to run a subset]
Note: this suite does NOT import tests/_nointro.py — it tests the opening page itself."""
import sys, os, time, json, subprocess, warnings
from playwright.sync_api import sync_playwright
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8825
OUT = os.environ.get('OUT', '/tmp/v25shots'); os.makedirs(OUT, exist_ok=True)
ITEMS = set((os.environ.get('ITEMS') or 'A,B,C,D,E,F').split(','))
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)

def stub(pg):  # the page and its data are local; every outside host answers 404 (the basemap gets an empty tile source)
    def route(r):
        u = r.request.url
        if u.startswith(f'http://127.0.0.1:{PORT}/'): return r.continue_()
        if u.rstrip('/').endswith('/planet'): return r.fulfill(json={'tilejson': '3.0.0', 'tiles': ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14})
        if 'fonts.googleapis.com' in u: return r.fulfill(status=200, body='', content_type='text/css')
        return r.fulfill(status=404, body='')
    pg.route('**/*', route)

EXPECT = {'area_ha': 371.0, 'deadends': 13, 'five_pop': 91476, 'city_chg': -0.8}
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(vp=None, lang='en', path='', device=None, motion='no-preference', init=''):
            opts = dict(p.devices[device]) if device else {'viewport': vp or {'width': 1440, 'height': 900}}
            ctx = b.new_context(reduced_motion=motion, **opts)
            ctx.add_init_script(f"try {{ localStorage.setItem('granada-atlas.lang', '{lang}'); }} catch (e) {{ }} window.__noPanelHook = true; {init}")
            pg = ctx.new_page(); stub(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html{path}'); pg.wait_for_function('window.GA && GA.tour && GA.app && GA.app.map', timeout=120000); time.sleep(1.5)
            return ctx, pg, errs
        def wait_step(pg, step, layer=None, t=60000):
            pg.wait_for_function(f'GA.tour.state.on && GA.tour.state.built && GA.tour.state.step === {step}' + (f' && GA.tour.state.layer === {layer}' if layer else ''), timeout=t)
        def settle(pg, t=25000):  # until the map stops moving
            pg.wait_for_function('!GA.app.map.isMoving()', timeout=t); time.sleep(0.4)
        VISIBLE = '''() => GA.app.map.getStyle().layers.filter(l => l.id.startsWith('tour-') && (l.layout || {}).visibility !== 'none').map(l => l.id)'''
        def want(pg):  # the tour layers that should be visible for the current state
            return pg.evaluate('''() => { const s = GA.tour.state; const out = []; s.groups.forEach(g => GA.tour.GROUPS[g].forEach(n => out.push(GA.tour.ID(n)))); return out.sort(); }''')
        def in_view(pg, lnglat):  # a point inside the map and not under the tour card
            return pg.evaluate('''(ll) => { const m = GA.app.map, pt = m.project(ll), c = m.getCanvas().getBoundingClientRect(), r = document.querySelector('#tour-card').getBoundingClientRect();
              const x = pt.x + c.left, y = pt.y + c.top; const inMap = pt.x >= 0 && pt.y >= 0 && pt.x <= c.width && pt.y <= c.height;
              const underCard = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; return inMap && !underCard; }''', lnglat)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']

        # ---------- A. opening page ----------
        if 'A' in ITEMS:
            TITLE = {'ar': 'غرناطة', 'he': 'גרנדה', 'en': 'Granada'}; NAMES = {'ar': 'أحمد زيد · يارا بشير', 'he': 'אחמד זיד · יארא בשיר', 'en': 'Ahmad Zid · Yara Bashir'}
            START = {'ar': 'ابدأ الجولة', 'he': 'התחילו את הסיור', 'en': 'Start the tour'}; OPEN = {'ar': 'افتح خريطة غرناطة', 'he': 'פתחו את מפת גרנדה', 'en': 'Open the map of Granada'}
            for lang in ('ar', 'he', 'en'):
                ctx, pg, errs = boot(lang=lang)
                info = pg.evaluate('''() => { const el = document.querySelector('#tour-intro'); const r = el.getBoundingClientRect();
                  return { vis: !el.hidden && r.width >= innerWidth - 1 && r.height >= innerHeight - 1, title: el.querySelector('.tour-title').textContent.trim(), names: el.querySelector('.tour-names').textContent.trim(),
                    start: document.querySelector('#tour-start').textContent.trim(), open: document.querySelector('#tour-open').textContent.trim(),
                    red: getComputedStyle(document.querySelector('#tour-start')).backgroundColor, white: getComputedStyle(document.querySelector('#tour-open')).backgroundColor,
                    titleCol: getComputedStyle(el.querySelector('.tour-title')).color, inputs: el.querySelectorAll('input, select, textarea').length,
                    dontShow: /(don.t show|لا تعرض|אל תציג)/i.test(el.innerText), langs: el.querySelectorAll('[data-tour-lang]').length,
                    mapGrey: getComputedStyle(document.querySelector('#map')).filter }; }''')
                check(info['vis'], f'{lang}: the plain URL opens on the full-screen opening page')
                check(info['title'] == TITLE[lang] and info['names'] == NAMES[lang], f'{lang}: title and names', (info['title'], info['names']))
                check(info['start'] == START[lang] and info['open'] == OPEN[lang], f'{lang}: red "{START[lang]}" and white "{OPEN[lang]}" buttons', (info['start'], info['open']))
                check(info['red'] == 'rgb(153, 43, 42)' and info['white'] == 'rgb(255, 255, 255)' and info['titleCol'] == 'rgb(153, 43, 42)', f'{lang}: red #992B2A title and primary button, white secondary', (info['red'], info['white'], info['titleCol']))
                check(info['inputs'] == 0 and not info['dontShow'], f'{lang}: no "don\'t show again" control')
                check(info['langs'] == 3, f'{lang}: language switch on the opening page')
                check('grayscale' in info['mapGrey'], f'{lang}: the real map behind, desaturated', info['mapGrey'])
                pg.screenshot(path=f'{OUT}/A_{lang}_intro.png')
                if lang == 'en':
                    pg.click('[data-tour-lang="he"]'); time.sleep(0.5)
                    check(pg.evaluate('document.querySelector(".tour-title").textContent.trim()') == 'גרנדה' and pg.evaluate('document.documentElement.dir') == 'rtl', 'the language switch on the opening page changes the language')
                    pg.click('[data-tour-lang="en"]'); time.sleep(0.3)
                    pg.reload(); pg.wait_for_function('window.GA && GA.tour', timeout=60000); time.sleep(1)
                    check(pg.evaluate('!document.querySelector("#tour-intro").hidden'), 'shown again after a reload')
                    clicks = pg.evaluate('''() => { let n = 0; const m = GA.app.map; const h = () => n++; m.on('click', h); const el = document.elementFromPoint(innerWidth / 2, innerHeight - 40); m.off('click', h); return el && el.closest('#tour-intro') ? 'intro' : (el && el.id); }''')
                    check(clicks == 'intro', 'the map takes no input while the opening page is up', clicks)
                check(not errs, f'{lang}: no page errors (opening page)', errs[:3])
                ctx.close()
            for path, name in [('#/south', '#/south'), ('#/print', '#/print')]:
                ctx, pg, errs = boot(path=path); check(pg.evaluate('document.querySelector("#tour-intro").hidden'), f'deep link {name} skips the opening page'); ctx.close()
            ctx, pg, errs = boot(path='?nointro'); check(pg.evaluate('document.querySelector("#tour-intro").hidden'), '?nointro switches it off'); ctx.close()
            ctx, pg, errs = boot(init='window.__noIntro = true;'); check(pg.evaluate('document.querySelector("#tour-intro").hidden'), 'window.__noIntro switches it off')
            pg.evaluate('document.querySelector("#tb-tour").click()'); time.sleep(1)
            check(pg.evaluate('!document.querySelector("#tour-intro").hidden') and pg.evaluate('location.hash') == '#/tour', 'the "Tour" entry in the menu (#/tour) brings the opening page back')
            check(pg.evaluate('document.querySelector("#tb-tour").closest("#atl-side") !== null'), 'the Tour entry sits in the ☰ sidebar (tools & pages)')
            ctx.close()

        # ---------- B. white button ----------
        if 'B' in ITEMS:
            ctx, pg, errs = boot(); before = pg.evaluate('localStorage.getItem("granada-atlas.layers.v1")')
            pg.click('#tour-open'); time.sleep(1.5)
            st = pg.evaluate('''() => ({ intro: !document.querySelector('#tour-intro').hidden, grey: getComputedStyle(document.querySelector('#map')).filter, panels: ['analysis', 'study'].map(k => GA.panels.isOpen(k)),
              side: !document.querySelector('#atl-side').hidden, ess: ['south_metro', 'tram_1931', 'escuzar_pole'].map(id => GA.app.L.S[id] && GA.app.L.S[id].on), tour: GA.app.map.getStyle().layers.filter(l => l.id.startsWith('tour-')).length,
              hash: location.hash, burger: getComputedStyle(document.querySelector('#atl-burger')).display, panel: !!document.querySelector('#atl-panel') && getComputedStyle(document.querySelector('#atl-panel')).display })''')
            check(not st['intro'] and st['grey'] in ('none', ''), 'white button: the opening page is gone, the map in colour', st['grey'])
            check(st['panels'] == [False, False] and not st['side'], 'white button: panels and menu closed', st)
            check(all(st['ess']), 'white button: essentials layers on', st['ess'])
            check(st['tour'] == 0 and st['hash'] == '', 'white button: no tour layers, plain URL', st)
            check(st['burger'] != 'none' and st['panel'] != 'none', 'white button: the atlas shell as before (☰, analysis panel)', st)
            check(pg.evaluate('localStorage.getItem("granada-atlas.layers.v1")') == before, 'white button: saved layer state unchanged')
            pg.screenshot(path=f'{OUT}/B_map.png'); check(not errs, 'no page errors (white button)', errs[:3]); ctx.close()

        # ---------- C. the tour, keyboard ----------
        if 'C' in ITEMS:
            ctx, pg, errs = boot(); before = pg.evaluate('localStorage.getItem("granada-atlas.layers.v1")')
            pg.click('#tour-start'); wait_step(pg, 1); settle(pg)
            D = pg.evaluate('({ bb: GA.tour.data.bb, towns: GA.tour.data.towns.features.map(f => [f.properties.nm, f.properties.lp]), stats: GA.tour.data.edge.stats, area: GA.tour.data.area.stats })')
            fr = pg.evaluate('''(bb) => { const m = GA.app.map, a = m.project(bb[0]), c = m.project(bb[1]), cv = m.getCanvas().getBoundingClientRect(), r = document.querySelector('#tour-card').getBoundingClientRect();
              const free = cv.width - r.width; return { inside: Math.min(a.x, c.x) >= 0 && Math.max(a.x, c.x) <= cv.width && Math.min(a.y, c.y) >= 0 && Math.max(a.y, c.y) <= cv.height, w: Math.abs(c.x - a.x), free, full: cv.width, h: Math.abs(c.y - a.y), ch: cv.height }; }''', D['bb']['1'])
            check(fr['inside'] and fr['w'] >= 0.5 * fr['free'], f'step 1: the base fills the view (bbox inside; {fr["w"]:.0f} px of the {fr["free"]:.0f} px not under the card, {fr["h"]:.0f} of {fr["ch"]:.0f} px high)', fr)
            check(pg.evaluate('location.hash') == '#/tour/1', 'step 1 in the URL (#/tour/1)')
            card = pg.evaluate('document.querySelector("#tour-card").innerText')
            check('371 ha' in card and '8.7 km' in card and '1922' in card and 'Ala 78' in card and '130984030' in card, 'step 1 card: 371 ha (measured), June 1922, Ala 78, 8.7 km fence, OSM way', card[:300])
            check(sorted(pg.evaluate(VISIBLE)) == want(pg) == sorted(['tour-veil', 'tour-base-fill', 'tour-base-line']), 'step 1: only the base (and the veil) drawn', pg.evaluate(VISIBLE))
            check(pg.evaluate('getComputedStyle(document.querySelector("#atl-panel")).display') == 'none', 'step 1: the atlas panel steps aside during the tour')
            pg.screenshot(path=f'{OUT}/C_step1.png')
            # Enter → step 2
            pg.keyboard.press('Enter'); wait_step(pg, 2, 1); settle(pg)
            seen = [n for n, ll in D['towns'] if in_view(pg, ll)]
            check(len(seen) == 5, f'step 2: all five town centres in view, none under the card ({", ".join(seen)})', seen)
            check(pg.evaluate('location.hash') == '#/tour/2/1', 'step 2 in the URL')
            titles, dots, legends = [], [], []
            for i in range(1, 8):  # 5.33: seven layers (towns, fence, route A, route B, both, band, metro/tram)
                st = pg.evaluate('GA.tour.state'); vis = sorted(pg.evaluate(VISIBLE))
                check(st['layer'] == i and vis == want(pg), f'step 2 layer {i}: {"+".join(st["groups"])} drawn alone', vis)
                titles.append(pg.evaluate('document.querySelector(".tour-c-t").textContent')); legends.append(pg.evaluate('document.querySelector(".tour-c-b .lg").innerHTML'))
                dots.append(pg.evaluate('[...document.querySelectorAll(".tour-dots i")].findIndex(e => e.classList.contains("on"))'))
                card = pg.evaluate('document.querySelector("#tour-card").innerText')
                if i == 1: check('91,476' in card and '25,300' in pg.evaluate('JSON.stringify(GA.tour.data.towns)'), 'layer 1: 91,476 residents (INE 2025); Armilla 25,300', card[:200])
                if i == 2: check('42 %' in card and '33 %' in card and '3.6 km' in card, 'layer 2: fence housing 42 % (3.6 km), open 33 %', card[:300])
                if i == 3: check('13 ' in card and '×1.49' in card and '5.8 km' in card and '3.9 km' in card, 'layer 3 (route A): 13 dead ends; 5.8 km instead of 3.9 km (×1.49)', card[:400])
                if i == 4: check('13 ' in card and '×1.29' in card and '6.9 km' in card and '5.4 km' in card, 'layer 4 (route B): 6.9 km instead of 5.4 km (×1.29)', card[:400])
                if i == 5: check('×1.49' in card and '×1.29' in card, 'layer 5: both routes', card[:400])
                if i == 6: check('287 ha' in card and 'confirmed' in card, 'layer 6: 287 ha band; BOE limit "to be confirmed"', card[:300])
                if i == 7: check('20 m' in card, 'layer 7: the metro about 20 m from the north fence', card[:300])
                pg.screenshot(path=f'{OUT}/C_step2_{i}.png')
                pg.keyboard.press('Space'); time.sleep(0.5)
            check(len(set(titles)) == 7 and len(set(legends)) == 7, 'step 2: card title and legend change with every layer', titles)
            check(dots == [0, 1, 2, 3, 4, 5, 6], 'step 2: the dot indicator advances', dots)
            check(pg.evaluate('GA.tour.state.layer') == 7, 'Space on the last layer stays there')
            pg.keyboard.press('Shift+Space'); time.sleep(0.4); check(pg.evaluate('GA.tour.state.layer') == 6 and pg.evaluate('location.hash') == '#/tour/2/6', 'Shift+Space goes back one layer (URL follows)')
            pg.keyboard.press('ArrowLeft'); time.sleep(0.4); check(pg.evaluate('GA.tour.state.layer') == 5, '← goes back one layer')
            check(pg.evaluate('scrollY') == 0 and pg.evaluate('document.scrollingElement.scrollTop') == 0, 'Space / arrows never scroll the page')
            # a focused button: one press of Space counts once
            pg.evaluate('document.querySelector("[data-tour=layer]").focus()'); pg.keyboard.press('Space'); time.sleep(0.5)
            check(pg.evaluate('GA.tour.state.layer') == 6, 'Space on a focused button counts once (5 → 6)', pg.evaluate('GA.tour.state.layer'))
            pg.evaluate('document.querySelector("[data-tour=next]").focus()'); pg.keyboard.press('Enter'); wait_step(pg, 3); time.sleep(0.8)
            check(pg.evaluate('GA.tour.state.step') == 3, 'Enter on a focused button counts once (step 2 → 3, not 4)', pg.evaluate('GA.tour.state'))
            # typing is ignored
            pg.evaluate('''() => { const i = document.createElement('input'); i.id = 'tt-in'; i.style.cssText = 'position:fixed;top:60px;left:300px;z-index:3000'; document.body.appendChild(i); i.focus(); }''')
            pg.keyboard.type('a b'); pg.keyboard.press('Enter'); pg.keyboard.press('Backspace'); time.sleep(0.3)
            check(pg.evaluate('GA.tour.state.step') == 3 and pg.evaluate('GA.tour.state.layer') == 1 and pg.evaluate('document.querySelector("#tt-in").value') == 'a ', 'keys typed into an input are ignored by the tour', pg.evaluate('GA.tour.state'))
            pg.evaluate('document.querySelector("#tt-in").remove()')
            settle(pg)
            # step 3: the agglomeration
            bb3 = D['bb']['3']; b3 = pg.evaluate('GA.app.map.getBounds().toArray()')
            tol = 0.01
            check(b3[0][0] <= bb3[0][0] + tol and b3[0][1] <= bb3[0][1] + tol and b3[1][0] >= bb3[1][0] - tol and b3[1][1] >= bb3[1][1] - tol, 'step 3: the whole agglomeration in view', (b3, bb3))
            card = pg.evaluate('document.querySelector("#tour-card").innerText')
            check('+15.3 %' in card and '−0.8 %' in card and '€16,893' in card and '€12,492' in card and '€13,167' in card, 'step 3 card: five towns +15.3 % vs Granada city −0.8 %; income €16,893 vs Las Gabias €12,492, Churriana €13,167', card[:400])
            titles = []
            for i in range(1, 5):  # 5.33: four layers (the southern-axis slide was removed)
                st = pg.evaluate('GA.tour.state'); vis = sorted(pg.evaluate(VISIBLE)); titles.append(pg.evaluate('document.querySelector(".tour-c-t").textContent'))
                check(st['layer'] == i and vis == want(pg), f'step 3 layer {i}: {"+".join(st["groups"])} drawn alone', vis)
                card = pg.evaluate('document.querySelector("#tour-card").innerText')
                if i == 3:
                    check('IPVA' in card and '59060' in card and 'Missing' in card and 'SERPAVI' in card and 'No index' in card, 'rent layer: INE IPVA index with its source; €/m² shown as missing with the reason; municipalities without an index marked', card[:600])
                    n_idx = pg.evaluate('GA.tour.data.area.features.filter(f => f.properties.rent != null).length'); check(n_idx == 14, f'rent layer: 14 municipalities with an index ({n_idx})')
                if i == 4:
                    settle(pg); bb = pg.evaluate('GA.tour.data.bb.barrio'); c = [(bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2]
                    check(in_view(pg, c) and pg.evaluate('GA.app.map.getZoom()') > 11, 'neighbourhood layer: zooms in to the city', pg.evaluate('GA.app.map.getZoom()'))
                    check('Missing' in card, 'neighbourhood layer: census-section income shown as missing with the reason', card[:300])
                if i in (1, 2, 3):  # map paint and legend come from the same classes
                    sw = pg.evaluate('[...document.querySelectorAll(".tour-c-b .lg .sw")].map(e => getComputedStyle(e).backgroundColor)')
                    key = ['chg', 'inc', 'rent'][i - 1]; cols = pg.evaluate(f'GA.palette.tour.{key}.map(h => "rgb(" + GA.palette.rgb(h).join(", ") + ")")')
                    check(sw[:len(cols)] == cols, f'step 3 layer {i}: legend colours = map classes ({key})', (sw, cols))
                pg.screenshot(path=f'{OUT}/C_step3_{i}.png')
                if i < 4: pg.keyboard.press('Space'); time.sleep(0.6)
            check(len(set(titles)) == 4, 'step 3: titles change with every layer', titles)
            # Backspace = previous step, then back again and to the end
            pg.keyboard.press('Backspace'); wait_step(pg, 2); check(pg.evaluate('GA.tour.state.step') == 2, 'Backspace goes to the previous step')
            pg.keyboard.press('Enter'); wait_step(pg, 3); pg.keyboard.press('Enter'); time.sleep(1.2)
            st = pg.evaluate('''() => ({ on: GA.tour.state.on, intro: !document.querySelector('#tour-intro').hidden, tour: GA.app.map.getStyle().layers.filter(l => l.id.startsWith('tour-')).length, srcs: Object.keys(GA.app.map.getStyle().sources).filter(s => s.startsWith('tour-')).length,
              hash: location.hash, panels: ['analysis', 'study'].map(k => GA.panels.isOpen(k)), card: !document.querySelector('#tour-card').hidden, ess: ['south_metro', 'tram_1931', 'escuzar_pole'].map(id => GA.app.L.S[id].on) })''')
            check(not st['on'] and not st['intro'] and not st['card'] and st['hash'] == '', 'the last Enter ends the tour on the normal map', st)
            check(st['tour'] == 0 and st['srcs'] == 0, 'the tour layers and sources are removed', st)
            check(st['panels'] == [False, False] and all(st['ess']), 'panels closed, essentials layers on', st)
            check(pg.evaluate('localStorage.getItem("granada-atlas.layers.v1")') == before, 'the saved layer state is unchanged by the tour')
            pg.screenshot(path=f'{OUT}/C_end.png')
            # deep link into a layer, Esc leaves
            pg.goto(f'http://127.0.0.1:{PORT}/index.html#/tour/2/3'); wait_step(pg, 2, 3); time.sleep(1)
            check(pg.evaluate('GA.tour.state.layer') == 3 and pg.evaluate('document.querySelector("#tour-intro").hidden'), '#/tour/2/3 reopens step 2, layer 3')
            pg.keyboard.press('Escape'); time.sleep(0.8)
            check(not pg.evaluate('GA.tour.state.on') and pg.evaluate('GA.app.map.getStyle().layers.filter(l => l.id.startsWith("tour-")).length') == 0, 'Esc leaves the tour to the normal map')
            check(not errs, 'no page errors (tour)', errs[:3]); ctx.close()

        # ---------- D. phone and tablet, on-screen buttons ----------
        if 'D' in ITEMS:
            for dev, lang in [('iPhone 13', 'ar'), ('iPad (gen 7)', 'he'), ('iPhone 13', 'en')]:
                ctx, pg, errs = boot(device=dev, lang=lang); name = f'{dev} {lang}'
                pg.tap('#tour-start') if 'iPhone' in dev or 'iPad' in dev else pg.click('#tour-start'); wait_step(pg, 1); settle(pg)
                r = pg.evaluate('(() => { const r = document.querySelector("#tour-card").getBoundingClientRect(); return [r.left, r.right, r.bottom, innerWidth, innerHeight, document.documentElement.scrollWidth]; })()')
                if 'iPhone' in dev: check(r[0] <= 1 and r[1] >= r[3] - 1 and r[2] >= r[4] - 1, f'{name}: the card is a bottom sheet', r)
                check(r[5] <= r[3], f'{name}: no horizontal overflow', r)
                fr = pg.evaluate('''(bb) => { const m = GA.app.map, a = m.project(bb[0]), c = m.project(bb[1]), cv = m.getCanvas(); const card = document.querySelector('#tour-card').getBoundingClientRect(), top = cv.getBoundingClientRect().top;
                  const left = cv.getBoundingClientRect().left, x0 = Math.min(a.x, c.x) + left, x1 = Math.max(a.x, c.x) + left, y0 = Math.min(a.y, c.y) + top, y1 = Math.max(a.y, c.y) + top;
                  const inside = x0 >= left - 1 && x1 <= left + cv.clientWidth + 1 && y0 >= top - 1 && y1 <= top + cv.clientHeight + 1;
                  const overlap = !(x1 <= card.left + 2 || x0 >= card.right - 2 || y1 <= card.top + 2 || y0 >= card.bottom - 2); return inside && !overlap; }''', pg.evaluate('GA.tour.data.bb[1]'))
                check(fr, f'{name}: step 1 base in view, clear of the card')
                pg.screenshot(path=f'{OUT}/D_{dev.split()[0]}_{lang}_1.png')
                pg.tap('[data-tour=next]'); wait_step(pg, 2, 1); settle(pg)
                pg.tap('[data-tour=layer]'); time.sleep(0.4); pg.tap('[data-tour=layer]'); time.sleep(0.4)
                check(pg.evaluate('GA.tour.state.layer') == 3, f'{name}: "next layer" button')
                pg.tap('[data-tour=prev]'); time.sleep(0.4); check(pg.evaluate('GA.tour.state.layer') == 2, f'{name}: "previous layer" button')
                pg.screenshot(path=f'{OUT}/D_{dev.split()[0]}_{lang}_2.png')
                pg.tap('[data-tour=back]'); wait_step(pg, 1); check(pg.evaluate('GA.tour.state.step') == 1, f'{name}: "back" button')
                pg.tap('[data-tour=next]'); wait_step(pg, 2); pg.tap('[data-tour=next]'); wait_step(pg, 3); settle(pg)
                pg.screenshot(path=f'{OUT}/D_{dev.split()[0]}_{lang}_3.png')
                vis = pg.evaluate('''() => [...document.querySelectorAll('#tour-card [data-tour]')].every(b => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0 && r.width > 0; })''')
                check(vis, f'{name}: every tour button visible at step 3 (the card scrolls, the buttons stay)')
                r = pg.evaluate('document.documentElement.scrollWidth <= innerWidth'); check(r, f'{name}: no horizontal overflow at step 3')
                pg.tap('[data-tour=exit]'); time.sleep(0.8)
                check(not pg.evaluate('GA.tour.state.on') and pg.evaluate('GA.app.map.getStyle().layers.filter(l => l.id.startsWith("tour-")).length') == 0, f'{name}: "exit" button returns to the map')
                check(not errs, f'{name}: no page errors', errs[:3]); ctx.close()

        # ---------- E. reduced motion ----------
        if 'E' in ITEMS:
            for motion in ('reduce', 'no-preference'):
                ctx, pg, errs = boot(motion=motion)
                pg.evaluate('''() => { window.__moves = 0; GA.app.map.on('move', () => window.__moves++); }''')
                pg.click('#tour-start'); wait_step(pg, 1); time.sleep(0.15)
                m1 = pg.evaluate('({ moving: GA.app.map.isMoving(), moves: window.__moves })'); time.sleep(2.5); m2 = pg.evaluate('window.__moves')
                if motion == 'reduce': check(not m1['moving'] and m2 <= 2, f'prefers-reduced-motion: the base is shown without a flight ({m2} move events)', (m1, m2))
                else: check(m2 > 10, f'without the preference: an eased flight ({m2} move events)', m2)
                ctx.close()

        # ---------- F. RTL card side, LTR numbers ----------
        if 'F' in ITEMS:
            for lang in ('ar', 'he', 'en'):
                ctx, pg, errs = boot(lang=lang)
                pg.click('#tour-start'); wait_step(pg, 1); settle(pg)
                side = pg.evaluate('(() => { const r = document.querySelector("#tour-card").getBoundingClientRect(); return r.left + r.width / 2 > innerWidth / 2 ? "right" : "left"; })()')
                check(side == ('left' if lang == 'en' else 'right'), f'{lang}: the card sits on the {"left" if lang == "en" else "right"}', side)
                pg.keyboard.press('Enter'); wait_step(pg, 2); pg.keyboard.press('Enter'); wait_step(pg, 3); time.sleep(0.6); settle(pg)
                bad = pg.evaluate(r'''() => { const out = []; const re = /(^|[\s(])[+−]\d|€\d|\d\s?%/; /* "ב-1" (Hebrew prefix + hyphen) is not a sign */ const walk = (n) => { if (n.nodeType === 3) { if (re.test(n.textContent)) { let e = n.parentElement, ok = false; while (e && e.id !== 'tour-card') { if (e.getAttribute('dir') === 'ltr') { ok = true; break; } e = e.parentElement; } if (!ok) out.push(n.textContent.trim().slice(0, 40)); } } else n.childNodes.forEach(walk); };
                  walk(document.querySelector('#tour-card')); return out; }''')
                if lang != 'en': check(not bad, f'{lang}: signed numbers, % and € in the card stay left-to-right', bad[:4])
                pg.screenshot(path=f'{OUT}/F_{lang}_step3.png')
                check(not errs, f'{lang}: no page errors', errs[:3]); ctx.close()
        b.close()
finally:
    srv.terminate()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED:\n  ' + '\n  '.join(fails))
sys.exit(1 if fails else 0)
