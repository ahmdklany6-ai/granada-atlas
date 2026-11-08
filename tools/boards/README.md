# Southern-axis boards (build 5.21)

`data/boards/south_<board>_<ar|he|en>.jpg` are screenshots (Playwright, 2100 px wide at device scale 2, JPEG q88) of the
Arabic board pages kept here, with the strings replaced from `boards_i18n.py` for Hebrew and English (`dir`/`lang` switched).

- `escuzar_ar.html` — background images: `reg.png` = IGN WMS `wms-inspire/ign-base` layer `IGNBaseTodo-gris`,
  EPSG:4326 bbox 37.035,-3.830,37.195,-3.575, 2000×1570; `site.jpg` = IGN WMS `wms-inspire/pnoa-ma` layer
  `OI.OrthoimageCoverage` (PNOA, Aug 2022), bbox 37.055,-3.800,37.095,-3.740, 2000×1670. Overlays from
  `data/vec/escuzar_pole.json` and `data/vec/south_metro.json`.
- `metro_tram_ar.html` — `gris.png` = `IGNBaseTodo-gris`, bbox 37.118,-3.688,37.163,-3.608, 2000×1125; `../tram/v22.jpg` =
  IECA WMS `ideandalucia.es/wms/ortofoto_2022` layer `ortofotografia_2022_rgb`, same bbox. Overlays from
  `data/vec/south_metro.json` and `data/vec/tram_1931.json`; the percentages / distances on the cards were measured on
  those lines (metro 4,719 m; 82 % of it within 250 m and 54 % within 150 m of the 1931 tram; terminus ≈ 140 m from the
  1931 Gabia station; Churriana station ≈ 350 m from the metro).

All imagery CC BY 4.0 (IGN / IECA), map data ODbL (OpenStreetMap); each board prints its full source line.
