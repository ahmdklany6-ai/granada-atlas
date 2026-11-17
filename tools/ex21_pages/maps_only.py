"""Exercise 2.1 — every map BY ITSELF (owner, 17 Nov 2026: "maps only, in English"): one image per map, cut to the map's
frame, with the title written on the map, its north arrow and scale bar, and a short credit in the bottom corner (the page's
source line does not travel with a map that is exported alone). No legend, section, chart or text around it: the legends go
to <out>/legends as separate images, the full source sentences to <out>/00_sources_<lang>.txt.
Groups (env ONLY=city,areas,aerial,time,people,sheet,legends; default all):
  city    the four 1:10,000 maps (640 x 560 mm) and the key map of the 1:500 areas (1:25,000)
  areas   the 1:500 areas (260 x 260 mm)              aerial  the same windows on the PNOA photo
  time    built-up by year, dwellings per km2, open land (1:10,000); the ten historical pictures (1931 and 2022 at 1:15,000
          when exports/ex21_time/hist/<name>_hi.jpg is there — tools/fetch_ex21_hist_hi.py — the others at 1:40,000)
  people  mean age (1:10,000) and the five other indicators (1:20,000)
  sheet   the maps exactly as they sit on the two A1 sheets (tools/ex21_pages/sheets2.py): four at 1:15,000, the city map
          at 1:10,000 with the four windows, the four 1:500 crops
Writes PNG from the page canvas (env DPI, default 300). Afterwards, for RGB files with the resolution stored in them:
  NOPDF=1 PHOTO='^(aerial_|history_|time_|people_|sheet1_)' python3 tools/ex21_pages/pack.py <out> <packed> <lang>
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/maps_only.py <out folder> [en|he|ar]"""
import sys, time, base64, subprocess, os, json
sys.path.insert(0, 'tests'); import ui_test_v3 as V3; import _nointro
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _sheet_labels import LABS
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'; DPI = float(os.environ.get('DPI', 300)); PORT = 8859; V3.PORT = PORT; V3.V2.PORT = PORT
ONLY = os.environ['ONLY'].split(',') if os.environ.get('ONLY') else ['city', 'areas', 'aerial', 'time', 'people', 'sheet', 'legends']
AREAS = [a['id'] for a in json.load(open('data/ex21/areas.json'))['areas']]; SHEET_IDS = ['B', 'S', 'R', 'C']   # as in sheets2.py
# the ten pictures of the history sheet (tools/ex21_pages/time.py): file, years, the flight's name as IGN serves it
HIST = [('mtn50', '1931', 'MTN50 1931'), ('ams1956', '1956–1957', 'AMS 1956–1957'), ('inter1973', '1973–1986', 'Interministerial 1973–1986'), ('nac1981', '1981–1986', 'Nacional 1981–1986'),
        ('olistat1997', '1997–1998', 'OLISTAT 1997–1998'), ('sigpac2000', '1997–2003', 'SIGPAC 1997–2003'), ('pnoa2004', '2004', 'PNOA 2004'), ('pnoa2010', '2010', 'PNOA 2010'), ('pnoa2016', '2016', 'PNOA 2016'), ('pnoa2022', '2022', 'PNOA 2022')]
HI = {h[0]: os.path.exists(f'exports/ex21_time/hist/{h[0]}_hi.jpg') for h in HIST}
# credits: proper names and licences only, so one wording serves the three languages
OSM = 'OpenStreetMap contributors (ODbL)'; IGN = '(CC BY 4.0)'
CREDIT = {'island': OSM, 'walk': OSM, 'growth': OSM + ' · INE', 'height': 'Ministerio de Defensa (RD 118/2019) · IGN MDT25 ' + IGN + ' · ' + OSM, 'key': OSM,
          'area': 'D. G. del Catastro · ' + OSM + ' · PNOA © IGN ' + IGN, 'aerial': 'PNOA © IGN ' + IGN + ', {flight} · ' + OSM,
          'built': 'D. G. del Catastro · ' + OSM, 'density': 'D. G. del Catastro · ' + OSM, 'edge': 'D. G. del Catastro · ' + OSM + ' · Ministerio de Defensa (RD 118/2019)',
          'people': 'INE, ADRH {y} · ' + OSM}
