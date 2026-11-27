"""Presentation · Granada's growth as a collage of the old maps and aerial photos themselves (owner, 27 Nov 2026: "try it on the
old maps; they need not be the same size: one map on the right half, the rest continuing below, like a collage").
Panels (1920 x 1080 slide): the IGN MTN50 map of 1932 on the right half; on the left the AMS aerial photo of 1956, the
Interministerial flight (1973–86) with the 1975 extent, OLISTAT (1997–98) with the 2000 extent and PNOA 2019 with the 2020 extent (the WMS has no 2020 or 2021 flight over Granada).
Each panel: the map / photo in greys, the city's extent of that year in the studio red (the extents up to then merged, as on the
history map), the year, a scale bar. Each panel has its own scale (they are framed on their own extent).
Sources: IGN / CNIG WMS (Primera edición MTN, PNOA histórico), CC BY 4.0; extents: data/ref/history_extents.json.
Writes <out>/hist_collage.png / .svg / .pdf and the panels' raw images (wms_*.jpg).
Usage: python3 tools/ex22_pages/history_collage.py <out dir>      (FONT_DIR: IBM Plex Sans, not committed)
Not part of the site or of the tests."""
import os, sys, json, html, base64, io, urllib.request, urllib.parse
import numpy as np
from PIL import Image, ImageOps, ImageEnhance
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely import transform as stransform
from pyproj import Transformer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
FONT_DIR = os.environ.get('FONT_DIR', '')
RED, INK, INK3 = _bw._P['red'], '#1A1A1A', '#5F5F5F'
W, H, GAP = 1920, 1080, 12
T = Transformer.from_crs(4326, 25830, always_xy=True)
to_utm = lambda g: stransform(g, lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
ext = json.load(open(os.path.join(ROOT, 'data', 'ref', 'history_extents.json')))['extents']
ORDER = ['mtn50_1932', 'ams_1956', 'ghsl_1975', 'ghsl_1990', 'ghsl_2000', 'ghsl_2020']
geo = {k: to_utm(shape(ext[k]['geometry'])).buffer(0) for k in ORDER}
upto = lambda k: unary_union([geo[q] for q in ORDER[:ORDER.index(k) + 1]])
MTN, HIST = 'https://www.ign.es/wms/primera-edicion-mtn', 'https://www.ign.es/wms/pnoa-historico'
# panel: (key, year shown, what it is, wms url, layer, x, y, w, h)
half = (W - GAP) // 2; col = (half - GAP) // 2; row = (H - GAP) // 2
PANELS = [('mtn50_1932', '1932', 'IGN map 1:50,000, 1st edition', MTN, 'MTN50', half + GAP, 0, W - half - GAP, H),
          ('ams_1956', '1956', 'aerial photo, American flight', HIST, 'AMS_1956-1957', 0, 0, col, row),
          ('ghsl_1975', '1975', 'aerial photo, Interministerial flight 1973–86', HIST, 'Interministerial_1973-1986', col + GAP, 0, half - col - GAP, row),
          ('ghsl_2000', '2000', 'aerial photo, OLISTAT 1997–98', HIST, 'OLISTAT', 0, row + GAP, col, H - row - GAP),
          ('ghsl_2020', '2020', 'aerial photo, PNOA 2019 (no 2020–21 flight here)', HIST, 'PNOA2019', col + GAP, row + GAP, half - col - GAP, H - row - GAP)]
SS = 2   # image pixels per slide unit


def bbox_for(g, w, h, pad=350):
    x0, y0, x1, y1 = g.bounds; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; s = max((x1 - x0) / w, (y1 - y0) / h)   # metres per unit, the panel's aspect kept
    return cx - w * s / 2, cy - h * s / 2, cx + w * s / 2, cy + h * s / 2, s


def wms(url, layer, bb, w, h, name):
    fp = os.path.join(OUT, f'wms_{name}.jpg')
    if not os.path.exists(fp):
        q = dict(SERVICE='WMS', VERSION='1.3.0', REQUEST='GetMap', LAYERS=layer, STYLES='', CRS='EPSG:25830',
                 BBOX=','.join('%.1f' % v for v in bb[:4]), WIDTH=w * SS, HEIGHT=h * SS, FORMAT='image/jpeg')
        with urllib.request.urlopen(url + '?' + urllib.parse.urlencode(q), timeout=120) as r: data = r.read()
        Image.open(io.BytesIO(data)).convert('RGB').save(fp, quality=92)
    im = Image.open(fp).convert('L')
    im = ImageOps.autocontrast(im, cutoff=1)
    im = Image.eval(im, lambda v: int(95 + v * 0.62))                        # greys, lifted: the red reads on top
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=88); return base64.b64encode(buf.getvalue()).decode()


