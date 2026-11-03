"""Runner-side: which IGN historical WMS layers return real imagery over Granada (study-area-sized boxes), and is PNOA2024
in the capabilities? Prints HTTP status, content type, size and pixel statistics (blank = one colour / white / transparent)."""
import io, re, urllib.request
from PIL import Image, ImageStat
UA = {'User-Agent': 'granada-atlas checks'}
def get(u, t=60):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t) as r: return r.status, r.headers.get('content-type'), r.read()
for svc in ['https://www.ign.es/wms/pnoa-historico', 'https://www.ign.es/wms/primera-edicion-mtn', 'https://www.ign.es/wms-inspire/pnoa-ma']:
    try:
        s, ct, b = get(svc + '?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1'); txt = b.decode('utf8', 'replace')
        names = re.findall(r'<Name>([^<]+)</Name>', txt); print('CAP', svc, s, len(b), 'layers:', names[:80])
    except Exception as e: print('CAP ERR', svc, e)
boxes = {'centre': (446300, 4114300, 447300, 4115100), 'albaicin': (446900, 4115300, 447700, 4116100)}
layers = [('https://www.ign.es/wms/pnoa-historico', l) for l in ['AMS_1956-1957', 'Interministerial_1973-1986', 'PNOA2004', 'PNOA2010', 'PNOA2016', 'PNOA2022', 'PNOA2023', 'PNOA2024', 'PNOA2025']] + [('https://www.ign.es/wms/primera-edicion-mtn', 'MTN50'), ('https://www.ign.es/wms-inspire/pnoa-ma', 'OI.OrthoimageCoverage')]
for svc, l in layers:
    for nm, (x0, y0, x1, y1) in boxes.items():
        u = f'{svc}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={l}&STYLES=&SRS=EPSG:25830&BBOX={x0},{y0},{x1},{y1}&WIDTH=640&HEIGHT=512&FORMAT=image/jpeg'
        try:
            s, ct, b = get(u)
            if 'image' in (ct or ''):
                im = Image.open(io.BytesIO(b)).convert('RGBA'); st = ImageStat.Stat(im); ext = im.convert('L').getextrema(); cols = len(im.convert('RGB').getcolors(maxcolors=100000) or []) if im.size else 0
                print(f'MAP {l:28s} {nm:8s} {s} {ct} {len(b):7d} B mean={[round(x) for x in st.mean]} std={[round(x) for x in st.stddev]} L-range={ext} colours={cols}')
            else: print(f'MAP {l:28s} {nm:8s} {s} {ct} {len(b)} B TEXT: {b[:300]!r}')
        except Exception as e: print(f'MAP {l} {nm} ERR {e}')
