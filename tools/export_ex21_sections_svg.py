"""Export the eight Exercise 2.1 sections across the fence of the Base Aérea de Armilla as VECTOR files (SVG) for
Illustrator — one SVG per section plus one sheet with all eight. True scale 1:500 in both directions (1 m = 2 mm,
the SVG unit is the millimetre), no height break: the limit surface is drawn where it is, crop as needed.
Every element sits in a named group (ground, base-side, buildings, fence, limit-surface, annotations, scale, notes), which
Illustrator opens as separate groups. Colours from js/palette.js; text in IBM Plex Sans (Illustrator substitutes a
font if it is not installed).
Input: data/ex21/areas.json (tools/build_ex21_areas.py). Output folder: OUT (default exports/ex21_sections, not committed).
Usage: python3 tools/export_ex21_sections_svg.py [OUT=/folder]"""
import json, os
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('OUT', os.path.join(ROOT, 'exports/ex21_sections'))
MM = 2.0  # mm per metre at 1:500
# palette.js values
INK, INK2, INK3, RED, CREAM, BASE, LINE = '#29100C', '#4D3D37', '#6F625B', '#992B2A', '#E5E3DA', '#452928', '#C5C0B3'
FLOORS = {'1-2': '#EBD9D3', '3-4': '#C98B80', '5-8': '#992B2A', '9+': '#5A1D22'}
FENCE = {'housing': RED, 'open': '#BFB065', 'road': '#29100C', 'green': '#53461C', 'industry': '#4F6E80'}
FONT = "font-family=\"IBM Plex Sans, Arial, sans-serif\""
NAMES = {'A': 'Churriana: houses with their backs to the fence', 'B': 'Armilla: the corner nearest the metro end', 'C': 'Ogíjares side: the road and the dead ends',
         'D': 'The vega: open fields along the fence', 'E': 'Las Gabias corner: a park and a workshop on the fence', 'F': 'South-east: a neighbourhood and green at the tip of the base',
         'G': 'Farmland between Armilla and Ogíjares', 'H': 'North: the metro along the edge'}


def floors_col(lv):
    return FLOORS['1-2'] if lv <= 2 else FLOORS['3-4'] if lv <= 4 else FLOORS['5-8'] if lv <= 8 else FLOORS['9+']


def section_svg(a, ox=0.0, oy=0.0, standalone=True):
    """Return (svg_body, width_mm, height_mm) for one section, drawn with its top-left at (ox, oy) mm."""
    s = a['section']; sm = s['samples']; L = sm[-1][0]; fa = s['fence_at_m']
    zmin = min(p[1] for p in sm) - 4; zmax = max(max(p[1], p[2]) for p in sm if p[2] < 1e9) + 8
    W = L * MM; Hs = (zmax - zmin) * MM; top = 22.0; H = top + Hs + 30.0  # title band above, notes below
    X = lambda d: ox + d * MM; Z = lambda z: oy + top + (zmax - z) * MM
    g_at = lambda d: sm[max(0, min(len(sm) - 1, int(round(d))))][1]
    o = []
    o.append(f'<g id="section-{a["id"]}">')
    o.append(f'<g id="title-{a["id"]}"><text x="{X(0):.2f}" y="{oy + 7:.2f}" {FONT} font-size="4.2" font-weight="700" fill="{INK}">{a["id"]} · {escape(NAMES.get(a["id"], a["name"]))}</text>'
             f'<text x="{X(0):.2f}" y="{oy + 13:.2f}" {FONT} font-size="2.8" fill="{INK2}">Section {a["id"]}–{a["id"]}′ across the fence · 1:500 (1 m = 2 mm) · heights true, no exaggeration</text></g>')
    # base side (inside the fence)
    o.append(f'<g id="base-side-{a["id"]}"><rect x="{X(fa):.2f}" y="{oy + top:.2f}" width="{(L - fa) * MM:.2f}" height="{Hs:.2f}" fill="{BASE}" fill-opacity="0.16"/>'
             f'<text x="{X(L) - 1:.2f}" y="{oy + top + 4:.2f}" {FONT} font-size="2.8" text-anchor="end" fill="{INK2}">BASE AÉREA (closed)</text></g>')
    # ground (IGN MDT25)
    pts = ' '.join(f'{X(p[0]):.2f},{Z(p[1]):.2f}' for p in sm)
    o.append(f'<g id="ground-{a["id"]}"><polygon points="{X(0):.2f},{Z(zmin):.2f} {pts} {X(L):.2f},{Z(zmin):.2f}" fill="{CREAM}"/>'
             f'<polyline points="{pts}" fill="none" stroke="{INK}" stroke-width="0.5"/></g>')
    # buildings (floors × 3 m, estimate) — unknown floors as dashed outline
    bo = [f'<g id="buildings-{a["id"]}">']
    for c in s['cuts']:
        g = min(g_at(c['s0']), g_at(c['s1'])); w = (c['s1'] - c['s0']) * MM
        if c.get('h_est') is None:
            bo.append(f'<rect x="{X(c["s0"]):.2f}" y="{Z(g + 6):.2f}" width="{w:.2f}" height="{6 * MM:.2f}" fill="none" stroke="{INK3}" stroke-width="0.3" stroke-dasharray="1,1"/>'
                      f'<text x="{X((c["s0"] + c["s1"]) / 2):.2f}" y="{Z(g + 6) - 1:.2f}" {FONT} font-size="2.4" text-anchor="middle" fill="{INK3}">height unknown</text>')
            continue
        h = c['h_est']; bo.append(f'<rect x="{X(c["s0"]):.2f}" y="{Z(g + h):.2f}" width="{w:.2f}" height="{h * MM:.2f}" fill="{floors_col(c["lv"])}" stroke="{INK}" stroke-width="0.3"/>'
                                  f'<text x="{X((c["s0"] + c["s1"]) / 2):.2f}" y="{Z(g + h) - 1:.2f}" {FONT} font-size="2.6" font-weight="600" text-anchor="middle" fill="{INK}">{c["lv"]}F ≈ {h:g} m</text>')
    bo.append('</g>'); o += bo
    # fence (height not mapped): a marker 2.5 m
    gf = g_at(fa); col = FENCE.get(a['kind'], INK)
    o.append(f'<g id="fence-{a["id"]}"><line x1="{X(fa):.2f}" y1="{Z(gf):.2f}" x2="{X(fa):.2f}" y2="{Z(gf + 2.5):.2f}" stroke="{col}" stroke-width="1.2"/>'
             f'<text x="{X(fa) + 1.5:.2f}" y="{Z(gf) + 4:.2f}" {FONT} font-size="2.4" fill="{INK2}">fence (height not mapped)</text></g>')
    # the aeronautical limit surface
    lp = ' '.join(f'{X(p[0]):.2f},{Z(p[2]):.2f}' for p in sm if p[2] < 1e9)
    lf = sm[int(round(fa))][2]; src = a['stats'].get('limit_file', '').replace('.kmz', '')
    o.append(f'<g id="limit-surface-{a["id"]}"><polyline points="{lp}" fill="none" stroke="{RED}" stroke-width="0.6" stroke-dasharray="3,1.5"/>'
             f'<text x="{X(2):.2f}" y="{Z(sm[2][2]) - 1.2:.2f}" {FONT} font-size="2.8" font-weight="700" fill="{RED}">Height-limit surface ≈ {sm[2][2]:.0f} m (approx.)</text></g>')
    # allowed height at the fence (dimension line)
    o.append(f'<g id="annotations-{a["id"]}"><line x1="{X(fa) - 2:.2f}" y1="{Z(gf):.2f}" x2="{X(fa) - 2:.2f}" y2="{Z(lf):.2f}" stroke="{RED}" stroke-width="0.3"/>'
             f'<line x1="{X(fa) - 3:.2f}" y1="{Z(lf):.2f}" x2="{X(fa) - 1:.2f}" y2="{Z(lf):.2f}" stroke="{RED}" stroke-width="0.3"/><line x1="{X(fa) - 3:.2f}" y1="{Z(gf):.2f}" x2="{X(fa) - 1:.2f}" y2="{Z(gf):.2f}" stroke="{RED}" stroke-width="0.3"/>'
             f'<text x="{X(fa) - 3.5:.2f}" y="{(Z(gf) + Z(lf)) / 2:.2f}" {FONT} font-size="2.8" font-weight="700" text-anchor="end" fill="{RED}">allowed ≈ {lf - gf:.0f} m</text>'
             f'<text x="{X(0):.2f}" y="{Z(zmin) + 4:.2f}" {FONT} font-size="3" font-weight="700" fill="{INK}">{a["id"]}</text>'
             f'<text x="{X(L):.2f}" y="{Z(zmin) + 4:.2f}" {FONT} font-size="3" font-weight="700" text-anchor="end" fill="{INK}">{a["id"]}′</text>'
             f'<text x="{X(fa):.2f}" y="{Z(zmin) + 4:.2f}" {FONT} font-size="2.4" text-anchor="middle" fill="{INK2}">ground {gf:.0f} m · limit {lf:.0f} m a.s.l.</text></g>')
    # scale bar 0–10–20–50 m
    sb = [f'<g id="scale-{a["id"]}">']; sx, sy = X(0), Z(zmin) + 9
    for i, (p0, p1) in enumerate([(0, 10), (10, 20), (20, 50)]):
        sb.append(f'<rect x="{sx + p0 * MM:.2f}" y="{sy:.2f}" width="{(p1 - p0) * MM:.2f}" height="1.2" fill="{INK if i % 2 == 0 else "#FFFFFF"}" stroke="{INK}" stroke-width="0.2"/>')
    for v in (0, 10, 20, 50): sb.append(f'<text x="{sx + v * MM:.2f}" y="{sy + 4:.2f}" {FONT} font-size="2.2" text-anchor="middle" fill="{INK}">{v}{" m" if v == 50 else ""}</text>')
    sb.append('</g>'); o += sb
    o.append(f'<g id="notes-{a["id"]}"><text x="{X(0):.2f}" y="{Z(zmin) + 19:.2f}" {FONT} font-size="2.2" fill="{INK3}">Ground: IGN MDT25 (25 m, CC BY 4.0) · buildings: OSM building:levels × 3 m (estimate) · '
             f'limit: {escape(src)} — Origen de los datos: Ministerio de Defensa (RD 118/2019), interpolated, not the legal value</text></g>')
    o.append('</g>')
    return '\n'.join(o), W, H


