"""Runner-only downloads for build 5.50: fill the cards that were empty for study areas south of the city (owner report,
23 Nov 2026, "analysis_Base" PDF: places 0, scheduled buses 0, construction periods 0 of 14,076, trees 0, canopy failed,
noise map empty). The build sandbox cannot reach these hosts; this runs on the GitHub runner
(.github/workflows/data-fetch.yml, workflow_dispatch script=basefill_fetch.py dir=basefill) and writes raw files to
out/basefill. Each part is independent; a failure is logged in fetch_log.json and the rest continues.
  1. Overture Maps Places (latest release on the public S3 bucket, read with DuckDB) inside the atlas region + the south
  2. GTFS feeds whose provider or name mentions Granada / Andalucía, found in the Mobility Database catalogue (CSV)
  3. Catastro INSPIRE Buildings (ATOM, province 18): building centroids with dateOfConstruction / floors / use,
     for every municipality whose buildings reach the region (parsed here; the GML is not kept)
  4. OpenStreetMap via Overpass: trees and tree rows, tourist accommodation — whole region
  5. Copernicus HRL Tree Cover Density 2018 (EEA ImageServer exportImage), region, 10 m, EPSG:25830
  6. MITECO SICA noise WMS capabilities (which strategic noise layers exist: agglomeration, roads, rail, airports)"""
import csv, io, json, math, os, re, subprocess, sys, time, urllib.parse, urllib.request, zipfile
import xml.etree.ElementTree as ET
UA = {'User-Agent': 'GranadaAtlas-build/1.0 (https://github.com/ahmdklany6-ai/granada-atlas)'}
OUT = os.path.join('out', os.environ.get('DIR', 'basefill')); os.makedirs(OUT, exist_ok=True)
W, S, E, N = -3.75, 37.06, -3.46, 37.27   # atlas region (data/manifest.json region4326) widened to the south and west
log = {}
def get(u, t=180, data=None, hdr=None, tries=4):
    for k in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(urllib.parse.quote(u, safe=':/?&=%,;+@'), data=data, headers=dict(UA, **(hdr or {}))), timeout=t).read()
        except Exception as e: print('retry', u[:120], e, flush=True); time.sleep(4 + 6 * k)
    return None
def save(name, data):
    if isinstance(data, (dict, list)): data = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
    open(os.path.join(OUT, name), 'wb').write(data); print('wrote', name, len(data), 'bytes', flush=True)
def part(name, fn):
    try: fn(); log[name] = 'ok'
    except Exception as e:
        import traceback; traceback.print_exc(); log[name] = repr(e)[:500]
    save('fetch_log.json', log)

# ---------- 1. Overture places ----------
def overture():
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'duckdb'], check=True)
    import duckdb
    x = get('https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&prefix=release/&delimiter=/', 60).decode()
    rels = sorted(re.findall(r'<Prefix>release/([^<]+)/</Prefix>', x)); rel = rels[-1]; print('overture releases', rels[-4:], flush=True)
    con = duckdb.connect(); con.execute('INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs; SET s3_region="us-west-2";')
    q = f"""SELECT ST_X(geometry) AS lon, ST_Y(geometry) AS lat, to_json(p) AS j FROM (SELECT * EXCLUDE (geometry) FROM
            read_parquet('s3://overturemaps-us-west-2/release/{rel}/theme=places/type=place/*', hive_partitioning=1)
            WHERE bbox.xmin BETWEEN {W} AND {E} AND bbox.ymin BETWEEN {S} AND {N}) p"""
    q = q.replace('ST_X(geometry) AS lon, ST_Y(geometry) AS lat, to_json(p) AS j FROM (SELECT * EXCLUDE (geometry) FROM', 'ST_X(geometry) AS lon, ST_Y(geometry) AS lat, to_json(p) AS j FROM (SELECT * FROM')
    rows = con.execute(q).fetchall()
    recs = []
    for lon, lat, j in rows:
        r = json.loads(j) if isinstance(j, str) else j; r.pop('geometry', None); r['lon'] = lon; r['lat'] = lat; recs.append(r)
    save('overture_places.json', {'release': rel, 'bbox': [W, S, E, N], 'n': len(recs), 'places': recs})

