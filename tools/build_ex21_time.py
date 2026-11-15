#!/usr/bin/env python3
"""Exercise 2.1 — the base over time (owner request, 15 Nov 2026): how the place grew, how crowded it is, how it could
grow, how the built-up grew. Frame = the city frame of js/ex21.js (CITY, EPSG:25830 440100–446500 × 4106400–4112000).

Sources
- Dirección General del Catastro, INSPIRE buildings (ATOM zip per municipality; free reuse naming the D. G. del Catastro
  as author and owner): footprint, recorded year of construction, floors above ground, dwellings, use. Armilla 18022,
  Churriana de la Vega 18064, Las Gabias 18083, Ogíjares 18148, Alhendín 18015, Cúllar Vega 18058, Granada 18900.
  Folder $CATASTRO (the *.building.gml and *.buildingpart.gml of each).
- INE table 2871 (padrón continuo, residents on 1 January, 1996–2025, no 1997): $INE/t2871.json
  (https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/2871?nult=30).
- data/ex21/easements.json + allowed_height.png (aeronautical ceiling, approximate) and data/vec/base_edge.json (base, OSM).
- the 1931 aerodrome: its green fill on the IGN MTN50 first edition, sheet 1026 "Padul" (1931), measured by colour on a
  4 m/pixel GetMap of the frame ($MTN50 = that JPEG) — approximate.

Honesty
- Catastro years are the recorded year of construction of the buildings standing TODAY; demolished buildings are not in
  it and a major refurbishment can carry a later year. The "built by period" map therefore shows what exists now, by age —
  not the full history of the place.
- The projection is a scenario ("if the pace of 2015–2025 continued"), not a forecast. "Where it could grow" is a
  measurement of land that is still open next to the towns, not a plan.

Outputs: data/ex21/time.json (statistics, series, scenario numbers), data/ex21/built_period.png (2 m/px, colour = period),
data/ex21/density.png (dwellings per hectare, 100 m cells), data/ex21/edge_land.png (open land next to the towns, by
aeronautical ceiling).
Usage: CATASTRO=… INE=… MTN50=… python3 tools/build_ex21_time.py
"""
import glob, json, math, os, re, sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from shapely.geometry import Polygon, box, shape, Point
from shapely.ops import unary_union, transform as shp_transform
from pyproj import Transformer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.environ.get('CATASTRO'); INE = os.environ.get('INE'); MTN = os.environ.get('MTN50')
F = (440100, 4106400, 446500, 4112000); FB = box(*F)
PX = 2.0                                      # m per pixel of the period picture
TOWNS = {'18022': 'Armilla', '18064': 'Churriana de la Vega', '18083': 'Las Gabias', '18148': 'Ogíjares', '18015': 'Alhendín', '18058': 'Cúllar Vega', '18900': 'Granada'}
FIVE = ['Armilla', 'Churriana de la Vega', 'Las Gabias', 'Alhendín', 'Ogíjares']
PERIODS = [('pre_1940', 0, 1940), ('1940_1969', 1940, 1970), ('1970_1989', 1970, 1990), ('1990_1999', 1990, 2000), ('2000_2007', 2000, 2008), ('2008_2015', 2008, 2016), ('2016_plus', 2016, 9999)]
PCOL = {'pre_1940': (47, 70, 84), '1940_1969': (79, 110, 128), '1970_1989': (127, 157, 174), '1990_1999': (201, 216, 223),
        '2000_2007': (201, 139, 128), '2008_2015': (153, 43, 42), '2016_plus': (90, 29, 34)}   # js/palette.js: blueDark, blueDeep, blueMid, bluePale, rose, red, oxblood
