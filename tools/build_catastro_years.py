"""Build 5.50 — construction years from the Catastro for the atlas buildings.
OpenStreetMap almost never carries a construction date here (39 of 101,674 buildings had start_date), so the
"Construction periods" card and the period layer were empty everywhere — e.g. 0 of 14,076 buildings in the owner's "Base"
area. The Dirección General del Catastro publishes every cadastral building with its year of construction
(INSPIRE Buildings, ATOM per municipality, bu-core2d:dateOfConstruction; free reuse with attribution).
Input: catastro_buildings*.json from tools/verify/basefill_fetch.py (runner) — one point per cadastral building
(footprint centroid, year, use, reference). Each OSM footprint in data/vec/buildings/*.json and data/vec/buildings_lite.json
gets `cy` = the median year of the cadastral buildings whose centroid falls inside it (and `cyn` = how many); no point
inside → no `cy` (shown as "no year"). OSM start_date, where present, still wins in the app. Nothing is estimated.
Caveat carried to the app: the Catastro year is the year of construction recorded for the cadastral building; a major
renovation can replace it.
Usage: python3 tools/build_catastro_years.py catastro_buildings.json [catastro_buildings_2.json ...]"""
import json, os, sys, glob, statistics
from shapely.geometry import shape, Point
from shapely import STRtree
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pts, munis = [], []
for f in sys.argv[1:]:
    d = json.load(open(f)); munis += [m for m in d['municipalities'] if isinstance(m[1], int)]
    pts += [b for b in d['b'] if b[2] and 1000 <= b[2] <= 2026]
seen = set(); P = []
for b in pts:
    if b[5] in seen: continue
    seen.add(b[5]); P.append(b)
print('catastro points with a year', len(P), 'from', len(munis), 'municipalities', flush=True)
geo = [Point(b[0], b[1]) for b in P]; tree = STRtree(geo)
def year_of(g):
    try: gs = shape(g)
    except Exception: return None, 0
    if gs.is_empty: return None, 0
    if not gs.is_valid: gs = gs.buffer(0)
    idx = [i for i in tree.query(gs) if gs.contains(geo[i])]
    if not idx: return None, 0
    return int(round(statistics.median(P[i][2] for i in idx))), len(idx)
tot = hit = 0
for f in sorted(g for g in glob.glob(os.path.join(ROOT, 'data/vec/buildings/*.json')) if not g.endswith('index.json')):
    d = json.load(open(f)); ch = False
    for ft in d['features']:
        y, n = year_of(ft['geometry']); tot += 1
        p = ft['properties']; old = (p.get('cy'), p.get('cyn'))
        if y: p['cy'] = y; p['cyn'] = n; hit += 1
        else: p.pop('cy', None); p.pop('cyn', None)
        ch |= old != (p.get('cy'), p.get('cyn'))
    if ch: json.dump(d, open(f, 'w'), separators=(',', ':'))
print('tiles: buildings', tot, 'with a Catastro year', hit, flush=True)
# the simplified layer (neighbourhood scales): the same year, and its period precomputed with the app's classes
PERIODS = [(0, 1899, 'pre_1900'), (1900, 1939, '1900_1939'), (1940, 1959, '1940_1959'), (1960, 1979, '1960_1979'), (1980, 1999, '1980_1999'), (2000, 9999, '2000_plus')]
lp = os.path.join(ROOT, 'data/vec/buildings_lite.json'); L = json.load(open(lp)); lh = 0
for ft in L['features']:
    p = ft['properties']
    if p.get('period') not in (None, 'no_data') and not p.get('pc'): continue  # an OSM start_date period stays
    y, n = year_of(ft['geometry'])
    if y: p['period'] = next(k for a, b, k in PERIODS if a <= y <= b); p['pc'] = 1; lh += 1
    else: p['period'] = 'no_data'; p.pop('pc', None)
json.dump(L, open(lp, 'w'), separators=(',', ':'))
print('lite: features', len(L['features']), 'with a Catastro period', lh)
json.dump({'municipalities': munis, 'points': len(P), 'tiles_buildings': tot, 'tiles_with_year': hit, 'lite_with_period': lh},
          open(os.path.join(ROOT, 'tools/catastro_years_summary.json'), 'w'), ensure_ascii=False, indent=1)
