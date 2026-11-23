"""Build data/ex22/frame.json — Exercise 2.2, the SHARED FRAME of the three interest groups' plans (1:1000) on the north
edge of the Base Aérea de Armilla, where Churriana de la Vega and Armilla meet the fence and the metro extension runs
along it. Every group draws on this same frame and on the same section line (1:500), so the plans compare directly.
Per frame: Catastro building parts (floors above ground, use, year), Catastro parcels, OSM streets and paths, OSM land use
and parks, OSM named places (schools, sports grounds …), the base outline and fence classes, the dead ends, metro line 1
and its southern extension (under construction), the municipal line Churriana | Armilla, the ground (IGN MDT25) and the
aeronautical limit surface (Ministry of Defence, RD 118/2019) on a 10 m grid, and the shared section line with its
ground, limit and the buildings it cuts.
Usage: CATASTRO=/folder/with/catastro/BU KMZ_DIR=/folder/with/kmz CP_DIR=/folder/with/cp<code>/ python3 tools/build_ex22_frame.py
(numpy, scipy, shapely, pyproj; the Catastro and KMZ files are downloads, not part of the repo)"""
import json, math, os, sys
import numpy as np
import xml.etree.ElementTree as ET
from shapely.geometry import shape, box, LineString, Point, Polygon, mapping
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import build_ex21_areas as A   # reuse: T, F, chunks, limit_surfaces, osm_places, kml_of

# the frame: 710 x 570 m (A1 landscape at 1:1000: the map is 710 x 570 mm, a 103 mm column beside it holds the title, the key and the notes)
FRAME = (443390.0, 4110420.0, 444100.0, 4110990.0)
if os.environ.get('FRAME'): FRAME = tuple(float(v) for v in os.environ['FRAME'].split(','))   # (a wider look while choosing)
# the shared section line S-S (1:500): square to the north fence, 110 m west of the municipal line. From its north end in the
# Churriana houses it crosses Avenida de Poniente with the metro extension, the empty strip, the fence road and the fence, and
# runs 120 m into the base, under the approach surface of runway 18 (chosen 22 Nov 2026: it cuts the most buildings of the
# lines tried every 20 m along the strip)
SEC_A = (443807.0, 4110985.0)
SEC_LEN = 350.0
# other frames (23 Nov 2026, the three more edge areas): FRAME, SEC_A (the line's outer end), SEC_LEN, STRIP_PTS ('x,y;x,y': the
# parcels of the open land the proposal works on) and OUT from the environment
if os.environ.get('SEC_A'): SEC_A = tuple(float(v) for v in os.environ['SEC_A'].split(','))
if os.environ.get('SEC_LEN'): SEC_LEN = float(os.environ['SEC_LEN'])
STRIP_PTS = [tuple(float(v) for v in q.split(',')) for q in os.environ['STRIP_PTS'].split(';')] if os.environ.get('STRIP_PTS') else [(443700, 4110820), (443822, 4110818)]
CODES = ('18022', '18064', '18083', '18148', '18015')   # Armilla, Churriana de la Vega, Las Gabias, Ogíjares, Alhendín (the edge frames reach them)
FLOOR_M = 3.0
rnd = lambda c: [[round(x, 1), round(y, 1)] for x, y in c]


def rings(g):
    out = []
    for p in ([g] if g.geom_type in ('Polygon', 'LineString') else list(getattr(g, 'geoms', []))):
        if p.is_empty: continue
        if p.geom_type == 'Polygon': out.append([rnd(p.exterior.coords)] + [rnd(i.coords) for i in p.interiors])
        elif p.geom_type == 'LineString': out.append([rnd(p.coords)])
        elif p.geom_type in ('MultiPolygon', 'MultiLineString', 'GeometryCollection'): out += rings(p)
    return out


