"""Exercise 2.2 · the residents' north edge as a walkable 3D scene (owner, 24 Nov 2026: "make something nice, with shops one can
stroll through, after our concept"). Writes scene.json for the three.js page tools/ex22_pages/walk3d.html.
Context (ground, streets, Catastro buildings at floors x 3 m, fence, metro track, the residents' park, paths, hall, playground)
comes from the residents model JSON of tools/ex22_pages/model3d.py; this adds the MARKET WALK: a pedestrian lane along the
park's avenue side, from the west crossing to the hall, lined with small shop pavilions, and a covered market opposite the
San Cayetano metro stop. The market walk, every shop, its size, use and name are OURS (schematic, examples); each pavilion is
checked against the flight ceiling (allowed_at). Trees and allotment plots that the lane covers are left out.
Coordinates: local metres, x = E - 443390, y = N - 4110420, z = height above 660 m a.s.l. (as model3d.py).
Usage (repo root): python3 tools/ex22_pages/walk3d_export.py <ex22_N_residents_full.json> <out scene.json>
Not part of the site or of the tests."""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from shapely.affinity import translate
from _ex22 import load_frame, allowed_at
import groups

SRC, OUT = sys.argv[1], sys.argv[2]
F = load_frame(); gd = groups.ground(F); R = groups.residents(F, gd)
OX, OY, OZ = F['frame'][0], F['frame'][1], 660.0
GZ = np.array(F['grid']['ground'], float)
loc = lambda g: translate(g, -OX, -OY)


def zg(x, y):   # local x, y -> ground height above OZ (bilinear on the 10 m grid)
    i = x / 10.0; j = y / 10.0; i0 = int(min(max(math.floor(i), 0), 70)); j0 = int(min(max(math.floor(j), 0), 56)); fi, fj = i - i0, j - j0
    v = GZ[j0:j0 + 2, i0:i0 + 2]
    return float(v[0, 0] * (1 - fi) * (1 - fj) + v[0, 1] * fi * (1 - fj) + v[1, 0] * (1 - fi) * fj + v[1, 1] * fi * fj) - OZ


park = loc(R.park)
# the park's avenue side: from its west tip to its east corner (local)
A = np.array([214.1, 402.8]); B = np.array([469.5, 460.9]); d = (B - A) / np.linalg.norm(B - A); n = np.array([d[1], -d[0]])   # n: into the park
at = lambda s, o: tuple(A + d * s + n * o)
quad = lambda s0, s1, o0, o1: Polygon([at(s0, o0), at(s1, o0), at(s1, o1), at(s0, o1)])
ang = math.atan2(d[1], d[0])
S0, S1 = 56.0, 139.0                     # the lane runs from beside the west crossing to the hall
LANE = (9.5, 17.5)                       # 8 m wide walk between the two rows
NORTH = (3.5, 9.5); SOUTH = (17.5, 23.5)  # 6 m deep pavilions
MARKET = (97.0, 116.0)                   # the covered market, opposite the San Cayetano stop (stop crossing at s ~ 106)
inner = park.buffer(-1.0)

KINDS = [  # (use, sign) — examples of what the residents asked for: everyday shops, places to sit, the Vega's produce
    ('bakery', 'Panadería'), ('cafe', 'Café del Paseo'), ('greengrocer', 'Frutería'), ('bikes', 'Taller de bicis'),
    ('books', 'Librería'), ('icecream', 'Heladería'), ('farmshop', 'Tienda de la Vega'), ('florist', 'Floristería'),
    ('tapas', 'Bar de tapas'), ('hardware', 'Ferretería'), ('pharmacy', 'Farmacia'), ('cafe', 'Cafetería La Vega'),
    ('repair', 'Arreglos'), ('bakery', 'Dulces'), ('greengrocer', 'Huerta'), ('books', 'Kiosco'), ('cheese', 'Quesería'),
    ('shoes', 'Zapatería'), ('stationery', 'Papelería'), ('tailor', 'Mercería')]
shops = []; k = 0


def add(poly, row, floors):
    global k
    g = poly.intersection(inner)
    if g.is_empty or g.area < poly.area * 0.85: return
    pts = list(poly.exterior.coords)[:4]
    ceil = min(allowed_at(F, x + OX, y + OY) for x, y in pts)
    h = 4.2 if floors == 1 else 7.2
    if h + 1.0 > ceil: h, floors = 4.2, 1
    use, sign = KINDS[k % len(KINDS)]; k += 1
    z = min(zg(x, y) for x, y in pts)
    shops.append(dict(p=[[round(x, 2), round(y, 2)] for x, y in pts], z=round(z, 2), h=h, floors=floors, row=row, use=use,
                      sign=sign, ceil=round(ceil, 1)))


