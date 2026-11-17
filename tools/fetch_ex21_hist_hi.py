#!/usr/bin/env python3
"""Exercise 2.1: the 1931 map (IGN, MTN50 first edition) and the PNOA 2022 orthophoto of the city frame at 1 m per pixel
(6400 x 5600 px, four WMS tiles each), for the A1 sheet where they are printed at 1:15,000 (the ten pictures of the history
sheet are 1600 x 1400 px, 4 m per pixel: enough for its 150 mm frames, soft at A1). Stored as served, nothing edited: the
publisher's own blur over the base stays. Usage: python3 tools/fetch_ex21_hist_hi.py exports/ex21_time/hist mtn50 pnoa2022
(writes <name>_hi.jpg; tools/ex21_pages/sheets2.py and maps_only.py use them when they are there)."""
import io, sys, time, urllib.request
from PIL import Image
F = (440100, 4106400, 446500, 4112000); W, H = 6400, 5600; OUT = sys.argv[1]
SRC = {'mtn50': ('https://www.ign.es/wms/primera-edicion-mtn', 'MTN50'), 'pnoa2022': ('https://www.ign.es/wms-inspire/pnoa-ma', 'OI.OrthoimageCoverage')}
def get(url):
    for i in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'atlas-print/1.0'}), timeout=180); b = r.read()
            if r.headers.get('Content-Type', '').startswith('image/'): return b
            print('not an image:', r.headers.get('Content-Type'), b[:200], flush=True)
        except Exception as e: print('retry', i, str(e)[:120], flush=True)
        time.sleep(4 + 4 * i)
    raise SystemExit('failed ' + url)
for name in sys.argv[2:]:
    base, lay = SRC[name]; im = Image.new('RGB', (W, H)); nx, ny = 2, 2; tw, th = W // nx, H // ny
    for j in range(ny):
        for i in range(nx):
            x0 = F[0] + (F[2] - F[0]) * i / nx; x1 = F[0] + (F[2] - F[0]) * (i + 1) / nx; y1 = F[3] - (F[3] - F[1]) * j / ny; y0 = F[3] - (F[3] - F[1]) * (j + 1) / ny
            url = f'{base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS={lay}&STYLES=&CRS=EPSG:25830&BBOX={x0},{y0},{x1},{y1}&WIDTH={tw}&HEIGHT={th}&FORMAT=image/jpeg'
            t = Image.open(io.BytesIO(get(url))).convert('RGB'); assert t.size == (tw, th), t.size; im.paste(t, (i * tw, j * th)); print(name, 'tile', i, j, 'ok', flush=True)
    im.save(f'{OUT}/{name}_hi.jpg', quality=92, subsampling=0); print(name, im.size, 'saved', flush=True)
