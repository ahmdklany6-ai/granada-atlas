"""Build data/ex21/metro_l1.json: Metro de Granada line 1 as it runs today (OpenStreetMap route relation 7183554,
"Línea 1 - Metro de Granada (Armilla→Albolote)", ODbL 1.0), for Exercise 2.1 map 03 (growth and the metro):
the track (the relation's ways, as lines) and the 26 stops in order, with the tags the relation carries (duration,
interval). Read from the OSM API (api.openstreetmap.org /api/0.6/relation/7183554/full.json).
Usage: python3 tools/build_ex21_metro.py  [REL_JSON=/saved/full.json to build from a saved copy]"""
import json, os, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REL = 7183554


def main():
    src = os.environ.get('REL_JSON')
    if src: d = json.load(open(src))
    else:
        req = urllib.request.Request(f'https://api.openstreetmap.org/api/0.6/relation/{REL}/full.json', headers={'Accept': 'application/json', 'User-Agent': 'granada-atlas build script'})
        d = json.load(urllib.request.urlopen(req, timeout=120))
    el = d['elements']; nodes = {e['id']: e for e in el if e['type'] == 'node'}; ways = {e['id']: e for e in el if e['type'] == 'way'}
    rel = next(e for e in el if e['type'] == 'relation' and e['id'] == REL)
    lines = [[[round(nodes[n]['lon'], 6), round(nodes[n]['lat'], 6)] for n in ways[m['ref']]['nodes'] if n in nodes] for m in rel['members'] if m['type'] == 'way' and m['role'] == '' and m['ref'] in ways]
    stops = [{'name': nodes[m['ref']]['tags'].get('name'), 'lonlat': [round(nodes[m['ref']]['lon'], 6), round(nodes[m['ref']]['lat'], 6)]} for m in rel['members'] if m['type'] == 'node' and m['role'].startswith('stop') and m['ref'] in nodes]
    tg = rel['tags']
    out = {'name': tg.get('name'), 'ref': tg.get('ref'), 'from': tg.get('from'), 'to': tg.get('to'), 'duration_min': int(tg['duration']) if tg.get('duration', '').isdigit() else None,
           'interval_min': int(tg['interval']) if tg.get('interval', '').isdigit() else None, 'opening_hours': tg.get('opening_hours'), 'lines': lines, 'stops': stops,
           'source': f'OpenStreetMap contributors, relation {REL} (ODbL 1.0); duration and interval as tagged in OSM, not a timetable', 'osm_version': rel.get('version'), 'osm_timestamp': rel.get('timestamp')}
    os.makedirs(os.path.join(ROOT, 'data/ex21'), exist_ok=True); p = os.path.join(ROOT, 'data/ex21/metro_l1.json')
    json.dump(out, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(p, os.path.getsize(p), 'bytes;', len(lines), 'ways;', len(stops), 'stops:', stops[0]['name'], '→', stops[-1]['name'], '·', out['duration_min'], 'min · every', out['interval_min'], 'min')


if __name__ == '__main__':
    main()
