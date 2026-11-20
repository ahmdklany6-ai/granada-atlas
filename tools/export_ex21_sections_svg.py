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
# the sky's tone (owner, 19 Nov 2026: tried red instead of blue, then 'our green'): a palette colour and how strongly it is laid on, so
# each stays pale — env SKY_TONE = green (default) | red | blue
SKIES = {'blue': ('#C9D8DF', 1.0), 'red': ('#E6CBC3', 1.0), 'green': ('#7E7B43', 0.36)}   # bluePale, redTint, oliveMid (the green of parks and trees)
SKY, SKY_K = SKIES[os.environ.get('SKY_TONE', 'green')]
GCUT = 1.2 * MM   # thickness of the cut ground band (owner, 20 Nov 2026: thinner; was 2.6 m)
SLAB = '#452928'       # wine: cut slabs and walls
INTERIOR = '#F6F5F0'   # paper: inside the cut buildings
GLASS = '#8C817A'      # warmGrey: windows, soft (owner, 19 Nov: muted like the reference sheets)
CUT = '#992B2A'         # owner request: everything cut (ground, slabs, walls) in the studio red
PEOPLE = ['#6F625B', '#8C817A', '#4D3D37', '#6F625B', '#992B2A']  # ink3, warmGrey, ink2 — soft greys, one red
CARS = ['#D3CFC2', '#BDB5AA', '#E5E3DA', '#BDB5AA']               # stone, warmGrey2, cream
# schematic façades by OSM building type (the type is mapped; the façade itself is NOT surveyed — drawn to read the type)
FACADE = {'house': '#E5E3DA', 'residential': '#EBD9D3', 'apartments': '#D3CFC2', 'detached': '#E5E3DA', 'terrace': '#EBD9D3',
          'industrial': '#D3CFC2', 'warehouse': '#D3CFC2', 'retail': '#E4E5D3', 'commercial': '#E4E5D3', 'public': '#E5E3DA',
          'school': '#EBD9D3', 'greenhouse': '#EFEEE7'}


STONE, BLUSH, PAPER2 = '#D3CFC2', '#EBD9D3', '#EFEEE7'   # palette: stone, blush, paper2


def rich_defs(i):
    """textures for the detailed section (owner, 19 Nov 2026: 'a high level of detail, beauty, colours and textures'):
    a fine paper/stucco grain for walls and soil, a sky that fades upwards, a stippled soil under the cut, a wire mesh."""
    return (f'<defs>'
            f'<filter id="grain-{i}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="3" seed="11" result="n"/>'
            f'<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 -0.18 0.07" result="a"/><feComposite in="a" in2="SourceGraphic" operator="in" result="b"/>'
            f'<feTurbulence type="fractalNoise" baseFrequency="3.5" numOctaves="1" seed="3" result="f"/><feColorMatrix in="f" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 -0.2 0.1" result="fa"/><feComposite in="fa" in2="SourceGraphic" operator="in" result="fb"/>'
            f'<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="b"/><feMergeNode in="fb"/></feMerge></filter>'
            f'<linearGradient id="skyg-{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.7" stop-color="{SKY}" stop-opacity="{0.25 * SKY_K:.3f}"/><stop offset="1" stop-color="{SKY}" stop-opacity="{0.45 * SKY_K:.3f}"/></linearGradient><linearGradient id="fog-{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.8"/></linearGradient>'
            f'<linearGradient id="soilfade-{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="1"/></linearGradient>'
            f'<pattern id="soil-{i}" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="{BLUSH}"/><circle cx="0.6" cy="0.7" r="0.22" fill="{PINK}"/><circle cx="2.1" cy="1.9" r="0.16" fill="{PINK}"/><circle cx="1.5" cy="0.3" r="0.1" fill="{RED}" fill-opacity="0.5"/><circle cx="2.7" cy="2.8" r="0.12" fill="{PINK}"/></pattern>'
            f'<pattern id="mesh-{i}" width="0.9" height="0.9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.9" height="0.9" fill="none" stroke="{INK}" stroke-width="0.06" stroke-opacity="0.7"/></pattern>'
            f'<pattern id="brick-{i}" width="1.6" height="0.5" patternUnits="userSpaceOnUse"><line x1="0" y1="0.25" x2="1.6" y2="0.25" stroke="#74362D" stroke-width="0.04" stroke-opacity="0.35"/><line x1="0.4" y1="0" x2="0.4" y2="0.25" stroke="#74362D" stroke-width="0.03" stroke-opacity="0.25"/><line x1="1.2" y1="0.25" x2="1.2" y2="0.5" stroke="#74362D" stroke-width="0.03" stroke-opacity="0.25"/></pattern>'
            f'<pattern id="diamond-{i}" width="0.7" height="0.7" patternUnits="userSpaceOnUse"><path d="M0.35,0 L0.7,0.35 L0.35,0.7 L0,0.35 Z" fill="none" stroke="#74362D" stroke-width="0.04" stroke-opacity="0.45"/></pattern>'
            f'<pattern id="rubble-{i}" width="1.3" height="0.9" patternUnits="userSpaceOnUse"><path d="M0,0.45 H1.3 M0.4,0 V0.45 M1.0,0.45 V0.9 M0.15,0.45 V0.9" fill="none" stroke="#FFFFFF" stroke-width="0.05" stroke-opacity="0.55"/></pattern>'
            f'<pattern id="stripe-{i}" width="0.5" height="2" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="0.22" height="2" fill="#FFFFFF" fill-opacity="0.55"/></pattern>'
            f'<pattern id="slat-{i}" width="0.26" height="2" patternUnits="userSpaceOnUse"><line x1="0.13" y1="0" x2="0.13" y2="2" stroke="#A49250" stroke-width="0.09"/></pattern>'
            f'<pattern id="tile-{i}" width="0.4" height="2" patternUnits="userSpaceOnUse"><line x1="0.2" y1="0" x2="0.2" y2="2" stroke="#74362D" stroke-width="0.05" stroke-opacity="0.45"/></pattern>'
            f'<pattern id="rib-{i}" width="0.8" height="2" patternUnits="userSpaceOnUse"><line x1="0.4" y1="0" x2="0.4" y2="2" stroke="#8C817A" stroke-width="0.05" stroke-opacity="0.6"/></pattern>'
            f'<linearGradient id="shade-{i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{INK}" stop-opacity="0"/><stop offset="1" stop-color="{INK}" stop-opacity="0.16"/></linearGradient>'
            f'</defs>')


def lamp(x, y, side=1):
    """a street light (schematic, for scale): 7 m post, a short arm and the lamp"""
    top = y - 7 * MM; ax = x + side * 1.4 * MM
    return (f'<g class="street-light-schematic"><line x1="{x:.2f}" y1="{y:.2f}" x2="{x:.2f}" y2="{top:.2f}" stroke="{INK2}" stroke-width="0.22"/>'
            f'<path d="M{x:.2f},{top:.2f} q{side * 0.6 * MM:.2f},-0.35 {side * 1.4 * MM:.2f},0" fill="none" stroke="{INK2}" stroke-width="0.18"/>'
            f'<rect x="{ax - 0.4 * MM:.2f}" y="{top - 0.05:.2f}" width="{0.8 * MM:.2f}" height="{0.22 * MM:.2f}" fill="{INK2}"/>'
            '</g>')


def bench(x, y):
    return (f'<g class="bench-schematic"><rect x="{x - 0.9 * MM:.2f}" y="{y - 0.45 * MM:.2f}" width="{1.8 * MM:.2f}" height="{0.08 * MM:.2f}" fill="{INK2}"/>'
            f'<rect x="{x - 0.9 * MM:.2f}" y="{y - 0.85 * MM:.2f}" width="{0.08 * MM:.2f}" height="{0.85 * MM:.2f}" fill="{INK2}"/><line x1="{x + 0.75 * MM:.2f}" y1="{y - 0.45 * MM:.2f}" x2="{x + 0.75 * MM:.2f}" y2="{y:.2f}" stroke="{INK2}" stroke-width="0.12"/></g>')


LINEC = '#8C817A'   # warmGrey: every thin line of the elevations


