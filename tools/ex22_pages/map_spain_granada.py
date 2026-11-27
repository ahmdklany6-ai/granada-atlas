"""Presentation map 1 · "Granada" is two things: the province (Provincia de Granada) and the city (Municipio de Granada)
(owner, 27 Nov 2026: "a map of Spain and Granada, its borders, the borders of the provinces marked, and the city and
municipality of Granada in solid red").
Left: Spain with every province outlined, the province of Granada in a light red, the municipality of Granada in solid red.
Right: the province of Granada enlarged, all its municipalities outlined, the municipality of Granada in solid red.
Data: IGN, Equipamiento Geográfico de Referencia Nacional (CC BY 4.0), as TopoJSON in es-atlas 0.6.0 (npm); neighbouring
countries: Natural Earth 1:50m via world-atlas 2.0.2 (npm). Both are simplified; areas are computed from them (≈).
Projection ETRS89 / UTM 30N (EPSG:25830); the Canary Islands in an inset (UTM 28N), not to position.
Colours from js/palette.js; IBM Plex Sans (FONT_DIR, not committed). Writes <out>/01_spain_granada.svg / .png (2x) / .pdf.
Usage: python3 tools/ex22_pages/map_spain_granada.py <es-atlas package dir> <world-atlas package dir> <out dir>
Not part of the site or of the tests."""
import os, sys, json, math, html
from shapely.geometry import Polygon, MultiPolygon, LineString, box
from shapely.ops import unary_union, transform
from pyproj import Transformer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _bw

ES, WA, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
FONT_DIR = os.environ.get('FONT_DIR', '')
os.makedirs(OUT, exist_ok=True)
P = _bw._P
RED, RED_T, INK, INK2, INK3 = P['red'], P['redTint'], P['ink'], P['ink2'], P['ink3']
LAND, OTHER, SEA, LINE, LINE2 = '#ECEAE3', '#F6F5F0', '#FFFFFF', P['grey2'], P['grey']


# --- TopoJSON (delta-encoded, quantized arcs) -> shapely in lon/lat
def topo(path):
    t = json.load(open(path)); (sx, sy), (tx, ty) = t['transform']['scale'], t['transform']['translate']
    arcs = []
    for a in t['arcs']:
        x = y = 0; pts = []
        for dx, dy in a: x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    def ring(ix):
        pts = []
        for i in ix:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts += seg if not pts else seg[1:]
        return pts
    def poly(rs):   # rings collapsed by the quantization (fewer than 4 points) are dropped
        rs = [ring(r) for r in rs]; rs = [r for r in rs if len(r) >= 4]
        return Polygon(rs[0], rs[1:]) if rs else None
    def geom(g):
        if g['type'] == 'Polygon': return poly(g['arcs'])
        if g['type'] == 'MultiPolygon':
            ps = [q for q in (poly(p) for p in g['arcs']) if q is not None]
            return MultiPolygon(ps) if ps else None
        return None
    return {k: [(g.get('id'), (g.get('properties') or {}).get('name'), geom(g)) for g in o['geometries'] if g.get('type') in ('Polygon', 'MultiPolygon')] for k, o in t['objects'].items()}


es = topo(os.path.join(ES, 'es', 'municipalities.json'))
wa = topo(os.path.join(WA, 'countries-50m.json'))
T30 = Transformer.from_crs(4326, 25830, always_xy=True).transform
T28 = Transformer.from_crs(4326, 32628, always_xy=True).transform
fix = lambda g: g if g.is_valid else g.buffer(0)
CANARY = ('35', '38')
prov = [(i, n, fix(transform(T28 if i in CANARY else T30, g))) for i, n, g in es['provinces']]
muni18 = [(i, n, fix(transform(T30, g))) for i, n, g in es['municipalities'] if i.startswith('18')]
gr_prov = [g for i, n, g in prov if i == '18'][0]
gr_muni = [g for i, n, g in muni18 if i == '18087'][0]
spain_pen = unary_union([g for i, n, g in prov if i not in CANARY])
canary = unary_union([g for i, n, g in prov if i in CANARY])
NB = ('Portugal', 'France', 'Andorra', 'Morocco', 'Algeria')
nb = {n: fix(transform(T30, g)).intersection(box(-600000, 3500000, 1700000, 5300000)) for i, n, g in wa['countries'] if n in NB}
A_PROV, A_MUNI = gr_prov.area / 1e6, gr_muni.area / 1e6
print('province of Granada ≈ %.0f km², %d municipalities; municipality of Granada ≈ %.1f km²' % (A_PROV, len(muni18), A_MUNI))

