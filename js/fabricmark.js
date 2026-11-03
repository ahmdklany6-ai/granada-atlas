/* How study fabrics (saved study areas) are marked on every map — main map, location maps, analysis cards, comparison,
   historical overlays, sections, viewers and exports.
   5.13 (owner request of 3 Nov 2026):
   - boundary: a clearly visible BLACK DASHED line, thicker than before, over a thin white under-stroke so it stays legible
     on aerial photographs and dark rasters; no heavy fill;
   - number: plain, bold and larger, placed just ABOVE the boundary's TOP-RIGHT corner, outside it — never a circle or badge;
     the same physical corner in Arabic, Hebrew and English;
   - every number is always drawn: a number that would collide with another is moved sideways (never hidden), and one that
     would fall outside the frame is pulled back inside it. (The earlier map layer let MapLibre drop colliding labels and
     the canvas exports could push a colliding number off the frame — the likely reason a "3" was missing.)
   Numbering: one number per fabric everywhere = its position in the saved-fabrics list (1, 2, 3 …).
   Red #992B2A stays for thematic content (sections, highlights), not for study-area marks. */
(function (root) {
  const P = () => root.GA.palette;
  const DASH = [10, 6];                 // canvas px at 1× (scaled with the line width by callers that zoom)
  const WIDTH = 3;                      // canvas boundary width at 1×
  const NUM = 22;                       // canvas number size at 1×
  const font = () => (root.getComputedStyle && getComputedStyle(document.documentElement).getPropertyValue('--f-ui')) || 'sans-serif';
  // the corner used for the number: the boundary vertex closest to the top-right of its bounding box (y down in canvas px)
  function topRight(pts) {
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const w = (x1 - x0) || 1, h = (y1 - y0) || 1; let best = pts[0], bv = -Infinity;
    pts.forEach(q => { const v = (q[0] - x0) / w + (y1 - q[1]) / h; if (v > bv + 1e-9) { bv = v; best = q; } });
    return { x: best[0], y: best[1], bbox: [x0, y0, x1, y1] };
  }
  // canvas: plain bold number with a white halo, bottom-centred at (x, y); moved sideways (never hidden) if it would overlap
  // an earlier number, and kept inside the canvas (o.W / o.H in drawing units; defaults from the canvas and its transform)
  function drawNumber(ctx, text, x, y, o) {
    o = o || {}; const size = o.size || NUM; const placed = o.placed || [];
    ctx.save(); ctx.font = `800 ${size}px ${o.font || font()}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr'; ctx.lineJoin = 'round';
    const tf = ctx.getTransform ? ctx.getTransform() : { a: 1, d: 1 }; const W = o.W || (ctx.canvas ? ctx.canvas.width / (tf.a || 1) : 1e9), H = o.H || (ctx.canvas ? ctx.canvas.height / (tf.d || 1) : 1e9);
    const w = ctx.measureText(text).width + size * 0.5, h = size * 1.1; const box = (cx, by) => ({ x: cx, y: by - h / 2 + size * 0.15, w, h });
    const hit = (b) => placed.some(q => Math.abs(q.x - b.x) < (q.w + b.w) / 2 && Math.abs(q.y - b.y) < (q.h + b.h) / 2);
    let cx = x, by = y; const clamp = () => { cx = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, cx)); by = Math.max(size + 2, Math.min(H - 4, by)); };
    clamp(); for (let k = 1; k <= 8 && hit(box(cx, by)); k++) { cx = x + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (w + 2); clamp(); }
    if (hit(box(cx, by))) { by = y - h; cx = x; clamp(); } // still crowded: one row higher (or lower when clamped)
    placed.push(box(cx, by));
    // moved away from its corner (crowded small-scale maps): a thin leader line keeps the number tied to its boundary
    if (Math.abs(cx - x) > w * 0.6 || Math.abs(by - y) > h * 0.6) { ctx.save(); ctx.strokeStyle = o.color || P().mark.number; ctx.lineWidth = Math.max(1, size / 16); ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(cx + (x < cx ? -w / 2 + 2 : x > cx ? w / 2 - 2 : 0), by - size * 0.3); ctx.stroke(); ctx.restore(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(3, size / 3.5); ctx.strokeText(text, cx, by);
    ctx.fillStyle = o.color || P().mark.number; ctx.fillText(text, cx, by); ctx.restore();
    return by;
  }
  // canvas: the number just above the top-right corner of a ring given in canvas px
  function numberAt(ctx, pts, no, o) {
    o = o || {}; const c = topRight(pts); const gap = o.gap == null ? 5 : o.gap;
    return drawNumber(ctx, String(no), c.x, c.y - gap, o);
  }
  // the one fabric number used everywhere: position in the saved list (null for an unsaved selection)
  function numberOf(id) { const st = root.GA.store; if (!st || !id) return null; const i = st.get().areas.findIndex(a => a.id === id); return i < 0 ? null : i + 1; }
  function numbered() { const st = root.GA.store, CMP = root.GA.compare; if (!st || !CMP) return []; return st.get().areas.map((a, i) => ({ id: a.id, no: i + 1, name: a.name, ring: CMP.ringOf(a.spec) })).filter(x => x.ring); }
  // MapLibre: one point per fabric at its top-right corner (lon/lat; "up" = larger latitude)
  function cornerLL(ring) { const c = topRight(ring.map(p => [p[0], -p[1]])); return [c.x, -c.y]; }
  function numbersFC(list) {
    return { type: 'FeatureCollection', features: (list || numbered()).map(x => ({ type: 'Feature', properties: { no: String(x.no), id: x.id }, geometry: { type: 'Point', coordinates: cornerLL(x.ring) } })) };
  }
  // MapLibre symbol layer: bold black number above the corner, white halo; always drawn (never removed by label collisions)
  function numberLayer(id, src) {
    return { id, type: 'symbol', source: src, layout: { 'text-field': ['get', 'no'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 8, 13, 11, 16, 15, 20, 18, 24], 'text-anchor': 'bottom', 'text-offset': [0, -0.15], 'text-allow-overlap': true, 'text-ignore-placement': true, 'symbol-sort-key': ['to-number', ['get', 'no']] },
      paint: { 'text-color': P().mark.number, 'text-halo-color': 'rgba(255,255,255,0.97)', 'text-halo-width': 2.2, 'text-halo-blur': 0.2 } };
  }
  // MapLibre line layers for a boundary source: white under-stroke + black dashes
  function lineLayers(id, src, filter) {
    const base = { type: 'line', source: src }; if (filter) base.filter = filter;
    return [Object.assign({ id: id + '-halo', paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.2, 16, 5], 'line-opacity': 0.85 } }, base),
      Object.assign({ id, paint: { 'line-color': P().mark.boundary, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 3.2], 'line-dasharray': [3, 2] } }, base)];
  }
  // canvas: dashed outline of a ring given in canvas px (white under-stroke, then black dashes)
  function strokeRing(ctx, pts, o) {
    o = o || {}; const lw = o.width || WIDTH; ctx.save(); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
    if (o.tint) { ctx.fillStyle = o.tint; ctx.fill(); }
    ctx.lineJoin = 'round'; if (o.halo !== false) { ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = lw + 2.4; ctx.stroke(); }
    ctx.strokeStyle = o.color || P().mark.boundary; ctx.lineWidth = lw; const d = o.dash && o.dash.length ? o.dash : DASH.map(v => v * lw / WIDTH); ctx.setLineDash(d); ctx.stroke(); ctx.restore();
  }
  // MapLibre: the user's saved fabrics as boundaries
  function areasFC() {
    const st = root.GA.store, CMP = root.GA.compare; if (!st || !CMP) return { type: 'FeatureCollection', features: [] };
    return { type: 'FeatureCollection', features: st.get().areas.map((a, i) => { const r = CMP.ringOf(a.spec); return r ? { type: 'Feature', properties: { name: a.name, no: String(i + 1) }, geometry: { type: 'LineString', coordinates: r } } : null; }).filter(Boolean) };
  }
  function addLayers(m, src, before) {
    lineLayers(src + '-line', src).forEach(l => m.addLayer(l, before));
    if (!m.getSource(src + '-no')) m.addSource(src + '-no', { type: 'geojson', data: numbersFC() });
    m.addLayer(numberLayer(src + '-lbl', src + '-no'), before);
  }
  function setVisible(m, src, on) { [src + '-line-halo', src + '-line', src + '-lbl'].forEach(l => m.getLayer(l) && m.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none')); }
  // kept for callers that still ask for the old name: the number now goes to the top-right corner
  const numberAbove = numberAt;
  // x of the middle of a ring's top edge (kept for the section locator's older callers)
  function topCentre(xs, ys) { const yMax = Math.max(...ys), yMin = Math.min(...ys), xMin = Math.min(...xs), xMax = Math.max(...xs); const tol = (yMax - yMin) * 0.03 + 1e-9; const near = xs.filter((x, i) => ys[i] >= yMax - tol); const a = Math.min(...near), b = Math.max(...near); return b - a > (xMax - xMin) * 0.25 ? (a + b) / 2 : (xMin + xMax) / 2; }
  root.GA = root.GA || {}; root.GA.fabricStyle = { DASH, WIDTH, NUM, drawNumber, strokeRing, areasFC, addLayers, lineLayers, setVisible, numberOf, numbered, numberAt, numberAbove, numbersFC, numberLayer, topRight, cornerLL, topCentre };
})(window);
