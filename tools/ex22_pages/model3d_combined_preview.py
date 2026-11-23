"""Preview pictures of ex22_three_alternatives (model3d_combined.py): one picture per alternative, the other two layers off,
colours read from the .mtl. Usage: python3 tools/ex22_pages/model3d_combined_preview.py <folder>. Not part of the site or tests."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
D = sys.argv[1]; sys.argv = [sys.argv[0], D]
import importlib.util
spec = importlib.util.spec_from_file_location('pv', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model3d_preview.py'))
src = open(spec.origin).read().split('\nfor nm in (')[0].replace("D = sys.argv[1]", "D = None")
ns = {'__file__': spec.origin}; exec(compile(src, spec.origin, 'exec'), ns)
mtl = {}; cur = None
for ln in open(os.path.join(D, 'ex22_three_alternatives.mtl')):
    if ln.startswith('newmtl '): cur = ln.split()[1]
    elif ln.startswith('Kd ') and cur: mtl[cur] = '#%02x%02x%02x' % tuple(int(float(v) * 255 + 0.5) for v in ln.split()[1:4])
G = json.load(open(os.path.join(D, 'ex22_three_alternatives.json')))
ns['col'] = lambda g: None if g.startswith('9_') else mtl.get(g)
ns['GROUND'] = [g for g in G if any(k in g for k in ('terrain', 'base_closed', 'farmland', 'orchards', 'parks_grass', 'streets', 'water', 'metro', 'park', 'paths', 'allot', 'playground', 'fence_walk', 'river_banks', 'meadow', 'river_square', 'garden', 'station', 'crops', 'clear_zone', 'patrol_road'))] 
ns['GROUND'].sort(key=lambda g: (0 if 'terrain' in g and 'sides' not in g else 1 if 'base_closed' in g or 'farmland' in g or 'orchards' in g else 2 if 'parks' in g or 'streets' in g else 3 if 'water' in g else 4 if g[0] in '123' and 'paths' not in g else 5))
ns['EDGE'] = ('0_CONTEXT_buildings', '1_RESIDENTS_hall', '1_RESIDENTS_pavilion', '2_DEVELOPER_block', '2_DEVELOPER_phase2', '3_DEFENCE_inner', '3_DEFENCE_mast')
for alt, other in (('1_RESIDENTS', ('2_', '3_')), ('2_DEVELOPER', ('1_', '3_')), ('3_DEFENCE', ('1_', '2_'))):
    sub = {g: t for g, t in G.items() if not g.startswith(other)}
    ns['render'](sub, os.path.join(D, f'preview_{alt}.png'), cam=(2300, -1900, 1500), tgt=(2300, 2300, 0), fov=38.0)
    ns['render'](sub, os.path.join(D, f'preview_{alt}_close.png'), cam=(1900, 1400, 700), tgt=(2500, 3300, 0), fov=40.0); print('ok', alt)
