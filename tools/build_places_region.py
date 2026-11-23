"""Build 5.50 — places (Overture) beyond the Granada municipality.
The places file supplied by the owner (overture-all-places-granada.geojson, built in 5.x by tools/build_extra.js) covers
the Granada municipality only, so every study area south of the city (the air base, Armilla, Las Gabias) reported
"0 places". This adds, OUTSIDE the municipality only, the places of the latest Overture release read on the GitHub runner
(tools/verify/basefill_fetch.py, region -3.75…-3.46 E, 37.06…37.27 N). Inside the municipality the supplied file is kept
as it is. Same fields as tools/build_extra.js (c = basic_category, cd = taxonomy.primary, g = taxonomy.hierarchy[0] — checked
to match the supplied file on 19,665 shared ids); r = 1 marks the added records. Usage:
python3 tools/build_places_region.py overture_places.json"""
import json, os, sys
from shapely.geometry import shape, Point
from shapely.prepared import prep
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = json.load(open(sys.argv[1])); rel = src['release']
P = os.path.join(ROOT, 'data/vec/places.json'); cur = json.load(open(P))
base = [f for f in cur['features'] if not f['properties'].get('r')]   # re-runnable: drop what this tool added before
ids = {f['properties']['id'] for f in base}
muni = prep(shape(next(f for f in json.load(open(os.path.join(ROOT, 'data/vec/admin.json')))['features'] if f['properties'].get('kind') == 'municipio')['geometry']))
seen = {(str(f['properties'].get('n') or '').strip().lower(), round(f['geometry']['coordinates'][0], 5), round(f['geometry']['coordinates'][1], 5)): f['properties']['id'] for f in base}
add = []
for r in src['places']:
    if r['id'] in ids or muni.contains(Point(r['lon'], r['lat'])): continue
    tx = r.get('taxonomy') or {}; hi = tx.get('hierarchy') or []; ad = (r.get('addresses') or [{}])[0] or {}
    nm = (r.get('names') or {}).get('primary'); br = r.get('brand') or {}
    q = {'id': r['id'], 'n': nm, 'c': r.get('basic_category'), 'cd': tx.get('primary'), 'g': hi[0] if hi else None, 'l': ad.get('locality'), 'a': ad.get('freeform'),
         'pc': ad.get('postcode'), 'cf': None if r.get('confidence') is None else round(r['confidence'], 2), 'w': (r.get('websites') or [None])[0], 'ph': (r.get('phones') or [None])[0],
         'b': (br.get('names') or {}).get('primary') if isinstance(br, dict) else None, 's': r.get('operating_status'), 'in': 0, 'r': 1}
    key = (str(nm or '').strip().lower(), round(r['lon'], 5), round(r['lat'], 5))
    if key in seen: q['dup'] = seen[key]
    else: seen[key] = r['id']
    q = {k: v for k, v in q.items() if v is not None}
    add.append({'type': 'Feature', 'properties': q, 'geometry': {'type': 'Point', 'coordinates': [round(r['lon'], 6), round(r['lat'], 6)]}})
feats = base + add
json.dump({'type': 'FeatureCollection', 'features': feats}, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
M = json.load(open(os.path.join(ROOT, 'data/manifest.json'))); L = M['layers']['places']
L.update({'features': len(feats), 'bytes': os.path.getsize(P), 'coverage': [-3.75, 37.06, -3.46, 37.27],
          'source': 'Overture Maps Foundation — Places theme: inside the Granada municipality the file supplied by the user (overture-all-places-granada.geojson); outside it, Overture release %s read from the public S3 bucket (r = 1)' % rel,
          'date': 'supplied 2026-10 (municipality); release %s (rest of the region)' % rel, 'added_5_50': {'release': rel, 'features': len(add), 'tool': 'tools/build_places_region.py'}})
L['fields']['r'] = '1 = added in 5.50 from Overture release %s (outside the municipality)' % rel
groups = {}
for f in feats:
    if not f['properties'].get('dup'): g = f['properties'].get('g') or '_none'; groups[g] = groups.get(g, 0) + 1
L['stats']['total'] = len(feats); L['stats']['groups'] = groups; L['stats']['outsideMunicipality'] = sum(1 for f in feats if not f['properties'].get('in'))
open(os.path.join(ROOT, 'data/manifest.json'), 'w').write(json.dumps(M, ensure_ascii=False, separators=(',', ':')))
print('places: kept', len(base), 'added', len(add), 'release', rel, os.path.getsize(P), 'bytes')
