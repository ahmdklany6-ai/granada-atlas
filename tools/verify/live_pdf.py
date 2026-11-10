# Live check of the print PDF page-size fix (5.26): the published js/pdf.js keeps the page exactly the paper size, and
# GA.pdf.buildStrips run in the published page writes an A3 landscape MediaBox of exactly 1190.55 x 841.89 pt.
import os, re, time, urllib.request
from playwright.sync_api import sync_playwright
SITE = os.environ.get('SITE', 'https://granada-atlas-597777.gitlab.io/')
src = urllib.request.urlopen(SITE + 'js/pdf.js?v=5.26&nocache=' + str(time.time()), timeout=30).read().decode()
print(('ok  ' if 'const W = paper[0], H = paper[1]' in src else 'FAIL') + ' published js/pdf.js has the paper-size fix')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.goto(SITE, wait_until='load'); pg.wait_for_function('!!(window.GA && GA.pdf && GA.pdf.buildStrips)', timeout=60000)
    box = pg.evaluate('''async () => { const j = new Uint8Array([0xFF,0xD8,0xFF,0xD9]);
      const bl = GA.pdf.buildStrips([{bytes: j, w: 2480, h: 1754, x: 0, y: 0}], [1190.55, 841.89], 150, {title: 't'}, [2480, 1754]);
      const s = new TextDecoder('latin1').decode(await bl.arrayBuffer()); return (s.match(/MediaBox \\[0 0 ([\\d.]+) ([\\d.]+)\\]/) || []).slice(1); }''')
    print(('ok  ' if box == ['1190.55', '841.89'] else 'FAIL') + f' live page: A3 landscape MediaBox {box}')
    b.close()
