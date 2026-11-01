/* Application wiring. Fixed physical layout in every language: analysis on the LEFT,
   study-area controls and layers on the RIGHT, the map between them. Switching language
   re-renders text only; panels, selection, saved project and results stay where they are. */
(function () {
  const { geo: G, analysis: A, sources: S, store, report: RP, basemap, i18n: I, palette: PAL, data: D, gallery: GAL, mapcard: MC, section: SEC, proj: PJ } = window.GA;
  const t = (k, v) => I.t(k, v);
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = RP.esc, nf = RP.nf;
  const fmtArea = RP.fmtArea, fmtLen = RP.fmtLen;
  const ANALYSIS_MAX_AREA = 12e6; // m² — local tiled data; larger areas would load too many tiles

  store.load(); I.apply();
  let leftStale = true; let currentAreaId = null; let run = null; let leftTab = 'maps'; let activeSection = null; const secProfiles = new Map();

  // ---------- layout state: three independent floating panels over a full-size map ----------
  // body classes: left-collapsed = Analysis closed, right-collapsed = Study area closed, layers-collapsed = Layers closed.
  // Every visit starts with all three closed (only the widths the visitor chose are remembered).
  const UIK = 'granada-atlas.ui';
  let ui = {}; try { ui = JSON.parse(localStorage.getItem(UIK) || '{}'); } catch (e) { }
  const saveUI = () => { try { localStorage.setItem(UIK, JSON.stringify({ lw: ui.lw, rw: ui.rw })); } catch (e) { } };
  const rootEl = document.documentElement;
  if (ui.lw) rootEl.style.setProperty('--lw', Math.min(760, Math.max(300, ui.lw)) + 'px');
  if (ui.rw) rootEl.style.setProperty('--rw', Math.min(560, Math.max(260, ui.rw)) + 'px');
  document.body.classList.add('left-collapsed', 'right-collapsed', 'layers-collapsed');

  // ---------- map ----------
  const map = new maplibregl.Map({ container: 'map', style: basemap.style(), center: [-3.5986, 37.1773], zoom: 13.2, minZoom: 10, maxZoom: 19, attributionControl: false, dragRotate: false, pitchWithRotate: false, preserveDrawingBuffer: false });
  map.touchZoomRotate.disableRotation();
  // physical corners: navigation top-right, scale bottom-left, attribution bottom-right — never mirrored
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 140 }), 'bottom-left');
  // standalone "Draw section" on the main map: no study area needed (see startSection)
  const secCtl = { onAdd() { const d = document.createElement('div'); d.className = 'maplibregl-ctrl maplibregl-ctrl-group ga-secctl'; d.innerHTML = `<button type="button" id="map-draw-section" class="ga-secbtn"><span class="ic" aria-hidden="true">A–B</span><span class="tx"></span></button>`; d.querySelector('button').addEventListener('click', () => startSection()); this._d = d; this.label(); return d; },
    onRemove() { this._d.remove(); }, label() { if (!this._d) return; const b = this._d.querySelector('button'); b.querySelector('.tx').textContent = GA.i18n.t('v6.drawSection'); b.title = GA.i18n.t('v6.drawSectionHint'); b.setAttribute('aria-label', GA.i18n.t('v6.drawSection')); } };
  map.addControl(secCtl, 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap contributors (ODbL) · IGN MDT25 (CC BY 4.0) · JRC GHSL' }), 'bottom-right');
  // the map is full width under the floating panels, so MapLibre would show the long attribution expanded on tablets, where it
  // would run under the legend: start it collapsed (ⓘ, one tap to open) below 1000 px
  map.once('load', () => { if (innerWidth < 1000) { const el = document.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show'); if (el) el.classList.remove('maplibregl-compact-show'); } });
  try { maplibregl.setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js', true); } catch (e) { }
  let tileErrors = 0;
  map.on('error', (e) => { if ((e && e.sourceId === 'omt') || /tiles\.openfreemap/.test(String(e && e.error && e.error.message))) { tileErrors++; if (tileErrors === 3) toast(t('toast.tiles'), true); } });

  // ---------- tools ----------
  const L = GA.layers.create(map);
  const secTool = SEC.tool(map, { onCreate: createSection, onEdit: editSection, onMode: sectionMode });
  const sel = GA.selection.create(map, { onChange: (info) => { renderSelectPanel(info); updateMask(); }, intercept: mapClick });
  const IMP = GA.imports.create({ layers: L, store, loadSQL, toast: (m, e) => toast(m, e), onChange: renderLayersPanel });
  const CMP = GA.compare.create({ store, toast: (m, e) => toast(m, e), onClose: () => { $('#tb-compare').classList.remove('on'); map.resize(); }, onExport: exportMulti });
  window.GA.app = { map, sel, store, L, IMP, CMP, getRun: () => run, secTool, secProfiles, refresh: () => renderLeft(), openArea: (id) => openArea(id), openWorkspace: (tab) => openWorkspace(tab) }; // exposed for tests and pages
  window.GA.toast = (m, e) => toast(m, e);
  const PG = GA.pages;
  PG.onChange((r) => { document.querySelectorAll('.tb-btn[data-page]').forEach(b => b.classList.toggle('on', !!r && b.dataset.page === r.name)); if (r) { closeDrawer(); if (CMP.isOpen()) CMP.close(); } else { map.resize(); renderLayersPanel(); } });
  document.querySelectorAll('.tb-btn[data-page]').forEach(b => b.addEventListener('click', () => PG.current && PG.current.name === b.dataset.page ? PG.close() : PG.go(b.dataset.page)));
  L.onChange(() => { renderLayersPanelSoon(); renderLegend(); });

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, isErr) { const el = $('#toast'); el.textContent = msg; el.className = 'toast show' + (isErr ? ' err' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = 'toast', 4800); }

  // ---------- language ----------
  function renderLangSwitch() {
    $('#lang').innerHTML = Object.keys(I.LANGS).map(l => `<button class="lang-btn ${I.lang === l ? 'on' : ''}" data-lang="${l}" lang="${l}" dir="${I.LANGS[l].dir}" aria-pressed="${I.lang === l}">${I.LANGS[l].label}</button>`).join('<span class="lang-sep" aria-hidden="true">|</span>');
  }
  $('#lang').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b && b.dataset.lang !== I.lang) I.setLang(b.dataset.lang); });
  I.onChange(() => {
    renderLangSwitch(); sel.redraw(); secTool.render(); secCtl.label();
    renderSelectPanel(sel.info()); renderLeft(); renderLayersPanel(); renderLegend(); renderDrawerIfOpen(); if (CMP.isOpen()) CMP.render();
    updateToggles();
  });
  renderLangSwitch();

  // ---------- panels: three independent floating panels (Analysis LEFT; Study area and Layers RIGHT) ----------
  // The map never changes size when a panel opens or closes, so its centre, zoom, selection and layers stay exactly as
  // they were; panels only cover part of it. --lw-eff / --rw-eff tell the map overlays (legend, north arrow, drawer,
  // banners, map controls) and fitTo how much of each side is covered.
  const PN = { analysis: 'left-collapsed', study: 'right-collapsed', layers: 'layers-collapsed' };
  const isOpen = (k) => !document.body.classList.contains(PN[k]);
  const phone = () => innerWidth < 700, narrow = () => innerWidth < 1000;
  function layout() {
    const B = document.body.classList; const dock = isOpen('study') || isOpen('layers'); B.toggle('dock-closed', !dock); B.toggle('dock-both', isOpen('study') && isOpen('layers'));
    const gut = 12; const lw = phone() || !isOpen('analysis') ? 0 : $('#col-left').offsetWidth + gut; const rw = phone() || !dock ? 0 : $('#col-right').offsetWidth + gut;
    rootEl.style.setProperty('--lw-eff', lw + 'px'); rootEl.style.setProperty('--rw-eff', rw + 'px');
  }
  function updateToggles() {
    Object.keys(PN).forEach(k => { const b = document.querySelector(`.pn-tab[data-pn="${k}"]`); if (b) { b.setAttribute('aria-expanded', String(isOpen(k))); b.classList.toggle('on', isOpen(k)); } });
    const v = isOpen('analysis') ? 'analysis' : isOpen('study') ? 'study' : isOpen('layers') ? 'layers' : 'map'; document.querySelectorAll('#phone-bar [data-pv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pv === v)));
    layout();
  }
  // open/close one panel; phones show one sheet at a time, tablets one side at a time, desktops any combination
  function setPanel(k, open) {
    const B = document.body.classList; if (open === isOpen(k)) return;
    if (open) { if (phone()) Object.keys(PN).forEach(o => o !== k && B.add(PN[o])); else if (narrow()) { if (k === 'analysis') { B.add(PN.study, PN.layers); } else B.add(PN.analysis); } }
    B.toggle(PN[k], !open); updateToggles();
    if (k === 'analysis' && open && leftStale) renderLeft(); // only if something changed while closed; the Study area and Layers panels stay rendered while hidden (unsaved input is kept)
    if (open) { const el = k === 'analysis' ? $('#col-left') : $('#pn-' + k); const f = el && el.querySelector('.pn-x'); if (f && document.activeElement && document.activeElement.closest && document.activeElement.closest('.pn-tab, #phone-bar')) f.focus({ preventScroll: true }); }
  }
  // legacy helpers used by the analysis flows (open the Analysis panel when results arrive)
  function onlyOne(side) { /* kept for older call sites: tablets show one side at a time (handled by setPanel) */ }
  function setPhoneView(v) { if (v === 'map') Object.keys(PN).forEach(k => setPanel(k, false)); else setPanel(v === 'study' ? 'study' : v === 'layers' ? 'layers' : 'analysis', true); }
  function openLeft() { setPanel('analysis', true); }
  window.GA.panels = { set: setPanel, isOpen, toggle: (k) => setPanel(k, !isOpen(k)) };
  document.querySelectorAll('.pn-tab').forEach(b => b.addEventListener('click', () => setPanel(b.dataset.pn, !isOpen(b.dataset.pn))));
  document.addEventListener('click', (e) => { const x = e.target.closest('[data-pn-close]'); if (!x) return; const k = x.dataset.pnClose; setPanel(k, false); const tab = document.querySelector(`.pn-tab[data-pn="${k}"]`); if (tab && !phone()) tab.focus({ preventScroll: true }); });
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape' || !phone()) return; if (document.querySelector('.vw, .modal:not([hidden])')) return; const k = Object.keys(PN).find(isOpen); if (k) setPanel(k, false); });
  $('#phone-bar').addEventListener('click', (e) => { const b = e.target.closest('[data-pv]'); if (b) setPhoneView(b.dataset.pv); });
  $('#tb-menu').addEventListener('click', () => { const o = document.body.classList.toggle('menu-open'); $('#tb-menu').setAttribute('aria-expanded', String(o)); });
  $('#tb-nav').addEventListener('click', (e) => { if (e.target.closest('.tb-btn')) { document.body.classList.remove('menu-open'); $('#tb-menu').setAttribute('aria-expanded', 'false'); } });
  updateToggles();
  // narrow screens: never both sides at once (rotation, resize)
  addEventListener('resize', () => { if (narrow() && isOpen('analysis') && (isOpen('study') || isOpen('layers'))) { document.body.classList.add(PN.study, PN.layers); } if (phone()) { const open = Object.keys(PN).filter(isOpen); open.slice(1).forEach(k => document.body.classList.add(PN[k])); } updateToggles(); });
  document.querySelectorAll('.resizer').forEach(r => r.addEventListener('mousedown', (e) => {
    e.preventDefault(); const side = r.dataset.resize; r.classList.add('drag');
    const move = (ev) => { const w = side === 'left' ? Math.min(760, Math.max(300, ev.clientX - 12)) : Math.min(560, Math.max(260, innerWidth - ev.clientX - 12)); rootEl.style.setProperty(side === 'left' ? '--lw' : '--rw', w + 'px'); ui[side === 'left' ? 'lw' : 'rw'] = w; layout(); };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); r.classList.remove('drag'); saveUI(); layout(); if (side === 'left') renderLeft(); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }));
  window.addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(() => { map.resize(); layout(); if (leftTab === 'maps') renderLeft(); }, 200); });

  // ---------- study-area panel (right, top) ----------
  const shapeLabel = (k) => ({ circle: t('shape.circle'), square: t('shape.square'), polygon: t('shape.polygonShort') }[k] || '');
  // explicit on-map buttons while a polygon is being drawn (touch: no double-click or Enter needed)
  function polyBanner(info) {
    const mb = $('#mode-banner'); if (secTool && secTool.isDrawing && secTool.isDrawing()) return;
    if (info && info.type === 'polygon' && !info.closed && info.phase !== 'idle') { mb.hidden = false; mb.dataset.mode = 'poly'; mb.innerHTML = `<span>${t('v5.polyBanner', { n: info.verts || 0 })}</span> <button class="btn btn-tiny" id="pb-undo" ${info.verts ? '' : 'disabled'}>${t('v5.undoPoint')}</button><button class="btn btn-tiny" id="pb-finish" ${info.verts >= 3 ? '' : 'disabled'}>${t('v5.finish')}</button><button class="btn btn-tiny" id="pb-cancel">${t('cancel')}</button>`; }
    else if (mb.dataset.mode === 'poly') { mb.hidden = true; mb.dataset.mode = ''; }
  }
  function renderSelectPanel(info) {
    polyBanner(info);
    const p = $('#panel-select .block-b'); const area = currentAreaId && store.get().areas.find(a => a.id === currentAreaId);
    let h = '';
    if (info.phase === 'idle' && !info.ring) {
      h = `<p class="lead">${t('sel.leadV2')}</p><p class="fine sp-sec">${t('v6.orSection')} <button class="btn btn-small" id="sp-draw-section">${t('v6.drawSection')}</button></p>`;
      const areas = store.get().areas;
      if (areas.length) h += `<div class="sub">${t('sel.saved')}</div><ul class="saved-mini">${areas.slice(-6).reverse().map(a => `<li><button class="link" data-open="${a.id}"><bdi>${esc(a.name)}</bdi></button><small>${shapeLabel(a.spec.type)} · ${fmtArea(a.measures.area)}</small></li>`).join('')}</ul>`;
    } else if (info.phase === 'idle') {
      h = `<p class="lead">${t('sel.armLead')}</p><button class="btn" id="btn-cancel-arm">${t('cancel')}</button>`;
    } else if (info.phase === 'pending') {
      h = `<p class="lead">${t('sel.pendingLead')}</p>`;
    } else {
      h += `<div class="center-ref"><div><small>${t('sel.center')}</small> <span dir="ltr" class="mono">${info.center[1].toFixed(5)}, ${info.center[0].toFixed(5)}</span></div><button class="btn btn-tiny" id="btn-arm">${t('sel.change')}</button></div>`;
      h += `<div class="seg" role="tablist">${['square', 'circle', 'polygon'].map(k => `<button role="tab" aria-selected="${info.type === k}" class="${info.type === k ? 'on' : ''}" data-tool="${k}">${t('shape.' + k)}</button>`).join('')}</div>`;
      if (info.type === 'circle') h += `<label class="num"><span>${t('sel.radius')}</span><input id="in-radius" type="number" min="${sel.LIMITS.radius[0]}" max="${sel.LIMITS.radius[1]}" step="5" value="${info.radius}"><span class="u">${t('u.m')}</span></label>`;
      if (info.type === 'square') h += `<label class="num"><span>${t('sel.side')}</span><input id="in-side" type="number" min="${sel.LIMITS.side[0]}" max="${sel.LIMITS.side[1]}" step="10" value="${info.side}"><span class="u">${t('u.m')}</span></label>`;
      if (info.type === 'polygon') h += info.closed ? `<p class="hint">${t('sel.polyEditHint')}</p>` : `<p class="hint">${t('sel.polyDrawHint', { n: info.verts })}</p><button class="btn btn-small" id="btn-close" ${info.verts < 3 ? 'disabled' : ''}>${t('sel.closePoly')}</button>`;
      if (info.ring) {
        h += `<dl class="measures"><div><dt>${t('m.area')}</dt><dd>${fmtArea(info.area)}</dd></div><div><dt>${t('m.perimeter')}</dt><dd>${fmtLen(info.perimeter)}</dd></div><div><dt>${t('m.dims')}</dt><dd>${info.type === 'circle' ? t('m.r', { v: nf(info.radius) }) : info.type === 'square' ? `<span dir="ltr">${nf(info.side)} × ${nf(info.side)}</span>` : t('m.vertices', { n: info.verts })}</dd></div></dl>`;
        if (info.selfIntersects) h += `<div class="warn">${t('sel.selfX')}</div>`;
        if (info.area > ANALYSIS_MAX_AREA) h += `<div class="warn">${t('sel.tooBig', { v: nf(ANALYSIS_MAX_AREA / 1e6, 1) })}</div>`;
        h += `<label class="name"><span>${t('sel.name')}</span><input id="in-name" type="text" dir="auto" maxlength="60" placeholder="${esc(t('sel.namePh'))}" value="${esc(area ? area.name : '')}"></label>`;
        h += `<div class="actions"><button class="btn btn-primary" id="btn-analyze" ${info.selfIntersects || info.area > ANALYSIS_MAX_AREA ? 'disabled' : ''}>${t('sel.analyze')}</button><button class="btn" id="btn-save">${t('save')}</button>${area ? `<button class="btn" id="btn-saveas">${t('sel.saveAs')}</button>` : ''}<button class="btn btn-gis btn-small" id="btn-gis" ${info.selfIntersects ? 'disabled' : ''}>GIS ↓</button></div>`;
      }
      h += `<div class="actions minor"><button class="btn btn-tiny" id="btn-undo" ${info.canUndo ? '' : 'disabled'}>${t('undo')}</button><button class="btn btn-tiny" id="btn-reset">${t('reset')}</button>${info.ring ? `<button class="btn btn-tiny" id="btn-fit">${t('sel.fit')}</button>` : ''}</div>`;
      if (area) h += `<p class="fine">${t('sel.editing', { name: '<bdi>' + esc(area.name) + '</bdi>' })}</p>`;
    }
    const nameVal = $('#in-name') && $('#in-name').value;
    p.innerHTML = h;
    if (nameVal && $('#in-name') && !area) $('#in-name').value = nameVal;
    $('#measure-out').hidden = !info.measure.on && !info.measure.pts;
    $('#measure-out').innerHTML = `${t('measure.out', { v: fmtLen(info.measure.length) })} <button class="btn btn-tiny" id="btn-mclear">${t('clear')}</button>`;
    $('#tb-measure').classList.toggle('on', info.measure.on);
  }

  // ---------- layers panel (right, below the study panel) ----------
  let lpTimer; function renderLayersPanelSoon() { clearTimeout(lpTimer); lpTimer = setTimeout(renderLayersPanel, 60); }
  const GROUPS = ['bld', 'streets', 'land', 'act', 'fac', 'env', 'hist', 'admin', 'terrain', 'user'];
  function renderLayersPanel() {
    const box = $('#panel-layers .block-b'); if (!box) return;
    const focus = document.activeElement && document.activeElement.closest && document.activeElement.closest('#panel-layers') && document.activeElement.matches('input[type=text], input[type=search]');
    if (focus) return; // do not re-render while the user types a layer name
    const st = (id) => { const s = L.S[id]; if (!s || !s.on) return ''; const k = s.status || 'idle'; return `<span class="lyr-st ${k}">${t('ly.st.' + k, { n: s.statusExtra != null && isFinite(s.statusExtra) ? nf(s.statusExtra) : '' })}</span>`; };
    const all = L.order.map(id => L.byId[id] || L.userDefs.find(u => u.id === id)).filter(Boolean);
    let h = `<div class="scope" role="group"><button class="${L.scope === 'city' ? 'on' : ''}" data-scope="city">${t('ly.scopeCity')}</button><button class="${L.scope === 'areas' ? 'on' : ''}" data-scope="areas">${t('ly.scopeAreas')}</button></div><p class="fine">${t(L.scope === 'city' ? 'ly.scopeCityNote' : 'ly.scopeAreasNote')}</p>`;
    // any layer whose group is not listed still gets a row (never silently dropped)
    const groups = GROUPS.slice(0, -1).concat([...new Set(all.map(d => d.group))].filter(g => !GROUPS.includes(g)), ['user']);
    groups.forEach(g => {
      const ds = all.filter(d => d.group === g); if (!ds.length && g !== 'user') return;
      h += `<div class="lyr-group">${t('ly.g.' + g)}</div>`;
      ds.forEach(d => {
        const s = L.S[d.id]; const i = L.order.indexOf(d.id);
        h += `<div class="lyr ${s.on ? 'on' : ''}"><div class="lyr-h"><label><input type="checkbox" data-ly="${d.id}" ${s.on ? 'checked' : ''}><span dir="auto">${esc(d.title())}</span></label>${st(d.id)}<span><button class="icon-btn" data-ly-up="${d.id}" title="${esc(t('ly.up'))}" ${i <= 0 ? 'disabled' : ''}>↑</button><button class="icon-btn" data-ly-down="${d.id}" title="${esc(t('ly.down'))}" ${i >= L.order.length - 1 ? 'disabled' : ''}>↓</button></span></div>`;
        if (s.on) h += `<div class="lyr-b"><label class="row2">${t('ly.opacity')} <input type="range" min="0.1" max="1" step="0.05" value="${s.opacity}" data-ly-op="${d.id}"></label>${d.controls ? d.controls() : ''}${d.user ? IMP.userControls(d.id) : ''}<span class="lyr-src">${t('src.label')} ${d.src ? d.src() : ''}</span></div>`;
        h += `</div>`;
      });
      if (g === 'user') h += IMP.panelHTML();
    });
    box.innerHTML = h;
  }
  $('#panel-layers').addEventListener('click', async (e) => {
    if (await IMP.onEvent(e)) return;
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.lyCtl) { L.control(b.dataset.lyCtl, b); return; }
    if (b.dataset.scope) { L.setScope(b.dataset.scope); updateMask(); return; }
    if (b.dataset.lyUp) return L.move(b.dataset.lyUp, -1);
    if (b.dataset.lyDown) return L.move(b.dataset.lyDown, 1);
  });
  $('#panel-layers').addEventListener('change', async (e) => {
    if (await IMP.onEvent(e)) return;
    const el = e.target;
    if (el.dataset.lyCtl && el.type !== 'search') { L.control(el.dataset.lyCtl, el); return; }
    if (el.dataset.ly) { L.setOn(el.dataset.ly, el.checked); IMP.syncState(); store.save(); }
    if (el.dataset.lyMetric) L.setMetric(el.dataset.lyMetric, el.value);
  });
  let lySearchT; $('#panel-layers').addEventListener('input', (e) => { const el = e.target; if (el.dataset.lyOp) { L.setOpacity(el.dataset.lyOp, +el.value); IMP.syncState(); } if (el.dataset.lyCtl && el.type === 'search') { clearTimeout(lySearchT); lySearchT = setTimeout(() => { L.control(el.dataset.lyCtl, el); const box = $('#panel-layers .block-b'); const keep = el.value; document.activeElement.blur(); renderLayersPanel(); const ne = box.querySelector('input[type=search][data-ly-ctl]'); if (ne) { ne.focus(); ne.value = keep; ne.setSelectionRange(keep.length, keep.length); } }, 300); } });

  function renderLegend() {
    const el = $('#legend'); let h = L.legendHTML();
    if (run && sel.info().ring) h += `<h4>${t('lg.study')}</h4><ul class="lg"><li><i class="sw ln" style="border-top:2px solid ${PAL.red}"></i><span>${t('lg.studyArea')}</span></li></ul>`;
    el.hidden = !h; if (!h) return;
    el.classList.toggle('min', !!ui.legendMin);
    el.innerHTML = `<button class="legend-t" id="legend-toggle" aria-expanded="${!ui.legendMin}">${t('lg.title')} <span>${ui.legendMin ? '▸' : '▾'}</span></button><div class="legend-b">${h}</div>`;
  }
  $('#legend').addEventListener('click', (e) => { if (e.target.closest('#legend-toggle')) { ui.legendMin = !ui.legendMin; saveUI(); renderLegend(); } });

  // mask outside study areas when the scope is "study areas"
  function updateMask() { const rings = store.get().areas.map(a => GA.compare.ringOf(a.spec)).filter(Boolean); const r = sel.ring(); if (r) rings.push(r); L.setMaskRings(rings); drawSavedAreas(); }
  function drawSavedAreas() {
    if (!map.getSource('saved-areas')) { if (!map.isStyleLoaded()) return; map.addSource('saved-areas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'saved-areas-line', type: 'line', source: 'saved-areas', paint: { 'line-color': GA.palette.ink3, 'line-width': 1.2, 'line-dasharray': [3, 2] } }, map.getLayer('sel-fill') ? 'sel-fill' : undefined);
      map.addLayer({ id: 'saved-areas-lbl', type: 'symbol', source: 'saved-areas', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'symbol-placement': 'line', 'text-offset': [0, -0.8] }, paint: { 'text-color': GA.palette.ink2, 'text-halo-color': '#FFF', 'text-halo-width': 1.4 } }); }
    const feats = store.get().areas.filter(a => a.id !== currentAreaId).map(a => { const r = GA.compare.ringOf(a.spec); return r ? { type: 'Feature', properties: { name: a.name }, geometry: { type: 'LineString', coordinates: r } } : null; }).filter(Boolean);
    map.getSource('saved-areas').setData({ type: 'FeatureCollection', features: feats });
  }

  // ---------- map clicks: section drawing, feature popups ----------
  let popup = null;
  function mapClick(e) {
    if (secTool.isDrawing()) return secTool.click(e);
    const info = sel.info(); if (info.measure.on || (info.type === 'polygon' && !info.closed && info.phase === 'shape')) return false;
    // clicking a drawn section line opens the large section viewer
    { const ls = ['sec-lines-on', 'sec-lines-bg', 'sec-hit'].filter(l => map.getLayer(l)); const f = ls.length ? map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ls }).find(x => x.properties.id) : null;
      if (f) { const H = secHost(); if (H.list.some(x => x.id === f.properties.id)) { activeSection = f.properties.id; GA.sectionView.open(H.area ? H.area.id : null, f.properties.id); return true; } } }
    const hit = L.popupAt(e.point); if (!hit) { rasterInfo(e); return false; }
    if (popup) popup.remove();
    const ll = [e.lngLat.lng, e.lngLat.lat]; const box = document.createElement('div'); box.innerHTML = hit.html + (info.phase === 'idle' || info.phase === 'pending' ? `<div class="actions" style="margin-top:6px"><button class="btn btn-small btn-primary" data-setc>${t('sel.setCenter')}</button></div>` : '');
    const b = box.querySelector('[data-setc]'); if (b) b.addEventListener('click', () => { popup.remove(); sel.setCenterDirect(ll); });
    popup = new maplibregl.Popup({ className: 'atlas-popup', offset: 8, maxWidth: '320px' }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    if (hit.feature) L.highlight([{ type: 'Feature', properties: {}, geometry: hit.feature.geometry }]);
    popup.on('close', () => L.highlight([]));
    return true;
  }

  async function rasterInfo(e) { // WMS layers (flood, history): describe the clicked point
    const ll = [e.lngLat.lng, e.lngLat.lat]; const r = await L.rasterInfoAt(ll); if (!r) return;
    if (popup) popup.remove(); popup = new maplibregl.Popup({ className: 'atlas-popup', offset: 8, maxWidth: '320px' }).setLngLat(e.lngLat).setHTML(r.html).addTo(map);
  }
  // ---------- global clicks ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-open]'); if (!b) return;
    if (b.closest('#workspace') || b.closest('#panel-layers')) return;
    if (b.dataset.tool) return sel.chooseTool(b.dataset.tool);
    if (b.dataset.open) return openArea(b.dataset.open);
    switch (b.id) {
      case 'btn-close': return sel.closePolygon();
      case 'btn-undo': return sel.undo();
      case 'btn-reset': currentAreaId = null; closeReport(); return sel.reset();
      case 'btn-fit': return sel.fitTo();
      case 'btn-arm': return sel.armCenter();
      case 'btn-cancel-arm': return sel.setRadius(sel.spec().radius);
      case 'btn-save': return saveArea(false);
      case 'btn-saveas': return saveArea(true);
      case 'btn-analyze': return analyze();
      case 'btn-gis': return openDrawer('export');
      case 'btn-mclear': return sel.measureClear();
      case 'btn-view-analysis': return currentAreaId && PG.go('fabric', currentAreaId);
      case 'btn-to-compare': return currentAreaId && GA.fabric.compare(currentAreaId);
      case 'mb-finish': return secTool.finish();
      case 'pb-undo': return sel.undo();
      case 'pb-finish': return sel.closePolygon();
      case 'pb-cancel': return sel.chooseTool('square');
      case 'mb-undo': return secTool.undoPoint();
      case 'mb-cancel': return secTool.cancel();
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'in-radius') sel.setRadius(parseFloat(e.target.value));
    if (e.target.id === 'in-side') sel.setSide(parseFloat(e.target.value));
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) { if (e.key === 'Enter' && (e.target.id === 'in-radius' || e.target.id === 'in-side')) e.target.blur(); return; }
    if (secTool.isDrawing()) { if (e.key === 'Enter') { e.preventDefault(); secTool.finish(); } if (e.key === 'Escape') secTool.cancel(); if (e.key === 'Backspace') secTool.undoPoint(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); sel.undo(); }
    if (e.key === 'Enter') sel.closePolygon();
    if (e.key === 'Escape') { if (sel.info().measure.on) sel.measureToggle(false); closeDrawer(); closeModal(); }
  });

  // ---------- saving ----------
  function currentAreaObject(forceNew) {
    const info = sel.info(); if (!info.ring) return null;
    const name = ($('#in-name') && $('#in-name').value.trim()) || (t('sel.name') + ' ' + (store.get().areas.length + 1));
    const existing = !forceNew && currentAreaId && store.get().areas.find(a => a.id === currentAreaId);
    const a = existing ? Object.assign({}, existing) : { id: store.uid('area') };
    const geomChanged = existing && JSON.stringify(existing.spec) !== JSON.stringify(sel.spec());
    a.name = name; a.spec = sel.spec(); a.measures = { area: info.area, perimeter: info.perimeter };
    if (geomChanged && a.analysis) a.analysis.stale = true;
    if (forceNew) { delete a.analysis; a.sections = (a.sections || []).map(s => Object.assign({}, s, { id: store.uid('sec') })); }
    return a;
  }
  function saveArea(asNew) {
    const a = currentAreaObject(asNew); if (!a) return;
    if (!store.upsertArea(a)) return toast(t('toast.saveFail'), true);
    currentAreaId = a.id; toast(t('toast.saved', { name: a.name })); renderSelectPanel(sel.info()); renderDrawerIfOpen(); updateMask(); renderLeft();
  }
  const areaObj = () => currentAreaId && store.get().areas.find(a => a.id === currentAreaId);
  function openArea(id) {
    const a = store.get().areas.find(x => x.id === id); if (!a) return;
    currentAreaId = id; sel.loadSpec(a.spec); sel.fitTo(); closeDrawer(); activeSection = (a.sections && a.sections[0] && a.sections[0].id) || null;
    if (a.analysis && a.analysis.result) { run = restoreRun(a); loadGallery(a); } else { run = null; }
    if (run) openLeft(); // show its analysis
    secTool.setSections(a.sections || [], null); renderLeft(); updateMask(); renderLegend();
  }
  function restoreRun(a) {
    const r = { areaId: a.id, runAt: a.analysis.runAt, result: a.analysis.result, tasks: {}, changes: a.analysis.changes || [], stale: a.analysis.stale, ring: sel.ring(), center: a.spec.center, restored: true };
    ['osm', 'photos', 'wiki', 'research', 'climate'].forEach(k => r.tasks[k] = { state: (a.analysis.failed || []).includes(k) ? 'error' : 'ok', error: '' });
    return r;
  }

  // ---------- analysis ----------
  GA.compare.onUpdate((X) => { if (run && run.X === X) { run.sources = X.results; if (!document.activeElement || !document.activeElement.closest || !document.activeElement.closest('#left-body textarea, #left-body input')) renderLeft(); renderDrawerIfOpen(); } });
  async function loadGallery(a) {
    const myRun = run; const ring = GA.compare.ringOf(a.spec);
    run.tasks.data = { state: 'running' }; run.sources = {}; renderLeft();
    try {
      const X = await GA.compare.prepare(a); if (run !== myRun) return;
      run.X = X; run.parsed = X.parsed; run.ring = ring; run.sources = X.results;
      run.result.osm = X.R.osm; run.result.osmBase = X.parsed.osmBase; run.result.facilityDate = X.parsed.facilityDate;
      run.tasks.osm = { state: 'ok' }; run.tasks.data = { state: 'ok' };
    } catch (e) { if (run !== myRun) return; run.tasks.data = { state: 'error', error: e.message }; run.tasks.osm = { state: 'error', error: e.message }; }
    renderLeft(); renderDrawerIfOpen();
  }
  async function analyze() {
    const info = sel.info(); if (!info.ring || info.selfIntersects) return;
    const a = currentAreaObject(false); store.upsertArea(a); currentAreaId = a.id;
    const prevSnap = a.analysis && a.analysis.snapshot;
    run = { areaId: a.id, runAt: new Date().toISOString(), result: {}, tasks: {}, ring: info.ring, center: info.center, prevSnap };
    if (leftTab !== 'sections') leftTab = 'maps';
    openLeft();
    renderLeft(); sel.fitTo(); updateMask();
    const center = info.center; const radius = Math.max(...G.openRing(info.ring).map(p => G.haversine(center, p)));
    const myRun = run;
    const jobs = {
      climate: async () => { const { json } = await S.climate(center); run.result.climate = A.climateMetrics(json); },
      photos: async () => { run.result.photos = await S.commons(center, radius + 30, info.ring); },
      wiki: async () => { run.result.wiki = await S.wikipedia(center, radius); },
    };
    const exec = (k) => { run.tasks[k] = { state: 'running' }; return jobs[k]().then(() => { if (run === myRun) run.tasks[k] = { state: 'ok' }; }, (e) => { if (run === myRun) run.tasks[k] = { state: 'error', error: e.message || String(e) }; }).then(() => run === myRun && leftTab === 'notes' && renderLeft()); };
    run.retry = (k) => k === 'research' ? execResearch() : k === 'osm' || k === 'data' ? loadGallery(a) : exec(k);
    const execResearch = () => {
      run.tasks.research = { state: 'running' };
      const adm = run.result.osm && run.result.osm.admin; const local = adm && adm.length ? adm[adm.length - 1].name : '';
      run.result.researchQuery = ['Granada', local, 'urban'].filter(Boolean).join(' ');
      return S.openalex(['Granada', local, 'urban']).then(r => { run.result.research = r; run.tasks.research = { state: 'ok' }; }, e => { run.tasks.research = { state: 'error', error: e.message }; });
    };
    const g = loadGallery(a);
    const others = ['climate', 'photos', 'wiki'].map(exec);
    await g; await execResearch(); await Promise.all(others);
    if (run === myRun) finalizeRun();
  }
  function finalizeRun() {
    const a = store.get().areas.find(x => x.id === run.areaId); if (!a) return;
    const stored = Object.assign({}, run.result); if (stored.osm) { stored.osm = Object.assign({}, stored.osm); delete stored.osm.geo; }
    const snap = A.snapshot(run.result); run.changes = run.prevSnap ? A.diff(run.prevSnap, snap) : [];
    const failed = Object.keys(run.tasks).filter(k => run.tasks[k].state === 'error');
    a.analysis = { v: 2, runAt: run.runAt, result: stored, snapshot: snap, changes: run.changes, failed, history: ((a.analysis && a.analysis.history) || []).concat([{ runAt: run.runAt, snapshot: snap }]).slice(-6) };
    if (!store.upsertArea(a)) toast(t('toast.partialSave'), true);
    run.stale = false; renderLeft(); renderDrawerIfOpen();
  }
  function closeReport() { run = null; activeSection = null; secTool.setSections([], null); L.highlight([]); renderLeft(); renderLegend(); }

  // ---------- left column ----------
  const TABS = ['maps', 'sections', 'notes'];
  function renderLeft() {
    const a = areaObj(); const body = $('#left-body');
    $('#left-tabs').innerHTML = TABS.map(k => `<button role="tab" class="${leftTab === k ? 'on' : ''}" data-ltab="${k}" aria-selected="${leftTab === k}">${t('ui.tab.' + k)}</button>`).join('');
    $('#btn-refresh').hidden = !run; $('#btn-close-report').hidden = !run; $('#btn-fabric').hidden = !a;
    if (!a) { $('#rep-title').textContent = t('ui.noArea'); $('#rep-meta').innerHTML = ''; }
    else {
      const busy = run && Object.values(run.tasks).some(x => x.state === 'running');
      $('#rep-title').innerHTML = `<bdi>${esc(a.name)}</bdi>`;
      $('#rep-meta').innerHTML = `${shapeLabel(a.spec.type)} · ${fmtArea(a.measures.area)}${run ? ' · ' + (busy ? t('rep.running') : t('rep.lastUpdate', { v: '<span dir="ltr" class="nowrap">' + esc(run.runAt.replace('T', ' ').slice(0, 16)) + '</span>' })) : ''}`;
      $('#btn-refresh').disabled = !!busy;
    }
    if (document.body.classList.contains('left-collapsed')) { leftStale = true; return; } leftStale = false;
    if (leftTab === 'maps') return renderMaps(body, a);
    if (leftTab === 'sections') return renderSections(body, a);
    return renderNotes(body, a);
  }
  $('#left-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ltab]'); if (!b) return; leftTab = b.dataset.ltab; renderLeft(); });
  $('#btn-refresh').addEventListener('click', () => { const a = areaObj(); if (a) { GA.compare.cache.clear(); if (!sel.info().ring) sel.loadSpec(a.spec); analyze(); } });
  $('#btn-close-report').addEventListener('click', () => { currentAreaId = null; closeReport(); sel.reset(); });
  $('#btn-fabric').addEventListener('click', () => { if (currentAreaId) PG.go('fabric', currentAreaId); });

  function emptyState() {
    return `<div class="empty-state"><p class="lead">${t('ui.emptyLead')}</p><ol><li>${t('ui.step1')}</li><li>${t('ui.step2')}</li><li>${t('ui.step3')}</li><li>${t('ui.step4')}</li></ol><p class="fine">${t('ui.emptyNote')}</p></div>`;
  }
  function statusChips() {
    if (!run) return '';
    const chip = (label, st, n) => `<span class="chip ${st}">${label}: ${t('ui.st.' + st, { n: n != null ? nf(n) : '' })}</span>`;
    const srcs = run.sources || {}; let h = '<div class="status-row">';
    if (run.tasks.data && run.tasks.data.state === 'running') h += `<span class="chip loading"><span class="spin"></span> ${t('ui.loadingData')}</span>`;
    if (run.tasks.data && run.tasks.data.state === 'error') h += `<span class="chip failed">${t('ui.st.failed')}: ${esc(run.tasks.data.error)}</span> <button class="btn btn-tiny" data-retry="data">${t('retry')}</button>`;
    const EXT = (GA.galleryExt && GA.galleryExt.SRC_NAME) || {};
    Object.entries(srcs).forEach(([k, r]) => { const st = r.state === 'ok' ? 'ok' : r.state === 'empty' ? 'empty' : r.state === 'loading' ? 'loading' : 'failed'; h += chip(t('ui.src.' + k), st) + (st === 'failed' && EXT[k] ? ` <button class="btn btn-tiny" data-retry-ext="${k}" title="${esc(r.error || '')}">${t('retry')}</button>` : ''); });
    [['photos', 'ph'], ['wiki', 'wiki'], ['research', 'research'], ['climate', 'climate']].forEach(([k]) => { const s = run.tasks[k]; if (!s) return; h += `<span title="${esc(s.error || '')}">` + chip(t('ui.src.' + k), s.state === 'running' ? 'loading' : s.state === 'error' ? 'failed' : 'ok') + '</span>' + (s.state === 'error' ? ` <button class="btn btn-tiny" data-retry="${k}">${t('retry')}</button>` : ''); });
    h += chip(t('ui.src.population'), 'notconn');
    return h + '</div>';
  }
  let cardsCache = null;
  function renderMaps(body, a) {
    if (!a || !run) { body.innerHTML = emptyState(); return; }
    const busyNow = Object.values(run.tasks).some(x => x.state === 'running');
    let h = `<div class="next-step"><button class="btn btn-primary" id="btn-view-analysis" ${run.X ? '' : 'disabled'}>${t('v5.viewAnalysis')} →</button><button class="btn btn-small" id="btn-to-compare">${t('v5.compare')}</button>${busyNow ? `<span class="fine"><span class="spin"></span> ${t('rep.running')}</span>` : ''}</div>`;
    const anyFail = Object.values(run.sources || {}).some(r => r.state === 'failed') || Object.values(run.tasks).some(x => x.state === 'error');
    h += `<details class="status-d" ${anyFail ? 'open' : ''}><summary>${t('v5.sourcesStatus')}${anyFail ? ` <span class="chip failed">${t('v5.someUnavailable')}</span>` : ''}</summary>${statusChips()}</details>`;
    if (run.stale) h += `<div class="warn">${t('rep.stale')}</div>`;
    if (run.changes && run.changes.length) h += `<div class="changed"><b>${t('rep.changed', { n: run.changes.length })}</b> ${run.changes.slice(0, 6).map(c => `<span dir="ltr">${esc(c.key)}: ${c.from ?? '—'} → ${c.to ?? '—'}</span>`).join(', ')}</div>`;
    if (!run.X) { body.innerHTML = h + (run.tasks.data && run.tasks.data.state === 'running' ? `<div class="loading"><span class="spin"></span>${t('ui.loadingData')}</div>` : ''); return; }
    const X = run.X; const cards = GAL.cards({ ring: X.ring }, X.parsed, X.R, { dem: X.dem, slope: X.slope, contours: X.contours, ext: X.ext }); cardsCache = cards;
    h += `<div class="key"><span class="badge badge-est">${t('st.est')}</span> ${t('ui.estKey')} · ${t('ui.cardHint')}</div>`;
    h += `<div class="gallery">${cards.map(c => GAL.cardHTML(c)).join('')}</div>`;
    body.innerHTML = h;
    const w = Math.max(240, body.clientWidth - 34), hh = Math.round(w * 0.72);
    const f = MC.fit([X.ring], w, hh, 0.07);
    // draw the cards one at a time, yielding between them, so the page stays responsive; a newer render cancels this one
    const tok = ++drawTok; const cvs = [...body.querySelectorAll('canvas[data-canvas]')];
    const next = (i) => { if (tok !== drawTok || i >= cvs.length) return; const cv = cvs[i]; const c = cards.find(k => k.id === cv.dataset.canvas); try { GAL.drawCard(cv, { ring: X.ring }, c, { center: f.center, mpp: f.mpp, w, h: hh }); } catch (e) { console.warn(c && c.id, e); } setTimeout(() => next(i + 1), 0); };
    next(0);
  }
  let drawTok = 0;
  const CARD_LAYER = { fg: ['bld_fg'], heights: ['bld_floors'], periods: ['bld_period'], streets: ['streets'], landuse: ['landuse'], parks: ['parks'], health: ['fac_health'], education: ['fac_education'], stay: ['fac_stay'], transit: ['bus_stops'], elevation: ['elevation', 'contours'], slope: ['slope'], places: ['places'], bus: ['bus_service'], trees: ['canopy', 'trees'], flood: ['flood'], noise: ['noise'] };
  function cardFeatures(c, key) {
    const X = run && run.X; if (!X) return [];
    const o = X.R.osm;
    if (['health', 'education', 'stay'].includes(c.id)) return X.R.fac[c.id].pts.filter(p => key == null || p.tags._cls === key).map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p.pt } }));
    if (c.id === 'transit') return X.R.transit.pts.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p.pt } }));
    if (c.id === 'places' && X.R.places) return X.R.places.pts.filter(f => key == null || (f.properties.g || '_none') === key).map(f => ({ type: 'Feature', properties: {}, geometry: f.geometry }));
    if (c.id === 'bus' && X.R.bus) return X.R.bus.pts.filter(f => key == null || f.properties.service_level === key).map(f => ({ type: 'Feature', properties: {}, geometry: f.geometry }));
    if (c.id === 'trees' && X.R.trees) return X.R.trees.pts.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p.ll } }));
    if (c.id === 'flood' && X.R.flood) return Object.entries(X.R.flood.features).filter(([k]) => key == null || k === key).flatMap(([, fs]) => fs.map(f => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: f.coordinates } })));
    const src = { heights: o.geo.buildings, periods: o.geo.buildings, fg: o.geo.buildings, streets: o.geo.streets, landuse: o.geo.landuse, parks: o.geo.landuse }[c.id]; if (!src) return [];
    const field = { heights: 'band', periods: 'period', streets: 'tier', landuse: 'cat', parks: 'cat' }[c.id];
    return src.features.filter(f => key == null || !field || String(f.properties[field]) === String(key) || (c.id === 'parks' && f.properties.cat === 'green')).map(f => ({ type: 'Feature', properties: {}, geometry: f.geometry }));
  }
  $('#left-body').addEventListener('click', async (e) => {
    const b = e.target.closest('button, [data-hl]'); if (!b) return;
    const cardEl = b.closest('[data-card]'); const card = cardEl && cardsCache && cardsCache.find(c => c.id === cardEl.dataset.card);
    if (b.dataset.retry && run && run.retry) { await run.retry(b.dataset.retry); return renderLeft(); }
    if (b.dataset.retryExt && run && run.X && run.X.retryExt) { b.disabled = true; await run.X.retryExt(b.dataset.retryExt); return renderLeft(); }
    if (card && b.dataset.hl != null) { b.closest('.card').querySelectorAll('.hl').forEach(x => x.classList.remove('hl')); b.classList.add('hl'); L.highlight(cardFeatures(card, b.dataset.hl)); return; }
    if (card && b.dataset.act === 'show') { (CARD_LAYER[card.id] || []).forEach(id => L.setOn(id, true)); L.highlight(cardFeatures(card, null).slice(0, 4000)); sel.fitTo(); toast(t('ui.shownOnMap', { v: card.title })); return; }
    if (card && b.dataset.act === 'enlarge') return enlarge(card);
    if (card && b.dataset.act === 'chart') return enlargeChart(card);
    if (card && b.dataset.act === 'png') return exportCardPNG(card);
    // sections tab
    if (b.id === 'sec-draw') { secTool.start(); return; }
    if (b.dataset.secOpen) { activeSection = b.dataset.secOpen; secTool.setSections(secHost().list, activeSection); renderLeft(); fitSection(); return; }
    if (b.dataset.secSolo) { currentAreaId = null; run = null; sel.reset(); activeSection = b.dataset.secSolo; leftTab = 'sections'; secTool.setSections(secHost().list, activeSection); updateMask(); renderLeft(); renderLegend(); fitSection(); return; }
    if (b.id === 'sec-attach') return attachSection();
    if (b.dataset.secDel) { const H = secHost(); if (b.dataset.armed) { const i = H.list.findIndex(s => s.id === b.dataset.secDel); if (i >= 0) H.list.splice(i, 1); if (activeSection === b.dataset.secDel) activeSection = H.list[0] ? H.list[0].id : null; H.save(); secProfiles.delete(b.dataset.secDel); secTool.setSections(H.list, activeSection); return renderLeft(); } b.dataset.armed = '1'; b.textContent = t('ar.confirmDel'); return; }
    if (b.id === 'sec-enlarge' || b.id === 'sec-prev') { const H = secHost(); if (activeSection) GA.sectionView.open(H.area ? H.area.id : null, activeSection); return; }
    if (b.id === 'sec-png') return exportSectionPNG();
    if (b.id === 'sec-svg') return exportSectionVector('svg');
    if (b.id === 'sec-pdf') return exportSectionVector('pdf');
    if (b.id === 'sec-geojson') { const s = curSection(); if (!s) return; const H = secHost(); const p = await profileOf(s).catch(() => null);
      const fcx = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: s.name, fabric: H.area ? H.area.name : null, vertices: s.pts.length, length_m: p ? Math.round(p.L) : null, look: s.look || 'left', tree_corridor_m: s.corridor || 15, floor_height_m: s.floorH || 3, created: s.created || null, crs_note: 'WGS84 lon/lat (EPSG:4326)' }, geometry: { type: 'LineString', coordinates: s.pts } }] };
      return download(new Blob([JSON.stringify(fcx, null, 1)], { type: 'application/geo+json' }), `granada_section_${(s.name || 'section').replace(/[^\p{L}\p{N}]+/gu, '_')}.geojson`); }
    if (b.id === 'sec-lib') { const H = secHost(); const a = H.area || { name: t('v6.standalone') }; const s = curSection(); if (!s || !GA.library) return; const p = await profileOf(s); const cv = document.createElement('canvas'); SEC.draw(cv, p, { w: 1600, h: 860, ratio: 1, ...SEC.optsFor(s) }); cv.toBlob(async bl => { await GA.library.addBlob(bl, { title: s.name + ' — ' + a.name, kind: 'image', source: t('lib.srcSection'), date: new Date().toISOString().slice(0, 10), loc: s.pts[0], links: { fabrics: [a.id] }, tags: ['section'] }); toast(t('lib.added')); }, 'image/png'); return; }
    if (b.id === 'obs-add' && run) { const txt = $('#obs-text').value.trim(); if (!txt) return; $('#obs-text').value = ''; store.addObservation({ areaId: run.areaId, text: txt, kind: $('#obs-kind').value, topic: $('#obs-topic').value }); return renderLeft(); }
    if (b.dataset.delobs) { store.removeObservation(b.dataset.delobs); return renderLeft(); }
    if (b.dataset.wall && run) { const p = (run.result.photos || []).find(x => x.id === b.dataset.wall); if (p) { const ok = store.addMaterial({ id: p.id, kind: 'photo', title: p.title, thumb: p.thumb, page: p.page, author: p.author, license: p.license, date: p.date, pt: p.pt, camera: p.camera, depicted: p.depicted, source: 'Wikimedia Commons', areaId: run.areaId }); toast(ok ? t('toast.wall') : t('toast.wallDup')); } }
  });
  $('#left-body').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.hl != null) { e.preventDefault(); e.target.click(); } });

  // enlarge + print-scale PNG
  const modal = $('#modal');
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-modal-close]')) closeModal(); if (e.target.closest('[data-modal-png]')) { const c = cardsCache.find(k => k.id === e.target.closest('[data-modal-png]').dataset.modalPng); exportCardPNG(c); } });
  function enlarge(card) { const X = run.X; GA.viewer.map({ card, X, ring: X.ring, title: card.title, subtitle: (areaObj() || {}).name, slug: card.id + '_' + slugify((areaObj() || {}).name || 'area') }); }
  const slugify = (s) => String(s).normalize('NFKD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'area';
  function enlargeChart(card) { GA.viewer.html({ title: card.title, subtitle: (areaObj() || {}).name, html: `<div class="ch-big">${GAL.chartSVG(card.chart)}</div><ul class="find">${(card.find || []).map(f => `<li>${f}</li>`).join('')}</ul>` }); }
  const NICE = [500, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 12500, 15000, 20000, 25000, 50000];
  function exportCardPNG(card) {
    const X = run.X; const DPI = 200; const W = 1600, Hm = 1200; // 203 × 152 mm map at 200 dpi
    const need = MC.fit([X.ring], W, Hm, 0.06).mpp / (0.0254 / DPI); const den = NICE.find(v => v >= need) || Math.ceil(need / 1000) * 1000; const mpp = den * 0.0254 / DPI;
    const font = getComputedStyle(rootEl).getPropertyValue('--f-ui'); const rtl = I.dir() === 'rtl';
    const map0 = document.createElement('canvas'); GAL.drawCard(map0, { ring: X.ring }, card, { center: MC.fit([X.ring], W, Hm, 0.06).center, mpp, w: W, h: Hm, ratio: 1 });
    const out = document.createElement('canvas'); out.width = W; out.height = Hm + 330; const ctx = out.getContext('2d'); ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, out.width, out.height); ctx.fillStyle = PAL.red; ctx.fillRect(0, 0, W, 6);
    ctx.textAlign = rtl ? 'right' : 'left'; const x0 = rtl ? W - 30 : 30; ctx.fillStyle = GA.palette.ink; ctx.font = `700 34px ${font}`; ctx.fillText(card.title + ' — ' + (areaObj() || {}).name, x0, 54);
    ctx.font = `20px ${font}`; ctx.fillStyle = GA.palette.ink2; ctx.fillText(t('ui.pngScale', { s: '1:' + den.toLocaleString('en-US'), d: DPI, w: Math.round(W / DPI * 25.4), h: Math.round(Hm / DPI * 25.4) }), x0, 86);
    ctx.drawImage(map0, 0, 100);
    let y = GA.compare.legendCanvas(ctx, card.legend || [], 30, Hm + 130, W - 60, rtl, font);
    ctx.font = `17px ${font}`; ctx.fillStyle = GA.palette.ink; ctx.textAlign = rtl ? 'right' : 'left';
    (card.find || []).forEach(f => { y = GA.compare.wrap(ctx, String(f).replace(/<[^>]+>/g, '').replace(/[⁦⁩]/g, ''), x0, y + 6, W - 60, 24, 2); });
    ctx.font = `15px ${font}`; ctx.fillStyle = GA.palette.ink3; ctx.fillText(`${card.src.name} · ${card.src.detail} · ${card.src.license} · EPSG:25830 · ${new Date().toISOString().slice(0, 10)}`, x0, out.height - 18);
    out.toBlob(bl => download(bl, `granada_${card.id}_1-${den}.png`), 'image/png');
  }
  function download(blob, name) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }

  document.addEventListener('click', (e) => { if (e.target.closest('#sp-draw-section')) startSection(); });
  // ---------- sections ----------
  // A section lives in the open fabric (area.sections) or, with no fabric open, in the project's standalone list:
  // a study area is never a prerequisite for drawing one.
  function secHost() {
    const a = areaObj(); if (a) { a.sections = a.sections || []; return { list: a.sections, save: () => store.upsertArea(a), area: a }; }
    const p = store.get(); p.sections = p.sections || []; return { list: p.sections, save: () => store.save(), area: null };
  }
  const curSection = () => secHost().list.find(x => x.id === activeSection) || null;
  const isPhone = () => window.matchMedia('(max-width: 720px)').matches;
  // phones draw on a full-screen map and show the section afterwards; larger screens keep the analysis panel open beside the map
  // tablets (narrow side-by-side layouts) also give the whole width to the map while drawing
  const roomy = () => window.innerWidth >= 1100;
  function startSection() { closeDrawer(); leftTab = 'sections'; const B = document.body.classList;
    if (isPhone() || !roomy()) setPhoneView('map'); else openLeft(); void B;
    renderLeft(); secTool.start(); }
  function sectionMode(mode, n) {
    const mb = $('#mode-banner');
    if (mode === 'drawing') { mb.hidden = false; mb.dataset.mode = 'sec'; mb.innerHTML = `${t(n >= 2 ? 'sec.bannerMore' : n === 1 ? 'sec.bannerB' : 'sec.bannerA', { n: n || 0 })} <button class="btn btn-tiny" id="mb-undo" ${n ? '' : 'disabled'}>${t('undo')}</button><button class="btn btn-tiny" id="mb-finish" ${n >= 2 ? '' : 'disabled'}>${t('sec.finish')}</button><button class="btn btn-tiny" id="mb-cancel">${t('cancel')}</button>`; }
    else mb.hidden = true;
  }
  function createSection(pts) {
    const H = secHost();
    const s = { id: store.uid('sec'), name: t('sec.defaultName', { n: H.list.length + 1 }), pts, floorH: 3.0, ve: 'auto', created: new Date().toISOString() };
    H.list.push(s); H.save(); activeSection = s.id; leftTab = 'sections'; secTool.setSections(H.list, s.id); openLeft(); renderLeft();
  }
  function editSection(s) { // s is the stored object being edited: update exactly that section
    const H = secHost(); const i = H.list.findIndex(x => x.id === s.id); if (i < 0) return;
    H.list[i] = Object.assign({}, H.list[i], { pts: s.pts.map(p => p.slice()), edited: new Date().toISOString() }); H.save(); secProfiles.delete(s.id);
    secTool.setSections(H.list, s.id); if (leftTab === 'sections') renderLeft();
  }
  function fitSection() { const s = curSection(); if (s) sel.fitTo([s.pts]); }
  // optional: move a standalone section into a saved fabric (it then appears in that fabric's analysis and exports)
  function attachSection() {
    const P0 = store.get(); const s = curSection(); if (!s || !P0.areas.length) return; const m = $('#modal');
    m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="att-h"><div class="modal-h"><h3 id="att-h">${t('v6.attach')}</h3><button class="btn btn-small" data-modal-close aria-label="${esc(t('close'))}">✕</button></div><div class="modal-b" style="flex-direction:column;gap:6px"><p class="fine">${t('v6.attachNote', { n: `<bdi>${esc(s.name)}</bdi>` })}</p>${P0.areas.map(x => `<button class="btn btn-small" data-att="${x.id}"><bdi>${esc(x.name)}</bdi></button>`).join('')}</div></div>`;
    m.hidden = false;
    m.onclick = (e) => { const b = e.target.closest('[data-att]'); if (e.target.closest('[data-modal-close]') || e.target === m) { m.hidden = true; m.onclick = null; return; } if (!b) return;
      const a = P0.areas.find(x => x.id === b.dataset.att); P0.sections = P0.sections.filter(x => x.id !== s.id); a.sections = (a.sections || []).concat([s]); store.upsertArea(a); m.hidden = true; m.onclick = null;
      toast(t('v6.attached', { n: s.name, a: a.name })); openArea(a.id); activeSection = s.id; leftTab = 'sections'; secTool.setSections(a.sections, s.id); renderLeft(); };
  }
  async function profileOf(s) {
    const key = s.id + JSON.stringify(s.pts) + s.floorH + (s.look || 'left') + (s.depth || 40) + (s.corridor || 15); const c = secProfiles.get(s.id); if (c && c.key === key) return c.p;
    const p = SEC.compute(s, { floorH: s.floorH || 3 }); secProfiles.set(s.id, { key, p }); p.catch(() => secProfiles.delete(s.id)); return p;
  }
  function renderSections(body, a) {
    const H = secHost(); const list = H.list;
    if (!list.find(s => s.id === activeSection)) activeSection = list[0] ? list[0].id : null;
    secTool.setSections(list, activeSection);
    let h = `<p class="fine">${t('sec.lead')}</p><p class="fine sec-host">${a ? t('v6.secInFabric', { n: `<bdi>${esc(a.name)}</bdi>` }) : t('v6.secStandaloneNote')}</p><div class="actions"><button class="btn btn-primary" id="sec-draw">${t('sec.draw')}</button></div>`;
    if (list.length) h += `<ul class="sec-list">${list.map((s, i) => `<li class="${s.id === activeSection ? 'on' : ''}"><button class="link" data-sec-open="${s.id}"><bdi>${esc(s.name)}</bdi> <small>${s.pts.length} ${t('sec.vertices')}</small></button><button class="btn btn-tiny danger" data-sec-del="${s.id}">${t('delete')}</button></li>`).join('')}</ul>`;
    const s = list.find(x => x.id === activeSection);
    if (s) {
      h += `<div class="actions"><button class="btn btn-primary" id="sec-enlarge">⤢ ${t('v5.enlargeSection')}</button>${!H.area ? `<button class="btn btn-small" id="sec-attach" ${store.get().areas.length ? '' : `disabled title="${esc(t('v6.noFabrics'))}"`}>${t('v6.attach')}</button>` : ''}</div><div id="sec-out"><div class="loading"><span class="spin"></span>${t('sec.computing')}</div></div>
        <details class="sec-settings"><summary>${t('v5.secSettings')}</summary><div class="sec-opts"><label class="name"><span>${t('sec.name')}</span><input type="text" dir="auto" id="sec-name" value="${esc(s.name)}" maxlength="60"></label>
        <label class="row2">${t('sec.floorH')} <input type="number" id="sec-floor" min="2.4" max="6" step="0.1" value="${s.floorH || 3}" style="width:5em"> ${t('u.m')}</label>
        <label class="row2">${t('v7.scale')} <select id="sec-ve">${[1, 2, 3, 5, 'auto'].map(v => `<option value="${v}" ${String(SEC.optsFor(s).ve) === String(v) ? 'selected' : ''}>${v === 'auto' ? t('sec.veAuto') : v === 1 ? t('v7.trueScale') : '×' + v}</option>`).join('')}</select></label>
        <label class="row2" title="${esc(t('v7.depthHint'))}">${t('v7.depth')} <input type="number" id="sec-depth" min="10" max="150" step="5" value="${s.depth || 40}" style="width:4.5em"> m</label>
        <label class="row2">${t('sec.look')} <select id="sec-look"><option value="left" ${s.look !== 'right' ? 'selected' : ''}>${t('sec.look_left')}</option><option value="right" ${s.look === 'right' ? 'selected' : ''}>${t('sec.look_right')}</option></select></label>
        <label class="row2" title="${esc(t('v4.corridorHint'))}">${t('v4.corridor')} <input type="number" id="sec-corr" min="2" max="60" step="1" value="${s.corridor || 15}" style="width:4.5em"> m</label>
        <label class="chk"><input type="checkbox" id="sec-floors" ${s.floors !== false ? 'checked' : ''}> ${t('v7.slabs')}</label>
        <label class="chk"><input type="checkbox" id="sec-ill" ${s.ill ? 'checked' : ''}> ${t('v5.detailIll')}</label></div></details>`;
    } else if (!list.length) h += `<p class="note">${t(a ? 'sec.none' : 'v6.secNoneStandalone')}</p>`;
    const solo = store.get().sections || [];
    if (a && solo.length) h += `<details class="sec-solo"><summary>${t('v6.standaloneList', { n: solo.length })}</summary><ul class="sec-list">${solo.map(x => `<li><button class="link" data-sec-solo="${x.id}"><bdi>${esc(x.name)}</bdi> <small>${x.pts.length} ${t('sec.vertices')}</small></button></li>`).join('')}</ul></details>`;
    body.innerHTML = h;
    if (s) profileOf(s).then(p => { if (activeSection !== s.id || !$('#sec-out')) return; drawSectionPanel(p, s); }, e => { const o = $('#sec-out'); if (o) o.innerHTML = `<div class="error">${esc(e.message)}</div>`; });
  }
  function drawSectionPanel(p, s) {
    const out = $('#sec-out'); const w = Math.max(280, $('#left-body').clientWidth - 34);
    const est = p.cuts.filter(c => c.src === 'levels').length, rep = p.cuts.filter(c => c.src === 'height').length, unk = p.cuts.filter(c => c.src === 'unknown').length;
    const dg = Math.atan(p.maxGrad) * 180 / Math.PI;
    const cov = p.coverage || {}; const covNote = [cov.demMissing > 0 ? t('v6.covDem', { p: Math.round(cov.demMissing * 100) }) : '', cov.outsideRegion > 0 ? t('v6.covBld', { p: Math.round(cov.outsideRegion * 100) }) : ''].filter(Boolean);
    out.innerHTML = `${covNote.length ? `<div class="note warn" role="note">${covNote.join('<br>')}</div>` : ''}<button type="button" class="sec-prev" id="sec-prev" aria-label="${esc(t('v5.enlargeSection'))}"><canvas class="sec-canvas" id="sec-cv"></canvas><span class="enl" aria-hidden="true">⤢ ${t('v5.enlargeSection')}</span></button>
      <div class="actions"><button class="btn btn-small" id="sec-png">${t('sec.png')}</button><button class="btn btn-small" id="sec-svg">SVG</button><button class="btn btn-small" id="sec-pdf">PDF</button><button class="btn btn-small" id="sec-geojson">GeoJSON</button><button class="btn btn-small" id="sec-lib">${t('lib.addTo')}</button></div>
      <details class="method"><summary>${t('v5.legendNotes')}</summary><ul class="lg"><li><i class="sw" style="background:#fff;border:2px solid ${PAL.red}"></i><span>${t('sec.lgReported3')}</span></li><li><i class="sw" style="background:#fff;border:2px dashed ${PAL.red}"></i><span>${t('sec.lgEstimated3', { f: nf(s.floorH || 3, 1) })}</span></li><li><i class="sw ln" style="border-top:3px solid ${PAL.red}"></i><span>${t('sec.lgUnknown')}</span></li><li><i class="sw" style="background:${PAL.section.bgFill};border:1px solid ${PAL.section.bgLine}"></i><span>${t('sec.lgBg3')}</span></li><li><i class="sw dot" style="background:#fff;border:1.5px dashed ${PAL.section.treeOn}"></i><span>${t('v4.lgTreeNear')}</span></li><li><i class="sw dot" style="background:#fff;border:1px dashed ${PAL.section.treeBg};opacity:.7"></i><span>${t('v4.lgTreeFar', { c: nf(p.corridor || 15) })}</span></li><li><i class="sw" style="background:${PAL.section.soil};border-top:2px solid ${PAL.section.ink}"></i><span>${t('sec.lgGround')}</span></li></ul>
      <dl class="kpi"><div><dt>${t('sec.length')}</dt><dd>${fmtLen(p.L)}</dd></div><div><dt>${t('g.elevRange')}</dt><dd><span class="num">${nf(p.min)}–${nf(p.max)}</span> ${t('u.m')}</dd></div><div><dt>${t('sec.maxGrad', { b: nf(p.baseline) })}</dt><dd><span class="num">${nf(p.maxGrad * 100, 1)}${I.pctSign()}</span> <small>(${nf(dg, 1)}°)</small></dd></div></dl>
      <ul class="find"><li>${t('sec.cutsSummary', { n: p.cuts.length, r: rep, e: est, u: unk, b: p.bg.length, bu: p.bgUnknown })}</li><li>${p.tErr ? t('sec.treesFail', { e: esc(p.tErr) }) : t('v4.treesN', { n: (p.trees || []).filter(x => !x.row).length, near: (p.trees || []).filter(x => !x.row && x.near).length, h: (p.trees || []).filter(x => !x.row && x.h).length, c: nf(p.corridor || 15), r: p.rowsNear || 0 })}</li><li>${t('sec.material')}</li>${p.hornMax != null ? `<li>${t('sec.hornMax', { d: nf(p.hornMax, 1), p: nf(Math.tan(p.hornMax * Math.PI / 180) * 100) })}</li>` : ''}${p.missing ? `<li>${t('sec.partialOutside')}</li>` : ''}${p.bErr ? `<li class="error">${esc(p.bErr)}</li>` : ''}</ul>
      </details><details class="method"><summary>${t('g.method')}</summary><p>${t('sec.method', { f: nf(s.floorH || 3, 1) })}</p><p>${t('sec.slopeFix')}</p></details>`;
    const r = SEC.draw($('#sec-cv'), p, { w, h: Math.max(300, Math.round(w * 0.75)), ...SEC.optsFor(s) }); out.dataset.ve = r.ve;
  }
  $('#left-body').addEventListener('change', (e) => {
    const H = secHost(); const s = curSection(); if (!s) return; const sv = () => H.save();
    if (e.target.id === 'sec-name') { s.name = e.target.value.trim() || s.name; sv(); secTool.setSections(H.list, s.id); renderLeft(); }
    if (e.target.id === 'sec-floor') { const v = parseFloat(e.target.value); if (isFinite(v) && v >= 2.4 && v <= 6) { s.floorH = v; sv(); secProfiles.delete(s.id); renderLeft(); } }
    if (e.target.id === 'sec-ve') { s.ve = e.target.value === 'auto' ? 'auto' : +e.target.value; s.veUser = s.ve !== 1; sv(); renderLeft(); }
    if (e.target.id === 'sec-depth') { s.depth = Math.max(10, Math.min(150, +e.target.value || 40)); sv(); secProfiles.delete(s.id); renderLeft(); }
    if (e.target.id === 'sec-look') { s.look = e.target.value; sv(); secProfiles.delete(s.id); secTool.setSections(H.list, s.id); renderLeft(); }
    if (e.target.id === 'sec-corr') { const v = Math.max(2, Math.min(60, +e.target.value || 15)); s.corridor = v; sv(); secProfiles.delete(s.id); renderLeft(); }
    if (e.target.id === 'sec-ill') { s.ill = e.target.checked; sv(); renderLeft(); }
    if (e.target.id === 'sec-floors') { s.floors = e.target.checked; sv(); renderLeft(); }
  });
  async function exportSectionPNG() {
    const s = curSection(); if (!s) return; const p = await profileOf(s);
    const cv = document.createElement('canvas'); SEC.draw(cv, p, { w: 1684, h: 1190, ratio: 3, ...SEC.optsFor(s) }); // A3 proportions, 5052 px wide
    cv.toBlob(bl => download(bl, `granada_section_${(s.name || 'section').replace(/[^\p{L}\p{N}]+/gu, '_')}.png`), 'image/png');
  }
  async function exportSectionVector(kind) {
    const s = curSection(); if (!s) return; const p = await profileOf(s);
    const base = `granada_section_${(s.name || 'section').replace(/[^\p{L}\p{N}]+/gu, '_')}`;
    if (kind === 'svg') return download(new Blob([SEC.svg(p, { w: 1684, h: 1190, ...SEC.optsFor(s) })], { type: 'image/svg+xml' }), base + '.svg');
    const bytes = await SEC.pdf(p, { w: 1684, h: 1190, ...SEC.optsFor(s) }); download(new Blob([bytes], { type: 'application/pdf' }), base + '.pdf'); // vector A3 landscape
  }

  // ---------- notes & sources tab ----------
  function renderNotes(body, a) {
    if (!a || !run) { body.innerHTML = emptyState(); return; }
    const draft = $('#obs-text') ? $('#obs-text').value : '';
    const obs = store.get().observations.filter(o => o.areaId === run.areaId);
    body.innerHTML = statusChips() + RP.render({ area: a, run, observations: obs, only: ['loc', 'pop', 'ph', 'muni', 'hist', 'clim', 'reg', 'life', 'roof', 'lit', 'obs'] });
    if (draft && $('#obs-text')) $('#obs-text').value = draft;
  }

  // ---------- drawers ----------
  let drawer = null;
  function openDrawer(kind) { drawer = kind; $('#drawer').hidden = false; renderDrawer(); document.querySelectorAll('.tb-btn[data-drawer]').forEach(b => b.classList.toggle('on', b.dataset.drawer === kind)); }
  function closeDrawer() { drawer = null; $('#drawer').hidden = true; document.querySelectorAll('.tb-btn[data-drawer]').forEach(b => b.classList.remove('on')); }
  function renderDrawerIfOpen() { if (drawer) renderDrawer(); }
  const exportOpts = { gpkg: true, geojson: true, crs: 25830, dem: true, demCell: 30 }; let exportBusy = false, exportMsg = '';

  async function sectionsForExport(areas) { // computed profiles for the areas' sections, tagged with the area
    const out = [];
    for (const x of areas) for (const s of (x.area.sections || [])) { try { const p = await profileOf(s); out.push(Object.assign({}, p, { _area: x.no != null ? { area_no: x.no, area_name: x.area.name } : undefined })); } catch (e) { } }
    return out;
  }
  const atLL = (pl, d) => { let i = 1; while (i < pl.cum.length - 1 && pl.cum[i] < d) i++; const a = pl.u[i - 1], b = pl.u[i], s = (d - pl.cum[i - 1]) / Math.max(1e-9, pl.cum[i] - pl.cum[i - 1]); return PJ.EPSG25830.inverse([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]).map(v => +v.toFixed(7)); };
  function exportCtx() {
    const info = sel.info(); if (!info.ring) return null;
    const area = areaObj();
    const sameRing = run && run.ring && JSON.stringify(run.ring) === JSON.stringify(info.ring);
    const r = run && run.areaId === (area && area.id) && !run.stale && sameRing && run.parsed ? run : null;
    return { area: area || { name: ($('#in-name') && $('#in-name').value.trim()) || 'study_area' }, spec: sel.spec(), ring: info.ring, run: r, polyline: SEC.polyline, atLL };
  }
  function renderExport(d) {
    $('#drawer-title').textContent = t('x.title');
    const ctx = exportCtx(); if (!ctx) { d.innerHTML = `<p class="lead">${t('x.needArea')}</p><p class="fine">${t('x.multiHint')}</p>`; return; }
    const inv = GA.gisexport.inventory(ctx);
    const needOSM = inv.find(l => l.id === 'buildings').status === 'unavailable';
    const inReg = D.inRegion(G.centroidLL(ctx.ring));
    const stTxt = (l) => l.status === 'ready' ? `<span class="state st-ok">${t('x.ready')}</span> <span class="num">${t('x.features', { n: nf(l.count) })}</span>` : l.status === 'empty' ? `<span class="state st-exp">${t('x.empty')}</span>` : `<span class="state st-no">${t('x.unavailable')}</span> <small>${t(l.reason)}</small>`;
    const nSec = ctx.area.sections ? ctx.area.sections.length : 0;
    d.innerHTML = `<p class="lead">${t('x.lead')}</p>`
      + (needOSM ? `<div class="warn">${t('x.needAnalysisV2')} <button class="btn btn-small btn-primary" id="x-analyze">${t('sel.analyze')}</button></div>` : '')
      + `<div class="sub">${t('x.layers')}</div><table class="tbl small"><tbody>${inv.filter(l => !l.planned).map(l => `<tr class="${l.status}"><td><code>${l.id}</code></td><td>${t('L.' + l.id)}</td><td>${stTxt(l)}</td></tr>`).join('')}
        ${!needOSM ? `<tr><td><code>facilities</code></td><td>${t('L.facilities')}</td><td><span class="state st-ok">${t('x.ready')}</span></td></tr>` : ''}
        <tr><td><code>sections…</code></td><td>${t('L.sections')}</td><td>${nSec ? `<span class="state st-ok">${t('x.ready')}</span> <span class="num">${nSec}</span>` : `<span class="state st-no">${t('x.unavailable')}</span> <small>${t('x.noSections')}</small>`}</td></tr></tbody></table>
        <p class="fine">${t('x.multiHint')}</p>
        <div class="sub">${t('x.formats')}</div>
        <label class="chk"><input type="checkbox" id="x-gpkg" ${exportOpts.gpkg ? 'checked' : ''}> ${t('x.gpkg')}</label>
        <label class="chk"><input type="checkbox" id="x-geojson" ${exportOpts.geojson ? 'checked' : ''}> ${t('x.geojson')}</label>
        <fieldset class="radios"><legend>${t('x.crs')}</legend><label><input type="radio" name="x-crs" value="25830" ${exportOpts.crs === 25830 ? 'checked' : ''}> ${t('x.crs25830')}</label><label><input type="radio" name="x-crs" value="4326" ${exportOpts.crs === 4326 ? 'checked' : ''}> ${t('x.crs4326')}</label></fieldset>
        <label class="chk"><input type="checkbox" id="x-dem" ${exportOpts.dem ? 'checked' : ''}> ${inReg ? t('x.demMdt') : t('x.dem')}</label>
        <div class="actions"><button class="btn btn-primary" id="x-go" ${exportBusy || (!exportOpts.gpkg && !exportOpts.geojson && !exportOpts.dem) ? 'disabled' : ''}>${exportBusy ? t('x.building') : t('x.go')}</button></div>
        <div class="x-msg" role="status">${exportMsg}</div>`;
  }
  async function loadSQL() {
    if (window.__sqlPromise) return window.__sqlPromise;
    const add = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
    window.__sqlPromise = (async () => {
      if (!window.initSqlJs) await add('vendor/sqljs/sql-wasm.js');
      if (!window.SQL_WASM_BASE64) await add('vendor/sqljs/sql-wasm-binary.js');
      const bin = Uint8Array.from(atob(window.SQL_WASM_BASE64), c => c.charCodeAt(0));
      return window.initSqlJs({ wasmBinary: bin });
    })();
    window.__sqlPromise.catch(() => { window.__sqlPromise = null; });
    return window.__sqlPromise;
  }
  async function runExport() {
    const ctx = exportCtx(); if (!ctx || exportBusy) return;
    exportBusy = true; exportMsg = `<span class="spin"></span> ${t('x.building')}`; renderDrawer();
    const setMsg = (m) => { exportMsg = `<span class="spin"></span> ${esc(m)}`; const el = $('.x-msg'); if (el) el.innerHTML = exportMsg; };
    try {
      ctx.sections = ctx.area.sections && ctx.area.sections.length ? await sectionsForExport([{ area: ctx.area }]) : [];
      if (ctx.run && run && run.X) { const iv = GA.compare.indicators(run.X); ctx.indicators = [{ no: 1, name: ctx.area.name, ring: ctx.ring, values: iv }]; ctx.v3 = v3Of(run.X); }
      const demGrid = exportOpts.dem && D.inRegion(G.centroidLL(ctx.ring)) ? await D.grid('dem').catch(() => null) : null;
      const r = await GA.gisexport.build(ctx, exportOpts, { loadSQL, elevation: S.elevation, progress: setMsg, demGrid });
      download(new Blob([r.zipBytes], { type: 'application/zip' }), r.filename);
      window.GA.lastExport = r;
      exportMsg = `<div class="ok">${t('x.done', { v: `<b dir="ltr">${esc(r.filename)}</b> (${nf(r.zipBytes.length / 1024)} KB)` })}</div><ul class="files" dir="ltr">${r.files.map(f => `<li>${esc(f.name)} <small>${nf(f.size / 1024, 1)} KB</small></li>`).join('')}</ul><p class="fine">${t('x.validatedV2')}</p>`;
    } catch (e) { exportMsg = `<div class="error">${t('x.fail', { v: esc(e.message || String(e)) })}</div>`; console.error(e); }
    exportBusy = false; renderDrawerIfOpen();
  }
  const v3Of = (X) => ({ places: X.R.places ? X.R.places.pts : [], bus: X.R.bus ? X.R.bus.pts : [], trees: X.R.trees ? X.R.trees.pts : [], flood: X.R.flood || null });
  async function exportMulti(Xs) {
    toast(t('x.building'));
    const now = new Date().toISOString();
    const areas = Xs.map(x => ({ no: x.no, area: x.area, spec: x.area.spec, ring: x.ring, v3: v3Of(x), run: { parsed: x.parsed, runAt: now, tasks: { osm: { state: 'ok' } }, result: { osmBase: x.parsed.osmBase } } }));
    const ctx = { areas, name: 'comparison_' + Xs.length + '_areas', sections: await sectionsForExport(Xs.map(x => ({ no: x.no, area: x.area }))), indicators: Xs.map(x => ({ no: x.no, name: x.area.name, ring: x.ring, values: x.indicators, notes: x.notes })), polyline: SEC.polyline, atLL };
    const demGrid = await D.grid('dem').catch(() => null);
    const r = await GA.gisexport.build(ctx, { gpkg: true, geojson: true, crs: 25830, dem: !!demGrid }, { loadSQL, elevation: S.elevation, demGrid, progress: () => { } });
    download(new Blob([r.zipBytes], { type: 'application/zip' }), r.filename); window.GA.lastExport = r;
    toast(t('x.done', { v: r.filename + ' (' + nf(r.zipBytes.length / 1024) + ' KB)' }));
  }

  const compareIds = () => { const p = store.get(); p.compare = p.compare || { ids: [] }; return p.compare.ids; };
  function renderDrawer() {
    const d = $('#drawer-body'); const P = store.get();
    if (drawer === 'export') return renderExport(d);
    if (drawer === 'areas') {
      $('#drawer-title').textContent = t('nav.areas');
      d.innerHTML = P.areas.length ? `<table class="tbl"><thead><tr><th>${t('ar.compareCol')}</th><th>${t('ar.name')}</th><th>${t('ar.shape')}</th><th>${t('m.area')}</th><th>${t('ar.last')}</th><th>${t('ui.tab.sections')}</th><th></th></tr></thead><tbody>${P.areas.map(a => `<tr>
        <td><input type="checkbox" data-cmp="${a.id}" ${compareIds().includes(a.id) ? 'checked' : ''} ${!compareIds().includes(a.id) && compareIds().length >= 4 ? 'disabled' : ''}></td>
        <td><button class="link" data-open="${a.id}"><bdi>${esc(a.name)}</bdi></button></td><td>${shapeLabel(a.spec.type)}</td><td>${fmtArea(a.measures.area)}</td>
        <td>${a.analysis ? `<span dir="ltr">${a.analysis.runAt.slice(0, 10)}</span>${a.analysis.stale ? ` <em>${t('ar.stale')}</em>` : ''}` : '—'}</td><td class="num">${(a.sections || []).length}</td>
        <td><button class="btn btn-tiny" data-fabpage="${a.id}">${t('nav.page')}</button> <button class="btn btn-tiny" data-rename="${a.id}">${t('ar.rename')}</button> <button class="btn btn-tiny danger" data-del="${a.id}">${t('delete')}</button></td></tr>`).join('')}</tbody></table>
        <div class="actions"><button class="btn btn-primary" id="btn-compare" ${compareIds().length >= 2 ? '' : 'disabled'}>${t('ar.compare', { n: compareIds().length })}</button></div><p class="fine">${t('ar.compareNote')}</p>`
        : `<p class="lead">${t('ar.empty')}</p>`;
    } else if (drawer === 'status') {
      $('#drawer-title').textContent = t('nav.status');
      const lyRows = L.defs.map(def => { const s = L.S[def.id]; return `<tr><td>${esc(def.title())}</td><td>${s.on ? `<span class="state ${s.status === 'failed' ? 'st-bad' : s.status === 'ok' || s.status === 'overview' || s.status === 'city' || s.status === 'lite' ? 'st-ok' : 'st-exp'}">${t('ly.st.' + (s.status || 'idle'), { n: '' })}</span>` : `<small>${t('ly.off')}</small>`}</td><td><small>${def.src ? def.src() : ''}</small></td></tr>`; }).join('');
      d.innerHTML = `<div class="sub">${t('stx.layersNow')}</div><table class="tbl small">${lyRows}</table>
        <div class="sub">${t('stx.sources')}</div><table class="tbl small">${S.SOURCE_REGISTRY.map(s => `<tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener" dir="ltr">${esc(s.name)}</a></td><td>${t(s.use)}</td><td><span class="state st-${s.status === 'live' ? 'ok' : 'no'}">${t(s.status === 'live' ? 'stx.live' : 'stx.planned')}</span>${s.key ? ` <small>${t('stx.reg')}</small>` : ''}${s.note ? `<div class="fine">${t(s.note)}</div>` : ''}</td></tr>`).join('')}</table>
        <div class="sub">${t('stx.storage')}</div><p class="fine">${t('stx.storageTxt', { a: nf(P.areas.length), b: nf(P.observations.length), c: nf(P.materials.length) })} ${t('stx.importsTxt', { n: nf((P.imports || []).length) })}</p>
        <div class="actions"><button class="btn" id="btn-export">${t('stx.export')}</button><label class="btn">${t('stx.import')}<input type="file" id="in-import" accept="application/json,.json" hidden></label></div>`;
    }
  }
  $('#drawer').addEventListener('click', (e) => {
    const b = e.target.closest('button, input[type=checkbox]'); if (!b) return;
    if (b.id === 'x-go') return runExport();
    if (b.dataset.fabpage) { closeDrawer(); return PG.go('fabric', b.dataset.fabpage); }
    if (b.id === 'x-analyze') { closeDrawer(); return analyze(); }
    if (b.dataset.cmp) { const ids = compareIds(); const i = ids.indexOf(b.dataset.cmp); if (b.checked && i < 0) ids.push(b.dataset.cmp); if (!b.checked && i >= 0) ids.splice(i, 1); store.save(); return renderDrawer(); }
    if (b.id === 'btn-compare') { closeDrawer(); return openWorkspace('compare'); }
    if (b.dataset.rename) { const tr = b.closest('tr'); const a = store.get().areas.find(x => x.id === b.dataset.rename); const td = tr.children[1]; td.innerHTML = `<input class="inline" dir="auto" value="${esc(a.name)}"> <button class="btn btn-tiny" data-renameok="${a.id}">${t('save')}</button>`; td.querySelector('input').focus(); return; }
    if (b.dataset.renameok) { const a = store.get().areas.find(x => x.id === b.dataset.renameok); const val = b.previousElementSibling.value.trim(); if (val) { a.name = val; store.upsertArea(a); } renderDrawer(); renderLeft(); updateMask(); return renderSelectPanel(sel.info()); }
    if (b.dataset.del) { if (b.dataset.armed) { store.removeArea(b.dataset.del); const ids = compareIds(); if (ids.includes(b.dataset.del)) ids.splice(ids.indexOf(b.dataset.del), 1); if (currentAreaId === b.dataset.del) { currentAreaId = null; closeReport(); } renderSelectPanel(sel.info()); updateMask(); return renderDrawer(); } b.dataset.armed = '1'; b.textContent = t('ar.confirmDel'); return; }
    if (b.id === 'btn-export') { download(new Blob([store.exportJSON()], { type: 'application/json' }), 'granada-atlas-' + new Date().toISOString().slice(0, 10) + '.json'); }
  });
  $('#drawer').addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'x-gpkg') exportOpts.gpkg = el.checked;
    if (el.id === 'x-geojson') exportOpts.geojson = el.checked;
    if (el.name === 'x-crs') exportOpts.crs = +el.value;
    if (el.id === 'x-dem') exportOpts.dem = el.checked;
    if (el.id && el.id.startsWith('x-') || el.name === 'x-crs') renderDrawer();
    if (el.id === 'in-import' && el.files[0]) { el.files[0].text().then(txt => { try { store.importJSON(txt); toast(t('toast.restored')); currentAreaId = null; closeReport(); renderSelectPanel(sel.info()); renderDrawer(); updateMask(); } catch (er) { toast(er.message, true); } }); }
  });
  document.querySelectorAll('.tb-btn[data-drawer]').forEach(b => b.addEventListener('click', () => drawer === b.dataset.drawer ? closeDrawer() : openDrawer(b.dataset.drawer)));
  $('#btn-close-drawer').addEventListener('click', closeDrawer);
  $('#tb-measure').addEventListener('click', () => { const on = sel.measureToggle(); toast(on ? t('measure.on') : t('measure.off')); });
  function openWorkspace(tab) { closeDrawer(); if (PG.current) PG.close(); $('#tb-compare').classList.add('on'); CMP.open(tab); }
  $('#tb-compare').addEventListener('click', () => CMP.isOpen() ? CMP.close() : openWorkspace());

  // ---------- start ----------
  map.on('load', async () => {
    renderSelectPanel(sel.info()); if (store.get()._loadError) toast(t('toast.loadErr'), true);
    try { await L.ensureBuilt(); } catch (e) { toast(t('ly.loadFail', { v: e.message }), true); }
    renderLayersPanel(); renderLegend(); drawSavedAreas(); updateMask();
    IMP.restore();
    PG.route();
  });
  renderSelectPanel(sel.info()); renderLeft(); renderLayersPanel();
})();
