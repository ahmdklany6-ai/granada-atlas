"""Exercise 2.2 print sheets — the parts every sheet shares, so the three interest groups' drawings stay in ONE frame and ONE
line family (brief: "all plans in the same frame and the same family of lines"):
  the palette (read from js/palette.js through node: the analysis style, black / greys / white and the studio red #992B2A),
  the line-weight and type tables (mm on the printed sheet), the frame data (data/ex22/frame.json, tools/build_ex22_frame.py),
  SVG helpers, the context layers of the 1:1000 plan, and the export: Chromium prints the SVG to a vector PDF (fonts embedded),
  pdftoppm makes the PNG for Miro.
Not part of the site or of the tests."""
import json, math, os, subprocess, html, re
import numpy as np
from shapely.geometry import Polygon, LineString, MultiLineString, Point, box
from shapely.ops import unary_union, linemerge

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def palette():
    js = ("const P=require('./js/palette.js');const a=P.analysis;"
          "process.stdout.write(JSON.stringify({red:a.red,ink:a.an.ink,g:a.an.grey,r:a.an.ramp}))")
    return json.loads(subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)


PAL = palette()
RED, INK, G, R = PAL['red'], PAL['ink'], PAL['g'], PAL['r']     # G: g1..g6 light → dark; R: r1..r6 (r4 = the red)
WHITE = '#FFFFFF'

# ONE table of line weights (mm on paper) for every 2.2 drawing, whatever the group
LW = {'hair': 0.06, 'parcel': 0.07, 'bld': 0.1, 'thin': 0.16, 'mid': 0.28, 'frame': 0.3, 'fence': 0.6, 'metro': 0.5,
      'prop': 0.3, 'propBold': 0.55, 'section': 0.35, 'ground': 0.5}
# ONE table of type sizes (mm cap-ish height = font-size in mm)
TY = {'tiny': 1.55, 'map': 1.8, 'street': 1.6, 'label': 2.1, 'small': 2.6, 'body': 2.9, 'lead': 4.3, 'sub': 5.0, 'title': 14.0, 'eyebrow': 2.5, 'num': 2.0}
FONT = "IBM Plex Sans"

FRAME_FILE = os.path.join(ROOT, 'data/ex22/frame.json')


def load_frame():
    return json.load(open(FRAME_FILE))


def esc(s):
    return html.escape(str(s), quote=True)


class SVG:
    def __init__(self, w, h):
        self.w, self.h = w, h; self.defs = []; self.body = []

    def add(self, s):
        self.body.append(s)

    def defs_add(self, s):
        self.defs.append(s)

    def text(self, x, y, s, size, fill=None, weight=400, anchor='start', italic=False, halo=0.0, spacing=0, rotate=None, family=FONT, opacity=1):
        fill = fill or INK
        tr = f' transform="rotate({rotate:.2f} {x:.2f} {y:.2f})"' if rotate else ''
        st = ' font-style="italic"' if italic else ''
        ls = f' letter-spacing="{spacing}"' if spacing else ''
        hl = f' stroke="{WHITE}" stroke-width="{halo:.2f}" stroke-linejoin="round" paint-order="stroke"' if halo else ''
        op = f' opacity="{opacity}"' if opacity != 1 else ''
        self.add(f'<text x="{x:.2f}" y="{y:.2f}" font-family="{family}" font-size="{size:.2f}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{st}{ls}{hl}{tr}{op}>{esc(s)}</text>')

    def to_str(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}mm" height="{self.h}mm" viewBox="0 0 {self.w} {self.h}">'
                f'<defs>{"".join(self.defs)}</defs><rect x="0" y="0" width="{self.w}" height="{self.h}" fill="{WHITE}"/>{"".join(self.body)}</svg>')


def wrap(text, size, width_mm, avg=0.53):
    """break text into lines that fit width_mm (IBM Plex Sans: average advance about 0.53 em)"""
    words = text.split(); lines = []; ln = ''
    for w in words:
        t = (ln + ' ' + w).strip()
        if len(t) * size * avg > width_mm and ln: lines.append(ln); ln = w
        else: ln = t
    if ln: lines.append(ln)
    return lines