def person(x, y, h=1.75):
    """A schematic standing figure, h metres tall, feet at (x, y) mm — for scale only."""
    k = h * MM / 1.75; hd = 0.11 * MM / 1.0 * k / k * k  # head radius scaled
    return (f'<g class="scale-figure"><circle cx="{x:.2f}" cy="{y - 1.62 * MM * k / 1:.2f}" r="{0.12 * MM * k:.2f}" fill="{INK}"/>'
            f'<path d="M{x - 0.22 * MM * k:.2f},{y - 1.45 * MM * k:.2f} L{x + 0.22 * MM * k:.2f},{y - 1.45 * MM * k:.2f} L{x + 0.16 * MM * k:.2f},{y - 0.8 * MM * k:.2f} '
            f'L{x + 0.12 * MM * k:.2f},{y:.2f} L{x + 0.02 * MM * k:.2f},{y:.2f} L{x:.2f},{y - 0.7 * MM * k:.2f} L{x - 0.02 * MM * k:.2f},{y:.2f} L{x - 0.12 * MM * k:.2f},{y:.2f} '
            f'L{x - 0.16 * MM * k:.2f},{y - 0.8 * MM * k:.2f} Z" fill="{INK}"/></g>')


def section_svg_poster(a, ox=0.0, oy=0.0):
    """The 'poster' style (owner + Claude, 14 Nov 2026): cut ground and cut buildings strong, buildings up to 40 m behind
    the plane as light elevations, the airspace above the limit hatched red ('forbidden sky'), the allowed envelope between
    ground and limit tinted, crossed streets named, one scale figure. All from data/ex21/areas.json (OSM, IGN, Defensa)."""
    from shapely.geometry import LineString
    s = a['section']; sm = s['samples']; L = sm[-1][0]; fa = s['fence_at_m']; ax, ay = s['a']; bx, by = s['b']
    ux, uy = (bx - ax) / L, (by - ay) / L; vx, vy = -uy, ux
    zmin = min(p[1] for p in sm) - 6; zmax = max(max(p[1], p[2]) for p in sm if p[2] < 1e9) + 10
    W = L * MM; Hs = (zmax - zmin) * MM; top = 22.0; H = top + Hs + 30.0
    X = lambda d: ox + d * MM; Z = lambda z: oy + top + (zmax - z) * MM
    g_at = lambda d: sm[max(0, min(len(sm) - 1, int(round(d))))][1]
    proj = lambda p: ((p[0] - ax) * ux + (p[1] - ay) * uy, (p[0] - ax) * vx + (p[1] - ay) * vy)
    # which side to look at: the one with more building area within 40 m behind the plane
    def behind(sign):
        out = []
        for b in a['buildings']:
            if not b['lv']: continue
            st = [proj(p) for rr in b['r'] for r in rr for p in r]; ts = [sign * t for _, t in st]
            if min(ts) > 0.5 and min(ts) < 40:
                s0, s1 = max(0, min(q for q, _ in st)), min(L, max(q for q, _ in st))
                if s1 - s0 > 0.5: out.append((min(ts), s0, s1, b['lv']))
        return out
    back = max((behind(1), behind(-1)), key=lambda l: sum(q[2] - q[1] for q in l))
    o = [f'<g id="section-{a["id"]}">']
    o.append(f'<g id="title-{a["id"]}"><text x="{X(0):.2f}" y="{oy + 7:.2f}" {FONT} font-size="4.2" font-weight="700" fill="{INK}">{a["id"]} · {escape(NAMES.get(a["id"], a["name"]))}</text>'
             f'<text x="{X(0):.2f}" y="{oy + 13:.2f}" {FONT} font-size="2.8" fill="{INK2}">Section {a["id"]}–{a["id"]}′ · 1:500 · heights true</text></g>')
    gpts = [(X(p[0]), Z(p[1])) for p in sm]; lpts = [(X(p[0]), Z(p[2])) for p in sm if p[2] < 1e9]
    # forbidden sky (above the limit) and allowed envelope (ground → limit)
    sky = ' '.join(f'{x:.2f},{y:.2f}' for x, y in lpts)
    o.append(f'<defs><pattern id="hatch-{a["id"]}" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2.2" stroke="{RED}" stroke-width="0.35" stroke-opacity="0.55"/></pattern></defs>')
    o.append(f'<g id="forbidden-sky-{a["id"]}"><polygon points="{X(0):.2f},{oy + top:.2f} {sky} {X(L):.2f},{oy + top:.2f}" fill="url(#hatch-{a["id"]})"/>'
             f'<text x="{X(L) - 2:.2f}" y="{oy + top + 5:.2f}" {FONT} font-size="3" font-weight="700" text-anchor="end" fill="{RED}">AIRSPACE ABOVE THE LIMIT · no construction without Defence approval</text></g>')
    env = ' '.join(f'{x:.2f},{y:.2f}' for x, y in lpts) + ' ' + ' '.join(f'{x:.2f},{y:.2f}' for x, y in reversed(gpts))
    o.append(f'<g id="allowed-envelope-{a["id"]}"><polygon points="{env}" fill="#F5EAE6" fill-opacity="0.85"/></g>')
    # base side
    o.append(f'<g id="base-side-{a["id"]}"><rect x="{X(fa):.2f}" y="{Z(g_at(fa) + 1.5):.2f}" width="{(L - fa) * MM:.2f}" height="{1.5 * MM:.2f}" fill="{BASE}" fill-opacity="0.9"/>'
             f'<text x="{X(L) - 2:.2f}" y="{Z(g_at(L)) - 5:.2f}" {FONT} font-size="3" font-weight="700" text-anchor="end" fill="{BASE}">BASE AÉREA · closed</text></g>')
    # buildings behind the plane (elevation, lighter with distance)
    eo = [f'<g id="elevation-behind-{a["id"]}">']
    for t, s0, s1, lv in sorted(back, key=lambda q: -q[0]):
        g = g_at((s0 + s1) / 2); h = lv * 3.0; op = max(0.18, 0.55 - t / 90)
        eo.append(f'<rect x="{X(s0):.2f}" y="{Z(g + h):.2f}" width="{(s1 - s0) * MM:.2f}" height="{h * MM:.2f}" fill="{floors_col(lv)}" fill-opacity="{op:.2f}" stroke="{INK3}" stroke-width="0.15" stroke-opacity="{op:.2f}"/>')
    eo.append('</g>'); o += eo
    # cut buildings (strong)
    bo = [f'<g id="buildings-cut-{a["id"]}">']
    for c in s['cuts']:
        g = min(g_at(c['s0']), g_at(c['s1'])); w = (c['s1'] - c['s0']) * MM
        if c.get('h_est') is None:
            bo.append(f'<rect x="{X(c["s0"]):.2f}" y="{Z(g + 6):.2f}" width="{w:.2f}" height="{6 * MM:.2f}" fill="none" stroke="{INK3}" stroke-width="0.35" stroke-dasharray="1,1"/>'
                      f'<text x="{X((c["s0"] + c["s1"]) / 2):.2f}" y="{Z(g + 6) - 1:.2f}" {FONT} font-size="2.4" text-anchor="middle" fill="{INK3}">height unknown</text>'); continue
        h = c['h_est']; bo.append(f'<rect x="{X(c["s0"]):.2f}" y="{Z(g + h):.2f}" width="{w:.2f}" height="{h * MM:.2f}" fill="{floors_col(c["lv"])}" stroke="{INK}" stroke-width="0.7"/>'
                                  f'<text x="{X((c["s0"] + c["s1"]) / 2):.2f}" y="{Z(g + h) - 1.2:.2f}" {FONT} font-size="2.6" font-weight="700" text-anchor="middle" fill="{INK}">{c["lv"]}F ≈ {h:g} m</text>')
    bo.append('</g>'); o += bo
    # cut ground: a strong poché band
    gl = ' '.join(f'{x:.2f},{y:.2f}' for x, y in gpts); gl2 = ' '.join(f'{x:.2f},{y + 3.0 * MM:.2f}' for x, y in reversed(gpts))
    o.append(f'<g id="ground-cut-{a["id"]}"><polygon points="{gl} {gl2}" fill="{INK}"/><polygon points="{X(0):.2f},{Z(zmin):.2f} {" ".join(f"{x:.2f},{y + 3.0 * MM:.2f}" for x, y in gpts)} {X(L):.2f},{Z(zmin):.2f}" fill="{CREAM}"/></g>')
    # streets crossed by the section (OSM), named
    line = LineString([(ax, ay), (bx, by)]); so = [f'<g id="streets-{a["id"]}">']; first_road = None; named = {}
    for st in a['streets']:
        for rr in st['r']:
            for r in rr:
                if len(r) < 2: continue
                inter = LineString(r).intersection(line)
                for q in ([inter] if inter.geom_type == 'Point' else list(getattr(inter, 'geoms', [])) if not inter.is_empty else []):
                    if q.geom_type != 'Point': continue
                    d = line.project(q); x = X(d); y = Z(g_at(d))
                    if st['hw'] not in ('footway', 'path', 'steps', 'cycleway') and first_road is None and d < fa - 3: first_road = d
                    lab = st.get('nm')
                    if not lab or lab in named: continue  # one label per named street; unnamed service roads and paths stay unlabelled
                    named[lab] = d
                    so.append(f'<line x1="{x:.2f}" y1="{y:.2f}" x2="{x:.2f}" y2="{y - 9:.2f}" stroke="{INK3}" stroke-width="0.2"/>'
                              f'<text x="{x + 0.8:.2f}" y="{y - 10:.2f}" {FONT} font-size="2.3" text-anchor="start" fill="{INK2}" transform="rotate(-90 {x + 0.8:.2f} {y - 10:.2f})">{escape(lab)}</text>')
    so.append('</g>'); o += so
    # fence and one scale figure
    gf = g_at(fa); col = FENCE.get(a['kind'], INK)
    o.append(f'<g id="fence-{a["id"]}"><line x1="{X(fa):.2f}" y1="{Z(gf):.2f}" x2="{X(fa):.2f}" y2="{Z(gf + 2.5):.2f}" stroke="{col}" stroke-width="1.4"/>'
             + ''.join(f'<line x1="{X(fa) - 1.2:.2f}" y1="{Z(gf + h):.2f}" x2="{X(fa) + 1.2:.2f}" y2="{Z(gf + h):.2f}" stroke="{col}" stroke-width="0.25"/>' for h in (0.6, 1.2, 1.8, 2.4))
             + f'<text x="{X(fa) + 2:.2f}" y="{Z(gf) + 9:.2f}" {FONT} font-size="2.4" fill="#FFFFFF">fence · height not mapped</text></g>')
    fx = first_road if first_road is not None else fa - 6
    o.append(f'<g id="scale-figure-{a["id"]}">{person(X(fx + 3), Z(g_at(fx + 3)))}<text x="{X(fx + 3) + 2:.2f}" y="{Z(g_at(fx + 3)) - 1:.2f}" {FONT} font-size="2" fill="{INK3}">1.75 m (scale figure)</text></g>')
    # the limit line and the allowed dimension
    lf = sm[int(round(fa))][2]; src = a['stats'].get('limit_file', '').replace('.kmz', '')
    o.append(f'<g id="limit-surface-{a["id"]}"><polyline points="{sky}" fill="none" stroke="{RED}" stroke-width="0.8"/>'
             f'<text x="{X(2):.2f}" y="{Z(sm[2][2]) - 1.5:.2f}" {FONT} font-size="3" font-weight="700" fill="{RED}">Height limit ≈ {sm[2][2]:.0f} m a.s.l. (approx.)</text></g>')
    o.append(f'<g id="annotations-{a["id"]}"><line x1="{X(fa) - 3:.2f}" y1="{Z(gf):.2f}" x2="{X(fa) - 3:.2f}" y2="{Z(lf):.2f}" stroke="{RED}" stroke-width="0.35"/>'
             f'<polygon points="{X(fa) - 4:.2f},{Z(lf) + 2:.2f} {X(fa) - 3:.2f},{Z(lf):.2f} {X(fa) - 2:.2f},{Z(lf) + 2:.2f}" fill="{RED}"/>'
             f'<text x="{X(fa) - 4.5:.2f}" y="{min(Z(gf) - 6, (Z(gf) + Z(lf)) / 2):.2f}" {FONT} font-size="4.4" font-weight="700" text-anchor="end" fill="{RED}">{lf - gf:.0f} m</text>'
             f'<text x="{X(fa) - 4.5:.2f}" y="{min(Z(gf) - 6, (Z(gf) + Z(lf)) / 2) + 3.6:.2f}" {FONT} font-size="2.4" text-anchor="end" fill="{RED}">allowed at the fence</text>'
             f'<text x="{X(0):.2f}" y="{Z(zmin) + 4:.2f}" {FONT} font-size="3" font-weight="700" fill="{INK}">{a["id"]}</text>'
             f'<text x="{X(L):.2f}" y="{Z(zmin) + 4:.2f}" {FONT} font-size="3" font-weight="700" text-anchor="end" fill="{INK}">{a["id"]}′</text></g>')
    sb = [f'<g id="scale-{a["id"]}">']; sx, sy = X(0), Z(zmin) + 9
    for i, (p0, p1) in enumerate([(0, 10), (10, 20), (20, 50)]):
        sb.append(f'<rect x="{sx + p0 * MM:.2f}" y="{sy:.2f}" width="{(p1 - p0) * MM:.2f}" height="1.2" fill="{INK if i % 2 == 0 else "#FFFFFF"}" stroke="{INK}" stroke-width="0.2"/>')
    for v in (0, 10, 20, 50): sb.append(f'<text x="{sx + v * MM:.2f}" y="{sy + 4:.2f}" {FONT} font-size="2.2" text-anchor="middle" fill="{INK}">{v}{" m" if v == 50 else ""}</text>')
    sb.append('</g>'); o += sb
    o.append(f'<g id="notes-{a["id"]}"><text x="{X(0):.2f}" y="{Z(zmin) + 19:.2f}" {FONT} font-size="2.2" fill="{INK3}">Ground: IGN MDT25 (CC BY 4.0) · buildings cut and behind (≤ 40 m): OSM building:levels × 3 m (estimate) · '
             f'limit: {escape(src)} — Origen de los datos: Ministerio de Defensa (RD 118/2019), interpolated · figure for scale only</text></g>')
    o.append('</g>')
    return '\n'.join(o), W, H


