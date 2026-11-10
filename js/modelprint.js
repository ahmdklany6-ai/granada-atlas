/* Build 5.29 — "Model workshop (40 × 40 cm)" preset in Print layout (#/print), for Exercise 02 "To identify" (model
   workshop, 11 Nov 2026). The brief: 3–4 drawings (plan / section / aerial) printed on A3 at ONE identical scale matching a
   40 × 40 cm model, with a round scale (1:500, not 1:379).
   - The area: a saved study area, the current map view, or a square drawn on the map (two opposite corners). Its bounding
     square (EPSG:25830 metres) gives the exact scale side × 1000 / 400 mm; the scale used is the next STANDARD scale up
     (so the whole area fits): 1:100, 200, 250, 500, 1,000, 2,000, 2,500, 5,000, 10,000. The model then covers
     400 mm × N on the ground, centred on the area.
   - A 400 mm square does not fit on A3 (297 mm), so the plan and the aerial photo are printed as two A3 landscape sheets
     each (north half, south half: 400 × 200 mm of model each) with the model outline, crop marks and a join line;
     sections (east–west and / or north–south through the model centre, 400 mm long) take one sheet each. Every sheet
     carries the same scale, a scale bar, a north arrow and the title.
   - Plan: the true-scale map renderer of the print layout (GA.printLayout.mapRenderer: the map as shown, measured scale
     checked). Aerial: IGN PNOA orthophoto (WMS pnoa-ma, EPSG:25830 bounding box in metres, CC BY 4.0). Sections: the
     section engine (GA.section) at an exact pixels-per-metre scale, horizontal = vertical.
   GA.modelPrint.last holds what the last export produced (scale, sheets, outline in mm) — used by tests/ui_test_v27.py. */
