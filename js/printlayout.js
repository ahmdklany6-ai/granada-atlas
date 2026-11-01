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
  const st = { paper: 'A3', orient: 'landscape', margin: 12, denom: 5000, dpi: 200, title: '', subtitle: '', legend: true, section: '', image: null, imgCaption: '', imgSource: '' };
  const pageMm = () => { const [a, b] = PAPERS[st.paper]; return st.orient === 'landscape' ? [b, a] : [a, b]; };
  const ptOf = (mm) => mm / 25.4 * 72;
  function effDpi(dpi) { const [w, h] = pageMm(); let d = dpi; while ((w / 25.4 * d) * (h / 25.4 * d) > MAX_PAGE_PX) d -= 25; return Math.max(72, d); }
  // layout in mm: header band, map frame, side (landscape) or bottom (portrait) column, footer band
  function layout() {
    const [W, H] = pageMm(); const m = st.margin; const head = 22, foot = 16; const land = st.orient === 'landscape'; const hasCol = st.legend || st.section || st.image;
    const body = { x: m, y: m + head, w: W - 2 * m, h: H - 2 * m - head - foot };
    const colW = hasCol ? (land ? Math.max(70, body.w * 0.28) : body.w) : 0, colH = hasCol ? (land ? body.h : Math.max(70, body.h * 0.3)) : 0;
    const map = land ? { x: body.x, y: body.y, w: body.w - (hasCol ? colW + 6 : 0), h: body.h } : { x: body.x, y: body.y, w: body.w, h: body.h - (hasCol ? colH + 6 : 0) };
    const col = hasCol ? (land ? { x: map.x + map.w + 6, y: body.y, w: colW, h: body.h } : { x: body.x, y: map.y + map.h + 6, w: body.w, h: colH }) : null;
    return { W, H, m, head, foot, map, col };
  }
  // ---------- the map at a true scale ----------
  async function renderMap(frameMm, dpi) {
    const main = root.GA.app.map; const c = main.getCenter(); const cssW = Math.round(frameMm.w / 25.4 * 96), cssH = Math.round(frameMm.h / 25.4 * 96);
    let pr = dpi / 96; pr = Math.min(pr, MAX_TEX / cssW, MAX_TEX / cssH); const mppCss = st.denom * 0.0254 / 96; // ground metres per CSS px at 1:N
    const zoom = Math.log2(40075016.686 * Math.cos(c.lat * Math.PI / 180) / (512 * mppCss));
    const div = document.createElement('div'); div.style.cssText = `position:fixed;left:-20000px;top:0;width:${cssW}px;height:${cssH}px;`; document.body.appendChild(div);
    const m = new maplibregl.Map({ container: div, style: main.getStyle(), center: c, zoom, bearing: 0, pitch: 0, pixelRatio: pr, interactive: false, preserveDrawingBuffer: true, attributionControl: false, fadeDuration: 0 });
    m.on('styleimagemissing', (e) => { try { const im = main.style && main.style.getImage && main.style.getImage(e.id); if (im) m.addImage(e.id, im.data, { pixelRatio: im.pixelRatio }); else if (e.id === 'ga-hatch') { const n = 8, d = new Uint8Array(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4, on = (x + y) % n === 0; d[o] = d[o + 1] = d[o + 2] = on ? 138 : 255; d[o + 3] = on ? 255 : 230; } m.addImage('ga-hatch', { width: n, height: n, data: d }); } } catch (err) { } });
    await new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; m.once('idle', fin); setTimeout(fin, 45000); });
    // re-measure the scale on the rendered map: ground distance across the frame's middle row / frame width on paper
    const a = m.unproject([0, cssH / 2]), b = m.unproject([cssW, cssH / 2]); const ground = root.GA.geo.haversine([a.lng, a.lat], [b.lng, b.lat]); const measured = ground * 1000 / frameMm.w;
    const img = document.createElement('canvas'); img.width = m.getCanvas().width; img.height = m.getCanvas().height; img.getContext('2d').drawImage(m.getCanvas(), 0, 0);
    m.remove(); div.remove();
    return { img, measured, mapDpi: pr * 96, mppPaper: st.denom / 1000 }; // metres on the ground per mm on paper
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
  // ---------- compose the page ----------
  async function compose(dpi, preview) {
    const L = layout(); const d = preview ? Math.min(dpi, 60) : effDpi(dpi); const k = d / 25.4; const F = PG.font(); const rtl = I.dir() === 'rtl'; const C = P();
    const cv = document.createElement('canvas'); cv.width = Math.round(L.W * k); cv.height = Math.round(L.H * k); const g = cv.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height);
    const X = (mm) => mm * k; const al = rtl ? 'right' : 'left'; const tx = (mm) => rtl ? X(L.W - mm) : X(mm); g.direction = rtl ? 'rtl' : 'ltr';
    // header
    g.fillStyle = C.red; g.fillRect(0, 0, cv.width, X(2)); g.textAlign = al; g.fillStyle = C.ink; g.font = `700 ${X(7)}px ${F}`; g.fillText(st.title || t('pl.untitled'), tx(L.m), X(L.m + 9));
    g.font = `${X(3.6)}px ${F}`; g.fillStyle = C.ink2; g.fillText(st.subtitle || '', tx(L.m), X(L.m + 15));
    // map
    const r = await renderMap(L.map, preview ? 60 : d); g.drawImage(r.img, X(L.map.x), X(L.map.y), X(L.map.w), X(L.map.h)); g.strokeStyle = C.ink; g.lineWidth = Math.max(1, X(0.3)); g.strokeRect(X(L.map.x), X(L.map.y), X(L.map.w), X(L.map.h));
    // north arrow (the map is never rotated) and scale bar in true paper millimetres
    PG.northArrow(g, X(L.map.x + L.map.w - 8), X(L.map.y + 4), X(1) / 3.4);
    { const mmPerM = 1000 / st.denom; const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].filter(v => v * mmPerM <= L.map.w * 0.3).pop() || 10; const len = nice * mmPerM; const x0 = L.map.x + 5, y0 = L.map.y + L.map.h - 7;
      g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillRect(X(x0 - 2), X(y0 - 5), X(len + 18), X(9)); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#FFFFFF' : C.ink; g.fillRect(X(x0 + i * len / 4), X(y0), X(len / 4), X(1.4)); } g.strokeStyle = C.ink; g.lineWidth = Math.max(1, X(0.15)); g.strokeRect(X(x0), X(y0), X(len), X(1.4));
      g.fillStyle = C.ink; g.font = `${X(2.6)}px ${F}`; g.textAlign = 'left'; g.direction = 'ltr'; g.fillText('0', X(x0), X(y0 - 1)); g.fillText(`${nf(nice)} m`, X(x0 + len + 1), X(y0 + 1.4)); g.direction = rtl ? 'rtl' : 'ltr'; }
    // column: legend, section, image
    if (L.col) { let y = L.col.y; const cx = L.col.x, cw = L.col.w;
      if (st.legend) { const items = legendItems(); g.textAlign = 'left'; g.direction = rtl ? 'rtl' : 'ltr'; const lx = rtl ? cx + cw : cx; const ta = rtl ? 'right' : 'left'; g.textAlign = ta;
        g.fillStyle = C.ink; g.font = `700 ${X(3.4)}px ${F}`; g.fillText(t('lg.title'), X(lx), X(y + 4)); y += 8;
        for (const it of items) { if (y > L.col.y + L.col.h * (st.section || st.image ? 0.5 : 0.95)) break;
          if (it.h) { g.font = `600 ${X(2.9)}px ${F}`; g.fillStyle = C.ink; g.fillText(it.h, X(lx), X(y + 3)); y += 5; continue; }
          if (it.img) { const im = await loadImg(it.img); if (im) { g.drawImage(im, X(cx), X(y), X(26), X(26)); y += 28; } continue; }
          const sx = rtl ? cx + cw - 6 : cx; g.globalAlpha = it.op;
          if (it.kind === 'line') { g.strokeStyle = it.bc; g.lineWidth = Math.max(1, X(Math.max(0.25, it.bw * 0.26))); g.setLineDash(it.bs === 'dashed' ? [X(1.2), X(0.8)] : []); g.beginPath(); g.moveTo(X(sx), X(y + 2)); g.lineTo(X(sx + 6), X(y + 2)); g.stroke(); g.setLineDash([]); }
          else if (it.kind === 'dot') { g.beginPath(); g.arc(X(sx + 3), X(y + 2), X(1.4), 0, Math.PI * 2); g.fillStyle = it.bg; g.fill(); if (it.bw) { g.strokeStyle = it.bc; g.lineWidth = Math.max(1, X(0.3)); g.stroke(); } }
          else if (it.kind === 'hatch') { g.strokeStyle = C.grey; g.lineWidth = Math.max(1, X(0.15)); g.strokeRect(X(sx), X(y + 0.5), X(6), X(3)); for (let q = 0; q < 6; q += 1.2) { g.beginPath(); g.moveTo(X(sx + q), X(y + 3.5)); g.lineTo(X(sx + Math.min(6, q + 3)), X(y + 0.5)); g.stroke(); } }
          else { g.fillStyle = it.bg; g.fillRect(X(sx), X(y + 0.5), X(6), X(3)); if (it.bw) { g.strokeStyle = it.bc; g.lineWidth = Math.max(1, X(0.2)); g.strokeRect(X(sx), X(y + 0.5), X(6), X(3)); } }
          g.globalAlpha = 1; g.fillStyle = C.ink2; g.font = `${X(2.6)}px ${F}`; PG.wrap(g, it.text, X(rtl ? cx + cw - 8 : cx + 8), X(y + 3), X(cw - 9), X(3.3), 2); y += 4.6; }
        y += 3; }
      if (st.section) { const s = allSections().find(x => x.s.id === st.section); if (s) { const h = Math.min(L.col.y + L.col.h - y - (st.image ? 40 : 2), cw * 0.62); if (h > 25) {
        const prof = await root.GA.section.compute(s.s); const sc = document.createElement('canvas'); root.GA.section.draw(sc, prof, Object.assign(root.GA.section.optsFor(s.s), { w: Math.round(X(cw) / (d / 96 * 1)), h: Math.round(X(h) / (d / 96)), ratio: d / 96 }));
        g.drawImage(sc, X(cx), X(y), X(cw), X(h)); g.strokeStyle = C.line2; g.strokeRect(X(cx), X(y), X(cw), X(h)); y += h + 4; } } }
      if (st.image) { const h = L.col.y + L.col.h - y - 9; if (h > 15) { PG.drawImageFit(g, st.image, X(cx), X(y), X(cw), X(h)); y += h + 1; g.fillStyle = C.ink2; g.font = `${X(2.5)}px ${F}`; g.textAlign = al;
        g.fillText(`${st.imgCaption || ''}${st.imgCaption ? ' · ' : ''}${t('src.label')} ${st.imgSource || t('pl.noSource')}`, X(rtl ? cx + cw : cx), X(y + 3)); } } }
    // footer: scale statement, resolution statement, sources, date
    const fy = L.H - L.m - L.foot + 4; g.textAlign = al; g.fillStyle = C.ink; g.font = `600 ${X(3)}px ${F}`;
    g.fillText(t('pl.scaleLine', { n: nf(st.denom), p: st.paper, o: t('pl.' + st.orient), m: nf(r.measured, 0) }), tx(L.m), X(fy + 3));
    g.font = `${X(2.4)}px ${F}`; g.fillStyle = C.ink3; g.fillText(t('pl.resLine', { d: nf(preview ? d : d), md: nf(r.mapDpi, 0) }), tx(L.m), X(fy + 7));
    PG.wrap(g, `${t('v7.sources')}: ${activeSources().join(' · ')} · ${t('pl.made')} ${new Date().toISOString().slice(0, 10)}`, tx(L.m), X(fy + 10.5), X(L.W - 2 * L.m), X(3), 2);
    return { cv, dpi: d, measured: r.measured, mapDpi: r.mapDpi };
  }
  const loadImg = (src) => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  // ---------- page ----------
  function form() {
    const secs = allSections(); const opt = (v, cur, l) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
    return `<div class="pl"><form class="pl-form" onsubmit="return false">
      <label>${t('pl.title')} <input type="text" data-pl="title" value="${esc(st.title)}"></label>
      <label>${t('pl.subtitle')} <input type="text" data-pl="subtitle" value="${esc(st.subtitle)}"></label>
      <div class="pl-row"><label>${t('pl.paper')} <select data-pl="paper">${Object.keys(PAPERS).map(k => opt(k, st.paper, `${k} (${PAPERS[k][0]} × ${PAPERS[k][1]} mm)`)).join('')}</select></label>
      <label>${t('pl.orient')} <select data-pl="orient">${opt('landscape', st.orient, t('pl.landscape'))}${opt('portrait', st.orient, t('pl.portrait'))}</select></label></div>
      <div class="pl-row"><label>${t('pl.scale')} <span class="u num">1 : <select data-pl="denom">${SCALES.map(v => opt(v, st.denom, nf(v))).join('')}</select></span></label>
      <label>${t('pl.margin')} <span class="u"><input type="number" min="5" max="40" step="1" data-pl="margin" value="${st.margin}"> mm</span></label></div>
      <label>${t('pl.dpi')} <select data-pl="dpi">${[150, 200, 300].map(v => opt(v, st.dpi, v + ' dpi')).join('')}</select></label>
      <p class="fine">${t('pl.scaleVsRes')}</p>
      <fieldset><legend>${t('pl.content')}</legend>
        <label class="chk"><input type="checkbox" data-pl="legend" ${st.legend ? 'checked' : ''}> ${t('pl.legend')}</label>
        <label>${t('pl.section')} <select data-pl="section">${opt('', st.section, t('pl.none'))}${secs.map(x => opt(x.s.id, st.section, esc(x.label))).join('')}</select></label>
        <label>${t('pl.image')} <input type="file" accept="image/*" data-pl="image"></label>
        <label>${t('pl.imgCaption')} <input type="text" data-pl="imgCaption" value="${esc(st.imgCaption)}"></label>
        <label>${t('pl.imgSource')} <input type="text" data-pl="imgSource" value="${esc(st.imgSource)}" placeholder="${esc(t('pl.imgSourceHint'))}"></label>
      </fieldset>
      <p class="fine">${t('pl.viewNote')}</p>
      <div class="pl-btns"><button class="btn" data-pl-act="preview">${t('pl.preview')}</button><button class="btn btn-primary" data-pl-act="pdf">${t('pl.pdf')}</button><button class="btn" data-pl-act="png">${t('pl.png')}</button></div>
      <p class="fine" id="pl-msg" role="status"></p></form>
      <div class="pl-prev"><div class="pl-sheet" id="pl-sheet"><p class="fine">${t('pl.previewHint')}</p></div></div></div>`;
  }
  let busy = false;
  async function run(kind, body) {
    if (busy) return; busy = true; const msg = body.querySelector('#pl-msg'); msg.innerHTML = `<span class="spin"></span> ${t('pl.working')}`;
    try {
      if (kind === 'preview') { const r = await compose(60, true); const box = body.querySelector('#pl-sheet'); box.innerHTML = ''; r.cv.style.width = '100%'; r.cv.style.height = 'auto'; r.cv.className = 'pl-canvas'; box.appendChild(r.cv); msg.textContent = t('pl.previewDone', { m: nf(r.measured, 0) }); }
      else { const r = await compose(st.dpi, false); const [W, H] = pageMm(); const name = `granada_atlas_${PG.slug(st.title || 'print')}_${st.paper}_${st.orient}_1-${st.denom}`;
        if (kind === 'png') PG.download(await PG.toBlob(r.cv, 'image/png'), name + '.png'); else { const bytes = root.GA.pdf.build([{ canvas: r.cv, paper: [ptOf(W), ptOf(H)], quality: 0.92 }], { title: st.title || 'Granada Atlas print' }); PG.download(new Blob([bytes], { type: 'application/pdf' }), name + '.pdf'); }
        msg.textContent = t('pl.exported', { d: r.dpi, req: st.dpi, m: nf(r.measured, 0) }) + (r.dpi < st.dpi ? ' ' + t('pl.dpiCapped') : ''); root.GA.lastPrint = r; }
    } catch (e) { console.error(e); msg.textContent = t('pl.failed') + ' ' + (e.message || e); } finally { busy = false; }
  }
  function render(body) {
    body.innerHTML = form();
    body.oninput = body.onchange = async (e) => { const el = e.target; const k = el.dataset.pl; if (!k) return;
      if (k === 'image') { const f = el.files && el.files[0]; st.image = f ? await loadImg(URL.createObjectURL(f)) : null; return; }
      st[k] = el.type === 'checkbox' ? el.checked : (k === 'denom' || k === 'dpi' || k === 'margin') ? +el.value : el.value; };
    body.onclick = (e) => { const b = e.target.closest('[data-pl-act]'); if (b) run(b.dataset.plAct, body); };
  }
  PG.register('print', { plate: () => t('pl.plate'), title: () => t('pl.pageTitle'), render });
  root.GA.printLayout = { st, compose, layout, PAPERS, effDpi };
})(window);
