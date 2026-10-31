/* Additional citywide layers (v3): places and activities (Overture), scheduled bus service
   (26 Oct 2026), mapped trees (OSM, by viewport) and tree-cover density (Copernicus), flood
   zones (SNCZI), strategic noise (SICA), land-surface temperature (MODIS), historical maps and
   orthophotos (IGN). Raster services are displayed live from their official WMS; nothing is
   copied. Every legend states units, date and whether a value is measured or modelled. */
(function (root) {
  const { data: D, palette: P, ext: X, i18n: I } = root.GA;
  const PLACE_COL = { food_and_drink: '#D98A2B', shopping: '#992B2A', services_and_business: '#6E737A', health_care: '#2F5F8A', lifestyle_services: '#B97FA6', lodging: '#6E1C1B', travel_and_transportation: '#222428', education: '#4F7FB8', sports_and_recreation: '#5E9A5B', arts_and_entertainment: '#7B5EA7', community_and_government: '#3E7C8C', cultural_and_historic: '#8C6D46', geographic_entities: '#A6B39C', _none: '#C3C6CA' };
  const PLACE_GROUPS = Object.keys(PLACE_COL);
  const BUS_LV = { 'High': '#6E1C1B', 'Medium-high': '#B04746', 'Medium-low': '#D98E8C', 'Low': '#F2D6D5', 'No scheduled service': '#FFFFFF' };
  const BUS_ORDER = ['High', 'Medium-high', 'Medium-low', 'Low', 'No scheduled service'];
  root.GA.places = { PLACE_COL, PLACE_GROUPS, BUS_LV, BUS_ORDER };

  root.GA.layersExtra = root.GA.layersExtra || [];
  root.GA.layersExtra.push(function (H) {
    const { map, S, addSrc, addLyr, lid, status, fc, t, esc, nf, sw, swl, swd, iso } = H;
    const raster = (id, tiles, opacity, attribution, extra) => { addSrc(lid(id), Object.assign({ type: 'raster', tiles: [tiles], tileSize: 256, attribution }, extra || {})); addLyr({ id: lid(id), type: 'raster', source: lid(id), paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 } }); };
    const legImg = (url, alt) => `<img class="lg-img" src="${esc(url)}" alt="${esc(alt || '')}" loading="lazy" onerror="this.replaceWith(document.createTextNode(''))">`;
    // classified rasters: tiles and legend come from the same class table (js/rasterclass.js)
    const RC = root.GA.rasterClass; RC.register();
    const rcLegend = (scheme, opts) => `<ul class="lg">${RC.legendItems(scheme, opts).map(i => i.hatch ? `<li><i class="sw hatch"></i><span>${i.label}</span></li>` : i.line ? swl(i.line, i.w || 2, i.label) : sw(i.sw, i.label)).join('')}</ul>`;
    const kv = (rows) => `<table>${rows.filter(r => r[1] != null && r[1] !== '').map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
    const defs = [];

    // ---------- Places and activities (Overture) ----------
    defs.push({ id: 'places', group: 'act', title: () => t('ly3.places'), def: { on: false, opacity: 1, opts: { groups: PLACE_GROUPS.filter(g => g !== 'geographic_entities'), closed: false, minConf: 0 } },
      build() {
        addSrc(lid('places'), { type: 'geojson', data: fc(), cluster: true, clusterRadius: 38, clusterMaxZoom: 16 });
        addLyr({ id: lid('places', 'cl'), type: 'circle', source: lid('places'), filter: ['has', 'point_count'], paint: { 'circle-color': 'rgba(34,36,40,.78)', 'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 9, 50, 14, 500, 22, 3000, 30], 'circle-stroke-color': '#FFF', 'circle-stroke-width': 1.2, 'circle-opacity': 1 } });
        addLyr({ id: lid('places', 'cn'), type: 'symbol', source: lid('places'), filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-allow-overlap': true }, paint: { 'text-color': '#FFF' } });
        addLyr({ id: lid('places'), type: 'circle', source: lid('places'), filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 6], 'circle-color': ['match', ['coalesce', ['get', 'g'], '_none'], ...Object.entries(PLACE_COL).flat(), '#C3C6CA'], 'circle-stroke-color': ['match', ['get', 's'], 'permanently_closed', '#992B2A', '#FFFFFF'], 'circle-stroke-width': ['match', ['get', 's'], 'permanently_closed', 1.6, 1], 'circle-opacity': 1 } });
      },
      async load() { const j = await D.single('places'); this._all = j.features; this.refilter(); return this._shown; },
      refilter() {
        if (!this._all) return; const o = S.places.opts; const gs = new Set(o.groups);
        const q = (o.q || '').trim().toLowerCase();
        const fs = this._all.filter(f => { const p = f.properties; if (p.dup) return false; if (!gs.has(p.g || '_none')) return false; if (!o.closed && p.s === 'permanently_closed') return false; if ((p.cf || 0) < o.minConf) return false; return true; });
        this._shown = fs.length; this._hits = q.length >= 2 ? this._all.filter(f => !f.properties.dup && ((f.properties.n || '').toLowerCase().includes(q) || (f.properties.c || '').includes(q) || (f.properties.cd || '').includes(q))).slice(0, 8) : [];
        const src = map.getSource(lid('places')); if (src) src.setData(fc(fs));
      },
      layers: () => [lid('places', 'cl'), lid('places', 'cn'), lid('places')], opacityProp: { [lid('places')]: 'circle-opacity', [lid('places', 'cl')]: 'circle-opacity' },
      controls() {
        const o = S.places.opts; const st = (D.manifest && D.manifest.layers.places && D.manifest.layers.places.stats) || {};
        return `<div class="ctl-grid">${PLACE_GROUPS.map(g => `<label class="chk"><input type="checkbox" data-ly-ctl="places" data-k="g:${g}" ${o.groups.includes(g) ? 'checked' : ''}><i class="sw dot" style="background:${PLACE_COL[g]}"></i>${t('pg.' + g)} <small class="num">${nf((st.groups || {})[g])}</small></label>`).join('')}</div>
          <div class="row2"><button class="btn btn-tiny" data-ly-ctl="places" data-k="all">${t('ly3.all')}</button><button class="btn btn-tiny" data-ly-ctl="places" data-k="none">${t('ly3.none')}</button></div>
          <label class="chk"><input type="checkbox" data-ly-ctl="places" data-k="closed" ${o.closed ? 'checked' : ''}> ${t('ly3.showClosed')}</label>
          <label class="row2">${t('ly3.minConf')} <select data-ly-ctl="places" data-k="conf">${[0, 0.5, 0.7, 0.9].map(v => `<option value="${v}" ${o.minConf === v ? 'selected' : ''}>≥ ${v}</option>`).join('')}</select></label>
          <label class="name"><span>${t('ly3.search')}</span><input type="search" dir="auto" data-ly-ctl="places" data-k="q" value="${esc(o.q || '')}" placeholder="${esc(t('ly3.searchPh'))}"></label>
          ${(this._hits || []).length ? `<ul class="hits">${this._hits.map(f => `<li><button class="link" data-ly-ctl="places" data-k="go" data-ll="${f.geometry.coordinates.join(',')}"><bdi>${esc(f.properties.n)}</bdi></button> <small>${esc(f.properties.cd || f.properties.c || '')}</small></li>`).join('')}</ul>` : (o.q && o.q.length >= 2 ? `<p class="fine">${t('ly3.noHits')}</p>` : '')}
          <p class="fine">${t('ly3.shown', { n: nf(this._shown) })}</p>`;
      },
      onControl(el) {
        const o = S.places.opts; const k = el.dataset.k;
        if (k.startsWith('g:')) { const g = k.slice(2); o.groups = el.checked ? o.groups.concat([g]) : o.groups.filter(x => x !== g); }
        else if (k === 'all') o.groups = PLACE_GROUPS.slice(); else if (k === 'none') o.groups = [];
        else if (k === 'closed') o.closed = el.checked; else if (k === 'conf') o.minConf = +el.value;
        else if (k === 'q') o.q = el.value;
        else if (k === 'go') { const ll = el.dataset.ll.split(',').map(Number); map.flyTo({ center: ll, zoom: 18 }); return false; }
        this.refilter(); status('places', 'ok', this._shown);
      },
      legend() { return `<ul class="lg">${S.places.opts.groups.map(g => swd(PLACE_COL[g], t('pg.' + g))).join('')}<li><i class="sw dot" style="background:#fff;border:2px solid #992B2A"></i><span>${t('ly3.closedMark')}</span></li><li><i class="sw dot" style="background:rgba(34,36,40,.78)"></i><span>${t('ly3.cluster')}</span></li></ul><p class="lyr-src">${t('ly3.placesNote')}</p>`; },
      src: () => 'Overture Maps Foundation · Places · CDLA-Permissive-2.0',
      popup: { layers: () => [lid('places')], html: (p) => `<b dir="auto">${esc(p.n || '—')}</b><br><small>${t('pg.' + (p.g || '_none'))} · <span dir="ltr">${esc(p.c || '')}${p.cd && p.cd !== p.c ? ' / ' + esc(p.cd) : ''}</span></small>${kv([[t('ly3.addr'), p.a ? `<bdi>${esc(p.a)}</bdi>` : null], [t('ly3.locality'), p.l ? esc(p.l) : null], [t('ly3.status'), p.s ? t('ly3.st.' + p.s) : t('ly3.st.missing')], [t('ly3.conf'), p.cf != null ? `<span class="num">${nf(p.cf, 2)}</span>` : null], [t('ly3.web'), p.w ? `<a href="${esc(p.w)}" target="_blank" rel="noopener" dir="ltr">${esc(p.w.replace(/^https?:\/\//, '').slice(0, 34))}</a>` : null], [t('ly3.phone'), p.ph ? `<span dir="ltr">${esc(p.ph)}</span>` : null]])}<small>${t('ly3.confNote')}</small><br><small dir="ltr">Overture ${esc(p.id)}</small>` },
    });

    // ---------- Scheduled bus service (26 Oct 2026) ----------
    defs.push({ id: 'bus_service', group: 'act', title: () => t('ly3.bus'), def: { on: false, opacity: 1, opts: { metric: 'trips_day', route: '', levels: BUS_ORDER.slice(), scheduledOnly: false } },
      build() {
        addSrc(lid('bussvc'), { type: 'geojson', data: fc() });
        addLyr({ id: lid('bussvc'), type: 'circle', source: lid('bussvc'), paint: { 'circle-radius': 3, 'circle-color': ['match', ['get', 'service_level'], ...Object.entries(BUS_LV).flat(), '#FFF'], 'circle-stroke-color': ['match', ['get', 'service_level'], 'No scheduled service', '#8A8F96', '#FFFFFF'], 'circle-stroke-width': 1, 'circle-opacity': 0.92, 'circle-stroke-opacity': 1 } });
        this.restyle();
      },
      async load() { const j = await D.single('bus_service'); this._all = j.features; this._routes = [...new Set(j.features.flatMap(f => String(f.properties.routes || '').split(/[;,]\s*|\s+/).filter(Boolean)))].sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999) || a.localeCompare(b)); this._max = { trips_day: Math.max(...j.features.map(f => f.properties.trips_day)), trips_7_9: Math.max(...j.features.map(f => f.properties.trips_7_9)) }; this.refilter(); return this._shown; },
      refilter() {
        if (!this._all) return; const o = S.bus_service.opts; const lv = new Set(o.levels);
        const fs = this._all.filter(f => { const p = f.properties; if (!lv.has(p.service_level)) return false; if (o.scheduledOnly && !p.trips_day) return false; if (o.route && !String(p.routes || '').split(/[;,]\s*|\s+/).includes(o.route)) return false; return true; });
        this._shown = fs.length; const src = map.getSource(lid('bussvc')); if (src) src.setData(fc(fs)); this.restyle();
      },
      restyle() { if (!map.getLayer(lid('bussvc'))) return; const m = S.bus_service.opts.metric; const mx = (this._max && this._max[m]) || (m === 'trips_day' ? 909 : 120); const R = ['*', ['sqrt', ['/', ['to-number', ['get', m]], mx]], 1]; map.setPaintProperty(lid('bussvc'), 'circle-radius', ['interpolate', ['linear'], ['zoom'], 11, ['+', 1.5, ['*', R, 9]], 16, ['+', 3, ['*', R, 22]]]); },
      layers: () => [lid('bussvc')], opacityProp: { [lid('bussvc')]: 'circle-opacity' },
      controls() {
        const o = S.bus_service.opts;
        return `<label class="row2">${t('ly3.busMetric')} <select data-ly-ctl="bus_service" data-k="metric"><option value="trips_day" ${o.metric === 'trips_day' ? 'selected' : ''}>${t('ly3.tripsDay')}</option><option value="trips_7_9" ${o.metric === 'trips_7_9' ? 'selected' : ''}>${t('ly3.trips79')}</option></select></label>
          <label class="row2">${t('ly3.route')} <select data-ly-ctl="bus_service" data-k="route"><option value="">${t('ly3.allRoutes')}</option>${(this._routes || []).map(r => `<option value="${esc(r)}" ${o.route === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
          <div class="ctl-grid">${BUS_ORDER.map(l => `<label class="chk"><input type="checkbox" data-ly-ctl="bus_service" data-k="lv:${l}" ${o.levels.includes(l) ? 'checked' : ''}><i class="sw dot" style="background:${BUS_LV[l]};border:1px solid #8A8F96"></i>${t('bl.' + l)}</label>`).join('')}</div>
          <label class="chk"><input type="checkbox" data-ly-ctl="bus_service" data-k="sched" ${o.scheduledOnly ? 'checked' : ''}> ${t('ly3.schedOnly')}</label><p class="fine">${t('ly3.shownStops', { n: nf(this._shown) })}</p>`;
      },
      onControl(el) { const o = S.bus_service.opts; const k = el.dataset.k; if (k === 'metric') o.metric = el.value; else if (k === 'route') o.route = el.value; else if (k === 'sched') o.scheduledOnly = el.checked; else if (k.startsWith('lv:')) { const l = k.slice(3); o.levels = el.checked ? o.levels.concat([l]) : o.levels.filter(x => x !== l); } this.refilter(); status('bus_service', 'ok', this._shown); },
      legend() {
        const o = S.bus_service.opts; const mx = (this._max && this._max[o.metric]) || 909; const vals = o.metric === 'trips_day' ? [10, 100, 400, mx] : [2, 20, 60, mx];
        const r = (v) => 3 + Math.sqrt(v / mx) * 22 * Math.pow(2, Math.min(0, map.getZoom() - 16)) ;
        return `<h4>${t(o.metric === 'trips_day' ? 'ly3.tripsDay' : 'ly3.trips79')}</h4><div class="prop-lg">${vals.map(v => `<span><i style="width:${(2 * Math.max(3, r(v))).toFixed(1)}px;height:${(2 * Math.max(3, r(v))).toFixed(1)}px"></i><b class="num">${nf(v)}</b></span>`).join('')}</div><ul class="lg">${BUS_ORDER.map(l => `<li><i class="sw dot" style="background:${BUS_LV[l]};border:1px solid #8A8F96"></i><span>${t('bl.' + l)}</span></li>`).join('')}</ul><p class="lyr-src">${t('ly3.busNote')}</p>`;
      },
      src: () => t('ly3.busSrc'),
      popup: { layers: () => [lid('bussvc')], html: (p) => `<b dir="auto">${esc(p.stop_name)}</b> <small dir="ltr">(${esc(p.stop_code)})</small>${kv([[t('ly3.date'), `<span dir="ltr">${t('ly3.busDate')}</span>`], [t('ly3.tripsDay'), `<span class="num">${nf(p.trips_day)}</span>`], [t('ly3.trips79'), `<span class="num">${nf(p.trips_7_9)}</span>`], [t('ly3.routes'), `<span dir="ltr">${esc(p.routes || '—')}</span> <small>(${nf(p.routes_count)})</small>`], [t('ly3.level'), t('bl.' + p.service_level)]])}<small>${t(p.trips_day ? 'ly3.busPopNote' : 'ly3.busZeroNote')}</small>` },
    });

    // ---------- Trees: Copernicus tree-cover density (citywide) + OSM mapped trees (zoomed in) ----------
    defs.push({ id: 'canopy', group: 'env', title: () => t('ly3.canopy'), def: { on: false, opacity: 0.8 },
      build() { raster('canopy', RC.tiles('canopy', `${X.SVC.tcdRest}/exportImage?f=image&format=tiff&pixelType=U8&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_NearestNeighbor&bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256`), 0.8, '© EEA / Copernicus Land Monitoring Service'); },
      layers: () => [lid('canopy')], opacityProp: { [lid('canopy')]: 'raster-opacity' },
      legend: () => `${rcLegend('canopy')}<p class="lyr-src">${t('ly3.canopyNote')} ${t('rc.classified')}</p>`,
      src: () => 'Copernicus HRL Tree Cover Density 2018 · 10 m · EEA (free, full and open)' });
    defs.push({ id: 'trees', group: 'env', title: () => t('ly3.trees'), def: { on: false, opacity: 1 },
      build() {
        addSrc(lid('trees'), { type: 'geojson', data: fc() });
        addLyr({ id: lid('trees', 'row'), type: 'line', source: lid('trees'), filter: ['==', ['get', 'kind'], 'tree_row'], paint: { 'line-color': '#3F6E3C', 'line-width': 3, 'line-dasharray': [0.6, 1.4], 'line-opacity': 1 } });
        addLyr({ id: lid('trees'), type: 'circle', source: lid('trees'), filter: ['==', ['get', 'kind'], 'tree'], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 15, 2.4, 19, 6], 'circle-color': '#3F6E3C', 'circle-stroke-color': '#FFF', 'circle-stroke-width': 0.8, 'circle-opacity': 1 } });
      },
      async load() { const r = await X.trees([-180, -90, 180, 90]); map.getSource(lid('trees')).setData(fc(X.treeFeatures(r))); this._ts = r.ts; return r.pts.length; },
      layers: () => [lid('trees', 'row'), lid('trees')], opacityProp: { [lid('trees')]: 'circle-opacity', [lid('trees', 'row')]: 'line-opacity' },
      legend() { return `<ul class="lg">${swd('#3F6E3C', t('ly3.treePt'))}${swl('#3F6E3C', 3, t('ly3.treeRow'), true)}</ul><p class="lyr-src">${t('ly3.treesNote')}</p>`; },
      src: () => `OpenStreetMap natural=tree / tree_row · ${t('ly3.snapshot')} 2026-10-31 · ODbL`,
      popup: { layers: () => [lid('trees'), lid('trees', 'row')], html: (p) => `<b>${t(p.kind === 'tree_row' ? 'ly3.treeRow' : 'ly3.treePt')}</b>${kv([[t('ly3.species'), p.species ? `<i dir="ltr">${esc(p.species)}</i>` : (p.genus ? `<i dir="ltr">${esc(p.genus)}</i>` : `<em>${t('nodata')}</em>`)], [t('ly3.leaf'), p.leaf_type ? esc(p.leaf_type) + (p.leaf_cycle ? ' · ' + esc(p.leaf_cycle) : '') : null], [t('ly3.height'), p.height ? esc(p.height) + ' m' : `<em>${t('nodata')}</em>`], [t('ly3.crown'), p.crown ? esc(p.crown) + ' m' : `<em>${t('nodata')}</em>`]])}<small dir="ltr">OSM ${esc(p.id)}</small>` },
    });

    // ---------- Flood zones (SNCZI) ----------
    defs.push({ id: 'flood', group: 'env', title: () => t('ly3.flood'), def: { on: false, opacity: 0.7, opts: { periods: ['q10', 'q100', 'q500'], arpsi: true } },
      build() { X.FLOOD.slice().reverse().forEach(z => raster('flood-' + z.k, RC.tiles('flood', X.wmsTiles(X.SVC.miteco, z.layer)), 0.7, 'MITECO · SNCZI')); raster('flood-arpsi', RC.tiles('flood', X.wmsTiles(X.SVC.miteco, 'agua:Zi_arpsi')), 1, 'MITECO · SNCZI'); },
      layers: () => X.FLOOD.map(z => lid('flood-' + z.k)).concat([lid('flood-arpsi')]),
      visLayers() { const o = S.flood.opts; return X.FLOOD.filter(z => o.periods.includes(z.k)).map(z => lid('flood-' + z.k)).concat(o.arpsi ? [lid('flood-arpsi')] : []); },
      applyOpacity(o) { X.FLOOD.forEach(z => map.getLayer(lid('flood-' + z.k)) && map.setPaintProperty(lid('flood-' + z.k), 'raster-opacity', o)); },
      controls() { const o = S.flood.opts; return `<div class="ctl-grid">${X.FLOOD.map(z => `<label class="chk"><input type="checkbox" data-ly-ctl="flood" data-k="p:${z.k}" ${o.periods.includes(z.k) ? 'checked' : ''}>T = ${z.T} <small>(${z.p} ${t('ly3.perYear')})</small></label>`).join('')}<label class="chk"><input type="checkbox" data-ly-ctl="flood" data-k="arpsi" ${o.arpsi ? 'checked' : ''}>${t('ly3.arpsi')}</label></div>`; },
      onControl(el) { const o = S.flood.opts; const k = el.dataset.k; if (k === 'arpsi') o.arpsi = el.checked; else { const p = k.slice(2); o.periods = el.checked ? o.periods.concat([p]) : o.periods.filter(x => x !== p); } H.applyVis(this); },
      legend() { const o = S.flood.opts; return `${rcLegend('flood', { periods: o.periods, arpsi: o.arpsi })}<p class="lyr-src">${t('ly3.floodNote')} ${t('rc.classified')}</p>`; },
      src: () => 'MITECO · SNCZI (Sistema Nacional de Cartografía de Zonas Inundables) · WMS/WFS',
      async infoAt(ll) { const o = S.flood.opts; const hits = []; for (const z of X.FLOOD.filter(z => o.periods.includes(z.k))) { const fs = await X.floodWFS(z.layer, [ll[0] - 0.0004, ll[1] - 0.0004, ll[0] + 0.0004, ll[1] + 0.0004]); const f = fs.find(f => { const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; return polys.some(pl => root.GA.geo.pointInRing(ll, pl[0])); }); if (f) hits.push(`T = ${z.T}: <bdi>${esc(f.properties.zona || '')}</bdi> <small>(${esc(f.properties.rio || '')})</small>`); } return hits.length ? hits.join('<br>') + `<br><small>${t('ly3.floodPop')}</small>` : null; },
    });

    // ---------- Strategic noise (SICA) ----------
    defs.push({ id: 'noise', group: 'env', title: () => t('ly3.noise'), def: { on: false, opacity: 0.85, opts: { ind: 'lden' } },
      build() { ['lden', 'ln'].forEach(k => raster('noise-' + k, RC.tiles('noise', X.wmsTiles(X.SVC.noise, 'evaluacionambiental:mer_aglomeracion_' + k)), 0.85, 'MITECO · SICA')); },
      layers: () => ['lden', 'ln'].map(k => lid('noise-' + k)), visLayers: () => [lid('noise-' + S.noise.opts.ind)],
      applyOpacity(o) { ['lden', 'ln'].forEach(k => map.getLayer(lid('noise-' + k)) && map.setPaintProperty(lid('noise-' + k), 'raster-opacity', o)); },
      controls() { const o = S.noise.opts; return `<label class="row2">${t('ly3.noiseInd')} <select data-ly-ctl="noise" data-k="ind"><option value="lden" ${o.ind === 'lden' ? 'selected' : ''}>Lden — ${t('ly3.lden')}</option><option value="ln" ${o.ind === 'ln' ? 'selected' : ''}>Ln — ${t('ly3.ln')}</option></select></label>`; },
      onControl(el) { S.noise.opts.ind = el.value; H.applyVis(this); },
      legend() { const k = S.noise.opts.ind; return `${rcLegend('noise', { ind: k })}<p class="lyr-src">${t('rc.classified')} ${t(k === 'lden' ? 'ly3.ldenNote' : 'ly3.lnNote')} ${t('ly3.noiseNote')}</p>`; },
      src: () => 'MITECO · SICA — strategic noise maps, Granada agglomeration (3rd phase in this service)' });

    // ---------- Land-surface temperature (MODIS 8-day, 1 km) ----------
    defs.push({ id: 'lst', group: 'env', title: () => t('ly3.lst'), def: { on: false, opacity: 0.65 },
      build() { raster('lst', RC.tiles('lst', X.wmsTiles(X.SVC.gibs, 'MODIS_Aqua_L3_Land_Surface_Temp_8Day_Day', '&TIME=' + X.LST_DATE)), 0.65, 'NASA GIBS · MODIS'); RC.lstReady.then(() => H.emit()); },
      layers: () => [lid('lst')], opacityProp: { [lid('lst')]: 'raster-opacity' },
      legend: () => RC.state.lst === 'fallback' ? `${legImg('https://gibs.earthdata.nasa.gov/legends/MODIS_Land_Surface_Temp_H.png', 'LST legend')}<p class="lyr-src">${t('rc.lstFallback')} ${t('ly3.lstNote', { d: X.LST_DATE })}</p>` : `${rcLegend('lst')}<p class="lyr-src">${t('ly3.lstNote', { d: X.LST_DATE })} ${t('rc.lstMethod')}</p>`,
      src: () => 'NASA GIBS · MODIS Aqua L3 LST 8-day (MYD11A2) · 1 km · measured land-surface temperature' });

    // ---------- Historical maps and orthophotos (IGN) ----------
    defs.push({ id: 'history', group: 'hist', title: () => t('ly3.history'), def: { on: false, opacity: 0.85, opts: { h: 'ams56' } },
      build() { X.HIST.forEach(h => raster('hist-' + h.id, `${h.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${h.layer}&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=${encodeURIComponent(h.fmt)}`, 0.85, '© IGN / CNIG')); },
      layers: () => X.HIST.map(h => lid('hist-' + h.id)), visLayers: () => [lid('hist-' + S.history.opts.h)],
      applyOpacity(o) { X.HIST.forEach(h => map.getLayer(lid('hist-' + h.id)) && map.setPaintProperty(lid('hist-' + h.id), 'raster-opacity', o)); },
      controls() { const o = S.history.opts; return `<label class="row2">${t('ly3.period')} <select data-ly-ctl="history" data-k="h">${X.HIST.map(h => `<option value="${h.id}" ${o.h === h.id ? 'selected' : ''}>${h.period} · ${t('hist.' + h.id)}</option>`).join('')}</select></label><p class="fine">${t('ly3.histHint')}</p>`; },
      onControl(el) { S.history.opts.h = el.value; H.applyVis(this); },
      legend() { const h = X.HIST.find(x => x.id === S.history.opts.h); return `<p class="lyr-src">${t('hist.' + h.id)} · ${h.period} · ${t(h.kind === 'photo' ? 'ly3.histPhoto' : 'ly3.histMap')}</p>`; },
      src: () => 'IGN / CNIG — WMS PNOA histórico, Primera edición MTN, Minutas cartográficas (CC BY 4.0)',
      async infoAt(ll) { const h = X.HIST.find(x => x.id === S.history.opts.h); const r = await X.histInfo(h, ll); return `${r.name ? `<bdi>${esc(r.name)}</bdi> · ` : ''}${r.sheet ? t('ly3.sheet') + ' ' + esc(r.sheet) + ' · ' : ''}${r.year ? `<b class="num">${esc(r.year)}</b>` : ''}${r.flights && r.flights.length ? t('ly3.flights') + ' <span class="num">' + r.flights.join(', ') + '</span>' : ''}${r.editions ? `<br><small>${t('ly3.editions')} <span class="num">${r.editions.join(', ')}</span></small>` : ''}<br><small>${t(h.kind === 'photo' ? 'ly3.histPhotoNote' : 'ly3.histMapNote')}</small>`; },
    });
    return defs;
  });
})(window);
