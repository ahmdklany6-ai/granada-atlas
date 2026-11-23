"""Exercise 2.2 · the buildings of the 1:500 sections in BLACK AND WHITE, with texture (owner, 22 Nov 2026: "more detail in the
buildings of the sections, black and white" → "more texture"). The 2.1 detailed sections' façade families
(tools/export_ex21_sections_svg.py, facade()) redrawn with line textures instead of colours.
RECORDED (Catastro): the footprint (width along the line), the floors (x 3 m = an estimate), the use and the year of construction
→ the family (style()). SCHEMATIC, not surveyed: materials, window rhythm, shutters, balconies, roof form — typical of that kind
of building in that period, varied a little per building so the street does not repeat. Not part of the site or of the tests."""
import random
INK, WHITE = '#29100C', '#FFFFFF'


def defs():
    """(the textures are explicit geometry now: tex(); nothing to define)"""
    return ''


def style(btype, year, lv):
    """which elevation a building gets — from what IS recorded: use, floors, year of construction (no year → 'plain')"""
    if btype in ('industrial', 'warehouse'): return 'shed'
    if btype in ('public', 'school'): return 'public'
    if btype in ('retail', 'commercial'): return 'shop'
    if not year: return 'plain'
    if lv <= 2: return 'trad' if year < 1965 else 'house' if year < 1990 else 'villa'
    return 'brick' if year < 1982 else 'render' if year < 2000 else 'boom' if year < 2010 else 'new'


# The textures are drawn as explicit lines and dots (one <path> per patch), aligned to one grid over the whole sheet. SVG <pattern>
# fills made Chromium's PDF heavy (20 MB for one sheet) and slow to rasterise; explicit geometry keeps it a light vector PDF.
import math as _m
_CID = [0]


def _path(segs, sw, col=INK, cap=None):
    if not segs: return ''
    d = ''.join(f'M{a:.2f},{b:.2f}L{c:.2f},{e:.2f}' for a, b, c, e in segs)
    return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{sw}"' + (f' stroke-linecap="{cap}"' if cap else '') + '/>'


def _hl(x, y, w, h, gap, sw, off=0.0):
    yy = _m.ceil((y - off) / gap) * gap + off; segs = []
    while yy <= y + h + 1e-6: segs.append((x, yy, x + w, yy)); yy += gap
    return _path(segs, sw)


def _vl(x, y, w, h, gap, sw, off=0.0):
    xx = _m.ceil((x - off) / gap) * gap + off; segs = []
    while xx <= x + w + 1e-6: segs.append((xx, y, xx, y + h)); xx += gap
    return _path(segs, sw)


def _dg(x, y, w, h, gap, sw, sign=1):
    """diagonals clipped to the rectangle: x + y = c (sign 1, rising to the right) or y - x = c (sign -1)"""
    segs = []
    if sign == 1:
        c = _m.ceil((x + y) / gap) * gap
        while c <= x + w + y + h:
            xa, xb = max(x, c - (y + h)), min(x + w, c - y)
            if xb - xa > 0.02: segs.append((xa, c - xa, xb, c - xb))
            c += gap
    else:
        c = _m.ceil((y - (x + w)) / gap) * gap
        while c <= y + h - x:
            xa, xb = max(x, y - c), min(x + w, y + h - c)
            if xb - xa > 0.02: segs.append((xa, xa + c, xb, xb + c))
            c += gap
    return _path(segs, sw)


def _dots(x, y, w, h, per9, seed):
    """a stipple: per9 dots on every 9 mm2, two sizes"""
    n = int(round(w * h / 9.0 * per9)); rr = random.Random(seed); out = ''
    for share, dia in ((0.6, 0.11), (0.4, 0.16)):
        k = int(round(n * share))
        if k: out += f'<path d="{"".join(f"M{x + rr.random() * w:.2f},{y + rr.random() * h:.2f}h0.01" for _ in range(k))}" fill="none" stroke="{INK}" stroke-width="{dia}" stroke-linecap="round"/>'
    return out


def tex(name, x, y, w, h):
    """the texture `name` over a rectangle, as explicit geometry (no background: put white under it)"""
    if w <= 0.05 or h <= 0.05: return ''
    sd = int(abs(x) * 7.3 + abs(y) * 13.1 + w * 3.7) % 99991
    if name == 'bwBrick':
        segs = []; k = _m.floor(y / 0.3)
        while k * 0.3 < y + h:
            ya, yb = max(y, k * 0.3), min(y + h, (k + 1) * 0.3); off = 0.9 if k % 2 else 0.0; xx = _m.ceil((x - off) / 1.8) * 1.8 + off
            while xx <= x + w and yb > ya: segs.append((xx, ya, xx, yb)); xx += 1.8
            k += 1
        return _hl(x, y, w, h, 0.3, 0.035) + _path(segs, 0.03)
    if name == 'bwRubble':
        rr = random.Random(sd); segs = []; k = _m.floor(y / 0.55)
        while k * 0.55 < y + h:
            ya, yb = max(y, k * 0.55), min(y + h, (k + 1) * 0.55); xx = x + rr.uniform(0.2, 0.8)
            while xx < x + w and yb > ya: segs.append((xx, ya, xx + rr.uniform(-0.06, 0.06), yb)); xx += rr.uniform(0.5, 1.1)
            k += 1
        return _hl(x, y, w, h, 0.55, 0.04) + _path(segs, 0.04)
    if name == 'bwStipple': return _dots(x, y, w, h, 6, sd)
    if name == 'bwDots1': return _dots(x, y, w, h, 4, sd)
    if name == 'bwDots2': return _dots(x, y, w, h, 10, sd)
    if name == 'bwDots3': return _dots(x, y, w, h, 20, sd)
    if name == 'bwDiamond': return _dg(x, y, w, h, 0.7, 0.035, 1) + _dg(x, y, w, h, 0.7, 0.035, -1)
    if name == 'bwTile': return _vl(x, y, w, h, 0.42, 0.05) + _hl(x, y, w, h, 0.6, 0.03)
    if name == 'bwRib': return _vl(x, y, w, h, 0.8, 0.05) + _vl(x, y, w, h, 0.8, 0.025, 0.2)
    if name == 'bwSlat': return _vl(x, y, w, h, 0.28, 0.07)
    if name == 'bwBoard': return _vl(x, y, w, h, 0.25, 0.035)
    if name == 'bwGlass': return _dg(x, y, w, h, 0.55, 0.035, 1)
    if name == 'bwShutter': return _hl(x, y, w, h, 0.2, 0.04)
    if name == 'bwHatchH': return _hl(x, y, w, h, 0.35, 0.05)
    if name == 'bwStripe': return _vl(x, y, w, h, 0.6, 0.28)
    if name == 'bwShade': return _dg(x, y, w, h, 0.7, 0.05, 1)
    return ''


