"""Runner-side A/B probe: does the main map stay responsive after a move with the REAL basemap tiles? Serves build 5.10
(commit ff6dc0c) and the current checkout from localhost (same real tiles and services), moves the map and records whether
the page's main thread keeps answering and how many frames render — so a slow software GPU can be told apart from a
regression. Prints a timeline; no screenshots."""
import os, subprocess, sys, time, json, threading
from playwright.sync_api import sync_playwright
REFS = [('5.10', 'ff6dc0c'), ('current', 'HEAD')]
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
def log(*a): print(time.strftime('%H:%M:%S'), *a, flush=True)
subprocess.run(['git', 'fetch', '--quiet', '--unshallow'], check=False)
for i, (name, ref) in enumerate(REFS):
    d = f'/tmp/wt_{name}'; subprocess.run(['git', 'worktree', 'add', '--force', d, ref], check=True, capture_output=True)
    port = 8900 + i; srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    with sync_playwright() as p:
        for vp in [(1100, 700)]:
            b = p.chromium.launch(args=ARGS); pg = b.new_page(viewport={'width': vp[0], 'height': vp[1]})
            pg.on('console', lambda m: m.type in ('error', 'warning') and 'WebGL' not in m.text and log(name, 'console', m.type, m.text[:200]))
            pg.on('pageerror', lambda e: log(name, 'PAGEERROR', str(e)[:300]))
            pg.add_init_script("window.__noPanelHook = true; window.__frames = 0; window.__beat = 0; setInterval(() => { window.__beat++; }, 1000);")
            t0 = time.time(); pg.goto(f'http://127.0.0.1:{port}/index.html', wait_until='load', timeout=120000)
            pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.app.map.loaded()', timeout=300000); log(name, 'loaded in', round(time.time() - t0, 1), 's, build', pg.evaluate('window.GA_BUILD'))
            pg.evaluate("GA.app.map.on('render', () => window.__frames++)")
            for (c, z) in [([-3.5986, 37.1773], 14.0), ([-3.5930, 37.1760], 16.0), ([-3.0, 37.3], 4.5)]:
                pg.evaluate(f"window.__moved = false; setTimeout(() => {{ GA.app.map.jumpTo({{ center: {json.dumps(c)}, zoom: {z} }}); window.__moved = true; }}, 0)")
                t1 = time.time(); ok = True
                try: pg.wait_for_function('window.__moved && GA.app.map.loaded() && GA.app.map.areTilesLoaded()', timeout=240000, polling=1000)
                except Exception as e: ok = False
                try: st = pg.evaluate('[window.__beat, window.__frames, GA.app.map.getZoom(), GA.app.map.loaded(), GA.app.map.areTilesLoaded()]')
                except Exception as e: st = 'evaluate failed: ' + str(e)[:80]
                log(name, f'move to z{z}:', 'settled' if ok else 'NOT settled in 240 s', f'after {round(time.time() - t1, 1)} s; beats/frames/zoom/loaded/tiles =', st)
                # is the main thread alive? beats should advance by ~10 in 10 s
                b0 = pg.evaluate('window.__beat'); f0 = pg.evaluate('window.__frames'); time.sleep(10); b1 = pg.evaluate('window.__beat'); f1 = pg.evaluate('window.__frames')
                log(name, f'  next 10 s: timer beats +{b1 - b0}, frames +{f1 - f0}')
            b.close()
    srv.terminate()
