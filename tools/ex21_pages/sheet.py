"""Exercise 2.1 — the A1 sheet (841 × 594 mm, landscape), Hebrew by default (owner, 16 Nov 2026), Arabic copy.
City level: the base and its fence at TRUE 1:10,000 (cropped to the base), the four 1:500 windows marked; area level: four
1:500 windows (B tallest blocks, S sports centre, R river, C road with the lowest ceiling), each cropped to 70 × 70 m around
its section, with the section at 1:500; side column: 1931 map vs 2022 photo, built-up by age, mean age; the texts.
Needs: exports/ex21_sec/section_<id>.svg (STYLE=detail), exports/ex21_time/hist/{mtn50,pnoa2022}.jpg.
Usage: python3 tools/ex21_pages/sheet.py <out folder> [he|ar|en]"""
import sys, time, base64, subprocess, os, json
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'he'; PORT = 8858; V3.PORT = PORT; V3.V2.PORT = PORT
IDS = ['B', 'S', 'R', 'C']
def md(path):  # the three texts from the markdown file of that language
    s = open(path, encoding='utf-8').read(); parts = s.split('\n## ')
    return {'title': s.split('\n')[0].lstrip('# ').strip(), 'phen': parts[1].split('\n', 1)[1].strip(), 'text': parts[2].split('\n', 1)[1].strip(), 'strat': parts[3].split('\n', 1)[1].split('\n---')[0].strip(),
            'h': [p.split('\n', 1)[0].strip() for p in parts[1:4]], 'src': s.split('\n---\n')[1].strip()}
