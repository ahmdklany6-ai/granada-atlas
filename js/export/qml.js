/* QGIS layer styles (.qml) generated from the site palette, so exported layers open in QGIS
   with the same colours and legends. Written in the QGIS 3 "Option map" style format. */
(function (root) {
  const P = (typeof module !== 'undefined' && module.exports) ? require('../palette.js') : root.GA.palette;
  const x = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const opt = (o) => '<Option type="Map">' + Object.entries(o).map(([k, v]) => `<Option name="${k}" type="QString" value="${x(v)}"/>`).join('') + '</Option>';
  const DDP = '<data_defined_properties><Option type="Map"><Option name="name" type="QString" value=""/><Option name="properties"/><Option name="type" type="QString" value="collection"/></Option></data_defined_properties>';

  // s: {kind:'fill'|'line'|'marker', color, alpha, outline, outlineWidth, width, dash, size, noFill}
  function symbol(name, s) {
    if (s.kind === 'fill') {
      const layer = opt({ color: P.rgba(s.color, s.noFill ? 0 : (s.alpha == null ? 1 : s.alpha)), style: s.noFill ? 'no' : 'solid', outline_color: P.rgba(s.outline || '#7A7F86'), outline_style: 'solid', outline_width: String(s.outlineWidth == null ? 0.15 : s.outlineWidth), outline_width_unit: 'MM', joinstyle: 'miter', offset: '0,0', offset_unit: 'MM' });
      return `<symbol type="fill" name="${name}" alpha="1" clip_to_extent="1" force_rhr="0">${DDP}<layer class="SimpleFill" enabled="1" locked="0" pass="0">${layer}${DDP}</layer></symbol>`;
    }
    if (s.kind === 'line') {
      const layer = opt({ line_color: P.rgba(s.color), line_width: String(s.width || 0.4), line_width_unit: 'MM', line_style: s.dash ? 'dash' : 'solid', use_custom_dash: s.dash ? '1' : '0', customdash: s.dash || '5;2', customdash_unit: 'MM', capstyle: 'round', joinstyle: 'round', offset: '0', offset_unit: 'MM' });
      return `<symbol type="line" name="${name}" alpha="1" clip_to_extent="1" force_rhr="0">${DDP}<layer class="SimpleLine" enabled="1" locked="0" pass="0">${layer}${DDP}</layer></symbol>`;
    }
    const layer = opt({ name: 'circle', color: P.rgba(s.color), outline_color: P.rgba(s.outline || '#FFFFFF'), outline_style: 'solid', outline_width: '0.2', outline_width_unit: 'MM', size: String(s.size || 2), size_unit: 'MM', angle: '0', offset: '0,0', offset_unit: 'MM', joinstyle: 'bevel', scale_method: 'diameter' });
    return `<symbol type="marker" name="${name}" alpha="1" clip_to_extent="1" force_rhr="0">${DDP}<layer class="SimpleMarker" enabled="1" locked="0" pass="0">${layer}${DDP}</layer></symbol>`;
  }
  const geomCode = { fill: 2, line: 1, marker: 0 };
  function wrap(kind, renderer) {
    return `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>\n<qgis version="3.34.0-Prizren" styleCategories="Symbology|Legend">\n${renderer}\n<blendMode>0</blendMode><featureBlendMode>0</featureBlendMode><layerGeometryType>${geomCode[kind]}</layerGeometryType>\n</qgis>\n`;
  }
  function single(s) { return wrap(s.kind, `<renderer-v2 type="singleSymbol" symbollevels="0" enableorderby="0" forceraster="0"><symbols>${symbol('0', s)}</symbols></renderer-v2>`); }
  // cats: [{value, label, sym}] — a trailing {value:'', label, sym} acts as "all other values"
  function categorized(field, kind, cats) {
    const c = cats.map((k, i) => `<category value="${x(k.value)}" label="${x(k.label)}" symbol="${i}" render="true"/>`).join('');
    const s = cats.map((k, i) => symbol(String(i), Object.assign({ kind }, k.sym))).join('');
    return wrap(kind, `<renderer-v2 type="categorizedSymbol" attr="${x(field)}" symbollevels="0" enableorderby="0" forceraster="0"><categories>${c}</categories><symbols>${s}</symbols></renderer-v2>`);
  }
  const api = { single, categorized };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GA = root.GA || {}; root.GA.qml = api; }
})(typeof window !== 'undefined' ? window : globalThis);
