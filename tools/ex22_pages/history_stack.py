"""Presentation · Granada's historical maps laid over each other at their true place and scale, one added at a time (owner,
27 Nov 2026, with a sketch: frames of different sizes overlapping, each map covering the area of its own time and moved towards
where the city grew; then "shift each frame towards the growth, add any other maps even of the same period, keep the maps in
their own colours, write no dates (I write them), make a video that adds one each time").
One common scale for all; each map in its own frame, centred halfway between its city and the part added since the map before
(70 % towards the added part, so the frames walk with the growth). A new map goes UNDER the ones already shown (the older stay readable on top).
Maps (IGN / CNIG WMS, georeferenced by IGN, CC BY 4.0), in order:
  Minutas cartográficas (Granada municipality planimetry, 1895; the city itself left blank)
  MTN50 drafts "catastrones" (sheet 1009, undated, 1910–1970)
  MTN50 1st edition (sheet 1009, 1932)
  MTN25 1st edition (series 1975–2003; sheet year not given by the service)
  MTN25 today (mapa-raster, mtn_rasterizado)
The city of each map: data/ref/history_extents.json (1932, catastrones, GHSL 1990, GHSL 2020), only to place the frames.
Writes <out>/stack_<k>.png (k = 1..5), stack.mp4, stack.gif, stack_final.pdf / .svg.
Usage: python3 tools/ex22_pages/history_stack.py <out dir>
Not part of the site or of the tests."""
import os, sys, json, base64, io, urllib.request, urllib.parse, shutil, subprocess
import numpy as np
from PIL import Image
from shapely.geometry import shape
from shapely import transform as stransform
from pyproj import Transformer

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W, H, M = 1920, 1080, 36
T = Transformer.from_crs(4326, 25830, always_xy=True)
to_utm = lambda g: stransform(g, lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
ext = json.load(open(os.path.join(ROOT, 'data', 'ref', 'history_extents.json')))['extents']
geo = {k: to_utm(shape(v['geometry'])).buffer(0) for k, v in ext.items()}
MIN, MTN, RAS = 'https://www.ign.es/wms/minutas-cartograficas', 'https://www.ign.es/wms/primera-edicion-mtn', 'https://www.ign.es/wms-inspire/mapa-raster'


def frame(city, prev, pad, aspect):
    """a frame around the city of the map, centred halfway between that city and what was added since the map before"""
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
# one common scale on the ground; the view zooms out as maps are added (each step fits the maps shown so far)


def wms(name, url, layer, bb, long_px=2200):
    fp = os.path.join(OUT, f'wms3_{name}.jpg')
    if not os.path.exists(fp):
        w, h = bb[2] - bb[0], bb[3] - bb[1]; k = long_px / max(w, h)
        q = dict(SERVICE='WMS', VERSION='1.3.0', REQUEST='GetMap', LAYERS=layer, STYLES='', CRS='EPSG:25830',
                 BBOX=','.join('%.1f' % v for v in bb), WIDTH=int(w * k), HEIGHT=int(h * k), FORMAT='image/jpeg')
        with urllib.request.urlopen(url + '?' + urllib.parse.urlencode(q), timeout=240) as r: data = r.read()
        Image.open(io.BytesIO(data)).convert('RGB').save(fp, quality=92)
    return base64.b64encode(open(fp, 'rb').read()).decode()


TOP = max(m[3][3] for m in MAPS)                                  # svg y = TOP - northing (metres)
items = []
for name, url, layer, bb in MAPS:
    x, y, w, h = bb[0], TOP - bb[3], bb[2] - bb[0], bb[3] - bb[1]
    items.append((bb, f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="#FFFFFF" filter="url(#sh)"/>'
                      f'<image href="data:image/jpeg;base64,{wms(name, url, layer, bb)}" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" preserveAspectRatio="none"/>'
                      f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="none" stroke="#FFFFFF" stroke-width="{{sw6}}"/>'
                      f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="none" stroke="#1A1A1A" stroke-width="{{sw1}}"/>'))


def doc(k):   # maps 1..k: the newest drawn first (underneath), the oldest last (on top); the view fits them
    bs = [b for b, _ in items[:k]]
    X0, Y0, X1, Y1 = min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)
    sc = min((W - 2 * M) / (X1 - X0), (H - 2 * M) / (Y1 - Y0)); vw, vh = W / sc, H / sc
    vx, vy = (X0 + X1) / 2 - vw / 2, TOP - (Y0 + Y1) / 2 - vh / 2
    m = lambda px: f'{px / sc:.2f}'
    body = ''.join(svg.replace('{sw6}', m(6)).replace('{sw1}', m(1.2)) for _, svg in reversed(items[:k]))
    shadow = f'<defs><filter id="sh" x="-5%" y="-5%" width="115%" height="115%"><feDropShadow dx="{m(6)}" dy="{m(8)}" stdDeviation="{m(7)}" flood-color="#000" flood-opacity="0.3"/></filter></defs>'
    km = 2 if 2000 * sc < 300 else 1 if 1000 * sc < 520 else 0.5
    bw = km * 1000 * sc; bx, by = W - M - bw, H - 44
    lab = f'{km:g} km'
    scale = (f'<rect x="{bx - 14:.1f}" y="{by - 12}" width="{bw + 46:.1f}" height="40" fill="#FFFFFF" fill-opacity="0.9"/>'
             f'<rect x="{bx:.1f}" y="{by}" width="{bw / 2:.1f}" height="6" fill="#1A1A1A"/><rect x="{bx + bw / 2:.1f}" y="{by}" width="{bw / 2:.1f}" height="6" fill="#FFFFFF" stroke="#1A1A1A"/>'
             f'<text x="{bx:.1f}" y="{by + 22}" font-size="13" fill="#5F5F5F" text-anchor="middle" font-family="Arial">0</text>'
             f'<text x="{bx + bw:.1f}" y="{by + 22}" font-size="13" fill="#5F5F5F" text-anchor="middle" font-family="Arial">{lab}</text>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#F5F5F5"/>'
            f'<svg x="0" y="0" width="{W}" height="{H}" viewBox="{vx:.1f} {vy:.1f} {vw:.1f} {vh:.1f}">{shadow}{body}</svg>{scale}</svg>')


from playwright.sync_api import sync_playwright
frames = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    for k in range(1, len(items) + 1):
        d = doc(k); pg.set_content(f'<html><body style="margin:0">{d}</body></html>', wait_until='load'); pg.wait_for_timeout(300)
        fp = os.path.join(OUT, f'stack_{k}.png'); pg.screenshot(path=fp); frames.append(Image.open(fp).convert('RGB'))
    open(os.path.join(OUT, 'stack_final.svg'), 'w').write(d)
    pg.pdf(path=os.path.join(OUT, 'stack_final.pdf'), width=f'{W / 96:.3f}in', height=f'{H / 96:.3f}in', print_background=True,
           margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
    b.close()
HOLD, LAST = 1.8, 3.5
pal = frames[-1].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
gif = [im.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG) for im in frames]
gif[0].save(os.path.join(OUT, 'stack.gif'), save_all=True, append_images=gif[1:], duration=[int(HOLD * 1000)] * (len(gif) - 1) + [int(LAST * 1000)], loop=0)
tmp = os.path.join(OUT, '_mp4s'); os.makedirs(tmp, exist_ok=True); n = 0
for i, im in enumerate(frames):
    for _ in range(int((LAST if i == len(frames) - 1 else HOLD) * 25)): im.save(os.path.join(tmp, f'{n:05d}.png')); n += 1
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '25', '-i', os.path.join(tmp, '%05d.png'), '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p', '-crf', '18', os.path.join(OUT, 'stack.mp4')], check=True)
shutil.rmtree(tmp)
print('written', len(frames), 'frames, stack.mp4, stack.gif in', OUT)
