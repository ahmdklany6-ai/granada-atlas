"""Live verification of build 5.33 (train pictograms; tour: towns as built-up areas, streets slides A/B, labelled step-3 maps, four slides in step 3, framing), 5.25 (Atlas shell), 5.27 (opening page + story tour) 5.28 (city growth as a layer, OFF by default) and 5.29 (map screen: no zoom buttons, Draw section + 3D top-right, north arrow beside the scale bar, language buttons and the five analyses in the top bar) on the PUBLIC site from a GitHub runner. Fresh browser — no visitor data
touched. Checks: the build is served; ☰ sidebar with seven sections and the old navigation inside; city start with the
growth animation and both markers; density topic → class layers + legend; metro area keeps the topic and computes
corridor indicators; factory → "No data for this area"; Back to Granada; ar / he sidebar side; phone bottom sheet.
5.27: the plain URL opens on the opening page (ar / en); the red button runs the tour: step 1 base (371 ha), step 2 five
towns (91,476 residents) and fence classes, step 3 agglomeration (+15.3 % / −0.8 %), rent layer with IPVA + missing €/m²;
the last Enter returns to the map with the tour layers removed. The older checks run with window.__noIntro (test opt-out).
Screenshots are printed as base64 JPEG between ===IMG name=== / ===END=== (job log only)."""
import base64, io, json, os, time, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image
SITE = os.environ.get('SITE') or 'https://ahmdklany6-ai.github.io/granada-atlas/'
EXPECT = os.environ.get('EXPECT_BUILD') or json.load(open('version.json'))['build']
if os.environ.get('PART', 'a') != 'a': raise SystemExit(0)
res = []
def check(cond, msg, extra=''):
    res.append((bool(cond), msg)); print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
