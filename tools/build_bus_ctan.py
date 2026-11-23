"""Build 5.50 — scheduled metropolitan buses (Consorcio de Transporte Metropolitano del Área de Granada) outside the city.
The stop-level service file supplied by the owner (granada_bus_frequency_2026-10-26.geojson) covers the Granada urban
lines only, so every study area south of the city (the air base, Armilla, Las Gabias) reported "0 stops". The consortium
publishes its lines, stops and timetables through the open CTAN API (api.ctan.es, Red de Consorcios de Transporte de
Andalucía; read on the GitHub runner by tools/verify/basefill_fetch.py, 23 Nov 2026).
Method, for the SAME service date as the supplied file (Monday 26 Oct 2026):
 - the timetable valid that day (planificador with fechaInicio ≤ date ≤ fechaFin, open end allowed); a trip runs that day
   when its "frecuencia" mask has L (Monday) in first position;
 - the timetable gives times per timing point (town / place blocks), not per stop: a trip counts at a stop when it has a
   time at a block that names the stop's place (núcleo) or municipality; a stop whose place is not named in any block of
   its line counts every trip of that direction (marked approx = 1);
 - trips_day = trips over all lines at the stop; trips_7_9 = those whose time at the matched block is 07:00–08:59;
   routes = line codes; service_level from the supplied file's classes (data/manifest.json bus_service.stats.levelRanges).
Only stops OUTSIDE the Granada municipality are added (inside it the supplied urban file stays as it is); src = "ctan".
Usage: python3 tools/build_bus_ctan.py raw_dir"""
import json, os, re, sys, unicodedata
from shapely.geometry import shape, Point
from shapely.prepared import prep
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RAW = sys.argv[1]; DATE = '2026-10-26'
J = lambda n: json.load(open(os.path.join(RAW, n)))
norm = lambda s: re.sub(r'[^a-z0-9 ]', ' ', unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()).split()
stops = {p['idParada']: p for p in J('ctan_paradas.json')['paradas']}
full = J('ctan_lineas_full.json')['lines']
def tmin(h):
    m = re.match(r'^(\d{1,2}):(\d{2})', h or ''); return int(m.group(1)) * 60 + int(m.group(2)) if m else None
agg = {}  # idParada → {trips, t79, routes, approx}
for lid, v in full.items():
    ln = v['line']; code = ln.get('codigo') or lid
    plans = [p for p in ((v.get('horarios') or {}).get('planificadores') or []) if (p.get('fechaInicio') or '0') <= DATE and (not p.get('fechaFin') or p['fechaFin'] >= DATE)]
    if not plans: continue
    pl = plans[-1]
    for sent, bk, hk in (('1', 'bloquesIda', 'horarioIda'), ('2', 'bloquesVuelta', 'horarioVuelta')):
        blocks = [b['nombre'] for b in (pl.get(bk) or []) if str(b.get('tipo')) == '0']
        rows = [r for r in (pl.get(hk) or []) if (r.get('frecuencia') or '')[:1] == 'L']
        lstops = [s for s in ((v.get('paradas') or {}).get('paradas') or []) if str(s.get('sentido')) == sent]
        for s in lstops:
            m = stops.get(s['idParada'], {}); names = set(norm(m.get('nucleo'))) | set(norm(m.get('municipio')))
            idx = [i for i, b in enumerate(blocks) if names and set(norm(b.split('(')[0])) & names]
            a = agg.setdefault(s['idParada'], {'trips': 0, 't79': 0, 'routes': set(), 'approx': 0})
            for r in rows:
                hs = r.get('horas') or []
                if idx:
                    ts = [tmin(hs[i]) for i in idx if i < len(hs) and tmin(hs[i]) is not None]
                    if not ts: continue
                else:
                    ts = [t for t in (tmin(h) for h in hs) if t is not None]; a['approx'] = 1
                    if not ts: continue
                a['trips'] += 1; a['routes'].add(code)
                if 420 <= ts[0] < 540: a['t79'] += 1
M = json.load(open(os.path.join(ROOT, 'data/manifest.json'))); BS = M['layers']['bus_service']; LR = BS['stats']['levelRanges']
def level(n):
    if n <= 0: return 'No scheduled service'
    for k, (lo, hi) in LR.items():
        if k != 'No scheduled service' and lo <= n <= hi: return k
    return 'High' if n > LR['High'][0] else 'Low'
muni = prep(shape(next(f for f in json.load(open(os.path.join(ROOT, 'data/vec/admin.json')))['features'] if f['properties'].get('kind') == 'municipio')['geometry']))
P = os.path.join(ROOT, 'data/vec/bus_service.json'); cur = json.load(open(P)); base = [f for f in cur['features'] if f['properties'].get('src') != 'ctan']
add = []
for sid, s in stops.items():
    try: lon, lat = float(s['longitud']), float(s['latitud'])
    except (TypeError, ValueError): continue
    if not (-3.75 <= lon <= -3.46 and 37.06 <= lat <= 37.27) or muni.contains(Point(lon, lat)): continue
    a = agg.get(sid, {'trips': 0, 't79': 0, 'routes': set(), 'approx': 0})
    add.append({'type': 'Feature', 'properties': {'stop_id': 'ctan:' + sid, 'stop_code': sid, 'stop_name': s.get('nombre'), 'trips_day': a['trips'], 'trips_7_9': a['t79'],
        'routes_count': len(a['routes']), 'routes': ', '.join(sorted(a['routes'])), 'service_level': level(a['trips']), 'service_date': DATE, 'in': 0, 'src': 'ctan',
        'municipio': s.get('municipio'), 'nucleo': s.get('nucleo'), **({'approx': 1} if a['approx'] else {})}, 'geometry': {'type': 'Point', 'coordinates': [round(lon, 6), round(lat, 6)]}})
feats = base + add
json.dump({'type': 'FeatureCollection', 'features': feats}, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
BS.update({'features': len(feats), 'bytes': os.path.getsize(P), 'coverage': [-3.75, 37.06, -3.46, 37.27],
  'source': BS['source'].split(' + ')[0] + ' + outside the Granada municipality: Consorcio de Transporte Metropolitano del Área de Granada, lines, stops and timetables from the open CTAN API (api.ctan.es), read 2026-11-23 (src = ctan)',
  'added_5_50': {'stops': len(add), 'served': sum(1 for f in add if f['properties']['trips_day'] > 0), 'approx': sum(1 for f in add if f['properties'].get('approx')), 'tool': 'tools/build_bus_ctan.py',
                 'method': 'timetable valid on 2026-10-26 (Monday); a trip counts at a stop when it has a time at a block naming the stop\'s place or municipality; otherwise every trip of that direction (approx = 1)'}})
open(os.path.join(ROOT, 'data/manifest.json'), 'w').write(json.dumps(M, ensure_ascii=False, separators=(',', ':')))
print('bus: kept', len(base), 'added', len(add), BS['added_5_50'])
B = (-3.669, 37.1098, -3.618, 37.1502)
inb = [f['properties'] for f in add if B[0] < f['geometry']['coordinates'][0] < B[2] and B[1] < f['geometry']['coordinates'][1] < B[3]]
print('Base square: stops', len(inb), 'served', sum(1 for p in inb if p['trips_day']), 'max', max([p['trips_day'] for p in inb] or [0]), sorted(inb, key=lambda p: -p['trips_day'])[:3])
