"""Build the assets of the Exercise 1.3 climate map in the artistic language (build 5.27): four layers of the shared frame
— terrain (IGN MDT25 tint × hillshade), summer vegetation (Landsat NDVI), buildings (OSM figure-ground), summer land
surface temperature (Landsat, the atlas classes) — each draped over the real terrain in an axonometric view from the
south-west (relief exaggerated, the factor stored), with the built-city edge. The page stacks them.
  data/ex13/art/climate_{terrain,veg,built,heat,edge}.png   draped layers (transparent, 1000 × 640)
  data/ex13/art/climate_art.json                            values for the legend, the drape geometry and the exaggeration
Run from the repository root after tools/build_ex13_art.py: python3 tools/build_ex13_climate_art.py   (Playwright, numpy)."""
import base64, io, json, os, subprocess, sys, tempfile, time
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, 'data/ex13/art'); PORT = 8833
D = tempfile.mkdtemp()
JS = r'''async () => { await GA.ex13.load();
  const D = GA.ex13.data, F = D.frame, P = GA.palette, B = P.base, S = 600, mpp = (F.x1 - F.x0) / S;
  const X = (u) => (u - F.x0) / mpp, Y = (v) => (F.y1 - v) / mpp;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; };
  const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const ramp = (stops, v) => { let i = 0; while (i < stops.length - 2 && v > stops[i + 1][0]) i++; const a = stops[i], b = stops[i + 1]; return lerp(P.rgb(a[1]), P.rgb(b[1]), Math.max(0, Math.min(1, (v - a[0]) / (b[0] - a[0])))); };
  const out = {}, stats = {};
  // 1 terrain: elevation tint × hillshade (IGN MDT25)
  const dem = await GA.data.grid('dem'); { const [c, x] = mk(); const im = x.createImageData(S, S); const h = new Float32Array(S * S); let lo = 1e9, hi = -1e9;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const v = GA.data.sampleGrid(dem, F.x0 + (i + 0.5) * mpp, F.y1 - (j + 0.5) * mpp) ?? 0; h[j * S + i] = v; if (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    const stops = [[560, '#E4E5D3'], [650, '#D6CDA6'], [800, '#BFA97A'], [1000, '#9C7A55'], [1300, '#74362D']];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const v = h[j * S + i]; const dx = (h[j * S + Math.min(S - 1, i + 1)] - h[j * S + Math.max(0, i - 1)]) / (2 * mpp), dy = (h[Math.min(S - 1, j + 1) * S + i] - h[Math.max(0, j - 1) * S + i]) / (2 * mpp);
      const nx = -dx * 2.5, ny = -dy * 2.5, nz = 1, len = Math.hypot(nx, ny, nz); const sh = Math.max(0, (nx * -0.6 + ny * -0.6 + nz * 0.53) / len); const col = ramp(stops, v); const k = 0.62 + 0.55 * sh; const o = (j * S + i) * 4;
      im.data[o] = Math.min(255, col[0] * k); im.data[o + 1] = Math.min(255, col[1] * k); im.data[o + 2] = Math.min(255, col[2] * k); im.data[o + 3] = 255; }
    x.putImageData(im, 0, 0); out.terrain = c.toDataURL('image/jpeg', 0.9); stats.elev = [Math.round(lo), Math.round(hi)]; }
  // 2 vegetation: summer median NDVI (Landsat, 90 m blocks)
  { const [c, x] = mk(); x.fillStyle = '#F6F5F0'; x.fillRect(0, 0, S, S); const g = D.climate.grid, V = D.climate.ndvi, cw = g.cell / mpp; const cls = [[0.2, '#E4E5D3'], [0.3, '#BFB065'], [0.4, '#7E7B43'], [0.55, '#53461C']]; let nv = 0, nt = 0;
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) { const v = V[j][i]; if (v == null) continue; nt++; if (v >= 0.4) nv++; let col = null; cls.forEach(([t, cc]) => { if (v >= t) col = cc; }); if (!col) continue; x.fillStyle = col; x.fillRect(i * cw, j * cw, cw + 0.5, cw + 0.5); }
    out.veg = c.toDataURL('image/jpeg', 0.9); stats.vegShare = Math.round(nv / nt * 100); }
  // 3 built: figure-ground (OSM footprints)
  { const [c, x] = mk(); x.fillStyle = '#F6F5F0'; x.fillRect(0, 0, S, S); const g = D.fgm; const t = document.createElement('canvas'); t.width = t.height = S; const tx = t.getContext('2d'); tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
    tx.drawImage(D.fgImg, (F.x0 - g.ox) / g.px_m, (g.oy - F.y1) / g.px_m, (F.x1 - F.x0) / g.px_m, (F.x1 - F.x0) / g.px_m, 0, 0, S, S); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = '#29100C'; tx.fillRect(0, 0, S, S); x.drawImage(t, 0, 0);
    out.built = c.toDataURL('image/jpeg', 0.9); stats.cov = D.morphology.stats.coverage_frame_pct; }
  // 4 land surface temperature (Landsat, summer 2024–26), the atlas classes
  { const [c, x] = mk(); const g = D.climate.grid, L = D.climate.lst, br = D.climate.breaks, cols = P.ex13.lst, cw = g.cell / mpp;
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) { const v = L[j][i]; if (v == null) continue; x.fillStyle = cols[br.filter(b => v >= b).length]; x.fillRect(i * cw, j * cw, cw + 0.5, cw + 0.5); }
    out.heat = c.toDataURL('image/jpeg', 0.9); const s = D.climate.stats; stats.lst = { median: s.median_frame, dense: s.dense_built, veg: s.vegetated, bare: s.bare }; stats.breaks = br; stats.lstCols = cols; }
  // shared outline of built-up Granada for every plane
  const e = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data/ex13/art/centre_edge.png?v=' + GA_BUILD; }); { const [c, x] = mk(); x.drawImage(e, 0, 0, S, S); out.edge = c.toDataURL('image/png'); }
  return { out, stats };
}'''
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=120000)
        R = pg.evaluate(JS); b.close()
