"""Exercise 1.3 — SECOND analysis frame (5.26): the Escúzar estate (CITAI / IFMIF-DONES) and the gap to the metro terminus.
EPSG:25830 x 429000–441000, y 4101000–4111000 (12 × 10 km; it meets the city frame at the Las Gabias terminus).
Same sources, method, classes and colours as the city frame (tools/build_ex13.py): GHS-POP 2020 (density), OSM buildings
figure-ground + GHSL check (morphology), OSM commercial places quartic KDE (centre), Landsat 8/9 summer LST + NDVI (climate),
OSM everyday places + reach (human). The class breaks are read from data/ex13 so both frames share one legend.
Out here the atlas has no local extracts, so OSM buildings / streets / municipalities come from the same runner fetch.
Nothing is estimated: where the area genuinely has little (residents, shops) the numbers say so.
Usage: python3 tools/build_ex13f.py <raw dir from tools/verify/ex13f_fetch.py>  → data/ex13f/*.json + fg.png"""
import json, os, sys, math, re
from collections import Counter
import numpy as np
from pyproj import Transformer
from shapely.geometry import shape, Point, Polygon, LineString, box, mapping
from shapely.ops import unary_union, polygonize
from shapely import contains_xy, STRtree
from PIL import Image, ImageDraw
from scipy.ndimage import maximum_filter
import warnings; warnings.filterwarnings('ignore')
RAW = sys.argv[1]; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, 'data/ex13f'); os.makedirs(OUT, exist_ok=True)
J = lambda n: json.load(open(os.path.join(RAW, n), encoding='utf-8'))
CITY = lambda n: json.load(open(os.path.join(ROOT, 'data/ex13', n), encoding='utf-8'))
F = (429000, 4101000, 441000, 4111000); FB = box(*F); WX, WY = F[2] - F[0], F[3] - F[1]
ll2u = Transformer.from_crs('EPSG:4326', 'EPSG:25830', always_xy=True); u2ll = Transformer.from_crs('EPSG:25830', 'EPSG:4326', always_xy=True)
mw2u = Transformer.from_crs('ESRI:54009', 'EPSG:25830', always_xy=True); u2mw = Transformer.from_crs('EPSG:25830', 'ESRI:54009', always_xy=True)
def dump(name, obj): json.dump(obj, open(os.path.join(OUT, name), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':')); print('wrote', name, os.path.getsize(os.path.join(OUT, name)), 'bytes')
r1 = lambda v: None if v is None or not np.isfinite(v) else round(float(v), 1)
from shapely.ops import transform as T
toU = lambda g: T(lambda x, y, z=None: ll2u.transform(x, y), g)
est = [f for f in json.load(open(os.path.join(ROOT, 'data/vec/escuzar_pole.json')))['features'] if f['properties'].get('k') == 'estate'][0]
ESTATE = toU(shape(est['geometry']))
def osm_geom(e):
    if e['type'] == 'node': return Point(*ll2u.transform(e['lon'], e['lat']))
    if e['type'] == 'way' and e.get('geometry'):
        pts = [ll2u.transform(p['lon'], p['lat']) for p in e['geometry']]
        return Polygon(pts) if len(pts) >= 4 and pts[0] == pts[-1] else LineString(pts)
    if e['type'] == 'relation':
        lines = [LineString([ll2u.transform(p['lon'], p['lat']) for p in m['geometry']]) for m in e.get('members', []) if m.get('geometry') and m.get('role') in ('outer', '')]
        polys = list(polygonize(unary_union(lines))) if lines else []
        return unary_union(polys) if polys else None
    if e.get('center'): return Point(*ll2u.transform(e['center']['lon'], e['center']['lat']))
    return None
def pt_of(e):
    if e['type'] == 'node': return ll2u.transform(e['lon'], e['lat'])
    c = e.get('center'); return ll2u.transform(c['lon'], c['lat']) if c else None
