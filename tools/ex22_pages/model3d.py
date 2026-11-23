"""Exercise 2.2 · 3D massing models of the shared north frame (Churriana | Armilla, 710 x 570 m) for Rhino, one per interest
group (owner, 23 Nov 2026: "three 3D models for Rhino, at the level of detail of the example: the base and what is around it").
Writes, for each of base / residents / developer / defence, an OBJ (Rhino imports it with one layer per group `g`) and a JSON
of the same triangles (for the preview pictures, tools/ex22_pages/model3d_preview.py).
Coordinates: metres, LOCAL — x = E − 443390, y = N − 4110420 (EPSG:25830), z = height above 660 m a.s.l.
What is measured and what is not: ground from IGN MDT25 (10 m grid); buildings from the Catastro footprints, height = floors x 3 m
(an ESTIMATE); halls and sheds have no floors on record and are drawn 6 m high (ASSUMED, own layer); the fence's height is not
mapped (drawn 2.5 m, schematic); the flight ceiling is our interpolation of RD 118/2019 (approximate). Existing trees are not
mapped here (no open tree survey for this frame): only the proposals' trees are drawn. Every proposal element is schematic.
Usage (repo root): python3 tools/ex22_pages/model3d.py <out folder>
Not part of the site or of the tests."""
import os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import shapely
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box
from shapely.ops import unary_union
from _ex22 import load_frame, poly, allowed_at
import groups

OUT = sys.argv[1] if len(sys.argv) > 1 else 'exports/ex22_3d'
MODEL = os.environ.get('MODEL', 'N')        # N: the shared north frame; ALL: the whole base and the towns around it (FRAME_JSON)
F = load_frame() if MODEL == 'N' else json.load(open(os.environ['FRAME_JSON'])); gd = groups.ground(F)
STEP = 10.0 if MODEL == 'N' else 20.0       # terrain mesh step (m)
OX, OY, OZ = F['frame'][0], F['frame'][1], 660.0
FR = box(*F['frame'])
GRID = F['grid']; GZ = np.array(GRID['ground'], float)


def zg(x, y):
    """ground height (m a.s.l.) by bilinear interpolation on the 10 m grid"""
    i = (x - GRID['x0']) / GRID['cell']; j = (y - GRID['y0']) / GRID['cell']
    i0 = int(min(max(math.floor(i), 0), GRID['nx'] - 2)); j0 = int(min(max(math.floor(j), 0), GRID['ny'] - 2)); fi, fj = i - i0, j - j0
    v = GZ[j0:j0 + 2, i0:i0 + 2]
    return float(v[0, 0] * (1 - fi) * (1 - fj) + v[0, 1] * fi * (1 - fj) + v[1, 0] * (1 - fi) * fj + v[1, 1] * fi * fj)


