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


def wrap(body, W, H):
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="{W:.1f}mm" height="{H:.1f}mm" viewBox="0 0 {W:.2f} {H:.2f}">\n'
            f'<rect id="paper" x="0" y="0" width="{W:.2f}" height="{H:.2f}" fill="#FFFFFF"/>\n{body}\n</svg>\n')


def main():
    d = json.load(open(os.path.join(ROOT, 'data/ex21/areas.json'))); os.makedirs(OUT, exist_ok=True); pad = 10.0
    parts, y, Wmax = [], pad, 0.0
    for a in d['areas']:
        body, W, H = section_svg(a, pad, pad)
        open(os.path.join(OUT, f'section_{a["id"]}.svg'), 'w').write(wrap(body, W + 2 * pad, H + 2 * pad))
        b2, W2, H2 = section_svg(a, pad, y); parts.append(b2); y += H2 + 12; Wmax = max(Wmax, W2)
        print(f'section_{a["id"]}.svg  {W + 2 * pad:.0f} × {H + 2 * pad:.0f} mm')
    open(os.path.join(OUT, 'sections_all.svg'), 'w').write(wrap('\n'.join(parts), Wmax + 2 * pad, y + pad))
    print(f'sections_all.svg  {Wmax + 2 * pad:.0f} × {y + pad:.0f} mm  → {OUT}')


if __name__ == '__main__':
    main()
