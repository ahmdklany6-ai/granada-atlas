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


def wrap(body, W, H):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="{W:.1f}mm" height="{H:.1f}mm" viewBox="0 0 {W:.2f} {H:.2f}">\n'
            f'<rect id="paper" x="0" y="0" width="{W:.2f}" height="{H:.2f}" fill="#FFFFFF"/>\n{body}\n</svg>\n')


def main():
    d = json.load(open(os.path.join(ROOT, 'data/ex21/areas.json'))); os.makedirs(OUT, exist_ok=True); pad = 10.0
    style = os.environ.get('STYLE', 'plain'); only = os.environ.get('ONLY'); fn = section_svg_poster if style == 'poster' else section_svg
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
