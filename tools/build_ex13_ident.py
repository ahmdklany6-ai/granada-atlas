"""Build data/ex13/art/ident.json for the illustrated identity card (Exercise 1.3, build 5.38).
Small framing maps and one terrain section, all from open data:
  - Spain's autonomous regions and the province of Granada: npm package es-atlas 0.6.0 (MIT code; IGN shapefiles,
    CC BY 4.0), longitude/latitude quantised to ~0.002°. The Canary Islands are left out of the small map (said in the note).
  - Terrain section west → east through the cathedral and the Alhambra (y = 4,114,660, EPSG:25830) from IGN MDT25
    (data/terrain/dem_mdt25.bin, CC BY 4.0), one sample every 25 m.
Usage: ESATLAS=/path/to/es-atlas/package/es python3 tools/build_ex13_ident.py"""
import json, os, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ES = os.environ.get('ESATLAS')


def topo(path, obj):
    d = json.load(open(path)); tr = d['transform']; sx, sy = tr['scale']; tx, ty = tr['translate']
    arcs = []
    for a in d['arcs']:
        x = y = 0; pts = []
        for dx, dy in a: x += dx; y += dy; pts.append([round(x * sx + tx, 3), round(y * sy + ty, 3)])
        arcs.append(pts)
    def arc(i): return arcs[i] if i >= 0 else arcs[~i][::-1]
    def ring(ix):
        pts = []
        for i in ix: a = arc(i); pts.extend(a if not pts else a[1:])
        return pts
    out = []
    for g in d['objects'][obj]['geometries']:
        polys = [g['arcs']] if g['type'] == 'Polygon' else g['arcs']
        rings = [ring(p[0]) for p in polys]  # outer rings only (small map)
        rings = [r for r in rings if min(p[0] for p in r) > -13]  # no Canary Islands on the small map
        rings = [simplify(r, 0.01) for r in rings if len(r) > 3]
        out.append({'id': g.get('id'), 'name': (g.get('properties') or {}).get('name'), 'rings': rings})
    return out


def simplify(r, tol):  # Douglas–Peucker in degrees
    if len(r) < 4: return r
    def dp(a, b):
        (x1, y1), (x2, y2) = r[a], r[b]; dx, dy = x2 - x1, y2 - y1; L = (dx * dx + dy * dy) ** 0.5 or 1e-12; best, bi = 0, None
        for i in range(a + 1, b):
            d = abs(dy * r[i][0] - dx * r[i][1] + x2 * y1 - y2 * x1) / L
            if d > best: best, bi = d, i
        return [a, b] if best <= tol else dp(a, bi)[:-1] + dp(bi, b)
    # a closed ring: split at the point farthest from the first one, simplify both halves
    far = max(range(len(r)), key=lambda i: (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2)
    if far in (0, len(r) - 1): return r
    import sys; sys.setrecursionlimit(20000)
    idx = dp(0, far)[:-1] + dp(far, len(r) - 1)
    return [r[i] for i in idx]


def section():
    m = json.load(open(os.path.join(ROOT, 'data/manifest.json')))['terrain']['dem']
    raw = open(os.path.join(ROOT, 'data', m['file']), 'rb').read(); W, H = m['width'], m['height']
    y = 4114660; x0, x1, step = 441000, 450500, 25; out = []
    for x in range(x0, x1 + 1, step):
        c = int((x - m['ox']) / m['px']); r = int((m['oy'] - y) / m['py'])
        v = struct.unpack_from('<h', raw, (r * W + c) * 2)[0]
        out.append(None if v == m['nodata'] else v)
    return {'y': y, 'x0': x0, 'x1': x1, 'step': step, 'z': out,
            'marks': [['Vega', 442300], ['Catedral', 446816], ['Alhambra', 447560], ['Generalife', 448018]],
            'source': 'IGN MDT25 (25 m), CC BY 4.0 — © Instituto Geográfico Nacional'}


def main():
    if not ES: raise SystemExit('set ESATLAS to the es-atlas "es" folder')
    regions = topo(os.path.join(ES, 'autonomous_regions.json'), 'autonomous_regions')
    prov = [p for p in topo(os.path.join(ES, 'provinces.json'), 'provinces') if p['id'] == '18']
    out = {'regions': regions, 'andalucia': '01', 'province': prov[0]['rings'], 'city': [-3.598, 37.177], 'section': section(),
           'sources': {'outlines': 'es-atlas 0.6.0 (MIT) from IGN shapefiles, CC BY 4.0 — simplified ~1 km; Canary Islands not shown',
                       'section': 'IGN MDT25 (25 m), CC BY 4.0'}}
    p = os.path.join(ROOT, 'data/ex13/art/ident.json'); json.dump(out, open(p, 'w'), separators=(',', ':'))
    print(p, os.path.getsize(p), 'bytes;', len(regions), 'regions; section', len(out['section']['z']), 'samples, z', min(v for v in out['section']['z'] if v), '–', max(out['section']['z']))


if __name__ == '__main__':
    main()
