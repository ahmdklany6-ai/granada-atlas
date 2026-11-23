"""Writes ex22_colours_rhino.py next to ex22_three_alternatives.obj/.mtl (tools/ex22_pages/model3d_combined.py): a RhinoPython
script (Rhino 7 IronPython and Rhino 8 CPython) with a table of the model's colours — one line per layer and colour — where the
owner writes a new colour and runs the script (owner, 23 Nov 2026: "how do I change a colour in Rhino?"). The model's colours
are stored on the mesh vertices (that is what makes them show on import), so the usual layer colour does not change them;
this script rewrites those vertex colours. A switch at the top removes the vertex colours instead, after which the usual Rhino
ways (layer colour, Properties > Object > Display colour) apply.
Usage (repo root): python3 tools/ex22_pages/model3d_colour_script.py <folder with ex22_three_alternatives.mtl>
Not part of the site or of the tests."""
import os, sys, collections

D = sys.argv[1]
MTL = os.path.join(D, 'ex22_three_alternatives.mtl')


def layer_of(g):   # the same switchable layers as model3d_combined.layer_of
    if g.startswith('0_CONTEXT_buildings'): return '0_CONTEXT_buildings'
    if g.startswith('0_CONTEXT_'): return '0_CONTEXT_ground_streets_fence'
    if g.startswith('0_GREEN_'): return '0_GREEN_landuse_water_trees_schematic'
    if g.startswith('9_'): return '9_CHECK_flight_ceiling_approx'
    return {'1': '1_RESIDENTS', '2': '2_DEVELOPER', '3': '3_DEFENCE'}[g[0]]


WORDS = {  # plain names of the parts (English, as on the sheets)
    'buildings_apartments': 'existing buildings', 'buildings_houses': 'existing buildings', 'buildings_public': 'existing buildings',
    'buildings_shops_offices': 'existing buildings', 'buildings_height_unknown_6m': 'existing buildings', 'buildings_industrial': 'existing buildings',
    'base_closed_land': 'the base land inside the fence', 'fence_height_not_mapped': 'the fence', 'metro_track': 'the metro track',
    'streets': 'streets', 'terrain': 'the ground', 'terrain_sides': 'the sides of the model block',
    'farmland': 'farmland', 'orchards': 'orchards', 'parks_grass': 'parks and grass', 'trees_SCHEMATIC_crown': 'tree crowns (schematic trees)',
    'trees_SCHEMATIC_trunk': 'tree trunks', 'water': 'rivers and ditches',
    'allotments': 'allotments', 'playground': 'playground', 'fence_walk': 'fence walk', 'river_square': 'river square',
    'footbridge': 'footbridges', 'hall_2_floors': 'neighbourhood hall', 'pavilion_1_floor': 'rest stop / farm hall', 'meadow': 'meadows',
    'park': 'park', 'paths': 'paths', 'river_banks': 'river banks', 'tree_crown': 'tree crowns', 'tree_trunk': 'tree trunks',
    'block_3_floors': 'housing blocks', 'block_4_floors': 'housing blocks', 'block_5_floors': 'housing blocks', 'block_6_floors': 'housing blocks',
    'garden_courts': 'garden courts', 'phase2_if_base_leaves_5_floors': 'phase 2 on the base', 'station_square': 'station square',
    'clear_zone': 'clear zone', 'inner_fence': 'inner fence', 'mast_8m': 'masts', 'open_land_crops': 'open land (crops)', 'patrol_road': 'patrol road'}


def part(g):
    k = g.split('_', 2)[2] if g[0] in '123' else g.split('_', 2)[2] if g.startswith(('0_CONTEXT_', '0_GREEN_')) else g
    return WORDS.get(k, k.replace('_', ' '))


mtl = collections.OrderedDict(); cur = None
for ln in open(MTL):
    if ln.startswith('newmtl '): cur = ln.split()[1]
    elif ln.startswith('Kd ') and cur: mtl[cur] = '#%02X%02X%02X' % tuple(int(float(v) * 255 + 0.5) for v in ln.split()[1:4])
rows = collections.OrderedDict()
for g, c in mtl.items():
    if g.startswith('9_'): continue
    rows.setdefault((layer_of(g), c), [])
    if part(g) not in rows[(layer_of(g), c)]: rows[(layer_of(g), c)].append(part(g))
w1 = max(len(l) for l, _ in rows) + 4; w2 = max(len(', '.join(p)) for p in rows.values()) + 4
table = '\n'.join("    (%-*s %-*s '%s', '')," % (w1, repr(l) + ',', w2, repr(', '.join(p)) + ',', c) for (l, c), p in rows.items())

