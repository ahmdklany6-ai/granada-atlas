"""Exercise 2.2 · the alternatives' build-ups together on one board, as one GIF (owner, 24 Nov 2026: "now put the three
together", then "change the font": the project's IBM Plex Sans instead of the handwriting). Takes the step stills written by
fade_gif.py (<prefix>_step_0.jpg, _step_1.jpg ...) of each alternative and lays each step of all of them on one board:
  stack  one under the other, each at the board's width
  row    side by side, all at the same height
  grid   2 x 2, panels aligned at the top; the free cell holds the title and the note
Above every panel its label: the group's name in the studio red, semi-bold, then its position in ink ("Residents · the river
is ours": the part before " · " is the name). A caption says what the pictures are. All panels change step at the same moment:
HOLD s per step (default 0.6), LAST s on the final one (default 2.0). A set with fewer steps holds its last.
Writes <name>.gif, <name>.mp4 (when ffmpeg is there), <name>_final.jpg and <name>_step_k.jpg.
Usage: python3 tools/ex22_pages/together_gif.py <out folder> <name> <stack|row|grid> "<label>=<prefix>" "<label>=<prefix>" ...
env:   W (board width in px; default 1400 stack, 2400 row, 2000 grid), TITLE, CAPTION, HOLD, LAST, LABEL_PX, TITLE_PX,
       FONT_DIR (a folder with IBMPlexSans-Regular.ttf and IBMPlexSans-SemiBold.ttf; without it DejaVu Sans is used),
       or LABEL_FONT / TEXT_FONT (font files) to set them one by one.
Colours from js/palette.js. The images are the owner's and are not committed; fonts are not committed either.
Not part of the site or of the tests."""
import os, sys, glob, re, shutil, subprocess
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw

