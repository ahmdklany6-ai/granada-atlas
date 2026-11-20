"""Exercise 2.1 — TWO A1 sheets (owner, 17 Nov 2026): sheet 1 = the four maps (1931, 2022, built by age, mean age) at 1:15,000 (the whole base and the towns fit; 1:10,000 cut them); sheet 2 = the city map + the four 1:500 areas with sections.
Older notes: the A1 sheet (841 × 594 mm, landscape), Hebrew by default (owner, 16 Nov 2026), Arabic copy.
City level: the base and its fence at TRUE 1:10,000 (cropped to the base), the four 1:500 windows marked; area level: four
1:500 windows (B tallest blocks, S sports centre, R river, C road with the lowest ceiling), each cropped to 70 × 70 m around
its section, with the section at 1:500; side column: 1931 map vs 2022 photo, built-up by age, mean age; the texts.
Needs: exports/ex21_sec/section_<id>.svg (STYLE=detail), exports/ex21_time/hist/{mtn50,pnoa2022}.jpg.
Env STYLE=analysis (owner, 20 Nov 2026; English only; default 'soft' = the identity style, unchanged): the same two sheets, the
analysis maps on them (sheet 1: the four maps; sheet 2: the city map) drawn after GA.ex21.setStyle('analysis') — black, greys
and white with ONE red per map (1931 and 2022 printed in grey under today's black-and-white fence: no red; built-up by year:
grey before 2000, red since; mean age: a ramp of the red; the city map: the base is the red thing, the four 1:500 windows are
black outlines with their letters). The four 1:500 areas and their sections keep the identity style. Keys by AN.swatch, the
title block and the corner marks from tools/ex21_pages/_analysis.py.
Usage: python3 tools/ex21_pages/sheets2.py <out folder> [he|ar|en]   (env DPI, default 150)"""
import sys, time, base64, subprocess, os, json
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'he'; PORT = 8858; V3.PORT = PORT; V3.V2.PORT = PORT
IDS = ['B', 'S', 'R', 'C']
STYLE = os.environ.get('STYLE', 'soft')   # 'soft' = the identity style (as always) · 'analysis' = black, greys and one red per map
if STYLE == 'analysis' and LANG != 'en': sys.exit('STYLE=analysis is English only (the exercise deliverables are English)')
def md(path):  # the three texts from the markdown file of that language
    s = open(path, encoding='utf-8').read(); parts = s.split('\n## ')
    return {'title': s.split('\n')[0].lstrip('# ').strip(), 'phen': parts[1].split('\n', 1)[1].strip(), 'text': parts[2].split('\n', 1)[1].strip(), 'strat': parts[3].split('\n', 1)[1].split('\n---')[0].strip(),
            'h': [p.split('\n', 1)[0].strip() for p in parts[1:4]], 'src': s.split('\n---\n')[1].strip()}
