// Builds the public web data in data/ from the supplied GeoPackages and GeoTIFFs.
// Usage: node tools/build_data.js <folder with the unzipped supplied data> [facilities.json]
// Only open-licence layers approved for public hosting are written. Original files are never modified.
const fs = require('fs'), path = require('path');
const L = require('./lib.js'); const TIF = require('../js/io/tiffread.js');
const SRC = process.argv[2]; const FAC = process.argv[3];
const OUT = path.join(L.ROOT, 'data');
const LY = path.join(SRC, 'granada_layers__3_/granada layers'), NB = path.join(SRC, '8e5b7d9d-Granada_neighborhoods/Granada neighborhoods'), TP = path.join(SRC, 'Granada_topography/Granada topography');
const CELL = 1000; // m, EPSG:25830 grid for viewport loading
const manifest = { generated: new Date().toISOString(), crs: 'EPSG:4326 (vectors), rasters warped to EPSG:3857 for display, DEM kept in EPSG:25830', cellSize_m: CELL, layers: {} };
const log = (...a) => console.log(...a);

let SQL; const open = (f) => new SQL.Database(fs.readFileSync(f));
function rows(db, sql) { const r = db.exec(sql); if (!r.length) return []; const cols = r[0].columns; return r[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]]))); }
const clean = (o) => { const r = {}; for (const k in o) if (o[k] != null && o[k] !== '') r[k] = o[k]; return r; };
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };

// Regional 20 km study square (from the supplied regional analysis) bounds all clipping of broad layers.
let REGION; // [minx,miny,maxx,maxy] in 4326
function inRegion(bb) { return !(bb[2] < REGION[0] || bb[0] > REGION[2] || bb[3] < REGION[1] || bb[1] > REGION[3]); }

