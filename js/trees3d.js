/* 3D trees (build 5.11): opaque, lightweight extrusions built from the shared tree model (js/trees.js) — an octagonal
   trunk standing on the terrain and two to four crown slices whose radii follow the silhouette of the tree's form
   (rounded, spreading, columnar, conical, palm, generic). Only trees inside the view are generated (at most MAX), from
   zoom 15, so phones and tablets stay smooth. Sizes are recorded tags where they exist, otherwise the editable
   illustrative size; colours: recorded size = dark olive, species/genus known = olive, leaf type only = khaki,
   unknown = warm grey (generic model). The trunk sinks 10 m into the ground at its centre (MapLibre's rule for
   extrusions with base 0), so it is anchored on slopes; crown slices are measured from the same ground point. */
(function (root) {
  const MAX = 2500, MINZ = 15, N = 8;
  let on = false, busy = false, pending = false;
  const SRC = 'ga3d-trees', LT = 'ga3d-trees-trunk', LC = 'ga3d-trees-crown';
  const P = () => root.GA.palette;
  function ring(lon, lat, r, star) {
    const kx = 1 / (111320 * Math.cos(lat * Math.PI / 180)), ky = 1 / 110540; const n = star ? 12 : N; const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / n; const rr = star && i % 2 ? r * 0.32 : r; out.push([lon + Math.cos(a) * rr * kx, lat + Math.sin(a) * rr * ky]); }
    out.push(out[0]); return [out];
  }
  function colourOf(m) { const C = P().tree3d; if (m.hRec || m.crownRec) return C.recorded; if (m.formBasis === 'species' || m.formBasis === 'genus') return C.known; if (m.formBasis === 'leaf_type') return C.leaf; return C.unknown; }
  async function build() {
    const A = root.GA.app; const map = A.map; if (!on || !map.getSource(SRC)) return;
    if (busy) { pending = true; return; } busy = true;
    try {
      if (map.getZoom() < MINZ) { map.getSource(SRC).setData({ type: 'FeatureCollection', features: [] }); return; }
      const b = map.getBounds(); const bb = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]; const c = map.getCenter();
      const r = await root.GA.ext.trees(bb); const T = root.GA.trees;
      const pts = r.pts.slice().sort((p, q) => Math.hypot(p.ll[0] - c.lng, p.ll[1] - c.lat) - Math.hypot(q.ll[0] - c.lng, q.ll[1] - c.lat)).slice(0, MAX);
      const fs = [];
      pts.forEach(p => { const m = T.model(p.tags); const s = T.slices(m); const col = colourOf(m); const [lon, lat] = p.ll; const tg = JSON.stringify(p.tags); const props = (k, z0, z1) => ({ id: p.id, k, b: +z0.toFixed(2), h: +z1.toFixed(2), col, tg });
        fs.push({ type: 'Feature', properties: props('t', 0, s.trunk[1]), geometry: { type: 'Polygon', coordinates: ring(lon, lat, s.trunk[2]) } });
        s.crown.forEach(([z0, z1, rr]) => fs.push({ type: 'Feature', properties: props('c', z0, z1), geometry: { type: 'Polygon', coordinates: ring(lon, lat, rr, s.star && z0 === s.crown[0][0]) } })); });
      map.getSource(SRC).setData({ type: 'FeatureCollection', features: fs });
      api.shown = pts.length; api.total = r.pts.length;
    } catch (e) { console.warn('trees3d', e); }
    finally { busy = false; if (pending) { pending = false; build(); } }
  }
  function ensureLayers(map) {
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const C = P().tree3d;
    if (!map.getLayer(LT)) map.addLayer({ id: LT, type: 'fill-extrusion', source: SRC, minzoom: MINZ, filter: ['==', ['get', 'k'], 't'], paint: { 'fill-extrusion-color': C.trunk, 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 1 } });
    if (!map.getLayer(LC)) map.addLayer({ id: LC, type: 'fill-extrusion', source: SRC, minzoom: MINZ, filter: ['==', ['get', 'k'], 'c'], paint: { 'fill-extrusion-color': ['get', 'col'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } });
  }
  let addedTrees = false;
  function setOn(v) {
    const A = root.GA.app; const map = A.map; on = v;
    if (v) { if (A.L.S.trees && !A.L.S.trees.on) { A.L.setOn('trees', true); addedTrees = true; } ensureLayers(map); build(); }
    else { [LT, LC].forEach(l => map.getLayer(l) && map.removeLayer(l)); if (map.getSource(SRC)) map.removeSource(SRC); if (addedTrees) { A.L.setOn('trees', false); addedTrees = false; } }
  }
  function init() {
    const A = root.GA.app; if (!A || !A.map) return setTimeout(init, 200); const map = A.map;
    map.on('moveend', () => { if (on && A.L.S.trees && A.L.S.trees.on) build(); });
    map.on('styledata', () => { if (on) ensureLayers(map); });
    A.L.onChange(() => { if (!on) return; const vis = A.L.S.trees && A.L.S.trees.on ? 'visible' : 'none'; [LT, LC].forEach(l => map.getLayer(l) && map.getLayoutProperty(l, 'visibility') !== vis && map.setLayoutProperty(l, 'visibility', vis)); });
    root.GA.trees.onDefaults(() => { if (on) build(); });
  }
  const api = { setOn, rebuild: build, layers: [LT, LC], isOn: () => on, shown: 0, total: 0, MINZ };
  root.GA.trees3d = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
