# Granada Atlas — أطلس غرناطة — האטלס של גרנדה

Research tool for the studio *Urban Transformation as a Regional Laboratory* (SCE, 2026–27).
Interface in Arabic (RTL), Hebrew (RTL) and English (LTR); the choice is remembered per browser.
Live: https://ahmdklany6-ai.github.io/granada-atlas/
Continuing development: see `HANDOFF.md` (state, requirements, open work) and `CLAUDE.md` (working rules).

## Run it

Static website, no build step, no API keys. `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`.
Projects, notes, sections and private imports live in the visitor's own browser (localStorage + IndexedDB).
Use **Status → Download backup (JSON)** to keep or move a project. Nothing a visitor does is uploaded.

## Layout

The map fills the whole workspace. Three independent floating panels sit over it, in the same physical places in every language: **Analysis on the left**, **Study area** and **Layers on the right** (Layers stacked under Study area when both are open). Every visit starts with all three closed as small labelled tabs (Analysis top-left; Study area and Layers top-right); one click opens a panel, one click (or its ✕) closes it. Panels never resize the map, so position, zoom, selection, active layers, results and unsaved input are kept; map controls, scale, attribution, legend and north arrow move beside the open panels, and a selected area is fitted into the uncovered part of the map. Desktop: any combination open at once; panel widths can be dragged and are remembered. Tablets: one side at a time. Phones: one bottom sheet at a time from the bottom bar (Analysis · Map · Study area · Layers), each with a large close button. Typeface: IBM Plex Sans / Sans Arabic / Sans Hebrew (SIL Open Font License), 15 px body text.

## Palette (build 5.8)

