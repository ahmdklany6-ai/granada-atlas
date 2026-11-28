"""Presentation · a magnifier on the black-and-white A1 map (bw_plan.py output): a small circle on the Albaicín, two lines to a large
circle in the empty mountains east of the city, and inside the large circle the Albaicín enlarged with every building coloured by
its number of floors — the atlas's own "building floors" layer (owner, 28 Nov 2026, with a sketch).
Floors: OSM building:levels in the repository's tiles (data/vec/buildings, field lv), banded as on the site (js/analysis.js
levelBand: 1–2, 3–4, 5–8, 9+) in the same colours (palette band); buildings with no levels mapped are hatched (shown as missing).
Usage: python3 tools/ex22_pages/albaicin_inset.py <frame.json> <bw_plan.png> <out.png>
  env CENTER (lon,lat of the zoomed spot; default the Albaicín), R_M (radius on the ground, m; default 550), MAG (default 4.5),
  BIG (x,y of the large circle's centre as shares of the sheet; default 0.80,0.38), FONT_DIR, A1=1 (also an A1 PDF at 1:25,000).
Not part of the site or of the tests."""
import os, sys, json, glob, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import shape, Point
from shapely import transform as st_
from pyproj import Transformer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw
Image.MAX_IMAGE_PIXELS = None

FRM, SRC, OUT = sys.argv[1:4]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
X0, Y0, X1, Y1 = json.load(open(FRM))['frame']
im = Image.open(SRC).convert('RGB'); W, H = im.size; RES = (X1 - X0) / W; k = 2.1167 / RES
T = Transformer.from_crs(4326, 25830, always_xy=True)
to = lambda g: st_(g, lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
px = lambda x, y: ((x - X0) / RES, (Y1 - y) / RES)
lon, lat = map(float, os.environ.get('CENTER', '-3.5925,37.1818').split(','))
CX, CY = T.transform(lon, lat); R_M = float(os.environ.get('R_M', 550)); MAG = float(os.environ.get('MAG', 4.5))
bx_, by_ = map(float, os.environ.get('BIG', '0.80,0.38').split(','))
sx, sy = px(CX, CY); sr = R_M / RES                                   # the small circle on the map
BX, BY = bx_ * W, by_ * H; BR = sr * MAG                               # the large circle
s2 = MAG / RES                                                          # px per metre inside the large circle
q = lambda x, y: (BX + (x - CX) * s2, BY - (y - CY) * s2)
BAND = _bw._P['band']; INK = (20, 20, 20)
col = lambda lv: BAND['1-2'] if lv <= 2 else BAND['3-4'] if lv <= 4 else BAND['5-8'] if lv <= 8 else BAND['9+']
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

# ---- the inset, drawn on its own layer and clipped to the circle
L = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(L)
area = Point(CX, CY).buffer(R_M * 1.05)
tile = lambda f: tuple(int(v) * 1000 for v in os.path.basename(f)[:-5].split('_'))
near = lambda f: abs(tile(f)[0] + 500 - CX) < 2000 and abs(tile(f)[1] + 500 - CY) < 2000
for f in [f for f in glob.glob(os.path.join(ROOT, 'data', 'vec', 'streets', '*_*.json')) if near(f)]:
    for ft in json.load(open(f))['features']:
        g = to(shape(ft['geometry']))
        if not g.intersects(area): continue
        w_ = 3 if ft['properties'].get('hw') in ('primary', 'secondary', 'tertiary') else 1
        for ln in ([g] if g.geom_type == 'LineString' else list(getattr(g, 'geoms', []))):
            d.line([q(*c) for c in ln.coords], fill=(150, 150, 150), width=max(1, int(w_ * k)))
for ft in json.load(open(os.path.join(ROOT, 'data', 'vec', 'water.json')))['features']:
    if ft['properties'].get('nm') != 'Río Darro' or ft['geometry']['type'] not in ('LineString', 'MultiLineString'): continue
    g = to(shape(ft['geometry']))
    for ln in ([g] if g.geom_type == 'LineString' else list(g.geoms)):
        d.line([q(*c) for c in ln.coords], fill=(79, 110, 128), width=int(6 * k))
n = nb = 0
for f in [f for f in glob.glob(os.path.join(ROOT, 'data', 'vec', 'buildings', '*_*.json')) if near(f)]:
    for ft in json.load(open(f))['features']:
        g = to(shape(ft['geometry']))
        if not g.intersects(area): continue
        lv = ft['properties'].get('lv')
        polys = [g] if g.geom_type == 'Polygon' else list(getattr(g, 'geoms', []))
        for p in polys:
            pts = [q(*c) for c in p.exterior.coords]
            if lv is not None and float(lv) > 0:
                d.polygon(pts, fill=hexrgb(col(float(lv))), outline=INK); nb += 1
            else:
                d.polygon(pts, fill=(255, 255, 255), outline=INK)
                x0_, y0_ = min(x for x, _ in pts), min(y for _, y in pts); x1_, y1_ = max(x for x, _ in pts), max(y for _, y in pts)
                m = Image.new('1', (int(x1_ - x0_) + 2, int(y1_ - y0_) + 2), 0)
                ImageDraw.Draw(m).polygon([(x - x0_, y - y0_) for x, y in pts], fill=1)
                hat = Image.new('RGB', m.size, (255, 255, 255)); hd = ImageDraw.Draw(hat)
                for t in range(-m.size[1], m.size[0], max(3, int(4 * k))): hd.line([(t, 0), (t + m.size[1], m.size[1])], fill=(120, 120, 120))
                L.paste(hat, (int(x0_), int(y0_)), m)
            n += 1
mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).ellipse([BX - BR, BY - BR, BX + BR, BY + BR], fill=255)

