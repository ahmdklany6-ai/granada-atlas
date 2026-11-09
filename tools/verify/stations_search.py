"""5.26 item 13 — evidence for the metro line 1 southern-extension stations, run on a CI runner (internet).
Prints, for each source: whether it loads, stop names found, links to plans / KMZ / GeoJSON / PDF, licence / reuse lines,
dates. Then asks OpenStreetMap (Overpass) what is mapped today along the extension (stops, platforms, the track and its
state). Nothing here guesses a position; it only reports what each source publishes. Output: job log only."""
import json, re, urllib.request, urllib.parse, html, datetime
UA = {'User-Agent': 'GranadaAtlas-research/1.0 (student project; open data check)'}
def get(u, t=40):
    r = urllib.request.Request(u, headers=UA)
    with urllib.request.urlopen(r, timeout=t) as f: return f.read(), f.headers.get('content-type', '')
print('checked', datetime.datetime.utcnow().isoformat() + 'Z', flush=True)
NAMES = ['San Cayetano', 'La Paz', 'Churriana', 'Arabuleila', 'La Gloria', 'Los Chopos', 'Estación de Tranvías', 'Las Gabias', 'Carretera de Alhama', 'San Ramón', 'Armilla']
PAGES = [
  'https://www.juntadeandalucia.es/organismos/aopja/areas/infraestructuras-ferroviarias/obras-prolongacion-granada.html',
  'https://infraestructurasymovilidad.aopandalucia.es/la-prolongacion-sur-del-metro-de-granada-en-imagenes/',
  'https://www.juntadeandalucia.es/organismos/fomentoarticulaciondelterritorioyvivienda/servicios/actualidad/noticias/detalle/390958.html',
  'https://www.juntadeandalucia.es/organismos/fomentoarticulaciondelterritorioyvivienda/servicios/actualidad/noticias/detalle/259323.html',
  'https://www.metropolitanogranada.es/',
  'https://www.elindependientedegranada.es/economia/comienzan-obras-segundo-tramo-prolongacion-sur-metro',
  'https://www.elindependientedegranada.es/economia/junta-saca-licitacion-tramo-churriana-gabias-prolongacion-sur-metro',
  'https://www.ahoragranada.com/noticias/la-ampliacion-por-las-gabias-aumentara-a-33-las-paradas-del-metro-de-granada/',
  'https://gralusa.com/metro-granada-las-gabias/',
  'https://en.wikipedia.org/wiki/Line_1_(Granada_Metro)',
  'https://es.wikipedia.org/wiki/L%C3%ADnea_1_del_Metro_de_Granada',
  'https://www.juntadeandalucia.es/datosabiertos/portal/busqueda.html?q=metro%20granada',
  'https://www.ideandalucia.es/catalogo/inspire/srv/spa/q?any=metro%20granada&_content_type=json',
]
for u in PAGES:
    print('\n=== ' + u, flush=True)
    try: b, ct = get(u)
    except Exception as e: print('  NOT LOADED:', str(e)[:160]); continue
    tx = b.decode('utf-8', 'ignore'); plain = html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>', ' ', tx))); plain = re.sub(r'\s+', ' ', plain)
    print('  loaded', len(b), 'bytes', ct[:40])
    for n in NAMES:
        hits = [m.start() for m in re.finditer(re.escape(n), plain)][:2]
        for h in hits: print(f'  [{n}] …{plain[max(0, h - 120):h + 160]}…')
    for m in re.finditer(r'href="([^"]+\.(?:pdf|kmz|kml|geojson|json|zip|shp|dwg|gpx)[^"]*)"', tx, re.I): print('  FILE', urllib.parse.urljoin(u, m.group(1))[:200])
    for kw in ['licencia', 'Licencia', 'CC BY', 'Creative Commons', 'reutiliz', 'Reutiliz', 'aviso legal', 'Aviso legal', 'copyright', '©']:
        i = plain.find(kw)
        if i >= 0: print(f'  LICENCE[{kw}] …{plain[max(0, i - 80):i + 200]}…')
    for m in re.finditer(r'\b(20[12]\d)\b[^.]{0,80}(inaugur|puesta en servicio|apertura|finaliz|abrir)', plain): print('  DATE …' + plain[max(0, m.start() - 80):m.end() + 80] + '…')
# ---------- OpenStreetMap today ----------
q = """[out:json][timeout:90];
(node["railway"~"^(station|halt|tram_stop|stop|platform)$"](37.110,-3.680,37.155,-3.600);
 node["public_transport"~"^(stop_position|platform|station)$"]["light_rail"="yes"](37.110,-3.680,37.155,-3.600);
 node["public_transport"~"^(stop_position|platform|station)$"]["tram"="yes"](37.110,-3.680,37.155,-3.600);
 node["construction:railway"](37.110,-3.680,37.155,-3.600);
 way["railway"~"light_rail|tram|construction|proposed"](37.110,-3.680,37.155,-3.600);
 way["construction"~"light_rail|tram"](37.110,-3.680,37.155,-3.600);
 way["public_transport"="platform"](37.110,-3.680,37.155,-3.600););
out tags center;"""
for ep in ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']:
    try:
        b, _ = get(ep + '?data=' + urllib.parse.quote(q), 120); d = json.loads(b); print('\n=== OSM via', ep, 'osm_base', d.get('osm3s', {}).get('timestamp_osm_base'))
        for e in d['elements']:
            c = e.get('center') or {'lat': e.get('lat'), 'lon': e.get('lon')}; tg = e.get('tags', {})
            print(f"  {e['type']} {e['id']} {c.get('lat')},{c.get('lon')} " + json.dumps({k: tg[k] for k in tg if k in ('name', 'railway', 'construction', 'construction:railway', 'public_transport', 'light_rail', 'tram', 'operator', 'opening_date', 'start_date', 'note', 'source')}, ensure_ascii=False))
        break
    except Exception as ex: print('overpass', ep, ex)
print('\nDONE', flush=True)
