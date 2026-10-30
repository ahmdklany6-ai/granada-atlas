# Import test: GeoPackage (layer choice), GeoJSON, zipped Shapefile, GeoTIFF, QML and QGZ.
# Uses the user's supplied files when a folder is given (they stay local; nothing is uploaded),
# plus a small Shapefile and GeoJSON generated here.
# Run: python3 tests/import_test.py <supplied_data_dir> [output_dir]
import io, json, os, struct, subprocess, sys, time, zipfile, glob
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = sys.argv[1] if len(sys.argv) > 1 else None
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp'
PORT = 8768
fails = []
def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  — ' + str(extra)) if extra != '' else '')); (None if cond else fails.append(name))

def shapefile_zip(path):
    # three squares in EPSG:25830 around Plaza Nueva, with a .prj and a UTF-8 .cpg
    polys = [(446300 + i * 120, 4114500, 80, 'Á zona %d' % i, i * 10) for i in range(3)]
    shp = io.BytesIO(); shx = io.BytesIO(); recs = []
    for (x, y, w, nm, v) in polys:
        ring = [(x, y), (x, y + w), (x + w, y + w), (x + w, y), (x, y)]  # clockwise = outer ring
        c = struct.pack('<i', 5) + struct.pack('<4d', x, y, x + w, y + w) + struct.pack('<ii', 1, len(ring)) + struct.pack('<i', 0) + b''.join(struct.pack('<2d', *p) for p in ring)
        recs.append(c)
    off = 100; body = b''; idx = b''
    for i, c in enumerate(recs):
        body += struct.pack('>ii', i + 1, len(c) // 2) + c; idx += struct.pack('>ii', off // 2, len(c) // 2); off += 8 + len(c)
    def header(length):
        return struct.pack('>i', 9994) + b'\0' * 20 + struct.pack('>i', length // 2) + struct.pack('<ii', 1000, 5) + struct.pack('<4d', 446300, 4114500, 446660, 4114580) + b'\0' * 32
    shp_b = header(100 + len(body)) + body; shx_b = header(100 + len(idx)) + idx
    fields = [('name', 'C', 30), ('value', 'N', 10)]
    hl = 32 + 32 * len(fields) + 1; rl = 1 + sum(f[2] for f in fields)
    dbf = struct.pack('<BBBBIHH', 3, 126, 10, 30, len(polys), hl, rl) + b'\0' * 20
    for n, t, l in fields: dbf += n.encode().ljust(11, b'\0') + t.encode() + b'\0' * 4 + bytes([l, 0]) + b'\0' * 14
    dbf += b'\r'
    for (_, _, _, nm, v) in polys: dbf += b' ' + nm.encode('utf-8').ljust(30)[:30] + str(v).rjust(10).encode()
    dbf += b'\x1a'
    prj = 'PROJCS["ETRS89_UTM_zone_30N",GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-3.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]'
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('test_zones.shp', shp_b); z.writestr('test_zones.shx', shx_b); z.writestr('test_zones.dbf', dbf); z.writestr('test_zones.prj', prj); z.writestr('test_zones.cpg', 'UTF-8')

def main():
    sz = os.path.join(OUT, 'test_zones.zip'); shapefile_zip(sz)
    gj = os.path.join(OUT, 'test_points.geojson')
    json.dump({'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'name': 'P%d' % i, 'kind': 'a' if i % 2 else 'b'}, 'geometry': {'type': 'Point', 'coordinates': [-3.60 + i * 0.002, 37.177]}} for i in range(6)]}, open(gj, 'w'))
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            pg = b.new_page(viewport={'width': 1500, 'height': 920}); errors = []
            pg.on('pageerror', lambda e: errors.append(str(e)))
            import ui_test_v2 as U  # reuse the network stubs
            U.PORT = PORT; U.stub(pg)
            pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=30000)
            pg.evaluate('localStorage.clear(); indexedDB.deleteDatabase("granada-atlas-imports"); GA.i18n.setLang("en")'); pg.reload(); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=30000)
            time.sleep(1)
            def upload(path):
                pg.set_input_files('#imp-file', path); time.sleep(1.5)
            upload(sz)
            r = pg.evaluate('JSON.stringify(GA.app.IMP.recs.map(r => ({name: r.name, n: r.n, epsg: r.epsg, f0: r.geojson && r.geojson.features[0].properties, c0: r.geojson && r.geojson.features[0].geometry.coordinates[0][0]})))')
            R = json.loads(r)
            check('zipped Shapefile: 3 polygons, EPSG:25830 from .prj, UTF-8 names, reprojected to lon/lat', len(R) == 1 and R[0]['n'] == 3 and R[0]['epsg'] == 25830 and R[0]['f0']['name'] == 'Á zona 0' and abs(R[0]['c0'][0] + 3.596) < 0.01, R)
            upload(gj)
            R = json.loads(pg.evaluate('JSON.stringify(GA.app.IMP.recs.map(r => [r.name, r.n, r.epsg]))'))
            check('GeoJSON imported (EPSG:4326)', any(x[0] == 'test_points' and x[1] == 6 and x[2] == 4326 for x in R), R)
            if DATA:
                nb = glob.glob(os.path.join(DATA, '**', 'Granada neighborhood and district boundaries.gpkg'), recursive=True)[0]
                upload(nb)
                tables = pg.evaluate('[...document.querySelectorAll("[data-gpkg-layer]")].map(x => x.dataset.gpkgLayer + (x.disabled ? " (disabled)" : ""))')
                check('GeoPackage offers its layers to choose from', len(tables) >= 1, tables)
                barrio = next((t for t in tables if 'barrio' in t.lower() and 'disabled' not in t), tables[0])
                pg.check(f'[data-gpkg-layer="{barrio}"]'); pg.click('#imp-gpkg-go'); time.sleep(2)
                R = json.loads(pg.evaluate('JSON.stringify(GA.app.IMP.recs.map(r => [r.name, r.n, r.epsg, r.fields]))'))
                check('chosen GeoPackage layer imported', any(x[0] == barrio and x[1] > 0 for x in R), [x[:3] for x in R])
                q = glob.glob(os.path.join(DATA, '**', 'Granada barrios mapped (OSM).qml'), recursive=True)[0]
                upload(q)
                rid = pg.evaluate(f'GA.app.IMP.recs.find(r => r.name === {json.dumps(barrio)}).id')
                pg.click(f'[data-qml-apply="{rid}"]'); time.sleep(0.5)
                st = pg.evaluate(f'JSON.stringify((GA.app.store.get().imports.find(c => c.id === "{rid}") || {{}}).style)')
                S = json.loads(st)
                check('QML categorized style applied to the imported layer (field "name")', S.get('mode') == 'categorized' and S.get('field') == 'name' and len(S.get('cats', [])) > 5, (S.get('mode'), S.get('field'), len(S.get('cats', []))))
                tif = glob.glob(os.path.join(DATA, '**', 'Granada slope degrees.tif'), recursive=True)[0]
                upload(tif); time.sleep(2)
                R = json.loads(pg.evaluate('JSON.stringify(GA.app.IMP.recs.filter(r => r.kind === "raster").map(r => r.image.meta))'))
                check('GeoTIFF imported as an overlay (EPSG:25830, 25 m)', len(R) == 1 and R[0]['epsg'] == 25830 and abs(R[0]['px'] - 25) < 0.5, R)
                qgz = glob.glob(os.path.join(DATA, '**', 'Granada neighborhoods.qgz'), recursive=True)[0]
                upload(qgz)
                rows = pg.evaluate('[...document.querySelectorAll("#panel-layers .tbl tr")].map(tr => tr.innerText.replace(/\\s+/g, " "))')
                check('QGZ inspected: layers and missing/available files listed (not loaded as data)', len(rows) >= 2, rows[:6])
            # configuration persists; data stays private in IndexedDB
            n_before = pg.evaluate('GA.app.IMP.recs.length')
            pg.reload(); pg.wait_for_function('window.GA && GA.app && GA.app.map.isStyleLoaded()', timeout=30000); time.sleep(2)
            n_after = pg.evaluate('GA.app.IMP.recs.length'); cfg = pg.evaluate('JSON.stringify(GA.app.store.get().imports.map(c => c.title))')
            check('imports and their settings survive a reload (IndexedDB + project config)', n_after == n_before and n_after >= 2, f'{n_after} layers, {cfg}')
            pg.screenshot(path=os.path.join(OUT, 'import.png'))
            check('no uncaught page errors', not errors, errors[:5])
            b.close()
    finally:
        srv.terminate()
    print('\n%d failure(s)' % len(fails)); sys.exit(1 if fails else 0)

main()