def clip_tex(name, shape, bbox, stroke=None, sw=0.05, white=True):
    """the texture inside a shape (shape = '<polygon points="…"/>' or '<path d="…"/>', without paint), with its outline"""
    _CID[0] += 1; i = f'bwc{_CID[0]}'; x, y, w, h = bbox; out = ''
    if white: out += shape.replace('/>', f' fill="{WHITE}"/>')
    out += f'<clipPath id="{i}">{shape}</clipPath><g clip-path="url(#{i})">{tex(name, x, y, w, h)}</g>'
    if stroke: out += shape.replace('/>', f' fill="none" stroke="{stroke}" stroke-width="{sw}"/>')
    return out


def _bb(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; return (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))


def _r(x, y, w, h, fill=WHITE, stroke=None, sw=0.05):
    if isinstance(fill, str) and fill.startswith('url(#bw'):      # a texture: explicit geometry, then the outline
        return tex(fill[5:-1], x, y, max(0, w), max(0, h)) + (f'<rect x="{x:.2f}" y="{y:.2f}" width="{max(0, w):.2f}" height="{max(0, h):.2f}" fill="none" stroke="{stroke}" stroke-width="{sw}"/>' if stroke else '')
    return f'<rect x="{x:.2f}" y="{y:.2f}" width="{max(0, w):.2f}" height="{max(0, h):.2f}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '') + '/>'


def _l(x1, y1, x2, y2, sw=0.05):
    return f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{INK}" stroke-width="{sw}"/>'


