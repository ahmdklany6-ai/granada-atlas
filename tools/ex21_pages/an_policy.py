"""Exercise 2.2 — the policy map series in the ANALYSIS print style (owner, 20 Nov 2026), English only:
  who_decides    01  A2 · 1:15,000   red = the POTAUG concerted zone (art. 4.27) and its own words
  who_holds      02  A2 · 1:10,000   red = the base, split by municipality (a ramp of the red by share)
  over_time      03  A2 · 1:35,000   red = what each date's decision touches (none in 1931)
  three_futures  04  A1 · 1:15,000   red = what changes in each future
The identity-style sheets stay in tools/ex21_pages/policy.py (and its approved test 'who_decides_iz').
Needs data/ex21/policy.json (tools/build_ex21_policy.py), data/ex21/town_edges.json, exports/ex21_time/hist/*.jpg.
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/an_policy.py <out folder> [which,…]   (env DPI, default 200)"""
import sys, time, subprocess, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _analysis import AN_JS, launch, save
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; ALL = ['who_decides', 'who_holds', 'over_time', 'three_futures', 'five_plans']; ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else ALL
DPI = float(os.environ.get('DPI', 200)); PORT = 8867
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([which, DPI]) => {
  await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); await GA.ex21.readyTownEdges(); GA.ex21.setStyle('analysis'); ''' + AN_JS + r'''
  const PO = await (await fetch('/data/ex21/policy.json?r=' + Date.now())).json(); const D0 = GA.ex21.data, TD = GA.ex21.time, E = GA.ex21.CITY, pal = GA.palette, a = GA.ex21.an, F = AN.F, mm = AN.mm, D = AN.D;
  const t = (k, v) => GA.i18n.t(k, v), INK = AN.INK, GR = AN.GR, RED = AN.RED, CX = 442830, CY = 4109470, SERIES = 'EX 2.2 · POLICY';
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });
  // a window on the city frame at 1:den, centred on (cx, cy) and kept inside the data
  const win = (bx, by, bw, bh, den, cx, cy) => { const full = 6400000 / den * D, s = full / 6400; const hwM = bw / s / 2, hhM = bh / s / 2;
    const c0 = Math.min(Math.max(cx, E.x0 + hwM), E.x0 + 6400 - hwM), c1 = Math.min(Math.max(cy, E.y1 - 5600 + hhM), E.y1 - hhM);
    const ox = bx + bw / 2 - (c0 - E.x0) * s, oy = by + bh / 2 - (E.y1 - c1) * s; return { full, fullH: full * 5600 / 6400, ox, oy, s, X: (u) => ox + (u - E.x0) * s, Y: (v) => oy + (E.y1 - v) * s, U: (px) => E.x0 + (px - ox) / s, V: (py) => E.y1 - (py - oy) / s, view: [bx, by, bx + bw, by + bh] }; };
  const path = (x, P, rs, close) => { x.beginPath(); rs.forEach(r => { r.forEach((q, i) => i ? x.lineTo(P.X(q[0]), P.Y(q[1])) : x.moveTo(P.X(q[0]), P.Y(q[1]))); if (close) x.closePath(); }); };
  const pieces = (x, P, rings, cb) => rings.forEach(pg => { path(x, P, pg, true); cb(); });
  const baseRings = D0.edge.find(f => f.p.k === 'base').g; const band = D0.edge.find(f => f.p.k === 'band');
  const clipV = (x, V) => { x.save(); x.beginPath(); x.rect(V[0], V[1], V[2] - V[0], V[3] - V[1]); x.clip(); };
  const centroid = (rings) => { let A = 0, p = 0, q = 0; rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const cr = r[j][0] * r[i][1] - r[i][0] * r[j][1]; A += cr; p += (r[j][0] + r[i][0]) * cr; q += (r[j][1] + r[i][1]) * cr; } }); return [p / 3 / A, q / 3 / A]; };
  const inR = (rings, u, v) => { let c0 = false; rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const p1 = r[i], p2 = r[j]; if ((p1[1] > v) !== (p2[1] > v) && u < (p2[0] - p1[0]) * (v - p1[1]) / (p2[1] - p1[1]) + p1[0]) c0 = !c0; } }); return c0; };
  const dens = (rs, step) => rs.flatMap(r => r.flatMap((q, i) => { const q2 = r[(i + 1) % r.length]; const n = Math.max(1, Math.ceil(Math.hypot(q2[0] - q[0], q2[1] - q[1]) / step)); return Array.from({ length: n }, (_, j) => [q[0] + (q2[0] - q[0]) * j / n, q[1] + (q2[1] - q[1]) * j / n]); }));
  // the five municipal boundaries (Catastro): black dash-dot on a white casing
  const muniLines = (x, P, w) => Object.values(PO.muni).forEach(rings => pieces(x, P, rings, () => { x.setLineDash([]); x.strokeStyle = '#FFFFFF'; x.lineWidth = w * 3; x.stroke(); x.strokeStyle = INK; x.lineWidth = w; x.setLineDash([w * 6.4, w * 2.2, w, w * 2.2]); x.stroke(); x.setLineDash([]); }));
  const metro = (x, P, w, extCol) => { x.save(); x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = w; x.beginPath(); D0.l1.lines.forEach(l => l.forEach((q, i) => i ? x.lineTo(P.X(q[0]), P.Y(q[1])) : x.moveTo(P.X(q[0]), P.Y(q[1])))); x.stroke();
    D0.metro.forEach(f => { if (f.p.k !== 'track') return; x.strokeStyle = extCol || INK; x.lineWidth = w; if (!extCol) x.setLineDash([w * 0.2, w * 2]); path(x, P, f.g); x.stroke(); x.setLineDash([]); }); x.restore(); };
  // the grey ground: today's site map (buildings, streets) with the base drawn by the core (subject = red hatch)
  const ground = (x, P, k, o) => GA.ex21.drawCity(x, P.ox, P.oy, P.full, P.fullH, Object.assign({ t, k, view: P.view, only: 'none', noScale: true, noNorth: true, noMuni: true, noTowns: true, noBaseLabel: true, baseSubject: false }, o || {}));
  // municipality names inside their own boundary, near the base, clear of every line and of the boxes in `avoid` (px)
  const muniNames = (x, P, sz, avoid, list, targets) => { const bcm0 = centroid(baseRings), V = P.view, used = (avoid || []).slice(); const lines = dens(Object.values(PO.muni).flat(), 15).concat(dens(baseRings, 15));
    Object.entries(PO.muni).filter(([nm]) => !list || list.includes(nm)).forEach(([nm, mr]) => { const rings = mr.flat(), s0 = nm.toUpperCase(), bcm = (targets && targets[nm]) || bcm0; const w = AN.spacedW(x, s0, sz, 700, sz * 0.2) + mm(4), h = mm(sz * 3.2); let best = null, bd = 1e18;
      for (let gy = V[1] + h; gy < V[3] - h; gy += mm(2.5)) for (let gx = V[0] + w / 2 + mm(3); gx < V[2] - w / 2 - mm(3); gx += mm(2.5)) { const u = P.U(gx), v = P.V(gy);
        if (!inR(rings, u, v) || inR(baseRings, u, v)) continue; const hw = (w / 2) / P.s, hh = (h / 2) / P.s; if (lines.some(q => Math.abs(q[0] - u) < hw && Math.abs(q[1] - v) < hh)) continue;
        if (used.some(b => gx + w / 2 > b[0] && gx - w / 2 < b[2] && gy + h / 2 > b[1] && gy - h / 2 < b[3])) continue; const d = (u - bcm[0]) ** 2 + (v - bcm[1]) ** 2; if (d < bd) { bd = d; best = [gx, gy]; } }
      if (!best) return; used.push([best[0] - w / 2, best[1] - h / 2, best[0] + w / 2, best[1] + h / 2]);
      AN.plate(x, s0, best[0], best[1] - mm(sz * 0.45), sz, 700, INK, { spaced: true, sp: sz * 0.2 }); AN.txt(x, 'municipality', best[0], best[1] + mm(sz * 1.1), sz * 0.68, 500, GR, 'center'); }); return used; };
  const bezPts = (x0, y0, x1, y1, b) => { const out = []; for (let i = 0; i <= 60; i++) { const s = i / 60, c1x = x0 + (x1 - x0) * b, c2x = x1 - (x1 - x0) * b; const mx = (1 - s) ** 3 * x0 + 3 * (1 - s) ** 2 * s * c1x + 3 * (1 - s) * s * s * c2x + s ** 3 * x1, my = (1 - s) ** 3 * y0 + 3 * (1 - s) ** 2 * s * y0 + 3 * (1 - s) * s * s * y1 + s ** 3 * y1; out.push([mx - mm(2), my - mm(2), mx + mm(2), my + mm(2)]); } return out; };
  const SRC = 'Sources: POTAUG, Decreto 244/1999 (BOJA 37, 28 Mar 2000), Normativa art. 4.25–4.30 · RD 118/2019 (BOE) · municipal outlines: D. G. del Catastro (INSPIRE) · base, streets, metro: OpenStreetMap contributors (ODbL) · population: INE · ceiling: Ministerio de Defensa, approximate.';
  const STYLE = ' Printed in black, greys and one red; the base is drawn as a white void behind its fence (a black line with white dashes).';

  // ======================= 1 · WHO DECIDES =======================
  if (which === 'who_decides') { AN.u = 1; const [c, x] = AN.sheet(594, 420); const W = c.width, H = c.height; const k = 2.0 * DPI / 200;
    AN.head(x, W, { title: 'WHO DECIDES ABOUT THE BASE LAND', sub: 'Armilla Air Base · three public documents, three futures for one piece of land', code: SERIES + ' · 1:15,000', num: '01 / 05' });
    const bx = mm(30), by = mm(46), bw = mm(350), bh = mm(326); const P = win(bx, by, bw, bh, 15000, CX - 150, CY + 250); const V = P.view;
    ground(x, P, k, { baseSubject: true, over: () => { muniLines(x, P, mm(0.5)); metro(x, P, mm(0.55)); } });
    // the zone's label
    const bc = centroid(baseRings); const zone = [AN.plate(x, 'POTAUG 2000 · ART. 4.27', P.X(bc[0]), P.Y(bc[1]) - mm(2.2), 3.3, 700, RED, { alpha: 1 }), AN.plate(x, '“to be dismantled as a Defence installation”', P.X(bc[0]), P.Y(bc[1]) + mm(2.6), 2.6, 500, RED, { alpha: 1 })];
    // the three actors: text column, curved leaders to the east fence (schematic: who points at the land, not a route)
    const rx = bx + bw + mm(26), rw = (W - rx) / D - 22; let y = mm(56);
    const items = [['1', 'THE REGION', 'Junta de Andalucía · POTAUG 2000', 'Art. 4.27: dismantle it as a Defence installation; a residential, facilities and services area, the central core of the five towns. Art. 4.30: until one Special Plan exists, nothing may be built there except for Defence. No date, no number of dwellings.', RED, [], 0.24],
      ['2', 'THE STATE', 'Ministerio de Defensa · RD 118/2019', 'Nineteen years later the State renewed the base’s height limits, about 2 m to 75 m above the ground around it. The base stays active.', INK, [], 0.47],
      ['3', 'THE PROVINCE AND THE TOWNS', 'Diputación de Granada · five councils · 2024', 'A migrant centre on base land was refused; the Diputación asked for a 105,000 m² park (Colonia Dávila) and a sports circuit round the whole perimeter. The plot’s position and the State’s answer were not found, so neither is drawn.', INK, [mm(1.6), mm(1.2)], 0.7]];
    let bb = [1e9, 1e9, -1e9, -1e9]; baseRings.forEach(r => r.forEach(q => { bb = [Math.min(bb[0], q[0]), Math.min(bb[1], q[1]), Math.max(bb[2], q[0]), Math.max(bb[3], q[1])]; }));
    const east = (fy) => { const ty = bb[3] - (bb[3] - bb[1]) * fy; let best = null; baseRings.forEach(r => r.forEach((q, i) => { const q2 = r[(i + 1) % r.length]; if ((q[1] - ty) * (q2[1] - ty) <= 0 && q[1] !== q2[1]) { const u = q[0] + (ty - q[1]) / (q2[1] - q[1]) * (q2[0] - q[0]); if (!best || u > best[0]) best = [u, ty]; } })); return [P.X(best[0]), P.Y(best[1])]; };
    const leaders = []; items.forEach(([n, who, doc, body, col, dash, at]) => { const y0 = y; AN.plus(x, rx - mm(6), y0 - mm(1.4), mm(1.6)); AN.txt(x, n, rx, y0, 3, 700, col); AN.spaced(x, who, rx + mm(6), y0, 3, 700, col, 0.45); y += mm(5.2); AN.txt(x, doc, rx + mm(6), y, 2.7, 600, GR); y += mm(5.5); y = AN.para(x, body, rx + mm(6), y, rw - 6, 2.75, 400, INK, 3.9) + mm(9);
      const [ax, ay] = east(at); leaders.push([rx - mm(10), y0 - mm(1.4), ax, ay, col, dash]); });
    const avoid = zone.concat(...leaders.map(L => bezPts(L[0], L[1], L[2], L[3], 0.5))); clipV(x, V); muniNames(x, P, 3.3, avoid); x.restore();
    leaders.forEach(L => AN.leader(x, L[0], L[1], L[2], L[3], L[4], L[5], 0.5));
    AN.frame(x, V); AN.scale(x, V, P.s, 1000, { scale: '1:15,000' });
    y = AN.note(x, rx, y, rw, 'ORIGINAL TEXT · ART. 4.27.1', '«La zona de ordenación concertada Aeródromo de Armilla tiene por finalidad su desmantelamiento como instalación para la Defensa y el desarrollo de un área residencial, dotacional y de servicios sobre los suelos actualmente afectados al mismo.»', RED, { sz: 2.6, lh: 3.7 });
    y = AN.note(x, rx, y, rw, 'THE CONFLICT', 'One piece of land, five municipalities, three levels of government. The region has wanted the base to become the centre of the five towns since 2000; the State keeps it; the towns grew 15 % in ten years around it.', INK) + mm(2);
    const kk = mm(0.25); y = AN.key(x, [{ base: 'subject', label: 'POTAUG concerted zone = today’s base (' + PO.base_km2.toFixed(2) + ' km²)' }, { fence: true, label: 'Fence (OSM outline)' }, { line: INK, wk: 2, dk: [12.8, 4.4, 2, 4.4], label: 'Boundary of the five municipalities (Catastro)' },
      { line: INK, wk: 2.2, label: 'Metro line 1 (OSM)' }, { line: INK, wk: 2.2, dots: true, label: 'Metro line 1 extension, in construction (OSM)' }], rx, y, { kk, colW: rw }) ;
    AN.leader(x, rx, y + mm(1.5), rx + mm(10), y - mm(1.5), INK, [], 0.5); AN.txt(x, 'Who points at the land (schematic, not a route)', rx + mm(13), y + mm(0.9), 2.5, 500, INK);
    AN.src(x, W, H, SRC + ' Base: buildings D. G. del Catastro, streets and land OpenStreetMap (ODbL), printed in grey. Press, April 2024: Ahora Granada, Granada Digital, COPE.' + STYLE);
    return c.toDataURL('image/png'); }

  // ======================= 2 · WHO HOLDS A PIECE =======================
  if (which === 'who_holds') { AN.u = 1; const [c, x] = AN.sheet(594, 420); const W = c.width, H = c.height; const k = 2.6 * DPI / 200;
    AN.head(x, W, { title: 'FIVE MUNICIPALITIES, ONE BASE', sub: 'Which town holds which part of the ' + PO.base_km2.toFixed(2) + ' km² · municipal outlines from the Catastro', code: SERIES + ' · 1:10,000', num: '02 / 05' });
    const bx = mm(30), by = mm(46), bw = mm(360), bh = mm(326); const P = win(bx, by, bw, bh, 10000, CX - 250, CY - 200); const V = P.view;
    const order = Object.entries(PO.base_split_km2).sort((p, q) => q[1] - p[1]); const ramp = a.ramp; const TONE = {}; order.forEach(([nm], i) => { TONE[nm] = [ramp[4], ramp[3], ramp[2], ramp[1], ramp[0]][i]; });
    ground(x, P, k, { over: () => { path(x, P, baseRings, true); x.fillStyle = '#FFFFFF'; x.fill('evenodd');
      Object.entries(PO.base_pieces).forEach(([nm, rings]) => pieces(x, P, rings, () => { x.fillStyle = TONE[nm]; x.fill('evenodd'); x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(0.4); x.stroke(); }));
      muniLines(x, P, mm(0.55)); path(x, P, baseRings, true); GA.ex21.anFence(x, k, a); } });
    clipV(x, V); const share = (km) => Math.round(km / PO.base_km2 * 100);
    Object.entries(PO.base_pieces).forEach(([nm, rings]) => { const big0 = rings.slice().sort((p, q) => q[0].length - p[0].length)[0]; const cc = centroid([big0[0]]); const km = PO.base_split_km2[nm]; const big = km > 0.3;
      AN.plate(x, nm.toUpperCase(), P.X(cc[0]), P.Y(cc[1]) - mm(big ? 2.6 : 2), big ? 3.6 : 2.4, 700, INK, { spaced: true, sp: 0.5, alpha: 0.92 }); AN.plate(x, `${km.toFixed(2)} km² · ${share(km)} %` + (big ? ' of the base' : ''), P.X(cc[0]), P.Y(cc[1]) + mm(big ? 2.8 : 2), big ? 2.8 : 2.1, 600, INK, { alpha: 0.92 }); });
    x.restore(); AN.frame(x, V); AN.scale(x, V, P.s, 500, { scale: '1:10,000', labels: [['0', 0], ['250', 0.5], ['500 m', 1]] });
    const rx = bx + bw + mm(22), rw = (W - rx) / D - 22; let y = mm(56); AN.txt(x, '+ SHARE OF THE BASE HELD BY EACH MUNICIPALITY', rx, y, 2.6, 700, RED); y += mm(7);
    const barW = mm(rw - 34); order.forEach(([nm, km]) => { AN.txt(x, nm, rx, y, 2.75, 600, INK); const w0 = barW * km / order[0][1]; x.fillStyle = TONE[nm]; x.fillRect(rx, y + mm(1.6), w0, mm(4.2)); AN.txt(x, `${km.toFixed(2)} km² (${share(km)} %)`, rx + w0 + mm(2.5), y + mm(5), 2.6, 500, INK); y += mm(11.5); });
    y += mm(5); AN.txt(x, '+ SHARE OF EACH MUNICIPALITY’S OWN TERRITORY THAT THE BASE TAKES', rx, y, 2.6, 700, INK); y += mm(7); const pcs = order.map(([nm, km]) => [nm, km / PO.muni_km2[nm] * 100]).sort((p, q) => q[1] - p[1]); const pmax = pcs[0][1];
    pcs.forEach(([nm, pc]) => { AN.txt(x, `${nm} (${PO.muni_km2[nm].toFixed(1)} km²)`, rx, y, 2.75, 600, INK); const w0 = barW * pc / pmax; x.fillStyle = TONE[nm]; x.fillRect(rx, y + mm(1.6), w0, mm(4.2)); AN.txt(x, `${pc.toFixed(1)} %`, rx + w0 + mm(2.5), y + mm(5), 2.6, 500, INK); y += mm(11.5); });
    y += mm(5); y = AN.note(x, rx, y, rw, 'WHY IT MATTERS', `No single town can plan the base. Las Gabias and Churriana hold ${share(PO.base_split_km2['Las Gabias'] + PO.base_split_km2['Churriana de la Vega'])} % of it; Armilla — whose name the base carries — holds ${share(PO.base_split_km2['Armilla'])} %, Ogíjares ${share(PO.base_split_km2['Ogíjares'])} %. For Churriana the base is about a sixth of its whole territory. That is why the POTAUG (art. 4.28) asks for ONE Special Plan for the whole zone and recommends a consortium or a shared company to run it (art. 4.29).`, INK);
    AN.key(x, [{ sw: ramp[4], label: 'The base, by municipality: darker = a larger share (the same tones in the bars)' }, { fence: true, label: 'Fence (OSM outline)' }, { line: INK, wk: 2.2, dk: [14, 4.8, 2.2, 4.8], label: 'Municipal boundary (Catastro)' }], rx, y, { kk: mm(0.25), colW: rw });
    AN.src(x, W, H, 'Sources: municipal outlines — D. G. del Catastro, INSPIRE CadastralParcels (union of each municipality’s cadastral zoning), 20 Nov 2026; base — OpenStreetMap way 130984030 (3.71 km² measured; Wikipedia gives 369 ha); POTAUG art. 4.28–4.29. Areas measured in EPSG:25830 on those outlines. Ground: buildings and streets, OpenStreetMap, printed in grey.' + STYLE);
    return c.toDataURL('image/png'); }

  // ======================= 3 · DECISIONS OVER TIME =======================
  if (which === 'over_time') { AN.u = 1; const [c, x] = AN.sheet(594, 420); const W = c.width, H = c.height;
    AN.head(x, W, { title: 'TWENTY-FIVE YEARS OF “DISMANTLE IT”', sub: 'The same frame, five dates · black lines: each town’s built-up edge at that date (Catastro, by recorded year of construction) · red: what that date’s decision touches', code: SERIES + ' · 1:35,000', num: '03 / 05' });
    const pwm = 168, pw = mm(pwm), ph = Math.round(pw * 5600 / 6400), gx = mm(12), x0 = mm(30), y0 = mm(46), rowGap = mm(26); const k35 = 1.2 * DPI / 200;
    const hist = (n) => load('/exports/ex21_time/hist/' + n + '.jpg');
    const cellsT = [['1931', 'A small aerodrome among fields (0.44 km²). IGN map, first edition. Nothing in red: no decision yet.', 'photo', 'mtn50', null],
      ['2000', 'The POTAUG is approved: the base (red hatch) is to be dismantled and become the centre of the five towns. Photo: SIGPAC 2001.', 'photo', 'sigpac2000', 'potaug'],
      ['2019', 'RD 118/2019: the State renews the height limits around the base (red: darker = lower). The base stays.', 'map', null, 'rd'],
      ['2024', 'A migrant centre on base land is refused; the Diputación asks for a park and a circuit around the perimeter (red dashes on the fence line: schematic, its route is not published). Photo: PNOA 2022.', 'photo', 'pnoa2022', 'dip'],
      ['2026', 'Today: the metro extension (red) passes the base’s north corner on its way to Las Gabias; the towns stand at the fence.', 'map', null, 'now']];
    for (let i = 0; i < cellsT.length; i++) { const [yr, cap, kind, ph0, mark] = cellsT[i]; const col = i % 3, row = Math.floor(i / 3); const px = x0 + col * (pw + gx), py = y0 + row * (ph + rowGap);
      const P = win(px, py, pw, ph, 35000, E.x0 + 3200, E.y1 - 2800); const V = P.view;
      if (kind === 'photo') GA.ex21.drawTime(x, P.ox, P.oy, P.full, P.fullH, { t, k: k35, view: V, noScale: true, noNorth: true, only: 'photo', photo: await hist(ph0), edges: ph0, edgeCol: INK });
      else ground(x, P, k35, { over: () => { if (mark === 'rd') { const e = D0.ease.extent; x.drawImage(GA.ex21.heightImg(), P.X(e[0]), P.Y(e[3]), (e[2] - e[0]) * P.s, (e[3] - e[1]) * P.s); GA.ex21.anBase(x, () => path(x, P, baseRings, true), V, k35, a, false); }
        if (mark === 'now') { Object.values(GA.ex21.townEdges.edges.pnoa2022).forEach(rs => (rs || []).forEach(pg => { path(x, P, pg, true); x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(0.8); x.stroke(); x.strokeStyle = INK; x.lineWidth = mm(0.35); x.stroke(); }));
          metro(x, P, mm(0.5), RED); } } });
      clipV(x, V);
      if (mark === 'potaug') { path(x, P, baseRings, true); GA.ex21.anHatch(x, V, RED, mm(1.1), mm(0.3), 1); path(x, P, baseRings, true); GA.ex21.anFence(x, k35, a); }
      if (mark === 'dip') { path(x, P, baseRings, true); x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(1.6); x.stroke(); x.strokeStyle = RED; x.lineWidth = mm(0.8); x.setLineDash([mm(1.4), mm(0.9)]); x.stroke(); x.setLineDash([]); }
      x.restore(); AN.frame(x, V); AN.plate(x, yr, px + mm(9), py + mm(6.5), 5, 700, INK, { alpha: 0.9 });
      AN.para(x, cap, px, py + ph + mm(7.5), pwm, 2.7, 500, INK, 3.7); }
    const tx = x0 + 2 * (pw + gx), ty = y0 + ph + rowGap; let y = ty + mm(3); AN.txt(x, '+ TIMELINE', tx, y, 2.6, 700, INK); y += mm(7);
    [['1931', 'aerodrome, 0.44 km²'], ['1999–2000', 'POTAUG art. 4.27: dismantle; one Special Plan (4.28); nothing may be built meanwhile except for Defence (4.30)'], ['2004, 2022', 'POTAUG modified twice — art. 4.24–4.30 untouched'], ['2019', 'RD 118/2019: new height limits around the base'],
     ['2015–2025', 'the five towns grow +15.3 %; Granada city −0.8 % (INE)'], ['2024', 'migrant centre refused; the Diputación asks for a 105,000 m² park and a perimeter circuit'], ['2026', 'metro extension in test runs to Las Gabias; the base still active, today 3.71 km²']].forEach(([p, q]) => { AN.txt(x, p, tx, y, 2.75, 700, INK); y = AN.para(x, q, tx + mm(24), y, pwm - 24, 2.6, 400, INK, 3.5) + mm(1.6); });
    y += mm(4); y = AN.key(x, [{ fence: true, label: 'The base fence today (OSM), on every date' }, { line: INK, wk: 1.4, label: 'Each town’s built-up edge at that date (Catastro)' }, { sw: RED, label: 'Red: what that date’s decision touches' }], tx, y, { kk: mm(0.25), colW: pwm }) + mm(4);
    AN.scale(x, [tx, y, tx, y], 1000 / 35000 * D, 1000, { scale: '1:35,000 (each picture)', dy: 2 });
    AN.src(x, W, H, 'Sources: IGN MTN50 1931, SIGPAC 2001, PNOA 2022 (CC BY 4.0), as served, printed in grey · town edges: D. G. del Catastro, today’s buildings by recorded year (demolished buildings are missing, so old edges can be too small; Ogíjares is not drawn before 1987) · POTAUG, Decreto 244/1999 · RD 118/2019 · Diputación de Granada (press, April 2024) · INE · OpenStreetMap (ODbL).' + STYLE);
    return c.toDataURL('image/png'); }

  // ======================= 4 · THREE FUTURES =======================
  if (which === 'three_futures') { AN.u = 1.25; const [c, x] = AN.sheet(841, 594); const W = c.width, H = c.height; const S0 = PO.scenario;
    AN.head(x, W, { title: 'THREE FUTURES FOR THE SAME LAND', sub: 'Armilla Air Base and its edge in 2045 · scenarios drawn schematically — not plans, not forecasts · red = what changes in each future', code: SERIES + ' · 1:15,000', num: '04 / 05' });
    const pwm = 250, pw = mm(pwm), ph = mm(330), gx = mm(15), x0 = mm(37.5), y0 = mm(54), DEN = 15000; const cxC = CX - 130, cyC = CY - 60, k17 = 1.9 * DPI / 200;
    const tint = (img, col) => { const c2 = document.createElement('canvas'); c2.width = img.naturalWidth; c2.height = img.naturalHeight; const g = c2.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c2.width, c2.height); return c2; };
    const cells = (P, cv, al) => { x.save(); x.imageSmoothingEnabled = false; x.globalAlpha = al; x.drawImage(cv, P.ox, P.oy, P.full, P.fullH); x.restore(); };
    const neutral = tint(TD.img.edge, a.grey[2]), next = tint(TD.img.edge, RED);
    const voidBase = (P) => GA.ex21.anBase(x, () => path(x, P, baseRings, true), P.view, k17, a, false);
    const F3 = [
      ['A · THE BASE STAYS, CLOSED', 'Position of the Ministry of Defence', '“The base is a national asset; it stays, and so do its height limits.” (RD 118/2019)', 'The towns keep growing onto the open land beside them. The open land within 300 m of the fence (red) is built next, and the fence stays a back: 13 dead ends, walks 1.3–1.5 times longer than the straight line.', [`~${S0.dwellings_needed_2045.toLocaleString('en-US')} more dwellings needed by 2045 (pace of 2015–2025: ${S0.rate_pct} % a year)`, 'all of them outside the base', 'the edge is built up to the fence'], 'Our reading — gains: Defence, the owners of the open land. Loses: walking between towns, the last open land at the edge.',
        [{ base: 'context', label: 'Base (military)' }, { sw: RED, label: 'Open land within 300 m of the fence: built next' }, { sw: a.grey[2], label: 'Other open land beside the towns' }, { sym: 'dead', line: INK, label: 'Dead end at the fence (13)' }]],
      ['B · THE BASE STAYS, ITS EDGE OPENS', 'Position of residents · close to the Diputación’s request (2024)', '“We don’t need the base’s land; we need to walk around it and use its edge.”', 'A public walking strip outside the whole fence joins the 13 dead ends, the sports centre (1), the Río Dílar (2), the metro at Armilla (3) and its future end at Las Gabias (4). A green corridor Ogíjares–Alhendín runs where the height limits already keep building low.', ['0 dwellings on the base', '8.7 km of public edge · 13 dead ends joined', 'Colonia Dávila park, 105,000 m² (asked for; position not published, not drawn)'], 'Our reading — gains: residents, ecology. Loses: owners of the edge land; Defence may object to people along the fence.',
        [{ line: RED, wk: 3.6, label: 'Public walking strip (proposal)' }, { sw: a.ramp[1], stroke: RED, label: 'Green corridor (proposal)' }, { line: INK, wk: 2.4, rail: true, label: 'Metro extension' }, { sw: a.grey[2], label: 'Open land beside the towns' }]],
      ['C · THE BASE IS DISMANTLED', 'What the regional plan says (POTAUG art. 4.27) · the developers’ case', '“A residential, facilities and services area that becomes the central core of the five towns.”', 'Schematic only — the plan fixes uses, not form or numbers: streets cross the land from town to town, the runway becomes a long park, a centre sits at the metro. The height limits go with the base.', [`3.71 km² freed; at the towns’ median density (${S0.median_dw_per_ha} dwellings per hectare): ~${S0.base_dwellings_at_town_density.toLocaleString('en-US')} dwellings`, `~${S0.base_residents.toLocaleString('en-US')} residents = ${Math.round(S0.base_dwellings_at_town_density / S0.dwellings_needed_2045 * 100)} % of the need to 2045 (more if built denser)`, 'one Special Plan for five municipalities (art. 4.28)'], 'Our reading — gains: developers, the five towns (a centre, land for services), the Junta. Loses: Defence (it must move); the open field itself.',
        [{ sw: RED, label: 'Housing blocks (schematic)' }, { sw: a.grey[3], label: 'Facilities, services (schematic)' }, { hatch: a.grey[4], dir: 1, label: 'Park on the runway (schematic)' }, { line: INK, wk: 2, dash: true, label: 'Former base' }]]];
    let yText = 0;
    for (let i = 0; i < 3; i++) { const [ttl, who, pos, desc, nums, wl, key] = F3[i]; const px = x0 + i * (pw + gx), py = y0; const P = win(px, py, pw, ph, DEN, cxC, cyC); const V = P.view; const ctx0 = { t, k: k17, view: V, noScale: true, noNorth: true };
      if (i === 0) ground(x, P, k17, { noTowns: false, over: () => { cells(P, neutral, 0.9); x.save(); path(x, P, band.g, true); x.clip('evenodd'); cells(P, next, 0.85); x.restore(); voidBase(P);
        D0.edge.filter(f => f.p.k === 'deadend').forEach(f => { const q = Array.isArray(f.g[0]) ? f.g[0][0] : f.g; const r = mm(1.5); x.beginPath(); x.arc(P.X(q[0]), P.Y(q[1]), r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = INK; x.lineWidth = r * 0.45; x.stroke(); x.beginPath(); x.moveTo(P.X(q[0]) - r * 0.55, P.Y(q[1])); x.lineTo(P.X(q[0]) + r * 0.55, P.Y(q[1])); x.stroke(); }); } });
      if (i === 1) GA.ex21.drawStrategy(x, P.ox, P.oy, P.full, P.fullH, Object.assign({}, ctx0, { noScenario: true, noOpenLand: true, noMuni: true, over: () => { cells(P, neutral, 0.9); voidBase(P); } }));
      if (i === 2) { const stn = D0.metro.find(f => f.p.k === 'station_now');
        ground(x, P, k17, { noTowns: false, noBaseLabel: true, avoid: stn ? [[P.X(stn.g[0]) - mm(7), P.Y(stn.g[1]) - mm(7), P.X(stn.g[0]) + mm(7), P.Y(stn.g[1]) + mm(7)]] : [], over: () => { cells(P, neutral, 0.9);
          path(x, P, baseRings, true); x.fillStyle = '#FFFFFF'; x.fill('evenodd'); x.strokeStyle = '#FFFFFF'; x.lineWidth = a.fence.w * k17 * 1.6; x.stroke();
          x.save(); path(x, P, baseRings, true); x.clip('evenodd');
          const R = D0.runway, ang = Math.atan2(R[1][1] - R[0][1], R[1][0] - R[0][0]); const ca = Math.cos(ang), sa = Math.sin(ang); const mid = [(R[0][0] + R[1][0]) / 2, (R[0][1] + R[1][1]) / 2]; const at = (p, q) => [mid[0] + p * ca - q * sa, mid[1] + p * sa + q * ca];
          const quad = (q4) => { x.beginPath(); q4.forEach((p2, k2) => k2 ? x.lineTo(P.X(p2[0]), P.Y(p2[1])) : x.moveTo(P.X(p2[0]), P.Y(p2[1]))); x.closePath(); };
          for (let u = -2400; u <= 2400; u += 120) for (let v = -2400; v <= 2400; v += 120) { if (v + 95 > -120 && v < 120) continue; const ui = Math.round((u + 2400) / 120), vi = Math.round((v + 2400) / 120);
            quad([at(u, v), at(u + 95, v), at(u + 95, v + 95), at(u, v + 95)]); x.fillStyle = (ui * 7 + vi * 3) % 6 === 0 ? a.grey[3] : RED; x.fill(); }
          quad([at(-2600, -120), at(2600, -120), at(2600, 120), at(-2600, 120)]); x.fillStyle = '#FFFFFF'; x.fill(); quad([at(-2600, -120), at(2600, -120), at(2600, 120), at(-2600, 120)]); GA.ex21.anHatch(x, V, a.grey[4], mm(1.2), mm(0.25), 1);
          const T = {}; D0.edge.filter(f => f.p.k === 'town').forEach(f => T[f.p.nm] = f.g); x.lineCap = 'round';
          [['Churriana de la Vega', 'Alhendín'], ['Las Gabias', 'Ogíjares'], ['Armilla', 'Las Gabias']].forEach(([p, q]) => { if (!T[p] || !T[q]) return; x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(2.2); x.beginPath(); x.moveTo(P.X(T[p][0]), P.Y(T[p][1])); x.lineTo(P.X(T[q][0]), P.Y(T[q][1])); x.stroke(); x.strokeStyle = a.grey[4]; x.lineWidth = mm(0.35); x.stroke(); });
          x.restore(); path(x, P, baseRings, true); x.strokeStyle = INK; x.lineWidth = mm(0.5); x.setLineDash([mm(1.6), mm(1)]); x.stroke(); x.setLineDash([]); metro(x, P, mm(0.45));
          if (stn) { const sx0 = P.X(stn.g[0]), sy0 = P.Y(stn.g[1]); x.beginPath(); x.arc(sx0, sy0, mm(5.5), 0, 7); x.strokeStyle = RED; x.lineWidth = mm(0.7); x.stroke(); AN.plate(x, 'centre at the metro (schematic)', sx0 - mm(28), sy0 - mm(1), 3, 700, RED); } } }); }
      AN.frame(x, V); AN.scale(x, V, P.s, 1000, { scale: '1:15,000' });
      let y = py + ph + mm(22 * AN.u); y = AN.key(x, key, px, y, { cols: 2, colW: pwm / 2, kk: mm(0.25) }) + mm(4);
      AN.spaced(x, ttl, px, y, 4.2, 700, INK, 0.5); y += mm(6); AN.txt(x, who, px, y, 3, 600, GR); y += mm(6.5);
      y = AN.para(x, pos, px, y, pwm, 3.3, 600, INK, 4.5) + mm(1.5); y = AN.para(x, desc, px, y, pwm, 3, 400, INK, 4.2) + mm(2.5);
      nums.forEach(nl => { x.fillStyle = INK; x.fillRect(px, y - mm(2.3), mm(1.8), mm(1.8)); y = AN.para(x, nl, px + mm(4.5), y, pwm - 5, 3.1, 600, INK, 4.2); });
      y += mm(2); y = AN.para(x, wl, px, y, pwm, 2.9, 500, GR, 4); yText = Math.max(yText, y); }
    // ---- where the three collide ----
    let y = yText + mm(9); AN.txt(x, '+ WHERE THE THREE COLLIDE — THE SAME QUESTION, THREE ANSWERS', x0, y, 3.4, 700, INK); y += mm(4);
    const cx3 = (i) => x0 + i * (pw + gx); const rule = (yy, col, wd) => { x.strokeStyle = col || a.grey[3]; x.lineWidth = mm(wd || 0.2); x.beginPath(); x.moveTo(x0, yy); x.lineTo(x0 + 3 * pw + 2 * gx, yy); x.stroke(); };
    const rows = [['The fence line (8.7 km)', 'stays a wall', 'a public walking strip runs along its outside', 'removed'],
      ['Open land within 300 m of the fence', 'built up as the towns grow', 'the strip and the corridor stay public; the rest can still be built', 'no longer an edge: it faces the new centre'],
      ['The base land (3.71 km²)', 'military', 'military', 'housing, facilities and services (POTAUG 4.27)'],
      ['Height limits around the base (RD 118/2019)', 'stay', 'stay — the corridor uses the land they keep low', 'go with the base'],
      [`Dwellings to 2045 (~${S0.dwellings_needed_2045.toLocaleString('en-US')} needed)`, 'all outside the base', 'all outside the base', `~${S0.base_dwellings_at_town_density.toLocaleString('en-US')} on the base at today’s density (${Math.round(S0.base_dwellings_at_town_density / S0.dwellings_needed_2045 * 100)} %)`],
      ['Who must agree', 'no one — it is today’s situation', 'Defence (security at the fence), the five towns, the owners of the edge land', 'the State, the Junta and the five towns, through one Special Plan']];
    rule(y, INK, 0.3);
    rows.forEach(([lab, p, q, r2]) => { y += mm(5); AN.txt(x, lab, x0, y, 2.8, 700, GR); const yy = y + mm(5.2); let ym = yy;
      [p, q, r2].forEach((s0, i) => { AN.txt(x, 'ABC'[i], cx3(i), yy, 3.1, 700, INK); ym = Math.max(ym, AN.para(x, s0, cx3(i) + mm(5), yy, pwm - 6, 3.1, 500, INK, 4.2)); }); y = ym - mm(2.4); rule(y); });
    y += mm(8); ['A ↔ B   May people walk along the fence?', 'B ↔ C   An edge to open, or a centre to build?', 'A ↔ C   Does the State leave at all?'].forEach((q0, i) => AN.txt(x, q0, cx3(i), y, 3.6, 700, INK));
    AN.src(x, W, H, 'Scenarios, not forecasts. Sources: POTAUG, Decreto 244/1999, Normativa art. 4.27–4.30 · RD 118/2019 · Diputación de Granada (press, April 2024) · INE padrón 2015–2025 (pace continued to 2045: ' + S0.pop_2025.toLocaleString('en-US') + ' → ~' + S0.pop_2045.toLocaleString('en-US') + ' residents; ' + S0.persons_per_dwelling + ' persons per dwelling) · D. G. del Catastro (the towns’ median density; open land = 100 m cells under 3 % built beside built cells) · OpenStreetMap (ODbL). Which open land may legally be built is not mapped here (the POTAUG protects parts of the Vega). Future C’s blocks, streets, park and centre are schematic.' + STYLE);
    return c.toDataURL('image/png'); }

  // ======================= 5 · THE FIVE TOWNS' FUTURE PLANS (owner, 20 Nov 2026) =======================
  // What each municipality's own plan says, as far as public sources show (web search, 20 Nov 2026; the plan documents themselves could
  // not be opened from here). The sectors' outlines are NOT drawn: no plan map was read. A red dot marks only the town that plans the
  // growth, at the place the press describes (approximate), never a sector's shape.
  if (which === 'five_plans') { AN.u = 1; const [c, x] = AN.sheet(594, 420); const W = c.width, H = c.height; const k = 1.5 * DPI / 200;
    AN.head(x, W, { title: 'THE FIVE TOWNS’ FUTURE PLANS', sub: 'What each municipality’s own general plan says about growth — status, numbers and where, as public sources report them (20 Nov 2026)', code: SERIES + ' · 1:20,000', num: '05 / 05' });
    const bx = mm(30), by = mm(46), bw = mm(320), bh = mm(280); const P = win(bx, by, bw, bh, 20000, E.x0 + 3200, E.y1 - 2800); const V = P.view;
    ground(x, P, k, { over: () => { muniLines(x, P, mm(0.45)); metro(x, P, mm(0.5)); } });
    const town = (nm) => (D0.edge.find(f => f.p.k === 'town' && f.p.nm === nm) || {}).g;
    // a point inside the municipality and inside the window, nearest to a target
    const inside = (nm, tgt) => { const rings = PO.muni[nm].flat(); let best = null, bd = 1e18; for (let gy = V[1] + mm(8); gy < V[3] - mm(8); gy += mm(2)) for (let gx = V[0] + mm(8); gx < V[2] - mm(8); gx += mm(2)) { const u = P.U(gx), v = P.V(gy); if (!inR(rings, u, v) || inR(baseRings, u, v)) continue; const d = (u - tgt[0]) ** 2 + (v - tgt[1]) ** 2; if (d < bd) { bd = d; best = [gx, gy]; } } return best; };
    const track = D0.metro.filter(f => f.p.k === 'track').flatMap(f => f.g.flat()); const lg = town('Las Gabias'); const onTrack = track.reduce((p, q) => (Math.hypot(q[0] - lg[0], q[1] - lg[1]) < Math.hypot(p[0] - lg[0], p[1] - lg[1]) ? q : p));
    const ar = town('Armilla');
    const T = [
      ['Ogíjares', town('Ogíjares'), 'NEW PLAN (PGOM) IN PROGRESS', 'Second initial approval on 20 April 2026 (BOJA 18 May 2026); not yet final.', 'Aims at 35,000–40,000 residents “in a couple of decades” (about 15,000 today); almost 600,000 m² of residential land. An earlier version counted 527 protected + 1,200 free dwellings. It also proposes a route for the metro.', 'Where: not found (no plan map read).'],
      ['Armilla', [ar[0], ar[1] - 700], 'PGOU CORRECTION, AWAITING THE JUNTA', 'Approved by the council about 2022–23; final approval belongs to the Junta (not found whether it was given).', '+853 dwellings in the whole municipality, 258 of them protected (30 %). Its only land for new housing and services: sector PP-Armilla Este, about 185,000 m².', 'Where: “in the south of the municipality” — next to the base’s north-east corner (press; dot approximate).'],
      ['Las Gabias', onTrack, 'STILL ON 1987 RULES; NEW PLAN COMMISSIONED', 'Planning rules of 1987 (adapted to the LOUA); a new PGOM contracted in 2025, about 36 months of work.', 'Growth now: more than 130,000 m² of building land next to the metro extension; sector PP-1 “Híjar” 102,604 m².', 'Where: along the metro extension (press; dot approximate).'],
      ['Alhendín', town('Alhendín'), 'PGOU OF 2004–05, AMENDED', 'An amendment re-drawing sectors SUB-07 and API S-10 (decided 2010, published in BOJA, March 2026).', 'No dwelling numbers found.', 'Where: not found.'],
      ['Churriana de la Vega', town('Churriana de la Vega'), 'PGOU OF 2013 (CORRECTED 2015)', 'Approved by the provincial commission on 5 March 2013, correction approved 13 May 2015 (BOJA 2015/148). A small change in 2024 (a school).', 'The plan’s land for growth and its percentage are in the plan’s report — not read. Its approval repeats that the base land is the concerted zone of the POTAUG, to be dismantled for housing, facilities and services.', 'Where: not found.']];
    // numbered marks: red = the plan adds growth that a source quantifies; a black ring = plan found, its growth not found
    const GROW = { 'Ogíjares': true, 'Armilla': true, 'Las Gabias': true };
    const dots = T.map(([nm, tgt]) => inside(nm, tgt)); const tg = {}; T.forEach(([nm], i) => { if (dots[i]) tg[nm] = [P.U(dots[i][0]), P.V(dots[i][1]) - 450]; }); clipV(x, V);
    const boxes = dots.filter(Boolean).map(d => [d[0] - mm(4), d[1] - mm(4), d[0] + mm(4), d[1] + mm(4)]); muniNames(x, P, 3, boxes, null, tg); x.restore();
    dots.forEach((d, i) => { if (!d) return; const g = GROW[T[i][0]]; x.beginPath(); x.arc(d[0], d[1], mm(3), 0, 7); x.fillStyle = g ? RED : '#FFFFFF'; x.fill(); x.strokeStyle = g ? '#FFFFFF' : INK; x.lineWidth = mm(g ? 0.5 : 0.45); x.stroke();
      AN.txt(x, String(i + 1), d[0], d[1] + mm(1.15), 3.1, 700, g ? '#FFFFFF' : INK, 'center'); });
    // the cards, right column, numbered as the marks
    const rx = bx + bw + mm(24), rw = (W - rx) / D - 22; let y = mm(54);
    T.forEach(([nm, tgt, status, when, what, where], i) => { const y0 = y, g = GROW[nm]; x.beginPath(); x.arc(rx - mm(5), y0 - mm(1.1), mm(2.2), 0, 7); x.fillStyle = g ? RED : '#FFFFFF'; x.fill(); x.strokeStyle = g ? RED : INK; x.lineWidth = mm(0.35); x.stroke(); AN.txt(x, String(i + 1), rx - mm(5), y0 - mm(0.2), 2.4, 700, g ? '#FFFFFF' : INK, 'center');
      AN.spaced(x, nm.toUpperCase(), rx, y0, 3, 700, INK, 0.45); y += mm(4.6);
      AN.txt(x, status, rx, y, 2.5, 700, g ? RED : INK); y += mm(4.4); y = AN.para(x, when, rx, y, rw, 2.5, 400, GR, 3.4); y = AN.para(x, what, rx, y, rw, 2.6, 500, INK, 3.5); y = AN.para(x, where, rx, y, rw, 2.4, 400, GR, 3.3) + mm(5.5); });
    AN.frame(x, V); let ys = AN.scale(x, V, P.s, 1000, { scale: '1:20,000' }) + mm(6);
    ys = AN.key(x, [{ base: 'context', label: 'The base (POTAUG concerted zone)' }, { fence: true, label: 'Fence (OSM outline)' }, { line: INK, wk: 1.8, dk: [11.5, 4, 1.8, 4], label: 'Municipal boundary (Catastro)' }, { line: INK, wk: 2, label: 'Metro line 1 · extension dotted (OSM)' }], bx, ys, { cols: 2, colW: 160, kk: mm(0.25) });
    x.beginPath(); x.arc(bx + mm(5), ys + mm(1), mm(1.8), 0, 7); x.fillStyle = RED; x.fill(); AN.txt(x, 'A town whose plan adds growth that a source puts in numbers — at the place the press describes, approximate', bx + mm(13), ys + mm(1.9), 2.5, 500, INK);
    ys += mm(5.4); x.beginPath(); x.arc(bx + mm(5), ys + mm(1), mm(1.8), 0, 7); x.fillStyle = '#FFFFFF'; x.fill(); x.strokeStyle = INK; x.lineWidth = mm(0.35); x.stroke(); AN.txt(x, 'A town whose plan was found but its growth was not (missing, not zero) · numbers = the cards · sector outlines are not drawn: no plan map was read', bx + mm(13), ys + mm(1.9), 2.5, 500, INK);
    y = Math.max(y, mm(46)); y = AN.note(x, rx, y + mm(2), rw, 'WHAT IT MEANS FOR THE BASE', 'No town plans to build on the base: its land is the POTAUG’s concerted zone, outside each town’s own plan. The planned growth sits at its edges — south of Armilla, along the metro in Las Gabias, and a town of twice its size in Ogíjares. Only Ogíjares and Las Gabias are writing new plans now.', INK);
    AN.src(x, W, H, 'Sources (read through a web search, 20 Nov 2026 — the plan documents could not be opened from here, so numbers are as the press and the official bulletin report them): BOJA 2015/148/74 (PGOU Churriana de la Vega); BOJA 2023/162/33 (revision of the PGOU of Armilla); BOJA 2026/43/80 (Alhendín SUB-07 / API S-10); BOJA 2026/93/56 (Ogíjares PGOM, second initial approval); Ahora Granada, Granada Digital, Granada es Noticia, COPE (2022–2025); Las Gabias, adaptación parcial a la LOUA (2023). Municipal outlines: D. G. del Catastro; ground and metro: OpenStreetMap (ODbL).' + STYLE);
    return c.toDataURL('image/png'); }
  throw new Error('unknown sheet ' + which); }'''
try:
  with sync_playwright() as p:
    b, pg, errs = launch(p, PORT)
    n = {'who_decides': '01', 'who_holds': '02', 'over_time': '03', 'three_futures': '04', 'five_plans': '05'}
    for w in ONLY:
      save(pg.evaluate(JS, [w, DPI]), os.path.join(OUTD, f'an_policy_{n[w]}_{w}.png')); print(w, 'ok', flush=True)
    print('errors:', errs[:5])
finally: srv.terminate()
