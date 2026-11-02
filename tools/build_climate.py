"""Dated snapshot of the ERA5 reanalysis grid cell over Granada (Open-Meteo Historical Weather API, CC BY 4.0).
The two periods are closed (2015–2024 hourly wind, 1991–2020 daily rain), so the values never change; shipping them
removes the dependence on a per-visitor API quota (Open-Meteo free tier: 600 units/min, 5,000/h per IP; one wind
request costs ~52 units, one rain request ~78). Compact encoding, exact values:
  wind: s = speed × 10 (m/s, as returned with 1 decimal), d = direction in degrees, hourly from t0 (UTC), null kept as null
  rain: p = precipitation_sum × 10 (mm), daily from t0 (Europe/Madrid days), null kept as null
Usage: python3 tools/build_climate.py  (needs internet; writes data/climate/era5_wind_2015_2024.json and
era5_rain_1991_2020.json)"""
import json, os, sys, urllib.request, datetime
API = 'https://archive-api.open-meteo.com/v1/archive'; LAT, LON = '37.1773', '-3.5986'
WIND = f'{API}?latitude={LAT}&longitude={LON}&start_date=2015-01-01&end_date=2024-12-31&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC&models=era5'
RAIN = f'{API}?latitude={LAT}&longitude={LON}&start_date=1991-01-01&end_date=2020-12-31&daily=precipitation_sum&timezone=Europe%2FMadrid&models=era5'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'climate')
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'granada-atlas snapshot'}), timeout=180) as r: return json.load(r)
def i10(v): return None if v is None else int(round(v * 10))
def meta(j, url):
    return {'source': 'ERA5 reanalysis (ECMWF / Copernicus Climate Change Service) via Open-Meteo Historical Weather API',
            'license': 'CC BY 4.0 (Open-Meteo); ERA5 © ECMWF / Copernicus C3S', 'request': url,
            'retrieved': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'latitude': j['latitude'], 'longitude': j['longitude'], 'elevation': j.get('elevation'), 'grid': '0.25° ERA5 cell (centre as returned)'}
def main():
    os.makedirs(OUT, exist_ok=True)
    w = get(WIND); h = w['hourly']
    t = h['time']; t0 = datetime.datetime.fromisoformat(t[0])
    assert all(datetime.datetime.fromisoformat(x) == t0 + datetime.timedelta(hours=i) for i, x in enumerate(t)), 'hourly series not contiguous'
    wo = dict(meta(w, WIND), period='2015-01-01 – 2024-12-31 (UTC hours)', t0=t[0], step='1h', n=len(t), units={'s': 'm/s × 10 at 10 m', 'd': 'degrees (from)'},
              s=[i10(v) for v in h['wind_speed_10m']], d=[None if v is None else int(round(v)) for v in h['wind_direction_10m']])
    json.dump(wo, open(os.path.join(OUT, 'era5_wind_2015_2024.json'), 'w'), separators=(',', ':'))
    r = get(RAIN); d = r['daily']; d0 = datetime.date.fromisoformat(d['time'][0])
    assert all(datetime.date.fromisoformat(x) == d0 + datetime.timedelta(days=i) for i, x in enumerate(d['time'])), 'daily series not contiguous'
    ro = dict(meta(r, RAIN), period='1991-01-01 – 2020-12-31 (Europe/Madrid days)', t0=d['time'][0], step='1d', n=len(d['time']), units={'p': 'mm × 10 per day'},
              p=[i10(v) for v in d['precipitation_sum']])
    json.dump(ro, open(os.path.join(OUT, 'era5_rain_1991_2020.json'), 'w'), separators=(',', ':'))
    print('wind', wo['n'], 'rain', ro['n'], wo['latitude'], wo['longitude'])
if __name__ == '__main__': main()
