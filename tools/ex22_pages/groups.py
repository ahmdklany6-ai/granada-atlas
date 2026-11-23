"""Exercise 2.2 · the shared ground of the frame and the interest groups' proposals as GEOMETRY (EPSG:25830, metres), so the
1:1000 plan and the 1:500 section draw exactly the same things. Every proposal here is schematic: shapes, sizes and positions
of its parts are ours (the sheets say so). Not part of the site or of the tests."""
import math
from types import SimpleNamespace
from shapely.geometry import Polygon, LineString, Point, box, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
from _ex22 import poly, allowed_at


def ground(F):
    """the frame's context, the same for every group"""
    FR = box(*F['frame'])
    base = unary_union([poly(r) for r in F['base']]).intersection(FR.buffer(60))
    blds = [(poly(r), b) for b in F['buildings'] for r in b['r'] if len(r[0]) >= 4]
    blds = [(g, b) for g, b in blds if not g.is_empty]
    built = unary_union([g for g, _ in blds])
    parcels = [poly(r) for r in F['parcels']]
    streets = [(LineString(r[0]), s) for s in F['streets'] for r in s['r'] if len(r[0]) >= 2]
    fence_line = base.exterior if base.geom_type == 'Polygon' else max(base.geoms, key=lambda g: g.area).exterior
    S = F['section']; SA, SB = S['a'], S['b']
    sec_line = LineString([SA, SB])
    def on_sec(d):
        p = sec_line.interpolate(d); return (p.x, p.y)

    # the fence's direction along the empty strip (for the park's grid)
    pA, pB = fence_line.interpolate(fence_line.project(Point(443610, 4110818))), fence_line.interpolate(fence_line.project(Point(443845, 4110745)))
    TH = math.atan2(pB.y - pA.y, pB.x - pA.x)          # radians, ground frame (≈ −17°)
    U = (math.cos(TH), math.sin(TH)); N = (-math.sin(TH), math.cos(TH))   # along the fence, and away from it (north-ish)
    def rect(cx, cy, lu, lv, ang=TH):
        """a rectangle lu (along the fence) x lv (across) centred on (cx, cy)"""
        r = box(-lu / 2, -lv / 2, lu / 2, lv / 2); r = affinity.rotate(r, ang, origin=(0, 0), use_radians=True); return affinity.translate(r, cx, cy)
    return SimpleNamespace(**{k: v for k, v in locals().items() if k != 'F'}, F=F)


