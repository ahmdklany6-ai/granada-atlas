#!/usr/bin/env python3
"""Exercise 2.1 — who lives around the base (owner request, 16 Nov 2026: "who are the people around the base — soldiers?
what do they do, how old are they, everything").

Sources (INE, Instituto Nacional de Estadística; the API at servicios.ine.es/wstempus, saved in $INE):
- ADRH (Atlas de distribución de renta de los hogares), Granada, by CENSUS SECTION and municipality, 2024:
  table 31033 "Indicadores demográficos" (mean age, % under 18, % 65 and over, mean household size, % one-person
  households, population, % Spanish nationality) and table 31025 (net income per person; the latest year published).
  Files: adrh_31033.json, adrh_31025.json (DATOS_TABLA/<id>?nult=1) and adrh33_g0.json (VALORES_GRUPOSTABLA/31033/91370:
  the names and codes of the territorial units).
- Censo de Población (annual census), by MUNICIPALITY (500 residents or more), filtered with tv=19:<id> per town:
  69991 employed by occupation (CNO, 1 digit), 69992 employed by branch of activity (CNAE letter), 69993 employed by
  professional situation, 67078 population 16+ by age group and relation with activity, 66620 population 15+ by age
  group and education. Files: tabs/t<id>.json.
- Census sections (boundaries): INE "seccionado_2024" (EPSG:25830), $SECC = path without extension of SECC_CE_20240101.

Honesty: no public table counts soldiers among the residents. The census tables used here have no "military
occupations" group, and the branch "Public administration and defence; compulsory social security" mixes soldiers with
every civil servant — it is an UPPER BOUND for people working in defence, not a count of soldiers. The base's own staff
may live anywhere. Section values are INE's; nothing is estimated here.
Output: data/ex21/people.json.  Usage: INE=… SECC=… python3 tools/build_ex21_people.py
"""
import json, os, re, sys
from collections import defaultdict
import shapefile
from shapely.geometry import shape, box
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INE = os.environ['INE']; SECC = os.environ['SECC']
F = (440100, 4106400, 446500, 4112000); FB = box(*F)
TOWNS = {'Armilla': '18021', 'Churriana de la Vega': '18062', 'Las Gabias': '18905', 'Alhendín': '18014', 'Ogíjares': '18145', 'Granada': '18087', 'Escúzar': '18072'}
INE_NAME = {'Las Gabias': 'Gabias, Las'}
IND = {'Edad media de la población': 'age', 'Porcentaje de población menor de 18 años': 'u18', 'Porcentaje de población de 65 y más años': 'o65',
       'Tamaño medio del hogar': 'hh', 'Porcentaje de hogares unipersonales': 'one', 'Población': 'pop', 'Porcentaje de población española': 'es'}
# branches of activity (CNAE letters) grouped for a readable chart
BR = [('trade', ['Comercio al por mayor']), ('hospitality', ['Hostelería']), ('health', ['Actividades sanitarias']), ('education', ['Educación']),
      ('public', ['Administración pública y defensa']), ('industry', ['Industria manufacturera', 'Industrias extractivas', 'Suministro de energía', 'Suministro de agua']),
      ('construction', ['Construcción']), ('transport', ['Transporte y almacenamiento']), ('office', ['Información y comunicaciones', 'Actividades financieras', 'Actividades inmobiliarias', 'Actividades profesionales', 'Actividades administrativas']),
      ('farming', ['Agricultura']), ('other', ['Actividades artísticas', 'Otros servicios', 'Actividades de los hogares', 'Actividades de organizaciones', 'No consta'])]
OCC = [('managers', 'Directores'), ('professionals', 'Técnicos y profesionales científicos'), ('technicians', 'Técnicos; profesionales de apoyo'), ('clerks', 'Empleados contables'),
       ('services', 'Trabajadores de los servicios'), ('farm', 'Trabajadores cualificados en el sector agrícola'), ('crafts', 'Artesanos'), ('operators', 'Operadores'),
       ('elementary', 'Ocupaciones elementales'), ('unknown', 'No consta')]
SIT = [('employer', 'Empresario con asalariados'), ('self', 'Empresario sin asalariados'), ('permanent', 'fijo o indefinido'), ('temporary', 'temporal')]
EDU = [('primary', 'Educación primaria'), ('lower_sec', 'Primera etapa'), ('upper_sec', 'Segunda etapa'), ('higher', 'Educación superior')]


def val(s): return s['Data'][0]['Valor'] if s.get('Data') else None


def year(s): return s['Data'][0].get('Anyo') if s.get('Data') else None


