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
  async function compute(sec, opts) {
    opts = opts || {}; const floorH = opts.floorH || 3.0;
    const pl = polyline(sec.pts); if (pl.L < 5) throw new Error(t('sec.tooShort'));
    const dem = await D.grid('dem'); const slope = await D.grid('slope').catch(() => null);
    const step = Math.max(2, Math.min(10, pl.L / 500)); const n = Math.ceil(pl.L / step) + 1;
    const dist = [], elev = []; let missing = 0;
    for (let i = 0; i < n; i++) { const d = Math.min(pl.L, i * step); const p = at(pl, d); const v = D.sampleGrid(dem, p[0], p[1]); dist.push(d); elev.push(v); if (v == null) missing++; }
    if (missing === n) { const e = new Error(t('sec.outside')); e.code = 'outside'; throw e; }
    const ev = elev.filter(v => v != null);
    // slope along the line over a baseline of at least 25 m (one DEM cell), reported in % and degrees
    const k = Math.max(1, Math.ceil(25 / step)); let maxG = 0, maxAt = null;
    for (let i = 0; i + k < n; i++) { if (elev[i] == null || elev[i + k] == null) continue; const g = Math.abs(elev[i + k] - elev[i]) / (dist[i + k] - dist[i]); if (g > maxG) { maxG = g; maxAt = dist[i] + (dist[i + k] - dist[i]) / 2; } }
    let hornMax = null; if (slope) for (let i = 0; i < n; i += Math.max(1, Math.round(12 / step))) { const p = at(pl, dist[i]); const v = D.sampleGrid(slope, p[0], p[1], true); if (v != null && (hornMax == null || v > hornMax)) hornMax = v; }
    const ground = (d) => { const i = Math.max(0, Math.min(n - 1, Math.round(d / step))); return elev[i]; };
    const groundMin = (d0, d1) => { let m = null; for (let i = Math.floor(d0 / step); i <= Math.ceil(d1 / step) && i < n; i++) if (elev[i] != null && (m == null || elev[i] < m)) m = elev[i]; return m; };

    // buildings
    let feats = []; let bErr = null;
    try { feats = await D.buildingsNear(sec.pts, 80); } catch (e) { bErr = e.message; }
    const cuts = [], bg = []; let bgUnknown = 0;
    feats.forEach(f => {
      const pr = f.properties; const hTag = pr.h != null && isFinite(+pr.h) && +pr.h > 0 ? +pr.h : null; const lv = pr.lv != null && isFinite(+pr.lv) && +pr.lv > 0 ? +pr.lv : null;
      const height = hTag != null ? { h: hTag, src: 'height' } : lv != null ? { h: lv * floorH, src: 'levels', lv } : { h: null, src: 'unknown' };
      polysOf(f.geometry).forEach(poly => {
        const rings = poly.map(r => r.map(U)); const ds = [];
        for (let i = 1; i < pl.u.length; i++) rings.forEach(R => { for (let j = 1; j < R.length; j++) { const tt = segX(pl.u[i - 1], pl.u[i], R[j - 1], R[j]); if (tt != null) ds.push(pl.cum[i - 1] + tt * (pl.cum[i] - pl.cum[i - 1])); } });
        if (inRings(pl.u[0], rings)) ds.push(0); if (inRings(pl.u[pl.u.length - 1], rings)) ds.push(pl.L);
        ds.sort((a, b) => a - b); const intervals = [];
        for (let i = 1; i < ds.length; i++) { const a = ds[i - 1], b = ds[i]; if (b - a < 0.3) continue; if (inRings(at(pl, (a + b) / 2), rings)) intervals.push([a, b]); }
        if (intervals.length) intervals.forEach(([a, b]) => { const base = groundMin(a, b); cuts.push(Object.assign({ id: pr.id, name: pr.nm || null, type: pr.b, d0: a, d1: b, base }, height)); });
        else { // background candidate
          const c = rings[0].reduce((s, p) => [s[0] + p[0] / rings[0].length, s[1] + p[1] / rings[0].length], [0, 0]); const pj = project(pl, c);
          if (pj.off > 60) return; if (height.h == null) { bgUnknown++; return; }
          const ext = rings[0].map(p => project(pl, p).d); const d0 = Math.min(...ext), d1 = Math.max(...ext); if (d1 - d0 < 0.5) return;
          bg.push(Object.assign({ id: pr.id, d0, d1, off: pj.off, base: ground(pj.d) }, height));
        }
      });
    });
    bg.sort((a, b) => b.off - a.off);
    return { id: sec.id, name: sec.name, pts: sec.pts, L: pl.L, step, dist, elev, min: Math.min(...ev), max: Math.max(...ev), missing,
      maxGrad: maxG, maxGradAt: maxAt, baseline: k * step, hornMax, cuts: cuts.sort((a, b) => a.d0 - b.d0), bg, bgUnknown, floorH, bErr,
      vertexD: pl.cum.slice(), computed: new Date().toISOString() };
  }

  // ---------- drawing (canvas; used in the panel, enlargements and printed sheets) ----------
  function chooseVE(prof, W, H) {
    const plotW = W - 70, plotH = H - 80; const xs = plotW / prof.L;
    const tops = prof.cuts.concat(prof.bg).filter(c => c.h != null).map(c => c.base + c.h); const top = Math.max(prof.max, ...tops);
    const range = Math.max(5, top - prof.min) * 1.15;
    for (const ve of [1, 2, 3, 5, 10, 20]) if (range * xs * ve >= plotH * 0.35) return ve;
    return 20;
  }
  function draw(canvas, prof, o) {
    o = o || {}; const ratio = o.ratio || (root.devicePixelRatio || 1); const W = o.w || 600, H = o.h || 300;
    canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio); canvas.style.width = o.fluid ? '100%' : W + 'px'; if (!o.fluid) canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const font = getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif';
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    ctx.font = `10px ${font}`; const accLines = []; { const words = t('sec.accuracy').split(' '); let line = ''; words.forEach(w => { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > W - 14 && line) { accLines.push(line); line = w; } else line = tt; }); if (line) accLines.push(line); }
    const ml = 48, mr = 18, mt = 26, mb = 52 + 13 * accLines.length; const pw = W - ml - mr, ph = H - mt - mb;
    const ve = o.ve === 'auto' || !o.ve ? chooseVE(prof, W, H) : +o.ve;
    const xs = pw / prof.L; const ys = xs * ve;
    const tops = prof.cuts.concat(prof.bg).filter(c => c.h != null).map(c => c.base + c.h);
    const top = Math.max(prof.max, ...tops); const mid = (prof.min + top) / 2;
    let lo = mid - ph / 2 / ys; if (lo > prof.min - 2) lo = prof.min - Math.max(2, (top - prof.min) * 0.08); // keep ground in view
    const X = (d) => ml + d * xs, Y = (e) => mt + ph - (e - lo) * ys;
    ctx.save(); ctx.beginPath(); ctx.rect(ml, mt, pw, ph); ctx.clip();
    // grid
    ctx.strokeStyle = '#ECECEA'; ctx.lineWidth = 1; ctx.font = `10px ${font}`; ctx.fillStyle = '#5E636A';
    const hiE = lo + ph / ys; const eStep = [1, 2, 5, 10, 20, 25, 50, 100].find(s => (hiE - lo) / s <= 7) || 200;
    for (let e = Math.ceil(lo / eStep) * eStep; e <= hiE; e += eStep) { ctx.beginPath(); ctx.moveTo(ml, Y(e)); ctx.lineTo(ml + pw, Y(e)); ctx.stroke(); }
    // background buildings (not cut)
    prof.bg.forEach(b => { ctx.fillStyle = '#ECECEA'; ctx.strokeStyle = '#C6C7C9'; ctx.lineWidth = 0.6; const x0 = X(b.d0), x1 = X(b.d1); const y0 = Y(b.base), y1 = Y(b.base + b.h); ctx.fillRect(x0, y1, x1 - x0, y0 - y1); ctx.strokeRect(x0, y1, x1 - x0, y0 - y1); });
    // ground (section poche)
    ctx.beginPath(); let started = false; prof.dist.forEach((d, i) => { const e = prof.elev[i]; if (e == null) { started = false; return; } started ? ctx.lineTo(X(d), Y(e)) : ctx.moveTo(X(d), Y(e)); started = true; });
    const groundPath = new Path2D(); { let s = false; let first = null, last = null; prof.dist.forEach((d, i) => { const e = prof.elev[i]; if (e == null) return; if (!s) { groundPath.moveTo(X(d), Y(e)); first = d; s = true; } else groundPath.lineTo(X(d), Y(e)); last = d; }); if (s) { groundPath.lineTo(X(last), mt + ph + 2); groundPath.lineTo(X(first), mt + ph + 2); groundPath.closePath(); } }
    ctx.fillStyle = '#D6D6D3'; ctx.fill(groundPath); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.stroke();
    // cut buildings
    const hatch = (() => { const c = document.createElement('canvas'); c.width = c.height = 6; const x = c.getContext('2d'); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, 6, 6); x.strokeStyle = P.ink; x.lineWidth = 0.9; x.beginPath(); x.moveTo(0, 6); x.lineTo(6, 0); x.stroke(); return ctx.createPattern(c, 'repeat'); })();
    prof.cuts.forEach(c => {
      if (c.base == null) return; const x0 = X(c.d0), x1 = X(c.d1); const y0 = Y(c.base);
      if (c.h == null) { ctx.strokeStyle = P.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0 - 2); ctx.lineTo(x1, y0 - 2); ctx.stroke(); return; }
      const y1 = Y(c.base + c.h);
      if (c.src === 'height') { ctx.fillStyle = P.ink; ctx.fillRect(x0, y1, x1 - x0, y0 - y1); }
      else { ctx.fillStyle = hatch; ctx.fillRect(x0, y1, x1 - x0, y0 - y1); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.strokeRect(x0 + 0.5, y1 + 0.5, x1 - x0 - 1, y0 - y1 - 1); ctx.setLineDash([]); }
    });
    ctx.restore();
    // labels on cut buildings
    ctx.font = `10px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.direction = 'ltr';
    let lastLabelX = -1e9;
    prof.cuts.forEach(c => { if (c.base == null) return; const xm = X((c.d0 + c.d1) / 2); if (xm - lastLabelX < 26) return; const y = Math.max(mt + 10, Y(c.base + (c.h || 0)) - 2); const txt = c.h == null ? '?' : c.src === 'height' ? nf(c.h, 1) + ' m' : '≈' + nf(c.h, 0) + ' m'; ctx.fillStyle = c.h == null ? P.red : P.ink; ctx.fillText(txt, xm, y); lastLabelX = xm; });
    // axes
    ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt + ph); ctx.lineTo(ml + pw, mt + ph); ctx.stroke();
    ctx.fillStyle = '#3C4046'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let e = Math.ceil(lo / eStep) * eStep; e <= hiE; e += eStep) ctx.fillText(nf(e), ml - 4, Y(e));
    ctx.save(); ctx.translate(11, mt + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(t('sec.elevAxis'), 0, 0); ctx.restore();
    const dStep = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(s => prof.L / s <= 8) || 2000;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let d = 0; d <= prof.L + 0.01; d += dStep) { ctx.beginPath(); ctx.moveTo(X(d), mt + ph); ctx.lineTo(X(d), mt + ph + 4); ctx.stroke(); ctx.fillText(nf(d), X(d), mt + ph + 6); }
    ctx.fillText(t('sec.distAxis'), ml + pw / 2, mt + ph + 18);
    // vertex letters
    const L = LETTERS(prof.vertexD.length); ctx.font = `700 12px ${font}`; ctx.fillStyle = P.red; ctx.textBaseline = 'bottom';
    prof.vertexD.forEach((d, i) => { const x = X(d); ctx.strokeStyle = P.red; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt + ph); ctx.stroke(); ctx.setLineDash([]); ctx.textAlign = i === 0 ? 'left' : i === L.length - 1 ? 'right' : 'center'; ctx.fillText(i === 0 || i === L.length - 1 ? L[i] : L[i], x + (i === 0 ? 2 : i === L.length - 1 ? -2 : 0), mt - 4); });
    // VE + accuracy statement
    ctx.font = `11px ${font}`; ctx.fillStyle = '#3C4046'; ctx.textBaseline = 'bottom'; ctx.textAlign = I.dir() === 'rtl' ? 'right' : 'left'; ctx.direction = I.dir();
    const veTxt = ve === 1 ? t('sec.ve1') : t('sec.ve', { v: ve });
    const tx = I.dir() === 'rtl' ? W - 6 : 6;
    ctx.font = `600 11px ${font}`; ctx.fillText(veTxt + ' · ' + (prof.name || ''), tx, H - 4 - 13 * accLines.length); ctx.fillStyle = '#5E636A'; ctx.font = `10px ${font}`;
    accLines.forEach((l, i) => ctx.fillText(l, tx, H - 3 - 13 * (accLines.length - 1 - i)));
    ctx.direction = 'ltr';
    return { ve, X, Y };
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
      map.addLayer({ id: 'sec-lines-bg', type: 'line', source: 'sec-lines', filter: ['!=', ['get', 'active'], 1], paint: { 'line-color': '#5E636A', 'line-width': 1.4, 'line-dasharray': [3, 2] } });
      map.addLayer({ id: 'sec-lines-on', type: 'line', source: 'sec-lines', filter: ['==', ['get', 'active'], 1], paint: { 'line-color': '#1C1E21', 'line-width': 2.4 } });
    }
    let all = [];
    function render() {
      if (!map.isStyleLoaded() && !map.getSource('sec-lines')) { map.once('idle', render); return; }
      ensure();
      const feats = all.filter(s => s.pts.length > 1 && (!editing || s.id !== editing.id)).map(s => ({ type: 'Feature', properties: { active: 0, name: s.name }, geometry: { type: 'LineString', coordinates: s.pts } }));
      const live = drawing ? drawing.pts.concat(cursor ? [cursor] : []) : editing ? editing.pts : null;
      if (live && live.length > 1) feats.push({ type: 'Feature', properties: { active: 1 }, geometry: { type: 'LineString', coordinates: live } });
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

  root.GA.section = { compute, draw, tool, chooseVE, LETTERS, polyline };
})(window);
