/* Build 5.28 — "City growth (built-up extent 1932–2020)" as a normal map layer (Layers → History).
   Before 5.28 the atlas drew these extents by itself on the city view and its Pause only stopped the timer. Now:
   - one layer 'city_growth' in the layer manager: checkbox, opacity, legend, remembered in the visitor's browser like any
     other layer (granada-atlas.layers.v1: on, opacity, opts.i = period, opts.play = playing, opts.only = outline only);
   - OFF by default: nothing drawn, no timer; switching it OFF from anywhere hides fill + outline and stops the timer;
   - ON: the extents up to the selected period (older periods stay under it), the selected one outlined in red; Play / Pause
     and a period slider (1932, 1956–57, 1975, 1990, 2000, 2015, 2020); "only this period's outline";
   - GA.growth is the one controller used by the Layers panel, the atlas panel and the Historical maps section;
   - prefers-reduced-motion: never plays by itself (a remembered "playing" state shows the latest period, still);
   - print layout / exports draw the map's own style and the layer manager's legend, so the layer prints only when ON.
   Data: data/ref/history_extents.json (traced 1932 MTN50 and 1956–57 AMS flight; JRC GHSL GHS-BUILT-S R2023A 1975–2020).
   Colours: GA.palette.growth (map paint and legend read the same array). */