def _r(x, y, w, h, fill, op=1.0, stroke=None, sw=0.05, extra=''):
    return (f'<rect x="{x:.2f}" y="{y:.2f}" width="{max(0, w):.2f}" height="{max(0, h):.2f}" fill="{fill}"' + (f' fill-opacity="{op:.2f}"' if op < 1 else '')
            + (f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '') + extra + '/>')


def _l(x1, y1, x2, y2, col=LINEC, sw=0.05, op=1.0):
    return f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{col}" stroke-width="{sw}"' + (f' stroke-opacity="{op:.2f}"' if op < 1 else '') + '/>'


def facade_style(btype, year, lv):
    """which elevation a building gets — from what IS recorded: its type (OSM / Catastro use), its floors and its year of
    construction (Catastro). No year on record → 'plain' (no period features)."""
    if btype in ('industrial', 'warehouse'): return 'shed'
    if btype == 'greenhouse': return 'greenhouse'
    if btype in ('public', 'school'): return 'public'
    if btype in ('retail', 'commercial'): return 'shop'
    if not year: return 'plain'
    if lv <= 2: return 'trad' if year < 1965 else 'house' if year < 1990 else 'villa'
    return 'brick' if year < 1982 else 'render' if year < 2000 else 'boom' if year < 2010 else 'new'


