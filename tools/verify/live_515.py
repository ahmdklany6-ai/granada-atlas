"""Live verification of build 5.15 on the PUBLIC site from a GitHub runner (real tiles, real Wikimedia Commons images):
  1. analysis board: one card format (two cards per page, one map size, rows aligned, nothing past the foot), in en/ar/he;
     pages rendered as images; the enlarged-viewer export as a card
  2. Historical Maps: one red built-up outline per selected layer, replaced on every switch (never accumulated), legend
     and period label updated, "no reliable boundary" where none; popups with a REAL image (loaded, not broken), caption,
     date, credit, Commons link; larger viewer; desktop / tablet / phone; ar / he / en
Fresh browser (no visitor data touched). Screenshots: base64 JPEG between ===IMG name=== / ===END=== (job log only)."""
import base64, io, json, os, time, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image
SITE = 'https://ahmdklany6-ai.github.io/granada-atlas/'
EXPECT = os.environ.get('EXPECT_BUILD') or json.load(open('version.json'))['build']
PART = os.environ.get('PART', 'a')
res = []
def step(m): print(time.strftime('%H:%M:%S'), '·', m, flush=True)
def check(cond, msg, extra=''):
    res.append((bool(cond), msg)); print(('ok   ' if cond else 'FAIL ') + msg + (f'  [{extra}]' if extra != '' and not cond else ''), flush=True)
def emit(name, png, maxw=1600):
    im = Image.open(io.BytesIO(png)).convert('RGB'); im.thumbnail((maxw, maxw * 2)); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80)
    b = base64.b64encode(buf.getvalue()).decode(); print(f'===IMG {name}.jpg==='); [print(b[i:i + 8000]) for i in range(0, len(b), 8000)]; print('===END===', flush=True)
def durl(s): return base64.b64decode(s.split(',')[1])
v = None
for i in range(45):
    try:
        v = json.load(urllib.request.urlopen(SITE + 'version.json?nocache=' + str(time.time()), timeout=20))['build']; print('live version.json', v, flush=True)
        if v == EXPECT: break
    except Exception as e: print('version.json', e)
    time.sleep(20)
