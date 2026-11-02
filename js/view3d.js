/* Optional 3D view of the main map (2D / 3D switch).
   Terrain (5.11): one MapLibre raster-dem source served by a local tile protocol (gadem://) that composites
     · inside the 20 × 20 km square: the repository's IGN MDT25 grid (25 m, data/terrain/dem_mdt25.bin);
     · outside it: open global elevation tiles (Terrain Tiles on AWS Open Data, Terrarium encoding — SRTM / GMTED /
       ETOPO1 / EU-DEM … compiled by Mapzen/Tilezen), sea floor clamped to sea level;
     · a 600 m blend inside the square's edge so the two models meet without a step.
     If the global tiles cannot be read, the terrain outside the square eases from the edge to a flat reference level over
     3 km (never a vertical wall or a stretched edge), the note says so, and below zoom 9 the terrain is switched off.
   Camera (5.11 fix): MapLibre 4 samples the ground under the map centre only when an animation starts. The first 3D
   animation used to start before any terrain tile had loaded, so the centre stayed at 0 m while Granada lies at 650–800 m;
   zooming in then put the camera INSIDE the terrain (the huge triangles). The centre elevation is now kept equal to the
   ground under the centre on every move and whenever a terrain tile arrives, and the tilt starts only after the tile
   under the centre has loaded.
   Buildings: opaque extrusions. Tagged height (measured) in the blue-grey family; floors × floor height (ESTIMATE) in the
   floor-band ramp of the 2D map; buildings with neither stay flat footprints (nothing invented). MapLibre stands each
   extrusion on the ground at its centroid and sinks its walls 10 m below it, so footprints on ground falling more than
   10 m can show a gap on the downhill side (counted in the note). Facades are plain blocks: no facade detail is implied.
   Switching keeps the map's centre, the selected fabrics and the active layers; rotation and tilt exist only in 3D. */
