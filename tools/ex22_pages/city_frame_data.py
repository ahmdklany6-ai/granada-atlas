"""Builds a frame JSON in the shape tools/ex22_pages/base_plan.py reads, for any EPSG:25830 box, from the repository's OSM tiles
(data/vec/buildings, streets, landuse; data/vec/water.json). Land-use polygons stand in for the field parcels (no Catastro parcels
for the city here). No base outline (base_plan.py skips it when empty).
Usage: python3 tools/ex22_pages/city_frame_data.py <x0> <y0> <x1> <y1> <out.json>
Not part of the site or of the tests."""
import os, sys, json, glob
import numpy as np
from shapely.geometry import shape, box, mapping
from shapely import transform as stransform
from pyproj import Transformer

X0, Y0, X1, Y1 = map(float, sys.argv[1:5]); OUTF = sys.argv[5]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
T = Transformer.from_crs(4326, 25830, always_xy=True)
to_utm = lambda g: stransform(g, lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1])))
FR = box(X0, Y0, X1, Y1)


def tiles(kind):
    for f in [q for q in glob.glob(os.path.join(ROOT, "data", "vec", kind, "*.json")) if "_" in os.path.basename(q)]:
        a, b = os.path.basename(f)[:-5].split('_')                    # tile names are km of UTM: "436_4106"
        tx, ty = int(a) * 1000, int(b) * 1000
        if tx + 1000 < X0 or tx > X1 or ty + 1000 < Y0 or ty > Y1: continue
        yield from json.load(open(f))['features']


def rings_of(g):
    g = g.intersection(FR)
    if g.is_empty: return None
    m = mapping(g)['coordinates']
    return m if g.geom_type in ('MultiPolygon', 'MultiLineString') else [m]


out = dict(frame=[X0, Y0, X1, Y1], buildings=[], parcels=[], streets=[], water=[], base=[], metro_ext=[])
seen = set()
for ft in tiles('buildings'):
    i = ft['properties'].get('id')
    if i in seen: continue
    seen.add(i); r = rings_of(to_utm(shape(ft['geometry'])))
    if r: out['buildings'].append({'r': r, 'lv': 1})
seen = set()
for ft in tiles('streets'):
    i = ft['properties'].get('id')
    if i in seen: continue
    seen.add(i); r = rings_of(to_utm(shape(ft['geometry'])))
    if r: out['streets'].append({'r': r, 'hw': ft['properties'].get('hw')})
seen = set()
FIELD = ('farmland', 'orchard', 'meadow', 'grass', 'vineyard', 'farmyard', 'greenhouse_horticulture', 'allotments', 'plant_nursery')
for ft in tiles('landuse'):
    i = ft['properties'].get('id')
    if i in seen or ft['properties'].get('lu') not in FIELD: continue
    seen.add(i); g = to_utm(shape(ft['geometry'])).buffer(0).intersection(FR)
    for p in ([g] if g.geom_type == 'Polygon' else [q for q in getattr(g, 'geoms', []) if q.geom_type == 'Polygon']):
        out['parcels'].append([list(p.exterior.coords)] + [list(r.coords) for r in p.interiors])
for ft in json.load(open(os.path.join(ROOT, 'data', 'vec', 'water.json')))['features']:
    if ft['geometry']['type'] not in ('LineString', 'MultiLineString'): continue
    r = rings_of(to_utm(shape(ft['geometry'])))
    if r: out['water'].append({'r': r, 'ww': ft['properties'].get('ww'), 'nm': ft['properties'].get('nm')})
if os.environ.get('BASE_FROM'):   # the base's outline from a frame built by build_ex22_frame.py (ALL.json)
    out['base'] = json.load(open(os.environ['BASE_FROM']))['base']
json.dump(out, open(OUTF, 'w'))
print(OUTF, {k: len(v) for k, v in out.items() if isinstance(v, list)})
