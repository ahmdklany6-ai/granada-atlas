/* Minimal PDF writer: each page is one full-page JPEG (DCTDecode) at a stated paper size.
   Used for printable Exercise 1.2 sheets and the combined PDF. Page sizes are in points
   (1 pt = 1/72 inch), so a sheet rendered at a known pixel density prints at true scale. */
(function (root) {
  const PAPER = { A3L: [1190.55, 841.89], A4L: [841.89, 595.28], A4P: [595.28, 841.89] };
  function dataURLBytes(u) { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  // pages: [{ canvas, paper:'A3L', title }]
  function build(pages, meta) {
    const enc = new TextEncoder(); const chunks = []; let len = 0; const offsets = [];
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body.forEach(push); push('\nendobj\n'); };
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'.replace(/[^\x00-\x7F]/g, 'x'));
    const n = pages.length; const kids = []; // objects: 1 catalog, 2 pages, 3 info, then per page: page, content, image
    pages.forEach((p, i) => kids.push(`${4 + i * 3} 0 R`));
    obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    obj(2, [`<< /Type /Pages /Count ${n} /Kids [${kids.join(' ')}] >>`]);
    const esc = (s) => String(s || '').replace(/[^\x20-\x7E]/g, '?').replace(/([()\\])/g, '\\$1');
    obj(3, [`<< /Producer (Granada Atlas) /Title (${esc(meta && meta.title)}) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`]);
    pages.forEach((p, i) => {
      const [W, H] = Array.isArray(p.paper) ? p.paper : PAPER[p.paper || 'A3L']; const base = 4 + i * 3;
      const jpg = dataURLBytes(p.canvas.toDataURL('image/jpeg', p.quality || 0.9));
      const content = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q`;
      obj(base, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /XObject << /Im0 ${base + 2} 0 R >> >> /Contents ${base + 1} 0 R >>`]);
      obj(base + 1, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
      obj(base + 2, [`<< /Type /XObject /Subtype /Image /Width ${p.canvas.width} /Height ${p.canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, '\nendstream']);
    });
    const xref = len; const total = 4 + n * 3;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`; for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(x); push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(len); let o = 0; chunks.forEach(c => { out.set(c, o); o += c.length; }); return out;
  }

  // ---------- vector pages ----------
  // A painter with the same interface as the section's canvas/SVG painters. Shapes become PDF paths; text in the PDF
  // standard fonts (Helvetica, WinAnsi) when it is Latin; other scripts (Arabic, Hebrew, symbols) are rendered by the
  // browser's text engine into small transparent images so shaping and direction stay correct.
  const WIN = { 0x2013: 0x96, 0x2014: 0x97, 0x2022: 0x95, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2026: 0x85 };
  const latin = (s) => [...s].every(ch => { const c = ch.codePointAt(0); return (c >= 0x20 && c < 0x7F) || (c >= 0xA0 && c <= 0xFF) || WIN[c]; });
  const hexWin = (s) => '<' + [...s].map(ch => { const c = ch.codePointAt(0); return (WIN[c] || c).toString(16).padStart(2, '0'); }).join('') + '>';
  async function deflate(bytes) { const cs = new CompressionStream('deflate'); const w = cs.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
  function vectorPainter(W, H, uiFont) {
    const ops = []; const imgs = []; const gs = new Map(); const meas = document.createElement('canvas').getContext('2d');
    const n = (v) => (Math.round(v * 100) / 100).toString();
    const rgb = (c) => { if (!c || c === 'none') return null; const m = /^#([0-9a-f]{6})$/i.exec(c); if (m) { const h = m[1]; return [0, 2, 4].map(i => n(parseInt(h.slice(i, i + 2), 16) / 255)).join(' '); } const r = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return r ? [r[1], r[2], r[3]].map(v => n(+v / 255)).join(' ') : '0 0 0'; };
    const alphaOf = (o) => { let a = o.alpha == null ? 1 : o.alpha; const r = /rgba\([^)]*,\s*([\d.]+)\)/.exec(o.fill || ''); if (r) a *= +r[1]; return a; };
    const gsName = (a) => { const k = Math.round(a * 100) / 100; if (k >= 1) return null; if (!gs.has(k)) gs.set(k, 'G' + gs.size); return gs.get(k); };
    const style = (o) => { const out = ['q']; const g = gsName(alphaOf(o)); if (g) out.push(`/${g} gs`); const f = rgb(o.fill), s = rgb(o.stroke); if (f) out.push(f + ' rg'); if (s) out.push(s + ' RG', n(o.lw || 1) + ' w', (o.dash ? `[${o.dash.map(n).join(' ')}] 0 d` : '[] 0 d'), '1 j', (o.cap === 'round' ? '1' : '0') + ' J'); ops.push(out.join(' ')); return { f, s }; };
    const paintOp = (o, fs) => (fs.f && fs.s ? (o.evenodd ? 'B*' : 'B') : fs.f ? (o.evenodd ? 'f*' : 'f') : fs.s ? 'S' : 'n') + ' Q';
    const fontCss = (o) => `${o.weight || 400} ${o.size || 11}px ${uiFont}`;
    return {
      W, H, measure: (s, f) => { meas.font = f.replace(/px .*/, 'px Helvetica, Arial, sans-serif'); return meas.measureText(s).width; },
      rect(x, y, w, h, o) { const fs = style(o); ops.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re ` + paintOp(o, fs)); },
      path(pts, o) { if (!pts.length) return; const fs = style(o); ops.push(pts.map((p, i) => `${n(p[0])} ${n(p[1])} ${i ? 'l' : 'm'}`).join(' ') + (o.close ? ' h ' : ' ') + paintOp(o, fs)); },
      rings(rs, o) { const fs = style(o); ops.push(rs.map(r => r.map((p, i) => `${n(p[0])} ${n(p[1])} ${i ? 'l' : 'm'}`).join(' ') + ' h').join(' ') + ' ' + paintOp(o, fs)); },
      circle(x, y, r, o) { const fs = style(o); const k = 0.5523 * r; ops.push(`${n(x + r)} ${n(y)} m ${n(x + r)} ${n(y + k)} ${n(x + k)} ${n(y + r)} ${n(x)} ${n(y + r)} c ${n(x - k)} ${n(y + r)} ${n(x - r)} ${n(y + k)} ${n(x - r)} ${n(y)} c ${n(x - r)} ${n(y - k)} ${n(x - k)} ${n(y - r)} ${n(x)} ${n(y - r)} c ${n(x + k)} ${n(y - r)} ${n(x + r)} ${n(y - k)} ${n(x + r)} ${n(y)} c h ` + paintOp(o, fs)); },
      text(s, x, y, o) {
        s = String(s); if (!s) return; const size = o.size || 11; const al = o.align || 'left'; const bl = o.baseline || 'alphabetic';
        const yb = bl === 'middle' ? y + size * 0.35 : bl === 'top' ? y + size * 0.8 : y;
        if (latin(s) && o.dir !== 'rtl') { const w = this.measure(s, fontCss(o)); const xa = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w : x; const F = (o.weight || 400) >= 600 ? 'F2' : 'F1';
          if (o.halo) ops.push(`q ${rgb(o.halo)} RG ${n(o.haloW || 3)} w 1 j BT /${F} ${n(size)} Tf 1 Tr 1 0 0 -1 ${n(xa)} ${n(yb)} Tm ${hexWin(s)} Tj ET Q`);
          ops.push(`q ${rgb(o.color || GA.palette.ink)} rg BT /${F} ${n(size)} Tf 1 0 0 -1 ${n(xa)} ${n(yb)} Tm ${hexWin(s)} Tj ET Q`); return; }
        // non-Latin: browser-shaped text as a transparent image, 4× resolution
        const S = 4; meas.font = fontCss(o); meas.direction = o.dir === 'rtl' ? 'rtl' : 'ltr'; const w = Math.ceil(meas.measureText(s).width) + 8, h = Math.ceil(size * 1.5);
        const c = document.createElement('canvas'); c.width = w * S; c.height = h * S; const g = c.getContext('2d'); g.scale(S, S); g.font = fontCss(o); g.direction = o.dir === 'rtl' ? 'rtl' : (o.dir === 'auto' ? 'inherit' : 'ltr'); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        const tx = o.dir === 'rtl' ? w - 4 : 4; if (o.dir === 'rtl') g.textAlign = 'right';
        if (o.halo) { g.strokeStyle = o.halo; g.lineWidth = o.haloW || 3; g.lineJoin = 'round'; g.strokeText(s, tx, size * 1.1); } g.fillStyle = o.color || GA.palette.ink; g.fillText(s, tx, size * 1.1);
        const xa = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w + 4 : x - 4; const ytop = yb - size * 1.1;
        const id = 'I' + imgs.length; imgs.push({ id, canvas: c }); ops.push(`q ${n(w)} 0 0 ${n(-h)} ${n(xa)} ${n(ytop + h)} cm /${id} Do Q`);
      },
      clip(x, y, w, h) { ops.push(`q ${n(x)} ${n(y)} ${n(w)} ${n(h)} re W n`); }, unclip() { ops.push('Q'); },
      async bytes(meta) {
        const [PW, PH0] = PAPER[meta.paper || 'A3L']; const k = PW / W; const PH = H * k;
        const content = `q ${n(k)} 0 0 ${n(-k)} 0 ${n(PH)} cm\n` + ops.join('\n') + '\nQ';
        const enc = new TextEncoder(); const chunks = []; let len = 0; const offsets = [];
        const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
        const obj = (num, parts) => { offsets[num] = len; push(`${num} 0 obj\n`); parts.forEach(push); push('\nendobj\n'); };
        push('%PDF-1.4\n%Granada Atlas vector\n');
        const esc = (s) => String(s || '').replace(/[^\x20-\x7E]/g, '?').replace(/([()\\])/g, '\\$1');
        // 1 catalog, 2 pages, 3 info, 4 page, 5 content, 6 F1, 7 F2, then extgstates, then images (+smask)
        let nextN = 8; const gsObj = {}; gs.forEach((name, a) => { gsObj[name] = nextN++; });
        const imgObj = {}; imgs.forEach(im => { imgObj[im.id] = [nextN++, nextN++]; });
        obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']); obj(2, ['<< /Type /Pages /Count 1 /Kids [4 0 R] >>']);
        obj(3, [`<< /Producer (Granada Atlas) /Title (${esc(meta.title)}) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`]);
        const res = `/Font << /F1 6 0 R /F2 7 0 R >> /ExtGState << ${[...gs.entries()].map(([a, name]) => `/${name} ${gsObj[name]} 0 R`).join(' ')} >> /XObject << ${imgs.map(im => `/${im.id} ${imgObj[im.id][0]} 0 R`).join(' ')} >>`;
        obj(4, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(PW)} ${n(PH)}] /Resources << ${res} >> /Contents 5 0 R >>`]);
        const cz = await deflate(enc.encode(content)); obj(5, [`<< /Length ${cz.length} /Filter /FlateDecode >>\nstream\n`, cz, '\nendstream']);
        obj(6, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']); obj(7, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
        gs.forEach((name, a) => obj(gsObj[name], [`<< /Type /ExtGState /CA ${a} /ca ${a} >>`]));
        for (const im of imgs) { const c = im.canvas; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const px = c.width * c.height; const rgbB = new Uint8Array(px * 3), aB = new Uint8Array(px);
          for (let i = 0; i < px; i++) { const al = d[i * 4 + 3]; aB[i] = al; rgbB[i * 3] = d[i * 4]; rgbB[i * 3 + 1] = d[i * 4 + 1]; rgbB[i * 3 + 2] = d[i * 4 + 2]; }
          const [io, so] = imgObj[im.id]; const zr = await deflate(rgbB), za = await deflate(aB);
          obj(io, [`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${so} 0 R /Length ${zr.length} >>\nstream\n`, zr, '\nendstream']);
          obj(so, [`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${za.length} >>\nstream\n`, za, '\nendstream']); }
        const xref = len; let x = `xref\n0 ${nextN}\n0000000000 65535 f \n`; for (let i = 1; i < nextN; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
        push(x); push(`trailer\n<< /Size ${nextN} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
        const out = new Uint8Array(len); let o2 = 0; chunks.forEach(c => { out.set(c, o2); o2 += c.length; }); return out;
      },
    };
  }
  root.GA.pdf = { build, PAPER, vectorPainter };
})(window);