def emit(name, png, maxw=1300):
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
    b = p.chromium.launch()
    def boot(vp, mobile=False, intro=False, lang=None):
        ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile)
        if not intro: ctx.add_init_script('window.__noIntro = true;')  # 5.27: the atlas checks start on the map
        if lang: ctx.add_init_script(f"try {{ localStorage.setItem('granada-atlas.lang', '{lang}'); }} catch (e) {{ }}")
        pg = ctx.new_page(); pg.set_default_timeout(120000); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto(SITE + '?v=' + EXPECT, wait_until='load', timeout=180000); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready', timeout=300000); time.sleep(3)
        return ctx, pg, errs
    # ---- 5.27 opening page and story tour ----
    for lang, title in (('ar', 'غرناطة'), ('en', 'Granada')):
        ctx, pg, errs = boot({'width': 1440, 'height': 900}, intro=True, lang=lang)
        it = pg.evaluate('({ vis: !document.querySelector("#tour-intro").hidden, t: document.querySelector(".tour-title").textContent.trim(), n: document.querySelector(".tour-names").textContent.trim(), btn: document.querySelectorAll("#tour-start, #tour-open").length })')
        check(it['vis'] and it['t'] == title and it['btn'] == 2, f'{lang}: the plain URL opens on the opening page ({it["t"]} · {it["n"]})', it); emit(f'{lang}_intro', pg.screenshot())
        if lang == 'en':
            wait = lambda js: pg.wait_for_function(js, timeout=120000)
            pg.click('#tour-start'); wait('GA.tour.state.built && GA.tour.state.step === 1'); time.sleep(3.5)
            card = pg.evaluate('document.querySelector("#tour-card").innerText'); check('371 ha' in card and 'Ala 78' in card, 'tour step 1: the air base, 371 ha (measured), Ala 78', card[:120]); emit('tour_1', pg.screenshot())
            pg.keyboard.press('Enter'); wait('GA.tour.state.step === 2'); time.sleep(3.5)
            card = pg.evaluate('document.querySelector("#tour-card").innerText'); check('91,476' in card, 'tour step 2: five towns, 91,476 residents', card[:160]); emit('tour_2_1', pg.screenshot())
            pg.keyboard.press(' '); time.sleep(1.5); card = pg.evaluate('document.querySelector("#tour-card").innerText'); check('42 %' in card, 'tour step 2 layer 2: fence 42 % housing', card[:200]); emit('tour_2_2', pg.screenshot())
            pg.keyboard.press(' '); time.sleep(1.5); emit('tour_2_3', pg.screenshot())
            pg.keyboard.press('Enter'); wait('GA.tour.state.step === 3'); time.sleep(3.5)
            card = pg.evaluate('document.querySelector("#tour-card").innerText'); check('+15.3 %' in card and '−0.8 %' in card, 'tour step 3: five towns +15.3 % vs Granada city −0.8 %', card[:200]); emit('tour_3_1', pg.screenshot())
            pg.keyboard.press(' '); pg.keyboard.press(' '); time.sleep(1.5); card = pg.evaluate('document.querySelector("#tour-card").innerText')
            check('IPVA' in card and 'Missing' in card, 'tour step 3 rents: INE IPVA index, €/m² shown as missing', card[:200]); emit('tour_3_3', pg.screenshot())
            pg.keyboard.press('Enter'); time.sleep(1.5)
            check(not pg.evaluate('GA.tour.state.on') and pg.evaluate('GA.app.map.getStyle().layers.filter(l => l.id.startsWith("tour-")).length') == 0, 'the last Enter returns to the map, tour layers removed')
        check(not errs, f'{lang}: no page errors (opening page / tour)', errs[:2]); ctx.close()

    LAYOUT = r"""() => { const R = (s) => { const e = document.querySelector(s); if (!e || !e.offsetWidth) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
      const st = R('.stage'), s = R('#map-draw-section'), d = R('.ga-3dctl'), n = R('.ga-north'), sc = R('.maplibregl-ctrl-scale');
      return { zoom: document.querySelectorAll('.maplibregl-ctrl-zoom-in').length, row: !!(s && d && Math.abs(s[1] - d[1]) < 4 && st[2] - Math.max(s[2], d[2]) <= 16 && Math.min(s[1], d[1]) - st[1] <= 16),
        north: !!(n && sc && (Math.abs(n[2] - sc[0]) <= 12 || Math.abs(sc[2] - n[0]) <= 12) && Math.min(n[0], sc[0]) - st[0] <= 20),
        langs: [...document.querySelectorAll('#tb-lang button')].map(b => b.textContent.trim()), topics: document.querySelectorAll('#atl-topics button').length }; }"""
    def layout_check(pg, tag):
        L = pg.evaluate(LAYOUT)
        check(L['zoom'] == 0 and L['row'] and L['north'], f'{tag}: no zoom buttons; Draw section + 3D top-right; north arrow beside the scale bar (5.29)', L)
        check(L['langs'] == ['عربي', 'עברית', 'English'] and L['topics'] == 6, f'{tag}: language buttons and the five analyses (+ no topic) in the top bar (5.29)', L)
    ctx, pg, errs = boot({'width': 1440, 'height': 900})
    check(pg.evaluate('window.GA_BUILD') == EXPECT, f'page runs build {EXPECT}')
    layout_check(pg, 'en 1440 px')
    c0 = pg.evaluate('[GA.app.map.getCenter().toArray(), GA.app.map.getZoom()]'); pg.click('#tb-lang [data-lang="he"]'); time.sleep(1.5)
    c1 = pg.evaluate('[GA.app.map.getCenter().toArray(), GA.app.map.getZoom()]'); check(pg.evaluate('document.documentElement.lang') == 'he' and c0 == c1, 'top-bar language button switches the language and keeps the map view (5.29)', (c0, c1))
    pg.click('#tb-lang [data-lang="en"]'); time.sleep(1.2)
    pg.evaluate('GA.i18n.setLang("en")'); time.sleep(1)
    check(pg.evaluate('document.body.classList.contains("atlas") && !!document.querySelector("#atl-side #tb-nav") && !!document.querySelector("#atl-side #panel-layers")'), 'atlas shell: ☰, navigation and Layers inside the sidebar')
    st = pg.evaluate('GA.atlas.state'); gv = pg.evaluate('["ly-growth-fill", "ly-growth"].map(id => GA.app.map.getLayer(id) ? GA.app.map.getLayoutProperty(id, "visibility") : "none")')
    check(st['area'] == 'city' and not st['growing'] and not pg.evaluate('GA.growth.state.on') and gv == ['none', 'none'], 'starts on the whole city, clean: city growth layer OFF, nothing drawn (5.28)', (st, gv))
    check(pg.evaluate('!!document.querySelector(".atl-mk-factory") && !!document.querySelector(".atl-mk-metro")'), 'factory and metro markers')
    emit('en_start', pg.screenshot())
    # 5.28: the city growth layer from the Layers list: ON draws it with its legend, Pause keeps the period, OFF removes it
    pg.evaluate('GA.panels.set("layers", true)'); time.sleep(0.8); pg.click('input[data-ly="city_growth"]')
    pg.wait_for_function('GA.growth.state.on && GA.app.map.getSource("ly-growth")._data.features.length > 0', timeout=60000); time.sleep(1.5)
    lg = pg.evaluate('[...document.querySelectorAll("#legend .lg-blk")].some(e => e.textContent.includes(GA.i18n.t("gr.title")) && e.querySelectorAll("li").length === 7)')
    check(pg.evaluate(f'GA.app.map.getLayoutProperty("ly-growth-fill", "visibility")') == 'visible' and lg, 'city growth layer ON from the Layers list: extents drawn, legend with 7 periods')
    pg.evaluate('GA.panels.set("layers", false)'); time.sleep(0.5); pg.evaluate('GA.growth.play()'); time.sleep(2); pg.evaluate('GA.growth.pause()'); i = pg.evaluate('GA.growth.state.i'); time.sleep(3)
    check(pg.evaluate('GA.growth.state.i') == i and not pg.evaluate('GA.growth.state.playing'), f'Pause keeps the period ({pg.evaluate("GA.growth.state.period")})')
    pg.evaluate('GA.growth.setPeriod(6)'); time.sleep(1); emit('en_growth_on', pg.screenshot())
    pg.click('#atl-panel .atl-gr-btns [data-gr="off"]'); time.sleep(1)
    check(pg.evaluate('["ly-growth-fill", "ly-growth"].map(id => GA.app.map.getLayoutProperty(id, "visibility"))') == ['none', 'none'] and not pg.evaluate('GA.growth.state.on'), 'Hide from the atlas panel: layer OFF, nothing drawn')
    pg.evaluate('GA.atlas.setTopic("density")'); time.sleep(3); pg.evaluate('GA.atlas.setTopic(null)'); time.sleep(2)
    check(not pg.evaluate('GA.growth.state.on'), 'a topic switch does not bring it back')
    pg.click('#atl-burger'); time.sleep(0.6); n = pg.evaluate('document.querySelectorAll("#atl-side [data-sec-t]").length'); check(n == 7, f'sidebar sections: {n}')
    pg.click('[data-sec-t="research"]'); time.sleep(0.4); emit('en_menu', pg.screenshot()); pg.click('#atl-side-x'); time.sleep(0.4)
    pg.evaluate('GA.atlas.setTopic("density")'); time.sleep(7)
    vis = pg.evaluate('GA.atlas.topicLayers("density").filter(id => GA.app.map.getLayoutProperty(id, "visibility") === "visible").length'); check(vis == 6, f'density: {vis}/6 class layers')
    check(pg.evaluate('document.querySelectorAll("#atl-panel .atl-lg li").length') >= 7, 'legend in the panel'); emit('en_city_density', pg.screenshot())
    pg.evaluate('document.querySelector(".atl-mk-metro").click()'); time.sleep(4)
    st = pg.evaluate('GA.atlas.state'); ind = pg.evaluate('GA.atlas.indicators("density")')
    check(st['area'] == 'metro' and st['topic'] == 'density' and ind and ind[0][1][0].isdigit(), f'metro corridor keeps the topic; residents {ind[0][1] if ind else None}', st)
    pg.evaluate('GA.atlas.setTopic("climate")'); time.sleep(7); emit('en_metro_climate', pg.screenshot())
    pg.evaluate('document.querySelector(".atl-mk-factory").click()'); time.sleep(4)
    txt = pg.evaluate('document.querySelector("#atl-panel").innerText'); ind = pg.evaluate('GA.atlas.indicators("climate")')
    check('No data for this area' not in txt and ind and '°C' in ind[0][1], f'factory (5.26): its own analysis frame with real values {ind[:2]}'); emit('en_factory', pg.screenshot())
    lg = pg.evaluate('(() => { const h = document.querySelector("#legend .legend-b > h4"); return h ? h.textContent : ""; })()'); check('Climate' in lg, f'map legend leads with the topic ({lg})')
    pg.evaluate('GA.atlas.setArea("metro")'); time.sleep(3)
    st = pg.evaluate('(() => { const d = document.querySelector("#atl-panel .atl-st"); return d ? d.textContent : ""; })()'); check('Arabuleila' in st and 'Los Chopos' in st, 'metro: the seven planned stations named, not placed')
    pg.click('#atl-back'); time.sleep(3); check(pg.evaluate('GA.atlas.state.area') == 'city', 'Back to Granada')
    pg.evaluate('GA.atlas.setTopic("centre")'); time.sleep(7); emit('en_city_centre', pg.screenshot())
    check(not [e for e in errs if 'rtl-text' not in e], 'no page errors', errs[:3]); ctx.close()
    for lang, vp, mob in [('ar', {'width': 1440, 'height': 900}, False), ('he', {'width': 390, 'height': 844}, True)]:
        ctx, pg, errs = boot(vp, mob); pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(1)
        layout_check(pg, f'{lang} {vp["width"]} px'); emit(f'{lang}_start', pg.screenshot())
        sp = pg.evaluate('[...document.querySelectorAll("body *")].filter(e => (e.offsetWidth || e.offsetHeight) && [...e.childNodes].some(n => n.nodeType === 3 && /[\\u0590-\\u06FF]/.test(n.textContent))).filter(e => { const c = getComputedStyle(e); return !(c.letterSpacing === "normal" || parseFloat(c.letterSpacing) === 0) || c.textTransform !== "none"; }).length')
        check(sp == 0, f'{lang}: no letter-spacing on Arabic / Hebrew text ({sp} elements)')
        pg.click('#atl-burger'); time.sleep(0.6); sb = pg.evaluate('(() => { const r = document.querySelector("#atl-side").getBoundingClientRect(); return [r.right, innerWidth]; })()')
        check(sb[0] >= sb[1] - 2, f'{lang}: sidebar opens on the right', sb); emit(f'{lang}_menu', pg.screenshot()); pg.click('#atl-side-x'); time.sleep(0.4)
        pg.evaluate('GA.atlas.setArea("metro")'); time.sleep(3); pg.evaluate('GA.atlas.setTopic("human")'); time.sleep(7)
        if mob:
            r = pg.evaluate('(() => { const r = document.querySelector("#atl-panel").getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; })()'); check(r[1] >= r[2] - 2, 'phone: bottom sheet', r)
        check(pg.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'{lang}: no horizontal overflow'); emit(f'{lang}_metro_human', pg.screenshot())
        check(not [e for e in errs if 'rtl-text' not in e], f'{lang}: no page errors', errs[:3]); ctx.close()
    # ---- 5.33: train pictograms, towns as built-up areas, the streets slides, labelled step-3 maps, 4 slides, framing ----
    ctx, pg, errs = boot({'width': 1440, 'height': 900}, lang='en')
    pg.evaluate('GA.app.map.jumpTo({ center: [-3.6315, 37.1435], zoom: 15.2 })'); time.sleep(9)
    n = pg.evaluate('GA.app.map.queryRenderedFeatures({ layers: ["ly-smetro-icon", "ly-tram-icon"].filter(l => GA.app.map.getLayer(l)) }).length')
    check(n == 2, f'5.33: tram and metro pictograms on the map near Armilla ({n})'); emit('x33_icons_armilla', pg.screenshot(clip={'x': 300, 'y': 120, 'width': 900, 'height': 640}))
    ctx.close()
    for lang in ('en', 'ar'):
        ctx, pg, errs = boot({'width': 1440 if lang == 'en' else 1280, 'height': 900 if lang == 'en' else 800}, intro=True, lang=lang)
        def slide(st, ly, name, extra=None):
            pg.evaluate(f'location.hash = "#/tour/{st}/{ly}"' if st > 1 else 'location.hash = "#/tour/1"'); pg.wait_for_function(f'GA.tour.state.built && GA.tour.state.step === {st} && GA.tour.state.layer === {ly}', timeout=120000); time.sleep(6)
            if extra: extra()
            emit(f'x33_{name}_{lang}', pg.screenshot())
        slide(1, 1, 'slide1')
        slide(2, 1, 'towns', lambda: check(len(pg.evaluate('GA.tour.labels')) == 5, f'{lang}: step 2 — five town names on the built-up areas'))
        for ly, nm in ((3, 'streetsA'), (4, 'streetsB'), (5, 'streetsAB')):
            if lang == 'en' or ly == 5: slide(2, ly, nm, (lambda: check(sum(int(x) for x in pg.evaluate('[...document.querySelectorAll(".tour-sign")].map(e => e.dataset.n)')) == 13, f'{lang}: 13 dead-end signs')) if ly == 5 else None)
        for ly, nm in ((1, 'chg'), (2, 'inc'), (3, 'rent')):
            if lang == 'en' or ly == 1: slide(3, ly, nm, lambda: check(len(pg.evaluate('GA.tour.labels')) == 34 and not [x for x in pg.evaluate('GA.tour.labels') if x['forced']], f'{lang}: 34 municipality labels, none forced'))
        slide(3, 4, 'last', lambda: check(pg.evaluate('document.querySelectorAll(".tour-dots i").length') == 4, f'{lang}: step 3 has four slides'))
        check(not [e for e in errs if 'rtl-text' not in e], f'{lang}: no page errors (5.33 tour)', errs[:3]); ctx.close()
    b.close()
n = sum(1 for c, _ in res if not c); print(f'\nLIVE RESULT atlas: {len(res) - n}/{len(res)} checks passed' + ('' if not n else ' — FAILED: ' + '; '.join(m for c, m in res if not c)), flush=True)
