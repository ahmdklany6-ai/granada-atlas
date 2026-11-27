"""Presentation · Granada's historical maps laid over each other at their true place and scale (owner, 27 Nov 2026, with a sketch:
frames of different sizes overlapping, each map covering the area of its own time, so one sees where the city went on and what
was added). One common scale for the whole slide; every map in its own frame, the oldest on top (smallest), the newest below.
Maps (IGN / CNIG WMS, georeferenced by IGN, CC BY 4.0):
  1895  Minutas cartográficas, planimetría del municipio de Granada (document 180181, dated 15 Mar 1895; the city itself hatched)
  1932  Mapa Topográfico Nacional 1:50,000, 1st edition, sheet 1009 "Granada"
  MTN25 Mapa Topográfico Nacional 1:25,000, 1st edition (the IGN series 1975–2003; the sheet's year is not given by the service)
Frames: centred on the city of their time (data/ref/history_extents.json) with a margin; maps in greys (owner's style), frames
in ink, the year on a red tab. Older plans (Vico 1613, Dalmau 1796, Coello 1853) are not georeferenced in any service we can
reach here; they can be added by hand (control points) when the images are supplied.
Writes <out>/hist_stack.png / .svg / .pdf.   Usage: python3 tools/ex22_pages/history_stack.py <out dir>   (FONT_DIR: IBM Plex Sans)
Not part of the site or of the tests."""
import os, sys, json, html, base64, io, urllib.request, urllib.parse
import numpy as np
from PIL import Image, ImageOps
from shapely.geometry import shape, box
from shapely import transform as stransform
from pyproj import Transformer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FONT_DIR = os.environ.get('FONT_DIR', '')
RED, INK, INK3 = _bw._P['red'], '#1A1A1A', '#5F5F5F'
W, H, M = 1920, 1080, 40
T = Transformer.from_crs(4326, 25830, always_xy=True)
to_utm = lambda g: stransform(g, lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
ext = json.load(open(os.path.join(ROOT, 'data', 'ref', 'history_extents.json')))['extents']
geo = {k: to_utm(shape(v['geometry'])).buffer(0) for k, v in ext.items()}
MIN, MTN = 'https://www.ign.es/wms/minutas-cartograficas', 'https://www.ign.es/wms/primera-edicion-mtn'


def around(g, pad, aspect=None):
    x0, y0, x1, y1 = g.bounds; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
    if aspect:
        cx, cy, w, h = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
        if w / h < aspect: w = h * aspect
        else: h = w / aspect
        x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2
    return (x0, y0, x1, y1)


# (year tab, what, url, layer, frame bounds in EPSG:25830), drawn bottom to top
MAPS = [('MTN25', 'IGN 1:25,000, 1st edition (series 1975–2003)', MTN, 'MTN25', around(geo['ghsl_1990'], 700, 1.05)),
        ('1932', 'IGN 1:50,000, 1st edition', MTN, 'MTN50', around(geo['mtn50_1932'], 650, 1.25)),
        ('1895', 'IGN minuta, planimetry of the municipality', MIN, 'Minutas', around(geo['mtn50_1932'].buffer(-250), 450, 0.95))]
allb = [m[4] for m in MAPS]
X0, Y0 = min(b[0] for b in allb), min(b[1] for b in allb); X1, Y1 = max(b[2] for b in allb), max(b[3] for b in allb)
s = min((W - 2 * M) / (X1 - X0), (H - 2 * M - 40) / (Y1 - Y0))               # px per metre, one scale for all
ox = (W - (X1 - X0) * s) / 2; oy = (H - 40 - (Y1 - Y0) * s) / 2
f = lambda x, y: (ox + (x - X0) * s, oy + (Y1 - y) * s)


def wms(url, layer, bb, wpx, hpx, name):
    fp = os.path.join(OUT, f'wms_stack_{name}.jpg')
    if not os.path.exists(fp):
        q = dict(SERVICE='WMS', VERSION='1.3.0', REQUEST='GetMap', LAYERS=layer, STYLES='', CRS='EPSG:25830',
                 BBOX=','.join('%.1f' % v for v in bb), WIDTH=int(wpx * 2), HEIGHT=int(hpx * 2), FORMAT='image/jpeg')
        with urllib.request.urlopen(url + '?' + urllib.parse.urlencode(q), timeout=180) as r: data = r.read()
        Image.open(io.BytesIO(data)).convert('RGB').save(fp, quality=92)
    im = ImageOps.autocontrast(Image.open(fp).convert('L'), cutoff=1)
    im = Image.eval(im, lambda v: int(70 + v * 0.72))
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=88); return base64.b64encode(buf.getvalue()).decode()


