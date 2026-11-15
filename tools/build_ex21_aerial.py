"""Exercise 2.1 — the aerial photo of each 1:500 window (owner request, 15 Nov 2026: "the areas with aerial photos").

Source: PNOA "máxima actualidad" orthophoto, Instituto Geográfico Nacional (IGN/CNIG), WMS
https://www.ign.es/wms-inspire/pnoa-ma (layer OI.OrthoimageCoverage) — CC BY 4.0, credit "PNOA © Instituto Geográfico
Nacional de España". The flight date and the ground resolution of each window are read from the same service
(GetFeatureInfo on OI.MosaicElement) and written to index.json, so the page can say when the photo was taken.
Nothing is edited: the picture is stored as served (JPEG), cut to the window of data/ex21/areas.json.

The official photo blurs part of the base (a smooth brown surface with a sharp edge). That is measured, not assumed:
'base_blurred_share' = the share of the pixels inside the base outline (OSM) whose grey value has almost no local
variation (standard deviation < 1.2 of 255 in a window of about 1 m) — close to 1 where the base is blurred, close
to 0 where the photo shows its land.

Output: $OUT (default data/ex21/aerial)/<id>.jpg at $SIZE px per side (default 1040 = 0.125 m per pixel for the 130 m
window; use SIZE=2080 OUT=exports/ex21_aerial for print at 1:500 / 200 dpi) and index.json.
Usage: python3 tools/build_ex21_aerial.py"""
import io, json, os, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('OUT', os.path.join(ROOT, 'data/ex21/aerial')); SIZE = int(os.environ.get('SIZE', 1040))
WMS = 'https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&CRS=EPSG:25830&BBOX={x0},{y0},{x1},{y1}'
MAP = WMS + '&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage&STYLES=&WIDTH={s}&HEIGHT={s}&FORMAT=image/jpeg'
INFO = WMS + '&REQUEST=GetFeatureInfo&LAYERS=OI.MosaicElement&QUERY_LAYERS=OI.MosaicElement&INFO_FORMAT=application/json&WIDTH=101&HEIGHT=101&I=50&J=50'


def get(url):
    for i in range(4):
        try: return urllib.request.urlopen(url, timeout=120).read()
        except Exception as e: err = e
    raise err


def blurred_share(im, a):
    x0, y0, x1, y1 = a['extent']; S = im.size[0]; m = Image.new('L', (S, S), 0); dr = ImageDraw.Draw(m)
    for poly in a['base']:
        for i, ring in enumerate(poly): dr.polygon([((x - x0) / (x1 - x0) * S, (y1 - y) / (y1 - y0) * S) for x, y in ring], fill=255 if i == 0 else 0)
    M = np.asarray(m) > 0
    if not M.any(): return None
    G = np.asarray(im.convert('L')).astype(float); w = max(3, int(round(S / 130)))  # about 1 m
    mean = ndimage.uniform_filter(G, w); sd = np.sqrt(np.maximum(0, ndimage.uniform_filter(G * G, w) - mean * mean))
    return round(float((sd[M] < 1.2).mean()), 2)


def main():
    d = json.load(open(os.path.join(ROOT, 'data/ex21/areas.json'))); os.makedirs(OUT, exist_ok=True); idx = {}
    for a in d['areas']:
        x0, y0, x1, y1 = a['extent']; raw = get(MAP.format(x0=x0, y0=y0, x1=x1, y1=y1, s=SIZE))
        im = Image.open(io.BytesIO(raw)); assert im.size == (SIZE, SIZE), 'PNOA WMS did not return the frame'
        open(os.path.join(OUT, a['id'] + '.jpg'), 'wb').write(raw)
        try: p = json.loads(get(INFO.format(x0=x0, y0=y0, x1=x1, y1=y1)).decode('utf-8', 'replace'))['features'][0]['properties']
        except Exception: p = {}
        idx[a['id']] = {'file': a['id'] + '.jpg', 'px': SIZE, 'extent': a['extent'], 'flight': p.get('Fecha'), 'resolution_m': float(p['Resolucion']) if p.get('Resolucion') else None,
                        'base_blurred_share': blurred_share(im, a)}
        print(a['id'], len(raw) // 1000, 'kB', idx[a['id']]['flight'], idx[a['id']]['resolution_m'], 'blurred share of the base:', idx[a['id']]['base_blurred_share'])
    json.dump({'source': 'PNOA máxima actualidad, orthophoto — © Instituto Geográfico Nacional de España (IGN/CNIG), CC BY 4.0; WMS www.ign.es/wms-inspire/pnoa-ma',
               'note': 'stored as served (not edited); flight date and resolution as reported by the service for the centre of each window; base_blurred_share = share of the pixels inside the OSM base outline with almost no local variation (blurred at the source)',
               'areas': idx}, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
