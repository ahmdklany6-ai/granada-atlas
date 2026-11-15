#!/usr/bin/env python3
"""Where people live around the Base Aérea de Armilla: the residential areas of the five towns, for the story tour
(data/vec/tour_towns.json).

Build 5.45 (owner: "there are places with houses that are not marked — check on the aerial photo and mark them"). Until
5.44 only the one continuous area holding each town's centre was kept, so detached neighbourhoods and villages (Gabia
Chica, the estates along the base's east fence, …) and houses outside OSM "residential" land use were missing; and the
municipality came from a ~200 m outline (es-atlas) with a 150 m margin, which gave Churriana a neighbourhood that is
Las Gabias' (and drew the strip between Armilla and Churriana twice).
Same method for all five:
  1. OpenStreetMap, read from the OSM API in 0.01° tiles ($CACHE, shared with tools/build_base_edge.py), in EPSG:25830:
     landuse=residential areas, buildings, admin_level=8 boundaries, place nodes;
  2. the municipality: the OSM boundary lines cut the frame (BBOX) into faces; a face is the town's when IGN's official
     outline (WFS au:AdministrativeUnit, one request per town, kept in $CACHE; © IGN, CC BY 4.0) covers most of it. OSM's
     line does the cutting because IGN's INSPIRE outline is generalised (107 points for Armilla: it runs through the
     middle of a terrace east of Armilla that the OSM line, along the road, leaves whole); the two differ by 2–17 ha per
     town, all along the borders. Areas are cut at the line, so nothing is drawn twice; a fragment under MIN_HA that the
     line cuts off an area of the next town joins that area (one estate, one town);
  3. houses = buildings tagged house / residential / apartments / detached / semidetached_house / terrace / bungalow
     (mostly the Catastro import); industrial, farm and untyped (building=yes) buildings are not counted;
  4. continuous areas: residential land use, plus house groups outside it of at least DENSE_MIN houses each within
     2 × LINK_DENSE m of the next (estates without a land-use polygon in OSM), dissolved with a 40 m closing inside the
     municipality; parts under MIN_HA dropped. The part at the town's OSM place node is its centre (k = core); the
     others are villages, neighbourhoods and estates of the same municipality (k = part);
  5. scattered houses (k = scatter): the remaining houses in groups of at least SCATTER_MIN, each within
     2 × LINK_SCATTER m of the next, outlined SCATTER_KEEP m around them — the outline holds plots and lanes, not only
     roofs (holes under 1 ha filled); pieces under MIN_SCATTER_HA dropped. Lone farmhouses stay unmarked;
  6. NOT_HOUSING: land OSM maps as residential that the orthophoto shows is not housing, cut out by hand (one place);
  7. simplified by 5 m. One feature per area: nm (town = municipality), k, ha, houses (OSM houses inside), ine.
Limits, as honest as the data: only inside the frame (Las Gabias and Alhendín continue west and south of it); only as
complete as OSM — on the PNOA orthophoto (IGN, looked at for build 5.45) some houses in the scattered areas between
Gabia Chica and Alhendín are not in OSM, so those outlines are a lower bound.
A town without residential areas near its place node gets no shape (reported, never invented).
"""
import json, os, sys, time, urllib.request, xml.etree.ElementTree as ET
import numpy as np
from pyproj import Transformer
from shapely import transform as shp_transform
from shapely.geometry import Polygon, LineString, Point, mapping, shape
from shapely.ops import unary_union, polygonize
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('CACHE', os.path.join(ROOT, '.cache', 'osm_base'))
OUT = os.path.join(ROOT, 'data', 'vec', 'tour_towns.json')
BBOX = (-3.705, 37.085, -3.575, 37.175)
API = 'https://api.openstreetmap.org/api/0.6/map?bbox={:.3f},{:.3f},{:.3f},{:.3f}'
IGN = ('https://www.ign.es/wfs-inspire/unidades-administrativas?service=WFS&version=2.0.0&request=GetFeature&typeNames=au:AdministrativeUnit'
       '&outputFormat=application/geo%2Bjson&resourceid=AU_ADMINISTRATIVEUNIT_340118{}')   # 34 Spain · 01 Andalucía · 18 Granada · INE code