# ---------- 'detail' style (owner request, 14 Nov 2026): little text, cut buildings divided into floors, schematic
# entourage — people, cars on the crossed streets, trees only where the section crosses mapped green (OSM). ----------
PINK, PINK2, PINK3 = '#C98B80', '#EBD9D3', '#F5EAE6'  # palette: rose, blush, redSoft


def fig(x, y, kind=0, col=None, s=1.0):
    """Schematic people (for scale only): 0 standing, 1 walking, 2 child, 3 pair. Feet at (x, y) mm; 1.75 m tall."""
    c = col or RED; m = MM * s
    body = lambda bx, h: (f'<circle cx="{bx:.2f}" cy="{y - h * 0.93 * m:.2f}" r="{0.11 * m * h / 1.75:.2f}" fill="{c}"/>'
                          f'<path d="M{bx - 0.2 * m * h / 1.75:.2f},{y - h * 0.83 * m:.2f} h{0.4 * m * h / 1.75:.2f} l-0.06,{h * 0.4 * m:.2f} l{-0.06 * m:.2f},{h * 0.43 * m:.2f} h{-0.1 * m:.2f} l-0.04,{-h * 0.36 * m:.2f} '
                          f'l-0.04,{h * 0.36 * m:.2f} h{-0.1 * m:.2f} l{-0.06 * m:.2f},{-h * 0.43 * m:.2f} z" fill="{c}"/>')
    if kind == 2: return body(x, 1.2)
    if kind == 3: return body(x - 0.35 * m, 1.75) + body(x + 0.35 * m, 1.65)
    if kind == 1: return f'<g transform="skewX(-6) translate({y * 0.105:.2f},0)">{body(x, 1.75)}</g>'
    return body(x, 1.75)