def elev(x0, x1, yg, lv, btype, year, seed=0, K=2.0, far=False):
    """a building beyond the cut, seen from the front, in black and white with textures. x0, x1, yg in mm (yg = ground);
    lv floors of 3 m; K = mm per metre. far: thinner lines, fewer small parts."""
    lv = max(1, int(lv)); m = lambda v: v * K; w = x1 - x0; fh = m(3.0); top = yg - lv * fh; st = style(btype, year, lv); rnd = random.Random(seed * 131 + 7)
    LW = 0.045 if far else 0.06; o = []
    def win(cx, yb, ww, wh, sill=0.9, box=False, shutter=0.0, grille=False):
        xw, yt = cx - m(ww) / 2, yb - m(sill + wh); q = [_r(xw, yt, m(ww), m(wh), WHITE), _r(xw, yt, m(ww), m(wh), 'url(#bwGlass)', INK, LW)]
        if ww > 1.0: q.append(_l(cx, yt, cx, yt + m(wh), LW * 0.8))                                       # two leaves
        if box: q.append(_r(xw - m(0.05), yt - m(0.25), m(ww + 0.1), m(0.25), WHITE, INK, LW * 0.7))   # roller-shutter box
        if shutter: q.append(_r(xw, yt, m(ww), m(wh * shutter), WHITE) + _r(xw, yt, m(ww), m(wh * shutter), 'url(#bwShutter)', INK, LW * 0.7))
        if grille: q.append(''.join(_l(xw + m(ww) * j / 4, yt, xw + m(ww) * j / 4, yt + m(wh), 0.04) for j in range(1, 4)))
        if sill > 0: q.append(_r(xw - m(0.08), yb - m(sill), m(ww + 0.16), m(0.08), WHITE, INK, LW * 0.7))
        return ''.join(q)
    def rail(cx, yb, bw, kind='bars'):
        xb = cx - m(bw) / 2; q = [_l(xb - m(0.1), yb, xb + m(bw + 0.1), yb, 0.14)]                         # the slab's edge
        if kind == 'solid': q.append(_r(xb, yb - m(1.0), m(bw), m(1.0), WHITE, INK, LW))
        elif kind == 'glass': q.append(_r(xb, yb - m(1.0), m(bw), m(1.0), 'url(#bwGlass)', INK, LW * 0.8))
        else: q.append(_r(xb, yb - m(1.0), m(bw), m(1.0), 'none', INK, LW) + ''.join(_l(xb + m(j * 0.15), yb - m(1.0), xb + m(j * 0.15), yb, 0.03) for j in range(1, int(bw / 0.15))))
        return ''.join(q)
    def door(cx, yb, dw=1.0, dh=2.2): return _r(cx - m(dw) / 2, yb - m(dh), m(dw), m(dh), WHITE) + _r(cx - m(dw) / 2, yb - m(dh), m(dw), m(dh), 'url(#bwBoard)', INK, LW)
    def garage(cx, yb, dw=2.5, dh=2.2): xg = cx - m(dw) / 2; return _r(xg, yb - m(dh), m(dw), m(dh), WHITE) + _r(xg, yb - m(dh), m(dw), m(dh), 'url(#bwShutter)', INK, LW)
    def wall(tex=None, plinth=None, ph=0.9):
        q = [_r(x0, top, w, lv * fh, WHITE)]
        if tex: q.append(_r(x0, top, w, lv * fh, f'url(#{tex})'))
        if plinth: q.append(_r(x0, yg - m(ph), w, m(ph), WHITE) + _r(x0, yg - m(ph), w, m(ph), f'url(#{plinth})') + _l(x0, yg - m(ph), x1, yg - m(ph), LW))
        return ''.join(q)
    def tile_roof(h=1.1, over=0.3):
        ya = top - m(h); xa, xb = x0 - m(over), x1 + m(over); pts = f'{xa:.2f},{top:.2f} {xa + m(0.5):.2f},{ya:.2f} {xb - m(0.5):.2f},{ya:.2f} {xb:.2f},{top:.2f}'
        return clip_tex('bwTile', f'<polygon points="{pts}"/>', (xa, ya, xb - xa, top - ya), INK, LW * 1.3) + _l(xa, top, xb, top, 0.12)
    def flat_roof(parapet=0.0, railing=False):
        q = []
        if parapet: q.append(_r(x0, top - m(parapet), w, m(parapet), WHITE, INK, LW))
        if railing: q.append(_l(x0, top - m(parapet + 0.9), x1, top - m(parapet + 0.9), 0.04) + ''.join(_l(x0 + m(j * 1.2), top - m(parapet + 0.9), x0 + m(j * 1.2), top - m(parapet), 0.03) for j in range(int(w / m(1.2)) + 1)))
        q.append(_l(x0 - m(0.1), top - m(parapet), x1 + m(0.1), top - m(parapet), 0.12)); return ''.join(q)
    def stairhead(xc, hw=1.6, hh=2.4): return _r(xc - m(hw), top - m(hh), m(2 * hw), m(hh), WHITE, INK, LW) + _r(xc - m(0.35), top - m(hh) + m(0.5), m(0.7), m(0.9), 'url(#bwGlass)', INK, LW * 0.8)
    floors = lambda: ''.join(_l(x0, yg - f * fh, x1, yg - f * fh, LW * 0.6) for f in range(1, lv))
    bays = lambda bay: max(1, int(round(w / m(bay))))
    if w < m(2.2):   # a sliver: a wall and one opening per floor
        o.append(wall('bwStipple')); o += [win((x0 + x1) / 2, yg - f * fh, min(0.9, w / K * 0.5), 1.2) for f in range(lv)]
    elif st == 'shed':   # ribbed cladding, a low gable, a big door, a strip of glazing
        pk = min(1.6, w / K * 0.08); xc = (x0 + x1) / 2; pts = f'{x0:.2f},{yg:.2f} {x0:.2f},{top:.2f} {xc:.2f},{top - m(pk):.2f} {x1:.2f},{top:.2f} {x1:.2f},{yg:.2f}'
        o.append(clip_tex('bwRib', f'<polygon points="{pts}"/>', (x0, top - m(pk), w, yg - top + m(pk)), INK, LW))
        o.append(garage(x0 + w * (0.3 + 0.4 * (seed % 2)), yg, min(4.0, w / K * 0.35), min(lv * 3 * 0.75, 4.2))); o.append(_r(x0 + m(0.6), top + m(0.5), w - m(1.2), m(0.7), 'url(#bwGlass)', INK, LW))
    elif st == 'public':   # bands of glazing with mullions, a hatched band at the top, a canopy at the door
        o.append(wall('bwStipple'))
        for f in range(lv):
            yb = yg - f * fh; o.append(_r(x0 + m(0.8), yb - m(2.4), w - m(1.6), m(1.4), 'url(#bwGlass)', INK, LW)); o += [_l(x0 + m(0.8) + k * m(1.5), yb - m(2.4), x0 + m(0.8) + k * m(1.5), yb - m(1.0), 0.03) for k in range(1, int((w - m(1.6)) / m(1.5)) + 1)]
        o.append(_r(x0, top, w, m(0.5), 'url(#bwShade)')); xd = x0 + w * (0.25 + 0.5 * (seed % 2)); o.append(door(xd, yg, 1.8, 2.3) + _r(xd - m(2.0), yg - m(2.7), m(4.0), m(0.15), WHITE, INK, LW)); o.append(flat_roof(0.3)); o.append(floors())
    elif st == 'shop':   # a glazed shop front, a dark fascia, windows above
        o.append(wall('bwStipple')); o.append(_r(x0 + m(0.4), yg - m(2.6), w - m(0.8), m(2.3), 'url(#bwGlass)', INK, LW) + _r(x0, yg - m(3.0), w, m(0.4), INK))
        o += [_l(x0 + m(0.4) + q * m(1.6), yg - m(2.6), x0 + m(0.4) + q * m(1.6), yg - m(0.3), 0.04) for q in range(1, int((w - m(0.8)) / m(1.6)) + 1)]
        n = bays(3.2); o += [win(x0 + w / n * (k + 0.5), yg - f * fh, 1.3, 1.3, box=True) for f in range(1, lv) for k in range(n)]; o.append(flat_roof(0.4)); o.append(floors())
    elif st == 'trad':   # before 1965, 1–2 floors: whitewash, a stone plinth, tall windows with grilles, a board door, clay tiles
        o.append(wall('bwStipple', 'bwRubble', 0.9)); n = bays(rnd.choice([3.2, 3.6, 4.0])); dk = seed % n
        for f in range(lv):
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); yb = yg - f * fh
                if f == 0 and k == dk: o.append(door(cx, yb, 1.2, 2.4))
                elif f == 0: o.append(win(cx, yb, 0.9, 1.5, 0.8, grille=True))
                else: o.append(win(cx, yb, 0.9, 1.9, 0.1) + rail(cx, yb, 1.3))
        o.append(tile_roof(1.0 + 0.2 * (seed % 2)))
        if seed % 3 == 0: o.append(_r(x0 + w * 0.7, top - m(1.9), m(0.5), m(1.0), WHITE, INK, LW))
    elif st == 'house':   # 1965–1989, 1–2 floors: render, a hatched base, roller shutters, a garage door, a roof terrace
        o.append(wall('bwStipple', 'bwShade', 0.6)); n = bays(3.4); dk = seed % n; gk = (dk + 1) % n if w > m(7) else -1
        for f in range(lv):
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); yb = yg - f * fh
                if f == 0 and k == dk: o.append(door(cx, yb, 1.0, 2.2))
                elif f == 0 and k == gk: o.append(garage(cx, yb))
                else: o.append(win(cx, yb, 1.2, 1.2, 0.9, box=True, shutter=0.45 if (k + f + seed) % 3 == 0 else 0.0))
        o.append(flat_roof(0.9 if seed % 2 else 0.3, railing=seed % 2 == 0)); o.append(floors())
    elif st == 'villa':   # since 1990, 1–2 floors: smooth render, a porch, wide windows, balconies, a tiled roof
        o.append(wall()); n = bays(4.0); pk = seed % n
        for k in range(n):
            cx = x0 + w / n * (k + 0.5)
            if k == pk: o.append(_r(cx - m(1.6), yg - m(2.6), m(3.2), m(2.6), 'url(#bwShade)') + door(cx, yg, 1.0, 2.2) + _l(cx - m(1.6), yg - m(2.6), cx - m(1.6), yg, 0.1) + _l(cx + m(1.6), yg - m(2.6), cx + m(1.6), yg, 0.1))
            else: o.append(win(cx, yg, 1.6, 1.3, 0.9))
            if lv > 1: o.append(win(cx, yg - fh, 1.5, 2.0, 0.1) + rail(cx, yg - fh, 2.2, 'glass' if seed % 2 else 'bars'))
        o.append(tile_roof(0.9, 0.5)); o.append(floors())
    elif st == 'brick':   # blocks before 1982: exposed brick, slab edges, solid balcony fronts, roller-shutter boxes
        o.append(wall('bwBrick')); n = bays(rnd.choice([2.9, 3.1, 3.3])); dk = seed % n
        o.append(''.join(_r(x0, yg - f * fh - m(0.12), w, m(0.24), WHITE, INK, 0.03) for f in range(1, lv)))
        for f in range(lv):
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); yb = yg - f * fh
                if f == 0: o.append(door(cx, yb, 1.3, 2.3) if k == dk else garage(cx, yb, min(2.4, w / n / K - 0.5), 2.4) if (k + seed) % 2 == 0 else win(cx, yb, 1.2, 1.2, 1.0, grille=True))
                elif (k + seed) % 2 == 0: o.append(win(cx, yb, 1.4, 2.1, 0.0, box=True) + rail(cx, yb, min(2.6, w / n / K - 0.2), 'solid'))
                else: o.append(win(cx, yb, 1.2, 1.2, 1.0, box=True, shutter=0.5 if (k * 3 + f + seed) % 4 == 0 else 0.0))
        o.append(flat_roof(0.5)); o.append(stairhead(x0 + w * (0.3 + 0.4 * (seed % 2))) if w > m(8) else '')
    elif st == 'render':   # blocks of 1982–1999: render, a glazed stair bay, railings, a tiled eave, a hatched base
        o.append(wall('bwStipple', 'bwShade', 1.0)); n = bays(3.2); sk = seed % n
        for k in range(n):
            cx = x0 + w / n * (k + 0.5)
            if k == sk:
                o.append(_r(cx - m(0.6), top + m(0.8), m(1.2), lv * fh - m(3.6), 'url(#bwGlass)', INK, LW) + ''.join(_l(cx - m(0.6), yg - f * fh - m(1.5), cx + m(0.6), yg - f * fh - m(1.5), 0.03) for f in range(1, lv)) + door(cx, yg, 1.3, 2.3)); continue
            for f in range(lv):
                yb = yg - f * fh
                if f == 0: o.append(win(cx, yb, 1.2, 1.2, 1.0, grille=True)); continue
                o.append(win(cx, yb, 1.3, 2.1, 0.0, shutter=0.35 if (k + f + seed) % 3 == 0 else 0.0) + rail(cx, yb, 2.0) if (k + f) % 2 == seed % 2 else win(cx, yb, 1.2, 1.3, 0.9, shutter=0.4 if (k * 2 + f + seed) % 5 == 0 else 0.0))
        o.append(_r(x0 - m(0.3), top - m(0.35), w + m(0.6), m(0.35), WHITE) + _r(x0 - m(0.3), top - m(0.35), w + m(0.6), m(0.35), 'url(#bwTile)', INK, LW)); o.append(floors())
    elif st == 'boom':   # blocks of 2000–2009: render with brick panels, glazed bays (miradores), a coursed stone base
        o.append(wall()); n = bays(3.4); dk = seed % n
        for k in range(n):
            cx = x0 + w / n * (k + 0.5); bw = w / n
            if (k + seed) % 3 == 0 and lv > 2:
                o.append(_r(cx - m(1.1), top + m(0.4), m(2.2), (lv - 1) * fh - m(0.4), 'url(#bwGlass)', INK, LW) + ''.join(_l(cx - m(1.1), yg - f * fh, cx + m(1.1), yg - f * fh, 0.07) for f in range(1, lv)) + _l(cx, top + m(0.4), cx, yg - fh, 0.03))
            else:
                if (k + seed) % 2: o.append(_r(cx - bw * 0.42, top + m(0.3), bw * 0.84, (lv - 1) * fh - m(0.3), 'url(#bwBrick)'))
                o += [win(cx, yg - f * fh, 1.3, 2.0, 0.1) + rail(cx, yg - f * fh, 1.6) for f in range(1, lv)]
            o.append(door(cx, yg, 1.4, 2.4) if k == dk else win(cx, yg, 1.6, 1.6, 0.8))
        o.append(_r(x0, yg - fh, w, fh, 'url(#bwRubble)')); o.append(flat_roof(0.6)); o.append(floors()); o.append(stairhead(x0 + w * 0.5) if w > m(9) else '')
    elif st == 'new':   # since 2010: smooth white, wide windows, timber-slat panels shifting floor to floor, glass balustrades
        o.append(wall()); n = bays(4.2)
        for f in range(lv):
            yb = yg - f * fh
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); sd = 1 if (k + f + seed) % 2 else -1
                if f == 0: o.append(_r(cx - m(1.7), yb - m(2.6), m(3.4), m(2.6), 'url(#bwShade)')); continue
                o.append(win(cx - sd * m(0.5), yb, 2.0, 1.9, 0.2) + _r(cx + sd * m(1.1) - m(0.45), yb - m(2.6), m(0.9), m(2.4), 'url(#bwSlat)', INK, 0.03))
                if (k + f) % 2 == seed % 2: o.append(rail(cx - sd * m(0.5), yb, 2.6, 'glass'))
        o.append(door(x0 + w / n * (seed % n + 0.5), yg, 1.4, 2.4)); o.append(flat_roof(0.4)); o.append(floors())
    else:   # no year on record: a plain wall, plain windows, no period features
        o.append(wall()); n = bays(3.2); dk = seed % n
        o += [door(x0 + w / n * (k + 0.5), yg) if f == 0 and k == dk else win(x0 + w / n * (k + 0.5), yg - f * fh, 1.2, 1.3) for f in range(lv) for k in range(n)]; o.append(flat_roof(0.3)); o.append(floors())
    if not far: o.append(_r(x1 - min(w * 0.16, m(1.4)), top, min(w * 0.16, m(1.4)), lv * fh, 'url(#bwShade)'))   # shade: light from the left
    if st != 'shed': o.append(_r(x0, top, w, lv * fh, 'none', INK, 0.16 if not far else 0.1))
    return ''.join(o)


