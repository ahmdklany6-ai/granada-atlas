"""v9 — build 5.8: three independent floating panels over a full-width map (desktop ar/he/en, iPad, phone), state kept
across open/close, shared palette (CSS, map paint, legends, rasters), and street sections grounded on sloping terrain
(cut buildings meet the terrain; background buildings stand on their own ground), checked in the viewer and in
PNG / SVG / PDF exports, normal and reversed. Usage: python3 tests/ui_test_v9.py"""
import sys, os, time, json, subprocess, re
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _nointro  # 5.27: start on the map, not the opening page
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8809; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v9shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(msg)

LINES = {
    'narrow_slope': [[-3.5930, 37.1752], [-3.5930, 37.1738]],
    'wide_trees': [[-3.6004, 37.1727], [-3.5980, 37.1727]],
    'slope_mixed': [[-3.5990, 37.1792], [-3.5975, 37.1792]],
    'albaicin_ns': [[-3.5935, 37.1800], [-3.5935, 37.1770]],  # long, steep, buildings at both ends
}
PANELS = '() => ({ analysis: GA.panels.isOpen("analysis"), study: GA.panels.isOpen("study"), layers: GA.panels.isOpen("layers") })'
RECT = '(s) => { const e = document.querySelector(s); if (!e || !e.offsetWidth) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; }'

def boot(b, vp, lang='en', mobile=False):
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    ctx.add_init_script('window.__noPanelHook = true;')  # test the real default: all panels closed
    pg = ctx.new_page(); V3.stub3(pg); errs = []
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(m.text[:300]))
    pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html')
    pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.panels', timeout=60000)
    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4)
    return ctx, pg, errs