TX = md(f'exports/ex21_text/text_{LANG}.md')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _sheet_labels import LABS; LAB = LABS[LANG]   # one definition, shared with maps_only.py
from _analysis import AN_JS
# STYLE=analysis: the whole sheet is drawn by this block (same boxes, in millimetres, as the identity sheet below it)
AN_SHEET = r'''{ __AN_JS__
    AN.u = 1.4; const INK = AN.INK, GR = AN.GR, C = pal.ex21, k15 = 1.8 * KS, k10 = 2.6 * KS; const tf = (k, fb) => { const s = t(k); return s === k ? fb : s; };
    const corners = (px, py, w, h) => [[px, py], [px + w, py], [px, py + h], [px + w, py + h]].forEach(([a, b]) => AN.plus(x, a, b, mm(2.6)));
    // a key as a line of swatches and labels that wraps inside wmm (a { text } item is a grey sentence without a swatch)
    const flowKey = (items, px, py, wmm, kk) => { const sz = 3.1, sw = mm(9), sh = mm(3.4), row = mm(5.6), gap = mm(7); let cx = px, cy = py; items.forEach(it => { const off = it.text ? 0 : sw + mm(2.2), w = off + AN.width(x, it.label, sz, 500);
      if (cx > px && cx + w > px + mm(wmm)) { cx = px; cy += row; } if (!it.text) AN.swatch(x, it, cx, cy, sw, sh, kk); AN.txt(x, it.label, cx + off, cy + mm(sz * 0.36), sz, it.text ? 400 : 500, it.text ? GR : INK); cx += w + gap; }); return cy + row; };
    const muni = { line: C.muni, wk: 1.1, dk: [6, 4], label: tf('x41.time.muni', 'Municipal boundary (IGN via es-atlas, simplified)') };
    const sub = (s) => { const q = s.replace(/^[^·]*·\s*/, ''); return q.charAt(0).toUpperCase() + q.slice(1); };
    AN.head(x, W, { title: TX.title.toUpperCase(), sub: sub(MODE === 'maps' ? LAB.sheetMaps : LAB.sheetAreas) + ' · ' + LAB.sub, code: 'EX 2.1 · SCALE · A1', num: MODE === 'maps' ? '01 / 02' : '02 / 02', left: M + 12.6, right: M, top: 22 });
    let foot = TX.src;
    if (MODE === 'maps') { const full15 = mm(6400 / 15), fullH15 = full15 * 5600 / 6400, cw2 = (841 - 2 * M - G) / 2, ch2 = (594 - top - M - 8 - G - 2 * 12) / 2;
      const hi = (n) => load('/exports/ex21_time/hist/' + n + '_hi.jpg').catch(() => load('/exports/ex21_time/hist/' + n + '.jpg')); const [m31, p22] = await Promise.all([hi('mtn50'), hi('pnoa2022')]);
      const fenceIt = { fence: true, label: 'The base fence today (OSM), drawn over the picture' }, PD = GA.ex21.people;
      [[m31, LAB.y1931, 'photo'], [p22, LAB.y2022, 'photo'], [null, LAB.built, 'built'], [null, LAB.age, 'age']].forEach(([im, lb, kind], j) => { const cc = j % 2, r = Math.floor(j / 2), px = mm(M + cc * (cw2 + G)), py = mm(top + r * (ch2 + 12 + G));
        cityBox(px, py, mm(cw2), mm(ch2), full15, (ox, oy, view) => { const o = { t, k: k15, view, title: lb + ' · 1:15,000', titlePx: mm(4.6) };
          if (kind === 'age') GA.ex21.drawPeople(x, ox, oy, full15, fullH15, Object.assign(o, { only: 'age' })); else GA.ex21.drawTime(x, ox, oy, full15, fullH15, Object.assign(o, { only: kind, photo: im })); }); corners(px, py, mm(cw2), mm(ch2));
        const keys = kind === 'built' ? GA.ex21.timeLegend('built', t)
          : kind === 'age' ? GA.ex21.peopleLegend('age', t).map((q, i) => i === 0 ? Object.assign({}, q, { label: t('x37.m.age') + ': ' + q.label }) : q).concat(PD.sections.some(s0 => s0.age == null) ? [{ hatch: pal.tour.missing, dir: 1, label: 'No value published' }] : [],
              [{ sw: INK, alpha: 0.22, label: t('x34.lg.built') + ', printed over the class colour' }, { line: GR, wk: 1.1, dk: [6, 4], label: muni.label }, GA.ex21.baseItem(t, false)])
          : [fenceIt, { text: true, label: (j === 0 ? 'IGN · MTN50, 1931 (CC BY 4.0)' : 'PNOA © IGN, 2022 (CC BY 4.0)') + ' · printed in grey, town names added' }];
        flowKey(keys, px, py + mm(ch2 + 4.2), cw2, k15 * 0.8); });
      foot += ' Printed in black, greys and one red per map; the 1931 map and the 2022 photo are printed in grey (nothing in a picture is edited).';
    } else { const cw = 300, chh = 380, cX = mm(M), cY = mm(top + 2);
      // the city map: the base is its one red, so each 1:500 window is a black outline (white under it) with its letter on a black disc beside it,
      // on the side away from the base; the town names keep clear of both (drawCity o.tidy, o.obst)
      cityBox(cX, cY, mm(cw), mm(chh), full, (ox, oy, view) => { const XX = (u) => ox + (u - E.x0) / 6400 * full, YY = (v) => oy + (E.y1 - v) / 6400 * full;
        const A = GA.ex21.areas.areas.filter(a => IDS.includes(a.id)).map(a => { const e = a.extent, wx = XX(e[0]), wy = YY(e[3]), ww = XX(e[2]) - wx, wh = YY(e[1]) - wy, up = (e[1] + e[3]) / 2 > CY; return { id: a.id, wx, wy, ww, wh, bx: wx + ww / 2, by: up ? wy - mm(6) : wy + wh + mm(6) }; });
        const boxes = []; A.forEach(a => { boxes.push([a.wx - mm(1.5), a.wy - mm(1.5), a.wx + a.ww + mm(1.5), a.wy + a.wh + mm(1.5)], [a.bx - mm(5), a.by - mm(5), a.bx + mm(5), a.by + mm(5)]); });
        GA.ex21.drawCity(x, ox, oy, full, fullH, { t, only: 'island', k: k10, view, title: LAB.city, titlePx: mm(4.4), tidy: true, obst: { boxes } }); x.setLineDash([]); x.lineJoin = 'miter';
        A.forEach(a => { x.strokeStyle = '#FFFFFF'; x.lineWidth = mm(1.4); x.strokeRect(a.wx, a.wy, a.ww, a.wh); x.strokeStyle = INK; x.lineWidth = mm(0.6); x.strokeRect(a.wx, a.wy, a.ww, a.wh);
          x.beginPath(); x.arc(a.bx, a.by, mm(4.1), 0, 7); x.fillStyle = '#FFFFFF'; x.fill(); x.beginPath(); x.arc(a.bx, a.by, mm(3.6), 0, 7); x.fillStyle = INK; x.fill();
          x.fillStyle = '#FFFFFF'; x.font = font(4.2, 700); x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.fillText(a.id, a.bx, a.by + mm(0.2)); }); }); corners(cX, cY, mm(cw), mm(chh));
      // the keys under the city map: the city map's own (analysis vocabulary) at the left, the 1:500 plans' (identity colours, as the plans) at the right
      const cityItems = GA.ex21.mapLegend('island', t).concat([{ sw: '#FFFFFF', stroke: INK, label: t('x34.lg.window') }, { sw: C.built, label: t('x34.lg.built') }, { line: C.street, wk: 0.9, label: t('x40.lg.roads') }, muni,
        { line: C.runway, wk: 1.2, dk: [10, 6], label: 'Runway axis, between its two thresholds (RD 118/2019, art. 3)' }]);
      GA.ex21.setStyle(null); const areaItems = GA.ex21.areaLegend(t).filter(it => !/3\.71|3,71/.test(it.label)).slice(0, 14); GA.ex21.setStyle('analysis');
      const ly = top + 2 + chh + 10, lh = Math.min(7.4, (594 - M - 8 - ly - 8) / Math.max(cityItems.length, areaItems.length)), colW = cw / 2;
      AN.txt(x, '+ ' + LAB.lgCity.toUpperCase() + ' · 1:10,000', cX, mm(ly), 3.3, 700, INK); AN.txt(x, '+ ' + LAB.lgArea.toUpperCase() + ' · 1:500', cX + mm(colW), mm(ly), 3.3, 700, INK);
      AN.key(x, cityItems, cX, mm(ly + 8), { cols: 1, colW: colW, row: lh, sz: 3.3, sw: 9, sh: 3.6, kk: k10 * 0.8, maxW: colW - 16 }); drawLeg(areaItems, cX + mm(colW), colW, ly + 8, lh, 1, 3.3);
      // the four areas and their sections: the identity style (plans and sections keep it)
      const aw0 = 841 - M - cw - G - M, aX0 = M + cw + G, cellW = (aw0 - G) / 2, cellH = (594 - top - M - 8 - G) / 2, secH = 74, mapH = cellH - secH - 3;
      const secImgs = await Promise.all(IDS.map(id => load('/exports/ex21_sec/section_' + id + '.svg?r=' + Date.now())));
      const gy = await Promise.all(IDS.map(async id => { const sv = await (await fetch('/exports/ex21_sec/section_' + id + '.svg?r=' + Date.now())).text(); const m = sv.match(/id="ground-cut-[^"]*"><polygon points="([^"]+)"/);
        const pts = m[1].trim().split(' ').map(q => q.split(',').map(Number)); const fx = 10 + 2 * 95; let best = pts[0]; pts.forEach(q => { if (Math.abs(q[0] - fx) < Math.abs(best[0] - fx)) best = q; }); return best[1]; }));
      IDS.forEach((id, i) => { const A = GA.ex21.areas.areas.find(a => a.id === id); const cc = i % 2, rr = Math.floor(i / 2); const px = mm(aX0 + cc * (cellW + G)), py = mm(top + 2 + rr * (cellH + G));
        const s0 = A.section, L = s0.samples.length - 1, d = 80; const P = [s0.a[0] + (s0.b[0] - s0.a[0]) * d / L, s0.a[1] + (s0.b[1] - s0.a[1]) * d / L];
        const e = A.extent, hw = cellW / 4, hh = mapH / 4; const c0 = [Math.min(Math.max(P[0], e[0] + hw), e[2] - hw), Math.min(Math.max(P[1], e[1] + hh), e[3] - hh)]; const s2 = mm(2);
        GA.ex21.setStyle(null); GA.ex21.drawArea(x, px + mm(cellW) / 2 - (c0[0] - e[0]) * s2, py + mm(mapH) / 2 - (e[3] - c0[1]) * s2, 130 * s2, id, { t, k: 1.55 * KS, view: [px, py, px + mm(cellW), py + mm(mapH)], title: t('x34.a.' + id) + ' · 1:500', titlePx: mm(3.6) }); GA.ex21.setStyle('analysis');
        frame(px, py, mm(cellW), mm(mapH)); corners(px, py, mm(cellW), mm(mapH));
        const im = secImgs[i], swmm = im.naturalWidth / (96 / 25.4), shmm = im.naturalHeight / (96 / 25.4); const sy0 = py + mm(mapH + 3); const dEnd = Math.min(L, 95 + 22), dStart = dEnd - cellW / 2; const base = sy0 + mm(secH - 10);
        x.save(); x.beginPath(); x.rect(px, sy0, mm(cellW), mm(secH)); x.clip(); x.drawImage(im, px - mm(10 + 2 * dStart), base - mm(gy[i]), mm(swmm), mm(shmm)); x.restore(); });
      foot += ' The city map is printed in black, greys and one red (the base); the 1:500 plans and their sections keep the studio colours.';
    }
    AN.txt(x, '+ ' + foot, mm(M), H - mm(6), 3.1, 400, GR, 'left', W - mm(2 * M));
    return c.toDataURL('image/png'); }'''
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([IDS, TX, LAB, MODE]) => { await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); await GA.ex21.readyPeople();
  const DPI = __DPI__, KS = DPI / 150, D = DPI / 25.4, mm = (v) => v * D; const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl'; const pal = GA.palette;
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });
  const W = Math.round(mm(841)), H = Math.round(mm(594)); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const M = 14, G = 8; const X0 = (s0, w) => rtl ? W - mm(s0 + w) : mm(s0); const sx = (px, w) => rtl ? px + w : px;
  const font = (sz, wt) => `${wt} ${Math.round(mm(sz))}px ${F}`;
  const txt = (s, px, py, sz, wt, col, al, maxW) => { x.font = font(sz, wt); x.fillStyle = col; x.textAlign = al || (rtl ? 'right' : 'left'); x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(s, px, py, maxW); };
  const wrap = (s, maxW) => { const out = []; s.split('\n').forEach(par => { let line = ''; par.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); out.push(line); }); return out; };
  const frame = (px, py, w, h) => { x.strokeStyle = pal.ink; x.lineWidth = mm(0.3); x.strokeRect(px, py, w, h); };
  const rule = (y) => { x.strokeStyle = pal.line2; x.lineWidth = mm(0.25); x.beginPath(); x.moveTo(mm(M), y); x.lineTo(W - mm(M), y); x.stroke(); };
  // ---- title band ----

  const top = 44, G2 = G;
  // the city frame at TRUE 1:10,000 (640 × 560 mm), cropped to a box centred on the base
  const E = GA.ex21.CITY, full = mm(640), fullH = full * 5600 / 6400, CX = 442830, CY = 4109470;
  // keep the crop inside the data frame (6400 × 5600 m), so no blank strip at a map's side (owner, Map Studio 17 Nov 2026)
  const clampC = (bw, bh, fullPx) => { const hwM = bw / fullPx * 6400 / 2, hhM = bh / fullPx * 6400 / 2; return [Math.min(Math.max(CX, E.x0 + hwM), E.x0 + 6400 - hwM), Math.min(Math.max(CY, E.y1 - 5600 + hhM), E.y1 - hhM)]; };
  // a window on the city frame: draw(ox, oy, view) gets the frame's origin and the visible window; the map itself writes its title
  // (grey, on the map), its north arrow and its scale bar on that window (GA.ex21: o.view, o.title)
  const cityBox = (bx, by, bw, bh, fullPx, draw) => { const [cx0, cy0] = clampC(bw, bh, fullPx); const ox = bx + bw / 2 - (cx0 - E.x0) / 6400 * fullPx, oy = by + bh / 2 - (E.y1 - cy0) / 6400 * fullPx; x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip(); draw(ox, oy, [bx, by, bx + bw, by + bh]); x.restore(); frame(bx, by, bw, bh); };
  const drawLeg = (legItems, lX, lw, ytop, lh, lcols, fs) => { const lcw = lw / lcols, lrows = Math.ceil(legItems.length / lcols);
    legItems.forEach((it, j) => { const col = Math.floor(j / lrows), row = j % lrows; const bx = rtl ? lX + mm(lw) - (col + 1) * mm(lcw) : lX + col * mm(lcw); const yy = mm(ytop + row * lh); const sw0 = rtl ? bx + mm(lcw - 9) : bx;
    if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sw0, yy - mm(1.8), mm(9), mm(3.6)); x.globalAlpha = 1; x.strokeStyle = it.stroke || '#8C817A'; x.lineWidth = mm(0.22); x.setLineDash(it.dashed ? [mm(1), mm(0.7)] : []); x.strokeRect(sw0, yy - mm(1.8), mm(9), mm(3.6)); x.setLineDash([]); }
    if (it.hatch) { x.strokeStyle = it.hatch; x.lineWidth = mm(0.2); x.strokeRect(sw0, yy - mm(1.8), mm(9), mm(3.6)); for (let q = 0; q < 9; q += 1.6) { x.beginPath(); x.moveTo(sw0 + mm(q), yy + mm(1.8)); x.lineTo(sw0 + mm(Math.min(9, q + 3.6)), yy - mm(1.8)); x.stroke(); } }
    if (it.sym === 'dead') { x.beginPath(); x.arc(sw0 + mm(4.5), yy, mm(1.5), 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.line; x.lineWidth = mm(0.4); x.stroke(); x.beginPath(); x.moveTo(sw0 + mm(3.6), yy); x.lineTo(sw0 + mm(5.4), yy); x.stroke(); }
    else if (it.line) { x.strokeStyle = it.line; x.lineWidth = mm(0.35 * (it.w || 1)); x.setLineDash(it.dash ? [mm(1.6), mm(0.9)] : []); x.beginPath(); x.moveTo(sw0, yy); x.lineTo(sw0 + mm(9), yy); x.stroke(); x.setLineDash([]); }
    txt(it.label, rtl ? sw0 - mm(2.5) : sw0 + mm(11.5), yy + mm(1.3), fs, 500, pal.ink, null, mm(lcw - 14)); });
 };
  __AN_SHEET__
  txt(TX.title, rtl ? W - mm(M) : mm(M), mm(28), 14, 600, pal.ink3); rule(mm(34));   // every title in grey (owner, Map Studio 17 Nov 2026)
  if (MODE === 'maps') {
    const full15 = mm(6400 / 15), fullH15 = full15 * 5600 / 6400;
    // four maps at 1:10,000, 2 × 2, each 398.5 × 236 mm (3.99 × 2.36 km), a key line under each
    const cw2 = (841 - 2 * M - G) / 2, ch2 = (594 - top - M - 8 - G - 2 * 12) / 2;
    const hi = (n) => load('/exports/ex21_time/hist/' + n + '_hi.jpg').catch(() => load('/exports/ex21_time/hist/' + n + '.jpg'));   // 1 m per pixel (tools/fetch_ex21_hist_hi.py) when it is there, else the 4 m picture
    const [m31, p22] = await Promise.all([hi('mtn50'), hi('pnoa2022')]);
    [[m31, LAB.y1931, 'photo'], [p22, LAB.y2022, 'photo'], [null, LAB.built, 'built'], [null, LAB.age, 'age']].forEach(([im, lb, kind], j) => { const cc = j % 2, r = Math.floor(j / 2);
      const px = X0(M + cc * (cw2 + G), cw2), py = mm(top + r * (ch2 + 12 + G));
      cityBox(px, py, mm(cw2), mm(ch2), full15, (ox, oy, view) => { const o = { t, k: 1.8 * KS, view, title: lb + ' · 1:15,000', titlePx: mm(4.6) };
        if (kind === 'age') GA.ex21.drawPeople(x, ox, oy, full15, fullH15, Object.assign(o, { only: 'age' })); else GA.ex21.drawTime(x, ox, oy, full15, fullH15, Object.assign(o, { only: kind, photo: im })); });
      const keys = kind === 'built' ? GA.ex21.time.periods.map(q => ({ sw: `rgb(${q[3].join(',')})`, label: t('x36.per.' + q[0]) })) : kind === 'age' ? GA.ex21.peopleLegend('age', t).map((q, i) => i === 0 ? Object.assign({}, q, { label: q.label }) : q) : null;
      if (keys) { const kw = mm(cw2) / keys.length; keys.forEach((k2, i) => { const qx = px + (rtl ? keys.length - 1 - i : i) * kw; x.globalAlpha = k2.alpha || 1; x.fillStyle = k2.sw; x.fillRect(qx, py + mm(ch2 + 2), kw - mm(1), mm(3.2)); x.globalAlpha = 1;
        x.font = font(3, 500); x.fillStyle = pal.ink2; x.textAlign = 'center'; x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(k2.label, qx + kw / 2, py + mm(ch2 + 10), kw - mm(2)); }); }
      else { x.font = font(3, 500); x.fillStyle = pal.ink3; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(kind === 'photo' && j === 0 ? 'IGN · MTN50, 1931 (CC BY 4.0)' : 'PNOA © IGN, 2022 (CC BY 4.0)', sx(px, mm(cw2)), py + mm(ch2 + 8)); } });
  } else {
    // city map 1:10,000 (start side) with its legend under it; the four areas 2 × 2 beside it
    const cw = 300, chh = 380, cX = X0(M, cw), cY = mm(top + 2);
    cityBox(cX, cY, mm(cw), mm(chh), full, (ox, oy, view) => { GA.ex21.drawCity(x, ox, oy, full, fullH, { t, only: 'island', k: 2.6 * KS, view, title: LAB.city, titlePx: mm(4.4) });
      const XX = (u) => ox + (u - E.x0) / 6400 * full, YY = (v) => oy + (E.y1 - v) / 6400 * full;
      GA.ex21.areas.areas.filter(a => IDS.includes(a.id)).forEach(a => { const e = a.extent; x.fillStyle = 'rgba(153,43,42,.18)'; x.fillRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3])); x.strokeStyle = pal.red; x.lineWidth = mm(0.7); x.strokeRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3]));
        const inner = (e[1] + e[3]) / 2 > CY ? 1 : -1; const bx = XX((e[0] + e[2]) / 2), by = inner > 0 ? YY(e[1]) + mm(6) : YY(e[3]) - mm(6);
        x.beginPath(); x.arc(bx, by, mm(4), 0, 7); x.fillStyle = pal.red; x.fill(); x.fillStyle = '#fff'; x.font = font(4.4, 700); x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.fillText(a.id, bx, by + mm(0.2)); }); });
    const legItems = GA.ex21.mapLegend('island', t).concat([{ sw: 'rgba(153,43,42,.18)', stroke: pal.red, label: t('x34.lg.window') }]).concat(GA.ex21.areaLegend(t).filter(it => !/3\.71|3,71/.test(it.label)).slice(0, 14));
    const ly = top + 2 + chh + 9; drawLeg(legItems, cX, cw, ly, Math.min(7.4, (594 - M - 8 - ly) / Math.ceil(legItems.length / 2)), 2, 3.3);
    // the four areas
    const aw0 = 841 - M - cw - G - M, aX0 = M + cw + G; const cellW = (aw0 - G) / 2, cellH = (594 - top - M - 8 - G) / 2, secH = 74, mapH = cellH - secH - 3;
  const secImgs = await Promise.all(IDS.map(id => load('/exports/ex21_sec/section_' + id + '.svg?r=' + Date.now())));
  const gy = await Promise.all(IDS.map(async id => { const sv = await (await fetch('/exports/ex21_sec/section_' + id + '.svg?r=' + Date.now())).text(); const m = sv.match(/id="ground-cut-[^"]*"><polygon points="([^"]+)"/);
    const pts = m[1].trim().split(' ').map(q => q.split(',').map(Number)); const fx = 10 + 2 * 95; let best = pts[0]; pts.forEach(q => { if (Math.abs(q[0] - fx) < Math.abs(best[0] - fx)) best = q; }); return best[1]; }));
  IDS.forEach((id, i) => { const A = GA.ex21.areas.areas.find(a => a.id === id); const cc = i % 2, rr = Math.floor(i / 2); const px = X0(aX0 + cc * (cellW + G), cellW), py = mm(top + 2 + rr * (cellH + G));
    const s0 = A.section, L = s0.samples.length - 1, d = 80; const P = [s0.a[0] + (s0.b[0] - s0.a[0]) * d / L, s0.a[1] + (s0.b[1] - s0.a[1]) * d / L];
    const e = A.extent, hw = cellW / 4, hh = mapH / 4; const c0 = [Math.min(Math.max(P[0], e[0] + hw), e[2] - hw), Math.min(Math.max(P[1], e[1] + hh), e[3] - hh)]; const s2 = mm(2);
    const my = py; GA.ex21.drawArea(x, px + mm(cellW) / 2 - (c0[0] - e[0]) * s2, my + mm(mapH) / 2 - (e[3] - c0[1]) * s2, 130 * s2, id, { t, k: 1.55 * KS, view: [px, my, px + mm(cellW), my + mm(mapH)], title: t('x34.a.' + id) + ' · 1:500', titlePx: mm(3.6) });
    frame(px, my, mm(cellW), mm(mapH));
    const im = secImgs[i], swmm = im.naturalWidth / (96 / 25.4), shmm = im.naturalHeight / (96 / 25.4); const sy0 = my + mm(mapH + 3);
    const dEnd = Math.min(L, 95 + 22), dStart = dEnd - cellW / 2; const base = sy0 + mm(secH - 10);
    x.save(); x.beginPath(); x.rect(px, sy0, mm(cellW), mm(secH)); x.clip(); x.drawImage(im, px - mm(10 + 2 * dStart), base - mm(gy[i]), mm(swmm), mm(shmm)); x.restore(); });

  }
  x.font = font(2.4, 400); x.fillStyle = pal.ink3; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(TX.src, rtl ? W - mm(M) : mm(M), H - mm(6), W - mm(2 * M));
  return c.toDataURL('image/png'); }'''
DPI = int(os.environ.get('DPI', 150)); JS = JS.replace('__DPI__', str(DPI)).replace('__AN_SHEET__', AN_SHEET.replace('__AN_JS__', AN_JS) if STYLE == 'analysis' else '')   # soft: the analysis block is left out
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/palette.js', 'js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawPeople)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    for MODE in ('maps', 'areas'):
      if STYLE == 'analysis': pg.evaluate("GA.ex21.setStyle('analysis')")
      d = pg.evaluate(JS, [IDS, TX, LAB, MODE]); open(os.path.join(OUTD, f'sheet_A1_{MODE}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(MODE, 'ok')
    print('errors:', errs[:5])
finally: srv.terminate()