class Mesh:
    def __init__(self): self.groups = {}
    def tri(self, g, a, b, c):
        self.groups.setdefault(g, []).append((a, b, c))
    def quad(self, g, a, b, c, d):
        self.tri(g, a, b, c); self.tri(g, a, c, d)

    def polys(self, g):
        if g is None or g.is_empty: return []
        if g.geom_type == 'Polygon': return [g]
        return [q for q in getattr(g, 'geoms', []) if q.geom_type == 'Polygon' and not q.is_empty]

    def flat(self, g, geom, zf, top=True):
        """a polygon triangulated (constrained Delaunay), every vertex at zf(x, y)"""
        for p in self.polys(geom):
            p = shapely.set_precision(p, 0.01)
            if p.is_empty or p.area < 0.5: continue
            for t in shapely.constrained_delaunay_triangles(p).geoms:
                c = list(t.exterior.coords)[:3]
                pts = [(x, y, zf(x, y)) for x, y in c]
                if top: self.tri(g, *pts)
                else: self.tri(g, pts[0], pts[2], pts[1])

    def extrude(self, g, geom, z0f, h, roof_g=None):
        """a prism: walls from the ground (per vertex) up to a flat top at the highest ground + h"""
        for p in self.polys(geom):
            if p.area < 0.5: continue
            zt = max(z0f(x, y) for x, y in p.exterior.coords) + h
            for ring in [p.exterior] + list(p.interiors):
                cs = list(ring.coords)
                for (x1, y1), (x2, y2) in zip(cs[:-1], cs[1:]):
                    self.quad(g, (x1, y1, z0f(x1, y1) - 0.3), (x2, y2, z0f(x2, y2) - 0.3), (x2, y2, zt), (x1, y1, zt))
            self.flat(roof_g or g, p, lambda x, y: zt)

    def tree(self, g, x, y, h=8.0, r=2.6, n=7):
        """a low-poly tree: a hexagonal trunk and a faceted crown (an icosahedron, flattened a little)"""
        z = zg(x, y); tr = 0.25
        for k in range(6):
            a1, a2 = k * math.pi / 3, (k + 1) * math.pi / 3
            self.quad(g + '_trunk', (x + tr * math.cos(a1), y + tr * math.sin(a1), z), (x + tr * math.cos(a2), y + tr * math.sin(a2), z),
                      (x + tr * math.cos(a2), y + tr * math.sin(a2), z + h * 0.55), (x + tr * math.cos(a1), y + tr * math.sin(a1), z + h * 0.55))
        t = (1 + 5 ** 0.5) / 2
        V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
        Fc = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
        s = r / math.sqrt(1 + t * t); zc = z + h - r * 0.8
        P = [(x + vx * s, y + vy * s, zc + vz * s * 0.8) for vx, vy, vz in V]
        for a, b, c in Fc: self.tri(g + '_crown', P[a], P[b], P[c])

    def write(self, base_name, notes):
        os.makedirs(os.path.dirname(base_name), exist_ok=True)
        L = lambda p: (round(p[0] - OX, 3), round(p[1] - OY, 3), round(p[2] - OZ, 3))
        with open(base_name + '.obj', 'w') as f:
            f.write('# ' + '\n# '.join(notes.split('\n')) + '\n# units: metres; x = E - %.0f, y = N - %.0f (EPSG:25830), z = height above %.0f m a.s.l.\n' % (OX, OY, OZ))
            vi = 1
            for g, tris in self.groups.items():   # vertices shared within a group (smaller files, welded meshes in Rhino)
                f.write(f'o {g}\ng {g}\n'); idx = {}; fl = []
                for tri_ in tris:
                    ids = []
                    for p in tri_:
                        k = L(p)
                        if k not in idx: idx[k] = vi + len(idx); f.write('v %.2f %.2f %.2f\n' % k)
                        ids.append(idx[k])
                    if len(set(ids)) == 3: fl.append('f %d %d %d\n' % tuple(ids))
                f.writelines(fl); vi += len(idx)
        json.dump({g: [[c for p in tri_ for c in L(p)] for tri_ in tris] for g, tris in self.groups.items()}, open(base_name + '.json', 'w'), separators=(',', ':'))


def street_area():
    W = {'primary': 12, 'secondary': 12, 'tertiary': 9, 'residential': 7, 'unclassified': 6, 'service': 4, 'living_street': 6, 'pedestrian': 5, 'cycleway': 2.5, 'footway': 2.0, 'path': 2.0, 'track': 3.0}
    out = []
    for ln, s in gd.streets:
        if gd.base.buffer(-2).contains(ln.interpolate(0.5, normalized=True)) and s.get('hw') == 'service': out.append(ln.buffer(2.0, cap_style=2))
        else: out.append(ln.buffer(W.get(s.get('hw'), 3) / 2, cap_style=2))
    return unary_union(out).intersection(FR).difference(unary_union([g for g, _ in gd.blds]))


