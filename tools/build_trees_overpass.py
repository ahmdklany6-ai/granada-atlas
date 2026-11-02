"""Build data/vec/trees_osm.json from an Overpass JSON export (natural=tree nodes + natural=tree_row ways in the Granada
municipality, `out tags geom qt`). Keeps only the tags that describe the tree (species, form, dimensions, provenance).
Searches done on 2 Nov 2026 found NO open municipal tree inventory: the Ayuntamiento's CKAN portal (opendata.granada.org,
6 datasets: air quality, districts, waste, tourism licences, mobility, SDG indicators), datos.gob.es and the Junta de
Andalucía portal list none for Granada — OpenStreetMap is the only open source of mapped tree positions.
Usage: python3 tools/build_trees_overpass.py export.json"""
import json, sys, os
KEEP = ['species', 'genus', 'species:es', 'taxon', 'species:wikidata', 'leaf_type', 'leaf_cycle', 'denotation', 'height', 'diameter_crown',
        'diameter', 'circumference', 'start_date', 'source', 'source:date', 'name']
j = json.load(open(sys.argv[1], encoding='utf8'))
ts = j['osm3s']['timestamp_osm_base']
pts, rows = [], []
for e in j['elements']:
    t = {k: v for k, v in (e.get('tags') or {}).items() if k in KEEP}
    if e['type'] == 'node':
        rec = [e['id'], round(e['lon'], 6), round(e['lat'], 6)]
        if t: rec.append(t)
        pts.append(rec)
    elif e['type'] == 'way' and e.get('geometry'):
        rows.append({'id': e['id'], 'c': [[round(g['lon'], 6), round(g['lat'], 6)] for g in e['geometry']], **({'t': t} if t else {})})
lons = [p[1] for p in pts]; lats = [p[2] for p in pts]
assert -3.75 < min(lons) and max(lons) < -3.5 and 37.1 < min(lats) and max(lats) < 37.25, (min(lons), max(lons), min(lats), max(lats))
cnt = lambda k: sum(1 for p in pts if len(p) > 3 and k in p[3])
sp = sum(1 for p in pts if len(p) > 3 and any(k in p[3] for k in ('species', 'genus', 'species:es', 'taxon')))
out = {'source': 'OpenStreetMap contributors (ODbL) — natural=tree nodes and natural=tree_row ways inside the Granada municipality (admin_level 8), via Overpass API',
       'osm_timestamp': ts, 'count': len(pts), 'rows': len(rows), 'with_height': cnt('height'), 'with_crown': cnt('diameter_crown'),
       'with_trunk': cnt('circumference') + cnt('diameter'), 'with_species': sp, 'with_leaf_type': cnt('leaf_type'),
       'fields': {'pts': '[osm node id, lon, lat, {tags}]', 'rows': '{id: osm way id, c: [[lon,lat]...], t: tags}'},
       'searched': 'No open municipal tree inventory found (opendata.granada.org CKAN, datos.gob.es, Junta de Andalucía open data; searched 2026-11-02).',
       'caveat': 'Volunteered mapping: incomplete. A missing tree on the map does not mean no tree on the ground. No open municipal tree inventory was found.',
       'pts': pts, 'rows_geom': rows}
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'vec', 'trees_osm.json'), 'w'), separators=(',', ':'))
print({k: v for k, v in out.items() if k not in ('pts', 'rows_geom')})