TX = md(f'exports/ex21_text/text_{LANG if LANG != "en" else "he"}.md')
LAB = {'he': {'sub': 'תרגיל 2.1 · קנה המידה · סטודיו לעיצוב עירוני, גרנדה', 'city': 'העיר · 1:10,000 · הבסיס, הגדר ומה שלאורכה', 'areas': 'האזור · 1:500 · ארבע גדרות שונות', 'y1931': '1931: שדה תעופה קטן (מפת IGN)', 'y2022': '2022: הבסיס היום (PNOA)', 'built': 'הבינוי לפי שנת הבנייה (Catastro)', 'age': 'גיל ממוצע לפי אזור סטטיסטי (INE 2024)', 'new': 'חדש', 'old': 'ישן'},
       'ar': {'sub': 'التمرين 2.1 · المقياس · استوديو التصميم الحضري، غرناطة', 'city': 'المدينة · 1:10,000 · القاعدة والسياج وما على طوله', 'areas': 'المنطقة · 1:500 · أربعة أسيجة مختلفة', 'y1931': '1931: مطار صغير (خريطة IGN)', 'y2022': '2022: القاعدة اليوم (PNOA)', 'built': 'المبني حسب سنة البناء (Catastro)', 'age': 'متوسط العمر حسب القسم الإحصائي (INE 2024)', 'new': 'جديد', 'old': 'قديم'},
       'en': {'sub': 'Exercise 2.1 · Scale · Urban design studio, Granada', 'city': 'City · 1:10,000 · the base, the fence and what lies along it', 'areas': 'Area · 1:500 · four different fences', 'y1931': '1931: a small aerodrome (IGN map)', 'y2022': '2022: the base today (PNOA)', 'built': 'Built-up by year of construction (Catastro)', 'age': 'Mean age by census section (INE 2024)', 'new': 'new', 'old': 'old'}}[LANG]
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([IDS, TX, LAB]) => { await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); await GA.ex21.readyPeople();
  const DPI = 150, D = DPI / 25.4, mm = (v) => v * D; const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl'; const pal = GA.palette;
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });
  const wrap = (x, s, maxW) => { const out = []; s.split('\n').forEach(par => { let line = ''; par.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); out.push(line); }); return out; };
  const W = Math.round(mm(841)), H = Math.round(mm(594)); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const M = mm(14); const col = (startMm, wMm) => rtl ? W - mm(startMm) - mm(wMm) : mm(startMm);   // a column measured from the start side
  const txt = (s, px, py, size, wt, color, align, maxW) => { x.font = `${wt} ${Math.round(mm(size))}px ${F}`; x.fillStyle = color; x.textAlign = align || (rtl ? 'right' : 'left'); x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(s, px, py, maxW); };
  // ---- title band ----
  txt(TX.title, rtl ? W - M : M, mm(27), 13, 700, pal.ink); txt(LAB.sub, rtl ? W - M : M, mm(36), 5, 500, pal.red);
  // ---- column 1 (start side): city map at 1:10,000 cropped to the base, then the texts ----
  const cx0 = col(14, 330), cy0 = mm(48), cw = mm(330), ch = mm(300); const E = GA.ex21.CITY; const full = mm(640);   // the city frame at 1:10,000 = 640 mm wide
  const CX = 442950, CY = 4109480; const ox = cx0 + cw / 2 - (CX - E.x0) / 6400 * full, oy = cy0 + ch / 2 - (E.y1 - CY) / 6400 * full;
  txt(LAB.city, rtl ? cx0 + cw : cx0, cy0 - mm(3), 5.5, 700, pal.ink);
  x.save(); x.beginPath(); x.rect(cx0, cy0, cw, ch); x.clip(); GA.ex21.drawCity(x, ox, oy, full, full * 5600 / 6400, { t, only: 'island', k: 2.6 });
  const XX = (u) => ox + (u - E.x0) / 6400 * full, YY = (v) => oy + (E.y1 - v) / 6400 * full;
  GA.ex21.areas.areas.filter(a => IDS.includes(a.id)).forEach(a => { const e = a.extent; x.strokeStyle = pal.red; x.lineWidth = mm(0.7); x.strokeRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3]));
    const bx = XX((e[0] + e[2]) / 2), by = YY(e[3]) - mm(5); x.beginPath(); x.arc(bx, by, mm(3.6), 0, 7); x.fillStyle = pal.red; x.fill(); x.fillStyle = '#fff'; x.font = `700 ${Math.round(mm(4))}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.fillText(a.id, bx, by + mm(0.2)); });
  x.restore(); x.strokeStyle = pal.ink; x.lineWidth = mm(0.35); x.strokeRect(cx0, cy0, cw, ch);
  // north + scale (1 km = 100 mm at 1:10,000)
  GA.pages.northArrow(x, cx0 + cw - mm(9), cy0 + mm(6), mm(0.33)); x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(cx0 + mm(4), cy0 + ch - mm(13), mm(112), mm(10)); x.fillStyle = pal.ink; x.fillRect(cx0 + mm(8), cy0 + ch - mm(7), mm(50), mm(1.6)); x.strokeStyle = pal.ink; x.lineWidth = mm(0.25); x.strokeRect(cx0 + mm(8), cy0 + ch - mm(7), mm(100), mm(1.6));
  x.font = `500 ${Math.round(mm(3))}px ${F}`; x.textAlign = 'center'; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; [['0', 0], ['500', 50], ['1 km', 100]].forEach(([s, v]) => x.fillText(s, cx0 + mm(8 + v), cy0 + ch - mm(8.5)));
  // legend of the city map (compact, two columns)
  const items = GA.ex21.mapLegend('island', t).concat([{ sw: 'rgba(153,43,42,.15)', stroke: pal.red, label: t('x34.lg.window') }]); let ly = cy0 + ch + mm(7);
  items.forEach((it, j) => { const cc = j % 2, lx = rtl ? cx0 + cw - (cc + 1) * cw / 2 : cx0 + cc * cw / 2, yy = ly + Math.floor(j / 2) * mm(5.4); const sx = rtl ? lx + cw / 2 - mm(8) : lx;
    if (it.sw) { x.fillStyle = it.sw; x.fillRect(sx, yy - mm(1.6), mm(8), mm(3.2)); x.strokeStyle = it.stroke || '#8C817A'; x.lineWidth = mm(0.25); x.strokeRect(sx, yy - mm(1.6), mm(8), mm(3.2)); }
    if (it.hatch) { x.strokeStyle = it.hatch; x.lineWidth = mm(0.2); x.strokeRect(sx, yy - mm(1.6), mm(8), mm(3.2)); for (let q = 0; q < 8; q += 1.5) { x.beginPath(); x.moveTo(sx + mm(q), yy + mm(1.6)); x.lineTo(sx + mm(Math.min(8, q + 3)), yy - mm(1.6)); x.stroke(); } }
    if (it.line) { x.strokeStyle = it.line; x.lineWidth = mm(0.4 * (it.w || 1)); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + mm(8), yy); x.stroke(); }
    x.font = `500 ${Math.round(mm(3))}px ${F}`; x.fillStyle = pal.ink; x.textBaseline = 'middle'; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.fillText(it.label, rtl ? sx - mm(2) : sx + mm(10), yy, cw / 2 - mm(13)); });
  // texts
  let ty = ly + Math.ceil(items.length / 2) * mm(5.4) + mm(6); const tx = rtl ? cx0 + cw : cx0;
  [[TX.h[0], TX.phen, 5.6, 700, pal.red], [TX.h[1], TX.text, 4.6, 400, pal.ink], [TX.h[2], TX.strat, 4.8, 600, pal.ink]].forEach(([hd, body, sz, wt, colr]) => {
    txt(hd, tx, ty, 4, 700, pal.ink3); ty += mm(6.4); x.font = `${wt} ${Math.round(mm(sz))}px ${F}`; x.direction = rtl ? 'rtl' : 'ltr'; wrap(x, body, cw).forEach(ln => { txt(ln, tx, ty, sz, wt, colr); ty += mm(sz * 1.42); }); ty += mm(3); });
  // ---- column 2: the four areas (2 × 2), each 70 × 70 m around its section, and the section ----
  const ax0 = mm(14 + 330 + 12), aw = mm(140), gap = mm(12), cellH = mm(258); const A2 = rtl ? W - ax0 - 2 * aw - gap : ax0;
  txt(LAB.areas, rtl ? A2 + 2 * aw + gap : A2, cy0 - mm(3), 5.5, 700, pal.ink);
  const secImgs = await Promise.all(IDS.map(id => load('/exports/ex21_sec/section_' + id + '.svg?r=' + Date.now())));
  IDS.forEach((id, i) => { const A = GA.ex21.areas.areas.find(a => a.id === id); const ccol = rtl ? 1 - (i % 2) : i % 2; const px = A2 + ccol * (aw + gap), py = cy0 + Math.floor(i / 2) * cellH + mm(4);
    txt(t('x34.a.' + id), rtl ? px + aw : px, py + mm(4), 3.9, 700, pal.ink, null, aw);
    const s0 = A.section, L = s0.samples.length - 1, d = 72; const P = [s0.a[0] + (s0.b[0] - s0.a[0]) * d / L, s0.a[1] + (s0.b[1] - s0.a[1]) * d / L];
    const e = A.extent, half = 35; const c0 = [Math.min(Math.max(P[0], e[0] + half), e[2] - half), Math.min(Math.max(P[1], e[1] + half), e[3] - half)]; const s2 = mm(2);   // 1 m = 2 mm
    const my = py + mm(7); x.save(); x.beginPath(); x.rect(px, my, aw, aw); x.clip(); GA.ex21.drawArea(x, px + aw / 2 - (c0[0] - e[0]) * s2, my + aw / 2 - (e[3] - c0[1]) * s2, 130 * s2, id, { t, k: 1.55 }); x.restore();
    x.strokeStyle = pal.ink; x.lineWidth = mm(0.3); x.strokeRect(px, my, aw, aw); GA.pages.northArrow(x, px + aw - mm(6), my + mm(4), mm(0.25));
    // scale bar 0–10–20 m (1:500)
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(px + mm(3), my + aw - mm(10), mm(48), mm(8)); x.fillStyle = pal.ink; x.fillRect(px + mm(6), my + aw - mm(5), mm(20), mm(1.2)); x.strokeRect(px + mm(6), my + aw - mm(5), mm(40), mm(1.2));
    x.font = `500 ${Math.round(mm(2.6))}px ${F}`; x.textAlign = 'center'; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; [['0', 0], ['10', 20], ['20 m', 40]].forEach(([s, v]) => x.fillText(s, px + mm(6 + v), my + aw - mm(6)));
    // the section at 1:500: the same 70 m (d 37–107), its top band and its ground
    const im = secImgs[i], swmm = im.naturalWidth / (96 / 25.4), shmm = im.naturalHeight / (96 / 25.4); const sx0 = px - mm(10 + 2 * (d - 35)), sy0 = my + aw + mm(3); const shown = mm(Math.min(shmm - 14, 80));
    x.save(); x.beginPath(); x.rect(px, sy0, aw, shown); x.clip(); x.drawImage(im, sx0, sy0 - mm(6), mm(swmm), mm(shmm)); x.restore(); });
  // ---- column 3 (end side): time and people ----
  const rw = mm(841 - 14 - 330 - 12 - 2 * 140 - 12 - 12 - 14), rx = rtl ? M : W - M - rw; let ry = cy0;
  const [m31, p22] = await Promise.all([load('/exports/ex21_time/hist/mtn50.jpg'), load('/exports/ex21_time/hist/pnoa2022.jpg')]); const pw = (rw - mm(4)) / 2, ph = pw * 5600 / 6400;
  [[m31, LAB.y1931], [p22, LAB.y2022]].forEach(([im, lb], j) => { const qx = rtl ? rx + rw - (j + 1) * pw - j * mm(4) : rx + j * (pw + mm(4)); txt(lb, rtl ? qx + pw : qx, ry + mm(3), 2.6, 700, pal.ink, null, pw); GA.ex21.drawTime(x, qx, ry + mm(5), pw, ph, { t, only: 'photo', photo: im, k: pw / 1000 * 1.4, noScale: true, noNorth: true }); });
  ry += ph + mm(14); const bh = rw * 5600 / 6400;
  txt(LAB.built, rtl ? rx + rw : rx, ry, 3.6, 700, pal.ink, null, rw); GA.ex21.drawTime(x, rx, ry + mm(2), rw, bh, { t, only: 'built', k: rw / 1000 * 1.3, noScale: true });
  const per = GA.ex21.time.periods; per.forEach(([key, a, b, cc], j) => { const w2 = rw / per.length; x.fillStyle = `rgb(${cc.join(',')})`; x.fillRect(rx + (rtl ? per.length - 1 - j : j) * w2, ry + bh + mm(4), w2 - mm(0.5), mm(3)); });
  x.font = `500 ${Math.round(mm(2.6))}px ${F}`; x.fillStyle = pal.ink2; x.textBaseline = 'alphabetic'; x.direction = 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillText(rtl ? '2016+' : '<1940', rtl ? rx + rw : rx, ry + bh + mm(10)); x.textAlign = rtl ? 'left' : 'right'; x.fillText(rtl ? '<1940' : '2016+', rtl ? rx : rx + rw, ry + bh + mm(10));
  ry += bh + mm(18); txt(LAB.age, rtl ? rx + rw : rx, ry, 3.6, 700, pal.ink, null, rw); GA.ex21.drawPeople(x, rx, ry + mm(2), rw, bh, { t, only: 'age', k: rw / 1000 * 1.3, small: true });
  const pl = GA.ex21.peopleLegend('age', t); pl.forEach((it, j) => { const w2 = rw / pl.length, qx = rx + (rtl ? pl.length - 1 - j : j) * w2; x.globalAlpha = 0.85; x.fillStyle = it.sw; x.fillRect(qx, ry + bh + mm(4), w2 - mm(0.5), mm(3)); x.globalAlpha = 1;
    x.font = `500 ${Math.round(mm(2.4))}px ${F}`; x.fillStyle = pal.ink2; x.textAlign = 'center'; x.direction = 'ltr'; x.fillText(it.label, qx + w2 / 2, ry + bh + mm(10), w2); });
  // sources along the bottom
  x.font = `400 ${Math.round(mm(2.6))}px ${F}`; x.fillStyle = pal.ink3; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(TX.src, rtl ? W - M : M, H - mm(6), W - 2 * M);
  return c.toDataURL('image/png'); }'''
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/palette.js', 'js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawPeople)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    d = pg.evaluate(JS, [IDS, TX, LAB]); open(os.path.join(OUTD, f'sheet_A1_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print('sheet ok')
    print('errors:', errs[:5])
finally: srv.terminate()
