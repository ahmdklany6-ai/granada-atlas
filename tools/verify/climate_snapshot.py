"""Runner-side: build the climate snapshot and print it (gzip + base64 between markers) so it can be committed by hand."""
import base64, gzip, os, subprocess, sys
subprocess.run([sys.executable, 'tools/build_climate.py'], check=True)
for f in sorted(os.listdir('data/climate')):
    b = base64.b64encode(gzip.compress(open('data/climate/' + f, 'rb').read())).decode()
    print(f'===FILE {f}==='); [print(b[i:i + 4000]) for i in range(0, len(b), 4000)]; print('===END===')
