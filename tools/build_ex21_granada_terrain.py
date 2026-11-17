#!/usr/bin/env python3
"""Exercise 2.1 — the terrain under the A1 map of Granada at 1:25,000 (tools/ex21_pages/granada_a1.py): elevation tint
(the atlas's own ramp, data/manifest.json terrain.elevRamp) times a hillshade (sun from the north-west, 45°), from IGN MDT25
(data/terrain/dem_mdt25.bin, 25 m, CC BY 4.0), resampled to 5 m per pixel over the map frame (EPSG:25830).
Output: exports/ex21_granada/terrain.png (git-ignored). Usage: python3 tools/build_ex21_granada_terrain.py"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FR = (435650, 4106000, 455600, 4120350); PX = 5   # the map frame of granada_a1.py
m = json.load(open(os.path.join(ROOT, 'data/manifest.json')))['terrain']; d = m['dem']
z = np.fromfile(os.path.join(ROOT, 'data', d['file']), dtype='<i2').reshape(d['height'], d['width']).astype(np.float32)
z[z == d['nodata']] = np.nan; z = np.where(np.isnan(z), np.nanmin(z), z)
dy, dx = np.gradient(z, d['py'], d['px']); slope = np.arctan(np.hypot(dx, dy)); aspect = np.arctan2(-dx, dy)
az, alt = np.radians(315), np.radians(45)
hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)   # north up: row 0 = north
W, H = int((FR[2] - FR[0]) / PX), int((FR[3] - FR[1]) / PX)
xs = FR[0] + (np.arange(W) + 0.5) * PX; ys = FR[3] - (np.arange(H) + 0.5) * PX
cols = (xs - d['ox']) / d['px'] - 0.5; rows = (d['oy'] - ys) / d['py'] - 0.5
C, R = np.meshgrid(cols, rows)
zz = ndimage.map_coordinates(z, [R, C], order=3, mode='nearest'); hh = ndimage.map_coordinates(hs, [R, C], order=3, mode='nearest')
ramp = m['elevRamp'][:-1]; ev = np.array([r[0] for r in ramp], float); rgb = np.array([r[1] for r in ramp], float)
img = np.stack([np.interp(zz, ev, rgb[:, i]) for i in range(3)], -1)
img = 255 - (255 - img) * 0.55                                     # a little lighter than the app, for print
shade = np.clip(0.97 + 0.07 * (hh - np.median(hh)) / (np.percentile(hh, 98) - np.median(hh) + 1e-6), 0.90, 1.0)
img = np.clip(img * shade[..., None], 0, 255).astype(np.uint8)
Image.fromarray(img).save(os.path.join(ROOT, 'exports/ex21_granada/terrain.png'), optimize=True)
print(W, H, 'z', float(zz.min()), float(zz.max()))
