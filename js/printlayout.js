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
  const DPIS = [150, 200, 300, 400, 500, 600, 700]; // 5.19: up to 700 dpi on every paper size (built in strips)
  // 5.19: no page-size cap — exports are built strip by strip at the requested dpi (see compose)
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
    ['paper', 'orient', 'margin', 'dpi', 'title', 'subtitle', 'template', 'keepEmpty', 'noLargeWarn'].forEach(k => { if (o[k] != null) st[k] = o[k]; });
    if (!PAPERS[st.paper]) st.paper = 'A3'; if (!TEMPLATES[st.template]) st.template = 'side';
    if (Array.isArray(o.slots)) st.slots = o.slots.slice(0, 4).map(sl => (sl && sl.type !== 'image' ? sl : { type: 'none', caption: (sl && sl.caption) || '' }));
    if (o.mo) Object.assign(st.mo, o.mo); } catch (e) { } })();
  const pageMm = () => { const [a, b] = PAPERS[st.paper]; return st.orient === 'landscape' ? [b, a] : [a, b]; };
  const ptOf = (mm) => mm / 25.4 * 72;
  function effDpi(dpi) { return dpi; } // 5.19: the requested dpi is always the real dpi (pages are built in strips)
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
  // 5.19: a map frame is rendered REGION BY REGION at the full output dpi and drawn straight into the page strip being
  // painted — the full map (and the full page) never exists as one canvas. One offscreen MapLibre map per frame, reused for
  // every region: its container holds the largest region plus an overlap margin M on every side (CSS px, a multiple of 96
  // so every offset is a whole device pixel at any integer dpi). All regions share one pixel grid (same zoom, centre offsets
  // in exact CSS px), so neighbouring regions meet without a seam. Before each capture the map must be idle with every tile
  // and the style loaded. Symbol labels are placed by MapLibre per viewport, so after each region the labels placed in each
  // shared seam band are compared with the neighbouring region's: a label repeated or missing at a seam is counted and
  // reported (never hidden). A canvas smaller than requested, a GPU too small for one region, or tiles that never load
  // stop the export with the reason — the dpi is never lowered.
  const JPEG_Q = 0.92; // strip JPEG quality (seams were a PDF placement issue, fixed in pdf.js 5.26 — not compression)
  let GL_LIM = 0;
  function glLimit() {
    if (GL_LIM) return GL_LIM;
    try { const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
      const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS); GL_LIM = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), vp[0], vp[1]); } catch (e) { GL_LIM = 4096; }
    GL_LIM = Math.max(1024, Math.min(GL_LIM, 8192)); return GL_LIM; // ≤ 8192: one region canvas stays ≤ 256 MB of GPU memory
  }
  const WS = (z) => 512 * Math.pow(2, z); // Web Mercator world size in CSS px at zoom z (MapLibre tiles are 512 px)
  const toWorld = (ll, z) => [(ll[0] + 180) / 360 * WS(z), (1 - Math.log(Math.tan(Math.PI / 4 + ll[1] * Math.PI / 360)) / Math.PI) / 2 * WS(z)];
  const fromWorld = (p, z) => [p[0] / WS(z) * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * p[1] / WS(z)))) * 180 / Math.PI];
  class Cancelled extends Error { constructor() { super(t('v17.cancelled')); this.cancelled = true; } }
  async function mapRenderer(frameMm, dpi, denom, q, opt) {
    opt = opt || {}; const ctl = opt.ctl || {}; const main = root.GA.app.map; const c = opt.center ? new maplibregl.LngLat(opt.center[0], opt.center[1]) : main.getCenter(); // 5.29: model sheets render around their own centre const pr = dpi / 96; const wPx = q.w, hPx = q.h;
    const mppCss = denom * 0.0254 / 96; // ground metres per CSS px at 1:N (1 CSS px = 1/96 in on paper)
    const zoom = Math.log2(40075016.686 * Math.cos(c.lat * Math.PI / 180) / (512 * mppCss));
    const L = root.GA.app.L; if (L && L.printPrepare) await L.printPrepare(zoom);
    const style = main.getStyle(); const adj = (L && L.printStyle) ? L.printStyle(style, zoom) : {};
    if (opt.hideAreas) style.layers.forEach(l => { if (/^(saved-areas|sel-|fabric-no|measure-line)/.test(l.id)) l.layout = Object.assign({}, l.layout, { visibility: 'none' }); });
    const symIds = style.layers.filter(l => l.type === 'symbol' && (l.layout || {}).visibility !== 'none').map(l => l.id);
    const lim = glLimit(); let M = 192; if ((2 * M + 96) * pr > lim) M = 96;
    if ((2 * M + 96) * pr > lim) throw new Error(t('v17.gpuSmall', { d: dpi, lim }));
    const cmax = Math.floor(lim / pr / 96) * 96; // largest container side (CSS px) the GPU canvas allows
    const inMax = Math.floor((cmax - 2 * M) * pr / 16) * 16; // largest region side (device px), a multiple of 16 (JPEG blocks)
    const cols = []; for (let x = 0; x < wPx; x += inMax) cols.push([x, Math.min(inMax, wPx - x)]);
    const cw0 = toWorld([c.lng, c.lat], zoom); let m = null, div = null, cw = 0, ch = 0, mpp = 0, renders = 0;
    const seam = { checked: 0, mismatches: 0, examples: [] }; const bands = {}; // `${row}:${col}` → { right: Set, bottom: Set }
    const ready = (mm) => mm.isStyleLoaded() && mm.areTilesLoaded() && mm.loaded();
    // captured only after a frame was drawn with the style, every source and every tile loaded — checked twice, a frame
    // apart. Polled, not event-driven: MapLibre emits no new 'idle' when a move needs nothing new, so waiting for it can stall.
    const frame = (mm) => new Promise((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; mm.once('render', fin); setTimeout(fin, 5000); mm.triggerRepaint(); });
    async function settle(mm) { const t0 = performance.now();
      while (performance.now() - t0 < 180000) { if (ctl.cancelled) throw new Cancelled(); await frame(mm);
        if (ready(mm)) { await frame(mm); if (ready(mm)) return true; } else await new Promise(r => setTimeout(r, 150)); }
      return false; }
    const keys = (box) => { const s = new Set(); if (!symIds.length) return s; try { m.queryRenderedFeatures(box, { layers: symIds.filter(id => m.getLayer(id)) }).forEach(f => s.add(`${f.layer.id}|${f.id == null ? '' : f.id}|${JSON.stringify(f.properties)}`)); } catch (e) { } return s; };
    const diff = (a, b) => [...a].filter(x => !b.has(x)).concat([...b].filter(x => !a.has(x)));
    function make(maxH) {
      cw = Math.ceil((Math.min(wPx, inMax) / pr + 2 * M) / 96) * 96; ch = Math.ceil((Math.min(maxH, inMax) / pr + 2 * M) / 96) * 96;
      div = document.createElement('div'); div.style.cssText = `position:fixed;left:-20000px;top:0;width:${cw}px;height:${ch}px;`; document.body.appendChild(div);
      m = new maplibregl.Map({ container: div, style, center: c, zoom, bearing: 0, pitch: 0, pixelRatio: pr, maxCanvasSize: [lim, lim], interactive: false, preserveDrawingBuffer: true, attributionControl: false, fadeDuration: 0, renderWorldCopies: false });
      m.on('styleimagemissing', (e) => { try { const im = main.style && main.style.getImage && main.style.getImage(e.id); if (im) m.addImage(e.id, im.data, { pixelRatio: im.pixelRatio }); else if (e.id === 'ga-hatch') { const n = 8, d = new Uint8Array(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4, on = (x + y) % n === 0; d[o] = d[o + 1] = d[o + 2] = on ? 138 : 255; d[o + 3] = on ? 255 : 230; } m.addImage('ga-hatch', { width: n, height: n, data: d }); } } catch (err) { } });
      if (m.getCanvas().width !== Math.round(cw * pr) || m.getCanvas().height !== Math.round(ch * pr)) { const got = [m.getCanvas().width, m.getCanvas().height]; dispose(); throw new Error(t('v17.canvasRefused', { w: Math.round(cw * pr), h: Math.round(ch * pr), gw: got[0], gh: got[1], d: dpi })); }
    }
    function dispose() { if (m) { m.remove(); m = null; } if (div) { div.remove(); div = null; } }
    const R = {
      inMax, cols, zoom, M, liteFootprints: !!adj.liteFootprints, seam,
      // regions this frame needs for a list of page strips [[top, bottom], …] (page px)
      count(strips) { return strips.reduce((a, [t0, t1]) => a + (Math.min(q.y + hPx, t1) > Math.max(q.y, t0) ? cols.length : 0), 0); },
      // MapLibre's own ground metres per CSS px (measured once, before any strip)
      async measure(maxH) { make(maxH); const t0 = performance.now(); while (!m.isStyleLoaded() && performance.now() - t0 < 60000) await new Promise(r => setTimeout(r, 100)); const y = ch / 2; mpp = root.GA.geo.haversine(m.unproject([0, y]).toArray(), m.unproject([cw, y]).toArray()) / cw; return mpp; },
      get measured() { return mpp * (wPx / pr) * 1000 / (wPx / dpi * 25.4); },
      get renders() { return renders; },
      // draw the part of this frame inside page rows [t0, t1) of `g` (g is translated to page coordinates); `row` = strip index
      async draw(g, t0, t1, row, tN) {
        const yA = Math.max(q.y, t0) - q.y, yB = Math.min(q.y + hPx, t1) - q.y; if (yB <= yA) return;
        const yN = Math.min(q.y + hPx, tN == null ? t1 : tN) - q.y; // nominal end of this strip (without the PDF overlap rows): seam bands sit here
        for (let ci = 0; ci < cols.length; ci++) {
          if (ctl.cancelled) throw new Cancelled();
          const [ox, w] = cols[ci], oy = yA, h = yB - yA;
          if (h / pr + 2 * M > ch) throw new Error(`region ${h} px taller than the map container`);
          const ccx = ox / pr - M + cw / 2, ccy = oy / pr - M + ch / 2; // container centre, frame CSS px
          const ll = fromWorld([cw0[0] + ccx - wPx / pr / 2, cw0[1] + ccy - hPx / pr / 2], zoom);
          m.jumpTo({ center: ll }); if (!(await settle(m))) throw new Error(t('v17.tilesTimeout'));
          g.drawImage(m.getCanvas(), M * pr, M * pr, w, h, q.x + ox, q.y + oy, w, h);
          // labels in the seam bands shared with the left and upper neighbours (each band spans the overlap on both sides)
          const iw = w / pr, ih = (yN - yA) / pr, key = `${row}:${ci}`, here = {};
          if (ci < cols.length - 1) here.right = keys([[M + iw - M, M], [M + iw + M, M + ih]]);
          if (yN < hPx) here.bottom = keys([[M, M + ih - M], [M + iw, M + ih + M]]);
          const cmp = (a, b, where) => { if (!a || !b) return; seam.checked++; const d = diff(a, b); if (d.length) { seam.mismatches++; if (seam.examples.length < 5) seam.examples.push(where + ': ' + d[0].split('|').slice(0, 1).concat((d[0].match(/"(?:name|name_[a-z]+|nm)":"([^"]*)"/) || [])[1] || '').join(' ')); } };
          const left = bands[`${row}:${ci - 1}`]; if (left) cmp(left.right, keys([[0, M], [2 * M, M + ih]]), `row ${row + 1} col ${ci}/${ci + 1}`);
          const up = bands[`${row - 1}:${ci}`]; if (up) cmp(up.bottom, keys([[M, 0], [M + iw, 2 * M]]), `rows ${row}/${row + 1} col ${ci + 1}`);
          bands[key] = here; delete bands[`${row - 1}:${ci}`];
          renders++; if (ctl.tick) ctl.tick();
        }
      },
      dispose,
    };
    return R;
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
  // 5.19: the page is painted in full-width horizontal STRIPS (each ≤ STRIP_PX pixels and no taller than a map region), each
  // handed to a sink (PDF strip image / PNG stream rows) and freed. Preview: one small canvas. Text, legend and frames are
  // redrawn in every strip (the canvas clips them); maps are filled region by region at the full dpi.
  const STRIP_PX = 24e6, OVERLAP = 16; // strip area (≈ 96 MB RGBA); rows a PDF strip repeats under the next one (no hairline)
  async function plan(dpi, preview, ctl) {
    const L = layout(); const d = preview ? Math.min(dpi, 60) : dpi; const k = d / 25.4; const F = PG.font(); const rtl = I.dir() === 'rtl'; const X = (mm) => mm * k; const f = L.f;
    const W = Math.round(L.W * k), H = Math.round(L.H * k); const g0 = document.createElement('canvas').getContext('2d'); // measuring only
    const items = []; const maps = [];
    if (L.mapOnly) { const r = L.rects[0], denom = st.mo.denom || 50000, q = pxRect(X, r); items.push({ type: 'maponly', r, q, denom, mr: await mapRenderer(r, d, denom, q, { hideAreas: !st.mo.areas, ctl }) }); }
    else {
      const used = usedSlots();
      for (let qi = 0; qi < L.rects.length && qi < used.length; qi++) {
        const n = used[qi].i; const sl = used[qi].sl; const R0 = L.rects[qi]; if (!sl || sl.type === 'none') continue; const cap = sl.caption ? 6 * f : 0; const r = { x: R0.x, y: R0.y + cap, w: R0.w, h: R0.h - cap };
        const it = { type: sl.type, sl, n, R0, r, cap };
        if (sl.type === 'map') { let z = f, lh = await legendUnder(g0, X, { x: r.x, y: 0, w: r.w }, F, rtl, f, true, z); if (lh > r.h * 0.42) { z = Math.max(0.75 * f, f * r.h * 0.42 / lh); lh = await legendUnder(g0, X, { x: r.x, y: 0, w: r.w }, F, rtl, f, true, z); }
          const lgH = lh ? lh + 3 * f : 0; r.h -= lgH; Object.assign(it, { z, lgH, denom: sl.denom || 5000 }); it.q = pxRect(X, r); it.mr = await mapRenderer(r, d, it.denom, it.q, { ctl }); }
        else if (sl.type === 'section') { const sx = allSections().find(x => x.s.id === sl.ref); if (sx) { const prof = await root.GA.section.compute(sx.s); const sc = document.createElement('canvas'); const ratio = Math.max(1, d / 96);
          root.GA.section.draw(sc, prof, Object.assign(root.GA.section.optsFor(sx.s), { w: Math.round(X(r.w) / ratio), h: Math.round(X(r.h) / ratio), ratio })); it.img = sc; } }
        else if (sl.type === 'chart') { const Ly = root.GA.app.L.byId[sl.ref];
          if (sl.ref === 'wind' && Ly && Ly._url) it.img = await loadImg(Ly._url); else if (sl.ref === 'rain' && Ly && Ly._st) { const box = document.createElement('div'); box.innerHTML = Ly.legend(); const svg = box.querySelector('svg'); if (svg) it.img = await svgImage(svg.outerHTML); } }
        items.push(it);
      }
    }
    const mrs = items.filter(x => x.mr).map(x => x.mr);
    // strip height: within the strip budget, no taller than a map region, a multiple of 16 rows (JPEG blocks)
    let S = preview ? H : Math.max(16, Math.floor(Math.min(H, STRIP_PX / W) / 16) * 16); mrs.forEach(mr => { S = Math.min(S, mr.inMax - (preview ? 0 : OVERLAP)); });
    S = Math.max(16, Math.floor(S / 16) * 16); const strips = []; for (let t0 = 0; t0 < H; t0 += S) strips.push([t0, Math.min(H, t0 + S)]);
    for (const mr of mrs) await mr.measure(Math.min(H, S + OVERLAP));
    return { L, d, k, X, F, rtl, f, W, H, items, strips, mrs, total: mrs.reduce((a, mr) => a + mr.count(strips.map(([a0, a1]) => [a0, Math.min(H, a1 + (preview ? 0 : OVERLAP))])), 0) };
  }
  // paint page rows [t0, t1) into g (already translated so page coordinates apply)
  async function paint(P0, g, t0, t1, row, tN) {
    const { L, d, X, F, rtl, f, W, items } = P0; const C = P(); const al = rtl ? 'right' : 'left'; const tx = (mm) => rtl ? X(L.W - mm) : X(mm);
    g.fillStyle = '#FFFFFF'; g.fillRect(0, t0, W, t1 - t0); g.direction = rtl ? 'rtl' : 'ltr';
    if (L.mapOnly) { const it = items[0], r = it.r; await it.mr.draw(g, t0, t1, row, tN);
      if (st.mo.north) PG.northArrow(g, X(r.x + r.w - 8 * f), X(r.y + 4 * f), X(1) / 3.4 * f);
      if (st.mo.scalebar) scaleBarMm(g, X, r, it.denom, F, rtl, f); return; }
    g.fillStyle = C.red; g.fillRect(0, 0, W, X(2 * f)); g.textAlign = al; g.fillStyle = C.ink; g.font = `700 ${X(7 * f)}px ${F}`; g.fillText(st.title || t('pl.untitled'), tx(L.m), X(L.m + 9 * f));
    g.font = `${X(3.6 * f)}px ${F}`; g.fillStyle = C.ink2; g.fillText(st.subtitle || '', tx(L.m), X(L.m + 15 * f));
    const srcExtra = [];
    for (const it of items) {
      const { sl, n, R0, r, cap } = it;
      if (it.type === 'map') { if (it.lgH) await legendUnder(g, X, { x: r.x, y: r.y + r.h + 3 * f, w: r.w }, F, rtl, f, false, it.z);
        await it.mr.draw(g, t0, t1, row, tN); g.strokeStyle = C.ink; g.lineWidth = Math.max(1, X(0.3)); g.strokeRect(X(r.x), X(r.y), X(r.w), X(r.h));
        PG.northArrow(g, X(r.x + r.w - 8 * f), X(r.y + 4 * f), X(1) / 3.4 * f); scaleBarMm(g, X, r, it.denom, F, rtl, f); }
      else if (it.type === 'legend') await drawLegend(g, X, r, F, rtl, f);
      else if (it.type === 'section') { if (it.img) { g.drawImage(it.img, X(r.x), X(r.y), X(r.w), X(r.h)); g.strokeStyle = C.line2; g.lineWidth = 1; g.strokeRect(X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push('IGN MDT25 · OSM'); } }
      else if (it.type === 'card') { const c = cards().find(x => String(x.i) === String(sl.ref)); if (c) PG.drawImageFit(g, c.cv, X(r.x), X(r.y), X(r.w), X(r.h)); }
      else if (it.type === 'chart') { if (it.img) { PG.drawImageFit(g, it.img, X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push('ERA5 (ECMWF/Copernicus) via Open-Meteo, CC BY 4.0'); } }
      else if (it.type === 'image') { const im = st.images[+sl.ref]; if (im && im.img) { PG.drawImageFit(g, im.img, X(r.x), X(r.y), X(r.w), X(r.h)); srcExtra.push(`${im.caption || t('pl.image')}: ${im.source || t('pl.noSource')}`); } }
      if (cap) { g.fillStyle = C.ink; g.font = `600 ${X(3.6 * f)}px ${F}`; g.textAlign = al; g.fillText(`${n + 1}. ${sl.caption}`, rtl ? X(R0.x + R0.w) : X(R0.x), X(R0.y + 4.2 * f)); }
    }
    const mi = items.filter(x => x.mr); const fy = L.H - L.m - L.foot + 4 * f; g.textAlign = al; g.fillStyle = C.ink; g.font = `600 ${X(3 * f)}px ${F}`;
    g.fillText(mi.length ? mi.map(x => t('pl.scaleLine', { n: nf(x.denom), p: st.paper, o: t('pl.' + st.orient), m: nf(x.mr.measured, 0) })).join(' · ') : t('pl.noMap'), tx(L.m), X(fy + 3 * f));
    g.font = `${X(2.5 * f)}px ${F}`; g.fillStyle = C.ink3; g.fillText(t('pl.resLine', { d: nf(d), md: nf(d, 0) }), tx(L.m), X(fy + 7 * f)); // every map region is rendered at the page dpi
    PG.wrap(g, `${t('v7.sources')}: ${activeSources().concat(srcExtra).join(' · ')} · ${t('pl.made')} ${new Date().toISOString().slice(0, 10)}`, tx(L.m), X(fy + 10.8 * f), X(L.W - 2 * L.m), X(3.1 * f), 2);
  }
  const result = (P0) => ({ dpi: P0.d, W: P0.W, H: P0.H, strips: P0.strips.length, mapOnly: !!P0.L.mapOnly,
    maps: P0.items.filter(x => x.mr).map(x => ({ n: x.n == null ? 1 : x.n + 1, denom: x.denom, measured: x.mr.measured, mapDpi: P0.d, tiles: x.mr.renders, rect: x.q, liteFootprints: x.mr.liteFootprints, seam: x.mr.seam, colW: x.mr.inMax, S: P0.strips[0][1] - P0.strips[0][0] })) }); // colW / S: where map regions meet (tests)
  // sink: null → one canvas (preview); otherwise { add(canvas, top, rows, drawnRows), end() }
  async function compose(dpi, preview, sink, ctl) {
    ctl = ctl || {}; const P0 = await plan(dpi, preview, ctl); ctl.total = P0.total; ctl.done = 0; if (ctl.onPlan) ctl.onPlan(P0);
    try {
      if (!sink) { const cv = document.createElement('canvas'); cv.width = P0.W; cv.height = P0.H; const g = cv.getContext('2d');
        for (let i = 0; i < P0.strips.length; i++) { const [t0, t1] = P0.strips[i]; g.save(); g.beginPath(); g.rect(0, t0, P0.W, t1 - t0); g.clip(); await paint(P0, g, t0, t1, i); g.restore(); }
        return Object.assign(result(P0), { cv, measured: P0.mrs.length ? P0.mrs[0].measured : null }); }
      for (let i = 0; i < P0.strips.length; i++) {
        if (ctl.cancelled) throw new Cancelled();
        const [t0, t1] = P0.strips[i]; const t1o = Math.min(P0.H, t1 + (sink.overlap ? OVERLAP : 0));
        const cv = document.createElement('canvas'); cv.width = P0.W; cv.height = t1o - t0; const g = cv.getContext('2d', { willReadFrequently: !!sink.readsPixels });
        g.translate(0, -t0); await paint(P0, g, t0, t1o, i, t1); g.setTransform(1, 0, 0, 1, 0, 0);
        await sink.add(cv, t0, t1 - t0, t1o - t0); cv.width = cv.height = 0; // free the strip before the next one
        if (ctl.strip) ctl.strip(i + 1, P0.strips.length);
      }
      const r = result(P0); r.blob = await sink.end(P0); r.measured = P0.mrs.length ? P0.mrs[0].measured : null; return r;
    } finally { P0.mrs.forEach(mr => mr.dispose()); }
  }
  // sinks: PDF = one JPEG per strip (strips overlap by OVERLAP rows, the next drawn over the previous); PNG = streamed rows
  function pdfSink(paperPt, dpi, title) { const parts = [];
    return { overlap: true, async add(cv, top, rows, drawn) { const b = await PG.toBlob(cv, 'image/jpeg', JPEG_Q); parts.push({ bytes: new Uint8Array(await b.arrayBuffer()), w: cv.width, h: drawn, x: 0, y: top }); },
      async end(P0) { return root.GA.pdf.buildStrips(parts, paperPt, dpi, { title }, [P0.W, P0.H]); }, parts }; }
  function pngSink(W, H) { if (!root.GA.pngStream.supported()) throw new Error(t('v17.noPngStream')); const enc = root.GA.pngStream.create(W, H);
    return { readsPixels: true, async add(cv, top, rows) { await enc.add(cv, rows); }, async end() { return enc.end(); }, abort() { enc.abort(); } }; }
  // what an export will cost, for the warning before very large pages
  function estimate(dpi) { const [w, h] = pageMm(); const W = Math.round(w / 25.4 * dpi), H = Math.round(h / 25.4 * dpi); const px = W * H;
    return { W, H, mpx: px / 1e6, pdfMB: px * 0.28 / 1e6, pngMB: px * 0.75 / 1e6, minutes: Math.max(1, Math.round(px / 1e6 * 0.025 + px / 1e6 * 0.012)) }; }
  const loadImg = (src) => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  // ---------- page ----------
  function form() {
    const opt = (v, cur, l) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`; const n = TEMPLATES[st.template];
    while (st.slots.length < 4) st.slots.push({ type: 'none', caption: '' }); const mo = st.template === 'maponly';
    const chk = (k, l) => `<label class="chk"><input type="checkbox" data-mo="${k}" ${st.mo[k] ? 'checked' : ''}> ${l}</label>`;
    return `<div class="pl"><form class="pl-form" onsubmit="return false">
      ${root.GA.modelPrint ? root.GA.modelPrint.html() : ''}
      ${mo ? '' : `<label>${t('pl.title')} <input type="text" data-pl="title" value="${esc(st.title)}"></label>
      <label>${t('pl.subtitle')} <input type="text" data-pl="subtitle" value="${esc(st.subtitle)}"></label>`}
      <div class="pl-row"><label>${t('pl.paper')} <select data-pl="paper">${Object.keys(PAPERS).map(k => opt(k, st.paper, `${k} (${PAPERS[k][0]} × ${PAPERS[k][1]} mm)`)).join('')}</select></label>
      <label>${t('pl.orient')} <select data-pl="orient">${opt('landscape', st.orient, t('pl.landscape'))}${opt('portrait', st.orient, t('pl.portrait'))}</select></label></div>
      <div class="pl-row"><label>${t('pl.margin')} <span class="u"><input type="number" min="5" max="40" step="1" data-pl="margin" value="${st.margin}"> mm</span></label>
      <label>${t('pl.dpi')} <select data-pl="dpi">${DPIS.map(v => opt(v, st.dpi, v + ' dpi')).join('')}</select></label></div>
      <p class="fine">${t('pl.scaleVsRes')}</p>
      <label class="chk"><input type="checkbox" data-pl="warnBig" ${st.noLargeWarn ? '' : 'checked'}> ${t('v17.warnOpt')}</label>
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
  const BIG_MPX = 100; // pages above this many megapixels ask first (size and time), unless the visitor said not to
  let ctlNow = null;
  function askBig(body, kind, e) {
    return new Promise((res) => { const msg = body.querySelector('#pl-msg');
      msg.innerHTML = `<span class="pl-warn">${esc(t('v17.bigWarn', { w: nf(e.W), h: nf(e.H), mpx: nf(e.mpx, 0), mb: nf(kind === 'png' ? e.pngMB : e.pdfMB, 0), min: nf(e.minutes) }))}${kind === 'png' ? ' ' + esc(t('v17.bigPng')) : ''}</span>
        <label class="chk"><input type="checkbox" id="pl-nowarn"> ${esc(t('v17.noWarn'))}</label>
        <span class="pl-btns"><button type="button" class="btn btn-primary" id="pl-go">${esc(t('v17.go'))}</button><button type="button" class="btn" id="pl-stop">${esc(t('v17.cancel'))}</button></span>`;
      msg.querySelector('#pl-go').onclick = () => { if (msg.querySelector('#pl-nowarn').checked) { st.noLargeWarn = true; persist(); } res(true); };
      msg.querySelector('#pl-stop').onclick = () => { msg.textContent = t('v17.cancelled'); res(false); }; });
  }
  async function run(kind, body) {
    if (busy) return; const msg = body.querySelector('#pl-msg'); const scaleTxt = (r) => r.maps.map(m => nf(m.measured, 0)).join(', ') || '—';
    if (kind !== 'preview') { const e = estimate(st.dpi); if (e.mpx > BIG_MPX && !st.noLargeWarn && !(await askBig(body, kind, e))) return; }
    busy = true; const ctl = ctlNow = { cancelled: false, done: 0, total: 0, t0: Date.now() };
    msg.innerHTML = `<span class="spin"></span> <span id="pl-prog">${esc(t('pl.working'))}</span> <button type="button" class="btn btn-tiny" id="pl-cancel">${esc(t('v17.cancel'))}</button>`;
    msg.querySelector('#pl-cancel').onclick = () => { ctl.cancelled = true; const b = msg.querySelector('#pl-cancel'); if (b) b.disabled = true; };
    const prog = () => { const el = msg.querySelector('#pl-prog'); if (el) el.textContent = t('v17.progress', { i: ctl.done, n: ctl.total, s: ctl.si || 0, sn: ctl.sn || 0 }); };
    ctl.tick = () => { ctl.done++; prog(); }; ctl.strip = (i, n) => { ctl.si = i; ctl.sn = n; prog(); }; ctl.onPlan = (P0) => { ctl.sn = P0.strips.length; prog(); };
    let sink = null;
    try {
      if (kind === 'preview') { const r = await compose(60, true, null, ctl); const box = body.querySelector('#pl-sheet'); box.innerHTML = ''; r.cv.style.width = '100%'; r.cv.style.height = 'auto'; r.cv.className = 'pl-canvas'; box.appendChild(r.cv); msg.textContent = t('pl.previewDone', { m: scaleTxt(r) }); root.GA.lastPrint = r; }
      else { const [W, H] = pageMm(); const name = st.template === 'maponly' ? `granada_atlas_map_1-${st.mo.denom}_${st.paper}_${st.orient}_${st.dpi}dpi` : `granada_atlas_${PG.slug(st.title || 'print')}_${st.paper}_${st.orient}_${st.dpi}dpi`;
        const e = estimate(st.dpi); sink = kind === 'png' ? pngSink(e.W, e.H) : pdfSink([ptOf(W), ptOf(H)], st.dpi, st.title || 'Granada Atlas print');
        const r = await compose(st.dpi, false, sink, ctl); root.GA.lastPrint = r; root.GA.lastPrintBlob = r.blob;
        PG.download(r.blob, name + (kind === 'png' ? '.png' : '.pdf'));
        const ms = r.maps; const seams = ms.reduce((a, m) => a + m.seam.mismatches, 0), checked = ms.reduce((a, m) => a + m.seam.checked, 0);
        const mr = ms.length ? ' ' + t('v16.mapRes', { md: nf(r.dpi, 0), n: ms.reduce((a, m) => a + (m.tiles || 1), 0) }) + (ms.some(m => m.liteFootprints) ? ' ' + t('v16.liteNote') : '') : '';
        const sm = !checked ? '' : ' ' + (seams ? t('v17.seamBad', { n: seams, c: checked, ex: ms.flatMap(m => m.seam.examples).slice(0, 2).join('; ') }) : t('v17.seamOk', { c: checked }));
        msg.textContent = t('pl.exported', { d: r.dpi, req: st.dpi, m: scaleTxt(r) }) + ' ' + t('v17.size', { w: nf(r.W), h: nf(r.H), s: r.strips, mb: nf(r.blob.size / 1e6, 1) }) + mr + sm; }
    } catch (err) { if (sink && sink.abort) sink.abort(); console.error(err); msg.textContent = err && err.cancelled ? t('v17.cancelled') : t('pl.failed') + ' ' + (err.message || err); }
    finally { busy = false; ctlNow = null; }
  }
  function render(body) {
    const redraw = () => { const keep = body.querySelector('#pl-sheet') && body.querySelector('#pl-sheet').innerHTML; body.innerHTML = form(); if (keep) body.querySelector('#pl-sheet').innerHTML = keep; if (root.GA.modelPrint) root.GA.modelPrint.mount(body); };
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
      if (k === 'warnBig') { st.noLargeWarn = !el.checked; return; }
      st[k] = (k === 'dpi' || k === 'margin') ? +el.value : el.value; if (k === 'template') redraw(); };
    body.oninput = (e) => { const el = e.target; if (el.dataset.pl === 'title' || el.dataset.pl === 'subtitle') { st[el.dataset.pl] = el.value; persist(); } };
    body.onclick = (e) => { const mv = e.target.closest('[data-mv]'); if (mv) { const [i, dd] = mv.dataset.mv.split(':').map(Number); const j = i + dd; [st.slots[i], st.slots[j]] = [st.slots[j], st.slots[i]]; persist(); redraw(); return; }
      const b = e.target.closest('[data-pl-act]'); if (b) run(b.dataset.plAct, body); };
  }
  PG.register('print', { plate: () => t('pl.plate'), title: () => t('pl.pageTitle'), render });
  root.GA.printLayout = { st, compose, layout, PAPERS, effDpi, TEMPLATES, glLimit, KEY, estimate, DPIS, pdfSink, pngSink, legendItems, mapRenderer, get running() { return ctlNow; }, // mapRenderer: the true-scale map renderer, reused by the model workshop sheets (5.29) // legendItems: what the printed legend lists (5.28 tests)
    _setGlLimit(n) { GL_LIM = n; } }; // test hook: simulate a smaller GPU
})(window);
