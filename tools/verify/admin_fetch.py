"""5.26: municipal boundaries (OSM admin_level 8) with full geometry for the factory analysis frame → out/ex13f/osm_admin.json"""
import os, urllib.request, urllib.parse
q = '[out:json][timeout:300];relation["boundary"="administrative"]["admin_level"="8"](37.04,-3.79,37.15,-3.65);out geom;'
os.makedirs('out/ex13f', exist_ok=True)
import time
done = False
for k in range(6):
  for ep in ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']:
    if done: break
    try:
        d = urllib.request.urlopen(urllib.request.Request(ep, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'GranadaAtlas/1.0'}), timeout=300).read()
        if d[:1] == b'{': open('out/ex13f/osm_admin.json', 'wb').write(d); print('wrote', len(d)); done = True
    except Exception as e: print(ep, e)
  if done: break
  time.sleep(30 * (k + 1))
