/* Build 5.27 — opening page and the story tour (5.33: towns as built-up areas, the streets slides, labelled step-3 maps,
   framing in the free map area).
   Step 0: the opening page over a faint, desaturated map (static markup in index.html, shown at once on the plain URL;
           deep links #/south, #/print … skip it; #/tour reopens it; window.__noIntro or ?nointro switch it off for tests).
   Step 1: the Base Aérea de Armilla alone.
   Step 2: the five towns around it, seven layers (Space): 1 the towns' built-up areas · 2 what touches the fence ·
           3–5 where the streets stop (route A, route B, both) · 6 the 300 m band · 7 metro 2026 and tram 1931.
   Step 3: the Granada agglomeration, four layers: population change · income · rents · the city's neighbourhoods.
           The last Enter (or Esc, or Exit, or "Open the map") returns to the normal map at the current view.
   Keys: Enter next step · Space next layer · Shift+Space / ← previous layer · → next layer · Backspace previous step · Esc exit.
   State in the URL: #/tour (opening page), #/tour/1, #/tour/2/3 (step 2, layer 3).
   Tour layers are their own MapLibre sources / layers (ids tour-*), added on entry and removed on exit; the visitor's
   saved layer state (GA.app.L, localStorage) is never touched.
   Labels (town names, municipality name + value, route figures, start/end names) and the dead-end signs are HTML over the
   map (.tour-lbls), placed by one greedy collision pass: label point inside each polygon (polylabel), then the nearest
   free position with a leader line; nothing is hidden (a crowded label falls back to its value alone, then to the least
   crowded spot). Dead-end signs closer than 20 px are grouped into one sign with a count.
   Framing: every slide fits its feature into the free map area — the map minus the tour card, the top-right controls,
   the attribution and the scale/north group, measured with getBoundingClientRect — plus a 48 px margin; refitted on
   resize, language switch, card size changes and Back.
   Data: data/vec/base_edge.json (tools/build_base_edge.py), tour_area.json (tools/build_tour_area.py), tour_towns.json
   (tools/build_tour_towns.py) and the existing south_metro, tram_1931, admin layers.
   Colours: GA.palette.tour (map paint, HTML labels and card legends read the same entries). */
