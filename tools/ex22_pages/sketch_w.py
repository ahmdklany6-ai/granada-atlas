"""Exercise 2.2 · hand-drawn-looking marker sketches of the three alternatives over the owner's aerial photo of the west edge
(Río Dílar between the ring road Las Gabias–Alhendín and the base's fence) — owner, 24 Nov 2026: a photo with the proposal drawn
over it in marker, step by step (the manner of a reference video he sent; nothing copied), then "nicer, like a hand drawing".
Marker look: zig-zag scribble fills with streaks and overshoot, wobbly double outlines, scribbled tree crowns, chalky paths,
handwritten notes. Colours from js/palette.js only (studio red, olives, the water blues, white, the ink).
What is drawn follows the 2.2 west-edge sheets (tools/ex22_pages/edges.py, AREA=W): residents = river park; developer = 6-floor
blocks between the road and the river, 20 m from it (our assumption), phase 2 on the base only if it leaves; Defence = the
corridor kept open and a security band inside the fence. Everything is SCHEMATIC and placed by eye on the photo.
The photo is the owner's and is NOT committed; pass its path.
Usage: python3 tools/ex22_pages/sketch_w.py <photo> <out folder>   → W_0_today, W_1_residents, W_2_developer, W_3_defence
(.jpg) and a step-by-step build-up GIF per alternative. Not part of the site or of the tests."""
import os, sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw

PHOTO, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
P = _bw._P; B = P['base']
RED, DARK, ROSE, TINT = B['red'], B['oxblood'], P['rose'], P['redTint']
OLIVE, OLIVE2, LEAF, KHAKI = B['olive'], P['olive'], B['chartreuse'], B['khaki']   # dark olive, olive, light leaf, khaki
WATER, WATER2, WATER3 = B['lightBlue'], B['blueGrey'], P['blue']
WHITE, INK = '#FFFFFF', B['brown']
SS = 2
HAND = '/mnt/skills/examples/canvas-design/canvas-fonts/NothingYouCouldDo-Regular.ttf'


def rgba(h, a=255): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), int(a))
def sc(y): return 0.13 + 0.87 * max(0.0, (y - 100)) / 721.0


def lerp_poly(pts, y):
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        if (y1 - y) * (y2 - y) <= 0 and y1 != y2: return x1 + (x2 - x1) * (y - y1) / (y2 - y1)
    return pts[-1][0] if y < pts[-1][1] else pts[0][0]


# ---- the photo's lines, placed by eye (image px, bottom → top) ----------------------------------------------------------
ROAD_L = [(770, 821), (690, 650), (620, 500), (560, 350), (505, 220), (470, 160), (440, 118)]
ROAD_R = [(960, 821), (840, 650), (705, 500), (592, 350), (522, 220), (482, 160), (455, 118)]
RIVER = [(1450, 821), (1350, 740), (1200, 660), (1050, 580), (900, 500), (800, 420), (720, 320), (650, 230), (600, 175)]
TRACK = [(1916, 690), (1700, 615), (1500, 535), (1300, 452), (1150, 383), (1050, 322), (995, 262), (982, 212), (930, 176), (800, 142), (650, 120)]
FENCE = [(1916, 640), (1700, 565), (1500, 485), (1350, 418), (1200, 352), (1100, 302), (1035, 252), (1012, 207), (972, 172), (860, 142), (720, 120)]


def along(pts, n, off=0.0, t0=0.0, t1=1.0):
    seg = [(a, b, math.hypot(b[0] - a[0], b[1] - a[1])) for a, b in zip(pts, pts[1:])]; L = sum(s[2] for s in seg); out = []
    for i in range(n):
        t = (t0 + (t1 - t0) * (i + 0.5) / n) * L
        for a, b, l in seg:
            if t <= l:
                f = t / l; x, y = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f; nx, ny = -(b[1] - a[1]) / l, (b[0] - a[0]) / l
                out.append((x + nx * off * sc(y), y + ny * off * sc(y))); break
            t -= l
    return out


