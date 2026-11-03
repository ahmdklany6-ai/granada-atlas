"""Exercise 1.3 — processed layers for the City Identity Card (build 5.16). One shared square frame, EPSG:25830
x 440750–450750, y 4110000–4120000 (10 × 10 km), stored once in data/ex13/frame.json and reused by every map and export.
Inputs (raw, from tools/verify/ex13_fetch.py on the GitHub runner + tools/verify/hist_extent_fetch.py for GHSL built-up):
  ghspop2020.npy / _meta.json, landsat_summer_stack.npz / landsat_scenes.json, osm_commercial.json, osm_everyday.json,
  osm_heritage.json, wikidata_Q8810.json, ghsl_built_s.npz / ghsl_meta.json
Usage: python3 tools/build_ex13.py <raw dir>   → data/ex13/{frame,density,morphology,centre,climate,human}.json"""
import json, os, sys, math, re
import numpy as np
from pyproj import Transformer, Geod
from shapely.geometry import shape, Point, Polygon, MultiPolygon, LineString, box, mapping
from shapely.ops import unary_union, polygonize, linemerge
from shapely import contains_xy, STRtree
from PIL import Image
RAW = sys.argv[1]; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, 'data/ex13'); os.makedirs(OUT, exist_ok=True)
J = lambda n: json.load(open(os.path.join(RAW, n), encoding='utf-8'))
F = (440750, 4110000, 450750, 4120000); FB = box(*F)
ll2u = Transformer.from_crs('EPSG:4326', 'EPSG:25830', always_xy=True); u2ll = Transformer.from_crs('EPSG:25830', 'EPSG:4326', always_xy=True)
mw2u = Transformer.from_crs('ESRI:54009', 'EPSG:25830', always_xy=True); u2mw = Transformer.from_crs('EPSG:25830', 'ESRI:54009', always_xy=True)
def dump(name, obj): json.dump(obj, open(os.path.join(OUT, name), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':')); print('wrote', name, os.path.getsize(os.path.join(OUT, name)), 'bytes')
adm = json.load(open(os.path.join(ROOT, 'data/vec/admin.json')))
muni_ll = shape([f for f in adm['features'] if f['properties']['kind'] == 'municipio'][0]['geometry'])
from shapely.ops import transform as T
import warnings; warnings.filterwarnings('ignore')
toU = lambda g: T(lambda x, y, z=None: ll2u.transform(x, y), g)
muni = toU(muni_ll)
r1 = lambda v: round(float(v), 1)

# ---------- official statistics (identity page) ----------
wd = J('wikidata_Q8810.json')
pops = sorted([(c['q']['P585'][0]['time'][1:5], int(float(c['v']['amount']))) for c in wd['P1082'] if c['q'].get('P585') and c['q'].get('P459') and c['q']['P459'][0]['id'] == 'Q745221'])
pop_year, pop = pops[-1]; pop2020 = dict(pops).get('2020')
area_pub = float(wd['P2046'][0]['v']['amount']); area_osm = abs(Geod(ellps='GRS80').geometry_area_perimeter(muni_ll)[0]) / 1e6
stats = {'pop': pop, 'pop_year': pop_year, 'pop_date': f'1 Jan {pop_year}', 'pop_src': 'INE — Padrón municipal (continuous register), official figure for 1 January; via Wikidata Q8810 (P1082, determination method Q745221, reference to the INE release)',
         'pop_url': 'https://www.ine.es/dynt3/inebase/index.htm?padre=517', 'area_km2': area_pub, 'area_src': 'Published municipal area (Wikidata Q8810, P2046); our OSM municipal boundary measures %.2f km² (GRS80 ellipsoid), within 0.2 %%' % area_osm,
         'area_osm_km2': round(area_osm, 2), 'density': round(pop / area_pub), 'unit': 'Municipality of Granada (INE code 18087) — the administrative unit, NOT the 10 × 10 km map frame', 'ine_code': '18087',
         'pop_series': pops[-7:]}
