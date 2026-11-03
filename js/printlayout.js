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
  // 5.18: no fixed page cap. The page canvas is probed at the requested size and lowered only if this browser cannot hold
  // it (e.g. iOS Safari ≈ 16.7 Mpx); any reduction is stated on the page and in the message — never upscaled silently.
  const MAX_SIDE = 32767, MAX_AREA = 268e6; // Chromium / Firefox canvas limits (side, area)
  // slots: what goes where. Templates divide the body; each slot holds one item (map, legend, section, analysis card,
  // wind rose, rainfall chart, uploaded image) with its own caption. Maps carry their own scale.
  const st = { paper: 'A3', orient: 'landscape', margin: 12, dpi: 200, title: '', subtitle: '', template: 'side', keepEmpty: false,
    slots: [{ type: 'map', denom: 5000, caption: '' }, { type: 'none', caption: '' }, { type: 'none', caption: '' }, { type: 'none', caption: '' }], images: [],
    mo: { denom: 50000, north: true, scalebar: true, areas: true } }; // 5.18 "map only": the map's own scale and its three marks
  const TEMPLATES = { side: 4, top3: 4, grid: 4, single: 1, maponly: 1 };
  // 5.18: the print options are kept in this browser (uploaded images are not stored; slots that held one become empty)
  const KEY = 'granada-atlas.print.v1';
  function persist() { try { const o = Object.assign({}, st, { images: undefined, slots: st.slots.map(sl => sl.type === 'image' ? { type: 'none', caption: sl.caption || '' } : Object.assign({}, sl)) }); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } }
  (function restore() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o) return;
    ['paper', 'orient', 'margin', 'dpi', 'title', 'subtitle', 'template', 'keepEmpty'].forEach(k => { if (o[k] != null) st[k] = o[k]; });
    if (!PAPERS[st.paper]) st.paper = 'A3'; if (!TEMPLATES[st.template]) st.template = 'side';
    if (Array.isArray(o.slots)) st.slots = o.slots.slice(0, 4).map(sl => (sl && sl.type !== 'image' ? sl : { type: 'none', caption: (sl && sl.caption) || '' }));
    if (o.mo) Object.assign(st.mo, o.mo); } catch (e) { } })();
  const pageMm = () => { const [a, b] = PAPERS[st.paper]; return st.orient === 'landscape' ? [b, a] : [a, b]; };
  const ptOf = (mm) => mm / 25.4 * 72;
  function canHold(w, h) { if (w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_AREA) return false;
    try { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (!g) return false; g.fillStyle = '#123456'; g.fillRect(w - 1, h - 1, 1, 1);
      const px = g.getImageData(w - 1, h - 1, 1, 1).data; const ok = px[0] === 0x12 && px[2] === 0x56; c.width = c.height = 0; return ok; } catch (e) { return false; } }
  function effDpi(dpi) { const [w, h] = pageMm(); let d = dpi; while (d > 72 && !canHold(Math.round(w / 25.4 * d), Math.round(h / 25.4 * d))) d -= 25; return Math.max(72, d); }
  // 5.13: text scales with the paper so it is readable at the intended print size (A4 body ≈ 9 pt; A1 ≈ 2.8× larger)
  const FS = { A4: 1, A3: 1.41, A2: 2, A1: 2.83 }; const fsOf = () => FS[st.paper] || 1;
  // slots actually used: empty ones are omitted by default and the others take their space (option: keep empty slots)
  // 5.15: when the page has a map, its legend is drawn under it — a separate legend slot is dropped (the others reflow)
  const usedSlots = () => { const n = TEMPLATES[st.template]; const hasMap = st.slots.slice(0, n).some(sl => sl && sl.type === 'map'); const all = st.slots.slice(0, n).map((sl, i) => ({ sl, i })).filter(x => !(hasMap && x.sl && x.sl.type === 'legend')); return st.keepEmpty ? all : all.filter(x => x.sl && x.sl.type !== 'none'); };
  // slot rectangles in mm for the chosen template (gap and caption band scale with the paper)
  function layout() {
    const [W, H] = pageMm(); const m = st.margin; const f = fsOf();
    if (st.template === 'maponly') return { W, H, m, head: 0, foot: 0, f, rects: [{ x: m, y: m, w: W - 2 * m, h: H - 2 * m }], mapOnly: true }; // 5.18: page = map
    const head = 22 * f, foot = 16 * f; const B = { x: m, y: m + head, w: W - 2 * m, h: H - 2 * m - head - foot }; const g = 6 * Math.sqrt(f); let R;
    const n = usedSlots().length; const tpl = st.keepEmpty || n === TEMPLATES[st.template] ? st.template : n <= 1 ? 'single' : n === 2 ? 'pair' : st.template === 'grid' ? 'grid3' : 'side3';
    if (tpl === 'single') R = [B];
    else if (tpl === 'pair') { const w1 = B.w * 0.72, w2 = B.w - w1 - g; R = [{ x: B.x, y: B.y, w: w1, h: B.h }, { x: B.x + w1 + g, y: B.y, w: w2, h: B.h }]; }
    else if (tpl === 'side3') { const w1 = B.w * 0.68, w2 = B.w - w1 - g, h = (B.h - g) / 2; R = [{ x: B.x, y: B.y, w: w1, h: B.h }, { x: B.x + w1 + g, y: B.y, w: w2, h }, { x: B.x + w1 + g, y: B.y + h + g, w: w2, h }]; }
    else if (tpl === 'grid3') { const w = (B.w - g) / 2, h = (B.h - g) / 2; R = [{ x: B.x, y: B.y, w, h: B.h }, { x: B.x + w + g, y: B.y, w, h }, { x: B.x + w + g, y: B.y + h + g, w, h }]; }
    else if (st.template === 'grid') { const w = (B.w - g) / 2, h = (B.h - g) / 2; R = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, k]) => ({ x: B.x + i * (w + g), y: B.y + k * (h + g), w, h })); }
    else if (st.template === 'top3') { const h1 = B.h * 0.64, h2 = B.h - h1 - g, w = (B.w - 2 * g) / 3; R = [{ x: B.x, y: B.y, w: B.w, h: h1 }].concat([0, 1, 2].map(i => ({ x: B.x + i * (w + g), y: B.y + h1 + g, w, h: h2 }))); }
    else { const w1 = B.w * 0.7, w2 = B.w - w1 - g, h = (B.h - 2 * g) / 3; R = [{ x: B.x, y: B.y, w: w1, h: B.h }].concat([0, 1, 2].map(i => ({ x: B.x + w1 + g, y: B.y + i * (h + g), w: w2, h }))); }
    return { W, H, m, head, foot, f, rects: R };
  }
  // ---------- the map at a true scale ----------
  // 5.18: the map is rendered at EXACTLY the page's pixel size for its frame (wPx × hPx at `dpi`) — never at a lower
  // resolution and stretched. MapLibre caps its canvas (default 4096 px a side; GPUs at MAX_TEXTURE_SIZE / renderbuffer /
  // viewport limits), so when the frame needs more pixels it is rendered in overlapping tiles at the same zoom and the
  // tiles' interiors are stitched edge to edge. Each tile canvas is checked: a smaller canvas than requested (driver limit)
  // makes the tiles smaller, it never lowers the resolution. Tile containers are multiples of 96 CSS px, so every offset is
  // a whole device pixel at any integer dpi (no resampling at the seams).
  let GL_LIM = 0;
  function glLimit() {
    if (GL_LIM) return GL_LIM;
    try { const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
      const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS); GL_LIM = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), vp[0], vp[1]); } catch (e) { GL_LIM = 4096; }
    GL_LIM = Math.max(1024, Math.min(GL_LIM, 16384)); return GL_LIM;
  }
  const WS = (z) => 512 * Math.pow(2, z); // Web Mercator world size in CSS px at zoom z (MapLibre tiles are 512 px)
  const toWorld = (ll, z) => [(ll[0] + 180) / 360 * WS(z), (1 - Math.log(Math.tan(Math.PI / 4 + ll[1] * Math.PI / 360)) / Math.PI) / 2 * WS(z)];
  const fromWorld = (p, z) => [p[0] / WS(z) * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * p[1] / WS(z)))) * 180 / Math.PI];
  async function renderMap(frameMm, dpi, denom, opt) {
    opt = opt || {}; const main = root.GA.app.map; const c = main.getCenter(); const pr = dpi / 96;
    const wPx = opt.wPx || Math.round(frameMm.w / 25.4 * dpi), hPx = opt.hPx || Math.round(frameMm.h / 25.4 * dpi);
    const mppCss = denom * 0.0254 / 96; // ground metres per CSS px at 1:N (1 CSS px = 1/96 in on paper)
    const zoom = Math.log2(40075016.686 * Math.cos(c.lat * Math.PI / 180) / (512 * mppCss));
    const L = root.GA.app.L; if (L && L.printPrepare) await L.printPrepare(zoom);
    const style = main.getStyle(); const adj = (L && L.printStyle) ? L.printStyle(style, zoom) : {};
    if (opt.hideAreas) style.layers.forEach(l => { if (/^(saved-areas|sel-|fabric-no|measure-line)/.test(l.id)) l.layout = Object.assign({}, l.layout, { visibility: 'none' }); });
    const out = document.createElement('canvas'); out.width = wPx; out.height = hPx; const og = out.getContext('2d'); og.imageSmoothingEnabled = false;
    const M = 96; // CSS px of overlap rendered around every tile (labels near a seam are placed with the same neighbours)
    const lim = glLimit(); let tiles = 0, mpp = 0;
    const mk = (cw, ch) => { const div = document.createElement('div'); div.style.cssText = `position:fixed;left:-20000px;top:0;width:${cw}px;height:${ch}px;`; document.body.appendChild(div);
      const m = new maplibregl.Map({ container: div, style, center: c, zoom, bearing: 0, pitch: 0, pixelRatio: pr, maxCanvasSize: [lim, lim], interactive: false, preserveDrawingBuffer: true, attributionControl: false, fadeDuration: 0, renderWorldCopies: false });
      m.on('styleimagemissing', (e) => { try { const im = main.style && main.style.getImage && main.style.getImage(e.id); if (im) m.addImage(e.id, im.data, { pixelRatio: im.pixelRatio }); else if (e.id === 'ga-hatch') { const n = 8, d = new Uint8Array(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4, on = (x + y) % n === 0; d[o] = d[o + 1] = d[o + 2] = on ? 138 : 255; d[o + 3] = on ? 255 : 230; } m.addImage('ga-hatch', { width: n, height: n, data: d }); } } catch (err) { } });
      return { m, div }; };
    const idle = (m) => new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; m.once('idle', fin); setTimeout(fin, 60000); });
    const cw0 = toWorld([c.lng, c.lat], zoom);
    // tile container (CSS px, multiple of 96 → whole device px); one tile when the frame + overlap fits the limit
    let cap = Math.floor(Math.min(lim, 4096 * Math.max(1, Math.floor(lim / 4096))) / pr / 96) * 96, done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      const needW = Math.ceil((wPx / pr + 2 * M) / 96) * 96, needH = Math.ceil((hPx / pr + 2 * M) / 96) * 96;
      const cw = Math.min(needW, cap), ch = Math.min(needH, cap); const inW = Math.round((cw - 2 * M) * pr), inH = Math.round((ch - 2 * M) * pr);
      const { m, div } = mk(cw, ch); let ok = true;
      try {
        if (m.getCanvas().width !== Math.round(cw * pr) || m.getCanvas().height !== Math.round(ch * pr)) { ok = false; }
        else {
          for (let oy = 0; oy < hPx && ok; oy += inH) for (let ox = 0; ox < wPx && ok; ox += inW) {
            // this tile's interior starts at device (ox, oy) of the frame; its container centre in frame CSS px:
            const ccx = (ox - M * pr) / pr + cw / 2, ccy = (oy - M * pr) / pr + ch / 2;
            const ll = fromWorld([cw0[0] + ccx - wPx / pr / 2, cw0[1] + ccy - hPx / pr / 2], zoom);
            const p = idle(m); m.jumpTo({ center: ll }); m.triggerRepaint(); await p;
            if (!mpp) { const y = ch / 2; mpp = root.GA.geo.haversine(m.unproject([0, y]).toArray(), m.unproject([cw, y]).toArray()) / cw; } // MapLibre's own ground metres per CSS px
            const sw = Math.min(inW, wPx - ox), sh = Math.min(inH, hPx - oy);
            og.drawImage(m.getCanvas(), Math.round(M * pr), Math.round(M * pr), sw, sh, ox, oy, sw, sh); tiles++;
          }
        }
      } finally { m.remove(); div.remove(); }
      if (ok) { done = true; break; } cap = Math.max(384, Math.floor(cap / 2 / 96) * 96); tiles = 0; // the driver gave a smaller canvas: smaller tiles
    }
    if (!done) throw new Error(t('v16.renderFail', { d: dpi })); // never a silent upscale
    // scale re-measured on the frame actually drawn: ground distance across its middle row / its width on paper
    const widthMm = wPx / dpi * 25.4; const ground = mpp * wPx / pr;
    return { img: out, measured: ground * 1000 / widthMm, mapDpi: wPx / (widthMm / 25.4), tiles, zoom, liteFootprints: !!adj.liteFootprints }; // measured: metres on the ground per mm on paper
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
  // items available for the slots
  const cards = () => [...document.querySelectorAll('#left-body .card')].map((c, i) => ({ i, title: (c.querySelector('h3, h4, .card-t') || {}).innerText || ('#' + (i + 1)), cv: c.querySelector('canvas') })).filter(x => x.cv && x.cv.width);
  function itemOptions(slot) {
    const L = root.GA.app.L; const o = [['none', t('pl.none')], ['map', t('pl.itMap')], ['legend', t('pl.legend')]];
    allSections().forEach(x => o.push(['section:' + x.s.id, t('pl.section') + ': ' + x.label]));
    cards().forEach(c => o.push(['card:' + c.i, t('pl.itCard') + ': ' + c.title]));
    if (L.byId.wind && L.byId.wind._url) o.push(['chart:wind', t('v9.lyWind') + ' (' + t('v9.s.' + L.S.wind.opts.season) + ')']);
    if (L.byId.rain && L.byId.rain._st) o.push(['chart:rain', t('v9.rainMonthly')]);
    st.images.forEach((im, i) => o.push(['image:' + i, t('pl.image') + ' ' + (i + 1) + (im.caption ? ': ' + im.caption : '')]));
    const cur = slot.type === 'section' || slot.type === 'card' || slot.type === 'chart' || slot.type === 'image' ? slot.type + ':' + slot.ref : slot.type;
    return o.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
  }
  const svgImage = (svg) => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.includes('xmlns') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')));
  async function drawLegend(g, X, r, F, rtl, f, opt) {
    opt = opt || {}; const C = P(); const items = opt.items || legendItems(); const cx = r.x, cw = r.w; const lx = rtl ? cx + cw : cx;
    // sizes in mm at z = 1 (A4); measured once, then scaled so the legend fills its slot (readable, no wasted space)
    const run = async (z, dry) => { let y = r.y; g.textAlign = rtl ? 'right' : 'left'; const lh = 3.3 * z, sw = 6 * z, sh = 3 * z;
      if (!opt.noTitle) { g.font = `700 ${X(3.4 * z)}px ${F}`; if (!dry) { g.fillStyle = C.ink; g.fillText(t('lg.title'), X(lx), X(y + 4 * z)); } y += 7 * z; }
      for (const it of items) {
        if (it.h) { g.font = `600 ${X(2.9 * z)}px ${F}`; if (!dry) { g.fillStyle = C.ink; g.fillText(it.h, X(lx), X(y + 3.4 * z)); } y += 5.2 * z; continue; }
        if (it.img) { const sz = Math.min(cw, 30 * z); if (!dry) { const im = await loadImg(it.img); if (im) g.drawImage(im, X(rtl ? cx + cw - sz : cx), X(y), X(sz), X(sz)); } y += sz + 2 * z; continue; }
        const sx = rtl ? cx + cw - sw : cx; g.font = `${X(2.6 * z)}px ${F}`; const tw = cw - sw - 2.5 * z; const lines = Math.min(3, Math.max(1, Math.ceil(g.measureText(it.text).width / X(tw))));
        if (!dry) { g.globalAlpha = it.op;
          if (it.kind === 'line') { g.strokeStyle = it.bc; g.lineWidth = Math.max(1, X(Math.max(0.25, it.bw * 0.26) * z)); g.setLineDash(it.bs === 'dashed' ? [X(1.2 * z), X(0.8 * z)] : []); g.beginPath(); g.moveTo(X(sx), X(y + sh / 2 + 0.5)); g.lineTo(X(sx + sw), X(y + sh / 2 + 0.5)); g.stroke(); g.setLineDash([]); }
          else if (it.kind === 'dot') { g.beginPath(); g.arc(X(sx + sw / 2), X(y + sh / 2 + 0.5), X(1.4 * z), 0, Math.PI * 2); g.fillStyle = it.bg; g.fill(); if (it.bw) { g.strokeStyle = it.bc; g.lineWidth = Math.max(1, X(0.3)); g.stroke(); } }
          else if (it.kind === 'hatch') { g.strokeStyle = C.grey; g.lineWidth = Math.max(1, X(0.15 * z)); g.strokeRect(X(sx), X(y + 0.5), X(sw), X(sh)); for (let q = 0; q < sw; q += 1.2 * z) { g.beginPath(); g.moveTo(X(sx + q), X(y + 0.5 + sh)); g.lineTo(X(sx + Math.min(sw, q + sh)), X(y + 0.5)); g.stroke(); } }
          else { g.fillStyle = it.bg; g.fillRect(X(sx), X(y + 0.5), X(sw), X(sh)); g.strokeStyle = it.bw ? it.bc : 'rgba(0,0,0,.3)'; g.lineWidth = Math.max(1, X(0.2 * z)); g.strokeRect(X(sx), X(y + 0.5), X(sw), X(sh)); }
          g.globalAlpha = 1; g.fillStyle = C.ink2; PG.wrap(g, it.text, X(rtl ? cx + cw - sw - 2.5 * z : cx + sw + 2.5 * z), X(y + 3 * z), X(tw), X(lh), 3); }
        y += Math.max(4.6 * z, lines * lh + 1.3 * z); }
      return y - r.y; };
    if (opt.z) { const hh = await run(opt.z, true); if (!opt.dry) await run(opt.z, false); return hh; }
    const need = await run(1, true); const z = Math.max(0.8 * f, Math.min(1.9 * f, (r.h - 2) / need)); await run(z, false); return need * z;
  }
  // 5.15: a map's legend sits directly UNDER its map, in columns across the map's width (never in a slot beside it)
  async function legendUnder(g, X, r, F, rtl, f, dry, z) {
    const items = legendItems(); if (!items.length) return 0; z = z || f; const colW = 64 * z; const n = Math.max(1, Math.min(4, Math.floor(r.w / colW))); const w = (r.w - (n - 1) * 4 * f) / n;
    // columns: split at headings when possible, balanced by item count
    const per = Math.ceil(items.length / n); const groups = []; let cur = [];
    items.forEach(it => { if (cur.length >= per && (it.h || cur.length >= per + 2)) { groups.push(cur); cur = []; } cur.push(it); }); if (cur.length) groups.push(cur);
    let hMax = 0; g.save(); g.font = `700 ${X(3.4 * z)}px ${F}`; g.textAlign = rtl ? 'right' : 'left'; if (!dry) { g.fillStyle = P().ink; g.fillText(t('lg.title'), X(rtl ? r.x + r.w : r.x), X(r.y + 4 * z)); } g.restore();
    for (let i = 0; i < groups.length && i < n; i++) { const x = rtl ? r.x + r.w - (i + 1) * w - i * 4 * f : r.x + i * (w + 4 * f); const hh = await drawLegend(g, X, { x, y: r.y + 6.5 * z, w, h: 1e6 }, F, rtl, f, { items: groups[i], z, noTitle: true, dry }); hMax = Math.max(hMax, hh); }
    return hMax + 6.5 * z;
  }
  function scaleBarMm(g, X, r, denom, F, rtl, f) { f = f || 1; const C = P(); const mmPerM = 1000 / denom; const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].filter(v => v * mmPerM <= r.w * 0.3).pop() || 10; const len = nice * mmPerM; const x0 = r.x + 5 * f, y0 = r.y + r.h - 7 * f;
    g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillRect(X(x0 - 2 * f), X(y0 - 8 * f), X(len + 20 * f), X(12 * f)); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#FFFFFF' : C.ink; g.fillRect(X(x0 + i * len / 4), X(y0), X(len / 4), X(1.4 * f)); } g.strokeStyle = C.ink; g.lineWidth = Math.max(1, X(0.15 * f)); g.strokeRect(X(x0), X(y0), X(len), X(1.4 * f));
    g.fillStyle = C.ink; g.font = `${X(2.6 * f)}px ${F}`; g.textAlign = 'left'; g.direction = 'ltr'; g.fillText('0', X(x0), X(y0 - 1 * f)); g.fillText(`${nf(nice)} m`, X(x0 + len + 1 * f), X(y0 + 1.4 * f)); g.font = `600 ${X(2.6 * f)}px ${F}`; g.fillText(`1:${nf(denom)}`, X(x0), X(y0 - 4.6 * f)); g.direction = rtl ? 'rtl' : 'ltr'; }
  // ---------- compose the page ----------
  // the map frame in whole device pixels of the page, so the map image is drawn 1:1 (no resampling, no stretching)
  const pxRect = (X, r) => { const x = Math.round(X(r.x)), y = Math.round(X(r.y)); return { x, y, w: Math.round(X(r.x + r.w)) - x, h: Math.round(X(r.y + r.h)) - y }; };
  async function compose(dpi, preview) {
    const L = layout(); const d = preview ? Math.min(dpi, 60) : effDpi(dpi); const k = d / 25.4; const F = PG.font(); const rtl = I.dir() === 'rtl'; const C = P();
    const cv = document.createElement('canvas'); cv.width = Math.round(L.W * k); cv.height = Math.round(L.H * k); const g = cv.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, cv.width, cv.height);
    const X = (mm) => mm * k; const al = rtl ? 'right' : 'left'; const tx = (mm) => rtl ? X(L.W - mm) : X(mm); g.direction = rtl ? 'rtl' : 'ltr';
    if (L.mapOnly) { // 5.18 "Map only": the map alone, as large as the paper allows; optional north arrow, scale bar, study areas
      const r = L.rects[0], denom = st.mo.denom || 50000, q = pxRect(X, r); const f = L.f;
      const m = await renderMap(r, d, denom, { wPx: q.w, hPx: q.h, hideAreas: !st.mo.areas }); g.drawImage(m.img, q.x, q.y);
      if (st.mo.north) PG.northArrow(g, X(r.x + r.w - 8 * f), X(r.y + 4 * f), X(1) / 3.4 * f);
      if (st.mo.scalebar) scaleBarMm(g, X, r, denom, F, rtl, f);
      const maps = [{ n: 1, denom, measured: m.measured, mapDpi: m.mapDpi, tiles: m.tiles, rect: q, liteFootprints: m.liteFootprints }];
      return { cv, dpi: d, maps, measured: m.measured, mapOnly: true };
    }
    const f = L.f; g.fillStyle = C.red; g.fillRect(0, 0, cv.width, X(2 * f)); g.textAlign = al; g.fillStyle = C.ink; g.font = `700 ${X(7 * f)}px ${F}`; g.fillText(st.title || t('pl.untitled'), tx(L.m), X(L.m + 9 * f));
    g.font = `${X(3.6 * f)}px ${F}`; g.fillStyle = C.ink2; g.fillText(st.subtitle || '', tx(L.m), X(L.m + 15 * f));
    const maps = []; const srcExtra = [];
    const used = usedSlots();
    for (let q = 0; q < L.rects.length && q < used.length; q++) {
      const n = used[q].i; const sl = used[q].sl; const R0 = L.rects[q]; if (!sl || sl.type === 'none') continue; const cap = sl.caption ? 6 * f : 0; const r = { x: R0.x, y: R0.y + cap, w: R0.w, h: R0.h - cap }; // 5.15: title above
      if (sl.type === 'map') { // map card: map, then its legend directly underneath (same width), never in a side slot
        let z = f, lh = await legendUnder(g, X, { x: r.x, y: 0, w: r.w }, F, rtl, f, true, z); if (lh > r.h * 0.42) { z = Math.max(0.75 * f, f * r.h * 0.42 / lh); lh = await legendUnder(g, X, { x: r.x, y: 0, w: r.w }, F, rtl, f, true, z); }
        const lgH = lh ? lh + 3 * f : 0; r.h -= lgH; if (lgH) await legendUnder(g, X, { x: r.x, y: r.y + r.h + 3 * f, w: r.w }, F, rtl, f, false, z);
        const q = pxRect(X, r); const m = await renderMap(r, d, sl.denom || 5000, { wPx: q.w, hPx: q.h }); g.drawImage(m.img, q.x, q.y); g.strokeStyle = C.ink; g.lineWidth = Math.max(1, X(0.3)); g.strokeRect(X(r.x), X(r.y), X(r.w), X(r.h));
        PG.northArrow(g, X(r.x + r.w - 8 * f), X(r.y + 4 * f), X(1) / 3.4 * f); scaleBarMm(g, X, r, sl.denom || 5000, F, rtl, f); maps.push({ n: n + 1, denom: sl.denom || 5000, measured: m.measured, mapDpi: m.mapDpi, tiles: m.tiles, rect: q, liteFootprints: m.liteFootprints }); }
      else if (sl.type === 'legend') await drawLegend(g, X, r, F, rtl, f);
      else if (sl.type === 'section') { const s = allSections().find(x => x.s.id === sl.ref); if (s) { const prof = await root.GA.section.compute(s.s); const sc = document.createElement('canvas'); const ratio = Math.max(1, d / 96);
        root.GA.section.draw(sc, prof, Object.assign(root.GA.section.optsFor(s.s), { w: Math.round(X(r.w) / ratio), h: Math.round(X(r.h) / ratio), ratio })); g.drawImage(sc, X(r.x), X(r.y), X(r.w), X(r.h)); g.strokeStyle = C.line2; g.lineWidth = 1; g.strokeRect(X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push('IGN MDT25 · OSM'); } }
      else if (sl.type === 'card') { const c = cards().find(x => String(x.i) === String(sl.ref)); if (c) { PG.drawImageFit(g, c.cv, X(r.x), X(r.y), X(r.w), X(r.h)); } }
      else if (sl.type === 'chart') { const Ly = root.GA.app.L.byId[sl.ref]; let im = null;
        if (sl.ref === 'wind' && Ly && Ly._url) im = await loadImg(Ly._url); else if (sl.ref === 'rain' && Ly && Ly._st) { const box = document.createElement('div'); box.innerHTML = Ly.legend(); const svg = box.querySelector('svg'); if (svg) im = await svgImage(svg.outerHTML); }
        if (im) { PG.drawImageFit(g, im, X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push('ERA5 (ECMWF/Copernicus) via Open-Meteo, CC BY 4.0'); } }
      else if (sl.type === 'image') { const im = st.images[+sl.ref]; if (im && im.img) { PG.drawImageFit(g, im.img, X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push(`${im.caption || t('pl.image')}: ${im.source || t('pl.noSource')}`); } }
      if (cap) { g.fillStyle = C.ink; g.font = `600 ${X(3.6 * f)}px ${F}`; g.textAlign = al; g.fillText(`${n + 1}. ${sl.caption}`, rtl ? X(R0.x + R0.w) : X(R0.x), X(R0.y + 4.2 * f)); }
    }
    const fy = L.H - L.m - L.foot + 4 * f; g.textAlign = al; g.fillStyle = C.ink; g.font = `600 ${X(3 * f)}px ${F}`;
    g.fillText(maps.length ? maps.map(m => t('pl.scaleLine', { n: nf(m.denom), p: st.paper, o: t('pl.' + st.orient), m: nf(m.measured, 0) })).join(' · ') : t('pl.noMap'), tx(L.m), X(fy + 3 * f));
    g.font = `${X(2.5 * f)}px ${F}`; g.fillStyle = C.ink3; g.fillText(t('pl.resLine', { d: nf(d), md: nf(maps.length ? Math.min(...maps.map(m => m.mapDpi)) : d, 0) }), tx(L.m), X(fy + 7 * f));
    PG.wrap(g, `${t('v7.sources')}: ${activeSources().concat(srcExtra).join(' · ')} · ${t('pl.made')} ${new Date().toISOString().slice(0, 10)}`, tx(L.m), X(fy + 10.8 * f), X(L.W - 2 * L.m), X(3.1 * f), 2);
    return { cv, dpi: d, maps, measured: maps.length ? maps[0].measured : null };
  }
  const loadImg = (src) => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  // ---------- page ----------
  function form() {
    const opt = (v, cur, l) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`; const n = TEMPLATES[st.template];
    while (st.slots.length < 4) st.slots.push({ type: 'none', caption: '' }); const mo = st.template === 'maponly';
    const chk = (k, l) => `<label class="chk"><input type="checkbox" data-mo="${k}" ${st.mo[k] ? 'checked' : ''}> ${l}</label>`;
    return `<div class="pl"><form class="pl-form" onsubmit="return false">
      ${mo ? '' : `<label>${t('pl.title')} <input type="text" data-pl="title" value="${esc(st.title)}"></label>
      <label>${t('pl.subtitle')} <input type="text" data-pl="subtitle" value="${esc(st.subtitle)}"></label>`}
      <div class="pl-row"><label>${t('pl.paper')} <select data-pl="paper">${Object.keys(PAPERS).map(k => opt(k, st.paper, `${k} (${PAPERS[k][0]} × ${PAPERS[k][1]} mm)`)).join('')}</select></label>
      <label>${t('pl.orient')} <select data-pl="orient">${opt('landscape', st.orient, t('pl.landscape'))}${opt('portrait', st.orient, t('pl.portrait'))}</select></label></div>
      <div class="pl-row"><label>${t('pl.margin')} <span class="u"><input type="number" min="5" max="40" step="1" data-pl="margin" value="${st.margin}"> mm</span></label>
      <label>${t('pl.dpi')} <select data-pl="dpi">${[150, 200, 300].map(v => opt(v, st.dpi, v + ' dpi')).join('')}</select></label></div>
      <p class="fine">${t('pl.scaleVsRes')}</p>
      <label>${t('pl.template')} <select data-pl="template">${Object.keys(TEMPLATES).map(k => opt(k, st.template, t('pl.tpl.' + k))).join('')}</select></label>
      ${mo ? `<fieldset class="pl-mo"><legend>${t('v16.moTitle')}</legend><p class="fine">${t('v16.moNote')}</p>
        <label class="u">${t('v16.moScale')} 1 : <select data-mo="denom">${SCALES.map(v => opt(v, st.mo.denom, nf(v))).join('')}</select></label>
        ${chk('north', t('v16.moNorth'))}${chk('scalebar', t('v16.moScalebar'))}${chk('areas', t('v16.moAreas'))}</fieldset>` : `
      <label class="chk"><input type="checkbox" data-pl="keepEmpty" ${st.keepEmpty ? 'checked' : ''}> ${t('v12.keepEmptySlots')}</label>
      <fieldset><legend>${t('pl.slots')}</legend>
        ${st.slots.slice(0, n).map((sl, i) => `<div class="pl-slot"><b class="num">${i + 1}</b><div class="pl-slot-b">
          <select data-slot="${i}" data-sk="item" aria-label="${esc(t('pl.slots'))} ${i + 1}">${itemOptions(sl)}</select>
          ${sl.type === 'map' ? `<label class="u">1 : <select data-slot="${i}" data-sk="denom">${SCALES.map(v => opt(v, sl.denom || 5000, nf(v))).join('')}</select></label>` : ''}
          <input type="text" data-slot="${i}" data-sk="caption" value="${esc(sl.caption || '')}" placeholder="${esc(t('pl.caption'))}" aria-label="${esc(t('pl.caption'))}">
          </div><span class="pl-mv"><button type="button" class="btn btn-tiny" data-mv="${i}:-1" ${i ? '' : 'disabled'} aria-label="${esc(t('pl.up'))}">↑</button><button type="button" class="btn btn-tiny" data-mv="${i}:1" ${i < n - 1 ? '' : 'disabled'} aria-label="${esc(t('pl.down'))}">↓</button></span></div>`).join('')}
      </fieldset>
      <fieldset><legend>${t('pl.images')}</legend>
        ${st.images.map((im, i) => `<div class="pl-img"><b class="num">${t('pl.image')} ${i + 1}</b><input type="text" data-img="${i}" data-ik="caption" value="${esc(im.caption || '')}" placeholder="${esc(t('pl.imgCaption'))}"><input type="text" data-img="${i}" data-ik="source" value="${esc(im.source || '')}" placeholder="${esc(t('pl.imgSourceHint'))}"></div>`).join('')}
        <label>${t('pl.addImage')} <input type="file" accept="image/*" data-pl="image"></label>
      </fieldset>`}
      <p class="fine">${t('pl.viewNote')} ${t('pl.cardNote')}</p>
      <div class="pl-btns"><button class="btn" data-pl-act="preview">${t('pl.preview')}</button><button class="btn btn-primary" data-pl-act="pdf">${t('pl.pdf')}</button><button class="btn" data-pl-act="png">${t('pl.png')}</button></div>
      <p class="fine" id="pl-msg" role="status"></p></form>
      <div class="pl-prev"><div class="pl-sheet" id="pl-sheet"><p class="fine">${t('pl.previewHint')}</p></div></div></div>`;
  }
  let busy = false;
  async function run(kind, body) {
    if (busy) return; busy = true; const msg = body.querySelector('#pl-msg'); msg.innerHTML = `<span class="spin"></span> ${t('pl.working')}`;
    const scaleTxt = (r) => r.maps.map(m => nf(m.measured, 0)).join(', ') || '—';
    try {
      if (kind === 'preview') { const r = await compose(60, true); const box = body.querySelector('#pl-sheet'); box.innerHTML = ''; r.cv.style.width = '100%'; r.cv.style.height = 'auto'; r.cv.className = 'pl-canvas'; box.appendChild(r.cv); msg.textContent = t('pl.previewDone', { m: scaleTxt(r) }); root.GA.lastPrint = r; }
      else { const r = await compose(st.dpi, false); const [W, H] = pageMm(); const name = r.mapOnly ? `granada_atlas_map_1-${st.mo.denom}_${st.paper}_${st.orient}` : `granada_atlas_${PG.slug(st.title || 'print')}_${st.paper}_${st.orient}`;
        if (kind === 'png') PG.download(await PG.toBlob(r.cv, 'image/png'), name + '.png'); else { const bytes = root.GA.pdf.build([{ canvas: r.cv, paper: [ptOf(W), ptOf(H)], quality: 0.92 }], { title: st.title || 'Granada Atlas print' }); root.GA.lastPrintPDF = bytes; PG.download(new Blob([bytes], { type: 'application/pdf' }), name + '.pdf'); }
        const mr = r.maps.length ? ' ' + t('v16.mapRes', { md: nf(Math.min(...r.maps.map(m => m.mapDpi)), 0), n: r.maps.reduce((a, m) => a + (m.tiles || 1), 0) }) + (r.maps.some(m => m.liteFootprints) ? ' ' + t('v16.liteNote') : '') : '';
        msg.textContent = t('pl.exported', { d: r.dpi, req: st.dpi, m: scaleTxt(r) }) + mr + (r.dpi < st.dpi ? ' ' + t('pl.dpiCapped') : ''); root.GA.lastPrint = r; }
    } catch (e) { console.error(e); msg.textContent = t('pl.failed') + ' ' + (e.message || e); } finally { busy = false; }
  }
  function render(body) {
    const redraw = () => { const keep = body.querySelector('#pl-sheet') && body.querySelector('#pl-sheet').innerHTML; body.innerHTML = form(); if (keep) body.querySelector('#pl-sheet').innerHTML = keep; };
    redraw();
    body.onchange = async (e) => { await change(e); persist(); };
    const change = async (e) => { const el = e.target;
      if (el.dataset.mo != null) { const k = el.dataset.mo; st.mo[k] = k === 'denom' ? +el.value : el.checked; return; }
      if (el.dataset.slot != null) { const sl = st.slots[+el.dataset.slot]; const k = el.dataset.sk;
        if (k === 'item') { const [type, ref] = el.value.split(/:(.*)/s); sl.type = type; sl.ref = ref || null; if (type === 'map' && !sl.denom) sl.denom = 5000; redraw(); }
        else if (k === 'denom') sl.denom = +el.value; else sl.caption = el.value; return; }
      if (el.dataset.img != null) { st.images[+el.dataset.img][el.dataset.ik] = el.value; return; }
      const k = el.dataset.pl; if (!k) return;
      if (k === 'image') { const f = el.files && el.files[0]; if (f) { const img = await loadImg(URL.createObjectURL(f)); if (img) { st.images.push({ img, caption: f.name.replace(/\.[^.]+$/, ''), source: '' }); const free = st.slots.slice(0, TEMPLATES[st.template]).find(x => x.type === 'none'); if (free) { free.type = 'image'; free.ref = String(st.images.length - 1); } } } redraw(); return; }
      if (k === 'keepEmpty') { st.keepEmpty = el.checked; return; }
      st[k] = (k === 'dpi' || k === 'margin') ? +el.value : el.value; if (k === 'template') redraw(); };
    body.oninput = (e) => { const el = e.target; if (el.dataset.pl === 'title' || el.dataset.pl === 'subtitle') { st[el.dataset.pl] = el.value; persist(); } };
    body.onclick = (e) => { const mv = e.target.closest('[data-mv]'); if (mv) { const [i, dd] = mv.dataset.mv.split(':').map(Number); const j = i + dd; [st.slots[i], st.slots[j]] = [st.slots[j], st.slots[i]]; persist(); redraw(); return; }
      const b = e.target.closest('[data-pl-act]'); if (b) run(b.dataset.plAct, body); };
  }
  PG.register('print', { plate: () => t('pl.plate'), title: () => t('pl.pageTitle'), render });
  root.GA.printLayout = { st, compose, layout, PAPERS, effDpi, TEMPLATES, renderMap, glLimit, KEY };
})(window);
