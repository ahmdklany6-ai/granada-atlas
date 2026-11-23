"""Exercise 2.2 · the urban section 1:500 of an interest group on the SHARED LINE S-S (the north edge, Churriana | Armilla).
A1 landscape (841 x 594 mm). Left: a 1:500 plan strip along the line (70 m wide), the section today and the section with the
group's proposal (350 m = 700 mm at 1:500, true scale both ways, no exaggeration). Right: the same column as the plan sheet.
Data along the line (tools/build_ex22_frame.py): ground every metre (IGN MDT25), the aeronautical limit (RD 118/2019, our
interpolation), the Catastro buildings it cuts (floors x 3 m = an ESTIMATE) and the buildings up to 40 m beyond it (east).
The fence's height is not mapped and is drawn as such. Every proposal element is schematic.
Usage (repo root): python3 tools/ex22_pages/section.py <out folder> [residents]
Not part of the site or of the tests."""
import os, sys, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ex22 import *   # noqa: F401,F403
import groups
import _bw   # the black-and-white buildings with texture
import numpy as np
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union, transform as stf

OUT = sys.argv[1] if len(sys.argv) > 1 else 'exports/ex22'
GROUP = sys.argv[2] if len(sys.argv) > 2 else 'residents'
SW, SH = 841, 594
F = load_frame(); gd = groups.ground(F); RG = groups.residents(F, gd)
S = F['section']; A_, B_ = np.array(S['a']), np.array(S['b']); L = float(np.hypot(*(B_ - A_)))
D = (B_ - A_) / L; NL = np.array([-D[1], D[0]])          # along the line (north → south) and its left normal (east)
K = 2.0                                                   # 1:500 → 2 mm per metre
DX0 = 18.0                                                # x of s = 0 on the sheet
COL = 730.0; CW = SW - 10 - COL
svg = SVG(SW, SH)
sm = np.array(S['samples']); FENCE = S['fence_at_m']
grd = lambda s: float(np.interp(s, sm[:, 0], sm[:, 1])); lim = lambda s: float(np.interp(s, sm[:, 0], sm[:, 2]))
st = lambda p: ((np.array(p) - A_) @ D, (np.array(p) - A_) @ NL)   # ground point → (s, t)
XS = lambda s: DX0 + s * K

svg.defs_add(f'<pattern id="baseHatch" patternUnits="userSpaceOnUse" width="2.6" height="2.6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2.6" stroke="{G[3]}" stroke-width="0.12"/></pattern>')
svg.defs_add(f'<pattern id="redHatch" patternUnits="userSpaceOnUse" width="0.9" height="0.9" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="0.9" stroke="{RED}" stroke-width="0.16"/></pattern>')
svg.defs_add(f'<pattern id="redDots" patternUnits="userSpaceOnUse" width="1.2" height="1.2"><circle cx="0.6" cy="0.6" r="0.22" fill="{RED}"/></pattern>')
svg.defs_add(f'<pattern id="earth" patternUnits="userSpaceOnUse" width="1.4" height="1.4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.4" stroke="{INK}" stroke-width="0.07"/></pattern>')
svg.defs_add(_bw.defs()); svg.defs_add(_bw.defs_obs())
FAC = json.load(open(os.path.join(ROOT, 'data/ex22/facades.json')))['parcels']   # read from the Catastro's façade photos (22 Nov 2026)

# ---- buildings in the sections: black and white, with floors, walls, slabs, windows and doors (owner, 22 Nov 2026: "more detail
# in the buildings of the sections, but black and white"). Floors and use from the Catastro; heights = floors x 3 m (estimate);
# window rhythm, doors and shop fronts are SCHEMATIC (one bay about every 3.6 m), roof shapes are not known and are drawn flat.
FL = 3.0
def _r(x, y, w, h, fill, stroke='none', sw=0.0):
    return _bw._r(x, y, w, h, fill, None if stroke == 'none' else stroke, sw)   # (textures become explicit lines and dots there)
def _l(x1, y1, x2, y2, sw, col=None):
    return f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{col or INK}" stroke-width="{sw}"/>'
def bw_elev(XS, YZ, s0, s1, z, lv, use, far=False):
    """a building beyond the line, seen in elevation: white, black lines; floor lines, windows, a door or a shop front (schematic)"""
    x0, x1 = XS(s0), XS(s1); w = s1 - s0; yb = YZ(z); yt = YZ(z + lv * FL)
    lw, lw2 = (0.1, 0.045) if far else (0.16, 0.06)
    o = [_r(x0, yt, x1 - x0, yb - yt, WHITE, INK, lw), _l(x0, yt, x1, yt, lw * 1.8)]
    for f in range(1, lv): o.append(_l(x0, YZ(z + f * FL), x1, YZ(z + f * FL), lw2))
    if w < 2.2: return ''.join(o)
    nb = max(1, int(round(w / 3.6))); bw_ = w / nb; ww = min(1.2, bw_ * 0.45)
    shop = use in ('retail', 'commercial')
    for f in range(lv):
        for i in range(nb):
            cx = s0 + bw_ * (i + 0.5)
            if f == 0 and shop: continue
            if f == 0 and i == nb // 2:   # a door
                o.append(_r(XS(cx - 0.5), YZ(z + 2.2), 1.0 * K, 2.2 * K, WHITE, INK, lw2)); o.append(_l(XS(cx), YZ(z + 2.2), XS(cx), YZ(z), lw2 * 0.8))
                continue
            yb_ = z + f * FL + 0.9; o.append(_r(XS(cx - ww / 2), YZ(yb_ + 1.3), ww * K, 1.3 * K, WHITE, INK, lw2))
            if not far: o.append(_l(XS(cx), YZ(yb_ + 1.3), XS(cx), YZ(yb_), lw2 * 0.7))
    if shop:
        o.append(_r(XS(s0 + 0.4), YZ(z + 2.6), (w - 0.8) * K, 2.3 * K, WHITE, INK, lw2))
        for q in range(1, int((w - 0.8) / 1.6) + 1): o.append(_l(XS(s0 + 0.4 + q * 1.6), YZ(z + 2.6), XS(s0 + 0.4 + q * 1.6), YZ(z + 0.3), lw2 * 0.7))
    return ''.join(o)
