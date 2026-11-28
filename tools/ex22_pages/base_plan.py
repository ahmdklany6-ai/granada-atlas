"""Presentation · a drawn plan of the Armilla base and the towns around it, in the manner of the owner's examples (owner, 28 Nov 2026:
"a beautiful, tidy map: topographic lines, lighter shading, take an aerial photo and copy everything onto the map — land division,
a texture for everything, houses, roads — in different shades, light and dark, like the examples"; the examples are only a
manner: greys, white buildings with a dark edge, textured fields, roads as pale bands).
Layers, bottom to top:
  the aerial photo (IGN PNOA, current) turned into flat tones: grey, smoothed, posterised into 6 light greys (the land's own
  pattern of fields, orchards, bare ground; nothing invented); a light hillshade (IGN MDT25); contours every 5 m (index 25 m);
  field textures — fine parallel lines in each Catastro rustic parcel, the angle along the parcel's long side, density from its
  tone in the photo; Catastro parcel lines; the base inside the fence a shade darker, the fence a black line;
  water (OSM); roads as pale bands with a darker edge, wider by class (OSM); the metro extension (OSM);
  buildings (Catastro) white with a dark edge and a short shadow to the south-east.
Data: <scratch>/frames/ALL.json (built by tools/build_ex22_frame.py for the whole base: Catastro buildings and parcels, OSM
streets, land use, water, base outline, fence) and data/terrain/dem_mdt25.bin. No values are invented; the tones come from the photo.
Writes <out>/base_plan.png (square, 1 px = 0.75 m) and base_plan_small.jpg.
Usage: python3 tools/ex22_pages/base_plan.py <ALL.json> <out dir>
Not part of the site or of the tests."""
import os, sys, json, math, io, urllib.request, urllib.parse
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageOps
from shapely.geometry import Polygon, MultiPolygon, LineString, box
from scipy import ndimage

SRC, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
F = json.load(open(SRC))
X0, Y0, X1, Y1 = F['frame']
RES = 0.75                                                   # metres per pixel
W, H = int((X1 - X0) / RES), int((Y1 - Y0) / RES)
px = lambda x, y: ((x - X0) / RES, (Y1 - y) / RES)
print('canvas', W, H)