norm = lambda s: re.sub(r'[^a-z0-9áéíóúñü]', '', (s or '').lower())
# municipalities (OSM admin_level 8) inside the frame — for honest per-municipality figures
adm = J('osm_admin.json'); MUNIS = []
for e in adm['elements']:
    g = osm_geom(e)
    if g is not None and not g.is_empty and g.intersects(FB): MUNIS.append({'name': e['tags'].get('name'), 'ine': e['tags'].get('ine:municipio') or e['tags'].get('ref:ine'), 'g': g.buffer(0)})
print('municipalities', [m['name'] for m in MUNIS])

# ---------- 01 DENSITY ----------
pm = J('ghspop2020_meta.json'); P = np.load(os.path.join(RAW, 'ghspop2020.npy')).astype(np.float64); t = pm['transform']; P[P < 0] = np.nan
nr, nc = P.shape; cx = t[2] + np.arange(nc + 1) * t[0]; cy = t[5] + np.arange(nr + 1) * t[4]
GX, GY = np.meshgrid(cx, cy); UX, UY = mw2u.transform(GX, GY)
cellU = lambda r, c: Polygon([(UX[r, c], UY[r, c]), (UX[r, c + 1], UY[r, c + 1]), (UX[r + 1, c + 1], UY[r + 1, c + 1]), (UX[r + 1, c], UY[r + 1, c])])
keep = np.zeros_like(P, dtype=bool)
for r in range(nr):
    for c in range(nc): keep[r, c] = cellU(r, c).intersects(FB)
rows = np.where(keep.any(1))[0]; cols = np.where(keep.any(0))[0]; R0, R1, C0, C1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
Psub = P[R0:R1, C0:C1]; cxu = UX[R0:R1 + 1, C0:C1 + 1]; cyu = UY[R0:R1 + 1, C0:C1 + 1]
centres_x = (cxu[:-1, :-1] + cxu[1:, 1:]) / 2; centres_y = (cyu[:-1, :-1] + cyu[1:, 1:]) / 2
dens = Psub * 100.0; inF = (centres_x >= F[0]) & (centres_x <= F[2]) & (centres_y >= F[1]) & (centres_y <= F[3])
DEN_BR = CITY('density.json')['breaks']
pf = np.where(np.isfinite(Psub), Psub, 0)
pop_frame = float(pf[inF].sum()); inE = contains_xy(ESTATE, centres_x, centres_y)
cls_pop = [float(pf[inF & (dens > lo) & (dens <= hi)].sum()) for lo, hi in zip([0] + DEN_BR, DEN_BR + [1e12])]
by_muni = [{'name': m['name'], 'pop_ghs': round(float(pf[inF & contains_xy(m['g'], centres_x, centres_y)].sum()))} for m in MUNIS]
city_d = CITY('density.json')
density = {'source': city_d['source'] | {'tile': pm['tile']}, 'cell_values': city_d['cell_values'], 'kind': 'modelled',
           'corners': {'x': np.round(cxu, 1).tolist(), 'y': np.round(cyu, 1).tolist()}, 'pop': [[None if not np.isfinite(v) else round(float(v), 2) for v in row] for row in Psub],
           'breaks': DEN_BR, 'unit': 'residents / km²',
           'stats': {'pop_frame': round(pop_frame), 'pop_estate': round(float(pf[inE].sum())), 'cells_frame': int(inF.sum()), 'cells_inhabited': int((inF & (pf > 0)).sum()),
                     'peak': round(float(np.nanmax(dens[inF]))), 'share_by_class': [round(v / max(pop_frame, 1) * 100, 1) for v in cls_pop], 'share_dense': round(sum(cls_pop[3:]) / max(pop_frame, 1) * 100, 1), 'by_municipality': by_muni}}
dump('density.json', density)

# ---------- 02 MORPHOLOGY — OSM buildings rasterised at 4 m + GHSL check ----------
px = 4; W4, H4 = WX // px, WY // px; img = Image.new('1', (W4, H4), 1); dr = ImageDraw.Draw(img); bj = J('osm_buildings.json'); nb = 0; bdate = bj['osm3s']['timestamp_osm_base']
for e in bj['elements']:
    g = osm_geom(e)
    if g is None or g.is_empty or g.geom_type not in ('Polygon', 'MultiPolygon') or not g.intersects(FB): continue
    nb += 1
    for pg in (g.geoms if g.geom_type == 'MultiPolygon' else [g]):
        dr.polygon([((x - F[0]) / px, (F[3] - y) / px) for x, y in pg.exterior.coords], fill=0)
        for ring in pg.interiors: dr.polygon([((x - F[0]) / px, (F[3] - y) / px) for x, y in ring.coords], fill=1)
