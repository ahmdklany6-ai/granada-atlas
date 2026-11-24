"""Exercise 2.2 · the alternatives' build-ups together on one board, as one GIF (owner, 24 Nov 2026: "now put the three
together"). Takes the step stills written by fade_gif.py (<prefix>_step_0.jpg, _step_1.jpg ...) of each alternative and lays
each step of all of them on one board:
  stack  one under the other, each at the board's width
  row    side by side, all at the same height
  grid   2 x 2; the free cell holds the title and the note
Every panel carries its label (handwritten, the studio red); a caption says what the pictures are. All panels change step at
the same moment: HOLD s per step (default 0.6), LAST s on the final one (default 2.0). A set with fewer steps holds its last.
Writes <name>.gif, <name>.mp4 (when ffmpeg is there), <name>_final.jpg and <name>_step_k.jpg.
Usage: python3 tools/ex22_pages/together_gif.py <out folder> <name> <stack|row|grid> "<label>=<prefix>" "<label>=<prefix>" ...
env:   W (board width in px; default 1400 stack, 2400 row, 2000 grid), TITLE, CAPTION, HOLD, LAST, LABEL (label size as a share
       of the panel width, default 0.034), HAND_FONT / TEXT_FONT (font files)
Colours from js/palette.js. The images are the owner's and are not committed. Not part of the site or of the tests."""
import os, sys, glob, re, shutil, subprocess, textwrap
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw

