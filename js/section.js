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
    const groundMin = (d0, d1) => { let m = null; for (let i = Math.floor(d0 / step); i <= Math.ceil(d1 / step) && i < n; i++) if (elev[i] != null && (m == null || elev[i] < m)) m = elev[i]; return m; };
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
        if (intervals.length) intervals.forEach(([a, b]) => { const base = groundMin(a, b); cuts.push(Object.assign({ id: pr.id, name: pr.nm || null, type: pr.b, d0: a, d1: b, base, material }, attrs, height)); });
        else {
          const c = rings[0].reduce((s, p) => [s[0] + p[0] / rings[0].length, s[1] + p[1] / rings[0].length], [0, 0]); const pj = project(pl, c);
          if (pj.off > 60) return; if (sideOf(c) !== look) return; if (height.h == null) { bgUnknown++; return; }
          const ext = rings[0].map(p => project(pl, p).d); const d0 = Math.min(...ext), d1 = Math.max(...ext); if (d1 - d0 < 0.5) return;
          bg.push(Object.assign({ id: pr.id, name: pr.nm || null, d0, d1, off: pj.off, base: ground(pj.d), material }, attrs, height));
        }
      });
    });
    bg.sort((a, b) => b.off - a.off);
    // ground surfaces from mapped data: green areas crossed (parks, grass, woodland), streets and watercourses crossed
    const surf = { green: [], streets: [], water: [] }; let sErr = null;
    try {
      const bbL = G.bbox(sec.pts);
      const [st, pk, lu, wa] = await Promise.all([D.chunked('streets', bbL, 30, 40).catch(() => []), D.chunked('parks', bbL, 30, 40).catch(() => []), D.chunked('landuse', bbL, 30, 40).catch(() => []), D.single('water').then(j => j.features).catch(() => [])]);
      const inBB = (c) => c[0] >= bbL[0] - 0.003 && c[0] <= bbL[2] + 0.003 && c[1] >= bbL[1] - 0.003 && c[1] <= bbL[3] + 0.003;
      const crossings = (fs, kind) => { const out = []; const seen = new Set(); fs.forEach(f => { const g = f.geometry; const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []; lines.forEach(Lc => { if (!Lc.some(inBB)) return; const C = Lc.map(U); for (let i = 1; i < pl.u.length; i++) for (let j = 1; j < C.length; j++) { const tt = segX(pl.u[i - 1], pl.u[i], C[j - 1], C[j]); if (tt == null) continue; const d = pl.cum[i - 1] + tt * (pl.cum[i] - pl.cum[i - 1]); const key = f.properties.id + ':' + Math.round(d); if (seen.has(key)) continue; seen.add(key); const a1 = Math.atan2(pl.u[i][1] - pl.u[i - 1][1], pl.u[i][0] - pl.u[i - 1][0]), a2 = Math.atan2(C[j][1] - C[j - 1][1], C[j][0] - C[j - 1][0]); out.push({ d, sin: Math.max(0.2, Math.abs(Math.sin(a1 - a2))), p: f.properties, kind }); } }); }); return out; };
      crossings(st, 'street').forEach(c => { const p = c.p; const lanes = p.ln != null && isFinite(parseFloat(p.ln)) ? parseFloat(p.ln) : null; const sideW = /both/.test(p.sw || '') ? 2 : /left|right/.test(p.sw || '') ? 1 : 0;
        const w = lanes ? lanes * 3.0 + sideW * 1.5 : null; surf.streets.push({ d: c.d, span: w ? w / c.sin : null, name: p.nm || null, hw: p.hw, surface: p.sf || null, lanes, sidewalk: p.sw || null, bridge: !!p.br, tunnel: !!p.tu }); });
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
    const corridor = Math.max(2, Math.min(60, +sec.corridor || 15)), NEAR = 5;
    const trees = []; let tErr = null, treeTs = null, rowsNear = 0;
    if (root.GA.ext) { try {
      const bb = G.bbox(sec.pts); const pad = corridor / 80000; const r = await root.GA.ext.trees([bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad]); treeTs = r.ts;
      const num = (v) => { const x = parseFloat(String(v || '').replace(',', '.')); return isFinite(x) && x > 0 ? x : null; };
      r.pts.forEach(p => { const u = U(p.ll); const pj = project(pl, u); if (pj.d <= 0 || pj.d >= pl.L || pj.off > corridor) return; if (pj.off > 1.5 && sideOf(u) !== look) return;
        trees.push({ id: p.id, d: pj.d, off: pj.off, near: pj.off <= NEAR, base: ground(pj.d), h: num(p.tags.height), crown: num(p.tags.diameter_crown), species: p.tags.species || p.tags.genus || p.tags['species:es'] || null }); });
      r.ways.forEach(w => { const C = w.coords.map(U); let crossed = false;
        for (let i = 1; i < pl.u.length; i++) for (let j = 1; j < C.length; j++) { const tt = segX(pl.u[i - 1], pl.u[i], C[j - 1], C[j]); if (tt != null) { const d = pl.cum[i - 1] + tt * (pl.cum[i] - pl.cum[i - 1]); trees.push({ id: w.id, row: true, d, off: 0, near: true, base: ground(d), h: null, crown: null }); crossed = true; } }
        if (!crossed && C.some(c => { const pj = project(pl, c); return pj.off <= corridor && pj.d > 0 && pj.d < pl.L && sideOf(c) === look; })) rowsNear++; });
    } catch (e) { tErr = e.message; } }
    trees.sort((a, b) => b.off - a.off);
    const A0 = PJ.EPSG25830.inverse(pl.u[0]), B0 = PJ.EPSG25830.inverse(pl.u[pl.u.length - 1]);
    const az = (Math.atan2(pl.u[pl.u.length - 1][0] - pl.u[0][0], pl.u[pl.u.length - 1][1] - pl.u[0][1]) * 180 / Math.PI + 360) % 360;
    return { id: sec.id, name: sec.name, pts: sec.pts, L: pl.L, step, dist, elev, min: Math.min(...ev), max: Math.max(...ev), missing,
      maxGrad: maxG, maxGradAt: maxAt, baseline: k * step, hornMax, cuts: cuts.sort((a, b) => a.d0 - b.d0), bg, bgUnknown, trees, tErr, treeTs, corridor, nearTrees: NEAR, rowsNear, surf, sErr, floorH, bErr, look, coverage: { demMissing: missing / n, outsideRegion: outRegion / n, bCells },
      ref: { a: pl.u[0], b: pl.u[pl.u.length - 1], aLL: A0, bLL: B0, azimuth: az }, vertexD: pl.cum.slice(), computed: new Date().toISOString() };
  }

  // ---------- drawing: one routine, two back-ends (canvas for screen/PNG, SVG for vector export) ----------
  function canvasPainter(canvas, W, H, ratio) {
    canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio); const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const style = (o) => { ctx.setLineDash(o.dash || []); ctx.lineWidth = o.lw || 1; ctx.strokeStyle = o.stroke || 'none'; ctx.fillStyle = o.fill || 'none'; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; };
    const done = (o) => { if (o.fill) ctx.fill(o.evenodd ? 'evenodd' : 'nonzero'); if (o.stroke) ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]); };
    return {
      W, H, measure: (s, f) => { ctx.font = f; return ctx.measureText(s).width; },
      rect(x, y, w, h, o) { style(o); ctx.beginPath(); ctx.rect(x, y, w, h); done(o); },
      path(pts, o) { if (!pts.length) return; style(o); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (o.close) ctx.closePath(); done(o); },
      circle(x, y, r, o) { style(o); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); done(o); },
      text(s, x, y, o) { ctx.font = `${o.weight || 400} ${o.size || 11}px ${o.font}`; ctx.fillStyle = o.color || '#1C1E21'; ctx.globalAlpha = 1; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.baseline || 'alphabetic'; ctx.direction = o.dir || 'ltr'; if (o.rotate) { ctx.save(); ctx.translate(x, y); ctx.rotate(o.rotate); ctx.fillText(s, 0, 0); ctx.restore(); } else ctx.fillText(s, x, y); ctx.direction = 'ltr'; },
      clip(x, y, w, h) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }, unclip() { ctx.restore(); },
    };
  }
  function svgPainter(W, H, font) {
    const out = []; const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); let clipN = 0, inClip = false;
    const meas = document.createElement('canvas').getContext('2d');
    const st = (o) => `fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.lw || 1}"${o.dash ? ` stroke-dasharray="${o.dash.join(' ')}"` : ''}${o.alpha != null ? ` opacity="${o.alpha}"` : ''}${o.evenodd ? ' fill-rule="evenodd"' : ''} stroke-linejoin="round"`;
    const f = (v) => (+v).toFixed(2);
    return {
      W, H, measure: (s, fnt) => { meas.font = fnt; return meas.measureText(s).width; },
      rect(x, y, w, h, o) { out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" ${st(o)}/>`); },
      path(pts, o) { if (!pts.length) return; out.push(`<path d="${pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('')}${o.close ? 'Z' : ''}" ${st(o)}/>`); },
      circle(x, y, r, o) { out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" ${st(o)}/>`); },
      text(s, x, y, o) { const anchor = { left: 'start', right: 'end', center: 'middle', start: 'start', end: 'end' }[o.align || 'left']; const base = { top: 'hanging', middle: 'central', bottom: 'text-after-edge', alphabetic: 'alphabetic' }[o.baseline || 'alphabetic']; out.push(`<text x="${f(x)}" y="${f(y)}" font-family="${e(o.font)}" font-size="${o.size || 11}" font-weight="${o.weight || 400}" fill="${o.color || '#1C1E21'}" text-anchor="${anchor}" dominant-baseline="${base}"${o.dir === 'rtl' ? ' direction="rtl" unicode-bidi="embed"' : ''}${o.rotate ? ` transform="rotate(${o.rotate * 180 / Math.PI} ${f(x)} ${f(y)})"` : ''}>${e(s)}</text>`); },
      clip(x, y, w, h) { clipN++; out.push(`<clipPath id="c${clipN}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath><g clip-path="url(#c${clipN})">`); inClip = true; },
      unclip() { if (inClip) out.push('</g>'); inClip = false; },
      svg() { return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<rect width="100%" height="100%" fill="#FFFFFF"/>\n${out.join('\n')}\n</svg>`; },
    };
  }
  function chooseVE(prof, W, H) {
    const plotW = W - 70, plotH = H - 120; const xs = plotW / prof.L;
    const tops = prof.cuts.concat(prof.bg).filter(c => c.h != null).map(c => c.base + c.h); const top = Math.max(prof.max, ...tops);
    const range = Math.max(5, top - prof.min) * 1.15;
    for (const ve of [1, 2, 3, 5, 10, 20]) if (range * xs * ve >= plotH * 0.35) return ve;
    return 20;
  }
  const RED = '#992B2A', INK = '#1C1E21';
  // Drawing hierarchy: cut buildings = red outline, white interior; elevations behind = fine grey, paler with distance;
  // terrain = continuous dark line; trees = mapped positions. Detail has two levels: (1) evidence — OSM attributes
  // (roof shape, roof levels, floors, underground floors, street surface/lanes, green areas) and details the user
  // documented with a source; (2) optional illustrative detail (o.illustrative), drawn lighter and labelled as such.
  const ROOF_TRI = /^(gabled|pyramidal|saltbox|crosspitched|gambrel)$/, ROOF_TRAP = /^(hipped|side_hipped|half-hipped|quadruple_saltbox|mansard)$/, ROOF_ARC = /^(round|dome|onion)$/;
  const MAT = { tiles: '#B5654A', slate: '#59606A', metal: '#8A9097', green: '#6E9461', membrane: '#A8A8A8', render: '#D9D3C7', brick: '#B9785C', stone: '#BFB6A4', concrete: '#B3B5B8', glass: '#9DB4C0', timber: '#A07A52' };
  function paint(pt, prof, o) {
    const W = pt.W, H = pt.H; const font = o.font; const rtl = I.dir() === 'rtl'; const notes = o.notes || {}; const ill = !!o.illustrative;
    const fs = W >= 1200 ? 12 : 10; const floorH = prof.floorH || 3;
    pt.rect(0, 0, W, H, { fill: '#FFFFFF' });
    const ml = 50, mr = 18, mt = 34, mb = 70; const pw = W - ml - mr, ph = H - mt - mb;
    const ve = o.ve === 'auto' || !o.ve ? chooseVE(prof, W, H) : +o.ve;
    const xs = pw / prof.L; const ys = xs * ve;
    const treeH = (tr) => tr.h || 0;
    const tops = prof.cuts.concat(prof.bg).filter(c => c.h != null).map(c => c.base + c.h + (c.rl ? 0 : 0)).concat((prof.trees || []).map(tr => tr.base + treeH(tr)));
    const bottoms = prof.cuts.filter(c => c.lvu && c.base != null).map(c => c.base - c.lvu * floorH);
    const top = Math.max(prof.max, ...tops); const bot = Math.min(prof.min, ...bottoms); const mid = (bot + top) / 2;
    let lo = mid - ph / 2 / ys; if (lo > bot - 2) lo = bot - Math.max(2, (top - bot) * 0.08);
    if ((top - bot) * ys > ph * 0.94) lo = bot - (ph * 0.04) / ys; // too tall for the chosen exaggeration: keep the ground in view, let the tops run off
    const X = (d) => ml + d * xs, Y = (e) => mt + ph - (e - lo) * ys;
    const hiE = lo + ph / ys; const eStep = [1, 2, 5, 10, 20, 25, 50, 100].find(s => (hiE - lo) / s <= 7) || 200;
    const hits = []; const flags = { roofSchematic: false, roofLevels: false, basement: false, illustrative: false, documented: false, streetEst: false, green: false };
    pt.clip(ml, mt, pw, ph);
    for (let e = Math.ceil(lo / eStep) * eStep; e <= hiE; e += eStep) pt.path([[ml, Y(e)], [ml + pw, Y(e)]], { stroke: '#F1F1EF', lw: 0.7 });
    // ---- roof geometry for an envelope [x0,x1] whose eaves are at yE (screen) ----
    const roofPts = (shape, x0, x1, yE, rh) => { const yR = yE - rh; const w = x1 - x0;
      if (ROOF_TRI.test(shape)) return [[x0, yE], [(x0 + x1) / 2, yR], [x1, yE]];
      if (ROOF_TRAP.test(shape)) return [[x0, yE], [x0 + w * 0.3, yR], [x1 - w * 0.3, yR], [x1, yE]];
      if (shape === 'skillion') return [[x0, yE], [x0, yR], [x1, yE]];
      if (ROOF_ARC.test(shape)) { const out = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; out.push([x0 + w / 2 - Math.cos(a) * w / 2, yE - Math.sin(a) * rh]); } return out; }
      return null; };
    const roofH = (c, w_m) => c.rl ? c.rl * floorH : Math.max(1.2, Math.min(3.5, w_m * 0.25)); // roof:levels × floor height, else schematic
    const matBand = (pts, col, off) => { if (!col) return; pt.path(pts.map(([x, y]) => [x, y - off]), { stroke: col, lw: 2.2, alpha: 0.85 }); };
    // ---- textures (subtle, exterior surfaces / background elevations only) ----
    const texture = (x0, y0, x1, y1, mat, alpha) => { const col = MAT[mat]; if (!col) return; pt.rect(x0, y0, x1 - x0, y1 - y0, { fill: col, alpha: 0.12 * alpha });
      if (mat === 'brick') { const sp = Math.max(3, 0.6 * ys); for (let y = y1 - sp; y > y0; y -= sp) pt.path([[x0, y], [x1, y]], { stroke: col, lw: 0.4, alpha: 0.5 * alpha }); }
      else if (mat === 'stone') { const sp = Math.max(5, 1.2 * ys); for (let y = y1 - sp; y > y0; y -= sp) pt.path([[x0, y], [x1, y]], { stroke: col, lw: 0.5, alpha: 0.5 * alpha }); }
      else if (mat === 'glass') { const sp = Math.max(6, 1.5 * xs); for (let x = x0 + sp; x < x1; x += sp) pt.path([[x, y0], [x, y1]], { stroke: col, lw: 0.4, alpha: 0.5 * alpha }); } };
    const windows = (x0, x1, base, levels, alpha) => { // illustrative openings: one row per floor, regular spacing — not surveyed
      const ww = 1.2 * xs, wh = 1.4 * ys, sp = 3.2 * xs; if (ww < 1.5 || wh < 1.5) return; flags.illustrative = true;
      for (let k = 0; k < levels; k++) { const yb = Y(base + k * floorH + 0.9); for (let x = x0 + sp / 2; x + ww < x1 - sp / 4; x += sp) pt.rect(x, yb - wh, ww, wh, { stroke: '#B9BBBE', lw: 0.5, alpha, dash: [1.5, 1.2] }); } };
    // ---- trees ----
    const drawTree = (tr) => {
      if (tr.base == null) return; const near = tr.near; const col = near ? '#4E6B45' : '#93A68B'; const lw = near ? 1.1 : 0.7; const alpha = near ? 1 : 0.55;
      const x = X(tr.d), y0 = Y(tr.base); const sc = W >= 1200 ? 1.4 : 1;
      if (tr.h) { const tp = Y(tr.base + tr.h); const r = tr.crown ? Math.max(2, tr.crown / 2 * xs) : Math.max(3, Math.min((y0 - tp) * 0.3, tr.h * 0.3 * xs)); const cy = tp + Math.min(r, (y0 - tp) * 0.45);
        pt.path([[x, y0], [x, cy + r * 0.5]], { stroke: col, lw, alpha }); pt.circle(x, cy, r, { fill: '#FFFFFF', stroke: col, lw, alpha, dash: tr.crown ? null : [3, 2] }); }
      else { const r = (tr.row ? 4 : 5) * sc; pt.path([[x, y0], [x, y0 - 9 * sc]], { stroke: col, lw, alpha }); pt.circle(x, y0 - 9 * sc - r, r, { fill: '#FFFFFF', stroke: col, lw, alpha, dash: [2, 1.6] }); if (tr.row) pt.text(t('v5.row'), x, y0 - 9 * sc - 2 * r - 3, { font, size: 8, align: 'center', color: col }); }
    };
    const trs = (prof.trees || []).slice().sort((a, b) => b.off - a.off);
    // ---- background elevations (with mapped roof shapes, documented materials, illustrative openings) ----
    const drawBg = (b) => {
      const fade = Math.max(0.25, 1 - b.off / 70); const n = notes[b.id] || {}; const col = '#B9BBBE';
      const x0 = X(b.d0), x1 = X(b.d1); const shape = n.roof || b.rs; const rh = shape && !/^(flat|many|multi)$/.test(shape) ? roofH(b, b.d1 - b.d0) : 0;
      const hWall = b.src === 'height' ? Math.max(1, b.h - rh) : b.h; const yE = Y(b.base + hWall), yB = Y(b.base);
      pt.rect(x0, yE, x1 - x0, yB - yE, { fill: '#FFFFFF', stroke: col, lw: 0.7, alpha: fade });
      if (n.wall) { texture(x0, yE, x1, yB, n.wall, fade); flags.documented = true; }
      if (n.openings === 'regular' && b.lv) { windows(x0, x1, b.base, b.lv, fade); flags.documented = true; } else if (ill && b.lv) windows(x0, x1, b.base, b.lv, fade * 0.8);
      if (rh) { const rp = roofPts(shape, x0, x1, yE, rh * ys); if (rp) { pt.path(rp, { stroke: col, lw: 0.7, alpha: fade, fill: '#FFFFFF' }); if (n.roofMat) matBand(rp, MAT[n.roofMat], 1.5); } }
      hits.push({ id: b.id, kind: 'bg', x0, x1, y0: Y(b.base + b.h), y1: yB, b });
    };
    prof.bg.map(b => ({ off: b.off, f: () => drawBg(b) })).concat(trs.filter(tr => !tr.near).map(tr => ({ off: tr.off, f: () => drawTree(tr) }))).sort((a, b) => b.off - a.off).forEach(x => x.f());
    trs.filter(tr => tr.near).forEach(drawTree);
    // ---- terrain and ground surfaces ----
    const g = []; prof.dist.forEach((d, i) => { const e = prof.elev[i]; if (e != null) g.push([X(d), Y(e)]); });
    const gy = (d) => { const i = Math.max(0, Math.min(prof.elev.length - 1, Math.round(d / prof.step))); return prof.elev[i] == null ? null : Y(prof.elev[i]); };
    if (g.length) pt.path(g.concat([[g[g.length - 1][0], mt + ph + 2], [g[0][0], mt + ph + 2]]), { fill: '#F4F3F0', close: true });
    const sf = prof.surf || { green: [], streets: [], water: [] };
    sf.green.forEach(z => { flags.green = true; const seg = g.filter(p => p[0] >= X(z.d0) && p[0] <= X(z.d1)); if (seg.length > 1) { pt.path(seg, { stroke: '#7FA071', lw: 3.2, alpha: 0.7 }); for (let x = X(z.d0) + 3; x < X(z.d1); x += 5) { const y = gy((x - ml) / xs); if (y != null) pt.path([[x, y - 1], [x + 1.2, y - 4]], { stroke: '#7FA071', lw: 0.6, alpha: 0.8 }); } } });
    sf.streets.forEach(z => { const y = gy(z.d); if (y == null) return; if (z.span) { flags.streetEst = true; const a = X(z.d - z.span / 2), b2 = X(z.d + z.span / 2); pt.path([[a, y], [b2, y]], { stroke: '#5E636A', lw: 2.6, alpha: 0.75 }); if (/sett|cobble|paving|stone/.test(z.surface || '')) for (let x = a + 2; x < b2; x += 3) pt.path([[x, y + 1.8], [x, y + 3.4]], { stroke: '#5E636A', lw: 0.5 }); pt.path([[a, y - 3], [a, y + 3]], { stroke: '#5E636A', lw: 0.6 }); pt.path([[b2, y - 3], [b2, y + 3]], { stroke: '#5E636A', lw: 0.6 }); } else pt.path([[X(z.d), y - 3], [X(z.d), y + 3]], { stroke: '#5E636A', lw: 0.9 }); });
    sf.water.forEach(z => { const y = gy(z.d); if (y == null) return; const x = X(z.d); pt.path([[x - 5, y + 2], [x - 2.5, y], [x, y + 2], [x + 2.5, y], [x + 5, y + 2]], { stroke: '#4E7FA6', lw: 1.1 }); });
    if (g.length) pt.path(g, { stroke: INK, lw: 1.7 });
    // ---- cut buildings: red outline, white interior; mapped roof shape; floors and underground floors from OSM ----
    prof.cuts.forEach((c, ci) => {
      if (c.base == null) return; const x0 = X(c.d0), x1 = X(c.d1); const y0 = Y(c.base); const n = notes[c.id] || {};
      if (n.wall || n.roofMat || n.balconies) flags.documented = true;
      if (c.h == null) { pt.path([[x0, y0 - 1.5], [x1, y0 - 1.5]], { stroke: RED, lw: 3 }); hits.push({ id: c.id, kind: 'cut', x0, x1, y0: y0 - 12, y1: y0 + 2, c }); return; }
      const shape = n.roof || c.rs; const pitched = shape && !/^(flat|many|multi|not applicable)$/.test(shape);
      const rh = pitched ? roofH(c, c.d1 - c.d0) : 0; if (pitched) { if (c.rl) flags.roofLevels = true; else flags.roofSchematic = true; }
      const hWall = c.src === 'height' ? Math.max(1, c.h - rh) : c.h; const yE = Y(c.base + hWall);
      // exterior material band (documented) — outside the walls, interior stays white
      if (n.wall && MAT[n.wall]) { pt.path([[x0 - 2, y0], [x0 - 2, yE]], { stroke: MAT[n.wall], lw: 2.2, alpha: 0.85 }); pt.path([[x1 + 2, y0], [x1 + 2, yE]], { stroke: MAT[n.wall], lw: 2.2, alpha: 0.85 }); }
      pt.rect(x0, yE, x1 - x0, y0 - yE, { fill: '#FFFFFF' });
      const solid = c.src === 'height';
      pt.path([[x0, y0], [x0, yE]], { stroke: RED, lw: 2.2 }); pt.path([[x1, y0], [x1, yE]], { stroke: RED, lw: 2.2 });
      const rp = pitched ? roofPts(shape, x0, x1, yE, rh * ys) : null;
      if (rp) { pt.path(rp.concat([[rp[0][0], rp[0][1]]]), { fill: '#FFFFFF' }); pt.path(rp, { stroke: RED, lw: c.rl || n.roofH ? 2.2 : 1.6, dash: c.rl || n.roofH ? null : [4, 3] }); pt.path([[x0, yE], [x1, yE]], { stroke: RED, lw: 0.6, alpha: 0.5 }); if (n.roofMat) matBand(rp, MAT[n.roofMat], 2.5); }
      else pt.path([[x0, yE], [x1, yE]], { stroke: RED, lw: 2.2, dash: solid ? null : [4, 3] });
      if (shape && /^(many|multi)$/.test(shape)) pt.text(t('v5.roofComplex'), (x0 + x1) / 2, yE + 10, { font, size: 8, align: 'center', color: RED });
      if ((o.floors || ill) && c.lv && c.lv > 1) for (let k = 1; k < c.lv; k++) { const yy = Y(c.base + hWall * k / c.lv); pt.path([[x0 + 1, yy], [x1 - 1, yy]], { stroke: RED, lw: 0.5, dash: [2, 2], alpha: 0.55 }); }
      if (c.lvu) { flags.basement = true; const yb = Y(c.base - c.lvu * floorH); pt.path([[x0, y0], [x0, yb], [x1, yb], [x1, y0]], { stroke: RED, lw: 0.9, dash: [3, 2], alpha: 0.7 }); }
      // balconies: only where documented by the user (with a source); on facades that face open ground
      if (n.balconies === 'yes' && c.lv) {
        const floors = parseFloors(n.balconyFloors, c.lv); const prev = prof.cuts[ci - 1], next = prof.cuts[ci + 1];
        const sides = []; if (!prev || prev.d1 < c.d0 - 0.5) sides.push(-1); if (!next || next.d0 > c.d1 + 0.5) sides.push(1);
        const dep = 1.2 * xs; sides.forEach(sd => floors.forEach(k => { const yy = Y(c.base + hWall * k / c.lv); const xa = sd < 0 ? x0 : x1, xb = xa + sd * dep; pt.path([[xa, yy], [xb, yy]], { stroke: '#3C4046', lw: 1.6 }); pt.path([[xb, yy], [xb, yy - 1.0 * ys]], { stroke: '#3C4046', lw: 0.7 }); pt.path([[xa, yy - 1.0 * ys], [xb, yy - 1.0 * ys]], { stroke: '#3C4046', lw: 0.7 }); }));
      }
      hits.push({ id: c.id, kind: 'cut', x0, x1, y0: Y(c.base + c.h), y1: y0, c });
    });
    pt.unclip();
    // ---- labels: heights on cut buildings, street and watercourse names below the ground ----
    let lastX = -1e9; prof.cuts.forEach(c => { if (c.base == null) return; const xm = X((c.d0 + c.d1) / 2); if (xm - lastX < 30) return; const y = Math.max(mt + 10, Y(c.base + (c.h || 0)) - 4); const txt = c.h == null ? '?' : c.src === 'height' ? nf(c.h, 1) + ' m' : '≈' + nf(c.h, 0) + ' m'; pt.text(txt, xm, y, { font, size: fs, align: 'center', color: c.h == null ? RED : INK }); lastX = xm; });
    let lastS = -1e9; const named = new Set(); sf.streets.concat(sf.water.map(w => Object.assign({ water: true }, w))).sort((a, b) => a.d - b.d).forEach(z => { const x = X(z.d); const y = gy(z.d); if (y == null || !z.name || named.has(z.name)) return; const tw = pt.measure(z.name, `${fs - 1}px ${font}`); if (x - tw / 2 < lastS + 8) return; pt.text(z.name, x, Math.min(mt + ph - 4, y + fs + 8), { font, size: fs - 1, align: 'center', color: z.water ? '#4E7FA6' : '#5E636A', dir: 'auto' }); lastS = x + tw / 2; named.add(z.name); });
    // scale figure (1.75 m) near A
    { const d = Math.min(prof.L * 0.03 + 2 / xs, prof.L * 0.1); const i = Math.max(0, Math.min(prof.dist.length - 1, Math.round(d / prof.step))); const e = prof.elev[i]; if (e != null) { const x = X(prof.dist[i]), y = Y(e), hh = 1.75 * ys; if (hh > 4) { pt.path([[x, y], [x, y - hh * 0.82]], { stroke: '#5E636A', lw: Math.max(0.8, hh * 0.06) }); pt.circle(x, y - hh * 0.9, Math.max(1, hh * 0.09), { fill: '#5E636A' }); } } }
    // elevation axis only (no distance axis): the scale bar gives distance
    pt.path([[ml, mt], [ml, mt + ph]], { stroke: INK, lw: 1 });
    for (let e = Math.ceil(lo / eStep) * eStep; e <= hiE; e += eStep) pt.text(nf(e), ml - 5, Y(e), { font, size: fs - 1, align: 'right', baseline: 'middle', color: '#3C4046' });
    pt.text(t('sec.elevAxis'), 12, mt + ph / 2, { font, size: fs - 1, align: 'center', baseline: 'middle', color: '#3C4046', rotate: -Math.PI / 2, dir: I.dir() });
    // discreet scale bar outside the drawing (+ vertical bar showing the exaggeration)
    { const len = [5, 10, 20, 25, 50, 100, 200, 500].find(v => v * xs >= 60) || 1000; const x0 = ml, y0 = mt + ph + 22; pt.rect(x0, y0, len * xs, 2.5, { fill: INK }); pt.text(`${len} m`, x0 + len * xs + 5, y0 + 2, { font, size: fs - 1, baseline: 'middle' });
      if (ve !== 1) { const vl = [50, 20, 10, 5, 2, 1].find(v => v * ys <= 30) || 1; const vx = x0 + len * xs + 56; pt.rect(vx, y0 + 2.5 - vl * ys, 2.5, vl * ys, { fill: RED }); pt.text(`${vl} m ↕`, vx + 6, y0 + 2, { font, size: fs - 1, baseline: 'middle', color: RED }); } }
    // vertex letters
    const Ls = LETTERS(prof.vertexD.length);
    prof.vertexD.forEach((d, i) => { const x = X(d); pt.path([[x, mt], [x, mt + ph]], { stroke: RED, lw: 0.8, dash: [2, 2] }); pt.text(Ls[i], x + (i === 0 ? 3 : i === Ls.length - 1 ? -3 : 0), mt - 8, { font, size: fs + 2, weight: 700, color: RED, align: i === 0 ? 'left' : i === Ls.length - 1 ? 'right' : 'center' }); });
    // title (with the vertical exaggeration stated) and one concise essential note; long methods live outside the drawing
    const veTxt = ve === 1 ? t('sec.ve1') : t('sec.ve', { v: ve }); const r = prof.ref;
    const tx = rtl ? W - 8 : 8; const al = rtl ? 'right' : 'left';
    pt.text((prof.name || '') + ' · ' + veTxt, tx, H - 30, { font, size: fs + 1, weight: 700, align: al, dir: I.dir(), color: ve === 1 ? INK : RED });
    const ess = [t('v5.secEss', { c: nf(prof.corridor || 15) }), flags.roofSchematic ? t('v5.secRoofSch') : '', ill && flags.illustrative ? t('v5.secIll') : '', flags.documented ? t('v5.secDoc') : ''].filter(Boolean).join(' ');
    pt.text(ess, tx, H - 16, { font, size: fs - 1, align: al, color: '#3C4046', dir: I.dir() });
    const attrib = `IGN MDT25 · OpenStreetMap (ODbL)${(prof.trees || []).length ? ' · OSM trees ' + (prof.treeTs || '').slice(0, 10) : ''}` + (r ? ` · A ${r.aLL[1].toFixed(5)}, ${r.aLL[0].toFixed(5)} → B ${r.bLL[1].toFixed(5)}, ${r.bLL[0].toFixed(5)} · ${nf(r.azimuth)}°` : '');
    pt.text(attrib, tx, H - 4, { font, size: fs - 2, align: al, color: '#6B7077', dir: 'ltr' });
    return { ve, X, Y, hits, flags, xs, ys };
  }
  function parseFloors(s, lv) { // "2-4", "1,3", "all" → floor indices (1 = first floor above ground)
    const out = new Set(); const str = String(s || '').trim().toLowerCase();
    if (!str || /all|todas|כל|جميع/.test(str)) { for (let k = 1; k < lv; k++) out.add(k); return [...out]; }
    str.split(/[,;\s]+/).forEach(p => { const m = p.match(/^(\d+)(?:-(\d+))?$/); if (!m) return; const a = +m[1], b = m[2] ? +m[2] : a; for (let k = a; k <= b && k < lv; k++) if (k >= 1) out.add(k); });
    return [...out];
  }
  const withNotes = (o) => Object.assign({ notes: (root.GA.store && root.GA.store.get && root.GA.store.get().buildingNotes) || {} }, o || {});
  const optsFor = (s) => ({ ve: (s && s.ve) || 'auto', floors: !!(s && s.floors), illustrative: !!(s && s.ill) });
  function draw(canvas, prof, o) {
    o = withNotes(o); const ratio = o.ratio || (root.devicePixelRatio || 1); const W = o.w || 600, H = o.h || 300;
    canvas.style.width = o.fluid ? '100%' : W + 'px'; if (!o.fluid) canvas.style.height = H + 'px';
    const font = getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif';
    return paint(canvasPainter(canvas, W, H, ratio), prof, Object.assign({ font }, o));
  }
  function svg(prof, o) {
    o = withNotes(o); const W = o.w || 1600, H = o.h || 720; const font = 'IBM Plex Sans, IBM Plex Sans Arabic, IBM Plex Sans Hebrew, Arial, sans-serif';
    const pt = svgPainter(W, H, font); paint(pt, prof, Object.assign({ font }, o)); return pt.svg();
  }

  // ---------- map tool: draw and edit sections ----------
  function tool(map, cb) {
    let drawing = null; // {pts}
    let editing = null; // section object being edited
    const markers = []; let cursor = null; let lastDown = 0;
    const fc = (f) => ({ type: 'FeatureCollection', features: f });
    function ensure() {
      if (map.getSource('sec-lines')) return;
      map.addSource('sec-lines', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'sec-corr', type: 'fill', source: 'sec-lines', filter: ['has', 'corr'], paint: { 'fill-color': '#4E6B45', 'fill-opacity': ['case', ['==', ['get', 'active'], 1], 0.14, 0.06], 'fill-outline-color': '#4E6B45' } });
      map.addLayer({ id: 'sec-lines-bg', type: 'line', source: 'sec-lines', filter: ['all', ['!=', ['get', 'active'], 1], ['!', ['has', 'corr']]], paint: { 'line-color': '#5E636A', 'line-width': 1.4, 'line-dasharray': [3, 2] } });
      map.addLayer({ id: 'sec-lines-on', type: 'line', source: 'sec-lines', filter: ['all', ['==', ['get', 'active'], 1], ['!', ['has', 'corr']]], paint: { 'line-color': '#1C1E21', 'line-width': 2.4 } });
    }
    let all = [];
    function render() {
      if (!map.isStyleLoaded() && !map.getSource('sec-lines')) { map.once('idle', render); return; }
      ensure();
      const feats = all.filter(s => s.pts.length > 1 && (!editing || s.id !== editing.id)).map(s => ({ type: 'Feature', properties: { active: 0, name: s.name }, geometry: { type: 'LineString', coordinates: s.pts } }));
      const live = drawing ? drawing.pts.concat(cursor ? [cursor] : []) : editing ? editing.pts : null;
      if (live && live.length > 1) feats.push({ type: 'Feature', properties: { active: 1 }, geometry: { type: 'LineString', coordinates: live } });
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

  root.GA.section = { compute, draw, svg, tool, chooseVE, LETTERS, polyline, optsFor, parseFloors, MAT };
})(window);
