"""Exercise 2.2 · marker sketches of the three alternatives over the owner's aerial photo of the west edge (Río Dílar between the
ring road Las Gabias–Alhendín and the base's fence), owner, 24 Nov 2026 — the manner of the reference video he sent (a photo with
the proposal drawn over it in marker, step by step), nothing copied. Black, white and the studio red over the grey photo.
What is drawn follows the 2.2 west-edge sheets (tools/ex22_pages/edges.py, AREA=W): residents = river park; developer = 6-floor
blocks between the road and the river, 20 m from it, phase 2 on the base only if it leaves; Defence = the corridor kept open and a
security band inside the fence. Everything is SCHEMATIC and placed by eye on the photo (perspective, not measured).
The photo is the owner's and is NOT committed; pass its path.
Usage: python3 tools/ex22_pages/sketch_w.py <photo> <out folder>   → today / residents / developer / defence (+ build-up frames)
Not part of the site or of the tests."""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw

PHOTO, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
P = _bw._P; B = P['base']
RED = B['red']; DARK = B['oxblood']; TINT = P['redTint']; WHITE = '#FFFFFF'; INK = B['brown']
SS = 2                                                   # drawn at twice the photo's size
HAND = '/mnt/skills/examples/canvas-design/canvas-fonts/NothingYouCouldDo-Regular.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def rgba(h, a=255): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), a)


def sc(y): return 0.13 + 0.87 * max(0.0, (y - 100)) / 721.0          # perspective scale by image row (1 at the bottom)


def lerp_poly(pts, y):
    """x of a polyline (listed bottom → top) at row y"""
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        if (y1 - y) * (y2 - y) <= 0 and y1 != y2: return x1 + (x2 - x1) * (y - y1) / (y2 - y1)
    return pts[-1][0] if y < pts[-1][1] else pts[0][0]


# ---- the photo's lines, placed by eye (image px, bottom → top) ----------------------------------------------------------
ROAD_L = [(770, 821), (690, 650), (620, 500), (560, 350), (505, 220), (470, 160), (440, 118)]
ROAD_R = [(960, 821), (840, 650), (705, 500), (592, 350), (522, 220), (482, 160), (455, 118)]
RIVER = [(1450, 821), (1350, 740), (1200, 660), (1050, 580), (900, 500), (800, 420), (720, 320), (650, 230), (600, 175)]
TRACK = [(1916, 690), (1700, 615), (1500, 535), (1300, 452), (1150, 383), (1050, 322), (995, 262), (982, 212), (930, 176), (800, 142), (650, 120)]
FENCE = [(1916, 640), (1700, 565), (1500, 485), (1350, 418), (1200, 352), (1100, 302), (1035, 252), (1012, 207), (972, 172), (860, 142), (720, 120)]