P = _bw._P
RED, INK, INK2, INK3, WHITE, LINE = P['red'], P['ink'], P['ink2'], P['ink3'], P['white'], P['line']
OUT, NAME, LAYOUT = sys.argv[1], sys.argv[2], sys.argv[3]
assert LAYOUT in ('stack', 'row', 'grid'), LAYOUT
SETS = [a.split('=', 1) for a in sys.argv[4:]]
assert len(SETS) >= 2 and all(len(s) == 2 for s in SETS), 'give "<label>=<prefix>" for each alternative'
W = int(os.environ.get('W', {'stack': 1400, 'row': 2400, 'grid': 2000}[LAYOUT]))
HOLD, LAST = float(os.environ.get('HOLD', 0.6)), float(os.environ.get('LAST', 2.0))
TITLE, CAPTION = os.environ.get('TITLE', ''), os.environ.get('CAPTION', '')
FONT_DIR = os.environ.get('FONT_DIR', '')
BOLD = os.environ.get('LABEL_FONT') or (os.path.join(FONT_DIR, 'IBMPlexSans-SemiBold.ttf') if FONT_DIR else '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
TEXT = os.environ.get('TEXT_FONT') or (os.path.join(FONT_DIR, 'IBMPlexSans-Regular.ttf') if FONT_DIR else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
os.makedirs(OUT, exist_ok=True)


def font(path, px):
    return ImageFont.truetype(path, int(round(px)))


def steps_of(prefix):
    fs = glob.glob(prefix + '_step_*.jpg')
    fs.sort(key=lambda f: int(re.search(r'_step_(\d+)\.jpg$', f).group(1)))
    assert fs, 'no step stills for ' + prefix
    return [Image.open(f).convert('RGB') for f in fs]


sets = [(lab, steps_of(pre)) for lab, pre in SETS]
N = max(len(fr) for _, fr in sets)
M, G = round(W * 0.016), round(W * 0.012)                      # outer margin, gap between panels
LP = int(os.environ.get('LABEL_PX', round(W * {'stack': 0.0215, 'row': 0.0105, 'grid': 0.016}[LAYOUT])))   # label size, the same on every panel
LB = round(LP * 1.75)                                            # the label's band above its panel
TS = int(os.environ.get('TITLE_PX', round(LP * 1.3)))                  # the title: a third larger than the labels
lf_b, lf_r = font(BOLD, LP), font(TEXT, LP)
cf = font(TEXT, min(max(W * 0.0135, 15), 22))
probe = ImageDraw.Draw(Image.new('RGB', (8, 8)))


def wrap(s, f, width):
    """the text broken into lines no wider than width"""
    out = []
    for para in s.split('\n'):
        line = ''
        for w_ in para.split():
            t = (line + ' ' + w_).strip()
            if probe.textlength(t, font=f) <= width or not line: line = t
            else: out.append(line); line = w_
        out.append(line)
    return out


def title_font(width):
    """the title on one line when it fits (from 1.2 x down to 0.9 x the size TS for this layout), else wrapped at the smaller size"""
    px = TS * 1.2
    while px > TS * 0.9 and probe.textlength(TITLE, font=font(BOLD, px)) > width: px -= 1
    return font(BOLD, px)


# --- where each panel goes: (x, y, w, h) of its picture on the board (its label band sits just above), and the board's size
sizes = [fr[0].size for _, fr in sets]
if LAYOUT != 'grid':
    tf = title_font(W - 2 * M) if TITLE else None
    t_lines = wrap(TITLE, tf, W - 2 * M) if TITLE else []
    top = M + (len(t_lines) * round(tf.size * 1.3) + round(G * 0.6) if TITLE else 0)
    cap_lines = wrap(CAPTION, cf, W - 2 * M) if CAPTION else []
    cap_h = (len(cap_lines) * round(cf.size * 1.45) + G) if cap_lines else 0
boxes = []
if LAYOUT == 'stack':
    y = top
    for w_, h_ in sizes:
        pw = W - 2 * M; ph = round(h_ * pw / w_); boxes.append((M, y + LB, pw, ph)); y += LB + ph + G
    H = y - G + cap_h + M
elif LAYOUT == 'row':
    asp = [w_ / h_ for w_, h_ in sizes]; ph = (W - 2 * M - G * (len(sizes) - 1)) / sum(asp); x = M
    for a in asp:
        pw = round(a * ph); boxes.append((x, top + LB, pw, round(ph))); x += pw + G
    H = top + LB + round(ph) + cap_h + M
else:   # grid, 2 columns, panels aligned at the top of their row; the cell after the last panel holds the title and the caption
    cw = (W - 2 * M - G) // 2; y = M; note_cell = None
    for i in range(0, len(sizes) + 1, 2):
        hs = [round(sizes[j][1] * cw / sizes[j][0]) for j in (i, i + 1) if j < len(sizes)]
        rh = max(hs) if hs else round(cw * 0.45)
        for k, j in enumerate((i, i + 1)):
            x = M + k * (cw + G)
            if j < len(sizes): boxes.append((x, y + LB, cw, hs[k]))
            elif j == len(sizes): note_cell = (x, y + LB, cw, rh)
        y += LB + rh + G
    H = y - G + M
    tf = title_font(cw - 2 * G) if TITLE else None
H += H % 2; Wb = W + W % 2


def label(d, x, y, lab):
    """the group's name in red, semi-bold; the rest of the label in ink, regular"""
    name, sep, rest = lab.partition(' · ')
    yy = y + round((LB - LP * 1.25) / 2)
    d.text((x, yy), name, font=lf_b, fill=RED); x += d.textlength(name, font=lf_b)
    if sep: d.text((x, yy), ' · ' + rest, font=lf_r, fill=INK2)


def board(k):
    im = Image.new('RGB', (Wb, H), WHITE); d = ImageDraw.Draw(im)
    for (lab, fr), (x, y, pw, ph) in zip(sets, boxes):
        im.paste(fr[min(k, len(fr) - 1)].resize((pw, ph), Image.LANCZOS), (x, y))
        d.rectangle([x, y, x + pw - 1, y + ph - 1], outline=LINE, width=1)
        label(d, x, y - LB, lab)
    if LAYOUT == 'grid':
        if note_cell:
            x, y, cw_, rh = note_cell; yy = y + round(rh * 0.06)
            if TITLE:
                for ln in wrap(TITLE, tf, cw_ - 2 * G): d.text((x + G, yy), ln, font=tf, fill=INK); yy += round(tf.size * 1.3)
                yy += G
            for ln in (wrap(CAPTION, cf, cw_ - 2 * G) if CAPTION else []): d.text((x + G, yy), ln, font=cf, fill=INK3); yy += round(cf.size * 1.45)
    else:
        yy = M - round(tf.size * 0.12) if TITLE else M
        for ln in t_lines: d.text((M, yy), ln, font=tf, fill=INK); yy += round(tf.size * 1.3)
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
print(gp, round(os.path.getsize(gp) / 1e6, 1), 'MB,', N, 'frames,', Wb, 'x', H, 'durations', dur, '| label', LP, 'px, caption', cf.size, 'px, title', tf.size if TITLE else '-', 'px')
print('panel boxes (x, y, w, h):', boxes, '| label band', LB, 'px above each | fonts', os.path.basename(BOLD), os.path.basename(TEXT))
if shutil.which('ffmpeg'):
    tmp = os.path.join(OUT, '_mp4_' + NAME); os.makedirs(tmp, exist_ok=True); n = 0
    for k, im in enumerate(frames):
        for _ in range(int((LAST if k == N - 1 else HOLD) * 25)): im.save(os.path.join(tmp, f'{n:05d}.png')); n += 1
    mp = os.path.join(OUT, f'{NAME}.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '25', '-i', os.path.join(tmp, '%05d.png'), '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '20', mp], check=True)
    shutil.rmtree(tmp); print(mp, round(os.path.getsize(mp) / 1e6, 1), 'MB')
