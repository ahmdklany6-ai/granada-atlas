"""Runner-only downloads for build 5.52 — the research tour (14 chapters) around the Armilla air base and its five towns.
The build sandbox cannot reach these hosts; this runs on the GitHub runner (.github/workflows/data-fetch.yml,
workflow_dispatch script=research_fetch.py dir=research branch=claude/data-research) and writes raw files to out/research.
Each part is independent; a failure is logged in fetch_log.json and the rest continues. Nothing here is published as is:
tools/build_research.py reads these files, keeps the figures the tour needs and records source, year and method.
  1. ERA5 daily temperature 1991-2020 + 1991-2024 hot days at the base (Open-Meteo Historical Weather API, CC BY 4.0)
  2. CMIP6 HighResMIP daily maximum temperature 1950-2050 at the base (Open-Meteo Climate API, CC BY 4.0) — a projection
  3. CAMS European air-quality reanalysis/forecast, PM2.5 / PM10 / NO2, 2023-2025, base + Granada centre (Open-Meteo
     Air Quality API, CC BY 4.0) — a model, not a measurement
  4. SEPE registered unemployment by municipality (open-data XLS, latest semester found), rows of the five towns + Granada
  5. BOE: the 1989 Real Decreto on the aeronautical easements of the Armilla military aerodrome (PDF, public)
  6. MITECO WFS (gis.miteco.gob.es/geoserver/agua): flood-zone and historical-flood feature types inside the base frame"""
import io, json, os, re, sys, time, urllib.parse, urllib.request
UA = {'User-Agent': 'GranadaAtlas-build/1.0 (static research site; one-off fetch)'}
OUT = os.path.join('out', os.environ.get('DIR', 'research')); os.makedirs(OUT, exist_ok=True)
BASE = (37.135, -3.633); CITY = (37.176, -3.598)
FRAME = (-3.72, 37.07, -3.56, 37.17)   # lon/lat around the base frame (data/ex13b)
MUNIS = {'18014': 'Alhendín', '18021': 'Armilla', '18062': 'Churriana de la Vega', '18905': 'Las Gabias', '18145': 'Ogíjares', '18087': 'Granada'}
log = {}
def get(u, t=240, tries=4):
    for k in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
        except Exception as e: print('retry', u[:140], e, flush=True); time.sleep(5 + 10 * k)
    return None
def save(name, data):
    if isinstance(data, (dict, list)): data = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
    open(os.path.join(OUT, name), 'wb').write(data); print('wrote', name, len(data), 'bytes', flush=True)
def part(name, fn):
    try: fn(); log[name] = 'ok'
    except Exception as e:
        import traceback; traceback.print_exc(); log[name] = repr(e)[:500]

def era5():
    q = {'latitude': BASE[0], 'longitude': BASE[1], 'start_date': '1991-01-01', 'end_date': '2024-12-31',
         'daily': 'temperature_2m_max,temperature_2m_min,temperature_2m_mean', 'timezone': 'Europe/Madrid'}
    b = get('https://archive-api.open-meteo.com/v1/archive?' + urllib.parse.urlencode(q)); save('era5_temp_1991_2024.json', json.loads(b))

def cmip6():
    models = 'CMCC_CM2_VHR4,FGOALS_f3_H,HiRAM_SIT_HR,MRI_AGCM3_2_S,EC_Earth3P_HR,MPI_ESM1_2_XR,NICAM16_8S'
    q = {'latitude': BASE[0], 'longitude': BASE[1], 'start_date': '1950-01-01', 'end_date': '2050-12-31', 'models': models,
         'daily': 'temperature_2m_max,temperature_2m_mean', 'timezone': 'Europe/Madrid'}
    b = get('https://climate-api.open-meteo.com/v1/climate?' + urllib.parse.urlencode(q), t=600); save('cmip6_1950_2050.json', json.loads(b))

def air():
    for tag, (la, lo) in (('base', BASE), ('city', CITY)):
        q = {'latitude': la, 'longitude': lo, 'start_date': '2023-01-01', 'end_date': '2025-12-31', 'hourly': 'pm2_5,pm10,nitrogen_dioxide', 'timezone': 'Europe/Madrid', 'domains': 'cams_europe'}
        b = get('https://air-quality-api.open-meteo.com/v1/air-quality?' + urllib.parse.urlencode(q)); d = json.loads(b)
        h = d.get('hourly', {}); out = {'meta': {k: v for k, v in d.items() if k != 'hourly'}, 'monthly': {}}
        for i, ts in enumerate(h.get('time', [])):
            m = ts[:7]; o = out['monthly'].setdefault(m, {'n': 0, 'pm2_5': 0.0, 'pm10': 0.0, 'no2': 0.0, 'nn': [0, 0, 0]})
            for j, (k, src) in enumerate((('pm2_5', 'pm2_5'), ('pm10', 'pm10'), ('no2', 'nitrogen_dioxide'))):
                v = h.get(src, [None] * (i + 1))[i]
                if v is not None: o[k] += v; o['nn'][j] += 1
        for m, o in out['monthly'].items():
            for j, k in enumerate(('pm2_5', 'pm10', 'no2')): o[k] = round(o[k] / o['nn'][j], 2) if o['nn'][j] else None
        save(f'air_{tag}_2023_2025.json', out)

