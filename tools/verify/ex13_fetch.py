"""Runner-only data collection for Exercise 1.3 (build 5.16). Open internet on the GitHub runner; nothing is committed by
this script. Everything is printed (gzip + base64) between ===FILE name=== / ===END=== markers and processed offline by
tools/build_ex13.py. Shared map frame: EPSG:25830 x 440750–450750, y 4110000–4120000 (10 × 10 km).
  1. JRC GHSL GHS-POP R2023A, epoch 2020, 100 m (Mollweide) — residents per cell (modelled), CC BY 4.0
  2. Landsat 8/9 Collection 2 Level-2 (USGS; via Microsoft Planetary Computer STAC): surface temperature (ST_B10),
     red / NIR (NDVI) and QA_PIXEL for clear summer (June–August) scenes 2024–2026; per-pixel cloud masking
  3. OpenStreetMap (Overpass): commercial / service POIs, everyday meeting places (markets, cafés, squares, parks,
     playgrounds, libraries, community centres) with geometry, heritage / protected-area polygons — ODbL
  4. Official statistics for cross-checks: INE (Padrón) via the INE API, Wikidata Q8810 (population, area)"""
import base64, gzip, io, json, os, sys, time, urllib.parse, urllib.request, zipfile
import numpy as np
UA = {'User-Agent': 'GranadaAtlas-build/1.0 (https://github.com/ahmdklany6-ai/granada-atlas)'}
def get(u, t=180, data=None, hdr=None):
    for k in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(u, data=data, headers=dict(UA, **(hdr or {}))), timeout=t).read()
        except Exception as e: print('retry', u[:110], e, flush=True); time.sleep(4 + 6 * k)
    return None
OUTDIR = os.environ.get('OUTDIR')  # 5.26: on GitLab the files are written there and kept as job artifacts (no base64 in the log)
def emit(name, data):
    if OUTDIR: os.makedirs(OUTDIR, exist_ok=True); open(os.path.join(OUTDIR, name), 'wb').write(data); print('wrote', name, len(data), 'bytes', flush=True); return
    b = base64.b64encode(gzip.compress(data)).decode(); print(f'===FILE {name}==='); [print(b[i:i + 8000]) for i in range(0, len(b), 8000)]; print('===END===', flush=True)
if os.environ.get('PART', 'a') != 'a': sys.exit(0)
from pyproj import Transformer
F = tuple(int(v) for v in os.environ['FRAME'].split(',')) if os.environ.get('FRAME') else (440750, 4110000, 450750, 4120000); M = 600  # frame + margin (m); 5.26: FRAME=x0,y0,x1,y1 for a second frame
to_ll = Transformer.from_crs('EPSG:25830', 'EPSG:4326', always_xy=True); to_mw = Transformer.from_crs('EPSG:25830', 'ESRI:54009', always_xy=True)
corners = [(F[0] - M, F[1] - M), (F[2] + M, F[1] - M), (F[2] + M, F[3] + M), (F[0] - M, F[3] + M)]
ll = [to_ll.transform(*c) for c in corners]; S, Wd, N, E = min(p[1] for p in ll), min(p[0] for p in ll), max(p[1] for p in ll), max(p[0] for p in ll)
print('frame bbox lat/lon', S, Wd, N, E, flush=True)
import rasterio
from rasterio.windows import from_bounds
log = {}
ONLY = (os.environ.get('ONLY') or (open('tools/verify/ex13_only').read().strip() if os.path.exists('tools/verify/ex13_only') else '') or 'pop,landsat,osm,stats').split(',')
# ---------- 1. GHS-POP ----------
try:
    if 'pop' not in ONLY: raise RuntimeError('skipped')
    mw = [to_mw.transform(*c) for c in corners]; b = (min(p[0] for p in mw) - 300, min(p[1] for p in mw) - 300, max(p[0] for p in mw) + 300, max(p[1] for p in mw) + 300)
    name = 'GHS_POP_E2020_GLOBE_R2023A_54009_100_V1_0_R5_C18'
    z = get(f'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/GHS_POP_E2020_GLOBE_R2023A_54009_100/V1-0/tiles/{name}.zip', 600)
    zf = zipfile.ZipFile(io.BytesIO(z)); tif = [n for n in zf.namelist() if n.endswith('.tif')][0]; open('/tmp/p.tif', 'wb').write(zf.read(tif))
    with rasterio.open('/tmp/p.tif') as ds:
        w = from_bounds(*b, ds.transform).round_offsets().round_lengths(); a = ds.read(1, window=w).astype(np.float32); tr = ds.window_transform(w)
        meta = {'tile': name, 'transform': list(tr)[:6], 'shape': list(a.shape), 'nodata': ds.nodata, 'dtype': str(ds.dtypes[0]), 'units': ds.units, 'desc': ds.descriptions, 'tags': ds.tags(), 'files': zf.namelist()}
    buf = io.BytesIO(); np.save(buf, a); emit('ghspop2020.npy', buf.getvalue()); emit('ghspop2020_meta.json', json.dumps(meta, default=str).encode()); print('ghs-pop', a.shape, float(np.nansum(a[a >= 0])), flush=True)