P = _bw._P
RED, INK, INK3, WHITE, LINE = P['red'], P['ink'], P['ink3'], P['white'], P['line']
OUT, NAME, LAYOUT = sys.argv[1], sys.argv[2], sys.argv[3]
assert LAYOUT in ('stack', 'row', 'grid'), LAYOUT
SETS = [a.split('=', 1) for a in sys.argv[4:]]
assert len(SETS) >= 2 and all(len(s) == 2 for s in SETS), 'give "<label>=<prefix>" for each alternative'
W = int(os.environ.get('W', {'stack': 1400, 'row': 2400, 'grid': 2000}[LAYOUT]))
HOLD, LAST = float(os.environ.get('HOLD', 0.6)), float(os.environ.get('LAST', 2.0))
TITLE, CAPTION = os.environ.get('TITLE', ''), os.environ.get('CAPTION', '')
LABEL = float(os.environ.get('LABEL', 0.034))
HAND = os.environ.get('HAND_FONT', '/mnt/skills/examples/canvas-design/canvas-fonts/NothingYouCouldDo-Regular.ttf')
TEXT = os.environ.get('TEXT_FONT', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
os.makedirs(OUT, exist_ok=True)


def font(path, px):
    try: return ImageFont.truetype(path, int(px))
    except OSError: return ImageFont.truetype('DejaVuSans.ttf', int(px))


def steps_of(prefix):
    fs = glob.glob(prefix + '_step_*.jpg')
    fs.sort(key=lambda f: int(re.search(r'_step_(\d+)\.jpg$', f).group(1)))
    assert fs, 'no step stills for ' + prefix
    return [Image.open(f).convert('RGB') for f in fs]


sets = [(lab, steps_of(pre)) for lab, pre in SETS]
N = max(len(fr) for _, fr in sets)
M, G = round(W * 0.012), round(W * 0.010)                      # outer margin, gap between panels
tf, cf = font(HAND, W * 0.026), font(TEXT, max(13, W * 0.0105))


def wrap(d, s, f, width):
    """the text broken into lines no wider than width"""
    out = []
    for para in s.split('\n'):
        words, line = para.split(), ''
        for w_ in words:
            t = (line + ' ' + w_).strip()
            if d.textlength(t, font=f) <= width or not line: line = t
            else: out.append(line); line = w_
        out.append(line)
    return out


# --- where each panel goes: (x, y, w, h) on the board, and the board's size
probe = ImageDraw.Draw(Image.new('RGB', (8, 8)))
sizes = [fr[0].size for _, fr in sets]
top = M + (round(W * 0.040) if TITLE and LAYOUT != 'grid' else 0)
cap_lines = wrap(probe, CAPTION, cf, W - 2 * M) if CAPTION and LAYOUT != 'grid' else []
cap_h = (len(cap_lines) * round(cf.size * 1.45) + G) if cap_lines else 0
boxes = []
if LAYOUT == 'stack':
    y = top
    for w_, h_ in sizes:
        pw = W - 2 * M; ph = round(h_ * pw / w_); boxes.append((M, y, pw, ph)); y += ph + G
    H = y - G + cap_h + M
elif LAYOUT == 'row':
    asp = [w_ / h_ for w_, h_ in sizes]; ph = (W - 2 * M - G * (len(sizes) - 1)) / sum(asp); x = M
    for a in asp:
        pw = round(a * ph); boxes.append((x, top, pw, round(ph))); x += pw + G
    H = top + round(ph) + cap_h + M
else:   # grid, 2 columns; the cell after the last panel holds the title and the caption
    cw = (W - 2 * M - G) // 2; y = M; cells = []
    for i in range(0, len(sizes) + 1, 2):
        hs = [round(sizes[j][1] * cw / sizes[j][0]) for j in (i, i + 1) if j < len(sizes)]
        rh = max(hs) if hs else round(cw * 0.45)
        for k, j in enumerate((i, i + 1)):
            x = M + k * (cw + G)
            if j < len(sizes): boxes.append((x, y + (rh - hs[k]) // 2, cw, hs[k]))
            elif j == len(sizes): cells.append((x, y, cw, rh))
        y += rh + G
    H = y - G + M; note_cell = cells[0] if cells else None
H += H % 2; Wb = W + W % 2


def board(k):
    im = Image.new('RGB', (Wb, H), WHITE); d = ImageDraw.Draw(im)
    for (lab, fr), (x, y, pw, ph) in zip(sets, boxes):
        im.paste(fr[min(k, len(fr) - 1)].resize((pw, ph), Image.LANCZOS), (x, y))
        d.rectangle([x, y, x + pw - 1, y + ph - 1], outline=LINE, width=1)
        lf = font(HAND, max(18, pw * LABEL)); pad = round(lf.size * 0.45)
        tw = d.textlength(lab, font=lf)
        d.rectangle([x, y, x + tw + 2 * pad, y + round(lf.size * 1.75)], fill=WHITE)      # a white tab under the label
        d.text((x + pad, y + round(lf.size * 0.30)), lab, font=lf, fill=RED)
    if LAYOUT == 'grid' and note_cell:
        x, y, cw_, rh = note_cell; yy = y + round(rh * 0.10)
        if TITLE:
            for ln in wrap(d, TITLE, tf, cw_ - 2 * G): d.text((x + G, yy), ln, font=tf, fill=INK); yy += round(tf.size * 1.5)
            yy += G
        for ln in (wrap(d, CAPTION, cf, cw_ - 2 * G) if CAPTION else []): d.text((x + G, yy), ln, font=cf, fill=INK3); yy += round(cf.size * 1.5)
    else:
        if TITLE: d.text((M, M - round(tf.size * 0.10)), TITLE, font=tf, fill=INK)
        yy = H - M - cap_h + G
        for ln in cap_lines: d.text((M, yy), ln, font=cf, fill=INK3); yy += round(cf.size * 1.45)
    return im


frames = [board(k) for k in range(N)]
for k, im in enumerate(frames): im.save(os.path.join(OUT, f'{NAME}_step_{k}.jpg'), quality=92)
frames[-1].save(os.path.join(OUT, f'{NAME}_final.jpg'), quality=93)
pal = frames[-1].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
gif = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in frames]
dur = [int(1000 * (LAST if k == N - 1 else HOLD)) for k in range(N)]
gp = os.path.join(OUT, f'{NAME}.gif')
gif[0].save(gp, save_all=True, append_images=gif[1:], duration=dur, loop=0, optimize=False)
print(gp, round(os.path.getsize(gp) / 1e6, 1), 'MB,', N, 'frames,', Wb, 'x', H, 'durations', dur)
if shutil.which('ffmpeg'):
    tmp = os.path.join(OUT, '_mp4_' + NAME); os.makedirs(tmp, exist_ok=True); n = 0
    for k, im in enumerate(frames):
        for _ in range(int((LAST if k == N - 1 else HOLD) * 25)): im.save(os.path.join(tmp, f'{n:05d}.png')); n += 1
    mp = os.path.join(OUT, f'{NAME}.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '25', '-i', os.path.join(tmp, '%05d.png'), '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '20', mp], check=True)
    shutil.rmtree(tmp); print(mp, round(os.path.getsize(mp) / 1e6, 1), 'MB')