def sepe():
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'xlrd', 'openpyxl'], check=False)
    cands = []
    for y in (2026, 2025, 2024):
        for s in ('primer', 'segundo'):
            for ext in ('xls', 'xlsx'):
                cands.append(f'https://sede.sepe.gob.es/es/portaltrabaja/resources/sede/datos_abiertos/datos/Paro_por_municipios_{s}_semestre_{y}_{ext}.{ext}')
    rows, used = [], None
    for u in cands:
        b = get(u, t=300, tries=1)
        if not b or len(b) < 100000: continue
        used = u; print('SEPE file', u, len(b), flush=True)
        try:
            if u.endswith('.xls'):
                import xlrd; wb = xlrd.open_workbook(file_contents=b); sh = wb.sheet_by_index(0); it = (sh.row_values(r) for r in range(sh.nrows))
            else:
                import openpyxl; wb = openpyxl.load_workbook(io.BytesIO(b), read_only=True); it = wb.worksheets[0].iter_rows(values_only=True)
            head = None
            for r in it:
                cells = [str(c).strip() if c is not None else '' for c in r]
                if head is None and any('Código mes' in c or 'Codigo mes' in c or 'Municipio' in c for c in cells): head = cells; continue
                if head and any(re.sub(r'\.0$', '', c) in MUNIS for c in cells): rows.append(dict(zip(head, cells)))
        except Exception as e: print('parse failed', e); continue
        if rows: break
    save('sepe_paro.json', {'url': used, 'rows': rows})
    if not rows: raise RuntimeError('no SEPE rows found')

def boe():
    for u in ('https://www.boe.es/boe/dias/1989/05/13/pdfs/A14325-14326.pdf', 'https://www.boe.es/boe/dias/1989/05/13/pdfs/A14326-14326.pdf'):
        b = get(u)
        if b: save(os.path.basename(u), b)
    # the BOE open-data search for later decrees on Armilla
    b = get('https://www.boe.es/buscar/boe.php?' + urllib.parse.urlencode({'campo[0]': 'TITULOS', 'dato[0]': 'Armilla servidumbres', 'accion': 'Buscar'}))
    if b: save('boe_search_armilla.html', b)

def miteco():
    base = 'https://gis.miteco.gob.es/geoserver/agua/wfs'
    cap = get(base + '?service=WFS&request=GetCapabilities&version=2.0.0')
    if not cap: raise RuntimeError('no capabilities')
    save('miteco_wfs_capabilities.xml', cap)
    names = re.findall(r'<(?:wfs:)?Name>([^<]+)</(?:wfs:)?Name>', cap.decode('utf-8', 'ignore'))
    want = [n for n in names if re.search(r'(inund|zi_|t100|t500|t10|arpsi|hist|dph|zfp|zona_?flujo)', n, re.I)]
    print('feature types', len(names), 'matching', want, flush=True); got = {}
    for n in want[:24]:
        q = {'service': 'WFS', 'request': 'GetFeature', 'version': '2.0.0', 'typeNames': n, 'outputFormat': 'application/json', 'srsName': 'EPSG:4326',
             'bbox': f'{FRAME[1]},{FRAME[0]},{FRAME[3]},{FRAME[2]},urn:ogc:def:crs:EPSG::4326', 'count': 5000}
        b = get(base + '?' + urllib.parse.urlencode(q), tries=2)
        if not b: got[n] = 'failed'; continue
        try: d = json.loads(b); k = len(d.get('features', []))
        except Exception: got[n] = 'not json ' + b[:200].decode('utf-8', 'ignore'); continue
        got[n] = k
        if k: save('miteco_' + re.sub(r'\W+', '_', n) + '.json', d)
    save('miteco_index.json', got)

part('era5', era5); part('cmip6', cmip6); part('air', air); part('sepe', sepe); part('boe', boe); part('miteco', miteco)
save('fetch_log.json', log); print(json.dumps(log, indent=1))
