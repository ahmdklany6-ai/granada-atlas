# Build the three "southern axis" layers (build 5.20) into data/vec/:
#   south_metro.json   — the southern extension of metro line 1 (Armilla → Churriana de la Vega → Las Gabias), as mapped
#                        in OpenStreetMap while under construction (railway=construction, construction=light_rail)
#   tram_1931.json     — the Granada–Gabia branch of the old electric tram, traced by hand from the IGN 1:50,000 map,
#                        first edition, sheet 1026 Padul (1931), where it is drawn and labelled "Tranvía de Granada a Gabia"
#   escuzar_pole.json  — the CITAI industrial and technology estate at Escúzar with the IFMIF-DONES site, the Lidl
#                        distribution centre, the Amazon delivery station and the Knauf plant (OSM polygons) and the village
# Usage: python3 tools/build_south_axis.py      (reads the OpenStreetMap API; needs api.openstreetmap.org)
import json, math, os, sys, urllib.request, xml.etree.ElementTree as ET
from datetime import date

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'data', 'vec')
API = 'https://api.openstreetmap.org/api/0.6/'
UA = {'User-Agent': 'granada-atlas build_south_axis.py (student project)'}

def osm_way(wid):
    """way geometry ([lon, lat] list) and tags, read from the OSM API way/<id>/full"""
    with urllib.request.urlopen(urllib.request.Request(API + 'way/%s/full' % wid, headers=UA), timeout=60) as r:
        root = ET.fromstring(r.read())
    nodes = {n.get('id'): (float(n.get('lon')), float(n.get('lat'))) for n in root.iter('node')}
    w = root.find('way')
    coords = [list(nodes[nd.get('ref')]) for nd in w.iter('nd')]
    return [[round(x, 6), round(y, 6)] for x, y in coords], {t.get('k'): t.get('v') for t in w.iter('tag')}

def osm_node(nid):
    with urllib.request.urlopen(urllib.request.Request(API + 'node/%s' % nid, headers=UA), timeout=60) as r:
        n = ET.fromstring(r.read()).find('node')
    return [round(float(n.get('lon')), 6), round(float(n.get('lat')), 6)], {t.get('k'): t.get('v') for t in n.iter('tag')}

KX = 111320 * math.cos(math.radians(37.12)); KY = 110540
def length_m(c): return sum(math.hypot((c[i + 1][0] - c[i][0]) * KX, (c[i + 1][1] - c[i][1]) * KY) for i in range(len(c) - 1))
def area_ha(ring):
    xy = [(x * KX, y * KY) for x, y in ring]
    return abs(sum(xy[i][0] * xy[i - 1][1] - xy[i - 1][0] * xy[i][1] for i in range(len(xy)))) / 2 / 1e4
def F(geom, **p): return {'type': 'Feature', 'properties': p, 'geometry': geom}
def save(name, fc):
    with open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8') as f: json.dump(fc, f, ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(os.path.join(OUT, name + '.json'))

today = date.today().isoformat()

# ---------- 1. metro south extension ----------
# one track of the double line, in running order Armilla → La Gloria → junction → Las Gabias terminus
SEQ = ['1021753426', '1537504102', '1537508821']
line = []
for wid in SEQ:
    c, tg = osm_way(wid)
    assert tg.get('railway') == 'construction' and tg.get('construction') == 'light_rail', (wid, tg)
    if line:
        assert math.hypot((line[-1][0] - c[0][0]) * KX, (line[-1][1] - c[0][1]) * KY) < 5, 'ways do not join: ' + wid
        c = c[1:]
    line += c
L = length_m(line)
assert 4400 < L < 5000, L  # the Junta de Andalucía gives 4.6–4.7 km
armilla, _ = osm_node('12847119977')  # railway=station "Armilla" (current end of line 1)
metro = {'type': 'FeatureCollection', 'features': [
    F({'type': 'LineString', 'coordinates': line}, k='track', len_m=round(L), osm=','.join(SEQ)),
    F({'type': 'Point', 'coordinates': armilla}, k='station_now', nm='Armilla', osm='node 12847119977'),
    F({'type': 'Point', 'coordinates': line[-1]}, k='terminus', nm='Las Gabias', osm='end of way 1537508821'),
]}

# ---------- 2. tram 1931 (hand trace, see header) ----------
# Traced on the 1931 sheet, then moved onto modern imagery with an affine fit on four town centres (Churriana de la Vega,
# Gabia la Grande, Armilla, Cúllar Vega; residuals 6–67 m). Positional uncertainty about ±100 m: a regional line, not a survey.
TRAM = [[-3.63011, 37.13999], [-3.64676, 37.14439], [-3.657, 37.14711], [-3.66043, 37.14502], [-3.66403, 37.14266], [-3.66751, 37.14], [-3.66754, 37.13829], [-3.66713, 37.13657]]
TRUNK = [[-3.62426, 37.14732], [-3.6256, 37.14563], [-3.63011, 37.13999], [-3.63199, 37.13446]]  # Granada–Armilla–Alhendín line, only the stretch on this sheet's crop
tram = {'type': 'FeatureCollection', 'features': [
    F({'type': 'LineString', 'coordinates': TRAM}, k='gabia', len_m=round(length_m(TRAM))),
    F({'type': 'LineString', 'coordinates': TRUNK}, k='trunk'),
    F({'type': 'Point', 'coordinates': [-3.65382, 37.14392]}, k='station', nm='Churriana', lbl='Estación'),
    F({'type': 'Point', 'coordinates': [-3.66713, 37.13657]}, k='station', nm='Gabia la Grande', lbl='Estón'),
]}