class MapView:
    """ground (EPSG:25830, m) → sheet (mm) at a scale, inside a window"""
    def __init__(self, frame, x, y, scale):
        self.f = frame; self.x, self.y = x, y; self.k = 1000.0 / scale   # mm per m
        self.w = (frame[2] - frame[0]) * self.k; self.h = (frame[3] - frame[1]) * self.k

    def X(self, u): return self.x + (u - self.f[0]) * self.k
    def Y(self, v): return self.y + (self.f[3] - v) * self.k

    def d(self, rings, close=True):
        out = []
        for r in rings:
            if len(r) < 2: continue
            out.append('M' + ' L'.join(f'{self.X(p[0]):.2f},{self.Y(p[1]):.2f}' for p in r) + (' Z' if close else ''))
        return ' '.join(out)

    def dgeom(self, g, close=True):
        """path data of a shapely geometry"""
        if g.is_empty: return ''
        gs = [g] if g.geom_type in ('Polygon', 'LineString', 'LinearRing') else list(getattr(g, 'geoms', []))
        out = []
        for p in gs:
            if p.geom_type == 'Polygon': out.append(self.d([list(p.exterior.coords)] + [list(i.coords) for i in p.interiors]))
            elif p.geom_type in ('LineString', 'LinearRing'): out.append(self.d([list(p.coords)], close=False))
            elif hasattr(p, 'geoms'): out.append(self.dgeom(p, close))
        return ' '.join(out)


def poly(rr):
    """a frame.json polygon (list of rings) → shapely"""
    try:
        g = Polygon(rr[0], rr[1:]) if len(rr[0]) >= 4 else Polygon()
        return g if g.is_valid else g.buffer(0)
    except Exception: return Polygon()


def smooth(Z, sigma=1.6):
    """a separable Gaussian on the grid (NaN-aware): the limit surface comes from the official lines by linear interpolation and
    carries their steps; the plans show its trend, so it is smoothed over about 30 m (said in the sheet's notes)"""
    r = int(3 * sigma); k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
    M = np.isfinite(Z).astype(float); Z0 = np.where(np.isfinite(Z), Z, 0.0)
    def conv(A):
        A = np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, mode='valid'), 0, A)
        return np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, mode='valid'), 1, A)
    num, den = conv(Z0 * M), conv(M)
    out = num / np.where(den > 1e-6, den, np.nan); out[M == 0] = np.nan
    return out


def contour_lines(F, level):
    """marching squares on the 10 m grid of allowed height (limit surface − ground, smoothed) → merged polylines in ground metres"""
    gd = F['grid']; Z = np.array(gd['limit'], float) - np.array(gd['ground'], float); Z[~np.isfinite(Z)] = np.nan; Z = smooth(Z)
    x0, y0, c = gd['x0'], gd['y0'], gd['cell']; segs = []
    ny, nx = Z.shape
    for j in range(ny - 1):
        for i in range(nx - 1):
            v = [Z[j, i], Z[j, i + 1], Z[j + 1, i + 1], Z[j + 1, i]]
            if any(np.isnan(v)): continue
            cs = [(x0 + i * c, y0 + j * c), (x0 + (i + 1) * c, y0 + j * c), (x0 + (i + 1) * c, y0 + (j + 1) * c), (x0 + i * c, y0 + (j + 1) * c)]
            pts = []
            for a, b in ((0, 1), (1, 2), (2, 3), (3, 0)):
                if (v[a] > level) != (v[b] > level):
                    lo, hi = (a, b) if a < b else (b, a)   # interpolate from the lower corner index so neighbours agree exactly
                    t = (level - v[lo]) / (v[hi] - v[lo]); pts.append((round(cs[lo][0] + t * (cs[hi][0] - cs[lo][0]), 4), round(cs[lo][1] + t * (cs[hi][1] - cs[lo][1]), 4)))
            if len(pts) == 2: segs.append(LineString(pts))
            elif len(pts) == 4: segs += [LineString(pts[:2]), LineString(pts[2:])]
    if not segs: return []
    m = linemerge(MultiLineString(segs))
    return [m] if m.geom_type == 'LineString' else list(m.geoms)


