/* Build 5.22 — Exercise 1.3, morphology in the artistic map language: a notation on a 250 m grid.
   Each 250 m cell takes one tone from its built share (sparse < 15 %, medium 15–35 %, compact > 35 % of the cell covered
   by OSM building footprints, read from the same 4 m figure-ground raster as the architectural map); a solid dark-brown
   line runs along the outer edge of contiguous compact cells; mapped squares and pedestrian areas are drawn as a lattice.
   The real footprints stay underneath, very light. Every symbol stands for a whole cell, not a building position.
   Layers can be shown alone ("focus": that layer full, the others faint) or built up one after another ("upTo"), so the
   page preview can play them in sequence. Colours: GA.palette.ex13art. */
(function (root) {
  const CELL = 250; // metres
  const KEYS = ['sparse', 'medium', 'compact', 'edge', 'square'];
  let G = null; // computed once per data load: { n, cov, cls, shares, cells, srcKey }

  const clsOf = (v) => v <= 0.02 ? 0 : v < 0.15 ? 1 : v < 0.35 ? 2 : 3; // 0 = no built ground (paper)
  function prepare(D) {
    if (G && G.src === D) return G;
    const F = D.frame, g = D.fgm, n = Math.round((F.x1 - F.x0) / CELL), R = Math.round((F.x1 - F.x0) / g.px_m); // the raster at its own 4 m pixels (no resampling)
    const c = document.createElement('canvas'); c.width = c.height = R; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false; // nearest pixel: the count must not depend on the browser's resampling
    x.drawImage(D.fgImg, (F.x0 - g.ox) / g.px_m, (g.oy - F.y1) / g.px_m, (F.x1 - F.x0) / g.px_m, (F.y1 - F.y0) / g.px_m, 0, 0, R, R);
    const a = x.getImageData(0, 0, R, R).data; const cov = new Float32Array(n * n); const k = R / n;
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) if (a[(j * R + i) * 4 + 3] > 127) cov[Math.floor(j / k) * n + Math.floor(i / k)]++;
    for (let t = 0; t < n * n; t++) cov[t] /= k * k;
    const cls = new Uint8Array(n * n); const built = [0, 0, 0, 0], cells = [0, 0, 0, 0];
    for (let t = 0; t < n * n; t++) { cls[t] = clsOf(cov[t]); built[cls[t]] += cov[t]; cells[cls[t]]++; }
    const tb = built[1] + built[2] + built[3] || 1;
    G = { src: D, n, cov, cls, cells, shares: [1, 2, 3].map(q => built[q] / tb * 100), builtKm2: tb * CELL * CELL / 1e6 };
    return G;
  }

  // draw the notation into ctx at (x, y), S px square. o.focus = layer index shown full (others faint); o.upTo = number of
  // layers shown (sequence build-up); neither = everything.
  function draw(ctx, D, x, y, S, o) {
    o = o || {}; const A = GA.palette.ex13art; const P = prepare(D); const F = D.frame; const n = P.n, cp = S / n, s = S / 1000; const mpp = (F.x1 - F.x0) / S;
    const X = (u) => x + (u - F.x0) / mpp, Y = (v) => y + (F.y1 - v) / mpp;
    const alpha = (i) => o.focus != null ? (i === o.focus ? 1 : 0.1) : o.upTo != null ? (i < o.upTo - 1 ? 1 : i === o.upTo - 1 ? (o.t != null ? o.t : 1) : 0) : 1; /* 5.34: the newest layer fades in with o.t */
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip(); ctx.fillStyle = A.paper; ctx.fillRect(x, y, S, S);
    // context: the real footprints, very light
    const g = D.fgm; const t = document.createElement('canvas'); t.width = t.height = Math.round(S); const tc = t.getContext('2d'); tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
    tc.drawImage(D.fgImg, (F.x0 - g.ox) / g.px_m, (g.oy - F.y1) / g.px_m, (F.x1 - F.x0) / g.px_m, (F.y1 - F.y0) / g.px_m, 0, 0, t.width, t.height); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = A.context; tc.fillRect(0, 0, t.width, t.height);
    ctx.globalAlpha = 0.07; ctx.drawImage(t, x, y, S, S); ctx.globalAlpha = 1;
    // 0–2: cell tones
    const gap = Math.max(1, 2 * s);
    [[1, A.sparse, 0.8], [2, A.medium, 0.8], [3, A.compact, A.compactAlpha]].forEach(([q, col, a], li) => { const al = alpha(li); if (!al) return; ctx.globalAlpha = a * al; ctx.fillStyle = col;
      for (let tt = 0; tt < n * n; tt++) if (P.cls[tt] === q) ctx.fillRect(x + (tt % n) * cp + gap / 2, y + Math.floor(tt / n) * cp + gap / 2, cp - gap, cp - gap); });
    ctx.globalAlpha = 1;
    // 3: edge of contiguous compact fabric
    { const al = alpha(3); if (al) { const cmp = (i, j) => i >= 0 && j >= 0 && i < n && j < n && P.cls[j * n + i] === 3; ctx.globalAlpha = al; ctx.strokeStyle = A.edge; ctx.lineWidth = 3.6 * s; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if (!cmp(i, j)) continue; const x0 = x + i * cp, y0 = y + j * cp; if (!cmp(i, j - 1)) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + cp, y0); } if (!cmp(i, j + 1)) { ctx.moveTo(x0, y0 + cp); ctx.lineTo(x0 + cp, y0 + cp); } if (!cmp(i - 1, j)) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + cp); } if (!cmp(i + 1, j)) { ctx.moveTo(x0 + cp, y0); ctx.lineTo(x0 + cp, y0 + cp); } }
      ctx.stroke(); ctx.globalAlpha = 1; } }
    // 4: squares and pedestrian areas — a lattice clipped to the mapped shapes, with their outline
    { const al = alpha(4); const sq = (D.human && D.human.areas && D.human.areas.square) || []; if (al && sq.length) { const path = (rings) => rings.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
      ctx.save(); ctx.globalAlpha = al; ctx.beginPath(); sq.forEach(a => path(a.p)); ctx.clip('evenodd'); ctx.strokeStyle = A.square; ctx.lineWidth = 1 * s; ctx.beginPath(); const st = 6 * s;
      for (let q = -S; q < 2 * S; q += st) { ctx.moveTo(x + q, y); ctx.lineTo(x + q + S, y + S); ctx.moveTo(x + q + S, y); ctx.lineTo(x + q, y + S); } ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha = al; ctx.strokeStyle = A.square; ctx.lineWidth = 1.4 * s; ctx.beginPath(); sq.forEach(a => path(a.p)); ctx.stroke(); ctx.restore(); } }
    // municipality, as on the other maps
    ctx.beginPath(); D.muni.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.strokeStyle = A.muni; ctx.lineWidth = 1.2 * s; ctx.setLineDash([7 * s, 4 * s]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  // legend items for ex13's legend(): one per layer, same colours as the drawing
  function legendItems(t, D) {
    const A = GA.palette.ex13art; const P = prepare(D); const pct = (v) => '‎' + Math.round(v) + ' %‎';
    return [
      { sw: A.sparse, alpha: 0.8, label: t('x20.lg.sparse', { p: pct(P.shares[0]) }), layer: 0 },
      { sw: A.medium, alpha: 0.8, label: t('x20.lg.medium', { p: pct(P.shares[1]) }), layer: 1 },
      { sw: A.compact, alpha: A.compactAlpha, label: t('x20.lg.compact', { p: pct(P.shares[2]) }), layer: 2 },
      { edge: A.edge, label: t('x20.lg.edge'), layer: 3 },
      { lattice: A.square, label: t('x20.lg.square'), layer: 4 },
      { line: A.muni, dash: true, label: t('x13.lg.muni') },
    ];
  }

  // ---------- 5.23: city centre — a 500 m grid over the whole frame, Granada at full strength and its surroundings faded,
  // the centre as black-and-white aerial tiles (assets from tools/build_ex13_art.py, data/ex13/art/) ----------
  const CKEYS = ['grid', 'tiles', 'crosses', 'peaks', 'names'];
  let CA = null, CAp = null;
  function loadCentre() {
    if (CAp) return CAp; const v = '?v=' + (root.GA_BUILD || ''); const dir = 'data/ex13/art/';
    const im = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(dir + u)); i.src = dir + u + v; });
    CAp = Promise.all([fetch(dir + 'centre_art.json' + v).then(r => { if (!r.ok) throw new Error('centre_art.json ' + r.status); return r.json(); }), im('centre_base.jpg'), im('centre_aerial.jpg'), im('centre_city.png'), im('centre_edge.png')])
      .then(([m, b, a, c, e]) => { const n = m.frame_px; const t = document.createElement('canvas'); t.width = t.height = n; const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, n, n).data; const bits = new Uint8Array(n * n); for (let q = 0; q < n * n; q++) bits[q] = d[q * 4 + 3] > 127 ? 1 : 0;
        const ts = new Set(m.tiles.map(([i, j]) => i + ',' + j)); const corners = [...new Set(m.tiles.flatMap(([i, j]) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([p, q]) => (i + p) + ',' + (j + q))))].map(z => z.split(',').map(Number));
        return (CA = { m, b, a, c, e, bits, ts, corners }); })
      .catch(err => { CAp = null; throw err; });
    return CAp;
  }
  const ready = (k) => k === 'centre' ? loadCentre() : Promise.resolve();
  const keys = (k) => k === 'centre' ? CKEYS : KEYS;
  const fadeIn = (t, k, n) => t >= 1 ? 1 : Math.max(0, Math.min(1, (t - k / n * 0.7) / 0.3)); // squares fade in one after another
  // o.focus = one layer full (others faint); o.upTo = layers shown, o.t = progress of the last one (0..1)
  function drawCentre(ctx, D, x, y, S, o) {
    o = o || {}; if (!CA) return false; const m = CA.m, N = m.grid_n, C = S / N, s = S / 1000, F = D.frame, mpp = (F.x1 - F.x0) / S, fpx = m.frame_px;
    const X = (u) => (u - F.x0) / mpp, Y = (v) => (F.y1 - v) / mpp; const inCity = (px, py) => { const i = Math.floor(px / S * fpx), j = Math.floor(py / S * fpx); return i >= 0 && j >= 0 && i < fpx && j < fpx && CA.bits[j * fpx + i] === 1; };
    const al = (i) => o.focus != null ? (i === o.focus ? 1 : 0.1) : o.upTo != null ? (i < o.upTo ? 1 : 0) : 1;
    const tt = (i) => o.upTo != null && o.t != null && i === o.upTo - 1 ? o.t : 1;
    const font = (sz) => `700 ${Math.round(sz * s)}px ${root.GA.pages.font()}`; const INK = GA.palette.ink;
    const grid = (c, t, strong) => { const hw = S / 2 * t; c.strokeStyle = strong ? GA.palette.ink3 : GA.palette.line; c.lineWidth = (strong ? 1.1 : 0.7) * s; c.beginPath();
      for (let k = 0; k <= N; k++) { const p = k * C; c.moveTo(p, S / 2 - hw); c.lineTo(p, S / 2 + hw); c.moveTo(S / 2 - hw, p); c.lineTo(S / 2 + hw, p); } c.stroke();
      c.fillStyle = strong ? INK : GA.palette.grey2; const r = (strong ? 2.2 : 1.4) * s; for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const px = i * C, py = j * C; if (Math.abs(px - S / 2) <= hw && Math.abs(py - S / 2) <= hw) { c.beginPath(); c.arc(px, py, r, 0, 7); c.fill(); } } };
    const tiles = (c, t) => { const a0 = c.globalAlpha, u = fpx / N; m.tiles.forEach(([i, j], k) => { const a = fadeIn(t, k, m.tiles.length); if (!a) return; c.globalAlpha = a0 * a; c.drawImage(CA.a, i * u, j * u, u, u, i * C, j * C, C, C); }); c.globalAlpha = a0; };
    const cross = (c, px, py, r, w, col) => { c.strokeStyle = col; c.lineWidth = w * s; c.beginPath(); c.moveTo(px - r * s, py); c.lineTo(px + r * s, py); c.moveTo(px, py - r * s); c.lineTo(px, py + r * s); c.stroke(); };
    const crosses = (c, t) => { const n = Math.ceil(CA.corners.length * t); CA.corners.slice(0, n).forEach(([i, j]) => cross(c, i * C, j * C, 9, 3, INK)); };
    const label = (c, txt, px, py, col, halo, sz) => { c.font = font(sz); c.direction = 'ltr'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.lineWidth = 3.5 * s; c.strokeStyle = halo; c.strokeText(txt, px, py); c.fillStyle = col; c.fillText(txt, px, py); };
    const peaks = (c, t) => { const P = D.centre.peaks.filter(p => inCity(X(p.x), Y(p.y))); P.slice(0, Math.ceil(P.length * t)).forEach(p => { const px = X(p.x), py = Y(p.y); const onT = CA.ts.has(Math.floor(px / C) + ',' + Math.floor(py / C)); const col = onT ? '#FFFFFF' : INK;
      cross(c, px, py, 8, 3, col); label(c, 'C' + p.rank, px + 11 * s, py - 6 * s, col, onT ? INK : '#FFFFFF', 19); }); };
    const names = (c, t) => { if (t <= 0) return; D.centre.whc.filter(w => w.name !== 'Generalife').forEach(w => { const gm = w.geometry; let q; if (gm.type === 'Point') q = gm.coordinates; else { const r = gm.type === 'Polygon' ? gm.coordinates[0] : gm.coordinates[0][0]; q = [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; }
      const px = X(q[0]), py = Y(q[1]); cross(c, px, py, 7, 2, INK); label(c, String(w.name).toUpperCase(), px + 10 * s, py + 5 * s, INK, '#FFFFFF', 17); }); };
    const vis = (i) => al(i) > 0.005 && tt(i) > 0;
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 0.34; ctx.drawImage(CA.b, 0, 0, S, S); ctx.globalAlpha = 1; // the surroundings, faded
    if (vis(0)) { ctx.save(); ctx.globalAlpha = al(0); grid(ctx, tt(0), false); ctx.restore(); }
    const IN = document.createElement('canvas'); IN.width = IN.height = Math.ceil(S); const ix = IN.getContext('2d'); ix.drawImage(CA.b, 0, 0, S, S); // Granada, full strength
    if (vis(1)) { ix.save(); ix.globalAlpha = al(1); tiles(ix, tt(1)); ix.restore(); }
    if (vis(0)) { ix.save(); ix.globalAlpha = al(0); grid(ix, tt(0), true); ix.restore(); }
    ix.globalCompositeOperation = 'destination-in'; ix.drawImage(CA.c, 0, 0, S, S); ctx.drawImage(IN, 0, 0); ctx.drawImage(CA.e, 0, 0, S, S);
    [[2, crosses], [3, peaks], [4, names]].forEach(([i, f]) => { if (!vis(i)) return; ctx.save(); ctx.globalAlpha = al(i); f(ctx, tt(i)); ctx.restore(); });
    ctx.restore(); return true;
  }
  function centreLegend(t) {
    const P = GA.palette; const patch = CA ? { img: CA.a, sx: CA.m.tiles[0][0] * CA.m.frame_px / CA.m.grid_n, sy: CA.m.tiles[0][1] * CA.m.frame_px / CA.m.grid_n, s: CA.m.frame_px / CA.m.grid_n } : null;
    return [
      { line: P.ink3, w: 1.1, label: t('x21.lg.grid'), layer: 0 },
      { patch, sw: patch ? null : P.ink2, label: t('x21.lg.tiles', { n: '‎' + (CA ? CA.m.tiles.length : '—') + '‎' }), layer: 1 },
      { cross: P.ink, label: t('x21.lg.crosses'), layer: 2 },
      { cross: P.ink, text: 'C1', label: t('x21.lg.peaks'), layer: 3 },
      { cross: P.ink, text: 'A', label: t('x21.lg.names'), layer: 4 },
      { sw: '#C7C1B5', label: t('x21.lg.city', { a: '‎' + (CA ? CA.m.city_km2 : '—') + ' km²‎' }) },
      { sw: '#C7C1B5', alpha: 0.34, label: t('x21.lg.around') },
    ];
  }

  // ---------- 5.24: density — one needle per inhabited 100 m cell (JRC GHS-POP 2020), length ∝ residents/km², coloured by
  // class, seen from the south-west across the city's NW–SE axis; built-up Granada full, outside faded; a top view of the
  // same cells drawn beside the map. Uses the city shape of the centre assets. ----------
  const DKEYS = ['grid', 'streets', 'edge', 'c1', 'c2', 'c3', 'c4', 'c5', 'labels'];
  const OB = { a: 0.72, b: 0.42, c: 0.5, ox: 20, oy: 330 }; // per 1000 px of map: x' = ox + a·x + b·y, y' = oy + c·y (x, y in frame px)
  const HMAX = 250, VMAX = 40000; const hOf = (v) => Math.min(v, VMAX) / VMAX * HMAX;
  let DN = null;
  function needles(D) {
    if (DN && DN.src === D && DN.ca === CA) return DN; const F = D.frame, mpp = (F.x1 - F.x0) / 1000; const cx = D.density.corners.x, cy = D.density.corners.y; const br = GA.palette.ex13art.needleBreaks; const out = [];
    const inCity = (x, y) => { if (!CA) return true; const n = CA.m.frame_px, i = Math.floor(x / 1000 * n), j = Math.floor(y / 1000 * n); return i >= 0 && j >= 0 && i < n && j < n && CA.bits[j * n + i] === 1; };
    D.density.pop.forEach((row, r) => row.forEach((p, q) => { if (!p || p <= 0) return; const u = (cx[r][q] + cx[r][q + 1] + cx[r + 1][q] + cx[r + 1][q + 1]) / 4, w = (cy[r][q] + cy[r][q + 1] + cy[r + 1][q] + cy[r + 1][q + 1]) / 4; const x = (u - F.x0) / mpp, y = (F.y1 - w) / mpp;
      if (x < 0 || y < 0 || x > 1000 || y > 1000) return; const v = p * 100; const qd = [[r, q], [r, q + 1], [r + 1, q + 1], [r + 1, q]].map(([a, b]) => [(cx[a][b] - F.x0) / mpp, (F.y1 - cy[a][b]) / mpp]); out.push({ x, y, v, qd, k: br.filter(b => v >= b).length, city: inCity(x, y) }); }));
    out.sort((a, b) => a.y - b.y || a.x - b.x); const top = out.reduce((m, n) => n.v > m.v ? n : m, out[0]); const count = [0, 0, 0, 0, 0]; out.forEach(n => count[n.k]++);
    return (DN = { src: D, ca: CA, list: out, top, count });
  }
  const layerAlpha = (o, i) => o.focus != null ? (i === o.focus ? 1 : 0.1) : o.upTo != null ? (i < o.upTo ? 1 : 0) : 1;
  const layerT = (o, i) => o.upTo != null && o.t != null && i === o.upTo - 1 ? o.t : 1;
  function drawDensity(ctx, D, x, y, S, o) {
    o = o || {}; const Nd = needles(D), F = D.frame, mpp = (F.x1 - F.x0) / 1000, s = S / 1000, P = GA.palette, cols = P.ex13art.needles; const font = (sz, w) => `${w || 700} ${Math.round(sz * s)}px ${root.GA.pages.font()}`;
    const PR = (gx, gy) => [(OB.ox + OB.a * gx + OB.b * gy) * s, (OB.oy + OB.c * gy) * s]; const vis = (i) => layerAlpha(o, i) > 0.005 && layerT(o, i) > 0;
    const ground = (fn) => { ctx.save(); ctx.transform(OB.a * s, 0, OB.b * s, OB.c * s, OB.ox * s, OB.oy * s); fn(); ctx.restore(); };
    const FX = (u) => (u - F.x0) / mpp, FY = (v) => (F.y1 - v) / mpp;
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, S, S);
    const L = [
      (t) => { ctx.strokeStyle = P.line; ctx.lineWidth = 0.8 * s; ctx.beginPath(); for (let k = -40; k <= 60; k++) { const p = k * 50; let [a1, b1] = PR(p, -2000), [a2, b2] = PR(p, 3000); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); [a1, b1] = PR(-3000, p); [a2, b2] = PR(4000, p); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); } ctx.globalAlpha *= t; ctx.stroke(); },
      (t) => ground(() => { ctx.globalAlpha *= t; ctx.strokeStyle = P.ink; ctx.lineWidth = 0.55; D.streets.forEach(ls => { ctx.beginPath(); ls.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(FX(p[0]), FY(p[1])) : ctx.moveTo(FX(p[0]), FY(p[1])))); ctx.stroke(); });
        ctx.beginPath(); D.muni.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(FX(p[0]), FY(p[1])) : ctx.moveTo(FX(p[0]), FY(p[1])))); ctx.strokeStyle = P.grey; ctx.lineWidth = 0.7; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); }),
      (t) => { if (CA) ground(() => { ctx.globalAlpha *= t; const e = document.createElement('canvas'); e.width = e.height = 1000; const ex = e.getContext('2d'); ex.drawImage(CA.e, 0, 0, 1000, 1000); ex.globalCompositeOperation = 'source-in'; ex.fillStyle = P.ink; ex.fillRect(0, 0, 1000, 1000); ctx.drawImage(e, 0, 0); }); },
    ];
    for (let k = 0; k < 5; k++) L.push((t) => { const a0 = ctx.globalAlpha; ctx.lineWidth = 1.1 * s; ctx.strokeStyle = cols[k];
      Nd.list.forEach(n => { if (n.k !== k) return; const g = t >= 1 ? 1 : Math.max(0, Math.min(1, (t - (1 - n.y / 1000) * 0.5) / 0.5)); if (!g) return; const [sx, sy] = PR(n.x, n.y); ctx.globalAlpha = a0 * (n.city ? 1 : 0.3); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - hOf(n.v) * s * g); ctx.stroke(); }); ctx.globalAlpha = a0; });
    L.push((t) => { if (t <= 0) return; ctx.globalAlpha *= t; const [sx, sy] = PR(Nd.top.x, Nd.top.y); const ty = sy - hOf(Nd.top.v) * s; ctx.strokeStyle = P.ink; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(sx, ty); ctx.lineTo(sx + 60 * s, ty - 30 * s); ctx.lineTo(sx + 170 * s, ty - 30 * s); ctx.stroke();
      ctx.font = font(17); ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.fillStyle = P.ink; ctx.fillText(Math.round(Nd.top.v).toLocaleString('en-US') + ' /km²', sx + 64 * s, ty - 36 * s);
      D.centre.whc.filter(w => w.name !== 'Generalife').forEach(w => { const gm = w.geometry; let q; if (gm.type === 'Point') q = gm.coordinates; else { const r = gm.type === 'Polygon' ? gm.coordinates[0] : gm.coordinates[0][0]; q = [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]; }
        const [px, py] = PR(FX(q[0]), FY(q[1])); ctx.font = font(14); ctx.lineJoin = 'round'; ctx.lineWidth = 3 * s; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(String(w.name).toUpperCase(), px + 6 * s, py + 16 * s); ctx.fillStyle = P.ink; ctx.fillText(String(w.name).toUpperCase(), px + 6 * s, py + 16 * s); }); });
    const f = o.focus; L.forEach((fn, i) => { if (i === f || !vis(i)) return; ctx.save(); ctx.globalAlpha = layerAlpha(o, i); fn(layerT(o, i)); ctx.restore(); }); if (f != null) { ctx.save(); L[f](1); ctx.restore(); }
    // reference needle, east–west scale (true in this view), north along the view
    ctx.save(); ctx.direction = 'ltr'; const rx = 60 * s, ry = 940 * s, h = hOf(10000) * s; ctx.strokeStyle = P.red; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - h); ctx.stroke();
    ctx.font = font(14, 500); ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.fillText('= 10,000 /km²', rx + 8 * s, ry - h + 10 * s);
    const km = 100 * OB.a * s, bx = 640 * s, by = 950 * s; ctx.fillRect(bx, by, km, 5 * s); ctx.strokeStyle = P.ink; ctx.lineWidth = 1 * s; ctx.strokeRect(bx, by, 2 * km, 5 * s); ctx.textAlign = 'center'; ctx.fillText('0', bx, by - 6 * s); ctx.fillText('1', bx + km, by - 6 * s); ctx.fillText('2 km', bx + 2 * km, by - 6 * s); ctx.textAlign = 'left'; ctx.fillText('E–W', bx + 2 * km + 12 * s, by + 6 * s);
    ctx.translate(930 * s, 55 * s); ctx.rotate(Math.atan2(-OB.b, OB.c)); ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(0, -15 * s); ctx.lineTo(9 * s, 15 * s); ctx.lineTo(0, 9 * s); ctx.lineTo(-9 * s, 15 * s); ctx.closePath(); ctx.fill(); ctx.rotate(-Math.atan2(-OB.b, OB.c)); ctx.font = font(15); ctx.textAlign = 'center'; ctx.fillText('N', 0, 36 * s); ctx.restore();
    ctx.restore(); return true;
  }
  // the same cells from above (true plan, same frame), following the same layer state
  function drawDensityTop(ctx, D, x, y, S, o) {
    o = o || {}; const Nd = needles(D), P = GA.palette, cols = P.ex13art.needles; const s = S / 1000;
    const al = [0, 1, 2, 3, 4].map(k => layerAlpha(o, 3 + k) * (layerT(o, 3 + k) > 0 ? 1 : 0));
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 5; k++) { if (!al[k]) continue; ctx.globalAlpha = al[k]; ctx.fillStyle = cols[k]; ctx.strokeStyle = cols[k]; ctx.lineWidth = 0.6 * s; // each GHS-POP cell as its own quadrilateral (the grid is not aligned with UTM)
      ctx.beginPath(); Nd.list.forEach(n => { if (n.k !== k) return; n.qd.forEach((p, i) => i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s)); ctx.closePath(); }); ctx.fill(); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(41,16,12,.18)'; ctx.lineWidth = Math.max(0.5, s); ctx.beginPath(); for (let q = 1; q < 20; q++) { ctx.moveTo(q * 50 * s, 0); ctx.lineTo(q * 50 * s, S); ctx.moveTo(0, q * 50 * s); ctx.lineTo(S, q * 50 * s); } ctx.stroke();
    if (CA) ctx.drawImage(CA.e, 0, 0, S, S); ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, 1.6 * s); ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
    root.GA.pages.northArrow(ctx, S - 30 * s, 16 * s, 1.6 * s); ctx.restore();
  }
  function densityLegend(t, D) {
    const P = GA.palette, cols = P.ex13art.needles, Nd = needles(D); const R = ['x22.c1', 'x22.c2', 'x22.c3', 'x22.c4', 'x22.c5'];
    return [{ line: P.line, w: 1.2, label: t('x22.lg.grid'), layer: 0 }, { line: P.ink, w: 1, label: t('x22.lg.streets'), layer: 1 }, { edge: P.ink, label: t('x22.lg.edge', { a: '‎' + (CA ? CA.m.city_km2 : '—') + ' km²‎' }), layer: 2 }]
      .concat(cols.map((col, k) => ({ needles: col, label: t(R[k], { n: '‎' + Nd.count[k].toLocaleString('en-US') + '‎' }), layer: 3 + k })))
      .concat([{ text: 'A', cross: P.ink, label: t('x22.lg.labels', { v: '‎' + Math.round(Nd.top.v).toLocaleString('en-US') + '‎' }), layer: 8 }]);
  }

  // ---------- 5.26 (approved preview): CLIMATE as isotherms and HUMAN DIMENSION as 300 m reach rings ----------
  // Same frame, same Landsat / OSM data as the Exercise 1.3 maps; colours only from the palette. Layers follow the player.
  const KLKEYS_ISO = ['base', 'cool', 'warm', 'hot', 'hottest', 'veg', 'marks']; // 5.26 isotherm version, replaced in 5.33 by the stacked layers
  const HKEYS = ['base', 'buildings', 'areas', 'rings', 'places', 'far'];
  let ISO = null;
  function isotherms(D) { // Gaussian-smoothed LST (σ = 1.4 cells), marching squares at every whole degree
    if (ISO && ISO.src === D) return ISO; const g = D.climate.grid, L = D.climate.lst, nx = g.nx || g.n, ny = g.ny || g.n;
    const vals = []; L.forEach(r => r.forEach(v => { if (v != null) vals.push(v); })); vals.sort((a, b) => a - b); const med = vals[Math.floor(vals.length / 2)];
    let A = new Float64Array(nx * ny); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = L[j][i]; A[j * nx + i] = v == null ? med : v; }
    const sg = 1.4, R = 4, K = []; let ks = 0; for (let d = -R; d <= R; d++) { const w = Math.exp(-d * d / (2 * sg * sg)); K.push(w); ks += w; } for (let d = 0; d < K.length; d++) K[d] /= ks;
    const blur = (src, horiz) => { const out = new Float64Array(nx * ny); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let a = 0; for (let d = -R; d <= R; d++) { const ii = horiz ? Math.min(nx - 1, Math.max(0, i + d)) : i, jj = horiz ? j : Math.min(ny - 1, Math.max(0, j + d)); a += src[jj * nx + ii] * K[d + R]; } out[j * nx + i] = a; } return out; };
    A = blur(blur(A, true), false);
    const lines = {}; for (let lv = 38; lv <= 56; lv++) { const seg = []; const at = (i, j) => A[j * nx + i];
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1); const k = (a >= lv) | ((b >= lv) << 1) | ((c >= lv) << 2) | ((d >= lv) << 3); if (k === 0 || k === 15) continue;
        const e = { t: [i + (lv - a) / (b - a), j], r: [i + 1, j + (lv - b) / (c - b)], b: [i + (lv - d) / (c - d), j + 1], l: [i, j + (lv - a) / (d - a)] };
        const P = { 1: [['l', 't']], 2: [['t', 'r']], 3: [['l', 'r']], 4: [['r', 'b']], 5: [['l', 't'], ['r', 'b']], 6: [['t', 'b']], 7: [['l', 'b']], 8: [['b', 'l']], 9: [['t', 'b']], 10: [['t', 'r'], ['b', 'l']], 11: [['r', 'b']], 12: [['r', 'l']], 13: [['t', 'r']], 14: [['l', 't']] }[k];
        P.forEach(([u, v]) => seg.push([e[u], e[v]])); }
      if (seg.length) lines[lv] = seg; }
    let hi = 0, lo = 0; for (let q = 1; q < nx * ny; q++) { if (A[q] > A[hi]) hi = q; if (A[q] < A[lo]) lo = q; }
    const cellV = (q) => { const v = L[Math.floor(q / nx)][q % nx]; return v == null ? null : v; };
    return (ISO = { src: D, A, nx, ny, lines, hot: { i: hi % nx, j: Math.floor(hi / nx), v: cellV(hi) }, cool: { i: lo % nx, j: Math.floor(lo / nx), v: cellV(lo) } });
  }
  const isoClass = (lv) => lv < 43 ? 1 : lv < 47 ? 2 : lv < 49 ? 3 : 4; // layers cool / warm / hot / hottest
  function baseLayer(ctx, D, s, X, Y, t) { const P = GA.palette, F = D.frame; ctx.save(); ctx.globalAlpha *= t;
    ctx.strokeStyle = P.ex13.street; ctx.lineWidth = Math.max(0.5, 0.6 * s); ctx.beginPath(); for (let v = F.x0; v <= F.x1; v += 500) { ctx.moveTo(X(v), Y(F.y0)); ctx.lineTo(X(v), Y(F.y1)); } for (let v = F.y0; v <= F.y1; v += 500) { ctx.moveTo(X(F.x0), Y(v)); ctx.lineTo(X(F.x1), Y(v)); } ctx.stroke();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.4 * s; ctx.lineCap = 'round'; D.streets.forEach(ls => { ctx.beginPath(); ls.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); });
    ctx.beginPath(); D.muni.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.strokeStyle = P.ex13art.muni; ctx.lineWidth = 1.1 * s; ctx.setLineDash([5 * s, 4 * s]); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  function runLayers(L, o) { const f = o.focus; L.forEach((fn, i) => { if (i === f) return; const a = layerAlpha(o, i), tt = layerT(o, i); if (a <= 0.005 || tt <= 0) return; ctx_save(fn, a, tt); }); if (f != null) ctx_save(L[f], 1, 1); }
  let _ctx = null; const ctx_save = (fn, a, tt) => { _ctx.save(); _ctx.globalAlpha = a; fn(tt); _ctx.restore(); };
  function drawClimateIso(ctx, D, x, y, S, o) {
    o = o || {}; const I = isotherms(D), P = GA.palette, E = P.ex13, F = D.frame, g = D.climate.grid, s = S / 1000, mpp = (F.x1 - F.x0) / 1000, cols = E.lst, br = D.climate.breaks;
    const X = (u) => (u - F.x0) / mpp * s, Y = (v) => (F.y1 - v) / mpp * s; const GX = (gi) => X(g.x0 + (gi + 0.5) * g.cell), GY = (gj) => Y(g.y1 - (gj + 0.5) * g.cell);
    const colOf = (lv) => cols[br.filter(b => lv >= b).length]; const font = (sz, w) => `${w || 600} ${Math.round(sz * s)}px ${root.GA.pages.font()}`;
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip(); ctx.fillStyle = P.ex13art.paper; ctx.fillRect(0, 0, S, S); _ctx = ctx;
    const iso = (cls) => (t) => { if (cls === 4) { // the hottest ground (≥ 49 °C) tinted under its lines
          const k = 4, cv = document.createElement('canvas'); cv.width = I.nx * k; cv.height = I.ny * k; const cx = cv.getContext('2d'); const im = cx.createImageData(cv.width, cv.height); const rgb = P.rgb(P.red);
          for (let jj = 0; jj < cv.height; jj++) for (let ii = 0; ii < cv.width; ii++) { const fx = Math.min(I.nx - 1.001, Math.max(0, (ii + 0.5) / k - 0.5)), fy = Math.min(I.ny - 1.001, Math.max(0, (jj + 0.5) / k - 0.5)); const i0 = Math.floor(fx), j0 = Math.floor(fy), ax = fx - i0, ay = fy - j0;
            const v = (1 - ax) * (1 - ay) * I.A[j0 * I.nx + i0] + ax * (1 - ay) * I.A[j0 * I.nx + i0 + 1] + (1 - ax) * ay * I.A[(j0 + 1) * I.nx + i0] + ax * ay * I.A[(j0 + 1) * I.nx + i0 + 1]; if (v < 49) continue; const q = (jj * cv.width + ii) * 4; im.data[q] = rgb[0]; im.data[q + 1] = rgb[1]; im.data[q + 2] = rgb[2]; im.data[q + 3] = 44; }
          cx.putImageData(im, 0, 0); ctx.globalAlpha *= t; ctx.drawImage(cv, X(g.x0), Y(g.y1), (I.nx * g.cell) / mpp * s, (I.ny * g.cell) / mpp * s); }
        Object.keys(I.lines).map(Number).filter(lv => isoClass(lv) === cls).forEach(lv => { ctx.strokeStyle = colOf(lv); ctx.lineWidth = (0.6 + Math.max(0, lv - 44) * 0.38) * s; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          const segs = I.lines[lv]; const n = t >= 1 ? segs.length : Math.floor(segs.length * t); ctx.beginPath(); for (let q = 0; q < n; q++) { const [a, b] = segs[q]; ctx.moveTo(GX(a[0]), GY(a[1])); ctx.lineTo(GX(b[0]), GY(b[1])); } ctx.stroke(); }); };
    const L = [(t) => baseLayer(ctx, D, s, X, Y, t), iso(1), iso(2), iso(3), iso(4),
      (t) => { ctx.globalAlpha *= t; ctx.fillStyle = P.base.olive; const V = D.climate.ndvi; for (let j = 0; j < I.ny; j++) for (let i = 0; i < I.nx; i++) { const v = V[j] && V[j][i]; if (v == null || v < 0.4) continue; ctx.beginPath(); ctx.arc(GX(i), GY(j), 1.5 * s, 0, Math.PI * 2); ctx.fill(); } },
      (t) => { ctx.globalAlpha *= t; ctx.direction = 'ltr'; [['hot', I.hot], ['cool', I.cool]].forEach(([k, p]) => { const px = GX(p.i), py = GY(p.j), r = 9 * s; ctx.strokeStyle = P.ink; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(px - r, py); ctx.lineTo(px + r, py); ctx.moveTo(px, py - r); ctx.lineTo(px, py + r); ctx.stroke();
          if (p.v == null) return; const tx = String(p.v.toFixed(1)) + ' °C'; ctx.font = font(16); const w = ctx.measureText(tx).width; const lx = Math.min(S - w - 14 * s, px + 12 * s), ly = Math.max(26 * s, py - 10 * s); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(lx - 4 * s, ly - 17 * s, w + 8 * s, 22 * s); ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.fillText(tx, lx, ly); }); }];
    runLayers(L, o); ctx.restore(); return true;
  }
  function climateLegendIso(t, D) {
    const P = GA.palette, cols = P.ex13.lst, I = isotherms(D);
    return [{ line: P.ex13.street, w: 1, label: t('x24.lg.base'), layer: 0 },
      { line: cols[0], w: 0.8, label: t('x24.lg.cool'), layer: 1 }, { line: cols[3], w: 1.4, label: t('x24.lg.warm'), layer: 2 }, { line: cols[4], w: 2.2, label: t('x24.lg.hot'), layer: 3 },
      { line: cols[6], w: 3, sw: null, label: t('x24.lg.hottest'), layer: 4 }, { dot: P.base.olive, label: t('x24.lg.veg'), layer: 5 },
      { cross: P.ink, label: t('x24.lg.marks', { h: '‎' + (I.hot.v == null ? '—' : I.hot.v.toFixed(1)) + ' °C‎', c: '‎' + (I.cool.v == null ? '—' : I.cool.v.toFixed(1)) + ' °C‎' }), layer: 6 },
      { line: P.ex13art.muni, dash: true, label: t('x13.lg.muni') }];
  }
  function humanData(D) { const H = D.human, cx = D.density.corners.x, cy = D.density.corners.y, pop = D.density.pop; const cent = [];
    ['square', 'park'].forEach(k => (H.areas[k] || []).forEach(a => { const r = a.p[0]; if (!r || !r.length) return; cent.push([r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length, k]); }));
    ['market', 'square_pt'].forEach(k => (H.points[k] || []).forEach(p => cent.push([p[0], p[1], k])));
    const far = H.far.map(([r, q]) => ({ x: (cx[r][q] + cx[r + 1][q + 1]) / 2, y: (cy[r][q] + cy[r + 1][q + 1]) / 2, p: pop[r][q] || 0 }));
    return { cent, far }; }
  function drawHuman(ctx, D, x, y, S, o) {
    o = o || {}; const P = GA.palette, B = P.base, E = P.ex13, F = D.frame, s = S / 1000, mpp = (F.x1 - F.x0) / 1000, H = D.human, hd = humanData(D);
    const X = (u) => (u - F.x0) / mpp * s, Y = (v) => (F.y1 - v) / mpp * s;
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip(); ctx.fillStyle = P.ex13art.paper; ctx.fillRect(0, 0, S, S); _ctx = ctx;
    const L = [(t) => baseLayer(ctx, D, s, X, Y, t),
      (t) => { const g = D.fgm; if (!D.fgImg) return; const sx = (F.x0 - g.ox) / g.px_m, sy = (g.oy - F.y1) / g.px_m, sw = (F.x1 - F.x0) / g.px_m; const tmp = document.createElement('canvas'); tmp.width = tmp.height = Math.round(S); const tc = tmp.getContext('2d');
        tc.drawImage(D.fgImg, sx, sy, sw, sw, 0, 0, tmp.width, tmp.height); tc.globalCompositeOperation = 'lighten'; tc.fillStyle = P.base.cream; tc.fillRect(0, 0, tmp.width, tmp.height); // buildings faint (warm grey), ground white
        ctx.globalAlpha *= t * 0.75; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(tmp, 0, 0, S, S); },
      (t) => { ctx.globalAlpha *= t; [['park', B.olive, 0.55], ['square', B.red, 0.85]].forEach(([k, col, a]) => (H.areas[k] || []).forEach(ar => { ctx.beginPath(); ar.p.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.globalAlpha = t * a; ctx.fillStyle = col; ctx.fill('evenodd'); })); },
      (t) => { const n = t >= 1 ? hd.cent.length : Math.floor(hd.cent.length * t); for (let q = 0; q < n; q++) { const [cx, cy, k] = hd.cent[q]; ctx.beginPath(); ctx.arc(X(cx), Y(cy), 300 / mpp * s, 0, Math.PI * 2); ctx.strokeStyle = k === 'market' ? B.oxblood : B.blueGrey; ctx.lineWidth = (k === 'market' ? 1.2 : 0.7) * s; ctx.globalAlpha = 0.9; ctx.stroke(); } },
      (t) => { ctx.globalAlpha *= t; const pt = (k, fn) => (H.points[k] || []).forEach(p => fn(X(p[0]), Y(p[1])));
        pt('cafe', (px, py) => { ctx.fillStyle = B.brown; ctx.beginPath(); ctx.arc(px, py, 1.6 * s, 0, Math.PI * 2); ctx.fill(); });
        pt('playground', (px, py) => { ctx.fillStyle = B.khaki; ctx.beginPath(); ctx.moveTo(px, py - 4 * s); ctx.lineTo(px + 3.6 * s, py + 3 * s); ctx.lineTo(px - 3.6 * s, py + 3 * s); ctx.closePath(); ctx.fill(); });
        pt('civic', (px, py) => { ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = B.blueGrey; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.arc(px, py, 3.6 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
        pt('market', (px, py) => { ctx.fillStyle = B.oxblood; ctx.fillRect(px - 5 * s, py - 5 * s, 10 * s, 10 * s); }); },
      (t) => { ctx.globalAlpha *= t; ctx.fillStyle = B.red; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.6 * s; hd.far.forEach(f => { const r = Math.max(2.2, Math.sqrt(f.p) * 0.55) * s; ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }); }];
    runLayers(L, o); ctx.restore(); return true;
  }
  function humanLegend(t, D) {
    const P = GA.palette, B = P.base, hd = humanData(D);
    return [{ line: P.ex13.street, w: 1, label: t('x24.lg.base'), layer: 0 }, { sw: P.base.cream, label: t('x24.lg.buildings'), layer: 1 },
      { sw: B.red, alpha: 0.85, label: t('x13.lg.square'), layer: 2 }, { sw: B.olive, alpha: 0.55, label: t('x13.lg.park'), layer: 2 },
      { ring: B.blueGrey, label: t('x24.lg.rings', { n: '‎' + hd.cent.length.toLocaleString('en-US') + '‎' }), layer: 3 },
      { mk: 'market', label: t('x13.lg.market'), layer: 4 }, { mk: 'cafe', label: t('x13.lg.cafe'), layer: 4 }, { mk: 'play', label: t('x13.lg.play'), layer: 4 }, { mk: 'civic', label: t('x13.lg.civic'), layer: 4 },
      { dot: B.red, label: t('x24.lg.far', { n: '‎' + hd.far.length.toLocaleString('en-US') + '‎' }), layer: 5 }];
  }

  // ---------- HUMAN DIMENSION, second artistic style: the axonometric drawing (other session, merged in 5.30 — HANDOFF §32) ----------
  // ---------- 5.26: the human dimension — the city as used, each layer a 3D object over a line drawing of the frame, seen from
  // the south-west (assets from tools/build_ex13_human.py). Heights are scales for the values, stated in the legend. ----------
  const HAXKEYS = ['residents', 'commerce', 'streets', 'buses', 'meeting', 'visitors'];
  let HA = null, HAp = null;
  function loadHuman() { if (HAp) return HAp; const v = '?v=' + (root.GA_BUILD || ''), dir = 'data/ex13/art/';
    HAp = Promise.all([fetch(dir + 'human_art.json' + v).then(r => { if (!r.ok) throw new Error('human_art.json ' + r.status); return r.json(); }), new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('human_ground.png')); i.src = dir + 'human_ground.png' + v; })])
      .then(([d, g]) => (HA = Object.assign(d, { ground: g }))).catch(e => { HAp = null; throw e; }); return HAp; }
  function drawHumanAxo(ctx, D, x, y, S, o) {
    o = o || {}; if (!HA) return false; const DT = HA, P = GA.palette, H = P.ex13art.human, INK = P.ink, MONO = root.GA.pages.font();
    const K = 0.56, OX = 500, OY = 960; const PR = (px, py, z) => { const a = px, b = 1000 - py; return [OX + 0.866 * K * (a - b), OY - 0.5 * K * (a + b) - (z || 0)]; }; const depth = (px, py) => px + (1000 - py);
    const fmt = (n) => Number(n).toLocaleString('en-US'); const ctr = (pts) => pts.reduce((q, p) => [q[0] + p[0] / pts.length, q[1] + p[1] / pts.length], [0, 0]);
    const shade = (hex, f) => { const c = P.rgb(hex).map(v => Math.round(Math.min(255, v * f))); return `rgb(${c})`; };
    ctx.save(); ctx.translate(x, y); ctx.scale(S / 1000, S / 1000); ctx.beginPath(); ctx.rect(0, 0, 1000, 1000); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1000, 1000);
    const prism = (ring, z0, z1, col) => { const c = ctr(ring); const faces = [];
      for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; const out = [mx - c[0], my - c[1]]; if (out[1] - out[0] <= 0) continue; faces.push({ p, q, d: depth(mx, my), f: out[1] > -out[0] ? 0.72 : 0.88 }); }
      faces.sort((u, v) => v.d - u.d).forEach(fc => { ctx.fillStyle = shade(col, fc.f); ctx.beginPath(); [PR(fc.p[0], fc.p[1], z0), PR(fc.q[0], fc.q[1], z0), PR(fc.q[0], fc.q[1], z1), PR(fc.p[0], fc.p[1], z1)].forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = shade(col, 1.12); ctx.beginPath(); ring.forEach((p, i) => { const q = PR(p[0], p[1], z1); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill(); };
    const box = (cx, cy, h, z0, z1, col) => prism([[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]], z0, z1, col);
    const cylinder = (px, py, r, z1, col) => { const [sx, sy] = PR(px, py, 0); const rx = r * K * 1.2247, ry = r * K * 0.7071; const g = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0); g.addColorStop(0, shade(col, 0.7)); g.addColorStop(0.45, shade(col, 1.18)); g.addColorStop(1, shade(col, 0.62));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI); ctx.lineTo(sx - rx, sy - z1); ctx.ellipse(sx, sy - z1, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(sx, sy - z1, rx, ry, 0, 0, 7); ctx.fill(); };
    const ring = (px, py, r) => { const [sx, sy] = PR(px, py, 0); ctx.strokeStyle = 'rgba(41,16,12,.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(sx, sy, r * K * 1.2247, r * K * 0.7071, 0, 0, 7); ctx.stroke(); };
    const label = (sx, sy, lines, col, align) => { ctx.save(); ctx.direction = 'ltr'; ctx.textAlign = align || 'left'; ctx.lineJoin = 'round'; lines.forEach((t, i) => { ctx.font = (i ? '500 11px ' : '700 12px ') + MONO; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.strokeText(t, sx, sy + i * 14); ctx.fillStyle = i ? P.ink3 : col; ctx.fillText(t, sx, sy + i * 14); }); ctx.restore(); };
    const guide = (px, py, z) => { const [a, b] = PR(px, py, 0); ctx.strokeStyle = 'rgba(41,16,12,.35)'; ctx.lineWidth = 0.7; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, b - z); ctx.stroke(); ctx.setLineDash([]); };
    const TAGS = []; const tag = (anchor, lines, col) => TAGS.push({ a: anchor, lines, col, alpha: ctx.globalAlpha });
    const C1 = DT.peaks.find(p => p.rank === 1) || DT.peaks[0];
    const L = [
      (t) => { const LIFT = 230 * Math.min(1, t * 1.3); const hh = (v) => Math.min(v, 40000) / 40000 * 70 * t; const c = ctr(DT.residents.map(r => ctr(r.qd)));
        ctx.save(); ctx.globalAlpha *= 0.25; ctx.fillStyle = H.res[1]; DT.residents.forEach(r => { ctx.beginPath(); r.qd.forEach((p, i) => { const q = PR(p[0], p[1], 0); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.fill(); }); ctx.restore();
        [[c[0] - 60, c[1] - 120], [c[0] + 60, c[1] + 120], c].forEach(([px, py]) => guide(px, py, LIFT));
        DT.residents.slice().sort((u, v) => depth(...ctr(v.qd)) - depth(...ctr(u.qd))).forEach(r => prism(r.qd, LIFT, LIFT + hh(r.v), r.v >= 30000 ? H.res[2] : r.v >= 20000 ? H.res[1] : H.res[0]));
        if (t > 0.7) tag(PR(c[0] - 150, c[1] + 80, LIFT + 20), ['01 RESIDENTS', '>15,000 /km² · max ' + fmt(D.density.stats.peak)], H.res[2]); },
      (t) => { DT.peaks.slice().sort((u, v) => depth(v.x, v.y) - depth(u.x, u.y)).forEach(p => { ring(p.x, p.y, 30); cylinder(p.x, p.y, 5.5, p.v / C1.v * 470 * t, H.gold); });
        if (t > 0.6) DT.peaks.filter(p => p.rank <= 2).forEach(p => tag(PR(p.x, p.y, p.v / C1.v * 470), ['02 C' + p.rank + ' · ' + fmt(p.v) + ' shops/km²', p.n300 + ' shops ≤ 300 m'], H.goldLabel)); },
      (t) => { const top = DT.streets[0].per100; const segs = []; DT.streets.forEach(st => st.lines.forEach(l => { for (let i = 1; i < l.length; i++) segs.push({ a: l[i - 1], b: l[i], h: st.per100 / top * 120 * t, d: depth((l[i - 1][0] + l[i][0]) / 2, (l[i - 1][1] + l[i][1]) / 2) }); }));
        segs.sort((u, v) => v.d - u.d).forEach(g => { const q = [PR(g.a[0], g.a[1], 0), PR(g.b[0], g.b[1], 0), PR(g.b[0], g.b[1], g.h), PR(g.a[0], g.a[1], g.h)]; ctx.fillStyle = `rgba(${P.rgb(H.street)},.82)`; ctx.beginPath(); q.forEach((z, i) => i ? ctx.lineTo(z[0], z[1]) : ctx.moveTo(z[0], z[1])); ctx.closePath(); ctx.fill(); ctx.strokeStyle = H.streetEdge; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(q[3][0], q[3][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.stroke(); });
        if (t > 0.6) DT.streets.slice(0, 3).forEach((st, i) => { const all = st.lines.flat(); const p = all[Math.floor(all.length / 2)]; tag(PR(p[0], p[1], st.per100 / top * 120), ['03.' + (i + 1) + ' ' + st.nm.replace(/^Calle /, 'C/ '), st.n + ' shops · ' + st.len + ' m'], H.street); }); },
      (t) => { const mx = DT.stops[0].t; DT.stops.slice().sort((u, v) => depth(v.x, v.y) - depth(u.x, u.y)).forEach(st => { const h = st.t / mx * 330 * t; box(st.x, st.y, 1.8, 0, h, H.stop); const tp = PR(st.x, st.y, h); ctx.fillStyle = P.red; ctx.beginPath(); ctx.arc(tp[0], tp[1], 2.2, 0, 7); ctx.fill(); });
        if (t > 0.6) { const st = DT.stops[0]; tag(PR(st.x, st.y, 330), ['04 ' + String(st.nm).slice(0, 20), st.t + ' bus trips/day'], INK); } },
      (t) => { DT.parks.map(r => ({ r: r[0], c: H.park, h: 2.5 })).concat(DT.squares.map(r => ({ r: r[0], c: H.square, h: 4.5 }))).filter(q => q.r.length >= 3).map(q => Object.assign(q, { d: depth(...ctr(q.r)) })).sort((u, v) => v.d - u.d).forEach(q => prism(q.r, 0, q.h * t, q.c));
        DT.markets.forEach(m => box(m[0], m[1], 4, 0, 26 * t, H.market)); if (t > 0.6 && DT.markets[0]) tag(PR(DT.markets[0][0], DT.markets[0][1], 26), ['05 MEETING PLACES', DT.meta.reach + ' % of residents ≤ 300 m'], H.square); },
      (t) => { const LIFT = 450 * Math.min(1, t * 1.3); const c = ctr(DT.hotels); guide(c[0], c[1], LIFT); DT.hotels.slice().sort((u, v) => depth(v[0], v[1]) - depth(u[0], u[1])).forEach(h => box(h[0], h[1], 2.6, LIFT, LIFT + 9 * t, H.hotel));
        if (t > 0.7) tag(PR(c[0], c[1], LIFT + 9), ['06 VISITORS', DT.hotels.length + ' hotels & hostels'], H.hotel); },
    ];
    ctx.save(); ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([0.866 * K, -0.5 * K, 0.866 * K, 0.5 * K, OX - 866 * K, OY - 500 * K]))); ctx.globalAlpha = 0.85; ctx.drawImage(DT.ground, 0, 0, 1000, 1000); ctx.restore();
    const f = o.focus; L.forEach((fn, i) => { if (i === f) return; const a = layerAlpha(o, i), t = layerT(o, i); if (a <= 0.005 || t <= 0) return; ctx.save(); ctx.globalAlpha = a; fn(t); ctx.restore(); }); if (f != null) { ctx.save(); L[f](1); ctx.restore(); }
    DT.whc.forEach((w, i) => { const q = PR(w.x, w.y, 0); label(q[0] + (i ? 8 : -8), q[1] + (i ? 22 : 16), [String(w.name).toUpperCase()], INK, i ? 'left' : 'right'); });
    // one label column on the right, ordered by the height of each anchor
    const X0 = 800; if (TAGS.length) { ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(X0 - 20, 110, 1000 - X0 + 20, 880); ctx.strokeStyle = 'rgba(41,16,12,.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X0 - 20, 110); ctx.lineTo(X0 - 20, 990); ctx.stroke(); }
    const items = TAGS.slice().sort((u, v) => u.a[1] - v.a[1]); let yy = 130; items.forEach(q => { q.ly = Math.max(yy, q.a[1]); yy = q.ly + 46; });
    for (let k = items.length - 1; k >= 0; k--) { const lim = k === items.length - 1 ? 975 : items[k + 1].ly - 46; items[k].ly = Math.min(items[k].ly, lim); }
    items.forEach(q => { ctx.save(); ctx.globalAlpha = q.alpha; ctx.strokeStyle = q.col; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(q.a[0], q.a[1]); ctx.lineTo(X0 - 16, q.ly - 4); ctx.lineTo(X0 - 4, q.ly - 4); ctx.stroke(); ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.a[0], q.a[1], 2.2, 0, 7); ctx.fill(); label(X0, q.ly, q.lines, q.col); ctx.restore(); });
    // title, north (up-left in this view), 2 km along the east edge
    ctx.direction = 'ltr'; ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.font = '700 26px ' + MONO; ctx.fillText('THE HUMAN DIMENSION', 30, 52); ctx.font = '500 13px ' + MONO; ctx.fillStyle = P.ink3; ctx.fillText('GRANADA · 10 × 10 km · seen from the south-west', 30, 74);
    ctx.save(); ctx.translate(950, 60); ctx.rotate(-Math.PI / 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(8, 12); ctx.lineTo(0, 7); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.fillStyle = INK; ctx.font = '700 14px ' + MONO; ctx.textAlign = 'center'; ctx.fillText('N', 928, 98);
    const a0 = PR(0, 1000, 0), a1 = PR(200, 1000, 0); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a0[0], a0[1] + 18); ctx.lineTo(a1[0], a1[1] + 18); ctx.stroke(); ctx.font = '500 12px ' + MONO; ctx.textAlign = 'left'; ctx.fillText('2 km', a1[0] + 6, a1[1] + 22);
    ctx.restore(); return true;
  }
  function drawHumanAxoTop(ctx, D, x, y, S, o) {
    o = o || {}; if (!HA) return; const DT = HA, P = GA.palette, H = P.ex13art.human; const k = S / 1000; const al = (i) => layerAlpha(o, i) * (layerT(o, i) > 0 ? 1 : 0);
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, S, S); ctx.globalAlpha = 0.9; ctx.drawImage(DT.ground, 0, 0, S, S); ctx.scale(k, k);
    const poly = (r) => { ctx.beginPath(); r.forEach((p, n) => n ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }; const sq = (px, py, h) => ctx.fillRect(px - h, py - h, 2 * h, 2 * h); const mx = DT.stops[0].t, C1 = DT.peaks.find(p => p.rank === 1) || DT.peaks[0];
    const lay = [
      () => DT.residents.forEach(r => { ctx.fillStyle = r.v >= 30000 ? H.res[2] : r.v >= 20000 ? H.res[1] : H.res[0]; poly(r.qd); ctx.fill(); }),
      () => DT.peaks.forEach(p => { ctx.strokeStyle = 'rgba(41,16,12,.5)'; ctx.lineWidth = 1; ctx.strokeRect(p.x - 30, p.y - 30, 60, 60); const h = 4 + p.v / C1.v * 9; ctx.fillStyle = H.gold; sq(p.x, p.y, h); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2; ctx.strokeRect(p.x - h, p.y - h, 2 * h, 2 * h); ctx.fillStyle = P.ink; ctx.font = `700 15px ${root.GA.pages.font()}`; ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.fillText('C' + p.rank, p.x + h + 3, p.y + 5); }),
      () => { ctx.strokeStyle = H.street; ctx.lineCap = 'round'; const top = DT.streets[0].per100; DT.streets.forEach(st => { ctx.lineWidth = 2 + st.per100 / top * 6; st.lines.forEach(l => { ctx.beginPath(); l.forEach((p, n) => n ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }); }); },
      () => DT.stops.forEach(st => { ctx.fillStyle = H.stop; sq(st.x, st.y, 2 + st.t / mx * 6); ctx.fillStyle = P.red; sq(st.x, st.y, 1.5); }),
      () => { ctx.fillStyle = H.park; DT.parks.forEach(r => { poly(r[0]); ctx.fill(); }); ctx.fillStyle = H.square; DT.squares.forEach(r => { poly(r[0]); ctx.fill(); }); ctx.fillStyle = H.market; DT.markets.forEach(m => sq(m[0], m[1], 6)); },
      () => { ctx.fillStyle = H.hotel; DT.hotels.forEach(h => sq(h[0], h[1], 3)); },
    ];
    lay.forEach((fn, i) => { const a = al(i); if (a <= 0.01 || i === o.focus) return; ctx.globalAlpha = a; fn(); }); if (o.focus != null) { ctx.globalAlpha = 1; lay[o.focus](); }
    ctx.globalAlpha = 1; ctx.setTransform(ctx.getTransform().scale(1 / k, 1 / k)); ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, 1.6 * k); ctx.strokeRect(0.5, 0.5, S - 1, S - 1); root.GA.pages.northArrow(ctx, S - 30 * k, 16 * k, 1.6 * k); ctx.restore();
  }
  function humanAxoLegend(t) {
    const P = GA.palette, H = P.ex13art.human, n = (v) => '‎' + Number(v).toLocaleString('en-US') + '‎';
    if (!HA) return [];
    return [
      { sw: H.res[1], label: t('x24.lg.res', { n: n(HA.residents.length) }), layer: 0 },
      { sw: H.gold, label: t('x24.lg.peaks', { v: n(HA.peaks.find(p => p.rank === 1).v) }), layer: 1 },
      { line: H.street, w: 3, label: t('x24.lg.streets', { s: HA.streets[0].nm, v: n(HA.streets[0].per100) }), layer: 2 },
      { sw: H.stop, label: t('x24.lg.buses', { n: n(HA.stops.length), v: n(HA.stops[0].t) }), layer: 3 },
      { sw: H.square, label: t('x24.lg.meeting', { s: n(HA.meta.squares), p: n(HA.meta.parks) }), layer: 4 },
      { sw: H.hotel, label: t('x24.lg.hotels', { n: n(HA.hotels.length) }), layer: 5 },
    ];
  }
  // ---------- 5.33: CLIMATE (approved 9 Nov 2026) — four layers of the frame (terrain, summer vegetation, buildings, summer surface heat), each draped
  // over the real terrain and stacked, seen from the south-west (assets from tools/build_ex13_climate_art.py). ----------
  const KLKEYS = ['terrain', 'veg', 'built', 'heat']; // bottom → top
  let KA = null, KAp = null;
  function loadClimate() { if (KAp) return KAp; const v = '?v=' + (root.GA_BUILD || ''), dir = 'data/ex13/art/'; const im = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(u)); i.src = dir + u + v; });
    KAp = Promise.all([fetch(dir + 'climate_art.json' + v).then(r => { if (!r.ok) throw new Error('climate_art.json ' + r.status); return r.json(); })].concat(KLKEYS.concat(['edge']).map(k => im('climate_' + k + '.png'))))
      .then(([m, ...ims]) => { const I = {}; KLKEYS.concat(['edge']).forEach((k, i) => I[k] = ims[i]); return (KA = Object.assign(m, { img: I })); }).catch(e => { KAp = null; throw e; }); return KAp; }
  function drawClimate(ctx, D, x, y, S, o) {
    o = o || {}; if (!KA) return false; const P = GA.palette, INK = P.ink, F = root.GA.pages.font(); const W = 1000, HH = 1000; // drawing space 1000 × 1000
    const SC = 0.66, OX = 165, GAP = 150, n = KLKEYS.length, BH = KA.H * SC; const top0 = (HH - BH - (n - 1) * GAP) / 2 + 20;
    const C = Object.fromEntries(Object.entries(KA.corners).map(([k, [cx, cy]]) => [k, [OX + cx * SC, cy * SC]]));
    const Y = (i) => top0 + (n - 1 - i) * GAP; // layer 0 (terrain) at the bottom
    // 5.36: the build-up starts as ONE block (all four layers together at the bottom), then the block opens upward — all
    // layers move up AT THE SAME TIME (steps 2 … n carry one shared, eased progress), each to its own height
    const bu = o.focus == null && o.upTo != null; const tB = o.t != null ? o.t : 1;
    const pB = bu ? Math.max(0, Math.min(1, (o.upTo - 2 + tB) / (n - 1))) : 1, eB = pB * pB * (3 - 2 * pB);
    const lvl = (i) => i * eB;
    const YL = (v) => top0 + (n - 1 - v) * GAP;
    const apart = (i) => { const d = i < n - 1 ? lvl(i + 1) - lvl(i) : lvl(i) - lvl(i - 1); return Math.max(0, Math.min(1, (d - 0.55) / 0.4)); };
    ctx.save(); ctx.translate(x, y); ctx.scale(S / W, S / HH); ctx.beginPath(); ctx.rect(0, 0, W, HH); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, HH);
    ctx.strokeStyle = 'rgba(41,16,12,.28)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 5]); if (lvl(n - 1) > 0.05) ['n', 'e', 'w'].forEach(c => { ctx.beginPath(); ctx.moveTo(C[c][0], YL(lvl(n - 1)) + C[c][1] - 30); ctx.lineTo(C[c][0], Y(0) + C[c][1]); ctx.stroke(); }); ctx.setLineDash([]);
    const titles = [['TERRAIN', 'x25.k.terrain'], ['VEGETATION', 'x25.k.veg'], ['BUILT FABRIC', 'x25.k.built'], ['SURFACE HEAT', 'x25.k.heat']];
    const t9n = (k) => root.GA.i18n.t(k);
    for (let i = 0; i < n; i++) { const a = bu ? (o.upTo === 1 ? tB : 1) : layerAlpha(o, i); if (a <= 0.005) continue; const yy = YL(lvl(i)) - (o.focus === i ? 16 : 0);
      ctx.save(); ctx.globalAlpha = a; ctx.drawImage(KA.img[KLKEYS[i]], OX, yy, KA.W * SC, KA.H * SC); ctx.drawImage(KA.img.edge, OX, yy, KA.W * SC, KA.H * SC);
      const la = bu ? apart(i) : 1; if (la <= 0.01) { ctx.restore(); continue; } ctx.globalAlpha = a * la;
      const wx = C.w[0], wy = yy + C.w[1] - 12, lx = 26, red = o.focus === i; ctx.strokeStyle = red ? P.red : 'rgba(41,16,12,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx - 6, wy); ctx.lineTo(lx + 40, wy); ctx.stroke(); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(wx - 6, wy, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = red ? P.red : INK; ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.font = `700 24px ${F}`; ctx.fillText(String(i + 1).padStart(2, '0'), lx, wy - 6); ctx.font = `700 12px ${F}`; ctx.fillText(titles[i][0], lx, wy + 18); ctx.font = `700 15px ${F}`; ctx.fillText(t9n(titles[i][1]), lx, wy + 38); ctx.restore(); }
    ctx.save(); ctx.translate(950, 50); ctx.rotate(-Math.PI / 3); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(8, 12); ctx.lineTo(0, 7); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = INK; ctx.font = `700 14px ${F}`; ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.fillText('N', 928, 88);
    ctx.font = `500 13px ${F}`; ctx.textAlign = 'right'; ctx.fillStyle = P.ink3; ctx.fillText('10 × 10 km · relief × ' + KA.exag + ' · IGN MDT25', W - 24, HH - 18);
    ctx.restore(); return true;
  }
  function climateLegend(t) { if (!KA) return []; const s = KA.stats, P = GA.palette, n = (v) => '‎' + v + '‎';
    return [{ sw: P.base.khaki, label: t('x25.lg.terrain', { a: n(s.elev[0]), b: n(s.elev[1]), x: n(KA.exag) }), layer: 0 },
      { sw: P.olive, label: t('x25.lg.veg', { p: n(s.vegShare + ' %') }), layer: 1 },
      { sw: P.ink, label: t('x25.lg.built', { p: n(s.cov + ' %') }), layer: 2 }]
      .concat(s.lstCols.map((c, i) => ({ sw: c, label: i === 0 ? n('< ' + s.breaks[0] + ' °C') : i === s.breaks.length ? n('≥ ' + s.breaks[i - 1] + ' °C') : n(s.breaks[i - 1] + '–' + s.breaks[i] + ' °C'), layer: 3 })))
      .concat([{ edge: P.ink, label: t('x25.lg.edge') }]); }
  root.GA.ex13art = { KEYS, CKEYS, DKEYS, CELL, prepare, draw, legendItems, loadCentre, ready: (k) => (k === 'centre' || k === 'density') ? loadCentre() : k === 'climate' ? loadClimate() : k === 'humanAxo' ? Promise.all([loadCentre(), loadHuman()]) : Promise.resolve(), keys: (k) => k === 'centre' ? CKEYS : k === 'density' ? DKEYS : k === 'climate' ? KLKEYS : k === 'human' ? HKEYS : k === 'humanAxo' ? HAXKEYS : KEYS,
    drawCentre, centreLegend, drawDensity, drawDensityTop, densityLegend, drawClimate, climateLegend, loadClimate, KLKEYS, drawHuman, humanLegend, HAXKEYS, loadHuman, drawHumanAxo, drawHumanAxoTop, humanAxoLegend, get human() { return HA; }, densityStats: (D) => needles(D), get centre() { return CA; }, get grid() { return G; } };
})(window);