esc = lambda s: html.escape(s, quote=True)


def text(x, y, s, size, fill, weight=400, anchor='start', halo=True):
    a = f'x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"'
    return (f'<text {a} fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round">{esc(s)}</text>' if halo else '') + f'<text {a} fill="{fill}">{esc(s)}</text>'


svg = []
for key, yr, what, url, layer, x, y, w, h in PANELS:
    g = upto(key); bb = bbox_for(g, w, h); s = bb[4]
    f = lambda X, Y: (x + (X - bb[0]) / s, y + (bb[3] - Y) / s)
    img = wms(url, layer, bb, w, h, key)
    polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
    d = ''.join('M' + 'L'.join('%.1f,%.1f' % f(*c) for c in r.coords) + 'Z' for p in polys for r in [p.exterior] + list(p.interiors))
    svg.append(f'<clipPath id="c{key}"><rect x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath><g clip-path="url(#c{key})">'
               f'<image href="data:image/jpeg;base64,{img}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="none"/>'
               f'<path d="{d}" fill="{RED}" fill-opacity="0.28" stroke="{RED}" stroke-width="3" stroke-linejoin="round" fill-rule="evenodd"/></g>')
    big = w > 700
    svg.append(text(x + 24, y + (92 if big else 62), yr, 80 if big else 52, RED, 600))
    svg.append(text(x + 26, y + (124 if big else 88), what, 18 if big else 15, INK, 400))
    km = 1 if w * s < 6000 else 2; bw = km * 1000 / s; bx, by = x + w - bw - 30, y + h - 40   # scale bar, its own per panel
    svg.append(f'<rect x="{bx - 10:.1f}" y="{by - 14:.1f}" width="{bw + 46:.1f}" height="42" fill="#FFFFFF" fill-opacity="0.85"/>'
               f'<rect x="{bx:.1f}" y="{by}" width="{bw / 2:.1f}" height="6" fill="{INK}"/><rect x="{bx + bw / 2:.1f}" y="{by}" width="{bw / 2:.1f}" height="6" fill="#FFFFFF" stroke="{INK}" stroke-width="1"/>'
               + text(bx, by + 22, '0', 13, INK3, anchor='middle', halo=False) + text(bx + bw, by + 22, f'{km} km', 13, INK3, anchor='middle', halo=False))
svg.append(text(W - 16, H - 12, 'IGN / CNIG WMS (MTN50 1st ed., PNOA histórico), CC BY 4.0 · red: the built-up extent that year (1932, 1956 traced; 1975–2020 JRC GHSL, 2020 modelled)', 12, INK3, anchor='end'))

font_css = ''
if FONT_DIR:
    b64 = lambda n: base64.b64encode(open(os.path.join(FONT_DIR, n), 'rb').read()).decode()
    font_css = (f"@font-face{{font-family:'Plex';src:url(data:font/ttf;base64,{b64('IBMPlexSans-Regular.ttf')});font-weight:400}}"
                f"@font-face{{font-family:'Plex';src:url(data:font/ttf;base64,{b64('IBMPlexSans-SemiBold.ttf')});font-weight:500 700}}")
doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
       f'<style>{font_css}text{{font-family:Plex,"IBM Plex Sans",Arial,sans-serif}}</style><rect width="{W}" height="{H}" fill="#FFFFFF"/>'
       + ''.join(svg) + '</svg>')
open(os.path.join(OUT, 'hist_collage.svg'), 'w').write(doc)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
    pg.set_content(f'<html><body style="margin:0">{doc}</body></html>', wait_until='load'); pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(OUT, 'hist_collage.png'))
    pg.pdf(path=os.path.join(OUT, 'hist_collage.pdf'), width=f'{W / 96:.3f}in', height=f'{H / 96:.3f}in', print_background=True,
           margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
    b.close()
print('written', os.path.join(OUT, 'hist_collage.png'))
