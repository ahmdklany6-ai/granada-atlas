# Granada Atlas — handoff (state at build 5.19, 4 Nov 2026)

This document lets a new Claude Code session continue the project without the original chat. Short operating rules
are in `CLAUDE.md`; feature and data documentation is in `README.md`.

## 1. Status

| Item | Value |
| --- | --- |
| Repository | `ahmdklany6-ai/granada-atlas` (public), branch `main` |
| Live site | https://ahmdklany6-ai.github.io/granada-atlas/ (GitHub Pages, deploy from `main`, repo root) |
| Current build | **5.19** (`version.json`, `window.GA_BUILD` in `index.html`, all `?v=5.19` asset queries) |
| Latest feature work | Build 5.9: colour hierarchy, boundary layers, water/runoff, infrastructure, seasonal wind/rain, landmark geometries, print layout (see §13) |
| Deployment | see §12 (5.8 deployment record) |
| Data version | `2026-11-02-v8` in `data/manifest.json` (5.11: OSM trees 2 Nov 2026, ERA5 climate snapshot, history place texts) |

Build history (newest first): 5.19 print up to 700 dpi built in strips · 5.18 print at full resolution + "Map only" template · 5.17 / 5.16 Exercise 1.3 identity card · 5.15 one card format, historical extents · 5.14 current study area red on the locator · 5.13 olive tree cover, black study-area marks, complete analysis PDF, print scaling, PNOA blank detection · 5.12 historical place cards keep their grid with translation labels · 5.11 3D camera/terrain fix, opaque 3D, regional zoom, layers across zooms, climate snapshot, trees model + 3D trees, trilingual historical places · 5.10 legend placement, section trees in metres, street-detail view, historical framing and image cards, optional 3D · 5.9 colour hierarchy, infrastructure/water/climate layers, landmarks, print layout · 5.8 palette + grounded sections + floating panels · 5.7 street sections + submission states · 5.6 street-layer control, standalone sections,
classified climate rasters, dashed fabric marks, historical red dots explained · 5.5/5.4 smooth building scales and
street hierarchy at close zoom · 5.3 (v5) analysis page, viewers, unified Comparison, phone/iPad · v4/v3/v2 earlier.

## 2. The project and its users

An architecture / urban-planning student team in the studio *Urban Transformation as a Regional Laboratory* (SCE,
2026–27) studies **Granada, Spain**. The site is their research tool and deliverable factory:
map + study-area selection → fabrics (Ex 1.2) → image wall (Ex 1.1) → exercise management → city identity card
(Ex 1.3) → (not built yet) research question and interventions.

## 3. Requirements to keep (owner's standing instructions)

- **Hosting**: free; same public URL for every update; never hand over `localhost`/`file://` as a result; never
  claim publication before verifying the live URL.
- **Privacy**: no credentials in the repo; each visitor's work stays in their browser; no collaborative editing
  unless requested; do not upload personal research files or saved projects unless explicitly requested.
- **Data publication**: "Open-data layers only" — keep private the supplied PDFs, QGIS projects, QML styles,
  NUMPOINTS layers and reports. Only publish supplied material when redistribution rights and authorization are
  established. (A user-supplied bus-frequency file and Overture places were published at the owner's request; their
  licence notes are in the manifest.)
- **Layout (5.8)**: the map fills the workspace; three independent floating panels over it — Analysis physically LEFT,
  Study area and Layers physically RIGHT (separate tabs and states, stacked when both open), same places in every
  language. All start closed as labelled tabs; one click opens, one click closes; closing reveals the map at once (no
  reserved column); opening/closing never changes map view, layers, selection, results or unsaved input. Desktop: any
  combination open without overlap. Tablets: one side at a time. Phones: one bottom sheet at a time from the bottom bar
  (Analysis · Map · Study area · Layers) with a large close button.
- **Design / palette (5.8)**: red `#992B2A` with the owner's mood-board colours (cream `#E5E3DA`, light blue `#A9C0CB`,
  blue-grey `#9DBCD1`, chartreuse `#BFB065`, khaki `#A49250`, dark olive `#53461C`, oxblood `#5A1D22`, burgundy brown
  `#74362D`, deep wine `#452928`, dark brown `#29100C`), all in `js/palette.js` — the only place colours are defined.
  Light and restrained: cream backgrounds; red for primary actions, selection and cut outlines; blues/olives/burgundies
  for thematic classes; chartreuse sparingly (≤ 1 class on climate scales); sequential/diverging scales stay meaningful.
  Never recolour reference photos, historical maps or original service tiles. IBM Plex Sans (+ Arabic, Hebrew);
  reference images are references only, never templates.
- **Languages**: Arabic, Hebrew, English throughout UI, maps, legends, exports; no clipping; numbers/units LTR.
- **Legends**: generated from the same classification definitions as the map, in every place (main map, analysis
  cards, enlarged viewers, comparison, exports); legend swatches reflect displayed opacity.
- **Data honesty**: never invent values; estimates labelled; missing/uncovered data stated, never shown as zero;
  failed external services never block the page and offer Retry.
- **Viewers**: maps, photos, charts and sections open large with zoom/pan/pinch, inspection, export and Escape.
- **Fabric marks**: dashed outlines, no heavy fills, plain numbers (no circles/badges), consistent everywhere.
- **Climate maps**: restrained palettes, little yellow; legends synchronised; no cosmetic filters over external
  rasters with an unchanged legend.

## 4. Architecture (where things are)

Static ES5/ES2017 scripts loaded in order by `index.html` (no bundler). Key modules in `js/`:

| Area | Files |
| --- | --- |
| Shell, panels, selection, sections UI | `app.js` (floating panels: `GA.panels.set/isOpen/toggle`, body classes `left-collapsed` = Analysis closed, `right-collapsed` = Study area closed, `layers-collapsed` = Layers closed; `--lw-eff/--rw-eff` = covered width for overlays and `fitTo`), `selection.js`, `store.js` (localStorage project, backup/restore) |
| Map layers | `layers.js` (buildings: 50 m aggregation < z12.5, simplified `buildings_lite` 12.5–14.5, detail tiles ≥ 14.5; streets with progressive reveal), `layers_ext.js` (places, bus, canopy, trees, flood, noise, LST, history), `style.js` (basemap) |
| Classified external rasters | `rasterclass.js` (LST via bundled GIBS colormap `data/ref/gibs_lst_colormap.json`; flood, noise, tree cover re-classed; legends from the same tables) |
| Data access | `data.js` (manifest, 1 km chunked tiles, `alongLine` corridor loading), `ext.js` (external services) |
| Analysis | `analysis.js`, `report.js`, `gallery.js` + `gallery_ext.js` (cards), `mapcard.js` (canvas map renderer), `fabric.js` (analysis page), `compare.js` (Comparison + Ex 1.2 sheets) |
| Sections | `section.js` (compute + drawing for canvas/SVG/PDF, map drawing tool), `section_view.js` (large viewer), `pdf.js` (raster pages + `vectorPainter`) |
| Exercises / studio | `ex13.js`, `studio.js` (Miro squares, climate board, schedule), `exercises.js` (requirements), `submission.js` (four states) |
| Palette | `palette.js` (loaded in `<head>`; writes `P.ui` as `--c-*` CSS custom properties; groups: `ui`, `landuse`, `band`, `period`, `tier`, `poi`, `fac`, `places`, `bus`, `choro`, `slope`, `elevRamp`, `lst`, `noise`, `flood`, `canopy`, `chart`, `section`, `material`, `mark`, `basemap`) |
| Other | `history.js` (historical explorer), `library.js` (image wall), `viewer.js` (viewers, `panZoom`), `fabricmark.js`, `i18n*.js` (newest `i18n_v8.js`) |
| 5.11 modules | `trees.js` (shared tree model: species/form/sizes recorded vs estimate, silhouettes), `trees3d.js` (3D trees), `regional.js` (locator below zoom 10), `view3d.js` rewritten (composite terrain, centre-elevation sync, opaque extrusions), `layers.js` legend states (failed → cause + Retry, not drawn at this scale → Zoom to layer), `i18n_v11.js`; `.github/workflows/live-check.yml` + `tools/verify/*.py` (runner-side checks against the public site and open data) |
| 5.10 modules | `view3d.js` (2D/3D switch, `gadem://` local terrain tiles from the MDT25 grid, extrusions), `i18n_v10.js`; `app.js` `placeLegend()`; `section.js` `windowProfile()` + metre-scale trees; `section_view.js` Full section / Street detail |
| 5.9 modules | `layers_v9.js` (water, infrastructure, climate layers via `GA.layersExtra`; `GA.climate.windStats/rainStats`), `printlayout.js` (`#/print`, `GA.printLayout`), `i18n_v9.js` |
| Tools | `tools/build_flow.js` (flow paths from the DEM), `tools/build_data.js`, `build_extra.js`, `build_trees.py`, `build_buildings_lite.js`, `build_terrain_display.js` (re-renders elevation/slope/building-floors display PNGs from the repo data in the palette colours and writes the class tables to the manifest) |

