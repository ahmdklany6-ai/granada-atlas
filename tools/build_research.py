#!/usr/bin/env python3
"""Build 5.52 — data for the research tour (14 chapters): data/ref/research.json and data/ref/research_grid.json.

Every figure carries its source, year and kind (official / historical / spatial analysis / estimate / projection / model).
Nothing is estimated silently: a value that is not published stays null and the tour shows it as missing.

Inputs
  INE (servicios.ine.es, free reuse with attribution), read live:
    2871   Cifras oficiales de población (padrón), 1996–2025                       → population series
    33570  Padrón continuo: población por sexo, municipio y edad (5-year groups)    → pyramids 2012 and 2022
    33571  Padrón continuo: nationality (Spanish / foreign) and large age groups    → foreign residents 2022
    31033  ADRH demographic indicators (mean age, < 18, ≥ 65, household size, one-person households) → 2024
    31026  ADRH income by source (wages, pensions, unemployment benefit, other benefits, other) → 2024
    39363 / 39366  Viviendas turísticas (experimental statistics), dwellings, beds and share of dwellings
    69992  Census (annual), employed by activity (CNAE letter) — municipalities ≥ 500 residents
    67078  Census (annual), population ≥ 16 by relation to activity (employed / unemployed / inactive)
  IGN WFS unidades-administrativas (CC BY 4.0): the official outline of each municipality
  Repository data: tour_area / tour_towns / base_edge / buildings_lite / buildings tiles / landuse_overview /
    fac_* / bus_service / ex13b grids (GHS-POP 2020, Landsat LST + NDVI 2024–26) / WorldCover 2021 / ERA5 rain + wind
  Runner files (tools/verify/research_fetch.py, optional folder as argv[1]): ERA5 temperature, CMIP6 (HighResMIP) to 2050,
    CAMS air quality (model), SEPE registered unemployment, BOE 1989 easement decree, MITECO flood WFS.
Usage: python3 tools/build_research.py [runner_folder]"""
import json, math, os, statistics, sys, urllib.request, urllib.parse, datetime, collections
import numpy as np
from shapely.geometry import shape, Point, mapping, box
from shapely.ops import transform, unary_union
from shapely import STRtree
from pyproj import Transformer
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUN = sys.argv[1] if len(sys.argv) > 1 else None
CACHE = os.path.join(ROOT, '.cache', 'research'); os.makedirs(CACHE, exist_ok=True)
UA = {'User-Agent': 'granada-atlas-build/5.52 (static research site; one-off build)'}
fwd = Transformer.from_crs(4326, 25830, always_xy=True).transform
inv = Transformer.from_crs(25830, 4326, always_xy=True).transform
f4258 = Transformer.from_crs(4258, 25830, always_xy=True).transform
P = lambda *a: os.path.join(ROOT, *a)
MUN = [  # name, INE code, INE web id (variable 19)
    ('Armilla', '18021', 4181), ('Churriana de la Vega', '18062', 2409), ('Las Gabias', '18905', 4004),
    ('Alhendín', '18014', 4175), ('Ogíjares', '18145', 2257), ('Granada', '18087', 568)]
FIVE = [m[0] for m in MUN[:5]]

def get(u, t=300):
    import hashlib; fn = os.path.join(CACHE, hashlib.md5(u.encode()).hexdigest() + ".bin")
    if os.path.exists(fn): return open(fn, 'rb').read()
    b = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read(); open(fn, 'wb').write(b); return b
def ine(tab, wid, nult):
    return json.loads(get(f'https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{tab}?nult={nult}&tv=19:{wid}'))
def val(series, *keys, year=None):
    for s in series:
        n = s['Nombre']
        if all(k in n for k in keys):
            ds = [d for d in s['Data'] if d.get('Valor') is not None and (year is None or d['Anyo'] == year)]
            if ds: d = max(ds, key=lambda d: d['Fecha']); return d['Valor'], d['Anyo']
    return None, None
R = {'built': '5.52', 'generated': datetime.date.today().isoformat(), 'munis': {}, 'sources': {}}
S = R['sources']
def src(key, name, year, kind, method, url=None, licence=None):
    S[key] = {'name': name, 'year': year, 'kind': kind, 'method': method, 'url': url, 'licence': licence}

# ---------------- INE ----------------
AGES = ['De 0 a 4', 'De 5 a 9', 'De 10 a 14', 'De 15 a 19', 'De 20 a 24', 'De 25 a 29', 'De 30 a 34', 'De 35 a 39', 'De 40 a 44', 'De 45 a 49',
        'De 50 a 54', 'De 55 a 59', 'De 60 a 64', 'De 65 a 69', 'De 70 a 74', 'De 75 a 79', 'De 80 a 84', 'De 85 a 89', 'De 90 a 94', 'De 95 a 99', '100 y más']