def bw_cut(XS, YZ, s0, s1, z, lv, use, left='facade', right='facade', col=None, fl=FL, inner=None, roof=None, ex=True):
    """a building cut by the line: the cut walls and slabs solid (black, or red for a proposal), rooms white, window openings in
    the façade walls (schematic); left/right = 'facade' (with openings), 'party' (a shared wall, no openings) or None"""
    col = col or INK; x0, x1 = XS(s0), XS(s1); yb = YZ(z); yt = YZ(z + lv * fl); t = 0.3 * K; sl = 0.25 * K
    o = [_r(x0, yt, x1 - x0, yb - yt, inner or WHITE)]
    for f in range(1, lv + 1): y = YZ(z + f * fl); o.append(_r(x0, y, x1 - x0, sl, col))           # slabs (the top one is the roof)
    o.append(_r(x0, yb - sl * 0.6, x1 - x0, sl * 0.6, col))                                      # ground slab
    shop = use in ('retail', 'commercial', 'hall')
    w_m = s1 - s0
    if ex:   # what one sees inside, on the far wall of each floor (thin, schematic): a door, a window in wide rooms
        for f in range(lv):
            zf = z + f * fl
            if w_m >= 4: dx = s0 + 0.32 * w_m; o.append(_r(XS(dx - 0.45), YZ(zf + 2.1), 0.9 * K, 2.1 * K, 'none', INK, 0.04))
        for f in range(lv):     # people at home, for scale (schematic)
            if w_m >= 6 and (f + int(s0)) % 2 == 0: o.append(_bw.figure(XS(s0 + 0.52 * w_m), YZ(z + f * fl + (0.15 if f == 0 else 0)), K, kind=(0, 2, 3)[(int(s0) + f) % 3], seed=int(s0) + f))
        if roof == 'tile':      # clay tiles in the photo: a pitched roof, its pitch schematic (about 30 %, at most 1.6 m), eaves over the façades
            hr = min(1.6, 0.3 * w_m / 2) * K; xm = (x0 + x1) / 2; ex0 = x0 - (0.45 * K if left == 'facade' else 0); ex1 = x1 + (0.45 * K if right == 'facade' else 0)
            pts = f'{ex0:.2f},{yt + 0.12 * K:.2f} {xm:.2f},{yt - hr:.2f} {ex1:.2f},{yt + 0.12 * K:.2f}'
            o.append(f'<polygon points="{pts}" fill="{WHITE}"/><polyline points="{ex0:.2f},{yt + 0.12 * K:.2f} {xm:.2f},{yt - hr:.2f} {ex1:.2f},{yt + 0.12 * K:.2f}" fill="none" stroke="{col}" stroke-width="{0.22 * K:.2f}" stroke-linejoin="round"/>')   # the roof, cut: no texture
        elif roof == 'metal':   # a curved metal-sheet roof (the corner shop)
            d = f'M{x0:.2f},{yt:.2f} Q{(x0 + x1) / 2:.2f},{yt - 1.4 * K:.2f} {x1:.2f},{yt:.2f}'
            o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{0.15 * K:.2f}"/>')
        elif roof == 'flat_balustrade':
            o.append(_l(x0, yt - 0.9 * K, x1, yt - 0.9 * K, 0.14) + ''.join(f'<ellipse cx="{x0 + j * 0.22 * K:.2f}" cy="{yt - 0.45 * K:.2f}" rx="{0.06 * K:.2f}" ry="{0.36 * K:.2f}" fill="{WHITE}" stroke="{INK}" stroke-width="0.04"/>' for j in range(1, int(w_m / 0.22))))
        else: o.append(_r(x0, yt - 0.5 * K, x1 - x0, 0.5 * K, WHITE, col, 0.06))   # a parapet (roof form not known: drawn flat)
    if not ex:   # a proposed building: its structure as thin lines (bays about every 5.5 m), a parapet; people for scale
        nb_ = max(1, int(round(w_m / 5.5)))
        for j in range(1, nb_): xx = XS(s0 + w_m * j / nb_); o.append(_l(xx, yt, xx, yb, 0.12, col))
        o.append(_r(x0, yt - 0.6 * K, x1 - x0, 0.6 * K, WHITE, col, 0.1))
        for j, (q_, f_, kd) in enumerate(((0.2, 0, 3), (0.62, 0, 0), (0.42, 1, 2), (0.8, 1, 3))):
            if f_ < lv: o.append(_bw.figure(XS(s0 + q_ * w_m), YZ(z + f_ * fl + (0.15 if f_ == 0 else 0)), K, kind=kd, seed=int(s0 * 3) + j))
    for side, xw in ((left, x0), (right, x1 - t)):
        if side is None: continue
        o.append(_r(xw, yt, t, yb - yt, col))
        if side == 'facade':
            for f in range(lv):
                a_, b_ = (z + 0.25, z + 2.6) if (f == 0 and shop) else (z + f * fl + 0.9, z + f * fl + 2.2)
                o.append(_r(xw - 0.02, YZ(b_), t + 0.04, (b_ - a_) * K, WHITE)); o.append(_l(xw + t / 2, YZ(b_), xw + t / 2, YZ(a_), 0.06, col))
    return ''.join(o)

def label(x, y, s, size=TY['small'], fill=INK, weight=400, anchor='middle', italic=False, halo=0.6, rot=None, spacing=0):
    svg.text(x, y, s, size, fill=fill, weight=weight, anchor=anchor, italic=italic, halo=halo, rotate=rot, spacing=spacing)

# ---- 1 the plan strip along S-S (1:500, 70 m wide, east up) -----------------------------------------------------------------
BW = 70.0; PY0 = 26.0; PYM = PY0 + BW * K                # strip top and the line's y
band = Polygon([tuple(A_ + NL * BW), tuple(B_ + NL * BW), tuple(B_ - NL * BW), tuple(A_ - NL * BW)])
def tp(x, y, z=None):
    """ground → strip (works on scalars and on the coordinate arrays shapely passes)"""
    s = (x - A_[0]) * D[0] + (y - A_[1]) * D[1]; t = (x - A_[0]) * NL[0] + (y - A_[1]) * NL[1]
    return (DX0 + s * K, PYM - t * K)
