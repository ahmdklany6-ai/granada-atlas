"""Exercise 2.2 · ONE 3D file with the three alternatives (owner, 23 Nov 2026: "the three alternatives together in one file, each
on a layer I can turn on and off; more colours and detail, trees and green areas"). The whole base and the five towns
(MODEL=ALL, FRAME_JSON = the whole-area frame from tools/build_ex22_frame.py).
Writes <out>/ex22_three_alternatives.obj + .mtl (Rhino: Import → OBJ, "groups as layers", units metres; each layer gets its
colour from the .mtl) and ex22_layers_rhino.py, a RhinoPython script that nests the layers under five parents —
0 CONTEXT, 0 GREEN, 1 RESIDENTS, 2 DEVELOPER, 3 DEFENCE (+ 9 CHECK for the flight ceiling) — so each alternative is one switch.
Colours from js/palette.js. Context detail added here: buildings by use, farmland, orchards, parks and grass (OSM land use),
rivers and ditches (OSM), and SCHEMATIC trees in parks and orchards — existing trees are not surveyed in this area, so those
trees are placed on a grid and sit on their own layer, named as schematic.
Usage (repo root): MODEL=ALL FRAME_JSON=<frames/ALL.json> python3 tools/ex22_pages/model3d_combined.py <out folder>
Not part of the site or of the tests."""
import os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('MODEL', 'ALL')
import model3d as M3
from model3d import Mesh, zg, gd, F, FR, poly, unary_union, Point, LineString, np
import _bw

OUT = sys.argv[1]
P = _bw._P; B = P['base']; PM = P['basemap']
COL = {  # layer → colour (palette entries)
    '0_CONTEXT_terrain': PM['land'], '0_CONTEXT_terrain_sides': P['grey2'], '0_CONTEXT_streets': P['line2'], '0_CONTEXT_base_closed_land': P['line'],
    '0_CONTEXT_buildings_houses': P['paper'], '0_CONTEXT_buildings_apartments': B['cream'], '0_CONTEXT_buildings_industrial': P['grey3'],
    '0_CONTEXT_buildings_public': P['period']['1980_1999'], '0_CONTEXT_buildings_shops_offices': PM['bld'], '0_CONTEXT_buildings_height_unknown_6m': P['grey3'],
    '0_CONTEXT_fence_height_not_mapped': P['ink3'], '0_CONTEXT_metro_track': P['grey'],
    '0_GREEN_farmland': P['slope'][2][1], '0_GREEN_orchards': P['ui']['okLine'], '0_GREEN_parks_grass': P['olive'], '0_GREEN_water': B['lightBlue'],
    '0_GREEN_trees_SCHEMATIC_trunk': P['ink3'], '0_GREEN_trees_SCHEMATIC_crown': P['olive'],
    '9_CHECK_flight_ceiling_approx': B['blueGrey'],
}
PROP = {  # proposal colours: the studio red for what is built, pale reds for ground, the olive for trees
    'hall': B['red'], 'block': B['red'], 'pavilion': B['red'], 'footbridge': B['red'], 'mast': B['red'], 'inner_fence': B['red'], 'patrol_road': B['oxblood'],
    'phase2': P['redTint'], 'tree_trunk': P['ink3'], 'tree_crown': P['olive'], 'park': B['chartreuse'], 'meadow': B['chartreuse'], 'river_banks': P['olive'],
    'fence_walk': P['redTint'], 'paths': '#FFFFFF', 'allotments': P['rose'], 'playground': P['rose'], 'river_square': P['redTint'], 'garden_courts': P['blush'],
    'station_square': P['redTint'], 'open_land_crops': P['rose'], 'clear_zone': P['blush']}


def light_tree(M, g, x, y, h=6.0, r=2.2):
    """a lighter tree for orchards (an octahedron crown on a 3-sided trunk): thousands of them stay light in Rhino"""
    z = zg(x, y); tr = 0.18
    for k in range(3):
        a1, a2 = k * 2 * math.pi / 3, (k + 1) * 2 * math.pi / 3
        M.quad(g + '_trunk', (x + tr * math.cos(a1), y + tr * math.sin(a1), z), (x + tr * math.cos(a2), y + tr * math.sin(a2), z),
               (x + tr * math.cos(a2), y + tr * math.sin(a2), z + h * 0.5), (x + tr * math.cos(a1), y + tr * math.sin(a1), z + h * 0.5))
    zc = z + h - r; top, bot = (x, y, zc + r), (x, y, zc - r * 0.7); ring = [(x + r * math.cos(k * math.pi / 2 + 0.4), y + r * math.sin(k * math.pi / 2 + 0.4), zc) for k in range(4)]
    for k in range(4):
        M.tri(g + '_crown', ring[k], ring[(k + 1) % 4], top); M.tri(g + '_crown', ring[(k + 1) % 4], ring[k], bot)


