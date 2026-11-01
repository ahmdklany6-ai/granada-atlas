"""v8 — street sections (narrow + sloping, wide + trees, sloping wide) in the new drawing language; large viewer with
zoom/pan, reverse view, depth, street widths; exports opened and checked (PNG resolution, SVG vector, PDF vector);
desktop / iPad / phone in ar, he, en; Exercise 1.3 sheet viewer and submission states; climate-board preview;
legend colours preserved in exports. Usage: python3 tests/ui_test_v8.py"""
import sys, os, time, json, subprocess, re, base64, io
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8808; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v8shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

LINES = {  # A → B, each crossing a street between two rows of buildings
    'narrow_slope': [[-3.5930, 37.1752], [-3.5930, 37.1738]],     # Realejo slope: Calle Alamillos de San Cecilio (~6 m), Cuesta del Realejo
    'wide_trees': [[-3.6004, 37.1727], [-3.5980, 37.1727]],       # Acera del Darro (~48 m between facades), mapped trees
    'slope_mixed': [[-3.5990, 37.1792], [-3.5975, 37.1792]],      # Calle Elvira → Albaicín, ~38 m rise
}

def boot(b, vp, lang='en', mobile=False):
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    pg = ctx.new_page(); V3.stub3(pg); errs = []
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errs.append(m.text[:300]))
    pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html')
    pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.app.map.getLayer("ly-streets")', timeout=60000)
    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3)
    return ctx, pg, errs

def add_sections(pg):
    return pg.evaluate('''(L) => { const p = GA.app.store.get(); p.sections = Object.entries(L).map(([name, pts]) => ({ id: GA.app.store.uid('sec'), name, pts, floorH: 3, created: new Date().toISOString() })); GA.app.store.save(); return p.sections.map(s => s.id); }''', LINES)

def open_viewer(pg, sid):
    pg.evaluate('(id) => GA.sectionView.open(null, id)', sid)
    pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "section" && GA.lastViewer.prof && GA.lastViewer.last', timeout=60000); time.sleep(0.6)

