// Terrain-derived flow paths from the IGN MDT25 grid already in the repository (data/terrain/dem_mdt25.bin).
// Method: priority-flood depression filling (Barnes et al. 2014, with a tiny gradient so flats drain), D8 flow directions
// (steepest descent to one of 8 neighbours), flow accumulation in cells, then every cell whose upslope area is ≥ MIN_HA
// becomes a short line to its downstream cell; consecutive segments are merged into polylines and classed by upslope area.
// This is an APPROXIMATION of where surface water would concentrate on bare terrain: the 25 m model has no kerbs, drains,
// culverts, buildings or sewers, and the fill step can route water across real barriers. Output: data/vec/flow_paths.json.
//   node tools/build_flow.js
const fs = require('fs'), path = require('path');
const PJ = require('../js/proj.js');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data');
const man = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8')); const g = man.terrain.dem;
const buf = fs.readFileSync(path.join(DATA, g.file)); const dem = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
const W = g.width, H = g.height, N = W * H, cellHa = g.px * g.py / 1e4; const MIN_HA = 10;
const z = new Float64Array(N); const valid = new Uint8Array(N);
for (let i = 0; i < N; i++) { valid[i] = dem[i] !== g.nodata ? 1 : 0; z[i] = dem[i]; }
// ---- priority-flood with epsilon (fills pits so every cell drains to the grid edge or nodata) ----
const heap = []; const push = (v, i) => { heap.push([v, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
const done = new Uint8Array(N); const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
const edge = (x, y) => x === 0 || y === 0 || x === W - 1 || y === H - 1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!valid[i]) continue; let b = edge(x, y); if (!b) for (let k = 0; k < 8; k++) if (!valid[(y + DY[k]) * W + x + DX[k]]) { b = true; break; } if (b) { done[i] = 1; push(z[i], i); } }
const EPS = 1e-3;
while (heap.length) { const [, i] = pop(); const x = i % W, y = (i / W) | 0;
  for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (done[j] || !valid[j]) continue; done[j] = 1; if (z[j] <= z[i]) z[j] = z[i] + EPS; push(z[j], j); } }
// ---- D8 directions ----
const dir = new Int8Array(N).fill(-1);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!valid[i]) continue; let best = 0, bk = -1;
  for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!valid[j]) continue; const d = (z[i] - z[j]) / (k % 2 ? Math.SQRT2 : 1); if (d > best) { best = d; bk = k; } }
  dir[i] = bk; }
// ---- accumulation (process cells from high to low filled elevation) ----
const order = Array.from({ length: N }, (_, i) => i).filter(i => valid[i]).sort((a, b) => z[b] - z[a]);
const acc = new Float64Array(N); order.forEach(i => acc[i] += 1);
for (const i of order) { const k = dir[i]; if (k < 0) continue; const j = (((i / W) | 0) + DY[k]) * W + (i % W) + DX[k]; acc[j] += acc[i]; }
// ---- lines: cells ≥ MIN_HA, merged into chains that break where the class changes or streams join ----
const CLS = [[10, 50], [50, 250], [250, 1000], [1000, 1e12]]; const cls = (ha) => CLS.findIndex(([a, b]) => ha >= a && ha < b);
const ll = (i) => { const x = i % W, y = (i / W) | 0; const p = PJ.EPSG25830.inverse([g.ox + (x + 0.5) * g.px, g.oy - (y + 0.5) * g.py]); return [+p[0].toFixed(6), +p[1].toFixed(6)]; };
const down = (i) => { const k = dir[i]; return k < 0 ? -1 : (((i / W) | 0) + DY[k]) * W + (i % W) + DX[k]; };
const inflow = new Uint8Array(N); for (let i = 0; i < N; i++) if (valid[i] && acc[i] * cellHa >= MIN_HA) { const j = down(i); if (j >= 0) inflow[j]++; }
const used = new Uint8Array(N); const feats = [];
for (let i = 0; i < N; i++) { if (!valid[i] || acc[i] * cellHa < MIN_HA || used[i]) continue; if (inflow[i] === 1) continue; // start at heads and confluences
  let c = i; const c0 = cls(acc[i] * cellHa); const coords = [ll(c)]; used[c] = 1;
  for (;;) { const j = down(c); if (j < 0) break; coords.push(ll(j)); if (used[j] || inflow[j] !== 1 || cls(acc[j] * cellHa) !== c0) break; used[j] = 1; c = j; }
  if (coords.length > 1) feats.push({ type: 'Feature', properties: { c: c0, ha: Math.round(acc[c] * cellHa) }, geometry: { type: 'LineString', coordinates: coords } }); }
const out = { type: 'FeatureCollection', note: 'Terrain-derived flow paths (approximation) from IGN MDT25 25 m: priority-flood fill + D8; upslope area classes (ha) ' + JSON.stringify(CLS.map(c => c[0])), features: feats };
const s = JSON.stringify(out); fs.writeFileSync(path.join(DATA, 'vec/flow_paths.json'), s);
man.layers.flow_paths = { chunked: false, features: feats.length, bytes: s.length, title: 'Terrain-derived flow paths (approximation)', source: 'Computed in this repository from IGN MDT25 (25 m) — tools/build_flow.js', license: 'CC BY 4.0 — © Instituto Geográfico Nacional (input DEM)', date: 'MDT25 2008–2015; computed 2026-11-01',
  method: 'priority-flood depression filling, D8 flow directions, flow accumulation; lines where the upslope area is ≥ ' + MIN_HA + ' ha; classes 10–50, 50–250, 250–1000, ≥ 1000 ha',
  limitations: '25 m bare-earth model: no kerbs, gutters, drains, culverts, buildings or sewer network; filled depressions can route water across real barriers; not a flood or drainage model' };
fs.writeFileSync(path.join(DATA, 'manifest.json'), JSON.stringify(man));
console.log('flow paths', feats.length, (s.length / 1e6).toFixed(2) + ' MB');
