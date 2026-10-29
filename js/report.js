/* Renders the preliminary research report for one study area, in the interface language.
   Each line carries an evidence status and a source note. Gaps are shown, not hidden.
   Source titles, place names and the users' own notes are shown as written. */
(function (root) {
  const I = root.GA.i18n, PAL = root.GA.palette; const t = (k, v) => I.t(k, v);
  const iso = (s) => '⁦' + s + '⁩'; // keep numeric ranges like 1–2 left-to-right inside RTL text
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d && d > 0 ? Math.min(d, 1) : 0 });
  const pct = (x, d) => x == null || !isFinite(x) ? '—' : nf(x * 100, d == null ? 0 : d) + I.pctSign();
  const unit = (v, u) => `<span class="num">${v}</span> ${t('u.' + u)}`;
  const fmtArea = (m2) => m2 >= 1e6 ? unit(nf(m2 / 1e6, 2), 'km2') : m2 >= 1e4 ? unit(nf(m2 / 1e4, 2), 'ha') : unit(nf(m2), 'm2');
  const fmtLen = (m) => m >= 1000 ? unit(nf(m / 1000, 2), 'km') : unit(nf(m), 'm');
  const plain = (h) => String(h).replace(/<[^>]+>/g, '');

  const STATUS = ['doc', 'est', 'gap', 'obs', 'hyp', 'int'];
  const badge = (k) => `<span class="badge badge-${k}" title="${esc(t('st.' + k + '.t'))}">${t('st.' + k)}</span>`;
  const bandLabel = (k) => k === 'no_data' ? t('nodata') : t('b.floors', { v: iso(k.replace('-', '–')) });
  const periodLabel = (k) => k === 'no_data' ? t('nodata') : k === 'pre_1900' ? t('period.pre_1900') : k === '2000_plus' ? t('period.2000_plus') : iso(k.replace('_', '–'));

  function src(s) {
    return `<details class="src"><summary dir="auto"><span class="src-k">${t('src.label')}</span>${esc(s.name)}</summary><div class="src-body">
      ${s.url ? `<div><a href="${esc(s.url)}" target="_blank" rel="noopener" dir="ltr">${esc(s.url.replace(/^https?:\/\//, '').slice(0, 60))}</a></div>` : ''}
      ${s.date ? `<div>${t('src.fetched')}: <span dir="ltr">${esc(s.date)}</span></div>` : ''}${s.year ? `<div>${t('src.dataDate')}: <span dir="ltr">${esc(s.year)}</span></div>` : ''}
      ${s.scope ? `<div>${t('src.scope')}: ${esc(s.scope)}</div>` : ''}${s.method ? `<div>${t('src.method')}: ${esc(s.method)}</div>` : ''}${s.license ? `<div>${t('src.license')}: ${esc(s.license)}</div>` : ''}
    </div></details>`;
  }
  function row(label, value, status, source, note) {
    return `<div class="row"><div class="row-l">${label}</div><div class="row-v">${value}</div><div class="row-s">${badge(status)}</div>${source ? `<div class="row-src">${src(source)}</div>` : ''}${note ? `<div class="row-note">${note}</div>` : ''}</div>`;
  }
  function bars(items, fmt, colorOf) {
    const max = Math.max(1e-9, ...items.map(i => i[1]));
    return `<div class="bars">${items.map(i => `<div class="bar"><span class="bar-l">${i[0]}</span><span class="bar-t"><i style="width:${(i[1] / max * 100).toFixed(1)}%;background:${colorOf ? colorOf(i[2]) : PAL.red}"></i></span><span class="bar-v">${fmt(i[1])}</span></div>`).join('')}</div>`;
  }
  const gap = (tk, bk, tasks, vars) => `<div class="gap"><div class="gap-h">${badge('gap')} ${t(tk)}</div><p>${t(bk, vars)}</p>${tasks && tasks.length ? `<ul class="tasks">${tasks.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>`;

  function niceTicks(min, max, n) { const span = max - min || 1; const step0 = span / n; const mag = Math.pow(10, Math.floor(Math.log10(step0))); const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0); const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6)); return out; }
  function profileSVG(p, orientation) {
    const W = 420, H = 170, L = 44, Rr = 10, T = 12, B = 30; const iw = W - L - Rr, ih = H - T - B;
    const lo = Math.floor(p.min - 5), hi = Math.ceil(p.max + 5); const yt = niceTicks(lo, hi, 4); const xt = niceTicks(0, p.length, 5);
    const X = d => L + (d / p.length) * iw, Y = e => T + ih - ((e - lo) / (hi - lo)) * ih;
    const path = p.elev.map((e, i) => (i ? 'L' : 'M') + X(p.dist[i]).toFixed(1) + ' ' + Y(e).toFixed(1)).join(' ');
    const area = path + ` L${X(p.length).toFixed(1)} ${T + ih} L${L} ${T + ih} Z`;
    const ends = orientation === 'NS' ? ['S', 'N'] : ['W', 'E'];
    return `<svg class="profile" dir="ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('topo.aria'))}">
      <g class="grid">${yt.filter(v => v >= lo && v <= hi).map(v => `<line x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`).join('')}</g>
      <g class="grid">${xt.filter(v => v <= p.length).map(v => `<text x="${X(v)}" y="${H - 12}" text-anchor="middle">${v >= 1000 ? (v / 1000) + ' km' : v + ' m'}</text>`).join('')}</g>
      <path d="${area}" class="prof-area"/><path d="${path}" class="prof-line"/>
      <text x="${L}" y="${H - 1}" class="end">${ends[0]} A</text><text x="${W - Rr}" y="${H - 1}" text-anchor="end" class="end">A′ ${ends[1]}</text>
      <text x="6" y="${T + 4}" class="unit">m</text></svg>`;
  }
  function climateSVG(c) {
    const W = 420, H = 150, L = 34, Rr = 8, T = 10, B = 24; const iw = W - L - Rr, ih = H - T - B;
    const vals = c.monthly.flatMap(m => [m.max, m.min]).filter(v => v != null);
    const lo = Math.floor(Math.min(0, ...vals) / 5) * 5, hi = Math.ceil(Math.max(...vals) / 5) * 5;
    const X = i => L + (i + 0.5) * iw / 12, Y = v => T + ih - ((v - lo) / (hi - lo)) * ih;
    const line = (k) => c.monthly.map((m, i) => m[k] == null ? '' : (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(m[k]).toFixed(1)).join(' ');
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    return `<svg class="profile" dir="ltr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('c.aria'))}">
      <g class="grid">${niceTicks(lo, hi, 4).map(v => `<line x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 5}" y="${Y(v) + 3}" text-anchor="end">${v}°</text>`).join('')}
      ${months.map((m, i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${m}</text>`).join('')}</g>
      <path d="${line('max')}" class="clim-max"/><path d="${line('min')}" class="clim-min"/></svg>
      <div class="legend-inline"><span><i class="sw sw-max"></i>${t('c.max')}</span><span><i class="sw sw-min"></i>${t('c.min')}</span></div>`;
  }

  function sectionWrap(id, sub, body, open) {
    return `<details class="topic" id="topic-${id}" ${open ? 'open' : ''}><summary><span class="topic-t">${t('t.' + id)}</span><span class="topic-sub" dir="ltr">${sub}</span></summary><div class="topic-b">${body}</div></details>`;
  }
  function taskState(task, retryId) {
    if (!task || task.state === 'running' || task.state === 'pending') return `<div class="loading"><span class="spin"></span>${task && task.msgKey ? t(task.msgKey, task.msgVars) : t('loading')}</div>`;
    if (task.state === 'error') return `<div class="error">${t('fetchFail', { v: esc(task.error) })} <button class="btn btn-small" data-retry="${retryId}">${t('retry')}</button></div>`;
    if (task.state === 'skipped') return `<div class="note">${t(task.msgKey)}</div>`;
    return '';
  }
  const poiLabel = (k) => t('poi.' + k);

  function render(ctx) {
    const { area, run, observations } = ctx; const R = run.result; const T = run.tasks; const date = run.runAt ? run.runAt.slice(0, 10) : '';
    const osmSrc = (method, scope) => ({ name: 'OpenStreetMap · Overpass', url: 'https://www.openstreetmap.org/copyright', date, year: R.osmBase ? t('src.osmSnap', { v: R.osmBase.slice(0, 10) }) : null, scope: scope || t('scope.inside'), method, license: 'ODbL 1.0' });
    const o = R.osm; const H = [];

    // 1 Location
    let b1 = row(t('r.area'), fmtArea(area.measures.area) + ` <small class="num">(${nf(area.measures.area)} m²)</small>`, 'doc', { name: t('r.geomSrc'), method: t('r.geomMethod') })
      + row(t('r.perimeter'), fmtLen(area.measures.perimeter), 'doc', null)
      + row(t('r.center'), `<span class="num">${area.spec.center[1].toFixed(5)}, ${area.spec.center[0].toFixed(5)}</span>`, 'doc', null, t('r.centerNote'));
    if (o && o.admin.length) b1 += row(t('r.admin'), o.admin.map(a => `<span class="adm"><bdi>${esc(a.name)}</bdi> <small>(${t('r.level', { v: a.level })})</small></span>`).join(' · '), 'doc', osmSrc(t('r.adminMethod'), t('scope.center')));
    b1 += taskState(T.osm, 'osm');
    H.push(sectionWrap('loc', 'Location · Límites', b1, true));

    // 2 Population
    H.push(sectionWrap('pop', 'Population · Población', gap('pop.gapT', 'pop.gapB', [t('pop.task1'), t('pop.task2')]), false));

    // 3 Buildings
    let b3 = taskState(T.osm, 'osm');
    if (o) {
      const bd = o.buildings;
      b3 += row(t('b.count'), `<span class="num">${nf(bd.count)}</span>`, 'doc', osmSrc(t('b.countMethod')))
        + row(t('b.gsi'), `<span class="num">${pct(bd.gsi, 1)}</span>`, 'est', osmSrc(t('b.gsiMethod')), t('b.gsiNote'))
        + row(t('b.levels'), t('b.of', { a: `<span class="num">${nf(bd.levelsTagged)}</span>`, b: `<span class="num">${nf(bd.count)}</span>`, p: `<span class="num">${pct(bd.levelsCoverage)}</span>` }), 'doc', osmSrc('building:levels'));
      if (bd.levelsTagged) b3 += `<div class="sub">${t('b.levelsDist')}</div>` + bars(Object.keys(bd.bands).map(k => [bandLabel(PAL.bandKey(k)), bd.bands[k], PAL.bandKey(k)]), v => nf(v), k => PAL.band[k]);
      if (bd.levelsCoverage < 0.5) b3 += gap('b.levelsGapT', 'b.levelsGapB', [t('b.levelsTask1'), t('b.levelsTask2')], { p: pct(bd.levelsCoverage) });
      if (bd.levelsCoverage >= 0.8) b3 += row(t('b.gfa'), fmtArea(bd.floorAreaTagged), 'est', osmSrc(t('b.gfaMethod')), t('b.gfaNote'));
      else b3 += `<div class="note">${t('b.noFar')}</div>`;
      if (bd.types.length) b3 += `<div class="sub">${t('b.types')}</div>` + bars(bd.types.slice(0, 6).map(x => [`<bdi>${esc(x[0])}</bdi>`, x[1]]), v => nf(v));
    }
    H.push(sectionWrap('bld', 'Buildings · Edificación', b3, true));

    // 4 Land use
    let b4 = taskState(T.osm, 'osm');
    if (o) {
      const lu = o.landuse.areas; const items = Object.keys(lu).filter(k => lu[k] > 0).map(k => [t('lu.c.' + k), lu[k], k]);
      b4 += `<div class="sub">${t('lu.tagged')}</div>` + (items.length ? bars(items, v => fmtArea(v), k => PAL.landuse[k]) : `<div class="note">${t('lu.none')}</div>`)
        + row(t('lu.unclassified'), fmtArea(o.landuse.unclassified) + ` <span class="num">(${pct(o.landuse.unclassified / o.selArea)})</span>`, 'est', osmSrc(t('lu.method', { v: nf(o.landuse.cell, 1) })), t('lu.unclassNote'));
      const pub = Object.keys(o.pois.cats).filter(k => k.startsWith('public:') || k === 'worship');
      b4 += `<div class="sub">${t('lu.public')}</div>` + (pub.length ? bars(pub.map(k => [poiLabel(k), o.pois.cats[k], k]), v => nf(v), () => PAL.poi.public) : `<div class="note">${t('lu.noPublic')}</div>`);
      const named = pub.flatMap(k => (o.pois.lists[k] || []).filter(x => x.name).map(x => `<bdi>${esc(x.name)}</bdi> <small dir="ltr">(${esc(x.kind)})</small>`));
      if (named.length) b4 += `<ul class="names">${named.slice(0, 18).map(n => `<li>${n}</li>`).join('')}${named.length > 18 ? `<li class="more">+${named.length - 18}</li>` : ''}</ul>`;
      b4 += `<div class="sub">${t('lu.parks')}</div>` + (o.pois.parks.length ? `<ul class="names">${o.pois.parks.map(p => `<li><bdi>${esc(p.name)}</bdi> <small><span dir="ltr">${esc(p.kind)}</span> · ${fmtArea(p.area)}</small></li>`).join('')}</ul>` : `<div class="note">${t('lu.noParks')}</div>`);
      b4 += `<div class="srcline">${src(osmSrc(t('lu.poiMethod')))}</div>`;
    }
    H.push(sectionWrap('lu', 'Land use · Usos del suelo', b4, false));

    // 5 Streets
    let b5 = taskState(T.osm, 'osm');
    if (o) {
      const st = o.streets;
      b5 += bars(['primary', 'collector', 'local', 'pedestrian'].map(k => [t('tier.' + k), st.tiers[k], k]), v => fmtLen(v), k => PAL.tier[k])
        + row(t('s.total'), fmtLen(st.total), 'doc', osmSrc(t('s.totalMethod')))
        + row(t('s.density'), unit(nf(st.density, 1), 'kmkm2'), 'est', osmSrc(t('s.densityMethod')))
        + row(t('s.bus'), `<span class="num">${nf(o.pois.cats['transit:bus'] || 0)}</span>`, 'doc', osmSrc('highway=bus_stop, public_transport=platform'))
        + row(t('s.rail'), `<span class="num">${nf(o.pois.cats['transit:rail'] || 0)}</span>`, 'doc', osmSrc('railway=station|tram_stop|halt'))
        + gap('s.gapT', 's.gapB', [t('s.task1'), t('s.task2')]);
    }
    H.push(sectionWrap('st', 'Streets · Red viaria', b5, false));

    // 6 Topography
    let b6 = taskState(T.terrain, 'terrain');
    if (R.profile) {
      const p = R.profile;
      b6 += `<div class="sec-switch"><button class="btn btn-small ${run.section === 'WE' ? 'on' : ''}" data-section="WE">${t('topo.we')}</button><button class="btn btn-small ${run.section === 'NS' ? 'on' : ''}" data-section="NS">${t('topo.ns')}</button></div>`
        + profileSVG(p, run.section)
        + row(t('topo.relief'), unit(nf(p.relief), 'm'), 'doc', { name: 'Open-Meteo Elevation · Copernicus DEM GLO-90', url: 'https://open-meteo.com/en/docs/elevation-api', date, scope: plain(t('topo.scope', { l: plain(fmtLen(p.length)), n: p.elev.length })), method: t('topo.method'), license: 'CC BY 4.0' })
        + row(t('topo.slope'), `<span class="num">${nf(p.maxSlopePct, 1)}${I.pctSign()}</span>`, 'est', null, t('topo.note'));
    }
    H.push(sectionWrap('topo', 'Topography · Topografía', b6, true));

    // 7 Tourism
    let b7 = taskState(T.osm, 'osm');
    if (o) {
      const c = o.pois.cats; const tour = (c['tourism:stay'] || 0) + (c['tourism:sight'] || 0) + (c['tourism:souvenir'] || 0); const day = c.everyday || 0;
      b7 += bars([[t('tour.stay'), c['tourism:stay'] || 0, 'tourism'], [t('tour.sight'), c['tourism:sight'] || 0, 'tourism'], [t('tour.souv'), c['tourism:souvenir'] || 0, 'tourism'], [t('tour.food'), c.food || 0, 'food'], [t('tour.day'), day, 'everyday']], v => nf(v), k => PAL.poi[k])
        + row(t('tour.ratio'), day ? `<span class="num">${nf(tour / day, 2)}</span>` : (tour ? t('tour.noDay') : '—'), 'est', osmSrc(t('tour.method')), t('tour.note'))
        + gap('tour.gapT', 'tour.gapB', [t('tour.task1'), t('tour.task2')]);
    }
    H.push(sectionWrap('tour', 'Tourism · Vida cotidiana', b7, false));

    // 8 History
    let b8 = taskState(T.osm, 'osm');
    if (o) {
      const bd = o.buildings;
      b8 += row(t('h.start'), `<span class="num">${nf(bd.startTagged)} (${pct(bd.startCoverage)})</span>`, 'doc', osmSrc('start_date'));
      if (bd.startTagged) b8 += bars(Object.keys(bd.periods).map(k => [periodLabel(PAL.periodKey(k)), bd.periods[k], PAL.periodKey(k)]), v => nf(v), k => PAL.period[k] || PAL.ink2);
      const her = (o.pois.lists.heritage || []); b8 += row(t('h.heritage'), `<span class="num">${nf(her.length)}</span>`, 'doc', osmSrc('historic=*, heritage=*'));
      if (her.some(h => h.name)) b8 += `<ul class="names">${her.filter(h => h.name).slice(0, 14).map(h => `<li><bdi>${esc(h.name)}</bdi> <small dir="ltr">${esc(h.kind)}</small></li>`).join('')}</ul>`;
    }
    b8 += gap('h.gapT', 'h.gapB', [t('h.task1'), `<a href="https://fototeca.cnig.es/" target="_blank" rel="noopener">Fototeca CNIG</a> — ${t('h.task2')}`, `<a href="https://www.davidrumsey.com/luna/servlet/view/search?q=Granada" target="_blank" rel="noopener">David Rumsey</a> — ${t('h.task3')}`]);
    H.push(sectionWrap('hist', 'History · Historia', b8, false));

    // 9 Climate
    let b9 = taskState(T.climate, 'climate');
    if (R.climate) {
      const c = R.climate; const cs = { name: 'Open-Meteo Historical · ERA5', url: 'https://open-meteo.com/en/docs/historical-weather-api', date, year: c.year, scope: t('c.scope', { v: nf(c.gridLat, 3) + ', ' + nf(c.gridLon, 3) }), method: t('c.method'), license: 'CC BY 4.0' };
      b9 += climateSVG(c)
        + row(t('c.hot', { y: c.year }), `<span class="num">${nf(c.hot35)}</span>`, 'doc', cs)
        + row(t('c.trop', { y: c.year }), `<span class="num">${nf(c.trop20)}</span>`, 'doc', cs)
        + row(t('c.rain', { y: c.year }), unit(nf(c.precip), 'mm'), 'doc', cs);
    }
    if (o) { const g = o.landuse.areas.green || 0; b9 += row(t('c.green'), fmtArea(g) + ` <span class="num">(${pct(g / o.selArea, 1)})</span>`, 'est', osmSrc(t('c.greenMethod')), t('c.greenNote')); }
    b9 += gap('c.gapT', 'c.gapB', [t('c.task1'), t('c.task2')]);
    H.push(sectionWrap('clim', 'Climate · Clima', b9, false));

    H.push(sectionWrap('reg', 'Planning · Planeamiento', gap('reg.gapT', 'reg.gapB', [t('reg.task1'), t('reg.task2')]), false));
    H.push(sectionWrap('life', 'Everyday life · Espacio público', gap('life.gapT', 'life.gapB', [t('life.task1'), t('life.task2')]), false));
    let b12 = o ? row(t('roof.shape'), `<span class="num">${nf(o.buildings.roofShape)}</span>`, 'doc', osmSrc('roof:shape')) : '';
    b12 += gap('roof.gapT', 'roof.gapB', [t('roof.task1'), t('roof.task2')]);
    H.push(sectionWrap('roof', 'Roofs · Construcción', b12, false));

    // 13 Photos
    let b13 = taskState(T.photos, 'photos');
    if (R.photos) {
      const ins = R.photos.filter(p => p.inside), near = R.photos.filter(p => !p.inside);
      b13 += `<div class="note">${t('ph.count', { a: nf(ins.length), b: nf(near.length) })}</div>`;
      const card = (p) => `<figure class="ph"><a href="${esc(p.page)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(p.thumb)}" alt="${esc(p.title)}"></a>
        <figcaption><bdi>${esc((p.author || t('ph.noAuthor')).slice(0, 40))}</bdi> · <span dir="ltr">${esc(p.license || '?')}</span>${p.date ? ` · <span dir="ltr">${esc(p.date.slice(0, 10))}</span>` : ''}${p.inside ? '' : ` · <em>${t('ph.outside')}</em>`}
        <button class="btn btn-tiny" data-wall="${esc(p.id)}">${t('ph.toWall')}</button></figcaption></figure>`;
      b13 += `<div class="photos">${ins.concat(near).slice(0, 24).map(card).join('')}</div>`;
    }
    H.push(sectionWrap('ph', 'Photographs · Fotografías', b13, true));

    // 14 Literature
    let b14 = taskState(T.wiki, 'wiki');
    if (R.wiki) b14 += R.wiki.length ? `<ul class="refs">${R.wiki.slice(0, 20).map(w => `<li><a href="${esc(w.url)}" target="_blank" rel="noopener" dir="auto">${esc(w.title)}</a> <small><span dir="ltr">${w.lang}</span> · ${t('lit.dist', { v: nf(w.dist) })}</small></li>`).join('')}</ul>` : `<div class="note">${t('lit.noWiki')}</div>`;
    b14 += `<div class="sub">${t('lit.research')} <small>${t('lit.unreviewed')}</small></div>` + taskState(T.research, 'research');
    if (R.research) b14 += R.research.length ? `<ul class="refs">${R.research.map(r => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener" dir="auto">${esc(r.title)}</a> <small><bdi>${esc(r.authors)}</bdi> · <span class="num">${r.year || ''}</span>${r.venue ? ' · <bdi>' + esc(r.venue) + '</bdi>' : ''}${r.oa ? ' · ' + t('lit.oa') : ''}</small></li>`).join('')}</ul><div class="srcline">${src({ name: 'OpenAlex', url: 'https://openalex.org', date, method: t('lit.query', { v: R.researchQuery || '' }), license: 'CC0' })}</div>` : `<div class="note">${t('none')}</div>`;
    H.push(sectionWrap('lit', 'Literature · Bibliografía', b14, false));

    // Observations (user text shown as written)
    const topicKeys = ['', 'bld', 'lu', 'st', 'topo', 'tour', 'hist', 'clim', 'life', 'ph'];
    const tlabel = (k) => k ? t('t.' + k) : t('obs.general');
    const obs = observations.map(x => `<li>${badge(x.kind)} <bdi class="user-text">${esc(x.text)}</bdi> <small>${esc(tlabel(x.topic || ''))} · <span dir="ltr">${x.created.slice(0, 10)}</span></small> <button class="btn btn-tiny" data-delobs="${x.id}">${t('delete')}</button></li>`).join('');
    H.push(`<section class="obs" id="topic-obs"><h3>${t('t.obs')}</h3><ul class="obs-list">${obs || `<li class="note">${t('obs.empty')}</li>`}</ul>
      <div class="obs-form"><textarea id="obs-text" rows="2" dir="auto" placeholder="${esc(t('obs.ph'))}"></textarea>
      <div class="obs-row"><select id="obs-kind"><option value="obs">${t('st.obs')}</option><option value="hyp">${t('st.hyp')}</option></select><select id="obs-topic">${topicKeys.map(k => `<option value="${k}">${tlabel(k)}</option>`).join('')}</select><button class="btn" id="obs-add">${t('save')}</button></div></div></section>`);
    return H.join('');
  }

  root.GA = root.GA || {};
  root.GA.report = { render, esc, iso, nf, pct, fmtArea, fmtLen, unit, badge, bandLabel, periodLabel, STATUS };
})(window);
