"""v33 — build 5.38: the story tour reworked and the train pictograms (owner requests A–F).
  A. Tram and metro pictograms on the southern-axis lines (main map): each icon point lies on its line (≤ 2 px) at zoom
     13–16; 22–28 px; hidden below zoom 12; no overlap with the station circles or the town names (OSM place nodes, label
     box estimated) at zoom 13–16; the legend images are the same pictures as the map images (pixel comparison); legend
     strings in ar / he / en; a click on an icon opens its line's popup; the icons appear in a print-layout map.
  B. Step 2 "Who lives around it": the five towns as built-up polygons (fill 25–35 %, thin red outline), no circles;
     drawn under the base outline and the lines; five localised names with a white halo, no figures on the map; figures in
     the card list and in a popup; legend swatch and source.
  C. "Where the streets stop": layers 3 / 4 / 5 = route A / route B / both; 13 dead-end signs at the default view and at
     zoom 13–16 (grouped signs carry a count; no two signs overlap; none hidden); two route colours with a white casing;
     the straight lines in the route colours, dashed; arrows; start/end circles with names; the figures "5.8 km walking vs
     3.9 km straight · ×1.49" and "6.9 vs 5.4 km · ×1.29"; metro, tram and towns faded to 30 %; legend = map.
  D. Step 3 maps: fills 0.45–0.55 with the legend at the same opacity; white municipal outlines; red outline of the five
     towns on top; 34 labels (5.39: the value alone, small, no name), label point inside its polygon, no two
     labels overlap, none under the card or controls, leader line where the label left its polygon; missing values
     written as missing; numbers left-to-right; popup with name, value, year, source.
  E. Step 3 has four slides (the southern-axis slide is gone): four dots; "Next layer" disabled on the last, "Previous"
     on the first; "Open the map" ends the tour; no strings or layers left for the removed slide.
  F. Framing: every slide's feature inside the free map area (map minus card, top-right controls, attribution, scale
     group), centred within 5 %; at 375 / 768 / 1024 / 1280 / 1440 px in ar / he / en; again after a language switch,
     a resize and Back.
Usage: python3 tests/ui_test_v33.py (OUT=/dir)"""
import sys, os, time, subprocess, warnings, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
warnings.filterwarnings('ignore')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8833
PARTS = os.environ.get('PARTS', 'A,B,F').split(',')  # A = pictograms, B = slides B–E, F = framing
OUT = os.environ.get('OUT', '/tmp/v33shots'); os.makedirs(OUT, exist_ok=True)
H = {375: 812, 390: 844, 768: 1024, 1024: 768, 1280: 800, 1440: 900}
fails = []
def check(cond, msg, extra=''):
    print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{str(extra)[:400]}]' if extra != '' and not cond else ''), flush=True)
    if not cond: fails.append(msg)
def stub(pg):
    def route(r):
        u = r.request.url
        if u.startswith(f'http://127.0.0.1:{PORT}/'): return r.continue_()
        if u.rstrip('/').endswith('/planet'): return r.fulfill(json={'tilejson': '3.0.0', 'tiles': ['https://tiles.openfreemap.org/stub/{z}/{x}/{y}.pbf'], 'minzoom': 0, 'maxzoom': 14})
        if 'fonts.googleapis.com' in u: return r.fulfill(status=200, body='', content_type='text/css')
        return r.fulfill(status=404, body='')
    pg.route('**/*', route)

# ---------- shared page-side helpers ----------
JS_LINE_DIST = r'''(a) => { const m = GA.app.map; const p = m.project(a.pt); let best = Infinity;
  for (let i = 1; i < a.line.length; i++) { const A = m.project(a.line[i - 1]), B = m.project(a.line[i]); const dx = B.x - A.x, dy = B.y - A.y, L = dx * dx + dy * dy;
    let u = L ? ((p.x - A.x) * dx + (p.y - A.y) * dy) / L : 0; u = Math.max(0, Math.min(1, u)); best = Math.min(best, Math.hypot(p.x - (A.x + u * dx), p.y - (A.y + u * dy))); } return best; }'''
# independent measure of the free map area (not GA.tour.freeRect): the stage minus the overlays
JS_FREE = r'''() => { const s = document.querySelector('.stage').getBoundingClientRect(); const f = { l: 0, t: 0, r: s.width, b: s.height };
  const rel = (e) => { if (!e || e.hidden || !e.offsetWidth || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top }; };
  const c = rel(document.querySelector('#tour-card'));
  if (c) { if (c.l <= 1 && c.r >= s.width - 1) f.b = Math.min(f.b, c.t); else if ((c.l + c.r) / 2 < s.width / 2) f.l = Math.max(f.l, c.r); else f.r = Math.min(f.r, c.l); }
  const tr = rel(document.querySelector('.maplibregl-ctrl-top-right')); if (tr) f.t = Math.max(f.t, Math.min(tr.b, s.height / 3));
  [rel(document.querySelector('.maplibregl-ctrl-attrib')), rel(document.querySelector('.maplibregl-ctrl-scale')), rel(document.querySelector('.ga-north'))].filter(Boolean).forEach(r => { if (r.t > s.height * 0.6) f.b = Math.min(f.b, r.t); });
  const bb = GA.tour.state.bbox; const m = GA.app.map; const a = m.project(bb[0]), b = m.project(bb[1]);
  return { f, box: { l: Math.min(a.x, b.x), r: Math.max(a.x, b.x), t: Math.min(a.y, b.y), b: Math.max(a.y, b.y) }, view: GA.tour.state.view, card: c }; }'''
