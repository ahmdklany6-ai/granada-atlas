"""Exercise 2.2 · a build-up GIF from step images drawn over one photo (owner, 24 Nov 2026: "give the background an opacity
and make the GIF"). The steps are a red drawing laid over the same black-and-white photo (images from an image chat, all the
size of the photo and aligned to it). For each step the red ink is lifted off its own background by its colour (the photo is
grey, so any colour is ink: a = (R - (G+B)/2) / (ink_R - ink_GB)), and laid again over the ORIGINAL photo faded to the chosen
opacity on white, so the photo does not flicker between frames and the drawing stays at full strength.
Writes step_0..N.jpg (stills), <name>.gif and <name>.mp4 (when ffmpeg is there). Each step appears at once (owner: no fade-in),
held HOLD s (default 0.6), the last one LAST s (default 2.0); FADE=1 brings back cross-fades.
Usage: python3 tools/ex22_pages/fade_gif.py <out folder> <name> <opacity 0-1> <photo> <step1> <step2> ...
The images are the owner's and are not committed. Not part of the site or of the tests."""
import os, sys, shutil, subprocess
import numpy as np
from PIL import Image

OUT, NAME, K = sys.argv[1], sys.argv[2], float(sys.argv[3])
HOLD, LAST = float(os.environ.get('HOLD', 0.6)), float(os.environ.get('LAST', 2.0))
FADE = os.environ.get('FADE') == '1'
PHOTO, STEPS = sys.argv[4], sys.argv[5:]
os.makedirs(OUT, exist_ok=True)
base = np.asarray(Image.open(PHOTO).convert('RGB'), float)
v0 = base.mean(2, keepdims=True)                                    # the photo's grey
faded = 255.0 * (1 - K) + K * v0                                      # the photo at opacity K on white
frames = [faded.repeat(3, 2)]
for p in STEPS:
    a_ = np.asarray(Image.open(p).convert('RGB'), float)
    assert a_.shape == base.shape, (p, a_.shape, base.shape)
    sat = a_.max(2) - a_.min(2)
    m = sat > np.percentile(sat, 99.5); ink = np.median(a_[m], axis=0)  # the ink's own colour (its most saturated pixels)
    gb = (ink[1] + ink[2]) / 2; den = max(ink[0] - gb, 30.0)
    a = np.clip((a_[..., 0] - (a_[..., 1] + a_[..., 2]) / 2) / den, 0, 1)
    a[a < 0.06] = 0                                                   # compression noise in the grey photo
    a = a[..., None]
    ink_part = a_ - ((a_[..., 1:2] + a_[..., 2:3]) / 2 - a * gb)      # the pixel minus its own background share
    frames.append(np.clip(ink_part + (1 - a) * faded, 0, 255))
    print(os.path.basename(p), 'ink', ink.round(), 'ink cover %.1f%%' % (100 * (a > 0).mean()))
stills = [Image.fromarray(f.astype(np.uint8)) for f in frames]
for i, im in enumerate(stills): im.save(os.path.join(OUT, f'{NAME}_step_{i}.jpg'), quality=93)

# GIF: each step appears at once and is held; the last one longer; one palette for all frames (no flicker)
W = 1400; H = round(stills[0].height * W / stills[0].width)
small = [np.asarray(im.resize((W, H), Image.LANCZOS), float) for im in stills]
seq, dur = [], []
for i, f in enumerate(small):
    seq.append(f); dur.append(int(1000 * (LAST if i == len(small) - 1 else HOLD)))
    if FADE and i < len(small) - 1:
        for t in (0.2, 0.4, 0.6, 0.8):
            seq.append(f * (1 - t) + small[i + 1] * t); dur.append(90)
pal = Image.fromarray(small[-1].astype(np.uint8)).quantize(colors=255, method=Image.Quantize.MEDIANCUT)
gif = [Image.fromarray(f.astype(np.uint8)).quantize(palette=pal, dither=Image.Dither.NONE) for f in seq]
gp = os.path.join(OUT, f'{NAME}.gif')
gif[0].save(gp, save_all=True, append_images=gif[1:], duration=dur, loop=0, optimize=False)
print(gp, round(os.path.getsize(gp) / 1e6, 1), 'MB,', len(gif), 'frames,', W, 'x', H)

if shutil.which('ffmpeg'):   # the same build-up as a small video (smoother, lighter)
    tmp = os.path.join(OUT, '_mp4'); os.makedirs(tmp, exist_ok=True); n = 0
    fullW = stills[0].width - stills[0].width % 2; fullH = stills[0].height - stills[0].height % 2
    big = [np.asarray(im, float)[:fullH, :fullW] for im in stills]
    for i, f in enumerate(big):
        for _ in range(int((LAST if i == len(big) - 1 else HOLD) * 25)):
            Image.fromarray(f.astype(np.uint8)).save(os.path.join(tmp, f'{n:05d}.png')); n += 1
        if FADE and i < len(big) - 1:
            for t in np.linspace(0, 1, 14)[1:-1]:
                Image.fromarray((f * (1 - t) + big[i + 1] * t).astype(np.uint8)).save(os.path.join(tmp, f'{n:05d}.png')); n += 1
    mp = os.path.join(OUT, f'{NAME}.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '25', '-i', os.path.join(tmp, '%05d.png'), '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '20', mp], check=True)
    shutil.rmtree(tmp); print(mp, round(os.path.getsize(mp) / 1e6, 1), 'MB')