img.save(os.path.join(OUT, 'fg.png'), optimize=True); bld = np.asarray(img.convert('L')) < 128; print('buildings', nb, 'coverage', bld.mean())
k = 100 // px; osm100 = bld.reshape(H4 // k, k, W4 // k, k).mean(axis=(1, 3))
gm = J('ghsl_meta.json'); G = np.load(os.path.join(RAW, 'ghsl_built_s.npz'))['e2020'].astype(float); gt = gm['2020']['transform']
xs = F[0] + 50 + 100 * np.arange(osm100.shape[1]); ys = F[3] - 50 - 100 * np.arange(osm100.shape[0]); XX, YY = np.meshgrid(xs, ys); MX, MY = u2mw.transform(XX, YY)
ghs100 = G[((MY - gt[5]) / gt[4]).astype(int), ((MX - gt[2]) / gt[0]).astype(int)] / 10000.0
gaps = np.argwhere((ghs100 >= 0.25) & (osm100 < 0.05)); inE100 = contains_xy(ESTATE, XX, YY)
city_m = CITY('morphology.json')
morph = {'source': {'name': 'OpenStreetMap buildings (Overpass, %s), rasterised at 4 m (EPSG:25830)' % bdate[:10], 'license': 'ODbL 1.0', 'file': 'data/ex13f/fg.png', 'px_m': px, 'ox': F[0], 'oy': F[3], 'buildings': nb},
         'check': city_m['check'], 'gaps': gaps.tolist(), 'grid': {'x0': F[0], 'y1': F[3], 'cell': 100},
         'stats': {'coverage_frame_pct': round(float(bld.mean()) * 100, 1), 'coverage_estate_pct': round(float(osm100[inE100].mean() * 100), 1), 'gap_cells': int(len(gaps)), 'gap_area_km2': round(len(gaps) * 0.01, 2),
                   'ghsl_built_cells': int((ghs100 >= 0.25).sum()), 'agree_pct': round(float(((ghs100 >= 0.25) & (osm100 >= 0.05)).sum() / max(1, (ghs100 >= 0.25).sum()) * 100), 1)}}
dump('morphology.json', morph)

# ---------- 03 CENTRE — OSM commercial places, quartic KDE (same kernel and breaks as the city) ----------
oc = J('osm_commercial.json'); osm_date = oc['osm3s']['timestamp_osm_base']
FOOD = {'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream'}; SERV = {'bank', 'bureau_de_change', 'pharmacy', 'post_office'}; BAD_SHOP = {'vacant', 'no', 'disused', 'closed', 'yes;vacant'}
recs = []
for e in oc['elements']:
    tg = e.get('tags', {})
    if tg.get('shop') in BAD_SHOP: continue
    a = tg.get('amenity'); cat = 'market' if a == 'marketplace' else 'food' if a in FOOD else 'service' if a in SERV else 'retail' if tg.get('shop') else None
    p = pt_of(e) if cat else None
    if p: recs.append({'x': p[0], 'y': p[1], 'cat': cat, 'name': tg.get('name', ''), 'id': e['type'][0] + str(e['id']), 'kind': tg.get('shop') or a})
dup = set(); tree = STRtree([Point(r['x'], r['y']) for r in recs]) if recs else None
for i, r in enumerate(recs):
    if i in dup: continue
    for j in tree.query(Point(r['x'], r['y']).buffer(30)):
        if j <= i or j in dup: continue
        q = recs[j]; d = math.hypot(q['x'] - r['x'], q['y'] - r['y'])
        if q['cat'] == r['cat'] and ((r['name'] and norm(r['name']) == norm(q['name'])) or (not r['name'] and not q['name'] and q['kind'] == r['kind'] and d <= 2)): dup.add(j)
