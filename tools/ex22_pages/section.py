"""Exercise 2.2 · the urban section 1:500 of an interest group on the SHARED LINE S-S (the north edge, Churriana | Armilla).
A1 landscape (841 x 594 mm). Left: a 1:500 plan strip along the line (70 m wide), the section today and the section with the
group's proposal (350 m = 700 mm at 1:500, true scale both ways, no exaggeration). Right: the same column as the plan sheet.
Data along the line (tools/build_ex22_frame.py): ground every metre (IGN MDT25), the aeronautical limit (RD 118/2019, our
interpolation), the Catastro buildings it cuts (floors x 3 m = an ESTIMATE) and the buildings up to 40 m beyond it (east).
The fence's height is not mapped and is drawn as such. Every proposal element is schematic.
Usage (repo root): python3 tools/ex22_pages/section.py <out folder> [residents]
Not part of the site or of the tests."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ex22 import *   # noqa: F401,F403
import groups
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
svg.defs_add(f'<pattern id="earth" patternUnits="userSpaceOnUse" width="1.6" height="1.6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="{G[3]}" stroke-width="0.1"/></pattern>')

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
    pg.append(f'<circle cx="{sx:.2f}" cy="{sy:.2f}" r="3.0" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["propBold"]}"/><text x="{sx:.2f}" y="{sy + 1.1:.2f}" font-family="{FONT}" font-size="3" font-weight="700" fill="{RED}" text-anchor="middle">M?</text>')
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
Z0, Z1 = 662.0, 696.0                                      # the drawn height range (m a.s.l.)
def section(top, proposal, title):
    yb = top + (Z1 - Z0) * K                                 # y of Z0
    YZ = lambda z: yb - (z - Z0) * K
    g = []
    svg.text(DX0, top - 4.0, title, TY['eyebrow'], weight=700, spacing=0.35, fill=RED if proposal else INK)
    # buildings beyond the line (east, up to 40 m): pale, the farther the paler
    far = []
    for gg, b in gd.blds:
        if not b.get('lv') or b.get('hu'): continue
        c = list(gg.exterior.coords); ss = [st(p) for p in c]; ts = [t for _, t in ss]
        if max(ts) <= 0 or min(ts) > 40 or gg.intersects(LineString([tuple(A_), tuple(B_)])): continue
        s0, s1 = min(s for s, _ in ss), max(s for s, _ in ss)
        if s1 < 0 or s0 > L: continue
        tmin = max(0.0, min(ts)); far.append((tmin, max(0, s0), min(L, s1), b['lv']))
    for tmin, s0, s1, lv in sorted(far, key=lambda q: -q[0]):
        z = grd((s0 + s1) / 2); h = lv * 3.0; col = G[1] if tmin > 20 else G[2]
        g.append(f'<rect x="{XS(s0):.2f}" y="{YZ(z + h):.2f}" width="{(s1 - s0) * K:.2f}" height="{h * K:.2f}" fill="{col}" stroke="{G[3]}" stroke-width="{LW["hair"] * 1.5}"/>')
    # proposal trees beyond the line (pale red), then the ground
    if proposal and GROUP == 'residents':
        for (x, y) in RG.trees + RG.row:
            s0, t0 = st((x, y))
            if 4.5 < t0 <= 30 and 0 <= s0 <= L:
                z = grd(s0); g.append(f'<line x1="{XS(s0):.2f}" y1="{YZ(z):.2f}" x2="{XS(s0):.2f}" y2="{YZ(z + 2.6):.2f}" stroke="{R[2]}" stroke-width="0.25"/><circle cx="{XS(s0):.2f}" cy="{YZ(z + 5.0):.2f}" r="{2.5 * K:.2f}" fill="{WHITE}" fill-opacity="0.6" stroke="{R[2]}" stroke-width="{LW["thin"]}"/>')
    # the ground: earth below the line
    pts = [(XS(s), YZ(grd(s))) for s in range(0, int(L) + 1)]
    g.append('<path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + f' L{XS(L):.2f},{YZ(Z0):.2f} L{XS(0):.2f},{YZ(Z0):.2f} Z" fill="url(#earth)" stroke="none"/>')
    # the base: hatched band above the ground line from the fence on (closed land)
    # the cut buildings
    for c in S['cuts']:
        z = grd((c['s0'] + c['s1']) / 2); h = c['h_est']
        if h is None: continue
        g.append(f'<rect x="{XS(c["s0"]):.2f}" y="{YZ(z + h):.2f}" width="{(c["s1"] - c["s0"]) * K:.2f}" height="{h * K:.2f}" fill="{G[5]}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
    g.append('<path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in pts) + f'" fill="none" stroke="{INK}" stroke-width="{LW["ground"]}"/>')
    # the metro (vehicle drawn schematically: 2.65 x 3.4 m) and its crossing
    for m in S['metro']:
        s0 = m['d']; z = grd(s0)
        g.append(f'<rect x="{XS(s0 - 1.33):.2f}" y="{YZ(z + 3.8):.2f}" width="{2.65 * K:.2f}" height="{3.4 * K:.2f}" rx="0.8" fill="{WHITE}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
        g.append(f'<line x1="{XS(s0 - 3):.2f}" y1="{YZ(z + 0.25):.2f}" x2="{XS(s0 + 3):.2f}" y2="{YZ(z + 0.25):.2f}" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
    # the fence: its height is not mapped — a thin dashed post and a question mark
    zf = grd(FENCE)
    g.append(f'<line x1="{XS(FENCE):.2f}" y1="{YZ(zf):.2f}" x2="{XS(FENCE):.2f}" y2="{YZ(zf + 2.2):.2f}" stroke="{INK}" stroke-width="{LW["mid"]}" stroke-dasharray="0.8 0.5"/>')
    # the flight ceiling
    cp = [(XS(s), YZ(lim(s))) for s in range(0, int(L) + 1)]
    g.append('<path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in cp) + f'" fill="none" stroke="{G[5]}" stroke-width="{LW["section"]}" stroke-dasharray="2.2 1.2"/>')
    # allowed height above the ground, measured at three places
    for s0 in (20, 170, 330):
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
            g.append(f'<rect x="{XS(s0):.2f}" y="{YZ(z + h):.2f}" width="{(s1 - s0) * K:.2f}" height="{h * K:.2f}" fill="{RED}" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
            g.append(f'<line x1="{XS(s0):.2f}" y1="{YZ(z + 3.5):.2f}" x2="{XS(s1):.2f}" y2="{YZ(z + 3.5):.2f}" stroke="{WHITE}" stroke-width="0.25"/>')
            xm = XS((s0 + s1) / 2); zc = lim((s0 + s1) / 2)
            g.append(f'<line x1="{xm:.2f}" y1="{YZ(z + h) - 0.6:.2f}" x2="{xm:.2f}" y2="{YZ(zc) + 0.6:.2f}" stroke="{RED}" stroke-width="{LW["thin"]}" stroke-dasharray="0.6 0.5"/>')
            g.append(f'<text x="{xm + 1.2:.2f}" y="{(YZ(z + h) + YZ(zc)) / 2 + 0.8:.2f}" font-family="{FONT}" font-size="{TY["small"]}" font-weight="700" fill="{RED}" stroke="{WHITE}" stroke-width="0.6" paint-order="stroke">{zc - z - h:.0f} m to spare</text>')
            HALL = (s0, s1, z, h)
        # proposed trees near the line
        for (x, y) in RG.trees + RG.row:
            s0, t0 = st((x, y))
            if abs(t0) <= 4.5 and 0 <= s0 <= L:
                z = grd(s0); g.append(f'<line x1="{XS(s0):.2f}" y1="{YZ(z):.2f}" x2="{XS(s0):.2f}" y2="{YZ(z + 2.6):.2f}" stroke="{RED}" stroke-width="0.35"/><circle cx="{XS(s0):.2f}" cy="{YZ(z + 5.0):.2f}" r="{2.5 * K:.2f}" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["prop"]}"/>')
        # the crossing on the avenue and the stop asked for
        sm_ = S['metro'][0]['d'] if S['metro'] else 111.5; zz = grd(sm_)
        for i in range(-4, 5): g.append(f'<line x1="{XS(sm_ + i * 1.6 - 0.4):.2f}" y1="{YZ(zz) + 0.1:.2f}" x2="{XS(sm_ + i * 1.6 + 0.4):.2f}" y2="{YZ(zz) + 0.1:.2f}" stroke="{RED}" stroke-width="0.9"/>')
    # people for scale (1.75 m), drawn schematically
    for s0 in ((40, 118, 176, 223) if proposal else (40, 118, 223)):
        z = grd(s0); x = XS(s0); hh = 1.75 * K
        g.append(f'<circle cx="{x:.2f}" cy="{YZ(z) - hh + 0.45:.2f}" r="0.42" fill="{G[5]}"/><path d="M{x - 0.45:.2f},{YZ(z):.2f} L{x - 0.3:.2f},{YZ(z) - hh + 1.0:.2f} L{x + 0.3:.2f},{YZ(z) - hh + 1.0:.2f} L{x + 0.45:.2f},{YZ(z):.2f} Z" fill="{G[5]}"/>')
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
    marks += [(m['d'], 'metro (under construction)') for m in S['metro']] + [(FENCE, 'fence (height not mapped)')]
    done = []
    for d0, nm in sorted(marks):
        if any(abs(d0 - d1) < 4 and nm == n1 for d1, n1 in done): continue
        if any(abs(d0 - d1) < 0.5 for d1, _ in done): continue
        done.append((d0, nm)); x = XS(d0); z = grd(d0)
        nm = nm.replace('Calle ', 'C. ').replace('Avenida ', 'Av. ').replace('Ciclovía Armilla-Churriana-Gabias', 'cycle path')
        svg.add(f'<line x1="{x:.2f}" y1="{YZ(z) + 0.8:.2f}" x2="{x:.2f}" y2="{YZ(Z0) - 0.6:.2f}" stroke="{G[4]}" stroke-width="{LW["hair"] * 2}"/>')
        svg.text(x - 0.6, YZ(Z0) - 1.2, nm, TY['tiny'] + 0.15, fill=G[5], anchor='start', rotate=-90, halo=0.5)
    # names above
    label(XS(45), YZ(grd(45) + 12.5), 'houses of Churriana, 1–3 floors', size=TY['small'], fill=G[5])
    label(XS(290), YZ(grd(290) + 3.2), 'the base: approach of runway 18, closed', size=TY['small'], fill=G[5])
    label(XS(122), YZ(grd(122) + 23.5), 'flight ceiling (RD 118/2019, our interpolation)', size=TY['small'], fill=G[5], italic=True)
    if not proposal: label(XS(172), YZ(grd(172) + 2.6), 'empty strip: two parcels, no building', size=TY['small'], fill=INK)
    for s0, lt in ((0, 'S'), (L, 'S')):
        x = XS(s0); y = YZ(Z1) + 2.5
        svg.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="2.6" fill="{WHITE}" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
        svg.text(x, y + 0.95, lt, 2.6, weight=700, anchor='middle')
    svg.text(XS(0) + 4, YZ(Z1) + 3.4, 'north', TY['small'], fill=G[5]); svg.text(XS(L) - 4, YZ(Z1) + 3.4, 'south — looking east', TY['small'], fill=G[5], anchor='end')
    return YZ

top1 = PY0 + 2 * BW * K + 26
YZ1 = section(top1, False, 'SECTION S–S · TODAY · 1:500')
top2 = top1 + (Z1 - Z0) * K + 44
YZ2 = section(top2, True, 'SECTION S–S · THE RESIDENTS’ PROPOSAL · 1:500')
# callouts on the proposed section (the plan's numbers)
if GROUP == 'residents':
    def co(n, s0, dz):
        x = XS(s0); y = YZ2(grd(s0) + dz)
        svg.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="2.3" fill="{RED}" stroke="{WHITE}" stroke-width="0.35"/>')
        svg.text(x, y + 0.8, str(n), 2.2, fill=WHITE, weight=700, anchor='middle')
    it = RG.hall.intersection(LineString([tuple(A_), tuple(B_)])); hs = sorted(st(p)[0] for p in it.coords)
    co(5, (hs[0] + hs[1]) / 2, 9.8); co(1, 170, 3.2); co(2, 196, 10.5); co(6, 224, 9.5); co(7, S['metro'][0]['d'] - 5, 2.0); co(9, S['metro'][0]['d'] + 4.5, 6.5)
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
        'The houses on the line have 1–3 floors (Catastro): about 3–9 m, an estimate (floors × 3 m).',
        f'The hall (2 floors, about 7 m) keeps {lim(hm) - grd(hm) - 7:.0f} m under the ceiling: low public uses fit, towers would not.',
        f'Today the strip between the avenue and the fence road is empty ({F["strip"]["m2"] / 1e4:.2f} ha, two parcels). In the proposal it is the park: the hall on the avenue, the lawn in the middle, trees to the fence walk.',
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
    if kind == 'cut': svg.add(f'<rect x="{x}" y="{y0:.2f}" width="6" height="3" fill="{G[5]}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
    elif kind == 'far': svg.add(f'<rect x="{x}" y="{y0:.2f}" width="6" height="3" fill="{G[2]}" stroke="{G[3]}" stroke-width="{LW["hair"] * 1.5}"/>')
    elif kind == 'ground': svg.add(f'<rect x="{x}" y="{y0 + 1.2:.2f}" width="6" height="1.8" fill="url(#earth)"/><line x1="{x}" y1="{y0 + 1.2:.2f}" x2="{x + 6}" y2="{y0 + 1.2:.2f}" stroke="{INK}" stroke-width="{LW["ground"]}"/>')
    elif kind == 'ceil': svg.add(f'<line x1="{x}" y1="{y0 + 1.5:.2f}" x2="{x + 6}" y2="{y0 + 1.5:.2f}" stroke="{G[5]}" stroke-width="{LW["section"]}" stroke-dasharray="2.2 1.2"/>')
    elif kind == 'hall': svg.add(f'<rect x="{x}" y="{y0:.2f}" width="6" height="3" fill="{RED}"/>')
    elif kind == 'redground': svg.add(f'<line x1="{x}" y1="{y0 + 1.5:.2f}" x2="{x + 6}" y2="{y0 + 1.5:.2f}" stroke="{RED}" stroke-width="{LW["propBold"] + 0.4}"/>')
    elif kind == 'tree': svg.add(f'<circle cx="{x + 3:.2f}" cy="{y0 + 1.2:.2f}" r="1.3" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["prop"]}"/><line x1="{x + 3:.2f}" y1="{y0 + 2.5:.2f}" x2="{x + 3:.2f}" y2="{y0 + 3.3:.2f}" stroke="{RED}" stroke-width="0.35"/>')
    elif kind == 'treefar': svg.add(f'<circle cx="{x + 3:.2f}" cy="{y0 + 1.2:.2f}" r="1.3" fill="{WHITE}" stroke="{R[2]}" stroke-width="{LW["thin"]}"/>')
    elif kind == 'person': svg.add(f'<circle cx="{x + 3:.2f}" cy="{y0 + 0.4:.2f}" r="0.42" fill="{G[5]}"/><path d="M{x + 2.55:.2f},{y0 + 3:.2f} L{x + 2.7:.2f},{y0 + 1:.2f} L{x + 3.3:.2f},{y0 + 1:.2f} L{x + 3.45:.2f},{y0 + 3:.2f} Z" fill="{G[5]}"/>')
    elif kind == 'fence': svg.add(f'<line x1="{x + 3:.2f}" y1="{y0 - 0.2:.2f}" x2="{x + 3:.2f}" y2="{y0 + 3:.2f}" stroke="{INK}" stroke-width="{LW["mid"]}" stroke-dasharray="0.8 0.5"/>')
items = [('cut', 'Building cut by the line (Catastro floors × 3 m, estimate)'), ('far', 'Building beyond the line, up to 40 m east'), ('ground', 'Ground (IGN MDT25)'),
         ('ceil', 'Flight ceiling: the easement surface over the line (RD 118/2019, our interpolation, approximate)'), ('fence', 'Fence: height not mapped'), ('person', 'Person, 1.75 m (for scale)'),
         ('hall', 'Neighbourhood hall, proposed (2 floors)'), ('redground', 'Park and fence walk, proposed'), ('tree', 'Tree, proposed (crown about 5 m)'), ('treefar', 'Tree, proposed, beyond the line')]
for kind, txt in items:
    sw(kind, y); lines = wrap(txt, TY['small'], CW - 9)
    for i, ln in enumerate(lines): svg.text(x0 + 7.6, y + i * LH(TY['small']), ln, TY['small'])
    y += LH(TY['small']) * max(1, len(lines)) + 1.3
y += 1.0; rule(y)
y += 6.0; head(y, 'SCALE 1:500 ON A1 (841 × 594 MM) — TRUE HEIGHTS, NOT EXAGGERATED'); y += 4.4
for i, (a, b) in enumerate(((0, 5), (5, 10), (10, 25), (25, 50))):
    svg.add(f'<rect x="{x0 + a * K:.2f}" y="{y:.2f}" width="{(b - a) * K:.2f}" height="1.5" fill="{INK if i % 2 == 0 else WHITE}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
for v in (0, 5, 10, 25, 50): svg.text(x0 + v * K, y + 4.8, f'{v}' + (' m' if v == 50 else ''), TY['tiny'] + 0.2, fill=INK, anchor='middle' if v else 'start')
y += 9
SRC = ('Sources: IGN MDT25 (CC BY 4.0) for the ground, sampled every metre (a 25 m model: it smooths the street level); D. G. del Catastro, INSPIRE buildings (floors) and parcels; '
       'OpenStreetMap contributors (streets, base outline, metro extension; ODbL); Origen de los datos: Ministerio de Defensa (aeronautical easements, RD 118/2019). '
       'Notes: heights = floors × 3 m, an estimate; roofs are not drawn. The ceiling line is the lowest easement surface over the line, interpolated between the official drawn lines — approximate, not the legal value. '
       'The metro vehicle and the people are schematic. The proposal is drawn schematically — its shapes and sizes are ours.')
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
