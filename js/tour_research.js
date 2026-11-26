/* Build 5.52 — the research tour: 14 chapters around the Base Aérea de Armilla and its five towns (Armilla, Churriana de la
   Vega, Las Gabias, Alhendín, Ogíjares). The engine (js/tour.js) keeps the opening page, keys, framing, labels and the card;
   this module defines the chapters and their slides, the research map layers (ids tour-r-*), the charts, the timelines,
   the data-kind badges and the data inventory.
   Rules (owner brief, 24 Nov 2026): objective, no design conclusion (remain / transform / relocate stay open); every slide
   has a question, an explanation, the data on the map, a chart or comparison, an evidence-based finding and the link to the
   base (proven / testable / context / missing). Data kinds: official · historical · spatial analysis · estimate ·
   projection · scenario — a badge beside each source carries source, year and method. Missing data is shown as missing.
   Maps in black / white / grey; red only for what the slide explains (GA.palette.research). Water keeps its blue family.
   Data: data/ref/research.json, research_grid.json, research_flood.json (tools/build_research.py) and the existing layers. */
(function (root) {
  const GA = root.GA, I = GA.i18n, P = GA.palette, Q = P.research;
  const t = (k, v) => I.t(k, v);
  const U = () => GA.tour.util;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
  const L = (s) => `<span dir="ltr" class="num">${s}</span>`;
  const sgn = (v, d) => v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d == null ? 1 : d);
  // 5.53 (owner: "not in hectares"): areas in dunams (1 dunam = 1,000 m² = 0.1 ha)
  const DU = (ha) => ha == null ? null : ha * 10; const du = (ha, d) => L(nf(DU(ha), d || 0)) + ' ' + t('r.u.du'); // 5.53: only the number is LTR; the word follows it in the reader's direction
  const RM = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FIVE = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares'];
  const SIX = FIVE.concat(['Granada']);
  const nmL = (n) => U().nmL(n);
  const SH = { 'Armilla': 'armilla', 'Churriana de la Vega': 'churriana', 'Las Gabias': 'gabias', 'Alhendín': 'alhendin', 'Ogíjares': 'ogijares', 'Granada': 'granada' };
  const nmS = (n) => SH[n] ? t('r.short.' + SH[n]) : n; // short names for narrow charts and table heads
  const ID = (k) => 'tour-' + k;
  const X = { R: null, G: null, F: null, extra: {}, anim: null, sel: 'Armilla', scen: 'A', ind: 'chg', cache: {} };

  // ---------- kinds of data (badge glyph, i18n key) ----------
  const KIND = { official: '■', historical: '◆', spatial: '◎', estimate: '≈', projection: '↗', scenario: '◇' };
  // sources that are repository layers (not in research.json): name, year, kind, method
  const LSRC = {
    base_edge: ['OpenStreetMap — way 130984030 (landuse=military)', '2026', 'official', 'outline of the base as mapped in OSM'],
    towns: ['OpenStreetMap residential areas + building footprints (tools/build_tour_towns.py)', '2026', 'spatial', 'continuous residential areas; scattered houses outlined 30 m around'],
    history: ['IGN MTN50 1932 · Catastrones · AMS 1956 (traced) · JRC GHSL 1975–2020', '1932–2020', 'historical', 'outer built-up extent of Granada per date; traced by hand or from the GHSL built-up grid (modelled)'],
    ams: ['IGN — PNOA histórico, vuelo americano AMS 1956–1957 (WMS)', '1956–1957', 'historical', 'aerial photograph, CC BY 4.0 scne.es / IGN'],
    pnoa: ['IGN — PNOA 2022 orthophoto (WMS; 2023–2024 are blank over Granada)', '2022', 'official', 'aerial photograph, CC BY 4.0 scne.es / IGN'],
    noise: ['MITECO SICA — strategic noise maps, 3rd phase (roads, railways, agglomeration), Lden', '2017–2022', 'estimate', 'modelled noise levels, not measured; no map exists for the aerodrome'],
    water: ['OpenStreetMap waterways (supplied extract)', '2026', 'official', 'mapped rivers, streams, canals and irrigation ditches (acequias); unmapped ditches are absent'],
    flow: ['Computed from IGN MDT25 (tools/build_flow.js)', '2026', 'spatial', 'D8 flow paths by upslope area on the 25 m terrain model'],
    landuse: ['OpenStreetMap landuse (supplied extract, 23 Oct 2026)', '2026', 'spatial', 'mapped land-use polygons; unmapped land stays blank'],
    fac: ['OpenStreetMap schools and health facilities (Overpass snapshot)', '2026', 'official', 'mapped facilities; ring = 500 m straight line'],
    stay: ['OpenStreetMap tourist accommodation (Overpass snapshot)', '2026', 'official', 'hotels, hostels, guest houses and apartments as mapped'],
    centre: ['OpenStreetMap shops, food and services (Overpass, 23 Nov 2026)', '2026', 'official', 'deduplicated points (data/ex13b/centre.json)'],
    human: ['OpenStreetMap squares, parks ≥ 1,000 m², playgrounds (Overpass, 23 Nov 2026)', '2026', 'official', 'data/ex13b/human.json'],
    ghs: ['JRC GHSL — GHS-POP R2023A, 2020, 100 m', '2020', 'estimate', 'modelled residents per 100 m cell'],
    lstimg: ['USGS Landsat 8/9 surface temperature, June–August 2024–2026 (30 scenes)', '2024–2026', 'spatial', 'median land-surface temperature at ~11:50 local time, 90 m blocks — the temperature of surfaces, not of the air'],
    ndvi: ['USGS Landsat 8/9 NDVI, June–August 2024–2026', '2024–2026', 'spatial', 'median vegetation index, 90 m blocks'],
    wcimg: ['ESA WorldCover 2021 v200, 10 m', '2021', 'spatial', 'class 10 "tree cover" (orchards and poplar groves included)'],
    tour_area: ['INE tables 2871 / 31025 / 59060 on IGN outlines (tools/build_tour_area.py)', '2015–2025', 'official', 'the 34 municipalities of the agglomeration'],
    metro: ['OpenStreetMap (metro 2026) · IGN MTN50 1931 (tram traced)', '1931 / 2026', 'historical', 'lines as mapped / traced'],
    band1981: ['BOE 1981 (security zone of the base) · OpenStreetMap landuse', '1981 / 2026', 'official', '300 m band around the base and what lies in it'],
    routes: ['OpenStreetMap streets (tools/build_base_edge.py)', '2026', 'spatial', 'shortest walking route on the mapped network vs the straight line'],
    photos: ['IGN — PNOA histórico (WMS): AMS 1956–57, Interministerial 1973–86, Nacional 1981–86, OLISTAT 1997–98, PNOA 2004 / 2010 / 2016 / 2022 (IGN returns PNOA 2023–2024 blank over Granada)', '1956–2022', 'historical', 'aerial photographs, one flight at a time; CC BY 4.0 scne.es / IGN'],
    scen: ['Research scenarios of this atlas (A remain · B transform · C relocate)', '2026', 'scenario', 'hypothetical, for research questions only — no option is recommended'],
    proj: ['Linear trends of the INE padrón 2005–2025 and 2015–2025, extended to 2076', '2026', 'projection', 'arithmetic extension of past growth; not a forecast — births, deaths, migration and housing supply are not modelled'],
  };

  // ---------- chapters and slides ----------
  // groups: engine layer groups (js/tour.js GROUPS + this module's RG); old: [step, layer] of a 5.27–5.51 slide whose body,
  // legend, labels and popups the engine keeps; view: frame key in D.bb; src: keys of research.json sources or LSRC;
  // link: proven · testable · context · missing (how the slide relates to the base)
  const S = (id, o) => Object.assign({ id }, o);
  const CH = [
    { k: 'intro', slides: [
      S('i2', { old: [1, 1], src: ['base_edge'], link: 'proven' }),
      S('i1', { groups: ['veil', 'rMuni', 'rGran', 'rFive', 'base'], view: 'cityTowns', src: ['outline', 'pop', 'base_edge'], chart: 'popBar', link: 'context', labels: 'names' }),
      S('i3', { old: [2, 1], src: ['towns', 'pop'], link: 'context' }),
      S('i4', { groups: ['veil', 'rFive', 'towns', 'base'], view: 'five', src: ['outline', 'base_edge', 'towns'], chart: 'baseVs', link: 'proven', labels: 'baseShare' }),
    ] },
    { k: 'hist', slides: [
      S('h1', { groups: ['veil', 'rHist', 'rFive', 'base'], view: 'city', src: ['history', 'base_edge'], anim: 'growth', link: 'testable' }),
      S('h2', { groups: ['veil', 'rGrid', 'rFive', 'base'], view: 'near', src: ['periods'], anim: 'period', chart: 'periods', link: 'testable' }),
      S('h3', { groups: ['rPhoto', 'rBaseLine'], view: 'basewide', src: ['photos', 'base_edge'], anim: 'photos', link: 'context' }),
      S('h4', { groups: ['veil', 'rGridLv', 'rFive', 'base'], view: 'near', src: ['floors'], chart: 'floors', link: 'testable' }),
    ] },
    { k: 'clim', slides: [
      S('c1', { groups: ['veil', 'rFive', 'rWind', 'rPts', 'base'], view: 'clim', src: ['temp', 'rain', 'wind'], chart: 'climate', pts: 'clim', labels: 'clim', link: 'context' }),
      S('c2', { groups: ['veil', 'rHeat', 'rFive', 'rBaseLine'], view: 'near', src: ['temp', 'cmip6', 'lstimg'], chart: 'hot', heat: true, link: 'context' }),
      S('c3', { groups: ['veil', 'rImg', 'rFive', 'rBaseLine'], view: 'near', src: ['lst', 'lstimg'], img: 'lst', chart: 'lst', link: 'proven', labels: 'lst' }),
      S('c4', { groups: ['veil', 'rImg', 'rFive', 'rBaseLine'], view: 'near', src: ['ndvi', 'wc'], img: 'ndvi', chart: 'trees', link: 'context' }),
      S('c5', { groups: ['veil', 'rNoise', 'rFive', 'rBaseLine'], view: 'near', src: ['noise', 'air'], chart: 'air', link: 'missing' }),
    ] },
    { k: 'flood', slides: [
      S('f1', { groups: ['veil', 'rFlow', 'rWater', 'rFive', 'rBaseLine', 'rPts'], view: 'near', src: ['flow', 'water', 'rd1989'], need: ['water', 'flow'], pts: 'thr', link: 'proven' }),
      S('f2', { groups: ['veil', 'rFlood', 'rFive', 'base'], view: 'near', src: ['flood'], anim: 'flood', chart: 'flood', link: 'testable' }),
      S('f3', { groups: ['veil', 'rDph', 'rWater', 'rFive', 'base'], view: 'near', src: ['water', 'flood'], need: ['water'], water: 'irr', link: 'testable' }),
      S('f4', { groups: ['veil', 'rLu', 'rFive', 'base'], view: 'near', src: ['lu'], need: ['landuse'], lu: 'seal', chart: 'seal', link: 'missing' }),
    ] },
    { k: 'agri', slides: [
      S('a1', { groups: ['veil', 'rLu', 'rFive', 'base'], view: 'near', src: ['lu', 'base_edge'], need: ['landuse'], lu: 'farm', chart: 'farm', link: 'proven' }),
      S('a2', { groups: ['veil', 'rImg', 'rFive', 'rBaseLine'], view: 'near', src: ['wc', 'wcimg'], img: 'wc', chart: 'trees', link: 'context' }),
      S('a3', { groups: ['rAms', 'rGrid', 'rBaseLine', 'rFive'], view: 'near', src: ['ams', 'periods'], gridOnly: 5, chart: 'periods', link: 'testable' }),
    ] },
    { k: 'tour', slides: [
      S('t1', { old: [3, 1], groups: ['veil', 'chg', 'muniLine', 'five', 'base'], view: 'cityTowns', src: ['tour_area'], link: 'context' }),
      S('t2', { groups: ['veil', 'rGrowth', 'rFive', 'base'], view: 'five', src: ['pop', 'growth'], need: ['growth'], chart: 'popSeries', anim: 'years', link: 'context', labels: 'popYear' }),
      S('t3', { old: [3, 3], groups: ['veil', 'rent', 'muniLine', 'five', 'base'], view: 'cityTowns', src: ['tour_area'], link: 'context' }),
      S('t4', { groups: ['veil', 'rMuni', 'rFive', 'rPts', 'base'], view: 'cityTowns', src: ['vut', 'stay'], need: ['stay'], pts: 'stay', chart: 'vut', link: 'context' }),
    ] },
    { k: 'pop', slides: [
      S('p1', { groups: ['veil', 'rImg', 'rFive', 'rBaseLine'], view: 'near', src: ['ghs'], img: 'ghs', chart: 'ghs', link: 'context' }),
      S('p2', { groups: ['veil', 'rFive', 'rHi', 'base'], view: 'five', src: ['pyr'], chart: 'pyramid', pick: true, link: 'context' }),
      S('p3', { groups: ['veil', 'rFive', 'base'], view: 'five', src: ['demo', 'foreign'], chart: 'demo', link: 'context' }),
      S('p4', { old: [3, 2], groups: ['veil', 'inc', 'muniLine', 'five', 'base'], view: 'cityTowns', src: ['tour_area', 'incsrc'], chart: 'incsrc', link: 'context' }),
      S('p5', { old: [3, 4], src: [], link: 'missing' }),
    ] },
    { k: 'life', slides: [
      S('e1', { groups: ['veil', 'rFive', 'rRing', 'rPts', 'base'], view: 'near', src: ['fac', 'reach'], need: ['fac'], pts: 'fac', chart: 'reach', link: 'testable' }),
      S('e2', { groups: ['veil', 'rFive', 'rPts', 'base'], view: 'near', src: ['centre'], need: ['centre'], pts: 'centre', chart: 'shops', link: 'context' }),
      S('e3', { groups: ['veil', 'rHuman', 'rFive', 'base'], view: 'near', src: ['human'], need: ['human'], chart: 'publicSp', link: 'context' }),
    ] },
    { k: 'econ', slides: [
      S('j1', { groups: ['veil', 'rLu', 'rFive', 'base'], view: 'near', src: ['jobs', 'lu'], need: ['landuse'], lu: 'work', chart: 'jobs', link: 'context' }),
      S('j2', { groups: ['veil', 'rFive', 'base'], view: 'five', src: ['act', 'sepe'], chart: 'unemp', link: 'context', labels: 'sepe' }),
    ] },
    { k: 'mob', slides: [
      S('m1', { old: [2, 7], src: ['metro'], link: 'proven' }),
      S('m2', { old: [2, 3], src: ['routes'], link: 'proven' }),
      S('m3', { old: [2, 4], src: ['routes'], link: 'proven' }),
      S('m4', { old: [2, 5], src: ['routes'], link: 'proven' }),
      S('m5', { groups: ['veil', 'rFive', 'rPts', 'base'], view: 'near', src: ['bus'], need: ['bus'], pts: 'bus', chart: 'bus', link: 'testable' }),
      S('m6', { old: [2, 2], src: ['base_edge'], link: 'proven' }),
    ] },
    { k: 'mil', slides: [
      S('b1', { groups: ['veil', 'base', 'rLine', 'rPts'], view: 'basewide', src: ['rd1989', 'base_edge'], pts: 'rd', link: 'proven' }),
      S('b2', { old: [2, 6], src: ['band1981'], link: 'proven' }),
      S('b3', { groups: ['veil', 'rGridLv', 'rLine', 'base'], view: 'near', src: ['floors', 'rd1989'], chart: 'floorsNear', link: 'missing' }),
      S('b4', { groups: ['veil', 'rNoise', 'rLine', 'base'], view: 'near', src: ['noise', 'rd1989'], link: 'missing' }),
    ] },
    { k: 'plan', slides: [
      S('u1', { groups: ['veil', 'rLu', 'rFloodLine', 'rFive', 'base'], view: 'near', src: ['lu', 'flood'], need: ['landuse'], lu: 'change', chart: 'change', link: 'missing' }),
    ] },
    { k: 'comp', slides: [
      S('k1', { groups: ['veil', 'rFive', 'base'], view: 'five', src: ['pop', 'demo', 'act', 'lst', 'wc', 'reach', 'bus'], chart: 'table', link: 'context', labels: 'names5' }),
      S('k2', { groups: ['veil', 'rChoro', 'rFive', 'base'], view: 'five', src: ['pop', 'demo', 'act', 'lst', 'wc', 'bus'], chart: 'indicator', link: 'context', labels: 'ind' }),
    ] },
    { k: 'future', slides: [
      S('n1', { groups: ['veil', 'rFive', 'base'], view: 'five', src: ['pop', 'proj'], chart: 'proj', link: 'context' }),
      S('n2', { groups: ['veil', 'rFive', 'rScen'], view: 'five', src: ['scen'], chart: 'scen', link: 'context' }),
      S('n3', { groups: ['veil', 'rFive', 'base'], view: 'five', src: [], chart: 'gaps', link: 'missing' }),
    ] },
  ];

  // ---------- data ----------
  const ver = () => (GA.data && GA.data.manifest && GA.data.manifest.dataVersion) || '0';
  const getJ = (p) => fetch(p + '?v=' + ver()).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
  const inv = (x, y) => GA.proj.EPSG25830.inverse([x, y]);
  function load() {
    if (X.loading) return X.loading;
    X.loading = Promise.all([getJ('data/ref/research.json'), getJ('data/ref/research_grid.json'), getJ('data/ref/research_flood.json').catch(() => null), getJ('data/ref/history_extents.json').catch(() => null)]).then(([R, G, F, H]) => {
      X.R = R; X.G = G; X.F = F; X.H = H;
      X.lp = {}; R.outline.features.forEach(f => { X.lp[f.properties.name] = U().polylabel(U().ringsOf(f.geometry)); });
      return X;
    }).catch(e => { X.loading = null; throw e; });
    return X.loading;
  }
  const M = (n) => X.R.munis[n];
  const S_D = () => GA.tour.data; // the engine's data (base outline, frames)
  const need = {
    water: () => GA.data.single('water'), flow: () => GA.data.single('flow_paths'), landuse: () => GA.data.single('landuse_overview'),
    stay: () => GA.data.single('fac_stay'), bus: () => GA.data.single('bus_service'),
    fac: () => Promise.all(['fac_education', 'fac_health'].map(n => GA.data.single(n))),
    centre: () => getJ('data/ex13b/centre.json'), human: () => getJ('data/ex13b/human.json'),
    climate: () => getJ('data/ex13b/climate.json'), density: () => getJ('data/ex13b/density.json'), growth: () => getJ('data/ref/research_growth.json'),
  };
  function ensure(keys) { return Promise.all((keys || []).map(k => { if (!X.extra[k]) X.extra[k] = need[k]().catch(e => { delete X.extra[k]; throw e; }); return X.extra[k]; })); }

  // frame of the base analysis frame (data/ex13b), the city growth and the region, added to the engine's D.bb
  function bbs(D) {
    const fr = [inv(437500, 4103500), inv(449500, 4103500), inv(449500, 4113500), inv(437500, 4113500)];
    const lon = fr.map(p => p[0]), lat = fr.map(p => p[1]);
    D.bb.frame = [[Math.min(...lon), Math.min(...lat)], [Math.max(...lon), Math.max(...lat)]];
    D.bb.region = D.bb[3]; D.bb.five = D.bb[2]; D.bb.near = D.bb[2]; // 5.53 (owner: "zoom in"): the analysis maps frame the base and the five town centres
    const cl = X.R.climate.cell; D.bb.clim = cl ? [[Math.min(D.bb[2][0][0], cl[1] - 0.004), Math.min(D.bb[2][0][1], cl[0] - 0.004)], [Math.max(D.bb[2][1][0], cl[1] + 0.004), Math.max(D.bb[2][1][1], cl[0] + 0.004)]] : D.bb[2];
    const b1 = D.bb[1], dx = (b1[1][0] - b1[0][0]) * 0.45, dy = (b1[1][1] - b1[0][1]) * 0.3; D.bb.basewide = [[b1[0][0] - dx, b1[0][1] - dy], [b1[1][0] + dx, b1[1][1] + dy]];
    if (X.H) { const g = X.H.extents.ghsl_2020.geometry; D.bb.city = U().bboxOf([g, D.base.geometry]); }
    else D.bb.city = D.bb[3];
    // 5.53: 'Granada city and the five towns' — the city box joined with the base-and-towns box (bb.city alone leaves out Las Gabias and Alhendín)
    { const a = D.bb.city, b = D.bb[2]; D.bb.cityTowns = [[Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])], [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]]; }
  }

  // ---------- map layers (ids tour-r-*) ----------
  // 5.53 (owner: "add other years"): every national aerial-photo flight on the IGN historical service, one at a time
  const PH = [['ams56', 'AMS_1956-1957', '1956–1957'], ['inter7386', 'Interministerial_1973-1986', '1973–1986'], ['nac8186', 'Nacional_1981-1986', '1981–1986'],
    ['olistat', 'OLISTAT', '1997–1998'], ['pnoa2004', 'PNOA2004', '2004'], ['pnoa2010', 'PNOA2010', '2010'], ['pnoa2016', 'PNOA2016', '2016'], ['pnoa2022', 'PNOA2022', '2022']]
    .map(([id, layer, period]) => ({ id, layer, period, lid: 'r-ph-' + id }));
  const RG = {
    rMuni: ['r-muni'], rGran: ['r-gran'], rFive: ['r-five'], rHi: ['r-hi'], rChoro: ['r-choro'], rBaseLine: ['r-baseline'],
    rHist: ['r-hist-fill', 'r-hist-line'], rGrid: ['r-grid'], rGridLv: ['r-gridlv'], rImg: ['r-img'], rAms: ['r-ams'], rPnoa: ['r-pnoa'], rNoise: ['r-noise'],
    rFlood: ['r-flood'], rFloodLine: ['r-flood-l'], rDph: ['r-dph'], rLu: ['r-lu'], rWater: ['r-water'], rFlow: ['r-flow'], rHuman: ['r-human'],
    rRing: ['r-ring'], rPts: ['r-pts'], rLine: ['r-line', 'r-heli'], rScen: ['r-scen-fill', 'r-scen-line'],
    rPhoto: [PH[0].lid], // the flight on screen (the timeline swaps it)
    rWind: ['r-wind'], rHeat: ['r-heat'], rGrowth: ['r-growth-fill', 'r-growth-ref', 'r-growth-line'],
  };
  const LOW = ['r-pnoa', 'r-ams'].concat(PH.map(p => p.lid)); // under the veil (photographs)
  const MID = ['r-img', 'r-heat', 'r-noise', 'r-lu', 'r-growth-fill', 'r-hist-fill', 'r-grid', 'r-gridlv', 'r-dph', 'r-flood', 'r-human', 'r-choro', 'r-scen-fill', 'r-flow', 'r-water', 'r-flood-l',
    'r-muni', 'r-gran', 'r-five', 'r-growth-ref', 'r-growth-line', 'r-hi', 'r-hist-line', 'r-wind', 'r-scen-line', 'r-heli', 'r-line', 'r-ring', 'r-pts', 'r-baseline'];
  const FC = (fs) => ({ type: 'FeatureCollection', features: fs || [] });
  const perL = (k) => k === 'pre_1900' || k === '2000_plus' ? t('period.' + k) : k.replace('_', '–');
  const GY = [1996, 2000, 2005, 2010, 2015, 2020, 2025]; // years of the towns' built-up outlines (data/ref/research_growth.json)
  const PER = ['pre_1900', '1900_1939', '1940_1959', '1960_1979', '1980_1999', '2000_plus'];
  function gridFC() {
    if (X.cache.grid) return X.cache.grid; const G = X.G; const fs = [];
    G.cells.forEach(c => { const [i, j] = c; const n = c.slice(2, 9); const fp = n.slice(0, 6).findIndex(v => v > 0); const x = G.x0 + i * G.cell, y = G.y1 - j * G.cell;
      const ring = [[x, y], [x + G.cell, y], [x + G.cell, y - G.cell], [x, y - G.cell], [x, y]].map(p => inv(p[0], p[1]));
      fs.push({ type: 'Feature', properties: { fp: fp < 0 ? 6 : fp, n: n.reduce((a, b) => a + b, 0), nd: n[6], lv: c[9], c: n }, geometry: { type: 'Polygon', coordinates: [ring] } }); });
    return (X.cache.grid = FC(fs));
  }
  function histFC() {
    if (!X.H) return FC(); const order = ['mtn50_1932', 'catastrones', 'ams_1956', 'ghsl_1975', 'ghsl_1990', 'ghsl_2000', 'ghsl_2015', 'ghsl_2020'];
    return FC(order.map((k, i) => ({ type: 'Feature', properties: { i, k, p: X.H.extents[k].period }, geometry: X.H.extents[k].geometry })).reverse());
  }
  function rdFC() {
    const r = X.R.rd1989; return FC([
      { type: 'Feature', properties: { k: 'runway' }, geometry: { type: 'LineString', coordinates: [r.thr36.slice(0, 2), r.thr18.slice(0, 2)] } },
      { type: 'Feature', properties: { k: 'heli' }, geometry: { type: 'Polygon', coordinates: [r.heli_zone.concat([r.heli_zone[0]])] } }]);
  }
  const lv = (g) => GA.ext && GA.ext.wmsTiles ? GA.ext.wmsTiles(GA.ext.SVC.ignHist, g) : null;
  function build(map, D) {
    const src = (k, o) => { if (!map.getSource(ID(k))) map.addSource(ID(k), o); };
    const gj = (k, data) => src(k, { type: 'geojson', data });
    gj('r-out', X.R.outline); gj('r-grid', gridFC()); gj('r-hist', histFC()); gj('r-rd', rdFC()); gj('r-pts', FC()); gj('r-lu', FC()); gj('r-water', FC()); gj('r-flow', FC()); gj('r-human', FC());
    gj('r-flood', X.F || FC()); gj('r-base', FC([D.base])); gj('r-wind', FC()); gj('r-heat', FC()); gj('r-growth', FC());
    if (GA.ext && GA.ext.wmsTiles) {
      src('r-ams', { type: 'raster', tiles: [GA.ext.wmsTiles(GA.ext.SVC.ignHist, 'AMS_1956-1957')], tileSize: 256, attribution: '© IGN — PNOA histórico, AMS 1956–57 (CC BY 4.0)' });
      src('r-pnoa', { type: 'raster', tiles: [GA.ext.wmsTiles(GA.ext.SVC.ignHist, 'PNOA2022')], tileSize: 256, attribution: '© IGN — PNOA 2022 (CC BY 4.0)' });
      src('r-noise', { type: 'raster', tiles: [GA.ext.wmsTiles(GA.ext.SVC.noise, GA.ext.noiseLayers('lden'))], tileSize: 256, attribution: 'MITECO — SICA' });
      PH.forEach(ph => src(ph.lid, { type: 'raster', tiles: [GA.ext.wmsTiles(GA.ext.SVC.ignHist, ph.layer)], tileSize: 256, attribution: '© IGN — PNOA histórico, ' + ph.period + ' (CC BY 4.0)' }));
    }
    const fr = [inv(437500, 4113500), inv(449500, 4113500), inv(449500, 4103500), inv(437500, 4103500)];
    src('r-img', { type: 'image', url: blankPNG(), coordinates: fr });
    if (!map.hasImage('tour-hatch')) map.addImage('tour-hatch', hatch(Q.hot), { pixelRatio: 2 });
    const lay = (o) => { if (!map.getLayer(o.id)) map.addLayer(Object.assign({}, o, { layout: Object.assign({ visibility: 'none' }, o.layout || {}) })); };
    const five = ['==', ['get', 'five'], true];
    const G = Q.grey;
    const defs = {
      'r-pnoa': { type: 'raster', source: ID('r-pnoa'), paint: { 'raster-opacity': 1, 'raster-saturation': -1, 'raster-fade-duration': 0 } },
      'r-ams': { type: 'raster', source: ID('r-ams'), paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 } },
      'r-img': { type: 'raster', source: ID('r-img'), paint: { 'raster-opacity': 0.8, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } },
      'r-noise': { type: 'raster', source: ID('r-noise'), paint: { 'raster-opacity': 0.75, 'raster-saturation': -1 } },
      'r-lu': { type: 'fill', source: ID('r-lu'), paint: { 'fill-color': G[1], 'fill-opacity': 0.85 } },
      'r-hist-fill': { type: 'fill', source: ID('r-hist'), paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'i'], 0, G[4], 7, G[1]], 'fill-opacity': 0.75 } },
      'r-hist-line': { type: 'line', source: ID('r-hist'), paint: { 'line-color': Q.hot, 'line-width': 2.4 } },
      'r-grid': { type: 'fill', source: ID('r-grid'), paint: { 'fill-color': G[2], 'fill-opacity': 0.9 } },
      'r-gridlv': { type: 'fill', source: ID('r-grid'), paint: { 'fill-color': ['case', ['==', ['typeof', ['get', 'lv']], 'number'], ['step', ['get', 'lv'], G[1], 2.5, G[2], 3.5, G[3], 5, Q.hot], Q.unknown], 'fill-outline-color': ['case', ['==', ['typeof', ['get', 'lv']], 'number'], 'rgba(0,0,0,0)', Q.unknownLine], 'fill-opacity': 0.92 } },
      'r-dph': { type: 'fill', source: ID('r-flood'), filter: ['==', ['get', 'k'], 'dph'], paint: { 'fill-color': Q.flood.q500, 'fill-opacity': 0.7 } },
      'r-flood': { type: 'fill', source: ID('r-flood'), filter: ['in', ['get', 'k'], ['literal', ['q10']]], paint: { 'fill-color': ['match', ['get', 'k'], 'q10', Q.flood.q10, 'q100', Q.flood.q100, Q.flood.q500], 'fill-opacity': 0.8 } },
      'r-flood-l': { type: 'line', source: ID('r-flood'), filter: ['==', ['get', 'k'], 'q500'], paint: { 'line-color': Q.water, 'line-width': 1.2, 'line-dasharray': [2, 1.5] } },
      'r-human': { type: 'fill', source: ID('r-human'), paint: { 'fill-color': ['match', ['get', 'k'], 'square', Q.hot, G[3]], 'fill-opacity': 0.85 } },
      'r-choro': { type: 'fill', source: ID('r-out'), filter: five, paint: { 'fill-color': G[1], 'fill-opacity': 0.85 } },
      'r-scen-fill': { type: 'fill', source: ID('r-base'), paint: { 'fill-color': Q.ink, 'fill-opacity': 0.3 } },
      'r-flow': { type: 'line', source: ID('r-flow'), paint: { 'line-color': Q.water, 'line-width': ['match', ['get', 'c'], 0, 0.6, 1, 1.1, 2, 1.8, 2.6], 'line-opacity': 0.8 } },
      'r-water': { type: 'line', source: ID('r-water'), paint: { 'line-color': Q.water, 'line-width': 1.2 } },
      'r-muni': { type: 'line', source: ID('area'), paint: { 'line-color': Q.outlineSoft, 'line-width': 0.8 } },
      'r-gran': { type: 'line', source: ID('r-out'), filter: ['==', ['get', 'name'], 'Granada'], paint: { 'line-color': Q.ink3, 'line-width': 1.4, 'line-dasharray': [3, 2] } },
      'r-five': { type: 'line', source: ID('r-out'), filter: five, paint: { 'line-color': Q.outline, 'line-width': 1.5 } },
      'r-hi': { type: 'line', source: ID('r-out'), filter: ['==', ['get', 'name'], ''], paint: { 'line-color': Q.hot, 'line-width': 3.4 } },
      'r-scen-line': { type: 'line', source: ID('r-base'), paint: { 'line-color': Q.ink, 'line-width': 2.4 } },
      'r-heli': { type: 'line', source: ID('r-rd'), filter: ['==', ['get', 'k'], 'heli'], paint: { 'line-color': Q.hot, 'line-width': 1.6, 'line-dasharray': [2, 1.5] } },
      'r-line': { type: 'line', source: ID('r-rd'), filter: ['==', ['get', 'k'], 'runway'], layout: { 'line-cap': 'butt' }, paint: { 'line-color': Q.hot, 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 12, 1.5, 16, 14, 18, 56] } },
      'r-ring': { type: 'circle', source: ID('r-pts'), filter: ['==', ['get', 'ring'], 1], paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 10, 4.1, 18, 1051], 'circle-color': Q.hotSoft, 'circle-opacity': 0.18, 'circle-stroke-color': Q.hot, 'circle-stroke-width': 0.8, 'circle-stroke-opacity': 0.6 } },
      'r-pts': { type: 'circle', source: ID('r-pts'), paint: { 'circle-radius': ['coalesce', ['get', 'r'], 3.5], 'circle-color': ['coalesce', ['get', 'col'], Q.ink], 'circle-stroke-color': Q.white, 'circle-stroke-width': 1 } },
      'r-baseline': { type: 'line', source: ID('r-base'), paint: { 'line-color': Q.hot, 'line-width': 2.6 } },
      // 5.53: wind rose drawn on the map at the base; summer heat as a heat map; each town's built-up outline by year
      'r-wind': { type: 'fill', source: ID('r-wind'), paint: { 'fill-color': ['case', ['==', ['get', 'max'], 1], Q.hot, G[3]], 'fill-opacity': 0.72, 'fill-outline-color': Q.white } },
      'r-heat': { type: 'heatmap', source: ID('r-heat'), paint: { 'heatmap-weight': ['get', 'w'], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 13, 1.3, 15, 2],
        'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 11, 6, 13, 18, 15, 66, 17, 250], 'heatmap-opacity': 0.88,
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.15, Q.heat[0], 0.4, Q.heat[1], 0.7, Q.heat[2], 1, Q.heat[3]] } },
      'r-growth-fill': { type: 'fill', source: ID('r-growth'), filter: ['==', ['get', 'y'], 2025], paint: { 'fill-color': Q.hot, 'fill-opacity': 0.42 } },
      'r-growth-line': { type: 'line', source: ID('r-growth'), filter: ['==', ['get', 'y'], 2025], paint: { 'line-color': Q.hot, 'line-width': 1.6 } },
      'r-growth-ref': { type: 'line', source: ID('r-growth'), filter: ['==', ['get', 'y'], 1996], paint: { 'line-color': Q.ink, 'line-width': 1.3, 'line-dasharray': [2, 1.6] } },
    };
    PH.forEach(ph => { defs[ph.lid] = { type: 'raster', source: ID(ph.lid), paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 } }; });
    LOW.concat(MID).forEach(n => lay(Object.assign({ id: ID(n) }, defs[n])));
  }
  function blankPNG() { const c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/png'); }
  function hatch(col) { const n = 16, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.strokeStyle = col; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, n); g.lineTo(n, 0); g.moveTo(-n / 2, n / 2); g.lineTo(n / 2, -n / 2); g.moveTo(n / 2, n * 1.5); g.lineTo(n * 1.5, n / 2); g.stroke(); return g.getImageData(0, 0, n, n); }

  // ---------- rasters drawn in the browser (EPSG:25830 grids → image source) ----------
  const LSTB = [43, 45, 47, 49, 51], NDVIB = [0.15, 0.25, 0.35, 0.5];
  const IMG = {
    lst: { breaks: LSTB, cols: Q.grey.concat([Q.hot]), unit: ' °C', d: 0 },
    ndvi: { breaks: NDVIB, cols: Q.grey, unit: '', d: 2 },
    ghs: { breaks: [1000, 5000, 10000, 20000], cols: Q.grey.slice(0, 4).concat([Q.hot]), unit: ' /km²', d: 0 },
    wc: { cols: [Q.grey[3]], labels: () => [t('v36.wcTree')] },
  };
  const cls = (v, b) => { let i = 0; while (i < b.length && v >= b[i]) i++; return i; };
  const rgb = (h) => P.rgb(h);
  async function image(map, kind) {
    const s = map.getSource(ID('r-img')); if (!s) return;
    if (X.cache['img_' + kind]) { s.updateImage(X.cache['img_' + kind]); return; }
    let c, coords;
    if (kind === 'lst' || kind === 'ndvi') {
      const C = await ensure(['climate']).then(r => r[0]); const g = C.grid, nx = +g.nx, ny = +g.ny, cs = +g.cell, x0 = +g.x0, y1 = +g.y1; const A = C[kind], st = IMG[kind];
      c = document.createElement('canvas'); c.width = nx; c.height = ny; const ctx = c.getContext('2d'); const im = ctx.createImageData(nx, ny);
      for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) { const v = A[i] && A[i][j]; if (v == null) continue; const k = (i * nx + j) * 4; const col = rgb(st.cols[cls(v, st.breaks)]); im.data.set([col[0], col[1], col[2], 255], k); }
      ctx.putImageData(im, 0, 0); coords = [inv(x0, y1), inv(x0 + nx * cs, y1), inv(x0 + nx * cs, y1 - ny * cs), inv(x0, y1 - ny * cs)];
    } else if (kind === 'ghs') {
      const Dn = await ensure(['density']).then(r => r[0]); const nx = 120, ny = 100; c = document.createElement('canvas'); c.width = nx; c.height = ny; const ctx = c.getContext('2d'); const im = ctx.createImageData(nx, ny);
      const cx = Dn.corners.x, cy = Dn.corners.y, st = IMG.ghs;
      for (let i = 0; i < Dn.pop.length; i++) for (let j = 0; j < Dn.pop[i].length; j++) { const v = Dn.pop[i][j]; if (!v) continue; const x = (cx[i][j] + cx[i + 1][j + 1]) / 2, y = (cy[i][j] + cy[i + 1][j + 1]) / 2;
        const px = Math.floor((x - 437500) / 100), py = Math.floor((4113500 - y) / 100); if (px < 0 || py < 0 || px >= nx || py >= ny) continue; const col = rgb(st.cols[cls(v * 100, st.breaks)]); im.data.set([col[0], col[1], col[2], 255], (py * nx + px) * 4); }
      ctx.putImageData(im, 0, 0); coords = [inv(437500, 4113500), inv(449500, 4113500), inv(449500, 4103500), inv(437500, 4103500)];
    } else if (kind === 'wc') {
      const W = GA.data.manifest.canopy.worldcover; const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data/' + W.file + '?v=' + ver(); });
      // crop to the base frame (10 m pixels), tree cover → dark grey, the rest transparent
      const j0 = Math.round((437500 - W.ox) / W.px), i0 = Math.round((W.oy - 4113500) / W.px), w = 1200, h = 1000;
      c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.drawImage(img, -j0, -i0); const im = ctx.getImageData(0, 0, w, h); const col = rgb(Q.grey[3]);
      for (let k = 0; k < im.data.length; k += 4) { const tree = im.data[k + 3] > 0 && im.data[k] > 128; im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = tree ? 255 : 0; }
      ctx.putImageData(im, 0, 0); coords = [inv(437500, 4113500), inv(449500, 4113500), inv(449500, 4103500), inv(437500, 4103500)];
    }
    const o = { url: c.toDataURL('image/png'), coordinates: coords }; X.cache['img_' + kind] = o; s.updateImage(o);
  }

  // ---------- per-slide map state ----------
  const lu = {
    farm: { hot: ['farmland', 'orchard', 'meadow', 'farmyard', 'vineyard', 'greenhouse_horticulture'], grey: ['residential', 'industrial', 'commercial', 'retail', 'grass', 'forest', 'greenfield', 'construction', 'brownfield'] },
    work: { hot: ['industrial', 'commercial', 'retail'], grey: ['residential', 'farmland', 'orchard', 'meadow'] },
    change: { hot: ['greenfield', 'construction', 'brownfield'], grey: ['residential', 'industrial', 'commercial', 'retail'] },
    seal: { dark: ['residential', 'industrial', 'commercial', 'retail', 'construction', 'railway'], grey: ['farmland', 'orchard', 'meadow', 'grass', 'forest', 'greenfield', 'farmyard'] },
  };
  async function apply(map, sl, D) {
    const set = (id, k, v) => { if (map.getLayer(ID(id))) map.setPaintProperty(ID(id), k, v); };
    const data = (id, d) => { const s = map.getSource(ID(id)); if (s) s.setData(d); };
    if (sl.need) await ensure(sl.need);
    if (sl.img === 'lst' || sl.chart === 'lst') X.cache.climStats = (await ensure(['climate']))[0].stats;
    if (sl.img) await image(map, sl.img).catch(e => console.warn('tour image', e));
    if (sl.lu) { const fc = await X.extra.landuse; const m = lu[sl.lu]; const keep = new Set([].concat(m.hot || [], m.grey || [], m.dark || []));
      data('r-lu', FC(fc.features.filter(f => keep.has(f.properties.lu))));
      set('r-lu', 'fill-color', ['match', ['get', 'lu'], ...(m.hot ? [m.hot, Q.hot] : []), ...(m.dark ? [m.dark, Q.grey[3]] : []), Q.grey[1]]);
      set('r-lu', 'fill-opacity', sl.lu === 'seal' ? 0.85 : ['match', ['get', 'lu'], m.hot || ['_'], 0.6, 0.75]); }
    if (sl.need && sl.need.includes('water')) { const W = await X.extra.water; const irr = ['canal', 'ditch', 'drain'];
      data('r-water', sl.water === 'irr' ? W : FC(W.features.filter(f => !irr.includes(f.properties.ww))));
      set('r-water', 'line-color', sl.water === 'irr' ? ['match', ['get', 'ww'], irr, Q.hot, Q.water] : Q.water);
      set('r-water', 'line-width', sl.water === 'irr' ? ['match', ['get', 'ww'], irr, 1.4, 1] : 1.2); }
    if (sl.need && sl.need.includes('flow')) data('r-flow', await X.extra.flow);
    if (sl.id === 'c1') data('r-wind', windFC(D));
    if (sl.heat) { const C = (await ensure(['climate']))[0]; X.cache.climStats = C.stats; data('r-heat', heatFC(C)); }
    if (sl.need && sl.need.includes('growth')) data('r-growth', await X.extra.growth);
    if (sl.id === 'e3') { const Hm = await X.extra.human; const fs = []; ['square', 'park'].forEach(k => Hm.areas[k].forEach(a => fs.push({ type: 'Feature', properties: { k, n: a.n }, geometry: { type: 'Polygon', coordinates: a.p.map(r => r.map(p => inv(p[0], p[1]))) } })));
      data('r-human', FC(fs)); }
    data('r-pts', FC(await ptsFor(sl)));
    if (sl.gridOnly != null) { map.setFilter(ID('r-grid'), ['>=', ['get', 'fp'], sl.gridOnly]); set('r-grid', 'fill-color', ['case', ['==', ['get', 'fp'], 6], 'rgba(0,0,0,0)', Q.hot]); set('r-grid', 'fill-opacity', 0.8); }
    else if (map.getLayer(ID('r-grid'))) { map.setFilter(ID('r-grid'), null); set('r-grid', 'fill-opacity', 0.9); }
    if (sl.id === 'n2') scenPaint(map);
    if (sl.id === 'k2') choro(map);
    hi(map, sl.pick ? X.sel : null);
  }
  // the wind rose on the map: eight sectors around the base's centre, radius ∝ share of hours (the largest = 2.2 km, red)
  function windFC(D) {
    const w = X.R.climate.wind; if (!w) return FC(); const b = U().bboxOf([D.base.geometry]); const c = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
    const kx = 111320 * Math.cos(c[1] * Math.PI / 180), ky = 111320, mx = Math.max(...w.rose), R0 = 2200; const fs = [];
    w.rose.forEach((v, i) => { const r = v / mx * R0, ring = [c]; for (let a = i * 45 - 22.5; a <= i * 45 + 22.5 + 0.01; a += 5) { const t_ = a * Math.PI / 180; ring.push([c[0] + Math.sin(t_) * r / kx, c[1] + Math.cos(t_) * r / ky]); } ring.push(c);
      fs.push({ type: 'Feature', properties: { i, v, max: v === mx ? 1 : 0 }, geometry: { type: 'Polygon', coordinates: [ring] } }); });
    return FC(fs);
  }
  // the heat map: one point per Landsat 90 m block, weight = how far its summer surface temperature is above 44 °C (0 … 1)
  function heatFC(C) {
    if (X.cache.heat) return X.cache.heat; const g = C.grid, cs = +g.cell, x0 = +g.x0, y1 = +g.y1; const fs = [];
    C.lst.forEach((row, i) => row.forEach((v, j) => { if (v == null) return; const w = Math.max(0, Math.min(1, (v - 44) / 8)); if (!w) return;
      fs.push({ type: 'Feature', properties: { w: +(w * w).toFixed(3), t: v }, geometry: { type: 'Point', coordinates: inv(x0 + (j + 0.5) * cs, y1 - (i + 0.5) * cs) } }); }));
    return (X.cache.heat = FC(fs));
  }
  async function ptsFor(sl) {
    const out = []; const pt = (ll, p) => out.push({ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: ll } });
    if (sl.pts === 'clim' && X.R.climate.cell) { const cl = X.R.climate.cell; pt([cl[1], cl[0]], { k: 'cell', e: cl[2], col: Q.ink, r: 5 }); }
    if (sl.pts === 'thr' || sl.pts === 'rd') { const r = X.R.rd1989; pt(r.thr18.slice(0, 2), { k: 'thr', e: r.thr18[2], n: '18', col: Q.hot, r: 5 }); pt(r.thr36.slice(0, 2), { k: 'thr', e: r.thr36[2], n: '36', col: Q.hot, r: 5 });
      if (sl.pts === 'rd') { pt(r.ref.slice(0, 2), { k: 'ref', e: r.ref[2], col: Q.ink, r: 4.5 }); pt(r.tower.slice(0, 2), { k: 'tower', e: r.tower[2], col: Q.ink3, r: 4 }); } }
    if (sl.pts === 'stay') (await X.extra.stay).features.forEach(f => pt(f.geometry.coordinates, { k: 'stay', nm: f.properties.nm, cls: f.properties.cls, col: Q.hot, r: 3.5 }));
    if (sl.pts === 'fac') { const [ed, he] = await X.extra.fac; ed.features.forEach(f => pt(f.geometry.coordinates, { k: 'edu', nm: f.properties.nm, cls: f.properties.cls, col: Q.hot, r: 3.8, ring: 1 }));
      he.features.forEach(f => pt(f.geometry.coordinates, { k: 'health', nm: f.properties.nm, cls: f.properties.cls, col: Q.ink, r: 3.2 })); }
    if (sl.pts === 'centre') (await X.extra.centre).points.forEach(q => pt(inv(q[0], q[1]), { k: q[2], nm: q[3], col: q[2] === 'retail' ? Q.hot : q[2] === 'food' ? Q.ink : Q.grey[2], r: 2.8 }));
    if (sl.pts === 'bus') (await X.extra.bus).features.forEach(f => { const n = f.properties.trips_day || 0; pt(f.geometry.coordinates, { k: 'bus', nm: f.properties.stop_name, trips: n, col: n >= 100 ? Q.hot : Q.ink, r: Math.max(2.2, Math.min(9, Math.sqrt(n) * 0.75)) }); });
    return out;
  }
  function hi(map, name) { if (map.getLayer(ID('r-hi'))) map.setFilter(ID('r-hi'), ['==', ['get', 'name'], name || '']); }
  function scenPaint(map) {
    const s = X.scen; const set = (id, k, v) => map.getLayer(ID(id)) && map.setPaintProperty(ID(id), k, v);
    if (s === 'A') { set('r-scen-fill', 'fill-pattern', undefined); set('r-scen-fill', 'fill-color', Q.ink); set('r-scen-fill', 'fill-opacity', 0.32); set('r-scen-line', 'line-color', Q.ink); set('r-scen-line', 'line-dasharray', [1, 0]); }
    if (s === 'B') { set('r-scen-fill', 'fill-pattern', 'tour-hatch'); set('r-scen-fill', 'fill-opacity', 0.9); set('r-scen-line', 'line-color', Q.hot); set('r-scen-line', 'line-dasharray', [3, 2]); }
    if (s === 'C') { set('r-scen-fill', 'fill-pattern', undefined); set('r-scen-fill', 'fill-color', Q.white); set('r-scen-fill', 'fill-opacity', 0.55); set('r-scen-line', 'line-color', Q.scen.C); set('r-scen-line', 'line-dasharray', [1, 2]); }
  }
  // the comparative indicator map: grey classes by rank, the highest value in red
  const IND = {
    chg: { v: (n) => X.cache.area && X.cache.area[n] && X.cache.area[n].chg, u: ' %', d: 1, sign: true, src: 'pop' },
    age: { v: (n) => M(n).demo.age, u: '', d: 1, src: 'demo' }, u18: { v: (n) => M(n).demo.u18, u: ' %', d: 1, src: 'demo' }, o65: { v: (n) => M(n).demo.o65, u: ' %', d: 1, src: 'demo' },
    hh: { v: (n) => M(n).demo.hh, u: '', d: 1, src: 'demo' }, unemp: { v: (n) => M(n).act.rate, u: ' %', d: 1, src: 'act' },
    lst: { v: (n) => M(n).sp.lst, u: ' °C', d: 1, src: 'lst' }, tree: { v: (n) => M(n).sp.tree_pct, u: ' %', d: 1, src: 'wc' },
    bus: { v: (n) => { const m = M(n); const p = m.pop[String(Math.max(...Object.keys(m.pop).map(Number)))]; return p ? m.sp.bus_trips / p * 1000 : null; }, u: '', d: 0, src: 'bus' },
  };
  function choro(map) {
    const k = X.ind, f = IND[k]; const vals = FIVE.map(n => [n, f.v(n)]).filter(x => x[1] != null).sort((a, b) => a[1] - b[1]);
    const col = {}; vals.forEach(([n], i) => { col[n] = i === vals.length - 1 ? Q.hot : Q.grey[Math.min(3, i)]; });
    const expr = ['match', ['get', 'name']]; FIVE.forEach(n => expr.push(n, col[n] || Q.unknown)); expr.push(Q.unknown);
    if (map.getLayer(ID('r-choro'))) map.setPaintProperty(ID('r-choro'), 'fill-color', expr);
  }

  // ---------- timelines ----------
  const ANIM = {
    growth: { n: 8, label: (i) => X.H ? histFC().features.find(f => f.properties.i === i).properties.p : '', step: 1300 },
    period: { n: 6, label: (i) => perL(PER[i]), step: 1300 },
    flood: { n: 3, label: (i) => t('r.fl.' + ['q10', 'q100', 'q500'][i]), step: 1500 },
    photo: { n: 2, label: (i) => i ? '2024' : '1956–1957', step: 2400 },
    photos: { n: PH.length, label: (i) => PH[i].period, step: 2300 },
    years: { n: 30, label: (i) => String(1996 + i), step: 380 },
  };
  function frame(map, sl, i) {
    const a = sl.anim; { const n = ANIM[a] && ANIM[a].n; if (n) i = Math.max(0, Math.min(i, n - 1)); } X.anim = Object.assign(X.anim || {}, { i, slide: sl.id });
    if (a === 'growth') { map.setFilter(ID('r-hist-fill'), ['<=', ['get', 'i'], i]); map.setFilter(ID('r-hist-line'), ['==', ['get', 'i'], i]); }
    if (a === 'period') { map.setFilter(ID('r-grid'), ['any', ['<=', ['get', 'fp'], i], ['==', ['get', 'fp'], 6]]);
      map.setPaintProperty(ID('r-grid'), 'fill-color', ['case', ['==', ['get', 'fp'], 6], Q.unknown, ['==', ['get', 'fp'], i], Q.hot, ['step', ['get', 'fp'], Q.grey[4], 2, Q.grey[3], 4, Q.grey[2]]]); }
    if (a === 'flood') { const ks = ['q10', 'q100', 'q500'].slice(0, i + 1); map.setFilter(ID('r-flood'), ['in', ['get', 'k'], ['literal', ks]]); }
    if (a === 'photo') { map.setPaintProperty(ID('r-ams'), 'raster-opacity', i ? 0 : 1); }
    if (a === 'photos') { RG.rPhoto[0] = PH[i].lid; PH.forEach((ph, k) => { if (map.getLayer(ID(ph.lid))) map.setLayoutProperty(ID(ph.lid), 'visibility', k === i ? 'visible' : 'none'); }); }
    if (a === 'years' && map.getLayer(ID('r-growth-fill'))) { const gy = GY.filter(y => y <= 1996 + i).pop() || GY[0]; ['r-growth-fill', 'r-growth-line'].forEach(l => map.setFilter(ID(l), ['==', ['get', 'y'], gy])); X.gy = gy; }
    if (a === 'years') { X.year = 1996 + i; GA.tour.relabel && GA.tour.relabel(); }
    const el = document.querySelector('#tr-tl'); if (el) { el.querySelector('output').textContent = ANIM[a].label(i); const r = el.querySelector('input'); if (r && +r.value !== i) r.value = i; }
    document.querySelectorAll('#tour-card [data-fr]').forEach(e => e.classList.toggle('on', +e.dataset.fr === i));
  }
  function stop() { if (X.anim && X.anim.timer) { clearTimeout(X.anim.timer); X.anim.timer = 0; } if (X.anim) X.anim.playing = false; const b = document.querySelector('[data-tour="play"]'); if (b) { b.textContent = t('r.play'); b.setAttribute('aria-pressed', 'false'); } }
  function play(map, sl) {
    const A = ANIM[sl.anim]; if (!A) return; stop(); X.anim.playing = true; const b = document.querySelector('[data-tour="play"]'); if (b) { b.textContent = t('r.pause'); b.setAttribute('aria-pressed', 'true'); }
    let i = X.anim.i >= A.n - 1 ? 0 : X.anim.i + 1;
    const tick = () => { if (!X.anim || !X.anim.playing || X.anim.slide !== sl.id) return; frame(map, sl, i); if (i >= A.n - 1) { stop(); return; } i++; X.anim.timer = setTimeout(tick, A.step); };
    tick();
  }
  function enter(map, sl) {
    stop(); X.anim = { i: 0, slide: sl.id }; X.year = 2025;
    if (!sl.anim) return; const A = ANIM[sl.anim];
    if (RM()) { frame(map, sl, A.n - 1); return; } // reduced motion: the last state, stepped by hand
    frame(map, sl, 0); X.anim.timer = setTimeout(() => play(map, sl), 600);
  }
  function leave() { stop(); X.anim = null; X.year = 2025; RG.rPhoto[0] = PH[0].lid; }

  // ---------- charts (inline SVG; the same greys and red as the map) ----------
  const W0 = 340;
  const svg = (h, body, label) => `<svg class="tr-chart" viewBox="0 0 ${W0} ${h}" width="100%" role="img" aria-label="${esc(label || '')}" dir="ltr">${body}</svg>`;
  const tx = (x, y, s, o) => `<text x="${x}" y="${y}"${o ? ' ' + o : ''}>${esc(s)}</text>`;
  // horizontal bars: rows [{name, v, hi, muni, note}]; same scale inside one chart; null → "no data"
  // 5.53: a word unit (dunams) in an RTL language goes visually to the left of the number, so a right-to-left reader meets the
  // number first, then the word (the chart text is an LTR embed)
  const RTL = () => typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const valTxt = (num, o) => o.uw && RTL() ? (o.u || '').trim() + ' ' + num : num + (o.u || '');
  function hbars(rows, o) {
    o = o || {}; const lw = o.lw || 118, h = rows.length * 20 + 18; const max = o.max || Math.max(...rows.map(r => r.v == null ? 0 : r.v), 1e-9); const w = W0 - lw - 52;
    let b = '';
    rows.forEach((r, i) => { const y = 8 + i * 20;
      b += `<g class="tr-row" ${r.muni ? `data-muni="${esc(r.muni)}"` : ''}${r.fr != null ? ` data-fr="${r.fr}"` : ''}>${tx(lw - 6, y + 11, r.name, 'text-anchor="end" class="lbl"')}`;
      if (r.v == null) b += tx(lw + 4, y + 11, t('r.nodata'), 'class="miss"');
      else { const bw = Math.max(1, r.v / max * w); b += `<rect x="${lw}" y="${y + 2}" width="${bw.toFixed(1)}" height="12" fill="${r.hi ? Q.hot : Q.grey[r.ref ? 2 : 3]}"/>${tx(lw + bw + 4, y + 12, valTxt((o.fmt || ((v) => nf(v, o.d || 0)))(r.v), o), 'class="val"')}`; }
      b += '</g>'; });
    return svg(h, b, o.label);
  }
  const rows5 = (f, o) => (o && o.six ? SIX : FIVE).map(n => ({ name: nmL(n), muni: n, v: f(n), ref: n === 'Granada', hi: o && o.hi && o.hi(n) }));
  const maxOf = (rows) => { let m = -Infinity, k = null; rows.forEach(r => { if (r.v != null && r.v > m) { m = r.v; k = r; } }); return k; };
  function lineChart(series, o) { // series [{name, pts:[[x,y]], col, w, dash}], o: {x0,x1,y0,y1,h,band:[[x,lo,hi]], xt:[...], yfmt, mark}
    const h = o.h || 170, l = 34, r = 10, tp = 10, bt = 20, W = W0 - l - r, H = h - tp - bt;
    const X_ = (x) => l + (x - o.x0) / (o.x1 - o.x0) * W, Y_ = (y) => tp + H - (y - o.y0) / (o.y1 - o.y0) * H;
    let b = '';
    (o.yt || []).forEach(v => { b += `<line x1="${l}" x2="${l + W}" y1="${Y_(v)}" y2="${Y_(v)}" stroke="${Q.chart.grid}"/>${tx(l - 4, Y_(v) + 3, (o.yfmt || nf)(v), 'text-anchor="end" class="ax"')}`; });
    (o.xt || []).forEach(v => { b += tx(X_(v), h - 6, String(v), 'text-anchor="middle" class="ax"'); });
    if (o.band) b += `<path d="${o.band.map((p, i) => (i ? 'L' : 'M') + X_(p[0]).toFixed(1) + ',' + Y_(p[2]).toFixed(1)).join('')}${o.band.slice().reverse().map(p => 'L' + X_(p[0]).toFixed(1) + ',' + Y_(p[1]).toFixed(1)).join('')}Z" fill="${Q.chart.band}" opacity=".7"/>`;
    if (o.split != null) b += `<line x1="${X_(o.split)}" x2="${X_(o.split)}" y1="${tp}" y2="${tp + H}" stroke="${Q.chart.axis}" stroke-dasharray="3 3"/>`;
    series.forEach(s => { const d = s.pts.filter(p => p[1] != null).map((p, i) => (i ? 'L' : 'M') + X_(p[0]).toFixed(1) + ',' + Y_(p[1]).toFixed(1)).join('');
      b += `<path class="tr-line${s.muni ? ' tr-row' : ''}" ${s.muni ? `data-muni="${esc(s.muni)}"` : ''} d="${d}" fill="none" stroke="${s.col}" stroke-width="${s.w || 1.6}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
      if (s.end) { const p = s.pts.filter(q => q[1] != null).slice(-1)[0]; if (p) b += tx(X_(p[0]) + 3, Y_(p[1]) + 3, s.end, 'class="lbl end"'); } });
    if (o.bars) o.bars.forEach(([x, v, col, fr]) => { const bw = W / (o.x1 - o.x0 + 1) * 0.8; b += `<rect ${fr != null ? `data-fr="${fr}"` : ''} x="${(X_(x) - bw / 2).toFixed(1)}" y="${Y_(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y_(o.y0) - Y_(v)).toFixed(1)}" fill="${col}"/>`; });
    return svg(h, b, o.label);
  }
  const CHART = {
    popBar: () => hbars(rows5(n => M(n).pop['2025']), { label: t('r.ch.pop') }) + `<p class="fine">${t('r.lb.granPop', { n: L(nf(M('Granada').pop['2025'])) })}</p>`,
    baseVs: () => { const rows = []; FIVE.forEach(n => { rows.push({ name: nmL(n) + ' · ' + t('r.lb.built'), muni: n, v: DU(M(n).sp.town_ha) }); rows.push({ name: t('r.lb.baseIn'), muni: n, v: DU(M(n).sp.base_ha), hi: true }); });
      return hbars(rows, { u: ' ' + t('r.u.du'), uw: true, label: t('r.ch.basevs'), lw: 150 }); },
    periods: () => { const tot = [0, 0, 0, 0, 0, 0, 0]; X.G.cells.forEach(c => { for (let k = 0; k < 7; k++) tot[k] += c[2 + k]; });
      const rows = PER.map((p, i) => ({ name: perL(p), v: tot[i], fr: i })).concat([{ name: t('r.lb.noyear'), v: tot[6], ref: true }]);
      return hbars(rows, { label: t('r.ch.periods'), lw: 96 }); },
    floors: () => { const c = [0, 0, 0, 0, 0]; X.G.cells.forEach(x => { const v = x[9]; if (x.slice(2, 9).reduce((a, b) => a + b, 0) === 0) return; if (v == null) c[4]++; else c[v < 2.5 ? 0 : v < 3.5 ? 1 : v < 5 ? 2 : 3]++; });
      return hbars([{ name: '1–2', v: c[0] }, { name: '3', v: c[1] }, { name: '4', v: c[2] }, { name: '≥ 5', v: c[3], hi: true }, { name: t('r.lb.nofloors'), v: c[4], ref: true }], { label: t('r.ch.floors'), lw: 160, u: ' ' + t('r.lb.cells') }); },
    floorsNear: () => { const r = X.R.rd1989, a = r.thr36, b = r.thr18; const out = { near: [0, 0], far: [0, 0] };
      X.G.cells.forEach(x => { if (x[9] == null) return; const cx = 437500 + (x[0] + 0.5) * 100, cy = 4113500 - (x[1] + 0.5) * 100; const ll = inv(cx, cy); const d = U().distM(ll, a, b); const k = d <= 2000 ? 'near' : 'far'; out[k][0]++; if (x[9] >= 5) out[k][1]++; });
      X.cache.near = out; return hbars([{ name: t('r.lb.near2k'), v: out.near[0] ? out.near[1] / out.near[0] * 100 : null, hi: true }, { name: t('r.lb.far2k'), v: out.far[0] ? out.far[1] / out.far[0] * 100 : null }], { u: ' %', d: 1, label: t('r.ch.floorsNear'), lw: 150 }); },
    climate: () => { const C = X.R.climate; if (!C.temp) return `<p class="tr-miss">${t('r.nodata')}</p>`; const m = [...Array(12).keys()];
      const mm = (i) => t('r.mon').split(',')[i]; const ax = (s, h) => s.replace('</svg>', m.map(i => tx(34 + (i + 0.5) / 12.3 * 296, h - 4, mm(i), 'text-anchor="middle" class="ax"')).join('') + '</svg>');
      const tmp = ax(lineChart([{ pts: m.map(i => [i, C.temp.max[i]]), col: Q.hot, w: 2, end: t('r.lb.tmax') }, { pts: m.map(i => [i, C.temp.min[i]]), col: Q.ink, w: 1.6, end: t('r.lb.tmin') }],
        { x0: -0.5, x1: 11.8, y0: 0, y1: 36, yt: [0, 10, 20, 30], yfmt: (v) => v + '°', h: 130, label: t('r.ch.temp') }), 130);
      const rn = ax(lineChart([], { x0: -0.5, x1: 11.8, y0: 0, y1: 70, yt: [0, 30, 60], yfmt: (v) => v + ' mm', h: 90, label: t('r.ch.rain'), bars: m.map(i => [i, C.rain[i], Q.grey[2]]) }), 90);
      return `<h4 class="tr-sm">${t('r.ch.temp')}</h4>${tmp}<h4 class="tr-sm">${t('r.ch.rain')}</h4>${rn}<p class="fine">${t('r.ch.rainNote', { r: L(nf(C.rain.reduce((a, b) => a + b, 0)) + ' mm') })}</p><h4 class="tr-sm">${t('r.ch.wind')}</h4>` + rose(C.wind); },
    hot: () => { const C = X.R.climate; if (!C.hot) return ''; const ys = Object.keys(C.hot).map(Number); const mx = Math.max(...Object.values(C.hot));
      let s = lineChart([], { x0: 1990.5, x1: 2024.5, y0: 0, y1: Math.ceil(mx / 10) * 10, yt: [0, 20, 40, 60], xt: [1991, 2000, 2010, 2020], h: 140, label: t('r.ch.hot'), bars: ys.map(y => [y, C.hot[y], y >= 2015 ? Q.hot : Q.grey[3]]) });
      const pr = cmipBand(); if (pr) s += lineChart([{ pts: pr.med, col: Q.hot, w: 2 }], { x0: 1960, x1: 2050, y0: Math.floor(pr.lo) - 1, y1: Math.ceil(pr.hi) + 1, yt: [20, 22, 24, 26].filter(v => v >= pr.lo - 1 && v <= pr.hi + 1), yfmt: (v) => v + '°', xt: [1960, 1990, 2020, 2050], h: 130, band: pr.band, split: 2015, label: t('r.ch.cmip') });
      return s; },
    lst: () => { const C = X.cache.climStats; const rows = rows5(n => M(n).sp.lst).concat([{ name: t('r.lb.baseSurf'), v: C ? C.estate : null, hi: true }, { name: t('r.lb.veg'), v: C ? C.vegetated : null, ref: true }]);
      return hbars(rows, { u: ' °C', d: 1, label: t('r.ch.lst'), max: 55, lw: 120 }) + framePart(); },
    trees: () => hbars(rows5(n => M(n).sp.tree_pct, { six: true }), { u: ' %', d: 1, label: t('r.ch.trees') }),
    air: () => { const A = X.R.climate.air_base, B = X.R.climate.air_city; if (!A) return `<p class="tr-miss">${t('r.nodata')}</p>`; const ks = Object.keys(A).sort();
      const pts = (D, k) => ks.map((m, i) => [i, D[m] && D[m][k]]);
      return lineChart([{ pts: pts(A, 'no2'), col: Q.hot, w: 2, end: t('r.lb.atBase') }, { pts: pts(B, 'no2'), col: Q.ink, w: 1.4, dash: '4 3', end: t('r.lb.atCity') }], { x0: 0, x1: ks.length + 6, y0: 0, y1: 40, yt: [0, 10, 20, 30, 40], h: 140, label: t('r.ch.no2'), xt: [] })
        .replace('</svg>', [0, 12, 24].map(i => tx(34 + i / (ks.length + 6) * 296, 136, ks[i] ? ks[i].slice(0, 4) : '', 'text-anchor="middle" class="ax"')).join('') + '</svg>'); },
    flood: () => { const rows = []; FIVE.forEach(n => { const f = M(n).flood || {}; rows.push({ name: nmL(n) + ' · T100', muni: n, v: f.q100 ? f.q100.bld : null }); rows.push({ name: 'T500', muni: n, v: f.q500 ? f.q500.bld : null, hi: true }); });
      return hbars(rows, { label: t('r.ch.flood'), lw: 150, u: ' ' + t('r.lb.bld') }); },
    seal: () => { const S_ = lu.seal; const rows = []; FIVE.forEach(n => { const h = M(n).sp.lu_ha; const a = S_.dark.reduce((s, k) => s + (h[k] || 0), 0), o = S_.grey.reduce((s, k) => s + (h[k] || 0), 0); rows.push({ name: nmL(n), muni: n, v: a + o ? a / (a + o) * 100 : null }); });
      return hbars(rows, { u: ' %', d: 0, label: t('r.ch.seal'), max: 100 }); },
    farm: () => hbars(rows5(n => { const h = M(n).sp.lu_ha; return DU((h.farmland || 0) + (h.orchard || 0) + (h.meadow || 0)); }), { u: ' ' + t('r.u.du'), uw: true, label: t('r.ch.farm') }),
    popSeries: () => { const ser = SIX.map(n => { const p = M(n).pop, b = p['1996']; return { muni: n, name: nmL(n), pts: Object.keys(p).map(Number).sort().map(y => [y, p[y] / b * 100]), col: n === 'Granada' ? Q.chart.axis : n === 'Las Gabias' ? Q.hot : Q.ink, w: n === 'Granada' ? 1.4 : 1.6, dash: n === 'Granada' ? '4 3' : null, end: nmS(n) }; });
      const mx = Math.max(...ser.flatMap(s => s.pts.map(p => p[1])));
      return lineChart(ser, { x0: 1996, x1: 2033, y0: 50, y1: Math.ceil(mx / 50) * 50, yt: [100, 200, 300].filter(v => v <= mx + 50), xt: [1996, 2005, 2015, 2025], h: 180, label: t('r.ch.series') }); },
    vut: () => hbars(rows5(n => M(n).vut.share, { six: true }), { u: ' %', d: 2, label: t('r.ch.vut'), max: 2.4 }),
    ghs: () => hbars(FIVE.flatMap(n => [{ name: nmL(n) + ' · INE', muni: n, v: M(n).pop['2020'] }, { name: 'GHS-POP', muni: n, v: M(n).sp.ghs_pop, hi: true }]), { label: t('r.ch.ghs'), lw: 150 }) + framePart(),
    pyramid: () => pyramid(X.sel),
    demo: () => { const sm = (k, lbl, u, d) => `<h4 class="tr-sm">${lbl}</h4>` + hbars(rows5(n => k === 'foreign' ? M(n).foreign.share : M(n).demo[k], { six: true, hi: (n) => false }), { u, d, label: lbl, lw: 118 });
      return `<div class="tr-mult">${sm('age', t('r.lb.age'), '', 1)}${sm('u18', t('r.lb.u18'), ' %', 1)}${sm('o65', t('r.lb.o65'), ' %', 1)}${sm('hh', t('r.lb.hh'), '', 1)}${sm('one', t('r.lb.one'), ' %', 1)}${sm('foreign', t('r.lb.foreign'), ' %', 1)}</div>`; },
    incsrc: () => { const rows = []; SIX.forEach(n => { const s = M(n).incsrc; rows.push({ name: nmL(n), muni: n, v: s.pens, ref: n === 'Granada' }); });
      return `<h4 class="tr-sm">${t('r.lb.pens')}</h4>` + hbars(rows, { u: ' %', d: 1, label: t('r.lb.pens') }) + `<h4 class="tr-sm">${t('r.lb.unempInc')}</h4>` + hbars(rows5(n => M(n).incsrc.unemp, { six: true }), { u: ' %', d: 1, label: t('r.lb.unempInc') }); },
    reach: () => `<h4 class="tr-sm">${t('r.lb.reachEdu')}</h4>` + hbars(rows5(n => M(n).sp.reach500_education), { u: ' %', d: 0, max: 100 }) + `<h4 class="tr-sm">${t('r.lb.reachHealth')}</h4>` + hbars(rows5(n => M(n).sp.reach500_health), { u: ' %', d: 0, max: 100 }) + framePart(),
    shops: () => hbars(rows5(n => { const s = M(n).sp; return s.n_retail == null ? null : s.n_retail + s.n_food + s.n_service; }), { label: t('r.ch.shops'), u: '' }) + framePart(),
    publicSp: () => `<h4 class="tr-sm">${t('r.lb.squares')}</h4>` + hbars(rows5(n => M(n).sp.n_square), {}) + `<h4 class="tr-sm">${t('r.lb.parks')}</h4>` + hbars(rows5(n => M(n).sp.n_park), {}) + framePart(),
    jobs: () => { const G = [['A'], ['BE'], ['F'], ['G', 'H', 'I'], ['JN'], ['O'], ['P', 'Q'], ['RU']]; const keys = ['agri', 'ind', 'cons', 'trade', 'prof', 'pub', 'social', 'other'];
      const share = (n, g) => { const s_ = M(n).jobs.sector, tot = Object.values(s_).reduce((a, b) => a + (b || 0), 0); return g.reduce((a, k) => a + (s_[k] || 0), 0) / tot * 100; };
      const head = `<tr><th>${t('r.jobs.sector')}</th>${SIX.map(n => `<th data-muni="${esc(n)}" class="tr-row" title="${esc(nmL(n))}">${esc(nmS(n))}</th>`).join('')}</tr>`;
      const body = G.map((g, r) => { const vs = SIX.map(n => share(n, g)); const mx = Math.max(...vs.slice(0, 5));
        return `<tr${keys[r] === 'pub' ? ' class="hi"' : ''}><th scope="row">${t('r.jobs.' + keys[r])}</th>${vs.map((v, i) => `<td data-muni="${esc(SIX[i])}" class="tr-row${i < 5 && v === mx ? ' max' : ''}">${L(nf(v, 1) + ' %')}<i class="tr-mini" style="width:${Math.round(v / 40 * 100)}%"></i></td>`).join('')}</tr>`; }).join('');
      const tot = `<tr><th scope="row">${t('r.jobs.total')}</th>${SIX.map(n => `<td>${L(nf(M(n).jobs.employed))}</td>`).join('')}</tr>`;
      return `<div class="tr-table-w"><table class="tr-table tr-jobs">${head}${body}${tot}</table></div><p class="fine">${t('r.jobs.src', { y: M('Armilla').jobs.year })}</p>`; },
    unemp: () => { const m = X.R.sepe_month; return `<h4 class="tr-sm">${t('r.lb.censusRate', { y: M('Armilla').act.year })}</h4>` + hbars(rows5(n => M(n).act.rate, { six: true }), { u: ' %', d: 1 }) +
      `<h4 class="tr-sm">${t('r.lb.sepePer', { m: m ? m.slice(0, 4) + '-' + m.slice(4) : '—' })}</h4>` + hbars(rows5(n => { const s = M(n).sepe && M(n).sepe[m]; const p = M(n).act; return s && p.employed ? s.total / (p.employed + p.unemployed + p.inactive) * 1000 : null; }, { six: true }), { d: 0, u: ' ‰' }); },
    bus: () => hbars(rows5(n => IND.bus.v(n), { six: true }), { label: t('r.ch.bus'), u: '' }),
    change: () => hbars(rows5(n => { const h = M(n).sp.lu_ha; return DU((h.greenfield || 0) + (h.construction || 0) + (h.brownfield || 0)); }), { u: ' ' + t('r.u.du'), uw: true, d: 0, label: t('r.ch.change') }) + `<p class="fine">${t('r.ch.changeKey')}</p>`,
    table: () => table(),
    indicator: () => `<div class="tr-pick" role="group">${Object.keys(IND).map(k => `<button type="button" class="btn btn-small" data-ind="${k}" aria-pressed="${k === X.ind}">${t('r.ind.' + k)}</button>`).join('')}</div>` + hbars(rows5(IND[X.ind].v, { hi: (n) => { const r = maxOf(rows5(IND[X.ind].v)); return r && r.muni === n; } }), { u: IND[X.ind].u, d: IND[X.ind].d }),
    proj: () => projChart(),
    scen: () => `<div class="tr-pick" role="group">${['A', 'B', 'C'].map(k => `<button type="button" class="btn btn-small" data-scen="${k}" aria-pressed="${k === X.scen}">${t('r.sc.' + k)}</button>`).join('')}</div>` + scenTable(),
    gaps: () => `<ul class="tr-gaps">${MISS.map(k => `<li><b>${t('r.miss.' + k)}</b><br><span class="fine">${t('r.missw.' + k)}</span></li>`).join('')}</ul><p><button type="button" class="btn btn-small" data-tour="inv">${t('r.inv')}</button></p>`,
  };
  // 5.53: Las Gabias and Alhendín reach beyond the 12 × 10 km analysis frame (mountain land), but the frame holds 99.6 % and
  // 100 % of their mapped buildings: their figures cover the part inside the frame, and the chart says so
  const framePart = () => { const xs = FIVE.filter(n => M(n).sp.frame_part); return xs.length ? `<p class="fine">* ${t('r.framePart', { t: xs.map(n => nmL(n) + ' (' + nf(M(n).sp.bld_frame_pct, 1) + ' %)').join(', ') })}</p>` : ''; };
  function legendImg(kind) { const st = IMG[kind]; if (!st || !st.breaks) return ''; const fmt = (v) => nf(v, st.d); const lab = [`< ${fmt(st.breaks[0])}${st.unit}`]; for (let i = 1; i < st.breaks.length; i++) lab.push(`${fmt(st.breaks[i - 1])}–${fmt(st.breaks[i])}${st.unit}`); lab.push(`≥ ${fmt(st.breaks[st.breaks.length - 1])}${st.unit}`);
    return `<ul class="lg">${st.cols.map((c, i) => `<li><i class="sw" style="background:${c}"></i><span>${L(lab[i])}</span></li>`).join('')}</ul>`; }
  function rose(w) { if (!w) return ''; const cx = 70, cy = 66, R0 = 56, mx = Math.max(...w.rose); const D8 = t('r.dirs').split(',');
    let b = [0.5, 1].map(f => `<circle cx="${cx}" cy="${cy}" r="${R0 * f}" fill="none" stroke="${Q.chart.grid}"/>`).join('');
    w.rose.forEach((v, i) => { const a0 = (i * 45 - 22.5 - 90) * Math.PI / 180, a1 = (i * 45 + 22.5 - 90) * Math.PI / 180, r = v / mx * R0; b += `<path d="M${cx},${cy}L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)}A${r},${r} 0 0 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}Z" fill="${v === mx ? Q.hot : Q.grey[3]}"/>`;
      const al = (i * 45 - 90) * Math.PI / 180; b += tx(cx + (R0 + 9) * Math.cos(al), cy + (R0 + 9) * Math.sin(al) + 3, D8[i], 'text-anchor="middle" class="ax"'); });
    return svg(140, b, t('r.ch.wind')).replace('<svg ', '<svg style="max-width:230px" ') + `<p class="fine">${t('r.lb.windFrom')} · ${t('r.lb.calm', { p: L(nf(w.calm, 0) + ' %') })}</p>`; }
  function cmipBand() { const C = X.R.climate.cmip6; if (!C) return null; const ms = Object.values(C); const band = [], med = []; let lo = 99, hi = -99;
    for (let y = 1960; y <= 2050; y++) { const v = ms.map(m => m[y]).filter(x => x != null).sort((a, b) => a - b); if (v.length < 3) continue; const md = v[Math.floor(v.length / 2)]; band.push([y, v[0], v[v.length - 1]]); med.push([y, md]); lo = Math.min(lo, v[0]); hi = Math.max(hi, v[v.length - 1]); }
    // 11-year running mean for readability (the band keeps the yearly spread)
    const sm = med.map((p, i) => { const w = med.slice(Math.max(0, i - 5), i + 6); return [p[0], w.reduce((a, q) => a + q[1], 0) / w.length]; });
    return { band, med: sm, lo, hi }; }
  function pyramid(n) {
    const p = M(n).pyr, a = p['2022'], b = p['2012']; if (!a || !a.Hombres) return `<p class="tr-miss">${t('r.nodata')}</p>`;
    const tot = a.Hombres.concat(a.Mujeres).reduce((s, v) => s + (v || 0), 0), totB = b.Hombres.concat(b.Mujeres).reduce((s, v) => s + (v || 0), 0);
    const G = 21, rh = 7.4, h = G * rh + 30, cx = W0 / 2, w = W0 / 2 - 36, mx = 6;
    let s = `<line x1="${cx}" x2="${cx}" y1="6" y2="${G * rh + 8}" stroke="${Q.chart.axis}"/>`;
    for (let i = 0; i < G; i++) { const y = 8 + (G - 1 - i) * rh; const m = (a.Hombres[i] || 0) / tot * 100, f = (a.Mujeres[i] || 0) / tot * 100, m0 = (b.Hombres[i] || 0) / totB * 100, f0 = (b.Mujeres[i] || 0) / totB * 100;
      s += `<rect x="${cx - m / mx * w}" y="${y}" width="${m / mx * w}" height="${rh - 1}" fill="${Q.chart.male}"/><rect x="${cx}" y="${y}" width="${f / mx * w}" height="${rh - 1}" fill="${Q.chart.female}"/>`;
      s += `<path d="M${cx - m0 / mx * w},${y}v${rh - 1}M${cx + f0 / mx * w},${y}v${rh - 1}" stroke="${Q.hot}" stroke-width="1.6"/>`;
      if (i % 4 === 0) s += tx(4, y + rh - 1, (i * 5) + '', 'class="ax"'); }
    s += tx(cx - 8, G * rh + 22, t('r.lb.men'), 'text-anchor="end" class="lbl"') + tx(cx + 8, G * rh + 22, t('r.lb.women'), 'class="lbl"') + tx(W0 - 4, G * rh + 22, '6 %', 'text-anchor="end" class="ax"');
    const pick = `<div class="tr-pick" role="group">${FIVE.concat(['Granada']).map(k => `<button type="button" class="btn btn-small" data-muni-pick="${esc(k)}" aria-pressed="${k === n}">${esc(nmL(k))}</button>`).join('')}</div>`;
    return pick + svg(h, s, t('r.ch.pyr', { n: nmL(n) })) + `<p class="fine">${t('r.ch.pyrKey')}</p>`;
  }
  function trend(n, y0, y1) { const p = M(n).pop; const xs = [], ys = []; for (let y = y0; y <= y1; y++) if (p[y] != null) { xs.push(y); ys.push(p[y]); }
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length; let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; }); const b = sxy / sxx; return (y) => my + b * (y - mx); }
  function projChart() {
    const out = {}; const ser = []; let mx = 0;
    FIVE.forEach(n => { const a = trend(n, 2005, 2025), b = trend(n, 2015, 2025); const p = M(n).pop; out[n] = [a(2076), b(2076)];
      const hist = Object.keys(p).map(Number).sort().map(y => [y, p[y]]); mx = Math.max(mx, ...out[n], ...hist.map(q => q[1]));
      ser.push({ muni: n, pts: hist, col: Q.ink, w: 1.6 }); ser.push({ muni: n, pts: [[2025, p['2025']], [2076, Math.max(out[n][0], out[n][1])]], col: Q.hot, w: 1.2, dash: '4 3', end: nmS(n) }); ser.push({ muni: n, pts: [[2025, p['2025']], [2076, Math.min(out[n][0], out[n][1])]], col: Q.hot, w: 1.2, dash: '4 3' }); });
    X.cache.proj = out;
    return lineChart(ser, { x0: 1996, x1: 2090, y0: 0, y1: Math.ceil(mx / 10000) * 10000, yt: [0, 10000, 20000, 30000, 40000, 50000].filter(v => v <= mx + 10000), yfmt: (v) => v / 1000 + 'k', xt: [2000, 2025, 2050, 2076], split: 2025, h: 190, label: t('r.ch.proj') });
  }
  function scenTable() { const k = X.scen; return `<p><b>${t('r.sc.' + k)}</b> — ${t('r.sc.' + k + '.a')}</p><p class="fine"><b>${t('r.sc.test')}</b> ${t('r.sc.' + k + '.q')}</p>`; }
  function table() {
    const rows = [['pop', (n) => M(n).pop['2025'], '', 0, 'official'], ['chg', (n) => IND.chg.v(n), ' %', 1, 'official'], ['age', (n) => M(n).demo.age, '', 1, 'official'], ['o65', (n) => M(n).demo.o65, ' %', 1, 'official'],
      ['hh', (n) => M(n).demo.hh, '', 1, 'official'], ['unemp', (n) => M(n).act.rate, ' %', 1, 'official'], ['inc', (n) => X.cache.area && X.cache.area[n] && X.cache.area[n].inc, ' €', 0, 'official'],
      ['vut', (n) => M(n).vut.share, ' %', 2, 'official'], ['lst', (n) => M(n).sp.lst, ' °C', 1, 'spatial'], ['tree', (n) => M(n).sp.tree_pct, ' %', 1, 'spatial'], ['reach', (n) => M(n).sp.reach500_education, ' %', 0, 'spatial'],
      ['bus', (n) => IND.bus.v(n), '', 0, 'official'], ['baseha', (n) => DU(M(n).sp.base_ha), ' ' + t('r.u.du'), 0, 'spatial'], ['flood', (n) => M(n).flood && M(n).flood.q500 ? M(n).flood.q500.bld : null, '', 0, 'official']];
    const head = `<tr><th></th>${FIVE.map(n => `<th data-muni="${esc(n)}" class="tr-row" title="${esc(nmL(n))}">${esc(nmS(n))}</th>`).join('')}</tr>`;
    const body = rows.map(([k, f, u, d, kind]) => { const vs = FIVE.map(f); const mx = Math.max(...vs.filter(v => v != null)); const mn = Math.min(...vs.filter(v => v != null));
      return `<tr><th scope="row"><span class="tr-kind k-${kind}" aria-hidden="true">${KIND[kind]}</span> ${t('r.ind.' + k)}</th>${vs.map((v, i) => { const w = v == null || mx === mn ? 0 : (v - Math.min(0, mn)) / (mx - Math.min(0, mn)) * 100;
        return `<td data-muni="${esc(FIVE[i])}" class="tr-row${v === mx && v != null ? ' max' : ''}">${v == null ? `<em>${t('r.nodata')}</em>` : `${/^ [^\s%€°]/.test(u) ? L(nf(v, d)) + u : L(nf(v, d) + u)}<i class="tr-mini" style="width:${w.toFixed(0)}%"></i>`}</td>`; }).join('')}</tr>`; }).join('');
    return `<div class="tr-table-w"><table class="tr-table">${head}${body}</table></div><p class="fine">${t('r.tableKey')}</p>`;
  }
  const MISS = ['floods', 'easement', 'acnoise', 'airst', 'pgou', 'price', 'migr', 'move', 'drain', 'jobsplace', 'baseinside', 'crops', 'c2076'];

  // ---------- labels on the map (HTML, placed by the engine) ----------
  function labels(sl) {
    if (!X.R || !X.lp || !sl) return [];
    const out = []; const TD = S_D(); const core = (n) => { const f = TD && TD.towns && TD.towns.features.find(g => g.properties.k === 'core' && g.properties.nm === n); return f && f.properties.lp; };
    // 5.53: the five towns are labelled at their town centre (inside the closer analysis view), the rest at the municipality's pole
    const lp = (n) => core(n) || X.lp[n]; const it = (n, html, cls, prio) => out.push({ id: sl.id + '-' + n, ll: lp(n), html, cls: cls || 'muni five', prio: prio == null ? 1 : prio });
    const v = (s) => `<span class="v" dir="ltr">${esc(s)}</span>`;
    if (sl.labels === 'names') SIX.forEach(n => it(n, `<b dir="auto">${esc(nmL(n))}</b>`, n === 'Granada' ? 'muni' : 'muni five', n === 'Granada' ? 0 : 1));
    if (sl.labels === 'names5') FIVE.forEach(n => it(n, `<b dir="auto">${esc(nmL(n))}</b>`));
    if (sl.labels === 'clim') { const C = X.R.climate, b = U().bboxOf([S_D().base.geometry]); const c = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
      if (C.temp) out.push({ id: 'clim-facts', ll: c, html: `<b>${esc(t('r.lb.climMap'))}</b><span class="v" dir="auto">${esc(t('r.lb.climFacts', { mx: nf(C.temp.max[6], 1), mn: nf(C.temp.min[0], 1), r: nf(C.rain.reduce((a, q) => a + q, 0)) }))}</span>`, cls: 'muni five', prio: 0, avoidAnchor: true });
      if (C.cell) out.push({ id: 'clim-cell', ll: [C.cell[1], C.cell[0]], html: `<b>${esc(t('r.lb.cellPt'))}</b><span class="v" dir="ltr">${C.cell[0].toFixed(3)} N · ${Math.abs(C.cell[1]).toFixed(3)} W · ${nf(C.cell[2])} m</span>`, cls: 'muni', prio: 0, avoidAnchor: true }); }
    if (sl.labels === 'baseShare') FIVE.forEach(n => it(n, `<b dir="auto">${esc(nmL(n))}</b>${v(t('r.lb.baseInV', { h: nf(DU(M(n).sp.base_ha), 0) }))}`));
    if (sl.labels === 'lst') FIVE.forEach(n => it(n, `<b dir="auto">${esc(nmL(n))}</b>${M(n).sp.lst == null ? `<span class="v miss">${esc(t('v36.outside'))}</span>` : v(nf(M(n).sp.lst, 1) + ' °C')}`));
    if (sl.labels === 'popYear') FIVE.forEach(n => { const y = String(X.year || 2025); const p = M(n).pop[y]; it(n, `<b dir="auto">${esc(nmL(n))}</b>${p == null ? `<span class="v miss">${esc(t('r.nodata'))}</span>` : v(nf(p))}`); });
    if (sl.labels === 'sepe') { const m = X.R.sepe_month; FIVE.forEach(n => { const s = M(n).sepe && M(n).sepe[m]; it(n, `<b dir="auto">${esc(nmL(n))}</b>${s ? v(nf(s.total)) : `<span class="v miss">${esc(t('r.nodata'))}</span>`}`); }); }
    if (sl.labels === 'ind') { const f = IND[X.ind]; FIVE.forEach(n => { const x = f.v(n); it(n, `<b dir="auto">${esc(nmL(n))}</b>${x == null ? `<span class="v miss">${esc(t('r.nodata'))}</span>` : v((f.sign ? sgn(x, f.d) : nf(x, f.d)) + f.u)}`); }); }
    if (sl.pts === 'thr' || sl.pts === 'rd') { const r = X.R.rd1989; out.push({ id: 'thr18', ll: r.thr18.slice(0, 2), html: `<b>18</b><span class="v" dir="ltr">${r.thr18[2]} m</span>`, cls: 'muni five', prio: 0, avoidAnchor: true });
      out.push({ id: 'thr36', ll: r.thr36.slice(0, 2), html: `<b>36</b><span class="v" dir="ltr">${r.thr36[2]} m</span>`, cls: 'muni five', prio: 0, avoidAnchor: true }); }
    return out;
  }

  // ---------- popups ----------
  function popup(sl, e, map) {
    const lay = ['r-pts', 'r-human', 'r-grid', 'r-gridlv', 'r-flood', 'r-lu', 'r-five', 'r-choro'].map(ID).filter(id => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') === 'visible');
    const fs = lay.length ? map.queryRenderedFeatures([[e.point.x - 3, e.point.y - 3], [e.point.x + 3, e.point.y + 3]], { layers: lay }) : [];
    const f = fs[0]; let html = null;
    if (f && f.layer.id === ID('r-pts')) { const p = f.properties; html = `<b dir="auto">${esc(p.nm || t('r.pt.' + p.k) || p.k)}</b><table>${p.trips != null ? `<tr><td>${t('r.lb.trips')}</td><td>${L(nf(p.trips))}</td></tr>` : ''}${p.e != null ? `<tr><td>${t('r.lb.elev')}</td><td>${L(p.e + ' m')}</td></tr>` : ''}${p.cls ? `<tr><td>${t('r.lb.type')}</td><td>${esc(p.cls)}</td></tr>` : ''}</table>`; }
    else if (f && (f.layer.id === ID('r-grid') || f.layer.id === ID('r-gridlv'))) { const c = JSON.parse(f.properties.c || '[]'); html = `<b>${t('r.lb.cell')}</b><table>${PER.map((p, i) => `<tr><td>${perL(p)}</td><td>${L(nf(c[i]))}</td></tr>`).join('')}<tr><td>${t('r.lb.noyear')}</td><td>${L(nf(c[6]))}</td></tr><tr><td>${t('r.lb.floorsMed')}</td><td>${f.properties.lv != null && f.properties.lv !== 'null' ? L(nf(+f.properties.lv, 1)) : `<em>${t('r.nodata')}</em>`}</td></tr></table>`; }
    else if (f && f.layer.id === ID('r-flood')) html = `<b>${t('r.fl.' + f.properties.k)}</b><p class="fine">${t('r.fl.note')}</p>`;
    else if (f && f.layer.id === ID('r-human')) html = `<b dir="auto">${esc(f.properties.n || t('r.pt.' + f.properties.k))}</b>`;
    else if (f && f.layer.id === ID('r-lu')) html = `<b dir="ltr">landuse=${esc(f.properties.lu)}</b><p class="fine">OpenStreetMap</p>`;
    if (!html) { const o = map.queryRenderedFeatures(e.point, { layers: [ID('r-five'), ID('r-choro')].filter(id => map.getLayer(id)) }); const pt = [e.lngLat.lng, e.lngLat.lat];
      const hit = X.R.outline.features.find(q => q.properties.five && (q.geometry.type === 'Polygon' ? [q.geometry.coordinates] : q.geometry.coordinates).some(p => inRing(pt, p[0])));
      const n = hit ? hit.properties.name : o[0] && o[0].properties.name; if (n) html = muniPop(n); }
    return html;
  }
  function inRing(pt, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }
  function muniPop(n) { const m = M(n); const row = (k, v) => `<tr><td>${t(k)}</td><td>${v}</td></tr>`;
    return `<b dir="auto">${esc(nmL(n))}</b><table>${row('r.ind.pop', L(nf(m.pop['2025'])))}${row('r.ind.age', L(nf(m.demo.age, 1)))}${row('r.ind.unemp', L(nf(m.act.rate, 1) + ' %'))}${row('r.ind.baseha', du(m.sp.base_ha))}${row('r.ind.lst', m.sp.lst == null ? `<em>${t('v36.outside')}</em>` : L(nf(m.sp.lst, 1) + ' °C'))}</table><small>INE · IGN · ${t('r.popSrc')}</small>`; }

  // ---------- card parts ----------
  function srcInfo(k) { if (X.R && X.R.sources[k]) { const s = X.R.sources[k]; return { name: s.name, year: s.year, kind: s.kind, method: s.method, url: s.url }; } const l = LSRC[k]; return l ? { name: l[0], year: l[1], kind: l[2], method: l[3] } : null; }
  function badge(kind, tip) { return `<span class="tr-kind k-${kind}" tabindex="0" role="note" title="${esc(tip)}" aria-label="${esc(t('r.kind.' + kind) + ' — ' + tip)}">${KIND[kind]} ${esc(t('r.kind.' + kind))}</span>`; }
  function sources(sl) { const xs = (sl.src || []).map(k => [k, srcInfo(k)]).filter(x => x[1]); if (!xs.length) return '';
    return `<ul class="tr-srcs">${xs.map(([k, s]) => `<li>${badge(s.kind, `${s.name} · ${s.year} · ${s.method}`)} <span dir="ltr">${esc(s.name)}, ${esc(String(s.year))}</span></li>`).join('')}</ul>`; }
  // the values each slide's text needs (computed from the data, never typed in)
  function vals(sl, D) {
    const R = X.R, five = (k) => FIVE.map(n => k(n));
    const pop25 = FIVE.reduce((s, n) => s + M(n).pop['2025'], 0);
    const V = { base: nf(DU(R.base.area_ha)), pop5: nf(pop25), gran: nf(M('Granada').pop['2025']) };
    const towns = FIVE.map(n => [n, M(n).sp.town_ha]); V.smaller = towns.filter(x => x[1] < R.base.area_ha).length;
    V.biggestIn = nmL(Object.entries(R.base.by_muni).sort((a, b) => b[1] - a[1])[0][0]); V.biggestInHa = nf(DU(Object.entries(R.base.by_muni).sort((a, b) => b[1] - a[1])[0][1]));
    const C = R.climate; if (C.hot) { const avg = (a, b) => { let s = 0, k = 0; for (let y = a; y <= b; y++) { s += C.hot[y]; k++; } return s / k; }; V.hot90 = nf(avg(1991, 2000), 0); V.hot20 = nf(avg(2015, 2024), 0); V.hotMax = nf(Math.max(...Object.values(C.hot))); V.hotMaxY = Object.keys(C.hot).find(y => C.hot[y] === Math.max(...Object.values(C.hot))); }
    if (C.temp) { V.jul = nf(C.temp.max[6], 1); V.jan = nf(C.temp.min[0], 1); }
    V.rain = nf(C.rain.reduce((a, b) => a + b, 0)); V.dry = nf(C.rain[6], 1);
    const pr = cmipBand(); if (pr) { const at = (y) => (pr.med.find(p => p[0] === y) || [0, null])[1]; V.c2020 = nf(at(2020), 1); V.c2050 = nf(at(2045), 1); }
    const cs = X.cache.climStats; if (cs) { V.lstBase = nf(cs.estate, 1); V.lstFrame = nf(cs.median_frame, 1); V.lstVeg = nf(cs.vegetated, 1); }
    const fl = R.base.flood_ha || {}; V.bq100 = nf(DU(fl.q100)); V.bq500 = nf(DU(fl.q500)); V.bdph = nf(DU(fl.dph));
    V.fl500 = nf(FIVE.reduce((s, n) => s + (M(n).flood && M(n).flood.q500 ? M(n).flood.q500.bld : 0), 0)); V.flTop = nmL(FIVE.slice().sort((a, b) => ((M(b).flood || {}).q500 || {}).bld - ((M(a).flood || {}).q500 || {}).bld)[0]);
    const st = D.edge.stats; V.open = nf((st.fence_share.open + st.fence_share.green) * 100); V.housing = nf(st.fence_share.housing * 100); V.per = nf(st.perimeter_km, 1);
    const farm = (n) => { const h = M(n).sp.lu_ha; return (h.farmland || 0) + (h.orchard || 0) + (h.meadow || 0); }; V.farm5 = nf(DU(FIVE.reduce((s, n) => s + farm(n), 0)));
    const vut = (n) => M(n).vut; V.vutG = nf(vut('Granada').share, 2); V.vutMax = nf(Math.max(...five(n => vut(n).share)), 2); V.vutN = nf(FIVE.reduce((s, n) => s + vut(n).n, 0)); V.vutY = vut('Armilla').year;
    const p = (n, y) => M(n).pop[y]; V.g96 = nf((p('Las Gabias', '2025') / p('Las Gabias', '1996') - 1) * 100, 0); V.gr96 = sgn((p('Granada', '2025') / p('Granada', '1996') - 1) * 100, 0); V.f96 = nf((pop25 / FIVE.reduce((s, n) => s + p(n, '1996'), 0) - 1) * 100, 0);
    V.ageMin = nmL(FIVE.slice().sort((a, b) => M(a).demo.age - M(b).demo.age)[0]); V.ageMinV = nf(Math.min(...five(n => M(n).demo.age)), 1); V.ageG = nf(M('Granada').demo.age, 1);
    V.o65G = nf(M('Granada').demo.o65, 1); V.u18max = nf(Math.max(...five(n => M(n).demo.u18)), 1); V.hhG = nf(M('Granada').demo.hh, 1);
    V.forMax = nmL(FIVE.slice().sort((a, b) => M(b).foreign.share - M(a).foreign.share)[0]); V.forMaxV = nf(Math.max(...five(n => M(n).foreign.share)), 1);
    V.pensMax = nmL(FIVE.slice().sort((a, b) => M(b).incsrc.pens - M(a).incsrc.pens)[0]); V.pensMaxV = nf(Math.max(...five(n => M(n).incsrc.pens)), 1); V.pensG = nf(M('Granada').incsrc.pens, 1);
    const rc = FIVE.filter(n => M(n).sp.reach500_education != null); V.reachMin = nmL(rc.slice().sort((a, b) => M(a).sp.reach500_education - M(b).sp.reach500_education)[0]); V.reachMinV = nf(Math.min(...rc.map(n => M(n).sp.reach500_education)), 0);
    V.shopG = nf(M('Las Gabias').sp.n_retail); V.shopH = nf(M('Alhendín').sp.n_retail);
    if (X.gy) V.gy = X.gy; const g25 = (n) => M(n).sp.yr_pct; V.yrMin = nf(Math.min(...five(g25)), 0); V.yrMax = nf(Math.max(...five(g25)), 0);
    V.shopA = nf(M('Armilla').sp.n_retail); V.shopC = nf(M('Churriana de la Vega').sp.n_retail); V.shopO = nf(M('Ogíjares').sp.n_retail);
    V.adm = nf(Math.max(...five(n => M(n).jobs.sector.O / M(n).jobs.employed * 100)), 1); V.agri = nf(Math.max(...five(n => M(n).jobs.sector.A / M(n).jobs.employed * 100)), 1);
    V.uMin = nf(Math.min(...five(n => M(n).act.rate)), 1); V.uMax = nf(Math.max(...five(n => M(n).act.rate)), 1); V.uG = nf(M('Granada').act.rate, 1); V.uY = M('Armilla').act.year; V.sepeM = R.sepe_month ? R.sepe_month.slice(0, 4) + '-' + R.sepe_month.slice(4) : '—';
    V.sepe5 = nf(FIVE.reduce((s, n) => s + ((M(n).sepe || {})[R.sepe_month] || { total: 0 }).total, 0));
    const bus = (n) => IND.bus.v(n); V.busMin = nmL(FIVE.slice().sort((a, b) => bus(a) - bus(b))[0]); V.busMinV = nf(Math.min(...five(bus))); V.busG = nf(bus('Granada'));
    V.rwy = nf(R.rd1989.runway.length_m); V.ref = R.rd1989.ref[2]; V.t18 = R.rd1989.thr18[2]; V.t36 = R.rd1989.thr36[2]; V.drop = R.rd1989.thr36[2] - R.rd1989.thr18[2];
    if (X.cache.near) { const nr = X.cache.near; V.near5 = nf(nr.near[0] ? nr.near[1] / nr.near[0] * 100 : 0, 1); V.far5 = nf(nr.far[0] ? nr.far[1] / nr.far[0] * 100 : 0, 1); V.nearN = nf(nr.near[0]); }
    const tot = [0, 0, 0, 0, 0, 0, 0]; X.G.cells.forEach(c => { for (let k = 0; k < 7; k++) tot[k] += c[2 + k]; }); const all = tot.reduce((a, b) => a + b, 0);
    V.since80 = nf((tot[4] + tot[5]) / (all - tot[6]) * 100, 0); V.noyear = nf(tot[6] / all * 100, 0); V.bld = nf(all);
    let lvC = 0, bC = 0; X.G.cells.forEach(c => { if (c.slice(2, 9).some(v => v > 0)) { bC++; if (c[9] != null) lvC++; } }); V.lvCov = nf(lvC / bC * 100, 0);
    if (X.cache.proj) { const pj = X.cache.proj; V.pjLo = nf(FIVE.reduce((s, n) => s + Math.min(...pj[n]), 0)); V.pjHi = nf(FIVE.reduce((s, n) => s + Math.max(...pj[n]), 0)); }
    const ch = (n) => { const h = M(n).sp.lu_ha; return (h.greenfield || 0) + (h.construction || 0) + (h.brownfield || 0); }; V.chg5 = nf(DU(FIVE.reduce((s, n) => s + ch(n), 0)));
    Object.keys(V).forEach(k => { if (typeof V[k] === 'string' && /\d/.test(V[k])) V[k] = L(V[k]); });
    return V;
  }
  function card(sl, D, legacyHTML) {
    const V = vals(sl, D); const k = 'r.' + sl.id;
    const ch = CHART[sl.chart] ? CHART[sl.chart]() : '';
    const tl = sl.anim ? `<div class="tr-tl" id="tr-tl"><button type="button" class="btn btn-small" data-tour="play" aria-pressed="false">${t('r.play')}</button><input type="range" min="0" max="${ANIM[sl.anim].n - 1}" step="1" value="${X.anim ? X.anim.i : 0}" aria-label="${esc(t('r.timeline'))}"><output dir="ltr"></output></div>` : '';
    const body = sl.old ? legacyHTML : `<p>${t(k + '.b', V)}</p>`;
    const lg = sl.old ? '' : legend(sl);
    return `${body}${tl}${ch ? `<div class="tr-ch">${ch}</div>` : ''}${lg}
      <div class="tr-find"><b>${t('r.evidence')}</b> ${t(k + '.c', V)}</div>
      <p class="tr-link tr-${sl.link}"><b>${t('r.link')}</b> <span class="tr-lk">${t('r.lk.' + sl.link)}</span> ${t(k + '.l', V)}</p>
      ${sources(sl)}`;
  }
  function legend(sl) {
    const li = (sw, l) => `<li>${sw}<span>${l}</span></li>`, fill = (c, ex) => `<i class="sw" style="background:${c}${ex || ''}"></i>`, line = (c, w, d) => `<i class="sw ln" style="border-top:${w}px ${d ? 'dashed' : 'solid'} ${c}"></i>`;
    const out = []; const g = new Set(sl.groups || []);
    if (g.has('base')) out.push(li(fill(P.tour.baseFill, `;opacity:.45;border:2.5px solid ${P.tour.baseLine}`), t('tour.lgBase')));
    if (g.has('rBaseLine')) out.push(li(line(Q.hot, 3), t('tour.lgBase')));
    if (g.has('rFive')) out.push(li(line(Q.outline, 2), t('r.lg.five')));
    if (g.has('rGran')) out.push(li(line(Q.ink3, 2, true), t('r.lg.gran')));
    if (g.has('rMuni')) out.push(li(line(Q.outlineSoft, 1), t('r.lg.muni')));
    if (g.has('rHist')) out.push(li(fill(Q.grey[4]), t('r.lg.histOld')), li(fill(Q.grey[1]), t('r.lg.histNew')), li(line(Q.hot, 3), t('r.lg.histCur')));
    if (g.has('rGrid') && sl.gridOnly == null) out.push(li(fill(Q.grey[4]), t('r.lg.gridOld')), li(fill(Q.grey[2]), t('r.lg.gridNew')), li(fill(Q.hot), t('r.lg.gridCur')), li(fill(Q.unknown, `;border:1px solid ${Q.unknownLine}`), t('r.lg.unknown')));
    if (sl.gridOnly != null) out.push(li(fill(Q.hot), t('r.lg.grid2000')));
    if (g.has('rGridLv')) out.push(li(fill(Q.grey[1]), '1–2 ' + t('r.lb.floorsU')), li(fill(Q.grey[2]), '3'), li(fill(Q.grey[3]), '4'), li(fill(Q.hot), '≥ 5'), li(fill(Q.unknown, `;border:1px solid ${Q.unknownLine}`), t('r.lb.nofloors')));
    if (sl.img) out.push(legendImg(sl.img).replace(/^<ul class="lg">|<\/ul>$/g, ''));
    if (sl.img === 'wc') out.push(li(fill(Q.grey[3]), t('v36.wcTree')));
    if (g.has('rFlood')) out.push(li(fill(Q.flood.q10), t('r.fl.q10')), li(fill(Q.flood.q100), t('r.fl.q100')), li(fill(Q.flood.q500), t('r.fl.q500')));
    if (g.has('rFloodLine')) out.push(li(line(Q.water, 2, true), t('r.fl.q500')));
    if (g.has('rDph')) out.push(li(fill(Q.flood.q500), t('r.fl.dph')));
    if (g.has('rWater')) out.push(li(line(Q.water, 2), t('r.lg.water')), ...(sl.water === 'irr' ? [li(line(Q.hot, 2), t('r.lg.irr'))] : []));
    if (g.has('rFlow')) out.push(li(line(Q.water, 3), t('r.lg.flow')));
    if (sl.lu) { const m = lu[sl.lu]; if (m.hot) out.push(li(fill(Q.hot, ';opacity:.6'), t('r.lu.' + sl.lu))); if (m.dark) out.push(li(fill(Q.grey[3]), t('r.lu.sealed'))); out.push(li(fill(Q.grey[1]), t('r.lu.other.' + sl.lu))); }
    if (g.has('rHuman')) out.push(li(fill(Q.hot), t('r.lb.squares')), li(fill(Q.grey[3]), t('r.lb.parks')));
    if (g.has('rNoise')) out.push(li(fill(Q.grey[3]), t('r.lg.noise')));
    if (g.has('rAms')) out.push(li(fill(Q.grey[2]), t('r.lg.photo')));
    if (g.has('rPhoto')) out.push(li(fill(Q.grey[2]), t('r.lg.photos', { n: PH.length })));
    if (g.has('rWind')) out.push(li(fill(Q.hot, ';opacity:.72'), t('r.lg.windMax')), li(fill(Q.grey[3], ';opacity:.72'), t('r.lg.wind')));
    if (sl.pts === 'clim') out.push(li(fill(Q.ink, ';border-radius:50%'), t('r.lg.cell')));
    if (g.has('rHeat')) out.push(`<li><i class="sw tr-grad" style="background:linear-gradient(90deg, ${Q.heat.join(', ')})"></i><span>${t('r.lg.heat')}</span></li>`);
    if (g.has('rGrowth')) out.push(li(fill(Q.hot, ';opacity:.42;border:1.5px solid ' + Q.hot), t('r.lg.growth')), li(line(Q.ink, 2, true), t('r.lg.growth96')));
    if (g.has('rLine')) out.push(li(line(Q.hot, 4), t('r.lg.runway')), li(line(Q.hot, 2, true), t('r.lg.heli')));
    if (g.has('rHi')) out.push(li(line(Q.hot, 3), t('r.lg.sel')));
    if (g.has('rChoro')) out.push(li(fill(Q.hot), t('r.lg.max')), li(fill(Q.grey[1]), t('r.lg.low')));
    if (g.has('rScen')) out.push(li(fill(Q.ink, ';opacity:.32'), t('r.sc.A')), li(fill(Q.hot, ';opacity:.4'), t('r.sc.B')), li(line(Q.scen.C, 2, true), t('r.sc.C')));
    if (sl.pts === 'fac') out.push(li(fill(Q.hot, ';border-radius:50%'), t('r.lg.school')), li(fill(Q.ink, ';border-radius:50%'), t('r.lg.health')), li(fill(Q.hotSoft, `;border-radius:50%;border:1px solid ${Q.hot}`), t('r.lg.ring')));
    if (sl.pts === 'stay') out.push(li(fill(Q.hot, ';border-radius:50%'), t('r.lg.stay')));
    if (sl.pts === 'centre') out.push(li(fill(Q.hot, ';border-radius:50%'), t('r.lg.retail')), li(fill(Q.ink, ';border-radius:50%'), t('r.lg.food')), li(fill(Q.grey[2], ';border-radius:50%'), t('r.lg.service')));
    if (sl.pts === 'bus') out.push(li(fill(Q.hot, ';border-radius:50%'), t('r.lg.bus100')), li(fill(Q.ink, ';border-radius:50%'), t('r.lg.bus')));
    if (sl.pts === 'thr' || sl.pts === 'rd') out.push(li(fill(Q.hot, ';border-radius:50%'), t('r.lg.thr')));
    if (sl.pts === 'rd') out.push(li(fill(Q.ink, ';border-radius:50%'), t('r.lg.ref')), li(fill(Q.ink3, ';border-radius:50%'), t('r.lg.tower')));
    return out.length ? `<ul class="lg">${out.join('')}</ul>` : '';
  }
  function toc(cur) { return `<nav class="tr-toc" id="tr-toc" hidden><ol>${CH.map((c, i) => `<li><button type="button" data-go="${i + 1}" ${i + 1 === cur ? 'aria-current="true"' : ''}>${L(String(i + 1))} · ${esc(t('r.c.' + c.k))} <span class="fine">(${L(String(c.slides.length))})</span></button></li>`).join('')}</ol></nav>`; }

  // ---------- data inventory (all datasets, used or not, and what is missing) ----------
  // [name, source, year, resolution, kind, reliability (high/med/low), used in chapters, status]
  const INV = [
    ['Population 1996–2025', 'INE 2871', '1996–2025', 'municipality', 'official', 'high', '1 6 13 14', 'used'],
    ['Age × sex (pyramids)', 'INE 33570', '2012, 2022', 'municipality', 'official', 'high', '7', 'used'],
    ['Nationality', 'INE 33571', '2022', 'municipality', 'official', 'high', '7', 'used'],
    ['Demographic indicators', 'INE ADRH 31033', '2024', 'municipality', 'official', 'high', '7 13', 'used'],
    ['Income per person', 'INE ADRH 31025', '2024', 'municipality', 'official', 'high', '7 13', 'used'],
    ['Income by source', 'INE ADRH 31026', '2024', 'municipality', 'official', 'high', '7', 'used'],
    ['Rent index (2015 = 100)', 'INE IPVA 59060', '2024', 'municipality > 10,000', 'official', 'med', '6', 'used'],
    ['Tourist dwellings', 'INE VUT 39363 / 39366', '2026', 'municipality', 'official', 'med', '6 13', 'used'],
    ['Employed by sector · activity', 'INE Census 69992 / 67078', '2024', 'municipality', 'official', 'high', '9 13', 'used'],
    ['Registered unemployment', 'SEPE open data', '2026', 'municipality, monthly', 'official', 'high', '9', 'used'],
    ['Municipal outlines', 'IGN WFS', '2026', '1:25,000', 'official', 'high', 'all', 'used'],
    ['Base outline', 'OSM way 130984030', '2026', '≈ 1 m', 'official', 'high', 'all', 'used'],
    ['Aerodrome easements decree', 'BOE RD 511/1989', '1989', 'points', 'official', 'high', '4 11', 'used'],
    ['Buildings + construction year', 'OSM + Catastro INSPIRE', '2026', 'footprint → 100 m grid', 'historical', 'med', '2 5', 'used'],
    ['Floors', 'OSM building:levels', '2026', 'footprint → 100 m grid', 'spatial', 'low', '2 11', 'used'],
    ['City growth extents', 'IGN MTN50 · AMS · JRC GHSL', '1932–2020', '≈ 30–100 m', 'historical', 'med', '2', 'used'],
    ['Aerial photographs (8 flights)', 'IGN PNOA histórico (WMS)', '1956–2022', '0.5–1 m', 'historical', 'high', '2 5', 'used'],
    ['Town built-up outlines by year', 'OSM footprints + Catastro year (rebuilt)', '1996–2025', 'footprint → outline', 'estimate', 'med', '6', 'used'],
    ['Climate normals, hot days, wind, rain', 'ERA5 (Open-Meteo)', '1991–2024', '0.25° (≈ 25 km)', 'official', 'med', '3', 'used'],
    ['Climate projection', 'CMIP6 HighResMIP (Open-Meteo)', '1950–2050', '≈ 25–50 km', 'projection', 'low', '3 14', 'used'],
    ['Surface temperature, NDVI', 'USGS Landsat 8/9', '2024–2026', '90 m', 'spatial', 'med', '3 13', 'used'],
    ['Tree cover', 'ESA WorldCover', '2021', '10 m', 'spatial', 'med', '3 5 13', 'used'],
    ['Air quality (model)', 'CAMS Europe (Open-Meteo)', '2023–2025', '≈ 10 km', 'estimate', 'low', '3', 'used'],
    ['Noise (roads, rail, city)', 'MITECO SICA (WMS)', '2017–2022', 'model grid', 'estimate', 'med', '3 11', 'used'],
    ['Flood zones T10–T500, DPH', 'MITECO SNCZI (WFS)', 'study dates vary', '1:5,000', 'official', 'high', '4 12', 'used'],
    ['Waterways and acequias', 'OSM', '2026', 'line', 'official', 'med', '4', 'used'],
    ['Terrain flow paths', 'IGN MDT25 (computed)', '2026', '25 m', 'spatial', 'med', '4', 'used'],
    ['Land use', 'OSM landuse', '2026', 'polygon', 'spatial', 'med', '4 5 9 12', 'used'],
    ['Population grid', 'JRC GHS-POP', '2020', '100 m', 'estimate', 'med', '7', 'used'],
    ['Schools, health', 'OSM (Overpass)', '2026', 'point', 'official', 'med', '8', 'used'],
    ['Shops, food, services', 'OSM (Overpass)', '2026', 'point', 'official', 'med', '8', 'used'],
    ['Squares, parks, playgrounds', 'OSM (Overpass)', '2026', 'polygon / point', 'official', 'med', '8', 'used'],
    ['Tourist accommodation', 'OSM (Overpass)', '2026', 'point', 'official', 'med', '6', 'used'],
    ['Bus stops and trips', 'City file + CTAN', '2026', 'stop', 'official', 'med', '10 13', 'used'],
    ['Metro 2026, tram 1931', 'OSM · IGN MTN50', '1931 / 2026', 'line', 'historical', 'high', '10', 'used'],
    ['Walking routes, dead ends', 'OSM streets (computed)', '2026', 'network', 'spatial', 'med', '10', 'used'],
    ['300 m band (1981)', 'BOE 1981 · OSM', '1981 / 2026', 'polygon', 'official', 'med', '11', 'used'],
    ['Places (Overture)', 'Overture Maps', '2026', 'point', 'official', 'med', '—', 'unused'],
    ['Trees (points)', 'OSM', '2026', 'point', 'official', 'low', '—', 'unused'],
    ['Contours 10/20 m, slope, hillshade', 'IGN MDT25', '2026', '25 m', 'official', 'high', '—', 'unused'],
    ['MODIS surface temperature (live)', 'NASA GIBS', '2025', '1 km', 'spatial', 'low', '—', 'unused'],
    ['Exercise 1.3 frames (city, Escúzar)', 'GHSL · Landsat · OSM', '2020–2026', '50–100 m', 'spatial', 'med', '—', 'unused'],
    ['Escúzar pole', 'OSM · operators', '2026', 'polygon', 'official', 'med', '—', 'unused'],
    ['Granada barrios', 'OSM admin', '2026', 'polygon', 'official', 'high', '7', 'used'],
  ];
  function inventory() {
    let el = document.querySelector('#tr-inv'); if (el) el.remove();
    el = document.createElement('div'); el.id = 'tr-inv'; el.className = 'tr-inv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tr-inv-h');
    const row = (r) => `<tr><td dir="ltr">${esc(r[0])}</td><td dir="ltr">${esc(r[1])}</td><td dir="ltr">${esc(r[2])}</td><td dir="ltr">${esc(r[3])}</td><td>${badge(r[4], r[1] + ' · ' + r[2])}</td><td>${t('r.rel.' + r[5])}</td><td dir="ltr">${esc(r[6])}</td><td>${t('r.st.' + r[7])}</td></tr>`;
    el.innerHTML = `<div class="tr-inv-in"><div class="tr-inv-h"><h2 id="tr-inv-h">${t('r.inv')}</h2><button type="button" class="btn btn-small" data-inv-x>${t('tour.exit')}</button></div>
      <p class="fine">${t('r.invNote')}</p><div class="tr-table-w"><table class="tr-table tr-invt"><tr>${['name', 'src', 'year', 'res', 'kind', 'rel', 'ch', 'st'].map(k => `<th>${t('r.invc.' + k)}</th>`).join('')}</tr>${INV.map(row).join('')}</table></div>
      <h3>${t('r.missH')}</h3><ul class="tr-gaps">${MISS.map(k => `<li><b>${t('r.miss.' + k)}</b> — <span class="fine">${t('r.missw.' + k)}</span></li>`).join('')}</ul></div>`;
    document.body.appendChild(el); const x = el.querySelector('[data-inv-x]'); x.focus();
    const close = () => { el.remove(); root.removeEventListener('keydown', onK, true); };
    const onK = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    x.addEventListener('click', close); el.addEventListener('click', (e) => { if (e.target === el) close(); }); root.addEventListener('keydown', onK, true);
  }

  // ---------- card interaction (chart ↔ map; pickers; timeline) ----------
  function onCard(e, map, sl, rerender) {
    const pickM = e.target.closest('[data-muni-pick]'); if (pickM) { X.sel = pickM.dataset.muniPick; hi(map, X.sel); rerender(); return true; }
    const sc = e.target.closest('[data-scen]'); if (sc) { X.scen = sc.dataset.scen; scenPaint(map); rerender(); return true; }
    const ind = e.target.closest('[data-ind]'); if (ind) { X.ind = ind.dataset.ind; choro(map); rerender(); GA.tour.relabel && GA.tour.relabel(); return true; }
    const go = e.target.closest('[data-go]'); if (go) { GA.tour.go(+go.dataset.go, 1); return true; }
    const b = e.target.closest('[data-tour]'); if (!b) return false;
    if (b.dataset.tour === 'play') { if (X.anim && X.anim.playing) stop(); else play(map, sl); return true; }
    if (b.dataset.tour === 'toc') { const tc = document.querySelector('#tr-toc'); if (tc) { tc.hidden = !tc.hidden; b.setAttribute('aria-expanded', String(!tc.hidden)); } return true; }
    if (b.dataset.tour === 'inv') { inventory(); return true; }
    return false;
  }
  function onInput(e, map, sl) { if (e.target.closest('#tr-tl input')) { stop(); frame(map, sl, +e.target.value); } }
  function onHover(e, map) { const r = e.target.closest && e.target.closest('[data-muni]'); hi(map, r ? r.dataset.muni : (GA.tour.slide && GA.tour.slide().pick ? X.sel : null)); }

  root.GA.tourResearch = { CH, RG, LOW, MID, load, build, apply, bbs, labels, popup, card, enter, leave, frame, play, stop, onCard, onInput, onHover, inventory, ensure, toc, vals, INV, MISS, KIND, X,
    setClimStats: (s) => { X.cache.climStats = s; }, setArea: (a) => { X.cache.area = a; } };
})(window);
