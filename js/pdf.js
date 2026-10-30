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
  root.GA.pdf = { build, PAPER };
})(window);
