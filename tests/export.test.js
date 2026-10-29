// node tests/export.test.js <outdir>  — builds GIS packages from a synthetic fixture (not real Granada data)
const fs = require('fs'), path = require('path');
const G = require('../js/geo.js'), A = require('../js/analysis.js'), X = require('../js/export/gisexport.js'), I = require('../js/i18n.js');
const initSqlJs = require('../vendor/sqljs/sql-wasm.js');
const OUT = process.argv[2] || '/tmp/gis-out'; fs.mkdirSync(OUT, { recursive: true });
const C = [-3.5986, 37.1773], P = G.proj(C);
const g = (pts) => pts.map(xy => { const ll = P.toLL(xy); return { lon: ll[0], lat: ll[1] }; });
const rect = (x0, y0, x1, y1) => g([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
const els = [];
let id = 1;
for (let x = -230; x < 230; x += 40) for (let y = -230; y < 230; y += 40) {
  const t = { building: 'apartments' };
  if ((x + y) % 80 === 0) t['building:levels'] = String(1 + Math.abs(x / 40 | 0) % 10);
  if (y === -30) t.start_date = String(1890 + (x + 230));
  els.push({ type: 'way', id: id++, tags: t, geometry: rect(x, y, x + 25, y + 25) });
}
// building with a courtyard (multipolygon)
els.push({ type: 'relation', id: 500, tags: { building: 'yes', name: 'Patio test', 'building:levels': '3' }, members: [{ type: 'way', role: 'outer', geometry: rect(260, 260, 320, 320) }, { type: 'way', role: 'inner', geometry: rect(280, 280, 300, 300) }] });
els.push({ type: 'way', id: 600, tags: { highway: 'primary', name: 'Calle Recta (test)', maxspeed: '50' }, geometry: g([[-600, 5], [600, 5]]) });
els.push({ type: 'way', id: 601, tags: { highway: 'steps' }, geometry: g([[0, -600], [0, -100], [50, 0], [0, 600]]) });
els.push({ type: 'relation', id: 700, tags: { landuse: 'residential', name: 'Barrio (test)' }, members: [{ type: 'way', role: 'outer', geometry: rect(-400, -400, 100, 100) }, { type: 'way', role: 'inner', geometry: rect(-120, -120, -60, -60) }] });
els.push({ type: 'way', id: 701, tags: { leisure: 'park', name: 'Jardín (test)' }, geometry: rect(150, -300, 400, -150) });
els.push({ type: 'node', id: 800, lat: C[1], lon: C[0], tags: { amenity: 'school', name: 'Colegio (test)' } });
els.push({ type: 'node', id: 801, lat: P.toLL([60, 60])[1], lon: P.toLL([60, 60])[0], tags: { highway: 'bus_stop', route_ref: 'C1;C2' } });
els.push({ type: 'node', id: 802, lat: P.toLL([-60, 80])[1], lon: P.toLL([-60, 80])[0], tags: { tourism: 'hotel', name: 'Hotel ünïcode “test”' } });
els.push({ type: 'area', id: 3600000009, tags: { boundary: 'administrative', admin_level: '9', name: 'Distrito (test)' } });

(async () => {
  const b64 = fs.readFileSync(path.join(__dirname, '../vendor/sqljs/sql-wasm-binary.js'), 'utf8').match(/SQL_WASM_BASE64="([^"]+)"/)[1];
  const SQL = await initSqlJs({ wasmBinary: Buffer.from(b64, 'base64') });
  const parsed = A.parseOverpass({ osm3s: { timestamp_osm_base: '2026-10-29T08:00:00Z' }, elements: els });
  const cases = [
    { name: 'square_4326_en', lang: 'en', spec: { type: 'square', center: C, side: 500 }, ring: G.square(C, 500), crs: 4326 },
    { name: 'concave_25830_ar', lang: 'ar', spec: { type: 'polygon', center: C }, ring: G.closeRing([[-250, -250], [250, -250], [250, 0], [0, 0], [0, 250], [-250, 250]].map(P.toLL)), crs: 25830 },
    { name: 'circle_25830_he', lang: 'he', spec: { type: 'circle', center: C, radius: 260 }, ring: G.circle(C, 260, 64), crs: 25830 },
  ];
  for (const k of cases) {
    I.setLang(k.lang);
    const osm = A.osmMetrics(parsed, k.ring);
    const sec = G.sectionLine(C, 500, 'WE', 30);
    const run = { runAt: '2026-10-29T10:00:00Z', section: 'WE', parsed, tasks: { osm: { state: 'ok' }, terrain: { state: 'ok' } },
      result: { osm, osmBase: parsed.osmBase, sectionLine: [sec[0], sec[sec.length - 1]], profile: Object.assign(A.profileMetrics(sec, sec.map((p, i) => 700 + i)), { pts: sec }),
        climate: { year: '2025', hot35: 40, trop20: 30, precip: 350, gridLat: 37.2, gridLon: -3.6, elevation: 760, monthly: Array.from({ length: 12 }, (_, i) => ({ max: 10 + i, min: i })) } } };
    // Test-only elevation stub: a known plane so the validator can check raster georeferencing exactly
    const elev = async (pts) => pts.map(p => 700 + (p[1] - 37.17) * 10000 + (p[0] + 3.6) * 1000);
    const r = await X.build({ area: { name: 'Prueba ' + k.name }, spec: k.spec, ring: k.ring, run }, { gpkg: true, geojson: true, crs: k.crs, dem: true, demCell: 30, styles: true }, { loadSQL: async () => SQL, elevation: elev, progress: () => {} });
    const dir = path.join(OUT, k.name); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, r.filename), Buffer.from(r.zipBytes));
    fs.writeFileSync(path.join(dir, 'ring.json'), JSON.stringify(k.ring));
    console.log(k.name, r.filename, (r.zipBytes.length / 1024).toFixed(0) + ' KB', r.layers.map(l => l.id + ':' + (l.features ? l.features.length : l.status)).join(' '));
  }
})().catch(e => { console.error(e); process.exit(1); });
