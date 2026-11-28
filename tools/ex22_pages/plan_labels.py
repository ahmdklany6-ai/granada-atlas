"""Labels and the metro on a drawn plan (tools/ex22_pages/base_plan.py output) — owner, 28 Nov 2026: "add the name of Granada
and the towns, roads in a light red, the train in a darker red, the whole line in Granada and the one above the base".
Metro: line 1 of the Metro de Granada (Albolote–Armilla, data/ex21/metro_l1.json, OSM) and its extension under construction
past the base's north fence (data/vec/south_metro.json, OSM), both in the dark studio red, stops as white dots.
Names: Granada, the five towns (bold capitals) and the other towns in the frame (smaller), placed at their OSM / town centres.
Usage: python3 tools/ex22_pages/plan_labels.py <frame.json> <base_plan.png> <out.png>   (FONT_DIR: IBM Plex Sans TTFs)
Not part of the site or of the tests."""
import os, sys, json
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import shape
from pyproj import Transformer
Image.MAX_IMAGE_PIXELS = None
FRM, SRC, OUT = sys.argv[1:4]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FD = os.environ.get('FONT_DIR', '')
X0, Y0, X1, Y1 = json.load(open(FRM))['frame']
im = Image.open(SRC).convert('RGB'); W, H = im.size; RES = (X1 - X0) / W
T = Transformer.from_crs(4326, 25830, always_xy=True)
px = lambda x, y: ((x - X0) / RES, (Y1 - y) / RES)
d = ImageDraw.Draw(im)
DARK, RED = (90, 29, 34), (153, 43, 42)
if os.environ.get('METRO_BLACK') == '1': DARK = (20, 20, 20)   # owner (28 Nov): the metro in black
if os.environ.get('METRO_GREY') == '1': DARK = (85, 85, 85)    # owner (28 Nov, later): dark grey
k = 2.1167 / RES                                              # sizes are set for the A1 print (2.12 m per pixel)
# metro
L1 = json.load(open(os.path.join(ROOT, 'data', 'ex21', 'metro_l1.json')))
lines = [[T.transform(*p) for p in ln] for ln in L1['lines'] if len(ln) > 1]
for f in json.load(open(os.path.join(ROOT, 'data', 'vec', 'south_metro.json')))['features']:
    if f['geometry']['type'] == 'LineString': lines.append([T.transform(*p) for p in f['geometry']['coordinates']])
for ln in lines: d.line([px(*p) for p in ln], fill=(255, 255, 255), width=int(13 * k), joint='curve')
for ln in lines: d.line([px(*p) for p in ln], fill=DARK, width=int(9 * k), joint='curve')
for s in L1['stops']:
    x, y = px(*T.transform(*s['lonlat'])); r = 6 * k
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255), outline=DARK, width=int(3 * k))
# names
font = lambda w, s: ImageFont.truetype(os.path.join(FD, 'IBMPlexSans-SemiBold.ttf' if w else 'IBMPlexSans-Regular.ttf') if FD else '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if w else ''), int(s * k))


def label(x, y, t, size, bold, fill, sp=0):
    f = font(bold, size)
    if sp: t = (' ' * 0).join(t)
    w = d.textlength(t, font=f) + sp * k * (len(t) - 1)
    xx = x - w / 2
    for ch in t:
        d.text((xx, y), ch, font=f, fill=fill, anchor='lm', stroke_width=int(6 * k), stroke_fill=(255, 255, 255))
        xx += d.textlength(ch, font=f) + sp * k


from shapely.geometry import box as _box
from shapely import transform as _st
import numpy as _np
_to = lambda g: _st(g, lambda c: _np.column_stack(T.transform(c[:, 0], c[:, 1])))
for f in json.load(open(os.path.join(ROOT, 'data', 'vec', 'tour_towns.json')))['features']:
    g = _to(shape(f['geometry'])).buffer(0); n = f['properties']['nm']
    inside = g.intersection(_box(X0, Y0, X1, Y1))
    if inside.is_empty or inside.area < 0.05 * g.area: continue          # the town is outside this frame
    c = (g if inside.area > 0.6 * g.area else inside).representative_point()   # on the part of the town that is shown
    X, Y = px(c.x, c.y); t = n.upper(); fb = font(True, 46)
    hw = (d.textlength(t, font=fb) + 3 * k * (len(t) - 1)) / 2 + 20 * k
    X = min(max(X, hw), W - hw); Y = min(max(Y, 50 * k), H - 50 * k)  # whole name on the sheet
    label(X, Y, t, 46, True, (26, 26, 26), sp=3)   # owner: in black, like GRANADA
OTHER = {'Santa Fe': (-3.7186, 37.1886), 'Albolote': (-3.6555, 37.2306), 'Peligros': (-3.6283, 37.2333), 'Maracena': (-3.6337, 37.2073),
         'Pulianas': (-3.6100, 37.2240), 'Atarfe': (-3.6890, 37.2230), 'Vegas del Genil': (-3.6830, 37.1745), 'Cúllar Vega': (-3.6700, 37.1550),
         'Huétor Vega': (-3.5700, 37.1490), 'Cájar': (-3.5730, 37.1350), 'La Zubia': (-3.5850, 37.1200), 'Monachil': (-3.5420, 37.1330),
         'Gójar': (-3.6000, 37.1080), 'Cenes de la Vega': (-3.5340, 37.1600), 'Pinos Genil': (-3.5130, 37.1625), 'Jun': (-3.5950, 37.2210),
         'Purchil': (-3.6560, 37.1700), 'Belicena': (-3.6900, 37.1720), 'Otura': (-3.6350, 37.0930)}
for n, ll in OTHER.items():
    X, Y = px(*T.transform(*ll))
    if 80 < X < W - 80 and 60 < Y < H - 60: label(X, Y, n, 34, False, (60, 60, 60))
gx, gy = px(*T.transform(-3.5986, 37.1773)); label(gx, gy, 'GRANADA', 110, True, (26, 26, 26), sp=10)
im.save(OUT, optimize=True)
print('written', OUT)
