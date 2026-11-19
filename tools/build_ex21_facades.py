#!/usr/bin/env python3
"""Exercise 2.1 — which Catastro parcel each building of the 1:500 areas belongs to, and the list of parcels whose façade
shows in a section (owner, 19 Nov 2026: real façades instead of period guesses).

Step 1 (this tool): every building part in data/ex21/areas.json gets `ref` = the 14-character cadastral reference of the
parcel it stands on (matched in space against the Catastro INSPIRE buildings, $CATASTRO = folder with the five towns'
A.ES.SDGC.BU.<code>.building.gml). It then lists, per area, the buildings up to 100 m behind the section plane — the ones
the section tool draws as elevations — in $OUT/behind.json, and with FETCH=1 downloads the Catastro's façade photo of each
parcel (Sede Electrónica del Catastro, OVCFotoFachada) into $OUT/fotos/ (NOT into the repository: the photos are the
Catastro's and show streets, cars and people; only what is read from them goes into data/ex21/facades.json, by hand).
Usage: CATASTRO=… OUT=<scratch folder> [FETCH=1] [AREAS=B,C] python3 tools/build_ex21_facades.py"""
import json, os, sys, time, urllib.request
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); CAT = os.environ['CATASTRO']; OUT = os.environ['OUT']
NS = {'g': 'http://www.opengis.net/gml/3.2', 'e': 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0'}; GID = '{http://www.opengis.net/gml/3.2}id'
TOWNS = ['18022', '18064', '18083', '18148', '18015']
URL = 'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfLibres/OVCFotoFachada.svc/RecuperarFotoFachadaGet?ReferenciaCatastral='
d = json.load(open(os.path.join(ROOT, 'data/ex21/areas.json'))); only = os.environ.get('AREAS'); areas = [a for a in d['areas'] if not only or a['id'] in only.split(',')]
zone = unary_union([box(*a['extent']).buffer(60) for a in d['areas']])
polys, refs = [], []
for code in TOWNS:
    for ev, el in ET.iterparse(os.path.join(CAT, f'A.ES.SDGC.BU.{code}.building.gml'), events=('end',)):
        if el.tag != '{%s}Building' % NS['e']: continue
        env = el.find('.//{%s}Envelope' % NS['g']); lo = [float(v) for v in env.find('g:lowerCorner', NS).text.split()]; hi = [float(v) for v in env.find('g:upperCorner', NS).text.split()]
        if box(lo[0], lo[1], hi[0], hi[1]).intersects(zone):
            ps = []
            for pp in el.iter('{%s}PolygonPatch' % NS['g']):
                v = [float(x) for x in pp.find('g:exterior', NS).find('.//g:posList', NS).text.split()]; c = list(zip(v[0::2], v[1::2]))
                if len(c) >= 4: p = Polygon(c); ps.append(p if p.is_valid else p.buffer(0))
            if ps: polys.append(unary_union(ps)); refs.append(el.get(GID).split('.')[-1][:14])
        el.clear()
tree = STRtree(polys); print(len(polys), 'Catastro buildings near the areas', file=sys.stderr)
n = m = 0
for a in d['areas']:
    for b in a['buildings']:
        try: p = Polygon(b['r'][0][0]).representative_point()
        except Exception: continue
        n += 1; hit = [i for i in tree.query(p) if polys[i].contains(p)]
        if hit: b['ref'] = refs[hit[0]]; m += 1
print('building parts', n, 'matched to a parcel', m, file=sys.stderr)
json.dump(d, open(os.path.join(ROOT, 'data/ex21/areas.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
# the buildings each section shows as elevations: the same rule as tools/export_ex21_sections_svg.py (behind the plane, ≤ 100 m)
behind = {}
for a in areas:
    s = a['section']; L = s['samples'][-1][0]; ax, ay = s['a']; bx, by = s['b']; ux, uy = (bx - ax) / L, (by - ay) / L; vx, vy = -uy, ux
    proj = lambda p: ((p[0] - ax) * ux + (p[1] - ay) * uy, (p[0] - ax) * vx + (p[1] - ay) * vy)
    def rows(sign, lim):
        out = []
        for b in a['buildings']:
            if not b.get('lv'): continue
            st = [proj(p) for rr in b['r'] for r in rr for p in r]; ts = [sign * t for _, t in st]
            if 0.5 < min(ts) < lim:
                s0, s1 = max(0, min(q for q, _ in st)), min(L, max(q for q, _ in st))
                if s1 - s0 > 0.5: out.append({'t': round(min(ts), 1), 's0': round(s0, 1), 's1': round(s1, 1), 'lv': b['lv'], 'b': b.get('b'), 'y': b.get('y'), 'hu': bool(b.get('hu')), 'ref': b.get('ref')})
        return out
    sign = max((1, -1), key=lambda sg: sum(q['s1'] - q['s0'] for q in rows(sg, 180)))
    behind[a['id']] = sorted(rows(sign, 100), key=lambda q: (q['s0'], q['t']))
    print(a['id'], len(behind[a['id']]), 'elevations,', len({q['ref'] for q in behind[a['id']] if q['ref']}), 'parcels', file=sys.stderr)
os.makedirs(os.path.join(OUT, 'fotos'), exist_ok=True); json.dump(behind, open(os.path.join(OUT, 'behind.json'), 'w'), indent=1)
if os.environ.get('FETCH'):
    want = sorted({q['ref'] for v in behind.values() for q in v if q['ref']}); got = miss = 0
    for r in want:
        fn = os.path.join(OUT, 'fotos', r + '.jpg')
        if os.path.exists(fn): got += 1; continue
        try:
            rq = urllib.request.urlopen(urllib.request.Request(URL + r, headers={'User-Agent': 'atlas-print/1.0'}), timeout=60); raw = rq.read()
            if rq.headers.get('Content-Type', '').startswith('image/') and len(raw) > 3000: open(fn, 'wb').write(raw); got += 1
            else: miss += 1
        except Exception as e: miss += 1; print('no photo', r, str(e)[:60], file=sys.stderr)
        time.sleep(0.6)
    print('photos', got, 'of', len(want), '· none for', miss, file=sys.stderr)
