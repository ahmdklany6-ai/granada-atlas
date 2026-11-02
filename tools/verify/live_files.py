"""Runner-side: download every published file the page uses from the PUBLIC site and compare it byte for byte with the
checkout (git main). Proves which code and data the live URL serves, independent of browser rendering."""
import hashlib, json, os, re, subprocess, time, urllib.request
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'
subprocess.run(['git', 'fetch', '--quiet', 'origin', 'main'], check=True); subprocess.run(['git', 'checkout', '--quiet', 'origin/main'], check=True)
html = open('index.html', encoding='utf8').read()
files = ['index.html', 'version.json', 'data/manifest.json'] + sorted(set(re.findall(r'(?:src|href)="((?:js|css|vendor)/[^"?]+)', html)))
files += ['data/climate/era5_wind_2015_2024.json', 'data/climate/era5_rain_1991_2020.json', 'data/ref/history_places.json', 'data/vec/trees_osm.json']
same = diff = 0
for f in files:
    try:
        b = urllib.request.urlopen(urllib.request.Request(SITE + f + '?nocache=' + str(time.time()), headers={'Cache-Control': 'no-cache'}), timeout=60).read()
        ok = hashlib.sha256(b).hexdigest() == hashlib.sha256(open(f, 'rb').read()).hexdigest()
        same += ok; diff += (not ok); print(('same ' if ok else 'DIFF ') + f, len(b), flush=True)
    except Exception as e: diff += 1; print('ERR  ' + f, e, flush=True)
print(f'LIVE FILES: {same} identical to git main {subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()}, {diff} different/missing')