def car(x, y, col=None):
    """Schematic car in side view, 4.3 m × 1.45 m, centred on x, wheels on y."""
    c = col or PINK; L, H = 4.3 * MM, 1.45 * MM
    return (f'<path d="M{x - L / 2:.2f},{y - 0.35 * MM:.2f} v{-0.55 * MM:.2f} q0,-0.15 {0.6 * MM:.2f},-0.2 l{0.7 * MM:.2f},-0.45 h{1.6 * MM:.2f} l{0.75 * MM:.2f},0.45 '
            f'q{0.65 * MM:.2f},0.05 {0.65 * MM:.2f},0.25 v{0.5 * MM:.2f} z" fill="{c}"/>'
            f'<circle cx="{x - L / 2 + 0.85 * MM:.2f}" cy="{y - 0.3 * MM:.2f}" r="{0.3 * MM:.2f}" fill="{INK}"/><circle cx="{x + L / 2 - 0.85 * MM:.2f}" cy="{y - 0.3 * MM:.2f}" r="{0.3 * MM:.2f}" fill="{INK}"/>')


OLIVE, OLIVE2 = '#7E7B43', '#A49250'  # palette: oliveMid, khaki
# owner request (14 Nov 2026): more colours, not everything red — all from js/palette.js
SKY = '#C9D8DF'        # bluePale: the allowed envelope
SLAB = '#452928'       # wine: cut slabs and walls
INTERIOR = '#F6F5F0'   # paper: inside the cut buildings
GLASS = '#7F9DAE'      # blueMid: windows
EARTH = '#9C7A55'      # earthy brown from the slope ramp: the cut ground (one colour all along)
PEOPLE = ['#4F6E80', '#992B2A', '#7E7B43', '#74362D', '#2F4654']  # blueDeep, red, oliveMid, burgundy, blueDark
CARS = ['#9DBCD1', '#BFB065', '#C98B80', '#BDB5AA']               # blueGrey, chartreuse, rose, warmGrey2
# schematic façades by OSM building type (the type is mapped; the façade itself is NOT surveyed — drawn to read the type)
FACADE = {'house': '#E5E3DA', 'residential': '#EBD9D3', 'apartments': '#D6CDA6', 'detached': '#E5E3DA', 'terrace': '#EBD9D3',
          'industrial': '#BDB5AA', 'warehouse': '#BDB5AA', 'retail': '#E4E5D3', 'commercial': '#E4E5D3', 'public': '#C9D8DF',
          'school': '#C9D8DF', 'greenhouse': '#E4E5D3'}


