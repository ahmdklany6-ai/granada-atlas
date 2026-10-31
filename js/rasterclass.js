/* Classified display of external rasters (land-surface temperature, flood zones, strategic noise, tree-cover
   density). None of these services accepts another style (GIBS offers only "default"; the MITECO GeoServer ignores
   SLD_BODY and its INSPIRE styles drop the classes), so each tile is read as DATA: every pixel's colour is looked up in
   the service's own published classification (GIBS colormap XML, GeoServer legend rules, EEA raw values) to recover
   its value or class, and is then drawn in this atlas's palette. The legend is generated from the same class table, so
   map and legend cannot drift. If the classification cannot be loaded the original service tile and the service's own
   legend are shown together instead — never recoloured tiles with an unchanged legend. */
(function (root) {
  const P = root.GA.palette;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  // ---------- class tables (the single definition used by map tiles, legends, cards and exports) ----------
  // Land-surface temperature (°C), restrained cool→warm ramp with a neutral middle; no yellow.
  const LST = [
    { max: 30, col: '#3F6E8C', label: '< 30' }, { max: 35, col: '#93B3C6', label: '30–35' }, { max: 40, col: '#DAD9D3', label: '35–40' },
    { max: 45, col: '#E9BFAD', label: '40–45' }, { max: 50, col: '#CF7F69', label: '45–50' }, { max: 55, col: '#A63F38', label: '50–55' }, { max: Infinity, col: '#5E1A19', label: '≥ 55' }];
  // Strategic noise (dB(A), 5 dB bands as published by SICA), sequential purple; no yellow.
  const NOISE = [
    { v: 50, col: '#E9E3F0', src: '#64C800' }, { v: 55, col: '#CDBFE0', src: '#FFFF00' }, { v: 60, col: '#AA93CB', src: '#FFCD69' },
    { v: 65, col: '#8463AE', src: '#FF8000' }, { v: 70, col: '#5A3D84', src: '#FF0000' }, { v: 75, col: '#331F52', src: '#FF00FF' }];
  // Flood zones: return-period classes from ext.js (X.FLOOD colours); source colours from the SNCZI WMS styles.
  const FLOOD_SRC = { q10: ['#FF0000', '#A80000'], q50: ['#DF73FF', '#E472FA'], q100: ['#E8BEFF', '#BF94FE'], q500: ['#FF73DF', '#FA3FDB'], arpsi: ['#FA3411'] };
  const ARPSI_COL = '#0B2E4F'; // same as the ARPSI reaches drawn from WFS on the analysis cards

  // ---------- GIBS LST colormap (bundled copy of the official XML) ----------
  let lstMap = null; let lstEntries = null;
  const lstReady = fetch('data/ref/gibs_lst_colormap.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => {
    lstEntries = j.entries; lstMap = new Map(j.entries.map(([c, a, b]) => [(c[0] << 16) | (c[1] << 8) | c[2], (b == null || b > 400 ? a : (a + b) / 2)])); state.lst = 'ok';
  }).catch(e => { state.lst = 'fallback'; console.warn('LST colormap', e); });
  const state = { lst: 'loading', noise: 'ok', flood: 'ok', canopy: 'ok' };

  const lstClass = (c) => LST.find(k => c < k.max);
  function nearest(list, r, g, b) { let best = null, bd = 1e9; list.forEach(it => { const d = (it.rgb[0] - r) ** 2 + (it.rgb[1] - g) ** 2 + (it.rgb[2] - b) ** 2; if (d < bd) { bd = d; best = it; } }); return bd <= 70 * 70 ? best : null; }
  const noiseSrc = NOISE.map(n => ({ rgb: hex(n.src), out: hex(n.col) }));
  function floodSrc() { const X = root.GA.ext; const out = []; Object.entries(FLOOD_SRC).forEach(([k, cs]) => { const z = X.FLOOD.find(f => f.k === k); cs.forEach(c => out.push({ rgb: hex(c), out: hex(k === 'arpsi' ? ARPSI_COL : z.color), k })); }); return out; }

  // recolour RGBA pixels in place; returns counts by class key (for checks)
  function recolour(scheme, data, w) {
    const cache = new Map(); const fs = scheme === 'flood' ? floodSrc() : null;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const a = data[i + 3];
      if (a === 0) { if (scheme === 'lst') { const x = p % w, y = (p / w) | 0; if ((x + y) % 7 === 0) { data[i] = data[i + 1] = data[i + 2] = 140; data[i + 3] = 150; } } continue; }
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; let out = cache.get(key);
      if (out === undefined) {
        if (scheme === 'lst') { let K = lstMap.get(key); if (K == null) { let bd = 1e9; lstEntries.forEach(([c, a1, b1]) => { const d = (c[0] - data[i]) ** 2 + (c[1] - data[i + 1]) ** 2 + (c[2] - data[i + 2]) ** 2; if (d < bd) { bd = d; K = b1 == null || b1 > 400 ? a1 : (a1 + b1) / 2; } }); } out = hex(lstClass(K - 273.15).col); }
        else if (scheme === 'noise') { const n = nearest(noiseSrc, data[i], data[i + 1], data[i + 2]); out = n ? n.out : null; }
        else if (scheme === 'flood') { const n = nearest(fs, data[i], data[i + 1], data[i + 2]); out = n ? n.out : null; }
        cache.set(key, out);
      }
      if (!out) { data[i + 3] = 0; continue; }
      data[i] = out[0]; data[i + 1] = out[1]; data[i + 2] = out[2]; if (scheme !== 'lst' && a > 40) data[i + 3] = 255;
    }
  }
  const mkCanvas = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const toBuf = async (c) => c.convertToBlob ? (await c.convertToBlob({ type: 'image/png' })).arrayBuffer() : new Promise((res, rej) => c.toBlob(b => b ? b.arrayBuffer().then(res, rej) : rej(new Error('encode')), 'image/png'));

  // recolour an already-loaded image/canvas (analysis cards, Exercise 1.3, exports); returns a canvas
  async function recolourImage(scheme, img) {
    if (scheme === 'lst') await lstReady; if (scheme === 'lst' && state.lst !== 'ok') return null;
    const w = img.width, h = img.height; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h); recolour(scheme, d.data, w); g.putImageData(d, 0, 0); return c;
  }

  // ---------- MapLibre protocol: gacls://<scheme>?u=<encoded service URL with {bbox}> ----------
  async function tile(params) {
    const m = /^gacls:\/\/([a-z]+)\?(.*)$/.exec(params.url); const scheme = m[1]; const q = new URLSearchParams(m[2]);
    const src = q.get('u'); const bb = q.get('bbox');
    const url = src.replace('{bbox}', bb);
    if (scheme === 'canopy') { // raw tree-cover values (0–100) from the EEA ImageServer, coloured with ext.js TCD classes
      const X = root.GA.ext; const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
      const tif = await root.GA.tiffread.read(await r.arrayBuffer()); const c = mkCanvas(tif.width, tif.height); const g = c.getContext('2d'); const d = g.createImageData(tif.width, tif.height);
      for (let i = 0; i < tif.data.length; i++) { const v = tif.data[i]; const col = v > 100 ? null : X.tcdColour(v); if (!col) continue; d.data.set(col, i * 4); }
      g.putImageData(d, 0, 0); return { data: await toBuf(c) };
    }
    if (scheme === 'lst') await lstReady;
    const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); const buf = await r.arrayBuffer();
    if (scheme === 'lst' && state.lst !== 'ok') return { data: buf }; // fallback: original colours (legend switches to the service legend)
    const bm = await createImageBitmap(new Blob([buf])); const c = mkCanvas(bm.width, bm.height); const g = c.getContext('2d'); g.drawImage(bm, 0, 0);
    const d = g.getImageData(0, 0, bm.width, bm.height); recolour(scheme, d.data, bm.width); g.putImageData(d, 0, 0);
    return { data: await toBuf(c) };
  }
  let registered = false;
  function register() { if (registered || !root.maplibregl || !maplibregl.addProtocol) return; maplibregl.addProtocol('gacls', tile); registered = true; }
  // tiles template for a raster source: the service URL keeps a {bbox} placeholder MapLibre fills per tile
  const tiles = (scheme, serviceURL) => `gacls://${scheme}?bbox={bbox-epsg-3857}&u=${encodeURIComponent(serviceURL.replace('{bbox-epsg-3857}', '{bbox}'))}`;

  // ---------- legends from the same tables ----------
  const I = () => root.GA.i18n;
  function legendItems(scheme, opts) {
    const t = (k, v) => I().t(k, v); opts = opts || {};
    if (scheme === 'lst') return LST.map(k => ({ sw: k.col, label: `${k.label} °C` })).concat([{ hatch: true, label: t('rc.noData') }]);
    if (scheme === 'noise') { const ind = opts.ind || 'lden'; return NOISE.filter(n => ind === 'ln' || n.v >= 55).map((n, i, a) => ({ sw: n.col, label: `${n.v}–${n.v + 4}${i === a.length - 1 ? '+' : ''} dB(A)` })); }
    if (scheme === 'flood') { const X = root.GA.ext; const ks = opts.periods || X.FLOOD.map(z => z.k); return X.FLOOD.filter(z => ks.includes(z.k)).map(z => ({ sw: z.color, label: `T = ${z.T} · ${z.p} ${t('ly3.perYear')}` })).concat(opts.arpsi === false ? [] : [{ line: ARPSI_COL, w: 2, label: t('ly3.arpsi') }]); }
    if (scheme === 'canopy') { const X = root.GA.ext; return X.TCD_CLASSES.filter(c => c.col[3]).map(c => ({ sw: `rgb(${c.col.slice(0, 3).join(',')})`, label: `${c.k} %` })); }
    return [];
  }
  root.GA = root.GA || {}; root.GA.rasterClass = { LST, NOISE, FLOOD_SRC, ARPSI_COL, state, lstReady, register, tiles, recolour, recolourImage, legendItems, lstClass, _tile: tile };
})(window);
