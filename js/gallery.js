/* Visual analysis gallery: one card per topic for a study area. Every card is drawn from the
   area's actual data (mapcard.js), with a legend that states units and class limits, two or
   three indicators, an optional chart, short findings derived only from those indicators,
   and the method in a collapsed section. */
(function (root) {
  const { geo: G, analysis: A, palette: P, i18n: I, mapcard: MC, data: D } = root.GA;
  const t = (k, v) => I.t(k, v);
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d ? Math.min(1, d) : 0 });
  const pct = (x, d) => x == null || !isFinite(x) ? '—' : nf(x * 100, d == null ? 0 : d) + I.pctSign();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const iso = (s) => '⁦' + s + '⁩';
  const u = (v, unit) => `<span class="num">${v}</span> ${t('u.' + unit)}`;

  // ---------- classes (fixed, so different areas use identical breaks) ----------
  const FLOOR = [{ k: '1-2', max: 2 }, { k: '3-4', max: 4 }, { k: '5-8', max: 8 }, { k: '9+', max: Infinity }];
  const floorClass = (lv) => lv == null ? 'no_data' : FLOOR.find(c => lv <= c.max).k;
  const SLOPE = [{ k: '0-2', max: 2 }, { k: '2-5', max: 5 }, { k: '5-10', max: 10 }, { k: '10-15', max: 15 }, { k: '15-25', max: 25 }, { k: '25-35', max: 35 }, { k: '35+', max: 90 }];
  const SLOPE_COL = { '0-2': GA.palette.redSoft, '2-5': GA.palette.redSoft, '5-10': GA.palette.rose, '10-15': GA.palette.rose, '15-25': GA.palette.red, '25-35': GA.palette.redDark, '35+': GA.palette.redDark };
  const FAC = {
    health: { hospital: { c: P.red, s: 'square', r: 5 }, clinic: { c: P.fac.clinic, s: 'circle', r: 4 }, doctors: { c: P.fac.doctors, s: 'circle', r: 3.5 }, dentist: { c: P.fac.dentist, s: 'circle', r: 3 }, pharmacy: { c: P.blue, s: 'diamond', r: 3.5 }, other: { c: P.line2, s: 'circle', r: 3 } },
    education: { university: { c: P.fac.university, s: 'square', r: 5 }, college: { c: P.fac.college, s: 'square', r: 4 }, school: { c: P.red, s: 'circle', r: 4 }, early_years: { c: P.fac.early_years, s: 'circle', r: 3.5 }, other: { c: P.line2, s: 'circle', r: 3 } },
    stay: { hotel: { c: P.red, s: 'circle', r: 4 }, hostel: { c: P.fac.hostel, s: 'circle', r: 3.5 }, guest_house: { c: P.blue, s: 'circle', r: 3.5 }, apartment: { c: P.fac.apartment, s: 'diamond', r: 3.5 }, other: { c: P.line2, s: 'circle', r: 3 } },
  };
  const ELEV_COL = (v, lo, hi) => { const t2 = Math.max(0, Math.min(1, (v - lo) / Math.max(1, hi - lo))); const a = [247, 240, 232], b = [140, 60, 50]; return [0, 1, 2].map(i => Math.round(a[i] + t2 * (b[i] - a[i]))).concat([255]); };

  // ---------- indicators ----------
  async function compute(area, parsed, extras) {
    const ring = area.ring; const bb = G.bbox(ring); const aKm2 = G.ringArea(ring) / 1e6;
    const o = A.osmMetrics(parsed, ring);
    const inside = (p) => G.inBBox(p, bb) && G.pointInRing(p, ring);
    const R = { area_m2: o.selArea, osm: o, fac: {}, terrain: null };
    // facilities by class, inside the area
    ['health', 'education', 'stay'].forEach(k => {
      const pts = parsed.pois.filter(p => p.tags._fac === k && inside(p.pt));
      const by = {}; pts.forEach(p => by[p.tags._cls] = (by[p.tags._cls] || 0) + 1);
      R.fac[k] = { n: pts.length, by, perKm2: pts.length / aKm2, pts };
    });
    // nearest hospital (straight-line) from the area centroid, citywide
    const c = G.centroidLL(ring);
    if (extras.health) { let best = Infinity, nm = null; extras.health.features.filter(f => f.properties.cls === 'hospital').forEach(f => { const d = G.haversine(c, f.geometry.coordinates); if (d < best) { best = d; nm = f.properties.nm; } }); R.fac.health.nearestHospital = isFinite(best) ? { d: best, name: nm } : null; }
    // transit
    const stops = parsed.pois.filter(p => p.tags.highway === 'bus_stop');
    const stopsIn = stops.filter(p => inside(p.pt));
    let cover = null;
    if (extras.bus) {
      const near = extras.bus.features.map(f => f.geometry.coordinates).filter(p => G.haversine(c, p) < Math.sqrt(o.selArea) + 600);
      const gs = G.gridSample(ring, 1500); let k = 0; gs.points.forEach(p => { if (near.some(s => G.haversine(p, s) <= 300)) k++; });
      cover = gs.points.length ? k / gs.points.length : null;
    }
    R.transit = { n: stopsIn.length, perKm2: stopsIn.length / aKm2, cover300: cover, pts: stopsIn };
    // terrain from MDT25 grids
    if (extras.dem && extras.slope) {
      const ev = D.gridValuesInRing(extras.dem, ring), sv = D.gridValuesInRing(extras.slope, ring);
      if (ev.length) {
        const s = sv.slice().sort((a, b) => a - b); const cls = {}; SLOPE.forEach(x => cls[x.k] = 0); sv.forEach(v => cls[SLOPE.find(x => v < x.max || x.max === 90).k]++);
        const hist = {}; ev.forEach(v => { const b = Math.floor(v / 10) * 10; hist[b] = (hist[b] || 0) + 1; });
        R.terrain = { n: ev.length, min: Math.min(...ev), max: Math.max(...ev), mean: ev.reduce((a, b) => a + b, 0) / ev.length, slopeCls: cls, slopeN: sv.length, slopeP90: s[Math.floor(s.length * 0.9)], slopeMax: s[s.length - 1], slopeMedian: s[s.length >> 1], hist };
        R.terrain.relief = R.terrain.max - R.terrain.min;
      }
    }
    // footprint sizes
    const fps = o.geo.buildings.features.map(f => G.ringArea(f.geometry.coordinates[0])).sort((a, b) => a - b);
    R.fpMedian = fps.length ? fps[fps.length >> 1] : null;
    return R;
  }

  // ---------- cards ----------
  const deg2pct = (d) => Math.tan(d * Math.PI / 180) * 100;
  function cards(area, parsed, R, opts) {
    const o = R.osm, B = o.buildings, aKm2 = R.area_m2 / 1e6; const ctxB = parsed.buildings.map(b => b._g || (b._g = { type: 'MultiPolygon', coordinates: b.outers.map((ou, i) => [ou].concat(i === 0 ? b.inners : [])) }));
    const ctxS = parsed.streets.map(s => s._g || (s._g = { type: 'LineString', coordinates: s.coords }));
    const date = parsed.osmBase; const facDate = parsed.facilityDate;
    const src = { osm: { name: 'OpenStreetMap', detail: t('g.srcOsmLocal', { d: date }), license: 'ODbL 1.0' }, fac: { name: 'OpenStreetMap (Overpass snapshot)', detail: facDate ? facDate.slice(0, 10) : '—', license: 'ODbL 1.0' }, mdt: { name: 'IGN MDT25', detail: '2008–2015 · 25 m', license: 'CC BY 4.0 © IGN' } };
    const list = [];

    // 1 figure-ground
    list.push({ id: 'fg', title: t('g.fg'), mainLayer: 'buildings_fg', src: src.osm,
      spec: { context: { streets: ctxS }, layers: [{ type: 'fill', items: o.geo.buildings.features.map(f => ({ g: f.geometry, fill: P.ink })) }] },
      legend: [{ sw: P.ink, label: t('g.building') }],
      ind: [[t('b.count'), nf(B.count)], [t('b.gsi'), pct(B.gsi, 1), 'est'], [t('g.fpMedian'), R.fpMedian ? u(nf(R.fpMedian), 'm2') : '—']],
      find: B.count ? [t('g.fFg', { p: pct(B.gsi, 0), n: nf(B.count), m: nf(R.fpMedian) })] : [t('g.fNone')],
      method: t('g.mFg') });

    // 2 heights
    const tagged = B.levelsTagged, cov = B.levelsCoverage;
    const floorsHist = {}; o.geo.buildings.features.forEach(f => { const l = f.properties.levels; if (l == null) return; const k = Math.min(12, Math.max(1, Math.round(l))); floorsHist[k] = (floorsHist[k] || 0) + 1; });
    const sorted = o.geo.buildings.features.map(f => f.properties.levels).filter(v => v != null).sort((a, b) => a - b);
    const med = sorted.length ? sorted[sorted.length >> 1] : null; const share5 = sorted.length ? sorted.filter(v => v >= 5).length / sorted.length : null;
    list.push({ id: 'heights', title: t('g.heights'), mainLayer: 'buildings_floors', src: src.osm, highlightField: 'band',
      spec: { context: { streets: ctxS }, layers: [{ type: 'fill', items: o.geo.buildings.features.map(f => { const k = floorClass(f.properties.levels); return k === 'no_data' ? { g: f.geometry, hatch: GA.palette.grey, stroke: GA.palette.grey2, width: 0.4 } : { g: f.geometry, fill: P.band[k], stroke: '#FFFFFF', width: 0.3 }; }) }] },
      legend: FLOOR.map(c => ({ sw: P.band[c.k], label: t('b.floors', { v: iso(c.k.replace('-', '–')) }), key: c.k })).concat([{ hatch: true, label: t('g.unknownHeight'), key: 'no_data' }]),
      ind: [[t('g.levelsCov'), `${pct(cov)} <small>(${nf(tagged)}/${nf(B.count)})</small>`], [t('g.medianFloors'), med != null ? nf(med) : '—'], [t('g.share5'), pct(share5)]],
      chart: { kind: 'bars', unit: t('g.buildingsUnit'), items: Object.keys(floorsHist).map(k => ({ label: k === '12' ? '12+' : k, v: floorsHist[k], col: P.band[floorClass(+k)] })) , xLabel: t('g.floorsAxis') },
      find: B.count ? (cov >= 0.8 ? [t('g.fHeights', { m: nf(med), p: pct(share5) })] : [t('g.fHeightsLow', { p: pct(cov) }), med != null ? t('g.fHeights', { m: nf(med), p: pct(share5) }) : null].filter(Boolean)) : [t('g.fNone')],
      method: t('g.mHeights') });

    // 3 construction periods
    const pK = A.PERIODS; const PERIOD_COL = P.period;
    list.push({ id: 'periods', title: t('g.periods'), mainLayer: 'buildings_period', src: src.osm,
      spec: { context: { streets: ctxS }, layers: [{ type: 'fill', items: o.geo.buildings.features.map(f => f.properties.period && f.properties.period !== 'no_data' ? { g: f.geometry, fill: PERIOD_COL[f.properties.period] } : { g: f.geometry, fill: GA.palette.paper, stroke: GA.palette.line, width: 0.3 }) }] },
      legend: pK.map(k => ({ sw: PERIOD_COL[k], label: root.GA.report.periodLabel(k), key: k })).concat([{ sw: GA.palette.paper, label: t('nodata'), key: 'no_data' }]),
      ind: [[t('h.start'), `${nf(B.startTagged)} <small>(${pct(B.startCoverage, 1)})</small>`]],
      find: [B.startCoverage < 0.3 ? t('g.fPeriodsLow', { n: nf(B.startTagged), N: nf(B.count) }) : t('g.fPeriods')],
      gap: B.startCoverage < 0.3, method: t('g.mPeriods') });

    // 4 streets
    const ST = o.streets; const tiers = ['primary', 'collector', 'local', 'pedestrian'];
    list.push({ id: 'streets', title: t('g.streets'), mainLayer: 'streets', src: src.osm, highlightField: 'tier',
      spec: { context: { buildings: ctxB }, layers: [{ type: 'line', items: o.geo.streets.features.slice().sort((a, b) => tiers.indexOf(b.properties.tier) - tiers.indexOf(a.properties.tier)).map(f => ({ g: f.geometry, stroke: P.tier[f.properties.tier], width: { primary: 4, collector: 2.6, local: 1.4, pedestrian: 1 }[f.properties.tier], dash: f.properties.tier === 'pedestrian' ? [3, 2] : null })) }] },
      legend: tiers.map(k => ({ line: P.tier[k], w: { primary: 4, collector: 2.6, local: 1.4, pedestrian: 1 }[k], dash: k === 'pedestrian', label: t('tier.' + k), key: k })),
      ind: [[t('s.density'), u(nf(ST.density, 1), 'kmkm2'), 'est'], [t('cmp.ped'), pct(ST.tiers.pedestrian / (ST.total || 1))], [t('s.total'), u(nf(ST.total / 1000, 2), 'km')]],
      chart: { kind: 'hbars', unit: 'km', items: tiers.map(k => ({ label: t('tier.' + k), v: ST.tiers[k] / 1000, col: P.tier[k], key: k })) },
      find: ST.total ? [t('g.fStreets', { d: nf(ST.density, 1), p: pct(ST.tiers.pedestrian / (ST.total || 1)) })] : [t('g.fNone')], method: t('g.mStreets') });

    // 5 land use (incl. parks and public facilities)
    const LU = o.landuse.areas; const luKeys = Object.keys(LU).filter(k => LU[k] > 0).sort((a, b) => LU[b] - LU[a]);
    const top = luKeys[0];
    list.push({ id: 'landuse', title: t('g.landuse'), mainLayer: 'landuse', src: src.osm, highlightField: 'cat',
      spec: { context: { streets: ctxS }, layers: [{ type: 'fill', items: o.geo.landuse.features.map(f => ({ g: f.geometry, fill: P.landuse[f.properties.cat], alpha: 0.8 })) }, { type: 'fill', items: o.geo.buildings.features.map(f => ({ g: f.geometry, fill: 'rgba(34,36,40,.18)' })) }, { type: 'point', items: parsed.pois.filter(p => p.tags._fac && G.pointInRing(p.pt, area.ring)).map(p => ({ g: { type: 'Point', coordinates: p.pt }, fill: P.poi.public, r: 3 })) }] },
      legend: luKeys.map(k => ({ sw: P.landuse[k], label: t('lu.c.' + k), key: k })).concat([{ dot: P.poi.public, label: t('g.publicPoints') }]),
      ind: [[t('g.topUse'), top ? `${t('lu.c.' + top)} ${pct(LU[top] / o.selArea)}` : '—', 'est'], [t('c.green'), pct((LU.green || 0) / o.selArea, 1), 'est'], [t('lu.unclassified'), pct(o.landuse.unclassified / o.selArea), 'est']],
      chart: { kind: 'stack', items: luKeys.map(k => ({ label: t('lu.c.' + k), v: LU[k] / o.selArea, col: P.landuse[k], key: k })).concat([{ label: t('lu.unclassified'), v: o.landuse.unclassified / o.selArea, col: GA.palette.paper }]) },
      find: top ? [t('g.fLanduse', { c: t('lu.c.' + top), p: pct(LU[top] / o.selArea), u: pct(o.landuse.unclassified / o.selArea) })] : [t('g.fLanduseNone')], method: t('g.mLanduse') });

    // 6 parks & open space
    const parksF = o.geo.landuse.features.filter(f => f.properties.cat === 'green');
    const named = o.pois.parks.filter(p => /park/.test(p.kind)).length; const gardens = o.pois.parks.filter(p => p.kind === 'garden').reduce((s, p) => s + p.area, 0);
    list.push({ id: 'parks', title: t('g.parks'), mainLayer: 'parks', src: src.osm,
      spec: { context: { buildings: ctxB, streets: ctxS }, layers: [{ type: 'fill', items: parksF.map(f => ({ g: f.geometry, fill: P.landuse.green, stroke: GA.palette.trees, width: 0.6 })) }] },
      legend: [{ sw: P.landuse.green, label: t('lu.c.green') }],
      ind: [[t('c.green'), pct((LU.green || 0) / o.selArea, 1), 'est'], [t('g.namedParks'), nf(named)]],
      find: [(LU.green || 0) > 0 ? t('g.fParks', { p: pct((LU.green || 0) / o.selArea, 1) }) : t('g.fParksNone')], method: t('g.mParks') });

    // 7–9 facilities
    [['health', 'g.health', 'fac_health'], ['education', 'g.education', 'fac_education'], ['stay', 'g.stay', 'fac_stay']].forEach(([k, tk, layer]) => {
      const F = R.fac[k]; const sym = FAC[k];
      const ind = [[t('g.count'), nf(F.n)], [t('g.perKm2'), u(nf(F.perKm2, 1), 'perkm2'), 'est']];
      if (k === 'health') ind.push([t('g.nearestHosp'), F.nearestHospital ? u(nf(F.nearestHospital.d), 'm') + ` <small>${t('g.straight')}</small>` : '—', 'est']);
      if (k === 'stay') ind.push([t('g.perBuilding'), B.count ? nf(F.n / B.count * 1000, 1) + ' ‰' : '—', 'est']);
      list.push({ id: k, title: t(tk), mainLayer: layer, src: src.fac, highlightField: 'cls',
        spec: { context: { buildings: ctxB, streets: ctxS }, layers: [{ type: 'point', items: F.pts.map(p => { const s = sym[p.tags._cls] || sym.other; return { g: { type: 'Point', coordinates: p.pt }, fill: s.c, shape: s.s, r: s.r + 1 }; }) }] },
        legend: Object.keys(sym).filter(c => c !== 'other').map(c => ({ dot: sym[c].c, shape: sym[c].s, label: t('fac.' + c) + (F.by[c] ? ` (${F.by[c]})` : ''), key: c })),
        ind, chart: F.n ? { kind: 'hbars', unit: t('g.countUnit'), items: Object.keys(sym).filter(c => F.by[c]).map(c => ({ label: t('fac.' + c), v: F.by[c], col: sym[c].c, key: c })) } : null,
        find: [F.n ? t('g.fFac_' + k, { n: nf(F.n), d: nf(F.perKm2, 1), h: nf(F.by.hospital || 0), m: F.nearestHospital ? nf(F.nearestHospital.d) : '—' }) : t('g.fFacNone'), t('g.fFacNote')], method: t('g.mFac') });
    });

    // 10 transit
    const T = R.transit;
    list.push({ id: 'transit', title: t('g.transit'), mainLayer: 'bus_stops', src: { name: 'OpenStreetMap', detail: t('g.srcOsmLocal', { d: date }), license: 'ODbL 1.0' },
      spec: { context: { buildings: ctxB, streets: ctxS }, layers: [{ type: 'point', items: T.pts.map(p => ({ g: { type: 'Point', coordinates: p.pt }, fill: P.ink, r: 4 })) }] },
      legend: [{ dot: P.ink, label: t('poi.transit:bus') }],
      ind: [[t('g.count'), nf(T.n)], [t('g.perKm2'), u(nf(T.perKm2, 1), 'perkm2'), 'est'], [t('g.cover300'), pct(T.cover300), 'est']],
      find: [T.n ? t('g.fTransit', { n: nf(T.n), c: pct(T.cover300) }) : t('g.fTransitNone'), t('g.fFreqGap')], gap: true, method: t('g.mTransit') });

    // 11 elevation + contours + hillshade
    if (R.terrain && opts.dem) {
      const T2 = R.terrain; const lo = opts.elevRange ? opts.elevRange[0] : T2.min, hi = opts.elevRange ? opts.elevRange[1] : Math.max(T2.max, T2.min + 10);
      const contours = (opts.contours || []).filter(f => f.properties.elev >= lo - 10 && f.properties.elev <= hi + 10);
      const hk = Object.keys(T2.hist).map(Number).sort((a, b) => a - b);
      list.push({ id: 'elevation', title: t('g.elevation'), mainLayer: 'elevation', src: src.mdt,
        spec: { raster: { grid: opts.dem, colour: (v) => ELEV_COL(v, lo, hi) }, context: { buildings: ctxB, buildingColor: 'rgba(34,36,40,.12)' }, layers: [{ type: 'line', items: contours.map(f => ({ g: f.geometry, stroke: f.properties.idx ? 'rgba(34,36,40,.75)' : 'rgba(34,36,40,.35)', width: f.properties.idx ? 1 : 0.6 })) }] },
        legend: [{ ramp: [ELEV_COL(lo, lo, hi), ELEV_COL(hi, lo, hi)], label: `${nf(lo)}–${nf(hi)} ${t('u.m')} ${t('g.asl')}` }, { line: 'rgba(34,36,40,.6)', w: 1, label: t('g.contours10') }],
        ind: [[t('g.elevRange'), u(`${nf(T2.min)}–${nf(T2.max)}`, 'm')], [t('g.relief'), u(nf(T2.relief), 'm')], [t('g.meanElev'), u(nf(T2.mean), 'm')]],
        chart: { kind: 'bars', unit: t('g.cellsUnit'), items: hk.map(k => ({ label: String(k), v: T2.hist[k], col: 'rgb(' + ELEV_COL(k + 5, lo, hi).slice(0, 3).join(',') + ')' })), xLabel: t('g.elevAxis') },
        find: [t('g.fElev', { a: nf(T2.min), b: nf(T2.max), r: nf(T2.relief) })], method: t('g.mElev') });
      const sc = T2.slopeCls, sn = T2.slopeN || 1; const steep = (sc['15-25'] + sc['25-35'] + sc['35+']) / sn, flat = (sc['0-2'] + sc['2-5']) / sn;
      list.push({ id: 'slope', title: t('g.slope'), mainLayer: 'slope', src: src.mdt, highlightField: null,
        spec: { raster: { grid: opts.slope, nearest: true, colour: (v) => { const k = SLOPE.find(x => v < x.max || x.max === 90).k; const h = SLOPE_COL[k]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]; } }, context: { buildings: ctxB, buildingColor: 'rgba(34,36,40,.12)' } },
        legend: SLOPE.map(x => ({ sw: SLOPE_COL[x.k], label: `${iso(x.k.replace('-', '–'))}° · ${iso(x.max === 90 ? '>' + nf(deg2pct(35)) : nf(deg2pct(SLOPE[SLOPE.indexOf(x) - 1] ? SLOPE[SLOPE.indexOf(x) - 1].max : 0)) + '–' + nf(deg2pct(x.max)))}%` })),
        ind: [[t('g.flatShare'), pct(flat)], [t('g.steepShare'), pct(steep)], [t('g.slopeP90'), `${nf(T2.slopeP90, 1)}° <small>(${nf(deg2pct(T2.slopeP90))}%)</small>`]],
        chart: { kind: 'stack', items: SLOPE.map(x => ({ label: iso(x.k.replace('-', '–')) + '°', v: sc[x.k] / sn, col: SLOPE_COL[x.k] })) },
        find: [t('g.fSlope', { s: pct(steep), f: pct(flat) }), t('g.fSlopeMax', { d: nf(T2.slopeMax, 1), p: nf(deg2pct(T2.slopeMax)) })], method: t('g.mSlope') });
    } else list.push({ id: 'elevation', title: t('g.elevation'), gapOnly: t('g.terrainOutside') });
    return list;
  }

  // ---------- HTML ----------
  function legendHTML(items) {
    return `<ul class="lg">${items.map(i => {
      let sw = '';
      if (i.hatch) sw = '<i class="sw hatch"></i>'; else if (i.sw) sw = `<i class="sw" style="background:${i.sw}${i.alpha != null ? `;opacity:${i.alpha}` : ''}"></i>`; // swatch drawn at the map's opacity
      else if (i.line) sw = `<i class="sw ln" style="border-top:${Math.max(1, i.w || 1)}px ${i.dash ? 'dashed' : 'solid'} ${i.line}"></i>`;
      else if (i.dot) sw = `<i class="sw dot ${i.shape || ''}" style="background:${i.dot}"></i>`;
      else if (i.ramp) sw = `<i class="sw ramp" style="background:linear-gradient(90deg,rgb(${i.ramp[0].slice(0, 3)}),rgb(${i.ramp[1].slice(0, 3)}))"></i>`;
      return `<li ${i.key ? `data-hl="${esc(i.key)}" tabindex="0"` : ''}>${sw}<span>${i.label}</span></li>`;
    }).join('')}</ul>`;
  }
  function chartSVG(ch) {
    if (!ch || !ch.items.length) return '';
    if (ch.kind === 'stack') {
      let x = 0; const segs = ch.items.filter(i => i.v > 0.0005).map(i => { const w = i.v * 100; const s = `<rect x="${x}" y="0" width="${w}" height="10" fill="${i.col}" ${i.key ? `data-hl="${esc(i.key)}"` : ''}><title>${esc(i.label.replace(/<[^>]+>/g, ''))}: ${pct(i.v, 1)}</title></rect>`; x += w; return s; }).join('');
      return `<figure class="ch"><svg viewBox="0 0 100 10" preserveAspectRatio="none" class="stack" role="img">${segs}</svg></figure>`;
    }
    const max = Math.max(...ch.items.map(i => i.v), 1e-9);
    if (ch.kind === 'hbars') return `<figure class="ch">${ch.items.map(i => `<div class="hb" ${i.key ? `data-hl="${esc(i.key)}" tabindex="0"` : ''}><span class="hb-l">${i.label}</span><span class="hb-t"><i style="width:${(i.v / max * 100).toFixed(1)}%;background:${i.col}"></i></span><span class="hb-v num">${nf(i.v, i.v < 10 && i.v % 1 ? 2 : 0)}</span></div>`).join('')}<figcaption>${esc(ch.unit || '')}</figcaption></figure>`;
    // vertical bars
    const n = ch.items.length, W = 260, H = 70, bw = W / n;
    return `<figure class="ch"><svg viewBox="0 0 ${W} ${H + 14}" class="vbars" dir="ltr" role="img">${ch.items.map((i, k) => { const h = Math.max(1, i.v / max * H); return `<rect x="${k * bw + 1}" y="${H - h}" width="${bw - 2}" height="${h}" fill="${i.col}"><title>${esc(i.label)}: ${nf(i.v)}</title></rect>${n <= 16 || k % Math.ceil(n / 12) === 0 ? `<text x="${k * bw + bw / 2}" y="${H + 11}" text-anchor="middle">${esc(i.label)}</text>` : ''}`; }).join('')}</svg><figcaption>${esc(ch.xLabel || '')} · ${esc(ch.unit || '')}</figcaption></figure>`;
  }
  function cardHTML(c, idx) {
    if (c.gapOnly) return `<article class="card gap-card" data-card="${c.id}"><h3>${c.title}</h3><p class="note">${c.gapOnly}</p></article>`;
    return `<article class="card" data-card="${c.id}">
      <header><h3>${c.title}</h3><div class="card-tools"><button class="btn btn-tiny" data-act="show">${t('v5.onMap')}</button><button class="btn btn-tiny" data-act="png" title="${esc(t('g.png'))}">${t('v5.png')}</button></div></header>
      <button type="button" class="card-map" data-act="enlarge" aria-label="${esc(t('v5.enlargeMap') + ': ' + String(c.title).replace(/<[^>]+>/g, ''))}"><canvas data-canvas="${c.id}"></canvas><span class="enl" aria-hidden="true">⤢ ${t('v5.enlargeMap')}</span></button>
      <div class="card-body">${legendHTML(c.legend || [])}
        <dl class="kpi">${(c.ind || []).map(i => `<div><dt>${i[0]}</dt><dd>${i[1]}${i[2] === 'est' ? ` <span class="badge badge-est">${t('st.est')}</span>` : ''}</dd></div>`).join('')}</dl>
        ${c.chart ? `<div class="ch-wrap">${chartSVG(c.chart)}<button type="button" class="link ch-enl" data-act="chart">⤢ ${t('v5.enlargeChart')}</button></div>` : ''}
        <ul class="find">${(c.find || []).map(f => `<li>${f}</li>`).join('')}</ul>
        <p class="src"><span>${t('src.label')}</span><bdi>${esc(c.src.name)}</bdi> · <span dir="ltr">${esc(c.src.detail)}</span> · ${esc(c.src.license)}</p>
        <details class="method"><summary>${t('g.method')}</summary><p>${c.method}</p></details>
      </div></article>`;
  }

  // Draw a card map into a canvas at a given size/scale
  function drawCard(canvas, area, c, view) {
    const spec = Object.assign({ ring: area.ring, fadeOutside: 0.62, areaStyle: area.style }, c.spec, view);
    return MC.render(canvas, spec);
  }

  const api = { compute, cards, cardHTML, legendHTML, chartSVG, drawCard, FLOOR, SLOPE, SLOPE_COL, FAC, floorClass, deg2pct };
  root.GA = root.GA || {}; root.GA.gallery = api;
})(window);
