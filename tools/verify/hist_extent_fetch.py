"""Runner-only data collection for build 5.15 (open internet on the GitHub runner; nothing is committed by this script).
Prints, between ===FILE name=== / ===END=== markers (base64), for offline processing in the repo:
  1. GHSL GHS-BUILT-S R2023A (JRC, CC BY 4.0) built-up surface, epochs 1975–2020, 100 m Mollweide, cropped around Granada
  2. IGN historical WMS snapshots over the city (minutas, MTN50 1st ed., catastrones, AMS 1956–57) + GetFeatureInfo at
     several points (sheet / edition / flight dates), so traced outlines can cite the documented date
  3. Wikimedia Commons candidates for each landmark (metadata + a contact sheet), to choose popup images by eye"""
import base64, gzip, io, json, os, sys, time, urllib.parse, urllib.request, zipfile
import numpy as np
UA = {'User-Agent': 'GranadaAtlas-build/1.0 (https://github.com/ahmdklany6-ai/granada-atlas)'}
def get(u, t=120):
    for k in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
        except Exception as e: print('retry', u[:120], e, flush=True); time.sleep(3 + 5 * k)
    return None
def emit(name, data):
    b = base64.b64encode(gzip.compress(data)).decode(); print(f'===FILE {name}==='); [print(b[i:i + 8000]) for i in range(0, len(b), 8000)]; print('===END===', flush=True)
PART = os.environ.get('PART', 'a')
if PART != 'a': sys.exit(0)

