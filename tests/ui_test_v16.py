"""v16 — build 5.18: print layout at full resolution and the "Map only" template.
A. 1:50,000 (and 1:5,000 / 1:10,000) exports are not pixelated: the page is at the requested dpi, the map raster is rendered
   at exactly its frame's pixel size (no stretching; MapLibre's 4096 px canvas cap is bypassed by stitched tiles), every
   offscreen map canvas is as large as requested (not clamped), the 50 m building summary is replaced by footprints
   (no 50 m grid periodicity in the image), the image is not an upscale (sharpness ratio vs its own 2× down/up cycle),
   the measured scale is within 0.5 % and the scale bar's length matches the measured scale; the PDF embeds the page at
   full size.
B. "Map only": page = map (rect = page minus margins, white outside), no title / legend / footer text; toggles hide
   north arrow, scale bar and study-area layers; A4–A1, both orientations, PNG and PDF; trilingual label; saved in the
   browser (survives a reload).
Usage: python3 tests/ui_test_v16.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, re
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _nointro  # 5.27: start on the map, not the opening page
from PIL import Image
import numpy as np
Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8816; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v16shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
PAPER = {'A4': (210, 297), 'A3': (297, 420), 'A2': (420, 594), 'A1': (594, 841)}
def page_px(paper, orient, dpi):
    a, b = PAPER[paper]; w, h = (b, a) if orient == 'landscape' else (a, b); return round(w / 25.4 * dpi), round(h / 25.4 * dpi)

def sharpness(im):
    """detail lost by a 2× down/up cycle, relative to gradient energy: ≈ 0.6–0.75 for an image upscaled 2×, ≥ 1 at true resolution"""
    g = np.asarray(im.convert('L')).astype(float)
    sm = np.asarray(im.convert('L').resize((im.width // 2, im.height // 2), Image.BILINEAR).resize(im.size, Image.BILINEAR)).astype(float)
    gr = (np.abs(np.diff(g, axis=1)).mean() + np.abs(np.diff(g, axis=0)).mean()) / 2
    return np.abs(g - sm).mean() / max(gr, 1e-9)
def grid_peak(im, period):
    """spectral peak of the edge profile at the 50 m cell period (≥ 25 with the old 50 m raster, ≈ 1–2 with footprints)"""
    g = np.asarray(im.convert('L')).astype(float); best = 0
    for axis in (0, 1):
        prof = np.abs(np.diff(g, axis=1 - axis)).sum(axis=axis); prof = prof - prof.mean()
        sp = np.abs(np.fft.rfft(prof)) ** 2; f = np.fft.rfftfreq(len(prof)); k = int(np.argmin(np.abs(f - 1 / period)))
        best = max(best, sp[k - 2:k + 3].max() / np.median(sp[max(1, k - 40):k + 40]))
    return best

# records every offscreen print map (requested pixel ratio, container, the canvas MapLibre really made, the style's layers)
SPY = '''() => { if (window.__spy) return; window.__spy = []; const M = maplibregl.Map; maplibregl.Map = function (o) { const m = new M(o);
  if (o.container && o.container.style && o.container.style.left === '-20000px') { window.__spy.push({ pr: o.pixelRatio, css: [o.container.clientWidth, o.container.clientHeight],
    canvas: [m.getCanvas().width, m.getCanvas().height], zoom: o.zoom, vis: o.style.layers.filter(l => (l.layout || {}).visibility !== 'none').map(l => l.id) }); } return m; };
  maplibregl.Map.prototype = M.prototype;
  // text and rectangles drawn on the PAGE canvas (identified by its size) during compose
  window.__txt = null; const ft = CanvasRenderingContext2D.prototype.fillText, fr = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillText = function (s, x, y) { if (window.__txt && this.canvas.width === window.__pageW) window.__txt.push(String(s)); return ft.apply(this, arguments); };
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) { if (window.__rects && this.canvas.width === window.__pageW) window.__rects.push([x, y, w, h, String(this.fillStyle)]); return fr.apply(this, arguments); }; }'''
def arm(pg, paper, orient, dpi):
    pg.evaluate(f'() => {{ window.__spy.length = 0; window.__txt = []; window.__rects = []; window.__pageW = {page_px(paper, orient, dpi)[0]}; }}')

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.printLayout', timeout=90000); time.sleep(2)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.18' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('localStorage.removeItem(GA.printLayout.KEY); GA.i18n.setLang("en")'); time.sleep(0.5)
        # a saved study area, so the map-only toggle has boundaries and a number to hide
        pg.evaluate('''(() => { const st = GA.app.store; if (!st.get().areas.some(a => a.name === 'Print test area')) st.upsertArea({ id: st.uid('area'), name: 'Print test area', spec: { type: 'square', center: [-3.5980, 37.1770], side: 600 }, measures: { area: 360000, perimeter: 2400 } }); GA.app.refresh(); })()''')
        pg.evaluate('GA.app.map.jumpTo({ center: [-3.5986, 37.1773], zoom: 13 })'); time.sleep(3); pg.evaluate(SPY)
        lim = pg.evaluate('GA.printLayout.glLimit()'); print('GL limit', lim)
        pg.evaluate('GA.pages.go("print")'); time.sleep(1)

        # ---------- A. resolution and scale ----------
        def export(kind, paper, orient, dpi, denom=None, template='single', mo=None):
            pg.select_option('[data-pl=template]', template); time.sleep(0.4)
            pg.select_option('[data-pl=paper]', paper); pg.select_option('[data-pl=orient]', orient); pg.select_option('[data-pl=dpi]', str(dpi))
            if template == 'maponly':
                pg.select_option('[data-mo=denom]', str(denom))
                for k, v in (mo or {}).items():
                    if pg.is_checked(f'[data-mo={k}]') != v: pg.click(f'[data-mo={k}]')
            else:
                pg.select_option('select[data-slot="0"][data-sk=item]', 'map'); time.sleep(0.3); pg.select_option('select[data-slot="0"][data-sk=denom]', str(denom))
            arm(pg, paper, orient, pg.evaluate(f'GA.printLayout.effDpi({dpi})'))
            with pg.expect_download(timeout=900000) as dl: pg.click(f'[data-pl-act={kind}]')
            path = os.path.join(OUT, f'{template}_{paper}_{orient}_{dpi}_{denom}.{kind}'); dl.value.save_as(path)
            return path, pg.evaluate('({ r: { dpi: GA.lastPrint.dpi, maps: GA.lastPrint.maps, mapOnly: !!GA.lastPrint.mapOnly }, spy: window.__spy, txt: window.__txt, rects: window.__rects, msg: document.querySelector("#pl-msg").innerText })')
        def scale_checks(tag, res, dpi, denom):
            r, m = res['r'], res['r']['maps'][0]
            check(r['dpi'] == dpi, f'{tag}: page at the requested {dpi} dpi (got {r["dpi"]})')
            check(abs(m['mapDpi'] - dpi) < 0.5, f'{tag}: map raster at {dpi} dpi — rendered at its frame\'s pixel size, not stretched (map {m["mapDpi"]:.1f} dpi)')
            check(abs(m['measured'] - denom) / denom < 0.005, f'{tag}: measured scale 1:{round(m["measured"])} within 0.5 % of 1:{denom}')
            sp = res['spy']; check(sp and all(abs(s['canvas'][0] - round(s['css'][0] * s['pr'])) <= 1 and abs(s['canvas'][1] - round(s['css'][1] * s['pr'])) <= 1 for s in sp),
                                   f'{tag}: every map canvas as large as requested (no 4096 px clamp) — {len(sp)} canvas(es), {m["tiles"]} tile(s)', [(s['css'], s['pr'], s['canvas']) for s in sp])
            check(all(s['canvas'][0] <= lim and s['canvas'][1] <= lim for s in sp), f'{tag}: tiles stay within the GPU limit {lim}')
            check('Map:' in res['msg'] and f'{dpi} dpi actual' in res['msg'], f'{tag}: message states the real map dpi', res['msg'])
            return m
        def bar_check(tag, res, dpi, measured):
            # scale bar: 4 alternating segments of equal width (ink / white) + a label "N m"; its length must equal N m at the measured scale
            k = dpi / 25.4; rects = [x for x in res['rects'] if x[3] > 0 and abs(x[3] - 1.4 * k * fsf) < 2]
            segs = None
            for i in range(len(rects) - 3):
                q = rects[i:i + 4]
                if all(abs(x[2] - q[0][2]) < 1 for x in q) and all(abs(q[j + 1][0] - q[j][0] - q[0][2]) < 1.5 for j in range(3)): segs = q; break
            lab = [s for s in res['txt'] if re.fullmatch(r'[\d,]+ m', s)]
            ok = bool(segs and lab)
            if ok:
                length_mm = 4 * segs[0][2] / k; ground = int(lab[0].replace(',', '').split()[0]); want = ground * 1000 / measured
                ok = abs(length_mm - want) / want < 0.006
            check(ok, f'{tag}: scale bar length matches the measured scale', (segs, lab))

        pg.select_option('[data-pl=template]', 'single'); time.sleep(0.3)
        fsf = {'A4': 1, 'A3': 1.41, 'A2': 2, 'A1': 2.83}
        for paper, dpi, denom, kind in [('A3', 150, 5000, 'png'), ('A3', 150, 10000, 'png'), ('A3', 150, 50000, 'png'), ('A3', 300, 50000, 'pdf'), ('A1', 150, 50000, 'png'), ('A1', 300, 50000, 'png')]:
            tag = f'{paper} landscape {dpi} dpi 1:{denom:,} {kind.upper()}'; fsf = {'A4': 1, 'A3': 1.41, 'A2': 2, 'A1': 2.83}[paper]
            t0 = time.time(); path, res = export(kind, paper, 'landscape', dpi, denom); m = scale_checks(tag, res, dpi, denom); bar_check(tag, res, dpi, m['measured'])
            W, H = page_px(paper, 'landscape', dpi)
            if kind == 'pdf':
                info = subprocess.run(['pdfimages', '-list', path], capture_output=True, text=True).stdout
                dims = [tuple(map(int, l.split()[3:5])) for l in info.splitlines()[2:] if l.strip()]
                check(dims and dims[0] == (W, H), f'{tag}: PDF embeds the page at {W} × {H} px', dims)
                subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-singlefile', path, path[:-4]]); img = Image.open(path[:-4] + '.png')
            else:
                img = Image.open(path); check(img.size == (W, H), f'{tag}: PNG {img.size} = paper at {dpi} dpi ({W} × {H})')
            q = m['rect']; inner = img.crop((q['x'] + 20, q['y'] + 20, q['x'] + q['w'] - 20, q['y'] + q['h'] - 20)).convert('RGB')
            cx, cy = inner.width // 2, inner.height // 2; c = inner.crop((cx - inner.width // 4, cy - inner.height // 4, cx + inner.width // 4, cy + inner.height // 4))
            s = sharpness(c); check(s >= 0.9, f'{tag}: map is not an upscale (sharpness {s:.2f} ≥ 0.9; a 2× upscale scores ≈ 0.7)')
            gp = grid_peak(inner, 50 / denom * 1000 / 25.4 * dpi); check(gp < 6, f'{tag}: no 50 m cell pattern in the map (peak {gp:.1f} < 6; the old raster scored ≥ 25)')
            if denom == 50000: check(m['liteFootprints'] and not any(any(l.endswith('-ov') for l in s2['vis']) for s2 in res['spy']), f'{tag}: buildings drawn as footprints, 50 m summary raster hidden')
            c.save(os.path.join(OUT, f'crop_{paper}_{dpi}_{denom}.png')); print(f'     {round(time.time() - t0)} s', flush=True)

        # ---------- B. Map only ----------
        for lang, want in [('ar', 'الخريطة فقط (بدون مفتاح أو معلومات)'), ('he', 'מפה בלבד (ללא מקרא או מידע)'), ('en', 'Map only (no legend or info)')]:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); pg.evaluate('GA.pages.close()'); time.sleep(0.3); pg.evaluate('GA.pages.go("print")'); time.sleep(0.6)
            lab = pg.evaluate('[...document.querySelectorAll("[data-pl=template] option")].find(o => o.value === "maponly").textContent')
            check(lab == want, f'{lang}: template label «{lab}»')
            pg.select_option('[data-pl=template]', 'maponly'); time.sleep(0.4)
            ov = pg.evaluate('[...document.querySelectorAll(".pl *")].some(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); })')
            check(not ov and pg.evaluate('!document.querySelector("[data-pl=title]") && !document.querySelector("[data-slot]") && document.querySelectorAll("[data-mo]").length === 4'),
                  f'{lang}: map-only form shows scale + three toggles, no title / slots, nothing off-screen'); pg.screenshot(path=os.path.join(OUT, f'maponly_form_{lang}.png'))
        LEG = pg.evaluate('[GA.i18n.t("lg.title"), GA.i18n.t("v7.sources"), GA.i18n.t("pl.untitled")]')
        for paper, orient, dpi, kind, mo in [('A4', 'portrait', 150, 'png', {}), ('A3', 'landscape', 300, 'pdf', {}), ('A2', 'portrait', 150, 'png', {'north': False, 'scalebar': False, 'areas': False}), ('A1', 'landscape', 150, 'png', {'north': True, 'scalebar': True, 'areas': True})]:
            tag = f'map only {paper} {orient} {dpi} dpi {kind.upper()}' + (' (marks off)' if mo and not mo.get('north') else '')
            fsf = {'A4': 1, 'A3': 1.41, 'A2': 2, 'A1': 2.83}[paper]
            path, res = export(kind, paper, orient, dpi, 50000, 'maponly', mo); m = scale_checks(tag, res, dpi, 50000)
            W, H = page_px(paper, orient, dpi); k = dpi / 25.4; marg = pg.evaluate('GA.printLayout.st.margin'); q = m['rect']
            check(res['r']['mapOnly'] and abs(q['x'] - marg * k) <= 1 and abs(q['w'] - (W - 2 * marg * k)) <= 2 and abs(q['h'] - (H - 2 * marg * k)) <= 2, f'{tag}: page = map (map fills the page inside the {marg} mm margins)', q)
            if kind == 'pdf':
                info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout; check(re.search(r'Pages:\s+1', info) is not None, f'{tag}: one-page PDF')
                subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-singlefile', path, path[:-4]]); img = Image.open(path[:-4] + '.png').convert('RGB')
            else: img = Image.open(path).convert('RGB')
            check(img.size == (W, H), f'{tag}: page {img.size} at {dpi} dpi')
            a = np.asarray(img); mask = np.ones(a.shape[:2], bool); mask[q['y']:q['y'] + q['h'], q['x']:q['x'] + q['w']] = False
            check((a[mask] >= 245).all(axis=1).mean() > 0.995, f'{tag}: nothing outside the map (margins white)')
            txt = res['txt']; check(not any(any(L and L in s for L in LEG) for s in txt) and all(re.fullmatch(r'N|0|[\d,]+ m|1:[\d,]+', s) for s in txt), f'{tag}: no title, legend, sources or footer text', txt)
            on = not mo or mo.get('north', True)
            check(('N' in txt) == on and (any(s.endswith(' m') for s in txt)) == (not mo or mo.get('scalebar', True)), f'{tag}: north arrow / scale bar {"shown" if on else "hidden"} as toggled', txt)
            areas_on = not mo or mo.get('areas', True); vis = res['spy'][0]['vis']
            check(any(l.startswith('saved-areas') for l in vis) == areas_on and any(l.startswith('fabric-no') for l in vis) == areas_on, f'{tag}: study-area boundaries and numbers {"drawn" if areas_on else "hidden"}')
            if not mo or mo.get('scalebar', True): bar_check(tag, res, dpi, m['measured'])
            inner = img.crop((q['x'] + 20, q['y'] + 20, q['x'] + q['w'] - 20, q['y'] + q['h'] - 20))
            gp = grid_peak(inner, 50 / 50000 * 1000 / 25.4 * dpi); check(gp < 6, f'{tag}: footprints, no 50 m cells (peak {gp:.1f})')
            img.resize((img.width * 900 // max(img.size), img.height * 900 // max(img.size))).save(os.path.join(OUT, f'maponly_{paper}_{orient}.png'))
        # ---------- persistence ----------
        pg.select_option('[data-mo=denom]', '25000'); pg.click('[data-mo=north]'); time.sleep(0.3)
        saved = pg.evaluate('JSON.parse(localStorage.getItem(GA.printLayout.KEY))')
        pg.reload(); pg.wait_for_function('window.GA && GA.printLayout', timeout=90000); time.sleep(1)
        st = pg.evaluate('({ t: GA.printLayout.st.template, mo: GA.printLayout.st.mo, paper: GA.printLayout.st.paper, orient: GA.printLayout.st.orient, dpi: GA.printLayout.st.dpi })')
        check(st['t'] == 'maponly' and st['mo']['denom'] == 25000 and st['mo']['north'] is False and st['paper'] == saved['paper'] and st['orient'] == saved['orient'] and st['dpi'] == saved['dpi'],
              'print options (incl. map-only scale and toggles) are restored after a reload', st)
        check(not errs, 'no page errors', errs[:3])
        pg.evaluate('localStorage.removeItem(GA.printLayout.KEY)')
        ctx.close()
finally:
    srv.terminate()
print(f'\n{len(fails)} failure(s)' + (': ' + '; '.join(fails) if fails else ''))
sys.exit(1 if fails else 0)
