"""Live verification of build 5.18 on the PUBLIC site from a GitHub runner (real OpenFreeMap basemap tiles):
  1. print layout at 1:50,000 (A3 landscape 300 dpi; A1 landscape 300 dpi) and 1:5,000 (A3 150 dpi): page and map at the
     requested dpi, measured scale within 0.5 %, map not an upscale, no 50 m cell pattern;
  2. "Map only" A3 landscape 300 dpi at 1:50,000: page = map, labels ar / he / en;
  3. BEFORE / AFTER at 1:50,000 with the same real tiles: the "before" context serves build 5.17's printlayout.js and
     layers.js (fetched from commit fecc934) in place of the live files — nothing else changes.
Fresh browser (no visitor data touched). 100 % crops: base64 PNG between ===IMG name=== / ===END=== (job log only)."""
import base64, io, json, os, time, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
Image.MAX_IMAGE_PIXELS = None
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'
EXPECT = os.environ.get('EXPECT_BUILD') or json.load(open('version.json'))['build']
OLD = 'https://raw.githubusercontent.com/ahmdklany6-ai/granada-atlas/fecc934/js/'
res = []
def step(m): print(time.strftime('%H:%M:%S'), '·', m, flush=True)
def check(cond, msg, extra=''):
    res.append((bool(cond), msg)); print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
def emit(name, im, maxw=1800):
    im = im.convert('RGB'); im.thumbnail((maxw, maxw)); buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    b = base64.b64encode(buf.getvalue()).decode(); print(f'===IMG {name}.png==='); [print(b[i:i + 8000]) for i in range(0, len(b), 8000)]; print('===END===', flush=True)