def main():
    # ---- census sections in the frame, with ADRH indicators and income ----
    units = {u['Nombre']: u['Codigo'] for u in json.load(open(os.path.join(INE, 'adrh33_g0.json')))}
    sec = defaultdict(dict); muni = defaultdict(dict); yrs = set()
    for s in json.load(open(os.path.join(INE, 'adrh_31033.json'))):
        name, ind = s['Nombre'].split('. ')[0], s['Nombre'].split('. ')[1]
        k = IND.get(ind); code = units.get(name)
        if not k or not code or val(s) is None: continue
        yrs.add(year(s)); (sec if len(code) == 10 else muni)[code][k] = val(s)
    inc_y = set()
    for s in json.load(open(os.path.join(INE, 'adrh_31025.json'))):
        if 'Renta neta media por persona' not in s['Nombre'] or val(s) is None: continue
        code = units.get(s['Nombre'].split('. ')[0])
        if code: (sec if len(code) == 10 else muni)[code]['inc'] = val(s); inc_y.add(year(s))
    r = shapefile.Reader(SECC); feats = []
    for sr in r.iterShapeRecords():
        d = sr.record.as_dict()
        if d['CPRO'] != '18': continue
        g = shape(sr.shape.__geo_interface__)
        if not g.intersects(FB): continue
        g = g.simplify(4)
        rings = [[[[round(x, 1), round(y, 1)] for x, y in p.exterior.coords]] for p in ([g] if g.geom_type == 'Polygon' else g.geoms)]
        feats.append({'c': d['CUSEC'], 'm': d['NMUN'], 'r': rings, 'ha': round(g.area / 1e4, 1), **sec.get(d['CUSEC'], {})})
    print('sections in frame', len(feats), 'with data', sum(1 for f in feats if 'age' in f), 'ADRH years', yrs, 'income years', inc_y, file=sys.stderr)

    # ---- per town (census) ----
    T = {t: json.load(open(os.path.join(INE, 'tabs', f't{t}.json'))) for t in (69991, 69992, 69993, 67078, 66620)}
    towns = {}
    for town, code in TOWNS.items():
        nm = INE_NAME.get(town, town) + '. '
        def rows(t): return [s for s in T[t] if s['Nombre'].startswith(nm) and s.get('Data')]
        o = {'code': code, 'adrh': muni.get(code, {})}
        occ = rows(69991); tot = next((val(s) for s in occ if s['Nombre'].startswith(nm + 'Total. Total.')), None); o['employed'] = tot; o['census_year'] = year(occ[0]) if occ else None
        o['occupation'] = {k: sum(val(s) for s in occ if s['Nombre'].startswith(nm + 'Total. ') and pat in s['Nombre']) for k, pat in OCC}
        br = rows(69992); o['branch'] = {k: sum(val(s) for s in br if s['Nombre'].startswith(nm + 'Total. ') and any(p in s['Nombre'] for p in pats)) for k, pats in BR}
        o['public_defence_men'] = sum(val(s) for s in br if s['Nombre'].startswith(nm + 'Hombres. ') and 'Administración pública y defensa' in s['Nombre'])
        si = rows(69993); o['situation'] = {k: sum(val(s) for s in si if s['Nombre'].startswith(nm + 'Total. ') and pat in s['Nombre']) for k, pat in SIT}
        ac = rows(67078); g = lambda pat: next((val(s) for s in ac if s['Nombre'].startswith(nm + pat)), None)
        o['activity'] = {'pop16': g('16 y más años. Total. Total. Total.'), 'employed': g('16 y más años. Ocupado/a. Total. Total.'), 'unemployed': g('16 y más años. Parado/a. Total. Total.'), 'inactive': g('Total. 16 y más años. Total. Inactivo/a.')}
        a = o['activity']; o['unemployment_pct'] = round(a['unemployed'] / (a['employed'] + a['unemployed']) * 100, 1) if a['employed'] else None
        ages = {}
        for s in ac:
            m = re.match(re.escape(nm) + r'Total\. (De \d+ a \d+ años|\d+ y más años)\. Total\. Total\.', s['Nombre'])
            if m: ages[m.group(1)] = val(s)
        o['age16'] = ages; o['activity_year'] = year(ac[0]) if ac else None
        ed = rows(66620); o['education15'] = {k: sum(val(s) for s in ed if s['Nombre'].startswith(nm + '15 y más años. ') and pat in s['Nombre'] and '. Total. Total.' in s['Nombre']) for k, pat in EDU}
        o['education_year'] = year(ed[0]) if ed else None
        towns[town] = o
        print(town, 'employed', tot, 'public+defence', o['branch']['public'], round(o['branch']['public'] / tot * 100, 1) if tot else None, '% | unemployment', o['unemployment_pct'], '| higher ed', o['education15']['higher'], '| age', o['adrh'].get('age'), file=sys.stderr)
    out = {'frame': list(F), 'sections': feats, 'towns': towns, 'adrh_year': max(yrs), 'income_year': max(inc_y) if inc_y else None,
           'sources': 'INE: Atlas de distribución de renta de los hogares (ADRH), Granada, tables 31033 (demographic indicators) and 31025 (net income per person), by census section; Censo de Población, tables 69991, 69992, 69993, 67078, 66620, by municipality; INE census section boundaries (seccionado 2024).',
           'caveats': 'No public table counts soldiers among the residents: "Public administration and defence" mixes soldiers with all civil servants (an upper bound). The base\'s staff may live anywhere. Values are INE\'s; a section is about 1,000–2,500 people.'}
    json.dump(out, open(os.path.join(ROOT, 'data/ex21/people.json'), 'w'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
