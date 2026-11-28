"""Presentation · the base map in pure black and white, in the manner of the owner's example (owner, 28 Nov 2026: a 1960s land-use
plan of an Italian town — white paper, thin black contours, black rivers, hatched and dotted areas; "this shows the place; later
we work on the same map with transparencies and mark in red what we want; don't mark the base in red").
Nothing in colour, no grey fills: every tone comes from line or dot density.
  paper white · contours every 10 m (index 50 m slightly heavier), black, thin · rivers black, by size ·
  farmland (OSM land use parcels in the frame file): fine 45° hatch · built-up: every building solid black ·
  roads: main roads as two black lines (a white band), minor roads one thin line · metro line 1 and its extension: a heavy line ·
  the base: a heavy fence line; inside, bare ground as sparse specks and grass as fine stipple (classes from the photo's tones,
  as in base_plan.py) · names in black.
Usage: python3 tools/ex22_pages/bw_plan.py <frame.json> <pnoa cache png of that frame> <out dir>
  env RES (m/px, default 2.1167 = 300 dpi at 1:25,000), FONT_DIR (IBM Plex Sans), A1=1 also writes an A1 PDF at 1:25,000.
Not part of the site or of the tests."""
import os, sys, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage
from shapely.geometry import Polygon, shape
from pyproj import Transformer
Image.MAX_IMAGE_PIXELS = None

FRM, PNOA, OUT = sys.argv[1:4]; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
F = json.load(open(FRM)); X0, Y0, X1, Y1 = F['frame']
RES = float(os.environ.get('RES', 2.1167)); W, H = int((X1 - X0) / RES), int((Y1 - Y0) / RES)
px = lambda x, y: ((x - X0) / RES, (Y1 - y) / RES)
k = float(os.environ.get('K', 2.1167 / RES))                      # line widths are set for the A1 print
BLK = 0


def rings(r):
    out = []
    def walk(o):
        if not o or isinstance(o[0], (int, float)): return
        if isinstance(o[0], (list, tuple)) and o[0] and isinstance(o[0][0], (int, float)): out.append(o); return
        for q in o: walk(q)
    walk(r); return out


def mask_of(items, get=lambda it: it):
    m = Image.new('1', (W, H), 0); d = ImageDraw.Draw(m)
    for it in items:
        rs = rings(get(it))
        for j, r in enumerate(rs):
            if len(r) > 2: d.polygon([px(*p) for p in r], fill=0 if j else 1)
    return np.asarray(m, bool)


paper = np.ones((H, W), bool)                                     # True = white
ink = np.zeros((H, W), bool)                                      # True = black

# ---- contours (10 m, index 50 m), thin black, broken every few pixels so they read lighter than the hatches
man = json.load(open(os.path.join(ROOT, 'data', 'manifest.json')))['terrain']['dem']
dem = np.fromfile(os.path.join(ROOT, 'data', man['file']), '<i2').reshape(man['height'], man['width']).astype(np.float32)
c0, c1 = (X0 - man['ox']) / man['px'], (X1 - man['ox']) / man['px']; r0, r1 = (man['oy'] - Y1) / man['py'], (man['oy'] - Y0) / man['py']
D = ndimage.gaussian_filter(np.asarray(Image.fromarray(dem, 'F').transform((W, H), Image.EXTENT, (c0, r0, c1, r1), Image.BICUBIC), np.float32), 4)
q10 = np.floor(D / 10); c10 = (q10 != np.roll(q10, 1, 0)) | (q10 != np.roll(q10, 1, 1))
q50 = np.floor(D / 50); c50 = (q50 != np.roll(q50, 1, 0)) | (q50 != np.roll(q50, 1, 1))
yy, xx = np.mgrid[0:H, 0:W]
dash = ((xx + yy) // 3) % 4 != 0                                  # a fine break pattern: hairlines
ink |= (c10 & dash) | c50

# ---- farmland: fine 45° hatch inside the field parcels
FIELD_LU = ('farmland', 'orchard', 'meadow', 'grass', 'vineyard', 'plant_nursery', 'greenfield')
if F.get('landuse'):   # owner (28 Nov): close up, hatch the farmland only (as on the large map), not every Catastro parcel
    fields = mask_of([lu for lu in F['landuse'] if lu.get('lu') in FIELD_LU], get=lambda lu: lu['r'])
else:
    fields = mask_of(F['parcels'])
gap = max(4, int(round(9 * k)))
hatch = ((xx + yy) % gap) == 0
ink |= fields & hatch

# ---- the base: fence; inside, specks for bare ground, stipple for grass (from the photo)
base = mask_of([F['base']]) if F.get('base') else np.zeros((H, W), bool)
ink &= ~base                                                      # no hatch or contour inside the fence
if base.any() and os.path.exists(PNOA):
    g = np.asarray(Image.open(PNOA).convert('L').resize((W, H), Image.BICUBIC), float) / 255
    gs = ndimage.gaussian_filter(g, 3)
    q1, q2 = np.quantile(gs[base], [0.2, 0.55])
    R = np.random.default_rng(4); rnd = R.random((H, W))
    grass = base & (gs < q2); dense = base & (gs < q1)
    ink |= grass & (rnd > 0.93); ink |= dense & (rnd > 0.86); ink |= base & ~grass & (rnd > 0.992)

# ---- rivers, black by size
im = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8), 'L'); d = ImageDraw.Draw(im)
for w in F.get('water', []):
    ww, nm = w.get('ww'), (w.get('nm') or '')
    wd = 7 if (ww == 'river' or nm.startswith('Río')) else 3 if ww in ('stream', 'canal') else 1
    for r in rings(w['r']): d.line([px(*p) for p in r], fill=BLK, width=max(1, int(wd * k)), joint='curve')