def person(x, y, K=2.0, kind=0):
    """a person for scale (1.75 m), in ink: 0 standing, 1 walking, 2 child, 3 pair"""
    m = lambda v: v * K
    def body(bx, h):
        s = h / 1.75
        return (f'<circle cx="{bx:.2f}" cy="{y - m(h * 0.93):.2f}" r="{m(0.11 * s):.2f}" fill="{INK}"/>'
                f'<path d="M{bx - m(0.2 * s):.2f},{y - m(h * 0.83):.2f} h{m(0.4 * s):.2f} l{-m(0.03):.2f},{m(h * 0.4):.2f} l{-m(0.03):.2f},{m(h * 0.43):.2f} h{-m(0.1):.2f} l{-m(0.04):.2f},{-m(h * 0.36):.2f} '
                f'l{-m(0.04):.2f},{m(h * 0.36):.2f} h{-m(0.1):.2f} l{-m(0.03):.2f},{-m(h * 0.43):.2f} z" fill="{INK}"/>')
    if kind == 2: return body(x, 1.2)
    if kind == 3: return body(x - m(0.35), 1.75) + body(x + m(0.35), 1.65)
    return body(x, 1.75)


def car(x, y, K=2.0):
    """a car seen from the front or back (the section cuts across the street): 1.8 m wide, 1.45 m high, in ink lines"""
    m = lambda v: v * K; w2 = m(0.9)
    return (f'<path d="M{x - w2:.2f},{y - m(0.3):.2f} v{-m(0.55):.2f} l{m(0.25):.2f},{-m(0.55):.2f} h{m(1.3):.2f} l{m(0.25):.2f},{m(0.55):.2f} v{m(0.55):.2f} z" fill="{WHITE}" stroke="{INK}" stroke-width="0.08"/>'
            f'<path d="M{x - w2 + m(0.32):.2f},{y - m(0.9):.2f} l{m(0.18):.2f},{-m(0.42):.2f} h{m(1.0):.2f} l{m(0.18):.2f},{m(0.42):.2f} z" fill="{WHITE}" stroke="{INK}" stroke-width="0.05"/>'
            f'<rect x="{x - w2 + m(0.1):.2f}" y="{y - m(0.3):.2f}" width="{m(0.25):.2f}" height="{m(0.3):.2f}" fill="{INK}"/><rect x="{x + w2 - m(0.35):.2f}" y="{y - m(0.3):.2f}" width="{m(0.25):.2f}" height="{m(0.3):.2f}" fill="{INK}"/>')


