/* Comparison of 2–4 study areas and the Exercise 1.2 workflow (urban fabrics).
   Every area is computed from the same local datasets with the same rules; maps share one
   drawing scale (metres per pixel) and identical class breaks; the elevation ramp is shared.
   Missing data is shown as "no data", never as zero. Findings describe differences only —
   no causal claims. Exercise sheets are rendered at a stated print scale on A3. */
(function (root) {
  const { geo: G, data: D, gallery: GAL, mapcard: MC, i18n: I, palette: P, section: SEC, pdf: PDF } = root.GA;
  const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d) => n == null || !isFinite(n) ? null : Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d ? Math.min(1, d) : 0 });
  // every fabric boundary is dashed (colour and dash pattern together keep the fabrics apart)
  const STYLES = [{ color: '#992B2A', dash: [7, 4] }, { color: '#2F5F8A', dash: [3, 3] }, { color: '#1C1E21', dash: [10, 3, 2, 3] }, { color: '#7B5EA7', dash: [5, 2] }, { color: '#5E9A5B', dash: [7, 4] }, { color: '#D98A2B', dash: [3, 3] }, { color: '#6E737A', dash: [10, 3, 2, 3] }, { color: '#6E1C1B', dash: [5, 2] }];
  const styleOf = (i) => Object.assign({ label: String(i + 1), width: 2.2 }, STYLES[i % STYLES.length]);

  function ringOf(spec) {
    if (!spec || !spec.center) return null;
    if (spec.type === 'circle') return G.circle(spec.center, spec.radius, 64);
    if (spec.type === 'square') return G.square(spec.center, spec.side);
    if (spec.type === 'polygon' && spec.verts && spec.verts.length >= 3) return G.closeRing(spec.verts);
    return null;
  }

  // ---------- per-area data (cached by geometry) ----------
  const cache = new Map();
  const listeners = []; // called with X whenever an external source of a prepared area arrives or fails
  function onUpdate(f) { listeners.push(f); }
  async function prepare(area) {
    const ring = ringOf(area.spec); if (!ring) throw new Error('no geometry');
    const key = area.id + JSON.stringify(area.spec); if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      const { parsed, results } = await D.areaData(ring);
      const [dem, slope, health, bus, contours] = await Promise.all([D.grid('dem').catch(() => null), D.grid('slope').catch(() => null), D.single('fac_health').catch(() => null), D.single('bus_stops').catch(() => null), D.single('contours_10m').catch(() => null)]);
      const [places, busSvc] = await Promise.all([D.single('places').catch(() => null), D.single('bus_service').catch(() => null)]);
      let X = null, tm = null;
      // external services: start them, wait briefly for fast ones, never block on slow or failed ones
      const E = root.GA.galleryExt ? root.GA.galleryExt.start(ring, () => X && schedule()) : null;
      if (E) await Promise.race([E.done, new Promise(r => setTimeout(r, 6000))]);
      const extras = { health, bus, dem, slope, places, busSvc, ext: E ? E.out : {} };
      const sync = () => Object.entries(extras.ext.status || {}).forEach(([k, v]) => results[k] = v);
      const recompute = async () => { X.R = await GAL.compute({ ring }, parsed, extras); sync(); X.extPending = Object.values(extras.ext.status || {}).some(v => v.state === 'loading'); listeners.forEach(f => { try { f(X); } catch (e) { console.warn(e); } }); };
      function schedule() { clearTimeout(tm); tm = setTimeout(recompute, 150); }
      const R = await GAL.compute({ ring }, parsed, extras); sync();
      X = { area, ring, parsed, results, R, dem, slope, contours: contours ? contours.features : [], ext: extras.ext, extPending: Object.values(extras.ext.status || {}).some(v => v.state === 'loading') };
      X.retryExt = async (k) => { if (!E) return; const pr = E.retry(k); schedule(); await pr; };
      return X;
    })();
    cache.set(key, p); p.catch(() => cache.delete(key)); return p;
  }

  // ---------- indicators (null = no data; _why says why a value is missing) ----------
  const fz = (X, k) => { const z = X.R.flood && X.R.flood.zones[k]; return z && z.status === 'ok' ? z.share : null; };
  function whyOf(X) {
    const w = {}; const st = X.results || {};
    ['q10', 'q50', 'q100', 'q500'].forEach(k => { const key = 'flood_t' + k.slice(1) + '_share'; const z = X.R.flood && X.R.flood.zones[k]; w[key] = !X.R.flood ? (st.flood && st.flood.state === 'loading' ? 'loading' : 'unavailable') : z.status === 'not_modelled' ? 'not_modelled' : z.status === 'failed' ? 'unavailable' : null; });
    if (!X.R.canopy) w.canopy_mean = st.tcd && st.tcd.state === 'loading' ? 'loading' : 'unavailable';
    return w;
  }
  const whyLabel = (why) => why === 'not_modelled' ? t('v5.notModelled') : why === 'loading' ? t('v5.loading') : why === 'unavailable' ? t('v5.unavail') : t('nodata');
  function indicators(X) {
    const o = X.R.osm, B = o.buildings, aKm2 = X.R.area_m2 / 1e6, T = X.R.terrain;
    const lvs = o.geo.buildings.features.map(f => f.properties.levels).filter(v => v != null).sort((a, b) => a - b);
    const sc = T && T.slopeCls, sn = T && (T.slopeN || 1);
    return {
      area_km2: aKm2, buildings: B.count, buildings_per_ha: B.count / (X.R.area_m2 / 1e4), gsi: B.count ? B.gsi : (o.selArea ? 0 : null),
      levels_coverage: B.count ? B.levelsCoverage : null, median_floors: lvs.length ? lvs[lvs.length >> 1] : null, start_coverage: B.count ? B.startCoverage : null,
      street_km_per_km2: o.streets.density, ped_share: o.streets.total ? o.streets.tiers.pedestrian / o.streets.total : null, green_share: (o.landuse.areas.green || 0) / o.selArea,
      health_n: X.R.fac.health.n, health_per_km2: X.R.fac.health.perKm2, education_n: X.R.fac.education.n, education_per_km2: X.R.fac.education.perKm2, stay_n: X.R.fac.stay.n, stay_per_km2: X.R.fac.stay.perKm2,
      bus_n: X.R.transit.n, bus_per_km2: X.R.transit.perKm2, bus_cover300: X.R.transit.cover300,
      elev_min: T ? T.min : null, elev_max: T ? T.max : null, relief_m: T ? T.relief : null, steep_share_15deg: T ? (sc['15-25'] + sc['25-35'] + sc['35+']) / sn : null, slope_p90_deg: T ? T.slopeP90 : null,
      places_n: X.R.places ? X.R.places.n : null, places_per_km2: X.R.places ? X.R.places.perKm2 : null, places_mix: X.R.places && X.R.places.n ? X.R.places.evenness : null, places_food_share: X.R.places && X.R.places.n ? (X.R.places.by.food_and_drink || 0) / X.R.places.n : null, places_closed_share: X.R.places && X.R.places.nAll ? X.R.places.closed / X.R.places.nAll : null,
      bus_mapped: X.R.bus ? X.R.bus.mapped : null, bus_sched: X.R.bus ? X.R.bus.withService : null, bus_sched_share: X.R.bus && X.R.bus.mapped ? X.R.bus.withService / X.R.bus.mapped : null, bus_max_trips: X.R.bus && X.R.bus.mapped ? X.R.bus.maxTrips : null, bus_routes: X.R.bus && X.R.bus.mapped ? X.R.bus.routes.length : null, bus_nearest_m: X.R.bus ? X.R.bus.nearestServed : null,
      canopy_mean: X.R.canopy ? X.R.canopy.mean / 100 : null, trees_mapped: X.R.trees ? X.R.trees.n : null, trees_per_ha: X.R.trees ? X.R.trees.n / (X.R.area_m2 / 1e4) : null,
      flood_t10_share: fz(X, 'q10'), flood_t50_share: fz(X, 'q50'), flood_t100_share: fz(X, 'q100'), flood_t500_share: fz(X, 'q500'), _why: whyOf(X),
    };
  }
  const IND_ROWS = [
    ['area_km2', 'cmp.i.area', (v) => nf(v, 3) + ' km²'], ['buildings', 'b.count', (v) => nf(v)], ['buildings_per_ha', 'cmp.bph', (v) => nf(v, 1)], ['gsi', 'b.gsi', 'pct'],
    ['levels_coverage', 'cmp.levelsCov', 'pct'], ['median_floors', 'g.medianFloors', (v) => nf(v)], ['start_coverage', 'cmp.i.startCov', 'pct'],
    ['street_km_per_km2', 'cmp.density', (v) => nf(v, 1)], ['ped_share', 'cmp.ped', 'pct'], ['green_share', 'cmp.green', 'pct'],
    ['health_n', 'cmp.i.healthN', (v) => nf(v)], ['health_per_km2', 'cmp.i.healthD', (v) => nf(v, 1)], ['education_n', 'cmp.i.eduN', (v) => nf(v)], ['education_per_km2', 'cmp.i.eduD', (v) => nf(v, 1)],
    ['stay_n', 'cmp.i.stayN', (v) => nf(v)], ['stay_per_km2', 'cmp.i.stayD', (v) => nf(v, 1)], ['bus_n', 'cmp.i.busN', (v) => nf(v)], ['bus_per_km2', 'cmp.i.busD', (v) => nf(v, 1)], ['bus_cover300', 'g.cover300', 'pct'],
    ['places_n', 'cmp3.placesN', (v) => nf(v)], ['places_per_km2', 'cmp3.placesD', (v) => nf(v, 0)], ['places_mix', 'cmp3.mix', (v) => nf(v, 2)], ['places_food_share', 'cmp3.food', 'pct'], ['places_closed_share', 'cmp3.closed', 'pct'],
    ['bus_mapped', 'cmp3.busMapped', (v) => nf(v)], ['bus_sched', 'cmp3.busSched', (v) => nf(v)], ['bus_max_trips', 'cmp3.busMax', (v) => nf(v)], ['bus_routes', 'cmp3.busRoutes', (v) => nf(v)], ['bus_nearest_m', 'cmp3.busNear', (v) => nf(v) + ' m'],
    ['canopy_mean', 'cmp3.canopy', 'pct'], ['trees_mapped', 'cmp3.trees', (v) => nf(v)], ['trees_per_ha', 'cmp3.treesHa', (v) => nf(v, 1)],
    ['flood_t10_share', 'cmp3.flood10', 'pct'], ['flood_t50_share', 'v5.floodT50', 'pct'], ['flood_t100_share', 'cmp3.flood100', 'pct'], ['flood_t500_share', 'cmp3.flood500', 'pct'],
    ['relief_m', 'g.relief', (v) => nf(v) + ' m'], ['steep_share_15deg', 'g.steepShare', 'pct'], ['slope_p90_deg', 'g.slopeP90', (v) => nf(v, 1) + '°'],
  ];
  const fmtInd = (row, v) => v == null || !isFinite(v) ? null : row[2] === 'pct' ? nf(v * 100, v < 0.1 ? 1 : 0) + I.pctSign() : row[2](v);
  const ALL_TOPICS = ['fg', 'heights', 'periods', 'streets', 'landuse', 'parks', 'places', 'health', 'education', 'stay', 'transit', 'bus', 'trees', 'flood', 'noise', 'elevation', 'slope'];
  const TOPIC_KEY = { fg: 'gsi', heights: 'median_floors', periods: 'start_coverage', streets: 'street_km_per_km2', landuse: 'green_share', parks: 'green_share', health: 'health_per_km2', education: 'education_per_km2', stay: 'stay_per_km2', transit: 'bus_per_km2', elevation: 'relief_m', slope: 'steep_share_15deg', places: 'places_per_km2', bus: 'bus_sched_share', trees: 'canopy_mean', flood: 'flood_t100_share' };

  function fairness(Xs) {
    const notes = []; const ar = Xs.map(x => x.R.area_m2);
    if (Math.max(...ar) / Math.min(...ar) > 1.05) notes.push(t('cmp.f.size', { r: nf(Math.max(...ar) / Math.min(...ar), 2) }));
    if (new Set(Xs.map(x => x.area.spec.type)).size > 1) notes.push(t('cmp.f.shape'));
    Xs.forEach((x, i) => { const B = x.R.osm.buildings; if (B.count && B.levelsCoverage < 0.6) notes.push(t('cmp.f.levels', { n: i + 1, p: nf(B.levelsCoverage * 100) })); if (!x.R.terrain) notes.push(t('cmp.f.terrain', { n: i + 1 })); });
    Xs.forEach((x, i) => Object.entries(x.results || {}).forEach(([k, r]) => { if (r.state === 'failed') notes.push(t('cmp.f.failed', { n: i + 1, s: k })); }));
    return notes;
  }
  function topicFinding(topic, Xs, inds) {
    const key = TOPIC_KEY[topic]; if (!key) return '';
    const row = IND_ROWS.find(r => r[0] === key); const vals = inds.map(v => v[key]);
    const known = vals.map((v, i) => [v, i]).filter(([v]) => v != null && isFinite(v));
    let s = '';
    if (known.length >= 2) { known.sort((a, b) => b[0] - a[0]); const hi = known[0], lo = known[known.length - 1]; s = hi[0] === lo[0] ? t('cmp.find.same', { m: t(row[1]), v: fmtInd(row, hi[0]) }) : t('cmp.find.range', { m: t(row[1]), a: hi[1] + 1, va: fmtInd(row, hi[0]), b: lo[1] + 1, vb: fmtInd(row, lo[0]) }); }
    const miss = vals.map((v, i) => v == null ? i + 1 : null).filter(Boolean); if (miss.length) s += ' ' + t('cmp.find.missing', { n: miss.join(', ') });
    return s;
  }

  function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    const words = String(text || '').split(/\s+/); let line = ''; let n = 0;
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); y += lh; n++; line = w; if (maxLines && n >= maxLines) return y; } else line = test; }
    if (line) { ctx.fillText(line, x, y); y += lh; } return y;
  }
  function legendCanvas(ctx, items, x, y, maxW, rtl, font) {
    ctx.font = `14px ${font}`; ctx.textBaseline = 'middle'; let cx = 0, cy = y; const rowH = 22;
    items.forEach(it => {
      const label = String(it.label || '').replace(/<[^>]+>/g, '').replace(/[⁦⁩]/g, ''); const w = 26 + ctx.measureText(label).width + 14;
      if (cx + w > maxW) { cx = 0; cy += rowH; }
      const sx = rtl ? x + maxW - cx - 18 : x + cx;
      if (it.hatch) { ctx.strokeStyle = '#8A8F96'; ctx.strokeRect(sx, cy - 6, 18, 12); for (let k = -12; k < 18; k += 4) { ctx.beginPath(); ctx.moveTo(sx + Math.max(0, k), cy + 6 - Math.max(0, -k)); ctx.lineTo(sx + Math.min(18, k + 12), cy - 6 + Math.max(0, k + 12 - 18)); ctx.stroke(); } }
      else if (it.sw) { ctx.fillStyle = it.sw; ctx.globalAlpha = it.alpha != null ? it.alpha : 1; ctx.fillRect(sx, cy - 6, 18, 12); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.strokeRect(sx, cy - 6, 18, 12); }
      else if (it.line) { ctx.strokeStyle = it.line; ctx.lineWidth = Math.max(1, it.w || 1); ctx.setLineDash(it.dash ? [4, 2] : []); ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sx + 18, cy); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
      else if (it.dot) { ctx.fillStyle = it.dot; ctx.beginPath(); ctx.arc(sx + 9, cy, 5, 0, Math.PI * 2); ctx.fill(); }
      else if (it.ramp) { const g = ctx.createLinearGradient(sx, 0, sx + 18, 0); g.addColorStop(0, `rgb(${it.ramp[0].slice(0, 3)})`); g.addColorStop(1, `rgb(${it.ramp[1].slice(0, 3)})`); ctx.fillStyle = g; ctx.fillRect(sx, cy - 6, 18, 12); }
      ctx.fillStyle = '#1C1E21'; ctx.textAlign = rtl ? 'right' : 'left';
      if (w > maxW) { // long label: wrap onto its own lines
        const lines = []; let ln = ''; label.split(' ').forEach(wd => { const tt = ln ? ln + ' ' + wd : wd; if (ctx.measureText(tt).width > maxW - 30 && ln) { lines.push(ln); ln = wd; } else ln = tt; }); if (ln) lines.push(ln);
        lines.forEach((l, k) => ctx.fillText(l, rtl ? sx - 6 : sx + 24, cy + k * (rowH - 4)));
        cy += (lines.length - 1) * (rowH - 4); cx = maxW; return;
      }
      ctx.fillText(label, rtl ? sx - 6 : sx + 24, cy);
      cx += w;
    });
    return cy + rowH;
  }

  // ---------- workspace ----------
  function create(opts) {
    const { store, toast, onClose, onExport, getSections } = opts;
    // One workspace: comparison of the selected fabrics + the Exercise 1.2 submission tools (an expandable section).
    let topics = ['fg', 'heights', 'streets', 'landuse']; let busy = false; let lastXs = null; let errors = {}; let assignOpen = false;
    const el = document.getElementById('workspace'); const MAX = 8;
    const proj = () => { const p = store.get(); p.compare = p.compare || { ids: [] }; p.ex12 = p.ex12 || { ids: [], fabrics: {} };
      if (!p.compare.unified) { p.compare.ids = [...new Set(p.compare.ids.concat(p.ex12.ids || []))]; p.compare.unified = true; } p.ex12.ids = p.compare.ids.slice(); return p; };
    const areasById = () => Object.fromEntries(store.get().areas.map(a => [a.id, a]));
    const ids = () => proj().compare.ids.filter(id => areasById()[id]);

    function open(which) { if (which === 'ex12') assignOpen = true; el.hidden = false; render(); }
    onUpdate((Xu) => { if (!el.hidden && !busy && lastXs && lastXs.some(x => x._base === Xu)) render(); });
    function close() { el.hidden = true; onClose && onClose(); }

    function header() {
      return `<div class="ws-h"><div><span class="plate">${t('ws.plate')}</span><h2>${t('v5.cmpTitle')}</h2><p class="fine">${t('v5.cmpLead')}</p></div>
        <div class="actions"><button class="btn btn-small" id="ws-close">${t('ws.backToMap')}</button></div></div>`;
    }
    function picker() {
      const A = store.get().areas; const sel = ids();
      if (!A.length) return `<p class="lead">${t('ws.noAreas')}</p>`;
      const n = sel.length; const status = n >= 4 ? `<span class="state st-ok">${t('v5.subComplete', { n })}</span>` : n >= 2 ? `<span class="state st-exp">${t('v5.subComparisonOnly', { n })}</span>` : `<span class="state st-bad">${t('v5.subNeed2')}</span>`;
      return `<div class="ws-pick"><b>${t('v5.pickFabrics')}</b>${A.map(a => { const i = sel.indexOf(a.id); const st = i >= 0 ? styleOf(i) : null; return `<label><input type="checkbox" data-ws-pick="${a.id}" ${i >= 0 ? 'checked' : ''} ${i < 0 && sel.length >= MAX ? 'disabled' : ''}> ${st ? `<span class="area-tag" style="color:${st.color}"><i style="border-top-style:${st.dash.length ? 'dashed' : 'solid'};border-color:${st.color}"></i>${i + 1}</span>` : ''} <bdi>${esc(a.name)}</bdi> <small>${root.GA.report.fmtArea(a.measures.area)}</small></label>`; }).join('')}</div><p class="ws-status">${status}</p>`;
    }
    async function load() {
      const A = areasById(); errors = {};
      const Xs = await Promise.all(ids().map((id, i) => prepare(A[id]).then(x => Object.assign({}, x, { no: i + 1, style: styleOf(i), _base: x })).catch(e => { errors[id] = e.message; return null; })));
      return Xs.filter(Boolean);
    }
    async function render() {
      el.innerHTML = header() + `<div class="ws-b">${picker()}<div id="ws-content"></div></div>`;
      const c = el.querySelector('#ws-content'); const n = ids().length;
      if (n < 2) { c.innerHTML = `<p class="note">${t('ws.need2')}</p>` + (n ? `<details class="assign" ${assignOpen ? 'open' : ''}><summary>${t('v5.assignTitle')}</summary>${exStatusHTML(n)}</details>` : ''); return; }
      c.innerHTML = `<div class="loading"><span class="spin"></span>${t('ws.computing')}</div>`; busy = true;
      const Xs = await load(); busy = false; lastXs = Xs;
      if (Object.keys(errors).length) toast(t('ws.someFailed'), true);
      renderCompare(c, Xs);
    }

    // ----- comparison -----
    function sharedView(Xs, w, h) { const f = MC.fit(Xs.map(x => x.ring), w, h, 0.07); const per = Xs.map(x => MC.fit([x.ring], w, h, 0.07)); return { mpp: f.mpp && Math.max(...per.map(p => p.mpp)), centers: per.map(p => p.center) }; }
    function renderCompare(c, Xs) {
      const inds = Xs.map(indicators); const notes = fairness(Xs); const n = Xs.length;
      const cw = Math.max(280, c.clientWidth || el.clientWidth - 40); const cols = cw >= 4 * 250 + 36 ? Math.min(n, 4) : cw >= 2 * 250 + 12 ? Math.min(n, 2) : 1;
      const W = Math.floor((cw - (cols - 1) * 14) / cols); const H = Math.round(W * 0.8);
      const view = sharedView(Xs, W, H); // one scale for every map, also when the grid stacks on a phone
      const elev = Xs.filter(x => x.R.terrain).map(x => x.R.terrain); const elevRange = elev.length ? [Math.min(...elev.map(e => e.min)), Math.max(...elev.map(e => e.max), Math.min(...elev.map(e => e.min)) + 10)] : null;
      const cardsBy = Xs.map(x => GAL.cards({ ring: x.ring }, x.parsed, x.R, { dem: x.dem, slope: x.slope, contours: x.contours, elevRange, ext: x.ext })); c._cardsBy = cardsBy; c._view = { W, H, view };
      const ALL = ALL_TOPICS; const ttl = (k) => t('g.' + k) !== 'g.' + k ? t('g.' + k) : t('g3.' + k);
      let h = `<section class="cmp-top"><figure class="cmp-ov"><button type="button" class="ap-map" id="cmp-ov-btn" aria-label="${esc(t('v5.enlargeMap'))}"><canvas id="ex-overview"></canvas><span class="enl" aria-hidden="true">⤢ ${t('v5.enlargeMap')}</span></button><figcaption>${t('v5.cmpOverview')}</figcaption></figure>
        <div class="cmp-key"><h3>${t('v5.keyFindings')}</h3><ul class="find">${topics.map(tp => `<li><b>${ttl(tp)}:</b> ${topicFinding(tp, Xs, inds)}</li>`).join('')}</ul><p class="fine">${t('cmp.noCause')}</p>
          <ol class="cmp-legend">${Xs.map(x => `<li><span class="area-tag" style="color:${x.style.color}"><i style="border-color:${x.style.color};border-top-style:${x.style.dash.length ? 'dashed' : 'solid'}"></i>${x.no}</span> <bdi>${esc(x.area.name)}</bdi>${(proj().ex12.fabrics[x.area.id] || {}).just ? `<br><small dir="auto">${esc(String(proj().ex12.fabrics[x.area.id].just).slice(0, 160))}</small>` : ''}</li>`).join('')}</ol></div></section>`;
      h += `<div class="ok">${t('cmp.scaleNote', { s: nf(view.mpp, 2) })}</div>`;
      if (notes.length) h += `<details class="warn-d"><summary>${t('cmp.fairTitle')} (${notes.length})</summary><ul class="find">${notes.map(n2 => `<li>${n2}</li>`).join('')}</ul></details>`;
      h += `<details class="ws-pick-d"><summary>${t('v5.chooseMaps')} (${topics.length})</summary><div class="ws-pick">${ALL.map(k => `<label><input type="checkbox" data-ws-topic="${k}" ${topics.includes(k) ? 'checked' : ''}> ${ttl(k)}</label>`).join('')}</div></details>`;
      topics.forEach(tp => {
        const cs = cardsBy.map(list => list.find(cd => cd.id === tp));
        h += `<section class="cmp-topic-s"><h3>${ttl(tp)}</h3><div class="cmp-grid2" style="grid-template-columns:repeat(${cols}, minmax(0, ${W}px))">`;
        cs.forEach((cd, i) => { const x = Xs[i]; h += `<div class="cmp-cell">${cd && !cd.gapOnly ? `<button type="button" class="ap-map" data-cmp-open="${tp}" data-i="${i}" aria-label="${esc(t('v5.enlargeMap') + ': ' + ttl(tp) + ' — ' + x.area.name)}"><canvas data-cmp="${tp}" data-i="${i}"></canvas><span class="enl" aria-hidden="true">⤢</span></button><dl class="kpi">${(cd.ind || []).slice(0, 3).map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('')}</dl>` : `<p class="note" style="padding:8px">${cd ? cd.gapOnly : t('nodata')}</p>`}<div class="cmp-name"><span class="area-tag" style="color:${x.style.color}">${x.no}</span> <bdi>${esc(x.area.name)}</bdi></div></div>`; });
        const lg = cs.find(cd => cd && cd.legend);
        h += `</div><div class="cmp-lg">${lg ? GAL.legendHTML(lg.legend) : ''}<small>${cs[0] && cs[0].src ? esc(cs[0].src.name) + ' · ' + esc(cs[0].src.license) : ''}</small></div><p class="cmp-find">${topicFinding(tp, Xs, inds)}</p></section>`;
      });
      h += `<h3 class="sub">${t('cmp.tableTitle')}</h3><div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th></th>${Xs.map(x => `<th><span class="area-tag" style="color:${x.style.color}"><i style="border-color:${x.style.color};border-top-style:${x.style.dash.length ? 'dashed' : 'solid'}"></i>${x.no}</span> <bdi>${esc(x.area.name)}</bdi></th>`).join('')}</tr></thead><tbody>`
        + IND_ROWS.map(r => `<tr><th>${t(r[1])}</th>${inds.map(v => { const s2 = fmtInd(r, v[r[0]]); return s2 == null ? `<td class="missing">${whyLabel((v._why || {})[r[0]])}</td>` : `<td class="num">${s2}</td>`; }).join('')}</tr>`).join('')
        + `</tbody></table></div><p class="fine">${t('cmp.tableNote')}</p>
        <div class="actions"><button class="btn btn-primary" id="ex-pdf">${t('v5.composedPDF')}</button><button class="btn" id="ws-csv">${t('cmp.exportCsv')}</button><button class="btn btn-gis" id="ws-gis">${t('cmp.exportGis')}</button></div>`;
      h += `<details class="assign" id="ws-assign" ${assignOpen ? 'open' : ''}><summary>${t('v5.assignTitle')} — ${n >= 4 ? t('v5.subComplete', { n }) : t('v5.subIncomplete', { n })}</summary>${exHTML(Xs)}</details>`;
      c.innerHTML = h;
      c.querySelector('#ws-assign').addEventListener('toggle', (e) => { assignOpen = e.target.open; });
      c.querySelectorAll('canvas[data-cmp]').forEach(cv => { const i = +cv.dataset.i; const cd = cardsBy[i].find(k => k.id === cv.dataset.cmp); GAL.drawCard(cv, { ring: Xs[i].ring, style: Xs[i].style }, cd, { center: view.centers[i], mpp: view.mpp, w: W, h: H }); });
      const ov = c.querySelector('#ex-overview'); const ow = Math.min(820, c.querySelector('.cmp-ov').clientWidth || 600); drawOverview(ov, Xs, ow, Math.round(ow * 0.7), undefined);
      c._inds = inds;
    }
    function csv(Xs) {
      const inds = Xs.map(indicators); const rows = [['indicator'].concat(Xs.map(x => `${x.no}: ${x.area.name}`))];
      IND_ROWS.forEach(r => rows.push([r[0]].concat(inds.map(v => v[r[0]] == null || !isFinite(v[r[0]]) ? 'NA' : String(+v[r[0]].toFixed(4))))));
      rows.push(['notes'].concat(Xs.map(() => 'NA = no data (not zero); densities per km² of the study area, not per resident')));
      return '﻿' + rows.map(r => r.map(v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',')).join('\n');
    }

    // ----- Exercise 1.2 -----
    function exStatusHTML(n) {
      return n >= 4 ? `<div class="ok ex-status">${t('ex.enough', { n })}</div>` : `<div class="warn ex-status">${t('ex.need4', { n })}</div>`;
    }
    function components(X, area) {
      const o = X.R.osm, B = o.buildings; const secs = (area.sections || []);
      const st = (s, note) => ({ s, note });
      return [
        ['section', secs.length ? st('ready', t('ex.c.sectionN', { n: secs.length })) : st('missing', t('ex.c.sectionMissing'))],
        ['network', o.streets.total ? st('ready', t('g.fStreets', { d: nf(o.streets.density, 1), p: nf(o.streets.tiers.pedestrian / (o.streets.total || 1) * 100) + I.pctSign() })) : st('missing', t('g.fNone'))],
        ['landuse', o.landuse.unclassified / o.selArea < 0.6 ? st('ready', '') : st('review', t('ex.c.luReview', { p: nf(o.landuse.unclassified / o.selArea * 100) + I.pctSign() }))],
        ['heights', B.levelsCoverage >= 0.8 ? st('ready', '') : B.levelsCoverage >= 0.4 ? st('review', t('g.fHeightsLow', { p: nf(B.levelsCoverage * 100) + I.pctSign() })) : st('missing', t('g.fHeightsLow', { p: nf(B.levelsCoverage * 100) + I.pctSign() }))],
        ['history', B.startCoverage >= 0.3 ? st('ready', '') : st('review', t('ex.c.histReview'))],
      ];
    }
    const stBadge = (s) => `<span class="state ${s === 'ready' ? 'st-ok' : s === 'review' ? 'st-exp' : 'st-bad'}">${t('ex.s.' + s)}</span>`;
    function exHTML(Xs) {
      const P2 = proj().ex12; const n = Xs.length;
      const ar = Xs.map(x => x.R.area_m2); const eq = n < 2 || (Math.max(...ar) / Math.min(...ar) <= 1.02 && new Set(Xs.map(x => x.area.spec.type)).size === 1);
      let h = exStatusHTML(n) + (eq ? `<div class="ok">${t('ex.equalOk')}</div>` : `<div class="warn">${t('ex.equalNo')}</div>`);
      h += `<p class="fine">${t('ex.lead')}</p><p class="fine">${t('v5.assignNote')}</p>`;
      h += `<div class="ex-grid">` + Xs.map(x => {
        const a = x.area; const fb = P2.fabrics[a.id] || {}; const comps = components(x, a); const okText = fb.just && fb.just.trim() && fb.sentence && fb.sentence.trim();
        return `<div class="ex-card"><h3><span class="area-tag" style="color:${x.style.color}">${x.no}</span> <bdi>${esc(a.name)}</bdi></h3>
          <ul class="ex-comp">${comps.map(([k, v]) => `<li><span>${t('ex.c.' + k)}${v.note ? `<br><small>${v.note}</small>` : ''}</span>${stBadge(v.s)}</li>`).join('')}<li data-ex-textst="${a.id}"><span>${t('ex.c.text')}</span>${stBadge(okText ? 'ready' : 'missing')}</li></ul>
          <label class="name"><span>${t('ex.just')}</span><textarea rows="4" dir="auto" data-ex-just="${a.id}" placeholder="${esc(t('ex.justPh'))}">${esc(fb.just || '')}</textarea></label>
          <label class="name"><span>${t('ex.sentence')}</span><input type="text" dir="auto" data-ex-sent="${a.id}" maxlength="200" value="${esc(fb.sentence || '')}" placeholder="${esc(t('ex.sentencePh'))}"></label>
          <div class="actions"><button class="btn btn-small" data-ex-sheet="${a.id}">${t('ex.sheet')}</button></div></div>`;
      }).join('') + `</div>`;
      return h;
    }

    // overview: city context with numbered samples
    async function drawOverview(cv, Xs, w, h, ratio) {
      const [maj, adm] = await Promise.all([D.single('streets_major').catch(() => null), D.single('admin').catch(() => null)]);
      const uc = adm && adm.features.find(f => f.properties.kind === 'urban_centre');
      const rings = Xs.map(x => x.ring).concat(uc ? [uc.geometry.type === 'Polygon' ? uc.geometry.coordinates[0] : uc.geometry.coordinates[0][0]] : []);
      const f = MC.fit(rings, w, h, 0.04);
      const ctxStreets = maj ? maj.features.filter(x => /motorway|trunk|primary|secondary/.test(x.properties.hw)).map(x => x.geometry) : [];
      const distr = adm ? adm.features.filter(x => x.properties.kind === 'distrito' || x.properties.kind === 'urban_centre').map(x => ({ g: x.geometry, stroke: x.properties.kind === 'urban_centre' ? P.red : '#9A9EA4', width: x.properties.kind === 'urban_centre' ? 1.2 : 0.7, dash: x.properties.kind === 'urban_centre' ? [4, 3] : null })) : [];
      const r = MC.render(cv, { center: f.center, mpp: f.mpp, w, h, ratio, context: { streets: ctxStreets, streetColor: '#B9BBBE' }, layers: [{ type: 'line', items: distr.map(d => ({ g: { type: d.g.type === 'Polygon' ? 'MultiLineString' : 'MultiLineString', coordinates: d.g.type === 'Polygon' ? d.g.coordinates : d.g.coordinates.flat() }, stroke: d.stroke, width: d.width, dash: d.dash })) }] });
      const ctx = cv.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const FM = root.GA.fabricStyle, placed = [];
      Xs.forEach(x => { const U = MC.ringUTM(x.ring); const pts = U.map(p => [r.X(p[0]), r.Y(p[1])]); FM.strokeRing(ctx, pts, { color: x.style.color, width: 2, dash: x.style.dash });
        const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length, cy = Math.min(...pts.map(q => q[1])) - 11; FM.drawNumber(ctx, String(x.no), cx, cy, { color: x.style.color, size: 15, placed }); });
      return r;
    }

    // ----- printable A3 sheets (150 dpi) -----
    const DPI = 150; const NICE = [1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 12500, 15000, 20000, 25000, 50000];
    function printScale(Xs, pw, ph) { const need = Math.max(...Xs.map(x => MC.fit([x.ring], pw, ph, 0.06).mpp)); const den = need / (0.0254 / DPI); const s = NICE.find(v => v >= den) || Math.ceil(den / 1000) * 1000; return { den: s, mpp: s * 0.0254 / DPI }; }
    async function sheetCanvas(X, Xs, scale, overviewImg) {
      const Wp = Math.round(420 / 25.4 * DPI), Hp = Math.round(297 / 25.4 * DPI); const cv = document.createElement('canvas'); cv.width = Wp; cv.height = Hp; const ctx = cv.getContext('2d');
      const font = getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif'; const rtl = I.dir() === 'rtl'; ctx.direction = rtl ? 'rtl' : 'ltr';
      const a = X.area; const fb = proj().ex12.fabrics[a.id] || {}; const M = 60;
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, Wp, Hp); ctx.fillStyle = P.red; ctx.fillRect(0, 0, Wp, 8);
      const TX = (x) => rtl ? Wp - x : x; ctx.textAlign = rtl ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#1C1E21'; ctx.font = `700 40px ${font}`; ctx.fillText(t('ex.sheetTitle', { n: X.no }) + ' — ' + a.name, TX(M), 70);
      ctx.font = `20px ${font}`; ctx.fillStyle = '#3C4046'; ctx.fillText(t('ex.sheetSub', { s: '1:' + scale.den.toLocaleString('en-US'), d: new Date().toISOString().slice(0, 10), a: root.GA.report.fmtArea(X.R.area_m2).replace(/<[^>]+>/g, '') }), TX(M), 104);
      if (fb.sentence) { ctx.font = `italic 600 24px ${font}`; ctx.fillStyle = P.red; ctx.fillText('“' + fb.sentence + '”', TX(M), 142); }
      // left column: locator + justification + indicators
      const LW = 560; const LX = rtl ? Wp - M - LW : M;
      if (overviewImg) { ctx.drawImage(overviewImg, LX, 170, LW, LW * overviewImg.height / overviewImg.width); }
      let y = 170 + (overviewImg ? LW * overviewImg.height / overviewImg.width : 0) + 36;
      ctx.font = `700 22px ${font}`; ctx.fillStyle = '#1C1E21'; ctx.textAlign = rtl ? 'right' : 'left'; const lx = rtl ? LX + LW : LX;
      ctx.fillText(t('ex.just'), lx, y); y += 30; ctx.font = `18px ${font}`; ctx.fillStyle = '#1C1E21';
      y = wrap(ctx, fb.just || t('ex.notWritten'), lx, y, LW, 26, 12) + 10;
      ctx.font = `700 20px ${font}`; ctx.fillText(t('ex.keyFigures'), lx, y); y += 28; ctx.font = `16px ${font}`;
      const iv = indicators(X); [['buildings', 'b.count'], ['gsi', 'b.gsi'], ['levels_coverage', 'cmp.levelsCov'], ['median_floors', 'g.medianFloors'], ['street_km_per_km2', 'cmp.density'], ['green_share', 'cmp.green'], ['relief_m', 'g.relief']].forEach(([k, lab]) => { const row = IND_ROWS.find(r => r[0] === k); const v = fmtInd(row, iv[k]); ctx.fillText(`${t(lab).replace(/<[^>]+>/g, '')}: ${v == null ? t('nodata') : v}`, lx, y); y += 23; });
      // panels
      const PX0 = rtl ? M : M + LW + 40, PW = Wp - 2 * M - LW - 40; const gap = 26; const pw = Math.floor((PW - 2 * gap) / 3), ph = 470;
      const cards = GAL.cards({ ring: X.ring }, X.parsed, X.R, { dem: X.dem, slope: X.slope, contours: X.contours, ext: X.ext });
      const panel = async (id, titleKey, px, py, w) => {
        ctx.textAlign = rtl ? 'right' : 'left'; ctx.font = `700 22px ${font}`; ctx.fillStyle = '#1C1E21'; ctx.fillText(t(titleKey), rtl ? px + w : px, py - 10);
        const cd = cards.find(k => k.id === id); const off = document.createElement('canvas');
        if (cd && !cd.gapOnly) { GAL.drawCard(off, { ring: X.ring, style: { color: X.style.color, width: 2.4, dash: X.style.dash } }, cd, { center: MC.fit([X.ring], w, ph, 0.06).center, mpp: scale.mpp, w, h: ph, ratio: 1 }); ctx.drawImage(off, px, py); }
        ctx.strokeStyle = '#C6C7C9'; ctx.strokeRect(px + 0.5, py + 0.5, w - 1, ph - 1);
        let ly = legendCanvas(ctx, (cd && cd.legend) || [], px, py + ph + 18, w, rtl, font);
        ctx.font = `14px ${font}`; ctx.fillStyle = '#3C4046'; ctx.textAlign = rtl ? 'right' : 'left';
        (cd && cd.find || []).slice(0, 2).forEach(f => { ly = wrap(ctx, String(f).replace(/<[^>]+>/g, '').replace(/[⁦⁩]/g, ''), rtl ? px + w : px, ly + 4, w, 19, 2); });
        if (id === 'periods' && X.R.osm.buildings.startCoverage < 0.3) { ctx.fillStyle = P.red; wrap(ctx, t('ex.c.histReview'), rtl ? px + w : px, ly + 4, w, 19, 3); }
      };
      const row1 = 200; const c0 = (i) => rtl ? PX0 + PW - (i + 1) * pw - i * gap : PX0 + i * (pw + gap);
      await panel('streets', 'ex.c.network', c0(0), row1, pw);
      await panel('landuse', 'ex.c.landuse', c0(1), row1, pw);
      await panel('heights', 'ex.c.heights', c0(2), row1, pw);
      const row2 = row1 + ph + 190;
      await panel('periods', 'ex.c.history', c0(0), row2, pw);
      // street section spanning two columns
      const sx = rtl ? PX0 : c0(1), sw = 2 * pw + gap; const sec = (a.sections || [])[0];
      ctx.font = `700 22px ${font}`; ctx.fillStyle = '#1C1E21'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText(t('ex.c.section') + (sec ? ' — ' + sec.name : ''), rtl ? sx + sw : sx, row2 - 10);
      if (sec) { try { const prof = await SEC.compute(sec, { floorH: sec.floorH || 3 }); const off = document.createElement('canvas'); SEC.draw(off, prof, Object.assign({ w: sw, h: ph, ratio: 1 }, SEC.optsFor(sec))); ctx.drawImage(off, sx, row2); } catch (e) { ctx.font = `16px ${font}`; ctx.fillText(e.message, rtl ? sx + sw : sx, row2 + 30); } }
      else { ctx.font = `18px ${font}`; ctx.fillStyle = P.red; ctx.fillText(t('ex.c.sectionMissing'), rtl ? sx + sw : sx, row2 + 40); }
      ctx.strokeStyle = '#C6C7C9'; ctx.strokeRect(sx + 0.5, row2 + 0.5, sw - 1, ph - 1);
      // footer
      ctx.font = `13px ${font}`; ctx.fillStyle = '#5E636A'; ctx.textAlign = rtl ? 'right' : 'left';
      ctx.fillText(t('ex.footer', { s: '1:' + scale.den.toLocaleString('en-US') }), TX(M), Hp - 30);
      return cv;
    }
    async function exportSheets(onlyId) {
      const Xs = lastXs || await load(); if (!Xs.length) return;
      const pw = Math.floor((Math.round(420 / 25.4 * DPI) - 120 - 560 - 40 - 52) / 3); const scale = printScale(Xs, pw, 470);
      toast(t('ex.building'));
      const ov = document.createElement('canvas'); await drawOverview(ov, Xs, 560, 400, 1);
      const pages = [];
      if (!onlyId) { // cover: overview + list
        const Wp = Math.round(420 / 25.4 * DPI), Hp = Math.round(297 / 25.4 * DPI); const cv = document.createElement('canvas'); cv.width = Wp; cv.height = Hp; const ctx = cv.getContext('2d'); const font = getComputedStyle(document.documentElement).getPropertyValue('--f-ui'); const rtl = I.dir() === 'rtl'; ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, Wp, Hp); ctx.fillStyle = P.red; ctx.fillRect(0, 0, Wp, 8);
        const big = document.createElement('canvas'); await drawOverview(big, Xs, 1500, 1350, 1); ctx.drawImage(big, rtl ? Wp - 60 - 1500 : 60, 140);
        ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillStyle = '#1C1E21'; ctx.font = `700 44px ${font}`; ctx.fillText(t('ex.coverTitle'), rtl ? Wp - 60 : 60, 90);
        let y = 180; const lx = rtl ? 60 + 760 : 1600; ctx.font = `20px ${font}`;
        if (Xs.length < 4) { ctx.fillStyle = P.red; y = wrap(ctx, t('ex.need4', { n: Xs.length }).replace(/<[^>]+>/g, ''), lx, y, 760, 28) + 10; }
        Xs.forEach(x => { const fb = proj().ex12.fabrics[x.area.id] || {}; ctx.fillStyle = x.style.color; ctx.font = `700 24px ${font}`; ctx.fillText(`${x.no}. ${x.area.name}`, lx, y); y += 32; ctx.fillStyle = '#1C1E21'; ctx.font = `italic 19px ${font}`; y = wrap(ctx, fb.sentence ? '“' + fb.sentence + '”' : t('ex.notWritten'), lx, y, 760, 26, 3) + 14; });
        ctx.font = `14px ${font}`; ctx.fillStyle = '#5E636A'; ctx.fillText(t('ex.footer', { s: '1:' + scale.den.toLocaleString('en-US') }), rtl ? Wp - 60 : 60, Hp - 30);
        pages.push({ canvas: cv, paper: 'A3L' });
      }
      for (const x of Xs) if (!onlyId || x.area.id === onlyId) pages.push({ canvas: await sheetCanvas(x, Xs, scale, ov), paper: 'A3L' });
      const bytes = PDF.build(pages, { title: 'Granada Atlas - Exercise 1.2' });
      const name = onlyId ? `exercise_1_2_${(Xs.find(x => x.area.id === onlyId) || {}).no}.pdf` : 'exercise_1_2_fabrics.pdf';
      download(new Blob([bytes], { type: 'application/pdf' }), name); root.GA.lastPDF = { bytes, pages: pages.length, scale };
      toast(t('ex.pdfDone', { n: pages.length, s: '1:' + scale.den.toLocaleString('en-US') }));
    }
    function download(blob, name) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }

    // ----- events -----
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'ws-close') return close();
      if (b.dataset.cmpOpen && lastXs) { const i = +b.dataset.i; const x = lastXs[i]; const cd = el.querySelector('#ws-content')._cardsBy[i].find(k => k.id === b.dataset.cmpOpen); return root.GA.viewer.map({ card: cd, X: x, ring: x.ring, style: x.style, title: cd.title, subtitle: `${x.no} · ${x.area.name}`, mpp: el.querySelector('#ws-content')._view.view.mpp, slug: cd.id + '_' + x.no }); }
      if (b.id === 'cmp-ov-btn') { const cv = el.querySelector('#ex-overview'); return root.GA.viewer.image({ title: t('v5.cmpOverview'), src: cv.toDataURL('image/png'), notGIS: true }); }
      if (b.id === 'ws-csv' && lastXs) return download(new Blob([csv(lastXs)], { type: 'text/csv' }), 'granada_comparison_indicators.csv');
      if (b.id === 'ws-gis' && lastXs) { b.disabled = true; try { await onExport(lastXs.map(x => Object.assign({}, x, { indicators: indicators(x), notes: fairness(lastXs).join(' | ') }))); } finally { b.disabled = false; } return; }
      if (b.id === 'ex-pdf') { b.disabled = true; try { await exportSheets(); } catch (er) { toast(er.message, true); } b.disabled = false; return; }
      if (b.dataset.exSheet) { b.disabled = true; try { await exportSheets(b.dataset.exSheet); } catch (er) { toast(er.message, true); } b.disabled = false; return; }
    });
    el.addEventListener('change', (e) => {
      const x = e.target;
      if (x.dataset.wsPick) { const L = proj().compare; const i = L.ids.indexOf(x.dataset.wsPick); if (x.checked && i < 0 && L.ids.length < MAX) L.ids.push(x.dataset.wsPick); if (!x.checked && i >= 0) L.ids.splice(i, 1); proj(); store.save(); render(); }
      if (x.dataset.wsTopic) { topics = x.checked ? topics.concat([x.dataset.wsTopic]) : topics.filter(k => k !== x.dataset.wsTopic); const ALL = ALL_TOPICS; topics.sort((a, b) => ALL.indexOf(a) - ALL.indexOf(b)); renderCompare(el.querySelector('#ws-content'), lastXs); }
      if (x.dataset.exJust != null && x.matches('[data-ex-just]')) { const F = proj().ex12.fabrics; F[x.dataset.exJust] = Object.assign(F[x.dataset.exJust] || {}, { just: x.value }); store.save(); }
      if (x.dataset.exSent != null && x.matches('[data-ex-sent]')) { const F = proj().ex12.fabrics; F[x.dataset.exSent] = Object.assign(F[x.dataset.exSent] || {}, { sentence: x.value }); store.save(); }
      const id = x.dataset.exJust || x.dataset.exSent; if (id) { const fb = proj().ex12.fabrics[id] || {}; const li = el.querySelector(`[data-ex-textst="${id}"]`); if (li) li.lastElementChild.outerHTML = stBadge(fb.just && fb.just.trim() && fb.sentence && fb.sentence.trim() ? 'ready' : 'missing'); }
    });
    return { open, close, render, isOpen: () => !el.hidden, get lastXs() { return lastXs; }, exportSheets, indicators };
  }

  root.GA.compare = { create, prepare, onUpdate, whyLabel, ringOf, indicators, styleOf, IND_ROWS, cache, wrap, legendCanvas, fmtInd, ALL_TOPICS, fairness, topicFinding };
})(window);
