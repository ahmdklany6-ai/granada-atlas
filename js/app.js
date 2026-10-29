/* Application wiring: map, selection panel, analysis runs, saved areas, layers, GIS export,
   status — in Arabic, Hebrew or English. Switching language re-renders text only; the
   selection, saved project and analysis results stay untouched. */
(function () {
  const { geo: G, analysis: A, sources: S, store, report: RP, basemap, i18n: I, palette: PAL } = window.GA;
  const t = (k, v) => I.t(k, v);
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = RP.esc, nf = RP.nf;
  const ANALYSIS_MAX_AREA = 3.5e6; // m² — keeps public Overpass requests reasonable

  store.load(); I.apply();
  let currentAreaId = null;   // saved area being edited
  let run = null;             // current analysis run (in memory; raw OSM kept here for GIS export)
  let theme = 'none'; let showPois = false;

  // ---------- map ----------
  const map = new maplibregl.Map({ container: 'map', style: basemap.style(), center: [-3.5986, 37.1773], zoom: 14.2, minZoom: 10, maxZoom: 19, attributionControl: false, dragRotate: false, pitchWithRotate: false });
  map.touchZoomRotate.disableRotation();
  const ctl = { attr: new maplibregl.AttributionControl({ compact: true }), scale: new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 140 }), nav: new maplibregl.NavigationControl({ showCompass: false }) };
  function placeControls() {
    Object.values(ctl).forEach(c => { try { map.removeControl(c); } catch (e) { } });
    const rtl = I.dir() === 'rtl'; // controls sit on the map's end side, away from the study-area panel
    map.addControl(ctl.attr, rtl ? 'bottom-right' : 'bottom-left');
    map.addControl(ctl.scale, rtl ? 'bottom-left' : 'bottom-right');
    map.addControl(ctl.nav, rtl ? 'top-left' : 'top-right');
  }
  placeControls();
  try { maplibregl.setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js', true); } catch (e) { }
  let tileErrors = 0;
  map.on('error', (e) => { if ((e && e.sourceId === 'omt') || /tiles\.openfreemap/.test(String(e && e.error && e.error.message))) { tileErrors++; if (tileErrors === 3) toast(t('toast.tiles'), true); } });

  const sel = GA.selection.create(map, { onChange: renderSelectPanel });
  window.GA.app = { map, sel, store, getRun: () => run }; // exposed for tests

  // ---------- toast ----------
  let toastTimer;
  function toast(msg, isErr) { const el = $('#toast'); el.textContent = msg; el.className = 'toast show' + (isErr ? ' err' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = 'toast', 4200); }

  // ---------- language ----------
  function renderLangSwitch() {
    $('#lang').innerHTML = Object.keys(I.LANGS).map(l => `<button class="lang-btn ${I.lang === l ? 'on' : ''}" data-lang="${l}" lang="${l}" dir="${I.LANGS[l].dir}" aria-pressed="${I.lang === l}">${I.LANGS[l].label}</button>`).join('<span class="lang-sep" aria-hidden="true">|</span>');
  }
  $('#lang').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b && b.dataset.lang !== I.lang) I.setLang(b.dataset.lang); });
  I.onChange(() => {
    renderLangSwitch(); placeControls(); map.resize(); sel.redraw();
    renderSelectPanel(sel.info()); if (run) renderReport(); renderLegend(); renderDrawerIfOpen();
  });
  renderLangSwitch();

  // ---------- selection panel ----------
  const fmtArea = RP.fmtArea, fmtLen = RP.fmtLen;
  const shapeLabel = (k) => ({ circle: t('shape.circle'), square: t('shape.square'), polygon: t('shape.polygonShort') }[k] || '');
  function renderSelectPanel(info) {
    const p = $('#panel-select .panel-b'); const area = currentAreaId && store.get().areas.find(a => a.id === currentAreaId);
    let h = '';
    if (info.phase === 'idle' && !info.ring) {
      h = `<p class="lead">${t('sel.lead')}</p>`;
      const areas = store.get().areas;
      if (areas.length) h += `<div class="sub">${t('sel.saved')}</div><ul class="saved-mini">${areas.slice(-6).reverse().map(a => `<li><button class="link" data-open="${a.id}"><bdi>${esc(a.name)}</bdi></button><small>${shapeLabel(a.spec.type)} · ${fmtArea(a.measures.area)}</small></li>`).join('')}</ul>`;
    } else if (info.phase === 'idle') {
      h = `<p class="lead">${t('sel.armLead')}</p><button class="btn" id="btn-cancel-arm">${t('cancel')}</button>`;
    } else if (info.phase === 'pending') {
      h = `<p class="lead">${t('sel.pendingLead')}</p>`;
    } else {
      h += `<div class="center-ref"><span class="h-center-icon"></span><div><div class="k">${t('sel.center')} <small>(${t('sel.centerNote')})</small></div><div dir="ltr" class="mono">${info.center[1].toFixed(5)}, ${info.center[0].toFixed(5)}</div></div><button class="btn btn-small" id="btn-arm">${t('sel.change')}</button></div>`;
      h += `<div class="seg" role="tablist">${['circle', 'square', 'polygon'].map(k => `<button role="tab" aria-selected="${info.type === k}" class="${info.type === k ? 'on' : ''}" data-tool="${k}">${t('shape.' + k)}</button>`).join('')}</div>`;
      if (!info.type) h += `<p class="hint">${t('sel.chooseShape')}</p>`;
      if (info.type === 'circle') h += `<label class="num"><span>${t('sel.radius')}</span><input id="in-radius" type="number" min="${sel.LIMITS.radius[0]}" max="${sel.LIMITS.radius[1]}" step="10" value="${info.radius}"><span class="u">${t('u.m')}</span></label><p class="hint">${t('sel.circleHint')}</p>`;
      if (info.type === 'square') h += `<label class="num"><span>${t('sel.side')}</span><input id="in-side" type="number" min="${sel.LIMITS.side[0]}" max="${sel.LIMITS.side[1]}" step="10" value="${info.side}"><span class="u">${t('u.m')}</span></label><p class="hint">${t('sel.squareHint')}</p>`;
      if (info.type === 'polygon') h += info.closed ? `<p class="hint">${t('sel.polyEditHint')}</p>`
        : `<p class="hint">${t('sel.polyDrawHint', { n: info.verts })}</p><button class="btn" id="btn-close" ${info.verts < 3 ? 'disabled' : ''}>${t('sel.closePoly')}</button>`;
      if (info.ring) {
        h += `<dl class="measures"><div><dt>${t('m.area')}</dt><dd>${fmtArea(info.area)}</dd><dd class="mono small" dir="ltr">${nf(info.area)} m²</dd></div><div><dt>${t('m.perimeter')}</dt><dd>${fmtLen(info.perimeter)}</dd></div>`
          + `<div><dt>${t('m.dims')}</dt><dd>${info.type === 'circle' ? t('m.r', { v: nf(info.radius) }) : info.type === 'square' ? `<span dir="ltr">${nf(info.side)} × ${nf(info.side)}</span> ${t('u.m')}` : t('m.vertices', { n: info.verts })}</dd></div></dl>`;
        if (info.type === 'circle') h += `<p class="fine">${t('sel.circleNote')}</p>`;
        if (info.selfIntersects) h += `<div class="warn">${t('sel.selfX')}</div>`;
        if (info.area > ANALYSIS_MAX_AREA) h += `<div class="warn">${t('sel.tooBig', { v: nf(ANALYSIS_MAX_AREA / 1e6, 1) })}</div>`;
        h += `<label class="name"><span>${t('sel.name')}</span><input id="in-name" type="text" dir="auto" maxlength="60" placeholder="${esc(t('sel.namePh'))}" value="${esc(area ? area.name : '')}"></label>`;
        h += `<div class="actions"><button class="btn btn-primary" id="btn-analyze" ${info.selfIntersects ? 'disabled' : ''}>${t('sel.analyze')}</button><button class="btn" id="btn-save">${t('save')}</button>${area ? `<button class="btn" id="btn-saveas">${t('sel.saveAs')}</button>` : ''}</div>`;
        h += `<button class="btn btn-gis" id="btn-gis" ${info.selfIntersects ? 'disabled' : ''}>${t('nav.export')}</button>`;
      }
      h += `<div class="actions minor"><button class="btn btn-small" id="btn-undo" ${info.canUndo ? '' : 'disabled'}>${t('undo')}</button><button class="btn btn-small" id="btn-reset">${t('reset')}</button>${info.ring ? `<button class="btn btn-small" id="btn-fit">${t('sel.fit')}</button>` : ''}</div>`;
      if (area) h += `<p class="fine">${t('sel.editing', { name: '<bdi>' + esc(area.name) + '</bdi>' })}</p>`;
    }
    const nameVal = $('#in-name') && $('#in-name').value; // keep a typed but unsaved name across re-renders
    p.innerHTML = h;
    if (nameVal && $('#in-name') && !area) $('#in-name').value = nameVal;
    $('#measure-out').hidden = !info.measure.on && !info.measure.pts;
    $('#measure-out').innerHTML = `${t('measure.out', { v: fmtLen(info.measure.length) })} <button class="btn btn-tiny" id="btn-mclear">${t('clear')}</button>`;
    $('#tb-measure').classList.toggle('on', info.measure.on);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-open]'); if (!b) return;
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
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'in-radius') sel.setRadius(parseFloat(e.target.value));
    if (e.target.id === 'in-side') sel.setSide(parseFloat(e.target.value));
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) { if (e.key === 'Enter' && (e.target.id === 'in-radius' || e.target.id === 'in-side')) e.target.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); sel.undo(); }
    if (e.key === 'Enter') sel.closePolygon();
    if (e.key === 'Escape') { if (sel.info().measure.on) sel.measureToggle(false); closeDrawer(); }
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
    if (forceNew) delete a.analysis;
    return a;
  }
  function saveArea(asNew) {
    const a = currentAreaObject(asNew); if (!a) return;
    if (!store.upsertArea(a)) return toast(t('toast.saveFail'), true);
    currentAreaId = a.id; toast(t('toast.saved', { name: a.name })); renderSelectPanel(sel.info()); renderDrawerIfOpen();
  }
  function openArea(id) {
    const a = store.get().areas.find(x => x.id === id); if (!a) return;
    currentAreaId = id; sel.loadSpec(a.spec); sel.fitTo(); closeDrawer();
    if (a.analysis && a.analysis.result) { run = restoreRun(a); openReport(); applyLayers(); } else closeReport();
  }
  function restoreRun(a) {
    const r = { areaId: a.id, runAt: a.analysis.runAt, result: a.analysis.result, tasks: {}, section: a.analysis.section || 'WE', changes: a.analysis.changes || [], stale: a.analysis.stale, ring: sel.ring(), center: a.spec.center };
    ['osm', 'terrain', 'climate', 'photos', 'wiki', 'research'].forEach(k => r.tasks[k] = { state: (a.analysis.failed || []).includes(k) ? 'error' : 'ok', error: '' });
    if (r.result.osm && !r.result.osm.geo) r.geoMissing = true;
    return r; // raw OSM (run.parsed) is not stored; GIS export asks for a refresh
  }

  // ---------- analysis ----------
  async function analyze() {
    const info = sel.info(); if (!info.ring || info.selfIntersects) return;
    const a = currentAreaObject(false); store.upsertArea(a); currentAreaId = a.id;
    const prevSnap = a.analysis && a.analysis.snapshot;
    run = { areaId: a.id, runAt: new Date().toISOString(), result: {}, tasks: {}, section: (a.analysis && a.analysis.section) || 'WE', ring: info.ring, center: info.center, prevSnap, parsed: null };
    openReport(); clearLayers();
    const ring = info.ring, center = info.center;
    const radius = Math.max(...G.openRing(ring).map(p => G.haversine(center, p)));
    const jobs = {
      osm: async () => {
        if (info.area > ANALYSIS_MAX_AREA) { run.tasks.osm = { state: 'skipped', msgKey: 'osm.tooBig' }; return; }
        const { json, endpoint } = await S.overpass(ring, center, (ep) => setTask('osm', 'running', 'loading.osm', { v: new URL(ep).host }));
        const parsed = A.parseOverpass(json); run.parsed = parsed;
        run.result.osm = A.osmMetrics(parsed, ring); run.result.osmBase = parsed.osmBase; run.result.osmEndpoint = endpoint;
        applyLayers();
      },
      terrain: () => runTerrain(),
      climate: async () => { const { json } = await S.climate(center); run.result.climate = A.climateMetrics(json); },
      photos: async () => { run.result.photos = await S.commons(center, radius + 30, ring); },
      wiki: async () => { run.result.wiki = await S.wikipedia(center, radius); },
    };
    const exec = (k) => { setTask(k, 'running'); return jobs[k]().then(() => { if (run.tasks[k].state === 'running') setTask(k, 'ok'); }, (e) => setTask(k, 'error', null, null, e.message || String(e))); };
    const execResearch = () => {
      setTask('research', 'running');
      const adm = run.result.osm && run.result.osm.admin; const local = adm && adm.length ? adm[adm.length - 1].name : '';
      run.result.researchQuery = ['Granada', local, 'urban'].filter(Boolean).join(' ');
      return S.openalex(['Granada', local, 'urban']).then(r => { run.result.research = r; setTask('research', 'ok'); }, e => setTask('research', 'error', null, null, e.message));
    };
    run.retry = (k) => k === 'research' ? execResearch() : exec(k);
    const osmP = exec('osm');
    ['terrain', 'climate', 'photos', 'wiki'].forEach(exec);
    await osmP; await execResearch();
    finalizeRun();
  }
  async function runTerrain() {
    const ring = run.ring || sel.ring(); const center = run.center || sel.spec().center; const bb = G.bbox(ring);
    const P = G.proj(center); const lo = P.toXY([bb[0], bb[1]]), hi = P.toXY([bb[2], bb[3]]);
    const len = run.section === 'NS' ? (hi[1] - lo[1]) : (hi[0] - lo[0]);
    const pts = G.sectionLine(center, Math.max(60, len), run.section, Math.min(100, Math.max(25, Math.round(len / 15))));
    const elev = await S.elevation(pts); run.result.profile = Object.assign(A.profileMetrics(pts, elev), { pts }); run.result.sectionLine = [pts[0], pts[pts.length - 1]];
    drawSection();
  }
  function setTask(k, state, msgKey, msgVars, error) { run.tasks[k] = { state, msgKey, msgVars, error }; renderReport(); }
  function finalizeRun() {
    const snap = A.snapshot(run.result);
    run.changes = run.prevSnap ? A.diff(run.prevSnap, snap) : [];
    const a = store.get().areas.find(x => x.id === run.areaId); if (!a) return;
    const failed = Object.keys(run.tasks).filter(k => run.tasks[k].state === 'error');
    a.analysis = { runAt: run.runAt, result: run.result, snapshot: snap, changes: run.changes, section: run.section, failed, history: ((a.analysis && a.analysis.history) || []).concat([{ runAt: run.runAt, snapshot: snap }]).slice(-6) };
    if (!store.upsertArea(a)) toast(t('toast.partialSave'), true);
    run.stale = false; renderReport(); renderDrawerIfOpen();
  }

  // ---------- report panel ----------
  function openReport() { $('#panel-report').hidden = false; document.body.classList.add('has-report'); map.resize(); renderReport(); }
  function closeReport() { $('#panel-report').hidden = true; document.body.classList.remove('has-report', 'report-wide'); map.resize(); clearLayers(); run = null; renderDrawerIfOpen(); }
  function renderReport() {
    if (!run) return; const a = store.get().areas.find(x => x.id === run.areaId); if (!a) return;
    const busy = Object.values(run.tasks).some(x => x.state === 'running' || x.state === 'pending');
    $('#rep-title').innerHTML = `<bdi>${esc(a.name)}</bdi>`;
    $('#rep-meta').innerHTML = `${shapeLabel(a.spec.type)} · ${fmtArea(a.measures.area)} · ${busy ? t('rep.running') : t('rep.lastUpdate', { v: '<span dir="ltr" class="nowrap">' + esc(run.runAt.replace('T', ' ').slice(0, 16)) + '</span>' })}`;
    let notice = '';
    if (run.stale) notice += `<div class="warn">${t('rep.stale')}</div>`;
    if (run.changes && run.changes.length) notice += `<div class="changed"><b>${t('rep.changed', { n: run.changes.length })}</b> ${run.changes.slice(0, 8).map(c => `<span dir="ltr">${esc(c.key)}: ${c.from ?? '—'} → ${c.to ?? '—'}</span>`).join(', ')}</div>`;
    if (run.geoMissing) notice += `<div class="note">${t('rep.geoMissing')}</div>`;
    $('#rep-notice').innerHTML = notice;
    const obs = store.get().observations.filter(o => o.areaId === run.areaId);
    const body = $('#rep-body'); const openState = {}; body.querySelectorAll('details.topic').forEach(d => openState[d.id] = d.open);
    const scroll = body.scrollTop; const draft = $('#obs-text') ? $('#obs-text').value : '';
    body.innerHTML = RP.render({ area: a, run, observations: obs });
    body.querySelectorAll('details.topic').forEach(d => { if (d.id in openState) d.open = openState[d.id]; });
    body.scrollTop = scroll; if (draft && $('#obs-text')) $('#obs-text').value = draft;
    $('#btn-refresh').disabled = busy;
  }
  $('#rep-body').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.retry && run && run.retry) { run.retry(b.dataset.retry).then(() => { if (!Object.values(run.tasks).some(x => x.state === 'running')) finalizeRun(); }); }
    if (b.dataset.section && run && b.dataset.section !== run.section) { run.section = b.dataset.section; setTask('terrain', 'running'); runTerrain().then(() => { setTask('terrain', 'ok'); finalizeRun(); }, er => setTask('terrain', 'error', null, null, er.message)); }
    if (b.dataset.wall) { const p = (run.result.photos || []).find(x => x.id === b.dataset.wall); if (p) { const ok = store.addMaterial({ id: p.id, kind: 'photo', title: p.title, thumb: p.thumb, page: p.page, author: p.author, license: p.license, date: p.date, pt: p.pt, source: 'Wikimedia Commons', areaId: run.areaId }); toast(ok ? t('toast.wall') : t('toast.wallDup')); } }
    if (b.dataset.delobs) { store.removeObservation(b.dataset.delobs); renderReport(); }
    if (b.id === 'obs-add') { const txt = $('#obs-text').value.trim(); if (!txt) return; $('#obs-text').value = ''; store.addObservation({ areaId: run.areaId, text: txt, kind: $('#obs-kind').value, topic: $('#obs-topic').value }); renderReport(); }
  });
  $('#btn-refresh').addEventListener('click', refreshCurrent);
  function refreshCurrent() { const a = store.get().areas.find(x => x.id === (run && run.areaId) || x.id === currentAreaId); if (a) { currentAreaId = a.id; if (!sel.info().ring) sel.loadSpec(a.spec); analyze(); } }
  $('#btn-close-report').addEventListener('click', closeReport);
  $('#btn-wide').addEventListener('click', () => { document.body.classList.toggle('report-wide'); map.resize(); });

  // ---------- analysis layers ----------
  const THEMES = ['none', 'heights', 'periods', 'landuse', 'streets'];
  const bandColors = () => { const m = Object.assign({}, PAL.band); ['1–2', '3–4', '5–8'].forEach(k => m[k] = PAL.band[PAL.bandKey(k)]); m.none = PAL.band.no_data; return m; };
  const periodColors = () => { const m = Object.assign({}, PAL.period); ['قبل 1900', '1900–1939', '1940–1959', '1960–1979', '1980–1999', '2000+', 'none'].forEach(k => m[k] = PAL.period[PAL.periodKey(k)]); return m; };
  const matchExpr = (prop, obj, fallback) => ['match', ['get', prop]].concat(Object.entries(obj).flat(), [fallback]);
  function ensureAnLayers() {
    if (map.getSource('an-b')) return;
    const fc = { type: 'FeatureCollection', features: [] };
    ['an-b', 'an-s', 'an-l', 'an-p', 'an-sec', 'an-sec-lbl'].forEach(id => map.addSource(id, { type: 'geojson', data: fc }));
    const before = 'sel-fill';
    map.addLayer({ id: 'an-l', type: 'fill', source: 'an-l', layout: { visibility: 'none' }, paint: { 'fill-color': matchExpr('cat', PAL.landuse, '#ccc'), 'fill-opacity': 0.6 } }, before);
    map.addLayer({ id: 'an-b', type: 'fill', source: 'an-b', layout: { visibility: 'none' }, paint: { 'fill-color': '#ccc', 'fill-outline-color': '#7A7F86' } }, before);
    map.addLayer({ id: 'an-s', type: 'line', source: 'an-s', layout: { visibility: 'none', 'line-cap': 'round' }, paint: { 'line-color': matchExpr('tier', PAL.tier, '#999'), 'line-width': ['match', ['get', 'tier'], 'primary', 4, 'collector', 2.6, 'local', 1.4, 0.9] } }, before);
    map.addLayer({ id: 'an-p', type: 'circle', source: 'an-p', layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 17, 5], 'circle-color': matchExpr('cat', PAL.poi, '#999'), 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1 } });
    map.addLayer({ id: 'an-sec', type: 'line', source: 'an-sec', paint: { 'line-color': PAL.red, 'line-width': 1.6, 'line-dasharray': [4, 2] } });
    map.addLayer({ id: 'an-sec-ends', type: 'symbol', source: 'an-sec-lbl', layout: { 'symbol-placement': 'line-center', 'text-field': 'A — A′', 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, -0.9] }, paint: { 'text-color': PAL.red, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 } });
    map.on('click', 'an-p', (e) => { const f = e.features[0]; if (!f) return; new maplibregl.Popup({ className: 'atlas-popup', offset: 8 }).setLngLat(e.lngLat).setHTML(`<b dir="auto">${esc(f.properties.name || '—')}</b><br><small>${esc(t('poi.' + f.properties.sub))}</small>`).addTo(map); });
  }
  function applyLayers() {
    if (!map.isStyleLoaded()) return map.once('idle', applyLayers);
    ensureAnLayers(); const o = run && run.result.osm;
    const geoOf = (k) => (o && o.geo && o.geo[k]) || { type: 'FeatureCollection', features: [] };
    map.getSource('an-b').setData(geoOf('buildings')); map.getSource('an-s').setData(geoOf('streets'));
    map.getSource('an-l').setData(geoOf('landuse')); map.getSource('an-p').setData(geoOf('pois'));
    const vis = (id, on) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    if (theme === 'heights') map.setPaintProperty('an-b', 'fill-color', matchExpr('band', bandColors(), '#ccc'));
    if (theme === 'periods') map.setPaintProperty('an-b', 'fill-color', matchExpr('period', periodColors(), '#ccc'));
    vis('an-b', theme === 'heights' || theme === 'periods'); vis('an-l', theme === 'landuse'); vis('an-s', theme === 'streets'); vis('an-p', showPois);
    drawSection(); renderLegend();
  }
  function clearLayers() { if (map.getSource('an-b')) ['an-b', 'an-s', 'an-l', 'an-p', 'an-sec', 'an-sec-lbl'].forEach(id => map.getSource(id).setData({ type: 'FeatureCollection', features: [] })); renderLegend(); }
  function drawSection() {
    if (!map.getSource('an-sec')) { if (map.isStyleLoaded()) ensureAnLayers(); else return; }
    const l = run && run.result.sectionLine;
    const fcl = { type: 'FeatureCollection', features: l ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l } }] : [] };
    map.getSource('an-sec').setData(fcl); map.getSource('an-sec-lbl').setData(fcl); // label on its own source so a font failure cannot hide the line
  }
  function renderLegend() {
    const el = $('#legend'); const o = run && run.result.osm; let h = '';
    const sw = (c, l) => `<div><i style="background:${c}"></i>${l}</div>`;
    if (o && theme === 'heights') h = `<h4>${t('lg.floors')}</h4>` + Object.keys(PAL.band).map(k => sw(PAL.band[k], RP.bandLabel(k))).join('') + `<p>OSM building:levels · ${t('lg.coverage', { v: RP.pct(o.buildings.levelsCoverage) })}</p>`;
    if (o && theme === 'periods') h = `<h4>${t('th.periods')}</h4>` + Object.keys(PAL.period).map(k => sw(PAL.period[k], RP.periodLabel(k))).join('') + `<p>OSM start_date · ${t('lg.coverage', { v: RP.pct(o.buildings.startCoverage) })}</p>`;
    if (o && theme === 'landuse') h = `<h4>${t('th.landuse')}</h4>` + Object.keys(PAL.landuse).filter(k => o.landuse.areas[k] > 0).map(k => sw(PAL.landuse[k], t('lu.c.' + k))).join('') + `<p>OSM landuse/leisure/amenity</p>`;
    if (o && theme === 'streets') h = `<h4>${t('th.streets')}</h4>` + ['primary', 'collector', 'local', 'pedestrian'].map(k => `<div><i class="ln" style="background:${PAL.tier[k]};height:${PAL.tierWidth[k]}px"></i>${t('tier.' + k)}</div>`).join('') + `<p>OSM highway</p>`;
    if (o && showPois) h += `<h4>${t('lg.points')}</h4>` + ['public', 'transit', 'tourism', 'food', 'everyday', 'worship', 'heritage'].map(k => `<div><i class="dot" style="background:${PAL.poi[k]}"></i>${t('poi.g.' + k)}</div>`).join('');
    if (run && run.result.sectionLine) h += `<div class="sec-key"><i class="dash"></i>${t('lg.section')}</div>`;
    el.innerHTML = h; el.hidden = !h;
  }

  // ---------- drawers ----------
  let drawer = null;
  function openDrawer(kind) { drawer = kind; $('#drawer').hidden = false; renderDrawer(); document.querySelectorAll('.tb-btn[data-drawer]').forEach(b => b.classList.toggle('on', b.dataset.drawer === kind)); }
  function closeDrawer() { drawer = null; $('#drawer').hidden = true; document.querySelectorAll('.tb-btn[data-drawer]').forEach(b => b.classList.remove('on')); }
  function renderDrawerIfOpen() { if (drawer) renderDrawer(); }
  const compareIds = new Set();
  const exportOpts = { gpkg: true, geojson: true, crs: 25830, dem: false, demCell: 30 }; let exportBusy = false, exportMsg = '';

  function exportCtx() {
    const info = sel.info(); if (!info.ring) return null;
    const area = currentAreaId && store.get().areas.find(a => a.id === currentAreaId);
    const sameRing = run && run.ring && JSON.stringify(run.ring) === JSON.stringify(info.ring); // data must belong to this exact boundary
    const r = run && run.areaId === (area && area.id) && !run.stale && sameRing ? run : null;
    return { area: area || { name: ($('#in-name') && $('#in-name').value.trim()) || 'study_area' }, spec: sel.spec(), ring: info.ring, run: r };
  }
  function renderExport(d) {
    $('#drawer-title').textContent = t('x.title');
    const ctx = exportCtx(); if (!ctx) { d.innerHTML = `<p class="lead">${t('x.needArea')}</p>`; return; }
    const inv = GA.gisexport.inventory(ctx);
    const needOSM = inv.find(l => l.id === 'buildings').status === 'unavailable';
    const reason = needOSM ? inv.find(l => l.id === 'buildings').reason : null;
    const stTxt = (l) => l.status === 'ready' ? `<span class="state st-ok">${t('x.ready')}</span> <span class="num">${t('x.features', { n: nf(l.count) })}</span>` : l.status === 'empty' ? `<span class="state st-exp">${t('x.empty')}</span>` : `<span class="state st-no">${t('x.unavailable')}</span> <small>${t(l.reason)}</small>`;
    let dem = ''; try { const pl = GA.gisexport.demPlan(ctx.ring, exportOpts.crs, exportOpts.demCell); dem = t('x.demNote', { c: nf(pl.cell, 1), n: nf(pl.n), r: nf(pl.requests) }); } catch (e) { }
    d.innerHTML = `<p class="lead">${t('x.lead')}</p>`
      + (needOSM ? `<div class="warn">${t(reason === 'x.needRefresh' ? 'x.needRefresh' : 'x.needAnalysis')} <button class="btn btn-small btn-primary" id="x-analyze">${run && run.areaId === currentAreaId ? t('rep.refresh') : t('sel.analyze')}</button></div>` : '')
      + `<div class="sub">${t('x.layers')}</div><table class="tbl small"><tbody>${inv.map(l => `<tr class="${l.status}"><td><code>${l.id}</code></td><td>${t('L.' + l.id)}</td><td>${stTxt(l)}</td></tr>`).join('')}</tbody></table>`
      + `<div class="sub">${t('x.formats')}</div>
        <label class="chk"><input type="checkbox" id="x-gpkg" ${exportOpts.gpkg ? 'checked' : ''}> ${t('x.gpkg')}</label>
        <label class="chk"><input type="checkbox" id="x-geojson" ${exportOpts.geojson ? 'checked' : ''}> ${t('x.geojson')}</label>
        <fieldset class="radios"><legend>${t('x.crs')}</legend><label><input type="radio" name="x-crs" value="25830" ${exportOpts.crs === 25830 ? 'checked' : ''}> ${t('x.crs25830')}</label><label><input type="radio" name="x-crs" value="4326" ${exportOpts.crs === 4326 ? 'checked' : ''}> ${t('x.crs4326')}</label></fieldset>
        <label class="chk"><input type="checkbox" id="x-dem" ${exportOpts.dem ? 'checked' : ''}> ${t('x.dem')}</label>
        <div class="dem-opts" ${exportOpts.dem ? '' : 'hidden'}><label class="num cell"><span>${t('x.cell')}</span><select id="x-cell"><option value="30" ${exportOpts.demCell === 30 ? 'selected' : ''}>30 m</option><option value="90" ${exportOpts.demCell === 90 ? 'selected' : ''}>90 m</option></select></label><p class="fine">${dem}</p></div>
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
      const r = await GA.gisexport.build(ctx, exportOpts, { loadSQL, elevation: S.elevation, progress: setMsg });
      const blob = new Blob([r.zipBytes], { type: 'application/zip' }); const u = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = u; a.download = r.filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
      window.GA.lastExport = r; // for tests
      exportMsg = `<div class="ok">${t('x.done', { v: `<b dir="ltr">${esc(r.filename)}</b> (${nf(r.zipBytes.length / 1024)} KB)` })}</div><ul class="files" dir="ltr">${r.files.map(f => `<li>${esc(f.name)} <small>${nf(f.size / 1024, 1)} KB</small></li>`).join('')}</ul><p class="fine">${t('x.validated')}</p>`;
    } catch (e) { exportMsg = `<div class="error">${t('x.fail', { v: esc(e.message || String(e)) })}</div>`; }
    exportBusy = false; renderDrawerIfOpen();
  }

  function renderDrawer() {
    const d = $('#drawer-body'); const P = store.get();
    if (drawer === 'export') return renderExport(d);
    if (drawer === 'areas') {
      $('#drawer-title').textContent = t('nav.areas');
      d.innerHTML = P.areas.length ? `<table class="tbl"><thead><tr><th></th><th>${t('ar.name')}</th><th>${t('ar.shape')}</th><th>${t('m.area')}</th><th>${t('ar.last')}</th><th></th></tr></thead><tbody>${P.areas.map(a => `<tr>
        <td><input type="checkbox" data-cmp="${a.id}" ${compareIds.has(a.id) ? 'checked' : ''} ${a.analysis ? '' : `disabled title="${esc(t('ar.needAnalysis'))}"`}></td>
        <td><button class="link" data-open="${a.id}"><bdi>${esc(a.name)}</bdi></button></td><td>${shapeLabel(a.spec.type)}</td><td>${fmtArea(a.measures.area)}</td>
        <td>${a.analysis ? `<span dir="ltr">${a.analysis.runAt.slice(0, 10)}</span>${a.analysis.stale ? ` <em>${t('ar.stale')}</em>` : ''}${a.analysis.failed && a.analysis.failed.length ? ` <em>${t('ar.partial')}</em>` : ''}` : '—'}</td>
        <td><button class="btn btn-tiny" data-rename="${a.id}">${t('ar.rename')}</button> <button class="btn btn-tiny danger" data-del="${a.id}">${t('delete')}</button></td></tr>`).join('')}</tbody></table>
        <div class="actions"><button class="btn btn-primary" id="btn-compare" ${compareIds.size >= 2 ? '' : 'disabled'}>${t('ar.compare', { n: compareIds.size })}</button></div>`
        : `<p class="lead">${t('ar.empty')}</p>`;
    } else if (drawer === 'compare') {
      $('#drawer-title').textContent = t('cmp.title');
      const as = P.areas.filter(a => compareIds.has(a.id) && a.analysis);
      const areasM = as.map(a => a.measures.area); const mixed = Math.max(...areasM) / Math.min(...areasM) > 1.05 || new Set(as.map(a => a.spec.type)).size > 1;
      const v = (a, f) => { try { const o = a.analysis.result.osm; return o ? f(o, a) : '—'; } catch (e) { return '—'; } };
      const n = (x, dd) => `<span class="num">${nf(x, dd)}</span>`;
      const rows = [
        ['cmp.shapeArea', a => shapeLabel(a.spec.type) + ' · ' + fmtArea(a.measures.area)],
        ['b.count', a => v(a, o => n(o.buildings.count))],
        ['cmp.bph', a => v(a, o => n(o.buildings.count / (o.selArea / 1e4), 1))],
        ['b.gsi', a => v(a, o => `<span class="num">${RP.pct(o.buildings.gsi, 1)}</span>`)],
        ['cmp.levelsCov', a => v(a, o => `<span class="num">${RP.pct(o.buildings.levelsCoverage)}</span>`)],
        ['cmp.density', a => v(a, o => n(o.streets.density, 1))],
        ['cmp.ped', a => v(a, o => `<span class="num">${RP.pct(o.streets.tiers.pedestrian / (o.streets.total || 1))}</span>`)],
        ['cmp.public', a => v(a, o => n(Object.keys(o.pois.cats).filter(k => k.startsWith('public:')).reduce((s, k) => s + o.pois.cats[k], 0)))],
        ['cmp.green', a => v(a, o => `<span class="num">${RP.pct((o.landuse.areas.green || 0) / o.selArea, 1)}</span>`)],
        ['cmp.bus', a => v(a, o => n(o.pois.cats['transit:bus'] || 0))],
        ['cmp.tour', a => v(a, o => `<span class="num">${nf(o.pois.cats['tourism:stay'] || 0)} / ${nf(o.pois.cats.everyday || 0)}</span>`)],
        ['cmp.relief', a => a.analysis.result.profile ? RP.unit(nf(a.analysis.result.profile.relief), 'm') : '—'],
        ['cmp.date', a => `<span dir="ltr">${a.analysis.runAt.slice(0, 10)}</span>`],
      ];
      d.innerHTML = (mixed ? `<div class="warn">${t('cmp.mixed')}</div>` : '')
        + `<div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th></th>${as.map(a => `<th><bdi>${esc(a.name)}</bdi></th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><th>${t(r[0])}</th>${as.map(a => `<td>${r[1](a)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="fine">${t('cmp.src')}</p><button class="btn" data-drawer-go="areas">${t('back')}</button>`;
    } else if (drawer === 'layers') {
      $('#drawer-title').textContent = t('nav.layers');
      d.innerHTML = (run && run.result.osm ? '' : `<p class="note">${t('ly.afterAnalysis')}</p>`)
        + `<fieldset class="radios">${THEMES.map(k => `<label><input type="radio" name="theme" value="${k}" ${theme === k ? 'checked' : ''}> ${t('th.' + k)}</label>`).join('')}</fieldset>
        <label class="chk"><input type="checkbox" id="chk-pois" ${showPois ? 'checked' : ''}> ${t('ly.pois')}</label>
        <div class="sub">${t('ly.basemap')}</div><label class="chk"><input type="checkbox" id="chk-bld" ${map.getLayoutProperty('building', 'visibility') !== 'none' ? 'checked' : ''}> ${t('ly.buildings')}</label>
        <label class="chk"><input type="checkbox" id="chk-lbl" ${map.getLayoutProperty('label-street', 'visibility') !== 'none' ? 'checked' : ''}> ${t('ly.labels')}</label>`;
    } else if (drawer === 'status') {
      $('#drawer-title').textContent = t('nav.status');
      const M = [['stx.m1', 'ok'], ['stx.m2', 'ok'], ['stx.m3', 'ok'], ['stx.m4', 'ok'], ['stx.m5', 'ok'], ['stx.m6', 'ok'], ['stx.m7', 'exp'], ['stx.m8', 'no'], ['stx.m9', 'no'], ['stx.m10', 'no'], ['stx.m11', 'no'], ['stx.m12', 'no']];
      d.innerHTML = `<div class="sub">${t('stx.modules')}</div><table class="tbl">${M.map(m => `<tr><td>${t(m[0])}</td><td><span class="state st-${m[1]}">${t(m[1] === 'ok' ? 'stx.works' : m[1] === 'exp' ? 'stx.exp' : 'stx.no')}</span></td></tr>`).join('')}</table>
        <div class="sub">${t('ly.basemap')}</div><p class="fine">${t('stx.basemap')}</p>
        <div class="sub">${t('stx.sources')}</div><table class="tbl small">${S.SOURCE_REGISTRY.map(s => `<tr><td><a href="${esc(s.url)}" target="_blank" rel="noopener" dir="ltr">${esc(s.name)}</a></td><td>${t(s.use)}</td><td><span class="state st-${s.status === 'live' ? 'ok' : 'no'}">${t(s.status === 'live' ? 'stx.live' : 'stx.planned')}</span>${s.key ? ` <small>${t('stx.reg')}</small>` : ''}${s.note ? `<div class="fine">${t(s.note)}</div>` : ''}</td></tr>`).join('')}</table>
        <div class="sub">${t('stx.storage')}</div><p class="fine">${t('stx.storageTxt', { a: nf(P.areas.length), b: nf(P.observations.length), c: nf(P.materials.length) })}</p>
        <div class="actions"><button class="btn" id="btn-export">${t('stx.export')}</button><label class="btn">${t('stx.import')}<input type="file" id="in-import" accept="application/json,.json" hidden></label></div>`;
    }
  }
  $('#drawer').addEventListener('click', (e) => {
    const b = e.target.closest('button, input[type=checkbox]'); if (!b) return;
    if (b.id === 'x-go') return runExport();
    if (b.id === 'x-analyze') { closeDrawer(); return run && run.areaId === currentAreaId ? refreshCurrent() : analyze(); }
    if (b.dataset.cmp) { b.checked ? compareIds.add(b.dataset.cmp) : compareIds.delete(b.dataset.cmp); return renderDrawer(); }
    if (b.id === 'btn-compare') return openDrawer('compare');
    if (b.dataset.drawerGo) return openDrawer(b.dataset.drawerGo);
    if (b.dataset.rename) { const tr = b.closest('tr'); const a = store.get().areas.find(x => x.id === b.dataset.rename); const td = tr.children[1]; td.innerHTML = `<input class="inline" dir="auto" value="${esc(a.name)}"> <button class="btn btn-tiny" data-renameok="${a.id}">${t('save')}</button>`; td.querySelector('input').focus(); return; }
    if (b.dataset.renameok) { const a = store.get().areas.find(x => x.id === b.dataset.renameok); const val = b.previousElementSibling.value.trim(); if (val) { a.name = val; store.upsertArea(a); } renderDrawer(); if (run && run.areaId === a.id) renderReport(); return renderSelectPanel(sel.info()); }
    if (b.dataset.del) { if (b.dataset.armed) { store.removeArea(b.dataset.del); compareIds.delete(b.dataset.del); if (currentAreaId === b.dataset.del) { currentAreaId = null; closeReport(); } renderSelectPanel(sel.info()); return renderDrawer(); } b.dataset.armed = '1'; b.textContent = t('ar.confirmDel'); return; }
    if (b.id === 'btn-export') { const blob = new Blob([store.exportJSON()], { type: 'application/json' }); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'granada-atlas-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
  });
  $('#drawer').addEventListener('change', (e) => {
    const el = e.target;
    if (el.name === 'theme') { theme = el.value; applyLayers(); }
    if (el.id === 'chk-pois') { showPois = el.checked; applyLayers(); }
    if (el.id === 'chk-bld') map.setLayoutProperty('building', 'visibility', el.checked ? 'visible' : 'none');
    if (el.id === 'chk-lbl') ['label-street', 'label-poi', 'label-place-minor', 'label-place-major', 'label-water'].forEach(id => map.setLayoutProperty(id, 'visibility', el.checked ? 'visible' : 'none'));
    if (el.id === 'x-gpkg') exportOpts.gpkg = el.checked;
    if (el.id === 'x-geojson') exportOpts.geojson = el.checked;
    if (el.name === 'x-crs') exportOpts.crs = +el.value;
    if (el.id === 'x-dem') exportOpts.dem = el.checked;
    if (el.id === 'x-cell') exportOpts.demCell = +el.value;
    if (el.id && el.id.startsWith('x-') || el.name === 'x-crs') renderDrawer();
    if (el.id === 'in-import' && el.files[0]) { el.files[0].text().then(txt => { try { store.importJSON(txt); toast(t('toast.restored')); currentAreaId = null; closeReport(); renderSelectPanel(sel.info()); renderDrawer(); } catch (er) { toast(er.message, true); } }); }
  });
  document.querySelectorAll('.tb-btn[data-drawer]').forEach(b => b.addEventListener('click', () => drawer === b.dataset.drawer ? closeDrawer() : openDrawer(b.dataset.drawer)));
  $('#btn-close-drawer').addEventListener('click', closeDrawer);
  $('#tb-measure').addEventListener('click', () => { const on = sel.measureToggle(); toast(on ? t('measure.on') : t('measure.off')); });

  map.on('load', () => { renderSelectPanel(sel.info()); if (store.get()._loadError) toast(t('toast.loadErr'), true); });
  renderSelectPanel(sel.info());
})();
