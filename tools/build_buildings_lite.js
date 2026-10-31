// Citywide simplified building footprints for neighbourhood zooms (data/vec/buildings_lite.json).
// Douglas–Peucker in metres (local equirectangular), tolerance 1 m; coordinates rounded to 1e-5° (~1 m);
// tiny rings that collapse are kept as their original ring; holes kept when they survive simplification.
// Only the classes the styles need, precomputed with the app's own rules (js/analysis.js) so the browser can hand the
// file straight to the map's worker: band (floor band or no_data) and period (start-date period or no_data).
// Usage: node tools/build_buildings_lite.js
const fs = require('fs'), path = require('path'); const A = require('../js/analysis.js');
const dir = path.join(__dirname, '..', 'data', 'vec', 'buildings'); const TOL = 1.0;
const lat0 = 37.18 * Math.PI / 180, mx = 111320 * Math.cos(lat0), my = 110540;
function dp(pts, tol) { // pts in metres, returns kept indices
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = -1, mi = -1; const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return keep;
}
const r6 = (v) => Math.round(v * 1e5) / 1e5; // ~1 m: invisible below zoom 14.5, where the full-detail tiles take over
function simplifyRing(ring) {
  if (ring.length <= 5) return ring.map(c => [r6(c[0]), r6(c[1])]);
  // a closed ring starts and ends at the same point: split it at the vertex farthest from the start and simplify both halves
  const m = ring.map(c => [c[0] * mx, c[1] * my]); let far = 1, fd = -1; m.forEach((q, i) => { const d = Math.hypot(q[0] - m[0][0], q[1] - m[0][1]); if (d > fd) { fd = d; far = i; } });
  const k1 = dp(m.slice(0, far + 1), TOL), k2 = dp(m.slice(far), TOL); const keep = (i) => i <= far ? k1[i] : k2[i - far];
  const out = ring.filter((_, i) => keep(i)).map(c => [r6(c[0]), r6(c[1])]);
  return out.length >= 4 ? out : ring.map(c => [r6(c[0]), r6(c[1])]);
}
let n = 0, vin = 0, vout = 0; const seen = new Set(); const out = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json')) {
  for (const ft of JSON.parse(fs.readFileSync(path.join(dir, f))).features) {
    const id = ft.properties.id; if (seen.has(id)) continue; seen.add(id); // features crossing tile edges appear in several tiles
    const g = ft.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; if (!polys.length) continue;
    const sp = polys.map(pl => pl.map((r, i) => { vin += r.length; const s = simplifyRing(r); vout += s.length; return s; }).filter((r, i) => i === 0 || r.length >= 4));
    const q = ft.properties, lv = q.lv != null && isFinite(+q.lv) ? +q.lv : null, y = A.parseYear(q.sd);
    const p = { band: lv == null ? 'no_data' : A.levelBand(lv), period: y == null ? 'no_data' : (A.periodOf(y) || 'no_data') };
    out.push({ type: 'Feature', properties: p, geometry: sp.length === 1 ? { type: 'Polygon', coordinates: sp[0] } : { type: 'MultiPolygon', coordinates: sp } }); n++;
  }
}
const file = path.join(__dirname, '..', 'data', 'vec', 'buildings_lite.json');
fs.writeFileSync(file, JSON.stringify({ type: 'FeatureCollection', note: `OSM buildings (ODbL), simplified for overview display: Douglas–Peucker ${TOL} m, 1e-5° coordinates`, features: out }));
console.log(n, 'buildings', vin, '→', vout, 'vertices', (fs.statSync(file).size / 1e6).toFixed(1), 'MB');
