"""5.26 item 13 — the metro line 1 southern extension as OpenStreetMap maps it today: every way tagged as light rail under
construction (or opened) south-west of Armilla, with geometry and tags, plus the current state of the ways the atlas used
(1021753426, 1537504102, 1537508821). Written to out/osm_track.json (job artifact)."""
import json, os, urllib.request, urllib.parse, datetime
UA = {'User-Agent': 'GranadaAtlas-research/1.0 (student project)'}
q = """[out:json][timeout:120];
(way["railway"="construction"]["construction"~"light_rail|tram"](37.110,-3.700,37.160,-3.620);
 way["railway"="construction"]["construction:railway"~"light_rail|tram"](37.110,-3.700,37.160,-3.620);
 way["railway"~"light_rail|tram"](37.110,-3.700,37.150,-3.6275);
 way(id:1021753426,1537504102,1537508821,1021753427,1021753428);
 node["railway"~"stop|station|halt|tram_stop"](37.110,-3.700,37.150,-3.6275);
 node["public_transport"](37.110,-3.700,37.150,-3.6275)["light_rail"="yes"];);
out geom tags meta;"""
out = None
for ep in ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']:
    try:
        r = urllib.request.urlopen(urllib.request.Request(ep, data=urllib.parse.urlencode({'data': q}).encode(), headers=UA), timeout=180).read(); out = json.loads(r); break
    except Exception as e: print('overpass', ep, e)
hist = {}
for wid in (1537504102, 1537508821):
    try: hist[wid] = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://api.openstreetmap.org/api/0.6/way/{wid}/history.json', headers=UA), timeout=60).read())['elements'][-1]
    except Exception as e: hist[wid] = {'error': str(e)}
os.makedirs('out', exist_ok=True); json.dump({'checked': datetime.datetime.utcnow().isoformat() + 'Z', 'overpass': out, 'history_last_version': hist}, open('out/osm_track.json', 'w'))
print('base', out and out.get('osm3s', {}).get('timestamp_osm_base'))
for e in (out or {}).get('elements', []): print(e['type'], e['id'], 'v' + str(e.get('version')), e.get('timestamp'), json.dumps(e.get('tags', {}), ensure_ascii=False)[:200], len(e.get('geometry', []) or []), 'pts')
for k, v in hist.items(): print('history', k, json.dumps({x: v.get(x) for x in ('version', 'visible', 'timestamp', 'tags', 'error')}, ensure_ascii=False)[:300])
