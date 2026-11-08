"""Build the assets of the Exercise 1.3 city-centre map in the artistic language (build 5.23), all in the shared frame
(data/ex13/frame.json, EPSG:25830, 2000 px = 5 m per pixel):
  data/ex13/art/centre_base.jpg   grey street map of the whole frame: tones by built share (50 m, smoothed 250 m), OSM
                                  footprints, parks lighter, every OSM street in white
  data/ex13/art/centre_aerial.jpg PNOA orthophoto (IGN WMS, CC BY 4.0) in black and white, main streets in white
  data/ex13/art/centre_city.png   the built city: smoothed built share >= 12 % inside the municipality, largest piece (alpha)
  data/ex13/art/centre_edge.png   its outline
  data/ex13/art/centre_art.json   500 m cells whose commercial kernel reaches >= 500 places/km2 and touch the city
                                  (densest first), with method, sources and the city area
Run from the repository root: python3 tools/build_ex13_art.py   (needs Playwright + Chromium and access to www.ign.es)."""
import base64, io, json, os, subprocess, sys, time, urllib.request
from PIL import Image, ImageChops, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, 'data/ex13/art'); os.makedirs(OUT, exist_ok=True)
S, CELL, PORT = 2000, 500, 8831
fr = json.load(open(os.path.join(ROOT, 'data/ex13/frame.json')))
WMS = ('https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=OI.OrthoimageCoverage&STYLES=&CRS=EPSG:25830'
       f'&BBOX={fr["x0"]},{fr["y0"]},{fr["x1"]},{fr["y1"]}&WIDTH={S}&HEIGHT={S}&FORMAT=image/jpeg')
ortho = urllib.request.urlopen(WMS, timeout=120).read(); assert Image.open(io.BytesIO(ortho)).size == (S, S), 'PNOA WMS did not return the frame'
print('PNOA', len(ortho), 'bytes')