except Exception as e: print('GHS-POP failed', e, flush=True); log['ghspop'] = str(e)
# ---------- 2. Landsat summer LST ----------
try:
    if 'landsat' not in ONLY: raise RuntimeError('skipped')
    q = {'collections': ['landsat-c2-l2'], 'bbox': [Wd, S, E, N], 'datetime': '2024-06-01T00:00:00Z/2026-08-31T23:59:59Z', 'limit': 200,
         'query': {'eo:cloud_cover': {'lt': 40}, 'platform': {'in': ['landsat-8', 'landsat-9']}}}
    r = json.loads(get('https://planetarycomputer.microsoft.com/api/stac/v1/search', 120, json.dumps(q).encode(), {'Content-Type': 'application/json'}))
    items = [it for it in r.get('features', []) if it['properties']['datetime'][5:7] in ('06', '07', '08')]
    print('landsat summer items', len(items), flush=True)
    toks = {}
    def signed(href):  # SAS token per storage account / container (Planetary Computer, anonymous)
        u = urllib.parse.urlparse(href); acct = u.netloc.split('.')[0]; cont = u.path.strip('/').split('/')[0]; k = acct + '/' + cont
        if k not in toks: toks[k] = json.loads(get(f'https://planetarycomputer.microsoft.com/api/sas/v1/token/{acct}/{cont}'))['token']
        return href + '?' + toks[k]
    scenes = []; st_list = []; nd_list = []
    for it in sorted(items, key=lambda x: x['properties']['datetime']):
        p = it['properties']; epsg = p.get('proj:epsg') or 32630
        if epsg != 32630: print('skip epsg', epsg); continue
        def rd(asset):
            href = signed(it['assets'][asset]['href'])
            with rasterio.open(href) as ds:
                w = from_bounds(F[0], F[1], F[2], F[3], ds.transform).round_offsets().round_lengths(); return ds.read(1, window=w, boundless=True, fill_value=0)
        try:
            qa = rd('qa_pixel').astype(np.uint16); st = rd('lwir11').astype(np.float32)
            clear = ((qa >> 6) & 1 == 1) & ((qa & 0b11111) == 0) & (st > 0)
            frac = float(clear.mean())
            rec = {'id': it['id'], 'date': p['datetime'], 'platform': p['platform'], 'cloud_cover': p.get('eo:cloud_cover'), 'clear_frac_frame': round(frac, 3), 'sun_elev': p.get('view:sun_elevation'), 'path_row': (p.get('landsat:wrs_path'), p.get('landsat:wrs_row'))}
            if frac < 0.5: rec['used'] = False; scenes.append(rec); print('low clear', rec, flush=True); continue
            red = rd('red').astype(np.float32); nir = rd('nir08').astype(np.float32)
            stc = np.where(clear, st * 0.00341802 + 149.0 - 273.15, np.nan).astype(np.float32)
            rr = red * 0.0000275 - 0.2; nn = nir * 0.0000275 - 0.2; ndvi = np.where(clear & (red > 0) & (nir > 0), (nn - rr) / np.maximum(nn + rr, 1e-6), np.nan).astype(np.float32)
            st_list.append(stc); nd_list.append(ndvi); rec['used'] = True; rec['median_frame_C'] = round(float(np.nanmedian(stc)), 2); scenes.append(rec); print('scene', rec, flush=True)
        except Exception as e: print('scene fail', it['id'], e, flush=True)
    if st_list:
        sh = min(a.shape for a in st_list); st_arr = np.stack([a[:sh[0], :sh[1]] for a in st_list]); nd_arr = np.stack([a[:sh[0], :sh[1]] for a in nd_list])
        buf = io.BytesIO(); np.savez_compressed(buf, st=st_arr.astype(np.float16), ndvi=nd_arr.astype(np.float16)); emit('landsat_summer_stack.npz', buf.getvalue())
    emit('landsat_scenes.json', json.dumps({'frame': F, 'grid': '30 m Landsat C2 L2 (UTM 30N, EPSG:32630), window = frame', 'scenes': scenes}).encode())