## 5. GIS layers (published, open data — see `data/manifest.json` and README for sources/licences)

Buildings (OSM, floors/periods), streets + major streets, land use, parks, water, admin (barrios/districts/
municipality, GHSL urban centre), facilities (health/education/stay, Overpass snapshot), bus stops + scheduled
service (26 Oct 2026), Overture places, mapped trees (OSM snapshot 31 Oct 2026), contours, IGN MDT25 terrain
(DEM, slope, hillshade), 100 m built grid, figure-ground raster. External live services: NASA GIBS LST, MITECO SNCZI
flood (WMS/WFS) and SICA noise, EEA tree-cover density, IGN historical maps/orthophotos, Wikipedia/Commons.
GIS export: GeoPackage/GeoJSON + QML styles (generated) + DEM GeoTIFF, EPSG:25830.

## 6. Exercises and Miro deliverables

- **Ex 1.1 image wall**: ≥ 40 visual materials with attribution; ≥ 5 "surprise" data points with source and year.
- **Ex 1.2 urban fabrics**: ≥ 4 fabrics numbered on the city map; equal square samples, same scale; five components
  per fabric (section, network, land use, heights, periods); section line on the plan; justification paragraph and
  one sentence per fabric; printable sheets (sources, years, north, scale) and PDF.
- **Ex 1.3 city identity card**: same square frame/scale/north on 5 maps (10×10 or 15×15 km, choice stated);
  identity page (names in Hebrew/English/Spanish, country, student names, population/area/density with year and
  source); each page: number, title, map, legend, scale, north, source/year, one sentence; sixth synthesis sentence;
  a different representation per topic; **one PDF and one image per page to Miro**.
- **Studio / Miro**: climate mapping uploaded to its Miro place before the 1 Nov lecture; five squares per student;
  all class materials organised in Miro before the field visit. No Miro integration exists — export here, upload by
  hand, then confirm. States are separate: *tools available · content completed · exported · uploaded to Miro*.
  The schedule year 2026 is provisional (the e-mail gives no year).

## 7. Street sections — latest requirements (build 5.7 implements them)

1. Architectural presentation: buildings both sides, terrain, street and sidewalks in one section; cut buildings
   with the muted red outline and white interiors; warm beige/brown background buildings with subtle textures only
   where documented; floor slabs, roof shapes, balconies, facade details only where data or user input supports
   them; line-weight hierarchy (strong cut, lighter elevations, delicate dimensions).
2. Accuracy: real footprints, available heights, terrain; never present invented roofs, balconies, materials, floor
   layouts or sidewalk widths as surveyed; schematic + labelled + user-editable when unknown; equal horizontal and
   vertical scales by default, any exaggeration clearly disclosed.
3. Trees and details: real mapped trees near the line with configurable projection distance; on-section vs projected
   distinguished; unknown species/canopy → neutral symbol, size marked schematic; a few subtle human figures for
   scale, never confused with observations.
4. Controls and annotations: draw A–B anywhere without a study area; move endpoints; reverse view; adjust background
   depth; no chart-style X axis or grid; scale bar, A–B labels, relevant elevation levels, a simple dimension chain
   for verified street/sidewalk widths; a locator map with line, endpoints, viewing direction; study areas dashed with
   plain numbers.
5. Viewing and export: click opens a large zoom/pan viewer; usable on phones and iPads; high-resolution PNG and
   vector PDF/SVG with sources, dates and estimation notes; ar/he/en without clipping or reversed measurements.

How 5.7 meets them is summarised in README ("Street sections (build 5.7)").

6. **Grounding (5.8, owner report of floating buildings)**. Cause found: background buildings were placed at the cut
   line's terrain height at the point opposite their centroid and drawn flat across their whole projected width, so on
   slopes their lower ends floated up to ~9 m above the drawn ground (and buildings near A/B took an unrelated
   elevation). Cut buildings were already at/below the terrain. Now: cut buildings stand on the lowest MDT25 ground
   between their facades (meeting the terrain there; slabs horizontal) with the uphill ground shaded + dashed and named
   schematic; background buildings (and trees behind the cut) stand on their own MDT25 ground (footprint + face towards
   the cut), drawn as a pale ground band with a legend item and note. Nothing is snapped to the foreground terrain.
   The owner's annotated screenshot (blue circles) did not reach the 5.8 session — verified instead on four lines
   (the three test lines + `[-3.5935,37.1800]→[-3.5935,37.1770]`, Albaicín, buildings at both ends), both directions.

### Reference image (inspiration only — NOT in the repository)
The owner shared a studio board (31 Oct 2026) whose lower panel is a street section "A–A – Vasilissis Olgas"
(Thessaloniki) with a small locator map. It is **inspiration for clarity and architectural detail only**: cut outline,
floor lines, a pitched roof, trees and cars on the street, a dimension chain of sidewalk/carriageway widths under the
street, level marks and a locator inset. **Do not copy its composition, colours (blue/beige identity) or layout.** The
image is not committed because its redistribution rights are unknown and the repository is public; attach it to the
Claude Code chat by hand if you want it in view.

## 8. Test results (last full run, 1 Nov 2026, build 5.8)

| Suite | Result |
| --- | --- |
| `tests/*.test.js` (geometry, clip, proj, export, dates) | pass |
| `ui_test_v2.py` | pass (0 failures) |
| `ui_test_v3.py` | pass except "no page errors": the RTL-text plugin (unpkg) cannot be downloaded in the test container — environment only, as at 5.7 |
| `ui_test_v4.py` | pass (incl. build check 5.8) |
| `ui_test_v5.py` | pass |
| `ui_test_v6.py` | pass |
| `ui_test_v7.py` | pass (LST check now reads the palette) |
| `ui_test_v8.py` | pass |
| `ui_test_v9.py` (new: panels, palette, grounding, exports, fabric numbers) | 91/91 |
| `import_test.py` | pass |

