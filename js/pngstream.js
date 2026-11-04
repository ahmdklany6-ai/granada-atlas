/* Streaming PNG writer (5.19): rows are added strip by strip and compressed as they arrive (zlib via the browser's
   CompressionStream), so a page of hundreds of megapixels never needs one canvas or one raw buffer. RGB, 8 bit, filter 0.
   Output: a Blob made of the PNG chunks. Throws when the browser has no CompressionStream (the caller says PDF is needed). */
(function (root) {
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc(bytes, c) { c = c == null ? 0xFFFFFFFF : c; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return c; }
  function chunk(type, data) {
    const out = new Uint8Array(12 + data.length); const dv = new DataView(out.buffer); dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i); out.set(data, 8);
    dv.setUint32(8 + data.length, (crc(out.subarray(4, 8 + data.length)) ^ 0xFFFFFFFF) >>> 0); return out;
  }
  const supported = () => typeof CompressionStream === 'function';
  function create(W, H) {
    if (!supported()) throw new Error('CompressionStream unavailable');
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
    const ih = new Uint8Array(13); const dv = new DataView(ih.buffer); dv.setUint32(0, W); dv.setUint32(4, H); ih[8] = 8; ih[9] = 2; // 8-bit RGB
    parts.push(chunk('IHDR', ih));
    const cs = new CompressionStream('deflate'); const w = cs.writable.getWriter(); const rd = cs.readable.getReader();
    const pump = (async () => { for (;;) { const { value, done } = await rd.read(); if (done) break; if (value && value.length) parts.push(chunk('IDAT', value)); } })();
    let rows = 0;
    return {
      // add `h` rows of a canvas (from its row 0), read 128 rows at a time
      async add(cv, h) {
        const g = cv.getContext('2d', { willReadFrequently: true });
        for (let y0 = 0; y0 < h; y0 += 128) {
          const n = Math.min(128, h - y0); const px = g.getImageData(0, y0, W, n).data; const out = new Uint8Array(n * (1 + 3 * W));
          for (let r = 0, o = 0, s = 0; r < n; r++) { out[o++] = 0; for (let x = 0; x < W; x++, s += 4) { out[o++] = px[s]; out[o++] = px[s + 1]; out[o++] = px[s + 2]; } }
          await w.ready; await w.write(out);
        }
        rows += h;
      },
      async end() { if (rows !== H) throw new Error(`PNG: ${rows} rows written for a ${H}-row image`); await w.close(); await pump; parts.push(chunk('IEND', new Uint8Array(0))); return new Blob(parts, { type: 'image/png' }); },
      abort() { try { w.abort(); } catch (e) { } },
    };
  }
  root.GA = root.GA || {}; root.GA.pngStream = { create, supported, crc };
})(typeof window !== 'undefined' ? window : globalThis);
