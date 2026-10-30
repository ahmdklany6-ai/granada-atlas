/* General Information — a research inbox. PDFs, images, links and notes collected before
   deciding which fabric, theme or exercise they belong to. Items live in this browser only
   (IndexedDB "granada-atlas-library"): nothing is uploaded or published. Originals are kept
   unchanged as files; our notes are stored separately from the source's own content. One item
   can be linked to several fabrics, exercises and themes without being duplicated. */
(function (root) {
  const { i18n: I, pages: PG } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc;
  const DB = 'granada-atlas-library'; let dbp = null;
  const THEMES = ['density', 'morphology', 'centre', 'climate', 'human', 'history', 'social', 'planning', 'economy', 'mobility', 'environment', 'photos'];
  const listeners = [];
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' }); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return dbp;
  }
  const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const x = d.transaction(store, mode); const s = x.objectStore(store); const r = fn(s); x.oncomplete = () => res(r && r.result !== undefined ? r.result : r); x.onerror = () => rej(x.error); }); };
  const uid = () => 'lib-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const norm = (it) => Object.assign({ tags: [], links: { fabrics: [], exercises: [], themes: [] }, note: '', excerpt: '', source: '', url: '', date: '', loc: null }, it, { links: Object.assign({ fabrics: [], exercises: [], themes: [] }, it.links || {}) });
  async function list() { const all = await tx('items', 'readonly', s => s.getAll()); return (all || []).map(norm).sort((a, b) => (b.added || '').localeCompare(a.added || '')); }
  async function get(id) { const it = await tx('items', 'readonly', s => s.get(id)); return it ? norm(it) : null; }
  async function put(it) { it.updated = new Date().toISOString(); await tx('items', 'readwrite', s => s.put(it)); listeners.forEach(f => f()); return it; }
  async function del(id) { await tx('items', 'readwrite', s => s.delete(id)); await tx('blobs', 'readwrite', s => s.delete(id)); listeners.forEach(f => f()); }
  async function getBlob(id) { return tx('blobs', 'readonly', s => s.get(id)); }
  async function thumbOf(blob) {
    if (!/^image\//.test(blob.type)) return null;
    const url = URL.createObjectURL(blob); try { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); const s = Math.min(1, 360 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); } catch (e) { return null; } finally { URL.revokeObjectURL(url); }
  }
  async function addBlob(blob, meta) {
    const id = uid(); const kind = meta.kind || (/pdf/.test(blob.type) ? 'pdf' : /^image\//.test(blob.type) ? 'image' : 'file');
    const it = norm(Object.assign({ id, kind, title: meta.title || meta.fileName || t('lib.untitled'), added: new Date().toISOString(), mime: blob.type, size: blob.size, fileName: meta.fileName || null, hasBlob: true, thumb: await thumbOf(blob) }, meta, { id, kind }));
    await tx('blobs', 'readwrite', s => s.put(blob, id)); await put(it); return it;
  }
  async function addItem(meta) { const it = norm(Object.assign({ id: uid(), added: new Date().toISOString() }, meta)); await put(it); return it; }
  async function byLink(type, id) { return (await list()).filter(it => (it.links[type] || []).includes(id)); }
  async function link(itemId, type, id, on) { const it = await get(itemId); if (!it) return; const L = it.links[type] = it.links[type] || []; const i = L.indexOf(id); if (on && i < 0) L.push(id); if (!on && i >= 0) L.splice(i, 1); await put(it); }
  const unsorted = (it) => !it.links.fabrics.length && !it.links.exercises.length && !it.links.themes.length;
  function matchDoc(file) { return list().then(L => L.find(it => (it.fileName || '').toLowerCase().includes(String(file).toLowerCase().replace(/\.pdf$/, '')) || (it.title || '').toLowerCase().includes(String(file).toLowerCase().replace(/\.pdf$/, '').replace(/_/g, ' ')))); }

  // ---------- backup ----------
  async function exportZip() {
    const items = await list(); const files = [{ name: 'library.json', data: JSON.stringify({ version: 1, exported: new Date().toISOString(), items }, null, 1) }];
    for (const it of items) if (it.hasBlob) { const b = await getBlob(it.id); if (b) files.push({ name: 'files/' + it.id + (it.fileName ? '_' + PG.slug(it.fileName) : '') + extOf(it), data: new Uint8Array(await b.arrayBuffer()) }); }
    const bytes = root.GA.zip.zip(files, new Date()); PG.download(new Blob([bytes], { type: 'application/zip' }), 'granada-atlas-library-' + new Date().toISOString().slice(0, 10) + '.zip');
  }
  const extOf = (it) => it.mime === 'application/pdf' ? '.pdf' : /png/.test(it.mime) ? '.png' : /jpe?g/.test(it.mime) ? '.jpg' : /svg/.test(it.mime) ? '.svg' : '';
  async function importZip(file) {
    const z = await root.GA.imports.unzip(await file.arrayBuffer()); if (!z['library.json']) throw new Error(t('lib.badBackup'));
    const j = JSON.parse(new TextDecoder().decode(await z['library.json'].bytes())); let n = 0;
    for (const it of j.items || []) { const key = Object.keys(z).find(k => k.startsWith('files/' + it.id)); if (key) { const bytes = await z[key].bytes(); await tx('blobs', 'readwrite', s => s.put(new Blob([bytes], { type: it.mime || '' }), it.id)); } await tx('items', 'readwrite', s => s.put(it)); n++; }
    listeners.forEach(f => f()); return n;
  }

  // ---------- page ----------
  let F = { q: '', kind: '', coll: '', tag: '' };
  const fabricsOf = () => root.GA.store.get().areas.map(a => ({ id: a.id, name: a.name }));
  const exercisesOf = () => root.GA.exercises ? root.GA.exercises.list().map(e => ({ id: e.id, name: e.title })) : [];
  function card(it) {
    const prev = it.thumb ? `<img src="${it.thumb}" alt="">` : `<span class="lib-ico">${{ pdf: 'PDF', link: '↗', note: '¶', image: 'IMG', file: 'FILE' }[it.kind] || '•'}</span>`;
    const L = it.links; const tagsHtml = (it.tags || []).map(x => `<span class="tag">${esc(x)}</span>`).join('');
    const where = unsorted(it) ? `<span class="tag unsorted">${t('lib.unsorted')}</span>` : [...L.fabrics.map(id => (fabricsOf().find(f => f.id === id) || {}).name).filter(Boolean).map(n => `<span class="tag fab">${esc(n)}</span>`), ...L.exercises.map(id => `<span class="tag ex">${esc((exercisesOf().find(e => e.id === id) || {}).name || id)}</span>`), ...L.themes.map(k => `<span class="tag th">${t('th.' + k)}</span>`)].join('');
    return `<article class="lib-card" data-lib="${it.id}"><div class="lib-prev">${prev}</div><div class="lib-meta"><h4 dir="auto">${esc(it.title)}</h4><small dir="auto">${esc(it.source || '')}${it.date ? ' · <span dir="ltr">' + esc(it.date) + '</span>' : ''}</small>${it.note ? `<p class="lib-note" dir="auto">${esc(it.note.slice(0, 140))}</p>` : ''}<div class="tags">${where}${tagsHtml}</div></div></article>`;
  }
  async function render(body) {
    const items = await list(); const tags = [...new Set(items.flatMap(i => i.tags || []))].sort();
    const q = F.q.trim().toLowerCase();
    const shown = items.filter(it => (!F.kind || it.kind === F.kind) && (!F.tag || (it.tags || []).includes(F.tag)) && (!F.coll || (F.coll === 'unsorted' ? unsorted(it) : F.coll.startsWith('fab:') ? it.links.fabrics.includes(F.coll.slice(4)) : F.coll.startsWith('ex:') ? it.links.exercises.includes(F.coll.slice(3)) : F.coll.startsWith('th:') ? it.links.themes.includes(F.coll.slice(3)) : true)) && (!q || [it.title, it.source, it.note, it.excerpt, (it.tags || []).join(' '), it.url].join(' ').toLowerCase().includes(q)));
    const nUns = items.filter(unsorted).length;
    body.innerHTML = `<div class="lib-top"><div class="ok">${t('lib.storage')}</div>
      <div class="lib-add"><label class="btn btn-primary">${t('lib.upload')}<input type="file" id="lib-files" multiple accept="application/pdf,image/*" hidden></label><button class="btn" id="lib-link">${t('lib.addLink')}</button><button class="btn" id="lib-note">${t('lib.addNote')}</button><span class="sep"></span><button class="btn btn-small" id="lib-export">${t('lib.backup')}</button><label class="btn btn-small">${t('lib.restore')}<input type="file" id="lib-import" accept=".zip,application/zip" hidden></label></div></div>
      <div class="lib-filters"><input type="search" id="lib-q" dir="auto" placeholder="${esc(t('lib.searchPh'))}" value="${esc(F.q)}">
        <select id="lib-coll"><option value="">${t('lib.allColl')} (${items.length})</option><option value="unsorted" ${F.coll === 'unsorted' ? 'selected' : ''}>${t('lib.unsorted')} (${nUns})</option><optgroup label="${esc(t('lib.fabrics'))}">${fabricsOf().map(f => `<option value="fab:${f.id}" ${F.coll === 'fab:' + f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</optgroup><optgroup label="${esc(t('lib.exercises'))}">${exercisesOf().map(e => `<option value="ex:${e.id}" ${F.coll === 'ex:' + e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup><optgroup label="${esc(t('lib.themes'))}">${THEMES.map(k => `<option value="th:${k}" ${F.coll === 'th:' + k ? 'selected' : ''}>${t('th.' + k)}</option>`).join('')}</optgroup></select>
        <select id="lib-kind"><option value="">${t('lib.allKinds')}</option>${['pdf', 'image', 'link', 'note', 'file'].map(k => `<option value="${k}" ${F.kind === k ? 'selected' : ''}>${t('lib.k.' + k)}</option>`).join('')}</select>
        <select id="lib-tag"><option value="">${t('lib.allTags')}</option>${tags.map(x => `<option ${F.tag === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      ${shown.length ? `<div class="lib-grid">${shown.map(card).join('')}</div>` : `<p class="note">${items.length ? t('lib.noMatch') : t('lib.empty')}</p>`}
      <details class="method"><summary>${t('lib.refsTitle')}</summary>${refsHTML()}</details>`;
    const on = (id, ev, fn) => { const x = body.querySelector(id); if (x) x.addEventListener(ev, fn); };
    on('#lib-q', 'input', (e) => { F.q = e.target.value; clearTimeout(window.__libT); window.__libT = setTimeout(() => render(body).then(() => { const x = body.querySelector('#lib-q'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }), 250); });
    ['coll', 'kind', 'tag'].forEach(k => on('#lib-' + k, 'change', (e) => { F[k] = e.target.value; render(body); }));
    on('#lib-files', 'change', async (e) => { for (const f of e.target.files) await addBlob(f, { title: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, date: '', source: '' }); render(body); });
    on('#lib-link', 'click', async () => { const it = await addItem({ kind: 'link', title: t('lib.newLink'), url: 'https://' }); openEditor(it.id, body); });
    on('#lib-note', 'click', async () => { const it = await addItem({ kind: 'note', title: t('lib.newNote') }); openEditor(it.id, body); });
    on('#lib-export', 'click', exportZip);
    on('#lib-import', 'change', async (e) => { try { const n = await importZip(e.target.files[0]); root.GA.toast && root.GA.toast(t('lib.restored', { n })); } catch (er) { root.GA.toast && root.GA.toast(er.message, true); } render(body); });
    body.querySelectorAll('[data-lib]').forEach(c => c.addEventListener('click', () => openEditor(c.dataset.lib, body)));
    body.querySelectorAll('[data-ref]').forEach(b => b.addEventListener('click', () => openRef(b.dataset.ref)));
  }
  function refsHTML() {
    return `<p class="fine">${t('lib.refsLead')}</p><table class="tbl small"><thead><tr><th>${t('ref.doc')}</th><th>${t('ref.type')}</th><th>${t('ref.years')}</th><th>${t('ref.dataStatus')}</th><th></th></tr></thead><tbody>${root.GA.ext.DOCS.map(d => `<tr><td><b dir="ltr">${esc(d.file)}</b><br><small dir="ltr">${esc(d.publisher)}</small></td><td><small>${esc(d.type)}</small></td><td><small>${t('ref.dataYear')}: <span dir="ltr">${esc(d.dataYear)}</span><br>${t('ref.reportYear')}: <span dir="ltr">${esc(d.reportYear)}</span></small></td><td><small dir="ltr">${esc(d.data)}</small></td><td><button class="btn btn-tiny" data-ref="${d.id}">${t('ref.view')}</button></td></tr>`).join('')}</tbody></table>`;
  }
  // Reference viewer: metadata + the document itself if the user keeps a copy in the library; CC BY figures are shown directly.
  async function openRef(id) {
    const d = root.GA.ext.DOCS.find(x => x.id === id); if (!d) return; const m = document.getElementById('modal');
    const local = await matchDoc(d.file);
    const figs = id === 'heat' ? `<figure><img src="data/ref/heat_fig2_vulnerability_exposure.jpg" alt="" style="max-width:100%"><figcaption>${t('ref.heatFig2')}</figcaption></figure><figure><img src="data/ref/heat_fig3_priority_areas.jpg" alt="" style="max-width:100%"><figcaption>${t('ref.heatFig3')}</figcaption></figure><p class="fine">© 2025 The Authors — Silveira et al., Urban Forestry & Urban Greening 107:128794 — CC BY 4.0 (figures reproduced unchanged, reduced in size).</p>` : '';
    m.innerHTML = `<div class="modal-box" role="dialog"><div class="modal-h"><h3 dir="auto">${esc(d.title)}</h3><button class="btn btn-small" data-modal-close>✕</button></div><div class="modal-b ref-b"><div class="ref-meta"><table class="tbl small"><tr><th>${t('ref.file')}</th><td dir="ltr">${esc(d.file)}</td></tr><tr><th>${t('ref.publisher')}</th><td dir="ltr">${esc(d.publisher)}</td></tr><tr><th>${t('ref.dataYear')}</th><td dir="ltr">${esc(d.dataYear)}</td></tr><tr><th>${t('ref.reportYear')}</th><td dir="ltr">${esc(d.reportYear)}</td></tr><tr><th>${t('ref.type')}</th><td dir="ltr">${esc(d.type)}</td></tr><tr><th>${t('ref.unit')}</th><td dir="ltr">${esc(d.unit)}</td></tr><tr><th>${t('ref.coverage')}</th><td dir="ltr">${esc(d.coverage)}</td></tr><tr><th>${t('ref.dataStatus')}</th><td dir="ltr">${esc(d.data)}</td></tr>${d.url ? `<tr><th>${t('ref.link')}</th><td><a href="${esc(d.url)}" target="_blank" rel="noopener" dir="ltr">${esc(d.url)}</a></td></tr>` : ''}</table><p class="fine">${t('ref.k.' + d.kind)}</p><p class="fine">${t('ref.noColours')}</p></div><div class="ref-doc">${figs}${local ? `<p class="ok">${t('ref.localCopy')}</p><button class="btn btn-small" data-lib-open="${local.id}">${t('ref.openLocal')}</button>` : (id !== 'heat' ? `<p class="note">${t('ref.notStored')}</p>` : '')}</div></div></div>`;
    m.hidden = false; const b = m.querySelector('[data-lib-open]'); if (b) b.onclick = () => { m.hidden = true; openEditor(b.dataset.libOpen); };
  }
  async function openEditor(id, body) {
    const it = await get(id); if (!it) return; const m = document.getElementById('modal'); let url = null;
    if (it.hasBlob) { const b = await getBlob(id); if (b) url = URL.createObjectURL(b); }
    const prev = it.kind === 'image' && url ? `<img src="${url}" alt="" class="lib-big">` : it.kind === 'pdf' && url ? `<iframe src="${url}" class="lib-pdf" title="PDF"></iframe>` : it.kind === 'link' && it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" dir="ltr">${esc(it.url)}</a>` : '';
    const chk = (type, val, label) => `<label class="chk"><input type="checkbox" data-link="${type}" value="${esc(val)}" ${it.links[type].includes(val) ? 'checked' : ''}> ${label}</label>`;
    m.innerHTML = `<div class="modal-box lib-ed" role="dialog"><div class="modal-h"><h3>${t('lib.edit')}</h3><div class="actions">${url ? `<a class="btn btn-small" href="${url}" download="${esc(it.fileName || PG.slug(it.title) + extOf(it))}">${t('lib.original')}</a>` : ''}<button class="btn btn-small danger" id="lib-del">${t('delete')}</button><button class="btn btn-small" data-modal-close>✕</button></div></div>
      <div class="modal-b"><div class="lib-prev-big">${prev}<p class="fine">${it.hasBlob ? t('lib.origKept', { n: PG.nf((it.size || 0) / 1024) }) : ''}</p></div>
      <form class="lib-form" onsubmit="return false"><label class="name"><span>${t('lib.title')}</span><input dir="auto" name="title" value="${esc(it.title)}"></label>
      <label class="name"><span>${t('lib.source')}</span><input dir="auto" name="source" value="${esc(it.source)}" placeholder="${esc(t('lib.sourcePh'))}"></label>
      <div class="row2"><label class="name"><span>${t('lib.date')}</span><input dir="ltr" name="date" value="${esc(it.date)}" placeholder="YYYY-MM-DD"></label><label class="name"><span>${t('lib.url')}</span><input dir="ltr" name="url" value="${esc(it.url)}"></label></div>
      <div class="row2"><label class="name"><span>${t('lib.lat')}</span><input dir="ltr" name="lat" value="${it.loc ? it.loc[1] : ''}" inputmode="decimal"></label><label class="name"><span>${t('lib.lon')}</span><input dir="ltr" name="lon" value="${it.loc ? it.loc[0] : ''}" inputmode="decimal"></label></div>
      <label class="name"><span>${t('lib.tags')}</span><input dir="auto" name="tags" value="${esc((it.tags || []).join(', '))}"></label>
      <label class="name"><span>${t('lib.excerpt')}</span><textarea dir="auto" name="excerpt" rows="3">${esc(it.excerpt)}</textarea></label>
      <label class="name"><span>${t('lib.note')}</span><textarea dir="auto" name="note" rows="3">${esc(it.note)}</textarea></label>
      <fieldset><legend>${t('lib.linkTo')}</legend><div class="ctl-grid">${fabricsOf().map(f => chk('fabrics', f.id, '▣ ' + esc(f.name))).join('')}${exercisesOf().map(e => chk('exercises', e.id, '✎ ' + esc(e.name))).join('')}${THEMES.map(k => chk('themes', k, t('th.' + k))).join('')}</div><p class="fine">${t('lib.linkNote')}</p></fieldset>
      <div class="actions"><button class="btn btn-primary" id="lib-save">${t('save')}</button></div></form></div></div>`;
    m.hidden = false;
    m.querySelector('#lib-save').onclick = async () => { const f = m.querySelector('.lib-form'); const v = (n) => f.elements[n].value.trim(); it.title = v('title') || it.title; it.source = v('source'); it.date = v('date'); it.url = v('url'); it.tags = v('tags').split(',').map(s => s.trim()).filter(Boolean); it.excerpt = f.elements.excerpt.value; it.note = f.elements.note.value; const la = parseFloat(v('lat')), lo = parseFloat(v('lon')); it.loc = isFinite(la) && isFinite(lo) ? [lo, la] : null; ['fabrics', 'exercises', 'themes'].forEach(k => it.links[k] = [...m.querySelectorAll(`[data-link="${k}"]:checked`)].map(x => x.value)); await put(it); m.hidden = true; if (url) URL.revokeObjectURL(url); if (body) render(body); else if (PG.current) PG.route(); };
    m.querySelector('#lib-del').onclick = async (e) => { const b = e.target; if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = t('ar.confirmDel'); return; } await del(id); m.hidden = true; if (body) render(body); else if (PG.current) PG.route(); };
  }

  PG.register('library', { plate: () => t('lib.plate'), title: () => t('lib.title2'), render });
  root.GA.library = { list, get, put, del, getBlob, addBlob, addItem, byLink, link, exportZip, importZip, openEditor, openRef, THEMES, onChange: (f) => listeners.push(f), unsorted };
})(window);
