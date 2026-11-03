"""Independent cross-checks of representative Exercise 1.3 values (build 5.16), computed by different methods from the ones in
tools/build_ex13.py. Writes data/ex13/checks.json. Usage: python3 tools/check_ex13.py <raw dir>"""
import json, os, sys, math, warnings
import numpy as np
from pyproj import Transformer
from shapely.geometry import shape, Polygon, Point, box
from shapely.ops import transform as T
from shapely import STRtree
warnings.filterwarnings('ignore')
RAW = sys.argv[1]; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); X = os.path.join(ROOT, 'data/ex13')
L = lambda n: json.load(open(os.path.join(X, n + '.json'), encoding='utf-8'))
fr, den, mor, cen, cli, hum = [L(n) for n in ['frame', 'density', 'morphology', 'centre', 'climate', 'human']]
F = (fr['x0'], fr['y0'], fr['x1'], fr['y1']); FB = box(*F)
ll2u = Transformer.from_crs('EPSG:4326', 'EPSG:25830', always_xy=True)
adm = json.load(open(os.path.join(ROOT, 'data/vec/admin.json')))
muni = T(lambda x, y, z=None: ll2u.transform(x, y), shape([f for f in adm['features'] if f['properties']['kind'] == 'municipio'][0]['geometry']))
out = {}
# 1. density: residents in the municipality by AREA-WEIGHTED intersection of the cell polygons (build used cell centres)
cx, cy = np.array(den['corners']['x']), np.array(den['corners']['y']); pop = den['pop']; tot = 0.0; peak = 0
for r, row in enumerate(pop):
    for q, p in enumerate(row):
        if not p: continue
        cell = Polygon([(cx[r, q], cy[r, q]), (cx[r, q + 1], cy[r, q + 1]), (cx[r + 1, q + 1], cy[r + 1, q + 1]), (cx[r + 1, q], cy[r + 1, q])])
        a = cell.area; inter = cell.intersection(muni).area if cell.intersects(muni) else 0; tot += p * inter / a; peak = max(peak, p / (a / 1e6))
out['density'] = {'muni_area_weighted': round(tot), 'muni_centres_build': den['stats']['pop_muni_ghs'], 'diff_pct': round((tot / den['stats']['pop_muni_ghs'] - 1) * 100, 2),
                  'peak_from_projected_area': round(peak), 'peak_build': den['stats']['peak'], 'note': 'peak recomputed with each cell’s area in EPSG:25830 (≈ 0.01 km² ± projection distortion)'}
# 2. morphology: building coverage of the frame from the VECTOR footprints (build used the 4 m raster)
bl = json.load(open(os.path.join(ROOT, 'data/vec/buildings_lite.json')))
area = 0.0; n = 0
for f in bl['features']:
    g = f['geometry']; rings = g['coordinates'] if g['type'] == 'Polygon' else [pp[0] for pp in g['coordinates']] if g['type'] == 'MultiPolygon' else []
    if g['type'] == 'MultiPolygon':
        polys = [Polygon([ll2u.transform(*p) for p in pl[0]], [[ll2u.transform(*p) for p in h] for h in pl[1:]]) for pl in g['coordinates']]
    elif g['type'] == 'Polygon': polys = [Polygon([ll2u.transform(*p) for p in g['coordinates'][0]], [[ll2u.transform(*p) for p in h] for h in g['coordinates'][1:]])]
    else: continue
    for pg in polys:
        if not pg.is_valid: pg = pg.buffer(0)
        if pg.intersects(FB): area += pg.intersection(FB).area; n += 1
out['morphology'] = {'coverage_vector_pct': round(area / 1e8 * 100, 2), 'coverage_raster_build_pct': mor['stats']['coverage_frame_pct'], 'buildings_in_frame': n}
# 3. centre: kernel value at C1 summed directly over every place (no grid), and the count within 300 m
pts = [(p[0], p[1]) for p in cen['points']]; R = cen['kernel']['radius_m']
oc = json.load(open(os.path.join(RAW, 'osm_commercial.json')))  # include the 600 m margin like the build
c1 = cen['peaks'][0]; ks = 0.0; n300 = 0
for x, y in pts:
    d2 = ((x - c1['x']) ** 2 + (y - c1['y']) ** 2) / R ** 2
    if d2 < 1: ks += 3 / (math.pi * R ** 2) * (1 - d2) ** 2 * 1e6; n300 += 1
out['centre'] = {'c1_kernel_direct': round(ks), 'c1_kernel_build': c1['v'], 'c1_count_300m_direct': n300, 'c1_count_build': c1['n300'], 'note': 'direct sum over places inside the frame (C1 is > 3 km from the frame edge, so the margin cannot change it)'}
# 4. climate: the summer median at Plaza Nueva from the raw scene stack (build: median → 3 × 3 block mean)
z = np.load(os.path.join(RAW, 'landsat_summer_stack.npz')); st = z['st'].astype(np.float32)
px, py = ll2u.transform(-3.5972, 37.1770)  # Plaza Nueva
i = int((px - F[0]) / 30); j = int((F[3] - py) / 30); bi, bj = i // 3, j // 3
raw_block = st[:, bj * 3:bj * 3 + 3, bi * 3:bi * 3 + 3]
out['climate'] = {'plaza_nueva_block_build': cli['lst'][bj][bi], 'plaza_nueva_median_of_block_obs': round(float(np.nanmedian(raw_block)), 1), 'plaza_nueva_mean_of_pixel_medians': round(float(np.nanmean(np.nanmedian(raw_block, 0))), 1),
                  'scenes': int(st.shape[0]), 'frame_median_of_scene_medians': round(float(np.median([np.nanmedian(s) for s in st])), 1), 'frame_median_build': cli['stats']['median_frame']}
# 5. human: reach recomputed with nearest-distance queries (build used a 300 m buffer union)
tg = []
for k in ('square', 'park'):
    for a in hum['areas'].get(k, []):
        for ring in a['p'][:1]:
            if len(ring) >= 4: tg.append(Polygon(ring).buffer(0))
tg += [Point(p[0], p[1]) for p in hum['points'].get('market', []) + hum['points'].get('square_pt', [])]
tree = STRtree(tg); inF = 0.0; near = 0.0
for r, row in enumerate(pop):
    for q, p in enumerate(row):
        if not p: continue
        x = (cx[r, q] + cx[r + 1, q + 1]) / 2; y = (cy[r, q] + cy[r + 1, q + 1]) / 2
        if not (F[0] <= x <= F[2] and F[1] <= y <= F[3]): continue
        inF += p; c = Point(x, y); k = tree.nearest(c)
        if tg[k].distance(c) <= 300: near += p
out['human'] = {'reach_nearest_pct': round(near / inF * 100, 2), 'reach_build_pct': hum['stats']['reach_pct'], 'note': 'targets clipped to the frame + 50 m in the data file, so cells near the edge may differ slightly'}
json.dump(out, open(os.path.join(X, 'checks.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(json.dumps(out, ensure_ascii=False, indent=1))
