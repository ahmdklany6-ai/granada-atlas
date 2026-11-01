// Re-renders the display rasters whose colours are baked into PNGs, from the data already in the repository and the
// shared palette (js/palette.js), and writes the same class tables into data/manifest.json so legends match:
//   data/terrain/elevation_3857.png   from terrain/dem_mdt25.bin     (bilinear, palette.elevRamp)
//   data/terrain/slope_3857.png       from terrain/slope_deg_x100.bin (class colours, palette.slope + slopeAlpha)
//   data/overview/building_floors_50m_3857.png  recoloured class by class (palette.band; hatch in palette greys)
// The output grids (extent, size, coordinates) are those already recorded in the manifest. Usage:
//   node tools/build_terrain_display.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const L = require('./lib.js'); const P = require('../js/palette.js');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data');
const manifest = JSON.parse(fs.readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));
const T = manifest.terrain; const rgb = P.rgb;

function readGrid(meta, Arr, scale) { const b = fs.readFileSync(path.join(DATA, meta.file)); return Object.assign({}, meta, { arr: new Arr(b.buffer, b.byteOffset, b.byteLength / Arr.BYTES_PER_ELEMENT), scale }); }
function sample(g, x, y, nearest) { // identical to js/data.js sampleGrid
  const fx = (x - g.ox) / g.px - 0.5, fy = (g.oy - y) / g.py - 0.5;
  if (nearest) { const i = Math.floor((x - g.ox) / g.px), j = Math.floor((g.oy - y) / g.py); if (i < 0 || j < 0 || i >= g.width || j >= g.height) return null; const v = g.arr[j * g.width + i]; return v === g.nodata ? null : v * g.scale; }
  const i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height) return null;
  const a = fx - i, b = fy - j, k = j * g.width + i, W = g.width; const v = [g.arr[k], g.arr[k + 1], g.arr[k + W], g.arr[k + W + 1]];
  if (v.some(q => q === g.nodata)) return null; return (v[0] * (1 - a) * (1 - b) + v[1] * a * (1 - b) + v[2] * (1 - a) * b + v[3] * a * b) * g.scale;
}
function render(name, g, colour, nearest) {
  const d = T.display[name]; const [[w, n], , [e, s]] = d.coordinates; const [x0, y1] = L.merc(w, n), [x1, y0] = L.merc(e, s);
  const W = d.width, H = d.height, pmx = (x1 - x0) / W, pmy = (y1 - y0) / H; const rgba = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = L.PJ.EPSG25830.forward(L.imerc(x0 + (i + 0.5) * pmx, y1 - (j + 0.5) * pmy)); const v = sample(g, u[0], u[1], nearest); if (v == null) continue;
    const c = colour(v); const o = (j * W + i) * 4; rgba.set(c, o);
  }
  fs.writeFileSync(path.join(DATA, d.file), L.png(W, H, rgba)); console.log(d.file, W + 'x' + H);
}
// elevation ramp (values stay; colours from the palette)
const ramp = P.elevRamp.map(([v, c]) => [v, rgb(c)]);
render('elevation', readGrid(T.dem, Int16Array, 1), (v) => { let a = ramp[0], b = ramp[ramp.length - 1]; for (let i = 1; i < ramp.length; i++) if (v <= ramp[i][0]) { a = ramp[i - 1]; b = ramp[i]; break; } const t = Math.max(0, Math.min(1, (v - a[0]) / (b[0] - a[0]))); return [0, 1, 2].map(k => Math.round(a[1][k] + t * (b[1][k] - a[1][k]))).concat([255]); });
T.elevRamp = ramp;
// slope classes (limits stay; colours and opacity from the palette)
const lim = [2, 5, 10, 15, 25, 35, 90]; const cls = lim.map((m, i) => [m, rgb(P.slope[i][1]).concat([P.slopeAlpha[i]])]);
render('slope', readGrid(T.slope, Uint16Array, 0.01), (v) => cls.find(c => v < c[0])[1], true);
T.slopeClasses = cls.map((c, i) => ({ min: i ? cls[i - 1][0] : 0, max: c[0] === 90 ? null : c[0], rgba: c[1] }));
// building-floors overview: replace each class colour (and the grey hatch for "no floor count") pixel by pixel
{ const o = manifest.overview.buildingFloors; const f = path.join(DATA, o.file); const old = Object.assign({}, o.classes);
  const png = fs.readFileSync(f); const W = png.readUInt32BE(16), H = png.readUInt32BE(20);
  let p = 8, idat = []; while (p < png.length) { const len = png.readUInt32BE(p), type = png.toString('ascii', p + 4, p + 8); if (type === 'IDAT') idat.push(png.slice(p + 8, p + 8 + len)); p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const rgba = new Uint8Array(W * H * 4); const stride = W * 4;
  for (let y = 0; y < H; y++) { const ft = raw[y * (stride + 1)]; const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)); const prev = y ? rgba.subarray((y - 1) * stride, y * stride) : null; const out = rgba.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) { const a = i >= 4 ? out[i - 4] : 0, b = prev ? prev[i] : 0, c = prev && i >= 4 ? prev[i - 4] : 0; let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1; else if (ft === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; } out[i] = v & 255; } }
  const key = (c) => c[0] + ',' + c[1] + ',' + c[2]; const map = new Map();
  Object.entries(old).forEach(([k, c]) => map.set(key(c), rgb(P.band[k])));
  const hatchOld = [[120, 124, 130], [236, 236, 236]]; const hatchNew = [rgb(P.grey), rgb(P.base.cream)]; hatchOld.forEach((c, i) => map.set(key(c), hatchNew[i]));
  let n = 0; for (let i = 0; i < rgba.length; i += 4) { if (!rgba[i + 3]) continue; const m = map.get(key([rgba[i], rgba[i + 1], rgba[i + 2]])); if (m) { rgba.set(m, i); n++; } }
  fs.writeFileSync(f, L.png(W, H, rgba)); o.classes = Object.fromEntries(Object.keys(old).map(k => [k, rgb(P.band[k])])); o.hatch = { line: rgb(P.grey), fill: rgb(P.base.cream) };
  console.log(o.file, 'recoloured pixels', n); }
fs.writeFileSync(path.join(DATA, 'manifest.json'), JSON.stringify(manifest));
