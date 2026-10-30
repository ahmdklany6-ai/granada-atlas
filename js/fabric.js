/* A persistent research board for each urban fabric (each saved study area): identity,
   coordinated thematic maps at one shared scale, findings, photographs, sections, historical
   development (IGN maps and orthophotos of the exact extent), climate and environment,
   research questions and design responses, and attached material from General Information.
   Blocks can be reordered and hidden, captions edited, and the board exported as a composed
   A3 PDF or as individual images. Stored in the project (this browser). */
(function (root) {
  const { i18n: I, pages: PG, gallery: GAL, mapcard: MC, compare: CMP, section: SEC, ext: X, store, data: D, geo: G, proj: PJ, palette: P } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc; const nf = PG.nf;
  const BLOCKS = ['identity', 'maps', 'findings', 'photos', 'sections', 'history', 'climate', 'research', 'attachments'];
  const DEF_TOPICS = ['fg', 'heights', 'streets', 'landuse', 'places', 'trees'];
  const HIST_SNAP = ['mtn50', 'ams56', 'inter7386', 'pnoa2024'];
  const board = (id) => { const p = store.get(); p.fabrics = p.fabrics || {}; const b = p.fabrics[id] = p.fabrics[id] || {}; b.order = (b.order || BLOCKS.slice()).filter(k => BLOCKS.includes(k)); BLOCKS.forEach(k => { if (!b.order.includes(k)) b.order.push(k); }); b.hidden = b.hidden || []; b.captions = b.caption || b.captions || {}; b.topics = b.topics || DEF_TOPICS.slice(); b.questions = b.questions || []; b.responses = b.responses || []; return b; };
  const areaOf = (id) => store.get().areas.find(a => a.id === id);
  let state = null; // {id, X, cards, view, hist, lib}

  function nav(id) { const A = store.get().areas; return A.map(a => `<button class="${a.id === id ? 'on' : ''}" onclick="GA.pages.go('fabric','${a.id}')"><bdi>${esc(a.name)}</bdi></button>`).join(''); }
  async function render(body, id) {
    const a = areaOf(id); if (!a) { body.innerHTML = `<p class="lead">${t('fb.noArea')}</p>`; return; }
    const b = board(id); body.innerHTML = `<div class="loading"><span class="spin"></span>${t('ws.computing')}</div>`;
    const X0 = await CMP.prepare(a); const cards = GAL.cards({ ring: X0.ring }, X0.parsed, X0.R, { dem: X0.dem, slope: X0.slope, contours: X0.contours, ext: X0.ext });
    const lib = root.GA.library ? await root.GA.library.byLink('fabrics', id) : [];
    state = { id, X: X0, cards, lib, hist: state && state.id === id ? state.hist : null };
    const ind = CMP.indicators(X0);
    let h = `<p class="fine">${t('fb.lead')}</p>`;
    b.order.forEach((k, i) => {
      const hid = b.hidden.includes(k);
      h += `<section class="fb-block ${hid ? 'is-hidden' : ''}" data-block="${k}"><header><h3>${t('fb.b.' + k)}</h3><div class="card-tools"><button class="icon-btn" data-fb="up" ${i === 0 ? 'disabled' : ''} title="${esc(t('ly.up'))}">↑</button><button class="icon-btn" data-fb="down" ${i === b.order.length - 1 ? 'disabled' : ''} title="${esc(t('ly.down'))}">↓</button><button class="icon-btn" data-fb="hide" title="${esc(t(hid ? 'fb.show' : 'fb.hide'))}">${hid ? '◌' : '◉'}</button><button class="icon-btn" data-fb="png" title="${esc(t('g.png'))}">↓</button></div></header>`;
      if (!hid) h += `<div class="fb-content" id="fb-${k}">${blockHTML(k, a, b, ind)}</div><label class="fb-cap"><span>${t('fb.caption')}</span><textarea dir="auto" rows="2" data-fb-cap="${k}" placeholder="${esc(t('fb.captionPh'))}">${esc(b.captions[k] || '')}</textarea></label>`;
      h += `</section>`;
    });
    body.innerHTML = h;
    paintCanvases(body, a, b);
    body.onclick = (e) => onClick(e, body, a, b); body.onchange = (e) => onChange(e, body, a, b);
    if (!b.hidden.includes('history')) loadHistory(a, body);
  }
  const kpi = (rows) => `<dl class="kpi">${rows.map(r => `<div><dt>${r[0]}</dt><dd>${r[1] == null ? `<em class="missing">${t('nodata')}</em>` : r[1]}</dd></div>`).join('')}</dl>`;
  const fmt = (ind, k) => { const row = CMP.IND_ROWS.find(r => r[0] === k); return row ? CMP.fmtInd(row, ind[k]) : null; };
  function blockHTML(k, a, b, ind) {
    const X0 = state.X;
    if (k === 'identity') {
      const adm = (X0.parsed.admin || []).map(x => x.name); const c = G.centroidLL(X0.ring); const u = PJ.EPSG25830.forward(c);
      return `<div class="fb-id"><canvas id="fb-loc"></canvas><div><table class="tbl small"><tr><th>${t('fb.where')}</th><td dir="auto">${esc(adm.slice().reverse().join(' · ') || '—')}</td></tr><tr><th>${t('fb.centre')}</th><td><span dir="ltr" class="mono">${c[1].toFixed(5)}, ${c[0].toFixed(5)}</span><br><small dir="ltr">EPSG:25830 ${nf(u[0])} E, ${nf(u[1])} N</small></td></tr><tr><th>${t('fb.shape')}</th><td>${esc(t('shape.' + (a.spec.type === 'polygon' ? 'polygonShort' : a.spec.type)))} · ${root.GA.report.fmtArea(a.measures.area)} · ${root.GA.report.fmtLen(a.measures.perimeter)}</td></tr></table>
        ${kpi([[t('b.count'), fmt(ind, 'buildings')], [t('b.gsi'), fmt(ind, 'gsi')], [t('g.medianFloors'), fmt(ind, 'median_floors')], [t('cmp3.placesD'), fmt(ind, 'places_per_km2')], [t('cmp3.canopy'), fmt(ind, 'canopy_mean')], [t('cmp3.busSched'), fmt(ind, 'bus_sched')], [t('cmp3.flood100'), fmt(ind, 'flood_t100_share')], [t('g.relief'), fmt(ind, 'relief_m')], [t('cmp3.trees'), fmt(ind, 'trees_mapped')]])}
        <label class="name"><span>${t('fb.rationale')}</span><textarea dir="auto" rows="3" data-fb-txt="rationale" placeholder="${esc(t('fb.rationalePh'))}">${esc(b.rationale || ((store.get().ex12 || {}).fabrics || {})[a.id]?.just || '')}</textarea></label>
        <label class="name"><span>${t('fb.summary')}</span><textarea dir="auto" rows="2" data-fb-txt="summary" placeholder="${esc(t('fb.summaryPh'))}">${esc(b.summary || ((store.get().ex12 || {}).fabrics || {})[a.id]?.sentence || '')}</textarea></label></div></div>`;
    }
    if (k === 'maps') {
      const ALL = CMP.ALL_TOPICS;
      return `<div class="ws-pick">${ALL.map(tp => `<label><input type="checkbox" data-fb-topic="${tp}" ${b.topics.includes(tp) ? 'checked' : ''}> ${t('g.' + tp) !== 'g.' + tp ? t('g.' + tp) : t('g3.' + tp)}</label>`).join('')}</div><p class="fine">${t('fb.sameScale')}</p><div class="fb-maps">${b.topics.map(tp => { const c = state.cards.find(x => x.id === tp); if (!c) return ''; return c.gapOnly ? `<div class="fb-map gap"><h4>${c.title}</h4><p class="note">${c.gapOnly}</p></div>` : `<figure class="fb-map"><h4>${c.title}</h4><canvas data-fb-card="${tp}"></canvas>${GAL.legendHTML(c.legend || [])}<figcaption><small>${esc(c.src.name)} · <span dir="ltr">${esc(c.src.detail)}</span></small></figcaption></figure>`; }).join('')}</div>`;
    }
    if (k === 'findings') {
      const cs = state.cards.filter(c => b.topics.includes(c.id) && !c.gapOnly);
      return `<div class="fb-find">${cs.map(c => `<div class="fb-f"><h4>${c.title}</h4>${GAL.chartSVG(c.chart)}<ul class="find">${(c.find || []).slice(0, 2).map(f => `<li>${f}</li>`).join('')}</ul></div>`).join('')}</div><label class="name"><span>${t('fb.ourFindings')}</span><textarea dir="auto" rows="3" data-fb-txt="findings">${esc(b.findings || '')}</textarea></label><p class="fine">${t('cmp.noCause')}</p>`;
    }
    if (k === 'photos') {
      const ph = ((a.analysis && a.analysis.result && a.analysis.result.photos) || []).filter(p => p.thumb).slice(0, 12);
      const libI = state.lib.filter(it => it.kind === 'image' && it.thumb);
      return (ph.length || libI.length) ? `<div class="fb-photos">${ph.map(p => `<figure><img src="${esc(p.thumb)}" crossorigin="anonymous" alt="" loading="lazy"><figcaption><small dir="auto">${esc(p.author || '')} · ${esc(p.license || '')} · <span dir="ltr">${esc((p.date || '').slice(0, 10))}</span> · ${t(p.cameraInside || p.inside ? 'fb.phInside' : 'fb.phNearby')}</small> <a href="${esc(p.page)}" target="_blank" rel="noopener">Commons ↗</a></figcaption></figure>`).join('')}${libI.map(it => `<figure><img src="${it.thumb}" alt=""><figcaption><small dir="auto">${esc(it.title)} · ${esc(it.source || t('lib.ours'))}</small></figcaption></figure>`).join('')}</div>` : `<p class="note">${t('fb.noPhotos')}</p>`;
    }
    if (k === 'sections') { const S = a.sections || []; return S.length ? S.map(s => `<figure class="fb-sec"><canvas data-fb-sec="${s.id}"></canvas><figcaption><bdi>${esc(s.name)}</bdi></figcaption></figure>`).join('') : `<p class="note">${t('ex.c.sectionMissing')}</p>`; }
    if (k === 'history') {
      const per = state.cards.find(c => c.id === 'periods');
      return `<div class="fb-hist" id="fb-hist">${HIST_SNAP.map(hk => `<figure data-hist="${hk}"><div class="hist-img"><span class="spin"></span></div><figcaption>${t('hist.' + hk)} <small class="hist-date"></small></figcaption></figure>`).join('')}</div><p class="fine">${t('fb.histNote')}</p>${per && !per.gapOnly ? `<div class="fb-map"><h4>${per.title}</h4><canvas data-fb-card="periods"></canvas>${GAL.legendHTML(per.legend)}<ul class="find">${per.find.map(f => `<li>${f}</li>`).join('')}</ul></div>` : ''}${state.lib.filter(it => it.links.themes.includes('history')).map(it => `<p>▸ <button class="link" data-lib-open="${it.id}">${esc(it.title)}</button></p>`).join('')}`;
    }
    if (k === 'climate') {
      const cl = a.analysis && a.analysis.result && a.analysis.result.climate;
      const cs = ['trees', 'flood', 'noise'].map(id => state.cards.find(c => c.id === id)).filter(Boolean);
      return `<div class="fb-maps">${cs.map(c => c.gapOnly ? `<div class="fb-map gap"><h4>${c.title}</h4><p class="note">${c.gapOnly}</p></div>` : `<figure class="fb-map"><h4>${c.title}</h4><canvas data-fb-card="${c.id}"></canvas>${GAL.legendHTML(c.legend || [])}<ul class="find">${(c.find || []).slice(0, 2).map(f => `<li>${f}</li>`).join('')}</ul></figure>`).join('')}</div>
        ${cl ? `<p class="fine">${t('fb.era5', { y: cl.year, h: nf(cl.hot35), n: nf(cl.trop20) })}</p>` : ''}<p class="fine">${t('fb.heatRef')} <button class="btn btn-tiny" data-ref="heat">${t('ref.view')}</button></p>`;
    }
    if (k === 'research') {
      const sugg = suggestions(ind);
      return `<div class="fb-rq"><h4>${t('fb.questions')}</h4>${b.questions.map((q, i) => `<div class="rq"><textarea dir="auto" rows="2" data-fb-q="${i}" data-f="q" placeholder="${esc(t('fb.qPh'))}">${esc(q.q || '')}</textarea><textarea dir="auto" rows="2" data-fb-q="${i}" data-f="ev" placeholder="${esc(t('fb.evPh'))}">${esc(q.ev || '')}</textarea><textarea dir="auto" rows="1" data-fb-q="${i}" data-f="gap" placeholder="${esc(t('fb.gapPh'))}">${esc(q.gap || '')}</textarea><button class="btn btn-tiny danger" data-fb-qdel="${i}">${t('delete')}</button></div>`).join('')}<button class="btn btn-small" data-fb="addq">${t('fb.addQ')}</button>
        ${sugg.length ? `<details class="method"><summary>${t('fb.sugg')}</summary><ul class="find">${sugg.map((s, i) => `<li>${s.q} <small>(${s.ev})</small> <button class="btn btn-tiny" data-fb-sugg="${i}">${t('fb.useSugg')}</button></li>`).join('')}</ul><p class="fine">${t('fb.suggNote')}</p></details>` : ''}
        <h4>${t('fb.responses')}</h4>${b.responses.map((r, i) => `<div class="rq"><input dir="auto" data-fb-r="${i}" data-f="title" value="${esc(r.title || '')}" placeholder="${esc(t('fb.rPh'))}"><textarea dir="auto" rows="2" data-fb-r="${i}" data-f="desc" placeholder="${esc(t('fb.rDescPh'))}">${esc(r.desc || '')}</textarea><div class="row3"><input dir="auto" data-fb-r="${i}" data-f="who" value="${esc(r.who || '')}" placeholder="${esc(t('fb.whoPh'))}"><input dir="auto" data-fb-r="${i}" data-f="limits" value="${esc(r.limits || '')}" placeholder="${esc(t('fb.limitsPh'))}"><input dir="auto" data-fb-r="${i}" data-f="ind" value="${esc(r.ind || '')}" placeholder="${esc(t('fb.indPh'))}"></div><button class="btn btn-tiny danger" data-fb-rdel="${i}">${t('delete')}</button></div>`).join('')}<button class="btn btn-small" data-fb="addr">${t('fb.addR')}</button><p class="fine">${t('fb.designNote')}</p></div>`;
    }
    if (k === 'attachments') {
      return `${state.lib.length ? `<div class="lib-grid">${state.lib.map(it => `<article class="lib-card" data-lib-open="${it.id}"><div class="lib-prev">${it.thumb ? `<img src="${it.thumb}" alt="">` : `<span class="lib-ico">${{ pdf: 'PDF', link: '↗', note: '¶' }[it.kind] || '•'}</span>`}</div><div class="lib-meta"><h4 dir="auto">${esc(it.title)}</h4><small dir="auto">${esc(it.source || '')}</small></div></article>`).join('')}</div>` : `<p class="note">${t('fb.noAttach')}</p>`}<div class="actions"><button class="btn btn-small" data-fb="attach">${t('fb.attach')}</button><button class="btn btn-small" onclick="GA.pages.go('library')">${t('lib.title2')} →</button></div>`;
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
  function sharedView(w, h) { return MC.fit([state.X.ring], w, h, 0.06); }
  function paintCanvases(body, a, b) {
    const X0 = state.X; const cw = Math.min(330, Math.max(240, Math.floor((body.clientWidth - 60) / 3))); const ch = Math.round(cw * 0.82); const v = sharedView(cw, ch);
    body.querySelectorAll('canvas[data-fb-card]').forEach(cv => { const c = state.cards.find(k => k.id === cv.dataset.fbCard); try { GAL.drawCard(cv, { ring: X0.ring }, c, { center: v.center, mpp: v.mpp, w: cw, h: ch }); } catch (e) { } });
    body.querySelectorAll('canvas[data-fb-sec]').forEach(cv => { const s = (a.sections || []).find(x => x.id === cv.dataset.fbSec); if (!s) return; SEC.compute(s, { floorH: s.floorH || 3 }).then(p => SEC.draw(cv, p, { w: Math.min(900, body.clientWidth - 40), h: 330, ve: s.ve || 'auto', floors: !!s.floors })).catch(() => { }); });
    const loc = body.querySelector('#fb-loc'); if (loc) locator(loc, 300, 260, 1);
  }
  async function locator(cv, w, h, ratio) {
    const [maj, adm] = await Promise.all([D.single('streets_major').catch(() => null), D.single('admin').catch(() => null)]);
    const muni = adm && adm.features.find(f => f.properties.kind === 'municipio'); const ring = state.X.ring;
    const c = G.centroidLL(ring); const box = G.square(c, 6000); const f = MC.fit([box], w, h, 0.02);
    const r = MC.render(cv, { center: f.center, mpp: f.mpp, w, h, ratio, context: { streets: maj ? maj.features.filter(x => /motorway|trunk|primary|secondary/.test(x.properties.hw)).map(x => x.geometry) : [], streetColor: '#B9BBBE' }, layers: muni ? [{ type: 'line', items: [{ g: { type: 'MultiLineString', coordinates: muni.geometry.type === 'Polygon' ? muni.geometry.coordinates : muni.geometry.coordinates.flat() }, stroke: '#9A9EA4', width: 0.8, dash: [4, 3] }] }] : [], ring, areaStyle: { color: P.red, width: 2.5 }, fadeOutside: 0 });
    return r;
  }
  async function loadHistory(a, body) {
    const U = state.X.ring.map(p => PJ.EPSG25830.forward(p)); const pad = 60;
    const x0 = Math.min(...U.map(p => p[0])) - pad, x1 = Math.max(...U.map(p => p[0])) + pad, y0 = Math.min(...U.map(p => p[1])) - pad, y1 = Math.max(...U.map(p => p[1])) + pad;
    const w = 520, hh = Math.round(w * (y1 - y0) / (x1 - x0)); const c = G.centroidLL(state.X.ring);
    if (!state.hist) state.hist = {};
    for (const hk of HIST_SNAP) {
      const H = X.HIST.find(x => x.id === hk); const fig = body.querySelector(`[data-hist="${hk}"]`); if (!fig) continue;
      try {
        if (!state.hist[hk]) { const url = `${H.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${H.layer}&STYLES=&SRS=EPSG:25830&BBOX=${[x0, y0, x1, y1].map(v => v.toFixed(1)).join(',')}&WIDTH=${w}&HEIGHT=${hh}&FORMAT=${encodeURIComponent(H.fmt)}`; const [im, info] = await Promise.all([X.loadImage(url, 40000), X.histInfo(H, c).catch(() => ({}))]); state.hist[hk] = { im, info, box: { x0, y0, x1, y1 } }; }
        const s = state.hist[hk]; const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; const ctx = cv.getContext('2d'); ctx.drawImage(s.im, 0, 0);
        ctx.strokeStyle = P.red; ctx.lineWidth = 2; ctx.beginPath(); U.forEach((p, i) => { const q = [(p[0] - x0) / (x1 - x0) * w, (y1 - p[1]) / (y1 - y0) * hh]; i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.stroke();
        const slot = fig.querySelector('.hist-img'); slot.innerHTML = ''; cv.style.maxWidth = '100%'; slot.appendChild(cv);
        fig.querySelector('.hist-date').textContent = histDate(H, s.info);
      } catch (e) { const slot = fig.querySelector('.hist-img'); if (slot) slot.innerHTML = `<p class="note">${esc(e.message)}</p>`; }
    }
  }
  const histDate = (H, info) => { info = info || {}; if (H.kind === 'photo') return (info.flights && info.flights.length ? t('fb.flight') + ' ' + info.flights.filter(y => H.period.includes(y) || (y >= H.period.slice(0, 4) && y <= H.period.slice(-4))).join(', ') : '') || H.period; return (info.year ? t('fb.edition') + ' ' + info.year : H.period) + (info.sheet ? ' · ' + t('ly3.sheet') + ' ' + info.sheet : ''); };

  async function onClick(e, body, a, b) {
    const btn = e.target.closest('button, [data-lib-open]'); if (!btn) return; const sec = btn.closest('[data-block]'); const k = sec && sec.dataset.block;
    if (btn.dataset.libOpen) return root.GA.library.openEditor(btn.dataset.libOpen);
    if (btn.dataset.ref) return root.GA.library.openRef(btn.dataset.ref);
    const act = btn.dataset.fb;
    if (act === 'up' || act === 'down') { const i = b.order.indexOf(k), j = i + (act === 'up' ? -1 : 1); b.order.splice(i, 1); b.order.splice(j, 0, k); store.save(); return render(body, a.id); }
    if (act === 'hide') { b.hidden = b.hidden.includes(k) ? b.hidden.filter(x => x !== k) : b.hidden.concat([k]); store.save(); return render(body, a.id); }
    if (act === 'png') { btn.disabled = true; try { const cv = await blockCanvas(k, a, b); PG.download(await PG.toBlob(cv), `fabric_${PG.slug(a.name)}_${k}.png`); } finally { btn.disabled = false; } return; }
    if (act === 'addq') { b.questions.push({ q: '', ev: '', gap: '' }); store.save(); return render(body, a.id); }
    if (act === 'addr') { b.responses.push({ title: '' }); store.save(); return render(body, a.id); }
    if (btn.dataset.fbQdel != null) { b.questions.splice(+btn.dataset.fbQdel, 1); store.save(); return render(body, a.id); }
    if (btn.dataset.fbRdel != null) { b.responses.splice(+btn.dataset.fbRdel, 1); store.save(); return render(body, a.id); }
    if (btn.dataset.fbSugg != null) { const s = suggestions(CMP.indicators(state.X))[+btn.dataset.fbSugg]; b.questions.push({ q: s.q, ev: s.ev, gap: t('fb.suggGap'), suggested: true }); store.save(); return render(body, a.id); }
    if (act === 'attach') return attachPicker(a, body);
  }
  function onChange(e, body, a, b) {
    const el = e.target;
    if (el.dataset.fbCap) { b.captions[el.dataset.fbCap] = el.value; store.save(); }
    if (el.dataset.fbTxt) { b[el.dataset.fbTxt] = el.value; store.save(); }
    if (el.dataset.fbTopic) { b.topics = el.checked ? CMP.ALL_TOPICS.filter(x => b.topics.includes(x) || x === el.dataset.fbTopic) : b.topics.filter(x => x !== el.dataset.fbTopic); store.save(); render(body, a.id); }
    if (el.dataset.fbQ != null) { b.questions[+el.dataset.fbQ][el.dataset.f] = el.value; store.save(); }
    if (el.dataset.fbR != null) { b.responses[+el.dataset.fbR][el.dataset.f] = el.value; store.save(); }
  }
  async function attachPicker(a, body) {
    const items = await root.GA.library.list(); const m = document.getElementById('modal');
    m.innerHTML = `<div class="modal-box"><div class="modal-h"><h3>${t('fb.attach')}</h3><button class="btn btn-small" data-modal-close>✕</button></div><div class="modal-b" style="flex-direction:column">${items.length ? items.map(it => `<label class="chk"><input type="checkbox" data-att="${it.id}" ${it.links.fabrics.includes(a.id) ? 'checked' : ''}> <bdi>${esc(it.title)}</bdi> <small>${t('lib.k.' + it.kind)}${root.GA.library.unsorted(it) ? ' · ' + t('lib.unsorted') : ''}</small></label>`).join('') : `<p class="note">${t('lib.empty')}</p>`}<div class="actions"><button class="btn btn-primary" id="att-ok">${t('save')}</button></div></div></div>`;
    m.hidden = false; m.querySelector('#att-ok').onclick = async () => { for (const x of m.querySelectorAll('[data-att]')) await root.GA.library.link(x.dataset.att, 'fabrics', a.id, x.checked); m.hidden = true; render(body, a.id); };
  }

  // ---------- canvas renderings for export ----------
  const DPI = 150; const A3 = [420, 297];
  async function blockCanvas(k, a, b) {
    const S = PG.sheet(A3[0], A3[1], DPI); const { cv, ctx, W, H } = S; const F = PG.font(); const rtl = I.dir() === 'rtl'; const M = 60;
    let y = PG.header(ctx, W, `${a.name} — ${t('fb.b.' + k)}`, b.captions[k] || t('fb.boardSub'));
    const X0 = state.X; const TX = rtl ? W - M : M; const al = rtl ? 'right' : 'left';
    const text = (s, x, yy, size, maxW, lines, weight, color) => { ctx.font = `${weight || 400} ${size}px ${F}`; ctx.fillStyle = color || '#1C1E21'; ctx.textAlign = al; ctx.direction = rtl ? 'rtl' : 'ltr'; return PG.wrap(ctx, s, x, yy, maxW, size * 1.4, lines); };
    const cardPanel = (c, x, yy, w, h, mpp, center) => { if (!c || c.gapOnly) { text(c ? c.gapOnly : t('nodata'), rtl ? x + w : x, yy + 30, 15, w); return; } const off = document.createElement('canvas'); GAL.drawCard(off, { ring: X0.ring }, c, { center, mpp, w, h, ratio: 1 }); ctx.drawImage(off, x, yy); ctx.font = `600 18px ${F}`; ctx.fillStyle = '#1C1E21'; ctx.textAlign = al; ctx.fillText(c.title.replace(/<[^>]+>/g, ''), rtl ? x + w : x, yy - 8); let ly = CMP.legendCanvas(ctx, c.legend || [], x, yy + h + 16, w, rtl, F); ctx.font = `13px ${F}`; ctx.fillStyle = '#5E636A'; ctx.textAlign = al; ctx.fillText(`${c.src.name} · ${c.src.detail}`, rtl ? x + w : x, ly + 6); return ly + 20; };
    if (k === 'identity') { const off = document.createElement('canvas'); await locator(off, 900, 760, 1); ctx.drawImage(off, rtl ? W - M - 900 : M, y + 20); const tx = rtl ? W - M - 960 : M + 960; let yy = y + 40; const tw = W - 2 * M - 960; const ind = CMP.indicators(X0);
      yy = text(t('fb.rationale'), rtl ? tx : tx, yy, 22, tw, 1, 700); yy = text(b.rationale || '—', tx, yy + 4, 18, tw, 10); yy = text(t('fb.summary'), tx, yy + 20, 22, tw, 1, 700); yy = text(b.summary || '—', tx, yy + 4, 18, tw, 4);
      yy += 20; ['buildings', 'gsi', 'median_floors', 'places_per_km2', 'canopy_mean', 'bus_sched', 'flood_t100_share', 'relief_m'].forEach(key => { const row = CMP.IND_ROWS.find(r => r[0] === key); const v = row ? CMP.fmtInd(row, ind[key]) : null; yy = text(`${t(row[1]).replace(/<[^>]+>/g, '')}: ${v == null ? t('nodata') : v}`, tx, yy, 17, tw, 1); }); }
    else if (k === 'maps' || k === 'climate') { const ids = k === 'maps' ? b.topics : ['trees', 'flood', 'noise']; const cs = ids.map(id => state.cards.find(c => c.id === id)); const cols = 3, gap = 40; const pw = Math.floor((W - 2 * M - (cols - 1) * gap) / cols), ph = Math.round(pw * 0.72); const v = MC.fit([X0.ring], pw, ph, 0.06); cs.slice(0, 6).forEach((c, i) => { const col = i % cols, row = Math.floor(i / cols); const x = rtl ? W - M - (col + 1) * pw - col * gap : M + col * (pw + gap); cardPanel(c, x, y + 30 + row * (ph + 210), pw, ph, v.mpp, v.center); }); }
    else if (k === 'sections') { let yy = y + 20; for (const s of (a.sections || []).slice(0, 3)) { try { const p = await SEC.compute(s, { floorH: s.floorH || 3 }); const off = document.createElement('canvas'); SEC.draw(off, p, { w: W - 2 * M, h: 480, ratio: 1, ve: s.ve || 'auto', floors: !!s.floors }); ctx.drawImage(off, M, yy); yy += 500; } catch (e) { } } if (!(a.sections || []).length) text(t('ex.c.sectionMissing'), TX, yy + 30, 20, W - 2 * M); }
    else if (k === 'history') { const ks = HIST_SNAP.filter(hk => state.hist && state.hist[hk]); const gap = 30, pw = Math.floor((W - 2 * M - 3 * gap) / 4); ks.forEach((hk, i) => { const s = state.hist[hk]; const x = rtl ? W - M - (i + 1) * pw - i * gap : M + i * (pw + gap); const ph = Math.round(pw * s.im.height / s.im.width); ctx.drawImage(s.im, x, y + 40, pw, ph); const U = X0.ring.map(p => PJ.EPSG25830.forward(p)); ctx.strokeStyle = P.red; ctx.lineWidth = 3; ctx.beginPath(); U.forEach((p, j) => { const q = [x + (p[0] - s.box.x0) / (s.box.x1 - s.box.x0) * pw, y + 40 + (s.box.y1 - p[1]) / (s.box.y1 - s.box.y0) * ph]; j ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.stroke(); text(t('hist.' + hk), rtl ? x + pw : x, y + 40 + ph + 30, 18, pw, 2, 700); text(histDate(X.HIST.find(h => h.id === hk), s.info), rtl ? x + pw : x, y + 40 + ph + 56, 15, pw, 2); }); text(t('fb.histNote'), TX, H - 80, 15, W - 2 * M, 2, 400, '#3C4046'); }
    else if (k === 'photos') { const ph = ((a.analysis && a.analysis.result && a.analysis.result.photos) || []).filter(p => p.thumb).slice(0, 8); const cols = 4, gap = 24, pw = Math.floor((W - 2 * M - 3 * gap) / cols), phh = Math.round(pw * 0.7); for (let i = 0; i < ph.length; i++) { const p = ph[i]; const x = rtl ? W - M - (i % cols + 1) * pw - (i % cols) * gap : M + (i % cols) * (pw + gap), yy = y + 30 + Math.floor(i / cols) * (phh + 90); try { const im = await X.loadImage(p.thumb, 20000); PG.drawImageFit(ctx, im, x, yy, pw, phh, true); } catch (e) { ctx.strokeStyle = '#ccc'; ctx.strokeRect(x, yy, pw, phh); } text(`${p.author || ''} · ${p.license || ''} · ${(p.date || '').slice(0, 10)}`, rtl ? x + pw : x, yy + phh + 22, 13, pw, 3, 400, '#3C4046'); } if (!ph.length) text(t('fb.noPhotos'), TX, y + 40, 20, W - 2 * M); }
    else if (k === 'findings') { const cs = state.cards.filter(c => b.topics.includes(c.id) && !c.gapOnly); let yy = y + 30; const colW = (W - 2 * M - 40) / 2; cs.forEach((c, i) => { const x = (i % 2 === 0) !== rtl ? M : M + colW + 40; if (i % 2 === 0 && i) yy += 0; const y0 = yy + Math.floor(i / 2) * 200; let z = text(c.title.replace(/<[^>]+>/g, ''), rtl ? x + colW : x, y0, 20, colW, 1, 700); (c.find || []).slice(0, 2).forEach(f => { z = text('• ' + f, rtl ? x + colW : x, z + 4, 15, colW, 3); }); }); text(b.findings || '', TX, H - 160, 18, W - 2 * M, 4); }
    else if (k === 'research') { let yy = y + 30; yy = text(t('fb.questions'), TX, yy, 24, W - 2 * M, 1, 700); b.questions.forEach((q, i) => { yy = text(`${i + 1}. ${q.q}`, TX, yy + 10, 20, W - 2 * M, 3, 600); yy = text(`${t('fb.evidence')}: ${q.ev || '—'}`, TX, yy, 16, W - 2 * M, 3); yy = text(`${t('fb.gap')}: ${q.gap || '—'}`, TX, yy, 16, W - 2 * M, 2, 400, '#8A5A10'); }); yy = text(t('fb.responses'), TX, yy + 30, 24, W - 2 * M, 1, 700); b.responses.forEach((r, i) => { yy = text(`${i + 1}. ${r.title || ''}`, TX, yy + 10, 20, W - 2 * M, 2, 600); yy = text(r.desc || '', TX, yy, 16, W - 2 * M, 4); yy = text(`${t('fb.who')}: ${r.who || '—'} · ${t('fb.limits')}: ${r.limits || '—'} · ${t('fb.ind')}: ${r.ind || '—'}`, TX, yy, 15, W - 2 * M, 3, 400, '#3C4046'); }); }
    else if (k === 'attachments') { const items = state.lib; let i = 0; const cols = 5, gap = 20, pw = Math.floor((W - 2 * M - 4 * gap) / cols); for (const it of items.slice(0, 15)) { const x = rtl ? W - M - (i % cols + 1) * pw - (i % cols) * gap : M + (i % cols) * (pw + gap), yy = y + 30 + Math.floor(i / cols) * (pw + 80); if (it.thumb) { const im = await new Promise(r => { const q = new Image(); q.onload = () => r(q); q.onerror = () => r(null); q.src = it.thumb; }); if (im) PG.drawImageFit(ctx, im, x, yy, pw, pw * 0.75, false); } else { ctx.strokeStyle = '#C6C7C9'; ctx.strokeRect(x, yy, pw, pw * 0.75); text(t('lib.k.' + it.kind), rtl ? x + pw - 10 : x + 10, yy + 30, 18, pw - 20); } text(it.title, rtl ? x + pw : x, yy + pw * 0.75 + 24, 15, pw, 2, 600); text(it.source || '', rtl ? x + pw : x, yy + pw * 0.75 + 46, 13, pw, 2, 400, '#5E636A'); i++; } }
    PG.footer(ctx, W, H, `Granada Atlas · ${t('fb.footer')} · ${new Date().toISOString().slice(0, 10)}`);
    return cv;
  }
  async function exportPDF(id) {
    const a = areaOf(id); const b = board(id); if (!state || state.id !== id) return; root.GA.toast && root.GA.toast(t('ex.building'));
    const pages = []; for (const k of b.order.filter(k => !b.hidden.includes(k))) { try { pages.push({ canvas: await blockCanvas(k, a, b), paper: 'A3L' }); } catch (e) { console.warn(k, e); } }
    const bytes = root.GA.pdf.build(pages, { title: 'Granada Atlas — ' + a.name }); PG.download(new Blob([bytes], { type: 'application/pdf' }), `fabric_${PG.slug(a.name)}.pdf`); root.GA.lastFabricPDF = { pages: pages.length };
  }

  PG.register('fabric', { plate: () => t('fb.plate'), title: (id) => { const a = areaOf(id); return a ? a.name : t('fb.noArea'); }, nav, actions: (id) => `<button class="btn btn-small btn-primary" onclick="GA.fabric.exportPDF('${id}')">${t('fb.pdf')}</button><button class="btn btn-small" onclick="GA.pages.close();GA.app&&GA.app.openArea&&GA.app.openArea('${id}')">${t('fb.onMap')}</button>`, render });
  root.GA.fabric = { exportPDF, board, blockCanvas, BLOCKS, get state() { return state; } };
})(window);
