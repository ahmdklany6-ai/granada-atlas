// Shared helpers for the offline data pipeline (Node). Not loaded by the website.
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PJ = require(path.join(ROOT, 'js/proj.js'));

async function sql() {
  const initSqlJs = require(path.join(ROOT, 'vendor/sqljs/sql-wasm.js'));
  const b64 = fs.readFileSync(path.join(ROOT, 'vendor/sqljs/sql-wasm-binary.js'), 'utf8').match(/SQL_WASM_BASE64="([^"]+)"/)[1];
  return initSqlJs({ wasmBinary: Buffer.from(b64, 'base64') });
}
// GeoPackage geometry blob → GeoJSON geometry
function gpkgGeom(u) {
  if (!u || u.length < 8 || u[0] !== 0x47 || u[1] !== 0x50) return null;
  const flags = u[3], et = (flags >> 1) & 7, el = { 0: 0, 1: 32, 2: 48, 3: 48, 4: 64 }[et]; let o = 8 + el;
  if (flags & 0x10) return null; // empty
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  function g() {
    const le = u[o] === 1; let t = dv.getUint32(o + 1, le); o += 5;
    const dims = t > 3000 ? 4 : t > 2000 ? 3 : t > 1000 ? 3 : 2; t = t % 1000; // ISO Z/M variants
    const pt = () => { const p = [dv.getFloat64(o, le), dv.getFloat64(o + 8, le)]; o += 8 * dims; return p; };
    const line = () => { const n = dv.getUint32(o, le); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(pt()); return a; };
    const poly = () => { const n = dv.getUint32(o, le); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(line()); return a; };
    const multi = (fn) => { const n = dv.getUint32(o, le); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(g().coordinates); return a; };
    switch (t) {
      case 1: return { type: 'Point', coordinates: pt() };
      case 2: return { type: 'LineString', coordinates: line() };
      case 3: return { type: 'Polygon', coordinates: poly() };
      case 4: return { type: 'MultiPoint', coordinates: multi() };
      case 5: return { type: 'MultiLineString', coordinates: multi() };
      case 6: return { type: 'MultiPolygon', coordinates: multi() };
    }
    throw new Error('WKB type ' + t);
  }
  return g();
}
function mapCoords(g, fn) { const w = (c) => typeof c[0] === 'number' ? fn(c) : c.map(w); return { type: g.type, coordinates: w(g.coordinates) }; }
const to4326 = (g) => mapCoords(g, (c) => PJ.EPSG25830.inverse(c));
const to25830 = (g) => mapCoords(g, (c) => PJ.EPSG25830.forward(c));
function bbox(g) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; const w = (x) => { if (typeof x[0] === 'number') { if (x[0] < a) a = x[0]; if (x[1] < b) b = x[1]; if (x[0] > c) c = x[0]; if (x[1] > d) d = x[1]; } else x.forEach(w); }; w(g.coordinates); return [a, b, c, d]; }
// Douglas–Peucker on a planar ring/line (metres)
function dp(pts, tol) {
  if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b]; const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) { const [x, y] = pts[i]; let t = L ? ((x - x1) * dx + (y - y1) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(x - x1 - t * dx, y - y1 - t * dy); if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
function simplify(g4326, tolM) { // simplify in UTM, return 4326
  const u = to25830(g4326);
  const s = (ring, closed) => { const r = dp(ring, tolM); return closed && r.length < 4 ? null : (!closed && r.length < 2 ? null : r); };
  let c;
  switch (u.type) {
    case 'LineString': c = s(u.coordinates, false); break;
    case 'MultiLineString': c = u.coordinates.map(l => s(l, false)).filter(Boolean); break;
    case 'Polygon': c = u.coordinates.map(r => s(r, true)).filter(Boolean); if (!c.length) c = null; break;
    case 'MultiPolygon': c = u.coordinates.map(p => p.map(r => s(r, true)).filter(Boolean)).filter(p => p.length); break;
    default: return g4326;
  }
  if (!c || !c.length) return null;
  return to4326({ type: u.type, coordinates: c });
}
const round = (g, d) => { const f = Math.pow(10, d || 6); return mapCoords(g, (c) => [Math.round(c[0] * f) / f, Math.round(c[1] * f) / f]); };

// Minimal PNG encoder (RGBA8)
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function png(w, h, rgba) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// Web Mercator
const R_M = 6378137;
const merc = (lon, lat) => [R_M * lon * Math.PI / 180, R_M * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
const imerc = (x, y) => [x / R_M * 180 / Math.PI, (2 * Math.atan(Math.exp(y / R_M)) - Math.PI / 2) * 180 / Math.PI];

function writeJSON(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); const s = JSON.stringify(obj); fs.writeFileSync(file, s); return s.length; }
module.exports = { ROOT, PJ, sql, gpkgGeom, mapCoords, to4326, to25830, bbox, dp, simplify, round, png, merc, imerc, writeJSON };
