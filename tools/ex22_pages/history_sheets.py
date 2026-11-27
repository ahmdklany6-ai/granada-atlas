"""Presentation · the historical maps of Granada laid one after the other on ONE fixed background, as slides (owner, 27 Nov 2026:
"I don't want the frame to move or zoom; take this background [the relief map], make it lighter, take the red off, show all the
rivers and roads that exist today, and how the old maps sit on them; give them to me as slides"; with a phone video as the
manner — maps laid down like sheets of paper with a shadow; only the manner is taken, nothing copied).
Background: IGN MDT25 hillshade (light), every river / stream / ditch (OSM, data/vec/water.json) and the main roads of today
(OSM, data/vec/streets_major.json). Maps (IGN / CNIG WMS, CC BY 4.0, georeferenced by IGN) at their true place and scale,
in their own colours, a white paper edge and a soft shadow; each new one goes UNDER those already laid (they grow outwards):
  1 Minutas cartográficas 1895 · then small minutas of the villages around (their municipalities' planimetry) · 2 MTN50 drafts (catastrones, 1910–70, undated) · 3 MTN50 1st ed. 1932 ·
  4 MTN25 1st ed. (1975–2003) · 5 MTN25 today. No dates on the slides (the owner writes them).
Frames of the maps are the ones of history_stack.py (same files are reused: <out>/wms3_*.jpg are fetched if missing).
Writes <out>/sheet_0.png (background only) … sheet_5.png (1920 x 1080 at 2x), sheets.pdf (one page per slide), sheets.mp4.
Usage: python3 tools/ex22_pages/history_sheets.py <out dir>
Not part of the site or of the tests."""
import os, sys, json, math, base64, io, urllib.request, urllib.parse, shutil, subprocess
import numpy as np
from PIL import Image
from shapely.geometry import shape, box
from shapely import transform as stransform
from pyproj import Transformer

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W, H = 1920, 1080
T = Transformer.from_crs(4326, 25830, always_xy=True)
to_utm = lambda g: stransform(g, lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
ext = json.load(open(os.path.join(ROOT, 'data', 'ref', 'history_extents.json')))['extents']
geo = {k: to_utm(shape(v['geometry'])).buffer(0) for k, v in ext.items()}
MIN, MTN, RAS = 'https://www.ign.es/wms/minutas-cartograficas', 'https://www.ign.es/wms/primera-edicion-mtn', 'https://www.ign.es/wms-inspire/mapa-raster'


def frame(city, prev, pad, aspect):   # the same frames as history_stack.py
    x0, y0, x1, y1 = city.bounds; w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    if w / h < aspect: w = h * aspect
    else: h = w / aspect
    c = city.centroid
    if prev is not None:
        new = city.difference(prev.buffer(50))
        if not new.is_empty and new.area > 1e5: c = type(c)(c.x * 0.3 + new.centroid.x * 0.7, c.y * 0.3 + new.centroid.y * 0.7)
    return (c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2)


core = geo['mtn50_1932'].buffer(-250)
MAPS = [('minutas', MIN, 'Minutas', frame(core, None, 420, 0.95)),
        ('catastrones', MTN, 'catastrones', frame(geo['catastrones'], core, 500, 1.15)),
        ('mtn50', MTN, 'MTN50', frame(geo['mtn50_1932'], geo['catastrones'], 650, 1.25)),
        ('mtn25', MTN, 'MTN25', frame(geo['ghsl_1990'], geo['mtn50_1932'], 650, 1.0)),
        ('today', RAS, 'mtn_rasterizado', frame(geo['ghsl_2020'], geo['ghsl_1990'], 700, 1.15))]

# ---- the fixed view: all the maps with a margin, 16:9
bs = [m[3] for m in MAPS]
X0, Y0, X1, Y1 = min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)
pad = 900; X0 -= pad; Y0 -= pad; X1 += pad; Y1 += pad
cx, cy, w, h = (X0 + X1) / 2, (Y0 + Y1) / 2, X1 - X0, Y1 - Y0
if w / h < W / H: w = h * W / H
else: h = w * H / W
X0, X1, Y0, Y1 = cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2
_m = json.load(open(os.path.join(ROOT, 'data', 'manifest.json')))['terrain']['dem']
DX0, DX1 = _m['ox'] + 200, _m['ox'] + _m['width'] * _m['px'] - 200; DY1, DY0 = _m['oy'] - 200, _m['oy'] - _m['height'] * _m['py'] + 200
if X1 - X0 > DX1 - DX0:                                        # wider than the relief: narrow the view to it, keep 16:9
    w = DX1 - DX0; h = w * H / W; X0, X1 = DX0, DX1; Y0, Y1 = cy - h / 2, cy + h / 2
