"""Live verification of the PUBLIC site (GitHub Pages) from a GitHub runner — real basemap tiles, real external services, no
stubs. Waits until the public site serves the expected build, then checks one PART (env PART, run as a job matrix):
  a — 3D: buildings at close zoom (centre on the ground), terrain beyond the MDT25 square, 3D tree forms, tree card
  b — regional view (Spain / Mediterranean / North Africa) and layers across zooms
  c — wind and rainfall, street sections with tree silhouettes
  d — historical places in Arabic; tablet (Hebrew) and phone (Arabic): 3D, regional view, panels + legend
Screenshots are printed as base64 JPEG between ===IMG name=== / ===END=== markers (job log only; nothing is committed).
Software rendering on the runner is slow: frames are kept small and every wait is generous."""
import base64, io, json, os, time, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'
EXPECT = os.environ.get('EXPECT_BUILD') or json.load(open('version.json'))['build']
PART = os.environ.get('PART', 'abcd')
res = []
def step(m): print(time.strftime('%H:%M:%S'), '·', m, flush=True)
def check(cond, msg, extra=''):
    res.append((bool(cond), msg)); print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
def shot(pg, name):
    step('screenshot ' + name)
    try: png = pg.screenshot(timeout=600000)
    except Exception as e: print('screenshot failed', name, str(e)[:120], flush=True); return
    im = Image.open(io.BytesIO(png)).convert('RGB'); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=74)
    b = base64.b64encode(buf.getvalue()).decode(); print(f'===IMG {name}.jpg==='); [print(b[i:i + 8000]) for i in range(0, len(b), 8000)]; print('===END===', flush=True)
v = None
for i in range(40):
    try:
        v = json.load(urllib.request.urlopen(SITE + 'version.json?nocache=' + str(time.time()), timeout=20))['build']; print('live version.json', v, flush=True)
        if v == EXPECT: break
    except Exception as e: print('version.json', e)
    time.sleep(20)
check(v == EXPECT, f'public site serves build {EXPECT} (version.json)', v)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
def boot(b, vp, lang, mobile=False):
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=1); pg = ctx.new_page(); pg.set_default_timeout(600000); errs = []; meteo = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('request', lambda r: 'open-meteo' in r.url and meteo.append(r.url))
    step(f'boot {vp["width"]}px {lang}'); pg.goto(SITE + '?v=' + EXPECT, wait_until='load', timeout=180000)
    pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.app.map.loaded() && GA.view3d && GA.regional', timeout=300000)
    check(pg.evaluate('window.GA_BUILD') == EXPECT, f'{vp["width"]}px: page runs build {EXPECT}', pg.evaluate('window.GA_BUILD'))
    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.5); return ctx, pg, errs, meteo
def idle(pg, ms=45000):
    pg.evaluate("ms => new Promise(r => { const m = GA.app.map; let d = false; const f = () => { if (!d) { d = true; r(); } }; m.once('idle', f); m.triggerRepaint(); setTimeout(f, ms); })", ms)
def go(pg, c, z, bearing=0, pitch=None):
    step(f'go {c} z{z}'); pg.evaluate(f'GA.app.map.jumpTo({{ center: {json.dumps(c)}, zoom: {z}, bearing: {bearing}{", pitch: " + str(pitch) if pitch is not None else ""} }})'); idle(pg); time.sleep(2)
