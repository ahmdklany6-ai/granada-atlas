"""Presentation · Granada's history as a map: the place (two hills, the Darro between them, the Genil and the Vega below), then the
city's built-up extent step by step (owner, 27 Nov 2026: "how do we show the history and the opening of the city?" → "let me see").
Frames (1920 x 1080, no title; owner's style: black, white, red, pale blue water):
  0  the place: relief (IGN MDT25 hillshade), rivers, the Albaicín (today's barrio boundary, OSM) and the Alhambra (a marker)
  1  1932        traced from IGN MTN50 1st edition (approximate)
  2  1956–1957   traced from the AMS aerial photos (approximate)
  3  1975, 4 1990, 5 2000   JRC GHSL GHS-BUILT-S R2023A, observed epochs
  6  2020        JRC GHSL, modelled epoch (said so on the frame)
Each frame: the city that year as one red shape (the extents up to then merged) with its edge (owner: no municipal boundary).
Before 1932 nothing is drawn as an extent: no mapped source in the project (the Albaicín and the Alhambra are places, not extents).
Data: data/ref/history_extents.json, data/vec/admin.json, data/vec/water.json, data/terrain/dem_mdt25.bin (all in the repository).
Writes <out>/hist_<k>.png / .svg, hist_growth.gif, hist_growth.mp4. Fonts: FONT_DIR (IBM Plex Sans, not committed).
Usage: python3 tools/ex22_pages/history_growth.py <out dir>
Not part of the site or of the tests."""
import os, sys, json, math, html, base64, io, shutil, subprocess
import numpy as np
from shapely.ops import unary_union
from PIL import Image
from shapely.geometry import shape, box, Point
from shapely import transform as stransform
from pyproj import Transformer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FONT_DIR = os.environ.get('FONT_DIR', '')
P = _bw._P
RED, INK, INK3 = P['red'], '#1A1A1A', '#5F5F5F'
WATER, RIVER, WLAB = '#EEF3F5', '#8FB0BF', '#5F7F90'
GREYS = ['#B4B4B4', '#C4C4C4', '#D2D2D2', '#DDDDDD', '#E6E6E6']        # earlier periods, newest darkest
W, H = 1920, 1080
X0, X1, Y0, Y1 = 437200, 455400, 4108400, 4118640                        # EPSG:25830, 18.2 x 10.24 km (16:9)
sc = W / (X1 - X0)
f = lambda x, y: ((x - X0) * sc, (Y1 - y) * sc)
T = Transformer.from_crs(4326, 25830, always_xy=True)
to_utm = lambda g: stransform(g, lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
FR = box(X0, Y0, X1, Y1)

# --- relief: hillshade of the MDT25 window, pale greys (light from the north-west)
man = json.load(open(os.path.join(ROOT, 'data', 'manifest.json')))['terrain']['dem']
dem = np.fromfile(os.path.join(ROOT, 'data', man['file']), '<i2').reshape(man['height'], man['width']).astype(float)
dem[dem == man['nodata']] = np.nan
gy, gx = np.gradient(dem, man['py'], man['px'])
slope = np.arctan(np.hypot(gx, gy) * 1.6); aspect = np.arctan2(-gx, gy)
az, alt = math.radians(315), math.radians(45)
hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
hs = np.nan_to_num(hs, nan=1.0)
shade = np.clip(255 - (1 - hs) * 70, 185, 255).astype(np.uint8)           # 185..255: a light wash, flat ground white
c0 = int((X0 - man['ox']) / man['px']); c1 = int(math.ceil((X1 - man['ox']) / man['px']))
r0 = int((man['oy'] - Y1) / man['py']); r1 = int(math.ceil((man['oy'] - Y0) / man['py']))
crop = Image.fromarray(shade[r0:r1, c0:c1], 'L').resize((W, H), Image.BICUBIC)
buf = io.BytesIO(); crop.save(buf, 'PNG'); HILL = base64.b64encode(buf.getvalue()).decode()

# --- vectors
ext = json.load(open(os.path.join(ROOT, 'data', 'ref', 'history_extents.json')))['extents']
admin = json.load(open(os.path.join(ROOT, 'data', 'vec', 'admin.json')))['features']
albaicin = [to_utm(shape(a['geometry'])) for a in admin if a['properties'].get('name') == 'Albaicín' and a['properties'].get('kind') == 'barrio'][0]
muni = [to_utm(shape(a['geometry'])) for a in admin if a['properties'].get('kind') == 'municipio'][0]
water = json.load(open(os.path.join(ROOT, 'data', 'vec', 'water.json')))['features']
MAIN = ('Río Darro', 'Río Genil', 'Río Beiro', 'Río Monachil', 'Río. Genil')
rivers = [(w['properties'].get('nm'), to_utm(shape(w['geometry'])).intersection(FR)) for w in water
          if w['properties'].get('nm') in MAIN and w['geometry']['type'] in ('LineString', 'MultiLineString')]
alhambra = Point(*T.transform(-3.5881, 37.1761))
STAGES = [('mtn50_1932', '1932', 'traced from the IGN 1:50,000 map (approximate)'),
          ('ams_1956', '1956', 'traced from the 1956–57 aerial photos (approximate)'),
          ('ghsl_1975', '1975', 'satellite-observed built-up area (JRC GHSL)'),
          ('ghsl_1990', '1990', 'satellite-observed built-up area (JRC GHSL)'),
          ('ghsl_2000', '2000', 'satellite-observed built-up area (JRC GHSL)'),
          ('ghsl_2020', '2020', 'modelled built-up area (JRC GHSL, not observed)')]
geoms = {k: to_utm(shape(ext[k]['geometry'])).buffer(0) for k, _, _ in STAGES}


def path(g):
    polys = [g] if g.geom_type == 'Polygon' else [q for q in getattr(g, 'geoms', []) if q.geom_type == 'Polygon']
    return ''.join('M' + 'L'.join('%.1f,%.1f' % f(x, y) for x, y in r.coords) + 'Z' for p in polys for r in [p.exterior] + list(p.interiors))


def lpath(g):
    ls = [g] if g.geom_type == 'LineString' else [q for q in getattr(g, 'geoms', []) if q.geom_type == 'LineString']
    return ''.join('M' + 'L'.join('%.1f,%.1f' % f(x, y) for x, y in l.coords) for l in ls)


esc = lambda s: html.escape(s, quote=True)


def text(x, y, s, size, fill, weight=400, anchor='start', italic=False, halo=False, ls=0):
    a = (f'x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"'
         + (' font-style="italic"' if italic else '') + (f' letter-spacing="{ls}"' if ls else ''))
    out = f'<text {a} fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round">{esc(s)}</text>' if halo else ''
    return out + f'<text {a} fill="{fill}">{esc(s)}</text>'


def scalebar(x, y, km=2, step=1):
    n = int(km / step); w = step * 1000 * sc; s = ''
    for k in range(n): s += f'<rect x="{x + k * w:.1f}" y="{y}" width="{w:.1f}" height="7" fill="{INK if k % 2 == 0 else "#FFFFFF"}" stroke="{INK}" stroke-width="1"/>'
    for k in range(n + 1): s += text(x + k * w, y + 26, f'{k * step}' + (' km' if k == n else ''), 15, INK3, anchor='middle')
    return s


def frame(k):
    s = [f'<image href="data:image/png;base64,{HILL}" x="0" y="0" width="{W}" height="{H}"/>']
    # extents: earlier in greys (newest darkest), the current one red
    if k > 0:   # owner: no grey rings; the city as it was that year, one shape (all extents up to then merged), and its edge
        from shapely.ops import unary_union
        city = unary_union([geoms[key] for key, _, _ in STAGES[:k]]).buffer(0)
        s.append(f'<path d="{path(city)}" fill="{RED}" fill-opacity="0.6" stroke="{RED}" stroke-width="2.2" stroke-linejoin="round" fill-rule="evenodd"/>')
    for n, g in rivers: s.append(f'<path d="{lpath(g)}" fill="none" stroke="{RIVER}" stroke-width="{3.2 if "Genil" in n else 2.4}" stroke-linecap="round"/>')
    # the two places the city grew from
    s.append(f'<path d="{path(albaicin)}" fill="{"none" if k else RED}" fill-opacity="0.75" stroke="{RED if k == 0 else INK}" stroke-width="{2.2 if k == 0 else 1.4}"/>')
    ax, ay = f(alhambra.x, alhambra.y)
    s.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="{9 if k == 0 else 6}" fill="{RED if k == 0 else INK}" stroke="#FFFFFF" stroke-width="2"/>')
    bx, by = f(*albaicin.representative_point().coords[0])
    lx, ly = f(*T.transform(-3.6045, 37.1885))                      # the Albaicín's label to the west of it, clear of the shapes
    s.append(text(lx, ly, 'Albaicín', 24 if k == 0 else 19, RED if k == 0 else INK, 600, 'end', halo=True))
    s.append(text(ax + 16, ay + 30, 'Alhambra', 24 if k == 0 else 19, RED if k == 0 else INK, 600, halo=True))
    if k == 0:
        s.append(text(lx, ly + 24, 'the first town, on the hill (11th c.)', 17, INK, 400, 'end', halo=True))
        s.append(text(ax + 16, ay + 54, 'the Nasrid palace-city (13th–15th c.)', 17, INK, halo=True))
    # river names
    for n, (lon, lat), rot in (('Darro', (-3.574, 37.1795), -18), ('Genil', (-3.566, 37.1555), 22), ('Beiro', (-3.595, 37.1945), 12)):
        x, y = f(*T.transform(lon, lat))
        s.append(f'<g transform="rotate({rot} {x:.1f} {y:.1f})">' + text(x, y, n, 18, WLAB, 400, 'middle', True, True) + '</g>')
    x, y = f(*T.transform(-3.665, 37.152)); s.append(text(x, y, 'V E G A', 26, INK3, 500, 'middle', halo=True, ls=6))
    x, y = f(*T.transform(-3.665, 37.152)); s.append(text(x, y + 26, 'the farmed plain', 16, INK3, 400, 'middle', True, True))
    # the year, big, top left; what it is, small
    if k == 0:
        s.append(text(46, 92, 'before 1932', 64, INK, 600))
        s.append(text(48, 128, 'two hills, the Darro between them, the Genil and the Vega below', 20, INK3))
    else:
        key, yr, what = STAGES[k - 1]
        s.append(text(46, 100, yr, 88, RED, 600))
        s.append(text(48, 138, what, 20, INK3))
        s.append(text(48, 166, '≈ %.0f km² (the red shape)' % (unary_union([geoms[q] for q, _, _ in STAGES[:k]]).area / 1e6), 20, INK3))
    s.append(scalebar(W - 250, H - 70))
    s.append(text(46, H - 30, 'Relief: IGN MDT25 · rivers, Albaicín boundary: OSM · extents: IGN MTN50 1932, AMS 1956–57 (traced), JRC GHSL R2023A', 14, INK3))
    return s


font_css = ''
if FONT_DIR:
    b64 = lambda n: base64.b64encode(open(os.path.join(FONT_DIR, n), 'rb').read()).decode()
    font_css = (f"@font-face{{font-family:'Plex';src:url(data:font/ttf;base64,{b64('IBMPlexSans-Regular.ttf')});font-weight:400}}"
                f"@font-face{{font-family:'Plex';src:url(data:font/ttf;base64,{b64('IBMPlexSans-SemiBold.ttf')});font-weight:500 700}}")
from playwright.sync_api import sync_playwright
frames = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    for k in range(len(STAGES) + 1):
        d = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
             f'<style>{font_css}text{{font-family:Plex,"IBM Plex Sans",Arial,sans-serif}}</style>' + ''.join(frame(k)) + '</svg>')
        open(os.path.join(OUT, f'hist_{k}.svg'), 'w').write(d)
        pg.set_content(f'<html><body style="margin:0">{d}</body></html>', wait_until='load'); pg.wait_for_timeout(250)
        fp = os.path.join(OUT, f'hist_{k}.png'); pg.screenshot(path=fp); frames.append(Image.open(fp).convert('RGB'))
    b.close()
durs = [2500] + [900] * (len(frames) - 2) + [3000]
pal = frames[-1].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
gif = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in frames]
gif[0].save(os.path.join(OUT, 'hist_growth.gif'), save_all=True, append_images=gif[1:], duration=durs, loop=0)
if shutil.which('ffmpeg'):
    tmp = os.path.join(OUT, '_mp4'); os.makedirs(tmp, exist_ok=True); n = 0
    for im, dms in zip(frames, durs):
        for _ in range(int(dms / 40)): im.save(os.path.join(tmp, f'{n:05d}.png')); n += 1
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '25', '-i', os.path.join(tmp, '%05d.png'), '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '20', os.path.join(OUT, 'hist_growth.mp4')], check=True)
    shutil.rmtree(tmp)
print('written', len(frames), 'frames, gif, mp4 in', OUT, '| km² per GHSL epoch:', {k: ext[k].get('km2') for k, _, _ in STAGES})