specs = []
MATCH = os.environ.get('MATCH', '')   # only the maps whose file name holds this text (for a quick check)
def add(group, folder, name, **sp):
    if group in ONLY and MATCH in name: specs.append(dict(sp, group=group, folder=folder, name=name))
for i, m in enumerate(['island', 'walk', 'growth', 'height'], 1): add('city', '01_city_1-10000', f'city_{i:02d}_{m}', kind='city', m=m, credit=CREDIT[m])
add('city', '01_city_1-10000', 'key_map_areas_1-25000', kind='key', credit=CREDIT['key'])
for a in AREAS: add('areas', '02_areas_1-500', f'area_{a}', kind='area', id=a, credit=CREDIT['area'])
for a in AREAS: add('aerial', '03_areas_aerial_1-500', f'aerial_{a}', kind='aerial', id=a, credit=CREDIT['aerial'])
for m in ['built', 'density', 'edge']: add('time', '04_base_over_time', f'time_{m}_1-10000', kind='time', m=m, credit=CREDIT[m])
for i, (src, years, flight) in enumerate(HIST):
    add('time', '04_base_over_time', f'history_{i:02d}_{years.replace("–", "-")}_{"1-15000" if HI[src] else "1-40000"}', kind='hist', src=src, years=years, flight=flight, hi=HI[src],
        credit=('IGN, ' if not flight.startswith('PNOA') else '') + flight.replace('PNOA', 'PNOA © IGN,') + ' ' + IGN + ' · ' + OSM)
add('people', '05_people', 'people_age_1-10000', kind='people', key='age', credit=CREDIT['people'])
for key in ['u18', 'o65', 'es', 'inc', 'one']: add('people', '05_people', f'people_{key}_1-20000', kind='people', key=key, credit=CREDIT['people'])
for which in ['y1931', 'y2022', 'built', 'age']:
    add('sheet', '06_A1_sheet_maps', f'sheet1_{which}_1-15000', kind='sheetmap', which=which,
        credit={'y1931': 'IGN, MTN50 1931 ' + IGN + ' · ' + OSM, 'y2022': 'PNOA © IGN, 2022 ' + IGN + ' · ' + OSM, 'built': CREDIT['built'], 'age': CREDIT['people']}[which])
