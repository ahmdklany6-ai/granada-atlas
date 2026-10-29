/* GeoPackage 1.3 writer on top of sql.js (SQLite compiled to WebAssembly).
   Writes the core tables required by OGC 12-128r18 (gpkg_spatial_ref_sys, gpkg_contents,
   gpkg_geometry_columns), one feature table per layer with GeoPackage binary geometries
   (little-endian WKB, XY envelope), optional attribute tables, and QGIS's `layer_styles`
   table so each layer opens in QGIS with its default style. */
(function (root) {
  const TYPES = { Point: 1, LineString: 2, Polygon: 3, MultiPoint: 4, MultiLineString: 5, MultiPolygon: 6 };

  // ---------- WKB ----------
  function wkbSize(g) {
    switch (g.type) {
      case 'Point': return 21;
      case 'LineString': return 9 + 16 * g.coordinates.length;
      case 'Polygon': return 9 + g.coordinates.reduce((s, r) => s + 4 + 16 * r.length, 0);
      case 'MultiPoint': return 9 + g.coordinates.length * 21;
      case 'MultiLineString': return 9 + g.coordinates.reduce((s, l) => s + 9 + 16 * l.length, 0);
      case 'MultiPolygon': return 9 + g.coordinates.reduce((s, p) => s + 9 + p.reduce((t, r) => t + 4 + 16 * r.length, 0), 0);
    }
    throw new Error('Unsupported geometry ' + g.type);
  }
  function writeWKB(dv, o, g) {
    dv.setUint8(o, 1); dv.setUint32(o + 1, TYPES[g.type], true); o += 5;
    const pt = (p) => { dv.setFloat64(o, p[0], true); dv.setFloat64(o + 8, p[1], true); o += 16; };
    const ring = (r) => { dv.setUint32(o, r.length, true); o += 4; r.forEach(pt); };
    switch (g.type) {
      case 'Point': pt(g.coordinates); break;
      case 'LineString': ring(g.coordinates); break;
      case 'Polygon': dv.setUint32(o, g.coordinates.length, true); o += 4; g.coordinates.forEach(ring); break;
      case 'MultiPoint': dv.setUint32(o, g.coordinates.length, true); o += 4; g.coordinates.forEach(c => { o = writeWKB(dv, o, { type: 'Point', coordinates: c }); }); break;
      case 'MultiLineString': dv.setUint32(o, g.coordinates.length, true); o += 4; g.coordinates.forEach(c => { o = writeWKB(dv, o, { type: 'LineString', coordinates: c }); }); break;
      case 'MultiPolygon': dv.setUint32(o, g.coordinates.length, true); o += 4; g.coordinates.forEach(c => { o = writeWKB(dv, o, { type: 'Polygon', coordinates: c }); }); break;
    }
    return o;
  }
  function envelope(g) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    const walk = (x) => { if (typeof x[0] === 'number') { a = Math.min(a, x[0]); b = Math.min(b, x[1]); c = Math.max(c, x[0]); d = Math.max(d, x[1]); } else x.forEach(walk); };
    walk(g.coordinates); return [a, b, c, d];
  }
  // GeoPackage binary: magic "GP", version 0, flags (LE + XY envelope), srs_id, envelope, WKB
  function gpkgBlob(g, srsId) {
    const empty = !g || !g.coordinates || g.coordinates.length === 0;
    const size = 8 + (empty ? 0 : 32) + (empty ? 9 : wkbSize(g));
    const buf = new ArrayBuffer(size), dv = new DataView(buf);
    dv.setUint8(0, 0x47); dv.setUint8(1, 0x50); dv.setUint8(2, 0);
    dv.setUint8(3, empty ? (0x01 | 0x10) : (0x01 | 0x02)); dv.setInt32(4, srsId, true);
    if (empty) { dv.setUint8(8, 1); dv.setUint32(9, TYPES[(g && g.type) || 'MultiPolygon'], true); dv.setUint32(13, 0, true); return new Uint8Array(buf); }
    const e = envelope(g); dv.setFloat64(8, e[0], true); dv.setFloat64(16, e[2], true); dv.setFloat64(24, e[1], true); dv.setFloat64(32, e[3], true);
    writeWKB(dv, 40, g); return new Uint8Array(buf);
  }
  // Promote single geometries to the layer's declared multi type.
  function conform(g, declared) {
    if (!g) return null; const D = declared.toUpperCase();
    if (D === 'MULTIPOLYGON' && g.type === 'Polygon') return { type: 'MultiPolygon', coordinates: [g.coordinates] };
    if (D === 'MULTILINESTRING' && g.type === 'LineString') return { type: 'MultiLineString', coordinates: [g.coordinates] };
    if (D === 'MULTIPOINT' && g.type === 'Point') return { type: 'MultiPoint', coordinates: [g.coordinates] };
    return g;
  }

  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

  // layers: [{ table, title, description, geomType, srsId, fields: [{name, type}], features: [{geometry, properties}] }]
  // attributes: [{ table, description, fields, rows: [ {..} ] }]
  // styles: [{ table, name, qml, description }]
  function write(SQL, opts) {
    const db = new SQL.Database();
    if (opts.pageSize) db.run('PRAGMA page_size = ' + (opts.pageSize | 0));
    db.run('PRAGMA application_id = 1196444487'); // 0x47504B47 "GPKG"
    db.run('PRAGMA user_version = 10300');
    db.run(`CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL, srs_id INTEGER PRIMARY KEY, organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL, definition TEXT NOT NULL, description TEXT)`);
    db.run(`CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE, description TEXT DEFAULT '', last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER, CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id))`);
    db.run(`CREATE TABLE gpkg_geometry_columns (table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL, srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL, CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name), CONSTRAINT uk_gc_table_name UNIQUE (table_name), CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name), CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys (srs_id))`);
    const srs = db.prepare('INSERT INTO gpkg_spatial_ref_sys VALUES (?,?,?,?,?,?)');
    srs.run(['Undefined cartesian SRS', -1, 'NONE', -1, 'undefined', 'undefined cartesian coordinate reference system']);
    srs.run(['Undefined geographic SRS', 0, 'NONE', 0, 'undefined', 'undefined geographic coordinate reference system']);
    (opts.srs || []).forEach(s => srs.run([s.name, s.id, 'EPSG', s.id, s.wkt, s.description || '']));
    srs.free();
    const now = (opts.timestamp || new Date().toISOString()).replace(/\.\d+Z$/, '.000Z');

    (opts.layers || []).forEach(L => {
      const cols = L.fields.map(f => q(f.name) + ' ' + f.type).join(', ');
      db.run(`CREATE TABLE ${q(L.table)} (fid INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, geom ${L.geomType}${cols ? ', ' + cols : ''})`);
      let bb = [Infinity, Infinity, -Infinity, -Infinity];
      const ins = db.prepare(`INSERT INTO ${q(L.table)} (geom${L.fields.map(f => ', ' + q(f.name)).join('')}) VALUES (?${L.fields.map(() => ',?').join('')})`);
      L.features.forEach(ft => {
        const g = conform(ft.geometry, L.geomType);
        if (g && g.coordinates && g.coordinates.length) { const e = envelope(g); bb = [Math.min(bb[0], e[0]), Math.min(bb[1], e[1]), Math.max(bb[2], e[2]), Math.max(bb[3], e[3])]; }
        const vals = L.fields.map(f => { const v = ft.properties[f.name]; if (v === undefined || v === null || (typeof v === 'number' && !isFinite(v))) return null; if (f.type === 'INTEGER') return typeof v === 'boolean' ? (v ? 1 : 0) : Math.round(v); return f.type === 'REAL' ? +v : String(v); });
        ins.run([gpkgBlob(g, L.srsId)].concat(vals));
      });
      ins.free();
      const has = isFinite(bb[0]);
      db.run('INSERT INTO gpkg_contents (table_name, data_type, identifier, description, last_change, min_x, min_y, max_x, max_y, srs_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [L.table, 'features', L.title || L.table, L.description || '', now, has ? bb[0] : null, has ? bb[1] : null, has ? bb[2] : null, has ? bb[3] : null, L.srsId]);
      db.run('INSERT INTO gpkg_geometry_columns VALUES (?,?,?,?,0,0)', [L.table, 'geom', L.geomType, L.srsId]);
    });

    (opts.attributes || []).forEach(T => {
      db.run(`CREATE TABLE ${q(T.table)} (fid INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL${T.fields.map(f => ', ' + q(f.name) + ' ' + f.type).join('')})`);
      const ins = db.prepare(`INSERT INTO ${q(T.table)} (${T.fields.map(f => q(f.name)).join(',')}) VALUES (${T.fields.map(() => '?').join(',')})`);
      T.rows.forEach(r => ins.run(T.fields.map(f => r[f.name] == null ? null : (f.type === 'TEXT' ? String(r[f.name]) : r[f.name]))));
      ins.free();
      db.run('INSERT INTO gpkg_contents (table_name, data_type, identifier, description, last_change) VALUES (?,?,?,?,?)', [T.table, 'attributes', T.title || T.table, T.description || '', now]);
    });

    if (opts.styles && opts.styles.length) {
      db.run(`CREATE TABLE layer_styles (id INTEGER PRIMARY KEY AUTOINCREMENT, f_table_catalog TEXT(256), f_table_schema TEXT(256), f_table_name TEXT(256), f_geometry_column TEXT(256), styleName TEXT(30), styleQML TEXT, styleSLD TEXT, useAsDefault BOOLEAN, description TEXT, owner TEXT(30), ui TEXT(30), update_time DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      const ins = db.prepare('INSERT INTO layer_styles (f_table_catalog, f_table_schema, f_table_name, f_geometry_column, styleName, styleQML, styleSLD, useAsDefault, description, owner) VALUES (?,?,?,?,?,?,?,?,?,?)');
      opts.styles.forEach(s => ins.run(['', '', s.table, 'geom', s.name, s.qml, '', 1, s.description || '', 'Granada Atlas']));
      ins.free();
      db.run('INSERT INTO gpkg_contents (table_name, data_type, identifier, description, last_change) VALUES (?,?,?,?,?)', ['layer_styles', 'attributes', 'layer_styles', 'QGIS default styles', now]);
    }
    const out = db.export(); db.close(); return out;
  }

  const api = { write, gpkgBlob, conform, envelope };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GA = root.GA || {}; root.GA.gpkg = api; }
})(typeof window !== 'undefined' ? window : globalThis);