def residents(F, gd):
    """The residents of the five towns: the base stays, its edge becomes theirs."""
    FR, base, blds, built, parcels, streets, fence_line = gd.FR, gd.base, gd.blds, gd.built, gd.parcels, gd.streets, gd.fence_line
    sec_line, on_sec, U, N, rect = gd.sec_line, gd.on_sec, gd.U, gd.N, gd.rect
    P = {}   # programme quantities
    park = unary_union([p for p in parcels if p.contains(Point(443700, 4110820)) or p.contains(Point(443822, 4110818))])
    P['park_m2'] = park.area
    # the promenade: a band 8 m wide outside the fence, all along it in the frame, off buildings
    prom = fence_line.buffer(9, cap_style=2).difference(base).difference(built.buffer(1.5)).intersection(FR)
    prom = unary_union([g for g in (prom.geoms if hasattr(prom, 'geoms') else [prom]) if g.area > 60])
    fence_in = fence_line.intersection(FR.buffer(-1)); P['prom_m'] = fence_in.length
    # the hall (2 floors) where the shared section crosses the park's north side
    hc = on_sec(146); hall = rect(hc[0], hc[1], 27, 22); P['hall_m2'] = hall.area; P['hall_ceiling'] = allowed_at(F, *hc)
    # the meadow: open lawn between the hall and the promenade
    mc = on_sec(186); meadow = rect(mc[0], mc[1], 64, 30).buffer(4, join_style=1).buffer(-4, join_style=1).intersection(park.buffer(-5))
    # the park's own axes: along its south edge (Calle Santa Lucía, parallel to the fence) and across it, from its west tip
    ext = list(park.exterior.coords); tip = min(ext, key=lambda p: p[0]); se = min(ext, key=lambda p: p[1])
    su = (se[0] - tip[0], se[1] - tip[1]); n0 = math.hypot(*su); su = (su[0] / n0, su[1] / n0); sv = (-su[1], su[0])
    at = lambda u, v: (tip[0] + su[0] * u + sv[0] * v, tip[1] + su[1] * u + sv[1] * v)
    ang = math.atan2(su[1], su[0])
    # playground: beside the hall, towards the east crossing
    pc = (hc[0] + U[0] * 31 - N[0] * 2, hc[1] + U[1] * 31 - N[1] * 2); play = rect(pc[0], pc[1], 20, 16, ang).intersection(park.buffer(-3)); P['play_m2'] = play.area
    # allotments: the narrow west end of the park, two rows of plots 5 x 9 m either side of the main path
    plots = []
    for vc in (6.8, 18.6):
        for i in range(40):
            c = at(16 + i * 5.6, vc); r = rect(c[0], c[1], 5, 9, ang)
            if park.buffer(-1.5).contains(r) and not r.intersects(meadow.buffer(6)) and not r.intersects(play.buffer(4)) and not r.intersects(hall.buffer(6)) and i < 17: plots.append(r)
    allot = unary_union(plots); P['allot_n'] = len(plots); P['allot_m2'] = sum(r.area for r in plots)
    # paths: one along the park between the allotment rows, links to the crossings and to the fence walk (3 m)
    east = LineString([at(4, 12.7), at(400, 12.7)]).intersection(park.buffer(-0.5))
    main = east if east.geom_type == 'LineString' else max(east.geoms, key=lambda g: g.length)
    # crossings over Avenida de Poniente: where streets from the houses reach it, and on the section line
    aveU = unary_union([g for g, s in streets if s.get('nm') == 'Avenida de Poniente' and s.get('hw') == 'secondary'])
    crossings = []
    for cx in (443646, 443703, None, 443818):   # None = the section line
        if cx is None: q = sec_line.intersection(aveU)
        else: q = LineString([(cx, 4110760), (cx, 4110960)]).intersection(aveU)
        if q.is_empty: continue
        q = q if q.geom_type == 'Point' else min(q.geoms, key=lambda g: g.y)
        crossings.append((q.x, q.y))
    links = []
    for c in crossings:
        e = park.exterior.interpolate(park.exterior.project(Point(c))); m2 = main.interpolate(main.project(e))
        links.append(LineString([c, e.coords[0], m2.coords[0]]))
    links += [LineString([on_sec(200), on_sec(222)])]
    paths = unary_union([main] + links).intersection(park.union(prom).buffer(0.5))
    # trees: an orchard grid in the park (8 m), and one row along the promenade (10 m)
    keep_out = unary_union([meadow.buffer(3), hall.buffer(5), allot.buffer(3), play.buffer(3), paths.buffer(2.5)])
    trees = []
    o = (443600, 4110800)
    for i in range(-10, 50):
        for j in range(-12, 14):
            x = o[0] + U[0] * i * 8 + N[0] * j * 8; y = o[1] + U[1] * i * 8 + N[1] * j * 8; p = Point(x, y)
            if park.buffer(-4).contains(p) and not keep_out.contains(p): trees.append((x, y))
    row = []
    roads = unary_union([g for g, s in streets if s.get('hw') not in ('footway', 'cycleway', 'path', 'pedestrian', 'service', 'steps')]).buffer(4.5)   # no tree on a carriageway
    L = fence_in
    for seg in ([L] if L.geom_type == 'LineString' else list(L.geoms)):
        for t in range(5, int(seg.length), 10):
            p = seg.interpolate(t); q = seg.interpolate(min(seg.length, t + 1)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
            cand = [(p.x - dy / n * 6, p.y + dx / n * 6), (p.x + dy / n * 6, p.y - dx / n * 6)]
            for c in cand:
                if not base.buffer(1).contains(Point(c)) and prom.contains(Point(c)) and not built.buffer(2).contains(Point(c)) and not roads.contains(Point(c)) and all(math.hypot(c[0] - r0[0], c[1] - r0[1]) >= 7 for r0 in row): row.append(c); break
    P['trees'] = len(trees) + len(row)
    # the dead end joined to the promenade
    dead = F['dead']
    # Calle Santa Lucía: a 20 km/h street along the park
    sl = unary_union([g for g, s in streets if s.get('nm') == 'Calle Santa Lucía']).intersection(box(443590, 4110700, 443860, 4110860))
    P['slow_m'] = sl.length
    # the metro's San Cayetano stop (Junta de Andalucía, Proyecto Constructivo Tramo Armilla-Churriana, PK 0+538 to 0+606, side platforms
    # of 68 m; not yet in service, Nov 2026): placed by its chainage on the OSM track, about ±20 m
    import json as _j, os as _o
    from pyproj import Transformer as _T
    _t = _T.from_crs(4326, 25830, always_xy=True)
    _tr = [f for f in _j.load(open(_o.path.join(_o.path.dirname(_o.path.abspath(__file__)), '..', '..', 'data/vec/south_metro.json')))['features'] if f['properties']['k'] == 'track'][0]
    _ln = LineString([_t.transform(*c) for c in _tr['geometry']['coordinates']])
    from shapely.ops import substring as _sub
    platform = _sub(_ln, 538, 606); _pc = _ln.interpolate(572); stop = (_pc.x, _pc.y)
    # where the park meets the sports complex: a gate
    _g = park.exterior.interpolate(park.exterior.project(Point(443861, 4110806))); gate = (_g.x, _g.y)   # on the park's edge, facing the sports complex
    return SimpleNamespace(**{k: v for k, v in locals().items() if k not in ('F', 'gd')})


def developer(F, gd):
    """The private developer. Phase 1, with the base still there: housing blocks on the empty strip, as high as today's flight
    ceiling allows (floors of 3 m, 1 m kept free under the ceiling, a 0.6 m parapet; 4–5 floors), a row on Avenida de
    Poniente with shops on the ground floor facing the metro, a row on Calle Santa Lucía, a private garden court between them
    over one level of parking, and a station square at the San Cayetano stop.
    Phase 2, only if the base leaves and its easements are lifted (POTAUG art. 4.27): a district on the base land, at the
    density planned for Sde Dov (Tel Aviv). All shapes, sizes and counts are ours: schematic."""
    U, N, rect, TH = gd.U, gd.N, gd.rect, gd.TH
    strip = unary_union([p for p in gd.parcels if p.contains(Point(443700, 4110820)) or p.contains(Point(443822, 4110818))])
    inner = strip.buffer(-4, join_style=2)                    # a 4 m setback from the parcel line (pavements widened)
    o = (443604.1, 4110823.0)                                  # the strip's west tip: the origin of the block grid
    at = lambda u, v: (o[0] + U[0] * u + N[0] * v, o[1] + U[1] * u + N[1] * v)
    def span(u):
        """the strip's extent across (v, towards the avenue) at u along the fence"""
        q = LineString([at(u, -150), at(u, 150)]).intersection(inner)
        if q.is_empty: return None
        q = q if q.geom_type == 'LineString' else max(q.geoms, key=lambda g: g.length)
        vs = [((x - o[0]) * N[0] + (y - o[1]) * N[1]) for x, y in q.coords]; return min(vs), max(vs)
    def quad(u0, u1, v0, v1):
        return Polygon([at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)])
    # the station square: opposite the stop, the avenue row opens for 30 m
    stop = (443725.5, 4110866.7); us = (stop[0] - o[0]) * U[0] + (stop[1] - o[1]) * U[1]
    DEP, LEN, GAP = 12.0, 40.0, 8.0                          # block depth and length, the gap between blocks
    # the strip is a triangle: a straight south side along Calle Santa Lucía (parallel to the fence) and a slanting north side
    # on Avenida de Poniente. Bars parallel to the fence, 30 m apart (12 m deep, 18 m courts), and one row along the avenue.
    ne = (443860.0, 4110881.0); d2 = (ne[0] - o[0], ne[1] - o[1]); n2l = math.hypot(*d2); d2 = (d2[0] / n2l, d2[1] / n2l); n2 = (d2[1], -d2[0])   # n2: into the strip
    at2 = lambda u, v: (o[0] + d2[0] * u + n2[0] * v, o[1] + d2[1] * u + n2[1] * v)
    us2 = (stop[0] - o[0]) * d2[0] + (stop[1] - o[1]) * d2[1]
    blocks = []
    u = 22.0
    while u < n2l:
        if not (u - 15 < us2 < u + LEN + 15):
            g = Polygon([at2(u, 4), at2(u + LEN, 4), at2(u + LEN, 4 + DEP), at2(u, 4 + DEP)]).intersection(inner)
            if g.area > 250: blocks.append(('N', g))
        u += LEN + GAP
    avenue_row = unary_union([g for _, g in blocks])
    room = inner.difference(avenue_row.buffer(18, join_style=2))
    for vc, row in ((4.0, 'S'), (34.0, 'M'), (64.0, 'M'), (94.0, 'M')):
        u = 22.0
        while u < 300:
            g = quad(u, u + LEN, vc, vc + DEP).intersection(room)
            g = max(g.geoms, key=lambda q: q.area) if hasattr(g, 'geoms') else g
            if not g.is_empty and g.area > 250 and g.minimum_rotated_rectangle.area < g.area * 1.08: blocks.append((row, g))
            u += LEN + GAP
    FLH, FREE, PAR = 3.0, 1.0, 0.6
    B = []
    for row, g in blocks:
        pts = list(g.exterior.coords) + [(g.centroid.x, g.centroid.y)]
        ceil = min(allowed_at(F, x, y) for x, y in pts)
        fl = int(min(5, (ceil - FREE - PAR) // FLH))
        if fl >= 2: B.append(SimpleNamespace(row=row, g=g, floors=fl, ceil=ceil, shop=row == 'N'))
    # the station square: the strip's corner opposite the stop, between the avenue row's two halves
    court = inner.difference(unary_union([b.g for b in B]).buffer(6)).buffer(-1)
    court = unary_union([q for q in (court.geoms if hasattr(court, 'geoms') else [court]) if q.area > 300]) if not court.is_empty else court
    sq = Polygon([at2(us2 - 15, -2), at2(us2 + 15, -2), at2(us2 + 15, 4 + DEP), at2(us2 - 15, 4 + DEP)]).intersection(strip)
    court = court.difference(sq.buffer(3))
    # one level of parking under the court (schematic): about 28 m² of floor per space
    park = court.buffer(-3) if not court.is_empty else court
    P = {'strip_m2': strip.area, 'm2_per_dw': 100, 'shop_depth': 12}
    P['gfa'] = sum(b.g.area * b.floors for b in B)
    P['shop_m2'] = sum(b.g.area for b in B if b.shop)
    P['dw1'] = (P['gfa'] - P['shop_m2']) / P['m2_per_dw']
    P['blocks'] = len(B); P['fl_min'] = min(b.floors for b in B); P['fl_max'] = max(b.floors for b in B)
    P['court_m2'] = court.area; P['sq_m2'] = sq.area; P['spaces'] = park.area / 28
    P['cover'] = sum(b.g.area for b in B) / strip.area
    base_in = gd.base.intersection(gd.FR)
    P['base_in_ha'] = base_in.area / 1e4; P['dens_sde_dov'] = 16000 / 250; P['dw2'] = P['base_in_ha'] * P['dens_sde_dov']
    grid2 = []
    for i in range(-12, 13):
        for j in range(-12, 13):
            c = (base_in.centroid.x + U[0] * i * 74 + N[0] * j * 54, base_in.centroid.y + U[1] * i * 74 + N[1] * j * 54)
            r = rect(c[0], c[1], 60, 40).intersection(base_in.buffer(-12))
            if r.area > 400: grid2.append(r)
    # phase 2's courts: perimeter blocks 12 m deep around each plot
    grid2c = [r.buffer(-12, join_style=2) for r in grid2]
    return SimpleNamespace(strip=strip, inner=inner, B=B, blocks=[b.g for b in B], court=court, sq=sq, park=park, stop=stop,
                           base_in=base_in, grid2=grid2, grid2c=grid2c, P=dict(P, floors=P['fl_max']))


def defence(F, gd, strip=None):
    """The Ministry of Defence. The base stays and stays closed; the easements of 2019 stay. Outside the fence the strip under
    the approach stays open (crops or meadow; no buildings, no gatherings — our reading); inside it, a security band: the fence
    kept, a clear zone, an inner fence, a patrol road and masts for lights and cameras. All shapes and sizes are ours: schematic."""
    if strip is None: strip = unary_union([p for p in gd.parcels if p.contains(Point(443700, 4110820)) or p.contains(Point(443822, 4110818))])
    base = gd.base; FR = gd.FR
    def ring_at(d):
        g = base.buffer(-d)
        r = g.exterior if g.geom_type == 'Polygon' else max(g.geoms, key=lambda q: q.area).exterior
        return r.intersection(FR.buffer(-2))
    clear = base.difference(base.buffer(-6)).intersection(FR)               # 6 m clear zone inside the fence
    inner_fence = ring_at(6)
    road = base.buffer(-7).difference(base.buffer(-11)).intersection(FR)     # the patrol road, 4 m wide
    patrol = ring_at(9)
    masts = []
    for seg in ([patrol] if patrol.geom_type == 'LineString' else list(getattr(patrol, 'geoms', []))):
        for t in range(20, int(seg.length), 60):
            p = seg.interpolate(t); masts.append((p.x, p.y))
    # the open land outside the fence: the strip, in crops or meadow (no structures)
    P = {'strip_m2': strip.area, 'clear_m2': clear.area, 'road_m': patrol.length, 'road_m2': road.area, 'masts': len(masts),
         'fence_m': gd.fence_line.intersection(FR).length}
    return SimpleNamespace(strip=strip, clear=clear, inner_fence=inner_fence, road=road, patrol=patrol, masts=masts, P=P)
