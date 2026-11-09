"""5.26 item 12 — second Exercise 1.3 analysis frame around the Escúzar estate (CITAI / IFMIF-DONES) and the gap from the
metro terminus: EPSG:25830 x 429000–441000, y 4101000–4111000 (12 × 10 km). Same fetch as the city frame (ex13_fetch.py:
GHS-POP 2020, Landsat 8/9 summer LST + NDVI, OSM places) plus what the atlas' local data lacks out here: OSM buildings,
streets, land use, municipal boundaries and GHSL built-up 2020. Files go to out/ex13f (GitLab job artifacts)."""
import os, runpy
os.environ.update({'FRAME': '429000,4101000,441000,4111000', 'OUTDIR': 'out/ex13f', 'EXTRA': '1', 'ONLY': 'pop,landsat,osm,ghsl'})
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ex13_fetch.py'), run_name='__main__')
