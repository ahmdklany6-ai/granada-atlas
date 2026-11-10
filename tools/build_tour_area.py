#!/usr/bin/env python3
"""Build 5.27 — data for step 3 of the story tour: the municipalities of the Granada agglomeration (data/vec/tour_area.json).

Inputs (read live, or from $INE when given a folder of saved responses):
  - INE table 2871 (Cifras oficiales de población, padrón continuo, province of Granada): residents 1 Jan 2015 and 2025;
  - INE table 31025 (Atlas de distribución de renta de los hogares, ADRH): net income per person, latest year;
  - INE table 59060 (Índice de Precios de Vivienda en Alquiler, IPVA): rent index 2015 = 100, municipalities with more than
    10,000 residents only — an index of change, NOT a rent level (no €/m² is published in it);
  - municipal outlines: npm package es-atlas 0.6.0 (MIT; IGN shapefiles, CC BY 4.0), quantised to ~0.002°.
Municipalities: the 34 of the POTAUG area as listed on es.wikipedia "Área metropolitana de Granada" (checked 10 Nov 2026).
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'vec', 'tour_area.json')
ESATLAS = os.environ.get('ESATLAS')  # path to es-atlas/es/municipalities.json
INE = os.environ.get('INE')          # optional folder with t2871.json, t31025.json, t59060.json
MUNIS = ['Albolote', 'Alfacar', 'Alhendín', 'Armilla', 'Atarfe', 'Cájar', 'Cenes de la Vega', 'Chauchina', 'Churriana de la Vega',
         'Cijuela', 'Colomera', 'Cúllar Vega', 'Dílar', 'Fuente Vaqueros', 'Las Gabias', 'Gójar', 'Granada', 'Güevéjar', 'Huétor Vega',
         'Jun', 'Láchar', 'Maracena', 'Monachil', 'Ogíjares', 'Peligros', 'Pinos Genil', 'Pinos Puente', 'Pulianas', 'Santa Fe',
         'Valderrubio', 'Vegas del Genil', 'Villa de Otura', 'Víznar', 'La Zubia']
FIVE = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares']


def ine_name(n):  # INE writes "Gabias, Las", "Zubia, La"
    for art in ('Las ', 'La ', 'Los ', 'El '):
        if n.startswith(art): return n[len(art):] + ', ' + art.strip()
    return n


def table(tid, nult):
    fn = INE and os.path.join(INE, f't{tid}.json')
    if fn and os.path.exists(fn): return json.load(open(fn))
    u = f'https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{tid}?nult={nult}'
    return json.loads(urllib.request.urlopen(u, timeout=300).read())


def series(tab, pattern):
    # the last match: table 2871 lists the province ("Granada. Total.") before the municipality of the same name
    hit = [s for s in tab if s['Nombre'].strip().startswith(pattern)]
    return {x['Anyo']: x['Valor'] for x in hit[-1]['Data'] if x.get('Valor') is not None} if hit else None


def topo_features(path, prov='18'):
    d = json.load(open(path)); tr = d['transform']; sx, sy = tr['scale']; tx, ty = tr['translate']
    arcs = []
    for a in d['arcs']:
        x = y = 0; pts = []
        for dx, dy in a: x += dx; y += dy; pts.append([round(x * sx + tx, 5), round(y * sy + ty, 5)])
        arcs.append(pts)
    def arc(i): return arcs[i] if i >= 0 else arcs[~i][::-1]
    def ring(ix):
        pts = []
        for i in ix: a = arc(i); pts.extend(a if not pts else a[1:])
        return pts
    out = {}
    for g in d['objects']['municipalities']['geometries']:
        if not g['id'].startswith(prov): continue
        if g['type'] == 'Polygon': geom = {'type': 'Polygon', 'coordinates': [ring(r) for r in g['arcs']]}
        else: geom = {'type': 'MultiPolygon', 'coordinates': [[ring(r) for r in p] for p in g['arcs']]}
        out[g['properties']['name']] = (g['id'], geom)
    return out


def main():
    t_pop, t_inc, t_rent = table(2871, 11), table(31025, 1), table(59060, 12)
    shapes = topo_features(ESATLAS)
    feats, missing = [], []
    for m in MUNIS:
        n = ine_name(m)
        pop = series(t_pop, f'{n}. Total. Total habitantes')
        inc = series(t_inc, f'{n}. Dato base. Renta neta media por persona')
        rent = series(t_rent, f'{n}. Índice. Total')
        key = next((k for k in shapes if k in (m, n, 'Otura' if m == 'Villa de Otura' else None)), None)
        if not key: missing.append(m); continue
        code, geom = shapes[key]
        p15, p25 = (pop or {}).get(2015), (pop or {}).get(2025)
        iy = max(inc) if inc else None
        ry = max(rent) if rent else None
        props = {'name': m, 'ine': code, 'pop2015': p15, 'pop2025': p25,
                 'chg': round((p25 / p15 - 1) * 100, 1) if p15 and p25 else None,
                 'inc': inc[iy] if inc else None, 'incYear': iy,
                 'rent': round(rent[ry], 1) if rent else None, 'rentYear': ry, 'five': m in FIVE}
        feats.append({'type': 'Feature', 'properties': props, 'geometry': geom})
    if missing: sys.exit('no outline for ' + ', '.join(missing))
    def grp(sel):
        a = sum(f['properties']['pop2015'] for f in feats if sel(f)); b = sum(f['properties']['pop2025'] for f in feats if sel(f))
        return {'pop2015': a, 'pop2025': b, 'chg': round((b / a - 1) * 100, 1)}
    stats = {'n': len(feats), 'all': grp(lambda f: True), 'five': grp(lambda f: f['properties']['five']),
             'city': grp(lambda f: f['properties']['name'] == 'Granada'),
             'rest': grp(lambda f: f['properties']['name'] != 'Granada' and not f['properties']['five']),
             'rentCovered': sum(1 for f in feats if f['properties']['rent'] is not None)}
    json.dump({'type': 'FeatureCollection', 'stats': stats, 'features': feats}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    for f in feats: print(json.dumps({k: v for k, v in f['properties'].items()}, ensure_ascii=False), file=sys.stderr)
    print(json.dumps(stats), file=sys.stderr); print('wrote', OUT, os.path.getsize(OUT), file=sys.stderr)


if __name__ == '__main__':
    main()