(function (root) {
  const GA = root.GA, I = GA.i18n; const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
  const MODEL_MM = 400, SHEET = [420, 297], OX = 10, OY = 52, HALF = 200; // A3 landscape; the model part sits at x 10–410, y 52–252 mm
  const STD = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
  const PNOA = { url: 'https://www.ign.es/wms-inspire/pnoa-ma', layer: 'OI.OrthoimageCoverage' };
  const S = { src: 'view', square: null, plan: true, aerial: true, secEW: true, secNS: false, dpi: 200, busy: false, open: false };
  const P = () => GA.palette;
  const U = () => GA.proj.EPSG25830;

  // ---------- the area and its scale ----------
  function areas() { try { return (GA.app.store.get().areas || []).filter(a => GA.compare.ringOf(a.spec)); } catch (e) { return []; } }
  function sourceGeom() {
    let ring = null, name = '';
    if (S.src === 'square' && S.square) return { center: S.square.center, side: S.square.side, name: t('v27.mp.square') };
    if (S.src.startsWith('area:')) { const a = areas().find(x => x.id === S.src.slice(5)); if (a) { ring = GA.compare.ringOf(a.spec); name = a.name; } }
    if (!ring) { const b = GA.app.map.getBounds(); ring = [[b.getWest(), b.getSouth()], [b.getEast(), b.getSouth()], [b.getEast(), b.getNorth()], [b.getWest(), b.getNorth()]]; name = t('v27.mp.view');
      // the current view: the largest centred square inside it
      const e = ring.map(ll => U().forward(ll)); const w = Math.max(...e.map(p => p[0])) - Math.min(...e.map(p => p[0])), h = Math.max(...e.map(p => p[1])) - Math.min(...e.map(p => p[1]));
      const c = GA.app.map.getCenter(); return { center: [c.lng, c.lat], side: Math.min(w, h) * 0.9, name }; }
    const e = ring.map(ll => U().forward(ll)); const x0 = Math.min(...e.map(p => p[0])), x1 = Math.max(...e.map(p => p[0])), y0 = Math.min(...e.map(p => p[1])), y1 = Math.max(...e.map(p => p[1]));
    return { center: U().inverse([(x0 + x1) / 2, (y0 + y1) / 2]), side: Math.max(x1 - x0, y1 - y0), name };
  }
  function scaleFor(side) { const exact = side * 1000 / MODEL_MM; const denom = STD.find(d => d >= exact - 1e-6) || null; return { exact, denom, ground: denom ? MODEL_MM * denom / 1000 : null }; }
  function plan() { const g = sourceGeom(); const s = scaleFor(g.side); return Object.assign({}, g, s); }

  // ---------- drawing helpers (mm on a canvas at `dpi`) ----------
  function sheetCanvas(dpi) { const cv = document.createElement('canvas'); cv.width = Math.round(SHEET[0] / 25.4 * dpi); cv.height = Math.round(SHEET[1] / 25.4 * dpi); const g = cv.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height); return { cv, g, k: dpi / 25.4 }; }
  function text(g, k, s, xMm, yMm, sizeMm, opts) { opts = opts || {}; const rtl = I.dir() === 'rtl';
    g.font = `${opts.bold ? 700 : 400} ${sizeMm * k}px ${getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif'}`; g.fillStyle = opts.col || P().ui.ink; g.direction = rtl ? 'rtl' : 'ltr';
    g.textAlign = opts.align || (rtl ? 'right' : 'left'); g.textBaseline = 'alphabetic'; g.fillText(s, xMm * k, yMm * k); }
  const startX = () => I.dir() === 'rtl' ? SHEET[0] - OX : OX;
  function header(g, k, info, sheetTitle) {
    g.fillStyle = P().ui.red; g.fillRect(0, 0, SHEET[0] * k, 2.2 * k);
    text(g, k, info.name || t('v27.mp.title'), startX(), 14, 6, { bold: true });
    text(g, k, `${t('v27.mp.title')} · ${t('v27.mp.scaleLine', { d: nf(info.denom), m: nf(info.ground) })}`, startX(), 22, 3.6);
    text(g, k, sheetTitle, startX(), 30, 4.2, { bold: true, col: P().ui.red });
    text(g, k, t('v27.mp.exactLine', { x: nf(info.exact), d: nf(info.denom) }), startX(), 37, 3);
  }
  function scaleBar(g, k, denom, xMm, yMm) { // a bar of a round ground length close to 100 mm, LTR in every language
    const nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]; const mPerMm = denom / 1000; const len = nice.reduce((b, v) => v / mPerMm <= 110 ? v : b, nice[0]); const w = len / mPerMm;
    const n = 4; g.lineWidth = 0.25 * k; g.strokeStyle = P().ui.ink;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#FFFFFF' : P().ui.ink; g.fillRect((xMm + i * w / n) * k, yMm * k, w / n * k, 2 * k); }
    g.strokeRect(xMm * k, yMm * k, w * k, 2 * k);
    g.font = `${2.8 * k}px ${'IBM Plex Mono, monospace'}`; g.fillStyle = P().ui.ink; g.direction = 'ltr'; g.textAlign = 'center';
    [0, len / 2, len].forEach((v, i) => g.fillText(i === 2 ? `${nf(v)} m` : nf(v), (xMm + v / mPerMm) * k, (yMm + 6) * k));
    g.textAlign = 'left'; g.fillText(`1:${nf(denom)}`, (xMm + w + 4) * k, (yMm + 2) * k); return w; }
  function north(g, k, xMm, yMm) { GA.pages.northArrow(g, xMm * k, yMm * k, k / 3.4); }
  // the model outline (solid sides; dashed join line where two sheets meet) and crop marks just outside its corners
  function outline(g, k, half) { // half: 'n' (north half: top edge is the model edge, bottom edge is the join) | 's' | 'full'
    const x0 = OX, x1 = OX + MODEL_MM, y0 = OY, y1 = OY + HALF; g.strokeStyle = P().ui.red; g.lineWidth = 0.5 * k; g.setLineDash([]);
    g.beginPath(); g.moveTo(x0 * k, y0 * k); g.lineTo(x0 * k, y1 * k); g.moveTo(x1 * k, y0 * k); g.lineTo(x1 * k, y1 * k);
    if (half !== 's') { g.moveTo(x0 * k, y0 * k); g.lineTo(x1 * k, y0 * k); } if (half !== 'n') { g.moveTo(x0 * k, y1 * k); g.lineTo(x1 * k, y1 * k); } g.stroke();
    g.setLineDash([3 * k, 2 * k]); g.beginPath(); if (half === 'n') { g.moveTo(x0 * k, y1 * k); g.lineTo(x1 * k, y1 * k); } if (half === 's') { g.moveTo(x0 * k, y0 * k); g.lineTo(x1 * k, y0 * k); } g.stroke(); g.setLineDash([]);
    g.strokeStyle = P().ui.ink; g.lineWidth = 0.25 * k; const m = (x, y, dx, dy) => { g.beginPath(); g.moveTo((x + dx * 2) * k, (y + dy * 2) * k); g.lineTo((x + dx * 8) * k, (y + dy * 8) * k); g.stroke(); };
    [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]].forEach(([x, y, dx, dy]) => { m(x, y, dx, 0); m(x, y, 0, dy); });
    if (half !== 'full') { const yj = half === 'n' ? y1 : y0; text(g, k, t(half === 'n' ? 'v27.mp.joinS' : 'v27.mp.joinN'), (x0 + x1) / 2, yj + (half === 'n' ? 5 : -2), 2.8, { align: 'center', col: P().ui.red }); }
  }
  function footer(g, k, info, srcText) {
    const w = scaleBar(g, k, info.denom, OX, 262); north(g, k, OX + w + 30, 258);
    text(g, k, srcText, SHEET[0] - OX, 275, 2.6, { align: I.dir() === 'rtl' ? 'left' : 'right', col: P().ui.ink3 });
    text(g, k, t('v27.mp.outlineNote'), SHEET[0] - OX, 281, 2.6, { align: I.dir() === 'rtl' ? 'left' : 'right', col: P().ui.ink3 });
  }

  // ---------- the sheets ----------
  const shift = (c, dyM) => [c[0], c[1] + dyM / 111320]; // north–south shift of a centre by metres (< 0.01 % error over a model)
  async function planHalf(info, half, dpi, ctl) { const { cv, g, k } = sheetCanvas(dpi);
    const c = shift(info.center, (half === 'n' ? 1 : -1) * info.ground / 4); const q = { x: Math.round(OX * k), y: Math.round(OY * k), w: Math.round(MODEL_MM * k), h: Math.round(HALF * k) };
    const R = await GA.printLayout.mapRenderer([MODEL_MM, HALF], dpi, info.denom, q, { center: c, ctl, hideAreas: false });
    try { await R.measure(q.h); await R.draw(g, 0, cv.height, 0); var measured = R.measured; } finally { R.dispose(); }
    header(g, k, info, t(half === 'n' ? 'v27.mp.planN' : 'v27.mp.planS')); outline(g, k, half); secLines(g, k, info, half);
    footer(g, k, info, '© OpenStreetMap contributors (ODbL) · IGN MDT25 / PNOA (CC BY 4.0) · JRC GHSL · ' + t('v27.mp.measured', { m: nf(measured) }));
    return { cv, kind: 'plan', half, measured }; }
  async function aerialHalf(info, half, dpi) { const { cv, g, k } = sheetCanvas(dpi);
    const cE = U().forward(info.center); const kf = 0.9996 * (1 + Math.pow(cE[0] - 500000, 2) / (2 * 6371000 * 6371000)); // UTM grid metres per ground metre here
    const gs = info.ground * kf; const yc = cE[1] + (half === 'n' ? 1 : -1) * gs / 4; const bb = [cE[0] - gs / 2, yc - gs / 4, cE[0] + gs / 2, yc + gs / 4];
    const W = Math.round(MODEL_MM * k), H = Math.round(HALF * k); const T = 2000; const nx = Math.ceil(W / T), ny = Math.ceil(H / T);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const px0 = Math.round(i * W / nx), px1 = Math.round((i + 1) * W / nx), py0 = Math.round(j * H / ny), py1 = Math.round((j + 1) * H / ny);
      const tb = [bb[0] + px0 / W * gs, bb[3] - py1 / H * (gs / 2), bb[0] + px1 / W * gs, bb[3] - py0 / H * (gs / 2)];
      const url = GA.ext.wmsURL(PNOA.url, PNOA.layer, tb, px1 - px0, py1 - py0, 25830).replace('FORMAT=image/png&TRANSPARENT=TRUE', 'FORMAT=image/jpeg');
      const im = await GA.ext.loadImage(url, 90000); g.drawImage(im, Math.round(OX * k) + px0, Math.round(OY * k) + py0, px1 - px0, py1 - py0); }
    header(g, k, info, t(half === 'n' ? 'v27.mp.aerialN' : 'v27.mp.aerialS')); outline(g, k, half); secLines(g, k, info, half);
    footer(g, k, info, 'PNOA © Instituto Geográfico Nacional (CC BY 4.0) · WMS pnoa-ma · EPSG:25830');
    return { cv, kind: 'aerial', half }; }
  function secEnds(info, dir) { const cE = U().forward(info.center); const h = info.ground / 2 * 0.9996;
    return dir === 'ew' ? [U().inverse([cE[0] - h, cE[1]]), U().inverse([cE[0] + h, cE[1]])] : [U().inverse([cE[0], cE[1] + h]), U().inverse([cE[0], cE[1] - h])]; }
  function secLines(g, k, info, half) { // the chosen section lines drawn on plan / aerial sheets (A–B, C–D)
    g.strokeStyle = P().ui.red; g.lineWidth = 0.6 * k; g.setLineDash([4 * k, 2 * k]); g.font = `700 ${3.6 * k}px sans-serif`; g.fillStyle = P().ui.red; g.direction = 'ltr'; g.textAlign = 'center';
    const midY = half === 'n' ? OY + HALF : OY; // the model centre lies on the join line
    if (S.secEW) { g.beginPath(); g.moveTo(OX * k, midY * k); g.lineTo((OX + MODEL_MM) * k, midY * k); g.stroke(); g.fillText('A', (OX + 3) * k, (midY + (half === 'n' ? -1.5 : 5)) * k); g.fillText('B', (OX + MODEL_MM - 3) * k, (midY + (half === 'n' ? -1.5 : 5)) * k); }
    if (S.secNS) { const x = OX + MODEL_MM / 2; g.beginPath(); g.moveTo(x * k, OY * k); g.lineTo(x * k, (OY + HALF) * k); g.stroke(); g.fillText(half === 'n' ? 'C' : 'D', (x + 3) * k, (half === 'n' ? OY + 5 : OY + HALF - 2) * k); }
    g.setLineDash([]); }
  async function sectionSheet(info, dir, dpi) { const { cv, g, k } = sheetCanvas(dpi);
    const [A, B] = secEnds(info, dir); const prof = await GA.section.compute({ pts: [A, B], depth: 40, look: 'left', name: dir === 'ew' ? 'A–B' : 'C–D' });
    const css = 96 / 25.4; const pxPerM = css * 1000 / info.denom; const lo = {}; const ratio = dpi / 96;
    // a first measuring pass gives the height the drawing needs at this exact scale
    const probe = document.createElement('canvas'); GA.section.draw(probe, prof, Object.assign(GA.section.optsFor({}), { w: 600, h: 400, ratio: 0.1, pxPerM, layoutOut: lo }));
    const needMm = lo.needH / css, availMm = 297 - OY - 40; if (needMm > availMm) return { kind: 'section', dir, skipped: t('v27.mp.tooTall', { n: nf(needMm), a: nf(availMm) }) };
    const wCss = MODEL_MM * css + 60, hCss = Math.max(lo.needH + 10, availMm * css); const sc = document.createElement('canvas'); const lo2 = {};
    GA.section.draw(sc, prof, Object.assign(GA.section.optsFor({}), { w: Math.round(wCss), h: Math.round(hCss), ratio, pxPerM, layoutOut: lo2 }));
    const dx = OX * k - lo2.x0 * ratio; g.drawImage(sc, Math.round(dx), Math.round(OY * k));
    header(g, k, info, t(dir === 'ew' ? 'v27.mp.secEW' : 'v27.mp.secNS'));
    // the model width marked on the section: the same 400 mm as the outline on the plan sheets
    g.strokeStyle = P().ui.red; g.lineWidth = 0.5 * k; const yb = OY - 4; g.beginPath(); g.moveTo(OX * k, yb * k); g.lineTo((OX + MODEL_MM) * k, yb * k); g.moveTo(OX * k, (yb - 2) * k); g.lineTo(OX * k, (yb + 2) * k); g.moveTo((OX + MODEL_MM) * k, (yb - 2) * k); g.lineTo((OX + MODEL_MM) * k, (yb + 2) * k); g.stroke();
    footer(g, k, info, 'IGN MDT25 (CC BY 4.0) · OpenStreetMap (ODbL) · ' + t('v27.mp.trueScale'));
    return { cv, kind: 'section', dir, pxPerM: lo2.xs * ratio, mmPerM: lo2.xs / css }; }

  async function exportPdf(btnMsg) {
    if (S.busy) return; const info = plan(); if (!info.denom) { btnMsg(t('v27.mp.tooLarge', { m: nf(info.side) })); return; }
    S.busy = true; const pages = []; const meta = { denom: info.denom, exact: info.exact, side: info.side, ground: info.ground, center: info.center, sheets: [] }; const ctl = {};
    try {
      const jobs = []; if (S.plan) jobs.push(['plan', 'n'], ['plan', 's']); if (S.aerial) jobs.push(['aerial', 'n'], ['aerial', 's']); if (S.secEW) jobs.push(['section', 'ew']); if (S.secNS) jobs.push(['section', 'ns']);
      for (let i = 0; i < jobs.length; i++) { const [kind, x] = jobs[i]; btnMsg(t('v27.mp.working', { i: i + 1, n: jobs.length }));
        let r; try { r = kind === 'plan' ? await planHalf(info, x, S.dpi, ctl) : kind === 'aerial' ? await aerialHalf(info, x, S.dpi) : await sectionSheet(info, x, S.dpi); }
        catch (e) { r = { kind, half: x, dir: x, skipped: e.message || String(e) }; }
        const sheet = { kind, part: x, denom: info.denom, skipped: r.skipped || null, measured: r.measured || null, mmPerM: r.mmPerM || null, outlineMm: r.skipped ? null : { x0: OX, x1: OX + MODEL_MM, y0: OY, y1: OY + HALF } };
        meta.sheets.push(sheet); if (r.cv) pages.push({ canvas: r.cv, paper: 'A3L', quality: 0.9 }); }
      if (!pages.length) throw new Error(meta.sheets.map(s => s.skipped).filter(Boolean).join(' · ') || 'no sheets');
      const bytes = GA.pdf.build(pages, { title: 'Granada Atlas - model workshop 1:' + info.denom }); const blob = new Blob([bytes], { type: 'application/pdf' });
      meta.pages = pages.length; meta.bytes = blob.size; S.last = meta; GA.pages.download(blob, `granada_model_40x40_1-${info.denom}.pdf`);
      if (GA.submission && GA.submission.exported) try { GA.submission.exported(null, 'model:' + info.denom); } catch (e) { }
      const sk = meta.sheets.filter(s => s.skipped); btnMsg(t('v27.mp.done', { n: pages.length, d: nf(info.denom) }) + (sk.length ? ' ' + t('v27.mp.skipped', { s: sk.map(s => `${t('v27.mp.kind.' + s.kind)}: ${s.skipped}`).join(' · ') }) : ''));
    } catch (e) { console.error(e); btnMsg(t('v27.mp.failed', { e: e.message || String(e) })); }
    finally { S.busy = false; }
  }

  // ---------- drawing a square on the map ----------
  function drawSquare() {
    const map = GA.app.map; const banner = document.getElementById('mode-banner'); let first = null;
    GA.pages.close(); if (banner) { banner.hidden = false; banner.textContent = t('v27.mp.drawHint'); }
    map.getCanvas().style.cursor = 'crosshair';
    const done = (ok) => { map.off('click', onClick); removeEventListener('keydown', onKey, true); map.getCanvas().style.cursor = ''; if (banner) { banner.hidden = true; banner.textContent = ''; } if (ok) { S.src = 'square'; S.open = true; } GA.pages.go('print'); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(false); } };
    const onClick = (e) => { const p = [e.lngLat.lng, e.lngLat.lat]; if (!first) { first = p; if (banner) banner.textContent = t('v27.mp.drawHint2'); return; }
      const a = U().forward(first), b = U().forward(p); const side = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); if (side < 5) return;
      S.square = { center: U().inverse([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), side }; done(true); };
    map.on('click', onClick); addEventListener('keydown', onKey, true);
  }

  // ---------- the panel in Print layout ----------
  function html() {
    const info = plan(); const o = (v, l) => `<option value="${v}" ${S.src === v ? 'selected' : ''}>${esc(l)}</option>`;
    return `<details class="pl-model" id="pl-model" ${S.open ? 'open' : ''}><summary><b>${t('v27.mp.title')}</b> <span class="fine">${t('v27.mp.sub')}</span></summary>
      <p class="fine">${t('v27.mp.lead')}</p>
      <label>${t('v27.mp.area')} <select data-mp="src">${o('view', t('v27.mp.view'))}${S.square ? o('square', t('v27.mp.square') + ` (${nf(S.square.side)} m)`) : ''}${areas().map(a => o('area:' + a.id, a.name)).join('')}</select></label>
      <p><button type="button" class="btn btn-small" data-mp-act="draw">${t('v27.mp.draw')}</button></p>
      <div class="pl-model-calc" id="mp-calc" role="status">${info.denom ? `<p>${t('v27.mp.calc', { s: nf(info.side), x: nf(info.exact), d: nf(info.denom) })}</p><p class="mp-big"><b dir="ltr">1:${nf(info.denom)}</b> · ${t('v27.mp.ground', { m: nf(info.ground) })}</p>` : `<p class="mp-err">${t('v27.mp.tooLarge', { m: nf(info.side) })}</p>`}</div>
      <fieldset class="mp-what"><legend>${t('v27.mp.sheets')}</legend>
        <label class="chk"><input type="checkbox" data-mp="plan" ${S.plan ? 'checked' : ''}> ${t('v27.mp.kind.plan')} (${t('v27.mp.twoSheets')})</label>
        <label class="chk"><input type="checkbox" data-mp="aerial" ${S.aerial ? 'checked' : ''}> ${t('v27.mp.kind.aerial')} (${t('v27.mp.twoSheets')})</label>
        <label class="chk"><input type="checkbox" data-mp="secEW" ${S.secEW ? 'checked' : ''}> ${t('v27.mp.secEW')}</label>
        <label class="chk"><input type="checkbox" data-mp="secNS" ${S.secNS ? 'checked' : ''}> ${t('v27.mp.secNS')}</label></fieldset>
      <label>${t('pl.dpi')} <select data-mp="dpi">${[150, 200, 300].map(v => `<option value="${v}" ${S.dpi === v ? 'selected' : ''}>${v} dpi</option>`).join('')}</select></label>
      <p class="fine">${t('v27.mp.how')}</p>
      <p><button type="button" class="btn btn-primary" data-mp-act="pdf" ${info.denom ? '' : 'disabled'}>${t('v27.mp.export')}</button></p>
      <p class="fine" id="mp-msg" role="status"></p></details>`;
  }
  function mount(body) { const el = body.querySelector('#pl-model'); if (!el) return;
    const rerender = () => { const open = el.open; S.open = open; const tmp = document.createElement('div'); tmp.innerHTML = html(); const nw = tmp.firstElementChild; el.replaceWith(nw); mount(body); };
    el.addEventListener('toggle', () => { S.open = el.open; });
    el.addEventListener('change', (e) => { const x = e.target; const k = x.dataset.mp; if (!k) return; e.stopPropagation();
      if (k === 'src') S.src = x.value; else if (k === 'dpi') S.dpi = +x.value; else S[k] = x.checked; S.open = true; rerender(); });
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-mp-act]'); if (!b) return; e.preventDefault(); e.stopPropagation();
      if (b.dataset.mpAct === 'draw') drawSquare(); else if (b.dataset.mpAct === 'pdf') exportPdf((m) => { const p = el.querySelector('#mp-msg'); if (p) p.textContent = m; }); });
    if (GA.ltrNumsDOM) GA.ltrNumsDOM(el); }
  root.GA.modelPrint = { html, mount, plan, scaleFor, STD, MODEL_MM, S, exportPdf, get last() { return S.last; } };
})(window);
