"""Independent validator for Granada Atlas GIS packages (no GDAL needed).
Checks: GeoPackage core requirements (OGC 12-128r18), GeoPackage binary + WKB decoding,
declared types, envelopes and contents bounds, GeoJSON (RFC 7946), feature-count parity,
GPKG↔GeoJSON spatial alignment using a separately written Transverse Mercator (Snyder),
GeoTIFF tags/georeferencing against a known test surface, and QML well-formedness.
Usage: python3 tests/validate_export.py <folder with *_gis.zip and ring.json> ..."""
import sys, os, io, json, math, sqlite3, struct, zipfile, tempfile, xml.etree.ElementTree as ET

FAIL = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra else ''))
    if not cond: FAIL.append(name)

# --- Snyder (USGS PP 1395) Transverse Mercator, GRS80 — independent of the app's Krüger code
def tm_snyder(lon, lat, lon0=-3.0, k0=0.9996, a=6378137.0, f=1/298.257222101):
    e2 = f * (2 - f); ep2 = e2 / (1 - e2); phi = math.radians(lat); lam = math.radians(lon - lon0)
    N = a / math.sqrt(1 - e2 * math.sin(phi) ** 2); T = math.tan(phi) ** 2; Cc = ep2 * math.cos(phi) ** 2; A = lam * math.cos(phi)
    M = a * ((1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * phi - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * math.sin(2*phi) + (15*e2**2/256 + 45*e2**3/1024) * math.sin(4*phi) - (35*e2**3/3072) * math.sin(6*phi))
    x = k0 * N * (A + (1 - T + Cc) * A**3 / 6 + (5 - 18*T + T*T + 72*Cc - 58*ep2) * A**5 / 120) + 500000
    y = k0 * (M + N * math.tan(phi) * (A*A/2 + (5 - T + 9*Cc + 4*Cc*Cc) * A**4 / 24 + (61 - 58*T + T*T + 600*Cc - 330*ep2) * A**6 / 720))
    return x, y

def read_wkb(b, o=0):
    bo = b[o]; E = '<' if bo == 1 else '>'; t = struct.unpack_from(E + 'I', b, o + 1)[0]; o += 5
    def pt(o): return struct.unpack_from(E + 'dd', b, o), o + 16
    def ring(o):
        n = struct.unpack_from(E + 'I', b, o)[0]; o += 4; r = []
        for _ in range(n): p, o = pt(o); r.append(p)
        return r, o
    if t == 1: p, o = pt(o); return ('Point', p), o
    if t == 2: r, o = ring(o); return ('LineString', r), o
    if t == 3:
        n = struct.unpack_from(E + 'I', b, o)[0]; o += 4; rs = []
        for _ in range(n): r, o = ring(o); rs.append(r)
        return ('Polygon', rs), o
    if t in (4, 5, 6):
        n = struct.unpack_from(E + 'I', b, o)[0]; o += 4; parts = []
        for _ in range(n): g, o = read_wkb(b, o); parts.append(g[1])
        return ({4: 'MultiPoint', 5: 'MultiLineString', 6: 'MultiPolygon'}[t], parts), o
    raise ValueError('wkb type %d' % t)

def flat(c):
    if isinstance(c[0], (int, float)): yield c
    else:
        for x in c: yield from flat(x)

def signed_area(r):
    return sum(r[i][0] * r[(i+1) % len(r)][1] - r[(i+1) % len(r)][0] * r[i][1] for i in range(len(r))) / 2

def validate(folder):
    zips = [f for f in os.listdir(folder) if f.endswith('_gis.zip')]; check(f'{folder}: one zip', len(zips) == 1)
    z = zipfile.ZipFile(os.path.join(folder, zips[0])); names = z.namelist()
    check('zip CRCs ok', z.testzip() is None)
    gp = [n for n in names if n.endswith('.gpkg')][0]
    tmp = tempfile.NamedTemporaryFile(suffix='.gpkg', delete=False); tmp.write(z.read(gp)); tmp.close()
    db = sqlite3.connect(tmp.name)
    q = lambda s, *a: db.execute(s, a).fetchall()
    check('application_id = GPKG', q('PRAGMA application_id')[0][0] == 0x47504B47)
    check('user_version 10300', q('PRAGMA user_version')[0][0] == 10300)
    check('integrity_check ok', q('PRAGMA integrity_check')[0][0] == 'ok')
    check('foreign_key_check clean', q('PRAGMA foreign_key_check') == [])
    tables = {r[0] for r in q("SELECT name FROM sqlite_master WHERE type='table'")}
    for t in ('gpkg_spatial_ref_sys', 'gpkg_contents', 'gpkg_geometry_columns'): check('table ' + t, t in tables)
    srs = {r[0]: r for r in q('SELECT srs_id, organization, organization_coordsys_id, definition FROM gpkg_spatial_ref_sys')}
    check('srs -1, 0, 4326 present', all(k in srs for k in (-1, 0, 4326)))
    gc = q('SELECT table_name, column_name, geometry_type_name, srs_id, z, m FROM gpkg_geometry_columns')
    contents = {r[0]: r for r in q('SELECT table_name, data_type, identifier, min_x, min_y, max_x, max_y, srs_id FROM gpkg_contents')}
    crs = gc[0][3]; check('single CRS for all layers (%d)' % crs, all(r[3] == crs for r in gc) and crs in srs)
    meta = json.loads(z.read([n for n in names if n.endswith('metadata.json')][0]))
    ring = json.load(open(os.path.join(folder, 'ring.json')))
    for (tn, col, gtype, sid, zz, mm) in gc:
        c = contents.get(tn); check(f'[{tn}] in gpkg_contents as features', c and c[1] == 'features' and c[7] == sid)
        rows = q(f'SELECT fid, {col} FROM "{tn}"')
        bad = 0; env_bad = 0; types = set(); bb = [math.inf, math.inf, -math.inf, -math.inf]; unclosed = 0
        for fid, blob in rows:
            b = bytes(blob)
            if b[:2] != b'GP' or b[2] != 0: bad += 1; continue
            flags = b[3]; srs_id = struct.unpack_from('<i', b, 4)[0]; envt = (flags >> 1) & 7
            if srs_id != sid: bad += 1
            elen = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[envt]
            env = struct.unpack_from('<4d', b, 8) if envt == 1 else None
            g, end = read_wkb(b, 8 + elen); types.add(g[0])
            if end != len(b): bad += 1
            pts = list(flat(g[1]))
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            if env and pts and (abs(env[0] - min(xs)) > 1e-9 or abs(env[1] - max(xs)) > 1e-9 or abs(env[2] - min(ys)) > 1e-9 or abs(env[3] - max(ys)) > 1e-9): env_bad += 1
            if pts: bb = [min(bb[0], min(xs)), min(bb[1], min(ys)), max(bb[2], max(xs)), max(bb[3], max(ys))]
            if g[0] in ('Polygon', 'MultiPolygon'):
                polys = [g[1]] if g[0] == 'Polygon' else g[1]
                for poly in polys:
                    for r in poly:
                        if r[0] != r[-1] or len(r) < 4: unclosed += 1
        exp = {'POINT': {'Point'}, 'LINESTRING': {'LineString'}, 'POLYGON': {'Polygon'}, 'MULTIPOLYGON': {'MultiPolygon'}, 'MULTILINESTRING': {'MultiLineString'}}[gtype]
        check(f'[{tn}] {len(rows)} geometries decode, srs/size ok', bad == 0)
        check(f'[{tn}] WKB types match declared {gtype}', not rows or types <= exp, str(types))
        check(f'[{tn}] envelopes exact', env_bad == 0)
        check(f'[{tn}] polygon rings closed', unclosed == 0)
        if rows: check(f'[{tn}] contents bounds = data bounds', all(abs(a - b) < 1e-6 for a, b in zip(bb, c[3:7])))
        # count parity with GeoJSON
        gj = [n for n in names if n.endswith(f'geojson/{tn}.geojson')]
        if gj:
            fc = json.loads(z.read(gj[0])); check(f'[{tn}] GeoJSON count = GPKG count ({len(rows)})', len(fc['features']) == len(rows))
            lonlat = [p for f in fc['features'] for p in flat(f['geometry']['coordinates'])]
            check(f'[{tn}] GeoJSON lon/lat in Granada range', all(-4 < p[0] < -3 and 36.9 < p[1] < 37.5 for p in lonlat))
            # RFC 7946 winding: exterior CCW, holes CW (lon/lat plane)
            if fc['features'] and fc['features'][0]['geometry']['type'] in ('Polygon', 'MultiPolygon'):
                wr = 0
                for f in fc['features']:
                    gg = f['geometry']; polys = [gg['coordinates']] if gg['type'] == 'Polygon' else gg['coordinates']
                    for poly in polys:
                        for i, r in enumerate(poly):
                            a = signed_area(r[:-1])
                            if (i == 0 and a < 0) or (i > 0 and a > 0): wr += 1
                check(f'[{tn}] GeoJSON winding RFC 7946', wr == 0, f'{wr} rings reversed' if wr else '')
            # alignment: GPKG coordinates vs GeoJSON coordinates projected independently
            gpkg_pts = []
            for fid, blob in rows:
                b = bytes(blob); envt = (b[3] >> 1) & 7; elen = {0: 0, 1: 32}[envt]; gpkg_pts += list(flat(read_wkb(b, 8 + elen)[0][1]))
            if crs == 25830:
                err = max(math.hypot(*(a - b for a, b in zip(tm_snyder(*ll), xy))) for ll, xy in zip(lonlat, gpkg_pts)) if lonlat else 0
                check(f'[{tn}] EPSG:25830 coords match independent Snyder TM', err < 0.01, f'max {err*1000:.2f} mm')
            else:
                err = max(math.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(lonlat, gpkg_pts)) if lonlat else 0
                check(f'[{tn}] EPSG:4326 coords identical to GeoJSON', err < 1e-7)
    # boundary area vs metadata
    sa = q('SELECT area_m2 FROM study_area')[0][0]; check('study_area.area_m2 = metadata', abs(sa - meta['area_m2']) < 0.01)
    # clipping: landuse/streets must not stick out of the boundary
    if crs == 4326:
        def inside(p, r):
            c = False
            for i in range(len(r) - 1):
                (x1, y1), (x2, y2) = r[i], r[i + 1]
                if (y1 > p[1]) != (y2 > p[1]) and p[0] < (x2 - x1) * (p[1] - y1) / (y2 - y1) + x1: c = not c
            return c
        out = 0
        for tn in ('landuse', 'streets'):
            for (blob,) in q(f'SELECT geom FROM "{tn}"'):
                b = bytes(blob); g, _ = read_wkb(b, 40)
                segs = []
                for part in (g[1] if g[0].startswith('Multi') else [g[1]]):
                    lines = part if g[0] == 'MultiPolygon' else [part]
                    for ln in lines:
                        for i in range(len(ln) - 1): segs.append(((ln[i][0] + ln[i+1][0]) / 2, (ln[i][1] + ln[i+1][1]) / 2))
                def dseg(p, a, b):
                    dx, dy = b[0] - a[0], b[1] - a[1]; L = dx * dx + dy * dy
                    t = 0 if L == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L))
                    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
                out += sum(1 for m in segs if not inside(m, ring) and min(dseg(m, ring[i], ring[i + 1]) for i in range(len(ring) - 1)) > 1e-7)
        check('clipped layers stay inside the boundary', out == 0, f'{out} segment midpoints outside')
    # attribute tables, styles
    for t in ('layer_status', 'field_dictionary', 'sources'): check(f'attribute table {t}', t in tables and contents[t][1] == 'attributes')
    st = q('SELECT f_table_name, styleQML, useAsDefault FROM layer_styles')
    check('layer_styles has a default style per feature layer', {r[0] for r in st} == {r[0] for r in gc} and all(r[2] == 1 for r in st))
    xml_bad = 0
    for tn, qml, _ in st:
        try:
            root = ET.fromstring(qml.split('\n', 1)[1]); r = root.find('renderer-v2')
            if root.tag != 'qgis' or r is None: xml_bad += 1
            if r is not None and r.get('type') == 'categorizedSymbol':
                attr = r.get('attr'); cols = [c[1] for c in q(f'PRAGMA table_info("{tn}")')]
                if attr not in cols: xml_bad += 1
                if len(r.find('categories')) != len(r.find('symbols')): xml_bad += 1
        except Exception as e: xml_bad += 1; print('  QML error', tn, e)
    check('QML styles well-formed; renderer fields exist', xml_bad == 0)
    status = {r[0]: r[1] for r in q('SELECT layer, status FROM layer_status')}
    check('unavailable layers documented, not present', all(status[k] == 'unavailable' and k not in tables for k in ('population', 'gtfs', 'catastro', 'lst')))
    # GeoTIFF
    tif = [n for n in names if n.endswith('.tif')]
    if tif:
        b = z.read(tif[0]); check('TIFF little-endian header', b[:4] == b'II*\x00')
        off = struct.unpack_from('<I', b, 4)[0]; n = struct.unpack_from('<H', b, off)[0]; tags = {}
        sizes = {2: 1, 3: 2, 4: 4, 12: 8}
        for i in range(n):
            tag, typ, cnt, val = struct.unpack_from('<HHII', b, off + 2 + i * 12)
            fmt = {2: 's', 3: 'H', 4: 'I', 12: 'd'}[typ]; data_off = off + 2 + i * 12 + 8 if sizes[typ] * cnt <= 4 else val
            tags[tag] = b[data_off:data_off + cnt].decode() if typ == 2 else struct.unpack_from('<%d%s' % (cnt, fmt), b, data_off)
        W, H = tags[256][0], tags[257][0]
        check('Float32 single band', tags[258][0] == 32 and tags[339][0] == 3 and tags[277][0] == 1)
        gk = tags[34735]; keys = {gk[4 + 4*i]: gk[4 + 4*i + 3] for i in range(gk[3])}
        check('GeoKeys EPSG = %d' % crs, (keys.get(3072) == crs) if crs != 4326 else (keys.get(2048) == 4326))
        check('PixelIsArea', keys.get(1025) == 1)
        sx, sy = tags[33550][:2]; tie = tags[33922]; nod = float(tags[42113].strip('\x00'))
        pix = struct.unpack_from('<%df' % (W * H), b, tags[273][0])
        # test surface: value = 700 + (lat-37.17)*10000 + (lon+3.6)*1000 at each pixel centre
        worst = 0; valid = 0
        for j in range(H):
            for i in range(W):
                v = pix[j * W + i]
                if v == nod: continue
                valid += 1; x = tie[3] + (i + 0.5) * sx; y = tie[4] - (j + 0.5) * sy
                if crs == 25830:
                    # invert Snyder numerically (independent of the app's inverse)
                    lon, lat = -3.6, 37.17
                    for _ in range(8):
                        e0, n0 = tm_snyder(lon, lat); e1, _ = tm_snyder(lon + 1e-5, lat); _, n1 = tm_snyder(lon, lat + 1e-5)
                        lon += (x - e0) / ((e1 - e0) / 1e-5); lat += (y - n0) / ((n1 - n0) / 1e-5)
                else: lon, lat = x, y
                worst = max(worst, abs(v - (700 + (lat - 37.17) * 10000 + (lon + 3.6) * 1000)))
        if SURFACE: check(f'GeoTIFF georeferencing matches pixel centres ({W}x{H}, {valid} valid)', worst < 0.05, f'max error {worst:.4f} (test surface units)')
        else: check(f'GeoTIFF readable ({W}x{H}, {valid} valid pixels)', valid > 0)
        xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
        rect_like = abs(abs(signed_area(ring[:-1])) - (max(xs) - min(xs)) * (max(ys) - min(ys))) < 1e-12
        if not rect_like: check('NoData outside boundary present', valid < W * H)
    rd = [n for n in names if 'README_' in n]; check('README(s) present: ' + ', '.join(os.path.basename(x) for x in rd), len(rd) >= 1)
    os.unlink(tmp.name)

SURFACE = '--no-surface' not in sys.argv
for f in [a for a in sys.argv[1:] if not a.startswith('--')]:
    print('\n==', f); validate(f)
print('\n' + ('ALL CHECKS PASSED' if not FAIL else f'{len(FAIL)} FAILED: {FAIL}'))
sys.exit(1 if FAIL else 0)
