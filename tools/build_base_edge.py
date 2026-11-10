#!/usr/bin/env python3
"""Build 5.27 — data for the story tour: the edge of the Base Aérea de Armilla (data/vec/base_edge.json).

Reads OpenStreetMap from the OSM API (/api/0.6/map in tiles of 0.01°, cached in $CACHE, default .cache/osm_base) and
measures, in EPSG:25830:
  - the base outline: OSM way 130984030 (landuse=military, aeroway=aerodrome, "Base Aérea de Armilla");
  - the fence split every 25 m, each piece classed by what lies in a 35 m disc 40 m outside it:
      housing  — OSM buildings cover > 8 % of the disc or landuse=residential > 40 % (industry if industrial /
                 commercial / retail land is larger than residential land there);
      industry — landuse industrial / commercial / retail > 40 %;
      road     — a motorway / trunk / primary / secondary (or link) within 30 m of the disc centre;
      green    — parks, gardens, grass, scrub, meadow, recreation grounds > 30 %;
      open     — everything else (untagged land counts as open: OSM maps fields only partly);
  - dead ends: ends (degree 1) of walkable streets (no motorway / trunk, no access=private|no unless foot=yes|designated,
    no foot=no) outside the base and within 80 m of the fence;
  - two walking routes (shortest paths on that network) against the straight line;
  - the 300 m band (outline buffered by 300 m minus the outline) with the OSM land use inside it.
Nothing is estimated: every number is measured on OSM geometry and is only as complete as OSM.
"""
import json, math, os, sys, time, urllib.request, xml.etree.ElementTree as ET
import networkx as nx
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, Point, mapping, shape
from shapely.ops import unary_union, transform as shp_transform

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('CACHE', os.path.join(ROOT, '.cache', 'osm_base'))
OUT = os.path.join(ROOT, 'data', 'vec', 'base_edge.json')
BBOX = (-3.685, 37.095, -3.595, 37.165)  # the base, the five towns' edges and both walking routes
BASE_WAY = 130984030
API = 'https://api.openstreetmap.org/api/0.6/map?bbox={:.3f},{:.3f},{:.3f},{:.3f}'
UA = 'granada-atlas-build/5.27 (static urban-analysis site; one-off build)'

fwd = Transformer.from_crs(4326, 25830, always_xy=True).transform
inv = Transformer.from_crs(25830, 4326, always_xy=True).transform


places = {}
TOWNS = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares']


def fetch_tiles():
    os.makedirs(CACHE, exist_ok=True)
    nodes, ways, rels = {}, {}, {}; places.clear()
    x0, y0, x1, y1 = BBOX
    nx_, ny_ = round((x1 - x0) / 0.01), round((y1 - y0) / 0.01)
    for i in range(nx_):
        for j in range(ny_):
            b = (x0 + i * 0.01, y0 + j * 0.01, x0 + (i + 1) * 0.01, y0 + (j + 1) * 0.01)
            fn = os.path.join(CACHE, 'tile_{:.3f}_{:.3f}.osm'.format(b[0], b[1]))
            if not os.path.exists(fn):
                for k in range(5):
                    try:
                        req = urllib.request.Request(API.format(*b), headers={'User-Agent': UA})
                        data = urllib.request.urlopen(req, timeout=120).read(); open(fn, 'wb').write(data); break
                    except Exception as e:
                        print('retry', b, e, file=sys.stderr); time.sleep(2 ** k * 2)
                else:
                    sys.exit('OSM API failed for tile %s' % (b,))
                time.sleep(1)
            root = ET.parse(fn).getroot()
            for n in root.iter('node'):
                nodes[int(n.get('id'))] = (float(n.get('lon')), float(n.get('lat')))
                tg = {t.get('k'): t.get('v') for t in n.iter('tag')}
                if tg.get('place') in ('city', 'town', 'village') and tg.get('name'): places[int(n.get('id'))] = (tg['name'], tg['place'], nodes[int(n.get('id'))])
            for w in root.iter('way'):
                ways[int(w.get('id'))] = {'nd': [int(x.get('ref')) for x in w.iter('nd')], 'tags': {t.get('k'): t.get('v') for t in w.iter('tag')}}
            for r in root.iter('relation'):
                rels[int(r.get('id'))] = {'m': [(m.get('type'), int(m.get('ref')), m.get('role')) for m in r.iter('member')], 'tags': {t.get('k'): t.get('v') for t in r.iter('tag')}}
    print(f'{nx_ * ny_} tiles: {len(nodes)} nodes, {len(ways)} ways, {len(rels)} relations', file=sys.stderr)
    return nodes, ways, rels