SECT = {'A': 'Agricultura', 'BE': ['Industrias extractivas', 'Industria manufacturera', 'Suministro de energía', 'Suministro de agua'], 'F': 'Construcción',
        'G': 'Comercio al por mayor', 'H': 'Transporte y almacenamiento', 'I': 'Hostelería', 'JN': ['Información y comunicaciones', 'Actividades financieras', 'Actividades inmobiliarias',
        'Actividades profesionales', 'Actividades administrativas'], 'O': 'Administración pública', 'P': 'Educación', 'Q': 'Actividades sanitarias', 'RU': ['Actividades artísticas', 'Otros servicios', 'Actividades de los hogares', 'organismos extraterritoriales']}
for name, code, wid in MUN:
    m = R['munis'][name] = {'ine': code}
    nm = 'Gabias' if name == 'Las Gabias' else name
    t = ine(2871, wid, 40); tot = [s for s in t if '. Total. Total habitantes' in s['Nombre'] and s['Nombre'].startswith(nm.split(' ')[0] if name != 'Las Gabias' else 'Gabias')]
    ser = sorted(((d['Anyo'], d['Valor']) for d in tot[-1]['Data'] if d.get('Valor') is not None))
    m['pop'] = {str(y): int(v) for y, v in ser if y >= 1996}
    t = ine(33570, wid, 11); pyr = {}
    for y in (2012, 2022):
        pyr[str(y)] = {sx: [val(t, sx + '.', a, year=y)[0] for a in AGES] for sx in ('Hombres', 'Mujeres')}
    m['pyr'] = pyr
    t = ine(33571, wid, 1); tv, _ = val(t, 'Total.', 'Total. Todas las edades'.split('. ')[0], 'Todas las edades'); fv, fy = val(t, 'Total.', 'Extranjera. Todas las edades')
    m['foreign'] = {'n': fv, 'share': round(fv / tv * 100, 1) if fv and tv else None, 'year': fy}
    t = ine(31033, wid, 1); d = {}
    for k, key in (('age', 'Edad media'), ('u18', 'menor de 18'), ('o65', '65 y más'), ('hh', 'Tamaño medio del hogar'), ('one', 'hogares unipersonales'), ('es', 'población española')):
        v, y = val(t, key); d[k] = v; d['year'] = y or d.get('year')
    m['demo'] = d
    t = ine(31026, wid, 1); d = {}
    for k, key in (('wage', 'salario'), ('pens', 'pensiones'), ('unemp', 'desempleo'), ('benef', 'otras prestaciones'), ('other', 'otros ingresos')):
        v, y = val(t, key); d[k] = v; d['year'] = y or d.get('year')
    m['incsrc'] = d
    t = ine(39363, wid, 6); v, y = val(t, 'Viviendas turísticas'); b, _ = val(t, 'Plazas. Dato')
    t2 = ine(39366, wid, 6); sh, _ = val(t2, 'Porcentaje de viviendas turísticas')
    m['vut'] = {'n': v, 'beds': b, 'share': sh, 'year': y}
    t = ine(69992, wid, 1); tot, ey = val(t, '. Total. Total CNAE'); sec = {}
    for k, keys in SECT.items():
        keys = keys if isinstance(keys, list) else [keys]; s = 0
        for kk in keys:
            v, _ = val(t, '. Total. ' + kk); s += v or 0
        sec[k] = s
    m['jobs'] = {'employed': tot, 'year': ey, 'sector': sec}
    t = ine(67078, wid, 1); occ, ay = val(t, '16 y más años. Ocupado/a. Total. Total'); par, _ = val(t, '16 y más años. Parado/a. Total. Total'); ina, _ = val(t, '16 y más años. Total. Inactivo/a')
    m['act'] = {'employed': occ, 'unemployed': par, 'inactive': ina, 'rate': round(par / (occ + par) * 100, 1) if occ and par else None, 'year': ay}
    print(name, m['pop'].get('2025'), m['demo'], m['vut'], m['act'], flush=True)
