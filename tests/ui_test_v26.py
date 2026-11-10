"""v26 — build 5.28: "City growth (built-up extent 1932–2020)" is a normal map layer (js/layers_growth.js).
  1. the site opens with the layer OFF: nothing drawn (fill and outline hidden, no features rendered), no timer, no old
     atlas overlay ('atl-growth') at all.
  2. it is listed in Layers → History with a checkbox, opacity and legend in ar / he / en; ON from the checkbox draws the
     extents with a legend of all seven periods (each labelled, GHSL vs approximate reconstruction), legend colours = map
     colours = GA.palette.growth.
  3. Play advances the periods; Pause keeps the current period; the period slider / ticks stop on one period; "only this
     period's outline" draws one outline and no fill; opacity applies.
  4. one source of truth: the atlas panel and the sidebar's Historical maps buttons show and drive the same state; "Hide"
     from the atlas panel switches the layer OFF everywhere (checkbox, map, timer).
  5. area / topic switches never bring it back.
  6. the choice survives a reload (ON with its period; OFF stays OFF).
  7. prefers-reduced-motion: no autoplay (a remembered "playing" shows the latest period, still).
  8. print layout / exports: the layer is in the printed style and legend only when ON.
Usage: python3 tests/ui_test_v26.py  (OUT=/dir)"""
import sys, os, time, json, subprocess, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
import _nointro  # start on the map, not the 5.27 opening page
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8826
OUT = os.environ.get('OUT', '/tmp/v26shots'); os.makedirs(OUT, exist_ok=True)
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def stub(pg):
    def route(r):
        u = r.request.url
        if u.startswith(f'http://127.0.0.1:{PORT}/'): return r.continue_()
        if u.rstrip('/').endswith('/planet'): return r.fulfill(json={'tilejson': '3.0.0', 'tiles': ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14})
        if 'fonts.googleapis.com' in u: return r.fulfill(status=200, body='', content_type='text/css')
        return r.fulfill(status=404, body='')
    pg.route('**/*', route)

