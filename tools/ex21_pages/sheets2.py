"""Exercise 2.1 — TWO A1 sheets (owner, 17 Nov 2026): sheet 1 = the four maps (1931, 2022, built by age, mean age) at 1:10,000; sheet 2 = the city map + the four 1:500 areas with sections.
Older notes: the A1 sheet (841 × 594 mm, landscape), Hebrew by default (owner, 16 Nov 2026), Arabic copy.
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
TX = md(f'exports/ex21_text/text_{LANG}.md')
LAB = {'he': {'sub': 'תרגיל 2.1 · קנה המידה · סטודיו לעיצוב עירוני, גרנדה', 'city': 'העיר · 1:10,000 · הבסיס, הגדר ומה שלאורכה', 'areas': 'האזור · 1:500 · ארבע גדרות שונות', 'y1931': '1931: שדה תעופה קטן (מפת IGN)', 'y2022': '2022: הבסיס היום (PNOA)', 'built': 'הבינוי לפי שנת הבנייה (Catastro)', 'age': 'גיל ממוצע לפי אזור סטטיסטי (INE 2024)', 'new': 'חדש', 'old': 'ישן', 'sheetMaps': 'לוח 1 · הבסיס לאורך הזמן ומי גר סביבו', 'sheetAreas': 'לוח 2 · העיר 1:10,000 והאזורים 1:500', 'ageU': 'שנים', 'stats': [['3.71 km²', 'שטח הבסיס היום (ב־1931: 0.44 קמ״ר)'], ['‎+15.3%‎', 'תושבי חמש העיירות 2015–2025'], ['42%', 'מהגדר צמודה למגורים'], ['13', 'דרכים ללא מוצא ליד הגדר'], ['2–75 m', 'גובה מותר ליד הגדר, לפי המקום'], ['‎8–10%‎', 'מועסקים במנהל ציבורי וביטחון']], 'lgCity': 'מקרא · העיר', 'lgArea': 'מקרא · האזורים'},
       'ar': {'sub': 'التمرين 2.1 · المقياس · استوديو التصميم الحضري، غرناطة', 'city': 'المدينة · 1:10,000 · القاعدة والسياج وما على طوله', 'areas': 'المنطقة · 1:500 · أربعة أسيجة مختلفة', 'y1931': '1931: مطار صغير (خريطة IGN)', 'y2022': '2022: القاعدة اليوم (PNOA)', 'built': 'المبني حسب سنة البناء (Catastro)', 'age': 'متوسط العمر حسب القسم الإحصائي (INE 2024)', 'new': 'جديد', 'old': 'قديم', 'sheetMaps': 'اللوحة 1 · القاعدة عبر الزمن ومن يسكن حولها', 'sheetAreas': 'اللوحة 2 · المدينة 1:10,000 والمناطق 1:500', 'ageU': 'سنوات', 'stats': [['3.71 km²', 'مساحة القاعدة اليوم (سنة 1931: 0.44 كم²)'], ['‎+15.3%‎', 'سكان البلدات الخمس 2015–2025'], ['42%', 'من السياج ملاصق للسكن'], ['13', 'طريقًا مسدودًا عند السياج'], ['2–75 m', 'الارتفاع المسموح عند السياج حسب المكان'], ['‎8–10%‎', 'من العاملين في الإدارة العامة والدفاع']], 'lgCity': 'المفتاح · المدينة', 'lgArea': 'المفتاح · المناطق'},
       'en': {'sub': 'Exercise 2.1 · Scale · Urban design studio, Granada', 'city': 'City · 1:10,000 · the base, the fence and what lies along it', 'areas': 'Area · 1:500 · four different fences', 'y1931': '1931: a small aerodrome (IGN map)', 'y2022': '2022: the base today (PNOA)', 'built': 'Built-up by year of construction (Catastro)', 'age': 'Mean age by census section (INE 2024)', 'new': 'new', 'old': 'old', 'sheetMaps': 'Sheet 1 · the base over time and who lives around it', 'sheetAreas': 'Sheet 2 · city 1:10,000 and areas 1:500', 'ageU': 'years', 'stats': [['3.71 km²', 'the base today (1931: 0.44 km²)'], ['+15.3%', 'residents of the five towns, 2015–2025'], ['42%', 'of the fence touches housing'], ['13', 'dead ends at the fence'], ['2–75 m', 'allowed height at the fence, by place'], ['8–10%', 'employed in public administration and defence']], 'lgCity': 'Legend · city', 'lgArea': 'Legend · areas'}}[LANG]
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([IDS, TX, LAB, MODE]) => { await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); await GA.ex21.readyPeople();
  const DPI = __DPI__, KS = DPI / 150, D = DPI / 25.4, mm = (v) => v * D; const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl'; const pal = GA.palette;
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });
  const W = Math.round(mm(841)), H = Math.round(mm(594)); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const M = 14, G = 8; const X0 = (s0, w) => rtl ? W - mm(s0 + w) : mm(s0); const sx = (px, w) => rtl ? px + w : px;
  const font = (sz, wt) => `${wt} ${Math.round(mm(sz))}px ${F}`;
  const txt = (s, px, py, sz, wt, col, al, maxW) => { x.font = font(sz, wt); x.fillStyle = col; x.textAlign = al || (rtl ? 'right' : 'left'); x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(s, px, py, maxW); };
  const wrap = (s, maxW) => { const out = []; s.split('\n').forEach(par => { let line = ''; par.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); out.push(line); }); return out; };
  const frame = (px, py, w, h) => { x.strokeStyle = pal.ink; x.lineWidth = mm(0.3); x.strokeRect(px, py, w, h); };
  const rule = (y) => { x.strokeStyle = pal.line2; x.lineWidth = mm(0.25); x.beginPath(); x.moveTo(mm(M), y); x.lineTo(W - mm(M), y); x.stroke(); };
  // ---- title band ----

  const top = 44, G2 = G;
  // the city frame at TRUE 1:10,000 (640 × 560 mm), cropped to a box centred on the base
  const E = GA.ex21.CITY, full = mm(640), fullH = full * 5600 / 6400, CX = 442830, CY = 4109470;
  // keep the crop inside the data frame (6400 × 5600 m), so no blank strip at a map's side (owner, Map Studio 17 Nov 2026)
  const clampC = (bw, bh, fullPx) => { const hwM = bw / fullPx * 6400 / 2, hhM = bh / fullPx * 6400 / 2; return [Math.min(Math.max(CX, E.x0 + hwM), E.x0 + 6400 - hwM), Math.min(Math.max(CY, E.y1 - 5600 + hhM), E.y1 - hhM)]; };
  // a window on the city frame: draw(ox, oy, view) gets the frame's origin and the visible window; the map itself writes its title
  // (grey, on the map), its north arrow and its scale bar on that window (GA.ex21: o.view, o.title)
  const cityBox = (bx, by, bw, bh, fullPx, draw) => { const [cx0, cy0] = clampC(bw, bh, fullPx); const ox = bx + bw / 2 - (cx0 - E.x0) / 6400 * fullPx, oy = by + bh / 2 - (E.y1 - cy0) / 6400 * fullPx; x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip(); draw(ox, oy, [bx, by, bx + bw, by + bh]); x.restore(); frame(bx, by, bw, bh); };
  const drawLeg = (legItems, lX, lw, ytop, lh, lcols, fs) => { const lcw = lw / lcols, lrows = Math.ceil(legItems.length / lcols);
    legItems.forEach((it, j) => { const col = Math.floor(j / lrows), row = j % lrows; const bx = rtl ? lX + mm(lw) - (col + 1) * mm(lcw) : lX + col * mm(lcw); const yy = mm(ytop + row * lh); const sw0 = rtl ? bx + mm(lcw - 9) : bx;
    if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sw0, yy - mm(1.8), mm(9), mm(3.6)); x.globalAlpha = 1; x.strokeStyle = it.stroke || '#8C817A'; x.lineWidth = mm(0.22); x.setLineDash(it.dashed ? [mm(1), mm(0.7)] : []); x.strokeRect(sw0, yy - mm(1.8), mm(9), mm(3.6)); x.setLineDash([]); }
    if (it.hatch) { x.strokeStyle = it.hatch; x.lineWidth = mm(0.2); x.strokeRect(sw0, yy - mm(1.8), mm(9), mm(3.6)); for (let q = 0; q < 9; q += 1.6) { x.beginPath(); x.moveTo(sw0 + mm(q), yy + mm(1.8)); x.lineTo(sw0 + mm(Math.min(9, q + 3.6)), yy - mm(1.8)); x.stroke(); } }
    if (it.sym === 'dead') { x.beginPath(); x.arc(sw0 + mm(4.5), yy, mm(1.5), 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.line; x.lineWidth = mm(0.4); x.stroke(); x.beginPath(); x.moveTo(sw0 + mm(3.6), yy); x.lineTo(sw0 + mm(5.4), yy); x.stroke(); }
    else if (it.line) { x.strokeStyle = it.line; x.lineWidth = mm(0.35 * (it.w || 1)); x.setLineDash(it.dash ? [mm(1.6), mm(0.9)] : []); x.beginPath(); x.moveTo(sw0, yy); x.lineTo(sw0 + mm(9), yy); x.stroke(); x.setLineDash([]); }
    txt(it.label, rtl ? sw0 - mm(2.5) : sw0 + mm(11.5), yy + mm(1.3), fs, 500, pal.ink, null, mm(lcw - 14)); });
 };
  txt(TX.title, rtl ? W - mm(M) : mm(M), mm(28), 14, 600, pal.ink3); rule(mm(34));   // every title in grey (owner, Map Studio 17 Nov 2026)
  if (MODE === 'maps') {
    const full15 = mm(6400 / 15), fullH15 = full15 * 5600 / 6400;
    // four maps at 1:10,000, 2 × 2, each 398.5 × 236 mm (3.99 × 2.36 km), a key line under each
    const cw2 = (841 - 2 * M - G) / 2, ch2 = (594 - top - M - 8 - G - 2 * 12) / 2;
    const [m31, p22] = await Promise.all([load('/exports/ex21_time/hist/mtn50.jpg'), load('/exports/ex21_time/hist/pnoa2022.jpg')]);
    [[m31, LAB.y1931, 'photo'], [p22, LAB.y2022, 'photo'], [null, LAB.built, 'built'], [null, LAB.age, 'age']].forEach(([im, lb, kind], j) => { const cc = j % 2, r = Math.floor(j / 2);
      const px = X0(M + cc * (cw2 + G), cw2), py = mm(top + r * (ch2 + 12 + G));
      cityBox(px, py, mm(cw2), mm(ch2), full15, (ox, oy, view) => { const o = { t, k: 1.8 * KS, view, title: lb + ' · 1:15,000', titlePx: mm(4.6) };
        if (kind === 'age') GA.ex21.drawPeople(x, ox, oy, full15, fullH15, Object.assign(o, { only: 'age' })); else GA.ex21.drawTime(x, ox, oy, full15, fullH15, Object.assign(o, { only: kind, photo: im })); });
      const keys = kind === 'built' ? GA.ex21.time.periods.map(q => ({ sw: `rgb(${q[3].join(',')})`, label: t('x36.per.' + q[0]) })) : kind === 'age' ? GA.ex21.peopleLegend('age', t).map((q, i) => i === 0 ? Object.assign({}, q, { label: q.label }) : q) : null;
      if (keys) { const kw = mm(cw2) / keys.length; keys.forEach((k2, i) => { const qx = px + (rtl ? keys.length - 1 - i : i) * kw; x.globalAlpha = k2.alpha || 1; x.fillStyle = k2.sw; x.fillRect(qx, py + mm(ch2 + 2), kw - mm(1), mm(3.2)); x.globalAlpha = 1;
        x.font = font(3, 500); x.fillStyle = pal.ink2; x.textAlign = 'center'; x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(k2.label, qx + kw / 2, py + mm(ch2 + 10), kw - mm(2)); }); }
      else { x.font = font(3, 500); x.fillStyle = pal.ink3; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(kind === 'photo' && j === 0 ? 'IGN · MTN50, 1931 (CC BY 4.0)' : 'PNOA © IGN, 2022 (CC BY 4.0)', sx(px, mm(cw2)), py + mm(ch2 + 8)); } });
  } else {
    // city map 1:10,000 (start side) with its legend under it; the four areas 2 × 2 beside it
    const cw = 300, chh = 380, cX = X0(M, cw), cY = mm(top + 2);
    cityBox(cX, cY, mm(cw), mm(chh), full, (ox, oy, view) => { GA.ex21.drawCity(x, ox, oy, full, fullH, { t, only: 'island', k: 2.6 * KS, view, title: LAB.city, titlePx: mm(4.4) });
      const XX = (u) => ox + (u - E.x0) / 6400 * full, YY = (v) => oy + (E.y1 - v) / 6400 * full;
      GA.ex21.areas.areas.filter(a => IDS.includes(a.id)).forEach(a => { const e = a.extent; x.fillStyle = 'rgba(153,43,42,.18)'; x.fillRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3])); x.strokeStyle = pal.red; x.lineWidth = mm(0.7); x.strokeRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3]));
        const inner = (e[1] + e[3]) / 2 > CY ? 1 : -1; const bx = XX((e[0] + e[2]) / 2), by = inner > 0 ? YY(e[1]) + mm(6) : YY(e[3]) - mm(6);
        x.beginPath(); x.arc(bx, by, mm(4), 0, 7); x.fillStyle = pal.red; x.fill(); x.fillStyle = '#fff'; x.font = font(4.4, 700); x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.fillText(a.id, bx, by + mm(0.2)); }); });
    const legItems = GA.ex21.mapLegend('island', t).concat([{ sw: 'rgba(153,43,42,.18)', stroke: pal.red, label: t('x34.lg.window') }]).concat(GA.ex21.areaLegend(t).filter(it => !/3\.71|3,71/.test(it.label)).slice(0, 14));
    const ly = top + 2 + chh + 9; drawLeg(legItems, cX, cw, ly, Math.min(7.4, (594 - M - 8 - ly) / Math.ceil(legItems.length / 2)), 2, 3.3);
    // the four areas
    const aw0 = 841 - M - cw - G - M, aX0 = M + cw + G; const cellW = (aw0 - G) / 2, cellH = (594 - top - M - 8 - G) / 2, secH = 74, mapH = cellH - secH - 3;
  const secImgs = await Promise.all(IDS.map(id => load('/exports/ex21_sec/section_' + id + '.svg?r=' + Date.now())));
  const gy = await Promise.all(IDS.map(async id => { const sv = await (await fetch('/exports/ex21_sec/section_' + id + '.svg?r=' + Date.now())).text(); const m = sv.match(/id="ground-cut-[^"]*"><polygon points="([^"]+)"/);
    const pts = m[1].trim().split(' ').map(q => q.split(',').map(Number)); const fx = 10 + 2 * 95; let best = pts[0]; pts.forEach(q => { if (Math.abs(q[0] - fx) < Math.abs(best[0] - fx)) best = q; }); return best[1]; }));
  IDS.forEach((id, i) => { const A = GA.ex21.areas.areas.find(a => a.id === id); const cc = i % 2, rr = Math.floor(i / 2); const px = X0(aX0 + cc * (cellW + G), cellW), py = mm(top + 2 + rr * (cellH + G));
    const s0 = A.section, L = s0.samples.length - 1, d = 80; const P = [s0.a[0] + (s0.b[0] - s0.a[0]) * d / L, s0.a[1] + (s0.b[1] - s0.a[1]) * d / L];
    const e = A.extent, hw = cellW / 4, hh = mapH / 4; const c0 = [Math.min(Math.max(P[0], e[0] + hw), e[2] - hw), Math.min(Math.max(P[1], e[1] + hh), e[3] - hh)]; const s2 = mm(2);
    const my = py; GA.ex21.drawArea(x, px + mm(cellW) / 2 - (c0[0] - e[0]) * s2, my + mm(mapH) / 2 - (e[3] - c0[1]) * s2, 130 * s2, id, { t, k: 1.55 * KS, view: [px, my, px + mm(cellW), my + mm(mapH)], title: t('x34.a.' + id) + ' · 1:500', titlePx: mm(3.6) });
    frame(px, my, mm(cellW), mm(mapH));
    const im = secImgs[i], swmm = im.naturalWidth / (96 / 25.4), shmm = im.naturalHeight / (96 / 25.4); const sy0 = my + mm(mapH + 3);
    const dEnd = Math.min(L, 95 + 22), dStart = dEnd - cellW / 2; const base = sy0 + mm(secH - 10);
    x.save(); x.beginPath(); x.rect(px, sy0, mm(cellW), mm(secH)); x.clip(); x.drawImage(im, px - mm(10 + 2 * dStart), base - mm(gy[i]), mm(swmm), mm(shmm)); x.restore(); });

  }
  x.font = font(2.4, 400); x.fillStyle = pal.ink3; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(TX.src, rtl ? W - mm(M) : mm(M), H - mm(6), W - mm(2 * M));
  return c.toDataURL('image/png'); }'''
DPI = int(os.environ.get('DPI', 150)); JS = JS.replace('__DPI__', str(DPI))
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/palette.js', 'js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawPeople)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    os.makedirs(OUTD, exist_ok=True)
    for MODE in ('maps', 'areas'):
      d = pg.evaluate(JS, [IDS, TX, LAB, MODE]); open(os.path.join(OUTD, f'sheet_A1_{MODE}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(MODE, 'ok')
    print('errors:', errs[:5])
finally: srv.terminate()
