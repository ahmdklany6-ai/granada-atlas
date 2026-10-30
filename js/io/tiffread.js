/* GeoTIFF reader for the browser and Node. Supports strips and tiles; no compression,
   LZW (5), Deflate (8, 32946), PackBits (32773); horizontal (2) and floating-point (3)
   predictors; 8/16/32-bit integer and 32/64-bit float samples, multiple samples per pixel
   (band 1 is returned as data; a trailing alpha band is returned as mask). Georeferencing
   from ModelPixelScale + ModelTiepoint (or ModelTransformation without rotation) and GeoKeys.
   BigTIFF and JPEG compression are rejected with a clear message. */
(function (root) {
  const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };

  function lzwDecode(input, expected) {
    const out = new Uint8Array(expected || input.length * 4); let op = 0;
    const dictPrefix = new Int32Array(4096), dictChar = new Uint8Array(4096), dictLen = new Int32Array(4096);
    for (let i = 0; i < 256; i++) { dictPrefix[i] = -1; dictChar[i] = i; dictLen[i] = 1; }
    let next = 258, width = 9, bitPos = 0, prev = -1; const totalBits = input.length * 8;
    const read = () => { // MSB-first codes
      if (bitPos + width > totalBits) return 257;
      let v = 0; for (let i = 0; i < width; i++) { const b = bitPos + i; v = (v << 1) | ((input[b >> 3] >> (7 - (b & 7))) & 1); }
      bitPos += width; return v;
    };
    const emit = (code) => {
      const len = dictLen[code]; if (op + len > out.length) return false;
      let c = code; for (let i = len - 1; i >= 0; i--) { out[op + i] = dictChar[c]; c = dictPrefix[c]; }
      op += len; return true;
    };
    const first = (code) => { let c = code; while (dictPrefix[c] !== -1) c = dictPrefix[c]; return dictChar[c]; };
    for (;;) {
      const code = read();
      if (code === 257) break;
      if (code === 256) { next = 258; width = 9; prev = -1; continue; }
      if (prev === -1) { if (!emit(code)) break; prev = code; continue; }
      if (code < next) {
        if (!emit(code)) break;
        if (next < 4096) { dictPrefix[next] = prev; dictChar[next] = first(code); dictLen[next] = dictLen[prev] + 1; next++; }
      } else {
        if (next < 4096) { dictPrefix[next] = prev; dictChar[next] = first(prev); dictLen[next] = dictLen[prev] + 1; next++; }
        if (!emit(code)) break;
      }
      prev = code;
      if (next + 1 >= (1 << width) && width < 12) width++; // TIFF "early change"
    }
    return op === out.length ? out : out.subarray(0, op);
  }
  function packbits(input, expected) {
    const out = new Uint8Array(expected); let i = 0, o = 0;
    while (i < input.length && o < expected) {
      const n = (input[i] << 24) >> 24; i++;
      if (n >= 0) { for (let k = 0; k <= n; k++) out[o++] = input[i++]; }
      else if (n !== -128) { const v = input[i++]; for (let k = 0; k < 1 - n; k++) out[o++] = v; }
    }
    return out;
  }
  async function inflate(bytes) {
    if (typeof DecompressionStream !== 'undefined') {
      const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      return new Uint8Array(await new Response(s).arrayBuffer());
    }
    return new Uint8Array(require('zlib').inflateSync(Buffer.from(bytes)));
  }

  function parseIFD(dv, le, off) {
    const n = dv.getUint16(off, le); const tags = {};
    for (let i = 0; i < n; i++) {
      const p = off + 2 + i * 12; const tag = dv.getUint16(p, le), type = dv.getUint16(p + 2, le), count = dv.getUint32(p + 4, le);
      const size = (TYPE_SIZE[type] || 1) * count; const vo = size <= 4 ? p + 8 : dv.getUint32(p + 8, le);
      const vals = [];
      if (type === 2) { let s = ''; for (let k = 0; k < count; k++) { const c = dv.getUint8(vo + k); if (c) s += String.fromCharCode(c); } tags[tag] = s; continue; }
      for (let k = 0; k < count; k++) {
        const q = vo + k * (TYPE_SIZE[type] || 1);
        vals.push(type === 3 ? dv.getUint16(q, le) : type === 4 ? dv.getUint32(q, le) : type === 8 ? dv.getInt16(q, le) : type === 9 ? dv.getInt32(q, le)
          : type === 11 ? dv.getFloat32(q, le) : type === 12 ? dv.getFloat64(q, le) : type === 16 ? Number(dv.getBigUint64(q, le)) : type === 6 ? dv.getInt8(q) : dv.getUint8(q));
      }
      tags[tag] = vals;
    }
    return { tags, next: dv.getUint32(off + 2 + n * 12, le) };
  }

  async function read(buffer) {
    const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const bo = String.fromCharCode(u8[0], u8[1]); if (bo !== 'II' && bo !== 'MM') throw new Error('Not a TIFF file');
    const le = bo === 'II'; const magic = dv.getUint16(2, le);
    if (magic === 43) throw new Error('BigTIFF is not supported — save as a standard GeoTIFF');
    if (magic !== 42) throw new Error('Not a TIFF file');
    const { tags: T } = parseIFD(dv, le, dv.getUint32(4, le));
    const W = T[256][0], H = T[257][0], bits = T[258] || [1], spp = (T[277] || [1])[0], comp = (T[259] || [1])[0];
    const fmt = (T[339] || [1])[0], pred = (T[317] || [1])[0], planar = (T[284] || [1])[0];
    if (comp === 7 || comp === 6) throw new Error('JPEG-compressed GeoTIFF is not supported');
    if (planar !== 1) throw new Error('Separate-plane GeoTIFF is not supported');
    const bps = bits[0] / 8; if (bits.some(b => b !== bits[0])) throw new Error('Mixed sample sizes are not supported');
    const tiled = !!T[322];
    const tw = tiled ? T[322][0] : W, th = tiled ? T[323][0] : (T[278] || [H])[0];
    const offsets = tiled ? T[324] : T[273], counts = tiled ? T[325] : T[279];
    const across = Math.ceil(W / tw), down = Math.ceil(H / th);
    const band = new Float64Array(W * H), alpha = spp > 1 ? new Uint8Array(W * H).fill(255) : null;
    const pxBytes = bps * spp;
    for (let b = 0; b < offsets.length; b++) {
      const raw = u8.subarray(offsets[b], offsets[b] + counts[b]);
      const bw = tw, bh = tiled ? th : Math.min(th, H - Math.floor(b) * th);
      const expected = bw * bh * pxBytes;
      let dec = comp === 1 ? raw : comp === 5 ? lzwDecode(raw, expected) : (comp === 8 || comp === 32946) ? await inflate(raw) : comp === 32773 ? packbits(raw, expected) : null;
      if (!dec) throw new Error('Unsupported TIFF compression ' + comp);
      dec = new Uint8Array(dec); // own copy for predictor edits
      if (pred === 2) { // horizontal differencing per sample (integers)
        const dvd = new DataView(dec.buffer);
        for (let r = 0; r < bh; r++) for (let c = 1; c < bw; c++) for (let s = 0; s < spp; s++) {
          const i = (r * bw + c) * spp + s, j = i - spp;
          if (bps === 1) dec[i] = (dec[i] + dec[j]) & 255;
          else if (bps === 2) dvd.setUint16(i * 2, (dvd.getUint16(i * 2, le) + dvd.getUint16(j * 2, le)) & 65535, le);
          else if (bps === 4) dvd.setUint32(i * 4, (dvd.getUint32(i * 4, le) + dvd.getUint32(j * 4, le)) >>> 0, le);
        }
      } else if (pred === 3) { // floating-point predictor: byte-wise differencing then de-interleave
        const rowBytes = bw * spp * bps; const tmp = new Uint8Array(rowBytes);
        for (let r = 0; r < bh; r++) {
          const o = r * rowBytes; for (let k = spp * 1; k < rowBytes; k++) dec[o + k] = (dec[o + k] + dec[o + k - spp]) & 255;
          const n = bw * spp; for (let k = 0; k < n; k++) for (let by = 0; by < bps; by++) tmp[k * bps + (le ? bps - 1 - by : by)] = dec[o + by * n + k];
          dec.set(tmp, o);
        }
      }
      const ddv = new DataView(dec.buffer, dec.byteOffset, dec.byteLength);
      const x0 = tiled ? (b % across) * tw : 0, y0 = tiled ? Math.floor(b / across) * th : b * th;
      const get = (i) => fmt === 3 ? (bps === 4 ? ddv.getFloat32(i, le) : ddv.getFloat64(i, le))
        : fmt === 2 ? (bps === 1 ? ddv.getInt8(i) : bps === 2 ? ddv.getInt16(i, le) : ddv.getInt32(i, le))
          : (bps === 1 ? ddv.getUint8(i) : bps === 2 ? ddv.getUint16(i, le) : ddv.getUint32(i, le));
      for (let r = 0; r < bh; r++) { const y = y0 + r; if (y >= H) break;
        for (let c = 0; c < bw; c++) { const x = x0 + c; if (x >= W) continue;
          const p = (r * bw + c) * pxBytes; if (p + pxBytes > dec.length) continue;
          band[y * W + x] = get(p);
          if (alpha) alpha[y * W + x] = Math.max(0, Math.min(255, get(p + (spp - 1) * bps)));
        } }
    }
    // georeferencing
    const scale = T[33550], tie = T[33922], mt = T[34264];
    let ox, oy, px, py;
    if (scale && tie) { px = scale[0]; py = scale[1]; ox = tie[3] - tie[0] * px; oy = tie[4] + tie[1] * py; }
    else if (mt) { if (mt[1] || mt[4]) throw new Error('Rotated GeoTIFF is not supported'); px = mt[0]; py = -mt[5]; ox = mt[3]; oy = mt[7]; }
    const gk = T[34735]; const keys = {};
    if (gk) for (let i = 0; i < gk[3]; i++) { const k = gk[4 + i * 4], loc = gk[5 + i * 4], cnt = gk[6 + i * 4], v = gk[7 + i * 4]; keys[k] = loc === 0 ? v : (loc === 34737 ? (T[34737] || '').slice(v, v + cnt) : (T[loc] || [])[v]); }
    const epsg = keys[3072] || keys[2048] || null;
    let nodata = T[42113] != null ? parseFloat(T[42113]) : null; if (!isFinite(nodata)) nodata = null;
    const valid = new Uint8Array(W * H); let min = Infinity, max = -Infinity, nValid = 0;
    for (let i = 0; i < W * H; i++) {
      const v = band[i]; const ok = isFinite(v) && (nodata == null || v !== nodata) && (!alpha || alpha[i] > 0);
      valid[i] = ok ? 1 : 0; if (ok) { nValid++; if (v < min) min = v; if (v > max) max = v; }
    }
    return { width: W, height: H, data: band, valid, alpha, nodata, epsg, geographic: !!keys[2048] && !keys[3072], pixelIsPoint: keys[1025] === 2,
      ox, oy, px, py, bits: bits[0], sampleFormat: fmt, samples: spp, compression: comp, predictor: pred, tiled, min, max, nValid, gdalMetadata: T[42112] || null };
  }
  // Bilinear sample in raster CRS coordinates; returns null when any neighbour is invalid.
  function sample(r, x, y) {
    const fx = (x - r.ox) / r.px - 0.5, fy = (r.oy - y) / r.py - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i + 1 >= r.width || j + 1 >= r.height) return null;
    const a = fx - i, b = fy - j, k = j * r.width + i, W = r.width;
    if (!r.valid[k] || !r.valid[k + 1] || !r.valid[k + W] || !r.valid[k + W + 1]) {
      const n = Math.round(fy) * W + Math.round(fx); return r.valid[n] ? r.data[n] : null; // nearest valid fallback at edges
    }
    return r.data[k] * (1 - a) * (1 - b) + r.data[k + 1] * a * (1 - b) + r.data[k + W] * (1 - a) * b + r.data[k + W + 1] * a * b;
  }
  const api = { read, sample, lzwDecode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GA = root.GA || {}; root.GA.tiffread = api; }
})(typeof window !== 'undefined' ? window : globalThis);