class Sketch:
    def __init__(self):
        self.base = Image.open(PHOTO).convert('RGB')
        self.W, self.H = self.base.size
        self.im = self.base.resize((self.W * SS, self.H * SS), Image.LANCZOS).convert('RGBA')
        self.rnd = random.Random(7)

    def layer(self): return Image.new('RGBA', self.im.size, (0, 0, 0, 0))
    def put(self, lay): self.im = Image.alpha_composite(self.im, lay)
    def S(self, pts): return [(x * SS, y * SS) for x, y in pts]

    def marker(self, pts, col, w, alpha=230, passes=2, jit=1.2, dash=None):
        """a marker stroke: a few slightly shifted passes of a polyline (width w in photo px)"""
        lay = self.layer(); d = ImageDraw.Draw(lay)
        for k in range(passes):
            q = [(x + self.rnd.uniform(-jit, jit), y + self.rnd.uniform(-jit, jit)) for x, y in pts]
            if dash:
                for a, b in zip(q, q[1:]): self._dashed(d, a, b, col, w, alpha, dash)
            else:
                d.line(self.S(q), fill=rgba(col, alpha if k == 0 else int(alpha * 0.55)), width=max(1, int(w * SS)), joint='curve')
        self.put(lay)

    def _dashed(self, d, a, b, col, w, alpha, dash):
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(L / (dash[0] + dash[1])))
        for i in range(n + 1):
            t0 = i * (dash[0] + dash[1]) / max(L, 1e-6); t1 = min(1, t0 + dash[0] / max(L, 1e-6))
            if t0 >= 1: break
            p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0); p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            d.line(self.S([p0, p1]), fill=rgba(col, alpha), width=max(1, int(w * SS)))

    def hatch(self, poly, col, alpha=150, step=9, ang=-35, w=2.2, fill_alpha=0):
        """marker hatching inside a polygon (photo px)"""
        mask = Image.new('L', self.im.size, 0); ImageDraw.Draw(mask).polygon(self.S(poly), fill=255)
        lay = self.layer(); d = ImageDraw.Draw(lay)
        if fill_alpha: d.polygon(self.S(poly), fill=rgba(col, fill_alpha))
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]; cx, cy = sum(xs) / len(xs), sum(ys) / len(ys); R = max(max(xs) - min(xs), max(ys) - min(ys))
        a = math.radians(ang); ux, uy = math.cos(a), math.sin(a)
        t = -R
        while t < R:
            ox, oy = cx - uy * t, cy + ux * t
            p0 = (ox - ux * R + self.rnd.uniform(-3, 3), oy - uy * R); p1 = (ox + ux * R, oy + uy * R + self.rnd.uniform(-3, 3))
            d.line(self.S([p0, p1]), fill=rgba(col, alpha), width=max(1, int(w * SS)))
            t += step * (0.8 + 0.4 * self.rnd.random())
        out = self.layer(); out.paste(lay, (0, 0), mask); self.put(out)

    def blob(self, x, y, r, fill, line, alpha=225, lw=1.6):
        """a scribbled tree crown seen from above/oblique: a wobbly loop, a fill, a second loop"""
        lay = self.layer(); d = ImageDraw.Draw(lay)
        for k, (f, a) in enumerate(((fill, int(alpha * 0.85)), (None, alpha))):
            pts = []
            n = 14; ph = self.rnd.uniform(0, 6.3)
            for i in range(n + 1):
                ang = ph + i * 2 * math.pi / n; rr = r * (0.82 + 0.3 * self.rnd.random())
                pts.append((x + math.cos(ang) * rr, y + math.sin(ang) * rr * 0.78))
            if f: d.polygon(self.S(pts), fill=rgba(f, a))
            d.line(self.S(pts), fill=rgba(line, alpha), width=max(1, int(lw * SS)), joint='curve')
        self.put(lay)

    def tree(self, x, y):
        s = sc(y); r = 15 * s + 3
        self.marker([(x, y), (x, y - r * 0.9)], INK, max(1.2, 2.2 * s), 220, 1, 0.3)
        self.blob(x, y - r * 1.25, r, WHITE, RED, 235, 1.2 + 1.2 * s)

    def person(self, x, y, col=WHITE, bike=False):
        s = sc(y); h = 26 * s + 5
        lay = self.layer(); d = ImageDraw.Draw(lay); S = lambda p: (p[0] * SS, p[1] * SS); w = max(2, int(2.6 * s * SS))
        hx, hy = x, y - h
        d.ellipse([S((hx - h * 0.12, hy - h * 0.12)), S((hx + h * 0.12, hy + h * 0.12))], fill=rgba(col), outline=rgba(INK, 200), width=1)
        d.line([S((hx, hy + h * 0.12)), S((hx, y - h * 0.45))], fill=rgba(col), width=w)
        if bike:
            r = h * 0.22
            for bx in (x - h * 0.3, x + h * 0.3): d.ellipse([S((bx - r, y - 2 * r)), S((bx + r, y))], outline=rgba(col), width=max(2, w // 2))
            d.line([S((x - h * 0.3, y - r)), S((x, y - h * 0.45)), S((x + h * 0.3, y - r))], fill=rgba(col), width=max(2, w // 2))
        else:
            d.line([S((hx, y - h * 0.45)), S((x - h * 0.14, y))], fill=rgba(col), width=w); d.line([S((hx, y - h * 0.45)), S((x + h * 0.14, y))], fill=rgba(col), width=w)
        d.line([S((hx - h * 0.2, y - h * 0.68)), S((hx + h * 0.2, y - h * 0.62))], fill=rgba(col), width=w)
        self.put(lay)

    def cross(self, x, y, r, col=RED, w=5):
        self.marker([(x - r, y - r), (x + r, y + r)], col, w, 235, 2, 1.5); self.marker([(x - r, y + r), (x + r, y - r)], col, w, 235, 2, 1.5)

    def arrow(self, pts, col=RED, w=4.5, head=16, alpha=235):
        self.marker(pts, col, w, alpha, 2, 1.0)
        (x1, y1), (x2, y2) = pts[-2], pts[-1]; a = math.atan2(y2 - y1, x2 - x1)
        for da in (2.6, -2.6): self.marker([(x2, y2), (x2 + head * math.cos(a + da), y2 + head * math.sin(a + da))], col, w, alpha, 1, 0.6)

    def text(self, x, y, s, size=34, col=RED, font=HAND, halo=True, anchor='la'):
        lay = self.layer(); d = ImageDraw.Draw(lay); f = ImageFont.truetype(font, int(size * SS))
        if halo: d.text((x * SS, y * SS), s, font=f, fill=rgba(col), anchor=anchor, stroke_width=int(5 * SS), stroke_fill=rgba(WHITE, 235))
        else: d.text((x * SS, y * SS), s, font=f, fill=rgba(col), anchor=anchor)
        self.put(lay)

    def label(self, x, y, s, tx, ty, size=30, col=RED):
        """a handwritten label at (tx, ty) with a curved leader to (x, y)"""
        mx, my = (x + tx) / 2 + (ty - y) * 0.15, (y + ty) / 2 - (tx - x) * 0.15
        pts = [((1 - t) ** 2 * tx + 2 * (1 - t) * t * mx + t * t * x, (1 - t) ** 2 * ty + 2 * (1 - t) * t * my + t * t * y) for t in [i / 16 for i in range(17)]]
        self.marker(pts, col, 2.2, 220, 1, 0.3)
        self.marker([(x - 4, y), (x + 4, y)], col, 7, 235, 1, 0)
        self.text(tx, ty - size * 1.05, s, size, col)

    def title(self, head, sub):
        lay = self.layer(); d = ImageDraw.Draw(lay)
        d.rectangle([0, 0, self.im.size[0], 70 * SS], fill=rgba(WHITE, 228))
        self.put(lay)
        self.text(22, 12, head, 28, RED, SANS, halo=False)
        self.text(22, 45, sub, 15, INK, SANS, halo=False)

    def foot(self, s):
        lay = self.layer(); d = ImageDraw.Draw(lay); f = ImageFont.truetype(SANS.replace('-Bold', ''), int(11 * SS))
        d.text((10 * SS, (self.H - 8) * SS), s, font=f, fill=rgba(WHITE, 235), anchor='ls', stroke_width=int(3 * SS), stroke_fill=rgba(INK, 200)); self.put(lay)

    def save(self, name, frames=None):
        out = self.im.convert('RGB'); out.save(os.path.join(OUT, name + '.jpg'), quality=92)
        return out


def road_band(y0, y1, inset=0.0):
    """the road surface between rows y0 > y1 (a quad) — for zebra crossings"""
    l0, r0, l1, r1 = lerp_poly(ROAD_L, y0), lerp_poly(ROAD_R, y0), lerp_poly(ROAD_L, y1), lerp_poly(ROAD_R, y1)
    return [(l0, y0), (r0, y0), (r1, y1), (l1, y1)]


def zebra(sk, y):
    s = sc(y); h = 26 * s + 4
    for k in range(7):
        t = (k + 0.5) / 7
        l, r = lerp_poly(ROAD_L, y), lerp_poly(ROAD_R, y); lt, rt = lerp_poly(ROAD_L, y - h), lerp_poly(ROAD_R, y - h)
        x0, x1 = l + (r - l) * t, lt + (rt - lt) * t
        sk.marker([(x0, y), (x1, y - h)], WHITE, max(2.5, 9 * s), 240, 1, 0.4)
    sk.marker([(lerp_poly(ROAD_L, y), y + 3), (lerp_poly(ROAD_R, y), y + 3)], RED, 3, 230, 1, 0.6)
    sk.marker([(lerp_poly(ROAD_L, y - h), y - h - 3), (lerp_poly(ROAD_R, y - h), y - h - 3)], RED, 3, 230, 1, 0.6)


def along(pts, n, off=0.0):
    """n points spread along a polyline, shifted 'off' px to its right (image space)"""
    seg = [(a, b, math.hypot(b[0] - a[0], b[1] - a[1])) for a, b in zip(pts, pts[1:])]; L = sum(s[2] for s in seg); out = []
    for i in range(n):
        t = (i + 0.5) / n * L
        for a, b, l in seg:
            if t <= l:
                f = t / l; x, y = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f; nx, ny = -(b[1] - a[1]) / l, (b[0] - a[0]) / l
                out.append((x + nx * off * sc(y), y + ny * off * sc(y))); break
            t -= l
    return out


def fence(sk, strong=False):
    sk.marker(FENCE, INK, 5 if strong else 3.5, 235, 1, 0.3)
    sk.marker(FENCE, WHITE, 1.6 if strong else 1.2, 240, 1, 0.0, dash=(10, 9))


def corridor_poly():
    """the open land between the road and the fence (photo px)"""
    right = list(reversed(FENCE[:8]))
    left = [(lerp_poly(ROAD_R, y) + 8 * sc(y), y) for y in range(821, 200, -40)]
    return left + right


# ============================================ TODAY: the edge as it is =====================================================
def today():
    sk = Sketch(); sk.title('THE WEST EDGE TODAY · RÍO DÍLAR', 'ring road · dry river bed · cycle path · fence · the closed base (Armilla Air Base)')
    fence(sk, True)
    sk.marker(RIVER, WHITE, 3, 220, 2, 1.5, dash=(14, 10))
    sk.label(1060, 585, 'Río Dílar: a dry bed, no way in', 1120, 790, 30)
    sk.label(1560, 552, 'the fence: 8.7 km, nobody’s place', 1380, 300, 30)
    sk.label(600, 420, 'ring road: walking = beside the cars', 120, 330, 30)
    for y in (700, 470, 300): sk.cross((lerp_poly(ROAD_L, y) + lerp_poly(ROAD_R, y)) / 2, y - 8, 14 * sc(y) + 6)
    sk.text(735, 690, 'no crossing', 24, RED)
    sk.arrow([(1880, 700), (1500, 545), (1200, 410)], WHITE, 3.5, 14)
    sk.text(1380, 760, 'cycle path along the fence, nothing else', 24, WHITE)
    sk.label(1600, 300, 'THE BASE · closed', 1600, 230, 30, INK)
    sk.foot('Owner\'s photo · sketch drawn by eye, schematic · Exercise 2.2, west edge')
    return sk.save('W_0_today')


# ============================================ RESIDENTS: a river park =====================================================
def residents(steps=False):
    sk = Sketch(); sk.title('RESIDENTS · THE RIVER BECOMES A PARK', '“The Dílar already runs along the fence: give us its banks — a river park we can walk to and along, with no new homes.”')
    frames = []
    fence(sk)
    sk.hatch(corridor_poly(), TINT, 105, 11, -32, 2.2)                          # the river park (the whole corridor)
    if steps: frames.append(sk.im.copy())
    sk.marker(RIVER, WHITE, 3, 220, 2, 1.5, dash=(14, 10))
    for x, y in along(RIVER, 26, 22) + along(RIVER, 22, -24): sk.tree(x + sk.rnd.uniform(-6, 6), y)   # the banks replanted
    if steps: frames.append(sk.im.copy())
    walk = [(x, y) for x, y in along(TRACK, 40, -10)]
    sk.marker(walk, WHITE, 9, 235, 1, 0.4); sk.marker(walk, RED, 2.2, 230, 1, 0.4)    # the riverside walk on the fence side
    for x, y in along(TRACK, 14, -26): sk.tree(x, y)
    for (x, y), b in zip(along(TRACK, 7, -9)[1:], (False, True, False, True, False, True)): sk.person(x, y, WHITE, b)
    if steps: frames.append(sk.im.copy())
    for a, b in (((870, 690), (1330, 470)), ((640, 405), (1020, 300))):           # footbridges over the river, to crossings
        s = sc(a[1]); sk.marker([a, b], WHITE, 10 * s + 4, 240, 1, 0.3); sk.marker([a, b], RED, 2.2, 235, 1, 0.3, dash=(6, 4))
    zebra(sk, 718); zebra(sk, 418)
    sk.marker([(560, 690), (760, 705)], WHITE, 5, 230, 1, 0.5, dash=(9, 7))         # from the orchard path to the crossing
    if steps: frames.append(sk.im.copy())
    px, py = 1205, 402; s = sc(py); w, h = 70 * s, 30 * s                          # the rest stop, 1 floor
    lay = sk.layer(); d = ImageDraw.Draw(lay)
    d.polygon(sk.S([(px - w, py), (px + w, py - 12 * s), (px + w, py - 12 * s - h), (px - w, py - h)]), fill=rgba(RED, 235))
    d.polygon(sk.S([(px - w, py - h), (px + w, py - 12 * s - h), (px + w * 0.8, py - 30 * s - h), (px - w * 1.15, py - 18 * s - h)]), fill=rgba(DARK, 235))
    sk.put(lay)
    sk.label(1080, 600, 'banks replanted · the channel untouched', 1150, 800, 30)
    sk.label(1180, 470, 'riverside walk 3 m + trees', 1350, 330, 30)
    sk.label(1060, 640, 'footbridges', 1250, 700, 28)
    sk.label(780, 705, 'new crossings', 120, 600, 30)
    sk.label(px, py - h, 'rest stop: water, shade, toilets (1 floor)', 1330, 210, 28)
    sk.text(40, 725, '0 new homes · the base stays', 34, RED)
    sk.foot('Owner\'s photo · residents\' proposal drawn by eye over it, schematic (2.2-RW plan 1:1000 and section 1:500)')
    if steps: frames.append(sk.im.copy())
    return sk.save('W_1_residents'), frames


# ============================================ DEVELOPER: build the corridor ===============================================
def block(sk, cx, cy, Lm, floors, alpha=235, dashed=False, shop=False):
    """a block in rough perspective: footprint along the road direction, extruded up"""
    s = sc(cy); px = 15 * s                                              # ~15 px per metre at the bottom of the photo
    ux, uy = -0.53, -0.85; vx, vy = 1.0, 0.18                              # along the road / across it, in the image
    L, D, H = Lm * px * 0.2, 12 * px, floors * 3 * px * 0.6    # the road recedes (lengths along it foreshortened); seen from above, heights shrink too
    c = [(cx - ux * L / 2 - vx * D / 2, cy - uy * L / 2 - vy * D / 2), (cx - ux * L / 2 + vx * D / 2, cy - uy * L / 2 + vy * D / 2),
         (cx + ux * L / 2 + vx * D / 2, cy + uy * L / 2 + vy * D / 2), (cx + ux * L / 2 - vx * D / 2, cy + uy * L / 2 - vy * D / 2)]
    t = [(x, y - H) for x, y in c]
    lay = sk.layer(); d = ImageDraw.Draw(lay)
    if dashed:
        for a, b in [(t[0], t[1]), (t[1], t[2]), (t[2], t[3]), (t[3], t[0]), (c[0], t[0]), (c[1], t[1]), (c[0], c[1])]:
            sk._dashed(d, a, b, RED, 2.2, 230, (8, 6))
        sk.put(lay); return
    d.polygon(sk.S([c[0], c[1], t[1], t[0]]), fill=rgba(RED, alpha))                 # the face to the viewer
    d.polygon(sk.S([c[1], c[2], t[2], t[1]]), fill=rgba(DARK, alpha))                # the side
    d.polygon(sk.S(t), fill=rgba(TINT, alpha))                                       # the roof
    for f in range(1, floors):                                                       # floor lines
        y = f * 3 * px
        d.line(sk.S([(c[0][0], c[0][1] - y), (c[1][0], c[1][1] - y)]), fill=rgba(WHITE, 150), width=max(1, int(1.2 * SS)))
    if shop: d.line(sk.S([(c[0][0], c[0][1] - 2.2 * px), (c[1][0], c[1][1] - 2.2 * px)]), fill=rgba(WHITE, 240), width=max(2, int(3 * s * SS)))
    for a, b in [(t[0], t[1]), (t[1], t[2]), (t[2], t[3]), (t[3], t[0]), (c[0], t[0]), (c[1], t[1]), (c[2], t[2]), (c[0], c[1]), (c[1], c[2])]:
        d.line(sk.S([a, b]), fill=rgba(INK, 220), width=max(1, int(1.3 * SS)))
    sk.put(lay)


def developer(steps=False):
    sk = Sketch(); sk.title('DEVELOPER · BUILD THE CORRIDOR', '“The metro reaches an empty strip beside a base the regional plan wants dismantled: build here, now on the strip and later on the base.”')
    frames = []
    fence(sk)
    sk.marker(RIVER, WHITE, 3, 220, 2, 1.5, dash=(14, 10))
    for (y0, y1) in ((805, 600), (560, 420), (390, 280)):                            # garden courts over parking
        l0, l1 = lerp_poly(ROAD_R, y0) + 30 * sc(y0), lerp_poly(ROAD_R, y1) + 30 * sc(y1)
        sk.hatch([(l0, y0), (l0 + 230 * sc(y0), y0), (l1 + 230 * sc(y1), y1), (l1, y1)], TINT, 120, 10, 20, 2)
    if steps: frames.append(sk.im.copy())
    for x, y in [(1450, 340), (1700, 390), (1380, 240), (1620, 275), (1860, 310)]:   # phase 2 on the base
        block(sk, x, y, 60, 5, dashed=True)
    if steps: frames.append(sk.im.copy())
    for cy, Lm in ((300, 40), (390, 40), (500, 40), (640, 40)):                      # blocks along the road, 6 floors
        cx = lerp_poly(ROAD_R, cy) + 70 * sc(cy)
        block(sk, cx, cy, Lm, 6, shop=True)
    if steps: frames.append(sk.im.copy())
    sk.label(760, 560, '6 floors, shops on the road · ≈171 homes', 90, 560, 30)
    sk.label(980, 760, 'garden courts over parking (private)', 1150, 800, 28)
    sk.label(1500, 260, 'phase 2: only if the base leaves', 1300, 130, 28)
    sk.label(1050, 580, 'river kept at 20 m (our assumption)', 1250, 680, 28)
    sk.text(40, 720, 'public park here: 0', 34, RED)
    sk.foot('Owner\'s photo · developer\'s proposal drawn by eye over it, schematic (2.2-DW plan 1:1000 and section 1:500)')
    if steps: frames.append(sk.im.copy())
    return sk.save('W_2_developer'), frames


# ============================================ DEFENCE: open and watched ===================================================
def defence(steps=False):
    sk = Sketch(); sk.title('DEFENCE · KEEP THE EDGE OPEN AND WATCHED', '“Armilla trains the Air Force’s helicopter pilots and stays: the towns may grow, but the edge under the approach stays low, open and quiet.”')
    frames = []
    sk.hatch(corridor_poly(), RED, 120, 13, -40, 2.0); sk.hatch(corridor_poly(), RED, 90, 13, 40, 1.6)   # kept open: crossed hatch
    if steps: frames.append(sk.im.copy())
    fence(sk, True)
    inner = [(x, y) for x, y in along(FENCE, 40, 18)]                                  # inside: clear zone, inner fence, patrol road
    clear = along(FENCE, 40, 3) + list(reversed(along(FENCE, 40, 16)))
    sk.hatch(clear, WHITE, 200, 6, 60, 1.6)
    sk.marker(inner, RED, 3.5, 235, 1, 0.3)
    for x, y in along(FENCE, 26, 18): sk.cross(x, y, 3 + 3 * sc(y), RED, 1.6)
    road = along(FENCE, 40, 30); sk.marker(road, DARK, 9, 225, 1, 0.3)
    if steps: frames.append(sk.im.copy())
    for x, y in along(FENCE, 6, 40)[:5]:                                               # masts: lights and cameras (~8 m)
        s = sc(y); h = 120 * s
        sk.marker([(x, y), (x, y - h)], RED, 2.5 + 2 * s, 240, 1, 0.2)
        lay = sk.layer(); d = ImageDraw.Draw(lay); d.rectangle(sk.S([(x - 7 * s - 2, y - h - 6 * s - 2), (x + 7 * s + 2, y - h + 3)]), fill=rgba(RED)); sk.put(lay)
        sk.marker([(x, y - h), (x - 30 * s, y - h + 45 * s)], RED, 1.2, 140, 1, 0.2); sk.marker([(x, y - h), (x + 30 * s, y - h + 45 * s)], RED, 1.2, 140, 1, 0.2)
    if steps: frames.append(sk.im.copy())
    sk.label(900, 650, 'open land: no buildings, no gatherings', 90, 600, 30)
    sk.label(1600, 520, 'the fence stays', 1640, 760, 30, INK)
    sk.label(1400, 410, 'clear zone 6 m · inner fence · patrol road 4 m', 1180, 230, 28)
    sk.label(1150, 300, 'masts: lights and cameras', 820, 200, 28)
    sk.text(40, 725, 'the 2019 easements stay (RD 118/2019)', 30, RED)
    sk.foot('Owner\'s photo · Defence\'s proposal drawn by eye over it, schematic (2.2-MW plan 1:1000 and section 1:500)')
    if steps: frames.append(sk.im.copy())
    return sk.save('W_3_defence'), frames


if __name__ == '__main__':
    t = today()
    for name, fn in (('residents', residents), ('developer', developer), ('defence', defence)):
        final, frames = fn(steps=True)
        seq = [t] + [f.convert('RGB') for f in frames] + [final] * 3                    # a build-up like the reference: today, then layer by layer
        small = [im.resize((im.width // 2, im.height // 2), Image.LANCZOS) for im in seq]
        small[0].save(os.path.join(OUT, f'W_{name}_buildup.gif'), save_all=True, append_images=small[1:], duration=1100, loop=0)
        print(name, len(seq), 'frames')
