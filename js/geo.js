/* Geometry helpers. Works in the browser (window.GA.geo) and in Node (module.exports).
   Coordinates are [lon, lat] in WGS84. Distances in metres.
   Method: local projection on the GRS80 ellipsoid around a reference point. For study areas
   up to ~15 km across, areas and lengths agree with ETRS89/UTM (scale-corrected) to ~0.01 %. */
(function (root) {
  const R = 6371008.8; // mean Earth radius (m), kept for reference
  const D2R = Math.PI / 180;
  // GRS80 / WGS 84 ellipsoid: local radii of curvature make metric conversions exact to ~1e-6
  // over a few kilometres (a sphere would be off by ~0.2 % at Granada's latitude).
  const A_ = 6378137, E2 = 0.0066943800229;
  function radii(latDeg) { const s = Math.sin(latDeg * D2R), w = 1 - E2 * s * s; return { M: A_ * (1 - E2) / Math.pow(w, 1.5), N: A_ / Math.sqrt(w) }; }

  function proj(ref) {
    const lon0 = ref[0], r = radii(ref[1]);
    const kx = r.N * Math.cos(ref[1] * D2R) * D2R, ky = r.M * D2R; // metres per degree
    return {
      toXY: (p) => [(p[0] - lon0) * kx, (p[1] - ref[1]) * ky],
      toLL: (xy) => [lon0 + xy[0] / kx, ref[1] + xy[1] / ky],
    };
  }

  // Ellipsoidal distance for short lines (study-area scale), using radii at the mid-latitude.
  function haversine(a, b) {
    const r = radii((a[1] + b[1]) / 2), dx = (b[0] - a[0]) * D2R * r.N * Math.cos((a[1] + b[1]) / 2 * D2R), dy = (b[1] - a[1]) * D2R * r.M;
    return Math.hypot(dx, dy);
  }

  function closeRing(ring) {
    if (!ring.length) return ring;
    const f = ring[0], l = ring[ring.length - 1];
    return (f[0] === l[0] && f[1] === l[1]) ? ring : ring.concat([f]);
  }

  function centroidLL(ring) {
    let x = 0, y = 0; const r = openRing(ring);
    r.forEach(p => { x += p[0]; y += p[1]; });
    return [x / r.length, y / r.length];
  }
  function openRing(ring) {
    if (ring.length > 1) { const f = ring[0], l = ring[ring.length - 1]; if (f[0] === l[0] && f[1] === l[1]) return ring.slice(0, -1); }
    return ring;
  }

  function circle(center, radius, steps) {
    steps = steps || 64; const P = proj(center); const out = [];
    for (let i = 0; i < steps; i++) { const t = (i / steps) * 2 * Math.PI; out.push(P.toLL([radius * Math.sin(t), radius * Math.cos(t)])); }
    return closeRing(out);
  }

  // North-aligned square, side in metres.
  function square(center, side) {
    const P = proj(center), h = side / 2;
    return closeRing([[-h, h], [h, h], [h, -h], [-h, -h]].map(P.toLL));
  }

  function ringArea(ring) { // m², absolute
    const r = openRing(ring); if (r.length < 3) return 0;
    const P = proj(centroidLL(r)); const xy = r.map(P.toXY); let a = 0;
    for (let i = 0; i < xy.length; i++) { const p = xy[i], q = xy[(i + 1) % xy.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(a) / 2;
  }

  function lineLength(coords) { let s = 0; for (let i = 1; i < coords.length; i++) s += haversine(coords[i - 1], coords[i]); return s; }
  function perimeter(ring) { return lineLength(closeRing(ring)); }

  function bbox(ring) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    ring.forEach(p => { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); });
    return [a, b, c, d];
  }

  function pointInRing(pt, ring) { // ray casting, ring lon/lat
    let inside = false; const r = openRing(ring);
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inBBox(p, b) { return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]; }

  // Length of a polyline that lies inside a ring. Each segment is cut into pieces of at most
  // `step` metres; a piece counts if its midpoint is inside. Error per crossing ≤ step/2.
  function lengthInside(coords, ring, step, bb) {
    step = step || 5; bb = bb || bbox(ring); let s = 0;
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i]; const L = haversine(a, b); if (!L) continue;
      const n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n; const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (inBBox(m, bb) && pointInRing(m, ring)) s += L / n;
      }
    }
    return s;
  }

  // Regular grid of sample points inside a ring; returns {points, cellArea}.
  function gridSample(ring, maxPoints) {
    maxPoints = maxPoints || 20000; const area = ringArea(ring);
    const cell = Math.max(2, Math.sqrt(area / maxPoints));
    const c = centroidLL(ring), P = proj(c), bb = bbox(ring);
    const lo = P.toXY([bb[0], bb[1]]), hi = P.toXY([bb[2], bb[3]]); const pts = [];
    for (let x = lo[0] + cell / 2; x < hi[0]; x += cell) for (let y = lo[1] + cell / 2; y < hi[1]; y += cell) {
      const ll = P.toLL([x, y]); if (pointInRing(ll, ring)) pts.push(ll);
    }
    return { points: pts, cellArea: cell * cell, cell };
  }

  // Do two segments cross (proper intersection)? Used to warn about self-intersecting polygons.
  function segCross(p1, p2, p3, p4) {
    const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function selfIntersects(ring) {
    const r = openRing(ring), n = r.length; if (n < 4) return false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segCross(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return true;
    }
    return false;
  }

  // Points spaced evenly along a straight line through `center`, bearing 90 (W–E) or 0 (S–N).
  function sectionLine(center, lengthM, orientation, n) {
    const P = proj(center), h = lengthM / 2; n = n || 60; const pts = [];
    for (let i = 0; i < n; i++) { const t = -h + (lengthM * i) / (n - 1); pts.push(P.toLL(orientation === 'NS' ? [0, t] : [t, 0])); }
    return pts;
  }

  function translate(ring, from, to) { const dx = to[0] - from[0], dy = to[1] - from[1]; return ring.map(p => [p[0] + dx, p[1] + dy]); }

  const api = { R, proj, haversine, closeRing, openRing, centroidLL, circle, square, ringArea, perimeter, lineLength, bbox, pointInRing, inBBox, lengthInside, gridSample, selfIntersects, sectionLine, translate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GA = root.GA || {}; root.GA.geo = api; }
})(typeof window !== 'undefined' ? window : globalThis);
