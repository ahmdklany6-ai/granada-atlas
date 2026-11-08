/* Exercise 1.3 — City identity card (build 5.16). Six A3 portrait pages: a city identity page and five maps (01 density,
   02 morphology, 03 city centre, 04 climate, 05 human dimension) in ONE shared square frame stored once in
   data/ex13/frame.json (EPSG:25830, 10 × 10 km, map 250 mm → 1:40,000, grid north). No map is fitted to its own layer.
   Every page has the same layout: topic number and title above, the square map (north arrow, scale bar), the legend under
   the map (built from the same class arrays that colour the map: GA.palette.ex13 + the breaks stored with the data), key
   indicators and a small chart, one sentence, then sources, data year, units and limitations. The layers were processed
   and audited offline (tools/build_ex13.py; inputs from tools/verify/ex13_fetch.py); this module only draws them.
   "Exported" stays separate from "Uploaded to Miro" (GA.submission). */
(function (root) {
  const { i18n: I, pages: PG, store, data: D, proj: PJ } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc;
  const TOPICS = ['density', 'morphology', 'centre', 'climate', 'human'];
  const PAGES = ['identity'].concat(TOPICS);
  const C = () => root.GA.palette.ex13; const PAL = () => root.GA.palette;
  const LRI = '\u200E', PDI = '\u200E'; const iso = (s) => LRI + s + PDI; // LRM … LRM (strong L marks): numbers / ranges stay left-to-right in RTL text — canvas ignores isolate / embedding controls
  const nf = (v, d) => (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const POP = { v: 233975, year: '1 Jan 2025', src: 'INE — Padrón municipal', url: 'https://www.ine.es/dynt3/inebase/index.htm?padre=517' }; // kept for older callers; the page reads frame.json
  function E() { const p = store.get(); const e = p.ex13 = p.ex13 || {}; e.frameKm = 10; e.maps = e.maps || {}; TOPICS.forEach(k => e.maps[k] = e.maps[k] || { finding: '', surprise: '' }); return e; }
  // 5.22: the morphology map can be drawn in the architectural (figure-ground) or the artistic (notation) language; saved per project
  const artOn = (k) => k === 'morphology' && !!root.GA.ex13art && (E().maps.morphology || {}).style === 'art';

  // ---------- data (loaded once) ----------
  let DATA = null;
  async function load() {
    if (DATA) return DATA;
    const v = '?v=' + (root.GA_BUILD || ''); const j = (n) => fetch('data/ex13/' + n + '.json' + v).then(r => { if (!r.ok) throw new Error(n + ' ' + r.status); return r.json(); });
    await D.loadManifest(); const fgm = D.manifest.overview.figureGround;
    const [frame, density, morphology, centre, climate, human, adm, maj, fgImg] = await Promise.all([j('frame'), j('density'), j('morphology'), j('centre'), j('climate'), j('human'), D.single('admin'), D.single('streets_major'), root.GA.ext.loadImage('data/' + fgm.file)]);
    const U = (ll) => PJ.EPSG25830.forward(ll);
    const muniF = adm.features.find(f => f.properties.kind === 'municipio'); const rings = (g) => g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
    const muni = rings(muniF.geometry).map(r => r.map(U));
    const streets = maj.features.filter(f => /motorway|trunk|primary|secondary/.test(f.properties.hw)).map(f => (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates).map(l => l.map(U)));
    // human: GHS-POP cells beyond 300 m (row/col into the density corner grid)
    DATA = { frame, density, morphology, centre, climate, human, muni, streets, fgm, fgImg };
    return DATA;
  }
  const FR = () => DATA.frame;

  // ---------- one map, drawn in the shared frame at (x, y), S px square ----------
  function drawMap(k, ctx, x, y, S, opts) {
    const F = FR(); const mpp = (F.x1 - F.x0) / S; const s = S / 1000; const c = C();
    const X = (u) => x + (u - F.x0) / mpp, Y = (v) => y + (F.y1 - v) / mpp;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip(); ctx.fillStyle = c.paper; ctx.fillRect(x, y, S, S);
    const path = (rings) => { ctx.beginPath(); rings.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); };
    const muni = (col, w, dash) => { ctx.save(); path(DATA.muni); ctx.strokeStyle = col || c.muni; ctx.lineWidth = (w || 1.3) * s; ctx.setLineDash((dash || [7, 4]).map(v => v * s)); ctx.stroke(); ctx.restore(); };
    const figureGround = (col) => { const g = DATA.fgm; const sx = (F.x0 - g.ox) / g.px_m, sy = (g.oy - F.y1) / g.px_m, sw = (F.x1 - F.x0) / g.px_m;
      const tmp = document.createElement('canvas'); tmp.width = tmp.height = S; const tc = tmp.getContext('2d'); tc.fillStyle = '#FFFFFF'; tc.fillRect(0, 0, S, S); tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high'; tc.drawImage(DATA.fgImg, sx, sy, sw, sw, 0, 0, S, S); /* the raster is black buildings on a transparent ground */
      tc.globalCompositeOperation = 'lighten'; tc.fillStyle = col; tc.fillRect(0, 0, S, S); ctx.drawImage(tmp, x, y); };
    const hatch = (x0, y0, w, h, col, step, lw) => { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); for (let q = -h; q < w + h; q += step) { ctx.moveTo(x0 + q, y0 + h); ctx.lineTo(x0 + q + h, y0); } ctx.stroke(); ctx.restore(); };
    if (k === 'density') {
      const d = DATA.density; const cx = d.corners.x, cy = d.corners.y; const br = d.breaks; const cols = c.density;
      d.pop.forEach((row, r) => row.forEach((p, q) => { if (!p || p <= 0) return; const v = p * 100; const ci = br.filter(b => v > b).length;
        ctx.beginPath(); ctx.moveTo(X(cx[r][q]), Y(cy[r][q])); ctx.lineTo(X(cx[r][q + 1]), Y(cy[r][q + 1])); ctx.lineTo(X(cx[r + 1][q + 1]), Y(cy[r + 1][q + 1])); ctx.lineTo(X(cx[r + 1][q]), Y(cy[r + 1][q])); ctx.closePath();
        ctx.fillStyle = cols[ci]; ctx.fill(); ctx.strokeStyle = cols[ci]; ctx.lineWidth = 0.6; ctx.stroke(); }));
      muni();
    } else if (artOn(k)) {
      root.GA.ex13art.draw(ctx, DATA, x, y, S, opts);
    } else if (k === 'morphology') {
      figureGround(c.building);
      const m = DATA.morphology; const cs = m.grid.cell / mpp;
      m.gaps.forEach(([r, q]) => { const gx = X(m.grid.x0 + q * m.grid.cell), gy = Y(m.grid.y1 - r * m.grid.cell); ctx.strokeStyle = c.gap; ctx.lineWidth = 1.2 * s; ctx.strokeRect(gx, gy, cs, cs); hatch(gx, gy, cs, cs, c.gap, 4 * s, 1.1 * s); });
      muni(PAL().red, 1.2);
    } else if (k === 'centre') {
      ctx.save(); ctx.strokeStyle = c.street; ctx.lineWidth = 0.9 * s; DATA.streets.forEach(ls => { ctx.beginPath(); ls.forEach(l => l.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); }); ctx.restore();
      // the kernel surface is smooth by construction (r = 300 m): bilinear interpolation of the 50 m grid, then the classes
      const g = DATA.centre.grid, z = DATA.centre.z, br = DATA.centre.breaks, cols = c.centre; const up = 4, n = g.n * up;
      const img = ctx.createImageData(n, n); const val = (i, j) => z[Math.max(0, Math.min(g.n - 1, j))][Math.max(0, Math.min(g.n - 1, i))];
      for (let jj = 0; jj < n; jj++) for (let ii = 0; ii < n; ii++) { const fx = (ii + 0.5) / up - 0.5, fy = (jj + 0.5) / up - 0.5; const i0 = Math.floor(fx), j0 = Math.floor(fy), ax = fx - i0, ay = fy - j0;
        const v = (1 - ax) * (1 - ay) * val(i0, j0) + ax * (1 - ay) * val(i0 + 1, j0) + (1 - ax) * ay * val(i0, j0 + 1) + ax * ay * val(i0 + 1, j0 + 1); const ci = br.filter(b => v >= b).length; if (!ci) continue;
        const rgb = PAL().rgb(cols[ci - 1]); const o = (jj * n + ii) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 225; }
      const tmp = document.createElement('canvas'); tmp.width = tmp.height = n; tmp.getContext('2d').putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, x, y, g.n * g.cell / mpp, g.n * g.cell / mpp); ctx.imageSmoothingEnabled = true;
      muni();
      const geomRings = (gm) => gm.type === 'Polygon' ? gm.coordinates : gm.type === 'MultiPolygon' ? gm.coordinates.flat() : [];
      ctx.save(); path(geomRings(DATA.centre.hist.geometry)); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5 * s; ctx.stroke(); ctx.strokeStyle = c.hist; ctx.lineWidth = 2.6 * s; ctx.setLineDash([9 * s, 5 * s]); ctx.stroke(); ctx.restore();
      DATA.centre.whc.forEach(w => { const gm = w.geometry; if (gm.type === 'Point') { ctx.beginPath(); ctx.arc(X(gm.coordinates[0]), Y(gm.coordinates[1]), 5 * s, 0, Math.PI * 2); ctx.strokeStyle = c.whc; ctx.lineWidth = 2 * s; ctx.stroke(); return; }
        path(geomRings(gm)); ctx.strokeStyle = c.whc; ctx.lineWidth = 2 * s; ctx.setLineDash([]); ctx.stroke(); });
      DATA.centre.peaks.forEach(p => { const px = X(p.x), py = Y(p.y); ctx.beginPath(); ctx.arc(px, py, (p.rank === 1 ? 11 : 8) * s, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.lineWidth = 2.4 * s; ctx.strokeStyle = c.centreLine; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 2.6 * s, 0, Math.PI * 2); ctx.fillStyle = c.centreLine; ctx.fill();
        ctx.font = `700 ${Math.round(17 * s)}px ${PG.font()}`; ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4 * s; ctx.strokeText('C' + p.rank, px + 12 * s, py - 8 * s); ctx.fillStyle = c.centreLine; ctx.fillText('C' + p.rank, px + 12 * s, py - 8 * s); });
    } else if (k === 'climate') {
      const g = DATA.climate.grid, L = DATA.climate.lst, br = DATA.climate.breaks, cols = c.lst; const n = g.n;
      const img = ctx.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = L[j][i]; const o = (j * n + i) * 4; if (v == null) continue; const rgb = PAL().rgb(cols[br.filter(b => v >= b).length]); img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255; }
      const tmp = document.createElement('canvas'); tmp.width = tmp.height = n; tmp.getContext('2d').putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, x, y, n * g.cell / mpp, n * g.cell / mpp); ctx.imageSmoothingEnabled = true; // blocks: no detail finer than the data
      // missing cells (fewer than 3 clear observations) hatched
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (L[j][i] == null) hatch(X(g.x0 + i * g.cell), Y(g.y1 - j * g.cell), g.cell / mpp, g.cell / mpp, PAL().grey, 3 * s, 0.8 * s);
      // vegetation context: outline of the cells with summer median NDVI ≥ 0.4
      const V = DATA.climate.ndvi; const veg = (i, j) => i >= 0 && j >= 0 && i < n && j < n && V[j][i] != null && V[j][i] >= 0.4; const cw = g.cell / mpp;
      ctx.save(); ctx.strokeStyle = c.veg; ctx.lineWidth = 1.8 * s; ctx.beginPath();
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if (!veg(i, j)) continue; const gx = x + i * cw, gy = y + j * cw;
        if (!veg(i, j - 1)) { ctx.moveTo(gx, gy); ctx.lineTo(gx + cw, gy); } if (!veg(i, j + 1)) { ctx.moveTo(gx, gy + cw); ctx.lineTo(gx + cw, gy + cw); } if (!veg(i - 1, j)) { ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + cw); } if (!veg(i + 1, j)) { ctx.moveTo(gx + cw, gy); ctx.lineTo(gx + cw, gy + cw); } }
      ctx.stroke(); ctx.restore(); muni(PAL().ink, 1.3);
    } else if (k === 'human') {
      figureGround(c.ctx);
      const d = DATA.density, cx = d.corners.x, cy = d.corners.y;
      DATA.human.far.forEach(([r, q]) => { ctx.beginPath(); ctx.moveTo(X(cx[r][q]), Y(cy[r][q])); ctx.lineTo(X(cx[r][q + 1]), Y(cy[r][q + 1])); ctx.lineTo(X(cx[r + 1][q + 1]), Y(cy[r + 1][q + 1])); ctx.lineTo(X(cx[r + 1][q]), Y(cy[r + 1][q])); ctx.closePath(); ctx.fillStyle = `rgba(${PAL().rgb(c.far).join(',')},0.42)`; ctx.fill(); });
      const fillAreas = (list, col, a) => { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; list.forEach(f => { path(f.p); ctx.fill('evenodd'); }); ctx.restore(); };
      fillAreas(DATA.human.areas.park || [], c.park, 0.78); fillAreas(DATA.human.areas.square || [], c.square, 0.95);
      const P = DATA.human.points; const dot = (list, fn) => (list || []).forEach(p => fn(X(p[0]), Y(p[1])));
      dot(P.cafe, (px, py) => { ctx.beginPath(); ctx.arc(px, py, 2.1 * s, 0, Math.PI * 2); ctx.fillStyle = c.cafe; ctx.fill(); });
      dot(P.playground, (px, py) => { ctx.beginPath(); ctx.moveTo(px, py - 4 * s); ctx.lineTo(px + 3.6 * s, py + 2.6 * s); ctx.lineTo(px - 3.6 * s, py + 2.6 * s); ctx.closePath(); ctx.fillStyle = c.play; ctx.fill(); });
      dot(P.civic, (px, py) => { ctx.beginPath(); ctx.arc(px, py, 4.2 * s, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = c.civic; ctx.lineWidth = 2 * s; ctx.stroke(); });
      dot(P.square_pt, (px, py) => { ctx.fillStyle = c.square; ctx.fillRect(px - 3 * s, py - 3 * s, 6 * s, 6 * s); });
      dot(P.market, (px, py) => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(px - 7.5 * s, py - 7.5 * s, 15 * s, 15 * s); ctx.fillStyle = c.market; ctx.fillRect(px - 5.5 * s, py - 5.5 * s, 11 * s, 11 * s); });
      muni();
    }
    ctx.restore();
    // frame, north arrow, scale bar (same on every map)
    ctx.save(); ctx.strokeStyle = c.frame; ctx.lineWidth = 1.6 * s; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
    const nx = x + S - 34 * s, ny = y + 22 * s; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(nx - 16 * s, ny - 8 * s, 32 * s, 58 * s); PG.northArrow(ctx, nx, ny, 1.25 * s);
    const bx = x + 18 * s, by = y + S - 34 * s, km = 1000 / mpp; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 8 * s, by - 26 * s, 2 * km + 120 * s, 46 * s);
    ctx.fillStyle = PAL().ink; ctx.fillRect(bx, by, km, 6 * s); ctx.strokeStyle = PAL().ink; ctx.lineWidth = 1.2 * s; ctx.strokeRect(bx, by, 2 * km, 6 * s);
    ctx.font = `${Math.round(13 * s)}px ${PG.font()}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.fillText('0', bx, by - 6 * s); ctx.fillText('1', bx + km, by - 6 * s); ctx.fillText('2 km', bx + 2 * km, by - 6 * s);
    ctx.textAlign = 'left'; ctx.font = `600 ${Math.round(13 * s)}px ${PG.font()}`; ctx.fillText('1:' + nf(FR().scale), bx + 2 * km + 26 * s, by + 6 * s); ctx.restore();
  }

  // ---------- legends: built from the same arrays that coloured the map ----------
  const ranges = (br, unit, firstLo) => { const out = []; const lo = [firstLo].concat(br); for (let i = 0; i <= br.length; i++) out.push(i < br.length ? iso(`${nf(lo[i])}–${nf(br[i])}`) + ' ' + unit : t('x13.over', { v: iso(nf(br[br.length - 1])) }) + ' ' + unit); return out; };
  function legendItems(k) {
    const c = C(); const L = [];
    if (k === 'density') { const lab = ranges(DATA.density.breaks, t('x13.perKm2'), 0); c.density.forEach((col, i) => L.push({ sw: col, label: lab[i] })); L.push({ sw: '#FFFFFF', label: t('x13.lg.noRes') }, { line: c.muni, dash: true, label: t('x13.lg.muni') }); }
    if (artOn(k)) return root.GA.ex13art.legendItems(t, DATA);
    if (k === 'morphology') L.push({ sw: c.building, label: t('x13.lg.building') }, { sw: '#FFFFFF', label: t('x13.lg.open') }, { hatch: c.gap, label: t('x13.lg.gap') }, { line: PAL().red, dash: true, label: t('x13.lg.muni') });
    if (k === 'centre') { const br = DATA.centre.breaks; c.centre.forEach((col, i) => L.push({ sw: col, label: i < br.length - 1 ? iso(`${nf(br[i])}–${nf(br[i + 1])}`) + ' ' + t('x13.placesKm2') : t('x13.atLeast', { v: iso(nf(br[i])) }) + ' ' + t('x13.placesKm2') }));
      L.push({ peak: true, label: t('x13.lg.peak') }, { line: c.hist, dash: true, w: 2.6, label: t('x13.lg.hist') }, { line: c.whc, w: 2, label: t('x13.lg.whc') }, { line: c.street, w: 1.2, label: t('x13.lg.streets') }, { line: c.muni, dash: true, label: t('x13.lg.muni') }); }
    if (k === 'climate') { const br = DATA.climate.breaks; c.lst.forEach((col, i) => L.push({ sw: col, label: i === 0 ? t('x13.below', { v: iso(`${br[0]} °C`) }) : i < br.length ? iso(`${br[i - 1]}–${br[i]} °C`) : t('x13.atLeast', { v: iso(`${br[br.length - 1]} °C`) }) }));
      L.push({ line: c.veg, w: 1.8, label: t('x13.lg.veg') }, { line: PAL().ink, dash: true, label: t('x13.lg.muni') }); if ((DATA.climate.stats.missing_cells || 0) > 0) L.push({ hatch: PAL().grey, label: t('x13.lg.missing') }); }
    if (k === 'human') L.push({ sw: c.square, label: t('x13.lg.square') }, { sw: c.park, alpha: 0.78, label: t('x13.lg.park') }, { mk: 'market', label: t('x13.lg.market') }, { mk: 'cafe', label: t('x13.lg.cafe') }, { mk: 'play', label: t('x13.lg.play') }, { mk: 'civic', label: t('x13.lg.civic') }, { sw: c.far, alpha: 0.42, label: t('x13.lg.far') }, { sw: c.ctx, label: t('x13.lg.ctxBld') });
    return L;
  }
  // text helpers that keep the LRI/PDI isolates (numbers stay LTR in Arabic and Hebrew)
  function para(ctx, text, x, y, w, o) {
    const size = o.size, lh = Math.round(size * (o.lh || 1.36)); ctx.save(); ctx.font = `${o.weight || 400} ${size}px ${o.F}`; ctx.fillStyle = o.color || PAL().ink; ctx.direction = o.rtl ? 'rtl' : 'ltr'; ctx.textAlign = o.rtl ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
    const words = String(text || '').split(/\s+/).filter(Boolean); const lines = []; let line = '';
    for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (ctx.measureText(tt).width > w && line) { lines.push(line); line = wd; } else line = tt; } if (line) lines.push(line);
    let yy = y + size; lines.forEach(l => { if (!o.dry) ctx.fillText(l, o.rtl ? x + w : x, yy); yy += lh; }); ctx.restore(); return yy - lh + Math.round(size * 0.5);
  }
  function legend(ctx, items, x, y, w, o) {
    const fs = o.size, sw = Math.round(fs * 1.5), sh = Math.round(fs * 0.85), row = Math.round(fs * 1.6), gap = Math.round(fs * 1.1); const rtl = o.rtl; const c = C();
    const cols = o.cols || 2; const colW = (w - (cols - 1) * gap) / cols; let i = 0; let yy = y;
    ctx.save(); ctx.font = `${fs}px ${o.F}`; ctx.textBaseline = 'middle'; ctx.direction = rtl ? 'rtl' : 'ltr';
    items.forEach(it => { if (ctx.measureText(it.label).width > colW - sw - 12) { if (i % cols) { yy += row; i = 0; } it.__span = true; }
      const col = it.__span ? 0 : i % cols; const cx = rtl ? x + w - col * (colW + gap) - sw : x + col * (colW + gap); const cy = yy + row / 2;
      if (!o.dry) {
        if (it.sw) { ctx.globalAlpha = it.alpha || 1; ctx.fillStyle = it.sw; ctx.fillRect(cx, cy - sh / 2, sw, sh); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(41,16,12,.35)'; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy - sh / 2 + 0.5, sw - 1, sh - 1); }
        if (it.hatch) { ctx.save(); ctx.strokeStyle = it.hatch; ctx.lineWidth = 1.4; ctx.strokeRect(cx, cy - sh / 2, sw, sh); ctx.beginPath(); ctx.rect(cx, cy - sh / 2, sw, sh); ctx.clip(); ctx.beginPath(); for (let q = -sh; q < sw + sh; q += 6) { ctx.moveTo(cx + q, cy + sh / 2); ctx.lineTo(cx + q + sh, cy - sh / 2); } ctx.stroke(); ctx.restore(); }
        if (it.line) { ctx.strokeStyle = it.line; ctx.lineWidth = Math.max(1.5, (it.w || 1.3) * fs / 14); ctx.setLineDash(it.dash ? [fs * 0.45, fs * 0.28] : []); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + sw, cy); ctx.stroke(); ctx.setLineDash([]); }
        if (it.edge) { ctx.strokeStyle = it.edge; ctx.lineWidth = Math.max(2, fs * 0.22); ctx.lineJoin = 'round'; ctx.strokeRect(cx + 1, cy - sh / 2 + 1, sw - 2, sh - 2); }
        if (it.lattice) { ctx.save(); ctx.beginPath(); ctx.rect(cx, cy - sh / 2, sw, sh); ctx.clip(); ctx.strokeStyle = it.lattice; ctx.lineWidth = Math.max(1, fs * 0.07); ctx.beginPath(); const st = Math.max(4, fs * 0.42); for (let q = -sh; q < sw + sh; q += st) { ctx.moveTo(cx + q, cy + sh / 2); ctx.lineTo(cx + q + sh, cy - sh / 2); ctx.moveTo(cx + q, cy - sh / 2); ctx.lineTo(cx + q + sh, cy + sh / 2); } ctx.stroke(); ctx.restore(); ctx.strokeStyle = it.lattice; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy - sh / 2 + 0.5, sw - 1, sh - 1); }
        if (it.peak) { ctx.beginPath(); ctx.arc(cx + sw / 2, cy, sh * 0.55, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = c.centreLine; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(cx + sw / 2, cy, 2, 0, Math.PI * 2); ctx.fillStyle = c.centreLine; ctx.fill(); }
        if (it.mk === 'market') { ctx.fillStyle = c.market; ctx.fillRect(cx + sw / 2 - sh * 0.45, cy - sh * 0.45, sh * 0.9, sh * 0.9); }
        if (it.mk === 'cafe') { ctx.beginPath(); ctx.arc(cx + sw / 2, cy, sh * 0.22, 0, Math.PI * 2); ctx.fillStyle = c.cafe; ctx.fill(); }
        if (it.mk === 'play') { ctx.beginPath(); ctx.moveTo(cx + sw / 2, cy - sh * 0.45); ctx.lineTo(cx + sw / 2 + sh * 0.42, cy + sh * 0.35); ctx.lineTo(cx + sw / 2 - sh * 0.42, cy + sh * 0.35); ctx.closePath(); ctx.fillStyle = c.play; ctx.fill(); }
        if (it.mk === 'civic') { ctx.beginPath(); ctx.arc(cx + sw / 2, cy, sh * 0.4, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = c.civic; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.fillStyle = PAL().ink; ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText(it.label, rtl ? cx - 10 : cx + sw + 10, cy);
      }
      if (it.__span) { delete it.__span; yy += row; i = 0; return; } i++; if (i % cols === 0) yy += row; });
    ctx.restore(); return (i % cols === 0 ? yy : yy + row);
  }
  function stackBar(ctx, parts, x, y, w, o) { // parts: [{v, col, label}] — shares of a whole, same colours as the map
    const h = Math.round(o.size * 1.4); const tot = parts.reduce((a, p) => a + p.v, 0) || 1; let cx = 0; ctx.save(); ctx.direction = 'ltr';
    parts.forEach(p => { const pw = p.v / tot * w; if (pw <= 0) return; const px = o.rtl ? x + w - cx - pw : x + cx; if (!o.dry) { ctx.fillStyle = p.col; ctx.fillRect(px, y, pw, h); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, y + 0.5, pw - 1, h - 1);
      const lbl = nf(p.v / tot * 100, 0) + ' %'; ctx.font = `600 ${Math.round(o.size * 0.82)}px ${o.F}`; if (ctx.measureText(lbl).width + 6 < pw) { const rgb = PAL().rgb(p.col); ctx.fillStyle = (0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]) < 140 ? '#FFFFFF' : PAL().ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lbl, px + pw / 2, y + h / 2); } }
      cx += pw; });
    ctx.restore(); return y + h + Math.round(o.size * 0.4);
  }

  // ---------- page content per topic (indicators, chart, sentence, sources) ----------
  function content(k) {
    const d = DATA; const e = E(); const c = C(); const out = { ind: [], chart: null, chartTitle: '', sentence: '', src: [] };
    if (k === 'density') { const s = d.density.stats;
      out.ind = [[t('x13.i.popFrame'), iso(nf(s.pop_frame)) + ' ' + t('x13.modelled')], [t('x13.i.peak'), iso(nf(s.peak)) + ' ' + t('x13.perKm2')], [t('x13.i.median'), iso(nf(s.median_inhabited)) + ' ' + t('x13.perKm2')], [t('x13.i.dense'), iso(nf(s.share_dense, 1) + ' %')], [t('x13.i.check'), iso((s.diff_pct > 0 ? '+' : '') + nf(s.diff_pct, 1) + ' %') + ' ' + t('x13.i.checkVs', { p: iso(nf(s.pop_muni_padron_2020)) })]];
      out.chartTitle = t('x13.c.density'); out.chart = s.share_by_class.map((v, i) => ({ v, col: c.density[i] }));
      out.sentence = t('x13.s.density', { peak: iso(nf(s.peak)), dense: iso(nf(s.share_dense, 0) + ' %'), pop: iso(nf(Math.round(s.pop_frame / 1000) * 1000)) });
      out.src = [t('x13.src.density'), t('x13.lim.density', { d: iso((s.diff_pct > 0 ? '+' : '') + nf(s.diff_pct, 1) + ' %') })]; }
    if (k === 'morphology') { const s = d.morphology.stats;
      out.ind = [[t('x13.i.cov'), iso(nf(s.coverage_frame_pct, 1) + ' %')], [t('x13.i.covMuni'), iso(nf(s.coverage_muni_pct, 1) + ' %')], [t('x13.i.gaps'), iso(nf(s.gap_cells) + ' × 1 ha = ' + nf(s.gap_area_km2, 2) + ' km²')], [t('x13.i.agree'), iso(nf(s.agree_pct, 0) + ' %')]];
      out.sentence = t('x13.s.morphology', { cov: iso(nf(s.coverage_frame_pct, 1) + ' %'), gaps: iso(nf(s.gap_area_km2, 2) + ' km²') });
      out.src = [t('x13.src.morphology'), t('x13.lim.morphology')];
      if (artOn(k)) { const A = PAL().ex13art; const Gd = root.GA.ex13art.prepare(d); const sh = Gd.shares; const p = (v) => iso(nf(v, 0) + ' %');
        out.ind = out.ind.filter(r => r[0] !== t('x13.i.gaps') && r[0] !== t('x13.i.agree'));
        out.ind.push([t('x20.i.cells'), t('x20.i.cellsV', { s: iso(nf(Gd.cells[1])), m: iso(nf(Gd.cells[2])), c: iso(nf(Gd.cells[3])) })]);
        out.chartTitle = t('x20.c.shares'); out.chart = [{ v: sh[0], col: A.sparse }, { v: sh[1], col: A.medium }, { v: sh[2], col: A.compact }];
        out.chartKey = [[t('x20.k.sparse'), A.sparse], [t('x20.k.medium'), A.medium], [t('x20.k.compact'), A.compact]];
        out.sentence = t('x20.s.morphology', { c: p(sh[2]), m: p(sh[1]), s: p(sh[0]) });
        out.src = [t('x13.src.morphology'), t('x20.lim.art', { g: iso(nf(s.gap_area_km2, 2) + ' km²') })]; } }
    if (k === 'centre') { const s = d.centre.stats; const P = d.centre.peaks; const p1 = P[0], p2 = P[1]; const bc = s.by_cat;
      out.ind = [[t('x13.i.places'), iso(nf(s.in_frame)) + ' — ' + t('x13.i.byCat', { r: iso(nf(bc.retail)), f: iso(nf(bc.food)), s: iso(nf(bc.service)), m: iso(nf(bc.market)) })],
        [t('x13.i.c1'), t('x13.i.c1v', { v: iso(nf(p1.v)), n: iso(nf(p1.n300)) })], [t('x13.i.c2'), t('x13.i.c2v', { r: iso(nf(p2.rel) + ' %'), d: iso(nf(p2.dist_hist_m / 1000, 1) + ' km') })], [t('x13.i.dup'), iso(nf(s.duplicates))], [t('x13.i.ov'), iso('r = ' + nf(s.overture_corr, 2))]];
      out.chartTitle = t('x13.c.centre'); out.chart = [{ v: bc.retail, col: c.centre[4] }, { v: bc.food, col: c.centre[3] }, { v: bc.service, col: c.centre[2] }, { v: bc.market, col: c.centre[1] }];
      out.chartKey = [[t('x13.cat.retail'), c.centre[4]], [t('x13.cat.food'), c.centre[3]], [t('x13.cat.service'), c.centre[2]], [t('x13.cat.market'), c.centre[1]]];
      out.sentence = t('x13.s.centre', { n1: iso(nf(p1.n300)), r2: iso(nf(p2.rel) + ' %'), d2: iso(nf(p2.dist_hist_m / 1000, 1) + ' km') });
      out.src = [t('x13.src.centre', { date: iso(String(d.centre.source.date).slice(0, 10)), n: iso(nf(s.in_frame)), dup: iso(nf(s.duplicates)) }), t('x13.lim.centre', { r: iso(nf(s.overture_corr, 2)) })]; }
    if (k === 'climate') { const s = d.climate.stats;
      out.ind = [[t('x13.i.lstMed'), iso(`${nf(s.median_frame, 1)} °C`) + ' ' + t('x13.i.lstRange', { a: iso(`${nf(s.p5, 1)}–${nf(s.p95, 1)} °C`) })], [t('x13.i.lstDense'), iso(`${nf(s.dense_built, 1)} °C`)], [t('x13.i.lstVeg'), iso(`${nf(s.vegetated, 1)} °C`)], [t('x13.i.lstBare'), iso(`${nf(s.bare, 1)} °C`)], [t('x13.i.lstGap'), iso(`${nf(s.gap_dense_veg, 1)} °C`)], [t('x13.i.scenes'), iso(`${s.scenes} (${s.first} → ${s.last})`)]];
      const L = d.climate.lst.flat().filter(v => v != null); const br = d.climate.breaks; out.chartTitle = t('x13.c.climate'); out.chart = c.lst.map((col, i) => ({ v: L.filter(v => br.filter(b => v >= b).length === i).length, col }));
      out.sentence = t('x13.s.climate', { dense: iso(`${nf(s.dense_built, 1)} °C`), veg: iso(`${nf(s.vegetated, 1)} °C`), gap: iso(`${nf(s.gap_dense_veg, 1)} °C`), bare: iso(`${nf(s.bare, 1)} °C`) });
      out.src = [t('x13.src.climate', { n: iso(String(s.scenes)) }), t('x13.lim.climate', { min: iso(String(s.min_obs)) })]; }
    if (k === 'human') { const s = d.human.stats;
      out.ind = [[t('x13.i.reach'), iso(nf(s.reach_pct, 1) + ' %')], [t('x13.i.hAreas'), t('x13.i.hAreasV', { q: iso(nf(s.squares)), p: iso(nf(s.parks)), m: iso(nf(s.markets)) })], [t('x13.i.hPts'), t('x13.i.hPtsV', { c: iso(nf(s.cafes)), p: iso(nf(s.playgrounds)), l: iso(nf(s.civic)) })], [t('x13.i.far'), iso(nf(s.far_cells)) + ' × 1 ha']];
      out.chartTitle = t('x13.c.human'); out.chart = [{ v: s.reach_pct, col: c.park }, { v: 100 - s.reach_pct, col: c.far }];
      out.sentence = t('x13.s.human', { reach: iso(nf(s.reach_pct, 0) + ' %') });
      out.src = [t('x13.src.human', { date: iso(String(d.human.source.date).slice(0, 10)) }), t('x13.lim.human')]; }
    if ((e.maps[k] || {}).finding && e.maps[k].finding.trim()) out.sentence = e.maps[k].finding.trim();
    return out;
  }

  // ---------- A3 portrait page ----------
  const DPI_FULL = 200, PAGE = [297, 420], MAP_MM = 250;
  function pageGeom(dpi) { const k = dpi / 25.4; return { W: Math.round(PAGE[0] * k), H: Math.round(PAGE[1] * k), M: Math.round(23.5 * k), mapS: Math.round(MAP_MM * k), k }; }
  async function pageCanvas(pk, dpi, opts) {
    await load(); dpi = dpi || DPI_FULL; const G = pageGeom(dpi); const cv = document.createElement('canvas'); cv.width = G.W; cv.height = G.H; const ctx = cv.getContext('2d');
    const rtl = I.dir() === 'rtl'; const F = PG.font(); const pt = (v) => Math.round(v / 72 * dpi); const x = G.M, w = G.W - 2 * G.M; const o = (size, ex) => Object.assign({ size: pt(size), F, rtl }, ex || {});
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, G.W, G.H); ctx.fillStyle = C().accent; ctx.fillRect(0, 0, G.W, Math.round(4 * G.k));
    // header: exercise line, number + title, question
    let y = para(ctx, t('x13.kicker'), x, Math.round(9 * G.k), w, o(8.5, { color: PAL().ink3, weight: 600 }));
    const num = pk === 'identity' ? '00' : String(TOPICS.indexOf(pk) + 1).padStart(2, '0'); const title = pk === 'identity' ? t('x13.idTitle') : t('e13.t.' + pk);
    ctx.save(); ctx.font = `700 ${pt(30)}px ${F}`; ctx.direction = 'ltr'; ctx.fillStyle = C().accent; ctx.textAlign = rtl ? 'right' : 'left'; ctx.textBaseline = 'alphabetic'; const nw = ctx.measureText(num).width; ctx.fillText(num, rtl ? x + w : x, y + pt(30)); ctx.restore();
    para(ctx, title, rtl ? x : x + nw + pt(12), y + pt(6), w - nw - pt(12), o(22, { weight: 700 }));
    y = para(ctx, pk === 'identity' ? t('x13.q.identity') : t('x13.q.' + pk), x, y + pt(36), w, o(10, { color: PAL().ink2 }));
    const my = Math.max(y + pt(6), Math.round(48 * G.k)); const mx = Math.round((G.W - G.mapS) / 2);
    if (pk === 'identity') return identity(ctx, G, mx, my, o, pt), cv;
    drawMap(pk, ctx, mx, my, G.mapS, opts);
    // under the map: legend · indicators + chart · sentence · sources
    const bx = mx, bw = G.mapS; let yy = my + G.mapS + pt(10);
    yy = legend(ctx, legendItems(pk), bx, yy, bw, o(8.6, { cols: pk === 'human' || pk === 'centre' || artOn(pk) ? 2 : pk === 'climate' ? 4 : 3 })) + pt(4);
    const cn = content(pk); const half = (bw - pt(14)) / 2;
    const indX = rtl ? bx + half + pt(14) : bx, chX = rtl ? bx : bx + half + pt(14); let iy = yy, cy = yy;
    cn.ind.forEach(r => { iy = para(ctx, `${r[0]}: ${r[1]}`, indX, iy, half, o(8.8, { weight: 600, lh: 1.3 })); });
    if (cn.chart) { cy = para(ctx, cn.chartTitle, chX, cy, half, o(8.2, { color: PAL().ink2 })); cy = stackBar(ctx, cn.chart, chX, cy + pt(2), half, o(9)); if (cn.chartKey) cy = legend(ctx, cn.chartKey.map(([l, col]) => ({ sw: col, label: l })), chX, cy, half, o(7.8, { cols: 2 })); }
    yy = Math.max(iy, cy) + pt(5);
    ctx.fillStyle = C().accent; ctx.fillRect(rtl ? bx + bw - pt(3) : bx, yy, pt(3), pt(11) * 2); // sentence marker
    yy = para(ctx, cn.sentence, rtl ? bx : bx + pt(10), yy, bw - pt(10), o(10.5, { weight: 600, lh: 1.32 })) + pt(5);
    cn.src.forEach(sline => { yy = para(ctx, sline, bx, yy, bw, o(7.4, { color: PAL().ink3, lh: 1.3 })); });
    footer(ctx, G, o, pt);
    cv.__layout = { mapX: mx, mapY: my, mapS: G.mapS, bottom: yy, H: G.H, footerY: G.H - pt(16) };
    return cv;
  }
  function footer(ctx, G, o, pt) { const F = FR(); para(ctx, t('x13.footer', { x0: iso(nf(F.x0)), x1: iso(nf(F.x1)), y0: iso(nf(F.y0)), y1: iso(nf(F.y1)), s: iso('1:' + nf(F.scale)), d: iso(new Date().toISOString().slice(0, 10)) }), G.M, G.H - pt(22), G.W - 2 * G.M, o(7, { color: PAL().ink3 })); }
  function identity(ctx, G, mx, my, o, pt) {
    const e = E(); const S0 = FR().stats; const F = FR(); const rtl = I.dir() === 'rtl'; const c = C();
    // locator: 16 × 16 km around the frame — buildings, municipality, the shared 10 × 10 km frame
    const L = { x0: F.x0 - 3000, y0: F.y0 - 3000, x1: F.x1 + 3000, y1: F.y1 + 3000 }; const S = G.mapS; const mpp = (L.x1 - L.x0) / S; const s = S / 1000;
    const X = (u) => mx + (u - L.x0) / mpp, Y = (v) => my + (L.y1 - v) / mpp; const g = DATA.fgm;
    ctx.save(); ctx.beginPath(); ctx.rect(mx, my, S, S); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(mx, my, S, S);
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = S; const tc = tmp.getContext('2d'); tc.fillStyle = '#FFFFFF'; tc.fillRect(0, 0, S, S); tc.imageSmoothingQuality = 'high';
    tc.drawImage(DATA.fgImg, (L.x0 - g.ox) / g.px_m, (g.oy - L.y1) / g.px_m, (L.x1 - L.x0) / g.px_m, (L.y1 - L.y0) / g.px_m, 0, 0, S, S); tc.globalCompositeOperation = 'lighten'; tc.fillStyle = PAL().grey; tc.fillRect(0, 0, S, S); ctx.drawImage(tmp, mx, my);
    // no building data north of the extract (y > 4,123,000): said, not left blank
    if (L.y1 > g.oy) { const hy = Y(g.oy); ctx.fillStyle = PAL().gray1; ctx.fillRect(mx, my, S, hy - my); para(ctx, t('x13.noBld'), mx + 12 * s, my + 4 * s, S - 24 * s, o(7.5, { color: PAL().ink3 })); }
    ctx.beginPath(); DATA.muni.forEach(r => r.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.strokeStyle = PAL().ink; ctx.lineWidth = 2 * s; ctx.setLineDash([8 * s, 5 * s]); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = c.accent; ctx.lineWidth = 4 * s; ctx.strokeRect(X(F.x0), Y(F.y1), (F.x1 - F.x0) / mpp, (F.y1 - F.y0) / mpp); ctx.restore();
    ctx.strokeStyle = c.frame; ctx.lineWidth = 1.6 * s; ctx.strokeRect(mx + 0.5, my + 0.5, S - 1, S - 1);
    PG.northArrow(ctx, mx + S - 34 * s, my + 22 * s, 1.25 * s); const km = 2000 / mpp, bx = mx + 18 * s, by = my + S - 30 * s; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(bx - 8 * s, by - 24 * s, km + 70 * s, 42 * s); ctx.fillStyle = PAL().ink; ctx.fillRect(bx, by, km / 2, 6 * s); ctx.strokeStyle = PAL().ink; ctx.strokeRect(bx, by, km, 6 * s); ctx.font = `${Math.round(13 * s)}px ${PG.font()}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.fillText('0', bx, by - 6 * s); ctx.fillText('2 km', bx + km, by - 6 * s);
    const bw = S, x = mx; let y = my + S + pt(8);
    y = legend(ctx, [{ line: c.accent, w: 3, label: t('x13.lg.frame') }, { line: PAL().ink, dash: true, w: 1.6, label: t('x13.lg.muniUnit') }, { sw: PAL().grey, label: t('x13.lg.bldGrey') }], x, y, bw, o(8.6, { cols: 3 })) + pt(4);
    // names, country, students
    y = para(ctx, `${t('x13.names')}: ${t('x13.lang.he')} גרנדה · ${t('x13.lang.en')} ${iso('Granada')} · ${t('x13.lang.es')} ${iso('Granada')}`, x, y, bw, o(11, { weight: 700 }));
    y = para(ctx, `${t('x13.country')}: ${t('x13.spain')} (España)`, x, y, bw, o(10, { weight: 600 }));
    y = para(ctx, `${t('e13.students')}: ${(e.students || '').trim() || t('x13.noStudents')}`, x, y, bw, o(10, { weight: 600, color: (e.students || '').trim() ? PAL().ink : PAL().red }));
    // statistics with source and year, and the unit
    const half = (bw - pt(14)) / 2; const lx = rtl ? x + half + pt(14) : x, rx = rtl ? x : x + half + pt(14); let ly = y + pt(4), ry = y + pt(4);
    ly = para(ctx, `${t('x13.pop')}: ${iso(nf(S0.pop))} (${t('x13.popDate', { y: iso(S0.pop_year) })})`, lx, ly, half, o(9.5, { weight: 700 }));
    ly = para(ctx, `${t('x13.area')}: ${iso(nf(S0.area_km2, 2) + ' km²')}`, lx, ly, half, o(9.5, { weight: 700 }));
    ly = para(ctx, `${t('x13.avgDen')}: ${iso(nf(S0.density) + ' /km²')}`, lx, ly, half, o(9.5, { weight: 700 }));
    ly = para(ctx, t('x13.unitStmt', { code: iso(S0.ine_code) }), lx, ly + pt(2), half, o(8, { color: PAL().ink2 }));
    ry = para(ctx, t('x13.frameWhy', { c: iso(nf(F.why.coverage_pct, 1) + ' %'), s: iso('1:' + nf(F.scale)), s15: iso('1:' + nf(F.why.alt15.scale)) }), rx, ry, half, o(8, { color: PAL().ink2 }));
    ry = para(ctx, t('x13.inFrame', { p: iso(nf(Math.round(DATA.density.stats.pop_frame / 1000) * 1000)) }), rx, ry + pt(2), half, o(8, { color: PAL().ink2 }));
    y = Math.max(ly, ry) + pt(5);
    ctx.fillStyle = c.accent; ctx.fillRect(rtl ? x + bw - pt(3) : x, y, pt(3), pt(11) * 3);
    y = para(ctx, (e.synthesis || '').trim() || synthesis(), rtl ? x : x + pt(10), y, bw - pt(10), o(10, { weight: 600, lh: 1.32 })) + pt(4);
    y = para(ctx, t('x13.src.identity', { y: iso(S0.pop_year), a: iso(nf(S0.area_osm_km2, 2) + ' km²') }), x, y, bw, o(7.4, { color: PAL().ink3, lh: 1.3 }));
    footer(ctx, G, o, pt);
    ctx.canvas.__layout = { mapX: mx, mapY: my, mapS: S, bottom: y, H: G.H, footerY: G.H - pt(16), locator: true };
  }
  function synthesis() { const d = DATA; return t('x13.synth', { dense: iso(nf(d.density.stats.share_dense, 0) + ' %'), gap: iso(nf(d.climate.stats.gap_dense_veg, 1) + ' °C'), reach: iso(nf(d.human.stats.reach_pct, 0) + ' %'), r2: iso(nf(d.centre.peaks[1].rel) + ' %') }); }

  // ---------- GIS downloads (processed layers, EPSG:4326 GeoJSON + README) ----------
  function gisFiles() {
    const inv = (x, y) => { const ll = PJ.EPSG25830.inverse([x, y]); return [+ll[0].toFixed(6), +ll[1].toFixed(6)]; }; const F = FR(); const d = DATA; const out = []; const fc = (features) => JSON.stringify({ type: 'FeatureCollection', features });
    const sq = (x0, y0, x1, y1) => [[inv(x0, y0), inv(x1, y0), inv(x1, y1), inv(x0, y1), inv(x0, y0)]];
    out.push({ name: 'ex13_frame_10km.geojson', text: fc([{ type: 'Feature', properties: { name: 'Exercise 1.3 shared map frame', epsg25830: [F.x0, F.y0, F.x1, F.y1], km: F.km, scale: '1:' + F.scale, map_mm: F.map_mm }, geometry: { type: 'Polygon', coordinates: sq(F.x0, F.y0, F.x1, F.y1) } }]) });
    const cx = d.density.corners.x, cy = d.density.corners.y; const den = [];
    d.density.pop.forEach((row, r) => row.forEach((p, q) => { if (p == null) return; den.push({ type: 'Feature', properties: { residents_2020: p, residents_per_km2: Math.round(p * 100), class: d.density.breaks.filter(b => p * 100 > b).length, modelled: true },
      geometry: { type: 'Polygon', coordinates: [[inv(cx[r][q], cy[r][q]), inv(cx[r][q + 1], cy[r][q + 1]), inv(cx[r + 1][q + 1], cy[r + 1][q + 1]), inv(cx[r + 1][q], cy[r + 1][q]), inv(cx[r][q], cy[r][q])]] } }); }));
    out.push({ name: '01_density_ghspop2020_100m.geojson', text: fc(den) });
    const m = d.morphology.grid; out.push({ name: '02_morphology_probable_gaps_100m.geojson', text: fc(d.morphology.gaps.map(([r, q]) => ({ type: 'Feature', properties: { rule: d.morphology.check.rule }, geometry: { type: 'Polygon', coordinates: sq(m.x0 + q * m.cell, m.y1 - (r + 1) * m.cell, m.x0 + (q + 1) * m.cell, m.y1 - r * m.cell) } }))) });
    out.push({ name: '03_centre_places_osm.geojson', text: fc(d.centre.points.map(p => ({ type: 'Feature', properties: { category: p[2], name: p[3], osm: p[4] }, geometry: { type: 'Point', coordinates: inv(p[0], p[1]) } }))) });
    const g = d.centre.grid; const kc = []; d.centre.z.forEach((row, j) => row.forEach((v, i) => { if (v < d.centre.breaks[0]) return; kc.push({ type: 'Feature', properties: { places_per_km2: v }, geometry: { type: 'Polygon', coordinates: sq(g.x0 + i * g.cell, g.y1 - (j + 1) * g.cell, g.x0 + (i + 1) * g.cell, g.y1 - j * g.cell) } }); }));
    out.push({ name: '03_centre_kde_r300m_50m.geojson', text: fc(kc) });
    out.push({ name: '03_centre_peaks.geojson', text: fc(d.centre.peaks.map(p => ({ type: 'Feature', properties: { label: 'C' + p.rank, places_per_km2: p.v, places_within_300m: p.n300, share_of_C1_pct: p.rel, inside_1932_city: p.in_hist, note: 'analytical result, not an official centre' }, geometry: { type: 'Point', coordinates: inv(p.x, p.y) } }))) });
    const rr = (gm) => gm.type === 'Polygon' ? { type: 'Polygon', coordinates: gm.coordinates.map(r => r.map(p => inv(p[0], p[1]))) } : gm.type === 'MultiPolygon' ? { type: 'MultiPolygon', coordinates: gm.coordinates.map(pl => pl.map(r => r.map(p => inv(p[0], p[1])))) } : gm.type === 'Point' ? { type: 'Point', coordinates: inv(gm.coordinates[0], gm.coordinates[1]) } : null;
    out.push({ name: '03_centre_historic_city_1932.geojson', text: fc([{ type: 'Feature', properties: { name: d.centre.hist.name, note: d.centre.hist.note }, geometry: rr(d.centre.hist.geometry) }]) });
    const cg = d.climate.grid; const lc = []; d.climate.lst.forEach((row, j) => row.forEach((v, i) => { lc.push({ type: 'Feature', properties: { lst_summer_median_C: v, ndvi_summer_median: d.climate.ndvi[j][i] }, geometry: { type: 'Polygon', coordinates: sq(cg.x0 + i * cg.cell, cg.y1 - (j + 1) * cg.cell, cg.x0 + (i + 1) * cg.cell, cg.y1 - j * cg.cell) } }); }));
    out.push({ name: '04_climate_lst_summer_90m.geojson', text: fc(lc) });
    const hf = []; Object.entries(d.human.areas).forEach(([kind, list]) => list.forEach(a => hf.push({ type: 'Feature', properties: { kind, name: a.n }, geometry: { type: 'Polygon', coordinates: a.p.map(r => r.map(p => inv(p[0], p[1]))) } })));
    Object.entries(d.human.points).forEach(([kind, list]) => list.forEach(p => hf.push({ type: 'Feature', properties: { kind, name: p[2] }, geometry: { type: 'Point', coordinates: inv(p[0], p[1]) } })));
    out.push({ name: '05_human_meeting_places_osm.geojson', text: fc(hf) });
    out.push({ name: '05_human_residents_beyond_300m.geojson', text: fc(d.human.far.map(([r, q]) => ({ type: 'Feature', properties: { residents_2020: d.density.pop[r][q], modelled: true }, geometry: { type: 'Polygon', coordinates: [[inv(cx[r][q], cy[r][q]), inv(cx[r][q + 1], cy[r][q + 1]), inv(cx[r + 1][q + 1], cy[r + 1][q + 1]), inv(cx[r + 1][q], cy[r + 1][q]), inv(cx[r][q], cy[r][q])]] } }))) });
    const A = FR().audit; out.push({ name: 'README_sources_and_licences.txt', text: ['Granada — Exercise 1.3 city identity card: processed layers (EPSG:4326 GeoJSON; computed in EPSG:25830)', `Shared frame: EPSG:25830 x ${F.x0}–${F.x1}, y ${F.y0}–${F.y1} (10 × 10 km), maps printed at 250 mm = 1:${F.scale}`, '',
      'topic | source | reference date | units | resolution | coverage | limitations | kind'].concat(A.map(r => r.join(' | '))).concat(['', 'Licences: GHSL (JRC) CC BY 4.0 · OpenStreetMap © contributors, ODbL 1.0 (share-alike: derived databases stay ODbL) · Landsat (USGS) public domain.',
      'OSM building footprints are in the atlas GIS download; figure-ground rasters are derived from them.', 'Built with tools/build_ex13.py — https://github.com/ahmdklany6-ai/granada-atlas']).join('\n') });
    return out;
  }

  // ---------- page (#/ex13) ----------
  const fileOf = (k) => `granada_1-3_${k === 'identity' ? '0_identity' : (TOPICS.indexOf(k) + 1) + '_' + k}`;
  async function render(body) {
    const e = E(); body.innerHTML = `<div class="loading"><span class="spin"></span>${t('ws.computing')}</div>`;
    try { await load(); } catch (er) { body.innerHTML = `<p class="error">${esc(t('x13.loadFail'))} ${esc(er.message)}</p>`; return; }
    const SUB = root.GA.submission; SUB.norm(e); const F = FR();
    body.innerHTML = `<div class="e13 x13"><aside class="e13-form"><p class="fine">${t('x13.lead')}</p><div id="e13-sub" class="sub-box"></div>
      <section class="x13-frame"><h3>${t('x13.frameH')}</h3><p class="fine">${t('x13.frameWhy', { c: iso(nf(F.why.coverage_pct, 1) + ' %'), s: iso('1:' + nf(F.scale)), s15: iso('1:' + nf(F.why.alt15.scale)) })}</p><p class="fine" dir="ltr">EPSG:25830 · x ${nf(F.x0)}–${nf(F.x1)} · y ${nf(F.y0)}–${nf(F.y1)} · 250 mm · 1:${nf(F.scale)}</p></section>
      <label class="name"><span>${t('e13.students')}</span><input dir="auto" data-e="students" value="${esc(e.students || '')}" placeholder="${esc(t('x13.studentsPh'))}"></label>
      ${TOPICS.map((k, i) => `<fieldset class="e13-t"><legend>${String(i + 1).padStart(2, '0')} · ${t('e13.t.' + k)}</legend><p class="fine">${t('x13.auto')}</p><p class="fine x13-auto">${esc(content(k).sentence)}</p><textarea dir="auto" rows="2" data-em="${k}" data-f="finding" placeholder="${esc(t('x13.ownPh'))}">${esc(e.maps[k].finding)}</textarea>${k === 'morphology' ? styleHTML() : ''}</fieldset>`).join('')}
      <label class="name"><span>${t('x13.synthH')}</span><textarea dir="auto" rows="4" data-e="synthesis" placeholder="${esc(synthesis())}">${esc(e.synthesis || '')}</textarea></label>
      <div class="actions"><button class="btn btn-primary" id="e13-pdf">${t('e13.pdf')}</button><button class="btn" id="e13-zip">${t('e13.pngs')}</button><button class="btn" id="e13-gis">${t('x13.gis')}</button></div>
      <p class="fine">${t('x13.miroNote')}</p>
      <details class="x13-audit"><summary>${t('x13.auditH')}</summary>${auditHTML()}</details></aside>
      <div class="e13-prev x13-prev"><p class="fine">${t('x13.prevHint')}</p>${PAGES.map(k => `<figure data-e13="${k}"><button type="button" class="e13-img" data-e13open="${k}" aria-label="${esc(t('v7.openLarge'))}: ${esc(k === 'identity' ? t('x13.idTitle') : t('e13.t.' + k))}"><span class="spin"></span></button><figcaption><b>${k === 'identity' ? '00 · ' + t('x13.idTitle') : String(TOPICS.indexOf(k) + 1).padStart(2, '0') + ' · ' + t('e13.t.' + k)}</b> <button class="btn btn-tiny" data-e13open="${k}">⤢ ${t('v7.openLarge')}</button> <button class="btn btn-tiny" data-e13png="${k}">PNG</button></figcaption></figure>`).join('')}</div></div>`;
    const morphFig = body.querySelector('[data-e13="morphology"]'); if (morphFig) morphFig.insertAdjacentHTML('beforeend', '<div class="x20-player" data-x20player hidden></div>');
    const subBox = body.querySelector('#e13-sub');
    const renderSub = () => { const miss = []; if (!(e.students || '').trim()) miss.push({ label: t('v7.m.students'), go: '[data-e="students"]' });
      subBox.innerHTML = SUB.strip(e, { tools: true, done: 7 - miss.length, total: 7, missing: miss, miroField: true }); };
    renderSub(); SUB.bind(subBox, () => e, () => store.save(), renderSub);
    const prev = async (k, opts) => { const fig = body.querySelector(`[data-e13="${k}"] .e13-img`); try { const c = await pageCanvas(k, 72, opts); c.style.width = '100%'; c.style.height = 'auto'; fig.innerHTML = ''; fig.appendChild(c); } catch (er) { fig.innerHTML = `<p class="error">${esc(er.message)}</p>`; } };
    for (const k of PAGES) await prev(k);
    // 5.22 layer player (artistic morphology): each layer alone (the others faint), then built up one after another, then all
    let playT = null, playing = false, focus = null; const player = body.querySelector('[data-x20player]');
    const stopPlay = () => { playing = false; clearTimeout(playT); playT = null; };
    const show = (o) => { focus = o && o.focus != null ? o.focus : null; paintPlayer(o); return prev('morphology', o); };
    function paintPlayer(o) { if (!player) return; const on = artOn('morphology'); player.hidden = !on; if (!on) { stopPlay(); return; }
      const items = legendItems('morphology').filter(i => i.layer != null); const cur = o && o.focus != null ? o.focus : o && o.upTo ? o.upTo - 1 : -1;
      player.innerHTML = `<button type="button" class="btn btn-small btn-primary" data-x20play>${playing ? '❚❚ ' + t('x20.stop') : '▶ ' + t('x20.play')}</button><button type="button" class="btn btn-small" data-x20all>${t('x20.all')}</button>`
        + `<span class="x20-chips">${items.map(i => `<button type="button" class="x20-chip${i.layer === cur ? ' on' : ''}" data-x20layer="${i.layer}" aria-pressed="${i.layer === cur}">${esc(i.label)}</button>`).join('')}</span>`; }
    function play() { stopPlay(); playing = true; const nL = root.GA.ex13art.KEYS.length; const seq = [];
      for (let i = 0; i < nL; i++) seq.push([{ focus: i }, 1600]); for (let i = 1; i <= nL; i++) seq.push([{ upTo: i }, 900]); seq.push([null, 2800]);
      let i = 0; const step = async () => { if (!playing || !body.isConnected) return stopPlay(); const [o, ms] = seq[i++ % seq.length]; await show(o); if (playing) playT = setTimeout(step, ms); }; step(); }
    paintPlayer(null);
    if (player) player.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; ev.stopPropagation();
      if (b.dataset.x20play != null) { if (playing) { stopPlay(); show(null); } else play(); return; }
      stopPlay(); if (b.dataset.x20all != null) return show(null); const L = +b.dataset.x20layer; show(focus === L ? null : { focus: L }); };
    const openSheet = async (k) => { const c = await pageCanvas(k); const url = URL.createObjectURL(await PG.toBlob(c)); const title = k === 'identity' ? t('x13.idTitle') : t('e13.t.' + k);
      const sh = root.GA.viewer.image({ title, subtitle: t('e13.title'), src: url, notGIS: true, kind: 'vw-sheet', tools: `<button class="btn btn-small" data-vtool="png">PNG</button><button class="btn btn-small" data-vtool="pdf">PDF</button>${artOn(k) ? `<button class="btn btn-small" data-vtool="layers">${t('x20.layersZip')}</button>` : ''}`,
        onTool: async (tool, btn) => { btn.disabled = true; try { if (tool === 'layers') { PG.download(await layersZip(k), fileOf(k) + '_layers_png.zip'); SUB.exported(e, 'layers:' + k); store.save(); renderSub(); return; } if (tool === 'png') PG.download(await PG.toBlob(c), fileOf(k) + '.png'); else PG.download(new Blob([root.GA.pdf.build([{ canvas: c, paper: 'A3P' }], { title: 'Granada 1.3 - ' + title })], { type: 'application/pdf' }), fileOf(k) + '.pdf'); SUB.exported(e, tool + ':' + k); store.save(); renderSub(); } finally { btn.disabled = false; } } });
      const c0 = sh.close; sh.close = (q) => { URL.revokeObjectURL(url); c0(q); }; };
    let tm; const later = (k) => { clearTimeout(tm); tm = setTimeout(() => { prev(k); if (k !== 'identity') { const a = body.querySelector(`[data-em="${k}"]`); if (a) a.closest('fieldset').querySelector('.x13-auto').textContent = content(k).sentence; } }, 400); };
    body.onchange = (ev) => { const el = ev.target; if (el.name !== 'x20-style') return; stopPlay(); e.maps.morphology.style = el.value === 'art' ? 'art' : 'arch'; store.save();
      const a = body.querySelector('[data-em="morphology"]'); if (a) a.closest('fieldset').querySelector('.x13-auto').textContent = content('morphology').sentence; paintPlayer(null); prev('morphology'); };
    body.oninput = (ev) => { const el = ev.target; if (el.name === 'x20-style') return; if (el.dataset.e) { e[el.dataset.e] = el.value; store.save(); renderSub(); later('identity'); } if (el.dataset.em) { e.maps[el.dataset.em][el.dataset.f] = el.value; store.save(); later(el.dataset.em); } };
    body.onclick = async (ev) => { const b = ev.target.closest('button'); if (!b || !body.contains(b)) return; if (!(b.dataset.e13open || b.dataset.e13png || ['e13-pdf', 'e13-zip', 'e13-gis'].includes(b.id))) return; b.disabled = true; try {
      if (b.dataset.e13open) { await openSheet(b.dataset.e13open); return; }
      if (b.dataset.e13png) { const c = await pageCanvas(b.dataset.e13png); PG.download(await PG.toBlob(c), fileOf(b.dataset.e13png) + '.png'); SUB.exported(e, 'png:' + b.dataset.e13png); store.save(); renderSub(); }
      if (b.id === 'e13-pdf') { const pages = []; for (const k of PAGES) pages.push({ canvas: await pageCanvas(k), paper: 'A3P' }); const bytes = root.GA.pdf.build(pages, { title: 'Granada - City identity card (Exercise 1.3)' }); PG.download(new Blob([bytes], { type: 'application/pdf' }), 'granada_1-3_identity_card.pdf'); root.GA.lastEx13 = { pages: pages.length, scale: F.scale, layouts: pages.map(p => p.canvas.__layout) }; SUB.exported(e, 'pdf'); store.save(); renderSub(); }
      if (b.id === 'e13-zip') { const files = []; for (const k of PAGES) { const c = await pageCanvas(k); const bl = await PG.toBlob(c); files.push({ name: fileOf(k) + '.png', data: new Uint8Array(await bl.arrayBuffer()) }); } PG.download(new Blob([root.GA.zip.zip(files, new Date())], { type: 'application/zip' }), 'granada_1-3_pages_png.zip'); SUB.exported(e, 'png-zip'); store.save(); renderSub(); }
      if (b.id === 'e13-gis') { const enc = new TextEncoder(); const files = gisFiles().map(f => ({ name: 'granada_1-3_gis/' + f.name, data: enc.encode(f.text) })); PG.download(new Blob([root.GA.zip.zip(files, new Date())], { type: 'application/zip' }), 'granada_1-3_gis_layers.zip'); SUB.exported(e, 'gis'); store.save(); renderSub(); }
    } catch (er) { (root.GA.toast || alert)(t('x13.exportFail') + ' ' + er.message); console.error(er); } finally { b.disabled = false; } };
  }
  function styleHTML() { const art = artOn('morphology');
    return `<div class="x20-style" role="radiogroup" aria-label="${esc(t('x20.style'))}"><span>${t('x20.style')}</span><label><input type="radio" name="x20-style" value="arch"${art ? '' : ' checked'}> ${t('x20.arch')}</label><label><input type="radio" name="x20-style" value="art"${art ? ' checked' : ''}> ${t('x20.art')}</label></div><p class="fine">${t('x20.styleHint')}</p>`; }
  async function layersZip(k) { // one full-resolution page per layer (that layer full, the others faint), then the whole map
    const keys = root.GA.ex13art.KEYS; const files = []; const add = async (o, name) => { const c = await pageCanvas(k, DPI_FULL, o); const bl = await PG.toBlob(c); files.push({ name, data: new Uint8Array(await bl.arrayBuffer()) }); };
    for (let i = 0; i < keys.length; i++) await add({ focus: i }, `${fileOf(k)}_${i + 1}_${keys[i]}.png`);
    await add(null, `${fileOf(k)}_${keys.length + 1}_all.png`);
    return new Blob([root.GA.zip.zip(files, new Date())], { type: 'application/zip' }); }
  function auditHTML() {
    const d = DATA; const v = { d: iso((d.density.stats.diff_pct > 0 ? '+' : '') + nf(d.density.stats.diff_pct, 1) + ' %'), g: iso(nf(d.morphology.stats.gap_cells)), a: iso(nf(d.morphology.stats.agree_pct, 0) + ' %'), r: iso('r = ' + nf(d.centre.stats.overture_corr, 2)), n: iso(String(d.climate.stats.scenes)) };
    const rows = TOPICS.concat(['identity']).map(k => `<tr><th scope="row">${k === 'identity' ? t('x13.idTitle') : t('e13.t.' + k)}</th><td>${t('x13.a.src.' + k)}</td><td>${t('x13.a.date.' + k, v)}</td><td>${t('x13.a.unit.' + k)}</td><td>${t('x13.a.res.' + k)}</td><td>${t('x13.a.kind.' + k)}</td><td>${t('x13.a.lim.' + k, v)}</td></tr>`).join('');
    return `<div class="tbl-wrap"><table class="x13-tbl"><thead><tr><th></th><th>${t('x13.a.h.src')}</th><th>${t('x13.a.h.date')}</th><th>${t('x13.a.h.unit')}</th><th>${t('x13.a.h.res')}</th><th>${t('x13.a.h.kind')}</th><th>${t('x13.a.h.lim')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  PG.register('ex13', { plate: () => t('e13.plate'), title: () => t('e13.title'), render });
  root.GA.ex13 = { pageCanvas, drawMap, legendItems, content, gisFiles, load, layersZip, artOn, TOPICS, PAGES, POP, E, get data() { return DATA; } };
})(window);
