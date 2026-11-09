"""v24 — build 5.26 fixes, one section per item:
  1. no letter-spacing / upper-casing on Arabic or Hebrew text (CSS everywhere + map labels).
  3. phone/tablet/desktop chrome: title kept, north arrow and map controls never overlap (375–1280 px, ar/he/en).
  4. numbers with units / percent / ranges stay left-to-right inside Arabic and Hebrew (atlas, legend, 5.20–5.25 pages).
  2. the map legend follows the atlas topic (topic classes first, other layers folded) and keeps clear of the analysed area.
Usage: python3 tests/ui_test_v24.py  (OUT=/dir)  [items: ITEMS=1,2,... to run a subset]"""
import sys, os, time, json, subprocess, warnings
sys.path.insert(0, os.path.dirname(__file__))
import ui_test_v3 as V3
from playwright.sync_api import sync_playwright
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8824; V3.PORT = PORT; V3.V2.PORT = PORT
OUT = os.environ.get('OUT', '/tmp/v24shots'); os.makedirs(OUT, exist_ok=True)
ITEMS = set((os.environ.get('ITEMS') or '1,2,3,4').split(','))
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)

# every element whose OWN text contains Arabic / Hebrew letters; its computed letter-spacing and text-transform
SPACED = r'''(re) => { const R = new RegExp(re); const bad = [];
  document.querySelectorAll('body *').forEach(e => { if (!e.offsetWidth && !e.offsetHeight) return;
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(); if (!own || !R.test(own)) return;
    const cs = getComputedStyle(e); const ls = cs.letterSpacing;
    if (!(ls === 'normal' || parseFloat(ls) === 0) || cs.textTransform !== 'none') bad.push((e.id || e.className || e.tagName) + ': ' + ls + ' ' + cs.textTransform + ' «' + own.slice(0, 20) + '»'); });
  return bad; }'''
