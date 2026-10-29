// node tests/clip.test.js — synthetic geometry only
const G = require('../js/geo.js'); const K = require('../js/clip.js');
let fails = 0; const ok = (n, c, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' ' + extra : '')); if (!c) fails++; };
const C0 = [-3.5986, 37.1773]; const P = G.proj(C0);
const LL = (pts) => pts.map(P.toLL);
const areaMP = (mp) => mp.reduce((s, poly) => s + G.ringArea(poly[0]) - poly.slice(1).reduce((t, h) => t + G.ringArea(h), 0), 0);
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];

// 1. overlapping squares
let r = K.clipPolygon([LL(rect(0, 0, 100, 100))], LL(rect(50, 50, 200, 200)));
ok('square ∩ square = 2500 m²', Math.abs(areaMP(r) - 2500) < 2, areaMP(r).toFixed(2));
// 2. concave (L-shaped) boundary
const Lshape = LL([[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100], [0, 0]]);
r = K.clipPolygon([LL(rect(20, 20, 80, 80))], Lshape);
ok('rectangle ∩ L-shape = 2000 m²', Math.abs(areaMP(r) - 2000) < 2, areaMP(r).toFixed(2));
// subject that crosses the notch twice → two pieces
r = K.clipPolygon([LL(rect(-10, 60, 110, 70))], LL([[0, 0], [30, 0], [30, 100], [60, 100], [60, 0], [90, 0], [90, 110], [0, 110], [0, 0]]));
ok('band across U-shape → 2 pieces, 600 m²', r.length === 2 && Math.abs(areaMP(r) - 600) < 1, areaMP(r).toFixed(2) + ' in ' + r.length);
// 3. holes: hole fully inside, hole crossing the boundary
const donut = [LL(rect(0, 0, 100, 100)), LL(rect(40, 40, 60, 60))];
r = K.clipPolygon(donut, LL(rect(-10, -10, 110, 110)));
ok('hole kept when inside', Math.abs(areaMP(r) - 9600) < 2 && r[0].length === 2, areaMP(r).toFixed(2));
r = K.clipPolygon(donut, LL(rect(50, -10, 110, 110)));
ok('hole cut by boundary removed correctly', Math.abs(areaMP(r) - (5000 - 200)) < 2, areaMP(r).toFixed(2));
// 4. degenerate: shared edge and shared vertex
r = K.clipPolygon([LL(rect(0, 0, 100, 100))], LL(rect(0, 0, 50, 100)));
ok('collinear edges (perturbation)', Math.abs(areaMP(r) - 5000) < 1, areaMP(r).toFixed(3));
r = K.clipPolygon([LL(rect(0, 0, 100, 100))], LL([[100, 100], [200, 100], [200, 200], [100, 200], [100, 100]]));
ok('touching at one vertex → empty', areaMP(r) < 1, areaMP(r).toFixed(4));
// 5. subject fully inside / boundary fully inside subject / disjoint
ok('subject inside', Math.abs(areaMP(K.clipPolygon([LL(rect(10, 10, 20, 20))], LL(rect(0, 0, 100, 100)))) - 100) < 0.5);
ok('boundary inside subject', Math.abs(areaMP(K.clipPolygon([LL(rect(0, 0, 100, 100))], LL(rect(10, 10, 20, 20)))) - 100) < 0.5);
ok('disjoint', K.clipPolygon([LL(rect(0, 0, 10, 10))], LL(rect(50, 50, 60, 60))).length === 0);
// 6. randomized: GH area vs dense point sampling, concave boundaries
let worst = 0; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let k = 0; k < 120; k++) {
  const star = (cx, cy, R, n) => { const pts = []; for (let i = 0; i < n; i++) { const t = (i / n) * 2 * Math.PI, rr = R * (0.45 + 0.55 * rnd()); pts.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]); } pts.push(pts[0]); return pts; };
  const clipR = star(0, 0, 100, 9), subj = star((rnd() - 0.5) * 120, (rnd() - 0.5) * 120, 80, 7);
  const res = K.clipPolygonPlanar([subj.slice(0, -1)], clipR.slice(0, -1));
  const a = res.reduce((s, p) => s + Math.abs(K.signedArea(p[0])) - p.slice(1).reduce((t, h) => t + Math.abs(K.signedArea(h)), 0), 0);
  const pin = (p, ring) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) ins = !ins; } return ins; };
  let hits = 0; const step = 1.5; for (let x = -200; x < 200; x += step) for (let y = -200; y < 200; y += step) if (pin([x, y], clipR) && pin([x, y], subj)) hits++;
  const ref = hits * step * step; const err = Math.abs(a - ref) / Math.max(ref, 200); worst = Math.max(worst, err);
}
ok('120 random concave cases match sampling (worst rel. err ' + (worst * 100).toFixed(2) + '%)', worst < 0.03);
// 7. line clipping exact
const line = LL([[-50, 50], [150, 50]]);
const pieces = K.clipLine(line, LL(rect(0, 0, 100, 100)));
ok('line clipped to 100 m', pieces.length === 1 && Math.abs(G.lineLength(pieces[0]) - 100) < 0.01, G.lineLength(pieces[0]).toFixed(4));
const zig = LL([[-10, 10], [50, 10], [50, 70], [-10, 70]]);
const p2 = K.clipLine(zig, Lshape);
ok('polyline through L-shape matches sampling', Math.abs(p2.reduce((s, p) => s + G.lineLength(p), 0) - G.lengthInside(zig, Lshape, 0.5)) < 0.6, p2.length + ' pieces');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
