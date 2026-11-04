// 5.19 streaming PNG writer: rows added in uneven strips decode to exactly the source pixels (independent zlib decoder),
// chunk CRCs are valid, and a wrong row count is refused.
const zlib = require('zlib'); const assert = require('assert');
require('../js/pngstream.js'); const PS = globalThis.GA.pngStream;
const W = 301, H = 203; const px = (x, y) => [(x * 7 + y) & 255, (y * 3) & 255, (x ^ y) & 255];
// fake canvas: holds rows [y0, y0 + h) of the image
const canvas = (y0, h) => ({ getContext: () => ({ getImageData: (x, y, w, n) => { const d = new Uint8ClampedArray(w * n * 4); for (let r = 0; r < n; r++) for (let c = 0; c < w; c++) { const [R, G, B] = px(c, y0 + y + r); d.set([R, G, B, 255], (r * w + c) * 4); } return { data: d }; } }) });
(async () => {
  let n = 0; const ok = (c, m) => { assert(c, m); n++; };
  const enc = PS.create(W, H); for (let y = 0; y < H; y += 77) { const h = Math.min(77, H - y); await enc.add(canvas(y, h), h); }
  const buf = Buffer.from(await (await enc.end()).arrayBuffer());
  ok(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'PNG signature');
  let o = 8, idat = [], ihdr = null, crcOk = true;
  while (o < buf.length) { const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    const crc = buf.readUInt32BE(o + 8 + len); if ((PS.crc(buf.subarray(o + 4, o + 8 + len)) ^ 0xFFFFFFFF) >>> 0 !== crc) crcOk = false;
    if (type === 'IHDR') ihdr = data; if (type === 'IDAT') idat.push(data); o += 12 + len; }
  ok(crcOk, 'every chunk CRC valid'); ok(ihdr.readUInt32BE(0) === W && ihdr.readUInt32BE(4) === H && ihdr[8] === 8 && ihdr[9] === 2, 'IHDR: size, 8-bit RGB');
  const raw = zlib.inflateSync(Buffer.concat(idat)); ok(raw.length === H * (1 + 3 * W), 'decoded size = rows × (filter + RGB)');
  let same = true; for (let y = 0; y < H && same; y++) { if (raw[y * (1 + 3 * W)] !== 0) same = false; for (let x = 0; x < W; x++) { const p = px(x, y), q = y * (1 + 3 * W) + 1 + x * 3; if (raw[q] !== p[0] || raw[q + 1] !== p[1] || raw[q + 2] !== p[2]) { same = false; break; } } }
  ok(same, 'every pixel equals the source across strip boundaries');
  const bad = PS.create(10, 10); await bad.add(canvas(0, 4), 4); let threw = false; try { await bad.end(); } catch (e) { threw = /rows/.test(e.message); } ok(threw, 'incomplete image refused');
  console.log(`pngstream.test.js: ${n} checks passed`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
