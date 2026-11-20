/* Exercise 2.1 — Scale (build 5.42). The phenomenon chosen by the owner's pair: the Base Aérea de Armilla as a closed
   island in the middle of the fastest-growing part of the agglomeration. Three scales; this file draws the CITY level:
   the five southern towns at 1:10,000 (agreed with the owner: 1:5,000 does not fit an A1 sheet for this area).
   Layers (all data already in the atlas, plus the Ministry of Defence easements):
   - municipalities (INE / es-atlas via tour_area) with the residents' change 2015 → 2025 (INE);
   - built footprints (OSM buildings) and main streets (OSM);
   - the base (OSM way 130984030, 371 ha) as a closed solid, the runway from RD 118/2019 art. 3 thresholds;
   - the 300 m band (as in the tour, quoted from the 1981 BOE; to be confirmed) and the fence by what lies outside it;
   - dead ends at the fence and the two walking detours (OSM network, tools/build_base_edge.py);
   - the metro line 1 southern extension under construction (OSM);
   - the aeronautical height limits: allowed height above ground where < 60 m (data/ex21, tools/build_ex21_easements.py,
     "Origen de los datos: Ministerio de Defensa"; an approximation, not the legal value).
   GA.ex21 = { ready(), drawCity(ctx, x, y, w, h, o), cityLegend(t), CITY } */