pts = [r for i, r in enumerate(recs) if i not in dup]
city_c = CITY('centre.json'); R = city_c['kernel']['radius_m']; cell = city_c['kernel']['cell_m']; nx, ny = WX // cell, WY // cell
gx = F[0] + cell / 2 + cell * np.arange(nx); gy = F[3] - cell / 2 - cell * np.arange(ny); GXc, GYc = np.meshgrid(gx, gy)
Zc = np.zeros((ny, nx))
for r in pts:
    x, y = r['x'], r['y']
    if x < F[0] - R or x > F[2] + R or y < F[1] - R or y > F[3] + R: continue
    ci = int((x - F[0]) / cell); cj = int((F[3] - y) / cell); rc = int(R / cell) + 1
    i0, i1, j0, j1 = max(0, ci - rc), min(nx, ci + rc + 1), max(0, cj - rc), min(ny, cj + rc + 1)
    if i0 >= i1 or j0 >= j1: continue
    d2 = ((GXc[j0:j1, i0:i1] - x) ** 2 + (GYc[j0:j1, i0:i1] - y) ** 2) / R ** 2
    Zc[j0:j1, i0:i1] += np.where(d2 < 1, 3 / (math.pi * R ** 2) * (1 - d2) ** 2, 0) * 1e6
peaks = []
if Zc.max() > 0:
    mx = maximum_filter(Zc, size=11); cand = sorted(np.argwhere((Zc == mx) & (Zc >= 0.2 * Zc.max())).tolist(), key=lambda ij: -Zc[ij[0], ij[1]])
    for j, i in cand:
        x, y = gx[i], gy[j]
        if all(math.hypot(x - p['x'], y - p['y']) >= 700 for p in peaks): peaks.append({'x': round(float(x)), 'y': round(float(y)), 'v': round(float(Zc[j, i])), 'n300': sum(1 for r in pts if math.hypot(r['x'] - x, r['y'] - y) <= 300)})
for k_, p in enumerate(peaks): p['rank'] = k_ + 1; p['rel'] = round(p['v'] / peaks[0]['v'] * 100)
inFp = [r for r in pts if F[0] <= r['x'] <= F[2] and F[1] <= r['y'] <= F[3]]
centre = {'source': city_c['source'] | {'date': osm_date}, 'categories': city_c['categories'], 'kernel': city_c['kernel'],
          'grid': {'x0': F[0], 'y1': F[3], 'cell': cell, 'nx': int(nx), 'ny': int(ny)}, 'z': np.round(Zc).astype(int).tolist(), 'breaks': city_c['breaks'], 'peaks': peaks[:6],
          'hist': None, 'whc': [], 'points': [[round(r['x']), round(r['y']), r['cat'], r['name'], r['id']] for r in inFp],
          'stats': {'raw': len(recs), 'duplicates': len(dup), 'kept': len(pts), 'in_frame': len(inFp), 'in_estate': sum(1 for r in inFp if ESTATE.contains(Point(r['x'], r['y']))), 'by_cat': Counter(r['cat'] for r in inFp)}}
dump('centre.json', centre); print('centre', centre['stats'], peaks[:3])

