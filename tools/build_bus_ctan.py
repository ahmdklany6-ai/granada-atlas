"""Scheduled metropolitan buses (Consorcio de Transporte Metropolitano del Área de Granada) outside the city of Granada.
Build 5.50 added them; build 5.51 rebuilt them after a review found three faults (see "5.51" below).

The stop-level service file supplied by the owner (granada_bus_frequency_2026-10-26.geojson) covers the Granada urban
lines only, so every study area south of the city (the air base, Armilla, Las Gabias) reported "0 stops". The consortium
publishes its lines, each line's stops and its timetables through the open CTAN API (api.ctan.es, Red de Consorcios de
Transporte de Andalucía, consortium 3; read on the GitHub runner by tools/verify/basefill_fetch.py on 23 Nov 2026).

WHAT THE SOURCE GIVES, AND WHAT IS INFERRED
 - A line has an ordered list of stops per direction and a timetable per direction. The timetable gives each trip's
   times at a few TIMING POINTS (towns, or named stops) — never at every stop. "--" at a timing point = the trip does not
   call there. So departures per stop are INFERRED from the timing points; they are not published by the consortium.
 - A timing point is placed on the line's stop sequence: by the name of a place (núcleo), of a municipality, or of a stop
   (accents, case and Spanish stop-words ignored; "Town (detail)" is first looked for as a stop of that town).
 - A trip counts at a stop when (a) a timing point that covers the stop has a time (the most specific one: stop, then
   place, then municipality), or, where no timing point covers the stop, (b) the nearest timing points before AND after it
   on the sequence both have a time (stop flagged approx = 1). A stop on a line where no timing point could be placed
   counts every trip of that direction (also approx = 1).
 - Service day: Monday 26 Oct 2026, the date of the supplied city file. A trip runs when its frequency mask starts with
   "L" (LMXJV---, LMXJVSDF, …) and its note does not restrict it to other days ("sólo viernes, sábados y vísperas").
   The timetable used is the one valid on that date; for a line whose timetable changed afterwards (the API serves only
   current ones) the timetable in force when read is used and the line is listed in the manifest.
 - trips_day = trips over all lines and both directions at the stop; trips_7_9 = those timed 07:00–08:59 at the timing
   point used; routes = line codes; service_level = the supplied file's classes (manifest bus_service.stats.levelRanges).

5.51 (review of 5.50):
 1. Stops come from the union of the lines' own stop lists (1,325) — the API's general stop list (851) leaves out most
    stops of the return direction, so 5.50 published only about half of the stops.
 2. Timing points were matched to a stop's town by shared words, including stop-words ("de", "la"), which could count
    a trip at the wrong town's timing point. Matching is now by whole names, and position on the sequence.
 3. Five lines whose only timetable starts after 26 Oct 2026 were dropped silently; trips noted "only Fridays,
    Saturdays and eves of holidays" were counted on a Monday.
Only stops OUTSIDE the Granada municipality are added (inside it the supplied city file stays as it is, so the
metropolitan lines' stops inside the city are NOT in the layer — stated in the manifest); src = "ctan".
Usage: python3 tools/build_bus_ctan.py raw_dir [--diag]"""
import json, math, os, re, sys, unicodedata
from collections import Counter, defaultdict
from shapely.geometry import shape, Point
from shapely.prepared import prep
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RAW = sys.argv[1]; DIAG = '--diag' in sys.argv
DATE = '2026-10-26'   # service date of the supplied city file (a Monday)
READ = '2026-11-23'   # the day the API was read
BBOX = (-3.75, 37.06, -3.46, 37.27)
J = lambda n: json.load(open(os.path.join(RAW, n), encoding='utf-8'))
STOPW = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'a', 'al', 'en'}
ABBR = {'avenida': 'avda', 'av': 'avda', 'avd': 'avda', 'plaza': 'pza', 'pl': 'pza', 'carretera': 'ctra', 'urbanizacion': 'urb', 'poligono': 'pol', 'polig': 'pol',
        'camino': 'cno', 'calle': '', 'c': '', 'sta': 'santa', 'sto': 'santo'}
def toks(s):
    s = re.sub(r'(?<=[a-zñáéíóú])(?=[A-ZÑÁÉÍÓÚ])', ' ', str(s or ''))   # "LaZubia" → "La Zubia"
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    out = []
    for t in re.sub(r'[^a-z0-9]+', ' ', s).split():
        t = ABBR.get(t, t)
        if t and t not in STOPW: out.append(t)
    return frozenset(out)