src('pop', 'INE — Cifras oficiales de población de los municipios (padrón), table 2871', '1996–2025', 'official', 'residents on 1 January each year (1997 not published)', 'https://www.ine.es/jaxiT3/Tabla.htm?t=2871', 'INE, free reuse with attribution')
src('pyr', 'INE — Estadística del Padrón Continuo, table 33570 (sex × 5-year age group)', '2012, 2022', 'official', 'residents on 1 January; the latest year INE publishes by municipality and age', 'https://www.ine.es/jaxiT3/Tabla.htm?t=33570', 'INE')
src('foreign', 'INE — Padrón Continuo, table 33571 (nationality)', '2022', 'official', 'residents with a foreign nationality ÷ all residents', 'https://www.ine.es/jaxiT3/Tabla.htm?t=33571', 'INE')
src('demo', 'INE — Atlas de distribución de renta de los hogares (ADRH), demographic indicators, table 31033', '2024', 'official', 'tax-register based; mean age, shares under 18 and 65+, mean household size, one-person households', 'https://www.ine.es/jaxiT3/Tabla.htm?t=31033', 'INE')
src('incsrc', 'INE — ADRH, income by source, table 31026', '2024', 'official', 'share of gross income from each source', 'https://www.ine.es/jaxiT3/Tabla.htm?t=31026', 'INE')
src('vut', 'INE — Viviendas turísticas en España (experimental statistics), tables 39363 / 39366', '2026', 'official', 'listings on Airbnb, Booking and Vrbo matched to the census of dwellings; experimental statistics', 'https://www.ine.es/jaxiT3/Tabla.htm?t=39363', 'INE')
src('jobs', 'INE — Censo de Población (annual), table 69992: employed residents by activity', str(R['munis']['Armilla']['jobs']['year']), 'official', 'where the residents work by sector (place of residence, not of work)', 'https://www.ine.es/jaxiT3/Tabla.htm?t=69992', 'INE')
src('act', 'INE — Censo de Población (annual), table 67078: relation to activity', str(R['munis']['Armilla']['act']['year']), 'official', 'unemployed ÷ (employed + unemployed), residents 16 and over (census definition, not the EPA rate, not SEPE registrations)', 'https://www.ine.es/jaxiT3/Tabla.htm?t=67078', 'INE')

# ---------------- outlines (IGN) ----------------
OUT_G = {}
for name, code, _ in MUN:
    u = ('https://www.ign.es/wfs-inspire/unidades-administrativas?service=WFS&version=2.0.0&request=GetFeature&typeNames=au:AdministrativeUnit'
         '&outputFormat=application/geo%2Bjson&resourceid=AU_ADMINISTRATIVEUNIT_340118' + code)
    d = json.loads(get(u)); g = unary_union([shape(f['geometry']) for f in d['features']])
    if abs(g.bounds[1]) < 10:  # axis order lat/lon → swap
        g = transform(lambda x, y, z=None: (y, x), g)
    OUT_G[name] = transform(f4258, g)
src('outline', 'IGN — WFS unidades administrativas (au:AdministrativeUnit)', '2026', 'official', 'official municipal limits, simplified to 5 m for display', 'https://www.ign.es/wfs-inspire/unidades-administrativas', 'CC BY 4.0 — © IGN')
feats = []
for name, g in OUT_G.items():
    gs = g.simplify(5); feats.append({'type': 'Feature', 'properties': {'name': name, 'five': name in FIVE}, 'geometry': mapping(transform(inv, gs))})

# ---------------- spatial statistics per municipality ----------------
E = json.load(open(P('data/vec/base_edge.json'))); base = transform(fwd, shape([f for f in E['features'] if f['properties']['k'] == 'base'][0]['geometry']))
T = json.load(open(P('data/vec/tour_towns.json')))
towns = collections.defaultdict(float)
for f in T['features']: towns[f['properties']['nm']] += f['properties']['ha']
LU = json.load(open(P('data/vec/landuse_overview.json'))); lu_g = []
for f in LU['features']:
    c = f['properties'].get('lu')
    if c in ('farmland', 'orchard', 'meadow', 'farmyard', 'vineyard', 'greenhouse_horticulture', 'residential', 'industrial', 'retail', 'commercial', 'greenfield', 'construction', 'brownfield', 'grass', 'forest'):  # 5.53: brownfield too (land in transformation)
        try: lu_g.append((c, transform(fwd, shape(f['geometry']).buffer(0))))
        except Exception: pass
lu_tree = STRtree([g for _, g in lu_g])
def lu_ha(g):
    out = collections.defaultdict(float)
    for i in lu_tree.query(g):
        c, h = lu_g[i]
        try: out[c] += h.intersection(g).area / 1e4
        except Exception: pass
    return {k: round(v, 1) for k, v in out.items()}
