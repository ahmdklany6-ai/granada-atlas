#!/usr/bin/env python3
"""Exercise 2.1 — "the factory": the Escúzar estate (CITAI / Parque Metropolitano Industrial y Tecnológico: IFMIF-DONES,
Lidl, Amazon, Knauf …) and the village of Escúzar beside it (owner request, 15 Nov 2026).

Sources
- OpenStreetMap (ODbL): the estate outline, named plots and works, streets and roads, land use, solar plants,
  quarries, bus line 0256 and its stops, municipal boundaries, the village's civic places. OSM API /map in 0.01° tiles,
  cached in $CACHE/osm.
- Dirección General del Catastro, INSPIRE buildings (ATOM service; "can be used free of charge in every instance, as
  long as the D. G. of the Cadastre (Ministry of Finance) is mentioned as author and owner of the information"): every
  building of Escúzar and of the neighbouring municipalities inside the frame — footprint, floors above ground per
  building part, current use, year of construction, dwellings. Cached in $CACHE/catastro.
- IGN MDT05 (terrain model, 5 m cells; CC BY 4.0) through the WCS of servicios.idee.es — the ground of the sections.
  Cached in $CACHE/mdt05.npy.
- data/vec/escuzar_pole.json (build 5.20): the operators' announced figures (opening, jobs, investment) of four plots.

Outputs
- data/ex21/factory.json — the frame drawn at 1:10,000 (5.4 × 4.4 km = 540 × 440 mm).
- data/ex21/factory_areas.json — six 130 m windows at 1:500 (J K L M N P), each with a section. Same schema as
  areas.json (tools/build_ex21_areas.py) but with no base, no fence and no height-limit surface: `limit` is null.
  Run tools/build_ex21_canopy.py with AREAS=data/ex21/factory_areas.json afterwards (it adds the tree crowns).

Heights — never invented: floors come from the Catastro. Floors × 3 m is an ESTIMATE used for housing, offices,
shops and public buildings. An industrial or farm shed's height is NOT derived from its floor count (one floor can be
6 m or 15 m): `hu` (height unknown) is set and the drawings show it dashed.

Usage: CACHE=/some/folder python3 tools/build_ex21_factory.py   (needs numpy, shapely, pyproj, networkx)
"""
import glob, io, json, math, os, re, sys, time, urllib.request, zipfile, xml.etree.ElementTree as ET
from collections import Counter, defaultdict
import numpy as np
import networkx as nx
from pyproj import Transformer
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point, box, shape, mapping
from shapely.ops import unary_union, linemerge, polygonize, nearest_points

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get('CACHE', os.path.join(ROOT, '.cache', 'ex21_factory'))
FRAME = (429000, 4101300, 434400, 4105700)   # EPSG:25830; 5.4 × 4.4 km
FB = box(*FRAME)
UA = 'granada-atlas-build/ex21 (static urban-analysis site; one-off build)'
fwd = Transformer.from_crs(4326, 25830, always_xy=True).transform
inv = Transformer.from_crs(25830, 4326, always_xy=True).transform
CAT = {'18074': '18074-ESCUZAR', '18189': '18189-VENTAS%20DE%20HUELMA', '18127': '18127-LA%20MALAHA', '18062': '18062-CHIMENEAS', '18015': '18015-ALHENDIN'}
SIDE = 130.0
# the six windows: centre, the two ends of the section (a → b), chosen on the PNOA photo
WINDOWS = [
    ('J', 'Lidl', 'plot', (433150, 4104432), (433130, 4104491), (433170, 4104373)),
    ('K', 'IFMIF-DONES', 'plot', (432190, 4104050), (432190, 4104113), (432200, 4103990)),
    ('L', 'Estate centre', 'empty', (431850, 4103622), (431827, 4103680), (431873, 4103564)),
    ('M', 'South gate', 'edge', (432215, 4103265), (432153, 4103240), (432277, 4103240)),
    ('N', 'Village north edge', 'village', (432260, 4102215), (432262, 4102277), (432262, 4102153)),
    ('P', 'Village centre', 'village', (432315, 4102040), (432306, 4102101), (432324, 4101979)),
]


def get(url, tries=5):
    err = None
    for k in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=180).read()
        except Exception as e: err = e; print('retry', url[:90], e, file=sys.stderr); time.sleep(2 ** k * 2)
    raise err


