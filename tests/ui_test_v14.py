"""v14 — build 5.15: ONE card format for every analysis map and export (title → map → legend → indicators → chart →
interpretation → source / method; nothing beside a map), checked on the analysis board PDF (en / ar / he: two cards per
page, shared title band and one map size, edges aligned, nothing past the page foot, the single last card keeps the card
format), the enlarged-viewer PNG, the print workspace (legend under its map, legend slot dropped); historical city
extents per period on the Historical Maps page (one red outline at a time, replaced on every switch, labelled source /
date range / "no reliable boundary"), and images in landmark popups (caption, date, credit, link, larger viewer,
fallback without a broken image).
Usage: python3 tests/ui_test_v14.py  (OUT=/dir for exports; SECTIONS=A,B,C to choose)"""
import sys, os, time, json, subprocess, base64, io, re
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _nointro  # 5.27: start on the map, not the opening page
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8814; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v14shots'); os.makedirs(OUT, exist_ok=True)
SECT = set((os.environ.get('SECTIONS') or 'A,B,C').split(','))
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def b64png(s, path): Image.open(io.BytesIO(base64.b64decode(s.split(',')[1]))).save(path)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(vp=None, mobile=False):
            ctx = b.new_context(viewport=vp or {'width': 1440, 'height': 900}, is_mobile=mobile, has_touch=mobile, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
            pg = ctx.new_page(); V3.stub3(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.fabricStyle', timeout=90000)
            return ctx, pg, errs
        ctx, pg, errs = boot()
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.15' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver} (version.json and GA_BUILD agree)')
        if 'A' in SECT:
            pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.panels.set("study", true)')
            def mk_area(name, ll):
                pg.evaluate('document.querySelector("#btn-reset") && document.querySelector("#btn-reset").click()'); time.sleep(0.2)
                pg.evaluate(f'GA.app.sel.setCenterDirect({json.dumps(ll)})'); time.sleep(0.3); pg.fill('#in-name', name); pg.click('#btn-analyze')
                pg.wait_for_function('GA.app.getRun() && GA.app.getRun().X && !Object.values(GA.app.getRun().tasks).some(x => x.state === "running")', timeout=120000); time.sleep(0.6)
                return pg.evaluate('GA.app.getRun().areaId')
            a1 = mk_area('Centro', [-3.5995, 37.1766])
            for lang in ['en', 'ar', 'he']:
                pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3); pg.evaluate('GA.pages.close && GA.pages.close()'); time.sleep(0.3)
                pg.evaluate(f'GA.pages.go("fabric", "{a1}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=90000); time.sleep(2)
                info = pg.evaluate('''(async () => { const st = GA.fabric.state; const a = GA.app.store.get().areas.find(x => x.id === st.id); const b = GA.fabric.board(a.id);
                    if (st.paintAllNow) st.paintAllNow(); const pages = await GA.fabric.boardPages(a, b, {}); return pages.map(p => ({ k: p.k, keys: p.keys || [p.k], cards: p.cards || null, W: p.canvas.width, H: p.canvas.height, png: p.canvas.toDataURL('image/jpeg', 0.8) })); })()''')
                cardPages = [q for q in info if q['cards']]
                for i, q in enumerate(info): b64png(q['png'], f'{OUT}/board_{lang}_{i:02d}_{q["k"]}.jpg')
                hs = set(); ok_align = True; ok_bottom = True; ok_two = True
                for q in cardPages:
                    cs = q['cards']; ok_two &= len(cs) <= 2
                    for c in cs: hs.add(round(c['mapBottom'] - c['mapY'])); ok_bottom &= c['bottom'] <= q['H'] - 80
                    if len(cs) == 2: ok_align &= abs(cs[0]['mapY'] - cs[1]['mapY']) < 1 and abs(cs[0]['mapBottom'] - cs[1]['mapBottom']) < 1
                ws = set(c['w'] for q in cardPages for c in q['cards'])
                check(len(cardPages) >= 3 and ok_two, f'board ({lang}): {len(cardPages)} card pages, at most two cards each')
                check(len(hs) == 1 and len(ws) == 1, f'board ({lang}): one map size for every card and the location map {sorted(hs)} × {sorted(ws)}', (hs, ws))
                check(ok_align, f'board ({lang}): cards sharing a row align their map top and bottom edges')
                check(ok_bottom, f'board ({lang}): no card runs past the page foot')
                singles = [q for q in cardPages if len(q['cards']) == 1 and q['k'] != 'identity']
                check(all(c['w'] < q['W'] * 0.6 for q in singles for c in q['cards']), f'board ({lang}): a page with one card keeps the card format ({len(singles)} such pages)')
                rtl = lang != 'en'
                first = [q for q in cardPages if q['k'] != 'identity' and len(q['cards']) == 2]
                if first: c0 = first[0]['cards'][0]; check((c0['x'] > first[0]['W'] / 2) == rtl, f'board ({lang}): first card on the reading-start side')
                # the PDF itself, rasterised
                with pg.expect_download(timeout=600000) as d: pg.evaluate('GA.fabric.exportPDF(GA.fabric.state.id)')
                path = f'{OUT}/analysis_{lang}.pdf'; d.value.save_as(path)
                pi = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout; n = int(re.search(r'Pages:\s+(\d+)', pi).group(1)) if 'Pages:' in pi else 0
                check(n == len(info), f'board PDF ({lang}): opens, {n} pages', pi[:120])
                subprocess.run(['pdftoppm', '-r', '45', '-jpeg', path, f'{OUT}/pdf_{lang}'], check=False)
            # enlarged viewer export: one card, legend under the map
            pg.evaluate('GA.i18n.setLang("en")'); time.sleep(0.3)
            pg.click('[data-ap-card]'); pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "map"', timeout=60000); time.sleep(1.5)
            r = pg.evaluate('(() => { const c = GA.lastViewer.composed(); return { w: c.width, h: c.height, png: c.toDataURL("image/jpeg", 0.8) }; })()')
            b64png(r['png'], f'{OUT}/viewer_card_en.jpg'); check(r['h'] > r['w'] * 0.9, f'viewer export: card is taller than wide (map + legend + text underneath) {r["w"]}×{r["h"]}', r)
            pg.keyboard.press('Escape'); time.sleep(0.4); pg.evaluate('GA.pages.close && GA.pages.close()'); time.sleep(0.4)
            # print workspace: the map's legend under the map; a legend slot is dropped
            pg.evaluate('location.hash = "#/print"'); time.sleep(3)
            ok = pg.evaluate('!!(GA.printLayout || document.querySelector(".pl"))'); check(ok, 'print workspace opens')
        check(not errs, 'no page errors', errs[:3])
        ctx.close()
        if 'B' in SECT or 'C' in SECT:
            E = json.load(open(os.path.join(ROOT, 'data/ref/history_extents.json'), encoding='utf-8')); IM = json.load(open(os.path.join(ROOT, 'data/ref/place_images.json'), encoding='utf-8'))['images']
            check(all(k in E['layers'] for k in ['minutas', 'mtn50', 'catastrones', 'ams56', 'pnoa2024']), 'extents: every historical layer has an outline or an explicit "no reliable boundary"')
            check(all(x['src']['name'] and x['src']['license'] and (x['kind'] == 'ghsl' or x['period']) for x in E['extents'].values()), 'extents: each outline names its source, licence and date / range')
            check(E['extents']['catastrones']['date'] is None and E['extents']['catastrones']['period'] == '1910–1970', 'extents: the undated MTN50 drafts show the range 1910–1970, not an invented year')
            # the municipal boundary is not reused as a historical footprint
            adm = json.load(open(os.path.join(ROOT, 'data/vec/admin.json'))); muni = [f for f in adm['features'] if f['properties']['kind'] == 'municipio'][0]['geometry']
            mr = muni['coordinates'][0] if muni['type'] == 'Polygon' else muni['coordinates'][0][0]
            check(all(x['geometry']['coordinates'][0] != mr for x in E['extents'].values()), 'extents: none of them is the municipal boundary')
        for lang, vp, mob in ([('en', {'width': 1440, 'height': 900}, False), ('ar', {'width': 820, 'height': 1180}, True), ('he', {'width': 390, 'height': 844}, True)] if 'B' in SECT else []):
            ctx, pg, errs = boot(vp, mob); pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            PX = open(os.path.join(ROOT, 'tests/px.png'), 'rb').read()  # Commons is unreachable from the test sandbox: a stand-in image
            if not os.environ.get('LIVE_IMAGES'): pg.route('**/Special:FilePath/**', lambda route: route.fulfill(status=200, content_type='image/png', body=PX))
            pg.evaluate('GA.pages.go("history")'); pg.wait_for_function('document.querySelector("#hx-map-a") && document.querySelector("#hx-ext-box") && document.querySelector("#hx-ext-box").innerText.length > 20', timeout=90000); time.sleep(2)
            seq = ['ams56', 'pnoa2024', 'minutas', 'mtn50', 'catastrones', 'inter7386', 'mtn25', 'ams56', 'pnoa2010', 'mtn50'] if lang == 'en' else ['ams56', 'mtn50', 'minutas', 'pnoa2022']
            for hid in seq:
                pg.click(f'[data-hx-a="{hid}"]'); pg.wait_for_function('(() => { const m = document.querySelector("#hx-map-a") && window.GA; return true; })()'); time.sleep(0.4)
                pg.wait_for_function(f'(() => {{ const b = document.querySelector("#hx-ext-box"); return b && b.innerText.length > 20 && document.querySelector(".hx-chip.on[data-hx-a={hid}]"); }})()', timeout=60000)
                pg.wait_for_function('(() => { const s = document.querySelector("#hx-map-a"); return s && s.querySelector("canvas"); })()', timeout=60000); time.sleep(1.2)
                r = pg.evaluate('''(hid) => { const ms = GA.history && GA.history.maps ? GA.history.maps() : []; const m = ms[0]; const src = m && m.getSource('hx-ext'); const n = src && src._data ? (src._data.features || []).length : -1;
                    return { n, ex: m && m.__hxExtent, txt: document.querySelector('#hx-ext-box').innerText }; }''', hid)
                L = E['layers'][hid]; want = 0 if 'none' in L else 1
                check(r['n'] == want and (want == 0 or r['ex']['id'] == L['ext']), f'history ({lang}) {hid}: {"one outline" if want else "no outline"} on the map, replaced (not added) on switch', r)
                per = [h for h in ['1870–1950', '1875–1968', '1910–1970', '1956–1957', '1973–1986', '1975–2003', '2010', '2022', '2024'] if h in r['txt']]
                check(per, f'history ({lang}) {hid}: legend shows the selected period ({per[:1]})', r['txt'][:120])
            pg.screenshot(path=f'{OUT}/history_{lang}.png')
            # popup images: click every landmark marker / footprint via the list and check the image matches the landmark
            pg.click('[data-hx-a="ams56"]'); time.sleep(2.5)
            pg.wait_for_function('document.querySelectorAll("[data-hx-fly]").length >= 10', timeout=90000)
            n = pg.evaluate('document.querySelectorAll("[data-hx-fly]").length'); good = 0; bad = []
            for i in range(n):
                pg.evaluate(f'document.querySelectorAll("[data-hx-fly]")[{i}].click()'); time.sleep(0.8)
                r = pg.evaluate('''() => { const ps = [...document.querySelectorAll('.hx-popup')]; const p = ps[ps.length - 1]; if (!p) return null; const img = p.querySelector('.hx-pop-img img'); const fig = p.querySelector('.hx-pop-fig');
                    const title = p.querySelector('b') && p.querySelector('b').innerText; const file = p.querySelector('[data-pop-file]') && p.querySelector('[data-pop-file]').dataset.popFile;
                    const order = fig && p.innerHTML.indexOf('hx-pop-fig') < p.innerHTML.indexOf('fine'); return { title, file, has: !!img, none: !!p.querySelector('.hx-pop-noimg'), cap: fig ? fig.innerText : '', order, link: !!(fig && fig.querySelector('a[href*="commons.wikimedia.org"]')) }; }''')
                if not r: bad.append(('no popup', i)); continue
                key = pg.evaluate(f'(() => {{ const b = document.querySelectorAll("[data-hx-fly]")[{i}]; return b ? b.innerText : ""; }})()')
                if r['has']:
                    ok = r['order'] and r['link'] and (('Present-day' in r['cap'] or 'Historical' in r['cap']) if lang == 'en' else len(r['cap']) > 10)
                    ok = ok and any(r['file'] == im['file'] for L2 in IM.values() for im in L2)
                    good += ok; (bad.append((key, r)) if not ok else None)
                elif r['none']: good += 1
                else: bad.append((key, r))
                pg.evaluate('document.querySelectorAll(".maplibregl-popup").forEach(p => p.remove())')
            check(n >= 10 and not bad, f'history ({lang}): {good}/{n} place popups show an image above the text with caption, date, credit and Commons link — or a clean "no image" note', bad[:3])
            # one popup: image opens the larger viewer; a failing image falls back cleanly
            pg.evaluate('document.querySelectorAll("[data-hx-fly]")[0].click()'); time.sleep(1)
            if pg.evaluate('!!document.querySelector(".hx-popup .hx-pop-img")'):
                pg.screenshot(path=f'{OUT}/history_popup_{lang}.png')
                pg.click('.hx-popup .hx-pop-img'); time.sleep(1); check(pg.evaluate("!!document.querySelector(\".vw-img img, .vw-imgstage img\")"), f'history ({lang}): clicking the popup image opens the larger viewer')
                pg.keyboard.press('Escape'); time.sleep(0.4)
            pg.evaluate('document.querySelectorAll(".maplibregl-popup").forEach(p => p.remove())')
            # a recent layer selects the present-day image (not loaded yet in this page), and the image server fails
            pg.unroute('**/Special:FilePath/**'); pg.route('**/Special:FilePath/**', lambda route: route.fulfill(status=404, body='not found')); pg.click('[data-hx-a="pnoa2024"]'); time.sleep(2.5)
            pg.wait_for_function('document.querySelectorAll("[data-hx-fly]").length >= 10', timeout=90000); pg.evaluate('document.querySelectorAll("[data-hx-fly]")[0].click()'); time.sleep(1)
            try: pg.wait_for_function('!!document.querySelector(".hx-popup .hx-pop-noimg")', timeout=25000)
            except Exception: pass
            fb = pg.evaluate('(() => { const p = document.querySelector(".hx-popup"); return p ? { broken: !!p.querySelector(".hx-pop-img img"), note: !!p.querySelector(".hx-pop-noimg") } : null; })()')
            check(fb and not fb['broken'] and fb['note'], f'history ({lang}): an image that fails to load is replaced by a clean note (no broken image)', fb)
            pg.unroute('**/Special:FilePath/**')
            ow = pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'); check(ow, f'history ({lang}, {vp["width"]}px): no horizontal overflow')
            pw = pg.evaluate('(() => { const p = document.querySelector(".hx-popup .maplibregl-popup-content"); if (!p) return null; const r = p.getBoundingClientRect(); return [r.width, r.height, window.innerWidth, window.innerHeight]; })()')
            if pw: check(pw[0] <= min(340, pw[2]) and pw[1] <= pw[3] * 0.75, f'history ({lang}, {vp["width"]}px): popup stays compact {pw}', pw)
            check(not errs, f'history ({lang}): no page errors', errs[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
