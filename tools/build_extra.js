// Second-stage data build (Node): supplied GeoJSON datasets and citywide derived grids.
// Usage: node tools/build_extra.js <overture-places.geojson> <bus-frequency.geojson>
// Inputs are the user-supplied files (not stored in the repository). Outputs go to data/.
//  - data/vec/places.json        Overture Places points (all original attributes kept, short keys)
//  - data/vec/bus_service.json   scheduled bus service per stop, service date 2026-10-26
//  - data/grid/built_100m.json   building coverage (GSI) and estimated floor-area ratio per 100 m cell
//  - data/overview/figure_ground_4m_25830.png  1-bit figure-ground in EPSG:25830 (for printed maps)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { ROOT, PJ, writeJSON } = require('./lib');
const U = (c) => PJ.EPSG25830.forward(c);
const [placesFile, busFile] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/manifest.json'), 'utf8'));
const admin = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vec/admin.json'), 'utf8'));
const muni = admin.features.find(f => f.properties.kind === 'municipio');
const barrios = admin.features.filter(f => f.properties.kind === 'barrio');
const polys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
function pip(p, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { if ((ring[i][1] > p[1]) !== (ring[j][1] > p[1]) && p[0] < (ring[j][0] - ring[i][0]) * (p[1] - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; } return c; }
const inGeom = (p, g) => polys(g).some(pl => pip(p, pl[0]) && !pl.slice(1).some(h => pip(p, h)));
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const report = {};

// ---------- 1. Overture Places ----------
if (placesFile) {
  const src = JSON.parse(fs.readFileSync(placesFile, 'utf8'));
  const seen = new Map(); let dups = 0, outside = 0, noGroup = 0, noName = 0; const groups = {};
  const feats = src.features.map((f, i) => {
    const p = f.properties || {}; const c = f.geometry.coordinates;
    const key = String(p.name || '').trim().toLowerCase() + '|' + c[0].toFixed(5) + '|' + c[1].toFixed(5);
    const inM = inGeom(c, muni.geometry) ? 1 : 0; if (!inM) outside++;
    const g = p.category_group || null; if (!g) noGroup++; if (!p.name) noName++;
    const q = { id: p.id, n: p.name || null, c: p.category || null, cd: p.category_detail || null, g, l: p.locality || null, a: p.address || null, pc: p.postcode || null, cf: p.confidence == null ? null : p.confidence, w: p.website || null, ph: p.phone || null, b: p.brand || null, s: p.operating_status || null, in: inM };
    if (seen.has(key)) { q.dup = seen.get(key); dups++; } else seen.set(key, p.id);
    if (!q.dup) groups[g || '_none'] = (groups[g || '_none'] || 0) + 1;
    Object.keys(q).forEach(k => q[k] == null && delete q[k]); return { type: 'Feature', properties: q, geometry: { type: 'Point', coordinates: [r6(c[0]), r6(c[1])] } };
  });
  const conf = feats.map(f => f.properties.cf).filter(v => v != null).sort((a, b) => a - b);
  const st = {}; feats.forEach(f => { const s = f.properties.s || '_missing'; st[s] = (st[s] || 0) + 1; });
  const bytes = writeJSON(path.join(ROOT, 'data/vec/places.json'), { type: 'FeatureCollection', features: feats });
  manifest.layers.places = { chunked: false, features: feats.length, bytes, title: 'Places and activities (Overture Maps)', source: 'Overture Maps Foundation — Places theme (file supplied by the user: overture-all-places-granada.geojson)', license: 'CDLA-Permissive-2.0 · © Overture Maps Foundation', date: 'supplied 2026-10 (Overture release not stated in the file)',
    fields: { id: 'Overture id', n: 'name', c: 'category', cd: 'category_detail', g: 'category_group (null = not classified)', l: 'locality', a: 'address', pc: 'postcode', cf: 'confidence 0–1 (Overture existence confidence; not a guarantee)', w: 'website', ph: 'phone', b: 'brand', s: 'operating_status (open / temporarily_closed / permanently_closed / missing)', in: '1 = inside Granada municipality (OSM boundary)', dup: 'id of the first record with the same name and coordinates (5 decimals); duplicates are excluded from counts' },
    stats: { total: feats.length, duplicates: dups, outsideMunicipality: outside, noGroup, noName, groups, status: st, confidence: { min: conf[0], median: conf[conf.length >> 1], p25: conf[Math.floor(conf.length * 0.25)], p75: conf[Math.floor(conf.length * 0.75)], max: conf[conf.length - 1] } },
    caveat: 'Mapped places, not a census of businesses, people or activity. Counts are not population, footfall or economic vitality.' };
  report.places = manifest.layers.places.stats;
}

// ---------- 2. Bus service (scheduled, one date) ----------
if (busFile) {
  const src = JSON.parse(fs.readFileSync(busFile, 'utf8'));
  let outside = 0; const lv = {}; const routes = new Set(); let zero = 0;
  const feats = src.features.map(f => {
    const p = f.properties; const c = f.geometry.coordinates; const inM = inGeom(c, muni.geometry) ? 1 : 0; if (!inM) outside++;
    const rr = String(p.routes || '').split(/[;,]\s*|\s+/).map(s => s.trim()).filter(Boolean); rr.forEach(r => routes.add(r));
    lv[p.service_level] = (lv[p.service_level] || 0) + 1; if (!p.trips_day) zero++;
    const d = String(p.service_date || ''); const iso = /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
    return { type: 'Feature', properties: { stop_id: p.stop_id, stop_code: p.stop_code, stop_name: p.stop_name, trips_day: p.trips_day, trips_7_9: p.trips_7_9, routes_count: p.routes_count, routes: p.routes, service_level: p.service_level, service_date: iso, in: inM }, geometry: { type: 'Point', coordinates: [r6(c[0]), r6(c[1])] } };
  });
  const td = feats.map(f => f.properties.trips_day).sort((a, b) => a - b);
  // service-level thresholds as they appear in the data (min/max trips_day per level)
  const ranges = {}; feats.forEach(f => { const p = f.properties; const r = ranges[p.service_level] || (ranges[p.service_level] = [Infinity, -Infinity]); r[0] = Math.min(r[0], p.trips_day); r[1] = Math.max(r[1], p.trips_day); });
  const bytes = writeJSON(path.join(ROOT, 'data/vec/bus_service.json'), { type: 'FeatureCollection', features: feats });
  manifest.layers.bus_service = { chunked: false, features: feats.length, bytes, title: 'Bus stops — scheduled service on 26 October 2026', source: 'Stop-level service summary supplied by the user (granada_bus_frequency_2026-10-26.geojson), derived from a published timetable (GTFS); original feed and licence not stated in the file', license: 'not stated in the supplied file — published at the user\'s request; confirm the GTFS licence', date: '2026-10-26 (service date)',
    fields: { stop_id: 'GTFS stop_id', stop_code: 'stop code', stop_name: 'stop name', trips_day: 'scheduled departures at the stop on the service date', trips_7_9: 'scheduled departures in the window named "7_9" (07:00–09:00 by its name; the file does not define it)', routes_count: 'number of routes serving the stop that day', routes: 'route short names', service_level: 'class supplied with the data', service_date: 'date of the schedule', in: '1 = inside Granada municipality' },
    stats: { stops: feats.length, withService: feats.length - zero, noService: zero, outsideMunicipality: outside, routes: routes.size, levels: lv, levelRanges: ranges, tripsDay: { median: td[td.length >> 1], max: td[td.length - 1] } },
    caveat: 'A dated schedule, not live tracking or ridership. Stop departures must not be summed into unique journeys. No scheduled service on this date does not mean the stop is closed.' };
  report.bus = manifest.layers.bus_service.stats;
}

// ---------- 3. 100 m built-density grid + 4. figure-ground raster ----------
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vec/buildings/index.json'), 'utf8'));
const seen = new Set(); const blds = [];
Object.keys(idx).forEach(c => { const fc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vec/buildings', c + '.json'), 'utf8')); fc.features.forEach(f => { if (seen.has(f.properties.id)) return; seen.add(f.properties.id); blds.push(f); }); });
let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
const bu = blds.map(f => { const P = polys(f.geometry).map(pl => pl.map(r => r.map(U))); P.forEach(pl => pl[0].forEach(([x, y]) => { if (x < X0) X0 = x; if (y < Y0) Y0 = y; if (x > X1) X1 = x; if (y > Y1) Y1 = y; })); return { P, lv: f.properties.lv != null && isFinite(+f.properties.lv) && +f.properties.lv > 0 ? +f.properties.lv : null }; });
const C = 100; const gx0 = Math.floor(X0 / C) * C, gy1 = Math.ceil(Y1 / C) * C; const nx = Math.ceil((X1 - gx0) / C), ny = Math.ceil((gy1 - Y0) / C);
const area = new Float64Array(nx * ny), areaLv = new Float64Array(nx * ny), floor = new Float64Array(nx * ny);
const ringArea = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(s / 2); };
function clipRect(r, x0, y0, x1, y1) { // Sutherland–Hodgman against an axis-aligned rectangle
  let out = r;
  const edges = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]], [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]], [(p) => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]], [(p) => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
  for (const [inside, inter] of edges) { const inp = out; out = []; if (!inp.length) break; for (let i = 0; i < inp.length; i++) { const a = inp[(i + inp.length - 1) % inp.length], b = inp[i]; if (inside(b)) { if (!inside(a)) out.push(inter(a, b)); out.push(b); } else if (inside(a)) out.push(inter(a, b)); } }
  return out;
}
bu.forEach(b => b.P.forEach(pl => {
  const xs = pl[0].map(p => p[0]), ys = pl[0].map(p => p[1]);
  const i0 = Math.floor((Math.min(...xs) - gx0) / C), i1 = Math.floor((Math.max(...xs) - gx0) / C), j0 = Math.floor((gy1 - Math.max(...ys)) / C), j1 = Math.floor((gy1 - Math.min(...ys)) / C);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx0 = gx0 + i * C, cy1 = gy1 - j * C; let a = 0;
    pl.forEach((r, k) => { const q = clipRect(r.slice(0, -1), cx0, cy1 - C, cx0 + C, cy1); const v = q.length >= 3 ? ringArea(q) : 0; a += k === 0 ? v : -v; });
    if (a <= 0) continue; const o = j * nx + i; area[o] += a; if (b.lv) { areaLv[o] += a; floor[o] += a * b.lv; }
  }
}));
const cells = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const o = j * nx + i; if (area[o] <= 0) continue; const cov = areaLv[o] / area[o]; cells.push([i, j, +(area[o] / (C * C)).toFixed(4), cov >= 0.8 ? +((floor[o] / areaLv[o]) * area[o] / (C * C)).toFixed(3) : null, +cov.toFixed(3)]); }
fs.mkdirSync(path.join(ROOT, 'data/grid'), { recursive: true });
const gb = writeJSON(path.join(ROOT, 'data/grid/built_100m.json'), { epsg: 25830, cell: C, ox: gx0, oy: gy1, nx, ny, fields: ['i', 'j', 'gsi', 'far_est', 'levels_cov'], cells });
manifest.grids = manifest.grids || {};
manifest.grids.built_100m = { file: 'grid/built_100m.json', bytes: gb, epsg: 25830, cell_m: C, source: 'OpenStreetMap buildings (supplied extract, 23 Oct 2026)', license: 'ODbL 1.0', method: 'footprints clipped exactly to each 100 m EPSG:25830 cell (Sutherland–Hodgman). gsi = footprint area / cell area. far_est = Σ(footprint × building:levels) / cell area, given only where ≥ 80 % of the cell\'s footprint area has a floor count, otherwise null; an estimate, not measured floor area.', cells: cells.length };

