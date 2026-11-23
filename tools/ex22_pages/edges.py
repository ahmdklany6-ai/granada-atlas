"""Exercise 2.2 · the residents' position on three more stretches of the edge (owner, 23 Nov 2026: "do the same for these three
areas — the river, and how the place around it becomes a pleasant one"), each on its own 710 x 570 m frame with its own
section line S-S square to the fence (tools/build_ex22_frame.py, FRAME / SEC_A / OUT):
  W  the Río Dílar along the south-west fence (Las Gabias | Churriana): a river park between the ring road and the fence;
  E  the east fence at Armilla, the field between Carretera de Sierra Nevada and the houses: a farm park (parque agrario);
  S  the south tip (Alhendín | Ogíjares), where the Dílar, the Acequia Nueva and three cycle paths meet a dead end: a river square.
Every element is a PROPOSAL drawn schematically — shapes, sizes and positions are ours. The proposal is returned as typed
elements that the plan (plan.py) and the section (section.py) both draw, so the two sheets show the same thing.
Not part of the site or of the tests."""
import math, os, json
import numpy as np
from types import SimpleNamespace
from shapely.geometry import Polygon, LineString, Point, MultiLineString, box
from shapely.ops import unary_union, linemerge, substring
from _ex22 import poly, ROOT, allowed_at

FRAMES = {'N': 'data/ex22/frame.json', 'W': 'data/ex22/frame_W.json', 'E': 'data/ex22/frame_E.json', 'S': 'data/ex22/frame_S.json'}
AREA = os.environ.get('AREA', 'N')


def frame_file():
    return os.path.join(ROOT, FRAMES[AREA])


def _lines(F, pred):
    out = []
    for s in F['streets']:
        if pred(s):
            for r in s['r']:
                if len(r[0]) > 1: out.append(LineString(r[0]))
    return unary_union(out) if out else LineString()


def _water(F, name):
    ls = [LineString(r[0]) for w in F['water'] if w.get('nm') == name for r in w['r'] if len(r[0]) > 1]
    u = unary_union(ls) if ls else LineString()
    m = linemerge(u) if u.geom_type == 'MultiLineString' else u
    return m if m.geom_type == 'LineString' else (max(m.geoms, key=lambda g: g.length) if hasattr(m, 'geoms') else m)


def _side_offset(line, d, toward):
    """the parallel of line at d metres, on the side of the point `toward`"""
    a = line.parallel_offset(d, 'left'); b = line.parallel_offset(d, 'right')
    a = a if a.geom_type == 'LineString' else max(a.geoms, key=lambda g: g.length)
    b = b if b.geom_type == 'LineString' else max(b.geoms, key=lambda g: g.length)
    return a if a.distance(Point(toward)) < b.distance(Point(toward)) else b


def _rect(c, lu, lv, ang):
    from shapely import affinity
    r = box(-lu / 2, -lv / 2, lu / 2, lv / 2); r = affinity.rotate(r, ang, origin=(0, 0), use_radians=True); return affinity.translate(r, c[0], c[1])


