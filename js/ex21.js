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
      fetch('data/ex21/easements.json' + v).then(r => r.json()), img('data/ex21/allowed_height.png')])
      .then(([edge, area, metro, bld, streets, ease, hImg]) => { const U = (p) => prj.forward(p);
        const rings = (g) => g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
        const proj = (f) => rings(f.geometry).map(r => r.map(U));
        const seen = new Set(); const builds = []; bld.forEach(f => { const id = (f.properties || {}).id; if (id && seen.has(id)) return; seen.add(id); builds.push(proj(f)); });
        return (D = { edge: edge.features.map(f => ({ p: f.properties, g: f.geometry.type === 'Point' ? U(f.geometry.coordinates) : proj(f) })), area: area.features.map(f => ({ p: f.properties, g: proj(f) })),
          metro: metro.features.map(f => ({ p: f.properties, g: f.geometry.type === 'Point' ? U(f.geometry.coordinates) : proj(f) })), builds, streets: (streets.features || streets).map(f => ({ p: f.properties, g: proj(f) })), ease, hImg, runway: RUNWAY.map(U) }); })
      .catch(e => { Dp = null; throw e; });
    return Dp;
  }
  function drawCity(ctx, x, y, w, h, o) {
    o = o || {}; if (!D) return false; const pal = P(), C = pal.ex21, T = pal.tour; const E = CITY, mpp = (E.x1 - E.x0) / w, k = o.k || w / 1000;
    const X = (u) => x + (u - E.x0) / mpp, Y = (v) => y + (E.y1 - v) / mpp; const t = o.t || ((s) => s); const F = root.GA.pages.font();
    const font = (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`;
    const path = (rs, close) => { ctx.beginPath(); rs.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); if (close) ctx.closePath(); };
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // 1 municipal boundaries (dashed); the residents' change 2015 → 2025 is written at each town
    const chg = (v) => { const b = T.chgBreaks; let i = 0; while (i < b.length && v >= b[i]) i++; return T.chg[i]; };
    ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = C.muni; ctx.lineWidth = 1.1 * k; D.area.forEach(a => { path(a.g, true); ctx.stroke(); }); ctx.setLineDash([]);
    // 2 the aeronautical height limits (allowed height above ground < 60 m)
    { const e = D.ease.extent; ctx.save(); ctx.globalAlpha = o.focus != null && o.focus !== 'height' ? 0.25 : 1; ctx.imageSmoothingEnabled = true; ctx.drawImage(D.hImg, X(e[0]), Y(e[3]), (e[2] - e[0]) / mpp, (e[3] - e[1]) / mpp); ctx.restore(); }
    // 3 built footprints and main streets
    ctx.fillStyle = C.built; D.builds.forEach(rs => { path(rs, true); ctx.fill(); });
    ctx.strokeStyle = C.street; ctx.lineWidth = 0.9 * k; ctx.beginPath(); D.streets.forEach(s => s.g.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))))); ctx.stroke();
    // 4 the 300 m band (hatched) and the base as a closed solid with its runway
    const band = D.edge.find(f => f.p.k === 'band'), base = D.edge.find(f => f.p.k === 'base');
    if (band) { ctx.save(); path(band.g, true); ctx.clip('evenodd'); ctx.strokeStyle = C.bandLine; ctx.lineWidth = 0.8 * k; ctx.globalAlpha = 0.7; ctx.beginPath(); for (let q = -h; q < w + h; q += 7 * k) { ctx.moveTo(x + q, y + h); ctx.lineTo(x + q + h, y); } ctx.stroke(); ctx.restore(); }
    if (base) { path(base.g, true); ctx.fillStyle = C.base; ctx.fill(); ctx.strokeStyle = C.baseLine; ctx.lineWidth = 1.4 * k; ctx.stroke();
      ctx.strokeStyle = C.runway; ctx.lineWidth = 3.2 * k; ctx.setLineDash([10 * k, 6 * k]); ctx.beginPath(); ctx.moveTo(X(D.runway[0][0]), Y(D.runway[0][1])); ctx.lineTo(X(D.runway[1][0]), Y(D.runway[1][1])); ctx.stroke(); ctx.setLineDash([]); }
    // 5 the fence by what lies outside it
    D.edge.filter(f => f.p.k === 'fence').forEach(f => { ctx.strokeStyle = C.fence[f.p.c] || C.baseLine; ctx.lineWidth = 4.2 * k; path(f.g); ctx.stroke(); });
    // 6 walking detours vs the straight line, dead ends
    D.edge.filter(f => f.p.k === 'straight').forEach(f => { ctx.strokeStyle = C.straight; ctx.lineWidth = 1.2 * k; ctx.setLineDash([3 * k, 4 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]); });
    D.edge.filter(f => f.p.k === 'route').forEach(f => { ctx.strokeStyle = C.route; ctx.lineWidth = 2.6 * k; ctx.setLineDash([9 * k, 4 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]);
      const r = f.g[0], m = r[Math.floor(r.length * 0.62)]; const lab = `${(f.p.walk_m / 1000).toFixed(1)} km  ×${f.p.ratio.toFixed(2)}`; ctx.font = font(10.5, 700); ctx.lineWidth = 3.2 * k; ctx.strokeStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(lab, X(m[0]), Y(m[1]) - 10 * k); ctx.fillStyle = C.route; ctx.fillText(lab, X(m[0]), Y(m[1]) - 10 * k); });
    D.edge.filter(f => f.p.k === 'deadend').forEach(f => { const [u, v] = Array.isArray(f.g[0]) ? f.g[0][0] : f.g; ctx.beginPath(); ctx.arc(X(u), Y(v), 4.2 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.dead; ctx.lineWidth = 2 * k; ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(u) - 2.4 * k, Y(v)); ctx.lineTo(X(u) + 2.4 * k, Y(v)); ctx.stroke(); });
    // 7 the metro extension under construction, with its two ends
    D.metro.forEach(f => { if (f.p.k === 'track') { ctx.strokeStyle = C.metro; ctx.lineWidth = 6 * k; path(f.g); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.2 * k; ctx.setLineDash([7 * k, 7 * k]); path(f.g); ctx.stroke(); ctx.setLineDash([]); }
      else { ctx.beginPath(); ctx.arc(X(f.g[0]), Y(f.g[1]), 6 * k, 0, 7); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = C.metro; ctx.lineWidth = 2.6 * k; ctx.stroke(); } });
    // 8 labels: towns with their change 2015 → 2025, the base
    const towns = D.edge.filter(f => f.p.k === 'town'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    towns.forEach(f => { const a = D.area.find(m => m.p.name === f.p.nm); const [u, v] = f.g; const px = X(u), py = Y(v);
      ctx.font = font(15, 700); ctx.lineWidth = 4 * k; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText(f.p.nm.toUpperCase(), px, py - 8 * k); ctx.fillStyle = C.town; ctx.fillText(f.p.nm.toUpperCase(), px, py - 8 * k);
      if (a) { const s = (a.p.chg > 0 ? '+' : '') + a.p.chg.toFixed(1) + ' %'; ctx.font = font(12, 600); ctx.strokeText(s + ' · 2015→2025', px, py + 9 * k); ctx.fillStyle = C.town; ctx.fillText(s + ' · 2015→2025', px, py + 9 * k); } });
    if (base) { const rx = X((D.runway[0][0] + D.runway[1][0]) / 2) - 26 * k, ry = Y((D.runway[0][1] + D.runway[1][1]) / 2); ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF'; ctx.font = font(15, 700); ctx.fillText(t('x34.base').toUpperCase(), rx, ry); ctx.font = font(11, 500); ctx.fillText(`${base.p.area_ha} ha · ${base.p.perimeter_km} km`, rx, ry + 17 * k); ctx.textAlign = 'center'; }
    // frame, north, scale
    ctx.restore(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * k; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    root.GA.pages.northArrow(ctx, x + w - 28 * k, y + 20 * k, 1.3 * k);
    const km = 1000 / mpp, bx = x + 22 * k, by = y + h - 24 * k; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 8 * k, by - 22 * k, km + 60 * k, 34 * k);
    ctx.fillStyle = pal.ink; ctx.fillRect(bx, by, km / 2, 5 * k); ctx.strokeStyle = pal.ink; ctx.lineWidth = 1 * k; ctx.strokeRect(bx, by, km, 5 * k); ctx.font = font(10, 500); ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText('0', bx, by - 5 * k); ctx.fillText('500', bx + km / 2, by - 5 * k); ctx.fillText('1 km', bx + km, by - 5 * k);
    return true;
  }
  function cityLegend(t) { const C = P().ex21, T = P().tour;
    return [{ sw: C.base, label: t('x34.lg.base') }, { hatch: C.bandLine, label: t('x34.lg.band') }]
      .concat(Object.keys(C.fence).map(c => ({ line: C.fence[c], w: 3, label: t('x34.lg.fence.' + c) })))
      .concat([{ line: C.route, w: 2, dash: true, label: t('x34.lg.route') }, { line: C.dead, w: 2, label: t('x34.lg.dead') }, { line: C.metro, w: 4, rail: true, label: t('x34.lg.metro') }])
      .concat(Object.keys(C.height).map(c => ({ sw: C.height[c], label: t('x34.lg.h.' + c) })))
      .concat([{ sw: C.built, label: t('x34.lg.built') }, { line: C.muni, dash: true, w: 1, label: t('x34.lg.muni2') }]); }
  root.GA.ex21 = { ready, drawCity, cityLegend, CITY, get data() { return D; } };
})(window);