X0, X1 = max(X0, DX0), min(X1, DX1); X0, X1 = (X0, X0 + w) if X0 + w <= DX1 else (DX1 - w, DX1)
Y0, Y1 = max(Y0, DY0), min(Y1, DY1); h = w * H / W; Y0, Y1 = (Y0, Y0 + h) if Y0 + h <= DY1 else (DY1 - h, DY1)
sc = W / w
f = lambda x, y: ((x - X0) * sc, (Y1 - y) * sc)
FR = box(X0, Y0, X1, Y1)

# hillshade, light, no red
man = json.load(open(os.path.join(ROOT, 'data', 'manifest.json')))['terrain']['dem']
dem = np.fromfile(os.path.join(ROOT, 'data', man['file']), '<i2').reshape(man['height'], man['width']).astype(float)
dem[dem == man['nodata']] = np.nan
gy, gx = np.gradient(dem, man['py'], man['px'])
slope = np.arctan(np.hypot(gx, gy) * 1.6); aspect = np.arctan2(-gx, gy)
hs = np.sin(math.radians(45)) * np.cos(slope) + np.cos(math.radians(45)) * np.sin(slope) * np.cos(math.radians(315) - aspect)
hs = np.nan_to_num(hs, nan=1.0)
shade = np.clip(255 - (1 - hs) * 45, 215, 255).astype(np.uint8)
gx_ = lambda x: (x - man['ox']) / man['px']; gy_ = lambda y: (man['oy'] - y) / man['py']
c0, c1 = gx_(X0), gx_(X1); r0, r1 = gy_(Y1), gy_(Y0)
src = Image.fromarray(shade, 'L')
crop = src.transform((W * 2, H * 2), Image.EXTENT, (c0, r0, c1, r1), Image.BICUBIC, fill=1)
arr = np.asarray(crop).copy(); arr[arr == 0] = 250; crop = Image.fromarray(arr)          # outside the DEM: flat
buf = io.BytesIO(); crop.save(buf, 'JPEG', quality=90); HILL = base64.b64encode(buf.getvalue()).decode()


def lines(path_, width_of, colour):
    feats = json.load(open(os.path.join(ROOT, 'data', 'vec', path_)))['features']; out = {}
    for ft in feats:
        g = ft['geometry']
        if g['type'] not in ('LineString', 'MultiLineString'): continue
        wd = width_of(ft['properties'])
        if not wd: continue
        geom = to_utm(shape(g)).intersection(FR)
        if geom.is_empty: continue
        ls = [geom] if geom.geom_type == 'LineString' else [q for q in getattr(geom, 'geoms', []) if q.geom_type == 'LineString']
        out.setdefault(wd, []).extend('M' + 'L'.join('%.1f,%.1f' % f(x, y) for x, y in l.coords) for l in ls)
    return ''.join(f'<path d="{"".join(d)}" fill="none" stroke="{colour}" stroke-width="{wd}" stroke-linecap="round" stroke-linejoin="round"/>' for wd, d in sorted(out.items()))


def water_w(p):
    nm, ww = p.get('nm') or '', p.get('ww')
    if ww == 'river' or nm.startswith('Río'): return 2.6
    if ww in ('stream', 'canal', 'flowline'): return 1.2
    if ww in ('ditch', 'drain', None): return 0.6
    return None


def road_w(p):
    return {'motorway': 2.4, 'trunk': 2.0, 'primary': 1.6, 'secondary': 1.2, 'tertiary': 0.7}.get(p.get('hw'), 0.5 if (p.get('hw') or '').endswith('_link') else None)


ROADS = lines('streets_major.json', road_w, '#992B2A')   # owner: the roads in our red
WATER = lines('water.json', water_w, '#9DBCD1')