def dp(g, close=True):
    if g.is_empty: return ''
    g2 = stf(tp, g); gs = [g2] if g2.geom_type in ('Polygon', 'LineString', 'LinearRing') else list(getattr(g2, 'geoms', []))
    out = []
    for q in gs:
        if q.geom_type == 'Polygon':
            for r in [q.exterior] + list(q.interiors): out.append('M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in r.coords) + ' Z')
        elif q.geom_type in ('LineString', 'LinearRing'): out.append('M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in q.coords))
        elif hasattr(q, 'geoms'): out.append(dp(q, close))
    return ' '.join(out)
svg.defs_add(f'<clipPath id="stripclip"><rect x="{DX0}" y="{PY0}" width="{L * K:.2f}" height="{2 * BW * K:.2f}"/></clipPath>')
pg = []
pg.append(f'<path d="{dp(gd.base.intersection(band))}" fill="url(#baseHatch)" stroke="none" fill-rule="evenodd"/>')
pg.append('<path d="' + ' '.join(dp(p.exterior.intersection(band.buffer(5))) for p in gd.parcels if p.intersects(band)) + f'" fill="none" stroke="{G[3]}" stroke-width="{LW["parcel"] * 1.4}"/>')
# the residents' proposal under the buildings
if GROUP == 'residents':
    R_ = RG
    pg.append(f'<path d="{dp(R_.park.intersection(band.buffer(2)))}" fill="{R[0]}" stroke="{RED}" stroke-width="{LW["propBold"]}"/>')
    pg.append(f'<path d="{dp(R_.prom.intersection(band.buffer(2)))}" fill="{R[0]}" stroke="none"/>')
    pg.append(f'<path d="{dp(R_.meadow.intersection(band.buffer(2)))}" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["thin"]}" stroke-dasharray="1.6 1"/>')
    pg.append(f'<path d="{dp(R_.allot.intersection(band.buffer(2)))}" fill="url(#redHatch)" stroke="{RED}" stroke-width="{LW["hair"] * 1.5}"/>')
    pg.append(f'<path d="{dp(R_.play.intersection(band.buffer(2)))}" fill="url(#redDots)" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
    pth = R_.paths.intersection(band.buffer(2))
    pg.append(f'<path d="{dp(pth, False)}" fill="none" stroke="{RED}" stroke-width="{3 * K + 0.12:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    pg.append(f'<path d="{dp(pth, False)}" fill="none" stroke="{WHITE}" stroke-width="{3 * K - 0.12:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
for g, b in gd.blds:
    if not g.intersects(band): continue
    f = floors_fill(b)
    pg.append(f'<path d="{dp(g.intersection(band.buffer(3)))}" fill="{f or WHITE}" stroke="{G[5] if f else G[4]}" stroke-width="{LW["hair"] * 1.5 if f else LW["bld"]}" fill-rule="evenodd"/>')
if GROUP == 'residents':
    for (x, y) in R_.trees + R_.row:
        if band.buffer(3).contains(Point(x, y)):
            px, py = tp(x, y); pg.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{2.6 * K:.2f}" fill="{WHITE}" fill-opacity="0.85" stroke="{RED}" stroke-width="{LW["thin"]}"/><circle cx="{px:.2f}" cy="{py:.2f}" r="0.35" fill="{RED}"/>')
    pg.append(f'<path d="{dp(R_.hall)}" fill="{RED}" stroke="none"/>')
    hx, hy = tp(R_.hall.centroid.x, R_.hall.centroid.y)
    pg.append(f'<text x="{hx:.2f}" y="{hy + 1.1:.2f}" font-family="{FONT}" font-size="3" font-weight="700" fill="{WHITE}" text-anchor="middle">II</text>')
    for (x, y) in R_.crossings:
        if not band.buffer(5).contains(Point(x, y)): continue
        q = R_.aveU.interpolate(R_.aveU.project(Point(x, y))); q2 = R_.aveU.interpolate(R_.aveU.project(Point(x, y)) + 1); dx, dy = q2.x - q.x, q2.y - q.y; n = math.hypot(dx, dy) or 1; ux, uy = dx / n, dy / n
        for s_ in range(-3, 4):
            bx, by = x + ux * s_ * 0.9, y + uy * s_ * 0.9; p1 = tp(bx - uy * 13, by + ux * 13); p2 = tp(bx + uy * 13, by - ux * 13)
            pg.append(f'<line x1="{p1[0]:.2f}" y1="{p1[1]:.2f}" x2="{p2[0]:.2f}" y2="{p2[1]:.2f}" stroke="{RED}" stroke-width="0.8"/>')
# the metro extension, the fence
for m in F['metro_ext']:
    for r in m['r']:
        ln = LineString(r[0]).intersection(band.buffer(10))
        if ln.is_empty: continue
        pg.append(f'<path d="{dp(ln, False)}" fill="none" stroke="{INK}" stroke-width="{LW["metro"] * 1.4}"/>')
        for seg in ([ln] if ln.geom_type == 'LineString' else list(ln.geoms)):
            for t_ in range(0, int(seg.length), 3):
                p = seg.interpolate(t_); q = seg.interpolate(min(seg.length, t_ + 0.5)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
                p1 = tp(p.x - dy / n * 1.3, p.y + dx / n * 1.3); p2 = tp(p.x + dy / n * 1.3, p.y - dx / n * 1.3)
                pg.append(f'<line x1="{p1[0]:.2f}" y1="{p1[1]:.2f}" x2="{p2[0]:.2f}" y2="{p2[1]:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
fz = gd.fence_line.intersection(band.buffer(10))
pg.append(f'<path d="{dp(fz, False)}" fill="none" stroke="{INK}" stroke-width="{LW["fence"] + 0.5}"/><path d="{dp(fz, False)}" fill="none" stroke="{WHITE}" stroke-width="0.45" stroke-dasharray="2.4 1.9"/>')
# the section line through the strip's middle
pg.append(f'<line x1="{DX0:.2f}" y1="{PYM:.2f}" x2="{DX0 + L * K:.2f}" y2="{PYM:.2f}" stroke="{INK}" stroke-width="{LW["section"]}" stroke-dasharray="6 1.2 0.8 1.2"/>')
if GROUP == 'residents':
    sx, sy = tp(*R_.stop)
    pg.append(f'<path d="{dp(R_.platform.intersection(band.buffer(5)), False)}" fill="none" stroke="{RED}" stroke-width="4.4" opacity="0.9"/>')
    pg.append(f'<circle cx="{sx:.2f}" cy="{sy + 12:.2f}" r="3.0" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["propBold"]}"/><text x="{sx:.2f}" y="{sy + 13.1:.2f}" font-family="{FONT}" font-size="3" font-weight="700" fill="{RED}" text-anchor="middle">M</text>'
              f'<text x="{sx + 4:.2f}" y="{sy + 13:.2f}" font-family="{FONT}" font-size="2.4" font-weight="600" fill="{RED}" stroke="{WHITE}" stroke-width="0.7" paint-order="stroke">San Cayetano stop (Junta project, approx.)</text>')
svg.add(f'<g clip-path="url(#stripclip)">{"".join(pg)}</g>')
svg.add(f'<rect x="{DX0}" y="{PY0}" width="{L * K:.2f}" height="{2 * BW * K:.2f}" fill="none" stroke="{INK}" stroke-width="{LW["frame"]}"/>')
# street names in the strip, where they cross it
seen = set()
for ln, s_ in gd.streets:
    nm = s_.get('nm')
    if not nm or nm in seen or s_.get('hw') in ('service', 'footway', 'cycleway', 'path'): continue
    it = ln.intersection(LineString([tuple(A_), tuple(B_)]))
    if it.is_empty: continue
    seen.add(nm); p = it if it.geom_type == 'Point' else list(it.geoms)[0]; s0, _ = st((p.x, p.y))
    # along the street, a little off the line
    q = ln.interpolate(ln.project(p) + 2); p0 = ln.interpolate(max(0, ln.project(p) - 2)); a0 = tp(p0.x, p0.y); a1 = tp(q.x, q.y)
    ang = math.degrees(math.atan2(a1[1] - a0[1], a1[0] - a0[0]))
    if ang > 90: ang -= 180
    if ang < -90: ang += 180
    off = ln.interpolate(ln.project(p) + 22); ox, oy = tp(off.x, off.y)
    label(ox, oy + 0.8, nm.replace('Calle ', 'C. ').replace('Avenida ', 'Av. '), size=2.3, fill=G[5], italic=True, rot=ang, halo=0.8)
label(XS(290), PYM - 30, 'BASE AÉREA DE ARMILLA — closed', size=2.6, fill=G[5], weight=600, spacing=0.6)
for s0, lt in ((0, 'S'), (L, 'S')):
    x = XS(s0); svg.add(f'<circle cx="{x:.2f}" cy="{PYM:.2f}" r="2.6" fill="{WHITE}" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
    svg.text(x, PYM + 0.95, lt, 2.6, weight=700, anchor='middle')
svg.text(DX0, PY0 - 3.2, f'PLAN ALONG S–S · 1:500 · A STRIP {2 * BW:.0f} M WIDE, EAST AT THE TOP', TY['eyebrow'], weight=700, spacing=0.35)
svg.text(DX0 + L * K, PY0 - 3.2, 'north ←    → south', TY['small'], fill=G[5], anchor='end')


# ---- 2/3 the sections ------------------------------------------------------------------------------------------------------
_TREES = {}
def tree_images(col):
    """the owner's own tree cut-outs (PNG, transparent; the folder in TREE_IMAGES, as for the 2.1 sections), embedded as supplied
    (olive) when col is None, else recoloured to col (dark parts → col, light parts → white, alpha kept). Not committed: the owner supplies them."""
    if col not in _TREES:
        import base64, glob, io
        from PIL import Image
        d = os.environ.get('TREE_IMAGES'); out = []
        c = tuple(int(col[i:i + 2], 16) for i in (1, 3, 5)) if col else None
        for f in sorted(glob.glob(os.path.join(d, '*.png'))) if d else []:
            im = Image.open(f).convert('RGBA')
            bb = im.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()   # trim the faint edge, so the trunk stands on the ground
            if bb: im = im.crop(bb)
            a = im.getchannel('A')
            if col is None:   # as supplied (olive)
                b = io.BytesIO(); im.save(b, 'PNG', optimize=True); out.append((base64.b64encode(b.getvalue()).decode(), im.width, im.height)); continue
            L = im.convert('L').point(lambda v: min(255, max(0, int((v - 150) * 2.5))))   # 0 = darkest ink, 255 = paper
            rgb = [Image.eval(L, lambda v, k=k: int(k + (255 - k) * v / 255 * 0.7)) for k in c]
            t = Image.merge('RGBA', rgb + [a]); b = io.BytesIO(); t.save(b, 'PNG', optimize=True)
            out.append((base64.b64encode(b.getvalue()).decode(), im.width, im.height))
        _TREES[col] = out
    return _TREES[col]


def tree_svg(x, yg, col, sw, seed=0, op=1.0, h=None, r=None):
    """a tree in the section: the owner's tree images when TREE_IMAGES is set (8–11 m, true 1:500), otherwise the drawn pen trees"""
    imgs = tree_images(None)   # owner request (23 Nov): the trees keep their own olive colour
    if imgs:
        b64, pw, ph = imgs[seed % len(imgs)]; hh = (h or (8.0 + (seed * 37 % 7) * 0.5)) * K; ww = hh * pw / ph
        yg -= LW['ground'] / 2
        return (f'<image x="{x - ww / 2:.2f}" y="{yg - hh:.2f}" width="{ww:.2f}" height="{hh:.2f}" opacity="{op}" '
                f'preserveAspectRatio="none" href="data:image/png;base64,{b64}"/>')
    kind = ('round', 'cypress', 'light', 'round', 'conifer', 'round', 'cypress', 'light')[seed % 8]
    return f'<g opacity="{op}">' + _bw.tree_real(kind, x, yg, K, col, 0.07, seed) + '</g>'


FADE = _bw._P['grey']                                     # the line of the façades behind the cut
Z0, Z1 = 659.0, 696.0                                      # the drawn height range (m a.s.l.)
def section(top, proposal, title):
    yb = top + (Z1 - Z0) * K                                 # y of Z0
    YZ = lambda z: yb - (z - Z0) * K
    g = []
    svg.text(DX0, top - 4.0, title, TY['eyebrow'], weight=700, spacing=0.35, fill=RED if proposal else INK)
    # buildings beyond the line (east, up to 40 m): black and white elevations, the farther the finer the line
    far = []
    for gg, b in gd.blds:
        if not b.get('lv') or b.get('hu'): continue
        c = list(gg.exterior.coords); ss = [st(p) for p in c]; ts = [t for _, t in ss]
        if max(ts) <= 0 or min(ts) > 40 or gg.intersects(LineString([tuple(A_), tuple(B_)])): continue
        s0, s1 = min(s for s, _ in ss), max(s for s, _ in ss)
        if s1 < 0 or s0 > L: continue
        tmin = max(0.0, min(ts)); far.append((tmin, max(0, s0), min(L, s1), b['lv'], b.get('b'), b.get('y'), (b.get('ref') or '')[:14]))
    # farther back (40–100 m east): outlines only — the skyline behind the street (Catastro floors x 3 m), finer with distance
    sky = []
    for gg, b in gd.blds:
        if not b.get('lv') or b.get('hu'): continue
        ss = [st(p) for p in gg.exterior.coords]; ts = [t for _, t in ss]
        if min(ts) <= 40 or min(ts) > 100: continue
        s0, s1 = min(q_ for q_, _ in ss), max(q_ for q_, _ in ss)
        if s1 < 0 or s0 > L: continue
        sky.append((min(ts), max(0, s0), min(L, s1), b['lv']))
    for tmin, s0, s1, lv in sorted(sky, key=lambda q: -q[0]):
        z = grd((s0 + s1) / 2); g.append(f'<rect x="{XS(s0):.2f}" y="{YZ(z + lv * FL):.2f}" width="{(s1 - s0) * K:.2f}" height="{lv * FL * K:.2f}" fill="{WHITE}" stroke="{G[3] if tmin > 70 else G[4]}" stroke-width="0.07"/>')
    hi_floors = max([q[3] for q in far] + [c['lv'] for c in S['cuts']] + [1]); lo_floors = min([q[3] for q in far] + [c['lv'] for c in S['cuts']])
    widest = {}
    for q in far:
        if q[6] and (q[6] not in widest or q[2] - q[1] > widest[q[6]][2] - widest[q[6]][1]): widest[q[6]] = q
    FRONT = ('garden', 'gate', 'tree', 'steps', 'column', 'garage')   # what stands in front: drawn once per parcel, on its widest part
    for q in sorted(far, key=lambda q: -q[0]):
        tmin, s0, s1, lv, use, yr, ref = q; sd = int(s0 * 13 + s1 * 7 + (yr or 0)) % 997
        if ref in FAC:
            ob = FAC[ref] if widest.get(ref) is q else {k_: v_ for k_, v_ in FAC[ref].items() if k_ not in FRONT}
            e_ = _bw.elev_obs(XS(s0), XS(s1), YZ(grd((s0 + s1) / 2)), lv, ob, seed=sd, K=K, far=True)
        else: e_ = _bw.elev(XS(s0), XS(s1), YZ(grd((s0 + s1) / 2)), lv, use, yr, seed=sd, K=K, far=True)
        # behind the cut: a lighter line (warm grey, from the palette) instead of transparency, so each façade is opaque and
        # the nearer one hides the farther one (owner, 23 Nov 2026: the buildings showed through each other)
        g.append(e_.replace(_bw.INK, FADE))
    # proposal trees beyond the line (pale red), then the ground
    if proposal and GROUP == 'residents':
        for (x, y) in RG.trees + RG.row:
            s0, t0 = st((x, y))
            if 4.5 < t0 <= 30 and 0 <= s0 <= L:
                z = grd(s0); g.append(tree_svg(XS(s0), YZ(z), R[2], LW['thin'], int(s0 * 7), op=0.6))
    # the ground: earth below the line
    pts = [(XS(s), YZ(grd(s))) for s in range(0, int(L) + 1)]
    import random as _rd
    rs = _rd.Random(7); dots = []
    for _ in range(1400):
        s_ = rs.uniform(0, L); dz = 1.3 + rs.random() ** 1.8 * 4.2          # deeper = sparser
        dots.append(f'<circle cx="{XS(s_):.2f}" cy="{YZ(grd(s_)) + dz * K:.2f}" r="{rs.uniform(0.05, 0.11):.2f}" fill="{INK}"/>')
    g.append(''.join(dots))
    band = [(x, y + 1.2 * K) for x, y in pts]   # the cut ground: a 1.2 m band, solid black (as the 2.1 sections, in black)
    g.append('<path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + ' L' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in reversed(band)) + f' Z" fill="{RED}" stroke="none"/>')
    # the base side of the cut ground: hatched (closed land: nothing inside it is surveyed) — as on the 2.1 sections
    bpts = [(x, y) for (x, y) in pts if x >= XS(FENCE)]; bid = f'baseband{int(top)}'
    svg.defs_add(f'<clipPath id="{bid}"><path d="M' + ' L'.join(f'{x:.2f},{y - 0.05:.2f}' for x, y in bpts) + ' L' + ' L'.join(f'{x:.2f},{y + 1.2 * K + 0.05:.2f}' for x, y in reversed(bpts)) + ' Z"/></clipPath>')
    yt2 = min(y for _, y in bpts) - 1; yb2 = max(y for _, y in bpts) + 1.2 * K + 1
    g.append(f'<g clip-path="url(#{bid})">' + ''.join(f'<line x1="{x:.2f}" y1="{yb2:.2f}" x2="{x + (yb2 - yt2):.2f}" y2="{yt2:.2f}" stroke="{WHITE}" stroke-width="0.24"/>' for x in np.arange(XS(FENCE) - (yb2 - yt2) - 1, XS(L) + 1, 1.25)) + '</g>')
    # the cut buildings
    cuts = [c for c in S['cuts'] if c['h_est'] is not None]
    sl_ = LineString([tuple(A_), tuple(B_)]); cref = []
    for gg, b in gd.blds:
        if b.get('ref') and gg.intersects(sl_):
            it = gg.intersection(sl_)
            for seg in ([it] if it.geom_type == 'LineString' else [q for q in getattr(it, 'geoms', []) if q.geom_type == 'LineString']):
                a0, _ = st(seg.coords[0]); a1, _ = st(seg.coords[-1]); cref.append((min(a0, a1), max(a0, a1), b['ref'][:14]))
    def ref_of(c):
        best = max(cref, key=lambda r: min(r[1], c['s1']) - max(r[0], c['s0']), default=None)
        return best[2] if best and min(best[1], c['s1']) - max(best[0], c['s0']) > 0.2 else None
    for i, c in enumerate(cuts):
        z = grd((c['s0'] + c['s1']) / 2)
        lft = 'party' if i > 0 and abs(cuts[i - 1]['s1'] - c['s0']) < 0.3 else 'facade'
        rgt = None if i + 1 < len(cuts) and abs(cuts[i + 1]['s0'] - c['s1']) < 0.3 and cuts[i + 1]['lv'] >= c['lv'] else ('party' if i + 1 < len(cuts) and abs(cuts[i + 1]['s0'] - c['s1']) < 0.3 else 'facade')
        rf = ref_of(c); g.append(bw_cut(XS, YZ, c['s0'], c['s1'], z, c['lv'], c['b'], lft, rgt, roof=(FAC.get(rf) or {}).get('roof'), col=RED))   # the cut in the studio red (owner, 23 Nov 2026)
    g.append('<path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + f'" fill="none" stroke="{RED}" stroke-width="{LW["ground"]}"/>')
    # the metro (vehicle drawn schematically: 2.65 x 3.4 m) and its crossing
    for m in S['metro']:
        s0 = m['d']; z = grd(s0)
        g.append(_bw.tram_flat(XS(s0), YZ(z), K) +   # flat colours, front view (owner, 23 Nov 2026)
                 f'<line x1="{XS(s0 + 3.2):.2f}" y1="{YZ(z):.2f}" x2="{XS(s0 + 3.2):.2f}" y2="{YZ(z + 6.5):.2f}" stroke="{INK}" stroke-width="0.18"/><line x1="{XS(s0 + 3.2):.2f}" y1="{YZ(z + 6.0):.2f}" x2="{XS(s0 - 0.8):.2f}" y2="{YZ(z + 6.0):.2f}" stroke="{INK}" stroke-width="0.1"/>'
                 f'<line x1="{XS(s0 - 0.8):.2f}" y1="{YZ(z + 5.0):.2f}" x2="{XS(s0 + 0.8):.2f}" y2="{YZ(z + 5.0):.2f}" stroke="{INK}" stroke-width="0.06"/>')
        g.append(f'<line x1="{XS(s0 - 3):.2f}" y1="{YZ(z + 0.08):.2f}" x2="{XS(s0 + 3):.2f}" y2="{YZ(z + 0.08):.2f}" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
    # the fence: its height is not mapped — a thin dashed post and a question mark
    zf = grd(FENCE)
    g.append(f'<line x1="{XS(FENCE):.2f}" y1="{YZ(zf):.2f}" x2="{XS(FENCE):.2f}" y2="{YZ(zf + 2.2):.2f}" stroke="{INK}" stroke-width="{LW["mid"]}" stroke-dasharray="0.8 0.5"/>')
    g.append(f'<text x="{XS(FENCE):.2f}" y="{YZ(zf + 2.6):.2f}" font-family="{FONT}" font-size="2.6" font-weight="700" fill="{INK}" text-anchor="middle" stroke="{WHITE}" stroke-width="0.6" paint-order="stroke">?</text>')
    # the flight ceiling
    cp = [(XS(s), YZ(lim(s))) for s in range(0, int(L) + 1)]
    # the air above the ceiling, hatched (explicit lines in a clip: light in the PDF)
    cid = f'ceil{int(top)}'; svg.defs_add(f'<clipPath id="{cid}"><path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in cp) + ' L' + ' L'.join(f'{x:.2f},{y - 3.2 * K:.2f}' for x, y in reversed(cp)) + ' Z"/></clipPath>')
    yt_ = min(y for _, y in cp) - 3.2 * K - 1; yb_ = max(y for _, y in cp) + 1
    g.append(f'<g clip-path="url(#{cid})">' + ''.join(f'<line x1="{x:.2f}" y1="{yb_:.2f}" x2="{x + (yb_ - yt_):.2f}" y2="{yt_:.2f}" stroke="{INK}" stroke-width="0.07"/>' for x in np.arange(XS(0) - (yb_ - yt_), XS(L), 1.1)) + '</g>')
    g.append('<path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in cp) + f'" fill="none" stroke="{G[5]}" stroke-width="{LW["section"]}" stroke-dasharray="2.2 1.2"/>')
    # allowed height above the ground, measured at three places
    for s0 in (95.5, 172, 330):   # measured in open spaces: the avenue's pavement, the strip, the base
        z0, z1 = grd(s0), lim(s0); x = XS(s0)
        g.append(f'<line x1="{x:.2f}" y1="{YZ(z0) - 0.6:.2f}" x2="{x:.2f}" y2="{YZ(z1) + 0.6:.2f}" stroke="{G[5]}" stroke-width="{LW["thin"]}"/>'
                 f'<path d="M{x - 0.7:.2f},{YZ(z1) + 1.6:.2f} L{x:.2f},{YZ(z1) + 0.3:.2f} L{x + 0.7:.2f},{YZ(z1) + 1.6:.2f}" fill="none" stroke="{G[5]}" stroke-width="{LW["thin"]}"/>')
        g.append(f'<text x="{x + 1.2:.2f}" y="{(YZ(z0) + YZ(z1)) / 2 + 0.8:.2f}" font-family="{FONT}" font-size="{TY["small"]}" font-weight="600" fill="{G[5]}" stroke="{WHITE}" stroke-width="0.6" paint-order="stroke">{z1 - z0:.0f} m</text>')
    if proposal and GROUP == 'residents':
        # the park's ground in red, the fence walk's ground in red
        for poly_, w in ((RG.park, LW['propBold'] + 0.4), (RG.prom, LW['propBold'] + 0.4)):
            it = poly_.intersection(LineString([tuple(A_), tuple(B_)]))
            for seg in ([it] if it.geom_type == 'LineString' else [q for q in getattr(it, 'geoms', []) if q.geom_type == 'LineString']):
                s0, _ = st(seg.coords[0]); s1, _ = st(seg.coords[-1]); s0, s1 = sorted((s0, s1))
                pp = [(XS(s), YZ(grd(s))) for s in np.arange(s0, s1 + 0.01, 1.0)]
                g.append('<path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pp) + f'" fill="none" stroke="{RED}" stroke-width="{w}"/>')
        # the hall, cut
        it = RG.hall.intersection(LineString([tuple(A_), tuple(B_)]))
        if not it.is_empty:
            s0, _ = st(it.coords[0]); s1, _ = st(it.coords[-1]); s0, s1 = sorted((s0, s1)); z = grd((s0 + s1) / 2); h = 7.0
            g.append(bw_cut(XS, YZ, s0, s1, z, 2, 'hall', 'facade', 'facade', col=RED, fl=3.5, inner=R[0], ex=False))   # the proposal: the same drawing, in red
            xm = XS((s0 + s1) / 2); zc = lim((s0 + s1) / 2)
            g.append(f'<line x1="{xm:.2f}" y1="{YZ(z + h) - 0.6:.2f}" x2="{xm:.2f}" y2="{YZ(zc) + 0.6:.2f}" stroke="{RED}" stroke-width="{LW["thin"]}" stroke-dasharray="0.6 0.5"/>')
            g.append(f'<text x="{xm + 1.2:.2f}" y="{(YZ(z + h) + YZ(zc)) / 2 + 0.8:.2f}" font-family="{FONT}" font-size="{TY["small"]}" font-weight="700" fill="{RED}" stroke="{WHITE}" stroke-width="0.6" paint-order="stroke">{zc - z - h:.0f} m to spare</text>')
            HALL = (s0, s1, z, h)
        # proposed trees near the line
        for (x, y) in RG.trees + RG.row:
            s0, t0 = st((x, y))
            if abs(t0) <= 4.5 and 0 <= s0 <= L:
                z = grd(s0); g.append(tree_svg(XS(s0), YZ(z), RED, LW['prop'], int(s0 * 7)))
        # the crossing on the avenue and the stop asked for
        sm_ = S['metro'][0]['d'] if S['metro'] else 111.5; zz = grd(sm_)
        for i in range(-4, 5): g.append(f'<line x1="{XS(sm_ + i * 1.6 - 0.4):.2f}" y1="{YZ(zz) + 0.1:.2f}" x2="{XS(sm_ + i * 1.6 + 0.4):.2f}" y2="{YZ(zz) + 0.1:.2f}" stroke="{RED}" stroke-width="0.9"/>')
    # street life for scale, schematic: people, cars on the streets the line crosses, street lights on the avenue
    for k_, s0 in enumerate((40, 47, 118, 132, 176, 186, 223) if proposal else (40, 118, 132, 223)):
        z = grd(s0); g.append(_bw.figure(XS(s0), YZ(z), K, kind=(0, 3, 5, 2, 4, 1, 0)[k_ % 7], seed=k_))
    for s0 in [c['d'] for c in S['streets'] if c.get('hw') in ('residential', 'secondary', 'tertiary') and c['d'] < FENCE]:
        for off in ((-2.2, 2.2) if s0 > 100 and s0 < 110 else (1.6,)):
            z = grd(s0 + off); g.append(_bw.car_flat(XS(s0 + off), YZ(z), K, seed=int(s0 * 5 + off * 3)))
    for s0 in (99.0, 124.5): g.append(_bw.lamp(XS(s0), YZ(grd(s0)), K, side=1 if s0 < 110 else -1))
    svg.add(''.join(g))
    # axes: height every 5 m on the left, distance every 10 m below
    xa = DX0 - 2.5
    svg.add(f'<line x1="{xa:.2f}" y1="{YZ(665):.2f}" x2="{xa:.2f}" y2="{YZ(695):.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
    for z in range(665, 696, 5):
        svg.add(f'<line x1="{xa - 1:.2f}" y1="{YZ(z):.2f}" x2="{xa:.2f}" y2="{YZ(z):.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
        svg.text(xa - 1.6, YZ(z) + 0.6, str(z), TY['tiny'], fill=G[5], anchor='end')
    svg.text(xa - 1.6, YZ(695) - 3.0, 'm a.s.l.', TY['tiny'], fill=G[5], anchor='end')
    ya = YZ(Z0) + 2.2
    svg.add(f'<line x1="{XS(0):.2f}" y1="{ya:.2f}" x2="{XS(L):.2f}" y2="{ya:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
    for s0 in range(0, int(L) + 1, 10):
        tl = 1.4 if s0 % 50 == 0 else 0.7
        svg.add(f'<line x1="{XS(s0):.2f}" y1="{ya:.2f}" x2="{XS(s0):.2f}" y2="{ya + tl:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
        if s0 % 50 == 0: svg.text(XS(s0), ya + 4.0, f'{s0}' + (' m' if s0 == 350 else ''), TY['tiny'], fill=G[5], anchor='middle')
    # what lies along the line: streets, metro, fence (labels under the ground)
    marks = [(c['d'], c['nm'] or ('cycle path' if c['hw'] == 'cycleway' else 'base road' if c['hw'] == 'service' else c['hw'])) for c in S['streets']]
    marks += [(m['d'], 'metro extension') for m in S['metro']] + [(FENCE, 'fence')]   # (short: the labels stand in the soil under the cut band)
    done = []
    for d0, nm in sorted(marks):
        if any(abs(d0 - d1) < 4 and nm == n1 for d1, n1 in done): continue
        if any(abs(d0 - d1) < 0.5 for d1, _ in done): continue
        done.append((d0, nm)); x = XS(d0); z = grd(d0)
        nm = nm.replace('Calle ', 'C. ').replace('Avenida ', 'Av. ').replace('Ciclovía Armilla-Churriana-Gabias', 'cycle path')
        svg.add(f'<line x1="{x:.2f}" y1="{YZ(z) + 0.8:.2f}" x2="{x:.2f}" y2="{YZ(Z0) - 0.6:.2f}" stroke="{G[4]}" stroke-width="{LW["hair"] * 2}"/>')
        svg.text(x - 0.6, YZ(Z0) - 1.2, nm, TY['tiny'] + 0.15, fill=G[5], anchor='start', rotate=-90, halo=0.5)
    # names above
    label(XS(24), YZ(grd(24) + 14.5), f'houses of Churriana, {lo_floors}–{hi_floors} floors', size=TY['small'], fill=G[5])
    label(XS(290), YZ(grd(290) + 3.2), 'the base: approach of runway 18, closed', size=TY['small'], fill=G[5])
    label(XS(122), YZ(grd(122) + 23.5), 'flight ceiling (RD 118/2019, our interpolation)', size=TY['small'], fill=G[5], italic=True)
    if not proposal: label(XS(172), YZ(grd(172) + 2.6), 'empty strip: two parcels, no building', size=TY['small'], fill=INK)
    for s0, lt in ((0, 'S'), (L, 'S')):
        x = XS(s0); y = YZ(Z1) + 2.5
        svg.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="2.6" fill="{WHITE}" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
        svg.text(x, y + 0.95, lt, 2.6, weight=700, anchor='middle')
    svg.text(XS(0) + 4, YZ(Z1) + 3.4, 'north', TY['small'], fill=G[5]); svg.text(XS(L) - 4, YZ(Z1) + 3.4, 'south — looking east', TY['small'], fill=G[5], anchor='end')
    return YZ

top1 = PY0 + 2 * BW * K + 24
YZ1 = section(top1, False, 'SECTION S–S · TODAY · 1:500')
top2 = top1 + (Z1 - Z0) * K + 40
YZ2 = section(top2, True, 'SECTION S–S · THE RESIDENTS’ PROPOSAL · 1:500')
# callouts on the proposed section (the plan's numbers)
if GROUP == 'residents':
    def co(n, s0, dz):
        x = XS(s0); y = YZ2(grd(s0) + dz)
        svg.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="2.3" fill="{RED}" stroke="{WHITE}" stroke-width="0.35"/>')
        svg.text(x, y + 0.8, str(n), 2.2, fill=WHITE, weight=700, anchor='middle')
    it = RG.hall.intersection(LineString([tuple(A_), tuple(B_)])); hs = sorted(st(p)[0] for p in it.coords)
    co(5, (hs[0] + hs[1]) / 2, 9.8); co(1, 170, 3.2); co(2, 165.6, 10.5); co(6, 224, 9.5); co(7, S['metro'][0]['d'] - 5, 2.0)
    label(XS(170), YZ2(grd(170) + 1.2), 'open lawn', size=TY['small'], fill=RED, weight=600)
yEnd = YZ2(Z0) + 22

# ---- the column (same structure as the plan sheet) ----------------------------------------------------------------------
x0 = COL; y = 12.4; LH = lambda sz: sz * 1.27
def rule(yy): svg.add(f'<line x1="{x0}" y1="{yy:.2f}" x2="{x0 + CW}" y2="{yy:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
def head(yy, s, col=INK): svg.text(x0, yy, s, TY['eyebrow'], fill=col, weight=700, spacing=0.35)
svg.text(x0, y, '+ EXERCISE 2.2 · INTEREST GROUPS · STAGE 1', TY['eyebrow'], fill=G[5], weight=600, spacing=0.3)
svg.text(x0 + CW, y, '2.2-R · 02', TY['eyebrow'], fill=G[5], weight=600, anchor='end')
y += 15.5; svg.text(x0, y, 'Residents', TY['title'], weight=700)
y += 7.0; svg.text(x0, y, 'of the five towns', TY['sub'], weight=500)
y += 6.4; svg.text(x0, y, 'Urban section 1:500', TY['sub'], weight=500, fill=RED)
y += 5.2
for ln in wrap(f'The shared line S–S: {L:.0f} m, square to the north fence — from the houses of Churriana across Avenida de Poniente and the metro, the empty strip and the fence, {L - FENCE:.0f} m into the base. Looking east. The same line for all three groups.', TY['small'], CW):
    svg.text(x0, y, ln, TY['small'], fill=G[5]); y += LH(TY['small'])
y += 2.6; rule(y)
it = RG.hall.intersection(LineString([tuple(A_), tuple(B_)])); hs = sorted(st(p)[0] for p in it.coords); hm = (hs[0] + hs[1]) / 2
y += 6.0; head(y, 'WHAT THE SECTION SHOWS', RED); y += 5.0
pts_ = [f'The flight ceiling is a slope: {lim(0) - grd(0):.0f} m above the ground at the houses, {lim(FENCE) - grd(FENCE):.0f} m at the fence, {lim(L) - grd(L):.0f} m at the end of the line inside the base (approach surface of runway 18).',
        f'The houses the line cuts have {min(c["lv"] for c in S["cuts"])}–{max(c["lv"] for c in S["cuts"])} floors (Catastro): about {min(c["lv"] for c in S["cuts"]) * 3}–{max(c["lv"] for c in S["cuts"]) * 3} m, an estimate (floors × 3 m). One 4-floor sliver (0.5 m) is left out. Row houses of 1991–2006: the fronts behind the line are drawn from the Catastro’s façade photos, and so are the roofs of the cut houses.',
        f'The hall (2 floors, about 7 m) keeps {lim(hm) - grd(hm) - 7:.0f} m under the ceiling: low public uses fit, towers would not.',
        f'Today the strip between the avenue and the fence road is empty ({F["strip"]["m2"] / 1e6:.3f} km², two parcels; the metro project calls it “the future park”). In the proposal it is the park: the hall on the avenue, the lawn in the middle, trees to the fence walk.',
        'The fence stays where it is: the base is not touched. Its height is not mapped, so it is drawn as unknown.']
for w in pts_:
    lines = wrap(w, TY['small'], CW - 3.2)
    svg.add(f'<circle cx="{x0 + 0.8:.2f}" cy="{y - 0.85:.2f}" r="0.5" fill="{RED}"/>')
    for ln in lines: svg.text(x0 + 3.2, y, ln, TY['small']); y += LH(TY['small'])
    y += 0.9
y += 2.2; rule(y)
y += 6.0; head(y, 'ALONG THE LINE, NORTH \u2192 SOUTH'); y += 5.0
cuts = S['cuts']; nm_at = lambda key: next((c['d'] for c in S['streets'] if (c.get('nm') or '').startswith(key)), None)
park_it = RG.park.intersection(LineString([tuple(A_), tuple(B_)])); ps = sorted(st(p)[0] for p in park_it.coords)
rows_ = [(f'0\u2013{cuts[-1]["s1"]:.0f} m', f'houses of Churriana, 1\u20133 floors; C. Rafael Alberti at {nm_at("Calle Rafael"):.0f} m'),
         (f'{nm_at("Avenida de Poniente"):.0f} m', f'Avenida de Poniente; the metro extension at {S["metro"][0]["d"]:.0f} m'),
         (f'{ps[0]:.0f}\u2013{ps[-1]:.0f} m', f'the empty strip \u2192 the park; hall at {hs[0]:.0f}\u2013{hs[1]:.0f} m'),
         (f'{nm_at("Calle Santa"):.0f}\u2013{FENCE:.0f} m', 'C. Santa Luc\u00eda, the cycle path, the fence'),
         (f'{FENCE:.0f}\u2013{L:.0f} m', 'the base, under the approach of runway 18')]
for a_, b_ in rows_:
    svg.text(x0, y, a_, TY['small'], weight=600)
    lines = wrap(b_, TY['small'], CW - 24)
    for i, ln in enumerate(lines): svg.text(x0 + 23, y + i * LH(TY['small']), ln, TY['small'])
    y += LH(TY['small']) * max(1, len(lines)) + 1.0
y += 2.2; rule(y)
y += 6.0; head(y, 'KEY'); y += 5.2
def sw(kind, yy, a=None):
    x = x0; y0 = yy - 2.4
    if kind in ('cut', 'hall'):
        c_ = RED
        svg.add(_r(x, y0, 6, 3.2, WHITE) + _r(x, y0, 6, 0.45, c_) + _r(x, y0 + 1.5, 6, 0.4, c_) + _r(x, y0 + 2.9, 6, 0.3, c_) + _r(x, y0, 0.55, 3.2, c_) + _r(x + 5.45, y0, 0.55, 3.2, c_)
                + _r(x - 0.02, y0 + 0.7, 0.6, 0.6, WHITE) + _r(x + 5.43, y0 + 0.7, 0.6, 0.6, WHITE) + _r(x - 0.02, y0 + 2.05, 0.6, 0.6, WHITE) + _r(x + 5.43, y0 + 2.05, 0.6, 0.6, WHITE))
    elif kind == 'sky': svg.add(_r(x, y0 + 0.9, 3.6, 2.3, WHITE, G[4], 0.07) + _r(x + 2.6, y0, 3.4, 3.2, WHITE, G[3], 0.07))
    elif kind == 'baseground': svg.add(_r(x, y0 + 0.9, 6, 1.2, RED) + ''.join(_l(x + 0.2 + j * 1.25, y0 + 2.1, x + 1.4 + j * 1.25, y0 + 0.9, 0.24, WHITE) for j in range(4)))
    elif kind == 'ground': svg.add(_r(x, y0 + 0.9, 6, 1.0, RED) + _bw.tex('bwDots3', x, y0 + 1.9, 6, 1.4))
    elif kind == 'ceil': svg.add(f'<line x1="{x}" y1="{y0 + 1.5:.2f}" x2="{x + 6}" y2="{y0 + 1.5:.2f}" stroke="{G[5]}" stroke-width="{LW["section"]}" stroke-dasharray="2.2 1.2"/>')
    elif kind == 'redground': svg.add(f'<line x1="{x}" y1="{y0 + 1.5:.2f}" x2="{x + 6}" y2="{y0 + 1.5:.2f}" stroke="{RED}" stroke-width="{LW["propBold"] + 0.4}"/>')
    elif kind == 'tree': svg.add(tree_svg(x + 3, y0 + 3.4, RED, LW['prop'], 0, h=1.9))   # the same image as in the section (small)
    elif kind == 'treefar': svg.add(tree_svg(x + 3, y0 + 3.4, R[2], LW['thin'], 3, op=0.6, h=1.9))
    elif kind == 'person': svg.add(_bw.figure(x + 1.6, y0 + 3.0, K, kind=0, seed=3) + _bw.car_flat(x + 4.6, y0 + 3.0, K, seed=2))   # the same drawings as in the sections
    elif kind == 'fence': svg.add(f'<line x1="{x + 3:.2f}" y1="{y0 - 0.2:.2f}" x2="{x + 3:.2f}" y2="{y0 + 3:.2f}" stroke="{INK}" stroke-width="{LW["mid"]}" stroke-dasharray="0.8 0.5"/>')
SAMPLE = {'wall': 'sand', 'balcony': 'iron', 'shutters': 'roller', 'hoods': True, 'roof': 'tile', 'door': 'wood', 'garage': 'white', 'bars': True}   # the row on C. Rafael Alberti, as read from its photos
items = [('cut', 'Building cut by the line: walls, floors and roof cut (Catastro floors × 3 m, estimate); what shows inside is schematic'),
         ('far', 'Building beyond the line, up to 40 m east, drawn from the façade photograph the Catastro publishes for its parcel: wall, base, roof, balconies, shutters, doors, garden wall and gate. Number and place of the openings: schematic.'),
         ('tex', ''), ('sky', 'Buildings 40–100 m beyond the line: outline only'), ('ground', 'Ground, cut (IGN MDT25)'), ('baseground', 'Ground of the base (closed; nothing inside is surveyed)'),
         ('ceil', 'Flight ceiling: the easement surface over the line (RD 118/2019, our interpolation, approximate); hatched = the air it keeps free'), ('fence', 'Fence: height not mapped'), ('person', 'People, cars, street lights: schematic, for scale'),
         ('hall', 'Neighbourhood hall, proposed (2 floors, cut)'), ('redground', 'Park and fence walk, proposed'), ('tree', 'Tree, proposed, on the line (drawn 8–11 m; species not chosen)'), ('treefar', 'Tree, proposed, beyond the line')]
for kind, txt in items:
    if kind == 'far':     # a sample front, larger than the other swatches
        y += 2.2; svg.add(_bw.elev_obs(x0, x0 + 12, y + 5.4, 2, SAMPLE, seed=3, K=1.0)); lines = wrap(txt, TY['small'], CW - 15.5)
        for i, ln in enumerate(lines): svg.text(x0 + 14.5, y - 0.6 + i * LH(TY['small']), ln, TY['small'])
        y += max(LH(TY['small']) * len(lines), 8.0) + 1.6; continue
    if kind == 'tex':     # the textures, from the same definitions as the drawing (_bw.tex)
        y += 0.6
        for j, (nm, lb) in enumerate((('bwDots1', 'light render'), ('bwDots3', 'dark render'), ('bwBrick', 'brick'), ('bwRubble', 'stone base'), ('bwTile', 'clay tiles'), ('bwShutter', 'shutter'), ('bwHatchH', 'surround'), ('bwDots2', 'mid render'))):
            xx = x0 + j * 12.6; svg.add(_r(xx, y - 2.6, 9.6, 4.2, WHITE) + _bw.tex(nm, xx, y - 2.6, 9.6, 4.2) + _r(xx, y - 2.6, 9.6, 4.2, 'none', INK, 0.08)); svg.text(xx + 4.8, y + 4.0, lb, TY['tiny'], fill=G[5], anchor='middle')
        y += 8.2; continue
    sw(kind, y); lines = wrap(txt, TY['small'], CW - 9)
    for i, ln in enumerate(lines): svg.text(x0 + 7.6, y + i * LH(TY['small']), ln, TY['small'])
    y += LH(TY['small']) * max(1, len(lines)) + 1.3
y += 1.0; rule(y)
y += 6.0; head(y, 'SCALE 1:500 ON A1 — TRUE HEIGHTS, NOT EXAGGERATED'); y += 4.4
for i, (a, b) in enumerate(((0, 5), (5, 10), (10, 25), (25, 50))):
    svg.add(f'<rect x="{x0 + a * K:.2f}" y="{y:.2f}" width="{(b - a) * K:.2f}" height="1.5" fill="{INK if i % 2 == 0 else WHITE}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
for v in (0, 5, 10, 25, 50): svg.text(x0 + v * K, y + 4.8, f'{v}' + (' m' if v == 50 else ''), TY['tiny'] + 0.2, fill=INK, anchor='middle' if v else 'start')
y += 9
SRC = ('Sources: IGN MDT25 (CC BY 4.0) for the ground, sampled every metre (a 25 m model: it smooths the street level); D. G. del Catastro: INSPIRE buildings (floors, use, year) and parcels, and the façade photograph '
       'of each parcel (Sede Electrónica, photos dated 2 June 2014) — the photographs are not reproduced, only what was read from them is drawn; OpenStreetMap contributors (streets, base outline, metro extension; ODbL); '
       'Origen de los datos: Ministerio de Defensa (aeronautical easements, RD 118/2019). '
       'Notes: heights = floors × 3 m, an estimate. Façades: wall material, base, roof type, balconies, shutters, doors, garden walls and gates as the photo shows them; the number and place of the openings and the pitch '
       'of the roofs are schematic; the photo shows the street front — the face drawn may be another side of the building. Inside the cut buildings nothing is surveyed. The ceiling line is the lowest easement surface over the line, '
       'interpolated between the official drawn lines — approximate, not the legal value. People, cars, street lights, the trees in front of the houses, the metro vehicle and its overhead line are schematic. '
       'The proposal is drawn schematically — its shapes and sizes are ours.')
lines = wrap(SRC, TY['tiny'], CW, avg=0.52)
yS = SH - 12 - len(lines) * 2.1
# where the line is: the shared frame at 1:7,000 with the line
fr = F['frame']; lk = CW / (fr[2] - fr[0]); lh = (fr[3] - fr[1]) * lk; lx0 = x0; ly0 = yS - 8 - lh
head(ly0 - 4.0, 'WHERE \u2014 THE LINE ON THE SHARED FRAME (PLAN, SHEET 01)')
LX = lambda u: lx0 + (u - fr[0]) * lk; LY = lambda v: ly0 + (fr[3] - v) * lk
def ld(g):
    gs = [g] if g.geom_type in ('Polygon', 'LineString', 'LinearRing') else list(getattr(g, 'geoms', []))
    out = []
    for q in gs:
        if q.geom_type == 'Polygon':
            for r in [q.exterior] + list(q.interiors): out.append('M' + ' L'.join(f'{LX(x):.2f},{LY(y):.2f}' for x, y in r.coords) + ' Z')
        elif q.geom_type in ('LineString', 'LinearRing'): out.append('M' + ' L'.join(f'{LX(x):.2f},{LY(y):.2f}' for x, y in q.coords))
    return ' '.join(out)
svg.defs_add(f'<clipPath id="locclip"><rect x="{lx0}" y="{ly0:.2f}" width="{CW:.2f}" height="{lh:.2f}"/></clipPath>')
lg = [f'<path d="{ld(gd.base)}" fill="url(#baseHatch)" stroke="none" fill-rule="evenodd"/>']
lg.append('<path d="' + ' '.join(ld(g) for g, b in gd.blds) + f'" fill="{G[3]}" stroke="none"/>')
if GROUP == 'residents': lg.append(f'<path d="{ld(RG.park)}" fill="{R[1]}" stroke="{RED}" stroke-width="{LW["prop"]}"/><path d="{ld(RG.prom)}" fill="{R[1]}" stroke="none"/><path d="{ld(RG.hall)}" fill="{RED}"/>')
lg.append(f'<path d="{ld(gd.fence_line)}" fill="none" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
lg.append(f'<line x1="{LX(A_[0]):.2f}" y1="{LY(A_[1]):.2f}" x2="{LX(B_[0]):.2f}" y2="{LY(B_[1]):.2f}" stroke="{INK}" stroke-width="{LW["section"] + 0.15}" stroke-dasharray="3 0.7 0.5 0.7"/>')
for (u, v) in (A_, B_): lg.append(f'<circle cx="{LX(u):.2f}" cy="{LY(v):.2f}" r="1.6" fill="{WHITE}" stroke="{INK}" stroke-width="{LW["thin"]}"/><text x="{LX(u):.2f}" y="{LY(v) + 0.6:.2f}" font-family="{FONT}" font-size="1.7" font-weight="700" fill="{INK}" text-anchor="middle">S</text>')
svg.add(f'<g clip-path="url(#locclip)">{"".join(lg)}</g><rect x="{lx0}" y="{ly0:.2f}" width="{CW:.2f}" height="{lh:.2f}" fill="none" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
svg.add(f'<rect x="{lx0 + 2:.2f}" y="{ly0 + lh - 3:.2f}" width="{100 * lk:.2f}" height="0.8" fill="{INK}"/>')
svg.text(lx0 + 3 + 100 * lk, ly0 + lh - 2.1, '100 m', TY['tiny'], fill=INK, halo=0.5)
for i, ln in enumerate(lines): svg.text(x0, yS + i * 2.1, ln, TY['tiny'], fill=G[5])
print('column ends at', round(y, 1), '| sources at', round(yS, 1), '| drawing ends at', round(yEnd, 1), '| hall', [round(v, 1) for v in hs])
name = os.path.join(OUT, f'2.2_{GROUP}_02_section_1-500')
ok = export(svg, name, SW, SH, dpi=int(os.environ.get('DPI', 150)))
print('fonts loaded:', ok, '->', name + '.pdf')
