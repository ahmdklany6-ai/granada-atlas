/* Build 5.9 layers: water and runoff (terrain-derived flow paths, mapped drains/ditches, culverted watercourses),
   infrastructure (railways, metro/light rail, stations; utility networks stated as a gap), and climate (seasonal wind rose
   and rainfall from a reanalysis grid cell). Every layer names its source, date, method and limits; nothing is invented:
   a missing dataset is shown as missing, a single model grid cell is drawn as a grid cell, not as a street-level field. */
(function (root) {
  const P = root.GA.palette;
  // ---------- climate statistics (pure functions, also used by the tests) ----------
  const SEASONS = { djf: [12, 1, 2], mam: [3, 4, 5], jja: [6, 7, 8], son: [9, 10, 11] };
  const DIR16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const BINS = [0.5, 2, 4, 6]; // m/s: calm < 0.5; 0.5–2, 2–4, 4–6, ≥ 6
  function windStats(h) { // h = Open-Meteo hourly { time[], wind_speed_10m[], wind_direction_10m[] }
    const out = {};
    Object.entries(SEASONS).forEach(([k, months]) => {
      const rose = DIR16.map(() => [0, 0, 0, 0]); let n = 0, calm = 0, sum = 0, u = 0, v = 0;
      for (let i = 0; i < h.time.length; i++) { const m = +h.time[i].slice(5, 7); if (!months.includes(m)) continue; const s = h.wind_speed_10m[i], d = h.wind_direction_10m[i]; if (s == null || d == null) continue;
        n++; sum += s; if (s < BINS[0]) { calm++; continue; } const sec = Math.round(((d % 360) + 360) % 360 / 22.5) % 16; const b = s < BINS[1] ? 0 : s < BINS[2] ? 1 : s < BINS[3] ? 2 : 3; rose[sec][b]++;
        u += s * Math.sin(d * Math.PI / 180); v += s * Math.cos(d * Math.PI / 180); }
      const pct = rose.map(r => r.map(c => n ? c / n * 100 : 0)); const tot = pct.map(r => r.reduce((a, b) => a + b, 0)); const top = tot.indexOf(Math.max(...tot));
      out[k] = { n, calmPct: n ? calm / n * 100 : 0, meanSpeed: n ? sum / n : null, rose: pct, prevailing: DIR16[top], prevailingPct: tot[top], prevailingDeg: top * 22.5, resultantDeg: ((Math.atan2(u, v) * 180 / Math.PI) + 360) % 360 };
    });
    return out;
  }
  function rainStats(d) { // d = Open-Meteo daily { time[], precipitation_sum[] }
    const byYM = {}; const years = new Set();
    for (let i = 0; i < d.time.length; i++) { const p = d.precipitation_sum[i]; if (p == null) continue; const y = d.time[i].slice(0, 4), m = +d.time[i].slice(5, 7); years.add(y); const k = y + '-' + m; const r = byYM[k] || (byYM[k] = { mm: 0, wet: 0 }); r.mm += p; if (p >= 1) r.wet++; }
    const Y = [...years]; const month = Array.from({ length: 12 }, (_, i) => { const rs = Y.map(y => byYM[y + '-' + (i + 1)]).filter(Boolean); return { mm: rs.reduce((a, r) => a + r.mm, 0) / (rs.length || 1), wetDays: rs.reduce((a, r) => a + r.wet, 0) / (rs.length || 1) }; });
    const season = Object.fromEntries(Object.entries(SEASONS).map(([k, ms]) => [k, ms.reduce((a, m) => a + month[m - 1].mm, 0)]));
    return { years: Y.length, from: Y[0], to: Y[Y.length - 1], month, season, annual: month.reduce((a, m) => a + m.mm, 0) };
  }
  // ---------- live data (Open-Meteo historical archive, ERA5 reanalysis) ----------
  const LAT = 37.1773, LON = -3.5986; const API = 'https://archive-api.open-meteo.com/v1/archive';
  const WIND_URL = `${API}?latitude=${LAT}&longitude=${LON}&start_date=2015-01-01&end_date=2024-12-31&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC&models=era5`;
  const RAIN_URL = `${API}?latitude=${LAT}&longitude=${LON}&start_date=1991-01-01&end_date=2020-12-31&daily=precipitation_sum&timezone=Europe%2FMadrid&models=era5`;
  const cache = {};
  const getJSON = (url) => cache[url] || (cache[url] = fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).catch(e => { delete cache[url]; throw e; }));
  const cellRing = (lat, lon, half) => [[lon - half, lat - half], [lon + half, lat - half], [lon + half, lat + half], [lon - half, lat + half], [lon - half, lat - half]];
  root.GA.climate = { windStats, rainStats, SEASONS, DIR16, BINS, WIND_URL, RAIN_URL, getJSON };

  // wind rose as a canvas image (also used in the legend as a PNG data URL)
  function roseCanvas(st, size, labels) {
    const c = document.createElement('canvas'); const r2 = 2; c.width = c.height = size * r2; const g = c.getContext('2d'); g.scale(r2, r2);
    const cx = size / 2, cy = size / 2, R = size / 2 - 22; const maxTot = Math.max(5, ...st.rose.map(r => r.reduce((a, b) => a + b, 0))); const ring = maxTot > 20 ? 10 : 5; const scale = R / (Math.ceil(maxTot / ring) * ring);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(cx, cy, R + 18, 0, Math.PI * 2); g.fill();
    g.strokeStyle = P.line2; g.lineWidth = 0.8; for (let p = ring; p * scale <= R + 0.1; p += ring) { g.beginPath(); g.arc(cx, cy, p * scale, 0, Math.PI * 2); g.stroke(); }
    g.font = `600 10px ${labels.font}`; g.fillStyle = P.ink2; g.textAlign = 'center'; g.textBaseline = 'middle'; ['N', 'E', 'S', 'W'].forEach((k, i) => { const a = i * Math.PI / 2; g.fillText(k, cx + Math.sin(a) * (R + 10), cy - Math.cos(a) * (R + 10)); });
    st.rose.forEach((bins, s) => { const a0 = (s * 22.5 - 9) * Math.PI / 180, a1 = (s * 22.5 + 9) * Math.PI / 180; let r0 = 0;
      bins.forEach((pc, b) => { if (!pc) return; const r1 = r0 + pc * scale; g.beginPath(); g.arc(cx, cy, r1, a0 - Math.PI / 2, a1 - Math.PI / 2); g.arc(cx, cy, r0, a1 - Math.PI / 2, a0 - Math.PI / 2, true); g.closePath(); g.fillStyle = P.wind[b]; g.fill(); g.strokeStyle = '#FFFFFF'; g.lineWidth = 0.5; g.stroke(); r0 = r1; }); });
    // prevailing direction: the wind blows FROM this sector — arrow drawn from outside towards the centre (downwind)
    const a = st.prevailingDeg * Math.PI / 180, x0 = cx + Math.sin(a) * (R + 16), y0 = cy - Math.cos(a) * (R + 16), x1 = cx + Math.sin(a) * (R * 0.35), y1 = cy - Math.cos(a) * (R * 0.35);
    g.strokeStyle = P.ink; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); const ah = Math.atan2(y1 - y0, x1 - x0); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 9 * Math.cos(ah - 0.45), y1 - 9 * Math.sin(ah - 0.45)); g.lineTo(x1 - 9 * Math.cos(ah + 0.45), y1 - 9 * Math.sin(ah + 0.45)); g.closePath(); g.fillStyle = P.ink; g.fill();
    g.fillStyle = P.ink3; g.font = `9px ${labels.font}`; g.fillText(ring + '%', cx + 3, cy - ring * scale - 6);
    return c;
  }

  root.GA.layersExtra = root.GA.layersExtra || [];
  root.GA.layersExtra.push(function (H) {
    const { map, S, addSrc, addLyr, lid, fc, t, esc, nf, sw, swl, swd } = H; const D = root.GA.data; const defs = [];
    const font = () => getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif';

    // ================= WATER AND RUNOFF =================
    defs.push({ id: 'flow_paths', group: 'water', title: () => t('v9.lyFlow'), def: { on: false, opacity: 0.9 },
      // larger classes first; smaller upslope areas appear as one zooms in (10–50 ha from z13.5, 50–250 ha from z12)
      build() { addSrc(lid('flow'), { type: 'geojson', data: fc() });
        [[0, 13.5], [1, 12], [2, 0], [3, 0]].forEach(([c, mz]) => addLyr({ id: lid('flow', 'c' + c), type: 'line', source: lid('flow'), minzoom: mz, filter: ['==', ['get', 'c'], c], layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': P.flow[c], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, [0.6, 1, 1.6, 2.4][c], 16, [1.1, 1.8, 2.8, 4][c]], 'line-opacity': 0.9 } })); },
      async load() { if (this._loaded) return this._loaded; const j = await D.single('flow_paths'); map.getSource(lid('flow')).setData(j); this._loaded = j.features.length; return j.features.length; },
      layers: () => [0, 1, 2, 3].map(c => lid('flow', 'c' + c)), opacityProp: Object.fromEntries([0, 1, 2, 3].map(c => [lid('flow', 'c' + c), 'line-opacity'])),
      legend: () => `<ul class="lg">${['10–50', '50–250', '250–1,000', '≥ 1,000'].map((l, i) => swl(P.flow[i], [0.8, 1.3, 2, 2.8][i], `${l} ha ${t('v9.upslope')}`)).join('')}</ul><p class="lyr-src"><b>${t('v9.approx')}</b> ${t('v9.flowNote')}</p>`,
      src: () => 'IGN MDT25 25 m (CC BY 4.0) · priority-flood + D8 · tools/build_flow.js' });
    defs.push({ id: 'drains', group: 'water', title: () => t('v9.lyDrains'), def: { on: false, opacity: 1 },
      build() { addSrc(lid('drains'), { type: 'geojson', data: fc() });
        addLyr({ id: lid('drains'), type: 'line', source: lid('drains'), minzoom: 11, paint: { 'line-color': ['match', ['get', 'ww'], 'canal', P.blue, 'drain', P.base.blueGrey, P.drain], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, ['match', ['get', 'ww'], 'canal', 2.2, 1.4]], 'line-dasharray': [2, 1.5], 'line-opacity': 1 } }); },
      async load() { if (this._loaded) return this._loaded; const j = await D.single('water'); const f = j.features.filter(x => /^(drain|ditch|canal)$/.test(x.properties.ww || '')); map.getSource(lid('drains')).setData(fc(f)); this._loaded = f.length; return f.length; },
      layers: () => [lid('drains')], opacityProp: { [lid('drains')]: 'line-opacity' },
      legend: () => `<ul class="lg">${swl(P.blue, 2, 'waterway=canal', true)}${swl(P.base.blueGrey, 1.4, 'waterway=drain', true)}${swl(P.drain, 1.4, 'waterway=ditch (acequias)', true)}</ul><p class="lyr-src">${t('v9.drainNote')}</p>`,
      src: () => 'OpenStreetMap waterway=drain / ditch / canal (supplied extract 2026-10-23) · ODbL' });
    defs.push({ id: 'culverts', group: 'water', title: () => t('v9.lyCulvert'), def: { on: false, opacity: 1 },
      // culverted / covered watercourses as mapped in OSM (tunnel=culvert …), read from the basemap's OSM vector tiles
      build() { addLyr({ id: lid('culvert'), type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'brunnel'], 'tunnel'], paint: { 'line-color': P.blueDark, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 16, 3], 'line-dasharray': [2, 1.6], 'line-opacity': 1 } });
        addLyr({ id: lid('culvert', 'lbl'), type: 'symbol', source: 'omt', 'source-layer': 'waterway', minzoom: 13, filter: ['all', ['==', ['get', 'brunnel'], 'tunnel'], ['has', 'name']], layout: { 'symbol-placement': 'line', 'text-field': ['concat', ['coalesce', ['get', 'name:es'], ['get', 'name']], ' — ', t('v9.covered')], 'text-font': ['Noto Sans Italic'], 'text-size': 11 }, paint: { 'text-color': P.blueDark, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 } }); },
      async load() { return 'ok'; },
      layers: () => [lid('culvert'), lid('culvert', 'lbl')], opacityProp: { [lid('culvert')]: 'line-opacity' },
      legend: () => `<ul class="lg">${swl(P.blueDark, 2.4, t('v9.lgCulvert'), true)}</ul><p class="lyr-src">${t('v9.culvertNote')}</p>`,
      src: () => 'OpenStreetMap (tunnel=culvert / covered waterways) via OpenMapTiles · OpenFreeMap · ODbL' });

    // ================= INFRASTRUCTURE =================
    defs.push({ id: 'rail', group: 'infra', title: () => t('v9.lyRail'), def: { on: false, opacity: 1 },
      build() { const tunnel = ['==', ['get', 'brunnel'], 'tunnel'];
        addLyr({ id: lid('rail'), type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': P.ink, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 16, 2.6], 'line-opacity': ['case', tunnel, 0.45, 1] } });
        addLyr({ id: lid('rail', 'tie'), type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'], minzoom: 13, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 16, 1.4], 'line-dasharray': [2, 3], 'line-opacity': 1 } });
        addLyr({ id: lid('metro'), type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['all', ['==', ['get', 'class'], 'transit'], ['!', tunnel]], layout: { 'line-cap': 'round' }, paint: { 'line-color': P.red, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 16, 3.6], 'line-opacity': 1 } });
        addLyr({ id: lid('metro', 'tun'), type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['all', ['==', ['get', 'class'], 'transit'], tunnel], paint: { 'line-color': P.red, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 16, 3.6], 'line-dasharray': [1.5, 1], 'line-opacity': 1 } }); },
      async load() { return 'ok'; },
      layers: () => [lid('rail'), lid('rail', 'tie'), lid('metro'), lid('metro', 'tun')], opacityProp: { [lid('rail')]: 'line-opacity', [lid('metro')]: 'line-opacity', [lid('metro', 'tun')]: 'line-opacity' },
      legend: () => `<ul class="lg">${swl(P.ink, 2.4, t('v9.lgRail'))}${swl(P.red, 3, t('v9.lgMetro'))}${swl(P.red, 3, t('v9.lgMetroTunnel'), true)}</ul><p class="lyr-src">${t('v9.railNote')}</p>`,
      src: () => 'OpenStreetMap railway=rail / light_rail / subway via OpenMapTiles · OpenFreeMap · ODbL' });
    defs.push({ id: 'stations', group: 'infra', title: () => t('v9.lyStations'), def: { on: false, opacity: 1 },
      build() { addLyr({ id: lid('stations'), type: 'circle', source: 'omt', 'source-layer': 'poi', minzoom: 11, filter: ['==', ['get', 'class'], 'railway'], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 16, 5.5], 'circle-color': ['match', ['get', 'subclass'], ['station', 'halt'], P.ink, '#FFFFFF'], 'circle-stroke-color': ['match', ['get', 'subclass'], ['station', 'halt'], '#FFFFFF', P.red], 'circle-stroke-width': 1.6, 'circle-opacity': 1 } });
        addLyr({ id: lid('stations', 'lbl'), type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 14, filter: ['==', ['get', 'class'], 'railway'], layout: { 'text-field': ['coalesce', ['get', 'name:es'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 10.5, 'text-offset': [0, 1.1], 'text-anchor': 'top' }, paint: { 'text-color': P.ink2, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4 } }); },
      async load() { return 'ok'; },
      layers: () => [lid('stations'), lid('stations', 'lbl')], opacityProp: { [lid('stations')]: 'circle-opacity' },
      legend: () => `<ul class="lg"><li><i class="sw dot" style="background:${P.ink};border:1.5px solid #fff;box-shadow:0 0 0 1px ${P.ink}"></i><span>${t('v9.lgStation')}</span></li><li><i class="sw dot" style="background:#fff;border:2px solid ${P.red}"></i><span>${t('v9.lgStop')}</span></li></ul><p class="lyr-src">${t('v9.stationNote')}</p>`,
      src: () => 'OpenStreetMap railway=station / halt / tram_stop via OpenMapTiles · ODbL' });
    defs.push({ id: 'utilities', group: 'infra', title: () => t('v9.lyUtil'), def: { on: false, opacity: 1 },
      build() { }, async load() { return 0; }, layers: () => [],
      legend: () => `<p class="lyr-src"><b>${t('v9.notConnected')}</b> ${t('v9.utilNote')}</p>`, src: () => t('v9.utilSrc') });

    // ================= CLIMATE: seasonal wind and rainfall (one reanalysis grid cell) =================
    const cellLayers = (id) => { addSrc(lid(id, 'cell'), { type: 'geojson', data: fc() }); addLyr({ id: lid(id, 'cell'), type: 'line', source: lid(id, 'cell'), paint: { 'line-color': P.ink2, 'line-width': 1.2, 'line-dasharray': [4, 3], 'line-opacity': 1 } }); };
    const setCell = (id, j) => { const f = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: cellRing(j.latitude, j.longitude, 0.125) } }; map.getSource(lid(id, 'cell')).setData(fc([f])); };
    const seasonSel = (id) => `<label class="row2">${t('v9.season')} <select data-ly-ctl="${id}" data-k="season">${Object.keys(SEASONS).map(k => `<option value="${k}" ${S[id].opts.season === k ? 'selected' : ''}>${t('v9.s.' + k)}</option>`).join('')}</select></label>`;
    defs.push({ id: 'wind', group: 'climate', title: () => t('v9.lyWind'), def: { on: false, opacity: 1, opts: { season: 'djf' } },
      build() { if (!map.hasImage('ga-wind-rose')) map.addImage('ga-wind-rose', { width: 1, height: 1, data: new Uint8Array(4) }); cellLayers('wind'); addSrc(lid('wind'), { type: 'geojson', data: fc([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [LON, LAT] } }]) });
        addLyr({ id: lid('wind'), type: 'symbol', source: lid('wind'), layout: { 'icon-image': 'ga-wind-rose', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': 1 }, paint: { 'icon-opacity': 1 } }); },
      async load() { const j = await getJSON(WIND_URL); this._j = j; this._st = windStats(j.hourly); setCell('wind', j); this.draw(); return this._st[S.wind.opts.season].n; },
      draw() { if (!this._st) return; const c = roseCanvas(this._st[S.wind.opts.season], 200, { font: font() }); const img = c.getContext('2d').getImageData(0, 0, c.width, c.height); const data = { width: c.width, height: c.height, data: img.data };
        if (map.hasImage('ga-wind-rose')) map.removeImage('ga-wind-rose'); map.addImage('ga-wind-rose', data, { pixelRatio: 2 }); map.triggerRepaint(); this._url = c.toDataURL('image/png'); }, // replaced (sizes differ from the placeholder)
      layers: () => [lid('wind', 'cell'), lid('wind')], opacityProp: { [lid('wind')]: 'icon-opacity' },
      controls() { return seasonSel('wind'); },
      onControl(el) { S.wind.opts.season = el.value; H.persist(); this.draw(); H.emit(); },
      legend() { const s = this._st && this._st[S.wind.opts.season]; if (!s) return `<p class="lyr-src">${t('v9.windNote')}</p>`;
        return `<h4>${t('v9.s.' + S.wind.opts.season)}</h4><img class="lg-rose" src="${this._url}" width="160" height="160" alt="${esc(t('v9.lyWind'))}">
          <ul class="lg">${['0.5–2', '2–4', '4–6', '≥ 6'].map((l, i) => sw(P.wind[i], `<span class="num">${l} m/s</span>`)).join('')}</ul>
          <p class="lyr-src">${t('v9.windStats', { dir: s.prevailing, p: nf(s.prevailingPct, 0), v: nf(s.meanSpeed, 1), c: nf(s.calmPct, 0), n: nf(s.n) })}</p>
          <p class="lyr-src">${t('v9.windNote')} ${t('v9.cellNote', { lat: (this._j.latitude).toFixed(2), lon: (this._j.longitude).toFixed(2) })}</p>`; },
      src: () => 'ERA5 reanalysis (ECMWF / Copernicus C3S) via Open-Meteo Historical Weather API · CC BY 4.0 · hourly 2015–2024, 10 m' });
    defs.push({ id: 'rain', group: 'climate', title: () => t('v9.lyRain'), def: { on: false, opacity: 1, opts: { season: 'djf' } },
      build() { cellLayers('rain'); },
      async load() { const j = await getJSON(RAIN_URL); this._j = j; this._st = rainStats(j.daily); setCell('rain', j); return this._st.years; },
      layers: () => [lid('rain', 'cell')], opacityProp: { [lid('rain', 'cell')]: 'line-opacity' },
      controls() { return seasonSel('rain'); },
      onControl(el) { S.rain.opts.season = el.value; H.persist(); H.emit(); },
      legend() { const st = this._st; if (!st) return `<p class="lyr-src">${t('v9.rainNote')}</p>`; const ms = SEASONS[S.rain.opts.season]; const mx = Math.max(...st.month.map(m => m.mm)); const W = 228, Hh = 92, bw = W / 12;
        const bars = st.month.map((m, i) => { const h = m.mm / mx * (Hh - 18); const on = ms.includes(i + 1); return `<rect x="${(i * bw + 2).toFixed(1)}" y="${(Hh - 14 - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" fill="${on ? P.blue : P.base.lightBlue}"/><text x="${(i * bw + bw / 2).toFixed(1)}" y="${Hh - 3}" font-size="9" text-anchor="middle" fill="${P.ink3}">${i + 1}</text>`; }).join('');
        return `<h4>${t('v9.rainMonthly')}</h4><svg class="lg-chart" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="${esc(t('v9.rainMonthly'))}">${bars}</svg>
          <p class="lyr-src">${t('v9.rainStats', { s: t('v9.s.' + S.rain.opts.season), mm: nf(st.season[S.rain.opts.season], 0), a: nf(st.annual, 0), y0: st.from, y1: st.to })}</p>
          <p class="lyr-src">${t('v9.rainNote')} ${t('v9.cellNote', { lat: (this._j.latitude).toFixed(2), lon: (this._j.longitude).toFixed(2) })}</p>`; },
      src: () => 'ERA5 reanalysis (ECMWF / Copernicus C3S) via Open-Meteo Historical Weather API · CC BY 4.0 · daily 1991–2020' });
    return defs;
  });
})(window);
