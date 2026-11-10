// 5.26: GA.gif.encode — frames decoded by an independent decoder (Pillow) must equal the input pixels (flat colours)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
global.window = { GA: {} }; require(path.join(__dirname, '..', 'js', 'gif.js'));
const W = +(process.env.GW || 600), H = +(process.env.GH || 400); const cols = [[153, 43, 42], [242, 238, 230], [70, 96, 120], [120, 128, 60], [41, 16, 12], [255, 255, 255], [200, 180, 140]];
function frame(seed) { const px = new Uint8ClampedArray(W * H * 4); let s = seed; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const c = cols[((x >> 3) + (y >> 2) + (s % 3 === 0 ? 1 : 0) + seed) % cols.length]; const o = (y * W + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; }
  return { canvas: { width: W, height: H, getContext: () => ({ getImageData: () => ({ data: px }) }) }, delay: 500, px }; }
const frames = [frame(1), frame(2), frame(3)]; const bytes = window.GA.gif.encode(frames);
const tmp = path.join(require('os').tmpdir(), 'ga_gif_test.gif'); fs.writeFileSync(tmp, bytes);
const py = `
from PIL import Image, ImageSequence; import sys, json
im = Image.open(sys.argv[1]); out = []
for f in ImageSequence.Iterator(im): out.append(list(f.convert('RGB').getdata()))
print(json.dumps({'n': len(out), 'size': im.size, 'loop': im.info.get('loop'), 'dur': im.info.get('duration'), 'px': out}))`;
const r = JSON.parse(execFileSync('python3', ['-c', py, tmp], { maxBuffer: 1 << 28 }).toString());
let ok = r.n === 3 && r.size[0] === W && r.size[1] === H && r.loop === 0, worst = 0;
frames.forEach((f, i) => { for (let j = 0; j < W * H; j++) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(r.px[i][j][c] - f.px[j * 4 + c])); });
ok = ok && worst <= 4; // 15-bit colour bins: at most 4 levels off (flat palette colours)
console.log(ok ? 'ok   gif: 3 frames, size, loop, pixels within ' + worst + ' levels' : 'FAIL gif ' + JSON.stringify({ n: r.n, size: r.size, loop: r.loop, worst }));
process.exit(ok ? 0 : 1);