def teq(a, b):
    """Two words are the same, or one abbreviates the other ("prof" ~ "profesor", "polideport" ~ "polideportivo")."""
    return a == b or (len(a) >= 4 and b.startswith(a)) or (len(b) >= 4 and a.startswith(b))
def sub(A, B):
    """Every word of A has a counterpart in B."""
    return bool(A) and all(any(teq(a, b) for b in B) for a in A)
def same(A, B): return sub(A, B) and sub(B, A)
def glue(T): return ''.join(sorted(T))
STREET = re.compile(r'^\s*(c/|avda\b|av\b|pza\b|plaza\b|paseo\b|ctra\b|cno\b|rotonda\b|glorieta\b)', re.I)   # a street-type name is a stop, never a town
def tmin(h):
    m = re.match(r'^\s*(\d{1,2})[:.](\d{2})', h or ''); return int(m.group(1)) * 60 + int(m.group(2)) if m else None
def dist_m(a, b): return math.hypot((a[0] - b[0]) * 88800, (a[1] - b[1]) * 111000)

G = {p['idParada']: p for p in J('ctan_paradas.json')['paradas']}          # general stop list: has the place (núcleo) name
MUN = {m['idMunicipio']: m['datos'] for m in J('ctan_municipios.json')['municipios']}
full = J('ctan_lineas_full.json')['lines']
gl = [(float(p['longitud']), float(p['latitud']), p.get('idMunicipio'), p.get('nucleo')) for p in G.values() if p.get('nucleo') and p.get('latitud')]
def place_of(sid, lon, lat, mun):
    """The stop's place (núcleo): from the general list; else that of the nearest listed stop of the same municipality within 400 m."""
    if sid in G and G[sid].get('nucleo'): return G[sid]['nucleo'], False
    best = None
    for x, y, m, n in gl:
        d = dist_m((lon, lat), (x, y))
        if d <= (400 if m == mun else 250) and (best is None or d < best[0]): best = (d, n)
    return (best[1], True) if best else (None, False)

# ---------- the stops of every line, per direction ----------
U = {}  # idParada → {name, lon, lat, mun, munName, nuc}
def stop_rec(s):
    sid = s['idParada']
    if sid not in U:
        try: lon, lat = float(s['longitud']), float(s['latitud'])
        except (TypeError, ValueError): return None
        mun = s.get('idNucleo')  # in a line's stop list this field holds the municipality (INE) code — checked against the general list: 749 of 749
        nuc, inherited = place_of(sid, lon, lat, mun)
        U[sid] = {'id': sid, 'name': s.get('nombre') or '', 'lon': lon, 'lat': lat, 'mun': mun, 'munName': MUN.get(mun), 'nuc': nuc, 'nucInherited': inherited, 'tk': toks(s.get('nombre'))}
    return U[sid]

