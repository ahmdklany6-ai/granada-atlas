/* GIF89a encoder (5.26) — animated GIF of canvas frames, no library. Each frame gets its own 256-colour table built from
   the frame's own pixels (popularity on 15-bit RGB, then nearest colour), LZW-compressed. The maps use flat palette
   colours, so 255 colours reproduce them closely; photographs would band. GA.gif.encode([{ canvas, delay(ms) }]) → Uint8Array */
(function (root) {
  function palette(px) {
    const cnt = new Uint32Array(32768); for (let i = 0; i < px.length; i += 4) cnt[((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3)]++;
    const bins = []; for (let b = 0; b < 32768; b++) if (cnt[b]) bins.push(b); bins.sort((a, b) => cnt[b] - cnt[a]);
    const keep = bins.slice(0, 256); const pal = keep.map(b => [((b >> 10) & 31) * 8 + 4, ((b >> 5) & 31) * 8 + 4, (b & 31) * 8 + 4]);
    while (pal.length < 256) pal.push([0, 0, 0]);
    const map = new Uint8Array(32768); const idx = new Map(keep.map((b, i) => [b, i]));
    for (const b of bins) { if (idx.has(b)) { map[b] = idx.get(b); continue; } const r = ((b >> 10) & 31) * 8 + 4, g = ((b >> 5) & 31) * 8 + 4, bl = (b & 31) * 8 + 4; let best = 0, bd = 1e9;
      for (let i = 0; i < keep.length; i++) { const p = pal[i]; const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - bl) ** 2; if (d < bd) { bd = d; best = i; } } map[b] = best; }
    return { pal, map };
  }
  function lzw(indices, out) { // minimum code size 8
    const MIN = 8, CLEAR = 256, EOI = 257; let size = MIN + 1, next = EOI + 1; let dict = new Map(); let cur = 0, nbits = 0; const sub = []; const flushByte = (b) => { sub.push(b); if (sub.length === 255) { out.push(255, ...sub); sub.length = 0; } };
    const emit = (code) => { cur |= code << nbits; nbits += size; while (nbits >= 8) { flushByte(cur & 255); cur >>>= 8; nbits -= 8; } };
    out.push(MIN); emit(CLEAR); let w = indices[0];
    for (let i = 1; i < indices.length; i++) { const k = indices[i]; const key = w * 256 + k; const v = dict.get(key);
      if (v !== undefined) { w = v; continue; } emit(w); if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; } else { emit(CLEAR); dict = new Map(); size = MIN + 1; next = EOI + 1; } w = k; }
    emit(w); emit(EOI); if (nbits > 0) flushByte(cur & 255); if (sub.length) out.push(sub.length, ...sub); out.push(0);
  }
  function encode(frames) {
    const W = frames[0].canvas.width, H = frames[0].canvas.height; const out = [];
    const str = (s) => { for (const c of s) out.push(c.charCodeAt(0)); }; const u16 = (v) => out.push(v & 255, (v >> 8) & 255);
    str('GIF89a'); u16(W); u16(H); out.push(0x00, 0, 0); // no global colour table
    out.push(0x21, 0xFF, 11); str('NETSCAPE2.0'); out.push(3, 1, 0, 0, 0); // loop forever
    for (const f of frames) {
      const px = f.canvas.getContext('2d').getImageData(0, 0, W, H).data; const { pal, map } = palette(px);
      const ind = new Uint8Array(W * H); for (let i = 0, j = 0; i < px.length; i += 4, j++) ind[j] = map[((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3)];
      out.push(0x21, 0xF9, 4, 0x04); u16(Math.round((f.delay || 1000) / 10)); out.push(0, 0); // graphic control: keep frame, delay
      out.push(0x2C); u16(0); u16(0); u16(W); u16(H); out.push(0x87); // local colour table, 256 entries
      pal.forEach(p => out.push(p[0], p[1], p[2])); lzw(ind, out);
    }
    out.push(0x3B); return new Uint8Array(out);
  }
  // 5.28: the same file, built frame by frame with a pause between frames so the page stays responsive and can show progress
  async function encodeAsync(frames, onFrame) {
    const W = frames[0].canvas.width, H = frames[0].canvas.height; const parts = []; let out = [];
    const str = (s) => { for (const c of s) out.push(c.charCodeAt(0)); }; const u16 = (v) => out.push(v & 255, (v >> 8) & 255);
    str('GIF89a'); u16(W); u16(H); out.push(0x00, 0, 0); out.push(0x21, 0xFF, 11); str('NETSCAPE2.0'); out.push(3, 1, 0, 0, 0); parts.push(new Uint8Array(out));
    for (let n = 0; n < frames.length; n++) { await new Promise(r => setTimeout(r, 0)); const f = frames[n]; out = [];
      const px = f.canvas.getContext('2d').getImageData(0, 0, W, H).data; const { pal, map } = palette(px);
      const ind = new Uint8Array(W * H); for (let i = 0, j = 0; i < px.length; i += 4, j++) ind[j] = map[((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3)];
      out.push(0x21, 0xF9, 4, 0x04); u16(Math.round((f.delay || 1000) / 10)); out.push(0, 0); out.push(0x2C); u16(0); u16(0); u16(W); u16(H); out.push(0x87);
      pal.forEach(p => out.push(p[0], p[1], p[2])); lzw(ind, out); parts.push(new Uint8Array(out)); if (onFrame) onFrame(n + 1, frames.length); }
    parts.push(new Uint8Array([0x3B])); const len = parts.reduce((a, b) => a + b.length, 0); const res = new Uint8Array(len); let o = 0; parts.forEach(b => { res.set(b, o); o += b.length; }); return res;
  }
  root.GA.gif = { encode, encodeAsync };
})(window);
