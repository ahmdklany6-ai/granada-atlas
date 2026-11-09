// 5.26: GA.pdf.buildStrips — page = pixels × 72/dpi, strips on the pixel grid, each later strip clipped half its overlap (≤ 8 rows)
const path = require('path'); global.window = { GA: {} }; require(path.join(__dirname, '..', 'js', 'pdf.js'));
const jpg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]);
const b = window.GA.pdf.buildStrips([{ bytes: jpg, w: 100, h: 66, x: 0, y: 0 }, { bytes: jpg, w: 100, h: 50, x: 0, y: 50 }], [841.89, 595.28], 300, { title: 't' }, [100, 100]);
b.arrayBuffer().then(a => {
  const s = Buffer.from(a).toString('latin1'); const box = s.match(/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/); const L = s.split('\n').filter(l => / cm \/Im/.test(l));
  const k = 72 / 300; const near = (x, y) => Math.abs(x - y) < 1e-4;
  const m1 = L[1] && L[1].match(/^q ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re W n ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im1 Do Q$/);
  const ok = box && near(+box[1], 100 * k) && near(+box[2], 100 * k) && L.length === 2 && /^q [\d.]+ 0 0 [\d.]+ 0 [\d.]+ cm \/Im0 Do Q$/.test(L[0]) && m1 && near(+m1[4], (50 - 8) * k) && near(+m1[6], 50 * k);
  console.log(ok ? 'ok   pdf strips: page = px × 72/dpi, second strip clipped 8 of its 16 overlapping rows' : 'FAIL pdf strips ' + JSON.stringify({ box, L }));
  process.exit(ok ? 0 : 1);
});