def on_ground(pg, tag):
    pg.wait_for_function('GA.view3d.ground() > 500 && Math.abs(GA.app.map.transform.elevation - GA.view3d.ground()) < 2 && !GA.app.map.isMoving()', timeout=300000)
    r = pg.evaluate('[GA.app.map.transform.elevation, GA.view3d.ground(), GA.app.map.getPitch(), GA.view3d.state.global, GA.app.map.getZoom()]')
    check(abs(r[0] - r[1]) < 2 and r[2] > 40, f'{tag}: map centre on the ground ({r[0]:.0f} m vs {r[1]:.0f} m), pitch {r[2]:.0f}°, z{r[4]:.1f}, global terrain {r[3]}', r)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    if 'a' in PART:  # ---------------- 3D buildings, terrain, trees ----------------
        ctx, pg, errs, meteo = boot(b, {'width': 1100, 'height': 700}, 'en')
        go(pg, [-3.5930, 37.1760], 16); step('enter 3D'); pg.evaluate('GA.view3d.enter()'); on_ground(pg, 'live 3D z16')
        pg.evaluate('GA.app.map.zoomTo(17.6, { duration: 0 })'); idle(pg); on_ground(pg, 'live 3D z17.6'); shot(pg, '01_3d_buildings_close_en')
        pg.evaluate('GA.app.map.jumpTo({ zoom: 13.2, pitch: 62, bearing: 30 })'); idle(pg); time.sleep(3); shot(pg, '02_3d_terrain_beyond_dem_en')
        check(pg.evaluate('GA.view3d.state.global') == 'ok', 'live 3D: global elevation tiles load outside the 20 km square', pg.evaluate('GA.view3d.state'))
        go(pg, [-3.5871, 37.1643], 17.9, -30, 58); idle(pg); time.sleep(3)
        r = pg.evaluate('(async () => { const r = await GA.ext.trees([-3.5895, 37.1625, -3.5850, 37.1660]); const c = {}; r.pts.forEach(p => { const m = GA.trees.model(p.tags); c[m.form] = (c[m.form] || 0) + 1; }); return [GA.trees3d.shown, c]; })()')
        check(r[0] > 0, f'live 3D trees near the deodar cedar: {r[0]} drawn, forms in the area {r[1]}', r); shot(pg, '03_3d_tree_forms_en')
        go(pg, [-3.5792, 37.1981], 18.3, 40, 58); idle(pg); time.sleep(3); shot(pg, '04_3d_recorded_pines_en')
        xy = pg.evaluate('(() => { const p = GA.app.map.project([-3.579404, 37.198301]); return [p.x, p.y]; })()')
        pg.mouse.click(xy[0], xy[1] - 25); time.sleep(3); pop = pg.evaluate('(document.querySelector(".maplibregl-popup") || {}).innerText || ""')
        check('recorded' in pop and 'Unknown' in pop, 'live: clicking the recorded pine opens its card (recorded height, crown Unknown + estimate)', pop[:300]); shot(pg, '05_tree_card_en')
        check(not errs, 'live part a: no page errors', errs[:3]); ctx.close()
    if 'b' in PART:  # ---------------- regional view and layers across zooms ----------------
        ctx, pg, errs, meteo = boot(b, {'width': 1280, 'height': 760}, 'en')
        go(pg, [-3.0, 37.3], 4.5); time.sleep(8); idle(pg); shot(pg, '06_wide_spain_mediterranean_north_africa_en')
        check(pg.evaluate('GA.app.map.getZoom()') < 5 and pg.evaluate('document.querySelector("#legend").innerText.includes("Granada (study region)")'), 'live: regional view with Granada locator')
        L = ['streets', 'trees', 'fac_health', 'parks', 'neighbourhoods', 'municipality', 'bld_floors', 'bus_stops']
        pg.evaluate(f'{json.dumps(L)}.forEach(k => GA.app.L.setOn(k, true))'); time.sleep(4)
        for z, c, name in [(4.5, [-3.0, 37.3], '07_layers_z4_5'), (8, [-3.6, 37.25], '08_layers_z8'), (11.5, [-3.6, 37.18], '09_layers_z11_5'), (14, [-3.598, 37.176], '10_layers_z14'), (16.6, [-3.5995, 37.1735], '11_layers_z16_6')]:
            go(pg, c, z); time.sleep(4); idle(pg)
            st = pg.evaluate(f'''{json.dumps(L)}.map(k => {{ const s = GA.app.L.S[k]; const blk = document.querySelector('#legend .lg-blk[data-ly="' + k + '"]'); return [k, s.on, s.status, GA.app.L.drawsHere(k), !!blk, !!(blk && blk.querySelector('[data-ly-zoomto]'))]; }})''')
            bad = [x for x in st if not x[1] or x[2] == 'failed' or not x[4] or (not x[3] and not x[5] and x[2] not in ('ok', 'overview', 'city', 'lite'))]
            check(not bad, f'live z{z}: {len(L)} layers on, in the legend, drawn or explained', bad)
            if z in (11.5, 4.5): pg.evaluate('GA.panels.set("layers", true)'); time.sleep(2)
            shot(pg, name + '_en'); pg.evaluate('GA.panels.set("layers", false)')
        check(not errs, 'live part b: no page errors', errs[:3]); ctx.close()
    if 'c' in PART:  # ---------------- climate and sections ----------------
        ctx, pg, errs, meteo = boot(b, {'width': 1280, 'height': 800}, 'en')
        pg.evaluate('GA.app.L.setOn("wind", true); GA.app.L.setOn("rain", true)')
        pg.wait_for_function('["wind", "rain"].every(k => !["loading", "idle"].includes(GA.app.L.S[k].status))', timeout=180000)
        r = pg.evaluate('["wind", "rain"].map(k => [GA.app.L.S[k].status, GA.app.L.S[k].statusExtra])'); check(r[0][0] == 'ok' and r[1][0] == 'ok', 'live: wind and rainfall load', r)
        check(not meteo, 'live: wind/rain served from the site snapshot (no Open-Meteo quota used)', meteo[:2])
        lg = pg.evaluate('document.querySelector("#legend").innerText'); check('Prevailing direction' in lg and 'annual total' in lg, 'live: wind and rain legends show statistics', lg[:200])
        go(pg, [-3.57, 37.2], 10.4); shot(pg, '12_wind_rain_en'); pg.evaluate('GA.panels.set("layers", true)'); time.sleep(2); shot(pg, '13_wind_rain_layers_panel_en'); pg.evaluate('GA.panels.set("layers", false)')
        pg.evaluate('GA.app.L.setOn("wind", false); GA.app.L.setOn("rain", false)')
        for nm, pts, fn in [('Cedar and broadleaves', [[-3.5880, 37.16425], [-3.5862, 37.16425]], '14_section_tree_forms_en'), ('Aleppo pines', [[-3.5800, 37.19825], [-3.5784, 37.19825]], '15_section_recorded_pines_en')]:
            step('section ' + nm)
            sid = pg.evaluate('''(a) => { const p = GA.app.store.get(); p.sections = p.sections || []; const s = { id: GA.app.store.uid("sec"), name: a[0], pts: a[1], floorH: 3, corridor: 25, created: new Date().toISOString() }; p.sections.push(s); return s.id; }''', [nm, pts])
            pg.evaluate('() => { GA.lastViewer = null; }'); pg.evaluate('(id) => GA.sectionView.open(null, id)', sid)
            pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "section" && GA.lastViewer.last', timeout=300000); time.sleep(3)
            tr = pg.evaluate('GA.lastViewer.last.trees.map(t => [Math.round(t.h * 10) / 10, Math.round(t.c * 10) / 10, t.sch])'); check(len(tr) > 0, f'live section "{nm}": {len(tr)} trees drawn (h, crown, schematic) {tr[:6]}', tr); shot(pg, fn); pg.keyboard.press('Escape'); time.sleep(1)
        check(not errs, 'live part c: no page errors', errs[:3]); ctx.close()
    if 'd' in PART:  # ---------------- history (ar), tablet (he), phone (ar) ----------------
        ctx, pg, errs, meteo = boot(b, {'width': 1280, 'height': 860}, 'ar')
        pg.evaluate('GA.pages.go("history")'); pg.wait_for_function('document.querySelectorAll("#hx-places .hx-place").length >= 13', timeout=300000); time.sleep(8)
        r = pg.evaluate('[...document.querySelectorAll("#hx-places .hx-place p[lang]")].map(p => p.lang)'); check(r and all(x == 'ar' for x in r), 'live history (ar): every place description in Arabic (native or labelled translation)', r)
        pg.evaluate('document.querySelector("#hx-places").scrollIntoView()'); time.sleep(1); shot(pg, '16_history_places_ar')
        check(not errs, 'live history: no page errors', errs[:3]); ctx.close()
        for tag, vp, lang in [('tablet', {'width': 820, 'height': 1180}, 'he'), ('phone', {'width': 390, 'height': 844}, 'ar')]:
            ctx, pg, errs, meteo = boot(b, vp, lang, True)
            go(pg, [-3.5965, 37.1755], 16.2); pg.evaluate('GA.view3d.enter()'); on_ground(pg, f'live {tag} 3D'); shot(pg, f'17_{tag}_3d_{lang}')
            pg.evaluate('GA.view3d.exit()'); time.sleep(2); go(pg, [-3.4, 37.4], 4.3); time.sleep(5); shot(pg, f'18_{tag}_wide_{lang}')
            pg.evaluate('GA.app.L.setOn("wind", true)'); pg.wait_for_function('GA.app.L.S.wind.status !== "loading"', timeout=180000); go(pg, [-3.58, 37.19], 11)
            pg.evaluate('GA.panels.set("layers", true)'); time.sleep(2); shot(pg, f'19_{tag}_layers_panel_{lang}')
            check(pg.evaluate('GA.app.L.S.wind.status') == 'ok', f'live {tag}: wind loads'); check(not errs, f'live {tag}: no page errors', errs[:3]); ctx.close()
    b.close()
n = sum(1 for c, _ in res if not c); print(f'\nLIVE RESULT part {PART}: {len(res) - n}/{len(res)} checks passed' + ('' if not n else ' — FAILED: ' + '; '.join(m for c, m in res if not c)), flush=True)