def facade(x0, x1, yg, lv, btype, seed=0):
    """Schematic elevation of a building behind the cut, by its OSM type: wall colour, windows per floor, balconies on
    housing, big doors and cladding on industry, a glazed ground floor on shops, a flat roof with a parapet (no roof
    shapes are mapped here). x mm, yg = ground y mm, 3 m per floor (estimate)."""
    lv = max(1, lv); w = x1 - x0; fh = 3.0 * MM; top = yg - lv * fh; t = btype if btype in FACADE else 'yes'
    wall = FACADE.get(t, '#EFEEE7'); o = [f'<rect x="{x0:.2f}" y="{top:.2f}" width="{w:.2f}" height="{lv * fh:.2f}" fill="{wall}" stroke="{INK}" stroke-width="0.15"/>']
    o.append(f'<rect x="{x0 - 0.1 * MM:.2f}" y="{top - 0.7 * MM:.2f}" width="{w + 0.2 * MM:.2f}" height="{0.7 * MM:.2f}" fill="{SLAB if t not in ("industrial", "warehouse", "greenhouse") else "#8C817A"}"/>')
    if t == 'greenhouse':
        for k in range(1, int(w / (1.5 * MM)) + 1): o.append(f'<line x1="{x0 + k * 1.5 * MM:.2f}" y1="{top:.2f}" x2="{x0 + k * 1.5 * MM:.2f}" y2="{yg:.2f}" stroke="{GLASS}" stroke-width="0.12"/>')
        return ''.join(o)
    if t in ('industrial', 'warehouse'):
        for k in range(1, int(w / (0.8 * MM))): o.append(f'<line x1="{x0 + k * 0.8 * MM:.2f}" y1="{top:.2f}" x2="{x0 + k * 0.8 * MM:.2f}" y2="{yg:.2f}" stroke="#8C817A" stroke-width="0.1"/>')
        dw = min(4.0 * MM, w * 0.4); dh = min(lv * fh * 0.75, 4.2 * MM)
        o.append(f'<rect x="{x0 + (w - dw) * (0.3 + 0.4 * (seed % 2)):.2f}" y="{yg - dh:.2f}" width="{dw:.2f}" height="{dh:.2f}" fill="#4F6E80"/>')
        o.append(f'<rect x="{x0 + 0.5 * MM:.2f}" y="{top + 0.6 * MM:.2f}" width="{max(0, w - MM):.2f}" height="{0.7 * MM:.2f}" fill="{GLASS}" fill-opacity="0.8"/>')
        return ''.join(o)
    n = max(1, int(w / (3.2 * MM))); step = w / n; ww = min(1.3 * MM, step * 0.5)
    for f in range(lv):
        yb = yg - f * fh
        if f == 0 and t in ('retail', 'commercial'):
            o.append(f'<rect x="{x0 + 0.4 * MM:.2f}" y="{yb - 2.6 * MM:.2f}" width="{max(0, w - 0.8 * MM):.2f}" height="{2.3 * MM:.2f}" fill="{GLASS}"/>')
            o.append(f'<rect x="{x0:.2f}" y="{yb - 3.0 * MM:.2f}" width="{w:.2f}" height="{0.35 * MM:.2f}" fill="#992B2A"/>')  # shop awning
            continue
        for k in range(n):
            cx = x0 + step * (k + 0.5)
            if f == 0 and k == (seed % n):  # a door on the ground floor
                o.append(f'<rect x="{cx - 0.55 * MM:.2f}" y="{yb - 2.2 * MM:.2f}" width="{1.1 * MM:.2f}" height="{2.2 * MM:.2f}" fill="#74362D"/>'); continue
            o.append(f'<rect x="{cx - ww / 2:.2f}" y="{yb - 2.3 * MM:.2f}" width="{ww:.2f}" height="{1.4 * MM:.2f}" fill="{GLASS}" stroke="{INK}" stroke-width="0.08"/>')
            if t in ('house', 'detached', 'terrace', 'residential') and f == 0:  # shutters (persianas), schematic
                o.append(f'<rect x="{cx - ww / 2:.2f}" y="{yb - 2.3 * MM:.2f}" width="{ww:.2f}" height="{0.45 * MM:.2f}" fill="#7E7B43" fill-opacity="0.7"/>')
            if f > 0 and t in ('apartments', 'residential') and (k + f + seed) % 2 == 0:  # balcony with a railing
                o.append(f'<rect x="{cx - ww * 0.8:.2f}" y="{yb - 0.9 * MM:.2f}" width="{ww * 1.6:.2f}" height="{0.9 * MM:.2f}" fill="none" stroke="#74362D" stroke-width="0.12"/>'
                         f'<line x1="{cx - ww * 0.8:.2f}" y1="{yb:.2f}" x2="{cx + ww * 0.8:.2f}" y2="{yb:.2f}" stroke="{SLAB}" stroke-width="0.25"/>')
    return ''.join(o)


