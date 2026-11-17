"""Exercise 2.1 — Granada on one A1 sheet at TRUE 1:25,000 (owner, 17 Nov 2026: "a map like this one on A1 at 500 dpi, a big
title Granada, the scale bar without a background, show the base and the five towns").
Frame (EPSG:25830) 435,650–455,600 × 4,106,000–4,120,350 m = 798 × 574 mm at 1:25,000, on an A1 sheet (841 × 594 mm).
Layers: terrain (tools/build_ex21_granada_terrain.py → exports/ex21_granada/terrain.png: IGN MDT25 tint + hillshade),
20 m contours (IGN MDT25), land use and parks, rivers and streams, streets and roads by class, buildings by floors
(OpenStreetMap), municipal boundaries (es-atlas / IGN), the Armilla Air Base (OSM) and the five towns' built-up cores
(OSM land use, data/vec/tour_towns.json), names of the municipalities at the centre of their buildings in the frame.
The page is drawn in horizontal strips (a 500 dpi A1 is 16,559 × 11,693 px) and joined in Python.
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/granada_a1.py <out folder> [en|he|ar]   (env DPI, default 500)"""
import sys, time, base64, subprocess, os, io
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; DPI = float(os.environ.get('DPI', 500)); PORT = 8860; V3.PORT = PORT; V3.V2.PORT = PORT
STRIPS = int(os.environ.get('STRIPS', 8))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
LOAD = r'''async () => { if (window.__G) return true; const P = GA.proj.EPSG25830; const FR = [435650, 4106000, 455600, 4120350];
  const ll0 = P.inverse([FR[0] - 300, FR[1] - 300]), ll1 = P.inverse([FR[2] + 300, FR[3] + 300]); const bb = [ll0[0], ll0[1], ll1[0], ll1[1]];
  const U = (c) => P.forward(c); const rings = (g) => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : g.type === 'LineString' ? [[g.coordinates]] : g.type === 'MultiLineString' ? g.coordinates.map(l => [l]) : [];
  const pj = (f) => rings(f.geometry).map(pg => pg.map(r => r.map(U)));
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = '/exports/ex21_granada/terrain.png?r=' + Date.now(); });
  const [bld, st, lu, pk, wa, co, edge, towns, area] = await Promise.all([GA.data.chunked('buildings', bb, 0, 2000), GA.data.chunked('streets', bb, 0, 2000), GA.data.single('landuse_overview'), GA.data.chunked('parks', bb, 0, 2000),
    GA.data.single('water'), GA.data.single('contours_20m'), GA.data.single('base_edge'), GA.data.single('tour_towns'), GA.data.single('tour_area')]);
  const inb = (f) => { const c = f.geometry.coordinates; const flat = JSON.stringify(c).match(/-?\d+\.\d+/g); return !!flat; };
  window.__G = { FR, img, bld: bld.map(f => ({ lv: f.properties.lv, g: pj(f) })), st: st.map(f => ({ hw: f.properties.hw, tu: f.properties.tu, g: pj(f) })),
    lu: lu.features.filter(f => f.geometry).map(f => ({ lu: f.properties.lu, g: pj(f) })), pk: pk.map(f => ({ le: f.properties.le, g: pj(f) })),
    wa: wa.features.map(f => ({ ww: f.properties.ww, nm: f.properties.nm, g: pj(f) })), co: co.features.map(f => ({ e: f.properties.elev, g: pj(f) })),
    base: edge.features.filter(f => f.properties.k === 'base').map(pj)[0], towns: towns.features.map(f => ({ nm: f.properties.nm, g: pj(f) })),
    area: area.features.map(f => ({ nm: f.properties.name, five: f.properties.five, g: pj(f) })) };
  return [bld.length, st.length]; }'''