# ---------- OpenStreetMap ----------
def load_osm():
    d = os.path.join(CACHE, 'osm'); os.makedirs(d, exist_ok=True)
    c = [inv(FRAME[0], FRAME[1]), inv(FRAME[2], FRAME[1]), inv(FRAME[0], FRAME[3]), inv(FRAME[2], FRAME[3])]
    x0, y0 = math.floor(min(p[0] for p in c) * 100) / 100, math.floor(min(p[1] for p in c) * 100) / 100
    x1, y1 = math.ceil(max(p[0] for p in c) * 100) / 100, math.ceil(max(p[1] for p in c) * 100) / 100
    nodes, ntags, ways, rels = {}, {}, {}, {}
    for i in range(round((x1 - x0) / 0.01)):
        for j in range(round((y1 - y0) / 0.01)):
            b = (x0 + i * 0.01, y0 + j * 0.01, x0 + (i + 1) * 0.01, y0 + (j + 1) * 0.01); fn = os.path.join(d, 'tile_{:.3f}_{:.3f}.osm'.format(b[0], b[1]))
            if not os.path.exists(fn): open(fn, 'wb').write(get('https://api.openstreetmap.org/api/0.6/map?bbox={:.3f},{:.3f},{:.3f},{:.3f}'.format(*b))); time.sleep(1)
            root = ET.parse(fn).getroot()
            for n in root.iter('node'):
                nid = int(n.get('id')); nodes[nid] = fwd(float(n.get('lon')), float(n.get('lat'))); tg = {t.get('k'): t.get('v') for t in n.iter('tag')}
                if tg: ntags[nid] = tg
            for w in root.iter('way'): ways[int(w.get('id'))] = {'nd': [int(x.get('ref')) for x in w.iter('nd')], 'tags': {t.get('k'): t.get('v') for t in w.iter('tag')}}
            for r in root.iter('relation'): rels[int(r.get('id'))] = {'m': [(m.get('type'), int(m.get('ref')), m.get('role')) for m in r.iter('member')], 'tags': {t.get('k'): t.get('v') for t in r.iter('tag')}}
    print(f'OSM: {len(nodes)} nodes, {len(ways)} ways, {len(rels)} relations', file=sys.stderr)
    return nodes, ntags, ways, rels