_TREES = None


def tree_images():
    """PNG cut-outs (transparent background) from the folder in TREE_IMAGES, if set — embedded in the SVG as images.
    Not committed: the owner supplies them for their own sheets."""
    global _TREES
    if _TREES is None:
        import base64, glob
        from PIL import Image
        d = os.environ.get('TREE_IMAGES'); _TREES = []
        for f in sorted(glob.glob(os.path.join(d, '*.png'))) if d else []:
            w, h = Image.open(f).size; _TREES.append((base64.b64encode(open(f, 'rb').read()).decode(), w, h))
    return _TREES


def tree(x, y, h=8.0, col=None, seed=0):
    """Schematic tree (owner request, 14 Nov 2026: olive trees with branching trunks, in the spirit of a reference sheet —
    drawn here, not copied): a trunk that splits into tapering branches; three kinds by seed — a dense round crown, an
    umbrella crown, a bare winter tree. h metres; placed only where the section crosses mapped green (OSM)."""
    import math, random
    imgs = tree_images()
    if imgs:  # the owner's own tree cut-outs (TREE_IMAGES folder; used at the owner's request, kept out of the repo and the site)
        b64, pw, ph = imgs[seed % len(imgs)]; hh = h * MM; ww = hh * pw / ph
        return f'<image class="tree-image" x="{x - ww / 2:.2f}" y="{y - hh:.2f}" width="{ww:.2f}" height="{hh:.2f}" href="data:image/png;base64,{b64}" preserveAspectRatio="none"/>'
    rnd = random.Random(seed * 7919 + 13); kind = seed % 3; t = h * MM
    segs, tips = [], []

    def grow(px, py, ang, length, width, depth):
        nx, ny = px + math.cos(ang) * length, py - math.sin(ang) * length
        segs.append((px, py, nx, ny, width))
        if depth == 0 or length < t * 0.035: tips.append((nx, ny, depth)); return
        n = 2 if kind != 2 or depth > 2 else 3
        spread = (0.55 if kind == 1 else 0.42 if kind == 0 else 0.48) + rnd.uniform(-0.08, 0.08)
        for i in range(n):
            a = ang + spread * (i - (n - 1) / 2) * (1.5 if n == 2 else 1.0) + rnd.uniform(-0.15, 0.15)
            if kind == 1: a = ang + (a - ang) * 1.25  # umbrella: wider, flatter
            grow(nx, ny, a, length * rnd.uniform(0.66, 0.78), width * 0.66, depth - 1)

    grow(x, y, math.pi / 2 + rnd.uniform(-0.06, 0.06), t * (0.3 if kind != 1 else 0.4), t * 0.05, 6 if kind != 2 else 7)
    br = [f'<line x1="{a:.2f}" y1="{b:.2f}" x2="{c:.2f}" y2="{d:.2f}" stroke="{OLIVE}" stroke-width="{max(0.05, w):.2f}" stroke-linecap="round"/>' for a, b, c, d, w in segs]
    leaves = []
    if kind != 2:
        # a full crown: many small leaf clusters inside an irregular envelope (denser towards the edge, open low in the
        # middle so the branches show), plus lobes on the outline — two olive tones
        # the crown follows the branches: its envelope is fitted to the branch tips
        xs = [p[0] for p in tips]; ys = [p[1] for p in tips]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2 + t * 0.02
        rx, ry = (max(xs) - min(xs)) / 2 + t * 0.06, (max(ys) - min(ys)) / 2 + t * (0.1 if kind == 0 else 0.07)
        lob = [rnd.uniform(0.84, 1.1) for _ in range(14)]
        edge = lambda a: lob[int((a % (2 * math.pi)) / (2 * math.pi) * 14) % 14]
        for j in range(480):
            a = rnd.uniform(0, 2 * math.pi); rr = rnd.random() ** 0.4 * edge(a)
            dx, dy = math.cos(a) * rr * rx, math.sin(a) * rr * ry
            if dy > 0.3 * ry and abs(dx) < 0.35 * rx and rnd.random() < 0.8: continue
            r = t * rnd.uniform(0.018, 0.04)
            leaves.append(f'<circle cx="{cx + dx:.2f}" cy="{cy + dy:.2f}" r="{r:.2f}" fill="{OLIVE if j % 3 else OLIVE2}" fill-opacity="{rnd.uniform(0.55, 0.85):.2f}"/>')
    return f'<g class="tree-schematic">{"".join(br)}{"".join(leaves)}</g>'


