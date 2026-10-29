/* Atlas basemap style. Provisional: built on the same open stack Terraink uses
   (OpenMapTiles schema vector tiles served by OpenFreeMap, rendered with MapLibre),
   with our own quiet grey palette (see palette.js). No Terraink code, styles or branding are copied. */
(function (root) {
  const C = root.GA.palette.basemap; // quiet greys so the red analysis reads on top
  const name = ['coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name:latin']];
  const F = ['Noto Sans Regular'], FB = ['Noto Sans Bold'], FI = ['Noto Sans Italic'];
  const w = (pairs) => ['interpolate', ['exponential', 1.5], ['zoom']].concat(pairs.flat());

  function style() {
    return {
      version: 8,
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: {
        omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet',
          attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> · Data © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>' },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': C.land } },
        { id: 'landuse-res', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]], paint: { 'fill-color': C.block, 'fill-opacity': 0.6 } },
        { id: 'landcover-green', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'scrub', 'forest']]], paint: { 'fill-color': C.green, 'fill-opacity': 0.75 } },
        { id: 'landcover-farm', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['farmland']]], paint: { 'fill-color': C.agri, 'fill-opacity': 0.7 } },
        { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.green, 'fill-opacity': 0.85 } },
        { id: 'landuse-green', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['cemetery', 'pitch', 'playground', 'stadium']]], paint: { 'fill-color': C.green, 'fill-opacity': 0.55 } },
        { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
        { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': C.waterLine, 'line-width': w([[10, 0.6], [16, 3]]) } },
        { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': C.bld, 'fill-outline-color': C.bldLine } },
        { id: 'road-path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14, filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]], paint: { 'line-color': C.casing, 'line-width': w([[14, 0.5], [18, 1.2]]), 'line-dasharray': [2, 2] } },
        { id: 'road-minor-case', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['minor', 'service']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.casing, 'line-width': w([[12, 0.5], [14, 2], [18, 12]]) } },
        { id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['minor', 'service']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.road, 'line-width': w([[12, 0.2], [14, 1.2], [18, 10]]) } },
        { id: 'road-mid-case', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.casingMajor, 'line-width': w([[10, 0.8], [14, 3.4], [18, 18]]) } },
        { id: 'road-mid', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.road, 'line-width': w([[10, 0.4], [14, 2.4], [18, 16]]) } },
        { id: 'road-major-case', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.casingMajor, 'line-width': w([[8, 1], [14, 5], [18, 24]]) } },
        { id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.road, 'line-width': w([[8, 0.6], [14, 3.6], [18, 21]]) } },
        { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], paint: { 'line-color': C.rail, 'line-width': w([[10, 0.6], [16, 1.6]]), 'line-dasharray': [3, 2] } },
        { id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['<=', ['get', 'admin_level'], 8], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': C.boundary, 'line-width': 0.8, 'line-dasharray': [4, 2, 1, 2] } },
        { id: 'label-water', type: 'symbol', source: 'omt', 'source-layer': 'waterway', minzoom: 13, layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': FI, 'text-size': 11 }, paint: { 'text-color': '#5D7479', 'text-halo-color': C.halo, 'text-halo-width': 1.2 } },
        { id: 'label-street', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14, layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': F, 'text-size': w([[14, 10], [18, 13]]), 'text-max-angle': 30 }, paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.6 } },
        { id: 'label-poi', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 16, filter: ['<=', ['get', 'rank'], 20], layout: { 'text-field': name, 'text-font': FI, 'text-size': 10.5, 'text-max-width': 8 }, paint: { 'text-color': C.labelSoft, 'text-halo-color': C.halo, 'text-halo-width': 1.4 } },
        { id: 'label-place-minor', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'hamlet', 'village']]], layout: { 'text-field': name, 'text-font': FB, 'text-size': w([[11, 10], [16, 14]]), 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 9 }, paint: { 'text-color': C.labelSoft, 'text-halo-color': C.halo, 'text-halo-width': 1.6 } },
        { id: 'label-place-major', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]], layout: { 'text-field': name, 'text-font': FB, 'text-size': w([[8, 13], [14, 22]]), 'text-letter-spacing': 0.08 }, paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 2 } },
      ],
    };
  }
  root.GA = root.GA || {}; root.GA.basemap = { style, colors: C };
})(window);
