"""Build data/ex21/areas.json — Exercise 2.1, AREA level (1:500): four 130 × 130 m windows on the edge of the
Base Aérea de Armilla, each a different kind of edge, and one section across the fence in each.
  A Churriana (north): houses with their backs to the fence      B Armilla (north-east corner): housing near the metro end
  C East (Ogíjares side): the main road and most dead ends      D South-west (the vega): open fields along the fence
Per window: OSM buildings (with building:levels where tagged), OSM streets and paths, OSM land use, OSM trees, the
fence pieces with what lies outside them and the dead ends (data/vec/base_edge.json), the base outline.
Per section (perpendicular to the fence, 95 m outside → 35 m inside): ground every 1 m (IGN MDT25, bilinear — a 25 m
model, so it smooths the street level), the aeronautical limit surface (lowest of the Ministry of Defence surfaces,
same method as tools/build_ex21_easements.py), and each building the line crosses with its floor count; heights are
floors × 3 m — an ESTIMATE, drawn as such; buildings without a floor count are drawn as "height unknown".
Usage: KMZ_DIR=/folder/with/kmz python3 tools/build_ex21_areas.py   (numpy, scipy, shapely, pyproj)"""
import glob, json, math, os, zipfile, xml.etree.ElementTree as ET
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from shapely.ops import unary_union
from shapely.geometry import shape, box, LineString, Point, Polygon
from shapely.ops import transform as stransform
from pyproj import Transformer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); KMZ = os.environ.get('KMZ_DIR')
T = Transformer.from_crs(4326, 25830, always_xy=True); F = lambda g: stransform(lambda x, y, z=None: T.transform(x, y), g)
S = 130  # window side (m)
AREAS = [('A', 'Churriana de la Vega', 'housing', (442470, 4110660)), ('B', 'Armilla', 'housing', (444040, 4110770)),
         ('C', 'Ogíjares side', 'road', (443970, 4108900)), ('D', 'La Vega (south-west)', 'open', (442550, 4109280)),
         ('E', 'Las Gabias corner (north-west)', 'green', (441520, 4110180)), ('F', 'South-east, towards Alhendín', 'housing', (443900, 4108300)),
         ('G', 'Farmland between Armilla and Ogíjares', 'road', (444150, 4109600)), ('H', 'North: the metro along the edge', 'housing', (443560, 4110830)),  # the metro track passes 20 m from the fence here
         # 16 Nov 2026 (owner: "areas that really differ — a social place like a school, the tallest buildings, the river"):
         ('S', 'Churriana: the sports ground and the schools beside the fence', 'social', (443120, 4110740)),
         ('R', 'The Río Dílar along the south fence', 'river', (443072, 4108817))]
FLOOR_M = 3.0
CATASTRO = os.environ.get('CATASTRO')  # 16 Nov 2026: folder with the D. G. del Catastro INSPIRE building files (Armilla 18022, Churriana 18064,
# Las Gabias 18083, Ogíjares 18148, Alhendín 18015, Granada 18900): when given, the buildings come from the Catastro (floors for every building part);
# OSM misses many buildings at the fence (the Churriana sports centre, for one).


def osm_places(bb):
    """named public places of a window (OSM API): schools, kindergartens, sports centres, pitches, parks, playgrounds, places
    of worship — and the OSM buildings, to add any building the Catastro does not have (its height is then unknown)"""
    import urllib.request, time as _t
    inv = Transformer.from_crs(25830, 4326, always_xy=True).transform; a = inv(bb[0] - 20, bb[1] - 20); b = inv(bb[2] + 20, bb[3] + 20)
    url = 'https://api.openstreetmap.org/api/0.6/map?bbox=%.5f,%.5f,%.5f,%.5f' % (a[0], a[1], b[0], b[1])
    for k in range(5):
        try: root = ET.fromstring(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'granada-atlas-build/ex21'}), timeout=120).read()); break
        except Exception as e: _t.sleep(3 * (k + 1))
    else: return [], []
    nodes = {n.get('id'): T.transform(float(n.get('lon')), float(n.get('lat'))) for n in root.iter('node')}
    places, blds = [], []
    for w in root.iter('way'):
        t = {x.get('k'): x.get('v') for x in w.iter('tag')}; c = [nodes[n.get('ref')] for n in w.iter('nd') if n.get('ref') in nodes]
        if len(c) < 4 or c[0] != c[-1]: continue
        g = Polygon(c).buffer(0)
        kind = t.get('amenity') if t.get('amenity') in ('school', 'kindergarten', 'college', 'place_of_worship', 'library', 'community_centre', 'social_facility') else t.get('leisure') if t.get('leisure') in ('sports_centre', 'pitch', 'park', 'playground', 'stadium', 'swimming_pool', 'garden') else None
        if kind: places.append({'g': g, 'kind': kind, 'nm': t.get('name')})
        if 'building' in t: blds.append(g)
    return places, blds


