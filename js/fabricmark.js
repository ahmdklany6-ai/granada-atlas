/* How study fabrics are marked on every map (main map, location maps, analysis cards, comparison,
   historical overlays, viewers and exports): a dashed outline, no heavy fill, and the number as plain
   text with a light halo — never a circle, badge or filled marker.
   Numbering (5.8): one number per fabric everywhere = its position in the saved-fabrics list (1, 2, 3 …), written in
   the studio red, centred just ABOVE the top edge of its boundary. */
(function (root) {
  const DASH = [7, 4];
  // canvas: plain number (or short text) with a white halo; avoids earlier labels by nudging up/down
  function drawNumber(ctx, text, x, y, o) {
    o = o || {}; const size = o.size || 15; const placed = o.placed || [];
    ctx.save(); ctx.font = `700 ${size}px ${o.font || getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif'}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr'; ctx.lineJoin = 'round';
    const w = ctx.measureText(text).width + 6, h = size + 4; let yy = y;
    const hit = (cy) => placed.some(b => Math.abs(b.x - x) < (b.w + w) / 2 && Math.abs(b.y - cy) < (b.h + h) / 2);
    for (let k = 1; k < 8 && hit(yy); k++) yy = y + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * h;
    placed.push({ x, y: yy, w, h });
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(3, size / 4); ctx.strokeText(text, x, yy);
    ctx.fillStyle = o.color || GA.palette.red; ctx.fillText(text, x, yy); ctx.restore();
    return yy;
  }
  // the one fabric number used everywhere: position in the saved list (null for an unsaved selection)
  function numberOf(id) { const st = root.GA.store; if (!st || !id) return null; const i = st.get().areas.findIndex(a => a.id === id); return i < 0 ? null : i + 1; }
  function numbered() { const st = root.GA.store, CMP = root.GA.compare; if (!st || !CMP) return []; return st.get().areas.map((a, i) => ({ id: a.id, no: i + 1, name: a.name, ring: CMP.ringOf(a.spec) })).filter(x => x.ring); }
  // canvas: the number centred above the top edge of a ring given in canvas px (small gap), red, plain, haloed
  function numberAbove(ctx, pts, no, o) {
    o = o || {}; const size = o.size || 15; const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const top = Math.min(...ys); const near = pts.filter(q => q[1] <= top + 0.5); const cx = near.length > 1 ? (Math.min(...near.map(q => q[0])) + Math.max(...near.map(q => q[0]))) / 2 : (Math.min(...xs) + Math.max(...xs)) / 2;
    return drawNumber(ctx, String(no), cx, top - (o.gap == null ? 4 : o.gap) - size / 2 - 2, Object.assign({ color: GA.palette.red }, o));
  }
  // MapLibre: one point per fabric at the middle of its top edge (northernmost latitude), carrying its number
  function numbersFC(list) {
    return { type: 'FeatureCollection', features: (list || numbered()).map(x => { const r = x.ring; const top = Math.max(...r.map(p => p[1])); const lons = r.map(p => p[0]);
      const near = r.filter(p => p[1] >= top - 1e-7); const lon = near.length > 1 ? (Math.min(...near.map(p => p[0])) + Math.max(...near.map(p => p[0]))) / 2 : (Math.min(...lons) + Math.max(...lons)) / 2;
      return { type: 'Feature', properties: { no: String(x.no), id: x.id }, geometry: { type: 'Point', coordinates: [lon, top] } }; }) };
  }
  // MapLibre symbol layer: plain red number above the boundary, white halo, grows a little with zoom, no overlaps
  function numberLayer(id, src) {
    return { id, type: 'symbol', source: src, layout: { 'text-field': ['get', 'no'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 12, 15, 15, 18, 18], 'text-anchor': 'bottom', 'text-offset': [0, -0.25], 'text-allow-overlap': false, 'text-ignore-placement': false, 'text-padding': 3, 'symbol-sort-key': ['to-number', ['get', 'no']] },
      paint: { 'text-color': GA.palette.red, 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.8, 'text-halo-blur': 0.3 } };
  }
  // canvas: dashed outline of a ring given in canvas px
  function strokeRing(ctx, pts, o) {
    o = o || {}; ctx.save(); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
    if (o.tint) { ctx.fillStyle = o.tint; ctx.fill(); }
    ctx.strokeStyle = o.color || GA.palette.red; ctx.lineWidth = o.width || 2; ctx.setLineDash(o.dash && o.dash.length ? o.dash : DASH); ctx.stroke(); ctx.restore();
  }
  // MapLibre: the user's saved fabrics as dashed outlines with a plain label
  function areasFC() {
    const st = root.GA.store, CMP = root.GA.compare; if (!st || !CMP) return { type: 'FeatureCollection', features: [] };
    return { type: 'FeatureCollection', features: st.get().areas.map((a, i) => { const r = CMP.ringOf(a.spec); return r ? { type: 'Feature', properties: { name: a.name, no: String(i + 1) }, geometry: { type: 'LineString', coordinates: r } } : null; }).filter(Boolean) };
  }
  function addLayers(m, src, before) {
    m.addLayer({ id: src + '-line', type: 'line', source: src, paint: { 'line-color': GA.palette.ink2, 'line-width': 1.6, 'line-dasharray': [3, 2] } }, before);
    if (!m.getSource(src + '-no')) m.addSource(src + '-no', { type: 'geojson', data: numbersFC() });
    m.addLayer(numberLayer(src + '-lbl', src + '-no'), before);
  }
  function setVisible(m, src, on) { [src + '-line', src + '-lbl'].forEach(l => m.getLayer(l) && m.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none')); }
  root.GA = root.GA || {}; root.GA.fabricStyle = { DASH, drawNumber, strokeRing, areasFC, addLayers, setVisible, numberOf, numbered, numberAbove, numbersFC, numberLayer };
})(window);