# ---------- 2. GTFS ----------
def gtfs():
    raw = get('https://share.mobilitydata.org/catalogs-csv', 120) or get('https://bit.ly/catalogs-csv', 120)
    rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8', 'replace'))))
    hit = [r for r in rows if r.get('data_type', 'gtfs') == 'gtfs' and re.search(r'granada|andaluc', ' '.join(str(v) for v in r.values()), re.I)]
    save('gtfs_catalog_hits.json', hit); got = []
    for r in hit:
        for key in ('urls.latest', 'urls.direct_download'):
            u = r.get(key)
            if not u: continue
            z = get(u, 300, tries=2)
            if z and z[:2] == b'PK' and len(z) < 90e6:
                fn = 'gtfs_%s.zip' % (r.get('mdb_source_id') or len(got)); save(fn, z); got.append({'file': fn, 'url': u, 'provider': r.get('provider'), 'name': r.get('name'), 'license': r.get('urls.license'), 'bbox': [r.get('location.bounding_box.minimum_longitude'), r.get('location.bounding_box.minimum_latitude'), r.get('location.bounding_box.maximum_longitude'), r.get('location.bounding_box.maximum_latitude')]}); break
    save('gtfs_index.json', got)

def ctan():
    out = {}; r = None
    for B in ('https://api.ctan.es/v1/Consorcios', 'http://api.ctan.es/v1/Consorcios', 'https://api.ctan.es/v1/Consorcios/3/lineas'):
        r = get(B, 60, tries=2); print('ctan', B, (r or b'')[:200], flush=True)
        if r: B = 'https://api.ctan.es/v1/Consorcios' if B.endswith('lineas') else B; break
    if not r: raise RuntimeError('api.ctan.es did not answer')
    out['consorcios'] = json.loads(r) if r else None; save('ctan_consorcios.json', out['consorcios'])
    cs = (out['consorcios'] or {}).get('consorcios') or out['consorcios'] or []
    gid = next((c.get('idConsorcio') for c in cs if isinstance(c, dict) and 'granada' in json.dumps(c, ensure_ascii=False).lower()), None)
    if gid is None: raise RuntimeError('Granada consortium not found')
    for name, path in (('paradas', '/paradas'), ('lineas', '/lineas'), ('nucleos', '/nucleos'), ('municipios', '/municipios'), ('modos', '/modostransporte')):
        r = get(f'{B}/{gid}{path}', 120); save(f'ctan_{name}.json', r or b'null')
    lines = json.loads(open(os.path.join(OUT, 'ctan_lineas.json')).read() or 'null') or {}
    lines = lines.get('lineas', lines) if isinstance(lines, dict) else lines
    hor = {}
    for ln in lines or []:
        lid = ln.get('idLinea'); time.sleep(0.3)
        st = get(f'{B}/{gid}/lineas/{lid}/paradas', 60, tries=2)
        h = get(f'{B}/{gid}/horarios_lineas?linea={lid}&lang=ES', 60, tries=2)
        hor[str(lid)] = {'line': ln, 'paradas': json.loads(st) if st else None, 'horarios': json.loads(h) if h else None}
    save('ctan_lineas_full.json', {'consorcio': gid, 'lines': hor})

