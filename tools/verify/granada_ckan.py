"""Runner-side: search the Ayuntamiento de Granada CKAN portal (opendata.granada.org) for tree datasets; print resources,
licence and a sample of any tree file found (fields, row count)."""
import json, urllib.request, urllib.parse, io, csv, gzip, base64, zipfile
B = 'https://opendata.granada.org/api/3/action/'
def get(u, t=120):
    with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'granada-atlas research'}), timeout=t) as r: return r.read(), r.headers.get('content-type')
seen = {}
for q in ['arbol', 'arbolado', 'árboles', 'arboles', 'jardines', 'parques', 'zonas verdes', 'medio ambiente', 'vegetacion']:
    try:
        j = json.loads(get(B + 'package_search?rows=100&q=' + urllib.parse.quote(q))[0])['result']; print('Q', q, j['count'])
        for p in j['results']: seen[p['name']] = p
    except Exception as e: print('ERR', q, e)
try:
    allp = json.loads(get(B + 'package_list')[0])['result']; print('ALL PACKAGES', len(allp)); print(allp)
except Exception as e: print('ERR list', e)
for n, p in seen.items():
    print('PKG', n, '|', p['title'], '|', p.get('license_title'), p.get('license_id'), '|', (p.get('organization') or {}).get('title'), p.get('metadata_modified'))
    for r in p.get('resources', []): print('   RES', r.get('format'), r.get('name'), r.get('url'), r.get('size'))
tree = [p for n, p in seen.items() if 'arbol' in (n + p['title']).lower()]
for p in tree:
    for r in p.get('resources', []):
        u = r.get('url'); f = (r.get('format') or '').lower()
        try:
            b, ct = get(u, 300); print('GOT', u, ct, len(b))
            if f in ('csv',) or u.lower().endswith('.csv'):
                txt = b.decode('utf8', 'replace') if b[:3] != b'\xef\xbb\xbf' else b[3:].decode('utf8', 'replace')
                rows = list(csv.reader(io.StringIO(txt), delimiter=';' if txt.count(';') > txt.count(',') else ','))
                print('  CSV rows', len(rows)); [print('  ', r_) for r_ in rows[:6]]
            elif 'json' in f or u.lower().endswith(('json', 'geojson')):
                j = json.loads(b); fs = j.get('features') or j; print('  JSON n', len(fs)); print('  ', json.dumps(fs[:2], ensure_ascii=False)[:1500])
            else: print('  HEAD', b[:300])
            out = base64.b64encode(gzip.compress(b)).decode(); print(f'===FILE tree_{len(out)}_{u.split("/")[-1][:60]}==='); [print(out[i:i + 4000]) for i in range(0, len(out), 4000)]; print('===END===')
        except Exception as e: print('ERR GET', u, e)
