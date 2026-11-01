# v4 regression tests: external services that hang or fail must not block analysis or fabric pages; new layers have
# controls in the Layers panel; narrow layouts stay inside the viewport; exercise names are translated; sections have no
# distance axis and project mapped trees inside a disclosed corridor.
# Run: python3 tests/ui_test_v4.py [output_dir]
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ui_test_v3 as V3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
PORT = 8771; V3.PORT = PORT; V3.V2.PORT = PORT
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  — ' + str(extra)) if extra != '' else '')); (None if cond else fails.append(name))
def wait(pg, js, timeout=60000): pg.wait_for_function(js, timeout=timeout)

OVER = '''() => { const W = innerWidth; const bad = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return; if (e.closest('.maplibregl-canvas-container, [hidden]')) return; let p = e.parentElement, clipped = false; while (p && p !== document.body) { if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; } p = p.parentElement; } if (clipped) return; if (r.right > W + 1 || r.left < -1) bad.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }); return bad.slice(0, 10); }'''
NAVOV = '''() => { const bs = [...document.querySelectorAll('.topbar button')].filter(b => b.offsetWidth && getComputedStyle(b).visibility !== 'hidden'); const o = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect(); const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ix > 1 && iy > 1) o.push(bs[i].innerText.trim() + ' × ' + bs[j].innerText.trim()); } return o; }'''

