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
    const b = board(id); const sc = keepScroll && body.closest('#page') ? body.closest('#page').scrollTop : 0;
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
          <figcaption><ul class="lg">${locLegend().map(i => GAL.legendHTML([i]).replace(/^<ul class="lg">|<\/ul>$/g, '')).join('')}</ul>
            <label class="chk"><input type="checkbox" data-fb-locall ${b.locAll !== false ? 'checked' : ''}> ${t('v12.showAll')}</label><p class="fine" id="ap-loc-out" role="status"></p></figcaption></figure>
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
    const pgEl = body.closest('#page'); if (keepScroll && pgEl) pgEl.scrollTop = sc;
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
  /* 5.14: the current study area is the one exception to the black marks: thicker red dashes and a larger red number */
  const LOC_CUR = { color: P.red, width: 4.2, dash: [11, 6] }; const LOC_NUM = Math.round(22 * 1.36);
  const locLegend = () => [{ line: LOC_CUR.color, w: LOC_CUR.width, dash: true, label: t('v13.locCurrent') }, { line: P.mark.boundary, w: 2.2, dash: true, label: t('v13.locOthers') }, { line: GA.palette.grey, w: 1, dash: true, label: t('v5.locMuni') }, { line: GA.palette.line2, w: 1, label: t('v5.locBarrios') }, { dot: GA.palette.ink, label: t('v5.locLandmark') }, { line: GA.palette.blue, w: 2, label: t('v5.locRiver') }];
  let locCache = null;
  async function locData() {
    if (!locCache) locCache = Promise.all([D.single('streets_major').catch(() => null), D.single('admin').catch(() => null), D.single('water').catch(() => null)]);
    return locCache;
  }
  function locNumbers(a) { const all = root.GA.fabricStyle.numbered(); const cur = all.filter(x => x.id === a.id).map(x => Object.assign({}, x, { color: LOC_CUR.color, size: LOC_NUM, current: true }));
    return cur.concat(all.filter(x => x.id !== a.id).map(x => Object.assign({}, x, { color: P.mark.number }))); }
  async function locCard(a) {
    const [maj, adm, water] = await locData(); const muni = adm && adm.features.find(f => f.properties.kind === 'municipio'); const barrios = adm ? adm.features.filter(f => f.properties.kind === 'barrio') : [];
    const others = store.get().areas.filter(x => x.id !== a.id).map(x => CMP.ringOf(x.spec)).filter(Boolean);
    const lines = (g) => g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
    const labels = barrios.map(f => ({ ll: G.centroidLL(lines(f.geometry)[0]), text: f.properties.name, kind: 'area', size: 10 })).concat(LANDMARKS.map(([n, ll]) => ({ ll, text: n })));
    return { id: 'location', title: t('v5.locTitle'), legend: locLegend(), src: { name: 'OpenStreetMap · Wikipedia (landmark positions)', detail: 'OSM extract 2026-10-23', license: 'ODbL · CC BY-SA' },
      spec: { context: { streets: maj ? maj.features.filter(x => /motorway|trunk|primary|secondary/.test(x.properties.hw)).map(x => x.geometry) : [], streetColor: GA.palette.line2 },
        layers: [{ type: 'line', items: barrios.map(f => ({ g: { type: 'MultiLineString', coordinates: lines(f.geometry) }, stroke: GA.palette.line2, width: 0.8 })) },
          { type: 'line', items: water ? water.features.filter(f => f.properties.ww === 'river').map(f => ({ g: f.geometry, stroke: GA.palette.blue, width: 1.8 })) : [] },
          { type: 'line', items: muni ? [{ g: { type: 'MultiLineString', coordinates: lines(muni.geometry) }, stroke: GA.palette.grey, width: 0.9, dash: [4, 3] }] : [] },
          { type: 'line', items: others.map(r => ({ g: { type: 'LineString', coordinates: r }, stroke: '#FFFFFF', width: 4, alpha: 0.8 })) }, // white under-stroke
          { type: 'line', items: others.map(r => ({ g: { type: 'LineString', coordinates: r }, stroke: P.mark.boundary, width: 2.2, dash: [7, 4] })) }],
        /* interiors stay transparent; the current area's number is drawn last (on top) in red and larger, the others black */
        labels, fadeOutside: 0, fabricNumbers: locNumbers(a) } };
  }
  // 5.13: "Show all areas" (default on) frames every saved study area, so every boundary and number is on the map; off, the
  // map shows the 3.6 km around this area and names the areas that fall outside it (never silently dropped)
  function locFrame(a, b) { const ring = CMP.ringOf(a.spec); const c = G.centroidLL(ring); const rings = [G.square(c, 3600)];
    if (!b || b.locAll !== false) store.get().areas.forEach(x => { const r = CMP.ringOf(x.spec); if (r) rings.push(r); }); return rings; }
  function outsideFrame(a, b, f, w, h) { const out = []; root.GA.fabricStyle.numbered().forEach(x => { const U = MC.ringUTM(x.ring); const inside = U.some(p => Math.abs(p[0] - f.center[0]) <= w / 2 * f.mpp && Math.abs(p[1] - f.center[1]) <= h / 2 * f.mpp); if (!inside) out.push(x.no); }); return out; }
  async function drawLoc(cv, a, w, h, ratio) {
    const b = board(a.id); const card = await locCard(a); const ring = CMP.ringOf(a.spec); const f = MC.fit(locFrame(a, b), w, h, 0.09); // room for the numbers above the top-right corners
    GAL.drawCard(cv, { ring, style: LOC_CUR }, card, { center: f.center, mpp: f.mpp, w, h, ratio }); card.outside = outsideFrame(a, b, f, w, h); card.frame = f; return card;
  }

  // ---------- painting (lazily, when each figure scrolls into view) ----------
  function paintAll(body, a, b) {
    const X0 = state.X; const grid = body.querySelector('.ap-grid'); const gw = grid ? grid.clientWidth : body.clientWidth;
    const cols = gw > 1100 ? 3 : gw > 640 ? 2 : 1; const cw = Math.max(240, Math.floor((gw - (cols - 1) * 28) / cols)); const ch = Math.round(cw * 0.78); const v = MC.fit([X0.ring], cw, ch, 0.06);
    const jobs = [];
    body.querySelectorAll('canvas[data-ap-cv]').forEach(cv => jobs.push([cv, () => { const c = state.cards.find(k => k.id === cv.dataset.apCv); try { GAL.drawCard(cv, { ring: X0.ring }, c, { center: v.center, mpp: v.mpp, w: cw, h: ch }); } catch (e) { } }]));
    body.querySelectorAll('canvas[data-ap-seccv]').forEach(cv => jobs.push([cv, () => { const s = (a.sections || []).find(x => x.id === cv.dataset.apSeccv); if (!s) return; SEC.compute(s, { floorH: s.floorH || 3 }).then(p => SEC.draw(cv, p, Object.assign({ w: Math.min(1400, body.clientWidth - 40), h: Math.min(560, Math.round((body.clientWidth - 40) * 0.42)) }, SEC.optsFor(s)))).catch(e => { cv.replaceWith(Object.assign(document.createElement('p'), { className: 'note', textContent: e.message })); }); }]));
    const loc = body.querySelector('#ap-loc'); if (loc) { const fw = loc.parentElement.parentElement.clientWidth || 560; drawLoc(loc, a, Math.max(280, fw), Math.max(260, Math.round(Math.max(280, fw) * 0.72)), undefined).then(card => { const o = body.querySelector('#ap-loc-out'); if (o) o.textContent = card.outside && card.outside.length ? t('v12.outside', { n: card.outside.join(', ') }) : ''; }).catch(() => { }); }
    const done = new WeakSet(); const run = (cv) => { if (done.has(cv)) return; done.add(cv); const j = jobs.find(x => x[0] === cv); j && j[1](); };
    if ('IntersectionObserver' in root) { const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { rootMargin: '400px 0px' }); jobs.forEach(([cv]) => io.observe(cv)); state.io = io; }
    else jobs.forEach(([cv]) => run(cv));
    state.paintAllNow = () => jobs.forEach(([cv]) => run(cv)); state.view = { center: v.center, mpp: v.mpp };
  }
  // 5.13: historical snapshots are loaded once (also by the PDF export, which waits for them) and every image is checked:
  // IGN answers PNOA2024 and PNOA2023 over Granada with a plain white JPEG (no flight coverage — checked 3 Nov 2026), so a
  // blank image is never shown or exported as a photograph. PNOA falls back to the most recent flight that has imagery
  // here (named with its real year); any other blank or failed image becomes an explicit "image unavailable" frame.
  const PNOA_CHAIN = ['PNOA2024', 'PNOA2023', 'PNOA2022', 'PNOA2021', 'PNOA2020', 'PNOA2019'];
  function blankness(im) { // null when the pixels cannot be read (cross-origin); true when one colour / transparent
    try { const c = document.createElement('canvas'); c.width = 48; c.height = 48; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 48, 48); const d = g.getImageData(0, 0, 48, 48).data;
      let n = 0, s1 = 0, s2 = 0, a = 0; for (let i = 0; i < d.length; i += 4) { const L = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; s1 += L; s2 += L * L; a += d[i + 3]; n++; }
      const sd = Math.sqrt(Math.max(0, s2 / n - (s1 / n) * (s1 / n))); return a / n < 8 || sd < 1.5; } catch (e) { return null; }
  }
  function histBox() { const U = state.X.ring.map(p => PJ.EPSG25830.forward(p)); const pad = 60; return { U, x0: Math.min(...U.map(p => p[0])) - pad, x1: Math.max(...U.map(p => p[0])) + pad, y0: Math.min(...U.map(p => p[1])) - pad, y1: Math.max(...U.map(p => p[1])) + pad }; }
  async function loadHistOne(hk) {
    const H = X.HIST.find(x => x.id === hk); const B = histBox(); const { x0, x1, y0, y1, U } = B; const w = 640, hh = Math.round(w * (y1 - y0) / (x1 - x0)); const c = G.centroidLL(state.X.ring);
    const url = (layer) => `${H.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&STYLES=&SRS=EPSG:25830&BBOX=${[x0, y0, x1, y1].map(v => v.toFixed(1)).join(',')}&WIDTH=${w}&HEIGHT=${hh}&FORMAT=${encodeURIComponent(H.fmt)}`;
    const chain = hk === 'pnoa2024' ? PNOA_CHAIN : [H.layer]; const skipped = []; let im = null, used = null, err = null;
    for (const layer of chain) { try { const m = await X.loadImage(url(layer), 40000); if (blankness(m) === true) { skipped.push(layer); continue; } im = m; used = layer; break; } catch (e) { err = e.message; skipped.push(layer); } }
    const info = await X.histInfo(H, c).catch(() => ({}));
    const s = { info, box: { x0, y0, x1, y1 }, used, skipped, w, hh };
    if (!im) { s.unavailable = skipped.length && !err ? t('v12.histBlank', { l: skipped.join(', ') }) : t('v12.histFailed', { e: err || '—' }); return s; }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
    root.GA.fabricStyle.strokeRing(ctx, U.map(p => [(p[0] - x0) / (x1 - x0) * w, (y1 - p[1]) / (y1 - y0) * hh]), { width: 3 }); // black dashed over a white under-stroke (legible on photographs)
    s.canvas = cv; if (used !== H.layer) { s.year = used.replace(/\D/g, ''); s.note = t('v12.pnoaFallback', { y: s.year, l: skipped.join(', ') }); }
    return s;
  }
  async function ensureHistory() { if (!state.hist) state.hist = {}; await Promise.all(HIST_SNAP.map(async hk => { if (!state.hist[hk]) state.hist[hk] = loadHistOne(hk); state.hist[hk] = await state.hist[hk]; })); return state.hist; }
  async function loadHistory(a, body) {
    await ensureHistory();
    HIST_SNAP.forEach(hk => { const H = X.HIST.find(x => x.id === hk); const fig = body.querySelector(`[data-hist="${hk}"]`); if (!fig) return; const s = state.hist[hk]; const slot = fig.querySelector('.hist-img'); if (!slot) return;
      if (!s.canvas) { slot.innerHTML = `<div class="hist-na" role="note"><b>${t('v12.imgUnavailable')}</b><span>${esc(s.unavailable || '')}</span></div>`; fig.querySelector('.hist-date').textContent = histDate(H, s.info); return; }
      slot.innerHTML = ''; slot.appendChild(s.canvas); slot.insertAdjacentHTML('beforeend', `<span class="enl" aria-hidden="true">⤢ ${t('v5.enlargeImage')}</span>`);
      fig.querySelector('.hist-date').textContent = (s.year ? 'PNOA ' + s.year : histDate(H, s.info)); if (s.note) { const n = fig.querySelector('.hist-note') || fig.appendChild(Object.assign(document.createElement('p'), { className: 'fine hist-note' })); n.textContent = s.note; } });
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
    if (btn.dataset.apLoc != null) { const card = await locCard(a); return root.GA.viewer.map({ card, X: state.X, ring: CMP.ringOf(a.spec), style: LOC_CUR, fitRings: locFrame(a, board(a.id)), title: t('v5.locTitle'), subtitle: a.name, slug: 'location_' + PG.slug(a.name), mpp: null }); }
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
    if (el.dataset.fbLocall != null) { b.locAll = el.checked; store.save(); render(body, a.id, true); }
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

  // ---------- composed A3 pages for export (5.13) ----------
  // Each result map is exported as a complete panel: map at print resolution (with its scale bar, north arrow, study-area
  // boundary and number), the legend from the same card definition the map uses, units and indicators, the chart, the
  // short findings, the source and date, and the method / limits. Two panels per A3 page. Text is never below ~9 pt.
  // Sections and topics without content are omitted unless "Include empty sections" is ticked; the identity page lists
  // what was omitted and why.
  const DPI = 150; const A3 = [420, 297];
  const BE = () => root.GA.boardExport;
  function newPage(a, b, title, sub) { const S = PG.sheet(A3[0], A3[1], DPI); const y = PG.header(S.ctx, S.W, title, sub, { scale: 1.3 }); return Object.assign(S, { y: y + 26, M: 70, F: PG.font(), rtl: I.dir() === 'rtl' }); }
  function endPage(S) { PG.footer(S.ctx, S.W, S.H, `Granada Atlas · ${t('fb.footer')} · ${new Date().toISOString().slice(0, 10)} · EPSG:25830`, 1.5); return S.cv; }
  const isEmptyCard = (c) => !c || !!c.gapOnly;
  // 5.15: every map is ONE card — title, map, legend, indicators, chart, interpretation, source + method (boardExport.card).
  // Two cards per A3 page, one shared title height and one map size for the whole export, so maps align top and bottom in
  // a row and have the same dimensions on every page; a page that holds a single card keeps the same card (no sidebar).
  const GRID = { G: 70, gapTM: 8 };
  function cardOpts(S, extra) { return Object.assign({ F: S.F, rtl: S.rtl, t }, extra || {}); }
  function drawMapFor(ctx, c) { return (mx, my, mw, mh) => { const off = document.createElement('canvas'); const v = MC.fit([state.X.ring], mw / 2, mh / 2, 0.08); GAL.drawCard(off, { ring: state.X.ring }, c, { center: v.center, mpp: v.mpp, w: mw / 2, h: mh / 2, ratio: 2 }); ctx.drawImage(off, mx, my, mw, mh); }; }
  // one export-wide metric set: column width, title band, map height (the same for every card and the location map)
  function boardMetrics(cards) {
    const S = PG.sheet(A3[0], A3[1], DPI); const y0 = PG.header(S.ctx, S.W, 'Ag', 'Ag', { scale: 1.3 }) + 26; const M = 70; const F = PG.font(); const rtl = I.dir() === 'rtl';
    const cw = Math.floor((S.W - 2 * M - GRID.G) / 2); const bottom = S.H - 90; const B = BE(); const o = { F, rtl, t };
    const needs = cards.map(x => B.cardNeeds(S.ctx, x.c, cw, Object.assign({ kicker: x.kicker }, o)));
    const titleH = Math.max(90, ...needs.map(n => n.title)); const bodyMax = Math.max(0, ...needs.map(n => n.body));
    const room = bottom - y0 - titleH - GRID.gapTM; const mapH = Math.max(560, Math.min(Math.round(cw * 0.78), room - bodyMax));
    return { cw, titleH, mapH, bottom, y0, M, room };
  }
  function cardOnPage(S, x, c, kicker, Mx) {
    const B = BE(); let o = cardOpts(S, { kicker, titleH: Mx.titleH, mapH: Mx.mapH, drawMap: c && !c.gapOnly ? drawMapFor(S.ctx, c) : null });
    if (Mx.mapH + B.cardNeeds(S.ctx, c, Mx.cw, o).body > Mx.room) o = Object.assign(o, { compact: true }); // never past the page foot
    return B.card(S.ctx, c, x, S.y, Mx.cw, o);
  }
  function cardPages(a, b, queue, pages, Mx) {
    for (let i = 0; i < queue.length; i += 2) {
      const two = queue.slice(i, i + 2); const secs = [...new Set(two.map(q => q.k))];
      const S = newPage(a, b, `${a.name} — ${secs.map(k => t('v5.th.' + k)).join(' · ')}`, b.captions[secs[0]] || t('fb.boardSub'));
      two.forEach((q, j) => { const x = S.rtl ? S.W - S.M - (j + 1) * Mx.cw - j * GRID.G : S.M + j * (Mx.cw + GRID.G); const r = cardOnPage(S, x, q.c, q.kicker, Mx); S.cards = (S.cards || []).concat([{ id: q.c.id, x, w: Mx.cw, mapY: r.mapY, mapBottom: r.mapBottom, bottom: r.bottom }]); });
      pages.push({ canvas: endPage(S), k: secs[0], keys: secs, cards: S.cards });
    }
  }
  function emptyNote(S, msg) { BE().para(S.ctx, msg, S.M, S.y + 20, S.W - 2 * S.M, { size: 26, F: S.F, rtl: S.rtl, color: GA.palette.ink2 }); }
  // which parts of the board have content (empty ones are omitted by default)
  function sectionContent(k, a, b) {
    const th = THEMES.find(x => x.id === k);
    if (th && th.topics) { const off2 = b.off[k] || []; const cs = th.topics.filter(tp => !off2.includes(tp)).map(id => state.cards.find(c => c.id === id)).filter(Boolean); return { cards: cs, full: cs.filter(c => !isEmptyCard(c)), empty: cs.filter(isEmptyCard) }; }
    if (k === 'sections') return { empty: !(a.sections || []).length };
    if (k === 'research') return { empty: !(b.findings || '').trim() && !b.questions.some(q => q.q) && !b.responses.some(r => r.title) };
    if (k === 'attachments') return { empty: !(state.lib || []).length };
    return { empty: false };
  }
  async function boardPages(a, b, opts) {
    opts = opts || {}; const incEmpty = opts.includeEmpty != null ? opts.includeEmpty : !!b.pdfEmpty; const keys = opts.keys || b.order.filter(k => !b.hidden.includes(k));
    const pages = []; const omitted = [];
    // plan: which topic cards and sections go in
    const plan = keys.map(k => { const sc = sectionContent(k, a, b); const th = THEMES.find(x => x.id === k);
      if (th && th.topics) { if (!incEmpty) sc.empty.forEach(c => omitted.push(`${B_t(c.title)} — ${BE().clean(c.gapOnly)}`)); const list = incEmpty ? sc.cards : sc.full; if (!list.length) { if (!incEmpty) omitted.push(t('v5.th.' + k)); return null; } return { k, list }; }
      if (sc.empty && !incEmpty) { omitted.push(t('v5.th.' + k)); return null; } return { k, empty: sc.empty }; }).filter(Boolean);
    // one metric set for the whole export (the location map on the identity page uses the same map size)
    const allCards = []; plan.forEach(pl => { if (pl.list) pl.list.forEach(c => allCards.push({ c, k: pl.k, kicker: t('v5.th.' + pl.k) })); });
    const Mx = boardMetrics(allCards.length ? allCards : [{ c: { title: t('v5.locTitle'), legend: [] }, kicker: '' }]);
    if (!opts.keys || opts.keys.includes('identity')) pages.push(await identityPage(a, b, plan, omitted, Mx));
    let queue = []; const flush = () => { if (queue.length) cardPages(a, b, queue, pages, Mx); queue = []; };
    for (const pl of plan) { const k = pl.k; const sub = b.captions[k] || t('fb.boardSub');
      if (pl.list) { pl.list.forEach(c => queue.push({ c, k, kicker: t('v5.th.' + k) })); continue; } // consecutive map sections flow on, two cards per page
      flush();
      const S = newPage(a, b, `${a.name} — ${t('v5.th.' + k)}`, sub); const W = S.W, M = S.M, ctx = S.ctx; const B = BE(); const o = (size, extra) => Object.assign({ size, F: S.F, rtl: S.rtl }, extra || {});
      if (pl.empty) { emptyNote(S, t('v12.sectionEmpty')); pages.push({ canvas: endPage(S), k }); continue; }
      if (k === 'sections') { let first = true; for (const s of (a.sections || []).slice(0, 4)) { const P2 = first ? S : newPage(a, b, `${a.name} — ${t('v5.th.' + k)}`, s.name || sub); first = false;
          try { const p = await SEC.compute(s, { floorH: s.floorH || 3 }); const off = document.createElement('canvas'); const w = (P2.W - 2 * P2.M) / 2, h = (P2.H - 110 - P2.y) / 2; SEC.draw(off, p, Object.assign({ w, h, ratio: 2 }, SEC.optsFor(s))); P2.ctx.drawImage(off, P2.M, P2.y, w * 2, h * 2); }
          catch (e) { emptyNote(P2, t('v12.sectionFail', { e: e.message })); } pages.push({ canvas: endPage(P2), k }); } continue; }
      if (k === 'history') { await ensureHistory(); const gap = 40, cols = 4, pw = Math.floor((W - 2 * M - (cols - 1) * gap) / cols); let maxBottom = S.y;
        HIST_SNAP.forEach((hk, i) => { const s = state.hist[hk] || {}; const Hh = X.HIST.find(q => q.id === hk); const x = S.rtl ? W - M - (i + 1) * pw - i * gap : M + i * (pw + gap); const ph = s.canvas ? Math.round(pw * s.canvas.height / s.canvas.width) : Math.round(pw * 0.8);
          if (s.canvas) ctx.drawImage(s.canvas, x, S.y, pw, ph); else B.unavailable(ctx, x, S.y, pw, ph, t('v12.imgUnavailable'), s.unavailable || t('v12.histFailed', { e: '—' }), o(20));
          let yy = B.para(ctx, t('hist.' + hk), x, S.y + ph + 8, pw, o(24, { weight: 700, lines: 2 })); yy = B.para(ctx, s.year ? 'PNOA ' + s.year : histDate(Hh, s.info), x, yy, pw, o(21, { lines: 2 })); if (s.note) yy = B.para(ctx, s.note, x, yy, pw, o(19, { lines: 4, color: GA.palette.ink3 }));
          yy = B.para(ctx, 'IGN · CC BY 4.0', x, yy, pw, o(19, { color: GA.palette.ink3 })); maxBottom = Math.max(maxBottom, yy); });
        B.para(ctx, t('fb.histNote'), M, maxBottom + 16, W - 2 * M, o(20, { lines: 3, color: GA.palette.ink2 }));
        const ph = ((a.analysis && a.analysis.result && a.analysis.result.photos) || []).filter(p => p.thumb).slice(0, 5); const pw2 = Math.floor((W - 2 * M - 4 * 30) / 5), phh = Math.round(pw2 * 0.66); const py = S.H - 110 - phh - 70;
        if (ph.length && py > maxBottom + 90) for (let i = 0; i < ph.length; i++) { const p = ph[i]; const x = S.rtl ? W - M - (i + 1) * pw2 - i * 30 : M + i * (pw2 + 30); try { const im = await new Promise((r, j) => { const q = new Image(); q.crossOrigin = 'anonymous'; q.onload = () => r(q); q.onerror = j; q.src = p.thumb; }); PG.drawImageFit(ctx, im, x, py, pw2, phh, true); } catch (e) { B.unavailable(ctx, x, py, pw2, phh, t('v12.imgUnavailable'), '', o(19)); } B.para(ctx, `${p.author || ''} · ${p.license || ''} · ${root.GA.dates.label(p.date)}`, x, py + phh + 4, pw2, o(19, { lines: 2, color: GA.palette.ink2 })); }
        pages.push({ canvas: endPage(S), k }); continue; }
      if (k === 'research') { let yy = S.y; const w = W - 2 * M; if (b.findings) yy = B.para(ctx, b.findings, M, yy, w, o(24, { lines: 8 })); yy = B.para(ctx, t('fb.questions'), M, yy + 20, w, o(30, { weight: 700 }));
        b.questions.filter(q => q.q).forEach((q, i) => { yy = B.para(ctx, `${i + 1}. ${q.q}`, M, yy + 10, w, o(25, { weight: 600, lines: 3 })); yy = B.para(ctx, `${t('fb.evidence')}: ${q.ev || '—'}`, M, yy, w, o(22, { lines: 3 })); yy = B.para(ctx, `${t('fb.gap')}: ${q.gap || '—'}`, M, yy, w, o(22, { lines: 2, color: GA.palette.ink2 })); });
        if (b.responses.some(r => r.title)) { yy = B.para(ctx, t('fb.responses'), M, yy + 24, w, o(30, { weight: 700 })); b.responses.filter(r => r.title).forEach(r => { yy = B.para(ctx, `• ${r.title}${r.desc ? ' — ' + r.desc : ''}`, M, yy + 6, w, o(23, { lines: 3 })); }); }
        pages.push({ canvas: endPage(S), k }); continue; }
      if (k === 'attachments') { const items = state.lib; const cols = 5, gap = 30, pw = Math.floor((W - 2 * M - 4 * gap) / cols); let i = 0;
        for (const it of items.slice(0, 10)) { const x = S.rtl ? W - M - (i % cols + 1) * pw - (i % cols) * gap : M + (i % cols) * (pw + gap), yy = S.y + Math.floor(i / cols) * (pw * 0.75 + 130); if (it.thumb) { try { const im = await new Promise((r, j) => { const q = new Image(); q.onload = () => r(q); q.onerror = j; q.src = it.thumb; }); PG.drawImageFit(ctx, im, x, yy, pw, pw * 0.75, true); } catch (e) { } } B.para(ctx, it.title, x, yy + pw * 0.75 + 4, pw, o(21, { weight: 600, lines: 2 })); i++; }
        pages.push({ canvas: endPage(S), k }); continue; }
    }
    flush();
    return pages;
  }
  const B_t = (s) => BE().clean(s);
  // identity page: the location map as a card (title, map, legend, notes, source — the same card and map size as every
  // other map) in the first column; the area's description and key indicators as a text card in the second column
  async function identityPage(a, b, plan, omitted, Mx) {
    const S = newPage(a, b, a.name, b.summary || t('v5.analysisOf')); const { ctx, W, M, F, rtl } = S; const B = BE(); const o = (size, extra) => Object.assign({ size, F, rtl }, extra || {});
    const cw = Mx.cw; const mx = rtl ? W - M - cw : M; let card = null;
    const loc = { title: t('v5.locTitle'), legend: [], src: null }; const off = document.createElement('canvas'); card = await drawLoc(off, a, cw / 2, Mx.mapH / 2, 2);
    Object.assign(loc, { legend: card.legend, src: card.src, notes: card.outside && card.outside.length ? [t('v12.outside', { n: card.outside.join(', ') })] : [] });
    const rr = B.card(ctx, loc, mx, S.y, cw, cardOpts(S, { kicker: a.name, titleH: Mx.titleH, mapH: Mx.mapH, drawMap: (x, y, w, h) => ctx.drawImage(off, x, y, w, h) }));
    S.cards = [{ id: 'location', x: mx, w: cw, mapY: rr.mapY, mapBottom: rr.mapBottom, bottom: rr.bottom }];
    const tx = rtl ? M : W - M - cw, tw = cw; let yy = B.cardTitle(ctx, { title: t('fb.rationale') }, tx, S.y, tw, cardOpts(S, { kicker: (state.X.parsed.admin || []).map(x => x.name).reverse().join(' · ') })); yy = Math.max(yy, S.y + Mx.titleH) + 8;
    const ind = state.ind;
    yy = B.para(ctx, b.rationale || '—', tx, yy, tw, o(22, { lines: 8 }));
    yy = B.para(ctx, t('v12.keyInd'), tx, yy + 22, tw, o(26, { weight: 700 }));
    ['buildings', 'gsi', 'median_floors', 'places_per_km2', 'canopy_mean', 'bus_sched', 'flood_t100_share', 'relief_m'].forEach(key => { const row = CMP.IND_ROWS.find(r => r[0] === key); if (!row) return; const v = CMP.fmtInd(row, ind[key]); yy = B.para(ctx, `${B.clean(t(row[1]))}: ${v == null ? CMP.whyLabel((ind._why || {})[key]) : B.clean(v)}`, tx, yy + 2, tw, o(22, { lines: 2 })); });
    yy = B.para(ctx, t('v12.contents'), tx, yy + 22, tw, o(26, { weight: 700 })); yy = B.para(ctx, plan.map(p => t('v5.th.' + p.k)).join(' · ') || '—', tx, yy + 2, tw, o(22, { lines: 4 }));
    if (omitted.length) { yy = B.para(ctx, t('v12.omitted'), tx, yy + 18, tw, o(24, { weight: 700, color: GA.palette.ink2 })); omitted.slice(0, 10).forEach(m => { yy = B.para(ctx, '• ' + m, tx, yy + 2, tw, o(19, { lines: 2, color: GA.palette.ink3 })); }); }
    return { canvas: endPage(S), k: 'identity', cards: S.cards };
  }
  // one section as an image (the PNG button): all its pages, stacked (a section never loses its third map)
  async function blockCanvas(k, a, b) { if (k === 'identity') { const p = await boardPages(a, b, { keys: ['identity'] }); return p[0].canvas; } const pages = await boardPages(a, b, { keys: [k], includeEmpty: true });
    if (pages.length <= 1) return (pages[0] || {}).canvas; const W = pages[0].canvas.width, H = pages.reduce((s2, p) => s2 + p.canvas.height, 0); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); let y = 0; pages.forEach(p => { g.drawImage(p.canvas, 0, y); y += p.canvas.height; }); return cv; }
  async function exportPDF(id, opts) {
    const a = areaOf(id); const b = board(id); if (!state || state.id !== id) return; root.GA.toast && root.GA.toast(t('ex.building'));
    if (state.paintAllNow) state.paintAllNow(); await ensureHistory().catch(() => { }); // export readiness: every image loaded (or explicitly unavailable)
    const pages = (await boardPages(a, b, opts)).map(p => ({ canvas: p.canvas, paper: 'A3L' }));
    const bytes = root.GA.pdf.build(pages, { title: 'Granada Atlas — ' + a.name }); PG.download(new Blob([bytes], { type: 'application/pdf' }), `analysis_${PG.slug(a.name)}.pdf`); root.GA.lastFabricPDF = { pages: pages.length, bytes };
  }
  function setIncludeEmpty(id, on) { const b = board(id); b.pdfEmpty = !!on; store.save(); }

  const page = { plate: () => t('v5.analysisPlate'), title: (id) => { const a = areaOf(id); return a ? a.name : t('fb.noArea'); }, heroTitle: true, nav, afterClose: (id) => { root.GA.app && root.GA.app.openArea && root.GA.app.openArea(id); },
    actions: (id) => `<button class="btn btn-small" onclick="GA.fabric.compare('${id}')">${t('v5.compare')}</button><button class="btn btn-small" id="ap-edit" aria-pressed="${edit}" onclick="GA.fabric.setEdit(!GA.fabric.editing)">${edit ? t('v5.doneEditing') : t('v5.editMode')}</button><label class="chk ap-empty"><input type="checkbox" ${board(id).pdfEmpty ? 'checked' : ''} onchange="GA.fabric.setIncludeEmpty('${id}', this.checked)"> ${t('v12.includeEmpty')}</label><button class="btn btn-small btn-primary" onclick="GA.fabric.exportPDF('${id}')">${t('v5.exportPDF')}</button>`, render };
  PG.register('fabric', page); PG.register('analysis', page);
  root.GA.fabric = { exportPDF, boardPages, setIncludeEmpty, ensureHistory, board, blockCanvas, THEMES, setEdit, compare, get editing() { return edit; }, get state() { return state; } };
})(window);
