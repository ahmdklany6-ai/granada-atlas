/* Minimal GeoTIFF writer: one band, Float32, uncompressed, single strip, little-endian.
   Georeferencing via ModelPixelScale + ModelTiepoint (PixelIsArea) and GeoKeys for either
   EPSG:4326 (geographic) or a projected EPSG code. NoData is written as GDAL_NODATA. */
(function (root) {
  // grid: { width, height, data: Float32Array (row-major, north row first), originX, originY (top-left corner), pixelX, pixelY, epsg, geographic, nodata, metadata: {k:v} }
  function write(grid) {
    const W = grid.width, H = grid.height, nodata = grid.nodata;
    const enc = new TextEncoder();
    const meta = '<GDALMetadata>' + Object.entries(grid.metadata || {}).map(([k, v]) => `<Item name="${xml(k)}">${xml(v)}</Item>`).join('') + '</GDALMetadata>\0';
    const ndStr = String(nodata) + '\0';
    const geoKeys = grid.geographic
      ? [1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, 1, 2048, 0, 1, grid.epsg]
      : [1, 1, 0, 4, 1024, 0, 1, 1, 1025, 0, 1, 1, 3072, 0, 1, grid.epsg, 3076, 0, 1, 9001];
    // entries: [tag, type, count, valueBytes(Uint8Array) | inline number]
    // types: 2 ASCII, 3 SHORT, 4 LONG, 12 DOUBLE
    const pixels = new Uint8Array(grid.data.buffer, grid.data.byteOffset, W * H * 4);
    const dbl = (arr) => { const b = new Uint8Array(arr.length * 8); const dv = new DataView(b.buffer); arr.forEach((v, i) => dv.setFloat64(i * 8, v, true)); return b; };
    const shorts = (arr) => { const b = new Uint8Array(arr.length * 2); const dv = new DataView(b.buffer); arr.forEach((v, i) => dv.setUint16(i * 2, v, true)); return b; };
    const entries = [
      [256, 4, 1, W], [257, 4, 1, H], [258, 3, 1, 32], [259, 3, 1, 1], [262, 3, 1, 1],
      [273, 4, 1, 'PIXELS'], [277, 3, 1, 1], [278, 4, 1, H], [279, 4, 1, W * H * 4], [284, 3, 1, 1], [339, 3, 1, 3],
      [33550, 12, 3, dbl([grid.pixelX, grid.pixelY, 0])],
      [33922, 12, 6, dbl([0, 0, 0, grid.originX, grid.originY, 0])],
      [34735, 3, geoKeys.length, shorts(geoKeys)],
      [42112, 2, enc.encode(meta).length, enc.encode(meta)],
      [42113, 2, enc.encode(ndStr).length, enc.encode(ndStr)],
    ].sort((a, b) => a[0] - b[0]);
    const ifdSize = 2 + entries.length * 12 + 4;
    let off = 8 + ifdSize; const blobs = [];
    entries.forEach(e => { if (e[3] instanceof Uint8Array && e[3].length > 4) { if (off % 2) off++; e.offset = off; blobs.push([off, e[3]]); off += e[3].length; } });
    if (off % 4) off += 4 - (off % 4);
    const pixOff = off; const total = pixOff + pixels.length;
    const out = new Uint8Array(total), dv = new DataView(out.buffer);
    out[0] = 0x49; out[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, 8, true);
    dv.setUint16(8, entries.length, true);
    entries.forEach((e, i) => {
      const p = 10 + i * 12; dv.setUint16(p, e[0], true); dv.setUint16(p + 2, e[1], true); dv.setUint32(p + 4, e[2], true);
      const v = e[3] === 'PIXELS' ? pixOff : e[3];
      if (v instanceof Uint8Array) { if (v.length <= 4) out.set(v, p + 8); else dv.setUint32(p + 8, e.offset, true); }
      else if (e[1] === 3) dv.setUint16(p + 8, v, true); else dv.setUint32(p + 8, v, true);
    });
    dv.setUint32(10 + entries.length * 12, 0, true);
    blobs.forEach(([o, b]) => out.set(b, o));
    if (new Uint8Array(new Uint16Array([1]).buffer)[0] === 1) out.set(pixels, pixOff); // little-endian host (all browsers)
    else { for (let i = 0; i < W * H; i++) dv.setFloat32(pixOff + i * 4, grid.data[i], true); }
    return out;
  }
  const xml = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const api = { write };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GA = root.GA || {}; root.GA.geotiff = api; }
})(typeof window !== 'undefined' ? window : globalThis);