# ---- 1. the aerial photo as flat tones
def ortho():
    fp = os.path.join(OUT, 'pnoa.png')
    if os.path.exists(fp): return Image.open(fp).convert('L')
    im = Image.new('L', (W // 2, H // 2)); TS = 1200; k = (W // 2) / (X1 - X0)
    for ty in range(0, H // 2, TS):
        for tx in range(0, W // 2, TS):
            tw, th = min(TS, W // 2 - tx), min(TS, H // 2 - ty)
            bb = (X0 + tx / k, Y1 - (ty + th) / k, X0 + (tx + tw) / k, Y1 - ty / k)
            q = dict(SERVICE='WMS', VERSION='1.3.0', REQUEST='GetMap', LAYERS='OI.OrthoimageCoverage', STYLES='', CRS='EPSG:25830',
                     BBOX='%.2f,%.2f,%.2f,%.2f' % bb, WIDTH=tw, HEIGHT=th, FORMAT='image/jpeg')
            with urllib.request.urlopen('https://www.ign.es/wms-inspire/pnoa-ma?' + urllib.parse.urlencode(q), timeout=240) as r:
                im.paste(Image.open(io.BytesIO(r.read())).convert('L'), (tx, ty))
    im.save(fp); return im


ph = ortho().resize((W, H), Image.BICUBIC)
g = np.asarray(ph.filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.GaussianBlur(2)), float)
g = (g - np.percentile(g, 2)) / (np.percentile(g, 98) - np.percentile(g, 2)); g = np.clip(g, 0, 1)
levels = np.array([0.0, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0])
tone = np.digitize(g, levels[1:-1])                          # 0..5
GREYS = np.array([186, 200, 212, 222, 231, 240], float)      # dark photo → darker grey, all light
base_t = GREYS[tone]

# ---- 2. hillshade (light) and contours
man = json.load(open(os.path.join(ROOT, 'data', 'manifest.json')))['terrain']['dem']
dem = np.fromfile(os.path.join(ROOT, 'data', man['file']), '<i2').reshape(man['height'], man['width']).astype(np.float32)
c0, c1 = (X0 - man['ox']) / man['px'], (X1 - man['ox']) / man['px']; r0, r1 = (man['oy'] - Y1) / man['py'], (man['oy'] - Y0) / man['py']
demi = Image.fromarray(dem, 'F').transform((W, H), Image.EXTENT, (c0, r0, c1, r1), Image.BICUBIC)
D = ndimage.gaussian_filter(np.asarray(demi, np.float32), 6)
gy, gx = np.gradient(D, RES)
slope = np.arctan(np.hypot(gx, gy) * 3); asp = np.arctan2(-gx, gy)
hs = np.sin(math.radians(40)) * np.cos(slope) + np.cos(math.radians(40)) * np.sin(slope) * np.cos(math.radians(315) - asp)
shade = np.clip(0.80 + 0.20 * hs / max(hs.max(), 1e-6), 0.80, 1.0)
img = base_t * (0.55 + 0.45 * shade)                         # shading lightened (owner: less)
cont = np.zeros((H, W), bool); cidx = np.zeros((H, W), bool)
for step, arr in ((5, cont), (25, cidx)):
    q = np.floor(D / step)
    e = (q != np.roll(q, 1, 0)) | (q != np.roll(q, 1, 1))
    arr |= e
img = np.where(cont, img * 0.86, img); img = np.where(cidx, img * 0.78, img)
canvas = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'L').convert('RGB')
d = ImageDraw.Draw(canvas, 'RGBA')


def rings(r):
    """the rings of one of the frame's polygons ([[ring, holes...]] or [ring...])"""
    out = []
    def walk(o):
        if o and isinstance(o[0], (int, float)): return
        if o and isinstance(o[0][0], (int, float)): out.append(o); return
        for q in o: walk(q)
    walk(r); return out


def poly_of(r):
    rs = rings(r)
    try: return Polygon(rs[0], rs[1:]).buffer(0) if rs else None
    except Exception: return None


# ---- 3. field textures in the rustic parcels (lines along the parcel, density from the photo tone)
FR = box(X0, Y0, X1, Y1)
gsmall = Image.fromarray((g * 255).astype(np.uint8))
rng = np.random.default_rng(3)
built = [poly_of(b['r']) for b in F['buildings']]
for pr in F['parcels']:
    p = poly_of(pr)
    if p is None or p.is_empty or p.area < 1500 or p.area > 400000: continue
    mr = p.minimum_rotated_rectangle; cs = list(mr.exterior.coords)
    e1 = (cs[1][0] - cs[0][0], cs[1][1] - cs[0][1]); e2 = (cs[2][0] - cs[1][0], cs[2][1] - cs[1][1])
    ux, uy = e1 if math.hypot(*e1) > math.hypot(*e2) else e2; n = math.hypot(ux, uy); ux, uy = ux / n, uy / n
    c = p.representative_point(); tx, ty = px(c.x, c.y)
    if not (0 <= tx < W and 0 <= ty < H): continue
    t = g[int(ty), int(tx)]
    if t < 0.12: continue                                     # very dark (trees, buildings): no lines
    gap = 3.0 + 6.0 * t                                       # darker field → denser lines (metres)
    L = math.hypot(*e1) + math.hypot(*e2)
    nx, ny = -uy, ux; k = rng.uniform(0, gap)
    lines = []
    for s in np.arange(-L, L, gap):
        a = (c.x + nx * (s + k) - ux * L, c.y + ny * (s + k) - uy * L); b = (c.x + nx * (s + k) + ux * L, c.y + ny * (s + k) + uy * L)
        seg = LineString([a, b]).intersection(p.buffer(-1.5))
        for sg in ([seg] if seg.geom_type == 'LineString' else [q for q in getattr(seg, 'geoms', []) if q.geom_type == 'LineString']):
            if sg.length > 3: lines.append([px(*xy) for xy in sg.coords])
    alpha = int(40 + 50 * (1 - t))
    for l in lines: d.line(l, fill=(90, 90, 90, alpha), width=1)
# parcel lines
for pr in F['parcels']:
    for r in rings(pr): d.line([px(*xy) for xy in r], fill=(120, 120, 120, 150), width=1)

# ---- 4. the base: a shade darker inside the fence, the fence black
base = poly_of(F['base'])
mask = Image.new('L', (W, H), 0); md = ImageDraw.Draw(mask)
for r in rings(F['base']): md.polygon([px(*xy) for xy in r], fill=255)
# owner (28 Nov, with three samples): inside the base, bare soil as white with sparse black specks, grass as grey mottling with
# specks, and the darkest ground (dense vegetation) as flat light-grey patches with a thin edge. The three classes come from the
# photo's own tones inside the fence (quantiles), so the pattern follows the real ground.
M_ = np.asarray(mask) > 0
gs = ndimage.gaussian_filter(g, 5)
q1, q2 = np.quantile(gs[M_], [0.18, 0.55])
patch = M_ & (gs < q1); grass = M_ & (gs >= q1) & (gs < q2); soil = M_ & (gs >= q2)
patch = ndimage.binary_opening(ndimage.binary_closing(patch, iterations=4), iterations=3)
R_ = np.random.default_rng(11)
tex = np.full((H, W), 248.0)
mott = ndimage.gaussian_filter(R_.random((H, W)), 2.2) + 0.6 * ndimage.gaussian_filter(R_.random((H, W)), 5)   # grass: grey blobs, mixed sizes
mott = (mott - mott[M_].mean()) / mott[M_].std()
tex = np.where(grass & (mott > 0.35), 205 + 15 * R_.random((H, W)), tex)
tex = np.where(grass & (mott > 1.3), 180, tex)
spk = R_.random((H, W))
tex = np.where(soil & (spk > 0.993), 75 + 60 * R_.random((H, W)), tex)       # soil: dark specks of varied tone
tex = np.where(grass & (spk > 0.995), 90, tex)
spk2 = ndimage.binary_dilation(M_ & ~patch & (spk > 0.9988))                # larger specks
tex = np.where(spk2, 60, tex)
tex = np.where(patch, 222 + 4 * ndimage.gaussian_filter(R_.random((H, W)), 3), tex)
edge = patch & ~ndimage.binary_erosion(patch, iterations=2)
tex = np.where(edge, 150, tex)
texim = Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8), 'L').convert('RGB')
canvas = Image.composite(texim, canvas, mask); d = ImageDraw.Draw(canvas, 'RGBA')

# ---- 5. water, roads, metro
for w in F.get('water', []):
    wd = 7 if w.get('ww') == 'river' else 3
    for r in rings(w['r']): d.line([px(*xy) for xy in r], fill=(150, 175, 190, 255), width=wd, joint='curve')
RW = {'motorway': 26, 'trunk': 22, 'primary': 18, 'secondary': 15, 'tertiary': 12, 'residential': 9, 'unclassified': 8, 'living_street': 8,
      'service': 5, 'track': 4, 'footway': 2, 'path': 2, 'cycleway': 3, 'pedestrian': 5}
st = sorted(F['streets'], key=lambda s: RW.get(s.get('hw'), 6))
for casing in (True, False):
    for s_ in st:
        w_ = RW.get(s_.get('hw'), 6) / RES * 0.75
        if w_ < 2.5 and casing: continue
        for r in rings(s_['r']):
            pts = [px(*xy) for xy in r]
            if casing: d.line(pts, fill=(130, 130, 130, 255), width=int(w_ + 3), joint='curve')
            else: d.line(pts, fill=(246, 246, 244, 255) if w_ >= 2.5 else (150, 150, 150, 200), width=max(1, int(w_)), joint='curve')
for m in F.get('metro_ext', []):
    for r in rings(m['r']): d.line([px(*xy) for xy in r], fill=(40, 40, 40, 255), width=3)

# ---- 6. buildings: white, dark edge, a short shadow to the south-east
sh = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(sh)
for b in F['buildings']:
    lv = b.get('lv') or 1; off = min(2.5 + 1.2 * lv, 9) / RES
    for r in rings(b['r'])[:1]: sd.polygon([(x + off * 0.7, y + off * 0.7) for x, y in (px(*xy) for xy in r)], fill=110)
sh = sh.filter(ImageFilter.GaussianBlur(2))
canvas = Image.composite(Image.new('RGB', (W, H), (60, 60, 60)), canvas, sh); d = ImageDraw.Draw(canvas, 'RGBA')
for b in F['buildings']:
    rs = rings(b['r'])
    if not rs: continue
    d.polygon([px(*xy) for xy in rs[0]], fill=(252, 252, 250, 255), outline=(45, 45, 45, 255))
# the fence on top
for r in rings(F['base']): d.line([px(*xy) for xy in r], fill=(20, 20, 20, 255), width=4, joint='curve')

# scale bar (500 m)
bw = 500 / RES; bx, by = W - bw - 120, H - 110
d.rectangle([bx - 30, by - 30, bx + bw + 120, by + 70], fill=(255, 255, 255, 220))
for i in range(5): d.rectangle([bx + i * bw / 5, by, bx + (i + 1) * bw / 5, by + 14], fill=(20, 20, 20) if i % 2 == 0 else (255, 255, 255), outline=(20, 20, 20))
from PIL import ImageFont
fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 34)
d.text((bx, by + 22), '0', font=fnt, fill=(60, 60, 60)); d.text((bx + bw - 30, by + 22), '500 m', font=fnt, fill=(60, 60, 60))
canvas.save(os.path.join(OUT, 'base_plan.png'), optimize=True)
canvas.resize((W // 3, H // 3), Image.LANCZOS).save(os.path.join(OUT, 'base_plan_small.jpg'), quality=90)
print('written', os.path.join(OUT, 'base_plan.png'))