except Exception as e: print('Landsat failed', e, flush=True); log['landsat'] = str(e)
# ---------- 2b. GHSL built-up surface 2020 (5.26; the city frame takes it from hist_extent_fetch.py) ----------
if 'ghsl' in ONLY:
    try:
        mw = [to_mw.transform(*c) for c in corners]; gb = (min(p[0] for p in mw) - 500, min(p[1] for p in mw) - 500, max(p[0] for p in mw) + 500, max(p[1] for p in mw) + 500)
        col = int((gb[0] + 18041000) // 1000000) + 1; row = int((9000000 - gb[3]) // 1000000) + 1; got = None
        for (r, c) in [(row, col), (row, col + 1), (row + 1, col), (row - 1, col), (row, col - 1)]:
            name = f'GHS_BUILT_S_E2020_GLOBE_R2023A_54009_100_V1_0_R{r}_C{c}'
            z = get(f'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_S_GLOBE_R2023A/GHS_BUILT_S_E2020_GLOBE_R2023A_54009_100/V1-0/tiles/{name}.zip', 600)
            if not z: continue
            zf = zipfile.ZipFile(io.BytesIO(z)); tif = [n for n in zf.namelist() if n.endswith('.tif')][0]; open('/tmp/g.tif', 'wb').write(zf.read(tif))
            with rasterio.open('/tmp/g.tif') as ds:
                bd = ds.bounds
                if not (bd.left <= gb[0] and bd.right >= gb[2] and bd.bottom <= gb[1] and bd.top >= gb[3]): print('ghsl tile does not cover', name, flush=True); continue
                w = from_bounds(*gb, ds.transform).round_offsets().round_lengths(); a = ds.read(1, window=w); t = ds.window_transform(w)
                got = {'2020': {'transform': list(t)[:6], 'shape': list(a.shape), 'nodata': ds.nodata, 'tile': name}}
                buf = io.BytesIO(); np.savez_compressed(buf, e2020=a.astype(np.uint16)); emit('ghsl_built_s.npz', buf.getvalue()); emit('ghsl_meta.json', json.dumps(got).encode()); print('ghsl', name, a.shape, flush=True); break
        if not got: print('GHSL failed: no tile covers the frame', flush=True)
    except Exception as e: print('GHSL failed', e, flush=True); log['ghsl'] = str(e)
# ---------- 3. OpenStreetMap via Overpass ----------
bb = f'{S},{Wd},{N},{E}'
QS = {
  'osm_commercial': f'''[out:json][timeout:300];(nwr["shop"]({bb});nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|bank|bureau_de_change|pharmacy|post_office|marketplace)$"]({bb}););out center tags;''',
  'osm_everyday': f'''[out:json][timeout:300];(nwr["amenity"~"^(marketplace|cafe|library|community_centre|social_centre)$"]({bb});nwr["place"="square"]({bb});way["highway"="pedestrian"]["area"="yes"]({bb});relation["highway"="pedestrian"]({bb});nwr["leisure"~"^(park|playground)$"]({bb});nwr["leisure"="garden"]["access"!~"^(private|no)$"]({bb}););out geom tags;''',
  'osm_heritage': f'''[out:json][timeout:300];(nwr["heritage"]({bb});nwr["boundary"="protected_area"]({bb});nwr["historic"="city_walls"]({bb});nwr["boundary"="historic"]({bb}););out geom tags;''',
}
if os.environ.get('EXTRA') == '1':  # 5.26: a frame outside the atlas' local OSM extract also needs buildings, streets and municipalities
    QS['osm_buildings'] = f'''[out:json][timeout:600];(way["building"]({bb});relation["building"]({bb}););out geom tags;'''
    QS['osm_streets'] = f'''[out:json][timeout:600];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|service|track)$"]({bb});out geom tags;'''
    QS['osm_admin'] = f'''[out:json][timeout:300];relation["boundary"="administrative"]["admin_level"="8"]({bb});out geom;'''
    QS['osm_landuse'] = f'''[out:json][timeout:300];(way["landuse"]({bb});way["leisure"~"park|garden|pitch"]({bb}););out geom tags;'''
for name, ql in (QS.items() if 'osm' in ONLY else []):
    d = None
    for ep in ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']:
        d = get(ep, 400, urllib.parse.urlencode({'data': ql}).encode())
        if d and d[:1] == b'{': break
    if d: j = json.loads(d); print(name, len(j.get('elements', [])), j.get('osm3s', {}).get('timestamp_osm_base'), flush=True); emit(name + '.json', d)
    else: print('overpass failed', name, flush=True)
    time.sleep(5)
# ---------- 4. official statistics ----------
wd = get('https://www.wikidata.org/wiki/Special:EntityData/Q8810.json', 60) if 'stats' in ONLY else None
if wd:
    e = json.loads(wd)['entities']['Q8810']['claims']; out = {}
    for P in ['P1082', 'P2046', 'P131', 'P17', 'P772']:
        out[P] = [{'v': c['mainsnak'].get('datavalue', {}).get('value'), 'q': {k: [x.get('datavalue', {}).get('value') for x in vv] for k, vv in c.get('qualifiers', {}).items()}, 'refs': [{k: [x.get('datavalue', {}).get('value') for x in vv] for k, vv in r.get('snaks', {}).items()} for r in c.get('references', [])][:2]} for c in e.get(P, [])]
    emit('wikidata_Q8810.json', json.dumps(out).encode())
for u in [] if 'stats' not in ONLY else ['https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/2871?nult=4', 'https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/2871?tip=AM&nult=4']:
    d = get(u, 120)
    if d:
        try:
            j = json.loads(d); keep = [s for s in j if '18087' in json.dumps(s) or s.get('Nombre', '').startswith('Granada')][:12]; emit('ine_2871.json', json.dumps(keep or j[:5]).encode()); break
        except Exception as e: print('ine parse', e, d[:200], flush=True)
emit('fetch_log.json', json.dumps(log).encode())
print('DONE', flush=True)
