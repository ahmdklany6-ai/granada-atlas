/* Analysis results page for one urban fabric (one saved study area) — #/fabric/<id> (#/analysis/<id> is an alias).
   Reading first: a large name, a large location map within Granada (neighbourhoods, landmarks, scale, north, legend),
   an identity summary and a few key indicators; then results under clear headings, each with large maps that open
   in an interactive viewer, short findings, charts, photographs and sections. Editing (captions, rationale, which
   maps appear, order, hiding, research questions) happens only in Edit mode. Stored in the project (this browser);
   exported as a composed A3 PDF. */
(function (root) {
  const { i18n: I, pages: PG, gallery: GAL, mapcard: MC, compare: CMP, section: SEC, ext: X, store, data: D, geo: G, proj: PJ, palette: P } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc; const nf = PG.nf;
  // results grouped under headings; each topic is a result map
  const THEMES = [
    { id: 'form', topics: ['fg', 'heights', 'periods'] },
    { id: 'streets', topics: ['streets', 'bus', 'transit'] },
    { id: 'activities', topics: ['places', 'landuse', 'health', 'education', 'stay'] },
    { id: 'environment', topics: ['trees', 'parks', 'flood', 'noise', 'elevation', 'slope'] },
    { id: 'history', kind: 'history' }, { id: 'sections', kind: 'sections' }, { id: 'research', kind: 'research' }, { id: 'attachments', kind: 'attachments' },
  ];
  const IDS = THEMES.map(x => x.id);
  const OLD = { maps: 'form', findings: 'research', photos: 'history', climate: 'environment' }; // v3 block ids → v5 headings
  const HIST_SNAP = ['mtn50', 'ams56', 'inter7386', 'pnoa2024'];
  const LANDMARKS = [ // coordinates from the Spanish Wikipedia articles (es.wikipedia.org), checked 31 Oct 2026
    ['Alhambra', [-3.58821, 37.17634]], ['Catedral', [-3.59904, 37.17599]], ['Plaza Nueva', [-3.59606, 37.17684]], ['Puerta Real', [-3.59967, 37.17372]], ['Estación de Granada', [-3.60915, 37.18401]],
    ['Parque García Lorca', [-3.60944, 37.1706]], ['Palacio de Congresos', [-3.5983, 37.1656]], ['Cartuja', [-3.59953, 37.19192]], ['Plaza de toros', [-3.60767, 37.18907]], ['Estadio Los Cármenes', [-3.59574, 37.15297]],
  ];
  function board(id) {
    const p = store.get(); p.fabrics = p.fabrics || {}; const b = p.fabrics[id] = p.fabrics[id] || {};
    b.captions = b.captions || {}; Object.entries(OLD).forEach(([o, n]) => { if (b.captions[o] && !b.captions[n]) b.captions[n] = b.captions[o]; });
    const order = (b.order || []).map(k => OLD[k] || k).filter(k => IDS.includes(k)); b.order = [...new Set(order.concat(IDS))];
    b.hidden = (b.hidden || []).map(k => OLD[k] || k).filter(k => IDS.includes(k)); b.off = b.off || {}; b.questions = b.questions || []; b.responses = b.responses || [];
    return b;
  }
  const areaOf = (id) => store.get().areas.find(a => a.id === id);
  let state = null; let edit = false;
  const topicTitle = (tp) => t('g.' + tp) !== 'g.' + tp ? t('g.' + tp) : t('g3.' + tp);

  function nav(id) { const A = store.get().areas; return A.map(a => `<button class="${a.id === id ? 'on' : ''}" onclick="GA.pages.go('fabric','${a.id}')"><bdi>${esc(a.name)}</bdi></button>`).join(''); }
  CMP.onUpdate((Xu) => { if (!state || state.X !== Xu || !state.body || !state.body.isConnected) return; const f = document.activeElement; if (f && state.body.contains(f) && /TEXTAREA|INPUT|SELECT/.test(f.tagName)) return; render(state.body, state.id, true); });

  async function render(body, id, keepScroll) {
    const a = areaOf(id); if (!a) { body.innerHTML = `<p class="lead">${t('fb.noArea')}</p>`; return; }
    const b = board(id); const sc = keepScroll ? body.closest('#page').scrollTop : 0;
    if (!keepScroll) body.innerHTML = `<div class="loading"><span class="spin"></span>${t('ws.computing')}</div>`;
    let X0; try { X0 = await CMP.prepare(a); } catch (e) { body.innerHTML = `<div class="warn">${t('v4.fabricFailed', { e: esc(e.message || String(e)) })} <button class="btn btn-small" id="fb-retry">${t('retry')}</button></div>`; body.querySelector('#fb-retry').onclick = () => render(body, id); return; }
    if (!PG.current || !['fabric', 'analysis'].includes(PG.current.name) || PG.current.params[0] !== id) return;
    const cards = GAL.cards({ ring: X0.ring }, X0.parsed, X0.R, { dem: X0.dem, slope: X0.slope, contours: X0.contours, ext: X0.ext });
    const lib = root.GA.library ? await root.GA.library.byLink('fabrics', id) : [];
    state = { id, X: X0, cards, lib, body, hist: state && state.id === id ? state.hist : null, ind: CMP.indicators(X0) };
    const ind = state.ind; const adm = (X0.parsed.admin || []).map(x => x.name).slice().reverse().filter(Boolean);
    const kp = [['buildings', 'b.count'], ['gsi', 'b.gsi'], ['median_floors', 'g.medianFloors'], ['places_per_km2', 'cmp3.placesD'], ['canopy_mean', 'cmp3.canopy'], ['bus_sched', 'cmp3.busSched']];
    const kv = (k) => { const row = CMP.IND_ROWS.find(r => r[0] === k); const v = row ? CMP.fmtInd(row, ind[k]) : null; return v == null ? `<em class="missing">${CMP.whyLabel((ind._why || {})[k])}</em>` : v; };
    const visible = b.order.filter(k => edit || !b.hidden.includes(k));
    let h = `<div class="ap ${edit ? 'editing' : ''}">
      <header class="ap-hero">
        <div class="ap-hero-t">
          <p class="plate">${t('v5.analysisOf')}</p>
          <h1 class="ap-name" dir="auto">${esc(a.name)}</h1>
          <p class="ap-where" dir="auto">${esc(adm.join(' · ') || 'Granada')}</p>
          ${edit ? `<label class="name"><span>${t('fb.summary')}</span><textarea dir="auto" rows="2" data-fb-txt="summary" placeholder="${esc(t('fb.summaryPh'))}">${esc(b.summary || '')}</textarea></label>
            <label class="name"><span>${t('fb.rationale')}</span><textarea dir="auto" rows="3" data-fb-txt="rationale" placeholder="${esc(t('fb.rationalePh'))}">${esc(b.rationale || '')}</textarea></label>`
          : `${b.summary ? `<p class="ap-sum" dir="auto">${esc(b.summary)}</p>` : `<p class="ap-sum hint">${t('v5.summaryHint')}</p>`}${b.rationale ? `<p class="ap-rat" dir="auto"><b>${t('fb.rationale')}:</b> ${esc(b.rationale)}</p>` : ''}`}
          <dl class="ap-kpis">${kp.map(([k, l]) => `<div><dt>${t(l)}</dt><dd>${kv(k)}</dd></div>`).join('')}</dl>
          <p class="fine">${shapeLabel(a)} · <span dir="ltr">${(G.ringArea(X0.ring) / 1e4).toFixed(2)} ha</span>${X0.extPending ? ` · <span class="spin"></span> ${t('v4.extPending')}` : ''}</p>
        </div>
        <figure class="ap-loc"><button type="button" class="ap-map ap-locmap" data-ap-loc aria-label="${esc(t('v5.enlargeMap') + ': ' + t('v5.locTitle'))}"><canvas id="ap-loc"></canvas><span class="enl" aria-hidden="true">⤢ ${t('v5.enlargeMap')}</span></button>
          <figcaption><ul class="lg">${locLegend().map(i => GAL.legendHTML([i]).replace(/^<ul class="lg">|<\/ul>$/g, '')).join('')}</ul></figcaption></figure>
      </header>
      <nav class="ap-toc" aria-label="${esc(t('v5.sections'))}">${visible.map(k => `<a href="#ap-${k}" data-toc="${k}">${t('v5.th.' + k)}</a>`).join('')}</nav>`;
    visible.forEach((k, i) => {
      const th = THEMES.find(x => x.id === k); const hid = b.hidden.includes(k);
      h += `<section class="ap-sec ${hid ? 'is-hidden' : ''}" id="ap-${k}" data-block="${k}"><header class="ap-sec-h"><h2>${t('v5.th.' + k)}</h2>
        ${edit ? `<div class="ap-edit-tools"><button class="btn btn-tiny" data-fb="up" ${i === 0 ? 'disabled' : ''}>${t('ly.up')}</button><button class="btn btn-tiny" data-fb="down" ${i === visible.length - 1 ? 'disabled' : ''}>${t('ly.down')}</button><button class="btn btn-tiny" data-fb="hide">${t(hid ? 'fb.show' : 'fb.hide')}</button></div>` : ''}<button class="btn btn-tiny" data-fb="png">${t('v5.png')}</button></header>
        ${edit ? `<label class="fb-cap"><span>${t('fb.caption')}</span><textarea dir="auto" rows="2" data-fb-cap="${k}" placeholder="${esc(t('fb.captionPh'))}">${esc(b.captions[k] || '')}</textarea></label>` : (b.captions[k] ? `<p class="ap-cap" dir="auto">${esc(b.captions[k])}</p>` : '')}
        ${hid ? `<p class="fine">${t('v5.hiddenSec')}</p>` : themeHTML(th, a, b)}</section>`;
    });
    h += `</div>`;
    body.innerHTML = h;
    paintAll(body, a, b);
    body.onclick = (e) => onClick(e, body, a, b); body.onchange = (e) => onChange(e, body, a, b);
    if (!b.hidden.includes('history')) loadHistory(a, body);
    if (keepScroll) body.closest('#page').scrollTop = sc;
  }
  const shapeLabel = (a) => t('shape.' + (a.spec && a.spec.type)) !== 'shape.' + (a.spec && a.spec.type) ? t('shape.' + a.spec.type) : (a.spec && a.spec.type) || '';
  function figHTML(c) {
    if (!c) return '';
    if (c.gapOnly) return `<figure class="ap-fig gap"><h3>${c.title}</h3><p class="note">${c.gapOnly}</p></figure>`;
    return `<figure class="ap-fig" data-card="${c.id}"><h3>${c.title}</h3>
      <button type="button" class="ap-map" data-ap-card="${c.id}" aria-label="${esc(t('v5.enlargeMap') + ': ' + String(c.title).replace(/<[^>]+>/g, ''))}"><canvas data-ap-cv="${c.id}"></canvas><span class="enl" aria-hidden="true">⤢ ${t('v5.enlargeMap')}</span></button>
      <div class="ap-fig-b">${GAL.legendHTML(c.legend || [])}
        ${(c.ind || []).length ? `<dl class="kpi">${c.ind.slice(0, 4).map(i => `<div><dt>${i[0]}</dt><dd>${i[1]}</dd></div>`).join('')}</dl>` : ''}
        ${c.chart ? `<button type="button" class="ap-chart" data-ap-chart="${c.id}" aria-label="${esc(t('v5.enlargeChart'))}">${GAL.chartSVG(c.chart)}</button>` : ''}
        <ul class="find">${(c.find || []).slice(0, 3).map(f => `<li>${f}</li>`).join('')}</ul>
        <details class="method"><summary>${t('v5.sourceMethod')}</summary><p class="src"><bdi>${esc(c.src.name)}</bdi> · <span dir="ltr">${esc(c.src.detail)}</span> · ${esc(c.src.license)}</p><p>${c.method || ''}</p></details></div></figure>`;
  }
  function themeHTML(th, a, b) {
    const X0 = state.X;
    if (th.topics) {
      const off = b.off[th.id] || []; const cs = th.topics.filter(tp => !off.includes(tp)).map(tp => state.cards.find(c => c.id === tp)).filter(Boolean);
      let h = edit ? `<div class="ws-pick">${th.topics.filter(tp => state.cards.find(c => c.id === tp)).map(tp => `<label><input type="checkbox" data-ap-topic="${th.id}:${tp}" ${off.includes(tp) ? '' : 'checked'}> ${topicTitle(tp)}</label>`).join('')}</div>` : '';
      h += `<div class="ap-grid">${cs.map(figHTML).join('')}</div>`;
      if (th.id === 'environment') { const cl = a.analysis && a.analysis.result && a.analysis.result.climate; h += `${cl ? `<p class="fine">${t('fb.era5', { y: cl.year, h: nf(cl.hot35), n: nf(cl.trop20) })}</p>` : ''}<p class="fine">${t('fb.heatRef')} <button class="btn btn-tiny" data-ref="heat">${t('ref.view')}</button></p>`; }
      if (th.id === 'streets') h += `<p class="fine">${t('g.fFreqGap')}</p>`;
      return h;
    }
    if (th.kind === 'history') {
      const ph = ((a.analysis && a.analysis.result && a.analysis.result.photos) || []).filter(p => p.thumb).slice(0, 12);
      const libI = state.lib.filter(it => it.kind === 'image' && it.thumb);
      return `<h3 class="ap-sub">${t('v5.histMaps')}</h3><div class="ap-hist" id="fb-hist">${HIST_SNAP.map(hk => `<figure data-hist="${hk}"><button type="button" class="ap-map hist-img" data-ap-hist="${hk}" aria-label="${esc(t('v5.enlargeImage') + ': ' + t('hist.' + hk))}"><span class="spin"></span></button><figcaption>${t('hist.' + hk)} <small class="hist-date"></small></figcaption></figure>`).join('')}</div>
        <p class="fine">${t('fb.histNote')}</p>
        <h3 class="ap-sub">${t('v5.photos')}</h3>${(ph.length || libI.length) ? `<div class="ap-photos">${ph.map((p, i) => `<figure><button type="button" class="ap-photo" data-ap-photo="${i}" aria-label="${esc(t('v5.enlargeImage') + ': ' + (p.title || ''))}"><img src="${esc(p.thumb)}" alt="${esc(p.title || '')}" loading="lazy"></button><figcaption><small dir="auto">${esc(p.author || '')} · ${esc(p.license || '')} · ${root.GA.dates.html(p.date)} · ${t(p.cameraInside || p.inside ? 'fb.phInside' : 'fb.phNearby')}</small></figcaption></figure>`).join('')}${libI.map(it => `<figure><button type="button" class="ap-photo" data-lib-open="${it.id}"><img src="${it.thumb}" alt=""></button><figcaption><small dir="auto">${esc(it.title)}</small></figcaption></figure>`).join('')}</div>` : `<p class="note">${t('fb.noPhotos')}</p>`}`;
    }
    if (th.kind === 'sections') {
      const S = a.sections || [];
      return S.length ? `<div class="ap-secs">${S.map(s => `<figure class="ap-secfig"><figcaption><h3 dir="auto">${esc(s.name)}</h3></figcaption><button type="button" class="ap-map ap-secbtn" data-ap-sec="${s.id}" aria-label="${esc(t('v5.enlargeSection') + ': ' + s.name)}"><canvas data-ap-seccv="${s.id}"></canvas><span class="enl" aria-hidden="true">⤢ ${t('v5.enlargeSection')}</span></button></figure>`).join('')}</div>` : `<p class="note">${t('ex.c.sectionMissing')}</p><p><button class="btn btn-small" onclick="GA.pages.close();GA.app.openArea('${a.id}')">${t('v5.drawSectionOnMap')}</button></p>`;
    }
    if (th.kind === 'research') {
      const cs = state.cards.filter(c => !c.gapOnly && c.find && c.find.length).slice(0, 8); const sugg = suggestions(state.ind);
      if (!edit) return `<div class="ap-findings">${b.findings ? `<p class="ap-sum" dir="auto">${esc(b.findings)}</p>` : ''}
          ${b.questions.length ? `<h3 class="ap-sub">${t('fb.questions')}</h3><ol class="ap-q">${b.questions.map(q => `<li dir="auto"><b>${esc(q.q || '—')}</b>${q.ev ? `<br><small>${t('fb.evidence')}: ${esc(q.ev)}</small>` : ''}${q.gap ? `<br><small class="gap">${t('fb.gap')}: ${esc(q.gap)}</small>` : ''}</li>`).join('')}</ol>` : `<p class="hint">${t('v5.researchHint')}</p>`}
          ${b.responses.length ? `<h3 class="ap-sub">${t('fb.responses')}</h3><ul class="ap-q">${b.responses.map(r => `<li dir="auto"><b>${esc(r.title || '—')}</b>${r.desc ? ` — ${esc(r.desc)}` : ''}</li>`).join('')}</ul>` : ''}
          <details class="method"><summary>${t('v5.keyFindings')}</summary><ul class="find">${cs.map(c => `<li><b>${c.title}:</b> ${c.find[0]}</li>`).join('')}</ul></details></div>`;
      return `<label class="name"><span>${t('fb.ourFindings')}</span><textarea dir="auto" rows="3" data-fb-txt="findings">${esc(b.findings || '')}</textarea></label>
        <div class="fb-rq"><h3 class="ap-sub">${t('fb.questions')}</h3>${b.questions.map((q, i) => `<div class="rq"><textarea dir="auto" rows="2" data-fb-q="${i}" data-f="q" placeholder="${esc(t('fb.qPh'))}">${esc(q.q || '')}</textarea><textarea dir="auto" rows="2" data-fb-q="${i}" data-f="ev" placeholder="${esc(t('fb.evPh'))}">${esc(q.ev || '')}</textarea><textarea dir="auto" rows="2" data-fb-q="${i}" data-f="gap" placeholder="${esc(t('fb.gapPh'))}">${esc(q.gap || '')}</textarea><button class="btn btn-tiny danger" data-fb-qdel="${i}">${t('delete')}</button></div>`).join('')}<button class="btn btn-small" data-fb="addq">${t('fb.addQ')}</button>
        ${sugg.length ? `<details class="method"><summary>${t('fb.sugg')}</summary><ul class="find">${sugg.map((s, i) => `<li>${s.q} <small>(${s.ev})</small> <button class="btn btn-tiny" data-fb-sugg="${i}">${t('fb.useSugg')}</button></li>`).join('')}</ul></details>` : ''}
        <h3 class="ap-sub">${t('fb.responses')}</h3>${b.responses.map((r, i) => `<div class="rq"><input dir="auto" data-fb-r="${i}" data-f="title" value="${esc(r.title || '')}" placeholder="${esc(t('fb.rPh'))}"><textarea dir="auto" rows="2" data-fb-r="${i}" data-f="desc">${esc(r.desc || '')}</textarea><button class="btn btn-tiny danger" data-fb-rdel="${i}">${t('delete')}</button></div>`).join('')}<button class="btn btn-small" data-fb="addr">${t('fb.addR')}</button></div>`;
    }
    if (th.kind === 'attachments') {
      return `<div id="fb-attachments">${state.lib.length ? `<div class="lib-grid">${state.lib.map(it => `<article class="lib-card" data-lib-open="${it.id}"><div class="lib-prev">${it.thumb ? `<img src="${it.thumb}" alt="">` : `<span class="lib-ico">${{ pdf: 'PDF', link: '↗', note: '¶' }[it.kind] || '·'}</span>`}</div><h4 dir="auto">${esc(it.title)}</h4></article>`).join('')}</div>` : `<p class="note">${t('fb.noAttach')}</p>`}<p><button class="btn btn-small" data-fb="attach">${t('fb.attach')}</button></p></div>`;
    }
    return '';
  }
  function suggestions(ind) { // rule-based prompts, each with the evidence it rests on — suggestions only
    const out = []; const p = (v) => v == null ? null : Math.round(v * 100) + '%';
    if (ind.canopy_mean != null && ind.gsi != null && ind.canopy_mean < 0.1 && ind.gsi > 0.35) out.push({ q: t('fb.s.heat'), ev: `${t('cmp3.canopy')} ${p(ind.canopy_mean)}, GSI ${p(ind.gsi)}` });
    if (ind.bus_sched != null && ind.places_per_km2 != null && ind.bus_sched === 0 && ind.places_per_km2 > 200) out.push({ q: t('fb.s.access'), ev: `${t('cmp3.busSched')} 0, ${t('cmp3.placesD')} ${Math.round(ind.places_per_km2)}` });
    if (ind.flood_t100_share != null && ind.flood_t100_share > 0.05) out.push({ q: t('fb.s.flood'), ev: `${t('cmp3.flood100')} ${p(ind.flood_t100_share)}` });
    if (ind.steep_share_15deg != null && ind.steep_share_15deg > 0.25) out.push({ q: t('fb.s.slope'), ev: `${t('g.steepShare')} ${p(ind.steep_share_15deg)}` });
    if (ind.places_food_share != null && ind.places_food_share > 0.3) out.push({ q: t('fb.s.tourism'), ev: `${t('cmp3.food')} ${p(ind.places_food_share)}` });
    if (ind.levels_coverage != null && ind.levels_coverage < 0.6) out.push({ q: t('fb.s.data'), ev: `${t('cmp.levelsCov')} ${p(ind.levels_coverage)}` });
    return out;
  }

  // ---------- location map: the fabric within Granada, with neighbourhoods, landmarks and the other saved fabrics ----------
  const locLegend = () => [{ line: P.red, w: 3, label: t('v5.locThis') }, { line: '#6B7077', w: 1.5, dash: true, label: t('v5.locOthers') }, { line: '#9A9EA4', w: 1, dash: true, label: t('v5.locMuni') }, { line: '#C9CBCE', w: 1, label: t('v5.locBarrios') }, { dot: '#1C1E21', label: t('v5.locLandmark') }, { line: '#4E7FA6', w: 2, label: t('v5.locRiver') }];
  let locCache = null;
  async function locData() {
    if (!locCache) locCache = Promise.all([D.single('streets_major').catch(() => null), D.single('admin').catch(() => null), D.single('water').catch(() => null)]);
    return locCache;
  }
  async function locCard(a) {
    const [maj, adm, water] = await locData(); const muni = adm && adm.features.find(f => f.properties.kind === 'municipio'); const barrios = adm ? adm.features.filter(f => f.properties.kind === 'barrio') : [];
    const others = store.get().areas.filter(x => x.id !== a.id).map(x => CMP.ringOf(x.spec)).filter(Boolean);
    const lines = (g) => g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
    const labels = barrios.map(f => ({ ll: G.centroidLL(lines(f.geometry)[0]), text: f.properties.name, kind: 'area', size: 10 })).concat(LANDMARKS.map(([n, ll]) => ({ ll, text: n })));
    return { id: 'location', title: t('v5.locTitle'), legend: locLegend(), src: { name: 'OpenStreetMap · Wikipedia (landmark positions)', detail: 'OSM extract 2026-10-23', license: 'ODbL · CC BY-SA' },
      spec: { context: { streets: maj ? maj.features.filter(x => /motorway|trunk|primary|secondary/.test(x.properties.hw)).map(x => x.geometry) : [], streetColor: '#C4C6C9' },
        layers: [{ type: 'line', items: barrios.map(f => ({ g: { type: 'MultiLineString', coordinates: lines(f.geometry) }, stroke: '#C9CBCE', width: 0.8 })) },
          { type: 'line', items: water ? water.features.filter(f => f.properties.ww === 'river').map(f => ({ g: f.geometry, stroke: '#4E7FA6', width: 1.8 })) : [] },
          { type: 'line', items: muni ? [{ g: { type: 'MultiLineString', coordinates: lines(muni.geometry) }, stroke: '#9A9EA4', width: 0.9, dash: [4, 3] }] : [] },
          { type: 'line', items: others.map(r => ({ g: { type: 'LineString', coordinates: r }, stroke: '#6B7077', width: 1.4, dash: [3, 2] })) },
          { type: 'fill', items: [{ g: { type: 'Polygon', coordinates: [CMP.ringOf(a.spec)] }, fill: P.red, alpha: 0.22 }] }],
        labels, fadeOutside: 0 } };
  }
  async function drawLoc(cv, a, w, h, ratio) {
    const card = await locCard(a); const ring = CMP.ringOf(a.spec); const c = G.centroidLL(ring); const f = MC.fit([G.square(c, 3600)], w, h, 0.02);
    GAL.drawCard(cv, { ring, style: { color: P.red, width: 3 } }, card, { center: f.center, mpp: f.mpp, w, h, ratio }); return card;
  }

  // ---------- painting (lazily, when each figure scrolls into view) ----------
  function paintAll(body, a, b) {
    const X0 = state.X; const grid = body.querySelector('.ap-grid'); const gw = grid ? grid.clientWidth : body.clientWidth;
    const cols = gw > 1100 ? 3 : gw > 640 ? 2 : 1; const cw = Math.max(240, Math.floor((gw - (cols - 1) * 28) / cols)); const ch = Math.round(cw * 0.78); const v = MC.fit([X0.ring], cw, ch, 0.06);
    const jobs = [];
    body.querySelectorAll('canvas[data-ap-cv]').forEach(cv => jobs.push([cv, () => { const c = state.cards.find(k => k.id === cv.dataset.apCv); try { GAL.drawCard(cv, { ring: X0.ring }, c, { center: v.center, mpp: v.mpp, w: cw, h: ch }); } catch (e) { } }]));
    body.querySelectorAll('canvas[data-ap-seccv]').forEach(cv => jobs.push([cv, () => { const s = (a.sections || []).find(x => x.id === cv.dataset.apSeccv); if (!s) return; SEC.compute(s, { floorH: s.floorH || 3 }).then(p => SEC.draw(cv, p, Object.assign({ w: Math.min(1400, body.clientWidth - 40), h: Math.min(560, Math.round((body.clientWidth - 40) * 0.42)) }, SEC.optsFor(s)))).catch(e => { cv.replaceWith(Object.assign(document.createElement('p'), { className: 'note', textContent: e.message })); }); }]));
    const loc = body.querySelector('#ap-loc'); if (loc) { const fw = loc.parentElement.parentElement.clientWidth || 560; drawLoc(loc, a, Math.max(280, fw), Math.max(260, Math.round(Math.max(280, fw) * 0.72)), undefined).catch(() => { }); }
    const done = new WeakSet(); const run = (cv) => { if (done.has(cv)) return; done.add(cv); const j = jobs.find(x => x[0] === cv); j && j[1](); };
    if ('IntersectionObserver' in root) { const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { rootMargin: '400px 0px' }); jobs.forEach(([cv]) => io.observe(cv)); state.io = io; }
    else jobs.forEach(([cv]) => run(cv));
    state.paintAllNow = () => jobs.forEach(([cv]) => run(cv)); state.view = { center: v.center, mpp: v.mpp };
  }
  async function loadHistory(a, body) {
    const U = state.X.ring.map(p => PJ.EPSG25830.forward(p)); const pad = 60;
    const x0 = Math.min(...U.map(p => p[0])) - pad, x1 = Math.max(...U.map(p => p[0])) + pad, y0 = Math.min(...U.map(p => p[1])) - pad, y1 = Math.max(...U.map(p => p[1])) + pad;
    const w = 640, hh = Math.round(w * (y1 - y0) / (x1 - x0)); const c = G.centroidLL(state.X.ring);
    if (!state.hist) state.hist = {};
    await Promise.all(HIST_SNAP.map(async hk => {
      const H = X.HIST.find(x => x.id === hk); const fig = body.querySelector(`[data-hist="${hk}"]`); if (!fig) return;
      try {
        if (!state.hist[hk]) { const url = `${H.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${H.layer}&STYLES=&SRS=EPSG:25830&BBOX=${[x0, y0, x1, y1].map(v => v.toFixed(1)).join(',')}&WIDTH=${w}&HEIGHT=${hh}&FORMAT=${encodeURIComponent(H.fmt)}`; const [im, info] = await Promise.all([X.loadImage(url, 40000), X.histInfo(H, c).catch(() => ({}))]); state.hist[hk] = { im, info, box: { x0, y0, x1, y1 } }; }
        const s = state.hist[hk]; const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const ctx = cv.getContext('2d'); ctx.drawImage(s.im, 0, 0);
        ctx.strokeStyle = P.red; ctx.lineWidth = 2.5; ctx.beginPath(); U.forEach((p, i) => { const q = [(p[0] - x0) / (x1 - x0) * w, (y1 - p[1]) / (y1 - y0) * hh]; i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.stroke();
        s.canvas = cv; const slot = fig.querySelector('.hist-img'); slot.innerHTML = ''; slot.appendChild(cv); slot.insertAdjacentHTML('beforeend', `<span class="enl" aria-hidden="true">⤢ ${t('v5.enlargeImage')}</span>`);
        fig.querySelector('.hist-date').textContent = histDate(H, s.info);
      } catch (e) { const slot = fig.querySelector('.hist-img'); if (slot) slot.innerHTML = `<p class="note">${esc(e.message)}</p>`; }
    }));
  }
  const histDate = (H, info) => { info = info || {}; if (H.kind === 'photo') return (info.flights && info.flights.length ? t('fb.flight') + ' ' + info.flights.filter(y => H.period.includes(y) || (y >= H.period.slice(0, 4) && y <= H.period.slice(-4))).join(', ') : '') || H.period; return (info.year ? t('fb.edition') + ' ' + info.year : H.period) + (info.sheet ? ' · ' + t('ly3.sheet') + ' ' + info.sheet : ''); };

  // ---------- interaction ----------
  async function onClick(e, body, a, b) {
    const btn = e.target.closest('button, [data-lib-open], a[data-toc]'); if (!btn) return;
    if (btn.dataset.toc) { e.preventDefault(); const el = body.querySelector('#ap-' + btn.dataset.toc); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const sec = btn.closest('[data-block]'); const k = sec && sec.dataset.block;
    if (btn.dataset.retryExt && state && state.X && state.X.retryExt) { btn.disabled = true; await state.X.retryExt(btn.dataset.retryExt); return; }
    if (btn.dataset.libOpen) return root.GA.library.openEditor(btn.dataset.libOpen);
    if (btn.dataset.ref) return root.GA.library.openRef(btn.dataset.ref);
    if (btn.dataset.apCard) { const c = state.cards.find(x => x.id === btn.dataset.apCard); return root.GA.viewer.map({ card: c, X: state.X, ring: state.X.ring, title: c.title, subtitle: a.name, slug: c.id + '_' + PG.slug(a.name) }); }
    if (btn.dataset.apLoc != null) { const card = await locCard(a); return root.GA.viewer.map({ card, X: state.X, ring: CMP.ringOf(a.spec), style: { color: P.red, width: 3 }, title: t('v5.locTitle'), subtitle: a.name, slug: 'location_' + PG.slug(a.name), mpp: null }); }
    if (btn.dataset.apChart) { const c = state.cards.find(x => x.id === btn.dataset.apChart); return root.GA.viewer.html({ title: c.title, subtitle: a.name, html: `<div class="ch-big">${GAL.chartSVG(c.chart)}</div><ul class="find">${(c.find || []).map(f => `<li>${f}</li>`).join('')}</ul>` }); }
    if (btn.dataset.apSec) return root.GA.sectionView.open(a.id, btn.dataset.apSec);
    if (btn.dataset.apHist) { const s = state.hist && state.hist[btn.dataset.apHist]; if (!s || !s.canvas) return; const H = X.HIST.find(x => x.id === btn.dataset.apHist); return root.GA.viewer.image({ title: t('hist.' + H.id), subtitle: histDate(H, s.info) + ' · IGN', src: s.canvas.toDataURL('image/jpeg', 0.92), meta: `<p class="fine">${t('fb.histNote')}</p>` }); }
    if (btn.dataset.apPhoto != null) { const p = ((a.analysis && a.analysis.result && a.analysis.result.photos) || []).filter(q => q.thumb)[+btn.dataset.apPhoto]; if (!p) return; const big = String(p.thumb).replace(/\/(\d+)px-/, '/1600px-');
      return root.GA.viewer.image({ title: p.title || '', subtitle: root.GA.dates.label(p.date), src: big, link: p.page, meta: `<dl class="kv"><div><dt>${t('v5.author')}</dt><dd dir="auto">${esc(p.author || '—')}</dd></div><div><dt>${t('v5.license')}</dt><dd dir="ltr">${esc(p.license || '—')}</dd></div><div><dt>${t(p.dateKind === 'taken' ? 'ph.taken' : 'ph.uploaded')}</dt><dd>${root.GA.dates.html(p.date)}</dd></div><div><dt>${t('v5.position')}</dt><dd>${t(p.cameraInside || p.inside ? 'fb.phInside' : 'fb.phNearby')}</dd></div></dl>` }); }
    const act = btn.dataset.fb;
    if (act === 'up' || act === 'down') { const vis = b.order; const i = vis.indexOf(k), j = i + (act === 'up' ? -1 : 1); if (j < 0 || j >= vis.length) return; vis.splice(i, 1); vis.splice(j, 0, k); store.save(); return render(body, a.id); }
    if (act === 'hide') { b.hidden = b.hidden.includes(k) ? b.hidden.filter(x => x !== k) : b.hidden.concat([k]); store.save(); return render(body, a.id); }
    if (act === 'png') { btn.disabled = true; try { const cv = await blockCanvas(k, a, b); PG.download(await PG.toBlob(cv), `analysis_${PG.slug(a.name)}_${k}.png`); } finally { btn.disabled = false; } return; }
    if (act === 'addq') { b.questions.push({ q: '', ev: '', gap: '' }); store.save(); return render(body, a.id); }
    if (act === 'addr') { b.responses.push({ title: '' }); store.save(); return render(body, a.id); }
    if (btn.dataset.fbQdel != null) { b.questions.splice(+btn.dataset.fbQdel, 1); store.save(); return render(body, a.id); }
    if (btn.dataset.fbRdel != null) { b.responses.splice(+btn.dataset.fbRdel, 1); store.save(); return render(body, a.id); }
    if (btn.dataset.fbSugg != null) { const s = suggestions(state.ind)[+btn.dataset.fbSugg]; b.questions.push({ q: s.q, ev: s.ev, gap: t('fb.suggGap'), suggested: true }); store.save(); return render(body, a.id); }
    if (act === 'attach') return attachPicker(a, body);
  }
  function onChange(e, body, a, b) {
    const el = e.target;
    if (el.dataset.fbCap) { b.captions[el.dataset.fbCap] = el.value; store.save(); }
    if (el.dataset.fbTxt) { b[el.dataset.fbTxt] = el.value; store.save(); }
    if (el.dataset.apTopic) { const [th, tp] = el.dataset.apTopic.split(':'); const off = b.off[th] || []; b.off[th] = el.checked ? off.filter(x => x !== tp) : off.concat([tp]); store.save(); render(body, a.id, true); }
    if (el.dataset.fbQ != null) { b.questions[+el.dataset.fbQ][el.dataset.f] = el.value; store.save(); }
    if (el.dataset.fbR != null) { b.responses[+el.dataset.fbR][el.dataset.f] = el.value; store.save(); }
  }
  async function attachPicker(a, body) {
    const items = await root.GA.library.list();
    const sh = root.GA.viewer.html({ title: t('fb.attach'), html: `${items.length ? items.map(it => `<label class="chk"><input type="checkbox" data-att="${it.id}" ${it.links.fabrics.includes(a.id) ? 'checked' : ''}> <bdi>${esc(it.title)}</bdi> <small>${t('lib.k.' + it.kind)}</small></label>`).join('') : `<p class="note">${t('lib.empty')}</p>`}<p><button class="btn btn-primary" id="att-ok">${t('v5.done')}</button></p>` });
    sh.el.querySelector('#att-ok').onclick = async () => { for (const x of sh.el.querySelectorAll('[data-att]')) await root.GA.library.link(x.dataset.att, 'fabrics', a.id, x.checked); sh.close(); render(body, a.id, true); };
  }
  function setEdit(on) { edit = !!on; if (state && state.body) render(state.body, state.id, true); const btn = document.getElementById('ap-edit'); if (btn) { btn.setAttribute('aria-pressed', String(edit)); btn.textContent = edit ? t('v5.doneEditing') : t('v5.editMode'); } }
  function compare(id) { const p = store.get(); p.compare = p.compare || { ids: [] }; if (!p.compare.ids.includes(id)) p.compare.ids.push(id); store.save(); PG.close(); root.GA.app && root.GA.app.openWorkspace && root.GA.app.openWorkspace('compare'); }

  // ---------- composed A3 pages for export ----------
  const DPI = 150; const A3 = [420, 297];
  async function blockCanvas(k, a, b) {
    const S = PG.sheet(A3[0], A3[1], DPI); const { cv, ctx, W, H } = S; const F = PG.font(); const rtl = I.dir() === 'rtl'; const M = 60;
    const title = k === 'identity' ? a.name : `${a.name} — ${t('v5.th.' + k)}`;
    let y = PG.header(ctx, W, title, b.captions[k] || (k === 'identity' ? (b.summary || t('v5.analysisOf')) : t('fb.boardSub')));
    const X0 = state.X; const TX = rtl ? W - M : M; const al = rtl ? 'right' : 'left';
    const text = (s, x, yy, size, maxW, lines, weight, color) => { ctx.font = `${weight || 400} ${size}px ${F}`; ctx.fillStyle = color || '#1C1E21'; ctx.textAlign = al; ctx.direction = rtl ? 'rtl' : 'ltr'; return PG.wrap(ctx, s, x, yy, maxW, size * 1.4, lines); };
    const cardPanel = (c, x, yy, w, h, mpp, center) => { if (!c || c.gapOnly) { text(c ? String(c.gapOnly).replace(/<[^>]+>/g, '') : t('nodata'), rtl ? x + w : x, yy + 30, 15, w); return; } const off = document.createElement('canvas'); GAL.drawCard(off, { ring: X0.ring }, c, { center, mpp, w, h, ratio: 1 }); ctx.drawImage(off, x, yy); ctx.font = `600 18px ${F}`; ctx.fillStyle = '#1C1E21'; ctx.textAlign = al; ctx.fillText(String(c.title).replace(/<[^>]+>/g, ''), rtl ? x + w : x, yy - 8); let z = yy + h + 22; (c.find || []).slice(0, 2).forEach(f => { z = text(String(f).replace(/<[^>]+>/g, ''), rtl ? x + w : x, z, 14, w, 3, 400, '#3C4046'); }); };
    if (k === 'identity') {
      const off = document.createElement('canvas'); await drawLoc(off, a, 1000, 860, 1); ctx.drawImage(off, rtl ? W - M - 1000 : M, y + 20);
      const tx = rtl ? W - M - 1060 : M + 1060; const tw = W - 2 * M - 1060; let yy = y + 40; const ind = state.ind;
      yy = text((X0.parsed.admin || []).map(x => x.name).reverse().join(' · '), tx, yy, 20, tw, 2, 600, '#3C4046');
      yy = text(t('fb.rationale'), tx, yy + 20, 22, tw, 1, 700); yy = text(b.rationale || '—', tx, yy + 4, 18, tw, 10);
      yy += 20; ['buildings', 'gsi', 'median_floors', 'places_per_km2', 'canopy_mean', 'bus_sched', 'flood_t100_share', 'relief_m'].forEach(key => { const row = CMP.IND_ROWS.find(r => r[0] === key); const v = row ? CMP.fmtInd(row, ind[key]) : null; yy = text(`${t(row[1]).replace(/<[^>]+>/g, '')}: ${v == null ? CMP.whyLabel((ind._why || {})[key]) : v}`, tx, yy, 17, tw, 1); });
    } else {
      const th = THEMES.find(x => x.id === k);
      if (th && th.topics) { const off2 = b.off[k] || []; const cs = th.topics.filter(tp => !off2.includes(tp)).map(id => state.cards.find(c => c.id === id)).filter(Boolean); const cols = 3, gap = 40; const pw = Math.floor((W - 2 * M - (cols - 1) * gap) / cols), ph = Math.round(pw * 0.66); const v = MC.fit([X0.ring], pw, ph, 0.06); cs.slice(0, 6).forEach((c, i) => { const col = i % cols, row = Math.floor(i / cols); const x = rtl ? W - M - (col + 1) * pw - col * gap : M + col * (pw + gap); cardPanel(c, x, y + 40 + row * (ph + 150), pw, ph, v.mpp, v.center); }); }
      else if (k === 'sections') { let yy = y + 20; for (const s of (a.sections || []).slice(0, 2)) { try { const p = await SEC.compute(s, { floorH: s.floorH || 3 }); const off = document.createElement('canvas'); SEC.draw(off, p, Object.assign({ w: W - 2 * M, h: 720, ratio: 1 }, SEC.optsFor(s))); ctx.drawImage(off, M, yy); yy += 740; } catch (e) { } } if (!(a.sections || []).length) text(t('ex.c.sectionMissing'), TX, y + 60, 20, W - 2 * M); }
      else if (k === 'history') { const ks = HIST_SNAP.filter(hk => state.hist && state.hist[hk] && state.hist[hk].canvas); const gap = 30, pw = Math.floor((W - 2 * M - 3 * gap) / 4); ks.forEach((hk, i) => { const s = state.hist[hk]; const x = rtl ? W - M - (i + 1) * pw - i * gap : M + i * (pw + gap); const ph = Math.round(pw * s.canvas.height / s.canvas.width); ctx.drawImage(s.canvas, x, y + 40, pw, ph); text(`${t('hist.' + hk)} · ${histDate(X.HIST.find(q => q.id === hk), s.info)}`, rtl ? x + pw : x, y + 60 + ph, 15, pw, 2); });
        const ph = ((a.analysis && a.analysis.result && a.analysis.result.photos) || []).filter(p => p.thumb).slice(0, 5); const pw2 = Math.floor((W - 2 * M - 4 * gap) / 5), phh = Math.round(pw2 * 0.7); for (let i = 0; i < ph.length; i++) { const p = ph[i]; const x = rtl ? W - M - (i + 1) * pw2 - i * gap : M + i * (pw2 + gap), yy = H - 160 - phh; try { const im = await new Promise((r, j) => { const q = new Image(); q.crossOrigin = 'anonymous'; q.onload = () => r(q); q.onerror = j; q.src = p.thumb; }); ctx.drawImage(im, x, yy, pw2, phh); } catch (e) { } text(`${p.author || ''} · ${p.license || ''} · ${root.GA.dates.label(p.date)}`, rtl ? x + pw2 : x, yy + phh + 20, 12, pw2, 2, 400, '#3C4046'); } }
      else if (k === 'research') { let yy = y + 30; if (b.findings) yy = text(b.findings, TX, yy, 20, W - 2 * M, 6); yy = text(t('fb.questions'), TX, yy + 16, 24, W - 2 * M, 1, 700); b.questions.forEach((q, i) => { yy = text(`${i + 1}. ${q.q}`, TX, yy + 10, 20, W - 2 * M, 3, 600); yy = text(`${t('fb.evidence')}: ${q.ev || '—'}`, TX, yy, 16, W - 2 * M, 3); yy = text(`${t('fb.gap')}: ${q.gap || '—'}`, TX, yy, 16, W - 2 * M, 2, 400, '#8A5A10'); }); yy = text(t('fb.responses'), TX, yy + 20, 24, W - 2 * M, 1, 700); b.responses.forEach(r => { yy = text(`• ${r.title}${r.desc ? ' — ' + r.desc : ''}`, TX, yy + 6, 18, W - 2 * M, 3); }); }
      else if (k === 'attachments') { const items = state.lib; let i = 0; const cols = 5, gap = 20, pw = Math.floor((W - 2 * M - 4 * gap) / cols); for (const it of items.slice(0, 15)) { const x = rtl ? W - M - (i % cols + 1) * pw - (i % cols) * gap : M + (i % cols) * (pw + gap), yy = y + 30 + Math.floor(i / cols) * (pw + 80); if (it.thumb) { try { const im = await new Promise((r, j) => { const q = new Image(); q.onload = () => r(q); q.onerror = j; q.src = it.thumb; }); ctx.drawImage(im, x, yy, pw, Math.round(pw * im.height / im.width)); } catch (e) { } } text(it.title, rtl ? x + pw : x, yy + pw + 20, 15, pw, 2, 600); i++; } if (!items.length) text(t('fb.noAttach'), TX, y + 60, 18, W - 2 * M); }
    }
    PG.footer(ctx, W, H, `Granada Atlas · ${t('fb.footer')} · ${new Date().toISOString().slice(0, 10)}`);
    return cv;
  }
  async function exportPDF(id) {
    const a = areaOf(id); const b = board(id); if (!state || state.id !== id) return; root.GA.toast && root.GA.toast(t('ex.building'));
    const keys = ['identity'].concat(b.order.filter(k => !b.hidden.includes(k)));
    const pages = []; for (const k of keys) { try { pages.push({ canvas: await blockCanvas(k, a, b), paper: 'A3L' }); } catch (e) { console.warn(k, e); } }
    const bytes = root.GA.pdf.build(pages, { title: 'Granada Atlas — ' + a.name }); PG.download(new Blob([bytes], { type: 'application/pdf' }), `analysis_${PG.slug(a.name)}.pdf`); root.GA.lastFabricPDF = { pages: pages.length };
  }

  const page = { plate: () => t('v5.analysisPlate'), title: (id) => { const a = areaOf(id); return a ? a.name : t('fb.noArea'); }, heroTitle: true, nav, afterClose: (id) => { root.GA.app && root.GA.app.openArea && root.GA.app.openArea(id); },
    actions: (id) => `<button class="btn btn-small" onclick="GA.fabric.compare('${id}')">${t('v5.compare')}</button><button class="btn btn-small" id="ap-edit" aria-pressed="${edit}" onclick="GA.fabric.setEdit(!GA.fabric.editing)">${edit ? t('v5.doneEditing') : t('v5.editMode')}</button><button class="btn btn-small btn-primary" onclick="GA.fabric.exportPDF('${id}')">${t('v5.exportPDF')}</button>`, render };
  PG.register('fabric', page); PG.register('analysis', page);
  root.GA.fabric = { exportPDF, board, blockCanvas, THEMES, setEdit, compare, get editing() { return edit; }, get state() { return state; } };
})(window);