def place_blocks(blocks, seq):
    """Each timing point → {name, level ('stop' | 'nucleo' | 'mun' | None), pos (indices on the sequence), lo, hi}."""
    mun_idx, nuc_idx = defaultdict(set), defaultdict(set)
    for i, s in enumerate(seq):
        if s['munName']: mun_idx[toks(s['munName'])].add(i)
        if s['nuc']: nuc_idx[toks(s['nuc'])].add(i)
    def town_of(tb):
        """A place (first) or municipality on this line named like tb: same words, glued forms ("Lomalinda" ~ "Loma Linda"), or one name inside the other."""
        if not tb: return None
        for lv, idx in (('nucleo', nuc_idx), ('mun', mun_idx)):
            for k, v in idx.items():
                if same(tb, k) or glue(tb) == glue(k): return (lv, v)
        g = ''.join(sorted(tb, key=len, reverse=True))
        cands = []
        for lv, idx in (('nucleo', nuc_idx), ('mun', mun_idx)):
            for k, v in idx.items():
                if sub(tb, k) or sub(k, tb): cands.append((len(tb & k) / len(tb | k), lv == 'nucleo', lv, v))
                elif len(tb) == 1 and len(g) >= 6 and g in ''.join(k): cands.append((0.5, lv == 'nucleo', lv, v))   # "lomalinda" inside "urb" + "loma" + "linda" (glued, in order)
        if cands: c = max(cands, key=lambda c: (c[0], c[1])); return (c[2], c[3])
        return None
    def stops_like(td, among):
        """Stops (indices in `among`) named like td: same words; else td inside the stop's name or the stop's name inside td (short generic names excluded)."""
        if not td: return set()
        c = {i for i in among if same(td, seq[i]['tk'])}
        if not c and not any(t.isdigit() for t in td): c = {i for i in among if same(td, frozenset(t for t in seq[i]['tk'] if not t.isdigit()))}   # numbered twins "… 1", "… 2"
        if not c: c = {i for i in among if sub(td, seq[i]['tk']) and (len(td) >= 2 or len(max(td, key=len)) >= 7)}
        if not c: c = {i for i in among if sub(seq[i]['tk'], td) and (len(seq[i]['tk']) >= 2 or len(max(seq[i]['tk'], key=len)) >= 6)}
        return c
    allidx = set(range(len(seq))); out = []
    for b in blocks:
        raw = b.strip(); m = re.match(r'^(.*?)\s*\((.*?)\)\s*$', raw)
        if m: base, detail = m.group(1), m.group(2)
        elif '-' in raw and not raw.endswith('-') and not STREET.match(raw): base, detail = raw.split('-', 1)   # "LaZubia-ParqueEncina", "Zuj-Iglesia"
        else: base, detail = raw, None
        hit = None; street = bool(STREET.match(raw))
        town = None if street else town_of(toks(base))
        if town is None and detail and not m and not street:   # "Zuj-Iglesia": an abbreviated town; "Casanueva-Zujaira": two towns → try the whole name
            t3 = [(lv, v) for lv, idx in (('nucleo', nuc_idx), ('mun', mun_idx)) for k, v in idx.items() if any(len(x) >= 3 and y.startswith(x) for x in toks(base) for y in k)]
            town = t3[0] if len(t3) == 1 else town_of(toks(raw.replace('-', ' ')))
            if town and len(t3) != 1: detail = None
        if detail and town:
            c = stops_like(toks(detail), town[1])
            if c: hit = ('stop', c)
            else:   # "Ogíjares (Loma Linda)": the detail is itself a place of that municipality
                t2 = town_of(toks(detail))
                if t2 and t2[0] == 'nucleo': hit = t2
        if not hit and town: hit = town
        if not hit:
            c = stops_like(toks(raw if not m else base), allidx)
            if c: hit = ('stop', c)
        out.append({'name': b, 'level': hit[0] if hit else None, 'pos': set(hit[1]) if hit else set(), 'lo': min(hit[1]) if hit else None, 'hi': max(hit[1]) if hit else None})
    return out
PR = {'stop': 0, 'nucleo': 1, 'mun': 2}
def serves(i, blk, timed):
    """(minute of the timing point used, inferred?) or (None, inferred?) when the trip does not call at stop i."""
    cov = [j for j, b in enumerate(blk) if b['level'] and i in b['pos']]
    if cov:
        best = min(PR[blk[j]['level']] for j in cov); ts = [timed[j] for j in cov if PR[blk[j]['level']] == best and timed[j] is not None]
        return (ts[0] if ts else None), False
    before = [j for j, b in enumerate(blk) if b['level'] and b['hi'] < i]; after = [j for j, b in enumerate(blk) if b['level'] and b['lo'] > i]
    if not before and not after:
        ts = [t for t in timed if t is not None]; return (ts[0] if ts else None), True
    pj = max(before, key=lambda j: blk[j]['hi']) if before else None; nj = min(after, key=lambda j: blk[j]['lo']) if after else None
    if (pj is not None and timed[pj] is None) or (nj is not None and timed[nj] is None): return None, True
    return (timed[pj] if pj is not None else timed[nj]), True
def restricted(row):
    """True when the row's note keeps it off a normal Monday ("sólo viernes, sábados y previo festivos" on an LMXJV row)."""
    o = row.get('observaciones') or ''
    if not o.strip(): return False
    mask = row.get('frecuencia') or ''
    parts = [p for p in re.split(r'(?<=\))\s*,', o)]   # "note (MASK),note (MASK)": keep the notes for this row's mask, or untagged ones
    mine = []
    for p in parts:
        m = re.search(r'\(([LMXJVSDFP-]{8})\)\s*$', p.strip())
        if not m or m.group(1) == mask: mine.append(p)
    t = ' '.join(unicodedata.normalize('NFKD', p).encode('ascii', 'ignore').decode().lower() for p in mine)
    return bool(re.search(r'viernes\s*,?\s*(y\s+)?sabados?', t)) and bool(re.search(r'solo|previo|pervio|vispera|no festivos', t)) and 'lunes' not in t

