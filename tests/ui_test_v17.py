"""v17 — build 5.19: print layout up to 700 dpi, built in strips (never one giant canvas).
For A2 and A1 landscape at 600 and 700 dpi, at 1:50,000 and 1:10,000 (PDF), plus a 600 dpi PNG and a 700 dpi "Map only":
  - the output's real dpi equals the chosen dpi (pdfimages -list x/y-ppi of every strip image; PNG pixel size), the page
    size is the paper size, the strips cover the page exactly;
  - the measured scale is within 0.5 % and the scale bar matches it;
  - no seams: at every place where map regions meet (column seams and strip seams) a 100 % crop shows no step in the image
    (pixel change across the seam line vs. its neighbourhood), and the label check found no label repeated / missing;
  - no blank tiles: every map region has map pixels (not empty white / black);
  - progress "tile i of n", Cancel (no file, offscreen maps removed), the size/time warning with "don't ask again" saved
    in the browser, an explicit reason when a device cannot render the dpi; dropdown 150–700 dpi.
Usage: python3 tests/ui_test_v17.py  (OUT=/dir; QUICK=1 runs only A2 600 dpi cases)"""
import sys, os, time, json, subprocess, re
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
import sys as _s, os as _o; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import _nointro  # 5.27: start on the map, not the opening page
from PIL import Image
import numpy as np
Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8817; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v17shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
PAPER = {'A4': (210, 297), 'A3': (297, 420), 'A2': (420, 594), 'A1': (594, 841)}
def page_px(paper, orient, dpi):
    a, b = PAPER[paper]; w, h = (b, a) if orient == 'landscape' else (a, b); return round(w / 25.4 * dpi), round(h / 25.4 * dpi)
def pdf_crop(path, dpi, x, y, w, h):
    base = os.path.join(OUT, '_crop'); subprocess.run(['pdftoppm', '-r', str(dpi), '-x', str(int(x)), '-y', str(int(y)), '-W', str(int(w)), '-H', str(int(h)), '-png', '-singlefile', path, base], check=True)
    return Image.open(base + '.png').convert('RGB')
