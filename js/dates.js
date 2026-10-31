/* Reliable parsing and display of free-text dates (Wikimedia Commons metadata, EXIF, user input).
   parse(s) → { y, m, d, precision: 'day'|'month'|'year'|null, iso, raw }. Nothing is guessed: text that cannot be read
   unambiguously gives precision null, and display shows "Date unknown" while the original text stays available. */
(function (root) {
  const MONTHS = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
  };
  const ok = (y, m, d) => y >= 1000 && y <= 2100 && (m == null || (m >= 1 && m <= 12)) && (d == null || (d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate()));
  const pad = (n) => String(n).padStart(2, '0');
  function out(y, m, d, raw) {
    if (!ok(y, m, d)) return { y: null, m: null, d: null, precision: null, iso: null, raw };
    const precision = d != null ? 'day' : m != null ? 'month' : 'year';
    return { y, m: m || null, d: d || null, precision, iso: precision === 'day' ? `${y}-${pad(m)}-${pad(d)}` : precision === 'month' ? `${y}-${pad(m)}` : String(y), raw };
  }
  function parse(input) {
    const raw = input == null ? '' : String(input);
    let s = raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return out(null, null, null, raw);
    s = s.replace(/^(taken|photographed|created|date|uploaded)( on| in)?:?\s*/i, '');
    let m;
    if ((m = s.match(/^(\d{4})[-:/.](\d{1,2})[-:/.](\d{1,2})\b/))) return out(+m[1], +m[2], +m[3], raw);             // ISO / EXIF
    if ((m = s.match(/^(\d{4})[-/](\d{1,2})$/))) return out(+m[1], +m[2], null, raw);                                  // 2019-09
    const word = (w) => MONTHS[w.toLowerCase().replace(/\.$/, '')];
    if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?(?:\s+de)?\s+([A-Za-zÀ-ÿ.]+)(?:\s+de)?,?\s+(\d{4})\b/)) && word(m[2])) return out(+m[3], word(m[2]), +m[1], raw);   // 3 March 2019 / 20 de septiembre de 2019
    if ((m = s.match(/^([A-Za-zÀ-ÿ.]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/)) && word(m[1])) return out(+m[3], word(m[1]), +m[2], raw);                      // September 20, 2019
    if ((m = s.match(/^([A-Za-zÀ-ÿ.]+)(?:\s+de)?\s+(\d{4})$/)) && word(m[1])) return out(+m[2], word(m[1]), null, raw);                                          // March 2019
    if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)) && +m[1] > 12) return out(+m[3], +m[2], +m[1], raw);    // 20/09/2019 (day first only when unambiguous)
    if ((m = s.match(/^(\d{4})$/))) return out(+m[1], null, null, raw);
    return out(null, null, null, raw);                                                                                 // e.g. "circa 1900", "1890s", ranges
  }
  const LOC = { ar: 'ar-u-nu-latn', he: 'he', en: 'en-GB' };
  function label(input) {
    const I = root.GA.i18n; const p = typeof input === 'object' && input && 'precision' in input ? input : parse(input);
    if (!p.precision) return I.t('v5.dateUnknown');
    const loc = LOC[I.lang] || 'en-GB'; const d = new Date(Date.UTC(p.y, (p.m || 1) - 1, p.d || 1));
    const opt = p.precision === 'day' ? { year: 'numeric', month: 'long', day: 'numeric' } : p.precision === 'month' ? { year: 'numeric', month: 'long' } : { year: 'numeric' };
    try { return d.toLocaleDateString(loc, Object.assign({ timeZone: 'UTC' }, opt)); } catch (e) { return p.iso; }
  }
  // HTML: localised date, with the original metadata text kept in a tooltip
  function html(input) {
    const p = parse(input); const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const raw = p.raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `<span class="date${p.precision ? '' : ' unknown'}" title="${esc(raw)}">${esc(label(p))}</span>`;
  }
  root.GA = root.GA || {}; root.GA.dates = { parse, label, html };
  if (typeof module !== 'undefined') module.exports = { parse };
})(typeof window !== 'undefined' ? window : globalThis);
