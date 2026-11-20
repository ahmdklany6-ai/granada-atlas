"""Exercise 2.1 / 2.2 — the policy map series (owner, 20 Nov 2026), English only:
  1 who_decides    A2 landscape · 1:15,000 · the POTAUG zone (art. 4.27–4.30), the RD 118/2019 ceiling, the five municipalities, metro
  2 who_holds      A2 landscape · 1:10,000 · the base split by municipality (Catastro outlines), km² and share
  3 over_time      A2 landscape · five dates, 1:35,000 each (1931, 2000, 2019, 2024, 2026) and the timeline
  4 three_futures  A1 landscape · 1:15,000 · base stays closed / base stays, edges open / base dismantled (POTAUG 4.27), with numbers
Needs data/ex21/policy.json (tools/build_ex21_policy.py), data/ex21/town_edges.json, exports/ex21_time/hist/*.jpg.
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/policy.py <out folder> [which,…]   (env DPI, default 250)"""
import sys, time, base64, subprocess, os
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; WHICH = sys.argv[2].split(',') if len(sys.argv) > 2 else ['who_decides', 'who_holds', 'over_time', 'three_futures']
DPI = float(os.environ.get('DPI', 250)); PORT = 8861; V3.PORT = PORT; V3.V2.PORT = PORT
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([which, DPI, IZB]) => {
  await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); await GA.ex21.readyTownEdges();
  const PO = await (await fetch('/data/ex21/policy.json?r=' + Date.now())).json(); const D0 = GA.ex21.data, TD = GA.ex21.time, E = GA.ex21.CITY, pal = GA.palette, F = GA.pages.font();
  const D = DPI / 25.4, mm = (v) => v * D, t = (k, v) => GA.i18n.t(k, v), TC = pal.ex21t, CX = 442830, CY = 4109470;
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });
  const sheet = (wmm, hmm) => { const c = document.createElement('canvas'); c.width = Math.round(mm(wmm)); c.height = Math.round(mm(hmm)); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return [c, x]; };
  const txt = (x, s, px, py, sz, wt, col, al, maxW) => { x.font = `${wt || 500} ${Math.round(mm(sz))}px ${F}`; x.fillStyle = col || pal.ink; x.textAlign = al || 'left'; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(s, px, py, maxW); };
  const para = (x, s, px, py, wmm, sz, wt, col, lh) => { x.font = `${wt || 400} ${Math.round(mm(sz))}px ${F}`; x.fillStyle = col || pal.ink; x.textAlign = 'left'; x.direction = 'ltr'; x.textBaseline = 'alphabetic';
    let line = '', y = py; s.split(' ').forEach(w => { const tt = line ? line + ' ' + w : w; if (x.measureText(tt).width > mm(wmm) && line) { x.fillText(line, px, y); y += mm(lh || sz * 1.45); line = w; } else line = tt; }); if (line) { x.fillText(line, px, y); y += mm(lh || sz * 1.45); } return y; };
  const glowTxt = (x, s, px, py, sz, wt, col, al) => { x.save(); x.font = `${wt || 700} ${Math.round(mm(sz))}px ${F}`; x.textAlign = al || 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = mm(sz * 0.32); x.strokeText(s, px, py); x.fillStyle = col; x.fillText(s, px, py); x.restore(); };
  // a window on the city frame at 1:den, centred on (cx, cy) and kept inside the data; returns the projection
  const win = (bx, by, bw, bh, den, cx, cy) => { const full = 6400000 / den * D, s = full / 6400; const hwM = bw / s / 2, hhM = bh / s / 2;
    const c0 = Math.min(Math.max(cx, E.x0 + hwM), E.x0 + 6400 - hwM), c1 = Math.min(Math.max(cy, E.y1 - 5600 + hhM), E.y1 - hhM);
    const ox = bx + bw / 2 - (c0 - E.x0) * s, oy = by + bh / 2 - (E.y1 - c1) * s; return { full, fullH: full * 5600 / 6400, ox, oy, s, X: (u) => ox + (u - E.x0) * s, Y: (v) => oy + (E.y1 - v) * s, view: [bx, by, bx + bw, by + bh] }; };
  const path = (x, P, rs, close) => { x.beginPath(); rs.forEach(r => { r.forEach((q, i) => i ? x.lineTo(P.X(q[0]), P.Y(q[1])) : x.moveTo(P.X(q[0]), P.Y(q[1]))); if (close) x.closePath(); }); };
  const pieces = (x, P, rings, cb) => rings.forEach(pg => { path(x, P, pg, true); cb(); });
  const base = D0.edge.find(f => f.p.k === 'base'); const baseRings = base.g;
  const clipV = (x, V) => { x.save(); x.beginPath(); x.rect(V[0], V[1], V[2] - V[0], V[3] - V[1]); x.clip(); };
  const hatch = (x, P, rings, col, gap, lw) => { x.save(); x.beginPath(); rings.forEach(r => { r.forEach((q, i) => i ? x.lineTo(P.X(q[0]), P.Y(q[1])) : x.moveTo(P.X(q[0]), P.Y(q[1]))); x.closePath(); }); x.clip('evenodd');
    x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); const V = P.view; for (let q = -(V[3] - V[1]); q < (V[2] - V[0]); q += gap) { x.moveTo(V[0] + q, V[3]); x.lineTo(V[0] + q + (V[3] - V[1]), V[1]); } x.stroke(); x.restore(); };
  const muniLines = (x, P, w, labels, sz) => Object.entries(PO.muni).forEach(([nm, rings]) => { pieces(x, P, rings, () => { x.strokeStyle = '#FFFFFF'; x.lineWidth = w * 2.2; x.setLineDash([]); x.stroke(); x.strokeStyle = TC[nm]; x.lineWidth = w; x.setLineDash([w * 5, w * 2.5]); x.stroke(); x.setLineDash([]); }); });
  const metro = (x, P, k) => { x.lineCap = 'round'; x.strokeStyle = pal.ex21.metro; x.lineWidth = 5 * k; x.beginPath(); D0.l1.lines.forEach(l => l.forEach((q, i) => i ? x.lineTo(P.X(q[0]), P.Y(q[1])) : x.moveTo(P.X(q[0]), P.Y(q[1])))); x.stroke();
    D0.metro.forEach(f => { if (f.p.k !== 'track') return; x.strokeStyle = pal.ex21.metro; x.lineWidth = 5 * k; path(x, P, f.g); x.stroke(); x.strokeStyle = '#FFFFFF'; x.lineWidth = 1.8 * k; x.setLineDash([6 * k, 6 * k]); path(x, P, f.g); x.stroke(); x.setLineDash([]); }); };
  const keyRow = (x, items, px, py, wmm, sz) => { let cx = px; items.forEach(it => { const sw = mm(9), sh = mm(3.6); x.save();
      if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(cx, py - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = it.stroke || pal.grey; x.lineWidth = mm(0.2); x.strokeRect(cx, py - sh / 2, sw, sh); }
      if (it.hatch) { x.strokeStyle = it.hatch; x.lineWidth = mm(0.25); x.strokeRect(cx, py - sh / 2, sw, sh); x.beginPath(); for (let q = 0; q < 9; q += 1.5) { x.moveTo(cx + mm(q), py + sh / 2); x.lineTo(cx + mm(Math.min(9, q + 3.6)), py - sh / 2); } x.stroke(); }
      if (it.line) { x.strokeStyle = it.line; x.lineWidth = mm(it.w || 0.6); x.setLineDash(it.dash ? [mm(1.6), mm(0.8)] : []); x.beginPath(); x.moveTo(cx, py); x.lineTo(cx + sw, py); x.stroke(); x.setLineDash([]); if (it.rail) { x.strokeStyle = '#fff'; x.lineWidth = mm(0.3); x.setLineDash([mm(1), mm(1)]); x.beginPath(); x.moveTo(cx, py); x.lineTo(cx + sw, py); x.stroke(); x.setLineDash([]); } }
      x.restore(); txt(x, it.label, cx + sw + mm(2.5), py + mm(sz * 0.35), sz, 500, pal.ink2); x.font = `500 ${Math.round(mm(sz))}px ${F}`; cx += sw + mm(2.5) + x.measureText(it.label).width + mm(8); }); };
  const frame = (x, V) => { x.strokeStyle = pal.ink; x.lineWidth = mm(0.3); x.strokeRect(V[0], V[1], V[2] - V[0], V[3] - V[1]); };
  const boxNote = (x, px, py, wmm, head, body, col, sz) => { const y0 = py; txt(x, head, px + mm(4), py + mm(sz * 1.6), sz * 1.05, 700, col || pal.ink3); const y1 = para(x, body, px + mm(4), py + mm(sz * 3.2), wmm - 8, sz, 400, pal.ink, sz * 1.45);
    x.strokeStyle = col || pal.line2; x.lineWidth = mm(0.35); x.beginPath(); x.moveTo(px, y0); x.lineTo(px, y1 - mm(sz * 0.6)); x.stroke(); return y1 + mm(4); };
  const heights = (x, P) => { const e = D0.ease.extent; x.save(); x.globalAlpha = 0.55; x.imageSmoothingEnabled = true; x.drawImage(D0.hImg, P.X(e[0]), P.Y(e[3]), (e[2] - e[0]) * P.s, (e[3] - e[1]) * P.s); x.restore(); };
  const townNames = (x, P, sz, list) => D0.edge.filter(f => f.p.k === 'town' && (!list || list.includes(f.p.nm))).forEach(f => glowTxt(x, f.p.nm.toUpperCase(), P.X(f.g[0]), P.Y(f.g[1]) - mm(sz), sz, 700, TC[f.p.nm] || pal.ink));
  const SRC = 'Sources: POTAUG, Decreto 244/1999 (BOJA 37, 28 Mar 2000), Normativa art. 4.25–4.30 · RD 118/2019 (BOE) · municipal outlines: D. G. del Catastro (INSPIRE) · base, streets, metro: OpenStreetMap contributors (ODbL) · population: INE · ceiling: Ministerio de Defensa, approximate.';
  const head = (x, W, title, sub) => { txt(x, title, mm(14), mm(20), 11, 600, pal.ink3); txt(x, sub, mm(14), mm(29), 4.4, 500, pal.ink3); x.strokeStyle = pal.line2; x.lineWidth = mm(0.25); x.beginPath(); x.moveTo(mm(14), mm(34)); x.lineTo(W - mm(14), mm(34)); x.stroke(); };
  const foot = (x, W, H, s) => para(x, s, mm(14), H - mm(9), W / D - 28, 2.6, 400, pal.ink3, 3.4);
  const scaleBar = (x, P, V, metres, labels) => { const k = mm(0.32); GA.ex21.scaleBar(x, V[0] + mm(8), V[3] - mm(8), metres * P.s, k, (sz, wt) => `${wt || 600} ${Math.round(sz * k)}px ${F}`, labels); };
  const north = (x, V) => GA.pages.northArrow(x, V[2] - mm(9), V[1] + mm(6), mm(0.33));

  const haloTxt = (x, s0, px, py, sz, wt, col) => { x.save(); x.font = `${wt || 700} ${Math.round(mm(sz))}px ${F}`; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.direction = 'ltr'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = mm(sz * 0.3); x.strokeText(s0, px, py); x.fillStyle = col; x.fillText(s0, px, py); x.restore(); };
  const centroid = (rings) => { let A = 0, a = 0, b = 0; rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const cr = r[j][0] * r[i][1] - r[i][0] * r[j][1]; A += cr; a += (r[j][0] + r[i][0]) * cr; b += (r[j][1] + r[i][1]) * cr; } }); return [a / 3 / A, b / 3 / A]; };
  // the open-land cells (100 m; data/ex21/edge_land.png) in ONE given tone
  const tint = (img, col) => { const c2 = document.createElement('canvas'); c2.width = img.naturalWidth; c2.height = img.naturalHeight; const g = c2.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c2.width, c2.height); return c2; };
  const cells = (x, P, cv, al) => { x.save(); x.imageSmoothingEnabled = false; x.globalAlpha = al; x.drawImage(cv, P.ox, P.oy, P.full, P.fullH); x.restore(); };
  const deadEnds = (x, P, r, col) => D0.edge.filter(f => f.p.k === 'deadend').forEach(f => { const q = Array.isArray(f.g[0]) ? f.g[0][0] : f.g; x.beginPath(); x.arc(P.X(q[0]), P.Y(q[1]), r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = col; x.lineWidth = r * 0.45; x.stroke(); x.beginPath(); x.moveTo(P.X(q[0]) - r * 0.55, P.Y(q[1])); x.lineTo(P.X(q[0]) + r * 0.55, P.Y(q[1])); x.stroke(); });
  const CTX = (P, k, extra) => Object.assign({ t, k, view: P.view, noScale: true, noNorth: true, noMuni: true, townCols: TC }, extra || {});

  // ======================= 1 · WHO DECIDES =======================
  if (which === 'who_decides') { const [c, x] = sheet(594, 420); const W = c.width, H = c.height;
    head(x, W, 'WHO DECIDES ABOUT THE BASE LAND', 'Armilla Air Base · three public documents, three different futures · 1:15,000');
    const bw = mm(400), bh = mm(350), bx = mm(14), by = mm(42); const P = win(bx, by, bw, bh, 15000, CX, CY + 300);
    GA.ex21.drawCity(x, P.ox, P.oy, P.full, P.fullH, CTX(P, 2.0 * DPI / 200, { only: 'none', noBaseLabel: true, over: () => { heights(x, P); muniLines(x, P, mm(0.7));
      path(x, P, baseRings, true); x.fillStyle = pal.ex21.base; x.fill('evenodd'); hatch(x, P, baseRings, 'rgba(201,139,128,.5)', mm(2.4), mm(0.3)); path(x, P, baseRings, true); x.strokeStyle = pal.red; x.lineWidth = mm(0.9); x.stroke(); metro(x, P, mm(0.22)); } }));
    const bc = centroid(baseRings); const tx0 = P.X(bc[0]), ty0 = P.Y(bc[1]);
    txt(x, 'POTAUG 2000 · ART. 4.27', tx0, ty0 - mm(9), 5.4, 700, '#FFFFFF', 'center'); txt(x, 'zona de ordenación concertada “Aeródromo de Armilla”', tx0, ty0 - mm(2.5), 3.4, 600, '#FFFFFF', 'center');
    txt(x, 'to be dismantled as a Defence installation', tx0, ty0 + mm(3.5), 3.3, 500, '#FFFFFF', 'center'); txt(x, '→ housing, facilities and services', tx0, ty0 + mm(8.5), 3.3, 500, '#FFFFFF', 'center'); txt(x, '2026: still an active air base (RD 118/2019)', tx0, ty0 + mm(15), 3.3, 600, pal.rose, 'center');
    frame(x, P.view); north(x, P.view); scaleBar(x, P, P.view, 1000);
    let y = mm(48); const rx = bx + bw + mm(10), rw = (W - rx) / D - 14;
    y = boxNote(x, rx, y, rw, '1 · REGIONAL PLAN — POTAUG (Junta de Andalucía, 2000)', 'Art. 4.27: the aerodrome zone “has as its aim its dismantling as a Defence installation and the development of a residential, facilities and services area” that becomes “the central core of the conurbation” of Alhendín, Armilla, Churriana de la Vega, Las Gabias and Ogíjares. Art. 4.28: one Special Plan for the whole zone. Art. 4.30: until then, no building at all except what National Defence needs. No dwelling numbers, no date.', pal.red, 3.3);
    y = boxNote(x, rx, y, rw, 'ORIGINAL TEXT · art. 4.27.1', '«La zona de ordenación concertada Aeródromo de Armilla tiene por finalidad su desmantelamiento como instalación para la Defensa y el desarrollo de un área residencial, dotacional y de servicios sobre los suelos actualmente afectados al mismo.»', pal.red, 3.1);
    y = boxNote(x, rx, y, rw, '2 · THE STATE — RD 118/2019 (Ministerio de Defensa)', 'Nineteen years later the State renewed the base’s aeronautical easements: height limits around it, from about 2 m to 75 m above the ground depending on the place (tinted on the map, approximate). The base stays active.', pal.base.wine, 3.3);
    y = boxNote(x, rx, y, rw, '3 · THE PROVINCE AND THE TOWNS (2024)', 'April 2024: the State studied a temporary migrant centre on base land; the neighbouring towns refused, Alhendín citing its plan (no building allowed there). Days later the Diputación de Granada asked the State for the Colonia Dávila plot (105,000 m²) for a metropolitan park, part of a sports circuit around the whole perimeter linking the five towns. The plot’s position and the State’s answer were not found, so neither is drawn.', pal.olive, 3.3);
    y = boxNote(x, rx, y, rw, 'THE CONFLICT', 'The regional plan has wanted the base to become the centre of the five towns since 2000; the State keeps it; the towns grew 15 % in ten years around it. One piece of land, five municipalities, three levels of government.', pal.ink3, 3.5);
    keyRow(x, [{ sw: pal.ex21.base, hatch: pal.rose, label: 'Base = POTAUG concerted zone' }, { line: TC['Las Gabias'], dash: true, w: 0.7, label: 'Municipal boundary (Catastro), by town' }, { sw: pal.ex21.height['15-30'], alpha: 0.55, label: 'Height limits RD 118/2019 (darker = lower)' }, { line: pal.ex21.metro, w: 1.2, label: 'Metro L1' }, { line: pal.ex21.metro, w: 1.2, rail: true, label: 'Extension (in construction)' }], bx, by + bh + mm(8), 400, 3);
    foot(x, W, H, SRC + ' Press, April 2024: Ahora Granada, Granada Digital, COPE.'); return c.toDataURL('image/png'); }

  // ======================= 1b · WHO DECIDES — analysis style test (black / grey / white, red for ONE thing: the POTAUG zone) =======================
  if (which === 'who_decides_iz') { const [c, x] = sheet(594, 420); const W = c.width, H = c.height; const INK = pal.ink, GR = pal.ink3;
    const sm = (s, px, py, sz, wt, col, al) => txt(x, s, px, py, sz, wt || 500, col || INK, al);
    const plus = (px, py, r) => { x.strokeStyle = INK; x.lineWidth = mm(0.25); x.beginPath(); x.moveTo(px - r, py); x.lineTo(px + r, py); x.moveTo(px, py - r); x.lineTo(px, py + r); x.stroke(); };
    const spaced = (s, px, py, sz, wt, col, sp) => { x.save(); x.font = `${wt || 600} ${Math.round(mm(sz))}px ${F}`; x.fillStyle = col || INK; x.textAlign = 'left'; x.direction = 'ltr'; let cx = px; [...s].forEach(ch => { x.fillText(ch, cx, py); cx += x.measureText(ch).width + mm(sp || sz * 0.18); }); x.restore(); return cx; };
    const bx = mm(30), by = mm(46), bw = mm(350), bh = mm(326); const P = win(bx, by, bw, bh, 15000, CX - 150, CY + 250);
    // 1 base: today's aerial photo (PNOA 2022) as a grey photocopy, veiled
    if (IZB === 'site') { // the website's own site map (buildings, streets, fields) drawn in grey, with a light photocopy grain
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const x2 = c2.getContext('2d'); x2.fillStyle = '#fff'; x2.fillRect(0, 0, W, H);
      GA.ex21.drawCity(x2, P.ox, P.oy, P.full, P.fullH, CTX(P, 2.0 * DPI / 200, { only: 'none', noBaseLabel: true, noTowns: true }));
      clipV(x, P.view); x.filter = 'grayscale(1) contrast(1.08)'; x.drawImage(c2, 0, 0); x.filter = 'none';
      const g = document.createElement('canvas'); g.width = 512; g.height = 512; const gx = g.getContext('2d'); const im = gx.createImageData(512, 512); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 14; } gx.putImageData(im, 0, 0);
      x.fillStyle = x.createPattern(g, 'repeat'); x.fillRect(P.view[0], P.view[1], bw, bh); }
    else { const xer = await load('/exports/ex21_time/hist/' + (IZB || 'pnoa2022') + '_xerox.jpg?r=' + Date.now()); clipV(x, P.view); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(xer, P.ox, P.oy, P.full, P.fullH);
    x.fillStyle = 'rgba(255,255,255,.66)'; x.fillRect(P.view[0], P.view[1], bw, bh); }
    // 2 today's built-up edge of each town (Catastro), white with a black line: the present laid over 1931
    if (IZB === 'mtn50') Object.values(GA.ex21.townEdges.edges.pnoa2022).forEach(rs => (rs || []).forEach(pg => { path(x, P, pg, true); x.fillStyle = 'rgba(255,255,255,.9)'; x.fill('evenodd'); x.fillStyle = 'rgba(41,16,12,.10)'; x.fill('evenodd'); x.strokeStyle = INK; x.lineWidth = mm(0.3); x.stroke(); }));
    // 3 municipal boundaries: thin black dash-dot
    const MW = IZB === 'site' ? 0.5 : 0.22; Object.values(PO.muni).forEach(rings => pieces(x, P, rings, () => { if (IZB === 'site') { x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(MW * 3); x.stroke(); } x.strokeStyle = INK; x.lineWidth = mm(MW); x.setLineDash([mm(3.2), mm(1.1), mm(0.5), mm(1.1)]); x.stroke(); x.setLineDash([]); }));
    // 4 metro: L1 solid, extension dotted
    x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = mm(0.55); x.beginPath(); D0.l1.lines.forEach(l => l.forEach((q, i) => i ? x.lineTo(P.X(q[0]), P.Y(q[1])) : x.moveTo(P.X(q[0]), P.Y(q[1])))); x.stroke();
    D0.metro.forEach(f => { if (f.p.k !== 'track') return; x.lineWidth = mm(0.55); x.setLineDash([mm(0.1), mm(1.1)]); path(x, P, f.g); x.stroke(); x.setLineDash([]); });
    // 5 THE ONE RED THING: the POTAUG concerted zone (hatched), then the fence as a black-and-white dashed line
    path(x, P, baseRings, true); x.fillStyle = IZB === 'site' ? '#FFFFFF' : 'rgba(255,255,255,.55)'; x.fill('evenodd'); hatch(x, P, baseRings, pal.red, mm(1.6), mm(0.3));
    path(x, P, baseRings, true); x.lineCap = 'butt'; x.strokeStyle = INK; x.lineWidth = mm(1.1); x.stroke(); x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(0.6); x.setLineDash([mm(2), mm(2)]); x.stroke(); x.setLineDash([]);
    // town names: small, black, spaced
    if (IZB === 'site') { // the five municipalities named inside their own boundary, as close to the base as the lines allow
      const inR = (rings, u, v) => { let c0 = false; rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a1 = r[i], b1 = r[j]; if ((a1[1] > v) !== (b1[1] > v) && u < (b1[0] - a1[0]) * (v - a1[1]) / (b1[1] - a1[1]) + a1[0]) c0 = !c0; } }); return c0; };
      const bcm = centroid(baseRings); const used = [];
      Object.entries(PO.muni).forEach(([nm, mr]) => { const rings = mr.flat(); const dens = (rs) => rs.flatMap(r => r.flatMap((q, i) => { const q2 = r[(i + 1) % r.length]; const n = Math.max(1, Math.ceil(Math.hypot(q2[0] - q[0], q2[1] - q[1]) / 15)); return Array.from({ length: n }, (_, j) => [q[0] + (q2[0] - q[0]) * j / n, q[1] + (q2[1] - q[1]) * j / n]); })); const verts = dens(Object.values(PO.muni).flat(2).length ? Object.values(PO.muni).flat() : rings).concat(dens(baseRings)); let best = null, bd = 1e18;
        for (let gy = by + mm(14); gy < by + bh - mm(14); gy += mm(3)) for (let gxp = bx + mm(30); gxp < bx + bw - mm(30); gxp += mm(3)) { const u = E.x0 + (gxp - P.ox) / P.s, v = E.y1 - (gy - P.oy) / P.s;
          if (!inR(rings, u, v) || inR(baseRings, u, v)) continue; const clr = mm(16) / P.s; if (verts.some(q => Math.abs(q[0] - u) < clr * 1.6 && Math.abs(q[1] - v) < clr * 0.55)) continue; 
          if (used.some(([a1, b1]) => Math.abs(a1 - gxp) < mm(50) && Math.abs(b1 - gy) < mm(10))) continue; const d = (u - bcm[0]) ** 2 + (v - bcm[1]) ** 2; if (d < bd) { bd = d; best = [gxp, gy]; } }
        if (!best) return; used.push(best); const s0 = nm.toUpperCase(); x.font = `700 ${Math.round(mm(3.4))}px ${F}`; let w0 = 0; [...s0].forEach(ch => w0 += x.measureText(ch).width + mm(0.7)); const px = best[0] - w0 / 2, py = best[1];
        x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(px - mm(1.5), py - mm(3.6), w0 + mm(2.4), mm(7.6)); spaced(s0, px, py, 3.4, 700, INK, 0.7); sm('municipality', best[0], py + mm(3.4), 2.3, 500, GR, 'center'); }); }
    else D0.edge.filter(f => f.p.k === 'town').forEach(f => { const s0 = f.p.nm.toUpperCase(); x.font = `600 ${Math.round(mm(3))}px ${F}`; let w0 = 0; [...s0].forEach(ch => w0 += x.measureText(ch).width + mm(0.55)); const px = P.X(f.g[0]) - w0 / 2, py = Math.min(P.Y(f.g[1]) - mm(5), by + bh - mm(6));
      x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(px - mm(1.2), py - mm(3.2), w0 + mm(2), mm(4.4)); spaced(s0, px, py, 3, 600, INK, 0.55); });
    const bc = centroid(baseRings); const zx = P.X(bc[0]), zy = P.Y(bc[1]);
    x.fillStyle = '#FFFFFF'; x.fillRect(zx - mm(30), zy - mm(6.5), mm(60), mm(10.5)); sm('POTAUG 2000 · ART. 4.27', zx, zy - mm(1.6), 3.3, 700, pal.red, 'center'); sm('“to be dismantled as a Defence installation”', zx, zy + mm(2.6), 2.6, 500, pal.red, 'center');
    x.restore(); x.strokeStyle = INK; x.lineWidth = mm(0.2); x.strokeRect(bx, by, bw, bh);
    // corner crosses around the map window
    [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].forEach(([u, v]) => plus(u, v, mm(3.5)));
    // scale + north, small, outside the window (bottom-left corner caption)
    const s1 = 1000 * P.s, sx = bx, sy = by + bh + mm(9); x.strokeStyle = INK; x.lineWidth = mm(0.3); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + s1, sy); [0, 0.5, 1].forEach(f => { x.moveTo(sx + s1 * f, sy - mm(1.4)); x.lineTo(sx + s1 * f, sy); }); x.stroke();
    x.fillStyle = INK; x.fillRect(sx, sy - mm(0.7), s1 / 2, mm(0.7)); sm('0', sx, sy + mm(4), 2.4, 500, GR, 'center'); sm('500', sx + s1 / 2, sy + mm(4), 2.4, 500, GR, 'center'); sm('1 km', sx + s1, sy + mm(4), 2.4, 500, GR, 'center');
    sm('1:15,000 at A2', sx + s1 + mm(8), sy + mm(0.2), 2.4, 600, INK); sm('N ↑', sx + s1 + mm(8), sy + mm(4.2), 2.4, 700, INK);
    // the three actors: curved leaders from the text column into the zone (schematic: who points at the land, not a route)
    const rx = bx + bw + mm(26), rw = (W - rx) / D - 22; let y = mm(56);
    const items = [['1', 'THE REGION', 'Junta de Andalucía · POTAUG 2000', 'Art. 4.27: dismantle it as a Defence installation; a residential, facilities and services area, the central core of the five towns. Art. 4.30: until one Special Plan exists, nothing may be built there except for Defence. No date, no number of dwellings.', pal.red, [], 0.22],
      ['2', 'THE STATE', 'Ministerio de Defensa · RD 118/2019', 'Nineteen years later the State renewed the base’s height limits, about 2 m to 75 m above the ground around it. The base stays active.', INK, [], 0.45],
      ['3', 'THE PROVINCE AND THE TOWNS', 'Diputación de Granada · five councils · 2024', 'A migrant centre on base land was refused; the Diputación asked for a 105,000 m² park (Colonia Dávila) and a sports circuit round the whole perimeter. The plot’s position and the State’s answer were not found, so neither is drawn.', INK, [mm(1.6), mm(1.2)], 0.68]];
    // anchor points on the fence: nearest outline vertex to a fraction of the base's bounding box
    let bb = [1e9, 1e9, -1e9, -1e9]; baseRings.forEach(r => r.forEach(q => { bb = [Math.min(bb[0], q[0]), Math.min(bb[1], q[1]), Math.max(bb[2], q[0]), Math.max(bb[3], q[1])]; }));
    const near = (fy) => { const ty = bb[3] - (bb[3] - bb[1]) * fy; let best = null; baseRings.forEach(r => r.forEach((q, i) => { const q2 = r[(i + 1) % r.length]; if ((q[1] - ty) * (q2[1] - ty) <= 0 && q[1] !== q2[1]) { const u = q[0] + (ty - q[1]) / (q2[1] - q[1]) * (q2[0] - q[0]); if (!best || u > best[0]) best = [u, ty]; } })); return [P.X(best[0]), P.Y(best[1])]; };
    items.forEach(([n, who, doc, body, col, dash, at]) => { const y0 = y; plus(rx - mm(6), y0 - mm(1.4), mm(1.6)); sm(n, rx, y0, 3, 700, col); spaced(who, rx + mm(6), y0, 3, 700, col, 0.45); y += mm(5.2); sm(doc, rx + mm(6), y, 2.7, 600, GR); y += mm(5.5); y = para(x, body, rx + mm(6), y, rw - 6, 2.75, 400, INK, 3.9) + mm(9);
      const [ax, ay] = near(at); const sx0 = rx - mm(10), sy0 = y0 - mm(1.4); x.save(); x.strokeStyle = col; x.lineWidth = mm(0.35); x.setLineDash(dash); x.beginPath(); x.moveTo(sx0, sy0); x.bezierCurveTo(sx0 - mm(55), sy0, ax + mm(60), ay, ax, ay); x.stroke(); x.setLineDash([]);
      x.beginPath(); x.arc(ax, ay, mm(1.1), 0, 7); x.fillStyle = col; x.fill(); x.beginPath(); x.arc(sx0, sy0, mm(0.7), 0, 7); x.fill(); x.restore(); });
    // the original words, in red (they are the red thing)
    sm('+ ORIGINAL TEXT · ART. 4.27.1', rx, y, 2.6, 700, pal.red); y += mm(5); y = para(x, '«La zona de ordenación concertada Aeródromo de Armilla tiene por finalidad su desmantelamiento como instalación para la Defensa y el desarrollo de un área residencial, dotacional y de servicios sobre los suelos actualmente afectados al mismo.»', rx, y, rw, 2.6, 400, pal.red, 3.7) + mm(9);
    sm('+ THE CONFLICT', rx, y, 2.6, 700, INK); y += mm(5); y = para(x, 'One piece of land, five municipalities, three levels of government. The region has wanted the base to become the centre of the five towns since 2000; the State keeps it; the towns grew 15 % in ten years around it.', rx, y, rw, 2.75, 400, INK, 3.9) + mm(11);
    // small key, lines only
    const kr = (draw, label) => { draw(rx, y - mm(1)); sm(label, rx + mm(14), y, 2.5, 500, INK); y += mm(5.4); };
    kr((u, v) => { x.save(); x.beginPath(); x.rect(u, v - mm(2), mm(10), mm(4)); x.clip(); x.strokeStyle = pal.red; x.lineWidth = mm(0.3); x.beginPath(); for (let q = -4; q < 14; q += 1.25) { x.moveTo(u + mm(q), v + mm(2)); x.lineTo(u + mm(q + 4), v - mm(2)); } x.stroke(); x.restore(); }, 'POTAUG concerted zone = today’s base (3.71 km²)');
    kr((u, v) => { x.strokeStyle = INK; x.lineWidth = mm(1.1); x.beginPath(); x.moveTo(u, v); x.lineTo(u + mm(10), v); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = mm(0.6); x.setLineDash([mm(2), mm(2)]); x.stroke(); x.setLineDash([]); }, 'Fence (OSM outline)');
    if (IZB === 'mtn50') kr((u, v) => { x.fillStyle = '#fff'; x.fillRect(u, v - mm(1.8), mm(10), mm(3.6)); x.strokeStyle = INK; x.lineWidth = mm(0.3); x.strokeRect(u, v - mm(1.8), mm(10), mm(3.6)); }, 'Built-up edge today (Catastro) over the 1931 map');
    kr((u, v) => { x.strokeStyle = INK; x.lineWidth = mm(IZB === 'site' ? 0.5 : 0.22); x.setLineDash([mm(3.2), mm(1.1), mm(0.5), mm(1.1)]); x.beginPath(); x.moveTo(u, v); x.lineTo(u + mm(10), v); x.stroke(); x.setLineDash([]); }, 'Boundary of the five municipalities (Catastro)');
    kr((u, v) => { x.strokeStyle = INK; x.lineWidth = mm(0.55); x.beginPath(); x.moveTo(u, v); x.lineTo(u + mm(4.5), v); x.stroke(); x.setLineDash([mm(0.1), mm(1.1)]); x.beginPath(); x.moveTo(u + mm(6), v); x.lineTo(u + mm(10), v); x.stroke(); x.setLineDash([]); }, 'Metro L1 · extension (in construction)');
    kr((u, v) => { x.strokeStyle = INK; x.lineWidth = mm(0.35); x.beginPath(); x.moveTo(u, v + mm(1.5)); x.bezierCurveTo(u + mm(4), v - mm(2), u + mm(6), v + mm(2), u + mm(10), v - mm(1)); x.stroke(); }, 'Who points at the land (schematic, not a route)');
    // title block: small, top-left, with the sheet number top-right
    spaced('WHO DECIDES ABOUT THE BASE LAND', bx, mm(24), 5.2, 700, INK, 0.9); sm('Armilla Air Base · three public documents, three futures for one piece of land', bx, mm(31), 2.9, 500, GR);
    plus(bx - mm(10), mm(22.5), mm(2)); sm('EX 2.2 · POLICY', W - mm(22), mm(24), 2.6, 700, INK, 'right'); sm('01 / 04', W - mm(22), mm(29), 2.6, 500, GR, 'right');
    para(x, '+ ' + SRC + (IZB === 'mtn50' ? ' Base map: IGN MTN50, sheet 1026, 1931 (first edition), as served, printed in grey with a photocopy texture.' : (IZB === 'site' ? ' Base: buildings D. G. del Catastro, streets and land OpenStreetMap (ODbL), printed in grey.' : ' Base: PNOA 2022 orthophoto (IGN, CC BY 4.0), printed in grey with a photocopy texture.')) + ' Press, April 2024: Ahora Granada, Granada Digital, COPE.', bx, H - mm(14), (W / D) - 52, 2.2, 400, GR, 3);
    return c.toDataURL('image/png'); }

  // ======================= 2 · WHO HOLDS A PIECE =======================
  if (which === 'who_holds') { const [c, x] = sheet(594, 420); const W = c.width, H = c.height;
    head(x, W, 'FIVE MUNICIPALITIES, ONE BASE', 'Which town holds which part of the 3.71 km² · 1:10,000 · municipal outlines from the Catastro');
    const bw = mm(380), bh = mm(350), bx = mm(14), by = mm(42); const P = win(bx, by, bw, bh, 10000, CX - 250, CY - 200);
    GA.ex21.drawCity(x, P.ox, P.oy, P.full, P.fullH, CTX(P, 2.6 * DPI / 200, { only: 'none', noBaseLabel: true, over: () => { path(x, P, baseRings, true); x.fillStyle = '#FFFFFF'; x.fill('evenodd');
      Object.entries(PO.base_pieces).forEach(([nm, rings]) => pieces(x, P, rings, () => { x.globalAlpha = 0.8; x.fillStyle = TC[nm]; x.fill('evenodd'); x.globalAlpha = 1; x.strokeStyle = '#fff'; x.lineWidth = mm(0.5); x.stroke(); }));
      muniLines(x, P, mm(0.8)); path(x, P, baseRings, true); x.strokeStyle = pal.ink; x.lineWidth = mm(0.8); x.stroke(); } }));
    clipV(x, P.view);
    Object.entries(PO.base_pieces).forEach(([nm, rings]) => { const big0 = rings.slice().sort((p, q) => q[0].length - p[0].length)[0]; const cc = centroid([big0[0]]); const km = PO.base_split_km2[nm]; const big = km > 0.3;
      glowTxt(x, nm.toUpperCase(), P.X(cc[0]), P.Y(cc[1]) - mm(big ? 4 : 2.5), big ? 4.8 : 2.8, 700, pal.ink); glowTxt(x, `${km.toFixed(2)} km² · ${Math.round(km / PO.base_km2 * 100)} %` + (big ? ' of the base' : ''), P.X(cc[0]), P.Y(cc[1]) + mm(big ? 3 : 2), big ? 3.6 : 2.4, 600, pal.ink2); });
    x.restore(); frame(x, P.view); north(x, P.view); scaleBar(x, P, P.view, 500, [['0', 0], ['250', 0.5], ['500 m', 1]]);
    const rx = bx + bw + mm(12), rw = (W - rx) / D - 14; let y = mm(50); txt(x, 'Share of the base held by each municipality', rx, y, 4.4, 700, pal.ink3); y += mm(9);
    const order = Object.entries(PO.base_split_km2).sort((p, q) => q[1] - p[1]);
    order.forEach(([nm, km]) => { const bwm = mm(110) * km / 1.6; txt(x, nm, rx, y, 3.4, 600, pal.ink); x.fillStyle = TC[nm]; x.globalAlpha = 0.8; x.fillRect(rx, y + mm(2), bwm, mm(5.5)); x.globalAlpha = 1; txt(x, `${km.toFixed(2)} km² (${Math.round(km / PO.base_km2 * 100)} %)`, rx + bwm + mm(3), y + mm(6.3), 3.2, 500, pal.ink2); y += mm(14); });
    y += mm(8); txt(x, 'Share of each municipality’s own territory that the base takes', rx, y, 4.4, 700, pal.ink3); y += mm(9);
    order.map(([nm, km]) => [nm, km / PO.muni_km2[nm] * 100]).sort((p, q) => q[1] - p[1]).forEach(([nm, pc]) => { const bwm = mm(110) * pc / 18; txt(x, `${nm} (${PO.muni_km2[nm].toFixed(1)} km²)`, rx, y, 3.4, 600, pal.ink); x.fillStyle = TC[nm]; x.globalAlpha = 0.8; x.fillRect(rx, y + mm(2), bwm, mm(5.5)); x.globalAlpha = 1; txt(x, `${pc.toFixed(1)} %`, rx + bwm + mm(3), y + mm(6.3), 3.2, 500, pal.ink2); y += mm(14); });
    y += mm(8); y = boxNote(x, rx, y, rw, 'WHY IT MATTERS', 'No single town can plan the base. Las Gabias and Churriana hold 70 % of it; Armilla — whose name the base carries — holds 3 %, Ogíjares 2 %. For Churriana the base is about a sixth of its whole territory. That is why the POTAUG (art. 4.28) asks for ONE Special Plan for the whole zone and recommends a consortium or a shared company to run it (art. 4.29).', pal.ink3, 3.3);
    foot(x, W, H, 'Sources: municipal outlines — D. G. del Catastro, INSPIRE CadastralParcels (union of each municipality’s cadastral zoning), 20 Nov 2026; base — OpenStreetMap way 130984030 (3.71 km² measured; Wikipedia gives 369 ha); POTAUG art. 4.28–4.29. Areas measured in EPSG:25830 on those outlines.'); return c.toDataURL('image/png'); }

  // ======================= 3 · DECISIONS OVER TIME =======================
  if (which === 'over_time') { const [c, x] = sheet(594, 420); const W = c.width, H = c.height;
    head(x, W, 'TWENTY-FIVE YEARS OF “DISMANTLE IT”', 'The same frame, five dates · 1:35,000 · coloured lines: each town’s built-up edge at that date (Catastro, by recorded year of construction)');
    const pwm = 178, pw = mm(pwm), ph = Math.round(pw * 5600 / 6400), gx = mm(16), x0 = mm(14), y0 = mm(44), rowGap = mm(20);
    const hist = (n) => load('/exports/ex21_time/hist/' + n + '.jpg'); const k35 = 1.2 * DPI / 200;
    const cellsT = [['1931', 'A small aerodrome among fields (0.44 km²). IGN map, first edition.', 'photo', 'mtn50', null],
      ['2000', 'The POTAUG is approved: the base (hatched) is to be dismantled and become the centre of the five towns. Photo: SIGPAC 2001.', 'photo', 'sigpac2000', 'potaug'],
      ['2019', 'RD 118/2019: the State renews the height limits around the base (tint: darker = lower). The base stays.', 'map', null, 'rd'],
      ['2024', 'A migrant centre on base land is refused; the Diputación asks for a park and a circuit around the perimeter (dashed on the fence line: its real route is not published). Photo: PNOA 2022.', 'photo', 'pnoa2022', 'dip'],
      ['2026', 'Today: the metro extension passes the base’s north corner on its way to Las Gabias; the towns stand at the fence.', 'map', null, 'now']];
    for (let i = 0; i < cellsT.length; i++) { const [yr, cap, kind, ph0, mark] = cellsT[i]; const col = i % 3, row = Math.floor(i / 3); const px = x0 + col * (pw + gx), py = y0 + row * (ph + rowGap);
      const P = win(px, py, pw, ph, 35000, E.x0 + 3200, E.y1 - 2800);
      if (kind === 'photo') GA.ex21.drawTime(x, P.ox, P.oy, P.full, P.fullH, { t, k: k35, view: P.view, noScale: true, noNorth: true, only: 'photo', photo: await hist(ph0), edges: ph0 });
      else GA.ex21.drawCity(x, P.ox, P.oy, P.full, P.fullH, CTX(P, k35, { only: 'none', over: () => { if (mark === 'rd') { heights(x, P); path(x, P, baseRings, true); x.fillStyle = pal.ex21.base; x.fill('evenodd'); }
        if (mark === 'now') { metro(x, P, mm(0.16)); Object.entries(GA.ex21.townEdges.edges.pnoa2022).forEach(([nm, rs]) => (rs || []).forEach(pg => { path(x, P, pg, true); x.strokeStyle = '#fff'; x.lineWidth = mm(0.9); x.stroke(); x.strokeStyle = TC[nm]; x.lineWidth = mm(0.45); x.stroke(); })); } } }));
      clipV(x, P.view);
      if (mark === 'potaug') { hatch(x, P, baseRings, pal.red, mm(1.6), mm(0.35)); path(x, P, baseRings, true); x.strokeStyle = pal.red; x.lineWidth = mm(0.6); x.stroke(); }
      if (mark === 'dip') { path(x, P, baseRings, true); x.strokeStyle = '#fff'; x.lineWidth = mm(1.6); x.stroke(); x.strokeStyle = pal.olive; x.lineWidth = mm(0.8); x.setLineDash([mm(1.4), mm(0.9)]); x.stroke(); x.setLineDash([]); }
      x.restore(); frame(x, P.view); haloTxt(x, yr, px + mm(4), py + mm(11), 8, 700, pal.ink3);
      para(x, cap, px, py + ph + mm(5.5), pwm, 3.1, 500, pal.ink2, 4.2); }
    const tx = x0 + 2 * (pw + gx), ty = y0 + ph + rowGap; let y = ty + mm(5); txt(x, 'Timeline', tx, y, 5, 700, pal.ink3); y += mm(9);
    [['1931', 'aerodrome, 0.44 km²'], ['1999–2000', 'POTAUG art. 4.27: dismantle; one Special Plan (4.28); nothing may be built meanwhile except for Defence (4.30)'], ['2004, 2022', 'POTAUG modified twice — art. 4.24–4.30 untouched'], ['2019', 'RD 118/2019: new height limits around the base'],
     ['2015–2025', 'the five towns grow +15.3 %; Granada city −0.8 % (INE)'], ['2024', 'migrant centre refused; the Diputación asks for a 105,000 m² park and a perimeter circuit'], ['2026', 'metro extension in test runs to Las Gabias; the base still active, today 3.71 km²']].forEach(([a, b]) => { txt(x, a, tx, y, 3.4, 700, pal.red); y = para(x, b, tx + mm(26), y, pwm - 26, 3.1, 400, pal.ink, 4.1) + mm(1.5); });
    y += mm(6); txt(x, 'Built-up edge of each town at the date', tx, y, 3.6, 700, pal.ink3); y += mm(7);
    Object.keys(TC).forEach((nm, i) => { const kx = tx + (i % 2) * mm(80), ky = y + Math.floor(i / 2) * mm(6.5); x.strokeStyle = TC[nm]; x.lineWidth = mm(0.9); x.beginPath(); x.moveTo(kx, ky - mm(1)); x.lineTo(kx + mm(10), ky - mm(1)); x.stroke(); txt(x, nm, kx + mm(13), ky, 3.1, 500, pal.ink2); });
    foot(x, W, H, 'Sources: IGN MTN50 1931, SIGPAC 2001, PNOA 2022 (CC BY 4.0), as served · town edges: D. G. del Catastro, today’s buildings by recorded year (demolished buildings are missing, so old edges can be too small; Ogíjares is not drawn before 1987) · POTAUG, Decreto 244/1999 · RD 118/2019 · Diputación de Granada (press, April 2024) · INE · OpenStreetMap (ODbL).'); return c.toDataURL('image/png'); }

  // ======================= 4 · THREE FUTURES =======================
  if (which === 'three_futures') { const [c, x] = sheet(841, 594); const W = c.width, H = c.height; const S0 = PO.scenario; const COL = [pal.base.wine, pal.olive, pal.red];
    txt(x, 'THREE FUTURES FOR THE SAME LAND', mm(14), mm(21), 13, 600, pal.ink3); txt(x, 'Armilla Air Base and its edge in 2045 · 1:15,000 · scenarios drawn schematically — not plans, not forecasts', mm(14), mm(30), 4.8, 500, pal.ink3); x.strokeStyle = pal.line2; x.lineWidth = mm(0.25); x.beginPath(); x.moveTo(mm(14), mm(35)); x.lineTo(W - mm(14), mm(35)); x.stroke();
    const pwm = 263, pw = mm(pwm), ph = mm(356), gx = mm(12), x0 = mm(14), y0 = mm(41), DEN = 15000; const cxC = CX - 130, cyC = CY - 60, k17 = 1.9 * DPI / 200;
    const neutral = tint(TD.img.edge, pal.grey3 || '#D3CFC2'), built = tint(TD.img.edge, pal.rose); const band = D0.edge.find(f => f.p.k === 'band');
    const fenceWall = (P) => { path(x, P, baseRings, true); x.fillStyle = pal.ex21.base; x.fill('evenodd'); };
    const F3 = [
      ['A · THE BASE STAYS, CLOSED', 'Position of the Ministry of Defence', '“The base is a national asset; it stays, and so do its height limits.” (RD 118/2019)', 'The towns keep growing onto the open land beside them. The open land within 300 m of the fence (rose) is built next, and the fence stays a back: 13 dead ends, walks 1.3–1.5 times longer than the straight line.', [`~${S0.dwellings_needed_2045.toLocaleString('en-US')} more dwellings needed by 2045 (pace of 2015–2025: ${S0.rate_pct} % a year)`, 'all of them outside the base', 'the edge is built up to the fence'], 'Our reading — gains: Defence, the owners of the open land. Loses: walking between towns, the last open land at the edge.',
        [{ sw: pal.ex21.base, label: 'Base (military)' }, { sw: pal.rose, label: 'Open land within 300 m of the fence: built next' }, { sw: pal.grey3 || '#D3CFC2', label: 'Other open land beside the towns' }, { dead: pal.red, label: 'Dead end at the fence (13)' }]],
      ['B · THE BASE STAYS, ITS EDGE OPENS', 'Position of residents · close to the Diputación’s request (2024)', '“We don’t need the base’s land; we need to walk around it and use its edge.”', 'A public walking strip outside the whole fence joins the 13 dead ends, the sports centre (1), the Río Dílar (2), the metro at Armilla (3) and its future end at Las Gabias (4). A green corridor Ogíjares–Alhendín runs where the height limits already keep building low.', ['0 dwellings on the base', '8.7 km of public edge · 13 dead ends joined', 'Colonia Dávila park, 105,000 m² (asked for; position not published, not drawn)'], 'Our reading — gains: residents, ecology. Loses: owners of the edge land; Defence may object to people along the fence.',
        [{ line: pal.ex21s.strip, w: 1.6, label: 'Public walking strip (proposal)' }, { sw: '#FFFFFF', stroke: pal.ex21s.corridorLine, label: 'Green corridor (proposal)' }, { line: pal.ex21.metro, w: 1.1, rail: true, label: 'Metro extension' }, { sw: pal.grey3 || '#D3CFC2', label: 'Open land beside the towns' }]],
      ['C · THE BASE IS DISMANTLED', 'What the regional plan says (POTAUG art. 4.27) · the developers’ case', '“A residential, facilities and services area that becomes the central core of the five towns.”', 'Schematic only — the plan fixes uses, not form or numbers: streets cross the land from town to town, the runway becomes a long park, a centre sits at the metro. The height limits go with the base.', [`3.71 km² freed; at the towns’ median density (${S0.median_dw_per_ha} dwellings per hectare): ~${S0.base_dwellings_at_town_density.toLocaleString('en-US')} dwellings`, `~${S0.base_residents.toLocaleString('en-US')} residents = ${Math.round(S0.base_dwellings_at_town_density / S0.dwellings_needed_2045 * 100)} % of the need to 2045 (more if built denser)`, 'one Special Plan for five municipalities (art. 4.28)'], 'Our reading — gains: developers, the five towns (a centre, land for services), the Junta. Loses: Defence (it must move); the open field itself.',
        [{ sw: pal.rose, label: 'Housing blocks (schematic)' }, { sw: pal.base.lightBlue, label: 'Facilities, services' }, { sw: pal.olive, alpha: 0.55, label: 'Park on the runway' }, { line: pal.ink, dash: true, w: 0.5, label: 'Former base' }]]];
    const keyRow2 = (items, px, py) => { let cx = px; items.forEach(it => { const sw = mm(9), sh = mm(3.6); x.save();
        if (it.dead) { x.beginPath(); x.arc(cx + sw / 2, py, mm(1.7), 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.dead; x.lineWidth = mm(0.6); x.stroke(); x.beginPath(); x.moveTo(cx + sw / 2 - mm(0.9), py); x.lineTo(cx + sw / 2 + mm(0.9), py); x.stroke(); }
        if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(cx, py - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = it.stroke || pal.grey; x.lineWidth = mm(it.stroke ? 0.45 : 0.2); x.strokeRect(cx, py - sh / 2, sw, sh); }
        if (it.line) { x.strokeStyle = it.line; x.lineWidth = mm(it.w || 0.6); x.setLineDash(it.dash ? [mm(1.6), mm(0.8)] : []); x.beginPath(); x.moveTo(cx, py); x.lineTo(cx + sw, py); x.stroke(); x.setLineDash([]); if (it.rail) { x.strokeStyle = '#fff'; x.lineWidth = mm(0.3); x.setLineDash([mm(1), mm(1)]); x.beginPath(); x.moveTo(cx, py); x.lineTo(cx + sw, py); x.stroke(); x.setLineDash([]); } }
        x.restore(); txt(x, it.label, cx + sw + mm(2), py + mm(1.1), 3.1, 500, pal.ink2); x.font = `500 ${Math.round(mm(3.1))}px ${F}`; cx += sw + mm(2) + x.measureText(it.label).width + mm(6); }); };
    let yText = 0;
    for (let i = 0; i < 3; i++) { const [ttl, who, pos, desc, nums, wl, key] = F3[i]; const px = x0 + i * (pw + gx), py = y0; const P = win(px, py, pw, ph, DEN, cxC, cyC);
      if (i === 0) GA.ex21.drawCity(x, P.ox, P.oy, P.full, P.fullH, CTX(P, k17, { only: 'none', over: () => { cells(x, P, neutral, 0.55); x.save(); path(x, P, band.g, true); x.clip('evenodd'); cells(x, P, built, 1); x.restore(); fenceWall(P); path(x, P, baseRings, true); x.strokeStyle = pal.ink; x.lineWidth = mm(1.0); x.stroke(); deadEnds(x, P, mm(1.5), pal.red); } }));
      if (i === 1) GA.ex21.drawStrategy(x, P.ox, P.oy, P.full, P.fullH, CTX(P, k17, { noScenario: true, noOpenLand: true, over: () => { cells(x, P, neutral, 0.55); fenceWall(P); } }));
      const stn = D0.metro.find(f => f.p.k === 'station_now');
      if (i === 2) GA.ex21.drawCity(x, P.ox, P.oy, P.full, P.fullH, CTX(P, k17, { only: 'none', noBaseLabel: true, avoid: stn ? [[P.X(stn.g[0]) - mm(7), P.Y(stn.g[1]) - mm(7), P.X(stn.g[0]) + mm(7), P.Y(stn.g[1]) + mm(7)]] : [], over: () => { cells(x, P, neutral, 0.55);
        // the dismantled base, schematic: a block grid along the runway's direction, a park on the runway, streets from town to town, a centre at the metro
        path(x, P, baseRings, true); x.fillStyle = '#FFFFFF'; x.fill('evenodd'); path(x, P, baseRings, true); x.fillStyle = pal.blush; x.globalAlpha = 0.6; x.fill('evenodd'); x.globalAlpha = 1;
        x.save(); path(x, P, baseRings, true); x.clip('evenodd');
        const R = D0.runway, ang = Math.atan2(R[1][1] - R[0][1], R[1][0] - R[0][0]); const ca = Math.cos(ang), sa = Math.sin(ang); const mid = [(R[0][0] + R[1][0]) / 2, (R[0][1] + R[1][1]) / 2]; const at = (a, b) => [mid[0] + a * ca - b * sa, mid[1] + a * sa + b * ca];
        for (let u = -2400; u <= 2400; u += 120) for (let v = -2400; v <= 2400; v += 120) { if (v + 95 > -120 && v < 120) continue; const q = [at(u, v), at(u + 95, v), at(u + 95, v + 95), at(u, v + 95)]; const ui = Math.round((u + 2400) / 120), vi = Math.round((v + 2400) / 120);
          x.beginPath(); q.forEach((p2, k2) => k2 ? x.lineTo(P.X(p2[0]), P.Y(p2[1])) : x.moveTo(P.X(p2[0]), P.Y(p2[1]))); x.closePath(); x.fillStyle = (ui * 7 + vi * 3) % 6 === 0 ? pal.base.lightBlue : pal.rose; x.fill(); }
        const pk = [at(-2600, -120), at(2600, -120), at(2600, 120), at(-2600, 120)]; x.beginPath(); pk.forEach((p2, k2) => k2 ? x.lineTo(P.X(p2[0]), P.Y(p2[1])) : x.moveTo(P.X(p2[0]), P.Y(p2[1]))); x.closePath(); x.fillStyle = '#FFFFFF'; x.fill(); x.fillStyle = pal.olive; x.globalAlpha = 0.55; x.fill(); x.globalAlpha = 1;
        const T = {}; D0.edge.filter(f => f.p.k === 'town').forEach(f => T[f.p.nm] = f.g); x.lineCap = 'round';
        [['Churriana de la Vega', 'Alhendín'], ['Las Gabias', 'Ogíjares'], ['Armilla', 'Las Gabias']].forEach(([a, b]) => { if (!T[a] || !T[b]) return; x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(2.2); x.beginPath(); x.moveTo(P.X(T[a][0]), P.Y(T[a][1])); x.lineTo(P.X(T[b][0]), P.Y(T[b][1])); x.stroke(); x.strokeStyle = pal.grey2; x.lineWidth = mm(0.35); x.stroke(); });
        x.restore(); path(x, P, baseRings, true); x.strokeStyle = pal.ink; x.lineWidth = mm(0.5); x.setLineDash([mm(1.6), mm(1)]); x.stroke(); x.setLineDash([]); metro(x, P, mm(0.2));
        const st = D0.metro.find(f => f.p.k === 'station_now'); if (st) { const sx0 = P.X(st.g[0]), sy0 = P.Y(st.g[1]); x.beginPath(); x.arc(sx0, sy0, mm(5.5), 0, 7); x.fillStyle = 'rgba(153,43,42,.2)'; x.fill(); x.strokeStyle = pal.red; x.lineWidth = mm(0.7); x.stroke(); glowTxt(x, 'centre at the metro (schematic)', sx0 - mm(8), sy0 - mm(1), 3.4, 700, pal.red, 'right'); } } }));
      frame(x, P.view); north(x, P.view); scaleBar(x, P, P.view, 1000);
      keyRow2(key, px, py + ph + mm(6.5));
      let y = py + ph + mm(18); txt(x, ttl, px, y, 6.4, 700, COL[i]); y += mm(6.5); txt(x, who, px, y, 3.8, 600, pal.ink3); y += mm(7);
      y = para(x, pos, px, y, pwm, 4.2, 600, pal.ink, 5.6) + mm(1.5); y = para(x, desc, px, y, pwm, 3.7, 400, pal.ink2, 5.1) + mm(2.5);
      nums.forEach(nl => { x.fillStyle = COL[i]; x.fillRect(px, y - mm(2.6), mm(2.2), mm(2.2)); y = para(x, nl, px + mm(4.5), y, pwm - 5, 3.8, 600, pal.ink, 5.1); });
      y += mm(2); y = para(x, wl, px, y, pwm, 3.4, 500, pal.ink3, 4.7); yText = Math.max(yText, y); }
    // ---- where the three collide: the same question, three answers ----
    let y = yText + mm(8); txt(x, 'WHERE THE THREE COLLIDE — the same question, three answers', x0, y, 5.2, 700, pal.ink3); y += mm(4);
    const cx3 = (i) => x0 + i * (pw + gx); const rule = (yy, col, wd) => { x.strokeStyle = col || pal.line2; x.lineWidth = mm(wd || 0.2); x.beginPath(); x.moveTo(x0, yy); x.lineTo(W - mm(14), yy); x.stroke(); };
    const rows = [['The fence line (8.7 km)', 'stays a wall', 'a public walking strip runs along its outside', 'removed'],
      ['Open land within 300 m of the fence', 'built up as the towns grow', 'the strip and the corridor stay public; the rest can still be built', 'no longer an edge: it faces the new centre'],
      ['The base land (3.71 km²)', 'military', 'military', 'housing, facilities and services (POTAUG 4.27)'],
      ['Height limits around the base (RD 118/2019)', 'stay', 'stay — the corridor uses the land they keep low', 'go with the base'],
      [`Dwellings to 2045 (~${S0.dwellings_needed_2045.toLocaleString('en-US')} needed)`, 'all outside the base', 'all outside the base', `~${S0.base_dwellings_at_town_density.toLocaleString('en-US')} on the base at today’s density (${Math.round(S0.base_dwellings_at_town_density / S0.dwellings_needed_2045 * 100)} %)`],
      ['Who must agree', 'no one — it is today’s situation', 'Defence (security at the fence), the five towns, the owners of the edge land', 'the State, the Junta and the five towns, through one Special Plan']];
    rule(y, pal.ink3, 0.35);
    rows.forEach(([lab, a, b, c2]) => { y += mm(5); txt(x, lab, x0, y, 3.3, 700, pal.ink3); const yy = y + mm(5.2); let ym = yy;
      [a, b, c2].forEach((s0, i) => { x.fillStyle = COL[i]; x.fillRect(cx3(i), yy - mm(2.7), mm(1.6), mm(2.7)); ym = Math.max(ym, para(x, s0, cx3(i) + mm(4), yy, pwm - 6, 3.8, 500, pal.ink, 5)); }); y = ym - mm(2.4); rule(y); });
    y += mm(8); ['A ↔ B   May people walk along the fence?', 'B ↔ C   An edge to open, or a centre to build?', 'A ↔ C   Does the State leave at all?'].forEach((q0, i) => txt(x, q0, cx3(i), y, 4.4, 700, pal.red));
    foot(x, W, H, 'Scenarios, not forecasts. Sources: POTAUG, Decreto 244/1999, Normativa art. 4.27–4.30 · RD 118/2019 · Diputación de Granada (press, April 2024) · INE padrón 2015–2025 (pace continued to 2045: ' + S0.pop_2025.toLocaleString('en-US') + ' → ~' + S0.pop_2045.toLocaleString('en-US') + ' residents; ' + S0.persons_per_dwelling + ' persons per dwelling) · D. G. del Catastro (the towns’ median density; open land = 100 m cells under 3 % built beside built cells) · OpenStreetMap (ODbL). Which open land may legally be built is not mapped here (the POTAUG protects parts of the Vega). Future C’s blocks, streets, park and centre are schematic.');
    return c.toDataURL('image/png'); }
  throw new Error('unknown sheet ' + which); }'''
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawStrategy)', timeout=20000); pg.evaluate('GA.i18n.setLang("en")')
    os.makedirs(OUTD, exist_ok=True); n = {'who_decides_iz': '01b', 'who_decides': '01', 'who_holds': '02', 'over_time': '03', 'three_futures': '04'}
    for w in WHICH:
      d = pg.evaluate(JS, [w, DPI, os.environ.get('IZBASE', 'pnoa2022')]); open(os.path.join(OUTD, f'policy_{n[w]}_{w}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(w, 'ok', flush=True)
    print('errors:', errs[:5])
finally: srv.terminate()