def facade(x0, x1, yg, lv, btype, seed=0, rid=None, year=None, obs=None):
    """Elevation of a building behind the cut (owner, 19 Nov 2026: 'I want to see the differences between the buildings').
    RECORDED: position and width (footprint), floors (× 3 m, estimate), type, year of construction → the style family
    (facade_style). SCHEMATIC, not surveyed: materials, colours, window rhythm, balconies, roof form — typical of that kind
    of building in that period, varied a little per building so the street does not repeat. Returns (svg, silhouette).
    obs = what was read from the Catastro's façade photo of the parcel (data/ex21/facades.json): then the wall material and
    colour, the base, roof type, balconies, awnings, shutters and doors follow the photo; only the number and place of the
    openings stay schematic (and the face drawn may be another side of the building than the one photographed)."""
    import random
    lv = max(1, int(lv)); w = x1 - x0; fh = 3.0 * MM; top = yg - lv * fh; st = facade_style(btype, year, lv); rnd = random.Random(seed * 131 + 7)
    m = lambda v: v * MM; o = []; sil = [(x0, yg), (x0, top), (x1, top), (x1, yg)]; more = []   # the silhouette (for the distance veil) and parts standing above it
    pat = lambda name: f'url(#{name}-{rid})' if rid else None
    # ---- small parts ----
    def win(cx, yb, ww, wh, sill=0.9, gop=0.5, box=None, shutter=None, grille=False, frame=LINEC):
        xw, yt = cx - m(ww) / 2, yb - m(sill + wh); q = [_r(xw, yt, m(ww), m(wh), GLASS, gop, frame, 0.05)]
        if ww > 1.0: q.append(_l(cx, yt, cx, yt + m(wh), frame, 0.04))                                   # two leaves
        if box: q.append(_r(xw - m(0.05), yt - m(0.25), m(ww + 0.1), m(0.25), box, 1, LINEC, 0.03))      # roller-shutter box
        if shutter: q.append(_r(xw, yt, m(ww), m(wh * shutter[1]), shutter[0], 0.6) + ''.join(_l(xw, yt + m(j * 0.14), xw + m(ww), yt + m(j * 0.14), '#FFFFFF', 0.03, 0.5) for j in range(1, int(wh * shutter[1] / 0.14))))
        if grille: q.append(''.join(_l(xw + m(ww) * j / 4, yt, xw + m(ww) * j / 4, yt + m(wh), INK2, 0.03, 0.6) for j in range(1, 4)) + _l(xw, yt + m(wh) / 2, xw + m(ww), yt + m(wh) / 2, INK2, 0.03, 0.6))
        if sill > 0: q.append(_r(xw - m(0.08), yb - m(sill), m(ww + 0.16), m(0.08), '#FFFFFF', 1, LINEC, 0.03))
        return ''.join(q)
    def rail(cx, yb, bw, kind='bars', col='#F6F5F0'):
        xb = cx - m(bw) / 2; q = [_l(xb - m(0.1), yb, xb + m(bw + 0.1), yb, LINEC, 0.12)]                # the slab's edge
        if kind == 'solid': q.append(_r(xb, yb - m(1.0), m(bw), m(1.0), col, 1, LINEC, 0.05))
        elif kind == 'glass': q.append(_r(xb, yb - m(1.0), m(bw), m(1.0), '#A9C0CB', 0.3, LINEC, 0.04))
        else: q.append(_r(xb, yb - m(1.0), m(bw), m(1.0), 'none', 1, LINEC, 0.05) + ''.join(_l(xb + m(j * 0.15), yb - m(1.0), xb + m(j * 0.15), yb, LINEC, 0.025) for j in range(1, int(bw / 0.15))))
        return ''.join(q)
    def awning(cx, yt, aw, col, striped=True):   # a canvas awning over an opening: a sloped sheet seen from the front, with its valance
        xa = cx - m(aw) / 2; q = _r(xa, yt, m(aw), m(0.55), col, 0.85, LINEC, 0.03)
        if striped and rid: q += _r(xa, yt, m(aw), m(0.55), pat('stripe'))
        return q + f'<path d="M{xa:.2f},{yt + m(0.55):.2f} ' + ' '.join(f'q{m(aw) / 12:.2f},{m(0.12):.2f} {m(aw) / 6:.2f},0' for _ in range(6)) + f'" fill="none" stroke="{col}" stroke-width="0.08"/>'
    def door(cx, yb, dw=1.0, dh=2.2, col='#74362D', op=0.5): return _r(cx - m(dw) / 2, yb - m(dh), m(dw), m(dh), col, op, LINEC, 0.04)
    def garage(cx, yb, dw=2.5, dh=2.2, col='#D3CFC2', op=1.0): xg = cx - m(dw) / 2; return _r(xg, yb - m(dh), m(dw), m(dh), '#FFFFFF') + _r(xg, yb - m(dh), m(dw), m(dh), col, op, LINEC, 0.04) + ''.join(_l(xg, yb - m(j * 0.3), xg + m(dw), yb - m(j * 0.3), LINEC, 0.025) for j in range(1, int(dh / 0.3) + 1))
    def wall(col, op=1.0, fill2=None):
        q = [_r(x0, top, w, lv * fh, '#FFFFFF'), _r(x0, top, w, lv * fh, col, op, None, 0.05, f' filter="url(#grain-{rid})"' if rid else '')]
        if fill2: q.append(_r(x0, top, w, lv * fh, fill2))
        return ''.join(q)
    def tile_roof(h=1.1, over=0.3):   # a clay-tile roof seen from the street: the tiled slope as a band, the ridge on top
        nonlocal sil; ya = top - m(h); xa, xb = x0 - m(over), x1 + m(over)
        sil = [(x0, yg), (x0, top), (xa, top), (xa + m(0.5), ya), (xb - m(0.5), ya), (xb, top), (x1, top), (x1, yg)]
        return (f'<polygon points="{xa:.2f},{top:.2f} {xa + m(0.5):.2f},{ya:.2f} {xb - m(0.5):.2f},{ya:.2f} {xb:.2f},{top:.2f}" fill="#C98B80" fill-opacity="0.8" stroke="{LINEC}" stroke-width="0.05"/>'
                + (f'<polygon points="{xa:.2f},{top:.2f} {xa + m(0.5):.2f},{ya:.2f} {xb - m(0.5):.2f},{ya:.2f} {xb:.2f},{top:.2f}" fill="{pat("tile")}"/>' if rid else '') + _l(xa, top, xb, top, LINEC, 0.1))
    def flat_roof(parapet=0.0, railing=False, cap=None):
        nonlocal sil; q = []
        if parapet: q.append(_r(x0, top - m(parapet), w, m(parapet), cap or '#F6F5F0', 1, LINEC, 0.05)); sil = [(x0, yg), (x0, top - m(parapet)), (x1, top - m(parapet)), (x1, yg)]
        if railing: q.append(_l(x0, top - m(parapet + 0.9), x1, top - m(parapet + 0.9), LINEC, 0.04) + ''.join(_l(x0 + m(j * 1.2), top - m(parapet + 0.9), x0 + m(j * 1.2), top - m(parapet), LINEC, 0.03) for j in range(int(w / m(1.2)) + 1)))
        q.append(_l(x0 - m(0.1), top - m(parapet), x1 + m(0.1), top - m(parapet), LINEC, 0.1)); return ''.join(q)
    def stairhead(xc, hw=1.6, hh=2.4): return _r(xc - m(hw), top - m(hh), m(2 * hw), m(hh), '#F6F5F0', 1, LINEC, 0.04) + _r(xc - m(0.35), top - m(hh) + m(0.5), m(0.7), m(0.9), GLASS, 0.4, LINEC, 0.03)
    floors = lambda col=LINEC, op=0.35: ''.join(_l(x0, yg - f * fh, x1, yg - f * fh, col, 0.05, op) for f in range(1, lv))
    bays = lambda bay: max(1, int(round(w / m(bay))))
    # ---- the families ----
    if w < m(2.2):   # a sliver of a building: a wall and one opening
        o.append(wall('#E5E3DA')); o += [win((x0 + x1) / 2, yg - f * fh, min(0.9, w / MM * 0.5), 1.2) for f in range(lv)]
    elif obs:   # ---- from the Catastro's façade photo of this parcel ----
        WALL = {'white': ('#F6F5F0', 1, None), 'cream': ('#EFEEE7', 1, None), 'yellow': ('#D6CDA6', 0.55, None), 'sand': ('#D6CDA6', 0.9, None), 'grey': ('#D3CFC2', 1, None), 'ochre': ('#BFB065', 0.8, None),
                'brick_tan': ('#A49250', 0.5, 'brick'), 'brick_yellow': ('#BFB065', 0.55, 'brick'), 'brick_red': ('#74362D', 0.55, 'brick'), 'brick_ochre': ('#BFB065', 0.9, 'brick'), 'stone_white': ('#EFEEE7', 1, 'brick'),
                'stone_grey': ('#BDB5AA', 1, 'rubble'), 'stone_dark': ('#4D3D37', 0.8, 'rubble'), 'tile_dark': ('#29100C', 0.78, None)}
        DADO = {'tile_rose': ('#EBD9D3', 1, 'diamond'), 'tile_terracotta': ('#C98B80', 0.9, 'diamond'), 'tile_grey': ('#D3CFC2', 1, 'diamond'), 'stone_dark': ('#4D3D37', 0.8, 'rubble'), 'stone_pale': ('#E5E3DA', 1, 'rubble'),
                'stone_grey': ('#BDB5AA', 1, 'rubble'), 'paint_grey': ('#9DBCD1', 0.55, None)}
        AWN = {'green': '#7E7B43', 'striped_green': '#7E7B43', 'yellow': '#BFB065', 'teal': '#4F6E80'}; DOOR = {'green': ('#53461C', 0.65), 'wood': ('#74362D', 0.55)}
        GAR = {'white': ('#F6F5F0', 1), 'grey': ('#BDB5AA', 1), 'yellow': ('#BFB065', 0.9), 'brown': ('#74362D', 0.7), 'blue': ('#9DBCD1', 0.9)}; TRIM = {'ochre': '#BFB065', 'brown': '#74362D', 'terracotta': '#C98B80'}
        def mat(xa, ya, wa, ha, spec):
            c, op, pt = spec; q = _r(xa, ya, wa, ha, '#FFFFFF') + _r(xa, ya, wa, ha, c, op, None, 0.05, f' filter="url(#grain-{rid})"' if rid and not pt else '')
            return q + (_r(xa, ya, wa, ha, pat(pt)) if pt and rid else '')
        o.append(mat(x0, top, w, lv * fh, WALL[obs.get('wall', 'white')]))
        if obs.get('ground_wall'): o.append(mat(x0, yg - fh, w, fh, WALL[obs['ground_wall']]))
        elif obs.get('dado'): o.append(mat(x0, yg - m(1.0), w, m(1.0), DADO[obs['dado']]) + _l(x0, yg - m(1.0), x1, yg - m(1.0), '#74362D' if obs['dado'].startswith('tile') else LINEC, 0.06))
        tr = TRIM.get(obs.get('trim'))
        if tr: o.append(_r(x0, top, w, m(0.3), tr, 0.75))                                                     # the band under the eave
        if not obs.get('blank'):
            n = bays(3.3); dk = seed % n; gk = (dk + 1) % n if (obs.get('garage') or obs.get('shop')) and n > 1 else -1; bal = obs.get('balcony'); shut = ('#53461C', 0.9) if obs.get('shutters') == 'green' else None
            for f in range(lv):
                yb = yg - f * fh
                for k in range(n):
                    cx = x0 + w / n * (k + 0.5); bw = w / n / MM
                    if f == 0 and obs.get('shop'):       # shops: roller shutters between piers, a dark fascia
                        o.append(garage(cx, yb, bw - 0.6, 2.5, *GAR[obs['shop']])); continue
                    if f == 0 and obs.get('passage') and k == dk and bw > 2.8: o.append(_r(cx - m(1.4), yb - m(2.8), m(2.8), m(2.8), '#29100C', 0.55)); continue
                    if f == 0 and k == dk: o.append(door(cx, yb, 1.0, 2.2, *DOOR.get(obs.get('door'), ('#4D3D37', 0.5))) + (_r(cx - m(0.62), yb - m(2.32), m(1.24), m(2.32), 'none', 1, tr, 0.12) if tr else '')); continue
                    if f == 0 and k == gk: o.append(garage(cx, yb, min(2.6, bw - 0.5), 2.3, *GAR[obs['garage']])); continue
                    if tr: o.append(_r(cx - m(0.72), yb - m(2.42), m(1.44), m(1.64) if not (bal and f) else m(2.42), tr, 0.6))
                    if f > 0 and bal:
                        o.append(win(cx, yb, 1.1, 2.1, 0.0, 0.5, box='#D3CFC2', shutter=shut and (shut[0], 0.9)))
                        o.append(rail(cx, yb, min(2.2, bw - 0.4), 'solid' if bal == 'balustrade' else 'bars', '#F6F5F0'))
                        if bal == 'balustrade': o.append(''.join(_l(cx - m(min(2.2, bw - 0.4)) / 2 + m(j * 0.22), yb - m(0.85), cx - m(min(2.2, bw - 0.4)) / 2 + m(j * 0.22), yb - m(0.1), LINEC, 0.05) for j in range(1, int(min(2.2, bw - 0.4) / 0.22))))
                        if bal == 'iron': o.append(_r(cx - m(min(2.2, bw - 0.4)) / 2, yb - m(1.0), m(min(2.2, bw - 0.4)), m(1.0), 'none', 1, '#4D3D37', 0.06))
                    else:
                        o.append(win(cx, yb, 1.1, 1.3, 0.95, 0.5, box=None if shut else '#D3CFC2', shutter=shut and (shut[0], 1.0) if shut and (k + f + seed) % 2 else None, grille=(f == 0) or bool(obs.get('bars'))))
                    if obs.get('awning') and (f > 0 or lv == 1) and (obs['awning'] == 'striped_green' or (k + f + seed) % 3 != 2): o.append(awning(cx, yb - m(2.55), min(2.4, bw - 0.3) if bal and f else 1.6, AWN[obs['awning']]))
            if obs.get('shop'): o.append(_r(x0, yg - m(3.0), w, m(0.45), '#4D3D37', 0.75))
        elif obs.get('garage'): o.append(garage(x0 + w * 0.6, yg, min(3.0, w / MM * 0.5), 2.4, *GAR[obs['garage']]))
        if obs.get('roof') == 'tile': o.append(tile_roof(1.0, 0.35))
        else: o.append(flat_roof(0.4))
        if obs.get('tower') and lv >= 4 and w > m(5):   # the corner tower: its own small tiled roof
            xt = x0 if seed % 2 else x1 - m(5); o.append(f'<polygon points="{xt - m(0.4):.2f},{top:.2f} {xt + m(2.5):.2f},{top - m(1.6):.2f} {xt + m(5.4):.2f},{top:.2f}" fill="#C98B80" fill-opacity="0.85" stroke="{LINEC}" stroke-width="0.05"/>'); more.append([(xt - m(0.4), top), (xt + m(2.5), top - m(1.6)), (xt + m(5.4), top)])
        if obs.get('chimney') and w > m(4): o.append(_r(x0 + w * 0.7, top - m(2.0), m(0.5), m(1.1), '#F6F5F0', 1, LINEC, 0.04))
        if obs.get('garden') and w > m(4):   # what stands in front of the house: the garden wall or fence, its gate, a hedge
            stone = obs['garden'] == 'stone_fence'; hw = 1.0 if stone else 1.5
            o.append(mat(x0, yg - m(hw), w, m(hw), WALL['stone_grey'] if stone else WALL['white']) + _l(x0, yg - m(hw), x1, yg - m(hw), LINEC, 0.06))
            if stone: o.append(_r(x0, yg - m(1.9), w, m(0.9), 'none', 1, LINEC, 0.04) + ''.join(_l(x0 + m(j * 0.25), yg - m(1.9), x0 + m(j * 0.25), yg - m(1.0), '#FFFFFF', 0.06) for j in range(1, int(w / m(0.25)))))
            gx = x0 + w * (0.25 + 0.4 * (seed % 2)); o.append(_r(gx - m(1.4), yg - m(1.8), m(2.8), m(1.8), '#29100C', 0.7) + ''.join(_l(gx - m(1.4) + m(j * 0.2), yg - m(1.8), gx - m(1.4) + m(j * 0.2), yg, '#FFFFFF', 0.03, 0.4) for j in range(1, 14)))
            for j in range(int(w / m(1.1))):    # the hedge and the garden's green behind the wall
                hx = x0 + m(0.6 + j * 1.1)
                if abs(hx - gx) > m(2.0): o.append(f'<ellipse cx="{hx:.2f}" cy="{yg - m(hw + 0.5 + 0.3 * ((j + seed) % 3)):.2f}" rx="{m(0.85):.2f}" ry="{m(0.9):.2f}" fill="{OLIVE if (j + seed) % 2 else "#53461C"}" fill-opacity="0.6"/>')
    elif st == 'greenhouse':
        o.append(wall('#EFEEE7', 0.6)); o += [_l(x0 + k * m(1.5), top, x0 + k * m(1.5), yg, GLASS, 0.08) for k in range(1, int(w / m(1.5)) + 1)]
    elif st == 'shed':   # metal cladding, a low gable to the street, a big door, a strip of glazing (the HEIGHT of sheds is not derived from floors: see 'hu')
        pk = min(1.6, w / MM * 0.08); xc = (x0 + x1) / 2; sil = [(x0, yg), (x0, top), (xc, top - m(pk)), (x1, top), (x1, yg)]
        o.append(f'<polygon points="{x0:.2f},{yg:.2f} {x0:.2f},{top:.2f} {xc:.2f},{top - m(pk):.2f} {x1:.2f},{top:.2f} {x1:.2f},{yg:.2f}" fill="{["#D3CFC2", "#BDB5AA", "#E5E3DA"][seed % 3]}" stroke="{LINEC}" stroke-width="0.06"/>')
        if rid: o.append(f'<polygon points="{x0:.2f},{yg:.2f} {x0:.2f},{top:.2f} {xc:.2f},{top - m(pk):.2f} {x1:.2f},{top:.2f} {x1:.2f},{yg:.2f}" fill="{pat("rib")}"/>')
        dw = min(4.0, w / MM * 0.35); dh = min(lv * 3 * 0.75, 4.2); o.append(garage(x0 + w * (0.3 + 0.4 * (seed % 2)), yg, dw, dh))
        o.append(_r(x0 + m(0.6), top + m(0.5), w - m(1.2), m(0.7), GLASS, 0.4, LINEC, 0.04)); o.append(_r(x0, yg - m(0.9), w, m(0.9), '#8C817A', 0.25))
    elif st == 'public':   # bands of glazing, an accent band, a canopy at the door
        o.append(wall('#F6F5F0')); acc = ['#4F6E80', '#7E7B43', '#C98B80'][seed % 3]
        for f in range(lv):
            yb = yg - f * fh; o.append(_r(x0 + m(0.8), yb - m(2.4), w - m(1.6), m(1.4), '#A9C0CB', 0.4, LINEC, 0.04)); o += [_l(x0 + m(0.8) + k * m(1.5), yb - m(2.4), x0 + m(0.8) + k * m(1.5), yb - m(1.0), LINEC, 0.03) for k in range(1, int((w - m(1.6)) / m(1.5)) + 1)]
        o.append(_r(x0, top, w, m(0.5), acc, 0.5)); xd = x0 + w * (0.25 + 0.5 * (seed % 2)); o.append(door(xd, yg, 1.8, 2.3, '#4D3D37', 0.35) + _r(xd - m(2.0), yg - m(2.7), m(4.0), m(0.15), '#F6F5F0', 1, LINEC, 0.04)); o.append(flat_roof(0.3)); o.append(floors())
    elif st == 'shop':
        o.append(wall('#E4E5D3')); o.append(_r(x0 + m(0.4), yg - m(2.6), w - m(0.8), m(2.3), GLASS, 0.45, LINEC, 0.04) + _r(x0, yg - m(3.0), w, m(0.4), '#C98B80', 0.7))
        n = bays(3.2); o += [win(x0 + w / n * (k + 0.5), yg - f * fh, 1.3, 1.3) for f in range(1, lv) for k in range(n)]; o.append(flat_roof(0.4)); o.append(floors())
    elif st == 'trad':   # before 1965, one or two floors: whitewash, a painted plinth, tall windows with iron grilles, a wooden door, clay tiles
        o.append(wall('#F6F5F0')); o.append(_r(x0, yg - m(0.9), w, m(0.9), ['#D6CDA6', '#BDB5AA', '#C9D8DF'][seed % 3], 0.75)); n = bays(rnd.choice([3.2, 3.6, 4.0])); dk = seed % n
        for f in range(lv):
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); yb = yg - f * fh
                if f == 0 and k == dk: o.append(door(cx, yb, 1.2, 2.4, '#74362D', 0.55) + _l(cx, yb - m(2.4), cx, yb, LINEC, 0.03))
                elif f == 0: o.append(win(cx, yb, 0.9, 1.5, 0.8, 0.45, grille=True))
                else: o.append(win(cx, yb, 0.9, 1.9, 0.1, 0.45) + rail(cx, yb, 1.3))   # a balcón: a French window with an iron railing
        o.append(tile_roof(1.0 + 0.2 * (seed % 2)));
        if seed % 3 == 0: o.append(_r(x0 + w * 0.7, top - m(1.9), m(0.5), m(1.0), '#F6F5F0', 1, LINEC, 0.04))   # a chimney
    elif st == 'house':   # 1965–1989, one or two floors: coloured render, a flat roof terrace, a garage door
        o.append(wall(['#EBD9D3', '#E4E5D3', '#E5E3DA', '#D6CDA6'][seed % 4], 0.9)); n = bays(3.4); dk = seed % n; gk = (dk + 1) % n if w > m(7) else -1
        for f in range(lv):
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); yb = yg - f * fh
                if f == 0 and k == dk: o.append(door(cx, yb, 1.0, 2.2, '#4D3D37', 0.45))
                elif f == 0 and k == gk: o.append(garage(cx, yb))
                else: o.append(win(cx, yb, 1.2, 1.2, 0.9, 0.5, box='#D3CFC2', shutter=('#7E7B43', 0.45) if (k + f + seed) % 3 == 0 else None))
        o.append(_r(x0, yg - m(0.6), w, m(0.6), '#8C817A', 0.2)); o.append(flat_roof(0.9 if seed % 2 else 0.3, railing=seed % 2 == 0)); o.append(floors())
    elif st == 'villa':  # since 1990, one or two floors: light render, a porch, wide windows, a tiled roof
        o.append(wall(['#EFEEE7', '#E5E3DA', '#F5EAE6'][seed % 3])); n = bays(4.0); pk = seed % n
        for k in range(n):
            cx = x0 + w / n * (k + 0.5)
            if k == pk: o.append(_r(cx - m(1.6), yg - m(2.6), m(3.2), m(2.6), '#29100C', 0.1) + door(cx, yg, 1.0, 2.2, '#4D3D37', 0.45) + _l(cx - m(1.6), yg - m(2.6), cx - m(1.6), yg, LINEC, 0.1) + _l(cx + m(1.6), yg - m(2.6), cx + m(1.6), yg, LINEC, 0.1))
            else: o.append(win(cx, yg, 1.6, 1.3, 0.9, 0.5))
            if lv > 1: o.append(win(cx, yg - fh, 1.5, 2.0, 0.1, 0.5) + rail(cx, yg - fh, 2.2, 'glass' if seed % 2 else 'bars'))
        o.append(tile_roof(0.9, 0.5)); o.append(floors(op=0.25))
    elif st == 'brick':  # blocks before 1982: exposed brick, concrete floor edges, solid balcony fronts, roller-shutter boxes
        o.append(wall(['#E6CBC3', '#EBD9D3', '#C98B80'][seed % 3], [1, 1, 0.55][seed % 3], pat('brick'))); n = bays(rnd.choice([2.9, 3.1, 3.3])); dk = seed % n
        o.append(''.join(_r(x0, yg - f * fh - m(0.12), w, m(0.24), '#EFEEE7', 1, LINEC, 0.02) for f in range(1, lv)))
        for f in range(lv):
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); yb = yg - f * fh
                if f == 0: o.append(door(cx, yb, 1.3, 2.3, '#4D3D37', 0.4) if k == dk else garage(cx, yb, min(2.4, w / n / MM - 0.5), 2.4) if (k + seed) % 2 == 0 else win(cx, yb, 1.2, 1.2, 1.0, 0.45, grille=True))
                elif (k + seed) % 2 == 0: o.append(win(cx, yb, 1.4, 2.1, 0.0, 0.45, box='#D3CFC2') + rail(cx, yb, min(2.6, w / n / MM - 0.2), 'solid', '#F6F5F0'))
                else: o.append(win(cx, yb, 1.2, 1.2, 1.0, 0.45, box='#D3CFC2', shutter=('#BDB5AA', 0.5) if (k * 3 + f + seed) % 4 == 0 else None))
        o.append(_r(x0, yg - m(2.7), w, m(2.7), '#8C817A', 0.12)); o.append(flat_roof(0.5)); o.append(stairhead(x0 + w * (0.3 + 0.4 * (seed % 2))) if w > m(8) else '')
    elif st == 'render':  # blocks of 1982–1999: ochre or rose render, a stair bay in glass, railings, a tiled eave
        o.append(wall(['#D6CDA6', '#EBD9D3', '#E4E5D3'][seed % 3], 0.85)); n = bays(3.2); sk = seed % n
        for k in range(n):
            cx = x0 + w / n * (k + 0.5)
            if k == sk:   # the staircase: a tall strip of glazing, the door under it
                o.append(_r(cx - m(0.6), top + m(0.8), m(1.2), lv * fh - m(3.6), GLASS, 0.4, LINEC, 0.04) + ''.join(_l(cx - m(0.6), yg - f * fh - m(1.5), cx + m(0.6), yg - f * fh - m(1.5), LINEC, 0.03) for f in range(1, lv)) + door(cx, yg, 1.3, 2.3, '#4D3D37', 0.4)); continue
            for f in range(lv):
                yb = yg - f * fh
                if f == 0: o.append(win(cx, yb, 1.2, 1.2, 1.0, 0.45, grille=True)); continue
                o.append(win(cx, yb, 1.3, 2.1, 0.0, 0.45, shutter=('#7E7B43', 0.35) if (k + f + seed) % 3 == 0 else None) + rail(cx, yb, 2.0) if (k + f) % 2 == seed % 2 else win(cx, yb, 1.2, 1.3, 0.9, 0.45, shutter=('#7E7B43', 0.4) if (k * 2 + f + seed) % 5 == 0 else None))
        o.append(_r(x0, yg - m(1.0), w, m(1.0), '#8C817A', 0.18)); o.append(_r(x0 - m(0.3), top - m(0.35), w + m(0.6), m(0.35), '#C98B80', 0.8, LINEC, 0.04)); o.append(floors())
        sil = [(x0, yg), (x0, top), (x0 - m(0.3), top), (x0 - m(0.3), top - m(0.35)), (x1 + m(0.3), top - m(0.35)), (x1 + m(0.3), top), (x1, top), (x1, yg)]
    elif st == 'boom':   # blocks of 2000–2009: cream render with brick-coloured panels, glazed bays (miradores), a stone-clad base
        o.append(wall('#E5E3DA')); n = bays(3.4); dk = seed % n
        for k in range(n):
            cx = x0 + w / n * (k + 0.5); bw = w / n
            if (k + seed) % 3 == 0 and lv > 2:   # a mirador over the upper floors
                o.append(_r(cx - m(1.1), top + m(0.4), m(2.2), (lv - 1) * fh - m(0.4), '#A9C0CB', 0.4, LINEC, 0.05) + ''.join(_l(cx - m(1.1), yg - f * fh, cx + m(1.1), yg - f * fh, LINEC, 0.06) for f in range(1, lv)) + _l(cx, top + m(0.4), cx, yg - fh, LINEC, 0.03))
            else:
                if (k + seed) % 2: o.append(_r(cx - bw * 0.42, top + m(0.3), bw * 0.84, (lv - 1) * fh - m(0.3), '#C98B80', 0.55))
                o += [win(cx, yg - f * fh, 1.3, 2.0, 0.1, 0.5) + rail(cx, yg - f * fh, 1.6) for f in range(1, lv)]
            o.append(door(cx, yg, 1.4, 2.4, '#4D3D37', 0.4) if k == dk else win(cx, yg, 1.6, 1.6, 0.8, 0.45))
        o.append(_r(x0, yg - fh, w, fh, '#D3CFC2', 0.45) + ''.join(_l(x0, yg - m(j * 0.6), x1, yg - m(j * 0.6), LINEC, 0.025) for j in range(1, 5))); o.append(flat_roof(0.6)); o.append(floors(op=0.25)); o.append(stairhead(x0 + w * 0.5) if w > m(9) else '')
    elif st == 'new':    # blocks since 2010: white render, wide windows, timber-slat panels that shift from floor to floor, glass balustrades
        o.append(wall('#F6F5F0')); n = bays(4.2)
        for f in range(lv):
            yb = yg - f * fh
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); sd = 1 if (k + f + seed) % 2 else -1
                if f == 0: o.append(_r(cx - m(1.7), yb - m(2.6), m(3.4), m(2.6), '#29100C', 0.12)); continue
                o.append(win(cx - sd * m(0.5), yb, 2.0, 1.9, 0.2, 0.5, frame='#6F625B') + _r(cx + sd * m(1.1) - m(0.45), yb - m(2.6), m(0.9), m(2.4), '#D6CDA6', 1, LINEC, 0.03) + (_r(cx + sd * m(1.1) - m(0.45), yb - m(2.6), m(0.9), m(2.4), pat('slat')) if rid else ''))
                if (k + f) % 2 == seed % 2: o.append(rail(cx - sd * m(0.5), yb, 2.6, 'glass'))
        o.append(door(x0 + w / n * (seed % n + 0.5), yg, 1.4, 2.4, '#4D3D37', 0.4)); o.append(flat_roof(0.4)); o.append(floors(op=0.3))
    else:                # no year on record: a plain cream wall and plain windows, no period features
        o.append(wall('#E5E3DA')); n = bays(3.2); dk = seed % n
        o += [door(x0 + w / n * (k + 0.5), yg) if f == 0 and k == dk else win(x0 + w / n * (k + 0.5), yg - f * fh, 1.2, 1.3) for f in range(lv) for k in range(n)]; o.append(flat_roof(0.3)); o.append(floors())
    if rid and st not in ('greenhouse',): o.append(_r(x1 - min(w * 0.18, m(1.6)), top, min(w * 0.18, m(1.6)), lv * fh, f'url(#shade-{rid})'))   # light from the left
    if st != 'shed': o.append(_r(x0, top, w, lv * fh, 'none', 1, LINEC, 0.07))
    return ''.join(str(q) for q in o), [sil] + more