def allowed_at(F, x, y):
    gd = F['grid']; i = (x - gd['x0']) / gd['cell']; j = (y - gd['y0']) / gd['cell']; i0, j0 = int(math.floor(i)), int(math.floor(j))
    L = np.array(gd['limit'], float) - np.array(gd['ground'], float)
    if not (0 <= i0 < gd['nx'] - 1 and 0 <= j0 < gd['ny'] - 1): return float('nan')
    fi, fj = i - i0, j - j0
    return float(L[j0, i0] * (1 - fi) * (1 - fj) + L[j0, i0 + 1] * fi * (1 - fj) + L[j0 + 1, i0] * (1 - fi) * fj + L[j0 + 1, i0 + 1] * fi * fj)


def floors_fill(b):
    """existing buildings: one grey per floor band; halls and sheds (height not derived from floors) white with a grey line"""
    if b.get('hu') or not b.get('lv'): return None
    lv = b['lv']
    return G[2] if lv <= 2 else G[3] if lv == 3 else G[4]


BUILDING_KEY = [(G[2], '1–2 floors'), (G[3], '3 floors'), (G[4], '4 floors or more')]


def export(svg, out_base, w_mm, h_mm, dpi=200):
    """svg → <out_base>.svg, .pdf (Chromium, vector, fonts embedded) and .png (pdftoppm at dpi)"""
    from playwright.sync_api import sync_playwright
    os.makedirs(os.path.dirname(out_base), exist_ok=True)
    s = svg.to_str() if isinstance(svg, SVG) else svg
    open(out_base + '.svg', 'w').write(s)
    page = ('<!doctype html><html><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=block">'
            # the signs Google's 'latin' subset leaves out (\u2248 \u2192 \u2190): asked for by name, so they come from IBM Plex too and not from a fallback font
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&text=%E2%89%88%E2%86%92%E2%86%90&display=block">'
            f'<style>@page {{ size: {w_mm}mm {h_mm}mm; margin: 0 }} html,body {{ margin:0; padding:0; background:#fff }} svg {{ display:block }}</style>'
            f'</head><body>{s}</body></html>')
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.set_content(page, wait_until='networkidle'); pg.evaluate('document.fonts.ready.then(() => 1)')
        ok = pg.evaluate("document.fonts.check('12px \"IBM Plex Sans\"')")
        pg.pdf(path=out_base + '.pdf', width=f'{w_mm}mm', height=f'{h_mm}mm', print_background=True, margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
        b.close()
    subprocess.run(['pdftoppm', '-r', str(dpi), '-png', '-singlefile', out_base + '.pdf', out_base], check=True)
    return ok


# ---- the Vega around the edge areas, in black and white (owner, 23 Nov 2026: "no green — our style: black, white and red;
# textures for farmland"): farmland as furrows along the field's long side, orchards as a grid of dots, meadow and grass as
# small tufts. One definition for the plans, the plan strips and their keys.
_VEGA_DONE = set()


def _tile_furrows(w=6.0, h=6.0, gap=0.6, seed=3):
    """dense, slightly wavering furrow lines (drawn here: fine hand-drawn rows, as in the owner's reference sheets — style only)"""
    import random as _r
    rr = _r.Random(seed); out = []
    y = gap / 2
    while y < h:
        pts = []; x = 0.0; yy = y + rr.uniform(-0.04, 0.04)
        while x <= w + 0.01:
            pts.append(f'{x:.2f},{yy + 0.05 * math.sin(x * 2.1 + y * 3.0):.3f}'); x += 0.75
        out.append('M' + ' L'.join(pts)); y += gap
    return out


def _tile_speckle(w=6.0, h=6.0, n=120, seed=5, rmin=0.05, rmax=0.16):
    """gravel-like speckle: grey dots of mixed size, a few short strokes (style only)"""
    import random as _r
    rr = _r.Random(seed); d = []
    for _ in range(n):
        x, y = rr.uniform(0, w), rr.uniform(0, h); r = rr.uniform(rmin, rmax) * (1.8 if rr.random() < 0.08 else 1.0)
        d.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.3f}"/>')
    return ''.join(d)


