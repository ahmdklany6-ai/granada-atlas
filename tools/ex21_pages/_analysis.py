"""Exercises 2.1 / 2.2 — the ANALYSIS print style: the page furniture shared by the page scripts (owner, 20 Nov 2026).

The style itself (black, greys and white with ONE red per map) lives in js/palette.js (P.analysis) and js/ex21.js
(GA.ex21.setStyle('analysis'), anBase / anFence / anHatch / anGrain / anPhoto …). This module holds what a SHEET adds around
its maps, so every analysis sheet reads the same way:

  - a small title in spaced capitals at the top left, a "+" mark before it, one grey line under it;
  - the series and the sheet number at the top right ("EX 2.1 · CITY" / "02 / 06");
  - each map window with a thin frame and a "+" at its four corners; its scale bar, scale and north written small UNDER it;
  - the key as small rows of lines and swatches (the same *Legend() items the maps are drawn from);
  - notes as "+ HEADING" and a short paragraph; the sources small and grey at the foot.

Use: put AN_JS inside a page's evaluate() function AFTER `DPI` is defined and after GA.ex21.setStyle('analysis'):
    JS = "async ([m, DPI]) => { await GA.ex21.ready(); GA.ex21.setStyle('analysis'); " + AN_JS + " … }"
It defines `AN` (see the comments in the code). Sizes are in millimetres on the sheet; `u` (AN.u) scales the furniture for a
bigger sheet (1 = an A2 sheet read at arm's length, 1.4 = A1 and the 1:10,000 map pages).
Python side: launch(p, port) → (browser, page, errors) opens the atlas page with the 2.1 scripts loaded; save(d, path).
English only (owner, 20 Nov 2026: exercise deliverables are English; only the website is trilingual)."""
import base64, os, time

