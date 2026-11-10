/* Exercise 1.3 — the identity map as an illustrated map (build 5.38, owner request with a reference image).
   A 5 × 5 km plan of central Granada (EPSG:25830, north up) on cream paper: every street as a thin line, the rivers,
   the hills outside the built city as faint 10 m contours, district names in spaced capitals — and the city's best-known
   landmarks as small 3D line drawings standing at their real positions (OSM footprints / Overture places).
   HONESTY: the drawings are schematic illustrations, not to scale and not measured: their shapes are simplified from
   the real buildings, and their size is enlarged so they read on an A3 page. The map says so in its note.
   GA.ex13ident = { ready(), draw(ctx, x, y, S, o), legendItems(t), LANDMARKS, EXTENT } */
(function (root) {
  const EXT = { x0: 444700, y0: 4111700, x1: 449700, y1: 4116700 }; // 5 × 5 km
  let BASE = null, BASEp = null;
  const P = () => root.GA.palette;
  // ---------- base data (loaded once) ----------
  function ready() {
    if (BASEp) return BASEp; const v = '?v=' + (root.GA_BUILD || ''); const prj = root.GA.proj.EPSG25830;
    const ll0 = prj.inverse([EXT.x0, EXT.y0]), ll1 = prj.inverse([EXT.x1, EXT.y1]); const bb = [ll0[0], ll0[1], ll1[0], ll1[1]];
    const img = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(u)); i.src = u + v; });
    BASEp = Promise.all([root.GA.data.chunked('streets', bb, 0, 400), root.GA.data.single('water'), root.GA.data.single('contours_10m'), root.GA.data.chunked('parks', bb, 0, 400), img('data/ex13/art/centre_city.png'), fetch('data/ex13/frame.json' + v).then(r => r.json())])
      .then(([streets, water, cont, parks, city, frame]) => { const U = (p) => prj.forward(p);
        const lines = (fc, keep) => { const out = []; fc.forEach(f => { if (keep && !keep(f.properties || {})) return; const g = f.geometry; if (!g) return; const L = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []; L.forEach(l => out.push({ p: l.map(U), pr: f.properties || {} })); }); return out; };
        const seen = new Set(); const park = parks.filter(f => { const id = (f.properties || {}).id; if (seen.has(id)) return false; seen.add(id); return (f.properties || {}).le === 'park'; });
        return (BASE = { streets: lines(streets), water: lines(water.features, (p) => /Darro|Genil|Beiro/.test(p.nm || '') && !/Acequia/.test(p.nm || '')), cont: lines(cont.features), parks: lines(park), city, frame }); })
      .catch(e => { BASEp = null; throw e; });
    return BASEp;
  }
  // ---------- a tiny axonometric line-drawing kit (seen from the south-west, z up) ----------
  // local metres: x east, y north, z up. Screen: X = (x − y)·cos30, Y = −(x + y)·sin30 − z
  function Kit(ctx, ox, oy, q, ink, paper, tint) {
    const C = 0.866, Sn = 0.5; const bb = [1e9, 1e9, -1e9, -1e9]; const pr = (x, y, z) => { const p = [ox + (x - y) * C * q, oy - ((x + y) * Sn + z) * q]; if (p[0] < bb[0]) bb[0] = p[0]; if (p[1] < bb[1]) bb[1] = p[1]; if (p[0] > bb[2]) bb[2] = p[0]; if (p[1] > bb[3]) bb[3] = p[1]; return p; };
    const lw = Math.max(0.6, q * 0.9);
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach((p, i) => { const s = pr(p[0], p[1], p[2]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); };
    const line = (a, b, w) => { const s = pr(...a), e = pr(...b); ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.strokeStyle = ink; ctx.lineWidth = (w || 0.7) * lw; ctx.stroke(); };
    const path3 = (pts, close, w, fill) => { ctx.beginPath(); pts.forEach((p, i) => { const s = pr(p[0], p[1], p[2]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); if (close) ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = ink; ctx.lineWidth = (w || 1) * lw; ctx.stroke(); };
    // a face given by origin o and edge vectors u, v (3D): window grid / arcade on it
    const at = (o, u, v, s, t) => [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t];
    const windows = (o, u, v, cols, rows, kind) => { if (!cols || !rows) return; const mw = 0.5 / cols, mh = 0.42 / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const s0 = (i + 0.5) / cols - mw / 2, s1 = s0 + mw, t0 = (j + 0.5) / rows - mh / 2, t1 = t0 + mh;
        if (kind === 'arch') { const pts = [at(o, u, v, s0, t0), at(o, u, v, s1, t0)]; for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI; pts.push(at(o, u, v, (s0 + s1) / 2 + Math.cos(a) * mw / 2, t1 + Math.sin(a) * mw * 0.6)); } pts.push(at(o, u, v, s0, t0)); path3(pts.slice(0, 2).concat(pts.slice(2).reverse()).concat([]), false, 0.6); path3([at(o, u, v, s0, t0), at(o, u, v, s0, t1)], false, 0.6); path3([at(o, u, v, s1, t0), at(o, u, v, s1, t1)], false, 0.6); path3([at(o, u, v, s0, t0), at(o, u, v, s1, t0)], false, 0.6); }
        else if (kind === 'slit') path3([at(o, u, v, (s0 + s1) / 2, t0), at(o, u, v, (s0 + s1) / 2, t1)], false, 0.8);
        else path3([at(o, u, v, s0, t0), at(o, u, v, s1, t0), at(o, u, v, s1, t1), at(o, u, v, s0, t1)], true, 0.55); } };
    const vlines = (o, u, v, n) => { for (let i = 1; i < n; i++) path3([at(o, u, v, i / n, 0), at(o, u, v, i / n, 1)], false, 0.45); };
    const hlines = (o, u, v, n) => { for (let i = 1; i < n; i++) path3([at(o, u, v, 0, i / n), at(o, u, v, 1, i / n)], false, 0.45); };
    // box with its three visible faces (west, south, top) and optional detail
    function box(x, y, z, w, d, h, o) { o = o || {};
      const W = [[x, y, z], [x, y + d, z], [x, y + d, z + h], [x, y, z + h]], S = [[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]], T = [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]];
      poly(W, tint); poly(S, paper); if (!o.noTop) poly(T, paper);
      if (o.win) { windows([x, y, z], [w, 0, 0], [0, 0, h], o.win[0], o.win[1], o.kind); windows([x, y, z], [0, d, 0], [0, 0, h], o.win[2] != null ? o.win[2] : Math.max(1, Math.round(o.win[0] * d / w)), o.win[1], o.kind); }
      if (o.vl) { vlines([x, y, z], [w, 0, 0], [0, 0, h], o.vl); vlines([x, y, z], [0, d, 0], [0, 0, h], Math.max(2, Math.round(o.vl * d / w))); }
      if (o.hl) { hlines([x, y, z], [w, 0, 0], [0, 0, h], o.hl); hlines([x, y, z], [0, d, 0], [0, 0, h], o.hl); }
      if (o.cren) crenel(x, y, z + h, w, d, o.cren); }
    // battlements along the four top edges (back edges first)
    function crenel(x, y, z, w, d, m) { const n1 = Math.max(2, Math.round(w / (2 * m))), n2 = Math.max(2, Math.round(d / (2 * m)));
      const mer = (px, py) => box(px, py, z, m, m, m * 0.9, { noCren: true });
      for (let i = n1 - 1; i >= 0; i--) mer(x + i * w / n1, y + d - m); for (let i = n2 - 1; i >= 0; i--) mer(x + w - m, y + i * d / n2);
      for (let i = n2 - 1; i >= 0; i--) mer(x, y + i * d / n2); for (let i = n1 - 1; i >= 0; i--) mer(x + i * w / n1, y); }
    // gable roof, ridge along x (or y with alongY)
    function gable(x, y, z, w, d, rh, alongY) {
      if (!alongY) { const ym = y + d / 2; poly([[x, y + d, z], [x + w, y + d, z], [x + w, ym, z + rh], [x, ym, z + rh]], paper); poly([[x, y, z], [x, y + d, z], [x, ym, z + rh]], tint); poly([[x, y, z], [x + w, y, z], [x + w, ym, z + rh], [x, ym, z + rh]], paper); }
      else { const xm = x + w / 2; poly([[x + w, y, z], [x + w, y + d, z], [xm, y + d, z + rh], [xm, y, z + rh]], paper); poly([[x, y, z], [x + w, y, z], [xm, y, z + rh]], paper); poly([[x, y, z], [x, y + d, z], [xm, y + d, z + rh], [xm, y, z + rh]], tint); } }
    function pyramid(x, y, z, w, d, rh) { const a = [x + w / 2, y + d / 2, z + rh]; poly([[x + w, y, z], [x + w, y + d, z], a], paper); poly([[x, y + d, z], [x + w, y + d, z], a], paper); poly([[x, y, z], [x, y + d, z], a], tint); poly([[x, y, z], [x + w, y, z], a], paper); }
    // vertical cylinder: front half of the side, then the top
    function cyl(cx, cy, z, r, h, o) { o = o || {}; const N = 48, a0 = 0.75 * Math.PI, a1 = 1.75 * Math.PI; const side = [];
      for (let k = 0; k <= N; k++) { const a = a0 + (a1 - a0) * k / N; side.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]); } for (let k = N; k >= 0; k--) { const a = a0 + (a1 - a0) * k / N; side.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z + h]); }
      poly(side, paper);
      if (o.arches) for (let k = 0; k < o.arches; k++) { const a = a0 + (a1 - a0) * (k + 0.5) / o.arches, aw = (a1 - a0) / o.arches * 0.32; const p = []; for (let j = 0; j <= 8; j++) { const b = a - aw + 2 * aw * j / 8; p.push([cx + r * Math.cos(b), cy + r * Math.sin(b), z + h * 0.62 + Math.sin(j / 8 * Math.PI) * h * 0.12]); } p.unshift([cx + r * Math.cos(a - aw), cy + r * Math.sin(a - aw), z + h * 0.08]); p.push([cx + r * Math.cos(a + aw), cy + r * Math.sin(a + aw), z + h * 0.08]); path3(p, false, 0.55); }
      if (o.bands) for (let b = 1; b < o.bands; b++) { const p = []; for (let k = 0; k <= N; k++) { const a = a0 + (a1 - a0) * k / N; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z + h * b / o.bands]); } path3(p, false, 0.5); }
      const top = []; for (let k = 0; k < N; k++) { const a = 2 * Math.PI * k / N; top.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z + h]); } if (!o.open) poly(top, paper); else { path3(top, true, 1); const inn = top.map(p => [cx + (p[0] - cx) * o.open, cy + (p[1] - cy) * o.open, z + h]); poly(inn, o.inner || tint); } }
    // hemisphere dome (convex outline from sampled points) with ribs on the visible side
    function dome(cx, cy, z, r, o) { o = o || {}; const hz = (o.tall || 1) * r; const pts = []; for (let i = 0; i <= 12; i++) for (let k = 0; k < 24; k++) { const el = i / 12 * Math.PI / 2, az = k / 24 * 2 * Math.PI; pts.push(pr(cx + r * Math.cos(el) * Math.cos(az), cy + r * Math.cos(el) * Math.sin(az), z + hz * Math.sin(el))); }
      const hull = hull2(pts); ctx.beginPath(); hull.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = paper; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke();
      const ribs = o.ribs || 8; for (let k = 0; k < ribs; k++) { const az = 0.75 * Math.PI + (k + 0.5) / ribs * Math.PI; const p = []; for (let i = 0; i <= 12; i++) { const el = i / 12 * Math.PI / 2; p.push([cx + r * Math.cos(el) * Math.cos(az), cy + r * Math.cos(el) * Math.sin(az), z + hz * Math.sin(el)]); } path3(p, false, 0.5); }
      if (o.lantern) { cyl(cx, cy, z + hz * 0.96, r * 0.22, r * 0.4, {}); cone(cx, cy, z + hz * 0.96 + r * 0.4, r * 0.24, r * 0.35); } }
    function cone(cx, cy, z, r, h) { const pts = [pr(cx, cy, z + h)]; for (let k = 0; k < 24; k++) { const a = k / 24 * 2 * Math.PI; pts.push(pr(cx + r * Math.cos(a), cy + r * Math.sin(a), z)); } const hull = hull2(pts); ctx.beginPath(); hull.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = paper; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke(); }
    // tree: trunk + crown (round) or cypress (tall)
    function tree(x, y, h, cypress) { line([x, y, 0], [x, y, h * 0.35], 0.8); const c = pr(x, y, h * (cypress ? 0.62 : 0.72)); ctx.beginPath(); if (cypress) ctx.ellipse(c[0], c[1], h * 0.13 * q, h * 0.4 * q, 0, 0, 7); else ctx.arc(c[0], c[1], h * 0.32 * q, 0, 7); ctx.fillStyle = paper; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = lw * 0.8; ctx.stroke(); }
    // ground slab (hill / platform) as an extruded polygon: only the south/west-facing sides
    function slab(pts, z0, h) { const n = pts.length; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const nx = b[1] - a[1], ny = -(b[0] - a[0]); if (nx + ny < 0) poly([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z0 + h], [a[0], a[1], z0 + h]], tint); } poly(pts.map(p => [p[0], p[1], z0 + h]), paper); }
    // continuous battlemented wall from a to b (thickness t, height h): the face towards the viewer, the wall walk, the merlons
    function wall(a, b, h, t, z0) { z0 = z0 || 0; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * t, ny = dx / L * t;
      const front = (nx + ny) > 0 ? [[a[0], a[1]], [b[0], b[1]]] : [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny]];
      poly([[a[0], a[1], z0 + h], [b[0], b[1], z0 + h], [b[0] + nx, b[1] + ny, z0 + h], [a[0] + nx, a[1] + ny, z0 + h]], paper);
      poly([[front[0][0], front[0][1], z0], [front[1][0], front[1][1], z0], [front[1][0], front[1][1], z0 + h], [front[0][0], front[0][1], z0 + h]], (dx > 0 && dy < 0) || (dx < 0 && dy > 0) ? paper : tint);
      const m = Math.max(2, t * 0.9), n = Math.max(2, Math.floor(L / (2 * m))); const pts = []; for (let i = 0; i < n; i++) { const s0 = i / n, s1 = (i + 0.5) / n; const P0 = [front[0][0] + (front[1][0] - front[0][0]) * s0, front[0][1] + (front[1][1] - front[0][1]) * s0], P1 = [front[0][0] + (front[1][0] - front[0][0]) * s1, front[0][1] + (front[1][1] - front[0][1]) * s1]; pts.push([P0[0], P0[1], z0 + h], [P0[0], P0[1], z0 + h + m], [P1[0], P1[1], z0 + h + m], [P1[0], P1[1], z0 + h]); }
      pts.push([front[1][0], front[1][1], z0 + h]); path3(pts, false, 0.8); }
    return { pr, poly, line, path3, box, crenel, gable, pyramid, cyl, dome, cone, tree, slab, windows, wall, q, bb };
  }
  function hull2(P0) { const p = P0.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); } for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } up.pop(); lo.pop(); return lo.concat(up); }
  // ---------- the landmarks: real position (EPSG:25830), a schematic drawing in local metres, a label ----------
  // e = enlargement of the drawing (schematic; not to scale)
  const LANDMARKS = [
    { id: 'sacromonte', x: 448761, y: 4115313, e: 1.2, name: 'Abadía del Sacromonte', src: 'Overture place', draw: (K) => { K.box(-30, -10, 0, 60, 34, 12, { win: [8, 1, 4], kind: 'arch', cren: 0 }); K.gable(-30, -10, 12, 60, 34, 7); K.box(-44, -14, 0, 14, 14, 30, { win: [2, 3], kind: 'slit' }); K.pyramid(-44, -14, 30, 14, 14, 8);
      [[-70, -40], [-56, -46], [-84, -30], [-40, -52]].forEach(([x, y], i) => { K.box(x, y, 0, 12, 8, 6, {}); const c = K.pr(x + 6, y, 2.4); }); } },
    { id: 'cartuja', x: 446810, y: 4116346, e: 1.15, name: 'Monasterio de la Cartuja', src: 'OSM building', draw: (K) => { K.box(-10, 0, 0, 70, 50, 9, { win: [10, 1, 7], kind: 'arch' }); K.box(0, 10, 9, 50, 30, 0.1, { noTop: false }); K.box(-40, -18, 0, 46, 20, 18, { win: [5, 1, 2] }); K.gable(-40, -18, 18, 46, 20, 9); K.box(-54, -18, 0, 14, 14, 34, { win: [1, 3], kind: 'arch' }); K.pyramid(-54, -18, 34, 14, 14, 9); K.cone(-47, -11, 43, 1.2, 4); } },
    { id: 'albaicin', x: 447403, y: 4115149, e: 1.3, name: 'Mirador de San Nicolás · Albaicín', src: 'OSM building', draw: (K) => {
      [[-40, 24, 10, 8, 7], [-26, 30, 12, 9, 6], [22, 26, 11, 8, 7], [36, 16, 10, 10, 6], [-48, 6, 11, 9, 6], [30, -4, 9, 8, 5]].forEach(([x, y, w, d, h]) => { K.box(x, y, 0, w, d, h, { win: [2, 1, 1] }); K.gable(x, y, h, w, d, 2.6); });
      K.box(-14, 0, 0, 30, 14, 12, { win: [3, 1, 1], kind: 'arch' }); K.gable(-14, 0, 12, 30, 14, 6); K.box(-24, -2, 0, 10, 10, 24, { win: [1, 2], kind: 'arch' }); K.pyramid(-24, -2, 24, 10, 10, 6);
      K.box(-30, -26, 0, 52, 14, 2, {}); [-26, -16, -6, 4, 14].forEach(x => K.tree(x, -22, 9)); } },
    { id: 'hospital', x: 446653, y: 4115567, e: 0.9, name: 'Hospital Real', src: 'OSM building', draw: (K) => { const w = 100; K.box(-50, -50, 0, w, w, 12, { win: [12, 2], kind: 'arch' }); K.box(-6, -50, 12, 12, w, 0.1, {}); K.box(-50, -6, 12, w, 12, 0.1, {}); K.box(-50, -50, 12, w, w, 4, { noTop: true }); K.box(-7, -7, 16, 14, 14, 10, {}); K.dome(0, 0, 26, 7, { ribs: 6 }); } },
    { id: 'toros', x: 446077, y: 4116002, e: 0.95, name: 'Plaza de Toros', src: 'Overture place', draw: (K) => { K.cyl(0, 0, 0, 42, 16, { arches: 14, open: 0.72, inner: K.paperIn, bands: 2 }); } },
    { id: 'sanjuan', x: 446473, y: 4115081, e: 1.15, name: 'Basílica de San Juan de Dios', src: 'OSM building', draw: (K) => { K.box(-14, -10, 0, 34, 50, 16, { win: [3, 1, 4] }); K.box(-6, 6, 16, 18, 18, 8, {}); K.dome(3, 15, 24, 9, { ribs: 8, lantern: true }); K.box(-20, -24, 0, 46, 14, 22, { win: [4, 2], kind: 'arch' }); K.box(-24, -26, 0, 10, 10, 34, { win: [1, 2], kind: 'arch' }); K.pyramid(-24, -26, 34, 10, 10, 9); K.box(18, -26, 0, 10, 10, 34, { win: [1, 2], kind: 'arch' }); K.pyramid(18, -26, 34, 10, 10, 9); } },
    { id: 'cathedral', x: 446816, y: 4114632, e: 1.05, name: 'Catedral · Capilla Real', src: 'OSM building', draw: (K) => {
      K.box(-55, -32, 0, 105, 64, 26, { vl: 11, win: [11, 1, 6], kind: 'arch' }); K.gable(-55, -32, 26, 105, 64, 10);
      K.cyl(52, 0, 0, 26, 40, { arches: 6, bands: 2 }); K.dome(52, 0, 40, 26, { ribs: 10, lantern: true, tall: 0.9 });
      K.box(-70, -34, 0, 15, 68, 44, { win: [1, 1, 3], kind: 'arch', vl: 3 }); K.box(-70, -34, 44, 15, 68, 4, {});
      K.box(-70, -54, 0, 18, 18, 46, { win: [2, 3], kind: 'arch' }); K.box(-67, -51, 46, 12, 12, 9, { win: [1, 1], kind: 'arch' }); K.pyramid(-67, -51, 55, 12, 12, 6);
      K.box(10, -66, 0, 52, 22, 20, { vl: 8 }); K.box(10, -66, 20, 52, 22, 2, {}); for (let i = 0; i <= 6; i++) K.cone(12 + i * 8, -65, 22, 1.4, 6); } },
    { id: 'alhambra', x: 447560, y: 4114660, e: 0.62, name: 'Alhambra', src: 'OSM buildings (Alcazaba, Torre de Comares, Palacio de Carlos V)', draw: (K) => {
      K.slab([[-150, -40], [40, -110], [250, -20], [270, 70], [60, 90], [-160, 30]], 0, 12);
      const T = (x, y, w, h) => K.box(x, y, 12, w, w, h, { cren: 2.2, win: [1, Math.max(1, Math.round(h / 12)), 1], kind: 'slit' });
      const W = (a, b, h) => K.wall(a, b, h, 4, 12);
      W([-120, 20], [40, 80], 8); W([40, 80], [240, 60], 8); T(60, 74, 14, 26); T(150, 66, 12, 22); T(230, 56, 14, 24);
      K.box(70, 10, 12, 60, 40, 10, { win: [6, 1, 4] }); T(110, 34, 16, 40);
      T(-60, 6, 16, 30); T(-90, 14, 14, 24);
      K.box(-30, -40, 12, 56, 56, 16, { win: [7, 2], kind: 'arch' }); K.box(-30, -40, 28, 56, 56, 0.1, {}); K.cyl(-2, -12, 28, 15, 0.1, { open: 0.85 });
      W([-140, -30], [40, -100], 8); W([40, -100], [250, -14], 8);
      T(-140, -40, 18, 34); T(-110, -54, 14, 26); T(0, -88, 12, 22); T(100, -74, 12, 22); T(190, -42, 12, 20); } },
    { id: 'generalife', x: 448018, y: 4114788, e: 0.95, name: 'Generalife', src: 'OSM building', draw: (K) => { for (let i = 5; i >= 0; i--) { K.tree(-34, -10 + i * 9, 18, true); K.tree(34, -10 + i * 9, 18, true); } K.box(-26, 40, 0, 52, 12, 12, { win: [6, 1, 1], kind: 'arch' }); K.gable(-26, 40, 12, 52, 12, 4); K.box(-4, -22, 0, 8, 60, 0.6, {}); K.box(-26, -32, 0, 52, 10, 9, { win: [5, 1, 1], kind: 'arch' }); K.gable(-26, -32, 9, 52, 10, 3); } },
    { id: 'congresos', x: 446843, y: 4113439, e: 0.85, name: 'Palacio de Congresos', src: 'OSM building', draw: (K) => { K.box(-60, -50, 0, 120, 90, 14, { vl: 16, hl: 2 }); K.box(-30, -20, 14, 70, 50, 12, { vl: 10 }); K.box(-60, -66, 0, 70, 16, 4, {}); } },
    { id: 'ciencias', x: 446305, y: 4112978, e: 1.05, name: 'Parque de las Ciencias', src: 'OSM building / Overture place', draw: (K) => { K.box(-50, -30, 0, 80, 40, 12, { vl: 12, hl: 2 }); K.dome(42, -6, 0, 14, { ribs: 6 }); K.box(-60, -40, 0, 12, 12, 58, { hl: 8 }); K.box(-62, -42, 58, 16, 16, 6, { vl: 4 }); K.box(-58, -38, 64, 8, 8, 4, {}); } },
    { id: 'estadio', x: 447101, y: 4112000, e: 0.8, name: 'Estadio Nuevo Los Cármenes', src: 'Overture place', draw: (K) => { const R = (r, z) => { const p = []; for (let k = 0; k < 48; k++) { const a = k / 48 * 2 * Math.PI; p.push([r * 1.35 * Math.cos(a), r * Math.sin(a), z]); } return p; };
      const outer = R(70, 0), top = R(70, 22); for (let k = 0; k < 48; k++) { const a = outer[k], b = outer[(k + 1) % 48]; if (Math.sin((k + 0.5) / 48 * 2 * Math.PI) < 0.15 || Math.cos((k + 0.5) / 48 * 2 * Math.PI) < -0.3) K.poly([a, b, top[(k + 1) % 48], top[k]], K.paperIn2); }
      K.poly(top, K.paperIn2); K.poly(R(46, 22).map(p => [p[0], p[1], 6]), K.tintIn); K.poly(R(30, 6).map(p => [p[0] * 1.05, p[1], 6]), K.grass);
      for (let r = 50; r <= 66; r += 5) K.path3(R(r, 22 - (r - 50) * 0.2).map((p, i) => p), true, 0.45); } },
  ];
  const DISTRICTS = [['ALBAICÍN', 447560, 4115700], ['SACROMONTE', 448800, 4115700], ['REALEJO', 447330, 4113900], ['CENTRO', 446250, 4114350], ['ZAIDÍN', 446500, 4112250], ['CARTUJA', 446900, 4116580], ['RONDA', 445250, 4114250], ['GENIL', 448650, 4112650]];
  // ---------- draw the whole map ----------
  function draw(ctx, x, y, S, o) {
    o = o || {}; if (!BASE) return false; const pal = P(), B = pal.base; const mpp = (EXT.x1 - EXT.x0) / S, k = S / 1000;
    const X = (u) => x + (u - EXT.x0) / mpp, Y = (v) => y + (EXT.y1 - v) / mpp; const RED = pal.red, INK = pal.ink;
    const PAPER = '#FFFFFF', LAND = B.cream, STREET = pal.grey2, TINT = pal.blush;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip();
    // 1 ground: the hills and fields outside the built city cream, the city white (GHS built-up shape, data/ex13/art)
    ctx.fillStyle = LAND; ctx.fillRect(x, y, S, S);
    const F = BASE.frame, cpx = (EXT.x0 - F.x0) / 5, cpy = (F.y1 - EXT.y1) / 5, cw = (EXT.x1 - EXT.x0) / 5;
    const cm = document.createElement('canvas'); cm.width = cm.height = Math.round(S); const cx = cm.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = true; cx.filter = `blur(${Math.max(2, 9 * k)}px)`; cx.drawImage(BASE.city, cpx, cpy, cw, cw, 0, 0, S, S); cx.filter = 'none'; { const id = cx.getImageData(0, 0, cm.width, cm.height), a = id.data; for (let i = 0; i < a.length; i += 4) { const on = a[i + 3] > 120; a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = on ? 255 : 0; } cx.putImageData(id, 0, 0); }
    // contours on the hills only (outside the city shape), faint red
    ctx.save(); ctx.strokeStyle = 'rgba(153,43,42,.22)'; ctx.lineWidth = 0.6 * k; ctx.beginPath(); BASE.cont.forEach(l => l.p.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); ctx.restore();
    ctx.drawImage(cm, x, y);
    // the city edge as a thin red line with a soft outer halo (as a coastline)
    const ed = document.createElement('canvas'); ed.width = ed.height = Math.round(S); const ex = ed.getContext('2d'); ex.filter = `blur(${1.2 * k}px)`; ex.drawImage(cm, 0, 0); ex.filter = 'none'; ex.globalCompositeOperation = 'source-in'; ex.fillStyle = 'rgba(153,43,42,.35)'; ex.fillRect(0, 0, S, S); ex.globalCompositeOperation = 'destination-out'; ex.drawImage(cm, 0, 0); ctx.drawImage(ed, x, y);
    // 2 parks (OSM leisure=park): a light olive wash
    ctx.fillStyle = pal.base ? 'rgba(126,123,67,.13)' : '#eee'; BASE.parks.forEach(l => { ctx.beginPath(); l.p.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.closePath(); ctx.fill(); });
    { const area = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
      const inR = (r, u, v) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (((r[i][1] > v) !== (r[j][1] > v)) && (u < (r[j][0] - r[i][0]) * (v - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) c = !c; return c; };
      const Kt = Kit(ctx, 0, 0, S / 5000 * 2.2, pal.olive, PAPER, PAPER); const G = 70;
      BASE.parks.forEach(l => { if (area(l.p) < 8000) return; const xs = l.p.map(p => p[0]), ys = l.p.map(p => p[1]); for (let u = Math.ceil(Math.min(...xs) / G) * G; u < Math.max(...xs); u += G) for (let v = Math.ceil(Math.min(...ys) / G) * G; v < Math.max(...ys); v += G) { const uu = u + ((v / G) % 2 ? G / 2 : 0); if (!inR(l.p, uu, v)) continue; const K2 = Kit(ctx, X(uu), Y(v), S / 5000 * 2.2, pal.olive, PAPER, PAPER); K2.tree(0, 0, 9); } }); }
    // 3 streets: every OSM street thin; main roads a little wider
    const MAIN = /motorway|trunk|primary|secondary/; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [[false, 0.5, STREET], [true, 1.25, pal.grey2]].forEach(([main, w, c]) => { ctx.strokeStyle = c; ctx.lineWidth = w * k; ctx.beginPath(); BASE.streets.forEach(l => { const hw = l.pr.hw || ''; if (/footway|path|steps|track|cycleway/.test(hw) && !main) { if (!/steps|footway/.test(hw)) return; } if (MAIN.test(hw) !== main) return; l.p.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); }); ctx.stroke(); });
    // 4 rivers (Genil, Darro, Beiro): a blue double line
    ctx.lineCap = 'round'; [[4.2, pal.blue], [2.2, pal.base.lightBlue]].forEach(([w, c]) => { ctx.strokeStyle = c; ctx.lineWidth = w * k; ctx.beginPath(); BASE.water.forEach(l => l.p.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); });
    // 5 district names (OSM barrio / distrito names): spaced capitals
    const font = (sz, w) => `${w || 600} ${Math.round(sz * k)}px ${root.GA.pages.font()}`; const spaced = (s) => s.split('').join(' ');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
    DISTRICTS.forEach(([n, u, v]) => { ctx.font = font(15, 600); ctx.lineWidth = 4 * k; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.strokeText(spaced(n), X(u), Y(v)); ctx.fillStyle = RED; ctx.fillText(spaced(n), X(u), Y(v)); });
    ctx.font = font(11, 600); ctx.fillStyle = pal.blue; ctx.save(); ctx.translate(X(448250), Y(4113120)); ctx.rotate(0.2); ctx.fillText(spaced('RÍO GENIL'), 0, 0); ctx.restore();
    // 6 landmarks, north first so the southern drawings overlap them; each fades in with the build-up (o.t)
    const q0 = S / 5000 * 2.7; const L = LANDMARKS.slice().sort((a, b) => b.y - a.y); const tAll = o.upTo != null ? (o.t != null ? o.t : 1) : 1;
    L.forEach((m, i) => { const vis = o.upTo == null ? 1 : Math.max(0, Math.min(1, tAll * L.length - i)); if (vis <= 0) return; const ox = X(m.x), oy = Y(m.y); const q = q0 * m.e * (0.6 + 0.4 * vis);
      ctx.save(); ctx.globalAlpha = o.focus != null && o.focus !== 1 ? 0.25 : vis;
      // a soft white footprint shadow so the drawing lifts off the streets
      const K = Kit(ctx, ox, oy, q, RED, PAPER, TINT); m._K = K; K.paperIn = TINT; K.paperIn2 = PAPER; K.tintIn = TINT; K.grass = 'rgba(126,123,67,.25)'; m.draw(K); ctx.restore();
      if (o.labels !== false) { ctx.save(); ctx.globalAlpha = o.focus != null && o.focus !== 1 ? 0.25 : vis; ctx.font = font(9.2, 700); const lab = m.name.toUpperCase(); const tw = ctx.measureText(lab).width; const bx0 = m._K.bb, lx0 = (bx0[0] + bx0[2]) / 2, ly = Math.max(oy, bx0[3]) + 9 * k; const ox2 = lx0;
        ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(ox2 - tw / 2 - 3 * k, ly - 6.5 * k, tw + 6 * k, 13 * k); ctx.fillStyle = INK; ctx.fillText(lab, ox2, ly); ctx.restore(); } });
    // frame, north arrow, scale bar, note
    ctx.restore(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * k; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
    if (root.GA.pages.northArrow) root.GA.pages.northArrow(ctx, x + S - 30 * k, y + 22 * k, 1.25 * k);
    const km = 1000 / mpp, bx = x + 22 * k, by = y + S - 26 * k; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(bx - 8 * k, by - 22 * k, km + 64 * k, 36 * k); ctx.fillStyle = INK; ctx.fillRect(bx, by, km / 2, 5 * k); ctx.strokeStyle = INK; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, km, 5 * k);
    ctx.font = font(11, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('0', bx, by - 5 * k); ctx.fillText('1 km', bx + km, by - 5 * k);
    return true;
  }
  function legendItems(t) { return [{ line: P().grey2, w: 1, label: t('x32.lg.streets') }, { line: P().blue, w: 3, label: t('x32.lg.rivers') }, { sw: P().base.cream, label: t('x32.lg.hills') }, { sw: '#FFFFFF', edge: P().red, label: t('x32.lg.city') }, { sw: '#FFFFFF', edge: P().red, label: t('x32.lg.landmarks') }]; }
  root.GA.ex13ident = { ready, draw, legendItems, LANDMARKS, EXTENT: EXT, DISTRICTS };
})(window);
