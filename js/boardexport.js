/* Print primitives for composed boards (build 5.13): wrapped paragraphs, legends and charts drawn on a canvas at print
   sizes, each with a measuring ("dry") pass so a page can be laid out before anything is drawn — no clipping, no overlap.
   Legends and charts are drawn from the SAME items the live cards use (card.legend from the map's style definitions,
   card.chart from the same data as the on-page chart), so an export never has a legend of its own.
   Sizes are in canvas px; at 150 dpi, 19 px ≈ 9 pt (the smallest text used), 22 px ≈ 10.5 pt (body). */
(function (root) {
  const P = () => root.GA.palette;
  const clean = (s) => String(s == null ? '' : s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/[⁦⁩]/g, '').replace(/\s+/g, ' ').trim();
  // wrapped paragraph; returns the y after it. o: { size, weight, color, lines, lh, rtl, F, dry }
  function para(ctx, text, x, y, w, o) {
    o = o || {}; const size = o.size || 22, lh = o.lh || Math.round(size * 1.38); const s = clean(text); if (!s) return y;
    ctx.save(); ctx.font = `${o.weight || 400} ${size}px ${o.F}`; ctx.direction = o.rtl ? 'rtl' : 'ltr'; ctx.textAlign = o.rtl ? 'right' : 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = o.color || P().ink;
    const words = s.split(' '); const out = []; let line = '';
    for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (ctx.measureText(tt).width > w && line) { out.push(line); line = wd; } else line = tt; }
    if (line) out.push(line);
    let lines = out; if (o.lines && out.length > o.lines) { lines = out.slice(0, o.lines); let last = lines[lines.length - 1]; while (last.length > 1 && ctx.measureText(last + ' …').width > w) last = last.replace(/\s*\S+$/, ''); lines[lines.length - 1] = last + ' …'; }
    let yy = y + size; lines.forEach(l => { if (!o.dry) ctx.fillText(l, o.rtl ? x + w : x, yy); yy += lh; }); ctx.restore();
    return yy - lh + Math.round(size * 0.45);
  }
  // legend from card legend items (same shapes as the live legend: swatch, hatch, line, dot, ramp)
  function legend(ctx, items, x, y, w, o) {
    o = o || {}; const fs = o.size || 21, sw = Math.round(fs * 1.25), sh = Math.round(fs * 0.8), row = Math.round(fs * 1.55), gap = Math.round(fs * 0.9); const rtl = o.rtl;
    ctx.save(); ctx.font = `${fs}px ${o.F}`; ctx.textBaseline = 'middle'; ctx.direction = rtl ? 'rtl' : 'ltr';
    let cx = 0, cy = y + row / 2;
    (items || []).forEach(it => {
      const label = clean(it.label); const lw = ctx.measureText(label).width; let need = sw + 10 + lw + gap;
      const long = need > w; if (long) need = w; if (cx > 0 && cx + need > w) { cx = 0; cy += row; }
      const sx = rtl ? x + w - cx - sw : x + cx;
      if (!o.dry) {
        if (it.hatch) { ctx.save(); ctx.strokeStyle = P().grey; ctx.lineWidth = 1.2; ctx.strokeRect(sx, cy - sh / 2, sw, sh); ctx.beginPath(); ctx.rect(sx, cy - sh / 2, sw, sh); ctx.clip(); for (let k = -sh; k < sw + sh; k += 6) { ctx.moveTo(sx + k, cy + sh / 2); ctx.lineTo(sx + k + sh, cy - sh / 2); } ctx.stroke(); ctx.restore(); }
        else if (it.sw) { ctx.globalAlpha = it.alpha != null ? it.alpha : 1; ctx.fillStyle = it.sw; ctx.fillRect(sx, cy - sh / 2, sw, sh); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, cy - sh / 2 + 0.5, sw - 1, sh - 1); }
        else if (it.line) { ctx.strokeStyle = it.line; ctx.lineWidth = Math.max(1.5, (it.w || 1) * 1.6); ctx.setLineDash(it.dash ? [8, 5] : []); ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(sx + sw, cy); ctx.stroke(); ctx.setLineDash([]); }
        else if (it.dot) { ctx.fillStyle = it.dot; ctx.beginPath(); ctx.arc(sx + sw / 2, cy, sh / 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke(); }
        else if (it.ramp) { const g = ctx.createLinearGradient(sx, 0, sx + sw, 0); g.addColorStop(0, `rgb(${it.ramp[0].slice(0, 3)})`); g.addColorStop(1, `rgb(${it.ramp[1].slice(0, 3)})`); ctx.fillStyle = g; ctx.fillRect(sx, cy - sh / 2, sw, sh); }
        ctx.fillStyle = P().ink; ctx.textAlign = rtl ? 'right' : 'left';
      }
      if (long) { // own lines, wrapped
        const yEnd = para(ctx, label, rtl ? x : x + sw + 10, cy - fs * 0.85, w - sw - 10, { size: fs, F: o.F, rtl, dry: o.dry, lh: Math.round(fs * 1.3) });
        cy = Math.max(cy, yEnd - fs * 0.4); cx = w; return;
      }
      if (!o.dry) ctx.fillText(label, rtl ? sx - 10 : sx + sw + 10, cy);
      cx += need;
    });
    ctx.restore(); return (items && items.length) ? cy + row / 2 : y;
  }
  const pctTxt = (v) => (v * 100 >= 10 ? Math.round(v * 100) : Math.round(v * 1000) / 10) + ' %';
  const numTxt = (v) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: v < 10 && v % 1 ? 2 : 0 }));
  // chart from the card's chart data (stack: shares with a value key; hbars: labelled rows; vbars: series)
  function chart(ctx, ch, x, y, w, o) {
    o = o || {}; if (!ch || !ch.items || !ch.items.length) return y; const fs = o.size || 20; const rtl = o.rtl; ctx.save(); ctx.font = `${fs}px ${o.F}`; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
    let yy = y;
    if (ch.kind === 'stack') {
      const bh = Math.round(fs * 1.7); let cx = 0; const tot = ch.items.reduce((s, i) => s + Math.max(0, i.v), 0) || 1;
      ch.items.forEach(i => { const sw = Math.max(0, i.v) / tot * w; if (sw <= 0) return; const sx = rtl ? x + w - cx - sw : x + cx; if (!o.dry) { ctx.fillStyle = i.col; ctx.fillRect(sx, yy, sw, bh); ctx.strokeStyle = P().line2; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, yy + 0.5, sw - 1, bh - 1); const lbl = pctTxt(i.v / tot); if (ctx.measureText(lbl).width + 8 < sw) { const rgb = ctx.fillStyle; ctx.fillStyle = luminance(i.col) < 0.5 ? '#FFF' : P().ink; ctx.textAlign = 'center'; ctx.fillText(lbl, sx + sw / 2, yy + bh / 2); ctx.fillStyle = rgb; } } cx += sw; });
      yy += bh + 8;
      // value key under the bar (label: share), same colours
      yy = legend(ctx, ch.items.filter(i => i.v / tot >= 0.0005).map(i => ({ sw: i.col, label: `${clean(i.label)}: ${pctTxt(i.v / tot)}` })), x, yy, w, { size: Math.round(fs * 0.95), F: o.F, rtl, dry: o.dry });
    } else if (ch.kind === 'hbars') {
      const rows = ch.items.slice(0, 10); const max = Math.max(...rows.map(i => i.v), 1e-9); const lw = Math.round(w * 0.36), vw = Math.round(fs * 3.4), bw = w - lw - vw - 16; const rh = Math.round(fs * 1.45);
      rows.forEach(i => { const cy = yy + rh / 2; if (!o.dry) { let lbl = clean(i.label); ctx.font = `${fs}px ${o.F}`; ctx.direction = rtl ? 'rtl' : 'ltr'; while (lbl.length > 2 && ctx.measureText(lbl).width > lw - 8) lbl = lbl.slice(0, -2) + '…';
          ctx.fillStyle = P().ink; ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText(lbl, rtl ? x + w : x, cy); const L = Math.max(1, i.v / max * bw); ctx.fillStyle = i.col || P().chart.bar; if (rtl) ctx.fillRect(x + w - lw - L, cy - rh * 0.3, L, rh * 0.6); else ctx.fillRect(x + lw, cy - rh * 0.3, L, rh * 0.6);
          ctx.direction = 'ltr'; ctx.textAlign = rtl ? 'left' : 'right'; ctx.fillStyle = P().ink2; ctx.fillText(numTxt(i.v), rtl ? x : x + w, cy); } yy += rh; });
      if (ch.items.length > rows.length) yy = para(ctx, `+ ${ch.items.length - rows.length}`, x, yy, w, { size: Math.round(fs * 0.9), F: o.F, rtl, dry: o.dry, color: P().ink3 });
    } else {
      const n = ch.items.length, H = Math.round(fs * 6), bw = w / n; const max = Math.max(...ch.items.map(i => i.v), 1e-9);
      if (!o.dry) { ch.items.forEach((i, k) => { const h = Math.max(1, i.v / max * H); const bx = rtl ? x + w - (k + 1) * bw : x + k * bw; ctx.fillStyle = i.col || P().chart.bar; ctx.fillRect(bx + 2, yy + H - h, bw - 4, h); });
        ctx.font = `${Math.round(fs * 0.85)}px ${o.F}`; ctx.fillStyle = P().ink3; ctx.textAlign = 'center'; const every = Math.ceil(n / 12); ch.items.forEach((i, k) => { if (k % every) return; const bx = rtl ? x + w - (k + 0.5) * bw : x + (k + 0.5) * bw; ctx.fillText(clean(i.label), bx, yy + H + fs * 0.8); });
        ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillText(`max ${numTxt(max)}`, rtl ? x + w : x, yy - fs * 0.5); }
      yy += H + fs * 1.5;
    }
    if (ch.unit) yy = para(ctx, ch.unit, x, yy, w, { size: Math.round(fs * 0.9), F: o.F, rtl, dry: o.dry, color: P().ink3 });
    ctx.restore(); return yy;
  }
  function luminance(c) { const m = String(c).match(/\d+(\.\d+)?/g); let r, g, b; if (String(c)[0] === '#') { const h = c.slice(1); r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); } else if (m) { [r, g, b] = m.map(Number); } else return 1; return (0.3 * r + 0.59 * g + 0.11 * b) / 255; }
  // a small "image unavailable" frame (never an empty frame)
  function unavailable(ctx, x, y, w, h, title, reason, o) {
    ctx.save(); ctx.fillStyle = P().gray1; ctx.fillRect(x, y, w, h); ctx.strokeStyle = P().line2; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]); ctx.restore();
    let yy = para(ctx, title, x + 20, y + h * 0.3, w - 40, { size: (o.size || 22) + 2, weight: 700, F: o.F, rtl: o.rtl, color: P().ink2 });
    para(ctx, reason, x + 20, yy + 6, w - 40, { size: o.size || 20, F: o.F, rtl: o.rtl, color: P().ink3, lines: 6 });
  }
  // ---------- 5.15: ONE card format for every analysis map and its exports ----------
  // title (with a small section kicker) → map → legend → key indicators → chart → short interpretation → source and
  // method. Nothing is ever placed beside the map. o: { F, rtl, s (text scale), titleH, mapH, drawMap(x, y, w, h), kicker,
  // compact, t (i18n) }. `cardTitle` / `cardBody` with o.dry measure without drawing, so a row of cards can share one
  // title height and one map height (top and bottom edges aligned) and a page never clips a card.
  function sz(o, v) { return Math.round(v * (o.s || 1)); }
  function cardTitle(ctx, c, x, y, w, o) {
    const q = (size, ex) => Object.assign({ size: sz(o, size), F: o.F, rtl: o.rtl, dry: o.dry }, ex || {}); let z = y;
    if (o.kicker) z = para(ctx, o.kicker, x, z, w, q(19, { weight: 600, color: P().ink3, lines: 1 }));
    z = para(ctx, c.title, x, z, w, q(30, { weight: 700, lines: 2 }));
    if (o.subtitle) z = para(ctx, o.subtitle, x, z, w, q(21, { color: P().ink2, lines: 2 }));
    return z;
  }
  function cardBody(ctx, c, x, y, w, o) {
    const T = o.t || ((k) => k); const q = (size, ex) => Object.assign({ size: sz(o, size), F: o.F, rtl: o.rtl, dry: o.dry }, ex || {}); let z = y;
    const gap = sz(o, 10);
    z = legend(ctx, c.legend || [], x, z, w, q(21));
    (c.notes || []).forEach(n => { z = para(ctx, n, x, z + 2, w, q(20, { color: P().ink2, lines: 3 })); });
    const ind = (c.ind || []).slice(0, o.compact ? 3 : 4);
    if (ind.length) { z += gap; ind.forEach(r => { z = para(ctx, `${clean(r[0])}: ${clean(r[1])}${r[2] === 'est' ? ' (' + T('st.est') + ')' : ''}`, x, z, w, q(22, { weight: 600, lines: 2 })); }); }
    if (c.chart && c.chart.items && c.chart.items.length) { z += gap + sz(o, 18); z = chart(ctx, c.chart, x, z, w, q(20)); }
    const finds = (c.find || []).map(clean).filter(Boolean).slice(0, o.compact ? 2 : 3);
    if (finds.length) { z += gap; finds.forEach(f => { z = para(ctx, '• ' + f, x, z, w, q(21, { lines: o.compact ? 2 : 3, color: P().ink2 })); }); }
    if (c.src) { z += sz(o, 8); z = para(ctx, `${T('src.label')} ${clean(c.src.name)} · ${clean(c.src.detail || '')} · ${clean(c.src.license || '')}`, x, z, w, q(19, { lines: 2, color: P().ink3 })); }
    if (c.method) { const m = clean(c.method); const cut = o.compact ? 200 : 330; z = para(ctx, `${T('g.method')}: ${m.length > cut ? m.slice(0, cut).replace(/\s+\S*$/, '') + ' …' : m}`, x, z + 4, w, q(19, { lines: o.compact ? 2 : 4, color: P().ink3 })); }
    return z;
  }
  // a complete card at (x, y), width w; returns { mapY, mapBottom, bottom }
  function card(ctx, c, x, y, w, o) {
    const T = o.t || ((k) => k); const tEnd = cardTitle(ctx, c, x, y, w, o); const mapY = y + Math.max(o.titleH || 0, tEnd - y) + sz(o, 8); const mh = o.mapH || Math.round(w * 0.72);
    if (!o.dry) {
      if (!c || c.gapOnly || !o.drawMap) unavailable(ctx, x, mapY, w, mh, T('v12.noData'), clean(c && c.gapOnly) || '', { F: o.F, rtl: o.rtl, size: sz(o, 21) });
      else { o.drawMap(x, mapY, w, mh); ctx.save(); ctx.strokeStyle = P().line2; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, mapY + 0.5, w - 1, mh - 1); ctx.restore(); }
    }
    const bottom = (c && c.gapOnly) ? mapY + mh : cardBody(ctx, c, x, mapY + mh + sz(o, 16), w, o);
    return { mapY, mapBottom: mapY + mh, bottom };
  }
  // heights a card needs around its map (title block, body under the map)
  function cardNeeds(ctx, c, w, o) { const d = Object.assign({}, o, { dry: true }); const th = cardTitle(ctx, c, 0, 0, w, d); const body = (c && c.gapOnly) ? 0 : cardBody(ctx, c, 0, 0, w, d) + sz(o, 16); return { title: th, body }; }
  root.GA = root.GA || {}; root.GA.boardExport = { clean, para, legend, chart, unavailable, pctTxt, card, cardTitle, cardBody, cardNeeds };
})(window);