# ---------- Catastro ----------
NS = {'e': 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0', 'c': 'http://inspire.jrc.ec.europa.eu/schemas/bu-core2d/2.0', 'g': 'http://www.opengis.net/gml/3.2'}
GID = '{http://www.opengis.net/gml/3.2}id'


def gml_polys(el):
    out = []
    for pp in el.iter('{%s}PolygonPatch' % NS['g']):
        ext, inn = [], []
        for kind, dst in (('exterior', ext), ('interior', inn)):
            for r in pp.findall('g:%s' % kind, NS):
                v = [float(x) for x in r.find('.//g:posList', NS).text.split()]; dst.append(list(zip(v[0::2], v[1::2])))
        if ext and len(ext[0]) >= 4:
            p = Polygon(ext[0], [h for h in inn if len(h) >= 4]); out.append(p if p.is_valid else p.buffer(0))
    return out


def load_catastro():
    d = os.path.join(CACHE, 'catastro'); os.makedirs(d, exist_ok=True); B = {}
    for code, folder in CAT.items():
        if not os.path.exists(os.path.join(d, f'A.ES.SDGC.BU.{code}.building.gml')):
            raw = get(f'https://www.catastro.hacienda.gob.es/INSPIRE/Buildings/18/{folder}/A.ES.SDGC.BU.{code}.zip'); zipfile.ZipFile(io.BytesIO(raw)).extractall(d)
        for el in ET.parse(os.path.join(d, f'A.ES.SDGC.BU.{code}.building.gml')).getroot().iter('{%s}Building' % NS['e']):
            g = unary_union(gml_polys(el))
            if g.is_empty or not g.intersects(FB): continue
            yr = el.find('.//c:dateOfConstruction//c:beginning', NS); use = el.find('e:currentUse', NS); dw = el.find('e:numberOfDwellings', NS); cond = el.find('c:conditionOfConstruction', NS)
            B[el.get(GID).split('.')[-1]] = {'mun': code, 'g': g, 'year': int(yr.text[:4]) if yr is not None and yr.text and yr.text[:4].isdigit() else None,
                                             'use': (use.text if use is not None else None) or None, 'dw': int(dw.text) if dw is not None and dw.text else 0,
                                             'cond': cond.text if cond is not None else None, 'parts': []}
        for el in ET.parse(os.path.join(d, f'A.ES.SDGC.BU.{code}.buildingpart.gml')).getroot().iter('{%s}BuildingPart' % NS['e']):
            ref = el.get(GID).split('.')[-1].split('_part')[0]
            if ref not in B: continue
            fl = el.find('e:numberOfFloorsAboveGround', NS); g = unary_union(gml_polys(el))
            if not g.is_empty: B[ref]['parts'].append({'g': g, 'fl': int(fl.text) if fl is not None and fl.text else None})
    for b in B.values(): b['fl'] = max([p['fl'] or 0 for p in b['parts']] or [0]) or None
    print(f'Catastro: {len(B)} buildings in the frame', Counter(b["mun"] for b in B.values()), file=sys.stderr)
    return B


# ---------- IGN MDT05 ----------
def load_dem():
    fn = os.path.join(CACHE, 'mdt05.npy'); m = 200; x0, y0, x1, y1 = FRAME[0] - m, FRAME[1] - m, FRAME[2] + m, FRAME[3] + m
    if not os.path.exists(fn):
        b = get(f'https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=Elevacion25830_5&FORMAT=application/asc&SUBSET=x({x0},{x1})&SUBSET=y({y0},{y1})')
        lines = b[b.find(b'ncols'):].decode('ascii', 'replace').split('\n'); hdr = {}; k = 0
        while re.match(r'^\s*[A-Za-z_]+\s', lines[k]): a, v = lines[k].split()[:2]; hdr[a.lower()] = float(v); k += 1
        toks = []
        for ln in lines[k:]:
            if ln.startswith('--wcs'): break
            toks.extend(ln.split())
        n = int(hdr['ncols']) * int(hdr['nrows']); A = np.array(toks[:n], dtype='float32').reshape(int(hdr['nrows']), int(hdr['ncols']))
        assert abs(hdr['xllcorner'] - x0) < 1 and abs(hdr['yllcorner'] - y0) < 1 and hdr['cellsize'] == 5, hdr
        np.save(fn, A)
    A = np.load(fn); top = y0 + A.shape[0] * 5.0

    def z(x, y):  # bilinear; cell centres at x0 + 2.5 + 5 i
        fx, fy = (x - x0) / 5.0 - 0.5, (top - y) / 5.0 - 0.5; i, j = int(math.floor(fx)), int(math.floor(fy)); i = max(0, min(A.shape[1] - 2, i)); j = max(0, min(A.shape[0] - 2, j))
        u, v = min(1, max(0, fx - i)), min(1, max(0, fy - j))
        return float(A[j, i] * (1 - u) * (1 - v) + A[j, i + 1] * u * (1 - v) + A[j + 1, i] * (1 - u) * v + A[j + 1, i + 1] * u * v)
    return z


# ---------- geometry helpers ----------
def rnd(c): return [round(c[0], 1), round(c[1], 1)]


def poly_rings(g):
    """shapely (Multi)Polygon → [[ring, hole, …], …] (the nesting used by js/ex21.js)."""
    if g.is_empty: return []
    gs = [g] if g.geom_type == 'Polygon' else [q for q in getattr(g, 'geoms', []) if q.geom_type == 'Polygon']
    return [[[rnd(c) for c in p.exterior.coords]] + [[rnd(c) for c in h.coords] for h in p.interiors] for p in gs if p.area > 0.5]


def lines_of(g):
    if g.is_empty: return []
    if g.geom_type == 'LineString': return [[rnd(c) for c in g.coords]]
    return [[rnd(c) for c in q.coords] for q in getattr(g, 'geoms', []) if q.geom_type == 'LineString' and q.length > 0.5]


def main():
    nodes, ntags, ways, rels = load_osm(); B = load_catastro(); zat = load_dem()
    def wline(w): return [nodes[n] for n in w['nd'] if n in nodes]
    def wpoly(w):
        c = wline(w)
        if len(c) < 4 or w['nd'][0] != w['nd'][-1]: return None
        g = Polygon(c); return g if g.is_valid else g.buffer(0)
    def rpoly(r):  # multipolygon relation → polygon (outer rings minus inner rings), as far as its ways are in the extract
        outer = [LineString(wline(ways[ref])) for t, ref, role in r['m'] if t == 'way' and ref in ways and role != 'inner' and len(wline(ways[ref])) > 1]
        inner = [LineString(wline(ways[ref])) for t, ref, role in r['m'] if t == 'way' and ref in ways and role == 'inner' and len(wline(ways[ref])) > 1]
        o = unary_union(list(polygonize(unary_union(outer)))) if outer else Polygon(); i = unary_union(list(polygonize(unary_union(inner)))) if inner else Polygon()
        return o.difference(i) if not o.is_empty else None
    areas = []  # (tags, polygon, osm ref)
    for wid, w in ways.items():
        if any(k in w['tags'] for k in ('landuse', 'natural', 'power', 'man_made', 'amenity', 'leisure', 'aeroway', 'industrial')) or (w['tags'].get('name') and 'building' in w['tags']):
            g = wpoly(w)
            if g is not None and not g.is_empty and g.intersects(FB): areas.append((w['tags'], g, f'way {wid}'))
    for rid, r in rels.items():
        if r['tags'].get('type') == 'multipolygon':
            g = rpoly(r)
            if g is not None and not g.is_empty and g.intersects(FB): areas.append((r['tags'], g, f'relation {rid}'))

    # the estate, its named plots with the operators' announced figures
    estate = next(g for t, g, ref in areas if t.get('name') == 'Parque Metropolitano Industrial y Tecnológico')
    pole = {f['properties'].get('osm'): f['properties'] for f in json.load(open(os.path.join(ROOT, 'data/vec/escuzar_pole.json')))['features']}
    def plot_kind(t):
        nm = (t.get('name') or '').lower()
        if t.get('amenity') == 'research_institute': return 'science'
        if t.get('power') in ('plant', 'substation', 'generator'): return 'energy'
        if t.get('industrial') in ('warehouse', 'logistics') or t.get('amenity') == 'post_depot' or 'logíst' in nm or 'logist' in nm: return 'logistics'
        if t.get('landuse') == 'quarry': return 'quarry'
        return 'industry'
    plots = []
    for t, g, ref in areas:
        if not t.get('name') or g.equals(estate): continue
        if not (ref in pole or t.get('landuse') in ('industrial', 'quarry') or t.get('man_made') == 'works' or t.get('amenity') == 'research_institute' or t.get('industrial') or t.get('power') == 'substation'): continue
        if g.area < 400: continue
        p = pole.get(ref, {}); c = g.representative_point()
        plots.append({'k': plot_kind(t), 'nm': p.get('nm') or t['name'], 'osm_name': t['name'], 'r': poly_rings(g.intersection(FB)), 'ha': round(g.area / 1e4, 1), 'in_estate': bool(c.within(estate)), 'c': rnd((c.x, c.y)),
                      'opened': p.get('opened') or None, 'jobs': p.get('jobs') or None, 'inv': p.get('inv') or None, 'osm': ref})
    plots.sort(key=lambda q: -q['ha'])
    # land around: OSM land use / natural / solar plants, by class
    def lu_class(t):
        if t.get('power') == 'plant' or t.get('plant:source') == 'solar' or t.get('generator:source') == 'solar': return 'solar'
        lu, na = t.get('landuse'), t.get('natural')
        if lu == 'quarry': return 'quarry'
        if lu in ('farmland', 'meadow', 'farmyard'): return 'farmland'   # greenfield = land kept for building: left unclassed
        if lu in ('orchard', 'vineyard'): return 'orchard'
        if lu == 'forest' or na in ('wood', 'scrub'): return 'wood'
        if na == 'water': return 'water'
        if lu == 'residential': return 'residential'
        if lu == 'cemetery': return 'cemetery'
        return None
    land = defaultdict(list)
    for t, g, ref in areas:
        c = lu_class(t)
        if c: land[c].append(g)
    landuse = []; land_ha = {}
    for c, gs in land.items():
        u = unary_union(gs).intersection(FB); land_ha[c] = round(u.area / 1e4, 1)
        for p in ([u] if u.geom_type == 'Polygon' else list(getattr(u, 'geoms', []))):
            if p.geom_type == 'Polygon' and p.area > 200: landuse.append({'c': c, 'r': poly_rings(p.simplify(1.0))})
    # the village: OSM residential land around the place node
    vnode = next((nodes[n] for n, t in ntags.items() if t.get('place') == 'village' and t.get('name') == 'Escúzar'), (432330, 4102040))
    vres = [g for g in land.get('residential', []) if g.distance(Point(vnode)) < 300]; village = unary_union(vres) if vres else Point(vnode).buffer(350)

    # streets and roads
    CLS = {'motorway': 'main', 'trunk': 'main', 'primary': 'main', 'secondary': 'main', 'tertiary': 'main', 'residential': 'street', 'living_street': 'street', 'unclassified': 'street', 'service': 'service',
           'pedestrian': 'street', 'track': 'track', 'path': 'track', 'footway': 'track', 'steps': 'track', 'cycleway': 'track'}
    streets = []; G = nx.Graph(); Gcar = nx.Graph()
    for wid, w in ways.items():
        hw = w['tags'].get('highway')
        if hw not in CLS: continue
        c = wline(w)
        if len(c) < 2: continue
        ln = LineString(c)
        if ln.intersects(FB):
            for part in lines_of(ln.intersection(FB)): streets.append({'r': [[part]], 'hw': hw, 'c': CLS[hw], 'ref': w['tags'].get('ref'), 'nm': w['tags'].get('name')})
        if w['tags'].get('access') in ('private', 'no') and hw not in ('track', 'path', 'footway'): continue
        for a, b in zip(w['nd'], w['nd'][1:]):
            if a in nodes and b in nodes:
                dd = math.dist(nodes[a], nodes[b]); G.add_edge(a, b, w=dd)
                if CLS[hw] in ('main', 'street', 'service'): Gcar.add_edge(a, b, w=dd)
    # bus line 0256 (route relations) and its stops
    bus_lines, bus_name = [], None
    for r in rels.values():
        if r['tags'].get('route') == 'bus':
            bus_name = bus_name or r['tags'].get('name')
            for t, ref, role in r['m']:
                if t == 'way' and ref in ways and len(wline(ways[ref])) > 1:
                    g = LineString(wline(ways[ref])).intersection(FB)
                    bus_lines += lines_of(g)
    seen = set(); bus_u = []
    for l in bus_lines:
        key = (tuple(l[0]), tuple(l[-1]))
        if key in seen or key[::-1] in seen: continue
        seen.add(key); bus_u.append(l)
    stops = [{'p': rnd(nodes[n]), 'nm': t.get('name')} for n, t in ntags.items() if t.get('highway') == 'bus_stop' and FB.contains(Point(nodes[n]))]
    # municipal boundaries (the ways of the admin_level 8 relations)
    bnd = {}
    for r in rels.values():
        if r['tags'].get('boundary') == 'administrative' and r['tags'].get('admin_level') == '8':
            for t, ref, role in r['m']:
                if t == 'way' and ref in ways and len(wline(ways[ref])) > 1: bnd.setdefault(ref, set()).add(r['tags'].get('name'))
    muni = [{'r': [[l]], 'nm': sorted(n for n in names if n)} for ref, names in bnd.items() for l in lines_of(LineString(wline(ways[ref])).intersection(FB))]
    # the village's civic places (nodes and named ways)
    PK = {'townhall': 'townhall', 'place_of_worship': 'worship', 'school': 'school', 'pharmacy': 'health', 'doctors': 'health', 'library': 'culture', 'community_centre': 'culture', 'restaurant': 'food', 'bar': 'food', 'cafe': 'food'}
    pois = []
    for n, t in ntags.items():
        if t.get('amenity') in PK and FB.contains(Point(nodes[n])): pois.append({'k': PK[t['amenity']], 'a': t['amenity'], 'nm': t.get('name'), 'p': rnd(nodes[n])})
    for wid, w in ways.items():
        t = w['tags']
        if t.get('amenity') in PK or t.get('building') == 'public':
            g = wpoly(w) or (LineString(wline(w)) if len(wline(w)) > 1 else None)
            if g is not None and not g.is_empty and FB.contains(g.centroid): pois.append({'k': PK.get(t.get('amenity'), 'townhall'), 'a': t.get('amenity') or 'public', 'nm': t.get('name'), 'p': rnd((g.centroid.x, g.centroid.y))})

    # Catastro buildings: where they stand, floors, use, year
    def use_type(b):
        u = b['use'] or ''
        if u.startswith('1_'): return 'apartments' if b['dw'] > 2 else 'house'
        if u.startswith('3_'): return 'industrial'
        if u.startswith('2_'): return 'warehouse'
        if u == '4_1_office': return 'commercial'
        if u == '4_2_retail': return 'retail'
        if u == '4_3_publicServices': return 'public'
        return 'yes'
    def zone(g):
        c = g.representative_point()
        return 'estate' if c.within(estate) else 'village' if c.distance(village) < 60 else 'other'
    # churches and chapels (OSM): one tall floor — like a shed, the height is not derived from the floor count
    worship = [g for t, g, ref in areas if t.get('amenity') == 'place_of_worship' or t.get('building') in ('church', 'chapel')]
    buildings = []
    for ref, b in B.items():
        b['zone'] = zone(b['g']); b['type'] = use_type(b)
        if any(b['g'].representative_point().within(w.buffer(2)) or b['g'].intersection(w).area > 0.5 * min(b['g'].area, w.area) for w in worship): b['type'] = 'worship'
        b['hu'] = b['type'] in ('industrial', 'warehouse', 'worship')
        buildings.append({'r': poly_rings(b['g'].intersection(FB)), 'fl': b['fl'], 'u': b['type'], 'y': b['year'], 'z': b['zone'][0]})
    def stats(z):
        bb = [b for b in B.values() if b['zone'] == z]; dec = Counter((b['year'] // 10 * 10) for b in bb if b['year'])
        return {'buildings': len(bb), 'footprint_ha': round(sum(b['g'].area for b in bb) / 1e4, 2), 'dwellings': sum(b['dw'] for b in bb), 'first_year': min((b['year'] for b in bb if b['year']), default=None),
                'by_decade': {str(k): v for k, v in sorted(dec.items())}, 'footprint_by_decade_m2': {str(k): round(sum(b['g'].area for b in bb if b['year'] and b['year'] // 10 * 10 == k)) for k in sorted(dec)},
                'floors': {str(k): v for k, v in sorted(Counter(b['fl'] for b in bb if b['fl']).items())}}
    st_e, st_v = stats('estate'), stats('village')

    # getting there: shortest way on the OSM network from the village centre to the estate
    def nearest(Gx, p): return min(Gx.nodes, key=lambda n: math.dist(nodes[n], p))
    dones = next((q for q in plots if 'IFMIF' in q['nm'] or 'Fusion' in q['osm_name']), None); lidl = next((q for q in plots if 'Lidl' in q['nm']), None)
    routes = []
    for nm, tgt in (('IFMIF-DONES', dones), ('Lidl', lidl)):
        if not tgt: continue
        for mode, Gx in (('road', Gcar), ('foot', G)):
            try:
                a, b = nearest(Gx, vnode), nearest(Gx, tuple(tgt['c'])); path = nx.shortest_path(Gx, a, b, weight='w'); km = sum(math.dist(nodes[u], nodes[v]) for u, v in zip(path, path[1:])) / 1000
                routes.append({'from': 'village', 'to': nm, 'mode': mode, 'km': round(km, 2), 'straight_km': round(math.dist(vnode, tuple(tgt['c'])) / 1000, 2), 'r': [[[rnd(nodes[n]) for n in path]]], 'end_gap_m': round(math.dist(nodes[b], tuple(tgt['c'])))})
            except Exception as e: print('no route', nm, mode, e, file=sys.stderr)
    # from the estate's bus stop to the accelerator plot, on foot (the stops inside the estate, OSM)
    est_stops = [n for n, t in ntags.items() if t.get('highway') == 'bus_stop' and Point(nodes[n]).within(estate)]
    if dones and est_stops:
        try:
            a, b = nearest(G, nodes[est_stops[0]]), nearest(G, tuple(dones['c'])); path = nx.shortest_path(G, a, b, weight='w'); km = sum(math.dist(nodes[u], nodes[v]) for u, v in zip(path, path[1:])) / 1000
            routes.append({'from': 'stop', 'to': 'IFMIF-DONES', 'mode': 'foot', 'km': round(km, 2), 'straight_km': round(math.dist(nodes[est_stops[0]], tuple(dones['c'])) / 1000, 2), 'r': [[[rnd(nodes[n]) for n in path]]], 'stop': ntags[est_stops[0]].get('name')})
        except Exception as e: print('no stop route', e, file=sys.stderr)
    centre_m, edge_m = round(Point(vnode).distance(estate)), round(village.distance(estate)); np_ = nearest_points(village, estate); edge_line = [rnd((q.x, q.y)) for q in np_]
    gapf = next((f for f in json.load(open(os.path.join(ROOT, 'data/vec/escuzar_pole.json')))['features'] if f['properties'].get('k') == 'gap'), None)
    gap_line = [rnd(fwd(*c)) for c in gapf['geometry']['coordinates']] if gapf else None; gap = pole.get(None) or next((p for p in pole.values() if p.get('k') == 'gap'), {})
    out = {'frame': list(FRAME), 'epsg': 25830, 'scale_note': '5.4 × 4.4 km = 540 × 440 mm at 1:10,000',
           'estate': {'nm': 'CITAI – Parque Metropolitano Industrial y Tecnológico', 'r': poly_rings(estate), 'ha': round(estate.area / 1e4, 1), **st_e, 'built_share_pct': round(st_e['footprint_ha'] / (estate.area / 1e4) * 100, 1)},
           'village': {'nm': 'Escúzar', 'c': rnd(vnode), 'r': poly_rings(village), 'ha': round(village.area / 1e4, 1), 'pop': pole.get('node 1432103169', {}).get('pop'), 'pop_year': pole.get('node 1432103169', {}).get('pop_year'), **st_v},
           'village_centre_to_estate_m': centre_m, 'village_edge_to_estate_m': edge_m, 'edge_line': edge_line, 'gap_metro_km': gap.get('km'), 'gap_line': gap_line, 'plots': plots, 'buildings': buildings, 'landuse': landuse, 'land_ha': land_ha, 'streets': streets,
           'bus': {'nm': bus_name, 'ref': '0256', 'r': [[l] for l in bus_u], 'stops': stops}, 'muni': muni, 'pois': pois, 'routes': routes,
           'sources': 'OpenStreetMap contributors (ODbL): estate, plots, roads, land use, bus line, boundaries; Dirección General del Catastro (INSPIRE buildings): footprints, floors, use, year, dwellings; IGN MDT05 (CC BY 4.0): ground; INE: residents; announced jobs / investment: the operators, as collected in data/vec/escuzar_pole.json',
           'caveats': 'Catastro years are the recorded year of construction. OSM land use is only as complete as OSM. Announced figures are the operators\' own. Floors × 3 m is an estimate; an industrial shed\'s height is unknown.'}
    json.dump(out, open(os.path.join(ROOT, 'data/ex21/factory.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('estate', out['estate']['ha'], 'ha', {k: out['estate'][k] for k in ('buildings', 'footprint_ha', 'built_share_pct', 'first_year')}, file=sys.stderr)
    print('village', out['village']['ha'], 'ha', {k: out['village'][k] for k in ('buildings', 'footprint_ha', 'dwellings', 'first_year', 'pop')}, 'centre → estate', centre_m, 'm; edge → estate', edge_m, 'm', file=sys.stderr)
    print('plots', [(q['nm'][:28], q['k'], q['ha'], q['in_estate']) for q in plots], file=sys.stderr)
    print('land ha', land_ha, '| routes', [(r['from'], r['to'], r['mode'], r['km'], r['straight_km']) for r in routes], '| stops', len(stops), '| pois', Counter(p['a'] for p in pois), file=sys.stderr)

    # ---------- the six 1:500 windows ----------
    BL = {'industrial': 'industrial', 'residential': 'residential', 'farmland': 'agri', 'orchard': 'agri', 'wood': 'green', 'cemetery': 'green'}
    parts = [(p['g'], p['fl'], b) for b in B.values() for p in b['parts'] if p['fl']]
    est_plots = [g for t, g, ref in areas if t.get('landuse') == 'industrial' and not g.equals(estate)]   # the occupied, named plots — the estate's empty land stays white
    wins = []
    for wid_, nm, kind, c, sa, sb in WINDOWS:
        x0, y0, x1, y1 = c[0] - SIDE / 2, c[1] - SIDE / 2, c[0] + SIDE / 2, c[1] + SIDE / 2; W = box(x0, y0, x1, y1)
        blds = [{'r': poly_rings(g.intersection(W)), 'lv': fl, 'b': b['type'], 'rs': None, 'hu': b['hu'], 'y': b['year']} for g, fl, b in parts if g.intersects(W) and g.intersection(W).area > 1]
        sts = [{'r': [[l]], 'hw': s['hw'], 'nm': s['nm']} for s in streets for l in lines_of(LineString(s['r'][0][0]).intersection(W))]
        lus = []
        for t, g, ref in areas:
            lu = t.get('landuse') or ('orchard' if t.get('natural') == 'scrub' else None)
            if lu and g.intersects(W) and not g.equals(estate): lus.append({'r': poly_rings(g.intersection(W)), 'lu': lu})
        blu = []
        for cls in ('residential', 'industrial', 'agri', 'green'):
            gs = [g for cc, gl in land.items() for g in gl if BL.get(cc) == cls] + (est_plots if cls == 'industrial' else [])
            u = unary_union(gs).intersection(W) if gs else Polygon()
            if not u.is_empty and u.area > 5: blu.append({'c': cls, 'r': poly_rings(u), 'ha': round(u.area / 1e4, 2)})
        pl = [{'nm': q['nm'], 'k': q['k'], 'r': poly_rings(unary_union([Polygon(r[0], r[1:]) for r in q['r']]).intersection(W))} for q in plots if q['r'] and unary_union([Polygon(r[0], r[1:]) for r in q['r']]).intersects(W)]
        if estate.intersects(W) and not estate.contains(W): pl.append({'nm': 'CITAI', 'k': 'estate', 'r': poly_rings(estate.intersection(W))})   # the estate's own edge, where it crosses the window
        # the section: ground every metre (MDT05, bilinear), the buildings it cuts
        L = math.dist(sa, sb); ux, uy = (sb[0] - sa[0]) / L, (sb[1] - sa[1]) / L; line = LineString([sa, sb]); n = int(round(L))
        samples = [[d, round(zat(sa[0] + ux * d, sa[1] + uy * d), 2), None] for d in range(n + 1)]
        cuts = []
        for g, fl, b in parts:
            it = g.intersection(line)
            for q in ([it] if it.geom_type == 'LineString' else list(getattr(it, 'geoms', []))):
                if q.geom_type != 'LineString' or q.length < 0.5: continue
                s0, s1 = sorted([line.project(Point(q.coords[0])), line.project(Point(q.coords[-1]))])
                cuts.append({'s0': round(s0, 1), 's1': round(s1, 1), 'lv': fl, 'h_est': None if b['hu'] else fl * 3.0, 'b': b['type'], 'rs': None, 'y': b['year']})
        cuts.sort(key=lambda q: q['s0'])
        wins.append({'id': wid_, 'name': nm, 'kind': kind, 'centre': list(c), 'extent': [x0, y0, x1, y1], 'side_m': SIDE, 'buildings': blds, 'streets': sts, 'landuse': lus, 'trees': [], 'fence': [], 'dead': [],
                     'bandlu': blu, 'metro': [], 'base': [], 'plots': pl,
                     'section': {'a': list(sa), 'b': list(sb), 'fence_at_m': None, 'samples': samples, 'cuts': cuts},
                     'stats': {'buildings': len(blds), 'with_levels': len(blds), 'cuts': len(cuts), 'ground_min': min(s[1] for s in samples), 'ground_max': max(s[1] for s in samples)}})
        print(wid_, nm, '| parts', len(blds), 'streets', len(sts), 'cuts', [(q['s0'], q['s1'], q['lv'], q['b']) for q in cuts], 'ground', wins[-1]['stats']['ground_min'], '–', wins[-1]['stats']['ground_max'], file=sys.stderr)
    json.dump({'set': 'factory', 'floors_source': 'catastro', 'ground_source': 'IGN MDT05', 'areas': wins,
               'sources': 'Buildings, floors, use and year: Dirección General del Catastro (INSPIRE buildings); streets and land use: OpenStreetMap contributors (ODbL); ground: IGN MDT05 (CC BY 4.0)',
               'caveats': 'Heights = Catastro floors × 3 m (estimate) for housing, offices, shops and public buildings; an industrial or farm shed\'s height is not derived from its floors and is shown as unknown. No height-limit surface is drawn here.'},
              open(os.path.join(ROOT, 'data/ex21/factory_areas.json'), 'w'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