def band(pts, w0, w1=None, n=60):
    """a polygon of half-width w (photo px at the bottom; scaled by perspective) around a polyline"""
    w1 = w0 if w1 is None else w1
    a = along(pts, n, 0); L, R = [], []
    for i in range(len(a)):
        p, q = a[max(0, i - 1)], a[min(len(a) - 1, i + 1)]; dx, dy = q[0] - p[0], q[1] - p[1]; l = math.hypot(dx, dy) or 1
        w = (w0 + (w1 - w0) * i / (len(a) - 1)) * sc(a[i][1]); nx, ny = -dy / l, dx / l
        L.append((a[i][0] + nx * w, a[i][1] + ny * w)); R.append((a[i][0] - nx * w, a[i][1] - ny * w))
    return L + R[::-1]


class Sketch:
    def __init__(self, seed=7):
        base = Image.open(PHOTO).convert('RGB')
        self.W, self.H = base.size
        g = base.resize((self.W * SS, self.H * SS), Image.LANCZOS).convert('L')
        g = Image.eval(g, lambda v: int(70 + v * 0.72))                                  # the photo a little paler, so the marker reads
        self.im = Image.merge('RGB', (g, g, g)).convert('RGBA')
        self.rnd = random.Random(seed)
        n = np.random.default_rng(seed).random((self.H * SS // 4 + 1, self.W * SS // 4 + 1))
        self.grain = Image.fromarray((n * 255).astype('uint8')).resize((self.W * SS, self.H * SS), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))

    def layer(self): return Image.new('RGBA', self.im.size, (0, 0, 0, 0))
    def S(self, pts): return [(x * SS, y * SS) for x, y in pts]

    def put(self, lay, streak=0.35):
        """composite a marker layer, its alpha broken a little by paper grain (marker streaks)"""
        if streak:
            a = lay.getchannel('A'); g = Image.eval(self.grain, lambda v: int(255 * (1 - streak) + v * streak))
            lay.putalpha(ImageChops.multiply(a, g))
        self.im = Image.alpha_composite(self.im, lay)

    def wob(self, pts, amp=1.4, step=5):
        """densify a polyline and make it wobble like a hand line (smooth noise along it)"""
        out = []; ph = [self.rnd.uniform(0, 6.3) for _ in range(3)]; s_acc = 0
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            l = math.hypot(x2 - x1, y2 - y1); n = max(1, int(l / step)); nx, ny = (-(y2 - y1) / l, (x2 - x1) / l) if l else (0, 0)
            for i in range(n):
                t = i / n; s_acc += l / n
                o = amp * (math.sin(s_acc / 23 + ph[0]) * 0.6 + math.sin(s_acc / 9 + ph[1]) * 0.3 + math.sin(s_acc / 4 + ph[2]) * 0.1)
                out.append((x1 + (x2 - x1) * t + nx * o, y1 + (y2 - y1) * t + ny * o))
        out.append(pts[-1]); return out

    def line(self, pts, col, w, alpha=235, passes=2, amp=1.3, dash=None, streak=0.3):
        lay = self.layer(); d = ImageDraw.Draw(lay)
        for k in range(passes):
            q = self.wob(pts, amp * (1 + k * 0.6))
            a = alpha if k == 0 else alpha * 0.45
            ww = w * (1 if k == 0 else 0.7)
            on, acc = True, 0.0
            for (x1, y1), (x2, y2) in zip(q, q[1:]):
                l = math.hypot(x2 - x1, y2 - y1)
                if dash:
                    acc += l
                    if acc > (dash[0] if on else dash[1]): on, acc = not on, 0.0
                    if not on: continue
                wi = ww * (0.85 + 0.3 * self.rnd.random())
                d.line(self.S([(x1, y1), (x2, y2)]), fill=rgba(col, a), width=max(1, int(wi * SS)))
                r = wi * SS / 2; d.ellipse([x2 * SS - r, y2 * SS - r, x2 * SS + r, y2 * SS + r], fill=rgba(col, a))
        self.put(lay, streak)

    def fill(self, poly, col, alpha=170, spacing=7, ang=None, w=5.5, outline=None, ow=2.2, over=3, streak=0.45):
        """a marker fill: back-and-forth strokes across the shape, slightly over its edge, then a wobbly outline"""
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]; cx, cy = sum(xs) / len(xs), sum(ys) / len(ys); R = max(max(xs) - min(xs), max(ys) - min(ys)) * 0.75 + 10
        ang = self.rnd.uniform(-50, -30) if ang is None else ang; a = math.radians(ang); ux, uy = math.cos(a), math.sin(a)
        mask = Image.new('L', self.im.size, 0); ImageDraw.Draw(mask).polygon(self.S(poly), fill=255)
        if over: mask = mask.filter(ImageFilter.MaxFilter(2 * int(over * SS) + 1)).filter(ImageFilter.GaussianBlur(over * SS * 0.6))
        lay = self.layer(); d = ImageDraw.Draw(lay)
        t = -R; zig = []; side = 1
        while t < R:
            ox, oy = cx - uy * t, cy + ux * t
            e = R * (1 + self.rnd.uniform(-0.05, 0.05))
            zig.append((ox - ux * e * side, oy - uy * e * side)); zig.append((ox + ux * e * side, oy + uy * e * side)); side = -side
            t += spacing * (0.75 + 0.5 * self.rnd.random())
        q = self.wob(zig, 1.2, 8)
        for (x1, y1), (x2, y2) in zip(q, q[1:]):
            d.line(self.S([(x1, y1), (x2, y2)]), fill=rgba(col, alpha), width=max(1, int(w * (0.8 + 0.4 * self.rnd.random()) * SS)))
        out = self.layer(); out.paste(lay, (0, 0), mask); self.put(out, streak)
        if outline: self.line(poly + [poly[0]], outline, ow, 220, 2, 1.0, streak=0.2)

    def scribble_crown(self, x, y, r, col, dark, alpha=230):
        """a tree crown as a scribbled loop: a wobbly spiral, filled, a darker rim, a shadow"""
        lay = self.layer(); d = ImageDraw.Draw(lay)
        d.ellipse(self.S([(x - r * 0.9 + r * 0.35, y + r * 0.25), (x + r * 0.9 + r * 0.35, y + r * 0.85)]), fill=rgba(INK, 55))
        pts = []; ph = self.rnd.uniform(0, 6.3); turns = 2.6; n = 44
        for i in range(n + 1):
            t = i / n; a = ph + t * turns * 2 * math.pi; rr = r * (0.55 + 0.45 * min(1, t * 2.2)) * (0.85 + 0.25 * self.rnd.random())
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr * 0.85))
        d.polygon(self.S([(x + math.cos(ph + k * 0.5) * r * 0.95, y + math.sin(ph + k * 0.5) * r * 0.8) for k in range(13)]), fill=rgba(col, alpha * 0.8))
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]): d.line(self.S([(x1, y1), (x2, y2)]), fill=rgba(col, alpha), width=max(1, int(r * 0.32 * SS)))
        rim = [(x + math.cos(ph + k * 0.45) * r * (0.95 + 0.12 * self.rnd.random()), y + math.sin(ph + k * 0.45) * r * 0.82) for k in range(16)]
        for (x1, y1), (x2, y2) in zip(rim, rim[1:]): d.line(self.S([(x1, y1), (x2, y2)]), fill=rgba(dark, alpha), width=max(1, int((0.8 + r * 0.06) * SS)))
        self.put(lay, 0.3)

    def tree(self, x, y, big=1.0, col=None):
        s = sc(y); r = (13 * s + 3) * big
        self.line([(x, y), (x + self.rnd.uniform(-1, 1), y - r * 0.9)], INK, max(1.2, 2.4 * s), 230, 1, 0.3, streak=0.1)
        self.scribble_crown(x, y - r * 1.25, r, col or self.rnd.choice((OLIVE2, LEAF, OLIVE2)), OLIVE)

    def person(self, x, y, bike=False, col=WHITE):
        s = sc(y); h = 28 * s + 5
        lay = self.layer(); d = ImageDraw.Draw(lay); S = lambda p: (p[0] * SS, p[1] * SS); w = max(2, int(3 * s * SS))
        hx, hy = x + (h * 0.12 if bike else 0), y - h
        for colr, extra in ((INK, 2), (col, 0)):
            ww = w + int(extra * SS)
            d.ellipse([S((hx - h * 0.13 - extra * 0.3, hy - h * 0.13 - extra * 0.3)), S((hx + h * 0.13 + extra * 0.3, hy + h * 0.13 + extra * 0.3))], fill=rgba(colr))
            if bike:
                rr = h * 0.24
                for bx in (x - h * 0.32, x + h * 0.32): d.ellipse([S((bx - rr, y - 2 * rr)), S((bx + rr, y))], outline=rgba(colr), width=max(2, ww // 2))
                d.line([S((x - h * 0.32, y - rr)), S((x, y - h * 0.42)), S((x + h * 0.32, y - rr)), S((hx, y - h * 0.62))], fill=rgba(colr), width=max(2, ww // 2))
                d.line([S((hx, hy + h * 0.12)), S((x, y - h * 0.42))], fill=rgba(colr), width=ww)
            else:
                d.line([S((hx, hy + h * 0.12)), S((hx, y - h * 0.45))], fill=rgba(colr), width=ww)
                d.line([S((hx, y - h * 0.45)), S((x - h * 0.15, y))], fill=rgba(colr), width=ww); d.line([S((hx, y - h * 0.45)), S((x + h * 0.15, y))], fill=rgba(colr), width=ww)
                d.line([S((hx - h * 0.18, y - h * 0.62)), S((hx + h * 0.2, y - h * 0.7))], fill=rgba(colr), width=ww)
        self.put(lay, 0)

    def arrow(self, pts, col=RED, w=4, head=14, alpha=235):
        self.line(pts, col, w, alpha, 2, 1.0)
        (x1, y1), (x2, y2) = pts[-2], pts[-1]; a = math.atan2(y2 - y1, x2 - x1)
        for da in (2.55, -2.55): self.line([(x2, y2), (x2 + head * math.cos(a + da), y2 + head * math.sin(a + da))], col, w, alpha, 1, 0.5)

    def xmark(self, x, y, r, col=RED, w=4.5):
        self.line([(x - r, y - r), (x + r, y + r)], col, w, 240, 2, 0.8); self.line([(x - r, y + r), (x + r, y - r)], col, w, 240, 2, 0.8)

    def write(self, x, y, s, size=30, col=INK, halo=True, anchor='la'):
        lay = self.layer(); d = ImageDraw.Draw(lay); f = ImageFont.truetype(HAND, int(size * SS))
        if halo: d.text((x * SS, y * SS), s, font=f, fill=rgba(col), anchor=anchor, stroke_width=int(4.5 * SS), stroke_fill=rgba(WHITE, 225))
        else: d.text((x * SS, y * SS), s, font=f, fill=rgba(col), anchor=anchor)
        self.put(lay, 0)

    def note(self, x, y, s, tx, ty, size=28, col=INK):
        """a handwritten note at (tx, ty) with a loose curved leader ending in a dot at (x, y)"""
        mx, my = (x + tx) / 2 + (ty - y) * 0.18, (y + ty) / 2 - (tx - x) * 0.18
        pts = [((1 - t) ** 2 * tx + 2 * (1 - t) * t * mx + t * t * x, (1 - t) ** 2 * ty + 2 * (1 - t) * t * my + t * t * y) for t in [i / 14 for i in range(15)]]
        self.line(pts, col, 1.8, 210, 1, 0.6, streak=0)
        lay = self.layer(); ImageDraw.Draw(lay).ellipse(self.S([(x - 4, y - 4), (x + 4, y + 4)]), fill=rgba(col)); self.put(lay, 0)
        self.write(tx, ty - size * 1.05, s, size, col)

    def title(self, head, sub, col=RED):
        lay = self.layer(); d = ImageDraw.Draw(lay)
        top = [(0, 0), (self.W, 0)] + [(x, 74 + 4 * math.sin(x / 37) + self.rnd.uniform(-1.5, 1.5)) for x in range(self.W, -1, -12)]
        d.polygon(self.S(top), fill=rgba(WHITE, 235)); self.put(lay, 0)
        self.write(22, 6, head, 40, col, halo=False)
        self.write(24, 48, sub, 19, INK, halo=False)

    def foot(self, s):
        self.write(12, self.H - 26, s, 16, WHITE, halo=False)

    def save(self, name):
        out = self.im.convert('RGB'); out.save(os.path.join(OUT, name + '.jpg'), quality=92); return out


def corridor_poly():
    right = list(reversed(FENCE[:8]))
    left = [(lerp_poly(ROAD_R, y) + 8 * sc(y), y) for y in range(821, 200, -40)]
    return left + right


def fence(sk, col=INK, w=4.5):
    sk.line(FENCE, col, w, 235, 2, 0.8)
    sk.line(along(FENCE, 120, 0), WHITE, 1.5, 240, 1, 0.2, dash=(9, 8), streak=0)


def river_water(sk):
    """the river as water: a blue marker band, white wavy lines (the Dílar's bed; dry most of the year)"""
    sk.fill(band(RIVER, 15, 22), WATER, 175, 6, 15, 5, outline=WATER3, ow=1.6)
    for off in (-4, 5): sk.line(along(RIVER, 70, off), WHITE, 1.6, 210, 1, 2.2, dash=(14, 10), streak=0)


def zebra(sk, y):
    s = sc(y); h = 26 * s + 4
    for k in range(7):
        t = (k + 0.5) / 7
        l, r = lerp_poly(ROAD_L, y), lerp_poly(ROAD_R, y); lt, rt = lerp_poly(ROAD_L, y - h), lerp_poly(ROAD_R, y - h)
        sk.line([(l + (r - l) * t, y), (lt + (rt - lt) * t, y - h)], WHITE, max(2.5, 9 * s), 245, 1, 0.4, streak=0.15)
    for yy in (y + 3, y - h - 3): sk.line([(lerp_poly(ROAD_L, yy), yy), (lerp_poly(ROAD_R, yy), yy)], RED, 3, 235, 1, 0.6)


# ============================================ TODAY ==========================================================================
def today():
    sk = Sketch(1); sk.title('the west edge today · Río Dílar', 'ring road · the river bed (dry most of the year) · cycle path · fence · the closed base')
    fence(sk, INK, 5)
    river_water(sk)
    for y in (700, 470, 300): sk.xmark((lerp_poly(ROAD_L, y) + lerp_poly(ROAD_R, y)) / 2, y - 8, 12 * sc(y) + 6)
    sk.write(735, 690, 'no crossing', 26, RED)
    sk.arrow([(1880, 705), (1500, 548), (1210, 418)], WHITE, 3.5, 14)
    sk.note(1060, 585, 'the river: no way in', 1120, 795, 32)
    sk.note(1560, 552, 'the fence · 8.7 km · nobody’s place', 1340, 300, 30)
    sk.note(600, 420, 'walking = beside the cars', 120, 330, 30)
    sk.write(1560, 700, 'cycle path along the fence, nothing else', 24, INK)
    sk.write(1560, 200, 'THE BASE · closed', 32, INK)
    sk.foot('owner’s photo · sketch drawn by eye, schematic · exercise 2.2, west edge')
    return sk.save('W_0_today')


# ============================================ RESIDENTS ======================================================================
def residents(steps=False):
    sk = Sketch(2); fr = []
    sk.title('residents · the river becomes a park', '“The Dílar already runs along the fence: give us its banks — a river park we can walk to and along, with no new homes.”')
    fence(sk, INK, 3.5)
    sk.fill(corridor_poly(), LEAF, 105, 9, -34, 7, over=4)
    if steps: fr.append(sk.im.copy())
    river_water(sk)
    sk.fill(band(RIVER, 34, 46), OLIVE2, 70, 11, 30, 4, over=2)
    for x, y in along(RIVER, 24, 26) + along(RIVER, 20, -28): sk.tree(x + sk.rnd.uniform(-6, 6), y + sk.rnd.uniform(-4, 4))
    if steps: fr.append(sk.im.copy())
    walk = along(TRACK, 60, -10)
    sk.line(walk, WHITE, 10, 240, 2, 0.8, streak=0.25)
    sk.line(along(walk, 120, 6), RED, 1.6, 220, 1, 0.5, dash=(10, 7), streak=0)
    for x, y in along(TRACK, 16, -27): sk.tree(x, y, 1.1)
    for (x, y), b in zip(along(TRACK, 8, -9)[1:], (False, True, False, True, False, True, False)): sk.person(x, y, b)
    if steps: fr.append(sk.im.copy())
    for a, b in (((870, 690), (1330, 470)), ((640, 405), (1020, 300))):
        s = sc(a[1]); sk.line([a, b], INK, 13 * s + 6, 200, 1, 0.5, streak=0); sk.line([a, b], WHITE, 10 * s + 3, 245, 1, 0.5, streak=0.15)
        sk.line([a, b], RED, 1.8, 230, 1, 0.5, dash=(6, 4), streak=0)
    zebra(sk, 718); zebra(sk, 418)
    sk.line([(560, 690), (760, 705)], WHITE, 5, 235, 1, 0.6, dash=(9, 7))
    sk.person(620, 700); sk.person(700, 712, True)
    if steps: fr.append(sk.im.copy())
    px, py = 1205, 402; s = sc(py); w, h = 70 * s, 30 * s
    sk.fill([(px - w, py), (px + w, py - 12 * s), (px + w, py - 12 * s - h), (px - w, py - h)], RED, 230, 4, 90, 4, outline=INK, ow=1.6, over=0)
    sk.fill([(px - w, py - h), (px + w, py - 12 * s - h), (px + w * 0.8, py - 30 * s - h), (px - w * 1.15, py - 18 * s - h)], DARK, 230, 4, 20, 4, outline=INK, ow=1.4, over=0)
    for k in range(5): sk.person(px - w * 1.4 + k * w * 0.6, py + 6, k % 2 == 1)
    sk.note(1080, 600, 'banks replanted · the channel left as it is', 1130, 805, 30)
    sk.note(1180, 470, 'riverside walk + trees', 1380, 330, 30)
    sk.note(1060, 640, 'footbridges', 1270, 712, 28)
    sk.note(780, 705, 'new crossings', 140, 610, 30, RED)
    sk.note(px, py - h, 'rest stop: water, shade, toilets', 1320, 215, 28)
    sk.write(40, 722, '0 new homes · the base stays', 36, RED)
    sk.foot('owner’s photo · the residents’ proposal drawn by eye over it, schematic (sheets 2.2-RW 01 and 02)')
    if steps: fr.append(sk.im.copy())
    return sk.save('W_1_residents'), fr


# ============================================ DEVELOPER ======================================================================
def block(sk, cx, cy, Lm, floors, dashed=False, shop=False):
    s = sc(cy); px = 15 * s
    ux, uy = -0.53, -0.85; vx, vy = 1.0, 0.18
    L, D, H = Lm * px * 0.2, 12 * px, floors * 3 * px * 0.6
    c = [(cx - ux * L / 2 - vx * D / 2, cy - uy * L / 2 - vy * D / 2), (cx - ux * L / 2 + vx * D / 2, cy - uy * L / 2 + vy * D / 2),
         (cx + ux * L / 2 + vx * D / 2, cy + uy * L / 2 + vy * D / 2), (cx + ux * L / 2 - vx * D / 2, cy + uy * L / 2 - vy * D / 2)]
    t = [(x, y - H) for x, y in c]
    if dashed:
        for a, b in [(t[0], t[1]), (t[1], t[2]), (t[2], t[3]), (t[3], t[0]), (c[0], t[0]), (c[1], t[1]), (c[2], t[2]), (c[0], c[1]), (c[1], c[2])]:
            sk.line([a, b], RED, 2.2, 230, 1, 0.6, dash=(8, 6), streak=0)
        return
    sk.fill([c[0], c[1], t[1], t[0]], RED, 225, 4.5, 90, 5, over=1)
    sk.fill([c[1], c[2], t[2], t[1]], DARK, 225, 4.5, 60, 5, over=1)
    sk.fill(t, ROSE, 210, 5, 20, 5, over=1)
    for f in range(1, floors):
        yy = f * 3 * px * 0.6
        sk.line([(c[0][0] + 3, c[0][1] - yy), (c[1][0] - 3, c[1][1] - yy)], WHITE, 1.2, 170, 1, 0.4, dash=(7, 5), streak=0)
    if shop: sk.line([(c[0][0], c[0][1] - 2.2 * px * 0.6), (c[1][0], c[1][1] - 2.2 * px * 0.6)], WHITE, 3 * s + 1, 235, 1, 0.4, streak=0.1)
    for a, b in [(t[0], t[1]), (t[1], t[2]), (t[2], t[3]), (t[3], t[0]), (c[0], t[0]), (c[1], t[1]), (c[2], t[2]), (c[0], c[1]), (c[1], c[2])]:
        sk.line([a, b], INK, 1.6, 225, 2, 0.6, streak=0)


def developer(steps=False):
    sk = Sketch(3); fr = []
    sk.title('developer · build the corridor', '“The metro reaches an empty strip beside a base the regional plan wants dismantled: build here, now on the strip and later on the base.”')
    fence(sk, INK, 3.5)
    river_water(sk)
    for (y0, y1) in ((800, 600), (560, 420), (390, 280)):
        l0, l1 = lerp_poly(ROAD_R, y0) + 30 * sc(y0), lerp_poly(ROAD_R, y1) + 30 * sc(y1)
        sk.fill([(l0, y0), (l0 + 230 * sc(y0), y0), (l1 + 230 * sc(y1), y1), (l1, y1)], TINT, 150, 7, 25, 5)
    for x, y in along([(lerp_poly(ROAD_R, y) + 190 * sc(y), y) for y in range(800, 260, -20)], 12): sk.tree(x, y, 0.8)
    if steps: fr.append(sk.im.copy())
    for x, y in [(1450, 340), (1700, 390), (1380, 240), (1620, 275), (1860, 310)]: block(sk, x, y, 60, 5, dashed=True)
    if steps: fr.append(sk.im.copy())
    for cy in (300, 390, 500, 640): block(sk, lerp_poly(ROAD_R, cy) + 70 * sc(cy), cy, 40, 6, shop=True)
    for k, y in enumerate((690, 560, 430)): sk.person(lerp_poly(ROAD_R, y) + 12 * sc(y), y, k == 1)
    if steps: fr.append(sk.im.copy())
    sk.note(760, 560, '6 floors · shops on the road · ≈171 homes', 70, 560, 30, RED)
    sk.note(980, 760, 'private garden courts over parking', 1130, 805, 28)
    sk.note(1500, 260, 'phase 2 — only if the base leaves', 1290, 135, 28, RED)
    sk.note(1050, 580, 'river kept at 20 m (our assumption)', 1250, 690, 28)
    sk.write(40, 722, 'public park here: 0', 36, RED)
    sk.foot('owner’s photo · the developer’s proposal drawn by eye over it, schematic (sheets 2.2-DW 01 and 02)')
    if steps: fr.append(sk.im.copy())
    return sk.save('W_2_developer'), fr


# ============================================ DEFENCE ========================================================================
def defence(steps=False):
    sk = Sketch(4); fr = []
    sk.title('defence · keep the edge open and watched', '“Armilla trains the Air Force’s helicopter pilots and stays: the towns may grow, but the edge under the approach stays low, open and quiet.”')
    sk.fill(corridor_poly(), KHAKI, 120, 10, -38, 6, over=4)
    for x, y in along(corridor_poly()[:16], 5, 120): sk.xmark(x, y, 9 * sc(y) + 4, RED, 3.2)
    river_water(sk)
    if steps: fr.append(sk.im.copy())
    fence(sk, INK, 6)
    sk.fill(along(FENCE, 40, 3) + list(reversed(along(FENCE, 40, 16))), WHITE, 210, 5, 60, 4, over=1)
    inner = along(FENCE, 60, 18); sk.line(inner, RED, 3.4, 240, 2, 0.6)
    for x, y in along(FENCE, 30, 18): sk.xmark(x, y, 2.5 + 3 * sc(y), RED, 1.4)
    sk.line(along(FENCE, 60, 30), DARK, 9, 230, 1, 0.5)
    if steps: fr.append(sk.im.copy())
    for x, y in along(FENCE, 6, 42)[:5]:
        s = sc(y); h = 120 * s
        sk.line([(x, y), (x, y - h)], RED, 2.5 + 2 * s, 240, 1, 0.3)
        sk.fill([(x - 8 * s - 2, y - h - 7 * s - 2), (x + 8 * s + 2, y - h - 7 * s - 2), (x + 8 * s + 2, y - h + 3), (x - 8 * s - 2, y - h + 3)], RED, 240, 2, 0, 3, over=0)
        sk.fill([(x, y - h), (x - 34 * s, y - h + 50 * s), (x + 34 * s, y - h + 50 * s)], LEAF, 80, 6, 0, 3, over=0)
    if steps: fr.append(sk.im.copy())
    sk.note(900, 650, 'open land: crops or meadow · no buildings, no gatherings', 60, 600, 30, RED)
    sk.note(1600, 520, 'the fence stays', 1640, 770, 30)
    sk.note(1400, 410, 'clear zone 6 m · inner fence · patrol road 4 m', 1150, 235, 28, RED)
    sk.note(1150, 300, 'masts: lights and cameras', 800, 205, 28)
    sk.write(40, 722, 'the 2019 easements stay', 34, RED)
    sk.foot('owner’s photo · the Ministry of Defence’s proposal drawn by eye over it, schematic (sheets 2.2-MW 01 and 02)')
    if steps: fr.append(sk.im.copy())
    return sk.save('W_3_defence'), fr


if __name__ == '__main__':
    t = today()
    for name, fn in (('residents', residents), ('developer', developer), ('defence', defence)):
        final, frames = fn(steps=True)
        seq = [t] + [f.convert('RGB') for f in frames] + [final] * 3
        small = [im.resize((im.width // 2, im.height // 2), Image.LANCZOS) for im in seq]
        small[0].save(os.path.join(OUT, f'W_{name}_buildup.gif'), save_all=True, append_images=small[1:], duration=1100, loop=0)
        print(name, len(seq), 'frames')
