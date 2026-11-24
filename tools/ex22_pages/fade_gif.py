"""Exercise 2.2 · a build-up GIF from step images drawn over one photo (owner, 24 Nov 2026: "give the background an opacity
and make the GIF"). The steps are a red drawing laid over the same black-and-white photo (images from an image chat, all the
size of the photo and aligned to it). For each step the red ink is lifted off its own background by its colour (the photo is
grey, so any colour is ink: a = (R - (G+B)/2) / (ink_R - ink_GB)), and laid again over the ORIGINAL photo faded to the chosen
opacity on white, so the photo does not flicker between frames and the drawing stays at full strength.
Writes step_0..N.jpg (stills), <name>.gif and <name>.mp4 (when ffmpeg is there). Each step appears at once (owner: no fade-in),
held HOLD s (default 0.6), the last one LAST s (default 2.0); FADE=1 brings back cross-fades.
Usage: python3 tools/ex22_pages/fade_gif.py <out folder> <name> <opacity 0-1> <photo|auto> <step1> <step2> ...
<photo> = auto when the clean photo is missing: it is rebuilt from step 1 (auto:<img>,<img> adds the step-1 images of other
alternatives drawn on the same scene, so their lines fill each other's gaps), saved as <name>_base_rebuilt.jpg. Steps shifted by a few pixels against
the photo are moved back onto it (phase correlation).
The images are the owner's and are not committed. Not part of the site or of the tests."""
import os, sys, shutil, subprocess
import numpy as np
from PIL import Image

OUT, NAME, K = sys.argv[1], sys.argv[2], float(sys.argv[3])
HOLD, LAST = float(os.environ.get('HOLD', 0.6)), float(os.environ.get('LAST', 2.0))
FADE = os.environ.get('FADE') == '1'
PHOTO, STEPS = sys.argv[4], sys.argv[5:]
os.makedirs(OUT, exist_ok=True)
def ink_alpha(a_):
    sat = a_.max(2) - a_.min(2)
    m = sat > np.percentile(sat, 99.5); ink = np.median(a_[m], axis=0)  # the ink's own colour (its most saturated pixels)
    gb = (ink[1] + ink[2]) / 2; den = max(ink[0] - gb, 30.0)
    a = np.clip((a_[..., 0] - (a_[..., 1] + a_[..., 2]) / 2) / den, 0, 1)
    a[a < 0.06] = 0                                                   # compression noise in the grey photo
    return a, ink, gb


def rebuild_base(paths):
    """the clean photo under several step-1 drawings of the same scene: each pixel from an image with no red on it (images
    tone-matched to the first); where every image has a line, the image with the faintest one, held near the local level so
    the lines leave no ghost (the image chat also lightens or darkens the photo under its lines)"""
    import cv2
    G, V, A, C = [], [], [], []
    for pth in paths:
        a_ = np.asarray(Image.open(pth).convert('RGB'), float)
        a, ink, gb = ink_alpha(a_); a = np.clip((a_[..., 0] - (a_[..., 1] + a_[..., 2]) / 2) / max(ink[0] - gb, 30.0), 0, 1)
        g = (a_[..., 1] + a_[..., 2]) / 2
        G.append(g); V.append((g - a * gb) / np.maximum(1 - a, 0.2)); A.append(a)
        C.append(cv2.erode(((a_[..., 0] - g) <= 6).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool))
    for i in range(1, len(G)):                                        # tone of each image matched to the first
        both = C[0] & C[i]; M = np.vstack([G[i][both], np.ones(both.sum())]).T; al, be = np.linalg.lstsq(M, G[0][both], rcond=None)[0]
        G[i], V[i] = al * G[i] + be, al * V[i] + be
    Cs = np.array(C); Gs = np.array(G); n = Cs.sum(0)
    v = np.where(n > 0, (Gs * Cs).sum(0) / np.maximum(n, 1), np.min(np.array(V), 0))
    dirty = n == 0
    known = np.where(dirty, 0, v).astype(np.float32); wk = (~dirty).astype(np.float32)
    num = cv2.GaussianBlur(known, (0, 0), 9); den = cv2.GaussianBlur(wk, (0, 0), 9)
    lvl = np.where(den > 0.02, num / np.maximum(den, 0.02), cv2.blur(np.clip(v, 0, 255).astype(np.float32), (41, 41)))
    v = np.where(dirty, np.clip(v, lvl - 10, lvl + 10), v)
    v = np.where(dirty, cv2.GaussianBlur(v.astype(np.float32), (0, 0), 0.6), v)
    print('photo rebuilt from', len(paths), 'step-1 image(s); drawn in all of them: %.1f%% of the pixels' % (100 * dirty.mean()))
    return np.repeat(np.clip(v, 0, 255)[..., None], 3, 2)


if PHOTO == 'auto' or PHOTO.startswith('auto:'):                       # rebuild the clean photo from step 1 (and others)
    src = [STEPS[0]] + ([q for q in PHOTO[5:].split(',') if q] if PHOTO.startswith('auto:') else [])
    base = rebuild_base(src)
    PHOTO = os.path.join(OUT, f'{NAME}_base_rebuilt.jpg'); Image.fromarray(base.astype(np.uint8)).save(PHOTO, quality=94)
base = np.asarray(Image.open(PHOTO).convert('RGB'), float)


def onto_base(a_):
    """move a step back onto the photo when it is shifted by a few pixels (integer phase correlation)"""
    g0 = base.mean(2); g1 = a_.mean(2)
    F = np.fft.fft2(g0 - g0.mean()); G = np.fft.fft2(g1 - g1.mean()); Rr = F * np.conj(G); Rr /= np.abs(Rr) + 1e-9
    r = np.fft.ifft2(Rr).real; dy, dx = np.unravel_index(r.argmax(), r.shape)
    dy = dy - r.shape[0] if dy > r.shape[0] // 2 else dy; dx = dx - r.shape[1] if dx > r.shape[1] // 2 else dx
    if (dx or dy) and abs(dx) <= 6 and abs(dy) <= 6:
        a_ = np.roll(a_, (dy, dx), axis=(0, 1)); print('  moved by', dx, dy, 'px onto the photo')
    return a_
v0 = base.mean(2, keepdims=True)                                    # the photo's grey
faded = 255.0 * (1 - K) + K * v0                                      # the photo at opacity K on white
frames = [faded.repeat(3, 2)]
for p in STEPS:
    a_ = np.asarray(Image.open(p).convert('RGB'), float)
    assert a_.shape == base.shape, (p, a_.shape, base.shape)
    a_ = onto_base(a_)
    a, ink, gb = ink_alpha(a_)
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