(function (root) {
  const ID = 'city_growth';
  const PERIODS = ['mtn50_1932', 'ams_1956', 'ghsl_1975', 'ghsl_1990', 'ghsl_2000', 'ghsl_2015', 'ghsl_2020'];
  const REDUCED = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const DELAY = 1500, DELAY_END = 2600;
  let H = null, EXT = null, extP = null, timer = null, hooked = false; const listeners = [];
  const C = () => root.GA.palette.growth;
  const st = () => H && H.S[ID];
  const opts = () => (st() && st().opts) || { i: PERIODS.length - 1, play: false, only: false };
  const L = () => root.GA.app && root.GA.app.L;
  function ext() { if (!extP) extP = fetch('data/ref/history_extents.json?v=' + (root.GA_BUILD || '')).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => (EXT = j)); return extP; }
  function kindKey(x) { return x.kind === 'ghsl' ? (x.observed === false ? 'gr.ghslInt' : 'gr.ghslObs') : 'gr.traced'; }
  function label(i) { const x = EXT && EXT.extents[PERIODS[i]]; return x ? (x.period || x.date) : PERIODS[i]; }

  // ---------- drawing ----------
  function draw() {
    if (!H || !EXT) return; const { map, lid, fc } = H; const src = map.getSource(lid('growth')); if (!src) return;
    const o = opts(), i = Math.max(0, Math.min(PERIODS.length - 1, o.i == null ? PERIODS.length - 1 : o.i)), c = C(); const fs = [];
    // newest first (drawn at the bottom), the selected period's outline last (on top)
    for (let j = i; j >= 0; j--) { if (o.only && j !== i) continue; const x = EXT.extents[PERIODS[j]]; if (!x) continue;
      fs.push({ type: 'Feature', properties: { j, fill: c.fills[j], fa: o.only ? 0 : c.fillAlpha, line: j === i ? c.current : c.fills[j], w: j === i ? c.currentW : c.lineW, cur: j === i ? 1 : 0 }, geometry: x.geometry }); }
    fs.sort((a, b) => a.properties.cur - b.properties.cur || b.properties.j - a.properties.j);
    src.setData(fc(fs)); emitLocal();
  }
  function applyOpacity(o) { if (!H) return; const { map, lid } = H;
    if (map.getLayer(lid('growth', 'fill'))) map.setPaintProperty(lid('growth', 'fill'), 'fill-opacity', ['*', o, ['get', 'fa']]);
    if (map.getLayer(lid('growth'))) map.setPaintProperty(lid('growth'), 'line-opacity', o); }

  // ---------- the one controller ----------
  function save() { if (H) { H.persist(); } }
  function refreshPanels() { if (H) H.emit(); emitLocal(); }
  function emitLocal() { listeners.forEach(f => { try { f(state()); } catch (e) { } }); }
  function stopTimer() { clearTimeout(timer); timer = null; }
  function tick() { const s = st(); if (!s || !s.on || !s.opts.play) { stopTimer(); return; } // OFF or paused: the timer ends here
    s.opts.i = (s.opts.i + 1) % PERIODS.length; draw(); liveDOM(); timer = setTimeout(tick, s.opts.i === PERIODS.length - 1 ? DELAY_END : DELAY); }
  // while playing: move the slider, the period ticks and the legend's highlight in place (no panel re-render, so an
  // opacity slider being dragged is not interrupted)
  function liveDOM() { if (typeof document === 'undefined') return; const g = state();
    document.querySelectorAll(`input[type=range][data-ly-ctl="${ID}"]`).forEach(el => { el.value = g.i; el.setAttribute('aria-valuetext', g.period); const b = el.parentElement.querySelector('b'); if (b) b.textContent = g.period; });
    document.querySelectorAll(`.gr-tick[data-ly-ctl="${ID}"]`).forEach((el, j) => { el.classList.toggle('on', j === g.i); el.setAttribute('aria-pressed', String(j === g.i)); });
    dispatchEvent(new Event('ga:legend')); }
  function startTimer() { stopTimer(); const s = st(); if (!s || !s.on || !s.opts.play) return; timer = setTimeout(tick, s.opts.i === PERIODS.length - 1 ? DELAY_END : DELAY); }
  function hook() { // one listener on the layer manager: whatever switches the layer (checkbox, reset, saved project) stops the timer when OFF
    if (hooked || !L()) return; hooked = true; L().onChange(() => { const s = st(); if (!s) return; if (!s.on) { if (timer) stopTimer(); if (s.opts.play) { s.opts.play = false; save(); } } emitLocal(); }); }
  async function setOn(on) { hook(); const s = st(); if (!s || !L()) return; if (!on) { s.opts.play = false; stopTimer(); } L().setOn(ID, !!on); refreshPanels(); }
  async function play() { hook(); const s = st(); if (!s) return; if (!s.on) await setOn(true); await ext(); s.opts.play = true; if (s.opts.i === PERIODS.length - 1) s.opts.i = -1, tick(); else startTimer(); save(); refreshPanels(); }
  function pause() { const s = st(); if (!s) return; s.opts.play = false; stopTimer(); save(); refreshPanels(); } // keeps the current period
  function toggle() { const s = st(); if (s && s.on && s.opts.play) pause(); else play(); }
  function setPeriod(i) { const s = st(); if (!s) return; s.opts.i = Math.max(0, Math.min(PERIODS.length - 1, +i)); s.opts.play = false; stopTimer(); draw(); save(); refreshPanels(); }
  function setOnly(b) { const s = st(); if (!s) return; s.opts.only = !!b; draw(); save(); refreshPanels(); }
  function state() { const s = st(); const o = opts(); const i = o.i == null ? PERIODS.length - 1 : Math.max(0, o.i);
    return { on: !!(s && s.on), playing: !!(s && s.on && o.play && timer), i, period: label(i), kind: EXT && EXT.extents[PERIODS[i]] ? kindKey(EXT.extents[PERIODS[i]]) : null, only: !!o.only, opacity: s ? s.opacity : 1, periods: PERIODS.map((_, j) => label(j)) }; }
  function stepHTML() { const g = state(); if (!g.on) return ''; const t = H.t;
    return `<b class="num">${g.period}</b> · ${t(g.kind || 'gr.traced')}`; }
  // buttons used by the atlas panel and the sidebar's Historical maps section (same state as the layer)
  function buttonsHTML() { if (!H) return ''; const t = H.t, g = state();
    if (!g.on) return `<button type="button" class="btn btn-tiny" data-gr="play">${t('gr.playLong')}</button>`;
    return `<button type="button" class="btn btn-tiny" data-gr="${g.playing ? 'pause' : 'play'}">${t(g.playing ? 'gr.pauseLong' : 'gr.playLong')}</button> <button type="button" class="btn btn-tiny" data-gr="off">${t('gr.off')}</button>`; }
  function onButton(b) { const a = b.dataset.gr; if (a === 'play') play(); else if (a === 'pause') pause(); else if (a === 'off') setOn(false); else if (a === 'on') setOn(true); }

  root.GA.growth = { ID, PERIODS, play, pause, toggle, setOn, setPeriod, setOnly, get state() { return state(); }, onChange: (f) => listeners.push(f), stepHTML, buttonsHTML, onButton, ext };

  // ---------- the layer ----------
  root.GA.layersExtra = root.GA.layersExtra || [];
  root.GA.layersExtra.push(function (h) {
    H = h; const { map, S, addSrc, addLyr, lid, fc, t, esc } = h;
    return [{
      id: ID, group: 'hist', title: () => t('gr.title'), def: { on: false, opacity: 1, opts: { i: PERIODS.length - 1, play: false, only: false } },
      build() { addSrc(lid('growth'), { type: 'geojson', data: fc() });
        addLyr({ id: lid('growth', 'fill'), type: 'fill', source: lid('growth'), layout: { visibility: 'none' }, paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': ['get', 'fa'] } });
        addLyr({ id: lid('growth'), type: 'line', source: lid('growth'), layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-color': ['get', 'line'], 'line-width': ['get', 'w'], 'line-opacity': 1 } }); },
      async load() { hook(); await ext(); const s = S[ID];
        if (s.opts.play && REDUCED()) { s.opts.play = false; s.opts.i = PERIODS.length - 1; save(); } // reduced motion: the latest period, still
        draw(); if (s.opts.play) startTimer(); return PERIODS.filter(p => EXT.extents[p]).length; },
      layers: () => [lid('growth', 'fill'), lid('growth')],
      applyOpacity,
      controls() { const g = state(); const n = PERIODS.length - 1;
        return `<div class="gr-ctl"><p class="row2"><button type="button" class="btn btn-tiny" data-ly-ctl="${ID}" data-k="${g.playing ? 'pause' : 'play'}">${g.playing ? '❚❚ ' + t('gr.pause') : '▶ ' + t('gr.play')}</button></p>
          <label class="row2 gr-range">${t('gr.period')} <input type="range" min="0" max="${n}" step="1" value="${g.i}" data-ly-ctl="${ID}" data-k="i" aria-valuetext="${esc(g.period)}"> <b class="num" dir="ltr">${esc(g.period)}</b></label>
          <div class="gr-ticks" dir="ltr">${g.periods.map((p, j) => `<button type="button" class="gr-tick${j === g.i ? ' on' : ''}" data-ly-ctl="${ID}" data-k="i" value="${j}" aria-pressed="${j === g.i}">${esc(String(p).replace('–19', '–'))}</button>`).join('')}</div>
          <label class="row2"><input type="checkbox" data-ly-ctl="${ID}" data-k="only" ${g.only ? 'checked' : ''}> ${t('gr.only')}</label>${REDUCED() ? `<p class="fine">${t('gr.reduced')}</p>` : ''}</div>`; },
      onControl(el) { const k = el.dataset.k;
        if (k === 'play') { play(); return false; } if (k === 'pause') { pause(); return false; }
        if (k === 'i') { setPeriod(el.value); return false; } if (k === 'only') { setOnly(el.checked); return false; } },
      legend() { if (!EXT) return `<p class="lyr-src">…</p>`; const c = C(), g = state();
        const items = PERIODS.map((p, j) => { const x = EXT.extents[p]; if (!x) return ''; const shown = !g.only ? j <= g.i : j === g.i;
          return `<li class="${j === g.i ? 'gr-cur' : ''}${shown ? '' : ' gr-dim'}"><i class="sw" style="background:${c.fills[j]};opacity:${g.only ? 0.15 : 0.75};border:${j === g.i ? c.currentW : c.lineW}px solid ${j === g.i ? c.current : c.fills[j]}"></i><span><b class="num" dir="ltr">${esc(x.period || x.date)}</b> · ${t(kindKey(x))}${x.km2 ? ` · <span class="num" dir="ltr">${x.km2} km²</span>` : ''}</span></li>`; }).join('');
        return `<ul class="lg lg-col">${items}</ul><p class="lyr-src">${t('gr.note')} ${t('gr.current')}.</p>`; },
      src: () => 'IGN / CNIG MTN50 1932 and AMS 1956–57 (traced, approximate; CC BY 4.0) · JRC GHSL GHS-BUILT-S R2023A 1975–2020 (CC BY 4.0)',
    }];
  });
})(window);