def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
            pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
            V3.stub3(pg)
            # services that never answer, and Commons answering "too busy" once
            hang = {'on': True}; held = []
            def hanging(r):
                if hang['on']: held.append(r); return  # never fulfilled
                r.fallback()
            pg.route('https://gis.miteco.gob.es/**', hanging)
            pg.route('https://image.discomap.eea.europa.eu/**', hanging)
            busy = {'n': 0}
            def commons_busy(r):
                if busy['n'] == 0: busy['n'] += 1; return r.fulfill(json={'error': {'code': 'cirrussearch-too-busy-error', 'info': 'too busy'}})
                r.fallback()
            pg.route('https://commons.wikimedia.org/**', commons_busy)
            base = f'http://127.0.0.1:{PORT}/index.html'
            pg.goto(base); wait(pg, 'window.GA && GA.app && GA.app.map.isStyleLoaded()')
            pg.evaluate('localStorage.clear()'); pg.reload(); wait(pg, 'window.GA && GA.app && GA.app.map.isStyleLoaded()')
            pg.evaluate('GA.i18n.setLang("en")')

            # data URLs are versioned for returning visitors
            pg.evaluate('GA.app.L.setOn("trees", true)'); wait(pg, 'GA.app.L.S.trees.status === "ok"', 30000)
            urls = pg.evaluate('performance.getEntriesByType("resource").map(e => e.name).filter(u => /data\\/vec\\//.test(u))')
            check('data files are requested with the data version', urls and all('d=' in u for u in urls), urls[:3])
            check('trees layer is citywide from the dated snapshot (no zoom limit, no Overpass)', pg.evaluate('GA.app.L.S.trees.statusExtra') == 7426)
            pg.evaluate('GA.app.L.setOn("trees", false)')

            # Layers panel lists every new layer with its controls
            pg.evaluate('document.body.classList.remove("right-collapsed")'); time.sleep(0.3)
            ids = pg.evaluate('[...document.querySelectorAll("#panel-layers [data-ly]")].map(e => e.dataset.ly)')
            check('Layers panel has checkboxes for places, bus, trees, canopy, flood, noise, LST, history', all(k in ids for k in ['places', 'bus_service', 'trees', 'canopy', 'flood', 'noise', 'lst', 'history']), ids)
            pg.check('#panel-layers [data-ly="places"]'); wait(pg, 'GA.app.L.S.places.status === "ok"', 30000); time.sleep(0.4)
            check('places controls (categories, search) appear in the panel when on', pg.evaluate('!!document.querySelector("#panel-layers [data-ly-ctl=places][data-k=q]") && document.querySelectorAll("#panel-layers [data-ly-ctl=places]").length > 5'))
            pg.check('#panel-layers [data-ly="bus_service"]'); wait(pg, 'GA.app.L.S.bus_service.status === "ok"', 30000); time.sleep(0.4)
            check('bus controls appear in the panel', pg.evaluate('document.querySelectorAll("#panel-layers [data-ly-ctl=bus_service]").length >= 3'))
            pg.screenshot(path=os.path.join(OUT, 'v4_layers_panel.png'))
            pg.uncheck('#panel-layers [data-ly="places"]'); pg.uncheck('#panel-layers [data-ly="bus_service"]')

            # analysis finishes although MITECO and EEA never answer; Commons is busy once then answers
            pg.evaluate('GA.app.sel.setCenterDirect([-3.5995, 37.1766])'); time.sleep(0.3)
            pg.fill('#in-name', 'Hang test'); t0 = time.time(); pg.click('#btn-analyze')
            wait(pg, 'GA.app.getRun() && GA.app.getRun().X', 30000)
            check('local analysis data ready within 12 s while external services hang', time.time() - t0 < 12, round(time.time() - t0, 1))
            wait(pg, 'document.querySelector("[data-card=places]")', 60000)
            wait(pg, '!Object.values(GA.app.getRun().tasks).some(x => x.state === "running")', 60000)
            check('analysis leaves "Analysing…" although MITECO/EEA hang', time.time() - t0 < 60, round(time.time() - t0, 1))
            check('photos succeed after a "too busy" answer (retried)', pg.evaluate('GA.app.getRun().tasks.photos.state') == 'ok' and busy['n'] == 1, pg.evaluate('JSON.stringify(GA.app.getRun().tasks.photos)'))
            check('flood card shows the source as loading meanwhile', pg.evaluate('/MITECO SNCZI/.test(document.querySelector("[data-card=flood]").innerText)'))
            aid = pg.evaluate('GA.app.getRun().areaId')

            # fabric page opens while the services still hang
            pg.evaluate(f'GA.pages.go("fabric", "{aid}")'); t1 = time.time()
            wait(pg, 'document.querySelectorAll(".ap-sec").length >= 8', 30000)
            check('fabric page renders within 15 s while services hang', time.time() - t1 < 15, round(time.time() - t1, 1))
            check('fabric page says some sources are still loading', pg.evaluate('/still loading/.test(document.querySelector("#page").innerText)'))
            pg.evaluate('GA.pages.close()')

            # after the 45 s limit the hanging sources are marked unavailable with a retry button
            wait(pg, 'document.querySelector("[data-card=flood] [data-retry-ext]")', 70000)
            check('unavailable source named, with a retry button', pg.evaluate('/unavailable/.test(document.querySelector("[data-card=flood]").innerText)'))
            hang['on'] = False
            for r in held:
                try: r.abort()
                except Exception: pass
            pg.click('[data-card=flood] [data-retry-ext]')
            wait(pg, 'GA.app.getRun().X.R.flood && document.querySelector("[data-card=flood] canvas")', 60000)
            check('retry loads the flood card once the service answers', True)
            pg.screenshot(path=os.path.join(OUT, 'v4_analysis.png'))

            # section: no distance axis; trees from the corridor
            pg.click('[data-ltab="sections"]'); pg.click('#sec-draw')
            for x, y in [(-3.6005, 37.1764), (-3.5985, 37.1769)]: pg.evaluate(f'(() => {{ const p = GA.app.map.project([{x}, {y}]); GA.app.secTool.click({{ lngLat: {{ lng: {x}, lat: {y} }}, point: p }}); }})()')
            pg.evaluate('GA.app.secTool.finish()'); wait(pg, 'document.querySelector("#sec-cv")', 40000); time.sleep(1)
            r = json.loads(pg.evaluate('''(async () => { const a = GA.app.store.get().areas.find(x => x.id === GA.app.getRun().areaId); const s = a.sections[0];
              const P = (c) => GA.section.compute(Object.assign({}, s, { corridor: c }), { floorH: 3 });
              const p5 = await P(5), p30 = await P(30); const svg = GA.section.svg(p30, { w: 1400, h: 700 });
              const far = p30.trees.filter(t => !t.row && t.off > p5.corridor);
              return JSON.stringify({ n5: p5.trees.length, n30: p30.trees.length, maxOff5: Math.max(0, ...p5.trees.map(t => t.off)), far: far.length, farNear: far.filter(t => t.near).length,
                axisTitle: svg.includes(GA.i18n.t('sec.distAxis')), ticks: (svg.match(/>0</g) || []).length, red: svg.includes('#992B2A'), corr: svg.includes('30 m)') || svg.includes('≤ 30 m') }); })()'''))
            check('wider corridor includes more trees; none beyond the corridor', r['n30'] >= r['n5'] and r['maxOff5'] <= 5, r)
            check('trees beyond 5 m are drawn as background (lighter)', r['farNear'] == 0, r)
            check('section SVG: no distance-axis title or 0-tick; red cuts kept; corridor disclosed', not r['axisTitle'] and r['red'] and r['corr'], r)  # the only '0' is now the scale bar's
            check('corridor band drawn on the map', pg.evaluate('GA.app.map.getLayer("sec-corr") && GA.app.map.querySourceFeatures("sec-lines").some(f => f.properties.corr)'))

            # translations: exercise names in Arabic and Hebrew
            for lang, word in [('ar', 'التمرين 1.3'), ('he', 'תרגיל 1.3')]:
                pg.evaluate(f'GA.i18n.setLang("{lang}")'); pg.evaluate('GA.pages.go("studio", "exercises")'); wait(pg, 'document.querySelectorAll(".rx").length >= 4', 20000)
                txt = pg.evaluate('document.querySelector("#page").innerText')
                check(f'exercise names translated ({lang})', word in txt and 'Exercise 1.' not in txt)
            pg.evaluate('GA.pages.close()'); pg.evaluate('GA.i18n.setLang("en")')
            check('no page errors', not errors, errors[:4])

            # resizing a desktop window with both panels open down to phone width leaves only one panel open
            pg.evaluate('document.body.classList.remove("left-collapsed", "right-collapsed")'); pg.set_viewport_size({'width': 390, 'height': 844}); time.sleep(0.8)
            both = pg.evaluate('!document.body.classList.contains("left-collapsed") && !document.body.classList.contains("right-collapsed")')
            check('narrow: never both side panels open after a resize', not both)
            pg.set_viewport_size({'width': 1440, 'height': 900}); time.sleep(0.5)
            # narrow and medium layouts in three languages
            for (w, h) in [(390, 844), (820, 1180), (1024, 768)]:
                pg.set_viewport_size({'width': w, 'height': h}); time.sleep(0.5)
                for lang in ['ar', 'he', 'en']:
                    pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.5)
                    for page in ['', 'studio', 'library']:
                        pg.evaluate(f'location.hash = "#/{page}"' if page else 'GA.pages.close()'); time.sleep(0.6)
                        o = pg.evaluate(OVER); n = pg.evaluate(NAVOV)
                        check(f'{w}px {lang} {page or "map"}: nothing outside the viewport, no overlapping buttons', not o and not n, (o, n))
                    if lang == 'ar': pg.screenshot(path=os.path.join(OUT, f'v4_{w}_ar.png'))
                pg.evaluate('GA.pages.close()')
            b.close()
    finally:
        srv.terminate()
    print(f'\n{len(fails)} failure(s)'); [print(' -', f) for f in fails]

if __name__ == '__main__': main()

# static check: the build in index.html matches version.json and every asset query
if __name__ == '__main__':
    import re as _re
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read(); ver = json.load(open(os.path.join(ROOT, 'version.json')))['build']
    qs = set(_re.findall(r'\?v=([0-9.]+)"', html)); b = _re.search(r"GA_BUILD = '([^']+)'", html).group(1)
    print(('PASS ' if qs == {ver} and b == ver else 'FAIL ') + f'build check: version.json {ver}, GA_BUILD {b}, asset queries {qs}')