finally:
    srv.terminate()
for k, v in R['out'].items(): open(f'{D}/{k}' + ('.png' if v.startswith('data:image/png') else '.jpg'), 'wb').write(base64.b64decode(v.split(',')[1]))
fr = json.load(open(f'{ROOT}/data/ex13/frame.json')); m = json.load(open(f'{ROOT}/data/manifest.json'))['terrain']['dem']
dem = np.fromfile(f'{ROOT}/' + 'data/' + m['file'], dtype='<i2').reshape(m['height'], m['width']).astype(np.float32)
N = 600; mpp = (fr['x1'] - fr['x0']) / N
xs = fr['x0'] + (np.arange(N) + 0.5) * mpp; ys = fr['y1'] - (np.arange(N) + 0.5) * mpp
fx = (xs - m['ox']) / m['px'] - 0.5; fy = (m['oy'] - ys) / m['py'] - 0.5
X, Y = np.meshgrid(fx, fy); i0 = np.floor(X).astype(int); j0 = np.floor(Y).astype(int); a = X - i0; b = Y - j0
H = (dem[j0, i0] * (1 - a) * (1 - b) + dem[j0, i0 + 1] * a * (1 - b) + dem[j0 + 1, i0] * (1 - a) * b + dem[j0 + 1, i0 + 1] * a * b)
lo, hi = float(H.min()), float(H.max())
# hillshade (light from the north-west), exaggerated a little so the relief reads on every plane
gy, gx = np.gradient(H, mpp); nx, ny, nz = -gx * 2.2, gy * 2.2, np.ones_like(H); L = np.array([-0.6, 0.6, 0.55]); L /= np.linalg.norm(L)
shade = np.clip((nx * L[0] + ny * L[1] + nz * L[2]) / np.sqrt(nx * nx + ny * ny + nz * nz), 0, 1)
# view from the south-west: turn the plan 90° anticlockwise so its south-west corner becomes the near (bottom) corner
H = np.rot90(H).copy(); shade = np.rot90(shade).copy()
K = 0.76; Z = 0.26  # screen px per metre of height (relief exaggeration stated in the page)
W, HT = 1000, 640
u, v = np.meshgrid(np.arange(N), np.arange(N))
sx = (W / 2 + 0.866 * K * (u - v)); sy = (0.5 * K * (u + v) - (H - lo) * Z + (hi - lo) * Z + 12)
base_y = 0.5 * K * (u + v) + (hi - lo) * Z + 12  # the plane at the lowest height
order = np.argsort((u + v).ravel(), kind='stable')  # far (top) first, near last
def drape(name, strength=0.42):
    img = np.rot90(np.asarray(Image.open(f'{D}/{name}').convert('RGB').resize((N, N), Image.LANCZOS), dtype=np.float32)).copy()
    col = img * ((1 - strength) + strength * (0.55 + 0.75 * shade))[..., None]
    out = np.zeros((HT, W, 4), np.uint8)
    # skirt: the front edges dropped to a common base, darker
    for edge, SK in ((v == N - 1, (189, 181, 170)), (u == N - 1, (157, 148, 137))):  # two shades: the south and the east walls
        ee = np.where(edge)
        for y0, y1, x0, c in zip(sy[ee], base_y[ee] + 14, sx[ee], col[ee]):
            yy = np.arange(int(y0), int(y1)); xx = int(round(x0))
            if 0 <= xx < W: out[np.clip(yy, 0, HT - 1), xx, :3] = SK; out[np.clip(yy, 0, HT - 1), xx, 3] = 255
            if 0 <= xx + 1 < W: out[np.clip(yy, 0, HT - 1), xx + 1, :3] = SK; out[np.clip(yy, 0, HT - 1), xx + 1, 3] = 255
    X1 = np.round(sx.ravel()[order]).astype(int); Y1 = np.round(sy.ravel()[order]).astype(int); C = np.clip(col.reshape(-1, 3)[order], 0, 255).astype(np.uint8)
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):  # splat 2 × 2 so no holes
        xx = np.clip(X1 + dx, 0, W - 1); yy = np.clip(Y1 + dy, 0, HT - 1); out[yy, xx, :3] = C; out[yy, xx, 3] = 255
    # thin outline on the top edges for crispness
    Image.fromarray(out, 'RGBA').save(f'{OUT}/climate_{name.split(".")[0]}.png', optimize=True)
