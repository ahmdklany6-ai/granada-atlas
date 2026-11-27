"""The TopoJSON reader of map_spain_granada.py, importable (that script runs on import)."""
import json
from shapely.geometry import Polygon, MultiPolygon


def topo(path):
    t = json.load(open(path)); (sx, sy), (tx, ty) = t['transform']['scale'], t['transform']['translate']
    arcs = []
    for a in t['arcs']:
        x = y = 0; pts = []
        for dx, dy in a: x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    def ring(ix):
        pts = []
        for i in ix:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts += seg if not pts else seg[1:]
        return pts
    def poly(rs):   # rings collapsed by the quantization (fewer than 4 points) are dropped
        rs = [ring(r) for r in rs]; rs = [r for r in rs if len(r) >= 4]
        return Polygon(rs[0], rs[1:]) if rs else None
    def geom(g):
        if g['type'] == 'Polygon': return poly(g['arcs'])
        if g['type'] == 'MultiPolygon':
            ps = [q for q in (poly(p) for p in g['arcs']) if q is not None]
            return MultiPolygon(ps) if ps else None
        return None
    return {k: [(g.get('id'), (g.get('properties') or {}).get('name'), geom(g)) for g in o['geometries'] if g.get('type') in ('Polygon', 'MultiPolygon')] for k, o in t['objects'].items()}
