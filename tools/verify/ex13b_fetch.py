"""5.48 — third Exercise 1.3 analysis frame around Armilla air base and the five towns that touch it (Armilla, Churriana
de la Vega, Las Gabias, Alhendín, Ogíjares): EPSG:25830 x 437500–449500, y 4103500–4113500 (12 × 10 km). The city frame
(y ≥ 4110000) and the factory frame (x ≤ 441000) each cover only an edge of the base. Same fetch as the factory frame
(ex13_fetch.py: GHS-POP 2020, Landsat 8/9 summer LST + NDVI, OSM places, OSM buildings / streets / land use /
municipalities, GHSL built-up 2020). Files go to out/ex13b; the data-fetch workflow pushes them to a data branch."""
import os, runpy
os.environ.update({'FRAME': '437500,4103500,449500,4113500', 'OUTDIR': 'out/ex13b', 'EXTRA': '1', 'ONLY': 'pop,landsat,osm,ghsl'})
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ex13_fetch.py'), run_name='__main__')