for n in ['heat.jpg', 'built.jpg', 'veg.jpg', 'terrain.jpg']: drape(n, 0.3 if n == 'terrain.jpg' else 0.45)
# the city edge, draped (ink where the edge image is opaque)
e = np.rot90(np.asarray(Image.open(f'{D}/edge.png').convert('RGBA').resize((N, N)), dtype=np.uint8)[..., 3] > 60).copy()
out = np.zeros((HT, W, 4), np.uint8); sel = e.ravel()[order]; X1 = np.round(sx.ravel()[order]).astype(int)[sel]; Y1 = np.round(sy.ravel()[order]).astype(int)[sel]
for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)): out[np.clip(Y1 + dy, 0, HT - 1), np.clip(X1 + dx, 0, W - 1)] = (41, 16, 12, 235)
Image.fromarray(out, 'RGBA').save(f'{OUT}/climate_edge.png', optimize=True)
hz = 0.5 * K * 1.0 * 0  # corner anchors (screen) of the four plane corners at the base, for the posts and labels
corners = {'n': [W / 2, float(base_y[0, 0])], 'e': [float(sx[0, -1]), float(base_y[0, -1])], 's': [W / 2, float(base_y[-1, -1])], 'w': [float(sx[-1, 0]), float(base_y[-1, 0])]}
json.dump({'W': W, 'H': HT, 'lo': lo, 'hi': hi, 'Z': Z, 'K': K, 'exag': round(Z / (K * 0.866 / mpp), 1), 'corners': corners, 'stats': R['stats'], 'sources': {'terrain': 'IGN MDT25, CC BY 4.0', 'vegetation, heat': 'Landsat 8/9 C2 L2 (USGS), summers 2024–2026, public domain', 'buildings': 'OpenStreetMap, ODbL 1.0'}, 'built': time.strftime('%Y-%m-%d')}, open(f'{OUT}/climate_art.json', 'w'), ensure_ascii=False)
print('relief', lo, hi, 'exaggeration ×', round(Z / (K * 0.866 / mpp), 1))
