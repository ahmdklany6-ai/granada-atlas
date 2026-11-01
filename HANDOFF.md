# Granada Atlas — handoff (state at build 5.8, 1 Nov 2026)

This document lets a new Claude Code session continue the project without the original chat. Short operating rules
are in `CLAUDE.md`; feature and data documentation is in `README.md`.

## 1. Status

| Item | Value |
| --- | --- |
| Repository | `ahmdklany6-ai/granada-atlas` (public), branch `main` |
| Live site | https://ahmdklany6-ai.github.io/granada-atlas/ (GitHub Pages, deploy from `main`, repo root) |
| Current build | **5.8** (`version.json`, `window.GA_BUILD` in `index.html`, all `?v=5.8` asset queries) |
| Latest feature work | Build 5.8: new palette, grounded street sections, three floating panels (commit message "Build 5.8: …"; see `git log`) |
| Deployment | see §12 (5.8 deployment record) |
| Data version | `2026-11-01-v6` in `data/manifest.json` (display rasters re-rendered in the new palette) |

Build history (newest first): 5.8 palette + grounded sections + floating panels · 5.7 street sections + submission states · 5.6 street-layer control, standalone sections,
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
| Tools | `tools/build_data.js`, `build_extra.js`, `build_trees.py`, `build_buildings_lite.js`, `build_terrain_display.js` (re-renders elevation/slope/building-floors display PNGs from the repo data in the palette colours and writes the class tables to the manifest) |

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

