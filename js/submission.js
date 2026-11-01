/* Four independent states for anything handed in to the studio (Exercise 1.3, the climate board, Miro squares):
   tools available · content completed · exported · uploaded to Miro. Exports are recorded automatically and never
   change the upload state; "uploaded to Miro" is set only by the user, after a confirmation. There is no Miro
   integration — the site cannot know what is on the board. Older saves with a single `status` are read as before. */
(function (root) {
  const I = root.GA.i18n; const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function norm(rec) {
    if (!rec) return rec;
    if (rec.status === 'uploaded' && rec.uploaded == null) rec.uploaded = { at: null, legacy: true };
    if ((rec.status === 'exported' || rec.status === 'uploaded') && !rec.exports) rec.exports = [{ at: null, kind: 'legacy' }];
    return rec;
  }
  function exported(rec, kind) { norm(rec); rec.exports = (rec.exports || []).concat([{ at: new Date().toISOString(), kind }]).slice(-12); }
  const lastExport = (rec) => { const e = (rec.exports || []).slice(-1)[0]; return e || null; };
  const day = (iso) => iso ? iso.slice(0, 10) + ' ' + iso.slice(11, 16) : '';
  // o: { tools: bool, toolsNote, done, total, missing: [{ label, go }], compact, id }
  function strip(rec, o) {
    norm(rec); const le = lastExport(rec); const up = rec.uploaded; const content = o.total ? o.done >= o.total : false;
    const st = (ok, label, val, extra) => `<div class="ss ${ok ? 'ok' : 'no'}" role="listitem"><span class="ss-k">${label}</span><span class="ss-v">${val}</span>${extra || ''}</div>`;
    let h = `<div class="sub-states${o.compact ? ' compact' : ''}" role="list" aria-label="${esc(t('v7.stateNote'))}">`;
    h += st(o.tools !== false, t('v7.state.tools'), o.tools !== false ? '✓ ' + t('v7.yes') : esc(o.toolsNote || t('v7.notYet')));
    h += st(content, t('v7.state.content'), o.total ? `<b class="num">${o.done}/${o.total}</b>` : '—');
    h += st(!!le, t('v7.state.exported'), le ? (le.at ? `<span dir="ltr">${day(le.at)}</span>` : '✓') : t('v7.notYet'));
    h += st(!!up, t('v7.state.uploaded'), up ? (up.at ? `✓ <span dir="ltr">${day(up.at)}</span>` : '✓') : t('v7.notYet'),
      o.compact ? '' : `<label class="chk ss-up"><input type="checkbox" data-sub-up ${up ? 'checked' : ''}> ${t('v7.confirmUpload')}</label>`);
    h += '</div>';
    if (!o.compact) h += `<p class="fine">${t('v7.stateNote')}</p>${o.miroField ? `<label class="name"><span>${t('v7.miroLink')}</span><input dir="ltr" type="url" data-sub-link value="${esc(rec.miro || '')}" placeholder="https://miro.com/app/board/…"></label>` : ''}`;
    if (o.missing) h += o.missing.length ? `<div class="sub-miss" role="note"><b>${t('v7.missing')}</b><ul>${o.missing.map(m => `<li><button type="button" class="link" data-sub-go="${esc(m.go)}" title="${esc(t('v7.goTo'))}">${esc(m.label)}</button></li>`).join('')}</ul></div>` : `<p class="ok">${t('v7.allDone')}</p>`;
    return h;
  }
  // wires the upload confirmation, the Miro link and the "go to field" links inside a container
  function bind(box, getRec, save, after) {
    box.addEventListener('change', (e) => {
      const up = e.target.closest('[data-sub-up]'); const rec = getRec(e.target); if (!rec) return;
      if (up) { if (up.checked) { if (!root.confirm(t('slot.confirmQ'))) { up.checked = false; return; } rec.uploaded = { at: new Date().toISOString() }; } else delete rec.uploaded; delete rec.status; save(); after && after(); }
      const ln = e.target.closest('[data-sub-link]'); if (ln) { rec.miro = ln.value.trim(); save(); }
    });
    box.addEventListener('click', (e) => { const g = e.target.closest('[data-sub-go]'); if (!g) return; const el = box.querySelector(g.dataset.subGo) || document.querySelector(g.dataset.subGo); if (!el) return;
      const d = el.closest('details'); if (d) d.open = true; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { el.focus({ preventScroll: true }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }, 250); });
  }
  root.GA.submission = { norm, exported, lastExport, strip, bind };
})(window);
