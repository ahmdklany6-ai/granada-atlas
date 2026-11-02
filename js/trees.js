/* Trees (build 5.11): one model shared by the map popup, the 2D crowns, the 3D trees and the street sections.
   Source: OpenStreetMap natural=tree / tree_row (data/vec/trees_osm.json, Overpass snapshot). No open municipal tree
   inventory exists for Granada (searched 2 Nov 2026: opendata.granada.org, datos.gob.es, Junta de Andalucía), so positions,
   species and the few recorded sizes are OSM contributors' observations; nothing here adds trees or species.
   Each value carries where it comes from:
     species / genus  → as tagged (species, genus, species:es, taxon) — otherwise "Unknown";
     form (silhouette)→ the botanical habit of the tagged genus/species (table below), else the tagged leaf type
                        (needle → conical, broad → rounded), else "unknown" (neutral generic model, marked illustrative);
     height / crown   → recorded tags only (height, diameter_crown); otherwise the visitor's editable illustrative size
                        (default 6 m tall, 4 m crown — the section default), always labelled as an estimate;
     trunk            → circumference (m, OSM convention) → diameter = c / π; the ambiguous `diameter` tag is shown as
                        tagged but not used for drawing. */
(function (root) {
  const GENUS_FORM = {
    // palms (and palm-like)
    Phoenix: 'palm', Washingtonia: 'palm', Chamaerops: 'palm', Trachycarpus: 'palm', Butia: 'palm', Syagrus: 'palm', Livistona: 'palm', Brahea: 'palm', Cycas: 'palm',
    // columnar
    Cupressus: 'columnar', Cupressocyparis: 'columnar', Juniperus: 'columnar',
    // conical conifers
    Cedrus: 'conical', Abies: 'conical', Picea: 'conical', Sequoia: 'conical', Sequoiadendron: 'conical', Araucaria: 'conical', Pinus: 'conical', Thuja: 'conical', Calocedrus: 'conical', Taxodium: 'conical', Larix: 'conical',
    // broad, spreading crowns
    Ficus: 'spreading', Jacaranda: 'spreading', Albizia: 'spreading', Acacia: 'spreading', Platanus: 'spreading', Tipuana: 'spreading', Schinus: 'spreading', Gleditsia: 'spreading',
    // rounded broadleaves
    Melia: 'round', Magnolia: 'round', Citrus: 'round', Punica: 'round', Celtis: 'round', Tilia: 'round', Ulmus: 'round', Fraxinus: 'round', Acer: 'round', Morus: 'round', Ligustrum: 'round', Robinia: 'round', Styphnolobium: 'round', Sophora: 'round', Prunus: 'round', Olea: 'round', Quercus: 'round', Ailanthus: 'round', Catalpa: 'round', Aesculus: 'round', Cercis: 'round', Laurus: 'round', Brachychiton: 'round', Eriobotrya: 'round', Pittosporum: 'round', Lagerstroemia: 'round', Koelreuteria: 'round', Populus: 'round', Salix: 'round', Eucalyptus: 'round', Grevillea: 'round', Malus: 'round', Pyrus: 'round', Ceratonia: 'round', Arbutus: 'round', Juglans: 'round', Castanea: 'round', Paulownia: 'round', Bauhinia: 'round', Photinia: 'round', Nerium: 'round',
  };
  // species with a habit different from their genus
  const SPECIES_FORM = { 'Pinus pinea': 'spreading', 'Pinus halepensis': 'spreading', 'Ficus carica': 'round', 'Cupressus arizonica': 'conical', 'Cupressus macrocarpa': 'spreading', 'Olea europaea': 'round' };
  // Spanish common names (species:es or a Spanish word in species) → genus
  const ES = { olivo: 'Olea', acebuche: 'Olea', naranjo: 'Citrus', limonero: 'Citrus', 'ciprés': 'Cupressus', cipres: 'Cupressus', pino: 'Pinus', palmera: 'Phoenix', 'plátano': 'Platanus', platano: 'Platanus', almez: 'Celtis', morera: 'Morus', cedro: 'Cedrus', magnolio: 'Magnolia', granado: 'Punica', jacaranda: 'Jacaranda', acacia: 'Acacia', 'álamo': 'Populus', alamo: 'Populus', olmo: 'Ulmus', encina: 'Quercus', roble: 'Quercus', tilo: 'Tilia', arce: 'Acer', fresno: 'Fraxinus', aligustre: 'Ligustrum', cinamomo: 'Melia', melia: 'Melia', laurel: 'Laurus', castaño: 'Castanea', nogal: 'Juglans', 'níspero': 'Eriobotrya', algarrobo: 'Ceratonia', madroño: 'Arbutus', higuera: 'Ficus', sauce: 'Salix', eucalipto: 'Eucalyptus', 'secuoya': 'Sequoia' };
  const FORMS = ['round', 'spreading', 'columnar', 'conical', 'palm', 'generic'];
  const num = (s) => { if (s == null) return null; const m = String(s).replace(',', '.').match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(m|cm|mm|ft|')?\s*$/i); if (!m) return null; let v = +m[1]; const u = (m[2] || 'm').toLowerCase(); if (u === 'cm') v /= 100; else if (u === 'mm') v /= 1000; else if (u === 'ft' || u === "'") v *= 0.3048; return v > 0 ? v : null; };
  const defaults = { h: 6, crown: 4 }; // illustrative size (editable)
  function setDefaults(h, c) { if (h > 0) defaults.h = h; if (c > 0) defaults.crown = c; listeners.forEach(f => f()); try { localStorage.setItem('granada-atlas.treeDefaults', JSON.stringify(defaults)); } catch (e) { } }
  try { const s = JSON.parse(localStorage.getItem('granada-atlas.treeDefaults') || 'null'); if (s && s.h > 0 && s.crown > 0) Object.assign(defaults, s); } catch (e) { }
  const listeners = []; const onDefaults = (f) => listeners.push(f);

  function taxon(tags) {
    const sp = tags.species || tags.taxon || null; const es = tags['species:es'] || null; let genus = tags.genus || (sp ? String(sp).split(/\s+/)[0] : null);
    if (genus && (!/^[A-Z][a-z]+$/.test(genus) || (!GENUS_FORM[genus] && ES[genus.toLowerCase()]))) { genus = ES[String(genus).toLowerCase()] || null; } // a Spanish word in species (e.g. species=Olivo)
    if (!genus && es) genus = ES[String(es).toLowerCase().split(/\s+/)[0]] || null;
    return { species: sp, speciesEs: es, genus };
  }
  function formOf(tags) {
    const tx = taxon(tags);
    if (tx.species && SPECIES_FORM[tx.species]) return { form: SPECIES_FORM[tx.species], basis: 'species' };
    if (tx.genus && GENUS_FORM[tx.genus]) return { form: GENUS_FORM[tx.genus], basis: tx.species ? 'species' : 'genus' };
    if (tags.leaf_type === 'needleleaved') return { form: 'conical', basis: 'leaf_type' };
    if (tags.leaf_type === 'broadleaved') return { form: 'round', basis: 'leaf_type' };
    return { form: 'generic', basis: 'unknown' };
  }
  // the full description of one tree (tags = OSM tags)
  function model(tags, opts) {
    tags = tags || {}; const tx = taxon(tags); const f = formOf(tags);
    const hRec = num(tags.height), cRec = num(tags.diameter_crown), circ = num(tags.circumference);
    const H = hRec || null, C = cRec || null;
    // illustrative size where not recorded, in the editable default PROPORTIONS (crown : height = default crown : default
    // height): a recorded height sets the estimated crown, a recorded crown the estimated height; neither → the defaults
    const ratio = defaults.crown / defaults.h;
    const h = H || (C ? C / ratio : defaults.h), c = C || (H ? H * ratio : defaults.crown);
    const trunkRec = circ ? circ / Math.PI : null;
    const trunk = trunkRec || Math.max(0.15, Math.min(0.6, c * 0.07)); // drawing only
    return { species: tx.species, speciesEs: tx.speciesEs, genus: tx.genus, form: f.form, formBasis: f.basis, leafType: tags.leaf_type || null, leafCycle: tags.leaf_cycle || null,
      h, hRec: !!H, crown: c, crownRec: !!C, trunk, trunkRec: !!trunkRec, circumference: circ, diameterTag: tags.diameter || null,
      denotation: tags.denotation || null, source: tags.source || null, sourceDate: tags['source:date'] || null, estimated: !(H && C) };
  }
  // geometry of the silhouette, in metres, as a list of [z0, z1, radius] slices (trunk first). Used by 3D and sections.
  function slices(m) {
    const h = m.h, r = m.crown / 2, tr = Math.max(0.08, m.trunk / 2);
    switch (m.form) {
      case 'palm': return { trunk: [0, h * 0.86, Math.max(0.12, tr * 0.8)], crown: [[h * 0.84, h * 0.93, r], [h * 0.93, h, r * 0.55]], star: true };
      case 'columnar': { const rc = Math.min(r, Math.max(0.6, h * 0.12)); return { trunk: [0, h * 0.12, tr], crown: [[h * 0.1, h * 0.35, rc * 0.85], [h * 0.35, h * 0.7, rc], [h * 0.7, h * 0.9, rc * 0.7], [h * 0.9, h, rc * 0.35]] }; }
      case 'conical': return { trunk: [0, h * 0.18, tr], crown: [[h * 0.15, h * 0.38, r], [h * 0.38, h * 0.6, r * 0.75], [h * 0.6, h * 0.8, r * 0.48], [h * 0.8, h, r * 0.2]] };
      case 'spreading': return { trunk: [0, h * 0.5, tr], crown: [[h * 0.45, h * 0.62, r * 0.85], [h * 0.62, h * 0.86, r], [h * 0.86, h, r * 0.6]] };
      case 'round': case 'generic': default: return { trunk: [0, h * 0.38, tr], crown: [[h * 0.33, h * 0.5, r * 0.75], [h * 0.5, h * 0.78, r], [h * 0.78, h * 0.93, r * 0.72], [h * 0.93, h, r * 0.3]] };
    }
  }
  // 2D outline (x across, y up, metres, base at 0) of the silhouette for drawings (sections): returns { trunk: [[x,y]...], crown: [[x,y]...] }
  function outline(m) {
    const h = m.h, r = m.crown / 2, tr = Math.max(0.08, m.trunk / 2); const P = [];
    const ell = (cy, rx, ry, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P.push([Math.cos(a) * rx, cy + Math.sin(a) * ry]); } };
    let trunkTop;
    if (m.form === 'palm') { trunkTop = h * 0.88; const fr = []; const n = 7; for (let i = 0; i <= n; i++) { const a = Math.PI * i / n; const rr = i % 2 ? r * 0.45 : r; fr.push([Math.cos(a) * rr, h * 0.88 + Math.sin(a) * (h - h * 0.88) * (i % 2 ? 0.6 : 1) - (i === 0 || i === n ? h * 0.06 : 0)]); } return { trunk: [[-tr, 0], [tr, 0], [tr * 0.7, trunkTop], [-tr * 0.7, trunkTop]], crown: fr }; }
    if (m.form === 'columnar') { const rc = Math.min(r, Math.max(0.6, h * 0.12)); trunkTop = h * 0.12; ell(h * 0.55, rc, h * 0.45, -Math.PI / 2, Math.PI * 1.5, 28); }
    else if (m.form === 'conical') { trunkTop = h * 0.18; P.push([-r, h * 0.15], [r, h * 0.15], [0, h]); }
    else if (m.form === 'spreading') { trunkTop = h * 0.5; ell(h * 0.72, r, h * 0.28, -Math.PI / 2, Math.PI * 1.5, 28); }
    else { trunkTop = h * 0.4; const ry = (h - h * 0.3) / 2; ell(h * 0.3 + ry, r, ry, -Math.PI / 2, Math.PI * 1.5, 28); }
    return { trunk: [[-tr, 0], [tr, 0], [tr, trunkTop], [-tr, trunkTop]], crown: P };
  }
  // popup / inspector HTML (escapes all tagged text). t = i18n function.
  function infoHTML(m, extra, t, esc, nf) {
    const unk = `<em>${t('v11.unknown')}</em>`; const est = (v) => `<span class="num">≈ ${nf(v, 1)} m</span> <span class="tag-est">${t('v11.estimate')}</span>`;
    const rec = (v) => `<span class="num">${nf(v, 1)} m</span> <span class="tag-rec">${t('v11.recorded')}</span>`;
    const sp = m.species ? `<i dir="ltr">${esc(m.species)}</i>` : m.genus ? `<i dir="ltr">${esc(m.genus)}</i> <small>(${t('v11.genusOnly')})</small>` : m.speciesEs ? `<span dir="ltr">${esc(m.speciesEs)}</span>` : unk;
    const rows = [[t('ly3.species'), sp + (m.species && m.speciesEs ? ` <small dir="ltr">(${esc(m.speciesEs)})</small>` : '')],
      [t('v11.form'), `${t('v11.f.' + m.form)} <small>(${t('v11.fb.' + m.formBasis)})</small>`],
      [t('ly3.leaf'), m.leafType ? esc(m.leafType) + (m.leafCycle ? ' · ' + esc(m.leafCycle) : '') : unk],
      [t('ly3.height'), m.hRec ? rec(m.h) : unk + ' · ' + est(m.h)],
      [t('ly3.crown'), m.crownRec ? rec(m.crown) : unk + ' · ' + est(m.crown)],
      [t('v11.trunk'), m.trunkRec ? `<span class="num">${nf(m.trunk, 2)} m</span> <span class="tag-rec">${t('v11.recorded')}</span> <small>(${t('v11.fromCirc', { c: nf(m.circumference, 2) })})</small>` : unk]];
    if (m.diameterTag) rows.push(['diameter', `<span dir="ltr">${esc(m.diameterTag)}</span> <small>${t('v11.diamAmbig')}</small>`]);
    if (m.denotation) rows.push(['denotation', `<span dir="ltr">${esc(m.denotation)}</span>`]);
    const src = `OpenStreetMap${extra.id ? ` <span dir="ltr">${esc(extra.id)}</span>` : ''}${m.source ? ` · source=<span dir="ltr">${esc(m.source)}${m.sourceDate ? ' ' + esc(m.sourceDate) : ''}</span>` : ''}${extra.ts ? ` · ${t('ly3.snapshot')} <span dir="ltr">${esc(String(extra.ts).slice(0, 10))}</span>` : ''} · ODbL`;
    return `<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table><small>${t('v11.treeSrc')}: ${src}</small>${m.estimated ? `<p class="fine">${t('v11.treeEstNote', { h: nf(defaults.h, 1), c: nf(defaults.crown, 1) })}</p>` : ''}`;
  }
  root.GA.trees = { model, formOf, taxon, slices, outline, infoHTML, FORMS, defaults, setDefaults, onDefaults, num };
})(window);
