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
RES = float(os.environ.get('RES', 0.75))                     # metres per pixel
W, H = int((X1 - X0) / RES), int((Y1 - Y0) / RES)
px = lambda x, y: ((x - X0) / RES, (Y1 - y) / RES)
print('canvas', W, H)


# ---- 1. the aerial photo as flat tones
def ortho():
    fp = os.path.join(OUT, 'pnoa_%d_%d.png' % (X0, Y0))
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
FAR = RES >= 2                                                # zoomed out (owner): lighter everywhere, contours clearer, more of a map
if FAR: GREYS = np.array([212, 222, 230, 237, 243, 248], float)
if os.environ.get('LIGHTER') == '1': GREYS = np.array([226, 233, 239, 244, 248, 252], float)   # owner (28 Nov): every grey lighter
base_t = GREYS[tone]
MAP = os.environ.get('MAPSTYLE') in ('1', '2'); MID = os.environ.get('MAPSTYLE') == '2'   # 2: owner's middle way   # owner (28 Nov): "people say it looks like an aerial photo": the photo only classifies,
if MAP: base_t = np.full((H, W), 252.0 if MID else 246.0)    # every area is drawn flat with one texture per kind of land

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
img = base_t * ((0.93 + 0.07 * shade) if MAP else (0.72 + 0.28 * shade) if FAR else (0.55 + 0.45 * shade))
if os.environ.get('LIGHTER') == '1': img = base_t * (0.84 + 0.16 * shade)   # shading lightened (owner: less, and less again zoomed out)
cont = np.zeros((H, W), bool); cidx = np.zeros((H, W), bool)
for step, arr in ((5, cont), (25, cidx)):
    q = np.floor(D / step)
    e = (q != np.roll(q, 1, 0)) | (q != np.roll(q, 1, 1))
    arr |= e
if FAR:   # contours clearer: 10 m lines, 50 m index, thicker
    cont = np.zeros((H, W), bool); cidx = np.zeros((H, W), bool)
    for step, arr in ((10, cont), (50, cidx)):
        q = np.floor(D / step); arr |= (q != np.roll(q, 1, 0)) | (q != np.roll(q, 1, 1))
    img = np.where(cont | cidx, img * 0.80, img)   # owner (28 Nov): every contour as light as the 10 m ones
else:
    img = np.where(cont, img * 0.86, img); img = np.where(cidx, img * 0.78, img)
canvas = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'L').convert('RGB')
d = ImageDraw.Draw(canvas, 'RGBA')


def rings(r):
    """the rings of one of the frame's polygons ([[ring, holes...]] or [ring...])"""
    out = []
    def walk(o):
        if o and isinstance(o[0], (int, float)): return
        if o and isinstance(o[0], (list, tuple)) and o[0] and isinstance(o[0][0], (int, float)): out.append(o); return
        if o and isinstance(o[0], (list, tuple)) and not o[0]: return
        for q in o: walk(q)
    walk(r); return out


def poly_of(r):
    rs = rings(r)
    try: return Polygon(rs[0], rs[1:]).buffer(0) if rs else None
    except Exception: return None


