"""v36 — build 5.47: a large study area exports without freezing the page (owner report, 17 Nov 2026: the "Base" area,
a 4.5 km square of 20.25 km², froze the analysis page — "This page isn't responding" — and never exported).
Cause: js/mapcard.js put every building of the area (about 14,000) into ONE canvas path before filling it; the browser's
path work grew much faster than the building count (162 s in one block). Then the PDF pages were encoded with the
synchronous toDataURL. Now buildings and streets are filled in batches of 100, and GA.pdf.buildAsync encodes each page
with toBlob and yields between pages.
Checks (Chromium's regular canvas, like a normal computer): a saved 4.5 km square around the base opens on the analysis
page; its PDF downloads within 60 s; no single task blocks the page for more than 3 s during the export; the PDF is
valid (pages = planned pages, A3 landscape); the batched building fill still draws the buildings (dark pixels on the
first map page); GA.pdf.buildAsync makes the same PDF structure as GA.pdf.build. No page errors.
Usage: python3 tests/ui_test_v36.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, io, re
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
import _nointro  # start on the map, not the opening page
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8836; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v36shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()  # the regular (CPU) canvas: read-back through a software GPU would measure the test machine, not the page
        ctx = b.new_context(viewport={'width': 1600, 'height': 900}, accept_downloads=True); ctx.add_init_script('window.__noPanelHook = true;')
        pg = ctx.new_page(); V3.stub3(pg); errs = []
        pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=120000)
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']; check(ver >= '5.47' and pg.evaluate('window.GA_BUILD') == ver, f'build {ver}')
        pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.panels.set("study", true)')
        pg.evaluate('GA.app.sel.setCenterDirect([-3.6437, 37.1300])'); time.sleep(0.3); pg.evaluate('GA.app.sel.setSide(4500)'); time.sleep(0.3)
        pg.fill('#in-name', 'Base'); pg.click('#btn-save'); time.sleep(1)
        a = pg.evaluate('GA.app.store.get().areas.slice(-1)[0]'); aid = a['id']
        check(abs(a['measures']['area'] - 20.25e6) < 1e4, 'a 4.5 km square (20.25 km²) is saved', a['measures'])
        pg.evaluate('window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => __lt.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] })')
        pg.evaluate(f'GA.pages.go("fabric", "{aid}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=300000); time.sleep(3)
        lt = pg.evaluate('__lt'); check(max(lt or [0]) < 3000, f'the analysis page opens without a long freeze (longest task {max(lt or [0])} ms)')
        pg.evaluate('window.__lt = []'); t0 = time.time()
        with pg.expect_download(timeout=120000) as d: pg.evaluate(f'GA.fabric.exportPDF("{aid}")')
        dt = time.time() - t0; path = os.path.join(OUT, 'base_area.pdf'); d.value.save_as(path)
        lt = pg.evaluate('__lt'); check(dt < 60, f'the PDF downloads in {dt:.1f} s (< 60 s)')
        check(max(lt or [0]) < 3000, f'no task blocks the page for more than 3 s during the export (longest {max(lt or [0])} ms, {len(lt)} long tasks)')
        info = subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout
        pages = int(re.search(r'Pages:\s+(\d+)', info).group(1)); planned = pg.evaluate('GA.lastFabricPDF && GA.lastFabricPDF.pages')
        check(pages == planned and pages >= 2, f'PDF valid: {pages} pages = planned {planned}')
        check('1190.55 x 841.89' in info, 'A3 landscape pages', info[:200])
        # the first page with a map: dark (building) pixels are drawn
        subprocess.run(['pdftoppm', '-r', '40', '-png', '-f', '1', '-l', str(min(pages, 4)), path, os.path.join(OUT, 'pg')], check=True)
        from PIL import Image
        dark = []
        for f in sorted(x for x in os.listdir(OUT) if x.startswith('pg') and x.endswith('.png')):
            im = Image.open(os.path.join(OUT, f)).convert('L'); h = im.histogram(); dark.append(sum(h[:200]) / (im.width * im.height))
        check(max(dark) > 0.05, f'the map pages draw the buildings and streets (darkest page {max(dark):.2f} of pixels non-white)', dark)
        # buildAsync and build give the same structure for the same canvases
        same = pg.evaluate('''async () => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#992B2A'; g.fillRect(20, 20, 100, 80);
          const a = GA.pdf.build([{ canvas: c, paper: 'A4L' }, { canvas: c, paper: 'A4P' }], { title: 't' }), b = await GA.pdf.buildAsync([{ canvas: c, paper: 'A4L' }, { canvas: c, paper: 'A4P' }], { title: 't' });
          const s = (u) => new TextDecoder('latin1').decode(u); const k = (x) => (s(x).match(/\\/Type \\/Page[^s]|\\/MediaBox \\[[^\\]]+\\]|\\/Width \\d+ \\/Height \\d+/g) || []).join('|');
          return [k(a) === k(b), k(b), s(b).startsWith('%PDF-1.4'), s(b).trim().endsWith('%%EOF')]; }''')
        check(all([same[0], same[2], same[3]]), 'GA.pdf.buildAsync makes the same pages, sizes and images as GA.pdf.build', same[1][:200])
        check(not errs, 'no page errors', errs[:3])
finally:
    srv.terminate()
print(('ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + '; '.join(fails)), flush=True)
sys.exit(1 if fails else 0)