# ---- roads: main as a white band between two black lines, minor as one thin line
MAIN = {'motorway': 13, 'trunk': 11, 'primary': 9, 'secondary': 8, 'tertiary': 6}
MINOR = ('residential', 'unclassified', 'living_street', 'service')
for s_ in F['streets']:
    hw = s_.get('hw')
    if hw in MINOR:
        for r in rings(s_['r']): d.line([px(*p) for p in r], fill=BLK, width=1)
for casing in (True, False):
    for s_ in F['streets']:
        hw = (s_.get('hw') or '').replace('_link', '')
        if hw not in MAIN: continue
        w_ = MAIN[hw] * k * (0.7 if s_.get('hw', '').endswith('_link') else 1)
        for r in rings(s_['r']): d.line([px(*p) for p in r], fill=BLK if casing else 255, width=int(w_ + (3 * k if casing else 0)), joint='curve')

# ---- buildings: white with a black edge and a light shadow towards the north (owner, 28 Nov)
shd = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(shd)
for b in F['buildings']:
    rs = rings(b['r'])
    if not rs or len(rs[0]) < 3: continue
    off = min(3.0 + 1.5 * (b.get('lv') or 1), 10) / RES        # metres, a little longer for taller buildings
    pts = [px(*p) for p in rs[0]]
    for t in np.linspace(0.25, 1, 4): sd.polygon([(x, y - off * t) for x, y in pts], fill=255)
shd = shd.filter(ImageFilter.GaussianBlur(max(1, 0.6 / RES)))
im = Image.composite(Image.new('L', (W, H), 200), im, shd); d = ImageDraw.Draw(im)
for b in F['buildings']:
    rs = rings(b['r'])
    if rs and len(rs[0]) > 2: d.polygon([px(*p) for p in rs[0]], fill=255, outline=BLK)

# ---- metro: a heavy black line with white stop dots
T = Transformer.from_crs(4326, 25830, always_xy=True)
L1 = json.load(open(os.path.join(ROOT, 'data', 'ex21', 'metro_l1.json')))
lines = [[T.transform(*p) for p in ln] for ln in L1['lines'] if len(ln) > 1]
for f in json.load(open(os.path.join(ROOT, 'data', 'vec', 'south_metro.json')))['features']:
    if f['geometry']['type'] == 'LineString': lines.append([T.transform(*p) for p in f['geometry']['coordinates']])
for ln in lines: d.line([px(*p) for p in ln], fill=255, width=int(14 * k), joint='curve')
for ln in lines: d.line([px(*p) for p in ln], fill=BLK, width=int(8 * k), joint='curve')
for s in L1['stops']:
    x, y = px(*T.transform(*s['lonlat'])); r = 5 * k
    d.ellipse([x - r, y - r, x + r, y + r], fill=255, outline=BLK, width=max(1, int(2.5 * k)))

# ---- the fence, heavy
for r in rings(F['base']) if F.get('base') else []:
    d.line([px(*p) for p in r], fill=BLK, width=int(7 * k), joint='curve')