# ---- 3. field textures in the rustic parcels (lines along the parcel, density from the photo tone)
FR = box(X0, Y0, X1, Y1)
if MAP:
    # each parcel's kind: OSM land use where mapped, else from the photo inside it (mean tone, roughness) and building cover
    lab = Image.new('I', (W, H), 0); ld = ImageDraw.Draw(lab); polys = []
    for i, pr in enumerate(F['parcels'], 1):
        p = poly_of(pr)
        if p is None or p.is_empty: polys.append(None); continue
        polys.append(p)
        for j, r in enumerate(rings(pr)): ld.polygon([px(*xy) for xy in r], fill=i if j == 0 else 0)
    L_ = np.asarray(lab, np.int32); n_ = len(F['parcels'])
    bmask = Image.new('L', (W, H), 0); bd = ImageDraw.Draw(bmask)
    for b in F['buildings']:
        rs = rings(b['r'])
        if rs: bd.polygon([px(*xy) for xy in rs[0]], fill=1)
    idx = np.arange(1, n_ + 1)
    mean = ndimage.mean(g, L_, idx); rough = ndimage.standard_deviation(ndimage.gaussian_filter(g, 1), L_, idx)
    bcov = ndimage.mean(np.asarray(bmask, float), L_, idx)
    LUK = {}
    for lu in F.get('landuse', []):
        q = poly_of(lu['r'])
        if q is None: continue
        k_ = {'orchard': 'trees', 'forest': 'trees', 'plant_nursery': 'trees', 'farmland': 'crop', 'meadow': 'grass', 'grass': 'grass',
              'greenfield': 'bare', 'brownfield': 'bare', 'construction': 'bare', 'quarry': 'bare'}.get(lu.get('lu'),
              'built' if lu.get('lu') in ('residential', 'industrial', 'commercial', 'retail', 'farmyard', 'cemetery', 'religious', 'railway') else None)
        if k_: LUK[q.representative_point().coords[0]] = (q, k_)
    KIND = np.zeros(n_ + 1, object)
    for i in range(n_):
        p = polys[i]
        if p is None: continue
        kind = None
        c = p.representative_point()
        for (q, k_) in LUK.values():
            if q.contains(c): kind = k_; break
        if kind is None or kind == 'crop':
            if bcov[i] > 0.18: kind = 'built'
            elif mean[i] < 0.22 and rough[i] > 0.07: kind = 'trees'
            elif mean[i] < 0.62: kind = 'crop'
            elif mean[i] < 0.80: kind = 'grass'
            else: kind = 'bare'
        KIND[i + 1] = kind
    FILL = {'trees': 230, 'crop': 237, 'grass': 242, 'bare': 247, 'built': 249}
    fill = np.full(n_ + 1, 246.0)
    for i in range(1, n_ + 1):
        if KIND[i]: fill[i] = FILL[KIND[i]]
    if MID:   # owner (28 Nov): "a middle way" and "it is grey, not black and white": each parcel one flat tone from its own photo
        TONES = np.array([206.0, 224.0, 240.0, 252.0])        # (four steps, light), white paper, black lines; no circles
        for i in range(1, n_ + 1):
            if KIND[i] == 'built' or not KIND[i]: fill[i] = 252.0
            else: fill[i] = TONES[min(3, int(np.nan_to_num(mean[i - 1], nan=0.9) / 0.25))]
    shade_m = (0.96 + 0.04 * shade) if MID else (0.93 + 0.07 * shade)
    img2 = np.where(L_ > 0, fill[L_] * shade_m, base_t * shade_m)
    img2 = np.where(cont | cidx, img2 * (0.80 if FAR else 0.86), img2)
    canvas = Image.fromarray(np.clip(img2, 0, 255).astype(np.uint8), 'L').convert('RGB'); d = ImageDraw.Draw(canvas, 'RGBA')
    R2 = np.random.default_rng(5); sc_ = (2.2 if FAR else 1.0)
    for i in range(1, n_ + 1):
        p, kind = polys[i - 1], KIND[i]
        if p is None or not kind or p.area < 300 * sc_: continue
        mr = p.minimum_rotated_rectangle; cs = list(mr.exterior.coords)
        e1 = (cs[1][0] - cs[0][0], cs[1][1] - cs[0][1]); e2 = (cs[2][0] - cs[1][0], cs[2][1] - cs[1][1])
        ux, uy = e1 if math.hypot(*e1) > math.hypot(*e2) else e2; nn = math.hypot(ux, uy) or 1; ux, uy = ux / nn, uy / nn
        c = p.centroid; L2 = math.hypot(*e1) + math.hypot(*e2); inner = p.buffer(-1.0 * sc_)
        if inner.is_empty: continue
        if MID and kind != 'crop': continue                     # middle way: only crops keep fine lines, sparse
        if kind in ('crop', 'grass'):                          # parallel lines along the parcel, one density per kind
            gap = ((7.0 if kind == 'crop' else 9.0) if MID else (4.0 if kind == 'crop' else 9.0)) * sc_
            for s_ in np.arange(-L2, L2, gap):
                a_ = (c.x - uy * s_ - ux * L2, c.y + ux * s_ - uy * L2); b_ = (c.x - uy * s_ + ux * L2, c.y + ux * s_ + uy * L2)
                seg = LineString([a_, b_]).intersection(inner)
                for sg in ([seg] if seg.geom_type == 'LineString' else [q for q in getattr(seg, 'geoms', []) if q.geom_type == 'LineString']):
                    if sg.length > 2: d.line([px(*xy) for xy in sg.coords], fill=(30, 30, 30, 70) if MID else (120, 120, 120, 120 if kind == 'crop' else 80), width=1)
        elif kind == 'trees':                                  # trees: dots on a grid along the parcel
            gap = 7.0 * sc_; rr = max(1.2, 2.2 / RES)
            from shapely.geometry import Point as _Pt
            from shapely.prepared import prep as _prep
            pin = _prep(inner)
            for s_ in np.arange(-L2, L2, gap):
                for t_ in np.arange(-L2, L2, gap):
                    x_, y_ = c.x + ux * t_ - uy * s_, c.y + uy * t_ + ux * s_
                    if pin.contains(_Pt(x_, y_)):
                        X_, Y_ = px(x_, y_); d.ellipse([X_ - rr, Y_ - rr, X_ + rr, Y_ + rr], outline=(120, 120, 120, 170), width=1)
        elif kind == 'bare':                                   # bare ground: sparse specks
            from shapely.geometry import Point as _Pt
            x0_, y0_, x1_, y1_ = inner.bounds; npt = int(inner.area / (40 * sc_ * sc_))
            for _ in range(npt):
                x_, y_ = R2.uniform(x0_, x1_), R2.uniform(y0_, y1_)
                if inner.contains(_Pt(x_, y_)):
                    X_, Y_ = px(x_, y_); d.point((X_, Y_), fill=(90, 90, 90, 200))
    for pr in F['parcels']:                                    # every parcel with a clear edge
        for r in rings(pr): d.line([px(*xy) for xy in r], fill=(25, 25, 25, 190) if MID else (140, 140, 140, 200), width=1)
    print('parcel kinds:', {k_: int(sum(1 for q in KIND[1:] if q == k_)) for k_ in FILL})
