/* Enlarged section view: a wide drawing with its location in a small linked map, visible vertical-exaggeration
   choice (true scale ×1 included), evidence-only or labelled illustrative detail, viewing direction and tree
   corridor, exports, and building annotations. An annotation records what the user documented about a building
   (roof shape and finish, wall material, balconies, openings) together with its source; it is drawn as documented
   detail and listed with that source. Nothing is added to a building without such evidence unless the
   illustrative level is switched on, and that level is drawn lighter and labelled. */
(function (root) {
  const { i18n: I, section: SEC, mapcard: MC, store, geo: G, proj: PJ, data: D } = root.GA;
  const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const VES = ['auto', 1, 2, 3, 5, 10];
  const ROOFS = ['flat', 'gabled', 'hipped', 'side_hipped', 'pyramidal', 'skillion', 'dome', 'round', 'mansard', 'many'];
  const ROOF_MATS = ['tiles', 'slate', 'metal', 'membrane', 'green'];
  const WALLS = ['render', 'brick', 'stone', 'concrete', 'glass', 'timber'];
  const notesAll = () => { const p = store.get(); p.buildingNotes = p.buildingNotes || {}; return p.buildingNotes; };

  function open(areaId, secId) {
    const a = store.get().areas.find(x => x.id === areaId); if (!a) return; const s = (a.sections || []).find(x => x.id === secId) || (a.sections || [])[0]; if (!s) return;
    let prof = null, last = null, sel = null;
    const sh = root.GA.viewer.shell({ kind: 'vw-sec', title: esc(s.name), subtitle: esc(a.name) + ' · ' + t('v5.sectionView'),
      tools: `<button class="btn btn-small" data-sx="png">${t('v5.exportPNG')}</button><button class="btn btn-small" data-sx="svg">SVG</button><button class="btn btn-small" data-sx="pdf">${t('v5.exportPDF')}</button>`,
      body: `<div class="sv"><div class="sv-draw"><canvas class="sv-cv" aria-label="${esc(t('v5.sectionDrawing'))}"></canvas><p class="vw-hint">${t('v5.secClickHint')}</p></div>
        <div class="sv-side">
          <figure class="sv-loc"><canvas class="sv-map"></canvas><figcaption>${t('v5.secLocation')}</figcaption></figure>
          <div class="sv-ctl">
            <fieldset><legend>${t('v5.ve')}</legend><div class="seg" role="group">${VES.map(v => `<button type="button" data-ve="${v}" aria-pressed="false">${v === 'auto' ? t('v5.veAuto') : v === 1 ? t('v5.veTrue') : '×' + v}</button>`).join('')}</div></fieldset>
            <fieldset><legend>${t('v5.detail')}</legend><div class="seg" role="group"><button type="button" data-ill="0" aria-pressed="false">${t('v5.detailEvidence')}</button><button type="button" data-ill="1" aria-pressed="false">${t('v5.detailIll')}</button></div></fieldset>
            <div class="sv-row"><label>${t('sec.look')} <select data-sv="look"><option value="left">${t('sec.look_left')}</option><option value="right">${t('sec.look_right')}</option></select></label>
              <label>${t('v4.corridor')} <input type="number" min="2" max="60" step="1" data-sv="corridor" style="width:4.5em"> m</label>
              <label class="chk"><input type="checkbox" data-sv="floors"> ${t('sec.floors')}</label></div>
          </div>
          <section class="sv-ann" aria-live="polite"></section>
          <details class="method"><summary>${t('v5.secMethods')}</summary><div class="sv-methods"></div></details>
        </div></div>` });
    const el = sh.el; const cv = el.querySelector('.sv-cv'), mapCv = el.querySelector('.sv-map'), ann = el.querySelector('.sv-ann'), meth = el.querySelector('.sv-methods'), drawBox = el.querySelector('.sv-draw');
    const save = () => { store.upsertArea(a); root.GA.app && root.GA.app.secProfiles && root.GA.app.secProfiles.delete(s.id); };
    const syncCtl = () => {
      el.querySelectorAll('[data-ve]').forEach(b => b.setAttribute('aria-pressed', String(String(s.ve || 'auto') === b.dataset.ve)));
      el.querySelectorAll('[data-ill]').forEach(b => b.setAttribute('aria-pressed', String((s.ill ? '1' : '0') === b.dataset.ill)));
      el.querySelector('[data-sv=look]').value = s.look === 'right' ? 'right' : 'left'; el.querySelector('[data-sv=corridor]').value = s.corridor || 15; el.querySelector('[data-sv=floors]').checked = !!s.floors;
    };
    async function recompute() { drawBox.classList.add('busy'); try { prof = await SEC.compute(s, { floorH: s.floorH || 3 }); } catch (e) { drawBox.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; } finally { drawBox.classList.remove('busy'); } paint(); minimap(); methods(); }
    function paint() { if (!prof) return; const w = Math.max(320, drawBox.clientWidth - 4), h = Math.max(260, Math.min(drawBox.clientHeight - 44, Math.round(w * 0.72))); last = SEC.draw(cv, prof, Object.assign({ w, h }, SEC.optsFor(s))); if (sel) annotate(sel); }
    async function minimap() {
      const w = Math.max(200, mapCv.parentElement.clientWidth - 2), h = Math.round(w * 0.75); const ring = root.GA.compare.ringOf(a.spec);
      const u = s.pts.map(p => PJ.EPSG25830.forward(p)); const c = s.look === 'right' ? -1 : 1; const cw = s.corridor || 15;
      const off = u.map((p, i) => { const A = u[Math.max(0, i - 1)], B = u[Math.min(u.length - 1, i + 1)]; const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; return [p[0] - (B[1] - A[1]) / L * c * cw, p[1] + (B[0] - A[0]) / L * c * cw]; });
      const corr = u.concat(off.reverse()).concat([u[0]]).map(p => PJ.EPSG25830.inverse(p));
      let bld = []; try { bld = (await D.buildingsNear(s.pts, 120)).map(f => f.geometry); } catch (e) { }
      const f = MC.fit([s.pts, ring].filter(Boolean), w, h, 0.12);
      MC.render(mapCv, { center: f.center, mpp: f.mpp, w, h, ring, fadeOutside: 0, areaStyle: { color: '#992B2A', width: 1.2, dash: [4, 3] }, context: { buildings: bld, buildingColor: '#E3E4E6' },
        layers: [{ type: 'fill', items: [{ g: { type: 'Polygon', coordinates: [corr] }, fill: '#4E6B45', alpha: 0.15 }] }], overlays: [{ coords: s.pts, color: '#1C1E21', width: 2.2, dash: [], labels: ['A', 'B'] }] });
    }
    function methods() {
      const p = prof; const sf = p.surf || { green: [], streets: [], water: [] }; const cutsRs = p.cuts.filter(c => c.rs).length; const lvT = p.cuts.filter(c => c.lv).length;
      meth.innerHTML = `<ul class="find"><li>${t('sec.accuracy3')}</li><li>${t('v5.mRoof', { n: cutsRs, c: p.cuts.length })}</li><li>${t('v5.mFloors', { n: lvT, c: p.cuts.length })}</li>
        <li>${t('v5.mGround', { s: sf.streets.length, e: sf.streets.filter(z => z.span).length, g: sf.green.length, w: sf.water.length })}</li>
        <li>${t('v4.secTrees', { c: p.corridor, n: p.trees.filter(x => !x.row).length, near: p.nearTrees, h: p.trees.filter(x => !x.row && x.h).length, r: p.rowsNear, date: (p.treeTs || '').slice(0, 10) })}</li>
        <li>${t('v5.mIll')}</li><li>${t('v5.mDoc')}</li></ul>`;
    }
    // ---- annotations ----
    function hitAt(x, y) { if (!last) return null; const hs = last.hits; for (let i = hs.length - 1; i >= 0; i--) { const h = hs[i]; if (x >= h.x0 - 2 && x <= h.x1 + 2 && y >= h.y0 - 10 && y <= h.y1 + 4 && h.kind === 'cut') return h; } for (let i = hs.length - 1; i >= 0; i--) { const h = hs[i]; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h; } return null; }
    function annotate(h) {
      sel = h; const b = h.c || h.b; const n = notesAll()[h.id] || {}; const lib = root.GA.library;
      const opt = (list, v, pre) => `<option value="">${t('v5.unknown')}</option>` + list.map(k => `<option value="${k}" ${v === k ? 'selected' : ''}>${t(pre + k)}</option>`).join('');
      ann.innerHTML = `<h3>${esc(b.name || t('v5.building'))} <small dir="ltr">${esc(h.id)}</small></h3>
        <p class="fine">${t(h.kind === 'cut' ? 'v5.annCut' : 'v5.annBg')} · ${t('v5.floors')}: ${b.lv || t('nodata')} · ${t('v5.height')}: ${b.h != null ? (b.src === 'height' ? '' : '≈') + Math.round(b.h) + ' m' : t('nodata')}${b.rs ? ` · ${t('v5.roof')} (OSM): ${esc(t('roof.' + b.rs))}` : ''}${b.lvu ? ` · ${t('v5.underground')}: ${b.lvu}` : ''}</p>
        <form class="ann-f">
          <label>${t('v5.roofShape')} <select name="roof">${opt(ROOFS, n.roof || '', 'roof.')}</select></label>
          <label>${t('v5.roofFinish')} <select name="roofMat">${opt(ROOF_MATS, n.roofMat || '', 'mat.')}</select></label>
          <label>${t('v5.wallMat')} <select name="wall">${opt(WALLS, n.wall || '', 'mat.')}</select></label>
          <label>${t('v5.balconies')} <select name="balconies"><option value="">${t('v5.unknown')}</option><option value="yes" ${n.balconies === 'yes' ? 'selected' : ''}>${t('v5.yes')}</option><option value="no" ${n.balconies === 'no' ? 'selected' : ''}>${t('v5.no')}</option></select></label>
          <label>${t('v5.balconyFloors')} <input name="balconyFloors" value="${esc(n.balconyFloors || '')}" placeholder="${esc(t('v5.balconyFloorsPh'))}"></label>
          <label>${t('v5.openings')} <select name="openings"><option value="">${t('v5.unknown')}</option><option value="regular" ${n.openings === 'regular' ? 'selected' : ''}>${t('v5.openRegular')}</option></select></label>
          <label class="wide">${t('v5.source')} * <input name="source" required value="${esc(n.source || '')}" placeholder="${esc(t('v5.sourcePh'))}"></label>
          <label class="wide">${t('v5.sourceLink')} <input name="url" type="url" value="${esc(n.url || '')}" placeholder="https://"></label>
          <label class="wide">${t('v5.sourceLib')} <select name="libId"><option value="">—</option></select></label>
          <label class="wide">${t('v5.note')} <textarea name="note" rows="2" dir="auto">${esc(n.note || '')}</textarea></label>
          <div class="actions"><button class="btn btn-small btn-primary" type="submit">${t('v5.saveAnn')}</button>${notesAll()[h.id] ? `<button class="btn btn-small" type="button" data-ann="del">${t('v5.removeAnn')}</button>` : ''}<button class="btn btn-small" type="button" data-ann="close">${t('cancel')}</button></div>
          <p class="fine">${t('v5.annRule')}</p></form>`;
      if (lib) lib.list().then(items => { const s2 = ann.querySelector('[name=libId]'); if (!s2) return; items.forEach(it => { const o = document.createElement('option'); o.value = it.id; o.textContent = it.title; if (n.libId === it.id) o.selected = true; s2.appendChild(o); }); });
      const f = ann.querySelector('form');
      f.onsubmit = (e) => { e.preventDefault(); const fd = new FormData(f); const rec = {}; for (const [k, v] of fd.entries()) if (String(v).trim()) rec[k] = String(v).trim(); if (!rec.source) { f.querySelector('[name=source]').focus(); return; }
        rec.updated = new Date().toISOString(); notesAll()[h.id] = rec; store.save(); root.GA.toast && root.GA.toast(t('v5.annSaved')); paint(); listDocs(); };
      f.querySelector('[data-ann=close]').onclick = () => { sel = null; listDocs(); };
      const del = f.querySelector('[data-ann=del]'); if (del) del.onclick = () => { delete notesAll()[h.id]; store.save(); sel = null; paint(); listDocs(); };
    }
    function listDocs() {
      if (sel) return; const ids = new Set((prof ? prof.cuts.concat(prof.bg) : []).map(b => b.id)); const N = notesAll(); const docs = Object.entries(N).filter(([id]) => ids.has(id));
      ann.innerHTML = `<h3>${t('v5.documented')}</h3>${docs.length ? `<ul class="docs">${docs.map(([id, n]) => `<li><b dir="ltr">${esc(id)}</b> — ${[n.roof && t('roof.' + n.roof), n.roofMat && t('mat.' + n.roofMat), n.wall && t('mat.' + n.wall), n.balconies === 'yes' && t('v5.balconies')].filter(Boolean).map(esc).join(', ')}<br><small>${t('v5.source')}: ${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.source)}</a>` : esc(n.source)}</small></li>`).join('')}</ul>` : `<p class="fine">${t('v5.noDocs')}</p>`}`;
    }
    // ---- events ----
    cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(); const h = hitAt(e.clientX - r.left, e.clientY - r.top); if (h) annotate(h); });
    el.addEventListener('click', (e) => {
      const v = e.target.closest('[data-ve]'); if (v) { s.ve = v.dataset.ve === 'auto' ? 'auto' : +v.dataset.ve; save(); syncCtl(); paint(); return; }
      const il = e.target.closest('[data-ill]'); if (il) { s.ill = il.dataset.ill === '1'; save(); syncCtl(); paint(); return; }
      const x = e.target.closest('[data-sx]'); if (!x || !prof) return; const base = `granada_section_${String(s.name).replace(/[^\w]+/g, '_')}`;
      if (x.dataset.sx === 'svg') dl(new Blob([SEC.svg(prof, Object.assign({ w: 1800, h: 900 }, SEC.optsFor(s)))], { type: 'image/svg+xml' }), base + '.svg');
      else { const big = document.createElement('canvas'); SEC.draw(big, prof, Object.assign({ w: 1684, h: 1050, ratio: 2 }, SEC.optsFor(s)));
        if (x.dataset.sx === 'png') big.toBlob(bl => dl(bl, base + '.png'), 'image/png'); else dl(new Blob([root.GA.pdf.build([{ canvas: big, paper: 'A3L' }], { title: 'Granada Atlas — ' + s.name })], { type: 'application/pdf' }), base + '.pdf'); }
    });
    el.addEventListener('change', (e) => { const k = e.target.dataset.sv; if (!k) return; if (k === 'look') s.look = e.target.value; if (k === 'corridor') s.corridor = Math.max(2, Math.min(60, +e.target.value || 15)); if (k === 'floors') s.floors = e.target.checked; save(); if (k === 'floors') paint(); else recompute(); });
    const ro = new ResizeObserver(() => paint()); ro.observe(drawBox);
    const c0 = sh.close; sh.close = (q) => { ro.disconnect(); c0(q); root.GA.app && root.GA.app.refresh && root.GA.app.refresh(); };
    syncCtl(); listDocs(); recompute();
    root.GA.lastViewer = { kind: 'section', get prof() { return prof; }, get last() { return last; }, annotate: (id) => { const h = last && last.hits.find(x => x.id === id); if (h) annotate(h); }, close: () => sh.close() };
    return sh;
  }
  function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  root.GA.sectionView = { open, ROOFS, ROOF_MATS, WALLS };
})(window);