(function (root) {
  const CITY = { x0: 440100, y0: 4106400, x1: 446500, y1: 4112000 }; // 6.4 × 5.6 km → 640 × 560 mm at 1:10,000
  const RUNWAY = [[-3.635537, 37.139086], [-3.636024, 37.127378]]; // thresholds 18 and 36 (RD 118/2019 art. 3, ETRS89)
  // areas are written in km² (owner request, 15 Nov 2026: "nobody reads hectares"); 1 ha = 0.01 km²
  const km2 = (ha) => { const v = (ha || 0) / 100; return v >= 10 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3); };
  let D = null, Dp = null;
  const P = () => root.GA.palette;
  // ---------- PRINT STYLES (owner, 20 Nov 2026) ----------
  // 'analysis' = black, greys and white with ONE red per map for the thing the map is about (js/palette.js P.analysis; after reference
  // sheets the owner liked — the manner only). setStyle('analysis') lays that group over GA.palette for everything drawn afterwards;
  // setStyle(null) gives the identity palette back (the 1:500 plans and the sections keep it). Print pages only: the site never calls it.
  let PAL0 = null;
  function setStyle(name) { const g = root.GA; if (!PAL0) PAL0 = g.palette; if (name !== 'analysis') { g.palette = PAL0; return null; }
    const A = PAL0.analysis, p = Object.create(PAL0); Object.keys(A).forEach(n => { const v = A[n], b = PAL0[n]; p[n] = v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' ? Object.assign({}, b, v) : v; });
    g.palette = p; return p; }
  const hexRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  // hatch lines at 45° inside the current path, across the window V (dir 1 = rising to the right, -1 = falling)
  function anHatch(ctx, V, col, gap, lw, dir) { ctx.save(); ctx.clip('evenodd'); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'butt'; ctx.setLineDash([]); ctx.beginPath(); const h = V[3] - V[1], w = V[2] - V[0];
    for (let q = -h; q < w + h; q += gap) { if (dir < 0) { ctx.moveTo(V[0] + q, V[1]); ctx.lineTo(V[0] + q + h, V[3]); } else { ctx.moveTo(V[0] + q - h, V[3]); ctx.lineTo(V[0] + q, V[1]); } } ctx.stroke(); ctx.restore(); }
  // the fence: a black line with white dashes, on the current path
  function anFence(ctx, k, a, f) { f = f || 1; ctx.save(); ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.setLineDash([]); ctx.strokeStyle = a.ink; ctx.lineWidth = a.fence.w * f * k; ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = a.fence.w * f * 0.52 * k; ctx.setLineDash([a.fence.dash * f * k, a.fence.dash * f * k]); ctx.stroke(); ctx.restore(); }
  // the base on a large map: a white void behind its black-and-white fence — hatched in the red when the base is the map's subject,
  // in a sparse grey when it is context. mk() makes the base's closed path.
  function anBase(ctx, mk, V, k, a, subject, f) { mk(); ctx.fillStyle = '#FFFFFF'; ctx.fill('evenodd'); mk(); const H = a.hatch;
    if (subject) anHatch(ctx, V, a.red, H.gap * k, H.w * k, 1); else anHatch(ctx, V, H.ctxCol, H.ctxGap * k, H.ctxW * k, -1); if (f !== 0) { mk(); anFence(ctx, k, a, f); } }
  // one colour, five patterns (the estate's plots by kind): solid · hatch · cross-hatch · dots · level lines, inside the path mk() makes
  function anPattern(ctx, mk, V, pat, col, k) { if (pat === 'solid') { mk(); ctx.save(); ctx.globalAlpha = 0.82; ctx.fillStyle = col; ctx.fill('evenodd'); ctx.restore(); return; }
    if (pat === 'hatch' || pat === 'cross') { mk(); anHatch(ctx, V, col, 4.6 * k, 0.9 * k, 1); if (pat === 'cross') { mk(); anHatch(ctx, V, col, 4.6 * k, 0.9 * k, -1); } return; }
    mk(); ctx.save(); ctx.clip('evenodd'); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.9 * k; ctx.setLineDash([]); const g = (pat === 'dots' ? 4.4 : 4) * k;
    if (pat === 'dots') { for (let v = V[1], j = 0; v < V[3]; v += g, j++) for (let u = V[0] + (j % 2 ? g / 2 : 0); u < V[2]; u += g) { ctx.beginPath(); ctx.arc(u, v, 0.95 * k, 0, 7); ctx.fill(); } }
    else { ctx.beginPath(); for (let v = V[1]; v < V[3]; v += g) { ctx.moveTo(V[0], v); ctx.lineTo(V[2], v); } ctx.stroke(); } ctx.restore(); }
  // a fine paper grain over the window (a fixed seed: the same grain on every print)
  let GRAIN = null;
  function anGrain(ctx, V, k, a) { if (!a.grain) return; if (!GRAIN) { GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 512; const g = GRAIN.getContext('2d'), im = g.createImageData(512, 512); let sd = 20261120;
      for (let i = 0; i < im.data.length; i += 4) { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; const v = sd & 0x800000 ? 255 : 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = a.grain; } g.putImageData(im, 0, 0); }
    ctx.save(); const pt = ctx.createPattern(GRAIN, 'repeat'), sc = Math.max(1, 0.27 * k); if (pt.setTransform) pt.setTransform(new DOMMatrix().scale(sc)); ctx.imageSmoothingEnabled = false; ctx.fillStyle = pt; ctx.fillRect(V[0], V[1], V[2] - V[0], V[3] - V[1]); ctx.restore(); }
  // a photo or a scanned map "printed in grey": greyscale, a little more contrast and a white veil — nothing in the picture is edited
  function anPhoto(ctx, img, x, y, w, h, V, a, veil) { ctx.save(); ctx.filter = 'grayscale(1) contrast(1.16)'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, x, y, w, h); ctx.filter = 'none';
    ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = veil == null ? a.veil : veil; ctx.fillRect(V[0], V[1], V[2] - V[0], V[3] - V[1]); ctx.restore(); }
  // a class raster in the analysis colours: every pixel of class colour [r, g, b] takes the colour of the same class in the table
  // ([[from rgb], '#hex'], …); the alpha stays. Cached per raster and table name.
  const RCACHE = new Map();
  function anRaster(img, name, table) { if (RCACHE.has(name)) return RCACHE.get(name); const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); const im = g.getImageData(0, 0, c.width, c.height), d = im.data; const tb = table.map(([from, to]) => [from, hexRgb(to)]), lut = new Map();
    // (a semi-transparent pixel comes back from the canvas a step or two off its class colour: the nearest class within a small distance counts)
    const find = (r, g2, b) => { let best = null, bd = 40 * 40; tb.forEach(([f, to]) => { const q = (f[0] - r) ** 2 + (f[1] - g2) ** 2 + (f[2] - b) ** 2; if (q < bd) { bd = q; best = to; } }); return best; };
    for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; let to = lut.get(key); if (to === undefined) { to = find(d[i], d[i + 1], d[i + 2]); lut.set(key, to); } if (to) { d[i] = to[0]; d[i + 1] = to[1]; d[i + 2] = to[2]; } } g.putImageData(im, 0, 0); RCACHE.set(name, c); return c; }
  // the class colours of the rasters and of their legends, by style (one definition for map and legend)
  const NOYEAR = [189, 181, 170];   // built_period.png: a building with no year on record
  const perCol = (key, c) => { const a = P().an; return a ? a.period[key] : `rgb(${c.join(',')})`; };
  const densCol = (i) => { const a = P().an; return a ? a.density[i] : `rgb(${TD.density_colours[i].join(',')})`; };
  const edgeCol = (c, ctxOnly) => { const a = P().an; return a ? (ctxOnly ? a.edgeCtx : a.edge)[c] : `rgb(${TD.edge_colours[c].join(',')})`; };
  const heightImg = () => { const a = P().an; return a ? anRaster(D.hImg, 'height', D.ease.classes.map(c => [c[3], P().ex21.height[c[2]]])) : D.hImg; };
  const builtImg = () => { const a = P().an; return a ? anRaster(TD.img.built, 'built', TD.periods.map(q => [q[3], a.period[q[0]]]).concat([[NOYEAR, a.period.none]])) : TD.img.built; };
  const densImg = () => { const a = P().an; return a ? anRaster(TD.img.density, 'density', TD.density_colours.map((c, i) => [c, a.density[i]])) : TD.img.density; };
  const edgeImg = (ctxOnly) => { const a = P().an; return a ? anRaster(TD.img.edge, ctxOnly ? 'edgeCtx' : 'edge', Object.keys(TD.edge_colours).map(c => [TD.edge_colours[c], (ctxOnly ? a.edgeCtx : a.edge)[c]])) : TD.img.edge; };
  // names on the maps (towns, the base): bold capitals; in the analysis style smaller, with air between the letters
  const nameFont = (ctx, font, k, sz) => { if (P().an) { ctx.font = font(sz * 0.76, 700); ctx.letterSpacing = (1.5 * k).toFixed(2) + 'px'; } else ctx.font = font(sz, 700); };
  const nameEnd = (ctx) => { if (P().an) ctx.letterSpacing = '0px'; };
  // the metro is the red thing of map 03 only; elsewhere it is context
  const baseItem = (t, subject) => (P().an ? { base: subject ? 'subject' : 'context', label: t('x34.lg.base') } : { sw: P().ex21.base, label: t('x34.lg.base') });
  const metroCol = (only) => { const p = P(); return p.an && only === 'growth' ? p.an.red : p.ex21.metro; };
  // scale bar (owner, Map Studio 17 Nov 2026): no white box; grey bar and figures with a thin white halo so they read on photos too
  function scaleBar(ctx, bx, by, km, k, font, labels) { const pal = root.GA.palette, g = pal.ink3; labels = labels || [['0', 0], ['500', 0.5], ['1 km', 1]];
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3 * k; ctx.strokeRect(bx, by, km, 5 * k);
    ctx.fillStyle = g; if (labels.length > 3) { for (let i = 0; i + 1 < labels.length; i += 2) ctx.fillRect(bx + km * labels[i][1], by, km * (labels[i + 1][1] - labels[i][1]), 5 * k); } else ctx.fillRect(bx, by, km / 2, 5 * k); ctx.strokeStyle = g; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, km, 5 * k);
    ctx.font = font(10, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
    labels.forEach(([s0, f]) => { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3.6 * k; ctx.strokeText(s0, bx + km * f, by - 5 * k); ctx.fillStyle = g; ctx.fillText(s0, bx + km * f, by - 5 * k); }); ctx.restore(); }
  // map title written ON the map (owner, Map Studio 17 Nov 2026): grey, top start corner, a soft white glow and no plate,
  // so it reads on photos and on the base's dark fill. titleBand = the box it takes (names are kept out of it).
  const isRtl = () => root.GA.i18n.dir() === 'rtl';
  function titleBand(ctx, x, y, w, text, px, rtl, F) { ctx.save(); ctx.font = `600 ${Math.round(px)}px ${F || root.GA.pages.font()}`; const maxW = w - px * 6.5, tw = Math.min(ctx.measureText(text).width, maxW); ctx.restore();
    return rtl ? [x + w - px * 1.4 - tw, y, x + w, y + px * 2.5] : [x, y, x + px * 1.4 + tw, y + px * 2.5]; }
  function mapTitle(ctx, x, y, w, text, px, rtl, F) { if (!text) return null; ctx.save(); ctx.font = `600 ${Math.round(px)}px ${F || root.GA.pages.font()}`; ctx.textAlign = rtl ? 'right' : 'left'; ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const tx = rtl ? x + w - px * 0.9 : x + px * 0.9, ty = y + px * 1.65, maxW = w - px * 6.5;
    ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = px * 0.5; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = px * 0.14; for (let i = 0; i < 6; i++) ctx.strokeText(text, tx, ty, maxW);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.fillStyle = root.GA.palette.ink3; ctx.fillText(text, tx, ty, maxW); ctx.restore(); return titleBand(ctx, x, y, w, text, px, rtl, F); }
  // north arrow at the top end corner of the window, same soft glow, no plate
  const northBox = (V, k, rtl) => rtl ? [V[0] + 8 * k, V[1] + 8 * k, V[0] + 48 * k, V[1] + 76 * k] : [V[2] - 48 * k, V[1] + 8 * k, V[2] - 8 * k, V[1] + 76 * k];
  function northMark(ctx, V, k, rtl) { const nx = rtl ? V[0] + 28 * k : V[2] - 28 * k, ny = V[1] + 20 * k; ctx.save(); ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 7 * k; for (let i = 0; i < 4; i++) root.GA.pages.northArrow(ctx, nx, ny, 1.3 * k); ctx.restore(); root.GA.pages.northArrow(ctx, nx, ny, 1.3 * k); }
  // a name stays inside the visible window V and clear of the boxes K (title, north arrow); null = the place is outside the window
  function place(V, K, cx, cy, tw, th, pad) { if (cx < V[0] || cx > V[2] || cy < V[1] || cy > V[3] || tw + 2 * pad > V[2] - V[0]) return null;
    cx = Math.min(Math.max(cx, V[0] + tw / 2 + pad), V[2] - tw / 2 - pad); cy = Math.min(Math.max(cy, V[1] + th / 2 + pad), V[3] - th / 2 - pad);
    K.forEach(r => { if (cx + tw / 2 > r[0] && cx - tw / 2 < r[2] && cy + th / 2 > r[1] && cy - th / 2 < r[3]) cy = r[3] + th / 2 + pad; });
    return cy + th / 2 > V[3] ? null : [cx, cy]; }
  // o.view = the visible window [x0, y0, x1, y1] in canvas px when a sheet shows only a part of the map (default: the whole map);
  // the frame, the title (o.title, o.titlePx), the north arrow and the scale bar are drawn on that window
  function furniture(ctx, o, x, y, w, h, k, F) { const V = o.view || [x, y, x + w, y + h], rtl = isRtl(), tpx = o.titlePx || 15 * k; const K = []; if (!o.noNorth) K.push(northBox(V, k, rtl));
    if (o.title) K.push(titleBand(ctx, V[0], V[1], V[2] - V[0], o.title, tpx, rtl, F)); return { V, rtl, tpx, K, band: o.title ? K[K.length - 1] : null }; }
  function frameTop(ctx, o, U, k, F, creditLater) { const V = U.V; ctx.strokeStyle = P().ink; ctx.lineWidth = (P().an ? 0.7 : 1.2) * k; ctx.strokeRect(V[0] + 0.5, V[1] + 0.5, V[2] - V[0] - 1, V[3] - V[1] - 1);
    if (!o.noNorth) northMark(ctx, V, k, U.rtl); if (o.title) mapTitle(ctx, V[0], V[1], V[2] - V[0], o.title, U.tpx, U.rtl, F); if (o.credit && !creditLater) creditMark(ctx, o, V, k, F, false); }
  // o.credit = the sources in a few words (proper names and licences only, so it needs no translation), for a map exported WITHOUT its
  // page (tools/ex21_pages/maps_only.py): the page's source line does not travel with it. Bottom corner away from the scale bar.
  function creditMark(ctx, o, V, k, F, left) { const px = o.creditPx || 8.5 * k; ctx.save(); ctx.font = `500 ${Math.round(px)}px ${F}`; ctx.direction = 'ltr'; ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const tx = left ? V[0] + px * 1.2 : V[2] - px * 1.2, ty = V[3] - px * 1.1; ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = px * 0.5; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = px * 0.16; for (let i = 0; i < 6; i++) ctx.strokeText(o.credit, tx, ty);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.fillStyle = P().ink3; ctx.fillText(o.credit, tx, ty); ctx.restore(); }
  function ready() {
    if (Dp) return Dp; const v = '?v=' + (root.GA_BUILD || ''); const prj = root.GA.proj.EPSG25830;
    const ll0 = prj.inverse([CITY.x0, CITY.y0]), ll1 = prj.inverse([CITY.x1, CITY.y1]); const bb = [ll0[0], ll0[1], ll1[0], ll1[1]];
    const img = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(u)); i.src = u + v; });
    Dp = Promise.all([root.GA.data.single('base_edge'), root.GA.data.single('tour_area'), root.GA.data.single('south_metro'), root.GA.data.chunked('buildings', bb, 0, 600), root.GA.data.single('streets_major'),
      fetch('data/ex21/easements.json' + v).then(r => r.json()), img('data/ex21/allowed_height.png'), fetch('data/ex21/metro_l1.json' + v).then(r => r.json())])
      .then(([edge, area, metro, bld, streets, ease, hImg, l1]) => { const U = (p) => prj.forward(p);
        const rings = (g) => g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
        const proj = (f) => rings(f.geometry).map(r => r.map(U));
        const seen = new Set(); const builds = []; bld.forEach(f => { const id = (f.properties || {}).id; if (id && seen.has(id)) return; seen.add(id); builds.push(proj(f)); });
        return (D = { edge: edge.features.map(f => ({ p: f.properties, g: f.geometry.type === 'Point' ? U(f.geometry.coordinates) : proj(f) })), area: area.features.map(f => ({ p: f.properties, g: proj(f) })),
          metro: metro.features.map(f => ({ p: f.properties, g: f.geometry.type === 'Point' ? U(f.geometry.coordinates) : proj(f) })), builds, streets: (streets.features || streets).map(f => ({ p: f.properties, g: proj(f) })), ease, hImg, runway: RUNWAY.map(U), l1: { lines: l1.lines.map(l => l.map(U)), stops: l1.stops.map(st => ({ name: st.name, p: U(st.lonlat) })), meta: l1 } }); })
      .catch(e => { Dp = null; throw e; });
    return Dp;
  }
  function drawCity(ctx, x, y, w, h, o) {
    o = o || {}; if (!D) return false; const pal = P(), C = pal.ex21, T = pal.tour; const E = CITY, mpp = (E.x1 - E.x0) / w, k = o.k || w / 1000;
    const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp; const t = o.t || ((s) => s); const F = root.GA.pages.font();
    // the analysis print style (setStyle): AN = its settings; the base is the red thing of map 01 only (o.baseSubject overrides), the metro of map 03
    const AN = pal.an || null, MC = metroCol(o.only), baseSubj = o.baseSubject != null ? !!o.baseSubject : o.only === 'island';
    const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs, close) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); if (close) ctx.closePath(); };
    // 5.42 (owner request, 13 Nov 2026): one layer of information per map — o.only = 'island' | 'walk' | 'growth' | 'height';
    // every map keeps the same light context (municipal boundaries, buildings, streets, the base, town names)
    const on = (n) => !o.only || o.only === n; const U = furniture(ctx, o, x, y, w, h, k, F), V = U.V; (o.avoid || []).forEach(b => U.K.push(b));   // o.avoid: boxes the names keep clear of (a sheet's own markers)
    // o.tidy (analysis sheets; on by itself for maps 02 and 03): a name or a label sits on the free spot nearest to its place — clear of the map's
    // own lines and marks (OB.segs: [x0, y0, x1, y1, margin] in px, OB.boxes), of the base's land and of the labels placed before it.
    // o.obst = { segs, boxes } adds a sheet's own lines and marks.
    const tidy = !!AN && (o.tidy != null ? !!o.tidy : o.only === 'walk' || o.only === 'growth'), OB = { segs: [], boxes: [], land: null }, insetY = V[3] - (AN && o.noScale ? 364 : 410) * k;
    const obLine = (rs, m) => rs.forEach(r => { for (let i = 1; i < r.length; i++) OB.segs.push([X(r[i - 1][0]), Y(r[i - 1][1]), X(r[i][0]), Y(r[i][1]), m]); });
    const obDot = (p, r) => OB.boxes.push([X(p[0]) - r, Y(p[1]) - r, X(p[0]) + r, Y(p[1]) + r]);
    const hitSeg = (b, s) => { let t0 = 0, t1 = 1; const dx = s[2] - s[0], dy = s[3] - s[1], pp = [-dx, dx, -dy, dy], qq = [s[0] - b[0], b[2] - s[0], s[1] - b[1], b[3] - s[1]];
      for (let i = 0; i < 4; i++) { if (pp[i] === 0) { if (qq[i] < 0) return false; } else { const r = qq[i] / pp[i]; if (pp[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } } return true; };
    const inLand = (px, py) => { let c = false; (OB.land || []).forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = X(r[i][0]), yi = Y(r[i][1]), xj = X(r[j][0]), yj = Y(r[j][1]); if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } }); return c; };
    const inV = (b) => b[0] > V[0] + 6 * k && b[2] < V[2] - 6 * k && b[1] > V[1] + 6 * k && b[3] < V[3] - 6 * k;
    const free = (b) => !OB.boxes.some(r => b[2] > r[0] && b[0] < r[2] && b[3] > r[1] && b[1] < r[3]) && !OB.segs.some(s => hitSeg([b[0] - s[4], b[1] - s[4], b[2] + s[4], b[3] + s[4]], s)) && !inLand((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
    const spot = (cx, cy, tw, th) => { const bx = (u, v) => [u - tw / 2, v - th / 2, u + tw / 2, v + th / 2]; let best = null, bd = 1e9;
      for (let dy = -96; dy <= 96; dy += 6) for (let dx = -240; dx <= 240; dx += 8) { const d = Math.hypot(dx, dy); if (d >= bd) continue; const b = bx(cx + dx * k, cy + dy * k); if (inV(b) && free(b)) { best = [cx + dx * k, cy + dy * k]; bd = d; } }
      best = best || [cx, cy]; OB.boxes.push(bx(best[0], best[1])); return best; };
    if (tidy) { U.K.forEach(b => OB.boxes.push(b)); if (o.obst) { (o.obst.segs || []).forEach(s => OB.segs.push(s)); (o.obst.boxes || []).forEach(b => OB.boxes.push(b)); }
      if (!o.noScale) OB.boxes.push([V[0] + 12 * k, V[3] - 48 * k, V[0] + 56 * k + 1000 / mpp, V[3] - 8 * k]);   // the scale bar drawn on the map
      const bs = D.edge.find(f => f.p.k === 'base'); if (bs) { obLine(bs.g, 5 * k); OB.land = bs.g; }
      if (o.only === 'walk') D.edge.forEach(f => { if (f.p.k === 'route') obLine(f.g, 6 * k); else if (f.p.k === 'straight') obLine(f.g, 3 * k); else if (f.p.k === 'deadend') obDot(Array.isArray(f.g[0]) ? f.g[0][0] : f.g, 8 * k); });
      if (o.only === 'growth') { obLine(D.l1.lines, 7 * k); D.l1.stops.forEach(st => obDot(st.p, 8 * k)); D.metro.forEach(f => { if (f.p.k === 'track') obLine(f.g, 7 * k); else obDot(f.g, 10 * k); }); OB.boxes.push([V[0] + 14 * k, insetY, V[0] + 264 * k, insetY + 350 * k]); } }
    ctx.save(); ctx.beginPath(); ctx.rect(V[0], V[1], V[2] - V[0], V[3] - V[1]); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // names and figures on the map are Latin script: always left to right, also on the Arabic and Hebrew pages (17 Nov 2026: there the
    // walking distances and the 2015→2025 change were drawn mirrored — "2025→2015 · % 7.1+" — because the page's direction leaked in)
    ctx.direction = 'ltr';
    // 1 municipal boundaries (dashed); the residents' change 2015 → 2025 is written at each town
    const chg = (v) => { const b = T.chgBreaks; let i = 0; while (i < b.length && v >= b[i]) i++; return T.chg[i]; };
    if (!o.noMuni) { ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = C.muni; ctx.lineWidth = 1.1 * k; D.area.forEach(a => { path(a.g, true); ctx.stroke(); }); ctx.setLineDash([]); }
    // 2 the aeronautical height limits (allowed height above ground < 60 m)
    if (on('height')) { const e = D.ease.extent; ctx.save(); ctx.globalAlpha = o.focus != null && o.focus !== 'height' ? 0.25 : 1; ctx.imageSmoothingEnabled = true; ctx.drawImage(heightImg(), X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp); ctx.restore(); }
    // 3 built footprints and main streets
    ctx.fillStyle = C.built; D.builds.forEach(rs => { path(rs, true); ctx.fill(); });
    ctx.strokeStyle = C.street; ctx.lineWidth = 0.9 * k; ctx.beginPath(); D.streets.forEach(s => s.g.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))))); ctx.stroke();
    if (AN) anGrain(ctx, V, k, AN);   // the grey ground takes a fine paper grain; what the map is about is drawn clean over it
    // 4 the 300 m band (hatched) and the base as a closed solid with its runway
    const band = D.edge.find(f => f.p.k === 'band'), base = D.edge.find(f => f.p.k === 'base');
    if (band && on('island') && AN) { path(band.g, true); anHatch(ctx, [x, y, x + w, y + h], C.bandLine, 7 * k, 0.7 * k, baseSubj ? -1 : 1); }   // falling, so it reads apart from the base's rising red hatch (rising where the base is context and its grey hatch falls: the key map)
    else if (band && on('island')) { ctx.save(); path(band.g, true); ctx.clip('evenodd'); ctx.strokeStyle = C.bandLine; ctx.lineWidth = 0.8 * k; ctx.globalAlpha = 0.7; ctx.beginPath(); for (let q = -h; q < w + h; q += 7 * k) { ctx.moveTo(x + q, y + h); ctx.lineTo(x + q + h, y); } ctx.stroke(); ctx.restore(); }
    if (base && AN) { anBase(ctx, () => path(base.g, true), V, k, AN, baseSubj, on('island') && o.only ? 0 : 1);   // map 01 draws the fence by class instead
      ctx.strokeStyle = C.runway; ctx.lineWidth = 1.2 * k; ctx.setLineDash([10 * k, 6 * k]); ctx.beginPath(); ctx.moveTo(X(D.runway[0][0]), Y(D.runway[0][1])); ctx.lineTo(X(D.runway[1][0]), Y(D.runway[1][1])); ctx.stroke(); ctx.setLineDash([]); }
    else if (base) { path(base.g, true); ctx.fillStyle = C.base; ctx.fill(); ctx.strokeStyle = C.baseLine; ctx.lineWidth = 1.4 * k; ctx.stroke();
      ctx.strokeStyle = C.runway; ctx.lineWidth = 3.2 * k; ctx.setLineDash([10 * k, 6 * k]); ctx.beginPath(); ctx.moveTo(X(D.runway[0][0]), Y(D.runway[0][1])); ctx.lineTo(X(D.runway[1][0]), Y(D.runway[1][1])); ctx.stroke(); ctx.setLineDash([]); }
    // 5 the fence by what lies outside it
    if (on('island') && AN) { const FCs = AN.fenceClass, fs = D.edge.filter(f => f.p.k === 'fence'); ctx.save(); ctx.lineCap = 'butt';   // by class: line patterns in black and grey, on a white casing
      fs.forEach(f => { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 7.4 * k; path(f.g); ctx.stroke(); });
      fs.forEach(f => { const fc = FCs[f.p.c] || FCs.housing; ctx.strokeStyle = fc.col; ctx.lineWidth = fc.w * k; ctx.setLineDash((fc.dash || []).map(v => v * k)); ctx.lineCap = fc.round ? 'round' : 'butt'; path(f.g); ctx.stroke(); }); ctx.restore(); }
    else if (on('island')) D.edge.filter(f => f.p.k === 'fence').forEach(f => { ctx.strokeStyle = C.fence[f.p.c] || C.baseLine; ctx.lineWidth = 4.2 * k; path(f.g); ctx.stroke(); });
    // 6 walking detours vs the straight line, dead ends
    if (on('walk')) D.edge.filter(f => f.p.k === 'straight').forEach(f => { ctx.strokeStyle = C.straight; ctx.lineWidth = 1.2 * k; ctx.setLineDash([3 * k, 4 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]); });
    if (on('walk')) D.edge.filter(f => f.p.k === 'route').forEach(f => { if (AN) { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6 * k; path(f.g); ctx.stroke(); } ctx.strokeStyle = C.route; ctx.lineWidth = (AN ? 3.2 : 2.6) * k; ctx.setLineDash([9 * k, 4 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]); if (tidy) return;   // (tidy: the figures are placed with the names, beside the line)
      const r = f.g[0], m = r[Math.floor(r.length * 0.62)]; const lab = `${(f.p.walk_m / 1000).toFixed(1)} km  ×${f.p.ratio.toFixed(2)}`; ctx.font = font(10.5, 700); ctx.lineWidth = 3.2 * k; ctx.strokeStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(lab, X(m[0]), Y(m[1]) - 10 * k); ctx.fillStyle = C.route; ctx.fillText(lab, X(m[0]), Y(m[1]) - 10 * k); });
    if (on('walk')) D.edge.filter(f => f.p.k === 'deadend').forEach(f => { const [u, v] = Array.isArray(f.g[0]) ? f.g[0][0] : f.g; ctx.beginPath(); ctx.arc(X(u), Y(v), 4.2 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.dead; ctx.lineWidth = 2 * k; ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(u) - 2.4 * k, Y(v)); ctx.lineTo(X(u) + 2.4 * k, Y(v)); ctx.stroke(); });
    // 7 the metro extension under construction, with its two ends
    if (on('growth')) { ctx.strokeStyle = MC; ctx.lineWidth = 6 * k; ctx.beginPath(); D.l1.lines.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke();
      // (analysis style: a stop is a white ring on the line, as in the inset and in the key — the same mark, smaller, as the extension's two ends)
      D.l1.stops.forEach(st => { ctx.beginPath(); ctx.arc(X(st.p[0]), Y(st.p[1]), (AN ? 4.2 : 4.6) * k, 0, 7); ctx.fillStyle = AN ? '#FFFFFF' : MC; ctx.fill(); ctx.strokeStyle = AN ? MC : '#FFFFFF'; ctx.lineWidth = (AN ? 1.9 : 1.6) * k; ctx.stroke(); }); }
    if (on('growth')) D.metro.forEach(f => { if (f.p.k === 'track') { ctx.strokeStyle = MC; ctx.lineWidth = 6 * k; path(f.g); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.2 * k; ctx.setLineDash([7 * k, 7 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]); }
      else { ctx.beginPath(); ctx.arc(X(f.g[0]), Y(f.g[1]), 6 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = MC; ctx.lineWidth = 2.6 * k; ctx.stroke(); } });
    // o.over(ctx, X, Y, k): a sheet's own layers (tools/ex21_pages/policy.py), drawn here so the names stay on top and inside the window
    if (o.over) { ctx.save(); o.over(ctx, X, Y, k); ctx.restore(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr'; ctx.lineJoin = 'round'; }
    // 8 labels: towns with their change 2015 → 2025, the base
    const towns = o.noTowns ? [] : D.edge.filter(f => f.p.k === 'town'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (tidy && base && !o.noBaseLabel) { nameFont(ctx, font, k, 15); const bw0 = ctx.measureText(t('x34.base').toUpperCase()).width, rx0 = X((D.runway[0][0] + D.runway[1][0]) / 2) - 26 * k, ry0 = Y((D.runway[0][1] + D.runway[1][1]) / 2); nameEnd(ctx); OB.boxes.push([rx0 - bw0 - 6 * k, ry0 - 16 * k, rx0 + 6 * k, ry0 + 22 * k]); }
    towns.forEach(f => { const a = D.area.find(m => m.p.name === f.p.nm); const [u, v] = f.g; const two = a && on('growth'); nameFont(ctx, font, k, 15);
      const tw = Math.max(ctx.measureText(f.p.nm.toUpperCase()).width, two ? 150 * k : 0), th = (two ? 34 : 18) * k; let q = place(V, U.K, X(u), Y(v) - (two ? 4 : 13) * k, tw, th, 8 * k); if (!q) return; if (tidy) q = spot(q[0], q[1], tw + 10 * k, th + 6 * k); const px = q[0], py = q[1] + (two ? 4 : 13) * k;
      ctx.lineWidth = 4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(f.p.nm.toUpperCase(), px, py - 8 * k); ctx.fillStyle = (o.townCols && o.townCols[f.p.nm]) || C.town; ctx.fillText(f.p.nm.toUpperCase(), px, py - 8 * k); ctx.fillStyle = C.town; nameEnd(ctx);
      if (a && on('growth')) { const s = (a.p.chg > 0 ? '+' : '') + a.p.chg.toFixed(1) + ' %'; ctx.font = font(12, 600); ctx.strokeText(s + ' · 2015→2025', px, py + 9 * k); ctx.fillStyle = C.town; ctx.fillText(s + ' · 2015→2025', px, py + 9 * k); } });
    if (base && !o.noBaseLabel) { const rx = X((D.runway[0][0] + D.runway[1][0]) / 2) - 26 * k, ry = Y((D.runway[0][1] + D.runway[1][1]) / 2); ctx.textAlign = 'right';
      const sub = `${km2(base.p.area_ha)} km² · ${base.p.perimeter_km} km`; if (AN) { ctx.lineJoin = 'round'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6 * k; nameFont(ctx, font, k, 15); ctx.strokeText(t('x34.base').toUpperCase(), rx, ry); nameEnd(ctx); ctx.font = font(9.5, 500); ctx.strokeText(sub, rx, ry + 15 * k); }
      ctx.fillStyle = AN ? (baseSubj ? AN.red : AN.ink) : '#FFFFFF'; nameFont(ctx, font, k, 15); ctx.fillText(t('x34.base').toUpperCase(), rx, ry); nameEnd(ctx); ctx.font = font(AN ? 9.5 : 11, 500); ctx.direction = 'ltr'; ctx.fillText(sub, rx, ry + (AN ? 15 : 17) * k); ctx.textAlign = 'center'; }
    // (tidy) the two routes' figures: beside the line, on the first free spot from 60 % of the way
    if (tidy && on('walk')) D.edge.filter(f => f.p.k === 'route').forEach(f => { const r = f.g[0].map(p => [X(p[0]), Y(p[1])]), lab = `${(f.p.walk_m / 1000).toFixed(1)} km  ×${f.p.ratio.toFixed(2)}`; ctx.font = font(10.5, 700); const tw = ctx.measureText(lab).width + 8 * k, th = 16 * k;
      const cum = [0]; for (let i = 1; i < r.length; i++) cum.push(cum[i - 1] + Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1])); const L = cum[cum.length - 1]; let at = null;
      for (let n = 0; n < 60 && !at; n++) { const fr = 0.6 + (n % 2 ? -1 : 1) * Math.ceil(n / 2) * 0.015; if (fr < 0.08 || fr > 0.94) continue; let i = 1; while (i < r.length - 1 && cum[i] < fr * L) i++;
        const sx = r[i][0] - r[i - 1][0], sy = r[i][1] - r[i - 1][1], sl = Math.hypot(sx, sy) || 1, q = (fr * L - cum[i - 1]) / sl, px = r[i - 1][0] + sx * q, py = r[i - 1][1] + sy * q, nx = -sy / sl, ny = sx / sl, d = Math.abs(nx) * tw / 2 + Math.abs(ny) * th / 2 + 9 * k;
        [1, -1].forEach(s => { if (at) return; const c = [px + s * nx * d, py + s * ny * d], b = [c[0] - tw / 2, c[1] - th / 2, c[0] + tw / 2, c[1] + th / 2]; if (inV(b) && free(b)) { at = c; OB.boxes.push(b); } }); }
      if (!at) { const m = f.g[0][Math.floor(f.g[0].length * 0.62)]; at = [X(m[0]), Y(m[1]) - 10 * k]; }
      ctx.lineJoin = 'round'; ctx.lineWidth = 3.2 * k; ctx.strokeStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(lab, at[0], at[1]); ctx.fillStyle = C.route; ctx.fillText(lab, at[0], at[1]); });
    // frame, north, scale
    ctx.restore(); frameTop(ctx, o, U, k, F);
    if (on('growth') && o.only === 'growth') drawLineInset(ctx, V[0] + 14 * k, insetY, 250 * k, 350 * k, k, t, font);
    if (!o.noScale) scaleBar(ctx, V[0] + 22 * k, V[3] - 24 * k, 1000 / mpp, k, font);
    return true;
  }
  // THE STRATEGY (owner request, 17 Nov 2026: "the strategy map" — the text's third part drawn). A PROPOSAL on today's map, not
  // a fact: (1) a public walking strip outside the whole fence (schematic width ~35 m), (2) the 13 dead ends joined to it, (3) the
  // places it links — the Churriana sports centre (OSM, area S), the Río Dílar where it meets the fence (OSM, area R), metro line 1's
  // Armilla stop and the extension's end at Las Gabias (OSM; the extension's seven new stops are not drawn: no source publishes their
  // positions, see data/manifest south_metro) — and (4) a green corridor Ogíjares ↔ Alhendín past the base's south tip, where the
  // aeronautical ceiling already keeps building low (map 04): drawn schematically, its line is not surveyed.
  function drawStrategy(ctx, x, y, w, h, o) {
    o = o || {}; if (!D || !AR) return false; const pal = P(), C = pal.ex21, S = pal.ex21s; const E = CITY, mpp = (E.x1 - E.x0) / w, k = o.k || w / 1000; const t = o.t || ((s) => s); const F = root.GA.pages.font();
    const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const mk = D.metro.filter(q => q.p.k === 'station_now' || q.p.k === 'terminus').map(q => [X(q.g[0]) - 14 * k, Y(q.g[1]) - 14 * k, X(q.g[0]) + 14 * k, Y(q.g[1]) + 14 * k]);
    // the green corridor's line (schematic): Alhendín → past the base's south tip → Ogíjares. It passes 250 m south-east of the tip, through the
    // open land under the ceiling, and ends 25 % short of each town centre; the curve (a quadratic through M) is drawn further down.
    const CG = (() => { const b0 = D.edge.find(f => f.p.k === 'base'), tw = (nm) => { const f = D.edge.find(q => q.p.k === 'town' && q.p.nm === nm); return f ? f.g : null; }, al = tw('Alhendín'), og = tw('Ogíjares'); if (!b0 || !al || !og) return null;
      const tip = b0.g.flat().reduce((a, b) => (b[1] < a[1] ? b : a)), P0 = [al[0] + (tip[0] - al[0]) * 0.25, al[1] + (tip[1] - al[1]) * 0.25], P2 = [og[0] + (tip[0] - og[0]) * 0.25, og[1] + (tip[1] - og[1]) * 0.25], M = [tip[0] + 180, tip[1] - 180];
      return { P0, P2, M, C1: [2 * M[0] - (P0[0] + P2[0]) / 2, 2 * M[1] - (P0[1] + P2[1]) / 2], at: (q) => [(1 - q) * (1 - q) * P0[0] + 2 * (1 - q) * q * (2 * M[0] - (P0[0] + P2[0]) / 2) + q * q * P2[0], (1 - q) * (1 - q) * P0[1] + 2 * (1 - q) * q * (2 * M[1] - (P0[1] + P2[1]) / 2) + q * q * P2[1]] }; })();
    // o.tidy (analysis sheets): the names keep clear of the metro, the strip, the corridor and the scenario box (drawCity o.obst); small type
    const tidy = !!pal.an && !!o.tidy, V0 = o.view || [x, y, x + w, y + h]; let obst = o.obst, SB = null;
    if (tidy) { const segs = ((o.obst || {}).segs || []).slice(), boxes = ((o.obst || {}).boxes || []).slice(), line = (rs, m) => rs.forEach(r => { for (let i = 1; i < r.length; i++) segs.push([X(r[i - 1][0]), Y(r[i - 1][1]), X(r[i][0]), Y(r[i][1]), m]); });
      line(D.l1.lines, 5 * k); D.metro.forEach(f => { if (f.p.k === 'track') line(f.g, 5 * k); }); const b0 = D.edge.find(f => f.p.k === 'base'); if (b0) line(b0.g, 35 / mpp + 4 * k);
      D.edge.filter(f => f.p.k === 'deadend').forEach(f => { const q = Array.isArray(f.g[0]) ? f.g[0][0] : f.g; boxes.push([X(q[0]) - 9 * k, Y(q[1]) - 9 * k, X(q[0]) + 9 * k, Y(q[1]) + 9 * k]); });
      if (CG) { const pl = []; for (let i = 0; i <= 28; i++) pl.push(CG.at(i / 28)); line([pl], 110 / mpp + 5 * k); }
      if (TD && TD.projection && !o.noScenario) { const P5 = TD.projection.five, body = t('x36.box.need', { a: P5['2025'].toLocaleString('en-US'), b: P5['2045'].toLocaleString('en-US'), n: P5.dwellings_needed_2045.toLocaleString('en-US'), p: TD.base_scenario.persons_per_dwelling });
        const bw = 330 * k, pad = 11 * k; ctx.save(); ctx.font = font(8, 400); const wl = []; let ln = ''; body.split(' ').forEach(wd => { const tt = ln ? ln + ' ' + wd : wd; if (ctx.measureText(tt).width > bw - 2 * pad && ln) { wl.push(ln); ln = wd; } else ln = tt; }); wl.push(ln); ctx.restore();
        const bh = pad * 2 + 13 * k + wl.length * 11.4 * k - 3 * k; SB = { bx: V0[2] - 12 * k - bw, by: V0[3] - 12 * k - bh, bw, bh, pad, wl }; boxes.push([SB.bx - 6 * k, SB.by - 6 * k, SB.bx + bw, SB.by + bh]); }
      obst = { segs, boxes }; }
    // (tidy) the open-land cells go under the names and leave the base as drawCity drew it (its hatch and runway axis): drawn in drawCity's own
    // "over" step, outside the base only; step 0 below is then skipped
    const cellsOn = !!(TD && TD.img && TD.img.edge && !o.noOpenLand), over = tidy && cellsOn ? (c2, X2, Y2, k2) => { const b0 = D.edge.find(f => f.p.k === 'base'); c2.save(); c2.beginPath(); c2.rect(x, y, w, h);
      if (b0) b0.g.forEach(r => { r.forEach((p, i) => i ? c2.lineTo(X(p[0]), Y(p[1])) : c2.moveTo(X(p[0]), Y(p[1]))); c2.closePath(); }); c2.clip('evenodd'); c2.imageSmoothingEnabled = false; c2.globalAlpha = 0.45; c2.drawImage(edgeImg(true), x, y, w, h); c2.restore(); if (o.over) o.over(c2, X2, Y2, k2); } : o.over;
    drawCity(ctx, x, y, w, h, Object.assign({}, o, { only: 'strategy', avoid: (o.avoid || []).concat(mk), obst, over }));   // context: boundaries, buildings, streets, the base, town names (kept off the metro markers)
    const base = D.edge.find(f => f.p.k === 'base'); if (!base) return false; const V = o.view || [x, y, x + w, y + h];
    const path = (rs, close) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); if (close) ctx.closePath(); };
    const halo = (s0, px, py, col, sz, wt, al) => { ctx.font = font(sz, wt); ctx.textAlign = al || 'center'; ctx.textBaseline = 'middle'; ctx.direction = /[֐-ࣿ]/.test(s0) ? 'rtl' : 'ltr'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.6 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(s0, px, py); ctx.fillStyle = col; ctx.fillText(s0, px, py); };
    ctx.save(); ctx.beginPath(); ctx.rect(V[0], V[1], V[2] - V[0], V[3] - V[1]); ctx.clip(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // 0 (owner, 17 Nov: "add them") the open land next to the towns, by aeronautical ceiling — the same 100 m cells as the time map
    // "how it could grow" (Catastro, OSM, RD 118/2019): where the towns will press on the fence next, and how high they may build there
    const AN = pal.an || null;
    if (cellsOn && !tidy) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 0.45; ctx.drawImage(edgeImg(true), x, y, w, h); ctx.restore();
      ctx.save(); const bp = D.edge.find(f => f.p.k === 'base'); if (AN) anBase(ctx, () => path(bp.g, true), V, k, AN, false, 0); else { path(bp.g, true); ctx.fillStyle = C.base; ctx.fill(); } ctx.restore(); }   // the base stays on top
    // 4 the green corridor (schematic): Alhendín → past the south tip → Ogíjares
    let cor = null; if (CG) { const P0 = CG.P0, P2 = CG.P2, M = CG.M, C1 = CG.C1; cor = { P0, P2, M };   // the curve passes through M (CG, above)
      const curve = () => { ctx.beginPath(); ctx.moveTo(X(P0[0]), Y(P0[1])); ctx.quadraticCurveTo(X(C1[0]), Y(C1[1]), X(P2[0]), Y(P2[1])); };
      // a pale band with dark olive edges, so it reads apart from the open-land cells
      curve(); ctx.strokeStyle = S.corridorLine; ctx.lineWidth = 220 / mpp; ctx.stroke(); curve(); ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = 0.72; ctx.lineWidth = 220 / mpp - 6 * k; ctx.stroke(); ctx.globalAlpha = 1;
      curve(); ctx.setLineDash([10 * k, 7 * k]); ctx.strokeStyle = S.corridorLine; ctx.lineWidth = 2 * k; ctx.stroke(); ctx.setLineDash([]); }
    // 1 the walking strip, outside the fence only (a 70 m stroke on the outline, clipped to the outside: 35 m wide), a white dashed path on it
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); base.g.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.clip('evenodd');
    path(base.g, true); ctx.strokeStyle = S.strip; ctx.globalAlpha = 0.85; ctx.lineWidth = 2 * 35 / mpp; ctx.stroke(); ctx.globalAlpha = 1; ctx.restore();
    path(base.g, true); if (AN) anFence(ctx, k, AN); else { ctx.strokeStyle = C.baseLine; ctx.lineWidth = 1.4 * k; ctx.stroke(); }
    // 2 the dead ends, joined
    const joined = () => D.edge.filter(f => f.p.k === 'deadend').forEach(f => { const [u, v] = Array.isArray(f.g[0]) ? f.g[0][0] : f.g; ctx.beginPath(); ctx.arc(X(u), Y(v), 5 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = S.strip; ctx.lineWidth = 2.6 * k; ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(u) - 2.6 * k, Y(v)); ctx.lineTo(X(u) + 2.6 * k, Y(v)); ctx.moveTo(X(u), Y(v) - 2.6 * k); ctx.lineTo(X(u), Y(v) + 2.6 * k); ctx.stroke(); });
    joined();
    // metro: line 1 today and the extension (as on map 03)
    ctx.strokeStyle = C.metro; ctx.lineWidth = 4 * k; ctx.beginPath(); D.l1.lines.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke();
    D.metro.forEach(f => { if (f.p.k === 'track') { ctx.strokeStyle = C.metro; ctx.lineWidth = 4 * k; path(f.g); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5 * k; ctx.setLineDash([6 * k, 6 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]); } });
    if (tidy) joined();   // (tidy) the proposal stays on top: the dead end at the base's north tip sits where the extension meets the fence
    // 3 the places the strip links (numbered; names in the legend)
    const cen = (rs) => { let n = 0, a = 0, b = 0; rs.forEach(pg => (pg[0] || []).forEach(c => { a += c[0]; b += c[1]; n++; })); return n ? [a / n, b / n] : null; };
    const AS = AR.areas.find(a => a.id === 'S'), ARv = AR.areas.find(a => a.id === 'R');
    const sport = AS && (AS.places || []).find(q => /Polideportivo/.test(q.nm || '')); const riv = ARv && (ARv.water || []).find(q => q.ww === 'river' || /Dílar/.test(q.nm || ''));
    let rivP = null; if (riv) { const r = riv.r[0] && riv.r[0][0]; if (r) { const sec = ARv.section; const m = [(sec.a[0] + sec.b[0]) / 2, (sec.a[1] + sec.b[1]) / 2]; rivP = r.reduce((p, q) => (Math.hypot(q[0] - m[0], q[1] - m[1]) < Math.hypot(p[0] - m[0], p[1] - m[1]) ? q : p)); } }
    const st = (k0) => { const f = D.metro.find(q => q.p.k === k0); return f ? f.g : null; };
    const pts = [[sport ? cen(sport.r) : null, 'x38.p.sport'], [rivP, 'x38.p.river'], [st('station_now'), 'x38.p.armilla'], [st('terminus'), 'x38.p.gabias']];
    pts.forEach(([p, key], i) => { if (!p) return; const px = X(p[0]), py = Y(p[1]); ctx.beginPath(); ctx.arc(px, py, 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2 * k; ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.font = font(12, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.fillText(String(i + 1), px, py + 0.5 * k); });
    // labels on the map: the strip's length, the corridor
    const bS = D.edge.find(f => f.p.k === 'base').p; const per = bS && bS.perimeter_km;
    if (cor && tidy) { const q = 0.74, p = CG.at(q), dx = 2 * (1 - q) * (CG.C1[0] - CG.P0[0]) + 2 * q * (CG.P2[0] - CG.C1[0]), dy = 2 * (1 - q) * (CG.C1[1] - CG.P0[1]) + 2 * q * (CG.P2[1] - CG.C1[1]);   // (tidy) inside the band, along it: between its edge and its centre line
      ctx.save(); ctx.translate(X(p[0]), Y(p[1])); ctx.rotate(Math.atan2(-dy, dx)); halo(t('x38.lab.corridor'), 0, -55 / mpp, S.corridorLine, 10.5, 700); ctx.restore(); }
    else if (cor) { const q = [(cor.M[0] + cor.P2[0]) / 2, (cor.M[1] + cor.P2[1]) / 2]; ctx.font = font(12, 700); const lw2 = ctx.measureText(t('x38.lab.corridor')).width / 2 + 8 * k; halo(t('x38.lab.corridor'), Math.min(Math.max(X(q[0]), V[0] + lw2), V[2] - lw2), Y(q[1]) - 150 / mpp, S.corridorLine, 12, 700); }
    ctx.restore();
    // (tidy) the 2045 scenario as a small note in a thin frame, in the sheet's small type
    if (SB) { ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(SB.bx, SB.by, SB.bw, SB.bh); ctx.strokeStyle = pal.ink; ctx.lineWidth = 0.7 * k; ctx.strokeRect(SB.bx, SB.by, SB.bw, SB.bh); ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = font(7.6, 700); ctx.fillStyle = pal.ink; ctx.fillText('+ ' + t('x38.sc.title').toUpperCase(), SB.bx + SB.pad, SB.by + SB.pad + 6 * k, SB.bw - 2 * SB.pad); ctx.font = font(8, 400); SB.wl.forEach((l2, i) => ctx.fillText(l2, SB.bx + SB.pad, SB.by + SB.pad + 19 * k + i * 11.4 * k, SB.bw - 2 * SB.pad)); ctx.restore(); }
    // the 2045 scenario in a corner box (time.json: the pace of 2015–2025 continued — a scenario, not a forecast)
    else if (TD && TD.projection && !o.noScenario) { const P5 = TD.projection.five, SC = TD.base_scenario; const lines = [t('x38.sc.title'), t('x36.box.need', { a: P5['2025'].toLocaleString('en-US'), b: P5['2045'].toLocaleString('en-US'), n: P5.dwellings_needed_2045.toLocaleString('en-US'), p: SC.persons_per_dwelling })];
      const rtl = root.GA.i18n.dir() === 'rtl', bw = 470 * k, pad = 14 * k; ctx.save(); ctx.font = font(13, 500); const words = lines[1].split(' '); const wl = []; let ln = ''; words.forEach(wd => { const tt = ln ? ln + ' ' + wd : wd; if (ctx.measureText(tt).width > bw - 2 * pad && ln) { wl.push(ln); ln = wd; } else ln = tt; }); wl.push(ln);
      const bh = pad * 2 + 22 * k + wl.length * 18 * k, bx = rtl ? V[0] + 14 * k : V[2] - 14 * k - bw, by = V[3] - 14 * k - bh;
      ctx.fillStyle = 'rgba(255,255,255,.93)'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = pal.line2; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, bw, bh);
      ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.textBaseline = 'alphabetic'; const tx = rtl ? bx + bw - pad : bx + pad;
      ctx.font = font(14, 600); ctx.fillStyle = pal.ink3; ctx.fillText(lines[0], tx, by + pad + 12 * k, bw - 2 * pad); ctx.font = font(13, 500); ctx.fillStyle = pal.ink; wl.forEach((l2, i) => ctx.fillText(l2, tx, by + pad + 32 * k + i * 18 * k, bw - 2 * pad)); ctx.restore(); }
    return { per }; }
  function strategyLegend(t) { const pal = P(), C = pal.ex21, S = pal.ex21s;
    // (analysis style: wk = the width the map draws, in the map's unit k — the strip's 35 m at 1:10,000 with the print weight k = 3.8 px at 200 dpi —
    // and its 85 % tint; w stays for the page scripts that draw a key the older way)
    const tw = (it, e) => (pal.an ? Object.assign(it, e) : it);
    return [baseItem(t, false), tw({ line: S.strip, w: 4, label: t('x38.lg.strip') }, { wk: 7.2, alpha: 0.85 }), { line: S.strip, w: 2, sym: 'join', label: t('x38.lg.join') },
    pal.an ? { sw: S.corridorLine, alpha: 0.28, stroke: S.corridorLine, label: t('x38.lg.corridor') } /* the band's tint: the red under a 72 % white veil, as drawn */ : { sw: '#FFFFFF', stroke: S.corridorLine, label: t('x38.lg.corridor') },
    tw({ line: C.metro, w: 4, label: t('x34.lg.l1') }, { wk: 4 }), tw({ line: C.metro, w: 4, rail: true, label: t('x34.lg.metro') }, { wk: 4 }),
    ...(TD ? ['free', '30-60', '15-30', '0-15'].map(c => ({ sw: edgeCol(c, true), alpha: 0.45, label: t('x36.edge.' + c, { ha: km2(TD.edge_ha[c] || 0) }) })) : []),
    { num: 1, label: t('x38.p.sport') }, { num: 2, label: t('x38.p.river') }, { num: 3, label: t('x38.p.armilla') }, { num: 4, label: t('x38.p.gabias') }]; }
  // the GAPS (owner request, 12 Nov 2026): three small maps of the agglomeration (34 municipalities, INE) — residents
  // change 2015 → 2025, net income per person (ADRH), rent index (IPVA, 2015 = 100) — the base solid, the five towns
  // outlined; then the same three values as bars for Granada city and each of the five towns
  function drawGaps(ctx, x, y, w, h, o) {
    o = o || {}; if (!D) return false; const pal = P(), T = pal.tour, C = pal.ex21; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const k = o.k || w / 1000;
    const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`; const rtl = root.GA.i18n.dir() === 'rtl';
    const cls = (v, br, cols) => { if (v == null) return null; let i = 0; while (i < br.length && v >= br[i]) i++; return cols[i]; };
    const vars = [['chg', T.chgBreaks, T.chg, (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' %', 'x34.gap.chg'], ['inc', T.incBreaks, T.inc, (v) => '€' + Math.round(v).toLocaleString('en-US'), 'x34.gap.inc'], ['rent', T.rentBreaks, T.rent, (v) => v.toFixed(1), 'x34.gap.rent']];
    // fit the 34 municipalities
    let a0 = 1e12, b0 = 1e12, a1 = -1e12, b1 = -1e12; D.area.forEach(m => m.g.forEach(r => r.forEach(([u, v]) => { a0 = Math.min(a0, u); b0 = Math.min(b0, v); a1 = Math.max(a1, u); b1 = Math.max(b1, v); })));
    // one map: the 34 municipalities by class, the five towns and Granada city outlined, the base solid. hb = [x, y, w, h] of the box the "no value"
    // hatch spans; dashG (the sheets' pieces): Granada city's outline dashed, to tell it from the five towns where both are black
    const mapOf = (key, br, cols, X, Y, hb, dashG) => { const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, j) => j ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.closePath(); };
      D.area.forEach(m => { path(m.g); const c = cls(m.p[key], br, cols); if (c) { ctx.fillStyle = c; ctx.fill('evenodd'); } else { ctx.save(); ctx.clip('evenodd'); ctx.strokeStyle = T.missing; ctx.lineWidth = 1 * k; ctx.beginPath(); for (let q = -hb[3]; q < hb[2] + hb[3]; q += 5 * k) { ctx.moveTo(hb[0] + q, hb[1] + hb[3]); ctx.lineTo(hb[0] + q + hb[3], hb[1]); } ctx.stroke(); ctx.restore(); }
        path(m.g); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.8 * k; ctx.stroke(); });
      D.area.filter(m => m.p.five || m.p.name === 'Granada').forEach(m => { path(m.g); ctx.strokeStyle = m.p.five ? pal.ink : C.metro; ctx.lineWidth = (m.p.five ? 1.8 : 2.4) * k; if (dashG && !m.p.five) ctx.setLineDash([4.5 * k, 2.8 * k]); ctx.stroke(); if (dashG) ctx.setLineDash([]); });
      const base = D.edge.find(f => f.p.k === 'base'); if (base) { path(base.g); ctx.fillStyle = C.base; ctx.fill(); } };
    // the bars of one value: Granada city and the five towns, mw wide from ox, each row rh high from by
    const rows = D.area.filter(m => m.p.name === 'Granada' || m.p.five).sort((p, q) => (p.p.name === 'Granada' ? -1 : q.p.name === 'Granada' ? 1 : q.p.chg - p.p.chg));
    const barsOf = (key, br, cols, fmt, ox, mw, by, rh, signed) => { const base0 = key === 'rent' ? 100 : 0; /* the rent index starts at 100 (2015) */ const vals = rows.map(m => m.p[key]).filter(v => v != null); const vmax = Math.max(...vals.map(v => Math.abs(v - base0))) * 1.15; const lab = 92 * k, bw = mw - lab - 54 * k;
      // signed (the analysis sheets' pieces): a value under the start of the bars (fewer residents than in 2015) is drawn to the other side of the
      // axis, and the axis moves in by the longest such bar; unit = px per unit of the value
      const neg = signed ? Math.max(0, ...vals.map(v => base0 - v)) : 0, unit = signed ? bw / ((Math.max(0, ...vals.map(v => v - base0)) + neg) * 1.15 || 1) : 0, off = neg * unit;
      rows.forEach((m, j) => { const cy = by + rh * (j + 0.5), v = m.p[key]; const bx0 = rtl ? ox + mw - lab : ox + lab, bx = bx0 + (rtl ? -off : off);
        ctx.font = font(9.5, m.p.name === 'Granada' ? 700 : 500); ctx.fillStyle = pal.ink; ctx.textAlign = rtl ? 'left' : 'right'; ctx.direction = 'ltr'; ctx.textBaseline = 'middle'; ctx.fillText(m.p.name.replace(' de la Vega', ''), rtl ? bx0 + 6 * k : bx0 - 6 * k, cy);
        if (v == null) { ctx.fillStyle = pal.ink3; ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText('—', rtl ? bx - 4 * k : bx + 4 * k, cy); return; }
        const L = signed ? Math.abs(v - base0) * unit : Math.abs(v - base0) / vmax * bw, back = signed && v < base0, rx = (rtl ? !back : back) ? bx - L : bx; ctx.fillStyle = cls(v, br, cols); ctx.fillRect(rx, cy - rh * 0.3, L, rh * 0.6); ctx.strokeStyle = 'rgba(41,16,12,.25)'; ctx.lineWidth = 1; ctx.strokeRect(rx, cy - rh * 0.3, L, rh * 0.6);
        ctx.fillStyle = pal.ink; ctx.font = font(9.5, 700); ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText(pal.an ? fmt(v).replace('-', '−') : fmt(v), rtl ? bx - (back ? 0 : L) - 5 * k : bx + (back ? 0 : L) + 5 * k, cy); });   // (analysis sheets: a true minus sign, as in their notes)
      return { x0: (rtl ? ox + mw - lab : ox + lab) + (rtl ? -off : off), bw, base0, vmax, rows: rows.length }; };
    // o.part (the analysis sheets lay the panel out themselves): one piece at a time, for the value o.key ('chg' | 'inc' | 'rent') —
    // 'map' = that map alone in the window x, y, w, h at o.sc px per metre, centred; 'bars' = its bars in the box x, y, w, h
    if (o.part) { const v = vars.find(q => q[0] === o.key); if (!v) return false;
      if (o.part === 'map') { const sc = o.sc || Math.min(w / (a1 - a0), h / (b1 - b0)), X = (u) => x + w / 2 + (u - (a0 + a1) / 2) * sc, Y = (q) => y + h / 2 - (q - (b0 + b1) / 2) * sc;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.lineJoin = 'round'; ctx.lineCap = 'butt'; ctx.setLineDash([]); mapOf(v[0], v[1], v[2], X, Y, [x, y, w, h], true); ctx.restore();
        return { sc, n: D.area.length, missing: D.area.filter(m => m.p[v[0]] == null).length, fits: (a1 - a0) * sc <= w && (b1 - b0) * sc <= h }; }
      ctx.save(); const r = barsOf(v[0], v[1], v[2], v[3], x, w, y, h / rows.length, true); ctx.restore(); return r; }
    const gap = 26 * k, mw = (w - 2 * gap) / 3, mh = Math.min(h * 0.62, mw * (b1 - b0) / (a1 - a0)); const sc = Math.min(mw / (a1 - a0), mh / (b1 - b0));
    vars.forEach(([key, br, cols, fmt, title], i) => { const ox = x + (rtl ? 2 - i : i) * (mw + gap), oy = y + 34 * k; const X = (u) => ox + (u - a0) * sc + (mw - (a1 - a0) * sc) / 2, Y = (v) => oy + (b1 - v) * sc;
      ctx.font = font(13, 600); ctx.fillStyle = pal.ink3; ctx.textAlign = rtl ? 'right' : 'left'; ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t(title), rtl ? ox + mw : ox, y + 16 * k);
      mapOf(key, br, cols, X, Y, [ox, oy, mw, mh], false);
      // class legend under the map
      const lx = ox, ly = oy + mh + 14 * k, cw = mw / cols.length; cols.forEach((c, j) => { ctx.fillStyle = c; ctx.fillRect(lx + j * cw, ly, cw - 2 * k, 10 * k); });
      ctx.font = font(9, 500); ctx.fillStyle = pal.ink2; ctx.textAlign = 'center'; ctx.direction = 'ltr'; br.forEach((b, j) => ctx.fillText(key === 'inc' ? (b / 1000) + 'k' : String(b), lx + (j + 1) * cw - 1 * k, ly + 22 * k)); });
    // bars: Granada city and the five towns
    const by = y + 34 * k + mh + 46 * k, rh = (y + h - by) / rows.length;
    vars.forEach(([key, br, cols, fmt], i) => { barsOf(key, br, cols, fmt, x + (rtl ? 2 - i : i) * (mw + gap), mw, by, rh); });
    return true;
  }
  // inset for map 03: the whole line 1 today (Albolote → Granada → Armilla) and its extension past the base
  function drawLineInset(ctx, x, y, w, h, k, t, font) { const pal = P(), C = pal.ex21, MC = metroCol('growth'); const E = CITY; const pts = D.l1.lines.flat().concat(D.metro.filter(f => f.p.k === 'track').flatMap(f => f.g.flat()));
    // the frame holds the whole line AND the main map's frame, between a header band (title, figures) and a footer band (source)
    let a0 = E.x0, b0 = E.y0, a1 = E.x1, b1 = E.y1; pts.forEach(([u, v]) => { a0 = Math.min(a0, u); b0 = Math.min(b0, v); a1 = Math.max(a1, u); b1 = Math.max(b1, v); });
    const pad = 12 * k, top = 36 * k, foot = 18 * k, sc = Math.min((w - 2 * pad) / (a1 - a0), (h - top - foot - 2 * pad) / (b1 - b0)); const ox = x + (w - (a1 - a0) * sc) / 2, oy = y + top + pad;
    const X = (u) => ox + (u - a0) * sc, Y = (v) => oy + (b1 - v) * sc; const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); };
    ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.rect(x, y + top, w, h - top - foot); ctx.clip();
    D.area.forEach(m => { path(m.g); ctx.closePath(); if (m.p.name === 'Granada') { ctx.fillStyle = pal.gray1; ctx.fill('evenodd'); } ctx.strokeStyle = C.muni; ctx.lineWidth = 0.6 * k; ctx.stroke(); });
    const base = D.edge.find(f => f.p.k === 'base'); if (base) { path(base.g); ctx.closePath(); ctx.fillStyle = C.base; ctx.fill(); }
    ctx.strokeStyle = MC; ctx.lineWidth = 3 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); D.l1.lines.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke();
    D.metro.filter(f => f.p.k === 'track').forEach(f => { path(f.g); ctx.strokeStyle = MC; ctx.lineWidth = 3 * k; ctx.stroke(); path(f.g); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([3 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); });
    D.l1.stops.forEach(st => { ctx.beginPath(); ctx.arc(X(st.p[0]), Y(st.p[1]), 2.4 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = MC; ctx.lineWidth = 1.2 * k; ctx.stroke(); });
    // the main map's frame
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.4 * k; ctx.strokeRect(X(E.x0), Y(E.y1), (E.x1 - E.x0) * sc, (E.y1 - E.y0) * sc);
    ctx.font = font(9, 700); ctx.fillStyle = pal.ink; ctx.textBaseline = 'middle'; ctx.lineWidth = 3 * k; ctx.strokeStyle = '#FFFFFF'; ctx.direction = 'ltr';
    const lab = (txt, p, dx, dy, al) => { ctx.textAlign = al; ctx.strokeText(txt, X(p[0]) + dx, Y(p[1]) + dy); ctx.fillText(txt, X(p[0]) + dx, Y(p[1]) + dy); };
    const byName = (n) => D.l1.stops.find(st => st.name === n); [['Albolote', 8], ['Recogidas', -8], ['Armilla', 8]].forEach(([n, dx]) => { const st = byName(n); if (st) lab(n === 'Recogidas' ? 'GRANADA' : n, st.p, dx * k, n === 'Armilla' ? 9 * k : 0, dx < 0 ? 'right' : 'left'); });
    const term = D.metro.find(f => f.p.k === 'terminus'); if (term) { if (pal.an) lab('Las Gabias', term.g, 8 * k, 11 * k, 'right'); /* clear of the base's black solid */ else lab('Las Gabias', term.g, 0, 11 * k, 'center'); }
    // (analysis style) the inset's own scale: a 2 km bar in its bottom corner, on a small white plate; a thin ink frame as the map windows have
    if (pal.an) { const L2 = 2000 * sc, sx = x + w - 10 * k - L2, sy = y + h - foot - 8 * k; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(sx - 4 * k, sy - 13 * k, L2 + 8 * k, 17 * k); ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1, 0.8 * k); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(sx, sy - 2.5 * k); ctx.lineTo(sx, sy); ctx.lineTo(sx + L2, sy); ctx.lineTo(sx + L2, sy - 2.5 * k); ctx.stroke();
      ctx.font = font(7.5, 500); ctx.fillStyle = pal.ink3; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('2 km', sx + L2 / 2, sy - 4 * k); }
    ctx.restore(); if (pal.an) { ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1, 0.7 * k); } else { ctx.strokeStyle = pal.line2; ctx.lineWidth = 1; } ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = font(9.5, 600); ctx.fillStyle = pal.ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t('x34.inset.title'), x + 8 * k, y + 16 * k, w - 16 * k);
    ctx.font = font(8, 500); ctx.fillStyle = pal.ink2; const m = D.l1.meta; ctx.fillText(t('x34.inset.meta', { n: m.stops.length, d: m.duration_min, i: m.interval_min }), x + 8 * k, y + 29 * k, w - 16 * k);
    ctx.fillText(t('x34.inset.src'), x + 8 * k, y + h - 6 * k, w - 16 * k); }
  // ---------- AREA level (1:500): four 130 m windows on the edge (data/ex21/areas.json, tools/build_ex21_areas.py) ----------
  let AR = null, ARp = null;
  // two sets of 1:500 windows: 'base' (areas.json, A–H) and 'factory' (factory_areas.json, J–P); the last one asked for is the current one
  const ARS = {}; function readyAreas(set) { const f = set === 'factory' ? 'factory_areas.json' : 'areas.json'; if (!ARS[f]) ARS[f] = fetch('data/ex21/' + f + '?v=' + (root.GA_BUILD || '')).then(r => r.json()).catch(e => { delete ARS[f]; throw e; });
    return (ARp = ARS[f].then(j => (AR = j))); }
  // the aerial photo of a window (PNOA, IGN, CC BY 4.0; tools/build_ex21_aerial.py) and its flight date / resolution
  let AER = null, AERp = null; const AERIMG = {};
  function readyAerial() { if (AERp) return AERp; AERp = fetch('data/ex21/aerial/index.json?v=' + (root.GA_BUILD || '')).then(r => r.json()).then(j => (AER = j)).catch(e => { AERp = null; throw e; }); return AERp; }
  function loadAerial(id, base) { const u = (base || 'data/ex21/aerial/') + id + '.jpg'; if (AERIMG[u]) return AERIMG[u];
    return (AERIMG[u] = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { delete AERIMG[u]; rej(new Error('aerial ' + id)); }; im.src = u + '?v=' + (root.GA_BUILD || ''); })); }
  // legend of the aerial version: only what is drawn over the photo
  function aerialLegend(t, id) { const pal = P(), C = pal.ex21; const as = (AR ? AR.areas : []).filter(a => !id || a.id === id);
    const metro = as.some(a => (a.metro || []).some(m => m.k === 'track')), dead = as.some(a => (a.dead || []).length);
    return (as.some(a => (a.fence || []).length) ? [{ line: C.fence.housing, w: 2, label: t('x34.lg.fenceAny') }] : []).concat(as.some(a => (a.plots || []).length) ? [{ line: pal.ink, w: 1, dash: true, label: t('x34.lg.plot') }] : [])
      .concat(dead ? [{ line: C.dead, w: 2, sym: 'dead', label: t('x34.lg.dead') }] : []).concat(metro ? [{ line: C.metro, w: 3, rail: true, label: t('x34.lg.metro') }] : [])
      .concat([{ line: pal.red, w: 1.5, dash: true, label: t('x34.lg.secline') }]); }
  const floorsCol = (lv) => { const b = P().band; return lv == null ? null : lv <= 2 ? b['1-2'] : lv <= 4 ? b['3-4'] : lv <= 8 ? b['5-8'] : b['9+']; };
  function drawArea(ctx, x, y, S, id, o) {
    o = o || {}; const A = AR && AR.areas.find(a => a.id === id); if (!A) return false; const pal = P(), C = pal.ex21, LU = pal.landuse; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const k = o.k || S / 1000;
    const e = A.extent, mpp = (e[2] - e[0]) / S; const X = (u) => x + (u - e[0]) / mpp, Y = (v) => y + (e[3] - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs, close) => { ctx.beginPath(); rs.forEach(rr => rr.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))))); if (close) ctx.closePath(); };
    const U = furniture(ctx, o, x, y, S, S, k, F), V = U.V;
    ctx.save(); ctx.beginPath(); ctx.rect(V[0], V[1], V[2] - V[0], V[3] - V[1]); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, S, S); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.direction = 'ltr';   // street names and the section letters (B′) are Latin script: left to right on every page (on RTL pages B′ was drawn ′B)
    // 15 Nov 2026 (owner request): o.aerial = the PNOA orthophoto of the same window (GA.ex21.loadAerial) — drawn as served,
    // nothing edited; only the fence, dead ends, metro, street names and the section line are laid over it
    const aer = o.aerial || null; if (aer) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(aer, x, y, S, S); }
    if (!aer) {
    // land use (OSM), light
    A.landuse.forEach(l => { const c = { residential: LU.residential, industrial: LU.industrial, commercial: LU.commercial, retail: LU.commercial, farmland: LU.agri, meadow: LU.agri, orchard: LU.agri, grass: LU.green, construction: LU.construction }[l.lu]; if (!c) return; path(l.r, true); ctx.globalAlpha = 0.22; ctx.fillStyle = c; ctx.fill('evenodd'); ctx.globalAlpha = 1; });
    // land use in the 300 m band (OSM landuse + parks; the tour's band classes)
    (A.bandlu || []).forEach(l => { path(l.r, true); ctx.globalAlpha = 0.5; ctx.fillStyle = pal.tour.bandlu[l.c] || pal.grey3; ctx.fill('evenodd'); ctx.globalAlpha = 1; });
    // the base
    path(A.base, true); ctx.fillStyle = C.base; ctx.fill('evenodd');
    // streets and paths (OSM): width by type, paths dashed
    const W = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, residential: 4, living_street: 3.5, unclassified: 4, service: 2.6, pedestrian: 3, footway: 1.4, path: 1.4, cycleway: 1.4, track: 2, steps: 1.4 };
    A.streets.forEach(st => { const w0 = (W[st.hw] || 2) / mpp * 1.0; ctx.strokeStyle = C.street; ctx.lineWidth = Math.max(1, w0); ctx.setLineDash(/footway|path|cycleway|track|steps/.test(st.hw) ? [4 * k, 3 * k] : []); path(st.r); ctx.stroke(); ctx.setLineDash([]); });
    // buildings by floors (OSM building:levels), outline; unknown = hatched
    A.buildings.forEach(b => { path(b.r, true); if (b.hu) { ctx.fillStyle = '#FFFFFF'; ctx.fill('evenodd'); ctx.strokeStyle = pal.ink; ctx.lineWidth = 0.9 * k; ctx.setLineDash([3 * k, 2 * k]); ctx.stroke(); ctx.setLineDash([]); return; }
      const c = floorsCol(b.lv); if (c) { ctx.fillStyle = c; ctx.fill('evenodd'); } ctx.strokeStyle = pal.ink; ctx.lineWidth = 0.7 * k; ctx.stroke(); });
    // trees (OSM)
    // tree crowns read from the PNOA aerial photo (approximate; tools/build_ex21_canopy.py), true crown width
    (A.canopy || []).forEach(([u, v, dm]) => { ctx.beginPath(); ctx.arc(X(u), Y(v), Math.max(1.2, dm / 2) / mpp, 0, 7); ctx.fillStyle = 'rgba(126,123,67,.45)'; ctx.fill(); ctx.strokeStyle = pal.olive; ctx.lineWidth = 0.6 * k; ctx.stroke(); });
    A.trees.forEach(([u, v]) => { ctx.beginPath(); ctx.arc(X(u), Y(v), 2.2 / mpp, 0, 7); ctx.fillStyle = 'rgba(126,123,67,.35)'; ctx.fill(); ctx.strokeStyle = pal.olive; ctx.lineWidth = 0.8 * k; ctx.stroke(); });
    }
    // public places (OSM: schools, sports centres, pools, parks …) — a dotted outline; water courses (OSM) in blue
    (A.places || []).forEach(q => { path(q.r, true); if (!aer) { ctx.fillStyle = 'rgba(79,110,128,.12)'; ctx.fill('evenodd'); } ctx.strokeStyle = aer ? '#FFFFFF' : pal.blue; ctx.lineWidth = 1.8 * k; ctx.setLineDash([2 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); });
    (A.water || []).forEach(q => { const big = q.ww === 'river'; ctx.strokeStyle = aer ? 'rgba(255,255,255,.9)' : '#FFFFFF'; ctx.lineWidth = (big ? 9 : 5) * k; path(q.r); ctx.stroke(); ctx.strokeStyle = pal.base.lightBlue; ctx.lineWidth = (big ? 6 : 3) * k; path(q.r); ctx.stroke(); });
    // named plots (the factory set): a dashed outline and the name
    (A.plots || []).forEach(q => { path(q.r, true); if (aer) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4 * k; ctx.stroke(); } ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6 * k; ctx.setLineDash([8 * k, 4 * k]); ctx.stroke(); ctx.setLineDash([]); });
    // the fence by what lies outside it, dead ends, metro (over the photo: a thinner line on a white casing, so the real edge stays visible)
    if (aer) A.fence.forEach(f => { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5.4 * k; path(f.r); ctx.stroke(); ctx.strokeStyle = C.fence[f.c] || C.baseLine; ctx.lineWidth = 3 * k; path(f.r); ctx.stroke(); });
    else A.fence.forEach(f => { ctx.strokeStyle = C.fence[f.c] || C.baseLine; ctx.lineWidth = 7 * k; path(f.r); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([2 * k, 5 * k]); path(f.r); ctx.stroke(); ctx.setLineDash([]); });
    A.metro.forEach(m => { if (m.k === 'track') { ctx.strokeStyle = C.metro; ctx.lineWidth = 8 * k; path(m.r); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3 * k; ctx.setLineDash([9 * k, 9 * k]); path(m.r); ctx.stroke(); ctx.setLineDash([]); } });
    A.dead.forEach(([u, v]) => { ctx.beginPath(); ctx.arc(X(u), Y(v), 9 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.dead; ctx.lineWidth = 3.4 * k; ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(u) - 5 * k, Y(v)); ctx.lineTo(X(u) + 5 * k, Y(v)); ctx.stroke(); });
    // street names (OSM)
    ctx.font = font(9.5, 500); ctx.fillStyle = pal.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const named = new Set();
    // (the name goes on the first stretch of the street, from its middle outwards, where it fits whole inside the window and clear of the title)
    A.streets.forEach(st => { if (!st.nm || named.has(st.nm) || /footway|path|service|track/.test(st.hw)) return; const r = st.r[0] && st.r[0][0]; if (!r || r.length < 2) return; const n = r.length, mid = Math.max(1, Math.floor(n / 2)), tw = ctx.measureText(st.nm).width;
      const order = []; for (let d = 0; d < n; d++) { if (mid + d < n) order.push(mid + d); if (d && mid - d >= 1) order.push(mid - d); }
      for (const i of order) { const p0 = r[i - 1], p1 = r[i]; const cx = X((p0[0] + p1[0]) / 2), cy = Y((p0[1] + p1[1]) / 2); let ang = Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
        const dx = Math.abs(Math.cos(ang)) * tw / 2 + 8 * k, dy = Math.abs(Math.sin(ang)) * tw / 2 + 8 * k; if (cx - dx < V[0] || cx + dx > V[2] || cy - dy < V[1] || cy + dy > V[3]) continue;
        if (U.K.some(q => cx + dx > q[0] && cx - dx < q[2] && cy + dy > q[1] && cy - dy < q[3])) continue;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.lineWidth = 3 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(st.nm, 0, 0); ctx.fillText(st.nm, 0, 0); ctx.restore(); named.add(st.nm); break; } });
    // (a name sits on the part of its place that is inside the window, whole, and clear of the title and the north arrow)
    const inV = (c) => { const u = X(c[0]), v = Y(c[1]); return u >= V[0] && u <= V[2] && v >= V[1] && v <= V[3]; };
    const putName = (txt, cx, cy, col) => { ctx.font = font(11, 700); const q = place(V, U.K, cx, cy, ctx.measureText(txt).width, 16 * k, 7 * k); if (!q) return; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3.4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(txt, q[0], q[1]); ctx.fillStyle = col; ctx.fillText(txt, q[0], q[1]); };
    const labelAt = (rs, txt, col) => { let n = 0, sx = 0, sy = 0; rs.forEach(pg => (pg[0] || []).forEach(c => { if (!inV(c)) return; sx += c[0]; sy += c[1]; n++; })); if (!n || !txt) return; putName(txt, X(sx / n), Y(sy / n), col); };
    const seenNm = new Set(); (A.places || []).forEach(q => { if (q.nm && !seenNm.has(q.nm)) { seenNm.add(q.nm); labelAt(q.r, q.nm, pal.blue); } });
    (A.water || []).forEach(q => { if (q.nm && !seenNm.has(q.nm)) { seenNm.add(q.nm); const r = q.r[0] && q.r[0][0]; if (r && r.length > 1) { const ins = r.filter(inV), m = ins.length ? ins[Math.floor(ins.length / 2)] : null; if (m) putName(q.nm, X(m[0]), Y(m[1]) - 12 * k, pal.blue); } } });
    (A.plots || []).forEach(q => labelAt(q.r, q.nm.replace(/ \(.*\)$/, ''), pal.ink));
    // section line A–A′
    const sa = A.section.a, sb = A.section.b;
    if (aer) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4.4 * k; ctx.beginPath(); ctx.moveTo(X(sa[0]), Y(sa[1])); ctx.lineTo(X(sb[0]), Y(sb[1])); ctx.stroke(); }
    ctx.strokeStyle = pal.red; ctx.lineWidth = (aer ? 2.2 : 1.8) * k; ctx.setLineDash([10 * k, 5 * k]); ctx.beginPath(); ctx.moveTo(X(sa[0]), Y(sa[1])); ctx.lineTo(X(sb[0]), Y(sb[1])); ctx.stroke(); ctx.setLineDash([]);
    [[sa, A.id], [sb, A.id + '′']].forEach(([p, n]) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = font(12, 700); ctx.textAlign = 'center'; ctx.fillText(n, X(p[0]), Y(p[1]) + 0.5 * k); });
    ctx.restore(); frameTop(ctx, o, U, k, F, true);
    // scale bar 0–10–20–50 m
    // (it goes to the first bottom corner of the window where it hides neither end of the section nor a dead end: left, then right)
    const m50 = 50 / mpp, pw = m50 + 46 * k, ph = 30 * k, spots = [[V[0] + 10 * k, V[3] - 10 * k - ph], [V[2] - 10 * k - pw, V[3] - 10 * k - ph]];
    const hides = ([px, py]) => [sa, sb].concat(A.dead).some(q => { const u = X(q[0]), v = Y(q[1]); return u > px - 14 * k && u < px + pw + 14 * k && v > py - 14 * k && v < py + ph + 14 * k; });
    const spot = spots.find(q => !hides(q)) || spots[0], bx = spot[0] + 6 * k, by = spot[1] + 20 * k; if (!o.noScale) scaleBar(ctx, bx, by, m50, k, font, [['0', 0], ['10', 0.2], ['20', 0.4], ['50 m', 1]]);
    if (o.credit) creditMark(ctx, o, V, k, F, spot === spots[1]);
    return true;
  }
  // key map: the base and its fence (as map 01) with the eight 1:500 windows
  function drawAreaKey(ctx, x, y, w, h, o) { o = o || {}; if (!D || !AR) return false; const pal = P(); const t = o.t || ((s) => s); const k = o.k || w / 1000; const F = root.GA.pages.font();
    const E = CITY, mpp = (E.x1 - E.x0) / w; const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp;
    // (analysis style) each letter sits beside its window on the side away from the base: clear of the fence, of the other windows and of the
    // letters placed before it (first free place, turning away from the outward direction step by step); the town names then keep clear of
    // the windows and the letters (drawCity o.tidy, o.obst)
    const LP = pal.an ? (() => { const b0 = D.edge.find(f => f.p.k === 'base'); if (!b0) return null; const segs = [], out = {}, done = [], r = 11 * k, V = o.view || [x, y, x + w, y + h]; let sx = 0, sy = 0, n = 0;
      b0.g.forEach(rg => { for (let i = 1; i < rg.length; i++) segs.push([X(rg[i - 1][0]), Y(rg[i - 1][1]), X(rg[i][0]), Y(rg[i][1])]); rg.forEach(p => { sx += X(p[0]); sy += Y(p[1]); n++; }); }); const bc = [sx / n, sy / n];
      const dSeg = (px, py, s) => { const dx = s[2] - s[0], dy = s[3] - s[1], q = Math.max(0, Math.min(1, ((px - s[0]) * dx + (py - s[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - s[0] - q * dx, py - s[1] - q * dy); };
      const inside = (px, py) => { let c = false; b0.g.forEach(rg => { for (let i = 0, j = rg.length - 1; i < rg.length; j = i++) { const xi = X(rg[i][0]), yi = Y(rg[i][1]), xj = X(rg[j][0]), yj = Y(rg[j][1]); if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } }); return c; };
      const wins = AR.areas.map(a => [X(a.extent[0]), Y(a.extent[3]), X(a.extent[2]), Y(a.extent[1])]);
      AR.areas.forEach((a, ai) => { const wb = wins[ai], wc = [(wb[0] + wb[2]) / 2, (wb[1] + wb[3]) / 2], hs = (wb[2] - wb[0]) / 2, a0 = Math.atan2(wc[1] - bc[1], wc[0] - bc[0]); let best = null;
        [0, 25, -25, 50, -50, 75, -75, 100, -100, 130, -130, 160, -160, 180].some(dg => { const an = a0 + dg * Math.PI / 180, dx = Math.cos(an), dy = Math.sin(an), dd = hs / Math.max(Math.abs(dx), Math.abs(dy)) + r + 3 * k, c = [wc[0] + dx * dd, wc[1] + dy * dd];
          const ok = c[0] - r > V[0] + 4 * k && c[0] + r < V[2] - 4 * k && c[1] - r > V[1] + 4 * k && c[1] + r < V[3] - 4 * k && !inside(c[0], c[1]) && !segs.some(s => dSeg(c[0], c[1], s) < r + 3 * k)
            && !wins.some((q, qi) => qi !== ai && c[0] + r > q[0] - 2 * k && c[0] - r < q[2] + 2 * k && c[1] + r > q[1] - 2 * k && c[1] - r < q[3] + 2 * k) && !done.some(q => Math.hypot(q[0] - c[0], q[1] - c[1]) < 2 * r + 2 * k);
          if (ok) best = c; return ok; });
        out[a.id] = best || [wc[0], wb[1] - 14 * k]; done.push(out[a.id]); });
      return { at: out, boxes: wins.map(q => [q[0] - 3 * k, q[1] - 3 * k, q[2] + 3 * k, q[3] + 3 * k]).concat(done.map(q => [q[0] - r - 3 * k, q[1] - r - 3 * k, q[0] + r + 3 * k, q[1] + r + 3 * k])) }; })() : null;
    drawCity(ctx, x, y, w, h, Object.assign({ t, only: 'island', k, title: o.title, titlePx: o.titlePx, credit: o.credit, creditPx: o.creditPx, baseSubject: false, noNorth: o.noNorth, noScale: o.noScale }, LP ? { tidy: true, obst: { boxes: LP.boxes } } : {})); /* the windows are the red thing here */
    AR.areas.forEach(a => { const e = a.extent; ctx.fillStyle = pal.red; ctx.globalAlpha = 0.18; ctx.fillRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp); ctx.globalAlpha = 1; ctx.strokeStyle = pal.red; ctx.lineWidth = 2.4 * k; ctx.strokeRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp);
      const below = AR.areas.some(b => b !== a && Math.abs(b.centre[0] - a.centre[0]) < 250 && b.centre[1] > a.centre[1] && b.centre[1] - a.centre[1] < 320);   // another window just north: this letter goes under its square
      const cx = LP ? LP.at[a.id][0] : X((e[0] + e[2]) / 2), cy = LP ? LP.at[a.id][1] : below ? Y(e[1]) + 14 * k : Y(e[3]) - 14 * k; ctx.beginPath(); ctx.arc(cx, cy, 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = `700 ${Math.round(12 * k)}px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.fillText(a.id, cx, cy + 0.5 * k); });
    return true; }
  // legend of the key map: map 01's legend plus the 1:500 window
  function keyLegend(t) { const pal = P(); return mapLegend('island', t, false).concat([{ sw: pal.red, alpha: 0.18, stroke: pal.red, label: t('x34.lg.window') }]); }
  // the section across the fence, true scale (1:500 both ways); building heights = floors × 3 m (estimate)
  // legend of the area maps: the band land use present in any window, floors, streets, fence, dead ends, section
  function areaLegend(t) { const pal = P(), C = pal.ex21, b = pal.band; const as = AR ? AR.areas : []; const used = new Set(); as.forEach(a => (a.bandlu || []).forEach(l => used.add(l.c)));
    const any = (f) => as.some(f), cat = AR && AR.floors_source === 'catastro';
    return (any(a => (a.base || []).length) ? [{ sw: C.base, label: t('x34.lg.base') }] : []).concat([...used].map(c => ({ sw: pal.tour.bandlu[c], alpha: 0.5, label: t((AR.set === 'factory' ? 'x35.lg.lu.' : 'x34.lg.lu.') + c) })))
      .concat([{ sw: b['1-2'], label: t(cat ? 'x34.lg.fl.12c' : 'x34.lg.fl.12') }, { sw: b['3-4'], label: t('x34.lg.fl.34') }, { sw: b['5-8'], label: t('x34.lg.fl.58') }, { line: C.street, w: 3, label: t('x34.lg.street') }, { line: C.street, w: 1, dash: true, label: t('x34.lg.path') }])
      .concat(any(a => (a.plots || []).length) ? [{ line: pal.ink, w: 1, dash: true, label: t('x34.lg.plot') }] : [])
      .concat(any(a => (a.places || []).length) ? [{ sw: 'rgba(79,110,128,.12)', stroke: pal.blue, label: t('x34.lg.place') }] : []).concat(any(a => (a.water || []).length) ? [{ line: pal.base.lightBlue, w: 3, label: t('x34.lg.water') }] : [])
      .concat(any(a => (a.buildings || []).some(b => b.hu)) ? [{ sw: '#FFFFFF', stroke: pal.ink, dashed: true, label: t('x34.lg.hu') }] : [])
      .concat(any(a => (a.fence || []).length) ? [{ line: C.fence.housing, w: 3, label: t('x34.lg.fenceAny') }] : []).concat(any(a => (a.dead || []).length) ? [{ line: C.dead, w: 2, sym: 'dead', label: t('x34.lg.dead') }] : [])
      .concat([{ sw: pal.olive, alpha: 0.45, label: t('x34.lg.canopy') }, { line: pal.red, w: 1.5, dash: true, label: t('x34.lg.secline') }]); }
  function drawSection(ctx, x, y, w, h, id, o) {
    o = o || {}; const A = AR && AR.areas.find(a => a.id === id); if (!A) return false; const pal = P(), C = pal.ex21; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const k = o.k || w / 1000;
    const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`; const sm = A.section.samples, L = sm[sm.length - 1][0];
    const zmin = Math.min(...sm.map(s => s[1])) - 4; const sc = w / L; /* true scale both ways (1:500 when the map is) */ const ox = x, oy = y + h; const zTop = zmin + h / sc;
    const X = (d) => ox + d * sc, Z = (z) => oy - (z - zmin) * sc;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // ground
    ctx.beginPath(); ctx.moveTo(X(0), oy); sm.forEach(s => ctx.lineTo(X(s[0]), Z(s[1]))); ctx.lineTo(X(L), oy); ctx.closePath(); ctx.fillStyle = pal.base.cream; ctx.fill(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6 * k; ctx.beginPath(); sm.forEach((s, i) => i ? ctx.lineTo(X(s[0]), Z(s[1])) : ctx.moveTo(X(s[0]), Z(s[1]))); ctx.stroke();
    // the base side
    const fa = A.section.fence_at_m; ctx.fillStyle = C.base; ctx.globalAlpha = 0.18; ctx.fillRect(X(fa), y, X(L) - X(fa), h); ctx.globalAlpha = 1;
    // buildings
    const gAt = (d) => { const i = Math.max(0, Math.min(sm.length - 1, Math.round(d))); return sm[i][1]; };
    A.section.cuts.forEach(c => { const g = Math.min(gAt(c.s0), gAt(c.s1)); if (c.h_est == null) { ctx.strokeStyle = pal.ink3; ctx.setLineDash([3 * k, 3 * k]); ctx.strokeRect(X(c.s0), Z(g + 6), (c.s1 - c.s0) * sc, 6 * sc); ctx.setLineDash([]); return; }
      ctx.fillStyle = floorsCol(c.lv); ctx.fillRect(X(c.s0), Z(g + c.h_est), (c.s1 - c.s0) * sc, c.h_est * sc); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(X(c.s0), Z(g + c.h_est), (c.s1 - c.s0) * sc, c.h_est * sc);
      ctx.font = font(9, 600); ctx.fillStyle = pal.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(c.lv + 'F', X((c.s0 + c.s1) / 2), Z(g + c.h_est) - 2 * k); });
    // fence (height not mapped)
    ctx.strokeStyle = C.fence[A.kind] || C.baseLine; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.moveTo(X(fa), Z(gAt(fa))); ctx.lineTo(X(fa), Z(gAt(fa) + 2.5)); ctx.stroke();
    // the limit surface
    const top = y + 18 * k; const ZL = (z) => z > zTop - 18 / sc * k ? top : Z(z);
    ctx.strokeStyle = pal.red; ctx.lineWidth = 2 * k; ctx.setLineDash([12 * k, 6 * k]); ctx.beginPath(); sm.forEach((s, i) => { if (!isFinite(s[2])) return; i ? ctx.lineTo(X(s[0]), ZL(s[2])) : ctx.moveTo(X(s[0]), ZL(s[2])); }); ctx.stroke(); ctx.setLineDash([]);
    // where the surface is higher than the drawing: a break (zigzag) on the line, the true height written
    sm.forEach((s, i) => { if (i % 40 !== 20 || !(s[2] > zTop - 18 / sc * k)) return; const px = X(s[0]); ctx.strokeStyle = pal.red; ctx.lineWidth = 1.4 * k; ctx.beginPath(); ctx.moveTo(px - 6 * k, top + 6 * k); ctx.lineTo(px - 2 * k, top - 6 * k); ctx.lineTo(px + 2 * k, top + 6 * k); ctx.lineTo(px + 6 * k, top - 6 * k); ctx.stroke(); });
    ctx.restore();
    // annotations
    const gF = gAt(fa), lF = sm[Math.round(fa)][2]; const lFy = ZL(lF); ctx.font = font(10, 700); ctx.fillStyle = pal.red; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.direction = 'ltr';
    ctx.fillText(t('x34.sec.limit', { z: Math.round(sm[4][2]) }), X(4), Math.max(y + 14 * k, ZL(sm[4][2]) - 4 * k));
    ctx.strokeStyle = pal.red; ctx.lineWidth = 1 * k; ctx.beginPath(); ctx.moveTo(X(fa) + 8 * k, Z(gF)); ctx.lineTo(X(fa) + 8 * k, lFy); ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.fillText(t('x34.sec.allowed', { h: Math.round(lF - gF) }), X(fa) + 12 * k, Math.min(Z(gF) - 12 * k, Math.max(y + 34 * k, (Z(gF) + lFy) / 2)));
    ctx.fillStyle = pal.ink2; ctx.font = font(9, 500); ctx.textBaseline = 'top'; ctx.fillText(t('x34.sec.fence'), X(fa) + 6 * k, Z(gF) + 6 * k);
    ctx.textAlign = 'left'; ctx.fillText(A.id, x, oy + 4 * k); ctx.textAlign = 'right'; ctx.fillText(A.id + '′ · ' + t('x34.sec.base'), x + w, oy + 4 * k);
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    return true;
  }
  // the legend of one map (the same entries as cityLegend, only that map's layer)
  const ONLY = { island: ['base', 'band', 'fence'], walk: ['base', 'route', 'dead'], growth: ['base', 'metro', 'muni'], height: ['base', 'height'] };
  // the height classes are drawn semi-transparent over the map (alpha per class in data/ex21/easements.json): the legend uses the same alpha
  const hAlpha = (c) => { const q = D && D.ease && (D.ease.classes || []).find(k => k[2] === c); return q ? q[3][3] / 255 : 1; };
  function mapLegend(only, t, baseSubject) { const C = P().ex21, AN = P().an || null, MC = metroCol(only), want = ONLY[only] || []; const out = [];
    if (want.includes('base')) out.push(baseItem(t, baseSubject != null ? baseSubject : only === 'island'));
    if (want.includes('band')) out.push(AN && baseSubject === false ? { hatch: C.bandLine, dir: 1, label: t('x34.lg.band') } : { hatch: C.bandLine, label: t('x34.lg.band') });   // (dir: as drawCity hatches the band beside a base that is context)
    if (want.includes('fence')) Object.keys(C.fence).forEach(c => { const fc = AN && AN.fenceClass[c]; out.push(fc ? { line: fc.col, wk: fc.w, dk: fc.dash, round: fc.round, label: t('x34.lg.fence.' + c) } : { line: C.fence[c], w: 3, label: t('x34.lg.fence.' + c) }); });
    // (analysis style: wk, dk = the width and the dash the map draws, in the map's unit k, so the key shows the same line; w and dash stay
    // for the page scripts that draw a key the older way)
    const tw = (it, e) => (AN ? Object.assign(it, e) : it);
    if (want.includes('route')) out.push(tw({ line: C.route, w: 2, dash: true, label: t('x34.lg.route') }, { wk: 3.2, dk: [9, 4] }), tw({ line: C.straight, w: 1, dash: true, label: t('x34.lg.straight') }, { wk: 1.2, dk: [3, 4] }));
    if (want.includes('dead')) out.push({ line: C.dead, w: 2, sym: 'dead', label: t('x34.lg.dead') });
    if (want.includes('metro')) out.push(tw({ line: MC, w: 4, label: t('x34.lg.l1') }, { wk: 6 }), tw({ line: MC, w: 4, rail: true, label: t('x34.lg.metro') }, { wk: 6 }));
    if (want.includes('muni')) out.push(tw({ line: C.muni, dash: true, w: 1, label: t('x34.lg.muni2') }, { wk: 1.1, dk: [6, 4] }));
    if (want.includes('height')) Object.keys(C.height).forEach(c => out.push({ sw: C.height[c], alpha: hAlpha(c), label: t('x34.lg.h.' + c) }));
    return out; }
  function cityLegend(t) { const C = P().ex21, T = P().tour;
    return [{ sw: C.base, label: t('x34.lg.base') }, { hatch: C.bandLine, label: t('x34.lg.band') }]
      .concat(Object.keys(C.fence).map(c => ({ line: C.fence[c], w: 3, label: t('x34.lg.fence.' + c) })))
      .concat([{ line: C.route, w: 2, dash: true, label: t('x34.lg.route') }, { line: C.dead, w: 2, sym: 'dead', label: t('x34.lg.dead') }, { line: C.metro, w: 4, rail: true, label: t('x34.lg.metro') }])
      .concat(Object.keys(C.height).map(c => ({ sw: C.height[c], alpha: hAlpha(c), label: t('x34.lg.h.' + c) })))
      .concat([{ sw: C.built, label: t('x34.lg.built') }, { line: C.muni, dash: true, w: 1, label: t('x34.lg.muni2') }]); }
  // ---------- THE FACTORY (owner request, 15 Nov 2026): the Escúzar estate (CITAI) and the village beside it ----------
  // data/ex21/factory.json (tools/build_ex21_factory.py): OpenStreetMap + Catastro + IGN. One layer of information per map:
  // o.only = 'estate' | 'access' | 'land' | 'time'. Frame 5.4 × 4.4 km = 540 × 440 mm at 1:10,000.
  let FD = null, FDp = null;
  function readyFactory() { if (FDp) return FDp; FDp = fetch('data/ex21/factory.json?v=' + (root.GA_BUILD || '')).then(r => r.json()).then(j => (FD = j)).catch(e => { FDp = null; throw e; }); return FDp; }
  const FPER = [['pre_1940', 0, 1940], ['1940_1979', 1940, 1980], ['1980_1999', 1980, 2000], ['2000_2009', 2000, 2010], ['2010_2019', 2010, 2020], ['2020_plus', 2020, 9999]];
  const fper = (yr) => { if (yr == null) return null; const q = FPER.find(c => yr >= c[1] && yr < c[2]); return q ? q[0] : null; };
  const FKIND = ['science', 'logistics', 'industry', 'energy', 'quarry'], FLAND = ['solar', 'farmland', 'orchard', 'quarry', 'wood'];
  function drawFactory(ctx, x, y, w, h, o) {
    o = o || {}; if (!FD) return false; const pal = P(), C = pal.ex21, FC = pal.ex21f, AN = pal.an || null; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const E = FD.frame, mpp = (E[2] - E[0]) / w, k = o.k || w / 1000;
    const X = (u) => x + (u - E[0]) / mpp, Y = (v) => y + (E[3] - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`; const on = (n) => o.only === n;
    const poly = (rs) => { ctx.beginPath(); rs.forEach(pg => pg.forEach(r => { r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))); ctx.closePath(); })); };
    const line = (rs) => { ctx.beginPath(); rs.forEach(pg => pg.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))))); };
    const halo = (s0, px, py, col, sz, wt, al) => { ctx.font = font(sz, wt); ctx.textAlign = al || 'center'; ctx.textBaseline = 'middle'; ctx.direction = /[\u0590-\u08FF]/.test(s0) ? 'rtl' : 'ltr'; /* an Arabic or Hebrew phrase keeps its own reading order */ ctx.lineJoin = 'round'; ctx.lineWidth = 3.6 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(s0, px, py); ctx.fillStyle = col; ctx.fillText(s0, px, py); };
    const U = furniture(ctx, o, x, y, w, h, k, F), V = U.V;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // o.aerial = the PNOA photo of the whole frame (as served): only the two outlines, the names, north and scale go over it
    const aer = o.aerial || null; if (aer && AN) { anPhoto(ctx, aer, x, y, w, h, [x, y, x + w, y + h], AN, o.veil); anGrain(ctx, [x, y, x + w, y + h], k, AN); } else if (aer) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(aer, x, y, w, h); }
    // 1 the land around (its own map): OSM land use and solar plants; white = not mapped in OSM
    if (on('land') && !aer) FD.landuse.forEach(l => { poly(l.r); ctx.fillStyle = FC.land[l.c] || pal.grey3; ctx.globalAlpha = l.c === 'solar' ? 0.9 : 0.75; ctx.fill('evenodd'); ctx.globalAlpha = 1; });
    // 2 the estate's ground
    if (!aer) { poly(FD.estate.r); ctx.fillStyle = FC.estate; ctx.globalAlpha = on('land') ? 0.5 : 1; ctx.fill('evenodd'); ctx.globalAlpha = 1; }
    // 3 municipal boundaries
    if (!aer) { ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = C.muni; ctx.lineWidth = 1.1 * k; FD.muni.forEach(m => { line(m.r); ctx.stroke(); }); ctx.setLineDash([]); }
    // 4 named plots by kind (map 01)
    if (on('estate') && AN) FD.plots.forEach(q => { poly(q.r); ctx.fillStyle = '#FFFFFF'; ctx.fill('evenodd'); anPattern(ctx, () => poly(q.r), [x, y, x + w, y + h], AN.kind[q.k] || AN.kind.industry, AN.red, k); poly(q.r); ctx.strokeStyle = AN.red; ctx.lineWidth = 1.3 * k; ctx.stroke(); });
    else if (on('estate')) FD.plots.forEach(q => { const c = FC.kind[q.k] || FC.kind.industry; poly(q.r); ctx.fillStyle = c; ctx.globalAlpha = 0.4; ctx.fill('evenodd'); ctx.globalAlpha = 1; ctx.strokeStyle = c; ctx.lineWidth = 1.2 * k; ctx.stroke(); });
    // 5 streets and roads (OSM)
    const sw = { main: on('access') ? 3.6 : 1.8, street: 1, service: 0.7, track: 0.6 };
    if (!aer) ['track', 'service', 'street', 'main'].forEach(c => { ctx.strokeStyle = c === 'main' && on('access') ? C.town : C.street; ctx.lineWidth = sw[c] * k; ctx.setLineDash(c === 'track' ? [3 * k, 3 * k] : []); ctx.beginPath();
      FD.streets.forEach(st => { if (st.c !== c) return; st.r.forEach(pg => pg.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))))); }); ctx.stroke(); }); ctx.setLineDash([]);
    // 6 buildings (Catastro): solid on map 01, by period of construction on map 04, light context on the others
    if (!aer) FD.buildings.forEach(b => { poly(b.r); if (on('time')) { const pc = fper(b.y); ctx.fillStyle = pc ? FC.period[pc] : pal.grey3; } else ctx.fillStyle = on('estate') ? pal.ink : C.built; ctx.fill('evenodd'); });
    if (AN && !aer) anGrain(ctx, [x, y, x + w, y + h], k, AN);
    // 7 the estate's outline and the village's outline (OSM); on the photo printed in grey the estate's outline is the red thing
    if (aer) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5 * k; poly(FD.estate.r); ctx.stroke(); poly(FD.village.r); ctx.stroke(); }
    poly(FD.estate.r); ctx.strokeStyle = AN && aer ? AN.red : FC.estateLine; ctx.lineWidth = 2.2 * k; ctx.stroke();
    poly(FD.village.r); ctx.strokeStyle = FC.village; ctx.lineWidth = 2.2 * k; ctx.setLineDash([1 * k, 4.5 * k]); ctx.stroke(); ctx.setLineDash([]);
    // 8 getting there (map 02): bus line and stops, the way by road from the village to the two plots, road numbers
    if (on('access')) {
      ctx.strokeStyle = FC.bus; ctx.lineWidth = 7 * k; ctx.globalAlpha = 0.35; line(FD.bus.r); ctx.stroke(); ctx.globalAlpha = 1;
      FD.routes.filter(r => r.mode === 'road').forEach(r => { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4.6 * k; line(r.r); ctx.stroke(); ctx.strokeStyle = FC.route; ctx.lineWidth = 2.6 * k; ctx.setLineDash([9 * k, 5 * k]); line(r.r); ctx.stroke(); ctx.setLineDash([]); });
      FD.bus.stops.forEach(st => { ctx.beginPath(); ctx.arc(X(st.p[0]), Y(st.p[1]), 5.2 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = FC.stop; ctx.lineWidth = 2.4 * k; ctx.stroke(); });
      const refs = {}; FD.streets.forEach(st => { if (st.c !== 'main' || !(st.ref || st.nm)) return; const r = st.r[0][0]; let len = 0; for (let i = 1; i < r.length; i++) len += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); const key = st.ref ? st.ref.split(';')[0] : st.nm; if (!st.ref && len < 700) return; if (!refs[key] || len > refs[key].len) refs[key] = { len, r }; });
      Object.keys(refs).forEach(ref => { const r = refs[ref].r, m = r[Math.floor(r.length / 2)]; const px = X(m[0]), py = Y(m[1]); ctx.font = font(10, 700); const tw = ctx.measureText(ref).width + 8 * k; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = C.town; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.rect(px - tw / 2, py - 8 * k, tw, 16 * k); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.town; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.fillText(ref, px, py + 0.5 * k); });
      FD.routes.filter(r => r.mode === 'road').forEach(r => { const pts = r.r[0][0], m = pts[pts.length - 1]; halo(`${r.to}: ${r.km.toFixed(1)} km`, X(m[0]) + 12 * k, Y(m[1]) + (r.to === 'Lidl' ? -30 : 24) * k, FC.route, 11, 700, r.to === 'Lidl' ? 'center' : 'left'); });
      FD.routes.filter(r => r.from === 'stop').forEach(r => { ctx.strokeStyle = FC.stop; ctx.lineWidth = 2 * k; ctx.setLineDash([2 * k, 5 * k]); line(r.r); ctx.stroke(); ctx.setLineDash([]); const pts = r.r[0][0], m = pts[Math.floor(pts.length * 0.45)]; halo(t('x35.walk', { km: r.km.toFixed(1) }), X(m[0]), Y(m[1]) - 14 * k, FC.stop, 10, 700); });
    }
    // 9 map 01: the gap between the village's edge and the estate's edge; plot names with the operators' own figures
    if (on('estate')) {
      const a = FD.edge_line[0], b = FD.edge_line[1]; ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.4 * k; ctx.setLineDash([4 * k, 3 * k]); ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke(); ctx.setLineDash([]);
      [a, b].forEach(q => { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 2.6 * k, 0, 7); ctx.fillStyle = pal.ink; ctx.fill(); });
      halo(`${FD.village_edge_to_estate_m} m`, X((a[0] + b[0]) / 2) + 10 * k, Y((a[1] + b[1]) / 2), pal.ink, 11, 700, 'left');
      const placed = []; if (!o.noPlotNames) FD.plots.filter(q => q.ha >= 1.5 || q.jobs || q.opened).forEach(q => { const c = FC.kind[q.k] || FC.kind.industry, nm = q.nm.replace(/ \(.*\)$/, ''), yr = q.opened && q.opened.length <= 10 ? q.opened : null;
        ctx.font = font(10.5, 700); const tw = ctx.measureText(nm).width, th = (yr ? 28 : 15) * k; const px = X(q.c[0]); let py = Y(q.c[1]);
        for (let n = 0; n < 8 && placed.some(b => Math.abs(b[0] - px) < (b[2] + tw) / 2 + 4 * k && Math.abs(b[1] - py) < (b[3] + th) / 2 + 2 * k); n++) py += 15 * k;
        placed.push([px, py, tw, th]); halo(nm, px, py - (yr ? 6 * k : 0), c, 10.5, 700); if (yr) halo(yr, px, py + 7 * k, pal.ink2, 8.5, 500); });
    }
    // 10 names: the estate and the village with their measured sizes
    const es = FD.estate, vi = FD.village; const ec = [(E[0] + E[2]) / 2 + 250, 4105420], vc = [vi.c[0], vi.c[1] - 520];
    const ecol = AN && aer ? AN.red : FC.estateLine; halo(t('x35.estate').toUpperCase(), X(ec[0]), Y(ec[1]), ecol, 15, 700); halo(t('x35.estate.sub', { ha: km2(es.ha), n: es.buildings, b: km2(es.footprint_ha), p: es.built_share_pct.toFixed(1) }), X(ec[0]), Y(ec[1]) + 17 * k, ecol, 10.5, 500);
    halo(vi.nm.toUpperCase(), X(vc[0]), Y(vc[1]), FC.village, 15, 700); halo(t('x35.village.sub', { pop: vi.pop, y: vi.pop_year, d: vi.dwellings, n: vi.buildings, b: km2(vi.footprint_ha) }), X(vc[0]), Y(vc[1]) + 17 * k, FC.village, 10.5, 500);
    ctx.restore();
    // corner box (top-left, under the title or the north arrow when one of them is on that side): map 02 the southern axis, map 04 built area per decade
    const insY = y + 14 * k + (U.rtl ? 70 * k : U.band ? U.band[3] - y : 0);
    if (on('access')) drawAxisInset(ctx, x + 14 * k, insY, 300 * k, 215 * k, k, t, font);
    if (on('time')) drawDecades(ctx, x + 14 * k, insY, 300 * k, 190 * k, k, t, font);
    frameTop(ctx, o, U, k, F);
    if (!o.noScale) scaleBar(ctx, V[0] + 22 * k, V[3] - 24 * k, 1000 / mpp, k, font);
    return true;
  }
  // map 02's corner box: the whole southern axis — Granada's metro line 1, its extension to Las Gabias, the straight gap to the estate
  function drawAxisInset(ctx, x, y, w, h, k, t, font) { const pal = P(), C = pal.ex21, FC = pal.ex21f; const top = 34 * k, foot = 4 * k, pad = 8 * k; const B = [427500, 4100300, 449500, 4113800];
    const sc = Math.min((w - 2 * pad) / (B[2] - B[0]), (h - top - foot - 2 * pad) / (B[3] - B[1])); const ox = x + (w - (B[2] - B[0]) * sc) / 2, oy = y + top + pad; const X = (u) => ox + (u - B[0]) * sc, Y = (v) => oy + (B[3] - v) * sc;
    ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.rect(x, y + top, w, h - top - foot); ctx.clip(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); };
    if (D) { D.area.forEach(m => { path(m.g); ctx.closePath(); if (m.p.name === 'Granada') { ctx.fillStyle = pal.gray1; ctx.fill('evenodd'); } ctx.strokeStyle = C.muni; ctx.lineWidth = 0.5 * k; ctx.stroke(); });
      const base = D.edge.find(f => f.p.k === 'base'); if (base) { path(base.g); ctx.closePath(); ctx.fillStyle = C.base; ctx.fill(); }
      ctx.strokeStyle = C.metro; ctx.lineWidth = 2.6 * k; ctx.beginPath(); D.l1.lines.forEach(l => l.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.stroke();
      D.metro.filter(f => f.p.k === 'track').forEach(f => { path(f.g); ctx.strokeStyle = C.metro; ctx.lineWidth = 2.6 * k; ctx.stroke(); path(f.g); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1 * k; ctx.setLineDash([3 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); }); }
    const es = FD.estate.r; ctx.beginPath(); es.forEach(pg => pg.forEach(r => { r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))); ctx.closePath(); })); ctx.fillStyle = FC.estate; ctx.fill('evenodd'); ctx.strokeStyle = FC.estateLine; ctx.lineWidth = 1.2 * k; ctx.stroke();
    const g = FD.gap_line; if (g) { ctx.strokeStyle = FC.route; ctx.lineWidth = 1.6 * k; ctx.setLineDash([4 * k, 3 * k]); ctx.beginPath(); ctx.moveTo(X(g[0][0]), Y(g[0][1])); ctx.lineTo(X(g[1][0]), Y(g[1][1])); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(X(g[0][0]), Y(g[0][1]), 3.4 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.metro; ctx.lineWidth = 1.6 * k; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(X(FD.village.c[0]), Y(FD.village.c[1]), 2.6 * k, 0, 7); ctx.fillStyle = FC.village; ctx.fill();
    const E = FD.frame; ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * k; ctx.strokeRect(X(E[0]), Y(E[3]), (E[2] - E[0]) * sc, (E[3] - E[1]) * sc);
    const lab = (s0, u, v, dx, dy, al, col, wt) => { ctx.font = font(8.5, wt || 700); ctx.textAlign = al; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.lineWidth = 3 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(s0, X(u) + dx * k, Y(v) + dy * k); ctx.fillStyle = col || pal.ink; ctx.fillText(s0, X(u) + dx * k, Y(v) + dy * k); };
    if (g) { lab(`${FD.gap_metro_km} km`, (g[0][0] + g[1][0]) / 2, (g[0][1] + g[1][1]) / 2, 6, 8, 'left', FC.route); lab('Las Gabias', g[0][0], g[0][1], 0, -10, 'center'); }
    lab('Escúzar', FD.village.c[0], FD.village.c[1], 6, 4, 'left', FC.village); lab('CITAI', (E[0] + E[2]) / 2, E[3], 0, -8, 'center', FC.estateLine);
    if (D) { const gr = D.l1.stops.find(st => st.name === 'Recogidas'); if (gr) lab('GRANADA', gr.p[0], Math.min(gr.p[1], B[3] - 600), -8, 0, 'right'); const ar = D.l1.stops.find(st => st.name === 'Armilla'); if (ar) lab('Armilla', ar.p[0], ar.p[1], 6, 8, 'left'); }
    ctx.restore(); ctx.strokeStyle = pal.line2; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = font(9.5, 600); ctx.fillStyle = pal.ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t('x35.inset.title', { km: FD.gap_metro_km }), x + 8 * k, y + 15 * k, w - 16 * k);
    ctx.font = font(8, 500); ctx.fillStyle = pal.ink2; ctx.fillText(t('x35.inset.sub'), x + 8 * k, y + 28 * k, w - 16 * k); }
  // map 04's corner box: built footprint per decade (Catastro), village and estate
  function drawDecades(ctx, x, y, w, h, k, t, font) { const pal = P(), FC = pal.ex21f, AN = pal.an || null, cV = AN ? AN.grey[3] : FC.village, cE = AN ? AN.ink : FC.route; const v = FD.village.footprint_by_decade_m2, e = FD.estate.footprint_by_decade_m2; const decs = []; for (let d = 1880; d <= 2020; d += 10) decs.push(d);
    const val = (o2, d) => (o2[String(d)] || 0); const vmax = Math.max(...decs.map(d => val(v, d) + val(e, d))); const top = 36 * k, bot = 22 * k, pl = 34 * k, pr = 8 * k; const bw = (w - pl - pr) / decs.length, H = h - top - bot;
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = pal.line2; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = font(9.5, 600); ctx.fillStyle = pal.ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t('x35.dec.title'), x + 8 * k, y + 15 * k, w - 16 * k); ctx.font = font(8, 500); ctx.fillStyle = pal.ink2; ctx.fillText(t(AN ? 'x41.dec.sub' : 'x35.dec.sub'), x + 8 * k, y + 28 * k, w - 16 * k);
    decs.forEach((d, i) => { const bx = x + pl + i * bw, hv = val(v, d) / vmax * H, he = val(e, d) / vmax * H; const by = y + top + H; ctx.fillStyle = cV; ctx.fillRect(bx + 1 * k, by - hv, bw - 2 * k, hv); ctx.fillStyle = cE; ctx.fillRect(bx + 1 * k, by - hv - he, bw - 2 * k, he);
      if (d % 20 === 0) { ctx.font = font(7.5, 500); ctx.fillStyle = pal.ink2; ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.fillText(String(d), bx + bw / 2, by + 11 * k); } });
    ctx.strokeStyle = pal.ink3; ctx.lineWidth = 0.8 * k; ctx.beginPath(); ctx.moveTo(x + pl, y + top + H); ctx.lineTo(x + w - pr, y + top + H); ctx.stroke();
    ctx.font = font(7.5, 500); ctx.fillStyle = pal.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; const ha = vmax / 1e6; [0, 0.5, 1].forEach(f => ctx.fillText((ha * f).toFixed(f ? 2 : 0) + (f === 1 ? ' km²' : ''), x + pl - 3 * k, y + top + H - f * H));
    ctx.restore(); }
  function factoryLegend(only, t) { if (!FD) return []; const pal = P(), C = pal.ex21, FC = pal.ex21f; const out = [{ sw: FC.estate, stroke: FC.estateLine, label: t('x35.lg.estate', { ha: km2(FD.estate.ha) }) }, { line: FC.village, w: 2, dots: true, label: t('x35.lg.village', { ha: km2(FD.village.ha) }) }];
    if (only === 'estate') { const AN = pal.an || null; FKIND.filter(c => FD.plots.some(q => q.k === c)).forEach(c => out.push(AN ? { pat: AN.kind[c], col: AN.red, label: t('x35.lg.kind.' + c) } : { sw: FC.kind[c], alpha: 0.4, stroke: FC.kind[c], label: t('x35.lg.kind.' + c) }));
      out.push({ sw: pal.ink, label: t('x35.lg.bld') }, { line: pal.ink, w: 1, dash: true, label: t('x35.lg.edge', { m: FD.village_edge_to_estate_m }) }); }
    if (only === 'access') { const rd = FD.routes.filter(r => r.mode === 'road'); out.push({ line: C.town, w: 3, label: t('x35.lg.road') }, { line: FC.bus, w: 5, alpha: 0.35, label: t('x35.lg.bus') }, { line: FC.stop, sym: 'stop', label: t('x35.lg.stop', { n: FD.bus.stops.length }) });
      rd.forEach(r => out.push({ line: FC.route, w: 2, dash: true, label: t('x35.lg.route', { to: r.to, km: r.km.toFixed(1), s: r.straight_km.toFixed(1) }) }));
      FD.routes.filter(r => r.from === 'stop').forEach(r => out.push({ line: FC.stop, w: 1.5, dots: true, label: t('x35.lg.walk', { km: r.km.toFixed(1) }) })); }
    if (only === 'land') { FLAND.filter(c => FD.land_ha[c]).forEach(c => out.push({ sw: FC.land[c], alpha: c === 'solar' ? 0.9 : 0.75, label: t('x35.lg.land.' + c, { ha: km2(FD.land_ha[c]) }) })); out.push({ sw: '#FFFFFF', label: t('x35.lg.land.none') }); }
    if (only === 'time') { FPER.forEach(c => out.push({ sw: FC.period[c[0]], label: t('x35.lg.per.' + c[0]) })); }
    if (only === 'photo') return out;
    if (only !== 'estate' && only !== 'time') out.push({ sw: C.built, label: t('x35.lg.bld') });
    out.push({ line: C.muni, dash: true, w: 1, label: t('x35.lg.muni') }); return out; }
  // key map of the factory's 1:500 windows: map 01 with the windows J–P
  function drawFactoryKey(ctx, x, y, w, h, o) { o = o || {}; if (!FD || !AR) return false; const pal = P(); const k = o.k || w / 1000; const F = root.GA.pages.font(); drawFactory(ctx, x, y, w, h, { t: o.t, only: 'estate', k, noPlotNames: true, aerial: o.aerial, title: o.title, titlePx: o.titlePx });
    const E = FD.frame, mpp = (E[2] - E[0]) / w; const X = (u) => x + (u - E[0]) / mpp, Y = (v) => y + (E[3] - v) / mpp;
    AR.areas.forEach(a => { const e = a.extent; ctx.fillStyle = pal.red; ctx.globalAlpha = 0.18; ctx.fillRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp); ctx.globalAlpha = 1; ctx.strokeStyle = pal.red; ctx.lineWidth = 2.4 * k; ctx.strokeRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp);
      const cx = X((e[0] + e[2]) / 2), cy = Y(e[3]) - 14 * k; ctx.beginPath(); ctx.arc(cx, cy, 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = `700 ${Math.round(12 * k)}px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.fillText(a.id, cx, cy + 0.5 * k); });
    return true; }
  // ---------- THE BASE OVER TIME (owner request, 15 Nov 2026): growth, crowding, possible growth (tools/build_ex21_time.py) ----------
  let TD = null, TDp = null;
  function readyTime() { if (TDp) return TDp; const v = '?v=' + (root.GA_BUILD || ''); const img = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(u)); i.src = u + v; });
    TDp = Promise.all([fetch('data/ex21/time.json' + v).then(r => r.json()), img('data/ex21/built_period.png'), img('data/ex21/density.png'), img('data/ex21/edge_land.png')])
      .then(([j, bp, de, el]) => (TD = Object.assign(j, { img: { built: bp, density: de, edge: el } }))).catch(e => { TDp = null; throw e; }); return TDp; }
  // the five towns' built-up edge at each picture's date (tools/build_ex21_town_edges.py, Catastro; owner request 17 Nov 2026)
  let TE = null, TEp = null;
  function readyTownEdges() { if (TEp) return TEp; TEp = fetch('data/ex21/town_edges.json?v=' + (root.GA_BUILD || '')).then(r => r.json()).then(j => (TE = j)).catch(e => { TEp = null; throw e; }); return TEp; }
  // the tint inside a town's edge; how strong the 100 m cell pictures are drawn (analysis style: the open land at full strength) and the same strength
  // for their key swatches = the drawing's × the picture's own alpha (tools/build_ex21_time.py: density 235, edge land 215)
  const EDGE_FILL = 0.16, cellDraw = (only, an) => (an && only === 'edge' ? 1 : 0.85), cellKey = (only) => cellDraw(only, true) * (only === 'edge' ? 215 : 235) / 255;
  // (analysis style: one entry — the red outline with its tint, as drawn)
  function townEdgeLegend(t, key) { const col = P().ex21t; if (P().an) return [{ sw: P().an.red, alpha: EDGE_FILL, stroke: P().an.red, line: P().an.red, w: 2.4, label: t('x41.edge') + (TE && key && TE.edges[key] && TFIVE.some(tn => TE.edges[key][tn] === null) ? ' — ' + TFIVE.filter(tn => TE.edges[key][tn] === null).join(', ') + ': ' + t('x39.unknown') : '') }];
    return TFIVE.map(tn => ({ line: col[tn], w: 2.4, label: tn + (TE && key && TE.edges[key] && TE.edges[key][tn] === null ? ' — ' + t('x39.unknown') : '') })); }
  // o.only = 'built' | 'density' | 'edge' | 'photo' (o.photo = a historical image of the same frame); the base is drawn as today's outline;
  // o.edges = a picture key of town_edges.json: each town's built-up edge at that date, in the town's colour (tcol)
  function drawTime(ctx, x, y, w, h, o) {
    o = o || {}; if (!D || !TD) return false; const pal = P(), C = pal.ex21, AN = pal.an || null; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const E = CITY, mpp = (E.x1 - E.x0) / w, k = o.k || w / 1000;
    const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.closePath(); };
    const U = furniture(ctx, o, x, y, w, h, k, F), V = U.V;
    ctx.save(); ctx.beginPath(); ctx.rect(V[0], V[1], V[2] - V[0], V[3] - V[1]); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const photo = o.only === 'photo';
    if (photo && o.photo && AN) { anPhoto(ctx, o.photo, x, y, w, h, V, AN, o.veil); anGrain(ctx, V, k, AN); }   // the picture printed in grey (o.veil = how pale), as served otherwise
    else if (photo && o.photo) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(o.photo, x, y, w, h); }
    const base = D.edge.find(f => f.p.k === 'base');
    if (!photo) {
      ctx.strokeStyle = C.street; ctx.lineWidth = 0.7 * k; ctx.beginPath(); D.streets.forEach(s0 => s0.g.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))))); ctx.stroke();
      if (o.only === 'built') { ctx.imageSmoothingEnabled = true; ctx.drawImage(builtImg(), x, y, w, h); }
      else { const blds = () => { ctx.fillStyle = C.built; D.builds.forEach(rs => { path(rs); ctx.fill(); }); }, cells = () => { ctx.imageSmoothingEnabled = false; ctx.globalAlpha = cellDraw(o.only, AN); ctx.drawImage(o.only === 'edge' ? edgeImg(false) : densImg(), x, y, w, h); ctx.globalAlpha = 1; };
        // (analysis style, open land: the buildings are drawn OVER the cells — a cell counted as open can still hold a building, and the map shows it)
        if (AN && o.only === 'edge') { cells(); blds(); } else { blds(); cells(); } }
      if (AN) anGrain(ctx, V, k, AN);
      ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = C.muni; ctx.lineWidth = 1.1 * k;
      if (AN) { // a boundary two municipalities share is drawn once: two dashed strokes on one line read as a solid line, and the key shows dashes
        const seen = new Set(), id = (a, b) => { const p = Math.round(a[0]) + ',' + Math.round(a[1]), q = Math.round(b[0]) + ',' + Math.round(b[1]); return p < q ? p + '|' + q : q + '|' + p; }; ctx.lineCap = 'butt'; ctx.beginPath();
        D.area.forEach(a => a.g.forEach(r => { let pen = false; for (let i = 1; i < r.length; i++) { const s = id(r[i - 1], r[i]); if (seen.has(s)) { pen = false; continue; } seen.add(s); if (!pen) { ctx.moveTo(X(r[i - 1][0]), Y(r[i - 1][1])); pen = true; } ctx.lineTo(X(r[i][0]), Y(r[i][1])); } })); ctx.stroke(); ctx.lineCap = 'round'; }
      else D.area.forEach(a => { path(a.g); ctx.stroke(); });
      ctx.setLineDash([]);
    }
    if (base && AN) { if (photo) { path(base.g); anFence(ctx, k, AN); } else anBase(ctx, () => path(base.g), V, k, AN, false); }   // today's fence, black and white, on every picture
    else if (base) { if (photo) { path(base.g); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4.4 * k; ctx.stroke(); path(base.g); ctx.strokeStyle = pal.red; ctx.lineWidth = 2 * k; ctx.setLineDash([8 * k, 5 * k]); ctx.stroke(); ctx.setLineDash([]); }
      else { path(base.g); ctx.fillStyle = C.base; ctx.fill(); } }
    if (o.edges && TE && TE.edges[o.edges]) { const col = pal.ex21t, E2 = TE.edges[o.edges];
      TFIVE.forEach(tn => { const rs = E2[tn]; if (!rs || !rs.length) return; const pth = () => { ctx.beginPath(); rs.forEach(pg => pg.forEach(r => { r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))); ctx.closePath(); })); };
        const ec = o.edgeCol || col[tn]; pth(); ctx.fillStyle = ec; ctx.globalAlpha = EDGE_FILL; ctx.fill('evenodd'); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6.4 * k; ctx.stroke(); ctx.globalAlpha = 1; pth(); ctx.strokeStyle = ec; ctx.lineWidth = (AN ? 2.6 : 3.4) * k; ctx.stroke(); });
      if (AN && photo && base) { path(base.g); anFence(ctx, k, AN); } }   // the fence once more, over the edges: it stays whole where a town's edge runs along it
    // analysis style, with the towns' edges: a name never sits on a red edge, on the fence or on another name, and never inside ANOTHER town's edge or
    // inside the base — it takes a free place inside its own town's edge, or the nearest one beside it (two coarse masks of what is drawn; a name that finds no free place keeps its own)
    let clear = null;
    if (AN && o.edges && TE && TE.edges[o.edges]) { const E2 = TE.edges[o.edges], s = 2 * k, mw = Math.ceil(w / s), mh = Math.ceil(h / s); const mk = () => { const c = document.createElement('canvas'); c.width = mw; c.height = mh; return c.getContext('2d', { willReadFrequently: true }); };
      const gl = mk(), gt = mk(), ring = (g, r) => { r.forEach((q, i) => { const a = (X(q[0]) - x) / s, b = (Y(q[1]) - y) / s; if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.closePath(); }; gl.lineJoin = 'round'; gl.lineWidth = 6.4 * k / s + 1.5;
      TFIVE.forEach((tn, i) => { gl.beginPath(); gt.beginPath(); (E2[tn] || []).forEach(pg => pg.forEach(r => { ring(gl, r); ring(gt, r); })); gl.stroke(); gt.fillStyle = `rgb(${(i + 1) * 40},0,0)`; gt.fill('evenodd'); });
      if (base) { gl.beginPath(); gt.beginPath(); base.g.forEach(r => { ring(gl, r); ring(gt, r); }); gl.stroke(); gt.fillStyle = 'rgb(240,0,0)'; gt.fill('evenodd'); }
      const ml = gl.getImageData(0, 0, mw, mh).data, mt = gt.getImageData(0, 0, mw, mh).data, ia = (px) => Math.min(mw - 1, Math.max(0, Math.round((px - x) / s))), ib = (py) => Math.min(mh - 1, Math.max(0, Math.round((py - y) / s)));
      const hit = (b) => { for (let j = ib(b[1]); j <= ib(b[3]); j++) for (let i = ia(b[0]); i <= ia(b[2]); i++) if (ml[(j * mw + i) * 4 + 3]) return true; return false; };
      const owner = (px, py) => { const i = (ib(py) * mw + ia(px)) * 4; return mt[i + 3] > 127 ? Math.round(mt[i] / 40) : 0; };
      const AIR = [[4, 9, 11], [3, 7, 9], [1.5, 6, 8]];   // the box a name needs, in k (beside it, above, below its centre): with air around it · tight · snug
      clear = (cx, cy, tw, own) => { const box = (px, py, m) => [px - tw / 2 - AIR[m][0] * k, py - AIR[m][1] * k, px + tw / 2 + AIR[m][0] * k, py + AIR[m][2] * k];
        const ok = (px, py, inside, m) => { const b = box(px, py, m); return b[0] >= V[0] + 4 * k && b[2] <= V[2] - 4 * k && b[1] >= V[1] + 4 * k && b[3] <= V[3] - 4 * k && !U.K.some(r => b[2] > r[0] && b[0] < r[2] && b[3] > r[1] && b[1] < r[3]) && !hit(b) && [-0.5, -0.25, 0, 0.25, 0.5].every(f => { const z = owner(px + f * tw, py + k); return inside ? z === own : !z || z === own; }); };
        // in this order, the nearest of each (never farther than ~180 k from the town): INSIDE the town's own edge, tight and then snug; on open ground beside it,
        // with air, then tight, then snug. st = the search step, R = how many steps out.
        const find = (inside, m, R, st) => { if (ok(cx, cy, inside, m)) return [cx, cy]; for (let r = 1; r <= R; r++) { let got = null, bd = Infinity; for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue; const d = i * i + j * j; if (d < bd && ok(cx + i * st, cy + j * st, inside, m)) { bd = d; got = [cx + i * st, cy + j * st]; } } if (got) return got; } return null; };
        const has = own && (E2[TFIVE[own - 1]] || []).length;
        const best = (has && (find(true, 1, 30, 4 * k) || find(true, 2, 60, 2 * k))) || find(false, 0, 40, 4 * k) || find(false, 1, 45, 4 * k) || find(false, 2, 90, 2 * k) || [cx, cy]; const b = box(best[0], best[1], 1); for (let j = ib(b[1]); j <= ib(b[3]); j++) for (let i = ia(b[0]); i <= ia(b[2]); i++) ml[(j * mw + i) * 4 + 3] = 255; return best; }; }
    // town names (and the base) — on photos with a white halo
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
    D.edge.filter(f => f.p.k === 'town').forEach(f => { const [u, v] = f.g; nameFont(ctx, font, k, photo ? 13 : 15); const tw = ctx.measureText(f.p.nm.toUpperCase()).width; let q = place(V, U.K, X(u), Y(v) - 13 * k, tw, 18 * k, 8 * k); if (!q) return; if (clear) q = clear(q[0], q[1], tw, TFIVE.indexOf(f.p.nm) + 1); const px = q[0], py = q[1] + 13 * k;
      ctx.lineWidth = (AN && !photo ? 5.5 : 4) * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(f.p.nm.toUpperCase(), px, py - 8 * k); ctx.fillStyle = C.town; ctx.fillText(f.p.nm.toUpperCase(), px, py - 8 * k); }); nameEnd(ctx);
    if (base && !photo) { const rx = X((D.runway[0][0] + D.runway[1][0]) / 2), ry = Y((D.runway[0][1] + D.runway[1][1]) / 2); nameFont(ctx, font, k, 14); if (AN) { ctx.lineJoin = 'round'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6 * k; ctx.strokeText(t('x34.base').toUpperCase(), rx - 60 * k, ry); } ctx.fillStyle = AN ? AN.ink : '#FFFFFF'; ctx.fillText(t('x34.base').toUpperCase(), rx - 60 * k, ry); nameEnd(ctx); }
    ctx.restore(); frameTop(ctx, o, U, k, F);
    if (!o.noScale) scaleBar(ctx, V[0] + 22 * k, V[3] - 24 * k, 1000 / mpp, k, font);
    return true;
  }
  const TFIVE = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares'];
  const tcol = () => { const p = P(); if (p.an) { const g = p.an.towns5; return { 'Armilla': g[0], 'Churriana de la Vega': g[1], 'Las Gabias': g[2], 'Alhendín': g[3], 'Ogíjares': g[4], 'Granada': p.ink3 }; } return { 'Armilla': p.ex21.metro, 'Churriana de la Vega': p.red, 'Las Gabias': p.base.olive, 'Alhendín': p.base.khaki, 'Ogíjares': p.base.burgundy, 'Granada': p.ink3 }; };
  // chart: dwellings in today's buildings by decade of construction, the five towns stacked (Catastro)
  // (analysis style, o.markFrom = a year: the decades from it on are written in the red over a red rule — the red thing of the map the chart sits under)
  function drawDwellChart(ctx, x, y, w, h, o) { o = o || {}; const pal = P(), t = o.t || ((s) => s), k = o.k || 1, F = root.GA.pages.font(), font = (sz, wt) => `${wt || 500} ${Math.round(sz * k)}px ${F}`, col = tcol(), mark = pal.an && o.markFrom ? o.markFrom : null;
    const decs = []; for (let d = 1900; d <= 2020; d += 10) decs.push(d); const val = (tn, d) => d === 1900 ? Object.entries(TD.towns[tn].dwellings_by_decade).filter(([q]) => +q < 1910).reduce((a, [, v]) => a + v, 0) : (TD.towns[tn].dwellings_by_decade[String(d)] || 0);
    const tot = decs.map(d => TFIVE.reduce((a, tn) => a + val(tn, d), 0)); const vmax = Math.max(...tot) * 1.08; const pl = 46 * k, pb = 22 * k, pt = 10 * k; const bw = (w - pl) / decs.length, H = h - pb - pt;
    ctx.save(); ctx.font = font(9); ctx.fillStyle = pal.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.strokeStyle = pal.line; ctx.lineWidth = pal.an ? Math.max(1, 0.35 * k) : 1;   // (analysis style: the grid keeps its weight at print resolution)
    for (let v = 0; v <= vmax; v += 2000) { const yy = y + pt + H - v / vmax * H; ctx.beginPath(); ctx.moveTo(x + pl, yy); ctx.lineTo(x + w, yy); ctx.stroke(); ctx.fillText(v.toLocaleString('en-US'), x + pl - 5 * k, yy); }
    decs.forEach((d, i) => { let acc = 0; const bx = x + pl + i * bw; TFIVE.forEach(tn => { const v = val(tn, d); const hh = v / vmax * H; ctx.fillStyle = col[tn]; ctx.fillRect(bx + 2 * k, y + pt + H - acc - hh, bw - 4 * k, hh); acc += hh; });
      ctx.fillStyle = mark && d >= mark ? pal.an.red : pal.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = font(8.5); ctx.fillText(d === 1900 ? '<1910' : d + 's', bx + bw / 2, y + pt + H + 5 * k); });
    if (mark) { const i0 = decs.findIndex(d => d >= mark); if (i0 >= 0) { ctx.fillStyle = pal.an.red; ctx.fillRect(x + pl + i0 * bw + 2 * k, y + pt + H + 1.3 * k, (decs.length - i0) * bw - 4 * k, 1.3 * k); } }
    ctx.restore(); }
  // chart: residents 1996–2025 (INE) per town, and the scenario "the pace of 2015–2025 continues" to 2045 (dashed)
  function drawPopChart(ctx, x, y, w, h, o) { o = o || {}; const pal = P(), k = o.k || 1, F = root.GA.pages.font(), font = (sz, wt) => `${wt || 500} ${Math.round(sz * k)}px ${F}`, col = tcol();
    const y0 = 1996, y1 = o.noProj ? 2025 : 2045; const vmax = Math.max(...TFIVE.map(tn => o.noProj ? TD.population[tn]['2025'] : TD.projection[tn]['2045'])) * 1.1; const pl = 46 * k, pb = 22 * k, pt = 10 * k, pr = 90 * k; const W2 = w - pl - pr, H = h - pb - pt;
    const X2 = (yr) => x + pl + (yr - y0) / (y1 - y0) * W2, Y2 = (v) => y + pt + H - v / vmax * H;
    ctx.save(); ctx.font = font(9); ctx.fillStyle = pal.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.strokeStyle = pal.line; ctx.lineWidth = pal.an ? Math.max(1, 0.35 * k) : 1;
    for (let v = 0; v <= vmax; v += 5000) { ctx.beginPath(); ctx.moveTo(x + pl, Y2(v)); ctx.lineTo(x + pl + W2, Y2(v)); ctx.stroke(); ctx.fillText(v.toLocaleString('en-US'), x + pl - 5 * k, Y2(v)); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; for (let yr = 2000; yr <= y1; yr += 5) ctx.fillText(String(yr), X2(yr), y + pt + H + 5 * k);
    const AN = pal.an || null; if (!o.noProj) { ctx.fillStyle = AN ? AN.grey[0] : 'rgba(201,216,223,.35)'; ctx.fillRect(X2(2025), y + pt, X2(y1) - X2(2025), H); }
    TFIVE.forEach(tn => { const p = TD.population[tn]; const yrs = Object.keys(p).map(Number).sort((a, b) => a - b); ctx.strokeStyle = AN ? AN.ink : col[tn]; ctx.lineWidth = (AN ? 1.8 : 2.6) * k; ctx.beginPath(); yrs.forEach((yr, i) => i ? ctx.lineTo(X2(yr), Y2(p[yr])) : ctx.moveTo(X2(yr), Y2(p[yr]))); ctx.stroke();
      let ly = p['2025'], lx = X2(2025); if (!o.noProj) { const q = TD.projection[tn]; ctx.setLineDash([6 * k, 4 * k]); ctx.beginPath(); ctx.moveTo(X2(2025), Y2(p['2025'])); ctx.lineTo(X2(2035), Y2(q['2035'])); ctx.lineTo(X2(2045), Y2(q['2045'])); ctx.stroke(); ctx.setLineDash([]); ly = q['2045']; lx = X2(2045); }
      ctx.fillStyle = AN ? AN.ink : col[tn]; ctx.font = font(9.5, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(tn.replace(' de la Vega', '') + ' ' + (AN ? (ly / 1000).toFixed(1) : Math.round(ly / 1000 * 10) / 10) + 'k', lx + 6 * k, Y2(ly)); });
    // (analysis style) the shaded years say what they are
    if (AN && !o.noProj && o.t) { ctx.font = font(8.5, 600); ctx.fillStyle = pal.ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.t('x41.time.scen'), X2(2025) + 6 * k, y + pt + 5 * k); }
    ctx.restore(); }
  // (analysis style: a swatch takes the strength its cells are drawn with; the open land where the ground already passes the limit surface gets its
  // own entry, since it is drawn; the boundary names its real source — the IGN's municipal outlines through es-atlas — and shows the dash as drawn)
  function timeLegend(only, t) { const pal = P(), C = pal.ex21, AN = pal.an || null, ka = AN ? cellKey(only) : 0.85; const out = [baseItem(t, false)];
    if (only === 'built') TD.periods.forEach(([key, a, b, c]) => out.push({ sw: perCol(key, c), label: t('x36.per.' + key) }));
    if (only === 'density') TD.density_breaks.forEach(([a, b], i) => out.push({ sw: densCol(i), alpha: ka, label: b > 1e8 ? t('x36.dens.top', { a: (a * 100).toLocaleString('en-US') }) : t('x36.dens', { a: (a * 100).toLocaleString('en-US'), b: (b * 100).toLocaleString('en-US') }) }));
    if (only === 'edge') { ['free', '30-60', '15-30', '0-15'].forEach(c => out.push({ sw: edgeCol(c, false), alpha: ka, label: t('x36.edge.' + c, { ha: km2(TD.edge_ha[c] || 0) }) }));
      if (AN && TD.edge_ha.above) out.push({ sw: edgeCol('above', false), alpha: ka, label: t('x41.time.above', { ha: km2(TD.edge_ha.above) }) }); }
    if (only !== 'built') out.push({ sw: C.built, label: t('x34.lg.built') });
    if (AN) out.push({ line: C.street, wk: 0.7, label: t('x41.time.street') });   // the streets are drawn on the three maps: the key says what they are
    out.push(AN ? { line: C.muni, dash: true, w: 1, wk: 1.1, dk: [6, 4], label: t('x41.time.muni') } : { line: C.muni, dash: true, w: 1, label: t('x35.lg.muni') }); return out; }
  // ---------- WHO LIVES AROUND THE BASE (owner request, 16 Nov 2026): INE census sections (ADRH 2024) and the census by town ----------
  let PD = null, PDp = null;
  function readyPeople() { if (PDp) return PDp; PDp = fetch('data/ex21/people.json?v=' + (root.GA_BUILD || '')).then(r => r.json()).then(j => (PD = j)).catch(e => { PDp = null; throw e; }); return PDp; }
  // fixed class breaks per indicator (5 classes, js/palette.js choro: light → dark)
  const PBR = { age: [37, 39, 41, 43], u18: [16, 18, 20, 22], o65: [10, 14, 18, 22], es: [90, 93, 95, 96.5], inc: [12000, 13000, 14000, 16000], one: [22, 26, 30, 34], hh: [2.4, 2.5, 2.6, 2.7] };
  const pcls = (k, v) => { const b = PBR[k]; let i = 0; while (i < b.length && v >= b[i]) i++; return i; };
  function drawPeople(ctx, x, y, w, h, o) {
    o = o || {}; if (!D || !PD) return false; const pal = P(), C = pal.ex21, ramp = pal.choro, AN = pal.an || null; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const E = CITY, mpp = (E.x1 - E.x0) / w, k = o.k || w / 1000; const key = o.only || 'age';
    const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.closePath(); };
    if (o.small && o.noNorth == null) o = Object.assign({}, o, { noNorth: true, noScale: true }); const U = furniture(ctx, o, x, y, w, h, k, F), V = U.V;
    ctx.save(); ctx.beginPath(); ctx.rect(V[0], V[1], V[2] - V[0], V[3] - V[1]); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round';
    // the class colour fills each section; the buildings (OSM) are drawn darker over it, to show where in the section people live
    PD.sections.forEach(sc => { const v = sc[key]; sc.r.forEach(pg => { path(pg); if (v == null) { ctx.fillStyle = '#FFFFFF'; ctx.fill(); if (AN) { path(pg); anHatch(ctx, V, pal.tour.missing, (o.small ? 9 : 5) * k, (o.small ? 1.6 : 1) * k, 1); path(pg); } } else { ctx.globalAlpha = 0.85; ctx.fillStyle = ramp[pcls(key, v)]; ctx.fill(); ctx.globalAlpha = 1; } ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.9 * k; ctx.stroke(); }); });
    ctx.globalAlpha = 0.22; ctx.fillStyle = pal.ink; D.builds.forEach(rs => { path(rs); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = pal.ink3; ctx.lineWidth = 1.1 * k; D.area.forEach(a => { path(a.g); ctx.stroke(); }); ctx.setLineDash([]);
    if (AN) anGrain(ctx, V, k, AN);
    const base = D.edge.find(f => f.p.k === 'base'); if (base && AN) anBase(ctx, () => path(base.g), V, k, AN, false, o.small ? 0.7 : 1); else if (base) { path(base.g); ctx.fillStyle = C.base; ctx.fill(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
    let NFP = null; const NBX = [];
    D.edge.filter(f => f.p.k === 'town').forEach(f => { const [u, v] = f.g; nameFont(ctx, font, k, o.nameSz ? o.nameSz / (0.76 * k) : o.small ? 11 : 15); const q = place(V, U.K, X(u), Y(v) - 13 * k, ctx.measureText(f.p.nm.toUpperCase()).width, 18 * k, 8 * k); if (!q) return; const px = q[0]; let py = q[1] + 13 * k;   // o.nameSz = the names' size in px (a small map on a big sheet)
      if (o.nameSz && base) { const hh = o.nameSz, tw = ctx.measureText(f.p.nm.toUpperCase()).width;   // such a name moves up or down until it is clear of the fence and of the names before it
        if (!NFP) { NFP = []; base.g.forEach(r => r.forEach((p0, i) => { const p1 = r[(i + 1) % r.length], ax = X(p0[0]), ay = Y(p0[1]), bx2 = X(p1[0]), by2 = Y(p1[1]), n = Math.max(1, Math.ceil(Math.hypot(bx2 - ax, by2 - ay) / (hh * 0.35))); for (let j = 0; j < n; j++) NFP.push([ax + (bx2 - ax) * j / n, ay + (by2 - ay) * j / n]); })); }
        const box = (yy) => [px - tw / 2 - hh * 1.3, yy - 8 * k - hh * 1.3, px + tw / 2 + hh * 1.3, yy - 8 * k + hh * 0.6], hit = (yy) => { const r = box(yy); return r[1] < V[1] || r[3] > V[3] || NFP.some(p => p[0] > r[0] && p[0] < r[2] && p[1] > r[1] && p[1] < r[3]) || NBX.some(b => r[2] > b[0] && r[0] < b[2] && r[3] > b[1] && r[1] < b[3]); };
        const c = [0, 1, -1, 2, -2, 3, -3, 4, -4].map(j => py + j * hh * 0.8).find(yy => !hit(yy)); if (c != null) py = c; NBX.push(box(py)); }
      ctx.lineWidth = (o.nameSz ? o.nameSz * 0.42 / k : 4) * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(f.p.nm.toUpperCase(), px, py - 8 * k); ctx.fillStyle = C.town; ctx.fillText(f.p.nm.toUpperCase(), px, py - 8 * k); }); nameEnd(ctx);
    if (base && !o.small) { const rx = X((D.runway[0][0] + D.runway[1][0]) / 2), ry = Y((D.runway[0][1] + D.runway[1][1]) / 2); nameFont(ctx, font, k, 14); if (AN) { ctx.lineJoin = 'round'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6 * k; ctx.strokeText(t('x34.base').toUpperCase(), rx - 60 * k, ry); } ctx.fillStyle = AN ? AN.ink : '#FFFFFF'; ctx.fillText(t('x34.base').toUpperCase(), rx - 60 * k, ry); nameEnd(ctx); }
    ctx.restore(); frameTop(ctx, o, U, k, F);
    if (!o.noScale) scaleBar(ctx, V[0] + 22 * k, V[3] - 24 * k, 1000 / mpp, k, font);
    return true;
  }
  function peopleLegend(key, t) { const pal = P(), b = PBR[key], f = (v) => key === 'inc' ? '€' + v.toLocaleString('en-US') : String(v); const u = key === 'age' || key === 'hh' || key === 'inc' ? '' : ' %';
    const lab = [`< ${f(b[0])}${u}`, `${f(b[0])}–${f(b[1])}${u}`, `${f(b[1])}–${f(b[2])}${u}`, `${f(b[2])}–${f(b[3])}${u}`, `≥ ${f(b[3])}${u}`];
    return lab.map((l, i) => ({ sw: pal.choro[i], alpha: 0.85, label: l })); }
  // what the employed residents do (census, by town): 100 % bars, the branch "public administration and defence" first
  const PBRANCH = ['public', 'trade', 'hospitality', 'health', 'education', 'office', 'industry', 'construction', 'transport', 'farming', 'other'];
  function drawBranchBars(ctx, x, y, w, h, o) { o = o || {}; const pal = P(), t = o.t || ((s) => s), k = o.k || 1, F = root.GA.pages.font(), font = (sz, wt) => `${wt || 500} ${Math.round(sz * k)}px ${F}`;
    const AN = pal.an || null; const cols = AN ? Object.fromEntries(PBRANCH.map((b, i) => [b, b === 'public' ? AN.branch.public : AN.branch.greys[(i - 1) % AN.branch.greys.length]]))
      : { public: pal.ex21.base, trade: pal.red, hospitality: pal.rose, health: pal.blue, education: pal.base.blueGrey, office: pal.base.lightBlue, industry: pal.base.burgundy, construction: pal.base.khaki, transport: pal.base.olive, farming: pal.base.chartreuse, other: pal.grey2 };
    const dark = (c) => { const q = hexRgb(c); return 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2] < 140; };
    const towns = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares', 'Granada']; let lw = 150 * k; const rh = h / towns.length;
    // analysis style: the label column is as wide as the longest name; o.nums writes each branch's number (its place in the key) over every segment
    if (AN) { ctx.save(); lw = 0; towns.forEach(tn => { ctx.font = font(11, tn === 'Granada' ? 700 : 600); lw = Math.max(lw, ctx.measureText(tn === 'Granada' ? t('x37.granada') : tn).width); }); lw += 16 * k; ctx.restore(); }
    ctx.save(); ctx.direction = 'ltr'; towns.forEach((tn, i) => { const T = PD.towns[tn], tot = PBRANCH.reduce((a, b) => a + (T.branch[b] || 0), 0); const by = y + i * rh; let bx = x + lw;
      ctx.font = font(11, tn === 'Granada' ? 700 : 600); ctx.fillStyle = pal.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(tn === 'Granada' ? t('x37.granada') : tn, x + lw - 8 * k, by + rh * 0.42);
      PBRANCH.forEach(b => { const ww = (T.branch[b] || 0) / tot * (w - lw); ctx.fillStyle = cols[b]; ctx.fillRect(bx, by + rh * 0.12, ww, rh * 0.6); if (AN) { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by + rh * 0.12, ww, rh * 0.6); } if (ww > 34 * k) { ctx.fillStyle = (AN ? dark(cols[b]) : ['public', 'trade', 'industry', 'transport', 'health'].includes(b)) ? '#FFFFFF' : pal.ink; ctx.font = font(9.5, 700); ctx.textAlign = 'center'; ctx.fillText(Math.round((T.branch[b] || 0) / tot * 100) + '%', bx + ww / 2, by + rh * 0.42); }
        if (AN && o.nums) { ctx.fillStyle = b === 'public' ? cols[b] : pal.ink; ctx.font = font(8.2, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(PBRANCH.indexOf(b) + 1), bx + ww / 2, by + rh * 0.12 - 3.2 * k); ctx.textBaseline = 'middle'; } bx += ww; }); });
    ctx.restore(); return PBRANCH.map(b => ({ sw: cols[b], label: t('x37.br.' + b) })); }
  root.GA.ex21 = { ready, readyAreas, readyAerial, loadAerial, aerialLegend, get aerial() { return AER; }, drawArea, drawSection, areaLegend, drawAreaKey, keyLegend, get areas() { return AR; }, drawCity, drawGaps, cityLegend, mapLegend, MAPS: ['island', 'walk', 'growth', 'height'], CITY, get data() { return D; },
    readyFactory, drawFactory, factoryLegend, drawFactoryKey, FMAPS: ['estate', 'access', 'land', 'time'], get factory() { return FD; }, km2, scaleBar, mapTitle, titleBand, drawStrategy, strategyLegend,
    readyTime, drawTime, readyTownEdges, townEdgeLegend, get townEdges() { return TE; }, drawDwellChart, drawPopChart, timeLegend, get time() { return TD; }, TFIVE, tcol,
    readyPeople, drawPeople, peopleLegend, drawBranchBars, get people() { return PD; },
    // print styles: setStyle('analysis' | null); the analysis style's own marks for a sheet's own layers (tools/ex21_pages)
    setStyle, get an() { return P().an || null; }, anHatch, anFence, anBase, anGrain, anPhoto, anPattern, baseItem, heightImg, edgeImg, metroCol };
})(window);