(function (root) {
  const { i18n: I } = root.GA; const t = (k, v) => I.t(k, v); const P = () => root.GA.palette;
  let on = false, dem = null, ctl = null, addedBld = false; const FLOOR_H = 3;
  const GLOBAL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const state = { global: 'unknown', globalErr: '' }; // 'ok' | 'failed' | 'unknown'
  // ---------- DEM tiles (output: Mapbox Terrain-RGB encoding: h = -10000 + (R·65536 + G·256 + B) · 0.1) ----------
  function tileToLL(x, y, z) { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return [x / Math.pow(2, z) * 360 - 180, 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))]; }
  const BLEND = 600, RAMP = 3000; // m
  let edgeMean = null;
  function demEdgeMean() { if (edgeMean != null) return edgeMean; let s = 0, n = 0; const W = dem.width, H = dem.height - 1; for (let i = 0; i < W; i++) [0, H - 1].forEach(j => { const v = dem.arr[j * W + i]; if (v !== dem.nodata) { s += v; n++; } }); for (let j = 0; j < H; j++) [0, W - 1].forEach(i => { const v = dem.arr[j * W + i]; if (v !== dem.nodata) { s += v; n++; } }); return (edgeMean = n ? s / n : 0); }
  async function globalTile(z, x, y) {
    const zz = Math.min(z, 15); const url = GLOBAL.replace('{z}', zz).replace('{x}', x).replace('{y}', y);
    const r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw new Error('HTTP ' + r.status); const bmp = await createImageBitmap(await r.blob());
    const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
    const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, 256, 256); const d = g.getImageData(0, 0, 256, 256).data; const out = new Float32Array(256 * 256);
    for (let i = 0; i < out.length; i++) { const h = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768; out[i] = h < 0 ? 0 : h; } // sea floor → sea level (the water surface is drawn flat)
    return out;
  }
  async function demTile(z, x, y) {
    if (!dem) dem = await root.GA.data.grid('dem'); const S = 256; const PJ = root.GA.proj;
    const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S });
    const g = cv.getContext('2d'); const img = g.createImageData(S, S);
    const [w, n] = tileToLL(x, y, z), [e, s] = tileToLL(x + 1, y + 1, z);
    // the DEM square in EPSG:25830, one cell inside its edges (the last row of the file is nodata)
    const X0 = dem.ox + dem.px, X1 = dem.ox + (dem.width - 2) * dem.px, Y1 = dem.oy - dem.py, Y0 = dem.oy - (dem.height - 2) * dem.py;
    // does the tile touch the square (or the blend ramp around it)? test the four corners + centre in 25830
    const cs = [[w, n], [e, n], [w, s], [e, s], [(w + e) / 2, (n + s) / 2]].map(p => PJ.EPSG25830.forward(p));
    const near = !(Math.min(...cs.map(c => c[0])) > X1 + RAMP || Math.max(...cs.map(c => c[0])) < X0 - RAMP || Math.min(...cs.map(c => c[1])) > Y1 + RAMP || Math.max(...cs.map(c => c[1])) < Y0 - RAMP);
    let glob = null; if (state.global !== 'failed') { try { glob = await globalTile(z, x, y); state.global = 'ok'; } catch (err) { state.global = 'failed'; state.globalErr = String(err && err.message || err); syncNote(); } }
    const ref = demEdgeMean();
    for (let j = 0; j < S; j++) { const lat = n + (s - n) * (j + 0.5) / S; for (let i = 0; i < S; i++) { const lon = w + (e - w) * (i + 0.5) / S; const o = j * S + i;
      let h;
      if (!near) h = glob ? glob[o] : ref;
      else {
        const u = PJ.EPSG25830.forward([lon, lat]); const cx = Math.max(X0, Math.min(X1, u[0])), cy = Math.max(Y0, Math.min(Y1, u[1]));
        const inside = cx === u[0] && cy === u[1]; const local = root.GA.data.sampleGrid(dem, cx, cy);
        if (inside) { // distance to the square's edge drives the blend towards the global model
          const dIn = Math.min(u[0] - X0, X1 - u[0], u[1] - Y0, Y1 - u[1]); const wl = glob ? Math.min(1, dIn / BLEND) : 1;
          h = local == null ? (glob ? glob[o] : ref) : (glob ? local * wl + glob[o] * (1 - wl) : local);
        } else { const dOut = Math.hypot(u[0] - cx, u[1] - cy);
          if (glob) h = glob[o]; else { const k = Math.min(1, dOut / RAMP); const sm = k * k * (3 - 2 * k); h = (local == null ? ref : local) * (1 - sm) + ref * sm; } }
      }
      const v = Math.max(0, Math.round((h + 10000) * 10)); img.data[o * 4] = (v >> 16) & 255; img.data[o * 4 + 1] = (v >> 8) & 255; img.data[o * 4 + 2] = v & 255; img.data[o * 4 + 3] = 255; } }
    g.putImageData(img, 0, 0); const blob = cv.convertToBlob ? await cv.convertToBlob({ type: 'image/png' }) : await new Promise(r => cv.toBlob(r, 'image/png')); return blob.arrayBuffer();
  }
  if (root.maplibregl && maplibregl.addProtocol) maplibregl.addProtocol('gadem', async (params) => { const m = params.url.match(/gadem:\/\/(\d+)\/(\d+)\/(\d+)/); return { data: await demTile(+m[1], +m[2], +m[3]) }; });

  // ---------- camera: keep the centre on the ground ----------
  function ground(map) { try { const tr = map.transform; return map.terrain ? map.terrain.getElevationForLngLatZoom(map.getCenter(), tr.tileZoom) : 0; } catch (e) { return null; } }
  function syncElevation() { const map = root.GA.app.map; if (!on || !map.terrain) return; const g = ground(map); if (g == null || !isFinite(g)) return; if (Math.abs(map.transform.elevation - g) > 0.5) { map.transform.elevation = g; map.triggerRepaint(); } }
  function demReadyAtCenter(map, ms) {
    return new Promise((res) => { let done = false; const fin = () => { if (done) return; done = true; map.off('sourcedata', f); clearTimeout(tm); res(); };
      const f = (e) => { if (e.sourceId === 'ga-dem' && map.isSourceLoaded('ga-dem') && ground(map) > 1) fin(); }; const tm = setTimeout(fin, ms || 6000); map.on('sourcedata', f); if (map.isSourceLoaded('ga-dem') && ground(map) > 1) fin(); });
  }
  // terrain off at regional scales when the global model is not available (no plateau over Spain or the sea)
  function terrainForZoom() { const map = root.GA.app.map; if (!on) return; const want = !(state.global === 'failed' && map.getZoom() < 9); const has = !!map.terrain; if (want !== has) { try { map.setTerrain(want ? { source: 'ga-dem', exaggeration: 1 } : null); } catch (e) { } } }

  // ---------- buildings ----------
  const heightExpr = (est) => est ? ['*', ['to-number', ['get', 'lv'], 0], FLOOR_H] : ['to-number', ['get', 'h'], 0];
  function colours() { const C = P(); return C.extrude; }
  function addBuildings(map) {
    const src = 'ly-bld'; if (!map.getSource(src)) return false; const X = colours();
    const est = ['match', ['get', 'band'], '1-2', X.estimate['1-2'], '3-4', X.estimate['3-4'], '5-8', X.estimate['5-8'], '9+', X.estimate['9+'], X.estimate['1-2']];
    if (!map.getLayer('ga3d-est')) map.addLayer({ id: 'ga3d-est', type: 'fill-extrusion', source: src, minzoom: 14, filter: ['all', ['!', ['>', ['to-number', ['get', 'h'], 0], 0]], ['>', ['to-number', ['get', 'lv'], 0], 0]], paint: { 'fill-extrusion-color': est, 'fill-extrusion-height': heightExpr(true), 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } });
    if (!map.getLayer('ga3d-h')) map.addLayer({ id: 'ga3d-h', type: 'fill-extrusion', source: src, minzoom: 14, filter: ['>', ['to-number', ['get', 'h'], 0], 0], paint: { 'fill-extrusion-color': X.measured, 'fill-extrusion-height': heightExpr(false), 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } });
    return true;
  }
  function removeBuildings(map) { ['ga3d-est', 'ga3d-h'].forEach(l => map.getLayer(l) && map.removeLayer(l)); }
  function supported(map) { try { const gl = map.painter && map.painter.context && map.painter.context.gl; return !!gl; } catch (e) { return false; } }
  // buildings whose footprint spans more than 10 m of ground (their downhill wall may show a gap) — counted for the note
  let steep = null;
  async function countSteep() { try { if (!dem) dem = await root.GA.data.grid('dem'); const src = root.GA.app.map.getSource('ly-bld'); const fs = (src && src._data && src._data.features) || []; const PJ = root.GA.proj; let n = 0, tot = 0;
    fs.forEach(f => { if (!(+f.properties.lv > 0 || +f.properties.h > 0)) return; tot++; const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : null; if (!ring) return; let lo = Infinity, hi = -Infinity; ring.forEach(p => { const u = PJ.EPSG25830.forward(p); const v = root.GA.data.sampleGrid(dem, u[0], u[1]); if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); if (hi - lo > 10) n++; });
    steep = { n, tot }; syncNote(); } catch (e) { } }

  async function enter() {
    const A = root.GA.app; const map = A.map; if (!supported(map)) { root.GA.toast && root.GA.toast(t('v10.no3d'), true); return; }
    if (!map.getSource('ga-dem')) map.addSource('ga-dem', { type: 'raster-dem', tiles: ['gadem://{z}/{x}/{y}'], tileSize: 256, maxzoom: 13, encoding: 'mapbox', attribution: 'Terrain Tiles (AWS Open Data; SRTM, GMTED2010, ETOPO1, EU-DEM)' });
    try { map.setTerrain({ source: 'ga-dem', exaggeration: 1 }); } catch (e) { root.GA.toast && root.GA.toast(t('v10.no3d'), true); return; }
    on = true; document.body.classList.add('view-3d'); sync();
    // buildings need the detail footprints: switch the floors layer on if no building layer is on (undone when leaving 3D)
    const L = A.L; addedBld = false; if (!['bld_floors', 'bld_fg', 'bld_period'].some(k => L.S[k] && L.S[k].on)) { L.setOn('bld_floors', true); addedBld = true; }
    const tryAdd = () => { if (!on) return; if (!addBuildings(map)) setTimeout(tryAdd, 600); }; tryAdd();
    map.dragRotate.enable(); map.touchZoomRotate.enableRotation(); map.setMaxPitch(70);
    await demReadyAtCenter(map, 6000); if (!on) return; syncElevation();
    map.easeTo({ pitch: 55, bearing: -20, zoom: Math.max(map.getZoom(), 15), duration: 900 });
    map.once('moveend', () => { syncElevation(); countSteep(); }); root.GA.trees3d && root.GA.trees3d.setOn(true);
  }
  function exit() {
    const A = root.GA.app; const map = A.map; on = false; removeBuildings(map); root.GA.trees3d && root.GA.trees3d.setOn(false); try { map.setTerrain(null); } catch (e) { }
    map.transform.elevation = 0; map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); map.dragRotate.disable(); map.touchZoomRotate.disableRotation();
    if (addedBld) { A.L.setOn('bld_floors', false); addedBld = false; } document.body.classList.remove('view-3d'); sync();
  }
  function reset() { const map = root.GA.app.map; syncElevation(); map.easeTo({ pitch: on ? 55 : 0, bearing: on ? -20 : 0, duration: 600 }); }
  function legendHTML() {
    if (!on) return ''; const X = colours(); const sw = (c, l) => `<li><i class="sw" style="background:${c}"></i><span>${l}</span></li>`;
    return `<div class="lg-blk" data-ly="view3d"><h4>${t('v11.lg3d')}</h4><ul class="lg">${sw(X.measured, t('v11.lg3dMeasured'))}${['1-2', '3-4', '5-8', '9+'].map(k => sw(X.estimate[k], t('v11.lg3dEst', { v: '⁦' + k.replace('-', '–') + '⁩' }))).join('')}<li><i class="sw hatch"></i><span>${t('v11.lg3dFlat')}</span></li></ul></div>`;
  }
  function syncNote() { const n = document.getElementById('note-3d'); if (!n) return; n.hidden = !on; if (!on) return;
    const terr = state.global === 'failed' ? t('v11.terrFallback') : t('v11.terrGlobal');
    const st = steep && steep.n ? ' ' + t('v11.steepNote', { n: steep.n, t: steep.tot }) : '';
    n.innerHTML = `<details><summary>${t('v11.note3dTitle')}</summary><p>${t('v11.note3d')} ${terr}${st}</p></details>`; }
  function sync() { if (!ctl) return; const b = ctl.querySelector('[data-3d]'); b.textContent = on ? '2D' : '3D'; b.setAttribute('aria-pressed', String(on)); b.title = t(on ? 'v10.to2d' : 'v10.to3d'); b.setAttribute('aria-label', b.title);
    ctl.querySelector('[data-3dr]').hidden = !on; ctl.querySelector('[data-3dr]').textContent = t('v10.resetView'); syncNote(); }
  function init() {
    const A = root.GA.app; if (!A || !A.map) return setTimeout(init, 200); const map = A.map;
    const control = { onAdd() { const d = document.createElement('div'); d.className = 'maplibregl-ctrl maplibregl-ctrl-group ga-3dctl'; d.innerHTML = '<button type="button" data-3d aria-pressed="false">3D</button><button type="button" data-3dr hidden></button>';
      d.addEventListener('click', (e) => { if (e.target.closest('[data-3d]')) (on ? exit : enter)(); else if (e.target.closest('[data-3dr]')) reset(); }); ctl = d; sync(); return d; }, onRemove() { } };
    map.addControl(control, 'top-right');
    const note = document.createElement('div'); note.id = 'note-3d'; note.className = 'note-3d'; note.hidden = true; document.querySelector('.stage').appendChild(note);
    I.onChange(sync); map.on('styledata', () => { if (on) addBuildings(map); });
    let lastSync = 0; map.on('move', () => { const n = performance.now(); if (on && n - lastSync > 60) { lastSync = n; syncElevation(); } });
    map.on('moveend', () => { if (on) { syncElevation(); terrainForZoom(); } });
    map.on('sourcedata', (e) => { if (on && e.sourceId === 'ga-dem' && e.tile) syncElevation(); });
  }
  root.GA.view3d = { enter, exit, reset, isOn: () => on, demTile, legendHTML, state, syncElevation, ground: () => ground(root.GA.app.map) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