# ex13b grids: GHS-POP (per-cell corners), LST / NDVI 90 m
DEN = json.load(open(P('data/ex13b/density.json'))); CL = json.load(open(P('data/ex13b/climate.json')))
cx, cy = np.array(DEN['corners']['x']), np.array(DEN['corners']['y']); pop = np.array(DEN['pop'], dtype=float)
pc = [((cx[i][j] + cx[i + 1][j + 1]) / 2, (cy[i][j] + cy[i + 1][j + 1]) / 2, pop[i][j]) for i in range(pop.shape[0]) for j in range(pop.shape[1])]
g = CL['grid']; x0, y1, cs = float(g['x0']), float(g['y1']), float(g['cell']); lst = CL['lst']; ndvi = CL['ndvi']
FRAME = box(437500, 4103500, 449500, 4113500)
# WorldCover 2021 tree class (10 m)
WC = json.load(open(P('data/manifest.json')))['canopy']['worldcover']; wc = np.array(Image.open(P('data', WC['file'])).convert('LA'))
def wc_share(g):
    b = g.bounds; i0, i1 = int((WC['oy'] - b[3]) / 10), int((WC['oy'] - b[1]) / 10) + 1; j0, j1 = int((b[0] - WC['ox']) / 10), int((b[2] - WC['ox']) / 10) + 1
    i0, j0 = max(i0, 0), max(j0, 0); i1, j1 = min(i1, wc.shape[0]), min(j1, wc.shape[1])
    if i1 <= i0 or j1 <= j0: return None, 0
    sub = wc[i0:i1:3, j0:j1:3]; tree = other = 0
    from shapely import contains_xy
    ii, jj = np.mgrid[i0:i1:3, j0:j1:3]; xs = WC['ox'] + (jj + 0.5) * 10; ys = WC['oy'] - (ii + 0.5) * 10
    inside = contains_xy(g, xs, ys); L, A = sub[..., 0], sub[..., 1]
    ok = inside & (A > 0) & (L >= 30); tree = int((ok & (L > 128)).sum()); n = int(ok.sum()); tot = int(inside.sum())
    return (round(tree / n * 100, 1) if n else None), (round(n / tot * 100) if tot else 0)
from shapely import contains_xy
CEN = json.load(open(P('data/ex13b/centre.json'))); HUM = json.load(open(P('data/ex13b/human.json')))
from shapely.geometry import Polygon
FAC = {k: [transform(fwd, shape(f['geometry'])).centroid for f in json.load(open(P(f'data/vec/fac_{k}.json')))['features']] for k in ('education', 'health', 'stay')}
FAC_CLS = {k: [f['properties'].get('cls') for f in json.load(open(P(f'data/vec/fac_{k}.json')))['features']] for k in ('education', 'health', 'stay')}
BUS = [(transform(fwd, shape(f['geometry'])), f['properties']) for f in json.load(open(P('data/vec/bus_service.json')))['features']]
# 5.53: every OSM footprint of the tiles once — centre, footprint, construction year (OSM start_date, else the Catastro cy)
import glob as _glob, re as _re
def year_of(p):
    sd = str(p.get('sd') or ''); m4 = _re.search(r'(1[0-9]{3}|20[0-9]{2})', sd)
    if m4: return int(m4.group(1))
    c = _re.match(r'^\s*~?C(\d{1,2})\b', sd, _re.I)
    if c: return (int(c.group(1)) - 1) * 100 + 1
    return p.get('cy')
BLD = []
for fn in sorted(_glob.glob(P('data/vec/buildings/*.json'))):
    if fn.endswith('index.json'): continue
    for f in json.load(open(fn))['features']:
        try: g = transform(fwd, shape(f['geometry']))
        except Exception: continue
        if g.is_empty: continue
        BLD.append((g.centroid, g, year_of(f['properties'])))
