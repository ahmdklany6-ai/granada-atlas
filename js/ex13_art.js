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
  root.GA.ex13art = { KEYS, CELL, prepare, draw, legendItems, get grid() { return G; } };
})(window);