UA = 'granada-atlas-build/5.45 (static urban-analysis site; one-off build)'
TOWNS = [('Armilla', 'Armilla', '18021'), ('Churriana de la Vega', 'Churriana de la Vega', '18062'), ('Las Gabias', 'Gabia Grande', '18905'),
         ('Alhendín', 'Alhendín', '18014'), ('Ogíjares', 'Ogíjares', '18145')]
HOME = {'house', 'residential', 'apartments', 'detached', 'semidetached_house', 'terrace', 'bungalow'}
LINK_DENSE, DENSE_MIN = 12, 8                           # an estate: at least 8 houses, each within 24 m of the next
LINK_SCATTER, SCATTER_MIN, SCATTER_KEEP = 50, 10, 30    # scattered houses: at least 10, each within 100 m of the next; outlined 30 m around
MIN_HA, MIN_SCATTER_HA = 0.5, 1.0
# Looked at on the PNOA orthophoto for build 5.45: land OSM maps as residential that is not housing. Cut out by hand along
# the line given here (EPSG:25830, traced on the 0.5 m orthophoto against a 50 m grid: about 10 m); everything else is as OSM maps it.
NOT_HOUSING = [
    ('Alhendín, south of the A-44 junction: a retail and warehouse estate — big sheds, yards, car and coach parks (the houses east of the estate\'s inner road stay)',
     [(443233, 4106592), (443245, 4106586), (443300, 4106550), (443350, 4106527), (443400, 4106500), (443440, 4106450), (443455, 4106400), (443462, 4106355),
      (443462, 4106300), (443100, 4106270), (443030, 4106270), (443018, 4106335)]),
]
fwd = Transformer.from_crs(4326, 25830, always_xy=True).transform
inv = Transformer.from_crs(25830, 4326, always_xy=True)
fwd4258 = Transformer.from_crs(4258, 25830, always_xy=True)


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


def muni(code):
    """The municipality's official outline (IGN, EPSG:4258 ≈ WGS84) in EPSG:25830."""
    fn = os.path.join(CACHE, f'ign_muni_{code}.json')
    if not os.path.exists(fn):
        data = urllib.request.urlopen(urllib.request.Request(IGN.format(code), headers={'User-Agent': UA}), timeout=120).read(); open(fn, 'wb').write(data); time.sleep(1)
    fs = json.load(open(fn))['features']
    if len(fs) != 1 or fs[0]['properties'].get('nationalCode') != '340118' + code: sys.exit(f'IGN: no single municipality for {code}')
    return shp_transform(shape(fs[0]['geometry']), lambda a: np.column_stack(fwd4258.transform(a[:, 0], a[:, 1]))).buffer(0)


def polys(g):
    return [p for p in (list(g.geoms) if hasattr(g, 'geoms') else [g]) if p.geom_type == 'Polygon' and not p.is_empty]