BTREE = STRtree([b[0] for b in BLD])
def blds_in(gm): return [BLD[i] for i in BTREE.query(gm) if gm.contains(BLD[i][0])]
for name, gm in OUT_G.items():
    m = R['munis'][name]; area = gm.area / 1e4
    sp = m['sp'] = {'area_ha': round(area, 1), 'base_ha': round(gm.intersection(base).area / 1e4, 1), 'town_ha': round(towns.get(name, 0), 1) if name in FIVE else None}
    sp['in_frame_pct'] = round(gm.intersection(FRAME).area / gm.area * 100)
    # 5.53 (owner: "it says no data although there is data"): what counts is where the buildings are, not the empty
    # mountain share of the municipality — the frame holds 99.6–100 % of the five towns' mapped buildings
    bb_ = blds_in(gm); sp['bld_n'] = len(bb_); sp['bld_frame_pct'] = round(sum(1 for b in bb_ if FRAME.contains(b[0])) / len(bb_) * 100, 1) if bb_ else None
    sp['yr_pct'] = round(sum(1 for b in bb_ if b[2]) / len(bb_) * 100, 1) if bb_ else None
    OK = (sp['bld_frame_pct'] or 0) >= 95; sp['frame_part'] = OK and sp['in_frame_pct'] < 95  # figures cover the part inside the frame
    sp['lu_ha'] = lu_ha(gm)
    # GHS-POP 2020 inside the outline (cell centres)
    sp['ghs_pop'] = round(sum(v for x, y, v in pc if gm.contains(Point(x, y)))) if OK else None
    # LST / NDVI: cells whose centre is inside
    vals_l, vals_n = [], []
    for i in range(len(lst)):
        for j in range(len(lst[i])):
            x, y = x0 + (j + .5) * cs, y1 - (i + .5) * cs
            if gm.contains(Point(x, y)):
                if lst[i][j] is not None: vals_l.append(lst[i][j])
                if ndvi[i][j] is not None: vals_n.append(ndvi[i][j])
    sp['lst'] = round(statistics.median(vals_l), 1) if vals_l and OK else None
    sp['ndvi'] = round(statistics.median(vals_n), 2) if vals_n and OK else None
    sp['lst_cells'] = len(vals_l)
    sh, cov = wc_share(gm); sp['tree_pct'] = sh if cov >= 95 else None; sp['tree_cov'] = cov
    for k, pts in FAC.items(): sp['n_' + k] = sum(1 for p in pts if gm.contains(p))
    sp['n_school'] = sum(1 for p, c in zip(FAC['education'], FAC_CLS['education']) if c in ('school', 'kindergarten') and gm.contains(p))
    bs = [pr for p, pr in BUS if gm.contains(p)]; sp['bus_stops'] = len(bs); sp['bus_trips'] = sum(pr.get('trips_day') or 0 for pr in bs)
    # people within 500 m (straight line) of a school and of a health facility — GHS-POP cells, spatial analysis
    if OK:
        for k in ('education', 'health'):
            pts = [p for p in FAC[k]]; tr = STRtree(pts); within = tot = 0
            for x, y, v in pc:
                if v <= 0 or not gm.contains(Point(x, y)): continue
                tot += v; q = Point(x, y)
                if any(pts[i].distance(q) <= 500 for i in tr.query(q.buffer(500))): within += v
            sp['reach500_' + k] = round(within / tot * 100, 1) if tot else None
    # ex13b: commerce points (shops, food, services) and public spaces (squares, parks ≥ 1,000 m², playgrounds, civic)
    for cat in ('retail', 'food', 'service', 'market'): sp['n_' + cat] = sum(1 for q in CEN['points'] if q[2] == cat and gm.contains(Point(q[0], q[1]))) if OK else None
    if OK:
        for kk in ('square', 'park'): sp['n_' + kk] = sum(1 for a in HUM['areas'][kk] if gm.contains(Polygon(a['p'][0]).representative_point()))
        for kk in ('playground', 'cafe', 'civic'): sp['n_' + kk] = sum(1 for q in HUM['points'][kk] if gm.contains(Point(q[0], q[1])))
    print(name, sp, flush=True)
src('sp_outline', 'IGN outlines × repository layers', '2026', 'spatial', 'areas measured in EPSG:25830 inside the official outline')
src('ghs', 'JRC GHSL — GHS-POP R2023A, 2020, 100 m', '2020', 'estimate', 'modelled residents per 100 m cell, summed by cell centre inside the outline', 'https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php', 'CC BY 4.0')
src('lst', 'USGS Landsat 8/9 Collection 2 surface temperature (ST_B10), June–August 2024–2026, 30 clear scenes', '2024–2026', 'spatial', 'median of the summer-median 90 m cells whose centre is inside the outline; Las Gabias and Alhendín: the part inside the 12 × 10 km frame, which holds 99.6 % and 100 % of their mapped buildings', 'https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature', 'public domain')
src('wc', 'ESA WorldCover 2021 v200, 10 m, class 10 tree cover', '2021', 'spatial', 'tree cells ÷ cells with data inside the outline (sampled every 30 m)', 'https://esa-worldcover.org', 'CC BY 4.0')
src('lu', 'OpenStreetMap landuse (supplied extract, 23 Oct 2026)', '2026', 'spatial', 'mapped land-use polygons intersected with the outline; unmapped land is not counted', None, 'ODbL 1.0')
src('reach', 'GHS-POP 2020 × OpenStreetMap schools / health facilities', '2020 / 2026', 'spatial', 'share of modelled residents within 500 m straight-line distance of a mapped facility — a spatial measure of proximity, not observed behaviour', None, 'CC BY 4.0 / ODbL')
src('bus', 'Bus stops and weekday trips (city file + CTAN consortium, Monday 26 Oct 2026)', '2026', 'official', 'scheduled trips per day summed over the stops inside the outline (a trip is counted at every stop it serves)', None, 'see layer sources')

# ---------------- 5.53: each town's built-up outline by year (owner: "a polygon of the town's boundary with its growth") ----------------
# Rebuilt from TODAY's buildings and their construction year: footprints of the buildings standing by year Y, each grown
# 30 m, merged, shrunk 20 m (a closing that joins a street block into one shape), pieces under 1 ha dropped, simplified 6 m.
# Demolished buildings are absent and buildings without a year are left out (their share is given) — an estimate.
GY = [1996, 2000, 2005, 2010, 2015, 2020, 2025]  # earlier years left out: few buildings in the old cores carry a year (Ogíjares: 35 dated before 1970)
GF = []
for name in FIVE:
    bb_ = blds_in(OUT_G[name]); dated = [b for b in bb_ if b[2]]
    for Y in GY:
        sel = [b[1].buffer(30, 4) for b in dated if b[2] <= Y]
        if not sel: continue
        u = unary_union(sel).buffer(-20, 4)
        parts = [q for q in (u.geoms if hasattr(u, 'geoms') else [u]) if q.area >= 1e4]
        if not parts: continue
        g = unary_union(parts).simplify(8)
        GF.append({'type': 'Feature', 'properties': {'name': name, 'y': Y, 'ha': round(g.area / 1e4, 1), 'n': len(sel)}, 'geometry': mapping(transform(inv, g))})
    print('growth', name, [(f['properties']['y'], f['properties']['ha']) for f in GF if f['properties']['name'] == name], flush=True)