check(v == EXPECT, f'public site serves build {EXPECT} (version.json)', v)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    def boot(vp, lang, mobile=False):
        ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=1, accept_downloads=True); pg = ctx.new_page(); pg.set_default_timeout(600000); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        step(f'boot {vp["width"]}px {lang}'); pg.goto(SITE + '?v=' + EXPECT, wait_until='load', timeout=180000)
        pg.wait_for_function('window.GA && GA.app && GA.app.map && GA.app.map.loaded() && GA.fabricStyle', timeout=300000)
        check(pg.evaluate('window.GA_BUILD') == EXPECT, f'{vp["width"]}px {lang}: page runs build {EXPECT}'); pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.5); return ctx, pg, errs
    if 'a' in PART:  # ---------- analysis board, one card format ----------
        ctx, pg, errs = boot({'width': 1440, 'height': 900}, 'en'); pg.evaluate('GA.panels.set("study", true)'); time.sleep(1)
        pg.evaluate('GA.app.sel.setCenterDirect([-3.5995, 37.1766])'); time.sleep(0.5); pg.fill('#in-name', 'Centro'); pg.click('#btn-analyze')
        pg.wait_for_function('GA.app.getRun() && GA.app.getRun().X && !Object.values(GA.app.getRun().tasks).some(x => x.state === "running")', timeout=600000); time.sleep(1)
        aid = pg.evaluate('GA.app.getRun().areaId')
        for lang in ['en', 'ar', 'he']:
            step('board ' + lang); pg.evaluate(f'GA.i18n.setLang("{lang}")'); time.sleep(0.5); pg.evaluate('GA.pages.close && GA.pages.close()'); time.sleep(0.5)
            pg.evaluate(f'GA.pages.go("fabric", "{aid}")'); pg.wait_for_function('document.querySelectorAll(".ap-sec").length >= 6', timeout=300000); time.sleep(4)
            info = pg.evaluate('''(async () => { const st = GA.fabric.state; const a = GA.app.store.get().areas.find(x => x.id === st.id); const b = GA.fabric.board(a.id); if (st.paintAllNow) st.paintAllNow();
                const pages = await GA.fabric.boardPages(a, b, {}); return pages.map(p => ({ k: p.k, cards: p.cards || null, H: p.canvas.height, W: p.canvas.width, jpg: p.canvas.toDataURL('image/jpeg', 0.82) })); })()''')
            cp = [q for q in info if q['cards']]; hs = {round(c['mapBottom'] - c['mapY']) for q in cp for c in q['cards']}
            al = all(abs(q['cards'][0]['mapY'] - q['cards'][1]['mapY']) < 1 and abs(q['cards'][0]['mapBottom'] - q['cards'][1]['mapBottom']) < 1 for q in cp if len(q['cards']) == 2)
            check(cp and all(len(q['cards']) <= 2 for q in cp) and len(hs) == 1 and al and all(c['bottom'] <= q['H'] - 80 for q in cp for c in q['cards']), f'live board ({lang}): {len(cp)} card pages, one map size {sorted(hs)}, rows aligned, nothing past the foot')
            if lang == 'ar' or lang == 'en':
                for i, q in enumerate(info[:4]): emit(f'board_{lang}_{i}_{q["k"]}', durl(q['jpg']), 1500)
        pg.click('[data-ap-card]'); pg.wait_for_function('GA.lastViewer && GA.lastViewer.kind === "map"', timeout=300000); time.sleep(4)
        emit('viewer_card_export_he', durl(pg.evaluate('GA.lastViewer.composed().toDataURL("image/jpeg", 0.82)')), 1000)
        check(not errs, 'live board: no page errors', errs[:3]); ctx.close()
    if 'b' in PART:  # ---------- Historical Maps: extents + popup images ----------
        for vp, lang, mob in [({'width': 1440, 'height': 900}, 'en', False), ({'width': 820, 'height': 1180}, 'ar', True), ({'width': 390, 'height': 844}, 'he', True)]:
            ctx, pg, errs = boot(vp, lang, mob)
            pg.evaluate('GA.pages.go("history")'); pg.wait_for_function('document.querySelector("#hx-ext-box") && document.querySelector("#hx-ext-box").innerText.length > 20', timeout=300000); time.sleep(3)
            seq = ['minutas', 'mtn50', 'ams56', 'inter7386', 'pnoa2024', 'catastrones', 'ams56'] if lang == 'en' else ['ams56', 'mtn50', 'pnoa2022']
            for hid in seq:
                pg.click(f'[data-hx-a="{hid}"]'); time.sleep(1)
                pg.wait_for_function(f'document.querySelector(".hx-chip.on[data-hx-a={hid}]") && GA.history.maps()[0] && GA.history.maps()[0].__hxExtent && GA.history.maps()[0].__hxExtent.hid === "{hid}"', timeout=300000); time.sleep(2)
                r = pg.evaluate('(() => { const m = GA.history.maps()[0]; const s = m.getSource("hx-ext"); return { n: (s._data.features || []).length, id: m.__hxExtent.id, txt: document.querySelector("#hx-ext-box").innerText }; })()')
                check((r['n'] == 0) == (hid == 'minutas') and r['n'] <= 1, f'live history ({lang}) {hid}: {r["n"]} outline ({r["id"]}), never more than one', r)
                if lang == 'en' and hid in ('mtn50', 'ams56', 'pnoa2024', 'minutas'):
                    pg.evaluate('GA.history.maps()[0].jumpTo({ center: [-3.598, 37.18], zoom: 13.2 })'); time.sleep(6); emit(f'history_{hid}_{lang}', pg.screenshot(), 1200)
                    emit(f'history_legend_{hid}_{lang}', pg.locator('#hx-ext-box').screenshot(), 600)
            # popups: real images
            pg.click('[data-hx-a="ams56"]'); time.sleep(3); pg.wait_for_function('document.querySelectorAll("[data-hx-fly]").length >= 10', timeout=300000)
            n = pg.evaluate('document.querySelectorAll("[data-hx-fly]").length'); okc = 0; bad = []
            for i in range(n):
                pg.evaluate(f'document.querySelectorAll("[data-hx-fly]")[{i}].click()'); time.sleep(1)
                try: pg.wait_for_function('(() => { const p = document.querySelector(".hx-popup"); if (!p) return false; const im = p.querySelector(".hx-pop-img img"); return !im || (im.complete && im.naturalWidth > 0) || p.querySelector(".hx-pop-noimg"); })()', timeout=60000)
                except Exception: pass
                r = pg.evaluate('(() => { const p = document.querySelector(".hx-popup"); if (!p) return null; const im = p.querySelector(".hx-pop-img img"); return { t: p.querySelector("b").innerText, img: !!im, w: im ? im.naturalWidth : 0, note: !!p.querySelector(".hx-pop-noimg"), cap: (p.querySelector(".hx-pop-fig figcaption") || {}).innerText || "" }; })()')
                if r and ((r['img'] and r['w'] > 0 and 'Commons' in r['cap']) or (not r['img'] and r['note'])): okc += 1
                else: bad.append(r)
                if i in (0, 3) : emit(f'popup_{lang}_{i}', pg.screenshot(), 1000 if vp['width'] > 500 else 400)
                pg.evaluate('document.querySelectorAll(".maplibregl-popup").forEach(p => p.remove())')
            check(n >= 10 and not bad, f'live history ({lang}): {okc}/{n} popups with a loaded image (caption, date, credit, Commons link) or a clean note', bad[:3])
            pg.evaluate('document.querySelectorAll("[data-hx-fly]")[0].click()'); time.sleep(4)
            if pg.evaluate('!!document.querySelector(".hx-popup .hx-pop-img")'):
                pg.click('.hx-popup .hx-pop-img'); time.sleep(6); ok = pg.evaluate('(() => { const i = document.querySelector(".vw-imgstage img"); return !!i && i.complete && i.naturalWidth > 0; })()')
                check(ok, f'live history ({lang}): the popup image opens loaded in the larger viewer'); emit(f'viewer_img_{lang}', pg.screenshot(), 1000 if vp['width'] > 500 else 400); pg.keyboard.press('Escape')
            check(pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), f'live history ({lang}, {vp["width"]}px): no horizontal overflow')
            check(not errs, f'live history ({lang}): no page errors', errs[:3]); ctx.close()
    b.close()
n = sum(1 for c, _ in res if not c); print(f'\nLIVE RESULT 5.15 part {PART}: {len(res) - n}/{len(res)} checks passed' + ('' if not n else ' — FAILED: ' + '; '.join(m for c, m in res if not c)), flush=True)