def lamp(x, y, K=2.0, side=1):
    """a street light (schematic): 7 m post, an arm, the lamp"""
    m = lambda v: v * K; top = y - m(7); ax = x + side * m(1.4)
    return (_l(x, y, x, top, 0.16) + f'<path d="M{x:.2f},{top:.2f} q{side * m(0.6):.2f},{-m(0.2):.2f} {side * m(1.4):.2f},0" fill="none" stroke="{INK}" stroke-width="0.12"/>'
            + _r(ax - m(0.4), top - 0.05, m(0.8), m(0.22), INK))


# ---- façades read from the Catastro's façade photos (data/ex22/facades.json), drawn in black and white ------------------------
def defs_obs():
    return ''


WALL_TEX = {'white': None, 'cream': 'bwDots1', 'sand': 'bwDots2', 'yellow': 'bwDots2', 'ochre': 'bwDots3', 'green': 'bwDots3', 'grey': 'bwDots2', 'brick': 'bwBrick'}
DOOR_TEX = {'white': 'bwShutter', 'brown': 'bwHatchH', 'green': 'bwHatchH', 'grey': 'bwHatchH'}


def tree_ink(x, yg, K=2.0, h=5.5, r=2.2, seed=0, sw=0.1):
    """a tree in front of a façade, as the photo shows one (schematic size): trunk and a scalloped, stippled crown, in ink"""
    import math as _m
    rr = random.Random(seed); cx, cy = x, yg - h * K; R0 = r * K; n = 10; d = ''
    for i in range(n):
        a0 = 2 * _m.pi * i / n; a1 = 2 * _m.pi * (i + 1) / n; rad = R0 * (0.9 + 0.15 * rr.random())
        p0 = (cx + rad * _m.cos(a0), cy + rad * _m.sin(a0)); pc = (cx + R0 * 1.15 * _m.cos((a0 + a1) / 2), cy + R0 * 1.15 * _m.sin((a0 + a1) / 2)); p1 = (cx + rad * _m.cos(a1), cy + rad * _m.sin(a1))
        d += (f'M{p0[0]:.2f},{p0[1]:.2f} ' if i == 0 else '') + f'Q{pc[0]:.2f},{pc[1]:.2f} {p1[0]:.2f},{p1[1]:.2f} '
    return _l(x, yg, x, cy + R0 * 0.3, sw + 0.08) + clip_tex('bwDots2', f'<path d="{d}Z"/>', (cx - R0 * 1.2, cy - R0 * 1.2, R0 * 2.4, R0 * 2.4), INK, sw)