gsmall = Image.fromarray((g * 255).astype(np.uint8))
rng = np.random.default_rng(3)
built = [poly_of(b['r']) for b in F['buildings']]
for pr in ([] if MAP else F['parcels']):
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
    alpha = int((25 + 30 * (1 - t)) if FAR else (40 + 50 * (1 - t)))
    for l in lines: d.line(l, fill=(90, 90, 90, alpha), width=1)
# parcel lines
for pr in ([] if MAP else F['parcels']):
    for r in rings(pr): d.line([px(*xy) for xy in r], fill=(120, 120, 120, 150), width=1)

# ---- 4. the base: a shade darker inside the fence, the fence black
base = poly_of(F['base'])
mask = Image.new('L', (W, H), 0); md = ImageDraw.Draw(mask)
for r in rings(F['base']): md.polygon([px(*xy) for xy in r], fill=255)
# owner (28 Nov, with three samples): inside the base, bare soil as white with sparse black specks, grass as grey mottling with
# specks, and the darkest ground (dense vegetation) as flat light-grey patches with a thin edge. The three classes come from the
# photo's own tones inside the fence (quantiles), so the pattern follows the real ground.
M_ = np.asarray(mask) > 0
if not M_.any(): M_[0, 0] = True                              # no base in this frame
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
    ww, nm = w.get('ww'), (w.get('nm') or '')
    LR = os.environ.get('RIVER_LIGHT') == '1'                   # owner (28 Nov, later): the rivers a little lighter
    if os.environ.get('RIVER_BLACK') == '1':                      # owner (28 Nov, later still): rivers in black
        wd, col = (8, (25, 25, 25, 255)) if (ww == 'river' or nm.startswith('Río')) else (3, (40, 40, 40, 255)) if ww in ('stream', 'canal') else (1, (60, 60, 60, 220))
        for r in rings(w['r']): d.line([px(*xy) for xy in r], fill=col, width=wd, joint='curve')
        continue
    if ww == 'river' or nm.startswith('Río'): wd, col = 10, (125, 162, 184, 255) if LR else (88, 133, 160, 255)   # owner (28 Nov): rivers clearer
    elif ww in ('stream', 'canal'): wd, col = 4, (148, 182, 200, 255) if LR else (110, 155, 180, 255)
    else: wd, col = 2, (170, 198, 212, 230) if LR else (140, 175, 195, 230)
    for r in rings(w['r']): d.line([px(*xy) for xy in r], fill=col, width=wd, joint='curve')