def catastro_parts(bb):
    NS = {'e': 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0', 'c': 'http://inspire.jrc.ec.europa.eu/schemas/bu-core2d/2.0', 'g': 'http://www.opengis.net/gml/3.2'}
    GID = '{http://www.opengis.net/gml/3.2}id'; X0, Y0, X1, Y1 = bb; use = {}; parts = []
    def polys(el):
        out = []
        for pp in el.iter('{%s}PolygonPatch' % NS['g']):
            ext = pp.find('g:exterior', NS)
            if ext is None: continue
            v = [float(x) for x in ext.find('.//g:posList', NS).text.split()]; c = list(zip(v[0::2], v[1::2]))
            holes = []
            for it in pp.findall('g:interior', NS):
                w = [float(x) for x in it.find('.//g:posList', NS).text.split()]; holes.append(list(zip(w[0::2], w[1::2])))
            if len(c) >= 4: q = Polygon(c, [h for h in holes if len(h) >= 4]); out.append(q if q.is_valid else q.buffer(0))
        return out
    for code in CODES:
        for ev, el in ET.iterparse(os.path.join(A.CATASTRO, f'A.ES.SDGC.BU.{code}.building.gml')):
            if el.tag != '{%s}Building' % NS['e']: continue
            lo = el.find('.//{%s}lowerCorner' % NS['g'])
            if lo is not None:
                x, y = map(float, lo.text.split()[:2])
                if X0 - 300 < x < X1 and Y0 - 300 < y < Y1:
                    u = el.find('e:currentUse', NS); dw = el.find('e:numberOfDwellings', NS); yr = el.find('.//c:dateOfConstruction//c:beginning', NS)
                    use[el.get(GID).split('.')[-1]] = ((u.text or '') if u is not None else '', int(dw.text) if dw is not None and dw.text else 0, int(yr.text[:4]) if yr is not None and yr.text and yr.text[:4].isdigit() else None)
            el.clear()
        for ev, el in ET.iterparse(os.path.join(A.CATASTRO, f'A.ES.SDGC.BU.{code}.buildingpart.gml')):
            if el.tag != '{%s}BuildingPart' % NS['e']: continue
            ref = el.get(GID).split('.')[-1].split('_part')[0]
            if ref in use:
                fl = el.find('e:numberOfFloorsAboveGround', NS); g = unary_union(polys(el))
                if not g.is_empty and fl is not None and fl.text and fl.text.isdigit() and int(fl.text) > 0:
                    u, dw, yr = use[ref]
                    b = 'apartments' if u.startswith('1_') and dw > 2 else 'house' if u.startswith('1_') else 'industrial' if u.startswith('3_') else 'warehouse' if u.startswith('2_') else 'retail' if u == '4_2_retail' else 'commercial' if u == '4_1_office' else 'public' if u.startswith('4_') else 'yes'
                    hu = b in ('industrial', 'warehouse') or (b in ('public', 'retail', 'commercial') and g.area >= 800)
                    parts.append({'g': g, 'lv': int(fl.text), 'b': b, 'hu': hu, 'y': yr, 'ref': ref, 'dw': dw})
            el.clear()
    return parts


def catastro_parcels(bb):
    out = []; W = box(*bb)
    for code in CODES:
        fn = os.path.join(os.environ['CP_DIR'], f'cp{code}', f'A.ES.SDGC.CP.{code}.cadastralparcel.gml')
        for ev, el in ET.iterparse(fn):
            if not el.tag.endswith('}CadastralParcel'): continue
            ps = []
            for pl in el.iter('{http://www.opengis.net/gml/3.2}posList'):
                v = [float(x) for x in pl.text.split()]; c = list(zip(v[0::2], v[1::2]))
                if len(c) >= 4: ps.append(c)
            if ps:
                try:
                    g = Polygon(ps[0], ps[1:]).buffer(0)
                    if g.intersects(W): out.append(g.intersection(W))
                except Exception: pass
            el.clear()
    return out


def main():
    for v in ('CATASTRO', 'KMZ_DIR', 'CP_DIR'):
        if not os.environ.get(v): raise SystemExit('set ' + v)
    A.CATASTRO = os.environ['CATASTRO']; A.KMZ = os.environ['KMZ_DIR']
    W = box(*FRAME); bb = FRAME
    m = json.load(open(os.path.join(ROOT, 'data/manifest.json')))['terrain']['dem']
    DEM = np.frombuffer(open(os.path.join(ROOT, 'data', m['file']), 'rb').read(), dtype='<i2').reshape(m['height'], m['width']).astype(float)
    def ground(x, y):
        c = (x - m['ox']) / m['px'] - 0.5; r = (m['oy'] - y) / m['py'] - 0.5; c0, r0 = int(math.floor(c)), int(math.floor(r)); fc, fr = c - c0, r - r0
        v = DEM[r0:r0 + 2, c0:c0 + 2]; return float(v[0, 0] * (1 - fc) * (1 - fr) + v[0, 1] * fc * (1 - fr) + v[1, 0] * (1 - fc) * fr + v[1, 1] * fc * fr)
    limit = A.limit_surfaces()
    be = json.load(open(os.path.join(ROOT, 'data/vec/base_edge.json')))['features']
    base = A.F(shape(next(f for f in be if f['properties'].get('k') == 'base')['geometry']))
    fence = [(f['properties']['c'], A.F(shape(f['geometry']))) for f in be if f['properties'].get('k') == 'fence']
    dead = [A.F(shape(f['geometry'])) for f in be if f['properties'].get('k') == 'deadend']
    # buildings (Catastro), plus the OSM buildings the Catastro does not have (height unknown)
    BB5 = (bb[0] - 500, bb[1] - 500, bb[2] + 500, bb[3] + 500)
    CP = catastro_parts(BB5); blds = [q for q in CP if q['g'].intersects(W)]
    pl, ob = A.osm_places(bb); have = unary_union([b['g'] for b in blds]) if blds else Polygon()
    for g in ob:
        if g.intersects(W) and g.intersection(have).area < 0.3 * g.area: blds.append({'g': g, 'lv': None, 'b': 'public', 'hu': True, 'y': None, 'src': 'osm'})
    parcels = catastro_parcels(bb)
    # the empty strip between Avenida de Poniente and Calle Santa Lucía (two Catastro parcels, no building on them): who lives near it
    strip = unary_union([g for g in parcels if any(g.contains(Point(*q)) for q in STRIP_PTS)])
    near = {}
    for q in CP:
        if q.get('dw') and not base.contains(q['g'].centroid):
            dd = q['g'].distance(strip)
            if q['ref'] not in near or dd < near[q['ref']][1]: near[q['ref']] = (q['dw'], dd)
    strip_info = {'r': rings(strip), 'm2': round(strip.area), 'parcels': len([g for g in parcels if any(g.contains(Point(*q)) for q in STRIP_PTS)]),
                  'dwellings_200m': sum(dw for dw, dd in near.values() if dd <= 200), 'dwellings_400m': sum(dw for dw, dd in near.values() if dd <= 400),
                  'note': 'Catastro dwellings (numberOfDwellings) of the buildings whose footprint lies within 200 / 400 m (straight line) of the two parcels'}
    streets = []
    for f in A.chunks('streets', bb):
        g = A.F(shape(f['geometry']))
        if g.intersects(W): streets.append({'r': rings(g.intersection(W)), 'hw': f['properties'].get('hw'), 'nm': f['properties'].get('nm')})
    lus, seen = [], set()
    for f in A.chunks('landuse', bb):
        p = f['properties']
        if p.get('id') in seen: continue
        seen.add(p.get('id')); g = A.F(shape(f['geometry'])).buffer(0)
        if g.intersects(W) and p.get('lu') != 'military': lus.append({'r': rings(g.intersection(W)), 'lu': p.get('lu'), 'nm': p.get('nm')})
    parks = []
    for f in A.chunks('parks', bb):
        g = A.F(shape(f['geometry'])).buffer(0)
        if g.intersects(W) and f['properties'].get('le') == 'park': parks.append({'r': rings(g.intersection(W)), 'nm': f['properties'].get('nm')})
    water = []   # rivers, streams and irrigation ditches (OSM), for the edge areas by the Río Dílar and the acequias
    for f in json.load(open(os.path.join(ROOT, 'data/vec/water.json')))['features']:
        g = A.F(shape(f['geometry']))
        if g.intersects(W.buffer(50)): water.append({'ww': f['properties'].get('ww'), 'nm': f['properties'].get('nm'), 'r': rings(g.intersection(W.buffer(50)))})
    metro = []
    for f in json.load(open(os.path.join(ROOT, 'data/vec/south_metro.json')))['features']:
        g = A.F(shape(f['geometry']))
        if g.intersects(W.buffer(200)): metro.append({'k': f['properties']['k'], 'nm': f['properties'].get('nm'), 'r': rings(g.intersection(W)) if g.geom_type != 'Point' else [], 'p': [round(g.x, 1), round(g.y, 1)] if g.geom_type == 'Point' else None})
    L1 = json.load(open(os.path.join(ROOT, 'data/ex21/metro_l1.json')))
    l1 = [rings(LineString([A.T.transform(*p) for p in ln]).intersection(W)) for ln in L1['lines'] if len(ln) > 1]
    l1 = [r for rr in l1 for r in rr]
    muni = json.load(open(os.path.join(ROOT, 'data/ex21/policy.json')))['muni']
    mlines = []
    ar = unary_union([Polygon(r[0]) for pg in muni['Armilla'] for r in [pg]]).buffer(0); ch = unary_union([Polygon(r[0]) for pg in muni['Churriana de la Vega'] for r in [pg]]).buffer(0)
    line = ar.boundary.intersection(ch.buffer(3)).intersection(W)
    mlines = rings(line)
    # the shared section line: square to the fence, through SEC_A
    near = min((g for _, g in fence), key=lambda g: g.distance(Point(SEC_A))); d0 = near.project(Point(SEC_A)); p0 = near.interpolate(d0)
    p1 = near.interpolate(min(near.length, d0 + 3)); p_ = near.interpolate(max(0, d0 - 3)); tx, ty = p1.x - p_.x, p1.y - p_.y; L = math.hypot(tx, ty); nx, ny = -ty / L, tx / L
    if base.contains(Point(p0.x + nx * 10, p0.y + ny * 10)): nx, ny = -nx, -ny   # (nx, ny) points out of the base
    out_m = math.hypot(SEC_A[0] - p0.x, SEC_A[1] - p0.y)
    a = (p0.x + nx * out_m, p0.y + ny * out_m); b = (p0.x - nx * (SEC_LEN - out_m), p0.y - ny * (SEC_LEN - out_m)); sl = LineString([a, b])
    samples = [[i, round(ground(*sl.interpolate(i).coords[0]), 2), round(limit(*sl.interpolate(i).coords[0]), 2)] for i in range(int(sl.length) + 1)]
    cuts = []
    for bl in blds:
        it = bl['g'].intersection(sl)
        for seg in ([it] if it.geom_type == 'LineString' else list(getattr(it, 'geoms', []))):
            if seg.is_empty or seg.geom_type != 'LineString' or seg.length < 0.5: continue
            s0, s1 = sorted([sl.project(Point(seg.coords[0])), sl.project(Point(seg.coords[-1]))])
            lv = bl['lv']; cuts.append({'s0': round(s0, 1), 's1': round(s1, 1), 'lv': lv, 'h_est': round(lv * FLOOR_M, 1) if lv and not bl.get('hu') else None, 'b': bl['b'], 'y': bl.get('y')})
    def xings(geoms, kind):
        out = []
        for g in geoms:
            it = g.intersection(sl)
            for q in ([it] if it.geom_type == 'Point' else [q for q in getattr(it, 'geoms', []) if q.geom_type == 'Point']):
                if not q.is_empty: out.append({'d': round(sl.project(q), 1), 'k': kind})
        return out
    st_x = []
    for f in A.chunks('streets', bb):
        g = A.F(shape(f['geometry'])); it = g.intersection(sl)
        for q in ([it] if it.geom_type == 'Point' else [q for q in getattr(it, 'geoms', []) if q.geom_type == 'Point']):
            if not q.is_empty: st_x.append({'d': round(sl.project(q), 1), 'hw': f['properties'].get('hw'), 'nm': f['properties'].get('nm')})
    met_x = xings([A.F(shape(f['geometry'])) for f in json.load(open(os.path.join(ROOT, 'data/vec/south_metro.json')))['features'] if f['properties']['k'] == 'track'], 'metro')
    wat_x = []
    for f in json.load(open(os.path.join(ROOT, 'data/vec/water.json')))['features']:
        g = A.F(shape(f['geometry'])); it = g.intersection(sl)
        for q in ([it] if it.geom_type == 'Point' else [q for q in getattr(it, 'geoms', []) if q.geom_type == 'Point']):
            if not q.is_empty: wat_x.append({'d': round(sl.project(q), 1), 'ww': f['properties'].get('ww'), 'nm': f['properties'].get('nm')})
    fence_d = round(sl.project(Point(p0.x, p0.y)), 1)
    par_x = xings([g.boundary for g in parcels], 'parcel')
    # ground and limit on a 10 m grid over the frame (for the plan's "how high may one build here" lines)
    gx = np.arange(bb[0], bb[2] + 0.1, 10.0); gy = np.arange(bb[1], bb[3] + 0.1, 10.0)
    G = [[round(ground(x, y), 1) for x in gx] for y in gy]; LIM = [[round(limit(x, y), 1) for x in gx] for y in gy]
    out = {'frame': list(FRAME), 'epsg': 25830, 'floor_m': FLOOR_M, 'scale_plan': 1000, 'scale_section': 500,
           'buildings': [{'r': rings(b['g'].intersection(W)), 'lv': b['lv'], 'b': b['b'], 'hu': b.get('hu', False), 'y': b.get('y'), 'src': b.get('src', 'catastro'), 'ref': b.get('ref'), 'dw': b.get('dw')} for b in blds],
           'parcels': [r for g in parcels for r in rings(g)],
           'streets': streets, 'landuse': lus, 'parks': parks,
           'places': [{'kind': q['kind'], 'nm': q['nm'], 'r': rings(q['g'].intersection(W))} for q in pl if q['g'].intersects(W)],
           'base': rings(base.intersection(W.buffer(60))), 'fence': [{'c': c, 'r': rings(g.intersection(W))} for c, g in fence if g.intersects(W)],
           'dead': [[round(g.x, 1), round(g.y, 1)] for g in dead if W.contains(g)], 'strip': strip_info, 'metro_ext': metro, 'water': water, 'l1': l1, 'muni_line': mlines,
           'grid': {'x0': bb[0], 'y0': bb[1], 'cell': 10.0, 'nx': len(gx), 'ny': len(gy), 'ground': G, 'limit': LIM},
           'section': {'a': [round(a[0], 1), round(a[1], 1)], 'b': [round(b[0], 1), round(b[1], 1)], 'fence_at_m': fence_d, 'samples': samples,
                       'cuts': sorted(cuts, key=lambda c: c['s0']), 'streets': sorted(st_x, key=lambda q: q['d']), 'metro': sorted(met_x, key=lambda q: q['d']), 'water': sorted(wat_x, key=lambda q: q['d']), 'parcels': sorted(par_x, key=lambda q: q['d'])},
           'sources': 'D. G. del Catastro, INSPIRE buildings and cadastral parcels (floors, use, year); OpenStreetMap contributors (streets, land use, parks, places, base outline, metro extension; ODbL 1.0); IGN MDT25 (CC BY 4.0); Origen de los datos: Ministerio de Defensa (aeronautical easements, RD 118/2019)',
           'caveats': 'Heights = floors x 3 m (an estimate). Sheds and big halls: height not derived from floors. The 25 m terrain model smooths street level. The limit surface is interpolated between the drawn lines of the official surfaces (an approximation, not the legal value). The fence height is not mapped. OSM buildings missing from the Catastro: height unknown.'}
    os.makedirs(os.path.join(ROOT, 'data/ex22'), exist_ok=True)
    fn = os.environ.get('OUT') or os.path.join(ROOT, 'data/ex22/frame.json'); json.dump(out, open(fn, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('strip', strip_info['m2'], 'm2, dwellings 200/400 m:', strip_info['dwellings_200m'], strip_info['dwellings_400m'], '| buildings', len(out['buildings']), 'parcels', len(out['parcels']), 'streets', len(streets), 'landuse', len(lus), 'parks', len(parks), 'places', len(out['places']),
          'dead', len(out['dead']), '| section', round(sl.length), 'm, fence at', fence_d, 'cuts', len(cuts), 'streets x', len(st_x), 'metro x', len(met_x), '| written', os.path.getsize(fn))


if __name__ == '__main__':
    main()
