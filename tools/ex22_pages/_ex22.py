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