def base_model(M):
    """what every scenario shares: the terrain block, streets, the base land, buildings, the fence, the metro, the flight ceiling"""
    z0 = min(GZ.ravel()) - 6
    xs = np.arange(F['frame'][0], F['frame'][2] + 0.1, STEP); ys = np.arange(F['frame'][1], F['frame'][3] + 0.1, STEP)
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            a, b, c, d = (xs[i], ys[j]), (xs[i + 1], ys[j]), (xs[i + 1], ys[j + 1]), (xs[i], ys[j + 1])
            M.quad('terrain', *[(x, y, zg(x, y) - 0.05) for x, y in (a, b, c, d)])
    # the block's sides and bottom (a model base, as in the example)
    ring = list(FR.exterior.coords)
    for (x1, y1), (x2, y2) in zip(ring[:-1], ring[1:]):
        n = max(1, int(math.hypot(x2 - x1, y2 - y1) // STEP))
        for k in range(n):
            ax, ay = x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n; bx, by = x1 + (x2 - x1) * (k + 1) / n, y1 + (y2 - y1) * (k + 1) / n
            M.quad('terrain_sides', (ax, ay, z0), (bx, by, z0), (bx, by, zg(bx, by) - 0.05), (ax, ay, zg(ax, ay) - 0.05))
    M.flat('terrain_sides', FR, lambda x, y: z0, top=False)
    M.flat('streets', street_area(), lambda x, y: zg(x, y) + 0.05)
    M.flat('base_closed_land', gd.base.intersection(FR).difference(street_area().buffer(0.5)), lambda x, y: zg(x, y) + 0.02)
    for g, b in gd.blds:
        if b.get('hu') or not b.get('lv'): M.extrude('buildings_height_unknown_6m', g, zg, 6.0)
        else: M.extrude('buildings', g, zg, b['lv'] * 3.0)
    # the fence: a thin wall, 2.5 m (its height is not mapped)
    fl = gd.fence_line.intersection(FR)
    for seg in ([fl] if fl.geom_type == 'LineString' else [q for q in getattr(fl, 'geoms', []) if q.geom_type == 'LineString']):
        M.extrude('fence_height_not_mapped', seg.buffer(0.15, cap_style=2), zg, 2.5)
    # the metro extension: a raised track band
    for m in F['metro_ext']:
        for r in m['r']:
            if len(r[0]) > 1: M.flat('metro_track', LineString(r[0]).buffer(3.5, cap_style=2).intersection(FR), lambda x, y: zg(x, y) + 0.15)
    # the flight ceiling (approximate) as a surface, for checking heights
    LIM = np.array(GRID['limit'], float)
    for i in range(GRID['nx'] - 1):
        for j in range(GRID['ny'] - 1):
            v = [LIM[j, i], LIM[j, i + 1], LIM[j + 1, i + 1], LIM[j + 1, i]]
            if not all(np.isfinite(v)) or max(v) > OZ + 80 or (MODEL != 'N' and (i % 2 or j % 2)): continue
            x0, y0 = GRID['x0'] + i * 10, GRID['y0'] + j * 10
            d = 10 if MODEL == 'N' else 20
            if MODEL != 'N':
                if i + 2 >= GRID['nx'] or j + 2 >= GRID['ny']: continue
                v = [LIM[j, i], LIM[j, i + 2], LIM[j + 2, i + 2], LIM[j + 2, i]]
                if not all(np.isfinite(v)) or max(v) > OZ + 80: continue
            M.quad('flight_ceiling_approx', (x0, y0, v[0]), (x0 + d, y0, v[1]), (x0 + d, y0 + d, v[2]), (x0, y0 + d, v[3]))


def residents(M, Fr=None, gr=None):
    R = groups.residents(Fr or F, gr or gd); lift = lambda d: (lambda x, y: zg(x, y) + d)
    M.flat('P_park', R.park.union(R.prom), lift(0.1))
    M.flat('P_paths', R.paths.buffer(1.5), lift(0.16))
    M.flat('P_allotments', R.allot, lift(0.25))
    M.flat('P_playground', R.play, lift(0.2))
    M.extrude('P_hall_2_floors', R.hall, zg, 7.0)
    for x, y in R.trees + R.row: M.tree('P_tree', x, y, h=8.0 + (int(x * 7) % 5) * 0.6)


def developer(M):
    D = groups.developer(F, gd); lift = lambda d: (lambda x, y: zg(x, y) + d)
    M.flat('P_garden_courts', D.court, lift(0.1)); M.flat('P_station_square', D.sq, lift(0.12))
    for b in D.B: M.extrude(f'P_block_{b.floors}_floors', b.g, zg, b.floors * 3.0 + 0.6)
    for r, rc in zip(D.grid2, D.grid2c):
        M.extrude('P_phase2_if_base_leaves_5_floors', r.difference(rc) if not rc.is_empty else r, zg, 15.0)


def defence(M):
    Df = groups.defence(F, gd); lift = lambda d: (lambda x, y: zg(x, y) + d)
    M.flat('P_open_land_crops', Df.strip, lift(0.1))
    M.flat('P_clear_zone', Df.clear, lift(0.06))
    M.flat('P_patrol_road', Df.road, lift(0.12))
    ln = Df.inner_fence
    for seg in ([ln] if ln.geom_type == 'LineString' else [q for q in getattr(ln, 'geoms', []) if q.geom_type == 'LineString']):
        M.extrude('P_inner_fence', seg.buffer(0.1, cap_style=2), zg, 2.5)
    for x, y in Df.masts: M.extrude('P_mast_8m', Point(x, y).buffer(0.7, quad_segs=2), zg, 8.0)


def _area(a):
    """the frame and ground of one of the four studied areas (N, W, E, S)"""
    import edges
    edges.AREA = a
    Fa = load_frame() if a == 'N' else json.load(open(edges.frame_file())); return edges, Fa, groups.ground(Fa)


def all_residents(M):
    _, Fn, gn = _area('N'); residents(M, Fn, gn)   # the north edge, computed on its own frame (fast), drawn on this one
    lift = lambda d: (lambda x, y: zg(x, y) + d)
    # the walk along the WHOLE fence (2.1 map 05: a public strip outside the fence), 9 m wide, off buildings and streets; a tree
    # row every 12 m on it
    from shapely.prepared import prep
    walk = gd.fence_line.buffer(9, cap_style=2).difference(gd.base).difference(unary_union([g for g, _ in gd.blds]).buffer(1.5)).intersection(FR)
    M.flat('P_fence_walk', walk, lift(0.12))
    pw = prep(walk.buffer(-2)); fl = gd.fence_line
    for t in range(6, int(fl.length), 12):
        p = fl.interpolate(t); q = fl.interpolate(min(fl.length, t + 1)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
        for sd in (1, -1):
            c = (p.x - dy / n * 5 * sd, p.y + dx / n * 5 * sd)
            if pw.contains(Point(c)): M.tree('P_tree', c[0], c[1], h=8.0 + (t % 5) * 0.6); break
    for a in 'WES':
        edges, Fa, ga = _area(a); E = edges.build(Fa, ga)
        for k, gs in E.polys.items():
            for g in gs: M.flat({'park': 'P_park', 'riparian': 'P_river_banks', 'meadow': 'P_meadow', 'allot': 'P_allotments', 'plaza': 'P_river_square'}.get(k, 'P_park'), g, lift(0.1 if k == 'park' else 0.18))
        for g in E.lines.get('walk', []):
            if g is not None and not g.is_empty: M.flat('P_paths', g.buffer(1.5), lift(0.22))
        for b in E.bridges: M.extrude('P_footbridge', b.buffer(1.5, cap_style=2), zg, 1.2)
        if E.pavilion: M.extrude('P_pavilion_1_floor', E.pavilion[0], zg, E.pavilion[2])
        for x, y in E.trees: M.tree('P_tree', x, y, h=8.0 + (int(x * 7) % 5) * 0.6)


def all_developer(M):
    lift = lambda d: (lambda x, y: zg(x, y) + d)
    D = groups.developer(_area('N')[1], _area('N')[2])
    M.flat('P_garden_courts', D.court, lift(0.1)); M.flat('P_station_square', D.sq, lift(0.12))
    for b in D.B: M.extrude(f'P_block_{b.floors}_floors', b.g, zg, b.floors * 3.0 + 0.6)
    for a in 'WES':
        edges, Fa, ga = _area(a); Da = edges.developer(Fa, ga)
        M.flat('P_garden_courts', Da.court, lift(0.1))
        for b in Da.B: M.extrude(f'P_block_{b.floors}_floors', b.g, zg, b.floors * 3.0 + 0.6)
    # phase 2 on the WHOLE base land, only if the base leaves and its easements are lifted: perimeter blocks of 5 floors on a
    # 74 x 54 m grid (Sde Dov's density), kept 12 m in from the fence; the existing base buildings would go
    base = gd.base; U, N = gd.U, gd.N; c0 = base.centroid; n2 = 0
    for i in range(-40, 41):
        for j in range(-60, 61):
            c = (c0.x + U[0] * i * 74 + N[0] * j * 54, c0.y + U[1] * i * 74 + N[1] * j * 54)
            if not base.buffer(-40).contains(Point(c)): continue
            r = gd.rect(c[0], c[1], 60, 40); rc = r.buffer(-12, join_style=2)
            M.extrude('P_phase2_if_base_leaves_5_floors', r.difference(rc), zg, 15.0); n2 += 1
    print('phase 2 plots', n2)


def all_defence(M):
    lift = lambda d: (lambda x, y: zg(x, y) + d)
    Df = groups.defence(F, gd)                     # the security band along the WHOLE fence (this frame holds all of it)
    M.flat('P_clear_zone', Df.clear, lift(0.06)); M.flat('P_patrol_road', Df.road, lift(0.12))
    ln = Df.inner_fence
    for seg in ([ln] if ln.geom_type == 'LineString' else [q for q in getattr(ln, 'geoms', []) if q.geom_type == 'LineString']):
        M.extrude('P_inner_fence', seg.buffer(0.1, cap_style=2), zg, 2.5)
    for x, y in Df.masts: M.extrude('P_mast_8m', Point(x, y).buffer(0.7, quad_segs=2), zg, 8.0)
    M.flat('P_open_land_crops', groups.defence(*_area('N')[1:]).strip, lift(0.1))
    for a in 'WES':
        edges, Fa, ga = _area(a); M.flat('P_open_land_crops', edges.defence(Fa, ga).strip, lift(0.1))


NOTES = __doc__.split('\n')[0] + '\nGround IGN MDT25; buildings Catastro, height = floors x 3 m (estimate); halls/sheds 6 m (assumed); fence 2.5 m (not mapped); flight ceiling: our interpolation of RD 118/2019. Proposals (layers P_*) are schematic. Sources: D. G. del Catastro; IGN; OpenStreetMap contributors (ODbL); Ministerio de Defensa.'
B = Mesh(); base_model(B); B.write(os.path.join(OUT, f'ex22_{MODEL}_00_base'), NOTES)
FNS = (('residents', residents), ('developer', developer), ('defence', defence)) if MODEL == 'N' else (('residents', all_residents), ('developer', all_developer), ('defence', all_defence))
for nm, fn in FNS:
    M = Mesh(); fn(M); M.write(os.path.join(OUT, f'ex22_{MODEL}_{nm}_proposal'), NOTES)
    A = Mesh(); A.groups = {**B.groups, **M.groups}; A.write(os.path.join(OUT, f'ex22_{MODEL}_{nm}_full'), NOTES)
    print(nm, {g: len(t) for g, t in M.groups.items()})
print('base', {g: len(t) for g, t in B.groups.items()})
