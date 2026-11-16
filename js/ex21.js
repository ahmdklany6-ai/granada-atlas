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
      ctx.fillStyle = '#FFFFFF'; ctx.font = font(15, 700); ctx.fillText(t('x34.base').toUpperCase(), rx, ry); ctx.font = font(11, 500); ctx.direction = 'ltr'; ctx.fillText(`${km2(base.p.area_ha)} km² · ${base.p.perimeter_km} km`, rx, ry + 17 * k); ctx.textAlign = 'center'; }
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
  function drawLineInset(ctx, x, y, w, h, k, t, font) { const pal = P(), C = pal.ex21; const E = CITY; const pts = D.l1.lines.flat().concat(D.metro.filter(f => f.p.k === 'track').flatMap(f => f.g.flat()));
    // the frame holds the whole line AND the main map's frame, between a header band (title, figures) and a footer band (source)
    let a0 = E.x0, b0 = E.y0, a1 = E.x1, b1 = E.y1; pts.forEach(([u, v]) => { a0 = Math.min(a0, u); b0 = Math.min(b0, v); a1 = Math.max(a1, u); b1 = Math.max(b1, v); });
    const pad = 12 * k, top = 36 * k, foot = 18 * k, sc = Math.min((w - 2 * pad) / (a1 - a0), (h - top - foot - 2 * pad) / (b1 - b0)); const ox = x + (w - (a1 - a0) * sc) / 2, oy = y + top + pad;
    const X = (u) => ox + (u - a0) * sc, Y = (v) => oy + (b1 - v) * sc; const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); };
    ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.rect(x, y + top, w, h - top - foot); ctx.clip();
    D.area.forEach(m => { path(m.g); ctx.closePath(); if (m.p.name === 'Granada') { ctx.fillStyle = pal.gray1; ctx.fill('evenodd'); } ctx.strokeStyle = C.muni; ctx.lineWidth = 0.6 * k; ctx.stroke(); });
    const base = D.edge.find(f => f.p.k === 'base'); if (base) { path(base.g); ctx.closePath(); ctx.fillStyle = C.base; ctx.fill(); }
    ctx.strokeStyle = C.metro; ctx.lineWidth = 3 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); D.l1.lines.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke();
    D.metro.filter(f => f.p.k === 'track').forEach(f => { path(f.g); ctx.strokeStyle = C.metro; ctx.lineWidth = 3 * k; ctx.stroke(); path(f.g); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([3 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); });
    D.l1.stops.forEach(st => { ctx.beginPath(); ctx.arc(X(st.p[0]), Y(st.p[1]), 2.4 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.metro; ctx.lineWidth = 1.2 * k; ctx.stroke(); });
    // the main map's frame
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.4 * k; ctx.strokeRect(X(E.x0), Y(E.y1), (E.x1 - E.x0) * sc, (E.y1 - E.y0) * sc);
    ctx.font = font(9, 700); ctx.fillStyle = pal.ink; ctx.textBaseline = 'middle'; ctx.lineWidth = 3 * k; ctx.strokeStyle = '#FFFFFF'; ctx.direction = 'ltr';
    const lab = (txt, p, dx, dy, al) => { ctx.textAlign = al; ctx.strokeText(txt, X(p[0]) + dx, Y(p[1]) + dy); ctx.fillText(txt, X(p[0]) + dx, Y(p[1]) + dy); };
    const byName = (n) => D.l1.stops.find(st => st.name === n); [['Albolote', 8], ['Recogidas', -8], ['Armilla', 8]].forEach(([n, dx]) => { const st = byName(n); if (st) lab(n === 'Recogidas' ? 'GRANADA' : n, st.p, dx * k, n === 'Armilla' ? 9 * k : 0, dx < 0 ? 'right' : 'left'); });
    const term = D.metro.find(f => f.p.k === 'terminus'); if (term) lab('Las Gabias', term.g, 0, 11 * k, 'center');
    ctx.restore(); ctx.strokeStyle = pal.line2; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = font(9.5, 700); ctx.fillStyle = pal.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t('x34.inset.title'), x + 8 * k, y + 16 * k, w - 16 * k);
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
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, S, S); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
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
    A.streets.forEach(st => { if (!st.nm || named.has(st.nm) || /footway|path|service|track/.test(st.hw)) return; const r = st.r[0] && st.r[0][0]; if (!r || r.length < 2) return; const i = Math.floor(r.length / 2), p0 = r[Math.max(0, i - 1)], p1 = r[Math.min(r.length - 1, i)];
      let ang = Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; ctx.save(); ctx.translate(X((p0[0] + p1[0]) / 2), Y((p0[1] + p1[1]) / 2)); ctx.rotate(ang); ctx.lineWidth = 3 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(st.nm, 0, 0); ctx.fillText(st.nm, 0, 0); ctx.restore(); named.add(st.nm); });
    const labelAt = (rs, txt, col) => { let n = 0, sx = 0, sy = 0; rs.forEach(pg => (pg[0] || []).forEach(c => { sx += c[0]; sy += c[1]; n++; })); if (!n || !txt) return; ctx.font = font(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3.4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(txt, X(sx / n), Y(sy / n)); ctx.fillStyle = col; ctx.fillText(txt, X(sx / n), Y(sy / n)); };
    const seenNm = new Set(); (A.places || []).forEach(q => { if (q.nm && !seenNm.has(q.nm)) { seenNm.add(q.nm); labelAt(q.r, q.nm, pal.blue); } });
    (A.water || []).forEach(q => { if (q.nm && !seenNm.has(q.nm)) { seenNm.add(q.nm); const r = q.r[0] && q.r[0][0]; if (r && r.length > 1) { const m = r[Math.floor(r.length / 2)]; ctx.font = font(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3.4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(q.nm, X(m[0]), Y(m[1]) - 12 * k); ctx.fillStyle = pal.blue; ctx.fillText(q.nm, X(m[0]), Y(m[1]) - 12 * k); } } });
    (A.plots || []).forEach(q => { let n = 0, sx = 0, sy = 0; q.r.forEach(pg => pg[0].forEach(c => { sx += c[0]; sy += c[1]; n++; })); if (!n) return; ctx.font = font(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3.4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(q.nm.replace(/ \(.*\)$/, ''), X(sx / n), Y(sy / n)); ctx.fillStyle = pal.ink; ctx.fillText(q.nm.replace(/ \(.*\)$/, ''), X(sx / n), Y(sy / n)); });
    // section line A–A′
    const sa = A.section.a, sb = A.section.b;
    if (aer) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4.4 * k; ctx.beginPath(); ctx.moveTo(X(sa[0]), Y(sa[1])); ctx.lineTo(X(sb[0]), Y(sb[1])); ctx.stroke(); }
    ctx.strokeStyle = pal.red; ctx.lineWidth = (aer ? 2.2 : 1.8) * k; ctx.setLineDash([10 * k, 5 * k]); ctx.beginPath(); ctx.moveTo(X(sa[0]), Y(sa[1])); ctx.lineTo(X(sb[0]), Y(sb[1])); ctx.stroke(); ctx.setLineDash([]);
    [[sa, A.id], [sb, A.id + '′']].forEach(([p, n]) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = font(12, 700); ctx.textAlign = 'center'; ctx.fillText(n, X(p[0]), Y(p[1]) + 0.5 * k); });
    ctx.restore(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * k; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
    if (aer) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x + S - 41 * k, y + 10 * k, 30 * k, 62 * k); }
    root.GA.pages.northArrow(ctx, x + S - 26 * k, y + 18 * k, 1.2 * k);
    // scale bar 0–10–20–50 m
    // (the plate goes to the first corner where it hides neither end of the section nor a dead end: bottom-left, bottom-right, top-left)
    const m50 = 50 / mpp, pw = m50 + 46 * k, ph = 30 * k, spots = [[x + 10 * k, y + S - 10 * k - ph], [x + S - 10 * k - pw, y + S - 10 * k - ph], [x + 10 * k, y + 10 * k]];
    const hides = ([px, py]) => [sa, sb].concat(A.dead).some(q => { const u = X(q[0]), v = Y(q[1]); return u > px - 14 * k && u < px + pw + 14 * k && v > py - 14 * k && v < py + ph + 14 * k; });
    const spot = spots.find(q => !hides(q)) || spots[0], bx = spot[0] + 6 * k, by = spot[1] + 20 * k; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 6 * k, by - 20 * k, pw, ph); ctx.fillStyle = pal.ink;
    [[0, 10], [20, 30], [40, 50]].forEach(([a, b]) => ctx.fillRect(bx + a / mpp, by, (b - a) / mpp, 5 * k)); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, m50, 5 * k);
    ctx.font = font(9.5, 500); ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.textBaseline = 'alphabetic'; ['0', '10', '20', '50 m'].forEach((s0, i) => ctx.fillText(s0, bx + [0, 10, 20, 50][i] / mpp, by - 4 * k));
    return true;
  }
  // key map: the base and its fence (as map 01) with the eight 1:500 windows
  function drawAreaKey(ctx, x, y, w, h, o) { o = o || {}; if (!D || !AR) return false; const pal = P(); const t = o.t || ((s) => s); const k = o.k || w / 1000; const F = root.GA.pages.font();
    drawCity(ctx, x, y, w, h, { t, only: 'island', k }); const E = CITY, mpp = (E.x1 - E.x0) / w; const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp;
    AR.areas.forEach(a => { const e = a.extent; ctx.fillStyle = 'rgba(153,43,42,.18)'; ctx.fillRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp); ctx.strokeStyle = pal.red; ctx.lineWidth = 2.4 * k; ctx.strokeRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp);
      const below = AR.areas.some(b => b !== a && Math.abs(b.centre[0] - a.centre[0]) < 250 && b.centre[1] > a.centre[1] && b.centre[1] - a.centre[1] < 320);   // another window just north: this letter goes under its square
      const cx = X((e[0] + e[2]) / 2), cy = below ? Y(e[1]) + 14 * k : Y(e[3]) - 14 * k; ctx.beginPath(); ctx.arc(cx, cy, 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = `700 ${Math.round(12 * k)}px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.fillText(a.id, cx, cy + 0.5 * k); });
    return true; }
  // legend of the key map: map 01's legend plus the 1:500 window
  function keyLegend(t) { const pal = P(); return mapLegend('island', t).concat([{ sw: pal.red, alpha: 0.18, stroke: pal.red, label: t('x34.lg.window') }]); }
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
  function mapLegend(only, t) { const C = P().ex21, want = ONLY[only] || []; const out = [];
    if (want.includes('base')) out.push({ sw: C.base, label: t('x34.lg.base') });
    if (want.includes('band')) out.push({ hatch: C.bandLine, label: t('x34.lg.band') });
    if (want.includes('fence')) Object.keys(C.fence).forEach(c => out.push({ line: C.fence[c], w: 3, label: t('x34.lg.fence.' + c) }));
    if (want.includes('route')) out.push({ line: C.route, w: 2, dash: true, label: t('x34.lg.route') }, { line: C.straight, w: 1, dash: true, label: t('x34.lg.straight') });
    if (want.includes('dead')) out.push({ line: C.dead, w: 2, sym: 'dead', label: t('x34.lg.dead') });
    if (want.includes('metro')) out.push({ line: C.metro, w: 4, label: t('x34.lg.l1') }, { line: C.metro, w: 4, rail: true, label: t('x34.lg.metro') });
    if (want.includes('muni')) out.push({ line: C.muni, dash: true, w: 1, label: t('x34.lg.muni2') });
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
    o = o || {}; if (!FD) return false; const pal = P(), C = pal.ex21, FC = pal.ex21f; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const E = FD.frame, mpp = (E[2] - E[0]) / w, k = o.k || w / 1000;
    const X = (u) => x + (u - E[0]) / mpp, Y = (v) => y + (E[3] - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`; const on = (n) => o.only === n;
    const poly = (rs) => { ctx.beginPath(); rs.forEach(pg => pg.forEach(r => { r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))); ctx.closePath(); })); };
    const line = (rs) => { ctx.beginPath(); rs.forEach(pg => pg.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))))); };
    const halo = (s0, px, py, col, sz, wt, al) => { ctx.font = font(sz, wt); ctx.textAlign = al || 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.6 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(s0, px, py); ctx.fillStyle = col; ctx.fillText(s0, px, py); };
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // o.aerial = the PNOA photo of the whole frame (as served): only the two outlines, the names, north and scale go over it
    const aer = o.aerial || null; if (aer) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(aer, x, y, w, h); }
    // 1 the land around (its own map): OSM land use and solar plants; white = not mapped in OSM
    if (on('land') && !aer) FD.landuse.forEach(l => { poly(l.r); ctx.fillStyle = FC.land[l.c] || pal.grey3; ctx.globalAlpha = l.c === 'solar' ? 0.9 : 0.75; ctx.fill('evenodd'); ctx.globalAlpha = 1; });
    // 2 the estate's ground
    if (!aer) { poly(FD.estate.r); ctx.fillStyle = FC.estate; ctx.globalAlpha = on('land') ? 0.5 : 1; ctx.fill('evenodd'); ctx.globalAlpha = 1; }
    // 3 municipal boundaries
    if (!aer) { ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = C.muni; ctx.lineWidth = 1.1 * k; FD.muni.forEach(m => { line(m.r); ctx.stroke(); }); ctx.setLineDash([]); }
    // 4 named plots by kind (map 01)
    if (on('estate')) FD.plots.forEach(q => { const c = FC.kind[q.k] || FC.kind.industry; poly(q.r); ctx.fillStyle = c; ctx.globalAlpha = 0.4; ctx.fill('evenodd'); ctx.globalAlpha = 1; ctx.strokeStyle = c; ctx.lineWidth = 1.2 * k; ctx.stroke(); });
    // 5 streets and roads (OSM)
    const sw = { main: on('access') ? 3.6 : 1.8, street: 1, service: 0.7, track: 0.6 };
    if (!aer) ['track', 'service', 'street', 'main'].forEach(c => { ctx.strokeStyle = c === 'main' && on('access') ? C.town : C.street; ctx.lineWidth = sw[c] * k; ctx.setLineDash(c === 'track' ? [3 * k, 3 * k] : []); ctx.beginPath();
      FD.streets.forEach(st => { if (st.c !== c) return; st.r.forEach(pg => pg.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))))); }); ctx.stroke(); }); ctx.setLineDash([]);
    // 6 buildings (Catastro): solid on map 01, by period of construction on map 04, light context on the others
    if (!aer) FD.buildings.forEach(b => { poly(b.r); if (on('time')) { const pc = fper(b.y); ctx.fillStyle = pc ? FC.period[pc] : pal.grey3; } else ctx.fillStyle = on('estate') ? pal.ink : C.built; ctx.fill('evenodd'); });
    // 7 the estate's outline and the village's outline (OSM)
    if (aer) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5 * k; poly(FD.estate.r); ctx.stroke(); poly(FD.village.r); ctx.stroke(); }
    poly(FD.estate.r); ctx.strokeStyle = FC.estateLine; ctx.lineWidth = 2.2 * k; ctx.stroke();
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
    halo(t('x35.estate').toUpperCase(), X(ec[0]), Y(ec[1]), FC.estateLine, 15, 700); halo(t('x35.estate.sub', { ha: km2(es.ha), n: es.buildings, b: km2(es.footprint_ha), p: es.built_share_pct.toFixed(1) }), X(ec[0]), Y(ec[1]) + 17 * k, FC.estateLine, 10.5, 500);
    halo(vi.nm.toUpperCase(), X(vc[0]), Y(vc[1]), FC.village, 15, 700); halo(t('x35.village.sub', { pop: vi.pop, y: vi.pop_year, d: vi.dwellings, n: vi.buildings, b: km2(vi.footprint_ha) }), X(vc[0]), Y(vc[1]) + 17 * k, FC.village, 10.5, 500);
    ctx.restore(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * k; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // corner box (top-left): map 02 the southern axis, map 04 built area per decade
    if (on('access')) drawAxisInset(ctx, x + 14 * k, y + 14 * k, 300 * k, 215 * k, k, t, font);
    if (on('time')) drawDecades(ctx, x + 14 * k, y + 14 * k, 300 * k, 190 * k, k, t, font);
    root.GA.pages.northArrow(ctx, x + w - 28 * k, y + 20 * k, 1.3 * k);
    const km = 1000 / mpp, bx = x + 22 * k, by = y + h - 24 * k; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 8 * k, by - 22 * k, km + 60 * k, 34 * k);
    ctx.fillStyle = pal.ink; ctx.fillRect(bx, by, km / 2, 5 * k); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, km, 5 * k); ctx.font = font(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
    ctx.fillText('0', bx, by - 5 * k); ctx.fillText('500', bx + km / 2, by - 5 * k); ctx.fillText('1 km', bx + km, by - 5 * k);
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
    ctx.font = font(9.5, 700); ctx.fillStyle = pal.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t('x35.inset.title', { km: FD.gap_metro_km }), x + 8 * k, y + 15 * k, w - 16 * k);
    ctx.font = font(8, 500); ctx.fillStyle = pal.ink2; ctx.fillText(t('x35.inset.sub'), x + 8 * k, y + 28 * k, w - 16 * k); }
  // map 04's corner box: built footprint per decade (Catastro), village and estate
  function drawDecades(ctx, x, y, w, h, k, t, font) { const pal = P(), FC = pal.ex21f; const v = FD.village.footprint_by_decade_m2, e = FD.estate.footprint_by_decade_m2; const decs = []; for (let d = 1880; d <= 2020; d += 10) decs.push(d);
    const val = (o2, d) => (o2[String(d)] || 0); const vmax = Math.max(...decs.map(d => val(v, d) + val(e, d))); const top = 36 * k, bot = 22 * k, pl = 34 * k, pr = 8 * k; const bw = (w - pl - pr) / decs.length, H = h - top - bot;
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = pal.line2; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = font(9.5, 700); ctx.fillStyle = pal.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(t('x35.dec.title'), x + 8 * k, y + 15 * k, w - 16 * k); ctx.font = font(8, 500); ctx.fillStyle = pal.ink2; ctx.fillText(t('x35.dec.sub'), x + 8 * k, y + 28 * k, w - 16 * k);
    decs.forEach((d, i) => { const bx = x + pl + i * bw, hv = val(v, d) / vmax * H, he = val(e, d) / vmax * H; const by = y + top + H; ctx.fillStyle = FC.village; ctx.fillRect(bx + 1 * k, by - hv, bw - 2 * k, hv); ctx.fillStyle = FC.route; ctx.fillRect(bx + 1 * k, by - hv - he, bw - 2 * k, he);
      if (d % 20 === 0) { ctx.font = font(7.5, 500); ctx.fillStyle = pal.ink2; ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.fillText(String(d), bx + bw / 2, by + 11 * k); } });
    ctx.strokeStyle = pal.ink3; ctx.lineWidth = 0.8 * k; ctx.beginPath(); ctx.moveTo(x + pl, y + top + H); ctx.lineTo(x + w - pr, y + top + H); ctx.stroke();
    ctx.font = font(7.5, 500); ctx.fillStyle = pal.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; const ha = vmax / 1e6; [0, 0.5, 1].forEach(f => ctx.fillText((ha * f).toFixed(f ? 2 : 0) + (f === 1 ? ' km²' : ''), x + pl - 3 * k, y + top + H - f * H));
    ctx.restore(); }
  function factoryLegend(only, t) { if (!FD) return []; const pal = P(), C = pal.ex21, FC = pal.ex21f; const out = [{ sw: FC.estate, stroke: FC.estateLine, label: t('x35.lg.estate', { ha: km2(FD.estate.ha) }) }, { line: FC.village, w: 2, dots: true, label: t('x35.lg.village', { ha: km2(FD.village.ha) }) }];
    if (only === 'estate') { FKIND.filter(c => FD.plots.some(q => q.k === c)).forEach(c => out.push({ sw: FC.kind[c], alpha: 0.4, stroke: FC.kind[c], label: t('x35.lg.kind.' + c) }));
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
  function drawFactoryKey(ctx, x, y, w, h, o) { o = o || {}; if (!FD || !AR) return false; const pal = P(); const k = o.k || w / 1000; const F = root.GA.pages.font(); drawFactory(ctx, x, y, w, h, { t: o.t, only: 'estate', k, noPlotNames: true, aerial: o.aerial });
    const E = FD.frame, mpp = (E[2] - E[0]) / w; const X = (u) => x + (u - E[0]) / mpp, Y = (v) => y + (E[3] - v) / mpp;
    AR.areas.forEach(a => { const e = a.extent; ctx.fillStyle = 'rgba(153,43,42,.18)'; ctx.fillRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp); ctx.strokeStyle = pal.red; ctx.lineWidth = 2.4 * k; ctx.strokeRect(X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp);
      const cx = X((e[0] + e[2]) / 2), cy = Y(e[3]) - 14 * k; ctx.beginPath(); ctx.arc(cx, cy, 11 * k, 0, 7); ctx.fillStyle = pal.red; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = `700 ${Math.round(12 * k)}px ${F}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.fillText(a.id, cx, cy + 0.5 * k); });
    return true; }
  // ---------- THE BASE OVER TIME (owner request, 15 Nov 2026): growth, crowding, possible growth (tools/build_ex21_time.py) ----------
  let TD = null, TDp = null;
  function readyTime() { if (TDp) return TDp; const v = '?v=' + (root.GA_BUILD || ''); const img = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(u)); i.src = u + v; });
    TDp = Promise.all([fetch('data/ex21/time.json' + v).then(r => r.json()), img('data/ex21/built_period.png'), img('data/ex21/density.png'), img('data/ex21/edge_land.png')])
      .then(([j, bp, de, el]) => (TD = Object.assign(j, { img: { built: bp, density: de, edge: el } }))).catch(e => { TDp = null; throw e; }); return TDp; }
  // o.only = 'built' | 'density' | 'edge' | 'photo' (o.photo = a historical image of the same frame); the base is drawn as today's outline
  function drawTime(ctx, x, y, w, h, o) {
    o = o || {}; if (!D || !TD) return false; const pal = P(), C = pal.ex21; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const E = CITY, mpp = (E.x1 - E.x0) / w, k = o.k || w / 1000;
    const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.closePath(); };
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const photo = o.only === 'photo';
    if (photo && o.photo) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(o.photo, x, y, w, h); }
    const base = D.edge.find(f => f.p.k === 'base');
    if (!photo) {
      ctx.strokeStyle = C.street; ctx.lineWidth = 0.7 * k; ctx.beginPath(); D.streets.forEach(s0 => s0.g.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))))); ctx.stroke();
      if (o.only === 'built') { ctx.imageSmoothingEnabled = true; ctx.drawImage(TD.img.built, x, y, w, h); }
      else { ctx.fillStyle = C.built; D.builds.forEach(rs => { path(rs); ctx.fill(); }); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 0.85; ctx.drawImage(o.only === 'edge' ? TD.img.edge : TD.img.density, x, y, w, h); ctx.globalAlpha = 1; }
      ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = C.muni; ctx.lineWidth = 1.1 * k; D.area.forEach(a => { path(a.g); ctx.stroke(); }); ctx.setLineDash([]);
    }
    if (base) { if (photo) { path(base.g); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4.4 * k; ctx.stroke(); path(base.g); ctx.strokeStyle = pal.red; ctx.lineWidth = 2 * k; ctx.setLineDash([8 * k, 5 * k]); ctx.stroke(); ctx.setLineDash([]); }
      else { path(base.g); ctx.fillStyle = C.base; ctx.fill(); } }
    // town names (and the base) — on photos with a white halo
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
    D.edge.filter(f => f.p.k === 'town').forEach(f => { const [u, v] = f.g; ctx.font = font(photo ? 13 : 15, 700); ctx.lineWidth = 4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(f.p.nm.toUpperCase(), X(u), Y(v) - 8 * k); ctx.fillStyle = C.town; ctx.fillText(f.p.nm.toUpperCase(), X(u), Y(v) - 8 * k); });
    if (base && !photo) { const rx = X((D.runway[0][0] + D.runway[1][0]) / 2), ry = Y((D.runway[0][1] + D.runway[1][1]) / 2); ctx.fillStyle = '#FFFFFF'; ctx.font = font(14, 700); ctx.fillText(t('x34.base').toUpperCase(), rx - 60 * k, ry); }
    ctx.restore(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * k; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (!o.noNorth) { if (photo) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x + w - 44 * k, y + 8 * k, 32 * k, 56 * k); } root.GA.pages.northArrow(ctx, x + w - 28 * k, y + 20 * k, 1.3 * k); }
    if (!o.noScale) { const km = 1000 / mpp, bx = x + 22 * k, by = y + h - 24 * k; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 8 * k, by - 22 * k, km + 60 * k, 34 * k);
      ctx.fillStyle = pal.ink; ctx.fillRect(bx, by, km / 2, 5 * k); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, km, 5 * k); ctx.font = font(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
      ctx.fillText('0', bx, by - 5 * k); ctx.fillText('500', bx + km / 2, by - 5 * k); ctx.fillText('1 km', bx + km, by - 5 * k); }
    return true;
  }
  const TFIVE = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares'];
  const tcol = () => { const p = P(); return { 'Armilla': p.ex21.metro, 'Churriana de la Vega': p.red, 'Las Gabias': p.base.olive, 'Alhendín': p.base.khaki, 'Ogíjares': p.base.burgundy, 'Granada': p.ink3 }; };
  // chart: dwellings in today's buildings by decade of construction, the five towns stacked (Catastro)
  function drawDwellChart(ctx, x, y, w, h, o) { o = o || {}; const pal = P(), t = o.t || ((s) => s), k = o.k || 1, F = root.GA.pages.font(), font = (sz, wt) => `${wt || 500} ${Math.round(sz * k)}px ${F}`, col = tcol();
    const decs = []; for (let d = 1900; d <= 2020; d += 10) decs.push(d); const val = (tn, d) => d === 1900 ? Object.entries(TD.towns[tn].dwellings_by_decade).filter(([q]) => +q < 1910).reduce((a, [, v]) => a + v, 0) : (TD.towns[tn].dwellings_by_decade[String(d)] || 0);
    const tot = decs.map(d => TFIVE.reduce((a, tn) => a + val(tn, d), 0)); const vmax = Math.max(...tot) * 1.08; const pl = 46 * k, pb = 22 * k, pt = 10 * k; const bw = (w - pl) / decs.length, H = h - pb - pt;
    ctx.save(); ctx.font = font(9); ctx.fillStyle = pal.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
    for (let v = 0; v <= vmax; v += 2000) { const yy = y + pt + H - v / vmax * H; ctx.beginPath(); ctx.moveTo(x + pl, yy); ctx.lineTo(x + w, yy); ctx.stroke(); ctx.fillText(v.toLocaleString('en-US'), x + pl - 5 * k, yy); }
    decs.forEach((d, i) => { let acc = 0; const bx = x + pl + i * bw; TFIVE.forEach(tn => { const v = val(tn, d); const hh = v / vmax * H; ctx.fillStyle = col[tn]; ctx.fillRect(bx + 2 * k, y + pt + H - acc - hh, bw - 4 * k, hh); acc += hh; });
      ctx.fillStyle = pal.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = font(8.5); ctx.fillText(d === 1900 ? '<1910' : d + 's', bx + bw / 2, y + pt + H + 5 * k); });
    ctx.restore(); }
  // chart: residents 1996–2025 (INE) per town, and the scenario "the pace of 2015–2025 continues" to 2045 (dashed)
  function drawPopChart(ctx, x, y, w, h, o) { o = o || {}; const pal = P(), k = o.k || 1, F = root.GA.pages.font(), font = (sz, wt) => `${wt || 500} ${Math.round(sz * k)}px ${F}`, col = tcol();
    const y0 = 1996, y1 = o.noProj ? 2025 : 2045; const vmax = Math.max(...TFIVE.map(tn => o.noProj ? TD.population[tn]['2025'] : TD.projection[tn]['2045'])) * 1.1; const pl = 46 * k, pb = 22 * k, pt = 10 * k, pr = 90 * k; const W2 = w - pl - pr, H = h - pb - pt;
    const X2 = (yr) => x + pl + (yr - y0) / (y1 - y0) * W2, Y2 = (v) => y + pt + H - v / vmax * H;
    ctx.save(); ctx.font = font(9); ctx.fillStyle = pal.ink2; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
    for (let v = 0; v <= vmax; v += 5000) { ctx.beginPath(); ctx.moveTo(x + pl, Y2(v)); ctx.lineTo(x + pl + W2, Y2(v)); ctx.stroke(); ctx.fillText(v.toLocaleString('en-US'), x + pl - 5 * k, Y2(v)); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; for (let yr = 2000; yr <= y1; yr += 5) ctx.fillText(String(yr), X2(yr), y + pt + H + 5 * k);
    if (!o.noProj) { ctx.fillStyle = 'rgba(201,216,223,.35)'; ctx.fillRect(X2(2025), y + pt, X2(y1) - X2(2025), H); }
    TFIVE.forEach(tn => { const p = TD.population[tn]; const yrs = Object.keys(p).map(Number).sort((a, b) => a - b); ctx.strokeStyle = col[tn]; ctx.lineWidth = 2.6 * k; ctx.beginPath(); yrs.forEach((yr, i) => i ? ctx.lineTo(X2(yr), Y2(p[yr])) : ctx.moveTo(X2(yr), Y2(p[yr]))); ctx.stroke();
      let ly = p['2025'], lx = X2(2025); if (!o.noProj) { const q = TD.projection[tn]; ctx.setLineDash([6 * k, 4 * k]); ctx.beginPath(); ctx.moveTo(X2(2025), Y2(p['2025'])); ctx.lineTo(X2(2035), Y2(q['2035'])); ctx.lineTo(X2(2045), Y2(q['2045'])); ctx.stroke(); ctx.setLineDash([]); ly = q['2045']; lx = X2(2045); }
      ctx.fillStyle = col[tn]; ctx.font = font(9.5, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(tn.replace(' de la Vega', '') + ' ' + Math.round(ly / 1000 * 10) / 10 + 'k', lx + 6 * k, Y2(ly)); });
    ctx.restore(); }
  function timeLegend(only, t) { const pal = P(), C = pal.ex21; const out = [{ sw: C.base, label: t('x34.lg.base') }];
    if (only === 'built') TD.periods.forEach(([key, a, b, c]) => out.push({ sw: `rgb(${c.join(',')})`, label: t('x36.per.' + key) }));
    if (only === 'density') TD.density_breaks.forEach(([a, b], i) => out.push({ sw: `rgb(${TD.density_colours[i].join(',')})`, alpha: 0.85, label: b > 1e8 ? t('x36.dens.top', { a: (a * 100).toLocaleString('en-US') }) : t('x36.dens', { a: (a * 100).toLocaleString('en-US'), b: (b * 100).toLocaleString('en-US') }) }));
    if (only === 'edge') ['free', '30-60', '15-30', '0-15'].forEach(c => out.push({ sw: `rgb(${TD.edge_colours[c].join(',')})`, alpha: 0.85, label: t('x36.edge.' + c, { ha: km2(TD.edge_ha[c] || 0) }) }));
    if (only !== 'built') out.push({ sw: C.built, label: t('x34.lg.built') });
    out.push({ line: C.muni, dash: true, w: 1, label: t('x35.lg.muni') }); return out; }
  // ---------- WHO LIVES AROUND THE BASE (owner request, 16 Nov 2026): INE census sections (ADRH 2024) and the census by town ----------
  let PD = null, PDp = null;
  function readyPeople() { if (PDp) return PDp; PDp = fetch('data/ex21/people.json?v=' + (root.GA_BUILD || '')).then(r => r.json()).then(j => (PD = j)).catch(e => { PDp = null; throw e; }); return PDp; }
  // fixed class breaks per indicator (5 classes, js/palette.js choro: light → dark)
  const PBR = { age: [37, 39, 41, 43], u18: [16, 18, 20, 22], o65: [10, 14, 18, 22], es: [90, 93, 95, 96.5], inc: [12000, 13000, 14000, 16000], one: [22, 26, 30, 34], hh: [2.4, 2.5, 2.6, 2.7] };
  const pcls = (k, v) => { const b = PBR[k]; let i = 0; while (i < b.length && v >= b[i]) i++; return i; };
  function drawPeople(ctx, x, y, w, h, o) {
    o = o || {}; if (!D || !PD) return false; const pal = P(), C = pal.ex21, ramp = pal.choro; const t = o.t || ((s) => s); const F = root.GA.pages.font(); const E = CITY, mpp = (E.x1 - E.x0) / w, k = o.k || w / 1000; const key = o.only || 'age';
    const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp; const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs) => { ctx.beginPath(); rs.forEach(r => r.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1])))); ctx.closePath(); };
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round';
    // the class colour fills each section; the buildings (OSM) are drawn darker over it, to show where in the section people live
    PD.sections.forEach(sc => { const v = sc[key]; sc.r.forEach(pg => { path(pg); if (v == null) { ctx.fillStyle = '#FFFFFF'; ctx.fill(); } else { ctx.globalAlpha = 0.85; ctx.fillStyle = ramp[pcls(key, v)]; ctx.fill(); ctx.globalAlpha = 1; } ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.9 * k; ctx.stroke(); }); });
    ctx.globalAlpha = 0.22; ctx.fillStyle = pal.ink; D.builds.forEach(rs => { path(rs); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = pal.ink3; ctx.lineWidth = 1.1 * k; D.area.forEach(a => { path(a.g); ctx.stroke(); }); ctx.setLineDash([]);
    const base = D.edge.find(f => f.p.k === 'base'); if (base) { path(base.g); ctx.fillStyle = C.base; ctx.fill(); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
    D.edge.filter(f => f.p.k === 'town').forEach(f => { const [u, v] = f.g; ctx.font = font(o.small ? 11 : 15, 700); ctx.lineWidth = 4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(f.p.nm.toUpperCase(), X(u), Y(v) - 8 * k); ctx.fillStyle = C.town; ctx.fillText(f.p.nm.toUpperCase(), X(u), Y(v) - 8 * k); });
    if (base && !o.small) { const rx = X((D.runway[0][0] + D.runway[1][0]) / 2), ry = Y((D.runway[0][1] + D.runway[1][1]) / 2); ctx.fillStyle = '#FFFFFF'; ctx.font = font(14, 700); ctx.fillText(t('x34.base').toUpperCase(), rx - 60 * k, ry); }
    ctx.restore(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * k; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (!o.small) { root.GA.pages.northArrow(ctx, x + w - 28 * k, y + 20 * k, 1.3 * k);
      const km = 1000 / mpp, bx = x + 22 * k, by = y + h - 24 * k; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 8 * k, by - 22 * k, km + 60 * k, 34 * k);
      ctx.fillStyle = pal.ink; ctx.fillRect(bx, by, km / 2, 5 * k); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, km, 5 * k); ctx.font = font(10, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
      ctx.fillText('0', bx, by - 5 * k); ctx.fillText('500', bx + km / 2, by - 5 * k); ctx.fillText('1 km', bx + km, by - 5 * k); }
    return true;
  }
  function peopleLegend(key, t) { const pal = P(), b = PBR[key], f = (v) => key === 'inc' ? '€' + v.toLocaleString('en-US') : String(v); const u = key === 'age' || key === 'hh' || key === 'inc' ? '' : ' %';
    const lab = [`< ${f(b[0])}${u}`, `${f(b[0])}–${f(b[1])}${u}`, `${f(b[1])}–${f(b[2])}${u}`, `${f(b[2])}–${f(b[3])}${u}`, `≥ ${f(b[3])}${u}`];
    return lab.map((l, i) => ({ sw: pal.choro[i], alpha: 0.85, label: l })); }
  // what the employed residents do (census, by town): 100 % bars, the branch "public administration and defence" first
  const PBRANCH = ['public', 'trade', 'hospitality', 'health', 'education', 'office', 'industry', 'construction', 'transport', 'farming', 'other'];
  function drawBranchBars(ctx, x, y, w, h, o) { o = o || {}; const pal = P(), t = o.t || ((s) => s), k = o.k || 1, F = root.GA.pages.font(), font = (sz, wt) => `${wt || 500} ${Math.round(sz * k)}px ${F}`;
    const cols = { public: pal.ex21.base, trade: pal.red, hospitality: pal.rose, health: pal.blue, education: pal.base.blueGrey, office: pal.base.lightBlue, industry: pal.base.burgundy, construction: pal.base.khaki, transport: pal.base.olive, farming: pal.base.chartreuse, other: pal.grey2 };
    const towns = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares', 'Granada']; const lw = 150 * k, rh = h / towns.length;
    ctx.save(); ctx.direction = 'ltr'; towns.forEach((tn, i) => { const T = PD.towns[tn], tot = PBRANCH.reduce((a, b) => a + (T.branch[b] || 0), 0); const by = y + i * rh; let bx = x + lw;
      ctx.font = font(11, tn === 'Granada' ? 700 : 600); ctx.fillStyle = pal.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(tn === 'Granada' ? t('x37.granada') : tn, x + lw - 8 * k, by + rh * 0.42);
      PBRANCH.forEach(b => { const ww = (T.branch[b] || 0) / tot * (w - lw); ctx.fillStyle = cols[b]; ctx.fillRect(bx, by + rh * 0.12, ww, rh * 0.6); if (ww > 34 * k) { ctx.fillStyle = ['public', 'trade', 'industry', 'transport', 'health'].includes(b) ? '#FFFFFF' : pal.ink; ctx.font = font(9.5, 700); ctx.textAlign = 'center'; ctx.fillText(Math.round((T.branch[b] || 0) / tot * 100) + '%', bx + ww / 2, by + rh * 0.42); } bx += ww; }); });
    ctx.restore(); return PBRANCH.map(b => ({ sw: cols[b], label: t('x37.br.' + b) })); }
  root.GA.ex21 = { ready, readyAreas, readyAerial, loadAerial, aerialLegend, get aerial() { return AER; }, drawArea, drawSection, areaLegend, drawAreaKey, keyLegend, get areas() { return AR; }, drawCity, drawGaps, cityLegend, mapLegend, MAPS: ['island', 'walk', 'growth', 'height'], CITY, get data() { return D; },
    readyFactory, drawFactory, factoryLegend, drawFactoryKey, FMAPS: ['estate', 'access', 'land', 'time'], get factory() { return FD; }, km2,
    readyTime, drawTime, drawDwellChart, drawPopChart, timeLegend, get time() { return TD; }, TFIVE, tcol,
    readyPeople, drawPeople, peopleLegend, drawBranchBars, get people() { return PD; } };
})(window);
