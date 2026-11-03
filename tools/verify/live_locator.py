"""Live verification of build 5.14 on the PUBLIC site (GitHub Pages) from a GitHub runner: the analysis-page location map
draws the CURRENT study area red (#992B2A, thicker dashes, larger red number above its top-right corner) and the OTHER
saved areas black (black dashes, black numbers), transparent interiors, legend "Current / Other study areas" — in the
locator (en / ar / he), its enlarged viewer and the viewer's PNG / PDF exports. Fresh browser (no visitor data touched).
Screenshots are printed as base64 JPEG between ===IMG name=== / ===END=== markers (job log only; nothing is committed)."""
import base64, io, json, os, time, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'
EXPECT = os.environ.get('EXPECT_BUILD') or json.load(open('version.json'))['build']
res = []
def step(m): print(time.strftime('%H:%M:%S'), '·', m, flush=True)
def check(cond, msg, extra=''):
    res.append((bool(cond), msg)); print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
def emit(name, png):
    im = Image.open(io.BytesIO(png)).convert('RGB'); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80)
    b = base64.b64encode(buf.getvalue()).decode(); print(f'===IMG {name}.jpg==='); [print(b[i:i + 8000]) for i in range(0, len(b), 8000)]; print('===END===', flush=True)
def red_px(im):
    im = im.convert('RGB'); px = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
    return sum(1 for r, g, b in px if abs(r - 0x99) < 28 and abs(g - 0x2B) < 28 and abs(b - 0x2A) < 28)
SPY = '''() => { const F = GA.fabricStyle; if (F.__spy) { F.__log.length = 0; return; } F.__spy = true; F.__log = []; F.__n = 0;
  const cid = (ctx) => { const c = ctx.canvas; if (!c.__gid) c.__gid = ++F.__n; return c.__gid; }; const n0 = F.numberAt, s0 = F.strokeRing;
  F.numberAt = function (ctx, pts, no, o) { F.__log.push({ cv: cid(ctx), k: 'num', no: String(no), color: (o && o.color) || null, size: (o && o.size) || null }); return n0.apply(this, arguments); };
  F.strokeRing = function (ctx, pts, o) { F.__log.push({ cv: cid(ctx), k: 'ring', color: (o && o.color) || null, width: (o && o.width) || null, dash: !!(o && o.dash) }); return s0.apply(this, arguments); }; }'''
def marks(pg, cur_no, tag):
    L = pg.evaluate('GA.fabricStyle.__log.slice()'); P = pg.evaluate('({ red: GA.palette.red, black: GA.palette.mark.number, NUM: GA.fabricStyle.NUM })')
    cvs = set(e['cv'] for e in L if e['k'] == 'ring' and e['color'] == P['red']); L = [e for e in L if e['cv'] in cvs]
    nums = [e for e in L if e['k'] == 'num']; cur = [e for e in nums if e['no'] == cur_no]; oth = [e for e in nums if e['no'] != cur_no]
    check(P['red'].upper() == '#992B2A' and cvs, f'{tag}: current boundary drawn in #992B2A', P['red'])
    check(cur and all(e['color'] == P['red'] and e['size'] > P['NUM'] for e in cur), f'{tag}: current number {cur_no} red and larger', cur[:2])
    check(len(set(e['no'] for e in oth)) == 2 and all(e['color'] == P['black'] for e in oth), f'{tag}: other numbers black {sorted(set(e["no"] for e in oth))}', oth[:3])
v = None
for i in range(45):
    try:
        v = json.load(urllib.request.urlopen(SITE + 'version.json?nocache=' + str(time.time()), timeout=20))['build']; print('live version.json', v, flush=True)
        if v == EXPECT: break
    except Exception as e: print('version.json', e)
    time.sleep(20)
