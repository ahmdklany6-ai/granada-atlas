import base64, gzip, subprocess, sys
subprocess.run([sys.executable, 'tools/build_history_places.py'], check=True)
b = base64.b64encode(gzip.compress(open('data/ref/history_places.json', 'rb').read())).decode()
print('===FILE history_places.json==='); [print(b[i:i + 4000]) for i in range(0, len(b), 4000)]; print('===END===')