def main():
    nodes, ways, rels = fetch_tiles()
    P = {k: fwd(*v) for k, v in nodes.items()}
    def line(w): return [P[n] for n in w['nd'] if n in P]
    def poly(w):
        c = line(w)
        if len(c) < 4 or w['nd'][0] != w['nd'][-1]: return None
        g = Polygon(c); return g if g.is_valid else g.buffer(0)

    bw = ways[BASE_WAY]; base = poly(bw); ring = LineString(base.exterior.coords)
    area_ha, per_km = base.area / 1e4, ring.length / 1000
    print(f'base {area_ha:.1f} ha, perimeter {per_km:.2f} km, tags {bw["tags"]}', file=sys.stderr)

    # areas by class (ways and multipolygon relations, outer rings minus inner rings)
    RES, IND, GREEN = {'residential'}, {'industrial', 'commercial', 'retail'}, set()
    def area_class(t):
        lu, le, na = t.get('landuse'), t.get('leisure'), t.get('natural')
        if lu in RES: return 'residential'
        if lu in IND: return 'industrial'
        if lu in ('grass', 'recreation_ground', 'meadow', 'village_green', 'forest') or le in ('park', 'garden', 'pitch', 'playground') or na in ('scrub', 'grassland', 'wood'): return 'green'
        if lu in ('farmland', 'orchard', 'farmyard', 'greenhouse_horticulture', 'vineyard', 'plant_nursery'): return 'agri'
        if lu in ('construction', 'brownfield', 'greenfield'): return 'construction'
        if lu in ('military',): return 'military'
        return None
    areas = {k: [] for k in ('residential', 'industrial', 'green', 'agri', 'construction', 'military')}
    buildings = []
    for wid, w in ways.items():
        if wid == BASE_WAY: continue
        c = area_class(w['tags']); b = 'building' in w['tags']
        if not c and not b: continue
        g = poly(w)
        if g is None or g.is_empty: continue
        if b: buildings.append(g)
        if c: areas[c].append(g)
    for rid, r in rels.items():
        if r['tags'].get('type') != 'multipolygon': continue
        c = area_class(r['tags']); b = 'building' in r['tags']
        if not c and not b: continue
        outer = [ways[ref] for (ty, ref, role) in r['m'] if ty == 'way' and role in ('outer', '') and ref in ways]
        inner = [ways[ref] for (ty, ref, role) in r['m'] if ty == 'way' and role == 'inner' and ref in ways]
        from shapely.ops import polygonize
        lo = [LineString(line(w)) for w in outer if len(line(w)) > 1]; li = [LineString(line(w)) for w in inner if len(line(w)) > 1]
        g = unary_union(list(polygonize(unary_union(lo)))) if lo else None
        if g is None or g.is_empty: continue
        if li: g = g.difference(unary_union(list(polygonize(unary_union(li)))))
        if b: buildings.append(g)
        if c: areas[c].append(g)
    U = {k: unary_union(v) if v else Polygon() for k, v in areas.items()}
    UB = unary_union(buildings) if buildings else Polygon()
    print('buildings', len(buildings), {k: len(v) for k, v in areas.items()}, file=sys.stderr)

    MAJOR = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link'}
    major = unary_union([LineString(line(w)) for w in ways.values() if w['tags'].get('highway') in MAJOR and len(line(w)) > 1])

    # ---- fence pieces every 25 m
    n = max(1, round(ring.length / 25)); step = ring.length / n
    segs, tally = [], {}
    for i in range(n):
        a, b = i * step, (i + 1) * step; m = (a + b) / 2
        p = ring.interpolate(m); q1 = ring.interpolate(max(0, m - 1)); q2 = ring.interpolate(min(ring.length, m + 1))
        dx, dy = q2.x - q1.x, q2.y - q1.y; L = math.hypot(dx, dy) or 1; nx1, ny1 = -dy / L, dx / L
        o = Point(p.x + nx1 * 40, p.y + ny1 * 40)
        if base.contains(o): o = Point(p.x - nx1 * 40, p.y - ny1 * 40)
        disc = o.buffer(35, 32); da = disc.area
        sh = lambda g: (g.intersection(disc).area / da) if not g.is_empty else 0.0
        fb, fr, fi, fg = sh(UB), sh(U['residential']), sh(U['industrial']), sh(U['green'])
        if fb > 0.08 or fr > 0.40: cls = 'industry' if fi > fr and fi > 0.2 else 'housing'
        elif fi > 0.40: cls = 'industry'
        elif not major.is_empty and o.distance(major) <= 30: cls = 'road'
        elif fg > 0.30: cls = 'green'
        else: cls = 'open'
        piece = LineString([ring.interpolate(a + k * (b - a) / 4).coords[0] for k in range(5)])
        segs.append({'c': cls, 'g': piece, 'len': piece.length}); tally[cls] = tally.get(cls, 0) + piece.length
    tot = sum(tally.values())
    print('fence', {k: f'{v / 1000:.2f} km {v / tot * 100:.0f} %' for k, v in sorted(tally.items(), key=lambda x: -x[1])}, file=sys.stderr)

    # ---- walkable network
    NOWALK = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'construction', 'proposed', 'raceway', 'bus_guideway', 'abandoned', 'platform', 'corridor', 'elevator'}
    G = nx.Graph(); deg = {}
    for wid, w in ways.items():
        t = w['tags']; h = t.get('highway')
        if not h or h in NOWALK or t.get('area') == 'yes': continue
        if t.get('foot') == 'no': continue
        if t.get('access') in ('private', 'no') and t.get('foot') not in ('yes', 'designated', 'permissive'): continue
        nd = [x for x in w['nd'] if x in P]
        for u, v in zip(nd, nd[1:]):
            if u == v: continue
            G.add_edge(u, v, w=math.dist(P[u], P[v]))
    # dead ends: degree-1 nodes of the walkable graph, outside the base, within 80 m of the fence
    dead = [k for k in G.nodes if G.degree(k) == 1 and ring.distance(Point(P[k])) <= 80 and not base.contains(Point(P[k]))]
    print('dead ends', len(dead), file=sys.stderr)

    # ---- routes
    big = max(nx.connected_components(G), key=len); H = G.subgraph(big)
    hn = list(H.nodes)
    def near(lon, lat):
        x, y = fwd(lon, lat); return min(hn, key=lambda k: (P[k][0] - x) ** 2 + (P[k][1] - y) ** 2)
    ROUTES = [('churriana_alhendin', (-3.6463, 37.1478), (-3.6440, 37.1125)), ('gabias_ogijares', (-3.66567, 37.13708), (-3.6085, 37.1205))]
    routes = []
    for key, A, B in ROUTES:
        a, b = near(*A), near(*B); path = nx.shortest_path(H, a, b, weight='w'); walk = nx.path_weight(H, path, 'w')
        straight = math.dist(fwd(*A), fwd(*B)); routes.append({'k': key, 'path': [P[k] for k in path], 'walk': walk, 'straight': straight, 'A': A, 'B': B})
        print(f'route {key}: walk {walk / 1000:.2f} km, straight {straight / 1000:.2f} km, x{walk / straight:.2f}', file=sys.stderr)

    # ---- 300 m band
    band = base.buffer(300, 32).difference(base); band_ha = band.area / 1e4
    band_lu = {}
    for k, g in U.items():
        if k == 'military' or g.is_empty: continue
        a = g.intersection(band).area / 1e4
        if a > 0.05: band_lu[k] = round(a, 1)
    bb = UB.intersection(band).area / 1e4
    print(f'band {band_ha:.1f} ha, land use {band_lu}, buildings {bb:.1f} ha', file=sys.stderr)

    # ---- write (WGS84, 6 decimals)
    def ll(g): return shp_transform(lambda x, y, z=None: inv(x, y), g)
    def rnd(o):
        if isinstance(o, float): return round(o, 6)
        if isinstance(o, (list, tuple)): return [rnd(v) for v in o]
        if isinstance(o, dict): return {k: rnd(v) for k, v in o.items()}
        return o
    F = []
    F.append({'type': 'Feature', 'properties': {'k': 'base', 'osm': BASE_WAY, 'area_ha': round(area_ha, 1), 'perimeter_km': round(per_km, 2)}, 'geometry': rnd(mapping(ll(base)))})
    for s in segs:
        F.append({'type': 'Feature', 'properties': {'k': 'fence', 'c': s['c'], 'len_m': round(s['len'], 1)}, 'geometry': rnd(mapping(ll(s['g'])))})
    for d in dead:
        F.append({'type': 'Feature', 'properties': {'k': 'deadend', 'osm_node': d}, 'geometry': rnd(mapping(Point(nodes[d])))})
    for r in routes:
        F.append({'type': 'Feature', 'properties': {'k': 'route', 'r': r['k'], 'walk_m': round(r['walk']), 'straight_m': round(r['straight']), 'ratio': round(r['walk'] / r['straight'], 2)}, 'geometry': rnd(mapping(ll(LineString(r['path']))))})
        F.append({'type': 'Feature', 'properties': {'k': 'straight', 'r': r['k']}, 'geometry': rnd(mapping(LineString([r['A'], r['B']])))})
    for nm in TOWNS:  # the town centres as OSM place nodes (the label points of the five towns)
        alias = {'Las Gabias': 'Gabia Grande'}.get(nm, nm)  # the municipality's main town is mapped as "Gabia Grande"
        hit = [(k, v) for k, v in places.items() if v[0] == alias]
        if not hit: sys.exit('no OSM place node for ' + nm)
        k, (n_, kind, ll_) = hit[0]
        F.append({'type': 'Feature', 'properties': {'k': 'town', 'nm': nm, 'osm_node': k, 'place': kind}, 'geometry': {'type': 'Point', 'coordinates': rnd(list(ll_))}})
    F.append({'type': 'Feature', 'properties': {'k': 'band', 'area_ha': round(band_ha, 1)}, 'geometry': rnd(mapping(ll(band.simplify(1))))})
    for k, g in U.items():
        if k == 'military' or g.is_empty: continue
        gi = g.intersection(band)
        if gi.area > 500: F.append({'type': 'Feature', 'properties': {'k': 'bandlu', 'c': k, 'area_ha': round(gi.area / 1e4, 1)}, 'geometry': rnd(mapping(ll(gi.simplify(1))))})
    stats = {'area_ha': round(area_ha, 1), 'perimeter_km': round(per_km, 2),
             'fence_m': {k: round(v) for k, v in tally.items()}, 'fence_share': {k: round(v / tot, 3) for k, v in tally.items()},
             'deadends': len(dead), 'routes': {r['k']: {'walk_m': round(r['walk']), 'straight_m': round(r['straight']), 'ratio': round(r['walk'] / r['straight'], 2)} for r in routes},
             'band_ha': round(band_ha, 1), 'band_landuse_ha': band_lu, 'band_buildings_ha': round(bb, 1)}
    json.dump({'type': 'FeatureCollection', 'stats': stats, 'features': F}, open(OUT, 'w'), separators=(',', ':'))
    print(json.dumps(stats), file=sys.stderr); print('wrote', OUT, os.path.getsize(OUT), 'bytes', file=sys.stderr)


if __name__ == '__main__':
    main()