def sharpness(im):
    g = np.asarray(im.convert('L')).astype(float)
    sm = np.asarray(im.convert('L').resize((im.width // 2, im.height // 2), Image.BILINEAR).resize(im.size, Image.BILINEAR)).astype(float)
    return np.abs(g - sm).mean() / max((np.abs(np.diff(g, axis=1)).mean() + np.abs(np.diff(g, axis=0)).mean()) / 2, 1e-9)
def grid_peak(im, period):
    g = np.asarray(im.convert('L')).astype(float); best = 0
    for axis in (0, 1):
        prof = np.abs(np.diff(g, axis=1 - axis)).sum(axis=axis); prof = prof - prof.mean(); sp = np.abs(np.fft.rfft(prof)) ** 2
        f = np.fft.rfftfreq(len(prof)); k = int(np.argmin(np.abs(f - 1 / period))); best = max(best, sp[k - 2:k + 3].max() / np.median(sp[max(1, k - 40):k + 40]))
    return best
v = None
for i in range(45):
    try:
        v = json.load(urllib.request.urlopen(SITE + 'version.json?nocache=' + str(time.time()), timeout=20))['build']; print('live version.json', v, flush=True)
        if v == EXPECT: break
    except Exception as e: print('version.json', e)
    time.sleep(20)
check(v == EXPECT, f'public site serves build {EXPECT} (version.json)', v)
old_js = {n: urllib.request.urlopen(OLD + n, timeout=60).read() for n in ['printlayout.js', 'layers.js']}
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
COMPOSE = '''(async () => { const s = GA.printLayout.st; Object.assign(s, { paper: '%s', orient: 'landscape', template: '%s', margin: 12 });
  if (s.template === 'maponly') Object.assign(s.mo, { denom: %d, north: true, scalebar: true, areas: true }); else s.slots[0] = { type: 'map', denom: %d, caption: '' };
  const r = await GA.printLayout.compose(%d, false); const m = r.maps[0];
  const q = m.rect || null; return { dpi: r.dpi, mapDpi: m.mapDpi, measured: m.measured, tiles: m.tiles || null, rect: q, png: r.cv.toDataURL('image/png'), W: r.cv.width, H: r.cv.height }; })()'''
def frame_of(img, q):
    if q: return (q['x'], q['y'], q['x'] + q['w'], q['y'] + q['h'])
    a = np.asarray(img.convert('RGB')).astype(int); ink = (abs(a[..., 0] - 0x29) < 14) & (abs(a[..., 1] - 0x10) < 14) & (abs(a[..., 2] - 0x0C) < 14)
    cols = np.where(ink.sum(0) > a.shape[0] * 0.15)[0]; rows = np.where(ink.sum(1) > a.shape[1] * 0.5)[0]
    return (cols.min(), rows.min() if len(rows) > 1 else 0, cols.max(), rows.max())
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    def boot(before=False):
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, accept_downloads=True); pg = ctx.new_page(); pg.set_default_timeout(1200000); errs = []
        if before:
            for n, body in old_js.items(): pg.route(f'**/js/{n}*', lambda r, body=body: r.fulfill(status=200, body=body, content_type='application/javascript'))
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        step('boot ' + ('BEFORE (5.17 print code)' if before else 'AFTER')); pg.goto(SITE + '?v=' + EXPECT, wait_until='load', timeout=180000)
        pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.app.map.loaded() && GA.printLayout', timeout=300000)
        pg.evaluate('GA.i18n.setLang("en"); GA.app.map.jumpTo({ center: [-3.5986, 37.1773], zoom: 13 })'); time.sleep(8); return ctx, pg, errs
    crops = {}
    for before in [False, True]:
        ctx, pg, errs = boot(before); tag0 = 'before' if before else 'after'
        if not before: check(pg.evaluate('window.GA_BUILD') == EXPECT and pg.evaluate('typeof GA.app.L.printStyle') == 'function', f'page runs build {EXPECT} with the new print code')
        cases = [('A3', 'single', 300, 50000)] + ([] if before else [('A3', 'single', 150, 5000), ('A1', 'single', 300, 50000), ('A3', 'maponly', 300, 50000)])
        for paper, tpl, dpi, den in cases:
            tag = f'{tag0} {paper} {tpl} {dpi} dpi 1:{den:,}'; step(tag); t0 = time.time()
            r = pg.evaluate(COMPOSE % (paper, tpl, den, den, dpi)); img = Image.open(io.BytesIO(base64.b64decode(r['png'].split(',')[1])))
            x0, y0, x1, y1 = frame_of(img, r['rect']); cx, cy = (x0 + x1) // 2, (y0 + y1) // 2; k = r['dpi'] / 25.4
            crop = img.crop((int(cx - 30 * k), int(cy - 20 * k), int(cx + 30 * k), int(cy + 20 * k)))  # 60 × 40 mm of paper at 100 %
            inner = img.crop((x0 + 20, y0 + 20, x1 - 20, y1 - 20)); sh = sharpness(crop); gp = grid_peak(inner, 50 / den * 1000 / 25.4 * r['dpi'])
            print(f'   {tag}: page {r["W"]}×{r["H"]} at {r["dpi"]} dpi, map {r["mapDpi"]:.1f} dpi, tiles {r["tiles"]}, measured 1:{r["measured"]:.0f}, sharpness {sh:.2f}, 50 m peak {gp:.1f}, {time.time() - t0:.0f} s', flush=True)
            if not before:
                check(r['dpi'] == dpi and abs(r['mapDpi'] - dpi) < 0.5, f'{tag}: page and map at {dpi} dpi')
                check(abs(r['measured'] - den) / den < 0.005, f'{tag}: measured 1:{r["measured"]:.0f}')
                check(sh >= 0.9, f'{tag}: not an upscale (sharpness {sh:.2f})'); check(gp < 6, f'{tag}: no 50 m cell pattern ({gp:.1f})')
                if tpl == 'maponly': check(abs(x0 - 12 * k) <= 1 and abs((x1 - x0) - (r['W'] - 24 * k)) <= 2, f'{tag}: page = map')
            if den == 50000 and paper == 'A3' and tpl == 'single': crops[tag0] = crop
            emit(f'{tag0}_{paper}_{tpl}_{dpi}_{den}_crop100', crop)
            if tpl == 'maponly': emit('after_maponly_A3_page', img, 1600)
        if not before:
            for lang, want in [('ar', 'الخريطة فقط (بدون مفتاح أو معلومات)'), ('he', 'מפה בלבד (ללא מקרא או מידע)'), ('en', 'Map only (no legend or info)')]:
                pg.evaluate(f'GA.i18n.setLang("{lang}")'); pg.evaluate('GA.pages.go("print")'); time.sleep(1)
                lab = pg.evaluate('[...document.querySelectorAll("[data-pl=template] option")].find(o => o.value === "maponly").textContent'); check(lab == want, f'{lang}: template label «{lab}»')
                pg.evaluate('GA.pages.close()')
        check(not errs, f'{tag0}: no page errors', errs[:3]); ctx.close()
    if 'before' in crops and 'after' in crops:
        a, bb = crops['before'], crops['after']; s = Image.new('RGB', (a.width + bb.width + 40, max(a.height, bb.height)), 'white'); s.paste(a, (0, 0)); s.paste(bb, (a.width + 40, 0))
        emit('before_after_A3_300dpi_1-50000', s, 2400)
    b.close()
print('\nSUMMARY', sum(1 for ok, _ in res if ok), 'ok,', sum(1 for ok, _ in res if not ok), 'failed')
for ok, m in res:
    if not ok: print('FAILED:', m)
