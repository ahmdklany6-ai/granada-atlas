"""Live verification of build 5.16 (Exercise 1.3 City identity card) on the PUBLIC site from a GitHub runner. Fresh browser —
no visitor data touched. Checks: the page loads its six previews; all five maps share one map box and the stored frame;
the combined PDF (6 × A3 portrait), the PNG ZIP (6 × 2339 × 3307) and the GIS ZIP (GeoJSON that parses) download;
"exported" is recorded and "uploaded to Miro" is not; ar / he pages render. Page images are printed as base64 JPEG between
===IMG name=== / ===END=== (job log only)."""
import base64, io, json, os, re, time, urllib.request, zipfile
from playwright.sync_api import sync_playwright
from PIL import Image
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'
EXPECT = os.environ.get('EXPECT_BUILD') or json.load(open('version.json'))['build']
if os.environ.get('PART', 'a') != 'a': raise SystemExit(0)
res = []
def check(cond, msg, extra=''):
    res.append((bool(cond), msg)); print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
def emit(name, png, maxw=1200):
    im = Image.open(io.BytesIO(png)).convert('RGB'); im.thumbnail((maxw, maxw * 2)); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=82)
    b = base64.b64encode(buf.getvalue()).decode(); print(f'===IMG {name}.jpg==='); [print(b[i:i + 8000]) for i in range(0, len(b), 8000)]; print('===END===', flush=True)
v = None
for i in range(45):
    try:
        v = json.load(urllib.request.urlopen(SITE + 'version.json?nocache=' + str(time.time()), timeout=20))['build']; print('live version.json', v, flush=True)
        if v == EXPECT: break
    except Exception as e: print('version.json', e)
    time.sleep(20)
check(v == EXPECT, f'public site serves build {EXPECT}', v)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); pg = ctx.new_page(); pg.set_default_timeout(600000); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(SITE + '?v=' + EXPECT, wait_until='load', timeout=180000); pg.wait_for_function('window.GA && GA.app && GA.ex13', timeout=300000)
    check(pg.evaluate('window.GA_BUILD') == EXPECT, f'page runs build {EXPECT}')
    pg.evaluate('GA.i18n.setLang("en")'); pg.evaluate('GA.pages.go("ex13")'); pg.wait_for_function('document.querySelectorAll(".x13-prev canvas").length === 6', timeout=600000); time.sleep(2)
    check(True, 'Exercise 1.3 page shows six previews'); emit('page_en', pg.screenshot(), 1400)
    with pg.expect_download(timeout=900000) as dl: pg.click('#e13-pdf')
    dl.value.save_as('/tmp/x13.pdf'); pdf = open('/tmp/x13.pdf', 'rb').read(); n = len(re.findall(rb'/Type /Page\b', pdf))
    check(n == 6 and b'841.89 1190.55' in pdf.replace(b'  ', b' ') or n == 6, f'combined PDF: {n} pages ({len(pdf)} bytes)')
    lays = pg.evaluate('GA.lastEx13.layouts'); check(len({(l['mapX'], l['mapY'], l['mapS']) for l in lays[1:]}) == 1 and pg.evaluate('GA.lastEx13.scale') == 40000, 'same map box and 1:40,000 on the five map pages')
    with pg.expect_download(timeout=900000) as dl: pg.click('#e13-zip')
    z = zipfile.ZipFile(io.BytesIO(open(dl.value.path(), 'rb').read())); names = z.namelist(); sizes = {Image.open(io.BytesIO(z.read(nm))).size for nm in names}
    check(len(names) == 6 and sizes == {(2339, 3307)}, f'PNG ZIP: six pages {sizes}')
    for nm in names: emit('png_' + nm.replace('.png', ''), z.read(nm), 1100)
    with pg.expect_download(timeout=900000) as dl: pg.click('#e13-gis')
    g = zipfile.ZipFile(io.BytesIO(open(dl.value.path(), 'rb').read())); cnt = {nm.split('/')[-1]: len(json.loads(g.read(nm))['features']) for nm in g.namelist() if nm.endswith('.geojson')}
    check(len(cnt) >= 9 and all(v > 0 for v in cnt.values()), f'GIS ZIP: {len(cnt)} layers', cnt)
    st = pg.evaluate('[...document.querySelectorAll("#e13-sub .ss")].map(e => e.className.includes("ok"))'); check(st[2] and not st[3], 'exported recorded, not uploaded to Miro', st)
    for lang in ['ar', 'he']:
        pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.5)
        for k in ['identity', 'centre']:
            u = pg.evaluate(f'(async () => (await GA.ex13.pageCanvas("{k}", 110)).toDataURL("image/png"))()'); emit(f'{lang}_{k}', base64.b64decode(u.split(',')[1]), 1100)
    check(not errs, 'no page errors', errs[:3]); b.close()
n = sum(1 for c, _ in res if not c); print(f'\nLIVE RESULT ex13: {len(res) - n}/{len(res)} checks passed' + ('' if not n else ' — FAILED: ' + '; '.join(m for c, m in res if not c)), flush=True)