JS = r'''async ({ ortho, S, CELL }) => {
  await GA.ex13.load(); const D = GA.ex13.data, F = D.frame, mpp = (F.x1 - F.x0) / S, k = S / 1000;
  const X = (u) => (u - F.x0) / mpp, Y = (v) => (F.y1 - v) / mpp; const U = (ll) => GA.proj.EPSG25830.forward(ll);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = ortho; });
  const ll0 = GA.proj.EPSG25830.inverse([F.x0, F.y0]), ll1 = GA.proj.EPSG25830.inverse([F.x1, F.y1]);
  const streets = await GA.data.chunked('streets', [ll0[0], ll0[1], ll1[0], ll1[1]], 0, 400);
  const W = { motorway: 3.4, trunk: 3.2, primary: 2.6, secondary: 2.1, tertiary: 1.7, residential: 1, living_street: 0.9, unclassified: 0.9, pedestrian: 0.9, service: 0.5, footway: 0.4, path: 0.35, steps: 0.35, cycleway: 0.4, track: 0.4 };
  const MAIN = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified', 'pedestrian'];
  const drawStreets = (x, col, sc, only) => { x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round'; Object.entries(W).sort((a, b) => a[1] - b[1]).forEach(([hw, w]) => { if (only && !only.includes(hw)) return; x.lineWidth = w * k * sc; x.beginPath();
    streets.forEach(ft => { if (ft.properties.hw !== hw) return; const gm = ft.geometry; const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : []; ls.forEach(l => l.forEach((p, i) => { const q = U(p); i ? x.lineTo(X(q[0]), Y(q[1])) : x.moveTo(X(q[0]), Y(q[1])); })); }); x.stroke(); }); };
  // built share, 50 m cells, from the 4 m raster at its own pixels
  const g = D.fgm, R = Math.round((F.x1 - F.x0) / g.px_m); const rc = document.createElement('canvas'); rc.width = rc.height = R; const rx = rc.getContext('2d', { willReadFrequently: true }); rx.imageSmoothingEnabled = false;
  rx.drawImage(D.fgImg, (F.x0 - g.ox) / g.px_m, (g.oy - F.y1) / g.px_m, R, R, 0, 0, R, R); const A = rx.getImageData(0, 0, R, R).data;
  const n = Math.round((F.x1 - F.x0) / 50), kk = R / n; const cov = new Float32Array(n * n); for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) if (A[(j * R + i) * 4 + 3] > 127) cov[Math.floor(j / kk) * n + Math.floor(i / kk)]++; for (let t = 0; t < n * n; t++) cov[t] /= kk * kk;
  const blur = (a, r) => { const o = new Float32Array(n * n), tmp = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let d = -r; d <= r; d++) { const ii = i + d; if (ii < 0 || ii >= n) continue; s += a[j * n + ii]; c++; } tmp[j * n + i] = s / c; }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let d = -r; d <= r; d++) { const jj = j + d; if (jj < 0 || jj >= n) continue; s += tmp[jj * n + i]; c++; } o[j * n + i] = s / c; } return o; };
  const sm = blur(blur(cov, 5), 5);
  // the city shape
  const [mc, mx] = mk(); const im = new ImageData(n, n); for (let t = 0; t < n * n; t++) if (sm[t] >= 0.12) im.data[t * 4 + 3] = 255;
  const tc = document.createElement('canvas'); tc.width = tc.height = n; tc.getContext('2d').putImageData(im, 0, 0); mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high'; mx.drawImage(tc, 0, 0, S, S);
  const md = mx.getImageData(0, 0, S, S).data; const on = new Uint8Array(S * S); for (let t = 0; t < S * S; t++) on[t] = md[t * 4 + 3] > 127 ? 1 : 0;
  const [uc, ux] = mk(); ux.beginPath(); D.muni.forEach(r => r.forEach((p, i) => i ? ux.lineTo(X(p[0]), Y(p[1])) : ux.moveTo(X(p[0]), Y(p[1])))); ux.fillStyle = '#000'; ux.fill('evenodd'); const ud = ux.getImageData(0, 0, S, S).data; for (let t = 0; t < S * S; t++) if (ud[t * 4 + 3] < 128) on[t] = 0;
  const lab = new Int32Array(S * S); let best = 0, bestN = 0, id = 0; const st = [];
  for (let s = 0; s < S * S; s++) { if (!on[s] || lab[s]) continue; id++; let cnt = 0; lab[s] = id; st.push(s); while (st.length) { const t = st.pop(); cnt++; const i = t % S, j = (t - i) / S; if (i > 0 && on[t - 1] && !lab[t - 1]) { lab[t - 1] = id; st.push(t - 1); } if (i < S - 1 && on[t + 1] && !lab[t + 1]) { lab[t + 1] = id; st.push(t + 1); } if (j > 0 && on[t - S] && !lab[t - S]) { lab[t - S] = id; st.push(t - S); } if (j < S - 1 && on[t + S] && !lab[t + S]) { lab[t + S] = id; st.push(t + S); } } if (cnt > bestN) { bestN = cnt; best = id; } }
  const city = new Uint8Array(S * S); const mi = mx.createImageData(S, S); for (let t = 0; t < S * S; t++) if (lab[t] === best) { city[t] = 1; mi.data[t * 4 + 3] = 255; }
  const [kc, kx] = mk(); kx.putImageData(mi, 0, 0);
  // decorated grey base (whole frame)
  const [bc, bx] = mk(); bx.fillStyle = '#E9E6DF'; bx.fillRect(0, 0, S, S); const tones = [[0.08, '#DFDBD2'], [0.2, '#D3CEC4'], [0.35, '#C7C1B5'], [0.5, '#B9B2A5']]; const cp = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = sm[j * n + i]; let col = null; tones.forEach(([th, c]) => { if (v >= th) col = c; }); if (col) { bx.fillStyle = col; bx.fillRect(i * cp, j * cp, cp + 1, cp + 1); } }
  (D.human.areas.park || []).forEach(a => { bx.beginPath(); a.p.forEach(r => r.forEach((p, i) => i ? bx.lineTo(X(p[0]), Y(p[1])) : bx.moveTo(X(p[0]), Y(p[1])))); bx.fillStyle = '#F4F2EC'; bx.fill('evenodd'); });
  const fp = document.createElement('canvas'); fp.width = fp.height = S; const fx = fp.getContext('2d'); fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = 'high'; fx.drawImage(rc, 0, 0, S, S); fx.globalCompositeOperation = 'source-in'; fx.fillStyle = '#8C857B'; fx.fillRect(0, 0, S, S); bx.globalAlpha = 0.55; bx.drawImage(fp, 0, 0); bx.globalAlpha = 1;
  drawStreets(bx, '#FFFFFF', 1);
  // black-and-white aerial, main streets in white
  const [ac, ax] = mk(); ax.filter = 'grayscale(1) contrast(1.45) brightness(0.82)'; ax.drawImage(img, 0, 0, S, S); ax.filter = 'none'; drawStreets(ax, 'rgba(255,255,255,.85)', 0.75, MAIN);
  // 500 m cells: commercial kernel maximum; keep those reaching 500 / km² that touch the city
  const z = D.centre.z, cg = D.centre.grid, N = Math.round((F.x1 - F.x0) / CELL); const vmax = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let j = 0; j < cg.n; j++) for (let i = 0; i < cg.n; i++) { const u = cg.x0 + (i + 0.5) * cg.cell, w = cg.y1 - (j + 0.5) * cg.cell; const ci = Math.floor((u - F.x0) / CELL), cj = Math.floor((F.y1 - w) / CELL); if (ci >= 0 && cj >= 0 && ci < N && cj < N) vmax[cj][ci] = Math.max(vmax[cj][ci], z[j][i]); }
  const C = S / N; const touches = (i, j) => { for (let a = 0; a < C; a += 4) for (let b = 0; b < C; b += 4) if (city[Math.floor(j * C + b) * S + Math.floor(i * C + a)]) return true; return false; };
  const tiles = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (vmax[j][i] >= 500 && touches(i, j)) tiles.push([i, j, Math.round(vmax[j][i])]); tiles.sort((a, b) => b[2] - a[2]);
  const outside = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (vmax[j][i] >= 500 && !touches(i, j)) outside.push([i, j, Math.round(vmax[j][i])]);
  return { base: bc.toDataURL('image/jpeg', 0.88), aerial: ac.toDataURL('image/jpeg', 0.85), city: kc.toDataURL('image/png'), tiles, outside, N, cityKm2: bestN * mpp * mpp / 1e6, streets: streets.length };
}'''
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=120000)
        R = pg.evaluate(JS, {'ortho': 'data:image/jpeg;base64,' + base64.b64encode(ortho).decode(), 'S': S, 'CELL': CELL})
        b.close()
