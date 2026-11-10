#!/usr/bin/env python3
"""Build 5.33 — the built-up area (núcleo urbano) of the five towns around the Base Aérea de Armilla, for the story tour
(data/vec/tour_towns.json). Same method for all five:
  1. OpenStreetMap landuse=residential areas (ways and multipolygons) read from the OSM API in 0.01° tiles ($CACHE, shared
     with tools/build_base_edge.py), in EPSG:25830;
  2. kept when they lie in the town's municipality (outline from npm es-atlas 0.6.0 / IGN, ~200 m precision; $ESATLAS);
  3. dissolved with a 40 m closing (buffer +40 m, −40 m) so blocks split by streets form one area;
  4. the part that contains (or is nearest to) the town's OSM place node is the town's núcleo; other villages of the same
     municipality (e.g. Gabia Chica, Híjar) are left out;
  5. simplified by 5 m.
A town without residential areas near its place node gets no shape (reported, never invented).
"""
import json, os, sys, time, urllib.request, xml.etree.ElementTree as ET
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, Point, mapping, shape
from shapely.ops import unary_union, polygonize, transform as shp_transform

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('CACHE', os.path.join(ROOT, '.cache', 'osm_base'))
ESATLAS = os.environ.get('ESATLAS')
OUT = os.path.join(ROOT, 'data', 'vec', 'tour_towns.json')
BBOX = (-3.705, 37.085, -3.575, 37.175)
API = 'https://api.openstreetmap.org/api/0.6/map?bbox={:.3f},{:.3f},{:.3f},{:.3f}'
UA = 'granada-atlas-build/5.33 (static urban-analysis site; one-off build)'
TOWNS = [('Armilla', 'Armilla', '18021'), ('Churriana de la Vega', 'Churriana de la Vega', '18062'), ('Las Gabias', 'Gabia Grande', '18905'),
         ('Alhendín', 'Alhendín', '18014'), ('Ogíjares', 'Ogíjares', '18145')]
fwd = Transformer.from_crs(4326, 25830, always_xy=True).transform
inv = Transformer.from_crs(25830, 4326, always_xy=True).transform


def tiles():
    os.makedirs(CACHE, exist_ok=True); nodes, ways, rels, places = {}, {}, {}, {}
    x0, y0, x1, y1 = BBOX; nx_, ny_ = round((x1 - x0) / 0.01), round((y1 - y0) / 0.01)
    for i in range(nx_):
        for j in range(ny_):
            b = (x0 + i * 0.01, y0 + j * 0.01, x0 + (i + 1) * 0.01, y0 + (j + 1) * 0.01)
            fn = os.path.join(CACHE, 'tile_{:.3f}_{:.3f}.osm'.format(b[0], b[1]))
            if not os.path.exists(fn):
                for k in range(5):
                    try:
                        data = urllib.request.urlopen(urllib.request.Request(API.format(*b), headers={'User-Agent': UA}), timeout=120).read(); open(fn, 'wb').write(data); break
                    except Exception as e:
                        print('retry', b, e, file=sys.stderr); time.sleep(2 ** k * 2)
                else:
                    sys.exit('OSM API failed for %s' % (b,))
                time.sleep(1)
            r = ET.parse(fn).getroot()
            for n in r.iter('node'):
                nodes[int(n.get('id'))] = (float(n.get('lon')), float(n.get('lat')))
                tg = {t.get('k'): t.get('v') for t in n.iter('tag')}
                if tg.get('place') in ('town', 'village', 'city') and tg.get('name'): places[tg['name']] = nodes[int(n.get('id'))]
            for w in r.iter('way'): ways[int(w.get('id'))] = {'nd': [int(x.get('ref')) for x in w.iter('nd')], 'tags': {t.get('k'): t.get('v') for t in w.iter('tag')}}
            for rl in r.iter('relation'): rels[int(rl.get('id'))] = {'m': [(m.get('type'), int(m.get('ref')), m.get('role')) for m in rl.iter('member')], 'tags': {t.get('k'): t.get('v') for t in rl.iter('tag')}}
    print(f'{nx_ * ny_} tiles, {len(ways)} ways', file=sys.stderr); return nodes, ways, rels, places