# ---------- 04 CLIMATE — Landsat summer LST median, 90 m blocks ----------
z = np.load(os.path.join(RAW, 'landsat_summer_stack.npz')); st = z['st'].astype(np.float32); nd = z['ndvi'].astype(np.float32); sc = J('landsat_scenes.json')
used = [s for s in sc['scenes'] if s.get('used')]
med = np.nanmedian(st, 0); cnt = np.isfinite(st).sum(0); ndm = np.nanmedian(nd, 0)
b = 3; mh, mw = (med.shape[0] // b) * b, (med.shape[1] // b) * b
blk = lambda a: np.nanmean(a[:mh, :mw].reshape(mh // b, b, mw // b, b), axis=(1, 3))
lst90 = blk(np.where(cnt >= 3, med, np.nan)); nd90 = blk(ndm)
cs = 90.0; X90 = F[0] + cs / 2 + cs * np.arange(lst90.shape[1]); Y90 = F[3] - cs / 2 - cs * np.arange(lst90.shape[0]); XX9, YY9 = np.meshgrid(X90, Y90)
MX9, MY9 = u2mw.transform(XX9, YY9); g9 = G[((MY9 - gt[5]) / gt[4]).astype(int), ((MX9 - gt[2]) / gt[0]).astype(int)] / 10000.0
dense = (g9 >= 0.5) & np.isfinite(lst90); veg = (nd90 >= 0.4) & np.isfinite(lst90); bare = (g9 < 0.05) & (nd90 < 0.2) & np.isfinite(lst90); inE9 = contains_xy(ESTATE, XX9, YY9) & np.isfinite(lst90)
med_or_none = lambda m: r1(np.nanmedian(lst90[m])) if m.any() else None
city_k = CITY('climate.json'); paths = sorted({s['id'].split('_')[2] for s in used})
climate = {'source': city_k['source'], 'what': city_k['what'],
           'period': 'June–August 2024, 2025 and 2026 — median of %d clear-sky scenes (path/row %s)' % (len(used), ', '.join(p[:3] + '/' + p[3:] for p in paths)), 'scenes': [[s['date'][:10], s['platform'], s['clear_frac_frame']] for s in used],
           'resolution': city_k['resolution'], 'cloud': city_k['cloud'],
           'grid': {'x0': F[0], 'y1': F[3], 'cell': cs, 'nx': int(lst90.shape[1]), 'ny': int(lst90.shape[0])}, 'lst': [[None if not np.isfinite(v) else round(float(v), 1) for v in row] for row in lst90],
           'ndvi': [[None if not np.isfinite(v) else round(float(v), 2) for v in row] for row in nd90], 'breaks': city_k['breaks'], 'unit': '°C',
           'stats': {'scenes': len(used), 'first': used[0]['date'][:10], 'last': used[-1]['date'][:10], 'min_obs': int(cnt.min()), 'median_obs': int(np.median(cnt)), 'median_frame': r1(np.nanmedian(lst90)),
                     'p5': r1(np.nanpercentile(lst90, 5)), 'p95': r1(np.nanpercentile(lst90, 95)), 'dense_built': med_or_none(dense), 'dense_built_cells': int(dense.sum()), 'vegetated': med_or_none(veg),
                     'bare': med_or_none(bare), 'bare_cells': int(bare.sum()), 'estate': med_or_none(inE9), 'missing_cells': int(np.isnan(lst90).sum())}}
dump('climate.json', climate); print('climate', climate['stats'])

# ---------- 05 HUMAN — everyday places and reach (same rules as the city) ----------
ev = J('osm_everyday.json')
areas = {'square': [], 'park': []}; pois = {'market': [], 'cafe': [], 'playground': [], 'civic': []}
for e in ev['elements']:
    tg = e.get('tags', {}); g = osm_geom(e)
    if g is None or g.is_empty or not g.intersects(FB.buffer(400)): continue
    a = tg.get('amenity'); le = tg.get('leisure'); c_ = lambda: g.centroid if g.geom_type != 'Point' else g
    if tg.get('place') == 'square' or (tg.get('highway') == 'pedestrian' and (tg.get('area') == 'yes' or e['type'] == 'relation')):
        if g.geom_type in ('Polygon', 'MultiPolygon') and g.area >= 300: areas['square'].append((g, tg.get('name', '')))
        elif g.geom_type == 'Point': pois.setdefault('square_pt', []).append((g, tg.get('name', '')))
    elif le == 'park' or (le == 'garden' and tg.get('name') and tg.get('access') not in ('private', 'no')):
        if g.geom_type in ('Polygon', 'MultiPolygon') and g.area >= 1000: areas['park'].append((g, tg.get('name', '')))
    elif le == 'playground': pois['playground'].append((c_(), tg.get('name', '')))
    elif a == 'marketplace': pois['market'].append((c_(), tg.get('name', '')))
    elif a == 'cafe': pois['cafe'].append((c_(), tg.get('name', '')))
    elif a in ('library', 'community_centre', 'social_centre'): pois['civic'].append((c_(), tg.get('name', '')))
tg_ = [g for g, _ in areas['square'] + areas['park']] + [g for g, _ in pois['market']] + [g for g, _ in pois.get('square_pt', [])]
targets = unary_union(tg_).buffer(300) if tg_ else Polygon()
inR = contains_xy(targets, centres_x, centres_y) if tg_ else np.zeros_like(inF)
reach = float(pf[inF & inR].sum() / max(pf[inF].sum(), 1e-9))
far = np.argwhere(inF & ~inR & (pf * 100 >= 2000))
clip = lambda g: g.intersection(FB.buffer(50))
coords = lambda g: [[[round(x), round(y)] for x, y in r.coords] for r in ([g.exterior] + list(g.interiors))] if g.geom_type == 'Polygon' else [c for gg in g.geoms for c in coords(gg)] if g.geom_type == 'MultiPolygon' else []
city_h = CITY('human.json')
human = {'source': city_h['source'] | {'date': ev['osm3s']['timestamp_osm_base']}, 'question': 'reach',
         'areas': {k_: [{'n': nm, 'p': coords(clip(g))} for g, nm in v if not clip(g).is_empty and clip(g).geom_type in ('Polygon', 'MultiPolygon')] for k_, v in areas.items()},
         'points': {k_: [[round(g.x), round(g.y), nm] for g, nm in v if F[0] <= g.x <= F[2] and F[1] <= g.y <= F[3]] for k_, v in pois.items()},
         'far': [[int(r), int(c)] for r, c in far], 'far_ref': city_h['far_ref'],
         'stats': {'squares': sum(1 for g, _ in areas['square'] + pois.get('square_pt', []) if g.intersects(FB)), 'parks': sum(1 for g, _ in areas['park'] if g.intersects(FB)),
                   'markets': sum(1 for g, _ in pois['market'] if FB.contains(g)), 'cafes': sum(1 for g, _ in pois['cafe'] if FB.contains(g)), 'playgrounds': sum(1 for g, _ in pois['playground'] if FB.contains(g)),
                   'civic': sum(1 for g, _ in pois['civic'] if FB.contains(g)), 'reach_pct': round(reach * 100, 1), 'radius_m': 300, 'far_cells': int(len(far))}}
dump('human.json', human); print('human', human['stats'])

# ---------- frame ----------
frame = {'id': 'factory', 'epsg': 25830, 'x0': F[0], 'y0': F[1], 'x1': F[2], 'y1': F[3], 'km': [12, 10], 'north': 'grid north (EPSG:25830, UTM 30N); true north differs by < 1° here',
         'why': 'second frame around the Escúzar estate (CITAI / IFMIF-DONES) and the 10.7 km gap to the metro terminus at Las Gabias; it meets the city frame at the terminus',
         'municipalities': [m['name'] for m in MUNIS], 'osm_date': osm_date, 'buildings_date': bdate,
         'audit': [['density', 'GHS-POP R2023A 2020 (JRC)', '2020', 'residents per 100 m cell', '100 m', 'whole frame', 'modelled', 'CC BY 4.0'],
                   ['morphology', 'OpenStreetMap buildings', bdate[:10], 'footprint (binary)', '4 m raster', 'whole frame', 'volunteered mapping; gaps flagged against GHSL 2020', 'ODbL 1.0'],
                   ['morphology-check', 'GHS-BUILT-S R2023A 2020 (JRC)', '2020', 'm² built per cell', '100 m', 'whole frame', 'gap check only', 'CC BY 4.0'],
                   ['centre', 'OpenStreetMap shops, food and drink, services, markets', osm_date[:10], 'places → quartic KDE', '50 m grid', 'whole frame + 600 m', 'mapping completeness varies', 'ODbL 1.0'],
                   ['climate', 'Landsat 8/9 C2 L2 ST_B10 (USGS)', '%s – %s (JJA)' % (used[0]['date'][:10], used[-1]['date'][:10]), '°C (land surface)', '100 m native, shown 90 m', 'whole frame', 'clear-sky summer median', 'public domain'],
                   ['human', 'OpenStreetMap squares, parks, markets, cafés, playgrounds, civic', ev['osm3s']['timestamp_osm_base'][:10], 'features; residents within 300 m', 'vector; 100 m', 'whole frame', 'opportunities, not observed presence', 'ODbL 1.0']]}
dump('frame.json', frame)