check(v == EXPECT, f'public site serves build {EXPECT} (version.json)', v)
LBL = {'en': ['Current study area', 'Other study areas'], 'ar': ['منطقة الدراسة الحالية', 'مناطق دراسة أخرى'], 'he': ['אזור המחקר הנוכחי', 'אזורי מחקר אחרים']}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, accept_downloads=True); pg = ctx.new_page(); pg.set_default_timeout(600000); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    step('boot'); pg.goto(SITE + '?v=' + EXPECT, wait_until='load', timeout=180000)
    pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.app.map.loaded() && GA.fabricStyle', timeout=300000)
    check(pg.evaluate('window.GA_BUILD') == EXPECT, f'page runs build {EXPECT}', pg.evaluate('window.GA_BUILD'))
    pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.panels.set("study", true)'); time.sleep(1)
    def mk_area(name, ll):
        step('area ' + name); pg.evaluate('document.querySelector("#btn-reset") && document.querySelector("#btn-reset").click()'); time.sleep(0.3)
        pg.evaluate(f'GA.app.sel.setCenterDirect({json.dumps(ll)})'); time.sleep(0.5); pg.fill('#in-name', name); pg.click('#btn-analyze')
        pg.wait_for_function('GA.app.getRun() && GA.app.getRun().X && !Object.values(GA.app.getRun().tasks).some(x => x.state === "running")', timeout=600000); time.sleep(1)
        return pg.evaluate('GA.app.getRun().areaId')
    a1 = mk_area('Centro', [-3.5995, 37.1766]); a2 = mk_area('Realejo', [-3.5930, 37.1720]); a3 = mk_area('Albaicín', [-3.5930, 37.1810])
    cur = str(pg.evaluate(f'GA.fabricStyle.numberOf("{a2}")'))
    for lang in ['en', 'ar', 'he']:
        step('locator ' + lang); pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.5); pg.evaluate('GA.pages.close && GA.pages.close()'); time.sleep(0.5); pg.evaluate(SPY)
        pg.evaluate(f'GA.pages.go("fabric", "{a2}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=300000)
        pg.wait_for_function('GA.fabricStyle.__log.some(e => e.k === "num")', timeout=300000); time.sleep(3)
        marks(pg, cur, f'live locator ({lang})')
        cap = pg.evaluate('document.querySelector(".ap-loc figcaption").innerText'); check(LBL[lang][0] in cap and LBL[lang][1] in cap, f'live locator ({lang}): legend current vs other study areas', cap[:160])
        pg.evaluate('document.querySelector(".ap-loc").scrollIntoView({ block: "center" })'); time.sleep(1)
        png = pg.locator('.ap-loc').screenshot(); n = red_px(Image.open(io.BytesIO(png))); check(n > 150, f'live locator ({lang}): red outline visible ({n} px)', n); emit(f'locator_{lang}', png)
    step('viewer'); pg.evaluate('GA.i18n.setLang("en")'); time.sleep(0.5); pg.evaluate('GA.pages.close && GA.pages.close()'); time.sleep(0.5)
    pg.evaluate(f'GA.pages.go("fabric", "{a2}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=300000); time.sleep(2)
    pg.evaluate(SPY); pg.click('[data-ap-loc]'); pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "map"', timeout=300000); time.sleep(4)
    marks(pg, cur, 'live viewer'); emit('viewer_en', pg.screenshot())
    pg.evaluate(SPY)
    with pg.expect_download(timeout=600000) as d: pg.click('[data-x=png]')
    path = '/tmp/viewer.png'; d.value.save_as(path); im = Image.open(path); im.load(); marks(pg, cur, 'live viewer PNG export')
    n = red_px(im); check(n > 400, f'live viewer PNG export: red outline ({n} px, {im.size})', n); buf = io.BytesIO(); im.save(buf, 'PNG'); emit('viewer_export_png', buf.getvalue())
    with pg.expect_download(timeout=600000) as d: pg.click('[data-x=pdf]')
    path = '/tmp/viewer.pdf'; d.value.save_as(path); head = open(path, 'rb').read(5); check(head == b'%PDF-' and os.path.getsize(path) > 20000, f'live viewer PDF export ({os.path.getsize(path)} bytes)')
    check(not errs, 'live: no page errors', errs[:3]); b.close()
n = sum(1 for c, _ in res if not c); print(f'\nLIVE RESULT locator: {len(res) - n}/{len(res)} checks passed' + ('' if not n else ' — FAILED: ' + '; '.join(m for c, m in res if not c)), flush=True)
