/* Full pages over the map (fabric pages, General Information, historical explorer, studio,
   exercises). Each page has its own address (#/library, #/fabric/<id> …) so it can be reopened
   and bookmarked; closing a page returns to the map unchanged. Shared helpers for printable
   boards live here: canvas text wrapping, image loading, A3 composition and downloads. */
(function (root) {
  const { i18n: I } = root.GA;
  const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n, d) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d });
  const reg = {}; let current = null; let el = null; const listeners = [];

  function register(name, page) { reg[name] = page; }
  function parse() { const h = (location.hash || '').replace(/^#\/?/, ''); if (!h) return null; const parts = h.split('/').map(decodeURIComponent); return { name: parts[0], params: parts.slice(1) }; }
  function go(name, ...params) { const h = '#/' + [name].concat(params).map(encodeURIComponent).join('/'); if (location.hash === h) route(); else location.hash = h; }
  function close() { if (location.hash) history.pushState('', document.title, location.pathname + location.search); route(); }
  async function route() {
    el = el || document.getElementById('page'); const r = parse();
    if (!r || !reg[r.name]) { if (current) { current = null; el.hidden = true; el.innerHTML = ''; listeners.forEach(f => f(null)); } return; }
    current = r; el.hidden = false; document.getElementById('workspace').hidden = true;
    const P = reg[r.name];
    el.innerHTML = `<div class="pg-h"><div class="pg-h-l"><span class="plate">${esc(P.plate ? P.plate() : '')}</span><h2 id="pg-title"${P.heroTitle ? ' class="sr-only"' : ''}>${esc(P.title ? P.title(...r.params) : r.name)}</h2>${P.nav ? `<nav class="tabs pg-nav">${P.nav(...r.params)}</nav>` : ''}</div><div class="actions">${P.actions ? P.actions(...r.params) : ''}<button class="btn btn-small" id="pg-close">${t('ws.backToMap')}</button></div></div><div class="pg-b" id="pg-body"></div>`;
    el.querySelector('#pg-close').onclick = () => { close(); if (P.afterClose) P.afterClose(...r.params); };
    listeners.forEach(f => f(r));
    try { await P.render(el.querySelector('#pg-body'), ...r.params); } catch (e) { console.error(e); el.querySelector('#pg-body').innerHTML = `<div class="error">${esc(e.message || String(e))}</div>`; }
  }
  window.addEventListener('hashchange', route);
  I.onChange(() => { if (current) route(); });

  // ---------- printable-board helpers ----------
  const font = () => getComputedStyle(document.documentElement).getPropertyValue('--f-ui') || 'sans-serif';
  function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    const words = String(text || '').replace(/<[^>]+>/g, '').replace(/[⁦⁩]/g, '').split(/\s+/); let line = ''; let n = 0;
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); y += lh; n++; line = w; if (maxLines && n >= maxLines) return y; } else line = test; }
    if (line) { ctx.fillText(line, x, y); y += lh; } return y;
  }
  function download(blob, name) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  const slug = (s) => String(s || 'granada').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'granada';
  const toBlob = (cv, type, q) => new Promise(res => cv.toBlob(res, type || 'image/png', q));
  function sheet(Wmm, Hmm, dpi) { const W = Math.round(Wmm / 25.4 * dpi), H = Math.round(Hmm / 25.4 * dpi); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, W, H); return { cv, ctx, W, H }; }
  function header(ctx, W, title, sub, opts) {
    opts = opts || {}; const rtl = I.dir() === 'rtl'; const F = font(); const s = opts.scale || 1; const M = 50 * s;
    ctx.fillStyle = '#992B2A'; ctx.fillRect(0, 0, W, 8 * s); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1C1E21'; ctx.font = `700 ${36 * s}px ${F}`; ctx.fillText(title, rtl ? W - M : M, 62 * s);
    if (sub) { ctx.font = `${18 * s}px ${F}`; ctx.fillStyle = '#3C4046'; ctx.fillText(sub, rtl ? W - M : M, 92 * s); }
    return 110 * s;
  }
  function footer(ctx, W, H, txt, s) { s = s || 1; const rtl = I.dir() === 'rtl'; ctx.font = `${13 * s}px ${font()}`; ctx.fillStyle = '#5E636A'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.fillText(txt, rtl ? W - 50 * s : 50 * s, H - 24 * s); }
  function drawImageFit(ctx, img, x, y, w, h, cover) { const r = cover ? Math.max(w / img.width, h / img.height) : Math.min(w / img.width, h / img.height); const dw = img.width * r, dh = img.height * r; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore(); }
  function northArrow(ctx, x, y, s) { s = s || 1; ctx.fillStyle = '#222428'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7 * s, y + 22 * s); ctx.lineTo(x, y + 17 * s); ctx.lineTo(x - 7 * s, y + 22 * s); ctx.closePath(); ctx.fill(); ctx.font = `700 ${12 * s}px ${font()}`; ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.fillText('N', x, y + 38 * s); }
  function scaleBar(ctx, x, y, mpp, maxPx, s) { s = s || 1; const c = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]; const len = c.reduce((b, v) => v / mpp <= maxPx ? v : b, c[0]); const px = len / mpp; ctx.fillStyle = '#222428'; ctx.fillRect(x, y, px / 2, 5 * s); ctx.strokeStyle = '#222428'; ctx.lineWidth = s; ctx.strokeRect(x, y, px, 5 * s); ctx.font = `${12 * s}px ${font()}`; ctx.textAlign = 'left'; ctx.direction = 'ltr'; ctx.fillText('0', x, y - 4 * s); ctx.textAlign = 'center'; ctx.fillText(len >= 1000 ? len / 1000 + ' km' : len + ' m', x + px, y - 4 * s); return px; }

  root.GA.pages = { register, go, close, route, get current() { return current; }, onChange: (f) => listeners.push(f), esc, nf, wrap, download, slug, toBlob, sheet, header, footer, drawImageFit, font, northArrow, scaleBar };
})(window);
