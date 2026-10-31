# Decode the compact OSM tree snapshot (fetched from Overpass in a browser, see README) into data/vec/trees_osm.json.
# Usage: python3 tools/build_trees.py <encoded.txt>
import json, sys, os
K = ['leaf_type','leaf_cycle','denotation','species','genus','species:es','height','diameter_crown','diameter','circumference','taxon']
lines = open(sys.argv[1], encoding='utf-8').read().split('\n')
ts = lines[0].split(' ', 1)[1]
pts, rows = [], []
pid = px = py = 0
def tags(s): return {K[int(kv.split('=',1)[0])]: kv.split('=',1)[1] for kv in s.split(';') if kv}
for ln in lines[1:]:
    if not ln: continue
    if ln.startswith('W'):
        parts = ln[1:].split(',')
        nums = list(map(int, parts[1].split(' ')))
        rows.append({'id': int(parts[0]), 'c': [[nums[i]/1e6, nums[i+1]/1e6] for i in range(0, len(nums), 2)], **({'t': tags(parts[2])} if len(parts) > 2 else {})})
        continue
    p = ln.split(',', 3)
    pid += int(p[0], 36); px += int(p[1], 36); py += int(p[2], 36)
    rec = [pid, px/1e6, py/1e6]
    if len(p) > 3: rec.append(tags(p[3]))
    pts.append(rec)
lons = [p[1] for p in pts]; lats = [p[2] for p in pts]
assert -3.75 < min(lons) and max(lons) < -3.5 and 37.1 < min(lats) and max(lats) < 37.25, (min(lons), max(lons), min(lats), max(lats))
withH = sum(1 for p in pts if len(p) > 3 and ('height' in p[3]))
withC = sum(1 for p in pts if len(p) > 3 and ('diameter_crown' in p[3]))
out = {'source': 'OpenStreetMap contributors (ODbL) — natural=tree nodes and natural=tree_row ways inside the Granada municipality (admin_level 8), via Overpass API',
       'osm_timestamp': ts, 'count': len(pts), 'rows': len(rows), 'with_height': withH, 'with_crown': withC,
       'fields': {'pts': '[osm node id, lon, lat, {tags}]', 'rows': '{id: osm way id, c: [[lon,lat]...], t: tags}'},
       'caveat': 'Volunteered mapping: incomplete. A missing tree on the map does not mean no tree on the ground. No open municipal tree inventory was found.',
       'pts': pts, 'rows_geom': rows}
json.dump(out, open(os.path.join(os.path.dirname(__file__), '..', 'data', 'vec', 'trees_osm.json'), 'w'), separators=(',', ':'))
print(len(pts), len(rows), withH, withC, ts)