(function (root) {
  const GA = root.GA, I = GA.i18n, P = GA.palette, T = P.tour;
  const t = (k, v) => I.t(k, v);
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
  const pctTxt = (v) => v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), 1) + ' %'; // plain text
  const L = (s) => `<span dir="ltr" class="num">${s}</span>`; // numbers with sign, unit or currency stay left-to-right in RTL text
  const pct = (v) => L(pctTxt(v)); const eur = (v) => L('€' + nf(v));
  const RM = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RI = () => GA.railIcons;
  const LAYERS = { 1: 1, 2: 7, 3: 4 };
  const STREETS = [3, 4, 5]; // step 2 layers: route A, route B, both
  const MARGIN = 48; // px between the framed feature and the nearest overlay
  const S = { on: false, step: 0, layer: 1, D: null, built: false, loading: null, items: [], placed: [] };
  let map = null;

  // ---------- geometry helpers ----------
  function bboxOf(geoms) { let a = [180, 90, -180, -90]; const add = (c) => { if (typeof c[0] === 'number') a = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])]; else c.forEach(add); }; geoms.forEach(g => add(g.coordinates)); return [[a[0], a[1]], [a[2], a[3]]]; }
  const grow = (bb, d) => [[bb[0][0] - d, bb[0][1] - d * 0.8], [bb[1][0] + d, bb[1][1] + d * 0.8]];
  const M_LAT = 111320, mx = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
  function distM(p, a, b) { // point–segment distance in metres (local equirectangular; fine over a few km)
    const kx = mx(p[1]), ky = M_LAT; const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky, bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let u = L2 ? -(ax * dx + ay * dy) / L2 : 0; u = Math.max(0, Math.min(1, u)); return Math.hypot(ax + u * dx, ay + u * dy); }
  const lenM = (c) => { let s = 0; for (let i = 1; i < c.length; i++) s += distM(c[i], c[i - 1], c[i - 1]); return s; };
  // pole of inaccessibility (the polylabel method: grid cells refined until within `prec` of the best), in local metres
  function polylabel(rings) {
    const lat0 = rings[0][0][1], kx = mx(lat0), ky = M_LAT; const R = rings.map(r => r.map(p => [p[0] * kx, p[1] * ky]));
    const o = R[0]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; o.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    const dist = (x, y) => { let inside = false, m = Infinity; R.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      let dx = b[0] - a[0], dy = b[1] - a[1], px = a[0], py = a[1]; if (dx || dy) { const u = ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy); if (u > 1) { px = b[0]; py = b[1]; } else if (u > 0) { px += dx * u; py += dy * u; } }
      m = Math.min(m, (x - px) ** 2 + (y - py) ** 2); } }); return (inside ? 1 : -1) * Math.sqrt(m); };
    const cell = (x, y, h) => { const d = dist(x, y); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
    const size = Math.min(x1 - x0, y1 - y0); if (!size) return [o[0][0] / kx, o[0][1] / ky];
    const prec = Math.max(1, size / 200); let h = size / 2; const q = [];
    for (let x = x0; x < x1; x += size) for (let y = y0; y < y1; y += size) q.push(cell(x + h, y + h, h));
    let best = cell((x0 + x1) / 2, (y0 + y1) / 2, 0);
    while (q.length) { let bi = 0; for (let i = 1; i < q.length; i++) if (q[i].max > q[bi].max) bi = i; const c = q.splice(bi, 1)[0];
      if (c.d > best.d) best = c; if (c.max - best.d <= prec) continue; h = c.h / 2;
      q.push(cell(c.x - h, c.y - h, h), cell(c.x + h, c.y - h, h), cell(c.x - h, c.y + h, h), cell(c.x + h, c.y + h, h)); }
    return [best.x / kx, best.y / ky];
  }
  const ringsOf = (g) => { if (g.type === 'Polygon') return g.coordinates; let best = null, ba = -1; g.coordinates.forEach(p => { const b = bboxOf([{ coordinates: p }]); const a = (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]); if (a > ba) { ba = a; best = p; } }); return best; };
  function along(c, m) { let acc = 0; for (let i = 1; i < c.length; i++) { const d = distM(c[i], c[i - 1], c[i - 1]); if (acc + d >= m) { const u = d ? (m - acc) / d : 0; return [c[i - 1][0] + u * (c[i][0] - c[i - 1][0]), c[i - 1][1] + u * (c[i][1] - c[i - 1][1])]; } acc += d; } return c[c.length - 1]; }

  // ---------- data ----------
  const NM = { 'Armilla': 'armilla', 'Churriana de la Vega': 'churriana', 'Las Gabias': 'gabias', 'Alhendín': 'alhendin', 'Ogíjares': 'ogijares', 'Granada': 'granada' };
  const nmL = (nm) => NM[nm] ? t('x33.nm.' + NM[nm]) : nm; // the five towns and Granada in the visitor's language; the others as written
  const ROUTE = { churriana_alhendin: { key: 'A', a: 'Churriana de la Vega', b: 'Alhendín' }, gabias_ogijares: { key: 'B', a: 'Las Gabias', b: 'Ogíjares' } };
  function load() {
    if (S.loading) return S.loading;
    const D = GA.data;
    S.loading = Promise.all(['base_edge', 'tour_area', 'south_metro', 'tram_1931', 'admin', 'tour_towns'].map(n => D.single(n).catch(() => null))).then(([edge, area, metro, tram, admin, tt]) => {
      const base = edge.features.find(f => f.properties.k === 'base');
      const byName = {}; area.features.forEach(f => { byName[f.properties.name] = f.properties; });
      const shapes = {}; ((tt && tt.features) || []).forEach(f => { shapes[f.properties.nm] = f; });
      const townPts = edge.features.filter(f => f.properties.k === 'town');
      const towns = townPts.filter(f => shapes[f.properties.nm]).map(f => { const m = byName[f.properties.nm] || {}; const sh = shapes[f.properties.nm];
        return { type: 'Feature', properties: { nm: f.properties.nm, pop: m.pop2025, pop15: m.pop2015, chg: m.chg, ha: sh.properties.area_ha, lp: polylabel(ringsOf(sh.geometry)) }, geometry: sh.geometry }; });
      const townList = townPts.map(f => { const m = byName[f.properties.nm] || {}; return { nm: f.properties.nm, pop: m.pop2025, chg: m.chg, shape: !!shapes[f.properties.nm] }; });
      const ring = base.geometry.type === 'Polygon' ? base.geometry.coordinates[0] : base.geometry.coordinates[0][0];
      const track = metro && metro.features.find(f => f.properties.k === 'track');
      let metroGap = null; if (track) { metroGap = Infinity; track.geometry.coordinates.forEach(p => { for (let i = 1; i < ring.length; i++) metroGap = Math.min(metroGap, distM(p, ring[i - 1], ring[i])); }); }
      const barrios = admin ? { type: 'FeatureCollection', features: admin.features.filter(f => f.properties.kind === 'barrio') } : null;
      // routes: the walking line, its straight line, its start/end points (with the route key A/B for paint filters)
      const routes = edge.features.filter(f => f.properties.k === 'route').map(f => Object.assign({}, f.properties, { key: ROUTE[f.properties.r].key, coords: f.geometry.coordinates }));
      const rfs = []; edge.features.forEach(f => { const p = f.properties; if ((p.k === 'route' || p.k === 'straight') && ROUTE[p.r]) rfs.push({ type: 'Feature', properties: { k: p.k, rk: ROUTE[p.r].key }, geometry: f.geometry }); });
      routes.forEach(r => { const c = r.coords; [[c[0], 'a'], [c[c.length - 1], 'b']].forEach(([pt, e]) => rfs.push({ type: 'Feature', properties: { k: 'end', rk: r.key, e }, geometry: { type: 'Point', coordinates: pt } })); });
      const dead = edge.features.filter(f => f.properties.k === 'deadend').map(f => f.geometry.coordinates);
      area.features.forEach(f => { f.properties.lp = polylabel(ringsOf(f.geometry)); });
      const rails = RI() ? RI().points(metro, tram) : { type: 'FeatureCollection', features: [] };
      const fiveBB = bboxOf([base.geometry].concat(towns.map(f => f.geometry)));
      S.D = { edge, area, metro, tram, barrios, base, towns: { type: 'FeatureCollection', features: towns }, townList, routes, routeFC: { type: 'FeatureCollection', features: rfs }, dead, rails, metroGap, byName,
        bb: { 1: bboxOf([base.geometry]), 2: grow(fiveBB, 0.002), streets: bboxOf([base.geometry].concat(routes.map(r => ({ coordinates: r.coords })))), rail: bboxOf([base.geometry].concat(track ? [track.geometry] : [], tram ? tram.features.filter(f => f.geometry.type === 'LineString').map(f => f.geometry) : [])), 3: bboxOf(area.features.map(f => f.geometry)), barrio: barrios && barrios.features.length ? bboxOf(barrios.features.map(f => f.geometry)) : null } };
      return S.D;
    });
    S.loading = S.loading.catch(e => { console.error(e); S.loading = null; throw e; }); return S.loading;
  }

  // ---------- classes (map paint, labels and legends read the same breaks and colours) ----------
  function stepExpr(prop, breaks, cols) { const e = ['step', ['get', prop], cols[0]]; breaks.forEach((b, i) => e.push(b, cols[i + 1])); return ['case', ['==', ['typeof', ['get', prop]], 'number'], e, T.missing]; }
  function classLabels(breaks, fmt, unit) { const out = []; out.push('< ' + fmt(breaks[0]) + unit); for (let i = 1; i < breaks.length; i++) out.push(fmt(breaks[i - 1]) + '–' + fmt(breaks[i]) + unit); out.push('≥ ' + fmt(breaks[breaks.length - 1]) + unit); return out; }
  const CLS = {
    chg: () => ({ cols: T.chg, labels: classLabels(T.chgBreaks, (v) => (v < 0 ? '−' : '') + nf(Math.abs(v)), ' %') }),
    inc: () => ({ cols: T.inc, labels: classLabels(T.incBreaks, (v) => '€' + nf(v), '') }),
    rent: () => ({ cols: T.rent, labels: classLabels(T.rentBreaks, (v) => nf(v), '') }),
  };
  const METRIC = ['chg', 'inc', 'rent'];
  const valTxt = (key, p) => { const v = p[key]; if (v == null || !isFinite(v)) return null; return key === 'chg' ? pctTxt(v) : key === 'inc' ? '€' + nf(v) : nf(v, 1); };
  const yearOf = (key, p) => key === 'chg' ? '2015–2025' : key === 'inc' ? p.incYear : p.rentYear;
  const srcOf = (key) => ({ chg: 'INE, table 2871', inc: 'INE ADRH, table 31025', rent: 'INE IPVA, table 59060' })[key];
  const swFill = (c, l, extra) => `<li><i class="sw" style="background:${c}${extra || ''}"></i><span>${l}</span></li>`;
  const swLine = (c, w, l, dash) => `<li><i class="sw ln" style="border-top:${w}px ${dash ? 'dashed' : 'solid'} ${c}"></i><span>${l}</span></li>`;
  const swCased = (c, l) => `<li><i class="sw ln" style="border-top:4px solid ${c};box-shadow:0 0 0 2px ${T.routeCase}, 0 0 0 3px rgba(41,16,12,.18)"></i><span>${l}</span></li>`;
  const swEnd = (c, l) => `<li><i class="sw dot" style="background:${T.routeCase};width:11px;height:11px;border:2.5px solid ${c}"></i><span>${l}</span></li>`;

  // the dead-end road sign (blue plate, white upright, red cross-bar at its end): one SVG for the map and the legend
  const signSVG = () => `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 18 18"><rect x="1" y="1" width="16" height="16" rx="2.4" fill="${T.sign.plate}" stroke="#FFFFFF" stroke-width="1.6"/><rect x="7.6" y="6.6" width="2.8" height="8.4" fill="${T.sign.bar}"/><rect x="4.2" y="3.6" width="9.6" height="3" fill="${T.sign.stop}"/></svg>`;
  const signURL = () => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(signSVG());
  // the direction arrow along a route (a chevron in the route's colour with a white edge)
  function arrowImage(col) { const n = 32, cv = document.createElement('canvas'); cv.width = n; cv.height = n; const g = cv.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round'; const path = () => { g.beginPath(); g.moveTo(10, 7); g.lineTo(22, 16); g.lineTo(10, 25); };
    path(); g.strokeStyle = '#FFFFFF'; g.lineWidth = 8; g.stroke(); path(); g.strokeStyle = col; g.lineWidth = 4; g.stroke(); return g.getImageData(0, 0, n, n); }

  // ---------- map layers ----------
  const ID = (k) => 'tour-' + k;
  const GROUPS = {
    veil: ['veil'], base: ['base-fill', 'base-line'], towns: ['towns-fill', 'towns-line'], fence: ['fence'],
    routeA: ['straightA', 'routeA-case', 'routeA', 'arrowA', 'endsA'], routeB: ['straightB', 'routeB-case', 'routeB', 'arrowB', 'endsB'],
    band: ['band', 'bandlu', 'band-line'], metro: ['metro-case', 'metro'], tram: ['tram'], rail: ['rail'],
    chg: ['chg'], inc: ['inc'], rent: ['rent'], muniLine: ['muni-line'], five: ['five'], barrio: ['barrio', 'barrio-lbl'],
  };
  const VIS = {
    0: [[]],
    1: [['veil', 'base']],
    2: [['veil', 'towns', 'base'], ['veil', 'base', 'fence'],
      ['veil', 'towns', 'base', 'tram', 'metro', 'rail', 'routeA'], ['veil', 'towns', 'base', 'tram', 'metro', 'rail', 'routeB'], ['veil', 'towns', 'base', 'tram', 'metro', 'rail', 'routeA', 'routeB'],
      ['veil', 'band', 'base'], ['veil', 'base', 'tram', 'metro', 'rail']],
    3: [['veil', 'chg', 'muniLine', 'five'], ['veil', 'inc', 'muniLine', 'five'], ['veil', 'rent', 'muniLine', 'five'], ['veil', 'barrio']],
  };
  const ORDER = ['veil', 'chg', 'inc', 'rent', 'muni-line', 'five', 'barrio', 'band', 'bandlu', 'band-line', 'towns-fill', 'towns-line', 'base-fill', 'base-line', 'fence', 'tram', 'metro-case', 'metro',
    'straightA', 'straightB', 'routeA-case', 'routeB-case', 'routeA', 'routeB', 'arrowA', 'arrowB', 'endsA', 'endsB', 'rail', 'barrio-lbl'];
  // opacity of the layers that fade to T.fade on the streets slides (paint property, full value)
  const FADE = { 'towns-fill': ['fill-opacity', T.townFillAlpha], 'towns-line': ['line-opacity', 1], 'metro-case': ['line-opacity', 1], metro: ['line-opacity', 1], tram: ['line-opacity', 1], rail: ['icon-opacity', 1] };
  function build() {
    if (S.built || !map || !S.D) return; const D = S.D; const src = (k, data) => { if (!map.getSource(ID(k))) map.addSource(ID(k), { type: 'geojson', data }); };
    const fc = (fs) => ({ type: 'FeatureCollection', features: fs });
    src('world', fc([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-10, 34], [2, 34], [2, 41], [-10, 41], [-10, 34]]] } }]));
    src('edge', D.edge); src('towns', D.towns); src('area', D.area); src('routes', D.routeFC); src('rails', D.rails);
    src('metro', D.metro || fc([])); src('tram', D.tram || fc([])); src('barrio', D.barrios || fc([])); src('barrio-l', D.barrios || fc([]));
    [['A', T.routeA], ['B', T.routeB]].forEach(([k, c]) => { const id = 'tour-arrow-' + k; if (!map.hasImage(id)) map.addImage(id, arrowImage(c), { pixelRatio: 2 }); });
    if (RI()) RI().ensure(map).catch(() => { });
    const k = (v) => ['==', ['get', 'k'], v]; const lay = (o) => { if (!map.getLayer(o.id)) map.addLayer(Object.assign({ layout: {} }, o, { layout: Object.assign({ visibility: 'none' }, o.layout || {}) })); };
    const rk = (key, kind) => ['all', ['==', ['get', 'rk'], key], ['==', ['get', 'k'], kind]];
    const F = T.fence;
    const choro = (prop) => ({ type: 'fill', source: ID('area'), paint: { 'fill-color': stepExpr(prop, T[prop + 'Breaks'], T[prop]), 'fill-opacity': ['case', ['==', ['typeof', ['get', prop]], 'number'], T.choroAlpha, T.choroAlpha * 0.6] } });
    const defs = {
      veil: { type: 'fill', source: ID('world'), paint: { 'fill-color': T.veil, 'fill-opacity': 0.62 } },
      chg: choro('chg'), inc: choro('inc'), rent: choro('rent'),
      'muni-line': { type: 'line', source: ID('area'), paint: { 'line-color': T.muniLight, 'line-width': 1.1, 'line-opacity': 0.95 } },
      five: { type: 'line', source: ID('area'), filter: ['==', ['get', 'five'], true], paint: { 'line-color': T.five, 'line-width': 2.4 } },
      barrio: { type: 'line', source: ID('barrio'), paint: { 'line-color': T.barrio, 'line-width': 1.6 } },
      'barrio-lbl': { type: 'symbol', source: ID('barrio-l'), layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-max-width': 8 }, paint: { 'text-color': T.label, 'text-halo-color': P.ui.white, 'text-halo-width': 1.5 } },
      band: { type: 'fill', source: ID('edge'), filter: k('band'), paint: { 'fill-color': T.band, 'fill-opacity': 0.55 } },
      bandlu: { type: 'fill', source: ID('edge'), filter: k('bandlu'), paint: { 'fill-color': ['match', ['get', 'c'], 'residential', T.bandlu.residential, 'industrial', T.bandlu.industrial, 'green', T.bandlu.green, 'agri', T.bandlu.agri, T.bandlu.construction], 'fill-opacity': 0.75 } },
      'band-line': { type: 'line', source: ID('edge'), filter: k('band'), paint: { 'line-color': T.bandLine, 'line-width': 1.4, 'line-dasharray': [3, 2] } },
      'towns-fill': { type: 'fill', source: ID('towns'), paint: { 'fill-color': T.townFill, 'fill-opacity': T.townFillAlpha } },
      'towns-line': { type: 'line', source: ID('towns'), paint: { 'line-color': T.townEdge, 'line-width': 1.2, 'line-opacity': 1 } },
      'base-fill': { type: 'fill', source: ID('edge'), filter: k('base'), paint: { 'fill-color': T.baseFill, 'fill-opacity': 0.14 } },
      'base-line': { type: 'line', source: ID('edge'), filter: k('base'), paint: { 'line-color': T.baseLine, 'line-width': 2.6 } },
      fence: { type: 'line', source: ID('edge'), filter: k('fence'), layout: { 'line-cap': 'butt' }, paint: { 'line-color': ['match', ['get', 'c'], 'housing', F.housing, 'open', F.open, 'road', F.road, 'green', F.green, F.industry], 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 9] } },
      tram: { type: 'line', source: ID('tram'), filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': P.south.tram, 'line-width': 2.6, 'line-dasharray': [2, 1.5], 'line-opacity': 1 } },
      'metro-case': { type: 'line', source: ID('metro'), filter: k('track'), layout: { 'line-cap': 'round' }, paint: { 'line-color': P.south.metroCasing, 'line-width': 6, 'line-opacity': 1 } },
      metro: { type: 'line', source: ID('metro'), filter: k('track'), layout: { 'line-cap': 'round' }, paint: { 'line-color': P.south.metro, 'line-width': 3.2, 'line-opacity': 1 } },
      rail: { type: 'symbol', source: ID('rails'), layout: RI() ? RI().layout() : {}, paint: { 'icon-opacity': 1 } },
      straightA: { type: 'line', source: ID('routes'), filter: rk('A', 'straight'), paint: { 'line-color': T.routeA, 'line-width': 1.6, 'line-dasharray': [3, 2.5] } },
      straightB: { type: 'line', source: ID('routes'), filter: rk('B', 'straight'), paint: { 'line-color': T.routeB, 'line-width': 1.6, 'line-dasharray': [3, 2.5] } },
      'routeA-case': { type: 'line', source: ID('routes'), filter: rk('A', 'route'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': T.routeCase, 'line-width': 7.5 } },
      'routeB-case': { type: 'line', source: ID('routes'), filter: rk('B', 'route'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': T.routeCase, 'line-width': 7.5 } },
      routeA: { type: 'line', source: ID('routes'), filter: rk('A', 'route'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': T.routeA, 'line-width': 4 } },
      routeB: { type: 'line', source: ID('routes'), filter: rk('B', 'route'), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': T.routeB, 'line-width': 4 } },
      arrowA: { type: 'symbol', source: ID('routes'), filter: rk('A', 'route'), layout: { 'symbol-placement': 'line', 'symbol-spacing': 70, 'icon-image': 'tour-arrow-A', 'icon-size': 0.8, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' } },
      arrowB: { type: 'symbol', source: ID('routes'), filter: rk('B', 'route'), layout: { 'symbol-placement': 'line', 'symbol-spacing': 70, 'icon-image': 'tour-arrow-B', 'icon-size': 0.8, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map' } },
      endsA: { type: 'circle', source: ID('routes'), filter: rk('A', 'end'), paint: { 'circle-radius': 6.5, 'circle-color': T.routeCase, 'circle-stroke-color': T.routeA, 'circle-stroke-width': 3 } },
      endsB: { type: 'circle', source: ID('routes'), filter: rk('B', 'end'), paint: { 'circle-radius': 6.5, 'circle-color': T.routeCase, 'circle-stroke-color': T.routeB, 'circle-stroke-width': 3 } },
    };
    ORDER.forEach(n => lay(Object.assign({ id: ID(n) }, defs[n])));
    S.built = true;
  }
  function unbuild() {
    clearLabels(); if (!map || !map.style) return; ORDER.forEach(n => { if (map.getLayer(ID(n))) map.removeLayer(ID(n)); });
    ['world', 'edge', 'towns', 'area', 'routes', 'rails', 'metro', 'tram', 'barrio', 'barrio-l'].forEach(n => { if (map.getSource(ID(n))) map.removeSource(ID(n)); });
    S.built = false;
  }
  function raise() { // keep the tour layers on top of everything else, in ORDER (the atlas keeps its own below them)
    if (!S.built || !map || !map.style) return; const ids = map.getStyle().layers.map(l => l.id); const want = ORDER.map(ID).filter(id => ids.includes(id));
    if (JSON.stringify(ids.slice(ids.length - want.length)) !== JSON.stringify(want)) want.forEach(id => map.moveLayer(id)); }
  const streets = () => S.step === 2 && STREETS.includes(S.layer);
  function showGroups(groups) {
    if (!S.built) return; const on = new Set(); groups.forEach(g => GROUPS[g].forEach(n => on.add(ID(n))));
    ORDER.forEach(n => { const id = ID(n); if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on.has(id) ? 'visible' : 'none'); });
    const f = streets() ? T.fade : 1; Object.keys(FADE).forEach(n => { const id = ID(n); if (map.getLayer(id)) map.setPaintProperty(id, FADE[n][0], FADE[n][1] * f); });
    raise();
  }

  // ---------- labels and signs over the map (HTML) ----------
  function overlay() { let o = $('#tour-lbls'); if (!o) { const st = $('.stage'); if (!st) return null; o = document.createElement('div'); o.id = 'tour-lbls'; o.className = 'tour-lbls'; o.setAttribute('aria-hidden', 'true'); st.appendChild(o); } return o; }
  function clearLabels() { S.items = []; S.placed = []; const o = $('#tour-lbls'); if (o) o.innerHTML = ''; }
  // the items of the current slide: { id, ll, html, alt (shorter html), cls, color, prio, poly (rings to keep the label point inside) }
  function itemsFor(step, layer) {
    const D = S.D; if (!D) return [];
    const out = [];
    if (step === 2 && layer === 1) D.towns.features.forEach(f => out.push({ id: 'town-' + f.properties.nm, ll: f.properties.lp, html: `<span dir="auto">${esc(nmL(f.properties.nm))}</span>`, cls: 'town', prio: 1 }));
    if (step === 2 && STREETS.includes(layer)) {
      const keys = layer === 3 ? ['A'] : layer === 4 ? ['B'] : ['A', 'B'];
      D.routes.filter(r => keys.includes(r.key)).forEach(r => { const R = ROUTE[r.r], col = r.key === 'A' ? T.routeA : T.routeB, c = r.coords;
        out.push({ id: 'rt-' + r.key, ll: along(c, lenM(c) * 0.5), html: `<span style="color:${col}">${r.key}</span> · <span>${t('x33.rtLbl', { w: L(nf(r.walk_m / 1000, 1)), s: L(nf(r.straight_m / 1000, 1)), r: L(nf(r.ratio, 2)) })}</span>`, cls: 'rt', color: col, prio: 0, avoidAnchor: true });
        out.push({ id: 'end-a-' + r.key, ll: c[0], html: `<span dir="auto">${esc(nmL(R.a))}</span>`, cls: 'end', prio: 0, avoidAnchor: true });
        out.push({ id: 'end-b-' + r.key, ll: c[c.length - 1], html: `<span dir="auto">${esc(nmL(R.b))}</span>`, cls: 'end', prio: 0, avoidAnchor: true }); });
    }
    if (step === 3 && layer <= 3) { const key = METRIC[layer - 1];
      D.area.features.forEach(f => { const p = f.properties, v = valTxt(key, p);
        const val = v == null ? `<span class="v miss">${esc(t('x33.miss.' + key))}</span>` : `<span class="v" dir="ltr">${esc(v)}</span>`;
        out.push({ id: 'm-' + p.ine, ll: p.lp, html: `<b dir="auto">${esc(nmL(p.name))}</b>${val}`, alt: val, cls: 'muni' + (p.five ? ' five' : ''), prio: p.five || p.name === 'Granada' ? 1 : 2, ring: ringsOf(f.geometry)[0] }); }); }
    return out;
  }
  function renderLabels() {
    const o = overlay(); if (!o) return; o.innerHTML = '<svg class="tour-lead-svg"></svg>'; S.placed = [];
    S.items = S.on && S.D ? itemsFor(S.step, S.layer) : [];
    S.items.forEach(it => { const el = document.createElement('div'); el.className = 'tour-lbl ' + it.cls; el.dataset.id = it.id; if (it.color) el.style.color = it.color; el.innerHTML = it.html; o.appendChild(el); it.el = el;
      it.w = el.offsetWidth; it.h = el.offsetHeight; if (it.alt) { el.innerHTML = it.alt; it.wAlt = el.offsetWidth; it.hAlt = el.offsetHeight; el.innerHTML = it.html; } });
    S.signs = S.on && S.D && streets() ? S.D.dead : [];
    if (GA.ltrNumsDOM) GA.ltrNumsDOM(o);
    place();
  }
  // overlays the labels must not cover, in the stage's coordinates
  function obstacles() { const st = $('.stage'); if (!st) return []; const s = st.getBoundingClientRect(); const out = [];
    ['#tour-card', '.maplibregl-ctrl-top-right', '.maplibregl-ctrl-bottom-right', '.maplibregl-ctrl-bottom-left', '#atl-topics'].forEach(q => { document.querySelectorAll(q).forEach(e => { if (!e.offsetWidth || e.hidden || getComputedStyle(e).display === 'none') return; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      out.push({ l: r.left - s.left - 4, t: r.top - s.top - 4, r: r.right - s.left + 4, b: r.bottom - s.top + 4 }); }); }); return out; }
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const overlapArea = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  function inRing(pt, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }
  let raf = 0; const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; place(); }); };
  function place() {
    const o = $('#tour-lbls'); if (!o || !map) return; const W = o.clientWidth, H = o.clientHeight; const svg = o.querySelector('svg'); let lines = '';
    const obs = obstacles(); const taken = []; S.placed = [];
    // 1. the dead-end signs: grouped when closer than 20 px, never hidden
    o.querySelectorAll('.tour-sign').forEach(e => e.remove());
    const groups = []; (S.signs || []).forEach(ll => { const p = map.project(ll); const g = groups.find(q => Math.hypot(q.x - p.x, q.y - p.y) < 20); if (g) { g.x = (g.x * g.n + p.x) / (g.n + 1); g.y = (g.y * g.n + p.y) / (g.n + 1); g.n++; } else groups.push({ x: p.x, y: p.y, n: 1 }); });
    groups.forEach(g => { const e = document.createElement('div'); e.className = 'tour-sign'; e.dataset.n = g.n; e.innerHTML = `<img src="${signURL()}" width="18" height="18" alt="">${g.n > 1 ? `<i dir="ltr">${g.n}</i>` : ''}`; e.style.transform = `translate(${Math.round(g.x - 9)}px, ${Math.round(g.y - 9)}px)`; o.appendChild(e);
      taken.push({ l: g.x - 11, t: g.y - (g.n > 1 ? 18 : 11), r: g.x + (g.n > 1 ? 20 : 11), b: g.y + 11 }); });
    // 2. labels: priority, then smaller polygons first (they have the least room); each takes the nearest free spot
    const items = S.items.slice();
    items.forEach(it => { if (it.ring) { const b = bboxOf([{ coordinates: it.ring }]); const p0 = map.project(b[0]), p1 = map.project(b[1]); it.areaPx = Math.abs((p1.x - p0.x) * (p1.y - p0.y)); } });
    items.sort((x, y) => (x.prio - y.prio) || ((x.areaPx || 0) - (y.areaPx || 0)));
    const DIRS = []; for (let r = 1; r <= 9; r++) for (let k = 0; k < 12; k++) { const an = k * Math.PI / 6 + (r % 2 ? 0 : Math.PI / 12); DIRS.push([Math.cos(an) * r * 13, Math.sin(an) * r * 11]); }
    items.forEach(it => {
      const p = map.project(it.ll); const tries = [[it.w, it.h, false]]; if (it.alt) tries.push([it.wAlt, it.hAlt, true]);
      const offs = (it.avoidAnchor ? [] : [[0, 0]]).concat(it.avoidAnchor ? DIRS.map(([dx, dy]) => [dx * 1.25, dy * 1.35]) : DIRS);
      let pick = null, best = null;
      for (const [w, h, short] of tries) {
        for (const [dx, dy] of offs) { const box = { l: p.x + dx - w / 2, t: p.y + dy - h / 2, r: p.x + dx + w / 2, b: p.y + dy + h / 2 };
          const inside = box.l >= 2 && box.t >= 2 && box.r <= W - 2 && box.b <= H - 2;
          const cost = obs.concat(taken).reduce((s, q) => s + overlapArea(box, q), 0) + (inside ? 0 : 1e6);
          if (!best || cost < best.cost) best = { box, short, cost };
          if (inside && !cost) { pick = { box, short }; break; } }
        if (pick) break;
      }
      if (!pick) pick = best; // never hidden: the least crowded spot
      const { box, short } = pick; it.el.innerHTML = short ? it.alt : it.html; it.el.classList.toggle('short', !!short);
      it.el.style.transform = `translate(${Math.round(box.l)}px, ${Math.round(box.t)}px)`; taken.push(box);
      const anchorIn = p.x >= box.l && p.x <= box.r && p.y >= box.t && p.y <= box.b;
      S.placed.push({ id: it.id, box, anchor: [p.x, p.y], short: !!short, leader: !anchorIn, forced: pick.cost > 0 });
      if (!anchorIn) { const qx = Math.max(box.l, Math.min(p.x, box.r)), qy = Math.max(box.t, Math.min(p.y, box.b)); const col = it.color || P.ink;
        lines += `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${qx.toFixed(1)}" y2="${qy.toFixed(1)}" stroke="#FFFFFF" stroke-width="3"/><line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${qx.toFixed(1)}" y2="${qy.toFixed(1)}" stroke="${col}" stroke-width="1.1"/>`
          + (it.cls.indexOf('end') === 0 || it.cls.indexOf('rt') === 0 ? '' : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="${col}" stroke="#FFFFFF" stroke-width="1"/>`); }
    });
    if (svg) svg.innerHTML = lines;
  }

  // ---------- popups (the tour's own; the atlas popups stay off while the tour runs) ----------
  let pop = null;
  function popupAt(e) {
    if (!S.on || !S.built || !map) return false; const L2 = (ids) => ids.map(ID).filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') === 'visible');
    const one = (ids) => { const ls = L2(ids); return ls.length ? map.queryRenderedFeatures(e.point, { layers: ls })[0] : null; };
    let html = null;
    if (S.step === 3 && S.layer <= 3) { const f = one([METRIC[S.layer - 1]]); if (f) { const key = METRIC[S.layer - 1], p = f.properties, v = valTxt(key, p);
      html = `<b dir="auto">${esc(nmL(p.name))}</b><table><tr><td>${t('x33.val.' + key)}</td><td>${v == null ? `<em>${esc(t('tour.missing'))} — ${esc(t('x33.miss.' + key))}</em>` : L(esc(v))}</td></tr><tr><td>${t('x33.year')}</td><td>${L(esc(yearOf(key, p) || '—'))}</td></tr><tr><td>${t('tour.src')}</td><td dir="ltr">${esc(srcOf(key))}</td></tr></table>`; } }
    if (S.step === 2) { const f = one(['towns-fill']); if (f) { const p = f.properties;
      html = `<b dir="auto">${esc(nmL(p.nm))}</b><table><tr><td>${t('x33.pop')}</td><td>${L(nf(p.pop))}</td></tr><tr><td>${t('x33.chg')}</td><td>${pct(p.chg)}</td></tr><tr><td>${t('x33.area')}</td><td>${L(nf(p.ha, 1) + ' ha')}</td></tr></table><small>${t('x33.s2.l1src')}</small>`; } }
    if (!html) return false;
    if (pop) pop.remove(); pop = new maplibregl.Popup({ className: 'atlas-popup tour-pop', offset: 8, maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(GA.ltrNums ? GA.ltrNums(html) : html).addTo(map);
    return true;
  }
  const closePop = () => { if (pop) { pop.remove(); pop = null; } };

  // ---------- card ----------
  const TITLE = { 2: ['tour.s2.l1', 'tour.s2.l2', 'x33.s2.rA', 'x33.s2.rB', 'x33.s2.rAB', 'tour.s2.l4', 'tour.s2.l5'], 3: ['tour.s3.l1', 'tour.s3.l2', 'tour.s3.l3', 'tour.s3.l4'] };
  const railLg = () => RI() ? `<li>${RI().legendImg('metro')}<span>${t('x33.icMetro')}</span></li><li>${RI().legendImg('tram')}<span>${t('x33.icTram')}</span></li>` : '';
  function legendHTML(step, layer) {
    const D = S.D; if (!D) return '';
    const townSw = swFill(T.townFill, t('x33.lgTown'), `;opacity:1;background:${T.townFill}55;border:1.2px solid ${T.townEdge}`);
    if (step === 1) return `<ul class="lg">${swFill(T.baseFill, t('tour.lgBase'), `;opacity:.45;border:2.5px solid ${T.baseLine}`)}</ul>`;
    if (step === 2) {
      if (layer === 1) return `<ul class="lg">${townSw}${swFill(T.baseFill, t('tour.lgBase'), `;opacity:.45;border:2.5px solid ${T.baseLine}`)}</ul>`;
      if (layer === 2) { const st = D.edge.stats; const order = Object.keys(T.fence).sort((x, y) => (st.fence_m[y] || 0) - (st.fence_m[x] || 0));
        return `<ul class="lg">${order.map(c => `<li><i class="sw ln" style="border-top:6px solid ${T.fence[c]}"></i><span>${t('tour.s2.c.' + c)} · ${L(nf((st.fence_m[c] || 0) / 1000, 1) + ' km')} · ${L(nf((st.fence_share[c] || 0) * 100) + ' %')}</span></li>`).join('')}</ul><p class="fine">${t('tour.s2.l2note')}</p>`; }
      if (STREETS.includes(layer)) { const keys = layer === 3 ? ['A'] : layer === 4 ? ['B'] : ['A', 'B'];
        return `<ul class="lg"><li><img class="tour-sign-sw" src="${signURL()}" alt=""><span>${t('x33.lgDead', { n: D.dead.length })}</span></li>${keys.map(k => { const c = k === 'A' ? T.routeA : T.routeB; return swCased(c, t('x33.lgRoute' + k)) + swLine(c, 2, t('x33.lgStraight' + k), true) + swEnd(c, t('x33.lgEnds')); }).join('')}</ul><p class="fine">${t('x33.fade')}</p>`; }
      if (layer === 6) { const lu = D.edge.stats.band_landuse_ha; return `<ul class="lg">${swFill(T.band, t('tour.s2.lgBand'), `;border:1.5px dashed ${T.bandLine}`)}${Object.keys(T.bandlu).filter(c => lu[c]).map(c => swFill(T.bandlu[c], `${t('tour.s2.lu.' + c)} · ${L(nf(lu[c], 1) + ' ha')}`)).join('')}</ul>`; }
      return `<ul class="lg">${swLine(P.south.metro, 4, t('tour.lgMetro'))}${swLine(P.south.tram, 3, t('tour.lgTram'), true)}${railLg()}${swFill(T.baseFill, t('tour.lgBase'), `;opacity:.5;border:2px solid ${T.baseLine}`)}</ul>`;
    }
    const fiveSw = swLine(T.five, 3, t('tour.lgFive'));
    if (layer <= 3) { const key = METRIC[layer - 1]; const c = CLS[key]();
      return `<ul class="lg">${c.cols.map((col, i) => swFill(col, L(c.labels[i]), `;opacity:${T.choroAlpha}`)).join('')}${key === 'rent' ? swFill(T.missing, t('tour.s3.noIdx'), `;opacity:${T.choroAlpha * 0.6}`) : ''}${fiveSw}</ul>`; }
    return `<ul class="lg">${swLine(T.barrio, 2, t('tour.s3.lgBarrio'))}</ul>`;
  }
  function bodyHTML(step, layer) {
    const D = S.D; if (!D) return ''; const st = D.edge.stats; const A = D.area.stats;
    if (step === 1) return `<ul class="tour-facts"><li><b>${t('tour.s1.area', { ha: nf(st.area_ha) })}</b></li><li>${t('tour.s1.since')}</li><li>${t('tour.s1.ala')}</li><li>${t('tour.s1.fence', { km: nf(st.perimeter_km, 1) })}</li></ul>`;
    if (step === 2) {
      if (layer === 1) return `<p>${t('x33.s2.l1t', { n: nf(A.five.pop2025) })}</p><ul class="tour-towns">${D.townList.map(r => `<li><span dir="auto">${esc(nmL(r.nm))}</span><span>${L(nf(r.pop))} · ${pct(r.chg)}${r.shape ? '' : ` · <em>${esc(t('x33.noShape'))}</em>`}</span></li>`).join('')}</ul>`;
      if (layer === 2) return `<p>${t('tour.s2.l2t')}</p>`;
      if (STREETS.includes(layer)) { const keys = layer === 3 ? ['A'] : layer === 4 ? ['B'] : ['A', 'B'];
        return `<p>${t('tour.s2.l3t', { n: st.deadends })}</p><ul class="tour-facts">${D.routes.filter(r => keys.includes(r.key)).map(r => `<li><b>${r.key}</b> · ${t('tour.s2.route', { a: nmL(ROUTE[r.r].a), b: nmL(ROUTE[r.r].b), w: nf(r.walk_m / 1000, 1), s: nf(r.straight_m / 1000, 1), r: nf(r.ratio, 2) })}</li>`).join('')}</ul>`; }
      if (layer === 6) return `<p>${t('tour.s2.l4t', { ha: nf(st.band_ha) })}</p>`;
      return `<p>${t('tour.s2.l5t', { m: D.metroGap == null ? '—' : nf(Math.round(D.metroGap / 5) * 5) })}</p>`;
    }
    const g = D.byName.Granada, lg = D.byName['Las Gabias'], ch = D.byName['Churriana de la Vega'];
    const lead = layer <= 2 ? `<p class="tour-lead">${t('tour.s3.card', { a: pct(A.five.chg), b: pct(A.rest.chg), c: pct(A.city.chg), y: g.incYear, g: eur(g.inc), lg: eur(lg.inc), ch: eur(ch.inc) })}</p>` : '';
    const rentY = (D.area.features.find(f => f.properties.rentYear) || { properties: {} }).properties.rentYear;
    const txt = [t('tour.s3.l1t'), t('tour.s3.l2t', { y: g.incYear }), `${t('tour.s3.l3t', { y: rentY, n: A.rentCovered, N: A.n })}</p><p class="tour-miss"><b>${t('tour.missing')}:</b> ${t('tour.s3.l3miss')}`,
      `${t('tour.s3.l4t', { n: D.barrios ? D.barrios.features.length : 0 })}</p><p class="tour-miss"><b>${t('tour.missing')}:</b> ${t('tour.s3.l4miss')}`][layer - 1];
    return lead + `<p>${txt}</p>` + (layer <= 3 ? `<p class="fine">${t('x33.s3.click')}</p>` : '');
  }
  function srcHTML(step, layer) {
    if (step === 1) return t('tour.s1.srcTxt');
    if (step === 2) return [t('x33.s2.l1src'), 'OpenStreetMap (ODbL) · tools/build_base_edge.py', 'OpenStreetMap (ODbL) · tools/build_base_edge.py', 'OpenStreetMap (ODbL) · tools/build_base_edge.py', 'OpenStreetMap (ODbL) · tools/build_base_edge.py', 'OpenStreetMap (ODbL) · BOE 1981', 'OpenStreetMap (ODbL) · © IGN MTN50 (1931), CC BY 4.0'][layer - 1];
    return [t('tour.s2.l1src'), 'INE ADRH (31025)', 'INE IPVA (59060)', 'OpenStreetMap (ODbL)'][layer - 1] + '. ' + t('tour.s3.area', { n: S.D.area.stats.n });
  }
  function renderCard() {
    const c = $('#tour-card'); if (!c) return; const { step, layer } = S; c.hidden = !S.on || step === 0; if (c.hidden) return;
    const n = LAYERS[step]; const titles = step === 1 ? t('tour.s1.title') : t(TITLE[step][layer - 1]);
    const last = step === 3;
    c.innerHTML = `<div class="tour-c-h"><span class="tour-plate">${esc(t('tour.step', { i: step }))} · ${esc(t(`tour.s${step}.plate`))}</span>${n > 1 ? `<span class="tour-dots" role="img" aria-label="${esc(t('tour.layerOf', { i: layer, n }))}">${Array.from({ length: n }, (_, i) => `<i class="${i + 1 === layer ? 'on' : ''}" aria-hidden="true">${i + 1 === layer ? '●' : '○'}</i>`).join('')}</span>` : ''}</div>
      <h2 class="tour-c-t">${esc(titles)}</h2>
      <div class="tour-c-b">${S.D ? bodyHTML(step, layer) + legendHTML(step, layer) + `<p class="tour-src"><b>${t('tour.src')}:</b> ${srcHTML(step, layer)}</p>` : '<p class="fine">…</p>'}</div>
      <p class="tour-keys">${esc(t(step === 1 ? 'tour.k.s1' : last ? 'tour.k.last' : 'tour.k.layers'))}</p>
      <div class="tour-btns">
        <button type="button" class="btn btn-small" data-tour="back">${t('tour.back')}</button>
        ${n > 1 ? `<button type="button" class="btn btn-small" data-tour="prev" ${layer <= 1 ? 'disabled' : ''}>${t('tour.prevLayer')}</button><button type="button" class="btn btn-small" data-tour="layer" ${layer >= n ? 'disabled' : ''}>${t('tour.nextLayer')}</button>` : ''}
        <button type="button" class="btn btn-small btn-primary" data-tour="next">${t(last ? 'tour.finish' : 'tour.next')}</button>
        <button type="button" class="btn btn-small" data-tour="exit">${t('tour.exit')}</button>
      </div>`;
    c.dataset.step = step; c.dataset.layer = layer;
    if (GA.ltrNumsDOM) GA.ltrNumsDOM(c);
  }

  // ---------- view: fit each slide's feature into the free map area ----------
  // free area = the stage minus the tour card (side panel on wide screens, bottom sheet on phones), the top-right controls,
  // the attribution and the scale / north group; all measured, plus MARGIN
  function freeRect() {
    const st = $('.stage'); if (!st) return null; const s = st.getBoundingClientRect(); const f = { l: 0, t: 0, r: s.width, b: s.height };
    const rel = (e) => { if (!e || e.hidden || !e.offsetWidth || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top } : null; };
    const card = rel($('#tour-card'));
    if (card) { if (card.l <= 1 && card.r >= s.width - 1) f.b = Math.min(f.b, card.t); // phone: bottom sheet
      else if ((card.l + card.r) / 2 < s.width / 2) f.l = Math.max(f.l, card.r); else f.r = Math.min(f.r, card.l); } // the side by the card's centre
    const tr = rel($('.maplibregl-ctrl-top-right')); if (tr && tr.b > 0) f.t = Math.max(f.t, Math.min(tr.b, s.height / 3));
    const bars = [rel($('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib')), rel($('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale')), rel($('.maplibregl-ctrl-bottom-left .ga-north'))].filter(Boolean);
    bars.forEach(r => { if (r.t > s.height * 0.6) f.b = Math.min(f.b, r.t); }); // the bottom bars (lower part of the map only)
    return f;
  }
  function pad() {
    const st = $('.stage'); const s = st.getBoundingClientRect(); const f = freeRect() || { l: 0, t: 0, r: s.width, b: s.height };
    const m = Math.min(MARGIN, Math.max(16, Math.min(f.r - f.l, f.b - f.t) * 0.08));
    const p = { top: Math.round(f.t + m), bottom: Math.round(s.height - f.b + m), left: Math.round(f.l + m), right: Math.round(s.width - f.r + m) };
    const minW = 120, minH = 100; // keep a usable box even when the overlays take most of the screen
    if (s.width - p.left - p.right < minW) { const ex = minW - (s.width - p.left - p.right); p.left = Math.max(0, p.left - ex / 2); p.right = Math.max(0, p.right - ex / 2); }
    if (s.height - p.top - p.bottom < minH) { const ex = minH - (s.height - p.top - p.bottom); p.top = Math.max(0, p.top - ex / 2); p.bottom = Math.max(0, p.bottom - ex / 2); }
    return p;
  }
  // the feature each slide frames
  const viewKey = () => { if (S.step === 3 && S.layer === 4 && S.D && S.D.bb.barrio) return 'barrio'; if (S.step === 2 && streets()) return 'streets'; if (S.step === 2 && S.layer === 7) return 'rail'; return String(S.step); };
  let lastPad = null;
  function frame(instant) { if (!S.D || !map || !S.step) return; const k = viewKey(); S.view = k; const p = pad(); lastPad = p; map.stop(); map.fitBounds(S.D.bb[k], { padding: p, duration: instant || RM() ? 0 : 1600, essential: false }); }
  // refit when the card or the controls change size (debounced; only when the padding really changed)
  let refitT = 0; function refitSoon() { if (!S.on || !S.step) return; clearTimeout(refitT); refitT = setTimeout(() => { if (!S.on || !S.step) return; const p = pad(); if (!lastPad || ['top', 'bottom', 'left', 'right'].some(k => Math.abs(p[k] - lastPad[k]) > 6)) frame(); else schedule(); }, 160); }

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
  function hideTourUI() { document.body.classList.remove('tour-on'); const c = $('#tour-card'); if (c) c.hidden = true; closePop(); clearLabels(); if (map) showGroups([]); }
  function announce() { document.dispatchEvent(new CustomEvent('ga:tour', { detail: { step: S.step, layer: S.layer } })); }
  async function go(step, layer, instant) {
    hideIntro(); if (GA.panels) ['analysis', 'study'].forEach(k => GA.panels.isOpen(k) && GA.panels.set(k, false));
    const side = $('#atl-side'); if (side && !side.hidden) $('#atl-side-x') && $('#atl-side-x').click();
    S.on = true; closePop(); S.step = step; S.layer = Math.max(1, Math.min(LAYERS[step], layer || 1)); document.body.classList.add('tour-on'); setHash(); renderCard();
    try { await load(); } catch (e) { const c = $('#tour-card'); if (c) c.querySelector('.tour-c-b').innerHTML = `<p class="error">${esc(e.message || e)}</p>`; return; }
    if (!S.on || S.step !== step) return; await mapReady(); build(); renderCard(); showGroups(VIS[S.step][S.layer - 1]); frame(instant); renderLabels();
    announce();
  }
  function setLayer(d) { if (!S.on || LAYERS[S.step] < 2) return; const n = Math.max(1, Math.min(LAYERS[S.step], S.layer + d)); if (n === S.layer) return; S.layer = n; closePop(); setHash(); renderCard(); showGroups(VIS[S.step][S.layer - 1]); if (viewKey() !== S.view) frame(); else refitSoon(); renderLabels(); announce(); }
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
  function onCardClick(e) { const b = e.target.closest('[data-tour]'); if (!b) return; const a2 = b.dataset.tour; b.blur();
    if (a2 === 'next') next(); else if (a2 === 'layer') setLayer(1); else if (a2 === 'prev') setLayer(-1); else if (a2 === 'back') back(); else if (a2 === 'exit') exit(); }

  function init() {
    map = GA.app && GA.app.map;
    const st = $('.stage'); let c = $('#tour-card'); if (!c && st) { c = document.createElement('section'); c.id = 'tour-card'; c.className = 'tour-card'; c.hidden = true; c.setAttribute('aria-live', 'polite'); st.appendChild(c); }
    c && c.addEventListener('click', onCardClick);
    if (c && root.ResizeObserver) new ResizeObserver(() => refitSoon()).observe(c);
    const el = intro();
    if (el) { el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'tour-start') go(1, 1); else if (b.id === 'tour-open') exit(); else if (b.dataset.tourLang) { I.setLang(b.dataset.tourLang); renderIntro(); } });
      el.querySelectorAll('[data-tour-lang]').forEach(b => { b.textContent = I.LANGS[b.dataset.tourLang].label; }); }
    document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKeyUp, true);
    addEventListener('hashchange', () => { if (/^#\/tour/.test(location.hash)) fromHash(); else if (S.on || introShown()) { S.on = false; hideIntro(); hideTourUI(); unbuild(); } });
    I.onChange(() => { renderIntro(); if (!S.on) return; closePop(); renderCard(); renderLabels(); requestAnimationFrame(() => frame()); }); // the card changes side with the language
    if (map) { map.on('styledata', () => { if (S.built) raise(); }); map.on('move', () => { if (S.on && S.items.length + ((S.signs || []).length)) schedule(); }); map.on('resize', () => { if (S.on) schedule(); }); }
    addEventListener('resize', () => { if (S.on) { frame(true); schedule(); } });
    const nav = $('#tb-nav'); if (nav && !$('#tb-tour')) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tb-btn'; b.id = 'tb-tour'; b.dataset.i18n = 'tour.nav'; b.textContent = t('tour.nav'); b.addEventListener('click', () => { location.hash = '#/tour'; }); nav.insertBefore(b, nav.firstChild); }
    if (!fromHash() && introShown()) { renderIntro(); load().catch(() => { }); }
  }
  root.GA.tour = { init, go, exit, next, back, setLayer, showIntro, popupAt, freeRect, pad, polylabel,
    get state() { return { on: S.on, step: S.step, layer: S.layer, n: LAYERS[S.step] || 0, intro: introShown(), built: S.built, groups: S.on ? VIS[S.step][S.layer - 1] : [], view: S.view, bbox: S.D && S.view ? S.D.bb[S.view] : null }; },
    get labels() { return S.placed.slice(); }, get data() { return S.D; }, VIS, GROUPS, ID, LAYERS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0)); else setTimeout(init, 0);
})(window);