def vega_pat(svg, kind, ang=0.0):
    """the url of the texture for a land-use kind, black and white (owner, 23 Nov 2026, after reference sheets: dense furrows
    for farmland, a gravel speckle for meadow and open ground, canopies over the speckle for orchards). Farmland is turned to
    `ang` degrees (15° steps) so the rows run along the field."""
    if kind == 'farmland':
        a = int(round(ang / 15.0) * 15) % 180; pid = f'vegaFarm{a}'
        if pid not in _VEGA_DONE:
            fr = _tile_furrows()
            svg.defs_add(f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate({a})"><rect width="6" height="6" fill="{WHITE}"/>'
                         f'<path d="{" ".join(fr)}" fill="none" stroke="{G[4]}" stroke-width="0.1"/></pattern>')
            _VEGA_DONE.add(pid)
        return f'url(#{pid})'
    if kind == 'orchard':
        if 'vegaOrch' not in _VEGA_DONE:
            can = ''.join(f'<circle cx="{cx}" cy="{cy}" r="1.2" fill="{WHITE}" stroke="{G[4]}" stroke-width="0.12" stroke-dasharray="0.25 0.12"/><circle cx="{cx}" cy="{cy}" r="0.55" fill="none" stroke="{G[3]}" stroke-width="0.06" stroke-dasharray="0.12 0.12"/>' for cx, cy in ((1.5, 1.5), (4.5, 4.5)))
            svg.defs_add(f'<pattern id="vegaOrch" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="{WHITE}"/><g fill="{G[3]}">{_tile_speckle(n=45, seed=9)}</g>{can}</pattern>')
            _VEGA_DONE.add('vegaOrch')
        return 'url(#vegaOrch)'
    if 'vegaMead' not in _VEGA_DONE:
        svg.defs_add(f'<pattern id="vegaMead" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="{WHITE}"/><g fill="{G[4]}">{_tile_speckle()}</g></pattern>')
        _VEGA_DONE.add('vegaMead')
    return 'url(#vegaMead)'


def long_angle(g, screen_flip=True):
    """the direction of a polygon's long side, in degrees on the sheet (y down)"""
    r = g.minimum_rotated_rectangle
    if r.geom_type != 'Polygon': return 0.0
    c = list(r.exterior.coords)
    e = max(((c[i], c[i + 1]) for i in range(4)), key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][1] - ab[0][1]))
    a = math.degrees(math.atan2(e[1][1] - e[0][1], e[1][0] - e[0][0]))
    return -a if screen_flip else a