def context(M):
    T = Mesh(); M3.base_model(T)
    use = {'house': 'houses', 'apartments': 'apartments', 'industrial': 'industrial', 'warehouse': 'industrial', 'public': 'public', 'retail': 'shops_offices', 'commercial': 'shops_offices'}
    for g, tris in T.groups.items():
        if g == 'buildings': continue
        if g == 'flight_ceiling_approx': continue   # (owner, 23 Nov 2026: no flight-ceiling surface in the 3D model)
        nm = {'buildings_height_unknown_6m': '0_CONTEXT_buildings_height_unknown_6m'}.get(g, '0_CONTEXT_' + g)
        M.groups[nm] = tris
    for g, b in gd.blds:   # the buildings again, by use (same heights)
        if b.get('hu') or not b.get('lv'): continue
        M.extrude('0_CONTEXT_buildings_' + use.get(b.get('b'), 'houses'), g, zg, b['lv'] * 3.0)
    # green: land use (OSM), water (OSM), schematic trees
    lift = lambda d: (lambda x, y: zg(x, y) + d)
    out_base = lambda g: g.difference(gd.base).intersection(FR)
    kinds = {'farmland': '0_GREEN_farmland', 'greenfield': '0_GREEN_farmland', 'meadow': '0_GREEN_parks_grass', 'grass': '0_GREEN_parks_grass', 'orchard': '0_GREEN_orchards',
             'forest': '0_GREEN_parks_grass', 'recreation_ground': '0_GREEN_parks_grass', 'cemetery': '0_GREEN_parks_grass', 'plant_nursery': '0_GREEN_orchards'}
    streets = M3.street_area()
    orch, parks = [], []
    for l in F['landuse']:
        k = kinds.get(l['lu'])
        if not k or not l['r']: continue
        g = out_base(unary_union([poly(r) for r in l['r']])).difference(streets)
        if g.is_empty: continue
        M.flat(k, g, lift(0.03))
        (orch if l['lu'] == 'orchard' else parks if k == '0_GREEN_parks_grass' and l['lu'] != 'cemetery' else []).append(g)
    for q in F.get('parks', []):
        if q['r']:
            g = out_base(poly(q['r'][0])).difference(streets)
            if not g.is_empty: M.flat('0_GREEN_parks_grass', g, lift(0.04)); parks.append(g)
    W = {'river': 8.0, 'stream': 3.0, 'ditch': 1.4}
    for w in F.get('water', []):
        for r in w['r']:
            if len(r[0]) > 1: M.flat('0_GREEN_water', LineString(r[0]).buffer(W.get(w.get('ww'), 1.4) / 2).intersection(FR), lift(0.06))
    # schematic trees: parks on a 12 m grid (a little jitter), orchards on a 20 m grid — NOT surveyed
    import random; rr = random.Random(5); n = 0
    built = unary_union([g for g, _ in gd.blds]).buffer(3)
    from shapely.prepared import prep
    for gs, step, heavy in ((parks, 12.0, True), (orch, 20.0, False)):
        for g in gs:
            pg = prep(g.buffer(-3))
            x0, y0, x1, y1 = g.bounds
            for x in np.arange(x0 + step / 2, x1, step):
                for y in np.arange(y0 + step / 2, y1, step):
                    c = (x + rr.uniform(-2, 2), y + rr.uniform(-2, 2))
                    if pg.contains(Point(c)) and not built.contains(Point(c)):
                        if heavy: M.tree('0_GREEN_trees_SCHEMATIC', *c, h=rr.uniform(6, 10), r=rr.uniform(2.0, 3.2))
                        else: light_tree(M, '0_GREEN_trees_SCHEMATIC', *c, h=rr.uniform(4.5, 6), r=rr.uniform(1.6, 2.2))
                        n += 1
    print('schematic trees', n)


def alternatives(M):
    for pre, fn in (('1_RESIDENTS_', M3.all_residents), ('2_DEVELOPER_', M3.all_developer), ('3_DEFENCE_', M3.all_defence)):
        A = Mesh(); fn(A)
        for g, tris in A.groups.items():
            nm = pre + g[2:]                  # P_xxx → 1_RESIDENTS_xxx
            M.groups.setdefault(nm, []).extend(tris)


def colour(g):
    if g in COL: return COL[g]
    k = g.split('_', 2)[2] if g[0] in '123' else g
    for key, c in PROP.items():
        if key in k: return c
    return B['red']


