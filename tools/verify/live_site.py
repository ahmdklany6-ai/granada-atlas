"""Live verification of the PUBLIC site (GitHub Pages) from a GitHub runner — real basemap tiles, real external services, no
stubs. Waits until the public site serves the expected build, then checks the 3D view, the regional zoom, layers across
zooms, wind/rain, trees, sections and the historical page on desktop, tablet and phone. Screenshots are printed as
base64 JPEG between ===IMG name=== / ===END=== markers (job log only; nothing is committed).
Env: EXPECT_BUILD (default: version.json of the checkout)."""
import base64, io, json, os, sys, time, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'
EXPECT = os.environ.get('EXPECT_BUILD') or json.load(open('version.json'))['build']
res = []
def check(cond, msg, extra=''):
    res.append((bool(cond), msg)); print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
def shot(pg, name, full=False):
    png = pg.screenshot(full_page=full); im = Image.open(io.BytesIO(png)).convert('RGB'); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=72)
    b = base64.b64encode(buf.getvalue()).decode(); print(f'===IMG {name}.jpg==='); [print(b[i:i + 8000]) for i in range(0, len(b), 8000)]; print('===END===', flush=True)
for i in range(40):
    try:
        v = json.load(urllib.request.urlopen(SITE + 'version.json?nocache=' + str(time.time()), timeout=20))['build']
        print('live version.json', v, flush=True)
        if v == EXPECT: break
    except Exception as e: print('version.json', e)
    time.sleep(20)
check(v == EXPECT, f'public site serves build {EXPECT} (version.json)', v)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
def boot(b, vp, lang, mobile=False):
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=1); pg = ctx.new_page(); errs = []; meteo = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('request', lambda r: 'open-meteo' in r.url and meteo.append(r.url))
    pg.goto(SITE + '?v=' + EXPECT, wait_until='load', timeout=120000); pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.app.map.loaded() && GA.view3d && GA.regional', timeout=120000)
    check(pg.evaluate('window.GA_BUILD') == EXPECT, f'{vp["width"]}px: page runs build {EXPECT}', pg.evaluate('window.GA_BUILD'))
    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.5); return ctx, pg, errs, meteo
def idle(pg, ms=40000):
    pg.evaluate("ms => new Promise(r => { const m = GA.app.map; let d = false; const f = () => { if (!d) { d = true; r(); } }; m.once('idle', f); m.triggerRepaint(); setTimeout(f, ms); })", ms)