_FAC = None


def facades():
    """what was read from the Catastro's façade photos, by parcel (data/ex21/facades.json; tools/build_ex21_facades.py)"""
    global _FAC
    if _FAC is None:
        f = os.path.join(ROOT, 'data/ex21/facades.json'); _FAC = json.load(open(f))['parcels'] if os.path.exists(f) else {}
    return _FAC


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
    s = a['section']; sm = s['samples']; L = sm[-1][0]; fa = s.get('fence_at_m'); ax, ay = s['a']; bx, by = s['b']
    ux, uy = (bx - ax) / L, (by - ay) / L; vx, vy = -uy, ux; line = LineString([(ax, ay), (bx, by)])
    # the factory set (tools/build_ex21_factory.py) has no height-limit surface (limit = None) and no fence (fence_at_m = None)
    has_lim = any(p[2] is not None for p in sm)
    if not has_lim: sm = [[p[0], p[1], 1e9] for p in sm]
    # true 1:500 up to 22 m above the highest ground; above that a compressed band (12 mm) with a break, so the street
    # life stays large and the limit line stays visible at its real (written) height
    if has_lim:
        zmin = min(p[1] for p in sm) - 5; zb = max(p[1] for p in sm) + 22; zlim = max(p[2] for p in sm if p[2] < 1e9)
        zmax = max(zb, zlim + 3); BAND = 12.0 if zlim > zb else 0.0
    else:
        tall = max([c['h_est'] for c in s['cuts'] if c.get('h_est')] + [b['lv'] * 3.0 for b in a['buildings'] if b.get('lv') and not b.get('hu')] + [8.0])
        zmin = min(p[1] for p in sm) - 5; zb = max(p[1] for p in sm) + max(14.0, tall + 5.0); zlim = zb; zmax = zb; BAND = 0.0
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
         f'<g id="forbidden-sky-{a["id"]}"><polygon points="{X(0):.2f},{oy + top:.2f} {P(lpts)} {X(L):.2f},{oy + top:.2f}" fill="{SKY}" fill-opacity="{0.45 * SKY_K:.3f}"/><polygon points="{X(0):.2f},{oy + top:.2f} {P(lpts)} {X(L):.2f},{oy + top:.2f}" fill="url(#hatch-{a["id"]})"/></g>' if has_lim else '',  # the sky goes on above the limit too (owner, 17 Nov), hatched where building is forbidden
         f'<g id="allowed-envelope-{a["id"]}"><polygon points="{P(lpts)} {P(reversed(gpts))}" fill="url(#skyg-{a["id"]})"/></g>' if has_lim else
         f'<g id="sky-{a["id"]}"><polygon points="{X(0):.2f},{oy + top:.2f} {X(L):.2f},{oy + top:.2f} {P(reversed(gpts))}" fill="url(#skyg-{a["id"]})"/></g>']
    o.insert(1, rich_defs(a['id']))
    # buildings behind the plane (≤ 40 m), light outlines with floor lines
    def behind(sign):
        out = []
        for b in a['buildings']:
            if not b['lv']: continue
            st = [proj(p) for rr in b['r'] for r in rr for p in r]; ts = [sign * t for _, t in st]
            if 0.5 < min(ts) < 180:
                s0, s1 = max(0, min(q for q, _ in st)), min(L, max(q for q, _ in st))
                if s1 - s0 > 0.5: out.append((min(ts), s0, s1, b['lv'], ('?' if b.get('hu') else '') + (b.get('b') or 'yes'), b.get('y'), b.get('ref')))
        return out
    sign = max((1, -1), key=lambda sg: sum(q[2] - q[1] for q in behind(sg))); back = behind(sign)
    # tree crowns read from the PNOA orthophoto (tools/build_ex21_canopy.py): those on the section plane stand in front,
    # those behind it (≤ 40 m) are drawn faded among the façades. Heights are NOT measured: schematic, from the crown
    # width, and always kept under the limit surface.
    def th(d, dm, k):
        room = sm[max(0, min(len(sm) - 1, int(round(d))))][2] - g_at(d) - 1.5
        return max(3.0, min(1.3 * dm + 2.0 + (k % 3) * 0.6, 10.0, room / 1.1))  # (no limit surface: room is huge, the crown rule decides)
    near, far = [], []
    for k, (cx, cy, dm) in enumerate(a.get('canopy', [])):
        q, t = proj((cx, cy))
        if not (1 < q < L - 1): continue
        if abs(t) <= dm / 2 + 1.5: near.append((q, dm, k))
        elif 0 < sign * t < 100: far.append((sign * t, q, dm, k))
    items = [(t, 'b', (s0, s1, lv, bt, yr, rf)) for t, s0, s1, lv, bt, yr, rf in back] + [(t, 't', (q, dm, k)) for t, q, dm, k in far]
    eo = [f'<g id="elevation-behind-{a["id"]}">']
    misted = False
    for i, (t, kind, v) in enumerate(sorted(items, key=lambda q: -q[0])):
        if t < 100 and not misted:   # a band of mist between the far city and the near street (owner's references: soft, blended)
            misted = True; gy0 = max(Z(p[1]) for p in sm[:1]) if sm else 0
            eo.append(f'<rect x="{X(0):.2f}" y="{Z(min(p[1] for p in sm) + 14):.2f}" width="{X(L) - X(0):.2f}" height="{14 * MM:.2f}" fill="url(#fog-{a["id"]})"/>')
        op = max(0.4, 0.9 - t / 160)   # (behind the plane: pale and light, paler with distance — owner, 19 Nov)
        if kind == 'b' and t >= 100:   # far behind: a silhouette only, paler with distance (real footprints and floors; no façade)
            s0, s1, lv, bt, yr, rf = v; g = g_at((s0 + s1) / 2); hgt = 6 if bt.startswith('?') else int(lv) * 3
            fo = max(0.35, 0.85 - (t - 100) / 120); xa, xb, ya = X(s0), X(s1), Z(g + hgt)
            grid = ''.join(f'<rect x="{xa + (k2 + 0.3) * 2.6 * MM:.2f}" y="{Z(g + f2 * 3 + 2.2):.2f}" width="{1.0 * MM:.2f}" height="{1.2 * MM:.2f}" fill="#BDB5AA" fill-opacity="0.35"/>' for f2 in range(hgt // 3) for k2 in range(int((xb - xa) / (2.6 * MM))))
            eo.append(f'<g class="far-silhouette" opacity="{fo:.2f}"><rect x="{xa:.2f}" y="{ya:.2f}" width="{xb - xa:.2f}" height="{hgt * MM:.2f}" fill="#FFFFFF" stroke="#D3CFC2" stroke-width="0.06"/>{grid}</g>'); continue
        if kind == 'b':
            s0, s1, lv, bt, yr, rf = v; g = g_at((s0 + s1) / 2); ob = facades().get(rf)
            if bt.startswith('?'):  # a shed or a church behind the plane: its height is not measured — a dashed outline, no façade
                eo.append(f'<rect class="height-unknown" x="{X(s0):.2f}" y="{Z(g + 6):.2f}" width="{X(s1) - X(s0):.2f}" height="{6 * MM:.2f}" fill="#FFFFFF" fill-opacity="0.5" stroke="{PINK}" stroke-width="0.25" stroke-dasharray="1,1" opacity="{op:.2f}"/>'); continue
            # drawn solid (so a nearer building hides the ones behind it), then veiled in white by distance: pale and light, yet each one distinct
            fsvg, sils = facade(X(s0), X(s1), Z(g), int(lv), bt, int(s0 * 13 + s1 * 7 + (yr or 0)) % 997, a['id'], yr, ob)
            eo.append(f'<g class="elevation" data-style="{"photo" if ob else facade_style(bt, yr, int(lv))}" data-year="{yr or ""}" data-parcel="{rf or ""}">' + fsvg + ''.join(f'<polygon points="{" ".join(f"{px:.2f},{py:.2f}" for px, py in sil)}" fill="#FFFFFF" fill-opacity="{1 - op:.2f}"/>' for sil in sils) + '</g>')
        else:
            q, dm, k = v; eo.append(f'<g class="tree-behind" opacity="{op * 0.85:.2f}">' + tree(X(q), Z(g_at(q)), th(q, dm, k), seed=k) + '</g>')
    eo.append('</g>'); o += eo
    to = [f'<g id="trees-on-section-{a["id"]}">']
    for q, dm, k in sorted(near):
        to.append(f'<ellipse cx="{X(q) + 0.6 * MM:.2f}" cy="{Z(g_at(q)):.2f}" rx="{max(1.5, dm * 0.45) * MM:.2f}" ry="{0.35 * MM:.2f}" fill="{INK}" fill-opacity="0.08"/>')
        import random as _r; rr = _r.Random(k * 31 + 5)
        for j in range(18):   # undergrowth (schematic): small soft clumps
            sx = X(q) + rr.uniform(-1, 1) * max(2.0, dm * 0.6) * MM; sy = Z(g_at(q)); rad = rr.uniform(0.25, 0.7) * MM
            to.append(f'<circle cx="{sx:.2f}" cy="{sy - rad * 0.6:.2f}" r="{rad:.2f}" fill="{rr.choice([OLIVE, OLIVE2, "#BFB065", "#C98B80", "#A49250"])}" fill-opacity="{rr.uniform(0.25, 0.55):.2f}"/>')
        to.append(tree(X(q), Z(g_at(q)), th(q, dm, k), seed=k))
    to.append('</g>'); o += to
    # cut buildings: floors (3 m each), slabs in red, interiors light, people inside (schematic)
    bo = [f'<g id="buildings-cut-floors-{a["id"]}">']
    for i, c in enumerate(s['cuts']):
        g = min(g_at(c['s0']), g_at(c['s1'])); x0, x1 = X(c['s0']), X(c['s1'])
        if c.get('h_est') is None:
            bo.append(f'<rect x="{x0:.2f}" y="{Z(g + 6):.2f}" width="{x1 - x0:.2f}" height="{6 * MM:.2f}" fill="none" stroke="{PINK}" stroke-width="0.35" stroke-dasharray="1,1"/>'); continue
        lv = int(c['lv']); slab = 0.3 * MM; wall = 0.3 * MM   # one cut thickness everywhere (owner, 19 Nov)
        bo.append(f'<rect x="{x0:.2f}" y="{Z(g + lv * 3):.2f}" width="{x1 - x0:.2f}" height="{lv * 3 * MM:.2f}" fill="{INTERIOR}"/>')
        for f in range(lv + 1): bo.append(f'<rect x="{x0:.2f}" y="{Z(g + f * 3) - (slab if f else 0):.2f}" width="{x1 - x0:.2f}" height="{slab:.2f}" fill="{CUT}"/>')
        bo.append(f'<rect x="{x0:.2f}" y="{Z(g + lv * 3):.2f}" width="{wall:.2f}" height="{lv * 3 * MM:.2f}" fill="{CUT}"/><rect x="{x1 - wall:.2f}" y="{Z(g + lv * 3):.2f}" width="{wall:.2f}" height="{lv * 3 * MM:.2f}" fill="{CUT}"/>')
        for f in range(lv):  # window openings in the cut walls (schematic), blue glass
            for xw in (x0, x1 - wall):
                bo.append(f'<rect x="{xw:.2f}" y="{Z(g + f * 3 + 2.3):.2f}" width="{wall:.2f}" height="{1.4 * MM:.2f}" fill="{GLASS}"/>')
        bo.append(f'<rect x="{x0:.2f}" y="{Z(g + lv * 3 + 0.9):.2f}" width="{wall:.2f}" height="{0.9 * MM:.2f}" fill="{CUT}"/><rect x="{x1 - wall:.2f}" y="{Z(g + lv * 3 + 0.9):.2f}" width="{wall:.2f}" height="{0.9 * MM:.2f}" fill="{CUT}"/>')  # parapet, cut at the same thickness
        if x1 - x0 > 6 * MM:
            for f in range(min(lv, 3)): bo.append(fig(x0 + (x1 - x0) * (0.3 + 0.2 * ((f + i) % 3)), Z(g + f * 3) - 0.35 * MM, (f + i) % 4, PEOPLE[(f + i) % 4]))
    bo.append('</g>'); o += bo
    # cut ground: one earth colour all along; the base side marked by a light hatch (not by another colour)
    bside = [q for q in gpts if fa is not None and q[0] >= X(fa)]
    o.append(f'<defs><pattern id="basehatch-{a["id"]}" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#FFFFFF" stroke-width="0.25" stroke-opacity="0.6"/></pattern></defs>'
             f'<g id="ground-cut-{a["id"]}"><polygon points="{P(gpts)} {P((x, y + GCUT) for x, y in reversed(gpts))}" fill="{CUT}"/>'
             + (f'<polygon points="{P(bside)} {P((x, y + GCUT) for x, y in reversed(bside))}" fill="url(#basehatch-{a["id"]})"/>' if bside else '') +
             f'<polyline points="{P(gpts)}" fill="none" stroke="{CUT}" stroke-width="0.35"/></g>'
             f'<g id="soil-{a["id"]}"><polygon points="{P((x, y + GCUT) for x, y in gpts)} {P((x, y + GCUT + 4.9 * MM) for x, y in reversed(gpts))}" fill="url(#soil-{a["id"]})" filter="url(#grain-{a["id"]})"/>'
             f'<polygon points="{P((x, y + GCUT) for x, y in gpts)} {P((x, y + GCUT + 5.0 * MM) for x, y in reversed(gpts))}" fill="url(#soilfade-{a["id"]})"/></g>')
    # water courses crossed by the section (OSM): a blue channel cut into the ground (position from OSM; width and depth are not measured: schematic)
    wo = [f'<g id="water-{a["id"]}">']
    for q in s.get('water', []):
        d = q['d']; gy = Z(g_at(d)); hw = (2.4 if q.get('ww') == 'river' else 0.9) * MM; dp = (1.4 if q.get('ww') == 'river' else 0.6) * MM
        wo.append(f'<path d="M{X(d) - hw:.2f},{gy:.2f} Q{X(d)},{gy + 2 * dp:.2f} {X(d) + hw:.2f},{gy:.2f} Z" fill="#A9C0CB"/>')
    wo.append('</g>'); o += wo
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
                    if (fa is not None and d > fa - 1.5) or any(abs(d - u) < 5 for u in used): continue
                    used.append(d); gy = Z(g_at(d))
                    n = len(used)
                    if st['hw'] not in ('footway', 'path', 'pedestrian', 'steps', 'cycleway', 'track'):   # carriageway (width schematic, 7 m): asphalt and kerbs on the cut ground, a street light
                        hw2 = 3.5 * MM; eo.append(f'<rect class="asphalt-schematic" x="{X(d) - hw2:.2f}" y="{gy - 0.05:.2f}" width="{2 * hw2:.2f}" height="{0.35 * MM:.2f}" fill="{INK}" fill-opacity="0.85"/>'
                                                  f'<rect x="{X(d) - hw2 - 0.3 * MM:.2f}" y="{gy - 0.18 * MM:.2f}" width="{0.3 * MM:.2f}" height="{0.3 * MM:.2f}" fill="{STONE}" stroke="{INK}" stroke-width="0.04"/><rect x="{X(d) + hw2:.2f}" y="{gy - 0.18 * MM:.2f}" width="{0.3 * MM:.2f}" height="{0.3 * MM:.2f}" fill="{STONE}" stroke="{INK}" stroke-width="0.04"/>'
                                                  + ''.join(f'<line x1="{X(d) - hw2 * 0.15 + j * 0.9 * MM:.2f}" y1="{gy + 0.02:.2f}" x2="{X(d) - hw2 * 0.15 + j * 0.9 * MM + 0.5 * MM:.2f}" y2="{gy + 0.02:.2f}" stroke="#FFFFFF" stroke-width="0.08"/>' for j in range(1)))
                        if n % 2 == 0: eo.append(lamp(X(d) - hw2 - 0.8 * MM, gy, 1))
                    if st['hw'] in ('footway', 'path', 'pedestrian', 'steps', 'cycleway', 'living_street'):
                        eo.append(fig(X(d), gy, n % 4, PEOPLE[n % len(PEOPLE)]))
                        if n % 3 == 1: eo.append(bench(X(d) + 2.4 * MM, gy))
                    elif st['hw'] in ('service', 'track'): eo.append(fig(X(d) + 1.2 * MM, gy, 1, PEOPLE[(n + 2) % len(PEOPLE)]))
                    else: eo.append(car(X(d), gy, CARS[n % len(CARS)])); eo.append(fig(X(d) + 4.2 * MM, gy, (n + 1) % 4, PEOPLE[(n + 1) % len(PEOPLE)]))
    if fa is not None: eo.append(fig(X(fa) - 3.2 * MM, Z(g_at(fa - 3.2)), 0, INK))  # someone at the fence
    eo.append('</g>'); o += eo
    # the fence
    gf = g_at(fa) if fa is not None else 0.0
    if fa is not None:   # the fence, cut: a concrete footing (red, cut), the post, wire mesh seen running away from the plane, a barbed-wire arm (form schematic)
        xf, yf0 = X(fa), Z(gf); arm = 1 if (s['b'][0] - s['a'][0]) >= 0 else -1
        o.append(f'<g id="fence-{a["id"]}"><rect x="{xf - 0.35 * MM:.2f}" y="{yf0 - 0.3 * MM:.2f}" width="{0.7 * MM:.2f}" height="{0.9 * MM:.2f}" fill="{CUT}"/>'
                 f'<rect x="{xf - 3.0 * MM:.2f}" y="{Z(gf + 2.4):.2f}" width="{6.0 * MM:.2f}" height="{2.4 * MM:.2f}" fill="url(#mesh-{a["id"]})"/>'
                 + ''.join(f'<line x1="{xf + dx * MM:.2f}" y1="{yf0:.2f}" x2="{xf + dx * MM:.2f}" y2="{Z(gf + 2.4):.2f}" stroke="{INK}" stroke-width="0.12" stroke-opacity="0.6"/>' for dx in (-3.0, 3.0))
                 + f'<line x1="{xf:.2f}" y1="{yf0:.2f}" x2="{xf:.2f}" y2="{Z(gf + 2.5):.2f}" stroke="{INK}" stroke-width="0.45"/>'
                 f'<line x1="{xf:.2f}" y1="{Z(gf + 2.5):.2f}" x2="{xf + arm * 0.45 * MM:.2f}" y2="{Z(gf + 2.95):.2f}" stroke="{INK}" stroke-width="0.3"/>'
                 + ''.join(f'<circle cx="{xf + arm * q * 0.45 * MM:.2f}" cy="{Z(gf + 2.5 + q * 0.45):.2f}" r="0.16" fill="none" stroke="{INK}" stroke-width="0.08"/>' for q in (0.35, 0.7, 1.0)) + '</g>')
    # the limit, the allowed height — numbers only
    lf = sm[int(round(fa))][2] if fa is not None else 0.0
    if has_lim: o.append(f'<g id="limit-surface-{a["id"]}"><polyline points="{P(lpts)}" fill="none" stroke="{RED}" stroke-width="0.8"/>'
             f'<text x="{X(1.5):.2f}" y="{Z(sm[1][2]) - 1.4:.2f}" {FONT} font-size="3" font-weight="700" fill="{RED}">{sm[1][2]:.0f} m</text></g>')
    if has_lim and fa is not None: o.append(f'<g id="allowed-{a["id"]}"><line x1="{X(fa) - 2.5:.2f}" y1="{Z(gf):.2f}" x2="{X(fa) - 2.5:.2f}" y2="{Z(lf):.2f}" stroke="{RED}" stroke-width="0.35"/>'
             f'<polygon points="{X(fa) - 3.4:.2f},{Z(lf) + 1.8:.2f} {X(fa) - 2.5:.2f},{Z(lf):.2f} {X(fa) - 1.6:.2f},{Z(lf) + 1.8:.2f}" fill="{RED}"/>'
             f'<text x="{X(fa) - 4:.2f}" y="{min(Z(gf) - 8, (Z(gf) + Z(lf)) / 2):.2f}" {FONT} font-size="5" font-weight="700" text-anchor="end" fill="{RED}">{lf - gf:.0f} m</text></g>')
    if BAND:
        yb = Z(zb); zz = ''.join(f'{"M" if i == 0 else "L"}{X(0) + i * 3:.2f},{yb + (1.2 if i % 2 else -1.2):.2f} ' for i in range(int(W / 3) + 2))
        pass  # 17 Nov 2026 (owner): no zigzag break line; the band above 22 m stays compressed, the limit is written in metres
    o.append(f'<g id="letters-{a["id"]}"><text x="{X(0):.2f}" y="{Z(zmin) + 3.5:.2f}" {FONT} font-size="3.4" font-weight="700" fill="{INK}">{a["id"]}</text>'
             f'<text x="{X(L):.2f}" y="{Z(zmin) + 3.5:.2f}" {FONT} font-size="3.4" font-weight="700" text-anchor="end" fill="{INK}">{a["id"]}′</text></g>')
    sb = [f'<g id="scale-{a["id"]}">']; sx, sy = X(L) - 50 * MM, Z(zmin) + 7
    for i, (p0, p1) in enumerate([(0, 10), (10, 20), (20, 50)]):
        sb.append(f'<rect x="{sx + p0 * MM:.2f}" y="{sy:.2f}" width="{(p1 - p0) * MM:.2f}" height="1" fill="{INK if i % 2 == 0 else "#FFFFFF"}" stroke="{INK}" stroke-width="0.2"/>')
    for v in (0, 10, 20, 50): sb.append(f'<text x="{sx + v * MM:.2f}" y="{sy + 3.6:.2f}" {FONT} font-size="2" text-anchor="middle" fill="{INK}">{v}{" m" if v == 50 else ""}</text>')
    sb.append('</g>'); o += sb
    src = a['stats'].get('limit_file', '').replace('.kmz', '')
    note = (f'1:500 · ground IGN MDT25 · {escape(src)}, Ministerio de Defensa · buildings: D. G. del Catastro (floors × 3 m, estimate; dashed = shed or hall, height not measured) · water: OSM · trees: PNOA aerial (IGN), approx. · elevations behind the cut: floors, type and year from the Catastro; materials, colours, roofs and balconies from the façade photo the Catastro publishes for each parcel, where one exists (it shows the street front; the face drawn may be another side), otherwise typical of the period; openings schematic · people, cars, tree heights, channel shapes, street lights, fence form: schematic' if has_lim else
            '1:500 · ground: IGN MDT05 · buildings: D. G. del Catastro (floors × 3 m, estimate; dashed = shed or church, height not measured) · trees: PNOA aerial (IGN), approx. · people, cars, tree heights and façades (by use): schematic')
    o.append(f'<rect class="paper-grain" x="{X(0):.2f}" y="{oy:.2f}" width="{X(L) - X(0):.2f}" height="{Z(zmin) - oy:.2f}" fill="#E5E3DA" fill-opacity="0.08" filter="url(#grain-{a["id"]})" style="mix-blend-mode:multiply"/>')
    o.append(f'<g id="sources-{a["id"]}" opacity="0.9"><text x="{X(0):.2f}" y="{Z(zmin) + 12:.2f}" {FONT} font-size="1.8" fill="{INK3}">{note}</text></g>')
    o.append('</g>')
    return '\n'.join(o), W, H


def wrap(body, W, H):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="{W:.1f}mm" height="{H:.1f}mm" viewBox="0 0 {W:.2f} {H:.2f}">\n'
            f'<rect id="paper" x="0" y="0" width="{W:.2f}" height="{H:.2f}" fill="#FFFFFF"/>\n{body}\n</svg>\n')


def main():
    d = json.load(open(os.environ.get('AREAS', os.path.join(ROOT, 'data/ex21/areas.json')))); os.makedirs(OUT, exist_ok=True); pad = 10.0
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