add('sheet', '06_A1_sheet_maps', 'sheet2_city_1-10000', kind='sheetcity', ids=SHEET_IDS, credit=OSM)
for a in SHEET_IDS: add('sheet', '06_A1_sheet_maps', f'sheet2_area_{a}_1-500', kind='sheetarea', id=a, credit=CREDIT['area'])
for m in ['island', 'walk', 'growth', 'height']: add('legends', 'legends', f'legend_city_{m}', kind='legend', which='city', m=m)
for w in ['key', 'areas', 'aerial']: add('legends', 'legends', f'legend_{w}', kind='legend', which=w)
for m in ['built', 'density', 'edge']: add('legends', 'legends', f'legend_time_{m}', kind='legend', which='time', m=m)
for key in ['age', 'u18', 'o65', 'es', 'inc', 'one']: add('legends', 'legends', f'legend_people_{key}', kind='legend', which='people', key=key)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([sp, DPI, LAB]) => { await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); await GA.ex21.readyPeople();
  const D = DPI / 25.4, mm = (v) => Math.round(v * D), q = DPI / 200; const t = (k, v) => GA.i18n.t(k, v); const F = GA.pages.font(); const E = GA.ex21.CITY, pal = GA.palette, rtl = GA.i18n.dir() === 'rtl';
  const TD = GA.ex21.time, PD = GA.ex21.people; const unit = (key) => key === 'inc' ? '€' : key === 'age' ? null : '%';
  const load = (u) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error(u)); im.src = u; });
  // the image is the map's frame plus half a millimetre, so the frame line is whole
  const pad = mm(0.5); const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w + 2 * pad; c.height = h + 2 * pad; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return [c, x]; };
  // line and label weight per scale, as on the pages (given for 200 dpi): 1:10,000 city pages 3.8, 1:15,000 sheet maps 2.4, 1:40,000 history frames 1.9
  const KF = { 10000: 3.8, 15000: 2.4, 20000: 2.4, 40000: 1.9 }, TMM = { 10000: 7.5, 15000: 5, 20000: 5, 25000: 4.4, 40000: 4 }, CMM = { 10000: 3, 15000: 2.6, 20000: 2.6, 25000: 2.4, 40000: 2.2 };
  const sc = (den) => '1:' + den.toLocaleString('en-US'); const cr = (den, s) => ({ credit: s, creditPx: mm(CMM[den]) });
  // the whole city frame (6400 × 5600 m) at 1:den
  const whole = (den, draw) => { const w = mm(6400000 / den), h = Math.round(w * 5600 / 6400); const [c, x] = mk(w, h); draw(x, pad, pad, w, h); return c.toDataURL('image/png'); };
  // a window on the frame, centred on the base and kept inside the data (as the A1 sheets do)
  const CX = 442830, CY = 4109470; const crop = (bwmm, bhmm, den, draw) => { const bw = mm(bwmm), bh = mm(bhmm), full = 6400000 / den * D, fullH = full * 5600 / 6400; const hwM = bw / full * 6400 / 2, hhM = bh / full * 6400 / 2;
    const cx0 = Math.min(Math.max(CX, E.x0 + hwM), E.x0 + 6400 - hwM), cy0 = Math.min(Math.max(CY, E.y1 - 5600 + hhM), E.y1 - hhM); const [c, x] = mk(bw, bh);
    draw(x, pad + bw / 2 - (cx0 - E.x0) / 6400 * full, pad + bh / 2 - (E.y1 - cy0) / 6400 * full, full, fullH, [pad, pad, pad + bw, pad + bh]); return c.toDataURL('image/png'); };
  const hist = async (name, hi) => load('/exports/ex21_time/hist/' + name + (hi ? '_hi' : '') + '.jpg');
  if (sp.kind === 'city') return whole(10000, (x, X, Y, w, h) => GA.ex21.drawCity(x, X, Y, w, h, Object.assign({ t, only: sp.m, k: KF[10000] * q, title: t('x34.m.' + sp.m) + ' · ' + sc(10000), titlePx: mm(TMM[10000]) }, cr(10000, sp.credit))));
  if (sp.kind === 'key') return whole(25000, (x, X, Y, w, h) => GA.ex21.drawAreaKey(x, X, Y, w, h, Object.assign({ t, k: w / 1000, title: t('x34.key.title') + ' · ' + sc(25000), titlePx: mm(TMM[25000]) }, cr(25000, sp.credit))));
  if (sp.kind === 'area' || sp.kind === 'aerial') { const M = mm(260); const [c, x] = mk(M, M); const o = { t, k: M / 1000 * 1.05, title: t('x34.a.' + sp.id) + ' · ' + (sp.kind === 'aerial' ? t('x34.aer.sub') : '1:500'), titlePx: mm(4.6), credit: sp.credit, creditPx: mm(2.3) };
    if (sp.kind === 'aerial') { o.aerial = await GA.ex21.loadAerial(sp.id, '/exports/ex21_aerial/'); const idx = (await (await fetch('/exports/ex21_aerial/index.json?r=' + Date.now())).json()).areas[sp.id]; o.credit = sp.credit.replace('{flight}', idx.flight || ''); }
    GA.ex21.drawArea(x, pad, pad, M, sp.id, o); return c.toDataURL('image/png'); }
  if (sp.kind === 'time') return whole(10000, (x, X, Y, w, h) => GA.ex21.drawTime(x, X, Y, w, h, Object.assign({ t, only: sp.m, k: KF[10000] * q, title: t('x36.m.' + sp.m) + ' · ' + sc(10000), titlePx: mm(TMM[10000]) }, cr(10000, sp.credit))));
  if (sp.kind === 'hist') { const den = sp.hi ? 15000 : 40000, im = await hist(sp.src, sp.hi); const lab = sp.src === 'mtn50' ? t('x36.hist.1931', { ha: GA.ex21.km2(TD.aerodrome_1931_ha) }) : sp.flight;
    return whole(den, (x, X, Y, w, h) => GA.ex21.drawTime(x, X, Y, w, h, Object.assign({ t, only: 'photo', photo: im, k: KF[den] * q, title: lab + ' · ' + sc(den), titlePx: mm(TMM[den]) }, cr(den, sp.credit)))); }
  if (sp.kind === 'people') { const den = sp.key === 'age' ? 10000 : 20000; const ttl = sp.key === 'age' ? t('x37.title', { y: PD.adrh_year }) : t('x37.m.' + sp.key) + ' (' + unit(sp.key) + ', INE ' + PD.adrh_year + ')';
    return whole(den, (x, X, Y, w, h) => GA.ex21.drawPeople(x, X, Y, w, h, Object.assign({ t, only: sp.key, k: KF[den] * q, title: ttl + ' · ' + sc(den), titlePx: mm(TMM[den]) }, cr(den, sp.credit.replace('{y}', PD.adrh_year))))); }
  // ---- the maps as they sit on the A1 sheets (sheets2.py: sheet 841 × 594, margin 14, gap 8, top 44) ----
  if (sp.kind === 'sheetmap') { const im = sp.which === 'y1931' ? await hist('mtn50', sp.hi31) : sp.which === 'y2022' ? await hist('pnoa2022', sp.hi22) : null; const o = Object.assign({ t, k: KF[15000] * q, title: LAB[sp.which] + ' · ' + sc(15000), titlePx: mm(4.6) }, cr(15000, sp.credit.replace('{y}', PD.adrh_year)));
    return crop((841 - 2 * 14 - 8) / 2, (594 - 44 - 14 - 8 - 8 - 2 * 12) / 2, 15000, (x, ox, oy, full, fullH, view) => { o.view = view; if (sp.which === 'age') GA.ex21.drawPeople(x, ox, oy, full, fullH, Object.assign(o, { only: 'age' })); else GA.ex21.drawTime(x, ox, oy, full, fullH, Object.assign(o, { only: im ? 'photo' : 'built', photo: im })); }); }
  if (sp.kind === 'sheetcity') return crop(300, 380, 10000, (x, ox, oy, full, fullH, view) => { GA.ex21.drawCity(x, ox, oy, full, fullH, Object.assign({ t, only: 'island', k: 2.6 * DPI / 150, view, title: LAB.city, titlePx: mm(4.4) }, cr(10000, sp.credit)));
    const XX = (u) => ox + (u - E.x0) / 6400 * full, YY = (v) => oy + (E.y1 - v) / 6400 * full; x.save(); x.beginPath(); x.rect(view[0], view[1], view[2] - view[0], view[3] - view[1]); x.clip();
    GA.ex21.areas.areas.filter(a => sp.ids.includes(a.id)).forEach(a => { const e = a.extent; x.fillStyle = 'rgba(153,43,42,.18)'; x.fillRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3])); x.strokeStyle = pal.red; x.lineWidth = mm(0.7); x.strokeRect(XX(e[0]), YY(e[3]), XX(e[2]) - XX(e[0]), YY(e[1]) - YY(e[3]));
      const inner = (e[1] + e[3]) / 2 > CY ? 1 : -1; const bx = XX((e[0] + e[2]) / 2), by = inner > 0 ? YY(e[1]) + mm(6) : YY(e[3]) - mm(6);
      x.beginPath(); x.arc(bx, by, mm(4), 0, 7); x.fillStyle = pal.red; x.fill(); x.fillStyle = '#fff'; x.font = `700 ${mm(4.4)}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr'; x.fillText(a.id, bx, by + mm(0.2)); }); x.restore(); });
  if (sp.kind === 'sheetarea') { const cellW = ((841 - 14 - 300 - 8 - 14) - 8) / 2, mapH = (594 - 44 - 14 - 8 - 8) / 2 - 74 - 3; const A = GA.ex21.areas.areas.find(a => a.id === sp.id); const s0 = A.section, L = s0.samples.length - 1, d = 80; const P = [s0.a[0] + (s0.b[0] - s0.a[0]) * d / L, s0.a[1] + (s0.b[1] - s0.a[1]) * d / L];
    const e = A.extent, hw = cellW / 4, hh = mapH / 4; const c0 = [Math.min(Math.max(P[0], e[0] + hw), e[2] - hw), Math.min(Math.max(P[1], e[1] + hh), e[3] - hh)]; const s2 = 2 * D, bw = mm(cellW), bh = mm(mapH); const [c, x] = mk(bw, bh);
    GA.ex21.drawArea(x, pad + bw / 2 - (c0[0] - e[0]) * s2, pad + bh / 2 - (e[3] - c0[1]) * s2, 130 * s2, sp.id, { t, k: 1.55 * DPI / 150, view: [pad, pad, pad + bw, pad + bh], title: t('x34.a.' + sp.id) + ' · 1:500', titlePx: mm(3.6), credit: sp.credit, creditPx: mm(2.2) }); return c.toDataURL('image/png'); }
  // ---- a legend by itself: the same class definitions as the map (GA.ex21.*Legend), a grey title, one column ----
  if (sp.kind === 'legend') { const items = sp.which === 'city' ? GA.ex21.mapLegend(sp.m, t) : sp.which === 'key' ? GA.ex21.keyLegend(t) : sp.which === 'areas' ? GA.ex21.areaLegend(t) : sp.which === 'aerial' ? GA.ex21.aerialLegend(t) : sp.which === 'time' ? GA.ex21.timeLegend(sp.m, t) : GA.ex21.peopleLegend(sp.key, t);
    const ttl = sp.which === 'city' ? t('x34.m.' + sp.m) : sp.which === 'key' ? t('x34.key.title') : sp.which === 'areas' ? LAB.lgArea : sp.which === 'aerial' ? LAB.lgArea + ' · ' + t('x34.aer.sub') : sp.which === 'time' ? t('x36.m.' + sp.m) : t('x37.m.' + sp.key) + (unit(sp.key) ? ' (' + unit(sp.key) + ')' : '') + ' · INE ' + PD.adrh_year;
    const fs = mm(3.6), rowH = mm(8.5), sw = mm(12), sh = mm(5), mg = mm(4), tfs = mm(4.2); const m0 = document.createElement('canvas').getContext('2d'); m0.font = `500 ${fs}px ${F}`; let tw = 0; items.forEach(it => { tw = Math.max(tw, m0.measureText(it.label).width); }); m0.font = `600 ${tfs}px ${F}`;
    const W = Math.ceil(Math.max(sw + mm(3) + tw, m0.measureText(ttl).width) + 2 * mg), top = mm(13), H = top + items.length * rowH + mm(3); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.textBaseline = 'alphabetic'; x.font = `600 ${tfs}px ${F}`; x.fillStyle = pal.ink3; x.fillText(ttl, rtl ? W - mg : mg, mm(7.5));
    items.forEach((it, j) => { const yy = top + j * rowH + rowH / 2, sx = rtl ? W - mg - sw : mg, lw = (it.w || 1) * 4.5 * q; x.lineCap = 'butt';
      if (it.sw) { x.globalAlpha = it.alpha || 1; x.fillStyle = it.sw; x.fillRect(sx, yy - sh / 2, sw, sh); x.globalAlpha = 1; x.strokeStyle = it.stroke || pal.grey; x.lineWidth = (it.stroke ? 3 : 1.5) * q; x.setLineDash(it.dashed ? [8 * q, 5 * q] : []); x.strokeRect(sx, yy - sh / 2, sw, sh); x.setLineDash([]); }
      if (it.hatch) { x.save(); x.beginPath(); x.rect(sx, yy - sh / 2, sw, sh); x.clip(); x.strokeStyle = it.hatch; x.lineWidth = 2 * q; for (let u = -sh; u < sw; u += mm(1.4)) { x.beginPath(); x.moveTo(sx + u, yy + sh / 2); x.lineTo(sx + u + sh, yy - sh / 2); x.stroke(); } x.restore(); x.strokeStyle = it.hatch; x.lineWidth = 1.5 * q; x.strokeRect(sx, yy - sh / 2, sw, sh); }
      if (it.sym === 'dead') { const r = mm(1.9), cx = sx + sw / 2; x.beginPath(); x.arc(cx, yy, r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = it.line; x.lineWidth = mm(0.6); x.stroke(); x.beginPath(); x.moveTo(cx - r * 0.6, yy); x.lineTo(cx + r * 0.6, yy); x.stroke(); }
      else if (it.line) { x.globalAlpha = it.alpha || 1; x.strokeStyle = it.line; x.lineWidth = lw; x.setLineDash(it.dash ? [14 * q, 8 * q] : it.dots ? [3 * q, 12 * q] : []); x.lineCap = it.dots ? 'round' : 'butt'; x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
        if (it.rail) { x.strokeStyle = '#fff'; x.lineWidth = lw * 0.4; x.setLineDash([10 * q, 10 * q]); x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); x.setLineDash([]); } }
      x.font = `500 ${fs}px ${F}`; x.fillStyle = pal.ink; x.textBaseline = 'middle'; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillText(it.label, rtl ? sx - mm(3) : sx + sw + mm(3), yy); });
    return c.toDataURL('image/png'); }
  throw new Error('unknown kind ' + sp.kind); }'''
# the full source sentences of the pages, for whoever lays the maps out again
SRC_JS = r'''async () => { await GA.ex21.ready(); await GA.ex21.readyAreas(); await GA.ex21.readyTime(); await GA.ex21.readyPeople(); const t = (k, v) => GA.i18n.t(k, v); const PD = GA.ex21.people;
  const idx = await (await fetch('/exports/ex21_aerial/index.json?r=' + Date.now())).json(); const a0 = Object.values(idx.areas)[0] || {};
  return [['01 city — 01 island', t('x34.src.island')], ['01 city — 02 walk', t('x34.src.walk')], ['01 city — 03 growth', t('x34.src.growth')], ['01 city — 04 height', t('x34.src.height')],
    ['03 aerial', t('x34.aer.src', { d: a0.flight || idx.flight || '—', r: a0.resolution_m != null ? a0.resolution_m : (idx.resolution_m != null ? idx.resolution_m : '—') })],
    ['04 time — built', t('x36.src.built')], ['04 time — density', t('x36.src.density')], ['04 time — open land', t('x36.src.edge')], ['04 time — history', t('x36.hist.src')], ['05 people', t('x37.src', { y: PD.adrh_year })]]; }'''
AREA_SRC = 'D. G. del Catastro (buildings, floors) · OpenStreetMap (ODbL) · IGN MDT25 & PNOA (CC BY 4.0) · Origen de los datos: Ministerio de Defensa (RD 118/2019) · heights = floors × 3 m (estimate)'
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page(); V3.stub3(pg); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.GA && GA.ex13 && GA.data', timeout=90000)
    for s in ['js/i18n_v33.js', 'js/ex21.js']: pg.add_script_tag(url='/' + s + '?r=' + str(time.time()))
    pg.wait_for_function('!!(GA.ex21 && GA.ex21.drawArea && GA.ex21.drawPeople)', timeout=20000); pg.evaluate(f'GA.i18n.setLang("{LANG}")')
    for sp in specs:
      if sp['kind'] == 'sheetmap': sp['hi31'] = HI['mtn50']; sp['hi22'] = HI['pnoa2022']
      d = pg.evaluate(JS, [sp, DPI, LABS[LANG]]); od = os.path.join(OUTD, sp['folder']); os.makedirs(od, exist_ok=True)
      open(os.path.join(od, f'{sp["name"]}_{LANG}.png'), 'wb').write(base64.b64decode(d.split(',')[1])); print(sp['folder'], sp['name'], 'ok', flush=True)
    rows = pg.evaluate(SRC_JS); os.makedirs(OUTD, exist_ok=True)
    open(os.path.join(OUTD, f'00_sources_{LANG}.txt'), 'w', encoding='utf-8').write('\n\n'.join(f'{k}\n{v}' for k, v in rows) + '\n\n02 areas 1:500\n' + AREA_SRC + '\n')
    print('errors:', errs[:5])
finally: srv.terminate()