All colours are defined once in `js/palette.js` and read by the interface (written as CSS custom properties before first paint), the map layers, charts, sections, legends, exports and QGIS styles. The signature red `#992B2A` carries primary actions, selection and architectural cut outlines; it is combined with the owner's mood-board colours — warm cream `#E5E3DA`, light blue `#A9C0CB`, pastel blue-grey `#9DBCD1`, muted chartreuse `#BFB065`, khaki `#A49250`, dark olive `#53461C`, oxblood `#5A1D22`, burgundy brown `#74362D`, deep wine `#452928`, dark brown `#29100C` — plus a few named tints/shades of them. Cream and light neutrals for backgrounds; blues for water and public uses; olives for green and trees; burgundies for religious/heritage and the high end of red ramps. Sequential scales stay in one hue family (heights: blush → red → wine; construction period: blue-grey, older = darker; slope: cream → wine; noise: cream → khaki → wine; tree cover: olive); land-surface temperature is diverging around cream; yellow/chartreuse appears at most once per climate scale. Baked display rasters (elevation, slope, 50 m building floors) are re-rendered from the published data with `node tools/build_terrain_display.js`, which also writes the same class tables to the manifest for the legends. Reference photos, historical maps and service tiles shown as originals are never recoloured.

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
| **v3** Places and activities (Overture, 19,842 points, clustered, category / confidence / closed filters, search) and scheduled bus service of 26 October 2026 (692 stops, trips per day or 7–9 window, route / level / scheduled filters, proportional symbols) as citywide layers, in analysis cards, comparisons and GIS exports | works |
| **v3** Environmental layers from live official services: SNCZI flood zones T10/T50/T100/T500 + ARPSI (MITECO), strategic noise Lden/Ln (MITECO SICA, 3rd round), Copernicus tree-cover density 2018 (10 m), MODIS land-surface temperature (1 km, one 8-day period), OSM mapped trees (dated snapshot, citywide) | works; a slow or failed service never blocks the analysis or fabric page — the source is named with a Retry button |
| **v3** Fabric pages (`#/fabric/<id>`): identity, maps, findings, photos, sections, IGN historical snapshots of the same extent, climate, research questions / responses, attachments; reorder / hide / caption; A3 PDF and single PNGs | works |
| **v3** General Information library (`#/library`): files, images, links, notes in IndexedDB on this browser only; tags, Unsorted, search, links to fabrics / exercises / themes, ZIP backup and import | works |
| **v3** Historical explorer (`#/history`): IGN georeferenced series (MTN50 1st editions, 1895 planimetry, 1956–57, 1973–86, 1981–86 flights, PNOA), opacity, swipe, date of the sheet/flight at the view centre, linked places, archive of non-georeferenced scans (publication date vs depicted period), collage | works |
| **v4** Sections: no distance axis (scale bar outside the drawing), cut buildings outlined red with white interior, estimates dashed, background paler by distance on the viewing side; mapped trees projected from a disclosed corridor on the viewing side (default 15 m, shown on the map), near (≤ 5 m) vs background by line weight, recorded height/crown to scale, otherwise fixed-size schematic symbols; PNG, SVG, PDF | works |
| **v3** Studio (`#/studio`): editable schedule + checklist, five Miro squares per student (Draft → Ready → Exported → Uploaded only when confirmed by hand), climate-mapping board, exercise registry, resources; Exercise 1.3 (`#/ex13`): identity page + five maps at one frame, scale and north, PDF + PNGs | works |
| **v5** Analysis results page (`#/fabric/<id>`, also `#/analysis/<id>`): large name, location map within Granada (neighbourhoods, landmarks, other fabrics, rivers, scale, north, legend), key indicators, results under seven headings with navigation; editing only in Edit mode; composed A3 PDF | works |
| **v5** Click-to-enlarge everywhere: result maps open an interactive viewer (drag, wheel, pinch, keyboard; legend, title, scale, north, source/date; click a feature for its attributes; PNG/PDF); photos and scans in an image viewer (pixels only); charts and sections enlarged; Escape/Close return to the same place | works |
| **v5** One Comparison workspace (2–8 fabrics, equal scale also when stacked) with the Exercise 1.2 checks and sheets in an expandable section; 2–3 fabrics are a comparison, ≥ 4 a complete submission | works |
| **v5** Sections: enlarged view with linked location map, vertical exaggeration buttons (×1 true scale … ×10), evidence-only or labelled illustrative detail; mapped roof shapes, roof levels, floors, underground floors, street crossings (surface, lanes → estimated width), green areas and watercourses from OSM; building annotations (roof, finish, wall material, balconies, openings) only with a stated source | works |
| **v5** Flood periods not modelled for a reach are shown as "Not modelled here" (never 0 %); places counted as "excluding those marked permanently closed" with known / unknown / closed counts; photo dates parsed reliably ("Date unknown" otherwise) | works |
| **v5** Phones: one top row with a Menu, full-screen Analysis / Map / Area & layers views from a bottom bar; tablets: one side panel at a time; explicit Finish / Undo / Cancel for polygon and section drawing | works |
| **5.8** Floating Analysis / Study area / Layers panels over a full-width map (all closed at start, independent, kept state); one shared palette for interface, maps, charts, sections, legends and exports; street sections grounded on sloping terrain (see below) | works |
| Population grid, education / unemployment data, municipal 2022 noise data, municipal tree inventory, GTFS route geometry, accessibility (network analysis), Google Street View imagery inside the tool | not connected — shown as gaps |

## Updates for returning visitors

`version.json` holds the build number, which must match `GA_BUILD` and the `?v=` query on every asset in `index.html` (checked by `tests/ui_test_v4.py`). A page loaded from an older cached `index.html` reloads itself once onto the newest build. Data files carry the manifest's `dataVersion`. Saved projects (localStorage) and the library (IndexedDB) are never touched by an update.

## Published data (`data/`)

Built by `tools/build_data.js` from the supplied open datasets (the originals are not in this repository):
OSM buildings, streets, land use, parks, rivers, bus stops, neighbourhood/district/municipal boundaries (ODbL, extract of 23 Oct 2026); facility snapshot via Overpass (30 Oct 2026, ODbL); JRC GHSL urban centre; IGN MDT25 terrain, contours, hillshade, slope (CC BY 4.0).
Vectors are stored in 1 km EPSG:25830 tiles (`data/vec/<layer>/<x>_<y>.json` + `index.json`); DEM and slope as Int16/Uint16 grids in their native 25 m EPSG:25830 grid. `data/manifest.json` lists every layer with source, licence, date, fields and the excluded inputs (with reasons).
`tools/build_trees.py` decodes `tools/trees_osm_snapshot.txt` (OSM natural=tree / tree_row in the municipality, Overpass, 31 Oct 2026) into `data/vec/trees_osm.json`. `tools/build_extra.js` builds `data/vec/places.json` (Overture Maps Places, CDLA-Permissive-2.0), `data/vec/bus_service.json` (supplied schedule file of 26 Oct 2026), a 100 m built-density grid and a 4 m figure-ground raster. `data/ref/` holds two figures from Silveira et al. 2025 (CC BY 4.0).

