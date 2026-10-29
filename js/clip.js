/* Exact clipping of OSM geometries to the study boundary, for GIS export.
   Lines: every segment is split where it crosses the boundary; inside pieces are kept.
   Polygons: Greiner–Hormann intersection (and difference, for holes) in a local metric
   plane. Degenerate cases (shared vertices, collinear edges) are resolved by moving the
   clip boundary by ≤0.1 mm, which is far below the precision of the source data. */
(function (root) {
  const G = (typeof module !== 'undefined' && module.exports) ? require('./geo.js') : root.GA.geo;
  const EPS = 1e-9;

  function segInter(a1, a2, b1, b2) {
    const d = (a2[0] - a1[0]) * (b2[1] - b1[1]) - (a2[1] - a1[1]) * (b2[0] - b1[0]);
    if (Math.abs(d) < 1e-12) return null; // parallel
    const ta = ((b1[0] - a1[0]) * (b2[1] - b1[1]) - (b1[1] - a1[1]) * (b2[0] - b1[0])) / d;
    const tb = ((b1[0] - a1[0]) * (a2[1] - a1[1]) - (b1[1] - a1[1]) * (a2[0] - a1[0])) / d;
    return { ta, tb };
  }
  function pip(p, ring) { // planar, open or closed ring
    let inside = false; const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  const open = (r) => { const o = r.slice(); while (o.length > 1 && o[0][0] === o[o.length - 1][0] && o[0][1] === o[o.length - 1][1]) o.pop(); return o; };
  const signedArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

  // ---------- Greiner–Hormann ----------
  function makeList(pts) {
    const nodes = pts.map(p => ({ x: p[0], y: p[1], inter: false, entry: false, neighbor: null, alpha: 0, visited: false, next: null, prev: null }));
    nodes.forEach((n, i) => { n.next = nodes[(i + 1) % nodes.length]; n.prev = nodes[(i - 1 + nodes.length) % nodes.length]; });
    return nodes;
  }
  function insertBetween(node, start, end) {
    let cur = start.next;
    while (cur !== end && cur.alpha < node.alpha) cur = cur.next;
    node.next = cur; node.prev = cur.prev; cur.prev.next = node; cur.prev = node;
  }
  // op: 'and' (S ∩ C) or 'minus' (S − C). S and C: open planar rings. Returns array of open rings,
  // or {contained:'S'|'C'|'none'} when the boundaries do not cross.
  function gh(S, C, op) {
    const sNodes = makeList(S), cNodes = makeList(C); let count = 0;
    for (let i = 0; i < sNodes.length; i++) {
      const s1 = sNodes[i], s2 = sNodes[(i + 1) % sNodes.length];
      for (let j = 0; j < cNodes.length; j++) {
        const c1 = cNodes[j], c2 = cNodes[(j + 1) % cNodes.length];
        const r = segInter([s1.x, s1.y], [s2.x, s2.y], [c1.x, c1.y], [c2.x, c2.y]);
        if (!r) { // parallel: degenerate only if collinear and overlapping
          const cross = (c1.x - s1.x) * (s2.y - s1.y) - (c1.y - s1.y) * (s2.x - s1.x);
          if (Math.abs(cross) < 1e-9) { const minx = Math.min(s1.x, s2.x) - EPS, maxx = Math.max(s1.x, s2.x) + EPS, miny = Math.min(s1.y, s2.y) - EPS, maxy = Math.max(s1.y, s2.y) + EPS; if ((c1.x >= minx && c1.x <= maxx && c1.y >= miny && c1.y <= maxy) || (c2.x >= minx && c2.x <= maxx && c2.y >= miny && c2.y <= maxy)) return 'degenerate'; }
          continue;
        }
        const onA = r.ta > -EPS && r.ta < 1 + EPS, onB = r.tb > -EPS && r.tb < 1 + EPS;
        if (!onA || !onB) continue;
        if (r.ta < EPS || r.ta > 1 - EPS || r.tb < EPS || r.tb > 1 - EPS) return 'degenerate';
        const x = s1.x + r.ta * (s2.x - s1.x), y = s1.y + r.ta * (s2.y - s1.y);
        const ns = { x, y, inter: true, entry: false, neighbor: null, alpha: r.ta, visited: false };
        const nc = { x, y, inter: true, entry: false, neighbor: null, alpha: r.tb, visited: false };
        ns.neighbor = nc; nc.neighbor = ns; insertBetween(ns, s1, s2); insertBetween(nc, c1, c2); count++;
      }
    }
    if (count === 0) {
      if (pip(S[0], C)) return { contained: 'S' };
      if (pip(C[0], S)) return { contained: 'C' };
      return { contained: 'none' };
    }
    const mark = (first, other, invert) => {
      let inside = pip([first.x, first.y], other); let n = first;
      do { if (n.inter) { n.entry = !inside; if (invert) n.entry = !n.entry; inside = !inside; } n = n.next; } while (n !== first);
    };
    mark(sNodes[0], C, op === 'minus'); mark(cNodes[0], S, false);
    const out = []; let start = sNodes[0];
    for (;;) {
      let v = start, found = null;
      do { if (v.inter && !v.visited) { found = v; break; } v = v.next; } while (v !== start);
      if (!found) break;
      const ring = [[found.x, found.y]]; let cur = found; let guard = 0;
      for (;;) {
        cur.visited = true; cur.neighbor.visited = true; const fwd = cur.entry;
        do { cur = fwd ? cur.next : cur.prev; ring.push([cur.x, cur.y]); if (++guard > 1e6) throw new Error('clip loop'); } while (!cur.inter);
        cur = cur.neighbor; if (cur.visited) break;
      }
      out.push(open(ring));
    }
    return out;
  }
  function ghSafe(S, C, op) {
    for (let k = 0; k < 6; k++) {
      const Cp = k === 0 ? C : C.map((p, i) => [p[0] + Math.sin(i * 12.9898 + k * 78.233) * 1e-4, p[1] + Math.cos(i * 4.1414 + k * 3.33) * 1e-4]);
      const r = gh(S, Cp, op); if (r !== 'degenerate') return r;
    }
    throw new Error('clip degenerate');
  }

  // Polygon with holes (planar) ∩ clip ring → array of polygons [[outer, ...holes], ...]
  function clipPolygonPlanar(rings, clip) {
    const outer = open(rings[0]), holes = rings.slice(1).map(open).filter(h => h.length >= 3);
    let pieces;
    const r = ghSafe(outer, clip, 'and');
    if (Array.isArray(r)) pieces = r.map(x => [x]);
    else if (r.contained === 'S') pieces = [[outer]];
    else if (r.contained === 'C') pieces = [[clip]];
    else pieces = [];
    holes.forEach(h => {
      const next = [];
      pieces.forEach(poly => {
        const d = ghSafe(poly[0], h, 'minus');
        if (Array.isArray(d)) d.forEach(x => next.push([x].concat(poly.slice(1).filter(ih => pip(ih[0], x)))));
        else if (d.contained === 'C') next.push(poly.concat([h])); // hole lies fully inside this piece
        else if (d.contained === 'S') { /* piece lies fully inside the hole: removed */ }
        else next.push(poly);
      });
      pieces = next;
    });
    return pieces.map(p => p.filter(r => r.length >= 3 && Math.abs(signedArea(r)) > 1e-6)).filter(p => p.length && Math.abs(signedArea(p[0])) > 1e-4);
  }

  // Public: clip a GeoJSON-style polygon (rings in lon/lat) by a lon/lat boundary ring.
  // Returns MultiPolygon coordinates in lon/lat with RFC 7946 winding (outer CCW, holes CW).
  function clipPolygon(rings, boundary) {
    const P = G.proj(G.centroidLL(boundary));
    const clip = open(boundary).map(P.toXY);
    const polys = clipPolygonPlanar(rings.map(r => open(r).map(P.toXY)), clip);
    return polys.map(poly => poly.map((ring, i) => {
      let r = ring; const a = signedArea(r);
      if ((i === 0 && a < 0) || (i > 0 && a > 0)) r = r.slice().reverse();
      r = r.map(P.toLL); r.push(r[0]); return r;
    }));
  }

  // Exact line clipping. Returns array of lon/lat LineStrings inside the boundary.
  function clipLine(coords, boundary) {
    const P = G.proj(G.centroidLL(boundary)); const C = open(boundary).map(P.toXY); const L = coords.map(P.toXY);
    const pieces = []; let cur = null;
    for (let i = 1; i < L.length; i++) {
      const a = L[i - 1], b = L[i]; const ts = [0, 1];
      for (let j = 0; j < C.length; j++) { const r = segInter(a, b, C[j], C[(j + 1) % C.length]); if (r && r.ta > 0 && r.ta < 1 && r.tb >= 0 && r.tb <= 1) ts.push(r.ta); }
      ts.sort((x, y) => x - y);
      for (let k = 1; k < ts.length; k++) {
        if (ts[k] - ts[k - 1] < 1e-12) continue;
        const pt = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const mid = pt((ts[k] + ts[k - 1]) / 2);
        if (pip(mid, C)) { const p0 = pt(ts[k - 1]), p1 = pt(ts[k]); if (cur && cur[cur.length - 1][0] === p0[0] && cur[cur.length - 1][1] === p0[1]) cur.push(p1); else { cur = [p0, p1]; pieces.push(cur); } }
        else cur = null;
      }
    }
    return pieces.map(p => p.map(P.toLL));
  }

  const api = { clipPolygon, clipLine, clipPolygonPlanar, signedArea };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GA = root.GA || {}; root.GA.clip = api; }
})(typeof window !== 'undefined' ? window : globalThis);
