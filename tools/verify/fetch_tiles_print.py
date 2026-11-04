"""Runner-side (5.19): the real OpenFreeMap tiles and glyphs a PRINT around Granada needs — zooms 12–14 over ~12 × 10 km
(1:50,000 prints render at z ≈ 12.2, 1:10,000 at z ≈ 14.5 → z14 tiles) — printed base64 between ===FILE=== markers so a
print export can be rendered offline with the real basemap and real label fonts (this environment cannot reach
OpenFreeMap; the runner's software WebGL cannot render a full print in time)."""
import base64, gzip, json, math, urllib.request
UA = {'User-Agent': 'granada-atlas print verification'}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return r.read()
def emit(name, b):
    s = base64.b64encode(gzip.compress(b)).decode(); print(f'===FILE {name}==='); [print(s[i:i + 8000]) for i in range(0, len(s), 8000)]; print('===END===', flush=True)
tj = json.loads(get('https://tiles.openfreemap.org/planet')); emit('planet.json', json.dumps(tj).encode()); tpl = tj['tiles'][0]; print('TILES', tpl)
def tile(lon, lat, z):
    n = 2 ** z; return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
n = 0
for z in (12, 13, 14):
    x0, y0 = tile(-3.70, 37.24, z); x1, y1 = tile(-3.50, 37.11, z)
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            try: emit(f'tile_{z}_{x}_{y}.pbf', get(tpl.replace('{z}', str(z)).replace('{x}', str(x)).replace('{y}', str(y)))); n += 1
            except Exception as e: print('ERR tile', z, x, y, e)
for font in ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic']:
    for rng in ['0-255', '256-511', '1536-1791', '1280-1535', '8192-8447', '65024-65279', '64256-64511']:
        try: emit(f'glyph_{font.replace(" ", "_")}_{rng}.pbf', get(f'https://tiles.openfreemap.org/fonts/{urllib.request.quote(font)}/{rng}.pbf'))
        except Exception as e: print('ERR glyph', font, rng, e)
print('TILES FETCHED', n)
