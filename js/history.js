/* Historical map explorer (after the Stanford "Interactive Nolli Map" idea of layered reading):
   georeferenced historical maps and orthophotos from the IGN, overlaid on today's map with
   visibility, opacity, a period selector and a before/after swipe. Each layer states the period
   it depicts and how its date is known (survey, edition, flight). Archival scans that are NOT
   georeferenced (Vico c. 1612, the 1795 plan, guidebook maps …) stay in an archive viewer and are
   never draped over the map. Places link to live Wikipedia summaries; a small editable collage
   collects archive images, map fragments and captions. */
(function (root) {
  const { i18n: I, pages: PG, ext: X, store, basemap } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc;
  // archival scans on Wikimedia Commons (metadata checked 31 Oct 2026; fetched live for attribution)
  const ARCHIVE = [
    { file: 'Grenada (1581).jpg', pub: 'c. 1581–1600', dep: 'the city in the late 16th century (bird’s-eye view)', who: 'after Sebastian Münster, Cosmographia', kind: 'view' },
    { file: 'Plataforma de Vico grabada por Francisco Heylan unida.jpg', pub: 'engraved c. 1612 (Francisco Heylan)', dep: 'Granada as drawn by Ambrosio de Vico, late 16th – early 17th century; drawing date not stated on Commons', who: 'Ambrosio de Vico (drawing), Francisco Heylan (engraving)', kind: 'plan' },
    { file: 'Plano de Granada 1795.jpeg', pub: '1795 (in Mármol Carvajal, Historia del rebelión…, 1797 edition)', dep: 'an 18th-century re-engraving after Vico — it depicts the early-17th-century city, not 1795', who: 'after Ambrosio de Vico; engraved by Félix Prieto', kind: 'plan' },
    { file: 'Tomás López Maño 1787 Alcaicería Granada.jpg', pub: '1787', dep: 'the Alcaicería silk market before the 1843 fire', who: 'Tomás López Maño', kind: 'plan' },
    { file: 'Almanjaya Baja. Plano topografico Granada Francisco Dalmau (1796).jpg', pub: '1796 (detail of the topographic plan)', dep: 'the lower Almanjáyar area in 1796 (detail only)', who: 'Francisco Dalmau', kind: 'plan' },
    { file: "O'SHEAS (1895) p305 GRANADA.jpg", pub: '1895 (O’Shea’s guide to Spain and Portugal)', dep: 'the city around 1895; survey date not stated', who: 'O’Shea’s guide', kind: 'plan' },
    { file: '1915 Granada.jpg', pub: '1915 (Guide Joanne, Espagne et Portugal)', dep: 'the city around 1915; survey date not stated', who: 'Paul Joanne, Ernest Franco', kind: 'plan' },
    { file: 'Map by the US Army Map Service - Granada - spain city plans - txu-pclmaps-oclc-6482717-granada.jpg', pub: '1943 (US Army Map Service, 1:5,000)', dep: 'compiled from earlier sources; survey date not stated', who: 'United States Army Map Service', kind: 'plan' },
  ];
  const PLACES = [
    { wiki: 'Alhambra' }, { wiki: 'Albaicín' }, { wiki: 'Sacromonte' }, { wiki: 'Catedral_de_Granada' }, { wiki: 'Plaza_de_Bib-Rambla' },
    { wiki: 'Alcaicería_de_Granada', ll: [-3.5989, 37.1757], approx: true }, { wiki: 'Embovedado_del_Darro', ll: [-3.5972, 37.1758], approx: true },
    { wiki: 'Plaza_Nueva_(Granada)' }, { wiki: 'Gran_Vía_de_Colón' }, { wiki: 'Realejo-San_Matías' }, { wiki: 'Cartuja_de_Granada' }, { wiki: 'Almanjáyar' },
  ];
  let maps = null; let meta = {}; let wiki = {};
  const H = () => { const p = store.get(); p.history = p.history || { a: 'ams56', b: 'pnoa2024', opacity: 0.85, swipe: false, pos: 50, collage: [] }; return p.history; };
  const histTiles = (h) => `${h.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${h.layer}&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=${encodeURIComponent(h.fmt)}`;

  async function commonsMeta(files) {
    const need = files.filter(f => !meta[f]); if (need.length) {
      const u = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*&action=query&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=900&titles=' + encodeURIComponent(need.map(f => 'File:' + f).join('|'));
      const j = await root.GA.sources.fetchJSON(u, { timeout: 25000 }); if (j.error) throw new Error(j.error.info || j.error.code);
      Object.values((j.query && j.query.pages) || {}).forEach(p => { const ii = (p.imageinfo || [])[0] || {}; const m = ii.extmetadata || {}; const s = (v) => String((v && v.value) || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); meta[p.title.replace(/^File:/, '')] = { thumb: ii.thumburl, url: ii.url, page: ii.descriptionurl, w: ii.width, h: ii.height, author: s(m.Artist), license: s(m.LicenseShortName), date: s(m.DateTimeOriginal).replace(/date QS.*$/, '').trim() }; });
    }
    return files.map(f => meta[f]);
  }
  async function wikiSummary(title) {
    if (wiki[title]) return wiki[title];
    const out = {}; for (const lang of [I.lang === 'en' ? 'en' : I.lang, 'es']) { try { const r = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`); if (!r.ok) continue; const j = await r.json(); Object.assign(out, { title: j.title, extract: j.extract, thumb: j.thumbnail && j.thumbnail.source, url: j.content_urls && j.content_urls.desktop.page, ll: j.coordinates ? [j.coordinates.lon, j.coordinates.lat] : null, lang: 'es' }); break; } catch (e) { } }
    wiki[title] = out; return out;
  }

  async function render(body) {
    const S = H(); if (maps) { try { maps.forEach(m => m.remove()); } catch (e) { } maps = null; }
    const opt = (sel) => X.HIST.map(h => `<option value="${h.id}" ${sel === h.id ? 'selected' : ''}>${h.period} — ${t('hist.' + h.id)}</option>`).join('');
    body.innerHTML = `<div class="hx">
      <aside class="hx-side"><div class="sub">${t('hx.layers')}</div>
        <div class="hx-periods">${X.HIST.map(h => `<button class="hx-chip ${S.a === h.id ? 'on' : ''}" data-hx-a="${h.id}"><b class="num">${h.period}</b><span>${t('hist.' + h.id)}</span><small>${t(h.kind === 'photo' ? 'ly3.histPhoto' : 'ly3.histMap')}</small></button>`).join('')}</div>
        <label class="chk"><input type="checkbox" id="hx-vis" ${S.hidden ? '' : 'checked'}> ${t('hx.visible')}</label>
        <label class="row2">${t('ly.opacity')} <input type="range" id="hx-op" min="0" max="1" step="0.05" value="${S.opacity}"></label>
        <label class="chk"><input type="checkbox" id="hx-swipe" ${S.swipe ? 'checked' : ''}> ${t('hx.swipe')}</label>
        ${S.swipe ? `<label class="row2">${t('hx.right')} <select id="hx-b">${opt(S.b)}</select></label>` : ''}
        <div class="hx-info" id="hx-info"></div>
        <p class="fine">${t('hx.alignNote')}</p>
        <div class="actions"><button class="btn btn-small" id="hx-frag">${t('hx.fragment')}</button></div>
      </aside>
      <div class="hx-mapwrap"><div id="hx-map-a" class="hx-map"></div>${S.swipe ? `<div id="hx-map-b" class="hx-map hx-top" style="clip-path:inset(0 0 0 ${S.pos}%)"></div><input type="range" id="hx-pos" class="hx-pos" min="0" max="100" value="${S.pos}" aria-label="${esc(t('hx.swipe'))}"><div class="hx-tag l">${esc(X.HIST.find(h => h.id === S.a).period)}</div><div class="hx-tag r">${esc(X.HIST.find(h => h.id === S.b).period)}</div>` : ''}</div>
    </div>
    <section class="hx-sec"><h3>${t('hx.places')}</h3><div class="hx-places" id="hx-places"><span class="spin"></span></div></section>
    <section class="hx-sec"><h3>${t('hx.archive')}</h3><p class="fine">${t('hx.archiveNote')}</p><div class="hx-arch" id="hx-arch"><span class="spin"></span></div></section>
    <section class="hx-sec hx-collage-sec"><h3>${t('hx.collage')}</h3><p class="fine">${t('hx.collageNote')}</p><div class="hx-collage" id="hx-collage"></div></section>`;
    buildMaps(body); renderPlaces(body); renderArchive(body); renderCollage(body); bind(body);
  }
  function buildMaps(body) {
    const S = H(); const mk = (id, hid) => { const m = new maplibregl.Map({ container: id, style: basemap.style(), center: S.center || [-3.5986, 37.1773], zoom: S.zoom || 14, minZoom: 11, maxZoom: 19, attributionControl: false, dragRotate: false, preserveDrawingBuffer: true });
      m.on('load', () => { const h = X.HIST.find(x => x.id === hid); m.addSource('hx', { type: 'raster', tiles: [histTiles(h)], tileSize: 256, attribution: '© IGN / CNIG' }); m.addLayer({ id: 'hx', type: 'raster', source: 'hx', paint: { 'raster-opacity': S.opacity, 'raster-fade-duration': 0 }, layout: { visibility: S.hidden ? 'none' : 'visible' } }, m.getLayer('label-water') ? 'label-water' : undefined); }); return m; };
    const a = mk('hx-map-a', S.a); a.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right'); a.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left'); a.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© IGN / CNIG (CC BY 4.0) · © OpenStreetMap' }), 'bottom-right');
    maps = [a];
    if (S.swipe) { const b = mk('hx-map-b', S.b); maps.push(b); let lock = false; const sync = (src, dst) => src.on('move', () => { if (lock) return; lock = true; dst.jumpTo({ center: src.getCenter(), zoom: src.getZoom() }); lock = false; }); sync(a, b); sync(b, a); }
    a.on('moveend', () => { const S2 = H(); S2.center = a.getCenter().toArray(); S2.zoom = a.getZoom(); updateInfo(body); });
    a.on('load', () => updateInfo(body));
    a.on('click', async (e) => { const S2 = H(); const h = X.HIST.find(x => x.id === S2.a); const r = await X.histInfo(h, [e.lngLat.lng, e.lngLat.lat]).catch(() => null); if (r) new maplibregl.Popup({ className: 'atlas-popup' }).setLngLat(e.lngLat).setHTML(`<b>${esc(t('hist.' + h.id))}</b><br>${histLine(h, r)}`).addTo(a); });
  }
  function histLine(h, r) { return `${r.name ? `<bdi>${esc(r.name)}</bdi> · ` : ''}${r.sheet ? t('ly3.sheet') + ' ' + esc(r.sheet) + ' · ' : ''}${r.year ? `${t(h.id === 'minutas' ? 'hx.surveyed' : 'fb.edition')} <b class="num">${esc(r.year)}</b>` : ''}${r.flights && r.flights.length ? t('ly3.flights') + ' <span class="num">' + r.flights.join(', ') + '</span>' : ''}${r.editions ? `<br><small>${t('ly3.editions')} <span class="num">${r.editions.join(', ')}</span></small>` : ''}`; }
  async function updateInfo(body) {
    const S = H(); const h = X.HIST.find(x => x.id === S.a); const box = body.querySelector('#hx-info'); if (!box || !maps) return; const c = maps[0].getCenter();
    box.innerHTML = `<b>${esc(t('hist.' + h.id))}</b><p class="fine">${t('hx.k.' + h.id)}</p><p class="fine">${t('hx.atCentre')} <span class="spin"></span></p>`;
    try { const r = await X.histInfo(h, [c.lng, c.lat]); box.lastElementChild.innerHTML = `${t('hx.atCentre')} ${histLine(h, r) || t('nodata')}`; } catch (e) { box.lastElementChild.textContent = t('hx.infoFail'); }
  }
  async function renderPlaces(body) {
    const box = body.querySelector('#hx-places'); const out = [];
    for (const p of PLACES) { const w = await wikiSummary(p.wiki); if (!w.title) continue; out.push(Object.assign({}, p, w, { ll: w.ll || p.ll })); }
    box.innerHTML = out.map((p, i) => `<article class="hx-place"><button class="link" data-hx-fly="${i}"><b dir="auto">${esc(p.title)}</b></button>${p.approx ? ` <small>${t('hx.approxPos')}</small>` : ''}<p dir="auto">${esc((p.extract || '').slice(0, 260))}${(p.extract || '').length > 260 ? '…' : ''}</p><small><a href="${esc(p.url)}" target="_blank" rel="noopener">Wikipedia (es) ↗</a> · CC BY-SA 4.0</small></article>`).join('') || `<p class="note">${t('hx.placesFail')}</p>`;
    box.onclick = (e) => { const b = e.target.closest('[data-hx-fly]'); if (!b || !maps) return; const p = out[+b.dataset.hxFly]; if (!p.ll) return; maps[0].flyTo({ center: p.ll, zoom: 17 }); new maplibregl.Popup({ className: 'atlas-popup' }).setLngLat(p.ll).setHTML(`<b dir="auto">${esc(p.title)}</b>${p.approx ? `<br><small>${t('hx.approxPos')}</small>` : ''}`).addTo(maps[0]); };
    if (maps) out.forEach(p => { if (!p.ll) return; const el = document.createElement('div'); el.className = 'hx-pin'; el.title = p.title; new maplibregl.Marker({ element: el }).setLngLat(p.ll).addTo(maps[0]); });
  }
  async function renderArchive(body) {
    const box = body.querySelector('#hx-arch');
    try {
      const M = await commonsMeta(ARCHIVE.map(a => a.file));
      box.innerHTML = ARCHIVE.map((a, i) => { const m = M[i] || {}; return `<figure class="hx-item"><button class="hx-thumb" data-hx-view="${i}">${m.thumb ? `<img src="${esc(m.thumb)}" alt="" loading="lazy" crossorigin="anonymous">` : ''}</button><figcaption><b>${t('hx.published')}:</b> <span dir="ltr">${esc(a.pub)}</span><br><b>${t('hx.depicts')}:</b> <span dir="ltr">${esc(a.dep)}</span><br><small dir="ltr">${esc(a.who)} · ${esc(m.license || '')} · <a href="${esc(m.page || '#')}" target="_blank" rel="noopener">Commons ↗</a></small><br><span class="tag">${t('hx.notGeoref')}</span> <button class="btn btn-tiny" data-hx-col="${i}">${t('hx.toCollage')}</button> <button class="btn btn-tiny" data-hx-fab="${i}">${t('hx.toFabric')}</button></figcaption></figure>`; }).join('');
    } catch (e) { box.innerHTML = `<div class="error">${t('hx.archFail', { e: esc(e.message) })}</div>`; }
  }
  function viewer(i) {
    const a = ARCHIVE[i], m = meta[a.file] || {}; const md = document.getElementById('modal'); let z = 1;
    md.innerHTML = `<div class="modal-box hx-viewer"><div class="modal-h"><h3 dir="ltr">${esc(a.file.replace(/\.[^.]+$/, ''))}</h3><div class="actions"><button class="btn btn-small" data-z="1.4">＋</button><button class="btn btn-small" data-z="0.7">－</button><button class="btn btn-small" data-modal-close>✕</button></div></div><div class="modal-b" style="flex-direction:column"><div class="hx-zoom"><img src="${esc(m.url || m.thumb)}" alt="" id="hx-big"></div><p class="fine"><b>${t('hx.published')}:</b> <span dir="ltr">${esc(a.pub)}</span> · <b>${t('hx.depicts')}:</b> <span dir="ltr">${esc(a.dep)}</span> · <span dir="ltr">${esc(a.who)} · ${esc(m.author || '')} · ${esc(m.license || '')}</span> · <a href="${esc(m.page)}" target="_blank" rel="noopener">Commons ↗</a></p><p class="warn">${t('hx.notGeorefLong')}</p></div></div>`;
    md.hidden = false; md.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { z = Math.max(0.3, Math.min(6, z * +b.dataset.z)); md.querySelector('#hx-big').style.width = (z * 100) + '%'; });
  }
  async function renderCollage(body) {
    const S = H(); const box = body.querySelector('#hx-collage');
    const items = await Promise.all(S.collage.map(async c => { if (c.lib && root.GA.library) { const it = await root.GA.library.get(c.lib); return Object.assign({}, c, { thumb: it && it.thumb, src: it && it.source }); } if (c.file) { const m = meta[c.file] || (await commonsMeta([c.file]))[0] || {}; return Object.assign({}, c, { thumb: m.thumb, src: (ARCHIVE.find(a => a.file === c.file) || {}).who + ' · ' + (m.license || '') }); } return c; }));
    box.innerHTML = items.length ? items.map((c, i) => `<figure class="hx-cc"><div class="hx-cc-img">${c.thumb ? `<img src="${esc(c.thumb)}" alt="">` : ''}</div><textarea dir="auto" rows="2" data-hx-cap="${i}" placeholder="${esc(t('fb.captionPh'))}">${esc(c.caption || '')}</textarea><small dir="ltr">${esc(c.src || '')}</small><div class="card-tools"><button class="icon-btn" data-hx-mv="${i}:-1">←</button><button class="icon-btn" data-hx-mv="${i}:1">→</button><button class="icon-btn" data-hx-rm="${i}">✕</button></div></figure>`).join('') + `<div class="actions"><button class="btn btn-small" id="hx-col-png">${t('g.png')}</button></div>` : `<p class="note">${t('hx.collageEmpty')}</p>`;
  }
  async function collagePNG() {
    const S = H(); const sh = PG.sheet(420, 297, 120); const { cv, ctx, W, H: Hh } = sh; let y = PG.header(ctx, W, t('hx.collage'), t('hx.collageSub'), { scale: 0.8 }); const cols = 4, gap = 24, M = 48, pw = Math.floor((W - 2 * M - 3 * gap) / cols), ph = Math.round(pw * 0.72); const rtl = I.dir() === 'rtl';
    for (let i = 0; i < S.collage.length && i < 8; i++) { const c = S.collage[i]; let src = null; if (c.file) src = (meta[c.file] || {}).thumb; if (c.lib) { const it = await root.GA.library.get(c.lib); src = it && it.thumb; } const x = rtl ? W - M - (i % cols + 1) * pw - (i % cols) * gap : M + (i % cols) * (pw + gap), yy = y + 20 + Math.floor(i / cols) * (ph + 110); if (src) { try { const im = await X.loadImage(src, 20000); PG.drawImageFit(ctx, im, x, yy, pw, ph, false); } catch (e) { } } ctx.font = `15px ${PG.font()}`; ctx.fillStyle = '#1C1E21'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.direction = rtl ? 'rtl' : 'ltr'; PG.wrap(ctx, c.caption || '', rtl ? x + pw : x, yy + ph + 24, pw, 20, 3); }
    PG.footer(ctx, W, Hh, t('hx.collageFoot'), 0.8); PG.download(await PG.toBlob(cv), 'granada_history_collage.png');
  }
  function bind(body) {
    const S = H(); const save = () => store.save();
    body.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.hxA) { S.a = b.dataset.hxA; save(); return render(body); }
      if (b.dataset.hxView != null) return viewer(+b.dataset.hxView);
      if (b.dataset.hxCol != null) { S.collage.push({ file: ARCHIVE[+b.dataset.hxCol].file, caption: '' }); save(); return renderCollage(body); }
      if (b.dataset.hxFab != null) return toFabric(ARCHIVE[+b.dataset.hxFab]);
      if (b.dataset.hxMv) { const [i, d] = b.dataset.hxMv.split(':').map(Number); const j = i + d; if (j < 0 || j >= S.collage.length) return; const [x] = S.collage.splice(i, 1); S.collage.splice(j, 0, x); save(); return renderCollage(body); }
      if (b.dataset.hxRm != null) { S.collage.splice(+b.dataset.hxRm, 1); save(); return renderCollage(body); }
      if (b.id === 'hx-col-png') return collagePNG();
      if (b.id === 'hx-frag') { if (!maps || !root.GA.library) return; const h = X.HIST.find(x => x.id === S.a); try { const blob = await PG.toBlob(maps[0].getCanvas()); const c = maps[0].getCenter(); const it = await root.GA.library.addBlob(blob, { title: `${t('hist.' + h.id)} (${h.period}) — ${t('hx.fragment')}`, kind: 'image', source: 'IGN / CNIG — ' + h.layer + ' (CC BY 4.0) · © OpenStreetMap', date: h.period, loc: [c.lng, c.lat], tags: ['history', 'map fragment'], links: { themes: ['history'] } }); S.collage.push({ lib: it.id, caption: `${t('hist.' + h.id)} · ${h.period}` }); save(); renderCollage(body); root.GA.toast && root.GA.toast(t('lib.added')); } catch (er) { root.GA.toast && root.GA.toast(er.message, true); } }
    };
    body.onchange = (e) => { const el = e.target; if (el.id === 'hx-vis') { S.hidden = !el.checked; save(); maps && maps.forEach(m => m.getLayer('hx') && m.setLayoutProperty('hx', 'visibility', S.hidden ? 'none' : 'visible')); } if (el.id === 'hx-swipe') { S.swipe = el.checked; save(); render(body); } if (el.id === 'hx-b') { S.b = el.value; save(); render(body); } if (el.dataset.hxCap != null) { S.collage[+el.dataset.hxCap].caption = el.value; save(); } };
    body.oninput = (e) => { const el = e.target; if (el.id === 'hx-op') { S.opacity = +el.value; maps && maps.forEach(m => m.getLayer('hx') && m.setPaintProperty('hx', 'raster-opacity', S.opacity)); save(); } if (el.id === 'hx-pos') { S.pos = +el.value; const top = body.querySelector('#hx-map-b'); if (top) top.style.clipPath = `inset(0 0 0 ${S.pos}%)`; } };
  }
  async function toFabric(a) {
    const A = store.get().areas; const m = document.getElementById('modal'); if (!root.GA.library) return;
    m.innerHTML = `<div class="modal-box"><div class="modal-h"><h3>${t('hx.toFabric')}</h3><button class="btn btn-small" data-modal-close>✕</button></div><div class="modal-b" style="flex-direction:column">${A.length ? A.map(x => `<label class="chk"><input type="checkbox" value="${x.id}"> <bdi>${esc(x.name)}</bdi></label>`).join('') : `<p class="note">${t('ws.noAreas')}</p>`}<div class="actions"><button class="btn btn-primary" id="hx-fab-ok">${t('save')}</button></div></div></div>`;
    m.hidden = false; m.querySelector('#hx-fab-ok').onclick = async () => { const ids = [...m.querySelectorAll('input:checked')].map(x => x.value); const md = meta[a.file] || {}; await root.GA.library.addItem({ kind: 'link', title: a.file.replace(/\.[^.]+$/, ''), url: md.page, source: `${a.who} · ${md.license || ''} (Wikimedia Commons)`, date: a.pub, excerpt: `${t('hx.depicts')}: ${a.dep}`, thumb: md.thumb, tags: ['history', 'archive'], links: { fabrics: ids, themes: ['history'] } }); m.hidden = true; root.GA.toast && root.GA.toast(t('lib.added')); };
  }

  PG.register('history', { plate: () => t('hx.plate'), title: () => t('hx.title'), render });
  root.GA.historyExplorer = { ARCHIVE, PLACES };
})(window);
