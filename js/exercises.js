/* Exercise registry — extensible without rebuilding the site. Built-in entries for 1.1, 1.2
   and 1.3 carry requirements read from the briefs, with statuses computed from the project
   where the tool can check them. New exercises are added from pasted text or a DOCX: the text
   is split into candidate requirements (mandatory / suggestion / ambiguous) for review before
   adoption; earlier versions are kept; the original file stays in General Information. */
(function (root) {
  const { i18n: I, pages: PG, store } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc;
  const BUILTIN = {
    ex11: { tkey: 'exn.11', req: [['r11.40', 'm', 'lib40'], ['r11.5data', 'm', 'surprise5'], ['r11.kinds', 'm', null], ['r11.attrib', 'm', null], ['r11.open', 'm', null], ['r11.users', 's', null]] },
    ex12: { tkey: 'exn.12', req: [['r12.four', 'm', 'four'], ['r12.equal', 'm', 'equal'], ['r12.five', 'm', 'five'], ['r12.secPlan', 'm', 'sections'], ['r12.public', 'm', null], ['r12.just', 'm', 'just'], ['r12.sentence', 'm', 'sentence'], ['r12.sheet', 'm', null]] },
    ex13: { tkey: 'exn.13', req: [['r13.frame', 'm', 'frame'], ['r13.page', 'm', 'pages'], ['r13.identity', 'm', 'identity'], ['r13.synth', 'm', 'synth'], ['r13.forms', 'm', null], ['r13.export', 'm', null], ['r13.miro', 'm', null], ['r13.ideas', 's', null]] },
  };
  function reg() { const p = store.get(); p.exreg = p.exreg || []; return p.exreg; }
  function list() { return Object.entries(BUILTIN).map(([id, b]) => ({ id, title: t(b.tkey), builtin: true })).concat(reg().map(e => ({ id: e.id, title: e.title }))); }
  async function auto(key) {
    const p = store.get(); const ex12 = p.ex12 || { ids: [], fabrics: {} }; const A = p.areas.filter(a => ex12.ids.includes(a.id)); const e13 = p.ex13 || {};
    switch (key) {
      case 'lib40': { const n = root.GA.library ? (await root.GA.library.list()).filter(i => i.kind === 'image' || i.kind === 'link' || i.kind === 'pdf').length : 0; return [n >= 40 ? 'ready' : n ? 'review' : 'missing', t('rx.count', { n })]; }
      case 'surprise5': { const n = root.GA.library ? (await root.GA.library.list()).filter(i => (i.tags || []).includes('surprise') && i.source && i.date).length : 0; return [n >= 5 ? 'ready' : n ? 'review' : 'missing', t('rx.surprise', { n })]; }
      case 'four': return [A.length >= 4 ? 'ready' : A.length ? 'review' : 'missing', t('ex.need4', { n: A.length }).replace(/<[^>]+>/g, '')];
      case 'equal': { const ar = A.map(a => a.measures.area); const ok = A.length && A.every(a => a.spec.type === 'square') && Math.max(...ar) / Math.min(...ar) <= 1.02; return [ok ? 'ready' : A.length ? 'review' : 'missing', '']; }
      case 'five': case 'sections': { const n = A.filter(a => (a.sections || []).length).length; return [A.length && n === A.length ? 'ready' : n ? 'review' : 'missing', t('rx.sections', { n, m: A.length })]; }
      case 'just': { const n = A.filter(a => ((ex12.fabrics[a.id] || {}).just || '').trim()).length; return [A.length && n === A.length ? 'ready' : n ? 'review' : 'missing', `${n}/${A.length}`]; }
      case 'sentence': { const n = A.filter(a => ((ex12.fabrics[a.id] || {}).sentence || '').trim()).length; return [A.length && n === A.length ? 'ready' : n ? 'review' : 'missing', `${n}/${A.length}`]; }
      case 'frame': return [e13.frameKm ? 'ready' : 'missing', e13.frameKm ? e13.frameKm + ' × ' + e13.frameKm + ' km' : ''];
      case 'pages': { const n = ['density', 'morphology', 'centre', 'climate', 'human'].filter(k => e13.maps && e13.maps[k] && (e13.maps[k].finding || '').trim()).length; return [n === 5 ? 'ready' : n ? 'review' : 'missing', `${n}/5`]; }
      case 'identity': { const ok = (e13.students || '').trim(); return [ok ? 'ready' : 'review', ok ? '' : t('rx.names')]; }
      case 'synth': return [(e13.synthesis || '').trim() ? 'ready' : 'missing', ''];
    }
    return [null, ''];
  }
  const badge = (s) => s ? `<span class="state ${s === 'ready' ? 'st-ok' : s === 'review' ? 'st-exp' : 'st-bad'}">${t('ex.s.' + s)}</span>` : `<span class="state st-exp">${t('rx.manual')}</span>`;
  const guessType = (s) => /\b(must|required|shall|need to)\b|חובה|יש ל|נדרש|يجب|مطلوب/i.test(s) ? 'm' : /\b(may|can|optional|suggest|for example|e\.g\.)\b|אפשר|ניתן|לדוגמה|רעיונות|يمكن|مثال/i.test(s) ? 's' : 'a';
  async function docxText(file) { const z = await root.GA.imports.unzip(await file.arrayBuffer()); const k = Object.keys(z).find(n => n === 'word/document.xml'); if (!k) throw new Error('DOCX'); const xml = new TextDecoder().decode(await z[k].bytes()); return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, m => m.replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '') + '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim(); }
  async function render(body) {
    const p = store.get(); let h = `<p class="fine">${t('rx.lead')}</p>`;
    for (const [id, b] of Object.entries(BUILTIN)) {
      const rows = []; for (const [k, ty, a] of b.req) { const [st, note] = a ? await auto(a) : [p.exmanual && p.exmanual[id + k] || null, '']; rows.push(`<tr><td>${t(k)}${note ? `<br><small>${esc(note)}</small>` : ''}</td><td><span class="tag">${t('rx.t.' + ty)}</span></td><td>${a ? badge(st) : `<select data-man="${id}${k}">${['', 'ready', 'review', 'missing'].map(s => `<option value="${s}" ${st === s || (!st && !s) ? 'selected' : ''}>${s ? t('ex.s.' + s) : t('rx.manual')}</option>`).join('')}</select>`}</td></tr>`); }
      h += `<section class="rx"><h3>${esc(t(b.tkey))}</h3>${id === 'ex13' ? `<p><button class="btn btn-small btn-primary" onclick="GA.pages.go('ex13')">${t('e13.open')}</button></p>` : id === 'ex12' ? `<p><button class="btn btn-small" onclick="GA.pages.close();GA.app.openWorkspace&&GA.app.openWorkspace('ex12')">${t('rx.open12')}</button></p>` : `<p><button class="btn btn-small" onclick="GA.pages.go('library')">${t('rx.open11')}</button></p>`}<table class="tbl small">${rows.join('')}</table></section>`;
    }
    reg().forEach((e, ei) => {
      h += `<section class="rx"><h3 dir="auto">${esc(e.title)} <small>${e.adopted ? t('rx.adopted', { v: e.versions.length }) : t('rx.draft')}</small></h3>${e.deadline ? `<p class="fine">${t('rx.deadline')}: <bdi>${esc(e.deadline)}</bdi></p>` : ''}
        <table class="tbl small">${e.req.map((r, ri) => `<tr><td><textarea dir="auto" rows="2" data-rx="${ei}:${ri}" data-f="text">${esc(r.text)}</textarea></td><td><select data-rx="${ei}:${ri}" data-f="type">${['m', 's', 'a'].map(x => `<option value="${x}" ${r.type === x ? 'selected' : ''}>${t('rx.t.' + x)}</option>`).join('')}</select></td><td><select data-rx="${ei}:${ri}" data-f="status">${['missing', 'review', 'ready'].map(x => `<option value="${x}" ${r.status === x ? 'selected' : ''}>${t('ex.s.' + x)}</option>`).join('')}</select><label class="chk"><input type="checkbox" data-rx="${ei}:${ri}" data-f="needsDev" ${r.needsDev ? 'checked' : ''}> ${t('rx.needsDev')}</label></td><td><button class="btn btn-tiny danger" data-rxdel="${ei}:${ri}">✕</button></td></tr>`).join('')}</table>
        <div class="actions"><button class="btn btn-small" data-rxadd="${ei}">${t('rx.addReq')}</button><button class="btn btn-small btn-primary" data-rxadopt="${ei}">${t('rx.adopt')}</button><button class="btn btn-small danger" data-rxrm="${ei}">${t('delete')}</button></div>
        ${e.versions && e.versions.length ? `<details class="method"><summary>${t('rx.versions', { n: e.versions.length })}</summary>${e.versions.map(v => `<p class="fine"><span dir="ltr">${esc(v.at.slice(0, 16).replace('T', ' '))}</span> — ${v.req.length} ${t('rx.reqs')}</p>`).join('')}</details>` : ''}</section>`;
    });
    h += `<section class="rx"><h3>${t('rx.addTitle')}</h3><p class="fine">${t('rx.addLead')}</p><label class="name"><span>${t('rx.exTitle')}</span><input dir="auto" id="rx-title"></label><label class="name"><span>${t('rx.deadline')}</span><input dir="auto" id="rx-dead"></label><label class="name"><span>${t('rx.text')}</span><textarea dir="auto" id="rx-text" rows="6" placeholder="${esc(t('rx.textPh'))}"></textarea></label><div class="actions"><label class="btn btn-small">${t('rx.docx')}<input type="file" id="rx-file" accept=".docx,.pdf" hidden></label><button class="btn btn-primary" id="rx-make">${t('rx.extract')}</button></div><p class="fine">${t('rx.pdfNote')}</p></section>`;
    body.innerHTML = h;
    body.onchange = async (e) => { const el = e.target; const P = store.get();
      if (el.dataset.man) { P.exmanual = P.exmanual || {}; P.exmanual[el.dataset.man] = el.value; store.save(); }
      if (el.dataset.rx) { const [ei, ri] = el.dataset.rx.split(':').map(Number); const r = reg()[ei].req[ri]; r[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; store.save(); }
      if (el.id === 'rx-file' && el.files[0]) { const f = el.files[0]; try { if (/\.docx$/i.test(f.name)) body.querySelector('#rx-text').value = await docxText(f); else root.GA.toast && root.GA.toast(t('rx.pdfNote')); body.querySelector('#rx-title').value = body.querySelector('#rx-title').value || f.name.replace(/\.[^.]+$/, ''); body._file = f; } catch (er) { root.GA.toast && root.GA.toast(er.message, true); } } };
    body.onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; const R = reg();
      if (b.id === 'rx-make') { const title = body.querySelector('#rx-title').value.trim() || t('rx.untitled'); const txt = body.querySelector('#rx-text').value; const lines = txt.split(/\n+|(?<=[.!?])\s+(?=[•·\-–*\d])/).map(s => s.replace(/^[\s•·\-–*\d.)]+/, '').trim()).filter(s => s.length > 12); const ex = { id: 'ex-' + Date.now().toString(36), title, deadline: body.querySelector('#rx-dead').value.trim(), req: lines.slice(0, 60).map(s => ({ text: s, type: guessType(s), status: 'missing' })), versions: [], adopted: false, source: txt.slice(0, 20000) }; R.push(ex); store.save(); if (body._file && root.GA.library) await root.GA.library.addBlob(body._file, { title: title + ' — brief', fileName: body._file.name, source: t('rx.briefSrc'), links: { exercises: [ex.id] }, tags: ['brief'] }); body._file = null; return render(body); }
      if (b.dataset.rxadd) { R[+b.dataset.rxadd].req.push({ text: '', type: 'a', status: 'missing' }); store.save(); return render(body); }
      if (b.dataset.rxdel) { const [ei, ri] = b.dataset.rxdel.split(':').map(Number); R[ei].req.splice(ri, 1); store.save(); return render(body); }
      if (b.dataset.rxadopt) { const ex = R[+b.dataset.rxadopt]; ex.versions = ex.versions || []; ex.versions.push({ at: new Date().toISOString(), req: JSON.parse(JSON.stringify(ex.req)) }); ex.adopted = true; store.save(); return render(body); }
      if (b.dataset.rxrm) { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = t('ar.confirmDel'); return; } R.splice(+b.dataset.rxrm, 1); store.save(); return render(body); } };
  }
  root.GA.exercises = { list, render, auto, BUILTIN };
})(window);