Map text (glyphs) is stubbed in the test container, so map labels — including the fabric-number layer — cannot be seen
rendered there; the layer, its data, position and style are tested, and its appearance must be checked on the live site.

Test lines used: narrow + sloping `[-3.5930,37.1752]→[-3.5930,37.1738]` (Calle Alamillos de San Cecilio, 5.8 m,
52 m rise); wide + trees `[-3.6004,37.1727]→[-3.5980,37.1727]` (Acera del Darro, 48 m, trees on and off the cut);
sloping mixed `[-3.5990,37.1792]→[-3.5975,37.1792]` (Calle Elvira → Albaicín, 38 m rise).

## 9. Known issues and limitations

- Data gaps: nearly all building heights are estimates (floors × 3 m; only 67 buildings have `height`); no sidewalk
  or carriageway widths in the data (facade-to-facade width comes from OSM footprints, ±1–2 m); roof shapes on ~1,300
  buildings; no materials/balconies in data; OSM trees incomplete (2 with height, 0 with crown); MDT25 (25 m) smooths
  street-scale slopes and has no kerbs.
- Section PDF is vector, but Arabic/Hebrew labels are embedded as images (not selectable). Ex 1.3 and climate-board
  PDFs are still image pages.
- Section endpoints are moved on the main map (Sections tab), not inside the viewer.
- Old test suites (v2–v8) assume panels open: `tests/ui_test_v2.py` `PANEL_HOOK` opens them after load (v9 disables it
  with `window.__noPanelHook` to test the real all-closed default).
- (Fixed in 5.8) Fabric numbers: one numbering everywhere = position in the saved list (`GA.fabricStyle.numberOf`),
  plain red number centred above the boundary's top edge. Deleting a fabric renumbers those after it.
- With a fabric open, "Draw section" attaches the new section to that fabric (close the fabric for a standalone one).
- The owner's annotated section (31 Oct/1 Nov, Cuesta de María de la Miel → Calle Pilar Seco, Albaicín) arrived after
  the first 5.8 commit; reproduced as `[-3.5942,37.1813]→[-3.5959,37.1813]` (same streets, end levels +762.1/+753.0,
  59.9 m facade gap vs 60.6 m in the screenshot — the owner's exact endpoints are not known) and checked both ways.
- The `clim.miroNote` string still says "change the status by hand"; it should say "confirm the upload".
- The schedule year (2026) is provisional.
- Browser tests are slow under software GL and must run one at a time; the in-app browser panel used for live checks
  pauses rendering when hidden (use JS checks, `map.redraw()`, or emulate a viewport).
- If NASA changes the GIBS LST colormap, update `data/ref/gibs_lst_colormap.json` (the LST legend then falls back to
  the service legend automatically if the table cannot be read).

## 10. Next tasks (suggested order)

1. Owner review of 5.8 (palette, grounded sections, panels) on real study streets, including the spots circled in the
   owner's screenshot; then owner review of the 5.7 sections on real study streets; refine from feedback (e.g. move endpoints inside the
   viewer; optional section title block; numbered fabric references consistent between locator and Comparison).
2. Vector PDF for Ex 1.3 pages and the climate board (reuse `pdf.vectorPainter`).
3. Fix the `clim.miroNote` wording; review all "status" strings for the four-state model.
4. Next studio stage: research question and interventions (not started).
5. Keep README/HANDOFF updated each build.

## 11. What did not transfer automatically

- The original claude.ai conversation itself (only this summary).
- The owner's browser data (saved fabrics, sections, notes, library images) — it lives in their browser; use
  **Status → Download backup (JSON)** to move it. Never commit backups.
- Private attachments: studio briefs (DOCX/PDF), the claude.ai Project documents, QGIS projects, PDFs, GIS files
  and the reference image — attach or copy them yourself when needed.
- claude.ai Project memory and the in-app browser panel used for live checks.
- GitHub push access on your machine (log in with `gh auth login` or your usual Git credentials).

## 12. Build 5.8 deployment record

- PR https://github.com/ahmdklany6-ai/granada-atlas/pull/1 merged into `main` as `7b6982c` (owner's authorisation, 1 Nov 2026).
- "pages build and deployment" run 22 for `7b6982c`: **completed, success**.
- `main` serves `version.json` = 5.8 and `GA_BUILD = '5.8'`.
- NOT yet verified on the public URL from the Claude session: the cloud environment's network policy denies
  `ahmdklany6-ai.github.io` (proxy 403 / DNS blocked). Next session: allow that host (environment → Network access →
  Allowed domains) or have the owner hard-reload the site and check Status → build 5.8, the cream/red palette, the three
  panel tabs, a sloping section and fabric numbers above saved fabrics.

## 13. Build 5.9 (owner requests of 1 Nov 2026) — status per feature

Legend: VERIFIED = tested in this repository's browser suites with the real published data; UNVERIFIED-LIVE = implemented,
works with test stubs, but its data comes from a live external service that the Claude environment cannot reach
(network policy: only GitHub/PyPI/npm), so it has never been seen with real data; NOT DONE.

| Feature | Status | Notes |
| --- | --- | --- |
| Red colour hierarchy (ramps, stops, bus frequency, trees, noise classes, land use, neighbourhood lines over choropleth) | VERIFIED (local data layers); noise colours UNVERIFIED-LIVE | noise tiles come from MITECO SICA, reclassified in the browser |
| Separate boundary layers (municipality outer, neighbourhoods red, districts + GHSL) | VERIFIED | districts/GHSL off by default to keep the legend compact |
| Construction period investigation | VERIFIED | source gap: 39 of 101,674 footprints dated; unknown hatched; Catastro named as the better source (not connected) |
| Railways and Granada Metro, stations | UNVERIFIED-LIVE | read from the basemap's OSM vector tiles (OpenFreeMap) |
| Water-supply / wastewater / stormwater NETWORKS | NOT DONE | no open dataset reachable; layer says "not connected" |
| Mapped canals, ditches, drains (OSM) | VERIFIED | not the municipal stormwater network (stated) |
| Terrain-derived flow paths | VERIFIED | computed offline from MDT25; approximation |
| Covered Darro route | UNVERIFIED-LIVE | drawn only where OSM tags tunnel/culvert in the basemap tiles; whether the Darro segment is tagged has not been seen |
| Seasonal wind rose | UNVERIFIED-LIVE | ERA5 via Open-Meteo, fetched by the visitor's browser; tested only with synthetic stubs inside the test runner — no synthetic or cached values are shipped in `data/` |
| Rainfall means | UNVERIFIED-LIVE | as above (1991–2020 daily) |
| Historical landmarks with footprints/polygons | VERIFIED geometry (published data); Wikipedia text UNVERIFIED-LIVE | |
| Images under the linked-place paragraphs | UNVERIFIED-LIVE | the article's own Commons lead image + author/licence; otherwise "no suitable image" |
| Additional historical maps (archive research) | NOT DONE | needs internet research; existing archive unchanged |
| Print workspace (A4–A1, orientation, margins, true scale, dpi, templates with slots: maps at own scales, legend, sections, analysis cards, wind rose, rainfall chart, uploaded images, captions, reorder, preview, PDF/PNG) | VERIFIED | measured scale within 0.5 % (A3 1:5,000 → 1:5,006; A2/A4 two maps at 1:5,000 and 1:10,000) |

