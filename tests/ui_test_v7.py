"""v7 — street-layer control and progressive reveal, standalone sections (no study area; desktop, tablet, phone;
ar/he/en), classified climate/environment rasters with generated legends, legend/style consistency, plain fabric
numbers with dashed outlines, historical-map overlays (linked places, saved fabrics).
Usage: python3 tests/ui_test_v7.py"""
import sys, os, time, json, subprocess, re
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8807; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v7shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

def boot(b, vp, lang='ar', mobile=False):
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    pg = ctx.new_page(); V3.stub3(pg); errs = []
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(m.text[:300]))
    pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html')
    pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.app.map.getLayer("ly-streets")', timeout=60000)
    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.4)
    return ctx, pg, errs

def draw_section(pg, pts, finish=True):
    pg.click('#map-draw-section'); time.sleep(0.4)
    r = pg.evaluate('(() => { const c = GA.app.map.getCanvas().getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; })()')
    for (fx, fy) in pts:
        x, y = r[0] + r[2] * fx, r[1] + r[3] * fy
        pg.mouse.click(x, y); time.sleep(0.35)
    if finish: pg.click('#mb-finish'); time.sleep(0.6)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])

        # ================= desktop, Arabic =================
        ctx, pg, errs = boot(b, {'width': 1440, 'height': 900})
        # ---- 1. street-layer control ----
        check(pg.evaluate('!!document.querySelector("#panel-layers input[data-ly=streets]")'), 'Layers panel has the street-hierarchy row')
        pg.evaluate('document.querySelector("#panel-layers input[data-ly=streets]").scrollIntoView()')
        if not pg.evaluate('GA.app.L.S.streets.on'): pg.click('#panel-layers input[data-ly=streets]'); time.sleep(0.8)
        check(pg.evaluate('GA.app.L.S.streets.on && GA.app.map.getLayoutProperty("ly-streets-maj", "visibility") === "visible"'), 'checking the box shows the street layers')
        check(pg.evaluate('!!document.querySelector("#panel-layers input[data-ly-op=streets]")'), 'street opacity slider present')
        check('lg-blk' in pg.evaluate('document.querySelector("#legend").innerHTML') and pg.evaluate('/data-ly="streets"/.test(document.querySelector("#legend").innerHTML)'), 'street legend shown')
        pg.click('#panel-layers input[data-ly=streets]'); time.sleep(0.5)
        check(pg.evaluate('!GA.app.L.S.streets.on && ["ly-streets-maj","ly-streets","ly-streets-ped"].every(l => GA.app.map.getLayoutProperty(l, "visibility") === "none")'), 'unchecking hides every street layer')
        check(pg.evaluate('document.querySelector("#panel-layers input[data-ly=streets]").checked') is False, 'checkbox reflects the map state')
        pg.click('#panel-layers input[data-ly=streets]'); time.sleep(0.5)
        op = pg.evaluate('JSON.stringify(GA.app.map.getPaintProperty("ly-streets-ped", "line-opacity"))')
        check(op.startswith('["interpolate"') and 'pedestrian' in op, 'pedestrian opacity grows with zoom (progressive reveal)')
        # pedestrian clutter at 14.5 vs 17
        def ped_alpha(z):
            e = json.loads(op); stops = e[3:]
            zs = stops[0::2]; vs = stops[1::2]
            def val(i): m = vs[i]; mm = m[2]; return mm[mm.index('pedestrian') + 1] * m[1]
            for i in range(len(zs) - 1):
                if zs[i] <= z <= zs[i + 1]: f = (z - zs[i]) / (zs[i + 1] - zs[i]); return val(i) + (val(i + 1) - val(i)) * f
            return val(len(zs) - 1)
        check(ped_alpha(14.6) < 0.25 and ped_alpha(17) > 0.85, f'paths faint at 14.6 ({ped_alpha(14.6):.2f}), strong at 17 ({ped_alpha(17):.2f})')
        pg.evaluate('GA.app.L.setOpacity("streets", 0.5)'); time.sleep(0.2)
        check(pg.evaluate('getComputedStyle(document.querySelector(\'.lg-blk[data-ly="streets"]\')).getPropertyValue("--lg-op").trim()') == '0.5', 'legend swatches follow the opacity slider')
        pg.evaluate('GA.app.L.setOpacity("streets", 1); GA.app.L.setOn("streets", false)')

        # ---- 2. standalone section, no study area ----
        check(pg.evaluate('GA.app.store.get().areas.length') == 0 and not pg.evaluate('!!document.querySelector("#btn-fabric:not([hidden])")'), 'no study area selected')
        check(pg.evaluate('!!document.querySelector("#map-draw-section")'), '"Draw section" control on the main map')
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5986, 37.1773], zoom: 16 })'); time.sleep(0.5)
        # cancel
        draw_section(pg, [(0.3, 0.5), (0.5, 0.5)], finish=False)
        pg.click('#mb-cancel'); time.sleep(0.3)
        check(pg.evaluate('(GA.app.store.get().sections || []).length') == 0 and pg.evaluate('document.querySelector("#mode-banner").hidden'), 'Cancel discards the drawing')
        # undo + multi-segment
        draw_section(pg, [(0.25, 0.5), (0.4, 0.4), (0.75, 0.3)], finish=False)
        pg.click('#mb-undo'); time.sleep(0.3)
        r = pg.evaluate('(() => { const c = GA.app.map.getCanvas().getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; })()')
        pg.mouse.click(r[0] + r[2] * 0.6, r[1] + r[3] * 0.55); time.sleep(0.3)
        pg.click('#mb-finish'); time.sleep(1)
        secs = pg.evaluate('GA.app.store.get().sections')
        check(len(secs) == 1 and len(secs[0]['pts']) == 3, f'multi-segment standalone section saved after Undo ({[len(s["pts"]) for s in secs]} vertices)')
        pg.wait_for_function('document.querySelector("#sec-cv") || document.querySelector("#sec-out .error")', timeout=30000)
        check(pg.evaluate('!!document.querySelector("#sec-cv")'), 'section profile drawn without a study area')
        check(pg.evaluate('GA.app.map.getSource("sec-lines")._data.features.length') >= 2, 'section line and tree corridor drawn on the map')
        # data loaded only along the line
        prof = pg.evaluate('GA.app.secProfiles.get(GA.app.store.get().sections[0].id).p.then(p => ({ cov: p.coverage, cuts: p.cuts.length, trees: (p.trees || []).length, look: p.look, corridor: p.corridor }))')
        check(prof['cov'] and prof['cov']['bCells']['n'] <= 12, f'only the building cells along the corridor are fetched ({prof["cov"]["bCells"]})')
        check(prof['cuts'] > 0, f'buildings cut by the line: {prof["cuts"]}')
        # rename, look direction, corridor
        for sel_, val in [('#sec-name', 'Darro A–B'), ('#sec-look', 'right'), ('#sec-corr', '25')]:
            pg.evaluate('([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); }', [sel_, val]); time.sleep(0.6)
        s0 = pg.evaluate('GA.app.store.get().sections[0]')
        check(s0['name'] == 'Darro A–B' and s0['look'] == 'right' and s0['corridor'] == 25, 'rename, viewing direction and tree corridor saved')
        # exports
        for bid, ext in [('sec-png', '.png'), ('sec-svg', '.svg'), ('sec-pdf', '.pdf'), ('sec-geojson', '.geojson')]:
            pg.wait_for_selector('#' + bid, timeout=30000)
            with pg.expect_download(timeout=60000) as dl: pg.click('#' + bid)
            path = dl.value.path(); data = open(path, 'rb').read()
            okf = (ext == '.png' and data[:4] == b'\x89PNG') or (ext == '.svg' and b'<svg' in data[:400]) or (ext == '.pdf' and data[:5] == b'%PDF-') or (ext == '.geojson' and json.loads(data)['features'][0]['geometry']['type'] == 'LineString')
            check(okf and len(data) > 300, f'standalone export {ext}: {dl.value.suggested_filename} ({len(data)} bytes)')
        # enlarge viewer
        pg.click('#sec-enlarge'); time.sleep(2)
        check(pg.evaluate('!!document.querySelector(".vw-sec")'), 'enlarged section viewer opens for a standalone section')
        pg.screenshot(path=f'{OUT}/standalone_viewer.png')
        pg.keyboard.press('Escape'); time.sleep(0.5)
        # persistence across reload
        pg.reload(); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=60000)
        check(pg.evaluate('GA.app.store.get().sections.length') == 1 and pg.evaluate('GA.app.store.get().sections[0].name') == 'Darro A–B', 'standalone section persists after reload')
        pg.evaluate('document.querySelector("[data-ltab=sections]").click()'); time.sleep(1)
        check('Darro A–B' in pg.evaluate('document.querySelector("#left-body").innerText'), 'standalone section reopens from the Sections tab')
        # edit vertices: the active section exposes draggable vertex handles
        try: pg.wait_for_function('document.querySelectorAll(".h-sec").length >= 3', timeout=8000)
        except Exception: pass
        check(pg.evaluate('document.querySelectorAll(".h-sec").length') >= 3 and pg.evaluate('document.querySelectorAll(".h-sec-mid").length') >= 2, 'reopened section is editable (vertex and midpoint handles)')
        pg.screenshot(path=f'{OUT}/standalone_desktop_ar.png')
        # attach to a fabric
        pg.evaluate('''(() => { const st = GA.app.store; const a = { id: st.uid('area'), name: 'Realejo test', spec: { type: 'square', center: [-3.5940, 37.1730], side: 250 }, measures: { area: 62500, perimeter: 1000 } }; st.upsertArea(a); GA.app.refresh(); })()''')
        time.sleep(0.5)
        pg.click('#sec-attach'); time.sleep(0.4)
        pg.click('[data-att]'); time.sleep(1.5)
        P = pg.evaluate('(() => { const p = GA.app.store.get(); return { solo: p.sections.length, inArea: (p.areas[0].sections || []).map(s => s.name) }; })()')
        check(P['solo'] == 0 and P['inArea'] == ['Darro A–B'], f'"Attach to a fabric" moves the section into the fabric {P}')
        ctx.close()

        # ================= Hebrew tablet + English phone =================
        for lang, vp, mobile, tag in [('he', {'width': 820, 'height': 1180}, True, 'ipad_he'), ('en', {'width': 390, 'height': 844}, True, 'phone_en')]:
            ctx, pg, errs2 = boot(b, vp, lang, mobile)
            pg.evaluate('GA.app.map.jumpTo({ center: [-3.5986, 37.1773], zoom: 16 })'); time.sleep(0.4)
            lbl = pg.evaluate('document.querySelector("#map-draw-section").getAttribute("aria-label")')
            check(lbl == {'he': 'שרטוט חתך', 'en': 'Draw section'}[lang], f'{tag}: control labelled "{lbl}"')
            if tag == 'phone_en': pg.evaluate('document.querySelector("#phone-bar [data-pv=map]").click()'); time.sleep(0.5)
            vis = pg.evaluate('(() => { const r = document.querySelector("#map-draw-section").getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.width > 20 && r.right <= innerWidth && r.bottom <= innerHeight && !!el && !!el.closest("#map-draw-section"); })()')
            if tag == 'phone_en': pg.evaluate('document.querySelector("#phone-bar [data-pv=study]").click()'); time.sleep(0.5)
            check(vis, f'{tag}: control fully on screen')
            # phones open on the study panel: the same action is offered there (and on the map in map view)
            pg.click('#sp-draw-section' if tag == 'phone_en' else '#map-draw-section'); time.sleep(0.6)
            r = pg.evaluate('(() => { const c = GA.app.map.getCanvas().getBoundingClientRect(); return [c.left, c.top, c.width, c.height]; })()')
            check(r[2] > vp['width'] * 0.6, f'{tag}: the map is visible while drawing ({int(r[2])} px wide)')
            for fx, fy in [(0.3, 0.5), (0.7, 0.55)]:
                pg.touchscreen.tap(r[0] + r[2] * fx, r[1] + r[3] * fy) if mobile else pg.mouse.click(r[0] + r[2] * fx, r[1] + r[3] * fy); time.sleep(0.5)
            bn = pg.evaluate('(() => { const m = document.querySelector("#mode-banner"); const rr = m.getBoundingClientRect(); return { shown: !m.hidden, inside: rr.left >= 0 && rr.right <= innerWidth, fin: !document.querySelector("#mb-finish").disabled }; })()')
            check(bn['shown'] and bn['inside'] and bn['fin'], f'{tag}: Finish/Undo/Cancel banner on screen {bn}')
            pg.screenshot(path=f'{OUT}/drawing_{tag}.png')
            pg.click('#mb-finish'); time.sleep(1)
            check(pg.evaluate('GA.app.store.get().sections.length') == 1, f'{tag}: section saved without a study area')
            pg.wait_for_function('document.querySelector("#sec-cv") || document.querySelector("#sec-out .error")', timeout=40000); time.sleep(0.8)
            check(pg.evaluate('!!document.querySelector("#sec-cv") && document.querySelector("#sec-cv").getBoundingClientRect().width > 200'), f'{tag}: section shown after finishing')
            pg.screenshot(path=f'{OUT}/section_{tag}.png')
            errs += errs2
            ctx.close()

        # ================= classified rasters, legends, fabrics, history =================
        ctx, pg, errs3 = boot(b, {'width': 1440, 'height': 900}, 'en')
        pg.wait_for_function('GA.rasterClass.state.lst !== "loading"', timeout=20000)
        check(pg.evaluate('GA.rasterClass.state.lst') == 'ok', 'GIBS LST colormap (bundled) loaded')
        res = pg.evaluate('''(async () => { const RC = GA.rasterClass; const cm = (await (await fetch('data/ref/gibs_lst_colormap.json')).json()).entries;
            const pick = (K) => cm.find(e => K >= e[1] && K < e[2])[0];
            const px = (cols) => { const d = new Uint8ClampedArray(cols.length * 4); cols.forEach((c, i) => { if (c) { d.set(c, i * 4); d[i * 4 + 3] = 255; } }); return d; };
            const d = px([pick(300.15), pick(316.15), pick(321.15), null]); RC.recolour('lst', d, 4);
            const hex = (i) => '#' + [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
            const fl = px([[255, 0, 0], [232, 190, 255], [250, 52, 17]]); RC.recolour('flood', fl, 3);
            const fh = (i) => '#' + [fl[i * 4], fl[i * 4 + 1], fl[i * 4 + 2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
            const nz = px([[255, 255, 0], [255, 128, 0], [255, 0, 255]]); RC.recolour('noise', nz, 3);
            const nh = (i) => '#' + [nz[i * 4], nz[i * 4 + 1], nz[i * 4 + 2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
            return { lst: [hex(0), hex(1), hex(2)], nodataA: d[15], flood: [fh(0), fh(1), fh(2)], noise: [nh(0), nh(1), nh(2)],
              lstLeg: RC.legendItems('lst').map(i => i.sw), floodCols: GA.ext.FLOOD.map(z => z.color.toUpperCase()), noiseLeg: RC.legendItems('noise', { ind: 'lden' }).map(i => i.sw.toUpperCase()) }; })()''')
        PAL = pg.evaluate('JSON.parse(JSON.stringify(GA.palette))'); check(res['lst'] == [PAL['lst'][0], PAL['lst'][3], PAL['lst'][4]], f'LST 27 °C → 35–40, 43 °C → 45–50 hmm: {res["lst"]}' if False else f'LST pixels reclassified by value: 27 °C, 43 °C, 48 °C → {res["lst"]}')
        check(all(c in res['lstLeg'] for c in res['lst']), 'every LST map colour appears in the LST legend')
        check(res['flood'][0] == res['floodCols'][0] and res['flood'][1] == res['floodCols'][2] and res['flood'][2] == PAL['arpsi'], f'flood WMS classes → atlas colours (T10, T100, ARPSI) {res["flood"]}')
        check(res['noise'] == [res['noiseLeg'][0], res['noiseLeg'][2], res['noiseLeg'][4]], f'noise 55/65/75 dB → legend colours {res["noise"]}')
        yellowish = lambda h: (lambda r, g, b: r > 200 and g > 180 and b < 120)(int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
        check(not any(yellowish(c) for c in res['lstLeg'] + res['noiseLeg'] if c), 'no saturated yellow in the climate/noise palettes')
        # tile protocol end to end (GIBS stub returns known colormap pixels)
        tilechk = pg.evaluate('''(async () => { const RC = GA.rasterClass; const cm = (await (await fetch('data/ref/gibs_lst_colormap.json')).json()).entries; const c = cm.find(e => 320.3 >= e[1] && 320.3 < e[2])[0];
            const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d'); g.fillStyle = `rgb(${c.join(',')})`; g.fillRect(0, 0, 8, 8);
            const url = cv.toDataURL('image/png'); const tiles = RC.tiles('lst', url);
            const r = await RC._tile({ url: tiles.replace('{bbox-epsg-3857}', '0,0,1,1') }); const bm = await createImageBitmap(new Blob([r.data])); const c2 = document.createElement('canvas'); c2.width = c2.height = 8; const g2 = c2.getContext('2d'); g2.drawImage(bm, 0, 0); const d = g2.getImageData(4, 4, 1, 1).data; return [d[0], d[1], d[2]]; })()''')
        check(tilechk == [int(PAL['lst'][4][i:i + 2], 16) for i in (1, 3, 5)], f'LST tile protocol: 47 °C pixel drawn in class 45–50 {tilechk}')
        # legends from the same definitions; vector layers: every legend colour is drawn on the map
        aud = pg.evaluate(r'''(() => { const L = GA.app.L, m = GA.app.map; const norm = (c) => { c = String(c).trim().toLowerCase(); let r; if ((r = /^#([0-9a-f]{6})$/.exec(c))) return c; if ((r = /^#([0-9a-f]{3})$/.exec(c))) return '#' + r[1].split('').map(x => x + x).join(''); if ((r = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c))) return '#' + [r[1], r[2], r[3]].map(v => (+v).toString(16).padStart(2, '0')).join(''); return null; };
            const walk = (v, out) => { if (typeof v === 'string') { const n = norm(v); if (n) out.add(n); } else if (Array.isArray(v)) v.forEach(x => walk(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, out)); };
            const bad = {}; L.defs.forEach(d => { if (!d.legend) return; const ls = d.layers().map(l => m.getStyle().layers.find(x => x.id === l)).filter(Boolean); if (!ls.length || ls.some(l => l.type === 'raster')) return;
              const leg = new Set(); (d.legend().match(/#[0-9a-fA-F]{3,6}\b|rgba?\([^)]*\)/g) || []).forEach(c => { const n = norm(c); if (n) leg.add(n); }); const paint = new Set(); ls.forEach(l => walk(l.paint || {}, paint));
              const miss = [...leg].filter(c => !paint.has(c) && c !== '#ffffff'); if (miss.length) bad[d.id] = miss; }); return bad; })()''')
        check(not aud, f'vector legends: every legend colour is a map colour {aud}')
        imgs = pg.evaluate('GA.app.L.defs.filter(d => ["lst", "flood", "noise", "canopy"].includes(d.id)).map(d => [d.id, /<img/.test(d.legend())])')
        check(all(not x[1] for x in imgs), f'climate legends generated from the class tables, not service images {imgs}')
        # fabric marks: compare overview has plain numbers (no circle) and dashed outlines
        src = open(os.path.join(ROOT, 'js', 'compare.js')).read()
        check('ctx.arc(cx, cy, 10' not in src and "dash: []" not in src.split('const STYLES')[1].split('\n')[0], 'comparison: no number badges; every fabric style dashed')
        check(pg.evaluate('GA.app.map.getPaintProperty("sel-line", "line-dasharray") !== undefined'), 'main map: the open study area outline is dashed')
        # historical overlays
        pg.evaluate('GA.pages && GA.pages.open ? GA.pages.open("history") : (location.hash = "#history")'); time.sleep(4)
        has = pg.evaluate('(() => { const t = document.querySelector("#hx-pl"); return { toggle: !!t, legend: /Wikipedia/.test(document.body.innerText) }; })()')
        check(has['toggle'] and has['legend'], f'historical explorer: linked-places toggle and legend text {has}')
        pg.screenshot(path=f'{OUT}/history_en.png')
        errs += errs3
        ctx.close()
        check(not errs, f'no page errors {errs[:4]}')
        b.close()
finally:
    srv.terminate()
print('\n%d failures' % len(fails)); sys.exit(1 if fails else 0)
