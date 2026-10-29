// node tests/proj.test.js
const PJ = require('../js/proj.js');
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
// EPSG Guidance Note 7-2, Transverse Mercator worked example (OSGB 1936 / British National Grid):
// 50°30'N 0°30'E → E 577274.99 m, N 69740.50 m
const bng = PJ.TM({ a: 6377563.396, invf: 299.3249646, lat0: 49, lon0: -2, k0: 0.9996012717, fe: 400000, fn: -100000 });
const en = bng.forward([0.5, 50.5]);
ok('GN7-2 forward easting', Math.abs(en[0] - 577274.99) < 0.01, en[0].toFixed(3));
ok('GN7-2 forward northing', Math.abs(en[1] - 69740.50) < 0.01, en[1].toFixed(3));
const back = bng.inverse([577274.99, 69740.50]);
ok('GN7-2 inverse', Math.abs(back[0] - 0.5) < 1e-7 && Math.abs(back[1] - 50.5) < 1e-7, back.map(v => v.toFixed(9)).join(', '));
// Granada round trips across the city and the zone edge
let worst = 0;
for (let lon = -3.75; lon <= -3.45; lon += 0.05) for (let lat = 37.05; lat <= 37.30; lat += 0.05) {
  const p = PJ.EPSG25830.inverse(PJ.EPSG25830.forward([lon, lat])); worst = Math.max(worst, Math.abs(p[0] - lon), Math.abs(p[1] - lat));
}
ok('EPSG:25830 round trip over Granada < 1e-9°', worst < 1e-9, worst.toExponential(2));
const cm = PJ.EPSG25830.forward([-3, 37.18]);
ok('central meridian maps to E = 500000', Math.abs(cm[0] - 500000) < 1e-6);
// Distance check: 1 km east of the centre, distance in UTM ≈ geodesic × scale factor
const G = require('../js/geo.js'); const P = G.proj([-3.5986, 37.1773]);
const a = PJ.EPSG25830.forward([-3.5986, 37.1773]), b = PJ.EPSG25830.forward(P.toLL([1000, 0]));
// Expected point scale of UTM here: k = k0·(1 + x²/2R²) with x ≈ distance from the central meridian
const kExp = 0.9996 * (1 + Math.pow((a[0] - 500000) / 0.9996, 2) / (2 * 6371000 * 6371000));
const kE = Math.hypot(b[0] - a[0], b[1] - a[1]) / 1000;
ok('1 km east: UTM length / ground length = point scale (local metric is right)', Math.abs(kE - kExp) < 2e-5, kE.toFixed(6) + ' vs ' + kExp.toFixed(6));
const c = PJ.EPSG25830.forward(P.toLL([0, 1000])); const kN = Math.hypot(c[0] - a[0], c[1] - a[1]) / 1000;
ok('1 km north: same check', Math.abs(kN - kExp) < 2e-5, kN.toFixed(6));
const sq = G.square([-3.5986, 37.1773], 500).map(p => PJ.EPSG25830.forward(p));
let ar = 0; for (let i = 0; i < sq.length - 1; i++) ar += sq[i][0] * sq[i + 1][1] - sq[i + 1][0] * sq[i][1];
ok('500 m square: UTM area / ground area = k²', Math.abs(Math.abs(ar / 2) / 250000 - kExp * kExp) < 4e-5, (Math.abs(ar / 2)).toFixed(1) + ' m² in UTM');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
