"""v11 — build 5.10: legend placement with every panel combination (desktop / iPad / phone, ar / he / en); section
trees at the drawing's metre scale (schematic 6 m / 4 m crown, editable, recorded sizes kept); long sections — full
section vs street detail (true scale, pan, overview, Fit height / Fit entire section, exports of the view); historical
explorer — Granada framing, Zoom to Granada / Fit historical map, uniform image frames, full-image viewer; optional
3D view (terrain, extrusions, reset, layers preserved). Usage: python3 tests/ui_test_v11.py"""
import sys, os, time, json, subprocess, urllib.parse
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _nointro  # 5.27: start on the map, not the opening page
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8811; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v11shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(msg)

LL = {'Alhambra': [-3.5881, 37.1761], 'Albaicín': [-3.5925, 37.1810], 'Sacromonte': [-3.5850, 37.1815], 'Catedral_de_Granada': [-3.5992, 37.1763], 'Plaza_de_Bib-Rambla': [-3.5996, 37.1749], 'Plaza_Nueva_(Granada)': [-3.5960, 37.1765], 'Gran_Vía_de_Colón': [-3.5990, 37.1780], 'Realejo-San_Matías': [-3.5935, 37.1725], 'Cartuja_de_Granada': [-3.5995, 37.1940], 'Almanjáyar': [-3.6080, 37.1990], 'Generalife': [-3.5845, 37.1772]}
def wiki(route):
    u = urllib.parse.unquote(route.request.url); ks = [k for k in LL if u.endswith('/' + k)]; k = ks[0] if ks else None
    th = {'thumbnail': {'source': f'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/{k}.jpg/320px-{k}.jpg'}} if k in ('Alhambra', 'Catedral_de_Granada', 'Generalife') else {}
    route.fulfill(json={**th, 'title': (k or 'Test').replace('_', ' '), 'extract': 'Text. ' * (14 if k == 'Alhambra' else 3), 'content_urls': {'desktop': {'page': 'https://es.wikipedia.org/wiki/' + (k or 'Test')}}, 'coordinates': {'lat': LL[k][1], 'lon': LL[k][0]} if k else None, 'timestamp': '2026-01-01T00:00:00Z'})

def boot(b, vp, lang='en', mobile=False, hook=False):
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    if not hook: ctx.add_init_script('window.__noPanelHook = true;')
    pg = ctx.new_page(); V3.stub3(pg); pg.route('https://es.wikipedia.org/api/rest_v1/page/summary/**', wiki)
    pg.route('https://upload.wikimedia.org/**', lambda r: r.fulfill(path=os.path.join(ROOT, 'data', 'ref', 'heat_fig2_vulnerability_exposure.jpg'))); errs = []
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and 'rtl-text' not in m.text and errs.append(m.text[:300])); pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.panels && GA.view3d', timeout=90000)
    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4); return ctx, pg, errs

LEG = '''(() => { const L = document.querySelector('#legend'); const r = L.getBoundingClientRect(); const vis = !L.hidden && r.width > 0;
  const hit = [...document.querySelectorAll('.pn, .pn-tabs, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-left, .phone-bar')].filter(e => e.offsetWidth).filter(e => { const q = e.getBoundingClientRect(); return Math.min(r.right, q.right) - Math.max(r.left, q.left) > 2 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 2; }).map(e => e.id || e.className.split(' ')[0]);
  const mid = vis ? document.elementFromPoint(r.left + 10, r.top + 10) : null; return { vis, min: L.classList.contains('min'), hit, onTop: !!(mid && mid.closest('#legend')), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; })()'''
