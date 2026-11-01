/* Sections: user-drawn section lines (A → optional intermediate vertices → B), several per
   study area, each with its own id and name. The profile samples the IGN MDT25 terrain
   (25 m, bilinear) along the line; buildings crossed by the line are placed on the terrain.
   Heights: OSM `height` is used as reported; otherwise building:levels × floor height is an
   explicit estimate; buildings with neither stay "unknown" (no invented height, roof or
   facade). Buildings near the line but not cut are drawn as a lighter background. */
(function (root) {
  const { geo: G, proj: PJ, data: D, palette: P, i18n: I } = root.GA;
  const t = (k, v) => I.t(k, v);
  const U = (c) => PJ.EPSG25830.forward(c);
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d });
  const LETTERS = (n) => Array.from({ length: n }, (_, i) => i === 0 ? 'A' : i === n - 1 ? 'B' : String(i));

  // ---------- geometry helpers (EPSG:25830 metres) ----------
  function polyline(ptsLL) {
    const u = ptsLL.map(U); const cum = [0];
    for (let i = 1; i < u.length; i++) cum.push(cum[i - 1] + Math.hypot(u[i][0] - u[i - 1][0], u[i][1] - u[i - 1][1]));
    return { u, cum, L: cum[cum.length - 1] };
  }
  function at(pl, d) { // point at distance d
    let i = 1; while (i < pl.cum.length - 1 && pl.cum[i] < d) i++;
    const a = pl.u[i - 1], b = pl.u[i], s = (d - pl.cum[i - 1]) / Math.max(1e-9, pl.cum[i] - pl.cum[i - 1]);
    return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  }
  function project(pl, p) { // → {d, off} nearest position along the line and perpendicular distance
    let best = { d: 0, off: Infinity };
    for (let i = 1; i < pl.u.length; i++) {
      const a = pl.u[i - 1], b = pl.u[i]; const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1e-9;
      const s = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
      const q = [a[0] + dx * s, a[1] + dy * s]; const off = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (off < best.off) best = { d: pl.cum[i - 1] + s * Math.sqrt(l2), off };
    }
    return best;
  }
  function segX(a, b, c, d) { // intersection parameter along ab with segment cd
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]]; const den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-12) return null;
    const tt = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    return tt >= 0 && tt <= 1 && u >= 0 && u <= 1 ? tt : null;
  }
  function inRings(p, rings) { let inside = false; rings.forEach(R => { let c = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { if ((R[i][1] > p[1]) !== (R[j][1] > p[1]) && p[0] < (R[j][0] - R[i][0]) * (p[1] - R[i][1]) / (R[j][1] - R[i][1]) + R[i][0]) c = !c; } if (c) inside = !inside; }); return inside; }
  const polysOf = (g) => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];

  // ---------- profile computation ----------
  // sec.look: 'left' | 'right' — the side of A→B the viewer looks towards (background drawn on that side only)
  async function compute(sec, opts) {
    opts = opts || {}; const floorH = opts.floorH || 3.0; const look = sec.look === 'right' ? 'right' : 'left';
    // background projection depth (buildings seen beyond the cut), user-adjustable
    const depth = Math.max(10, Math.min(150, +sec.depth || 40));
    const pl = polyline(sec.pts); if (pl.L < 5) throw new Error(t('sec.tooShort'));
    const dem = await D.grid('dem'); const slope = await D.grid('slope').catch(() => null);
    const step = Math.max(2, Math.min(10, pl.L / 500)); const n = Math.ceil(pl.L / step) + 1;
    const dist = [], elev = []; let missing = 0;
    for (let i = 0; i < n; i++) { const d = Math.min(pl.L, i * step); const p = at(pl, d); const v = D.sampleGrid(dem, p[0], p[1]); dist.push(d); elev.push(v); if (v == null) missing++; }
    if (missing === n) { const e = new Error(t('sec.outside')); e.code = 'outside'; throw e; }
    const ev = elev.filter(v => v != null);
    const k = Math.max(1, Math.ceil(25 / step)); let maxG = 0, maxAt = null;
    for (let i = 0; i + k < n; i++) { if (elev[i] == null || elev[i + k] == null) continue; const g = Math.abs(elev[i + k] - elev[i]) / (dist[i + k] - dist[i]); if (g > maxG) { maxG = g; maxAt = dist[i] + (dist[i + k] - dist[i]) / 2; } }
    let hornMax = null; if (slope) for (let i = 0; i < n; i += Math.max(1, Math.round(12 / step))) { const p = at(pl, dist[i]); const v = D.sampleGrid(slope, p[0], p[1], true); if (v != null && (hornMax == null || v > hornMax)) hornMax = v; }
    const ground = (d) => { const i = Math.max(0, Math.min(n - 1, Math.round(d / step))); return elev[i]; };
    // terrain of the cut line, linearly interpolated exactly as the drawn ground line (no rounding to a sample)
    const gAt = (d) => { let i = Math.max(0, Math.min(n - 2, Math.floor(d / step))); const a = elev[i], b = elev[i + 1]; if (a == null) return b; if (b == null) return a; const s = Math.max(0, Math.min(1, (d - dist[i]) / Math.max(1e-9, dist[i + 1] - dist[i]))); return a + (b - a) * s; };
    // the terrain under a cut building, facade to facade: [[d, e], …] (both facades and every DEM sample between)
    const gAlong = (d0, d1) => { const out = [[d0, gAt(d0)]]; for (let i = Math.ceil(d0 / step); i < n && dist[i] < d1; i++) if (dist[i] > d0 && elev[i] != null) out.push([dist[i], elev[i]]); out.push([d1, gAt(d1)]); return out.filter(q => q[1] != null).map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]); };
    // unit normal of the line at distance d pointing to the 'left' of A→B
    const normalAt = (d) => { let i = 1; while (i < pl.cum.length - 1 && pl.cum[i] < d) i++; const a = pl.u[i - 1], b = pl.u[i]; const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / L0, (b[0] - a[0]) / L0]; };
    const demAt = (p) => D.sampleGrid(dem, p[0], p[1]);
    // which side of the line a point lies on (sign of the cross product with the nearest segment)
    const sideOf = (p) => { let best = { off: Infinity, s: 0 }; for (let i = 1; i < pl.u.length; i++) { const a = pl.u[i - 1], b = pl.u[i]; const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy || 1e-9; const tt = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); const q = [a[0] + dx * tt, a[1] + dy * tt]; const off = Math.hypot(p[0] - q[0], p[1] - q[1]); if (off < best.off) best = { off, s: Math.sign(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) }; } return best.s > 0 ? 'left' : 'right'; };

    // buildings
    let feats = []; let bErr = null;
    // only the 1 km building cells along the line's corridor are fetched (works with or without a study area)
    let bCells = null; try { const r = await D.alongLine('buildings', sec.pts, 80); feats = r.features; bCells = { n: r.cells, data: r.cellsWithData }; } catch (e) { bErr = e.message; }
    // coverage of the published building extract along the line (sampled every step)
    let outRegion = 0; for (let i = 0; i < n; i++) { const p = PJ.EPSG25830.inverse(at(pl, dist[i])); if (!D.inRegion(p)) outRegion++; }
    const cuts = [], bg = []; let bgUnknown = 0;
    feats.forEach(f => {
      const pr = f.properties; const hTag = pr.h != null && isFinite(+pr.h) && +pr.h > 0 ? +pr.h : null; const lv = pr.lv != null && isFinite(+pr.lv) && +pr.lv > 0 ? +pr.lv : null;
      const height = hTag != null ? { h: hTag, src: 'height', lv } : lv != null ? { h: lv * floorH, src: 'levels', lv } : { h: null, src: 'unknown' };
      const material = pr.mat || pr['building:material'] || null; // not present in the published extract; kept for imported data
      polysOf(f.geometry).forEach(poly => {
        const rings = poly.map(r => r.map(U)); const ds = [];
        for (let i = 1; i < pl.u.length; i++) rings.forEach(R => { for (let j = 1; j < R.length; j++) { const tt = segX(pl.u[i - 1], pl.u[i], R[j - 1], R[j]); if (tt != null) ds.push(pl.cum[i - 1] + tt * (pl.cum[i] - pl.cum[i - 1])); } });
        if (inRings(pl.u[0], rings)) ds.push(0); if (inRings(pl.u[pl.u.length - 1], rings)) ds.push(pl.L);
        ds.sort((a, b) => a - b); const intervals = [];
        for (let i = 1; i < ds.length; i++) { const a = ds[i - 1], b = ds[i]; if (b - a < 0.3) continue; if (inRings(at(pl, (a + b) / 2), rings)) intervals.push([a, b]); }
        const attrs = { rs: pr.rs || null, rl: pr.rl != null && isFinite(+pr.rl) ? +pr.rl : null, lvu: pr.lvu != null && isFinite(+pr.lvu) ? +pr.lvu : null, hi: pr.hi || null, sd: pr.sd || null };
        // a cut building stands on the terrain of the cut line: its base (ground-floor slab, kept horizontal) is the lowest
        // ground between its two facades, so it meets the terrain at the downhill facade and never floats; on a slope the
        // ground under the uphill part (gnd) is drawn as retained ground — foundation form unknown, MDT25 is 25 m
        if (intervals.length) intervals.forEach(([a, b]) => { const gnd = gAlong(a, b); const es = gnd.map(q => q[1]); const base = es.length ? Math.min(...es) : null;
          cuts.push(Object.assign({ id: pr.id, name: pr.nm || null, type: pr.b, d0: a, d1: b, base, gnd, gRise: es.length ? Math.max(...es) - base : 0, material }, attrs, height)); });
        else {
          const c = rings[0].reduce((s, p) => [s[0] + p[0] / rings[0].length, s[1] + p[1] / rings[0].length], [0, 0]); const pj = project(pl, c);
          if (pj.off > depth) return; if (sideOf(c) !== look) return; if (height.h == null) { bgUnknown++; return; }
          const pjs = rings[0].map(p => project(pl, p)); const ext = pjs.map(q => q.d); const d0 = Math.min(...ext), d1 = Math.max(...ext); if (d1 - d0 < 0.5) return;
          // a background building stands on ITS OWN ground (MDT25 sampled at its footprint), not on the cut line's terrain:
          // gnd is the ground along its face towards the section, drawn under it so a building on higher ground behind the
          // cut reads as standing on that ground instead of floating above the section's terrain line
          const offNear = Math.min(...pjs.map(q => q.off)); const sg = look === 'left' ? 1 : -1; const K = Math.max(2, Math.min(12, Math.ceil((d1 - d0) / 3)));
          const gnd = []; for (let k = 0; k <= K; k++) { const d = d0 + (d1 - d0) * k / K; const p = at(pl, d), nv = normalAt(d); const e = demAt([p[0] + nv[0] * sg * offNear, p[1] + nv[1] * sg * offNear]); if (e != null) gnd.push([+d.toFixed(2), +e.toFixed(2)]); }
          const own = rings[0].concat([c]).map(demAt).filter(v => v != null).concat(gnd.map(q => q[1]));
          const base = own.length ? Math.min(...own) : ground(pj.d); const secMin = Math.min(...[d0, (d0 + d1) / 2, d1].map(gAt).filter(v => v != null));
          bg.push(Object.assign({ id: pr.id, name: pr.nm || null, d0, d1, off: pj.off, base, gnd, gSrc: own.length ? 'own' : 'line', above: isFinite(secMin) ? base - secMin : 0, material }, attrs, height));
        }
      });
    });
    bg.sort((a, b) => b.off - a.off);
    // ground surfaces from mapped data: green areas crossed (parks, grass, woodland), streets and watercourses crossed
    const surf = { green: [], streets: [], water: [] }; let sErr = null; let stFeats = null;
    try {
      const bbL = G.bbox(sec.pts);
      const [st, pk, lu, wa] = stFeats = await Promise.all([D.chunked('streets', bbL, 30, 40).catch(() => []), D.chunked('parks', bbL, 30, 40).catch(() => []), D.chunked('landuse', bbL, 30, 40).catch(() => []), D.single('water').then(j => j.features).catch(() => [])]);
      const inBB = (c) => c[0] >= bbL[0] - 0.003 && c[0] <= bbL[2] + 0.003 && c[1] >= bbL[1] - 0.003 && c[1] <= bbL[3] + 0.003;
      const crossings = (fs, kind) => { const out = []; const seen = new Set(); fs.forEach(f => { const g = f.geometry; const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []; lines.forEach(Lc => { if (!Lc.some(inBB)) return; const C = Lc.map(U); for (let i = 1; i < pl.u.length; i++) for (let j = 1; j < C.length; j++) { const tt = segX(pl.u[i - 1], pl.u[i], C[j - 1], C[j]); if (tt == null) continue; const d = pl.cum[i - 1] + tt * (pl.cum[i] - pl.cum[i - 1]); const key = f.properties.id + ':' + Math.round(d); if (seen.has(key)) continue; seen.add(key); const a1 = Math.atan2(pl.u[i][1] - pl.u[i - 1][1], pl.u[i][0] - pl.u[i - 1][0]), a2 = Math.atan2(C[j][1] - C[j - 1][1], C[j][0] - C[j - 1][0]); out.push({ d, sin: Math.max(0.2, Math.abs(Math.sin(a1 - a2))), p: f.properties, kind }); } }); }); return out; };
      crossings(st, 'street').forEach(c => { const p = c.p; const lanes = p.ln != null && isFinite(parseFloat(p.ln)) ? parseFloat(p.ln) : null; const sideW = /both/.test(p.sw || '') ? 2 : /left|right/.test(p.sw || '') ? 1 : 0;
        const w = lanes ? lanes * 3.0 + sideW * 1.5 : null; surf.streets.push({ id: p.id, key: p.id + ':' + Math.round(c.d), d: c.d, sin: c.sin, span: w ? w / c.sin : null, name: p.nm || null, hw: p.hw, surface: p.sf || null, lanes, sidewalk: p.sw || null, bridge: !!p.br, tunnel: !!p.tu }); });
      surf.water = crossings(wa, 'water').map(c => ({ d: c.d, name: c.p.nm || null, kind: c.p.ww }));
      const GREEN_LU = /^(grass|forest|flowerbed|meadow|orchard|village_green|recreation_ground|allotments)$/;
      pk.concat(lu.filter(f => GREEN_LU.test(f.properties.lu || ''))).forEach(f => polysOf(f.geometry).forEach(poly => { const rings = poly.map(r => r.map(U)); const ds = [];
        for (let i = 1; i < pl.u.length; i++) rings.forEach(R => { for (let j = 1; j < R.length; j++) { const tt = segX(pl.u[i - 1], pl.u[i], R[j - 1], R[j]); if (tt != null) ds.push(pl.cum[i - 1] + tt * (pl.cum[i] - pl.cum[i - 1])); } });
        if (inRings(pl.u[0], rings)) ds.push(0); if (inRings(pl.u[pl.u.length - 1], rings)) ds.push(pl.L); ds.sort((a, b) => a - b);
        for (let i = 1; i < ds.length; i++) { const a = ds[i - 1], b = ds[i]; if (b - a > 0.5 && inRings(at(pl, (a + b) / 2), rings)) surf.green.push({ d0: a, d1: b, name: f.properties.nm || null, kind: f.properties.le || f.properties.lu }); } }));
      surf.streets.sort((a, b) => a.d - b.d);
    } catch (e) { sErr = e.message; }
    // mapped trees: real positions (OSM snapshot) projected onto the line; only inside a disclosed corridor on the viewing
    // side (plus trees standing on the line itself). Recorded height / crown diameter are used when tagged; otherwise the
    // tree is drawn later as a fixed-size schematic symbol, never with an invented size.
    // a tree is 'on the section' when it stands within 1.5 m of the cut line; others are projected from the corridor
    const corridor = Math.max(2, Math.min(60, +sec.corridor || 15)), NEAR = 1.5;
    const trees = []; let tErr = null, treeTs = null, rowsNear = 0;
    if (root.GA.ext) { try {
      const bb = G.bbox(sec.pts); const pad = corridor / 80000; const r = await root.GA.ext.trees([bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad]); treeTs = r.ts;
      const num = (v) => { const x = parseFloat(String(v || '').replace(',', '.')); return isFinite(x) && x > 0 ? x : null; };
      r.pts.forEach(p => { const u = U(p.ll); const pj = project(pl, u); if (pj.d <= 0 || pj.d >= pl.L || pj.off > corridor) return; if (pj.off > 1.5 && sideOf(u) !== look) return;
        const own = pj.off <= NEAR ? null : demAt(u); trees.push({ id: p.id, d: pj.d, off: pj.off, near: pj.off <= NEAR, base: own != null ? own : gAt(pj.d), lineBase: gAt(pj.d), h: num(p.tags.height), crown: num(p.tags.diameter_crown), species: p.tags.species || p.tags.genus || p.tags['species:es'] || null }); });
      r.ways.forEach(w => { const C = w.coords.map(U); let crossed = false;
        for (let i = 1; i < pl.u.length; i++) for (let j = 1; j < C.length; j++) { const tt = segX(pl.u[i - 1], pl.u[i], C[j - 1], C[j]); if (tt != null) { const d = pl.cum[i - 1] + tt * (pl.cum[i] - pl.cum[i - 1]); trees.push({ id: w.id, row: true, d, off: 0, near: true, base: ground(d), h: null, crown: null }); crossed = true; } }
        if (!crossed && C.some(c => { const pj = project(pl, c); return pj.off <= corridor && pj.d > 0 && pj.d < pl.L && sideOf(c) === look; })) rowsNear++; });
    } catch (e) { tErr = e.message; } }
    trees.sort((a, b) => b.off - a.off);
    // street width between building faces, measured along the cut from the OSM footprints (not a surveyed kerb line)
    const cutsS = cuts.slice().sort((a, b) => a.d0 - b.d0);
    const RANK = { motorway: 9, trunk: 9, primary: 8, secondary: 7, tertiary: 6, residential: 5, living_street: 5, unclassified: 5, pedestrian: 4, service: 3, cycleway: 2, path: 2, steps: 2, footway: 1 };
    const byGap = new Map();
    surf.streets.forEach(z => { let fa = null, fb = null; cutsS.forEach(c => { if (c.d1 <= z.d + 0.01 && (fa == null || c.d1 > fa)) fa = c.d1; if (c.d0 >= z.d - 0.01 && (fb == null || c.d0 < fb)) fb = c.d0; });
      if (fa != null && fb != null && fb - fa > 1 && fb - fa < 90) { const k = fa.toFixed(1) + '|' + fb.toFixed(1); const prev = byGap.get(k); if (!prev || (RANK[z.hw] || 0) > (RANK[prev.hw] || 0) || ((RANK[z.hw] || 0) === (RANK[prev.hw] || 0) && z.name && !prev.name)) byGap.set(k, z); z._gapKey = k; } });
    // only the main street of each facade-to-facade gap carries the measured width (side footways and service lanes share it)
    surf.streets.forEach(z => { const m = z._gapKey && byGap.get(z._gapKey); if (m === z) { const p = (k) => k; z.faceA = +z._gapKey.split('|')[0]; z.faceB = +z._gapKey.split('|')[1]; z.gap = z.faceB - z.faceA; } delete z._gapKey; });
    // locator context: footprints and streets around the line (EPSG:25830), drawn as a small north-up plan
    const xsU = pl.u.map(p => p[0]), ysU = pl.u.map(p => p[1]); const padW = Math.max(depth, corridor) + 45;
    const win = [Math.min(...xsU) - padW, Math.min(...ysU) - padW, Math.max(...xsU) + padW, Math.max(...ysU) + padW];
    const inWin = (q) => q[0] >= win[0] && q[0] <= win[2] && q[1] >= win[1] && q[1] <= win[3];
    const ctx = { win, bld: [], st: [] };
    feats.forEach(f => polysOf(f.geometry).forEach(poly => { if (ctx.bld.length > 4000) return; const R = poly[0].map(U); if (R.some(inWin)) ctx.bld.push(R); }));
    if (stFeats && stFeats[0]) stFeats[0].forEach(f => { const g = f.geometry; (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []).forEach(Lc => { const C = Lc.map(U); if (C.some(inWin) && ctx.st.length < 3000) ctx.st.push({ c: C, hw: f.properties.hw }); }); });
    const A0 = PJ.EPSG25830.inverse(pl.u[0]), B0 = PJ.EPSG25830.inverse(pl.u[pl.u.length - 1]);
    const az = (Math.atan2(pl.u[pl.u.length - 1][0] - pl.u[0][0], pl.u[pl.u.length - 1][1] - pl.u[0][1]) * 180 / Math.PI + 360) % 360;
    return { id: sec.id, name: sec.name, pts: sec.pts, L: pl.L, step, dist, elev, min: Math.min(...ev), max: Math.max(...ev), missing,
      maxGrad: maxG, maxGradAt: maxAt, baseline: k * step, hornMax, cuts: cuts.sort((a, b) => a.d0 - b.d0), bg, bgUnknown, trees, tErr, treeTs, corridor, nearTrees: NEAR, rowsNear, surf, sErr, floorH, bErr, look, depth, ctx, coverage: { demMissing: missing / n, outsideRegion: outRegion / n, bCells },
      ref: { a: pl.u[0], b: pl.u[pl.u.length - 1], aLL: A0, bLL: B0, azimuth: az }, vertexD: pl.cum.slice(), computed: new Date().toISOString() };
  }

  // ---------- drawing: one routine, three back-ends (canvas for screen/PNG, SVG and PDF for vector export) ----------
  function canvasPainter(canvas, W, H, ratio) {
    canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio); const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.lineJoin = 'round';
    const style = (o) => { ctx.setLineDash(o.dash || []); ctx.lineWidth = o.lw || 1; ctx.strokeStyle = o.stroke || 'none'; ctx.fillStyle = o.fill || 'none'; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.lineCap = o.cap || 'butt'; };
    const done = (o) => { if (o.fill) ctx.fill(o.evenodd ? 'evenodd' : 'nonzero'); if (o.stroke) ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]); };
    return {
      W, H, measure: (s, f) => { ctx.font = f; return ctx.measureText(s).width; },
      rect(x, y, w, h, o) { style(o); ctx.beginPath(); ctx.rect(x, y, w, h); done(o); },
      path(pts, o) { if (!pts.length) return; style(o); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (o.close) ctx.closePath(); done(o); },
      rings(rs, o) { style(o); ctx.beginPath(); rs.forEach(pts => { pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }); done(o); },
      circle(x, y, r, o) { style(o); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); done(o); },
      text(s, x, y, o) { ctx.font = `${o.weight || 400} ${o.size || 11}px ${o.font}`; ctx.globalAlpha = 1; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'alphabetic'; ctx.direction = o.dir || 'ltr';
        if (o.halo) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.halo; ctx.lineWidth = o.haloW || 3; ctx.setLineDash([]); ctx.strokeText(s, x, y); }
        ctx.fillStyle = o.color || INK; ctx.fillText(s, x, y); ctx.direction = 'ltr'; },
      clip(x, y, w, h) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }, unclip() { ctx.restore(); },
    };
  }
  function svgPainter(W, H, font) {
    const out = []; const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); let clipN = 0; const clips = [];
    const meas = document.createElement('canvas').getContext('2d');
    const st = (o) => `fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.lw || 1}"${o.dash ? ` stroke-dasharray="${o.dash.join(' ')}"` : ''}${o.alpha != null ? ` opacity="${o.alpha}"` : ''}${o.evenodd ? ' fill-rule="evenodd"' : ''}${o.cap ? ` stroke-linecap="${o.cap}"` : ''} stroke-linejoin="round"`;
    const f = (v) => (+v).toFixed(2); const d = (pts, close) => pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('') + (close ? 'Z' : '');
    return {
      W, H, measure: (s, fnt) => { meas.font = fnt; return meas.measureText(s).width; },
      rect(x, y, w, h, o) { out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" ${st(o)}/>`); },
      path(pts, o) { if (!pts.length) return; out.push(`<path d="${d(pts, o.close)}" ${st(o)}/>`); },
      rings(rs, o) { out.push(`<path d="${rs.map(r => d(r, true)).join('')}" ${st(o)}/>`); },
      circle(x, y, r, o) { out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" ${st(o)}/>`); },
      text(s, x, y, o) { const anchor = { left: 'start', right: 'end', center: 'middle', start: 'start', end: 'end' }[o.align || 'left']; const base = { top: 'hanging', middle: 'central', bottom: 'text-after-edge', alphabetic: 'alphabetic' }[o.baseline || 'alphabetic'];
        out.push(`<text x="${f(x)}" y="${f(y)}" font-family="${e(o.font)}" font-size="${o.size || 11}" font-weight="${o.weight || 400}" fill="${o.color || INK}" text-anchor="${anchor}" dominant-baseline="${base}"${o.halo ? ` stroke="${o.halo}" stroke-width="${o.haloW || 3}" paint-order="stroke" stroke-linejoin="round"` : ''}${o.dir === 'rtl' ? ' direction="rtl" unicode-bidi="embed"' : ''}>${e(s)}</text>`); },
      clip(x, y, w, h) { clipN++; out.push(`<clipPath id="c${clipN}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath><g clip-path="url(#c${clipN})">`); clips.push(clipN); },
      unclip() { if (clips.length) { clips.pop(); out.push('</g>'); } },
      svg(title) { return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<title>${e(title || 'Granada Atlas section')}</title>\n<rect width="100%" height="100%" fill="#FFFFFF"/>\n${out.join('\n')}\n</svg>`; },
    };
  }

  // the vertical exaggeration that fits a long section in the frame (only used when the user asks for "auto")
  function chooseVE(prof, W, H) {
    const xs = (W - 60) / prof.L; const tops = prof.cuts.concat(prof.bg).filter(c => c.h != null).map(c => c.base + c.h); const top = Math.max(prof.max, ...tops);
    const range = Math.max(5, top - prof.min) * 1.15; for (const ve of [1, 2, 3, 5, 10]) if (range * xs * ve >= (H - 200) * 0.35) return ve; return 10;
  }
  // drawing tones from the shared palette (palette.section): red cut, warm beige background, soil, olive trees
  const SP = P.section; const RED = SP.cut, INK = SP.ink, GREY = SP.grey;
  const BG_FILL = SP.bgFill, BG_LINE = SP.bgLine, BG_FLOOR = SP.bgFloor, BG_GROUND = SP.bgGround, SOIL = SP.soil, SOIL_EDGE = SP.soilEdge;
  const TREE_ON = SP.treeOn, TREE_BG = SP.treeBg, FIG = SP.fig;
  const ROOF_TRI = /^(gabled|pyramidal|saltbox|crosspitched|gambrel)$/, ROOF_TRAP = /^(hipped|side_hipped|half-hipped|quadruple_saltbox|mansard)$/, ROOF_ARC = /^(round|dome|onion)$/;
  const MAT = P.material;

  /* One street-section drawing. Evidence first: footprints, heights/floors, roof shape and terrain come from the data; the
     user's documented notes (with a source) and user-entered street dimensions are drawn as such; everything schematic
     is lighter and named in the notes. Horizontal and vertical scales are equal unless the user picks an exaggeration,
     which is then stated in the title and shown with its own vertical scale bar. */
  function paint(pt, prof, o) {
    const W = pt.W, H = pt.H; const font = o.font; const dir = I.dir(); const rtl = dir === 'rtl'; const notes = o.notes || {}; const ill = !!o.illustrative;
    const compact = W < 760; const fs = W >= 1500 ? 13 : W >= 1000 ? 12 : 10.5; const floorH = prof.floorH || 3; const widths = o.widths || {};
    pt.rect(0, 0, W, H, { fill: '#FFFFFF' });
    const slim = !compact && H < 620; // wide, short frames (fabric pages, sheets): one legend row, no locator
    const footH = compact ? 58 : slim ? 104 : Math.round(Math.max(170, Math.min(250, H * 0.27)));
    const ml = compact ? 12 : 30, mr = ml, mt = compact ? 26 : 44; const pw = W - ml - mr; const dimPx = compact ? 0 : 46; const ph = H - mt - footH - dimPx;
    const ve = o.ve === 'auto' ? chooseVE(prof, W, H) : Math.max(1, +o.ve || 1);
    const treeTop = (tr) => tr.base + (tr.h || 0);
    const tops = prof.cuts.concat(prof.bg).filter(c => c.h != null && c.base != null).map(c => c.base + c.h).concat((prof.trees || []).filter(tr => tr.base != null).map(treeTop));
    const bottoms = prof.cuts.filter(c => c.lvu && c.base != null).map(c => c.base - c.lvu * floorH);
    const top = Math.max(prof.max, ...tops) + 1.5; const lo = Math.max(Math.min(prof.min, ...bottoms) - 0.5, prof.min - Math.max(3, (top - prof.min) * 0.12));
    const xs = Math.min(pw / prof.L, ph / ((top - lo) * ve)); const ys = xs * ve;
    // centred in the frame; the dimension band follows directly below the drawing
    const x0 = ml + (pw - prof.L * xs) / 2; const yBase = mt + ph - (ph - (top - lo) * ys) / 2;
    // looking to the left of A→B puts A on the left of the drawing; looking to the right puts B on the left (what one sees)
    const mir = prof.look === 'right'; const X = (d) => x0 + (mir ? prof.L - d : d) * xs, Y = (e) => yBase - (e - lo) * ys;
    const XX = (d0, d1) => { const p = X(d0), q = X(d1); return p < q ? [p, q] : [q, p]; };
    const hits = []; const flags = { bgGround: false, plinth: false, estH: false, roofSchematic: false, roofLevels: false, basement: false, illustrative: false, documented: false, userDims: false, figures: false, treesSchem: false, measured: false, slabs: false, unknownH: 0 };
    const gy = (d) => { const i = Math.max(0, Math.min(prof.elev.length - 1, Math.round(d / prof.step))); return prof.elev[i]; };
    const roofPts = (shape, a, b, yE, rh) => { const yR = yE - rh; const w = b - a;
      if (ROOF_TRI.test(shape)) return [[a, yE], [(a + b) / 2, yR], [b, yE]];
      if (ROOF_TRAP.test(shape)) return [[a, yE], [a + w * 0.3, yR], [b - w * 0.3, yR], [b, yE]];
      if (shape === 'skillion') return [[a, yE], [a, yR], [b, yE]];
      if (ROOF_ARC.test(shape)) { const out = []; for (let i = 0; i <= 16; i++) { const t2 = Math.PI * i / 16; out.push([a + w / 2 - Math.cos(t2) * w / 2, yE - Math.sin(t2) * rh]); } return out; }
      return null; };
    const roofH = (c, w_m) => c.rl ? c.rl * floorH : Math.max(1.2, Math.min(3.5, w_m * 0.25));
    pt.clip(ml - 2, mt - 2, pw + 4, yBase - mt + 2);
    // ---- background elevations and projected trees, farthest first ----
    const texture = (a, y0, b, y1, mat, alpha) => { const col = MAT[mat]; if (!col) return; pt.rect(a, y0, b - a, y1 - y0, { fill: col, alpha: 0.16 * alpha });
      if (mat === 'brick' || mat === 'stone') { const sp = Math.max(3, (mat === 'brick' ? 0.6 : 1.2) * ys); for (let y = y1 - sp; y > y0; y -= sp) pt.path([[a, y], [b, y]], { stroke: col, lw: 0.4, alpha: 0.55 * alpha }); }
      else if (mat === 'glass') { const sp = Math.max(6, 1.5 * xs); for (let x = a + sp; x < b; x += sp) pt.path([[x, y0], [x, y1]], { stroke: col, lw: 0.4, alpha: 0.55 * alpha }); } };
    const windows = (a, b, base, levels, alpha, col) => { const ww = 1.2 * xs, wh = 1.4 * ys, sp = 3.2 * xs; if (ww < 1.5 || wh < 1.5) return; flags.illustrative = true;
      for (let k = 0; k < levels; k++) { const yb = Y(base + k * floorH + 0.9); for (let x = a + sp / 2; x + ww < b - sp / 4; x += sp) pt.rect(x, yb - wh, ww, wh, { stroke: col, lw: 0.5, alpha }); } };
    const drawBg = (b) => {
      if (b.base == null) return; const fade = Math.max(0.3, 1 - b.off / ((prof.depth || 40) * 1.25)); const n = notes[b.id] || {};
      const [a, c2] = XX(b.d0, b.d1); const shape = n.roof || b.rs; const rh = shape && !/^(flat|many|multi)$/.test(shape) ? roofH(b, b.d1 - b.d0) : 0;
      const hWall = b.src === 'height' ? Math.max(1, b.h - rh) : b.h; const yE = Y(b.base + hWall), yB = Y(b.base);
      pt.rect(a, yE, c2 - a, yB - yE, { fill: BG_FILL, alpha: 0.55 + 0.45 * fade }); pt.rect(a, yE, c2 - a, yB - yE, { stroke: BG_LINE, lw: 0.8, alpha: fade });
      if (b.lv && b.lv > 1 && hWall * ys / b.lv > 4) for (let k = 1; k < b.lv; k++) { const yy = Y(b.base + hWall * k / b.lv); pt.path([[a + 0.5, yy], [c2 - 0.5, yy]], { stroke: BG_FLOOR, lw: 0.5, alpha: fade }); }
      if (n.wall) { texture(a, yE, c2, yB, n.wall, fade); flags.documented = true; }
      if (n.openings === 'regular' && b.lv) { windows(a, c2, b.base, b.lv, fade, BG_LINE); flags.documented = true; } else if (ill && b.lv) windows(a, c2, b.base, b.lv, fade * 0.7, BG_LINE);
      if (rh) { const rp = roofPts(shape, a, c2, yE, rh * ys); if (rp) { pt.path(rp, { fill: BG_FILL, stroke: BG_LINE, lw: 0.8, alpha: fade }); if (!b.rl && !n.roofH) flags.roofSchematic = true; } }
      // its own ground (MDT25 along the face towards the cut): a pale band under the building, so a building standing on
      // higher ground behind the cut is visibly grounded there; the section's soil, drawn later, hides what lies below
      if (b.gnd && b.gnd.length > 1) { const gp = b.gnd.map(([d, e]) => [X(d), Y(e)]); const xl = Math.min(gp[0][0], gp[gp.length - 1][0]), xr = Math.max(gp[0][0], gp[gp.length - 1][0]);
        pt.path(gp.concat([[gp[gp.length - 1][0], Y(lo)], [gp[0][0], Y(lo)]]), { fill: BG_GROUND, alpha: 0.6 + 0.4 * fade, close: true });
        pt.path(gp, { stroke: BG_LINE, lw: 0.7, alpha: fade }); if (b.above > 0.3) { flags.bgGround = true; pt.path([[xl, Y(b.base)], [xl, Y(lo)]], { stroke: BG_LINE, lw: 0.4, alpha: 0.5 * fade, dash: [2, 2] }); pt.path([[xr, Y(b.base)], [xr, Y(lo)]], { stroke: BG_LINE, lw: 0.4, alpha: 0.5 * fade, dash: [2, 2] }); } }
      hits.push({ id: b.id, kind: 'bg', x0: a, x1: c2, y0: Y(b.base + b.h), y1: yB, b });
    };
    const sc = Math.max(0.8, Math.min(1.6, W / 1100));
    const drawTree = (tr) => {
      if (tr.base == null) return; const on = tr.near;
      if (!on && tr.lineBase != null && Math.abs(tr.base - tr.lineBase) > 0.3) pt.path([[X(tr.d) - 5, Y(tr.base)], [X(tr.d) + 5, Y(tr.base)]], { stroke: TREE_BG, lw: 0.8 }); /* its own ground */ const col = on ? TREE_ON : TREE_BG; const lw = on ? 1.2 : 0.8; const alpha = on ? 1 : 0.75; const x = X(tr.d), y0 = Y(tr.base);
      if (tr.h) { const tp = Y(tr.base + tr.h); const r = tr.crown ? Math.max(2, tr.crown / 2 * xs) : Math.max(3, Math.min((y0 - tp) * 0.32, tr.h * 0.3 * xs)); const cy = tp + Math.min(r, (y0 - tp) * 0.45);
        pt.path([[x, y0], [x, cy + r * 0.4]], { stroke: col, lw: lw + 0.4, alpha }); pt.circle(x, cy, r, { fill: on ? '#FFFFFF' : SP.treeFillBg, stroke: col, lw, alpha, dash: tr.crown ? null : [3, 2] }); if (!tr.crown) flags.treesSchem = true; }
      else { flags.treesSchem = true; const r = (tr.row ? 4.5 : 6) * sc; const stem = 9 * sc; pt.path([[x, y0], [x, y0 - stem]], { stroke: col, lw: lw + 0.3, alpha }); pt.circle(x, y0 - stem - r, r, { fill: on ? '#FFFFFF' : SP.treeFillBg, stroke: col, lw, alpha, dash: [2.5, 1.8] }); }
    };
    const trs = (prof.trees || []).slice().sort((a, b) => b.off - a.off);
    prof.bg.map(b => ({ off: b.off, f: () => drawBg(b) })).concat(trs.filter(tr => !tr.near).map(tr => ({ off: tr.off, f: () => drawTree(tr) }))).sort((a, b) => b.off - a.off).forEach(x => x.f());
    // ---- ground cut: soil tone below the terrain line ----
    const g = []; prof.dist.forEach((d, i) => { const e = prof.elev[i]; if (e != null) g.push([X(d), Y(e)]); });
    if (g.length) pt.path(g.concat([[g[g.length - 1][0], Y(lo)], [g[0][0], Y(lo)]]), { fill: SOIL, close: true });
    // ---- streets: user-entered sidewalks/kerbs only (never inferred); mapped green and water on the ground line ----
    const sf = prof.surf || { green: [], streets: [], water: [] };
    sf.streets.forEach(z => { const u = widths[z.key]; if (!u || z.faceA == null) return; const e0 = gy(z.d); if (e0 == null) return; flags.userDims = true; const kerb = Math.max(1.6, 0.15 * ys);
      const side = (from, wd, sgn) => { if (!(wd > 0)) return; const a = X(from), b = X(from + sgn * wd / (z.sin || 1)); const e = gy(from + sgn * wd / 2); if (e == null) return; const y = Y(e); pt.rect(Math.min(a, b), y - kerb, Math.abs(b - a), kerb, { fill: SP.kerb, stroke: GREY, lw: 0.8 }); };
      side(z.faceA, +u.sa, 1); side(z.faceB, +u.sb, -1); });
    sf.green.forEach(zn => { const [ga, gb] = XX(zn.d0, zn.d1); const seg = g.filter(p => p[0] >= ga && p[0] <= gb); if (seg.length > 1) pt.path(seg.map(p => [p[0], p[1] - 1.5]), { stroke: SP.green, lw: 2.4, alpha: 0.8 }); });
    sf.water.forEach(zn => { const e = gy(zn.d); if (e == null) return; const x = X(zn.d), y = Y(e); pt.path([[x - 5, y + 3], [x - 2.5, y + 1], [x, y + 3], [x + 2.5, y + 1], [x + 5, y + 3]], { stroke: GA.palette.blue, lw: 1.1 }); });
    if (g.length) pt.path(g, { stroke: INK, lw: compact ? 1.6 : 2.2 });
    // ---- cut buildings: white interior, red cut outline; slabs from the floor count; mapped/documented roof ----
    prof.cuts.forEach((c, ci) => {
      if (c.base == null) return; const [a, b] = XX(c.d0, c.d1); const y0 = Y(c.base); const n = notes[c.id] || {};
      if (n.wall || n.roofMat || n.balconies) flags.documented = true;
      if (c.h == null) { flags.unknownH++; pt.rect(a, y0 - 3, b - a, 3, { fill: '#FFFFFF', stroke: RED, lw: 1.4, dash: [2, 2] }); hits.push({ id: c.id, kind: 'cut', x0: a, x1: b, y0: y0 - 14, y1: y0 + 2, c }); return; }
      const shape = n.roof || c.rs; const pitched = shape && !/^(flat|many|multi|not applicable)$/.test(shape);
      const rh = pitched ? roofH(c, c.d1 - c.d0) : 0; if (pitched) { if (c.rl) flags.roofLevels = true; else flags.roofSchematic = true; }
      const hWall = c.src === 'height' ? Math.max(1, c.h - rh) : c.h; const yE = Y(c.base + hWall); const est = c.src !== 'height'; if (est) flags.estH = true;
      if (n.wall && MAT[n.wall]) { pt.path([[a - 2, y0], [a - 2, yE]], { stroke: MAT[n.wall], lw: 2.2, alpha: 0.85 }); pt.path([[b + 2, y0], [b + 2, yE]], { stroke: MAT[n.wall], lw: 2.2, alpha: 0.85 }); }
      pt.rect(a, yE, b - a, y0 - yE, { fill: '#FFFFFF' });
      if (c.lv && c.lv > 1 && o.floors !== false && hWall * ys / c.lv > 3.5) { flags.slabs = true; for (let k = 1; k < c.lv; k++) { const yy = Y(c.base + hWall * k / c.lv); pt.path([[a, yy], [b, yy]], { stroke: RED, lw: 0.7, alpha: 0.75 }); } }
      // sloping ground under the building: the base is the lowest ground between the facades; the ground retained under the
      // uphill part is shown in the soil tone with the terrain line dashed — the actual foundation is not surveyed
      if (c.gnd && c.gnd.length > 1 && c.gRise > 0.25) { const gp = c.gnd.map(([d, e]) => [X(d), Y(e)]); pt.path(gp.concat([[gp[gp.length - 1][0], y0], [gp[0][0], y0]]), { fill: SOIL, close: true });
        for (let k = 1; k < gp.length; k++) { const [xa, ya] = gp[k - 1], [xb, yb] = gp[k]; for (let x = Math.min(xa, xb) + 4; x < Math.max(xa, xb); x += 6) { const yt = ya + (yb - ya) * (x - xa) / ((xb - xa) || 1); if (y0 - yt > 4) pt.path([[x, yt + 1], [x - Math.min(4, y0 - yt - 1), Math.min(y0, yt + 5)]], { stroke: SOIL_EDGE, lw: 0.6 }); } }
        pt.path(gp, { stroke: INK, lw: 0.9, dash: [3, 2] }); flags.plinth = true; }
      if (c.lvu) { flags.basement = true; const yb = Y(c.base - c.lvu * floorH); pt.rect(a, y0, b - a, yb - y0, { fill: '#FFFFFF' }); pt.path([[a, y0], [a, yb], [b, yb], [b, y0]], { stroke: RED, lw: 1, dash: [3, 2] }); }
      const lwCut = compact ? 1.8 : 2.4;
      pt.path([[a, y0], [a, yE]], { stroke: RED, lw: lwCut }); pt.path([[b, y0], [b, yE]], { stroke: RED, lw: lwCut });
      const rp = pitched ? roofPts(shape, a, b, yE, rh * ys) : null;
      if (rp) { pt.path(rp.concat([rp[0]]), { fill: '#FFFFFF' }); pt.path(rp, { stroke: RED, lw: c.rl || n.roofH ? lwCut : 1.5, dash: c.rl || n.roofH ? null : [4, 3] }); pt.path([[a, yE], [b, yE]], { stroke: RED, lw: 0.7, alpha: 0.6 }); if (n.roofMat && MAT[n.roofMat]) pt.path(rp.map(([x, y]) => [x, y - 2.5]), { stroke: MAT[n.roofMat], lw: 2.2, alpha: 0.85 }); }
      else pt.path([[a, yE], [b, yE]], { stroke: RED, lw: lwCut, dash: est ? [5, 3] : null });
      pt.path([[a, y0], [b, y0]], { stroke: RED, lw: lwCut * 0.75 });
      if (shape && /^(many|multi)$/.test(shape)) pt.text(t('v5.roofComplex'), (a + b) / 2, yE + 10, { font, size: fs - 2, align: 'center', color: RED, dir });
      if (n.openings === 'regular' && c.lv) { windows(a, b, c.base, c.lv, 0.9, SP.window); flags.documented = true; }
      if (n.balconies === 'yes' && c.lv) { const floors = parseFloors(n.balconyFloors, c.lv); const prev = prof.cuts[ci - 1], next = prof.cuts[ci + 1];
        const sides = []; if (!prev || prev.d1 < c.d0 - 0.5) sides.push(-1); if (!next || next.d0 > c.d1 + 0.5) sides.push(1);
        const dep = 1.2 * xs; sides.forEach(sd => floors.forEach(k => { const yy = Y(c.base + hWall * k / c.lv); const xa = X(sd < 0 ? c.d0 : c.d1), xb = xa + (X(c.d1) > X(c.d0) ? sd : -sd) * dep; pt.path([[xa, yy], [xb, yy]], { stroke: INK, lw: 1.6 }); pt.path([[xb, yy], [xb, yy - 1.0 * ys]], { stroke: INK, lw: 0.7 }); pt.path([[xa, yy - 1.0 * ys], [xb, yy - 1.0 * ys]], { stroke: INK, lw: 0.7 }); })); }
      hits.push({ id: c.id, kind: 'cut', x0: a, x1: b, y0: Y(c.base + c.h), y1: y0, c });
    });
    // ---- trees standing on the cut line, drawn in front ----
    trs.filter(tr => tr.near).forEach(drawTree);
    // ---- decorative figures for scale (1.75 m), near the building faces of measured streets; never observations ----
    if (o.figures !== false && 1.75 * ys >= 7) { const spots = []; sf.streets.forEach(z => { if (z.faceA != null) spots.push(z.faceA + Math.min(1.2, z.gap * 0.15), z.faceB - Math.min(1.6, z.gap * 0.2)); });
      if (!spots.length) { const firstGap = (() => { let d = 2; for (const c of prof.cuts) { if (c.d0 - d > 3) return d + 1; d = Math.max(d, c.d1); } return d + 1 < prof.L ? d + 1 : null; })(); if (firstGap != null) spots.push(firstGap); }
      spots.slice(0, 4).forEach((d, i) => { const e = gy(d); if (e == null) return; const x = X(d), y = Y(e), hh = 1.75 * ys; const w = hh * 0.13; flags.figures = true;
        pt.circle(x, y - hh * 0.92, hh * 0.075, { fill: FIG, alpha: 0.75 }); pt.path([[x - w, y - hh * 0.82], [x + w, y - hh * 0.82], [x + w * (i % 2 ? 0.7 : 0.9), y - hh * 0.42], [x + w * 0.5, y], [x - w * 0.5, y], [x - w * (i % 2 ? 0.9 : 0.7), y - hh * 0.42]], { fill: FIG, alpha: 0.75, close: true }); }); }
    pt.unclip();
    // ---- labels in the drawing: heights of cut buildings, street names, elevation levels ----
    let lastX = -1e9; prof.cuts.slice().sort((p1, p2) => X((p1.d0 + p1.d1) / 2) - X((p2.d0 + p2.d1) / 2)).forEach(c => { if (c.base == null) return; const xm = X((c.d0 + c.d1) / 2); if (xm - lastX < (compact ? 26 : 38)) return; const y = Math.max(mt + 8, Y(c.base + (c.h || 0)) - 5);
      const txt = c.h == null ? '?' : c.src === 'height' ? nf(c.h, 1) + ' m' : '≈' + nf(c.h, 0) + ' m'; pt.text(txt, xm, y, { font, size: fs - 1, align: 'center', color: c.h == null ? RED : INK, halo: '#FFFFFF' }); lastX = xm; });
    const named = new Set(); let lastS = -1e9; sf.streets.concat(sf.water.map(w => Object.assign({ water: true }, w))).sort((a, b) => X(a.d) - X(b.d)).forEach(z => { const e = gy(z.d); if (e == null || !z.name || named.has(z.name)) return; const x = X(z.d); const tw = pt.measure(z.name, `${fs - 1}px ${font}`); if (x - tw / 2 < lastS + 8) return;
      const xc = Math.max(ml + tw / 2, Math.min(W - mr - tw / 2, x)); if (xc - tw / 2 < lastS + 8) return;
      pt.text(z.name, xc, Math.min(yBase - 4, Y(e) + fs + 4), { font, size: fs - 1, align: 'center', color: z.water ? SP.water : GREY, dir: 'auto', halo: SOIL }); lastS = xc + tw / 2; named.add(z.name); });
    // elevation levels: ground at A and B, and the lowest/highest ground between (metres above sea level, IGN MDT25)
    if (!compact) { const lv = []; const eA = prof.elev.find(v => v != null), eB = [...prof.elev].reverse().find(v => v != null); if (eA != null) lv.push([0, eA, 'start']); if (eB != null) lv.push([prof.L, eB, 'end']);
      let iMin = -1, iMax = -1; prof.elev.forEach((v, i) => { if (v == null) return; if (iMin < 0 || v < prof.elev[iMin]) iMin = i; if (iMax < 0 || v > prof.elev[iMax]) iMax = i; });
      [iMin, iMax].forEach(i => { if (i < 0) return; const d = prof.dist[i]; if (d < prof.L * 0.08 || d > prof.L * 0.92) return; if (prof.cuts.some(c => d >= c.d0 - 1 && d <= c.d1 + 1)) return; if (Math.abs(prof.elev[i] - eA) < 0.5 && Math.abs(prof.elev[i] - eB) < 0.5) return; lv.push([d, prof.elev[i], 'mid']); });
      const placed = []; lv.forEach(([d, e, k]) => { const x = X(d), y = Y(e); const label = '+' + e.toFixed(1); const tw = pt.measure(label, `${fs - 1}px ${font}`); const atL = Math.abs(x - Math.min(X(0), X(prof.L))) < 2, atR = Math.abs(x - Math.max(X(0), X(prof.L))) < 2; const tx = atL ? x + 10 : atR ? x - 10 - tw : x - tw / 2; if (placed.some(p => Math.abs(p - tx) < tw + 8)) return; placed.push(tx);
        pt.path([[x - 4, y - 7], [x + 4, y - 7], [x, y - 1]], { fill: '#FFFFFF', stroke: INK, lw: 0.8, close: true }); pt.text(label, tx, y - 9, { font, size: fs - 1, color: INK, halo: '#FFFFFF' }); }); }
    // ---- A / B (and intermediate vertices) above the drawing ----
    const Ls = LETTERS(prof.vertexD.length);
    const yAB = Math.max(mt + 6, Y(top) - 4);
    prof.vertexD.forEach((d, i) => { const x = X(d); const end = i === 0 || i === Ls.length - 1; const ge = gy(d); pt.path([[x, yAB - 4], [x, ge != null ? Y(ge) : yAB + 10]], { stroke: RED, lw: end ? 1 : 0.6, dash: [3, 3], alpha: 0.6 });
      pt.text(Ls[i], x, yAB - 9, { font, size: end ? fs + 6 : fs, weight: 700, color: RED, align: 'center', halo: '#FFFFFF' }); });
    // ---- dimension chain: facade-to-facade widths measured from the footprints; user widths on a second row ----
    if (!compact) { const yD = yBase + 16, yU = yBase + 34; const tick = (x, y) => pt.path([[x - 3.5, y + 3.5], [x + 3.5, y - 3.5]], { stroke: INK, lw: 0.9 });
      const dim = (a, b, y, label, col) => { const [xa, xb] = XX(a, b); if (xb - xa < 14) return; pt.path([[xa - 4, y], [xb + 4, y]], { stroke: col, lw: 0.6 }); tick(xa, y); tick(xb, y); pt.text(label, (xa + xb) / 2, y - 3, { font, size: fs - 2, align: 'center', color: col, halo: '#FFFFFF' }); };
      sf.streets.forEach(z => { if (z.faceA == null) return; flags.measured = true; const ea = gy(z.faceA), eb = gy(z.faceB);
        [[z.faceA, ea], [z.faceB, eb]].forEach(([d, e]) => { if (e != null) pt.path([[X(d), Y(e) + 2], [X(d), yD + 5]], { stroke: P.grey, lw: 0.5 }); });
        dim(z.faceA, z.faceB, yD, nf(z.gap, 1) + ' m', INK);
        const u = widths[z.key]; if (u) { const sa = +u.sa || 0, sb = +u.sb || 0; const k = 1 / (z.sin || 1); let p = z.faceA; if (sa) { dim(p, p + sa * k, yU, nf(sa, 1) + '*', GREY); p += sa * k; } const cwEnd = z.faceB - sb * k; if (cwEnd - p > 0.5) dim(p, cwEnd, yU, nf((cwEnd - p) / k, 1) + '*', GREY); if (sb) dim(cwEnd, z.faceB, yU, nf(sb, 1) + '*', GREY); } }); }
    // ---- footer: title and scale, legend, notes, sources; locator on the outer side ----
    const fy = H - footH; pt.path([[ml, fy + 6], [W - mr, fy + 6]], { stroke: SP.rule, lw: 0.8 });
    const locW = compact || slim ? 0 : Math.round(Math.min(W * 0.26, (footH - 22) * 1.45)); const locH = compact ? 0 : footH - 22;
    const locX = rtl ? ml : W - mr - locW; const tx0 = rtl ? W - mr : ml; const tw = W - ml - mr - (locW ? locW + 24 : 0); const al = rtl ? 'right' : 'left';
    const veTxt = ve === 1 ? t('v7.scaleEqual') : t('v7.scaleVE', { v: ve });
    pt.text(prof.name || '', tx0, fy + 26, { font, size: fs + 3, weight: 700, align: al, dir });
    pt.text(veTxt, tx0 + (rtl ? -1 : 1) * (pt.measure(prof.name || '', `700 ${fs + 3}px ${font}`) + 14), fy + 26, { font, size: fs, weight: 600, align: al, color: ve === 1 ? INK : RED, dir });
    // scale bar (and the vertical bar when exaggerated)
    { const len = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(v => v * xs >= (compact ? 50 : 90)) || 1000; const sx = rtl ? tx0 - len * xs : tx0; const sy = fy + (compact ? 40 : 42);
      for (let k = 0; k < 4; k++) pt.rect(sx + k * len * xs / 4, sy, len * xs / 4, 4, { fill: k % 2 ? '#FFFFFF' : INK, stroke: INK, lw: 0.6 });
      pt.text('0', sx, sy + 15, { font, size: fs - 2, align: 'center' }); pt.text(`${len} m`, sx + len * xs, sy + 15, { font, size: fs - 2, align: 'center' });
      if (ve !== 1) { const vl = [20, 10, 5, 2, 1].find(v => v * ys <= 40) || 1; const vx = rtl ? sx - 30 : sx + len * xs + 30; pt.rect(vx, sy + 4 - vl * ys, 3, vl * ys, { fill: RED }); pt.text(`${vl} m`, vx + (rtl ? -5 : 7), sy + 2, { font, size: fs - 2, color: RED, align: rtl ? 'right' : 'left' }); } }
    if (!compact) {
      // legend items (only those present)
      // ordered by what must never be misread (estimates, decorative figures, schematic trees) first
      const items = [['cut', t('v7.lgCut')]]; if (flags.estH) items.push(['est', t('v7.lgEst', { f: nf(floorH, 1) })]); if (flags.figures) items.push(['fig', t('v7.lgFig')]);
      if (trs.some(x => x.near)) items.push(['treeOn', t('v7.lgTreeOn')]); if (trs.some(x => !x.near)) items.push(['treeBg', t('v7.lgTreeBg', { c: nf(prof.corridor || 15) })]); if (flags.treesSchem) items.push(['treeSch', t('v7.lgTreeSch')]);
      if (prof.bg.length) items.push(['bg', t('v7.lgBg', { d: nf(prof.depth || 40) })]); if (flags.bgGround) items.push(['bgG', t('v8.lgBgGround')]); if (flags.plinth) items.push(['plinth', t('v8.lgPlinth')]); if (flags.slabs) items.push(['slab', t('v7.lgSlab')]); if (flags.measured) items.push(['dim', t('v7.lgDim')]); if (flags.userDims) items.push(['dimU', t('v7.lgDimUser')]);
      let lx = 0, ly = fy + (slim ? 70 : 80); const rowH = fs + 9; let rows = 1; const sw = (k, x, y) => { const L2 = x + 16;
        if (k === 'cut') pt.rect(x, y - 6, 16, 10, { fill: '#FFFFFF', stroke: RED, lw: 2 }); else if (k === 'est') pt.path([[x, y], [L2, y]], { stroke: RED, lw: 2, dash: [4, 2] }); else if (k === 'slab') { pt.rect(x, y - 6, 16, 10, { fill: '#FFFFFF', stroke: RED, lw: 1.2 }); pt.path([[x, y - 1], [L2, y - 1]], { stroke: RED, lw: 0.7 }); }
        else if (k === 'bg') pt.rect(x, y - 6, 16, 10, { fill: BG_FILL, stroke: BG_LINE, lw: 0.8 });
        else if (k === 'bgG') { pt.rect(x, y - 2, 16, 6, { fill: BG_GROUND }); pt.path([[x, y - 2], [L2, y - 2]], { stroke: BG_LINE, lw: 0.7 }); }
        else if (k === 'plinth') { pt.rect(x, y - 6, 16, 10, { fill: SOIL, stroke: RED, lw: 1 }); pt.path([[x, y + 2], [L2, y - 5]], { stroke: INK, lw: 0.9, dash: [3, 2] }); } else if (k === 'treeOn' || k === 'treeBg' || k === 'treeSch') { const col = k === 'treeBg' ? TREE_BG : TREE_ON; pt.path([[x + 8, y + 4], [x + 8, y - 1]], { stroke: col, lw: 1 }); pt.circle(x + 8, y - 4, 4, { fill: '#FFFFFF', stroke: col, lw: 1, dash: k === 'treeSch' ? [2, 1.5] : null }); }
        else if (k === 'fig') { pt.circle(x + 8, y - 6, 1.6, { fill: FIG }); pt.path([[x + 6.5, y - 4], [x + 9.5, y - 4], [x + 9, y + 4], [x + 7, y + 4]], { fill: FIG, close: true }); }
        else if (k === 'dim' || k === 'dimU') { pt.path([[x, y], [L2, y]], { stroke: k === 'dim' ? INK : GREY, lw: 0.7 }); pt.path([[x - 2, y + 2], [x + 2, y - 2]], { stroke: INK, lw: 0.8 }); pt.path([[L2 - 2, y + 2], [L2 + 2, y - 2]], { stroke: INK, lw: 0.8 }); } };
      items.forEach(([k, label]) => { const wI = 24 + pt.measure(label, `${fs - 1}px ${font}`) + 18; if (lx + wI > tw) { if (slim) return; lx = 0; ly += rowH; rows++; } const x = rtl ? tx0 - lx - 16 : tx0 + lx; sw(k, x, ly); pt.text(label, rtl ? x - 6 : x + 22, ly + 3, { font, size: fs - 1, align: al, dir, color: GA.palette.ink2 }); lx += wI; });
      // estimation notes and gaps, then sources and dates
      const nts = []; if (flags.estH) nts.push(t('v7.nEst', { f: nf(floorH, 1) })); if (flags.unknownH) nts.push(t('v7.nUnknown', { n: flags.unknownH })); if (flags.roofSchematic) nts.push(t('v7.nRoof')); if (flags.treesSchem) nts.push(t('v7.nTree')); if (flags.plinth) nts.push(t('v8.nPlinth')); if (flags.bgGround) nts.push(t('v8.nBgGround'));
      if (flags.measured && !flags.userDims) nts.push(t('v7.nWidths')); if (flags.userDims) nts.push(t('v7.nUser')); if (flags.documented) nts.push(t('v5.secDoc')); if (ill && flags.illustrative) nts.push(t('v5.secIll'));
      const cov = prof.coverage || {}; if (cov.demMissing > 0) nts.push(t('v6.covDem', { p: Math.round(cov.demMissing * 100) })); if (cov.outsideRegion > 0) nts.push(t('v6.covBld', { p: Math.round(cov.outsideRegion * 100) }));
      ly += rowH + 6; const wrap = (txt, y, size, col) => { const words = String(txt).split(/\s+/); let line = ''; const maxW = tw; for (const w2 of words) { const test = line ? line + ' ' + w2 : w2; if (pt.measure(test, `${size}px ${font}`) > maxW && line) { pt.text(line, tx0, y, { font, size, align: al, dir, color: col }); y += size + 4; line = w2; if (y > H - 22) return y; } else line = test; } if (line) { pt.text(line, tx0, y, { font, size, align: al, dir, color: col }); y += size + 4; } return y; };
      if (!slim) ly = wrap(nts.join(' · '), ly, fs - 2, SP.text2);
      const r = prof.ref; const day = (prof.computed || '').slice(0, 10);
      const src = `${t('v7.sources')}: IGN MDT25 (2008–2015, CC BY 4.0) · OpenStreetMap 2026-10-23 (ODbL)${trs.length ? ' · OSM trees ' + (prof.treeTs || '').slice(0, 10) : ''} · ${t('v7.drawn')} ${day}` + (r ? ` · A ${r.aLL[1].toFixed(5)}, ${r.aLL[0].toFixed(5)} → B ${r.bLL[1].toFixed(5)}, ${r.bLL[0].toFixed(5)} · ${nf(r.azimuth)}°` : '');
      pt.text(src, tx0, H - 10, { font, size: fs - 3, align: al, color: SP.src, dir });
      // ---- locator: north-up plan with the section line, A/B, viewing direction, projection band, study areas ----
      if (prof.ctx && locW > 80) drawLocator(pt, prof, { x: locX, y: fy + 14, w: locW, h: locH }, Object.assign({ font, fs }, o));
    }
    return { ve, X, Y, hits, flags, xs, ys };
  }
  function drawLocator(pt, prof, box, o) {
    const font = o.font, fs = o.fs; const [wx0, wy0, wx1, wy1] = prof.ctx.win; const k = Math.min(box.w / (wx1 - wx0), box.h / (wy1 - wy0)); const cx = (wx0 + wx1) / 2, cy = (wy0 + wy1) / 2;
    const P = (q) => [box.x + box.w / 2 + (q[0] - cx) * k, box.y + box.h / 2 - (q[1] - cy) * k];
    pt.rect(box.x, box.y, box.w, box.h, { fill: SP.locBg, stroke: SP.locLine, lw: 0.8 }); pt.clip(box.x, box.y, box.w, box.h);
    prof.ctx.st.forEach(s => pt.path(s.c.map(P), { stroke: SP.locSt, lw: /primary|secondary|trunk|tertiary/.test(s.hw || '') ? 2 : 1, cap: 'round' }));
    if (prof.ctx.bld.length) pt.rings(prof.ctx.bld.map(R => R.map(P)), { fill: SP.locBld });
    // band seen in the background (projection depth) on the viewing side
    const u = prof.pts.map(U); const sgn = prof.look === 'right' ? -1 : 1; const off = (dd) => u.map((p, i) => { const a = u[Math.max(0, i - 1)], b = u[Math.min(u.length - 1, i + 1)]; const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / L0 * sgn * dd, p[1] + (b[0] - a[0]) / L0 * sgn * dd]; });
    pt.path(u.concat(off(prof.depth || 40).reverse()).map(P), { fill: SP.locBand, alpha: 0.55, close: true });
    // study areas: dashed outline, plain number
    (o.areas || []).forEach(ar => { const R = ar.ring.map(U).map(P); pt.path(R, { stroke: GA.palette.ink2, lw: 1.1, dash: [4, 3], close: true }); const tx = R.reduce((s, q) => s + q[0], 0) / R.length, ty = Math.min(...R.map(q => q[1])) - 4; pt.text(String(ar.no), tx, ty, { font, size: fs, weight: 700, align: 'center', color: GA.palette.ink2, halo: '#FFFFFF' }); });
    const L = u.map(P); pt.path(L, { stroke: INK, lw: 2.2, cap: 'round' });
    // viewing direction: arrow from the middle of the line towards the side seen
    const pl = polyline(prof.pts); const m = at(pl, pl.L / 2); let i = 1; while (i < pl.cum.length - 1 && pl.cum[i] < pl.L / 2) i++; const a = pl.u[i - 1], b = pl.u[i]; const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const nx = -(b[1] - a[1]) / L0 * sgn, ny = (b[0] - a[0]) / L0 * sgn;
    const al = Math.max(14, Math.min(26, box.w * 0.08)); const p0 = P(m), p1 = [p0[0] + nx * al, p0[1] - ny * al]; pt.path([p0, p1], { stroke: RED, lw: 2 }); const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    pt.path([[p1[0] - Math.cos(ang - 0.5) * 7, p1[1] - Math.sin(ang - 0.5) * 7], p1, [p1[0] - Math.cos(ang + 0.5) * 7, p1[1] - Math.sin(ang + 0.5) * 7]], { stroke: RED, lw: 2 });
    pt.text('A', L[0][0], L[0][1] - 6, { font, size: fs + 1, weight: 700, color: RED, align: 'center', halo: '#FFFFFF' }); pt.text('B', L[L.length - 1][0], L[L.length - 1][1] - 6, { font, size: fs + 1, weight: 700, color: RED, align: 'center', halo: '#FFFFFF' });
    pt.unclip();
    // north arrow and scale
    const nx0 = box.x + box.w - 14, ny0 = box.y + 8; pt.path([[nx0, ny0 + 14], [nx0, ny0]], { stroke: INK, lw: 1 }); pt.path([[nx0 - 4, ny0 + 5], [nx0, ny0], [nx0 + 4, ny0 + 5]], { stroke: INK, lw: 1 }); pt.text('N', nx0, ny0 + 25, { font, size: fs - 2, align: 'center', weight: 700 });
    const len = [10, 20, 25, 50, 100, 200, 500].find(v => v * k >= 40) || 1000; pt.rect(box.x + 8, box.y + box.h - 10, len * k, 3, { fill: INK }); pt.text(`${len} m`, box.x + 12 + len * k, box.y + box.h - 7, { font, size: fs - 3, baseline: 'middle' });
  }
  function parseFloors(s, lv) { // "2-4", "1,3", "all" → floor indices (1 = first floor above ground)
    const out = new Set(); const str = String(s || '').trim().toLowerCase();
    if (!str || /all|todas|כל|جميع/.test(str)) { for (let k = 1; k < lv; k++) out.add(k); return [...out]; }
    str.split(/[,;\s]+/).forEach(p => { const m = p.match(/^(\d+)(?:-(\d+))?$/); if (!m) return; const a = +m[1], b = m[2] ? +m[2] : a; for (let k = a; k <= b && k < lv; k++) if (k >= 1) out.add(k); });
    return [...out];
  }
  // study areas for the locator: saved fabrics, numbered in the order they were saved
  const areasForLocator = () => { const st = root.GA.store, CMP = root.GA.compare; if (!st || !CMP) return []; return st.get().areas.map((a, i) => ({ ring: CMP.ringOf(a.spec), no: i + 1 })).filter(x => x.ring); };
  const withNotes = (o) => Object.assign({ notes: (root.GA.store && root.GA.store.get && root.GA.store.get().buildingNotes) || {}, areas: areasForLocator() }, o || {});
  // equal horizontal and vertical scales by default; an exaggeration is used only when the user chose one
  const optsFor = (s) => ({ ve: s && s.veUser ? s.ve : 1, floors: !(s && s.floors === false), illustrative: !!(s && s.ill), figures: !(s && s.figures === false), widths: (s && s.widths) || {} });
  const UI_FONT = () => getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif';
  function draw(canvas, prof, o) {
    o = withNotes(o); const ratio = o.ratio || (root.devicePixelRatio || 1); const W = o.w || 600, H = o.h || 300;
    canvas.style.width = o.fluid ? '100%' : W + 'px'; if (!o.fluid) canvas.style.height = H + 'px';
    return paint(canvasPainter(canvas, W, H, ratio), prof, Object.assign({ font: UI_FONT() }, o));
  }
  function svg(prof, o) {
    o = withNotes(o); const W = o.w || 1684, H = o.h || 1190; const font = 'IBM Plex Sans, IBM Plex Sans Arabic, IBM Plex Sans Hebrew, Arial, sans-serif';
    const pt = svgPainter(W, H, font); paint(pt, prof, Object.assign({ font }, o)); return pt.svg('Granada Atlas — ' + (prof.name || 'section'));
  }
  // vector PDF (A3 landscape): geometry and Latin text as PDF vectors; Arabic/Hebrew labels embedded as transparent images
  async function pdf(prof, o) {
    o = withNotes(o); const W = o.w || 1684, H = o.h || 1190; const pt = root.GA.pdf.vectorPainter(W, H, UI_FONT());
    paint(pt, prof, Object.assign({ font: UI_FONT() }, o)); return pt.bytes({ title: 'Granada Atlas — ' + (prof.name || 'section'), paper: 'A3L' });
  }
  function tool(map, cb) {
    let drawing = null; // {pts}
    let editing = null; // section object being edited
    const markers = []; let cursor = null; let lastDown = 0;
    const fc = (f) => ({ type: 'FeatureCollection', features: f });
    function ensure() {
      if (map.getSource('sec-lines')) return;
      map.addSource('sec-lines', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'sec-corr', type: 'fill', source: 'sec-lines', filter: ['has', 'corr'], paint: { 'fill-color': P.mark.corridor, 'fill-opacity': ['case', ['==', ['get', 'active'], 1], 0.14, 0.06], 'fill-outline-color': P.mark.corridor } });
      map.addLayer({ id: 'sec-lines-bg', type: 'line', source: 'sec-lines', filter: ['all', ['!=', ['get', 'active'], 1], ['!', ['has', 'corr']]], paint: { 'line-color': P.mark.sectionBg, 'line-width': 1.4, 'line-dasharray': [3, 2] } });
      map.addLayer({ id: 'sec-lines-on', type: 'line', source: 'sec-lines', filter: ['all', ['==', ['get', 'active'], 1], ['!', ['has', 'corr']]], paint: { 'line-color': P.mark.section, 'line-width': 2.4 } });
      map.addLayer({ id: 'sec-hit', type: 'line', source: 'sec-lines', filter: ['all', ['has', 'id'], ['!', ['has', 'corr']]], paint: { 'line-color': '#000', 'line-opacity': 0.001, 'line-width': 16 } });
    }
    let all = [];
    function render() {
      if (!map.isStyleLoaded() && !map.getSource('sec-lines')) { map.once('idle', render); return; }
      ensure();
      const feats = all.filter(s => s.pts.length > 1 && (!editing || s.id !== editing.id)).map(s => ({ type: 'Feature', properties: { active: 0, name: s.name, id: s.id }, geometry: { type: 'LineString', coordinates: s.pts } }));
      const live = drawing ? drawing.pts.concat(cursor ? [cursor] : []) : editing ? editing.pts : null;
      if (live && live.length > 1) feats.push({ type: 'Feature', properties: drawing ? { active: 1 } : { active: 1, id: editing.id }, geometry: { type: 'LineString', coordinates: live } });
      // viewing-direction arrow at the middle of each section (perpendicular, towards the side looked at)
      all.filter(s => s.pts.length > 1).forEach(s => { const pts = editing && s.id === editing.id ? editing.pts : s.pts; const u = pts.map(U); const pl = polyline(pts); const m = at(pl, pl.L / 2); let i = 1; while (i < pl.cum.length - 1 && pl.cum[i] < pl.L / 2) i++; const a = u[i - 1], b = u[i]; const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const sgn = s.look === 'right' ? -1 : 1; const n = [-(b[1] - a[1]) / L0 * sgn, (b[0] - a[0]) / L0 * sgn]; const len = Math.max(12, Math.min(40, pl.L * 0.12)); const tip = [m[0] + n[0] * len, m[1] + n[1] * len]; const back = [-n[0], -n[1]], side = [n[1], -n[0]]; const h1 = [tip[0] + (back[0] + side[0] * 0.6) * len * 0.35, tip[1] + (back[1] + side[1] * 0.6) * len * 0.35], h2 = [tip[0] + (back[0] - side[0] * 0.6) * len * 0.35, tip[1] + (back[1] - side[1] * 0.6) * len * 0.35]; const inv = (p) => PJ.EPSG25830.inverse(p); const act = editing && s.id === editing.id ? 1 : 0; feats.push({ type: 'Feature', properties: { active: act }, geometry: { type: 'MultiLineString', coordinates: [[inv(m), inv(tip)], [inv(h1), inv(tip), inv(h2)]] } }); });
      // tree corridor on the viewing side (the band from which mapped trees are projected onto the section)
      all.filter(s => s.pts.length > 1).forEach(s => { const pts = editing && s.id === editing.id ? editing.pts : s.pts; const u = pts.map(U); const c = Math.max(2, Math.min(60, +s.corridor || 15)); const sgn = s.look === 'right' ? -1 : 1;
        const off = u.map((p, i) => { const a = u[Math.max(0, i - 1)], b = u[Math.min(u.length - 1, i + 1)]; const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / L0 * sgn * c, p[1] + (b[0] - a[0]) / L0 * sgn * c]; });
        const ring = u.concat(off.reverse()).concat([u[0]]).map(p => PJ.EPSG25830.inverse(p)); feats.unshift({ type: 'Feature', properties: { active: editing && s.id === editing.id ? 1 : 0, corr: 1 }, geometry: { type: 'Polygon', coordinates: [ring] } }); });
      map.getSource('sec-lines').setData(fc(feats));
      markers.forEach(m => m.remove()); markers.length = 0;
      const pts = drawing ? drawing.pts : editing ? editing.pts : [];
      const L = LETTERS(pts.length < 2 ? 2 : pts.length);
      pts.forEach((p, i) => {
        const el = document.createElement('div'); const end = i === 0 || i === pts.length - 1; el.className = 'h h-sec' + (end ? ' end' : ''); el.textContent = drawing && !end ? '' : (drawing && i === pts.length - 1 && pts.length === 1 ? 'A' : L[i]);
        if (drawing) el.textContent = i === 0 ? 'A' : (i === pts.length - 1 ? '•' : String(i));
        el.title = editing ? t('sec.dragVertex') : ''; el.addEventListener('mousedown', () => lastDown = Date.now());
        const m = new maplibregl.Marker({ element: el, draggable: !!editing }).setLngLat(p).addTo(map); markers.push(m);
        if (editing) {
          m.on('drag', () => { const ll = m.getLngLat(); editing.pts[i] = [ll.lng, ll.lat]; map.getSource('sec-lines').setData(fc(feats.filter(f => !f.properties.active).concat([{ type: 'Feature', properties: { active: 1 }, geometry: { type: 'LineString', coordinates: editing.pts } }]))); });
          m.on('dragend', () => { cb.onEdit && cb.onEdit(editing); render(); });
          el.addEventListener('dblclick', (ev) => { ev.stopPropagation(); ev.preventDefault(); if (editing.pts.length > 2) { editing.pts.splice(i, 1); cb.onEdit && cb.onEdit(editing); render(); } });
        } else if (drawing && i === pts.length - 1 && pts.length >= 2) {
          el.style.cursor = 'pointer'; el.title = t('sec.clickFinish'); el.addEventListener('click', (ev) => { ev.stopPropagation(); api.finish(); });
        }
      });
      if (editing) editing.pts.slice(1).forEach((q, i) => { const p = editing.pts[i]; const el = document.createElement('div'); el.className = 'h h-sec-mid'; el.title = t('sec.addVertex'); el.addEventListener('mousedown', () => lastDown = Date.now());
        el.addEventListener('click', (ev) => { ev.stopPropagation(); editing.pts.splice(i + 1, 0, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); cb.onEdit && cb.onEdit(editing); render(); });
        markers.push(new maplibregl.Marker({ element: el }).setLngLat([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]).addTo(map)); });
    }
    map.on('mousemove', (e) => { if (drawing && drawing.pts.length) { cursor = [e.lngLat.lng, e.lngLat.lat]; render(); } });
    const api = {
      setSections(list, activeId) { all = list || []; editing = activeId ? all.find(s => s.id === activeId) || null : null; render(); },
      start() { drawing = { pts: [] }; editing = null; cursor = null; cb.onMode && cb.onMode('drawing'); render(); },
      // returns true when the click was consumed by the section tool
      click(e) {
        if (!drawing) return false; if (Date.now() - lastDown < 300) return true;
        const ll = [e.lngLat.lng, e.lngLat.lat]; const last = drawing.pts[drawing.pts.length - 1];
        if (last && drawing.pts.length >= 2) { const a = map.project(last); if (Math.hypot(a.x - e.point.x, a.y - e.point.y) < 10) { api.finish(); return true; } }
        drawing.pts.push(ll); render(); cb.onMode && cb.onMode('drawing', drawing.pts.length); return true;
      },
      finish() { if (!drawing) return; const pts = drawing.pts; drawing = null; cursor = null; if (pts.length >= 2) cb.onCreate && cb.onCreate(pts); cb.onMode && cb.onMode(null); render(); },
      cancel() { drawing = null; cursor = null; cb.onMode && cb.onMode(null); render(); },
      undoPoint() { if (drawing && drawing.pts.length) { drawing.pts.pop(); render(); cb.onMode && cb.onMode('drawing', drawing.pts.length); } },
      isDrawing: () => !!drawing, render,
    };
    return api;
  }

  root.GA.section = { compute, draw, svg, pdf, tool, chooseVE, LETTERS, polyline, optsFor, parseFloors, MAT };
})(window);