def section_svg_detail(a, ox=0.0, oy=0.0):
    from shapely.geometry import LineString, Polygon
    s = a['section']; sm = s['samples']; L = sm[-1][0]; fa = s['fence_at_m']; ax, ay = s['a']; bx, by = s['b']
    ux, uy = (bx - ax) / L, (by - ay) / L; vx, vy = -uy, ux; line = LineString([(ax, ay), (bx, by)])
    # true 1:500 up to 22 m above the highest ground; above that a compressed band (12 mm) with a break, so the street
    # life stays large and the limit line stays visible at its real (written) height
    zmin = min(p[1] for p in sm) - 5; zb = max(p[1] for p in sm) + 22; zlim = max(p[2] for p in sm if p[2] < 1e9)
    zmax = max(zb, zlim + 3); BAND = 12.0 if zlim > zb else 0.0
    W = L * MM; Hs = (min(zmax, zb) - zmin) * MM + BAND + (6 if BAND else 0); top = 4.0; H = top + Hs + 16.0
    X = lambda d: ox + d * MM
    def Z(z):
        base = oy + top + BAND + (6 if BAND else 0)
        if z <= zb or not BAND: return base + (min(zmax, zb) - z) * MM
        return base - min(1.0, (z - zb) / max(1e-6, zlim + 3 - zb)) * BAND
    self_break = (oy + top + BAND + 6 + 0.0) if BAND else None
    g_at = lambda d: sm[max(0, min(len(sm) - 1, int(round(d))))][1]
    proj = lambda p: ((p[0] - ax) * ux + (p[1] - ay) * uy, (p[0] - ax) * vx + (p[1] - ay) * vy)
    gpts = [(X(p[0]), Z(p[1])) for p in sm]; lpts = [(X(p[0]), Z(p[2])) for p in sm if p[2] < 1e9]; P = lambda pts: ' '.join(f'{x:.2f},{y:.2f}' for x, y in pts)
    o = [f'<g id="section-{a["id"]}">',
         f'<defs><pattern id="hatch-{a["id"]}" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2.2" stroke="{RED}" stroke-width="0.3" stroke-opacity="0.45"/></pattern></defs>',
         f'<g id="forbidden-sky-{a["id"]}"><polygon points="{X(0):.2f},{oy + top:.2f} {P(lpts)} {X(L):.2f},{oy + top:.2f}" fill="url(#hatch-{a["id"]})"/></g>',
         f'<g id="allowed-envelope-{a["id"]}"><polygon points="{P(lpts)} {P(reversed(gpts))}" fill="{SKY}" fill-opacity="0.45"/></g>']
    # buildings behind the plane (≤ 40 m), light outlines with floor lines
    def behind(sign):
        out = []
        for b in a['buildings']:
            if not b['lv']: continue
            st = [proj(p) for rr in b['r'] for r in rr for p in r]; ts = [sign * t for _, t in st]
            if 0.5 < min(ts) < 40:
                s0, s1 = max(0, min(q for q, _ in st)), min(L, max(q for q, _ in st))
                if s1 - s0 > 0.5: out.append((min(ts), s0, s1, b['lv'], b.get('b') or 'yes'))
        return out
    back = max((behind(1), behind(-1)), key=lambda l: sum(q[2] - q[1] for q in l))
    eo = [f'<g id="elevation-behind-{a["id"]}">']
    for i, (t, s0, s1, lv, btype) in enumerate(sorted(back, key=lambda q: -q[0])):
        g = g_at((s0 + s1) / 2); op = max(0.5, 1.0 - t / 70)
        eo.append(f'<g opacity="{op:.2f}">' + facade(X(s0), X(s1), Z(g), int(lv), btype, i) + '</g>')
    eo.append('</g>'); o += eo
    # mapped green crossed by the section → trees (schematic)
    to = [f'<g id="trees-schematic-{a["id"]}">']; k = 0
    for bl in a.get('bandlu', []):
        if bl['c'] != 'green': continue
        for rr in bl['r']:
            try: poly = Polygon(rr[0], rr[1:])
            except Exception: continue
            seg = poly.intersection(line)
            for q in ([seg] if seg.geom_type == 'LineString' else list(getattr(seg, 'geoms', []))):
                if q.is_empty or q.geom_type != 'LineString': continue
                d0, d1 = sorted([line.project(type(line)([q.coords[0], q.coords[0]]).interpolate(0)), line.project(type(line)([q.coords[-1], q.coords[-1]]).interpolate(0))])
                d = d0 + 3
                while d < d1 - 2:
                    room = sm[max(0, min(len(sm) - 1, int(round(d))))][2] - g_at(d) - 1.5  # schematic trees stay under the limit (their real heights are unknown)
                    to.append(tree(X(d), Z(g_at(d)), max(4.0, min(7 + (k % 3) * 1.5, room / 1.1)), seed=k)); d += 7.5; k += 1
    to.append('</g>'); o += to
    # cut buildings: floors (3 m each), slabs in red, interiors light, people inside (schematic)
    bo = [f'<g id="buildings-cut-floors-{a["id"]}">']
    for i, c in enumerate(s['cuts']):
        g = min(g_at(c['s0']), g_at(c['s1'])); x0, x1 = X(c['s0']), X(c['s1'])
        if c.get('h_est') is None:
            bo.append(f'<rect x="{x0:.2f}" y="{Z(g + 6):.2f}" width="{x1 - x0:.2f}" height="{6 * MM:.2f}" fill="none" stroke="{PINK}" stroke-width="0.35" stroke-dasharray="1,1"/>'); continue
        lv = int(c['lv']); slab = 0.35 * MM; wall = 0.3 * MM
        bo.append(f'<rect x="{x0:.2f}" y="{Z(g + lv * 3):.2f}" width="{x1 - x0:.2f}" height="{lv * 3 * MM:.2f}" fill="{INTERIOR}"/>')
        for f in range(lv + 1): bo.append(f'<rect x="{x0:.2f}" y="{Z(g + f * 3) - (slab if f else 0):.2f}" width="{x1 - x0:.2f}" height="{slab:.2f}" fill="{SLAB}"/>')
        bo.append(f'<rect x="{x0:.2f}" y="{Z(g + lv * 3):.2f}" width="{wall:.2f}" height="{lv * 3 * MM:.2f}" fill="{SLAB}"/><rect x="{x1 - wall:.2f}" y="{Z(g + lv * 3):.2f}" width="{wall:.2f}" height="{lv * 3 * MM:.2f}" fill="{SLAB}"/>')
        for f in range(lv):  # window openings in the cut walls (schematic), blue glass
            for xw in (x0, x1 - wall):
                bo.append(f'<rect x="{xw:.2f}" y="{Z(g + f * 3 + 2.3):.2f}" width="{wall:.2f}" height="{1.4 * MM:.2f}" fill="{GLASS}"/>')
        bo.append(f'<rect x="{x0 - 0.15 * MM:.2f}" y="{Z(g + lv * 3 + 0.9):.2f}" width="{x1 - x0 + 0.3 * MM:.2f}" height="{0.9 * MM:.2f}" fill="{SLAB}"/>')  # parapet
        if x1 - x0 > 6 * MM:
            for f in range(min(lv, 3)): bo.append(fig(x0 + (x1 - x0) * (0.3 + 0.2 * ((f + i) % 3)), Z(g + f * 3) - 0.35 * MM, (f + i) % 4, PEOPLE[(f + i) % len(PEOPLE)]))
    bo.append('</g>'); o += bo
    # cut ground: one earth colour all along; the base side marked by a light hatch (not by another colour)
    bside = [q for q in gpts if q[0] >= X(fa)]
    o.append(f'<defs><pattern id="basehatch-{a["id"]}" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#FFFFFF" stroke-width="0.25" stroke-opacity="0.6"/></pattern></defs>'
             f'<g id="ground-cut-{a["id"]}"><polygon points="{P(gpts)} {P((x, y + 2.6 * MM) for x, y in reversed(gpts))}" fill="{EARTH}"/>'
             f'<polygon points="{P(bside)} {P((x, y + 2.6 * MM) for x, y in reversed(bside))}" fill="url(#basehatch-{a["id"]})"/>'
             f'<polyline points="{P(gpts)}" fill="none" stroke="{SLAB}" stroke-width="0.35"/></g>')
    # streets crossed → cars on roads, people on paths / sidewalks (schematic)
    eo = [f'<g id="people-cars-schematic-{a["id"]}">']; used = []
    for st in a['streets']:
        for rr in st['r']:
            for r in rr:
                if len(r) < 2: continue
                inter = LineString(r).intersection(line)
                for q in ([inter] if inter.geom_type == 'Point' else list(getattr(inter, 'geoms', [])) if not inter.is_empty else []):
                    if q.geom_type != 'Point': continue
                    d = line.project(q)
                    if d > fa - 1.5 or any(abs(d - u) < 5 for u in used): continue
                    used.append(d); gy = Z(g_at(d))
                    n = len(used)
                    if st['hw'] in ('footway', 'path', 'pedestrian', 'steps', 'cycleway', 'living_street'): eo.append(fig(X(d), gy, n % 4, PEOPLE[n % len(PEOPLE)]))
                    elif st['hw'] in ('service', 'track'): eo.append(fig(X(d) + 1.2 * MM, gy, 1, PEOPLE[(n + 2) % len(PEOPLE)]))
                    else: eo.append(car(X(d), gy, CARS[n % len(CARS)])); eo.append(fig(X(d) + 4.2 * MM, gy, (n + 1) % 4, PEOPLE[(n + 1) % len(PEOPLE)]))
    eo.append(fig(X(fa) - 3.2 * MM, Z(g_at(fa - 3.2)), 0, INK))  # someone at the fence
    eo.append('</g>'); o += eo
    # the fence
    gf = g_at(fa)
    o.append(f'<g id="fence-{a["id"]}"><line x1="{X(fa):.2f}" y1="{Z(gf):.2f}" x2="{X(fa):.2f}" y2="{Z(gf + 2.5):.2f}" stroke="{INK}" stroke-width="0.9"/>'
             + ''.join(f'<line x1="{X(fa) - 1.2:.2f}" y1="{Z(gf + h):.2f}" x2="{X(fa) + 1.2:.2f}" y2="{Z(gf + h):.2f}" stroke="{INK}" stroke-width="0.2"/>' for h in (0.6, 1.2, 1.8, 2.4)) + '</g>')
    # the limit, the allowed height — numbers only
    lf = sm[int(round(fa))][2]
    o.append(f'<g id="limit-surface-{a["id"]}"><polyline points="{P(lpts)}" fill="none" stroke="{RED}" stroke-width="0.8"/>'
             f'<text x="{X(1.5):.2f}" y="{Z(sm[1][2]) - 1.4:.2f}" {FONT} font-size="3" font-weight="700" fill="{RED}">{sm[1][2]:.0f} m</text></g>')
    o.append(f'<g id="allowed-{a["id"]}"><line x1="{X(fa) - 2.5:.2f}" y1="{Z(gf):.2f}" x2="{X(fa) - 2.5:.2f}" y2="{Z(lf):.2f}" stroke="{RED}" stroke-width="0.35"/>'
             f'<polygon points="{X(fa) - 3.4:.2f},{Z(lf) + 1.8:.2f} {X(fa) - 2.5:.2f},{Z(lf):.2f} {X(fa) - 1.6:.2f},{Z(lf) + 1.8:.2f}" fill="{RED}"/>'
             f'<text x="{X(fa) - 4:.2f}" y="{min(Z(gf) - 8, (Z(gf) + Z(lf)) / 2):.2f}" {FONT} font-size="5" font-weight="700" text-anchor="end" fill="{RED}">{lf - gf:.0f} m</text></g>')
    if BAND:
        yb = Z(zb); zz = ''.join(f'{"M" if i == 0 else "L"}{X(0) + i * 3:.2f},{yb + (1.2 if i % 2 else -1.2):.2f} ' for i in range(int(W / 3) + 2))
        o.append(f'<g id="height-break-{a["id"]}"><rect x="{X(0):.2f}" y="{yb - 1.6:.2f}" width="{W:.2f}" height="3.2" fill="#FFFFFF"/><path d="{zz}" fill="none" stroke="{INK3}" stroke-width="0.25"/></g>')
    o.append(f'<g id="letters-{a["id"]}"><text x="{X(0):.2f}" y="{Z(zmin) + 3.5:.2f}" {FONT} font-size="3.4" font-weight="700" fill="{INK}">{a["id"]}</text>'
             f'<text x="{X(L):.2f}" y="{Z(zmin) + 3.5:.2f}" {FONT} font-size="3.4" font-weight="700" text-anchor="end" fill="{INK}">{a["id"]}′</text></g>')
    sb = [f'<g id="scale-{a["id"]}">']; sx, sy = X(L) - 50 * MM, Z(zmin) + 7
    for i, (p0, p1) in enumerate([(0, 10), (10, 20), (20, 50)]):
        sb.append(f'<rect x="{sx + p0 * MM:.2f}" y="{sy:.2f}" width="{(p1 - p0) * MM:.2f}" height="1" fill="{INK if i % 2 == 0 else "#FFFFFF"}" stroke="{INK}" stroke-width="0.2"/>')
    for v in (0, 10, 20, 50): sb.append(f'<text x="{sx + v * MM:.2f}" y="{sy + 3.6:.2f}" {FONT} font-size="2" text-anchor="middle" fill="{INK}">{v}{" m" if v == 50 else ""}</text>')
    sb.append('</g>'); o += sb
    src = a['stats'].get('limit_file', '').replace('.kmz', '')
    o.append(f'<g id="sources-{a["id"]}" opacity="0.9"><text x="{X(0):.2f}" y="{Z(zmin) + 12:.2f}" {FONT} font-size="1.8" fill="{INK3}">1:500 · IGN MDT25 · OSM (floors × 3 m, estimate) · {escape(src)}, Ministerio de Defensa · people, cars, trees and façades (by OSM building type): schematic</text></g>')
    o.append('</g>')
    return '\n'.join(o), W, H