esc = lambda t: html.escape(t, quote=True)
svg = ['<defs><filter id="sh" x="-5%" y="-5%" width="115%" height="115%"><feDropShadow dx="6" dy="8" stdDeviation="7" flood-color="#000" flood-opacity="0.28"/></filter></defs>']
for tab, what, url, layer, bb in MAPS:
    (x, y1), (x1, y) = f(bb[0], bb[1]), f(bb[2], bb[3]); w, h = x1 - x, y1 - y
    img = wms(url, layer, bb, w, h, layer)
    svg.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="#FFFFFF" filter="url(#sh)"/>')
    svg.append(f'<image href="data:image/jpeg;base64,{img}" x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" preserveAspectRatio="none"/>')
    svg.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="none" stroke="#FFFFFF" stroke-width="6"/>'
               f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="none" stroke="{INK}" stroke-width="1.5"/>')
    tw = 34 + len(tab) * 26
    svg.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{tw}" height="56" fill="{RED}"/>'
               f'<text x="{x + 16:.1f}" y="{y + 42:.1f}" font-size="40" font-weight="600" fill="#FFFFFF">{esc(tab)}</text>')
    svg.append(f'<rect x="{x:.1f}" y="{y + 56:.1f}" width="{len(what) * 8.2 + 24:.1f}" height="28" fill="#FFFFFF" fill-opacity="0.9"/>'
               f'<text x="{x + 12:.1f}" y="{y + 76:.1f}" font-size="16" fill="{INK}">{esc(what)}</text>')
km = 1; bw = km * 1000 * s; bx, by = W - M - bw - 20, H - 52
svg.append(f'<rect x="{bx:.1f}" y="{by}" width="{bw / 2:.1f}" height="6" fill="{INK}"/><rect x="{bx + bw / 2:.1f}" y="{by}" width="{bw / 2:.1f}" height="6" fill="#FFFFFF" stroke="{INK}"/>'
           f'<text x="{bx:.1f}" y="{by + 24}" font-size="14" fill="{INK3}" text-anchor="middle">0</text><text x="{bx + bw:.1f}" y="{by + 24}" font-size="14" fill="{INK3}" text-anchor="middle">1 km</text>')
svg.append(f'<text x="{M}" y="{H - 30}" font-size="13" fill="{INK3}">IGN / CNIG WMS, CC BY 4.0: Minutas cartográficas (1895), Primera edición MTN50 (1932) and MTN25 · all maps at one scale, at their true place</text>')

font_css = ''
if FONT_DIR:
    b64 = lambda n: base64.b64encode(open(os.path.join(FONT_DIR, n), 'rb').read()).decode()
    font_css = (f"@font-face{{font-family:'Plex';src:url(data:font/ttf;base64,{b64('IBMPlexSans-Regular.ttf')});font-weight:400}}"
                f"@font-face{{font-family:'Plex';src:url(data:font/ttf;base64,{b64('IBMPlexSans-SemiBold.ttf')});font-weight:500 700}}")
doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
       f'<style>{font_css}text{{font-family:Plex,"IBM Plex Sans",Arial,sans-serif}}</style><rect width="{W}" height="{H}" fill="#F5F5F5"/>'
       + ''.join(svg) + '</svg>')
open(os.path.join(OUT, 'hist_stack.svg'), 'w').write(doc)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
    pg.set_content(f'<html><body style="margin:0">{doc}</body></html>', wait_until='load'); pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(OUT, 'hist_stack.png'))
    pg.pdf(path=os.path.join(OUT, 'hist_stack.pdf'), width=f'{W / 96:.3f}in', height=f'{H / 96:.3f}in', print_background=True,
           margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
    b.close()
print('written', os.path.join(OUT, 'hist_stack.png'))