SCRIPT = '''# Exercise 2.2 - change the colours of ex22_three_alternatives in Rhino (7 or 8)
#
# HOW TO USE
#   1. In the table below, write the NEW colour (hex, like '#2F4654') in the last column of the line you want to change.
#      Leave '' to keep a colour as it is.
#   2. Save this file, then in Rhino type  RunPythonScript  and pick this file
#      (Rhino 8 also: type ScriptEditor, File > Open this file, press Run).
#   3. Undo works as usual (Ctrl+Z) if you do not like the result.
#
# WHY A SCRIPT: the colours of this model are stored on the mesh vertices (that is what makes them show when the OBJ is
# imported). Rhino shows those vertex colours instead of the layer colour, so changing the layer colour does nothing on
# these meshes. This script rewrites the vertex colours. Each line = one colour on one layer; parts that share a colour on a
# layer change together (they are listed on the same line).
#
# REMOVE_VERTEX_COLOURS = True instead removes the stored colours from every mesh; after that the usual Rhino ways work
# (Layers panel: click the colour swatch; or Properties > Object > Display Color), but every object starts with its layer colour.
import Rhino
import scriptcontext as sc
import System
import System.Drawing as SD

REMOVE_VERTEX_COLOURS = False

COLOURS = [
#   (layer,  parts with this colour on that layer,  colour now,  NEW colour)
%s
]


def _rgb(h):
    h = h.strip().lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


ROWS = [(lay, what, _rgb(now), _rgb(new) if new.strip() else None) for lay, what, now, new in COLOURS]


def _target(layer, rgb):
    """the new colour for a vertex colour on a layer: the nearest 'colour now' on that layer (on any layer if the layer was
    renamed); None = keep"""
    cands = [r for r in ROWS if r[0] == layer] or ROWS
    best = min(cands, key=lambda r: abs(r[2][0] - rgb[0]) + abs(r[2][1] - rgb[1]) + abs(r[2][2] - rgb[2]))
    if abs(best[2][0] - rgb[0]) + abs(best[2][1] - rgb[1]) + abs(best[2][2] - rgb[2]) > 24: return None
    if layer not in [r[0] for r in ROWS]:   # renamed layer: only when every line with this colour asks for the same new colour
        news = set(r[3] for r in cands if r[2] == best[2])
        if len(news) != 1: return None
    return best[3]


def main():
    meshes = sc.doc.Objects.GetObjectList(Rhino.DocObjects.ObjectType.Mesh)
    n_obj = n_changed = 0
    for obj in meshes:
        n_obj += 1
        mesh = obj.Geometry
        vc = mesh.VertexColors
        if REMOVE_VERTEX_COLOURS:
            if vc.Count:
                m = mesh.DuplicateMesh(); m.VertexColors.Clear()
                if sc.doc.Objects.Replace(obj.Id, m): n_changed += 1
            continue
        if vc.Count == 0 or vc.Count != mesh.Vertices.Count: continue
        layer = sc.doc.Layers[obj.Attributes.LayerIndex].Name
        argb = list(vc.ToARGBArray())
        cache = {}
        for a in set(argb):
            c = SD.Color.FromArgb(a)
            t = _target(layer, (c.R, c.G, c.B))
            cache[a] = SD.Color.FromArgb(255, t[0], t[1], t[2]) if t else None
        if not any(cache.values()): continue
        m = mesh.DuplicateMesh()
        if len(cache) == 1:   # one colour on the whole mesh: fast
            m.VertexColors.CreateMonotoneMesh(list(cache.values())[0])
            att = obj.Attributes.Duplicate()   # the same colour as display colour, for wireframe views
            att.ColorSource = Rhino.DocObjects.ObjectColorSource.ColorFromObject
            att.ObjectColor = list(cache.values())[0]
            sc.doc.Objects.ModifyAttributes(obj, att, True)
        else:
            cols = [cache[a] if cache[a] else SD.Color.FromArgb(a) for a in argb]
            try:
                m.VertexColors.SetColors(System.Array[SD.Color](cols))
            except Exception:
                for i, c in enumerate(cols): m.VertexColors.SetColor(i, c)
        if sc.doc.Objects.Replace(obj.Id, m): n_changed += 1
    sc.doc.Views.Redraw()
    print('ex22 colours: %%d of %%d meshes changed.' %% (n_changed, n_obj))


main()
''' % table

out = os.path.join(D, 'ex22_colours_rhino.py')
open(out, 'w').write(SCRIPT)
print(out); print(table)