finally:
    srv.terminate()
dec = lambda s: base64.b64decode(s.split(',')[1])
open(f'{OUT}/centre_base.jpg', 'wb').write(dec(R['base'])); open(f'{OUT}/centre_aerial.jpg', 'wb').write(dec(R['aerial']))
city = Image.open(io.BytesIO(dec(R['city']))).split()[3]
Image.merge('LA', (Image.new('L', city.size, 0), city)).save(f'{OUT}/centre_city.png', optimize=True)
edge = ImageChops.subtract(city, city.filter(ImageFilter.MinFilter(5))).point(lambda v: 235 if v > 100 else 0)
Image.merge('LA', (Image.new('L', city.size, 98), edge)).save(f'{OUT}/centre_edge.png', optimize=True)
meta = {'frame_px': S, 'cell_m': CELL, 'grid_n': R['N'], 'tiles': R['tiles'], 'tiles_outside_city': R['outside'], 'city_km2': round(R['cityKm2'], 1),
        'method': {'city': 'built share of OSM footprints (4 m raster) per 50 m cell, box-smoothed twice over 250 m; >= 12 % inside the municipality; largest connected piece',
                   'tiles': '500 m cells whose commercial kernel (r = 300 m, data/ex13/centre.json) reaches >= 500 places/km2 somewhere inside the cell and that touch the city; densest first',
                   'base': 'tones by smoothed built share, OSM footprints, OSM parks lighter, every OSM street white', 'aerial': 'PNOA orthophoto, grayscale, contrast 1.45, brightness 0.82, main OSM streets in white'},
        'sources': {'aerial': 'PNOA (Plan Nacional de Ortofotografía Aérea), © Instituto Geográfico Nacional — WMS pnoa-ma, CC BY 4.0', 'streets': f'OpenStreetMap ({R["streets"]} ways in the frame), ODbL 1.0', 'buildings': 'OpenStreetMap buildings (figure-ground raster, 23 Oct 2026), ODbL 1.0'},
        'built': time.strftime('%Y-%m-%d')}
json.dump(meta, open(f'{OUT}/centre_art.json', 'w'), ensure_ascii=False, indent=1)
print('tiles', len(R['tiles']), 'outside the city', len(R['outside']), 'city km2', meta['city_km2'], {f: os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT)})
