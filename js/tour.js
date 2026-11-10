/* Build 5.27 — opening page and the story tour.
   Step 0: the opening page over a faint, desaturated map (static markup in index.html, shown at once on the plain URL;
           deep links #/south, #/print … skip it; #/tour reopens it; window.__noIntro or ?nointro switch it off for tests).
   Step 1: the Base Aérea de Armilla alone. Step 2: the five towns around it, five layers (Space). Step 3: the Granada
           agglomeration, five layers. The last Enter (or Esc, or Exit) returns to the normal map at the current view.
   Keys: Enter next step · Space next layer · Shift+Space / ← previous layer · → next layer · Backspace previous step · Esc exit.
   State in the URL: #/tour (opening page), #/tour/1, #/tour/2/3 (step 2, layer 3).
   Tour layers are their own MapLibre sources / layers (ids tour-*), added on entry and removed on exit; the visitor's
   saved layer state (GA.app.L, localStorage) is never touched. Data: data/vec/base_edge.json (tools/build_base_edge.py),
   data/vec/tour_area.json (tools/build_tour_area.py), and the existing south_metro, tram_1931, escuzar_pole, admin layers.
   Colours: GA.palette.tour (map paint and card legends read the same entries). */
(function (root) {
  const GA = root.GA, I = GA.i18n, P = GA.palette, T = P.tour;
  const t = (k, v) => I.t(k, v);
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
  const pctTxt = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), 1) + ' %'; // plain text (map labels)
  const L = (s) => `<span dir="ltr" class="num">${s}</span>`; // numbers with sign, unit or currency stay left-to-right in RTL text
  const pct = (v) => L(pctTxt(v)); const eur = (v) => L('€' + nf(v));
  const ltr = (h) => GA.ltrNums ? GA.ltrNums(h) : h;
  const RM = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAYERS = { 1: 1, 2: 5, 3: 5 };
  const S = { on: false, step: 0, layer: 1, D: null, built: false, loading: null };
  let map = null;

  // ---------- data ----------
  function bboxOf(geoms) { let a = [180, 90, -180, -90]; const add = (c) => { if (typeof c[0] === 'number') a = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])]; else c.forEach(add); }; geoms.forEach(g => add(g.coordinates)); return [[a[0], a[1]], [a[2], a[3]]]; }
  const grow = (bb, d) => [[bb[0][0] - d, bb[0][1] - d * 0.8], [bb[1][0] + d, bb[1][1] + d * 0.8]]; // room for the town circles and labels
  const M_LAT = 111320, mx = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
  function distM(p, a, b) { // point–segment distance in metres (local equirectangular; fine over a few km)
    const kx = mx(p[1]), ky = M_LAT; const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky, bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let u = L ? -(ax * dx + ay * dy) / L : 0; u = Math.max(0, Math.min(1, u)); return Math.hypot(ax + u * dx, ay + u * dy); }
  function load() {
    if (S.loading) return S.loading;
    const D = GA.data;
    S.loading = Promise.all(['base_edge', 'tour_area', 'south_metro', 'tram_1931', 'escuzar_pole', 'admin'].map(n => D.single(n).catch(() => null))).then(([edge, area, metro, tram, pole, admin]) => {
      const base = edge.features.find(f => f.properties.k === 'base');
      const byName = {}; area.features.forEach(f => { byName[f.properties.name] = f.properties; });
      const towns = edge.features.filter(f => f.properties.k === 'town').map(f => { const m = byName[f.properties.nm] || {}; return { type: 'Feature', properties: { nm: f.properties.nm, pop: m.pop2025, chg: m.chg, lbl: `${f.properties.nm}\n${nf(m.pop2025)} · ${pctTxt(m.chg)}` }, geometry: f.geometry }; });
      const ring = base.geometry.type === 'Polygon' ? base.geometry.coordinates[0] : base.geometry.coordinates[0][0];
      const track = metro && metro.features.find(f => f.properties.k === 'track');
      let metroGap = null; if (track) { metroGap = Infinity; track.geometry.coordinates.forEach(p => { for (let i = 1; i < ring.length; i++) metroGap = Math.min(metroGap, distM(p, ring[i - 1], ring[i])); }); }
      const barrios = admin ? { type: 'FeatureCollection', features: admin.features.filter(f => f.properties.kind === 'barrio') } : null;
      const routes = edge.features.filter(f => f.properties.k === 'route').map(f => f.properties);
      S.D = { edge, area, metro, tram, pole, barrios, base, towns: { type: 'FeatureCollection', features: towns }, routes, metroGap, byName,
        bb: { 1: bboxOf([base.geometry]), 2: grow(bboxOf([base.geometry].concat(towns.map(f => f.geometry))), 0.006), 3: bboxOf(area.features.map(f => f.geometry)), barrio: barrios && barrios.features.length ? bboxOf(barrios.features.map(f => f.geometry)) : null } };
      return S.D;
    });
    S.loading = S.loading.catch(e => { console.error(e); S.loading = null; throw e; }); return S.loading;
  }

  // ---------- classes (map paint and legends read the same breaks and colours) ----------
  function stepExpr(prop, breaks, cols) { const e = ['step', ['get', prop], cols[0]]; breaks.forEach((b, i) => e.push(b, cols[i + 1])); return ['case', ['==', ['typeof', ['get', prop]], 'number'], e, T.missing]; }
  function classLabels(breaks, fmt, unit) { const L = []; L.push('< ' + fmt(breaks[0]) + unit); for (let i = 1; i < breaks.length; i++) L.push(fmt(breaks[i - 1]) + '–' + fmt(breaks[i]) + unit); L.push('≥ ' + fmt(breaks[breaks.length - 1]) + unit); return L; }
  const CLS = {
    chg: () => ({ cols: T.chg, labels: classLabels(T.chgBreaks, (v) => (v < 0 ? '−' : '') + nf(Math.abs(v)), ' %') }),
    inc: () => ({ cols: T.inc, labels: classLabels(T.incBreaks, (v) => '€' + nf(v), '') }),
    rent: () => ({ cols: T.rent, labels: classLabels(T.rentBreaks, (v) => nf(v), '') }),
  };
  const swFill = (c, l, extra) => `<li><i class="sw" style="background:${c}${extra || ''}"></i><span>${l}</span></li>`;
  const swLine = (c, w, l, dash) => `<li><i class="sw ln" style="border-top:${w}px ${dash ? 'dashed' : 'solid'} ${c}"></i><span>${l}</span></li>`;
  const swDot = (c, l, r) => `<li><i class="sw dot" style="background:${c};width:${r || 12}px;height:${r || 12}px;border:2px solid ${T.townLine};box-shadow:0 0 0 1px ${c}"></i><span>${l}</span></li>`;

  // ---------- map layers ----------
  const ID = (k) => 'tour-' + k;
  const GROUPS = {
    veil: ['veil'], base: ['base-fill', 'base-line'], towns: ['towns', 'towns-lbl'], fence: ['fence'], dead: ['dead'], route: ['straight', 'route'],
    band: ['band', 'bandlu', 'band-line'], metro: ['metro-case', 'metro'], tram: ['tram'], pole: ['pole'],
    chg: ['chg'], inc: ['inc'], rent: ['rent'], muniLine: ['muni-line'], five: ['five'], barrio: ['barrio', 'barrio-lbl'],
  };
  const VIS = {
    0: [[]],
    1: [['veil', 'base']],
    2: [['veil', 'base', 'towns'], ['veil', 'base', 'fence'], ['veil', 'base', 'route', 'dead'], ['veil', 'band', 'base'], ['veil', 'base', 'tram', 'metro']],
    3: [['veil', 'chg', 'muniLine', 'five'], ['veil', 'inc', 'muniLine', 'five'], ['veil', 'rent', 'muniLine', 'five'], ['veil', 'barrio'], ['veil', 'base', 'pole', 'tram', 'metro']],
  };
  const ORDER = ['veil', 'chg', 'inc', 'rent', 'muni-line', 'five', 'barrio', 'band', 'bandlu', 'band-line', 'base-fill', 'base-line', 'fence', 'pole', 'tram', 'metro-case', 'metro', 'straight', 'route', 'dead', 'towns', 'towns-lbl', 'barrio-lbl'];
  function build() {
    if (S.built || !map || !S.D) return; const D = S.D; const src = (k, data) => { if (!map.getSource(ID(k))) map.addSource(ID(k), { type: 'geojson', data }); };
    const fc = (fs) => ({ type: 'FeatureCollection', features: fs });
    src('world', fc([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-10, 34], [2, 34], [2, 41], [-10, 41], [-10, 34]]] } }]));
    src('edge', D.edge); src('towns', D.towns); src('towns-l', D.towns); src('area', D.area); // labels in their own sources: a label that cannot get its font never hides the shapes
    src('metro', D.metro || fc([])); src('tram', D.tram || fc([])); src('pole', D.pole || fc([])); src('barrio', D.barrios || fc([])); src('barrio-l', D.barrios || fc([]));
    const k = (v) => ['==', ['get', 'k'], v]; const lay = (o) => { if (!map.getLayer(o.id)) map.addLayer(Object.assign({ layout: {} }, o, { layout: Object.assign({ visibility: 'none' }, o.layout || {}) })); };
    const F = T.fence;
    const defs = {
      veil: { type: 'fill', source: ID('world'), paint: { 'fill-color': T.veil, 'fill-opacity': 0.62 } },
      chg: { type: 'fill', source: ID('area'), paint: { 'fill-color': stepExpr('chg', T.chgBreaks, T.chg), 'fill-opacity': 0.85 } },
      inc: { type: 'fill', source: ID('area'), paint: { 'fill-color': stepExpr('inc', T.incBreaks, T.inc), 'fill-opacity': 0.85 } },
      rent: { type: 'fill', source: ID('area'), paint: { 'fill-color': stepExpr('rent', T.rentBreaks, T.rent), 'fill-opacity': ['case', ['==', ['typeof', ['get', 'rent']], 'number'], 0.85, 0.45] } },
      'muni-line': { type: 'line', source: ID('area'), paint: { 'line-color': T.muni, 'line-width': 0.8, 'line-opacity': 0.7 } },
      five: { type: 'line', source: ID('area'), filter: ['==', ['get', 'five'], true], paint: { 'line-color': T.five, 'line-width': 2.6 } },
      barrio: { type: 'line', source: ID('barrio'), paint: { 'line-color': T.barrio, 'line-width': 1.6 } },
      'barrio-lbl': { type: 'symbol', source: ID('barrio-l'), layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-max-width': 8 }, paint: { 'text-color': T.label, 'text-halo-color': P.ui.white, 'text-halo-width': 1.5 } },
      band: { type: 'fill', source: ID('edge'), filter: k('band'), paint: { 'fill-color': T.band, 'fill-opacity': 0.55 } },
      bandlu: { type: 'fill', source: ID('edge'), filter: k('bandlu'), paint: { 'fill-color': ['match', ['get', 'c'], 'residential', T.bandlu.residential, 'industrial', T.bandlu.industrial, 'green', T.bandlu.green, 'agri', T.bandlu.agri, T.bandlu.construction], 'fill-opacity': 0.75 } },
      'band-line': { type: 'line', source: ID('edge'), filter: k('band'), paint: { 'line-color': T.bandLine, 'line-width': 1.4, 'line-dasharray': [3, 2] } },
      'base-fill': { type: 'fill', source: ID('edge'), filter: k('base'), paint: { 'fill-color': T.baseFill, 'fill-opacity': 0.14 } },
      'base-line': { type: 'line', source: ID('edge'), filter: k('base'), paint: { 'line-color': T.baseLine, 'line-width': 2.6 } },
      fence: { type: 'line', source: ID('edge'), filter: k('fence'), layout: { 'line-cap': 'butt' }, paint: { 'line-color': ['match', ['get', 'c'], 'housing', F.housing, 'open', F.open, 'road', F.road, 'green', F.green, F.industry], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 9] } },
      pole: { type: 'line', source: ID('pole'), filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': P.south.estate, 'line-width': 1.8, 'line-dasharray': [3, 2] } },
      tram: { type: 'line', source: ID('tram'), filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': P.south.tram, 'line-width': 2.6, 'line-dasharray': [2, 1.5] } },
      'metro-case': { type: 'line', source: ID('metro'), filter: k('track'), layout: { 'line-cap': 'round' }, paint: { 'line-color': P.south.metroCasing, 'line-width': 6 } },
      metro: { type: 'line', source: ID('metro'), filter: k('track'), layout: { 'line-cap': 'round' }, paint: { 'line-color': P.south.metro, 'line-width': 3.2 } },
      straight: { type: 'line', source: ID('edge'), filter: k('straight'), paint: { 'line-color': T.straight, 'line-width': 1.6, 'line-dasharray': [2, 2] } },
      route: { type: 'line', source: ID('edge'), filter: k('route'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': T.route, 'line-width': 3.4 } },
      dead: { type: 'circle', source: ID('edge'), filter: k('deadend'), paint: { 'circle-radius': 5.5, 'circle-color': T.dead, 'circle-stroke-color': T.townLine, 'circle-stroke-width': 2 } },
      towns: { type: 'circle', source: ID('towns'), paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 10, ['*', 0.016, ['sqrt', ['get', 'pop']]], 13, ['*', 0.13, ['sqrt', ['get', 'pop']]], 15, ['*', 0.52, ['sqrt', ['get', 'pop']]]], 'circle-color': T.town, 'circle-opacity': 0.82, 'circle-stroke-color': T.townLine, 'circle-stroke-width': 2 } },
      'towns-lbl': { type: 'symbol', source: ID('towns-l'), layout: { 'text-field': ['get', 'lbl'], 'text-font': ['Noto Sans Bold'], 'text-size': 12.5, 'text-anchor': 'center', 'text-allow-overlap': true }, paint: { 'text-color': T.label, 'text-halo-color': P.ui.white, 'text-halo-width': 2 } },
    };
    ORDER.forEach(n => lay(Object.assign({ id: ID(n) }, defs[n])));
    S.built = true;
  }
  function unbuild() {
    if (!map || !map.style) return; ORDER.forEach(n => { if (map.getLayer(ID(n))) map.removeLayer(ID(n)); });
    ['world', 'edge', 'towns', 'towns-l', 'area', 'metro', 'tram', 'pole', 'barrio', 'barrio-l'].forEach(n => { if (map.getSource(ID(n))) map.removeSource(ID(n)); });
    S.built = false;
  }
  function raise() { // keep the tour layers on top of everything else, in ORDER (the atlas keeps its own below them)
    if (!S.built || !map || !map.style) return; const ids = map.getStyle().layers.map(l => l.id); const want = ORDER.map(ID).filter(id => ids.includes(id));
    if (JSON.stringify(ids.slice(ids.length - want.length)) !== JSON.stringify(want)) want.forEach(id => map.moveLayer(id)); }
  function showGroups(groups) {
    if (!S.built) return; const on = new Set(); groups.forEach(g => GROUPS[g].forEach(n => on.add(ID(n))));
    ORDER.forEach(n => { const id = ID(n); if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on.has(id) ? 'visible' : 'none'); });
    raise();
  }

  // ---------- card ----------
  function legendHTML(step, layer) {
    const D = S.D; if (!D) return '';
    if (step === 1) return `<ul class="lg">${swFill(T.baseFill, t('tour.lgBase'), `;opacity:.45;border:2.5px solid ${T.baseLine}`)}</ul>`;
    if (step === 2) {
      if (layer === 1) return `<ul class="lg">${swDot(T.town, t('tour.s2.l1lg'), 16)}</ul>`;
      if (layer === 2) { const st = D.edge.stats; const order = Object.keys(T.fence).sort((a, b) => (st.fence_m[b] || 0) - (st.fence_m[a] || 0));
        return `<ul class="lg">${order.map(c => `<li><i class="sw ln" style="border-top:6px solid ${T.fence[c]}"></i><span>${t('tour.s2.c.' + c)} · ${nf((st.fence_m[c] || 0) / 1000, 1)} km · ${nf((st.fence_share[c] || 0) * 100)} %</span></li>`).join('')}</ul><p class="fine">${t('tour.s2.l2note')}</p>`; }
      if (layer === 3) return `<ul class="lg">${swDot(T.dead, t('tour.s2.lgDead'), 11)}${swLine(T.route, 4, t('tour.s2.lgRoute'))}${swLine(T.straight, 2, t('tour.s2.lgStraight'), true)}</ul>`;
      if (layer === 4) { const lu = D.edge.stats.band_landuse_ha; return `<ul class="lg">${swFill(T.band, t('tour.s2.lgBand'), `;border:1.5px dashed ${T.bandLine}`)}${Object.keys(T.bandlu).filter(c => lu[c]).map(c => swFill(T.bandlu[c], `${t('tour.s2.lu.' + c)} · ${nf(lu[c], 1)} ha`)).join('')}</ul>`; }
      return `<ul class="lg">${swLine(P.south.metro, 4, t('tour.lgMetro'))}${swLine(P.south.tram, 3, t('tour.lgTram'), true)}${swFill(T.baseFill, t('tour.lgBase'), `;opacity:.5;border:2px solid ${T.baseLine}`)}</ul>`;
    }
    const fiveSw = swLine(T.five, 3, t('tour.lgFive'));
    if (layer <= 3) { const key = ['chg', 'inc', 'rent'][layer - 1]; const c = CLS[key]();
      return `<ul class="lg">${c.cols.map((col, i) => swFill(col, L(c.labels[i]))).join('')}${key === 'rent' ? swFill(T.missing, t('tour.s3.noIdx'), ';opacity:.45') : ''}${fiveSw}</ul>`; }
    if (layer === 4) return `<ul class="lg">${swLine(T.barrio, 2, t('tour.s3.lgBarrio'))}</ul>`;
    return `<ul class="lg">${swLine(P.south.metro, 4, t('tour.lgMetro'))}${swLine(P.south.tram, 3, t('tour.lgTram'), true)}${swLine(P.south.estate, 2, t('tour.lgEstate'), true)}${swFill(T.baseFill, t('tour.lgBase'), `;opacity:.5;border:2px solid ${T.baseLine}`)}</ul>`;
  }
  function bodyHTML(step, layer) {
    const D = S.D; if (!D) return ''; const st = D.edge.stats; const A = D.area.stats;
    if (step === 1) return `<ul class="tour-facts"><li><b>${t('tour.s1.area', { ha: nf(st.area_ha) })}</b></li><li>${t('tour.s1.since')}</li><li>${t('tour.s1.ala')}</li><li>${t('tour.s1.fence', { km: nf(st.perimeter_km, 1) })}</li></ul>`;
    if (step === 2) {
      if (layer === 1) return `<p>${t('tour.s2.l1t', { n: nf(A.five.pop2025) })}</p>`;
      if (layer === 2) return `<p>${t('tour.s2.l2t')}</p>`;
      if (layer === 3) { const nm = { churriana_alhendin: ['Churriana de la Vega', 'Alhendín'], gabias_ogijares: ['Las Gabias', 'Ogíjares'] };
        return `<p>${t('tour.s2.l3t', { n: st.deadends })}</p><ul class="tour-facts">${D.routes.map(r => `<li>${t('tour.s2.route', { a: nm[r.r][0], b: nm[r.r][1], w: nf(r.walk_m / 1000, 1), s: nf(r.straight_m / 1000, 1), r: nf(r.ratio, 2) })}</li>`).join('')}</ul>`; }
      if (layer === 4) return `<p>${t('tour.s2.l4t', { ha: nf(st.band_ha) })}</p>`;
      return `<p>${t('tour.s2.l5t', { m: D.metroGap == null ? '—' : nf(Math.round(D.metroGap / 5) * 5) })}</p>`;
    }
    const g = D.byName.Granada, lg = D.byName['Las Gabias'], ch = D.byName['Churriana de la Vega'];
    const lead = layer <= 2 ? `<p class="tour-lead">${t('tour.s3.card', { a: pct(A.five.chg), b: pct(A.rest.chg), c: pct(A.city.chg), y: g.incYear, g: eur(g.inc), lg: eur(lg.inc), ch: eur(ch.inc) })}</p>` : ''; // the comparison with Granada leads the population and income layers
    const rentY = (D.area.features.find(f => f.properties.rentYear) || { properties: {} }).properties.rentYear;
    const txt = [t('tour.s3.l1t'), t('tour.s3.l2t', { y: g.incYear }), `${t('tour.s3.l3t', { y: rentY, n: A.rentCovered, N: A.n })}</p><p class="tour-miss"><b>${t('tour.missing')}:</b> ${t('tour.s3.l3miss')}`,
      `${t('tour.s3.l4t', { n: D.barrios ? D.barrios.features.length : 0 })}</p><p class="tour-miss"><b>${t('tour.missing')}:</b> ${t('tour.s3.l4miss')}`, t('tour.s3.l5t')][layer - 1];
    return lead + `<p>${txt}</p>`;
  }
  function srcHTML(step, layer) {
    if (step === 1) return t('tour.s1.srcTxt');
    if (step === 2) return [t('tour.s2.l1src') + ' · OSM place nodes (ODbL)', 'OpenStreetMap (ODbL) · tools/build_base_edge.py', 'OpenStreetMap (ODbL) · tools/build_base_edge.py', 'OpenStreetMap (ODbL) · BOE 1981', 'OpenStreetMap (ODbL) · © IGN MTN50 (1931), CC BY 4.0'][layer - 1];
    return [t('tour.s2.l1src'), 'INE ADRH (31025)', 'INE IPVA (59060)', 'OpenStreetMap (ODbL)', 'OpenStreetMap (ODbL) · © IGN MTN50 (1931), CC BY 4.0'][layer - 1] + '. ' + t('tour.s3.area', { n: S.D.area.stats.n });
  }
  function renderCard() {
    const c = $('#tour-card'); if (!c) return; const { step, layer } = S; c.hidden = !S.on || step === 0; if (c.hidden) return;
    const n = LAYERS[step]; const titles = step === 1 ? t('tour.s1.title') : t(`tour.s${step}.l${layer}`);
    const last = step === 3;
    c.innerHTML = `<div class="tour-c-h"><span class="tour-plate">${esc(t('tour.step', { i: step }))} · ${esc(t(`tour.s${step}.plate`))}</span>${n > 1 ? `<span class="tour-dots" role="img" aria-label="${esc(t('tour.layerOf', { i: layer, n }))}">${Array.from({ length: n }, (_, i) => `<i class="${i + 1 === layer ? 'on' : ''}" aria-hidden="true">${i + 1 === layer ? '●' : '○'}</i>`).join('')}</span>` : ''}</div>
      <h2 class="tour-c-t">${esc(titles)}</h2>
      <div class="tour-c-b">${S.D ? bodyHTML(step, layer) + legendHTML(step, layer) + `<p class="tour-src"><b>${t('tour.src')}:</b> ${srcHTML(step, layer)}</p>` : '<p class="fine">…</p>'}</div>
      <p class="tour-keys">${esc(t(step === 1 ? 'tour.k.s1' : last ? 'tour.k.last' : 'tour.k.layers'))}</p>
      <div class="tour-btns">
        <button type="button" class="btn btn-small" data-tour="back">${t('tour.back')}</button>
        ${n > 1 ? `<button type="button" class="btn btn-small" data-tour="prev" ${layer <= 1 ? 'disabled' : ''}>${t('tour.prevLayer')}</button><button type="button" class="btn btn-small" data-tour="layer">${t('tour.nextLayer')}</button>` : ''}
        <button type="button" class="btn btn-small btn-primary" data-tour="next">${t(last ? 'tour.finish' : 'tour.next')}</button>
        <button type="button" class="btn btn-small" data-tour="exit">${t('tour.exit')}</button>
      </div>`;
    c.dataset.step = step; c.dataset.layer = layer;
    if (GA.ltrNumsDOM) GA.ltrNumsDOM(c);
  }

  // ---------- view ----------
  function pad() {
    const c = $('#tour-card'), st = $('.stage'); const r = c && !c.hidden ? c.getBoundingClientRect() : null; const s = st.getBoundingClientRect();
    const p = { top: 40, bottom: 36, left: 40, right: 60 };
    if (r && r.width) { if (innerWidth < 700) p.bottom = Math.max(p.bottom, Math.round(s.bottom - r.top) + 16);
      else if (I.dir() === 'rtl') p.right = Math.max(p.right, Math.round(s.right - r.left) + 24); else p.left = Math.max(p.left, Math.round(r.right - s.left) + 24); }
    const maxH = s.height - 80, maxW = s.width - 60; if (p.top + p.bottom > maxH) p.bottom = Math.max(20, maxH - p.top); if (p.left + p.right > maxW) { p.left = Math.min(p.left, maxW / 2); p.right = Math.min(p.right, maxW / 2); }
    return p;
  }
  // the view of a step; step 3 layer 4 (the city's neighbourhoods) zooms in to the city, the other layers keep the step's view
  const viewKey = () => S.step === 3 && S.layer === 4 && S.D && S.D.bb.barrio ? 'barrio' : String(S.step);
  function frame(instant) { if (!S.D || !map || !S.step) return; const k = viewKey(); S.view = k; map.stop(); map.fitBounds(S.D.bb[k], { padding: pad(), duration: instant || RM() ? 0 : 2000, essential: false }); }

  // ---------- state ----------
  const intro = () => $('#tour-intro');
  const introShown = () => { const el = intro(); return !!el && !el.hidden; };
  function setHash() { const h = S.step === 0 ? '#/tour' : S.step === 1 ? '#/tour/1' : `#/tour/${S.step}/${S.layer}`; if (location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h); }
  function showIntro() {
    S.on = false; S.step = 0; hideTourUI(); const el = intro(); if (!el) return; el.hidden = false; document.body.classList.add('tour-intro-on'); renderIntro();
    const b = $('#tour-start'); b && b.focus({ preventScroll: true });
  }
  function hideIntro() { const el = intro(); if (el) el.hidden = true; document.body.classList.remove('tour-intro-on'); }
  function renderIntro() { const el = intro(); if (!el) return; el.querySelectorAll('[data-tour-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tourLang === I.lang))); }
  function hideTourUI() { document.body.classList.remove('tour-on'); const c = $('#tour-card'); if (c) c.hidden = true; if (map) showGroups([]); }
  async function go(step, layer, instant) {
    hideIntro(); if (GA.panels) ['analysis', 'study'].forEach(k => GA.panels.isOpen(k) && GA.panels.set(k, false));
    const side = $('#atl-side'); if (side && !side.hidden) $('#atl-side-x') && $('#atl-side-x').click();
    S.on = true; const moved = step !== S.step; S.step = step; S.layer = Math.max(1, Math.min(LAYERS[step], layer || 1)); document.body.classList.add('tour-on'); setHash(); renderCard();
    try { await load(); } catch (e) { const c = $('#tour-card'); if (c) c.querySelector('.tour-c-b').innerHTML = `<p class="error">${esc(e.message || e)}</p>`; return; }
    if (!S.on || S.step !== step) return; await mapReady(); build(); renderCard(); showGroups(VIS[S.step][S.layer - 1]); if (moved) frame(instant);
    document.dispatchEvent(new CustomEvent('ga:tour', { detail: { step: S.step, layer: S.layer } }));
  }
  function setLayer(d) { if (!S.on || LAYERS[S.step] < 2) return; const n = Math.max(1, Math.min(LAYERS[S.step], S.layer + d)); if (n === S.layer) return; S.layer = n; setHash(); renderCard(); showGroups(VIS[S.step][S.layer - 1]); if (viewKey() !== S.view) frame(); document.dispatchEvent(new CustomEvent('ga:tour', { detail: { step: S.step, layer: S.layer } })); }
  function next() { if (S.step >= 3) return exit(); go(S.step + 1, 1); }
  function back() { if (S.step <= 1) return showIntroFromTour(); go(S.step - 1, 1); }
  function showIntroFromTour() { S.step = 0; setHash(); showIntro(); }
  function exit() { // the normal map at the current view: panels closed, tour layers removed, saved layer state untouched
    S.on = false; S.step = 0; hideIntro(); hideTourUI(); unbuild(); if (GA.panels) ['analysis', 'study'].forEach(k => GA.panels.isOpen(k) && GA.panels.set(k, false));
    if (/^#\/tour/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    dispatchEvent(new Event('ga:relayout')); document.dispatchEvent(new CustomEvent('ga:tour', { detail: { step: null } }));
  }
  function mapReady() { return new Promise(res => { map = map || (GA.app && GA.app.map); if (!map) return setTimeout(() => mapReady().then(res), 100); if (map._loaded || (map.style && map.style._loaded) || map.loaded()) res(); else map.once('load', res); }); } // the style is enough: tiles may still be loading (or failing)
  function fromHash() {
    const m = /^#\/tour(?:\/(\d))?(?:\/(\d))?\/?$/.exec(location.hash || ''); if (!m) return false;
    const step = +(m[1] || 0); if (!step) showIntro(); else go(Math.min(3, step), +(m[2] || 1), true); return true;
  }

  // ---------- keys and buttons ----------
  function onKey(e) {
    if (!S.on && !introShown()) return; if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tg = e.target; if (tg && tg.closest && tg.closest('input, textarea, select, [contenteditable="true"], .vw, .modal:not([hidden])')) return;
    const k = e.key; let used = true;
    if (introShown()) { if (k === 'Enter') go(1, 1); else used = false; }
    else if (k === 'Enter') next();
    else if (k === ' ' || k === 'Spacebar') setLayer(e.shiftKey ? -1 : 1);
    else if (k === 'ArrowLeft') setLayer(-1);
    else if (k === 'ArrowRight') setLayer(1);
    else if (k === 'Backspace') back();
    else if (k === 'Escape') exit();
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }
  // Space activates a focused button on key-up: swallow it so one press never counts twice
  function onKeyUp(e) { if ((S.on || introShown()) && (e.key === ' ' || e.key === 'Enter') && !(e.target && e.target.closest && e.target.closest('input, textarea, select'))) { e.preventDefault(); e.stopPropagation(); } }
  function onCardClick(e) { const b = e.target.closest('[data-tour]'); if (!b) return; const a = b.dataset.tour; b.blur();
    if (a === 'next') next(); else if (a === 'layer') setLayer(1); else if (a === 'prev') setLayer(-1); else if (a === 'back') back(); else if (a === 'exit') exit(); }

  function init() {
    map = GA.app && GA.app.map;
    const st = $('.stage'); let c = $('#tour-card'); if (!c && st) { c = document.createElement('section'); c.id = 'tour-card'; c.className = 'tour-card'; c.hidden = true; c.setAttribute('aria-live', 'polite'); st.appendChild(c); }
    c && c.addEventListener('click', onCardClick);
    const el = intro();
    if (el) { el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'tour-start') go(1, 1); else if (b.id === 'tour-open') exit(); else if (b.dataset.tourLang) { I.setLang(b.dataset.tourLang); renderIntro(); } });
      el.querySelectorAll('[data-tour-lang]').forEach(b => { b.textContent = I.LANGS[b.dataset.tourLang].label; }); }
    document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKeyUp, true);
    addEventListener('hashchange', () => { if (/^#\/tour/.test(location.hash)) fromHash(); else if (S.on || introShown()) { S.on = false; hideIntro(); hideTourUI(); unbuild(); } });
    I.onChange(() => { renderIntro(); renderCard(); });
    if (map) { map.on('styledata', () => { if (S.built) raise(); }); }
    addEventListener('resize', () => { if (S.on) frame(true); });
    const nav = $('#tb-nav'); if (nav && !$('#tb-tour')) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tb-btn'; b.id = 'tb-tour'; b.dataset.i18n = 'tour.nav'; b.textContent = t('tour.nav'); b.addEventListener('click', () => { location.hash = '#/tour'; }); nav.insertBefore(b, nav.firstChild); }
    if (!fromHash() && introShown()) { renderIntro(); load().catch(() => { }); }
  }
  root.GA.tour = { init, go, exit, next, back, setLayer, showIntro, get state() { return { on: S.on, step: S.step, layer: S.layer, intro: introShown(), built: S.built, groups: S.on ? VIS[S.step][S.layer - 1] : [] }; }, get data() { return S.D; }, VIS, GROUPS, ID };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0)); else setTimeout(init, 0);
})(window);