def vega_geom(g_sheet, kind, ang=None, seed=1, sc=1.0):
    """the textures as explicit geometry in sheet millimetres (Chromium prints SVG patterns as low-resolution images), in black
    and white after the owner's reference sheets (23 Nov 2026 — style only, drawn here): farmland = rows along the field's long
    side, each with short sprouts along it; meadow and grass = short upright grass strokes; orchard = a dense speckle under dashed
    canopies on a 6 mm grid. g_sheet: a shapely polygon already on the sheet."""
    import random as _r
    from shapely.prepared import prep
    if g_sheet.is_empty: return ''
    rr = _r.Random(seed); out = []
    x0, y0, x1, y1 = g_sheet.bounds; pg = prep(g_sheet)
    f = sc ** 0.6; dens = 1.0 / (f * f)   # by scale (sc = 1 at 1:1000, 2 at 1:500): larger marks, fewer per mm², as the eye reads them
    def pts(n):
        got, tries = [], 0
        while len(got) < n and tries < n * 6:
            tries += 1; x, y = rr.uniform(x0, x1), rr.uniform(y0, y1)
            if pg.contains(Point(x, y)): got.append((x, y))
        return got
    if kind == 'farmland':
        a = math.radians(ang if ang is not None else long_angle(g_sheet, screen_flip=False))
        ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; R_ = math.hypot(x1 - x0, y1 - y0) / 2 + 1
        rows, dark, sprouts = [], [], []
        t = -R_; k_row = 0
        while t <= R_:
            o = t + rr.uniform(-0.06, 0.06)
            ln = LineString([(cx + nx * o - ux * R_, cy + ny * o - uy * R_), (cx + nx * o + ux * R_, cy + ny * o + uy * R_)]).intersection(g_sheet)
            for q in ([ln] if ln.geom_type == 'LineString' else [q for q in getattr(ln, 'geoms', []) if q.geom_type == 'LineString']):
                if q.is_empty or q.length < 0.3: continue
                (dark if k_row % 7 in (0, 3) else rows).append('M{:.2f},{:.2f} L{:.2f},{:.2f}'.format(*q.coords[0], *q.coords[-1]))
                d = rr.uniform(0, 0.8 * f)
                while d < q.length:   # sprouts: short strokes along the row, leaning a little, in loose groups
                    p_ = q.interpolate(d); h = rr.uniform(0.15, 0.32) * f; k = rr.uniform(-0.6, 0.6)
                    sprouts.append(f'M{p_.x - (nx * 0.6 + ux * k) * h / 2:.2f},{p_.y - (ny * 0.6 + uy * k) * h / 2:.2f}l{(nx * 0.6 + ux * k) * h:.2f},{(ny * 0.6 + uy * k) * h:.2f}')
                    d += rr.uniform(0.3, 1.6) * f
            t += 0.9 * f; k_row += 1
        return ((f'<path d="{" ".join(rows)}" fill="none" stroke="{G[3]}" stroke-width="{0.05 * f:.3f}"/>' if rows else '') + (f'<path d="{" ".join(dark)}" fill="none" stroke="{G[4]}" stroke-width="{0.08 * f:.3f}"/>' if dark else '')
                + (f'<path d="{"".join(sprouts)}" fill="none" stroke="{G[4]}" stroke-width="{0.06 * f:.3f}" stroke-linecap="round"/>' if sprouts else ''))
    if kind == 'meadow':   # grass strokes, nearly upright, a few clumps denser
        strokes = []
        for (x, y) in pts(int(g_sheet.area * 3.2 * dens)):
            h = rr.uniform(0.2, 0.5) * f; k = rr.uniform(-0.2, 0.2)
            strokes.append(f'M{x:.2f},{y:.2f}l{k * h:.2f},{-h:.2f}')
        return f'<path d="{"".join(strokes)}" fill="none" stroke="{G[4]}" stroke-width="{0.05 * f:.3f}" stroke-linecap="round"/>' if strokes else ''
    dots = [f'M{x:.2f},{y:.2f}h0.01' for x, y in pts(int(g_sheet.area * 3.0 * dens))]
    big = [f'M{x:.2f},{y:.2f}h0.01' for x, y in pts(int(g_sheet.area * 0.05 * dens))]
    out.append((f'<path d="{"".join(dots)}" stroke="{G[4]}" stroke-width="{0.11 * f:.3f}" stroke-linecap="round" fill="none"/>' if dots else '') + (f'<path d="{"".join(big)}" stroke="{G[5]}" stroke-width="{0.26 * f:.3f}" stroke-linecap="round" fill="none"/>' if big else ''))
    if kind == 'orchard':
        cs = []
        st_ = 6 * f; rc = 1.3 * f
        for i in range(int(x0 // st_), int(x1 // st_) + 1):
            for j in range(int(y0 // st_), int(y1 // st_) + 1):
                cx, cy = i * st_ + st_ / 2 + (st_ / 4 if j % 2 else 0), j * st_ + st_ / 2
                if pg.contains(Point(cx, cy).buffer(rc)): cs.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{rc:.2f}" fill="{WHITE}" stroke="{G[4]}" stroke-width="{0.1 * f:.3f}" stroke-dasharray="{0.3 * f:.2f} {0.15 * f:.2f}"/><circle cx="{cx:.2f}" cy="{cy:.2f}" r="{0.12 * f:.2f}" fill="{G[4]}"/>')
        out.append(''.join(cs))
    return ''.join(out)