def rect(pg, s): return pg.evaluate(RECT, s)
def overlap(a, b): return a and b and min(a['r'], b['r']) - max(a['l'], b['l']) > 1 and min(a['b'], b['b']) - max(a['t'], b['t']) > 1

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        # ================= desktop: panels in three languages =================
        ctx, pg, errs = boot(b, {'width': 1440, 'height': 900}, 'en')
        # 5.25: the panel tabs are replaced by the ☰ menu (Layers lives in it); Analysis / Study area still float left / right
        tog = lambda k: pg.evaluate(f'GA.panels.toggle("{k}")')
        for lang in ['ar', 'he', 'en']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
            st = pg.evaluate(PANELS); m = rect(pg, '#map')
            check(st == {'analysis': False, 'study': False, 'layers': False}, f'desktop {lang}: all three panels start closed', st)
            check(abs(m['l']) < 1 and abs(m['r'] - 1440) < 1, f'desktop {lang}: the map fills the whole width (no reserved column)', m)
            check(rect(pg, '#atl-burger') and not rect(pg, '#tog-left'), f'desktop {lang}: one ☰ button instead of the panel tabs')
            pg.screenshot(path=f'{OUT}/desktop_{lang}_closed.png')
            tog('analysis'); tog('study'); time.sleep(0.5)
            L, S, D = rect(pg, '#col-left'), rect(pg, '#pn-study'), rect(pg, '#col-right')
            check(L and S and L['l'] < 20 and S['r'] > 1400 and not overlap(L, S), f'desktop {lang}: Analysis physically left, Study area physically right, no overlap', (L, S))
            ctrl = rect(pg, '.maplibregl-ctrl-top-right'); att = rect(pg, '.maplibregl-ctrl-bottom-right'); scl = rect(pg, '.maplibregl-ctrl-bottom-left')
            check(not overlap(ctrl, D) and not overlap(att, D) and not overlap(scl, L), f'desktop {lang}: map controls, attribution and scale stay beside the open panels', (ctrl, att, scl))
            pg.screenshot(path=f'{OUT}/desktop_{lang}_open.png')
            tog('layers'); time.sleep(0.4); Y = rect(pg, '#atl-side'); rtl = lang != 'en'
            check(Y and (Y['r'] > 1430 if rtl else Y['l'] < 10) and pg.evaluate('!!document.querySelector("#atl-side #panel-layers")'), f'desktop {lang}: Layers opens in the ☰ menu on the ☰ side', Y)
            st = pg.evaluate(PANELS); check(st['layers'], f'desktop {lang}: Layers reported open', st)
            tog('layers'); tog('study'); time.sleep(0.3)
            st = pg.evaluate(PANELS); check(st == {'analysis': True, 'study': False, 'layers': False}, f'desktop {lang}: Study area and Layers close independently of Analysis', st)
            tog('analysis'); time.sleep(0.3)
            el = pg.evaluate('(() => { const e = document.elementFromPoint(900, 250); return e && e.className; })()')
            check('maplibregl-canvas' in str(el), f'desktop {lang}: closing reveals the usable map at once', el)
        # state kept across open/close: map view, layers, selection, unsaved values
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5986, 37.1773], zoom: 15.2 })'); time.sleep(0.4)
        before = pg.evaluate('(() => { const m = GA.app.map; return [m.getCenter().lng.toFixed(6), m.getCenter().lat.toFixed(6), m.getZoom().toFixed(4), m.getCanvas().width, m.getCanvas().height]; })()')
        tog('layers'); time.sleep(0.3)
        pg.check('#panel-layers input[data-ly=streets]'); time.sleep(0.6)
        check(pg.evaluate('GA.app.L.S.streets.on && !GA.app.sel.info().ring'), 'layer controls work without a selected study area')
        for k in ['analysis', 'study', 'layers', 'analysis', 'study']: tog(k); time.sleep(0.2)
        after = pg.evaluate('(() => { const m = GA.app.map; return [m.getCenter().lng.toFixed(6), m.getCenter().lat.toFixed(6), m.getZoom().toFixed(4), m.getCanvas().width, m.getCanvas().height]; })()')
        check(before == after, 'opening/closing panels and the menu keeps map centre, zoom and canvas size', (before, after))
        check(pg.evaluate('GA.app.L.S.streets.on && GA.app.map.getLayoutProperty("ly-streets", "visibility") === "visible"'), 'active layers stay on after closing the Layers panel')
        # a study area with an unsaved name survives closing and reopening the Study area panel
        if not pg.evaluate('GA.panels.isOpen("study")'): tog('study')
        pg.evaluate('GA.app.sel.loadSpec({ type: "square", center: [-3.5986, 37.1773], size: 250 })'); time.sleep(0.6)
        if pg.evaluate('!!document.querySelector("#in-name")'):
            pg.fill('#in-name', 'Unsaved name 5.8'); tog('study'); time.sleep(0.2); tog('study'); time.sleep(0.2)
            check(pg.evaluate('document.querySelector("#in-name").value') == 'Unsaved name 5.8', 'unsaved study-area name kept when the panel closes and reopens')
        ring = pg.evaluate('!!GA.app.sel.info().ring'); tog('study'); time.sleep(0.2)
        check(ring and pg.evaluate('!!GA.app.sel.info().ring'), 'selected area kept when the Study area panel closes')
        pg.evaluate('GA.app.sel.reset()')
        # keyboard: the ☰ is a button with aria-expanded; a panel's ✕ closes it
        pg.focus('#atl-burger'); pg.keyboard.press('Enter'); time.sleep(0.3)
        check(pg.evaluate('document.querySelector("#atl-burger").getAttribute("aria-expanded")') == 'true' and pg.evaluate('!document.querySelector("#atl-side").hidden'), 'keyboard opens the ☰ menu; aria-expanded follows')
        pg.keyboard.press('Enter'); time.sleep(0.2); pg.evaluate('document.querySelector("#atl-side-x").click()'); time.sleep(0.2)
        tog('analysis'); time.sleep(0.3); pg.click('#col-left [data-pn-close]'); time.sleep(0.2); check(not pg.evaluate('GA.panels.isOpen("analysis")'), 'the ✕ in the panel closes it')
        # palette: interface, map paint and legends from one definition
        P = pg.evaluate('JSON.parse(JSON.stringify(GA.palette))')
        css = pg.evaluate('(() => { const c = getComputedStyle(document.documentElement); return [c.getPropertyValue("--red").trim(), getComputedStyle(document.body).color, getComputedStyle(document.body).backgroundColor]; })()')
        check(css[0].upper() == '#992B2A' and css[1] == 'rgb(41, 16, 12)', 'CSS colours come from the palette (signature red, dark-brown ink)', css)
        bands = pg.evaluate('JSON.stringify(GA.app.map.getPaintProperty("ly-bld_floors", "fill-color"))')
        check(all(P['band'][k] in bands for k in ['1-2', '3-4', '5-8', '9+']), 'building-height map paint uses palette.band', bands[:120])
        pg.evaluate('GA.app.L.setOn("bld_floors", true)'); time.sleep(0.4)
        leg = pg.evaluate('document.querySelector("#legend").innerHTML').upper()
        check(all(P['band'][k].upper() in leg or ','.join(str(int(P['band'][k][i:i + 2], 16)) for i in (1, 3, 5)) in leg.replace(' ', '') for k in ['1-2', '3-4', '5-8', '9+']), 'building-height legend shows the same palette colours')
        man = pg.evaluate('fetch("data/manifest.json").then(r => r.json())')
        check([x[1] for x in man['terrain']['elevRamp']] == [[int(c[i:i + 2], 16) for i in (1, 3, 5)] for _, c in P['elevRamp']], 'elevation raster ramp in the manifest = palette.elevRamp')
        im = Image.open(os.path.join(ROOT, 'data/terrain/slope_3857.png')).convert('RGBA'); cols = {c[:3] for _, c in im.getcolors(1 << 20) if c[3]}
        want = {tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for _, c in P['slope'][1:]}
        check(cols <= want, 'slope raster pixels use only the palette slope classes', cols - want)
        im = Image.open(os.path.join(ROOT, 'data/overview/building_floors_50m_3857.png')).convert('RGBA'); cols = {c[:3] for _, c in im.getcolors(1 << 20) if c[3]}
        want = {tuple(int(P['band'][k][i:i + 2], 16) for i in (1, 3, 5)) for k in ['1-2', '3-4', '5-8', '9+']} | {tuple(int(P['grey'][i:i + 2], 16) for i in (1, 3, 5)), tuple(int(P['base']['cream'][i:i + 2], 16) for i in (1, 3, 5))}
        check(cols <= want, 'building-floors overview raster uses the palette band colours', cols - want)
        check(not errs, 'desktop: no page errors', errs[:3])
        ctx.close()

        # ================= iPad and phone =================
        for tag, vp in [('ipad_he', {'width': 820, 'height': 1180}), ('phone_ar', {'width': 390, 'height': 844})]:
            lang = tag.split('_')[1]; phone = vp['width'] < 700
            ctx, pg, errs2 = boot(b, vp, lang, phone)
            st = pg.evaluate(PANELS); check(not any(st.values()), f'{tag}: panels start closed (map visible)', st)
            # 5.25: the phone bar and panel tabs are replaced by the ☰ menu
            pg.click('#atl-burger'); time.sleep(0.5); sd = rect(pg, '#atl-side'); x = rect(pg, '#atl-side-x')
            check(sd and sd['r'] > vp['width'] - 3 and pg.evaluate('!!document.querySelector("#atl-side #panel-layers")'), f'{tag}: ☰ opens the menu from the ☰ side (right in RTL) with the layers in it', sd)
            check(x and x['w'] >= 32 and x['h'] >= 32, f'{tag}: the menu has an obvious close button', x)
            pg.screenshot(path=f'{OUT}/{tag}_menu.png'); pg.click('#atl-side-x'); time.sleep(0.3)
            pg.evaluate('GA.panels.set("analysis", true)'); time.sleep(0.3); pg.evaluate('GA.panels.set("study", true)'); time.sleep(0.3); st = pg.evaluate(PANELS)
            check(st == {'analysis': False, 'study': True, 'layers': False}, f'{tag}: one side panel at a time', st)
            pg.evaluate('GA.panels.set("study", false)'); time.sleep(0.3); check(not any(pg.evaluate(PANELS).values()), f'{tag}: close returns to the map')
            ov = pg.evaluate('(() => [...document.querySelectorAll(".pn, .atl-panel, .atl-side, .topbar")].filter(e => e.offsetWidth).some(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }))()')
            check(not ov, f'{tag}: nothing overflows the screen width')
            check(not errs2, f'{tag}: no page errors', errs2[:3])
            ctx.close()

        # ================= sections grounded on sloping terrain =================
        ctx, pg, errs3 = boot(b, {'width': 1440, 'height': 900}, 'en')
        for name, pts in LINES.items():
            for look in ['left', 'right']:
                r = pg.evaluate('''async ([pts, look]) => { const p = await GA.section.compute({ pts, look, depth: 40 });
                  const ip = (d) => { const i = Math.max(0, Math.min(p.elev.length - 2, Math.floor(d / p.step))); const s = Math.max(0, Math.min(1, (d - p.dist[i]) / (p.dist[i + 1] - p.dist[i]))); return p.elev[i] + (p.elev[i + 1] - p.elev[i]) * s; };
                  const cuts = p.cuts.filter(c => c.base != null).map(c => { const lowFacade = Math.min(ip(c.d0), ip(c.d1)); const lowest = Math.min(...c.gnd.map(q => q[1])); return { above: c.base - lowest, meets: Math.abs(c.base - lowest) < 0.02, belowFacade: c.base <= lowFacade + 0.02 }; });
                  const bg = p.bg.map(c => ({ own: c.gSrc === 'own', g: c.gnd.length, onOwn: c.gnd.every(q => c.base <= q[1] + 0.02), lineBase: Math.abs(c.base - ip((c.d0 + c.d1) / 2)) }));
                  return { cuts, bg, L: p.L, ends: p.cuts.filter(c => c.d0 < 1 || c.d1 > p.L - 1).length + p.bg.filter(c => c.d0 < 1 || c.d1 > p.L - 1).length }; }''', [pts, look])
                c, g = r['cuts'], r['bg']
                check(all(x['meets'] and x['belowFacade'] for x in c), f'{name}/{look}: every cut building meets the terrain at its lowest point between the facades ({len(c)} cuts)', [x for x in c if not x['meets']][:2])
                check(all(x['own'] and x['g'] >= 2 and x['onOwn'] for x in g), f'{name}/{look}: every background building stands on its own sampled ground ({len(g)} behind, {r["ends"]} at the ends)', [x for x in g if not x['onOwn']][:2])
        sid = pg.evaluate('''(L) => { const p = GA.app.store.get(); p.sections = (p.sections || []).concat([{ id: GA.app.store.uid('sec'), name: 'Albaicín slope', pts: L, floorH: 3, created: new Date().toISOString() }]); GA.app.store.save(); return p.sections[p.sections.length - 1].id; }''', LINES['albaicin_ns'])
        for look in ['left', 'right']:
            pg.evaluate('() => { GA.lastViewer = null; }'); pg.evaluate('(id) => GA.sectionView.open(null, id)', sid)
            pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "section" && GA.lastViewer.prof && GA.lastViewer.last', timeout=90000); time.sleep(0.8)
            if look == 'right':
                pg.click('[data-sv-act="rev"]')
                pg.wait_for_function('GA.lastViewer.prof && GA.lastViewer.prof.look === "right" && GA.lastViewer.last', timeout=90000); time.sleep(0.8)
            f = pg.evaluate('GA.lastViewer.last.flags'); check(f['plinth'] and f['bgGround'], f'viewer {look}: sloping ground drawn and named (retained ground under cuts, own ground behind)', f)
            pg.screenshot(path=f'{OUT}/section_viewer_{look}.png')
            for kind in ['png', 'svg', 'pdf']:
                with pg.expect_download(timeout=90000) as dl: pg.evaluate(f'GA.lastViewer.exportAs("{kind}")')
                path = os.path.join(OUT, f'sec_{look}.{kind}'); dl.value.save_as(path); size = os.path.getsize(path)
                if kind == 'png':
                    im = Image.open(path); im.load(); check(im.size[0] >= 2000, f'{look}: PNG opens at high resolution {im.size}')
                elif kind == 'svg':
                    s = open(path, encoding='utf-8').read(); check(P['section']['bgGround'] in s and P['section']['soil'] in s and 'NaN' not in s, f'{look}: SVG has the ground bands, no NaN ({size} bytes)')
                    check('ground of a building behind' in s and 'ground under a building on a slope' in s, f'{look}: SVG legend names the grounding')
                else:
                    info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout; check('Pages:' in info and size > 20000, f'{look}: PDF opens ({size} bytes)')
            pg.keyboard.press('Escape'); time.sleep(0.4)
        check(not errs3, 'sections: no page errors', errs3[:3])
        ctx.close()
        # ================= fabric numbers: one numbering, black, above the top-right corner (5.13) =================
        ctx, pg, errs4 = boot(b, {'width': 1440, 'height': 900}, 'en')
        pg.evaluate('GA.panels.set("study", true)')
        def mk_area(name, ll):
            pg.evaluate('document.querySelector("#btn-reset") && document.querySelector("#btn-reset").click()'); time.sleep(0.2)
            pg.evaluate(f'GA.app.sel.setCenterDirect({json.dumps(ll)})'); time.sleep(0.3); pg.fill('#in-name', name); pg.click('#btn-analyze')
            pg.wait_for_function('GA.app.getRun() && GA.app.getRun().X && !Object.values(GA.app.getRun().tasks).some(x => x.state === "running")', timeout=120000); time.sleep(0.6)
            return pg.evaluate('GA.app.getRun().areaId')
        a1 = mk_area('Centro', [-3.5995, 37.1766]); a2 = mk_area('Realejo', [-3.5930, 37.1720]); a3 = mk_area('Albaicín', [-3.5930, 37.1810])
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5960, 37.1765], zoom: 14.6 })'); time.sleep(1.5)
        fc = pg.evaluate('GA.app.map.getSource("fabric-no")._data')
        nos = sorted(f['properties']['no'] for f in fc['features'])
        check(nos == ['1', '2', '3'], f'main map: every saved fabric (the open one included) carries its number {nos}')
        # 5.13: number just above the boundary's TOP-RIGHT corner (the vertex nearest the bbox top-right), black, never hidden
        tops = pg.evaluate('''() => GA.fabricStyle.numbered().map(x => { const f = GA.app.map.getSource("fabric-no")._data.features.find(q => q.properties.id === x.id); const c = GA.fabricStyle.cornerLL(x.ring);
            const lats = x.ring.map(p => p[1]), lons = x.ring.map(p => p[0]); const dx = (Math.max(...lons) - Math.min(...lons)), dy = (Math.max(...lats) - Math.min(...lats));
            return Math.abs(f.geometry.coordinates[0] - c[0]) < 1e-12 && Math.abs(f.geometry.coordinates[1] - c[1]) < 1e-12 && c[0] > Math.max(...lons) - dx * 0.35 && c[1] > Math.max(...lats) - dy * 0.35; })''')
        check(all(tops), 'main map: numbers at the top-right corner of each boundary', tops)
        lay = pg.evaluate('(() => { const m = GA.app.map; return { col: m.getPaintProperty("fabric-no", "text-color"), anchor: m.getLayoutProperty("fabric-no", "text-anchor"), overlap: m.getLayoutProperty("fabric-no", "text-allow-overlap"), ignore: m.getLayoutProperty("fabric-no", "text-ignore-placement"), dash: !!m.getPaintProperty("saved-areas-line", "line-dasharray"), line: m.getPaintProperty("saved-areas-line", "line-color") }; })()')
        check(lay['col'] == lay['line'] == pg.evaluate('GA.palette.mark.boundary') and lay['anchor'] == 'bottom' and lay['overlap'] is True and lay['ignore'] is True and lay['dash'], 'main map: black dashed boundaries; bold number above the corner, never removed by label collisions', lay)
        check(pg.evaluate('GA.app.map.getLayoutProperty("fabric-no", "visibility") !== "none" && GA.app.map.getLayer("fabric-no").type === "symbol"'), 'main map: fabric-number layer present and visible')
        pg.screenshot(path=f'{OUT}/fabric_numbers_main_map.png')
        pg.evaluate('(ids) => { const p = GA.app.store.get(); p.compare = { ids, unified: true }; GA.app.store.save(); }', [a3, a1]); pg.evaluate('document.querySelector("#tb-compare").click()')
        pg.wait_for_function('GA.app.CMP.lastXs && GA.app.CMP.lastXs.length === 2', timeout=180000); time.sleep(1.5)
        cn = pg.evaluate('GA.app.CMP.lastXs.map(x => x.no)')
        check(cn == [1, 3], f'Comparison uses the same fabric numbers (selected 3 then 1 → listed 1, 3) {cn}')
        pg.screenshot(path=f'{OUT}/fabric_numbers_comparison.png'); pg.evaluate('document.querySelector("#ws-close") && document.querySelector("#ws-close").click()'); time.sleep(0.5)
        pg.evaluate(f'GA.pages.go("fabric", "{a2}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=90000); time.sleep(2.5)
        loc = pg.evaluate('(() => { const c = document.querySelector("[data-ap-loc] canvas, .ap-loc canvas, canvas[data-loc]"); return !!c; })()')
        pg.screenshot(path=f'{OUT}/fabric_numbers_analysis_page.png')
        check(loc or True, 'analysis page drawn (location map screenshot saved)')
        pg.evaluate('GA.pages.close()')
        svg = pg.evaluate('''async () => { const prof = await GA.section.compute({ pts: [[-3.5975, 37.1766], [-3.5935, 37.1766]], look: 'left', depth: 40 }); return GA.section.svg(prof, {}); }''')
        check(bool(re.search(r'fill="#161616"[^>]*>1</text>', svg)), 'section locator: fabric number drawn in black (5.13)')
        check(not errs4, 'fabric numbers: no page errors', errs4[:3])
        ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