UNIT, GAP = 7.5, 2.5
SEGS = [(S0, S1), (186.0, 248.0)]        # two stretches of shops: west of the hall and east of it (the hall stays)
i = 0
for a0, a1 in SEGS:
    s = a0
    while s + UNIT <= a1:
        if MARKET[0] - 2 < s + UNIT and s < MARKET[1] + 2: s = MARKET[1] + 2; continue
        add(quad(s, s + UNIT, *NORTH), 'N', 2 if i % 4 == 1 else 1)
        if i % 3 != 2: add(quad(s, s + UNIT, *SOUTH), 'S', 1)   # every third unit left open: a way into the park
        s += UNIT + GAP; i += 1
lane = unary_union([quad(S0 - 6, S1 + 4, *LANE), quad(S1 + 4, SEGS[1][0], 1.0, 9.0), quad(SEGS[1][0] - 4, SEGS[1][1] + 3, *LANE),
                    quad(MARKET[0], MARKET[1], 0.5, SOUTH[1])]).intersection(inner)
lane = lane.union(LineString([at(106, -21), at(106, 1)]).buffer(3.0, cap_style=2))   # from the metro crossing
market = quad(MARKET[0], MARKET[1], NORTH[0], SOUTH[1])
stalls = []
for a in range(3):
    for b in range(2):
        c = at(MARKET[0] + 3.5 + a * 6.0, NORTH[0] + 4.0 + b * 12.0); stalls.append([round(c[0], 2), round(c[1], 2)])
mz = min(zg(*c) for c in market.exterior.coords)
mceil = min(allowed_at(F, x + OX, y + OY) for x, y in market.exterior.coords)
blocked = unary_union([Polygon(s_['p']) for s_ in shops] + [lane, market]).buffer(2.0)

# trees (the residents' orchard and the promenade row), less those under the market walk
trees = [(x - OX, y - OY) for x, y in list(R.trees) + list(R.row)]
trees = [t for t in trees if not blocked.contains(Point(t))]
plots = [loc(p) for p in R.plots if not loc(p).intersects(blocked)]

G = json.load(open(SRC))
KEEP = ['terrain', 'terrain_sides', 'streets', 'base_closed_land', 'buildings', 'buildings_height_unknown_6m', 'fence_height_not_mapped',
        'metro_track', 'P_park', 'P_paths', 'P_playground', 'P_hall_2_floors']
mesh = {g: [round(float(v), 2) for v in np.array(G[g], float).ravel()] for g in KEEP if g in G}


def tri(poly, z):   # a flat polygon lifted to z above the ground (triangulated)
    import shapely
    out = []
    for p in (poly.geoms if hasattr(poly, 'geoms') else [poly]):
        if p.is_empty: continue
        for t in shapely.constrained_delaunay_triangles(shapely.set_precision(p, 0.01)).geoms:
            for x, y in list(t.exterior.coords)[:3]: out += [round(x, 2), round(y, 2), round(zg(x, y) + z, 2)]
    return out


mesh['W_lane'] = tri(lane, 0.14)
mesh['W_plots'] = tri(unary_union(plots), 0.25) if plots else []
people = []
rng = np.random.default_rng(7)
for _ in range(70):
    seg = SEGS[int(rng.integers(0, 2))]; s_ = rng.uniform(seg[0] - 4, seg[1] + 2); o = rng.uniform(LANE[0] + 0.8, LANE[1] - 0.8)
    people.append([round(v, 2) for v in at(s_, o)] + [int(rng.integers(0, 6))])
for _ in range(40):   # in the park
    while True:
        x, y = rng.uniform(220, 460), rng.uniform(335, 455)
        if park.buffer(-3).contains(Point(x, y)) and not blocked.contains(Point(x, y)): break
    people.append([round(x, 2), round(y, 2), int(rng.integers(0, 6))])
out = dict(note='Schematic proposal (residents, 2.2-R) with the market walk: lane, shops, uses, names, sizes are ours (examples). '
                'Buildings: Catastro footprints, height = floors x 3 m (estimate). Ground: IGN MDT25. Trees schematic.',
           mesh=mesh, shops=shops, trees=[[round(x, 2), round(y, 2), round(zg(x, y), 2)] for x, y in trees],
           market=dict(p=[[round(x, 2), round(y, 2)] for x, y in list(market.exterior.coords)[:4]], z=round(mz, 2), ceil=round(mceil, 1), stalls=stalls),
           lane=dict(path=[[round(v, 2) for v in at(q, o)] for q, o in ((S0 - 4, 13.5), (S1 + 2, 13.5), (S1 + 8, 5.0), (SEGS[1][0] - 6, 5.0), (SEGS[1][0], 13.5), (SEGS[1][1] + 2, 13.5))], ang=ang),
           stop=[round(R.stop[0] - OX, 2), round(R.stop[1] - OY, 2)], people=people,
           grid=dict(cell=10.0, nx=72, ny=58, z=[[round(v - OZ, 2) for v in row] for row in GZ.tolist()]))
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print(OUT, os.path.getsize(OUT) // 1024, 'kB;', len(shops), 'shops;', len(trees), 'trees;', len(plots), 'plots; market ceiling', round(mceil, 1))
for s_ in shops: print(s_['row'], s_['sign'], s_['floors'], s_['h'], 'ceiling', s_['ceil'])