def munis(path, codes):
    d = json.load(open(path)); tr = d['transform']; sx, sy = tr['scale']; tx, ty = tr['translate']; arcs = []
    for a in d['arcs']:
        x = y = 0; pts = []
        for dx, dy in a: x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    arc = lambda i: arcs[i] if i >= 0 else arcs[~i][::-1]
    def ring(ix):
        pts = []
        for i in ix: a = arc(i); pts.extend(a if not pts else a[1:])
        return [fwd(*p) for p in pts]
    out = {}
    for g in d['objects']['municipalities']['geometries']:
        if g['id'] not in codes: continue
        polys = [g['arcs']] if g['type'] == 'Polygon' else g['arcs']
        out[g['id']] = unary_union([Polygon(ring(p[0]), [ring(h) for h in p[1:]]).buffer(0) for p in polys])
    return out


def main():
    nodes, ways, rels, places = tiles(); P = {k: fwd(*v) for k, v in nodes.items()}
    line = lambda w: [P[n] for n in w['nd'] if n in P]
    res = []
    for wid, w in ways.items():
        if w['tags'].get('landuse') != 'residential': continue
        c = line(w)
        if len(c) >= 4 and w['nd'][0] == w['nd'][-1]: res.append(Polygon(c).buffer(0))
    for rid, r in rels.items():
        if r['tags'].get('landuse') != 'residential' or r['tags'].get('type') != 'multipolygon': continue
        lo = [LineString(line(ways[ref])) for (t, ref, role) in r['m'] if t == 'way' and role in ('outer', '') and ref in ways and len(line(ways[ref])) > 1]
        li = [LineString(line(ways[ref])) for (t, ref, role) in r['m'] if t == 'way' and role == 'inner' and ref in ways and len(line(ways[ref])) > 1]
        if not lo: continue
        g = unary_union(list(polygonize(unary_union(lo))))
        if li: g = g.difference(unary_union(list(polygonize(unary_union(li)))))
        res.append(g)
    M = munis(ESATLAS, [c for _, _, c in TOWNS]); feats = []; report = {}
    for name, place, code in TOWNS:
        pn = places.get(place)
        if not pn: report[name] = 'no OSM place node'; continue
        pt = Point(fwd(*pn)); mu = M[code].buffer(150)
        mine = [g for g in res if mu.contains(g.representative_point())]
        if not mine: report[name] = 'no residential areas'; continue
        closed = unary_union(mine).buffer(40).buffer(-40)
        parts = list(closed.geoms) if closed.geom_type == 'MultiPolygon' else [closed]
        core = min(parts, key=lambda p: p.distance(pt))
        if core.distance(pt) > 600: report[name] = f'nearest residential area {core.distance(pt):.0f} m from the town node'; continue
        core = core.simplify(5)
        ll = shp_transform(lambda x, y, z=None: inv(x, y), core)
        rnd = lambda o: [rnd(v) for v in o] if isinstance(o, (list, tuple)) else round(o, 6)
        geo = mapping(ll); geo = {'type': geo['type'], 'coordinates': rnd(geo['coordinates'])}
        feats.append({'type': 'Feature', 'properties': {'nm': name, 'ine': code, 'osm_place': place, 'area_ha': round(core.area / 1e4, 1), 'parts_in_municipality': len(parts)}, 'geometry': geo})
        report[name] = f'{core.area / 1e4:.1f} ha (from {len(mine)} residential areas; {len(parts)} separate parts in the municipality, the town part kept)'
    json.dump({'type': 'FeatureCollection', 'report': report, 'features': feats}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(json.dumps(report, ensure_ascii=False, indent=1), file=sys.stderr); print('wrote', OUT, os.path.getsize(OUT), file=sys.stderr)


if __name__ == '__main__':
    main()
