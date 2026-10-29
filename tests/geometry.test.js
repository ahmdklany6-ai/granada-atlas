// Run: node tests/geometry.test.js   (synthetic fixtures only — not Granada data)
const G = require('../js/geo.js');
const A = require('../js/analysis.js');
let fails = 0;
const near = (name, got, want, tolPct) => {
  const ok = Math.abs(got - want) <= Math.abs(want) * tolPct / 100;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ': ' + got.toFixed(3) + ' vs ' + want.toFixed(3)); if (!ok) fails++;
};
const truthy = (name, v) => { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) fails++; };

const C = [-3.5986, 37.1773]; // Plaza Bib-Rambla area, used only as a reference latitude
near('square 500 m area', G.ringArea(G.square(C, 500)), 250000, 0.2);
near('square 500 m perimeter', G.perimeter(G.square(C, 500)), 2000, 0.3);
near('square 10 km area', G.ringArea(G.square(C, 10000)), 1e8, 0.5);
near('circle r=250 area (64 steps)', G.ringArea(G.circle(C, 250, 64)), Math.PI * 250 * 250, 0.6);
near('1° latitude at the equator (ellipsoid: 110 574 m)', G.haversine([0, -0.5], [0, 0.5]), 110574, 0.05);
const sq = G.square(C, 500);
const P = G.proj(C);
// 1 km W–E line through centre: 500 m of it lies inside the square
const line = [P.toLL([-500, 0]), P.toLL([500, 0])];
near('length inside square', G.lengthInside(line, sq, 5), 500, 1);
truthy('centre inside square', G.pointInRing(C, sq));
truthy('point 300 m E outside', !G.pointInRing(P.toLL([300, 0]), sq));
truthy('bow-tie self-intersects', G.selfIntersects([P.toLL([0, 0]), P.toLL([100, 100]), P.toLL([100, 0]), P.toLL([0, 100])]));
truthy('square does not self-intersect', !G.selfIntersects(sq));
const gs = G.gridSample(sq, 10000);
near('grid sample covers area', gs.points.length * gs.cellArea, 250000, 3);

// Synthetic Overpass response: two buildings (one inside, one outside), one street, one park.
const geom = (pts) => pts.map(xy => { const ll = P.toLL(xy); return { lon: ll[0], lat: ll[1] }; });
const ring = (x, y, w) => geom([[x, y], [x + w, y], [x + w, y + w], [x, y + w], [x, y]]);
const fixture = { osm3s: { timestamp_osm_base: '2026-10-29T00:00:00Z' }, elements: [
  { type: 'way', id: 1, tags: { building: 'apartments', 'building:levels': '5', start_date: '1972' }, geometry: ring(0, 0, 20) },
  { type: 'way', id: 2, tags: { building: 'yes' }, geometry: ring(400, 400, 20) },
  { type: 'way', id: 3, tags: { highway: 'residential', name: 'Calle Test' }, geometry: geom([[-400, 50], [400, 50]]) },
  { type: 'way', id: 4, tags: { leisure: 'park', name: 'Parque Test' }, geometry: ring(-200, -200, 100) },
  { type: 'node', id: 5, lat: C[1], lon: C[0], tags: { amenity: 'school', name: 'Escuela Test' } },
  { type: 'node', id: 6, lat: P.toLL([10, -30])[1], lon: P.toLL([10, -30])[0], tags: { highway: 'bus_stop' } },
  { type: 'area', id: 3600000001, tags: { boundary: 'administrative', admin_level: '9', name: 'Distrito Test' } },
] };
const parsed = A.parseOverpass(fixture);
const m = A.osmMetrics(parsed, sq);
truthy('one building inside', m.buildings.count === 1);
near('GSI', m.buildings.gsi, 400 / 250000, 1);
truthy('levels band 5–8', m.buildings.bands['5-8'] === 1);
truthy('period 1960–1979', m.buildings.periods['1960_1979'] === 1);
near('street length clipped', m.streets.tiers.local, 500, 1.5);
near('park area via grid', m.landuse.areas.green, 10000, 12);
truthy('school counted as public:education', m.pois.cats['public:education'] === 1);
truthy('bus stop counted', m.pois.cats['transit:bus'] === 1);
truthy('admin parsed', m.admin[0].name === 'Distrito Test');
const prof = A.profileMetrics([P.toLL([0, 0]), P.toLL([100, 0])], [700, 710]);
near('slope 10%', prof.maxSlopePct, 10, 1);
const d = A.diff({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 });
truthy('diff finds 2 changes', d.length === 2);
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
