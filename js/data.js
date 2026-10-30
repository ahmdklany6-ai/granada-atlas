/* Data service for the published Granada layers (data/manifest.json).
   Chunked layers are stored in 1 km EPSG:25830 cells; only cells that touch the requested
   extent are fetched, and each cell is cached for the session. Terrain grids (MDT25 DEM and
   slope) are kept as typed arrays in their native EPSG:25830 grid for exact sampling. */
(function (root) {
  const PJ = root.GA.proj, G = root.GA.geo;
  const BASE = 'data/';
  let manifest = null, manifestP = null;
  const cellCache = new Map(); // layer/cell → Promise<features>
  const singleCache = new Map();
  const grids = {};

  async function getJSON(url) { const r = await fetch(url, { cache: 'force-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + url); return r.json(); }
  function loadManifest() { if (!manifestP) manifestP = getJSON(BASE + 'manifest.json').then(m => (manifest = m)).catch(e => { manifestP = null; throw e; }); return manifestP; }

  function cellsForBBox(bb, pad) { // bb in lon/lat, pad in metres
    pad = pad || 0; const C = manifest.cellSize_m;
    const pts = [[bb[0], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]], [bb[2], bb[1]]].map(p => PJ.EPSG25830.forward(p));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const out = [];
    for (let x = Math.floor((Math.min(...xs) - pad) / C); x <= Math.floor((Math.max(...xs) + pad) / C); x++)
      for (let y = Math.floor((Math.min(...ys) - pad) / C); y <= Math.floor((Math.max(...ys) + pad) / C); y++) out.push(x + '_' + y);
    return out;
  }
  const indexes = {};
  async function index(layer) { if (!indexes[layer]) indexes[layer] = getJSON(BASE + 'vec/' + layer + '/index.json'); return indexes[layer]; }
  function cell(layer, c) {
    const k = layer + '/' + c;
    if (!cellCache.has(k)) cellCache.set(k, getJSON(BASE + 'vec/' + layer + '/' + c + '.json').then(fc => fc.features).catch(e => { cellCache.delete(k); throw e; }));
    return cellCache.get(k);
  }
  // Features of a chunked layer touching a lon/lat bbox (deduplicated by id). maxCells guards against huge requests.
  async function chunked(layer, bb, pad, maxCells) {
    await loadManifest(); const idx = await index(layer);
    const cs = cellsForBBox(bb, pad).filter(c => idx[c]);
    if (maxCells && cs.length > maxCells) { const e = new Error('too many cells'); e.code = 'too_large'; throw e; }
    const arrs = await Promise.all(cs.map(c => cell(layer, c)));
    const seen = new Set(), out = [];
    arrs.forEach(a => a.forEach(f => { const id = f.properties.id; if (id && seen.has(id)) return; if (id) seen.add(id); out.push(f); }));
    return out;
  }
  function single(name) {
    if (!singleCache.has(name)) singleCache.set(name, getJSON(BASE + 'vec/' + name + '.json').catch(e => { singleCache.delete(name); throw e; }));
    return singleCache.get(name);
  }

  // ---------- terrain grids ----------
  async function grid(name) {
    await loadManifest();
    if (!grids[name]) grids[name] = (async () => {
      const m = manifest.terrain[name]; const r = await fetch(BASE + m.file, { cache: 'force-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = await r.arrayBuffer(); const arr = name === 'dem' ? new Int16Array(buf) : new Uint16Array(buf);
      return Object.assign({}, m, { arr, scale: name === 'slope' ? 0.01 : 1, nodata: m.nodata });
    })();
    return grids[name];
  }
  function sampleGrid(g, x, y, nearest) { // x,y in EPSG:25830
    const fx = (x - g.ox) / g.px - 0.5, fy = (g.oy - y) / g.py - 0.5;
    if (nearest) { const i = Math.round(fx), j = Math.round(fy); if (i < 0 || j < 0 || i >= g.width || j >= g.height) return null; const v = g.arr[j * g.width + i]; return v === g.nodata ? null : v * g.scale; }
    const i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height) return null;
    const a = fx - i, b = fy - j, k = j * g.width + i, W = g.width; const v = [g.arr[k], g.arr[k + 1], g.arr[k + W], g.arr[k + W + 1]];
    if (v.some(q => q === g.nodata)) return null;
    return (v[0] * (1 - a) * (1 - b) + v[1] * a * (1 - b) + v[2] * (1 - a) * b + v[3] * a * b) * g.scale;
  }
  // Cells of a grid whose centres fall inside a lon/lat ring → array of values (for area statistics)
  function gridValuesInRing(g, ring) {
    const U = ring.map(p => PJ.EPSG25830.forward(p)); const xs = U.map(p => p[0]), ys = U.map(p => p[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - g.ox) / g.px)), i1 = Math.min(g.width - 1, Math.ceil((Math.max(...xs) - g.ox) / g.px));
    const j0 = Math.max(0, Math.floor((g.oy - Math.max(...ys)) / g.py)), j1 = Math.min(g.height - 1, Math.ceil((g.oy - Math.min(...ys)) / g.py));
    const out = [];
    const inside = (x, y) => { let c = false; for (let a = 0, b = U.length - 1; a < U.length; b = a++) { if ((U[a][1] > y) !== (U[b][1] > y) && x < (U[b][0] - U[a][0]) * (y - U[a][1]) / (U[b][1] - U[a][1]) + U[a][0]) c = !c; } return c; };
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = g.ox + (i + 0.5) * g.px, y = g.oy - (j + 0.5) * g.py; if (!inside(x, y)) continue; const v = g.arr[j * g.width + i]; if (v !== g.nodata) out.push(v * g.scale); }
    return out;
  }
  const inRegion = (ll) => manifest && manifest.region4326 && ll[0] > manifest.region4326[0] && ll[0] < manifest.region4326[2] && ll[1] > manifest.region4326[1] && ll[1] < manifest.region4326[3];

  // ---------- study-area dataset in the shape analysis.osmMetrics expects ----------
  const toOuters = (g) => g.type === 'Polygon' ? { outers: [g.coordinates[0]], inners: g.coordinates.slice(1) } : { outers: g.coordinates.map(p => p[0]), inners: g.coordinates.flatMap(p => p.slice(1)) };
  const FAC_TAGS = {
    health: { hospital: { amenity: 'hospital' }, clinic: { amenity: 'clinic' }, doctors: { amenity: 'doctors' }, dentist: { amenity: 'dentist' }, pharmacy: { amenity: 'pharmacy' } },
    education: { school: { amenity: 'school' }, university: { amenity: 'university' }, college: { amenity: 'college' }, early_years: { amenity: 'kindergarten' } },
    stay: { hotel: { tourism: 'hotel' }, hostel: { tourism: 'hostel' }, guest_house: { tourism: 'guest_house' }, apartment: { tourism: 'apartment' } },
  };
  async function areaData(ring, onStatus) {
    await loadManifest();
    const bb = G.bbox(ring); const status = (k, s, extra) => onStatus && onStatus(k, s, extra);
    const parsed = { buildings: [], streets: [], areas: [], pois: [], admin: [], osmBase: '2026-10-23 (supplied OSM extract)', source: 'local' };
    const jobs = {
      buildings: chunked('buildings', bb, 250, 60).then(fs => { fs.forEach(f => parsed.buildings.push(Object.assign({ id: f.properties.id, tags: Object.assign({ building: f.properties.b }, f.properties.lv != null && { 'building:levels': String(f.properties.lv) }, f.properties.h != null && { height: String(f.properties.h) }, f.properties.sd && { start_date: f.properties.sd }, f.properties.nm && { name: f.properties.nm }, f.properties.am && { amenity: f.properties.am }, f.properties.rs && { 'roof:shape': f.properties.rs }, f.properties.lvu != null && { 'building:levels:underground': String(f.properties.lvu) }) }, toOuters(f.geometry)))); return fs.length; }),
      streets: chunked('streets', bb, 0, 60).then(fs => { fs.forEach(f => { const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates; lines.forEach((c, i) => parsed.streets.push({ id: f.properties.id + (i ? '#' + i : ''), coords: c, tags: Object.assign({ highway: f.properties.hw }, f.properties.nm && { name: f.properties.nm }, f.properties.ln && { lanes: f.properties.ln }, f.properties.sf && { surface: f.properties.sf }) })); }); return fs.length; }),
      landuse: chunked('landuse', bb, 0, 60).then(fs => { fs.forEach(f => parsed.areas.push(Object.assign({ id: f.properties.id, tags: Object.assign({ landuse: f.properties.lu }, f.properties.nm && { name: f.properties.nm }) }, toOuters(f.geometry)))); return fs.length; }),
      parks: chunked('parks', bb, 0, 60).then(fs => { fs.forEach(f => parsed.areas.push(Object.assign({ id: f.properties.id, tags: Object.assign({ leisure: f.properties.le }, f.properties.nm && { name: f.properties.nm }) }, toOuters(f.geometry)))); return fs.length; }),
      facilities: Promise.all(['health', 'education', 'stay'].map(k => single('fac_' + k).then(fc => [k, fc]).catch(() => [k, null]))).then(list => { let n = 0; list.forEach(([k, fc]) => { if (!fc) return; fc.features.forEach(f => { const c = f.geometry.coordinates; if (!G.inBBox(c, bb)) return; n++; parsed.pois.push({ id: f.properties.id, pt: c, tags: Object.assign({ name: f.properties.nm }, FAC_TAGS[k][f.properties.cls] || {}, { _fac: k, _cls: f.properties.cls }), isArea: f.properties.geom_src !== 'node' }); }); }); parsed.facilityDate = list.map(([k, fc]) => fc && manifest.layers['fac_' + k] && manifest.layers['fac_' + k].date).find(Boolean); return n; }),
      bus: single('bus_stops').then(fc => { let n = 0; fc.features.forEach(f => { if (!G.inBBox(f.geometry.coordinates, bb)) return; n++; parsed.pois.push({ id: f.properties.id, pt: f.geometry.coordinates, tags: Object.assign({ highway: 'bus_stop' }, f.properties.nm && { name: f.properties.nm }, f.properties.rr && { route_ref: f.properties.rr }) }); }); return n; }),
      admin: single('admin').then(fc => { const c = G.centroidLL(ring); fc.features.filter(f => f.properties.kind === 'barrio' || f.properties.kind === 'distrito' || f.properties.kind === 'municipio').forEach(f => { const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; if (polys.some(p => G.pointInRing(c, p[0]))) parsed.admin.push({ admin_level: { municipio: '8', distrito: '9', barrio: '10' }[f.properties.kind], name: f.properties.name }); }); return parsed.admin.length; }),
    };
    const results = {};
    await Promise.all(Object.entries(jobs).map(([k, p]) => { status(k, 'loading'); return p.then(n => { results[k] = { state: n ? 'ok' : 'empty', n }; status(k, results[k].state, n); }, e => { results[k] = { state: 'failed', error: e.message }; status(k, 'failed', e.message); }); }));
    parsed.admin.sort((a, b) => +a.admin_level - +b.admin_level);
    return { parsed, results };
  }

  // Buildings near a line (for sections) — loads cells around the line's bbox
  async function buildingsNear(coords, pad) { const bb = G.bbox(coords); return chunked('buildings', bb, (pad || 60) + 250, 40); }

  const api = { loadManifest, get manifest() { return manifest; }, chunked, single, grid, sampleGrid, gridValuesInRing, areaData, buildingsNear, cellsForBBox, inRegion, FAC_TAGS };
  root.GA = root.GA || {}; root.GA.data = api;
})(window);
