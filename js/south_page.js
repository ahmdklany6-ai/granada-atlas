/* Build 5.21 — page "Southern axis" (#/south): the two research boards (Escúzar estate and accelerator; metro 2026 vs the
   1931 tram) as the team presented them, in the interface language (data/boards/south_<board>_<ar|he|en>.jpg, rendered
   at 2× from the same data as the map layers). Each board opens large (zoom / pan), downloads, and "Show on the map"
   closes the page, switches its layers on and frames them. */
(function (root) {
  const { i18n: I, pages: PG } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc;
  const BOARDS = [
    { id: 'escuzar', title: 'v19.bEscuzar', note: 'v19.nEscuzar', layers: ['escuzar_pole', 'south_metro'], bb: [[-3.80, 37.055], [-3.59, 37.16]], w: 4200, h: 2533 },
    { id: 'metro_tram', title: 'v19.bMetro', note: 'v19.nMetro', layers: ['south_metro', 'tram_1931'], bb: [[-3.688, 37.128], [-3.618, 37.152]], w: 4200, h: 1894 },
  ];
  const src = (b) => `data/boards/south_${b.id}_${I.lang}.jpg?v=${encodeURIComponent(root.GA_BUILD || '')}`;
  function render(body) {
    body.innerHTML = `<div class="sb-wrap"><p class="sb-lead">${t('v19.lead')}</p>${BOARDS.map((b, i) => `
      <figure class="sb-board" data-board="${b.id}">
        <figcaption><h3>${i + 1}. ${esc(t(b.title))}</h3>
          <div class="sb-act"><button type="button" class="btn btn-small" data-sb="open">${t('v19.open')}</button>
            <a class="btn btn-small" data-sb="dl" href="${src(b)}" download="granada_south_${b.id}_${I.lang}.jpg">${t('v19.download')}</a>
            <button type="button" class="btn btn-small btn-primary" data-sb="map">${t('v19.onMap')}</button></div></figcaption>
        <button type="button" class="sb-img" data-sb="open" aria-label="${esc(t('v19.open') + ': ' + t(b.title))}"><img src="${src(b)}" width="${b.w}" height="${b.h}" alt="${esc(t(b.title))}" loading="lazy" decoding="async"></button>
        <p class="sb-note">${t(b.note)}</p>
      </figure>`).join('')}
      <p class="sb-src">${t('v19.src')}</p></div>`; (root.GA.ltrNumsDOM || (() => {}))(body); // 5.26: numbers and units stay LTR in RTL
    body.onclick = (e) => {
      const a = e.target.closest('[data-sb]'); if (!a) return; const fig = a.closest('[data-board]'); const b = BOARDS.find(x => x.id === fig.dataset.board); if (!b) return;
      if (a.dataset.sb === 'open') { e.preventDefault(); root.GA.viewer.image({ src: src(b), title: t(b.title), subtitle: t('v19.plate'), alt: t(b.title), notGIS: true }); }
      if (a.dataset.sb === 'map') {
        const A = root.GA.app; PG.close();
        b.layers.forEach(id => { if (A.L.S[id] && !A.L.S[id].on) A.L.setOn(id, true); });
        setTimeout(() => A.map.fitBounds(b.bb, { padding: 50, duration: 1000 }), 60);
      }
    };
  }
  PG.register('south', { plate: () => t('v19.plate'), title: () => t('v19.title'), render });
  root.GA.southPage = { BOARDS, src };
})(window);