# --- the page: 1920 x 1080 units (16:9 slide)
W, H = 1920, 1080
L = dict(x=40, y=150, w=1180, h=860)                  # Spain
R = dict(x=1290, y=150, w=590, h=860)                 # the province of Granada


def fitter(bounds, panel, pad=0.04):
    x0, y0, x1, y1 = bounds; s = min(panel['w'] / (x1 - x0), panel['h'] / (y1 - y0)) * (1 - 2 * pad)
    ox = panel['x'] + (panel['w'] - (x1 - x0) * s) / 2; oy = panel['y'] + (panel['h'] - (y1 - y0) * s) / 2
    return (lambda x, y: (ox + (x - x0) * s, oy + (y1 - y) * s)), s


def path(g, f):
    if g.is_empty: return ''
    polys = [g] if g.geom_type == 'Polygon' else [q for q in getattr(g, 'geoms', []) if q.geom_type == 'Polygon']
    d = []
    for p in polys:
        for r in [p.exterior] + list(p.interiors):
            c = [f(x, y) for x, y in r.coords]
            d.append('M' + 'L'.join('%.1f,%.1f' % q for q in c) + 'Z')
    return ''.join(d)


def lines(g, f):
    out = []
    for p in ([g] if g.geom_type == 'Polygon' else list(getattr(g, 'geoms', []))):
        if p.geom_type != 'Polygon': continue
        for r in [p.exterior] + list(p.interiors):
            out.append('M' + 'L'.join('%.1f,%.1f' % f(x, y) for x, y in r.coords))
    return ''.join(out)


esc = lambda s: html.escape(s, quote=True)
svg = []
add = svg.append


def text(x, y, s, size=18, fill=INK, weight=400, anchor='start', style='', ls=0):
    add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"'
        f'{" letter-spacing=%r" % ls if ls else ""}{" font-style=%r" % style if style else ""}>{esc(s)}</text>')