def catastro_parts(bbox):
    import xml.etree.ElementTree as ET
    NS = {'e': 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0', 'c': 'http://inspire.jrc.ec.europa.eu/schemas/bu-core2d/2.0', 'g': 'http://www.opengis.net/gml/3.2'}
    GID = '{http://www.opengis.net/gml/3.2}id'; X0, Y0, X1, Y1 = bbox; use = {}; parts = []
    def polys(el):
        out = []
        for pp in el.iter('{%s}PolygonPatch' % NS['g']):
            ext = pp.find('g:exterior', NS)
            if ext is None: continue
            v = [float(x) for x in ext.find('.//g:posList', NS).text.split()]; c = list(zip(v[0::2], v[1::2]))
            if len(c) >= 4: q = Polygon(c); out.append(q if q.is_valid else q.buffer(0))
        return out
    for code in ('18022', '18064', '18083', '18148', '18015', '18900'):
        for ev, el in ET.iterparse(os.path.join(CATASTRO, f'A.ES.SDGC.BU.{code}.building.gml')):
            if el.tag != '{%s}Building' % NS['e']: continue
            lo = el.find('.//{%s}lowerCorner' % NS['g'])
            if lo is not None:
                x, y = map(float, lo.text.split()[:2])
                if X0 - 300 < x < X1 and Y0 - 300 < y < Y1:
                    u = el.find('e:currentUse', NS); dw = el.find('e:numberOfDwellings', NS); yr = el.find('.//c:dateOfConstruction//c:beginning', NS)
                    use[el.get(GID).split('.')[-1]] = ((u.text or '') if u is not None else '', int(dw.text) if dw is not None and dw.text else 0, int(yr.text[:4]) if yr is not None and yr.text and yr.text[:4].isdigit() else None)
            el.clear()
        for ev, el in ET.iterparse(os.path.join(CATASTRO, f'A.ES.SDGC.BU.{code}.buildingpart.gml')):
            if el.tag != '{%s}BuildingPart' % NS['e']: continue
            ref = el.get(GID).split('.')[-1].split('_part')[0]
            if ref in use:
                fl = el.find('e:numberOfFloorsAboveGround', NS); g = unary_union(polys(el))
                if not g.is_empty and fl is not None and fl.text and fl.text.isdigit() and int(fl.text) > 0:
                    u, dw, yr = use[ref]
                    b = 'apartments' if u.startswith('1_') and dw > 2 else 'house' if u.startswith('1_') else 'industrial' if u.startswith('3_') else 'warehouse' if u.startswith('2_') else 'retail' if u == '4_2_retail' else 'commercial' if u == '4_1_office' else 'public' if u.startswith('4_') else 'yes'
                    # a shed, a farm building or a big hall (public / shop ≥ 800 m², e.g. a sports hall): its height is not derived from its floor count
                    hu = b in ('industrial', 'warehouse') or (b in ('public', 'retail', 'commercial') and g.area >= 800)
                    parts.append({'g': g, 'lv': int(fl.text), 'b': b, 'hu': hu, 'y': yr})
            el.clear()
    return parts


def chunks(layer, bb):
    out = []; x0, y0, x1, y1 = bb
    for fn in glob.glob(os.path.join(ROOT, 'data/vec', layer, '*.json')):
        parts = os.path.basename(fn)[:-5].split('_')
        if len(parts) != 2 or not all(v.isdigit() for v in parts): continue  # index.json etc.
        gx, gy = [int(v) for v in parts]
        if gx * 1000 > x1 + 1000 or (gx + 1) * 1000 < x0 - 1000 or gy * 1000 > y1 + 1000 or (gy + 1) * 1000 < y0 - 1000: continue  # cells are named by their south-west km
        out += json.load(open(fn))['features']
    return out


def kml_of(path):
    if path.endswith('.kml'): return open(path, 'rb').read()
    z = zipfile.ZipFile(path); return z.read(next(n for n in z.namelist() if n.endswith('.kml')))


def limit_surfaces():
    surf = []
    for path in sorted(f for f in glob.glob(os.path.join(KMZ, '*')) if any(k in os.path.basename(f) for k in ('_SO_Hoja', 'LEGA_SA_Aerodromo'))):
        r = ET.fromstring(kml_of(path)); K = r.tag.split('}')[0] + '}'; pts = []
        for ls in r.iter(K + 'LineString'):
            for c in ls.iter(K + 'coordinates'):
                for tok in (c.text or '').split():
                    a = [float(v) for v in tok.split(',')]
                    if 600 <= a[2] <= 2600: x, y = T.transform(a[0], a[1]); pts.append((x, y, a[2]))
        P = np.array(pts); surf.append((os.path.basename(path).split('-', 1)[-1].replace('.zip', ''), LinearNDInterpolator(P[:, :2], P[:, 2])))
    lim = lambda x, y: float(np.nanmin([f(x, y) for _, f in surf] + [np.inf]))
    lim.which = lambda x, y: min(((n, float(f(x, y))) for n, f in surf if not np.isnan(f(x, y))), key=lambda q: q[1])[0]  # the file that sets the limit here
    return lim


def main():
    if not KMZ: raise SystemExit('set KMZ_DIR')
    m = json.load(open(os.path.join(ROOT, 'data/manifest.json')))['terrain']['dem']
    DEM = np.frombuffer(open(os.path.join(ROOT, 'data', m['file']), 'rb').read(), dtype='<i2').reshape(m['height'], m['width']).astype(float)
    def ground(x, y):  # bilinear on cell centres
        c = (x - m['ox']) / m['px'] - 0.5; r = (m['oy'] - y) / m['py'] - 0.5; c0, r0 = int(math.floor(c)), int(math.floor(r)); fc, fr = c - c0, r - r0
        v = DEM[r0:r0 + 2, c0:c0 + 2]; return float(v[0, 0] * (1 - fc) * (1 - fr) + v[0, 1] * fc * (1 - fr) + v[1, 0] * (1 - fc) * fr + v[1, 1] * fc * fr)
    limit = limit_surfaces()
    be = json.load(open(os.path.join(ROOT, 'data/vec/base_edge.json')))['features']
    base = F(shape(next(f for f in be if f['properties'].get('k') == 'base')['geometry'])); bc = base.centroid
    fence = [(f['properties']['c'], F(shape(f['geometry']))) for f in be if f['properties'].get('k') == 'fence']
    dead = [F(shape(f['geometry'])) for f in be if f['properties'].get('k') == 'deadend']
    bandlu = [(f['properties']['c'], F(shape(f['geometry'])).buffer(0)) for f in be if f['properties'].get('k') == 'bandlu']  # land use in the 300 m band (OSM landuse + parks, tools/build_base_edge.py)
    metro = json.load(open(os.path.join(ROOT, 'data/vec/south_metro.json')))['features']
    trees = json.load(open(os.path.join(ROOT, 'data/vec/trees_osm.json')))
    water = [(f['properties'], F(shape(f['geometry']))) for f in json.load(open(os.path.join(ROOT, 'data/vec/water.json')))['features']]   # rivers, streams, irrigation channels (OSM)
    named = [(f['properties'], F(shape(f['geometry']))) for f in json.load(open(os.path.join(ROOT, 'data/vec/fac_education.json')))['features']]   # schools (OSM)
    rnd = lambda g: [[round(x - 0, 1), round(y - 0, 1)] for x, y in g.coords]
    def rings(g):
        gs = [g] if g.geom_type in ('Polygon', 'LineString', 'Point') else list(getattr(g, 'geoms', []))
        out = []
        for p in gs:
            if p.is_empty: continue
            if p.geom_type == 'Polygon': out.append([rnd(p.exterior)] + [rnd(i) for i in p.interiors])
            elif p.geom_type == 'LineString': out.append([rnd(p)])
        return out
    res = []
    allf = [g for _, g in fence]
    CP = catastro_parts((440100, 4106400, 446500, 4112000)) if CATASTRO else None
    for aid, name, kind, (cx0, cy0) in AREAS:
        # the window: centred 30 m outside the fence point nearest the chosen place, so the fence, a strip of the base and
        # the whole section (95 m outside → 35 m inside) fall inside it
        near = min(allf, key=lambda g: g.distance(Point(cx0, cy0))); d0 = near.project(Point(cx0, cy0)); p0 = near.interpolate(d0)
        p1 = near.interpolate(min(near.length, d0 + 2)); p_ = near.interpolate(max(0, d0 - 2)); tx, ty = p1.x - p_.x, p1.y - p_.y; L = math.hypot(tx, ty); nx, ny = -ty / L, tx / L
        if base.contains(Point(p0.x + nx * 10, p0.y + ny * 10)): nx, ny = -nx, -ny  # outwards
        cx, cy = p0.x + nx * 30, p0.y + ny * 30
        W = box(cx - S / 2, cy - S / 2, cx + S / 2, cy + S / 2); bb = W.bounds
        # buildings
        blds = []
        if CP is not None:
            for q in CP:
                if q['g'].intersects(W): blds.append({'r': rings(q['g'].intersection(W)), 'lv': q['lv'], 'b': q['b'], 'rs': None, 'hu': q['hu'], 'y': q['y'], 'g': q['g']})
        for f in ([] if CP is not None else chunks('buildings', bb)):
            g = F(shape(f['geometry'])).buffer(0)
            if not g.intersects(W): continue
            p = f['properties']; blds.append({'r': rings(g.intersection(W)), 'lv': p.get('lv'), 'b': p.get('b'), 'rs': p.get('rs'), 'id': p.get('id'), 'g': g})
        streets = []
        for f in chunks('streets', bb):
            g = F(shape(f['geometry']))
            if g.intersects(W): streets.append({'r': rings(g.intersection(W)), 'hw': f['properties'].get('hw'), 'nm': f['properties'].get('nm')})
        lus, seen = [], set()
        for f in chunks('landuse', bb):
            p = f['properties']
            if p.get('id') in seen: continue
            seen.add(p.get('id')); g = F(shape(f['geometry'])).buffer(0)
            if g.intersects(W) and p.get('lu') != 'military': lus.append({'r': rings(g.intersection(W)), 'lu': p.get('lu')})
        tr = [[round(x, 1), round(y, 1)] for x, y in (T.transform(p[1], p[2]) for p in trees['pts']) if W.contains(Point(x, y))]
        fc = [{'c': c, 'r': rings(g.intersection(W))} for c, g in fence if g.intersects(W)]
        de = [[round(g.x, 1), round(g.y, 1)] for g in dead if W.contains(g)]
        blu = [{'c': c, 'r': rings(g.intersection(W)), 'ha': round(g.intersection(W).area / 1e4, 2)} for c, g in bandlu if g.intersects(W)]
        mt = [{'k': f['properties']['k'], 'nm': f['properties'].get('nm'), 'r': rings(F(shape(f['geometry'])).intersection(W))} for f in metro if F(shape(f['geometry'])).intersects(W)]
        if CP is not None:
            pl, ob = osm_places(bb); have = unary_union([b['g'] for b in blds]) if blds else Polygon()
            for g in ob:  # buildings OSM has and the Catastro does not (e.g. a public sports hall): height unknown
                if g.intersects(W) and g.intersection(have).area < 0.3 * g.area: blds.append({'r': rings(g.intersection(W)), 'lv': 1, 'b': 'public', 'rs': None, 'hu': True, 'y': None, 'g': g, 'src': 'osm'})
            places = [{'kind': q['kind'], 'nm': q['nm'], 'r': rings(q['g'].intersection(W))} for q in pl if q['g'].intersects(W)]
        else: places = []
        wt = [{'r': rings(g.intersection(W)), 'ww': p.get('ww'), 'nm': p.get('nm')} for p, g in water if g.intersects(W)]
        nm = [{'nm': p.get('nm'), 'cls': p.get('cls'), 'r': rings(g.intersection(W)) if g.geom_type != 'Point' else [], 'p': [round(g.representative_point().x, 1), round(g.representative_point().y, 1)]} for p, g in named if g.intersects(W)]
        # section: perpendicular to the fence at p0, pointing outwards
        a = (p0.x + nx * 95, p0.y + ny * 95); b = (p0.x - nx * 35, p0.y - ny * 35); line = LineString([a, b]); n = int(line.length)
        samples = []
        for i in range(n + 1):
            q = line.interpolate(i); samples.append([i, round(ground(q.x, q.y), 2), round(limit(q.x, q.y), 2)])
        cuts = []
        for bl in blds:
            inter = bl['g'].intersection(line)
            for seg in ([inter] if inter.geom_type == 'LineString' else list(getattr(inter, 'geoms', []))):
                if seg.is_empty or seg.length < 0.5: continue
                s0, s1 = sorted([line.project(Point(seg.coords[0])), line.project(Point(seg.coords[-1]))])
                lv = bl['lv']; cuts.append({'s0': round(s0, 1), 's1': round(s1, 1), 'lv': lv, 'h_est': round(lv * FLOOR_M, 1) if isinstance(lv, (int, float)) and not bl.get('hu') else None, 'b': bl['b'], 'rs': bl.get('rs')})
        wx = []
        for p, g in water:
            it = g.intersection(line)
            for q in ([it] if it.geom_type == 'Point' else [q for q in getattr(it, 'geoms', []) if q.geom_type == 'Point']):
                if not q.is_empty: wx.append({'d': round(line.project(q), 1), 'ww': p.get('ww'), 'nm': p.get('nm')})
        fence_at = round(95.0, 1)
        res.append({'id': aid, 'name': name, 'kind': kind, 'centre': [cx, cy], 'extent': [round(v, 1) for v in bb], 'side_m': S,
                    'buildings': [{'r': b['r'], 'lv': b['lv'], 'b': b['b'], 'rs': b.get('rs'), 'hu': b.get('hu', False), 'y': b.get('y'), 'src': b.get('src', 'catastro' if CP is not None else 'osm')} for b in blds], 'floors_source': 'catastro' if CP is not None else 'osm', 'streets': streets, 'landuse': lus, 'trees': tr, 'fence': fc, 'dead': de, 'bandlu': blu, 'metro': mt, 'water': wt, 'named': nm, 'places': places,
                    'base': rings(base.intersection(W)),
                    'section': {'a': [round(a[0], 1), round(a[1], 1)], 'b': [round(b[0], 1), round(b[1], 1)], 'fence_at_m': fence_at, 'samples': samples, 'cuts': sorted(cuts, key=lambda c: c['s0']), 'water': sorted(wx, key=lambda q: q['d'])},
                    'stats': {'buildings': len(blds), 'with_levels': sum(1 for b in blds if b['lv']), 'dead_ends': len(de), 'trees': len(tr),
                              'limit_at_fence': round(limit(p0.x, p0.y), 1), 'ground_at_fence': round(ground(p0.x, p0.y), 1), 'limit_file': limit.which(p0.x, p0.y)}})
        print(aid, name, kind, '| buildings', len(blds), '(levels', sum(1 for b in blds if b['lv']), ') streets', len(streets), 'landuse', len(lus), 'trees', len(tr), 'dead', len(de),
              '| section', n, 'm, cuts', len(cuts), '| ground', res[-1]['stats']['ground_at_fence'], 'limit', res[-1]['stats']['limit_at_fence'])
    out = {'areas': res, 'floor_m': FLOOR_M, 'epsg': 25830,
           'sources': 'OpenStreetMap contributors (buildings, streets, land use, trees; ODbL 1.0); base edge: tools/build_base_edge.py (OSM); ground: IGN MDT25 (CC BY 4.0); height limits: Origen de los datos: Ministerio de Defensa (RD 118/2019 KMZ)',
           'caveats': 'Building heights = OSM building:levels × 3 m (estimate); no levels = height unknown. The 25 m terrain model smooths street level. The limit surface is interpolated between the drawn lines of the official surfaces (approximation, not the legal value). The fence height is not mapped.'}
    out['floors_source'] = 'catastro' if CATASTRO else 'osm'
    json.dump(out, open(os.path.join(ROOT, 'data/ex21/areas.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('written', os.path.getsize(os.path.join(ROOT, 'data/ex21/areas.json')), 'bytes')


if __name__ == '__main__':
    main()