def framed(G, tag):
    f, b = G['f'], G['box']; tol = 1.5
    inside = b['l'] >= f['l'] - tol and b['r'] <= f['r'] + tol and b['t'] >= f['t'] - tol and b['b'] <= f['b'] + tol
    fw, fh = f['r'] - f['l'], f['b'] - f['t']
    dx = abs((b['l'] + b['r']) / 2 - (f['l'] + f['r']) / 2) / fw; dy = abs((b['t'] + b['b']) / 2 - (f['t'] + f['b']) / 2) / fh
    check(inside, f'{tag}: the feature ({G["view"]}) lies inside the free map area', (b, f))
    check(dx <= 0.05 and dy <= 0.05, f'{tag}: centred in the free area (dx {dx * 100:.1f} %, dy {dy * 100:.1f} %)', (b, f))
JS_CENTRED = r'''() => { const m = GA.app.map, st = document.querySelector('.stage').getBoundingClientRect(), c = document.querySelector('#tour-card').getBoundingClientRect();
  const ring = GA.tour.data.base.geometry.type === 'Polygon' ? GA.tour.data.base.geometry.coordinates[0] : GA.tour.data.base.geometry.coordinates[0][0];
  const P = ring.map(ll => m.project(ll)); const xs = P.map(p => p.x), ys = P.map(p => p.y);
  const box = { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
  const under = P.filter(p => p.x + st.left > c.left && p.x + st.left < c.right && p.y + st.top > c.top && p.y + st.top < c.bottom).length;
  return { box, w: st.width, h: st.height, under, frac: (box.r - box.l) / st.width }; }'''
def centred(pg, tag):
    G = pg.evaluate(JS_CENTRED); b = G['box']
    dx = abs((b['l'] + b['r']) / 2 - G['w'] / 2) / G['w']; dy = abs((b['t'] + b['b']) / 2 - G['h'] / 2) / G['h']
    check(dx <= 0.05 and dy <= 0.05, f'{tag}: the base in the middle of the map (dx {dx * 100:.1f} %, dy {dy * 100:.1f} %)', G)
    check(b['l'] >= 0 and b['r'] <= G['w'] and b['t'] >= 0 and b['b'] <= G['h'], f'{tag}: the whole base on screen', G)
    check(G['under'] == 0, f'{tag}: the card covers no part of the outline', G)
