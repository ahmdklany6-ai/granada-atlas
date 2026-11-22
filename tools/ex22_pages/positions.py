"""Exercise 2.2 · stage 1 · the three interest groups side by side: position (one sentence), short programme (uses and
quantities), what it rests on in the analysis, and the group's intent drawn schematically on the SHARED FRAME; under them,
where the three meet and clash. A1 landscape. Positions are our representation of each group (the brief: "each group is a
conceptual representation"); figures come from the data and sources named on the sheet; estimates are labelled.
Usage (repo root): python3 tools/ex22_pages/positions.py <out folder>
Not part of the site or of the tests."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _ex22 import *   # noqa: F401,F403
import groups
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union

OUT = sys.argv[1] if len(sys.argv) > 1 else 'exports/ex22'
SW, SH = 841, 594
F = load_frame(); gd = groups.ground(F)
RS = groups.residents(F, gd); DV = groups.developer(F, gd); DF = groups.defence(F, gd)
svg = SVG(SW, SH)
svg.defs_add(f'<pattern id="baseHatch" patternUnits="userSpaceOnUse" width="1.6" height="1.6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="{G[3]}" stroke-width="0.1"/></pattern>')
svg.defs_add(f'<pattern id="redHatch" patternUnits="userSpaceOnUse" width="1.0" height="1.0" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="1.0" stroke="{RED}" stroke-width="0.18"/></pattern>')
svg.defs_add(f'<pattern id="redCross" patternUnits="userSpaceOnUse" width="1.3" height="1.3" patternTransform="rotate(45)"><path d="M0,0 L0,1.3 M0,0 L1.3,0" stroke="{RED}" stroke-width="0.16"/></pattern>')
LH = lambda sz: sz * 1.28
BS, PS, EB = 3.6, 5.9, 3.0                  # body, position, eyebrow sizes on this sheet (mm)
def mark(x, y, kind, r=1.5):
    """clash = filled, partly = half, agreement = open (shapes, not glyphs)"""
    if kind == 'c': svg.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="{RED}"/>')
    elif kind == 'p': svg.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="{WHITE}" stroke="{RED}" stroke-width="0.35"/><path d="M{x:.2f},{y - r:.2f} A{r},{r} 0 0 0 {x:.2f},{y + r:.2f} Z" fill="{RED}"/>')
    else: svg.add(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="{WHITE}" stroke="{RED}" stroke-width="0.35"/>')
dw1 = sum(b.area for b in DV.blocks) * DV.P['floors'] / DV.P['m2_per_dw']
strip_ha = F['strip']['m2'] / 1e4

# ---- head ---------------------------------------------------------------------------------------------------------------
x0 = 12; W = SW - 24; y = 16
svg.text(x0, y, '+ EXERCISE 2.2 · INTEREST GROUPS · STAGE 1 · 22.11.2026', TY['eyebrow'], fill=G[5], weight=600, spacing=0.3)
svg.text(x0 + W, y, '2.2 · 00', TY['eyebrow'], fill=G[5], weight=600, anchor='end')
y += 17; svg.text(x0, y, 'Three groups, one edge', 16, weight=700)
y += 8.5
intro = ('Our phenomenon: the Armilla air base, 3.71 km² of closed land between five growing towns. All three groups work on the same frame — the north edge, '
         'where Churriana de la Vega and Armilla meet the fence and the metro extension runs along it — and on the same section line S–S, so the plans compare directly.')
for ln in wrap(intro, 3.7, 560): svg.text(x0, y, ln, 3.7, fill=INK); y += LH(3.7)

# ---- three columns ---------------------------------------------------------------------------------------------------------
GUT = 14; CWd = (W - 2 * GUT) / 3; top = 70
crop = (443480, 4110490, 444040, 4110990); ks = CWd / (crop[2] - crop[0]); mh = (crop[3] - crop[1]) * ks
COLS = [
    {'n': 1, 'name': 'Private developer', 'max': 'profit, building rights, speed', 'q': 'Where is it worth building, and how much?',
     'pos': '“The metro is arriving at an empty strip and a 3.7 km² base that the regional plan already wants dismantled: build here — now on the strip, later on the base — as densely as the ceiling allows.”',
     'prog': [('Phase 1 — apartment blocks on the empty strip, 4 floors (about 12 m, under today’s 13–17 m ceiling), shops on the avenue', f'≈ {dw1:,.0f} homes'),
              ('Phase 2 — if the base leaves: a district on its land in this frame, at Sde Dov’s planned density (64 homes/ha)', f'≈ {DV.P["dw2"]:,.0f} homes'),
              ('The whole base at the same density (for comparison)', f'≈ {371 * 64:,.0f} homes')],
     'why': ['POTAUG (2000), art. 4.27: the aim is the base’s “dismantling” and a residential, facilities and services area.',
             'If the five towns grow as in 2015–2025, they need 14,177 more homes by 2045 (our scenario, INE).',
             'The metro extension runs along the strip (under construction; test runs to Las Gabias, June 2026).'],
     'note': f'Estimates: phase 1 = the drawn blocks × 4 floors ÷ 100 m² per home; phase 2 = {DV.P["base_in_ha"]:.0f} ha × 64 homes/ha (Sde Dov: 16,000 units on about 250 ha, Globes).'},
    {'n': 2, 'name': 'Residents of the five towns', 'max': 'quality of life, stability, cost of living', 'q': 'What will change in my daily life?',
     'pos': '“We do not ask the base to leave. We ask that its 8.7 km fence stop being the back of our towns: give us its edge — green, walkable and quiet — with no towers and no new building rights.”',
     'prog': [('An edge park on the empty strip, with allotments, a playground and a 2-floor neighbourhood hall', f'{strip_ha:.2f} ha'),
              ('A fence walk with a tree row along the whole fence of the frame (schematic width 8 m)', f'{RS.P["prom_m"]:,.0f} m'),
              ('Crossings over the metro avenue; the dead end joined; a metro stop asked for', f'{len(RS.crossings)} + 1 + 1'),
              ('New homes or building rights', '0')],
     'why': ['42 % of the fence backs onto housing; 13 dead ends stop at it (2.1).',
             f'{F["strip"]["dwellings_400m"]:,} homes lie within 400 m of the strip (Catastro).',
             'Noise: the Ombudsman’s suggestion to Defence has had no follow-up; no noise map newer than 2006–2011.'],
     'note': 'The demonstration plan of stage 1: sheets 01 (plan 1:1000) and 02 (section 1:500).'},
    {'n': 3, 'name': 'Ministry of Defence', 'max': 'security, operations, a safe approach', 'q': 'What must stay clear for the base to keep flying?',
     'pos': '“Armilla is the Air Force’s helicopter-pilot school and it stays. The towns may grow, but not into its approach: keep the edge low, open and quiet, and the fence closed.”',
     'prog': [('The aeronautical easements of 2019 stay: nothing above the ceiling (13–17 m over the strip)', 'RD 118/2019'),
              ('Outside the fence, under the approach: low uses without gatherings — fields, open land, parking; no schools, no crowds', f'{strip_ha:.2f} ha'),
              ('A patrol road inside the fence, 6 m in', f'{DF.patrol.length:,.0f} m'),
              ('The base keeps its land and its fence', '3.71 km²')],
     'why': ['The State renewed the base’s easements in 2019: it plans to stay (RD 118/2019).',
             'Ala 78, the Air Force’s main helicopter-pilot school, trains here.',
             'Abroad, bases keep working where the towns plan the land around them together (Fort Worth’s joint land-use study, 2008).'],
     'note': 'The “no gatherings” rule is our reading of the group, on the model of land-use zones around US air bases; no such rule is published for Armilla.'},
]

def ctx(xm, ym):
    """the frame's context at the diagram scale: buildings, base, fence, metro, section line"""
    X = lambda u: xm + (u - crop[0]) * ks; Y = lambda v: ym + (crop[3] - v) * ks
    def d(g):
        gs = [g] if g.geom_type in ('Polygon', 'LineString', 'LinearRing') else list(getattr(g, 'geoms', []))
        out = []
        for q in gs:
            if q.is_empty: continue
            if q.geom_type == 'Polygon':
                for r in [q.exterior] + list(q.interiors): out.append('M' + ' L'.join(f'{X(a):.2f},{Y(b):.2f}' for a, b in r.coords) + ' Z')
            elif q.geom_type in ('LineString', 'LinearRing'): out.append('M' + ' L'.join(f'{X(a):.2f},{Y(b):.2f}' for a, b in q.coords))
            elif hasattr(q, 'geoms'): out.append(d(q))
        return ' '.join(out)
    return X, Y, d

