"""v13 — build 5.14: the analysis-page locator map marks the CURRENT study area in red (#992B2A, thicker dashes, larger red
number above its top-right corner) and every OTHER saved study area in black (black dashes, black numbers); interiors are
transparent (no fill); the legend names "Current study area" / "Other study areas". Checked in the locator, its enlarged
viewer, the viewer's PNG / PDF exports and the analysis-board PDF, in English, Arabic and Hebrew.
Usage: python3 tests/ui_test_v13.py  (OUT=/dir for screenshots)"""
import sys, os, time, json, subprocess, base64, io
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8813; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v13shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)

RED = (0x99, 0x2B, 0x2A)
def red_px(im):  # pixels close to #992B2A
    im = im.convert('RGB'); px = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
    return sum(1 for r, g, b in px if abs(r - RED[0]) < 28 and abs(g - RED[1]) < 28 and abs(b - RED[2]) < 28)

# record every boundary and number the map cards draw (colour, width, size) — mapcard calls GA.fabricStyle.* at draw time
SPY = '''() => { const F = GA.fabricStyle; if (F.__spy) { F.__log.length = 0; return; } F.__spy = true; F.__log = [];
  const n0 = F.numberAt, s0 = F.strokeRing;
  const cid = (ctx) => { const c = ctx.canvas; if (!c.__gid) c.__gid = ++F.__n; return c.__gid; }; F.__n = 0;
  F.numberAt = function (ctx, pts, no, o) { F.__log.push({ cv: cid(ctx), k: 'num', no: String(no), color: (o && o.color) || null, size: (o && o.size) || null }); return n0.apply(this, arguments); };
  F.strokeRing = function (ctx, pts, o) { F.__log.push({ cv: cid(ctx), k: 'ring', color: (o && o.color) || null, width: (o && o.width) || null, dash: !!(o && o.dash) }); return s0.apply(this, arguments); }; }'''
def log(pg): return pg.evaluate('GA.fabricStyle.__log.slice()')