JS_LABELS = r'''() => { const els = [...document.querySelectorAll('#tour-lbls .tour-lbl')]; const R = els.map(e => { const r = e.getBoundingClientRect(); return { id: e.dataset.id, l: r.left, t: r.top, r: r.right, b: r.bottom, txt: e.innerText, html: e.innerHTML, shadow: getComputedStyle(e).textShadow }; });
  const bad = []; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const a = R[i], c = R[j]; if (a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5) bad.push(a.id + '/' + c.id); }
  const obs = ['#tour-card', '.maplibregl-ctrl-top-right', '.maplibregl-ctrl-bottom-right', '.maplibregl-ctrl-bottom-left'].map(q => document.querySelector(q)).filter(e => e && e.offsetWidth && !e.hidden).map(e => e.getBoundingClientRect());
  const under = R.filter(a => obs.some(o => a.l < o.right && o.left < a.r && a.t < o.bottom && o.top < a.b)).map(a => a.id);
  const st = document.querySelector('.stage').getBoundingClientRect(); const out = R.filter(a => a.l < st.left - 0.5 || a.r > st.right + 0.5 || a.t < st.top - 0.5 || a.b > st.bottom + 0.5).map(a => a.id);
  const P = GA.tour.labels; const leaders = document.querySelectorAll('#tour-lbls svg line').length / 2;
  return { n: R.length, R, bad, under, out, forced: P.filter(p => p.forced).length, short: P.filter(p => p.short).length, needLeader: P.filter(p => p.leader).length, leaders }; }'''

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        def boot(w, lang, path='', init=''):
            mob = w < 700; ctx = b.new_context(viewport={'width': w, 'height': H[w]}, is_mobile=mob, has_touch=mob)
            ctx.add_init_script(f"window.__noPanelHook = true; {init} try {{ localStorage.setItem('granada-atlas.lang', '{lang}'); }} catch (e) {{ }}")
            pg = ctx.new_page(); stub(pg); errs = []; pg.on('pageerror', lambda e: 'rtl-text' not in str(e) and errs.append(str(e)[:200]))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html{path}'); return ctx, pg, errs
        def tour(w, lang, step, layer=1):
            ctx, pg, errs = boot(w, lang, f'#/tour/{step}/{layer}' if step > 1 else '#/tour/1')
            pg.wait_for_function(f'GA.tour && GA.tour.state.built && GA.tour.state.step === {step} && GA.tour.state.layer === {layer}', timeout=120000); time.sleep(2.2)
            return ctx, pg, errs
        def settle(pg):  # the map has stopped moving and drawn a frame
            pg.wait_for_function('!GA.app.map.isMoving()', timeout=30000); pg.evaluate('new Promise(r => { const m = GA.app.map; m.once("render", () => setTimeout(r, 300)); m.triggerRepaint(); })'); time.sleep(0.6)
        def goto(pg, step, layer):
            pg.evaluate(f'GA.tour.go({step}, {layer}, true)'); pg.wait_for_function(f'GA.tour.state.step === {step} && GA.tour.state.layer === {layer} && GA.tour.state.built', timeout=60000); time.sleep(0.4); settle(pg)
        T = {}

        # ================= A. pictograms on the main map =================
        for lang in (('en', 'ar', 'he') if 'A' in PARTS else ()):
            ctx, pg, errs = boot(1280, lang, '?nointro')
            pg.wait_for_function('GA.app && GA.app.map && GA.app.L && GA.app.map.getLayer("ly-smetro-icon") && GA.app.map.getLayer("ly-tram-icon") && GA.app.map.hasImage("ga-rail-metro") && GA.app.map.hasImage("ga-rail-tram") && GA.app.map.getSource("ly-smetro-iconsrc")._data && GA.app.map.getSource("ly-smetro-iconsrc")._data.features && GA.app.map.getSource("ly-smetro-iconsrc")._data.features.length', timeout=120000)
            time.sleep(1)
            G = pg.evaluate('''async () => { const D = GA.data; const [m, tr, e] = await Promise.all(['south_metro', 'tram_1931', 'base_edge'].map(n => D.single(n)));
              const pts = GA.railIcons.points(m, tr).features; const line = (fc, k) => fc.features.find(f => f.properties.k === k).geometry.coordinates;
              return { pts: pts.map(f => [f.properties.kind, f.geometry.coordinates]), metro: line(m, 'track'), trunk: line(tr, 'trunk'),
                st: m.features.filter(f => f.geometry.type === 'Point').map(f => f.geometry.coordinates).concat(tr.features.filter(f => f.properties.k === 'station').map(f => f.geometry.coordinates)),
                towns: e.features.filter(f => f.properties.k === 'town').map(f => [f.properties.nm, f.geometry.coordinates]) }; }''')
            P = dict(G['pts'])
            if lang == 'en':
                check(set(P) == {'metro', 'tram'}, 'two pictograms: the metro on its track, the tram on the 1931 trunk line', P)
                for z in (13, 14, 15, 16):
                    for _ in range(30):  # repeat the jump until nothing else moves the map away (start-up animations)
                        pg.evaluate(f'GA.app.map.stop(); GA.app.map.jumpTo({{ center: [-3.631, 37.143], zoom: {z} }})'); time.sleep(1.0)
                        if pg.evaluate(f'Math.abs(GA.app.map.getZoom() - {z}) < 0.01 && !GA.app.map.isMoving()'): break
                    time.sleep(0.8)
                    st_ = pg.evaluate('({ z: GA.app.map.getZoom(), moving: GA.app.map.isMoving(), c: GA.app.map.getCenter().toArray() })')
                    check(abs(st_['z'] - z) < 0.01, f'zoom {z}: the map holds the view for the check', st_)
                    for kind, line in (('metro', G['metro']), ('tram', G['trunk'])):
                        d = pg.evaluate(JS_LINE_DIST, {'pt': P[kind], 'line': line}); check(d <= 2, f'zoom {z}: the {kind} icon point lies on its line ({d:.2f} px)')
                    size = pg.evaluate(f'(() => {{ const z = {z}; const s = z >= 14 ? 1 : 0.55 + (z - 12) * 0.225; return s * GA.railIcons.W; }})()')
                    check(50 <= size <= 69, f'zoom {z}: icon {size:.1f} px wide (5.44: 50–69, on a white badge)')
                    boxes = pg.evaluate('''(a) => { const m = GA.app.map, z = m.getZoom(), s = (z >= 14 ? 1 : 0.55 + (z - 12) * 0.225), W = GA.railIcons.W * s, H = GA.railIcons.H * s; const B = (ll) => { const p = m.project(ll); return { l: p.x - W / 2, r: p.x + W / 2, t: p.y - H / 2, b: p.y + H / 2, x: p.x, y: p.y }; };
                      const r = 4 + (z - 10) * (8 - 4) / 6 + 2.2; /* station circle radius + stroke at this zoom */
                      const hitC = (bx, ll) => { const p = m.project(ll); const cx = Math.max(bx.l, Math.min(p.x, bx.r)), cy = Math.max(bx.t, Math.min(p.y, bx.b)); return Math.hypot(p.x - cx, p.y - cy) < r; };
                      const lbl = (nm, ll) => { const p = m.project(ll); const w = nm.length * 7.6 + 6, h = 18; return { l: p.x - w / 2, r: p.x + w / 2, t: p.y - h / 2, b: p.y + h / 2 }; };
                      const ov = (x, y) => x.l < y.r && y.l < x.r && x.t < y.b && y.t < x.b;
                      const out = {}; Object.entries(a.P).forEach(([k, ll]) => { const bx = B(ll); out[k] = { st: a.st.filter(s => hitC(bx, s)).length, towns: a.towns.filter(([nm, t]) => ov(bx, lbl(nm, t))).map(x => x[0]),
                        hit: m.queryRenderedFeatures([[bx.x - 3, bx.y - 3], [bx.x + 3, bx.y + 3]], { layers: [k === 'metro' ? 'ly-smetro-icon' : 'ly-tram-icon'] }).length }; }); return out; }''', {'P': P, 'st': G['st'], 'towns': G['towns']})
                    for k, v in boxes.items():
                        check(v['st'] == 0, f'zoom {z}: the {k} icon covers no station circle', v)
                        check(not v['towns'], f'zoom {z}: the {k} icon covers no town name', v)
                        check(v['hit'] >= 1, f'zoom {z}: the {k} icon is drawn on the map', v)
                    if z == 15: pg.screenshot(path=f'{OUT}/A_icons_z15.png')
                pg.evaluate('GA.app.map.jumpTo({ center: [-3.631, 37.143], zoom: 11.5 })'); time.sleep(1)
                n = pg.evaluate('GA.app.map.queryRenderedFeatures({ layers: ["ly-smetro-icon", "ly-tram-icon"] }).length'); check(n == 0, f'zoom 11.5: icons hidden ({n})')
                # the legend pictures are the map pictures
                diff = pg.evaluate('''async () => { const out = {}; for (const k of ['metro', 'tram']) { const im = GA.app.map.style.getImage(GA.railIcons.imgId(k)); const w = im.data.width, h = im.data.height;
                    const img = new Image(); img.src = document.createRange().createContextualFragment(GA.railIcons.legendImg(k)).firstChild.src; await img.decode(); const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(img, 0, 0, w, h);
                    const a = g.getImageData(0, 0, w, h).data, b = im.data.data; let d = 0, ink = 0; for (let i = 0; i < a.length; i += 4) { d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]); if (b[i + 3] > 128) ink++; }
                    out[k] = { mean: d / (w * h), ink, w, h, pr: im.pixelRatio }; } return out; }''')
                for k, v in diff.items(): check(v['mean'] < 2 and v['ink'] > 200 and v['w'] == 2 * pg.evaluate('GA.railIcons.W') and v['pr'] == 2, f'the {k} legend image is the map image (mean diff {v["mean"]:.2f}, 2× bitmap {v["w"]}×{v["h"]})', v)
                # popups: a click on the icon opens the line's own popup
                pg.evaluate('GA.app.map.jumpTo({ center: [-3.631, 37.143], zoom: 15 })'); time.sleep(2.5)
                for k in ('metro', 'tram'):
                    xy = pg.evaluate('(ll) => { const p = GA.app.map.project(ll); return [p.x, p.y]; }', P[k])
                    r = pg.evaluate('(xy) => { const m = GA.app.map; const r = GA.app.L.popupAt({ x: xy[0], y: xy[1] }); const src = (id) => ((m.getSource(id) || {})._data || {}).features; return r ? { id: r.def.id, layer: r.feature.layer.id, html: r.html.slice(0, 60), fgeom: r.feature.geometry.coordinates, xy, zoom: m.getZoom(), tramSrc: (src("ly-tram-iconsrc") || []).map(f => [f.properties.kind, f.geometry.coordinates]), metroSrc: (src("ly-smetro-iconsrc") || []).map(f => [f.properties.kind, f.geometry.coordinates]), all: m.queryRenderedFeatures([xy[0], xy[1]]).map(q => q.layer.id).slice(0, 8) } : null; }', xy)
                    want_id, title = ('south_metro', pg.evaluate('GA.i18n.t("v18.lyMetro")')) if k == 'metro' else ('tram_1931', pg.evaluate('GA.i18n.t("v18.lgTrunk")'))
                    check(r and r['id'] == want_id and r['layer'].endswith('-iconhit') and title in r['html'], f'a click on the {k} icon opens its line popup ("{title}")', r)
                # a print-layout map shows the icons (offscreen map copies the images from the main map): render the same frame with
                # and without the two icon layers and count the pixels that change inside each icon's box
                pr = pg.evaluate('''async () => { const q = { x: 0, y: 0, w: 900, h: 700 }; const c = [-3.632, 37.1445]; const main = GA.app.map; const ids = ['ly-smetro-icon', 'ly-tram-icon'];
                  async function render() { const R = await GA.printLayout.mapRenderer({ x: 0, y: 0, w: 238, h: 185 }, 96, 12000, q, { center: c }); await R.measure(q.h);
                    const cv = document.createElement('canvas'); cv.width = q.w; cv.height = q.h; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, q.w, q.h); await R.draw(g, 0, q.h, 0, q.h); if (R.dispose) R.dispose(); return { g, cv, zoom: R.zoom }; }
                  const on = await render(); ids.forEach(id => main.setLayoutProperty(id, 'visibility', 'none')); const off = await render(); ids.forEach(id => main.setLayoutProperty(id, 'visibility', 'visible'));
                  const ws = 512 * Math.pow(2, on.zoom); const M0 = maplibregl.MercatorCoordinate.fromLngLat(c); const px = (ll) => { const M = maplibregl.MercatorCoordinate.fromLngLat(ll); return [q.w / 2 + (M.x - M0.x) * ws, q.h / 2 + (M.y - M0.y) * ws]; };
                  const pts = GA.railIcons.points(await GA.data.single('south_metro'), await GA.data.single('tram_1931')).features; const out = { zoom: on.zoom };
                  pts.forEach(f => { const [x, y] = px(f.geometry.coordinates); const box = [Math.round(x - 16), Math.round(y - 11), 32, 22]; const a = on.g.getImageData(...box).data, b = off.g.getImageData(...box).data; let n = 0;
                    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; out[f.properties.kind] = n; });
                  window.__printShot = on.cv.toDataURL('image/png'); return out; }''')
                for k in ('metro', 'tram'): check(pr.get(k, 0) > 80, f'print map: the {k} pictogram is drawn ({pr.get(k)} px differ from the same print without it)', pr)
                import base64
                shot = pg.evaluate('window.__printShot || ""')
                if shot: open(f'{OUT}/A_print_map.png', 'wb').write(base64.b64decode(shot.split(',')[1]))
            # legend strings in every language (Layers / map legend)
            lg = pg.evaluate('GA.app.L.legendHTML()')
            want = pg.evaluate('[GA.i18n.t("x33.icMetro"), GA.i18n.t("x33.icTram")]')
            check(all(w_ in lg for w_ in want) and lg.count('sw-rail') >= 2, f'{lang}: the map legend lists both pictograms ({want[0]} · {want[1]})', lg[:200])
            check(not errs, f'{lang}: no page errors (main map)', errs[:2]); ctx.close()

        # ================= B–E. the tour slides =================
        for lang in (('en', 'ar', 'he') if 'B' in PARTS else ()):
            ctx, pg, errs = tour(1280, lang, 2, 1); tag = f'1280 {lang}'
            S = pg.evaluate('''() => { const m = GA.app.map, ids = m.getStyle().layers.map(l => l.id); const vis = (id) => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') === 'visible';
              return { ids: ids.filter(i => i.startsWith('tour-')), circles: m.getStyle().layers.filter(l => l.id.startsWith('tour-') && l.type === 'circle' && vis(l.id)).map(l => l.id),
                fillOp: m.getPaintProperty('tour-towns-fill', 'fill-opacity'), fillCol: m.getPaintProperty('tour-towns-fill', 'fill-color'), lineCol: m.getPaintProperty('tour-towns-line', 'line-color'), lineW: m.getPaintProperty('tour-towns-line', 'line-width'),
                rendered: new Set(m.queryRenderedFeatures({ layers: ['tour-towns-fill'] }).map(f => f.properties.nm)).size, red: GA.palette.tour.townFill, five: GA.tour.data.towns.features.length,
                names: ['armilla', 'churriana', 'gabias', 'alhendin', 'ogijares'].map(k => GA.i18n.t('x33.nm.' + k)) }; }''')
            ids = S['ids']
            check(S['five'] == 5 and S['rendered'] == 5, f'{tag} B: five built-up polygons drawn ({S["rendered"]})', S)
            check(0.25 <= S['fillOp'] <= 0.35 and S['fillCol'] == S['red'] and S['lineCol'] == S['red'] and S['lineW'] <= 1.5, f'{tag} B: red fill at {S["fillOp"]}, thin red outline ({S["lineW"]} px)', S)
            check(not S['circles'], f'{tag} B: no circles on the towns slide', S['circles'])
            check(ids.index('tour-towns-fill') < ids.index('tour-base-line') and ids.index('tour-towns-line') < ids.index('tour-metro') and ids.index('tour-towns-line') < ids.index('tour-tram'), f'{tag} B: towns drawn under the base outline and the lines')
            Lb = pg.evaluate(JS_LABELS); txts = sorted(r['txt'].strip() for r in Lb['R'])
            check(Lb['n'] == 5 and txts == sorted(S['names']), f'{tag} B: five town names, localised ({", ".join(txts)})', (txts, S['names']))
            check(all('255, 255, 255' in r['shadow'] for r in Lb['R']) and not any(ch.isdigit() for t_ in txts for ch in t_), f'{tag} B: names only, with a white halo')
            check(not Lb['bad'] and not Lb['under'], f'{tag} B: names do not overlap each other or the card', Lb)
            card = pg.evaluate('document.querySelector("#tour-card").innerText')
            check(all(x in card for x in ('25,300', '16,878', '23,584', '10,475', '15,239', '+7.1 %', '+21.4 %')) and 'build_tour_towns' in card, f'{tag} B: card lists residents and % change of all five; source names the method', card[:400])
            check(pg.evaluate('document.querySelectorAll(".tour-c-b .lg li").length') >= 1 and pg.evaluate('GA.i18n.t("x33.lgTown")') in card, f'{tag} B: legend swatch for the built-up area')
            # popup on a town
            ll = pg.evaluate('GA.tour.data.towns.features.find(f => f.properties.nm === "Armilla").properties.lp')
            xy = pg.evaluate('(ll) => { const p = GA.app.map.project(ll); const r = GA.app.map.getCanvas().getBoundingClientRect(); return [p.x + r.left, p.y + r.top]; }', ll)
            pg.mouse.click(xy[0], xy[1]); time.sleep(0.8)
            pop = pg.evaluate('(document.querySelector(".tour-pop") || {}).innerText || ""')
            check('25,300' in pop and '7.1' in pop and S['names'][0] in pop, f'{tag} B: a click on Armilla opens its popup (residents, change)', pop[:200])
            if lang in ('en', 'ar'): pg.screenshot(path=f'{OUT}/B_towns_{lang}.png')
            # ---- C. the streets slides ----
            want_figs = {'en': ('5.8 km walking vs 3.9 km straight · ×1.49', '6.9 km walking vs 5.4 km straight · ×1.29')}
            seen = {}
            for layer, keys in ((3, ['A']), (4, ['B']), (5, ['A', 'B'])):
                goto(pg, 2, layer)
                try:  # the route source is prepared in the background: give it up to 10 s to draw before judging
                    pg.wait_for_function(f'GA.app.map.queryRenderedFeatures({{ layers: {[f"tour-ends{k}" for k in keys]} }}).length >= {2 * len(keys)} && GA.app.map.queryRenderedFeatures({{ layers: {[f"tour-arrow{k}" for k in keys]} }}).length >= {2 * len(keys)}', timeout=10000)
                except Exception: pass
                V = pg.evaluate('''() => { const m = GA.app.map; const vis = (id) => !!m.getLayer(id) && m.getLayoutProperty(id, 'visibility') === 'visible'; const P = (id, k) => m.getPaintProperty(id, k);
                  const signs = [...document.querySelectorAll('#tour-lbls .tour-sign')].map(e => { const r = e.querySelector('img').getBoundingClientRect(); return { n: +e.dataset.n, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width }; });
                  const ov = []; for (let i = 0; i < signs.length; i++) for (let j = i + 1; j < signs.length; j++) { const a = signs[i], c = signs[j]; if (a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5) ov.push([i, j]); }
                  return { A: ['routeA', 'routeA-case', 'straightA', 'arrowA', 'endsA'].map(k => vis('tour-' + k)), B: ['routeB', 'routeB-case', 'straightB', 'arrowB', 'endsB'].map(k => vis('tour-' + k)),
                    colA: P('tour-routeA', 'line-color'), colB: P('tour-routeB', 'line-color'), wA: P('tour-routeA', 'line-width'), wCase: P('tour-routeA-case', 'line-width'), caseCol: P('tour-routeA-case', 'line-color'),
                    sA: P('tour-straightA', 'line-color'), sB: P('tour-straightB', 'line-color'), dash: P('tour-straightA', 'line-dasharray'), sW: P('tour-straightA', 'line-width'),
                    fade: { towns: P('tour-towns-fill', 'fill-opacity'), townsLine: P('tour-towns-line', 'line-opacity'), metro: P('tour-metro', 'line-opacity'), tram: P('tour-tram', 'line-opacity'), rail: P('tour-rail', 'icon-opacity') },
                    vis: { towns: vis('tour-towns-fill'), metro: vis('tour-metro'), tram: vis('tour-tram') }, signs, ov, T: GA.palette.tour,
                    arrows: m.queryRenderedFeatures({ layers: ['tour-arrowA', 'tour-arrowB'].filter(vis) }).length, ends: m.queryRenderedFeatures({ layers: ['tour-endsA', 'tour-endsB'].filter(vis) }).length }; }''')
                tg = f'{tag} C layer {layer} ({"+".join(keys)})'
                check(all(V['A']) == ('A' in keys) and all(V['B']) == ('B' in keys) and (any(V['A']) == ('A' in keys)) and (any(V['B']) == ('B' in keys)), f'{tg}: only route(s) {"+".join(keys)} drawn', (V['A'], V['B']))
                check(sum(s['n'] for s in V['signs']) == 13 and not V['ov'] and all(16 <= s['w'] <= 20 for s in V['signs']), f'{tg}: 13 dead-end signs (16–20 px), none hidden, none overlapping ({len(V["signs"])} signs)', V['signs'])
                check(V['colA'] == V['T']['routeA'] and V['colB'] == V['T']['routeB'] and V['colA'] != V['colB'] and 3.5 <= V['wA'] <= 4.5 and V['wCase'] > V['wA'] + 2 and V['caseCol'] == '#FFFFFF', f'{tg}: two route colours, {V["wA"]} px on a white casing')
                check(V['sA'] == V['colA'] and V['sB'] == V['colB'] and V['dash'] and V['sW'] < V['wA'], f'{tg}: straight lines in the route colours, thin and dashed')
                check(V['arrows'] >= 2 * len(keys) and V['ends'] == 2 * len(keys), f'{tg}: direction arrows ({V["arrows"]}) and start/end circles ({V["ends"]})')
                f_ = V['fade']; check(V['vis']['towns'] and V['vis']['metro'] and abs(f_['metro'] - 0.3) < 0.01 and abs(f_['tram'] - 0.3) < 0.01 and abs(f_['townsLine'] - 0.3) < 0.01 and abs(f_['towns'] - 0.3 * V['T']['townFillAlpha']) < 0.01 and abs(f_['rail'] - 0.3) < 0.01, f'{tg}: metro, tram and towns faded to 30 %', f_)
                Lb = pg.evaluate(JS_LABELS)
                rt = [r['txt'].replace('\n', ' ') for r in Lb['R'] if r['id'].startswith('rt-')]; ends = [r['txt'].strip() for r in Lb['R'] if r['id'].startswith('end-')]
                check(len(rt) == len(keys) and len(ends) == 2 * len(keys) and not Lb['bad'] and not Lb['under'] and not Lb['out'], f'{tg}: route figures and start/end names placed, no overlaps', Lb)
                if lang == 'en':
                    for k in keys: check(any(want_figs['en'][0 if k == 'A' else 1] in x for x in rt), f'{tg}: route {k} label reads "{want_figs["en"][0 if k == "A" else 1]}"', rt)
                    names = {'A': ['Churriana de la Vega', 'Alhendín'], 'B': ['Las Gabias', 'Ogíjares']}
                    check(all(n_ in ends for k in keys for n_ in names[k]), f'{tg}: start/end names', ends)
                else:
                    check(all('×1.49' in x or '×1.29' in x for x in rt), f'{tg}: route labels carry the ratio', rt)
                lgd = pg.evaluate('document.querySelector(".tour-c-b .lg").innerHTML')
                check('tour-sign-sw' in lgd and all((V['T']['route' + k] in lgd) for k in keys) and all((V['T']['route' + k] not in lgd) for k in ('A', 'B') if k not in keys), f'{tg}: legend = map (sign, route colours shown)')
                if lang in ('en', 'ar'): pg.screenshot(path=f'{OUT}/C_streets_{layer}_{lang}.png')
                # zoom 13–16 around the fence: the signs stay complete
                if layer == 5 and lang == 'en':
                    for z in (13, 14, 15, 16):
                        pg.evaluate(f'GA.app.map.jumpTo({{ center: [-3.638, 37.130], zoom: {z} }})'); time.sleep(0.8)
                        sg = pg.evaluate('''() => { const m = GA.app.map, cv = m.getCanvas().getBoundingClientRect(); const pts = GA.tour.data.dead.map(ll => m.project(ll)).filter(p => p.x >= 0 && p.y >= 0 && p.x <= cv.width && p.y <= cv.height).length;
                          const s = [...document.querySelectorAll('#tour-lbls .tour-sign')].map(e => +e.dataset.n); return { pts, sum: s.reduce((a, b) => a + b, 0), n: s.length }; }''')
                        check(sg['sum'] == 13 and sg['pts'] <= 13, f'{tg} zoom {z}: all 13 dead ends signed ({sg["n"]} signs, counts add to {sg["sum"]})', sg)
                    goto(pg, 2, 5)
            goto(pg, 2, 7)
            f_ = pg.evaluate('({ m: GA.app.map.getPaintProperty("tour-metro", "line-opacity"), r: GA.app.map.getPaintProperty("tour-rail", "icon-opacity"), icons: GA.app.map.queryRenderedFeatures({ layers: ["tour-rail"] }).length, lg: document.querySelectorAll(".tour-c-b .lg img.sw-rail").length })')
            check(f_['m'] == 1 and f_['r'] == 1 and f_['icons'] == 2 and f_['lg'] == 2, f'{tag}: metro/tram slide at full opacity with both pictograms (map and legend)', f_)
            if lang == 'en': pg.screenshot(path=f'{OUT}/A_tour_rail.png')
            # ---- D. step 3 ----
            for layer, key in ((1, 'chg'), (2, 'inc'), (3, 'rent')):
                goto(pg, 3, layer); tg = f'{tag} D {key}'
                V = pg.evaluate(f'''() => {{ const m = GA.app.map, ids = m.getStyle().layers.map(l => l.id); const op = m.getPaintProperty('tour-{key}', 'fill-opacity');
                  const sw = [...document.querySelectorAll('.tour-c-b .lg .sw')].slice(0, GA.palette.tour.{key}.length).map(e => +getComputedStyle(e).opacity);
                  return {{ op: Array.isArray(op) ? op[2] : op, sw, muni: m.getPaintProperty('tour-muni-line', 'line-color'), five: m.getPaintProperty('tour-five', 'line-color'), order: [ids.indexOf('tour-{key}'), ids.indexOf('tour-muni-line'), ids.indexOf('tour-five')], red: GA.palette.tour.five }}; }}''')
                check(0.45 <= V['op'] <= 0.55 and all(abs(s - V['op']) < 0.02 for s in V['sw']), f'{tg}: fill opacity {V["op"]}, legend swatches at the same opacity', V)
                check(V['muni'].upper() == '#FFFFFF' and V['five'] == V['red'] and V['order'][0] < V['order'][1] < V['order'][2], f'{tg}: white municipal outlines, red outline of the five towns on top', V)
                Lb = pg.evaluate(JS_LABELS)
                check(Lb['n'] == 34 and not Lb['bad'] and not Lb['under'] and not Lb['out'] and Lb['forced'] == 0, f'{tg}: 34 labels, none overlapping, none under the card or controls ({Lb["short"]} value-only, {Lb["needLeader"]} with leader lines)', {k: Lb[k] for k in ('n', 'bad', 'under', 'out', 'forced')})
                check(Lb['leaders'] == Lb['needLeader'], f'{tg}: a leader line for every label moved off its polygon ({Lb["leaders"]})', Lb['leaders'])
                inside = pg.evaluate('''() => GA.tour.data.area.features.filter(f => { const pt = f.properties.lp; const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
                  return !polys.some(rs => { let ins = false; rs.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } }); return ins; }); }).map(f => f.properties.name)''')
                check(not inside, f'{tg}: every label point lies inside its polygon (polylabel)', inside)
                miss = pg.evaluate(f'GA.tour.data.area.features.filter(f => f.properties.{key} == null).map(f => "m-" + f.properties.ine)')
                missTxt = pg.evaluate(f'GA.i18n.t("x33.miss.{key}")')
                mr = [r for r in Lb['R'] if r['id'] in miss]
                check(all(missTxt in r['txt'] for r in mr), f'{tg}: {len(miss)} missing values written as "{missTxt}"', [r['txt'] for r in mr][:3])
                have = [r for r in Lb['R'] if r['id'] not in miss]
                check(all('dir="ltr"' in r['html'] for r in have), f'{tg}: values left-to-right')
                if lang == 'en' and key == 'chg':
                    names = pg.evaluate('GA.tour.data.area.features.map(f => f.properties.name)')
                    check(not [r['txt'] for r in Lb['R'] if any(nm in r['txt'] for nm in names)], f'{tg}: labels carry the value only (5.39: no municipality names on the map)', [r['txt'] for r in Lb['R']][:5])
                    sz = pg.evaluate('getComputedStyle(document.querySelector("#tour-lbls .tour-lbl.muni .v")).fontSize'); check(float(sz[:-2]) <= 11, f'{tg}: values in a small font ({sz})')
                    g = pg.evaluate('(() => { const e = document.querySelector("#tour-lbls .tour-lbl[data-id=\'m-18087\']"); return e ? e.innerText : ""; })()'); check('−0.8 %' in g, f'{tg}: Granada reads −0.8 %', g)
                # popup on Granada
                pg.evaluate('(() => { const m = GA.app.map; m.stop(); const ll = GA.tour.data.area.features.find(f => f.properties.name === "Granada").properties.lp; const p = m.project(ll); GA.tour.popupAt({ point: p, lngLat: m.unproject(p) }); })()'); time.sleep(0.5)
                pop = pg.evaluate('(document.querySelector(".tour-pop") || {}).innerText || ""')
                top = pg.evaluate('(() => { const p = document.querySelector(".tour-pop .maplibregl-popup-content"); if (!p) return null; const r = p.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(e && e.closest(".tour-pop")); })()')
                check(top, f'{tg}: the popup is drawn above the labels')
                yr = {'chg': '2015–2025', 'inc': '2024', 'rent': '2024'}[key]; src = {'chg': '2871', 'inc': '31025', 'rent': '59060'}[key]
                check(S['names'][0] and pg.evaluate('GA.i18n.t("x33.nm.granada")') in pop and yr in pop and src in pop, f'{tg}: popup with name, value, year {yr} and source {src}', pop[:200])
                if lang == 'en' or (lang == 'ar' and key == 'chg'): pg.screenshot(path=f'{OUT}/D_{key}_{lang}.png')
            # ---- E. four slides; the last one ----
            goto(pg, 3, 4)
            E = pg.evaluate('''() => ({ dots: document.querySelectorAll('.tour-dots i').length, nextDis: document.querySelector('[data-tour=layer]').disabled, prevDis: document.querySelector('[data-tour=prev]').disabled, n: GA.tour.state.n,
              finish: document.querySelector('[data-tour=next]').textContent.trim(), want: GA.i18n.t('tour.finish'), groups: JSON.stringify(GA.tour.VIS[3]), pole: !!GA.app.map.getLayer('tour-pole'),
              strings: ['tour.s3.l5', 'tour.s3.l5t', 'tour.lgEstate'].filter(k => GA.i18n.t(k) !== k) })''')
            check(E['dots'] == 4 and E['n'] == 4, f'{tag} E: step 3 has four slides (four dots)', E)
            check(E['nextDis'] and not E['prevDis'] and E['finish'] == E['want'], f'{tag} E: last slide — "Next layer" disabled, "Previous layer" on, "{E["want"]}" button', E)
            check('pole' not in E['groups'] and not E['pole'] and not E['strings'], f'{tag} E: no layer or string left for the removed southern-axis slide', E)
            if lang in ('en', 'ar'): pg.screenshot(path=f'{OUT}/E_last_{lang}.png')
            pg.keyboard.press('Space'); time.sleep(0.4); check(pg.evaluate('GA.tour.state.layer') == 4, f'{tag} E: Space on the last slide stays there')
            goto(pg, 3, 1); check(pg.evaluate('document.querySelector("[data-tour=prev]").disabled'), f'{tag} E: "Previous layer" disabled on the first slide')
            goto(pg, 3, 4); pg.click('[data-tour=next]'); time.sleep(1.2)
            check(not pg.evaluate('GA.tour.state.on') and pg.evaluate('location.hash') == '' and pg.evaluate('GA.app.map.getStyle().layers.filter(l => l.id.startsWith("tour-")).length') == 0, f'{tag} E: "Open the map" ends the tour on the normal map')
            check(not errs, f'{tag}: no page errors', errs[:3]); ctx.close()

        # ================= F. framing =================
        for lang in (('ar', 'he', 'en') if 'F' in PARTS else ()):
            for w in (375, 768, 1024, 1280, 1440):
                ctx, pg, errs = tour(w, lang, 1); tag = f'F {w}px {lang}'
                if pg.evaluate('GA.tour.state.centred'): centred(pg, tag + ' slide 1')
                else: framed(pg.evaluate(JS_FREE), tag + ' slide 1')
                if w in (390, 1280, 1440) or (w == 375 and lang != 'he'): pg.screenshot(path=f'{OUT}/F_slide1_{lang}_{w}.png')
                for s_, l_ in ((2, 1), (2, 5), (2, 7), (3, 1)):
                    goto(pg, s_, l_); time.sleep(0.6); framed(pg.evaluate(JS_FREE), f'{tag} slide {s_}.{l_}')
                if w == 1280:
                    # Back, a language switch (the card changes side) and a resize: the framing follows
                    pg.evaluate('GA.tour.back()'); pg.wait_for_function('GA.tour.state.step === 2', timeout=30000); time.sleep(2.4); framed(pg.evaluate(JS_FREE), f'{tag} after Back')
                    other = 'en' if lang != 'en' else 'ar'; pg.evaluate(f'GA.i18n.setLang("{other}")'); time.sleep(2.6)
                    G = pg.evaluate(JS_FREE); framed(G, f'{tag} after switching to {other}')
                    pg.set_viewport_size({'width': 1024, 'height': 768}); time.sleep(1.5); settle(pg); framed(pg.evaluate(JS_FREE), f'{tag} after a resize to 1024 px')
                check(not errs, f'{tag}: no page errors', errs[:3]); ctx.close()
        b.close()
finally:
    srv.terminate()
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED:\n  ' + '\n  '.join(fails))
sys.exit(1 if fails else 0)