def halo_text(x, y, s, size=18, fill=INK, weight=400, anchor='start', style=''):
    add(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round"{" font-style=%r" % style if style else ""}>{esc(s)}</text>')
    text(x, y, s, size, fill, weight, anchor, style)


def scalebar(x, y, s, km, label_every):
    """a bar of km kilometres at scale s (units per metre), divided every label_every km"""
    n = int(km / label_every); w = km * 1000 * s / n
    for k in range(n):
        add(f'<rect x="{x + k * w:.1f}" y="{y}" width="{w:.1f}" height="7" fill="{INK if k % 2 == 0 else "#FFFFFF"}" stroke="{INK}" stroke-width="1"/>')
    for k in range(n + 1): text(x + k * w, y + 26, f'{int(k * label_every)}' + (' km' if k == n else ''), 14, INK2, anchor='middle')


def north(x, y, h=42):
    add(f'<path d="M{x},{y} L{x + h * 0.32},{y + h} L{x},{y + h * 0.74} L{x - h * 0.32},{y + h} Z" fill="{INK}"/>')
    text(x, y - 8, 'N', 15, INK, 600, 'middle')


# ---------- left panel: Spain
fL, sL = fitter((-330000, 3880000, 1150000, 4900000), L, pad=0.0)
add(f'<clipPath id="cl"><rect x="{L["x"]}" y="{L["y"]}" width="{L["w"]}" height="{L["h"]}"/></clipPath>')
add(f'<rect x="{L["x"]}" y="{L["y"]}" width="{L["w"]}" height="{L["h"]}" fill="{SEA}" stroke="{P["line"]}" stroke-width="1"/>')
add('<g clip-path="url(#cl)">')
for n, g in nb.items(): add(f'<path d="{path(g, fL)}" fill="{OTHER}" stroke="{LINE}" stroke-width="0.8" fill-rule="evenodd"/>')
add(f'<path d="{path(spain_pen, fL)}" fill="{LAND}" stroke="none" fill-rule="evenodd"/>')
add(f'<path d="{path(gr_prov, fL)}" fill="{RED_T}" stroke="none"/>')
add(f'<path d="{"".join(lines(g, fL) for i, n, g in prov if i not in CANARY)}" fill="none" stroke="{LINE2}" stroke-width="0.9" stroke-linejoin="round"/>')
add(f'<path d="{lines(spain_pen, fL)}" fill="none" stroke="{INK2}" stroke-width="1.4" stroke-linejoin="round"/>')
add(f'<path d="{path(gr_muni, fL)}" fill="{RED}" stroke="{RED}" stroke-width="1.2"/>')
add(f'<path d="{lines(gr_prov, fL)}" fill="none" stroke="{RED}" stroke-width="2.2" stroke-linejoin="round"/>')
add('</g>')
# the Canary Islands inset, bottom left (not to position; same scale)
cb = canary.bounds; iw, ih = (cb[2] - cb[0]) * sL + 40, (cb[3] - cb[1]) * sL + 36
ix, iy = L['x'] + 14, L['y'] + L['h'] - ih - 14
add(f'<rect x="{ix}" y="{iy}" width="{iw:.1f}" height="{ih:.1f}" fill="{SEA}" stroke="{LINE2}" stroke-width="1"/>')
fC = lambda x, y: (ix + 20 + (x - cb[0]) * sL, iy + 24 + (cb[3] - y) * sL)
add(f'<path d="{path(canary, fC)}" fill="{LAND}" stroke="{INK2}" stroke-width="1.1" fill-rule="evenodd"/>')
add(f'<path d="{"".join(lines(g, fC) for i, n, g in prov if i in CANARY)}" fill="none" stroke="{LINE2}" stroke-width="0.9"/>')
text(ix + 10, iy + 18, 'Canary Islands (not to position)', 13, INK3)
# labels
for n, (lon, lat), sz in (('PORTUGAL', (-8.6, 39.4), 17), ('FRANCE', (0.9, 43.75), 17), ('MOROCCO', (-5.0, 35.05), 17),
                          ('ALGERIA', (1.6, 35.4), 17)):
    x, y = fL(*T30(lon, lat)); text(x, y, n, sz, INK3, 500, 'middle', ls=2)
for n, (lon, lat) in (('Atlantic Ocean', (-11.2, 44.0)), ('Mediterranean Sea', (3.3, 38.3)), ('Bay of Biscay', (-4.8, 44.15))):
    x, y = fL(*T30(lon, lat)); text(x, y, n, 16, P['basemap']['seaLabel'], 400, 'middle', 'italic')
x, y = fL(*T30(-3.6, 40.0)); text(x, y, 'SPAIN', 30, INK, 600, 'middle', ls=6)
x, y = fL(*T30(-1.5, 37.85)); halo_text(x + 8, y - 34, 'Province of Granada', 18, RED, 600)
gx, gy = fL(*gr_muni.centroid.coords[0]); add(f'<path d="M{x + 6:.1f},{y - 28:.1f} L{gx + 4:.1f},{gy - 3:.1f}" stroke="{RED}" stroke-width="1.2" fill="none"/>')
# the frame of the enlargement and its connectors
pb = gr_prov.bounds; (ax0, ay1), (ax1, ay0) = fL(pb[0], pb[1]), fL(pb[2], pb[3])
add(f'<rect x="{ax0 - 6:.1f}" y="{ay0 - 6:.1f}" width="{ax1 - ax0 + 12:.1f}" height="{ay1 - ay0 + 12:.1f}" fill="none" stroke="{INK}" stroke-width="1.3"/>')
scalebar(L['x'] + L['w'] - 210, L['y'] + L['h'] - 150, sL, 200, 100)
north(L['x'] + L['w'] - 40, L['y'] + 22)

# ---------- right panel: the province of Granada
fR, sR = fitter(gr_prov.buffer(9000).bounds, R, pad=0.0)
add(f'<rect x="{R["x"]}" y="{R["y"]}" width="{R["w"]}" height="{R["h"]}" fill="{SEA}" stroke="{P["line"]}" stroke-width="1"/>')
add(f'<clipPath id="cr"><rect x="{R["x"]}" y="{R["y"]}" width="{R["w"]}" height="{R["h"]}"/></clipPath><g clip-path="url(#cr)">')
add(f'<path d="{path(spain_pen, fR)}" fill="{OTHER}" stroke="none" fill-rule="evenodd"/>')
add(f'<path d="{"".join(lines(g, fR) for i, n, g in prov if i not in CANARY and i != "18")}" fill="none" stroke="{LINE2}" stroke-width="1"/>')
add(f'<path d="{path(gr_prov, fR)}" fill="{LAND}" stroke="none"/>')
add(f'<path d="{"".join(lines(g, fR) for i, n, g in muni18)}" fill="none" stroke="{LINE2}" stroke-width="0.8" stroke-linejoin="round"/>')
add(f'<path d="{path(gr_muni, fR)}" fill="{RED}" stroke="{RED}" stroke-width="1"/>')
add(f'<path d="{lines(gr_prov, fR)}" fill="none" stroke="{RED}" stroke-width="2.6" stroke-linejoin="round"/>')
add('</g>')
for n, (lon, lat) in (('Jaén', (-3.55, 37.9)), ('Córdoba', (-4.45, 37.55)), ('Málaga', (-4.5, 36.85)), ('Almería', (-2.35, 37.05)),
                      ('Albacete', (-2.2, 38.28)), ('Murcia', (-2.05, 37.95))):
    x, y = fR(*T30(lon, lat))
    if R['x'] + 30 < x < R['x'] + R['w'] - 30 and R['y'] + 20 < y < R['y'] + R['h'] - 20: text(x, y, n, 15, INK3, 400, 'middle')
x, y = fR(*T30(-3.2, 36.62)); text(x, y, 'Mediterranean Sea', 15, P['basemap']['seaLabel'], 400, 'middle', 'italic')
# the municipality's label with a leader
gx, gy = fR(*gr_muni.centroid.coords[0]); lx, ly = gx - 150, gy - 120
add(f'<path d="M{gx:.1f},{gy:.1f} L{lx + 6:.1f},{ly + 10:.1f}" stroke="{INK}" stroke-width="1.2" fill="none"/>')
add(f'<circle cx="{gx:.1f}" cy="{gy:.1f}" r="2.6" fill="{INK}"/>')
halo_text(lx, ly - 22, 'Municipality of Granada', 18, RED, 600, 'end')
halo_text(lx, ly, 'Municipio de Granada · the city', 15, INK2, 400, 'end')
scalebar(R['x'] + 24, R['y'] + R['h'] - 50, sR, 40, 20)
north(R['x'] + R['w'] - 36, R['y'] + 22)
# connectors from the frame on the left to the panel on the right
add(f'<path d="M{ax1 + 6:.1f},{ay0 - 6:.1f} L{R["x"]:.1f},{R["y"]:.1f} M{ax1 + 6:.1f},{ay1 + 6:.1f} L{R["x"]:.1f},{R["y"] + R["h"]:.1f}" stroke="{INK3}" stroke-width="0.9" stroke-dasharray="4 4" fill="none"/>')

# ---------- title, key, source
text(40, 62, 'Granada: the province and the city', 40, INK, 600)
text(40, 104, 'One name, two places: the Provincia de Granada (one of Spain’s 50 provinces) and, inside it, the Municipio de Granada.', 20, INK2)
ky = 1048
r2 = lambda v: round(v, -1 if v < 1000 else -2)                         # rounded: the lines are simplified
items = [('rect', RED, RED, 'Municipality of Granada (the city) · ≈ %s km²' % f'{r2(A_MUNI):,.0f}'),
         ('rect', RED_T, RED, 'Province of Granada · ≈ %s km² · %d municipalities' % (f'{r2(A_PROV):,.0f}', len(muni18))),
         ('line', LINE2, None, 'Province / municipal boundaries')]
x = 40
for kind, fill, stroke, lab in items:
    if kind == 'rect': add(f'<rect x="{x}" y="{ky - 14}" width="26" height="16" fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
    else: add(f'<path d="M{x},{ky - 6} L{x + 26},{ky - 6}" stroke="{fill}" stroke-width="1.6"/>')
    text(x + 36, ky, lab, 17, INK2); x += 36 + len(lab) * 8.6 + 40
text(W - 40, ky - 22, 'Boundaries: IGN, EGRN (CC BY 4.0) via es-atlas 0.6.0 · other countries: Natural Earth 1:50m', 13, INK3, 400, 'end')
text(W - 40, ky, 'Simplified lines, areas measured on them (≈) · ETRS89 / UTM 30N', 13, INK3, 400, 'end')

font_css = ''
if FONT_DIR:
    import base64   # embedded: a page opened from a string may not load file:// fonts
    b64 = lambda f: base64.b64encode(open(os.path.join(FONT_DIR, f), 'rb').read()).decode()
    font_css = (f"@font-face{{font-family:'Plex';src:url(data:font/ttf;base64,{b64('IBMPlexSans-Regular.ttf')});font-weight:400}}"
                f"@font-face{{font-family:'Plex';src:url(data:font/ttf;base64,{b64('IBMPlexSans-SemiBold.ttf')});font-weight:500 700}}")
doc = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
       f'<style>{font_css}text{{font-family:Plex,"IBM Plex Sans",DejaVu Sans,sans-serif}}</style>'
       f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>' + ''.join(svg) + '</svg>')
sp = os.path.join(OUT, '01_spain_granada.svg'); open(sp, 'w').write(doc)

from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
    pg.set_content(f'<html><body style="margin:0">{doc}</body></html>', wait_until='load'); pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(OUT, '01_spain_granada.png'), clip={'x': 0, 'y': 0, 'width': W, 'height': H})
    pg.pdf(path=os.path.join(OUT, '01_spain_granada.pdf'), width=f'{W / 96:.3f}in', height=f'{H / 96:.3f}in', print_background=True,
           margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
    b.close()
print('written', sp, 'and .png .pdf')


# ---------- the same two maps alone, one per page, without any text but the scale bar (owner, 27 Nov 2026)
def render(name, body, w=W, h=H):
    d = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
         f'<style>{font_css}text{{font-family:Plex,"IBM Plex Sans",DejaVu Sans,sans-serif}}</style>'
         f'<rect width="{w}" height="{h}" fill="#FFFFFF"/>' + ''.join(body) + '</svg>')
    open(os.path.join(OUT, name + '.svg'), 'w').write(d)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2)
        pg.set_content(f'<html><body style="margin:0">{d}</body></html>', wait_until='load'); pg.wait_for_timeout(400)
        pg.screenshot(path=os.path.join(OUT, name + '.png'), clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        pg.pdf(path=os.path.join(OUT, name + '.pdf'), width=f'{w / 96:.3f}in', height=f'{h / 96:.3f}in', print_background=True,
               margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
        b.close()
    print('written', name, '.svg .png .pdf')


page = dict(x=0, y=0, w=W, h=H)
# map A: Spain
svg = []; add = svg.append
fA, sA = fitter((-560000, 3860000, 1250000, 4900000), page, pad=0.0)
for n, g in nb.items(): add(f'<path d="{path(g, fA)}" fill="{OTHER}" stroke="{LINE}" stroke-width="0.8" fill-rule="evenodd"/>')
add(f'<path d="{path(spain_pen, fA)}" fill="{LAND}" stroke="none" fill-rule="evenodd"/>')
add(f'<path d="{path(gr_prov, fA)}" fill="{RED_T}" stroke="none"/>')
add(f'<path d="{"".join(lines(g, fA) for i, n, g in prov if i not in CANARY)}" fill="none" stroke="{LINE2}" stroke-width="1" stroke-linejoin="round"/>')
add(f'<path d="{lines(spain_pen, fA)}" fill="none" stroke="{INK2}" stroke-width="1.5" stroke-linejoin="round"/>')
add(f'<path d="{path(gr_muni, fA)}" fill="{RED}" stroke="{RED}" stroke-width="1.2"/>')
add(f'<path d="{lines(gr_prov, fA)}" fill="none" stroke="{RED}" stroke-width="2.4" stroke-linejoin="round"/>')
# names (owner: the countries back, the Canary Islands inset out)
for n, (lon, lat), sz in (('PORTUGAL', (-8.4, 39.6), 22), ('FRANCE', (1.2, 43.9), 22), ('MOROCCO', (-4.6, 35.25), 22),
                          ('ALGERIA', (-0.3, 35.55), 22)):
    x, y = fA(*T30(lon, lat)); text(x, y, n, sz, INK3, 500, 'middle', ls=3)
for n, (lon, lat) in (('Atlantic Ocean', (-12.0, 41.5)), ('Mediterranean Sea', (3.6, 38.6)), ('Bay of Biscay', (-5.0, 44.4))):
    x, y = fA(*T30(lon, lat)); text(x, y, n, 20, P['basemap']['seaLabel'], 400, 'middle', 'italic')
x, y = fA(*T30(-3.7, 40.2)); text(x, y, 'SPAIN', 40, INK, 600, 'middle', ls=8)
x, y = fA(*T30(-2.55, 36.55)); halo_text(x, y, 'Granada', 24, RED, 600, 'middle')
scalebar(W - 300, H - 80, sA, 200, 100)
render('01a_spain', svg)

# map B: the province of Granada
svg = []; add = svg.append
fB, sB = fitter(gr_prov.buffer(12000).bounds, dict(x=0, y=0, w=W, h=H), pad=0.0)
add(f'<path d="{path(spain_pen, fB)}" fill="{OTHER}" stroke="none" fill-rule="evenodd"/>')
add(f'<path d="{"".join(lines(g, fB) for i, n, g in prov if i not in CANARY and i != "18")}" fill="none" stroke="{LINE2}" stroke-width="1.2"/>')
add(f'<path d="{path(gr_prov, fB)}" fill="{LAND}" stroke="none"/>')
add(f'<path d="{"".join(lines(g, fB) for i, n, g in muni18)}" fill="none" stroke="{LINE2}" stroke-width="1" stroke-linejoin="round"/>')
add(f'<path d="{path(gr_muni, fB)}" fill="{RED}" stroke="{RED}" stroke-width="1"/>')
add(f'<path d="{lines(gr_prov, fB)}" fill="none" stroke="{RED}" stroke-width="3" stroke-linejoin="round"/>')
for n, (lon, lat) in (('Jaén', (-3.55, 37.95)), ('Córdoba', (-4.6, 37.55)), ('Málaga', (-4.6, 36.95)), ('Almería', (-2.3, 37.1)),
                      ('Albacete', (-2.1, 38.35)), ('Murcia', (-1.95, 37.95))):
    x, y = fB(*T30(lon, lat))
    if 60 < x < W - 60 and 30 < y < H - 30: text(x, y, n, 24, INK3, 500, 'middle')
x, y = fB(*T30(-2.7, 36.6)); text(x, y, 'Mediterranean Sea', 22, P['basemap']['seaLabel'], 400, 'middle', 'italic')
x, y = fB(*T30(-3.0, 37.75)); halo_text(x, y, 'Province of Granada', 26, RED, 600, 'middle')
gx, gy = fB(*gr_muni.centroid.coords[0]); halo_text(gx, gy - 34, 'Granada', 24, INK, 600, 'middle')
scalebar(W - 300, H - 80, sB, 40, 20)
render('01b_province_granada', svg)
