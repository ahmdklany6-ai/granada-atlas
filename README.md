# Granada Atlas — أطلس غرناطة — האטלס של גרנדה

Research tool for the studio *Urban Transformation as a Regional Laboratory* (SCE, 2026–27).
Interface in Arabic (RTL), Hebrew (RTL) and English (LTR); the choice is remembered per browser.
Live: https://ahmdklany6-ai.github.io/granada-atlas/

## Run it

Static website, no build step, no API keys. `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`.
Projects, notes, sections and private imports live in the visitor's own browser (localStorage + IndexedDB).
Use **Status → Download backup (JSON)** to keep or move a project. Nothing a visitor does is uploaded.

## Layout

Fixed in every language: **analysis and results on the left**, **study-area controls on the right with the layers below them**, the map in between. Both side panels collapse (◀ ▶) and resize (drag their inner edge); the map is inset between them, so an analysed area is always fitted into the unobstructed space. Typeface: IBM Plex Sans / Sans Arabic / Sans Hebrew (SIL Open Font License), 15 px body text.

## What works

| Feature | Status |
| --- | --- |
| Set Center → default 250 m north-oriented square; circle and click-polygon; numeric + drag editing; measuring; undo; save / save as / rename / delete | works |
| Citywide layers without a selection: building floors (50 m overview raster, then footprints by viewport at zoom ≥ 14.5, unknown floors hatched), figure-ground, construction period, street hierarchy, land use, parks, rivers, neighbourhood choropleths (counts vs per km², quintiles), administrative boundaries, healthcare / education / accommodation points, bus stops, elevation, hillshade, slope, contours | works |
| Layer visibility, opacity, drawing order, legends; scope "citywide" or "study areas only" (mask) | works |
| Private imports: GeoPackage (choose layers), GeoJSON, zipped Shapefile, GeoTIFF, QML styles (single / categorized / graduated), QGZ inspection (layers + missing files); rename, display field, colour by field; saved with the project, data kept in IndexedDB | works (CRS 4326 / 25830 / 3857 only) |
| Visual analysis gallery: 12 map cards drawn from real data at one scale — legend with units and class limits, scale bar, north arrow, source + date, indicators, chart, findings, collapsed method; enlarge; PNG at a stated print scale; legend click highlights features on the main map | works |
| Sections: A → intermediate vertices → B, draggable vertices, several named sections per area, MDT25 terrain, cut buildings (tagged height / floors × floor height as a labelled estimate / unknown), background buildings, stated vertical exaggeration and accuracy, PNG | works |
| Comparison of 2–4 areas: numbered, distinct boundary styles, shared scale and class breaks, shared elevation ramp, paired maps, indicator table ("no data" ≠ 0), fairness caveats, descriptive findings, CSV | works |
| Exercise 1.2: city overview with numbered samples, five components per fabric with Ready / Needs review / Missing, justification + sentence, ≥ 4 fabrics required, A3 sheets at one print scale + combined PDF | works |
| Photos (Wikimedia Commons): camera position vs depicted place, inside vs nearby, full localised dates, author + licence; Street View / Google Maps link-outs (official Maps URLs, no key) | works |
| Official sources: Ayuntamiento de Granada (urbanismo, Archivo Municipal cartography), IGN, CNIG Fototeca, Catastro — links only | works |
| Transit service frequency (GTFS), population per neighbourhood, accessibility (network analysis), Google Street View imagery inside the tool | not connected — shown as gaps |

## Published data (`data/`)

Built by `tools/build_data.js` from the supplied open datasets (the originals are not in this repository):
OSM buildings, streets, land use, parks, rivers, bus stops, neighbourhood/district/municipal boundaries (ODbL, extract of 23 Oct 2026); facility snapshot via Overpass (30 Oct 2026, ODbL); JRC GHSL urban centre; IGN MDT25 terrain, contours, hillshade, slope (CC BY 4.0).
Vectors are stored in 1 km EPSG:25830 tiles (`data/vec/<layer>/<x>_<y>.json` + `index.json`); DEM and slope as Int16/Uint16 grids in their native 25 m EPSG:25830 grid. `data/manifest.json` lists every layer with source, licence, date, fields and the excluded inputs (with reasons).
Not published: PDFs, QGIS projects, QML files, NUMPOINTS layers, analysis reports.

## GIS download

One ZIP: GeoPackage (EPSG:25830 default or 4326, QGIS styles inside, `layer_status`, `field_dictionary`, `sources`), GeoJSON per layer (EPSG:4326) with `.qml`, `styles/`, README (language + English), `metadata.json`, and an IGN MDT25 GeoTIFF crop in its native 25 m grid.
Layers: study_area, buildings, streets, landuse, parks_open_space, public_facilities, transit_stops, pois_all, facilities, photos_commons, climate_cell, **sections, section_profile, section_cuts, area_indicators**. From the comparison workspace the same package covers 2–4 areas with `area_no` / `area_name` on every feature.

## Validation

- `node tests/geometry.test.js`, `clip.test.js`, `proj.test.js`, `export.test.js <dir>` then `python3 tests/validate_export.py <dir>/*` (independent GeoPackage/WKB/GeoJSON/GeoTIFF/QML checks, second projection implementation).
- `python3 tests/ui_test_v2.py <out>` — headless acceptance tests on the real `data/`: fixed layout in ar/he/en, citywide layers before any selection, area fitted between panels, gallery content, sections (two named sections, drag edits only the edited one, heights never invented), comparison of 2/3/4 areas, Exercise 1.2 (incomplete with 2, complete with 4, A3 PDF), single and multi-area exports, a v1 project still opening, terrain/boundary alignment.
- `python3 tests/import_test.py <supplied_data_dir> <out>` — Shapefile, GeoJSON, GeoPackage layer choice, QML, GeoTIFF, QGZ, persistence.

## Licences

MapLibre GL JS (BSD-3), sql.js 1.11.0 (MIT) vendored. IBM Plex (OFL 1.1) via Google Fonts. Map data © OpenStreetMap contributors (ODbL); IGN MDT25 © Instituto Geográfico Nacional (CC BY 4.0); GHSL © European Commission JRC.