def marks(pg, entries, cur_no, tag):
    # only the canvases the locator drew (they carry the red current boundary); other cards keep their own 5.13 marks
    red0 = pg.evaluate('GA.palette.red'); cvs = set(e['cv'] for e in entries if e['k'] == 'ring' and e['color'] == red0)
    entries = [e for e in entries if e['cv'] in cvs]
    P = pg.evaluate('({ red: GA.palette.red, black: GA.palette.mark.number, NUM: GA.fabricStyle.NUM })')
    nums = [e for e in entries if e['k'] == 'num']; rings = [e for e in entries if e['k'] == 'ring']
    cur = [e for e in nums if e['no'] == cur_no]; oth = [e for e in nums if e['no'] != cur_no]
    check(P['red'].upper() == '#992B2A', f'{tag}: palette red is #992B2A', P['red'])
    check(cur and all(e['color'] == P['red'] and e['size'] > P['NUM'] for e in cur), f'{tag}: current area number {cur_no} red and larger than the others', cur)
    check(oth and len(set(e['no'] for e in oth)) == 2 and all(e['color'] == P['black'] and (e['size'] or P['NUM']) <= P['NUM'] for e in oth), f'{tag}: other area numbers black ({sorted(set(e["no"] for e in oth))})', oth[:3])
    check(rings and all(e['color'] == P['red'] and e['width'] > 3.4 and e['dash'] for e in rings), f'{tag}: current boundary red, dashed, thicker', rings)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded() && GA.fabricStyle', timeout=90000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.14' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver} (version.json and GA_BUILD agree)')
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.panels.set("study", true)')
        def mk_area(name, ll):
            pg.evaluate('document.querySelector("#btn-reset") && document.querySelector("#btn-reset").click()'); time.sleep(0.2)
            pg.evaluate(f'GA.app.sel.setCenterDirect({json.dumps(ll)})'); time.sleep(0.3); pg.fill('#in-name', name); pg.click('#btn-analyze')
            pg.wait_for_function('GA.app.getRun() && GA.app.getRun().X && !Object.values(GA.app.getRun().tasks).some(x => x.state === "running")', timeout=120000); time.sleep(0.6)
            return pg.evaluate('GA.app.getRun().areaId')
        a1 = mk_area('Centro', [-3.5995, 37.1766]); a2 = mk_area('Realejo', [-3.5930, 37.1720]); a3 = mk_area('Albaicín', [-3.5930, 37.1810])
        cur_no = str(pg.evaluate(f'GA.fabricStyle.numberOf("{a2}")'))
        pg.evaluate(SPY)
        LBL = {'en': ['Current study area', 'Other study areas'], 'ar': ['منطقة الدراسة الحالية', 'مناطق دراسة أخرى'], 'he': ['אזור המחקר הנוכחי', 'אזורי מחקר אחרים']}
        for lang in ['en', 'ar', 'he']:
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.3); pg.evaluate('GA.pages.close && GA.pages.close()'); time.sleep(0.3)
            pg.evaluate(SPY)
            pg.evaluate(f'GA.pages.go("fabric", "{a2}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=90000)
            pg.wait_for_function('GA.fabricStyle.__log.some(e => e.k === "num")', timeout=60000); time.sleep(1.2)
            marks(pg, log(pg), cur_no, f'locator ({lang})')
            cap = pg.evaluate('document.querySelector(".ap-loc figcaption").innerText')
            check(LBL[lang][0] in cap and LBL[lang][1] in cap, f'locator ({lang}): legend names current vs other study areas', cap[:160])
            sw = pg.evaluate('''() => [...document.querySelectorAll(".ap-loc figcaption li")].slice(0, 2).map(li => li.innerHTML)''')
            red = pg.evaluate('GA.palette.red').lower(); blk = pg.evaluate('GA.palette.mark.boundary').lower()
            check(len(sw) == 2 and red in sw[0].lower() and blk in sw[1].lower(), f'locator ({lang}): legend swatches red (current) and black (others)', sw)
            dl = pg.evaluate('''(() => { const c = document.querySelector("#ap-loc"); return c.toDataURL("image/png"); })()''')
            im = Image.open(io.BytesIO(base64.b64decode(dl.split(',')[1]))); im.save(f'{OUT}/locator_{lang}.png'); n = red_px(im)
            check(n > 150, f'locator ({lang}): red current-area outline drawn ({n} red pixels)', n)
            pg.evaluate('document.querySelector(".ap-loc").scrollIntoView({ block: "center" })'); time.sleep(0.4); pg.screenshot(path=f'{OUT}/analysis_page_{lang}.png')
            pg.locator('.ap-loc').screenshot(path=f'{OUT}/locator_figure_{lang}.png')
        # transparent interiors: the locator card has no fill layer (the 5.13 red 6 % tint is gone)
        src = open(os.path.join(ROOT, 'js/fabric.js'), encoding='utf-8').read(); lc = src[src.index('async function locCard'):src.index('function locFrame')]
        check("type: 'fill'" not in lc, 'locator: no fill inside any study area (interiors transparent)')
        pg.evaluate('GA.i18n.setLang("en")'); time.sleep(0.3)
        # enlarged viewer and its PNG / PDF exports
        pg.evaluate(SPY); pg.click('[data-ap-loc]'); pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "map"', timeout=60000); time.sleep(1.5)
        marks(pg, log(pg), cur_no, 'viewer')
        pg.screenshot(path=f'{OUT}/viewer_en.png')
        pg.evaluate(SPY)
        with pg.expect_download(timeout=120000) as d: pg.click('.viewer [data-x=png], [data-x=png]')
        path = f'{OUT}/viewer_export.png'; d.value.save_as(path); im = Image.open(path); im.load()
        marks(pg, log(pg), cur_no, 'viewer PNG export'); n = red_px(im.crop((0, 110, im.size[0], im.size[1] - 300)))
        check(n > 400, f'viewer PNG export: red current outline in the map ({n} red pixels, {im.size})', n)
        with pg.expect_download(timeout=120000) as d: pg.click('[data-x=pdf]')
        path = f'{OUT}/viewer_export.pdf'; d.value.save_as(path)
        info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout; check('Pages:' in info, 'viewer PDF export opens')
        subprocess.run(['pdftoppm', '-r', '60', '-png', '-singlefile', path, f'{OUT}/viewer_export_pdf'], check=False)
        if os.path.exists(f'{OUT}/viewer_export_pdf.png'): n = red_px(Image.open(f'{OUT}/viewer_export_pdf.png')); check(n > 60, f'viewer PDF export: red current outline rendered ({n} red pixels)', n)
        pg.keyboard.press('Escape'); time.sleep(0.5)
        # analysis-board PDF (the locator page) in Arabic
        pg.evaluate('GA.i18n.setLang("ar")'); time.sleep(0.3); pg.evaluate('GA.pages.close && GA.pages.close()'); time.sleep(0.3)
        pg.evaluate(f'GA.pages.go("fabric", "{a2}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=90000); time.sleep(1)
        pg.evaluate(SPY)
        with pg.expect_download(timeout=600000) as d: pg.evaluate(f'GA.fabric.exportPDF("{a2}")')
        path = f'{OUT}/analysis_board_ar.pdf'; d.value.save_as(path)
        info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout; check('Pages:' in info, 'analysis-board PDF opens (ar)', info[:80])
        L = log(pg)
        nums = [e for e in L if e['k'] == 'num']; red = pg.evaluate('GA.palette.red')
        check(any(e['no'] == cur_no and e['color'] == red for e in nums) and any(e['no'] != cur_no and e['color'] == pg.evaluate('GA.palette.mark.number') for e in nums), 'analysis-board PDF (ar): current number red, others black', nums[:4])
        check(any(e['k'] == 'ring' and e['color'] == red and e['width'] > 3.4 for e in L), 'analysis-board PDF (ar): current boundary red and thicker')
        subprocess.run(['pdftoppm', '-r', '40', '-png', path, f'{OUT}/board_ar'], check=False)
        check(not errs, 'no page errors', errs[:3])
        ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