function cellsFor(bb4326) { // all 1 km cells a bbox overlaps
  const a = L.PJ.EPSG25830.forward([bb4326[0], bb4326[1]]), b = L.PJ.EPSG25830.forward([bb4326[2], bb4326[3]]);
  const c = L.PJ.EPSG25830.forward([bb4326[0], bb4326[3]]), d = L.PJ.EPSG25830.forward([bb4326[2], bb4326[1]]);
  const xs = [a[0], b[0], c[0], d[0]], ys = [a[1], b[1], c[1], d[1]]; const out = [];
  for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++) for (let y = Math.floor(Math.min(...ys) / CELL); y <= Math.floor(Math.max(...ys) / CELL); y++) out.push(x + '_' + y);
  return out;
}
function writeChunked(name, feats, meta) {
  const dir = path.join(OUT, 'vec', name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cells = {}; feats.forEach(f => { (f._cells || cellsFor(L.bbox(f.geometry))).forEach(c => (cells[c] = cells[c] || []).push(f)); delete f._cells; });
  let bytes = 0; const index = {};
  for (const c in cells) { bytes += L.writeJSON(path.join(dir, c + '.json'), { type: 'FeatureCollection', features: cells[c] }); index[c] = cells[c].length; }
  L.writeJSON(path.join(dir, 'index.json'), index);
  manifest.layers[name] = Object.assign({ chunked: true, features: feats.length, cells: Object.keys(cells).length, bytes }, meta);
  log(`  ${name}: ${feats.length} features in ${Object.keys(cells).length} cells, ${(bytes / 1e6).toFixed(1)} MB`);
}
function writeSingle(name, feats, meta) {
  const bytes = L.writeJSON(path.join(OUT, 'vec', name + '.json'), { type: 'FeatureCollection', features: feats });
  manifest.layers[name] = Object.assign({ chunked: false, features: feats.length, bytes }, meta);
  log(`  ${name}: ${feats.length} features, ${(bytes / 1e6).toFixed(2)} MB`);
}

(async () => {
  SQL = await L.sql();
  fs.mkdirSync(OUT, { recursive: true });

  // ---------- boundaries ----------
  log('boundaries');
  const reg = rows(open(path.join(TP, 'Regional analysis/Granada regional study area 20 km.gpkg')), 'select geom from features')[0];
  REGION = L.bbox(L.to4326(L.gpkgGeom(reg.geom)));
  manifest.region4326 = REGION;
  const nb = open(path.join(NB, 'Granada neighborhood and district boundaries.gpkg'));
  const admin = [];
  rows(nb, 'select osm_id, name, geom from Barrios').forEach(r => admin.push({ type: 'Feature', properties: { kind: 'barrio', name: r.name, osm_id: 'r' + r.osm_id }, geometry: L.round(L.simplify(L.to4326(L.gpkgGeom(r.geom)), 1.5), 6) }));
  rows(nb, 'select * from Distritos').forEach(r => admin.push({ type: 'Feature', properties: { kind: 'distrito', name: r.name, osm_id: r.osm_id ? 'r' + r.osm_id : null }, geometry: L.round(L.simplify(L.to4326(L.gpkgGeom(r.geom)), 1.5), 6) }));
  rows(nb, 'select * from Municipio_Granada').forEach(r => admin.push({ type: 'Feature', properties: { kind: 'municipio', name: r.name || 'Granada' }, geometry: L.round(L.simplify(L.to4326(L.gpkgGeom(r.geom)), 1.5), 6) }));
  const ub = open(path.join(LY, 'Granada_Urban_Boundaries.gpkg'));
  rows(ub, 'select * from Granada_Macro_Boundary').forEach(r => admin.push({ type: 'Feature', properties: { kind: 'urban_centre', name: 'GHSL Urban Centre (JRC)', area_km2: +(+r.area_km2).toFixed(2), source: r.source }, geometry: L.round(L.simplify(L.to4326(L.gpkgGeom(r.geom)), 1.5), 6) }));
  rows(ub, 'select * from Granada_Micro_Boundary').forEach(r => admin.push({ type: 'Feature', properties: { kind: 'historic_core', name: 'Historic core (OSM barrios dissolved)', area_km2: +(+r.area_km2).toFixed(2), members: r.members }, geometry: L.round(L.simplify(L.to4326(L.gpkgGeom(r.geom)), 1.5), 6) }));
  writeSingle('admin', admin, { title: 'Neighbourhoods, districts, municipality, urban centre', source: 'OpenStreetMap admin_level 8/9/10 (via supplied GeoPackage, 23 Oct 2026); urban centre: European Commission JRC, GHSL Urban Centre Database 2025', license: 'ODbL 1.0 (OSM); CC BY 4.0 (JRC)', date: '2026-10-23' });
  const ghs = rows(open(path.join(LY, 'ghrnata_data.gpkg')), 'select * from GHS_Urban_Centres_Granada_Area')[0];
  manifest.urbanCentre = { population_est_2025: Math.round(ghs.GC_POP_TOT_2025), area_km2: ghs.GC_UCA_KM2_2025, source: 'GHSL Urban Centre Database R2024 (GC_POP_TOT_2025, GC_UCA_KM2_2025) — modelled estimate for the whole urban centre' };

  // ---------- buildings ----------
  log('buildings');
  const bdb = open(path.join(LY, 'buildings. garnada.gpkg'));
  const B = [];
  const st = bdb.prepare('select full_id, building, "building:levels" lv, "building:levels:underground" lvu, height, start_date, name, amenity, "roof:shape" rs, "roof:levels" rl, tourism, historic, geom from building');
  while (st.step()) {
    const r = st.getAsObject(); const g = L.gpkgGeom(r.geom); if (!g) continue;
    const lv = num(r.lv);
    B.push({ type: 'Feature', properties: clean({ id: r.full_id, b: r.building, lv: lv != null && lv >= 0 ? lv : null, lvu: num(r.lvu), h: num(r.height), sd: r.start_date, nm: r.name, am: r.amenity, rs: r.rs, rl: num(r.rl), tr: r.tourism, hi: r.historic }), geometry: L.round(g, 6) });
  }
  st.free();
  // assign by footprint centroid cell (a building belongs to exactly one cell)
  B.forEach(f => { const c = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]; let x = 0, y = 0; c.forEach(p => { x += p[0]; y += p[1]; }); const u = L.PJ.EPSG25830.forward([x / c.length, y / c.length]); f._cells = [Math.floor(u[0] / CELL) + '_' + Math.floor(u[1] / CELL)]; });
  writeChunked('buildings', B, { title: 'Buildings', source: 'OpenStreetMap buildings (supplied GeoPackage, exported 23 Oct 2026)', license: 'ODbL 1.0', date: '2026-10-23', assignment: 'each building stored once, in the 1 km cell containing its footprint centroid; loaders add neighbouring cells to cover footprints crossing cell edges',
    fields: { id: 'OSM id (w/r + number)', b: 'building tag', lv: 'building:levels (floors above ground) — missing when not tagged', lvu: 'building:levels:underground', h: 'height (m) as tagged', sd: 'start_date as tagged', nm: 'name', am: 'amenity', rs: 'roof:shape', rl: 'roof:levels', tr: 'tourism', hi: 'historic' },
    coverage: { levels: B.filter(f => f.properties.lv != null).length, height: B.filter(f => f.properties.h != null).length, start_date: B.filter(f => f.properties.sd).length } });

  // Overview: 50 m grid of median floors (tagged buildings only) + share without data, as a Web Mercator PNG
  log('  height overview raster');
  const ov = {}; // key → {lv:[], n, unknown}
  B.forEach(f => { const c = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]; let x = 0, y = 0; c.forEach(p => { x += p[0]; y += p[1]; }); const u = L.PJ.EPSG25830.forward([x / c.length, y / c.length]); const k = Math.floor(u[0] / 50) + '_' + Math.floor(u[1] / 50); const o = ov[k] = ov[k] || { lv: [], n: 0 }; o.n++; if (f.properties.lv != null) o.lv.push(f.properties.lv); });
  rasterOverview(ov);

  // ---------- streets ----------
  log('streets');
  const hdb = open(path.join(LY, 'garnada highway.gpkg'));
  const S = []; const sst = hdb.prepare('select full_id, highway, name, oneway, lanes, maxspeed, surface, bridge, tunnel, incline, sidewalk, geom from highway');
  while (sst.step()) { const r = sst.getAsObject(); const g = L.gpkgGeom(r.geom); if (!g) continue; const bb = L.bbox(g); if (!inRegion(bb)) continue;
    S.push({ type: 'Feature', properties: clean({ id: r.full_id, hw: r.highway, nm: r.name, ow: r.oneway, ln: r.lanes, ms: r.maxspeed, sf: r.surface, br: r.bridge, tu: r.tunnel, ic: r.incline, sw: r.sidewalk }), geometry: L.round(g, 7) }); }
  sst.free();
  const pdb = open(path.join(LY, 'garnada highway paths.gpkg')); const sid = new Set(S.map(f => f.properties.id));
  const pathIds = rows(pdb, 'select full_id from highway_path').map(r => r.full_id); const overlap = pathIds.filter(i => sid.has(i)).length;
  manifest.notes = manifest.notes || []; manifest.notes.push(`"garnada highway paths.gpkg": ${pathIds.length} lines, of which ${overlap} also appear (same OSM id) in "garnada highway.gpkg"; not loaded separately.`);
  writeChunked('streets', S, { title: 'Streets and paths', source: 'OpenStreetMap highways (supplied GeoPackage, 23 Oct 2026)', license: 'ODbL 1.0', date: '2026-10-23', fields: { id: 'OSM id', hw: 'highway', nm: 'name', ow: 'oneway', ln: 'lanes', ms: 'maxspeed', sf: 'surface', br: 'bridge', tu: 'tunnel', ic: 'incline', sw: 'sidewalk' } });
  const major = S.filter(f => /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(f.properties.hw)).map(f => ({ type: 'Feature', properties: { hw: f.properties.hw, nm: f.properties.nm }, geometry: L.round(L.simplify(f.geometry, 4) || f.geometry, 6) }));
  writeSingle('streets_major', major, { title: 'Major streets (overview)', source: 'as streets', license: 'ODbL 1.0', date: '2026-10-23', simplified_m: 4 });

  // ---------- land use ----------
  log('landuse');
  const ldb = open(path.join(LY, 'landuse garnada.gpkg'));
  const LU = []; const lst = ldb.prepare('select full_id, landuse, name, geom from landuse');
  while (lst.step()) { const r = lst.getAsObject(); const g = L.gpkgGeom(r.geom); if (!g || !r.landuse) continue; if (!inRegion(L.bbox(g))) continue;
    LU.push({ type: 'Feature', properties: clean({ id: r.full_id, lu: r.landuse, nm: r.name }), geometry: L.round(L.simplify(g, 0.5) || g, 7) }); }
  lst.free();
  writeChunked('landuse', LU, { title: 'Land use', source: 'OpenStreetMap landuse (supplied GeoPackage, 23 Oct 2026)', license: 'ODbL 1.0', date: '2026-10-23', note: 'features are listed in every 1 km cell their bounding box touches; deduplicate by id', fields: { id: 'OSM id', lu: 'landuse', nm: 'name' } });
  writeSingle('landuse_overview', LU.map(f => ({ type: 'Feature', properties: { lu: f.properties.lu }, geometry: L.simplify(f.geometry, 6) })).filter(f => f.geometry).map(f => (f.geometry = L.round(f.geometry, 5), f)), { title: 'Land use (overview)', simplified_m: 6, source: 'as landuse', license: 'ODbL 1.0', date: '2026-10-23' });

  // ---------- parks ----------
  log('parks');
  const kdb = open(path.join(LY, 'parks.gpkg'));
  const P = rows(kdb, 'select full_id, leisure, name, geom from merged').map(r => { const g = L.gpkgGeom(r.geom); return g && { type: 'Feature', properties: clean({ id: r.full_id, le: r.leisure, nm: r.name }), geometry: L.round(L.simplify(g, 0.5) || g, 7) }; }).filter(Boolean);
  writeChunked('parks', P, { title: 'Parks and gardens', source: 'OpenStreetMap leisure=park/garden (supplied GeoPackage, 26 Oct 2026)', license: 'ODbL 1.0', date: '2026-10-26', note: 'leisure=garden includes private gardens and courtyards (2,303 of 2,959 features)', fields: { id: 'OSM id', le: 'leisure', nm: 'name' } });

  // ---------- water ----------
  log('water');
  const wdb = open(path.join(LY, 'river and streams.gpkg'));
  const W = rows(wdb, 'select * from natural').map(r => { const g = L.gpkgGeom(r.geom); if (!g || !inRegion(L.bbox(g))) return null; return { type: 'Feature', properties: clean({ id: r.full_id, ww: r.waterway, nm: r.name }), geometry: L.round(L.simplify(g, 2) || g, 6) }; }).filter(Boolean);
  writeSingle('water', W, { title: 'Rivers and streams', source: 'OpenStreetMap waterways (supplied GeoPackage)', license: 'ODbL 1.0', date: '2026-10-23' });

  // ---------- bus stops ----------
  log('bus stops');
  const ptdb = open(path.join(LY, 'garnada highway points.gpkg'));
  const cols = rows(ptdb, 'pragma table_info(highway)').map(r => r.name);
  const pick = ['name', 'ref', 'route_ref', 'shelter', 'bench', 'operator', 'network', 'public_transport', 'highway', 'bus'].filter(c => cols.includes(c));
  const BS = rows(ptdb, `select full_id, ${pick.map(c => '"' + c + '"').join(',')}, geom from highway where highway='bus_stop' or public_transport='platform'`).map(r => { const g = L.gpkgGeom(r.geom); if (!g || !inRegion(L.bbox(g))) return null; return { type: 'Feature', properties: clean({ id: r.full_id, nm: r.name, ref: r.ref, rr: r.route_ref, sh: r.shelter, op: r.operator, pt: r.public_transport, hw: r.highway }), geometry: L.round(g, 7) }; }).filter(Boolean);
  writeSingle('bus_stops', BS, { title: 'Bus stops (presence)', source: 'OpenStreetMap highway=bus_stop / public_transport=platform (supplied GeoPackage, 23 Oct 2026)', license: 'ODbL 1.0', date: '2026-10-23', note: 'presence only — no frequency' });

  // ---------- facilities (OSM snapshot taken during the build) ----------
  if (FAC && fs.existsSync(FAC)) {
    log('facilities');
    const fac = JSON.parse(fs.readFileSync(FAC, 'utf8'));
    const cls = {
      health: (t) => t.amenity === 'hospital' || t.healthcare === 'hospital' ? 'hospital' : (t.amenity === 'clinic' || t.healthcare === 'clinic' || t.healthcare === 'centre') ? 'clinic' : t.amenity === 'doctors' || t.healthcare === 'doctor' ? 'doctors' : t.amenity === 'dentist' ? 'dentist' : t.amenity === 'pharmacy' ? 'pharmacy' : 'other',
      education: (t) => t.amenity === 'university' ? 'university' : t.amenity === 'college' ? 'college' : t.amenity === 'school' ? 'school' : (t.amenity === 'kindergarten' || t.amenity === 'childcare') ? 'early_years' : 'other',
      stay: (t) => ({ hotel: 'hotel', hostel: 'hostel', guest_house: 'guest_house', apartment: 'apartment', motel: 'hotel' }[t.tourism] || 'other'),
    };
    for (const k of ['health', 'education', 'stay']) {
      const p = fac.parts[k]; if (!p) { log('  missing', k); continue; }
      const seen = new Set();
      const F = p.els.filter(e => !seen.has(e[0]) && seen.add(e[0])).map(e => ({ type: 'Feature', properties: clean({ id: e[0], cls: cls[k](e[3]), nm: e[3].name, op: e[3].operator, opt: e[3]['operator:type'], em: e[3].emergency, st: e[3].stars, sp: e[3]['healthcare:speciality'], geom_src: { n: 'node', w: 'way centre', r: 'relation centre' }[e[0][0]] }), geometry: { type: 'Point', coordinates: [e[2], e[1]] } }));
      writeSingle('fac_' + k, F, { title: { health: 'Healthcare facilities', education: 'Schools and education', stay: 'Hotels and tourist accommodation' }[k], source: 'OpenStreetMap via Overpass API (' + p.ep.replace(/^https:\/\//, '').split('/')[0] + ')', license: 'ODbL 1.0', date: p.base, method: 'nodes, ways and relations with the listed tags; ways/relations as their centre point; one point per OSM feature', classes: Object.fromEntries([...new Set(F.map(f => f.properties.cls))].map(c => [c, F.filter(f => f.properties.cls === c).length])) });
    }
  }

  // ---------- terrain ----------
  log('terrain');
  const dem = await TIF.read(fs.readFileSync(path.join(TP, 'Regional analysis/Granada regional elevation 25 m.tif')));
  const slope = await TIF.read(fs.readFileSync(path.join(TP, 'Regional analysis/Granada regional slope degrees.tif')));
  const hs = await TIF.read(fs.readFileSync(path.join(TP, 'Regional analysis/Granada regional hillshade.tif')));
  fs.mkdirSync(path.join(OUT, 'terrain'), { recursive: true });
  const i16 = new Int16Array(dem.width * dem.height); for (let i = 0; i < i16.length; i++) i16[i] = dem.valid[i] ? dem.data[i] : -9999;
  fs.writeFileSync(path.join(OUT, 'terrain/dem_mdt25.bin'), Buffer.from(i16.buffer));
  const u16 = new Uint16Array(slope.width * slope.height); for (let i = 0; i < u16.length; i++) u16[i] = slope.valid[i] ? Math.round(slope.data[i] * 100) : 65535;
  fs.writeFileSync(path.join(OUT, 'terrain/slope_deg_x100.bin'), Buffer.from(u16.buffer));
  const grid = (r) => ({ width: r.width, height: r.height, ox: r.ox, oy: r.oy, px: r.px, py: r.py, epsg: 25830 });
  manifest.terrain = {
    dem: Object.assign(grid(dem), { file: 'terrain/dem_mdt25.bin', type: 'Int16 little-endian, row-major from north-west, metres above sea level', nodata: -9999, min: dem.min, max: dem.max }),
    slope: Object.assign(grid(slope), { file: 'terrain/slope_deg_x100.bin', type: 'Uint16 little-endian, slope in degrees × 100 (Horn, gdal:slope on the 25 m DEM)', nodata: 65535, min: slope.min, max: slope.max }),
    source: 'Instituto Geográfico Nacional (IGN), MDT25 — Modelo Digital del Terreno 25 m, catalogue epochs 2008–2015; regional 20 × 20 km extract and derivatives supplied by the user',
    license: 'CC BY 4.0 — © Instituto Geográfico Nacional',
    vertical: 'metres above mean sea level (Alicante); integer values', note: 'Bare-earth terrain: buildings and bridges are not part of the model.',
  };
  // display rasters in Web Mercator
  const PAL = require('../js/palette.js'); // display colours come from the shared palette (see also tools/build_terrain_display.js)
  const elevRamp = PAL.elevRamp.map(([v, c]) => [v, PAL.rgb(c)]);
  const slopeCls = [2, 5, 10, 15, 25, 35, 90].map((m, i) => [m, PAL.rgb(PAL.slope[i][1]).concat([PAL.slopeAlpha[i]])]);
  manifest.terrain.slopeClasses = slopeCls.map((c, i) => ({ min: i ? slopeCls[i - 1][0] : 0, max: c[0] === 90 ? null : c[0], rgba: c[1] }));
  manifest.terrain.elevRamp = elevRamp;
  manifest.terrain.display = {};
  warp('hillshade', hs, (v) => { const g = v; return [g, g, g, 255]; }, true);
  warp('slope', slope, (v) => slopeCls.find(c => v < c[0])[1], false);
  warp('elevation', dem, (v) => { let a = elevRamp[0], b = elevRamp[elevRamp.length - 1]; for (let i = 1; i < elevRamp.length; i++) if (v <= elevRamp[i][0]) { a = elevRamp[i - 1]; b = elevRamp[i]; break; } const t = Math.max(0, Math.min(1, (v - a[0]) / (b[0] - a[0]))); return [0, 1, 2].map(k => Math.round(a[1][k] + t * (b[1][k] - a[1][k]))).concat([255]); }, true);

  // contours
  const cdb = open(path.join(TP, 'Granada contours 10 m.gpkg'));
  const C10 = rows(cdb, 'select ELEV, geom from features').map(r => ({ type: 'Feature', properties: { elev: r.ELEV, idx: r.ELEV % 50 === 0 ? 1 : 0 }, geometry: L.round(L.simplify(L.to4326(L.gpkgGeom(r.geom)), 2), 6) })).filter(f => f.geometry);
  writeSingle('contours_10m', C10, { title: 'Contours 10 m', source: 'gdal:contour on IGN MDT25 (supplied)', license: 'CC BY 4.0 — © IGN', date: 'MDT25 2008–2015', extent: 'urban study mask (GHSL urban centre + 500 m)', simplified_m: 2 });
  const c20 = open(path.join(TP, 'Regional analysis/Granada regional contours 20 m.gpkg'));
  const C20 = rows(c20, 'select ELEV, geom from features').map(r => ({ type: 'Feature', properties: { elev: r.ELEV, idx: r.ELEV % 100 === 0 ? 1 : 0 }, geometry: L.round(L.simplify(L.to4326(L.gpkgGeom(r.geom)), 3), 6) })).filter(f => f.geometry);
  writeSingle('contours_20m', C20, { title: 'Contours 20 m (regional)', source: 'gdal:contour on IGN MDT25 (supplied)', license: 'CC BY 4.0 — © IGN', date: 'MDT25 2008–2015', extent: '20 × 20 km regional square', simplified_m: 3 });

  // ---------- neighbourhood statistics (for choropleths) ----------
  log('barrio statistics');
  const G = require('../js/geo.js');
  const facs = {}; ['health', 'education', 'stay'].forEach(k => { const f = path.join(OUT, 'vec', 'fac_' + k + '.json'); if (fs.existsSync(f)) facs[k] = JSON.parse(fs.readFileSync(f, 'utf8')).features; });
  const polysOf = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const inPolys = (pt, polys) => polys.some(p => G.pointInRing(pt, p[0]) && !p.slice(1).some(h => G.pointInRing(pt, h)));
  const bCent = B.map(f => { const c = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]; let x = 0, y = 0; c.forEach(p => { x += p[0]; y += p[1]; }); return { pt: [x / c.length, y / c.length], lv: f.properties.lv }; });
  admin.filter(f => f.properties.kind === 'barrio' || f.properties.kind === 'distrito').forEach(f => {
    const polys = polysOf(f.geometry); const bb = L.bbox(f.geometry); const inb = (p) => p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3] && inPolys(p, polys);
    const area = polys.reduce((s, p) => s + G.ringArea(p[0]) - p.slice(1).reduce((t, h) => t + G.ringArea(h), 0), 0) / 1e6;
    const P = f.properties; P.area_km2 = +area.toFixed(3);
    ['health', 'education', 'stay'].forEach(k => { if (!facs[k]) return; const pts = facs[k].filter(x => inb(x.geometry.coordinates)); P['n_' + k] = pts.length; P['d_' + k] = +(pts.length / area).toFixed(2); });
    if (facs.health) { P.n_hospital = facs.health.filter(x => x.properties.cls === 'hospital' && inb(x.geometry.coordinates)).length; P.n_primary = facs.health.filter(x => (x.properties.cls === 'clinic' || x.properties.cls === 'doctors') && inb(x.geometry.coordinates)).length; }
    if (facs.education) P.n_school = facs.education.filter(x => x.properties.cls === 'school' && inb(x.geometry.coordinates)).length;
    if (facs.stay) P.n_hotel = facs.stay.filter(x => x.properties.cls === 'hotel' && inb(x.geometry.coordinates)).length;
    P.n_bus = BS.filter(x => inb(x.geometry.coordinates)).length; P.d_bus = +(P.n_bus / area).toFixed(2);
    const bs = bCent.filter(b => inb(b.pt)); const lv = bs.map(b => b.lv).filter(v => v != null).sort((a, b) => a - b);
    P.n_buildings = bs.length; P.levels_coverage = bs.length ? +(lv.length / bs.length).toFixed(3) : null; P.median_floors = lv.length ? lv[lv.length >> 1] : null;
  });
  writeSingle('admin', admin, Object.assign({}, manifest.layers.admin, { statistics: 'n_* counts and d_* per km² of facilities (snapshot), bus stops and buildings whose point/centroid falls inside each barrio or distrito; area_km2 ellipsoidal' }));

  manifest.excluded = [
    'landuse garnada.shp/.dbf — duplicate of landuse garnada.gpkg (16,421 identical records) and missing .shx/.prj',
    'schools.gpkg, health.gpkg (health1) — NUMPOINTS counts of mixed OSM nodes (gates, entrances, artworks) per barrio; not facility counts',
    'schools points.gpkg, health.gpkg (health) — mixed node extracts; only 13 of 175 / 52 of 93 points are facilities. Replaced by the facility snapshot.',
    'buildings. garnada points.gpkg, landuse garnada points.gpkg — node extracts (entrances, cameras, plaques); not used',
    'boundary lines.gpkg — line version of boundary.gpkg plus unrelated ways', 'QGIS projects, QML styles, PDFs and HTML reports — kept private',
  ];
  L.writeJSON(path.join(OUT, 'manifest.json'), manifest);
  log('done');

  // ---- helpers using closure state ----
  function warp(name, r, colour, bilinear) {
    // output grid: Web Mercator, ~25 m ground pixels at Granada's latitude
    const corners = [[r.ox, r.oy], [r.ox + r.width * r.px, r.oy], [r.ox, r.oy - r.height * r.py], [r.ox + r.width * r.px, r.oy - r.height * r.py]].map(p => L.PJ.EPSG25830.inverse(p));
    const lons = corners.map(c => c[0]), lats = corners.map(c => c[1]);
    const west = Math.min(...lons), east = Math.max(...lons), south = Math.min(...lats), north = Math.max(...lats);
    const [x0, y1] = L.merc(west, north), [x1, y0] = L.merc(east, south);
    const k = 1 / Math.cos(37.18 * Math.PI / 180); const pm = 25 * k * 0.9; // mercator metres per pixel
    const W = Math.ceil((x1 - x0) / pm), H = Math.ceil((y1 - y0) / pm); const rgba = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const ll = L.imerc(x0 + (i + 0.5) * pm, y1 - (j + 0.5) * pm); const u = L.PJ.EPSG25830.forward(ll);
      let v;
      if (bilinear) v = TIF.sample(r, u[0], u[1]);
      else { const ci = Math.floor((u[0] - r.ox) / r.px), cj = Math.floor((r.oy - u[1]) / r.py); v = ci >= 0 && cj >= 0 && ci < r.width && cj < r.height && r.valid[cj * r.width + ci] ? r.data[cj * r.width + ci] : null; }
      if (v == null) continue; const c = colour(v); const o = (j * W + i) * 4; rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = c[3];
    }
    const file = `terrain/${name}_3857.png`; fs.writeFileSync(path.join(OUT, file), L.png(W, H, rgba));
    const [w2, n2] = L.imerc(x0, y1), [e2, s2] = L.imerc(x0 + W * pm, y1 - H * pm);
    manifest.terrain.display[name] = { file, width: W, height: H, coordinates: [[w2, n2], [e2, n2], [e2, s2], [w2, s2]] };
    log(`  ${file} ${W}x${H} ${(fs.statSync(path.join(OUT, file)).size / 1e6).toFixed(2)} MB`);
  }
  function rasterOverview(cells) {
    const keys = Object.keys(cells).map(k => k.split('_').map(Number)); const xs = keys.map(k => k[0]), ys = keys.map(k => k[1]);
    const gx0 = Math.min(...xs), gy0 = Math.min(...ys), gx1 = Math.max(...xs), gy1 = Math.max(...ys);
    const PB = require('../js/palette.js'); const colours = Object.fromEntries(['1-2', '3-4', '5-8', '9+'].map(k => [k, PB.rgb(PB.band[k])])); // classes from Exercise 1.2, palette colours
    const band = (m) => m <= 2 ? '1-2' : m <= 4 ? '3-4' : m <= 8 ? '5-8' : '9+';
    const sw = L.PJ.EPSG25830.inverse([gx0 * 50, gy0 * 50]), ne = L.PJ.EPSG25830.inverse([(gx1 + 1) * 50, (gy1 + 1) * 50]);
    const nw = L.PJ.EPSG25830.inverse([gx0 * 50, (gy1 + 1) * 50]), se = L.PJ.EPSG25830.inverse([(gx1 + 1) * 50, gy0 * 50]);
    const west = Math.min(sw[0], nw[0]), east = Math.max(ne[0], se[0]), south = Math.min(sw[1], se[1]), north = Math.max(ne[1], nw[1]);
    const [x0, y1] = L.merc(west, north), [x1, y0] = L.merc(east, south); const pm = 50 / Math.cos(37.18 * Math.PI / 180) / 2;
    const W = Math.ceil((x1 - x0) / pm), H = Math.ceil((y1 - y0) / pm); const rgba = new Uint8Array(W * H * 4);
    let withData = 0, unknownOnly = 0;
    for (const k in cells) { const c = cells[k]; if (c.lv.length) withData++; else unknownOnly++; }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const ll = L.imerc(x0 + (i + 0.5) * pm, y1 - (j + 0.5) * pm); const u = L.PJ.EPSG25830.forward(ll);
      const c = cells[Math.floor(u[0] / 50) + '_' + Math.floor(u[1] / 50)]; if (!c) continue; const o = (j * W + i) * 4;
      if (c.lv.length) { const s = c.lv.slice().sort((a, b) => a - b); const m = s[s.length >> 1]; const col = colours[band(m)]; rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; rgba[o + 3] = 235; }
      else { const hatch = ((i + j) % 6) < 2; const hc = PB.rgb(hatch ? PB.grey : PB.base.cream); rgba[o] = hc[0]; rgba[o + 1] = hc[1]; rgba[o + 2] = hc[2]; rgba[o + 3] = 220; }
    }
    const file = 'overview/building_floors_50m_3857.png'; fs.mkdirSync(path.join(OUT, 'overview'), { recursive: true }); fs.writeFileSync(path.join(OUT, file), L.png(W, H, rgba));
    const [w2, n2] = L.imerc(x0, y1), [e2, s2] = L.imerc(x0 + W * pm, y1 - H * pm);
    manifest.overview = { buildingFloors: { file, coordinates: [[w2, n2], [e2, n2], [e2, s2], [w2, s2]], cell_m: 50, method: 'median building:levels of buildings whose footprint centroid falls in each 50 m EPSG:25830 cell; grey hatched = buildings present but none with a floor count', classes: colours, cellsWithData: withData, cellsUnknownOnly: unknownOnly } };
    log(`  ${file} ${W}x${H}; cells with data ${withData}, unknown-only ${unknownOnly}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