def wrap(body, W, H):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="{W:.1f}mm" height="{H:.1f}mm" viewBox="0 0 {W:.2f} {H:.2f}">\n'
            f'<rect id="paper" x="0" y="0" width="{W:.2f}" height="{H:.2f}" fill="#FFFFFF"/>\n{body}\n</svg>\n')


def main():
    d = json.load(open(os.path.join(ROOT, 'data/ex21/areas.json'))); os.makedirs(OUT, exist_ok=True); pad = 10.0
    style = os.environ.get('STYLE', 'plain'); only = os.environ.get('ONLY'); fn = section_svg_poster if style == 'poster' else section_svg_detail if style == 'detail' else section_svg
    if only: d['areas'] = [a for a in d['areas'] if a['id'] in only.split(',')]
    parts, y, Wmax = [], pad, 0.0
    for a in d['areas']:
        body, W, H = fn(a, pad, pad)
        open(os.path.join(OUT, f'section_{a["id"]}.svg'), 'w').write(wrap(body, W + 2 * pad, H + 2 * pad))
        b2, W2, H2 = fn(a, pad, y); parts.append(b2); y += H2 + 12; Wmax = max(Wmax, W2)
        print(f'section_{a["id"]}.svg  {W + 2 * pad:.0f} × {H + 2 * pad:.0f} mm')
    open(os.path.join(OUT, 'sections_all.svg'), 'w').write(wrap('\n'.join(parts), Wmax + 2 * pad, y + pad))
    print(f'sections_all.svg  {Wmax + 2 * pad:.0f} × {y + pad:.0f} mm  → {OUT}')


if __name__ == '__main__':
    main()