DRAW = r'''async ([DPI, y0, hS, LANG]) => { const G = window.__G, pal = GA.palette, C = pal.ex21; const D = DPI / 25.4, mm = (v) => v * D; const F = GA.pages.font(); const t = (k, v) => GA.i18n.t(k, v); const rtl = GA.i18n.dir() === 'rtl';
  const W = Math.round(mm(841)), H = Math.round(mm(594)); const c = document.createElement('canvas'); c.width = W; c.height = hS; const x = c.getContext('2d'); x.translate(0, -y0);
  x.fillStyle = '#FFFFFF'; x.fillRect(0, y0, W, hS);
  // the map frame: true 1:25,000 (1 m = 0.04 mm)
  const FR = G.FR, mapW = (FR[2] - FR[0]) / 25, mapH = (FR[3] - FR[1]) / 25, MX = mm((841 - mapW) / 2), MY = mm((594 - mapH) / 2), s = mm(1) / 25;   // px per metre
  const X = (u) => MX + (u - FR[0]) * s, Y = (v) => MY + (FR[3] - v) * s;
  const path = (g, close) => { x.beginPath(); g.forEach(pg => pg.forEach(r => { r.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); if (close) x.closePath(); })); };
  // cull what is outside this strip
  const sy0 = y0 - mm(20), sy1 = y0 + hS + mm(20); const vis = (g) => { for (const pg of g) for (const r of pg) for (const p of r) { const v = Y(p[1]); if (v >= sy0 && v <= sy1) return true; } return false; };
  x.save(); x.beginPath(); x.rect(MX, MY, mm(mapW), mm(mapH)); x.clip(); x.lineJoin = 'round'; x.lineCap = 'round';
  // 1 terrain
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(G.img, MX, MY, mm(mapW), mm(mapH));
  // 2 parks only, very light (owner, 17 Nov: no extra details)
  G.pk.forEach(p => { if (!vis(p.g) || p.le !== 'park') return; path(p.g, true); x.globalAlpha = 0.18; x.fillStyle = pal.olive; x.fill('evenodd'); x.globalAlpha = 1; });
  // 3 contours every 20 m, index every 100 m
  G.co.forEach(l => { if (!vis(l.g)) return; const ix = l.e % 100 === 0; path(l.g); x.strokeStyle = ix ? 'rgba(116,54,45,.32)' : 'rgba(116,54,45,.16)'; x.lineWidth = mm(ix ? 0.14 : 0.07); x.stroke(); });
  // 4 water
  G.wa.forEach(l => { if (!vis(l.g)) return; const big = l.ww === 'river'; path(l.g); x.strokeStyle = pal.base.lightBlue; x.lineWidth = mm(big ? 0.9 : l.ww === 'canal' ? 0.35 : 0.25); x.stroke(); });
  // 5 streets: minor under major, white casing on main roads
  const cls = (hw) => /^(motorway|trunk)/.test(hw) ? 1 : /^(primary)/.test(hw) ? 2 : /^(secondary|tertiary)/.test(hw) ? 3 : /^(residential|living_street|unclassified|pedestrian|service)$/.test(hw) ? 4 : /^(track)$/.test(hw) ? 5 : /^(footway|path|cycleway|steps|bridleway)$/.test(hw) ? 6 : 0;
  const W5 = { 1: 1.15, 2: 0.85, 3: 0.55, 4: 0.22, 5: 0.14, 6: 0.1 };
  [4].forEach(k0 => { x.beginPath(); G.st.forEach(st => { if (cls(st.hw) !== k0 || !vis(st.g)) return; st.g.forEach(pg => pg.forEach(r => r.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))))); });
    x.strokeStyle = k0 === 4 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.7)'; x.lineWidth = mm(W5[k0]); x.setLineDash(k0 === 6 ? [mm(0.5), mm(0.4)] : []); x.stroke(); x.setLineDash([]); });
  [3, 2, 1].forEach(k0 => { const sel = G.st.filter(st => cls(st.hw) === k0 && vis(st.g)); const draw = (wd, col) => { x.beginPath(); sel.forEach(st => st.g.forEach(pg => pg.forEach(r => r.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1])))))); x.strokeStyle = col; x.lineWidth = mm(wd); x.stroke(); };
    draw(W5[k0] + 0.3, '#FFFFFF'); draw(W5[k0], k0 === 3 ? pal.rose : pal.red); });
  // 6 buildings by floors (OSM building:levels; no count = the lightest)
  const band = pal.band; const bcol = (lv) => lv == null ? band['1-2'] : lv <= 2 ? band['1-2'] : lv <= 4 ? band['3-4'] : lv <= 8 ? band['5-8'] : band['9+'];
  ['1-2', '3-4', '5-8', '9+'].forEach(bk => { x.beginPath(); G.bld.forEach(b => { const lv = b.lv; const k1 = lv == null || lv <= 2 ? '1-2' : lv <= 4 ? '3-4' : lv <= 8 ? '5-8' : '9+'; if (k1 !== bk || !vis(b.g)) return; b.g.forEach(pg => pg.forEach(r => { r.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); x.closePath(); })); });
    x.fillStyle = band[bk]; x.fill('evenodd'); x.strokeStyle = 'rgba(90,29,34,.35)'; x.lineWidth = mm(0.05); x.stroke(); });
  // 7 municipal boundaries
  G.area.forEach(a => { if (!vis(a.g)) return; path(a.g, true); x.strokeStyle = 'rgba(41,16,12,.45)'; x.lineWidth = mm(0.25); x.setLineDash([mm(2.2), mm(1.2), mm(0.4), mm(1.2)]); x.stroke(); x.setLineDash([]); });
  // 8 the five towns' built-up cores: a dark outline
  G.towns.forEach(tn => { path(tn.g, true); x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(1.2); x.stroke(); x.strokeStyle = pal.base.wine; x.lineWidth = mm(0.6); x.setLineDash([mm(2.4), mm(1.1)]); x.stroke(); x.setLineDash([]); });
  // 9 the base
  if (G.base) { path(G.base, true); x.globalAlpha = 0.55; x.fillStyle = C.base; x.fill('evenodd'); x.globalAlpha = 1; x.strokeStyle = C.base; x.lineWidth = mm(0.45); x.stroke(); }
  // 10 names: the five towns big, other municipalities smaller, at the centre of their buildings inside the frame; the base
  const halo = (s0, px, py, sz, wt, col) => { x.font = `${wt} ${Math.round(mm(sz))}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = mm(sz * 0.28); x.strokeText(s0, px, py); x.fillStyle = col; x.fillText(s0, px, py); };
  if (!window.__lab) { const inside = (pt, g) => { let ins = false; g.forEach(pg => pg.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } })); return ins; };
    const acc = G.area.map(() => [0, 0, 0]); G.bld.forEach(b => { const r = b.g[0] && b.g[0][0]; if (!r) return; const p = r[0]; if (p[0] < FR[0] || p[0] > FR[2] || p[1] < FR[1] || p[1] > FR[3]) return; for (let i = 0; i < G.area.length; i++) if (inside(p, G.area[i].g)) { acc[i][0] += p[0]; acc[i][1] += p[1]; acc[i][2]++; break; } });
    window.__lab = G.area.map((a, i) => acc[i][2] > 150 ? { nm: a.nm, five: a.five, p: [acc[i][0] / acc[i][2], acc[i][1] / acc[i][2]] } : null).filter(Boolean); }
  window.__lab.forEach(l => { if (l.five) return; const big = l.nm === 'Granada'; halo(big ? l.nm.toUpperCase() : l.nm, X(l.p[0]), Y(l.p[1]), big ? 9 : 4.2, big ? 700 : 600, big ? pal.ink : pal.ink2); });
  G.towns.forEach(tn => { let n = 0, a = 0, b = 0; tn.g.forEach(pg => pg[0].forEach(p => { a += p[0]; b += p[1]; n++; })); halo(tn.nm.toUpperCase(), X(a / n), Y(b / n), 6, 700, pal.base.wine); });
  if (G.base) { let A = 0, a = 0, b = 0; G.base.forEach(pg => { const r = pg[0]; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const cr = r[j][0] * r[i][1] - r[i][0] * r[j][1]; A += cr; a += (r[j][0] + r[i][0]) * cr; b += (r[j][1] + r[i][1]) * cr; } }); a /= 3 * A; b /= 3 * A; const n = 1; x.font = `700 ${Math.round(mm(5.2))}px ${F}`; x.fillStyle = '#FFFFFF'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = rtl ? 'rtl' : 'ltr'; x.fillText(t('x34.base').toUpperCase(), X(a / n), Y(b / n) - mm(2.4)); x.font = `500 ${Math.round(mm(3.2))}px ${F}`; x.direction = 'ltr'; x.fillText('3.71 km²', X(a / n), Y(b / n) + mm(3.4)); }
  x.restore(); x.strokeStyle = pal.ink; x.lineWidth = mm(0.35); x.strokeRect(MX, MY, mm(mapW), mm(mapH));
  // 11 title (grey, big, a soft glow, no plate), north arrow, scale bar without a background, credit
  const glow = (s0, px, py, sz, wt, col, al) => { x.save(); x.font = `${wt} ${Math.round(mm(sz))}px ${F}`; x.textAlign = al; x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.lineJoin = 'round'; x.shadowColor = '#FFFFFF'; x.shadowBlur = mm(sz * 0.35); x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(sz * 0.12); for (let i = 0; i < 5; i++) x.strokeText(s0, px, py); x.shadowBlur = 0; x.shadowColor = 'transparent'; x.fillStyle = col; x.fillText(s0, px, py); x.restore(); };
  const TX = rtl ? MX + mm(mapW) - mm(8) : MX + mm(8), AL = rtl ? 'right' : 'left';
  const plain = (s0, py, sz, wt) => { x.save(); x.font = `${wt} ${Math.round(mm(sz))}px ${F}`; x.textAlign = AL; x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr'; x.fillStyle = pal.ink3; x.fillText(s0, TX, py); x.restore(); };
  plain(t('x40.title'), MY + mm(30), 26, 700); plain(t('x40.sub'), MY + mm(41), 7, 600);
  const nx = rtl ? MX + mm(14) : MX + mm(mapW) - mm(14); x.save(); x.shadowColor = '#FFFFFF'; x.shadowBlur = mm(1.5); GA.pages.northArrow(x, nx, MY + mm(9), mm(0.42)); x.restore(); GA.pages.northArrow(x, nx, MY + mm(9), mm(0.42));
  // scale bar: 0 – 500 – 1,000 – 2,500 m, true length (2,500 m = 100 mm), the ratio above it; grey, a white halo, no plate
  const bx = MX + mm(10), by = MY + mm(mapH) - mm(12), km = mm(100), seg = [[0, 500], [1000, 1500], [2000, 2500]]; x.save();
  x.lineJoin = 'round'; x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(0.9); x.strokeRect(bx, by, km, mm(2)); x.fillStyle = pal.ink3; seg.forEach(([a, b]) => x.fillRect(bx + km * a / 2500, by, km * (b - a) / 2500, mm(2))); x.strokeStyle = pal.ink3; x.lineWidth = mm(0.25); x.strokeRect(bx, by, km, mm(2));
  x.font = `600 ${Math.round(mm(3.4))}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.direction = 'ltr';
  [['0', 0], ['500', 500], ['1,000', 1000], ['2,500 m', 2500]].forEach(([s0, v]) => { const px = bx + km * v / 2500; x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(1); x.strokeText(s0, px, by - mm(1.6)); x.fillStyle = pal.ink3; x.fillText(s0, px, by - mm(1.6)); });
  x.font = `700 ${Math.round(mm(4.6))}px ${F}`; x.textAlign = 'left'; x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(1.2); x.strokeText('1:25,000', bx, by - mm(7.5)); x.fillStyle = pal.ink3; x.fillText('1:25,000', bx, by - mm(7.5));
  x.font = `500 ${Math.round(mm(2.4))}px ${F}`; x.textAlign = 'right'; x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(0.7); const cr = 'OpenStreetMap contributors (ODbL) · IGN MDT25 (CC BY 4.0) · es-atlas / IGN (CC BY 4.0) · A1, 1:25,000';
  x.strokeText(cr, MX + mm(mapW) - mm(5), MY + mm(mapH) - mm(4)); x.fillStyle = pal.ink3; x.fillText(cr, MX + mm(mapW) - mm(5), MY + mm(mapH) - mm(4)); x.restore();
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return [W, H, btoa(bin)]; }'''
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data && GA.proj', timeout=90000)
    for s in ['js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.pages)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    print('loaded', pg.evaluate(LOAD), flush=True)
    H = round(594 * DPI / 25.4); hs = -(-H // STRIPS); parts = []
    for i in range(STRIPS):
      y0 = i * hs; h = min(hs, H - y0)
      W, Ht, d = pg.evaluate(DRAW, [DPI, y0, h, LANG]); parts.append(Image.open(io.BytesIO(base64.b64decode(d))).convert('RGB')); print('strip', i, parts[-1].size, flush=True)
    out = Image.new('RGB', (W, H), 'white'); y = 0
    for im in parts: out.paste(im, (0, y)); y += im.size[1]
    os.makedirs(OUTD, exist_ok=True); fn = os.path.join(OUTD, f'granada_A1_1-25000_{LANG}.png'); out.save(fn, dpi=(DPI, DPI), compress_level=6); print('saved', fn, out.size)
    print('errors:', errs[:5])
finally: srv.terminate()
