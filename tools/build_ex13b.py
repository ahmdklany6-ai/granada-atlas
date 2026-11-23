"""Exercise 1.3 — THIRD analysis frame (5.48): the Base Aérea de Armilla and the towns around its fence.
EPSG:25830 x 437500–449500, y 4103500–4113500 (12 × 10 km). The city frame (data/ex13) stops at y = 4,110,000, which runs
through the base, so the five analyses were empty at the base and south of it. Same builder, sources, method, classes and
colours as the factory frame (tools/build_ex13f.py, run with EX13_ZONE=base); the "zone" figures are for the base outline.
Usage: python3 tools/build_ex13b.py <raw dir from tools/verify/ex13b_fetch.py>  → data/ex13b/*.json + fg.png"""
import os, runpy, sys
os.environ['EX13_ZONE'] = 'base'
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_ex13f.py'), run_name='__main__')