def seam_step(img, axis, at):
    """change across the seam line (between pixel `at-1` and `at`) relative to the median change of the 60 lines around it"""
    a = np.asarray(img).astype(int)
    d = np.abs(np.diff(a, axis=axis)).sum(axis=(1 - axis, 2)) if axis == 1 else np.abs(np.diff(a, axis=0)).sum(axis=(1, 2))
    ref = np.median(np.concatenate([d[max(0, at - 31):at - 2], d[at + 1:at + 30]])); return d[at - 1] / max(ref, 2.0 * img.size[1 - axis]), d[at - 1], ref  # noise floor: 2 levels per pixel of the line

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.printLayout', timeout=90000); time.sleep(2)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.19' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('localStorage.removeItem(GA.printLayout.KEY); GA.i18n.setLang("en"); GA.app.map.jumpTo({ center: [-3.5986, 37.1773], zoom: 13 })'); time.sleep(3)
        pg.evaluate('GA.pages.go("print")'); time.sleep(1)
        dpis = pg.evaluate('[...document.querySelectorAll("[data-pl=dpi] option")].map(o => +o.value)')
        check(dpis == [150, 200, 300, 400, 500, 600, 700], f'dpi choices 150–700 {dpis}')
        def setup(paper, orient, dpi, den, tpl='single'):
            pg.evaluate(f'''() => {{ const s = GA.printLayout.st; Object.assign(s, {{ paper: "{paper}", orient: "{orient}", dpi: {dpi}, template: "{tpl}", title: "Print test {dpi} dpi" }});
              s.slots[0] = {{ type: "map", denom: {den}, caption: "" }}; for (let i = 1; i < 4; i++) s.slots[i] = {{ type: "none", caption: "" }}; s.mo.denom = {den}; GA.pages.close(); GA.pages.go("print"); }}''')
            time.sleep(0.6)
        # ---------- warning before a very large export: Cancel, then Continue with "don't ask again" ----------
        setup('A2', 'landscape', 600, 50000); pg.evaluate('GA.printLayout.st.noLargeWarn = false')
        pg.click('[data-pl-act=pdf]'); pg.wait_for_selector('#pl-go', timeout=10000); w = pg.inner_text('#pl-msg')
        check(re.search(r'14,031 × 9,921 px', w) and re.search(r'≈ [\d,]+ MB', w) and re.search(r'≈ [\d,]+ min', w), 'warning states the page size, estimated MB and minutes', w)
        pg.click('#pl-stop'); time.sleep(0.5); check('cancelled' in pg.inner_text('#pl-msg').lower() and not pg.evaluate('GA.printLayout.running'), 'declining the warning starts nothing')
        # ---------- device limit: an explicit reason, never a silently lower dpi ----------
        pg.evaluate('GA.printLayout._setGlLimit(2048)'); setup('A2', 'landscape', 700, 50000); pg.evaluate('GA.printLayout.st.noLargeWarn = true')
        pg.click('[data-pl-act=pdf]'); pg.wait_for_function('document.querySelector("#pl-msg").innerText.includes("failed") || document.querySelector("#pl-msg").innerText.includes("cannot")', timeout=120000)
        m = pg.inner_text('#pl-msg'); check('700 dpi' in m and '2048' in m and 'lower dpi' in m, 'too-small GPU: export stops with the reason (canvas limit, dpi) and no file', m)
        pg.evaluate('GA.printLayout._setGlLimit(0)')
        # ---------- cancel during an export ----------
        setup('A1', 'landscape', 700, 10000); pg.evaluate('GA.printLayout.st.noLargeWarn = false'); pg.click('[data-pl-act=pdf]'); pg.wait_for_selector('#pl-go', timeout=10000)
        pg.click('#pl-nowarn'); pg.click('#pl-go')
        pg.wait_for_function('GA.printLayout.running && GA.printLayout.running.done >= 2', timeout=900000)
        prog = pg.inner_text('#pl-prog'); check(re.fullmatch(r'Rendering: tile \d+ of \d+ \(strip \d+ of \d+\)…', prog) is not None, f'progress shown: «{prog}»')
        downloads = []; pg.on('download', lambda d: downloads.append(d))
        pg.click('#pl-cancel'); pg.wait_for_function('!GA.printLayout.running', timeout=600000); time.sleep(2)
        check('cancelled' in pg.inner_text('#pl-msg').lower() and not downloads and pg.evaluate('[...document.querySelectorAll("div")].filter(d => d.style.left === "-20000px").length') == 0,
              'Cancel stops the export: no file, offscreen maps removed', pg.inner_text('#pl-msg'))
        saved = pg.evaluate('JSON.parse(localStorage.getItem(GA.printLayout.KEY)).noLargeWarn'); check(saved is True, '"don\'t ask again" is saved in the browser')
        # ---------- the exports ----------
        QUICK = os.environ.get('QUICK') == '1'
        cases = [('A2', 600, 50000, 'pdf', 'single'), ('A2', 600, 10000, 'pdf', 'single'), ('A2', 700, 50000, 'pdf', 'single'), ('A2', 700, 10000, 'pdf', 'single'),
                 ('A1', 600, 50000, 'pdf', 'single'), ('A1', 600, 10000, 'pdf', 'single'), ('A1', 700, 50000, 'pdf', 'single'), ('A1', 700, 10000, 'pdf', 'single'),
                 ('A2', 600, 50000, 'png', 'single'), ('A1', 700, 50000, 'pdf', 'maponly')]
        if QUICK: cases = [c for c in cases if c[0] == 'A2' and c[1] == 600]
        if os.environ.get('CASES'): cases = [cases[int(i)] for i in os.environ['CASES'].split(',')]  # run in batches (software GL is slow at 1:10,000)
        for paper, dpi, den, kind, tpl in cases:
            tag = f'{tpl} {paper} landscape {dpi} dpi 1:{den:,} {kind.upper()}'; t0 = time.time(); setup(paper, 'landscape', dpi, den, tpl)
            with pg.expect_download(timeout=3600000) as dl: pg.click(f'[data-pl-act={kind}]')
            path = os.path.join(OUT, f'{tpl}_{paper}_{dpi}_{den}.{kind}'); dl.value.save_as(path)
            r = pg.evaluate('(() => { const r = GA.lastPrint; return { dpi: r.dpi, W: r.W, H: r.H, strips: r.strips, maps: r.maps, msg: document.querySelector("#pl-msg").innerText }; })()')
            m = r['maps'][0]; W, H = page_px(paper, 'landscape', dpi); q = m['rect']; secs = round(time.time() - t0)
            print(f'     {tag}: {r["W"]}×{r["H"]} px, {r["strips"]} strips, {m["tiles"]} map tiles, {os.path.getsize(path) / 1e6:.1f} MB, {secs} s', flush=True)
            check(r['dpi'] == dpi and (r['W'], r['H']) == (W, H), f'{tag}: page {r["W"]} × {r["H"]} px = paper at {dpi} dpi')
            check(abs(m['measured'] - den) / den < 0.005, f'{tag}: measured scale 1:{round(m["measured"])}')
            check(f'Exported at {dpi} dpi' in r['msg'] and f'Map: {dpi} dpi actual' in r['msg'], f'{tag}: message states the real dpi', r['msg'])
            check(m['seam']['mismatches'] == 0, f'{tag}: labels identical across all {m["seam"]["checked"]} tile edges', m['seam'])
            if kind == 'pdf':
                info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout; pts = re.search(r'Page size:\s+([\d.]+) x ([\d.]+)', info)
                check(pts and abs(float(pts.group(1)) - W * 72 / dpi) < 0.5 and abs(float(pts.group(2)) - H * 72 / dpi) < 0.5, f'{tag}: PDF page {paper} landscape', info[:200])
                lst = subprocess.run(['pdfimages', '-list', path], capture_output=True, text=True).stdout.splitlines()[2:]
                imgs = [l.split() for l in lst if l.strip()]; ppi = {(int(x[12]), int(x[13])) for x in imgs}
                check(ppi == {(dpi, dpi)}, f'{tag}: every image in the PDF is {dpi} × {dpi} ppi ({len(imgs)} strip images)', ppi)
                check(all(int(x[3]) == W for x in imgs) and len(imgs) == r['strips'], f'{tag}: {len(imgs)} full-width strips, never one page-sized image')
                crop = lambda x, y, w, h: pdf_crop(path, dpi, x, y, w, h)
            else:
                im = Image.open(path); check(im.size == (W, H) and im.mode == 'RGB', f'{tag}: PNG {im.size} = paper at {dpi} dpi'); crop = lambda x, y, w, h: im.crop((int(x), int(y), int(x + w), int(y + h))).convert('RGB')
            # seams: columns (every inMax px of the map) and strips (every S rows) inside the map frame
            col_x = [q['x'] + c for c in range(m['colW'], q['w'], m['colW'])]
            row_y = [y for y in range(m['S'], r['H'], m['S']) if q['y'] + 160 < y < q['y'] + q['h'] - 160]
            # (1) strip seams, compared directly: each PDF strip repeats the first 16 rows of the next one (rendered by a different
            # map render) — those rows must be the same picture (up to JPEG noise)
            if kind == 'pdf':
                pre = os.path.join(OUT, '_strip'); [os.remove(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.startswith('_strip')]
                subprocess.run(['pdfimages', '-j', path, pre], check=True); fs = sorted(f for f in os.listdir(OUT) if f.startswith('_strip'))
                worst_ov = 0; p99 = 0
                for i in range(len(fs) - 1):
                    A = np.asarray(Image.open(os.path.join(OUT, fs[i])).convert('RGB')).astype(int); B = np.asarray(Image.open(os.path.join(OUT, fs[i + 1])).convert('RGB')).astype(int)
                    d = np.abs(A[-16:, q['x']:q['x'] + q['w']] - B[:16, q['x']:q['x'] + q['w']]); worst_ov = max(worst_ov, d.mean()); p99 = max(p99, np.percentile(d, 99.5))
                    del A, B
                [os.remove(os.path.join(OUT, f)) for f in fs]
                check(len(fs) >= 2 and worst_ov < 0.5 and p99 < 10, f'{tag}: strip seams — the {len(fs) - 1} overlaps rendered twice are the same picture (mean diff {worst_ov:.2f}, 99.5 % ≤ {p99:.0f} of 255)')
            # (2) every seam (columns and strips) at 100 %: change across the seam line summed over all samples vs. the change
            # beside it (a coincidental building edge on one seam cannot pass for a seam; a real offset raises every sample)
            steps = refs = 0; n_seams = 0; worst = 0
            for x in col_x[:3]:
                for y in [q['y'] + q['h'] // 3, q['y'] + 2 * q['h'] // 3]:
                    c = crop(x - 150, y - 150, 300, 300); ratio, step, ref = seam_step(c, 1, 150); steps += step; refs += ref; worst = max(worst, ratio); n_seams += 1
            for y in row_y[:4]:
                for x in [q['x'] + q['w'] // 3, q['x'] + 2 * q['w'] // 3]:
                    c = crop(x - 150, y - 150, 300, 300); ratio, step, ref = seam_step(c, 0, 150); steps += step; refs += ref; worst = max(worst, ratio); n_seams += 1
                    if x == q['x'] + q['w'] // 3 and y == row_y[0]: c.save(os.path.join(OUT, f'seam100_{tpl}_{paper}_{dpi}_{den}_{kind}.png'))
            agg = steps / max(refs, 1)
            check(n_seams > 0 and agg < 1.8 and worst < 8, f'{tag}: no seam at {n_seams} tile edges (change across edges = {agg:.2f} × beside them; largest single {worst:.2f})')
            # blank tiles: every map region (strip row × column) holds map pixels — judged on the whole region at 50 dpi; a region is
            # blank only if > 98 % of it is pure white (the map background is ≈ 242; overlays such as the scale bar cover part of a region)
            if kind == 'pdf': subprocess.run(['pdftoppm', '-r', '50', '-png', '-singlefile', path, os.path.join(OUT, '_low')], check=True); low = np.asarray(Image.open(os.path.join(OUT, '_low.png')).convert('L')).astype(int)
            else: low = np.asarray(im.convert('L').resize((round(W * 50 / dpi), round(H * 50 / dpi)), Image.BILINEAR)).astype(int)
            f50 = 50 / dpi; blanks = []; nreg = 0
            for y in range(q['y'] - (q['y'] % m['S']), q['y'] + q['h'], m['S']):
                for x in range(q['x'], q['x'] + q['w'], m['colW']):
                    y0, y1 = max(y, q['y']), min(y + m['S'], q['y'] + q['h']); x1 = min(x + m['colW'], q['x'] + q['w'])
                    reg = low[int(y0 * f50) + 1:int(y1 * f50) - 1, int(x * f50) + 1:int(x1 * f50) - 1]
                    if reg.size == 0: continue
                    nreg += 1
                    if (reg >= 253).mean() > 0.98 or (reg <= 3).mean() > 0.98: blanks.append((x, y))
            check(nreg >= m['tiles'] * 0.9 and not blanks, f'{tag}: no blank tiles ({nreg} map regions checked whole)', blanks)
        check(not errs, 'no page errors', errs[:3])
        ctx.close()
finally:
    srv.terminate()
print(f'\n{len(fails)} failure(s)' + (': ' + '; '.join(fails) if fails else ''))
sys.exit(1 if fails else 0)