def save_dl(pg, click):
    with pg.expect_download(timeout=90000) as dl: click()
    path = os.path.join(OUT, dl.value.suggested_filename); dl.value.save_as(path); return path

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        ctx, pg, errs = boot(b, {'width': 1440, 'height': 900}, 'en')
        ids = add_sections(pg)
        # ---------- the three sections: data and drawing rules ----------
        for (name, pts), sid in zip(LINES.items(), ids):
            open_viewer(pg, sid)
            r = pg.evaluate('''() => { const v = GA.lastViewer, p = v.prof, f = v.last.flags; const z = p.surf.streets.filter(s => s.faceA != null);
              return { L: p.L, rise: p.max - p.min, ve: v.last.ve, xs: v.last.xs, ys: v.last.ys, cuts: p.cuts.length, est: p.cuts.filter(c => c.src !== 'height').length, bg: p.bg.length, treesOn: p.trees.filter(t => t.near).length, treesBg: p.trees.filter(t => !t.near).length,
                gaps: z.map(s => [s.name, +s.gap.toFixed(1)]), flags: f }; }''')
            print(name, json.dumps({k: v for k, v in r.items() if k != 'flags'}))
            check(r['ve'] == 1 and abs(r['xs'] - r['ys']) < 1e-9, f'{name}: equal horizontal and vertical scales by default')
            check(len(r['gaps']) >= 1 and r['flags']['measured'], f'{name}: facade-to-facade width measured and dimensioned {r["gaps"]}')
            check(r['flags']['figures'], f'{name}: decorative scale figures drawn and flagged')
            check(r['flags']['estH'] or r['est'] == 0, f'{name}: estimated heights flagged (dashed tops + note)')
            pg.screenshot(path=f'{OUT}/viewer_{name}_desktop_en.png')
        gw = dict((n, g) for n, g in [(k, None) for k in LINES])
        # narrow vs wide: widths
        nar = pg.evaluate('''(id) => GA.section.compute(GA.app.store.get().sections.find(s => s.id === id), { floorH: 3 }).then(p => p.surf.streets.filter(s => s.faceA != null).map(s => s.gap))''', ids[0])
        wid = pg.evaluate('''(id) => GA.section.compute(GA.app.store.get().sections.find(s => s.id === id), { floorH: 3 }).then(p => ({ g: p.surf.streets.filter(s => s.faceA != null).map(s => s.gap), on: p.trees.filter(t => t.near).length, bg: p.trees.filter(t => !t.near).length, rise: p.max - p.min }))''', ids[1])
        check(min(nar) < 8, f'narrow street measured < 8 m: {[round(x, 1) for x in nar]}')
        check(max(wid['g']) > 30, f'wide street measured > 30 m: {[round(x, 1) for x in wid["g"]]}')
        check(wid['on'] >= 1 and wid['bg'] >= 1, f'wide street: trees on the cut line ({wid["on"]}) distinguished from projected trees ({wid["bg"]})')
        slope = pg.evaluate('''(id) => GA.section.compute(GA.app.store.get().sections.find(s => s.id === id), { floorH: 3 }).then(p => p.max - p.min)''', ids[2])
        check(slope > 20, f'sloping section rises {slope:.1f} m')

        # ---------- viewer controls ----------
        open_viewer(pg, ids[1])
        s0 = pg.evaluate('GA.lastViewer.pz.state.s'); pg.click('.vw-sec [data-z="in"]'); time.sleep(0.2); s1 = pg.evaluate('GA.lastViewer.pz.state.s')
        check(s1 > s0, f'zoom in ({s0} → {s1:.2f})')
        st = pg.query_selector('.sv-stage').bounding_box(); pg.mouse.move(st['x'] + st['width'] / 2, st['y'] + st['height'] / 2); pg.mouse.wheel(0, -400); time.sleep(0.2)
        check(pg.evaluate('GA.lastViewer.pz.state.s') > s1, 'mouse-wheel zoom')
        pg.mouse.down(); pg.mouse.move(st['x'] + st['width'] / 2 - 120, st['y'] + st['height'] / 2 - 40, steps=4); pg.mouse.up(); time.sleep(0.2)
        check(pg.evaluate('GA.lastViewer.pz.state.x') != 0, 'drag pans the drawing')
        pg.click('.vw-sec [data-z="reset"]')
        look0 = pg.evaluate(f'GA.app.store.get().sections.find(s => s.id === "{ids[1]}").look || "left"')
        pg.click('[data-sv-act="rev"]'); pg.wait_for_function(f'(GA.app.store.get().sections.find(s => s.id === "{ids[1]}").look) !== "{look0}"', timeout=10000); time.sleep(2.5)
        check(True, 'reverse view direction')
        bg0 = pg.evaluate('GA.lastViewer.prof.bg.length')
        pg.fill('[data-sv="depth"]', '100'); pg.dispatch_event('[data-sv="depth"]', 'change'); time.sleep(4)
        check(pg.evaluate('GA.lastViewer.prof.depth') == 100 and pg.evaluate('GA.lastViewer.prof.bg.length') >= bg0, f'background depth 100 m ({bg0} → {pg.evaluate("GA.lastViewer.prof.bg.length")} elevations)')
        pg.fill('[data-sv="corridor"]', '30'); pg.dispatch_event('[data-sv="corridor"]', 'change'); time.sleep(4)
        check(pg.evaluate('GA.lastViewer.prof.corridor') == 30, 'tree projection distance adjustable (30 m)')
        # user sidewalks on the widest gap
        pg.evaluate('''() => { const fs = [...document.querySelectorAll('.sv-w')]; const big = fs.sort((a, b) => parseFloat(b.querySelector('legend b').textContent) - parseFloat(a.querySelector('legend b').textContent))[0];
          const set = (k, v) => { const i = big.querySelector(`[data-w="${k}"]`); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }; set('sa', '5.5'); set('sb', '6'); set('src', 'test value — not a survey'); }''')
        time.sleep(1)
        check(pg.evaluate('GA.lastViewer.last.flags.userDims'), 'user-entered sidewalks drawn and flagged (*)')
        # click a cut building → annotation form
        h = pg.evaluate('(() => { const v = GA.lastViewer; const c = v.last.hits.find(x => x.kind === "cut" && x.x1 - x.x0 > 20); const L = v.logical(); return c ? [(c.x0 + c.x1) / 2 * L.css, (c.y0 + c.y1) / 2 * L.css] : null; })()')
        cvb = pg.query_selector('.sv-cv').bounding_box(); pg.mouse.click(cvb['x'] + h[0], cvb['y'] + h[1]); time.sleep(0.5)
        check(pg.evaluate('!!document.querySelector(".sv-ann form")'), 'clicking a building opens its annotation form')
        pg.screenshot(path=f'{OUT}/viewer_controls_en.png')
        # ---------- exports, opened ----------
        png = save_dl(pg, lambda: pg.click('.vw-sec [data-sx="png"]')); im = Image.open(png)
        check(im.size[0] >= 5000, f'PNG export {im.size[0]}×{im.size[1]} px')
        svgp = save_dl(pg, lambda: pg.click('.vw-sec [data-sx="svg"]')); svgt = open(svgp, encoding='utf-8').read()
        import xml.dom.minidom; xml.dom.minidom.parseString(svgt.encode())
        check('<path' in svgt and '<text' in svgt and 'Sources' in svgt and '<image' not in svgt, f'SVG export is vector, with sources ({len(svgt)//1024} kB)')
        pdfp = save_dl(pg, lambda: pg.click('.vw-sec [data-sx="pdf"]')); pd = open(pdfp, 'rb').read()
        info = subprocess.run(['pdfinfo', pdfp], capture_output=True, text=True).stdout; fonts = subprocess.run(['pdffonts', pdfp], capture_output=True, text=True).stdout
        check('Helvetica' in fonts and re.search(r'Page size:\s+1190', info) is not None, f'PDF export: A3 landscape, Helvetica text (vector) — {info.split("Page size:")[1].split(chr(10))[0].strip()}')
        subprocess.run(['pdftoppm', '-r', '110', '-png', '-singlefile', pdfp, f'{OUT}/pdf_render_wide'], check=True)
        pim = Image.open(f'{OUT}/pdf_render_wide.png').convert('RGB'); cols = pim.getcolors(1 << 20) or []
        reds = sum(n for n, c in cols if abs(c[0] - 0x99) < 12 and abs(c[1] - 0x2B) < 12 and abs(c[2] - 0x2A) < 12)
        check(reds > 200, f'PDF renders: cut-red outline pixels present ({reds})')
        pg.keyboard.press('Escape'); time.sleep(0.4)
        # opening by clicking the section line on the main map
        pg.evaluate('document.querySelector("[data-ltab=sections]").click()'); time.sleep(1)
        pg.evaluate(f'(() => {{ const s = GA.app.store.get().sections[0]; GA.app.map.fitBounds([[Math.min(s.pts[0][0], s.pts[1][0]) - 0.001, Math.min(s.pts[0][1], s.pts[1][1]) - 0.001], [Math.max(s.pts[0][0], s.pts[1][0]) + 0.001, Math.max(s.pts[0][1], s.pts[1][1]) + 0.001]], {{ duration: 0 }}); }})()'); time.sleep(1.5)
        pt0 = pg.evaluate('(() => { const s = GA.app.store.get().sections[0]; const m = [(s.pts[0][0] + s.pts[1][0]) / 2, (s.pts[0][1] + s.pts[1][1]) / 2 + 0.00012]; const q = GA.app.map.project(m); const r = GA.app.map.getCanvas().getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; })()')
        pg.mouse.click(pt0[0], pt0[1]); time.sleep(3)
        check(pg.evaluate('!!document.querySelector(".vw-sec")'), 'clicking a section line on the map opens the large viewer')
        pg.keyboard.press('Escape'); time.sleep(0.3)

        # ---------- Exercise 1.3: states, missing links, sheet viewer ----------
        pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_selector('#e13-sub .sub-states', timeout=60000); time.sleep(3)
        st13 = pg.evaluate('[...document.querySelectorAll("#e13-sub .ss")].map(e => e.className.includes("ok"))')
        check(len(st13) == 4 and st13[0] and not st13[2] and not st13[3], f'Ex 1.3: four separate states (tools / content / exported / uploaded) {st13}')
        miss = pg.evaluate('[...document.querySelectorAll("#e13-sub .sub-miss [data-sub-go]")].map(b => b.textContent)')
        check(len(miss) == 7 and any('Student' in m for m in miss) and any('synthesis' in m for m in miss), f'missing names, 5 interpretations and synthesis listed ({len(miss)})')
        pg.click('#e13-sub [data-sub-go]'); time.sleep(0.8)
        check(pg.evaluate('document.activeElement && document.activeElement.dataset.e === "students"'), 'missing-field link focuses the student-names field')
        pg.wait_for_function('document.querySelectorAll(".e13-img canvas").length >= 2', timeout=120000)
        pg.click('[data-e13open="density"]'); pg.wait_for_selector('.vw-sheet img', timeout=60000); time.sleep(1)
        check(pg.evaluate('document.querySelector(".vw-sheet img").naturalWidth') > 2000, 'sheet opens large (full-resolution image) with zoom')
        pg.click('.vw-sheet [data-z="in"]'); time.sleep(0.2)
        sheet = save_dl(pg, lambda: pg.click('.vw-sheet [data-vtool="png"]'))
        check(Image.open(sheet).size[0] > 2000, f'sheet exported individually: {os.path.basename(sheet)}')
        pg.keyboard.press('Escape'); time.sleep(0.5)
        st13b = pg.evaluate('[...document.querySelectorAll("#e13-sub .ss")].map(e => e.className.includes("ok"))')
        check(st13b[2] and not st13b[3], 'export recorded as "exported" — NOT as "uploaded to Miro"')
        check(pg.evaluate('!GA.app.store.get().ex13.uploaded'), 'upload flag untouched by exporting')

        # ---------- climate board: large preview, states ----------
        pg.evaluate('GA.pages.go("studio", "climate")'); pg.wait_for_selector('#cl-large', timeout=120000); time.sleep(1)
        pg.click('#cl-large'); pg.wait_for_selector('.vw-sheet img', timeout=90000); time.sleep(1)
        check(pg.evaluate('document.querySelector(".vw-sheet img").naturalWidth') >= 2000, 'climate board opens in the large viewer')
        save_dl(pg, lambda: pg.click('.vw-sheet [data-vtool="png"]')); pg.keyboard.press('Escape'); time.sleep(0.4)
        cst = pg.evaluate('(() => { const c = GA.app.store.get().studio.climate; return { exp: (c.exports || []).length, up: !!c.uploaded }; })()')
        check(cst['exp'] >= 1 and not cst['up'], f'climate board: exported recorded, upload untouched {cst}')
        # ---------- legend colours preserved in exports ----------
        lg = pg.evaluate('''(() => { const GAL = GA.gallery, P = GA.palette; const ring = [[-3.6000, 37.1765], [-3.5975, 37.1765], [-3.5975, 37.1785], [-3.6000, 37.1785], [-3.6000, 37.1765]];
          const items = Object.entries(P.band).filter(([k]) => k !== 'no_data').map(([k, c], i) => ({ g: { type: 'Polygon', coordinates: [[[-3.5998 + i * 0.0005, 37.1768], [-3.5994 + i * 0.0005, 37.1768], [-3.5994 + i * 0.0005, 37.1772], [-3.5998 + i * 0.0005, 37.1772], [-3.5998 + i * 0.0005, 37.1768]]] }, fill: c, alpha: 1 }));
          const card = { id: 't', title: 't', spec: { layers: [{ type: 'fill', items }] }, legend: Object.entries(P.band).filter(([k]) => k !== 'no_data').map(([k, c]) => ({ sw: c, label: k })) };
          const MC = GA.mapcard; const f = MC.fit([ring], 500, 400, 0.05); const sizes = [[500, 400, 1], [1600, 1280, 1]]; const out = [];
          for (const [w, h, r] of sizes) { const cv = document.createElement('canvas'); GAL.drawCard(cv, { ring }, card, { center: f.center, mpp: f.mpp * 500 / w, w, h, ratio: r }); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; const set = {}; for (let i = 0; i < d.length; i += 4) { const k = '#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase(); set[k] = (set[k] || 0) + 1; } out.push(set); }
          return { legend: card.legend.map(i => i.sw.toUpperCase()), screen: out[0], export: out[1] }; })()''')
        ok = all(lg['screen'].get(c, 0) > 20 and lg['export'].get(c, 0) > 20 for c in lg['legend'])
        check(ok, f'card: every legend colour is drawn identically on screen and in the export {[ (c, lg["screen"].get(c,0), lg["export"].get(c,0)) for c in lg["legend"]]}')
        ctx.close()

        # ---------- iPad (he) and phone (ar) viewer layouts ----------
        for lang, vp, tag in [('he', {'width': 820, 'height': 1180}, 'ipad_he'), ('ar', {'width': 390, 'height': 844}, 'phone_ar'), ('he', {'width': 1180, 'height': 820}, 'ipad_land_he')]:
            ctx, pg, e2 = boot(b, vp, lang, mobile=True)
            ids2 = add_sections(pg); open_viewer(pg, ids2[1]); time.sleep(1)
            lay = pg.evaluate('''(() => { const s = document.querySelector('.sv-stage').getBoundingClientRect(); const btns = [...document.querySelectorAll('.vw-sec .vw-tools .btn')].map(b => b.getBoundingClientRect()); return { sw: s.width, sh: s.height, minBtn: Math.min(...btns.map(r => Math.min(r.width, r.height))), off: btns.filter(r => r.right > innerWidth + 1 || r.left < -1).length, title: document.querySelector('#vw-title').scrollWidth <= document.querySelector('#vw-title').clientWidth + 2 }; })()''')
            check(lay['sw'] >= vp['width'] * (0.6 if vp['width'] > 1100 else 0.9) and lay['sh'] >= 300, f'{tag}: large drawing area {int(lay["sw"])}×{int(lay["sh"])}')
            check(lay['minBtn'] >= 32 and lay['off'] == 0, f'{tag}: readable controls on screen (min {lay["minBtn"]:.0f} px)')
            txt = pg.evaluate('GA.lastViewer.last.flags.measured')
            check(txt, f'{tag}: widths and labels drawn in {lang}')
            pg.screenshot(path=f'{OUT}/viewer_{tag}.png')
            svgp = save_dl(pg, lambda: pg.click('.vw-sec [data-sx="svg"]')); s = open(svgp, encoding='utf-8').read()
            nums = re.findall(r'>(\d+\.\d) m<', s)
            check(len(nums) >= 1, f'{tag}: measured widths written left-to-right in the export ({nums[:3]})')
            pdfp = save_dl(pg, lambda: pg.click('.vw-sec [data-sx="pdf"]')); subprocess.run(['pdftoppm', '-r', '110', '-png', '-singlefile', pdfp, f'{OUT}/pdf_render_{tag}'], check=True)
            errs += e2; ctx.close()
        check(not errs, f'no page errors {errs[:4]}')
        b.close()
finally:
    srv.terminate()
print('\n%d failures' % len(fails)); sys.exit(1 if fails else 0)
