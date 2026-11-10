"""Build the data of the Exercise 1.3 human-dimension map in the artistic language (build 5.26): an axonometric drawing
where every layer is a 3D object. Everything comes from layers already in the atlas, in the shared frame (frame px
0..1000, x east, y south):
  data/ex13/art/human_ground.png  plan line drawing of the frame (every OSM street, municipality, built-city edge), 2000 px
  data/ex13/art/human_art.json    residents (GHS-POP 100 m cells > 15,000/km²), commercial peaks C1–C6, the six densest
                                  named shop streets (≥ 250 m, ≥ 20 shops within 25 m, by shops per 100 m), the 20 busiest bus
                                  stops (schedule of 26 Oct 2026), squares / parks / markets (OSM), hotels (OSM), Albaicín /
                                  Alhambra, and counts
Run from the repository root after tools/build_ex13_art.py: python3 tools/build_ex13_human.py   (Playwright + Chromium)."""
import base64, io, json, os, subprocess, sys, time
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, 'data/ex13/art'); PORT = 8832
JS = r'''async () => { await GA.ex13.load();
  const D = GA.ex13.data, F = D.frame, S = 1000, mpp = (F.x1 - F.x0) / S;
  const X = (u) => (u - F.x0) / mpp, Y = (v) => (F.y1 - v) / mpp; const U = (ll) => GA.proj.EPSG25830.forward(ll); const inF = (x, y) => x >= 0 && y >= 0 && x < S && y < S;
  const r1 = (v) => Math.round(v * 10) / 10;
  const ll0 = GA.proj.EPSG25830.inverse([F.x0, F.y0]), ll1 = GA.proj.EPSG25830.inverse([F.x1, F.y1]); const streets = await GA.data.chunked('streets', [ll0[0], ll0[1], ll1[0], ll1[1]], 0, 400);
  // ground: white, every street in a thin grey, main ones darker, the built city edge, municipality dashed
  const G = document.createElement('canvas'); G.width = G.height = 2000; const g = G.getContext('2d'); g.scale(2, 2); g.lineCap = 'round'; g.lineJoin = 'round';
  const W = { motorway: [1.6, '#8C817A'], trunk: [1.5, '#8C817A'], primary: [1.2, '#8C817A'], secondary: [1, '#9C918A'], tertiary: [0.8, '#A9A097'], residential: [0.45, '#BDB5AA'], living_street: [0.45, '#BDB5AA'], unclassified: [0.45, '#BDB5AA'], pedestrian: [0.45, '#BDB5AA'], service: [0.3, '#D3CFC2'] };
  Object.entries(W).reverse().forEach(([hw, [w, c]]) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); streets.forEach(f => { if (f.properties.hw !== hw) return; const gm = f.geometry; (gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : []).forEach(l => l.forEach((p, i) => { const q = U(p); i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1])); })); }); g.stroke(); });
  g.beginPath(); D.muni.forEach(r => r.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.strokeStyle = '#8C817A'; g.lineWidth = 0.8; g.setLineDash([5, 4]); g.stroke(); g.setLineDash([]);
  const edge = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data/ex13/art/centre_edge.png?v=' + GA_BUILD; }); const e = document.createElement('canvas'); e.width = e.height = 2000; const ex = e.getContext('2d'); ex.drawImage(edge, 0, 0); ex.globalCompositeOperation = 'source-in'; ex.fillStyle = '#29100C'; ex.fillRect(0, 0, 2000, 2000); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(e, 0, 0);
  const out = { ground: G.toDataURL('image/png') };
  // 1 residents: 100 m cells above 15,000 residents/km² (GHS-POP), each as a prism
  const d = D.density, cx = d.corners.x, cy = d.corners.y; out.residents = [];
  d.pop.forEach((row, r) => row.forEach((p, q) => { if (!p || p * 100 < 15000) return; const qd = [[r, q], [r, q + 1], [r + 1, q + 1], [r + 1, q]].map(([a, b]) => [r1(X(cx[a][b])), r1(Y(cy[a][b]))]); const m = qd.reduce((s, z) => [s[0] + z[0] / 4, s[1] + z[1] / 4], [0, 0]); if (inF(m[0], m[1])) out.residents.push({ qd, v: Math.round(p * 100) }); }));
  // 2 commerce: the kernel peaks C1–C6 inside the frame (OSM shops, r = 300 m)
  out.peaks = D.centre.peaks.map(p => ({ rank: p.rank, v: p.v, n300: p.n300, x: r1(X(p.x)), y: r1(Y(p.y)) })).filter(p => inF(p.x, p.y));
  // 3 main commercial streets: named, ≥ 250 m, ≥ 20 shops within 25 m, ranked by shops per 100 m (top 6)
  const shops = D.centre.points.map(p => [X(p[0]), Y(p[1])]).filter(p => inF(p[0], p[1])); const GR = new Map(); shops.forEach((p, i) => { const k = Math.floor(p[0] / 5) + ',' + Math.floor(p[1] / 5); (GR.get(k) || GR.set(k, []).get(k)).push(i); }); const R = 25 / mpp; const byName = new Map();
  streets.forEach(f => { const nm = f.properties.nm; if (!nm || !/residential|primary|secondary|tertiary|pedestrian|living_street|unclassified|trunk/.test(f.properties.hw)) return; const gm = f.geometry; const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : []; const e2 = byName.get(nm) || { nm, len: 0, hit: new Set(), lines: [] };
    ls.forEach(l => { const pts = l.map(p => { const q = U(p); return [X(q[0]), Y(q[1])]; }); e2.lines.push(pts.map(z => [r1(z[0]), r1(z[1])])); for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); e2.len += L * mpp; const n = Math.max(1, Math.ceil(L)); for (let t = 0; t <= n; t++) { const px = a[0] + (b[0] - a[0]) * t / n, py = a[1] + (b[1] - a[1]) * t / n;
      for (let gx = Math.floor((px - R) / 5); gx <= Math.floor((px + R) / 5); gx++) for (let gy = Math.floor((py - R) / 5); gy <= Math.floor((py + R) / 5); gy++) (GR.get(gx + ',' + gy) || []).forEach(si => { if (Math.hypot(shops[si][0] - px, shops[si][1] - py) <= R) e2.hit.add(si); }); } } }); byName.set(nm, e2); });
  out.streets = [...byName.values()].filter(e2 => e2.len >= 250 && e2.hit.size >= 20).map(e2 => ({ nm: e2.nm, len: Math.round(e2.len), n: e2.hit.size, per100: Math.round(e2.hit.size / e2.len * 1000) / 10, lines: e2.lines })).sort((a, b) => b.per100 - a.per100).slice(0, 6);
  // 4 movement: the 20 busiest bus stops by scheduled departures on 26 Oct 2026
  const bus = await GA.data.single('bus_service'); out.stops = bus.features.map(f => { const q = U(f.geometry.coordinates); return { x: r1(X(q[0])), y: r1(Y(q[1])), t: f.properties.trips_day || 0, nm: f.properties.stop_name, routes: f.properties.routes_count }; }).filter(s => inF(s.x, s.y) && s.t > 0).sort((a, b) => b.t - a.t).slice(0, 20);
  out.busTotal = bus.features.length;
  // 5 meeting places: squares and parks (OSM) as slabs, markets as blocks
  const H = D.human; const poly = (a) => a.p.map(r => r.map(p => [r1(X(p[0])), r1(Y(p[1]))]));
  out.squares = (H.areas.square || []).map(poly); out.parks = (H.areas.park || []).map(poly); out.markets = (H.points.market || []).map(p => [r1(X(p[0])), r1(Y(p[1]))]).filter(p => inF(p[0], p[1]));
  // 6 tourism: hotels and tourist accommodation (OSM) as boxes
  const stay = await GA.data.single('fac_stay'); out.hotels = stay.features.map(f => { const q = U(f.geometry.coordinates); return [r1(X(q[0])), r1(Y(q[1]))]; }).filter(p => inF(p[0], p[1]));
  out.whc = D.centre.whc.filter(w => w.name !== 'Generalife').map(w => { const gm = w.geometry; let c; if (gm.type === 'Point') c = gm.coordinates; else { const r = gm.coordinates[0]; c = [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; } return { name: w.name, x: r1(X(c[0])), y: r1(Y(c[1])) }; });
  out.meta = { reach: H.stats.reach_pct, squares: H.stats.squares, parks: H.stats.parks, shops: shops.length };
  return out;
}'''
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=120000)
        R = pg.evaluate(JS); b.close()
finally:
    srv.terminate()
g = Image.open(io.BytesIO(base64.b64decode(R.pop('ground').split(',')[1])))
flat = Image.new('RGB', g.size, (255, 255, 255)); flat.paste(g.convert('RGB'), (0, 0), g.split()[3]); flat.convert('L').save(f'{OUT}/human_ground.png', optimize=True)
R['sources'] = {'residents': 'JRC GHS-POP R2023A, 2020 (modelled), CC BY 4.0', 'shops, streets, squares, parks, markets, hotels': 'OpenStreetMap, ODbL 1.0',
                'bus': 'stop-level schedule of 26 Oct 2026 supplied by the user (GTFS-derived; licence of the feed not stated)'}
R['built'] = time.strftime('%Y-%m-%d')
json.dump(R, open(f'{OUT}/human_art.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('residents', len(R['residents']), 'peaks', len(R['peaks']), 'streets', [s['nm'] for s in R['streets']], 'stops', len(R['stops']), 'hotels', len(R['hotels']), {f: os.path.getsize(f'{OUT}/{f}') for f in ['human_ground.png', 'human_art.json']})
