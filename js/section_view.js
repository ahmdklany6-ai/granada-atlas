/* Large section viewer: the street-section drawing at full size with zoom and pan (wheel, drag, pinch, buttons),
   its controls (scale, detail level, viewing direction, background projection depth, tree projection distance, floor
   height, slabs, scale figures), user-entered street dimensions, building annotations and exports (high-resolution
   PNG, vector SVG, vector PDF). An annotation records what the user documented about a building (roof shape and
   finish, wall material, balconies, openings) together with its source; it is drawn as documented detail. Street
   dimensions typed here are drawn and labelled as user input, separate from the widths measured from footprints. */
(function (root) {
  const { i18n: I, section: SEC, store } = root.GA;
  const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf = (v, d) => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d });
  const VES = [1, 2, 3, 5];
  const ROOFS = ['flat', 'gabled', 'hipped', 'side_hipped', 'pyramidal', 'skillion', 'dome', 'round', 'mansard', 'many'];
  const ROOF_MATS = ['tiles', 'slate', 'metal', 'membrane', 'green'];
  const WALLS = ['render', 'brick', 'stone', 'concrete', 'glass', 'timber'];
  const notesAll = () => { const p = store.get(); p.buildingNotes = p.buildingNotes || {}; return p.buildingNotes; };
  const EXPORT = { w: 1684, h: 1190 }; // A3 landscape proportions; PNG at 3× (5052 × 3570 px)

  function open(areaId, secId) {
    // a section belongs to a fabric (areaId) or is standalone (areaId null: project.sections)
    const P0 = store.get(); const a = areaId ? P0.areas.find(x => x.id === areaId) : { id: null, name: t('v6.standalone'), sections: P0.sections || (P0.sections = []) }; if (!a) return;
    const s = (a.sections || []).find(x => x.id === secId) || (a.sections || [])[0]; if (!s) return;
    let prof = null, last = null, sel = null, logical = { w: 1200, h: 800, css: 1 };
    const sh = root.GA.viewer.shell({ kind: 'vw-sec', title: esc(s.name), subtitle: esc(a.name) + ' · ' + t('v5.sectionView'),
      tools: `<button class="btn btn-small" data-sv-act="rev" title="${esc(t('v7.reverseHint'))}">⇄ <span class="lbl">${t('v7.reverse')}</span></button>
        <div class="vw-zoom" role="group" aria-label="${esc(t('v5.zoom'))}"><button class="btn btn-small" data-z="in" aria-label="${esc(t('v5.zoomIn'))}">＋</button><button class="btn btn-small" data-z="out" aria-label="${esc(t('v5.zoomOut'))}">－</button><button class="btn btn-small" data-z="reset">${t('v5.resetView')}</button></div>
        <button class="btn btn-small" data-sx="png">PNG</button><button class="btn btn-small" data-sx="svg">SVG</button><button class="btn btn-small" data-sx="pdf">PDF</button>`,
      body: `<div class="sv"><div class="sv-main"><div class="sv-stage" tabindex="0" aria-label="${esc(t('v5.sectionDrawing'))}"><canvas class="sv-cv"></canvas></div><p class="vw-hint">${t('v7.viewerHint')}</p></div>
        <div class="sv-side">
          <div class="sv-ctl">
            <fieldset><legend>${t('v7.scale')}</legend><div class="seg" role="group">${VES.map(v => `<button type="button" data-ve="${v}" aria-pressed="false">${v === 1 ? t('v7.trueScale') : '×' + v}</button>`).join('')}</div><p class="fine">${t('v7.scaleNote')}</p></fieldset>
            <fieldset><legend>${t('v5.detail')}</legend><div class="seg" role="group"><button type="button" data-ill="0" aria-pressed="false">${t('v5.detailEvidence')}</button><button type="button" data-ill="1" aria-pressed="false">${t('v5.detailIll')}</button></div></fieldset>
            <div class="sv-grid">
              <label>${t('sec.look')} <select data-sv="look"><option value="left">${t('sec.look_left')}</option><option value="right">${t('sec.look_right')}</option></select></label>
              <label title="${esc(t('v7.depthHint'))}">${t('v7.depth')} <span class="u"><input type="number" min="10" max="150" step="5" data-sv="depth"> m</span></label>
              <label title="${esc(t('v4.corridorHint'))}">${t('v7.treeDist')} <span class="u"><input type="number" min="2" max="60" step="1" data-sv="corridor"> m</span></label>
              <label>${t('sec.floorH')} <span class="u"><input type="number" min="2.4" max="6" step="0.1" data-sv="floorH"> m</span></label>
              <label class="chk"><input type="checkbox" data-sv="floors"> ${t('v7.slabs')}</label>
              <label class="chk"><input type="checkbox" data-sv="figures"> ${t('v7.figures')}</label>
            </div>
            <p class="fine">${t('v7.endpointsHint')}</p>
          </div>
          <section class="sv-widths"></section>
          <section class="sv-ann" aria-live="polite"></section>
          <details class="method"><summary>${t('v5.secMethods')}</summary><div class="sv-methods"></div></details>
        </div></div>` });
    const el = sh.el; const stage = el.querySelector('.sv-stage'), cv = el.querySelector('.sv-cv'), ann = el.querySelector('.sv-ann'), meth = el.querySelector('.sv-methods'), wbox = el.querySelector('.sv-widths');
    const pz = root.GA.viewer.panZoom(stage, cv, { max: 10 });
    const save = () => { if (a.id) store.upsertArea(a); else store.save(); root.GA.app && root.GA.app.secProfiles && root.GA.app.secProfiles.delete(s.id); };
    const syncCtl = () => {
      const ve = s.veUser ? s.ve : 1; el.querySelectorAll('[data-ve]').forEach(b => b.setAttribute('aria-pressed', String(String(ve) === b.dataset.ve)));
      el.querySelectorAll('[data-ill]').forEach(b => b.setAttribute('aria-pressed', String((s.ill ? '1' : '0') === b.dataset.ill)));
      const v = (k, x) => { el.querySelector(`[data-sv=${k}]`).value = x; };
      v('look', s.look === 'right' ? 'right' : 'left'); v('depth', s.depth || 40); v('corridor', s.corridor || 15); v('floorH', s.floorH || 3);
      el.querySelector('[data-sv=floors]').checked = s.floors !== false; el.querySelector('[data-sv=figures]').checked = s.figures !== false;
    };
    async function recompute() { stage.classList.add('busy'); try { prof = await SEC.compute(s, { floorH: s.floorH || 3 }); } catch (e) { stage.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; } finally { stage.classList.remove('busy'); } paint(); widths(); methods(); }
    function paint() {
      if (!prof) return; const sw = Math.max(280, stage.clientWidth), shh = Math.max(220, stage.clientHeight);
      // logical drawing size: never narrower than 1100 px so labels keep their size; the canvas is fitted to the stage and zoomed by the user
      // phones: a narrower logical page (larger relative text) and an initial zoom onto the drawing; the user can zoom out to see the footer
      const narrow = sw < 700; const aspect = narrow ? 0.9 : Math.max(0.56, Math.min(0.78, shh / sw)); const W = narrow ? 780 : Math.max(1100, sw), H = Math.round(W * aspect);
      const cssW = Math.min(sw, shh / aspect), cssH = cssW * aspect; const dpr = root.devicePixelRatio || 1; const ratio = Math.min(6000 / W, cssW * dpr * 2.5 / W);
      last = SEC.draw(cv, prof, Object.assign({ w: W, h: H, ratio }, SEC.optsFor(s))); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px'; cv.style.marginLeft = Math.max(0, (sw - cssW) / 2) + 'px';
      logical = { w: W, h: H, css: cssW / W }; if (sel) annotate(sel);
      if (narrow && !paint._zoomed && last) { paint._zoomed = true; const top = Math.max(0, Math.min(...last.hits.map(h => h.y0).concat([H * 0.3]))); const f = Math.min(2.2, shh / (cssH * 0.72)); pz.reset(); pz.zoom(f, sw / 2, (top + (H * 0.72 - top) / 2) * logical.css); }
    }
    function widths() {
      const zs = (prof.surf ? prof.surf.streets : []).filter(z => z.faceA != null); s.widths = s.widths || {};
      wbox.innerHTML = `<h3>${t('v7.widthsTitle')}</h3><p class="fine">${t('v7.widthsLead')}</p>` + (zs.length ? zs.map(z => { const u = s.widths[z.key] || {};
        return `<fieldset class="sv-w" data-wk="${esc(z.key)}"><legend><bdi>${esc(z.name || z.hw || '—')}</bdi> · ${t('v7.measured')} <b class="num">${nf(z.gap)} m</b></legend>
          <label>${t('v7.swA')} <span class="u"><input type="number" min="0" max="${Math.floor(z.gap)}" step="0.1" data-w="sa" value="${u.sa != null ? u.sa : ''}"> m</span></label>
          <label>${t('v7.swB')} <span class="u"><input type="number" min="0" max="${Math.floor(z.gap)}" step="0.1" data-w="sb" value="${u.sb != null ? u.sb : ''}"> m</span></label>
          <label class="wide">${t('v5.source')} <input data-w="src" value="${esc(u.src || '')}" placeholder="${esc(t('v7.widthSrcPh'))}"></label></fieldset>`; }).join('') : `<p class="note">${t('v7.noWidths')}</p>`);
    }
    function methods() {
      const p = prof; const sf = p.surf || { green: [], streets: [], water: [] }; const cutsRs = p.cuts.filter(c => c.rs).length; const lvT = p.cuts.filter(c => c.lv).length; const hT = p.cuts.filter(c => c.src === 'height').length;
      meth.innerHTML = `<ul class="find"><li>${t('v7.mScale')}</li><li>${t('v7.mHeights', { h: hT, l: lvT - hT < 0 ? 0 : lvT, c: p.cuts.length, f: nf(p.floorH || 3) })}</li><li>${t('v5.mRoof', { n: cutsRs, c: p.cuts.length })}</li>
        <li>${t('v7.mWidths', { n: sf.streets.filter(z => z.faceA != null).length, s: sf.streets.length })}</li>
        <li>${t('v4.secTrees', { c: p.corridor, n: p.trees.filter(x => !x.row).length, near: p.nearTrees, h: p.trees.filter(x => !x.row && x.h).length, r: p.rowsNear, date: (p.treeTs || '').slice(0, 10) })}</li>
        <li>${t('v7.mBg', { d: p.depth, n: p.bg.length, u: p.bgUnknown })}</li><li>${t('v7.mFig')}</li><li>${t('v5.mDoc')}</li></ul>`;
    }
    // ---- annotations ----
    function hitAt(lx, ly) { if (!last) return null; const hs = last.hits; for (let i = hs.length - 1; i >= 0; i--) { const h = hs[i]; if (h.kind === 'cut' && lx >= h.x0 - 2 && lx <= h.x1 + 2 && ly >= h.y0 - 10 && ly <= h.y1 + 4) return h; } for (let i = hs.length - 1; i >= 0; i--) { const h = hs[i]; if (lx >= h.x0 && lx <= h.x1 && ly >= h.y0 && ly <= h.y1) return h; } return null; }
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
      if (root.matchMedia && root.matchMedia('(max-width: 900px)').matches) ann.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    function listDocs() {
      if (sel) return; const ids = new Set((prof ? prof.cuts.concat(prof.bg) : []).map(b => b.id)); const N = notesAll(); const docs = Object.entries(N).filter(([id]) => ids.has(id));
      ann.innerHTML = `<h3>${t('v5.documented')}</h3><p class="fine">${t('v7.annHint')}</p>${docs.length ? `<ul class="docs">${docs.map(([id, n]) => `<li><b dir="ltr">${esc(id)}</b> — ${[n.roof && t('roof.' + n.roof), n.roofMat && t('mat.' + n.roofMat), n.wall && t('mat.' + n.wall), n.balconies === 'yes' && t('v5.balconies')].filter(Boolean).map(esc).join(', ')}<br><small>${t('v5.source')}: ${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.source)}</a>` : esc(n.source)}</small></li>`).join('')}</ul>` : `<p class="fine">${t('v5.noDocs')}</p>`}`;
    }
    // ---- exports ----
    const base = () => `granada_section_${String(s.name).replace(/[^\p{L}\p{N}]+/gu, '_')}`;
    async function exportAs(kind) {
      const o = Object.assign({}, EXPORT, SEC.optsFor(s));
      if (kind === 'svg') return dl(new Blob([SEC.svg(prof, o)], { type: 'image/svg+xml' }), base() + '.svg');
      if (kind === 'pdf') return dl(new Blob([await SEC.pdf(prof, o)], { type: 'application/pdf' }), base() + '.pdf');
      const big = document.createElement('canvas'); SEC.draw(big, prof, Object.assign(o, { ratio: 3 })); big.toBlob(bl => dl(bl, base() + '.png'), 'image/png');
    }
    // ---- events ----
    stage.addEventListener('click', (e) => { if (pz.moved > 6) return; const [lx, ly] = pz.toLocal(e.clientX, e.clientY); const h = hitAt(lx / logical.css, ly / logical.css); if (h) annotate(h); });
    el.addEventListener('click', async (e) => {
      const z = e.target.closest('[data-z]'); if (z) { if (z.dataset.z === 'in') pz.zoom(1.5); else if (z.dataset.z === 'out') pz.zoom(1 / 1.5); else pz.reset(); return; }
      const v = e.target.closest('[data-ve]'); if (v) { s.ve = +v.dataset.ve; s.veUser = s.ve !== 1; save(); syncCtl(); paint(); return; }
      const il = e.target.closest('[data-ill]'); if (il) { s.ill = il.dataset.ill === '1'; save(); syncCtl(); paint(); return; }
      if (e.target.closest('[data-sv-act=rev]')) { s.look = s.look === 'right' ? 'left' : 'right'; save(); syncCtl(); recompute(); return; }
      const x = e.target.closest('[data-sx]'); if (!x || !prof) return; x.disabled = true; try { await exportAs(x.dataset.sx); } finally { x.disabled = false; }
    });
    el.addEventListener('change', (e) => {
      const w = e.target.closest('[data-wk]'); if (w && e.target.dataset.w) { const k = w.dataset.wk; const u = Object.assign({}, (s.widths || {})[k] || {}); const f = e.target.dataset.w; const val = e.target.value.trim();
        if (f === 'src') { if (val) u.src = val; else delete u.src; } else { const n2 = parseFloat(val); if (val === '' || !isFinite(n2) || n2 < 0) delete u[f]; else u[f] = Math.round(n2 * 10) / 10; }
        s.widths = Object.assign({}, s.widths || {}); if (u.sa == null && u.sb == null) delete s.widths[k]; else s.widths[k] = u; save(); paint(); return; }
      const k = e.target.dataset.sv; if (!k) return; const num = (lo, hi, d) => { const n2 = parseFloat(e.target.value); return isFinite(n2) ? Math.max(lo, Math.min(hi, n2)) : d; };
      if (k === 'look') s.look = e.target.value; if (k === 'depth') s.depth = num(10, 150, 40); if (k === 'corridor') s.corridor = num(2, 60, 15); if (k === 'floorH') s.floorH = num(2.4, 6, 3);
      if (k === 'floors') s.floors = e.target.checked; if (k === 'figures') s.figures = e.target.checked; save(); syncCtl(); if (k === 'floors' || k === 'figures') paint(); else recompute();
    });
    const ro = new ResizeObserver(() => paint()); ro.observe(stage);
    const c0 = sh.close; sh.close = (q) => { ro.disconnect(); c0(q); root.GA.app && root.GA.app.refresh && root.GA.app.refresh(); };
    syncCtl(); listDocs(); recompute();
    root.GA.lastViewer = { kind: 'section', get prof() { return prof; }, get last() { return last; }, pz, logical: () => logical, exportAs, annotate: (id) => { const h = last && last.hits.find(x => x.id === id); if (h) annotate(h); }, close: () => sh.close() };
    return sh;
  }
  function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  root.GA.sectionView = { open, ROOFS, ROOF_MATS, WALLS };
})(window);