def main():
    nodes, ways, rels, places = tiles(); P = {k: fwd(*v) for k, v in nodes.items()}
    line = lambda w: [P[n] for n in w['nd'] if n in P]
    # residential land use (ways and multipolygons) and house footprints
    res, houses = [], []
    for wid, w in ways.items():
        tg = w['tags']
        if tg.get('landuse') != 'residential' and tg.get('building') not in HOME: continue
        c = line(w)
        if len(c) < 4 or w['nd'][0] != w['nd'][-1]: continue
        g = Polygon(c).buffer(0)
        if g.is_empty: continue
        if tg.get('landuse') == 'residential': res.append(g)
        if tg.get('building') in HOME: houses.append(g)
    for rid, r in rels.items():
        tg = r['tags']
        if tg.get('type') != 'multipolygon' or (tg.get('landuse') != 'residential' and tg.get('building') not in HOME): continue
        lo = [LineString(line(ways[ref])) for (t, ref, role) in r['m'] if t == 'way' and role in ('outer', '') and ref in ways and len(line(ways[ref])) > 1]
        li = [LineString(line(ways[ref])) for (t, ref, role) in r['m'] if t == 'way' and role == 'inner' and ref in ways and len(line(ways[ref])) > 1]
        if not lo: continue
        g = unary_union(list(polygonize(unary_union(lo))))
        if li: g = g.difference(unary_union(list(polygonize(unary_union(li)))))
        if g.is_empty: continue
        if tg.get('landuse') == 'residential': res.append(g)
        if tg.get('building') in HOME: houses.append(g)
    cut = unary_union([Polygon(c) for _, c in NOT_HOUSING])
    resU = unary_union(res); near = resU.buffer(15); resU = resU.difference(cut)   # houses standing in a cut-out stay out of the scattered groups too
    hp = [h.representative_point() for h in houses]; tree = STRtree(hp)
    count = lambda g: sum(1 for i in tree.query(g) if g.contains(hp[i]))
    loose = [h for h, q in zip(houses, hp) if not near.contains(q)]
    def groups(hs, link, nmin, keep):
        if not hs: return []
        u = unary_union([h.buffer(link) for h in hs]); pts = [h.representative_point() for h in hs]; tr = STRtree(pts)
        return [g.buffer(-(link - keep)) for g in polys(u) if sum(1 for i in tr.query(g) if g.contains(pts[i])) >= nmin]
    dense = groups(loose, LINK_DENSE, DENSE_MIN, 6)
    denseU = unary_union(dense).buffer(1) if dense else Polygon()
    rest = [h for h in loose if not denseU.contains(h.representative_point())]
    scatter = groups(rest, LINK_SCATTER, SCATTER_MIN, SCATTER_KEEP)
    print(f'{len(res)} residential areas, {len(houses)} houses: {len(loose)} outside residential land use → {len(dense)} estates ({len(loose) - len(rest)} houses), '
          f'{len(scatter)} groups of scattered houses', file=sys.stderr)
    frame = Polygon([fwd(BBOX[0], BBOX[1]), fwd(BBOX[2], BBOX[1]), fwd(BBOX[2], BBOX[3]), fwd(BBOX[0], BBOX[3])])
    # municipalities: the frame cut by the OSM admin_level=8 lines into faces; a face is the town's when IGN's outline covers most of it
    bl, seen = [], set()
    for rid, r in rels.items():
        if r['tags'].get('boundary') != 'administrative' or r['tags'].get('admin_level') != '8': continue
        for (t, ref, role) in r['m']:
            if t == 'way' and ref in ways and ref not in seen:
                seen.add(ref); c = line(ways[ref])
                if len(c) > 1: bl.append(LineString(c))
    faces = [p for p in polygonize(unary_union(bl + [frame.exterior])) if frame.buffer(1).contains(p)]
    W = {code: muni(code) for _, _, code in TOWNS}; M = {}
    for name, place, code in TOWNS:
        mine = [p for p in faces if W[code].intersection(p).area > 0.5 * p.area]
        M[code] = unary_union(mine) if mine else None
    print(f'{len(bl)} boundary ways, {len(faces)} faces in the frame; ' + ', '.join(f'{n}: OSM {M[c].area / 1e6:.2f} km² in the frame, IGN {W[c].area / 1e6:.2f} km² whole' for n, _, c in TOWNS if M[c] is not None), file=sys.stderr)
    # continuous areas per town (40 m closing inside the municipality); fragments under MIN_HA that the line cuts off the next town's area join it
    raw = {}
    for name, place, code in TOWNS:
        if M[code] is None: raw[name] = []; continue
        built = unary_union([resU] + dense).intersection(M[code])
        raw[name] = polys(built.buffer(40).buffer(-40).intersection(M[code]))
    big = {n: [p for p in ps if p.area >= MIN_HA * 1e4] for n, ps in raw.items()}; moved = []
    for n, ps in raw.items():
        for p in ps:
            if p.area >= MIN_HA * 1e4 or p.area < 100: continue
            best = None
            for n2, qs in big.items():
                if n2 == n: continue
                for q in qs:
                    if q.distance(p) < 2:
                        sh = q.buffer(3).intersection(p).area
                        if best is None or sh > best[1]: best = (n2, sh)
            if best: moved.append((n, best[0], p))
    for n, n2, p in moved: big[n2].append(p.buffer(1))
    cont = {n: [q for q in polys(unary_union(ps).buffer(0)) if q.area >= MIN_HA * 1e4] if ps else [] for n, ps in big.items()}
    if moved: print('fragments joined to the next town\'s area: ' + ', '.join(f'{p.area / 1e4:.2f} ha {a} → {b}' for a, b, p in moved), file=sys.stderr)

    feats, report = [], {}
    def add(name, code, place, k, p, extra=None):
        q = p.simplify(5); ll = shp_transform(q, lambda a: np.column_stack(inv.transform(a[:, 0], a[:, 1])))
        rnd = lambda o: [rnd(v) for v in o] if isinstance(o, (list, tuple)) else round(o, 6)
        geo = mapping(ll); geo = {'type': geo['type'], 'coordinates': rnd(geo['coordinates'])}
        pr = {'nm': name, 'ine': code, 'k': k, 'ha': round(p.area / 1e4, 1), 'houses': count(p)}
        if k == 'core': pr['osm_place'] = place
        if extra: pr.update(extra)
        feats.append({'type': 'Feature', 'properties': pr, 'geometry': geo}); return p.representative_point()
    for name, place, code in TOWNS:
        pn = places.get(place); mu = M[code]
        if not pn: report[name] = 'no OSM place node'; continue
        if mu is None: report[name] = 'no OSM municipal boundary in the frame'; continue
        pt = Point(fwd(*pn))
        parts = cont[name]
        if not parts: report[name] = 'no residential areas'; continue
        core = min(parts, key=lambda p: p.distance(pt))
        if core.distance(pt) > 600: report[name] = f'nearest residential area {core.distance(pt):.0f} m from the town node'; continue
        others = sorted([p for p in parts if p is not core], key=lambda p: -p.area)
        sc = unary_union(scatter).intersection(mu).difference(unary_union(parts).buffer(5)) if scatter else Polygon()
        sc = [Polygon(p.exterior, [h for h in p.interiors if Polygon(h).area >= 1e4]) for p in polys(sc)]   # holes under 1 ha are plots among the houses
        sc = sorted([p for p in sc if p.area >= MIN_SCATTER_HA * 1e4 and count(p) >= 3], key=lambda p: -p.area)
        todo = [('core', core)] + [('part', p) for p in others] + [('scatter', p) for p in sc]; pts = [add(name, code, place, k, p) for k, p in todo]
        beyond = W[code].difference(frame).area / W[code].area
        report[name] = (f'centre {core.area / 1e4:.1f} ha; {len(others)} other continuous parts {sum(p.area for p in others) / 1e4:.1f} ha; '
                        f'{len(sc)} areas of scattered houses {sum(p.area for p in sc) / 1e4:.1f} ha ({sum(count(p) for p in sc)} OSM houses); '
                        f'municipality {W[code].area / 1e6:.2f} km², ' + ('all inside the frame' if beyond < 0.005 else f'{beyond * 100:.0f} % of it beyond the frame (not looked at)'))
    meta = {'frame': BBOX, 'cut_out_by_hand': [n for n, _ in NOT_HOUSING], 'municipal_limits': 'OpenStreetMap admin_level=8 lines; the faces named with IGN, WFS unidades-administrativas (au:AdministrativeUnit), CC BY 4.0', 'houses': sorted(HOME), 'estate': {'houses_min': DENSE_MIN, 'within_m': 2 * LINK_DENSE}, 'closing_m': 40, 'min_ha': MIN_HA,
            'scatter': {'houses_min': SCATTER_MIN, 'within_m': 2 * LINK_SCATTER, 'outline_m': SCATTER_KEEP, 'min_ha': MIN_SCATTER_HA},
            'k': {'core': 'the continuous residential area at the town\'s OSM place node', 'part': 'another continuous residential area of the same municipality',
                  'scatter': f'a group of scattered houses, outlined {SCATTER_KEEP} m around them (plots and lanes included)'}}
    json.dump({'type': 'FeatureCollection', 'method': meta, 'report': report, 'features': feats}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(json.dumps(report, ensure_ascii=False, indent=1), file=sys.stderr); print('wrote', OUT, os.path.getsize(OUT), len(feats), 'areas', file=sys.stderr)


if __name__ == '__main__':
    main()