agg = {}; diag = {'lines': 0, 'later_tt': [], 'no_tt': [], 'unplaced': Counter(), 'placed': Counter(), 'rows_monday': 0, 'rows_restricted': 0, 'combo_cov': 0, 'combo_interp': 0, 'combo_none': 0, 'dup_plans': 0}
for lid, v in full.items():
    ln = v['line']; code = ln.get('codigo') or lid
    pls = (v.get('horarios') or {}).get('planificadores') or []; seen = set(); uniq = []
    for p in pls:
        if p.get('idPlani') in seen: diag['dup_plans'] += 1; continue
        seen.add(p.get('idPlani')); uniq.append(p)
    valid = lambda d: [p for p in uniq if (p.get('fechaInicio') or '0') <= d and (not p.get('fechaFin') or p['fechaFin'] >= d)]
    plans = valid(DATE); later = False
    if not plans:
        plans = valid(READ); later = bool(plans)
        if later: diag['later_tt'].append({'code': code, 'name': ln.get('nombre'), 'from': max(p.get('fechaInicio') or '' for p in plans)})
        else: diag['no_tt'].append({'code': code, 'name': ln.get('nombre')})
    if not plans: continue
    pl = max(plans, key=lambda p: p.get('fechaInicio') or ''); diag['lines'] += 1
    for sent, bk, hk in (('1', 'bloquesIda', 'horarioIda'), ('2', 'bloquesVuelta', 'horarioVuelta')):
        blocks = [b['nombre'] for b in (pl.get(bk) or []) if str(b.get('tipo')) == '0']
        raw = sorted([s for s in ((v.get('paradas') or {}).get('paradas') or []) if str(s.get('sentido')) == sent], key=lambda s: int(s.get('orden') or 0))
        seq = [r for r in (stop_rec(s) for s in raw) if r]
        if not seq: continue
        blk = place_blocks(blocks, seq)
        for b in blk: diag['placed' if b['level'] else 'unplaced'][b['name'].strip()] += 1
        rows = []
        for r in (pl.get(hk) or []):
            if (r.get('frecuencia') or '')[:1] != 'L': continue
            diag['rows_monday'] += 1
            if restricted(r): diag['rows_restricted'] += 1; continue
            hs = r.get('horas') or []
            rows.append([tmin(hs[j]) if j < len(hs) else None for j in range(len(blocks))])
        done = set()
        for i, s in enumerate(seq):
            if s['id'] in done: continue   # a loop that passes the same stop twice: one call per trip
            done.add(s['id'])
            a = agg.setdefault(s['id'], {'trips': 0, 't79': 0, 'routes': set(), 'approx': 0, 'later': 0})
            cov = any(b['level'] and i in b['pos'] for b in blk); anyb = any(b['level'] for b in blk)
            diag['combo_cov' if cov else 'combo_interp' if anyb else 'combo_none'] += 1
            for timed in rows:
                t, inferred = serves(i, blk, timed)
                if t is None: continue
                a['trips'] += 1; a['routes'].add(code)
                if 420 <= t < 540: a['t79'] += 1
                if inferred: a['approx'] = 1
                if later: a['later'] = 1

M = json.load(open(os.path.join(ROOT, 'data/manifest.json'))); BS = M['layers']['bus_service']; LR = BS['stats']['levelRanges']
def level(n):
    if n <= 0: return 'No scheduled service'
    for k, (lo, hi) in LR.items():
        if k != 'No scheduled service' and lo <= n <= hi: return k
    return 'High' if n > LR['High'][0] else 'Low'
muni = prep(shape(next(f for f in json.load(open(os.path.join(ROOT, 'data/vec/admin.json')))['features'] if f['properties'].get('kind') == 'municipio')['geometry']))
P = os.path.join(ROOT, 'data/vec/bus_service.json'); cur = json.load(open(P)); base = [f for f in cur['features'] if f['properties'].get('src') != 'ctan']
add = []; inside = 0; outbox = 0
for sid, s in sorted(U.items(), key=lambda kv: int(kv[0]) if kv[0].isdigit() else 0):
    if not (BBOX[0] <= s['lon'] <= BBOX[2] and BBOX[1] <= s['lat'] <= BBOX[3]): outbox += 1; continue
    if muni.contains(Point(s['lon'], s['lat'])): inside += 1; continue
    a = agg.get(sid, {'trips': 0, 't79': 0, 'routes': set(), 'approx': 0, 'later': 0})
    pr = {'stop_id': 'ctan:' + sid, 'stop_code': sid, 'stop_name': s['name'], 'trips_day': a['trips'], 'trips_7_9': a['t79'], 'routes_count': len(a['routes']), 'routes': ', '.join(sorted(a['routes'])),
          'service_level': level(a['trips']), 'service_date': DATE, 'in': 0, 'src': 'ctan', 'municipio': s['munName']}
    if s['nuc']: pr['nucleo'] = s['nuc']
    if a['approx']: pr['approx'] = 1
    add.append({'type': 'Feature', 'properties': pr, 'geometry': {'type': 'Point', 'coordinates': [round(s['lon'], 6), round(s['lat'], 6)]}})
