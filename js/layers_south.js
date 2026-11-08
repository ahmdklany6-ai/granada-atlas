/* Build 5.20 — "Essentials: southern axis" layers, on by default:
   1. the southern extension of metro line 1 as mapped in OSM while under construction (one track; stations not mapped yet);
   2. the Granada–Gabia branch of the old electric tram, traced from the IGN 1:50,000 map of 1931 (approximate, ±100 m);
   3. the CITAI estate at Escúzar with IFMIF-DONES, Lidl, Amazon and Knauf, the village, and the straight-line gap from the
      new metro terminus to the accelerator.
   Data: data/vec/south_metro.json, tram_1931.json, escuzar_pole.json (tools/build_south_axis.py). Colours: palette.south. */
(function (root) {
  const P = root.GA.palette, C = P.south;
  const AXIS_BB = [[-3.80, 37.06], [-3.59, 37.16]]; // metro terminus, tram and Escúzar together
  const KIND = { science: C.science, logistics: C.logistics, industry: C.industry };
  const bboxOf = (fc) => { let a = [180, 90, -180, -90]; const add = (c) => { if (typeof c[0] === 'number') { a = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])]; } else c.forEach(add); };
    fc.features.forEach(f => add(f.geometry.coordinates)); return [[a[0], a[1]], [a[2], a[3]]]; };
  root.GA.layersExtra = root.GA.layersExtra || [];
  root.GA.layersExtra.push(function (H) {
    const { map, addSrc, addLyr, lid, fc, t, esc, nf, sw, swl, swd } = H; const D = root.GA.data; const defs = [];
    const fitBtns = (id) => `<div class="row2"><button type="button" class="btn btn-tiny" data-ly-ctl="${id}" data-k="fit">${t('v18.fit')}</button> <button type="button" class="btn btn-tiny" data-ly-ctl="${id}" data-k="axis">${t('v18.fitAll')}</button></div>`;
    function onFit(d, el) { const k = el.dataset.k; const bb = k === 'axis' || !d._bb ? AXIS_BB : d._bb; map.fitBounds(bb, { padding: 60, duration: 1000, maxZoom: 15 }); return false; }
    const dotSw = (fill, stroke, l) => `<li><i class="sw dot" style="background:${fill};border:2px solid ${stroke}"></i><span>${l}</span></li>`;
    const sqSw = (stroke, l) => `<li><i class="sw" style="background:#fff;border:2.5px solid ${stroke};border-radius:0"></i><span>${l}</span></li>`;

    // ---------- 1. metro extension ----------
    defs.push({ id: 'south_metro', group: 'south', title: () => t('v18.lyMetro'), def: { on: true, opacity: 1 },
      build() { const s = lid('smetro'); addSrc(s, { type: 'geojson', data: fc() });
        addLyr({ id: lid('smetro', 'case'), type: 'line', source: s, filter: ['==', ['get', 'k'], 'track'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.metroCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 9], 'line-opacity': 1 } });
        addLyr({ id: lid('smetro'), type: 'line', source: s, filter: ['==', ['get', 'k'], 'track'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.metro, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.4, 16, 5.5], 'line-opacity': 1 } });
        addLyr({ id: lid('smetro', 'pt'), type: 'circle', source: s, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8], 'circle-color': ['match', ['get', 'k'], 'terminus', C.metro, '#FFFFFF'], 'circle-stroke-color': ['match', ['get', 'k'], 'terminus', '#FFFFFF', C.station], 'circle-stroke-width': 2.2, 'circle-opacity': 1, 'circle-stroke-opacity': 1 } });
        addLyr({ id: lid('smetro', 'lbl'), type: 'symbol', source: s, minzoom: 11, filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': ['get', 'nm'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top' }, paint: { 'text-color': C.metro, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.8 } }); },
      async load() { if (this._loaded) return this._loaded; const j = await D.single('south_metro'); map.getSource(lid('smetro')).setData(j); this._bb = bboxOf(j); const tr = j.features.find(f => f.properties.k === 'track'); this._len = tr && tr.properties.len_m; this._loaded = j.features.length; return this._loaded; },
      layers: () => [lid('smetro', 'case'), lid('smetro'), lid('smetro', 'pt'), lid('smetro', 'lbl')],
      opacityProp: { [lid('smetro')]: 'line-opacity', [lid('smetro', 'case')]: 'line-opacity', [lid('smetro', 'pt')]: 'circle-opacity' },
      controls() { return fitBtns('south_metro'); }, onControl(el) { return onFit(this, el); },
      legend() { return `<ul class="lg">${swl(C.metro, 4, t('v18.lgTrack', { km: this._len ? nf(this._len / 1000, 1) : '—' }))}${dotSw('#FFFFFF', C.station, t('v18.lgNow'))}${dotSw(C.metro, '#FFFFFF', t('v18.lgEnd'))}</ul><p class="lyr-src">${t('v18.metroNote')}</p>`; },
      src: () => 'OpenStreetMap (railway=construction, construction=light_rail, “Metro de Granada”) · ODbL · ' + ((D.manifest && D.manifest.layers.south_metro && D.manifest.layers.south_metro.date) || ''),
      popup: { layers: () => [lid('smetro'), lid('smetro', 'pt')], html: (p) => p.k === 'track' ? `<b>${esc(t('v18.lyMetro'))}</b><br><span class="num">${nf(p.len_m / 1000, 2)} km</span><br><small dir="ltr">OSM ways ${esc(p.osm)}</small>` : `<b dir="auto">${esc(p.nm)}</b><br>${esc(t(p.k === 'terminus' ? 'v18.lgEnd' : 'v18.lgNow'))}<br><small dir="ltr">${esc(p.osm)}</small>` } });

    // ---------- 2. tram 1931 ----------
    defs.push({ id: 'tram_1931', group: 'south', title: () => t('v18.lyTram'), def: { on: true, opacity: 1 },
      build() { const s = lid('tram'); addSrc(s, { type: 'geojson', data: fc() });
        addLyr({ id: lid('tram', 'trunk'), type: 'line', source: s, filter: ['==', ['get', 'k'], 'trunk'], layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': C.trunk, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 4], 'line-dasharray': [2, 1.5], 'line-opacity': 1 } });
        addLyr({ id: lid('tram'), type: 'line', source: s, filter: ['==', ['get', 'k'], 'gabia'], layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': C.tram, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.2, 16, 4.5], 'line-dasharray': [2, 1.5], 'line-opacity': 1 } });
        addLyr({ id: lid('tram', 'st'), type: 'circle', source: s, filter: ['==', ['get', 'k'], 'station'], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 16, 7], 'circle-color': '#FFFFFF', 'circle-stroke-color': C.tramStation, 'circle-stroke-width': 2.5, 'circle-opacity': 1, 'circle-stroke-opacity': 1 } });
        addLyr({ id: lid('tram', 'lbl'), type: 'symbol', source: s, minzoom: 12, filter: ['==', ['get', 'k'], 'station'], layout: { 'text-field': ['concat', ['get', 'lbl'], ' · ', ['get', 'nm'], ' (1931)'], 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top' }, paint: { 'text-color': C.tram, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 } }); },
      async load() { if (this._loaded) return this._loaded; const j = await D.single('tram_1931'); map.getSource(lid('tram')).setData(j); this._bb = bboxOf(j); this._loaded = j.features.length; return this._loaded; },
      layers: () => [lid('tram', 'trunk'), lid('tram'), lid('tram', 'st'), lid('tram', 'lbl')],
      opacityProp: { [lid('tram')]: 'line-opacity', [lid('tram', 'trunk')]: 'line-opacity', [lid('tram', 'st')]: 'circle-opacity' },
      controls() { return fitBtns('tram_1931'); }, onControl(el) { return onFit(this, el); },
      legend: () => `<ul class="lg">${swl(C.tram, 3.5, t('v18.lgTram'), true)}${swl(C.trunk, 3, t('v18.lgTrunk'), true)}${dotSw('#FFFFFF', C.tramStation, t('v18.lgTramSt'))}</ul><p class="lyr-src"><b>${t('v9.approx')}</b> ${t('v18.tramNote')}</p>`,
      src: () => '© IGN MTN50 1st ed. sheet 1026 Padul (1931) · CC BY 4.0 · traced in this repository (±100 m)',
      popup: { layers: () => [lid('tram'), lid('tram', 'st'), lid('tram', 'trunk')], html: (p) => p.k === 'station' ? `<b dir="auto">${esc(p.lbl)} · ${esc(p.nm)}</b><br>${esc(t('v18.lgTramSt'))}` : `<b>${esc(t(p.k === 'trunk' ? 'v18.lgTrunk' : 'v18.lgTram'))}</b>${p.len_m ? `<br><span class="num">≈ ${nf(p.len_m / 1000, 1)} km</span>` : ''}<br><small>${esc(t('v18.tramNote'))}</small>` } });

    // ---------- 3. Escúzar pole ----------
    defs.push({ id: 'escuzar_pole', group: 'south', title: () => t('v18.lyPole'), def: { on: true, opacity: 1 },
      build() { // separate sources (estate outline, site plots, village, gap line): kept apart so the large estate polygon never shares a tile index with the plots inside it
        const se = lid('pole', 'srcE'), ss = lid('pole', 'srcS'), sv = lid('pole', 'srcV'), sg = lid('pole', 'srcG'); [se, ss, sv, sg].forEach(x => addSrc(x, { type: 'geojson', data: fc() }));
        const kindCol = ['match', ['get', 'k'], 'science', KIND.science, 'logistics', KIND.logistics, 'industry', KIND.industry, C.estate];
        addLyr({ id: lid('pole', 'estate'), type: 'line', source: se, paint: { 'line-color': C.estate, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 16, 3], 'line-dasharray': [3, 2], 'line-opacity': 1 } });
        addLyr({ id: lid('pole', 'fill'), type: 'fill', source: ss, paint: { 'fill-color': kindCol, 'fill-opacity': 0.6 } });
        addLyr({ id: lid('pole', 'ln'), type: 'line', source: ss, paint: { 'line-color': kindCol, 'line-width': 2, 'line-opacity': 1 } });
        addLyr({ id: lid('pole', 'gap'), type: 'line', source: sg, filter: ['==', ['get', 'k'], 'gap'], paint: { 'line-color': C.gap, 'line-width': 1.6, 'line-dasharray': [3, 3], 'line-opacity': 1 } });
        addLyr({ id: lid('pole', 'vil'), type: 'circle', source: sv, filter: ['==', ['get', 'k'], 'village'], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 7], 'circle-color': C.village, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2, 'circle-opacity': 1 } });
        addLyr({ id: lid('pole', 'lbl'), type: 'symbol', source: ss, minzoom: 11.5, layout: { 'text-field': ['get', 'nm'], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5, 'text-max-width': 9, 'text-offset': [0, 1.1], 'text-anchor': 'top' }, paint: { 'text-color': P.ink, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.8 } });
        addLyr({ id: lid('pole', 'vlbl'), type: 'symbol', source: sv, minzoom: 10.5, filter: ['==', ['get', 'k'], 'village'], layout: { 'text-field': ['concat', ['get', 'nm'], ' · ', ['to-string', ['get', 'pop']]], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5, 'text-offset': [0, 1.1], 'text-anchor': 'top' }, paint: { 'text-color': P.ink, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.8 } }); },
      async load() { if (this._loaded) return this._loaded; const j = await D.single('escuzar_pole'); const by = (f) => j.features.filter(f); map.getSource(lid('pole', 'srcE')).setData(fc(by(x => x.properties.k === 'estate'))); map.getSource(lid('pole', 'srcS')).setData(fc(by(x => ['science', 'logistics', 'industry'].includes(x.properties.k)))); map.getSource(lid('pole', 'srcV')).setData(fc(by(x => x.properties.k === 'village'))); map.getSource(lid('pole', 'srcG')).setData(fc(by(x => x.properties.k === 'gap'))); this._bb = bboxOf({ features: j.features.filter(f => f.properties.k !== 'gap') }); this._j = j; this._loaded = j.features.length; return this._loaded; },
      layers: () => [lid('pole', 'estate'), lid('pole', 'fill'), lid('pole', 'ln'), lid('pole', 'gap'), lid('pole', 'vil'), lid('pole', 'lbl'), lid('pole', 'vlbl')],
      applyOpacity(o) { [['estate', 'line-opacity', 1], ['fill', 'fill-opacity', 0.6], ['ln', 'line-opacity', 1], ['gap', 'line-opacity', 1], ['vil', 'circle-opacity', 1]].forEach(([k, p, f]) => { const l = lid('pole', k); if (map.getLayer(l)) map.setPaintProperty(l, p, o * f); }); },
      controls() { return fitBtns('escuzar_pole'); }, onControl(el) { return onFit(this, el); },
      legend() { const fs = (this._j && this._j.features) || []; const g = (k) => fs.find(f => f.properties.k === k); const est = g('estate'), vil = g('village'), gap = g('gap');
        return `<ul class="lg"><li><i class="sw ln" style="border-top:2.5px dashed ${C.estate}"></i><span>${t('v18.lgEstate', { ha: est ? nf(est.properties.ha) : '—' })}</span></li>${sw(KIND.science, t('v18.lgScience'))}${sw(KIND.logistics, t('v18.lgLogistics'))}${sw(KIND.industry, t('v18.lgIndustry'))}${swd(C.village, t('v18.lgVillage', { n: vil ? nf(vil.properties.pop) : '—', y: vil ? vil.properties.pop_year : '' }))}${swl(C.gap, 1.6, t('v18.lgGap', { km: gap ? nf(gap.properties.km, 1) : '—' }), true)}</ul><p class="lyr-src">${t('v18.poleNote')}</p>`; },
      src: () => 'OpenStreetMap · ODbL · INE padrón 2025 · Lidl, Amazon, Knauf, Ministerio de Ciencia (announced figures)',
      popup: { layers: () => [lid('pole', 'fill'), lid('pole', 'vil'), lid('pole', 'estate')], html: (p) => {
        if (p.k === 'village') return `<b dir="auto">${esc(p.nm)}</b><br>${esc(t('v18.lgVillage', { n: nf(p.pop), y: p.pop_year }))}<br><small dir="ltr">INE · ${esc(p.osm)}</small>`;
        const row = (k, v) => `<tr><td>${t(k)}</td><td dir="ltr">${v ? esc(v) : `<em>${t('v18.notPub')}</em>`}</td></tr>`;
        return `<b dir="ltr">${esc(p.nm)}</b><table>${p.k !== 'estate' ? row('v18.opened', p.opened) + row('v18.jobs', p.jobs) + row('v18.inv', p.inv) : ''}<tr><td>${t('v18.area')}</td><td class="num">${nf(p.ha, 1)} ha</td></tr></table><small dir="ltr">OSM ${esc(p.osm)}</small>`; } } });
    return defs;
  });
})(window);