ROADS_RED = os.environ.get('ROADS_RED') == '1'
RW = {'motorway': 26, 'trunk': 22, 'primary': 18, 'secondary': 15, 'tertiary': 12, 'residential': 9, 'unclassified': 8, 'living_street': 8,
      'service': 5, 'track': 4, 'footway': 2, 'path': 2, 'cycleway': 3, 'pedestrian': 5}
st = sorted(F['streets'], key=lambda s: RW.get(s.get('hw'), 6))
for casing in (True, False):
    for s_ in st:
        w_ = RW.get(s_.get('hw'), 6) / RES * 0.75
        if w_ < 2.5 and casing: continue
        for r in rings(s_['r']):
            pts = [px(*xy) for xy in r]
            if ROADS_RED:   # owner (28 Nov): roads in a light red (palette rose / red tint)
                if casing: d.line(pts, fill=(201, 139, 128, 255), width=int(w_ + 3), joint='curve')
                else: d.line(pts, fill=(240, 222, 216, 255) if w_ >= 2.5 else (201, 139, 128, 210), width=max(1, int(w_)), joint='curve')
            elif casing: d.line(pts, fill=(130, 130, 130, 255), width=int(w_ + 3), joint='curve')
            else: d.line(pts, fill=(246, 246, 244, 255) if w_ >= 2.5 else (150, 150, 150, 200), width=max(1, int(w_)), joint='curve')
for m in F.get('metro_ext', []):
    for r in rings(m['r']): d.line([px(*xy) for xy in r], fill=(40, 40, 40, 255), width=3)

# ---- 6. buildings: white, dark edge, a short shadow to the south-east
sh = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(sh)
for b in F['buildings']:
    lv = b.get('lv') or 1; off = min(2.5 + 1.2 * lv, 9) / RES
    for r in rings(b['r'])[:1]: sd.polygon([(x + off * 0.7, y + off * 0.7) for x, y in (px(*xy) for xy in r)], fill=110)
sh = sh.filter(ImageFilter.GaussianBlur(2))
if FAR: sh = sh.point(lambda v: v // 3)                      # zoomed out: a faint shadow only
canvas = Image.composite(Image.new('RGB', (W, H), (60, 60, 60)), canvas, sh); d = ImageDraw.Draw(canvas, 'RGBA')
for b in F['buildings']:
    rs = rings(b['r'])
    if not rs: continue
    d.polygon([px(*xy) for xy in rs[0]], fill=(255, 255, 255, 255), outline=(20, 20, 20, 255) if (MAP and MID) else (125, 125, 125, 255) if FAR else (45, 45, 45, 255))   # zoomed out: lighter edges, towns read as texture, not black
# the fence on top
for r in rings(F['base']): d.line([px(*xy) for xy in r], fill=(20, 20, 20, 255), width=4, joint='curve')

# scale bar (500 m); NOSCALE=1 leaves it out (when another drawing puts its own)
if os.environ.get('NOSCALE') != '1':
    bw = (500 if RES < 1.5 else 2000) / RES; bx, by = W - bw - 120, H - 110
    d.rectangle([bx - 30, by - 30, bx + bw + 120, by + 70], fill=(255, 255, 255, 220))
    for i in range(5): d.rectangle([bx + i * bw / 5, by, bx + (i + 1) * bw / 5, by + 14], fill=(20, 20, 20) if i % 2 == 0 else (255, 255, 255), outline=(20, 20, 20))
    from PIL import ImageFont
    fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 34)
    d.text((bx, by + 22), '0', font=fnt, fill=(60, 60, 60)); d.text((bx + bw - 30, by + 22), '500 m' if RES < 1.5 else '2 km', font=fnt, fill=(60, 60, 60))
canvas.save(os.path.join(OUT, 'base_plan.png'), optimize=True)
canvas.resize((W // 3, H // 3), Image.LANCZOS).save(os.path.join(OUT, 'base_plan_small.jpg'), quality=90)
print('written', os.path.join(OUT, 'base_plan.png'))