Next session with network access (allow archive-api.open-meteo.com, *.wikipedia.org, commons.wikimedia.org,
upload.wikimedia.org, tiles.openfreemap.org, ahmdklany6-ai.github.io): open the live site and check the wind rose and
rainfall values against an independent source (e.g. AEMET normals for Granada airport), the metro line and stations, the
Darro culvert, and the place images; then research historical maps (IGN Cartoteca, Archivo Municipal, BNE, Real
Chancillería) and connect Catastro INSPIRE construction years.

## 14. Build 5.10 (owner requests of 2 Nov 2026)

| Request | Done | Notes |
| --- | --- | --- |
| Trees smaller than people in sections | yes | cause: schematic trees were drawn in fixed PIXELS; now metres on the drawing's scale (ellipse crowns, so VE applies equally); recorded height/crown kept; missing → editable schematic 6 m / 4 m crown, dashed, "not measured" |
| Legend hidden behind the Layers panel | yes | `placeLegend()` measures the free map space from the panels actually on screen; collapses to a "Legend" button with a compact scrollable panel when space is short; returns to its place when panels close |
| Long sections unreadable | yes | Full section / Street detail at the same true scale; Fit height / Fit entire section; pan by arrows, slider, overview strip; exports take the view on screen (title states "detail a–b m of L m"; locator highlights the stretch) |
| Optional 3D view | yes | terrain from the repository's MDT25 via a local tile protocol (flat at the edge outside the 20 km square — stated); extrusions: tagged height solid, floors × 3 m lighter "ESTIMATE", no data flat; Reset view; layers/fabrics kept |
| Consistent historical image cards | yes | 4:3 frames, subgrid-aligned rows, object-fit cover, click → full image viewer with author/licence |
| Frame the historical map on Granada | yes | fits the municipal boundary once per opening; "Zoom to Granada"; "Fit historical map" explains the IGN series are national (explorer min zoom 11) |

Still unverified with live data (network policy of the build environment): Commons images in the cards, IGN historical
tiles, OpenFreeMap tiles (rail/metro/culverts), Open-Meteo wind/rain — see §13.


## 15. Build 5.11 (owner requests of 2 Nov 2026)

How it was verified: this cloud environment cannot reach the public site, Open-Meteo, Wikipedia, Overpass or OpenFreeMap
(network policy; GitHub and S3 work). Everything needing the open internet ran on a GitHub runner through
`.github/workflows/live-check.yml` (`workflow_dispatch` input `script`, or a push to a `claude/**` branch touching
`tools/verify/`): results and screenshots (base64 JPEG between `===IMG` markers) are in the job log, fetched with
`gh api repos/OWNER/REPO/actions/runs/ID/logs`. Nothing from those runs is committed except the dated data snapshots below.

| Request | Done | Cause / notes |
| --- | --- | --- |
| 3D: huge triangles when zooming in | yes | MapLibre 4 samples the ground under the map centre only when an animation starts; the 3D switch animated before any terrain tile had loaded, so the centre stayed at 0 m while Granada lies at 650–800 m. Zooming in then put the camera inside the terrain. Now the centre elevation follows the ground on every move and tile load, and the tilt waits for the tile under the centre. Verified z15–18.8, pan, rotate, 2D↔3D ×2 |
| Opaque 3D buildings, measured vs estimate | yes | opacity 1; recorded `height` = blue-grey (`palette.extrude.measured`), floors × 3 m = floor ramp; no data = flat hatch. MapLibre sinks walls 10 m below the centroid ground: footprints on > 10 m of slope may show a gap — counted in the 3D note |
| Zoom out to Spain / Mediterranean / North Africa | yes | minZoom 3, `renderWorldCopies: false`, no bounds; country borders, country and sea names in the interface language; Granada locator + study-area dots below zoom 10 (`regional.js`) |
| No walls / stretched terrain outside the DEM | yes | `gadem://` tiles composite MDT25 (inside the 20 km square) with Terrain Tiles on AWS Open Data (Terrarium, CORS open), 600 m blend; fallback: smooth 3 km ramp to a flat reference level and terrain off below zoom 9, stated in the note |
| Layers disappearing when zooming out | yes | generic: every enabled layer is drawn, summarised (buildings 50 m raster, major streets, trees 250 m cells, locator) or its panel row and legend say "not drawn in detail at this scale" with **Zoom to layer**; never removed from the legend. Checked at zooms 4.3–17.6 |
| Wind and rainfall "Failed" | yes | diagnosed from a runner: the requests work (HTTP 200, CORS *), but Open-Meteo's free tier is 600 units/min and 5,000/h **per IP**; one wind request costs ≈ 52 units, one rain request ≈ 78, so repeated reloads exhaust it (HTTP 429). Fix: closed periods → shipped snapshot `data/climate/` (`tools/build_climate.py`, retrieved 2 Nov 2026; cell 37.25, −3.50; 87,672 h; 10,958 days); live API only as fallback. A failed layer shows cause + Retry, never its legend |
| Section trees, grounding, detail | yes | same metre scale as figures/buildings (5.10); now the shared model: recorded height/crown used, otherwise the shared editable illustrative size (dashed, "schematic"); silhouettes by species type; trunks on their own ground. No balconies/materials added (no evidence in the data) |
| Historical page language | yes | `wikiSummary` always asked es.wikipedia; now the interlanguage-linked ar/he/en article (snapshot `data/ref/history_places.json`, live fallback). Articles exist for ar 5/13, he 3/13, en 6/13 places; the rest are translations of the Spanish summary in `tools/history_translations.json`, labelled "translation … AI-assisted … check the original", the Spanish original one click away; source + CC BY-SA on every text |
| Trees: sources | yes | no open municipal inventory: opendata.granada.org (CKAN, 6 datasets), datos.gob.es and Junta de Andalucía list none for Granada (2 Nov 2026). OSM refreshed (2 Nov 2026): 7,426 trees + 139 rows; 67 species/genus, 435 leaf type, 2 heights, 0 crown diameters, 0 circumferences; 2 ambiguous `diameter` tags shown, not used |
| Trees: map, 3D, card, overview | yes | card: species, form (and its basis), leaf, height, crown, trunk — "recorded" or "Unknown · illustrative estimate"; 2D crowns at true scale from zoom 15.5; 250 m overview below 13; opaque 3D trees (≤ 2,500 in view, from zoom 15). Mapped data contains no palms or columnar trees, so those forms exist in code but appear nowhere on the map |