NS = {'e': 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0', 'c': 'http://inspire.jrc.ec.europa.eu/schemas/bu-core2d/2.0', 'g': 'http://www.opengis.net/gml/3.2'}
GID = '{http://www.opengis.net/gml/3.2}id'
fwd = Transformer.from_crs(4326, 25830, always_xy=True).transform


def period(y):
    if not y: return None
    return next(k for k, a, b in PERIODS if a <= y < b)


def polys(el):
    out = []
    for pp in el.iter('{%s}PolygonPatch' % NS['g']):
        ext = pp.find('g:exterior', NS)
        if ext is None: continue
        v = [float(x) for x in ext.find('.//g:posList', NS).text.split()]; c = list(zip(v[0::2], v[1::2]))
        holes = []
        for r in pp.findall('g:interior', NS):
            w = [float(x) for x in r.find('.//g:posList', NS).text.split()]; holes.append(list(zip(w[0::2], w[1::2])))
        if len(c) >= 4:
            p = Polygon(c, [h for h in holes if len(h) >= 4]); out.append(p if p.is_valid else p.buffer(0))
    return out


def load_catastro():
    """every building of each municipality: year, dwellings, footprint, use; geometry only when it touches the frame"""
    B = {}
    for code, town in TOWNS.items():
        fn = os.path.join(CAT, f'A.ES.SDGC.BU.{code}.building.gml')
        for ev, el in ET.iterparse(fn, events=('end',)):
            if el.tag != '{%s}Building' % NS['e']: continue
            env = el.find('.//{%s}Envelope' % NS['g']); lo = [float(v) for v in env.find('g:lowerCorner', NS).text.split()]; hi = [float(v) for v in env.find('g:upperCorner', NS).text.split()]
            inside = not (hi[0] < F[0] or lo[0] > F[2] or hi[1] < F[1] or lo[1] > F[3])
            yr = el.find('.//c:dateOfConstruction//c:beginning', NS); use = el.find('e:currentUse', NS); dw = el.find('e:numberOfDwellings', NS)
            oa = el.find('.//e:OfficialArea/e:value', NS)
            g = unary_union(polys(el)) if inside or code != '18900' else None
            B[el.get(GID).split('.')[-1]] = {'town': town, 'y': int(yr.text[:4]) if yr is not None and yr.text and yr.text[:4].isdigit() else None,
                                             'dw': int(dw.text) if dw is not None and dw.text else 0, 'use': use.text if use is not None else None,
                                             'g': g, 'in': inside, 'fl': None}
            el.clear()
        # floors (only needed inside the frame)
        fn = os.path.join(CAT, f'A.ES.SDGC.BU.{code}.buildingpart.gml')
        for ev, el in ET.iterparse(fn, events=('end',)):
            if el.tag != '{%s}BuildingPart' % NS['e']: continue
            ref = el.get(GID).split('.')[-1].split('_part')[0]; b = B.get(ref)
            if b and b['in']:
                fl = el.find('e:numberOfFloorsAboveGround', NS)
                if fl is not None and fl.text and fl.text.isdigit(): b['fl'] = max(b['fl'] or 0, int(fl.text))
            el.clear()
        print(town, sum(1 for b in B.values() if b['town'] == town), 'buildings', file=sys.stderr)
    return B


def ine_series():
    d = json.load(open(os.path.join(INE, 't2871.json'))); out = {}
    names = {'Gabias, Las': 'Las Gabias'}
    for s in d:
        m = re.match(r'^(.+?)\. Total\. Total habitantes', s['Nombre'])
        if not m: continue
        n = names.get(m.group(1), m.group(1))
        if n in FIVE + ['Granada', 'Cúllar Vega'] and n not in out: out[n] = {str(x['Anyo']): int(x['Valor']) for x in s['Data'] if x.get('Valor') is not None}
    # 'Granada' appears twice (province, then municipality): keep the municipality (smaller)
    prov = [s for s in d if s['Nombre'].startswith('Granada. Total. Total habitantes')]
    if len(prov) == 2:
        a, b = ({str(x['Anyo']): int(x['Valor']) for x in p['Data']} for p in prov); out['Granada'] = a if a['2025'] < b['2025'] else b
    return out


def main():
    B = load_catastro(); pop = ine_series()
    base = shp_transform(fwd, shape(next(f for f in json.load(open(os.path.join(ROOT, 'data/vec/base_edge.json')))['features'] if f['properties'].get('k') == 'base')['geometry']))
    W, H = int((F[2] - F[0]) / PX), int((F[3] - F[1]) / PX)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(img)
    def pix(c): return [((x - F[0]) / PX, (F[3] - y) / PX) for x, y in c]
    inb = [b for b in B.values() if b['in'] and b['g'] is not None and not b['g'].is_empty]
    for b in sorted(inb, key=lambda q: q['y'] or 0):
        col = PCOL.get(period(b['y']), (189, 181, 170))
        for p in ([b['g']] if b['g'].geom_type == 'Polygon' else list(getattr(b['g'], 'geoms', []))):
            if p.geom_type != 'Polygon': continue
            dr.polygon(pix(p.exterior.coords), fill=col + (255,))
            for h in p.interiors: dr.polygon(pix(h.coords), fill=(0, 0, 0, 0))
    img.save(os.path.join(ROOT, 'data/ex21/built_period.png'), optimize=True)

    # density: dwellings per hectare in 100 m cells (a building's dwellings go to the cell of its centre)
    C = 100; nx, ny = int((F[2] - F[0]) / C), int((F[3] - F[1]) / C); dens = np.zeros((ny, nx)); built = np.zeros((ny, nx))
    for b in inb:
        c = b['g'].representative_point(); i, j = int((c.x - F[0]) // C), int((F[3] - c.y) // C)
        if 0 <= i < nx and 0 <= j < ny: dens[j, i] += b['dw']; built[j, i] += b['g'].area
    DB = [(1, 10), (10, 25), (25, 50), (50, 100), (100, 1e9)]
    DCOL = [(235, 217, 211), (201, 139, 128), (153, 43, 42), (90, 29, 34), (41, 16, 12)]
    dimg = np.zeros((ny, nx, 4), dtype=np.uint8)
    for (lo, hi), col in zip(DB, DCOL): dimg[(dens >= lo) & (dens < hi)] = col + (235,)
    Image.fromarray(dimg, 'RGBA').save(os.path.join(ROOT, 'data/ex21/density.png'), optimize=True)

    # open land next to the towns: 100 m cells with < 3 % built cover, outside the base, within 300 m of a cell with
    # ≥ 15 % cover; classed by the aeronautical ceiling (allowed height, approximate) at the cell centre
    ease = json.load(open(os.path.join(ROOT, 'data/ex21/easements.json'))); E = ease['extent']
    ah = np.asarray(Image.open(os.path.join(ROOT, 'data/ex21/allowed_height.png')).convert('RGBA')); ec = ah.shape[1] / (E[2] - E[0])
    cover = built / (C * C); dense = cover >= 0.15; near = ndimage.binary_dilation(dense, iterations=3)
    cls = {tuple(c[3][:3]): c[2] for c in ease['classes']}
    edge = np.zeros((ny, nx), dtype=object); eimg = np.zeros((ny, nx, 4), dtype=np.uint8); edge_ha = Counter()
    ECOL = {'above': (41, 16, 12), '0-15': (90, 29, 34), '15-30': (153, 43, 42), '30-60': (201, 139, 128), 'free': (126, 123, 67)}
    for j in range(ny):
        for i in range(nx):
            if cover[j, i] >= 0.03 or not near[j, i]: continue
            x, y = F[0] + (i + 0.5) * C, F[3] - (j + 0.5) * C
            if base.contains(Point(x, y)): continue
            pi, pj = int((x - E[0]) * ec), int((E[3] - y) * ec); k = 'free'
            if 0 <= pj < ah.shape[0] and 0 <= pi < ah.shape[1] and ah[pj, pi, 3] > 0: k = cls.get(tuple(ah[pj, pi, :3]), 'free')
            eimg[j, i] = ECOL[k] + (215,); edge_ha[k] += 1
    Image.fromarray(eimg, 'RGBA').save(os.path.join(ROOT, 'data/ex21/edge_land.png'), optimize=True)

    # statistics per town (whole municipality, Catastro) and in the frame
    st = {}
    for town in FIVE + ['Granada', 'Cúllar Vega']:
        bb = [b for b in B.values() if b['town'] == town]
        dec = defaultdict(int); dwd = defaultdict(int)
        for b in bb:
            if b['y']: dec[b['y'] // 10 * 10] += 1; dwd[b['y'] // 10 * 10] += b['dw']
        st[town] = {'buildings': len(bb), 'dwellings': sum(b['dw'] for b in bb), 'dwellings_by_decade': {str(k): v for k, v in sorted(dwd.items())},
                    'dw_2015_2024': sum(b['dw'] for b in bb if b['y'] and 2015 <= b['y'] <= 2024), 'no_year': sum(1 for b in bb if not b['y'])}
        p = pop.get(town, {})
        if p.get('2025') and st[town]['dwellings']: st[town]['persons_per_dwelling'] = round(p['2025'] / st[town]['dwellings'], 2)
    fp = defaultdict(float)
    for b in inb: fp[period(b['y']) or 'none'] += b['g'].intersection(FB).area
    # scenario: the pace of 2015–2025 continued (residents, compound annual rate) — per town and the five together
    proj = {}
    for town in FIVE + ['Granada']:
        p = pop[town]; r = (p['2025'] / p['2015']) ** (1 / 10) - 1
        proj[town] = {'rate_pct': round(r * 100, 2), '2035': round(p['2025'] * (1 + r) ** 10), '2045': round(p['2025'] * (1 + r) ** 20)}
    five25 = sum(pop[t]['2025'] for t in FIVE); five15 = sum(pop[t]['2015'] for t in FIVE); r5 = (five25 / five15) ** 0.1 - 1
    proj['five'] = {'rate_pct': round(r5 * 100, 2), '2025': five25, '2035': round(five25 * (1 + r5) ** 10), '2045': round(five25 * (1 + r5) ** 20)}
    ppd = sum(pop[t]['2025'] for t in FIVE) / sum(st[t]['dwellings'] for t in FIVE)
    proj['five']['dwellings_needed_2045'] = round((proj['five']['2045'] - five25) / ppd)
    # the base as land (hypothetical): its area at the dwelling density of the five towns' 100 m cells that hold homes
    res_cells = dens[dens >= 1]; med = float(np.median(res_cells)) if res_cells.size else 0
    base_ha = base.area / 1e4
    scen = {'base_ha': round(base_ha, 1), 'median_dw_per_ha': round(med, 1), 'dwellings': round(base_ha * med), 'residents': round(base_ha * med * ppd), 'persons_per_dwelling': round(ppd, 2)}
    # 1931: the aerodrome on the MTN50 (green fill, largest blob), approximate
    a1931 = None
    if MTN:
        a = np.asarray(Image.open(MTN).convert('RGB')).astype(int); R, G, Bc = a[..., 0], a[..., 1], a[..., 2]; m = (G > R + 25) & (G > Bc + 10) & (G < 200)
        lab, n = ndimage.label(ndimage.binary_closing(m, iterations=3)); sizes = ndimage.sum(m, lab, range(1, n + 1)); mpx = (F[2] - F[0]) / a.shape[1]
        a1931 = round(float(sizes.max()) * mpx * mpx / 1e4, 0)
    out = {'frame': list(F), 'periods': [[k, a, b, list(PCOL[k])] for k, a, b in PERIODS], 'density_breaks': [list(q) for q in DB], 'density_colours': [list(c) for c in DCOL],
           'edge_colours': {k: list(v) for k, v in ECOL.items()}, 'edge_ha': dict(edge_ha), 'footprint_ha_by_period': {k: round(v / 1e4, 1) for k, v in fp.items()},
           'towns': st, 'population': pop, 'projection': proj, 'base_scenario': scen, 'aerodrome_1931_ha': a1931, 'base_ha_today': round(base_ha, 1),
           'sources': 'D. G. del Catastro (INSPIRE buildings): year, dwellings, footprints; INE table 2871: residents 1996–2025; Ministerio de Defensa (RD 118/2019) via data/ex21/easements.json: ceiling; IGN MTN50 1931 (sheet 1026): the 1931 aerodrome; OSM: the base outline',
           'caveats': 'Catastro years = buildings standing today, by recorded year of construction (demolished buildings missing; refurbishments can carry a later year). Projection = the pace of 2015–2025 continued, a scenario. Edge land = open 100 m cells next to built cells, not a plan. 1931 area measured on the map by colour, approximate.'}
    json.dump(out, open(os.path.join(ROOT, 'data/ex21/time.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: out[k] for k in ('footprint_ha_by_period', 'edge_ha', 'projection', 'base_scenario', 'aerodrome_1931_ha', 'base_ha_today')}, ensure_ascii=False, indent=0), file=sys.stderr)
    print({t: (st[t]['buildings'], st[t]['dwellings'], st[t].get('persons_per_dwelling'), st[t]['dw_2015_2024']) for t in st}, file=sys.stderr)


if __name__ == '__main__':
    main()
