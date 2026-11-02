"""Snapshot of the Wikipedia summaries for the historical explorer's places, in the interface languages.
For each Spanish article (js/history.js PLACES) the interlanguage links give the Arabic, Hebrew and English articles;
their REST summaries (extract, description, revision time, URL) are stored per language. A language without an article
is stored as missing — the page then shows the Spanish original, labelled as such. Text: Wikipedia, CC BY-SA 4.0.
Usage: python3 tools/build_history_places.py   (needs internet; writes data/ref/history_places.json)"""
import json, os, re, urllib.request, urllib.parse, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'js', 'history.js'), encoding='utf8').read()
titles = re.findall(r"\{ wiki: '([^']+)'", src[src.index('const PLACES'):src.index('];', src.index('const PLACES'))])
UA = {'User-Agent': 'granada-atlas/5.11 (https://github.com/ahmdklany6-ai/granada-atlas; studio research)'}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return json.load(r)
def summary(lang, title):
    j = get(f'https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title.replace(" ", "_"), safe="")}')
    return {'title': j.get('title'), 'extract': j.get('extract'), 'description': j.get('description') or '', 'url': (j.get('content_urls') or {}).get('desktop', {}).get('page'),
            'rev': j.get('timestamp'), 'thumb': (j.get('thumbnail') or {}).get('source'), 'll': [j['coordinates']['lon'], j['coordinates']['lat']] if j.get('coordinates') else None}
out = {'source': 'Wikipedia (es, ar, he, en) REST page summaries; languages linked through the Spanish article\'s interlanguage links', 'license': 'CC BY-SA 4.0 (Wikipedia contributors)',
       'retrieved': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'places': {}}
for t in titles:
    rec = {}
    try: rec['es'] = summary('es', t)
    except Exception as e: rec['es'] = None; print('ERR es', t, e)
    try:
        q = get('https://es.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks&lllimit=500&titles=' + urllib.parse.quote(t))
        ll = {x['lang']: x['*'] for p in q['query']['pages'].values() for x in p.get('langlinks', [])}
    except Exception as e: ll = {}; print('ERR langlinks', t, e)
    for lang in ['ar', 'he', 'en']:
        if lang in ll:
            try: rec[lang] = summary(lang, ll[lang])
            except Exception as e: rec[lang] = None; print('ERR', lang, t, e)
        else: rec[lang] = None
    out['places'][t] = rec; print(t, {k: (v['title'] if v else None) for k, v in rec.items()})
# translations for languages without an article (tools/history_translations.json, labelled as translations in the page)
tr = json.load(open(os.path.join(ROOT, 'tools', 'history_translations.json'), encoding='utf8')); out['translations'] = tr.get('_note')
for k, v in tr.items():
    if k in out['places']: out['places'][k]['tr'] = {l: x for l, x in v.items() if not out['places'][k].get(l)}
os.makedirs(os.path.join(ROOT, 'data', 'ref'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'data', 'ref', 'history_places.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