def _bridges(river, every, length, start, clip):
    out = []
    t = start
    while t < river.length - 20:
        p = river.interpolate(t); q = river.interpolate(min(river.length, t + 2)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
        seg = LineString([(p.x - dy / n * length / 2, p.y + dx / n * length / 2), (p.x + dy / n * length / 2, p.y - dx / n * length / 2)])
        if clip.buffer(2).contains(seg.interpolate(0.5, normalized=True)): out.append(seg)
        t += every
    return out


def _bridge_at(river, d, length):
    p = river.interpolate(d); q = river.interpolate(min(river.length, d + 2)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
    return LineString([(p.x - dy / n * length / 2, p.y + dx / n * length / 2), (p.x + dy / n * length / 2, p.y - dx / n * length / 2)])


def build(F, gd):
    """the proposal for AREA as typed elements: polys {kind: [Polygon]}, lines {kind: [LineString]}, trees [(x, y)],
    pavilion (Polygon, floors, height m) or None, crossings [(x, y, LineString road)], rows (programme), labels, texts"""
    FR = box(*F['frame']); base = gd.base; fence = gd.fence_line; built = gd.built
    strip = unary_union([poly(r) for r in F['strip']['r']]) if F['strip']['r'] else Polygon()
    roads = _lines(F, lambda s: s['hw'] in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified'))
    E = SimpleNamespace(polys={}, lines={}, trees=[], pavilion=None, crossings=[], bridges=[], P={}, labels=[], river=None, acequia=None)
    outside = FR.difference(base.buffer(0.5))
    if AREA == 'W':
        river = _water(F, 'Río Dílar').intersection(FR); river = river if river.geom_type == 'LineString' else max(river.geoms, key=lambda g: g.length)
        E.river = river; ace = _water(F, 'Acequia Nueva').intersection(FR); E.acequia = ace if not ace.is_empty else None
        ring = _lines(F, lambda s: s.get('nm', '') and s['nm'].startswith('Circunvalación'))
        corridor = strip.intersection(outside).difference(roads.buffer(5)).difference(built.buffer(2))
        corridor = max(corridor.geoms, key=lambda g: g.area) if hasattr(corridor, 'geoms') else corridor
        rip = river.buffer(9).intersection(corridor)
        fp = fence.interpolate(fence.project(river.interpolate(0.5, normalized=True)))
        walk = _side_offset(river, 15, (fp.x, fp.y)).intersection(corridor.buffer(-1.5))
        walk = linemerge(walk) if walk.geom_type == 'MultiLineString' else walk
        bridges = _bridges(river, 170, 22, 60, corridor)
        meadow = corridor.difference(rip.buffer(3)).difference(walk.buffer(4)).buffer(-3).buffer(1)
        meadow = unary_union([g for g in (meadow.geoms if hasattr(meadow, 'geoms') else [meadow]) if g.area > 500])
        trees = []
        ln = walk if walk.geom_type == 'LineString' else max(walk.geoms, key=lambda g: g.length)
        for t in range(6, int(ln.length), 11):
            p = ln.interpolate(t); q = ln.interpolate(min(ln.length, t + 1)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
            for sd in ((1, -1) if (t // 11) % 2 else (-1, 1)):
                c = (p.x - dy / n * 5 * sd, p.y + dx / n * 5 * sd)
                if corridor.buffer(-1).contains(Point(c)) and river.distance(Point(c)) > 4: trees.append(c); break
        # a shaded rest stop (1 floor, 3.5 m) by the walk, where the section line crosses it
        sl = gd.sec_line; pc = sl.intersection(walk.buffer(12)).centroid if not sl.intersection(walk.buffer(12)).is_empty else ln.interpolate(0.5, normalized=True)
        ang = math.atan2(*reversed([ln.interpolate(ln.project(pc) + 1).x - pc.x, ln.interpolate(ln.project(pc) + 1).y - pc.y]))
        q = ln.interpolate(ln.project(pc)); qq = ln.interpolate(ln.project(pc) + 1); dx, dy = qq.x - q.x, qq.y - q.y; n = math.hypot(dx, dy) or 1
        side = 1 if Point(q.x - dy / n * 9, q.y + dx / n * 9).distance(river) > Point(q.x + dy / n * 9, q.y - dx / n * 9).distance(river) else -1
        pav = _rect((q.x - dy / n * 9 * side, q.y + dx / n * 9 * side), 14, 7, math.atan2(dy, dx)).intersection(corridor)
        trees = [t for t in trees if not pav.buffer(4).contains(Point(t))]
        cross = []
        for b in bridges:
            e = b.coords[0] if Point(b.coords[0]).distance(ring) < Point(b.coords[-1]).distance(ring) else b.coords[-1]
            rp = ring.interpolate(ring.project(Point(e)))
            if rp.distance(Point(e)) < 30: cross.append((rp.x, rp.y))
        ditch = None
        if E.acequia is not None:
            ac = E.acequia if E.acequia.geom_type == 'LineString' else max(E.acequia.geoms, key=lambda g: g.length)
            ditch = _side_offset(ac, 3, (ac.centroid.x, ac.centroid.y + 50)).difference(built.buffer(2))
        E.polys = {'park': [corridor], 'riparian': [rip], 'meadow': [meadow]}
        E.lines = {'walk': [walk] + ([ditch] if ditch is not None else [])}
        E.trees = trees; E.bridges = bridges; E.crossings = cross; E.pavilion = (pav, 1, 3.5) if not pav.is_empty else None
        E.P = {'park_m2': corridor.area, 'rip_m': river.intersection(corridor.buffer(10)).length, 'walk_m': sum(g.length for g in E.lines['walk'] if g is not None),
               'bridges': len(bridges), 'trees': len(trees), 'pav_m2': pav.area, 'cross': len(cross), 'meadow_m2': meadow.area}
        E.rows = [(1, 'River park between the ring road and the fence (the Catastro parcel of the Dílar’s corridor)', f'{E.P["park_m2"] / 1e6:.3f} km²'),
                  (2, 'The Dílar’s banks replanted: a band about 9 m each side, no works in the channel', f'{E.P["rip_m"]:,.0f} m'),
                  (3, 'A riverside walk on the fence side, 3 m, joined to the fence cycle path', f'{E.P["walk_m"]:,.0f} m'),
                  (4, 'Footbridges over the Dílar, about every 170 m', f'{E.P["bridges"]}'),
                  (5, 'Crossings of the ring road at the footbridges', f'{E.P["cross"]}'),
                  (6, 'Meadows for sitting and play between the river and the fence', f'{E.P["meadow_m2"] / 1e6:.4f} km²'),
                  (7, 'Trees along the walk (riverside species; not chosen)', f'{E.P["trees"]} trees'),
                  (8, 'A shaded rest stop with water and toilets, 1 floor (about 3.5 m)', f'{E.P["pav_m2"]:,.0f} m²'),
                  (0, 'New homes, works in the river channel', '0')]
        E.names = [('RÍO DÍLAR', river.interpolate(0.3, normalized=True), 'water'), ('LAS GABIAS | CHURRIANA DE LA VEGA', Point(F['frame'][0] + 140, F['frame'][1] + 40), 'town')]
    elif AREA == 'E':
        road = _lines(F, lambda s: s.get('nm') == 'Carretera de Sierra Nevada')
        field = max((poly(l['r'][0]) for l in F['landuse'] if l['lu'] == 'farmland' and l['r']), key=lambda g: g.area)
        field = field.intersection(outside).difference(built.buffer(3))
        o = field.centroid
        # the field's own axes: along the road
        rl = road if road.geom_type == 'LineString' else max(road.geoms, key=lambda g: g.length)
        a0, a1 = rl.coords[0], rl.coords[-1]; ang = math.atan2(a1[1] - a0[1], a1[0] - a0[0]); U = (math.cos(ang), math.sin(ang)); N = (-U[1], U[0])
        at = lambda u, v: (o.x + U[0] * u + N[0] * v, o.y + U[1] * u + N[1] * v)
        span = LineString([at(-400, 0), at(400, 0)]).intersection(field)
        # paths: one along the field (u), one across it on the section line's side, from the houses to the road
        spine = LineString([at(-400, 0), at(400, 0)]).intersection(field.buffer(-2))
        sl = gd.sec_line; across = sl.intersection(field.buffer(-2))
        spine = spine if spine.geom_type == 'LineString' else max(spine.geoms, key=lambda g: g.length)
        across = across if across.geom_type == 'LineString' else (max(across.geoms, key=lambda g: g.length) if hasattr(across, 'geoms') else LineString())
        # a tree row along the road, inside the field (6 m), a buffer of shade and dust
        rowl = _side_offset(rl, field.distance(rl) + 5, (o.x, o.y)).intersection(field.buffer(-1))
        trees = []
        for g in ([rowl] if rowl.geom_type == 'LineString' else list(getattr(rowl, 'geoms', []))):
            for t in range(4, int(g.length), 9): p = g.interpolate(t); trees.append((p.x, p.y))
        # allotments at the houses' end (south), an orchard in the middle, a meadow at the north end
        vs = [((x - o.x) * U[0] + (y - o.y) * U[1]) for x, y in field.exterior.coords]; u_min, u_max = min(vs), max(vs)
        peru = _lines(F, lambda s: s.get('nm') == 'Calle Perú')
        if not peru.is_empty and Point(at(u_max, 0)).distance(peru) < Point(at(u_min, 0)).distance(peru):   # the allotments at the houses' end
            U = (-U[0], -U[1]); N = (-N[0], -N[1]); ang += math.pi; vs = [-v for v in vs]; u_min, u_max = -u_max, -u_min
        plots = []
        for i in range(0, 30):
            for vc in (-14, -7.5, 7.5, 14):
                c = at(u_min + 14 + i * 6.2, vc); r = _rect(c, 5, 6, ang)
                if field.buffer(-3).contains(r) and r.distance(spine) > 1.6 and i < 14: plots.append(r)
        allot = unary_union(plots)
        orchard = []
        for i in range(-50, 50):
            for j in range(-12, 13):
                c = at(i * 10, j * 10); p = Point(c)
                if field.buffer(-5).contains(p) and allot.buffer(4).disjoint(p) and spine.distance(p) > 3 and (across.is_empty or across.distance(p) > 3) and (rowl.is_empty or p.distance(rowl) > 6):
                    u = (c[0] - o.x) * U[0] + (c[1] - o.y) * U[1]
                    if u < u_max - 110: orchard.append(c)
        meadow = field.intersection(_rect(at(u_max - 55, 0), 110, 400, ang)).buffer(-6)
        orchard = [t for t in orchard if not meadow.buffer(3).contains(Point(t))]
        # a farm hall and market (1 floor, about 4.5 m) where the path from the houses meets the spine
        hc = across.interpolate(0.55, normalized=True) if not across.is_empty else spine.interpolate(0.5, normalized=True)
        uh = (hc.x - o.x) * U[0] + (hc.y - o.y) * U[1]
        ac2 = LineString([at(uh, -400), at(uh, 400)]).intersection(field.buffer(-1))
        across = ac2 if ac2.geom_type == 'LineString' else max(ac2.geoms, key=lambda g: g.length)
        hall = _rect((hc.x, hc.y), 24, 12, ang).intersection(field)
        orchard = [t for t in orchard if not hall.buffer(6).contains(Point(t))]
        cross = []
        for ln_ in (across,):
            if ln_.is_empty: continue
            q = road.intersection(sl)
            if not q.is_empty: cross.append((q.x, q.y) if q.geom_type == 'Point' else (q.geoms[0].x, q.geoms[0].y))
        q2 = rl.interpolate(rl.project(Point(at(u_max - 40, 0)))); cross.append((q2.x, q2.y))
        E.polys = {'park': [field], 'allot': [allot], 'meadow': [meadow]}
        E.lines = {'walk': [spine] + ([across] if not across.is_empty else [])}
        E.trees = trees + orchard; E.crossings = cross; E.pavilion = (hall, 1, 4.5)
        E.P = {'park_m2': field.area, 'allot_n': len(plots), 'allot_m2': allot.area, 'trees': len(trees) + len(orchard), 'row': len(trees), 'orchard': len(orchard),
               'meadow_m2': meadow.area, 'hall_m2': hall.area, 'walk_m': spine.length + across.length, 'cross': len(cross)}
        E.rows = [(1, 'Farm park on the field between Carretera de Sierra Nevada and the houses: it stays farmland, opened to walk in', f'{E.P["park_m2"] / 1e6:.3f} km²'),
                  (2, f'Allotments by the houses, {E.P["allot_n"]} plots of 30 m²', f'{E.P["allot_m2"]:,.0f} m²'),
                  (3, 'An orchard on a 10 m grid in the middle of the field (fruit trees; species not chosen)', f'{E.P["orchard"]} trees'),
                  (4, 'A meadow at the north end, for play and gatherings of neighbours', f'{E.P["meadow_m2"] / 1e6:.4f} km²'),
                  (5, 'A tree row along the road, inside the field, for shade and against dust and noise', f'{E.P["row"]} trees'),
                  (6, 'Paths: along the field, and across it from the houses to the road (3 m)', f'{E.P["walk_m"]:,.0f} m'),
                  (7, 'Crossings of Carretera de Sierra Nevada to the fence cycle path', f'{E.P["cross"]}'),
                  (8, 'A farm hall and market, 1 floor (about 4.5 m)', f'{E.P["hall_m2"]:,.0f} m²'),
                  (0, 'New homes on the field', '0')]
        E.names = [('ARMILLA', Point(F['frame'][2] - 60, F['frame'][3] - 30), 'town'), ('OGÍJARES ↓', Point(F['frame'][2] - 70, F['frame'][1] + 25), 'town')]
    elif AREA == 'S':
        river = _water(F, 'Río Dílar').intersection(FR); river = river if river.geom_type == 'LineString' else max(river.geoms, key=lambda g: g.length)
        E.river = river; ace = _water(F, 'Acequia Nueva').intersection(FR); ace = ace if ace.geom_type == 'LineString' else (max(ace.geoms, key=lambda g: g.length) if hasattr(ace, 'geoms') else None); E.acequia = ace
        dead = Point(F['dead'][0]) if F['dead'] else fence.interpolate(fence.project(Point(443800, 4108100)))
        out_ = outside.difference(roads.buffer(6)).difference(built.buffer(2))
        rip = river.buffer(9).intersection(out_)
        rip = unary_union([g for g in (rip.geoms if hasattr(rip, 'geoms') else [rip]) if g.area > 300])
        # the river square at the tip: where the dead end, the three cycle paths and the river meet
        sq = dead.buffer(34).intersection(out_).difference(river.buffer(5))
        sq = max(sq.geoms, key=lambda g: g.area) if hasattr(sq, 'geoms') else sq
        # a riverside walk on the east bank, downstream from the square; the acequia walk
        tp = (dead.x + 200, dead.y - 200)
        walk = _side_offset(river, 13, tp).intersection(out_.buffer(-1))
        walk = linemerge(walk) if walk.geom_type == 'MultiLineString' else walk
        acew = _side_offset(ace, 3, (ace.centroid.x - 50, ace.centroid.y - 50)).intersection(out_) if ace is not None else LineString()
        # a riverside meadow on the west bank, where the parcel beside the river is open (its farm buildings stay, 6 m clear)
        orch_area = river.buffer(45).intersection(strip).intersection(out_).difference(built.buffer(6)).difference(rip.buffer(1)).buffer(-2)
        orch_area = unary_union([g for g in (orch_area.geoms if hasattr(orch_area, 'geoms') else [orch_area]) if g.area > 400]) if not orch_area.is_empty else orch_area
        orchard = []
        trees = []
        for g in ([walk] if walk.geom_type == 'LineString' else list(getattr(walk, 'geoms', []))):
            for t in range(5, int(g.length), 12):
                p = g.interpolate(t); q = g.interpolate(min(g.length, t + 1)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
                c = (p.x - dy / n * 4.5, p.y + dx / n * 4.5) if river.distance(Point(p.x - dy / n * 4.5, p.y + dx / n * 4.5)) < river.distance(Point(p.x + dy / n * 4.5, p.y - dx / n * 4.5)) else (p.x + dy / n * 4.5, p.y - dx / n * 4.5)
                if out_.contains(Point(c)) and not sq.contains(Point(c)): trees.append(c)
        bridges = []
        sl = gd.sec_line; xq = sl.intersection(river)
        if not xq.is_empty:
            p = xq if xq.geom_type == 'Point' else xq.geoms[0]; bridges.append(_bridge_at(river, river.project(p), 22))
        bridges.append(_bridge_at(river, river.project(dead) + 60, 22))
        cross = []
        for nm in ('Carretera de Sierra Nevada', 'Circunvalación Las Gabias - Alhendín'):
            rl = _lines(F, lambda s, nm=nm: s.get('nm') == nm)
            if rl.is_empty: continue
            p = rl.interpolate(rl.project(dead)); cross.append((p.x, p.y))
        E.polys = {'park': [rip.union(sq).union(orch_area)], 'riparian': [rip], 'plaza': [sq]} | ({'meadow': [orch_area]} if not orch_area.is_empty else {})
        E.lines = {'walk': [walk] + ([acew] if not acew.is_empty else [])}
        E.trees = trees + orchard; E.bridges = bridges; E.crossings = cross
        E.P = {'sq_m2': sq.area, 'rip_m': river.intersection(rip.buffer(1)).length, 'walk_m': sum(g.length for g in E.lines['walk']), 'trees': len(trees), 'orchard': len(orchard),
               'orch_m2': orch_area.area if not orch_area.is_empty else 0, 'bridges': len(bridges), 'cross': len(cross)}
        E.rows = [(1, 'A river square at the tip of the base, where the dead end, three cycle paths and the Dílar meet', f'{E.P["sq_m2"]:,.0f} m²'),
                  (2, 'The Dílar’s banks replanted, about 9 m each side, no works in the channel', f'{E.P["rip_m"]:,.0f} m'),
                  (3, 'A riverside walk on the east bank, and a walk along the Acequia Nueva (3 m)', f'{E.P["walk_m"]:,.0f} m'),
                  (4, 'Footbridges over the Dílar: on the section line and downstream of the square', f'{E.P["bridges"]}'),
                  (5, 'Crossings of Carretera de Sierra Nevada and the ring road at the square', f'{E.P["cross"]}'),
                  (6, 'Trees along the walk (riverside species; not chosen)', f'{E.P["trees"]} trees'),
                  (7, 'A riverside meadow on the west bank; the farm buildings on the parcel stay', f'{E.P["orch_m2"] / 1e6:.4f} km²'),
                  (0, 'New homes, works in the river channel', '0')]
        E.names = [('RÍO DÍLAR', river.interpolate(0.75, normalized=True), 'water'), ('ALHENDÍN | OGÍJARES', Point(F['frame'][0] + 110, F['frame'][1] + 30), 'town')]
    return E


def target(F, gd, E):
    """the open land each area's proposals work on (the same piece for the three groups)"""
    if AREA == 'W': return E.polys['park'][0]
    if AREA == 'E': return E.polys['park'][0]
    strip = unary_union([poly(r) for r in F['strip']['r']])
    return strip.difference(gd.base).difference(gd.built.buffer(6)).difference(E.river.buffer(9)).buffer(-1).buffer(1)


def developer(F, gd, E=None):
    """The private developer on an edge area: housing bars parallel to the fence on the same open land the residents want,
    as high as the flight ceiling allows (1 m under it, floors of 3 m, a 0.6 m parapet) and at most 6 floors (our cap: the
    towns' own scale); 20 m kept free from the river (our assumption); shops on the ground floor beside the main road; garden
    courts over one level of parking; phase 2 on the base land in the frame, only if the base leaves (as on the north edge).
    Schematic: shapes, sizes and counts are ours."""
    import groups as _g
    E = E or build(F, gd); FR = box(*F['frame'])
    land = target(F, gd, E)
    if E.river is not None: land = land.difference(E.river.buffer(20))
    land = land.difference(gd.built.buffer(6))
    inner = land.buffer(-4 if AREA != 'W' else -2, join_style=2)
    c0 = land.centroid; fp = gd.fence_line.interpolate(gd.fence_line.project(c0)); fq = gd.fence_line.interpolate(gd.fence_line.project(c0) + 5)
    ang = math.atan2(fq.y - fp.y, fq.x - fp.x); U = (math.cos(ang), math.sin(ang)); N = (-U[1], U[0])
    at = lambda u, v: (c0.x + U[0] * u + N[0] * v, c0.y + U[1] * u + N[1] * v)
    quad = lambda u0, u1, v0, v1: Polygon([at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)])
    DEP, LEN, GAP, STEP = 12.0, 40.0, 8.0, 30.0
    mains = _lines(F, lambda s: s['hw'] in ('primary', 'secondary', 'tertiary'))
    def lay(ov, ou):
      B = []
      for v in np.arange(-400 + ov, 400, STEP):
        for u in np.arange(-400 + ou, 400, LEN + GAP):
            g = quad(u, u + LEN, v, v + DEP).intersection(inner)
            if g.is_empty or g.area < 250: continue
            g = max(g.geoms, key=lambda q: q.area) if hasattr(g, 'geoms') else g
            if g.area < 250 or g.minimum_rotated_rectangle.area > g.area * 1.2: continue
            pts = list(g.exterior.coords) + [(g.centroid.x, g.centroid.y)]
            ceil = min(allowed_at(F, x, y) for x, y in pts)
            fl = int(min(6, (ceil - 1.0 - 0.6) // 3.0))
            if fl >= 2: B.append(SimpleNamespace(row='N', g=g, floors=fl, ceil=ceil, shop=(not mains.is_empty and g.distance(mains) < 30)))
      return B
    B = max((lay(ov, ou) for ov in range(0, 30, 3) for ou in range(0, 48, 12)), key=lambda B_: sum(b.g.area * b.floors for b in B_))   # the grid's offset that builds most
    blocks = unary_union([b.g for b in B]) if B else Polygon()
    court = inner.difference(blocks.buffer(6))
    court = unary_union([q for q in (court.geoms if hasattr(court, 'geoms') else [court]) if q.area > 300]) if not court.is_empty else court
    park = court.buffer(-3) if not court.is_empty else court
    base_in = gd.base.intersection(FR)
    grid2 = []
    for i in range(-12, 13):
        for j in range(-12, 13):
            c = (base_in.centroid.x + U[0] * i * 74 + N[0] * j * 54, base_in.centroid.y + U[1] * i * 74 + N[1] * j * 54)
            r = _rect(c, 60, 40, ang).intersection(base_in.buffer(-12))
            if r.area > 400: grid2.append(r)
    grid2c = [r.buffer(-12, join_style=2) for r in grid2]
    P = {'strip_m2': land.area, 'm2_per_dw': 100, 'gfa': sum(b.g.area * b.floors for b in B), 'shop_m2': sum(b.g.area for b in B if b.shop)}
    P['dw1'] = (P['gfa'] - P['shop_m2']) / 100; P['blocks'] = len(B); P['fl_min'] = min((b.floors for b in B), default=0); P['fl_max'] = max((b.floors for b in B), default=0)
    P['court_m2'] = court.area; P['sq_m2'] = 0; P['spaces'] = park.area / 28; P['cover'] = blocks.area / max(1, land.area)
    P['base_in_ha'] = base_in.area / 1e4; P['dens_sde_dov'] = 16000 / 250; P['dw2'] = P['base_in_ha'] * P['dens_sde_dov']; P['floors'] = P['fl_max']
    return SimpleNamespace(strip=land, inner=inner, B=B, blocks=[b.g for b in B], court=court, sq=Polygon(), park=park, stop=None,
                           base_in=base_in, grid2=grid2, grid2c=grid2c, P=P)


def defence(F, gd, E=None):
    """The Ministry of Defence on an edge area: the same security band inside the fence as on the north edge; the area's
    open land kept open (crops or meadow; no buildings, no gatherings — our reading)."""
    import groups as _g
    E = E or build(F, gd)
    return _g.defence(F, gd, strip=target(F, gd, E))


GTEXT = {   # the developer's and Defence's reasons, per area (their positions are the group's own, as on the north edge)
    'developer': {
        'W': ['The corridor between the ring road and the fence is open land beside the Vega’s cycle path, about 0.046 km² (Catastro).',
              'The flight ceiling is about 60 m above the ground here (our calculation): it does not limit housing; our cap of 6 floors does.',
              'The river is kept at 20 m (our assumption); the rest of the corridor is building land for the developer.'],
        'E': ['The field by Carretera de Sierra Nevada is about 0.08 km² of farmland beside Armilla’s houses (OSM, Catastro): the town’s next block.',
              'The flight ceiling is about 52–54 m above the ground here (our calculation): our cap of 6 floors limits the blocks, not the ceiling.'],
        'S': ['The tip lies under the approach to runway 36: the flight ceiling is about 14–18 m above the ground (our calculation): the blocks stop at 5 floors.',
              'The open land beside the river keeps its farm buildings; the blocks stand around them and 20 m from the river (our assumption).']},
    'defence': {
        'W': ['The fence here runs beside the ring road and the cycle path: a long edge with people along it.',
              'The easements of 2019 stay; the river corridor stays open, without buildings or gatherings.'],
        'E': ['Carretera de Sierra Nevada and a cycle path run right beside the fence; the field is the last open land before the houses.',
              'The easements of 2019 stay; the field stays farmland, without buildings or gatherings.'],
        'S': ['The tip of the base sits under the approach to runway 36: the ceiling is only 14–18 m above the ground here.',
              'Three cycle paths and two roads meet at the fence: Defence keeps the land open and the band inside the fence clear.']}}


TEXT = {
    'W': {'code': 'RW', 'where': 'The south-west edge: the Río Dílar between the ring road and the fence (Las Gabias | Churriana de la Vega).',
          'position': '“The Dílar already runs along the fence: give us its banks — a river park we can walk to and along, with no new homes.”',
          'why': ['The Dílar runs about 30–80 m outside the fence here, between it and the ring road (OSM); the walking route around the base follows the road, not the river (2.1, map 02).',
                  'The cycle path of the Vega (Alhendín–Gabias) already runs along the fence on this side.',
                  'The flight ceiling is about 60 m above the ground here (RD 118/2019, our calculation): it does not limit a park.',
                  'Few homes stand within 400 m (Catastro): the park serves the towns through the cycle paths, more than its neighbours.'],
          'daily_head': 'WHAT CHANGES IN DAILY LIFE',
          'daily': ['A river to walk along instead of a ring road: the route between Las Gabias and Alhendín gets shade, water and a place to stop.',
                    'Footbridges and crossings join the farm tracks of the Vega to the fence cycle path.',
                    'The river is left as it runs: the banks are planted, the channel is not touched.']},
    'E': {'code': 'RE', 'where': 'The east edge at Armilla: the field between Carretera de Sierra Nevada and the houses (Armilla | Ogíjares).',
          'position': '“Keep the field a field, but let us in: a farm park between our houses and the fence — allotments, an orchard, a meadow and a way across the road.”',
          'why': ['The field between the road and the houses is farmland, about 0.08 km², with no building on it (OSM land use, Catastro).',
                  'Carretera de Sierra Nevada and the cycle path to Ogíjares run between the field and the fence.',
                  'The flight ceiling is about 52–54 m above the ground here (our calculation): low buildings and trees fit easily.'],
          'daily_head': 'WHAT CHANGES IN DAILY LIFE',
          'daily': ['A plot to grow food five minutes from home, and an orchard to walk through.',
                    'From the houses to the fence cycle path without walking along the road: a path across the field and a crossing.',
                    'The farm hall sells what the Vega grows; the field keeps its soil and stays open.']},
    'S': {'code': 'RS', 'where': 'The south tip of the base (Alhendín | Ogíjares): the Río Dílar, the Acequia Nueva, three cycle paths and a dead end meet at the fence.',
          'position': '“Where three cycle paths and the river meet the fence, give us a place to stop: a river square, the banks planted, a way over the water.”',
          'why': ['At the tip one street ends at the fence (one of the 13 dead ends, 2.1, map 01), beside the Dílar and the Acequia Nueva.',
                  'Three cycle paths of the Vega meet here (Ogíjares–Alhendín, Alhendín–Gabias and the fence path).',
                  'The flight ceiling is lower here, about 14–18 m above the ground (approach to runway 36, our calculation): only low things fit — a square, trees, footbridges.'],
          'daily_head': 'WHAT CHANGES IN DAILY LIFE',
          'daily': ['A dead end becomes a meeting point: benches, shade and water where the cycle paths cross.',
                    'Over the Dílar on foot, safely across the two roads.',
                    'A meadow by the water; the river left as it runs.']},
}
