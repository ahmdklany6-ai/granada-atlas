"""Runner-side search for tree data for Granada: datos.gob.es catalogue (CKAN-like API), the city's portals, and a fresh
OpenStreetMap export with every dimension tag. Prints what exists; nothing is assumed."""
import json, urllib.request, urllib.parse, gzip, base64
def get(u, data=None, t=90):
    req = urllib.request.Request(u, data=data, headers={'User-Agent': 'granada-atlas research (github.com/ahmdklany6-ai/granada-atlas)', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=t) as r: return r.status, r.headers.get('content-type'), r.read()
for q in ['arbolado', 'arboles', 'árboles', 'arbolado urbano', 'inventario arbolado']:
    for path in ['title', 'keyword']:
        u = f'https://datos.gob.es/apidata/catalog/dataset/{path}/{urllib.parse.quote(q)}.json?_pageSize=200'
        try:
            s, ct, b = get(u); items = json.loads(b)['result']['items']
            for it in items:
                tt = it.get('title'); tt = tt if isinstance(tt, str) else json.dumps(tt, ensure_ascii=False)
                pub = it.get('publisher'); about = it.get('_about')
                if 'granad' in (tt + str(pub) + str(about)).lower(): print('DATOS.GOB', q, path, tt[:200], pub, about)
            print('datos.gob.es', q, path, len(items))
        except Exception as e: print('datos.gob.es ERR', q, path, e)
for u in ['https://www.granada.org/inet/wambiente.nsf', 'https://datos.granada.org/', 'https://www.granada.org/opendata', 'https://opendata.granada.org/', 'https://transparencia.granada.org/',
          'https://www.juntadeandalucia.es/datosabiertos/portal/api/3/action/package_search?q=arbolado%20granada&rows=50',
          'https://www.juntadeandalucia.es/datosabiertos/portal/api/3/action/package_search?q=arboles&rows=50',
          'https://ide.granada.org/', 'https://sig.granada.org/', 'https://www.granada.org/inet/arbolado.nsf']:
    try:
        s, ct, b = get(u, t=30); txt = b[:3000].decode('utf8', 'replace')
        print('URL', u, s, ct, len(b))
        if 'package_search' in u:
            r = json.loads(b)['result']; print('  count', r['count']); [print('  PKG', p['name'], p['title'][:120], p.get('organization', {}).get('title')) for p in r['results']]
        else: print('  ', ' '.join(txt.split())[:600])
    except Exception as e: print('URL ERR', u, e)
# OSM: current trees in the municipality with all tags relevant to dimensions/species
q = '''[out:json][timeout:180];area["boundary"="administrative"]["admin_level"="8"]["name"="Granada"]["wikidata"="Q8810"]->.a;
(node["natural"="tree"](area.a);way["natural"="tree_row"](area.a););out tags geom qt;'''
for ep in ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']:
    try:
        s, ct, b = get(ep, data=urllib.parse.urlencode({'data': q}).encode(), t=200); j = json.loads(b)
        els = j['elements']; from collections import Counter; c = Counter(); sp = Counter()
        for e in els:
            for k in e.get('tags', {}): c[k] += 1
            t = e.get('tags', {}); sp[t.get('species') or t.get('genus') or t.get('species:es') or t.get('taxon') or '-'] += 1
        print('OSM', ep, j.get('osm3s', {}).get('timestamp_osm_base'), len(els)); print('TAGS', c.most_common(60)); print('SPECIES', sp.most_common(40))
        out = base64.b64encode(gzip.compress(b)).decode(); print('===FILE osm_trees.json==='); [print(out[i:i + 4000]) for i in range(0, len(out), 4000)]; print('===END===')
        break
    except Exception as e: print('OSM ERR', ep, e)