# ---------- 3. Escúzar pole ----------
SITES = [  # (OSM way, kind, label, opened, jobs, investment) — figures as published by the operator / government; jobs '' = not published
    ('130738309', 'estate', 'CITAI – Parque Metropolitano Industrial y Tecnológico', '', '', ''),
    ('1122582252', 'science', 'IFMIF-DONES (UGR-DONES building)', 'main building under construction since Sept 2026', '~80 now, >100 expected end 2026', '~€730 M (construction + commissioning)'),
    ('1204505937', 'logistics', 'Lidl distribution centre', '2023', '~250 direct', '€88 M'),
    ('1353240197', 'logistics', 'Amazon delivery station DQA8', 'Sept 2024', '40+', '€20 M+'),
    ('137530401', 'industry', 'Knauf plant', '2008', '', '€200 M+ since 2008'),
]
feats = []
for wid, kind, lbl, opened, jobs, inv in SITES:
    c, tg = osm_way(wid)
    if c[0] != c[-1]: c.append(c[0])
    feats.append(F({'type': 'Polygon', 'coordinates': [c]}, k=kind, nm=lbl, osm_name=tg.get('name', ''), opened=opened, jobs=jobs, inv=inv, ha=round(area_ha(c), 1), osm='way ' + wid))
village, vt = osm_node('1432103169')
feats.append(F({'type': 'Point', 'coordinates': village}, k='village', nm='Escúzar', pop=826, pop_year=2025, osm='node 1432103169'))
dones_c = [sum(p[0] for p in feats[1]['geometry']['coordinates'][0][:-1]) / (len(feats[1]['geometry']['coordinates'][0]) - 1),
           sum(p[1] for p in feats[1]['geometry']['coordinates'][0][:-1]) / (len(feats[1]['geometry']['coordinates'][0]) - 1)]
gap = math.hypot((dones_c[0] - line[-1][0]) * KX, (dones_c[1] - line[-1][1]) * KY)
feats.append(F({'type': 'LineString', 'coordinates': [line[-1], [round(dones_c[0], 6), round(dones_c[1], 6)]]}, k='gap', km=round(gap / 1000, 1)))
pole = {'type': 'FeatureCollection', 'features': feats}

sizes = {n: save(n, fc) for n, fc in (('south_metro', metro), ('tram_1931', tram), ('escuzar_pole', pole))}

# ---------- manifest ----------
mp = os.path.join(ROOT, 'data', 'manifest.json'); m = json.load(open(mp, encoding='utf-8'))
m['layers']['south_metro'] = {'chunked': False, 'features': len(metro['features']), 'bytes': sizes['south_metro'], 'title': 'Metro line 1 southern extension (under construction)',
    'source': 'OpenStreetMap contributors — ways ' + ', '.join(SEQ) + ' (railway=construction, construction=light_rail, "Metro de Granada"), node 12847119977; read from the OSM API',
    'license': 'ODbL 1.0', 'date': today, 'length_m': round(L),
    'limitations': 'One track of the double line. The seven new stations are not yet mapped in OSM, so only the current end (Armilla) and the end of the new track (Las Gabias, Plaza Estación de Tranvías) are shown. No opening date has been announced.'}
m['layers']['tram_1931'] = {'chunked': False, 'features': len(tram['features']), 'bytes': sizes['tram_1931'], 'title': 'Old electric tram Granada–Gabia, as drawn in 1931',
    'source': 'Traced by hand in this repository from © Instituto Geográfico Nacional, MTN50 1st edition, sheet 1026 Padul (1931), WMS primera-edicion-mtn; aligned to IECA/IGN orthophotos', 'license': 'CC BY 4.0 (IGN source map)', 'date': '1931 map; traced 2026-11-07',
    'method': 'line followed on the map where labelled "Tranvía de Granada a Gabia"; stations where the map prints "Estación" / "Estón"; affine fit on 4 town centres (residuals 6–67 m)',
    'limitations': 'approximate position (about ±100 m); the trunk line to Alhendín is drawn only near Armilla; service history (opened 1918, closed Jan–Feb 1974) from secondary sources'}
m['layers']['escuzar_pole'] = {'chunked': False, 'features': len(feats), 'bytes': sizes['escuzar_pole'], 'title': 'Escúzar: CITAI estate, IFMIF-DONES and logistics sites',
    'source': 'OpenStreetMap contributors (site polygons, village node); population INE padrón 1 Jan 2025; jobs/investment: Lidl & Alimarket (2023), Amazon press release (Sept 2024), Ministerio de Ciencia / IFMIF-DONES (2025–26), Knauf',
    'license': 'ODbL 1.0 (geometry); figures cited from their publishers', 'date': today, 'gap_km': round(gap / 1000, 1),
    'limitations': 'the IFMIF-DONES polygon in OSM is the UGR-DONES building plot only, not the whole 10 ha project site; jobs and investment are the operators\' announced figures, not counts; the gap line is a straight-line distance, not a route'}
m['dataVersion'] = today + '-v11'
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('metro %.0f m · tram %d m · DONES→terminus %.1f km · sizes %s' % (L, length_m(TRAM), gap / 1000, sizes))
