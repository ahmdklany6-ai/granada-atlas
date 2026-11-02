/* Optional 3D view of the main map (2D / 3D switch). Terrain comes from the repository's own IGN MDT25 grid
   (data/terrain/dem_mdt25.bin), served to MapLibre through a local tile protocol — no external service. Buildings are
   extruded from their tagged height, or from floors × floor height as a labelled ESTIMATE (lighter); buildings with
   neither stay flat footprints (nothing invented). Facades are plain blocks: no façade detail is implied. Outside the
   20 × 20 km DEM square the terrain is held flat at the nearest edge value and the note says so.
   Switching keeps the map's centre, the selected fabrics and the active layers; rotation and tilt exist only in 3D. */
(function (root) {
  const { i18n: I } = root.GA; const t = (k, v) => I.t(k, v); const P = () => root.GA.palette;
  let on = false, dem = null, ctl = null, addedBld = false; const FLOOR_H = 3;
  // ---------- DEM tiles (Mapbox Terrain-RGB encoding: h = -10000 + (R·65536 + G·256 + B) · 0.1) ----------
  const R_M = 6378137;
  function tileToLL(x, y, z) { const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return [x / Math.pow(2, z) * 360 - 180, 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))]; }
  async function demTile(z, x, y) {
    if (!dem) dem = await root.GA.data.grid('dem'); const S = 256; const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S });
    const g = cv.getContext('2d'); const img = g.createImageData(S, S); const PJ = root.GA.proj;
    const [w, n] = tileToLL(x, y, z), [e, s] = tileToLL(x + 1, y + 1, z);
    for (let j = 0; j < S; j++) { const lat = n + (s - n) * (j + 0.5) / S; for (let i = 0; i < S; i++) { const lon = w + (e - w) * (i + 0.5) / S;
      let u = PJ.EPSG25830.forward([lon, lat]); // clamp to the DEM square (outside: flat at the edge value — stated in the note)
      u = [Math.max(dem.ox + dem.px, Math.min(dem.ox + (dem.width - 2) * dem.px, u[0])), Math.max(dem.oy - (dem.height - 2) * dem.py, Math.min(dem.oy - dem.py, u[1]))];
      let h = root.GA.data.sampleGrid(dem, u[0], u[1]); if (h == null) h = 0; const v = Math.round((h + 10000) * 10); const o = (j * S + i) * 4; img.data[o] = (v >> 16) & 255; img.data[o + 1] = (v >> 8) & 255; img.data[o + 2] = v & 255; img.data[o + 3] = 255; } }
    g.putImageData(img, 0, 0); const blob = cv.convertToBlob ? await cv.convertToBlob({ type: 'image/png' }) : await new Promise(r => cv.toBlob(r, 'image/png')); return blob.arrayBuffer();
  }
  if (root.maplibregl && maplibregl.addProtocol) maplibregl.addProtocol('gadem', async (params) => { const m = params.url.match(/gadem:\/\/(\d+)\/(\d+)\/(\d+)/); return { data: await demTile(+m[1], +m[2], +m[3]) }; });
  // ---------- buildings ----------
  const heightExpr = (est) => est ? ['*', ['to-number', ['get', 'lv'], 0], FLOOR_H] : ['to-number', ['get', 'h'], 0];
  function addBuildings(map) {
    const src = 'ly-bld'; if (!map.getSource(src)) return false; const C = P();
    const col = ['match', ['get', 'band'], '1-2', C.band['1-2'], '3-4', C.band['3-4'], '5-8', C.band['5-8'], '9+', C.band['9+'], C.grey2];
    if (!map.getLayer('ga3d-est')) map.addLayer({ id: 'ga3d-est', type: 'fill-extrusion', source: src, minzoom: 14, filter: ['all', ['!', ['>', ['to-number', ['get', 'h'], 0], 0]], ['>', ['to-number', ['get', 'lv'], 0], 0]], paint: { 'fill-extrusion-color': col, 'fill-extrusion-height': heightExpr(true), 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.72 } });
    if (!map.getLayer('ga3d-h')) map.addLayer({ id: 'ga3d-h', type: 'fill-extrusion', source: src, minzoom: 14, filter: ['>', ['to-number', ['get', 'h'], 0], 0], paint: { 'fill-extrusion-color': col, 'fill-extrusion-height': heightExpr(false), 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.95 } });
    return true;
  }
  function removeBuildings(map) { ['ga3d-est', 'ga3d-h'].forEach(l => map.getLayer(l) && map.removeLayer(l)); }
  function supported(map) { try { const gl = map.painter && map.painter.context && map.painter.context.gl; return !!gl; } catch (e) { return false; } }
  async function enter() {
    const A = root.GA.app; const map = A.map; if (!supported(map)) { root.GA.toast && root.GA.toast(t('v10.no3d'), true); return; }
    if (!map.getSource('ga-dem')) map.addSource('ga-dem', { type: 'raster-dem', tiles: ['gadem://{z}/{x}/{y}'], tileSize: 256, maxzoom: 13, encoding: 'mapbox', attribution: 'IGN MDT25 (CC BY 4.0)' });
    try { map.setTerrain({ source: 'ga-dem', exaggeration: 1 }); } catch (e) { root.GA.toast && root.GA.toast(t('v10.no3d'), true); return; }
    // buildings need the detail footprints: switch the floors layer on if no building layer is on (undone when leaving 3D)
    const L = A.L; addedBld = false; if (!['bld_floors', 'bld_fg', 'bld_period'].some(k => L.S[k] && L.S[k].on)) { L.setOn('bld_floors', true); addedBld = true; }
    const tryAdd = () => { if (!on) return; if (!addBuildings(map)) setTimeout(tryAdd, 600); }; on = true; tryAdd();
    map.dragRotate.enable(); map.touchZoomRotate.enableRotation(); map.setMaxPitch(70);
    map.easeTo({ pitch: 55, bearing: -20, zoom: Math.max(map.getZoom(), 15), duration: 900 });
    document.body.classList.add('view-3d'); sync();
  }
  function exit() {
    const A = root.GA.app; const map = A.map; on = false; removeBuildings(map); try { map.setTerrain(null); } catch (e) { }
    map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); map.dragRotate.disable(); map.touchZoomRotate.disableRotation();
    if (addedBld) { A.L.setOn('bld_floors', false); addedBld = false; } document.body.classList.remove('view-3d'); sync();
  }
  function reset() { const map = root.GA.app.map; map.easeTo({ pitch: on ? 55 : 0, bearing: on ? -20 : 0, duration: 600 }); }
  function sync() { if (!ctl) return; const b = ctl.querySelector('[data-3d]'); b.textContent = on ? '2D' : '3D'; b.setAttribute('aria-pressed', String(on)); b.title = t(on ? 'v10.to2d' : 'v10.to3d'); b.setAttribute('aria-label', b.title);
    ctl.querySelector('[data-3dr]').hidden = !on; ctl.querySelector('[data-3dr]').textContent = t('v10.resetView'); const n = document.getElementById('note-3d'); if (n) { n.hidden = !on; n.innerHTML = t('v10.note3d'); } }
  function init() {
    const A = root.GA.app; if (!A || !A.map) return setTimeout(init, 200); const map = A.map;
    const control = { onAdd() { const d = document.createElement('div'); d.className = 'maplibregl-ctrl maplibregl-ctrl-group ga-3dctl'; d.innerHTML = '<button type="button" data-3d aria-pressed="false">3D</button><button type="button" data-3dr hidden></button>';
      d.addEventListener('click', (e) => { if (e.target.closest('[data-3d]')) (on ? exit : enter)(); else if (e.target.closest('[data-3dr]')) reset(); }); ctl = d; sync(); return d; }, onRemove() { } };
    map.addControl(control, 'top-right');
    const note = document.createElement('div'); note.id = 'note-3d'; note.className = 'note-3d'; note.hidden = true; document.querySelector('.stage').appendChild(note);
    I.onChange(sync); map.on('styledata', () => { if (on) addBuildings(map); });
  }
  root.GA.view3d = { enter, exit, reset, isOn: () => on, demTile };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