# ---- names
FD = os.environ.get('FONT_DIR', '')
font = lambda b, s: ImageFont.truetype(os.path.join(FD, 'IBMPlexSans-SemiBold.ttf' if b else 'IBMPlexSans-Regular.ttf') if FD else '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), int(s * k))


NAME = int(os.environ.get('NAME_GREY', 110))   # owner (28 Nov): names in grey (NAME_GREY=255 with no halo would be white)


def label(x, y, t, size, bold, sp=0):
    f = font(bold, size); w = sum(d.textlength(c, font=f) for c in t) + sp * k * (len(t) - 1)
    hw = w / 2 + 16 * k; x = min(max(x, hw), W - hw); y = min(max(y, 40 * k), H - 40 * k); xx = x - w / 2
    for c in t:
        d.text((xx, y), c, font=f, fill=NAME, anchor='lm', stroke_width=int(7 * k), stroke_fill=255); xx += d.textlength(c, font=f) + sp * k


from shapely.geometry import box
from shapely import transform as st_
to = lambda g: st_(g, lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
for f in json.load(open(os.path.join(ROOT, 'data', 'vec', 'tour_towns.json')))['features']:
    g = to(shape(f['geometry'])).buffer(0); ins = g.intersection(box(X0, Y0, X1, Y1))
    if ins.is_empty or ins.area < 0.05 * g.area: continue
    c = (g if ins.area > 0.6 * g.area else ins).representative_point(); X, Y = px(c.x, c.y)
    label(X, Y, f['properties']['nm'].upper(), 44, True, 4)
OTHER = {'Santa Fe': (-3.7186, 37.1886), 'Albolote': (-3.6555, 37.2306), 'Peligros': (-3.6283, 37.2333), 'Maracena': (-3.6337, 37.2073),
         'Pulianas': (-3.6100, 37.2240), 'Atarfe': (-3.6890, 37.2230), 'Vegas del Genil': (-3.6830, 37.1745), 'Cúllar Vega': (-3.6700, 37.1550),
         'Huétor Vega': (-3.5700, 37.1490), 'Cájar': (-3.5730, 37.1350), 'La Zubia': (-3.5850, 37.1200), 'Monachil': (-3.5420, 37.1330),
         'Gójar': (-3.6000, 37.1080), 'Cenes de la Vega': (-3.5340, 37.1600), 'Pinos Genil': (-3.5130, 37.1625), 'Otura': (-3.6350, 37.0930)}
for n, ll in OTHER.items():
    X, Y = px(*T.transform(*ll))
    if 0 < X < W and 0 < Y < H: label(X, Y, n, 32, False)
gx, gy = px(*T.transform(-3.5986, 37.1773))
if 0 < gx < W and 0 < gy < H: label(gx, gy, 'GRANADA', 110, True, 12)   # only when the city centre is in the frame

# ---- scale bar 2 km
bw = (2000 if RES > 1.5 else 500) / RES; bx, by = W - bw - 60 * k, H - 70 * k
for i in range(4): d.rectangle([bx + i * bw / 4, by, bx + (i + 1) * bw / 4, by + 8 * k], fill=BLK if i % 2 == 0 else 255, outline=BLK)
f = font(False, 26); d.text((bx, by + 30 * k), '0', font=f, fill=BLK, anchor='mm'); d.text((bx + bw, by + 30 * k), '2 km' if RES > 1.5 else '500 m', font=f, fill=BLK, anchor='mm')

im.save(os.path.join(OUT, 'bw_plan.png'), optimize=True)
im.resize((W // 6, H // 6), Image.LANCZOS).save(os.path.join(OUT, 'bw_small.jpg'), quality=88)
if os.environ.get('A1') == '1':
    dpi = 300; mm = lambda v: int(round(v / 25.4 * dpi))
    SC = float(os.environ.get('SCALE', 25000)) / 1000   # metres on the ground per mm on paper
    page = Image.new('L', (mm(841), mm(594)), 255); mw, mh = mm((X1 - X0) / SC), mm((Y1 - Y0) / SC)
    page.paste(im.resize((mw, mh), Image.LANCZOS), ((page.width - mw) // 2, (page.height - mh) // 2))
    page.save(os.path.join(OUT, 'bw_A1_1-%d.pdf' % int(SC * 1000)), resolution=dpi)
print('written', OUT)
