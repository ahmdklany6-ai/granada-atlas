# Granada Atlas — أطلس غرناطة — האטלס של גרנדה

Research tool for the studio *Urban Transformation as a Regional Laboratory* (SCE, 2026–27).
Interface in Arabic (RTL), Hebrew (RTL) and English (LTR); the choice is remembered per browser.

## Run it

Static website, no build step, no API keys.

- **Quickest:** open `index.html` in Chrome or Edge (internet needed for tiles and data).
- **Local server:** `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`.
- **Shared:** upload the folder to any static host (GitHub Pages, Netlify, Cloudflare Pages).

Projects live in the browser's storage. Use **Status → Download backup (JSON)** to keep or move them.

## What works

| Feature | Status |
| --- | --- |
| Map, Set Center, circle / square / custom polygon, numeric + drag editing, vertex add/move/delete, undo, save, reopen | works |
| Analysis from live sources; every figure marked documented / estimate / gap with source, date, scope, method | works |
| Retry per source, Overpass mirror fallback, refresh with changed-indicator list, area comparison | works |
| Map layers: heights, construction period, land use, street hierarchy, facilities, section line A–A′ | works |
| **GIS download**: GeoPackage, GeoJSON, GeoTIFF, QGIS styles, README + metadata | works |
| **Arabic / Hebrew / English** interface, RTL/LTR mirroring, remembered choice | works |
| Saving Commons photos to the image-wall materials | experimental |
| Exercise 1.2 equal-square sheets, 1.1 image wall, exercise upload, 1.3 identity card + PDF/PNG, research-question workflow | not built yet |

## GIS download

Button **Download GIS data** (study-area panel or top bar). One ZIP containing:

| File | Content |
| --- | --- |
| `granada_<area>.gpkg` | GeoPackage 1.3, one table per layer, QGIS default styles in `layer_styles`, plus `layer_status`, `field_dictionary`, `sources` tables. CRS: EPSG:25830 (default) or EPSG:4326. |
| `geojson/<layer>.geojson` + `.qml` | One file per layer, EPSG:4326 (RFC 7946); QGIS picks up the matching `.qml` automatically. |
| `elevation_glo90_epsg<crs>.tif` | Optional. Float32 GeoTIFF of Copernicus DEM GLO-90 values fetched from Open-Meteo at each pixel centre; NoData (−9999) outside the boundary. Native resolution ~90 m. |
| `styles/*.qml` | Same styles as separate files (including an alternative "construction period" style for buildings). |
| `README_<lang>.txt`, `README_en.txt`, `metadata.json` | Sources, licences, dates, CRS, clipping notes, limitations, field dictionary. |

Layers: `study_area`, `buildings` (whole footprints, centroid rule, `crosses_boundary`), `streets` (clipped exactly), `landuse` and `parks_open_space` (clipped exactly, Greiner–Hormann), `public_facilities`, `transit_stops`, `pois_all`, `section_line`, `section_points`, `photos_commons` (locations/metadata/links only), `climate_cell`.
Empty layers are written with zero features; unavailable layers (population, GTFS, Catastro, LST — not connected; or anything not fetched) are listed in `layer_status` and the README, never faked.
OSM layers need the raw data of the current analysis; after reopening a saved area the panel asks for a data refresh.

## Validation performed

- `node tests/geometry.test.js`, `tests/clip.test.js`, `tests/proj.test.js` — measurement maths, exact clipping (incl. 120 random concave cases), Transverse Mercator against the EPSG Guidance Note 7-2 worked example.
- `node tests/export.test.js <dir>` then `python3 tests/validate_export.py <dir>/*` — independent checks: GeoPackage core requirements, binary geometry/WKB decoding, envelopes and bounds, GeoJSON winding and counts, GPKG↔GeoJSON alignment through a second, separately written projection (Snyder), GeoTIFF tags and georeferencing against a known test surface, QML well-formedness.
- `python3 tests/ui_test.py` — headless browser: selection, editing, analysis with a failing source, layers, GIS download, language switching, save/restore, refresh (network stubbed).
- GDAL 3 (gdal3.js) opened a generated GeoPackage and GeoTIFF without errors; reprojection with PROJ matched to ≤ 5.5 mm.
- **Not yet done:** opening the files in desktop QGIS (QGIS was not available in the build environment). QGIS reads GeoPackage/GeoTIFF through the same GDAL, so the data side is covered; the `.qml` styles are checked for structure only.

## Licences

MapLibre GL JS (BSD-3) and sql.js 1.11.0 (MIT) are vendored. Map data © OpenStreetMap contributors (ODbL).
