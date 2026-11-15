"""Exercise 2.1 — tree canopy in the eight 1:500 windows, detected from the PNOA orthophoto (IGN WMS, CC BY 4.0).

OSM maps no single trees in these windows, so (owner request, 14 Nov 2026: "there are no trees in the sections") the
crowns are read from the aerial photo: pixels that are clearly green (excess-green index) and darker than lawns, grouped
into connected blobs ≥ 3 m². Each blob → one crown [x, y, diameter m]. Approximate: a hedge or a dark lawn can pass, a
small or leafless tree can be missed, and the tree HEIGHT is not measured (the sections draw it schematically).
Writes 'canopy' into data/ex21/areas.json and a check image per window into $CHECK (optional)."""
import io, json, os, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.environ.get('AREAS', os.path.join(ROOT, 'data/ex21/areas.json'))  # AREAS=data/ex21/factory_areas.json for the factory set
PX = 0.25  # m per pixel
WMS = ('https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=OI.OrthoimageCoverage&STYLES='
       '&CRS=EPSG:25830&BBOX={x0},{y0},{x1},{y1}&WIDTH={w}&HEIGHT={h}&FORMAT=image/png')
CHECK = os.environ.get('CHECK')

d = json.load(open(P))
for a in d['areas']:
    x0, y0, x1, y1 = a['extent']; w = h = int(round((x1 - x0) / PX))
    img = Image.open(io.BytesIO(urllib.request.urlopen(WMS.format(x0=x0, y0=y0, x1=x1, y1=y1, w=w, h=h), timeout=120).read())).convert('RGB')
    A = np.asarray(img).astype(float); R, G, B = A[..., 0], A[..., 1], A[..., 2]
    exg = 2 * G - R - B; v = A.max(axis=2)
    mask = (exg > 18) & (v < 150) & (G > B)  # green and fairly dark: crowns (with their own shade), not dry fields or roofs
    mask = ndimage.binary_opening(mask, iterations=1); mask = ndimage.binary_closing(mask, iterations=2)
    lab, n = ndimage.label(mask); crowns = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        area = (lab[sl] == i).sum() * PX * PX
        if area < 3: continue
        cy, cx = ndimage.center_of_mass(lab == i)
        hh, ww = (sl[0].stop - sl[0].start) * PX, (sl[1].stop - sl[1].start) * PX
        if area > 150 or max(hh, ww) > 25:  # a row / a big green mass: split into crowns of about 5 m along it
            ys, xs = np.nonzero(lab == i)
            for gx in range(int(xs.min()), int(xs.max()) + 1, 20):
                for gy in range(int(ys.min()), int(ys.max()) + 1, 20):
                    m = (xs >= gx) & (xs < gx + 20) & (ys >= gy) & (ys < gy + 20)
                    if m.sum() * PX * PX >= 6: crowns.append([round(x0 + xs[m].mean() * PX, 1), round(y1 - ys[m].mean() * PX, 1), 5.0])
            continue
        crowns.append([round(x0 + cx * PX, 1), round(y1 - cy * PX, 1), round(2 * (area / np.pi) ** 0.5, 1)])
    a['canopy'] = crowns; a['stats']['canopy'] = len(crowns)
    print(a['id'], 'crowns', len(crowns))
    if CHECK:
        os.makedirs(CHECK, exist_ok=True); dr = ImageDraw.Draw(img)
        for cx, cy, dm in crowns:
            px, py, r = (cx - x0) / PX, (y1 - cy) / PX, dm / 2 / PX
            dr.ellipse([px - r, py - r, px + r, py + r], outline=(153, 43, 42), width=2)
        img.save(os.path.join(CHECK, f'canopy_{a["id"]}.jpg'), quality=85)
if 'tree crowns' not in d['sources']: d['sources'] = d['sources'].rstrip('.') + '; tree crowns: detected from the PNOA orthophoto (IGN, CC BY 4.0), approximate'
json.dump(d, open(P, 'w'), separators=(',', ':'))