# ---------- 3. Catastro INSPIRE buildings ----------
def catastro():
    from pyproj import Transformer
    feed = get('https://www.catastro.hacienda.gob.es/INSPIRE/buildings/18/ES.SDGC.bu.atom_18.xml', 120)
    save('catastro_feed_18.xml', feed); txt = feed.decode('utf-8', 'replace')
    import unicodedata
    norm = lambda v: re.sub(r'[^A-Z ]', ' ', unicodedata.normalize('NFKD', v).encode('ascii', 'ignore').decode().upper())
    NAMES = ['GRANADA', 'ARMILLA', 'CHURRIANA', 'GABIAS', 'ALHENDIN', 'OGIJARES', 'CULLAR VEGA', 'GOJAR', 'CAJAR', 'ZUBIA', 'HUETOR VEGA',
             'MONACHIL', 'MARACENA', 'PELIGROS', 'ALBOLOTE', 'ATARFE', 'PULIANAS', 'JUN', 'OTURA', 'DILAR', 'SANTA FE', 'VEGAS DEL GENIL', 'MALAHA', 'CENES']
    want = {}
    for ent in re.findall(r'<entry>(.*?)</entry>', txt, re.S):
        tt = re.search(r'<title>([^<]+)</title>', ent); lk = re.search(r'href="([^"]+\.zip)"', ent)
        if not tt or not lk: continue
        words = norm(tt.group(1)).split()
        if any(all(w in words for w in nm.split()) for nm in NAMES): want[lk.group(1)] = tt.group(1).strip()
    print('municipal files wanted', len(want), list(want.values()), flush=True)
    tr = Transformer.from_crs('EPSG:25830', 'EPSG:4326', always_xy=True); out = []; done = []
    NS = {'gml': 'http://www.opengis.net/gml/3.2', 'bu-core2d': 'http://inspire.jrc.ec.europa.eu/schemas/bu-core2d/2.0',
          'bu-ext2d': 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0'}
    only = [v for v in os.environ.get('CATASTRO_ONLY', '').split(',') if v]
    if only: want = {u: tt for u, tt in want.items() if any(o in norm(tt) for o in only)}
    for u, title in want.items():
        time.sleep(4); z = get(u, 1200, tries=5)
        if not z: done.append([title, 'download failed']); continue
        zf = zipfile.ZipFile(io.BytesIO(z)); gml = [n for n in zf.namelist() if n.endswith('building.gml')]
        if not gml: done.append([title, 'no building.gml', zf.namelist()[:5]]); continue
        n0 = len(out)
        for ev, el in ET.iterparse(zf.open(gml[0]), events=('end',)):
            if not el.tag.endswith('}Building'): continue
            def txt(path):
                e = el.find(path, NS); return e.text if e is not None else None
            beg = None
            for e in el.iter():
                if e.tag.endswith('}beginning') or e.tag.endswith('}dateOfConstruction'):
                    for s in e.iter():
                        if s.text and re.match(r'^\d{4}', s.text.strip()): beg = s.text.strip()[:4]; break
                if beg: break
            fl = None; use = None; pos = None
            for e in el.iter():
                if e.tag.endswith('}numberOfFloorsAboveGround') and e.text and e.text.strip().isdigit(): fl = int(e.text)
                if e.tag.endswith('}currentUse') and e.text: use = e.text.strip()
                if pos is None and e.tag.endswith('}posList') and e.text:
                    v = [float(a) for a in e.text.split()]; xs, ys = v[0::2], v[1::2]; pos = (sum(xs) / len(xs), sum(ys) / len(ys))
            ref = el.get('{http://www.opengis.net/gml/3.2}id', '')
            if pos:
                lon, lat = tr.transform(*pos)
                if W <= lon <= E and S <= lat <= N: out.append([round(lon, 6), round(lat, 6), int(beg) if beg else None, fl, use, ref.replace('ES.SDGC.BU.', '')])
            el.clear()
        done.append([title, len(out) - n0]); print('catastro', title, len(out) - n0, flush=True)
        save(os.environ.get('CATASTRO_FILE', 'catastro_buildings.json'), {'source': 'Dirección General del Catastro — INSPIRE Buildings (ATOM, province 18)', 'fields': ['lon', 'lat', 'year', 'floors_above', 'currentUse', 'ref'], 'municipalities': done, 'b': out})

# ---------- 4. Overpass ----------
def overpass():
    q = f"""[out:json][timeout:300];(node["natural"="tree"]({S},{W},{N},{E});way["natural"="tree_row"]({S},{W},{N},{E});
      nwr["tourism"~"^(hotel|hostel|guest_house|apartment|motel|camp_site|caravan_site|chalet)$"]({S},{W},{N},{E}););out tags center geom;"""
    for host in ('https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'):
        r = get(host, 400, urllib.parse.urlencode({'data': q}).encode(), tries=2)
        if r and r[:1] == b'{': save('osm_trees_stay.json', r); return
    raise RuntimeError('all Overpass hosts failed')

# ---------- 5. Copernicus Tree Cover Density ----------
def tcd():
    from pyproj import Transformer
    t = Transformer.from_crs('EPSG:4326', 'EPSG:25830', always_xy=True); x0, y0 = t.transform(W, S); x1, y1 = t.transform(E, N)
    x0, y0, x1, y1 = [int(v // 10 * 10) for v in (x0, y0, x1 + 10, y1 + 10)]; w, h = (x1 - x0) // 10, (y1 - y0) // 10
    diag = {}
    for u in ('https://image.discomap.eea.europa.eu/arcgis/rest/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer?f=pjson',
              'https://image.discomap.eea.europa.eu/arcgis/rest/services/GioLandPublic?f=pjson',
              'https://image.discomap.eea.europa.eu/arcgis/rest/services?f=pjson',
              'https://copernicus.discomap.eea.europa.eu/arcgis/rest/services?f=pjson'):
        r = get(u, 60, tries=2); diag[u] = (r or b'')[:3000].decode('utf-8', 'replace')
    save('tcd_diag.json', diag)
    base = 'https://image.discomap.eea.europa.eu/arcgis/rest/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer/exportImage'
    m = re.search(r'"(https://[^"]*TreeCoverDensity[^"]*ImageServer)', json.dumps(diag))
    tiles = []; step = 1000
    for j in range(0, h, step):
        for i in range(0, w, step):
            bx = [x0 + i * 10, y1 - min(h, j + step) * 10, x0 + min(w, i + step) * 10, y1 - j * 10]
            p = {'bbox': ','.join(map(str, bx)), 'bboxSR': 25830, 'imageSR': 25830, 'size': f'{(bx[2] - bx[0]) // 10},{(bx[3] - bx[1]) // 10}', 'format': 'tiff', 'pixelType': 'U8', 'interpolation': 'RSP_NearestNeighbor', 'f': 'image'}
            r = get(base + '?' + urllib.parse.urlencode(p), 300)
            if not r: raise RuntimeError('exportImage failed ' + str(bx))
            fn = f'tcd_{i}_{j}.tif'; save(fn, r); tiles.append({'file': fn, 'bbox': bx})
    save('tcd_index.json', {'epsg': 25830, 'px': 10, 'frame': [x0, y0, x1, y1], 'tiles': tiles})

def worldcover():
    import rasterio
    from rasterio.windows import from_bounds
    u = '/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N36W006_Map.tif'
    with rasterio.open(u) as ds:
        w = from_bounds(W, S, E, N, ds.transform).round_offsets().round_lengths(); a = ds.read(1, window=w); tr = ds.window_transform(w)
    import numpy as np
    buf = io.BytesIO(); np.savez_compressed(buf, cls=a); save('worldcover_2021.npz', buf.getvalue())
    save('worldcover_2021_meta.json', {'transform': list(tr)[:6], 'shape': list(a.shape), 'crs': 'EPSG:4326', 'classes': {str(k): int((a == k).sum()) for k in np.unique(a)}, 'url': u})

# ---------- 6. SICA noise capabilities ----------
def sica():
    for ws in ('evaluacionambiental',):
        r = get(f'https://gis.miteco.gob.es/geoserver/{ws}/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1', 120)
        if r: save(f'sica_{ws}_caps.xml', r)
    # a test GetMap of every noise layer over the base (does anything draw there?)
    caps = open(os.path.join(OUT, 'sica_evaluacionambiental_caps.xml'), 'rb').read().decode('utf-8', 'replace')
    names = sorted(set(re.findall(r'<Name>(mer_[a-z_]+_(?:lden|ln))</Name>', caps))); res = {}
    for nm in names:
        u = f'https://gis.miteco.gob.es/geoserver/evaluacionambiental/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={nm}&STYLES=&SRS=EPSG:4326&BBOX=-3.70,37.09,-3.58,37.17&WIDTH=400&HEIGHT=270&FORMAT=image/png&TRANSPARENT=TRUE'
        r = get(u, 60, tries=1)
        if r and r[:4] == b'\x89PNG':
            from PIL import Image
            im = Image.open(io.BytesIO(r)).convert('RGBA'); a = im.getchannel('A').histogram(); res[nm] = round(1 - a[0] / (im.width * im.height), 4)
            if res[nm] > 0.001: save('sica_' + nm + '.png', r)
        else: res[nm] = None
    save('sica_coverage.json', res)

ONLY = os.environ.get('ONLY') or (open('tools/verify/basefill_only').read().strip() if os.path.exists('tools/verify/basefill_only') else '')
for line in (open('tools/verify/basefill_env').read().splitlines() if os.path.exists('tools/verify/basefill_env') else []):
    if '=' in line: k, v = line.split('=', 1); os.environ.setdefault(k.strip(), v.strip())
for nm, fn in (('sica', sica), ('overpass', overpass), ('tcd', tcd), ('gtfs', gtfs), ('ctan', ctan), ('worldcover', worldcover), ('overture', overture), ('catastro', catastro)):
    if ONLY and nm not in ONLY.split(','): continue
    print('=====', nm, flush=True); part(nm, fn)
print(json.dumps(log, indent=1))