for ci, C in enumerate(COLS):
    cx = x0 + ci * (CWd + GUT); y = top
    svg.add(f'<line x1="{cx:.2f}" y1="{y - 6:.2f}" x2="{cx + CWd:.2f}" y2="{y - 6:.2f}" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
    svg.add(f'<circle cx="{cx + 3.2:.2f}" cy="{y + 1.6:.2f}" r="3.2" fill="{RED}"/>'); svg.text(cx + 3.2, y + 2.85, str(C['n']), 3.6, fill=WHITE, weight=700, anchor='middle')
    svg.text(cx + 9, y + 3.6, C['name'], 8.0, weight=700)
    y += 11.5; svg.text(cx, y, 'Maximises: ' + C['max'], BS, fill=G[5]); y += LH(BS)
    svg.text(cx, y, 'Guiding question: ' + C['q'], BS, fill=G[5]); y += 5.8
    # the diagram on the shared frame
    ym = y; X, Y, d = ctx(cx, ym)
    cid = f'dclip{ci}'; svg.defs_add(f'<clipPath id="{cid}"><rect x="{cx:.2f}" y="{ym:.2f}" width="{CWd:.2f}" height="{mh:.2f}"/></clipPath>')
    g = [f'<path d="{d(gd.base)}" fill="url(#baseHatch)" stroke="none" fill-rule="evenodd"/>']
    g.append('<path d="' + ' '.join(d(b) for b, _ in gd.blds) + f'" fill="{G[3]}" stroke="none"/>')
    if C['n'] == 1:
        g.append(f'<path d="{d(DV.strip)}" fill="none" stroke="{RED}" stroke-width="{LW["prop"]}" stroke-dasharray="1 0.7"/>')
        g.append('<path d="' + ' '.join(d(b) for b in DV.grid2) + f'" fill="url(#redHatch)" stroke="{RED}" stroke-width="{LW["thin"]}"/>')
        g.append('<path d="' + ' '.join(d(b) for b in DV.blocks) + f'" fill="{RED}" stroke="none"/>')
    elif C['n'] == 2:
        g.append(f'<path d="{d(RS.park)}" fill="{R[1]}" stroke="{RED}" stroke-width="{LW["prop"]}"/><path d="{d(RS.prom)}" fill="{R[1]}" stroke="none"/>')
        g.append(f'<path d="{d(RS.paths)}" fill="none" stroke="{WHITE}" stroke-width="0.7"/>')
        g.append(''.join(f'<circle cx="{X(a):.2f}" cy="{Y(b):.2f}" r="0.75" fill="{WHITE}" stroke="{RED}" stroke-width="0.12"/>' for a, b in RS.trees + RS.row))
        g.append(f'<path d="{d(RS.hall)}" fill="{RED}" stroke="none"/>')
    else:
        g.append(f'<path d="{d(DF.strip)}" fill="url(#redCross)" stroke="{RED}" stroke-width="{LW["prop"]}"/>')
        g.append(f'<path d="{d(DF.patrol)}" fill="none" stroke="{RED}" stroke-width="{LW["propBold"]}" stroke-dasharray="1.6 0.8"/>')
        for lv in (15,):
            for ln in contour_lines(F, lv):
                if ln.length > 60: g.append(f'<path d="{d(ln)}" fill="none" stroke="{RED}" stroke-width="{LW["prop"]}"/>')
    for m in F['metro_ext']:
        for r in m['r']: g.append(f'<path d="{d(LineString(r[0]))}" fill="none" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
    fw = (LW['fence'] + 0.25) if C['n'] != 3 else 1.0
    g.append(f'<path d="{d(gd.fence_line)}" fill="none" stroke="{INK if C["n"] != 3 else RED}" stroke-width="{fw}"/>')
    if C['n'] == 1: g.append(f'<path d="{d(gd.fence_line)}" fill="none" stroke="{WHITE}" stroke-width="0.35" stroke-dasharray="0.6 1.2"/>')
    g.append(f'<line x1="{X(gd.SA[0]):.2f}" y1="{Y(gd.SA[1]):.2f}" x2="{X(gd.SB[0]):.2f}" y2="{Y(gd.SB[1]):.2f}" stroke="{INK}" stroke-width="{LW["thin"]}" stroke-dasharray="2.4 0.6 0.4 0.6"/>')
    svg.add(f'<g clip-path="url(#{cid})">{"".join(g)}</g><rect x="{cx:.2f}" y="{ym:.2f}" width="{CWd:.2f}" height="{mh:.2f}" fill="none" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
    # diagram labels (short, on white)
    def tag(u, v, s, anchor='start', col=RED):
        svg.text(X(u), Y(v), s, 3.4, fill=col, weight=600, anchor=anchor, halo=1.0)
    if C['n'] == 1:
        tag(443500, 4110930, 'phase 1: blocks on the strip', col=RED); tag(443500, 4110560, 'phase 2: if the base leaves', col=RED)
    elif C['n'] == 2:
        tag(443500, 4110930, 'park, hall and fence walk', col=RED); tag(443500, 4110560, 'the base stays', col=G[5])
    else:
        tag(443500, 4110930, 'strip: low, open, no gatherings', col=RED); tag(443500, 4110560, 'the base stays closed', col=G[5])
        tag(443640, 4110690, '15 m ceiling line', col=RED); tag(443760, 4110660, 'patrol road', col=RED)
    svg.text(cx + CWd - 1.5, ym + mh - 2.0, 'shared frame · schematic', TY['tiny'] + 0.2, fill=G[5], anchor='end', halo=0.6)
    y = ym + mh + 7
    # position
    svg.text(cx, y, 'POSITION', EB, fill=RED, weight=700, spacing=0.35); y += 7.2
    for ln in wrap(C['pos'], PS, CWd, avg=0.5): svg.text(cx, y, ln, PS, weight=500); y += LH(PS)
    y += 4.0
    svg.text(cx, y, 'SHORT PROGRAMME', EB, fill=INK, weight=700, spacing=0.35); y += 6.0
    for a, b in C['prog']:
        lines = wrap(a, BS, CWd - 38)
        for i, ln in enumerate(lines): svg.text(cx, y + i * LH(BS), ln, BS)
        svg.text(cx + CWd, y, b, BS, weight=700, anchor='end')
        y += LH(BS) * len(lines) + 1.8
    y += 2.6
    svg.text(cx, y, 'FROM THE ANALYSIS', EB, fill=INK, weight=700, spacing=0.35); y += 6.0
    for w in C['why']:
        lines = wrap(w, BS, CWd - 3.6)
        svg.add(f'<circle cx="{cx + 0.9:.2f}" cy="{y - 1.05:.2f}" r="0.6" fill="{INK}"/>')
        for ln in lines: svg.text(cx + 3.6, y, ln, BS); y += LH(BS)
        y += 0.9
    y += 1.0
    for ln in wrap(C['note'], 2.2, CWd, avg=0.52): svg.text(cx, y, ln, 2.2, fill=G[5]); y += 2.8
    C['end'] = y

# ---- where they meet and clash ------------------------------------------------------------------------------------------------
ty = max(C['end'] for C in COLS) + 9
svg.add(f'<line x1="{x0}" y1="{ty - 6.5:.2f}" x2="{x0 + W}" y2="{ty - 6.5:.2f}" stroke="{INK}" stroke-width="{LW["mid"]}"/>')
svg.text(x0, ty, 'WHERE THEY MEET AND CLASH', EB + 0.4, fill=RED, weight=700, spacing=0.35)
for i_, (k_, t_) in enumerate((('c', 'clash'), ('p', 'partly'), ('a', 'agreement'))):
    xx = x0 + W - 80 + i_ * 27; mark(xx, ty - 1.1, k_); svg.text(xx + 3.4, ty, t_, BS)
ty += 7.5
ISS = [('The empty strip', f'{strip_ha:.2f} ha', f'\u2248 {dw1:,.0f} homes in 4-floor blocks', 'a public park and a hall; no homes', 'low, open, no gatherings', 'c'),
       ('Height under the ceiling', '13\u201317 m', 'up to the ceiling now, above it once the base leaves', 'low: a 7 m hall and trees', 'the 2019 easements stay', 'p'),
       ('The base land', '3.71 km\u00b2', 'dismantle and build (POTAUG art. 4.27)', 'the base stays; only its edge opens', 'the base stays, closed', 'p'),
       ('The fence', '8.7 km', 'it goes with the base', 'stays; a walk and trees along it', 'stays; a patrol road inside', 'p'),
       ('Who decides', '5 towns + State', 'one special plan for the zone (art. 4.28)', 'the five towns together, with us', 'the State; a joint body is acceptable', 'a')]
cw = [62, 34, (W - 62 - 34 - 16) / 3, (W - 62 - 34 - 16) / 3, (W - 62 - 34 - 16) / 3, 16]
hx = [x0]; [hx.append(hx[-1] + c) for c in cw[:-1]]
for i, h in enumerate(['ISSUE', 'SIZE', 'DEVELOPER', 'RESIDENTS', 'DEFENCE', '']):
    svg.text(hx[i], ty, h, EB, fill=G[5], weight=700, spacing=0.3)
ty += 2.4
for row in ISS:
    ty += 2.6; svg.add(f'<line x1="{x0}" y1="{ty:.2f}" x2="{x0 + W}" y2="{ty:.2f}" stroke="{G[3]}" stroke-width="{LW["thin"]}"/>'); ty += 6.6
    for i, v in enumerate(row):
        if i == 5: mark(hx[i] + 8, ty - 1.1, v, r=1.9)
        else: svg.text(hx[i], ty, v, BS + (0.2 if i == 0 else 0), weight=700 if i == 0 else 400)
ty += 6.0
foot = ('Positions are our representation of each group (brief: \u201ceach group is a conceptual representation\u201d). Sources: D. G. del Catastro; INE padr\u00f3n; POTAUG, Decreto 244/1999, art. 4.27\u20134.30; '
        'RD 118/2019 (BOE); OpenStreetMap contributors (ODbL); Globes (Sde Dov); NCTCOG (Fort Worth JLUS). Diagrams are schematic; estimates are labelled.')
for ln in wrap(foot, 2.2, W, avg=0.52): svg.text(x0, ty, ln, 2.2, fill=G[5]); ty += 2.8
ty += 6.0
svg.add(f'<line x1="{x0}" y1="{ty - 5:.2f}" x2="{x0 + W}" y2="{ty - 5:.2f}" stroke="{INK}" stroke-width="{LW["thin"]}"/>')
svg.text(x0, ty + 1, 'NEXT \u2014 STAGE 2, WEDNESDAY 25.11', EB, fill=INK, weight=700, spacing=0.35)
nxt = ('The developer\u2019s and Defence\u2019s plans (1:1000) and sections (1:500) on the same frame and line; the representative area at 1:250, at the same point for all three; '
       'a street-level view and a 3D model for each group; the comparison board with the map of the collision points; the phenomenon text (one A4) and the corrected 2.1 sheet.')
yy = ty + 6.5
for ln in wrap(nxt, BS, W, avg=0.53): svg.text(x0, yy, ln, BS); yy += LH(BS)
ty = yy
print('columns end at', [round(C['end'], 1) for C in COLS], '| sheet ends at', round(ty, 1), '| dw1', round(dw1))
name = os.path.join(OUT, '2.2_00_three_positions')
ok = export(svg, name, SW, SH, dpi=int(os.environ.get('DPI', 150)))
print('fonts loaded:', ok, '->', name + '.pdf')