AR, HE = '[؀-ۿ]', '[֐-׿]'

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(vp, mobile=False, lang='en'):
            ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile); ctx.add_init_script('window.__noPanelHook = true; window.__gaLegacyView = false;'); pg = ctx.new_page(); V3.stub3(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready', timeout=120000); time.sleep(1.5)
            pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.6)
            return ctx, pg, errs
        ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']
        # ---------- 1. letter-spacing ----------
        if '1' in ITEMS:
            for lang, RE in [('ar', AR), ('he', HE), ('en', AR)]:
                ctx, pg, errs = boot({'width': 1440, 'height': 900}, False, lang)
                states = [('start', None), ('menu', 'document.querySelector("#atl-burger").click()'), ('topic', 'document.querySelector("#atl-side-x").click(); GA.atlas.setTopic("density")'),
                          ('metro', 'GA.atlas.setArea("metro")'), ('panels', 'GA.panels.set("analysis", true); GA.panels.set("study", true)'),
                          ('ex13', 'GA.panels.set("analysis", false); GA.panels.set("study", false); GA.pages.go("ex13")'), ('history', 'GA.pages.go("history")'), ('south', 'GA.pages.go("south")')]
                for name, js in states:
                    if js: pg.evaluate(js); time.sleep(2.5 if name in ('ex13', 'history', 'south', 'topic', 'metro') else 0.6)
                    bad = pg.evaluate(SPACED, RE)
                    check(not bad, f'{lang} {name}: no letter-spacing / upper-casing on {"Arabic" if RE == AR else "Hebrew"} text', bad[:4])
                if lang != 'en':
                    pg.evaluate('GA.pages.close()'); time.sleep(0.5)
                    ls = pg.evaluate('["label-sea", "label-country"].map(id => GA.app.map.getLayoutProperty(id, "text-letter-spacing"))')
                    check(all(v == 0 for v in ls), f'{lang}: map sea / country names without tracking {ls}')
                    if lang == 'ar': pg.screenshot(path=f'{OUT}/i1_ar_panel.png')
                check(not errs, f'{lang}: no page errors', errs[:3]); ctx.close()
        # ---------- 2. map legend follows the topic ----------
        if '2' in ITEMS:
            LEG = r'''() => { const L = document.querySelector('#legend'); const r = L.getBoundingClientRect(); const av = GA.atlas.legendAvoid();
              const h4 = L.querySelector('.legend-b > h4'); const cols = [...L.querySelectorAll('.legend-b > ul.lg li i.sw')].map(i => getComputedStyle(i).backgroundColor);
              const also = L.querySelector('.lg-also'); const ov = av ? Math.max(0, Math.min(r.right, av.right) - Math.max(r.left, av.left)) * Math.max(0, Math.min(r.bottom, av.bottom) - Math.max(r.top, av.top)) : 0;
              const south = [...L.querySelectorAll('.legend-b > h4')].some(e => /Esc|tram|1931/i.test(e.textContent));
              const mid = document.elementFromPoint((r.left + r.right) / 2, r.top + 12); const onTop = !!(mid && mid.closest('#legend'));
              return { onTop, first: h4 ? h4.textContent.trim() : '', cols, also: !!also, alsoOpen: also ? also.open : null, min: L.classList.contains('min'), ov, area: r.width * r.height, south, vis: !L.hidden && r.width > 0 }; }'''
            rgb = lambda h: 'rgb(%d, %d, %d)' % tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
            for tag, vp, mob, lang in [('desktop', {'width': 1440, 'height': 900}, False, 'en'), ('desktop', {'width': 1280, 'height': 800}, False, 'ar'), ('tablet', {'width': 820, 'height': 1180}, True, 'he'), ('phone', {'width': 390, 'height': 844}, True, 'ar')]:
                ctx, pg, errs = boot(vp, mob, lang)
                pg.evaluate('GA.atlas.setTopic("density")'); time.sleep(5)
                r = pg.evaluate(LEG); name = pg.evaluate('GA.i18n.t("e13.t.density")'); pal = [rgb(c) for c in pg.evaluate('GA.palette.ex13.density')]
                check(r['vis'] and name in r['first'] and r['cols'][:6] == pal, f'{tag} {lang}: map legend starts with the topic ({r["first"]}) in the palette classes', (r['first'], r['cols'][:6]))
                check(r['also'] and r['alsoOpen'] is False and not r['south'], f'{tag} {lang}: other layers (Escúzar, 1931 tram, …) folded under "also on the map"', r)
                check(r['min'] or r['ov'] == 0, f'{tag} {lang}: the legend does not cover the analysis frame (overlap {r["ov"]:.0f} px², collapsed={r["min"]})', r)
                check(r['onTop'], f'{tag} {lang}: the legend is not hidden behind a panel', r)
                if tag == 'phone': check(r['min'], 'phone: legend starts as its button')
                pg.screenshot(path=f'{OUT}/i2_{tag}_{lang}_city.png')
                pg.evaluate('GA.atlas.setArea("metro")'); time.sleep(3.5); r = pg.evaluate(LEG)
                check(name in r['first'] and (r['min'] or r['ov'] == 0), f'{tag} {lang}: metro corridor — topic legend, clear of the corridor (overlap {r["ov"]:.0f})', r)
                pg.screenshot(path=f'{OUT}/i2_{tag}_{lang}_metro.png')
                pg.evaluate('GA.atlas.setTopic(null)'); time.sleep(1.5); r = pg.evaluate(LEG)
                check(not r['also'] and not (name in r['first']), f'{tag} {lang}: no topic → the ordinary layer legend again', r)
                check(not errs, f'{tag} {lang}: no page errors', errs[:3]); ctx.close()
        # ---------- 3. title and control stack at every width ----------
        if '3' in ITEMS:
            CH = r'''() => { const R = (e) => { if (!e || !(e.offsetWidth || e.offsetHeight) || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
              const ov = (a, b) => a && b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;
              const name = document.querySelector('.brand-name'); const nr = R(name); const north = R(document.querySelector('.north'));
              const ctls = [...document.querySelectorAll('.maplibregl-ctrl-top-right .maplibregl-ctrl, .maplibregl-ctrl-top-right button')].map(R).filter(Boolean);
              const top = [...document.querySelectorAll('.topbar > *')].map(R).filter(Boolean); let topOv = 0; for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) if (ov(top[i], top[j])) topOv++;
              return { title: nr ? name.textContent.trim() : '', titleW: nr ? nr.r - nr.l : 0, clipped: name ? name.scrollWidth > name.clientWidth + 1 : true,
                northHit: north ? ctls.filter(c => ov(c, north)).length : 0, north: !!north, topOv, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; }'''
            for w in [375, 390, 768, 1024, 1280]:
                for lang in ['ar', 'he', 'en']:
                    mob = w < 1000; ctx, pg, errs = boot({'width': w, 'height': 844 if w < 700 else 1000 if mob else 800}, mob, lang)
                    for st in ['start', 'topic']:
                        if st == 'topic': pg.evaluate('GA.atlas.setTopic("climate")'); time.sleep(4)
                        r = pg.evaluate(CH)
                        check(r['title'] and r['titleW'] > 40 and not r['clipped'], f'{w}px {lang} {st}: site title shown in full ("{r["title"]}")', r)
                        check(r['northHit'] == 0 and r['topOv'] == 0 and not r['overflow'], f'{w}px {lang} {st}: north arrow clear of the map controls, top bar without overlaps, no horizontal scroll', r)
                    if w in (375, 768) and lang == 'ar': pg.screenshot(path=f'{OUT}/i3_{w}_{lang}.png')
                    check(not errs, f'{w}px {lang}: no page errors', errs[:3]); ctx.close()
        # ---------- 4. numbers + units stay LTR in RTL ----------
        if '4' in ITEMS:
            BIDI = r'''(sel) => { const R = /(\d[\d.,]*\s?(%|°C|km²|km|m²|ha)(?![A-Za-z]))|([≥≤<>]\s?\d)|(\d[\d.,]*\s?[–-]\s?\d)/; const bad = []; let n = 0;
              document.querySelectorAll(sel).forEach(root => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const t = w.currentNode; const e = t.parentElement;
                if (!e || !(e.offsetWidth || e.offsetHeight) || e.closest('script, style, canvas, svg')) continue; if (!R.test(t.textContent)) continue; n++;
                if (!e.closest('[dir="ltr"]')) bad.push(t.textContent.trim().slice(0, 40)); } }); return { n, bad }; }'''
            for lang in ['ar', 'he']:
                ctx, pg, errs = boot({'width': 1440, 'height': 900}, False, lang)
                for name, js, sel in [('city start', None, '#atl-panel'), ('density', 'GA.atlas.setTopic("density")', '#atl-panel, #legend'), ('climate', 'GA.atlas.setTopic("climate")', '#atl-panel, #legend'),
                                      ('metro human', 'GA.atlas.setArea("metro"); GA.atlas.setTopic("human")', '#atl-panel, #legend'), ('metro density', 'GA.atlas.setTopic("density")', '#atl-panel, #legend'),
                                      ('factory', 'GA.atlas.setArea("factory")', '#atl-panel, #legend'), ('also on the map', 'document.querySelector("#legend .lg-also") && (document.querySelector("#legend .lg-also").open = true)', '#legend'),
                                      ('south page', 'GA.pages.go("south")', '#page'), ('ex13 page', 'GA.pages.go("ex13")', '#page')]:
                    if js: pg.evaluate(js); time.sleep(5 if 'page' in name or name in ('density', 'climate', 'metro human') else 3)
                    r = pg.evaluate(BIDI, sel)
                    check((r['n'] > 0 or name == 'south page') and not r['bad'], f'{lang} {name}: {r["n"]} numbers with units in LTR isolation' + (' (the page text has none; its boards are images)' if name == 'south page' and not r['n'] else ''), r['bad'][:5])
                    if name == 'metro density': pg.screenshot(path=f'{OUT}/i4_{lang}_metro.png')
                check(not errs, f'{lang}: no page errors', errs[:3]); ctx.close()
finally:
    srv.terminate()
print('\n' + ('ALL PASSED' if not fails else f'{len(fails)} FAILED:\n  ' + '\n  '.join(fails)))
sys.exit(1 if fails else 0)
