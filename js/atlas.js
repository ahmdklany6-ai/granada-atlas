/* Build 5.25 — the Atlas shell: ONE city → study areas → five research analyses, on the live map.
   - A slim top bar with one ☰ button; a sidebar holds everything that used to sit in the header and the panel tabs:
     the five research topics (WHAT), the study areas (WHERE), every GIS layer (the existing Layers panel, moved in, with its
     checkboxes, opacity and legends), historical maps, tools and pages (the existing navigation buttons, moved in),
     display settings (language) and exports. The Study area and Analysis panels still float over the map.
   - WHERE × WHAT: area ∈ {city, factory, metro}; topic ∈ {density, morphology, centre, climate, human} or none. Changing one
     never resets the other. Topics are drawn on the map from the audited Exercise 1.3 layers (data/ex13, one 10 × 10 km
     frame); indicators are computed for the selected area; where the data does not reach an area, the panel says so and
     names what is missing — nothing is invented.
   - Animations are built on the map from real data: the city's documented built-up extents 1932 → 2020 (data/ref/
     history_extents.json) at city scale, and a reveal of each topic's classes in order. No pre-rendered GIF exists. */
(function (root) {
  const { i18n: I, pages: PG, proj: PJ, data: D } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc;
  const nf = (v, d) => (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const TOPICS = ['density', 'morphology', 'centre', 'climate', 'human'];
  const AREAS = ['city', 'factory', 'metro'];
  const CITY_BB = [[-3.80, 37.06], [-3.53, 37.235]];       // Granada with both study areas in view
  const CORRIDOR_M = 600;                                   // metro corridor: 600 m each side of the new track
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = { area: 'city', topic: null, min: false, growth: { on: !REDUCED, i: 0, timer: null }, reveal: { timer: null, step: 0 } };
  let map, APP, X13 = null, SOUTH = null, EXT = null, ready = false; const cache = {};
  const P = () => root.GA.palette; const C = () => root.GA.palette.ex13;
  const $ = (s, r) => (r || document).querySelector(s);
  const dotCol = (a) => a === 'factory' ? P().south.estate : a === 'metro' ? P().south.metro : P().red;
  const dot = (a) => `<span class="atl-dot" style="background:${dotCol(a)}" aria-hidden="true"></span>`;
  const U = (ll) => PJ.EPSG25830.forward(ll), L = (xy) => { const ll = PJ.EPSG25830.inverse(xy); return [+ll[0].toFixed(6), +ll[1].toFixed(6)]; };

  // ---------- shell: ☰ + sidebar ----------
  const SECTIONS = ['research', 'areas', 'layers', 'history', 'tools', 'display', 'export'];
  const open = { research: true, areas: true };
  function buildShell() {
    document.body.classList.add('atlas');
    const top = $('.topbar'); const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'atl-burger'; btn.className = 'atl-burger'; btn.setAttribute('aria-controls', 'atl-side'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span aria-hidden="true">☰</span>'; top.insertBefore(btn, top.firstChild);
    const side = document.createElement('aside'); side.id = 'atl-side'; side.className = 'atl-side'; side.hidden = true; side.setAttribute('aria-label', 'menu');
    side.innerHTML = `<div class="atl-side-h"><b data-i18n="v23.menu"></b><button type="button" class="icon-btn" id="atl-side-x">✕</button></div><div class="atl-side-b">${SECTIONS.map(k => `<section class="atl-sec" data-sec="${k}"><button type="button" class="atl-sec-h" data-sec-t="${k}" aria-expanded="false"><span class="atl-sec-n"></span><span class="atl-caret" aria-hidden="true">▸</span></button><div class="atl-sec-b" id="atl-sec-${k}" hidden></div></section>`).join('')}</div>`;
    document.body.appendChild(side);
    // move the existing navigation, language switch and Layers panel into the sidebar (nodes keep their listeners)
    $('#atl-sec-tools').appendChild(Object.assign(document.createElement('div'), { className: 'atl-tools', id: 'atl-tools' }));
    const nav = $('#tb-nav'); if (nav) $('#atl-tools').appendChild(nav);
    const lang = $('#lang'); if (lang) $('#atl-sec-display').appendChild(lang);
    const lp = $('#panel-layers'); if (lp) { $('#atl-sec-layers').appendChild(lp); lp.classList.add('atl-layers'); }
    // the floating Layers panel is now the sidebar section; its old API opens the section
    const P0 = root.GA.panels; if (P0 && !P0.__atlas) { const set0 = P0.set, isOpen0 = P0.isOpen;
      root.GA.panels = Object.assign({}, P0, { __atlas: true, set: (k, o) => k === 'layers' ? (o ? showSection('layers') : closeSide()) : (o && closeSide(), o && k === 'analysis' && !S.min && (S.min = true, renderPanel()), set0(k, o)), /* a floating panel never opens under the menu; the study-area workspace gets the map (the atlas panel folds to its title bar) */ isOpen: (k) => k === 'layers' ? (!side.hidden && !!open.layers) : isOpen0(k), toggle: (k) => root.GA.panels.set(k, !root.GA.panels.isOpen(k)) }); }
    btn.addEventListener('click', () => side.hidden ? openSide() : closeSide());
    $('#atl-side-x').addEventListener('click', closeSide);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !side.hidden && !document.querySelector('.vw, .modal:not([hidden])')) closeSide(); });
    side.addEventListener('click', onSideClick); side.addEventListener('change', onSideChange);
    // a page, workspace or drawer opened from the menu closes the menu
    nav && nav.addEventListener('click', (e) => { if (e.target.closest('.tb-btn')) closeSide(); });
    renderSide();
  }
  function openSide() { const s = $('#atl-side'); s.hidden = false; $('#atl-burger').setAttribute('aria-expanded', 'true'); document.body.classList.add('atl-menu'); relayout(); const f = s.querySelector('.atl-sec-h'); f && f.focus({ preventScroll: true }); }
  const relayout = () => dispatchEvent(new Event('ga:relayout')); // the map legend moves clear of the menu and the panel
  function closeSide() { const s = $('#atl-side'); if (!s) return; s.hidden = true; $('#atl-burger').setAttribute('aria-expanded', 'false'); document.body.classList.remove('atl-menu'); relayout(); }
  function showSection(k) { open[k] = true; renderSide(); openSide(); const el = $(`.atl-sec[data-sec="${k}"]`); el && el.scrollIntoView({ block: 'nearest' }); }
  function renderSide() {
    const side = $('#atl-side'); if (!side) return; $('[data-i18n="v23.menu"]', side).textContent = t('v23.menu'); $('#atl-side-x').setAttribute('aria-label', t('close'));
    SECTIONS.forEach(k => { const h = $(`[data-sec-t="${k}"]`, side); h.querySelector('.atl-sec-n').textContent = t('v23.sec.' + k); h.setAttribute('aria-expanded', String(!!open[k])); h.querySelector('.atl-caret').textContent = open[k] ? '▾' : '▸'; $('#atl-sec-' + k).hidden = !open[k]; });
    $('#atl-sec-research').innerHTML = `<p class="fine">${t('v23.researchLead')}</p><div class="atl-list" role="radiogroup">${TOPICS.map((k, i) => `<button type="button" class="atl-item ${S.topic === k ? 'on' : ''}" role="radio" aria-checked="${S.topic === k}" data-topic="${k}"><span class="atl-num">${String(i + 1).padStart(2, '0')}</span><span>${t('e13.t.' + k)}</span></button>`).join('')}<button type="button" class="atl-item atl-none ${!S.topic ? 'on' : ''}" role="radio" aria-checked="${!S.topic}" data-topic=""><span class="atl-num">—</span><span>${t('v23.noTopic')}</span></button></div>`;
    $('#atl-sec-areas').innerHTML = `<div class="atl-list" role="radiogroup">${AREAS.map(a => `<button type="button" class="atl-item ${S.area === a ? 'on' : ''}" role="radio" aria-checked="${S.area === a}" data-area="${a}">${dot(a)}<span>${t('v23.area.' + a)}</span></button>`).join('')}</div><p class="fine"><button type="button" class="btn btn-tiny" data-atl-go="areas">${t('nav.areas')}</button> <button type="button" class="btn btn-tiny" data-atl-pn="study">${t('v8.tabStudy')}</button></p>`;
    let lx = $('#atl-layers-x'); if (!lx) { lx = document.createElement('div'); lx.id = 'atl-layers-x'; lx.className = 'atl-layers-x'; $('#atl-sec-layers').insertBefore(lx, $('#atl-sec-layers').firstChild); }
    lx.innerHTML = `<button type="button" class="btn btn-tiny" data-atl-reset="layers">${t('v23.resetLayers')}</button> <button type="button" class="btn btn-tiny" data-atl-reset="topic" ${S.topic ? '' : 'disabled'}>${t('v23.resetTopic')}</button> <button type="button" class="btn btn-tiny" data-atl-legend>${t('v23.legendToggle')}</button>`;
    $('#atl-sec-history').innerHTML = `<p class="fine">${t('v23.historyLead')}</p><p><button type="button" class="btn btn-small" data-atl-page="history">${t('nav.history')}</button> <button type="button" class="btn btn-small" data-atl-growth>${t(S.growth.on && !S.topic && S.area === 'city' ? 'v23.growthPause' : 'v23.growthPlay')}</button></p>`;
    let pn = $('#atl-panels'); if (!pn) { pn = document.createElement('div'); pn.id = 'atl-panels'; pn.className = 'atl-panels'; $('#atl-sec-tools').insertBefore(pn, $('#atl-sec-tools').firstChild); }
    pn.innerHTML = `<button type="button" class="btn btn-small" data-atl-pn="analysis">${t('v8.tabAnalysis')}</button> <button type="button" class="btn btn-small" data-atl-pn="study">${t('v8.tabStudy')}</button> <button type="button" class="btn btn-small" data-atl-page="ex13">${t('e13.title')}</button>`;
    let dx = $('#atl-display'); if (!dx) { dx = document.createElement('div'); dx.id = 'atl-display'; $('#atl-sec-display').appendChild(dx); }
    dx.innerHTML = `<p class="fine">${t('v23.displayLead')}</p><p><button type="button" class="btn btn-tiny" data-atl-intro>${t('v23.showIntro')}</button> <button type="button" class="btn btn-tiny" data-atl-legend>${t('v23.legendToggle')}</button></p>`;
    $('#atl-sec-export').innerHTML = `<p class="fine">${t('v23.exportLead')}</p><p><button type="button" class="btn btn-small" data-atl-click=".tb-gis">${t('nav.export')}</button> <button type="button" class="btn btn-small" data-atl-page="ex13">${t('v23.ex13Exports')}</button> <button type="button" class="btn btn-small" data-atl-page="print">${t('pl.nav')}</button></p>`;
  }
  function onSideClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.secT) { open[b.dataset.secT] = !open[b.dataset.secT]; renderSide(); return; }
    if (b.dataset.topic != null) { setTopic(b.dataset.topic || null); return; }
    if (b.dataset.area) { setArea(b.dataset.area); return; }
    if (b.dataset.atlPn) { closeSide(); if (PG.current) PG.close(); root.GA.panels.set(b.dataset.atlPn, true); return; }
    if (b.dataset.atlPage) { closeSide(); PG.go(b.dataset.atlPage); return; }
    if (b.dataset.atlGo) { const nb = document.querySelector(`.tb-btn[data-drawer="${b.dataset.atlGo}"]`); closeSide(); nb && nb.click(); return; }
    if (b.dataset.atlClick) { const nb = document.querySelector(b.dataset.atlClick); closeSide(); nb && nb.click(); return; }
    if (b.closest('#atl-tools') && b.classList.contains('tb-btn')) { closeSide(); return; } // the moved navigation keeps its own handlers; the menu gets out of the way
    if (b.dataset.atlReset === 'layers') { resetLayers(); return; }
    if (b.dataset.atlReset === 'topic') { applyTopicLayers(S.topic, true); return; }
    if (b.dataset.atlLegend != null) { const lg = $('#legend'); if (lg) document.body.classList.toggle('atl-nolegend'); return; }
    if (b.dataset.atlIntro != null) { S.min = false; closeSide(); renderPanel(); return; }
    if (b.dataset.atlGrowth != null) { S.growth.on = !S.growth.on; if (S.growth.on) startGrowth(); else stopGrowth(true); renderSide(); renderPanel(); return; }
  }
  function onSideChange() { /* the moved Layers panel handles its own inputs */ }
  // every layer back to its documented default (on/off, opacity)
  function resetLayers() { const LL = APP.L; LL.defs.forEach(d => { const def = d.def || {}; if (!!LL.S[d.id].on !== !!def.on) LL.setOn(d.id, !!def.on); if (def.opacity != null && LL.S[d.id].opacity !== def.opacity) LL.setOpacity(d.id, def.opacity); }); APP.store.save(); toast(t('v23.layersReset')); }
  function toast(m) { root.GA.toast ? root.GA.toast(m) : null; }

  // ---------- data ----------
  async function loadAll() {
    if (cache.all) return cache.all;
    cache.all = (async () => {
      X13 = await root.GA.ex13.load();
      const [metro, pole, ext] = await Promise.all([D.single('south_metro').catch(() => null), D.single('escuzar_pole').catch(() => null), fetch('data/ref/history_extents.json?v=' + (root.GA_BUILD || '')).then(r => r.json()).catch(() => null)]);
      SOUTH = { metro, pole }; EXT = ext; return true; })();
    return cache.all;
  }
  const track = () => SOUTH && SOUTH.metro && SOUTH.metro.features.find(f => f.properties.k === 'track');
  const estate = () => SOUTH && SOUTH.pole && SOUTH.pole.features.find(f => f.properties.k === 'estate');
  const bboxOf = (coords) => { let a = [180, 90, -180, -90]; const add = (c) => { if (typeof c[0] === 'number') a = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])]; else c.forEach(add); }; add(coords); return [[a[0], a[1]], [a[2], a[3]]]; };
  const frameLL = () => { const F = X13.frame; return [L([F.x0, F.y1]), L([F.x1, F.y1]), L([F.x1, F.y0]), L([F.x0, F.y0])]; }; // tl, tr, br, bl (image source order)
  // padding that keeps the fitted area clear of the context panel (left on desktop, bottom sheet on phones) and the legend
  function pad(p) { const pn = $('#atl-panel'); const w = innerWidth; if (w < 700) return { top: p, left: p, right: p, bottom: Math.min(innerHeight * 0.45, (pn && !S.min ? pn.offsetHeight : 40) + p) }; return { top: p + 20, bottom: p, left: (pn && !S.min ? pn.offsetWidth + 24 : 0) + p, right: p + (w > 1100 ? 120 : 0) }; }
  const frameBB = () => { const c = frameLL(); return bboxOf(c); };
  // metro corridor: everything within 600 m of the new track. The track is several OSM pieces that are not in sequence,
  // so distances are measured per piece, and the corridor is drawn by stroking each piece at the true width (round joins
  // and caps = an exact buffer) on a canvas mask over the frame — never by joining the pieces into one line.
  function corridor() {
    if (cache.corr) return cache.corr; const tr = track(); if (!tr) return null; const lines = (tr.geometry.type === 'MultiLineString' ? tr.geometry.coordinates : [tr.geometry.coordinates]).map(l => l.map(U));
    const xs = lines.flat().map(p => p[0]), ys = lines.flat().map(p => p[1]); const r = CORRIDOR_M;
    const bbU = [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r];
    cache.corr = { lines, bbU, ll: [L([bbU[0], bbU[1]]), L([bbU[2], bbU[3]])] }; return cache.corr;
  }
  // a canvas over the analysis frame: white veil outside the corridor, a thin ink edge on it, clear inside
  function corridorMask() {
    if (cache.corrMask) return cache.corrMask; const F = X13.frame, n = 1000, k = n / (F.x1 - F.x0); const cv = document.createElement('canvas'); cv.width = cv.height = n; const ctx = cv.getContext('2d');
    const path = () => { ctx.beginPath(); corridor().lines.forEach(l => l.forEach((p, i) => { const x = (p[0] - F.x0) * k, y = (F.y1 - p[1]) * k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); })); };
    ctx.fillStyle = 'rgba(255,255,255,0.64)'; ctx.fillRect(0, 0, n, n); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'destination-out'; path(); ctx.lineWidth = 2 * CORRIDOR_M * k + 3; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; path(); ctx.lineWidth = 2 * CORRIDOR_M * k + 3; ctx.strokeStyle = P().ink; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out'; path(); ctx.lineWidth = 2 * CORRIDOR_M * k; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
    cache.corrMask = cv.toDataURL('image/png'); return cache.corrMask;
  }
  const distToTrack = (x, y) => { let d = Infinity; corridor().lines.forEach(p => { for (let i = 1; i < p.length; i++) d = Math.min(d, segD(x, y, p[i - 1], p[i])); }); return d; };
  function segD(x, y, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy; let u = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0; u = Math.max(0, Math.min(1, u)); return Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy); }
  // does an area lie inside the analysis frame? (the factory does not: the data was processed for the 10 × 10 km frame)
  function coverage(area) {
    const F = X13.frame; if (area === 'city') return { ok: true };
    if (area === 'metro') { const b = corridor().bbU; const inside = b[0] >= F.x0 && b[2] <= F.x1 && b[1] >= F.y0 && b[3] <= F.y1; return { ok: true, partial: !inside }; }
    const e = estate(); if (!e) return { ok: false, dist: null }; const pts = (e.geometry.type === 'Polygon' ? e.geometry.coordinates : e.geometry.coordinates.flat()).flat().map(U);
    const d = Math.min(...pts.map(([x, y]) => Math.hypot(Math.max(F.x0 - x, 0, x - F.x1), Math.max(F.y0 - y, 0, y - F.y1)))); return { ok: false, dist: d };
  }

  // ---------- map layers (all ids prefixed atl-) ----------
  const FC = (features) => ({ type: 'FeatureCollection', features: features || [] });
  const has = (id) => map && map.getLayer(id);
  function addOnce(src, def) { if (!map.getSource(src)) map.addSource(src, def); }
  function add(l) { if (!map.getLayer(l.id)) map.addLayer(l); }
  function setVis(id, on) { if (has(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }
  function topicLayerIds(k) { return (cache['ids_' + k] || []); }
  function buildBase() {
    addOnce('atl-veil', { type: 'geojson', data: FC([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-20, 20], [20, 20], [20, 60], [-20, 60], [-20, 20]]] } }]) });
    add({ id: 'atl-veil', type: 'fill', source: 'atl-veil', layout: { visibility: 'none' }, paint: { 'fill-color': '#FFFFFF', 'fill-opacity': 0.5, 'fill-opacity-transition': { duration: 600 } } });
    addOnce('atl-growth', { type: 'geojson', data: FC() });
    add({ id: 'atl-growth-fill', type: 'fill', source: 'atl-growth', paint: { 'fill-color': ['get', 'col'], 'fill-opacity': ['get', 'op'] } });
    add({ id: 'atl-growth-line', type: 'line', source: 'atl-growth', paint: { 'line-color': ['get', 'line'], 'line-width': ['get', 'w'], 'line-opacity': 0.95 } });
    addOnce('atl-hl', { type: 'geojson', data: FC() });
    add({ id: 'atl-hl-glow', type: 'line', source: 'atl-hl', paint: { 'line-color': P().red, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 6, 16, 16], 'line-opacity': 0.22, 'line-blur': 4 } });
    add({ id: 'atl-hl-line', type: 'line', source: 'atl-hl', paint: { 'line-color': P().red, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.6, 16, 3.2], 'line-opacity': 0.95 } });
    addOnce('atl-frame', { type: 'geojson', data: FC() });
    add({ id: 'atl-frame', type: 'line', source: 'atl-frame', layout: { visibility: 'none' }, paint: { 'line-color': P().ink, 'line-width': 1.2, 'line-dasharray': [4, 3], 'line-opacity': 0.8 } });
    addOnce('atl-mask', { type: 'geojson', data: FC() });
    add({ id: 'atl-mask', type: 'fill', source: 'atl-mask', layout: { visibility: 'none' }, paint: { 'fill-color': '#FFFFFF', 'fill-opacity': 0.64 } });
  }
  // keep the atlas layers on top of every other layer (a layer switched on later is added above them otherwise)
  function raise() { if (!map) return; ['atl-veil'].concat(...TOPICS.map(topicLayerIds), ['atl-mask', 'atl-corr', 'atl-frame', 'atl-growth-fill', 'atl-growth-line', 'atl-hl-glow', 'atl-hl-line']).forEach(id => { if (has(id)) map.moveLayer(id); }); }

  // -- topic layers, built once per topic from data/ex13 (same classes and colours as the Exercise 1.3 maps) --
  function imgFromCanvas(cv) { return cv.toDataURL('image/png'); }
  function addImage(id, url, coords, opacityProp) {
    addOnce(id, { type: 'image', url, coordinates: coords }); add({ id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 600 }, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } });
  }
  function buildTopic(k) {
    if (cache['ids_' + k]) return cache['ids_' + k]; const ids = []; const c = C(); const F = X13.frame;
    if (k === 'density') {
      const d = X13.density, cx = d.corners.x, cy = d.corners.y, br = d.breaks; const fs = [];
      d.pop.forEach((row, r) => row.forEach((p, q) => { if (!p || p <= 0) return; const v = p * 100; fs.push({ type: 'Feature', properties: { c: br.filter(b => v > b).length, v: Math.round(v) }, geometry: { type: 'Polygon', coordinates: [[L([cx[r][q], cy[r][q]]), L([cx[r][q + 1], cy[r][q + 1]]), L([cx[r + 1][q + 1], cy[r + 1][q + 1]]), L([cx[r + 1][q], cy[r + 1][q]]), L([cx[r][q], cy[r][q]])]] } }); }));
      addOnce('atl-den', { type: 'geojson', data: FC(fs) });
      c.density.forEach((col, i) => { const id = 'atl-den-' + i; add({ id, type: 'fill', source: 'atl-den', filter: ['==', ['get', 'c'], i], layout: { visibility: 'none' }, paint: { 'fill-color': col, 'fill-outline-color': col, 'fill-opacity': 0, 'fill-opacity-transition': { duration: 600 } } }); ids.push(id); });
    }
    if (k === 'morphology') {
      const g = X13.fgm; const w = g.width * g.px_m, h = g.height * g.px_m;
      addImage('atl-fg', 'data/' + g.file, [L([g.ox, g.oy]), L([g.ox + w, g.oy]), L([g.ox + w, g.oy - h]), L([g.ox, g.oy - h])]); ids.push('atl-fg');
      const m = X13.morphology, G = m.grid; const fs = m.gaps.map(([r, q]) => { const x0 = G.x0 + q * G.cell, y1 = G.y1 - r * G.cell; return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[L([x0, y1]), L([x0 + G.cell, y1]), L([x0 + G.cell, y1 - G.cell]), L([x0, y1 - G.cell]), L([x0, y1])]] } }; });
      addOnce('atl-gap', { type: 'geojson', data: FC(fs) });
      add({ id: 'atl-gap', type: 'fill', source: 'atl-gap', layout: { visibility: 'none' }, paint: { 'fill-color': c.gap, 'fill-opacity': 0, 'fill-opacity-transition': { duration: 600 } } }); ids.push('atl-gap');
      add({ id: 'atl-gap-l', type: 'line', source: 'atl-gap', layout: { visibility: 'none' }, paint: { 'line-color': c.gap, 'line-width': 1.2, 'line-opacity': 0, 'line-opacity-transition': { duration: 600 } } }); ids.push('atl-gap-l');
    }
    if (k === 'centre') {
      const g = X13.centre.grid, z = X13.centre.z, br = X13.centre.breaks; const up = 4, n = g.n * up; const val = (i, j) => z[Math.max(0, Math.min(g.n - 1, j))][Math.max(0, Math.min(g.n - 1, i))];
      const cls = new Uint8Array(n * n);
      for (let jj = 0; jj < n; jj++) for (let ii = 0; ii < n; ii++) { const fx = (ii + 0.5) / up - 0.5, fy = (jj + 0.5) / up - 0.5; const i0 = Math.floor(fx), j0 = Math.floor(fy), ax = fx - i0, ay = fy - j0;
        const v = (1 - ax) * (1 - ay) * val(i0, j0) + ax * (1 - ay) * val(i0 + 1, j0) + (1 - ax) * ay * val(i0, j0 + 1) + ax * ay * val(i0 + 1, j0 + 1); cls[jj * n + ii] = br.filter(b => v >= b).length; }
      const x1 = g.x0 + g.n * g.cell, y0 = g.y1 - g.n * g.cell; const corners = [L([g.x0, g.y1]), L([x1, g.y1]), L([x1, y0]), L([g.x0, y0])];
      c.centre.forEach((col, i) => { const cv = document.createElement('canvas'); cv.width = cv.height = n; const ctx = cv.getContext('2d'); const img = ctx.createImageData(n, n); const rgb = P().rgb(col);
        for (let p = 0; p < n * n; p++) if (cls[p] === i + 1) { img.data[p * 4] = rgb[0]; img.data[p * 4 + 1] = rgb[1]; img.data[p * 4 + 2] = rgb[2]; img.data[p * 4 + 3] = 235; }
        ctx.putImageData(img, 0, 0); addImage('atl-cen-' + i, imgFromCanvas(cv), corners); ids.push('atl-cen-' + i); });
      const hist = X13.centre.hist.geometry; const rings = hist.type === 'Polygon' ? hist.coordinates : hist.coordinates.flat();
      addOnce('atl-hist', { type: 'geojson', data: FC([{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: rings.map(r => r.map(L)) } }]) });
      add({ id: 'atl-hist', type: 'line', source: 'atl-hist', layout: { visibility: 'none' }, paint: { 'line-color': c.hist, 'line-width': 2.2, 'line-dasharray': [3, 2], 'line-opacity': 0, 'line-opacity-transition': { duration: 600 } } }); ids.push('atl-hist');
      addOnce('atl-peaks', { type: 'geojson', data: FC(X13.centre.peaks.map(p => ({ type: 'Feature', properties: { lbl: 'C' + p.rank, r: p.rank }, geometry: { type: 'Point', coordinates: L([p.x, p.y]) } }))) });
      add({ id: 'atl-peaks', type: 'circle', source: 'atl-peaks', layout: { visibility: 'none' }, paint: { 'circle-radius': ['case', ['==', ['get', 'r'], 1], 9, 6.5], 'circle-color': '#FFFFFF', 'circle-stroke-color': c.centreLine, 'circle-stroke-width': 2.4, 'circle-opacity': 0, 'circle-stroke-opacity': 0, 'circle-opacity-transition': { duration: 600 }, 'circle-stroke-opacity-transition': { duration: 600 } } }); ids.push('atl-peaks');
      add({ id: 'atl-peaks-l', type: 'symbol', source: 'atl-peaks', layout: { visibility: 'none', 'text-field': ['get', 'lbl'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-offset': [1.1, -0.9], 'text-allow-overlap': true }, paint: { 'text-color': c.centreLine, 'text-halo-color': '#FFFFFF', 'text-halo-width': 2, 'text-opacity': 0, 'text-opacity-transition': { duration: 600 } } }); ids.push('atl-peaks-l');
    }
    if (k === 'climate') {
      const g = X13.climate.grid, Lg = X13.climate.lst, br = X13.climate.breaks, n = g.n; const x1 = g.x0 + n * g.cell, y0 = g.y1 - n * g.cell; const corners = [L([g.x0, g.y1]), L([x1, g.y1]), L([x1, y0]), L([g.x0, y0])];
      c.lst.forEach((col, i) => { const cv = document.createElement('canvas'); cv.width = cv.height = n; const ctx = cv.getContext('2d'); const img = ctx.createImageData(n, n); const rgb = P().rgb(col);
        for (let j = 0; j < n; j++) for (let q = 0; q < n; q++) { const v = Lg[j][q]; if (v == null || br.filter(b => v >= b).length !== i) continue; const o = (j * n + q) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255; }
        ctx.putImageData(img, 0, 0); addImage('atl-lst-' + i, imgFromCanvas(cv), corners); ids.push('atl-lst-' + i); });
      // vegetation context: outline of the 90 m cells with summer NDVI ≥ 0.4 (drawn at 8 px per cell, edges only)
      const V = X13.climate.ndvi, k8 = 8; const cv = document.createElement('canvas'); cv.width = cv.height = n * k8; const ctx = cv.getContext('2d'); const veg = (q, j) => q >= 0 && j >= 0 && q < n && j < n && V[j][q] != null && V[j][q] >= 0.4;
      ctx.strokeStyle = c.veg; ctx.lineWidth = 2; ctx.beginPath();
      for (let j = 0; j < n; j++) for (let q = 0; q < n; q++) { if (!veg(q, j)) continue; const x = q * k8, y = j * k8; if (!veg(q, j - 1)) { ctx.moveTo(x, y + 1); ctx.lineTo(x + k8, y + 1); } if (!veg(q, j + 1)) { ctx.moveTo(x, y + k8 - 1); ctx.lineTo(x + k8, y + k8 - 1); } if (!veg(q - 1, j)) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + k8); } if (!veg(q + 1, j)) { ctx.moveTo(x + k8 - 1, y); ctx.lineTo(x + k8 - 1, y + k8); } }
      ctx.stroke(); addImage('atl-veg', imgFromCanvas(cv), corners); map.setPaintProperty('atl-veg', 'raster-resampling', 'linear'); ids.push('atl-veg');
    }
    if (k === 'human') {
      const H = X13.human, d = X13.density, cx = d.corners.x, cy = d.corners.y;
      addOnce('atl-far', { type: 'geojson', data: FC(H.far.map(([r, q]) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[L([cx[r][q], cy[r][q]]), L([cx[r][q + 1], cy[r][q + 1]]), L([cx[r + 1][q + 1], cy[r + 1][q + 1]]), L([cx[r + 1][q], cy[r + 1][q]]), L([cx[r][q], cy[r][q]])]] } }))) });
      add({ id: 'atl-far', type: 'fill', source: 'atl-far', layout: { visibility: 'none' }, paint: { 'fill-color': c.far, 'fill-opacity': 0, 'fill-opacity-transition': { duration: 600 } } }); ids.push('atl-far');
      const poly = (kind) => (H.areas[kind] || []).map(a => ({ type: 'Feature', properties: { kind, n: a.n }, geometry: { type: 'Polygon', coordinates: a.p.map(r => r.map(L)) } }));
      addOnce('atl-hum-a', { type: 'geojson', data: FC(poly('park').concat(poly('square'))) });
      add({ id: 'atl-park', type: 'fill', source: 'atl-hum-a', filter: ['==', ['get', 'kind'], 'park'], layout: { visibility: 'none' }, paint: { 'fill-color': c.park, 'fill-opacity': 0, 'fill-opacity-transition': { duration: 600 } } }); ids.push('atl-park');
      add({ id: 'atl-square', type: 'fill', source: 'atl-hum-a', filter: ['==', ['get', 'kind'], 'square'], layout: { visibility: 'none' }, paint: { 'fill-color': c.square, 'fill-opacity': 0, 'fill-opacity-transition': { duration: 600 } } }); ids.push('atl-square');
      const pts = []; Object.entries(H.points).forEach(([kind, list]) => list.forEach(p => pts.push({ type: 'Feature', properties: { kind, n: p[2] || '' }, geometry: { type: 'Point', coordinates: L([p[0], p[1]]) } })));
      addOnce('atl-hum-p', { type: 'geojson', data: FC(pts) });
      const ptLayer = (kind, col, r, stroke) => { const id = 'atl-pt-' + kind; add({ id, type: 'circle', source: 'atl-hum-p', filter: ['==', ['get', 'kind'], kind], layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, r * 0.6, 16, r * 1.6], 'circle-color': stroke ? '#FFFFFF' : col, 'circle-stroke-color': stroke ? col : '#FFFFFF', 'circle-stroke-width': stroke ? 2 : 0.8, 'circle-opacity': 0, 'circle-stroke-opacity': 0, 'circle-opacity-transition': { duration: 600 }, 'circle-stroke-opacity-transition': { duration: 600 } } }); ids.push(id); };
      ptLayer('square_pt', c.square, 3.4); ptLayer('market', c.market, 6); ptLayer('cafe', c.cafe, 2.4); ptLayer('playground', c.play, 3); ptLayer('civic', c.civic, 3.6, true);
    }
    cache['ids_' + k] = ids; return ids;
  }
  // opacity per layer when shown (the same strengths as the Exercise 1.3 maps)
  function fullOpacity(id) { if (/^atl-den-/.test(id)) return 0.88; if (id === 'atl-fg') return 0.95; if (id === 'atl-gap') return 0.55; if (/^atl-cen-/.test(id)) return 0.9; if (/^atl-lst-/.test(id)) return 0.82; if (id === 'atl-veg') return 1; if (id === 'atl-far') return 0.42; if (id === 'atl-park') return 0.75; if (id === 'atl-square') return 0.92; return 1; }
  function opacityProps(id) { const l = map.getLayer(id); if (!l) return []; return l.type === 'fill' ? ['fill-opacity'] : l.type === 'line' ? ['line-opacity'] : l.type === 'raster' ? ['raster-opacity'] : l.type === 'circle' ? ['circle-opacity', 'circle-stroke-opacity'] : l.type === 'symbol' ? ['text-opacity'] : []; }
  function setOp(id, v) { opacityProps(id).forEach(p => map.setPaintProperty(id, p, v)); }
  // reveal groups: the order in which a topic's classes appear (low → high, cool → hot, open → meeting places)
  function revealGroups(k) {
    const ids = topicLayerIds(k);
    if (k === 'morphology') return [['atl-fg'], ['atl-gap', 'atl-gap-l']];
    if (k === 'centre') return ids.filter(i => /^atl-cen-/.test(i)).map(i => [i]).concat([['atl-hist'], ['atl-peaks', 'atl-peaks-l']]);
    if (k === 'climate') return ids.filter(i => /^atl-lst-/.test(i)).map(i => [i]).concat([['atl-veg']]);
    if (k === 'human') return [['atl-far'], ['atl-park'], ['atl-square', 'atl-pt-square_pt'], ['atl-pt-market'], ['atl-pt-cafe'], ['atl-pt-playground'], ['atl-pt-civic']];
    return ids.map(i => [i]);
  }
  function stopReveal() { clearTimeout(S.reveal.timer); S.reveal.timer = null; }
  function reveal(k, instant) {
    stopReveal(); const groups = revealGroups(k); S.reveal.step = 0; const done = () => { S.reveal.timer = null; renderPanel(); };
    if (instant || REDUCED) { groups.flat().forEach(id => setOp(id, fullOpacity(id))); done(); return; }
    groups.flat().forEach(id => setOp(id, 0));
    const step = () => { if (S.topic !== k) return; const g = groups[S.reveal.step]; if (!g) { done(); return; } g.forEach(id => setOp(id, fullOpacity(id))); S.reveal.step++; renderStep(); S.reveal.timer = setTimeout(step, 700); };
    S.reveal.timer = setTimeout(step, 250); renderPanel();
  }
  function showTopicLayers(k) {
    TOPICS.forEach(o => topicLayerIds(o).forEach(id => setVis(id, o === k)));
  }
  // the topic's companion GIS layers (existing atlas layers) — switched on with the topic, never switched off by it
  const COMPANION = { density: [], morphology: [], centre: [], climate: [], human: [] };
  function applyTopicLayers(k, again) { if (!k) return; showTopicLayers(k); reveal(k, false); (COMPANION[k] || []).forEach(id => APP.L.S[id] && !APP.L.S[id].on && APP.L.setOn(id, true)); raise(); if (again) toast(t('v23.topicRestored')); }

  // ---------- WHERE / WHAT ----------
  async function setArea(a, opts) {
    if (!AREAS.includes(a)) return; opts = opts || {}; await loadAll(); S.area = a; S.min = false; closeSide();
    const hl = []; if (a === 'factory' && estate()) hl.push(estate()); if (a === 'metro' && track()) hl.push(track());
    map.getSource('atl-hl').setData(FC(hl));
    if (a === 'metro') APP.L.S.south_metro && !APP.L.S.south_metro.on && APP.L.setOn('south_metro', true);
    if (a === 'factory') APP.L.S.escuzar_pole && !APP.L.S.escuzar_pole.on && APP.L.setOn('escuzar_pole', true);
    if (a === 'city') stopGrowth(false);
    const bb = a === 'city' ? CITY_BB : a === 'factory' ? bboxOf(estate().geometry.coordinates) : corridor().ll;
    if (!opts.noFly) map.fitBounds(bb, { padding: pad(a === 'city' ? 40 : 70), duration: REDUCED ? 0 : 1800, maxZoom: a === 'city' ? 12 : 15, essential: true });
    applyMask(); markers(); renderSide(); renderPanel(); $('#atl-back').hidden = a === 'city';
    if (a === 'city' && !S.topic && S.growth.on) startGrowth(); else stopGrowth(false);
  }
  async function setTopic(k) {
    await loadAll(); S.topic = TOPICS.includes(k) ? k : null; S.min = false; closeSide(); stopGrowth(false);
    if (S.topic) { buildTopic(S.topic); setVis('atl-veil', true); setVis('atl-frame', true); map.getSource('atl-frame').setData(FC([{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: frameLL().concat([frameLL()[0]]) } }])); applyTopicLayers(S.topic); }
    else { stopReveal(); TOPICS.forEach(o => topicLayerIds(o).forEach(id => setVis(id, false))); setVis('atl-veil', false); setVis('atl-frame', false); if (S.area === 'city' && S.growth.on) startGrowth(); }
    // a topic chosen at city scale frames the analysis extent; inside a study area the zoom is kept
    if (S.topic && S.area === 'city') map.fitBounds(frameBB(), { padding: pad(40), duration: REDUCED ? 0 : 1400, maxZoom: 13 });
    applyMask(); renderSide(); renderPanel();
  }
  // outside the selected study area the analysis is faded (metro corridor); the factory has no analysis data
  function applyMask() {
    const on = !!S.topic && S.area === 'metro'; const src = map.getSource('atl-mask');
    if (on) { const fr = frameLL(); src.setData(FC([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-20, 20], [20, 20], [20, 60], [-20, 60], [-20, 20]], fr.concat([fr[0]]).reverse()] } }]));
      if (!map.getSource('atl-corr')) { addOnce('atl-corr', { type: 'image', url: corridorMask(), coordinates: fr }); add({ id: 'atl-corr', type: 'raster', source: 'atl-corr', layout: { visibility: 'none' }, paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 } }); } }
    setVis('atl-mask', on); setVis('atl-corr', on); raise();
  }

  // ---------- markers: the two study areas, clickable at every scale ----------
  let MK = {};
  function markers() {
    if (!SOUTH) return; const pos = { factory: estate() ? centroid(estate().geometry) : null, metro: track() ? midpoint(track().geometry) : null };
    ['factory', 'metro'].forEach(a => { if (!pos[a]) return; if (!MK[a]) { const el = document.createElement('button'); el.type = 'button'; el.className = 'atl-mk atl-mk-' + a; el.addEventListener('click', (e) => { e.stopPropagation(); setArea(a); });
        MK[a] = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(pos[a]).addTo(map); }
      const el = MK[a].getElement(); el.innerHTML = `<span class="atl-mk-pin" style="background:${dotCol(a)}" aria-hidden="true"></span><span class="atl-mk-t">${esc(t('v23.mk.' + a))}</span>`; el.setAttribute('aria-label', t('v23.goArea', { a: t('v23.area.' + a) })); el.classList.toggle('on', S.area === a); });
  }
  const centroid = (g) => { const pts = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]); const s = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]); return [s[0] / pts.length, s[1] / pts.length]; };
  const midpoint = (g) => { const p = g.type === 'MultiLineString' ? g.coordinates.flat() : g.coordinates; return p[Math.floor(p.length / 2)]; };

  // ---------- city animation: Granada's documented built-up extents, 1932 → 2020 ----------
  const GROWTH = ['mtn50_1932', 'ams_1956', 'ghsl_1975', 'ghsl_1990', 'ghsl_2000', 'ghsl_2015', 'ghsl_2020'];
  function growthFrame(i) {
    if (!EXT) return; const ex = EXT.extents; const fs = []; const ramp = [P().base.oxblood, P().red, P().base.khaki, P().base.chartreuse, P().base.cream];
    GROWTH.slice(0, i + 1).forEach((id, j) => { const x = ex[id]; if (!x) return; const last = j === i; fs.unshift({ type: 'Feature', properties: { col: last ? P().red : P().base.khaki, op: last ? 0.16 : 0.1, line: last ? P().red : P().base.khaki, w: last ? 2.4 : 1 }, geometry: x.geometry }); });
    map.getSource('atl-growth').setData(FC(fs)); S.growth.i = i; renderStep();
  }
  function startGrowth() { if (!EXT || S.growth.timer) return; setVis('atl-growth-fill', true); setVis('atl-growth-line', true); const tick = () => { growthFrame(S.growth.i); S.growth.i = (S.growth.i + 1) % GROWTH.length; S.growth.timer = setTimeout(tick, S.growth.i === 0 ? 2600 : 1500); }; tick(); }
  function stopGrowth(keepVisible) { clearTimeout(S.growth.timer); S.growth.timer = null; if (!keepVisible) { setVis('atl-growth-fill', false); setVis('atl-growth-line', false); } }
  function growthLabel() { if (!EXT) return ''; const id = GROWTH[(S.growth.i - (S.growth.timer ? 1 : 0) + GROWTH.length) % GROWTH.length] || GROWTH[0]; const x = EXT.extents[id]; if (!x) return '';
    return `<b class="num">${esc(x.period || x.date)}</b> · ${esc(t(x.kind === 'ghsl' ? 'v23.growthGhsl' : 'v23.growthTraced'))}`; }

  // ---------- indicators for the selected area ----------
  function areaIndicators(k) {
    const d = X13; const out = [];
    if (S.area === 'city') { // the frame-wide figures of the Exercise 1.3 analysis
      if (k === 'density') { const s = d.density.stats; out.push([t('x13.i.popFrame'), nf(s.pop_frame) + ' ' + t('x13.modelled')], [t('x13.i.peak'), nf(s.peak) + ' ' + t('x13.perKm2')], [t('x13.i.dense'), nf(s.share_dense, 1) + ' %']); }
      if (k === 'morphology') { const s = d.morphology.stats; out.push([t('x13.i.cov'), nf(s.coverage_frame_pct, 1) + ' %'], [t('x13.i.gaps'), nf(s.gap_area_km2, 2) + ' km²'], [t('x13.i.agree'), nf(s.agree_pct, 0) + ' %']); }
      if (k === 'centre') { const s = d.centre.stats, p = d.centre.peaks; out.push([t('x13.i.places'), nf(s.in_frame)], ['C1', nf(p[0].v) + ' ' + t('x13.placesKm2')], ['C2', nf(p[1].rel) + ' % C1']); }
      if (k === 'climate') { const s = d.climate.stats; out.push([t('x13.i.lstMed'), nf(s.median_frame, 1) + ' °C'], [t('x13.i.lstDense'), nf(s.dense_built, 1) + ' °C'], [t('x13.i.lstVeg'), nf(s.vegetated, 1) + ' °C'], [t('x13.i.lstBare'), nf(s.bare, 1) + ' °C']); }
      if (k === 'human') { const s = d.human.stats; out.push([t('x13.i.reach'), nf(s.reach_pct, 1) + ' %'], [t('x13.i.hAreas'), t('x13.i.hAreasV', { q: nf(s.squares), p: nf(s.parks), m: nf(s.markets) })]); }
      return out;
    }
    if (S.area !== 'metro') return out;
    const key = 'mi_' + k; if (cache[key]) return cache[key];
    const den = d.density, cx = den.corners.x, cy = den.corners.y; const cells = [];
    den.pop.forEach((row, r) => row.forEach((p, q) => { if (p == null) return; const x = (cx[r][q] + cx[r + 1][q + 1]) / 2, y = (cy[r][q] + cy[r + 1][q + 1]) / 2; if (distToTrack(x, y) <= CORRIDOR_M) cells.push({ r, q, p, v: p * 100, x, y }); }));
    if (k === 'density') { const pop = cells.reduce((s, c) => s + c.p, 0); const dense = cells.filter(c => c.v > 10000).reduce((s, c) => s + c.p, 0);
      out.push([t('v23.i.corrRes'), nf(Math.round(pop / 10) * 10) + ' ' + t('x13.modelled')], [t('x13.i.peak'), nf(Math.max(0, ...cells.map(c => c.v))) + ' ' + t('x13.perKm2')], [t('x13.i.dense'), nf(pop ? dense / pop * 100 : 0, 1) + ' %'], [t('v23.i.vsFrame'), nf(d.density.stats.share_dense, 1) + ' %']); }
    if (k === 'morphology') { const v = coverageInCorridor(); out.push([t('v23.i.corrCov'), v == null ? t('v23.computing') : nf(v, 1) + ' %'], [t('v23.i.vsFrame'), nf(d.morphology.stats.coverage_frame_pct, 1) + ' %']);
      const G = d.morphology.grid; const gaps = d.morphology.gaps.filter(([r, q]) => distToTrack(G.x0 + (q + 0.5) * G.cell, G.y1 - (r + 0.5) * G.cell) <= CORRIDOR_M).length; out.push([t('x13.i.gaps'), nf(gaps) + ' × 1 ha']); }
    if (k === 'centre') { const pts = d.centre.points.filter(p => distToTrack(p[0], p[1]) <= CORRIDOR_M); const by = {}; pts.forEach(p => by[p[2]] = (by[p[2]] || 0) + 1);
      const G = d.centre.grid; let mx = 0; d.centre.z.forEach((row, j) => row.forEach((v, i) => { if (v > mx && distToTrack(G.x0 + (i + 0.5) * G.cell, G.y1 - (j + 0.5) * G.cell) <= CORRIDOR_M) mx = v; }));
      const near = d.centre.peaks.map(p => ({ p, dd: distToTrack(p.x, p.y) })).sort((a, b) => a.dd - b.dd)[0];
      out.push([t('v23.i.corrPlaces'), nf(pts.length) + ' — ' + t('x13.i.byCat', { r: nf(by.retail || 0), f: nf(by.food || 0), s: nf(by.service || 0), m: nf(by.market || 0) })], [t('v23.i.corrPeak'), nf(mx) + ' ' + t('x13.placesKm2')], [t('v23.i.nearPeak'), 'C' + near.p.rank + ' · ' + nf(near.dd / 1000, 1) + ' km']); }
    if (k === 'climate') { const g = d.climate.grid; const vs = []; d.climate.lst.forEach((row, j) => row.forEach((v, i) => { if (v != null && distToTrack(g.x0 + (i + 0.5) * g.cell, g.y1 - (j + 0.5) * g.cell) <= CORRIDOR_M) vs.push(v); })); vs.sort((a, b) => a - b);
      const med = vs.length ? vs[Math.floor(vs.length / 2)] : null; out.push([t('v23.i.corrLst'), nf(med, 1) + ' °C'], [t('v23.i.vsFrame'), nf(d.climate.stats.median_frame, 1) + ' °C'], [t('v23.i.hot'), nf(vs.length ? vs.filter(v => v >= 47).length / vs.length * 100 : 0, 0) + ' %']); }
    if (k === 'human') { const pop = cells.reduce((s, c) => s + c.p, 0); const far = new Set(d.human.far.map(([r, q]) => r + ',' + q)); const farPop = cells.filter(c => far.has(c.r + ',' + c.q)).reduce((s, c) => s + c.p, 0);
      const H = d.human; const inC = (list) => (list || []).filter(p => distToTrack(p[0], p[1]) <= CORRIDOR_M).length;
      out.push([t('v23.i.corrRes'), nf(Math.round(pop / 10) * 10) + ' ' + t('x13.modelled')], [t('v23.i.corrFar'), nf(Math.round(farPop / 10) * 10) + ' (' + nf(pop ? farPop / pop * 100 : 0, 0) + ' %)'], [t('v23.i.corrMeet'), t('x13.i.hPtsV', { c: nf(inC(H.points.cafe)), p: nf(inC(H.points.playground)), l: nf(inC(H.points.civic)) }) + ' · ' + t('x13.lg.market') + ' ' + nf(inC(H.points.market))]); }
    cache[key] = out; return out;
  }
  // building coverage inside the corridor, counted on the 4 m figure-ground raster (same source as map 02)
  let covPending = false;
  function coverageInCorridor() {
    if (cache.corrCov != null) return cache.corrCov; if (covPending) return null; covPending = true;
    const g = X13.fgm, img = X13.fgImg; const c = corridor(); const xs = [c.bbU[0], c.bbU[2]], ys = [c.bbU[1], c.bbU[3]];
    const i0 = Math.floor((Math.min(...xs) - g.ox) / g.px_m), i1 = Math.ceil((Math.max(...xs) - g.ox) / g.px_m), j0 = Math.floor((g.oy - Math.max(...ys)) / g.px_m), j1 = Math.ceil((g.oy - Math.min(...ys)) / g.px_m);
    setTimeout(() => { const w = i1 - i0, h = j1 - j0; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); ctx.drawImage(img, i0, j0, w, h, 0, 0, w, h); const px = ctx.getImageData(0, 0, w, h).data; let n = 0, b = 0;
      for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) { const x = g.ox + (i0 + i + 0.5) * g.px_m, y = g.oy - (j0 + j + 0.5) * g.px_m; if (distToTrack(x, y) > CORRIDOR_M) continue; n++; if (px[(j * w + i) * 4 + 3] > 128) b++; }
      cache.corrCov = n ? b / n * 100 : 0; delete cache.mi_morphology; covPending = false; renderPanel(); }, 30);
    return null;
  }

  // ---------- the context panel (one panel: area introduction, topic analysis, legend, sources, controls) ----------
  function legendHTML(k) {
    const c = C(); const items = []; const sw = (col, l, op) => `<li><i class="sw" style="background:${col};opacity:${op || 1}"></i><span>${l}</span></li>`; const ln = (col, l, dash) => `<li><i class="sw ln" style="border-top:2px ${dash ? 'dashed' : 'solid'} ${col}"></i><span>${l}</span></li>`; const dt = (col, l, ring) => `<li><i class="sw dot" style="background:${ring ? '#fff' : col};border:2px solid ${col}"></i><span>${l}</span></li>`;
    const rng = (br, unit) => br.map((b, i) => i === 0 ? `0–${nf(b)}` : `${nf(br[i - 1])}–${nf(b)}`).concat([`> ${nf(br[br.length - 1])}`]).map(s => `<span dir="ltr">${s}</span> ${unit}`);
    if (k === 'density') { const lab = rng(X13.density.breaks, t('x13.perKm2')); c.density.forEach((col, i) => items.push(sw(col, lab[i], 0.88))); }
    if (k === 'morphology') items.push(sw(c.building, t('x13.lg.building')), sw(c.gap, t('x13.lg.gap'), 0.55));
    if (k === 'centre') { const br = X13.centre.breaks; c.centre.forEach((col, i) => items.push(sw(col, (i < br.length - 1 ? `<span dir="ltr">${nf(br[i])}–${nf(br[i + 1])}</span>` : t('x13.atLeast', { v: `<span dir="ltr">${nf(br[i])}</span>` })) + ' ' + t('x13.placesKm2'), 0.9))); items.push(dt(c.centreLine, t('x13.lg.peak'), true), ln(c.hist, t('x13.lg.hist'), true)); }
    if (k === 'climate') { const br = X13.climate.breaks; c.lst.forEach((col, i) => items.push(sw(col, i === 0 ? t('x13.below', { v: `<span dir="ltr">${br[0]} °C</span>` }) : i < br.length ? `<span dir="ltr">${br[i - 1]}–${br[i]} °C</span>` : t('x13.atLeast', { v: `<span dir="ltr">${br[br.length - 1]} °C</span>` }), 0.82))); items.push(ln(c.veg, t('x13.lg.veg'))); }
    if (k === 'human') items.push(sw(c.square, t('x13.lg.square'), 0.92), sw(c.park, t('x13.lg.park'), 0.75), dt(c.market, t('x13.lg.market')), dt(c.cafe, t('x13.lg.cafe')), dt(c.play, t('x13.lg.play')), dt(c.civic, t('x13.lg.civic'), true), sw(c.far, t('x13.lg.far'), 0.42));
    items.push(ln(P().ink, t('v23.lg.frame'), true)); if (S.area === 'metro') items.push(ln(P().ink, t('v23.lg.corridor')));
    return `<ul class="lg">${items.join('')}</ul>`;
  }
  function areaHTML() {
    const a = S.area; let facts = '';
    if (a === 'city') facts = t('v23.intro.city', { pop: `<span class="num">${nf(X13.frame.stats.pop)}</span>`, area: `<span class="num">${nf(X13.frame.stats.area_km2, 1)} km²</span>` });
    if (a === 'factory') { const e = estate(); const gap = SOUTH.pole.features.find(f => f.properties.k === 'gap'); const v = SOUTH.pole.features.find(f => f.properties.k === 'village');
      facts = t('v23.intro.factory', { ha: `<span class="num">${nf(e && e.properties.ha)}</span>`, km: `<span class="num">${nf(gap && gap.properties.km, 1)}</span>`, pop: `<span class="num">${nf(v && v.properties.pop)}</span>` }); }
    if (a === 'metro') { const tr = track(); facts = t('v23.intro.metro', { km: `<span class="num">${nf(tr && tr.properties.len_m / 1000, 1)}</span>` }); }
    return `<div class="atl-area">${dot(a)}<b>${t('v23.area.' + a)}</b></div><p class="atl-p">${facts}</p>`;
  }
  function renderStep() { const el = $('#atl-step'); if (!el) return; el.innerHTML = S.topic ? '' : growthLabel(); }
  function renderPanel() {
    const box = $('#atl-panel'); if (!box || !X13) return; box.classList.toggle('min', S.min);
    const head = `<div class="atl-ph"><span class="plate">${S.topic ? t('v23.analysis') : t('v23.atlas')}</span><button type="button" class="icon-btn" data-atl-min aria-expanded="${!S.min}" aria-label="${esc(t(S.min ? 'v23.expand' : 'v23.collapse'))}">${S.min ? '▴' : '▾'}</button></div>`;
    if (S.min) { box.innerHTML = head.replace('</div>', `<b class="atl-ph-t">${S.topic ? esc(t('e13.t.' + S.topic)) : esc(t('v23.area.' + S.area))}</b></div>`); return; }
    let h = head;
    if (!S.topic) {
      if (S.area === 'city') {
        h += `<h2 class="atl-h">${t('v23.title')}</h2><p class="atl-p">${t('v23.lead')}</p>${areaHTML()}`;
        h += `<div class="atl-cards">${['factory', 'metro'].map(a => `<button type="button" class="atl-card" data-area="${a}">${dot(a)}<b>${t('v23.area.' + a)}</b><span>${t('v23.card.' + a)}</span><span class="atl-go">${t('v23.go')} →</span></button>`).join('')}</div>`;
        h += `<div class="atl-anim"><p class="fine">${t('v23.growthLead')}</p><p class="atl-step" id="atl-step">${growthLabel()}</p><p><button type="button" class="btn btn-tiny" data-atl-growth>${t(S.growth.timer ? 'v23.growthPause' : 'v23.growthPlay')}</button></p></div>`;
      } else h += areaHTML();
      h += `<p class="atl-hint">${t('v23.pickTopic')}</p><div class="atl-chips">${TOPICS.map((k, i) => `<button type="button" class="atl-chip" data-topic="${k}">${String(i + 1).padStart(2, '0')} ${t('e13.t.' + k)}</button>`).join('')}</div>`;
      box.innerHTML = h; return;
    }
    const k = S.topic, cov = coverage(S.area);
    h += `<h2 class="atl-h"><span class="num">${String(TOPICS.indexOf(k) + 1).padStart(2, '0')}</span> ${t('e13.t.' + k)}</h2><p class="atl-p">${t('x13.q.' + k)}</p>${areaHTML()}`;
    if (!cov.ok) { h += `<div class="atl-na"><b>${t('v23.na.title')}</b><p>${t('v23.na.factory', { km: `<span class="num">${nf(cov.dist / 1000, 1)}</span>` })}</p><p class="fine">${t('v23.na.need')}</p><p><button type="button" class="btn btn-tiny" data-area="city">${t('v23.na.showCity')}</button></p></div>`; box.innerHTML = h; return; }
    const ind = areaIndicators(k); if (S.area === 'metro' && cov.partial) h += `<p class="fine">${t('v23.partial')}</p>`;
    h += `<dl class="atl-ind">${ind.map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('')}</dl>`;
    h += `<div class="atl-lg">${legendHTML(k)}</div>`;
    h += `<div class="atl-ctl"><button type="button" class="btn btn-tiny" data-atl-play>${t(S.reveal.timer ? 'v23.playing' : 'v23.replay')}</button> <button type="button" class="btn btn-tiny" data-atl-page="ex13">${t('v23.openPage')}</button> <button type="button" class="btn btn-tiny" data-topic="">${t('v23.clearTopic')}</button></div>`;
    h += `<details class="atl-src"><summary>${t('v23.sources')}</summary><p>${t('x13.src.' + k, k === 'climate' ? { n: String(X13.climate.stats.scenes) } : { date: String((k === 'human' ? X13.human.source.date : X13.centre.source.date) || '').slice(0, 10), n: nf(X13.centre.stats.in_frame), dup: nf(X13.centre.stats.duplicates) })}</p><p>${t('x13.lim.' + k, { d: (X13.density.stats.diff_pct > 0 ? '+' : '') + nf(X13.density.stats.diff_pct, 1) + ' %', r: 'r = ' + nf(X13.centre.stats.overture_corr, 2), min: String(X13.climate.stats.min_obs) })}</p>${S.area === 'metro' ? `<p>${t('v23.corrNote')}</p>` : ''}</details>`;
    box.innerHTML = h;
  }
  function onPanelClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.atlMin != null) { S.min = !S.min; renderPanel(); return; }
    if (b.dataset.area) { setArea(b.dataset.area); return; }
    if (b.dataset.topic != null) { setTopic(b.dataset.topic || null); return; }
    if (b.dataset.atlPlay != null) { reveal(S.topic); return; }
    if (b.dataset.atlPage) { PG.go(b.dataset.atlPage); return; }
    if (b.dataset.atlGrowth != null) { S.growth.on = !S.growth.timer; if (S.growth.on) startGrowth(); else stopGrowth(true); renderPanel(); renderSide(); return; }
  }

  // ---------- start ----------
  function buildOverlay() {
    const st = $('.stage');
    const panel = document.createElement('section'); panel.id = 'atl-panel'; panel.className = 'atl-panel'; panel.setAttribute('aria-live', 'polite'); st.appendChild(panel); panel.addEventListener('click', onPanelClick); if (root.ResizeObserver) new ResizeObserver(relayout).observe(panel);
    const back = document.createElement('button'); back.type = 'button'; back.id = 'atl-back'; back.className = 'atl-back'; back.hidden = true; st.appendChild(back); back.addEventListener('click', () => setArea('city'));
  }
  function relabel() { const b = $('#atl-back'); if (b) b.textContent = '← ' + t('v23.back'); const bg = $('#atl-burger'); if (bg) bg.setAttribute('aria-label', t('v23.menu')); renderSide(); renderPanel(); markers(); }
  async function init() {
    APP = root.GA.app; map = APP.map; buildShell(); if (root.GA.panels.isOpen('analysis')) S.min = true; buildOverlay(); relabel();
    const go = async () => { buildBase(); await loadAll(); ready = true; relabel(); markers();
      const legacy = !!root.__gaLegacyView; // test hook only: the pre-5.25 suites keep their old opening view (no city fit, no animation)
      if (!PG.current && !legacy) map.fitBounds(CITY_BB, { padding: pad(40), duration: 0 }); // the city first, never inside a study area
      if (S.growth.on && !legacy) startGrowth(); else growthFrame(GROWTH.length - 1);
      map.on('styledata', () => { if (map.getLayer('atl-veil')) raise(); }); APP.L.onChange(() => setTimeout(raise, 0)); };
    if (map.loaded()) go(); else map.once('load', go);
    I.onChange(relabel);
    addEventListener('hashchange', () => { if (/^#\/./.test(location.hash)) closeSide(); }); // any page that opens (menu, link, code) closes the menu
  }
  root.GA.atlas = { init, setArea, setTopic, get state() { return { area: S.area, topic: S.topic, revealing: !!S.reveal.timer, growing: !!S.growth.timer, ready }; }, coverage: (a) => coverage(a), indicators: (k) => areaIndicators(k), topicLayers: (k) => topicLayerIds(k), corridor: () => corridor() };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0)); else setTimeout(init, 0);
})(window);
