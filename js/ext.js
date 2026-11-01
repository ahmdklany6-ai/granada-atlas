/* External official map services used live from the visitor's browser (no keys, CORS-enabled,
   checked 30–31 Oct 2026). Nothing here is copied into the repository:
   - MITECO SNCZI flood zones (WMS for display, WFS for exact per-area exposure)
   - MITECO SICA strategic noise maps of the Granada agglomeration (WMS; 3rd phase in the service)
   - Copernicus HRL Tree Cover Density 2018, 10 m (EEA ArcGIS ImageServer: WMS + exportImage)
   - NASA GIBS MODIS land-surface temperature (8-day, 1 km)
   - IGN historical orthophotos and first-edition maps (WMS + GetFeatureInfo for sheet/flight dates)
   - OpenStreetMap trees through Overpass, loaded by 1 km cell and cached for the session */
(function (root) {
  const { geo: G, proj: PJ, clip: CL, i18n: I } = root.GA;
  const t = (k, v) => I.t(k, v);

  const SVC = {
    miteco: 'https://gis.miteco.gob.es/geoserver/agua/wms',
    mitecoWfs: 'https://gis.miteco.gob.es/geoserver/agua/wfs',
    noise: 'https://gis.miteco.gob.es/geoserver/evaluacionambiental/wms',
    tcdWms: 'https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer/WMSServer',
    tcdRest: 'https://image.discomap.eea.europa.eu/arcgis/rest/services/GioLandPublic/HRL_TreeCoverDensity_2018/ImageServer',
    gibs: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
    ignHist: 'https://www.ign.es/wms/pnoa-historico',
    ignMtn: 'https://www.ign.es/wms/primera-edicion-mtn',
    ignMin: 'https://www.ign.es/wms/minutas-cartograficas',
    ignPnoa: 'https://www.ign.es/wms-inspire/pnoa-ma',
  };
  const FLOOD = [ // return period → SNCZI layer
    { k: 'q10', layer: 'agua:Zi_laminas_q10', T: 10, p: '10%', color: root.GA.palette.flood.q10 },
    { k: 'q50', layer: 'agua:Zi_laminas_q50', T: 50, p: '2%', color: root.GA.palette.flood.q50 },
    { k: 'q100', layer: 'agua:Zi_laminas_q100', T: 100, p: '1%', color: root.GA.palette.flood.q100 },
    { k: 'q500', layer: 'agua:Zi_laminas_q500', T: 500, p: '0.2%', color: root.GA.palette.flood.q500 },
  ];
  const LST_DATE = '2025-07-28'; // an 8-day MODIS composite in high summer (day-of-year 209)

  function wmsTiles(url, layers, extra) {
    return `${url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(layers)}&STYLES=&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=TRUE${extra || ''}`;
  }
  // GetMap for a box in EPSG:25830 (services that support it) or EPSG:3857
  function wmsURL(url, layers, bbox, w, h, srs, extra) {
    return `${url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(layers)}&STYLES=&SRS=EPSG:${srs || 25830}&BBOX=${bbox.map(v => v.toFixed(2)).join(',')}&WIDTH=${Math.round(w)}&HEIGHT=${Math.round(h)}&FORMAT=image/png&TRANSPARENT=TRUE${extra || ''}`;
  }
  function loadImage(url, timeout) {
    return new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = 'anonymous'; let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; rej(new Error(t('err.timeout'))); } }, timeout || 30000);
      im.onload = () => { if (done) return; done = true; clearTimeout(timer); res(im); };
      im.onerror = () => { if (done) return; done = true; clearTimeout(timer); rej(new Error(t('err.network'))); };
      im.src = url;
    });
  }
  const merc = (lon, lat) => [6378137 * lon * Math.PI / 180, 6378137 * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
  const imerc = (x, y) => [x / 6378137 * 180 / Math.PI, (2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * 180 / Math.PI];
  // Draw an EPSG:3857-only WMS image exactly into an EPSG:25830 frame (pixel-wise reprojection).
  async function warp3857(url, layers, frame, extra) { // frame: {x0,y0,x1,y1 (25830), w, h}
    const corners = [[frame.x0, frame.y0], [frame.x1, frame.y0], [frame.x0, frame.y1], [frame.x1, frame.y1]].map(p => merc(...PJ.EPSG25830.inverse(p)));
    const mb = [Math.min(...corners.map(c => c[0])), Math.min(...corners.map(c => c[1])), Math.max(...corners.map(c => c[0])), Math.max(...corners.map(c => c[1]))];
    const sw = Math.min(2048, Math.round(frame.w * 1.1)), sh = Math.min(2048, Math.round(frame.h * 1.1));
    const im = await loadImage(wmsURL(url, layers, mb, sw, sh, 3857, extra));
    const src = document.createElement('canvas'); src.width = sw; src.height = sh; const sx = src.getContext('2d'); sx.drawImage(im, 0, 0); const sd = sx.getImageData(0, 0, sw, sh).data;
    const out = document.createElement('canvas'); out.width = frame.w; out.height = frame.h; const ox = out.getContext('2d'); const od = ox.createImageData(frame.w, frame.h);
    for (let j = 0; j < frame.h; j++) for (let i = 0; i < frame.w; i++) {
      const x = frame.x0 + (i + 0.5) / frame.w * (frame.x1 - frame.x0), y = frame.y1 - (j + 0.5) / frame.h * (frame.y1 - frame.y0);
      const m = merc(...PJ.EPSG25830.inverse([x, y])); const u = Math.floor((m[0] - mb[0]) / (mb[2] - mb[0]) * sw), v = Math.floor((mb[3] - m[1]) / (mb[3] - mb[1]) * sh);
      if (u < 0 || v < 0 || u >= sw || v >= sh) continue; const a = (v * sw + u) * 4, b = (j * frame.w + i) * 4; od.data[b] = sd[a]; od.data[b + 1] = sd[a + 1]; od.data[b + 2] = sd[a + 2]; od.data[b + 3] = sd[a + 3];
    }
    ox.putImageData(od, 0, 0); return out;
  }

  // ---------- flood zones (SNCZI) ----------
  const floodCache = new Map();
  async function floodWFS(layer, bb) {
    const key = layer + bb.map(v => v.toFixed(3)).join(','); if (floodCache.has(key)) return floodCache.get(key);
    const u = `${SVC.mitecoWfs}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${layer}&srsName=EPSG:4326&bbox=${bb[1]},${bb[0]},${bb[3]},${bb[2]},urn:ogc:def:crs:EPSG::4326&outputFormat=application/json&count=200`;
    const p = root.GA.sources.fetchJSON(u, { timeout: 45000 }).then(j => j.features || []); floodCache.set(key, p); p.catch(() => floodCache.delete(key)); return p;
  }
  // share of the study area inside each return-period zone (exact polygon clipping)
  // Flood exposure per return period. SNCZI models selected reaches, and not every reach has every period (around the
  // city centre the Darro / Genil / Beiro studies have T10, T100 and T500 but no T50). So a period with no polygon is
  // only "0 %" when every reach modelled nearby for the other periods is also modelled for it; otherwise it is
  // "not modelled here". A failed request is "unavailable". Missing data never becomes zero.
  const reachOf = (f) => String((f.properties && (f.properties.rio || f.properties.zona)) || '').trim();
  async function floodExposure(ring) {
    const bb = G.bbox(ring); const pad = 0.002; const b2 = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
    const near = 0.02; const b3 = [bb[0] - near, bb[1] - near, bb[2] + near, bb[3] + near]; // reaches modelled within ~2 km
    const A = G.ringArea(ring); const out = { area_m2: A, zones: {}, features: {}, reaches: [] };
    const res = await Promise.all(FLOOD.map(z => Promise.all([floodWFS(z.layer, b2), floodWFS(z.layer, b3)]).then(([fs, wide]) => ({ z, fs, wide }), e => ({ z, err: (e && e.message) || String(e) }))));
    const reachSets = {}; res.forEach(r => { if (!r.err) reachSets[r.z.k] = new Set(r.wide.map(reachOf).filter(Boolean)); });
    const allReaches = new Set(); Object.values(reachSets).forEach(st => st.forEach(x => allReaches.add(x)));
    res.forEach(({ z, fs, err }) => {
      if (err) { out.zones[z.k] = { status: 'failed', error: err, m2: null, share: null }; out.features[z.k] = []; return; }
      const missing = [...allReaches].filter(x => !reachSets[z.k].has(x));
      let s = 0; const clipped = [];
      fs.forEach(f => { const g = f.geometry; if (!g) return; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; polys.forEach(pl => { try { const c = CL.clipPolygon(pl, ring); c.forEach(q => { const a = G.ringArea(q[0]) - q.slice(1).reduce((x, h) => x + G.ringArea(h), 0); if (a > 0) { s += a; clipped.push({ type: 'Polygon', coordinates: q, props: f.properties }); } }); } catch (e) { } }); });
      const notModelled = missing.length > 0 && s === 0;
      out.zones[z.k] = { status: notModelled ? 'not_modelled' : 'ok', missingReaches: missing, m2: notModelled ? null : s, share: notModelled ? null : s / A, n: fs.length,
        study: fs[0] && fs[0].properties ? fs[0].properties.estudio || null : null, date: fs[0] && fs[0].properties ? (fs[0].properties.fecha_apro || fs[0].properties.fecha_geo || null) : null,
        partial: missing.length > 0 && s > 0 };
      out.features[z.k] = clipped;
    });
    // nested periods must not shrink as the return period grows; if they do, say so instead of hiding it
    const seq = FLOOD.map(z => out.zones[z.k]).filter(v => v.share != null); out.inconsistent = seq.some((v, i) => i && v.share + 1e-9 < seq[i - 1].share);
    out.anyFailed = Object.values(out.zones).some(v => v.status === 'failed');
    try { const ar = await floodWFS('agua:Zi_arpsi', b2); out.reaches = ar.map(f => ({ code: f.properties.codigo_sub || f.properties.apsfr_code, name: f.properties.nombre_sub || f.properties.apsf_name, geometry: f.geometry })); } catch (e) { out.reachErr = e.message; }
    if (Object.values(out.zones).every(v => v.status === 'failed')) throw new Error(out.zones.q100.error || 'flood service');
    return out;
  }

  // ---------- Copernicus Tree Cover Density 2018 (10 m) ----------
  // Exported in EPSG:25830 for an exact box; returns a grid compatible with data.sampleGrid.
  const tcdCache = new Map();
  async function tcdGrid(ring, padM) {
    const U = ring.map(p => PJ.EPSG25830.forward(p)); const pad = padM == null ? 60 : padM;
    const x0 = Math.floor((Math.min(...U.map(p => p[0])) - pad) / 10) * 10, x1 = Math.ceil((Math.max(...U.map(p => p[0])) + pad) / 10) * 10;
    const y0 = Math.floor((Math.min(...U.map(p => p[1])) - pad) / 10) * 10, y1 = Math.ceil((Math.max(...U.map(p => p[1])) + pad) / 10) * 10;
    const w = Math.min(4000, (x1 - x0) / 10), h = Math.min(4000, (y1 - y0) / 10);
    const key = [x0, y0, x1, y1].join(','); if (tcdCache.has(key)) return tcdCache.get(key);
    const p = (async () => {
      const u = `${SVC.tcdRest}/exportImage?f=image&format=tiff&pixelType=U8&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_NearestNeighbor&bbox=${x0},${y0},${x1},${y1}&bboxSR=25830&imageSR=25830&size=${w},${h}`;
      const r = await fetch(u); if (!r.ok) throw new Error(t('err.http', { v: r.status })); const buf = await r.arrayBuffer();
      const tif = await root.GA.tiffread.read(buf);
      const arr = new Int16Array(tif.width * tif.height); for (let i = 0; i < arr.length; i++) { const v = tif.data[i]; arr[i] = v > 100 ? -1 : v; }
      return { width: tif.width, height: tif.height, ox: x0, oy: y1, px: (x1 - x0) / tif.width, py: (y1 - y0) / tif.height, arr, nodata: -1, scale: 1, src: 'Copernicus HRL Tree Cover Density 2018 (10 m)' };
    })();
    tcdCache.set(key, p); p.catch(() => tcdCache.delete(key)); return p;
  }
  function tcdStats(g, ring) {
    const v = root.GA.data.gridValuesInRing(g, ring); if (!v.length) return null;
    const mean = v.reduce((a, b) => a + b, 0) / v.length; const any = v.filter(x => x > 0).length / v.length; const dense = v.filter(x => x >= 30).length / v.length;
    const hist = [0, 0, 0, 0, 0]; v.forEach(x => hist[x === 0 ? 0 : x < 30 ? 1 : x < 60 ? 2 : x < 80 ? 3 : 4]++);
    return { n: v.length, mean, any, dense, hist };
  }
  const TCD_CLASSES = [{ k: '0', max: 0, col: [255, 255, 255, 0] }, { k: '1-29', max: 29, col: [205, 228, 190, 255] }, { k: '30-59', max: 59, col: [140, 190, 120, 255] }, { k: '60-79', max: 79, col: [76, 140, 70, 255] }, { k: '80-100', max: 100, col: [30, 90, 40, 255] }];
  const tcdColour = (v) => { if (v == null || v < 0) return null; const c = TCD_CLASSES.find(x => v <= x.max); return c && c.col[3] ? c.col : null; };

  // ---------- OpenStreetMap trees via Overpass (by 1 km EPSG:25830 cell) ----------
  // Mapped trees: a dated static snapshot of OSM natural=tree / tree_row inside the municipality (data/vec/trees_osm.json,
  // built by tools/build_trees.py). Static so analysis, sections and the map never wait on a busy Overpass server.
  let treeSnap = null;
  function treeData() {
    if (!treeSnap) treeSnap = root.GA.data.single('trees_osm').then(j => ({
      ts: j.osm_timestamp, count: j.count,
      pts: j.pts.map(p => ({ id: 'n' + p[0], ll: [p[1], p[2]], tags: Object.assign({ natural: 'tree' }, p[3] || {}) })),
      ways: j.rows_geom.map(w => ({ id: 'w' + w.id, coords: w.c, tags: Object.assign({ natural: 'tree_row' }, w.t || {}) })),
    })).catch(e => { treeSnap = null; throw e; });
    return treeSnap;
  }
  async function trees(bb) {
    const d = await treeData();
    const pts = d.pts.filter(p => G.inBBox(p.ll, bb));
    const ways = d.ways.filter(w => (() => { const b = G.bbox(w.coords); return b[0] <= bb[2] && b[2] >= bb[0] && b[1] <= bb[3] && b[3] >= bb[1]; })());
    return { pts, ways, ts: d.ts };
  }
  function treeFeatures(r) {
    const f = r.pts.map(p => ({ type: 'Feature', properties: { id: p.id, kind: 'tree', species: p.tags.species || p.tags['species:es'] || null, genus: p.tags.genus || null, leaf_type: p.tags.leaf_type || null, leaf_cycle: p.tags.leaf_cycle || null, height: p.tags.height || null, crown: p.tags.diameter_crown || null, denotation: p.tags.denotation || null }, geometry: { type: 'Point', coordinates: p.ll } }));
    r.ways.forEach(w => { const closed = w.coords.length > 3 && w.coords[0][0] === w.coords[w.coords.length - 1][0] && w.coords[0][1] === w.coords[w.coords.length - 1][1]; const kind = w.tags.natural === 'tree_row' ? 'tree_row' : 'wood'; if (kind === 'wood' && !closed) return; f.push({ type: 'Feature', properties: { id: w.id, kind, species: w.tags.species || w.tags.genus || null, leaf_type: w.tags.leaf_type || null }, geometry: kind === 'tree_row' ? { type: 'LineString', coordinates: w.coords } : { type: 'Polygon', coordinates: [w.coords] } }); });
    return f;
  }

  // ---------- IGN historical layers: which sheet / flight is at a point ----------
  const HIST = [
    { id: 'minutas', url: SVC.ignMin, layer: 'Minutas', fmt: 'image/png', kind: 'map', period: '1870–1950', infoLayer: 'Minutas' },
    { id: 'mtn50', url: SVC.ignMtn, layer: 'MTN50', fmt: 'image/jpeg', kind: 'map', period: '1875–1968', infoLayer: 'Enlace' },
    { id: 'catastrones', url: SVC.ignMtn, layer: 'catastrones', fmt: 'image/jpeg', kind: 'map', period: '1910–1970', infoLayer: 'catastrones' },
    { id: 'ams56', url: SVC.ignHist, layer: 'AMS_1956-1957', fmt: 'image/jpeg', kind: 'photo', period: '1956–1957', infoLayer: 'infoVuelos' },
    { id: 'inter7386', url: SVC.ignHist, layer: 'Interministerial_1973-1986', fmt: 'image/jpeg', kind: 'photo', period: '1973–1986', infoLayer: 'infoVuelos' },
    { id: 'mtn25', url: SVC.ignMtn, layer: 'MTN25', fmt: 'image/jpeg', kind: 'map', period: '1975–2003', infoLayer: 'EnlaceMTN25' },
    { id: 'nac8186', url: SVC.ignHist, layer: 'Nacional_1981-1986', fmt: 'image/jpeg', kind: 'photo', period: '1981–1986', infoLayer: 'infoVuelos' },
    { id: 'olistat', url: SVC.ignHist, layer: 'OLISTAT', fmt: 'image/jpeg', kind: 'photo', period: '1997–1998', infoLayer: 'infoVuelos' },
    { id: 'sigpac', url: SVC.ignHist, layer: 'SIGPAC', fmt: 'image/jpeg', kind: 'photo', period: '1997–2003', infoLayer: 'infoVuelos' },
    { id: 'pnoa2004', url: SVC.ignHist, layer: 'PNOA2004', fmt: 'image/jpeg', kind: 'photo', period: '2004', infoLayer: 'infoVuelos' },
    { id: 'pnoa2010', url: SVC.ignHist, layer: 'PNOA2010', fmt: 'image/jpeg', kind: 'photo', period: '2010', infoLayer: 'infoVuelos' },
    { id: 'pnoa2016', url: SVC.ignHist, layer: 'PNOA2016', fmt: 'image/jpeg', kind: 'photo', period: '2016', infoLayer: 'infoVuelos' },
    { id: 'pnoa2022', url: SVC.ignHist, layer: 'PNOA2022', fmt: 'image/jpeg', kind: 'photo', period: '2022', infoLayer: 'infoVuelos' },
    { id: 'pnoa2024', url: SVC.ignHist, layer: 'PNOA2024', fmt: 'image/jpeg', kind: 'photo', period: '2024', infoLayer: 'infoVuelos' },
  ];
  async function histInfo(h, ll) {
    const d = 0.0005; const bb = [ll[0] - d, ll[1] - d, ll[0] + d, ll[1] + d];
    const u = `${h.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${h.infoLayer}&QUERY_LAYERS=${h.infoLayer}&STYLES=&SRS=EPSG:4326&BBOX=${bb.join(',')}&WIDTH=11&HEIGHT=11&X=5&Y=5&INFO_FORMAT=${h.infoLayer === 'Enlace' ? 'text/plain' : 'text/html'}&FORMAT=image/png`;
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); const txt = await r.text();
    const plain = txt.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&([a-z])(acute|tilde);/gi, '$1').replace(/&uacute;/g, 'ú').replace(/\s+/g, ' ').trim();
    const out = { raw: plain };
    const m = plain.match(/Anyo = '(\d{4})'|A[ñn]o (\d{4})|Edici[oó]n (\d{4})|Fecha (\d{4}-\d{2}-\d{2})/); if (m) out.year = m[1] || m[2] || m[3] || m[4];
    const sh = plain.match(/NumHoja = '([\d-]+)'|N[uú]mero ([\d-]+)/); if (sh) out.sheet = sh[1] || sh[2];
    const nm = plain.match(/nombreHoja = '([^']+)'|Nombre ([A-Za-zÁÉÍÓÚáéíóúñÑ ]+?) N[uú]mero|Municipio ([^()]+)\(/); if (nm) out.name = (nm[1] || nm[2] || nm[3] || '').trim();
    const ed = plain.match(/Ediciones = '([^']+)'/); if (ed) out.editions = ed[1].split(',').map(s => s.slice(0, 4));
    if (h.infoLayer === 'infoVuelos') { const ys = [...plain.matchAll(/\b(19[4-9]\d|20[0-2]\d)\b/g)].map(x => x[1]); out.flights = [...new Set(ys)]; }
    return out;
  }

  // ---------- reference catalogue of the supplied documents (not republished) ----------
  const DOCS = [
    { id: 'edu', file: 'Granada_Education_Unemployment_English.pdf', kind: 'social', title: 'Educational attainment and unemployment (Granada)', publisher: 'Observatorio de Desigualdad de Andalucía — V Informe (2023), p. 54; cartography Paloma López-Lara', dataYear: '2021 (INE 2021: education; IECA 2021: unemployment)', reportYear: '2023', type: 'documented statistics mapped by census tract (choropleth)', unit: '% of population with post-compulsory education; % unemployed of the labour force', coverage: 'Granada city, census sections', data: 'not supplied as data — the source tables (INE Census 2021, IECA) would be needed; colours are not converted to numbers here', url: 'https://observatoriosocial.malaga.eu/' },
    { id: 'flood', file: 'Granada_Flood_Maps_English.pdf', kind: 'flood', title: 'Flood-prone areas (T = 10, 50, 100, 500 years) and ARPSI river reaches', publisher: 'Plan de Transporte Metropolitano del Área de Granada (PTMAGR) — Estudio Ambiental Estratégico, p. 71, figs 5.51–5.52', dataYear: 'SNCZI flood zones (approval dates vary by study)', reportYear: '2025 (document dated May 2025)', type: 'modelled hazard (hydraulic modelling for return periods)', unit: 'flood extent by return period', coverage: 'Granada metropolitan area', data: 'connected live: MITECO SNCZI WMS/WFS (layers Zi_laminas_q10/q50/q100/q500, Zi_arpsi)', url: 'https://www.miteco.gob.es/es/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html' },
    { id: 'eae', file: '8 PTMAGR_VCG_Estudio Ambiental Estratégico_censurado.pdf', kind: 'plan', title: 'PTMAGR — Strategic Environmental Study (143 pp.)', publisher: 'Consorcio de Transporte Metropolitano del Área de Granada (plan document)', dataYear: 'various (Padrón 2019, RVCCAA air quality 2019–2021, climate projections 1961–2099)', reportYear: '2025', type: 'plan / environmental assessment (mixed: documented, modelled, projected)', unit: '—', coverage: 'Granada metropolitan area', data: 'sections: 5.2 population & health (p. 31), 5.4 soil, water, air & climate (p. 48), 5.6 natural risks incl. flood (p. 70), 9 climate-change vulnerability (p. 106)', url: '' },
    { id: 'heat', file: 'main.pdf', kind: 'heat', title: 'Identifying priority heat-risk areas in Granada, Spain, using InVEST and landscape metrics', publisher: 'Silveira, Pistón, Martínez-López, Alcaraz-Segura, Postma, López-Torralbo, Zamora — Urban Forestry & Urban Greening 107 (2025) 128794', dataYear: '2020 (Landsat 8 LST 30 m; InVEST modelled air temperature 2 m; census tracts 2020)', reportYear: '2025', type: 'research article — modelled air temperature (InVEST) and measured land-surface temperature (Landsat); vulnerability index', unit: 'indices 0–1 by census tract', coverage: 'Granada metropolitan area', data: 'figures reproduced under CC BY 4.0 as references; the article\'s rasters are not available here', url: 'https://doi.org/10.1016/j.ufug.2025.128794', license: 'CC BY 4.0' },
    { id: 'noise', file: 'Granada_Noise_Maps_English.pdf', kind: 'noise', title: 'Strategic noise map 2022 (Phase 4) — Lden, Ld, Le, Ln; overview + 13 sheets each', publisher: 'Ayuntamiento de Granada, Servicio de Protección Ambiental — Phase 4 strategic noise map (titles translated)', dataYear: '2022', reportYear: '2022', type: 'modelled noise levels (strategic noise mapping), dB(A)', unit: 'dB(A); Lden = day-evening-night, Ln = night', coverage: 'Granada municipality, 1:40,000 overview, EPSG:25830', data: 'the 2022 maps are a PDF; the national SICA service shows the Granada agglomeration from an earlier phase (3rd), connected live for orientation only', url: 'https://sicaweb.cedex.es/' },
  ];

  const api = { SVC, FLOOD, LST_DATE, HIST, DOCS, wmsTiles, wmsURL, loadImage, warp3857, merc, imerc, floodExposure, floodWFS, tcdGrid, tcdStats, TCD_CLASSES, tcdColour, trees, treeFeatures, histInfo };
  root.GA = root.GA || {}; root.GA.ext = api;
})(window);
