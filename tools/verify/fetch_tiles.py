"""Runner-side: fetch the real OpenFreeMap tiles and glyphs the main map needs around Granada at zooms 4, 10 and 14 (OMT
max zoom), printed base64 between markers, so the map can be debugged offline with real basemap data."""
import base64, gzip, json, math, urllib.request
UA = {'User-Agent': 'granada-atlas debugging'}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return r.read()
def emit(name, b):
    s = base64.b64encode(gzip.compress(b)).decode(); print(f'===FILE {name}==='); [print(s[i:i + 8000]) for i in range(0, len(s), 8000)]; print('===END===', flush=True)
tj = json.loads(get('https://tiles.openfreemap.org/planet')); emit('planet.json', json.dumps(tj).encode()); tpl = tj['tiles'][0]; print('TILES', tpl)
def tile(lon, lat, z):
    n = 2 ** z; x = int((lon + 180) / 360 * n); y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n); return x, y
for z, (lon, lat), r in [(4, (-3.0, 37.3), 2), (10, (-3.6, 37.18), 2), (14, (-3.5986, 37.1773), 2)]:
    cx, cy = tile(lon, lat, z)
    for x in range(cx - r, cx + r + 1):
        for y in range(cy - r, cy + r + 1):
            try: emit(f'tile_{z}_{x}_{y}.pbf', get(tpl.replace('{z}', str(z)).replace('{x}', str(x)).replace('{y}', str(y))))
            except Exception as e: print('ERR tile', z, x, y, e)
for font in ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic']:
    for rng in ['0-255', '256-511', '1536-1791', '1280-1535', '8192-8447']:
        try: emit(f'glyph_{font.replace(" ", "_")}_{rng}.pbf', get(f'https://tiles.openfreemap.org/fonts/{urllib.request.quote(font)}/{rng}.pbf'))
        except Exception as e: print('ERR glyph', font, rng, e)