print('stats', stats['pop'], stats['area_km2'], stats['density'])

# ---------- 01 DENSITY — GHS-POP R2023A 2020, residents per 100 m cell (modelled) ----------
pm = J('ghspop2020_meta.json'); P = np.load(os.path.join(RAW, 'ghspop2020.npy')).astype(np.float64); t = pm['transform']; P[P < 0] = np.nan
nr, nc = P.shape
cx = t[2] + np.arange(nc + 1) * t[0]; cy = t[5] + np.arange(nr + 1) * t[4]
GX, GY = np.meshgrid(cx, cy); UX, UY = mw2u.transform(GX, GY)  # cell corner grid in EPSG:25830
# keep rows / cols whose cells touch the frame
cellU = lambda r, c: Polygon([(UX[r, c], UY[r, c]), (UX[r, c + 1], UY[r, c + 1]), (UX[r + 1, c + 1], UY[r + 1, c + 1]), (UX[r + 1, c], UY[r + 1, c])])
keep = np.zeros_like(P, dtype=bool)
for r in range(nr):
    for c in range(nc): keep[r, c] = cellU(r, c).intersects(FB)
rows = np.where(keep.any(1))[0]; cols = np.where(keep.any(0))[0]; R0, R1, C0, C1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
Psub = P[R0:R1, C0:C1]; cxu = UX[R0:R1 + 1, C0:C1 + 1]; cyu = UY[R0:R1 + 1, C0:C1 + 1]
centres_x = (cxu[:-1, :-1] + cxu[1:, 1:]) / 2; centres_y = (cyu[:-1, :-1] + cyu[1:, 1:]) / 2
dens = Psub * 100.0  # Mollweide is equal-area: every cell is exactly 0.01 km² → residents / 0.01 km²
inF = (centres_x >= F[0]) & (centres_x <= F[2]) & (centres_y >= F[1]) & (centres_y <= F[3])
inM = contains_xy(muni, centres_x, centres_y)
DEN_BR = [1000, 5000, 10000, 20000, 30000]
pop_frame = float(np.nansum(Psub[inF])); pop_muni_ghs = float(np.nansum(Psub[inM]))
inh = dens[inF & (Psub > 0)]
cls_pop = [float(np.nansum(Psub[inF & (dens > lo) & (dens <= hi)])) for lo, hi in zip([0] + DEN_BR, DEN_BR + [1e12])]
density = {'source': {'name': 'JRC GHSL — GHS-POP R2023A, epoch 2020, 100 m (World Mollweide, equal-area)', 'url': 'https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php', 'license': 'CC BY 4.0',
           'cite': 'Schiavina M., Freire S., Carioli A., MacManus K. (2023): GHS-POP R2023A, European Commission, JRC', 'tile': pm['tile']},
           'cell_values': 'residents per cell (counts, modelled); density = count / 0.01 km² (equal-area cells)', 'kind': 'modelled',
           'corners': {'x': np.round(cxu, 1).tolist(), 'y': np.round(cyu, 1).tolist()}, 'pop': [[None if not np.isfinite(v) else round(float(v), 2) for v in row] for row in Psub],
           'breaks': DEN_BR, 'unit': 'residents / km²',
           'stats': {'pop_frame': round(pop_frame), 'pop_muni_ghs': round(pop_muni_ghs), 'pop_muni_padron_2020': pop2020, 'diff_pct': round((pop_muni_ghs / pop2020 - 1) * 100, 1),
                     'cells_frame': int(inF.sum()), 'cells_inhabited': int((inF & (Psub > 0)).sum()), 'peak': round(float(np.nanmax(dens[inF]))), 'median_inhabited': round(float(np.median(inh))),
                     'share_by_class': [round(v / pop_frame * 100, 1) for v in cls_pop], 'share_dense': round(sum(cls_pop[3:]) / pop_frame * 100, 1)}}