def go(pg, c, z, bearing=0, pitch=None):
    pg.evaluate(f'GA.app.map.jumpTo({{ center: {json.dumps(c)}, zoom: {z}, bearing: {bearing}{", pitch: " + str(pitch) if pitch is not None else ""} }})'); idle(pg); time.sleep(3)
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    # ---------------- desktop, English: 3D buildings, trees, wide view, layers, climate, section ----------------
    ctx, pg, errs, meteo = boot(b, {'width': 1440, 'height': 900}, 'en')
    go(pg, [-3.5930, 37.1760], 15); pg.evaluate('GA.view3d.enter()'); time.sleep(4); idle(pg)
    for z in [16, 17, 18]:
        pg.evaluate(f'GA.app.map.zoomTo({z}, {{ duration: 0 }})'); idle(pg); time.sleep(3)
        r = pg.evaluate('[GA.app.map.transform.elevation, GA.view3d.ground(), GA.app.map.getPitch(), GA.view3d.state.global]')
        check(r[1] > 500 and abs(r[0] - r[1]) < 2 and r[2] > 50, f'live 3D z{z}: centre on the ground ({r[0]:.0f} m), pitch {r[2]:.0f}°, global terrain {r[3]}', r)
    pg.evaluate('GA.app.map.easeTo({ zoom: 17.3, bearing: -35, duration: 0 })'); idle(pg); time.sleep(3); shot(pg, '01_3d_buildings_close_en')
    pg.evaluate('GA.app.map.easeTo({ zoom: 13, pitch: 60, bearing: 20, duration: 0 })'); idle(pg); time.sleep(4); shot(pg, '02_3d_terrain_beyond_dem_en')
    check(pg.evaluate('GA.view3d.state.global') == 'ok', 'live 3D: global elevation tiles load (no flat walls outside the 20 km square)', pg.evaluate('GA.view3d.state'))
    go(pg, [-3.5871, 37.1641], 17.8, -30); time.sleep(3); idle(pg); time.sleep(3)
    r = pg.evaluate('(async () => { const r = await GA.ext.trees([-3.5895, 37.1625, -3.5850, 37.1660]); const c = {}; r.pts.forEach(p => { const m = GA.trees.model(p.tags); c[m.form] = (c[m.form] || 0) + 1; }); return [GA.trees3d.shown, c]; })()')
    check(r[0] > 0, f'live 3D trees near the deodar cedar: {r[0]} trees, forms {r[1]}', r); shot(pg, '03_3d_tree_forms_round_conical_generic_en')
    go(pg, [-3.5792, 37.1982], 18.2, 40); time.sleep(3); idle(pg); time.sleep(3); shot(pg, '04_3d_recorded_pines_20m_27m_en')
    # click a tree: popup with recorded vs estimate
    pt = pg.evaluate('(() => { const m = GA.app.map; const f = m.queryRenderedFeatures({ layers: ["ga3d-trees-crown"] })[0]; if (!f) return null; const c = JSON.parse(f.properties.tg); const pts = m.project([-3.579404, 37.198301]); return [pts.x, pts.y]; })()')
    if pt:
        pg.mouse.click(pt[0], pt[1] - 40); time.sleep(2); pop = pg.evaluate('(document.querySelector(".maplibregl-popup") || {}).innerText || ""'); check('recorded' in pop or 'Unknown' in pop, 'live: clicking a 3D tree opens its card', pop[:200]); shot(pg, '05_tree_card_en')
    pg.evaluate('GA.view3d.exit()'); time.sleep(2)
    # wide view
    go(pg, [-3.2, 37.6], 4.6); time.sleep(6); idle(pg); time.sleep(4); shot(pg, '06_wide_spain_mediterranean_north_africa_en')
    check(pg.evaluate('GA.app.map.getZoom()') < 5 and pg.evaluate('document.querySelector("#legend").innerText.includes("Granada (study region)")'), 'live: regional view with Granada locator')
    # layers across zooms
    L = ['streets', 'trees', 'fac_health', 'parks', 'neighbourhoods', 'municipality', 'bld_floors', 'bus_stops']
    pg.evaluate(f'{json.dumps(L)}.forEach(k => GA.app.L.setOn(k, true))'); time.sleep(3)
    for z, c, name in [(7.5, [-3.6, 37.3], '07_layers_z7_5'), (11.5, [-3.6, 37.18], '08_layers_z11_5'), (14, [-3.598, 37.176], '09_layers_z14'), (16.5, [-3.5995, 37.1735], '10_layers_z16_5')]:
        go(pg, c, z); time.sleep(4); idle(pg); time.sleep(3)
        st = pg.evaluate(f'''{json.dumps(L)}.map(k => {{ const s = GA.app.L.S[k]; const blk = document.querySelector('#legend .lg-blk[data-ly="' + k + '"]'); return [k, s.on, s.status, GA.app.L.drawsHere(k), !!blk, !!(blk && blk.querySelector('[data-ly-zoomto]'))]; }})''')
        bad = [x for x in st if not x[1] or x[2] == 'failed' or not x[4] or (not x[3] and not x[5] and x[2] not in ('ok', 'overview', 'city', 'lite'))]
        check(not bad, f'live z{z}: {len(L)} layers on, in the legend, drawn or explained', bad)
        if z == 11.5: pg.evaluate('GA.panels.set("layers", true)'); time.sleep(1.5)
        shot(pg, name + '_en'); pg.evaluate('GA.panels.set("layers", false)')
    pg.evaluate(f'{json.dumps(L)}.forEach(k => GA.app.L.setOn(k, k === "municipality" || k === "bld_floors" || k === "neighbourhoods"))')
    # climate
    pg.evaluate('GA.app.L.setOn("wind", true); GA.app.L.setOn("rain", true)')
    pg.wait_for_function('["wind", "rain"].every(k => !["loading", "idle"].includes(GA.app.L.S[k].status))', timeout=120000)
    r = pg.evaluate('["wind", "rain"].map(k => [GA.app.L.S[k].status, GA.app.L.S[k].statusExtra])'); check(r[0][0] == 'ok' and r[1][0] == 'ok', 'live: wind and rainfall load', r)
    check(not meteo, 'live: wind/rain served from the site snapshot (no Open-Meteo quota used)', meteo[:2])
    go(pg, [-3.57, 37.2], 10.4); pg.evaluate('GA.panels.set("layers", true)'); time.sleep(2); shot(pg, '11_wind_rain_en'); pg.evaluate('GA.panels.set("layers", false)')
    pg.evaluate('GA.app.L.setOn("wind", false); GA.app.L.setOn("rain", false)')
    # sections with tree forms (real mapped trees)
    for nm, pts, f in [('Cedar and broadleaves', [[-3.5880, 37.16405], [-3.5862, 37.16405]], '12_section_tree_forms_en'), ('Aleppo pines', [[-3.5800, 37.19825], [-3.5784, 37.19825]], '13_section_recorded_pines_en')]:
        sid = pg.evaluate('''(a) => { const p = GA.app.store.get(); p.sections = p.sections || []; const s = { id: GA.app.store.uid("sec"), name: a[0], pts: a[1], floorH: 3, corridor: 25, created: new Date().toISOString() }; p.sections.push(s); return s.id; }''', [nm, pts])
        pg.evaluate('() => { GA.lastViewer = null; }'); pg.evaluate('(id) => GA.sectionView.open(null, id)', sid)
        pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "section" && GA.lastViewer.last', timeout=180000); time.sleep(3)
        tr = pg.evaluate('GA.lastViewer.last.trees.map(t => [Math.round(t.h * 10) / 10, Math.round(t.c * 10) / 10, t.sch])'); check(len(tr) > 0, f'live section "{nm}": {len(tr)} trees drawn {tr[:6]}'); shot(pg, f); pg.keyboard.press('Escape'); time.sleep(1)
    check(not errs, 'live desktop en: no page errors', errs[:3]); ctx.close()
    # ---------------- Arabic desktop: 3D, history ----------------
    ctx, pg, errs, meteo = boot(b, {'width': 1440, 'height': 900}, 'ar')
    go(pg, [-3.5965, 37.1755], 16); pg.evaluate('GA.view3d.enter()'); time.sleep(4); idle(pg); pg.evaluate('GA.app.map.easeTo({ zoom: 17, bearing: 25, duration: 0 })'); idle(pg); time.sleep(3); shot(pg, '14_3d_buildings_ar')
    pg.evaluate('GA.view3d.exit()'); time.sleep(1)
    pg.evaluate('GA.pages.go("history")'); pg.wait_for_function('document.querySelectorAll("#hx-places .hx-place").length >= 13', timeout=180000); time.sleep(8)
    r = pg.evaluate('[...document.querySelectorAll("#hx-places .hx-place p[lang]")].map(p => p.lang)'); check(r and all(x == 'ar' for x in r), 'live history (ar): every place description in Arabic (native or labelled translation)', r)
    pg.evaluate('document.querySelector("#hx-places").scrollIntoView()'); time.sleep(1); shot(pg, '15_history_places_ar')
    check(not errs, 'live desktop ar: no page errors', errs[:3]); ctx.close()
    # ---------------- tablet (he) and phone (ar) ----------------
    for tag, vp, lang in [('tablet', {'width': 820, 'height': 1180}, 'he'), ('phone', {'width': 390, 'height': 844}, 'ar')]:
        ctx, pg, errs, meteo = boot(b, vp, lang, True)
        go(pg, [-3.5965, 37.1755], 16); pg.evaluate('GA.view3d.enter()'); time.sleep(4); idle(pg); time.sleep(2)
        r = pg.evaluate('[GA.app.map.transform.elevation, GA.view3d.ground()]'); check(abs(r[0] - r[1]) < 2, f'live {tag}: 3D centre on the ground', r); shot(pg, f'16_{tag}_3d_{lang}')
        pg.evaluate('GA.view3d.exit()'); time.sleep(1); go(pg, [-3.4, 37.4], 4.4); time.sleep(4); shot(pg, f'17_{tag}_wide_{lang}')
        pg.evaluate('GA.app.L.setOn("wind", true)'); pg.wait_for_function('GA.app.L.S.wind.status !== "loading"', timeout=120000); go(pg, [-3.58, 37.19], 11)
        pg.evaluate('GA.panels.set("layers", true)'); time.sleep(2); shot(pg, f'18_{tag}_layers_panel_legend_{lang}')
        check(pg.evaluate('GA.app.L.S.wind.status') == 'ok', f'live {tag}: wind loads'); check(not errs, f'live {tag}: no page errors', errs[:3]); ctx.close()
    b.close()
n = sum(1 for c, _ in res if not c); print(f'\nLIVE RESULT: {len(res) - n}/{len(res)} checks passed' + ('' if not n else ' — FAILED: ' + '; '.join(m for c, m in res if not c)))