def elev_obs(x0, x1, yg, lv, obs, seed=0, K=2.0, far=False):
    """a building beyond the cut drawn from what its Catastro façade photo shows (obs), in black and white. The number and the
    place of the openings stay schematic; floors from the Catastro (x 3 m)."""
    lv = max(1, int(lv)); m = lambda v: v * K; w = x1 - x0; fh = m(3.0); top = yg - lv * fh; LW = 0.045 if far else 0.06; o = []
    n = max(1, int(round(w / m(3.3)))); dk = seed % n; gk = (dk + 1) % n if obs.get('garage') and n > 1 else -1
    def win(cx, yb, ww, wh, sill=0.9, f=0):
        xw, yt = cx - m(ww) / 2, yb - m(sill + wh); q = []
        if obs.get('trim') == 'brown': q.append(_r(xw - m(0.18), yt - m(0.18), m(ww + 0.36), m(wh + 0.36), WHITE) + _r(xw - m(0.18), yt - m(0.18), m(ww + 0.36), m(wh + 0.36), 'url(#bwHatchH)', INK, LW * 0.8))
        q.append(_r(xw, yt, m(ww), m(wh), WHITE) + _r(xw, yt, m(ww), m(wh), 'url(#bwGlass)', INK, LW))
        if ww > 1.0: q.append(_l(cx, yt, cx, yt + m(wh), LW * 0.8))
        if obs.get('shutters') == 'roller': q.append(_r(xw, yt, m(ww), m(wh * 0.45), WHITE) + _r(xw, yt, m(ww), m(wh * 0.45), 'url(#bwShutter)', INK, LW * 0.7) + _r(xw - m(0.05), yt - m(0.22), m(ww + 0.1), m(0.22), WHITE, INK, LW * 0.7))
        if obs.get('bars') and f == 0: q.append(''.join(_l(xw + m(ww) * j / 5, yt, xw + m(ww) * j / 5, yt + m(wh), 0.045) for j in range(1, 5)) + _l(xw, yt + m(wh) / 2, xw + m(ww), yt + m(wh) / 2, 0.04))
        if obs.get('hoods'): q.append(_r(xw - m(0.2), yt - m(0.5), m(ww + 0.4), m(0.3), WHITE) + _r(xw - m(0.2), yt - m(0.5), m(ww + 0.4), m(0.3), 'url(#bwTile)', INK, LW))
        if sill > 0: q.append(_r(xw - m(0.08), yb - m(sill), m(ww + 0.16), m(0.08), WHITE, INK, LW * 0.7))
        return ''.join(q)
    def balcony(cx, yb, bw, kind):
        xb = cx - m(bw) / 2; q = [_r(xb - m(0.1), yb - m(0.12), m(bw + 0.2), m(0.18), WHITE, INK, LW)]   # the slab, its edge seen
        if kind == 'balustrade':
            q.append(_l(xb, yb - m(1.0), xb + m(bw), yb - m(1.0), 0.16) + ''.join(f'<ellipse cx="{xb + m(j * 0.2):.2f}" cy="{yb - m(0.55):.2f}" rx="{m(0.06):.2f}" ry="{m(0.38):.2f}" fill="{WHITE}" stroke="{INK}" stroke-width="0.04"/>' for j in range(1, int(bw / 0.2))))
        else:
            q.append(_l(xb, yb - m(1.0), xb + m(bw), yb - m(1.0), 0.12) + ''.join(_l(xb + m(j * 0.13), yb - m(1.0), xb + m(j * 0.13), yb - m(0.1), 0.035) for j in range(1, int(bw / 0.13))))
        return ''.join(q)
    def door(cx, yb, dw=1.0, dh=2.2, arch=False):
        xd = cx - m(dw) / 2
        if arch: d = f'M{xd:.2f},{yb:.2f} V{yb - m(dh - dw / 2):.2f} A{m(dw / 2):.2f},{m(dw / 2):.2f} 0 0 1 {xd + m(dw):.2f},{yb - m(dh - dw / 2):.2f} V{yb:.2f} Z'; return clip_tex('bwBoard', f'<path d="{d}"/>', (xd, yb - m(dh), m(dw), m(dh)), INK, LW * 1.4)
        return _r(xd, yb - m(dh), m(dw), m(dh), WHITE) + _r(xd, yb - m(dh), m(dw), m(dh), 'url(#bwBoard)', INK, LW)
    def garage(cx, yb, dw, col):
        xg = cx - m(dw) / 2; return _r(xg, yb - m(2.3), m(dw), m(2.3), WHITE) + _r(xg, yb - m(2.3), m(dw), m(2.3), f'url(#{DOOR_TEX.get(col, "bwShutter")})', INK, LW)
    # the wall, its base, its panels
    tex = WALL_TEX.get(obs.get('wall', 'white'))
    o.append(_r(x0, top, w, lv * fh, WHITE) + (_r(x0, top, w, lv * fh, f'url(#{tex})') if tex else ''))
    if obs.get('ground_wall') == 'brick': o.append(_r(x0, yg - fh, w, fh, 'url(#bwBrick)'))
    dado = obs.get('dado')
    if dado: o.append(_r(x0, yg - m(0.9), w, m(0.9), WHITE) + _r(x0, yg - m(0.9), w, m(0.9), 'url(#' + {'stone': 'bwRubble', 'paint': 'bwShade', 'tile': 'bwDiamond'}[dado] + ')') + _l(x0, yg - m(0.9), x1, yg - m(0.9), LW))
    if obs.get('panels') == 'brick' and lv > 1: o += [_r(x0 + w / n * k + m(0.25), top + m(0.3), w / n * 0.28, (lv - 1) * fh - m(0.4), 'url(#bwBrick)') for k in range(n)]
    if obs.get('panels') == 'stucco': o.append(_r(x0 + w * 0.3, top, w * 0.4, lv * fh, 'url(#bwDots2)') + _l(x0 + w * 0.3, top, x0 + w * 0.3, yg, LW) + _l(x0 + w * 0.7, top, x0 + w * 0.7, yg, LW))
    if obs.get('trim') == 'brown': o += [_r(x0, yg - f * fh - m(0.1), w, m(0.2), 'url(#bwHatchH)') for f in range(1, lv)]
    # openings
    if w < m(2.2):
        o += [win((x0 + x1) / 2, yg - f * fh, min(0.9, w / K * 0.5), 1.2, f=f) for f in range(lv)]
    else:
        for f in range(lv):
            yb = yg - f * fh
            for k in range(n):
                cx = x0 + w / n * (k + 0.5); bw = w / n / K
                if f == 0 and obs.get('shop'):
                    if obs['shop'] == 'glass': o.append(_r(cx - m(bw / 2 - 0.25), yb - m(2.6), m(bw - 0.5), m(2.3), WHITE) + _r(cx - m(bw / 2 - 0.25), yb - m(2.6), m(bw - 0.5), m(2.3), 'url(#bwGlass)', INK, LW) + _l(cx, yb - m(2.6), cx, yb - m(0.3), 0.05))
                    else: o.append(garage(cx, yb, bw - 0.6, 'white'))
                    continue
                if f == 0 and k == dk:
                    o.append(door(cx, yb - (m(0.6) if obs.get('steps') else 0), 1.0, 2.2, arch=obs.get('door') == 'arch'))
                    if obs.get('steps'): o.append(''.join(_l(cx - m(0.7), yb - m(0.2 * j), cx + m(0.7), yb - m(0.2 * j), 0.05) for j in range(1, 4)) + _l(cx + m(0.75), yb, cx + m(0.75), yb - m(1.5), 0.05))
                    if obs.get('column'): o.append(_r(cx + m(1.0), yb - fh + m(0.2), m(0.32), fh - m(0.2), WHITE, INK, LW) + _l(cx + m(0.92), yb - fh + m(0.35), cx + m(1.4), yb - fh + m(0.35), 0.06))
                    continue
                if f == 0 and k == gk: o.append(garage(cx, yb, min(2.6, bw - 0.5), obs['garage'])); continue
                bal = obs.get('balcony') if f > 0 else None
                if bal:
                    arch = obs.get('arches') and f == lv - 1
                    o.append(win(cx, yb, 1.1, 2.1, 0.0, f) if not arch else door(cx, yb, 1.2, 2.3, arch=True))
                    o.append(balcony(cx, yb, min(2.2, bw - 0.4), bal))
                else: o.append(win(cx, yb, 1.1, 1.3, 0.95, f))
    if obs.get('shop') == 'glass': o.append(_r(x0, yg - m(3.0), w, m(0.4), INK))   # the sign band
    # the roof
    roof = obs.get('roof', 'flat')
    if roof == 'tile':
        ya = top - m(1.0); xa, xb = x0 - m(0.35), x1 + m(0.35); pts = f'{xa:.2f},{top:.2f} {xa + m(0.5):.2f},{ya:.2f} {xb - m(0.5):.2f},{ya:.2f} {xb:.2f},{top:.2f}'
        o.append(clip_tex('bwTile', f'<polygon points="{pts}"/>', (xa, ya, xb - xa, top - ya), INK, LW * 1.3) + _l(xa, top, xb, top, 0.14))
    elif roof == 'metal':
        d = f'M{x0 - m(0.2):.2f},{top:.2f} Q{(x0 + x1) / 2:.2f},{top - m(1.6):.2f} {x1 + m(0.2):.2f},{top:.2f} Z'
        o.append(clip_tex('bwRib', f'<path d="{d}"/>', (x0 - m(0.2), top - m(1.6), w + m(0.4), m(1.6)), INK, LW * 1.3))
    elif roof == 'flat_balustrade':
        o.append(_l(x0, top - m(0.9), x1, top - m(0.9), 0.14) + ''.join(f'<ellipse cx="{x0 + m(j * 0.22):.2f}" cy="{top - m(0.45):.2f}" rx="{m(0.06):.2f}" ry="{m(0.36):.2f}" fill="{WHITE}" stroke="{INK}" stroke-width="0.04"/>' for j in range(1, int(w / m(0.22)))) + _l(x0 - m(0.1), top, x1 + m(0.1), top, 0.12))
    else: o.append(_r(x0, top - m(0.4), w, m(0.4), WHITE, INK, LW) + _l(x0 - m(0.1), top - m(0.4), x1 + m(0.1), top - m(0.4), 0.12))
    if obs.get('chimney') and w > m(4): o.append(_r(x0 + w * 0.72, top - m(2.1), m(0.55), m(1.2), WHITE, INK, LW) + _r(x0 + w * 0.72 - m(0.1), top - m(2.2), m(0.75), m(0.15), INK))
    if obs.get('awning') and lv >= 1:
        for k in range(n):
            cx = x0 + w / n * (k + 0.5); aw = min(2.4, w / n / K - 0.3); xa = cx - m(aw) / 2; ya = yg - (fh if lv > 1 else 0) - m(2.6)
            o.append(clip_tex('bwStripe' if obs['awning'] == 'striped' else 'bwShade', f'<path d="M{xa:.2f},{ya:.2f} H{xa + m(aw):.2f} L{xa + m(aw + 0.2):.2f},{ya + m(0.7):.2f} H{xa - m(0.2):.2f} Z"/>', (xa - m(0.2), ya, m(aw + 0.4), m(0.7)), INK, LW))
    if not far: o.append(_r(x1 - min(w * 0.14, m(1.3)), top, min(w * 0.14, m(1.3)), lv * fh, 'url(#bwShade)'))   # shade: light from the left
    o.append(_r(x0, top, w, lv * fh, 'none', INK, 0.16 if not far else 0.1))
    # what stands in front: the garden wall and its fence, the gate, the pots, a street tree (as the photo shows them)
    gd = obs.get('garden')
    if gd in ('brick_wall', 'white_wall') and w > m(3):
        hw = 0.9 if gd == 'brick_wall' else 1.0
        o.append(_r(x0, yg - m(hw), w, m(hw), WHITE) + (_r(x0, yg - m(hw), w, m(hw), 'url(#bwBrick)') if gd == 'brick_wall' else '') + _r(x0, yg - m(hw), w, m(hw), 'none', INK, LW * 1.4))
        o.append(_l(x0, yg - m(1.8), x1, yg - m(1.8), 0.07) + ''.join(_l(x0 + m(j * 0.18), yg - m(1.8), x0 + m(j * 0.18), yg - m(hw), 0.03) for j in range(1, int(w / m(0.18)))))
        if gd == 'white_wall': o += [_r(x0 + w * q - m(0.2), yg - m(1.9), m(0.4), m(1.9), WHITE, INK, LW) for q in (0.02, 0.5, 0.96)]
    if obs.get('gate') == 'iron' and w > m(3):
        gx = x0 + w * (0.25 + 0.45 * (seed % 2)); o.append(_r(gx - m(1.3), yg - m(1.8), m(2.6), m(1.8), WHITE, INK, 0.08) + ''.join(_l(gx - m(1.3) + m(j * 0.16), yg - m(1.8), gx - m(1.3) + m(j * 0.16), yg, 0.035) for j in range(1, 16)))
    if obs.get('gate') == 'arch_iron' and w > m(4):
        gx = x0 + w * 0.6; r_ = m(1.6); o.append(f'<path d="M{gx - r_:.2f},{yg:.2f} V{yg - m(2.4):.2f} A{r_:.2f},{r_:.2f} 0 0 1 {gx + r_:.2f},{yg - m(2.4):.2f} V{yg:.2f} Z" fill="{WHITE}" stroke="{INK}" stroke-width="0.1"/>'
                                                         + ''.join(_l(gx, yg - m(2.4), gx + r_ * __import__('math').cos(a), yg - m(2.4) - r_ * __import__('math').sin(a), 0.035) for a in [i * 3.1416 / 8 for i in range(1, 8)]) + ''.join(_l(gx - r_ + m(j * 0.2), yg - m(2.4), gx - r_ + m(j * 0.2), yg, 0.03) for j in range(1, 16)))
    if gd == 'pots': o += [f'<ellipse cx="{x0 + m(1 + j * 1.6):.2f}" cy="{yg - m(0.9):.2f}" rx="{m(0.5):.2f}" ry="{m(0.6):.2f}" fill="{WHITE}" stroke="{INK}" stroke-width="0.05"/>' + _r(x0 + m(0.75 + j * 1.6), yg - m(0.4), m(0.5), m(0.4), WHITE, INK, 0.05) for j in range(int(w / m(1.6)))]
    if obs.get('tree') and not far: o.append(tree_kind('round', x0 + w * (0.2 + 0.5 * ((seed // 3) % 2)), yg, K, seed=seed, h=5.5))   # the street tree the photo shows
    return ''.join(o)


# ---- trees as in the owner's reference photo (a square in the Vega, 23 Nov 2026): tall narrow cypresses, rough conical
# conifers, round broadleaf trees on a clear trunk, light small trees, clipped shrubs. Drawn types, not portraits.
def _crown(pts_fn, n, seed, jit):
    import math
    rr = random.Random(seed); P = [pts_fn(i / n, 1 - jit * rr.random()) for i in range(n)]
    d = f'M{P[0][0]:.2f},{P[0][1]:.2f} ' + ' '.join(f'L{p[0]:.2f},{p[1]:.2f}' for p in P[1:]) + ' Z'
    xs = [p[0] for p in P]; ys = [p[1] for p in P]
    return d, (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))


def tree_kind(kind, x, yg, K=2.0, col=INK, sw=0.12, seed=0, h=None):
    import math
    """one tree from the reference photo. kind: cypress | conifer | round | light | shrub; h = height in m (a type size if None)"""
    m = lambda v: v * K; o = ''
    if kind == 'cypress':                         # tall and narrow, widest low down, pointed, a slightly ragged edge
        h = h or 11.0; w = m(h * 0.085); rr = random.Random(seed); n = 22; L = []; Rr = []
        for i in range(n + 1):
            t = i / n; wid = w * (min(1, t * 5) ** 0.6) * (1 - t) ** 0.85 * (0.88 + 0.24 * rr.random()); yy = yg - m(0.5) - m(h - 0.5) * t
            Rr.append((x + wid, yy)); L.append((x - wid * (0.88 + 0.24 * rr.random()), yy))
        P = Rr + list(reversed(L)); d = 'M' + ' L'.join(f'{px:.2f},{py:.2f}' for px, py in P) + ' Z'
        xs = [p[0] for p in P]; ys = [p[1] for p in P]
        return _l(x, yg, x, yg - m(0.6), sw + 0.2).replace(INK, col) + clip_tex('bwDots3', f'<path d="{d}"/>', (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)), col, sw)
    if kind == 'conifer':                         # a rough conifer: a broad irregular cone, bushy edge, uneven sides
        h = h or 9.0; rr = random.Random(seed); n = 30; Rr = []; L = []
        for i in range(n + 1):
            t = i / n; base = m(h * 0.3) * (1 - t) ** 0.95 * min(1, t * 7 + 0.35)
            Rr.append((x + base * (0.75 + 0.5 * rr.random()), yg - m(1.2) - m(h - 1.2) * t)); L.append((x - base * (0.75 + 0.5 * rr.random()), yg - m(1.2) - m(h - 1.2) * t))
        P = Rr + list(reversed(L)); d = 'M' + ' L'.join(f'{px:.2f},{py:.2f}' for px, py in P) + ' Z'
        xs = [p[0] for p in P]; ys = [p[1] for p in P]
        return _l(x, yg, x, yg - m(1.4), sw + 0.25).replace(INK, col) + clip_tex('bwDots3', f'<path d="{d}"/>', (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)), col, sw)
    if kind in ('round', 'light'):                # a broadleaf: a clear trunk, a rounded lumpy crown (light = smaller, airier)
        h = h or (7.5 if kind == 'round' else 6.0); cr = h * (0.34 if kind == 'round' else 0.3); cy = yg - m(h - cr)
        o += f'<path d="M{x - m(0.12):.2f},{yg:.2f} L{x - m(0.08):.2f},{cy + m(cr * 0.4):.2f} L{x + m(0.08):.2f},{cy + m(cr * 0.4):.2f} L{x + m(0.12):.2f},{yg:.2f} Z" fill="{col}"/>'
        rr = random.Random(seed); d = ''; lumps = 14 if kind == 'round' else 11
        P = []
        for i in range(lumps):
            a0 = 2 * math.pi * i / lumps; a1 = 2 * math.pi * (i + 1) / lumps; r0 = m(cr) * (0.72 + 0.34 * rr.random())
            P.append(((x + r0 * math.cos(a0), cy + r0 * 0.9 * math.sin(a0)), (x + m(cr) * 1.18 * math.cos((a0 + a1) / 2), cy + m(cr) * 1.05 * math.sin((a0 + a1) / 2))))
        d = f'M{P[0][0][0]:.2f},{P[0][0][1]:.2f} ' + ' '.join(f'Q{c[0]:.2f},{c[1]:.2f} {P[(i + 1) % lumps][0][0]:.2f},{P[(i + 1) % lumps][0][1]:.2f}' for i, (p, c) in enumerate(P)) + ' Z'
        bb = (x - m(cr) * 1.25, cy - m(cr) * 1.15, m(cr) * 2.5, m(cr) * 2.3)
        o += clip_tex('bwDots2' if kind == 'round' else 'bwDots1', f'<path d="{d}"/>', bb, col, sw)
        return o
    if kind == 'shrub':                           # a clipped shrub, about 1 m
        h = h or 1.1; d = f'M{x - m(0.9):.2f},{yg:.2f} C{x - m(1.0):.2f},{yg - m(h):.2f} {x + m(1.0):.2f},{yg - m(h):.2f} {x + m(0.9):.2f},{yg:.2f} Z'
        return clip_tex('bwDots2', f'<path d="{d}"/>', (x - m(1.0), yg - m(h), m(2.0), m(h)), col, sw)
    return ''