TITLE = {'ar': 'نمو المدينة (الامتداد المبني 1932–2020)', 'he': 'צמיחת העיר (השטח הבנוי 1932–2020)', 'en': 'City growth (built-up extent 1932–2020)'}
APPROX = {'ar': 'إعادة بناء تقريبية', 'he': 'שחזור משוער', 'en': 'approximate reconstruction'}
VIS = '''() => ['ly-growth-fill', 'ly-growth'].map(id => GA.app.map.getLayer(id) ? GA.app.map.getLayoutProperty(id, 'visibility') : 'missing')'''
DRAWN = '''() => GA.app.map.queryRenderedFeatures({ layers: ['ly-growth-fill', 'ly-growth'].filter(id => GA.app.map.getLayer(id)) }).length'''
FEATS = '''() => (GA.app.map.getSource('ly-growth')._data.features || []).length'''
PERIODS = ['1932', '1956–1957', '1975', '1990', '2000', '2015', '2020']

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(lang='en', motion='no-preference', ctx=None, vp=None):
            ctx = ctx or b.new_context(viewport=vp or {'width': 1440, 'height': 900}, reduced_motion=motion)
            ctx.add_init_script(f"window.__noPanelHook = true; try {{ if (!sessionStorage.getItem('v26lang')) {{ localStorage.setItem('granada-atlas.lang', '{lang}'); sessionStorage.setItem('v26lang', '1'); }} }} catch (e) {{ }}")
            pg = ctx.new_page(); stub(pg); errs = []
            pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append('PAGE ' + str(e)[:300]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready && GA.growth && GA.app.map.getLayer("ly-growth")', timeout=120000); time.sleep(2)
            return ctx, pg, errs
        def open_layers(pg):
            pg.evaluate('GA.panels.set("layers", true)'); time.sleep(0.6)
        def growth_row(pg):
            return pg.evaluate('''() => { const cb = document.querySelector('input[data-ly="city_growth"]'); if (!cb) return null; const row = cb.closest('.lyr'); let g = row.previousElementSibling; while (g && !g.classList.contains('lyr-group')) g = g.previousElementSibling;
              return { checked: cb.checked, title: row.querySelector('.lyr-h span').textContent.trim(), group: g ? g.textContent.trim() : null, opacity: !!row.querySelector('[data-ly-op="city_growth"]'), play: !!row.querySelector('[data-ly-ctl="city_growth"][data-k="play"], [data-ly-ctl="city_growth"][data-k="pause"]'), slider: !!row.querySelector('input[type=range][data-ly-ctl="city_growth"]'), ticks: row.querySelectorAll('.gr-tick').length }; }''')

        # ---------- 1. opens OFF ----------
        ctx, pg, errs = boot('en')
        st = pg.evaluate('GA.growth.state')
        check(not st['on'] and not st['playing'], 'opens with the city growth layer OFF, no timer', st)
        check(pg.evaluate(VIS) == ['none', 'none'] and pg.evaluate(DRAWN) == 0, 'nothing of it is drawn (fill and outline hidden)', pg.evaluate(VIS))
        check(not pg.evaluate('!!GA.app.map.getSource("atl-growth") || !!GA.app.map.getLayer("atl-growth-fill")'), 'the old atlas overlay (atl-growth) no longer exists')
        check(not pg.evaluate('GA.atlas.state.growing'), 'the atlas reports no running animation')
        pg.screenshot(path=f'{OUT}/1_off_start.png')

        # ---------- 2. Layers → History, ON from the checkbox ----------
        open_layers(pg); r = growth_row(pg)
        check(r and r['title'] == TITLE['en'] and not r['checked'], 'listed in Layers as "City growth (built-up extent 1932–2020)", unchecked', r)
        check(r and r['group'] == pg.evaluate('GA.i18n.t("ly.g.hist")'), 'in the History group', r and r['group'])
        pg.click('input[data-ly="city_growth"]'); pg.wait_for_function('GA.growth.state.on && GA.app.map.getSource("ly-growth")._data.features.length > 0', timeout=30000); time.sleep(1.2)
        check(pg.evaluate(VIS) == ['visible', 'visible'] and pg.evaluate(DRAWN) > 0, 'ON from the checkbox draws the extents (fill and outline)', (pg.evaluate(VIS), pg.evaluate(DRAWN)))
        check(not pg.evaluate('GA.growth.state.playing'), 'switching ON does not start an animation by itself')
        r = growth_row(pg); check(r['checked'] and r['opacity'] and r['play'] and r['slider'] and r['ticks'] == 7, 'checkbox, opacity, Play / Pause, period slider and 7 period ticks', r)
        lg = pg.evaluate('''() => { const blk = [...document.querySelectorAll('#legend .lg-blk')].find(e => e.textContent.includes(GA.i18n.t('gr.title'))); if (!blk) return null;
          return { items: [...blk.querySelectorAll('li')].map(li => li.textContent.trim()), cols: [...blk.querySelectorAll('li .sw')].map(s => getComputedStyle(s).backgroundColor) }; }''')
        pal = pg.evaluate('GA.palette.growth.fills.map(h => "rgb(" + GA.palette.rgb(h).join(", ") + ")")')
        check(lg and len(lg['items']) == 7 and all(any(it.startswith(pp) for it in lg['items']) for pp in PERIODS), 'legend: the seven periods, each labelled', lg and lg['items'])
        check(lg and sum('approximate reconstruction' in it for it in lg['items']) == 2 and sum('GHSL' in it for it in lg['items']) == 5, 'legend: 1932 and 1956–57 "approximate reconstruction", 1975–2020 GHSL', lg and lg['items'])
        check(lg and lg['cols'] == pal, 'legend colours = GA.palette.growth (the map paint reads the same array)', (lg and lg['cols'], pal))
        fills = pg.evaluate('[...new Set(GA.app.map.getSource("ly-growth")._data.features.map(f => f.properties.fill))]')
        check(set(fills) <= set(pg.evaluate('GA.palette.growth.fills')), 'map fills come only from GA.palette.growth', fills)
        pg.screenshot(path=f'{OUT}/2_on_2020.png')

        # ---------- 3. Play, Pause, period, outline only, opacity ----------
        pg.click('[data-ly-ctl="city_growth"][data-k="play"]'); time.sleep(0.3)
        i0 = pg.evaluate('GA.growth.state.i'); time.sleep(3.6); i1 = pg.evaluate('GA.growth.state.i')
        check(pg.evaluate('GA.growth.state.playing') and i1 != i0, f'Play advances the periods ({PERIODS[i0]} → {PERIODS[i1]})')
        check(pg.evaluate('document.querySelector(`input[type=range][data-ly-ctl="city_growth"]`).value') == str(i1), 'the period slider follows the animation')
        pg.click('[data-ly-ctl="city_growth"][data-k="pause"]'); ip = pg.evaluate('GA.growth.state.i'); n_p = pg.evaluate(FEATS); time.sleep(3.6)
        check(not pg.evaluate('GA.growth.state.playing') and pg.evaluate('GA.growth.state.i') == ip and pg.evaluate(FEATS) == n_p and pg.evaluate(VIS) == ['visible', 'visible'], f'Pause keeps the current period ({PERIODS[ip]}) on the map')
        pg.click('.gr-tick[value="2"]'); time.sleep(0.8)
        check(pg.evaluate('GA.growth.state.period') == '1975' and pg.evaluate(FEATS) == 3, 'period tick 1975: stops on 1975 (1932, 1956–57, 1975 drawn)', (pg.evaluate('GA.growth.state.period'), pg.evaluate(FEATS)))
        pg.evaluate('''() => { const el = document.querySelector('input[type=range][data-ly-ctl="city_growth"]'); el.value = 4; el.dispatchEvent(new Event('change', { bubbles: true })); }'''); time.sleep(0.8)
        check(pg.evaluate('GA.growth.state.period') == '2000' and pg.evaluate(FEATS) == 5, 'period slider: stops on 2000')
        pg.click('[data-ly-ctl="city_growth"][data-k="only"]'); time.sleep(0.8)
        fa = pg.evaluate('GA.app.map.getSource("ly-growth")._data.features.map(f => [f.properties.fa, f.properties.cur])')
        check(fa == [[0, 1]], 'only this period’s outline: one outline, no fill', fa)
        pg.click('[data-ly-ctl="city_growth"][data-k="only"]'); time.sleep(0.6)
        pg.evaluate('''() => { const el = document.querySelector('[data-ly-op="city_growth"]'); el.value = 0.5; el.dispatchEvent(new Event('input', { bubbles: true })); }'''); time.sleep(0.5)
        op = pg.evaluate('[GA.app.map.getPaintProperty("ly-growth", "line-opacity"), JSON.stringify(GA.app.map.getPaintProperty("ly-growth-fill", "fill-opacity"))]')
        check(op[0] == 0.5 and '0.5' in op[1], 'opacity slider applies to outline and fill', op)
        pg.screenshot(path=f'{OUT}/3_2000.png')

        # ---------- 4. one source of truth ----------
        pg.evaluate('GA.panels.set("layers", false)'); time.sleep(0.4)
        pg.evaluate('GA.growth.play()'); time.sleep(0.6)
        atl = pg.evaluate('[...document.querySelectorAll("#atl-panel .atl-gr-btns [data-gr]")].map(b => b.dataset.gr)')
        check(atl == ['pause', 'off'], 'atlas panel shows Pause and Hide while the layer plays', atl)
        pg.click('#atl-burger'); time.sleep(0.4); pg.click('[data-sec-t="history"]'); time.sleep(0.4)
        side = pg.evaluate('[...document.querySelectorAll("#atl-sec-history [data-gr]")].map(b => b.dataset.gr)')
        check(side == ['pause', 'off'], 'Historical maps section shows the same Pause / Hide', side)
        pg.click('#atl-sec-history [data-gr="pause"]'); time.sleep(0.5)
        check(not pg.evaluate('GA.growth.state.playing') and pg.evaluate('[...document.querySelectorAll("#atl-panel .atl-gr-btns [data-gr]")].map(b => b.dataset.gr)') == ['play', 'off'], 'Pause in the sidebar pauses it in the atlas panel too')
        pg.click('#atl-side-x'); time.sleep(0.4)
        pg.evaluate('GA.growth.play()'); time.sleep(0.4); pg.click('#atl-panel .atl-gr-btns [data-gr="off"]'); time.sleep(0.8); i_off = pg.evaluate('GA.growth.state.i')
        open_layers(pg); r = growth_row(pg); time.sleep(2.5)
        check(not pg.evaluate('GA.growth.state.on') and not r['checked'] and pg.evaluate(VIS) == ['none', 'none'] and pg.evaluate(DRAWN) == 0, 'Hide in the atlas panel: OFF everywhere (checkbox unchecked, fill and outline hidden)', r)
        check(not pg.evaluate('GA.growth.state.playing') and pg.evaluate('GA.growth.state.i') == i_off, 'OFF stops the timer')
        check(not pg.evaluate('[...document.querySelectorAll("#legend .lg-blk")].some(e => e.textContent.includes(GA.i18n.t("gr.title")))'), 'OFF: no legend for it')
        pg.evaluate('GA.panels.set("layers", false)')

        # ---------- 5. area / topic switches ----------
        for js in ['GA.atlas.setTopic("density")', 'GA.atlas.setArea("metro")', 'GA.atlas.setArea("city")', 'GA.atlas.setTopic(null)', 'GA.atlas.setArea("factory")', 'GA.atlas.setArea("city")']:
            pg.evaluate(js); time.sleep(2.5)
        check(not pg.evaluate('GA.growth.state.on') and pg.evaluate(VIS) == ['none', 'none'] and not pg.evaluate('GA.atlas.state.growing'), 'topic and area switches (city / metro / factory, topic on / off) never bring it back')
        pg.screenshot(path=f'{OUT}/5_after_switches.png')

        # ---------- 8. print: only when ON ----------
        pr_off = pg.evaluate('''() => ({ lg: GA.app.L.legendHTML().includes(GA.i18n.t('gr.title')), vis: (GA.app.map.getStyle().layers.find(l => l.id === 'ly-growth-fill').layout || {}).visibility })''')
        check(not pr_off['lg'] and pr_off['vis'] == 'none', 'print / export while OFF: not in the printed style, not in the legend', pr_off)
        pg.evaluate('GA.growth.setOn(true)'); time.sleep(1.5)
        pr_on = pg.evaluate('''() => ({ lg: GA.app.L.legendHTML().includes(GA.i18n.t('gr.title')), vis: (GA.app.map.getStyle().layers.find(l => l.id === 'ly-growth-fill').layout || {}).visibility, src: GA.app.L.byId.city_growth.src() })''')
        check(pr_on['lg'] and pr_on['vis'] == 'visible' and 'GHSL' in pr_on['src'], 'print / export while ON: in the printed style, its legend and its source line', pr_on)
        items = pg.evaluate('GA.printLayout.legendItems().map(x => x.h || x.text || "")')
        check(any(TITLE['en'] in x for x in items) and sum(any(x.startswith(pp) for x in items) for pp in PERIODS) == 7, 'the printed legend lists the layer and its seven periods while ON', items[:10])
        pg.evaluate('GA.growth.setOn(false)'); time.sleep(0.6)
        items = pg.evaluate('GA.printLayout.legendItems().map(x => x.h || x.text || "")')
        check(not any(TITLE['en'] in x for x in items), 'and not while OFF', items[:6]); pg.evaluate('GA.growth.setOn(true)'); time.sleep(1)

        # ---------- 6. survives a reload ----------
        pg.evaluate('GA.growth.setPeriod(3)'); time.sleep(0.5)
        pg.reload(); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready && GA.growth && GA.app.map.getLayer("ly-growth")', timeout=120000)
        pg.wait_for_function('GA.growth.state.on && GA.app.map.getSource("ly-growth")._data.features.length > 0', timeout=30000); time.sleep(1)
        check(pg.evaluate('GA.growth.state.period') == '1990' and pg.evaluate(VIS) == ['visible', 'visible'] and pg.evaluate(FEATS) == 4, 'a visitor who switched it on keeps it on after a reload, on the chosen period (1990)')
        pg.evaluate('GA.growth.setOn(false)'); time.sleep(0.5); pg.reload(); pg.wait_for_function('window.GA && GA.atlas && GA.atlas.state.ready && GA.growth && GA.app.map.getLayer("ly-growth")', timeout=120000); time.sleep(2)
        check(not pg.evaluate('GA.growth.state.on') and pg.evaluate(VIS) == ['none', 'none'], 'OFF stays OFF after a reload')
        check(not errs, 'no page errors (en)', errs[:3]); ctx.close()

        # ---------- 7. reduced motion ----------
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
        ctx.add_init_script('''try { if (!sessionStorage.getItem('v26rm')) { sessionStorage.setItem('v26rm', '1'); localStorage.setItem('granada-atlas.layers.v1', JSON.stringify({ layers: { city_growth: { on: true, opacity: 1, opts: { i: 2, play: true, only: false } } } })); } } catch (e) { }''')
        ctx, pg, errs = boot('en', ctx=ctx); pg.wait_for_function('GA.growth.state.on && GA.app.map.getSource("ly-growth")._data.features.length > 0', timeout=30000)
        i0 = pg.evaluate('GA.growth.state.i'); time.sleep(3.5)
        check(not pg.evaluate('GA.growth.state.playing') and pg.evaluate('GA.growth.state.i') == i0 == 6, 'prefers-reduced-motion: a remembered "playing" layer shows the latest period (2020), still — no autoplay', (i0, pg.evaluate('GA.growth.state')))
        check(not errs, 'no page errors (reduced motion)', errs[:3]); ctx.close()

        # ---------- 2b. ar / he labels ----------
        for lang in ('ar', 'he'):
            ctx, pg, errs = boot(lang); open_layers(pg); r = growth_row(pg)
            check(r and r['title'] == TITLE[lang], f'{lang}: layer title "{TITLE[lang]}"', r and r['title'])
            pg.click('input[data-ly="city_growth"]'); pg.wait_for_function('GA.growth.state.on && GA.app.map.getSource("ly-growth")._data.features.length > 0', timeout=30000); time.sleep(1)
            lg = pg.evaluate('''() => { const blk = [...document.querySelectorAll('#legend .lg-blk')].find(e => e.textContent.includes(GA.i18n.t('gr.title'))); return blk ? [...blk.querySelectorAll('li')].map(li => li.textContent.trim()) : []; }''')
            check(len(lg) == 7 and sum(APPROX[lang] in it for it in lg) == 2 and sum('GHSL' in it for it in lg) == 5, f'{lang}: legend periods and sources translated', lg[:3])
            ctrl = pg.evaluate('document.querySelector("[data-ly-ctl=city_growth][data-k=play]").textContent')
            check(pg.evaluate('GA.i18n.t("gr.play")') in ctrl, f'{lang}: Play control translated', ctrl)
            pg.screenshot(path=f'{OUT}/2_{lang}_on.png')
            check(not errs, f'{lang}: no page errors', errs[:3]); ctx.close()
        b.close()
finally:
    srv.terminate()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED:\n  ' + '\n  '.join(fails))
sys.exit(1 if fails else 0)
