/* How study fabrics are marked on every map (main map, location maps, analysis cards, comparison,
   historical overlays, viewers and exports): a dashed outline, no heavy fill, and the number as plain
   text with a light halo — never a circle, badge or filled marker. */
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
    ctx.fillStyle = o.color || '#1C1E21'; ctx.fillText(text, x, yy); ctx.restore();
    return yy;
  }
  // canvas: dashed outline of a ring given in canvas px
  function strokeRing(ctx, pts, o) {
    o = o || {}; ctx.save(); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
    if (o.tint) { ctx.fillStyle = o.tint; ctx.fill(); }
    ctx.strokeStyle = o.color || '#992B2A'; ctx.lineWidth = o.width || 2; ctx.setLineDash(o.dash && o.dash.length ? o.dash : DASH); ctx.stroke(); ctx.restore();
  }
  // MapLibre: the user's saved fabrics as dashed outlines with a plain label
  function areasFC() {
    const st = root.GA.store, CMP = root.GA.compare; if (!st || !CMP) return { type: 'FeatureCollection', features: [] };
    return { type: 'FeatureCollection', features: st.get().areas.map(a => { const r = CMP.ringOf(a.spec); return r ? { type: 'Feature', properties: { name: a.name }, geometry: { type: 'LineString', coordinates: r } } : null; }).filter(Boolean) };
  }
  function addLayers(m, src, before) {
    m.addLayer({ id: src + '-line', type: 'line', source: src, paint: { 'line-color': '#3C4046', 'line-width': 1.6, 'line-dasharray': [3, 2] } }, before);
    m.addLayer({ id: src + '-lbl', type: 'symbol', source: src, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11.5, 'symbol-placement': 'line', 'text-offset': [0, -0.8] }, paint: { 'text-color': '#222428', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 } }, before);
  }
  function setVisible(m, src, on) { [src + '-line', src + '-lbl'].forEach(l => m.getLayer(l) && m.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none')); }
  root.GA = root.GA || {}; root.GA.fabricStyle = { DASH, drawNumber, strokeRing, areasFC, addLayers, setVisible };
})(window);
