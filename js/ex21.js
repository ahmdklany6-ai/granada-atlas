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
  let D = null, Dp = null;
  const P = () => root.GA.palette;
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
    const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs, close) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); if (close) ctx.closePath(); };
    // 5.42 (owner request, 13 Nov 2026): one layer of information per map — o.only = 'island' | 'walk' | 'growth' | 'height';
    // every map keeps the same light context (municipal boundaries, buildings, streets, the base, town names)
    const on = (n) => !o.only || o.only === n;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // 1 municipal boundaries (dashed); the residents' change 2015 → 2025 is written at each town
    const chg = (v) => { const b = T.chgBreaks; let i = 0; while (i < b.length && v >= b[i]) i++; return T.chg[i]; };
    ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = C.muni; ctx.lineWidth = 1.1 * k; D.area.forEach(a => { path(a.g, true); ctx.stroke(); }); ctx.setLineDash([]);
    // 2 the aeronautical height limits (allowed height above ground < 60 m)
    if (on('height')) { const e = D.ease.extent; ctx.save(); ctx.globalAlpha = o.focus != null && o.focus !== 'height' ? 0.25 : 1; ctx.imageSmoothingEnabled = true; ctx.drawImage(D.hImg, X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp); ctx.restore(); }
    // 3 built footprints and main streets
    ctx.fillStyle = C.built; D.builds.forEach(rs => { path(rs, true); ctx.fill(); });
    ctx.strokeStyle = C.street; ctx.lineWidth = 0.9 * k; ctx.beginPath(); D.streets.forEach(s => s.g.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))))); ctx.stroke();
    // 4 the 300 m band (hatched) and the base as a closed solid with its runway
    const band = D.edge.find(f => f.p.k === 'band'), base = D.edge.find(f => f.p.k === 'base');
    if (band && on('island')) { ctx.save(); path(band.g, true); ctx.clip('evenodd'); ctx.strokeStyle = C.bandLine; ctx.lineWidth = 0.8 * k; ctx.globalAlpha = 0.7; ctx.beginPath(); for (let q = -h; q < w + h; q += 7 * k) { ctx.moveTo(x + q, y + h); ctx.lineTo(x + q + h, y); } ctx.stroke(); ctx.restore(); }
    if (base) { path(base.g, true); ctx.fillStyle = C.base; ctx.fill(); ctx.strokeStyle = C.baseLine; ctx.lineWidth = 1.4 * k; ctx.stroke();
      ctx.strokeStyle = C.runway; ctx.lineWidth = 3.2 * k; ctx.setLineDash([10 * k, 6 * k]); ctx.beginPath(); ctx.moveTo(X(D.runway[0][0]), Y(D.runway[0][1])); ctx.lineTo(X(D.runway[1][0]), Y(D.runway[1][1])); ctx.stroke(); ctx.setLineDash([]); }
    // 5 the fence by what lies outside it
    if (on('island')) D.edge.filter(f => f.p.k === 'fence').forEach(f => { ctx.strokeStyle = C.fence[f.p.c] || C.baseLine; ctx.lineWidth = 4.2 * k; path(f.g); ctx.stroke(); });
    // 6 walking detours vs the straight line, dead ends
    if (on('walk')) D.edge.filter(f => f.p.k === 'straight').forEach(f => { ctx.strokeStyle = C.straight; ctx.lineWidth = 1.2 * k; ctx.setLineDash([3 * k, 4 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]); });
    if (on('walk')) D.edge.filter(f => f.p.k === 'route').forEach(f => { ctx.strokeStyle = C.route; ctx.lineWidth = 2.6 * k; ctx.setLineDash([9 * k, 4 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]);
      const r = f.g[0], m = r[Math.floor(r.length * 0.62)]; const lab = `${(f.p.walk_m / 1000).toFixed(1)} km  ×${f.p.ratio.toFixed(2)}`; ctx.font = font(10.5, 700); ctx.lineWidth = 3.2 * k; ctx.strokeStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(lab, X(m[0]), Y(m[1]) - 10 * k); ctx.fillStyle = C.route; ctx.fillText(lab, X(m[0]), Y(m[1]) - 10 * k); });
    if (on('walk')) D.edge.filter(f => f.p.k === 'deadend').forEach(f => { const [u, v] = Array.isArray(f.g[0]) ? f.g[0][0] : f.g; ctx.beginPath(); ctx.arc(X(u), Y(v), 4.2 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.dead; ctx.lineWidth = 2 * k; ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(u) - 2.4 * k, Y(v)); ctx.lineTo(X(u) + 2.4 * k, Y(v)); ctx.stroke(); });
    // 7 the metro extension under construction, with its two ends
    if (on('growth')) { ctx.strokeStyle = C.metro; ctx.lineWidth = 6 * k; ctx.beginPath(); D.l1.lines.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke();
      D.l1.stops.forEach(st => { ctx.beginPath(); ctx.arc(X(st.p[0]), Y(st.p[1]), 4.6 * k, 0, 7); ctx.fillStyle = C.metro; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.6 * k; ctx.stroke(); }); }
    if (on('growth')) D.metro.forEach(f => { if (f.p.k === 'track') { ctx.strokeStyle = C.metro; ctx.lineWidth = 6 * k; path(f.g); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.2 * k; ctx.setLineDash([7 * k, 7 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]); }
      else { ctx.beginPath(); ctx.arc(X(f.g[0]), Y(f.g[1]), 6 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.metro; ctx.lineWidth = 2.6 * k; ctx.stroke(); } });
    // 8 labels: towns with their change 2015 → 2025, the base
    const towns = D.edge.filter(f => f.p.k === 'town'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    towns.forEach(f => { const a = D.area.find(m => m.p.name === f.p.nm); const [u, v] = f.g; const px = X(u), py = Y(v);
      ctx.font = font(15, 700); ctx.lineWidth = 4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(f.p.nm.toUpperCase(), px, py - 8 * k); ctx.fillStyle = C.town; ctx.fillText(f.p.nm.toUpperCase(), px, py - 8 * k);
      if (a && on('growth')) { const s = (a.p.chg > 0 ? '+' : '') + a.p.chg.toFixed(1) + ' %'; ctx.font = font(12, 600); ctx.strokeText(s + ' · 2015→2025', px, py + 9 * k); ctx.fillStyle = C.town; ctx.fillText(s + ' · 2015→2025', px, py + 9 * k); } });
    if (base) { const rx = X((D.runway[0][0] + D.runway[1][0]) / 2) - 26 * k, ry = Y((D.runway[0][1] + D.runway[1][1]) / 2); ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF'; ctx.font = font(15, 700); ctx.fillText(t('x34.base').toUpperCase(), rx, ry); ctx.font = font(11, 500); ctx.fillText(`${base.p.area_ha} ha · ${base.p.perimeter_km} km`, rx, ry + 17 * k); ctx.textAlign = 'center'; }
    // frame, north, scale
    ctx.restore(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * k; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    root.GA.pages.northArrow(ctx, x + w - 28 * k, y + 20 * k, 1.3 * k);
    if (on('growth') && o.only === 'growth') drawLineInset(ctx, x + 14 * k, y + h - 410 * k, 250 * k, 350 * k, k, t, font);
    const km = 1000 / mpp, bx = x + 22 * k, by = y + h - 24 * k; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 8 * k, by - 22 * k, km + 60 * k, 34 * k);
    ctx.fillStyle = pal.ink; ctx.fillRect(bx, by, km / 2, 5 * k); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, km, 5 * k); ctx.font = font(10, 500); ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText('0', bx, by - 5 * k); ctx.fillText('500', bx + km / 2, by - 5 * k); ctx.fillText('1 km', bx + km, by - 5 * k);
    return true;
  }
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
    const gap = 26 * k, mw = (w - 2 * gap) / 3, mh = Math.min(h * 0.62, mw * (b1 - b0) / (a1 - a0)); const sc = Math.min(mw / (a1 - a0), mh / (b1 - b0));
    vars.forEach(([key, br, cols, fmt, title], i) => { const ox = x + (rtl ? 2 - i : i) * (mw + gap), oy = y + 34 * k; const X = (u) => ox + (u - a0) * sc + (mw - (a1 - a0) * sc) / 2, Y = (v) => oy + (b1 - v) * sc;
      const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, j) => j ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.closePath(); };
      ctx.font = font(13, 700); ctx.fillStyle = pal.ink; ctx.textAlign = rtl ? 'right' : 'left'; ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t(title), rtl ? ox + mw : ox, y + 16 * k);
      D.area.forEach(m => { path(m.g); const c = cls(m.p[key], br, cols); if (c) { ctx.fillStyle = c; ctx.fill('evenodd'); } else { ctx.save(); ctx.clip('evenodd'); ctx.strokeStyle = T.missing; ctx.lineWidth = 1 * k; ctx.beginPath(); for (let q = -mh; q < mw + mh; q += 5 * k) { ctx.moveTo(ox + q, oy + mh); ctx.lineTo(ox + q + mh, oy); } ctx.stroke(); ctx.restore(); }
        path(m.g); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.8 * k; ctx.stroke(); });
      D.area.filter(m => m.p.five || m.p.name === 'Granada').forEach(m => { path(m.g); ctx.strokeStyle = m.p.five ? pal.ink : C.metro; ctx.lineWidth = (m.p.five ? 1.8 : 2.4) * k; ctx.stroke(); });
      const base = D.edge.find(f => f.p.k === 'base'); if (base) { path(base.g); ctx.fillStyle = C.base; ctx.fill(); }
      // class legend under the map
      const lx = ox, ly = oy + mh + 14 * k, cw = mw / cols.length; cols.forEach((c, j) => { ctx.fillStyle = c; ctx.fillRect(lx + j * cw, ly, cw - 2 * k, 10 * k); });
      ctx.font = font(9, 500); ctx.fillStyle = pal.ink2; ctx.textAlign = 'center'; ctx.direction = 'ltr'; br.forEach((b, j) => ctx.fillText(key === 'inc' ? (b / 1000) + 'k' : String(b), lx + (j + 1) * cw - 1 * k, ly + 22 * k)); });
    // bars: Granada city and the five towns
    const rows = D.area.filter(m => m.p.name === 'Granada' || m.p.five).sort((p, q) => (p.p.name === 'Granada' ? -1 : q.p.name === 'Granada' ? 1 : q.p.chg - p.p.chg));
    const by = y + 34 * k + mh + 46 * k, rh = (y + h - by) / rows.length;
    vars.forEach(([key, br, cols, fmt], i) => { const ox = x + (rtl ? 2 - i : i) * (mw + gap); const base0 = key === 'rent' ? 100 : 0; /* the rent index starts at 100 (2015) */ const vals = rows.map(m => m.p[key]).filter(v => v != null); const vmax = Math.max(...vals.map(v => Math.abs(v - base0))) * 1.15; const lab = 92 * k, bw = mw - lab - 54 * k;
      rows.forEach((m, j) => { const cy = by + rh * (j + 0.5), v = m.p[key]; const bx = rtl ? ox + mw - lab : ox + lab;
        ctx.font = font(9.5, m.p.name === 'Granada' ? 700 : 500); ctx.fillStyle = pal.ink; ctx.textAlign = rtl ? 'left' : 'right'; ctx.direction = 'ltr'; ctx.textBaseline = 'middle'; ctx.fillText(m.p.name.replace(' de la Vega', ''), rtl ? bx + 6 * k : bx - 6 * k, cy);
        if (v == null) { ctx.fillStyle = pal.ink3; ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText('—', rtl ? bx - 4 * k : bx + 4 * k, cy); return; }
        const L = Math.abs(v - base0) / vmax * bw; ctx.fillStyle = cls(v, br, cols); ctx.fillRect(rtl ? bx - L : bx, cy - rh * 0.3, L, rh * 0.6); ctx.strokeStyle = 'rgba(41,16,12,.25)'; ctx.lineWidth = 1; ctx.strokeRect(rtl ? bx - L : bx, cy - rh * 0.3, L, rh * 0.6);
        ctx.fillStyle = pal.ink; ctx.font = font(9.5, 700); ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText(fmt(v), rtl ? bx - L - 5 * k : bx + L + 5 * k, cy); }); });
    return true;
  }
  // inset for map 03: the whole line 1 today (Albolote → Granada → Armilla) and its extension past the base
  function drawLineInset(ctx, x, y, w, h, k, t, font) { const pal = P(), C = pal.ex21; const pts = D.l1.lines.flat().concat(D.metro.filter(f => f.p.k === 'track').flatMap(f => f.g.flat()));
    let a0 = 1e12, b0 = 1e12, a1 = -1e12, b1 = -1e12; pts.forEach(([u, v]) => { a0 = Math.min(a0, u); b0 = Math.min(b0, v); a1 = Math.max(a1, u); b1 = Math.max(b1, v); });
    const pad = 16 * k, top = 34 * k, sc = Math.min((w - 2 * pad) / (a1 - a0), (h - top - pad - 30 * k) / (b1 - b0)); const ox = x + (w - (a1 - a0) * sc) / 2, oy = y + top;
    const X = (u) => ox + (u - a0) * sc, Y = (v) => oy + (b1 - v) * sc; const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); };
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.strokeStyle = pal.line2; ctx.lineWidth = 1; ctx.fillRect(x, y, w, h); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    D.area.forEach(m => { path(m.g); ctx.closePath(); if (m.p.name === 'Granada') { ctx.fillStyle = pal.gray1; ctx.fill('evenodd'); } ctx.strokeStyle = C.muni; ctx.lineWidth = 0.6 * k; ctx.stroke(); });
    const base = D.edge.find(f => f.p.k === 'base'); if (base) { path(base.g); ctx.closePath(); ctx.fillStyle = C.base; ctx.fill(); }
    ctx.strokeStyle = C.metro; ctx.lineWidth = 3 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; D.l1.lines.forEach(l => path([l])) ; ctx.beginPath(); D.l1.lines.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke();
    D.metro.filter(f => f.p.k === 'track').forEach(f => { path(f.g); ctx.strokeStyle = C.metro; ctx.lineWidth = 3 * k; ctx.stroke(); path(f.g); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([3 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); });
    D.l1.stops.forEach(st => { ctx.beginPath(); ctx.arc(X(st.p[0]), Y(st.p[1]), 2.4 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.metro; ctx.lineWidth = 1.2 * k; ctx.stroke(); });
    // the main map's frame
    const E = CITY; ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.4 * k; ctx.strokeRect(X(E.x0), Y(E.y1), (E.x1 - E.x0) * sc, (E.y1 - E.y0) * sc);
    ctx.font = font(9, 700); ctx.fillStyle = pal.ink; ctx.textBaseline = 'middle'; ctx.lineWidth = 3 * k; ctx.strokeStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.direction = 'ltr';
    const lab = (txt, p, dx) => { ctx.strokeText(txt, X(p[0]) + dx, Y(p[1])); ctx.fillText(txt, X(p[0]) + dx, Y(p[1])); };
    const byName = (n) => D.l1.stops.find(st => st.name === n); [['Albolote', 8], ['Recogidas', -8], ['Armilla', 8]].forEach(([n, dx]) => { const st = byName(n); if (!st) return; ctx.textAlign = dx < 0 ? 'right' : 'left'; lab(n === 'Recogidas' ? 'GRANADA' : n, st.p, dx * k); });
    const term = D.metro.find(f => f.p.k === 'terminus'); if (term) { ctx.textAlign = 'right'; lab('Las Gabias', term.g, -7 * k); }
    ctx.restore(); ctx.font = font(9.5, 700); ctx.fillStyle = pal.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t('x34.inset.title'), x + 8 * k, y + 16 * k);
    ctx.font = font(8, 500); ctx.fillStyle = pal.ink2; const m = D.l1.meta; ctx.fillText(t('x34.inset.meta', { n: m.stops.length, d: m.duration_min, i: m.interval_min }), x + 8 * k, y + 28 * k);
    ctx.fillText(t('x34.inset.src'), x + 8 * k, y + h - 8 * k); }
  // ---------- AREA level (1:500): four 130 m windows on the edge (data/ex21/areas.json, tools/build_ex21_areas.py) ----------
  let AR = null, ARp = null;
  function readyAreas() { if (ARp) return ARp; ARp = fetch('data/ex21/areas.json?v=' + (root.GA_BUILD || '')).then(r => r.json()).then(j => (AR = j)).catch(e => { ARp = null; throw e; }); return ARp; }
  const floorsCol = (lv) => { const b = P().band; return lv == null ? null : lv <= 2 ? b['1-2'] : lv <= 4 ? b['3-4'] : lv <= 8 ? b['5-8'] : b['9+']; };
  function drawArea(ctx, x, y, S, id, o) {
    o = o || {}; const A = AR && AR.areas.find(a => a.id === id); if (!A) return false; const pal = P(), C = pal.ex21, LU = pal.landuse; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const k = o.k || S / 1000;
    const e = A.extent, mpp = (e[2] - e[0]) / S; const X = (u) => x + (u - e[0]) / mpp, Y = (v) => y + (e[3] - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs, close) => { ctx.beginPath(); rs.forEach(rr => rr.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))))); if (close) ctx.closePath(); };
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, S, S); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
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
    A.buildings.forEach(b => { path(b.r, true); const c = floorsCol(b.lv); if (c) { ctx.fillStyle = c; ctx.fill('evenodd'); } ctx.strokeStyle = pal.ink; ctx.lineWidth = 0.7 * k; ctx.stroke(); });
    // trees (OSM)
    A.trees.forEach(([u, v]) => { ctx.beginPath(); ctx.arc(X(u), Y(v), 2.2 / mpp, 0, 7); ctx.fillStyle = 'rgba(126,123,67,.35)'; ctx.fill(); ctx.strokeStyle = pal.olive; ctx.lineWidth = 0.8 * k; ctx.stroke(); });
    // the fence by what lies outside it, dead ends, metro
    A.fence.forEach(f => { ctx.strokeStyle = C.fence[f.c] || C.baseLine; ctx.lineWidth = 7 * k; path(f.r); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([2 * k, 5 * k]); path(f.r); ctx.stroke(); ctx.setLineDash([]); });
    A.metro.forEach(m => { if (m.k === 'track') { ctx.strokeStyle = C.metro; ctx.lineWidth = 8 * k; path(m.r); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3 * k; ctx.setLineDash([9 * k, 9 * k]); path(m.r); ctx.stroke(); ctx.setLineDash([]); } });
    A.dead.forEach(([u, v]) => { ctx.beginPath(); ctx.arc(X(u), Y(v), 9 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.dead; ctx.lineWidth = 3.4 * k; ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(u) - 5 * k, Y(v)); ctx.lineTo(X(u) + 5 * k, Y(v)); ctx.stroke(); });
    // street names (OSM)
    ctx.font = font(9.5, 500); ctx.fillStyle = pal.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const named = new Set();
    A.streets.forEach(st => { if (!st.nm || named.has(st.nm) || /footway|path|service|track/.test(st.hw)) return; const r = st.r[0] && st.r[0][0]; if (!r || r.length < 2) return; const i = Math.floor(r.length / 2), p0 = r[Math.max(0, i - 1)], p1 = r[Math.min(r.length - 1, i)];
      let ang = Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; ctx.save(); ctx.translate(X((p0[0] + p1[0]) / 2), Y((p0[1] + p1[1]) / 2)); ctx.rotate(ang); ctx.lineWidth = 3 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(st.nm, 0, 0); ctx.fillText(st.nm, 0, 0); ctx.restore(); named.add(st.nm); });
    // section line A–A′
    const sa = A.section.a, sb = A.section.b; ctx.strokeStyle = pal.red; ctx.lineWidth = 1.8 * k; ctx.setLineDash([10 * k, 5 * k]); ctx.beginPath(); ctx.moveTo(X(sa[0]), Y(sa[1])); ctx.lineTo(X(sb[0]), Y(sb[1])); ctx.stroke(); ctx.setLineDash([]);
    [[sa, A.id], [sb, A.id + '′']].forEach(([p, n]) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = font(12, 700); ctx.textAlign = 'center'; ctx.fillText(n, X(p[0]), Y(p[1]) + 0.5 * k); });
    ctx.restore(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * k; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
    root.GA.pages.northArrow(ctx, x + S - 26 * k, y + 18 * k, 1.2 * k);
    // scale bar 0–10–20–50 m
    const m50 = 50 / mpp, bx = x + 16 * k, by = y + S - 20 * k; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 6 * k, by - 20 * k, m50 + 46 * k, 30 * k); ctx.fillStyle = pal.ink;
    [[0, 10], [20, 30], [40, 50]].forEach(([a, b]) => ctx.fillRect(bx + a / mpp, by, (b - a) / mpp, 5 * k)); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, m50, 5 * k);
    ctx.font = font(9.5, 500); ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.textBaseline = 'alphabetic'; ['0', '10', '20', '50 m'].forEach((s0, i) => ctx.fillText(s0, bx + [0, 10, 20, 50][i] / mpp, by - 4 * k));
    return true;
  }
  // key map: the base and its fence (as map 01) with the eight 1:500 windows
  function drawAreaKey(ctx, x, y, w, h, o) { o = o || {}; if (!D || !AR) return false; const pal = P(); const t = o.t || ((s) => s); const k = o.k || w / 1000; const F = root.GA.pages.font();
    drawCity(ctx, x, y, w, h, { t, only: 'island', k }); const E = CITY, mpp = (E.x1 - E.x0) / w; const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp;
    AR.areas.forEach(a => { const e = a.extent; ctx.fillStyle = 'rgba(153,43,42,.18)'; ctx.fillRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp); ctx.strokeStyle = pal.red; ctx.lineWidth = 2.4 * k; ctx.strokeRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp);
      const cx = X((e[0] + e[2]) / 2), cy = Y(e[3]) - 14 * k; ctx.beginPath(); ctx.arc(cx, cy, 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = `700 ${Math.round(12 * k)}px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.fillText(a.id, cx, cy + 0.5 * k); });
    return true; }
  // the section across the fence, true scale (1:500 both ways); building heights = floors × 3 m (estimate)
  // legend of the area maps: the band land use present in any window, floors, streets, fence, dead ends, section
  function areaLegend(t) { const pal = P(), C = pal.ex21, b = pal.band; const used = new Set(); (AR ? AR.areas : []).forEach(a => (a.bandlu || []).forEach(l => used.add(l.c)));
    return [{ sw: C.base, label: t('x34.lg.base') }].concat([...used].map(c => ({ sw: pal.tour.bandlu[c], alpha: 0.5, label: t('x34.lg.lu.' + c) })))
      .concat([{ sw: b['1-2'], label: t('x34.lg.fl.12') }, { sw: b['3-4'], label: t('x34.lg.fl.34') }, { sw: b['5-8'], label: t('x34.lg.fl.58') }, { line: C.street, w: 3, label: t('x34.lg.street') }, { line: C.street, w: 1, dash: true, label: t('x34.lg.path') },
        { line: C.fence.housing, w: 3, label: t('x34.lg.fenceAny') }, { line: C.dead, w: 2, label: t('x34.lg.dead') }, { line: pal.red, w: 1.5, dash: true, label: t('x34.lg.secline') }]); }
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
  function mapLegend(only, t) { const C = P().ex21, want = ONLY[only] || []; const out = [];
    if (want.includes('base')) out.push({ sw: C.base, label: t('x34.lg.base') });
    if (want.includes('band')) out.push({ hatch: C.bandLine, label: t('x34.lg.band') });
    if (want.includes('fence')) Object.keys(C.fence).forEach(c => out.push({ line: C.fence[c], w: 3, label: t('x34.lg.fence.' + c) }));
    if (want.includes('route')) out.push({ line: C.route, w: 2, dash: true, label: t('x34.lg.route') }, { line: C.straight, w: 1, dash: true, label: t('x34.lg.straight') });
    if (want.includes('dead')) out.push({ line: C.dead, w: 2, label: t('x34.lg.dead') });
    if (want.includes('metro')) out.push({ line: C.metro, w: 4, label: t('x34.lg.l1') }, { line: C.metro, w: 4, rail: true, label: t('x34.lg.metro') });
    if (want.includes('muni')) out.push({ line: C.muni, dash: true, w: 1, label: t('x34.lg.muni2') });
    if (want.includes('height')) Object.keys(C.height).forEach(c => out.push({ sw: C.height[c], label: t('x34.lg.h.' + c) }));
    return out; }
  function cityLegend(t) { const C = P().ex21, T = P().tour;
    return [{ sw: C.base, label: t('x34.lg.base') }, { hatch: C.bandLine, label: t('x34.lg.band') }]
      .concat(Object.keys(C.fence).map(c => ({ line: C.fence[c], w: 3, label: t('x34.lg.fence.' + c) })))
      .concat([{ line: C.route, w: 2, dash: true, label: t('x34.lg.route') }, { line: C.dead, w: 2, label: t('x34.lg.dead') }, { line: C.metro, w: 4, rail: true, label: t('x34.lg.metro') }])
      .concat(Object.keys(C.height).map(c => ({ sw: C.height[c], label: t('x34.lg.h.' + c) })))
      .concat([{ sw: C.built, label: t('x34.lg.built') }, { line: C.muni, dash: true, w: 1, label: t('x34.lg.muni2') }]); }
  root.GA.ex21 = { ready, readyAreas, drawArea, drawSection, areaLegend, drawAreaKey, get areas() { return AR; }, drawCity, drawGaps, cityLegend, mapLegend, MAPS: ['island', 'walk', 'growth', 'height'], CITY, get data() { return D; } };
})(window);
