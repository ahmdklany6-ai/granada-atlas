/* v24 strings (build 5.26): map legend that follows the atlas topic, phone title, … [ar, he, en] */
(function (root) {
  root.GA.i18n.add({
    'v24.also': ['أيضًا على الخريطة ({n} طبقات)', 'גם על המפה ({n} שכבות)', 'Also on the map ({n} layers)'],
  });
  // 5.26: numbers, units and coordinates stay left-to-right inside Arabic / Hebrew text. ltrNums(html) wraps each
  // number run (with its sign, range, ×, unit or %) in <span dir="ltr"> (an isolate), only in text — never inside tags —
  // and only when the page is right-to-left. "(11 %)" then reads (11 %) and not (% 11).
  const UNIT = '(?:%|‰|°C|°|km²|km/h|km|m²|m|ha|cm|mm|kWh|MW|dpi|px|ppm)';
  const NUM = '\\d[\\d.,:/\\-\\u00A0\\u202F]*\\d|\\d';
  const RX = new RegExp('(?<![&#\\w.,])(?:[<>≤≥~±−+]\\s?)?(?:' + NUM + ')(?:\\s?[–-]\\s?(?:' + NUM + '))?(?:\\s?×\\s?(?:' + NUM + '))?(?:\\s?' + UNIT + '(?![A-Za-z]))?', 'g');
  root.GA.ltrNums = function (html) {
    const l = root.GA.i18n && root.GA.i18n.lang; if (l !== 'ar' && l !== 'he') return html; if (html == null) return html;
    return String(html).split(/(<[^>]*>)/).map(seg => seg.charAt(0) === '<' ? seg : seg.replace(RX, (m) => /^\d{1,2}$/.test(m) ? m : '<span dir="ltr">' + m + '</span>')).join('');
  };
  // the same on a rendered subtree, text nodes only (element nodes and their listeners stay untouched)
  root.GA.ltrNumsDOM = function (el) {
    const l = root.GA.i18n && root.GA.i18n.lang; if ((l !== 'ar' && l !== 'he') || !el) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (!n.parentElement || n.parentElement.closest('[dir="ltr"], script, style, textarea, input, option, canvas, svg')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => { const tx = n.textContent; RX.lastIndex = 0; if (!RX.test(tx)) return; RX.lastIndex = 0; const f = document.createDocumentFragment(); let last = 0, m;
      while ((m = RX.exec(tx))) { if (!m[0]) { RX.lastIndex++; continue; } if (/^\d{1,2}$/.test(m[0])) continue; f.appendChild(document.createTextNode(tx.slice(last, m.index))); const sp = document.createElement('span'); sp.dir = 'ltr'; sp.textContent = m[0]; f.appendChild(sp); last = m.index + m[0].length; }
      if (!last) return; f.appendChild(document.createTextNode(tx.slice(last))); n.parentNode.replaceChild(f, n); });
  };
})(window);