`tools/build_buildings_lite.js` builds `data/vec/buildings_lite.json` from the building tiles: every footprint, simplified per ring with Douglas–Peucker (1 m) and rounded to 1e-5°, with the floor band and start-date period precomputed. Display by scale (floors layer): below zoom 12.5 the 50 m aggregation (median floors per cell, labelled as aggregated); from 12.5 the simplified footprints, cross-fading with the aggregation up to 12.95; from 14.5 the full-detail tiles with building information. Each coarser layer stays drawn until the finer data for the view has loaded. The street hierarchy works the same way: major roads below 14.5, the full network (solid streets, dashed pedestrian ways) from 14.5, with widths that grow with scale.
Not published: the supplied PDF reports (noise, flood, education/unemployment, strategic environmental study), PDFs, QGIS projects, QML files, NUMPOINTS layers, analysis reports.

## GIS download

One ZIP: GeoPackage (EPSG:25830 default or 4326, QGIS styles inside, `layer_status`, `field_dictionary`, `sources`), GeoJSON per layer (EPSG:4326) with `.qml`, `styles/`, README (language + English), `metadata.json`, and an IGN MDT25 GeoTIFF crop in its native 25 m grid.
Layers: study_area, buildings, streets, landuse, parks_open_space, public_facilities, transit_stops, pois_all, facilities, photos_commons, climate_cell, sections, section_profile, section_cuts, area_indicators, **places, bus_service, trees, flood_zones**. From the comparison workspace the same package covers 2–4 areas with `area_no` / `area_name` on every feature.

## Validation

- `node tests/geometry.test.js`, `clip.test.js`, `proj.test.js`, `export.test.js <dir>` then `python3 tests/validate_export.py <dir>/*` (independent GeoPackage/WKB/GeoJSON/GeoTIFF/QML checks, second projection implementation).
- `python3 tests/ui_test_v2.py <out>` — headless acceptance tests on the real `data/`: fixed layout in ar/he/en, citywide layers before any selection, area fitted between panels, gallery content, sections (two named sections, drag edits only the edited one, heights never invented), comparison of 2/3/4 areas, Exercise 1.2 (incomplete with 2, complete with 4, A3 PDF), single and multi-area exports, a v1 project still opening, terrain/boundary alignment.
- `python3 tests/ui_test_v3.py <out>` — v3 layers before selection, filters/search, new cards and indicators, sections (red cuts, look direction, SVG), library persistence/backup, fabric page order/captions/PDF, history swipe/info/archive/collage, studio schedule/squares/climate board/registry, Exercise 1.3 PDF (6 pages), GIS export with the new layers (external services stubbed).
- `python3 tests/ui_test_v4.py <out>` — hanging/failing services (analysis and fabric page still complete, retry), Layers panel controls for the new layers, versioned data URLs, section corridor and no distance axis, exercise names in ar/he, no overflow at 390/820/1024 px in three languages.
- `python3 tests/ui_test_v5.py <out>` — data findings (flood availability, place wording, transport, photo dates), analysis page, viewers (zoom/pan/inspect/export/Escape), unified comparison (2 vs 4 fabrics), section view (VE ×1, detail levels, annotations need a source), touch drawing buttons, phone/iPad portrait and landscape in ar/he/en; every download is opened (pdfinfo/pdftoppm, Pillow, XML parse, SQLite).
- `python3 tests/ui_test_v6.py` / `ui_test_v7.py` / `ui_test_v8.py` — zoom cycles and building/street scales; street control, standalone sections, classified rasters and legends; section drawing language, viewer and exports.
- `python3 tests/ui_test_v9.py` — build 5.8: panels start closed and open/close independently in ar/he/en, never overlap, keep map view, layers, selection and unsaved input; iPad one side at a time; phone bottom sheets; palette colours shared by CSS, map paint, legends and rasters; every cut building meets the terrain and every background building stands on its own ground on four test lines in both directions; viewer, PNG, SVG and PDF checked.
- `node tests/dates.test.js` — date parsing.
- `python3 tests/import_test.py <supplied_data_dir> <out>` — Shapefile, GeoJSON, GeoPackage layer choice, QML, GeoTIFF, QGZ, persistence.

## Licences