# ---------- 1. GHSL ----------
import rasterio
from rasterio.windows import from_bounds
from pyproj import Transformer
tr = Transformer.from_crs('EPSG:4326', 'ESRI:54009', always_xy=True)
x0, y0 = tr.transform(-3.80, 37.06); x1, y1 = tr.transform(-3.42, 37.30)
xs = [tr.transform(lo, la)[0] for lo in (-3.80, -3.42) for la in (37.06, 37.30)]; ys = [tr.transform(lo, la)[1] for lo in (-3.80, -3.42) for la in (37.06, 37.30)]
bounds = (min(xs) - 500, min(ys) - 500, max(xs) + 500, max(ys) + 500); print('mollweide bounds', bounds, flush=True)
col = int((bounds[0] + 18041000) // 1000000) + 1; row = int((9000000 - bounds[3]) // 1000000) + 1; print('tile guess R', row, 'C', col, flush=True)
out = {}
for ep in range(1975, 2025, 5):
    got = False
    for (r, c) in [(row, col), (row, col + 1), (row + 1, col), (row - 1, col), (row, col - 1)]:
        name = f'GHS_BUILT_S_E{ep}_GLOBE_R2023A_54009_100_V1_0_R{r}_C{c}'
        u = f'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_S_GLOBE_R2023A/GHS_BUILT_S_E{ep}_GLOBE_R2023A_54009_100/V1-0/tiles/{name}.zip'
        z = get(u, 300)
        if not z: continue
        try:
            zf = zipfile.ZipFile(io.BytesIO(z)); tif = [n for n in zf.namelist() if n.endswith('.tif')][0]; open('/tmp/g.tif', 'wb').write(zf.read(tif))
            with rasterio.open('/tmp/g.tif') as ds:
                b = ds.bounds
                if not (b.left <= bounds[0] and b.right >= bounds[2] and b.bottom <= bounds[1] and b.top >= bounds[3]): print(ep, name, 'does not cover', b, flush=True); continue
                w = from_bounds(*bounds, ds.transform); a = ds.read(1, window=w.round_offsets().round_lengths()); t = ds.window_transform(w.round_offsets().round_lengths())
                out[ep] = {'transform': list(t)[:6], 'shape': list(a.shape), 'nodata': ds.nodata, 'tile': name}
                np.save(f'/tmp/ghsl_{ep}.npy', a.astype(np.uint16)); print(ep, name, a.shape, int(a.max()), flush=True); got = True; break
        except Exception as e: print('ghsl err', ep, e, flush=True)
    if not got: print('GHSL epoch missing', ep, flush=True)
buf = io.BytesIO(); np.savez_compressed(buf, **{f'e{ep}': np.load(f'/tmp/ghsl_{ep}.npy') for ep in out}); emit('ghsl_built_s.npz', buf.getvalue()); emit('ghsl_meta.json', json.dumps(out).encode())

# ---------- 2. IGN historical WMS ----------
BB = [-3.645, 37.150, -3.555, 37.205]  # lon/lat, the city and its edges
LAY = [('minutas', 'https://www.ign.es/wms/minutas-cartograficas', 'Minutas', 'image/png', 'Minutas', 'text/html'),
       ('mtn50', 'https://www.ign.es/wms/primera-edicion-mtn', 'MTN50', 'image/jpeg', 'Enlace', 'text/plain'),
       ('catastrones', 'https://www.ign.es/wms/primera-edicion-mtn', 'catastrones', 'image/jpeg', 'catastrones', 'text/html'),
       ('ams56', 'https://www.ign.es/wms/pnoa-historico', 'AMS_1956-1957', 'image/jpeg', 'infoVuelos', 'text/html')]
W = 2000; Hh = int(W * (BB[3] - BB[1]) / ((BB[2] - BB[0]) * np.cos(np.radians(37.18))))
for lid, url, layer, fmt, info, ifmt in LAY:
    u = f'{url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={layer}&STYLES=&SRS=EPSG:4326&BBOX={",".join(map(str, BB))}&WIDTH={W}&HEIGHT={Hh}&FORMAT={urllib.parse.quote(fmt)}'
    im = get(u, 300); print(lid, 'image', len(im) if im else None, flush=True)
    if im: emit(f'wms_{lid}.{"png" if "png" in fmt else "jpg"}', im)
    infos = {}
    for nm, ll in [('centre', (-3.5985, 37.1760)), ('north', (-3.600, 37.195)), ('south', (-3.600, 37.160)), ('west', (-3.625, 37.180)), ('east', (-3.575, 37.172))]:
        d = 0.0005; bb = [ll[0] - d, ll[1] - d, ll[0] + d, ll[1] + d]
        q = f'{url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS={info}&QUERY_LAYERS={info}&STYLES=&SRS=EPSG:4326&BBOX={",".join(map(str, bb))}&WIDTH=11&HEIGHT=11&X=5&Y=5&INFO_FORMAT={ifmt}&FORMAT=image/png'
        r = get(q, 60); infos[nm] = (r or b'').decode('utf-8', 'replace')[:3000]
    emit(f'info_{lid}.json', json.dumps({'bbox': BB, 'size': [W, Hh], 'info': infos}, ensure_ascii=False).encode())

# ---------- 3. Commons candidates ----------
from PIL import Image, ImageDraw
API = 'https://commons.wikimedia.org/w/api.php?'
def api(params):
    params = dict(params, format='json', formatversion='2'); r = get(API + urllib.parse.urlencode(params), 60); return json.loads(r) if r else {}
QUERIES = {
  'Alhambra': ['Alhambra Granada 19th century photograph', 'Alhambra Laurent', 'Alhambra Clifford', 'Alhambra Granada 1890'],
  'Albaicín': ['Albaicín Granada antigua', 'Albaicin Granada 19th century', 'Albaicin Laurent'],
  'Sacromonte': ['Sacromonte Granada cuevas antigua', 'Sacromonte gitanos Granada 1900', 'Sacromonte Granada Doré'],
  'Catedral_de_Granada': ['Catedral de Granada siglo XIX', 'Granada cathedral Laurent', 'Catedral Granada 1890'],
  'Plaza_de_Bib-Rambla': ['Bib-Rambla Granada antigua', 'Bibarrambla Granada 1900', 'Plaza Bib-Rambla siglo XIX'],
  'Alcaicería_de_Granada': ['Alcaicería Granada antigua', 'Alcaiceria Granada 1890', 'Alcaicería Laurent'],
  'Embovedado_del_Darro': ['Darro Granada embovedado', 'río Darro Granada siglo XIX', 'Puente del Carbón Granada'],
  'Plaza_Nueva_(Granada)': ['Plaza Nueva Granada antigua', 'Plaza Nueva Granada 1900', 'Plaza Nueva Granada Laurent'],
  'Gran_Vía_de_Colón': ['Gran Vía Granada antigua', 'Gran Via de Colon Granada 1920', 'Gran Vía Granada construcción'],
  'Realejo-San_Matías': ['Realejo Granada antigua', 'Campo del Príncipe Granada antigua', 'Realejo Granada 1900'],
  'Cartuja_de_Granada': ['Cartuja de Granada antigua', 'Cartuja Granada Laurent', 'Cartuja Granada siglo XIX'],
  'Almanjáyar': ['Almanjáyar Granada', 'Almanjayar'],
  'Generalife': ['Generalife Laurent', 'Generalife Granada 19th century', 'Generalife Clifford'],
}
places = json.load(open('data/ref/history_places.json', encoding='utf-8'))['places']
meta = {}; sheets = []
for key, qs in QUERIES.items():
    titles = []
    th = places.get(key, {}).get('es', {}).get('thumb') or ''
    m = urllib.parse.unquote(th).split('/thumb/')[-1].split('/') if '/thumb/' in th else []
    if len(m) >= 3: titles.append('File:' + m[2].replace('_', ' '))
    for q in qs:
        r = api({'action': 'query', 'list': 'search', 'srsearch': q + ' filetype:bitmap', 'srnamespace': 6, 'srlimit': 12})
        titles += [x['title'] for x in r.get('query', {}).get('search', [])]
    seen = []; [seen.append(x) for x in titles if x not in seen]; titles = seen[:28]
    info = []
    for i in range(0, len(titles), 20):
        r = api({'action': 'query', 'titles': '|'.join(titles[i:i + 20]), 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size', 'iiurlwidth': 320})
        for p in r.get('query', {}).get('pages', []):
            ii = (p.get('imageinfo') or [{}])[0]; em = ii.get('extmetadata', {})
            g = lambda k: (em.get(k) or {}).get('value', '')
            info.append({'title': p['title'], 'thumb': ii.get('thumburl'), 'url': ii.get('descriptionurl'), 'w': ii.get('width'), 'h': ii.get('height'),
                         'date': g('DateTimeOriginal')[:200], 'artist': g('Artist')[:300], 'license': g('LicenseShortName'), 'licurl': g('LicenseUrl'), 'desc': g('ImageDescription')[:500], 'credit': g('Credit')[:300], 'cats': g('Categories')[:400], 'pageimage': p['title'] == (titles[0] if titles else '')})
    order = {t: i for i, t in enumerate(titles)}; info.sort(key=lambda x: order.get(x['title'], 99)); meta[key] = info
    # contact sheet: numbered thumbnails
    tiles = []
    for k, it in enumerate(info):
        im = None
        if it.get('thumb'):
            d = get(it['thumb'], 60)
            try: im = Image.open(io.BytesIO(d)).convert('RGB') if d else None
            except Exception: im = None
        if im is None: im = Image.new('RGB', (160, 120), (220, 220, 220))
        im.thumbnail((200, 150)); c = Image.new('RGB', (204, 172), 'white'); c.paste(im, (2, 2)); ImageDraw.Draw(c).text((4, 154), f'{k}', fill=(200, 0, 0)); tiles.append(c)
    cols = 7; rows = (len(tiles) + cols - 1) // cols or 1; sheet = Image.new('RGB', (cols * 204, rows * 172 + 20), 'white'); ImageDraw.Draw(sheet).text((4, 4), key, fill=(0, 0, 0))
    for k, c in enumerate(tiles): sheet.paste(c, ((k % cols) * 204, 20 + (k // cols) * 172))
    b = io.BytesIO(); sheet.save(b, 'JPEG', quality=72); emit(f'sheet_{key}.jpg', b.getvalue())
emit('commons_candidates.json', json.dumps(meta, ensure_ascii=False).encode())
print('DONE', flush=True)