AN_JS = r'''
  const AN = (() => { const pal = GA.palette, A = GA.ex21.an, F = GA.pages.font(); if (!A) throw new Error('call GA.ex21.setStyle("analysis") first');
    const INK = pal.ink, GR = pal.ink3, RED = pal.red; const D = DPI / 25.4, mm = (v) => v * D; const S = { u: 1 };
    // ONE table of line weights for every analysis sheet (Tal, 22 Nov 2026: "the same line weights in all documents"): every big map is drawn
    // with K (the map line and label unit, px), every small multiple (the five dates, the ten pictures) with Ks — whatever the scale
    const K = 3.0 * DPI / 200, Ks = 2.0 * DPI / 200;
    const sheet = (wmm, hmm) => { const c = document.createElement('canvas'); c.width = Math.round(mm(wmm)); c.height = Math.round(mm(hmm)); const x = c.getContext('2d'); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c.width, c.height); x.lineJoin = 'round'; return [c, x]; };
    const font = (sz, wt) => `${wt || 500} ${Math.max(1, Math.round(mm(sz)))}px ${F}`;
    // one line of text; sizes in mm (not scaled by u: the caller decides)
    const txt = (x, s, px, py, sz, wt, col, al, maxW) => { x.save(); x.font = font(sz, wt); x.fillStyle = col || INK; x.textAlign = al || 'left'; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; if (maxW) x.fillText(s, px, py, maxW); else x.fillText(s, px, py); x.restore(); };
    const width = (x, s, sz, wt) => { x.save(); x.font = font(sz, wt); const w = x.measureText(s).width; x.restore(); return w; };
    // capitals with air between the letters (sp = extra space in mm); returns the x where the text ends
    const spaced = (x, s, px, py, sz, wt, col, sp) => { x.save(); x.font = font(sz, wt || 700); x.fillStyle = col || INK; x.textAlign = 'left'; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; let cx = px; const g = mm(sp == null ? sz * 0.17 : sp); [...s].forEach(ch => { x.fillText(ch, cx, py); cx += x.measureText(ch).width + g; }); x.restore(); return cx - g; };
    const spacedW = (x, s, sz, wt, sp) => { x.save(); x.font = font(sz, wt || 700); const g = mm(sp == null ? sz * 0.17 : sp); let w = 0; [...s].forEach(ch => { w += x.measureText(ch).width + g; }); x.restore(); return w - g; };
    // a paragraph wrapped to wmm; returns the y of the next line
    const para = (x, s, px, py, wmm, sz, wt, col, lh) => { x.save(); x.font = font(sz, wt || 400); x.fillStyle = col || INK; x.textAlign = 'left'; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; const L = mm(lh || sz * 1.42); let line = '', y = py;
      String(s).split(' ').forEach(w => { const tt = line ? line + ' ' + w : w; if (x.measureText(tt).width > mm(wmm) && line) { x.fillText(line, px, y); y += L; line = w; } else line = tt; }); if (line) { x.fillText(line, px, y); y += L; } x.restore(); return y; };
    const paraH = (x, s, wmm, sz, wt, lh) => { x.save(); x.font = font(sz, wt || 400); let n = 0, line = ''; String(s).split(' ').forEach(w => { const tt = line ? line + ' ' + w : w; if (x.measureText(tt).width > mm(wmm) && line) { n++; line = w; } else line = tt; }); if (line) n++; x.restore(); return n * mm(lh || sz * 1.42); };
    const plus = (x, px, py, r, col) => { x.save(); x.strokeStyle = col || INK; x.lineWidth = Math.max(1, mm(0.25 * S.u)); x.setLineDash([]); x.beginPath(); x.moveTo(px - r, py); x.lineTo(px + r, py); x.moveTo(px, py - r); x.lineTo(px, py + r); x.stroke(); x.restore(); };
    // the title block: "+" · TITLE IN SPACED CAPITALS · one grey line under it; series and sheet number at the top right
    // o = { title, sub, code, num, left (mm, default 30), right (mm from the right edge, default 22), top (mm of the title's baseline, default 24) }
    const head = (x, W, o) => { const u = S.u, L = mm(o.left == null ? 30 : o.left), R = W - mm(o.right == null ? 22 : o.right), T = mm(o.top == null ? 24 * u : o.top);
      plus(x, L - mm(9 * u), T - mm(1.7 * u), mm(2 * u)); spaced(x, o.title, L, T, 5.2 * u, 700, INK, 0.9 * u); if (o.sub) txt(x, o.sub, L, T + mm(7 * u), 2.9 * u, 500, GR, 'left', R - L - mm(60 * u));
      if (o.code) txt(x, o.code, R, T, 2.6 * u, 700, INK, 'right'); if (o.num) txt(x, o.num, R, T + mm(5 * u), 2.6 * u, 500, GR, 'right'); };
    // a map window: thin frame and a "+" at each corner
    const frame = (x, V) => { x.save(); x.strokeStyle = INK; x.lineWidth = Math.max(1, mm(0.2 * S.u)); x.setLineDash([]); x.strokeRect(V[0], V[1], V[2] - V[0], V[3] - V[1]); x.restore(); [[V[0], V[1]], [V[2], V[1]], [V[0], V[3]], [V[2], V[3]]].forEach(([p, q]) => plus(x, p, q, mm(3.5 * S.u))); };
    // scale bar, scale and north, small, under the window's left corner. pxPerM = canvas px per metre; metres = the bar's length;
    // o = { labels: [[text, fraction], …], scale: '1:10,000', north: false to leave "N ↑" out, dy: mm under the window (default 9) }
    const scale = (x, V, pxPerM, metres, o) => { o = o || {}; const u = S.u, s1 = metres * pxPerM, sx = V[0], sy = V[3] + mm((o.dy == null ? 9 : o.dy) * u); const labs = o.labels || [['0', 0], [String(metres / 2), 0.5], [metres >= 1000 ? (metres / 1000) + ' km' : metres + ' m', 1]];
      x.save(); x.strokeStyle = INK; x.fillStyle = INK; x.lineWidth = Math.max(1, mm(0.3 * u)); x.setLineDash([]); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + s1, sy); labs.forEach(([, f]) => { x.moveTo(sx + s1 * f, sy - mm(1.4 * u)); x.lineTo(sx + s1 * f, sy); }); x.stroke();
      x.fillRect(sx, sy - mm(0.7 * u), s1 * (labs[1] ? labs[1][1] : 0.5), mm(0.7 * u)); x.restore(); labs.forEach(([s0, f]) => txt(x, s0, sx + s1 * f, sy + mm(4 * u), 2.4 * u, 500, GR, 'center'));
      const tx = sx + s1 + mm(9 * u); if (o.scale) txt(x, o.scale, tx, sy + mm(0.2 * u), 2.4 * u, 600, INK); if (o.north !== false) txt(x, 'N ↑', tx, sy + mm(4.2 * u), 2.4 * u, 700, INK); return sy + mm(6 * u); };
    // the key: one row per item, the same items the maps are drawn from (GA.ex21.*Legend). kk = px of one line unit (the map's k, or less).
    // item: { base: 'subject'|'context' } · { sw, alpha, stroke, dashed } · { hatch: col, dir } · { pat, col } · { fence: true } ·
    //       { line: col, w | wk, dash | dk, dots, round, rail, alpha } · { sym: 'dead'|'join'|'stop', line } · { num } — and label
    const swatch = (x, it, sx, yy, sw, sh, kk) => { x.save(); x.lineCap = 'butt'; x.setLineDash([]); const box = () => { x.beginPath(); x.rect(sx, yy - sh / 2, sw, sh); };
      if (it.base) { box(); x.fillStyle = '#FFFFFF'; x.fill(); box(); if (it.base === 'subject') GA.ex21.anHatch(x, [sx, yy - sh / 2, sx + sw, yy + sh / 2], A.red, Math.max(3, sh / 3.2), Math.max(1, sh / 14), 1); else GA.ex21.anHatch(x, [sx, yy - sh / 2, sx + sw, yy + sh / 2], A.hatch.ctxCol, Math.max(4, sh / 2), Math.max(1, sh / 18), -1);
        box(); x.strokeStyle = INK; x.lineWidth = Math.max(1.5, sh / 6.5); x.stroke(); x.strokeStyle = '#FFFFFF'; x.lineWidth = Math.max(0.8, sh / 12.5); x.setLineDash([sh / 2.6, sh / 2.6]); x.stroke(); x.setLineDash([]); }
      else if (it.pat) { box(); x.fillStyle = '#FFFFFF'; x.fill(); GA.ex21.anPattern(x, box, [sx, yy - sh / 2, sx + sw, yy + sh / 2], it.pat, it.col || RED, Math.max(0.6, sh / 13)); box(); x.strokeStyle = it.col || RED; x.lineWidth = Math.max(1, sh / 12); x.stroke(); }
      else if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sx, yy - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = it.stroke || GR; x.lineWidth = Math.max(1, sh / (it.stroke ? 9 : 22)); x.setLineDash(it.dashed ? [sh / 2.5, sh / 4] : []); x.strokeRect(sx, yy - sh / 2, sw, sh); x.setLineDash([]); }
      else if (it.hatch) { box(); GA.ex21.anHatch(x, [sx, yy - sh / 2, sx + sw, yy + sh / 2], it.hatch, Math.max(3, sh / 2.6), Math.max(1, sh / 16), it.dir || -1); x.strokeStyle = it.hatch; x.lineWidth = Math.max(1, sh / 22); x.strokeRect(sx, yy - sh / 2, sw, sh); }
      else if (it.fence) { x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); GA.ex21.anFence(x, kk, A); }
      else if (it.num) { const r = sh * 0.62, cx = sx + sw / 2; x.beginPath(); x.arc(cx, yy, r, 0, 7); x.fillStyle = RED; x.fill(); x.fillStyle = '#FFFFFF'; x.font = `700 ${Math.round(r * 1.25)}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.fillText(String(it.num), cx, yy + r * 0.06); }
      else if (it.curve) { x.strokeStyle = it.line || INK; x.lineWidth = Math.max(1, (it.wk || 1.4) * kk); x.beginPath(); x.moveTo(sx, yy + sh / 2); x.bezierCurveTo(sx + sw * 0.5, yy + sh / 2, sx + sw * 0.5, yy - sh / 2, sx + sw, yy - sh / 2); x.stroke(); x.fillStyle = it.line || INK; x.beginPath(); x.arc(sx + sw, yy - sh / 2, sh * 0.22, 0, 7); x.fill(); }
      else if (it.dot) { x.beginPath(); x.arc(sx + sw / 2, yy, sh * 0.5, 0, 7); x.fillStyle = it.dot; x.fill(); if (it.ring) { x.strokeStyle = it.ring; x.lineWidth = Math.max(1, sh / 12); x.stroke(); } }
      else if (it.sym === 'dead' || it.sym === 'join' || it.sym === 'stop') { const r = sh * 0.5, cx = sx + sw / 2; if (it.sym === 'join') { x.strokeStyle = it.line; x.globalAlpha = 0.85; x.lineWidth = sh * 0.55; x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.globalAlpha = 1; }
        x.beginPath(); x.arc(cx, yy, r, 0, 7); x.fillStyle = '#FFFFFF'; x.fill(); x.strokeStyle = it.line; x.lineWidth = r * 0.48; x.stroke(); if (it.sym !== 'stop') { x.beginPath(); x.moveTo(cx - r * 0.55, yy); x.lineTo(cx + r * 0.55, yy); if (it.sym === 'join') { x.moveTo(cx, yy - r * 0.55); x.lineTo(cx, yy + r * 0.55); } x.stroke(); } }
      else if (it.line) { const lw = (it.wk != null ? it.wk : (it.w || 1) * 1.4) * kk; x.globalAlpha = it.alpha || 1; x.strokeStyle = it.line; x.lineWidth = Math.max(1, lw); x.setLineDash(it.dk ? it.dk.map(v => v * kk) : it.dash ? [9 * kk, 4 * kk] : it.dots ? [1 * kk, 4.5 * kk] : []); x.lineCap = it.round || it.dots ? 'round' : 'butt';
        x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; x.lineCap = 'butt'; if (it.rail) { x.strokeStyle = '#FFFFFF'; x.lineWidth = Math.max(0.8, lw * 0.37); x.setLineDash([7 * kk, 7 * kk]); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); } }
      x.restore(); };
    // o = { cols (1), colW (mm), row (mm, default 5.4·u), sz (text mm, default 2.5·u), kk (px), sw (mm, default 10·u), sh (mm, default 3.6·u), maxW (label mm) }; returns the y under the key
    const key = (x, items, px, py, o) => { o = o || {}; const u = S.u, cols = o.cols || 1, row = mm(o.row || 5.4 * u), sz = o.sz || 2.5 * u, sw = mm(o.sw || 10 * u), sh = mm(o.sh || 3.6 * u), colW = mm(o.colW || 90 * u), kk = o.kk || mm(0.3 * u); const rows = Math.ceil(items.length / cols);
      items.forEach((it, j) => { const c0 = Math.floor(j / rows), r0 = j % rows, sx = px + c0 * colW, yy = py + r0 * row; swatch(x, it, sx, yy, sw, sh, kk); txt(x, it.label, sx + sw + mm(3 * u), yy + mm(sz * 0.36), sz, 500, INK, 'left', o.maxW ? mm(o.maxW) : colW - sw - mm(7 * u)); }); return py + rows * row; };
    // a note: "+ HEADING" in small bold capitals and a paragraph (col = ink, or the red when the note is about the red thing)
    const note = (x, px, py, wmm, headText, body, col, o) => { o = o || {}; const u = S.u; let y = py; if (headText) { txt(x, '+ ' + headText, px, y, (o.hsz || 2.6) * u, 700, col || INK); y += mm(5 * u); } if (body) y = para(x, body, px, y, wmm, (o.sz || 2.75) * u, 400, col || INK, (o.lh || 3.9) * u); return y + mm((o.gap == null ? 7 : o.gap) * u); };
    // the sources, small and grey, from the foot upwards (bottom margin 9 mm · u)
    const src = (x, W, H, text, o) => { o = o || {}; const u = S.u, L = mm(o.left == null ? 30 : o.left), wmm = (W - L) / D - (o.right == null ? 22 : o.right), sz = (o.sz || 2.2) * u, lh = 3 * u; const h = paraH(x, '+ ' + text, wmm, sz, 400, lh); para(x, '+ ' + text, L, H - mm(9 * u) - h + mm(lh), wmm, sz, 400, GR, lh); return H - mm(9 * u) - h; };
    // a curved leader from a text to a place on a map (schematic: say so in the key), with a dot at both ends
    const leader = (x, x0, y0, x1, y1, col, dash, bend) => { const b = bend == null ? 0.5 : bend; x.save(); x.strokeStyle = col || INK; x.fillStyle = col || INK; x.lineWidth = Math.max(1, mm(0.35 * S.u)); x.setLineDash(dash || []); x.beginPath(); x.moveTo(x0, y0); x.bezierCurveTo(x0 + (x1 - x0) * b, y0, x1 - (x1 - x0) * b, y1, x1, y1); x.stroke(); x.setLineDash([]);
      x.beginPath(); x.arc(x1, y1, mm(1.1 * S.u), 0, 7); x.fill(); x.beginPath(); x.arc(x0, y0, mm(0.7 * S.u), 0, 7); x.fill(); x.restore(); };
    // a label on a map: text on a white plate (no halo), centred on (px, py)
    const plate = (x, s, px, py, sz, wt, col, o) => { o = o || {}; const w = o.spaced ? spacedW(x, s, sz, wt, o.sp) : width(x, s, sz, wt), h = mm(sz * 1.5), pad = mm(sz * 0.45); x.save(); x.fillStyle = 'rgba(255,255,255,' + (o.alpha == null ? 0.9 : o.alpha) + ')'; x.fillRect(px - w / 2 - pad, py - h / 2, w + 2 * pad, h); x.restore();
      if (o.spaced) spaced(x, s, px - w / 2, py + mm(sz * 0.36), sz, wt, col, o.sp); else txt(x, s, px, py + mm(sz * 0.36), sz, wt, col, 'center'); return [px - w / 2 - pad, py - h / 2, px + w / 2 + pad, py + h / 2]; };
    // ONE MAP ON A SHEET (the 2.1 pages): title block, the map at its true size with corner marks, scale and north under it, then the
    // key (cols) and the notes side by side under the map, sources at the foot. o = { mapW, mapH (mm), u, title, sub, code, num,
    //   draw(x, bx, by, bw, bh), metres (scale bar length), pxPerM, scale ('1:10,000'), labels, key: items, keyCols, kk,
    //   notes: [[heading, body, red?], …], extra(x, px, py, wmm) → y (a chart or a table under the key), extraH (mm), src }
    // the key ON the map (Tal's note, 22 Nov 2026): one column, small, on a soft white ground with no frame, in the corner of the window
    // where the map has least ink (or o.corner 'tl'|'tr'|'bl'|'br'); returns the box it took
    const keyOnMap = (x, items, V, o) => { o = o || {}; const u = S.u, sz = 2.3 * u, row = mm(4.9 * u), sw = mm(9 * u), pad = mm(4 * u), inset = mm(6 * u); x.save(); x.font = font(sz, 500); let tw = 0; items.forEach(it => { tw = Math.max(tw, x.measureText(it.label).width); }); x.restore();
      const w = Math.min(pad * 2 + sw + mm(2.5 * u) + tw, (V[2] - V[0]) * 0.48), h = pad * 2 + items.length * row - mm(1 * u);
      const spots = { tl: [V[0] + inset, V[1] + inset], tr: [V[2] - inset - w, V[1] + inset], bl: [V[0] + inset, V[3] - inset - h - mm(2 * u)], br: [V[2] - inset - w, V[3] - inset - h - mm(2 * u)] };
      let c0 = o.corner && spots[o.corner] ? o.corner : null;
      if (!c0) { let best = 1e18; ['bl', 'br', 'tr', 'tl'].forEach(k2 => { const [px, py] = spots[k2]; const d = x.getImageData(Math.round(px), Math.round(py), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data; let ink = 0;
        for (let i = 0; i < d.length; i += 64) { const r = d[i], g = d[i + 1], b = d[i + 2]; ink += (765 - r - g - b) + (r - b > 40 ? 600 : 0); } if (ink < best) { best = ink; c0 = k2; } }); }
      const [px, py] = spots[c0]; x.save(); x.fillStyle = 'rgba(255,255,255,0.88)'; x.fillRect(px, py, w, h); x.restore();
      items.forEach((it, j) => { const yy = py + pad + j * row + row * 0.35; swatch(x, it, px + pad, yy, sw, mm(3.2 * u), o.kk || mm(0.3 * u)); txt(x, it.label, px + pad + sw + mm(2.5 * u), yy + mm(sz * 0.36), sz, 500, INK, 'left', w - pad * 2 - sw - mm(2.5 * u)); });
      return [px, py, px + w, py + h]; };
    const mapSheet = async (o) => { S.u = o.u || 1; const u = S.u, L = 30 * u, R = 22 * u, top = 46 * u; const onMap = o.key && o.keyOn !== false; const keyRows = o.key && !onMap ? Math.ceil(o.key.length / (o.keyCols || 2)) : 0; /* (Tal, 22 Nov 2026) the key sits ON the map, small, no frame */ const noteW = o.notes && o.notes.length ? (o.noteW || 190 * u) : 0;
      const wmm = L + o.mapW + R + (o.sideW || 0), under = 20 * u + Math.max(keyRows * 5.4 * u + 6 * u, o.noteH || (noteW ? 40 * u : 0)) + (o.extraH || 0) + 26 * u; const hmm = top + o.mapH + under + (o.addH || 0);
      const [c, x] = sheet(wmm, hmm), W = c.width, H = c.height; head(x, W, { title: o.title, sub: o.sub, code: o.code, num: o.num, left: L, right: R });
      const bx = mm(L), by = mm(top), bw = Math.round(mm(o.mapW)), bh = Math.round(mm(o.mapH)); await o.draw(x, bx, by, bw, bh); const V = [bx, by, bx + bw, by + bh]; frame(x, V);
      let y = scale(x, V, o.pxPerM, o.metres || 1000, { scale: o.scale, labels: o.labels }) + mm(9 * u); const keyW = o.mapW - noteW - (noteW ? 12 * u : 0); let yk = y, yn = y;
      if (o.key && !onMap) yk = key(x, o.key, bx, y, { cols: o.keyCols || 2, colW: keyW / (o.keyCols || 2), kk: o.kk });
      if (onMap) keyOnMap(x, o.key, V, { kk: o.kk, corner: o.keyOn });
      if (noteW) { const nx = onMap ? bx : bx + mm(o.mapW - noteW); (o.notes || []).forEach(([h0, b0, red]) => { yn = note(x, nx, yn, noteW, h0, b0, red ? RED : INK); }); }
      let ye = Math.max(yk, yn) + mm(6 * u); if (o.extra) ye = await o.extra(x, bx, ye, o.mapW);
      src(x, W, H, o.src, { left: L, right: R }); return c; };
    return { S, K, Ks, mm, D, INK, GR, RED, A, pal, F, sheet, font, txt, width, spaced, spacedW, para, paraH, plus, head, frame, scale, swatch, key, keyOnMap, note, src, leader, plate, mapSheet, set u(v) { S.u = v; }, get u() { return S.u; } };
  })();
'''


def launch(p, port, ready='GA.ex21 && GA.ex21.setStyle && GA.ex21.drawPeople'):
    """open the atlas page on the local server with the 2.1 scripts loaded; returns (browser, page, errors)"""
    import sys
    sys.path.insert(0, 'tests')
    import ui_test_v3 as V3
    import _nointro  # noqa: F401  (sets window.__noIntro: the map first, not the opening page)
    V3.PORT = port; V3.V2.PORT = port
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/palette.js', 'js/i18n_v33.js', 'js/ex21.js']:
        pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(' + ready + ')', timeout=20000); pg.evaluate('GA.i18n.setLang("en")')
    return b, pg, errs


def save(data_url, path):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    open(path, 'wb').write(base64.b64decode(data_url.split(',')[1]))
