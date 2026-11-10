// 5.26: GA.pdf.buildStrips — the page is exactly the paper size (A4 here; v10 checks A3), every pixel is 72/dpi pt from the
// top-left (strips stay on the device pixel grid), each later strip is clipped half its overlap (≤ 8 rows)
const path = require('path'); global.window = { GA: {} }; require(path.join(__dirname, '..', 'js', 'pdf.js'));
const jpg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]); const W = 841.89, H = 595.28;
const b = window.GA.pdf.buildStrips([{ bytes: jpg, w: 3508, h: 66, x: 0, y: 0 }, { bytes: jpg, w: 3508, h: 50, x: 0, y: 50 }], [W, H], 300, { title: 't' }, [3508, 2480]);
b.arrayBuffer().then(a => {
  const s = Buffer.from(a).toString('latin1'); const box = s.match(/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/); const L = s.split('\n').filter(l => / cm \/Im/.test(l));
  const k = 72 / 300; const near = (x, y) => Math.abs(x - y) < 1e-4;
  const m0 = L[0] && L[0].match(/^q ([\d.]+) 0 0 ([\d.]+) 0 ([\d.]+) cm \/Im0 Do Q$/);
  const m1 = L[1] && L[1].match(/^q ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re W n ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im1 Do Q$/);
  const ok = box && +box[1] === W && +box[2] === H && L.length === 2 && m0 && near(+m0[1], 3508 * k) && near(+m0[3], H - 66 * k)
    && m1 && near(+m1[4], (50 - 8) * k) && near(+m1[6], 50 * k) && near(+m1[8], H - 100 * k);
  console.log(ok ? 'ok   pdf strips: page = paper size exactly, pixels 72/dpi from the top, second strip clipped 8 of its 16 overlapping rows' : 'FAIL pdf strips ' + JSON.stringify({ box, L }));
  process.exit(ok ? 0 : 1);
});