MapLibre GL JS (BSD-3), sql.js 1.11.0 (MIT) vendored. IBM Plex (OFL 1.1) via Google Fonts. Map data © OpenStreetMap contributors (ODbL); IGN MDT25 © Instituto Geográfico Nacional (CC BY 4.0); GHSL © European Commission JRC.


**Sections without a study area.** “Draw section” on the map (and in the study panel) draws an A–B or multi-segment section anywhere; with no fabric open it is saved as a standalone section (`project.sections`), with a fabric open it belongs to that fabric. Only the 1 km building cells along the section's corridor are fetched (`data.alongLine`); parts of the line outside the terrain model or the published building data are reported, not drawn as empty ground. Standalone sections can be renamed, edited, enlarged, exported (PNG, SVG, PDF, GeoJSON) and later attached to a fabric.

**Classified external rasters** (`js/rasterclass.js`). Land-surface temperature (NASA GIBS), flood zones (MITECO SNCZI), strategic noise (MITECO SICA) and tree-cover density (EEA) offer no alternative styles, so tiles are read as data: each pixel colour is looked up in the service's published classification (the GIBS colormap XML, bundled in `data/ref/gibs_lst_colormap.json`; the GeoServer legend rules; the EEA raw 0–100 values) and redrawn in the atlas classes. Map tiles, analysis cards, Exercise 1.3 plates, studio plates and their legends all use the same class tables. If the LST colormap cannot load, the original tiles and the service legend are shown together.

**Fabric marks** (`js/fabricmark.js`): every fabric boundary is dashed, without heavy fills. Each fabric has one number everywhere — its position in the saved-fabrics list — written as a plain number in the studio red `#992B2A` with a white halo, centred just above the top edge of its boundary (no circle or badge): on the main map (MapLibre symbol layer that grows slightly with zoom and never overlaps another number), on analysis-page location maps and cards, in the Comparison (listed in number order whatever the selection order), on section locators and in every export.

**Historical explorer red dots**: present-day positions of the Spanish-Wikipedia articles listed under “Linked places” (coordinates from each article; two marked approximate). They are an overlay with its own toggle, legend and pop-up, not part of the historical scans.

**Street sections (build 5.7).** One drawing routine (`js/section.js`, `paint`) with three back-ends: canvas (screen, PNG at 3×), SVG and vector PDF (`js/pdf.js`, `vectorPainter`: paths and Helvetica text; Arabic/Hebrew labels as browser-shaped transparent images). Rules:
- horizontal and vertical scales equal by default; any exaggeration is chosen by the user, stated in the title and given its own vertical scale bar; no distance axis or grid — a scale bar, A–B marks, ground levels (MDT25) and a dimension chain instead;
- cut buildings: red outline, white interior; heights from OSM `height`, else floors × floor height (dashed top, noted); slabs at equal intervals from the floor count; roof shape only when tagged (height schematic unless roof levels are tagged); balconies, materials and openings only from user annotations with a source;
- background: buildings on the viewing side up to the chosen projection depth, warm beige and brown, paler with distance;
- **grounding (5.8)**: a cut building's base is the lowest MDT25 ground between its two facades (it meets the terrain there; slabs stay horizontal); on a slope the ground under its uphill part is shaded with a dashed ground line and named "ground under a building on a slope (schematic)" — the foundation is not surveyed. A background building stands on *its own* ground (MDT25 sampled at its footprint and along its face towards the cut), drawn as a pale ground band under it, so a building on higher ground behind the section reads as standing there instead of floating; trees behind the cut also stand on their own ground. Nothing is snapped to the cut line's terrain;
- street width = distance between the building faces on the cut, measured from the footprints; sidewalk widths only when the user enters them (marked *, with a source);
- trees at mapped positions: on the cut line (≤ 1.5 m) vs projected (≤ the chosen distance); size schematic unless height/crown is tagged;
- figures (1.75 m) are decorative and labelled as such;
- footer: title and scale statement, legend of what is present, estimation notes, sources and dates; locator plan (north up) with the line, A/B, viewing direction, projection band and saved fabrics (dashed, plain numbers);
- looking to the right of A→B mirrors the drawing (B on the left), as seen from that side.

**Submission states** (`js/submission.js`): tools available · content completed · exported · uploaded to Miro, kept separately for Exercise 1.3, the climate board and each Miro square. Exports are logged automatically; "uploaded" is only set by the user after a confirmation.
