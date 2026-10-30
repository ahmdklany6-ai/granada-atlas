/* Studio: deliverables schedule and checklist (from the studio e-mail and the 1.3 brief),
   five Miro squares per student grouped by class date, a focused climate-mapping board,
   an extensible exercise registry, and studio resources. There is no Miro integration:
   files are exported here and uploaded by hand; "Exported" never becomes "Uploaded" by itself. */
(function (root) {
  const { i18n: I, pages: PG, store, ext: X, data: D, geo: G, proj: PJ, mapcard: MC, palette: P } = root.GA;
  const t = (k, v) => I.t(k, v); const esc = PG.esc; const nf = PG.nf;
  const TABS = ['schedule', 'boards', 'climate', 'exercises', 'resources'];

  // ---------- project state ----------
  function S() {
    const p = store.get(); if (!p.studio) p.studio = {};
    const s = p.studio; s.year = s.year || 2026; s.students = s.students || [{ id: 'st1', name: '' }];
    if (!s.schedule) s.schedule = [
      { id: 'lec', md: '11-01', time: '14:00', where: 'Zoom', key: 'sch.lec', req: true, src: 'email', done: false },
      { id: 'clim', md: '11-01', time: t('sch.beforeLec'), key: 'sch.clim', req: true, src: 'email', done: false, link: 'studio/climate' },
      { id: 'org', md: '11-03', time: t('sch.tueNight'), key: 'sch.org', req: true, src: 'email+brief', done: false, link: 'studio/boards' },
      { id: 'squares', md: '11-03', time: t('sch.tueNight'), key: 'sch.squares', req: true, src: 'email', done: false, link: 'studio/boards' },
      { id: 'ex13', md: '11-03', time: t('sch.tueNight'), key: 'sch.ex13', req: true, src: 'brief', done: false, link: 'ex13' },
      { id: 'visit', md: '11-04', time: '', where: '', key: 'sch.visit', req: true, src: 'email+brief', done: false },
    ];
    s.suggested = s.suggested || [{ id: 'bk', key: 'sug.backup', done: false }, { id: 'src', key: 'sug.sources', done: false }, { id: 'pdf', key: 'sug.pdf', done: false }];
    s.dates = s.dates || ['11-01', '11-04'];
    s.slotSize = s.slotSize || { px: 3000 };
    s.slots = s.slots || {}; s.students.forEach(st => { s.slots[st.id] = s.slots[st.id] || Array.from({ length: 5 }, (_, i) => ({ title: '', date: s.dates[0], assign: '', status: 'draft', miro: '', note: '' })); });
    s.climate = s.climate || { topic: 'heatveg', extent: 'city', title: '', question: '', finding: '', implication: '' };
    return s;
  }
  const dateOf = (md) => { const s = S(); const d = new Date(`${s.year}-${md}T12:00:00`); return isNaN(d) ? md : d.toLocaleDateString(I.LANGS[I.lang].locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };

  // ---------- schedule & checklist ----------
  function checks() {
    const p = store.get(); const s = S(); const out = [];
    const slots = Object.values(s.slots).flat(); const complete = slots.filter(x => x.title && x.assign && x.status !== 'draft').length;
    out.push({ k: 'chk.climate', st: s.climate.status === 'uploaded' ? 'ready' : s.climate.status === 'exported' ? 'review' : 'missing', note: t('chk.climateNote', { s: t('slot.st.' + (s.climate.status || 'draft')) }), link: 'studio/climate' });
    out.push({ k: 'chk.squares', st: complete === slots.length && slots.length ? 'ready' : complete ? 'review' : 'missing', note: t('chk.squaresNote', { a: complete, b: slots.length }), link: 'studio/boards' });
    out.push({ k: 'chk.uploaded', st: slots.length && slots.every(x => x.status === 'uploaded') ? 'ready' : slots.some(x => x.status === 'uploaded') ? 'review' : 'missing', note: t('chk.uploadedNote', { a: slots.filter(x => x.status === 'uploaded').length, b: slots.length }), link: 'studio/boards' });
    const n12 = ((p.ex12 || {}).ids || []).length; out.push({ k: 'chk.ex12', st: n12 >= 4 ? 'ready' : n12 ? 'review' : 'missing', note: t('ex.need4', { n: n12 }).replace(/<[^>]+>/g, ''), link: null, compare: true });
    const e13 = p.ex13 || {}; const done13 = ['density', 'morphology', 'centre', 'climate', 'human'].filter(k => e13.maps && e13.maps[k] && (e13.maps[k].finding || '').trim()).length; out.push({ k: 'chk.ex13', st: done13 === 5 && (e13.synthesis || '').trim() ? 'ready' : done13 ? 'review' : 'missing', note: t('chk.ex13Note', { n: done13 }), link: 'ex13' });
    return out;
  }
  const badge = (s) => `<span class="state ${s === 'ready' ? 'st-ok' : s === 'review' ? 'st-exp' : 'st-bad'}">${t('ex.s.' + s)}</span>`;
  function renderSchedule(body) {
    const s = S();
    body.innerHTML = `<div class="st-grid"><section><h3>${t('sch.title')}</h3><p class="fine">${t('sch.lead')}</p>
      <label class="row2">${t('sch.year')} <input type="number" id="st-year" value="${s.year}" min="2025" max="2030" style="width:6em"> <small>${t('sch.yearNote')}</small></label>
      <table class="tbl sched"><thead><tr><th>${t('sch.when')}</th><th>${t('sch.what')}</th><th>${t('sch.src')}</th><th>${t('sch.done')}</th></tr></thead><tbody>${s.schedule.map((it, i) => `<tr class="${it.done ? 'done' : ''}"><td><input dir="ltr" class="inline" data-sch="${i}" data-f="md" value="${esc(it.md)}" style="width:5.5em"><br><small>${esc(dateOf(it.md))}</small><br><input class="inline" dir="auto" data-sch="${i}" data-f="time" value="${esc(it.time || '')}" placeholder="${esc(t('sch.timePh'))}" style="width:9em"></td><td><textarea dir="auto" rows="2" data-sch="${i}" data-f="text">${esc(it.text != null ? it.text : t(it.key))}</textarea>${it.link ? `<button class="link" onclick="GA.pages.go(...'${it.link}'.split('/'))">${t('sch.open')} →</button>` : ''}</td><td><span class="tag">${esc(t('src.' + (it.src || 'user')))}</span></td><td><input type="checkbox" data-sch="${i}" data-f="done" ${it.done ? 'checked' : ''}><button class="btn btn-tiny danger" data-sch-del="${i}">✕</button></td></tr>`).join('')}</tbody></table>
      <div class="actions"><button class="btn btn-small" id="sch-add">${t('sch.add')}</button></div>
      <p class="fine">${t('sch.noInvent')}</p></section>
      <section><h3>${t('chk.title')}</h3><table class="tbl small">${checks().map(c => `<tr><td>${t(c.k)}<br><small>${esc(c.note)}</small></td><td>${badge(c.st)}</td><td>${c.link ? `<button class="link" onclick="GA.pages.go(...'${c.link}'.split('/'))">→</button>` : c.compare ? `<button class="link" onclick="GA.pages.close();GA.app.openWorkspace&&GA.app.openWorkspace('ex12')">→</button>` : ''}</td></tr>`).join('')}</table>
      <h3>${t('sug.title')}</h3><p class="fine">${t('sug.lead')}</p><ul class="plain">${s.suggested.map((x, i) => `<li><label class="chk"><input type="checkbox" data-sug="${i}" ${x.done ? 'checked' : ''}> ${t(x.key)}</label></li>`).join('')}</ul>
      <h3>${t('sch.miroTitle')}</h3><ol class="fine">${['miro.1', 'miro.2', 'miro.3', 'miro.4'].map(k => `<li>${t(k)}</li>`).join('')}</ol></section></div>`;
    body.onchange = (e) => { const el = e.target; if (el.id === 'st-year') { s.year = +el.value || s.year; store.save(); return renderSchedule(body); } if (el.dataset.sch != null) { const it = s.schedule[+el.dataset.sch]; const f = el.dataset.f; it[f] = f === 'done' ? el.checked : el.value; store.save(); if (f === 'md' || f === 'done') renderSchedule(body); } if (el.dataset.sug != null) { s.suggested[+el.dataset.sug].done = el.checked; store.save(); } };
    body.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'sch-add') { s.schedule.push({ id: 'u' + Date.now(), md: s.dates[s.dates.length - 1], time: '', text: '', req: false, src: 'user', done: false }); store.save(); renderSchedule(body); } if (b.dataset.schDel != null) { s.schedule.splice(+b.dataset.schDel, 1); store.save(); renderSchedule(body); } };
  }

  // ---------- Miro squares ----------
  async function sources() { // what a square can show
    const out = [{ v: 'climate', l: t('slot.a.climate') }];
    ['density', 'morphology', 'centre', 'climate', 'human', 'identity'].forEach(k => out.push({ v: 'ex13:' + k, l: t('slot.a.ex13', { k: t('e13.t.' + k) }) }));
    if (root.GA.library) (await root.GA.library.list()).filter(it => it.kind === 'image').forEach(it => out.push({ v: 'lib:' + it.id, l: '▣ ' + it.title }));
    return out;
  }
  async function contentCanvas(assign) {
    if (assign === 'climate') return climateCanvas(1600);
    if (assign.startsWith('ex13:') && root.GA.ex13) return root.GA.ex13.pageCanvas(assign.slice(5));
    if (assign.startsWith('lib:')) { const b = await root.GA.library.getBlob(assign.slice(4)); if (!b) return null; const u = URL.createObjectURL(b); try { const im = await X.loadImage(u); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c; } finally { URL.revokeObjectURL(u); } }
    return null;
  }
  async function squareCanvas(st, slot, i, px) {
    const c = document.createElement('canvas'); c.width = c.height = px; const ctx = c.getContext('2d'); const k = px / 1000; const F = PG.font(); const rtl = I.dir() === 'rtl';
    ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, px, px); ctx.fillStyle = '#992B2A'; ctx.fillRect(0, 0, px, 8 * k);
    ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.fillStyle = '#1C1E21'; ctx.font = `700 ${34 * k}px ${F}`; ctx.fillText(slot.title || t('slot.untitled'), rtl ? px - 40 * k : 40 * k, 60 * k);
    ctx.font = `${16 * k}px ${F}`; ctx.fillStyle = '#5E636A'; ctx.fillText(`${st.name || t('slot.student')} · ${t('slot.n', { n: i + 1 })} · ${dateOf(slot.date)}`, rtl ? px - 40 * k : 40 * k, 88 * k);
    const cc = slot.assign ? await contentCanvas(slot.assign).catch(() => null) : null;
    if (cc) PG.drawImageFit(ctx, cc, 40 * k, 110 * k, px - 80 * k, px - 170 * k, false); else { ctx.strokeStyle = '#C6C7C9'; ctx.setLineDash([8 * k, 6 * k]); ctx.strokeRect(40 * k, 110 * k, px - 80 * k, px - 170 * k); ctx.setLineDash([]); ctx.fillStyle = '#992B2A'; ctx.font = `${22 * k}px ${F}`; ctx.textAlign = 'center'; ctx.fillText(t('slot.noContent'), px / 2, px / 2); }
    ctx.textAlign = rtl ? 'right' : 'left'; ctx.font = `${13 * k}px ${F}`; ctx.fillStyle = '#5E636A'; ctx.fillText(`Granada Atlas · ${new Date().toISOString().slice(0, 10)}${slot.note ? ' · ' + slot.note : ''}`, rtl ? px - 40 * k : 40 * k, px - 24 * k);
    return c;
  }
  const missing = (sl) => [!sl.title && 'slot.m.title', !sl.assign && 'slot.m.content', !sl.miro && 'slot.m.miro', sl.status !== 'uploaded' && 'slot.m.upload'].filter(Boolean);
  async function renderBoards(body) {
    const s = S(); const src = await sources(); const group = s.group || 'student';
    const slotHTML = (st, sl, i) => `<div class="slot ${sl.status}" data-slot="${st.id}:${i}"><div class="slot-prev"><canvas data-prev="${st.id}:${i}"></canvas></div><div class="slot-f"><b>${t('slot.n', { n: i + 1 })}</b>
      <input dir="auto" data-sf="title" value="${esc(sl.title)}" placeholder="${esc(t('slot.titlePh'))}">
      <select data-sf="assign"><option value="">${t('slot.choose')}</option>${src.map(o => `<option value="${esc(o.v)}" ${sl.assign === o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>
      <select data-sf="date">${s.dates.map(d => `<option value="${d}" ${sl.date === d ? 'selected' : ''}>${esc(dateOf(d))}</option>`).join('')}</select>
      <select data-sf="status">${['draft', 'ready', 'exported', 'uploaded'].map(k => `<option value="${k}" ${sl.status === k ? 'selected' : ''}>${t('slot.st.' + k)}</option>`).join('')}</select>
      <input dir="ltr" data-sf="miro" value="${esc(sl.miro)}" placeholder="${esc(t('slot.miroPh'))}">
      <div class="slot-miss">${missing(sl).map(m => `<span class="tag warn-tag">${t(m)}</span>`).join('')}</div>
      <div class="actions"><button class="btn btn-tiny" data-sx="png">PNG</button><button class="btn btn-tiny" data-sx="pdf">PDF</button>${sl.miro ? `<a class="btn btn-tiny" href="${esc(sl.miro)}" target="_blank" rel="noopener">Miro ↗</a>` : ''}${sl.status === 'exported' ? `<button class="btn btn-tiny" data-sx="confirm">${t('slot.confirm')}</button>` : ''}</div></div></div>`;
    let h = `<p class="fine">${t('slot.lead')}</p><div class="actions"><label class="row2">${t('slot.size')} <input type="number" id="sl-px" min="1000" max="6000" step="100" value="${s.slotSize.px}" style="width:6em"> px</label><button class="btn btn-small" id="sl-addst">${t('slot.addStudent')}</button><label class="row2">${t('slot.dates')} <input dir="ltr" id="sl-dates" value="${esc(s.dates.join(', '))}" style="width:12em"></label><div class="seg"><button class="${group === 'student' ? 'on' : ''}" data-grp="student">${t('slot.byStudent')}</button><button class="${group === 'date' ? 'on' : ''}" data-grp="date">${t('slot.byDate')}</button></div></div>`;
    const inc = Object.values(s.slots).flat().filter(x => missing(x).length).length; h += inc ? `<div class="warn">${t('slot.incomplete', { n: inc })}</div>` : `<div class="ok">${t('slot.allDone')}</div>`;
    if (group === 'student') h += s.students.map(st => `<section class="st-student"><div class="row2"><input dir="auto" data-stname="${st.id}" value="${esc(st.name)}" placeholder="${esc(t('slot.studentPh'))}"><button class="btn btn-tiny danger" data-stdel="${st.id}">${t('delete')}</button></div><div class="slots">${s.slots[st.id].map((sl, i) => slotHTML(st, sl, i)).join('')}</div></section>`).join('');
    else h += s.dates.map(d => `<section class="st-student"><h3>${esc(dateOf(d))}</h3><div class="slots">${s.students.flatMap(st => s.slots[st.id].map((sl, i) => sl.date === d ? slotHTML(st, sl, i) : '')).join('') || `<p class="note">${t('slot.noneDate')}</p>`}</div></section>`).join('');
    h += `<details class="method"><summary>${t('sch.miroTitle')}</summary><ol class="fine">${['miro.1', 'miro.2', 'miro.3', 'miro.4'].map(k => `<li>${t(k)}</li>`).join('')}</ol></details>`;
    body.innerHTML = h;
    // previews
    for (const cv of body.querySelectorAll('canvas[data-prev]')) { const [sid, i] = cv.dataset.prev.split(':'); const st = s.students.find(x => x.id === sid); const sl = s.slots[sid][+i]; try { const c = await squareCanvas(st, sl, +i, 600); cv.width = 180; cv.height = 180; cv.getContext('2d').drawImage(c, 0, 0, 180, 180); } catch (e) { } }
    const slotOf = (el) => { const w = el.closest('[data-slot]'); if (!w) return null; const [sid, i] = w.dataset.slot.split(':'); return { st: s.students.find(x => x.id === sid), sl: s.slots[sid][+i], i: +i }; };
    body.onchange = (e) => { const el = e.target; if (el.id === 'sl-px') { s.slotSize.px = Math.max(1000, Math.min(6000, +el.value || 3000)); store.save(); return; } if (el.id === 'sl-dates') { s.dates = el.value.split(',').map(x => x.trim()).filter(x => /^\d{2}-\d{2}$/.test(x)); if (!s.dates.length) s.dates = ['11-01']; store.save(); return renderBoards(body); } if (el.dataset.stname) { s.students.find(x => x.id === el.dataset.stname).name = el.value; store.save(); return; } const o = slotOf(el); if (o && el.dataset.sf) { if (el.dataset.sf === 'status' && el.value === 'uploaded' && o.sl.status !== 'uploaded' && !confirm(t('slot.confirmQ'))) { el.value = o.sl.status; return; } o.sl[el.dataset.sf] = el.value; store.save(); renderBoards(body); } };
    body.onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.grp) { s.group = b.dataset.grp; store.save(); return renderBoards(body); } if (b.id === 'sl-addst') { const id = 'st' + Date.now().toString(36); s.students.push({ id, name: '' }); S(); store.save(); return renderBoards(body); } if (b.dataset.stdel) { if (s.students.length < 2) return; s.students = s.students.filter(x => x.id !== b.dataset.stdel); delete s.slots[b.dataset.stdel]; store.save(); return renderBoards(body); }
      const o = slotOf(b); if (!o) return;
      if (b.dataset.sx === 'confirm') { if (confirm(t('slot.confirmQ'))) { o.sl.status = 'uploaded'; store.save(); renderBoards(body); } return; }
      b.disabled = true; try { const c = await squareCanvas(o.st, o.sl, o.i, s.slotSize.px); const name = `miro_${PG.slug(o.st.name || 'student')}_${o.i + 1}_${PG.slug(o.sl.title || 'square')}`; if (b.dataset.sx === 'png') PG.download(await PG.toBlob(c), name + '.png'); else { const mm = 250; const bytes = root.GA.pdf.build([{ canvas: c, paper: [mm / 25.4 * 72, mm / 25.4 * 72] }], { title: o.sl.title || 'Granada Atlas' }); PG.download(new Blob([bytes], { type: 'application/pdf' }), name + '.pdf'); } if (o.sl.status !== 'uploaded') o.sl.status = 'exported'; store.save(); renderBoards(body); } finally { b.disabled = false; } };
  }

  // ---------- climate-mapping board ----------
  const TOPICS = ['heatveg', 'shade', 'flood', 'lst'];
  function frameOf(c) { const s = S().climate; let ring; if (c && c.extent && c.extent !== 'city') { const a = store.get().areas.find(x => x.id === c.extent); ring = a ? root.GA.compare.ringOf(a.spec) : null; } const U = ring ? ring.map(p => PJ.EPSG25830.forward(p)) : null; let cx, cy, half; if (U) { cx = (Math.min(...U.map(p => p[0])) + Math.max(...U.map(p => p[0]))) / 2; cy = (Math.min(...U.map(p => p[1])) + Math.max(...U.map(p => p[1]))) / 2; half = Math.max(400, Math.max(Math.max(...U.map(p => p[0])) - Math.min(...U.map(p => p[0])), Math.max(...U.map(p => p[1])) - Math.min(...U.map(p => p[1]))) * 0.75); } else { const u = PJ.EPSG25830.forward([-3.6045, 37.1745]); cx = u[0]; cy = u[1]; half = 4000; } return { x0: cx - half, y0: cy - half, x1: cx + half, y1: cy + half, ring, half }; }
  const clim = { cache: {} };
  async function climData(c) { // map rasters + supporting statistics for the chosen topic and frame
    const f = frameOf(c); const key = c.topic + '|' + c.extent; if (clim.cache[key]) return clim.cache[key];
    const out = { f, errors: [] }; const W = 1100; const mpp = (f.x1 - f.x0) / W;
    const ringFrame = [[f.x0, f.y0], [f.x1, f.y0], [f.x1, f.y1], [f.x0, f.y1], [f.x0, f.y0]].map(p => PJ.EPSG25830.inverse(p));
    const [adm, maj] = await Promise.all([D.single('admin').catch(() => null), D.single('streets_major').catch(() => null)]); out.adm = adm; out.maj = maj;
    try { const fg = D.manifest.overview.figureGround; out.fg = { img: await X.loadImage('data/' + fg.file), x0: fg.ox, y1: fg.oy, x1: fg.ox + fg.width * fg.px_m, y0: fg.oy - fg.height * fg.px_m }; } catch (e) { }
    if (c.topic === 'heatveg' || c.topic === 'shade' || c.topic === 'lst') { try { out.tcd = await X.tcdGrid(ringFrame, 0); } catch (e) { out.errors.push('Copernicus TCD: ' + e.message); } }
    if (c.topic === 'lst' || c.topic === 'heatveg') { try { out.lst = await X.warp3857(X.SVC.gibs, 'MODIS_Aqua_L3_Land_Surface_Temp_8Day_Day', { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, w: 550, h: 550 }, '&TIME=' + X.LST_DATE); } catch (e) { out.errors.push('NASA GIBS LST: ' + e.message); } }
    if (c.topic === 'flood') { try { out.flood = await X.loadImage(X.wmsURL(X.SVC.miteco, 'agua:Zi_laminas_q500,agua:Zi_laminas_q100,agua:Zi_laminas_q10,agua:Zi_arpsi', [f.x0, f.y0, f.x1, f.y1], W, W, 25830), 40000); } catch (e) { out.errors.push('SNCZI: ' + e.message); } }
    // supporting chart: by neighbourhood (barrio) inside the frame
    const bars = []; const barrios = adm ? adm.features.filter(x => x.properties.kind === 'barrio') : [];
    if (out.tcd) barrios.forEach(b => { const ring = b.geometry.type === 'Polygon' ? b.geometry.coordinates[0] : b.geometry.coordinates[0][0]; const st = X.tcdStats(out.tcd, ring); if (st && st.n > 50) bars.push({ label: b.properties.name, v: st.mean }); });
    if (c.topic === 'flood' && barrios.length) { for (const b of barrios) { const ring = b.geometry.type === 'Polygon' ? b.geometry.coordinates[0] : b.geometry.coordinates[0][0]; const u = ring.map(p => PJ.EPSG25830.forward(p)); if (Math.max(...u.map(p => p[0])) < f.x0 || Math.min(...u.map(p => p[0])) > f.x1 || Math.max(...u.map(p => p[1])) < f.y0 || Math.min(...u.map(p => p[1])) > f.y1) continue; try { const fe = await X.floodExposure(ring); bars.push({ label: b.properties.name, v: fe.zones.q100.share * 100 }); } catch (e) { } } }
    out.bars = bars.sort((a, b) => b.v - a.v); out.mpp = mpp; clim.cache[key] = out; return out;
  }
  function climLegend(c) {
    if (c.topic === 'flood') return X.FLOOD.map(q => ({ sw: q.color, label: `T = ${q.T} (${q.p} ${t('ly3.perYear')})` })).concat([{ line: '#0B2E4F', w: 2, label: t('ly3.arpsi') }]);
    const tcd = X.TCD_CLASSES.slice(1).map(k => ({ sw: `rgb(${k.col.slice(0, 3).join(',')})`, label: `${k.k.replace('-', '–')} % ${t('g3.tcd')}` }));
    return c.topic === 'lst' || c.topic === 'heatveg' ? [{ sw: 'rgba(230,120,40,.5)', label: t('clim.lstLg', { d: X.LST_DATE }) }].concat(tcd) : tcd;
  }
  async function climateCanvas(Wpx) {
    const c = S().climate; const d = await climData(c); const f = d.f; const W = Wpx || 2000, H = Math.round(W * 1.0); const k = W / 2000; const F = PG.font(); const rtl = I.dir() === 'rtl';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#992B2A'; ctx.fillRect(0, 0, W, 10 * k);
    const M = 60 * k; ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'; const TX = rtl ? W - M : M;
    ctx.fillStyle = '#1C1E21'; ctx.font = `700 ${46 * k}px ${F}`; ctx.fillText(c.title || t('clim.t.' + c.topic), TX, 76 * k);
    ctx.font = `italic ${24 * k}px ${F}`; ctx.fillStyle = '#992B2A'; PG.wrap(ctx, c.question || t('clim.qPh'), TX, 116 * k, W - 2 * M, 30 * k, 2);
    // map
    const ms = 1240 * k; const mx = rtl ? W - M - ms : M, my = 180 * k; const mpp = (f.x1 - f.x0) / ms; const Xp = (x) => mx + (x - f.x0) / mpp, Yp = (y) => my + (f.y1 - y) / mpp;
    ctx.save(); ctx.beginPath(); ctx.rect(mx, my, ms, ms); ctx.clip(); ctx.fillStyle = '#F7F7F5'; ctx.fillRect(mx, my, ms, ms);
    if (d.lst && (c.topic === 'lst' || c.topic === 'heatveg')) { ctx.globalAlpha = c.topic === 'lst' ? 0.75 : 0.45; ctx.imageSmoothingEnabled = false; ctx.drawImage(d.lst, mx, my, ms, ms); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; }
    if (d.tcd && c.topic !== 'flood') { const g = d.tcd; const step = Math.max(1, Math.round(10 / mpp)); const img = ctx.createImageData(Math.ceil(ms / step), Math.ceil(ms / step)); for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) { const x = f.x0 + (i + 0.5) * step * mpp, y = f.y1 - (j + 0.5) * step * mpp; const v = D.sampleGrid(g, x, y, true); const col = X.tcdColour(v); if (!col) continue; const o = (j * img.width + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = c.topic === 'lst' ? 120 : 235; } const tmp = document.createElement('canvas'); tmp.width = img.width; tmp.height = img.height; tmp.getContext('2d').putImageData(img, 0, 0); ctx.drawImage(tmp, mx, my, ms, ms); }
    if (d.fg) { ctx.globalAlpha = 0.55; ctx.drawImage(d.fg.img, Xp(d.fg.x0), Yp(d.fg.y1), (d.fg.x1 - d.fg.x0) / mpp, (d.fg.y1 - d.fg.y0) / mpp); ctx.globalAlpha = 1; }
    if (d.flood) { ctx.globalAlpha = 0.85; ctx.drawImage(d.flood, mx, my, ms, ms); ctx.globalAlpha = 1; }
    if (d.maj) { ctx.strokeStyle = 'rgba(60,64,70,.45)'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); d.maj.features.filter(x => /motorway|trunk|primary/.test(x.properties.hw)).forEach(x => { const ls = x.geometry.type === 'LineString' ? [x.geometry.coordinates] : x.geometry.coordinates; ls.forEach(l => l.forEach((p, i) => { const u = PJ.EPSG25830.forward(p); i ? ctx.lineTo(Xp(u[0]), Yp(u[1])) : ctx.moveTo(Xp(u[0]), Yp(u[1])); })); }); ctx.stroke(); }
    if (d.adm) { const muni = d.adm.features.find(x => x.properties.kind === 'municipio'); const hc = d.adm.features.find(x => x.properties.kind === 'historic_core'); [[muni, '#5E636A', [10, 6]], [hc, '#992B2A', [6, 4]]].forEach(([g, col, dash]) => { if (!g) return; ctx.strokeStyle = col; ctx.lineWidth = 2 * k; ctx.setLineDash(dash.map(v => v * k)); ctx.beginPath(); (g.geometry.type === 'Polygon' ? [g.geometry.coordinates] : g.geometry.coordinates).forEach(pl => pl.forEach(r => r.forEach((p, i) => { const u = PJ.EPSG25830.forward(p); i ? ctx.lineTo(Xp(u[0]), Yp(u[1])) : ctx.moveTo(Xp(u[0]), Yp(u[1])); }))); ctx.stroke(); ctx.setLineDash([]); }); }
    if (f.ring) { ctx.strokeStyle = '#992B2A'; ctx.lineWidth = 3 * k; ctx.beginPath(); f.ring.forEach((p, i) => { const u = PJ.EPSG25830.forward(p); i ? ctx.lineTo(Xp(u[0]), Yp(u[1])) : ctx.moveTo(Xp(u[0]), Yp(u[1])); }); ctx.stroke(); }
    ctx.restore(); ctx.strokeStyle = '#C6C7C9'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, ms, ms);
    PG.northArrow(ctx, mx + ms - 30 * k, my + 20 * k, 1.4 * k); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(mx + 14 * k, my + ms - 60 * k, 330 * k, 46 * k); ctx.fillStyle = '#222428'; PG.scaleBar(ctx, mx + 24 * k, my + ms - 30 * k, mpp, 260 * k, 1.2 * k);
    // side column: legend, chart, finding, implication, methods, sources
    const sx = rtl ? M : mx + ms + 50 * k, sw = W - 2 * M - ms - 50 * k; const al = rtl ? 'right' : 'left'; const tx = rtl ? sx + sw : sx; let y = my + 10 * k;
    ctx.textAlign = al; ctx.fillStyle = '#1C1E21'; ctx.font = `700 ${22 * k}px ${F}`; ctx.fillText(t('lg.title'), tx, y); y += 20 * k;
    y = root.GA.compare.legendCanvas(ctx, climLegend(c).concat([{ line: '#5E636A', w: 2, dash: true, label: t('clim.muni') }, { line: '#992B2A', w: 2, dash: true, label: t('ly.historicCore') }, { sw: 'rgba(28,30,33,.55)', label: t('g.building') }]), sx, y + 14 * k, sw, rtl, F) + 20 * k;
    if (d.bars.length) { ctx.font = `700 ${20 * k}px ${F}`; ctx.fillStyle = '#1C1E21'; ctx.textAlign = al; ctx.fillText(t(c.topic === 'flood' ? 'clim.chartFlood' : 'clim.chartCanopy'), tx, y + 10 * k); y += 26 * k; const items = d.bars.slice(0, 6).concat(d.bars.length > 9 ? d.bars.slice(-3) : []); const mxv = Math.max(...items.map(b => b.v), 1); ctx.font = `${14 * k}px ${F}`; items.forEach(b => { const bw = (sw - 220 * k) * b.v / mxv; ctx.fillStyle = c.topic === 'flood' ? '#3C7DB8' : '#4C8C46'; if (rtl) ctx.fillRect(sx + sw - 200 * k - bw, y, bw, 14 * k); else ctx.fillRect(sx + 200 * k, y, bw, 14 * k); ctx.fillStyle = '#1C1E21'; ctx.textAlign = al; ctx.fillText(String(b.label).slice(0, 24), tx, y + 12 * k); ctx.textAlign = rtl ? 'left' : 'right'; ctx.fillText(nf(b.v, 1) + '%', rtl ? sx : sx + sw, y + 12 * k); y += 22 * k; }); ctx.textAlign = al; ctx.font = `${12 * k}px ${F}`; ctx.fillStyle = '#5E636A'; y = PG.wrap(ctx, t(c.topic === 'flood' ? 'clim.chartFloodNote' : 'clim.chartCanopyNote'), tx, y + 6 * k, sw, 16 * k, 3); }
    y += 14 * k; ctx.fillStyle = '#1C1E21'; ctx.font = `700 ${20 * k}px ${F}`; ctx.fillText(t('clim.finding'), tx, y); ctx.font = `${17 * k}px ${F}`; y = PG.wrap(ctx, c.finding || '—', tx, y + 26 * k, sw, 23 * k, 6);
    y += 8 * k; ctx.font = `700 ${20 * k}px ${F}`; ctx.fillStyle = '#992B2A'; ctx.fillText(t('clim.implication'), tx, y); ctx.font = `${17 * k}px ${F}`; ctx.fillStyle = '#1C1E21'; y = PG.wrap(ctx, c.implication || '—', tx, y + 26 * k, sw, 23 * k, 5);
    // methods + sources under the map
    ctx.font = `${14 * k}px ${F}`; ctx.fillStyle = '#3C4046'; ctx.textAlign = rtl ? 'right' : 'left'; let yb = my + ms + 34 * k;
    yb = PG.wrap(ctx, t('clim.m.' + c.topic, { d: X.LST_DATE }), TX, yb, W - 2 * M, 19 * k, 4); yb = PG.wrap(ctx, t('clim.src.' + c.topic, { d: X.LST_DATE }), TX, yb + 6 * k, W - 2 * M, 19 * k, 4);
    ctx.fillStyle = '#8A5A10'; PG.wrap(ctx, t('clim.noCause'), TX, yb + 6 * k, W - 2 * M, 19 * k, 2);
    return cv;
  }
  async function renderClimate(body) {
    const c = S().climate; const A = store.get().areas;
    body.innerHTML = `<div class="cl-grid"><aside class="cl-form"><p class="fine">${t('clim.lead')}</p>
      <label class="name"><span>${t('clim.topic')}</span><select id="cl-topic">${TOPICS.map(k => `<option value="${k}" ${c.topic === k ? 'selected' : ''}>${t('clim.t.' + k)}</option>`).join('')}</select></label>
      <label class="name"><span>${t('clim.extent')}</span><select id="cl-extent"><option value="city">${t('clim.city')}</option>${A.map(a => `<option value="${a.id}" ${c.extent === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <label class="name"><span>${t('clim.title')}</span><input dir="auto" data-cl="title" value="${esc(c.title)}" placeholder="${esc(t('clim.t.' + c.topic))}"></label>
      <label class="name"><span>${t('clim.question')}</span><textarea dir="auto" rows="2" data-cl="question" placeholder="${esc(t('clim.qPh'))}">${esc(c.question)}</textarea></label>
      <label class="name"><span>${t('clim.finding')}</span><textarea dir="auto" rows="3" data-cl="finding" placeholder="${esc(t('clim.fPh'))}">${esc(c.finding)}</textarea></label>
      <div id="cl-sugg" class="fine"></div>
      <label class="name"><span>${t('clim.implication')}</span><textarea dir="auto" rows="2" data-cl="implication" placeholder="${esc(t('clim.iPh'))}">${esc(c.implication)}</textarea></label>
      <div class="actions"><button class="btn btn-primary" id="cl-png">PNG</button><button class="btn" id="cl-pdf">PDF</button><button class="btn" id="cl-lib">${t('lib.addTo')}</button></div>
      <label class="row2">${t('slot.status')} <select id="cl-status">${['draft', 'ready', 'exported', 'uploaded'].map(k => `<option value="${k}" ${(c.status || 'draft') === k ? 'selected' : ''}>${t('slot.st.' + k)}</option>`).join('')}</select></label>
      <p class="fine">${t('clim.miroNote')}</p></aside><div class="cl-prev"><div class="loading"><span class="spin"></span>${t('clim.loading')}</div></div></div>`;
    const prev = body.querySelector('.cl-prev');
    const draw = async () => { try { const d = await climData(c); const cv = await climateCanvas(1400); cv.style.width = '100%'; cv.style.maxWidth = '900px'; prev.innerHTML = ''; prev.appendChild(cv); if (d.errors.length) prev.insertAdjacentHTML('beforeend', `<div class="warn">${d.errors.map(esc).join('<br>')}</div>`); const sg = body.querySelector('#cl-sugg'); if (d.bars.length >= 2) { const hi = d.bars[0], lo = d.bars[d.bars.length - 1]; sg.innerHTML = `${t('clim.sugg')} ${esc(t(c.topic === 'flood' ? 'clim.suggFlood' : 'clim.suggCanopy', { a: hi.label, va: nf(hi.v, 1), b: lo.label, vb: nf(lo.v, 1) }))}`; } } catch (e) { prev.innerHTML = `<div class="error">${esc(e.message)}</div>`; } };
    draw();
    body.onchange = (e) => { const el = e.target; if (el.id === 'cl-topic') { c.topic = el.value; store.save(); return renderClimate(body); } if (el.id === 'cl-extent') { c.extent = el.value; store.save(); return renderClimate(body); } if (el.id === 'cl-status') { if (el.value === 'uploaded' && !confirm(t('slot.confirmQ'))) { el.value = c.status || 'draft'; return; } c.status = el.value; store.save(); return; } if (el.dataset.cl) { c[el.dataset.cl] = el.value; store.save(); draw(); } };
    body.onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'cl-png' || b.id === 'cl-pdf' || b.id === 'cl-lib') { b.disabled = true; try { const cv = await climateCanvas(3000); const name = 'climate_mapping_' + c.topic; if (b.id === 'cl-png') PG.download(await PG.toBlob(cv), name + '.png'); else if (b.id === 'cl-pdf') { const bytes = root.GA.pdf.build([{ canvas: cv, paper: [841.89, 841.89] }], { title: c.title || 'Climate mapping' }); PG.download(new Blob([bytes], { type: 'application/pdf' }), name + '.pdf'); } else { await root.GA.library.addBlob(await PG.toBlob(cv), { title: c.title || t('clim.t.' + c.topic), kind: 'image', source: t('clim.libSrc'), date: new Date().toISOString().slice(0, 10), tags: ['climate', 'board'], links: { themes: ['climate'] } }); root.GA.toast && root.GA.toast(t('lib.added')); } if (b.id !== 'cl-lib' && c.status !== 'uploaded') { c.status = 'exported'; store.save(); body.querySelector('#cl-status').value = 'exported'; } } finally { b.disabled = false; } } };
  }

  // ---------- resources ----------
  function renderResources(body) {
    const R = [
      { k: 'drive', url: 'https://drive.google.com/drive/folders/1ACVoGAs9pPTh0n4nEqycCRSFjKrPeSVV?usp=sharing' },
      { k: 'scan', url: 'https://urban-scan-studio.web.app/' },
      { k: 'memory', url: 'https://www.collectivememory.ai/' },
      { k: 'crawler', url: 'https://peremenstudio.github.io/city-crawler-student/' },
      { k: 'repo', url: 'https://github.com/peremenstudio/city-crawler-student' },
      { k: 'nolli', url: 'https://web.stanford.edu/group/spatialhistory/nolli/index.html' },
    ];
    body.innerHTML = `<div class="res-grid">${R.map(r => `<article class="res"><h3>${t('res.' + r.k)}</h3><p>${t('res.' + r.k + '.d')}</p><a href="${esc(r.url)}" target="_blank" rel="noopener" dir="ltr">${esc(r.url.replace(/^https:\/\//, '').slice(0, 60))} ↗</a></article>`).join('')}</div>
      <h3>${t('res.driveFiles')}</h3><table class="tbl small"><thead><tr><th>${t('ref.file')}</th><th>${t('res.read')}</th></tr></thead><tbody>${['dfile.stages', 'dfile.email', 'dfile.ex13', 'dfile.carto'].map(k => `<tr><td>${t(k)}</td><td><small>${t(k + '.r')}</small></td></tr>`).join('')}</tbody></table>
      <h3>${t('res.stages')}</h3><p class="fine">${t('res.stagesLead')}</p><ol>${['st.survey', 'st.data', 'st.analysis', 'st.question', 'st.design'].map(k => `<li>${t(k)}</li>`).join('')}</ol>
      <details class="method"><summary>${t('lib.refsTitle')}</summary>${root.GA.ext.DOCS.map(d => `<p><b dir="ltr">${esc(d.file)}</b> — <span dir="ltr">${esc(d.publisher)}</span> · ${t('ref.dataYear')}: <span dir="ltr">${esc(d.dataYear)}</span> · ${t('ref.reportYear')}: <span dir="ltr">${esc(d.reportYear)}</span> <button class="btn btn-tiny" onclick="GA.library.openRef('${d.id}')">${t('ref.view')}</button></p>`).join('')}</details>`;
  }

  async function render(body, tab) {
    tab = TABS.includes(tab) ? tab : 'schedule';
    if (tab === 'schedule') return renderSchedule(body);
    if (tab === 'boards') return renderBoards(body);
    if (tab === 'climate') return renderClimate(body);
    if (tab === 'exercises') return root.GA.exercises.render(body);
    return renderResources(body);
  }
  PG.register('studio', { plate: () => t('studio.plate'), title: () => t('studio.title'), nav: (tab) => TABS.map(k => `<button class="${(tab || 'schedule') === k ? 'on' : ''}" onclick="GA.pages.go('studio','${k}')">${t('studio.tab.' + k)}</button>`).join(''), render });
  root.GA.studio = { S, climateCanvas, squareCanvas, checks, TOPICS };
})(window);
