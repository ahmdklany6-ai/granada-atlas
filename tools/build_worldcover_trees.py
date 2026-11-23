"""Build 5.50 — a static tree-cover layer for the canopy card when the live Copernicus service does not answer.
The "Trees and canopy" card read Copernicus HRL Tree Cover Density 2018 live from image.discomap.eea.europa.eu; on
23 Nov 2026 that host did not answer (from the visitor's browser — the owner's "Base" export says "Failed to fetch" — nor
from the GitHub runner), so the canopy was missing. ESA WorldCover 2021 v200 (10 m, CC BY 4.0, read on the runner from
the public S3 bucket, tile N36W006) classifies every 10 m cell; class 10 = "Tree cover". It is a class map, not a density:
the card states which source it shows. Output: data/canopy/worldcover_trees_2021.png in EPSG:25830, 10 m, over the atlas
region: grey value 255 = tree cover, 60 = other land cover, 0 = no data (5.51: 60 instead of 1, so that a browser that
shifts grey levels slightly when it decodes the image can never turn "other" into "no data"). Usage: python3 tools/build_worldcover_trees.py raw_dir"""
import json, os, sys
import numpy as np
from PIL import Image
from pyproj import Transformer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RAW = sys.argv[1]
a = np.load(os.path.join(RAW, 'worldcover_2021.npz'))['cls']; m = json.load(open(os.path.join(RAW, 'worldcover_2021_meta.json'))); t = m['transform']
f = Transformer.from_crs('EPSG:4326', 'EPSG:25830', always_xy=True); b = Transformer.from_crs('EPSG:25830', 'EPSG:4326', always_xy=True)
W, S, E, N = -3.75, 37.06, -3.46, 37.27
xs, ys = zip(*[f.transform(x, y) for x, y in ((W, S), (E, S), (E, N), (W, N))])
x0, y0, x1, y1 = int(max(min(xs[0], xs[3]), 0) // 10 * 10 + 10), int(max(ys[0], ys[1]) // 10 * 10 + 10), int(min(xs[1], xs[2]) // 10 * 10), int(min(ys[2], ys[3]) // 10 * 10)
nx, ny = (x1 - x0) // 10, (y1 - y0) // 10
X, Y = np.meshgrid(x0 + 5 + 10 * np.arange(nx), y1 - 5 - 10 * np.arange(ny)); LON, LAT = b.transform(X, Y)
c = ((LON - t[2]) / t[0]).astype(int); r = ((LAT - t[5]) / t[4]).astype(int)
ok = (r >= 0) & (r < a.shape[0]) & (c >= 0) & (c < a.shape[1]); v = np.zeros((ny, nx), np.uint8)
cls = a[np.clip(r, 0, a.shape[0] - 1), np.clip(c, 0, a.shape[1] - 1)]
v[ok & (cls == 10)] = 255; v[ok & (cls != 10) & (cls != 0)] = 60
Image.fromarray(v, 'L').save(os.path.join(ROOT, 'data/canopy/worldcover_trees_2021.png'), optimize=True)
meta = {'file': 'canopy/worldcover_trees_2021.png', 'epsg': 25830, 'px': 10, 'ox': x0, 'oy': y1, 'width': nx, 'height': ny,
        'values': {'255': 'tree cover (WorldCover class 10)', '60': 'other land cover', '0': 'no data'}, 'read_as': 'grey > 128 = tree cover; 30–128 = other; < 30 or transparent = no data',
        'cells': {'tree': int((v == 255).sum()), 'other': int((v == 60).sum()), 'no_data': int((v == 0).sum())},
        'source': 'ESA WorldCover 2021 v200, 10 m — © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
        'license': 'CC BY 4.0', 'tool': 'tools/build_worldcover_trees.py', 'tree_share_region': round(float((v == 255).sum() / max(1, (v > 0).sum())), 4)}
M = json.load(open(os.path.join(ROOT, 'data/manifest.json'))); M.setdefault('canopy', {})['worldcover'] = meta
open(os.path.join(ROOT, 'data/manifest.json'), 'w').write(json.dumps(M, ensure_ascii=False, separators=(',', ':')))
print(meta, os.path.getsize(os.path.join(ROOT, 'data/canopy/worldcover_trees_2021.png')), 'bytes')
