"""Preview pictures of the 3D models (tools/ex22_pages/model3d.py), drawn without a 3D library (the sandbox cannot load one):
every triangle projected in perspective, flat-shaded by a sun from the south-west, painted far to near (painter's algorithm),
as an SVG printed to PNG by Chromium. An oblique view like the owner's example: a cream model block, light buildings, the
proposal in the studio red. Colours from js/palette.js.
Usage (repo root): python3 tools/ex22_pages/model3d_preview.py <folder with the .json models>
Not part of the site or of the tests."""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ex22 import RED
import _bw
D = sys.argv[1]
P = _bw._P
COL = {'terrain': '#F3EEE6', 'terrain_sides': '#D9D0C3', 'streets': '#D8CFC3', 'base_closed_land': '#ECE6DC', 'buildings': '#F7F4EF', 'buildings_height_unknown_6m': '#EFEAE2',
       'fence_height_not_mapped': '#8C817A', 'metro_track': '#8C817A', 'flight_ceiling_approx': None,
       'P_tree_trunk': '#6F625B', 'P_tree_crown': P['olive'], 'P_park': '#E6CBC3', 'P_paths': '#FFFFFF', 'P_allotments': '#C98B80', 'P_playground': '#C98B80',
       'P_garden_courts': '#EBD9D3', 'P_station_square': '#E6CBC3', 'P_open_land_crops': '#E6CBC3', 'P_clear_zone': '#EBD9D3', 'P_patrol_road': RED}
EDGE = ('buildings', 'P_hall', 'P_block', 'P_phase2', 'P_inner', 'P_mast')


def col(g):
    if g in COL: return COL[g]
    return '#EBD9D3' if g.startswith('P_phase2') else RED


def hexrgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


GROUND = ['terrain', 'base_closed_land', 'streets', 'metro_track', 'P_open_land_crops', 'P_park', 'P_garden_courts', 'P_clear_zone', 'P_station_square', 'P_allotments', 'P_playground', 'P_paths', 'P_patrol_road', 'terrain_sides']


def render(groups, out, cam=(355, -520, 400), tgt=(355, 330, 0), W=1800, H=1100, fov=30.0):
    cam, tgt = np.array(cam, float), np.array(tgt, float)
    f_ = tgt - cam; f_ /= np.linalg.norm(f_); r_ = np.cross(f_, [0, 0, 1]); r_ /= np.linalg.norm(r_); u_ = np.cross(r_, f_)
    foc = (H / 2) / np.tan(np.radians(fov / 2))
    sun = np.array([-0.45, -0.35, 0.82]); sun /= np.linalg.norm(sun)
    polys = []
    for g, flat in groups.items():
        c = col(g)
        if not c: continue
        T = np.array(flat, float).reshape(-1, 3, 3)
        if g == 'terrain_sides': T = T[~(np.ptp(T[:, :, 2], axis=1) < 1e-6)]   # (the block's bottom is never seen)
        if len(T) == 0: continue
        n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); nl = np.linalg.norm(n, axis=1); ok = nl > 1e-9; T, n = T[ok], n[ok] / nl[ok][:, None]
        n[n[:, 2] < 0] *= -1 if g.startswith(('terrain', 'streets', 'base', 'P_park', 'P_paths', 'P_garden', 'P_station', 'P_open', 'P_clear', 'P_patrol', 'P_allot', 'P_play')) else 1
        vc = T.mean(axis=1) - cam
        facing = np.einsum('ij,ij->i', n, -vc); n[facing < 0] *= -1   # double-sided
        lam = 0.62 + 0.38 * np.clip(n @ sun, 0, 1)
        rel = T - cam; x = rel @ r_; y = rel @ u_; z = rel @ f_
        vis = (z > 5).all(axis=1)
        sx = W / 2 + foc * x / z; sy = H / 2 - foc * y / z
        depth = np.linalg.norm(vc, axis=1)
        base = hexrgb(c)
        for k in np.nonzero(vis)[0]:
            rgb = np.clip(base * lam[k], 0, 255).astype(int)
            polys.append(((GROUND.index(g) if g in GROUND else 99), depth[k], f'{sx[k,0]:.1f},{sy[k,0]:.1f} {sx[k,1]:.1f},{sy[k,1]:.1f} {sx[k,2]:.1f},{sy[k,2]:.1f}', '#%02x%02x%02x' % tuple(rgb), g.startswith(EDGE) and abs(n[k, 2]) < 0.2, g.startswith('P_')))
    polys.sort(key=lambda q: (q[0], -q[1] if q[0] == 99 else -q[1]))
    body = []
    for _, d, pts, fill, edge, prop in polys:
        st = (f' stroke="{"#5a1d22" if prop else "#a79c92"}" stroke-width="0.5" stroke-opacity="0.6"' if edge else f' stroke="{fill}" stroke-width="0.4"')
        body.append(f'<polygon points="{pts}" fill="{fill}"{st}/>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"><rect width="{W}" height="{H}" fill="#16181d"/>{"".join(body)}</svg>'
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}); pg.set_content(f'<body style="margin:0">{svg}</body>'); pg.screenshot(path=out); b.close()


for nm in ('00_base', 'residents_full', 'developer_full', 'defence_full'):
    G_ = json.load(open(os.path.join(D, f'ex22_N_{nm}.json')))
    render(G_, os.path.join(D, f'preview_{nm}.png'))
    render(G_, os.path.join(D, f'preview_{nm}_close.png'), cam=(170, 120, 150), tgt=(400, 420, 0), fov=40.0); print('ok', nm)
