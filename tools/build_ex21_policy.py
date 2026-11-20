#!/usr/bin/env python3
"""Exercise 2.1/2.2 — the policy map series (owner, 20 Nov 2026): who decides about the base land, who holds which piece of it.

- Municipal outlines of the five towns, PRECISE: the union of each municipality's cadastral zoning (Dirección General del
  Catastro, INSPIRE CadastralParcels, $CP = folder with cp<code>/A.ES.SDGC.CP.<code>.cadastralzoning.gml), clipped to a frame
  around the base. (data/vec/tour_area.json outlines are quantised to ~200 m: not good enough to split the base.)
- The base (OSM way 130984030, data/vec/base_edge.json) split by those outlines: km² per municipality.
- muni_km2: each municipality's whole area measured on that outline (so: which share of a town's territory the base takes).
- Scenario numbers from data/ex21/time.json (INE pace 2015–2025 continued; the base built at the towns' median density).
Output: data/ex21/policy.json. Usage: CP=… python3 tools/build_ex21_policy.py"""
import json, os, sys
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon, shape, box, mapping
from shapely.ops import unary_union, transform
from pyproj import Transformer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); CP = os.environ['CP']
TOWNS = {'18022': 'Armilla', '18064': 'Churriana de la Vega', '18083': 'Las Gabias', '18148': 'Ogíjares', '18015': 'Alhendín'}
F = (438600, 4105000, 448000, 4113400); FB = box(*F)
G = '{http://www.opengis.net/gml/3.2}'
fwd = Transformer.from_crs(4326, 25830, always_xy=True).transform
def zones(fn):
    out = []
    for ev, el in ET.iterparse(fn, events=('end',)):
        if el.tag == G + 'PolygonPatch' or el.tag == G + 'Polygon':
            ext = el.find(f'.//{G}exterior//{G}posList')
            if ext is not None:
                v = [float(x) for x in ext.text.split()]; c = list(zip(v[0::2], v[1::2]))
                holes = [[tuple(p) for p in zip(*[iter(float(x) for x in r.text.split())] * 2)] for r in el.findall(f'{G}interior//{G}posList')]
                if len(c) >= 4:
                    p = Polygon(c, [h for h in holes if len(h) >= 4]); out.append(p if p.is_valid else p.buffer(0))
            el.clear()
    return out
muni = {}
for code, nm in TOWNS.items():
    zs = zones(os.path.join(CP, f'cp{code}', f'A.ES.SDGC.CP.{code}.cadastralzoning.gml'))
    u = unary_union([z.buffer(0.5) for z in zs]).buffer(-0.5)
    u = unary_union([p for p in (u.geoms if hasattr(u, 'geoms') else [u]) if p.area > 20000])   # drop slivers
    # fill tiny gaps between zones (streets between blocks are part of the municipality)
    u = u.buffer(15).buffer(-15); muni[nm] = u; print(nm, round(u.area / 1e6, 2), 'km2 municipality', file=sys.stderr)
edge = json.load(open(os.path.join(ROOT, 'data/vec/base_edge.json')))
import shapely
base = transform(fwd, shape(next(f for f in edge['features'] if f['properties'].get('k') == 'base')['geometry']))
print('base', round(base.area / 1e6, 3), 'km2', file=sys.stderr)
split = {}; got = 0
for nm, u in muni.items():
    a = base.intersection(u).area; split[nm] = round(a / 1e6, 3); got += a
print('base split', split, 'sum', round(got / 1e6, 3), file=sys.stderr)
rd = lambda g: [[[round(x, 1), round(y, 1)] for x, y in r.coords] for r in ([g.exterior] + list(g.interiors))]
def rings(g):
    g = g.simplify(3)
    return [rd(p) for p in (g.geoms if hasattr(g, 'geoms') else [g]) if not p.is_empty]
pieces = {nm: rings(base.intersection(u)) for nm, u in muni.items() if base.intersection(u).area > 100}
T = json.load(open(os.path.join(ROOT, 'data/ex21/time.json')))
out = {'frame': list(F), 'muni': {nm: rings(u.intersection(FB.buffer(3000))) for nm, u in muni.items()}, 'base_km2': round(base.area / 1e6, 3),
       'base_split_km2': split, 'muni_km2': {nm: round(u.area / 1e6, 2) for nm, u in muni.items()}, 'base_split_unassigned_km2': round((base.area - got) / 1e6, 3), 'base_pieces': pieces,
       'scenario': {'pop_2025': T['projection']['five']['2025'], 'pop_2045': T['projection']['five']['2045'], 'dwellings_needed_2045': T['projection']['five']['dwellings_needed_2045'],
                    'rate_pct': T['projection']['five']['rate_pct'], 'base_dwellings_at_town_density': T['base_scenario']['dwellings'], 'base_residents': T['base_scenario']['residents'],
                    'median_dw_per_ha': T['base_scenario']['median_dw_per_ha'], 'persons_per_dwelling': T['base_scenario']['persons_per_dwelling']},
       'sources': 'Municipal outlines: D. G. del Catastro, INSPIRE CadastralParcels (cadastral zoning), downloaded 20 Nov 2026. Base: OpenStreetMap way 130984030. Scenario: INE padrón 2015–2025 (data/ex21/time.json).'}
json.dump(out, open(os.path.join(ROOT, 'data/ex21/policy.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