unlisted = sum(1 for k, p in G.items() if k not in U and p.get('latitud') and BBOX[0] <= float(p['longitud']) <= BBOX[2] and BBOX[1] <= float(p['latitud']) <= BBOX[3] and not muni.contains(Point(float(p['longitud']), float(p['latitud']))))
feats = base + add
summary = {'stops': len(add), 'served': sum(1 for f in add if f['properties']['trips_day'] > 0), 'approx': sum(1 for f in add if f['properties'].get('approx')),
           'lines': diag['lines'], 'tool': 'tools/build_bus_ctan.py', 'read': READ,
           'method': 'The consortium publishes each trip\'s times at timing points (towns or named stops), not at every stop: departures per stop are inferred. A trip counts at a stop when a timing point covering the stop (the stop itself, its place, else its municipality) has a time, or — where none covers it — when the nearest timing points before and after it on the line both have a time (approx = 1). Monday 26 Oct 2026: frequency masks starting with L, minus trips noted as Friday / Saturday / eve-of-holiday only.',
           'later_timetable': diag['later_tt'], 'without_timetable': diag['no_tt'], 'trips_monday': diag['rows_monday'] - diag['rows_restricted'], 'trips_excluded_fri_sat_only': diag['rows_restricted'],
           'limitations': ['%d stops of these lines lie inside the Granada municipality and are NOT in the layer: inside the city only the supplied file (urban lines) is shown, so metropolitan departures in the city are missing.' % inside,
                           '%d stops in the consortium\'s general list are on no current line and are left out.' % unlisted,
                           'Timing points that could not be placed on a line\'s stop sequence: %d of %d (their lines fall back to the neighbouring timing points).' % (sum(diag['unplaced'].values()), sum(diag['unplaced'].values()) + sum(diag['placed'].values()))]}
if DIAG:
    print(json.dumps({k: (v if not isinstance(v, Counter) else dict(v.most_common(60))) for k, v in diag.items() if k != 'placed'}, ensure_ascii=False, indent=1))
    B = (-3.669, 37.1098, -3.618, 37.1502)
    inb = [f['properties'] for f in add if B[0] < f['geometry']['coordinates'][0] < B[2] and B[1] < f['geometry']['coordinates'][1] < B[3]]
    print('Base square: stops', len(inb), 'served', sum(1 for p in inb if p['trips_day']), 'approx', sum(1 for p in inb if p.get('approx')), 'max', max([p['trips_day'] for p in inb] or [0]))
    for p in sorted(inb, key=lambda p: -p['trips_day'])[:12]: print('  ', p['stop_name'], p['trips_day'], p['trips_7_9'], p['routes'], p.get('nucleo'), 'approx' if p.get('approx') else '')
    print(json.dumps({k: v for k, v in summary.items() if k != 'method'}, ensure_ascii=False, indent=1)); sys.exit(0)
json.dump({'type': 'FeatureCollection', 'features': feats}, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
src0 = BS['source'].split(' + ')[0]
BS.update({'features': len(feats), 'bytes': os.path.getsize(P), 'coverage': list(BBOX),
           'source': src0 + ' + outside the Granada municipality: Consorcio de Transporte Metropolitano del Área de Granada — lines, their stops and timetables from the open CTAN API (api.ctan.es), read %s (src = ctan)' % READ})
BS.pop('added_5_50', None); BS['ctan'] = summary
BS['fields'].update({'src': '"ctan" = metropolitan consortium stop (outside the municipality); absent = the supplied city file', 'approx': '1 = departures inferred from the neighbouring timing points (ctan only)', 'municipio': 'municipality (ctan only)', 'nucleo': 'place within the municipality (ctan only, where known)'})
open(os.path.join(ROOT, 'data/manifest.json'), 'w').write(json.dumps(M, ensure_ascii=False, separators=(',', ':')))
print('bus: kept', len(base), 'added', len(add), {k: v for k, v in summary.items() if k not in ('method', 'limitations')})
