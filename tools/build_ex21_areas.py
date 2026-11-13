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
from shapely.geometry import shape, box, LineString, Point, Polygon
from shapely.ops import transform as stransform
from pyproj import Transformer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); KMZ = os.environ.get('KMZ_DIR')
T = Transformer.from_crs(4326, 25830, always_xy=True); F = lambda g: stransform(lambda x, y, z=None: T.transform(x, y), g)
S = 130  # window side (m)
AREAS = [('A', 'Churriana de la Vega', 'housing', (442470, 4110660)), ('B', 'Armilla', 'housing', (444040, 4110770)),
         ('C', 'Ogíjares side', 'road', (443970, 4108900)), ('D', 'La Vega (south-west)', 'open', (442550, 4109280))]
FLOOR_M = 3.0


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
        P = np.array(pts); surf.append(LinearNDInterpolator(P[:, :2], P[:, 2]))
    return lambda x, y: float(np.nanmin([s(x, y) for s in surf] + [np.inf]))


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
    metro = json.load(open(os.path.join(ROOT, 'data/vec/south_metro.json')))['features']
    trees = json.load(open(os.path.join(ROOT, 'data/vec/trees_osm.json')))
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
        for f in chunks('buildings', bb):
            g = F(shape(f['geometry'])).buffer(0)
            if not g.intersects(W): continue
            p = f['properties']; blds.append({'r': rings(g.intersection(W)), 'lv': p.get('lv'), 'b': p.get('b'), 'id': p.get('id'), 'g': g})
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
        mt = [{'k': f['properties']['k'], 'nm': f['properties'].get('nm'), 'r': rings(F(shape(f['geometry'])).intersection(W))} for f in metro if F(shape(f['geometry'])).intersects(W)]
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
                lv = bl['lv']; cuts.append({'s0': round(s0, 1), 's1': round(s1, 1), 'lv': lv, 'h_est': round(lv * FLOOR_M, 1) if isinstance(lv, (int, float)) else None, 'b': bl['b']})
        fence_at = round(95.0, 1)
        res.append({'id': aid, 'name': name, 'kind': kind, 'centre': [cx, cy], 'extent': [round(v, 1) for v in bb], 'side_m': S,
                    'buildings': [{'r': b['r'], 'lv': b['lv'], 'b': b['b']} for b in blds], 'streets': streets, 'landuse': lus, 'trees': tr, 'fence': fc, 'dead': de, 'metro': mt,
                    'base': rings(base.intersection(W)),
                    'section': {'a': [round(a[0], 1), round(a[1], 1)], 'b': [round(b[0], 1), round(b[1], 1)], 'fence_at_m': fence_at, 'samples': samples, 'cuts': sorted(cuts, key=lambda c: c['s0'])},
                    'stats': {'buildings': len(blds), 'with_levels': sum(1 for b in blds if b['lv']), 'dead_ends': len(de), 'trees': len(tr),
                              'limit_at_fence': round(limit(p0.x, p0.y), 1), 'ground_at_fence': round(ground(p0.x, p0.y), 1)}})
        print(aid, name, kind, '| buildings', len(blds), '(levels', sum(1 for b in blds if b['lv']), ') streets', len(streets), 'landuse', len(lus), 'trees', len(tr), 'dead', len(de),
              '| section', n, 'm, cuts', len(cuts), '| ground', res[-1]['stats']['ground_at_fence'], 'limit', res[-1]['stats']['limit_at_fence'])
    out = {'areas': res, 'floor_m': FLOOR_M, 'epsg': 25830,
           'sources': 'OpenStreetMap contributors (buildings, streets, land use, trees; ODbL 1.0); base edge: tools/build_base_edge.py (OSM); ground: IGN MDT25 (CC BY 4.0); height limits: Origen de los datos: Ministerio de Defensa (RD 118/2019 KMZ)',
           'caveats': 'Building heights = OSM building:levels × 3 m (estimate); no levels = height unknown. The 25 m terrain model smooths street level. The limit surface is interpolated between the drawn lines of the official surfaces (approximation, not the legal value). The fence height is not mapped.'}
    json.dump(out, open(os.path.join(ROOT, 'data/ex21/areas.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('written', os.path.getsize(os.path.join(ROOT, 'data/ex21/areas.json')), 'bytes')


if __name__ == '__main__':
    main()
