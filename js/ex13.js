/* Exercise 1.3 — City identity card (free stage), built from the brief: an identity page and five
   mapping pages (density, morphology, city centre, climate, human dimension) in the SAME square
   frame (10 × 10 or 15 × 15 km, stated), the same scale and the same north. Each page carries its
   topic number and title, map, legend, scale bar, north, source and data year, and one sentence on
   what the map shows and what surprised us. Every topic uses a different form of representation.
   Graphic choices are kept as editable parameters for the later standardisation stage. */
(function (root) {
  const { i18n: I, pages: PG, store, ext: X, data: D, geo: G, proj: PJ, palette: P } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc; const nf = PG.nf;
  const TOPICS = ['density', 'morphology', 'centre', 'climate', 'human'];
  const POP = { v: 233975, year: '1 Jan 2025', src: 'INE — Padrón municipal, cifras oficiales (tabla 2871, Granada municipality)', url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=2871' };
  function E() { const p = store.get(); const e = p.ex13 = p.ex13 || {}; e.frameKm = e.frameKm || 10; e.maps = e.maps || {}; TOPICS.forEach(k => e.maps[k] = e.maps[k] || { finding: '', surprise: '' }); e.style = Object.assign({ accent: '#992B2A', dot: 1.6, kde: 250, climate: 'canopy', human: 'kde' }, e.style || {}); return e; }
  const cache = {};
  async function base() {
    if (cache.base) return cache.base;
    await D.loadManifest(); const [adm, maj, grid, bus, places] = await Promise.all([D.single('admin'), D.single('streets_major'), fetch('data/grid/built_100m.json').then(r => r.json()), D.single('bus_service'), D.single('places')]);
    const uc = adm.features.find(f => f.properties.kind === 'urban_centre'); const muni = adm.features.find(f => f.properties.kind === 'municipio'); const hc = adm.features.find(f => f.properties.kind === 'historic_core');
    const ring0 = (g) => g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
    const polys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const muniArea = polys(muni.geometry).reduce((s, pl) => s + G.ringArea(pl[0]) - pl.slice(1).reduce((x, h) => x + G.ringArea(h), 0), 0);
    const fg = D.manifest.overview.figureGround; const fgImg = await X.loadImage('data/' + fg.file);
    cache.base = { adm, maj, grid, bus, places, uc, muni, hc, centre: G.centroidLL(ring0(uc.geometry)), muniArea, fg, fgImg };
    return cache.base;
  }
  function frame(e, B) { const c = e.centre || B.centre; const u = PJ.EPSG25830.forward(c); const h = e.frameKm * 500; return { x0: u[0] - h, y0: u[1] - h, x1: u[0] + h, y1: u[1] + h, km: e.frameKm, den: e.frameKm === 15 ? 75000 : 50000 }; }
  // ---------- map drawing in the shared frame ----------
  function mapCanvas(k, e, B, f, px) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px; const ctx = cv.getContext('2d'); const mpp = (f.x1 - f.x0) / px; const s = px / 1200; const A = e.style.accent;
    const Xp = (x) => (x - f.x0) / mpp, Yp = (y) => (f.y1 - y) / mpp; const U = (ll) => PJ.EPSG25830.forward(ll);
    const linePath = (g) => { const ls = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates : g.coordinates.flat(); ls.forEach(l => l.forEach((p, i) => { const u = U(p); i ? ctx.lineTo(Xp(u[0]), Yp(u[1])) : ctx.moveTo(Xp(u[0]), Yp(u[1])); })); };
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, px, px);
    const streets = (col, w, re) => { ctx.strokeStyle = col; ctx.lineWidth = w * s; ctx.beginPath(); B.maj.features.filter(x => re.test(x.properties.hw)).forEach(x => linePath(x.geometry)); ctx.stroke(); };
    const outline = (feat, col, w, dash) => { if (!feat) return; ctx.strokeStyle = col; ctx.lineWidth = w * s; ctx.setLineDash((dash || []).map(v => v * s)); ctx.beginPath(); linePath(feat.geometry); ctx.stroke(); ctx.setLineDash([]); };
    const legend = [];
    if (k === 'density') {
      const g = B.grid; const br = [0.1, 0.2, 0.35, 0.5]; const cols = ['#F6E3E2', '#E8B9B7', '#D07674', '#A63B39', '#6E1C1B'];
      g.cells.forEach(([i, j, gsi]) => { const x = g.ox + i * g.cell, y = g.oy - j * g.cell; if (x + g.cell < f.x0 || x > f.x1 || y < f.y0 || y - g.cell > f.y1) return; ctx.fillStyle = cols[br.filter(b => gsi > b).length]; ctx.fillRect(Xp(x), Yp(y), g.cell / mpp + 0.6, g.cell / mpp + 0.6); });
      streets('rgba(28,30,33,.35)', 0.8, /motorway|trunk|primary/); outline(B.muni, '#5E636A', 1.4, [8, 5]);
      ['0–0.10', '0.10–0.20', '0.20–0.35', '0.35–0.50', '> 0.50'].forEach((l, i) => legend.push({ sw: cols[i], label: 'GSI ' + l })); legend.push({ line: '#5E636A', w: 1.4, dash: true, label: t('clim.muni') });
    } else if (k === 'morphology') {
      ctx.imageSmoothingEnabled = true; ctx.drawImage(B.fgImg, Xp(B.fg.ox), Yp(B.fg.oy), B.fg.width * B.fg.px_m / mpp, B.fg.height * B.fg.px_m / mpp);
      outline(B.muni, '#9A9EA4', 1.2, [8, 5]); legend.push({ sw: '#1C1E21', label: t('g.building') }, { line: '#9A9EA4', w: 1.2, dash: true, label: t('clim.muni') });
    } else if (k === 'centre') {
      streets('#D5D6D8', 0.9, /motorway|trunk|primary|secondary/); outline(B.muni, '#B9BBBE', 1, [8, 5]);
      // places as small dots (activity), stops as proportional symbols (scheduled departures)
      ctx.fillStyle = 'rgba(28,30,33,.28)'; B.places.features.forEach(ft => { const p = ft.properties; if (p.dup || p.s === 'permanently_closed') return; const u = U(ft.geometry.coordinates); if (u[0] < f.x0 || u[0] > f.x1 || u[1] < f.y0 || u[1] > f.y1) return; ctx.fillRect(Xp(u[0]) - 0.6 * s, Yp(u[1]) - 0.6 * s, 1.2 * s, 1.2 * s); });
      const mx = 909; B.bus.features.slice().sort((a, b) => b.properties.trips_day - a.properties.trips_day).forEach(ft => { const v = ft.properties.trips_day; if (!v) return; const u = U(ft.geometry.coordinates); const r = Math.sqrt(v / mx) * 22 * s; ctx.beginPath(); ctx.arc(Xp(u[0]), Yp(u[1]), r, 0, Math.PI * 2); ctx.fillStyle = A + '55'; ctx.fill(); ctx.strokeStyle = A; ctx.lineWidth = 0.8 * s; ctx.stroke(); });
      outline(B.hc, A, 2.4, [6, 3]); outline(B.uc, '#2F5F8A', 2, [2, 3]);
      legend.push({ dot: A, label: t('e13.lg.bus') }, { sw: 'rgba(28,30,33,.4)', label: t('e13.lg.places') }, { line: A, w: 2.4, dash: true, label: t('ly.historicCore') }, { line: '#2F5F8A', w: 2, dash: true, label: t('ly.urbanCentre') });
    } else if (k === 'climate') {
      const cl = cache['clim' + f.km + e.style.climate + (e.centre || '')];
      if (cl && cl.tcd && e.style.climate === 'canopy') { const g = cl.tcd; const step = Math.max(1, Math.round(10 / mpp)); const img = ctx.createImageData(Math.ceil(px / step), Math.ceil(px / step)); for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) { const v = D.sampleGrid(g, f.x0 + (i + 0.5) * step * mpp, f.y1 - (j + 0.5) * step * mpp, true); const col = X.tcdColour(v); if (!col) continue; const o = (j * img.width + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255; } const tmp = document.createElement('canvas'); tmp.width = img.width; tmp.height = img.height; tmp.getContext('2d').putImageData(img, 0, 0); ctx.drawImage(tmp, 0, 0, px, px); X.TCD_CLASSES.slice(1).forEach(c => legend.push({ sw: `rgb(${c.col.slice(0, 3).join(',')})`, label: `${c.k.replace('-', '–')} % ${t('g3.tcd')}` })); }
      if (cl && cl.lst && e.style.climate === 'lst') { ctx.globalAlpha = 0.8; ctx.imageSmoothingEnabled = false; ctx.drawImage(cl.lst, 0, 0, px, px); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; root.GA.rasterClass.legendItems('lst').forEach(i => legend.push(Object.assign(i, { alpha: 0.8 }))); legend.push({ label: t('clim.lstLg', { d: X.LST_DATE }) }); }
      if (cl && cl.flood) { ctx.globalAlpha = 0.9; ctx.drawImage(cl.flood, 0, 0, px, px); ctx.globalAlpha = 1; legend.push({ sw: X.FLOOD.find(z => z.k === 'q100').color, alpha: 0.9, label: t('e13.lg.flood') }); }
      ctx.globalAlpha = 0.35; ctx.drawImage(B.fgImg, Xp(B.fg.ox), Yp(B.fg.oy), B.fg.width * B.fg.px_m / mpp, B.fg.height * B.fg.px_m / mpp); ctx.globalAlpha = 1; outline(B.muni, '#5E636A', 1.2, [8, 5]);
      legend.push({ sw: 'rgba(28,30,33,.35)', label: t('g.building') });
      if (!cl) legend.push({ label: t('e13.loadingClim') });
    } else if (k === 'human') {
      streets('#E2E3E5', 0.8, /motorway|trunk|primary|secondary/);
      const pts = B.places.features.filter(ft => !ft.properties.dup && ft.properties.s !== 'permanently_closed' && ft.properties.g !== 'geographic_entities');
      if (e.style.human === 'kde') {
        const R = e.style.kde; const cell = Math.max(25, R / 5); const nx = Math.ceil((f.x1 - f.x0) / cell), ny = Math.ceil((f.y1 - f.y0) / cell); const grid = new Float32Array(nx * ny); const rc = Math.ceil(R / cell);
        pts.forEach(ft => { const u = U(ft.geometry.coordinates); const ci = Math.floor((u[0] - f.x0) / cell), cj = Math.floor((f.y1 - u[1]) / cell); for (let j = cj - rc; j <= cj + rc; j++) for (let i = ci - rc; i <= ci + rc; i++) { if (i < 0 || j < 0 || i >= nx || j >= ny) continue; const dx = (f.x0 + (i + 0.5) * cell) - u[0], dy = (f.y1 - (j + 0.5) * cell) - u[1]; const d2 = (dx * dx + dy * dy) / (R * R); if (d2 < 1) grid[j * nx + i] += 3 / Math.PI * (1 - d2) * (1 - d2) / (R * R) * 1e6; } }); // Epanechnikov-type (quartic) kernel → places per km²
        const br = [100, 300, 700, 1500]; const cols = ['rgba(255,255,255,0)', '#F3DCDB', '#DE9F9D', '#B8504E', '#6E1C1B'];
        const img = ctx.createImageData(nx, ny); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = grid[j * nx + i]; const c = br.filter(b => v > b).length; if (!c) continue; const h = cols[c]; const o = (j * nx + i) * 4; img.data[o] = parseInt(h.slice(1, 3), 16); img.data[o + 1] = parseInt(h.slice(3, 5), 16); img.data[o + 2] = parseInt(h.slice(5, 7), 16); img.data[o + 3] = 235; }
        const tmp = document.createElement('canvas'); tmp.width = nx; tmp.height = ny; tmp.getContext('2d').putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, 0, 0, px, px);
        legend.push(...['100–300', '300–700', '700–1,500', '> 1,500'].map((l, i) => ({ sw: cols[i + 1], label: l + ' ' + t('e13.lg.kdeUnit') })));
        legend.push({ label: t('e13.lg.kdeNote', { r: R, n: nf(pts.length) }) });
      } else {
        const tour = new Set(['lodging', 'arts_and_entertainment', 'cultural_and_historic']); const daily = new Set(['food_and_drink', 'shopping', 'health_care', 'education', 'lifestyle_services', 'community_and_government']);
        pts.forEach(ft => { const g = ft.properties.g; const col = tour.has(g) ? A : daily.has(g) ? '#1C1E21' : null; if (!col) return; const u = U(ft.geometry.coordinates); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(Xp(u[0]), Yp(u[1]), e.style.dot * s, 0, Math.PI * 2); ctx.fill(); });
        legend.push({ dot: A, label: t('e13.lg.tourism') }, { dot: '#1C1E21', label: t('e13.lg.daily') });
      }
      outline(B.muni, '#9A9EA4', 1, [8, 5]);
    }
    ctx.strokeStyle = '#1C1E21'; ctx.lineWidth = 1.5 * s; ctx.strokeRect(0, 0, px, px);
    return { cv, legend, mpp };
  }
  async function climLoad(e, B, f) {
    const key = 'clim' + f.km + e.style.climate + (e.centre || ''); if (cache[key]) return cache[key];
    const out = {}; const ringF = [[f.x0, f.y0], [f.x1, f.y0], [f.x1, f.y1], [f.x0, f.y1], [f.x0, f.y0]].map(p => PJ.EPSG25830.inverse(p));
    if (e.style.climate === 'canopy') { try { out.tcd = await X.tcdGrid(ringF, 0); } catch (er) { out.err = er.message; } }
    else { try { out.lst = await X.warp3857(X.SVC.gibs, 'MODIS_Aqua_L3_Land_Surface_Temp_8Day_Day', { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, w: 600, h: 600 }, '&TIME=' + X.LST_DATE); } catch (er) { out.err = er.message; } }
    try { out.flood = await X.loadImage(X.wmsURL(X.SVC.miteco, 'agua:Zi_laminas_q100', [f.x0, f.y0, f.x1, f.y1], 1400, 1400, 25830), 40000); } catch (er) { }
    // drawn in the atlas classes so the legend below matches (js/rasterclass.js)
    const RC = root.GA.rasterClass; if (out.lst) out.lst = await RC.recolourImage('lst', out.lst).catch(() => null); if (out.flood) out.flood = await RC.recolourImage('flood', out.flood).catch(() => null);
    cache[key] = out; return out;
  }
  const SRC = { density: 'e13.src.density', morphology: 'e13.src.morph', centre: 'e13.src.centre', climate: 'e13.src.climate', human: 'e13.src.human' };
  // ---------- A3 pages ----------
  async function pageCanvas(k) {
    const e = E(); const B = await base(); const f = frame(e, B); const dpi = 150; const S = PG.sheet(420, 297, dpi); const { cv, ctx, W, H } = S; const F = PG.font(); const rtl = I.dir() === 'rtl'; const M = 60; const al = rtl ? 'right' : 'left';
    ctx.fillStyle = e.style.accent; ctx.fillRect(0, 0, W, 8); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = al;
    const mapPx = Math.round(200 / 25.4 * dpi); const mx = rtl ? W - M - mapPx : M, my = 120; const sx = rtl ? M : mx + mapPx + 60, sw = W - 2 * M - mapPx - 60; const tx = rtl ? sx + sw : sx;
    const text = (s, y, size, weight, color, lines) => { ctx.font = `${weight || 400} ${size}px ${F}`; ctx.fillStyle = color || '#1C1E21'; ctx.textAlign = al; return PG.wrap(ctx, s, tx, y, sw, size * 1.4, lines); };
    if (k === 'identity') {
      ctx.font = `700 64px ${F}`; ctx.fillStyle = '#1C1E21'; ctx.fillText('Granada', rtl ? W - M : M, 110); ctx.font = `600 34px ${F}`; ctx.fillStyle = '#3C4046'; ctx.fillText('גרנדה · Granada (España) · غرناطة', rtl ? W - M : M, 160);
      const off = mapCanvas('morphology', e, B, (() => { const u = PJ.EPSG25830.forward(e.centre || B.centre); const h = 12500; return { x0: u[0] - h, y0: u[1] - h, x1: u[0] + h, y1: u[1] + h, km: 25 }; })(), 900);
      const octx = off.cv.getContext('2d'); const m2 = 25000 / 900; const ff = frame(e, B); const fx = (ff.x0 - (PJ.EPSG25830.forward(e.centre || B.centre)[0] - 12500)) / m2, fy = ((PJ.EPSG25830.forward(e.centre || B.centre)[1] + 12500) - ff.y1) / m2; octx.strokeStyle = e.style.accent; octx.lineWidth = 4; octx.strokeRect(fx, fy, (ff.x1 - ff.x0) / m2, (ff.y1 - ff.y0) / m2);
      ctx.drawImage(off.cv, rtl ? M : W - M - 900, 210, 900, 900); ctx.font = `14px ${F}`; ctx.fillStyle = '#3C4046'; ctx.textAlign = rtl ? 'left' : 'right'; ctx.fillText(t('e13.locator', { k: e.frameKm }), rtl ? M : W - M, 1135);
      const lx = rtl ? W - M : M, lw = W - 2 * M - 960; const L = (s, y, size, weight, color, lines) => { ctx.font = `${weight || 400} ${size}px ${F}`; ctx.fillStyle = color || '#1C1E21'; ctx.textAlign = al; return PG.wrap(ctx, s, lx, y, lw, size * 1.45, lines); };
      let y = 240; const pop = e.pop || POP; const area = B.muniArea / 1e6; const dens = pop.v / area;
      y = L(t('e13.country'), y, 22, 600); y = L(e.students || t('e13.namesMissing'), y + 6, 22, 400, e.students ? '#1C1E21' : '#992B2A');
      [[t('e13.pop'), nf(pop.v), `${pop.year} · ${pop.src}`], [t('e13.area'), nf(area, 1) + ' km²', t('e13.areaSrc')], [t('e13.density'), nf(dens) + ' ' + t('e13.perKm2'), t('e13.densSrc')]].forEach(([a, b, c]) => { y = L(a, y + 26, 20, 600, '#5E636A'); y = L(b, y + 2, 44, 700); y = L(c, y, 15, 400, '#5E636A', 3); });
      y = L(t('e13.frameStated', { k: e.frameKm, s: '1:' + f.den.toLocaleString('en-US') }), y + 24, 17, 400, '#3C4046', 3);
      y = L(t('e13.synthesis'), y + 24, 20, 700, e.style.accent); L(e.synthesis || '—', y + 4, 22, 400, '#1C1E21', 8);
      PG.footer(ctx, W, H, `Granada Atlas · ${t('e13.footer')} · ${new Date().toISOString().slice(0, 10)}`);
      return cv;
    }
    if (k === 'climate') await climLoad(e, B, f);
    const m = mapCanvas(k, e, B, f, mapPx); ctx.drawImage(m.cv, mx, my);
    PG.northArrow(ctx, mx + mapPx - 30, my + 20, 1.4); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(mx + 12, my + mapPx - 62, 340, 48); ctx.fillStyle = '#222428'; PG.scaleBar(ctx, mx + 24, my + mapPx - 30, m.mpp, 260, 1.2);
    const i = TOPICS.indexOf(k) + 1; let y = 112;
    ctx.font = `700 120px ${F}`; ctx.fillStyle = e.style.accent; ctx.textAlign = al; ctx.fillText(String(i).padStart(2, '0'), tx, y + 70); y += 110;
    y = text(t('e13.t.' + k), y, 46, 700); y = text(t('e13.q.' + k), y + 4, 20, 400, '#3C4046', 3);
    y = text(t('e13.form') + ': ' + t('e13.f.' + k + (k === 'climate' ? '.' + e.style.climate : k === 'human' ? '.' + e.style.human : '')), y + 8, 17, 600, '#5E636A', 2);
    y = root.GA.compare.legendCanvas(ctx, m.legend.filter(l => l.sw || l.dot || l.line || l.hatch), sx, y + 30, sw, rtl, F) + 6; m.legend.filter(l => !l.sw && !l.dot && !l.line && !l.hatch).forEach(l => { y = text(l.label, y + 4, 15, 400, '#5E636A', 3); });
    const mp = e.maps[k]; y = text(t('e13.sentence'), y + 30, 20, 700, e.style.accent); y = text([mp.finding, mp.surprise].filter(s => (s || '').trim()).join(' ') || t('e13.sentenceMissing'), y + 2, 22, 400, (mp.finding || '').trim() ? '#1C1E21' : '#992B2A', 7);
    text(t(SRC[k], { d: X.LST_DATE }) + ' · ' + t('e13.scaleLine', { s: '1:' + f.den.toLocaleString('en-US'), k: e.frameKm }), H - 120, 15, 400, '#3C4046', 4);
    PG.footer(ctx, W, H, `Granada Atlas · ${t('e13.footer')} · ${i}/5`);
    return cv;
  }
  // ---------- page ----------
  async function render(body) {
    const e = E(); body.innerHTML = `<div class="loading"><span class="spin"></span>${t('ws.computing')}</div>`; const B = await base(); const f = frame(e, B);
    body.innerHTML = `<div class="e13"><aside class="e13-form"><p class="fine">${t('e13.lead')}</p>
      <fieldset><legend>${t('e13.frame')}</legend><label class="chk"><input type="radio" name="e13f" value="10" ${e.frameKm === 10 ? 'checked' : ''}> 10 × 10 km (1:50,000 ${t('e13.onA3')})</label><label class="chk"><input type="radio" name="e13f" value="15" ${e.frameKm === 15 ? 'checked' : ''}> 15 × 15 km (1:75,000 ${t('e13.onA3')})</label><p class="fine">${t('e13.frameNote')}</p></fieldset>
      <label class="name"><span>${t('e13.students')}</span><input dir="auto" data-e="students" value="${esc(e.students || '')}"></label>
      ${TOPICS.map((k, i) => `<fieldset class="e13-t"><legend>${String(i + 1).padStart(2, '0')} · ${t('e13.t.' + k)}</legend><textarea dir="auto" rows="2" data-em="${k}" data-f="finding" placeholder="${esc(t('e13.findingPh'))}">${esc(e.maps[k].finding)}</textarea><textarea dir="auto" rows="1" data-em="${k}" data-f="surprise" placeholder="${esc(t('e13.surprisePh'))}">${esc(e.maps[k].surprise)}</textarea>${k === 'climate' ? `<label class="row2">${t('e13.variant')} <select data-st="climate"><option value="canopy" ${e.style.climate === 'canopy' ? 'selected' : ''}>${t('e13.f.climate.canopy')}</option><option value="lst" ${e.style.climate === 'lst' ? 'selected' : ''}>${t('e13.f.climate.lst')}</option></select></label>` : ''}${k === 'human' ? `<label class="row2">${t('e13.variant')} <select data-st="human"><option value="kde" ${e.style.human === 'kde' ? 'selected' : ''}>${t('e13.f.human.kde')}</option><option value="dots" ${e.style.human === 'dots' ? 'selected' : ''}>${t('e13.f.human.dots')}</option></select></label>` : ''}</fieldset>`).join('')}
      <label class="name"><span>${t('e13.synthesis')}</span><textarea dir="auto" rows="3" data-e="synthesis" placeholder="${esc(t('e13.synthPh'))}">${esc(e.synthesis || '')}</textarea></label>
      <fieldset><legend>${t('e13.style')}</legend><label class="row2">${t('e13.accent')} <input type="color" data-st="accent" value="${e.style.accent}"></label><label class="row2">${t('e13.kde')} <select data-st="kde">${[150, 250, 400].map(v => `<option ${e.style.kde === v ? 'selected' : ''}>${v}</option>`).join('')}</select> m</label><p class="fine">${t('e13.styleNote')}</p></fieldset>
      <div class="actions"><button class="btn btn-primary" id="e13-pdf">${t('e13.pdf')}</button><button class="btn" id="e13-zip">${t('e13.pngs')}</button></div><p class="fine">${t('e13.miro')}</p></aside>
      <div class="e13-prev">${['identity'].concat(TOPICS).map(k => `<figure data-e13="${k}"><div class="e13-img"><span class="spin"></span></div><figcaption>${k === 'identity' ? t('e13.idPage') : t('e13.t.' + k)} <button class="btn btn-tiny" data-e13png="${k}">PNG</button></figcaption></figure>`).join('')}</div></div>`;
    const prev = async (k) => { const fig = body.querySelector(`[data-e13="${k}"] .e13-img`); try { const c = await pageCanvas(k); c.style.width = '100%'; fig.innerHTML = ''; fig.appendChild(c); } catch (er) { fig.innerHTML = `<p class="error">${esc(er.message)}</p>`; } };
    for (const k of ['identity'].concat(TOPICS)) await prev(k);
    let tm; const later = (k) => { clearTimeout(tm); tm = setTimeout(() => prev(k), 400); };
    body.onchange = (ev) => { const el = ev.target; if (el.name === 'e13f') { e.frameKm = +el.value; store.save(); return render(body); } if (el.dataset.e) { e[el.dataset.e] = el.value; store.save(); later('identity'); } if (el.dataset.em) { e.maps[el.dataset.em][el.dataset.f] = el.value; store.save(); later(el.dataset.em); } if (el.dataset.st) { e.style[el.dataset.st] = el.type === 'color' ? el.value : (isFinite(+el.value) ? +el.value : el.value); store.save(); return render(body); } };
    body.onclick = async (ev) => { const b = ev.target.closest('button'); if (!b) return; b.disabled = true; try {
      if (b.dataset.e13png) { const c = await pageCanvas(b.dataset.e13png); PG.download(await PG.toBlob(c), `granada_1-3_${b.dataset.e13png === 'identity' ? '0_identity' : (TOPICS.indexOf(b.dataset.e13png) + 1) + '_' + b.dataset.e13png}.png`); }
      if (b.id === 'e13-pdf') { const pages = []; for (const k of ['identity'].concat(TOPICS)) pages.push({ canvas: await pageCanvas(k), paper: 'A3L' }); const bytes = root.GA.pdf.build(pages, { title: 'Granada - City identity card 1.3' }); PG.download(new Blob([bytes], { type: 'application/pdf' }), 'granada_1-3_identity_card.pdf'); root.GA.lastEx13 = { pages: pages.length, den: f.den }; }
      if (b.id === 'e13-zip') { const files = []; let n = 0; for (const k of ['identity'].concat(TOPICS)) { const c = await pageCanvas(k); const bl = await PG.toBlob(c); files.push({ name: `granada_1-3_${n}_${k}.png`, data: new Uint8Array(await bl.arrayBuffer()) }); n++; } PG.download(new Blob([root.GA.zip.zip(files, new Date())], { type: 'application/zip' }), 'granada_1-3_pages_png.zip'); }
    } finally { b.disabled = false; } };
  }
  PG.register('ex13', { plate: () => t('e13.plate'), title: () => t('e13.title'), render });
  root.GA.ex13 = { pageCanvas, TOPICS, POP, E };
})(window);
