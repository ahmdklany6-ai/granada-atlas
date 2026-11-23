#!/usr/bin/env python3
"""Build 5.48 — 10 m contours around the air base. data/vec/contours_10m.json was cut to the urban study mask (GHSL urban
centre + 500 m), so the base and the towns south and west of it had none. Inside the base frame (EPSG:25830 x 437500–449500,
y 4103500–4113500, the frame of data/ex13b) the lines are drawn again from the same IGN MDT25 the site already holds
(data/terrain/dem_mdt25.bin, 25 m) with marching squares, so nothing is drawn
twice: the new lines are kept only outside the urban study mask (the GHSL urban centre in data/vec/admin.json + 500 m), and the
existing lines are left as they were. Same properties (elev, idx = every 50 m) and the same 2 m simplification. Usage: python3 tools/build_contours_base.py"""
import json, os
import numpy as np
from pyproj import Transformer
from shapely.geometry import shape, mapping, LineString, MultiLineString, box
from shapely.ops import transform as T
from skimage import measure
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = json.load(open(os.path.join(ROOT, 'data/manifest.json'))); dem = M['terrain']['dem']
A = np.fromfile(os.path.join(ROOT, 'data', dem['file']), dtype='<i2').reshape(dem['height'], dem['width']).astype(float); A[A == dem['nodata']] = np.nan
F = (437500, 4103500, 449500, 4113500)
u2ll = Transformer.from_crs(25830, 4326, always_xy=True).transform; ll2u = Transformer.from_crs(4326, 25830, always_xy=True).transform
c0 = int((F[0] - dem['ox']) / dem['px']) - 2; c1 = int((F[2] - dem['ox']) / dem['px']) + 3; r0 = max(0, int((dem['oy'] - F[3]) / dem['py']) - 2); r1 = min(dem['height'], int((dem['oy'] - F[1]) / dem['py']) + 3)
sub = A[r0:r1, c0:c1]
uc = next(f for f in json.load(open(os.path.join(ROOT, 'data/vec/admin.json')))['features'] if f['properties'].get('kind') == 'urban_centre')
MASK = T(lambda x, y, z=None: ll2u(x, y), shape(uc['geometry'])).buffer(500)
FR = box(*F).difference(MASK)  # the frame, minus where the 10 m lines already exist
lo, hi = int(np.nanmin(sub) // 10 * 10), int(np.nanmax(sub) // 10 * 10 + 10)
new = {}
for z in range(lo, hi + 1, 10):
    parts = []
    for cs in measure.find_contours(sub, z):
        if len(cs) < 3: continue
        pts = [(dem['ox'] + (c0 + c + 0.5) * dem['px'], dem['oy'] - (r0 + r + 0.5) * dem['py']) for r, c in cs]
        g = LineString(pts).intersection(FR)
        if g.is_empty: continue
        g = g.simplify(2)
        for p in (g.geoms if hasattr(g, 'geoms') else [g]):
            if p.geom_type == 'LineString' and p.length > 20: parts.append(p)
    if parts: new[z] = parts
old = json.load(open(os.path.join(ROOT, 'data/vec/contours_10m.json')))
old['features'] = [f for f in old['features'] if not f['properties'].get('ext')]  # re-runnable: drop lines this tool added before
out = list(old['features'])
r6 = lambda o: [r6(v) for v in o] if isinstance(o, (list, tuple)) else round(o, 6)
for z, parts in sorted(new.items()):
    g = T(lambda x, y, zz=None: u2ll(x, y), MultiLineString(parts))
    out.append({'type': 'Feature', 'properties': {'elev': z, 'idx': 1 if z % 50 == 0 else 0, 'ext': 1}, 'geometry': {'type': 'MultiLineString', 'coordinates': r6(mapping(g)['coordinates'])}})
for f in out[len(old['features']):]:
    gm = f['geometry']
    if gm['type'] == 'LineString': f['geometry'] = {'type': 'MultiLineString', 'coordinates': [r6(gm['coordinates'])]}
    elif gm['type'] == 'MultiLineString': f['geometry'] = {'type': 'MultiLineString', 'coordinates': r6(gm['coordinates'])}
    else: f['geometry'] = {'type': 'MultiLineString', 'coordinates': [r6(l.coords[:]) for l in shape(gm).geoms if l.geom_type == 'LineString']}
p = os.path.join(ROOT, 'data/vec/contours_10m.json'); json.dump({'type': 'FeatureCollection', 'features': out}, open(p, 'w'), separators=(',', ':'))
print('contours', len(old['features']), '->', len(out), 'features;', sum(len(v) for v in new.values()), 'new pieces in the frame,', lo, '-', hi, 'm;', os.path.getsize(p), 'bytes')
