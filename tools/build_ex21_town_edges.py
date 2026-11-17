#!/usr/bin/env python3
"""Exercise 2.1 — the built-up edge of each of the five towns at the date of each historical picture (owner, 17 Nov 2026:
"on the aerial photos of every year, mark the limits of the five towns").

Source: Dirección General del Catastro, INSPIRE buildings ($CATASTRO = folder with A.ES.SDGC.BU.<code>.building.gml of
Armilla 18022, Churriana de la Vega 18064, Las Gabias 18083, Ogíjares 18148, Alhendín 18015): footprint and recorded year of
construction. For a picture of year Y: the footprints with a year <= Y in that municipality, joined (buffer +80 m, -65 m),
pieces under 4 ha dropped (farmhouses, small clusters), simplified 8 m, clipped to the city frame.

Honesty: the Catastro holds TODAY's buildings with their recorded year; a demolished building is missing and a rebuilt one
carries its new year, so an old edge can be drawn too small. The edge is where today's buildings say the town reached by that
year, not a survey of the photo. Dates of the pictures as IGN gives them for this spot (GetFeatureInfo, 17 Nov 2026):
1956-57 American flight, Nacional 03/1985, OLISTAT 04/1998, SIGPAC 2001; the Interministerial flight has no date here (1973-1986):
its edge uses 1973, the earliest year it can be. Ogíjares: the Catastro records 1,189 of its 4,313 buildings with the year 1986
(a cadastral revision, not 1,189 buildings in one year), so its edge before 1987 is not known and is not drawn (null).
Output: data/ex21/town_edges.json. Usage: CATASTRO=… python3 tools/build_ex21_town_edges.py"""
import json, os, sys
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon, box, mapping
from shapely.ops import unary_union
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); CAT = os.environ['CATASTRO']
F = (440100, 4106400, 446500, 4112000); FB = box(*F)
TOWNS = {'18022': 'Armilla', '18064': 'Churriana de la Vega', '18083': 'Las Gabias', '18148': 'Ogíjares', '18015': 'Alhendín'}
UNKNOWN_BEFORE = {'Ogíjares': 1987}   # see the docstring
YEARS = {'mtn50': 1931, 'ams1956': 1956, 'inter1973': 1973, 'nac1981': 1985, 'olistat1997': 1998, 'sigpac2000': 2001, 'pnoa2004': 2004, 'pnoa2010': 2010, 'pnoa2016': 2016, 'pnoa2022': 2022}
NS = {'g': 'http://www.opengis.net/gml/3.2', 'e': 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0', 'c': 'http://inspire.jrc.ec.europa.eu/schemas/bu-core2d/2.0'}
def polys(el):
    out = []
    for pp in el.iter('{%s}PolygonPatch' % NS['g']):
        ext = pp.find('g:exterior', NS)
        if ext is None: continue
        v = [float(x) for x in ext.find('.//g:posList', NS).text.split()]; c = list(zip(v[0::2], v[1::2]))
        if len(c) >= 4: p = Polygon(c); out.append(p if p.is_valid else p.buffer(0))
    return out
B = {t: [] for t in TOWNS.values()}
for code, town in TOWNS.items():
    for ev, el in ET.iterparse(os.path.join(CAT, f'A.ES.SDGC.BU.{code}.building.gml'), events=('end',)):
        if el.tag != '{%s}Building' % NS['e']: continue
        yr = el.find('.//c:dateOfConstruction//c:beginning', NS); y = int(yr.text[:4]) if yr is not None and yr.text and yr.text[:4].isdigit() else None
        g = unary_union(polys(el))
        if y and not g.is_empty and g.intersects(FB.buffer(500)): B[town].append((y, g))
        el.clear()
    print(town, len(B[town]), 'dated buildings near the frame', file=sys.stderr)
out = {'years': YEARS, 'towns': list(TOWNS.values()), 'edges': {}, 'ha': {},
       'source': 'D. G. del Catastro, INSPIRE buildings: footprints with a recorded year of construction up to the picture year, joined (+80 m / -65 m), pieces under 4 ha left out',
       'caveat': "Today's buildings by recorded year: demolished buildings are missing and rebuilt ones carry their new year, so an old edge can be drawn too small. The Interministerial flight (1973-1986) has no date for this spot: its edge uses 1973. Ogíjares before 1987 is not drawn: its Catastro dates 1,189 buildings 1986 (a revision year)."}
for key, Y in YEARS.items():
    out['edges'][key] = {}; out['ha'][key] = {}
    for town, L in B.items():
        if Y < UNKNOWN_BEFORE.get(town, 0): out['edges'][key][town] = None; out['ha'][key][town] = None; continue
        gs = [g for y, g in L if y <= Y]
        if not gs: out['edges'][key][town] = []; out['ha'][key][town] = 0; continue
        u = unary_union([g.buffer(80, 6) for g in gs]).buffer(-65, 6)
        parts = [p for p in (u.geoms if hasattr(u, 'geoms') else [u]) if p.area >= 40000]
        u = unary_union(parts).simplify(8).intersection(FB) if parts else Polygon()
        rings = []
        for p in (u.geoms if hasattr(u, 'geoms') else [u]):
            if p.is_empty or p.geom_type != 'Polygon': continue
            rings.append([[[round(x, 1), round(y, 1)] for x, y in p.exterior.coords]] + [[[round(x, 1), round(y, 1)] for x, y in r.coords] for r in p.interiors])
        out['edges'][key][town] = rings; out['ha'][key][town] = round(u.area / 1e4, 1)
    print(key, Y, out['ha'][key], file=sys.stderr)
json.dump(out, open(os.path.join(ROOT, 'data/ex21/town_edges.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
