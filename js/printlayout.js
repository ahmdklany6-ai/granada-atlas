/* Print layout (#/print): one page composed from the current map view, its legend, an optional street section and an
   optional image, at a chosen paper size (A4–A1), orientation, margins, map scale and output resolution.
   Map scale and image resolution are independent: the map is rendered so that 1 mm on paper = N mm on the ground when
   the page is printed at 100 % (actual size), whatever the dpi; the dpi only sets how many pixels describe each mm.
   The scale is exact at the map centre (Web Mercator varies by < 0.1 % across a city-scale frame) and is re-measured
   from the rendered map and printed on the page. Nothing is uploaded: the page is built in this browser. */
(function (root) {
  const { i18n: I, pages: PG, store } = root.GA; const t = (k, v) => I.t(k, v); const esc = PG.esc, nf = PG.nf;
  const P = () => root.GA.palette;
  const PAPERS = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841] };
  const SCALES = [500, 1000, 2000, 2500, 5000, 10000, 25000, 50000];
  const MAX_PAGE_PX = 40e6, MAX_TEX = 8000; // browser limits: page canvas area, WebGL map canvas side
  // slots: what goes where. Templates divide the body; each slot holds one item (map, legend, section, analysis card,
  // wind rose, rainfall chart, uploaded image) with its own caption. Maps carry their own scale.
  const st = { paper: 'A3', orient: 'landscape', margin: 12, dpi: 200, title: '', subtitle: '', template: 'side',
    slots: [{ type: 'map', denom: 5000, caption: '' }, { type: 'legend', caption: '' }, { type: 'none', caption: '' }, { type: 'none', caption: '' }], images: [] };
  const TEMPLATES = { side: 4, top3: 4, grid: 4, single: 1 };
  const pageMm = () => { const [a, b] = PAPERS[st.paper]; return st.orient === 'landscape' ? [b, a] : [a, b]; };
  const ptOf = (mm) => mm / 25.4 * 72;
  function effDpi(dpi) { const [w, h] = pageMm(); let d = dpi; while ((w / 25.4 * d) * (h / 25.4 * d) > MAX_PAGE_PX) d -= 25; return Math.max(72, d); }
  // slot rectangles in mm for the chosen template (gap 6 mm; caption band 5 mm inside each rectangle)
  function layout() {
    const [W, H] = pageMm(); const m = st.margin; const head = 22, foot = 16; const B = { x: m, y: m + head, w: W - 2 * m, h: H - 2 * m - head - foot }; const g = 6; let R;
    if (st.template === 'single') R = [B];
    else if (st.template === 'grid') { const w = (B.w - g) / 2, h = (B.h - g) / 2; R = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, k]) => ({ x: B.x + i * (w + g), y: B.y + k * (h + g), w, h })); }
    else if (st.template === 'top3') { const h1 = B.h * 0.64, h2 = B.h - h1 - g, w = (B.w - 2 * g) / 3; R = [{ x: B.x, y: B.y, w: B.w, h: h1 }].concat([0, 1, 2].map(i => ({ x: B.x + i * (w + g), y: B.y + h1 + g, w, h: h2 }))); }
    else { const w1 = B.w * 0.7, w2 = B.w - w1 - g, h = (B.h - 2 * g) / 3; R = [{ x: B.x, y: B.y, w: w1, h: B.h }].concat([0, 1, 2].map(i => ({ x: B.x + w1 + g, y: B.y + i * (h + g), w: w2, h }))); }
    return { W, H, m, head, foot, rects: R };
  }
  // ---------- the map at a true scale ----------
  async function renderMap(frameMm, dpi, denom) {
    const main = root.GA.app.map; const c = main.getCenter(); const cssW = Math.round(frameMm.w / 25.4 * 96), cssH = Math.round(frameMm.h / 25.4 * 96);
    let pr = dpi / 96; pr = Math.min(pr, MAX_TEX / cssW, MAX_TEX / cssH); const mppCss = denom * 0.0254 / 96; // ground metres per CSS px at 1:N
    const zoom = Math.log2(40075016.686 * Math.cos(c.lat * Math.PI / 180) / (512 * mppCss));
    const div = document.createElement('div'); div.style.cssText = `position:fixed;left:-20000px;top:0;width:${cssW}px;height:${cssH}px;`; document.body.appendChild(div);
    const m = new maplibregl.Map({ container: div, style: main.getStyle(), center: c, zoom, bearing: 0, pitch: 0, pixelRatio: pr, interactive: false, preserveDrawingBuffer: true, attributionControl: false, fadeDuration: 0 });
    m.on('styleimagemissing', (e) => { try { const im = main.style && main.style.getImage && main.style.getImage(e.id); if (im) m.addImage(e.id, im.data, { pixelRatio: im.pixelRatio }); else if (e.id === 'ga-hatch') { const n = 8, d = new Uint8Array(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4, on = (x + y) % n === 0; d[o] = d[o + 1] = d[o + 2] = on ? 138 : 255; d[o + 3] = on ? 255 : 230; } m.addImage('ga-hatch', { width: n, height: n, data: d }); } } catch (err) { } });
    await new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; m.once('idle', fin); setTimeout(fin, 45000); });
    // re-measure the scale on the rendered map: ground distance across the frame's middle row / frame width on paper
    const a = m.unproject([0, cssH / 2]), b = m.unproject([cssW, cssH / 2]); const ground = root.GA.geo.haversine([a.lng, a.lat], [b.lng, b.lat]); const measured = ground * 1000 / frameMm.w;
    const img = document.createElement('canvas'); img.width = m.getCanvas().width; img.height = m.getCanvas().height; img.getContext('2d').drawImage(m.getCanvas(), 0, 0);
    m.remove(); div.remove();
    return { img, measured, mapDpi: pr * 96 }; // metres on the ground per mm on paper
  }
  // ---------- legend read from the live legend markup (same colours as the map) ----------
  function legendItems() {
    const html = root.GA.app.L.legendHTML ? root.GA.app.L.legendHTML() : (document.querySelector('#legend') || {}).innerHTML || '';
    const box = document.createElement('div'); box.className = 'legend'; box.style.cssText = 'position:fixed;left:-9999px;top:0;width:260px;display:block'; box.innerHTML = html; document.body.appendChild(box);
    const out = []; box.querySelectorAll('h4, li, img.lg-rose').forEach(e => { if (e.tagName === 'H4') out.push({ h: e.innerText.trim() });
      else if (e.tagName === 'IMG') out.push({ img: e.src }); else { const sw = e.querySelector('i.sw'); if (!sw) return; const cs = getComputedStyle(sw);
        out.push({ text: e.innerText.trim(), kind: sw.classList.contains('ln') ? 'line' : sw.classList.contains('dot') ? 'dot' : sw.classList.contains('hatch') ? 'hatch' : 'box', bg: cs.backgroundColor, bc: cs.borderTopColor, bw: parseFloat(cs.borderTopWidth) || 0, bs: cs.borderTopStyle, op: parseFloat(cs.opacity) || 1 }); } });
    box.remove(); return out;
  }
  const activeSources = () => { const L = root.GA.app.L; return Object.keys(L.S).filter(k => L.S[k].on && L.byId[k]).map(k => { try { return L.byId[k].src(); } catch (e) { return null; } }).filter(Boolean); };
  const allSections = () => { const p = store.get(); return (p.sections || []).map(s => ({ s, label: s.name })).concat(...p.areas.map(a => (a.sections || []).map(s => ({ s, label: a.name + ' · ' + s.name })))); };
  // items available for the slots
  const cards = () => [...document.querySelectorAll('#left-body .card')].map((c, i) => ({ i, title: (c.querySelector('h3, h4, .card-t') || {}).innerText || ('#' + (i + 1)), cv: c.querySelector('canvas') })).filter(x => x.cv && x.cv.width);
  function itemOptions(slot) {
    const L = root.GA.app.L; const o = [['none', t('pl.none')], ['map', t('pl.itMap')], ['legend', t('pl.legend')]];
    allSections().forEach(x => o.push(['section:' + x.s.id, t('pl.section') + ': ' + x.label]));
    cards().forEach(c => o.push(['card:' + c.i, t('pl.itCard') + ': ' + c.title]));
    if (L.byId.wind && L.byId.wind._url) o.push(['chart:wind', t('v9.lyWind') + ' (' + t('v9.s.' + L.S.wind.opts.season) + ')']);
    if (L.byId.rain && L.byId.rain._st) o.push(['chart:rain', t('v9.rainMonthly')]);
    st.images.forEach((im, i) => o.push(['image:' + i, t('pl.image') + ' ' + (i + 1) + (im.caption ? ': ' + im.caption : '')]));
    const cur = slot.type === 'section' || slot.type === 'card' || slot.type === 'chart' || slot.type === 'image' ? slot.type + ':' + slot.ref : slot.type;
    return o.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
  }
  const svgImage = (svg) => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.includes('xmlns') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')));
  async function drawLegend(g, X, r, F, rtl) {
    const C = P(); const items = legendItems(); let y = r.y; const cx = r.x, cw = r.w; const lx = rtl ? cx + cw : cx; g.textAlign = rtl ? 'right' : 'left';
    g.fillStyle = C.ink; g.font = `700 ${X(3.4)}px ${F}`; g.fillText(t('lg.title'), X(lx), X(y + 4)); y += 8;
    for (const it of items) { if (y > r.y + r.h - 4) break;
      if (it.h) { g.font = `600 ${X(2.9)}px ${F}`; g.fillStyle = C.ink; g.fillText(it.h, X(lx), X(y + 3)); y += 5; continue; }
      if (it.img) { const im = await loadImg(it.img); if (im) { g.drawImage(im, X(cx), X(y), X(26), X(26)); y += 28; } continue; }
      const sx = rtl ? cx + cw - 6 : cx; g.globalAlpha = it.op;
      if (it.kind === 'line') { g.strokeStyle = it.bc; g.lineWidth = Math.max(1, X(Math.max(0.25, it.bw * 0.26))); g.setLineDash(it.bs === 'dashed' ? [X(1.2), X(0.8)] : []); g.beginPath(); g.moveTo(X(sx), X(y + 2)); g.lineTo(X(sx + 6), X(y + 2)); g.stroke(); g.setLineDash([]); }
      else if (it.kind === 'dot') { g.beginPath(); g.arc(X(sx + 3), X(y + 2), X(1.4), 0, Math.PI * 2); g.fillStyle = it.bg; g.fill(); if (it.bw) { g.strokeStyle = it.bc; g.lineWidth = Math.max(1, X(0.3)); g.stroke(); } }
      else if (it.kind === 'hatch') { g.strokeStyle = C.grey; g.lineWidth = Math.max(1, X(0.15)); g.strokeRect(X(sx), X(y + 0.5), X(6), X(3)); for (let q = 0; q < 6; q += 1.2) { g.beginPath(); g.moveTo(X(sx + q), X(y + 3.5)); g.lineTo(X(sx + Math.min(6, q + 3)), X(y + 0.5)); g.stroke(); } }
      else { g.fillStyle = it.bg; g.fillRect(X(sx), X(y + 0.5), X(6), X(3)); if (it.bw) { g.strokeStyle = it.bc; g.lineWidth = Math.max(1, X(0.2)); g.strokeRect(X(sx), X(y + 0.5), X(6), X(3)); } }
      g.globalAlpha = 1; g.fillStyle = C.ink2; g.font = `${X(2.6)}px ${F}`; PG.wrap(g, it.text, X(rtl ? cx + cw - 8 : cx + 8), X(y + 3), X(cw - 9), X(3.3), 2); y += 4.6; }
  }
  function scaleBarMm(g, X, r, denom, F, rtl) { const C = P(); const mmPerM = 1000 / denom; const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].filter(v => v * mmPerM <= r.w * 0.3).pop() || 10; const len = nice * mmPerM; const x0 = r.x + 5, y0 = r.y + r.h - 7;
    g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillRect(X(x0 - 2), X(y0 - 5), X(len + 18), X(9)); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#FFFFFF' : C.ink; g.fillRect(X(x0 + i * len / 4), X(y0), X(len / 4), X(1.4)); } g.strokeStyle = C.ink; g.lineWidth = Math.max(1, X(0.15)); g.strokeRect(X(x0), X(y0), X(len), X(1.4));
    g.fillStyle = C.ink; g.font = `${X(2.6)}px ${F}`; g.textAlign = 'left'; g.direction = 'ltr'; g.fillText('0', X(x0), X(y0 - 1)); g.fillText(`${nf(nice)} m`, X(x0 + len + 1), X(y0 + 1.4)); g.fillText(`1:${nf(denom)}`, X(x0), X(y0 - 2.6 - 2)); g.direction = rtl ? 'rtl' : 'ltr'; }
  // ---------- compose the page ----------
  async function compose(dpi, preview) {
    const L = layout(); const d = preview ? Math.min(dpi, 60) : effDpi(dpi); const k = d / 25.4; const F = PG.font(); const rtl = I.dir() === 'rtl'; const C = P();
    const cv = document.createElement('canvas'); cv.width = Math.round(L.W * k); cv.height = Math.round(L.H * k); const g = cv.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height);
    const X = (mm) => mm * k; const al = rtl ? 'right' : 'left'; const tx = (mm) => rtl ? X(L.W - mm) : X(mm); g.direction = rtl ? 'rtl' : 'ltr';
    g.fillStyle = C.red; g.fillRect(0, 0, cv.width, X(2)); g.textAlign = al; g.fillStyle = C.ink; g.font = `700 ${X(7)}px ${F}`; g.fillText(st.title || t('pl.untitled'), tx(L.m), X(L.m + 9));
    g.font = `${X(3.6)}px ${F}`; g.fillStyle = C.ink2; g.fillText(st.subtitle || '', tx(L.m), X(L.m + 15));
    const maps = []; const srcExtra = [];
    for (let n = 0; n < L.rects.length; n++) {
      const sl = st.slots[n]; if (!sl || sl.type === 'none') continue; const R0 = L.rects[n]; const cap = sl.caption ? 5 : 0; const r = { x: R0.x, y: R0.y, w: R0.w, h: R0.h - cap };
      if (sl.type === 'map') { const m = await renderMap(r, preview ? 60 : d, sl.denom || 5000); g.drawImage(m.img, X(r.x), X(r.y), X(r.w), X(r.h)); g.strokeStyle = C.ink; g.lineWidth = Math.max(1, X(0.3)); g.strokeRect(X(r.x), X(r.y), X(r.w), X(r.h));
        PG.northArrow(g, X(r.x + r.w - 8), X(r.y + 4), X(1) / 3.4); scaleBarMm(g, X, r, sl.denom || 5000, F, rtl); maps.push({ n: n + 1, denom: sl.denom || 5000, measured: m.measured, mapDpi: m.mapDpi }); }
      else if (sl.type === 'legend') await drawLegend(g, X, r, F, rtl);
      else if (sl.type === 'section') { const s = allSections().find(x => x.s.id === sl.ref); if (s) { const prof = await root.GA.section.compute(s.s); const sc = document.createElement('canvas'); const ratio = Math.max(1, d / 96);
        root.GA.section.draw(sc, prof, Object.assign(root.GA.section.optsFor(s.s), { w: Math.round(X(r.w) / ratio), h: Math.round(X(r.h) / ratio), ratio })); g.drawImage(sc, X(r.x), X(r.y), X(r.w), X(r.h)); g.strokeStyle = C.line2; g.lineWidth = 1; g.strokeRect(X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push('IGN MDT25 · OSM'); } }
      else if (sl.type === 'card') { const c = cards().find(x => String(x.i) === String(sl.ref)); if (c) { PG.drawImageFit(g, c.cv, X(r.x), X(r.y), X(r.w), X(r.h)); } }
      else if (sl.type === 'chart') { const Ly = root.GA.app.L.byId[sl.ref]; let im = null;
        if (sl.ref === 'wind' && Ly && Ly._url) im = await loadImg(Ly._url); else if (sl.ref === 'rain' && Ly && Ly._st) { const box = document.createElement('div'); box.innerHTML = Ly.legend(); const svg = box.querySelector('svg'); if (svg) im = await svgImage(svg.outerHTML); }
        if (im) { PG.drawImageFit(g, im, X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push('ERA5 (ECMWF/Copernicus) via Open-Meteo, CC BY 4.0'); } }
      else if (sl.type === 'image') { const im = st.images[+sl.ref]; if (im && im.img) { PG.drawImageFit(g, im.img, X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push(`${im.caption || t('pl.image')}: ${im.source || t('pl.noSource')}`); } }
      if (cap) { g.fillStyle = C.ink2; g.font = `${X(2.6)}px ${F}`; g.textAlign = al; g.fillText(`${n + 1}. ${sl.caption}`, rtl ? X(R0.x + R0.w) : X(R0.x), X(R0.y + R0.h - 1.2)); }
    }
    const fy = L.H - L.m - L.foot + 4; g.textAlign = al; g.fillStyle = C.ink; g.font = `600 ${X(3)}px ${F}`;
    g.fillText(maps.length ? maps.map(m => t('pl.scaleLine', { n: nf(m.denom), p: st.paper, o: t('pl.' + st.orient), m: nf(m.measured, 0) })).join(' · ') : t('pl.noMap'), tx(L.m), X(fy + 3));
    g.font = `${X(2.4)}px ${F}`; g.fillStyle = C.ink3; g.fillText(t('pl.resLine', { d: nf(d), md: nf(maps.length ? Math.min(...maps.map(m => m.mapDpi)) : d, 0) }), tx(L.m), X(fy + 7));
    PG.wrap(g, `${t('v7.sources')}: ${activeSources().concat(srcExtra).join(' · ')} · ${t('pl.made')} ${new Date().toISOString().slice(0, 10)}`, tx(L.m), X(fy + 10.5), X(L.W - 2 * L.m), X(3), 2);
    return { cv, dpi: d, maps, measured: maps.length ? maps[0].measured : null };
  }
  const loadImg = (src) => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  // ---------- page ----------
  function form() {
    const opt = (v, cur, l) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`; const n = TEMPLATES[st.template];
    while (st.slots.length < 4) st.slots.push({ type: 'none', caption: '' });
    return `<div class="pl"><form class="pl-form" onsubmit="return false">
      <label>${t('pl.title')} <input type="text" data-pl="title" value="${esc(st.title)}"></label>
      <label>${t('pl.subtitle')} <input type="text" data-pl="subtitle" value="${esc(st.subtitle)}"></label>
      <div class="pl-row"><label>${t('pl.paper')} <select data-pl="paper">${Object.keys(PAPERS).map(k => opt(k, st.paper, `${k} (${PAPERS[k][0]} × ${PAPERS[k][1]} mm)`)).join('')}</select></label>
      <label>${t('pl.orient')} <select data-pl="orient">${opt('landscape', st.orient, t('pl.landscape'))}${opt('portrait', st.orient, t('pl.portrait'))}</select></label></div>
      <div class="pl-row"><label>${t('pl.margin')} <span class="u"><input type="number" min="5" max="40" step="1" data-pl="margin" value="${st.margin}"> mm</span></label>
      <label>${t('pl.dpi')} <select data-pl="dpi">${[150, 200, 300].map(v => opt(v, st.dpi, v + ' dpi')).join('')}</select></label></div>
      <p class="fine">${t('pl.scaleVsRes')}</p>
      <label>${t('pl.template')} <select data-pl="template">${Object.keys(TEMPLATES).map(k => opt(k, st.template, t('pl.tpl.' + k))).join('')}</select></label>
      <fieldset><legend>${t('pl.slots')}</legend>
        ${st.slots.slice(0, n).map((sl, i) => `<div class="pl-slot"><b class="num">${i + 1}</b><div class="pl-slot-b">
          <select data-slot="${i}" data-sk="item" aria-label="${esc(t('pl.slots'))} ${i + 1}">${itemOptions(sl)}</select>
          ${sl.type === 'map' ? `<label class="u">1 : <select data-slot="${i}" data-sk="denom">${SCALES.map(v => opt(v, sl.denom || 5000, nf(v))).join('')}</select></label>` : ''}
          <input type="text" data-slot="${i}" data-sk="caption" value="${esc(sl.caption || '')}" placeholder="${esc(t('pl.caption'))}" aria-label="${esc(t('pl.caption'))}">
          </div><span class="pl-mv"><button type="button" class="btn btn-tiny" data-mv="${i}:-1" ${i ? '' : 'disabled'} aria-label="${esc(t('pl.up'))}">↑</button><button type="button" class="btn btn-tiny" data-mv="${i}:1" ${i < n - 1 ? '' : 'disabled'} aria-label="${esc(t('pl.down'))}">↓</button></span></div>`).join('')}
      </fieldset>
      <fieldset><legend>${t('pl.images')}</legend>
        ${st.images.map((im, i) => `<div class="pl-img"><b class="num">${t('pl.image')} ${i + 1}</b><input type="text" data-img="${i}" data-ik="caption" value="${esc(im.caption || '')}" placeholder="${esc(t('pl.imgCaption'))}"><input type="text" data-img="${i}" data-ik="source" value="${esc(im.source || '')}" placeholder="${esc(t('pl.imgSourceHint'))}"></div>`).join('')}
        <label>${t('pl.addImage')} <input type="file" accept="image/*" data-pl="image"></label>
      </fieldset>
      <p class="fine">${t('pl.viewNote')} ${t('pl.cardNote')}</p>
      <div class="pl-btns"><button class="btn" data-pl-act="preview">${t('pl.preview')}</button><button class="btn btn-primary" data-pl-act="pdf">${t('pl.pdf')}</button><button class="btn" data-pl-act="png">${t('pl.png')}</button></div>
      <p class="fine" id="pl-msg" role="status"></p></form>
      <div class="pl-prev"><div class="pl-sheet" id="pl-sheet"><p class="fine">${t('pl.previewHint')}</p></div></div></div>`;
  }
  let busy = false;
  async function run(kind, body) {
    if (busy) return; busy = true; const msg = body.querySelector('#pl-msg'); msg.innerHTML = `<span class="spin"></span> ${t('pl.working')}`;
    const scaleTxt = (r) => r.maps.map(m => `1:${nf(m.measured, 0)}`).join(', ') || '—';
    try {
      if (kind === 'preview') { const r = await compose(60, true); const box = body.querySelector('#pl-sheet'); box.innerHTML = ''; r.cv.style.width = '100%'; r.cv.style.height = 'auto'; r.cv.className = 'pl-canvas'; box.appendChild(r.cv); msg.textContent = t('pl.previewDone', { m: scaleTxt(r) }); root.GA.lastPrint = r; }
      else { const r = await compose(st.dpi, false); const [W, H] = pageMm(); const name = `granada_atlas_${PG.slug(st.title || 'print')}_${st.paper}_${st.orient}`;
        if (kind === 'png') PG.download(await PG.toBlob(r.cv, 'image/png'), name + '.png'); else { const bytes = root.GA.pdf.build([{ canvas: r.cv, paper: [ptOf(W), ptOf(H)], quality: 0.92 }], { title: st.title || 'Granada Atlas print' }); PG.download(new Blob([bytes], { type: 'application/pdf' }), name + '.pdf'); }
        msg.textContent = t('pl.exported', { d: r.dpi, req: st.dpi, m: scaleTxt(r) }) + (r.dpi < st.dpi ? ' ' + t('pl.dpiCapped') : ''); root.GA.lastPrint = r; }
    } catch (e) { console.error(e); msg.textContent = t('pl.failed') + ' ' + (e.message || e); } finally { busy = false; }
  }
  function render(body) {
    const redraw = () => { const keep = body.querySelector('#pl-sheet') && body.querySelector('#pl-sheet').innerHTML; body.innerHTML = form(); if (keep) body.querySelector('#pl-sheet').innerHTML = keep; };
    redraw();
    body.onchange = async (e) => { const el = e.target;
      if (el.dataset.slot != null) { const sl = st.slots[+el.dataset.slot]; const k = el.dataset.sk;
        if (k === 'item') { const [type, ref] = el.value.split(/:(.*)/s); sl.type = type; sl.ref = ref || null; if (type === 'map' && !sl.denom) sl.denom = 5000; redraw(); }
        else if (k === 'denom') sl.denom = +el.value; else sl.caption = el.value; return; }
      if (el.dataset.img != null) { st.images[+el.dataset.img][el.dataset.ik] = el.value; return; }
      const k = el.dataset.pl; if (!k) return;
      if (k === 'image') { const f = el.files && el.files[0]; if (f) { const img = await loadImg(URL.createObjectURL(f)); if (img) { st.images.push({ img, caption: f.name.replace(/\.[^.]+$/, ''), source: '' }); const free = st.slots.slice(0, TEMPLATES[st.template]).find(x => x.type === 'none'); if (free) { free.type = 'image'; free.ref = String(st.images.length - 1); } } } redraw(); return; }
      st[k] = (k === 'dpi' || k === 'margin') ? +el.value : el.value; if (k === 'template') redraw(); };
    body.oninput = (e) => { const el = e.target; if (el.dataset.pl === 'title' || el.dataset.pl === 'subtitle') st[el.dataset.pl] = el.value; };
    body.onclick = (e) => { const mv = e.target.closest('[data-mv]'); if (mv) { const [i, dd] = mv.dataset.mv.split(':').map(Number); const j = i + dd; [st.slots[i], st.slots[j]] = [st.slots[j], st.slots[i]]; redraw(); return; }
      const b = e.target.closest('[data-pl-act]'); if (b) run(b.dataset.plAct, body); };
  }
  PG.register('print', { plate: () => t('pl.plate'), title: () => t('pl.pageTitle'), render });
  root.GA.printLayout = { st, compose, layout, PAPERS, effDpi, TEMPLATES };
})(window);