def _rnd(o):
    if isinstance(o, float): return round(o, 5)
    if isinstance(o, (list, tuple)): return [_rnd(x) for x in o]
    if isinstance(o, dict): return {a: _rnd(b) for a, b in o.items()}
    return o
json.dump(_rnd({'type': 'FeatureCollection', 'years': GY, 'features': GF}), open(P('data/ref/research_growth.json'), 'w'), separators=(',', ':'))
src('growth', 'OSM footprints + construction year (OSM start_date, else Catastro INSPIRE 2026)', '1996–2025', 'estimate', 'built-up outline of the buildings standing in each year: footprints grown 30 m, merged, shrunk 20 m, pieces < 1 ha dropped; demolished buildings are missing and buildings without a year are left out', None, 'ODbL 1.0 / Catastro')

# ---------------- 100 m grid in the base frame: construction periods and floors ----------------
PER = ['pre_1900', '1900_1939', '1940_1959', '1960_1979', '1980_1999', '2000_plus', 'no_data']
cells = {}
L = json.load(open(P('data/vec/buildings_lite.json')))
for f in L['features']:
    try: c = transform(fwd, shape(f['geometry'])).centroid
    except Exception: continue
    if not FRAME.contains(c): continue
    k = (int((c.x - 437500) // 100), int((4113500 - c.y) // 100)); e = cells.setdefault(k, [0] * 7 + [[]])
    e[PER.index(f['properties'].get('period') or 'no_data')] += 1
import glob
for fn in glob.glob(P('data/vec/buildings/*.json')):
    if fn.endswith('index.json'): continue
    for f in json.load(open(fn))['features']:
        lv = f['properties'].get('lv')
        if not lv: continue
        try: c = transform(fwd, shape(f['geometry'])).centroid
        except Exception: continue
        if not FRAME.contains(c): continue
        k = (int((c.x - 437500) // 100), int((4113500 - c.y) // 100))
        if k in cells: cells[k][7].append(lv)
G = {'x0': 437500, 'y1': 4113500, 'cell': 100, 'nx': 120, 'ny': 100, 'periods': PER,
     'cells': [[i, j] + e[:7] + [round(statistics.median(e[7]), 1) if e[7] else None] for (i, j), e in sorted(cells.items())],
     'source': 'OpenStreetMap footprints (supplied extract) with the construction year from the OSM start_date or the Catastro (INSPIRE, 2026); floors = OSM building:levels',
     'method': 'each simplified footprint counted once in the 100 m EPSG:25830 cell that holds its centre; period = the app\'s construction classes; floors = median OSM building:levels of the footprints in the cell (null when none has one)'}
print('grid cells', len(G['cells']))
json.dump(G, open(P('data/ref/research_grid.json'), 'w'), separators=(',', ':'))
src('periods', 'OSM footprints + Catastro year of construction (INSPIRE Buildings, 2026)', '2026', 'historical', 'buildings counted per 100 m cell by construction period; buildings without a year are shown as unknown')
src('floors', 'OpenStreetMap building:levels', '2026', 'spatial', 'median floor count per 100 m cell; most footprints in the five towns have no floor count — those cells stay unknown')

# ---------------- climate (repository ERA5 + runner) ----------------
C = R['climate'] = {}
rain = json.load(open(P('data/climate/era5_rain_1991_2020.json'))); d0 = datetime.date(1991, 1, 1); mm = [0.0] * 12
for i, v in enumerate(rain['p']):
    mm[(d0 + datetime.timedelta(days=i)).month - 1] += v / 10
C['rain'] = [round(v / 30, 1) for v in mm]
src('rain', 'ERA5 reanalysis via Open-Meteo, cell 37.25 N 3.5 W', '1991–2020', 'official', 'mean monthly precipitation over 30 years (a 0.25° reanalysis cell, not a rain gauge)', 'https://open-meteo.com', 'CC BY 4.0')
wind = json.load(open(P('data/climate/era5_wind_2015_2024.json'))); rose = [0] * 8; calm = 0
for s, dd in zip(wind['s'], wind['d']):
    if s is None or dd is None: continue
    if s < 10: calm += 1; continue
    rose[int(((dd + 22.5) % 360) // 45)] += 1
n = sum(rose) + calm; C['wind'] = {'rose': [round(v / n * 100, 1) for v in rose], 'calm': round(calm / n * 100, 1)}
src('wind', 'ERA5 reanalysis via Open-Meteo, hourly 10 m wind', '2015–2024', 'official', 'share of hours by direction the wind blows from (8 sectors); calm = below 1 m/s', 'https://open-meteo.com', 'CC BY 4.0')
def runf(n):
    if RUN and os.path.exists(os.path.join(RUN, n)): return json.load(open(os.path.join(RUN, n)))
    return None
t = runf('era5_temp_1991_2024.json')
if t:
    dl = t['daily']; mx, mn, me = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list); hot = collections.Counter(); trop = collections.Counter()
    for day, a, b, c in zip(dl['time'], dl['temperature_2m_max'], dl['temperature_2m_min'], dl['temperature_2m_mean']):
        y, mo = int(day[:4]), int(day[5:7])
        if a is not None and a >= 35: hot[y] += 1
        if b is not None and b >= 20: trop[y] += 1
        if y <= 2020:
            if a is not None: mx[mo].append(a)
            if b is not None: mn[mo].append(b)
            if c is not None: me[mo].append(c)
    C['temp'] = {'max': [round(statistics.mean(mx[m]), 1) for m in range(1, 13)], 'min': [round(statistics.mean(mn[m]), 1) for m in range(1, 13)], 'mean': [round(statistics.mean(me[m]), 1) for m in range(1, 13)]}
    C['hot'] = {str(y): hot.get(y, 0) for y in range(1991, 2025)}; C['trop'] = {str(y): trop.get(y, 0) for y in range(1991, 2025)}
    C['cell'] = [t.get('latitude'), t.get('longitude'), t.get('elevation')]
    src('temp', 'ERA5 reanalysis via Open-Meteo, daily 2 m temperature at the base', '1991–2020 (normals) · 1991–2024 (hot days)', 'official', 'monthly means of the daily maximum, mean and minimum; hot days = daily maximum ≥ 35 °C; tropical nights = minimum ≥ 20 °C. A 0.25° reanalysis cell: regional, not street-level', 'https://open-meteo.com', 'CC BY 4.0')
t = runf('cmip6_1950_2050.json')
if t:
    dl = t['daily']; ann = {}
    for k, vs in dl.items():
        if not k.startswith('temperature_2m_max'): continue
        model = k.replace('temperature_2m_max_', '') or 'model'; by = collections.defaultdict(list)
        for day, v in zip(dl['time'], vs):
            if v is not None: by[int(day[:4])].append(v)
        ann[model] = {str(y): round(statistics.mean(v), 2) for y, v in by.items() if len(v) > 300}
    C['cmip6'] = ann
    src('cmip6', 'CMIP6 HighResMIP (7 models) via Open-Meteo Climate API — daily maximum temperature at the base', '1950–2050', 'projection', 'annual mean of the daily maximum per model, high-emission forcing (HighResMIP, SSP5-8.5 after 2015); the band is the spread of the models. No downscaled series to 2076 was available to the atlas', 'https://open-meteo.com/en/docs/climate-api', 'CC BY 4.0')
for tag in ('base', 'city'):
    t = runf(f'air_{tag}_2023_2025.json')
    if t: C['air_' + tag] = t['monthly']
if 'air_base' in C: src('air', 'CAMS European air-quality model via Open-Meteo (PM2.5, PM10, NO2)', '2023–2025', 'estimate', 'monthly mean of hourly model values at the base and at the city centre — a model on a ~10 km grid, NOT a measurement; no official monitoring station stands in the five towns', 'https://open-meteo.com/en/docs/air-quality-api', 'CC BY 4.0')
t = runf('sepe_paro.json')
if t and t.get('rows'):
    SE = {}
    for r in t['rows']:
        code = (r.get('Codigo Municipio') or '').replace('.0', ''); mo = (r.get('Código mes') or '').replace('.0', '')
        name = next((n for n, c, _ in MUN if c == code), None)
        if name and mo: SE.setdefault(name, {})[mo] = {'total': int(float(r.get('total Paro Registrado') or 0)), 'agri': int(float(r.get('Paro Agricultura') or 0)),
            'ind': int(float(r.get('Paro Industria') or 0)), 'cons': int(float(r.get('Paro Construcción') or 0)), 'serv': int(float(r.get('Paro Servicios') or 0)),
            'u25': int(float(r.get('Paro hombre edad < 25') or 0)) + int(float(r.get('Paro mujer edad < 25') or 0))}
    for name, by in SE.items(): R['munis'][name]['sepe'] = by
    last = max(max(v) for v in SE.values()); R['sepe_month'] = last
    src('sepe', 'SEPE — Paro registrado por municipios (open data, first half of 2026)', last[:4] + '-' + last[4:], 'official', 'people registered as job seekers without work at the public employment service at the end of each month — registrations, not an unemployment rate', t.get('url'), 'open data (SEPE)')
# RD 511/1989 (BOE 13 May 1989): the official coordinates of the aerodrome (transcribed from the BOE PDF; DMS → decimal)
dms = lambda d, m, s_: d + m / 60 + s_ / 3600
R['rd1989'] = {'ref': [-dms(3, 38, 4), dms(37, 8, 4), 688], 'thr18': [-dms(3, 38, 3), dms(37, 8, 25), 676], 'thr36': [-dms(3, 38, 5), dms(37, 7, 43), 700],
    'runway': {'name': '18-36', 'length_m': 1303, 'width_m': 30}, 'heli_zone': [[-dms(3, 38, 32), dms(37, 8, 6)], [-dms(3, 38, 18), dms(37, 8, 5)], [-dms(3, 38, 19), dms(37, 7, 56)], [-dms(3, 38, 33), dms(37, 7, 57)]],
    'tower': [-dms(3, 37, 55), dms(37, 8, 15), 699], 'note': 'The easement surfaces themselves follow Decreto 584/1972 (replaced by RD 369/2023 from 1 July 2023); their plans were sent to the town halls and are not published — the atlas does not draw them.'}
src('rd1989', 'Real Decreto 511/1989, de 28 de abril — servidumbres aeronáuticas del Aeródromo Militar de Armilla (BOE 13 May 1989, pp. 14325–14326)', '1989', 'official', 'reference point, runway 18-36 thresholds and helicopter area transcribed from the annex (geographic coordinates)', 'https://www.boe.es/boe/dias/1989/05/13/pdfs/A14325-14326.pdf', 'BOE (public)')
t = runf('miteco_index.json'); R['flood'] = {}
if t:
    R['flood']['index'] = t; FLF = []
    KEEP = {'agua:Zi_laminas_q10': 'q10', 'agua:Zi_laminas_q100': 'q100', 'agua:Zi_laminas_q500': 'q500', 'agua:ZI_Laminas_ZFP': 'zfp', 'agua:Zi_arpsi': 'arpsi', 'agua:DPH_Estimado': 'dph'}
    BF = {}; bl = []
    for f in L['features']:
        try: bl.append(transform(fwd, shape(f['geometry'])).centroid)
        except Exception: pass
    btree = STRtree(bl)
    for n, k in KEEP.items():
        d = runf('miteco_' + ''.join(ch if ch.isalnum() else '_' for ch in n) + '.json')
        if not d: continue
        try: zg = unary_union([transform(fwd, shape(f['geometry'])).buffer(0) for f in d['features'] if f.get('geometry')]).intersection(FRAME.buffer(3000))
        except Exception as e: print('flood', n, e); continue
        for name, gm in OUT_G.items():
            z = zg.intersection(gm); nb = sum(1 for i in btree.query(z) if z.contains(bl[i])) if not z.is_empty else 0
            R['munis'][name].setdefault('flood', {})[k] = {'ha': round(z.area / 1e4, 1), 'bld': nb}
        BF[k] = round(zg.intersection(base).area / 1e4, 1)
        gs = zg.simplify(6) if k != 'arpsi' else zg
        FLF.append({'type': 'Feature', 'properties': {'k': k}, 'geometry': mapping(transform(inv, gs))})
        print('flood', k, round(zg.area / 1e4, 1), 'ha', flush=True)
    def rnd(o):
        if isinstance(o, float): return round(o, 5)
        if isinstance(o, (list, tuple)): return [rnd(x) for x in o]
        if isinstance(o, dict): return {a: rnd(b) for a, b in o.items()}
        return o
    json.dump(rnd({'type': 'FeatureCollection', 'features': FLF}), open(P('data/ref/research_flood.json'), 'w'), separators=(',', ':'))
    src('flood', 'MITECO — Sistema Nacional de Cartografía de Zonas Inundables (SNCZI), WFS gis.miteco.gob.es/geoserver/agua', '2026 (studies of different dates)', 'official', 'modelled flood extents for return periods of 10, 100 and 500 years, the preferential-flow zone and ARPSI reaches; buildings counted by footprint centre inside each extent (OSM, simplified)', 'https://www.miteco.gob.es/es/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html', 'MITECO open data')
R['outline'] = {'type': 'FeatureCollection', 'features': feats}
R['base'] = {'flood_ha': (BF if 'BF' in dir() else None), 'area_ha': round(base.area / 1e4, 1), 'by_muni': {n: R['munis'][n]['sp']['base_ha'] for n in R['munis']}}
json.dump(R, open(P('data/ref/research.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('wrote research.json', os.path.getsize(P('data/ref/research.json')), 'bytes')
