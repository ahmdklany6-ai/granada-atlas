# Build 5.27 (story tour) — sources that only the runner can reach:
#  1. the municipalities of the Aglomeración Urbana de Granada (POTAUG, Decreto 244/1999) as listed on es.wikipedia;
#  2. MIVAU "Sistema Estatal de Referencia del Precio del Alquiler de Vivienda" (SERPAVI): the download page and, if a
#     municipal file is linked, the rows of Granada province (INE codes 18xxx) — median rent €/m² per month.
# Prints plain text and ===FILE name=== base64 blocks (small files only).
import base64, io, json, re, sys, urllib.request, urllib.parse
UA = {'User-Agent': 'granada-atlas-build/5.27 (static research site; one-off source check)'}
def get(u, t=90):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
def emit(name, b):
    s = base64.b64encode(b).decode(); print(f'===FILE {name}==='); [print(s[i:i + 8000]) for i in range(0, len(s), 8000)]; print('===END===', flush=True)

print('=== 1. POTAUG municipalities (es.wikipedia)')
for title in ['Área metropolitana de Granada', 'Plan de Ordenación del Territorio de la Aglomeración Urbana de Granada', 'Aglomeración urbana de Granada']:
    try:
        u = 'https://es.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'parse', 'page': title, 'prop': 'wikitext', 'format': 'json', 'redirects': 1})
        d = json.loads(get(u)); w = d.get('parse', {}).get('wikitext', {}).get('*', '')
        print('--- page', title, '->', d.get('parse', {}).get('title'), len(w), 'chars')
        if w: emit('wiki_' + re.sub(r'\W+', '_', title)[:40] + '.txt', w.encode())
    except Exception as e:
        print('--- page', title, 'ERROR', e)

print('=== 2. MIVAU SERPAVI')
pages = ['https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi',
         'https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi/sistema-estatal-de-referencia-del-precio-del-alquiler-de-vivienda',
         'https://www.mivau.gob.es/vivienda/estadisticas-y-estudios/indices-alquiler']
links = set()
for p in pages:
    try:
        h = get(p).decode('utf-8', 'ignore'); print('--- page', p, len(h), 'bytes')
        for m in re.findall(r'href="([^"]+)"', h):
            if re.search(r'\.(xlsx?|csv|zip)(\?|$)', m, re.I) or 'serpavi' in m.lower() or 'alquiler' in m.lower():
                links.add(urllib.parse.urljoin(p, m))
    except Exception as e:
        print('--- page', p, 'ERROR', e)
for l in sorted(links): print('link', l)
files = [l for l in sorted(links) if re.search(r'\.(xlsx?|csv|zip)(\?|$)', l, re.I)]
try:
    import openpyxl
except ImportError:
    import subprocess; subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'openpyxl']); import openpyxl
for l in files[:12]:
    try:
        b = get(l, 180); print('--- file', l, len(b), 'bytes')
        if not l.lower().split('?')[0].endswith('xlsx'): continue
        wb = openpyxl.load_workbook(io.BytesIO(b), read_only=True, data_only=True)
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True)); print('   sheet', ws.title, len(rows), 'rows')
            hdr = [r for r in rows[:15]]
            for r in hdr: print('   H', [c for c in r][:16])
            keep = [r for r in rows if any(isinstance(c, (str, int, float)) and re.fullmatch(r'18\d{3}(\d{5})?', str(c).strip()) for c in r[:4])]
            if keep:
                print('   rows for Granada province:', len(keep))
                emit(('serpavi_' + re.sub(r'\W+', '_', ws.title))[:50] + '.json', json.dumps({'url': l, 'sheet': ws.title, 'header': [list(map(str, r)) for r in hdr], 'rows': [list(map(lambda c: c if isinstance(c, (int, float)) or c is None else str(c), r)) for r in keep]}).encode())
    except Exception as e:
        print('--- file', l, 'ERROR', e)