# ---- connectors: the outer tangent lines between the two circles, then both circles
d0 = ImageDraw.Draw(im)
dx, dy = BX - sx, BY - sy; dist = math.hypot(dx, dy); a = math.atan2(dy, dx); b = math.acos((BR - sr) / dist)
for sgn in (1, -1):
    t = a + math.pi + sgn * (math.pi - b)   # normal direction of the tangent
    t = a + sgn * b
    p1 = (sx - sr * math.cos(t), sy - sr * math.sin(t)); p2 = (BX - BR * math.cos(t), BY - BR * math.sin(t))
    d0.line([p1, p2], fill=INK, width=int(6 * k))
im.paste(L, (0, 0), mask)
d0 = ImageDraw.Draw(im)
d0.ellipse([BX - BR, BY - BR, BX + BR, BY + BR], outline=INK, width=int(8 * k))
d0.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], outline=INK, width=int(7 * k))

# ---- label and key beside the large circle
FD = os.environ.get('FONT_DIR', '')
fnt = lambda b, s: ImageFont.truetype(os.path.join(FD, 'IBMPlexSans-SemiBold.ttf' if b else 'IBMPlexSans-Regular.ttf') if FD else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', int(s * k))
kx, ky = BX - BR * 0.62, BY + BR + 40 * k
d0.text((kx, ky), 'ALBAICÍN', font=fnt(True, 52), fill=INK, anchor='lm', stroke_width=int(6 * k), stroke_fill=(255, 255, 255))
ky += 70 * k
for lab, c in (('1–2 floors', BAND['1-2']), ('3–4', BAND['3-4']), ('5–8', BAND['5-8']), ('9+', BAND['9+']), ('not mapped', None)):
    if c: d0.rectangle([kx, ky - 14 * k, kx + 40 * k, ky + 14 * k], fill=hexrgb(c), outline=INK)
    else:
        d0.rectangle([kx, ky - 14 * k, kx + 40 * k, ky + 14 * k], fill=(255, 255, 255), outline=INK)
        for t in range(0, int(40 * k), max(3, int(4 * k))): d0.line([(kx + t, ky + 14 * k), (kx + min(40 * k, t + 28 * k), ky - 14 * k)], fill=(120, 120, 120))
    d0.text((kx + 54 * k, ky), lab, font=fnt(False, 30), fill=INK, anchor='lm'); kx += 54 * k + d0.textlength(lab, font=fnt(False, 30)) + 40 * k
# scale bar of the inset (100 m)
sbw = 100 * s2; sbx, sby = BX + BR * 0.35, BY + BR + 40 * k
d0.rectangle([sbx, sby - 5 * k, sbx + sbw, sby + 5 * k], fill=INK)
d0.text((sbx + sbw / 2, sby + 26 * k), '100 m', font=fnt(False, 28), fill=INK, anchor='mm')
d0.text((BX + BR * 0.35, BY + BR + 92 * k), 'floors: OpenStreetMap building:levels', font=fnt(False, 24), fill=(90, 90, 90), anchor='lm')
im.save(OUT, optimize=True)
print('buildings in the inset:', n, 'with floors:', nb, '| written', OUT)
if os.environ.get('A1') == '1':
    dpi = 300; mm = lambda v: int(round(v / 25.4 * dpi))
    page = Image.new('RGB', (mm(841), mm(594)), (255, 255, 255)); mw, mh = mm((X1 - X0) / 25), mm((Y1 - Y0) / 25)
    page.paste(im.resize((mw, mh), Image.LANCZOS), ((page.width - mw) // 2, (page.height - mh) // 2))
    page.save(os.path.splitext(OUT)[0] + '_A1_1-25000.pdf', resolution=dpi)
