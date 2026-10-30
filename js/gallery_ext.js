/* Gallery v3: places and activities, scheduled bus service, trees and canopy, flood exposure,
   strategic noise. External sources load in parallel and fail independently: a failed source
   produces a gap card that names the missing source, never a zero. */
(function (root) {
  const { geo: G, palette: P, i18n: I, ext: X, proj: PJ, data: D } = root.GA;
  const GAL = root.GA.gallery; const PL = root.GA.places;
  const t = (k, v) => I.t(k, v);
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d ? Math.min(1, d) : 0 });
  const pct = (x, d) => x == null || !isFinite(x) ? '—' : nf(x * 100, d == null ? 0 : d) + I.pctSign();
  const u = (v, unit) => `<span class="num">${v}</span> ${t('u.' + unit)}`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- external loads for one study area ----------
  async function load(ring) {
    const bb = G.bbox(ring); const U = ring.map(p => PJ.EPSG25830.forward(p));
    const pad = 80; const x0 = Math.min(...U.map(p => p[0])) - pad, x1 = Math.max(...U.map(p => p[0])) + pad, y0 = Math.min(...U.map(p => p[1])) - pad, y1 = Math.max(...U.map(p => p[1])) + pad;
    const px = Math.max(1, Math.max(x1 - x0, y1 - y0) / 1400); const w = Math.round((x1 - x0) / px), h = Math.round((y1 - y0) / px);
    const box = { x0, y0, x1, y1 };
    const out = { status: {} };
    const job = (k, p) => p.then(v => { out[k] = v; out.status[k] = { state: 'ok' }; }, e => { out[k] = null; out.status[k] = { state: 'failed', error: e.message }; });
    const img = (url) => X.loadImage(url, 40000).then(im => Object.assign({ img: im }, box));
    await Promise.all([
      job('trees', X.trees([bb[0] - 0.0006, bb[1] - 0.0006, bb[2] + 0.0006, bb[3] + 0.0006], 16)),
      job('tcd', X.tcdGrid(ring, 80)),
      job('flood', X.floodExposure(ring)),
      job('floodImg', img(X.wmsURL(X.SVC.miteco, 'agua:Zi_laminas_q500,agua:Zi_laminas_q100,agua:Zi_laminas_q10', [x0, y0, x1, y1], w, h, 25830))),
      job('noiseImg', img(X.wmsURL(X.SVC.noise, 'evaluacionambiental:mer_aglomeracion_lden', [x0, y0, x1, y1], w, h, 25830))),
    ]);
    return out;
  }

  // ---------- indicators ----------
  const baseCompute = GAL.compute;
  GAL.compute = async function (area, parsed, extras) {
    const R = await baseCompute(area, parsed, extras); const ring = area.ring; const bb = G.bbox(ring);
    const inside = (p) => G.inBBox(p, bb) && G.pointInRing(p, ring); const aKm2 = R.area_m2 / 1e6; const ext = extras.ext || {};
    if (extras.places) {
      const all = extras.places.features.filter(f => !f.properties.dup && inside(f.geometry.coordinates));
      const open = all.filter(f => f.properties.s !== 'permanently_closed');
      const by = {}; open.forEach(f => { const g = f.properties.g || '_none'; by[g] = (by[g] || 0) + 1; });
      const cats = {}; open.forEach(f => { const c = f.properties.cd || f.properties.c || '—'; cats[c] = (cats[c] || 0) + 1; });
      const ks = Object.keys(by).filter(k => k !== '_none'); const n = ks.reduce((s, k) => s + by[k], 0);
      const H = n ? -ks.reduce((s, k) => { const p = by[k] / n; return s + p * Math.log(p); }, 0) : null; const even = n && ks.length > 1 ? H / Math.log(ks.length) : (n ? 0 : null);
      const cf = open.map(f => f.properties.cf).filter(v => v != null).sort((a, b) => a - b);
      R.places = { nAll: all.length, n: open.length, closed: all.length - open.length, by, cats, perKm2: open.length / aKm2, evenness: even, groupsPresent: ks.length, confMedian: cf.length ? cf[cf.length >> 1] : null, lowConf: cf.filter(v => v < 0.5).length, missingStatus: open.filter(f => !f.properties.s).length, pts: open };
    }
    if (extras.busSvc) {
      const stops = extras.busSvc.features; const inS = stops.filter(f => inside(f.geometry.coordinates)); const served = inS.filter(f => f.properties.trips_day > 0);
      const routes = [...new Set(served.flatMap(f => String(f.properties.routes || '').split(/[;,]\s*|\s+/).filter(Boolean)))];
      const c = G.centroidLL(ring); let near = Infinity; stops.forEach(f => { if (f.properties.trips_day > 0) { const d = G.haversine(c, f.geometry.coordinates); if (d < near) near = d; } });
      const td = served.map(f => f.properties.trips_day).sort((a, b) => a - b);
      R.bus = { mapped: inS.length, withService: served.length, noService: inS.length - served.length, maxTrips: td.length ? td[td.length - 1] : 0, medianTrips: td.length ? td[td.length >> 1] : null, routes, nearestServed: isFinite(near) ? near : null, pts: inS };
    }
    if (ext.trees) {
      const tr = ext.trees.pts.filter(p => inside(p.ll)); const spec = tr.filter(p => p.tags.species || p.tags.genus || p.tags['species:es']).length;
      let rowLen = 0; ext.trees.ways.filter(w => w.tags.natural === 'tree_row').forEach(w => { try { root.GA.clip.clipLine(w.coords, ring).forEach(l => rowLen += G.lineLength(l)); } catch (e) { } });
      R.trees = { n: tr.length, perHa: tr.length / (R.area_m2 / 1e4), speciesTagged: spec, rowLen, pts: tr, ts: ext.trees.ts };
    }
    if (ext.tcd) R.canopy = X.tcdStats(ext.tcd, ring);
    if (ext.flood) R.flood = ext.flood;
    return R;
  };

  // ---------- cards ----------
  const baseCards = GAL.cards;
  GAL.cards = function (area, parsed, R, opts) {
    const list = baseCards(area, parsed, R, opts); const ext = (opts && opts.ext) || {}; const st = ext.status || {};
    const ctxB = parsed.buildings.map(b => b._g || (b._g = { type: 'MultiPolygon', coordinates: b.outers.map((ou, i) => [ou].concat(i === 0 ? b.inners : [])) }));
    const ctxS = parsed.streets.map(s => s._g || (s._g = { type: 'LineString', coordinates: s.coords }));
    const gap = (id, title, srcKey) => ({ id, title, gapOnly: t('g3.failed', { s: srcKey, e: esc((st[srcKey] && st[srcKey].error) || '') }) });
    const insertAfter = (afterId, card) => { const i = list.findIndex(c => c.id === afterId); list.splice(i >= 0 ? i + 1 : list.length, 0, card); };
    const man = (D.manifest && D.manifest.layers) || {};

    // places and activities
    if (R.places) {
      const Pl = R.places; const gs = Object.keys(Pl.by).sort((a, b) => Pl.by[b] - Pl.by[a]); const top = gs.filter(g => g !== '_none')[0];
      insertAfter('parks', { id: 'places', title: t('g3.places'), mainLayer: 'places', src: { name: 'Overture Maps Foundation — Places', detail: t('g3.placesDate'), license: 'CDLA-Permissive-2.0' }, highlightField: 'g',
        spec: { context: { buildings: ctxB, streets: ctxS }, layers: [{ type: 'point', items: Pl.pts.map(f => ({ g: f.geometry, fill: PL.PLACE_COL[f.properties.g || '_none'], r: 3 })) }] },
        legend: gs.slice(0, 9).map(g => ({ dot: PL.PLACE_COL[g], label: `${t('pg.' + g)} (${Pl.by[g]})`, key: g })),
        ind: [[t('g.count'), nf(Pl.n)], [t('g.perKm2'), u(nf(Pl.perKm2), 'perkm2'), 'est'], [t('g3.mix'), Pl.evenness == null ? '—' : nf(Pl.evenness, 2), 'est']],
        chart: Pl.n ? { kind: 'stack', items: gs.map(g => ({ label: t('pg.' + g), v: Pl.by[g] / Pl.n, col: PL.PLACE_COL[g], key: g })) } : null,
        find: Pl.n ? [t('g3.fPlaces', { n: nf(Pl.n), g: t('pg.' + top), p: pct(Pl.by[top] / Pl.n), k: Pl.groupsPresent }), t('g3.fPlacesQual', { c: nf(Pl.closed), m: nf(Pl.missingStatus), l: nf(Pl.lowConf) }), t('g3.placesCaveat')] : [t('g3.fPlacesNone'), t('g3.placesCaveat')],
        method: t('g3.mPlaces') });
    }
    // scheduled bus service
    if (R.bus) {
      const B = R.bus; const mx = Math.max(1, B.maxTrips);
      const card = { id: 'bus', title: t('g3.bus'), mainLayer: 'bus_service', src: { name: t('g3.busSrcName'), detail: t('ly3.busDate'), license: t('g3.busLic') },
        spec: { context: { buildings: ctxB, streets: ctxS }, layers: [{ type: 'point', items: B.pts.slice().sort((a, b) => b.properties.trips_day - a.properties.trips_day).map(f => ({ g: f.geometry, fill: f.properties.trips_day ? PL.BUS_LV[f.properties.service_level] || P.red : '#FFFFFF', stroke: f.properties.trips_day ? '#FFFFFF' : '#8A8F96', width: 1.2, r: f.properties.trips_day ? 3 + Math.sqrt(f.properties.trips_day / 909) * 14 : 3 })) }] },
        legend: PL.BUS_ORDER.map(l => ({ dot: PL.BUS_LV[l], label: t('bl.' + l), key: l })),
        ind: [[t('g3.stopsMapped'), nf(B.mapped)], [t('g3.stopsServed'), nf(B.withService)], [t('g3.maxTrips'), B.mapped ? nf(B.maxTrips) : '—']],
        chart: B.withService ? { kind: 'hbars', unit: t('g3.depUnit'), items: B.pts.filter(f => f.properties.trips_day > 0).sort((a, b) => b.properties.trips_day - a.properties.trips_day).slice(0, 8).map(f => ({ label: f.properties.stop_name, v: f.properties.trips_day, col: PL.BUS_LV[f.properties.service_level] || P.red })) } : null,
        find: [B.mapped ? t('g3.fBus', { m: nf(B.mapped), s: nf(B.withService), r: nf(B.routes.length), x: nf(B.maxTrips) }) : t('g3.fBusNone', { d: nf(B.nearestServed) }), t('g3.busCaveat')], method: t('g3.mBus') };
      insertAfter('transit', card);
    }
    // trees and canopy
    if (R.trees || R.canopy) {
      const T = R.trees, C = R.canopy;
      insertAfter('places', { id: 'trees', title: t('g3.trees'), mainLayer: 'canopy', src: { name: 'Copernicus HRL Tree Cover Density + OpenStreetMap', detail: `TCD 2018 · 10 m · OSM ${T && T.ts ? T.ts.slice(0, 10) : '—'}`, license: 'Copernicus (free, full and open) · ODbL' },
        spec: { raster: ext.tcd ? { grid: ext.tcd, nearest: true, colour: X.tcdColour } : null, rasterStep: 1, context: { buildings: ctxB, buildingColor: 'rgba(34,36,40,.16)' }, layers: [{ type: 'point', items: T ? T.pts.map(p => ({ g: { type: 'Point', coordinates: p.ll }, fill: '#1E5A28', stroke: '#FFFFFF', width: 0.8, r: 2.4 })) : [] }] },
        legend: X.TCD_CLASSES.slice(1).map(c => ({ sw: `rgb(${c.col.slice(0, 3).join(',')})`, label: `${c.k.replace('-', '–')} % ${t('g3.tcd')}` })).concat([{ dot: '#1E5A28', label: t('ly3.treePt') }]),
        ind: [[t('g3.canopy'), C ? pct(C.mean / 100) : '—', 'est'], [t('g3.treesMapped'), T ? nf(T.n) : '—'], [t('g3.treesHa'), T ? u(nf(T.perHa, 1), 'perha') : '—', 'est']],
        chart: C ? { kind: 'stack', items: [{ label: t('g3.tcd0'), v: C.hist[0] / C.n, col: '#EFEFED' }].concat(X.TCD_CLASSES.slice(1).map((c, i) => ({ label: c.k + ' %', v: C.hist[i + 1] / C.n, col: `rgb(${c.col.slice(0, 3).join(',')})` }))) } : null,
        find: [C ? t('g3.fCanopy', { m: pct(C.mean / 100), a: pct(C.any), d: pct(C.dense) }) : t('g3.failed', { s: 'Copernicus TCD', e: esc((st.tcd && st.tcd.error) || '') }), T ? t('g3.fTrees', { n: nf(T.n), s: nf(T.speciesTagged), r: nf(T.rowLen) }) : t('g3.failed', { s: 'Overpass', e: esc((st.trees && st.trees.error) || '') }), t('g3.treesCaveat')],
        method: t('g3.mTrees') });
    } else insertAfter('places', gap('trees', t('g3.trees'), 'tcd'));
    // flood
    if (R.flood) {
      const F = R.flood; const z = F.zones; const anyF = X.FLOOD.some(k => z[k.k].m2 > 0);
      const items = []; ['q500', 'q100', 'q50', 'q10'].forEach(k => (F.features[k] || []).forEach(p => items.push({ g: { type: 'Polygon', coordinates: p.coordinates }, fill: X.FLOOD.find(q => q.k === k).color, alpha: 0.75 })));
      insertAfter('trees', { id: 'flood', title: t('g3.flood'), mainLayer: 'flood', src: { name: 'MITECO — SNCZI', detail: t('g3.floodDetail'), license: t('g3.floodLic') },
        spec: { images: ext.floodImg ? [Object.assign({ alpha: 0.35 }, ext.floodImg)] : [], context: { buildings: ctxB, streets: ctxS }, layers: [{ type: 'fill', items }, { type: 'line', items: (F.reaches || []).filter(r => r.geometry).map(r => ({ g: r.geometry, stroke: '#0B2E4F', width: 2.4 })) }] },
        legend: X.FLOOD.map(q => ({ sw: q.color, label: `T = ${q.T} (${q.p} ${t('ly3.perYear')})`, key: q.k })).concat([{ line: '#0B2E4F', w: 2.4, label: t('ly3.arpsi') }]),
        ind: [[t('g3.floodT10'), pct(z.q10.share, 1), 'est'], [t('g3.floodT100'), pct(z.q100.share, 1), 'est'], [t('g3.floodT500'), pct(z.q500.share, 1), 'est']],
        chart: anyF ? { kind: 'hbars', unit: t('g3.shareUnit'), items: X.FLOOD.map(q => ({ label: 'T' + q.T, v: z[q.k].share * 100, col: q.color })) } : null,
        find: [anyF ? t('g3.fFlood', { a: pct(z.q10.share, 1), b: pct(z.q100.share, 1), c: pct(z.q500.share, 1) }) : t('g3.fFloodNone'), (F.reaches || []).length ? t('g3.fReach', { r: [...new Set(F.reaches.map(r => r.name).filter(Boolean))].slice(0, 3).join(', ') }) : null, t('g3.floodCaveat')].filter(Boolean),
        method: t('g3.mFlood') });
    } else insertAfter('trees', gap('flood', t('g3.flood'), 'flood'));
    // noise (display only — values are drawn by the service, not computed here)
    insertAfter('flood', ext.noiseImg ? { id: 'noise', title: t('g3.noise'), mainLayer: 'noise', src: { name: 'MITECO — SICA', detail: t('g3.noiseDetail'), license: t('g3.noiseLic') },
      spec: { images: [Object.assign({ alpha: 0.95 }, ext.noiseImg)], context: { buildings: ctxB, buildingColor: 'rgba(34,36,40,.12)' } },
      legend: [{ line: '#FFEE58', w: 2, label: '55 dB(A)' }, { line: '#FFCC80', w: 2, label: '60' }, { line: '#F0A050', w: 2, label: '65' }, { line: '#E05050', w: 2, label: '70' }, { line: '#E040E0', w: 2, label: '75 dB(A) Lden' }],
      ind: [], find: [t('g3.fNoise'), t('g3.noiseCaveat')], method: t('g3.mNoise') } : gap('noise', t('g3.noise'), 'noiseImg'));
    return list;
  };

  root.GA.galleryExt = { load };
})(window);
