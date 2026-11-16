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
LAB = {'he': {'sub': 'תרגיל 2.1 · קנה המידה · סטודיו לעיצוב עירוני, גרנדה', 'city': 'העיר · 1:10,000 · הבסיס, הגדר ומה שלאורכה', 'areas': 'האזור · 1:500 · ארבע גדרות שונות', 'y1931': '1931: שדה תעופה קטן (מפת IGN)', 'y2022': '2022: הבסיס היום (PNOA)', 'built': 'הבינוי לפי שנת הבנייה (Catastro)', 'age': 'גיל ממוצע לפי אזור סטטיסטי (INE 2024)', 'new': 'חדש', 'old': 'ישן', 'ageU': 'שנים', 'stats': [['3.71 km²', 'שטח הבסיס היום (ב־1931: 0.44 קמ״ר)'], ['‎+15.3%‎', 'תושבי חמש העיירות 2015–2025'], ['42%', 'מהגדר צמודה למגורים'], ['13', 'דרכים ללא מוצא ליד הגדר'], ['2–75 m', 'גובה מותר ליד הגדר, לפי המקום'], ['‎8–10%‎', 'מועסקים במנהל ציבורי וביטחון']], 'lgCity': 'מקרא · העיר', 'lgArea': 'מקרא · האזורים'},
       'ar': {'sub': 'التمرين 2.1 · المقياس · استوديو التصميم الحضري، غرناطة', 'city': 'المدينة · 1:10,000 · القاعدة والسياج وما على طوله', 'areas': 'المنطقة · 1:500 · أربعة أسيجة مختلفة', 'y1931': '1931: مطار صغير (خريطة IGN)', 'y2022': '2022: القاعدة اليوم (PNOA)', 'built': 'المبني حسب سنة البناء (Catastro)', 'age': 'متوسط العمر حسب القسم الإحصائي (INE 2024)', 'new': 'جديد', 'old': 'قديم', 'ageU': 'سنوات', 'stats': [['3.71 km²', 'مساحة القاعدة اليوم (سنة 1931: 0.44 كم²)'], ['‎+15.3%‎', 'سكان البلدات الخمس 2015–2025'], ['42%', 'من السياج ملاصق للسكن'], ['13', 'طريقًا مسدودًا عند السياج'], ['2–75 m', 'الارتفاع المسموح عند السياج حسب المكان'], ['‎8–10%‎', 'من العاملين في الإدارة العامة والدفاع']], 'lgCity': 'المفتاح · المدينة', 'lgArea': 'المفتاح · المناطق'},
       'en': {'sub': 'Exercise 2.1 · Scale · Urban design studio, Granada', 'city': 'City · 1:10,000 · the base, the fence and what lies along it', 'areas': 'Area · 1:500 · four different fences', 'y1931': '1931: a small aerodrome (IGN map)', 'y2022': '2022: the base today (PNOA)', 'built': 'Built-up by year of construction (Catastro)', 'age': 'Mean age by census section (INE 2024)', 'new': 'new', 'old': 'old', 'ageU': 'years', 'stats': [['3.71 km²', 'the base today (1931: 0.44 km²)'], ['+15.3%', 'residents of the five towns, 2015–2025'], ['42%', 'of the fence touches housing'], ['13', 'dead ends at the fence'], ['2–75 m', 'allowed height at the fence, by place'], ['8–10%', 'employed in public administration and defence']], 'lgCity': 'Legend · city', 'lgArea': 'Legend · areas'}}[LANG]
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([IDS, TX, LAB]) => { await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); await GA.ex21.readyPeople();
  // A1 landscape, 841 × 594 mm. Top band: title. Upper row: texts | city map 1:10,000 | four small maps (time, people).
  // Lower row: the four 1:500 areas with their sections | the legends.  Columns run from the start side (right in he/ar).
  const DPI = 150, D = DPI / 25.4, mm = (v) => v * D; const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const rtl = GA.i18n.dir() === 'rtl'; const pal = GA.palette;
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });
  const wrap = (s, maxW) => { const out = []; s.split('\n').forEach(par => { let line = ''; par.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (x.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); out.push(line); }); return out; };
  const W = Math.round(mm(841)), H = Math.round(mm(594)); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const M = 16; const X0 = (startMm, wMm) => rtl ? W - mm(startMm + wMm) : mm(startMm);          // left edge of a block placed startMm from the start side
  const sx = (px, w) => rtl ? px + w : px;                                                           // where start-aligned text begins in a block
  const font = (sz, wt) => `${wt} ${Math.round(mm(sz))}px ${F}`;
  const txt = (s, px, py, sz, wt, col, al, maxW) => { x.font = font(sz, wt); x.fillStyle = col; x.textAlign = al || (rtl ? 'right' : 'left'); x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(s, px, py, maxW); };
  const label = (s, px, py, w) => txt(s, sx(px, w), py, 3.4, 700, pal.ink, null, w);
  const frame = (px, py, w, h) => { x.strokeStyle = pal.ink; x.lineWidth = mm(0.3); x.strokeRect(px, py, w, h); };
  const rule = (y) => { x.strokeStyle = pal.line2; x.lineWidth = mm(0.25); x.beginPath(); x.moveTo(mm(M), y); x.lineTo(W - mm(M), y); x.stroke(); };
  // ---- title band ----
  txt(TX.title, rtl ? W - mm(M) : mm(M), mm(30), 15, 700, pal.ink); txt(LAB.sub, rtl ? mm(M) : W - mm(M), mm(30), 4.6, 500, pal.red, rtl ? 'left' : 'right');
  rule(mm(37));
  const top = 44, rowH = 290, G = 8;   // grid: 14 mm margins, 8 mm gutters; row 1 = text 200 | city map 300 | small maps 297                                             // upper row: y 46–338 mm
  // ---- texts (start side, 232 mm) ----
  const tw = 200, tX = X0(M, tw); let ty = mm(top + 4);
  [[TX.h[0], TX.phen, 6.4, 700, pal.red, 1.32], [TX.h[1], TX.text, 4.9, 400, pal.ink, 1.5], [TX.h[2], TX.strat, 5.1, 600, pal.ink, 1.45]].forEach(([hd, body, sz, wt, colr, lh], i) => {
    txt(hd.toUpperCase(), sx(tX, mm(tw)), ty, 4.2, 700, pal.ink3); ty += mm(8.5); x.font = font(sz, wt); x.direction = rtl ? 'rtl' : 'ltr';
    wrap(body, mm(tw)).forEach(ln => { txt(ln, sx(tX, mm(tw)), ty, sz, wt, colr); ty += mm(sz * lh); }); ty += mm(i === 0 ? 7 : 6); });
  // key numbers: a 2 × 3 grid of tiles at the foot of the text column
  const st = LAB.stats, bw2 = (tw - G) / 2, bh2 = 25; st.forEach(([v, l], j) => { const cc = j % 2, r = Math.floor(j / 2); const bx = rtl ? tX + mm(tw) - (cc + 1) * mm(bw2) - cc * mm(G) : tX + cc * mm(bw2 + G), by = mm(top + rowH) - (3 - r) * mm(bh2) - (2 - r) * mm(G / 2);
    x.fillStyle = '#F5EAE6'; x.fillRect(bx, by, mm(bw2), mm(bh2)); txt('\u2066' + v + '\u2069', sx(bx + (rtl ? -mm(4) : mm(4)), mm(bw2)), by + mm(11), 8, 700, pal.red, null, mm(bw2 - 8)); x.font = font(3.1, 500); x.direction = rtl ? 'rtl' : 'ltr';
    wrap(l, mm(bw2 - 8)).slice(0, 2).forEach((ln, q) => txt(ln, sx(bx + (rtl ? -mm(4) : mm(4)), mm(bw2)), by + mm(17 + q * 4), 3.1, 500, pal.ink2, null, mm(bw2 - 8))); });
  // ---- city map, true 1:10,000 (1 km = 100 mm), 296 × 292 mm ----
  const cw = 300, cX = X0(M + tw + G, cw), cY = mm(top); const E = GA.ex21.CITY, full = mm(640), CX = 442820, CY = 4109470;
  const ox = cX + mm(cw) / 2 - (CX - E.x0) / 6400 * full, oy = cY + mm(rowH) / 2 - (E.y1 - CY) / 6400 * full;
  x.save(); x.beginPath(); x.rect(cX, cY, mm(cw), mm(rowH)); x.clip(); GA.ex21.drawCity(x, ox, oy, full, full * 5600 / 6400, { t, only: 'island', k: 2.6 });
  const XX = (u) => ox + (u - E.x0) / 6400 * full, YY = (v) => oy + (E.y1 - v) / 6400 * full;
  GA.ex21.areas.areas.filter(a => IDS.includes(a.id)).forEach(a => { const e = a.extent; x.fillStyle = 'rgba(153,43,42,.18)'; x.fillRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3])); x.strokeStyle = pal.red; x.lineWidth = mm(0.7); x.strokeRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3]));
    const inner = (e[1] + e[3]) / 2 > CY ? 1 : -1; const bx = XX((e[0] + e[2]) / 2), by = inner > 0 ? YY(e[1]) + mm(6) : YY(e[3]) - mm(6);
    x.beginPath(); x.arc(bx, by, mm(4), 0, 7); x.fillStyle = pal.red; x.fill(); x.fillStyle = '#fff'; x.font = font(4.4, 700); x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.fillText(a.id, bx, by + mm(0.2)); });
  x.restore(); frame(cX, cY, mm(cw), mm(rowH));
  txt(LAB.city, sx(cX, mm(cw)), cY - mm(2.5), 3.4, 700, pal.ink, null, mm(cw));
  GA.pages.northArrow(x, cX + (rtl ? mm(10) : mm(cw - 10)), cY + mm(6), mm(0.33));
  x.fillStyle = 'rgba(255,255,255,.92)'; const sbx = rtl ? cX + mm(cw - 118) : cX + mm(4); x.fillRect(sbx, cY + mm(rowH - 13), mm(114), mm(10)); x.fillStyle = pal.ink; x.fillRect(sbx + mm(5), cY + mm(rowH - 7), mm(50), mm(1.6)); x.strokeStyle = pal.ink; x.lineWidth = mm(0.25); x.strokeRect(sbx + mm(5), cY + mm(rowH - 7), mm(100), mm(1.6));
  x.font = font(3, 500); x.textAlign = 'center'; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; [['0', 0], ['500', 50], ['1 km', 100]].forEach(([s0, v]) => x.fillText(s0, sbx + mm(5 + v), cY + mm(rowH - 8.5)));
  // ---- four small maps, 2 × 2 (end side, 255 mm): 1931 · 2022 · built by age · mean age ----
  const gw = 841 - M - tw - G - cw - G - M, gX = X0(M + tw + G + cw + G, gw), pw = (gw - G) / 2, ph = pw * 5600 / 6400;
  const [m31, p22] = await Promise.all([load('/exports/ex21_time/hist/mtn50.jpg'), load('/exports/ex21_time/hist/pnoa2022.jpg')]);
  const cell = (j) => { const r = Math.floor(j / 2), cc = j % 2; const px = rtl ? gX + mm(gw) - (cc + 1) * mm(pw) - cc * mm(G) : gX + cc * mm(pw + G); return [px, cY + mm(4) + r * mm(rowH / 2)]; };
  [[m31, LAB.y1931, 'photo'], [p22, LAB.y2022, 'photo'], [null, LAB.built, 'built'], [null, LAB.age, 'age']].forEach(([im, lb, kind], j) => { const [px, py] = cell(j);
    txt(lb, sx(px, mm(pw)), py - mm(2.5), 3, 700, pal.ink, null, mm(pw));
    if (kind === 'age') GA.ex21.drawPeople(x, px, py, mm(pw), mm(ph), { t, only: 'age', k: mm(pw) / 1000 * 1.3, small: true });
    else GA.ex21.drawTime(x, px, py, mm(pw), mm(ph), { t, only: kind, photo: im, k: mm(pw) / 1000 * 1.3, noScale: true, noNorth: true });
    // a colour key under the two thematic maps
    const keys = kind === 'built' ? GA.ex21.time.periods.map(q => ({ sw: `rgb(${q[3].join(',')})` })) : kind === 'age' ? GA.ex21.peopleLegend('age', t) : null;
    if (keys) { const kw = mm(pw) / keys.length; keys.forEach((k2, i) => { const qx = px + (rtl ? keys.length - 1 - i : i) * kw; x.globalAlpha = k2.alpha || 1; x.fillStyle = k2.sw; x.fillRect(qx, py + mm(ph + 2.5), kw - mm(0.5), mm(2.6)); x.globalAlpha = 1; });
      x.font = font(2.5, 500); x.fillStyle = pal.ink2; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; const lo = kind === 'built' ? '<1940' : keys[0].label, hi = kind === 'built' ? '2016+' : keys[keys.length - 1].label;
      x.textAlign = rtl ? 'right' : 'left'; x.fillText(lo, rtl ? px + mm(pw) : px, py + mm(ph + 9)); x.textAlign = rtl ? 'left' : 'right'; x.fillText(hi, rtl ? px : px + mm(pw), py + mm(ph + 9));
      x.textAlign = 'center'; x.fillText(kind === 'built' ? (rtl ? '← ' + LAB.new + ' · ' + LAB.old + ' →' : '← ' + LAB.old + ' · ' + LAB.new + ' →') : LAB.ageU, px + mm(pw) / 2, py + mm(ph + 9)); } });
  rule(mm(top + rowH + 6));
  // ---- lower row: the four areas, each 70 × 70 m at 1:500 (140 mm) with its section ----
  const bY = top + rowH + 14, aw = 140, ag = G; const secImgs = await Promise.all(IDS.map(id => load('/exports/ex21_sec/section_' + id + '.svg?r=' + Date.now())));
  IDS.forEach((id, i) => { const A = GA.ex21.areas.areas.find(a => a.id === id); const px = X0(M + i * (aw + ag), aw), py = mm(bY);
    x.font = font(3.4, 700); const ttl = t('x34.a.' + id); label(ttl, px, py, mm(aw));
    const s0 = A.section, L = s0.samples.length - 1, d = 72; const P = [s0.a[0] + (s0.b[0] - s0.a[0]) * d / L, s0.a[1] + (s0.b[1] - s0.a[1]) * d / L];
    const e = A.extent, half = 35; const c0 = [Math.min(Math.max(P[0], e[0] + half), e[2] - half), Math.min(Math.max(P[1], e[1] + half), e[3] - half)]; const s2 = mm(2);
    const my = py + mm(4); x.save(); x.beginPath(); x.rect(px, my, mm(aw), mm(aw)); x.clip(); GA.ex21.drawArea(x, px + mm(aw) / 2 - (c0[0] - e[0]) * s2, my + mm(aw) / 2 - (e[3] - c0[1]) * s2, 130 * s2, id, { t, k: 1.55 }); x.restore();
    frame(px, my, mm(aw), mm(aw)); GA.pages.northArrow(x, px + mm(aw - 6), my + mm(4), mm(0.25));
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(px + mm(3), my + mm(aw - 10), mm(48), mm(8)); x.fillStyle = pal.ink; x.fillRect(px + mm(6), my + mm(aw - 5), mm(20), mm(1.2)); x.strokeStyle = pal.ink; x.lineWidth = mm(0.2); x.strokeRect(px + mm(6), my + mm(aw - 5), mm(40), mm(1.2));
    x.font = font(2.6, 500); x.textAlign = 'center'; x.direction = 'ltr'; x.textBaseline = 'alphabetic'; [['0', 0], ['10', 20], ['20 m', 40]].forEach(([s1, v]) => x.fillText(s1, px + mm(6 + v), my + mm(aw - 6)));
    const im = secImgs[i], swmm = im.naturalWidth / (96 / 25.4), shmm = im.naturalHeight / (96 / 25.4); const sy0 = my + mm(aw + 2), shown = mm(Math.min(shmm - 22, 594 - M - 8 - (bY + 4 + aw + 2)));
    x.save(); x.beginPath(); x.rect(px, sy0, mm(aw), shown); x.clip(); x.drawImage(im, px - mm(10 + 2 * (d - 35)), sy0 - mm(8), mm(swmm), mm(shmm)); x.restore(); });
  // ---- legends (end side of the lower row) ----
  const lw = 841 - M - 4 * aw - 3 * ag - G - M, lX = X0(M + 4 * aw + 3 * ag + G, lw); let ly = mm(bY + 2);
  const legend = (items, title) => { txt(title, sx(lX, mm(lw)), ly, 4, 700, pal.ink3, null, mm(lw)); ly += mm(7);
    items.forEach(it => { const sw0 = rtl ? lX + mm(lw - 8) : lX; const yy = ly - mm(1.2);
      if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sw0, yy - mm(1.8), mm(8), mm(3.6)); x.globalAlpha = 1; x.strokeStyle = it.stroke || '#8C817A'; x.lineWidth = mm(0.22); x.setLineDash(it.dashed ? [mm(1), mm(0.7)] : []); x.strokeRect(sw0, yy - mm(1.5), mm(8), mm(3)); x.setLineDash([]); }
      if (it.hatch) { x.strokeStyle = it.hatch; x.lineWidth = mm(0.2); x.strokeRect(sw0, yy - mm(1.5), mm(8), mm(3)); for (let q = 0; q < 8; q += 1.6) { x.beginPath(); x.moveTo(sw0 + mm(q), yy + mm(1.5)); x.lineTo(sw0 + mm(Math.min(8, q + 3)), yy - mm(1.5)); x.stroke(); } }
      if (it.sym === 'dead') { x.beginPath(); x.arc(sw0 + mm(4), yy, mm(1.4), 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.line; x.lineWidth = mm(0.4); x.stroke(); x.beginPath(); x.moveTo(sw0 + mm(3.2), yy); x.lineTo(sw0 + mm(4.8), yy); x.stroke(); }
      else if (it.line) { x.strokeStyle = it.line; x.lineWidth = mm(0.35 * (it.w || 1)); x.setLineDash(it.dash ? [mm(1.6), mm(0.9)] : []); x.beginPath(); x.moveTo(sw0, yy); x.lineTo(sw0 + mm(8), yy); x.stroke(); x.setLineDash([]); }
      txt(it.label, rtl ? sw0 - mm(2) : sw0 + mm(10), ly, 3.5, 500, pal.ink, null, mm(lw - 11)); ly += mm(5.6); }); ly += mm(5); };
  legend(GA.ex21.mapLegend('island', t).concat([{ sw: 'rgba(153,43,42,.18)', stroke: pal.red, label: t('x34.lg.window') }]), LAB.lgCity);
  const want = ['x34.lg.base', 'x34.lg.street', 'x34.lg.path', 'x34.lg.place', 'x34.lg.water', 'x34.lg.hu', 'x34.lg.canopy', 'x34.lg.dead', 'x34.lg.secline'];
  legend(GA.ex21.areaLegend(t).filter(it => !want.includes('x34.lg.base') || true).filter(it => !/OSM, 3/.test(it.label)).slice(0, 14), LAB.lgArea);
  // sources along the bottom edge
  x.font = font(2.5, 400); x.fillStyle = pal.ink3; x.textAlign = rtl ? 'right' : 'left'; x.direction = rtl ? 'rtl' : 'ltr'; x.textBaseline = 'alphabetic'; x.fillText(TX.src, rtl ? W - mm(M) : mm(M), H - mm(7), W - mm(2 * M));
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