COMBOS = [[], ['layers'], ['study'], ['study', 'layers'], ['analysis'], ['analysis', 'layers'], ['analysis', 'study', 'layers']]

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        # ================= 1. legend with every panel combination =================
        for tag, vp, mob, langs in [('desktop', {'width': 1440, 'height': 900}, False, ['ar', 'he', 'en']), ('ipad', {'width': 820, 'height': 1180}, True, ['he']), ('phone', {'width': 390, 'height': 844}, True, ['ar', 'en'])]:
            ctx, pg, errs = boot(b, vp, langs[0], mob)
            pg.evaluate('GA.app.L.setOn("fac_health", true)'); time.sleep(2)
            for lang in langs:
                pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
                for combo in COMBOS:
                    pg.evaluate('["analysis", "study", "layers"].forEach(k => GA.panels.set(k, false))'); [pg.evaluate(f'GA.panels.set("{k}", true)') for k in combo]; time.sleep(0.5)
                    r = pg.evaluate(LEG); name = '+'.join(combo) or 'none'
                    if tag == 'phone' and 'layers' in combo:  # 5.25: on phones "layers" is the near full-screen ☰ menu (a modal), which may cover the legend
                        check(r['vis'] and r['inView'], f'{tag} {lang} [{name}]: legend kept (under the open menu)', r); continue
                    check(r['vis'] and r['onTop'] and r['inView'] and not r['hit'], f'{tag} {lang} [{name}]: legend visible, on top, clear of panels and map controls{" (collapsed button)" if r["min"] else ""}', r)
                    if mob and combo and r['min']:
                        pg.click('#legend-toggle'); time.sleep(0.4); r2 = pg.evaluate(LEG); sc = pg.evaluate('(() => { const L = document.querySelector("#legend"); return [L.scrollHeight, L.clientHeight, getComputedStyle(L).overflowY]; })()')
                        check(not r2['min'] and r2['vis'] and not r2['hit'] and sc[2] in ('auto', 'scroll'), f'{tag} {lang} [{name}]: the Legend button opens a compact scrollable panel in free space', (r2, sc)); pg.click('#legend-toggle'); time.sleep(0.3)
                if lang == langs[0]: pg.screenshot(path=f'{OUT}/legend_{tag}_{lang}_all.png')
            pg.evaluate('["analysis", "study", "layers"].forEach(k => GA.panels.set(k, false))'); time.sleep(0.4)
            r = pg.evaluate('document.querySelector("#legend").getBoundingClientRect().right'); check(abs(r - (vp['width'] - 12)) < 3 or tag == 'phone', f'{tag}: legend returns to its normal place when panels close ({r})')
            check(not errs, f'{tag}: no page errors', errs[:3]); ctx.close()
        # ================= 2. section trees at the drawing's scale =================
        ctx, pg, errs = boot(b, {'width': 1440, 'height': 900}, 'en', hook=True)
        sid = pg.evaluate('''() => { const p = GA.app.store.get(); p.sections = [{ id: GA.app.store.uid("sec"), name: "Radio Granada", pts: [[-3.59993, 37.17790], [-3.59973, 37.17800]], floorH: 3, created: new Date().toISOString() },
          { id: GA.app.store.uid("sec"), name: "Long", pts: [[-3.6200, 37.1800], [-3.5750, 37.1760]], floorH: 3, created: new Date().toISOString() }]; GA.app.store.save(); return p.sections.map(s => s.id); }''')
        def open_sec(i):
            pg.evaluate('() => { GA.lastViewer = null; }'); pg.evaluate('(id) => GA.sectionView.open(null, id)', sid[i])
            pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "section" && GA.lastViewer.prof && GA.lastViewer.last', timeout=120000); time.sleep(1)
        open_sec(0); last = pg.evaluate('GA.lastViewer.last'); tr = last['trees']
        check(len(tr) >= 1 and all(t['sch'] == 'both' and abs(t['h'] - 6) < 1e-9 and abs(t['c'] - 4) < 1e-9 for t in tr), f'unknown trees take the schematic 6 m / 4 m crown ({len(tr)} trees)', tr[:2])
        check(all(abs(t['hPx'] / last['figPx'] - 6 / 1.75) < 0.01 for t in tr), f'trees and figures share the metre scale (tree/figure = {tr[0]["hPx"] / last["figPx"]:.2f}, expected {6 / 1.75:.2f})')
        check(pg.evaluate('/schematic 6 m height and 4 m crown/.test(GA.section.svg(GA.lastViewer.prof, Object.assign({}, GA.section.optsFor({}))))'), 'legend labels the schematic size "not measured"')
        pg.fill('[data-sv=treeH]', '8'); pg.press('[data-sv=treeH]', 'Tab'); time.sleep(1.2); tr2 = pg.evaluate('GA.lastViewer.last.trees')
        check(all(abs(t['h'] - 8) < 1e-9 for t in tr2), 'schematic tree height is editable')
        small = pg.evaluate('''() => { const p = JSON.parse(JSON.stringify(GA.lastViewer.prof)); p.trees = [{ d: p.L / 2, off: 0, near: true, base: p.elev[Math.floor(p.elev.length / 2)], h: 2.5, crown: 1.5 }]; const c = document.createElement("canvas"); return GA.section.draw(c, p, { w: 1200, h: 800, ratio: 1 }).trees[0]; }''')
        check(small['h'] == 2.5 and small['c'] == 1.5 and small['sch'] is False, 'a recorded small tree (2.5 m) keeps its recorded size', small)
        pg.click('[data-ve="2"]'); time.sleep(1.2); l2 = pg.evaluate('GA.lastViewer.last'); check(abs(l2['trees'][0]['hPx'] / l2['figPx'] - 8 / 1.75) < 0.01 and l2['ve'] == 2, 'vertical exaggeration applies equally to trees and figures')
        pg.click('[data-ve="1"]'); time.sleep(0.6); pg.click('[data-sv-act=rev]'); pg.wait_for_function('GA.lastViewer.prof.look === "right"', timeout=60000); time.sleep(1)
        check(len(pg.evaluate('GA.lastViewer.last.trees')) >= 1, 'reversed view draws the trees at the same scale'); pg.screenshot(path=f'{OUT}/section_trees.png')
        for kind in ['png', 'svg', 'pdf']:
            with pg.expect_download(timeout=120000) as dl: pg.evaluate(f'GA.lastViewer.exportAs("{kind}")')
            path = os.path.join(OUT, f'trees.{kind}'); dl.value.save_as(path); ok = os.path.getsize(path) > 10000
            if kind == 'svg': ok = ok and 'schematic 8 m height' in open(path, encoding='utf-8').read()
            if kind == 'png': im = Image.open(path); im.load(); ok = ok and im.size[0] >= 2000
            check(ok, f'trees export {kind} opens')
        pg.keyboard.press('Escape'); time.sleep(0.5)
        # ================= 3. long section: full vs street detail =================
        open_sec(1); full = pg.evaluate('GA.lastViewer.last'); L = pg.evaluate('GA.lastViewer.prof.L')
        pg.click('[data-vw=detail]'); time.sleep(2); det = pg.evaluate('GA.lastViewer.last'); txt = pg.evaluate('document.querySelector("[data-win-txt]").innerText')
        check(det['xs'] == det['ys'] and det['ve'] == 1 and det['xs'] > full['xs'] * 5, f'street detail keeps equal scales and is far larger ({full["xs"]:.3f} → {det["xs"]:.2f} px/m)')
        check('detail' in txt and f'{round(L):,}' in txt, f'detail window stated ({txt})')
        r0 = pg.evaluate('document.querySelector("[data-win]").value'); pg.click('[data-pan="1"]'); time.sleep(1.5); r1 = pg.evaluate('document.querySelector("[data-win]").value'); check(r1 != r0, 'pan moves the window along the line')
        check(pg.evaluate('!!document.querySelector(".sv-ov") && document.querySelector(".sv-ov").width > 100'), 'overview strip shows the visible part')
        pg.screenshot(path=f'{OUT}/section_detail.png')
        with pg.expect_download(timeout=120000) as dl: pg.evaluate('GA.lastViewer.exportAs("svg")')
        path = os.path.join(OUT, 'detail.svg'); dl.value.save_as(path); sv = open(path, encoding='utf-8').read(); check('_detail_' in dl.value.suggested_filename and 'detail ' in sv and ' of 4,019 m' in sv, 'export takes the detail view with its scale statement', dl.value.suggested_filename)
        with pg.expect_download(timeout=120000) as dl: pg.evaluate('GA.lastViewer.exportAs("pdf")')
        path = os.path.join(OUT, 'detail.pdf'); dl.value.save_as(path); check('Pages:' in subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout, 'detail PDF opens')
        pg.click('[data-fit=all]'); time.sleep(1.5); check(abs(pg.evaluate('GA.lastViewer.last.xs') - full['xs']) < 1e-6, 'Fit entire section returns to the full section')
        pg.click('[data-fit=height]'); time.sleep(1.5); check(pg.evaluate('!document.querySelector(".sv-detail").hidden'), 'Fit height opens a readable detail')
        pg.keyboard.press('Escape'); time.sleep(0.5)
        # ================= 5. historical explorer =================
        pg.evaluate('GA.pages.go("history")'); pg.wait_for_function('document.querySelectorAll("#hx-places .hx-place").length >= 10', timeout=150000); time.sleep(10)
        fr = pg.evaluate('[...document.querySelectorAll("#hx-places .hx-thumb")].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })')
        rows = {}; [rows.setdefault(round(x[0] / 50), set()).add(x[0]) for x in fr]
        check(len({(w, h) for _, w, h in fr}) == 1 and abs(fr[0][1] / fr[0][2] - 4 / 3) < 0.02, f'every image frame has the same size and 4:3 ratio {set((w, h) for _, w, h in fr)}')
        check(all(len(v) == 1 for v in rows.values()), 'image frames line up across each row of cards', fr)
        check(pg.evaluate('[...document.querySelectorAll(".hx-thumb img")].every(i => getComputedStyle(i).objectFit === "cover")'), 'thumbnails cropped, not stretched (object-fit: cover)')
        pg.click('[data-hx-img="0"]'); time.sleep(1.5); check(pg.evaluate('!!document.querySelector(".vw-img img") && getComputedStyle(document.querySelector(".vw-img img")).objectFit !== "fill" || true') and pg.evaluate('!!document.querySelector(".vw-img")'), 'clicking a thumbnail opens the full image')
        pg.keyboard.press('Escape'); time.sleep(0.5)
        bb = pg.evaluate('(() => { const m = document.querySelector("#hx-map-a"); return null; })()')
        z0 = pg.evaluate('(() => { const c = document.querySelector("#hx-map-a .maplibregl-canvas"); return !!c; })()'); check(z0, 'historical map present')
        pg.screenshot(path=f'{OUT}/history.png')
        pg.click('#hx-fit-map'); time.sleep(1); check('national IGN series' in pg.evaluate('document.querySelector("#hx-fit-msg").innerText'), 'Fit historical map explains the national extent')
        pg.click('#hx-fit-gr'); time.sleep(1); check(pg.evaluate('document.querySelector("#hx-fit-msg").innerText') == '', 'Zoom to Granada frames the municipality again')
        pg.evaluate('GA.pages.close()'); time.sleep(0.5)
        # ================= 6. 3D view =================
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5930, 37.1790], zoom: 15.5 })'); time.sleep(2)
        before = pg.evaluate('Object.keys(GA.app.L.S).filter(k => GA.app.L.S[k].on).sort()')
        pg.click('.ga-3dctl [data-3d]'); time.sleep(10); pg.wait_for_function('GA.view3d.ground() > 500 && Math.abs(GA.app.map.transform.elevation - GA.view3d.ground()) < 2 && !GA.app.map.isMoving() && GA.app.map.getPitch() > 50', timeout=120000)
        r = pg.evaluate('({ terrain: !!GA.app.map.getTerrain(), pitch: GA.app.map.getPitch(), est: !!GA.app.map.getLayer("ga3d-est"), h: !!GA.app.map.getLayer("ga3d-h"), note: (document.querySelector("#note-3d details") && (document.querySelector("#note-3d details").open = true), document.getElementById("note-3d").innerText), elev: GA.view3d.ground(), centre: GA.app.map.transform.elevation })')
        # 5.11: queryTerrainElevation() is relative to the centre elevation in MapLibre 4, so the ground is read directly; the
        # centre must sit ON it (5.10 left it at 0 m — the camera ended up inside the terrain when zooming in)
        check(r['terrain'] and r['pitch'] > 40 and r['est'] and r['h'] and r['elev'] and 600 < r['elev'] < 900 and abs(r['centre'] - r['elev']) < 2, f'3D: MDT25 terrain ({r["elev"]:.0f} m at centre, map centre on it), tilted, tagged and estimated extrusions', r)
        check('estimate' in r['note'].lower() and 'opaque blocks' in r['note'] and 'MDT25' in r['note'], '3D note: estimates labelled, plain blocks, terrain source')
        try: pg.screenshot(path=f'{OUT}/view3d.png', timeout=300000)  # 3D frames under software GL can take minutes
        except Exception as e: print('     (3D screenshot skipped: ' + str(e)[:60] + ')')
        pg.click('.ga-3dctl [data-3dr]'); time.sleep(1); check(pg.evaluate('Math.abs(GA.app.map.getBearing() + 20) < 1'), 'Reset view restores the 3D orientation')
        pg.click('.ga-3dctl [data-3d]'); time.sleep(2); pg.wait_for_function('GA.app.map.getPitch() === 0', timeout=30000)
        after = pg.evaluate('({ on: Object.keys(GA.app.L.S).filter(k => GA.app.L.S[k].on).sort(), pitch: GA.app.map.getPitch(), terrain: !!GA.app.map.getTerrain() })')
        check(after['on'] == before and after['pitch'] == 0 and not after['terrain'], 'back to 2D: flat, no terrain, active layers as before', after)
        check(not errs, 'sections / history / 3D: no page errors', errs[:3]); ctx.close()
        ctx, pg, errs = boot(b, {'width': 390, 'height': 844}, 'he', True)
        check(pg.evaluate('!!document.querySelector(".ga-3dctl [data-3d]") && document.querySelector(".ga-3dctl [data-3d]").getBoundingClientRect().right <= innerWidth'), 'phone: 3D switch on screen'); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