def layer_of(g):
    """the few layers the owner switches (23 Nov 2026: "not a hundred layers — one group per alternative"); colours stay per part"""
    if g.startswith('0_CONTEXT_buildings'): return '0_CONTEXT_buildings'
    if g.startswith('0_CONTEXT_'): return '0_CONTEXT_ground_streets_fence'
    if g.startswith('0_GREEN_'): return '0_GREEN_landuse_water_trees_schematic'
    if g.startswith('9_'): return '9_CHECK_flight_ceiling_approx'
    return {'1': '1_RESIDENTS', '2': '2_DEVELOPER', '3': '3_DEFENCE'}[g[0]]


def colour2(g):
    if g.startswith('0_CONTEXT_buildings'): return P['gray1']          # all buildings one light beige-white (owner, 23 Nov 2026)
    return colour(g)


def write_obj(Mx, base, notes):
    """one OBJ group (= Rhino layer) per switchable part, a material per element inside it, and a normal per face so Rhino
    shades every face flat (shared vertices with averaged normals made the buildings look smudged and dark)"""
    L = lambda p: (round(p[0] - M3.OX, 2), round(p[1] - M3.OY, 2), round(p[2] - M3.OZ, 2))
    order = sorted(Mx.groups, key=lambda g: (layer_of(g), g))
    with open(base + '.obj', 'w') as f:
        f.write('mtllib ' + os.path.basename(base) + '.mtl\n# ' + '\n# '.join(notes.split('\n')) + '\n# units: metres; x = E - %.0f, y = N - %.0f (EPSG:25830), z = height above %.0f m a.s.l.\n' % (M3.OX, M3.OY, M3.OZ))
        vi, ni, cur = 1, 1, None; NRM = {}
        for g in order:
            lay = layer_of(g)
            if lay != cur: f.write(f'o {lay}\ng {lay}\n'); cur = lay
            f.write(f'usemtl {g}\n'); idx = {}; out = []
            rgb = tuple(int(colour2(g)[i:i + 2], 16) / 255 for i in (1, 3, 5))   # vertex colours: Rhino shows them in every display mode
            for t in Mx.groups[g]:
                a, b, c = (np.array(L(p), float) for p in t); n = np.cross(b - a, c - a); nl = np.linalg.norm(n)
                if nl < 1e-9: continue
                n = n / nl
                if n[2] < -0.2 and not g.endswith('terrain_sides'): n = -n
                ids = []
                for p in t:
                    k = L(p)
                    if k not in idx: idx[k] = vi + len(idx); f.write('v %.2f %.2f %.2f %.3f %.3f %.3f\n' % (k + rgb))
                    ids.append(idx[k])
                nk = (round(n[0], 3), round(n[1], 3), round(n[2], 3))
                if nk not in NRM: NRM[nk] = ni; ni += 1; f.write('vn %.3f %.3f %.3f\n' % nk)   # normals shared across the file
                k_ = NRM[nk]; out.append('f %d//%d %d//%d %d//%d\n' % (ids[0], k_, ids[1], k_, ids[2], k_))
            f.writelines(out); vi += len(idx)
    hexf = lambda h: ' '.join(f'{int(h[i:i + 2], 16) / 255:.3f}' for i in (1, 3, 5))
    with open(base + '.mtl', 'w') as f:
        for g in order: f.write(f'newmtl {g}\nKd {hexf(colour2(g))}\nKa 0 0 0\nKs 0 0 0\nNs 0\nillum 1\nd {0.35 if g.startswith("9_") else 1.0}\n\n')


Mx = Mesh(); context(Mx); alternatives(Mx)
os.makedirs(OUT, exist_ok=True)
base = os.path.join(OUT, 'ex22_three_alternatives')
NOTE2 = ('Exercise 2.2 · the whole Armilla Air Base and the five towns around it (4.6 x 4.45 km), the three alternatives on their own layers.\n' + M3.NOTES.split('\n', 1)[1] +
         '\nLayers: 0_CONTEXT_* (existing), 0_GREEN_* (OSM land use and water; trees SCHEMATIC, not surveyed), 1_RESIDENTS, 2_DEVELOPER, 3_DEFENCE (schematic).')
write_obj(Mx, base, NOTE2)
if os.environ.get('KEEP_JSON') == '1':
    L = lambda p: (round(p[0] - M3.OX, 3), round(p[1] - M3.OY, 3), round(p[2] - M3.OZ, 3))
    json.dump({g: [[c for p in t for c in L(p)] for t in tris] for g, tris in Mx.groups.items()}, open(base + '.json', 'w'), separators=(',', ':'))
print('layers', sorted({layer_of(g) for g in Mx.groups}))
print('obj MB', round(os.path.getsize(base + '.obj') / 1e6, 1))
