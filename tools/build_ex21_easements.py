"""Build data/ex21/ for Exercise 2.1 (Scale): the aeronautical easements of the Base Aérea de Armilla as an
"allowed height above ground" layer.
Input: the Ministry of Defence KMZ files of RD 118/2019 (Servidumbre Operativa Hoja-01…05 and SA-01 aeródromo), from
https://www.defensa.gob.es/ministerio/organigrama/sedef/digenin/sdgpatrimonio/ — "Origen de los datos: Ministerio de
Defensa" (reuse under Ley 37/2007 general conditions). Each file holds 3D lines (absolute altitude, m) of limit surfaces.
Method: per file, a linear TIN interpolation of its line vertices (600–2600 m) on a 25 m EPSG:25830 grid; the lowest
surface of all files at each cell; minus the ground (IGN MDT25, data/terrain/dem_mdt25.bin). An approximation of the
surfaces between their drawn lines — not the legal value at any point (that is read from the official plans).
Output: data/ex21/allowed_height.png (classes, transparent where ≥ 60 m), data/ex21/easements.json (extent, classes,
town values, sources).
Usage: KMZ_DIR=/folder/with/kmz python3 tools/build_ex21_easements.py   (needs numpy, scipy, pyproj, Pillow)"""
import glob, json, os, struct, zipfile, io, xml.etree.ElementTree as ET
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from pyproj import Transformer
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KMZ = os.environ.get('KMZ_DIR')
X0, X1, Y0, Y1, C = 439000, 448000, 4105000, 4113500, 25
CLASSES = [(-1e9, 0, 'above', (41, 16, 12, 235)), (0, 15, '0-15', (90, 29, 34, 200)), (15, 30, '15-30', (153, 43, 42, 150)),
           (30, 60, '30-60', (201, 139, 128, 85))]  # palette: ink brown, oxblood, studio red, rose (js/palette.js)
T = Transformer.from_crs(4326, 25830, always_xy=True)


def kml_of(path):
    if path.endswith('.kml'): return open(path, 'rb').read()
    z = zipfile.ZipFile(path); name = next(n for n in z.namelist() if n.endswith('.kml')); return z.read(name)


def main():
    if not KMZ: raise SystemExit('set KMZ_DIR')
    m = json.load(open(os.path.join(ROOT, 'data/manifest.json')))['terrain']['dem']
    D = np.frombuffer(open(os.path.join(ROOT, 'data', m['file']), 'rb').read(), dtype='<i2').reshape(m['height'], m['width']).astype(float); D[D == m['nodata']] = np.nan
    xs = np.arange(X0, X1, C) + C / 2; ys = np.arange(Y1, Y0, -C) - C / 2; GX, GY = np.meshgrid(xs, ys)
    G = D[((m['oy'] - GY) / m['py']).astype(int), ((GX - m['ox']) / m['px']).astype(int)]
    low = np.full(GX.shape, np.inf); used = []
    files = sorted(f for f in glob.glob(os.path.join(KMZ, '*')) if any(k in os.path.basename(f) for k in ('_SO_Hoja', 'LEGA_SA_Aerodromo')))
    for path in files:
        r = ET.fromstring(kml_of(path)); K = r.tag.split('}')[0] + '}'; pts = []
        for ls in r.iter(K + 'LineString'):
            for c in ls.iter(K + 'coordinates'):
                for tok in (c.text or '').split():
                    a = [float(v) for v in tok.split(',')]
                    if 600 <= a[2] <= 2600: x, y = T.transform(a[0], a[1]); pts.append((x, y, a[2]))
        P = np.array(pts); z = LinearNDInterpolator(P[:, :2], P[:, 2])(GX, GY); low = np.where(np.isnan(z), low, np.minimum(low, z))
        used.append({'file': os.path.basename(path).split('-', 1)[-1].replace('.zip', ''), 'vertices': len(P), 'z': [round(float(P[:, 2].min()), 1), round(float(P[:, 2].max()), 1)]})
    A = low - G; A[np.isinf(low)] = np.nan
    img = np.zeros(A.shape + (4,), dtype=np.uint8)
    for lo, hi, _, col in CLASSES: img[(A >= lo) & (A < hi)] = col
    os.makedirs(os.path.join(ROOT, 'data/ex21'), exist_ok=True)
    Image.fromarray(img, 'RGBA').save(os.path.join(ROOT, 'data/ex21/allowed_height.png'), optimize=True)
    be = json.load(open(os.path.join(ROOT, 'data/vec/base_edge.json'))); towns = {}
    for f in be['features']:
        if f['properties'].get('k') != 'town': continue
        x, y = T.transform(*f['geometry']['coordinates']); j, i = int((Y1 - y) / C), int((x - X0) / C)
        towns[f['properties']['nm']] = {'ground': round(float(G[j, i])), 'limit': round(float(low[j, i])), 'allowed': round(float(A[j, i]))}
    v = A[~np.isnan(A)]
    out = {'extent': [X0, Y0, X1, Y1], 'cell_m': C, 'epsg': 25830, 'classes': [[lo if lo > -1e8 else None, hi, n, list(col)] for lo, hi, n, col in CLASSES],
           'towns': towns, 'files': used, 'share_below_m': {str(t): round(float((v < t).mean() * 100), 1) for t in (0, 15, 30, 60)},
           'decree': 'Real Decreto 118/2019, de 1 de marzo (BOE núm. 98, 24/04/2019, BOE-A-2019-6129)',
           'reference_point_m': 701.1, 'thresholds_m': {'18': 676.2, '36': 701.1},
           'source': 'Origen de los datos: Ministerio de Defensa (SDG Patrimonio, servidumbres aeronáuticas Base Aérea de Armilla, KMZ). Ground: IGN MDT25, CC BY 4.0.',
           'method': 'lowest limit surface (linear TIN between the drawn 3D lines of each file) minus ground, 25 m grid — an approximation, not the legal value'}
    json.dump(out, open(os.path.join(ROOT, 'data/ex21/easements.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: out[k] for k in ('towns', 'share_below_m')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
