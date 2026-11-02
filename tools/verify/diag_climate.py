"""Diagnose the wind/rain loading on the live site: raw HTTP to Open-Meteo, then the real page in Chromium."""
import json, re, subprocess, time, urllib.request
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'
src = open('js/layers_v9.js', encoding='utf8').read()
api = 'https://archive-api.open-meteo.com/v1/archive'; LAT, LON = '37.1773', '-3.5986'
urls = {
  'wind': f'{api}?latitude={LAT}&longitude={LON}&start_date=2015-01-01&end_date=2024-12-31&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC&models=era5',
  'rain': f'{api}?latitude={LAT}&longitude={LON}&start_date=1991-01-01&end_date=2020-12-31&daily=precipitation_sum&timezone=Europe%2FMadrid&models=era5',
}
for k, u in urls.items():
    for attempt in range(2):
        t0 = time.time()
        out = subprocess.run(['curl', '-sS', '-m', '120', '-D', '-', '-o', f'/tmp/{k}.json', '-w', '\\nCODE %{http_code} SIZE %{size_download} TIME %{time_total}\\n', '-H', 'Origin: https://ahmdklany6-ai.github.io', u], capture_output=True, text=True)
        print('==', k, attempt, out.stdout[-1500:], out.stderr[-500:])
        try:
            body = open(f'/tmp/{k}.json', encoding='utf8').read(); print('BODY', body[:400])
        except Exception as e: print('nobody', e)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    log = []
    pg.on('console', lambda m: log.append(('console', m.type, m.text[:300])))
    pg.on('pageerror', lambda e: log.append(('pageerror', str(e)[:300])))
    pg.on('requestfailed', lambda r: log.append(('reqfailed', r.url[:160], r.failure)))
    pg.on('response', lambda r: 'open-meteo' in r.url and log.append(('resp', r.status, r.url[:160], r.headers.get('access-control-allow-origin'))))
    pg.goto(SITE, wait_until='load', timeout=90000); pg.wait_for_function('window.GA && GA.app && GA.app.L', timeout=60000)
    print('BUILD', pg.evaluate('window.GA_BUILD'))
    pg.evaluate("GA.app.L.setOn('wind', true); GA.app.L.setOn('rain', true)")
    for i in range(24):
        st = pg.evaluate("[GA.app.L.S.wind.status, GA.app.L.S.wind.statusExtra, GA.app.L.S.rain.status, GA.app.L.S.rain.statusExtra]")
        print(i * 5, 's', st)
        if st[0] not in ('loading', 'idle') and st[2] not in ('loading', 'idle'): break
        time.sleep(5)
    for l in log: print('LOG', l)
    b.close()