def wms(name, url, layer, bb, long_px=2200):
    fp = os.path.join(OUT, f'wms3_{name}.jpg')
    if not os.path.exists(fp):
        w_, h_ = bb[2] - bb[0], bb[3] - bb[1]; k = (min(long_px, 2000) if 'ideandalucia' in url else long_px) / max(w_, h_)   # IECA: at most 2048 px
        q = dict(SERVICE='WMS', VERSION='1.3.0', REQUEST='GetMap', LAYERS=layer, STYLES='', CRS='EPSG:25830',
                 BBOX=','.join('%.1f' % v for v in bb), WIDTH=int(w_ * k), HEIGHT=int(h_ * k), FORMAT='image/png' if 'ideandalucia' in url else 'image/jpeg')
        def get(qq):
            with urllib.request.urlopen(url + '?' + urllib.parse.urlencode(qq), timeout=240) as r: data = r.read()
            try: return Image.open(io.BytesIO(data)).convert('RGBA')
            except Exception: raise SystemExit(f'WMS {name} {layer}: not an image: {data[:300]!r}')
        if 'ideandalucia' in url:   # the service refuses big images (memory): tiles of at most 900 px, stitched
            Wp, Hp = q['WIDTH'], q['HEIGHT']; im_ = Image.new('RGBA', (Wp, Hp)); TS = 900
            for ty in range(0, Hp, TS):
                for tx in range(0, Wp, TS):
                    tw, th = min(TS, Wp - tx), min(TS, Hp - ty)
                    xa, xb = bb[0] + tx / k, bb[0] + (tx + tw) / k; yb, ya = bb[3] - ty / k, bb[3] - (ty + th) / k
                    im_.paste(get(dict(q, BBOX='%.2f,%.2f,%.2f,%.2f' % (xa, ya, xb, yb), WIDTH=tw, HEIGHT=th)), (tx, ty))
        else:
            im_ = get(q)
        if 'ideandalucia' in url: im_.save(fp + '.png'); open(fp, 'wb').close()   # IECA: keep its transparency (no data = see-through)
        else: Image.alpha_composite(Image.new('RGBA', im_.size, (255, 255, 255, 255)), im_).convert('RGB').save(fp, quality=92)
    if os.path.exists(fp + '.png'): return 'png', base64.b64encode(open(fp + '.png', 'rb').read()).decode()
    return 'jpeg', base64.b64encode(open(fp, 'rb').read()).decode()


# owner (mid-way): "if there are other small maps here and there, put them": the minutas of the villages around
import re as _re
TOWNS = [(ft['properties']['nm'], to_utm(shape(ft['geometry'])).centroid) for ft in json.load(open(os.path.join(ROOT, 'data', 'vec', 'tour_towns.json')))['features']]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ESM = os.environ.get('ES_ATLAS')
if ESM:
    from map_spain_granada_topo import topo as _topo
    for i_, n_, g_ in _topo(ESM)['municipalities']:
        if n_ in ('Maracena', 'La Zubia', 'Huétor Vega', 'Cájar', 'Cúllar Vega', 'Vegas del Genil', 'Cenes de la Vega', 'Pulianas', 'Gójar', 'Ogíjares', 'Alhendín', 'Otura', 'Jun', 'Peligros', 'Albolote', 'Atarfe', 'Santa Fe', 'Monachil', 'Huétor de Santillán') and i_.startswith('18'):
            TOWNS.append((n_, to_utm(g_).representative_point()))
SMALL = []
for n_, c_ in TOWNS:
    half = 900; bb = (c_.x - half, c_.y - half * 0.85, c_.x + half, c_.y + half * 0.85)
    if bb[0] < X0 + 100 or bb[2] > X1 - 100 or bb[1] < Y0 + 100 or bb[3] > Y1 - 100: continue
    SMALL.append(('min_' + _re.sub(r'\W+', '_', n_), MIN, 'Minutas', bb))
def _blank(q):   # a sheet the service returns empty (no minuta there) is left out
    wms(*q); a_ = np.asarray(Image.open(os.path.join(OUT, f'wms3_{q[0]}.jpg')).convert('L'), float); return a_.std() < 6 or a_.mean() > 247
SMALL = [q for q in SMALL if not _blank(q)]
print('small sheets:', [q[0] for q in SMALL])
# owner: "look for more maps; add one at a time": the Andalucía 1:10,000 maps (IECA, IDEAndalucía WMS) of 2007 and 2013,
# framed on where the city grew in those years (GHSL 2000→2015) and on the southern towns
IECA10, IECAR = 'https://www.ideandalucia.es/services/toporaster10/wms', 'https://www.ideandalucia.es/wms/mta10r_2001-2013'
_new = geo['ghsl_2015'].difference(geo['ghsl_2000'].buffer(50))
_b = _new.bounds; M2007 = ('mta10_2007', IECA10, 'toporaster10', (_b[0] - 500, _b[1] - 500, _b[2] + 500, _b[3] + 500))
from shapely.ops import unary_union as _uu
_t = _uu([to_utm(shape(ft['geometry'])) for ft in json.load(open(os.path.join(ROOT, 'data', 'vec', 'tour_towns.json')))['features']]).bounds
M2013 = ('mta10_2013', IECAR, 'mta10_raster_2013', (_t[0] - 600, _t[1] - 600, _t[2] + 600, _t[3] + 600))
for q in (M2007, M2013):   # kept inside the view
    pass
