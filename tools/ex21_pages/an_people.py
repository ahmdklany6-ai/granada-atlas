"""Exercise 2.1 — who lives around the base, in the ANALYSIS print style (owner, 20 Nov 2026): black, greys and white, ONE red per map.
English only. Content carried over from tools/ex21_pages/people.py (data/ex21/people.json):
  ages  01  mean age by census section at TRUE 1:10,000 (640 x 560 mm) and five small maps of the same frame (under 18, 65+, Spanish
            nationality, income per person, one-person households; each 121.6 mm wide as on the old page = about 1:52,600).
            red = the value of each map, as one ramp of the red (darker = more); the base is a white void behind its fence.
  work  02  what the employed residents do: 100 % bars by branch for the five towns and Granada city (A2 landscape).
            red = the branch "public administration and defence" (the soldiers question); the other ten branches in greys, each
            segment carries its number (1-11, the key is in the bars' order), the wide segments their percentage; then the text
            about the soldiers and the table "the five towns in numbers".
The furniture comes from tools/ex21_pages/_analysis.py; the maps and bars from GA.ex21.drawPeople / drawBranchBars after
GA.ex21.setStyle('analysis'). Every number is read from the data at run time.
Usage (repo root; Playwright + Chromium): python3 tools/ex21_pages/an_people.py <out folder> [ages,work]   (env DPI, default 200)"""
import sys, time, subprocess, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from _analysis import AN_JS, launch, save
from playwright.sync_api import sync_playwright
OUTD = sys.argv[1]; ALL = ['ages', 'work']; ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else ALL
DPI = float(os.environ.get('DPI', 200)); PORT = 8865
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
JS = r'''async ([m, DPI]) => { await GA.ex21.ready(); await GA.ex21.readyPeople(); GA.ex21.setStyle('analysis'); ''' + AN_JS + r'''
  const t = (k, v) => GA.i18n.t(k, v), D0 = GA.ex21.data, PD = GA.ex21.people, mm = AN.mm, C = AN.pal.ex21; const KF = AN.K;   // the line and label weight of a 1:10,000 map
  const split = (s) => { const i = s.indexOf(': '); return i > 0 ? [s.slice(0, i).toUpperCase(), s.slice(i + 2).trim()] : [s.toUpperCase(), '']; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const NB = String.fromCharCode(160), nb = (s) => s.replace(/(\d) (%|km²|km|min|m)(?=[\s,.;:)—]|$)/g, '$1' + NB + '$2');   // a figure stays on one line with its unit
  const tf = (k, v, fb) => { const s = t(k, v); return s === k ? fb : s; };
  // a section with no published value is hatched in grey (GA.ex21.drawPeople draws it with the same colour)
  const NOVAL = (key) => PD.sections.some(sc => sc[key] == null) ? [{ hatch: AN.pal.tour.missing, dir: 1, label: 'No value published' }] : [];

  if (m === 'ages') { const [ttl, sub] = split(t('x37.title', { y: PD.adrh_year })); const U = 1.4;
    const val = (key) => PD.sections.map(sc => sc[key]).filter(v => v != null), ages = val('age');
    // what the map is printed on, as key rows (the same colours, widths and dashes drawPeople draws)
    const ground = [{ sw: AN.INK, alpha: 0.22, label: t('x34.lg.built') + ', printed over the class colour: where in a section people live' }, { line: AN.GR, wk: 1.1, dk: [6, 4], label: tf('x41.time.muni', null, 'Municipal boundary (IGN via es-atlas, simplified)') },
      GA.ex21.baseItem(t, false)];
    const key = GA.ex21.peopleLegend('age', t).map((q, i) => i === 0 ? Object.assign({}, q, { label: t('x37.m.age') + ': ' + q.label }) : q);
    while (key.length < 5) key.push({ label: '' }); const k2 = NOVAL('age').concat(ground); while (k2.length < key.length) k2.push({ label: '' }); k2.forEach(q => key.push(q));   // the classes in the first column, the ground in the second
    const SMALL = ['u18', 'o65', 'es', 'inc', 'one'], UNIT = { u18: '% of the residents of a section', o65: '% of the residents of a section', es: '% of the residents of a section', inc: '€ per person and year (' + PD.income_year + ')', one: '% of the households of a section' };
    const gap = 8, swm = (640 - 4 * gap) / 5, shm = swm * 5600 / 6400, sc5 = Math.round(6400 / (swm / 1000) / 100) * 100;   // the old page's small maps: 121.6 x 106.4 mm
    const c = await AN.mapSheet({ mapW: 640, mapH: 560, u: U, title: ttl, sub: cap(sub), code: 'EX 2.1 · PEOPLE', num: '01 / 02', metres: 1000, pxPerM: mm(640) / 6400, scale: '1:10,000', keyCols: 2, kk: KF * 0.8, key, noteH: 46 * U,
      draw: (x, bx, by, bw, bh) => GA.ex21.drawPeople(x, bx, by, bw, bh, { t, only: 'age', k: KF, noNorth: true, noScale: true }),
      notes: [['MEAN AGE', nb(`The mean age of the residents of each census section in ${PD.adrh_year}, in five classes of one red: the darker, the older. ${PD.sections.length} sections meet this frame; their mean age runs from ${Math.min(...ages).toFixed(1)} to ${Math.max(...ages).toFixed(1)} years.`), true],
        ['HOW TO READ IT', 'The colour fills the whole section, also its fields; the buildings (OpenStreetMap) are printed darker over it to show where in the section people live. The air base is a white void behind its fence.']],
      extraH: 24 * U + shm + 16 * U + 3 * 5 * U + 8 * U,
      extra: async (x, px, py, wmm) => { let y = py + mm(4 * U); AN.txt(x, '+ FIVE MORE VALUES OF THE SAME SECTIONS', px, y, 2.6 * U, 700, AN.INK); AN.txt(x, `Same frame at about 1:${sc5.toLocaleString('en-US')}, same source and year; each map is one ramp of the red with its own classes. Ground as in the large map.`, px + mm(96 * U), y, 2.75 * U, 400, AN.GR);
        y += mm(20 * U); const sw = Math.round(mm(swm)), sh = Math.round(mm(shm));
        SMALL.forEach((key2, i) => { const sx = Math.round(px + i * mm(swm + gap)); AN.txt(x, t('x37.m.' + key2).toUpperCase(), sx, y - mm(11 * U), 2.6 * U, 700, AN.INK); AN.txt(x, UNIT[key2], sx, y - mm(6.6 * U), 2.3 * U, 400, AN.GR);
          GA.ex21.drawPeople(x, sx, y, sw, sh, { t, only: key2, k: sw / 1000 * 1.6, small: true, nameSz: 2.3 * U * AN.D }); const V = [sx, y, sx + sw, y + sh]; AN.u = U * 0.75; AN.frame(x, V); AN.u = U;
          const ys = AN.scale(x, V, sw / 6400, 2000, { scale: '≈ 1:' + sc5.toLocaleString('en-US'), labels: [['0', 0], ['1', 0.5], ['2 km', 1]], dy: 7 });
          AN.key(x, GA.ex21.peopleLegend(key2, t).concat(NOVAL(key2)), sx, ys + mm(6 * U), { cols: 2, colW: swm / 2, sw: 8 * U, sh: 3.2 * U, sz: 2.3 * U, row: 5 * U }); });
        return y + sh; },
      src: t('x37.src', { y: PD.adrh_year }) + ' Buildings: OpenStreetMap contributors (ODbL); municipal boundaries: IGN via es-atlas; the base outline: OSM (landuse=military). Printed in black, greys and one red; the base is drawn as a white void behind its fence.' });
    return c.toDataURL('image/png'); }

  if (m === 'work') { AN.u = 1; const Wmm = 594, Hmm = 420, L = 30, R = 22; const [c, x] = AN.sheet(Wmm, Hmm), W = c.width, H = c.height; const T = PD.towns, FIVE = GA.ex21.TFIVE, yr = T.Armilla.census_year || T.Armilla.activity_year;
    const [ttl, sub] = split(t('x37.work.title', { y: yr })); AN.head(x, W, { title: ttl, sub: cap(sub), code: 'EX 2.1 · PEOPLE', num: '02 / 02', left: L, right: R });
    const bw = mm(Wmm - L - R), bx = mm(L), by = mm(46), bh = mm(126);
    const items = GA.ex21.drawBranchBars(x, bx, by, bw, bh, { t, k: KF * 0.62, nums: true });
    // the key in the bars' order: the number written over every segment, then the branch
    let y = by + bh + mm(10); AN.txt(x, '+ BRANCHES, IN THE ORDER OF THE BARS (LEFT TO RIGHT); THE NUMBER STANDS OVER EVERY SEGMENT', bx, y, 2.6, 700, AN.INK); y += mm(7);
    y = AN.key(x, items.map((q, i) => Object.assign({}, q, { label: (i + 1) + '   ' + q.label })), bx, y, { cols: 3, colW: (Wmm - L - R) / 3, sw: 9, sh: 3.6 });
    AN.txt(x, 'Each bar = all employed residents of the town (100 %); the percentage is written in a segment where it is wide enough.', bx, y + mm(3), 2.5, 400, AN.GR);
    // the soldiers question (the old page's sentence, same figures)
    const pubs = FIVE.map(tn => T[tn].branch.public / T[tn].employed * 100);
    y = AN.note(x, bx, y + mm(20), Wmm - L - R - 120, 'THE SOLDIERS QUESTION', nb(t('x37.soldiers', { a: Math.min(...pubs).toFixed(1), b: Math.max(...pubs).toFixed(1), g: (T.Granada.branch.public / T.Granada.employed * 100).toFixed(1) })), AN.RED, { sz: 3.4, lh: 5.1, gap: 14 });
    // the table: the five towns in numbers
    AN.txt(x, '+ ' + t('x37.tb.title').toUpperCase(), bx, y, 2.6, 700, AN.INK); y += mm(9);
    const cols = ['town', 'pop', 'age', 'u18', 'o65', 'foreign', 'hh', 'inc', 'unemp', 'higher'], cw = bw / (cols.length + 1.2), cx = (i) => bx + (i === 0 ? 0 : (i + 1.2) * cw);
    cols.forEach((k2, i) => AN.txt(x, t('x37.tb.' + k2), cx(i), y, 2.6, 600, AN.GR, 'left', i === 0 ? 2.1 * cw : cw - mm(2)));
    x.strokeStyle = AN.INK; x.lineWidth = Math.max(1, mm(0.2)); x.beginPath(); x.moveTo(bx, y + mm(2.6)); x.lineTo(bx + bw, y + mm(2.6)); x.stroke(); y += mm(9);
    FIVE.concat(['Granada']).forEach(tn => { const o = T[tn], a = o.adrh, ed = o.education15, edT = Object.values(ed).reduce((p, q) => p + q, 0);
      const v = [tn === 'Granada' ? t('x37.granada') : tn, Math.round(a.pop).toLocaleString('en-US'), a.age.toFixed(1), a.u18.toFixed(1) + ' %', a.o65.toFixed(1) + ' %', (100 - a.es).toFixed(1) + ' %', a.hh.toFixed(1), a.inc ? '€' + Math.round(a.inc).toLocaleString('en-US') : '—', o.unemployment_pct + ' %', (ed.higher / edT * 100).toFixed(0) + ' %'];
      v.forEach((s0, i) => AN.txt(x, s0, cx(i), y, 3.3, tn === 'Granada' ? 400 : 600, tn === 'Granada' ? AN.GR : AN.INK, 'left', i === 0 ? 2.1 * cw : cw - mm(2)));
      x.strokeStyle = AN.pal.line; x.lineWidth = Math.max(1, mm(0.15)); x.beginPath(); x.moveTo(bx, y + mm(2.6)); x.lineTo(bx + bw, y + mm(2.6)); x.stroke(); y += mm(8.2); });
    AN.src(x, W, H, t('x37.src2', { y: yr, a: PD.adrh_year }) + ' Printed in black, greys and one red: the red is the branch "public administration and defence".', { left: L, right: R });
    return c.toDataURL('image/png'); }
  throw new Error('not written: ' + m); }'''
try:
  with sync_playwright() as p:
    b, pg, errs = launch(p, PORT)
    for m in ONLY:
      n = {'ages': '01_ages', 'work': '02_work'}[m]
      save(pg.evaluate(JS, [m, DPI]), os.path.join(OUTD, f'an_people_{n}.png')); print(m, 'ok', flush=True)
    print('errors:', errs[:5])
finally: srv.terminate()