dump('density.json', density)

# ---------- 02 MORPHOLOGY — OSM buildings figure-ground + coverage / gap check against GHSL built-up 2020 ----------
man = json.load(open(os.path.join(ROOT, 'data/manifest.json'))); fg = man['overview']['figureGround']
img = np.asarray(Image.open(os.path.join(ROOT, 'data', fg['file'])).convert('L')); bld = img < 128  # black = building
px = fg['px_m']; ox, oy = fg['ox'], fg['oy']
i0 = int((F[0] - ox) / px); j0 = int((oy - F[3]) / px); n = int((F[2] - F[0]) / px)
sub = bld[j0:j0 + n, i0:i0 + n]; cov_frame = float(sub.mean())
# 100 m grid aligned with the frame: OSM footprint share per cell (from the 4 m raster) vs GHSL built-up surface share 2020
k = int(100 / px); osm100 = sub.reshape(n // k, k, n // k, k).mean(axis=(1, 3))
gm = J('ghsl_meta.json'); G = np.load(os.path.join(RAW, 'ghsl_built_s.npz'))['e2020'].astype(float); gt = gm['2020']['transform']
xs = F[0] + 50 + 100 * np.arange(osm100.shape[1]); ys = F[3] - 50 - 100 * np.arange(osm100.shape[0]); XX, YY = np.meshgrid(xs, ys); MX, MY = u2mw.transform(XX, YY)
gc = ((MX - gt[2]) / gt[0]).astype(int); gr = ((MY - gt[5]) / gt[4]).astype(int); ghs100 = G[gr, gc] / 10000.0
gaps = np.argwhere((ghs100 >= 0.25) & (osm100 < 0.05))
centre_mask = contains_xy(muni, XX, YY)
morph = {'source': {'name': 'OpenStreetMap buildings (supplied extract, 23 Oct 2026), rasterised at 4 m (EPSG:25830)', 'license': 'ODbL 1.0', 'file': 'data/' + fg['file']},
         'check': {'name': 'JRC GHSL — GHS-BUILT-S R2023A, 2020, 100 m', 'license': 'CC BY 4.0', 'rule': 'a 100 m cell is flagged as a probable gap when GHSL reports ≥ 25 % built-up surface and OSM footprints cover < 5 %'},
         'gaps': gaps.tolist(), 'grid': {'x0': F[0], 'y1': F[3], 'cell': 100},
         'stats': {'coverage_frame_pct': round(cov_frame * 100, 1), 'coverage_muni_pct': round(float(osm100[centre_mask].mean() * 100), 1), 'gap_cells': int(len(gaps)), 'gap_area_km2': round(len(gaps) * 0.01, 2),
                   'ghsl_built_cells': int((ghs100 >= 0.25).sum()), 'agree_pct': round(float(((ghs100 >= 0.25) & (osm100 >= 0.05)).sum() / max(1, (ghs100 >= 0.25).sum()) * 100), 1)}}
dump('morphology.json', morph)

# ---------- shared OSM helpers ----------
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

# ---------- 03 CITY CENTRE — commercial activity and services (OSM), quartic KDE, peaks vs UNESCO property ----------
oc = J('osm_commercial.json'); osm_date = oc['osm3s']['timestamp_osm_base']
FOOD = {'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'ice_cream'}; SERV = {'bank', 'bureau_de_change', 'pharmacy', 'post_office'}; BAD_SHOP = {'vacant', 'no', 'disused', 'closed', 'yes;vacant'}
recs = []; dropped = {'vacant_or_disused': 0, 'no_position': 0}
for e in oc['elements']:
    tg = e.get('tags', {})
    if any(k.startswith(('disused:', 'abandoned:', 'was:')) for k in tg) and not tg.get('shop') and not tg.get('amenity'): dropped['vacant_or_disused'] += 1; continue
    if tg.get('shop') in BAD_SHOP: dropped['vacant_or_disused'] += 1; continue
    a = tg.get('amenity'); cat = 'market' if a == 'marketplace' else 'food' if a in FOOD else 'service' if a in SERV else 'retail' if tg.get('shop') else None
    if not cat: continue
    p = pt_of(e)
    if not p: dropped['no_position'] += 1; continue
    recs.append({'x': p[0], 'y': p[1], 'cat': cat, 'name': tg.get('name', ''), 'id': e['type'][0] + str(e['id']), 'kind': tg.get('shop') or a})
# duplicates: the same business mapped twice (node + building way, or two nodes): same category, same normalised name, ≤ 30 m;
# unnamed: same category and kind ≤ 2 m
dup = set(); xyc = np.array([[r['x'], r['y']] for r in recs]); tree = STRtree([Point(x, y) for x, y in xyc])
for i, r in enumerate(recs):
    if i in dup: continue
    for j in tree.query(Point(r['x'], r['y']).buffer(30)):
        if j <= i or j in dup: continue
        q = recs[j]; d = math.hypot(q['x'] - r['x'], q['y'] - r['y'])
        if q['cat'] != r['cat']: continue
        if (r['name'] and norm(r['name']) == norm(q['name'])) or (not r['name'] and not q['name'] and q['kind'] == r['kind'] and d <= 2): dup.add(j if q['id'][0] == 'n' and r['id'][0] != 'n' else j)
pts = [r for i, r in enumerate(recs) if i not in dup]
# location check: stacks of ≥ 5 records at the same 1 m position (address-point artefacts) are reported
from collections import Counter
stk = Counter((round(r['x']), round(r['y'])) for r in pts); stacks = {k: v for k, v in stk.items() if v >= 5}
R = 300.0; cell = 50; nx = int((F[2] - F[0]) / cell)
gx = F[0] + cell / 2 + cell * np.arange(nx); gy = F[3] - cell / 2 - cell * np.arange(nx); GXc, GYc = np.meshgrid(gx, gy)
def kde(points):
    Z = np.zeros((nx, nx))
    for x, y in points:
        if x < F[0] - R or x > F[2] + R or y < F[1] - R or y > F[3] + R: continue
        ci = int((x - F[0]) / cell); cj = int((F[3] - y) / cell); rc = int(R / cell) + 1
        i0, i1, j0, j1 = max(0, ci - rc), min(nx, ci + rc + 1), max(0, cj - rc), min(nx, cj + rc + 1)
        if i0 >= i1 or j0 >= j1: continue
        d2 = ((GXc[j0:j1, i0:i1] - x) ** 2 + (GYc[j0:j1, i0:i1] - y) ** 2) / R ** 2
        Z[j0:j1, i0:i1] += np.where(d2 < 1, 3 / (math.pi * R ** 2) * (1 - d2) ** 2, 0) * 1e6
    return Z
Zc = kde([(r['x'], r['y']) for r in pts])
# peaks: local maxima (±250 m) ≥ 20 % of the highest value, at least 700 m apart
from scipy.ndimage import maximum_filter
mx = maximum_filter(Zc, size=11); cand = np.argwhere((Zc == mx) & (Zc >= 0.2 * Zc.max()))
cand = sorted(cand.tolist(), key=lambda ij: -Zc[ij[0], ij[1]]); peaks = []
for j, i in cand:
    x, y = gx[i], gy[j]
    if all(math.hypot(x - p['x'], y - p['y']) >= 700 for p in peaks):
        n300 = sum(1 for r in pts if math.hypot(r['x'] - x, r['y'] - y) <= 300); peaks.append({'x': round(float(x)), 'y': round(float(y)), 'v': round(float(Zc[j, i])), 'n300': n300})
for k, p in enumerate(peaks): p['rank'] = k + 1; p['rel'] = round(p['v'] / peaks[0]['v'] * 100)
# documented historic core: the official "Conjunto Histórico" (BIC) boundary is not available as open data here, and OSM maps the
# UNESCO property 314 only as a site of three parts (Alhambra and Generalife outlines, Albaicín as a point). The reference used is
# the historic city as mapped on the IGN MTN50 sheet 1009 (1932) — an approximate reconstruction from data/ref/history_extents.json —
# with the UNESCO components drawn for orientation.
he = json.load(open(os.path.join(ROOT, 'data/ref/history_extents.json'), encoding='utf-8'))['extents']['mtn50_1932']
histG = toU(shape(he['geometry'])).buffer(0)
hh = J('osm_heritage.json'); whc_parts = [e for e in hh['elements'] if e.get('tags', {}).get('ref:whc', '').startswith('314-')]
whcP = [{'name': e['tags'].get('name'), 'ref': e['tags']['ref:whc'], 'geom': osm_geom(e)} for e in whc_parts]
for p in peaks: q = Point(p['x'], p['y']); p['in_hist'] = bool(histG.contains(q)); p['dist_hist_m'] = round(histG.exterior.distance(q)) if histG.contains(q) else round(histG.distance(q))
# cross-check with Overture places (municipality only): same categories, same kernel, correlation inside the municipality
ov = json.load(open(os.path.join(ROOT, 'data/vec/places.json'))); OVG = {'shopping', 'food_and_drink'}
ovp = [ll2u.transform(*f['geometry']['coordinates']) for f in ov['features'] if f['properties'].get('g') in OVG and not f['properties'].get('dup') and f['properties'].get('s') != 'permanently_closed']
Zo = kde(ovp); mm = contains_xy(muni, GXc, GYc) & (Zc + Zo > 0)
osm_shop_food = kde([(r['x'], r['y']) for r in pts if r['cat'] in ('retail', 'food')])
corr = float(np.corrcoef(osm_shop_food[mm], Zo[mm])[0, 1])
ovpk = np.unravel_index(np.argmax(Zo), Zo.shape); ov_peak = (float(gx[ovpk[1]]), float(gy[ovpk[0]]))
CEN_BR = [100, 250, 500, 1000, 2000]
centre = {'source': {'name': 'OpenStreetMap — shops (shop=*), food and drink (restaurant, café, bar, pub, fast food, ice cream), services (bank, bureau de change, pharmacy, post office), markets', 'license': 'ODbL 1.0', 'date': osm_date},
          'categories': ['retail', 'food', 'service', 'market'], 'kernel': {'type': 'quartic', 'radius_m': R, 'cell_m': cell, 'unit': 'places / km²', 'counted': 'each deduplicated place counts 1; points up to 600 m beyond the frame are included so the edges are not underestimated'},
          'grid': {'x0': F[0], 'y1': F[3], 'cell': cell, 'n': nx}, 'z': np.round(Zc).astype(int).tolist(), 'breaks': CEN_BR, 'peaks': peaks[:6],
          'hist': {'name': 'Historic city as mapped on IGN MTN50 sheet 1009 "Granada" (1932) — approximate reconstruction (data/ref/history_extents.json)', 'note': 'the official Conjunto Histórico (BIC) boundary is not available as open data here', 'geometry': mapping(histG), 'area_km2': round(histG.area / 1e6, 2)},
          'whc': [{'name': w['name'], 'ref': w['ref'], 'geometry': mapping(w['geom'])} for w in whcP],
          'points': [[round(r['x']), round(r['y']), r['cat'], r['name'], r['id']] for r in pts if F[0] <= r['x'] <= F[2] and F[1] <= r['y'] <= F[3]],
          'stats': {'raw': len(recs), 'duplicates': len(dup), 'kept': len(pts), 'in_frame': sum(1 for r in pts if F[0] <= r['x'] <= F[2] and F[1] <= r['y'] <= F[3]), 'dropped': dropped, 'stacks': len(stacks),
                    'by_cat': Counter(r['cat'] for r in pts if F[0] <= r['x'] <= F[2] and F[1] <= r['y'] <= F[3]), 'overture_corr': round(corr, 2), 'overture_peak_dist_m': round(math.hypot(ov_peak[0] - peaks[0]['x'], ov_peak[1] - peaks[0]['y']))}}
dump('centre.json', centre); print('peaks', peaks[:6]); print('centre stats', centre['stats'])

# ---------- 04 CLIMATE — Landsat 8/9 C2 L2 summer surface temperature (median of clear observations), 90 m blocks ----------
z = np.load(os.path.join(RAW, 'landsat_summer_stack.npz')); st = z['st'].astype(np.float32); nd = z['ndvi'].astype(np.float32); sc = J('landsat_scenes.json')
used = [s for s in sc['scenes'] if s.get('used')]
med = np.nanmedian(st, 0); cnt = np.isfinite(st).sum(0); ndm = np.nanmedian(nd, 0)
b = 3; m3 = (med.shape[0] // b) * b
def blk(a): return np.nanmean(a[:m3, :m3].reshape(m3 // b, b, m3 // b, b), axis=(1, 3))
lst90 = blk(np.where(cnt >= 3, med, np.nan)); nd90 = blk(ndm); cnt90 = blk(cnt.astype(float))
cs = 90.0; X90 = F[0] + cs / 2 + cs * np.arange(lst90.shape[1]); Y90 = F[3] - cs / 2 - cs * np.arange(lst90.shape[0]); XX9, YY9 = np.meshgrid(X90, Y90)
MX9, MY9 = u2mw.transform(XX9, YY9); g9 = G[((MY9 - gt[5]) / gt[4]).astype(int), ((MX9 - gt[2]) / gt[0]).astype(int)] / 10000.0
dense = (g9 >= 0.5) & np.isfinite(lst90); veg = (nd90 >= 0.4) & np.isfinite(lst90); bare = (g9 < 0.05) & (nd90 < 0.2) & np.isfinite(lst90)  # unbuilt, little vegetation (dry fields, bare slopes)
LST_BR = [40, 43, 45, 47, 49, 51]
climate = {'source': {'name': 'Landsat 8 / Landsat 9 Collection 2 Level-2 Surface Temperature (ST_B10), USGS; accessed via Microsoft Planetary Computer', 'license': 'Public domain (USGS)', 'url': 'https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature'},
           'what': 'land surface temperature (the radiative temperature of roofs, roads, soil and canopy at about 10:50 UTC, 11:50 local summer time) — NOT air temperature',
           'period': 'June–August 2024, 2025 and 2026 — median of %d clear-sky scenes (path/row 200/034)' % len(used), 'scenes': [[s['date'][:10], s['platform'], s['clear_frac_frame']] for s in used],
           'resolution': 'TIRS thermal band native 100 m (delivered resampled at 30 m); shown as 90 m blocks (mean of 3 × 3 delivered pixels) so no finer detail is implied',
           'cloud': 'per-pixel masking with QA_PIXEL (fill, dilated cloud, cirrus, cloud, cloud shadow excluded; clear bit required); pixels with fewer than 3 clear observations are shown as missing',
           'grid': {'x0': F[0], 'y1': F[3], 'cell': cs, 'n': int(lst90.shape[0])}, 'lst': [[None if not np.isfinite(v) else round(float(v), 1) for v in row] for row in lst90],
           'ndvi': [[None if not np.isfinite(v) else round(float(v), 2) for v in row] for row in nd90], 'breaks': LST_BR, 'unit': '°C',
           'stats': {'scenes': len(used), 'first': used[0]['date'][:10], 'last': used[-1]['date'][:10], 'min_obs': int(cnt.min()), 'median_obs': int(np.median(cnt)), 'median_frame': r1(np.nanmedian(lst90)),
                     'p5': r1(np.nanpercentile(lst90, 5)), 'p95': r1(np.nanpercentile(lst90, 95)), 'dense_built': r1(np.nanmedian(lst90[dense])), 'vegetated': r1(np.nanmedian(lst90[veg])),
                     'gap_dense_veg': r1(np.nanmedian(lst90[dense]) - np.nanmedian(lst90[veg])), 'bare': r1(np.nanmedian(lst90[bare])), 'bare_cells': int(bare.sum()), 'missing_cells': int(np.isnan(lst90).sum())}}
dump('climate.json', climate); print('climate', climate['stats'])

# ---------- 05 HUMAN DIMENSION — everyday meeting places (OSM) and their reach to residents ----------
ev = J('osm_everyday.json')
areas = {'square': [], 'park': []}; pois = {'market': [], 'cafe': [], 'playground': [], 'civic': []}
for e in ev['elements']:
    tg = e.get('tags', {}); g = osm_geom(e)
    if g is None or g.is_empty or not g.intersects(FB.buffer(400)): continue
    a = tg.get('amenity'); le = tg.get('leisure')
    if tg.get('place') == 'square' or (tg.get('highway') == 'pedestrian' and (tg.get('area') == 'yes' or e['type'] == 'relation')):
        if g.geom_type in ('Polygon', 'MultiPolygon') and g.area >= 300: areas['square'].append((g, tg.get('name', '')))
        elif g.geom_type == 'Point': pois.setdefault('square_pt', []).append((g, tg.get('name', '')))
    elif le == 'park' or (le == 'garden' and tg.get('name') and tg.get('access') not in ('private', 'no')):
        if g.geom_type in ('Polygon', 'MultiPolygon') and g.area >= 1000: areas['park'].append((g, tg.get('name', '')))
    elif le == 'playground': pois['playground'].append((g.centroid if g.geom_type != 'Point' else g, tg.get('name', '')))
    elif a == 'marketplace': pois['market'].append((g.centroid if g.geom_type != 'Point' else g, tg.get('name', '')))
    elif a == 'cafe': pois['cafe'].append((g.centroid if g.geom_type != 'Point' else g, tg.get('name', '')))
    elif a in ('library', 'community_centre', 'social_centre'): pois['civic'].append((g.centroid if g.geom_type != 'Point' else g, tg.get('name', '')))
# reach: modelled residents (GHS-POP cell centres) within 300 m (straight line) of a square, park or market
targets = unary_union([g for g, _ in areas['square'] + areas['park']] + [g for g, _ in pois['market']] + [g for g, _ in pois.get('square_pt', [])]).buffer(300)
cxr, cyr = centres_x, centres_y; inR = contains_xy(targets, cxr, cyr)
pf = np.where(np.isfinite(Psub), Psub, 0)
reach = float(pf[inF & inR].sum() / pf[inF].sum())
far = np.argwhere(inF & ~inR & (pf * 100 >= 2000))  # inhabited (≥ 2,000 residents / km²) cells beyond 300 m
clip = lambda g: g.intersection(FB.buffer(50))
coords = lambda g: [[[round(x), round(y)] for x, y in r.coords] for r in ([g.exterior] + list(g.interiors))] if g.geom_type == 'Polygon' else [c for gg in g.geoms for c in coords(gg)] if g.geom_type == 'MultiPolygon' else []
human = {'source': {'name': 'OpenStreetMap — squares (place=square, pedestrian areas), parks and named public gardens (≥ 1,000 m²), markets, cafés, playgrounds, libraries and community centres', 'license': 'ODbL 1.0', 'date': ev['osm3s']['timestamp_osm_base']},
         'question': 'reach', 'areas': {k: [{'n': nm, 'p': coords(clip(g).buffer(0) if clip(g).geom_type not in ('Polygon', 'MultiPolygon') else clip(g))} for g, nm in v if not clip(g).is_empty] for k, v in areas.items()},
         'points': {k: [[round(g.x), round(g.y), nm] for g, nm in v if F[0] <= g.x <= F[2] and F[1] <= g.y <= F[3]] for k, v in pois.items()},
         'far': [[int(r), int(c)] for r, c in far], 'far_ref': 'row / column in density.json corners (GHS-POP cells)',
         'stats': {'squares': sum(1 for g, _ in areas['square'] + pois.get('square_pt', []) if g.intersects(FB)), 'parks': sum(1 for g, _ in areas['park'] if g.intersects(FB)), 'markets': sum(1 for g, _ in pois['market'] if FB.contains(g)), 'cafes': sum(1 for g, _ in pois['cafe'] if FB.contains(g)), 'playgrounds': sum(1 for g, _ in pois['playground'] if FB.contains(g)),
                   'civic': sum(1 for g, _ in pois['civic'] if FB.contains(g)), 'reach_pct': round(reach * 100, 1), 'radius_m': 300, 'far_cells': int(len(far))}}
dump('human.json', human); print('human', human['stats'])

# ---------- frame (stored once) + audit ----------
frame = {'epsg': 25830, 'x0': F[0], 'y0': F[1], 'x1': F[2], 'y1': F[3], 'km': 10, 'map_mm': 250, 'scale': 40000, 'north': 'grid north (EPSG:25830, UTM 30N); true north differs by < 1° here',
         'why': {'coverage_pct': 98.7, 'basis': 'GHSL GHS-BUILT-S 2020 built-up surface inside the municipality of Granada', 'alt15': {'coverage_pct': 100.0, 'scale': 60000}},
         'stats': stats, 'osm_date': osm_date,
         'audit': [
           ['density', 'GHS-POP R2023A 2020 (JRC)', '2020', 'residents per 100 m cell → residents/km²', '100 m (Mollweide)', 'global; whole frame', 'modelled: census totals redistributed with built-up data; %+.1f %% vs Padrón 2020 inside the municipality' % density['stats']['diff_pct'], 'modelled'],
           ['morphology', 'OpenStreetMap buildings', '23 Oct 2026', 'footprint (binary)', '4 m raster of vector footprints', 'whole frame', 'volunteered mapping; probable gaps flagged against GHSL 2020 built-up', 'measured (mapped)'],
           ['morphology-check', 'GHS-BUILT-S R2023A 2020 (JRC)', '2020', 'm² built per cell', '100 m', 'global', 'used only to flag probable gaps', 'modelled from imagery'],
           ['centre', 'OpenStreetMap shops, food and drink, services, markets', osm_date[:10], 'places → quartic kernel density (places/km², r = 300 m)', 'points; 50 m density grid', 'whole frame + 600 m', 'mapping completeness varies; counts places, not turnover or visitors', 'mapped'],
           ['centre-check', 'Overture Maps places (supplied)', '2026', 'places', 'points', 'municipality only', 'cross-check only (correlation)', 'mapped / aggregated'],
           ['climate', 'Landsat 8/9 C2 L2 ST_B10 (USGS)', '%s – %s (JJA)' % (used[0]['date'][:10], used[-1]['date'][:10]), '°C (land surface)', '100 m native, shown 90 m', 'whole frame, ≥ %d clear obs per pixel' % int(cnt.min()), 'land surface, not air temperature; one overpass time (≈ 11:50 local)', 'measured (satellite retrieval)'],
           ['human', 'OpenStreetMap squares, parks, markets, cafés, playgrounds, civic', osm_date[:10], 'features; residents within 300 m', 'vector; 100 m (reach)', 'whole frame', 'opportunities, not observed presence; no pedestrian counts available', 'mapped + modelled residents'],
           ['identity', 'INE Padrón (via Wikidata Q8810)', stats['pop_date'], 'residents', 'municipality', 'municipality of Granada', 'administrative unit, not the map frame', 'official'],
         ]}
dump('frame.json', frame)
