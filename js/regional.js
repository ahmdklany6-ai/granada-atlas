/* Regional scales (build 5.11). The map now zooms out to zoom 3 (Spain, the Mediterranean and North Africa). Granada's
   own data always stays at its true place and size — nothing is stretched over the region. So that the city and the
   study areas stay recognisable when they shrink to a few pixels, a locator is drawn below zoom 10: a red ring on
   Granada with its name in the interface language, and a dot for every saved study area (and the one being drawn).
   The municipal outer boundary layer keeps drawing at every zoom. */
(function (root) {
  const SRC = 'ga-loc', MAXZ = 10;
  const CITY = [-3.5986, 37.1773];
  const t = (k, v) => root.GA.i18n.t(k, v);
  function features() {
    const A = root.GA.app; const fs = [{ type: 'Feature', properties: { k: 'city', name: t('v11.granada') }, geometry: { type: 'Point', coordinates: CITY } }];
    try {
      const rings = A.store.get().areas.map(a => root.GA.compare.ringOf(a.spec)).filter(Boolean); const r = A.sel.ring && A.sel.ring(); if (r) rings.push(r);
      rings.forEach(ring => { let x = 0, y = 0; ring.forEach(p => { x += p[0]; y += p[1]; }); fs.push({ type: 'Feature', properties: { k: 'area' }, geometry: { type: 'Point', coordinates: [x / ring.length, y / ring.length] } }); });
    } catch (e) { }
    return { type: 'FeatureCollection', features: fs };
  }
  function ensure() {
    const map = root.GA.app.map; if (!map.isStyleLoaded() && !map.getSource('omt')) return false; const P = root.GA.palette;
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: features() });
    if (!map.getLayer('ga-loc-ring')) map.addLayer({ id: 'ga-loc-ring', type: 'circle', source: SRC, maxzoom: MAXZ, filter: ['==', ['get', 'k'], 'city'], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 11, 9, 16], 'circle-color': 'rgba(255,255,255,0)', 'circle-stroke-color': P.red, 'circle-stroke-width': 2.6 } });
    if (!map.getLayer('ga-loc-dot')) map.addLayer({ id: 'ga-loc-dot', type: 'circle', source: SRC, maxzoom: MAXZ + 1.5, filter: ['==', ['get', 'k'], 'area'], paint: { 'circle-radius': 3.6, 'circle-color': P.red, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.2 } });
    if (!map.getLayer('ga-loc-lbl')) map.addLayer({ id: 'ga-loc-lbl', type: 'symbol', source: SRC, maxzoom: MAXZ, filter: ['==', ['get', 'k'], 'city'], layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-offset': [0, 1.7], 'text-anchor': 'top', 'text-allow-overlap': true }, paint: { 'text-color': P.red, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.8 } });
    return true;
  }
  function update() { const map = root.GA.app && root.GA.app.map; if (!map) return; if (!ensure()) return; map.getSource(SRC).setData(features()); }
  function legendHTML() {
    const map = root.GA.app.map; if (map.getZoom() >= MAXZ) return ''; const P = root.GA.palette;
    return `<div class="lg-blk" data-ly="regional"><h4>${t('v11.regional')}</h4><ul class="lg"><li><i class="sw dot" style="background:#fff;border:2px solid ${P.red}"></i><span>${t('v11.locCity')}</span></li><li><i class="sw dot" style="background:${P.red}"></i><span>${t('v11.locAreas')}</span></li></ul><p class="lyr-src">${t('v11.regionalNote')}</p><button type="button" class="btn btn-tiny" data-zoom-granada>${t('v11.zoomGranada')}</button></div>`;
  }
  function zoomGranada() { root.GA.app.map.fitBounds([[-3.7259, 37.0777], [-3.4992, 37.2591]], { padding: 30, duration: 1200 }); }
  function init() {
    const A = root.GA.app; if (!A || !A.map) return setTimeout(init, 200); const map = A.map;
    const go = () => { try { update(); } catch (e) { setTimeout(go, 500); } }; if (map.isStyleLoaded()) go(); else map.once('load', go);
    map.on('styledata', () => { if (!map.getSource(SRC)) setTimeout(go, 0); });
    root.GA.i18n.onChange(go); A.store.onChange && A.store.onChange(go);
    document.addEventListener('click', (e) => { if (e.target.closest('[data-zoom-granada]')) zoomGranada(); });
  }
  root.GA.regional = { update, legendHTML, zoomGranada, MAXZ };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
