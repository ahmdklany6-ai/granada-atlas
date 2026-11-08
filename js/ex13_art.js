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
    const alpha = (i) => o.focus != null ? (i === o.focus ? 1 : 0.1) : o.upTo != null ? (i < o.upTo ? 1 : 0) : 1;
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
  root.GA.ex13art = { KEYS, CKEYS, CELL, prepare, draw, legendItems, loadCentre, ready, keys, drawCentre, centreLegend, get centre() { return CA; }, get grid() { return G; } };
})(window);
