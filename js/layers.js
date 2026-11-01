/* Citywide layers, available before any study area is drawn. Each layer has visibility,
   opacity, a legend and a position in the drawing order. Large layers are loaded by
   viewport from 1 km tiles (buildings, streets, parks) only at street-level zooms; below
   that, prepared overview layers are shown (50 m building-floors raster, major streets,
   simplified land use). Scope "study areas" masks everything outside the saved/current
   areas. Unknown building heights stay visibly unknown (hatched), never coloured as a class. */
(function (root) {
  const { data: D, palette: P, analysis: A, i18n: I, geo: G } = root.GA;
  const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d });
  const fc = (f) => ({ type: 'FeatureCollection', features: f || [] });
  const BEFORE = 'label-water'; // thematic layers stay under the basemap labels
  const DETAIL_Z = 14.5;
  // buildings: 50 m aggregation only for citywide views; simplified footprints from LITE_Z; full detail from DETAIL_Z.
  // The aggregation fades out and the footprints fade in between FADE0 and FADE1.
  const LITE_Z = 12.5, FADE0 = 12.5, FADE1 = 12.95;
  const BLD = ['bld_floors', 'bld_fg', 'bld_period'];
  const fadeIn = (o) => ['interpolate', ['linear'], ['zoom'], FADE0, 0, FADE1, o];
  const fadeOut = (o) => ['interpolate', ['linear'], ['zoom'], FADE0, o, FADE1, 0];
  // street widths in px by tier, growing with scale (exponential, so close zooms read like the street's real width)
  const SW = { primary: [1.6, 3.6, 7, 14], collector: [0.7, 2.2, 5, 10], local: [0.45, 1.2, 3.2, 6.5], pedestrian: [0.3, 0.7, 2.2, 4.5], other: [0.3, 0.7, 1.7, 3.2] };
  // progressive reveal: major roads carry the city scale; local streets, then paths, gain strength as you zoom in
  const ST_FADE = [[11, { primary: 1, collector: 0.55, local: 0.4, pedestrian: 0, other: 0 }], [13.5, { primary: 1, collector: 0.85, local: 0.5, pedestrian: 0, other: 0 }], [14.5, { primary: 1, collector: 1, local: 0.6, pedestrian: 0.15, other: 0.3 }], [15.5, { primary: 1, collector: 1, local: 0.9, pedestrian: 0.5, other: 0.6 }], [16.5, { primary: 1, collector: 1, local: 1, pedestrian: 0.9, other: 0.9 }]];
  const streetOpacity = (o) => ['interpolate', ['linear'], ['zoom'], ...ST_FADE.flatMap(([z, m]) => [z, ['*', o, ['match', ['get', 'tier'], 'primary', m.primary, 'collector', m.collector, 'local', m.local, 'pedestrian', m.pedestrian, m.other]]])];
  const streetWidth = () => ['interpolate', ['exponential', 1.5], ['zoom'], ...[12, 15, 17, 19].flatMap((z, i) => [z, ['match', ['get', 'tier'], 'primary', SW.primary[i], 'collector', SW.collector[i], 'local', SW.local[i], 'pedestrian', SW.pedestrian[i], SW.other[i]]])];
  const CHORO = P.choro;
  const FACC = P.fac;
  const SLOPE_K = P.slope; // same classes as the slope raster (tools/build_terrain_display.js)
  const sw = (c, l, cls) => `<li><i class="sw ${cls || ''}" style="background:${c}"></i><span>${l}</span></li>`;
  const swl = (c, w, l, dash) => `<li><i class="sw ln" style="border-top:${w}px ${dash ? 'dashed' : 'solid'} ${c}"></i><span>${l}</span></li>`;
  const swd = (c, l) => `<li><i class="sw dot" style="background:${c}"></i><span>${l}</span></li>`;
  const iso = (s) => '⁦' + s + '⁩';

  function create(map, opts) {
    opts = opts || {};
    const S = {}; // layer state by id
    let order = []; let scope = 'city'; let maskRings = []; let built = false; const listeners = [];
    const emit = () => listeners.forEach(f => f());
    const setOp = (l, prop, v) => { if (map.getLayer(l)) map.setPaintProperty(l, prop, v); };
    const periodColor = () => matchExpr('period', Object.assign({}, P.period, { no_data: GA.palette.paper }), GA.palette.paper);
    const status = (id, st, extra) => { S[id].status = st; S[id].statusExtra = extra; emit(); };
    const lid = (id, k) => 'ly-' + id + (k ? '-' + k : '');

    // ---------- shared processing ----------
    const procB = (f) => { const p = f.properties; const lv = p.lv != null && isFinite(+p.lv) ? +p.lv : null; p.band = lv == null ? 'no_data' : A.levelBand(lv); const y = A.parseYear(p.sd); p.period = y == null ? 'no_data' : A.periodOf(y); return f; };
    const procS = (f) => { f.properties.tier = A.streetTier({ highway: f.properties.hw }) || 'other'; return f; };
    const procL = (f) => { f.properties.cat = A.luCategory({ landuse: f.properties.lu }) || 'other'; return f; };
    const matchExpr = (prop, obj, fallback) => ['match', ['get', prop]].concat(Object.entries(obj).flat(), [fallback]);
    const addSrc = (id, src) => { if (!map.getSource(id)) map.addSource(id, src); };
    const addLyr = (def) => { if (!map.getLayer(def.id)) map.addLayer(Object.assign({ layout: {} }, def), map.getLayer(BEFORE) ? BEFORE : undefined); };

    function hatchImage() {
      if (map.hasImage('ga-hatch')) return; const n = 8; const d = new Uint8Array(n * n * 4);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4; const on = (x + y) % n === 0; const v = on ? 138 : 255; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = on ? 255 : 230; }
      map.addImage('ga-hatch', { width: n, height: n, data: d });
    }

    // chunked viewport loader shared by layers that need it
    const vpCache = {};
    async function viewport(layer, proc, minZ, maxCells) {
      if (map.getZoom() < minZ) return { zoom: true };
      const b = map.getBounds(); const bb = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const fs = await D.chunked(layer, bb, 50, maxCells || 36);
      fs.forEach(f => { if (!f._p) { proc(f); f._p = 1; } });
      return { features: fs, bb };
    }

    // ---------- layer definitions ----------
    const M = () => D.manifest;
    const defs = [
      { id: 'hillshade', group: 'terrain', title: () => t('ly.hillshade'), def: { on: false, opacity: 0.45 },
        build() { const d = M().terrain.display.hillshade; addSrc(lid('hillshade'), { type: 'image', url: 'data/' + d.file, coordinates: d.coordinates }); addLyr({ id: lid('hillshade'), type: 'raster', source: lid('hillshade'), paint: { 'raster-opacity': 0.45, 'raster-fade-duration': 0 } }); },
        layers: () => [lid('hillshade')], opacityProp: { [lid('hillshade')]: 'raster-opacity' },
        legend: () => `<p class="lyr-src">${t('ly.hillshadeNote')}</p>`, src: () => 'IGN MDT25 · CC BY 4.0' },
      { id: 'elevation', group: 'terrain', title: () => t('ly.elevation'), def: { on: false, opacity: 0.7 },
        build() { const d = M().terrain.display.elevation; addSrc(lid('elevation'), { type: 'image', url: 'data/' + d.file, coordinates: d.coordinates }); addLyr({ id: lid('elevation'), type: 'raster', source: lid('elevation'), paint: { 'raster-opacity': 0.7, 'raster-fade-duration': 0 } }); },
        layers: () => [lid('elevation')], opacityProp: { [lid('elevation')]: 'raster-opacity' },
        legend: () => { const r = M().terrain.elevRamp || []; return `<ul class="lg">${r.filter((x, i) => i < r.length - 1).map((x, i) => sw(`rgb(${x[1].join(',')})`, `${iso(nf(x[0]) + '–' + nf(r[i + 1][0]))} ${t('u.m')}`)).join('')}</ul><p class="lyr-src">${t('g.asl')}</p>`; }, src: () => 'IGN MDT25 · CC BY 4.0' },
      { id: 'slope', group: 'terrain', title: () => t('ly.slope'), def: { on: false, opacity: 0.75 },
        build() { const d = M().terrain.display.slope; addSrc(lid('slope'), { type: 'image', url: 'data/' + d.file, coordinates: d.coordinates }); addLyr({ id: lid('slope'), type: 'raster', source: lid('slope'), paint: { 'raster-opacity': 0.75, 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } }); },
        layers: () => [lid('slope')], opacityProp: { [lid('slope')]: 'raster-opacity' },
        legend: () => `<ul class="lg">${SLOPE_K.map(([k, c]) => { const [a, b] = k.split(/[-+]/); const pa = Math.tan(+a * Math.PI / 180) * 100, pb = b ? Math.tan(+b * Math.PI / 180) * 100 : null; return sw(c, `${iso(k.replace('-', '–'))}° <small>(${iso(b ? nf(pa) + '–' + nf(pb) : '>' + nf(pa))}%)</small>`); }).join('')}</ul><p class="lyr-src">${t('ly.slopeNote')}</p>`, src: () => 'IGN MDT25 · gdal:slope (Horn) · CC BY 4.0' },
      { id: 'landuse', group: 'land', title: () => t('ly.landuse'), def: { on: false, opacity: 0.7 },
        async build() { addSrc(lid('landuse'), { type: 'geojson', data: fc() }); addLyr({ id: lid('landuse'), type: 'fill', source: lid('landuse'), paint: { 'fill-color': matchExpr('cat', P.landuse, GA.palette.line), 'fill-opacity': 0.7 } }); },
        async load() { if (this._loaded) return; const j = await D.single('landuse_overview'); j.features.forEach(procL); map.getSource(lid('landuse')).setData(j); this._loaded = j.features.length; return j.features.length; },
        layers: () => [lid('landuse')], opacityProp: { [lid('landuse')]: 'fill-opacity' },
        legend: () => `<ul class="lg">${Object.keys(P.landuse).map(k => sw(P.landuse[k], t('lu.c.' + k))).join('')}${sw(GA.palette.line, t('ly.luOther'))}</ul>`, src: () => 'OSM landuse · ODbL', popup: { layers: () => [lid('landuse')], html: (p) => `<b>${t('lu.c.' + p.cat) || p.cat}</b><br><small dir="ltr">landuse=${esc(p.lu)}</small>` } },
      { id: 'parks', group: 'land', title: () => t('ly.parks'), def: { on: false, opacity: 0.85 }, minZ: 13,
        build() { addSrc(lid('parks'), { type: 'geojson', data: fc() }); addLyr({ id: lid('parks'), type: 'fill', source: lid('parks'), paint: { 'fill-color': P.landuse.green, 'fill-opacity': 0.85, 'fill-outline-color': GA.palette.trees } }); },
        // gardens are drawn at about half the park opacity; the layer slider scales both (and their legend swatches)
        applyOpacity(o) { setOp(lid('parks'), 'fill-opacity', ['match', ['get', 'le'], 'park', o, o * 0.53]); },
        async update() { const r = await viewport('parks', (f) => f, 13, 60); if (r.zoom) return 'zoom'; map.getSource(lid('parks')).setData(fc(r.features)); return r.features.length; },
        layers: () => [lid('parks')], opacityProp: { [lid('parks')]: 'fill-opacity' },
        legend: () => `<ul class="lg"><li><i class="sw" style="background:${P.landuse.green};border:1px solid ${P.trees}"></i><span>leisure=park</span></li><li><i class="sw" style="background:${P.landuse.green};opacity:calc(var(--lg-op,1) * .53);border:1px solid ${P.trees}"></i><span>leisure=garden</span></li></ul><p class="lyr-src">${t('ly.gardenNote')}</p>`, src: () => 'OSM leisure · ODbL', popup: { layers: () => [lid('parks')], html: (p) => `<b dir="auto">${esc(p.nm || '—')}</b><br><small dir="ltr">leisure=${esc(p.le)}</small>` } },
      { id: 'water', group: 'land', title: () => t('ly.water'), def: { on: false, opacity: 1 },
        build() { addSrc(lid('water'), { type: 'geojson', data: fc() }); addLyr({ id: lid('water'), type: 'line', source: lid('water'), paint: { 'line-color': GA.palette.blue, 'line-width': ['match', ['get', 'ww'], 'river', 2.4, 1], 'line-opacity': 1 } }); },
        async load() { if (this._loaded) return; const j = await D.single('water'); map.getSource(lid('water')).setData(j); this._loaded = 1; return j.features.length; },
        layers: () => [lid('water')], opacityProp: { [lid('water')]: 'line-opacity' }, legend: () => `<ul class="lg">${swl(GA.palette.blue, 2.4, 'waterway=river')}${swl(GA.palette.blue, 1, 'stream / canal / drain')}</ul>`, src: () => 'OSM waterway · ODbL' },
      { id: 'barrios', group: 'admin', title: () => t('ly.barrios'), def: { on: false, opacity: 0.8, metric: 'd_health' },
        build() { addSrc(lid('barrios'), { type: 'geojson', data: fc() }); addLyr({ id: lid('barrios'), type: 'fill', source: lid('barrios'), paint: { 'fill-color': '#EEE', 'fill-opacity': 0.8 } }); addLyr({ id: lid('barrios', 'ln'), type: 'line', source: lid('barrios'), paint: { 'line-color': P.admin.barrio, 'line-width': 1.1 } }); /* neighbourhood lines in red over the choropleth */ },
        async load() { const j = await D.single('admin'); const b = j.features.filter(f => f.properties.kind === 'barrio'); this._fs = b; this.restyle(); return b.length; },
        restyle() {
          if (!this._fs) return; const m = S.barrios.metric; const vals = this._fs.map(f => f.properties[m]).filter(v => v != null && isFinite(v)).sort((a, b) => a - b);
          const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))]; let br = [q(0.2), q(0.4), q(0.6), q(0.8)]; br = br.filter((v, i) => i === 0 || v > br[i - 1]);
          this._breaks = { min: vals[0], max: vals[vals.length - 1], br };
          this._fs.forEach(f => { const v = f.properties[m]; f.properties._cls = v == null ? -1 : br.filter(x => v > x).length; });
          const cols = CHORO.slice(5 - (br.length + 1)); this._cols = cols;
          map.getSource(lid('barrios')).setData(fc(this._fs));
          map.setPaintProperty(lid('barrios'), 'fill-color', ['match', ['get', '_cls'], -1, '#FFFFFF'].concat(cols.flatMap((c, i) => [i, c])).concat(['#FFFFFF']));
        },
        layers: () => [lid('barrios'), lid('barrios', 'ln')], opacityProp: { [lid('barrios')]: 'fill-opacity' },
        controls: () => `<label class="row2">${t('ly.metric')} <select data-ly-metric="barrios">${['d_health', 'n_health', 'n_hospital', 'd_education', 'n_education', 'n_school', 'd_stay', 'n_stay', 'n_hotel', 'd_bus', 'n_bus', 'median_floors', 'levels_coverage'].map(k => `<option value="${k}" ${S.barrios.metric === k ? 'selected' : ''}>${t('ly.m.' + k)}</option>`).join('')}</select></label>`,
        legend() {
          const B = this._breaks; if (!B) return ''; const m = S.barrios.metric; const pct = m === 'levels_coverage'; const f = (v) => pct ? nf(v * 100) + '%' : nf(v, m.startsWith('d_') ? 1 : 0);
          const edges = [B.min].concat(B.br, [B.max]);
          return `<h4>${t('ly.m.' + m)}</h4><ul class="lg">${this._cols.map((c, i) => sw(c, iso(f(edges[i]) + '–' + f(edges[i + 1])))).join('')}</ul><p class="lyr-src">${t(m.startsWith('d_') ? 'ly.densNote' : m.startsWith('n_') ? 'ly.countNote' : 'ly.otherNote')} ${t('ly.quantile')}</p>`;
        }, src: () => 'OSM admin_level 10 · ' + t('ly.statsSrc'),
        popup: { layers: () => [lid('barrios')], html: (p) => `<b dir="auto">${esc(p.name)}</b><table>${[['area_km2', 'km²'], ['n_health', ''], ['d_health', '/km²'], ['n_hospital', ''], ['n_education', ''], ['n_school', ''], ['n_stay', ''], ['n_hotel', ''], ['n_bus', ''], ['median_floors', ''], ['levels_coverage', '']].map(([k, u]) => `<tr><td>${t('ly.m.' + k)}</td><td class="num">${k === 'levels_coverage' ? nf(p[k] * 100) + '%' : nf(p[k], 2)} ${u}</td></tr>`).join('')}</table><small>${t('ly.noPop')}</small>` } },
      // 5.9: three independent boundary layers. 'boundaries' keeps its id (saved layer settings) and now holds the districts and
      // the GHSL urban centre / historic core; neighbourhoods and the municipality's outer line have their own toggles.
      { id: 'municipality', group: 'admin', title: () => t('v9.lyMuni'), def: { on: true, opacity: 1 },
        build() { addSrc(lid('municipality'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('municipality'), type: 'line', source: lid('municipality'), paint: { 'line-color': P.admin.municipio, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 15, 2.4], 'line-opacity': 1 } }); },
        // the municipio feature's own rings only (every part and enclave kept as mapped) — no internal lines
        async load() { if (this._loaded) return; const j = await D.single('admin'); const f = j.features.filter(x => x.properties.kind === 'municipio'); map.getSource(lid('municipality')).setData(fc(f)); this._loaded = 1; return f.length; },
        layers: () => [lid('municipality')], opacityProp: { [lid('municipality')]: 'line-opacity' },
        legend: () => `<ul class="lg">${swl(P.admin.municipio, 2, t('v9.lgMuni'))}</ul><p class="lyr-src">${t('v9.muniNote')}</p>`, src: () => 'OSM admin_level 8 (Granada municipality) · ODbL' },
      { id: 'neighbourhoods', group: 'admin', title: () => t('v9.lyNeigh'), def: { on: true, opacity: 1 },
        build() { addSrc(lid('neighbourhoods'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('neighbourhoods'), type: 'line', source: lid('neighbourhoods'), minzoom: 11, paint: { 'line-color': P.admin.barrio, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 15, 1.4], 'line-dasharray': [3, 2], 'line-opacity': 1 } });
          addLyr({ id: lid('neighbourhoods', 'lbl'), type: 'symbol', source: lid('neighbourhoods'), minzoom: 13, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'symbol-placement': 'point' }, paint: { 'text-color': P.admin.barrio, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4 } }); },
        async load() { if (this._loaded) return; const j = await D.single('admin'); const f = j.features.filter(x => x.properties.kind === 'barrio'); map.getSource(lid('neighbourhoods')).setData(fc(f)); this._loaded = 1; return f.length; },
        layers: () => [lid('neighbourhoods'), lid('neighbourhoods', 'lbl')], opacityProp: { [lid('neighbourhoods')]: 'line-opacity' },
        legend: () => `<ul class="lg">${swl(P.admin.barrio, 1.2, t('ly.barrio'), true)}</ul><p class="lyr-src">${t('v9.neighNote')}</p>`, src: () => 'OSM admin_level 10 · ODbL' },
      { id: 'boundaries', group: 'admin', title: () => t('v9.lyDistricts'), def: { on: true, opacity: 1 },
        build() { addSrc(lid('boundaries'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('boundaries', 'd'), type: 'line', source: lid('boundaries'), filter: ['==', ['get', 'kind'], 'distrito'], paint: { 'line-color': P.admin.distrito, 'line-width': 1.4, 'line-opacity': 1 } });
          addLyr({ id: lid('boundaries', 'u'), type: 'line', source: lid('boundaries'), filter: ['in', ['get', 'kind'], ['literal', ['urban_centre', 'historic_core']]], paint: { 'line-color': P.admin.urban, 'line-width': ['match', ['get', 'kind'], 'historic_core', 1.4, 1.8], 'line-dasharray': ['literal', [4, 2]], 'line-opacity': 1 } }); },
        async load() { if (this._loaded) return; const j = await D.single('admin'); map.getSource(lid('boundaries')).setData(fc(j.features.filter(f => f.properties.kind !== 'barrio' && f.properties.kind !== 'municipio'))); this._loaded = 1; return j.features.length; },
        layers: () => ['d', 'u'].map(k => lid('boundaries', k)), opacityProp: { [lid('boundaries', 'd')]: 'line-opacity', [lid('boundaries', 'u')]: 'line-opacity' },
        legend: () => `<ul class="lg">${swl(P.admin.distrito, 1.4, t('ly.distrito'))}${swl(P.admin.urban, 1.8, t('ly.urbanCentre'), true)}</ul><p class="lyr-src">${t('v9.ghslNote')}</p>`, src: () => 'OSM admin_level 9 · JRC GHSL UCDB 2025' },
      { id: 'bld_floors', group: 'bld', title: () => t('ly.bldFloors'), def: { on: true, opacity: 0.9 }, minZ: 0,
        build() { const o = M().overview.buildingFloors; addSrc(lid('bld_floors', 'ov'), { type: 'image', url: 'data/' + o.file, coordinates: o.coordinates }); addLyr({ id: lid('bld_floors', 'ov'), type: 'raster', source: lid('bld_floors', 'ov'), maxzoom: DETAIL_Z, paint: { 'raster-opacity': 0.9, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
          hatchImage(); addSrc(lid('bld'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('bld_floors'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, filter: ['!=', ['get', 'band'], 'no_data'], paint: { 'fill-color': matchExpr('band', P.band, '#FFF'), 'fill-opacity': 0.9, 'fill-outline-color': '#FFFFFF' } });
          addLyr({ id: lid('bld_floors', 'unk'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, filter: ['==', ['get', 'band'], 'no_data'], paint: { 'fill-pattern': 'ga-hatch', 'fill-opacity': 0.9 } });
          addLyr({ id: lid('bld_floors', 'unkln'), type: 'line', source: lid('bld'), minzoom: DETAIL_Z, filter: ['==', ['get', 'band'], 'no_data'], paint: { 'line-color': GA.palette.grey, 'line-width': 0.5, 'line-opacity': 0.9 } }); },
        // simplified citywide footprints (added when first needed) sit between the 50 m raster and the full-detail tiles
        liteLayers: () => [lid('bld_floors', 'lite'), lid('bld_floors', 'liteunk')],
        buildLite() { addLyr({ id: lid('bld_floors', 'lite'), type: 'fill', source: lid('bldlite'), minzoom: LITE_Z, filter: ['!=', ['get', 'band'], 'no_data'], paint: { 'fill-color': matchExpr('band', P.band, '#FFF'), 'fill-opacity': 0.9, 'fill-antialias': true } });
          addLyr({ id: lid('bld_floors', 'liteunk'), type: 'fill', source: lid('bldlite'), minzoom: LITE_Z, filter: ['==', ['get', 'band'], 'no_data'], paint: { 'fill-pattern': 'ga-hatch', 'fill-opacity': 0.9 } }); },
        update: () => bldUpdate(), layers: () => [lid('bld_floors', 'ov'), lid('bld_floors', 'lite'), lid('bld_floors', 'liteunk'), lid('bld_floors'), lid('bld_floors', 'unk'), lid('bld_floors', 'unkln')],
        visLayers() { return bldVis(this); },
        applyOpacity(o) { setOp(lid('bld_floors', 'ov'), 'raster-opacity', lite.state === 2 ? fadeOut(o) : o); setOp(lid('bld_floors', 'lite'), 'fill-opacity', fadeIn(o)); setOp(lid('bld_floors', 'liteunk'), 'fill-opacity', fadeIn(o));
          setOp(lid('bld_floors'), 'fill-opacity', o); setOp(lid('bld_floors', 'unk'), 'fill-opacity', o); setOp(lid('bld_floors', 'unkln'), 'line-opacity', o); },
        legend: () => { const z = map.getZoom(); return `<ul class="lg">${['1-2', '3-4', '5-8', '9+'].map(k => sw(P.band[k], t('b.floors', { v: iso(k.replace('-', '–')) }))).join('')}<li><i class="sw hatch"></i><span>${t('g.unknownHeight')}</span></li></ul><p class="lyr-src">${t(z < LITE_Z ? 'ly.floorsOverview' : z < DETAIL_Z ? 'ly.floorsLite' : 'ly.floorsDetail')}</p>`; },
        src: () => 'OSM building:levels · ODbL', popup: { layers: () => [lid('bld_floors'), lid('bld_floors', 'unk')], html: (p) => bldPopup(p) } },
      { id: 'bld_fg', group: 'bld', title: () => t('ly.bldFg'), def: { on: false, opacity: 1 }, minZ: LITE_Z,
        build() { addSrc(lid('bld'), { type: 'geojson', data: fc() }); addLyr({ id: lid('bld_fg'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, paint: { 'fill-color': P.ink, 'fill-opacity': 1 } }); },
        liteLayers: () => [lid('bld_fg', 'lite')],
        buildLite() { addLyr({ id: lid('bld_fg', 'lite'), type: 'fill', source: lid('bldlite'), minzoom: LITE_Z, paint: { 'fill-color': P.ink, 'fill-opacity': 1 } }); },
        update: () => bldUpdate(), layers: () => [lid('bld_fg', 'lite'), lid('bld_fg')], visLayers() { return bldVis(this); },
        applyOpacity(o) { setOp(lid('bld_fg', 'lite'), 'fill-opacity', fadeIn(o)); setOp(lid('bld_fg'), 'fill-opacity', o); },
        legend: () => `<ul class="lg">${sw(P.ink, t('g.building'))}</ul>${bldScaleNote()}`, src: () => 'OSM building · ODbL', popup: { layers: () => [lid('bld_fg')], html: (p) => bldPopup(p) } },
      { id: 'bld_period', group: 'bld', title: () => t('ly.bldPeriod'), def: { on: false, opacity: 1 }, minZ: LITE_Z,
        // 5.9: dated buildings in the period ramp; buildings without an OSM start_date are HATCHED (as unknown floors), never a
        // pale class that could be read as a date. Coverage is a source gap (39 of 101,674 footprints carry a usable date).
        build() { addSrc(lid('bld'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('bld_period', 'unk'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, filter: ['==', ['coalesce', ['get', 'period'], 'no_data'], 'no_data'], paint: { 'fill-pattern': 'ga-hatch', 'fill-opacity': 0.55 } });
          addLyr({ id: lid('bld_period'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, filter: ['!=', ['coalesce', ['get', 'period'], 'no_data'], 'no_data'], paint: { 'fill-color': periodColor(), 'fill-opacity': 1, 'fill-outline-color': P.ink } }); },
        liteLayers: () => [lid('bld_period', 'liteunk'), lid('bld_period', 'lite')],
        buildLite() { addLyr({ id: lid('bld_period', 'liteunk'), type: 'fill', source: lid('bldlite'), minzoom: LITE_Z, filter: ['==', ['get', 'period'], 'no_data'], paint: { 'fill-pattern': 'ga-hatch', 'fill-opacity': 0.55 } });
          addLyr({ id: lid('bld_period', 'lite'), type: 'fill', source: lid('bldlite'), minzoom: LITE_Z, filter: ['!=', ['get', 'period'], 'no_data'], paint: { 'fill-color': periodColor(), 'fill-opacity': 1, 'fill-outline-color': P.ink } }); },
        update: () => bldUpdate(), layers: () => [lid('bld_period', 'liteunk'), lid('bld_period', 'lite'), lid('bld_period', 'unk'), lid('bld_period')], visLayers() { return bldVis(this); },
        applyOpacity(o) { setOp(lid('bld_period', 'liteunk'), 'fill-opacity', fadeIn(o) * 0.55); setOp(lid('bld_period', 'lite'), 'fill-opacity', fadeIn(o)); setOp(lid('bld_period', 'unk'), 'fill-opacity', o * 0.55); setOp(lid('bld_period'), 'fill-opacity', o); },
        legend: () => { const pc = (M().layers.buildings || {}).periodCoverage || {}; const n = pc.total, d = pc.dated; // recorded in the manifest from the published data
          return `<ul class="lg">${A.PERIODS.map(k => sw(P.period[k], root.GA.report.periodLabel(k))).join('')}<li><i class="sw hatch"></i><span>${t('v9.periodUnknown')}</span></li></ul><p class="lyr-src">${n ? t('v9.periodCoverage', { d: nf(d), n: nf(n) }) + ' ' : ''}${t('v9.periodNote')}</p>${bldScaleNote()}`; }, src: () => 'OSM start_date · ODbL', popup: { layers: () => [lid('bld_period')], html: (p) => bldPopup(p) } },
      { id: 'streets', group: 'streets', title: () => t('ly.streets'), def: { on: false, opacity: 1 },
        build() { addSrc(lid('streets', 'maj'), { type: 'geojson', data: fc() }); addSrc(lid('streets'), { type: 'geojson', data: fc() });
          // widths grow with scale so local streets and paths stay legible up close (line-dasharray cannot be data-driven,
          // so pedestrian ways get their own dashed layer)
          const paint = { 'line-color': matchExpr('tier', P.tier, P.tier.other), 'line-width': streetWidth(), 'line-opacity': 1 };
          addLyr({ id: lid('streets', 'maj'), type: 'line', source: lid('streets', 'maj'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint });
          addLyr({ id: lid('streets'), type: 'line', source: lid('streets'), minzoom: DETAIL_Z, filter: ['!=', ['get', 'tier'], 'pedestrian'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint });
          addLyr({ id: lid('streets', 'ped'), type: 'line', source: lid('streets'), minzoom: DETAIL_Z, filter: ['==', ['get', 'tier'], 'pedestrian'], layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: Object.assign({}, paint, { 'line-dasharray': [2, 1.2] }) }); },
        async load() { if (this._majLoaded) return; const j = await D.single('streets_major'); j.features.forEach(procS); map.getSource(lid('streets', 'maj')).setData(j); this._majLoaded = 1; },
        async update() {
          const my = {}; this._busy = my;
          const r = await viewport('streets', procS, DETAIL_Z, 40); if (r.zoom) return 'overview'; if (this._busy !== my) return 'stale';
          map.getSource(lid('streets')).setData(fc(r.features)); await waitLoaded(lid('streets')); if (this._busy !== my) return 'stale';
          cover.streets = r.bb; syncCover(true); return r.features.length; },
        // the major-road overview stays drawn under the detail layers until the detail data for the view has arrived
        visLayers() { const hide = map.getZoom() >= DETAIL_Z && covers(cover.streets); return this.layers().filter(l => !(hide && l === lid('streets', 'maj'))); },
        layers: () => [lid('streets', 'maj'), lid('streets'), lid('streets', 'ped')],
        applyOpacity(o) { [lid('streets', 'maj'), lid('streets'), lid('streets', 'ped')].forEach(l => setOp(l, 'line-opacity', streetOpacity(o))); },
        legend: () => `<ul class="lg">${['primary', 'collector', 'local', 'pedestrian'].concat(map.getZoom() >= DETAIL_Z ? ['other'] : []).map(k => swl(P.tier[k], P.tierWidth[k] + 0.5, t('tier.' + k), k === 'pedestrian')).join('')}</ul><p class="lyr-src">${t(map.getZoom() < DETAIL_Z ? 'ly.streetsOverview' : 'ly.streetsDetail')} ${t('v6.streetsReveal')}</p>`, src: () => 'OSM highway · ODbL',
        popup: { layers: () => [lid('streets'), lid('streets', 'ped'), lid('streets', 'maj')], html: (p) => `<b dir="auto">${esc(p.nm || '—')}</b><br>${t('tier.' + p.tier) || ''} <small dir="ltr">highway=${esc(p.hw)}</small>` } },
      { id: 'contours', group: 'terrain', title: () => t('ly.contours'), def: { on: false, opacity: 0.8 },
        build() { addSrc(lid('contours', '10'), { type: 'geojson', data: fc() }); addSrc(lid('contours', '20'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('contours', '20'), type: 'line', source: lid('contours', '20'), maxzoom: 13.5, paint: { 'line-color': GA.palette.contour, 'line-width': ['match', ['%', ['get', 'elev'], 100], 0, 1, 0.4], 'line-opacity': 0.8 } });
          addLyr({ id: lid('contours', '10'), type: 'line', source: lid('contours', '10'), minzoom: 13.5, paint: { 'line-color': GA.palette.contour, 'line-width': ['match', ['get', 'idx'], 1, 1.1, 0.5], 'line-opacity': 0.8 } });
          addLyr({ id: lid('contours', 'lbl'), type: 'symbol', source: lid('contours', '10'), minzoom: 15, filter: ['==', ['get', 'idx'], 1], layout: { 'symbol-placement': 'line', 'text-field': ['to-string', ['get', 'elev']], 'text-font': ['Noto Sans Regular'], 'text-size': 10 }, paint: { 'text-color': GA.palette.contour, 'text-halo-color': '#FFF', 'text-halo-width': 1.2 } }); },
        async load() { if (this._loaded) return; const [a, b] = await Promise.all([D.single('contours_10m'), D.single('contours_20m')]); map.getSource(lid('contours', '10')).setData(a); map.getSource(lid('contours', '20')).setData(b); this._loaded = 1; return a.features.length + b.features.length; },
        layers: () => [lid('contours', '20'), lid('contours', '10'), lid('contours', 'lbl')], opacityProp: { [lid('contours', '20')]: 'line-opacity', [lid('contours', '10')]: 'line-opacity' },
        legend: () => `<ul class="lg">${swl(GA.palette.contour, 1, t('ly.contourIdx'))}${swl(GA.palette.contour, 0.5, t('ly.contourMinor'))}</ul><p class="lyr-src">${t('ly.contourNote')}</p>`, src: () => 'gdal:contour · IGN MDT25 · CC BY 4.0' },
    ];
    ['health', 'education', 'stay'].forEach(k => defs.push({ id: 'fac_' + k, group: 'fac', title: () => t('g.' + k), def: { on: false, opacity: 1 },
      build() { addSrc(lid(this.id), { type: 'geojson', data: fc() }); addLyr({ id: lid(this.id), type: 'circle', source: lid(this.id), paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, ['match', ['get', 'cls'], ['hospital', 'university'], 4, 2], 17, ['match', ['get', 'cls'], ['hospital', 'university'], 9, 5]], 'circle-color': matchExpr('cls', FACC, GA.palette.line2), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-opacity': 1, 'circle-stroke-opacity': 1 } }); },
      async load() { if (this._loaded) return; const j = await D.single(this.id); map.getSource(lid(this.id)).setData(j); this._loaded = 1; this._by = {}; j.features.forEach(f => this._by[f.properties.cls] = (this._by[f.properties.cls] || 0) + 1); return j.features.length; },
      layers() { return [lid(this.id)]; }, opacityProp: { [lid('fac_' + k)]: 'circle-opacity' },
      legend() { return `<ul class="lg">${Object.keys(D.FAC_TAGS[k]).map(c => swd(FACC[c], t('fac.' + c) + (this._by && this._by[c] ? ` <small class="num">(${this._by[c]})</small>` : ''))).join('')}</ul><p class="lyr-src">${t('ly.facNote')}</p>`; },
      src: () => 'OSM · Overpass ' + ((M() && M().layers['fac_' + k] && M().layers['fac_' + k].date) || '').slice(0, 10) + ' · ODbL',
      popup: { layers: () => [lid('fac_' + k)], html: (p) => `<b dir="auto">${esc(p.nm || '—')}</b><br>${t('fac.' + p.cls)} <small dir="ltr">(${esc(p.cls)} · ${esc(p.id)})</small>${p.op ? `<br><small dir="auto">${esc(p.op)}</small>` : ''}` } }));
    defs.push({ id: 'bus_stops', group: 'fac', title: () => t('g.transit'), def: { on: false, opacity: 1 },
      build() { addSrc(lid('bus'), { type: 'geojson', data: fc() }); addLyr({ id: lid('bus'), type: 'circle', source: lid('bus'), paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 17, 4.5], 'circle-color': P.stop, 'circle-stroke-color': '#FFF', 'circle-stroke-width': 1, 'circle-opacity': 1 } }); },
      async load() { if (this._loaded) return; const j = await D.single('bus_stops'); map.getSource(lid('bus')).setData(j); this._loaded = 1; return j.features.length; },
      layers: () => [lid('bus')], opacityProp: { [lid('bus')]: 'circle-opacity' },
      legend: () => `<ul class="lg">${swd(P.stop, t('poi.transit:bus'))}</ul><p class="lyr-src">${t('g.fFreqGap')}</p>`, src: () => 'OSM highway=bus_stop · ODbL',
      popup: { layers: () => [lid('bus')], html: (p) => `<b dir="auto">${esc(p.nm || '—')}</b><br><small dir="ltr">ref ${esc(p.ref || '—')} · ${esc(p.op || '')}</small><br><small>${t('ly.noFreq')}</small>` } });

    // extra layer definitions registered by other modules (layers_ext.js)
    const H = { map, S, addSrc, addLyr, lid, status, fc, viewport, matchExpr, t, esc, nf, sw, swl, swd, iso, BEFORE, DETAIL_Z, persist: () => persist(), emit: () => emit(), runLoad: (d) => runLoad(d), applyVis: (d) => applyVis(d) };
    (root.GA.layersExtra || []).forEach(fn => { try { fn(H).forEach(d => defs.push(d)); } catch (e) { console.warn('layer ext', e); } });
    const byId = Object.fromEntries(defs.map(d => [d.id, d]));
    const userDefs = []; // imported layers (import.js)

    function bldPopup(p) {
      const lv = p.lv != null ? nf(p.lv) : null;
      return `<b dir="auto">${esc(p.nm || t('g.building'))}</b><table><tr><td>${t('ly.floorsF')}</td><td class="num">${lv != null ? lv : `<em>${t('g.unknownHeight')}</em>`}</td></tr>${p.h != null ? `<tr><td>${t('ly.heightF')}</td><td class="num">${nf(p.h, 1)} m</td></tr>` : ''}<tr><td>${t('ly.periodF')}</td><td>${p.sd ? `<span dir="ltr">${esc(p.sd)}</span>` : t('nodata')}</td></tr><tr><td>building</td><td dir="ltr">${esc(p.b)}</td></tr></table><small dir="ltr">${esc(p.id)}</small>`;
    }
    let bldBusy = null;
    async function bldUpdate() {
      const any = BLD.some(k => S[k].on); if (!any) return;
      const my = {}; bldBusy = my; // any earlier detail request still in flight is now stale
      const z = map.getZoom(); if (z >= LITE_Z - 0.5) ensureLite().catch(() => { });
      if (z < DETAIL_Z) return z < LITE_Z ? 'city' : 'lite';
      const r = await viewport('buildings', procB, DETAIL_Z, 30); if (bldBusy !== my) return 'stale';
      map.getSource(lid('bld')).setData(fc(r.features)); await waitLoaded(lid('bld')); if (bldBusy !== my) return 'stale';
      cover.bld = r.bb; syncCover(true);
      BLD.forEach(k => S[k].on && status(k, 'ok', r.features.length));
      return r.features.length;
    }
    // Simplified citywide footprints (data/vec/buildings_lite.json, Douglas–Peucker 1 m) for neighbourhood scales.
    // The file is handed to the map's worker by URL, so parsing never blocks the page.
    const lite = { state: 0, n: (M() && M().layers.buildings_lite && M().layers.buildings_lite.features) || null };
    function ensureLite() {
      if (lite.state === 1 || lite.state === 2) return lite.p;
      lite.state = 1;
      lite.p = (async () => {
        await D.loadManifest(); const m = M(); lite.n = (m.layers.buildings_lite && m.layers.buildings_lite.features) || lite.n;
        const url = new URL('data/vec/buildings_lite.json?d=' + encodeURIComponent(m.dataVersion || m.generated || '0'), location.href).href;
        const id = lid('bldlite');
        if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: url, maxzoom: 15, tolerance: 0.25, buffer: 16 });
        BLD.forEach(k => byId[k].buildLite());
        applyOrder(); BLD.forEach(k => applyVis(byId[k]));
        await waitLoaded(id, 20000);
        lite.state = 2; BLD.forEach(k => applyVis(byId[k]));
        const z = map.getZoom(); BLD.forEach(k => { if (S[k].on && z >= LITE_Z && z < DETAIL_Z) status(k, 'lite', lite.n); }); emit();
      })().catch(e => { lite.state = -1; console.warn('buildings_lite', e); throw e; });
      return lite.p;
    }
    function bldVis(d) {
      const z = map.getZoom(), hideLite = z >= DETAIL_Z && covers(cover.bld), lt = new Set(d.liteLayers());
      return d.layers().filter(l => !(hideLite && lt.has(l)));
    }
    const bldScaleNote = () => { const z = map.getZoom(); return z < DETAIL_Z ? `<p class="lyr-src">${t(z < LITE_Z ? 'ly.bldZoomLite' : 'ly.bldLiteNote')}</p>` : ''; };
    // resolves once a GeoJSON source has processed its latest data and loaded its tiles (or after a time-out)
    function waitLoaded(id, ms) {
      return new Promise((res) => {
        let done = false; const fin = () => { if (done) return; done = true; map.off('sourcedata', on); map.off('error', onErr); clearTimeout(tm); res(); };
        const on = (e) => { if (e.sourceId === id && e.isSourceLoaded && map.isSourceLoaded(id)) fin(); };
        const onErr = (e) => { if (e.sourceId === id) fin(); };
        const tm = setTimeout(fin, ms || 4000); map.on('sourcedata', on); map.on('error', onErr);
      });
    }
    // which part of the map the detail sources currently hold; the overview stays visible outside it
    const cover = { bld: null, streets: null };
    function covers(bb) { if (!bb) return false; const b = map.getBounds(); return b.getWest() >= bb[0] - 1e-9 && b.getSouth() >= bb[1] - 1e-9 && b.getEast() <= bb[2] + 1e-9 && b.getNorth() <= bb[3] + 1e-9; }
    let coverKey = '';
    function syncCover(force) {
      if (!built) return; const z = map.getZoom() >= DETAIL_Z;
      const k = [z, covers(cover.bld), covers(cover.streets), lite.state].join();
      if (k === coverKey && !force) return; coverKey = k;
      BLD.concat(['streets']).forEach(id => S[id].on && applyVis(byId[id]));
    }

    // ---------- state / persistence ----------
    const KEY = 'granada-atlas.layers.v1';
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
    defs.forEach(d => { const sv = (saved.layers || {})[d.id] || {}; S[d.id] = Object.assign({ status: 'idle' }, d.def, sv, { opts: Object.assign({}, (d.def && d.def.opts) || {}, sv.opts || {}) }); });
    order = (saved.order || []).filter(id => byId[id]); { const had = order.length > 0; const missing = defs.slice().reverse().filter(d => !order.includes(d.id)).map(d => d.id); order = had ? missing.concat(order) : missing; } // top-first; layers added in a later version go on top
    if (saved.scope) scope = saved.scope;
    function persist() { try { const L = {}; defs.forEach(d => L[d.id] = { on: S[d.id].on, opacity: S[d.id].opacity, metric: S[d.id].metric, opts: S[d.id].opts }); localStorage.setItem(KEY, JSON.stringify({ layers: L, order: order.filter(id => byId[id]), scope })); } catch (e) { } }

    // ---------- runtime ----------
    async function ensureBuilt() {
      if (built) return; await D.loadManifest(); if (!map.isStyleLoaded()) await new Promise(r => map.once('idle', r));
      defs.forEach(d => { try { d.build(); } catch (e) { console.warn(d.id, e); } });
      addSrc('ly-mask', { type: 'geojson', data: fc() }); addLyr({ id: 'ly-mask', type: 'fill', source: 'ly-mask', paint: { 'fill-color': GA.palette.paper, 'fill-opacity': 0.86 } });
      addSrc('ly-hl', { type: 'geojson', data: fc() });
      addLyr({ id: 'ly-hl-fill', type: 'fill', source: 'ly-hl', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': P.red, 'fill-opacity': 0.25 } });
      addLyr({ id: 'ly-hl-line', type: 'line', source: 'ly-hl', paint: { 'line-color': P.red, 'line-width': 2.5 } });
      addLyr({ id: 'ly-hl-pt', type: 'circle', source: 'ly-hl', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 8, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': P.red, 'circle-stroke-width': 2.5 } });
      built = true; applyOrder(); defs.forEach(d => applyVis(d)); applyMask();
      map.on('moveend', refreshViewport);
      let mvT = 0; map.on('move', () => { const n = performance.now(); if (n - mvT > 80) { mvT = n; syncCover(); } });
      map.on('zoomend', () => emit());
      refreshAll();
    }
    function applyVis(d) { const on = S[d.id].on; const vis = d.visLayers ? new Set(d.visLayers()) : null; d.layers().forEach(l => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', on && (!vis || vis.has(l)) ? 'visible' : 'none')); applyOpacity(d); }
    function applyOpacity(d) { const o = S[d.id].opacity; if (d.applyOpacity) { d.applyOpacity(o); return; } Object.entries(d.opacityProp || {}).forEach(([l, prop]) => { if (map.getLayer(l)) map.setPaintProperty(l, prop, o); });  }
    function applyOrder() {
      if (!built) return; const all = order.map(id => byId[id] || userDefs.find(u => u.id === id)).filter(Boolean);
      // order is top-first; move each to just under the labels from bottom to top
      all.slice().reverse().forEach(d => d.layers().forEach(l => { if (map.getLayer(l)) map.moveLayer(l, map.getLayer(BEFORE) ? BEFORE : undefined); }));
      ['ly-mask', 'ly-hl-fill', 'ly-hl-line', 'ly-hl-pt'].forEach(l => map.getLayer(l) && map.moveLayer(l, map.getLayer(BEFORE) ? BEFORE : undefined));
    }
    async function runLoad(d) {
      if (!S[d.id].on) return;
      if (!d.load && !d.update) { status(d.id, 'ok'); return; } // raster image layers
      try {
        if (d.load) { status(d.id, 'loading'); const n = await d.load(); status(d.id, n === 0 ? 'empty' : 'ok', n); }
        if (d.update) {
          if (S[d.id].status !== 'ok' || !BLD.includes(d.id)) status(d.id, 'loading', S[d.id].statusExtra);
          const n = await d.update(); if (n === 'stale') return;
          if (n === 'city') status(d.id, d.id === 'bld_floors' ? 'city' : 'zoomLite');
          else if (n === 'lite') status(d.id, lite.state === 2 ? 'lite' : 'loading', lite.n); // the 50 m view stays until the footprints arrive
          else status(d.id, n === 'zoom' ? 'zoom' : n === 'overview' ? 'overview' : n === 0 ? 'empty' : 'ok', n);
        }
      } catch (e) { status(d.id, e.code === 'too_large' ? 'zoom' : 'failed', e.message); }
    }
    function refreshAll() { defs.forEach(d => runLoad(d)); }
    let vpTimer; function refreshViewport() { clearTimeout(vpTimer); vpTimer = setTimeout(() => defs.filter(d => d.update && S[d.id].on).forEach(d => runLoad(d)), 150); }
    function applyMask() {
      if (!built) return; const on = scope === 'areas' && maskRings.length;
      map.getSource('ly-mask').setData(on ? fc([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]].concat(maskRings.map(r => r.slice().reverse())) } }]) : fc());
    }

    const api = {
      defs, S, byId, userDefs, get order() { return order; }, get scope() { return scope; }, onChange: (f) => listeners.push(f), ensureBuilt,
      setOn(id, on) { const d = byId[id] || userDefs.find(u => u.id === id); if (!d) return; S[id].on = on; if (built) { applyVis(d); if (on) runLoad(d); } persist(); emit(); },
      setOpacity(id, o) { const d = byId[id] || userDefs.find(u => u.id === id); S[id].opacity = o; if (built) applyOpacity(d); persist(); if (typeof document !== 'undefined') document.querySelectorAll(`.lg-blk[data-ly="${id}"]`).forEach(el => el.style.setProperty('--lg-op', o)); },
      control(id, el) { const d = byId[id]; if (!d || !d.onControl) return; const r = d.onControl(el); persist(); if (r !== false) emit(); },
      setMetric(id, m) { S[id].metric = m; byId[id].restyle && byId[id].restyle(); persist(); emit(); },
      move(id, dir) { const i = order.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= order.length) return; order.splice(i, 1); order.splice(j, 0, id); applyOrder(); persist(); emit(); },
      setScope(s, rings) { scope = s; if (rings) maskRings = rings; applyMask(); persist(); emit(); },
      setMaskRings(rings) { maskRings = rings || []; applyMask(); },
      highlight(features) { if (built) map.getSource('ly-hl').setData(fc(features)); },
      legendHTML() {
        return order.map(id => byId[id] || userDefs.find(u => u.id === id)).filter(d => d && S[d.id] && S[d.id].on).map(d => `<div class="lg-blk" data-ly="${d.id}" style="--lg-op:${S[d.id].opacity == null ? 1 : S[d.id].opacity}"><h4>${esc(d.title())}</h4>${d.legend ? d.legend() : ''}</div>`).join(''); // swatches carry the layer's opacity, as drawn on the map
      },
      popupAt(point) {
        if (!built) return null;
        const all = order.map(id => byId[id] || userDefs.find(u => u.id === id)).filter(d => d && S[d.id].on && d.popup);
        for (const d of all) { const ls = d.popup.layers().filter(l => map.getLayer(l)); if (!ls.length) continue; const f = map.queryRenderedFeatures(point, { layers: ls })[0]; if (f) return { html: d.popup.html(f.properties, f), def: d, feature: f }; }
        return null;
      },
      // raster layers that can describe a clicked point (WMS GetFeatureInfo / WFS)
      async rasterInfoAt(ll) {
        if (!built) return null; const all = order.map(id => byId[id]).filter(d => d && S[d.id].on && d.infoAt);
        for (const d of all) { try { const h = await d.infoAt(ll); if (h) return { html: `<b>${esc(d.title())}</b><br>` + h, def: d }; } catch (e) { } }
        return null;
      },
      // user layers (imports)
      addUser(def) { userDefs.push(def); S[def.id] = Object.assign({ status: 'ok' }, def.def); if (!order.includes(def.id)) order.unshift(def.id); if (built) { def.build(map, BEFORE); applyOrder(); applyVis(def); } emit(); },
      removeUser(id) { const i = userDefs.findIndex(u => u.id === id); if (i < 0) return; const d = userDefs[i]; d.remove(map); userDefs.splice(i, 1); order = order.filter(x => x !== id); delete S[id]; emit(); },
      refreshUser(id) { const d = userDefs.find(u => u.id === id); if (d && built) { d.restyle && d.restyle(map); applyVis(d); } emit(); },
      DETAIL_Z, CHORO,
    };
    return api;
  }
  root.GA.layers = { create };
})(window);