// figure-ground: 1-bit PNG (palette: 0 transparent, 1 black) at 4 m/px in EPSG:25830
const PX = 4; const fx0 = Math.floor(X0 / 100) * 100, fy1 = Math.ceil(Y1 / 100) * 100; const W = Math.ceil((X1 - fx0) / PX), H = Math.ceil((fy1 - Y0) / PX);
const bits = new Uint8Array(H * Math.ceil(W / 8));
const rowBytes = Math.ceil(W / 8); const setRow = (y, xa, xb) => { for (let x = Math.max(0, xa); x <= Math.min(W - 1, xb); x++) bits[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7); };
bu.forEach(b => b.P.forEach(pl => {
  const rings = pl.map(r => r.map(([x, y]) => [(x - fx0) / PX, (fy1 - y) / PX])); const ys = rings[0].map(p => p[1]);
  const ya = Math.max(0, Math.floor(Math.min(...ys))), yb = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let y = ya; y <= yb; y++) { const sy = y + 0.5; const xs = []; rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[j], c = r[i]; if ((a[1] > sy) !== (c[1] > sy)) xs.push(a[0] + (sy - a[1]) * (c[0] - a[0]) / (c[1] - a[1])); } }); xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) setRow(y, Math.round(xs[k]), Math.round(xs[k + 1]) - 1); }
}));
{ // PNG colour type 3, bit depth 1
  const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 1; ihdr[9] = 3;
  const raw = Buffer.alloc((rowBytes + 1) * H); for (let y = 0; y < H; y++) { raw[y * (rowBytes + 1)] = 0; Buffer.from(bits.buffer, y * rowBytes, rowBytes).copy(raw, y * (rowBytes + 1) + 1); }
  const pngb = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', Buffer.from([255, 255, 255, 28, 30, 33])), chunk('tRNS', Buffer.from([0, 255])), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(path.join(ROOT, 'data/overview/figure_ground_4m_25830.png'), pngb);
  manifest.overview.figureGround = { file: 'overview/figure_ground_4m_25830.png', bytes: pngb.length, epsg: 25830, px_m: PX, ox: fx0, oy: fy1, width: W, height: H, source: 'OpenStreetMap buildings (supplied extract, 23 Oct 2026)', license: 'ODbL 1.0', method: 'scan-line fill of building footprints at 4 m per pixel; black = building' };
}
manifest.generatedExtra = new Date().toISOString();
fs.writeFileSync(path.join(ROOT, 'data/manifest.json'), JSON.stringify(manifest));
console.log(JSON.stringify(report, null, 1)); console.log('grid cells', cells.length, nx, ny, 'fg', W, H, 'buildings', bu.length);