# one map per step (owner): Granada 1895, then each village minuta, then the city maps in time
STEPS = [[MAPS[0]]] + [[q] for q in SMALL] + [[MAPS[1]], [MAPS[2]], [MAPS[3]], [M2013], [MAPS[4]]]   # owner (with screenshots): the 2007 line map out, MTN25 1st edition in
SMALL_IDX = set(range(1, 1 + len(SMALL)))

SHEETS = []
for name, url, layer, bb in [m for st in STEPS for m in st]:
    (x, y1), (x1, y) = f(bb[0], bb[1]), f(bb[2], bb[3]); ww, hh = x1 - x, y1 - y
    kind, data_ = wms(name, url, layer, bb)
    under = '' if kind == 'png' else f'<rect x="{x:.1f}" y="{y:.1f}" width="{ww:.1f}" height="{hh:.1f}" fill="#FFFFFF" filter="url(#sh)"/>'
    SHEETS.append(under + f'<image href="data:image/{kind};base64,{data_}" x="{x:.1f}" y="{y:.1f}" width="{ww:.1f}" height="{hh:.1f}" preserveAspectRatio="none"/>')
bw = 1000 * sc; bx, by = W - 40 - 2 * bw, H - 46
SCALE = (f'<rect x="{bx - 14:.1f}" y="{by - 12}" width="{2 * bw + 46:.1f}" height="40" fill="#FFFFFF" fill-opacity="0.85"/>'
         f'<rect x="{bx:.1f}" y="{by}" width="{bw:.1f}" height="6" fill="#1A1A1A"/><rect x="{bx + bw:.1f}" y="{by}" width="{bw:.1f}" height="6" fill="#FFFFFF" stroke="#1A1A1A"/>'
         + ''.join(f'<text x="{bx + k * bw:.1f}" y="{by + 22}" font-size="13" fill="#5F5F5F" text-anchor="middle" font-family="Arial">{k}{" km" if k == 2 else ""}</text>' for k in range(3)))
DEFS = '<defs><filter id="sh" x="-10%" y="-10%" width="125%" height="125%"><feDropShadow dx="8" dy="12" stdDeviation="10" flood-color="#000" flood-opacity="0.22"/></filter></defs>'
BASE = f'<image href="data:image/jpeg;base64,{HILL}" x="0" y="0" width="{W}" height="{H}"/>' + WATER + ROADS


STEP_END = np.cumsum([len(st) for st in STEPS]).tolist()


def doc(k):   # the first k steps, each new map laid on top
    n = STEP_END[k - 1] if k else 0; small = SMALL_IDX
    order = list(range(n))   # owner: each new map on top, even when it covers an older one completely
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{DEFS}{BASE}'
            + ''.join(SHEETS[i] for i in order) + SCALE + '</svg>')


from playwright.sync_api import sync_playwright
frames = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
    pages = []
    for k in range(len(STEPS) + 1):
        d = doc(k); open(os.path.join(OUT, f'sheet_{k}.svg'), 'w').write(d)
        pg.set_content(f'<html><body style="margin:0">{d}</body></html>', wait_until='load'); pg.wait_for_timeout(400)
        fp = os.path.join(OUT, f'sheet_{k}.png'); pg.screenshot(path=fp); frames.append(Image.open(fp).convert('RGB'))
    b.close()
frames[0].save(os.path.join(OUT, 'sheets.pdf'), save_all=True, append_images=frames[1:], resolution=192)
tmp = os.path.join(OUT, '_mp4h'); os.makedirs(tmp, exist_ok=True); n = 0
for i, im in enumerate(frames):
    small = im.resize((W, H), Image.LANCZOS)
    for _ in range(int((2.5 if i == len(frames) - 1 else 0.6) * 25)): small.save(os.path.join(tmp, f'{n:05d}.png')); n += 1
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '25', '-i', os.path.join(tmp, '%05d.png'), '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p', '-crf', '18', os.path.join(OUT, 'sheets.mp4')], check=True)
shutil.rmtree(tmp)
print('written', len(frames), 'slides, sheets.pdf, sheets.mp4 in', OUT)
