/* Private imports of the user's own GIS files. Files are parsed in the browser and kept in
   this browser's IndexedDB only — they are never uploaded or published. Layer settings
   (name, display field, style, visibility) are saved with the project; the data itself
   stays in IndexedDB. Supported: GeoPackage (choose layers), GeoJSON, zipped Shapefile,
   GeoTIFF, QML styles (applied to an imported layer), QGZ/QGS projects (inspected for their
   layers and missing files — not loaded as data). CRS: EPSG:4326, 25830, 3857. */
(function (root) {
  const { proj: PJ, i18n: I, palette: P, tiffread: TR } = root.GA;
  const t = (k, v) => I.t(k, v);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const QUAL = [GA.palette.red, GA.palette.blue, GA.palette.olive, GA.palette.base.khaki, GA.palette.base.burgundy, GA.palette.ink, GA.palette.grey, GA.palette.base.khaki, GA.palette.base.blueGrey, GA.palette.rose, GA.palette.redDark, GA.palette.olive];

  // ---------- IndexedDB ----------
  const DB = 'granada-atlas-imports';
  function db() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('layers', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function idb(mode, fn) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('layers', mode); const st = tx.objectStore('layers'); const out = fn(st); tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out); tx.onerror = () => rej(tx.error); }); }
  const idbPut = (rec) => idb('readwrite', st => st.put(rec));
  const idbAll = () => idb('readonly', st => st.getAll());
  const idbDel = (id) => idb('readwrite', st => st.delete(id));

  // ---------- CRS ----------
  const merc2ll = (p) => [p[0] / 6378137 * 180 / Math.PI, (2 * Math.atan(Math.exp(p[1] / 6378137)) - Math.PI / 2) * 180 / Math.PI];
  const ll2merc = (p) => [p[0] * Math.PI / 180 * 6378137, Math.log(Math.tan(Math.PI / 4 + p[1] * Math.PI / 360)) * 6378137];
  function toLL(epsg) {
    if (epsg === 4326 || epsg === 4258 || epsg === 4230 || epsg === 4979) return (p) => [p[0], p[1]];
    if (epsg === 25830 || epsg === 3042 || epsg === 32630) return (p) => PJ.EPSG25830.inverse(p);
    if (epsg === 3857 || epsg === 900913) return merc2ll;
    return null;
  }
  function epsgFromWKT(w) {
    if (!w) return null; const s = String(w);
    const m = s.match(/AUTHORITY\["EPSG","(\d+)"\]\s*\]\s*$/) || s.match(/ID\["EPSG",(\d+)\]\s*\]\s*$/); if (m) return +m[1];
    if (/UTM[ _]?zone[ _]?30N/i.test(s) || /UTM_Zone_30N/i.test(s)) return 25830;
    if (/Pseudo[-_ ]Mercator|Web_Mercator|Popular_Visualisation/i.test(s)) return 3857;
    if (/^GEOGCS/i.test(s.trim()) || /^GEOGCRS/i.test(s.trim())) return 4326;
    return null;
  }
  function guessEPSG(coords) { // fallback when a file carries no CRS
    const x = coords[0], y = coords[1];
    if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return 4326;
    if (x > 150000 && x < 900000 && y > 3500000 && y < 5000000) return 25830;
    if (Math.abs(x) < 2e7 && y > 3e6 && y < 7e6) return 3857;
    return null;
  }
  function mapGeom(g, f) {
    const w = (c) => typeof c[0] === 'number' ? f(c) : c.map(w);
    if (!g) return g; if (g.type === 'GeometryCollection') return { type: g.type, geometries: g.geometries.map(x => mapGeom(x, f)) };
    return { type: g.type, coordinates: w(g.coordinates) };
  }
  function firstCoord(g) { let c = g && (g.coordinates || (g.geometries && g.geometries[0] && g.geometries[0].coordinates)); while (c && typeof c[0] !== 'number') c = c[0]; return c; }

  // ---------- ZIP (store + deflate via DecompressionStream) ----------
  async function unzip(buf) {
    const dv = new DataView(buf); const u8 = new Uint8Array(buf); let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error(t('imp.badZip'));
    const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = {};
    for (let k = 0; k < n; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen)); p += 46 + nlen + xlen + clen;
      if (name.endsWith('/')) continue;
      const ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true); const data = u8.subarray(ds, ds + csize);
      out[name] = { method, data, async bytes() { if (method === 0) return data.slice(); if (method !== 8) throw new Error('zip method ' + method); const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); } };
    }
    return out;
  }

  // ---------- Shapefile ----------
  function readDBF(u8, enc) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); const n = dv.getUint32(4, true), hl = dv.getUint16(8, true), rl = dv.getUint16(10, true);
    const fields = []; for (let o = 32; o < hl - 1; o += 32) { if (u8[o] === 0x0D) break; let nm = ''; for (let i = 0; i < 11 && u8[o + i]; i++) nm += String.fromCharCode(u8[o + i]); fields.push({ name: nm, type: String.fromCharCode(u8[o + 11]), len: u8[o + 16] }); }
    let dec; try { dec = new TextDecoder(enc || 'utf-8', { fatal: !enc }); } catch (e) { dec = new TextDecoder('utf-8'); }
    const fb = new TextDecoder('windows-1252'); const rows = [];
    for (let r = 0; r < n; r++) {
      let o = hl + r * rl; if (u8[o] === 0x2A) { rows.push(null); continue; } o++; const row = {};
      fields.forEach(f => { const sl = u8.subarray(o, o + f.len); o += f.len; let s; try { s = dec.decode(sl); } catch (e) { s = fb.decode(sl); } s = s.replace(/\u0000/g, '').trim(); row[f.name] = f.type === 'N' || f.type === 'F' ? (s === '' ? null : +s) : f.type === 'L' ? /^[YyTt]/.test(s) : s; });
      rows.push(row);
    }
    return { fields, rows };
  }
  function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; }
  function pip(p, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; }
  function readSHP(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); const out = []; let o = 100; const len = dv.getInt32(24, false) * 2;
    while (o + 8 <= len) {
      const cl = dv.getInt32(o + 4, false) * 2; const s = o + 8; const type = dv.getInt32(s, true); let g = null; const base = type % 10;
      if (type === 0) g = null;
      else if (base === 1) g = { type: 'Point', coordinates: [dv.getFloat64(s + 4, true), dv.getFloat64(s + 12, true)] };
      else if (base === 8) { const np = dv.getInt32(s + 36, true); const c = []; for (let i = 0; i < np; i++) c.push([dv.getFloat64(s + 40 + i * 16, true), dv.getFloat64(s + 48 + i * 16, true)]); g = { type: 'MultiPoint', coordinates: c }; }
      else if (base === 3 || base === 5) {
        const nparts = dv.getInt32(s + 36, true), np = dv.getInt32(s + 40, true); const parts = []; for (let i = 0; i < nparts; i++) parts.push(dv.getInt32(s + 44 + i * 4, true));
        const po = s + 44 + nparts * 4; const pts = []; for (let i = 0; i < np; i++) pts.push([dv.getFloat64(po + i * 16, true), dv.getFloat64(po + i * 16 + 8, true)]);
        const rings = parts.map((p0, i) => pts.slice(p0, i + 1 < parts.length ? parts[i + 1] : np));
        if (base === 3) g = rings.length === 1 ? { type: 'LineString', coordinates: rings[0] } : { type: 'MultiLineString', coordinates: rings };
        else { // outer rings are clockwise (negative signed area in this formula → positive here means clockwise)
          const polys = []; const holes = [];
          rings.forEach(r => (ringArea(r) >= 0 ? polys.push([r]) : holes.push(r)));
          holes.forEach(h => { const host = polys.find(pl => pip(h[0], pl[0])) || polys[0]; if (host) host.push(h); else polys.push([h]); });
          g = polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
        }
      }
      out.push(g); o = s + cl;
    }
    return out;
  }
  async function parseShapeZip(buf, name) {
    const z = await unzip(buf); const names = Object.keys(z); const shps = names.filter(n => /\.shp$/i.test(n));
    if (!shps.length) throw new Error(t('imp.noShp'));
    const layers = [];
    for (const shp of shps) {
      const stem = shp.replace(/\.shp$/i, ''); const get = (ext) => names.find(n => n.toLowerCase() === (stem + ext).toLowerCase());
      if (!get('.dbf')) { layers.push({ name: stem, error: t('imp.noDbf') }); continue; }
      const geoms = readSHP(await z[shp].bytes()); const cpg = get('.cpg') ? new TextDecoder().decode(await z[get('.cpg')].bytes()).trim() : null;
      const dbf = readDBF(await z[get('.dbf')].bytes(), cpg && /1252|latin/i.test(cpg) ? 'windows-1252' : cpg ? 'utf-8' : null);
      const prj = get('.prj') ? new TextDecoder().decode(await z[get('.prj')].bytes()) : null;
      const feats = geoms.map((g, i) => ({ type: 'Feature', properties: dbf.rows[i] || {}, geometry: g })).filter(f => f.geometry);
      layers.push({ name: stem.split('/').pop(), features: feats, epsg: epsgFromWKT(prj), crsNote: prj ? null : t('imp.noPrj'), fields: dbf.fields.map(f => f.name) });
    }
    return layers;
  }

  // ---------- GeoPackage ----------
  function gpkgGeom(b) {
    if (!b || b.length < 8 || b[0] !== 0x47 || b[1] !== 0x50) return null;
    const flags = b[3]; const env = (flags >> 1) & 7; const envLen = [0, 32, 48, 48, 64][env] || 0; const le = flags & 1; let o = 8 + envLen;
    if ((flags >> 4) & 1) return null; // empty
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    function rd() {
      const l = b[o] === 1; o++; let type = dv.getUint32(o, l); o += 4; let dims = 2;
      if (type > 1000) { const z = Math.floor(type / 1000); type = type % 1000; dims = z === 3 ? 4 : 3; }
      if (type & 0x80000000) { dims += 1; type &= 0x0FFFFFFF; } if (type & 0x40000000) { dims += 1; type &= 0x0FFFFFFF; }
      const pt = () => { const p = [dv.getFloat64(o, l), dv.getFloat64(o + 8, l)]; o += 8 * dims; return p; };
      const seq = () => { const n = dv.getUint32(o, l); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(pt()); return a; };
      const rings = () => { const n = dv.getUint32(o, l); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(seq()); return a; };
      const multi = (ty) => { const n = dv.getUint32(o, l); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(rd().coordinates); return { type: ty, coordinates: a }; };
      switch (type) { case 1: return { type: 'Point', coordinates: pt() }; case 2: return { type: 'LineString', coordinates: seq() }; case 3: return { type: 'Polygon', coordinates: rings() };
        case 4: return multi('MultiPoint'); case 5: return multi('MultiLineString'); case 6: return multi('MultiPolygon');
        case 7: { const n = dv.getUint32(o, l); o += 4; const g = []; for (let i = 0; i < n; i++) g.push(rd()); return { type: 'GeometryCollection', geometries: g }; } }
      throw new Error('WKB type ' + type);
    }
    void le; return rd();
  }
  async function gpkgOpen(buf, loadSQL) {
    const SQL = await loadSQL(); const dbx = new SQL.Database(new Uint8Array(buf));
    const q = (s, p) => { const st = dbx.prepare(s); if (p) st.bind(p); const out = []; while (st.step()) out.push(st.getAsObject()); st.free(); return out; };
    const contents = q("SELECT table_name, data_type, identifier, srs_id FROM gpkg_contents");
    const geomCols = {}; try { q('SELECT table_name, column_name, geometry_type_name, srs_id FROM gpkg_geometry_columns').forEach(r => geomCols[r.table_name] = r); } catch (e) { }
    const srs = {}; try { q('SELECT srs_id, organization, organization_coordsys_id, definition FROM gpkg_spatial_ref_sys').forEach(r => srs[r.srs_id] = r); } catch (e) { }
    const list = contents.map(c => { let n = 0; try { n = q(`SELECT COUNT(*) AS n FROM "${c.table_name.replace(/"/g, '""')}"`)[0].n; } catch (e) { } const s = srs[c.srs_id] || {}; return { table: c.table_name, kind: c.data_type, n, geomType: geomCols[c.table_name] && geomCols[c.table_name].geometry_type_name, epsg: (s.organization || '').toUpperCase() === 'EPSG' ? s.organization_coordsys_id : epsgFromWKT(s.definition) }; });
    return {
      list,
      read(table) {
        const gc = geomCols[table]; if (!gc) throw new Error(t('imp.notFeatures'));
        const rows = q(`SELECT * FROM "${table.replace(/"/g, '""')}"`); const gcol = gc.column_name;
        const feats = rows.map(r => { const g = gpkgGeom(r[gcol]); const props = {}; Object.keys(r).forEach(k => { if (k !== gcol) props[k] = r[k] instanceof Uint8Array ? '[blob]' : r[k]; }); return { type: 'Feature', properties: props, geometry: g }; }).filter(f => f.geometry);
        return { name: table, features: feats, epsg: list.find(l => l.table === table).epsg, fields: rows.length ? Object.keys(rows[0]).filter(k => k !== gcol) : [] };
      },
      close() { dbx.close(); },
    };
  }

  // ---------- GeoTIFF → Web-Mercator image ----------
  async function tiffToImage(buf) {
    const r = await TR.read(buf); const f = toLL(r.epsg); if (!f) throw new Error(t('imp.crsUnsupported', { v: r.epsg || '?' }));
    const W = r.width, H = r.height; const corners = [[r.ox, r.oy], [r.ox + W * r.px, r.oy], [r.ox + W * r.px, r.oy - H * r.py], [r.ox, r.oy - H * r.py]].map(f);
    const lon0 = Math.min(...corners.map(c => c[0])), lon1 = Math.max(...corners.map(c => c[0])), lat0 = Math.min(...corners.map(c => c[1])), lat1 = Math.max(...corners.map(c => c[1]));
    const m0 = ll2merc([lon0, lat0]), m1 = ll2merc([lon1, lat1]);
    const ow = Math.min(2048, Math.max(64, W)), oh = Math.round(ow * (m1[1] - m0[1]) / (m1[0] - m0[0]));
    const inv = r.epsg === 25830 || r.epsg === 3042 || r.epsg === 32630 ? (ll) => PJ.EPSG25830.forward(ll) : r.epsg === 3857 ? ll2merc : (ll) => ll;
    const cv = document.createElement('canvas'); cv.width = ow; cv.height = oh; const ctx = cv.getContext('2d'); const img = ctx.createImageData(ow, oh);
    const rgb = false; // first band is shown as a single-band ramp
    const lo = r.min, hi = r.max;
    for (let j = 0; j < oh; j++) for (let i = 0; i < ow; i++) {
      const mx = m0[0] + (i + 0.5) / ow * (m1[0] - m0[0]), my = m1[1] - (j + 0.5) / oh * (m1[1] - m0[1]);
      const p = inv(merc2ll([mx, my])); const ci = Math.floor((p[0] - r.ox) / r.px), cj = Math.floor((r.oy - p[1]) / r.py);
      if (ci < 0 || cj < 0 || ci >= W || cj >= H) continue; const k = cj * W + ci; if (r.valid && !r.valid[k]) continue;
      const o = (j * ow + i) * 4;
      if (rgb && r.rgb) { img.data[o] = r.rgb[k * 3]; img.data[o + 1] = r.rgb[k * 3 + 1]; img.data[o + 2] = r.rgb[k * 3 + 2]; img.data[o + 3] = 255; }
      else { const v = r.data[k]; const tt = Math.max(0, Math.min(1, (v - lo) / ((hi - lo) || 1))); img.data[o] = Math.round(248 - tt * (248 - 110)); img.data[o + 1] = Math.round(240 - tt * (240 - 28)); img.data[o + 2] = Math.round(240 - tt * (240 - 27)); img.data[o + 3] = 230; }
    }
    ctx.putImageData(img, 0, 0);
    return { url: cv.toDataURL('image/png'), coordinates: [[lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]], meta: { epsg: r.epsg, width: W, height: H, px: r.px, py: r.py, min: lo, max: hi, nodata: r.nodata } };
  }

  // ---------- QML / QGZ ----------
  function qmlColor(el) {
    const prop = el.querySelector('prop[k="color"], Option[name="color"]'); if (!prop) return null; const v = (prop.getAttribute('v') || prop.getAttribute('value') || '').split(',');
    if (v.length < 3) return null; const a = v[3] != null ? (+v[3] / 255) : 1; return `rgba(${+v[0]},${+v[1]},${+v[2]},${a.toFixed(2)})`;
  }
  function parseQML(text) {
    const x = new DOMParser().parseFromString(text, 'application/xml'); const r = x.querySelector('renderer-v2'); if (!r) throw new Error(t('imp.qmlNoRenderer'));
    const type = r.getAttribute('type'); const symbols = {}; r.querySelectorAll(':scope > symbols > symbol').forEach(s => symbols[s.getAttribute('name')] = qmlColor(s));
    const out = { type, attr: r.getAttribute('attr') };
    if (type === 'singleSymbol') out.color = symbols['0'] || Object.values(symbols)[0];
    else if (type === 'categorizedSymbol') out.cats = [...r.querySelectorAll('categories > category')].map(c => ({ value: c.getAttribute('value'), label: c.getAttribute('label'), color: symbols[c.getAttribute('symbol')] }));
    else if (type === 'graduatedSymbol') out.ranges = [...r.querySelectorAll('ranges > range')].map(c => ({ lo: +c.getAttribute('lower'), hi: +c.getAttribute('upper'), label: c.getAttribute('label'), color: symbols[c.getAttribute('symbol')] }));
    else throw new Error(t('imp.qmlType', { v: type }));
    return out;
  }
  async function inspectQGZ(buf, isZip, knownNames) {
    let xml;
    if (isZip) { const z = await unzip(buf); const k = Object.keys(z).find(n => /\.qgs$/i.test(n)); if (!k) throw new Error(t('imp.noQgs')); xml = new TextDecoder().decode(await z[k].bytes()); }
    else xml = new TextDecoder().decode(new Uint8Array(buf));
    const x = new DOMParser().parseFromString(xml, 'application/xml');
    const layers = [...x.querySelectorAll('projectlayers > maplayer')].map(m => {
      const ds = (m.querySelector('datasource') || {}).textContent || ''; const file = (ds.split('|')[0].match(/[^/\\]+$/) || [''])[0];
      const prov = (m.querySelector('provider') || {}).textContent || ''; const name = (m.querySelector('layername') || {}).textContent || '';
      const crs = (m.querySelector('srs authid') || {}).textContent || '';
      return { name, type: m.getAttribute('type'), provider: prov, file, crs, remote: /^(https?:|type=xyz|url=|crs=)/i.test(ds) || prov === 'wms' || prov === 'xyz', available: knownNames.some(n => n.toLowerCase() === file.toLowerCase()) };
    });
    return { title: (x.querySelector('qgis > title') || {}).textContent || '', crs: (x.querySelector('projectCrs authid') || {}).textContent || '', layers };
  }

  // ---------- user layer definition for layers.js ----------
  function styleExpr(cfg) {
    const st = cfg.style || { mode: 'single', color: P.red };
    if (st.mode === 'categorized' && st.field && st.cats && st.cats.length) return ['match', ['to-string', ['get', st.field]]].concat(st.cats.flatMap(c => [String(c.value), c.color]), [st.other || GA.palette.line2]);
    if (st.mode === 'graduated' && st.field && st.ranges && st.ranges.length) { const e = ['step', ['to-number', ['get', st.field], -1e12], st.ranges[0].color]; st.ranges.slice(1).forEach(r => e.push(r.lo, r.color)); return e; }
    return st.color || P.red;
  }
  function makeDef(rec, cfg) {
    const id = rec.id; const L = (k) => 'ly-u-' + id + '-' + k;
    const def = { id, group: 'user', user: true, title: () => cfg.title || rec.name, def: { on: cfg.on !== false, opacity: cfg.opacity == null ? 0.85 : cfg.opacity }, opacityProp: {},
      layers: () => rec.kind === 'raster' ? [L('img')] : [L('fill'), L('line'), L('pt')],
      build(map, before) {
        const b = map.getLayer(before) ? before : undefined;
        if (rec.kind === 'raster') { map.addSource(L('src'), { type: 'image', url: rec.image.url, coordinates: rec.image.coordinates }); map.addLayer({ id: L('img'), type: 'raster', source: L('src'), paint: { 'raster-opacity': def.def.opacity, 'raster-fade-duration': 0 } }, b); def.opacityProp[L('img')] = 'raster-opacity'; return; }
        map.addSource(L('src'), { type: 'geojson', data: rec.geojson });
        const col = styleExpr(cfg);
        map.addLayer({ id: L('fill'), type: 'fill', source: L('src'), filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]], paint: { 'fill-color': col, 'fill-opacity': def.def.opacity, 'fill-outline-color': '#FFFFFF' } }, b);
        map.addLayer({ id: L('line'), type: 'line', source: L('src'), filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]], paint: { 'line-color': col, 'line-width': 1.6, 'line-opacity': def.def.opacity } }, b);
        map.addLayer({ id: L('pt'), type: 'circle', source: L('src'), filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]], paint: { 'circle-color': col, 'circle-radius': 4, 'circle-stroke-color': '#FFF', 'circle-stroke-width': 1, 'circle-opacity': def.def.opacity } }, b);
        Object.assign(def.opacityProp, { [L('fill')]: 'fill-opacity', [L('line')]: 'line-opacity', [L('pt')]: 'circle-opacity' });
      },
      restyle(map) { if (rec.kind === 'raster') return; const col = styleExpr(cfg); if (map.getLayer(L('fill'))) { map.setPaintProperty(L('fill'), 'fill-color', col); map.setPaintProperty(L('line'), 'line-color', col); map.setPaintProperty(L('pt'), 'circle-color', col); } },
      remove(map) { def.layers().forEach(l => map.getLayer(l) && map.removeLayer(l)); if (map.getSource(L('src'))) map.removeSource(L('src')); },
      legend() {
        const st = cfg.style || {}; const sw = (c, l) => `<li><i class="sw" style="background:${c}"></i><span>${l}</span></li>`;
        let h = '<ul class="lg">';
        if (rec.kind === 'raster') h += `<li><i class="sw ramp" style="background:linear-gradient(90deg,${P.redSoft},${P.redDark})"></i><span class="num">${(+rec.image.meta.min).toFixed(1)} – ${(+rec.image.meta.max).toFixed(1)}</span></li>`;
        else if (st.mode === 'categorized') h += st.cats.slice(0, 14).map(c => sw(c.color, esc(c.label || c.value))).join('') + (st.cats.length > 14 ? `<li><small>+${st.cats.length - 14}</small></li>` : '');
        else if (st.mode === 'graduated') h += st.ranges.map(r => sw(r.color, esc(r.label || `${r.lo}–${r.hi}`))).join('');
        else h += sw(st.color || P.red, esc(cfg.title || rec.name));
        return h + `</ul><p class="lyr-src">${t('imp.privateNote')}${cfg.qml ? ' · QML: ' + esc(cfg.qml) : ''}</p>`;
      },
      src: () => esc(rec.fileName) + ' · ' + t('imp.private'),
      popup: rec.kind === 'raster' ? null : { layers: () => [L('fill'), L('line'), L('pt')], html: (p) => { const f = cfg.field; const keys = Object.keys(p).filter(k => !k.startsWith('_')); return `<b dir="auto">${esc(f && p[f] != null ? p[f] : (cfg.title || rec.name))}</b><table>${keys.slice(0, 14).map(k => `<tr><td dir="ltr">${esc(k)}</td><td dir="auto">${esc(p[k])}</td></tr>`).join('')}</table><small>${t('imp.private')}</small>`; } },
    };
    return def;
  }

  // ---------- controller ----------
  function create(opts) {
    const { layers, store, loadSQL, toast, onChange } = opts;
    let recs = []; let pendingGpkg = null; let qgzReport = null;
    const cfgs = () => { const p = store.get(); p.imports = p.imports || []; return p.imports; };
    const cfgOf = (id) => cfgs().find(c => c.id === id);
    const save = () => store.save();

    async function restore() {
      try { recs = await idbAll(); } catch (e) { recs = []; return; }
      recs.forEach(r => { let c = cfgOf(r.id); if (!c) { c = { id: r.id, title: r.name }; cfgs().push(c); } layers.addUser(makeDef(r, c)); });
      onChange();
    }
    function autoField(fs) { const ks = Object.keys((fs[0] && fs[0].properties) || {}); return ks.find(k => /^(name|nombre|nom|nm|label)$/i.test(k)) || ks[0] || null; }
    async function addVector(name, fileName, features, epsg, fields) {
      const fc0 = features.find(f => f.geometry); if (!fc0) throw new Error(t('imp.empty'));
      let e = epsg || guessEPSG(firstCoord(fc0.geometry)); const f = toLL(e); if (!f) throw new Error(t('imp.crsUnsupported', { v: e || '?' }));
      const geojson = { type: 'FeatureCollection', features: features.map(x => ({ type: 'Feature', properties: x.properties, geometry: mapGeom(x.geometry, f) })) };
      const rec = { id: 'imp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'vector', name, fileName, epsg: e, crsGuessed: !epsg, geojson, fields: fields || Object.keys(fc0.properties || {}), created: new Date().toISOString(), n: features.length };
      await idbPut(rec); recs.push(rec); const c = { id: rec.id, title: name, field: autoField(features), style: { mode: 'single', color: QUAL[recs.length % QUAL.length] }, on: true, opacity: 0.85 }; cfgs().push(c); save();
      layers.addUser(makeDef(rec, c)); toast(t('imp.added', { v: name, n: features.length }) + (rec.crsGuessed ? ' ' + t('imp.crsGuessed', { v: e }) : '')); onChange();
      return rec;
    }
    async function handleFile(file) {
      const name = file.name; const lower = name.toLowerCase(); const buf = await file.arrayBuffer();
      if (/\.(geo)?json$/.test(lower)) {
        const j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf))); const feats = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : [{ type: 'Feature', properties: {}, geometry: j }];
        const crsName = j.crs && j.crs.properties && j.crs.properties.name; const m = crsName && String(crsName).match(/EPSG:{1,2}(\d+)/); return addVector(name.replace(/\.(geo)?json$/i, ''), name, feats, m ? +m[1] : null);
      }
      if (/\.gpkg$/.test(lower)) { const g = await gpkgOpen(buf, loadSQL); pendingGpkg = { g, name }; onChange(); return; }
      if (/\.zip$/.test(lower)) { const ls = await parseShapeZip(buf, name); for (const l of ls) { if (l.error) toast(l.name + ': ' + l.error, true); else await addVector(l.name, name, l.features, l.epsg, l.fields); } return; }
      if (/\.tiff?$/.test(lower)) {
        const image = await tiffToImage(buf); const rec = { id: 'imp-' + Date.now().toString(36), kind: 'raster', name: name.replace(/\.tiff?$/i, ''), fileName: name, image, created: new Date().toISOString() };
        await idbPut(rec); recs.push(rec); const c = { id: rec.id, title: rec.name, on: true, opacity: 0.75 }; cfgs().push(c); save(); layers.addUser(makeDef(rec, c)); toast(t('imp.added', { v: rec.name, n: image.meta.width + '×' + image.meta.height })); onChange(); return;
      }
      if (/\.qml$/.test(lower)) { const q = parseQML(new TextDecoder().decode(new Uint8Array(buf))); pendingQml = { q, name }; onChange(); return; }
      if (/\.qg[sz]$/.test(lower)) { qgzReport = await inspectQGZ(buf, lower.endsWith('.qgz'), recs.map(r => r.fileName).concat(recs.map(r => r.name + '.gpkg'))); qgzReport.file = name; onChange(); return; }
      throw new Error(t('imp.unsupported', { v: name }));
    }
    let pendingQml = null;
    function applyQml(id) {
      const c = cfgOf(id); const r = recs.find(x => x.id === id); if (!c || !r || !pendingQml) return; const q = pendingQml.q;
      if (q.attr && r.fields && !r.fields.includes(q.attr)) { toast(t('imp.qmlNoField', { v: q.attr }), true); return; }
      c.style = q.type === 'singleSymbol' ? { mode: 'single', color: q.color } : q.type === 'categorizedSymbol' ? { mode: 'categorized', field: q.attr, cats: q.cats.filter(x => x.color) } : { mode: 'graduated', field: q.attr, ranges: q.ranges.filter(x => x.color) };
      c.qml = pendingQml.name; pendingQml = null; save(); layers.refreshUser(id); onChange();
    }
    function categorize(id, field) {
      const c = cfgOf(id); const r = recs.find(x => x.id === id); if (!c || !r) return;
      if (!field) { c.style = { mode: 'single', color: (c.style && c.style.color) || QUAL[0] }; }
      else { const counts = {}; r.geojson.features.forEach(f => { const v = String(f.properties[field]); counts[v] = (counts[v] || 0) + 1; }); const vals = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        c.style = { mode: 'categorized', field, cats: vals.slice(0, 12).map((v, i) => ({ value: v, label: `${v} (${counts[v]})`, color: QUAL[i % QUAL.length] })), other: GA.palette.line2 }; }
      save(); layers.refreshUser(id); onChange();
    }

    function panelHTML() {
      let h = `<div class="lyr-group">${t('imp.group')}</div><p class="fine">${t('imp.lead')}</p>
        <label class="btn btn-small">${t('imp.choose')}<input type="file" id="imp-file" multiple accept=".gpkg,.geojson,.json,.zip,.tif,.tiff,.qml,.qgz,.qgs" hidden></label>`;
      if (pendingGpkg) h += `<div class="lyr"><div class="lyr-b"><b dir="ltr">${esc(pendingGpkg.name)}</b><span>${t('imp.chooseLayers')}</span>${pendingGpkg.g.list.map(l => `<label class="chk"><input type="checkbox" data-gpkg-layer="${esc(l.table)}" ${l.kind === 'features' ? '' : 'disabled'}> <span dir="ltr">${esc(l.table)}</span> <small>${l.kind} · ${l.n} · ${l.geomType || ''} · EPSG:${l.epsg || '?'}</small></label>`).join('')}<div class="actions"><button class="btn btn-small btn-primary" id="imp-gpkg-go">${t('imp.load')}</button><button class="btn btn-small" id="imp-gpkg-cancel">${t('cancel')}</button></div></div></div>`;
      if (pendingQml) h += `<div class="lyr"><div class="lyr-b"><b dir="ltr">${esc(pendingQml.name)}</b> <small>${esc(pendingQml.q.type)}${pendingQml.q.attr ? ' · ' + esc(pendingQml.q.attr) : ''}</small><span>${t('imp.qmlTarget')}</span>${recs.filter(r => r.kind === 'vector').map(r => `<button class="btn btn-small" data-qml-apply="${r.id}">${esc((cfgOf(r.id) || {}).title || r.name)}</button>`).join(' ') || `<small>${t('imp.qmlNoTarget')}</small>`}<button class="btn btn-small" id="imp-qml-cancel">${t('cancel')}</button></div></div>`;
      if (qgzReport) h += `<div class="lyr"><div class="lyr-b"><b dir="ltr">${esc(qgzReport.file)}</b> <small>${t('imp.qgzCrs')} ${esc(qgzReport.crs)}</small><p class="fine">${t('imp.qgzLead')}</p><table class="tbl small"><tbody>${qgzReport.layers.map(l => `<tr><td dir="auto">${esc(l.name)}</td><td dir="ltr"><small>${esc(l.file || l.provider)}</small></td><td>${l.remote ? `<span class="state st-exp">${t('imp.remote')}</span>` : l.available ? `<span class="state st-ok">${t('imp.loaded')}</span>` : `<span class="state st-no">${t('imp.missing')}</span>`}</td></tr>`).join('')}</tbody></table><button class="btn btn-small" id="imp-qgz-close">${t('close')}</button></div></div>`;
      return h;
    }
    function userControls(id) {
      const c = cfgOf(id); const r = recs.find(x => x.id === id); if (!c || !r) return '';
      let h = `<label class="row2">${t('imp.title')} <input type="text" dir="auto" data-imp-title="${id}" value="${esc(c.title || r.name)}"></label>`;
      if (r.kind === 'vector') {
        h += `<label class="row2">${t('imp.field')} <select data-imp-field="${id}">${r.fields.map(f => `<option ${c.field === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>`;
        h += `<label class="row2">${t('imp.styleBy')} <select data-imp-cat="${id}"><option value="">${t('imp.single')}</option>${r.fields.map(f => `<option value="${esc(f)}" ${c.style && c.style.mode === 'categorized' && c.style.field === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>${c.style && c.style.mode === 'single' ? `<input type="color" data-imp-color="${id}" value="${/^#/.test(c.style.color) ? c.style.color : GA.palette.red}">` : ''}</label>`;
        h += `<p class="lyr-src">${t('imp.meta', { n: r.n, e: r.epsg })}${r.crsGuessed ? ' · ' + t('imp.crsGuessedShort') : ''}</p>`;
      } else h += `<p class="lyr-src">EPSG:${r.image.meta.epsg} · ${r.image.meta.width}×${r.image.meta.height} · ${(+r.image.meta.px).toFixed(2)} ${t('imp.units')}</p>`;
      h += `<button class="btn btn-tiny danger" data-imp-del="${id}">${t('imp.remove')}</button>`;
      return h;
    }
    async function onEvent(e) {
      const el = e.target;
      try {
        if (e.type === 'change' && el.id === 'imp-file') { for (const f of el.files) await handleFile(f); el.value = ''; return true; }
        if (e.type === 'click' && el.id === 'imp-gpkg-go' && pendingGpkg) { const sel = [...document.querySelectorAll('[data-gpkg-layer]:checked')].map(x => x.dataset.gpkgLayer); const { g, name } = pendingGpkg; for (const tb of sel) { const l = g.read(tb); await addVector(tb, name, l.features, l.epsg, l.fields); } g.close(); pendingGpkg = null; onChange(); return true; }
        if (e.type === 'click' && el.id === 'imp-gpkg-cancel') { pendingGpkg.g.close(); pendingGpkg = null; onChange(); return true; }
        if (e.type === 'click' && el.id === 'imp-qml-cancel') { pendingQml = null; onChange(); return true; }
        if (e.type === 'click' && el.id === 'imp-qgz-close') { qgzReport = null; onChange(); return true; }
        if (e.type === 'click' && el.dataset.qmlApply) { applyQml(el.dataset.qmlApply); return true; }
        if (e.type === 'click' && el.dataset.impDel) { const id = el.dataset.impDel; await idbDel(id); recs = recs.filter(r => r.id !== id); const p = store.get(); p.imports = cfgs().filter(c => c.id !== id); save(); layers.removeUser(id); onChange(); return true; }
        if (e.type === 'change' && el.dataset.impTitle) { cfgOf(el.dataset.impTitle).title = el.value.trim() || cfgOf(el.dataset.impTitle).title; save(); onChange(); return true; }
        if (e.type === 'change' && el.dataset.impField) { cfgOf(el.dataset.impField).field = el.value; save(); return true; }
        if (e.type === 'change' && el.dataset.impCat != null && el.matches('[data-imp-cat]')) { categorize(el.dataset.impCat, el.value); return true; }
        if (e.type === 'change' && el.dataset.impColor) { const c = cfgOf(el.dataset.impColor); c.style = { mode: 'single', color: el.value }; save(); layers.refreshUser(c.id); onChange(); return true; }
      } catch (er) { toast(er.message || String(er), true); onChange(); return true; }
      return false;
    }
    // keep layer on/opacity in the project config
    function syncState() { cfgs().forEach(c => { const s = layers.S[c.id]; if (s) { c.on = s.on; c.opacity = s.opacity; } }); }
    return { restore, panelHTML, userControls, onEvent, handleFile, syncState, get recs() { return recs; } };
  }

  root.GA.imports = { create, parseQML, unzip, readSHP, readDBF, gpkgGeom, epsgFromWKT, toLL, guessEPSG };
})(window);