Local tests (2 Nov 2026, this environment, software GL): `node tests/*.test.js` (incl. new `trees.test.js`, 32 checks) pass;
`ui_test_v4` (build check 5.11), `ui_test_v10` (climate/history now test the live-API fallbacks; tree colour check updated to
the olive classes), `ui_test_v11` (3D check now reads the ground directly — `queryTerrainElevation` is relative to the centre
elevation in MapLibre 4, which is why 5.10's test passed with the bug), `ui_test_v9` (panels, palette, legends) and `ui_test_v12` (new) pass. Not re-run this build: v2, v3,
v5–v8. Browser 3D frames under software GL take up to minutes — `ui_test_v12` takes `SECTIONS=1,…,8` to run parts.

Remaining limitations: building heights remain mostly floor estimates (67 tagged heights); tree sizes are illustrative for all
but two trees; MDT25 is 25 m; the ERA5 cell (~25 km) is not station data (annual mean 511 mm in the cell; not checked here against AEMET station normals);
translations of Spanish summaries are AI-assisted and should be checked by a reader of the language.

### 5.11 deployment record and live verification

- PR https://github.com/ahmdklany6-ai/granada-atlas/pull/5 squash-merged as `d2593ee`; "pages build and deployment" run
  41503101651 succeeded. A GitHub runner fetched 70 files the page uses (code, styles, MapLibre, manifest, climate, history and
  tree data) from the public URL: all byte-identical to `main` `d2593ee` (`tools/verify/live_files.py`).
- Live in a browser on the runner (real services): build 5.11 served and running; wind and rainfall load from the shipped
  snapshot with no Open-Meteo request; their legends show the statistics; the Arabic historical page shows Arabic texts and
  real Commons images (screenshot in the job log).
- Not possible on the runner: moving the map with the real basemap in software WebGL did not finish within the job limit
  (an A/B probe, `tools/verify/hang_probe.py`, showed build 5.10 freezing the same way on the runner: the runner's software WebGL, not a regression). The same files rendered in this environment with
  real OpenFreeMap tiles and glyphs fetched by the runner (`tools/verify/fetch_tiles.py`) move in 1–2 s, so the map
  screenshots of 3D, the regional view, layers, climate and sections were made locally from the verified-identical files.
- 5.12 (follow-up): the translation label and the "Original text" fold took grid rows of their own on translated place
  cards (text and image out of line); label, text and original now share the card's text row.

## 16. Build 5.13 (owner review of 3 Nov 2026)

| Item | Status | Cause / change |
| --- | --- | --- |
| 1 Vegetation colours | fixed | `ext.js` TCD_CLASSES had hard-coded bright greens. Now from `palette.canopy` = #E5E3DA / #BFB065 / #A49250 / #53461C for 1–29 / 30–59 / 60–79 / 80–100 % (thresholds unchanged); 0 % = white veil (`canopyZero`), missing (> 100) = hatched (`tcdHatch`, also in `mapcard` via `raster.missing`). One table → live raster, cards, comparison, exports, all legends (`rasterClass.canopyLegend`). 3D trees / 2D crowns: `palette.tree3d` in the same olives; `palette.trees` olive. |
| 2 Study-area marks | fixed | `fabricmark.js`: black dashed boundary (`palette.mark.boundary` #161616) over a white under-stroke, width 3; bold number above the TOP-RIGHT corner (`topRight`, `cornerLL`), moved sideways with a leader line when crowded, never hidden (map layer `text-allow-overlap` + `ignore-placement`). Used by the main map, selection, saved areas, history explorer, cards, location maps, comparison (black, differing dashes), section locator, studio squares, viewer, GIS QML (black dashed outline). |
| 3 Analysis PDF | fixed | `fabric.exportPDF` drew card maps with a title only. Now `boardPages` + `js/boardexport.js`: each map panel = map at 2× (scale bar, north, boundary, number) + legend from `card.legend` + indicators with units/estimate flags + chart (`card.chart`, same data as the page) + findings + source/date + method/limits. Identity page lists contents and what was omitted. |
| 4 Print readability | fixed | Board text ≥ 19 px at 150 dpi (≈ 9 pt), body ≈ 10.5 pt; two panels per A3 page, a single panel goes wide; empty sections omitted (option "Include empty sections", `b.pdfEmpty`). Print workspace: all text × paper factor (A4 1, A3 1.41, A2 2, A1 2.83), legend auto-sized to its slot, empty slots omitted and the others reflowed (option "Keep empty slots"). |
| 5 Blank PNOA | fixed | IGN `PNOA2024` and `PNOA2023` are in the capabilities but return a 2,203-byte plain-white JPEG over Granada (runner check 3 Nov 2026; 2022 and older have imagery). Every historical image is checked (`blankness`); PNOA falls back to the most recent flight with imagery, labelled "PNOA 2022 — …"; anything else is an explicit "Image unavailable" frame with the reason. The export waits for all images (`ensureHistory`). |
| 6 Missing area 3 | fixed (cause reproduced) | With four test areas (3 = Almanjáyar, ~3 km north) build 5.12's location map showed 1, 2, 4: it was always framed on a 3.6 km square around the open area, and areas outside the frame were not drawn or listed. Now "Show all areas" (default on) frames every saved area; off, the page says which areas lie outside. The main map could also drop a colliding number (MapLibre collision) and canvas exports could push one off the frame — both removed. |

## 17. Build 5.14 (owner request of 3 Nov 2026) — current study area in red on the locator

The owner asked for one exception to the 5.13 black-mark rule, on the analysis-page **location map only**:

| Item | Change |
| --- | --- |
| Current study area | `fabric.js` `LOC_CUR` = red `#992B2A` (`palette.red`), dashed `[11, 6]`, width 4.2 (others 2.2); its number red and larger (`LOC_NUM` 30 px vs `fabricStyle.NUM` 22), still just above the top-right corner and drawn first so it keeps its corner. |
| Other saved areas | unchanged: black dashes (`palette.mark.boundary`) over a white under-stroke, black numbers (`palette.mark.number`, now passed explicitly). |
| Interiors | the 6 % red tint inside the current area was removed — every interior is transparent. |
| Legend | "Current study area" (red dashed swatch) / "Other study areas" (black dashed swatch), `v13.locCurrent` / `v13.locOthers` in `js/i18n_v13.js` (ar / he / en). Generated from the same `locLegend()` the map uses. |
| Where | the page locator (`drawLoc`), its enlarged viewer (same style; framed on every saved area via the new `viewer.map({ fitRings })`), the viewer's PNG / PDF exports and the analysis-board PDF. `mapcard.js` now passes a per-number `color` to `fabricStyle.numberAt`. |
| Not changed | the main map, cards, comparison, sections, studio squares and every thematic layer colour keep the 5.13 marks and palette. |

Test: `python3 tests/ui_test_v13.py` (locator in en / ar / he, viewer, PNG / PDF exports, board PDF; spies on `fabricStyle.strokeRing` / `numberAt` per canvas and counts #992B2A pixels in the outputs).

## 18. Build 5.15 (owner requests of 3 Nov 2026)

### A. One card format for every analysis map and export
Order, always under the map and never beside it: **title → map → legend → key indicators → chart → short interpretation →
source and method**. One renderer, `GA.boardExport.card` / `cardNeeds` (`js/boardexport.js`), is used by:

| Where | Change |
| --- | --- |
| Analysis PDF / section PNGs (`fabric.boardPages`) | The single-card "wide" page (map + sidebar, the construction-period page) is gone. Cards flow across consecutive map sections, two per A3 page; the page title lists the sections on it and each card carries a small section kicker. One export-wide metric set (`boardMetrics`): one column width, one title band, one map height for every card **and** the location map, so maps in a row share top and bottom edges and every map has the same size. A card that would run past the foot is drawn in compact form (fewer finding / method lines) — never clipped. A section PNG stacks all its pages. |
| Identity page | Location map as a card (title, map, legend, "outside the frame" note, source) in column 1; the area's rationale, key indicators and contents as a text card in column 2. |
| Enlarged viewer PNG / PDF (`viewer.composed`) | Same card at 1800 px (text × 1.5). |
| Single-card PNG (`app.exportCardPNG`) | Same card; the map keeps its exact true-scale size. |
| Print workspace (`printlayout.js`) | Slot titles above their item; a map's legend is drawn directly under the map in columns (`legendUnder`); a separate legend slot is dropped when the page has a map (the others reflow); default slots: map only. |
| Analysis page (CSS) | Card titles have a fixed two-line band so maps in a grid row align; legend, indicators, chart, findings, source / method stay under each map. |

Not changed (their own poster formats, by design): the Comparison board (`compare.js` — panels are already title → map →
legend → findings), the Exercise 1.3 Miro sheets (`ex13.js`) and the Studio climate board.

Tests: `tests/ui_test_v14.py` (section A: board in en / ar / he — at most two cards per page, one map size, rows aligned,
nothing past the foot, a single card keeps the card format, reading-start side; the real PDF is rasterised; viewer card).
`tests/ui_test_v10.py` updated for the print workspace's default (no legend slot).

### B. Historical Maps page
**Built-up extent per period** (`data/ref/history_extents.json`, built by `tools/build_history_extras.py`; the selected
layer maps to ONE outline or to an explicit "no reliable boundary"; the map source is replaced on every switch, never
accumulated). Red `#992B2A`: dashed = approximate reconstruction from a map / photograph, solid = GHSL. The legend box
shows the selected layer's own date range, the outline's date, method, area and source, and states that the thin black
line is today's administrative municipal boundary, not the historical city.

| Layer | Outline | Source and method |
| --- | --- | --- |
| Minutas 1870–1950 | none | Granada sheets dated 1895 (GetFeatureInfo): the city is a hatched mass on incomplete, misaligned sheets — not traceable. |
| MTN50 1st ed. 1875–1968 | 1932 | Sheet 1009 "Granada" (1932; south edge on 1026 "Padul", 1931): urban fill extracted by colour, merged across streets (`tools/hist_extent_mapfill.py`). Approximate. |
| MTN50 drafts 1910–1970 | 1910–1970 (undated) | Same method on the "catastrones" sheet 1009 — edition year "sin datos", so the range is shown, no year invented. |
| AMS 1956–1957 | 1956–1957 | Traced by hand on the orthophoto (`tools/hist_extent_ams56_trace.py`, ~50–100 m). Approximate. |
| 1973–1986, 1981–1986, 1997–1998, 1997–2003, PNOA 2004–2024 | GHSL 1975 / 1990 / 2000 / 2015 / 2020 | JRC GHS-BUILT-S R2023A, 100 m: cells ≥ 20 % built, contiguous with the historic centre, holes filled (`tools/hist_extent_ghsl.py`). 1975/1990/2000 from Landsat of that time; 2015/2020 modelled by GHSL from 2014/2018 observations (said in the legend). Where the epoch is not the layer's date, the legend says "nearest documented epoch". Crosses the municipal line where the city spread. |
| MTN25 1975–2003 | none | Sheet edition year not recorded here. |

Raw inputs (GHSL tiles, WMS snapshots, GetFeatureInfo dates, Commons candidates) come from
`tools/verify/hist_extent_fetch.py` on the GitHub runner (job log only; nothing private committed).

**Images in the landmark popups** (`data/ref/place_images.json`): image above the description, with a Historical /
Present-day tag, caption (ar / he / en), date (c. / before / range), author, licence and Wikimedia Commons link; click →
the image viewer at 1600 px. Layers before 1990 prefer the historical image, recent layers the present-day one. 7 places
have a dated historical image (Rijksmuseum albumen prints of the Alhambra, Generalife and Albaicín c. 1850–1900; Doré's
Sacromonte engraving, 1874; Laurent's cathedral nave, before 1886, and Plaza Nueva, c. 1871); the rest have only the
article's present-day image (labelled). Almanjáyar has none (its page image is a metro stop not tied to the neighbourhood)
→ clean note. A failing image is replaced by a note (never a broken image). Popups are capped in height and sit above the
map controls on phones. Rejected candidate: the "Spain (1895)" book image for the Alcaicería (subject not stated).

Tests: `tests/ui_test_v14.py` sections B/C (data integrity; every switch leaves exactly one or zero outlines and updates
the period; 13 popups per language at 1440 / 820 / 390 px; viewer; broken-image fallback; no overflow).
Live: `tools/verify/live_515.py` (workflow_dispatch `script=live_515.py`, parts a = board, b = history).

## 19. Build 5.16 — Exercise 1.3 City Identity Card (owner request of 3 Nov 2026)

`js/ex13.js` was rebuilt. It draws six A3 **portrait** pages (identity + 01–05) from processed layers in `data/ex13/`
(built by `tools/build_ex13.py`; raw inputs from `tools/verify/ex13_fetch.py` on the GitHub runner;
independent checks in `tools/check_ex13.py` → `data/ex13/checks.json`). The brief attachment was not received in
this session; the requirements came from the owner's message and §6.

**Shared frame, stored once** (`data/ex13/frame.json`): EPSG:25830 x 440750–450750, y 4110000–4120000 (10 × 10 km), map
250 mm → 1:40,000, grid north. Chosen because it holds 98.7 % of the municipality's built-up
surface (GHSL 2020); 15 km would add the last 1.3 % at 1:60,000, where footprints are unreadable. Every layer is
anchored to this corner; nothing is auto-fitted (test: same map box on all five pages, deterministic redraw).

**Page layout** (same on every page): number + title + question above; 250 mm square map with north arrow, scale bar
and scale; legend under the map (swatches = `GA.palette.ex13` arrays used by the map; numeric ranges and units);
indicators + small stacked chart; one sentence (generated from the data, replaceable by the students' own); sources,
data year, units and limitations; footer with the frame coordinates. Numbers in Arabic/Hebrew are wrapped in LRM marks
(Chrome's canvas ignores isolate/embedding controls); open-ended classes use words in RTL ("more than", "below").

| Map | Data (kind) | Representation | Key results |
| --- | --- | --- | --- |
| 01 Density | JRC GHS-POP R2023A 2020, 100 m — cells are **counts** (checked), density = count ÷ 0.01 km² (equal-area). **Modelled.** | 100 m cells, 6 classes 0–1,000 … > 30,000 residents/km² | 325,935 residents in the frame; peak 39,785/km²; 64.2 % above 10,000/km²; inside the municipality +4.0 % vs Padrón 2020 (233,648) |
| 02 Morphology | OSM buildings (23 Oct 2026) 4 m raster; gap check GHS-BUILT-S 2020 | figure-ground, probable gaps hatched (GHSL ≥ 25 % built, OSM < 5 %) | coverage 10.9 %; 94 gap cells (0.94 km²); agreement 96.0 % |
| 03 City centre | OSM shops, food & drink, banks/pharmacies/post, markets (Overpass 3 Nov 2026); 21 duplicates removed; no coordinate stacks | quartic KDE r = 300 m, 50 m grid, smooth bands (100–≥ 2,000 places/km²), peaks C1–C6 | C1 Centro–Sagrario 2,776/km² (563 places ≤ 300 m), inside the 1932 city; C2 Armilla (outside the municipality) 53 % of C1; Overture cross-check r = 0.97 |
| 04 Climate | Landsat 8/9 C2 L2 ST_B10 (USGS), 29 clear scenes JJA 2024–2026 ≈ 11:50 local, QA_PIXEL masking, ≥ 27 obs/pixel. **Land surface, not air.** | 90 m blocks (native 100 m), 7 classes < 40 … ≥ 51 °C; NDVI ≥ 0.4 outline | median 44.8 °C; dense built 47.8 °C; vegetated 40.9 °C; bare unbuilt land 48.4 °C (hottest) |
| 05 Human dimension | OSM squares/pedestrian areas, parks + named public gardens ≥ 1,000 m², markets, cafés, playgrounds, libraries/community centres; GHS-POP for reach | symbols + areas; inhabited cells > 300 m from a square/park/market in pale blue | 91.9 % of modelled residents within 300 m (straight line); opportunities, **not** observed presence; no pedestrian counts; bus timetable not used (licence not stated) |

**Identity page** (5.17: the population date is localised): Hebrew / English / Spanish names, country, editable student names (red "not entered yet" until typed —
never invented), population 233,975 (INE Padrón, 1 Jan 2025, via Wikidata Q8810), area 88.02 km²
(published; our OSM boundary 88.19 km²), density 2,658/km²; the unit is the **municipality
(INE 18087)**, stated, and kept apart from the frame (≈ 326,000 modelled residents). 16 km locator with the frame;
synthesis + research question (generated, editable).

**Documented historic core**: the official Conjunto Histórico (BIC) boundary is not available as open data here and OSM
maps UNESCO property 314 only as a site (Alhambra and Generalife outlines, Albaicín as a point). The centre map compares
with the built-up city on the 1932 MTN50 sheet (approximate reconstruction, §18) and draws the UNESCO components.

**Cross-checks** (`checks.json`): population area-weighted vs cell centres 0.07 %; coverage vector 10.89 % vs raster
10.9 %; C1 kernel direct 2775 vs grid 2776; Plaza Nueva LST raw 43.6 °C vs build
43.6 °C; reach nearest-distance 91.82 % vs buffer 91.9 %. The LST grid orientation was checked against
building coverage (r = 0.15 normal vs −0.18 transposed; NDVI vs coverage −0.51).

**Exports**: combined PDF (6 × A3 portrait), one PNG per page (2339 × 3307 px, 200 dpi) singly or as a ZIP, GIS ZIP
(10 GeoJSON layers in EPSG:4326 + README with sources/licences: GHSL CC BY 4.0, OSM ODbL, Landsat public domain).
Exports are recorded as "exported"; "Uploaded to Miro" is confirmed by hand (`GA.submission`).

Not changed: OSM building data itself (the figure-ground uses the existing 4 m raster). Tests: `tests/ui_test_v15.py`;
`ui_test_v3.py` / `ui_test_v8.py` updated (1:40,000; only student names can be missing).


## 20. Build 5.18 — print layout: no pixelation at 1:50,000, "Map only" template (owner request of 3 Nov 2026)

### Pixelation at 1:50,000 — reproduced, two causes
Reproduced with `compose()` in the test browser (A3 / A1 landscape, 150 / 300 dpi, 1:5,000 / 1:10,000 / 1:50,000) and an
instrumented `maplibregl.Map` (requested pixel ratio, container, the canvas really created, the visible layers):

| Cause | Evidence | Fix |
| --- | --- | --- |
| **Layer content (scale-dependent, the visible one).** A print map at 1:50,000 renders at zoom ≈ 12.2; below `LITE_Z` (12.5) buildings are the **50 m summary raster** `ly-bld_floors-ov` (`raster-resampling: nearest`) — one 1 mm square per 50 m cell on paper. | Edge profile of the map has a strong spectral peak at the 50 m period: 26–65 × the background before, 1.1–2.1 after. | `layers.js` `printPrepare(z)` + `printStyle(style, z)`: when a print map renders below 12.5, the raster is hidden and the simplified 1 m footprints (`buildings_lite`, citywide) are drawn with the same class colours; their interactive cross-fade (opacity 0 below 12.5) is replaced by the layer's own opacity. Legend unchanged (same classes). The export message says so. |
| **Resolution cap (every scale, hidden).** MapLibre 4.7's default `maxCanvasSize` is 4096 × 4096: it silently lowered the pixel ratio (A1: canvas 4096 px for a 4825 px frame → ≈ 127 dpi; A3 300 dpi → ≈ 262 dpi) while the footer reported the requested dpi; the page was also capped at 40 Mpx (A1 300 dpi → 225 dpi), and the map was stretched into its frame with smoothing. | Spy: canvas `[4096, 1849]` for css `[3088, 1394]` × 1.5625. | `printlayout.js` `renderMap`: renders the frame at **exactly** its page-pixel size. `maxCanvasSize` = the GPU limit (min of MAX_TEXTURE_SIZE, MAX_RENDERBUFFER_SIZE, MAX_VIEWPORT_DIMS, ≤ 16384); when the frame needs more, it is rendered in overlapping tiles (96 CSS px overlap, containers in multiples of 96 CSS px so every offset is a whole device pixel) at the same zoom and stitched 1:1. A canvas smaller than requested (driver) → smaller tiles, never a lower dpi. The page canvas is probed (write + read a pixel at the far corner) instead of a fixed cap; only a browser that cannot hold it (e.g. iOS Safari ≈ 16.7 Mpx) lowers the dpi, and then the footer, the message and `pl.dpiCapped` say so. The map image is drawn at whole-pixel positions without resampling. |

Scale: re-measured with MapLibre's own `unproject` on the rendered map (ground metres per CSS px × frame width) —
1:5,006 / 1:10,012 / 1:50,062–50,063 for 1:5,000 / 1:10,000 / 1:50,000; the scale bar is drawn from the nominal scale and
its length agrees with the measured one within 0.6 % (tested). Footer "resolution" line and message: the real map dpi
(`wPx ÷ frame width in inches`) and the number of render tiles.

Results in this environment (SwiftShader, GL limit 8192): A1 landscape 300 dpi → page 9933 × 7016 px (300 dpi, was 225),
map 300 dpi in 2 tiles; A3 300 dpi → map 300 dpi in one 5400 px canvas (was clamped to 4095). On a desktop GPU (limit
16384) most frames fit one canvas. Seams checked at 100 % (no offset or doubled features). Text labels in the test
container are stubbed (no glyphs), so label placement across a tile seam has not been seen rendered; tiles overlap by
96 CSS px so labels near a seam are placed with the same neighbours in both tiles.

### "Map only (no legend or info)" template
`st.template = 'maponly'` (`pl.tpl.maponly`, ar / he / en in `js/i18n_v16.js`): the page holds the map alone, filling the
paper inside the margins — no title, legend, text, sources, footer or logos. Its own scale (`st.mo.denom`, default
1:50,000) and three toggles, default on: north arrow, scale bar, study-area boundaries and numbers (off hides the
`saved-areas*`, `sel-*`, `fabric-no`, `measure-line` layers in the print map only). PNG and PDF, A4–A1, both orientations,
same full-resolution renderer. File name `granada_atlas_map_1-<scale>_<paper>_<orientation>`.

**Saved in the browser**: all print options (paper, orientation, margin, dpi, title, subtitle, template, slots with their
scales and captions, map-only options) persist in `localStorage['granada-atlas.print.v1']`; uploaded images are not stored
(their slots come back empty).

Test: `tests/ui_test_v16.py` (≈ 15 min): A3 / A1, 150 / 300 dpi, 1:5,000–1:50,000 — page and map at the requested dpi, no
clamped map canvas, sharpness vs a 2× down/up cycle ≥ 0.9 (upscaled ≈ 0.7), no 50 m periodicity, measured scale ± 0.5 %,
scale bar = measured scale, PDF embeds the full-size page; map only — page = map, white margins, no text except the scale
bar / north arrow, toggles, A4–A1 both orientations PNG / PDF, labels ar / he / en, options restored after reload.

## 21. Build 5.19 — print layout up to 700 dpi (owner request of 4 Nov 2026)

**Request**: 400 / 500 / 600 / 700 dpi besides 150 / 200 / 300, every paper size, both orientations, PDF and PNG, "Map only"
included; the chosen dpi must be the real dpi; render in tiles within browser limits, matching edges, labels placed once,
no giant canvas; memory freed per tile; progress, Cancel; wait for tiles; exact scale; warn before very large exports.

**How** (`js/printlayout.js`, `js/pdf.js` `buildStrips`, new `js/pngstream.js`, strings `js/i18n_v17.js`):
- `plan()` lays the page out once (legend sizes, map frames in whole page pixels, section image), then the page is painted in
  full-width **strips** (≤ 24 Mpx each, a multiple of 16 rows, never taller than a map region). Text, legend and frames are
  redrawn in each strip (the canvas clips them); each strip goes to a sink and is freed. No canvas ever holds the page
  (A1 at 700 dpi = 23,150 × 16,370 px = 379 Mpx).
- `mapRenderer()`: one offscreen MapLibre map per map frame, reused for every region; container = largest region + 192 CSS px
  overlap on every side, in multiples of 96 CSS px (whole device pixels at any integer dpi); all regions share one pixel grid
  (same zoom, centre offsets in exact CSS px), so neighbours meet without resampling. Region ≤ GPU limit (min of
  MAX_TEXTURE_SIZE, renderbuffer, viewport; capped at 8192). Each region is captured only after `settle()`: a frame drawn with
  style, sources and tiles loaded, checked twice a frame apart (polled — waiting for MapLibre's `idle` event stalled for 180 s
  per region when a move needed nothing new). Tiles not loaded within 3 min → the export stops with that reason.
- **Labels at seams**: MapLibre places labels per viewport, so labels cannot be "placed once" for a frame larger than one GPU
  canvas. Mitigation + proof: the 192 px overlap means labels near a seam are placed with the same neighbours in both
  regions, and after every region the labels placed in each shared seam band (`queryRenderedFeatures` on the symbol layers)
  are compared with the neighbouring region's; the export message reports "Labels at tile edges match (n checked)" or names
  the edges where a label differs. In this test container glyphs are stubbed (no labels render), so the check is only
  meaningful with real fonts — see the real-basemap run below.
- **PDF** (`pdf.buildStrips`): one JPEG (q 0.92) per strip, placed at exactly the chosen ppi; each strip carries 16 extra rows
  that the next strip covers (no hairline between images in viewers); the file is a Blob of parts (no single byte array).
- **PNG** (`pngStream`): rows streamed through `CompressionStream('deflate')` into IDAT chunks (RGB, 8 bit) — any page size;
  a browser without CompressionStream gets an explicit "use PDF" message. Unit test `tests/pngstream.test.js`.
- **Never a lower dpi**: `effDpi()` returns the requested dpi; the footer resolution line and the message state it. A device
  whose GPU cannot hold one region (+ overlap) at that dpi, or a canvas the browser refuses, stops the export with the
  reason (`v17.gpuSmall`, `v17.canvasRefused`).
- **UI**: dpi 150–700; progress "Rendering: tile i of n (strip s of S)…"; Cancel (no file; offscreen maps removed); above
  100 Mpx a warning with the page size, estimated MB and minutes, "Don't ask again" (saved in
  `localStorage['granada-atlas.print.v1'].noLargeWarn`) and a "Warn before very large exports" checkbox to turn it back on.
- **PDF geometry**: the strip images' pixel grid is scaled to the exact paper size (Wpt / Wpx, Hpt / Hpx — paper sizes are not
  whole pixels, so this differs from 72 / dpi by < 0.01 %): a viewer at the chosen dpi maps each image pixel onto one device
  pixel. Placing strips at exactly 72 / dpi made `pdftoppm` resample by 3,508 → 3,507.9 rows and softened the raster
  (sharpness 0.90 vs 1.02 on the embedded pixels); `pdfimages -list` reports the chosen ppi either way.

**Results** (this environment, SwiftShader software GL; a desktop GPU is several times faster):

| Export (landscape) | Page px | Strips | Map regions | PDF size | Time |
| --- | --- | --- | --- | --- | --- |
| A2 600 dpi 1:50,000 / 1:10,000 | 14,031 × 9,921 | 6 | 15 | 7.4 / 9.1 MB | 80 / 105 s |
| A2 700 dpi 1:50,000 / 1:10,000 | 16,370 × 11,575 | 8 | 20 | 9.2 / 11.0 MB | 122 / 149 s |
| A1 600 dpi 1:50,000 / 1:10,000 | 19,866 × 14,031 | 12 | 32 | 9.6 / 14.3 MB | 129 / 197 s |
| A1 700 dpi 1:50,000 / 1:10,000 | 23,177 × 16,370 | 16 | 55 | 12.0 / 17.4 MB | 197 / 280 s |

Every strip image is at the chosen ppi; measured scale 1:50,061 / 1:10,012; the 16 rows each pair of strips renders twice
are the same picture (mean difference 0.02–0.05 of 255, i.e. JPEG noise); no step across any tile edge in 100 % crops; no
blank region. With the **real OpenFreeMap basemap and label fonts** (tiles z12–14 and glyphs fetched on a GitHub runner by
`tools/verify/fetch_tiles_print.py`, served locally to the identical code) A2 600 dpi at 1:50,000 and 1:10,000 report
"Labels at tile edges match (22 edges checked)"; 100 % crops across a strip seam through "SAN MATÍAS" and a column seam in
the centre show whole, single labels.

**Live verification**: the runner's software WebGL cannot render the page with the real basemap (5.18's `live_518.py`
waited 75 min in boot — same as §15), so the live check is `tools/verify/live_files.py` (every file the public page loads
byte-identical to `main`) plus the real-basemap render above made locally from those same files.

**Not done / limits**: labels are checked and reported at seams, not forced (MapLibre has no global placement across separate
canvases); the check needs a feature's layer + properties to identify it. PNG pages above a few hundred megapixels open
slowly or not at all in many viewers (the warning says so; PDF recommended). Strip height (24 Mpx) and the 8192 px
region cap bound memory to ≈ 100 MB (strip) + ≈ 256 MB (GPU canvas).

Tests: `tests/ui_test_v17.py` (≈ 45 min here; `QUICK=1` A2 600 dpi only, `CASES=` picks exports), `tests/pngstream.test.js`;
`ui_test_v16.py`, `ui_test_v10.py`, `ui_test_v4.py` and the node tests pass.

**5.19 deployment record**: `main` `622616e`; "pages build and deployment" run 41771170217 succeeded; live-check run
41771256706 (`live_files.py` on a GitHub runner): 78 files the public page loads byte-identical to `main` `622616e`
(incl. `js/pngstream.js`, `js/i18n_v17.js`, `version.json` = 5.19).
