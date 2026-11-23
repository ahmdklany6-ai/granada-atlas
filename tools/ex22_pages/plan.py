"""Exercise 2.2 · the urban plan 1:1000 of an interest group on the SHARED FRAME (the north edge, Churriana | Armilla).
A1 landscape (841 x 594 mm): the map is 710 x 570 mm = 710 x 570 m of ground at 1:1000; the column beside it holds the
group's title, position, programme, key, scale and sources. Context (the same for every group, one line family): Catastro
buildings by floors and parcels, the base behind its fence, the metro extension, the municipal line, the aeronautical ceiling
(allowed height above ground, our interpolation of RD 118/2019), the shared section line S-S. The group's proposal is the one
red thing on the sheet; every proposal element is schematic and is labelled as such.
Usage (repo root): python3 tools/ex22_pages/plan.py <out folder> [residents]   (Playwright + Chromium, pdftoppm)
Not part of the site or of the tests."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ex22 import *   # noqa: F401,F403
from shapely.geometry import Polygon, LineString, Point, box, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity

OUT = sys.argv[1] if len(sys.argv) > 1 else 'exports/ex22'
GROUP = sys.argv[2] if len(sys.argv) > 2 else 'residents'
SW, SH = 841, 594               # A1 landscape
MX, MY = 10, 10                  # map window origin (mm)
import json as _j0, edges
AREA = edges.AREA
F = load_frame() if AREA == 'N' else _j0.load(open(edges.frame_file()))
WATER = '#4F6E80'   # palette: blue (water lines)
V = MapView(F['frame'], MX, MY, 1000)
COL = MX + V.w + 10              # the column beside the map
CW = SW - 10 - COL

svg = SVG(SW, SH)
X, Y, k = V.X, V.Y, V.k

# ---- shared ground geometry (tools/ex22_pages/groups.py) -------------------------------------------------------
import groups
gd = groups.ground(F)
FR, base, blds, built, parcels, streets, fence_line = gd.FR, gd.base, gd.blds, gd.built, gd.parcels, gd.streets, gd.fence_line
S, SA, SB, sec_line, on_sec, U, N, rect = gd.S, gd.SA, gd.SB, gd.sec_line, gd.on_sec, gd.U, gd.N, gd.rect

# ---- SVG definitions: patterns --------------------------------------------------------------------------------------
svg.defs_add(f'<clipPath id="mapclip"><rect x="{MX}" y="{MY}" width="{V.w:.2f}" height="{V.h:.2f}"/></clipPath>')
svg.defs_add(f'<pattern id="baseHatch" patternUnits="userSpaceOnUse" width="2.6" height="2.6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2.6" stroke="{G[3]}" stroke-width="0.12"/></pattern>')
svg.defs_add(f'<pattern id="redHatch" patternUnits="userSpaceOnUse" width="0.9" height="0.9" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="0.9" stroke="{RED}" stroke-width="0.16"/></pattern>')
svg.defs_add(f'<pattern id="redDots" patternUnits="userSpaceOnUse" width="1.2" height="1.2"><circle cx="0.6" cy="0.6" r="0.22" fill="{RED}"/></pattern>')
svg.defs_add(f'<pattern id="redCross" patternUnits="userSpaceOnUse" width="1.1" height="1.1" patternTransform="rotate(45)"><path d="M0,0 L0,1.1 M0,0 L1.1,0" stroke="{RED}" stroke-width="0.14"/></pattern>')

# ---- the group's proposal ---------------------------------------------------------------------------------------------
def residents():
    """The residents of the five towns: the base stays, its edge becomes theirs. Everything here is a PROPOSAL, drawn schematically."""
    R_ = groups.residents(F, gd)
    (park, prom, meadow, allot, plots, play, paths, trees, row, hall, hc, crossings, aveU, sl, dead, stop, gate, at, P) = (
        R_.park, R_.prom, R_.meadow, R_.allot, R_.plots, R_.play, R_.paths, R_.trees, R_.row, R_.hall, R_.hc, R_.crossings, R_.aveU, R_.sl, R_.dead, R_.stop, R_.gate, R_.at, R_.P)
    # -- draw (fills first, then lines and symbols)
    out = []
    out.append(f'<path d="{V.dgeom(park)}" fill="{R[0]}" stroke="none" fill-rule="evenodd"/>')
    out.append(f'<path d="{V.dgeom(prom)}" fill="{R[0]}" stroke="none" fill-rule="evenodd"/>')
    out.append(f'<path d="{V.dgeom(meadow)}" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["thin"]}" stroke-dasharray="0.9 0.6"/>')
    out.append(f'<path d="{V.dgeom(allot)}" fill="url(#redHatch)" stroke="{RED}" stroke-width="{LW["hair"] * 1.5}"/>')
    out.append(f'<path d="{V.dgeom(play)}" fill="url(#redDots)" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
    out.append(f'<path d="{V.dgeom(paths)}" fill="none" stroke="{RED}" stroke-width="{3 * k + 2 * LW["hair"]:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    out.append(f'<path d="{V.dgeom(paths)}" fill="none" stroke="{WHITE}" stroke-width="{3 * k - 2 * LW["hair"]:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    out.append(f'<path d="{V.dgeom(park)}" fill="none" stroke="{RED}" stroke-width="{LW["propBold"]}"/>')
    for (x, y) in trees: out.append(f'<circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="{2.6 * k:.2f}" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["thin"]}"/><circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="0.25" fill="{RED}"/>')
    for (x, y) in row: out.append(f'<circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="{2.6 * k:.2f}" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["thin"]}"/><circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="0.25" fill="{RED}"/>')
    out.append(f'<path d="{V.dgeom(hall)}" fill="{RED}" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
    cx, cy = hall.centroid.x, hall.centroid.y
    out.append(f'<text x="{X(cx):.2f}" y="{Y(cy) + 0.7:.2f}" font-family="{FONT}" font-size="{TY["label"]}" font-weight="700" fill="{WHITE}" text-anchor="middle">II</text>')
    # crossings: zebra bars across the avenue
    for (x, y) in crossings:
        q = aveU.interpolate(aveU.project(Point(x, y))); q2 = aveU.interpolate(aveU.project(Point(x, y)) + 1); dx, dy = q2.x - q.x, q2.y - q.y; n = math.hypot(dx, dy) or 1; ux, uy = dx / n, dy / n
        for s in range(-3, 4):
            bx, by = x + ux * s * 0.9, y + uy * s * 0.9
            out.append(f'<line x1="{X(bx - uy * 13):.2f}" y1="{Y(by + ux * 13):.2f}" x2="{X(bx + uy * 13):.2f}" y2="{Y(by - ux * 13):.2f}" stroke="{RED}" stroke-width="0.45"/>')
    # the slow street
    out.append(f'<path d="{V.dgeom(sl)}" fill="none" stroke="{RED}" stroke-width="{LW["prop"]}" stroke-dasharray="0.25 0.9" stroke-linecap="round"/>')
    # the dead end, joined
    for (x, y) in dead:
        tgt = prom.exterior.interpolate(prom.exterior.project(Point(x, y))) if prom.geom_type == 'Polygon' else min((g.exterior.interpolate(g.exterior.project(Point(x, y))) for g in prom.geoms), key=lambda p: p.distance(Point(x, y)))
        out.append(f'<line x1="{X(x):.2f}" y1="{Y(y):.2f}" x2="{X(tgt.x):.2f}" y2="{Y(tgt.y):.2f}" stroke="{RED}" stroke-width="{LW["propBold"]}"/>')
        out.append(f'<circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="1.5" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["propBold"]}"/><path d="M{X(x) - 0.8:.2f},{Y(y):.2f} H{X(x) + 0.8:.2f} M{X(x):.2f},{Y(y) - 0.8:.2f} V{Y(y) + 0.8:.2f}" stroke="{RED}" stroke-width="{LW["prop"]}"/>')
    # the stop asked for
    out.append(f'<path d="{V.dgeom(R_.platform, close=False)}" fill="none" stroke="{RED}" stroke-width="2.2" stroke-linecap="butt" opacity="0.9"/>')   # the stop's platforms
    mx_, my_ = X(stop[0]), Y(stop[1]) + 7.5
    out.append(f'<circle cx="{mx_:.2f}" cy="{my_:.2f}" r="2.3" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["propBold"]}"/>')
    out.append(f'<text x="{mx_:.2f}" y="{my_ + 0.85:.2f}" font-family="{FONT}" font-size="2.4" font-weight="700" fill="{RED}" text-anchor="middle">M</text>')
    out.append(f'<text x="{mx_ + 3.2:.2f}" y="{my_ + 0.7:.2f}" font-family="{FONT}" font-size="{TY["map"]}" font-weight="600" fill="{RED}" stroke="{WHITE}" stroke-width="0.6" paint-order="stroke">San Cayetano (approx.)</text>')
    # the gate into the sports complex
    gx, gy = X(gate[0]), Y(gate[1])
    out.append(f'<path d="M{gx - 2.2:.2f},{gy - 1.4:.2f} L{gx:.2f},{gy:.2f} L{gx - 2.2:.2f},{gy + 1.4:.2f}" fill="none" stroke="{RED}" stroke-width="{LW["propBold"]}" stroke-linecap="round" stroke-linejoin="round"/>')

    # numbered callouts (the programme's numbers)
    east_trees = [t for t in trees if t[0] > hc[0] + 25]
    tree_c = east_trees[len(east_trees) // 2] if east_trees else (trees[len(trees) // 2] if trees else hc)
    f6 = fence_line.interpolate(fence_line.project(Point(443470, 4110795))); prom_c = (f6.x, f6.y + 6.5)
    sl_mid = sl.interpolate(0.55, normalized=True) if not sl.is_empty else Point(443700, 4110800)
    callouts = [(1, at(95, 30)), (2, (tree_c[0] + 3.5, tree_c[1] + 3.5)), (3, (allot.centroid.x, allot.centroid.y) if plots else None),
                (4, (play.centroid.x, play.centroid.y)), (5, (hc[0] - U[0] * 18.5, hc[1] - U[1] * 18.5)), (6, prom_c), (7, (crossings[0][0] - 5, crossings[0][1] + 15)),
                (8, (dead[0][0] - 7, dead[0][1] + 6) if dead else None), (9, (stop[0] - 6, stop[1] - 9)), (10, (sl_mid.x, sl_mid.y - 4.5)), (11, (gate[0] + 6, gate[1] + 1))]
    rows = [(1, 'Edge park on the empty strip (two Catastro parcels)', f'{P["park_m2"] / 1e6:.3f} km²'),
            (2, 'Orchard rows and a tree row on the fence walk (proposed trees)', f'{P["trees"]} trees'),
            (3, f'Neighbours’ allotments, {P["allot_n"]} plots of 45 m²', f'{P["allot_m2"]:,.0f} m²'),
            (4, 'Playground by the new crossing', f'{P["play_m2"]:,.0f} m²'),
            (5, f'Neighbourhood hall, 2 floors (about 7 m) under a ceiling of {P["hall_ceiling"]:.0f} m', f'{P["hall_m2"] * 2:,.0f} m² floor'),
            (6, 'Fence walk: the cycle path along the fence widened, with a tree row (schematic width 9 m)', f'{P["prom_m"]:,.0f} m'),
            (7, 'New crossings over Avenida de Poniente and the metro', f'{len(crossings)}'),
            (8, 'The dead end joined to the fence walk (1 of the 13 around the base)', '1'),
            (9, 'The park opens onto the San Cayetano metro stop (Junta project, not yet in service)', '1 stop'),
            (10, 'Calle Santa Lucía: a shared 20 km/h street; the fence walk runs beside it', f'{P["slow_m"]:,.0f} m'),
            (11, 'A gate from the park into the sports complex', '1'),
            (0, 'New dwellings or building rights', '0')]
    legend = [('fill', R[0], RED, 'Edge park and fence walk, public (proposed)'), ('tree', None, None, 'Tree, proposed (crown about 5 m)'), ('pat', 'url(#redHatch)', RED, 'Allotments'),
              ('pat', 'url(#redDots)', RED, 'Playground'), ('fill', WHITE, RED, 'Open lawn (meadow)', '0.9 0.6'), ('fill', RED, RED, 'Neighbourhood hall (II = floors)'),
              ('path', None, None, 'Path, 3 m'), ('zebra', None, None, 'Crossing'), ('dots', None, None, '20 km/h street'), ('dead', None, None, 'Dead end joined'), ('stop', None, None, 'Metro stop San Cayetano (approx.)'), ('gate', None, None, 'Gate opened')]
    return out, callouts, rows, legend, P


ROMAN = {1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI'}


def developer():
    """The private developer: housing on the strip now, under today's ceiling; a district on the base later, only if it leaves.
    Everything here is a PROPOSAL, drawn schematically."""
    D_ = groups.developer(F, gd); P = D_.P
    under, over = [], []
    # phase 2 on the base: plots in a hatch, their courts white, a dashed outline (not built: a reserve)
    under.append('<path d="' + ' '.join(V.dgeom(r) for r in D_.grid2) + f'" fill="url(#redHatch)" stroke="{RED}" stroke-width="{LW["thin"]}" stroke-dasharray="1.2 0.8" fill-rule="evenodd"/>')
    under.append('<path d="' + ' '.join(V.dgeom(r) for r in D_.grid2c if not r.is_empty) + f'" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["hair"]}" stroke-dasharray="0.8 0.6"/>')
    # phase 1: the courts (private gardens), the square, the parking under the courts
    under.append(f'<path d="{V.dgeom(D_.court)}" fill="{R[0]}" stroke="none" fill-rule="evenodd"/>')
    under.append(f'<path d="{V.dgeom(D_.sq)}" fill="url(#redDots)" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
    under.append(f'<path d="{V.dgeom(D_.park)}" fill="none" stroke="{RED}" stroke-width="{LW["thin"]}" stroke-dasharray="0.5 0.6"/>')
    under.append(f'<path d="{V.dgeom(D_.strip)}" fill="none" stroke="{RED}" stroke-width="{LW["propBold"]}"/>')
    # the blocks, with their floors; the avenue row's shops as a white line along the avenue side
    for b in D_.B:
        over.append(f'<path d="{V.dgeom(b.g)}" fill="{RED}" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
        c = b.g.centroid
        over.append(f'<text x="{X(c.x):.2f}" y="{Y(c.y) + 0.7:.2f}" font-family="{FONT}" font-size="{TY["label"]}" font-weight="700" fill="{WHITE}" text-anchor="middle">{ROMAN[b.floors]}</text>')
        if b.shop:
            pts = list(b.g.exterior.coords)
            # the long side nearest the avenue: the edge whose midpoint is farthest from the strip's south side
            best = max(((pts[i], pts[i + 1]) for i in range(len(pts) - 1) if LineString([pts[i], pts[i + 1]]).length > 20),
                       key=lambda ab: ((ab[0][0] + ab[1][0]) / 2 - D_.strip.centroid.x) * N[0] + ((ab[0][1] + ab[1][1]) / 2 - D_.strip.centroid.y) * N[1])
            a_, b_ = best; ux_, uy_ = b_[0] - a_[0], b_[1] - a_[1]; n_ = math.hypot(ux_, uy_); ox, oy = -uy_ / n_ * 1.6, ux_ / n_ * 1.6
            mid = Point((a_[0] + b_[0]) / 2 + ox, (a_[1] + b_[1]) / 2 + oy)
            if b.g.contains(mid): ox, oy = -ox, -oy
            over.append(f'<line x1="{X(a_[0] - ox):.2f}" y1="{Y(a_[1] - oy):.2f}" x2="{X(b_[0] - ox):.2f}" y2="{Y(b_[1] - oy):.2f}" stroke="{WHITE}" stroke-width="0.35" stroke-dasharray="1.2 0.6"/>')
    # the stop, the reason to build here
    over.append(f'<path d="{V.dgeom(groups.residents(F, gd).platform, close=False)}" fill="none" stroke="{INK}" stroke-width="2.2" opacity="0.55"/>')
    mx_, my_ = X(D_.stop[0]), Y(D_.stop[1]) + 7.5
    over.append(f'<circle cx="{mx_:.2f}" cy="{my_:.2f}" r="2.3" fill="{WHITE}" stroke="{INK}" stroke-width="{LW["mid"]}"/><text x="{mx_:.2f}" y="{my_ + 0.85:.2f}" font-family="{FONT}" font-size="2.4" font-weight="700" fill="{INK}" text-anchor="middle">M</text>')
    over.append(f'<text x="{mx_ + 3.2:.2f}" y="{my_ + 0.7:.2f}" font-family="{FONT}" font-size="{TY["map"]}" font-weight="600" fill="{INK}" stroke="{WHITE}" stroke-width="0.6" paint-order="stroke">San Cayetano (Junta project, approx.)</text>')
    bN = [b for b in D_.B if b.shop]; bS = [b for b in D_.B if b.row == 'S']; bM = [b for b in D_.B if b.row == 'M']
    g2 = max(D_.grid2, key=lambda r: r.area)
    callouts = [(1, (bM[0].g.centroid.x, bM[0].g.centroid.y + 11) if bM else None), (2, (bN[-1].g.centroid.x + 2, bN[-1].g.centroid.y + 12)),
                (3, (D_.sq.centroid.x, D_.sq.centroid.y)), (4, (D_.court.representative_point().x, D_.court.representative_point().y)),
                (5, (D_.park.representative_point().x + 14, D_.park.representative_point().y - 3) if not D_.park.is_empty else None),
                (6, (g2.centroid.x, g2.centroid.y)), (7, (D_.stop[0] - 6, D_.stop[1] - 9))]
    rows = [(1, f'Housing blocks on the strip, {P["fl_min"]}–{P["fl_max"]} floors: as high as today’s flight ceiling allows, 1 m under it (floors of 3 m)', f'≈ {P["dw1"]:,.0f} homes'),
            (2, 'Shops on the ground floor of the avenue row, facing the metro', f'{P["shop_m2"]:,.0f} m²'),
            (3, 'Station square at the San Cayetano stop', f'{P["sq_m2"]:,.0f} m²'),
            (4, 'Garden courts between the blocks, for the residents (private)', f'{P["court_m2"] / 1e6:.3f} km²'),
            (5, 'One level of parking under the courts (about 28 m² per space)', f'≈ {P["spaces"]:,.0f} spaces'),
            (6, 'Phase 2, only if the base leaves and its easements are lifted: a district on the base land in this frame, at the density planned for Sde Dov (Tel Aviv)', f'≈ {P["dw2"]:,.0f} homes'),
            (7, 'The San Cayetano metro stop (Junta project, not yet in service): the reason to build here', '1 stop'),
            (0, 'Public park on the strip', '0')]
    legend = [('fill', RED, RED, 'Housing block, proposed (IV = floors)'), ('shop', None, None, 'Shops on the ground floor'), ('fill', R[0], R[0], 'Garden court (private)'),
              ('pat', 'url(#redDots)', RED, 'Station square'), ('fill', 'none', RED, 'Parking under the court', '0.5 0.6'), ('pat', 'url(#redHatch)', RED, 'Phase 2 plots on the base (if it leaves)', '1.2 0.8'),
              ('stopk', None, None, 'Metro stop San Cayetano (approx.)')]
    P['_under'] = len(under)
    return under + over, callouts, rows, legend, P


def defence():
    """The Ministry of Defence: the base stays closed, its easements stay, the strip under the approach stays open, the fence
    gets a security band inside. Everything here is a PROPOSAL, drawn schematically."""
    M_ = groups.defence(F, gd); P = M_.P
    under, over = [], []
    # the strip: open land, crops or meadow — furrows along the fence
    svg.defs_add(f'<clipPath id="stripclipD"><path d="{V.dgeom(M_.strip)}"/></clipPath>')
    fur = []
    o_ = M_.strip.centroid
    for j in range(-40, 41):
        a = (o_.x + N[0] * j * 2.4 - U[0] * 200, o_.y + N[1] * j * 2.4 - U[1] * 200); b = (a[0] + U[0] * 400, a[1] + U[1] * 400)
        fur.append(f'M{X(a[0]):.2f},{Y(a[1]):.2f} L{X(b[0]):.2f},{Y(b[1]):.2f}')
    under.append(f'<g clip-path="url(#stripclipD)"><path d="{" ".join(fur)}" stroke="{RED}" stroke-width="{LW["hair"] * 1.6}" fill="none"/></g>')
    under.append(f'<path d="{V.dgeom(M_.strip)}" fill="none" stroke="{RED}" stroke-width="{LW["propBold"]}"/>')
    # inside the fence: the clear zone, the road
    under.append(f'<path d="{V.dgeom(M_.clear)}" fill="{R[0]}" stroke="none" fill-rule="evenodd"/>')
    under.append(f'<path d="{V.dgeom(M_.road)}" fill="{R[1]}" stroke="{RED}" stroke-width="{LW["thin"]}" fill-rule="evenodd"/>')
    # the easements, kept: the ceiling lines redrawn in red over the shared ones
    for lv in (10, 15, 20, 30, 50):
        for ln in contour_lines(F, lv):
            if ln.length > 40: over.append(f'<path d="{V.dgeom(ln, close=False)}" fill="none" stroke="{RED}" stroke-width="{LW["thin"]}" stroke-dasharray="1.4 0.9"/>')
    # the inner fence: a red line with crosses
    over.append(f'<path d="{V.dgeom(M_.inner_fence, close=False)}" fill="none" stroke="{RED}" stroke-width="{LW["prop"]}"/>')
    xs = []
    for seg in ([M_.inner_fence] if M_.inner_fence.geom_type == 'LineString' else list(getattr(M_.inner_fence, 'geoms', []))):
        for t in range(2, int(seg.length), 6):
            p_ = seg.interpolate(t); xs.append(f'M{X(p_.x) - 0.5:.2f},{Y(p_.y) - 0.5:.2f} l1,1 M{X(p_.x) - 0.5:.2f},{Y(p_.y) + 0.5:.2f} l1,-1')
    over.append(f'<path d="{" ".join(xs)}" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
    for (x, y) in M_.masts:
        over.append(f'<circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="1.1" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["prop"]}"/><circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="0.35" fill="{RED}"/>')
    pr = M_.patrol if M_.patrol.geom_type == 'LineString' else max(M_.patrol.geoms, key=lambda g: g.length)
    q1 = pr.interpolate(pr.project(Point(443985, 4110640))); q2 = pr.interpolate(pr.project(Point(443520, 4110800)))
    fq = fence_line.interpolate(fence_line.project(Point(443700, 4110770)))
    c15 = max([l for l in contour_lines(F, 15) if l.length > 60], key=lambda l: l.length); q15 = c15.interpolate(0.42, normalized=True)
    m0 = M_.masts[len(M_.masts) // 2]
    callouts = [(1, (q15.x + 7, q15.y + 3)), (2, (M_.strip.centroid.x + 30, M_.strip.centroid.y - 8)), (3, (q2.x - 3, q2.y + 9)), (4, (q2.x + 16, q2.y + 2)),
                (5, (q1.x - 8, q1.y - 6)), (6, (m0[0] + 5, m0[1] - 5)), (7, (fq.x - 22, fq.y + 6))]
    rows = [(1, 'The easements of 2019 stay: nothing may rise above the flight ceiling — about 12–18 m over the strip, under 10 m at the end of our line in the base', 'RD 118/2019'),
            (2, 'The strip under the approach stays open: crops or meadow, no buildings, no gatherings (our reading)', f'{P["strip_m2"] / 1e6:.3f} km²'),
            (3, 'A clear zone 6 m wide inside the fence: no planting, no storage', f'{P["clear_m2"] / 1e6:.4f} km²'),
            (4, 'An inner fence 6 m behind the outer one', f'{P["road_m"]:,.0f} m'),
            (5, 'A patrol road 4 m wide behind the inner fence', f'{P["road_m"]:,.0f} m'),
            (6, 'Masts for lights and cameras, about every 60 m (schematic)', f'{P["masts"]}'),
            (7, 'The outer fence stays where it is', f'{P["fence_m"]:,.0f} m'),
            (0, 'New public access to the base, new homes on the strip', '0')]
    legend = [('furrow', None, None, 'Open land: crops or meadow (the strip)'), ('ceilr', None, None, 'Flight ceiling kept: allowed height above the ground (m)'), ('fill', R[0], R[0], 'Clear zone inside the fence'),
              ('innerf', None, None, 'Inner fence'), ('fill', R[1], RED, 'Patrol road, 4 m'), ('mast', None, None, 'Mast: lights and cameras')]
    P['_under'] = len(under)
    return under + over, callouts, rows, legend, P


def edge_plan():
    """the residents' proposal on one of the three more edge areas (edges.py): drawn from typed elements"""
    E = edges.build(F, gd); P = dict(E.P); under, over = [], []
    pk = E.polys
    for g in pk.get('park', []): under.append(f'<path d="{V.dgeom(g)}" fill="{R[0]}" stroke="none" fill-rule="evenodd"/>')
    for g in pk.get('orchard_area', []): under.append(f'<path d="{V.dgeom(g)}" fill="{R[0]}" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
    for g in pk.get('riparian', []): under.append(f'<path d="{V.dgeom(g)}" fill="{R[1]}" stroke="none" fill-rule="evenodd"/>')
    for g in pk.get('meadow', []): under.append(f'<path d="{V.dgeom(g)}" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["thin"]}" stroke-dasharray="0.9 0.6"/>')
    for g in pk.get('allot', []): under.append(f'<path d="{V.dgeom(g)}" fill="url(#redHatch)" stroke="{RED}" stroke-width="{LW["hair"] * 1.5}"/>')
    for g in pk.get('plaza', []): under.append(f'<path d="{V.dgeom(g)}" fill="url(#redDots)" stroke="{RED}" stroke-width="{LW["prop"]}"/>')
    for g in E.lines.get('walk', []):
        if g is None or g.is_empty: continue
        under.append(f'<path d="{V.dgeom(g, close=False)}" fill="none" stroke="{RED}" stroke-width="{3 * k + 2 * LW["hair"]:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
        under.append(f'<path d="{V.dgeom(g, close=False)}" fill="none" stroke="{WHITE}" stroke-width="{3 * k - 2 * LW["hair"]:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    for g in pk.get('park', []): under.append(f'<path d="{V.dgeom(g)}" fill="none" stroke="{RED}" stroke-width="{LW["propBold"]}"/>')
    for (x, y) in E.trees: over.append(f'<circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="{2.6 * k:.2f}" fill="{WHITE}" fill-opacity="0.9" stroke="{RED}" stroke-width="{LW["thin"]}"/><circle cx="{X(x):.2f}" cy="{Y(y):.2f}" r="0.25" fill="{RED}"/>')
    for b in E.bridges: over.append(f'<path d="{V.dgeom(b, close=False)}" stroke="{RED}" stroke-width="{3 * k + 0.5:.2f}" fill="none"/><path d="{V.dgeom(b, close=False)}" stroke="{WHITE}" stroke-width="{3 * k - 0.3:.2f}" fill="none"/>')
    roads_ = unary_union([LineString(r[0]) for s_ in F['streets'] if s_['hw'] in ('primary', 'secondary', 'tertiary', 'residential') for r in s_['r'] if len(r[0]) > 1])
    for (x, y) in E.crossings:
        d0 = roads_.project(Point(x, y)) if roads_.geom_type == 'LineString' else None
        rl = roads_ if roads_.geom_type == 'LineString' else min(roads_.geoms, key=lambda g: g.distance(Point(x, y)))
        q = rl.interpolate(rl.project(Point(x, y))); q2 = rl.interpolate(rl.project(Point(x, y)) + 1); dx, dy = q2.x - q.x, q2.y - q.y; n = math.hypot(dx, dy) or 1; ux, uy = dx / n, dy / n
        for s_ in range(-3, 4):
            bx, by = x + ux * s_ * 0.9, y + uy * s_ * 0.9
            over.append(f'<line x1="{X(bx - uy * 7):.2f}" y1="{Y(by + ux * 7):.2f}" x2="{X(bx + uy * 7):.2f}" y2="{Y(by - ux * 7):.2f}" stroke="{RED}" stroke-width="0.45"/>')
    if E.pavilion:
        pg_, fl_, h_ = E.pavilion; over.append(f'<path d="{V.dgeom(pg_)}" fill="{RED}" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
        c = pg_.centroid; over.append(f'<text x="{X(c.x):.2f}" y="{Y(c.y) + 0.7:.2f}" font-family="{FONT}" font-size="{TY["label"]}" font-weight="700" fill="{WHITE}" text-anchor="middle">I</text>')
    # callouts: one per programme row, placed on its element
    def rp(g): q = g.representative_point(); return (q.x, q.y)
    pos = {}
    if AREA == 'W':
        wk = max([g for g in E.lines['walk'] if g is not None and not g.is_empty], key=lambda g: g.length)
        pos = {1: rp(pk['park'][0]), 2: (E.river.interpolate(0.62, normalized=True).x, E.river.interpolate(0.62, normalized=True).y), 3: (wk.interpolate(0.35, normalized=True).x, wk.interpolate(0.35, normalized=True).y),
               4: (E.bridges[1].centroid.x + 6, E.bridges[1].centroid.y + 6) if len(E.bridges) > 1 else None, 5: (E.crossings[1][0] - 6, E.crossings[1][1] - 6) if len(E.crossings) > 1 else None,
               6: rp(pk['meadow'][0]), 7: (E.trees[len(E.trees) // 3][0] + 5, E.trees[len(E.trees) // 3][1] + 5) if E.trees else None, 8: (E.pavilion[0].centroid.x + 10, E.pavilion[0].centroid.y + 8) if E.pavilion else None}
    elif AREA == 'E':
        pos = {1: (pk['park'][0].centroid.x + 25, pk['park'][0].centroid.y + 30), 2: rp(pk['allot'][0]), 3: (E.trees[-1][0] + 4, E.trees[-1][1] + 4) if E.trees else None, 4: rp(pk['meadow'][0]),
               5: (E.trees[3][0] - 6, E.trees[3][1]) if E.trees else None, 6: (E.lines['walk'][0].interpolate(0.3, normalized=True).x + 4, E.lines['walk'][0].interpolate(0.3, normalized=True).y + 4),
               7: (E.crossings[0][0] - 8, E.crossings[0][1] + 6) if E.crossings else None, 8: (E.pavilion[0].centroid.x, E.pavilion[0].centroid.y + 14)}
    elif AREA == 'S':
        wk = max(E.lines['walk'], key=lambda g: g.length)
        pos = {1: rp(pk['plaza'][0]), 2: (E.river.interpolate(0.6, normalized=True).x - 8, E.river.interpolate(0.6, normalized=True).y), 3: (wk.interpolate(0.7, normalized=True).x + 5, wk.interpolate(0.7, normalized=True).y),
               4: (E.bridges[-1].centroid.x + 8, E.bridges[-1].centroid.y) if E.bridges else None, 5: (E.crossings[0][0] + 8, E.crossings[0][1] + 6) if E.crossings else None,
               6: (E.trees[5][0] + 5, E.trees[5][1] + 4) if len(E.trees) > 5 else None, 7: rp(pk['meadow'][0]) if pk.get('meadow') else None}
    callouts = [(n_, pos.get(n_)) for n_, _, _ in E.rows if n_]
    legend = [('fill', R[0], RED, 'Park, public (proposed)')]
    if pk.get('riparian'): legend.append(('fill', R[1], R[1], 'River banks replanted (about 9 m each side)'))
    if pk.get('meadow'): legend.append(('fill', WHITE, RED, 'Meadow', '0.9 0.6'))
    if pk.get('allot'): legend.append(('pat', 'url(#redHatch)', RED, 'Allotments'))
    if pk.get('plaza'): legend.append(('pat', 'url(#redDots)', RED, 'River square'))
    legend += [('tree', None, None, 'Tree, proposed (crown about 5 m)'), ('path', None, None, 'Path, 3 m')]
    if E.bridges: legend.append(('bridge', None, None, 'Footbridge over the river'))
    if E.crossings: legend.append(('zebra', None, None, 'Crossing'))
    if E.pavilion: legend.append(('fill', RED, RED, ('Rest stop' if AREA == 'W' else 'Farm hall and market') + ' (I = floors)'))
    P['_under'] = len(under)
    return under + over, callouts, E.rows, legend, P


TEXT = {
    'residents': {
        'name': 'Residents', 'of': 'of the five towns',
        'position': '“The base can stay, but its fence must stop being the back of our towns: give us its edge, green and walkable, with no new homes.”',
        'max': 'quality of life, stability, cost of living', 'q': 'What will change in my daily life?',
        'why': ['42 % of the fence (3.6 km) backs onto housing; 13 dead ends stop at it (2.1, map 01).',
                'The five towns grew 15 % in ten years: 91,476 residents in 2025 (INE).',
                'Over the strip the flight ceiling is about 12–18 m above the ground (RD 118/2019, our calculation): low public uses fit under it, towers do not.',
                'The metro extension runs along Avenida de Poniente (Carretera de Alhama, A-338); its first new stop, San Cayetano, is on the strip’s north edge, and the Junta’s metro project calls this land “the future park” (not yet in service, Nov 2026).',
                'Noise: the Ombudsman’s suggestion to Defence is “without follow-up”; no noise map newer than 2006–2011.'],
        'daily_head': 'WHAT CHANGES IN DAILY LIFE',
        'daily': lambda F: [f"{F['strip']['dwellings_400m']:,} homes lie within 400 m \u2014 about five minutes on foot \u2014 of the empty strip, {F['strip']['dwellings_200m']:,} within 200 m (Catastro).",
                            'Today: two parcels with no building on them (Catastro) between the metro avenue and the fence road. Tomorrow: a public garden one crossing from home.',
                            'The fence walk links the two cycle paths that already run along the fence (Armilla\u2013Churriana\u2013Gabias, Armilla\u2013Og\u00edjares).',
                            'No new homes and no new traffic: the neighbourhood stays as it is; Calle Santa Luc\u00eda slows to 20 km/h.'],
        'fn': residents, 'code': 'R'},
    'developer': {
        'name': 'Developer', 'of': 'a private housing developer',
        'position': '“The metro reaches an empty strip beside a base the regional plan wants dismantled: build here, now on the strip and later on the base.”',
        'max': 'profit, building rights, speed', 'q': 'Where is it worth building, and how much?',
        'why': ['The regional plan (POTAUG, 2000, art. 4.27) proposes dismantling the base and turning its land into a city site.',
                'The five towns need about 14,177 more homes by 2045 (our scenario, 2.1).',
                'The San Cayetano metro stop is on the strip’s north edge (Junta project, not yet in service, Nov 2026).',
                'Over the strip the flight ceiling is about 12–18 m above the ground (RD 118/2019, our calculation): 3–5 floors fit under it today.'],
        'daily_head': 'WHAT IT DELIVERS — AND WHAT IT COSTS',
        'daily': lambda F: ['Homes beside a metro stop, in the towns’ own scale: no block higher than the ceiling lets it be.',
                            'Shops and a small square where the stop opens, for the 2,298 homes within 400 m (Catastro).',
                            'The cost: the strip the metro project calls “the future park” is built on; the only public space left is the station square.',
                            'Phase 2 depends on two decisions the developer cannot take: the base leaving, and the easements being lifted.'],
        'fn': developer, 'code': 'D'},
    'defence': {
        'name': 'Defence', 'of': 'the Ministry of Defence',
        'position': '“Armilla trains the Air Force’s helicopter pilots and stays: the towns may grow, but the edge under the approach stays low, open and quiet.”',
        'max': 'security, operations, a safe approach', 'q': 'What must stay clear for the base to keep flying?',
        'why': ['The easements were renewed in 2019 (RD 118/2019): the base is meant to stay.',
                'Ala 78, the Air Force’s helicopter-pilot school, trains here.',
                'The approach to runway 18 passes over this edge: on our line the ceiling falls from 24 m at the houses to 8 m inside the fence.',
                '42 % of the fence (3.6 km) backs onto housing and 13 dead ends stop at it (2.1, map 01): the edge is long and close.'],
        'daily_head': 'WHAT STAYS CLEAR',
        'daily': lambda F: ['The air over the edge: the easement surfaces, as published, with nothing above them.',
                            'The ground under the approach: the strip open, in crops or meadow, with no crowds under the helicopters.',
                            'The fence line: a clear zone, an inner fence and a road to patrol it, all on the base’s own land.',
                            'No change outside the base except the strip: the houses, streets and the metro stay as they are.'],
        'fn': defence, 'code': 'M'},
}


# ---- draw the sheet -----------------------------------------------------------------------------------------------------
T = TEXT[GROUP]
if AREA != 'N':
    _ET = edges.TEXT[AREA]
    T = dict(TEXT['residents'], position=_ET['position'], why=_ET['why'], daily_head=_ET['daily_head'], daily=lambda F, _d=_ET['daily']: _d, fn=edge_plan, code=_ET['code'])
prop_svg, callouts, rows, legend, PQ = T['fn']()

g = []   # the map group (clipped)
if AREA != 'N':   # the Vega around the edge areas: farmland and orchards in a pale green, the roads as grey lines (the north sheet reads its streets from the parcels)
    import _bw as _bwp
    VEGA = _bwp._P['basemap']['green']
    for l in F['landuse']:
        if l['lu'] in ('farmland', 'orchard', 'meadow', 'grass', 'vineyard', 'allotments') and l['r']: g.append(f'<path d="{V.d([r for rr in l["r"] for r in rr])}" fill="{_bwp._P['basemap']['agri'] if l['lu'] == 'farmland' else VEGA}" stroke="none" fill-rule="evenodd"/>')
    for s_ in F['streets']:
        w_ = {'primary': 1.6, 'secondary': 1.3, 'tertiary': 1.1, 'residential': 0.8, 'unclassified': 0.8, 'service': 0.4, 'track': 0.35}.get(s_['hw'], 0.3)
        for r in s_['r']:
            if len(r[0]) > 1: g.append(f'<path d="{V.d(r, close=False)}" fill="none" stroke="{G[3]}" stroke-width="{w_}" stroke-linecap="round"' + (' stroke-dasharray="1 0.8"' if s_['hw'] in ('track', 'path', 'footway', 'cycleway') else '') + '/>')
# the base: a white void behind its fence, sparse grey hatch
g.append(f'<path d="{V.dgeom(base)}" fill="url(#baseHatch)" stroke="none" fill-rule="evenodd"/>')
# the aeronautical ceiling: allowed height above the ground, lines every few metres
CEIL = [10, 15, 20, 30, 50]
ceil_lines = {lv: [ln for ln in contour_lines(F, lv) if ln.length > 40] for lv in CEIL}
for lv, lns in ceil_lines.items():
    for ln in lns: g.append(f'<path d="{V.dgeom(ln, close=False)}" fill="none" stroke="{G[4]}" stroke-width="{LW["thin"]}" stroke-dasharray="1.4 0.9"/>')
# parcels (Catastro)
g.append('<path d="' + ' '.join(V.dgeom(p.exterior) for p in parcels if not p.is_empty) + f'" fill="none" stroke="{G[3]}" stroke-width="{LW["parcel"]}"/>')
# base roads (OSM service ways inside the fence)
inner = [ln for ln, s in streets if base.buffer(-2).contains(ln.interpolate(0.5, normalized=True))]
g.append('<path d="' + ' '.join(V.dgeom(l, close=False) for l in inner) + f'" fill="none" stroke="{G[3]}" stroke-width="{LW["thin"]}"/>')
# places (sports grounds, schools): thin outlines
for q in F['places']:
    if q['kind'] in ('pitch', 'sports_centre', 'school', 'playground', 'park'):
        for r in q['r']: g.append(f'<path d="{V.d([r[0]])}" fill="none" stroke="{G[4]}" stroke-width="{LW["thin"]}"/>')
# the proposal's fills and lines
NU = PQ.get('_under', 8)
g += prop_svg[:NU]
# water: rivers, streams, irrigation ditches (OSM)
for w in F.get('water', []):
    for r in w['r']: g.append(f'<path d="{V.d(r, close=False)}" fill="none" stroke="{WATER}" stroke-width="{2.2 if w.get("ww") == "river" else 0.6 if w.get("ww") == "stream" else 0.4}" stroke-linecap="round" stroke-linejoin="round"/>')

# buildings by floors
for gg, b in blds:
    fill = floors_fill(b)
    if fill: g.append(f'<path d="{V.dgeom(gg)}" fill="{fill}" stroke="{G[5]}" stroke-width="{LW["hair"]}" fill-rule="evenodd"/>')
    else: g.append(f'<path d="{V.dgeom(gg)}" fill="{WHITE}" stroke="{G[4]}" stroke-width="{LW["bld"]}" fill-rule="evenodd"/>')
# the rest of the proposal (symbols)
g += prop_svg[NU:]
# the metro extension (under construction): a rail line
for m in F['metro_ext']:
    for r in m['r']:
        ln = LineString(r[0]); g.append(f'<path d="{V.d([r[0]], close=False)}" fill="none" stroke="{INK}" stroke-width="{LW["metro"]}"/>')
        ticks = []
        for t in range(0, int(ln.length), 4):
            p = ln.interpolate(t); q = ln.interpolate(min(ln.length, t + 0.5)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
            ticks.append(f'M{X(p.x - dy / n * 1.3):.2f},{Y(p.y + dx / n * 1.3):.2f} L{X(p.x + dy / n * 1.3):.2f},{Y(p.y - dx / n * 1.3):.2f}')
        g.append(f'<path d="{" ".join(ticks)}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
# the fence: a black line with white dashes
g.append(f'<path d="{V.dgeom(fence_line, close=False)}" fill="none" stroke="{INK}" stroke-width="{LW["fence"] + 0.3}"/>')
g.append(f'<path d="{V.dgeom(fence_line, close=False)}" fill="none" stroke="{WHITE}" stroke-width="0.32" stroke-dasharray="1.6 1.3"/>')
# the municipal line Churriana | Armilla
MUNI_DASH = '2.4 0.7 0.35 0.7 0.35 0.7'
for r in F['muni_line']: g.append(f'<path d="{V.d([r[0]], close=False)}" fill="none" stroke="{G[5]}" stroke-width="{LW["mid"] + 0.05}" stroke-dasharray="{MUNI_DASH}"/>')
# the shared section line S-S
sx0, sy0, sx1, sy1 = X(SA[0]), Y(SA[1]), X(SB[0]), Y(SB[1])
g.append(f'<line x1="{sx0:.2f}" y1="{sy0:.2f}" x2="{sx1:.2f}" y2="{sy1:.2f}" stroke="{INK}" stroke-width="{LW["section"]}" stroke-dasharray="6 1.2 0.8 1.2"/>')
ux, uy = (sx1 - sx0), (sy1 - sy0); n = math.hypot(ux, uy); ux, uy = ux / n, uy / n; px, py = -uy, ux   # px,py: the viewing side
if px < 0: px, py = -px, -py                                                                         # looking east
for (ex, ey) in ((sx0, sy0), (sx1, sy1)):
    g.append(f'<path d="M{ex - ux * 0:.2f},{ey:.2f} L{ex + px * 4:.2f},{ey + py * 4:.2f}" stroke="{INK}" stroke-width="{LW["frame"] + 0.2}"/>')
    g.append(f'<path d="M{ex + px * 4 + uy * 1.2:.2f},{ey + py * 4 - ux * 1.2:.2f} L{ex + px * 6.2:.2f},{ey + py * 6.2:.2f} L{ex + px * 4 - uy * 1.2:.2f},{ey + py * 4 + ux * 1.2:.2f} Z" fill="{INK}"/>')

# ---- labels on the map ------------------------------------------------------------------------------------------------
lab = []
def maptext(x, y, s, size=TY['map'], fill=INK, weight=500, anchor='middle', italic=False, rot=0, spacing=0):
    hl = f' stroke="{WHITE}" stroke-width="0.7" stroke-linejoin="round" paint-order="stroke"'
    tr = f' transform="rotate({rot:.2f} {x:.2f} {y:.2f})"' if rot else ''
    st = ' font-style="italic"' if italic else ''
    sp = f' letter-spacing="{spacing}"' if spacing else ''
    lab.append(f'<text x="{x:.2f}" y="{y:.2f}" font-family="{FONT}" font-size="{size:.2f}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{st}{sp}{hl}{tr}>{esc(s)}</text>')
# street names: once per name, on its longest stretch, upright
by = {}
for ln, s in streets:
    nm = s.get('nm')
    if not nm or s.get('hw') in ('service', 'footway', 'cycleway', 'path'): continue
    if base.buffer(-1).contains(ln.interpolate(0.5, normalized=True)): continue
    if ln.length > by.get(nm, (None, 0))[1]: by[nm] = (ln, ln.length)
for nm, (ln, L) in by.items():
    if L < 45: continue
    p = ln.interpolate(0.5, normalized=True); q = ln.interpolate(min(L, ln.project(p) + 3)); p0 = ln.interpolate(max(0, ln.project(p) - 3))
    ang = math.degrees(math.atan2(-(q.y - p0.y), q.x - p0.x))
    if ang > 90: ang -= 180
    if ang < -90: ang += 180
    name = nm.replace('Calle ', 'C. ').replace('Avenida ', 'Av. ')
    maptext(X(p.x), Y(p.y) + 0.55, name, size=TY['street'], fill=G[5], weight=400, italic=True, rot=ang)
# ceiling labels: on each level's longest line, at its middle
for lv, lns in ceil_lines.items():
    if not lns: continue
    ln = max(lns, key=lambda l: l.length)
    for frac in ((0.5,) if ln.length < 500 else (0.3, 0.75)):
        p = ln.interpolate(frac, normalized=True); q = ln.interpolate(min(ln.length, ln.project(p) + 2)); p0 = ln.interpolate(max(0, ln.project(p) - 2))
        ang = math.degrees(math.atan2(-(q.y - p0.y), q.x - p0.x))
        if ang > 90: ang -= 180
        if ang < -90: ang += 180
        maptext(X(p.x), Y(p.y) + 0.5, f'{lv} m', size=TY['tiny'], fill=G[5], weight=600, rot=ang)
# names: the base, the towns either side of the municipal line, the avenue and the metro
bc = base.intersection(FR).representative_point()
if AREA == 'N':
    maptext(X(443560), Y(4110560), 'BASE AÉREA DE ARMILLA', size=3.2, fill=G[5], weight=600, spacing=1.2)
    maptext(X(443560), Y(4110560) + 4.4, 'closed military land · helicopter school (Ala 78)', size=TY['label'], fill=G[5], weight=400)
    maptext(X(443700), Y(4110962), 'CHURRIANA DE LA VEGA', size=2.6, fill=INK, weight=600, spacing=0.9)
    maptext(X(443985), Y(4110962), 'ARMILLA', size=2.6, fill=INK, weight=600, spacing=0.9)
    maptext(X(443520), Y(4110870) - 3.2, 'metro line 1 extension (under construction)', size=TY['map'], fill=INK, weight=500, italic=True, rot=-17)
    maptext(X(443912), Y(4110820), 'sports complex (Armilla)', size=TY['map'], fill=G[5], weight=500)
else:
    _bp = base.intersection(FR.buffer(-40)).representative_point()
    maptext(X(_bp.x), Y(_bp.y), 'BASE AÉREA DE ARMILLA', size=3.2, fill=G[5], weight=600, spacing=1.2)
    maptext(X(_bp.x), Y(_bp.y) + 4.4, 'closed military land', size=TY['label'], fill=G[5], weight=400)
    for _nm, _p, _k in edges.build(F, gd).names:
        if _k == 'water': maptext(X(_p.x) + 6, Y(_p.y) - 4, _nm, size=2.6, fill=WATER, weight=600, italic=True, spacing=0.6)
        else: maptext(X(_p.x), Y(_p.y), _nm, size=2.6, fill=INK, weight=600, spacing=0.9)
# callouts
for nmb, c in callouts:
    if not c: continue
    cx, cy = X(c[0]), Y(c[1])
    lab.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="2.1" fill="{RED}" stroke="{WHITE}" stroke-width="0.35"/>'
               f'<text x="{cx:.2f}" y="{cy + 0.75:.2f}" font-family="{FONT}" font-size="{TY["num"]}" font-weight="700" fill="{WHITE}" text-anchor="middle">{nmb}</text>')
# the section line's letters
for (ex, ey) in ((sx0, sy0), (sx1, sy1)):
    lab.append(f'<circle cx="{ex + px * 9.3:.2f}" cy="{ey + py * 9.3:.2f}" r="2.4" fill="{WHITE}" stroke="{INK}" stroke-width="{LW["mid"]}"/>'
               f'<text x="{ex + px * 9.3:.2f}" y="{ey + py * 9.3 + 0.85:.2f}" font-family="{FONT}" font-size="2.4" font-weight="700" fill="{INK}" text-anchor="middle">S</text>')

svg.add(f'<g clip-path="url(#mapclip)">{"".join(g)}{"".join(lab)}</g>')

# ---- the map frame: border, corner crosses, coordinates every 100 m ---------------------------------------------------
svg.add(f'<rect x="{MX}" y="{MY}" width="{V.w:.2f}" height="{V.h:.2f}" fill="none" stroke="{INK}" stroke-width="{LW["frame"]}"/>')
f0, f1 = F['frame'][0], F['frame'][2]
for e in range(int(math.ceil(f0 / 100) * 100), int(f1) + 1, 100):
    x = X(e); svg.add(f'<line x1="{x:.2f}" y1="{MY}" x2="{x:.2f}" y2="{MY + 1.8}" stroke="{INK}" stroke-width="{LW["thin"]}"/><line x1="{x:.2f}" y1="{MY + V.h - 1.8:.2f}" x2="{x:.2f}" y2="{MY + V.h:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
    svg.text(x, MY + V.h + 3.2, f'{e:,}'.replace(',', ' '), TY['tiny'], fill=G[5], anchor='middle')
for nn in range(int(math.ceil(F['frame'][1] / 100) * 100), int(F['frame'][3]) + 1, 100):
    y = Y(nn); svg.add(f'<line x1="{MX}" y1="{y:.2f}" x2="{MX + 1.8}" y2="{y:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/><line x1="{MX + V.w - 1.8:.2f}" y1="{y:.2f}" x2="{MX + V.w:.2f}" y2="{y:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
    svg.text(MX - 1.2, y + 0.5, f'{nn:,}'.replace(',', ' '), TY['tiny'], fill=G[5], anchor='end', rotate=-90)
svg.text(MX + V.w, MY + V.h + 6.6, 'ETRS89 / UTM 30N (EPSG:25830), metres', TY['tiny'], fill=G[5], anchor='end')

# ---- the column ---------------------------------------------------------------------------------------------------------
x0 = COL; y = MY + 2.4; LH = lambda sz: sz * 1.27
def rule(yy): svg.add(f'<line x1="{x0}" y1="{yy:.2f}" x2="{x0 + CW}" y2="{yy:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
def head(yy, s, col=INK): svg.text(x0, yy, s, TY['eyebrow'], fill=col, weight=700, spacing=0.35)
svg.text(x0, y, '+ EXERCISE 2.2 · INTEREST GROUPS · STAGE 1', TY['eyebrow'], fill=G[5], weight=600, spacing=0.3)
svg.text(x0 + CW, y, f'2.2-{T["code"]} · 01', TY['eyebrow'], fill=G[5], weight=600, anchor='end')
y += 15.5; svg.text(x0, y, T['name'], TY['title'], weight=700)
y += 7.0; svg.text(x0, y, T['of'], TY['sub'], weight=500)
y += 6.4; svg.text(x0, y, 'Urban plan 1:1000', TY['sub'], weight=500, fill=RED)
y += 5.2
for ln in wrap('The north edge of the base, Churriana de la Vega | Armilla — the same frame and the same section line for all three groups.' if AREA == 'N' else edges.TEXT[AREA]['where'] + ' The residents’ position, on one more stretch of the edge.', TY['small'], CW):
    svg.text(x0, y, ln, TY['small'], fill=G[5]); y += LH(TY['small'])
y += 2.6; rule(y)
y += 6.0; head(y, 'POSITION', RED)
y += 6.0
for ln in wrap(T['position'], TY['lead'], CW, avg=0.5):
    svg.text(x0, y, ln, TY['lead'], weight=500); y += LH(TY['lead'])
y += 2.0
svg.text(x0, y, 'Maximises: ' + T['max'], TY['small'], fill=G[5]); y += LH(TY['small'])
svg.text(x0, y, 'Guiding question: ' + T['q'], TY['small'], fill=G[5]); y += 6.2
head(y, 'WHY — FROM THE ANALYSIS'); y += 5.0
for w in T['why']:
    lines = wrap(w, TY['small'], CW - 3.2)
    svg.add(f'<circle cx="{x0 + 0.8:.2f}" cy="{y - 0.85:.2f}" r="0.5" fill="{INK}"/>')
    for ln in lines: svg.text(x0 + 3.2, y, ln, TY['small']); y += LH(TY['small'])
    y += 0.9
y += 2.2; rule(y)
y += 6.0; head(y, 'PROGRAMME — PROPOSED, DRAWN SCHEMATICALLY', RED); y += 5.6
for nmb, txt, q in rows:
    lines = wrap(txt, TY['small'], CW - 25)
    if nmb:
        svg.add(f'<circle cx="{x0 + 2.0:.2f}" cy="{y - 0.85:.2f}" r="2.0" fill="{RED}"/>')
        svg.text(x0 + 2.0, y - 0.1, str(nmb), 1.9, fill=WHITE, weight=700, anchor='middle')
    else:
        svg.add(f'<circle cx="{x0 + 2.0:.2f}" cy="{y - 0.85:.2f}" r="2.0" fill="{WHITE}" stroke="{RED}" stroke-width="0.3"/>')
        svg.text(x0 + 2.0, y - 0.1, '–', 1.9, fill=RED, weight=700, anchor='middle')
    for i, ln in enumerate(lines): svg.text(x0 + 5.6, y + i * LH(TY['small']), ln, TY['small'])
    svg.text(x0 + CW, y, q, TY['small'], weight=600, anchor='end')
    y += max(1, len(lines)) * LH(TY['small']) + 1.5
y += 1.6; rule(y)
if T.get('daily'):
    y += 6.0; head(y, T['daily_head'], RED); y += 5.0
    for w in T['daily'](F):
        lines = wrap(w, TY['small'], CW - 3.2)
        svg.add(f'<circle cx="{x0 + 0.8:.2f}" cy="{y - 0.85:.2f}" r="0.5" fill="{RED}"/>')
        for ln in lines: svg.text(x0 + 3.2, y, ln, TY['small']); y += LH(TY['small'])
        y += 0.9
    y += 1.4; rule(y)
# key: two columns — the proposal (red) and what it stands on
y += 6.0; head(y, 'KEY'); svg.text(x0 + CW / 2 + 1, y, 'TODAY', TY['eyebrow'], fill=G[5], weight=700, spacing=0.35); y += 5.2
ky = y; cw2 = CW / 2
def swatch(kind, xx, yy, a=None, b=None, dash=None):
    w, h = 6.0, 3.0; y0 = yy - 2.4
    if kind == 'fill': svg.add(f'<rect x="{xx}" y="{y0:.2f}" width="{w}" height="{h}" fill="{a}" stroke="{b}" stroke-width="{LW["prop"]}"' + (f' stroke-dasharray="{dash}"' if dash else '') + '/>')
    elif kind == 'pat': svg.add(f'<rect x="{xx}" y="{y0:.2f}" width="{w}" height="{h}" fill="{a}" stroke="{b}" stroke-width="{LW["thin"]}"' + (f' stroke-dasharray="{dash}"' if dash else '') + '/>')
    elif kind == 'tree': svg.add(f'<circle cx="{xx + 3:.2f}" cy="{y0 + 1.5:.2f}" r="1.35" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["thin"]}"/><circle cx="{xx + 3:.2f}" cy="{y0 + 1.5:.2f}" r="0.25" fill="{RED}"/>')
    elif kind == 'path': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{RED}" stroke-width="3.1"/><line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{WHITE}" stroke-width="2.9"/>')
    elif kind == 'zebra': svg.add(''.join(f'<line x1="{xx + 0.6 + i * 0.9:.2f}" y1="{y0:.2f}" x2="{xx + 0.6 + i * 0.9:.2f}" y2="{y0 + h:.2f}" stroke="{RED}" stroke-width="0.45"/>' for i in range(6)))
    elif kind == 'dots': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{RED}" stroke-width="{LW["prop"]}" stroke-dasharray="0.25 0.9" stroke-linecap="round"/>')
    elif kind == 'dead': svg.add(f'<circle cx="{xx + 3:.2f}" cy="{y0 + 1.5:.2f}" r="1.35" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["propBold"]}"/><path d="M{xx + 2.3:.2f},{y0 + 1.5:.2f} H{xx + 3.7:.2f} M{xx + 3:.2f},{y0 + 0.8:.2f} V{y0 + 2.2:.2f}" stroke="{RED}" stroke-width="{LW["prop"]}"/>')
    elif kind == 'stop': svg.add(f'<circle cx="{xx + 3:.2f}" cy="{y0 + 1.5:.2f}" r="1.6" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["prop"]}"/><text x="{xx + 3:.2f}" y="{y0 + 2.1:.2f}" font-family="{FONT}" font-size="1.6" font-weight="700" fill="{RED}" text-anchor="middle">M</text>')
    elif kind == 'gate': svg.add(f'<path d="M{xx + 2:.2f},{y0 + 0.2:.2f} L{xx + 4:.2f},{y0 + 1.5:.2f} L{xx + 2:.2f},{y0 + 2.8:.2f}" fill="none" stroke="{RED}" stroke-width="{LW["propBold"]}" stroke-linecap="round" stroke-linejoin="round"/>')
    elif kind == 'bridge': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{RED}" stroke-width="3.5"/><line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{WHITE}" stroke-width="2.7"/><line x1="{xx + 3}" y1="{y0 - 0.4:.2f}" x2="{xx + 3}" y2="{y0 + 3.4:.2f}" stroke="{WATER}" stroke-width="1.4" opacity="0.5"/>')
    elif kind == 'shop': svg.add(f'<rect x="{xx}" y="{y0:.2f}" width="{w}" height="{h}" fill="{RED}"/><line x1="{xx + 0.3}" y1="{y0 + 0.6:.2f}" x2="{xx + w - 0.3}" y2="{y0 + 0.6:.2f}" stroke="{WHITE}" stroke-width="0.35" stroke-dasharray="1.2 0.6"/>')
    elif kind == 'stopk': svg.add(f'<circle cx="{xx + 3:.2f}" cy="{y0 + 1.5:.2f}" r="1.6" fill="{WHITE}" stroke="{INK}" stroke-width="{LW["thin"]}"/><text x="{xx + 3:.2f}" y="{y0 + 2.1:.2f}" font-family="{FONT}" font-size="1.6" font-weight="700" fill="{INK}" text-anchor="middle">M</text>')
    elif kind == 'furrow': svg.add(f'<rect x="{xx}" y="{y0:.2f}" width="{w}" height="{h}" fill="none" stroke="{RED}" stroke-width="{LW["prop"]}"/>' + ''.join(f'<line x1="{xx}" y1="{y0 + 0.6 * i:.2f}" x2="{xx + w}" y2="{y0 + 0.6 * i:.2f}" stroke="{RED}" stroke-width="{LW["hair"] * 1.6}"/>' for i in range(1, 5)))
    elif kind == 'ceilr': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{RED}" stroke-width="{LW["thin"] * 1.6}" stroke-dasharray="1.4 0.9"/>')
    elif kind == 'innerf': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{RED}" stroke-width="{LW["prop"]}"/>' + ''.join(f'<path d="M{xx + 0.8 + i * 1.5:.2f},{y0 + 1:.2f} l1,1 M{xx + 0.8 + i * 1.5:.2f},{y0 + 2:.2f} l1,-1" stroke="{RED}" stroke-width="{LW["thin"]}"/>' for i in range(4)))
    elif kind == 'mast': svg.add(f'<circle cx="{xx + 3:.2f}" cy="{y0 + 1.5:.2f}" r="1.1" fill="{WHITE}" stroke="{RED}" stroke-width="{LW["prop"]}"/><circle cx="{xx + 3:.2f}" cy="{y0 + 1.5:.2f}" r="0.35" fill="{RED}"/>')
    elif kind == 'line': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{a}" stroke-width="{b}"' + (f' stroke-dasharray="{dash}"' if dash else '') + '/>')
    elif kind == 'fence': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{INK}" stroke-width="{LW["fence"] + 0.3}"/><line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{WHITE}" stroke-width="0.32" stroke-dasharray="1.6 1.3"/>')
    elif kind == 'metro': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{INK}" stroke-width="{LW["metro"]}"/>' + ''.join(f'<line x1="{xx + 0.5 + i * 1.25:.2f}" y1="{y0 + 0.2:.2f}" x2="{xx + 0.5 + i * 1.25:.2f}" y2="{y0 + 2.8:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>' for i in range(5)))
    elif kind == 'sec': svg.add(f'<line x1="{xx}" y1="{y0 + 1.5:.2f}" x2="{xx + w}" y2="{y0 + 1.5:.2f}" stroke="{INK}" stroke-width="{LW["section"]}" stroke-dasharray="3 0.8 0.6 0.8"/>')
    elif kind == 'basek': svg.add(f'<rect x="{xx}" y="{y0:.2f}" width="{w}" height="{h}" fill="url(#baseHatch)" stroke="{G[3]}" stroke-width="{LW["hair"]}"/>')
    elif kind == 'bld': svg.add(f'<rect x="{xx}" y="{y0:.2f}" width="{w}" height="{h}" fill="{a}" stroke="{b}" stroke-width="{LW["bld"]}"/>')
def keycol(items, xx, yy):
    for it in items:
        swatch(it[0], xx, yy, it[1], it[2], it[4] if len(it) > 4 else None)
        lines = wrap(it[3], TY['small'], cw2 - 9.5)
        for i, ln in enumerate(lines): svg.text(xx + 7.6, yy + i * LH(TY['small']), ln, TY['small'])
        yy += LH(TY['small']) * max(1, len(lines)) + 1.3
    return yy
ctx = [('bld', G[2], G[5], '1–2 floors (Catastro)'), ('bld', G[3], G[5], '3 floors'), ('bld', G[4], G[5], '4 floors or more'), ('bld', WHITE, G[4], 'Hall or shed: height not derived from floors'),
       ('line', G[3], LW['parcel'] * 3, 'Parcel (Catastro)'), ('basek', None, None, 'The base, closed'), ('fence', None, None, 'The fence'), ('metro', None, None, 'Metro extension, under construction'),
       ('line', G[5], LW['mid'] + 0.05, 'Municipal line', MUNI_DASH), ('line', G[4], LW['thin'] * 1.6, 'Flight ceiling: allowed height above the ground (m)', '1.4 0.9'), ('sec', None, None, 'Shared section line S–S (sheet 02)' if AREA == 'N' else 'Section line S–S (sheet 02)')] + ([('line', WATER, 1.2, 'River, stream, irrigation ditch (OSM)')] if F.get('water') else [])
y = max(keycol(legend, x0, ky), keycol(ctx, x0 + cw2 + 1, ky)) + 0.6
y += 1.0; rule(y)

# sources and notes, at the foot of the column
SRC = ('Sources: D. G. del Catastro, INSPIRE buildings (floors) and parcels; OpenStreetMap contributors (streets, places, rivers and ditches, base outline, metro extension; ODbL); '
       'IGN MDT25 (CC BY 4.0); Origen de los datos: Ministerio de Defensa (aeronautical easements, RD 118/2019); INE padrón; key map: OSM built-up areas, Catastro municipal outlines. '
       'Notes: the proposal is drawn schematically — the shapes and sizes of its parts are ours. Ceiling lines: the easement surfaces minus the ground model, smoothed over about 30 m, '
       'our interpolation, approximate, not the legal values. Floors from the Catastro; heights are not measured.')
lines = wrap(SRC, TY['tiny'], CW, avg=0.52)
yS = MY + V.h - len(lines) * 2.1 + 1.2
for i, ln in enumerate(lines): svg.text(x0, yS + i * 2.1, ln, TY['tiny'], fill=G[5])
# where the frame is: the whole base, the five towns, the frame and the section line — set on the sources, at the foot of the column
KB = (440300, 4107300, 446300, 4112300)   # 6 x 5 km
_kh = (KB[3] - KB[1]) * CW / (KB[2] - KB[0])
y = max(y, yS - 7.5 - (6.0 + 2.4 + _kh + 7.0 + 4.4 + 4.8 + 5.0))
y += 6.0; head(y, 'WHERE — THE SHARED FRAME ON THE BASE'); y += 2.4
import json as _json
from pyproj import Transformer as _T
_t = _T.from_crs(4326, 25830, always_xy=True)
kw = CW; ks = kw / (KB[2] - KB[0]); kh = (KB[3] - KB[1]) * ks; kx0, ky0 = x0, y
KX = lambda u: kx0 + (u - KB[0]) * ks; KY = lambda v: ky0 + (KB[3] - v) * ks
def kd(rings): return ' '.join('M' + ' L'.join(f'{KX(p[0]):.2f},{KY(p[1]):.2f}' for p in r) + ' Z' for r in rings if len(r) > 2)
svg.defs_add(f'<clipPath id="keyclip"><rect x="{kx0}" y="{ky0:.2f}" width="{kw:.2f}" height="{kh:.2f}"/></clipPath>')
kg = []
towns = _json.load(open(os.path.join(ROOT, 'data/vec/tour_towns.json')))['features']
for f in towns:
    gm = f['geometry']; pls = [gm['coordinates']] if gm['type'] == 'Polygon' else gm['coordinates']
    for pl in pls: kg.append(f'<path d="{kd([[_t.transform(*c) for c in r] for r in pl])}" fill="{G[2]}" stroke="none" fill-rule="evenodd"/>')
pol = _json.load(open(os.path.join(ROOT, 'data/ex21/policy.json')))
for nm, pg in pol['muni'].items():
    for pl in pg: kg.append(f'<path d="{kd(pl)}" fill="none" stroke="{G[4]}" stroke-width="{LW["thin"]}"/>')
bz = _json.load(open(os.path.join(ROOT, 'data/vec/base_edge.json')))['features']
bg = next(f for f in bz if f['properties'].get('k') == 'base')['geometry']
brs = [[_t.transform(*c) for c in r] for r in bg['coordinates']]
kg.append(f'<path d="{kd(brs)}" fill="url(#baseHatch)" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
fr = F['frame']; kg.append(f'<rect x="{KX(fr[0]):.2f}" y="{KY(fr[3]):.2f}" width="{(fr[2] - fr[0]) * ks:.2f}" height="{(fr[3] - fr[1]) * ks:.2f}" fill="none" stroke="{RED}" stroke-width="{LW["propBold"]}"/>')
kg.append(f'<line x1="{KX(SA[0]):.2f}" y1="{KY(SA[1]):.2f}" x2="{KX(SB[0]):.2f}" y2="{KY(SB[1]):.2f}" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
tl = {'Armilla': (444900, 4111300), 'Churriana de la Vega': (441900, 4111450), 'Las Gabias': (440900, 4109000), 'Alhendín': (443100, 4107700), 'Ogíjares': (445400, 4108900)}
for nm, (u, v) in tl.items():
    kg.append(f'<text x="{KX(u):.2f}" y="{KY(v):.2f}" font-family="{FONT}" font-size="{TY["tiny"] + 0.3}" font-weight="600" fill="{INK}" text-anchor="middle" stroke="{WHITE}" stroke-width="0.5" paint-order="stroke">{esc(nm)}</text>')
kg.append(f'<text x="{KX(443050):.2f}" y="{KY(4109600):.2f}" font-family="{FONT}" font-size="{TY["tiny"] + 0.2}" font-weight="600" fill="{G[5]}" text-anchor="middle" letter-spacing="0.3">THE BASE</text>')
kg.append(f'<text x="{KX(fr[2]) + 1.2:.2f}" y="{KY(fr[3]) + 0.4:.2f}" font-family="{FONT}" font-size="{TY["tiny"] + 0.2}" font-weight="700" fill="{RED}" stroke="{WHITE}" stroke-width="0.5" paint-order="stroke">this sheet</text>')
svg.add(f'<g clip-path="url(#keyclip)">{"".join(kg)}</g><rect x="{kx0}" y="{ky0:.2f}" width="{kw:.2f}" height="{kh:.2f}" fill="none" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
# a 1 km bar in the key map
svg.add(f'<rect x="{kx0 + 2:.2f}" y="{ky0 + kh - 3:.2f}" width="{1000 * ks:.2f}" height="0.8" fill="{INK}"/>')
svg.text(kx0 + 2 + 1000 * ks + 1.2, ky0 + kh - 2.1, '1 km', TY['tiny'], fill=INK)
nx_, ny_ = kx0 + kw - 5, ky0 + 7.5   # north (the key map and the plan are both north-up)
svg.add(f'<path d="M{nx_:.2f},{ny_ - 4:.2f} L{nx_ + 2.3:.2f},{ny_ + 3:.2f} L{nx_:.2f},{ny_ + 1.6:.2f} L{nx_ - 2.3:.2f},{ny_ + 3:.2f} Z" fill="{INK}"/>')
svg.text(nx_, ny_ + 7.0, 'N', TY['small'], weight=700, anchor='middle', halo=0.6)
y = ky0 + kh + 7.0

# scale bar and north arrow
head(y, 'SCALE 1:1000 ON A1 (841 × 594 MM)'); y += 4.4
for i, (a, b) in enumerate(((0, 10), (10, 20), (20, 50), (50, 100))):
    svg.add(f'<rect x="{x0 + a * V.k:.2f}" y="{y:.2f}" width="{(b - a) * V.k:.2f}" height="1.5" fill="{INK if i % 2 == 0 else WHITE}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
for v in (0, 10, 20, 50, 100): svg.text(x0 + v * V.k, y + 4.8, f'{v}' + (' m' if v == 100 else ''), TY['tiny'] + 0.2, fill=INK, anchor='middle' if v else 'start')
y += 9.0
print('column ends at', round(y, 1), 'mm; sources start at', round(yS, 1), 'mm', '| programme', {k2: (round(v, 1) if isinstance(v, float) else v) for k2, v in PQ.items()})

name = os.path.join(OUT, f'2.2_{GROUP}_01_plan_1-1000' if AREA == 'N' else f'2.2_residents_{AREA}_01_plan_1-1000')
ok = export(svg, name, SW, SH, dpi=int(os.environ.get('DPI', 150)))
print('fonts loaded:', ok, '->', name + '.pdf')
