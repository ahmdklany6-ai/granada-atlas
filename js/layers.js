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
  const CHORO = ['#F8ECEC', '#EBC9C8', '#D98E8C', '#B04746', '#6E1C1B'];
  const FACC = { hospital: P.red, clinic: '#D9706E', doctors: P.ink, dentist: '#9A9EA4', pharmacy: P.blue, university: P.ink, college: '#6E737A', school: P.red, early_years: '#E4A8A6', hotel: P.red, hostel: P.ink, guest_house: P.blue, apartment: '#9A9EA4' };
  const SLOPE_K = [['0-2', '#F7F0F0'], ['2-5', '#F2D6D5'], ['5-10', '#E4A8A6'], ['10-15', '#D07674'], ['15-25', '#B2403E'], ['25-35', '#8C2120'], ['35+', '#5A1414']];
  const sw = (c, l, cls) => `<li><i class="sw ${cls || ''}" style="background:${c}"></i><span>${l}</span></li>`;
  const swl = (c, w, l, dash) => `<li><i class="sw ln" style="border-top:${w}px ${dash ? 'dashed' : 'solid'} ${c}"></i><span>${l}</span></li>`;
  const swd = (c, l) => `<li><i class="sw dot" style="background:${c}"></i><span>${l}</span></li>`;
  const iso = (s) => '⁦' + s + '⁩';

  function create(map, opts) {
    opts = opts || {};
    const S = {}; // layer state by id
    let order = []; let scope = 'city'; let maskRings = []; let built = false; const listeners = [];
    const emit = () => listeners.forEach(f => f());
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
      return { features: fs };
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
        async build() { addSrc(lid('landuse'), { type: 'geojson', data: fc() }); addLyr({ id: lid('landuse'), type: 'fill', source: lid('landuse'), paint: { 'fill-color': matchExpr('cat', P.landuse, '#E6E6E4'), 'fill-opacity': 0.7 } }); },
        async load() { if (this._loaded) return; const j = await D.single('landuse_overview'); j.features.forEach(procL); map.getSource(lid('landuse')).setData(j); this._loaded = j.features.length; return j.features.length; },
        layers: () => [lid('landuse')], opacityProp: { [lid('landuse')]: 'fill-opacity' },
        legend: () => `<ul class="lg">${Object.keys(P.landuse).map(k => sw(P.landuse[k], t('lu.c.' + k))).join('')}${sw('#E6E6E4', t('ly.luOther'))}</ul>`, src: () => 'OSM landuse · ODbL', popup: { layers: () => [lid('landuse')], html: (p) => `<b>${t('lu.c.' + p.cat) || p.cat}</b><br><small dir="ltr">landuse=${esc(p.lu)}</small>` } },
      { id: 'parks', group: 'land', title: () => t('ly.parks'), def: { on: false, opacity: 0.85 }, minZ: 13,
        build() { addSrc(lid('parks'), { type: 'geojson', data: fc() }); addLyr({ id: lid('parks'), type: 'fill', source: lid('parks'), paint: { 'fill-color': P.landuse.green, 'fill-opacity': ['match', ['get', 'le'], 'park', 0.85, 0.45], 'fill-outline-color': '#3F6E3C' } }); },
        async update() { const r = await viewport('parks', (f) => f, 13, 60); if (r.zoom) return 'zoom'; map.getSource(lid('parks')).setData(fc(r.features)); return r.features.length; },
        layers: () => [lid('parks')], opacityProp: { [lid('parks')]: 'fill-opacity' },
        legend: () => `<ul class="lg">${sw(P.landuse.green, 'leisure=park')}${sw('rgba(94,154,91,.45)', 'leisure=garden')}</ul><p class="lyr-src">${t('ly.gardenNote')}</p>`, src: () => 'OSM leisure · ODbL', popup: { layers: () => [lid('parks')], html: (p) => `<b dir="auto">${esc(p.nm || '—')}</b><br><small dir="ltr">leisure=${esc(p.le)}</small>` } },
      { id: 'water', group: 'land', title: () => t('ly.water'), def: { on: false, opacity: 1 },
        build() { addSrc(lid('water'), { type: 'geojson', data: fc() }); addLyr({ id: lid('water'), type: 'line', source: lid('water'), paint: { 'line-color': '#4F86A6', 'line-width': ['match', ['get', 'ww'], 'river', 2.4, 1], 'line-opacity': 1 } }); },
        async load() { if (this._loaded) return; const j = await D.single('water'); map.getSource(lid('water')).setData(j); this._loaded = 1; return j.features.length; },
        layers: () => [lid('water')], opacityProp: { [lid('water')]: 'line-opacity' }, legend: () => `<ul class="lg">${swl('#4F86A6', 2.4, 'waterway=river')}${swl('#4F86A6', 1, 'stream / canal / drain')}</ul>`, src: () => 'OSM waterway · ODbL' },
      { id: 'barrios', group: 'admin', title: () => t('ly.barrios'), def: { on: false, opacity: 0.8, metric: 'd_health' },
        build() { addSrc(lid('barrios'), { type: 'geojson', data: fc() }); addLyr({ id: lid('barrios'), type: 'fill', source: lid('barrios'), paint: { 'fill-color': '#EEE', 'fill-opacity': 0.8 } }); addLyr({ id: lid('barrios', 'ln'), type: 'line', source: lid('barrios'), paint: { 'line-color': '#FFFFFF', 'line-width': 1 } }); },
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
      { id: 'boundaries', group: 'admin', title: () => t('ly.boundaries'), def: { on: true, opacity: 1 },
        build() { addSrc(lid('boundaries'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('boundaries', 'b'), type: 'line', source: lid('boundaries'), filter: ['==', ['get', 'kind'], 'barrio'], minzoom: 12, paint: { 'line-color': '#6E737A', 'line-width': 0.8, 'line-dasharray': [3, 2], 'line-opacity': 1 } });
          addLyr({ id: lid('boundaries', 'd'), type: 'line', source: lid('boundaries'), filter: ['==', ['get', 'kind'], 'distrito'], paint: { 'line-color': '#3C4046', 'line-width': 1.4, 'line-opacity': 1 } });
          addLyr({ id: lid('boundaries', 'u'), type: 'line', source: lid('boundaries'), filter: ['in', ['get', 'kind'], ['literal', ['urban_centre', 'historic_core']]], paint: { 'line-color': P.red, 'line-width': ['match', ['get', 'kind'], 'historic_core', 1.6, 2], 'line-dasharray': ['literal', [4, 2]], 'line-opacity': 1 } });
          addLyr({ id: lid('boundaries', 'lbl'), type: 'symbol', source: lid('boundaries'), filter: ['==', ['get', 'kind'], 'barrio'], minzoom: 13, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'symbol-placement': 'point' }, paint: { 'text-color': '#3C4046', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4 } }); },
        async load() { if (this._loaded) return; const j = await D.single('admin'); map.getSource(lid('boundaries')).setData(j); this._loaded = 1; return j.features.length; },
        layers: () => ['b', 'd', 'u', 'lbl'].map(k => lid('boundaries', k)), opacityProp: { [lid('boundaries', 'b')]: 'line-opacity', [lid('boundaries', 'd')]: 'line-opacity', [lid('boundaries', 'u')]: 'line-opacity' },
        legend: () => `<ul class="lg">${swl('#3C4046', 1.4, t('ly.distrito'))}${swl('#6E737A', 1, t('ly.barrio'), true)}${swl(P.red, 2, t('ly.urbanCentre'), true)}</ul>`, src: () => 'OSM admin_level 9/10 · JRC GHSL UCDB 2025' },
      { id: 'bld_floors', group: 'bld', title: () => t('ly.bldFloors'), def: { on: true, opacity: 0.9 }, minZ: 0,
        build() { const o = M().overview.buildingFloors; addSrc(lid('bld_floors', 'ov'), { type: 'image', url: 'data/' + o.file, coordinates: o.coordinates }); addLyr({ id: lid('bld_floors', 'ov'), type: 'raster', source: lid('bld_floors', 'ov'), maxzoom: DETAIL_Z, paint: { 'raster-opacity': 0.9, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
          hatchImage(); addSrc(lid('bld'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('bld_floors'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, filter: ['!=', ['get', 'band'], 'no_data'], paint: { 'fill-color': matchExpr('band', P.band, '#FFF'), 'fill-opacity': 0.9, 'fill-outline-color': '#FFFFFF' } });
          addLyr({ id: lid('bld_floors', 'unk'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, filter: ['==', ['get', 'band'], 'no_data'], paint: { 'fill-pattern': 'ga-hatch', 'fill-opacity': 0.9 } });
          addLyr({ id: lid('bld_floors', 'unkln'), type: 'line', source: lid('bld'), minzoom: DETAIL_Z, filter: ['==', ['get', 'band'], 'no_data'], paint: { 'line-color': '#8A8F96', 'line-width': 0.5, 'line-opacity': 0.9 } }); },
        update: () => bldUpdate(), layers: () => [lid('bld_floors', 'ov'), lid('bld_floors'), lid('bld_floors', 'unk'), lid('bld_floors', 'unkln')],
        opacityProp: { [lid('bld_floors', 'ov')]: 'raster-opacity', [lid('bld_floors')]: 'fill-opacity', [lid('bld_floors', 'unk')]: 'fill-opacity', [lid('bld_floors', 'unkln')]: 'line-opacity' },
        legend: () => `<ul class="lg">${['1-2', '3-4', '5-8', '9+'].map(k => sw(P.band[k], t('b.floors', { v: iso(k.replace('-', '–')) }))).join('')}<li><i class="sw hatch"></i><span>${t('g.unknownHeight')}</span></li></ul><p class="lyr-src">${t(map.getZoom() < DETAIL_Z ? 'ly.floorsOverview' : 'ly.floorsDetail')}</p>`,
        src: () => 'OSM building:levels · ODbL', popup: { layers: () => [lid('bld_floors'), lid('bld_floors', 'unk')], html: (p) => bldPopup(p) } },
      { id: 'bld_fg', group: 'bld', title: () => t('ly.bldFg'), def: { on: false, opacity: 1 }, minZ: DETAIL_Z,
        build() { addSrc(lid('bld'), { type: 'geojson', data: fc() }); addLyr({ id: lid('bld_fg'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, paint: { 'fill-color': P.ink, 'fill-opacity': 1 } }); },
        update: () => bldUpdate(), layers: () => [lid('bld_fg')], opacityProp: { [lid('bld_fg')]: 'fill-opacity' },
        legend: () => `<ul class="lg">${sw(P.ink, t('g.building'))}</ul>`, src: () => 'OSM building · ODbL', popup: { layers: () => [lid('bld_fg')], html: (p) => bldPopup(p) } },
      { id: 'bld_period', group: 'bld', title: () => t('ly.bldPeriod'), def: { on: false, opacity: 1 }, minZ: DETAIL_Z,
        build() { addSrc(lid('bld'), { type: 'geojson', data: fc() }); addLyr({ id: lid('bld_period'), type: 'fill', source: lid('bld'), minzoom: DETAIL_Z, paint: { 'fill-color': matchExpr('period', Object.assign({}, P.period, { no_data: '#F3F3F2' }), '#F3F3F2'), 'fill-opacity': 1, 'fill-outline-color': '#C6C7C9' } }); },
        update: () => bldUpdate(), layers: () => [lid('bld_period')], opacityProp: { [lid('bld_period')]: 'fill-opacity' },
        legend: () => `<ul class="lg">${A.PERIODS.map(k => sw(P.period[k], root.GA.report.periodLabel(k))).join('')}${sw('#F3F3F2', t('nodata'))}</ul><p class="lyr-src">${t('ly.periodNote')}</p>`, src: () => 'OSM start_date · ODbL', popup: { layers: () => [lid('bld_period')], html: (p) => bldPopup(p) } },
      { id: 'streets', group: 'streets', title: () => t('ly.streets'), def: { on: false, opacity: 1 },
        build() { addSrc(lid('streets', 'maj'), { type: 'geojson', data: fc() }); addSrc(lid('streets'), { type: 'geojson', data: fc() });
          const paint = { 'line-color': matchExpr('tier', P.tier, '#C3C6CA'), 'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['match', ['get', 'tier'], 'primary', 2, 'collector', 1.2, 0.5], 17, ['match', ['get', 'tier'], 'primary', 6, 'collector', 4, 'local', 2, 1.2]], 'line-opacity': 1 };
          addLyr({ id: lid('streets', 'maj'), type: 'line', source: lid('streets', 'maj'), maxzoom: DETAIL_Z, layout: { 'line-cap': 'round' }, paint });
          addLyr({ id: lid('streets'), type: 'line', source: lid('streets'), minzoom: DETAIL_Z, layout: { 'line-cap': 'round' }, paint: Object.assign({}, paint, { 'line-dasharray': ['match', ['get', 'tier'], 'pedestrian', ['literal', [2, 1]], ['literal', [1, 0]]] }) }); },
        async load() { if (this._majLoaded) return; const j = await D.single('streets_major'); j.features.forEach(procS); map.getSource(lid('streets', 'maj')).setData(j); this._majLoaded = 1; },
        async update() { const r = await viewport('streets', procS, DETAIL_Z, 40); if (r.zoom) return 'overview'; map.getSource(lid('streets')).setData(fc(r.features)); return r.features.length; },
        layers: () => [lid('streets', 'maj'), lid('streets')], opacityProp: { [lid('streets', 'maj')]: 'line-opacity', [lid('streets')]: 'line-opacity' },
        legend: () => `<ul class="lg">${['primary', 'collector', 'local', 'pedestrian'].map(k => swl(P.tier[k], P.tierWidth[k] + 0.5, t('tier.' + k), k === 'pedestrian')).join('')}</ul><p class="lyr-src">${t(map.getZoom() < DETAIL_Z ? 'ly.streetsOverview' : 'ly.streetsDetail')}</p>`, src: () => 'OSM highway · ODbL',
        popup: { layers: () => [lid('streets'), lid('streets', 'maj')], html: (p) => `<b dir="auto">${esc(p.nm || '—')}</b><br>${t('tier.' + p.tier) || ''} <small dir="ltr">highway=${esc(p.hw)}</small>` } },
      { id: 'contours', group: 'terrain', title: () => t('ly.contours'), def: { on: false, opacity: 0.8 },
        build() { addSrc(lid('contours', '10'), { type: 'geojson', data: fc() }); addSrc(lid('contours', '20'), { type: 'geojson', data: fc() });
          addLyr({ id: lid('contours', '20'), type: 'line', source: lid('contours', '20'), maxzoom: 13.5, paint: { 'line-color': '#7A5A48', 'line-width': ['match', ['%', ['get', 'elev'], 100], 0, 1, 0.4], 'line-opacity': 0.8 } });
          addLyr({ id: lid('contours', '10'), type: 'line', source: lid('contours', '10'), minzoom: 13.5, paint: { 'line-color': '#7A5A48', 'line-width': ['match', ['get', 'idx'], 1, 1.1, 0.5], 'line-opacity': 0.8 } });
          addLyr({ id: lid('contours', 'lbl'), type: 'symbol', source: lid('contours', '10'), minzoom: 15, filter: ['==', ['get', 'idx'], 1], layout: { 'symbol-placement': 'line', 'text-field': ['to-string', ['get', 'elev']], 'text-font': ['Noto Sans Regular'], 'text-size': 10 }, paint: { 'text-color': '#7A5A48', 'text-halo-color': '#FFF', 'text-halo-width': 1.2 } }); },
        async load() { if (this._loaded) return; const [a, b] = await Promise.all([D.single('contours_10m'), D.single('contours_20m')]); map.getSource(lid('contours', '10')).setData(a); map.getSource(lid('contours', '20')).setData(b); this._loaded = 1; return a.features.length + b.features.length; },
        layers: () => [lid('contours', '20'), lid('contours', '10'), lid('contours', 'lbl')], opacityProp: { [lid('contours', '20')]: 'line-opacity', [lid('contours', '10')]: 'line-opacity' },
        legend: () => `<ul class="lg">${swl('#7A5A48', 1, t('ly.contourIdx'))}${swl('#7A5A48', 0.5, t('ly.contourMinor'))}</ul><p class="lyr-src">${t('ly.contourNote')}</p>`, src: () => 'gdal:contour · IGN MDT25 · CC BY 4.0' },
    ];
    ['health', 'education', 'stay'].forEach(k => defs.push({ id: 'fac_' + k, group: 'fac', title: () => t('g.' + k), def: { on: false, opacity: 1 },
      build() { addSrc(lid(this.id), { type: 'geojson', data: fc() }); addLyr({ id: lid(this.id), type: 'circle', source: lid(this.id), paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, ['match', ['get', 'cls'], ['hospital', 'university'], 4, 2], 17, ['match', ['get', 'cls'], ['hospital', 'university'], 9, 5]], 'circle-color': matchExpr('cls', FACC, '#C3C6CA'), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-opacity': 1, 'circle-stroke-opacity': 1 } }); },
      async load() { if (this._loaded) return; const j = await D.single(this.id); map.getSource(lid(this.id)).setData(j); this._loaded = 1; this._by = {}; j.features.forEach(f => this._by[f.properties.cls] = (this._by[f.properties.cls] || 0) + 1); return j.features.length; },
      layers() { return [lid(this.id)]; }, opacityProp: { [lid('fac_' + k)]: 'circle-opacity' },
      legend() { return `<ul class="lg">${Object.keys(D.FAC_TAGS[k]).map(c => swd(FACC[c], t('fac.' + c) + (this._by && this._by[c] ? ` <small class="num">(${this._by[c]})</small>` : ''))).join('')}</ul><p class="lyr-src">${t('ly.facNote')}</p>`; },
      src: () => 'OSM · Overpass ' + ((M() && M().layers['fac_' + k] && M().layers['fac_' + k].date) || '').slice(0, 10) + ' · ODbL',
      popup: { layers: () => [lid('fac_' + k)], html: (p) => `<b dir="auto">${esc(p.nm || '—')}</b><br>${t('fac.' + p.cls)} <small dir="ltr">(${esc(p.cls)} · ${esc(p.id)})</small>${p.op ? `<br><small dir="auto">${esc(p.op)}</small>` : ''}` } }));
    defs.push({ id: 'bus_stops', group: 'fac', title: () => t('g.transit'), def: { on: false, opacity: 1 },
      build() { addSrc(lid('bus'), { type: 'geojson', data: fc() }); addLyr({ id: lid('bus'), type: 'circle', source: lid('bus'), paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 17, 4.5], 'circle-color': P.ink, 'circle-stroke-color': '#FFF', 'circle-stroke-width': 1, 'circle-opacity': 1 } }); },
      async load() { if (this._loaded) return; const j = await D.single('bus_stops'); map.getSource(lid('bus')).setData(j); this._loaded = 1; return j.features.length; },
      layers: () => [lid('bus')], opacityProp: { [lid('bus')]: 'circle-opacity' },
      legend: () => `<ul class="lg">${swd(P.ink, t('poi.transit:bus'))}</ul><p class="lyr-src">${t('g.fFreqGap')}</p>`, src: () => 'OSM highway=bus_stop · ODbL',
      popup: { layers: () => [lid('bus')], html: (p) => `<b dir="auto">${esc(p.nm || '—')}</b><br><small dir="ltr">ref ${esc(p.ref || '—')} · ${esc(p.op || '')}</small><br><small>${t('ly.noFreq')}</small>` } });

    const byId = Object.fromEntries(defs.map(d => [d.id, d]));
    const userDefs = []; // imported layers (import.js)

    function bldPopup(p) {
      const lv = p.lv != null ? nf(p.lv) : null;
      return `<b dir="auto">${esc(p.nm || t('g.building'))}</b><table><tr><td>${t('ly.floorsF')}</td><td class="num">${lv != null ? lv : `<em>${t('g.unknownHeight')}</em>`}</td></tr>${p.h != null ? `<tr><td>${t('ly.heightF')}</td><td class="num">${nf(p.h, 1)} m</td></tr>` : ''}<tr><td>${t('ly.periodF')}</td><td>${p.sd ? `<span dir="ltr">${esc(p.sd)}</span>` : t('nodata')}</td></tr><tr><td>building</td><td dir="ltr">${esc(p.b)}</td></tr></table><small dir="ltr">${esc(p.id)}</small>`;
    }
    let bldBusy = null;
    async function bldUpdate() {
      const any = ['bld_floors', 'bld_fg', 'bld_period'].some(k => S[k].on); if (!any) return;
      if (map.getZoom() < DETAIL_Z) return 'zoom';
      const my = {}; bldBusy = my;
      const r = await viewport('buildings', procB, DETAIL_Z, 30); if (bldBusy !== my) return;
      map.getSource(lid('bld')).setData(fc(r.features)); ['bld_floors', 'bld_fg', 'bld_period'].forEach(k => S[k].on && status(k, 'ok', r.features.length));
      return r.features.length;
    }

    // ---------- state / persistence ----------
    const KEY = 'granada-atlas.layers.v1';
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
    defs.forEach(d => { S[d.id] = Object.assign({ status: 'idle' }, d.def, (saved.layers || {})[d.id] || {}); });
    order = (saved.order || []).filter(id => byId[id]); defs.slice().reverse().forEach(d => { if (!order.includes(d.id)) order.push(d.id); }); // top-first
    if (saved.scope) scope = saved.scope;
    function persist() { try { const L = {}; defs.forEach(d => L[d.id] = { on: S[d.id].on, opacity: S[d.id].opacity, metric: S[d.id].metric }); localStorage.setItem(KEY, JSON.stringify({ layers: L, order: order.filter(id => byId[id]), scope })); } catch (e) { } }

    // ---------- runtime ----------
    async function ensureBuilt() {
      if (built) return; await D.loadManifest(); if (!map.isStyleLoaded()) await new Promise(r => map.once('idle', r));
      defs.forEach(d => { try { d.build(); } catch (e) { console.warn(d.id, e); } });
      addSrc('ly-mask', { type: 'geojson', data: fc() }); addLyr({ id: 'ly-mask', type: 'fill', source: 'ly-mask', paint: { 'fill-color': '#FAFAF9', 'fill-opacity': 0.86 } });
      addSrc('ly-hl', { type: 'geojson', data: fc() });
      addLyr({ id: 'ly-hl-fill', type: 'fill', source: 'ly-hl', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': P.red, 'fill-opacity': 0.25 } });
      addLyr({ id: 'ly-hl-line', type: 'line', source: 'ly-hl', paint: { 'line-color': P.red, 'line-width': 2.5 } });
      addLyr({ id: 'ly-hl-pt', type: 'circle', source: 'ly-hl', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 8, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': P.red, 'circle-stroke-width': 2.5 } });
      built = true; applyOrder(); defs.forEach(d => applyVis(d)); applyMask();
      map.on('moveend', refreshViewport);
      map.on('zoomend', () => emit());
      refreshAll();
    }
    function applyVis(d) { const on = S[d.id].on; d.layers().forEach(l => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none')); applyOpacity(d); }
    function applyOpacity(d) { const o = S[d.id].opacity; Object.entries(d.opacityProp || {}).forEach(([l, prop]) => { if (map.getLayer(l)) map.setPaintProperty(l, prop, o); }); if (d.id === 'bld_floors' && map.getLayer(lid('bld_floors', 'ov'))) map.setPaintProperty(lid('bld_floors', 'ov'), 'raster-opacity', o); }
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
        if (d.update) { status(d.id, 'loading'); const n = await d.update(); status(d.id, n === 'zoom' ? (d.id === 'bld_floors' ? 'overview' : 'zoom') : n === 'overview' ? 'overview' : n === 0 ? 'empty' : 'ok', n); }
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
      setOpacity(id, o) { const d = byId[id] || userDefs.find(u => u.id === id); S[id].opacity = o; if (built) applyOpacity(d); persist(); },
      setMetric(id, m) { S[id].metric = m; byId[id].restyle && byId[id].restyle(); persist(); emit(); },
      move(id, dir) { const i = order.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= order.length) return; order.splice(i, 1); order.splice(j, 0, id); applyOrder(); persist(); emit(); },
      setScope(s, rings) { scope = s; if (rings) maskRings = rings; applyMask(); persist(); emit(); },
      setMaskRings(rings) { maskRings = rings || []; applyMask(); },
      highlight(features) { if (built) map.getSource('ly-hl').setData(fc(features)); },
      legendHTML() {
        return order.map(id => byId[id] || userDefs.find(u => u.id === id)).filter(d => d && S[d.id] && S[d.id].on).map(d => `<h4>${esc(d.title())}</h4>${d.legend ? d.legend() : ''}`).join('');
      },
      popupAt(point) {
        if (!built) return null;
        const all = order.map(id => byId[id] || userDefs.find(u => u.id === id)).filter(d => d && S[d.id].on && d.popup);
        for (const d of all) { const ls = d.popup.layers().filter(l => map.getLayer(l)); if (!ls.length) continue; const f = map.queryRenderedFeatures(point, { layers: ls })[0]; if (f) return { html: d.popup.html(f.properties, f), def: d, feature: f }; }
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
