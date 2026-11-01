/* Click-to-enlarge viewers shared by the analysis panel, the analysis page and the comparison workspace.
   - map(): a result map redrawn from its vector/raster data at any zoom (drag, wheel, pinch, keyboard), with legend,
     title, scale, north arrow, source/date, feature inspection on click, PNG/PDF export.
   - image(): photographs, scans and image-only reference maps — zoom and pan of pixels only (no GIS claims).
   - html(): charts and other HTML content enlarged.
   Every viewer is a modal dialog: Escape and the Close button return to the same page and scroll position. */
(function (root) {
  const I = root.GA.i18n; const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d });

  // ---------- dialog shell ----------
  let open = null;
  function shell(o) {
    if (open) open.close(true);
    const opener = document.activeElement; const scrollers = [...document.querySelectorAll('#page .pg-b, #left-body, #workspace .ws-b, #page, html')].map(e => [e, e.scrollTop]);
    const el = document.createElement('div'); el.className = 'vw ' + (o.kind || ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'vw-title');
    el.innerHTML = `<div class="vw-box"><header class="vw-h"><div class="vw-t"><h2 id="vw-title" dir="auto">${o.title}</h2>${o.subtitle ? `<p class="vw-sub" dir="auto">${o.subtitle}</p>` : ''}</div>
      <div class="vw-tools">${o.tools || ''}<button class="btn btn-small vw-close" data-vw="close">${t('v5.close')}<span aria-hidden="true"> ✕</span></button></div></header>
      <div class="vw-main">${o.body}</div></div>`;
    document.body.appendChild(el); document.body.classList.add('vw-open');
    const focusables = () => [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }
      if (e.key === 'Tab') { const f = focusables(); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
      if (o.onKey) o.onKey(e);
    };
    document.addEventListener('keydown', onKey, true);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-vw="close"]') || e.target === el) api.close(); });
    const api = {
      el, close(silent) {
        document.removeEventListener('keydown', onKey, true); el.remove(); document.body.classList.remove('vw-open'); open = null; o.onClose && o.onClose();
        scrollers.forEach(([e, y]) => { e.scrollTop = y; }); if (!silent && opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
      },
    };
    open = api; setTimeout(() => { const c = el.querySelector('.vw-close'); c && c.focus({ preventScroll: true }); }, 0);
    return api;
  }

  // ---------- feature inspection on result maps ----------
  function inspector(X) {
    const PJ = root.GA.proj, G = root.GA.geo; const U = (ll) => PJ.EPSG25830.forward(ll);
    const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const l = dx * dx + dy * dy || 1e-9; const tt = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)); return d2(p, [a[0] + dx * tt, a[1] + dy * tt]); };
    const near = (list, getLL, u, tol) => { let best = null, bd = tol; list.forEach(x => { const ll = getLL(x); if (!ll) return; const d = d2(U(ll), u); if (d <= bd) { bd = d; best = x; } }); return best; };
    const rows = (pairs) => `<dl class="kv">${pairs.filter(p => p[1] != null && p[1] !== '').map(p => `<div><dt>${p[0]}</dt><dd dir="auto">${p[1]}</dd></div>`).join('')}</dl>`;
    return function (cardId, ll, tolM) {
      const u = U(ll); const R = X.R || {}; const out = [];
      const pt = (title, pairs, note) => out.push(`<h4>${title}</h4>${rows(pairs)}${note ? `<p class="fine">${note}</p>` : ''}`);
      const want = (ids) => ids.includes(cardId);
      if (want(['places']) && R.places) { const f = near(R.places.pts || [], f => f.geometry.coordinates, u, tolM); if (f) { const p = f.properties; pt(esc(p.n || t('v5.unnamed')), [[t('v5.category'), esc(p.cd || p.c || '—')], [t('v5.status'), esc(p.s || t('v5.statusUnknown'))], [t('v5.confidence'), p.cf != null ? nf(p.cf, 2) : null]], 'Overture Maps (CDLA-Permissive-2.0)'); } }
      if (want(['bus', 'transit']) && R.bus) { const f = near(R.bus.pts || [], f => f.geometry.coordinates, u, tolM); if (f) { const p = f.properties; pt(esc(p.stop_name || t('v5.unnamed')), [[t('v5.tripsDay'), nf(p.trips_day)], [t('v5.trips79'), nf(p.trips_7_9)], [t('ly3.routes'), esc(p.routes || '—')], [t('v5.date'), '26 October 2026']], t('g3.busCaveat')); } }
      if (want(['transit']) && R.transit && !out.length) { const s = near(R.transit.pts || [], s => s.pt, u, tolM); if (s) pt(esc((s.tags && s.tags.name) || t('v5.unnamed')), [[t('v5.kind'), 'OSM bus stop']], t('g.fFreqGap')); }
      if (want(['trees']) && R.trees) { const p = near(R.trees.pts || [], p => p.ll, u, tolM); if (p) pt(t('ly3.treePt'), [[t('ly3.species'), esc(p.tags.species || p.tags.genus || '') || t('nodata')], [t('ly3.height'), p.tags.height ? esc(p.tags.height) + ' m' : t('nodata')], ['OSM', esc(p.id)]]); }
      if (want(['health', 'education', 'stay', 'landuse']) && X.parsed && X.parsed.pois) { const p = near(X.parsed.pois.filter(q => q.tags && q.tags._fac), q => q.pt, u, tolM); if (p) pt(esc(p.tags.name || t('v5.unnamed')), [[t('v5.kind'), esc(p.tags._fac)], [t('v5.tags'), esc(['amenity', 'healthcare', 'tourism', 'shop'].map(k => p.tags[k] ? k + '=' + p.tags[k] : '').filter(Boolean).join(', '))]], 'OpenStreetMap (ODbL)'); }
      if (want(['flood']) && R.flood) { Object.entries(R.flood.features || {}).forEach(([k, fs]) => fs.forEach(f => { if (!out.length && G.pointInRing(ll, f.coordinates[0])) { const p = f.props || {}; pt(`${t('g3.flood')} · ${k.toUpperCase().replace('Q', 'T = ')}`, [[t('v5.reach'), esc(p.rio || p.zona || '—')], [t('v5.study'), esc(p.estudio || '—')], [t('v5.approved'), esc(p.fecha_apro || '—')]], 'MITECO SNCZI'); } })); }
      if (want(['streets']) && R.osm && R.osm.geo) { let best = null, bd = tolM; R.osm.geo.streets.features.forEach(f => { const c = f.geometry.coordinates.map(U); for (let i = 1; i < c.length; i++) { const d = segD(u, c[i - 1], c[i]); if (d < bd) { bd = d; best = f; } } }); if (best) pt(esc(best.properties.name || t('v5.unnamed')), [[t('v5.class'), esc(best.properties.highway)], [t('v5.tier'), esc(best.properties.tier)]], 'OpenStreetMap (ODbL)'); }
      if (want(['landuse', 'parks']) && !out.length && R.osm && R.osm.geo) { const f = R.osm.geo.landuse.features.find(f => f.geometry.type === 'Polygon' && G.pointInRing(ll, f.geometry.coordinates[0])); if (f) pt(t('v5.landuse'), [[t('v5.category'), esc(t('lu.' + f.properties.cat) !== 'lu.' + f.properties.cat ? t('lu.' + f.properties.cat) : f.properties.cat)], [t('v5.name'), esc(f.properties.name || '')]], 'OpenStreetMap (ODbL)'); }
      if (want(['elevation', 'slope']) && X.dem) { const v = root.GA.data.sampleGrid(X.dem, u[0], u[1]); const s = X.slope ? root.GA.data.sampleGrid(X.slope, u[0], u[1]) : null; pt(t('v5.terrainHere'), [[t('v5.elev'), v != null ? nf(v) + ' m' : t('nodata')], [t('v5.slope'), s != null ? nf(s * (X.slope.scale || 1), 1) + '°' : t('nodata')]], 'IGN MDT25 · 25 m'); }
      if (!out.length && X.parsed && X.parsed.buildings) { // any map: the building under the pointer
        const b = X.parsed.buildings.find(b => b.outers.some(o => G.pointInRing(ll, o)));
        if (b) { const tg = b.tags; pt(esc(tg.name || t('v5.building')), [[t('v5.btype'), esc(tg.building)], [t('v5.floors'), tg['building:levels'] ? esc(tg['building:levels']) : t('nodata')], [t('v5.height'), tg.height ? esc(tg.height) + ' m' : t('nodata')], [t('v5.underground'), tg['building:levels:underground'] ? esc(tg['building:levels:underground']) : null], [t('v5.roof'), tg['roof:shape'] ? esc(tg['roof:shape']) : null], [t('v5.built'), tg.start_date ? esc(tg.start_date) : null], ['OSM', esc(b.id)]], 'OpenStreetMap (ODbL)'); }
      }
      return out.length ? out.join('') : `<p class="fine">${t('v5.nothingHere')}</p>`;
    };
  }

  // ---------- interactive result map ----------
  // o: { title, subtitle, card, X, ring, style, rings:[{ring,style}] (comparison: one map per fabric shares the scale), slug }
  function map(o) {
    const MC = root.GA.mapcard, GAL = root.GA.gallery, PJ = root.GA.proj; const card = o.card;
    const legend = GAL.legendHTML(card.legend || []);
    const src = card.src ? `<p class="vw-src"><b>${t('src.label')}</b> <bdi>${esc(card.src.name)}</bdi> · <span dir="ltr">${esc(card.src.detail || '')}</span> · ${esc(card.src.license || '')}</p>` : '';
    const sh = shell({
      kind: 'vw-map', title: esc(o.title || card.title), subtitle: o.subtitle ? esc(o.subtitle) : '',
      tools: `<div class="vw-zoom" role="group" aria-label="${esc(t('v5.zoom'))}"><button class="btn btn-small" data-z="in" aria-label="${esc(t('v5.zoomIn'))}">＋<span class="lbl">${t('v5.zoomIn')}</span></button><button class="btn btn-small" data-z="out" aria-label="${esc(t('v5.zoomOut'))}">－<span class="lbl">${t('v5.zoomOut')}</span></button><button class="btn btn-small" data-z="reset">${t('v5.resetView')}</button></div>
        <button class="btn btn-small" data-x="png">${t('v5.exportPNG')}</button><button class="btn btn-small" data-x="pdf">${t('v5.exportPDF')}</button>`,
      body: `<div class="vw-stage" tabindex="0" aria-label="${esc(t('v5.mapStage'))}"><canvas class="vw-cv"></canvas><span class="vw-pin" hidden></span><p class="vw-hint">${t('v5.mapHint')}</p></div>
        <aside class="vw-side"><section><h3>${t('v5.legend')}</h3>${legend}</section><section class="vw-info" aria-live="polite"><h3>${t('v5.featureInfo')}</h3><p class="fine">${t('v5.clickToInspect')}</p></section><section>${src}</section></aside>`,
      onKey: (e) => { const k = e.key; if (k === '+' || k === '=') { zoomBy(1 / 1.4); e.preventDefault(); } else if (k === '-' || k === '_') { zoomBy(1.4); e.preventDefault(); } else if (k === '0') { reset(); e.preventDefault(); } else if (k.startsWith('Arrow') && document.activeElement && document.activeElement.classList.contains('vw-stage')) { const s = 80 * st.mpp; if (k === 'ArrowLeft') st.cx -= s; if (k === 'ArrowRight') st.cx += s; if (k === 'ArrowUp') st.cy += s; if (k === 'ArrowDown') st.cy -= s; draw(); e.preventDefault(); } },
    });
    const stage = sh.el.querySelector('.vw-stage'), cv = sh.el.querySelector('.vw-cv'), pin = sh.el.querySelector('.vw-pin'), info = sh.el.querySelector('.vw-info');
    const rings = o.rings || [{ ring: o.ring, style: o.style }];
    let st = { cx: 0, cy: 0, mpp: 1 }, fit0 = null; const size = () => [stage.clientWidth, stage.clientHeight];
    function reset() { const [w, h] = size(); const f = MC.fit(rings.map(r => r.ring), w, h, 0.08); fit0 = f; st = { cx: f.center[0], cy: f.center[1], mpp: o.mpp || f.mpp }; draw(); }
    function draw() {
      const [w, h] = size(); if (!w || !h) return; cv.style.transform = '';
      GAL.drawCard(cv, { ring: rings[0].ring, style: rings[0].style }, card, { center: [st.cx, st.cy], mpp: st.mpp, w, h, overlays: (o.overlays || []).concat(rings.slice(1).map(r => ({ coords: r.ring, color: (r.style && r.style.color) || '#992B2A', width: 2, dash: r.style && r.style.dash }))) });
      placePin();
    }
    const clampM = (m) => Math.max(0.05, Math.min((fit0 ? fit0.mpp : m) * 8, m));
    function zoomBy(f, px, py) { const [w, h] = size(); px = px == null ? w / 2 : px; py = py == null ? h / 2 : py; const m2 = clampM(st.mpp * f); const k = m2 / st.mpp; const ux = st.cx + (px - w / 2) * st.mpp, uy = st.cy - (py - h / 2) * st.mpp; st.cx = ux - (px - w / 2) * st.mpp * k; st.cy = uy + (py - h / 2) * st.mpp * k; st.mpp = m2; draw(); }
    // gestures: CSS transform while moving, redraw from data when the gesture ends
    const ptrs = new Map(); let g0 = null, moved = false, tDown = 0, wheelT = null, pending = { s: 1, dx: 0, dy: 0, ox: 0, oy: 0 };
    const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const applyCSS = () => { cv.style.transformOrigin = `${pending.ox}px ${pending.oy}px`; cv.style.transform = `translate(${pending.dx}px, ${pending.dy}px) scale(${pending.s})`; };
    function commit() {
      const [w, h] = size(); const s = pending.s, ox = pending.ox, oy = pending.oy;
      // a screen point p maps to p' = o + (p - o)·s + d ; invert for the new centre
      const cxs = (w / 2 - pending.dx - ox) / s + ox, cys = (h / 2 - pending.dy - oy) / s + oy;
      st.cx = st.cx + (cxs - w / 2) * st.mpp; st.cy = st.cy - (cys - h / 2) * st.mpp; st.mpp = clampM(st.mpp / s); pending = { s: 1, dx: 0, dy: 0, ox: 0, oy: 0 }; draw();
    }
    stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e)); moved = false; tDown = performance.now(); const p = [...ptrs.values()]; g0 = { p: p.map(x => x.slice()), base: Object.assign({}, pending) }; });
    stage.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId) || !g0) return; ptrs.set(e.pointerId, local(e)); const p = [...ptrs.values()];
      if (p.length === 1 && g0.p.length === 1) { const dx = p[0][0] - g0.p[0][0], dy = p[0][1] - g0.p[0][1]; if (Math.hypot(dx, dy) > 4) moved = true; pending.dx = g0.base.dx + dx; pending.dy = g0.base.dy + dy; applyCSS(); }
      else if (p.length >= 2 && g0.p.length >= 2) { moved = true; const d0 = Math.hypot(g0.p[0][0] - g0.p[1][0], g0.p[0][1] - g0.p[1][1]) || 1, d1 = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); const m0 = [(g0.p[0][0] + g0.p[1][0]) / 2, (g0.p[0][1] + g0.p[1][1]) / 2], m1 = [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]; pending = { s: d1 / d0, ox: m0[0], oy: m0[1], dx: m1[0] - m0[0], dy: m1[1] - m0[1] }; applyCSS(); }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return; const pos = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
      if (!moved && performance.now() - tDown < 600 && !ptrs.size) { inspectAt(pos[0], pos[1]); g0 = null; return; }
      if (!ptrs.size) { g0 = null; commit(); } else { const p = [...ptrs.values()]; g0 = { p: p.map(x => x.slice()), base: Object.assign({}, pending) }; }
    };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); const f = Math.exp(-e.deltaY * 0.0015); pending.ox = x; pending.oy = y; pending.s = Math.max(0.2, Math.min(5, pending.s * f)); applyCSS(); clearTimeout(wheelT); wheelT = setTimeout(commit, 160); }, { passive: false });
    // inspection
    const insp = o.X ? inspector(o.X) : null; let pinLL = null;
    function placePin() { if (!pinLL) { pin.hidden = true; return; } const [w, h] = size(); const u = PJ.EPSG25830.forward(pinLL); pin.style.left = ((u[0] - st.cx) / st.mpp + w / 2) + 'px'; pin.style.top = (h / 2 - (u[1] - st.cy) / st.mpp) + 'px'; pin.hidden = false; }
    function inspectAt(x, y) {
      const [w, h] = size(); const u = [st.cx + (x - w / 2) * st.mpp, st.cy - (y - h / 2) * st.mpp]; const ll = PJ.EPSG25830.inverse(u); pinLL = ll; placePin();
      info.innerHTML = `<h3>${t('v5.featureInfo')}</h3>` + (insp ? insp(card.id, ll, Math.max(6, 10 * st.mpp)) : `<p class="fine">${t('v5.nothingHere')}</p>`) + `<p class="fine" dir="ltr">${ll[1].toFixed(5)}, ${ll[0].toFixed(5)}</p>`;
    }
    // exports: current view, with title, legend and source
    function composed() {
      const [w, h] = size(); const W = 1800, Hm = Math.round(W * h / w); const map0 = document.createElement('canvas');
      GAL.drawCard(map0, { ring: rings[0].ring, style: rings[0].style }, card, { center: [st.cx, st.cy], mpp: st.mpp * w / W, w: W, h: Hm, ratio: 1, overlays: rings.slice(1).map(r => ({ coords: r.ring, color: (r.style && r.style.color) || '#992B2A', width: 3, dash: r.style && r.style.dash })) });
      const font = getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif'; const rtl = I.dir() === 'rtl';
      const out = document.createElement('canvas'); out.width = W; out.height = Hm + 300; const ctx = out.getContext('2d'); ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, W, out.height); ctx.fillStyle = '#992B2A'; ctx.fillRect(0, 0, W, 6);
      const x0 = rtl ? W - 36 : 36; ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillStyle = '#1C1E21'; ctx.font = `700 38px ${font}`; ctx.fillText(String(o.title || card.title).replace(/<[^>]+>/g, ''), x0, 58);
      if (o.subtitle) { ctx.font = `22px ${font}`; ctx.fillStyle = '#3C4046'; ctx.fillText(o.subtitle, x0, 92); }
      ctx.drawImage(map0, 0, 110);
      let y = root.GA.compare.legendCanvas(ctx, card.legend || [], 36, Hm + 150, W - 72, rtl, font);
      ctx.font = `16px ${font}`; ctx.fillStyle = '#5E636A'; ctx.textAlign = rtl ? 'right' : 'left';
      if (card.src) ctx.fillText(`${card.src.name} · ${card.src.detail || ''} · ${card.src.license || ''} · EPSG:25830 · Granada Atlas ${new Date().toISOString().slice(0, 10)}`, x0, out.height - 20);
      return out;
    }
    sh.el.addEventListener('click', (e) => {
      const z = e.target.closest('[data-z]'); if (z) { if (z.dataset.z === 'in') zoomBy(1 / 1.5); else if (z.dataset.z === 'out') zoomBy(1.5); else reset(); return; }
      const x = e.target.closest('[data-x]'); if (!x) return; const slug = o.slug || card.id; const cvs = composed();
      if (x.dataset.x === 'png') cvs.toBlob(bl => dl(bl, `granada_${slug}.png`), 'image/png');
      else { const bytes = root.GA.pdf.build([{ canvas: cvs, paper: cvs.width > cvs.height ? 'A4L' : 'A4P' }], { title: 'Granada Atlas — ' + String(o.title || card.title).replace(/<[^>]+>/g, '') }); dl(new Blob([bytes], { type: 'application/pdf' }), `granada_${slug}.pdf`); }
    });
    const ro = new ResizeObserver(() => { if (!fit0) reset(); else draw(); }); ro.observe(stage);
    const close0 = sh.close; sh.close = (s) => { ro.disconnect(); close0(s); };
    root.GA.lastViewer = { kind: 'map', get state() { return Object.assign({}, st); }, inspectAt, zoomBy, composed, close: () => sh.close() };
    return sh;
  }
  function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }

  // ---------- image viewer (photos, scans, image-only reference maps) ----------
  // pan / zoom / pinch for any element inside a stage (mouse wheel, drag, two-finger pinch, buttons, keys)
  function panZoom(stage, target, opt) {
    opt = opt || {}; const max = opt.max || 8; let s = 1, x = 0, y = 0; target.style.transformOrigin = '0 0';
    const apply = () => { target.style.transform = `translate(${x}px, ${y}px) scale(${s})`; opt.onChange && opt.onChange({ s, x, y }); };
    const reset = () => { s = 1; x = 0; y = 0; apply(); };
    const zoom = (f, cx, cy) => { const r = stage.getBoundingClientRect(); cx = cx == null ? r.width / 2 : cx; cy = cy == null ? r.height / 2 : cy; const s2 = Math.max(1, Math.min(max, s * f)); const k = s2 / s; x = cx - (cx - x) * k; y = cy - (cy - y) * k; s = s2; if (s === 1) { x = 0; y = 0; } apply(); };
    const ptrs = new Map(); let g0 = null; let moved = 0;
    stage.addEventListener('pointerdown', (e) => { if (e.button > 0) return; stage.setPointerCapture(e.pointerId); const r = stage.getBoundingClientRect(); ptrs.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]); g0 = { p: [...ptrs.values()].map(v => v.slice()), s, x, y }; moved = 0; });
    stage.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId) || !g0) return; const r = stage.getBoundingClientRect(); ptrs.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]); const p = [...ptrs.values()];
      if (p.length === 1 && g0.p.length === 1) { const dx = p[0][0] - g0.p[0][0], dy = p[0][1] - g0.p[0][1]; moved = Math.max(moved, Math.hypot(dx, dy)); if (s > 1) { x = g0.x + dx; y = g0.y + dy; apply(); } }
      else if (p.length >= 2 && g0.p.length >= 2) { moved = 99; const d0 = Math.hypot(g0.p[0][0] - g0.p[1][0], g0.p[0][1] - g0.p[1][1]) || 1, d1 = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); const m = [(g0.p[0][0] + g0.p[1][0]) / 2, (g0.p[0][1] + g0.p[1][1]) / 2]; const s2 = Math.max(1, Math.min(max, g0.s * d1 / d0)); const k = s2 / g0.s; s = s2; x = m[0] - (m[0] - g0.x) * k; y = m[1] - (m[1] - g0.y) * k; apply(); } });
    const up = (e) => { ptrs.delete(e.pointerId); g0 = ptrs.size ? { p: [...ptrs.values()].map(v => v.slice()), s, x, y } : null; };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    // stage point (client coordinates) → coordinates on the untransformed target
    const toLocal = (cx, cy) => { const r = stage.getBoundingClientRect(); const ox = target.offsetLeft || 0, oy = target.offsetTop || 0; return [(cx - r.left - ox - x) / s, (cy - r.top - oy - y) / s]; };
    return { zoom, reset, toLocal, get state() { return { s, x, y }; }, get moved() { return moved; } };
  }
  function image(o) {
    const sh = shell({ kind: 'vw-img' + (o.kind ? ' ' + o.kind : ''), title: esc(o.title || ''), subtitle: o.subtitle ? esc(o.subtitle) : '',
      tools: `${o.tools || ''}<div class="vw-zoom" role="group"><button class="btn btn-small" data-z="in">＋<span class="lbl">${t('v5.zoomIn')}</span></button><button class="btn btn-small" data-z="out">－<span class="lbl">${t('v5.zoomOut')}</span></button><button class="btn btn-small" data-z="reset">${t('v5.resetView')}</button></div>${o.link ? `<a class="btn btn-small" href="${esc(o.link)}" target="_blank" rel="noopener">${t('v5.openSource')} ↗</a>` : ''}`,
      body: `<div class="vw-stage vw-imgstage" tabindex="0"><img alt="${esc(o.alt || o.title || '')}" draggable="false" src="${esc(o.src)}"><p class="vw-hint">${t(o.notGIS ? 'v5.imgHintNoGIS' : 'v5.imgHint')}</p></div>${o.meta ? `<aside class="vw-side"><section>${o.meta}</section></aside>` : ''}`,
      onKey: (e) => { const pz = sh && sh.onKeyZoom; if (!pz) return; if (e.key === '+' || e.key === '=') pz.zoom(1.4); if (e.key === '-') pz.zoom(1 / 1.4); if (e.key === '0') pz.reset(); },
    });
    const stage = sh.el.querySelector('.vw-stage'), img = stage.querySelector('img'); const pz = panZoom(stage, img, { max: 12 });
    sh.el.addEventListener('click', (e) => { const z = e.target.closest('[data-z]'); if (z) { if (z.dataset.z === 'in') pz.zoom(1.5); else if (z.dataset.z === 'out') pz.zoom(1 / 1.5); else pz.reset(); return; } const b = e.target.closest('[data-vtool]'); if (b && o.onTool) o.onTool(b.dataset.vtool, b); });
    sh.onKeyZoom = pz;
    root.GA.lastViewer = { kind: 'image', close: () => sh.close() };
    return sh;
  }

  // ---------- generic enlarged HTML (charts, tables) ----------
  function html(o) { const sh = shell({ kind: 'vw-html', title: esc(o.title || ''), subtitle: o.subtitle ? esc(o.subtitle) : '', tools: o.tools || '', body: `<div class="vw-doc">${o.html}</div>` }); root.GA.lastViewer = { kind: 'html', close: () => sh.close() }; return sh; }

  root.GA.viewer = { shell, map, image, html, inspector, panZoom, isOpen: () => !!open, close: () => open && open.close() };
})(window);
