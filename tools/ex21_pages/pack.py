#!/usr/bin/env python3
"""Exercise 2.1: pack the 300-dpi page renders for the owner.
For every PNG the page scripts wrote: an RGB image with its print resolution stored in the file (PNG, lossless, for drawings;
JPEG quality 95 without chroma subsampling for pages that hold aerial photos or the scanned 1931 map) and a PDF at the true
page size made from that same image without re-encoding (img2pdf). Env: PHOTO (pattern of the file names that become JPEG),
NOPDF=1 (images only). Usage (repo root): python3 tools/ex21_pages/pack.py <in dir> <out dir> <lang> [dpi]   (pip install img2pdf)"""
import os, sys, re, time
from PIL import Image
import img2pdf
Image.MAX_IMAGE_PIXELS = None
IN, OUT, LANG = sys.argv[1], sys.argv[2], sys.argv[3]; DPI = int(sys.argv[4]) if len(sys.argv) > 4 else 300
# photo pages and the single history frames → JPEG; env PHOTO = another pattern (the map-only export names its files differently)
PHOTO = re.compile(os.environ.get('PHOTO') or r'^(aerial_|time_01_history|sheet_A1_maps|factory_05_aerial|\d\d_)')
NOPDF = bool(os.environ.get('NOPDF'))   # images only
rows = []
for folder in sorted(os.listdir(os.path.join(IN, LANG))):
    for root, _, files in os.walk(os.path.join(IN, LANG, folder)):
        for f in sorted(files):
            if not f.endswith('.png'): continue
            src = os.path.join(root, f); rel = os.path.relpath(root, os.path.join(IN, LANG)); od = os.path.join(OUT, LANG, rel); os.makedirs(od, exist_ok=True)
            frame = os.path.basename(root) == 'frames'; photo = bool(PHOTO.match(f)); t = time.time()
            im = Image.open(src).convert('RGB'); stem = f[:-4]
            if photo: img = os.path.join(od, stem + '.jpg'); im.save(img, quality=95, subsampling=0, dpi=(DPI, DPI), optimize=True)
            else: img = os.path.join(od, stem + '.png'); im.save(img, dpi=(DPI, DPI), compress_level=6)
            pdf = None
            if not frame and not NOPDF:
                pdf = os.path.join(od, stem + '.pdf'); open(pdf, 'wb').write(img2pdf.convert(img, layout_fun=img2pdf.get_fixed_dpi_layout_fun((DPI, DPI))))
            rows.append((os.path.join(rel, os.path.basename(img)), im.size[0], im.size[1], round(im.size[0] / DPI * 25.4), round(im.size[1] / DPI * 25.4), os.path.getsize(img), os.path.getsize(pdf) if pdf else 0))
            print(f'{rel}/{stem}: {im.size[0]}x{im.size[1]} px = {rows[-1][3]}x{rows[-1][4]} mm, image {rows[-1][5] / 1e6:.1f} MB, pdf {rows[-1][6] / 1e6:.1f} MB, {time.time() - t:.0f}s', flush=True)
print('pages', len(rows), 'images MB', round(sum(r[5] for r in rows) / 1e6), 'pdf MB', round(sum(r[6] for r in rows) / 1e6))
