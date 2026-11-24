# Data inventory — research tour (build 5.52)

Generated from `js/tour_research.js` (INV, MISS) and `data/ref/research.json` (sources). The same table opens from the **Data inventory** button on every tour card. Kinds: official data · historical data · spatial analysis · estimate / model · projection · hypothetical scenario.

## Datasets

| Data | Source | Year | Spatial resolution | Kind | Reliability | Chapters | Status |
|---|---|---|---|---|---|---|---|
| Population 1996–2025 | INE 2871 | 1996–2025 | municipality | Official data | high | 1 6 13 14 | used |
| Age × sex (pyramids) | INE 33570 | 2012, 2022 | municipality | Official data | high | 7 | used |
| Nationality | INE 33571 | 2022 | municipality | Official data | high | 7 | used |
| Demographic indicators | INE ADRH 31033 | 2024 | municipality | Official data | high | 7 13 | used |
| Income per person | INE ADRH 31025 | 2024 | municipality | Official data | high | 7 13 | used |
| Income by source | INE ADRH 31026 | 2024 | municipality | Official data | high | 7 | used |
| Rent index (2015 = 100) | INE IPVA 59060 | 2024 | municipality > 10,000 | Official data | medium | 6 | used |
| Tourist dwellings | INE VUT 39363 / 39366 | 2026 | municipality | Official data | medium | 6 13 | used |
| Employed by sector · activity | INE Census 69992 / 67078 | 2024 | municipality | Official data | high | 9 13 | used |
| Registered unemployment | SEPE open data | 2026 | municipality, monthly | Official data | high | 9 | used |
| Municipal outlines | IGN WFS | 2026 | 1:25,000 | Official data | high | all | used |
| Base outline | OSM way 130984030 | 2026 | ≈ 1 m | Official data | high | all | used |
| Aerodrome easements decree | BOE RD 511/1989 | 1989 | points | Official data | high | 4 11 | used |
| Buildings + construction year | OSM + Catastro INSPIRE | 2026 | footprint → 100 m grid | Historical data | medium | 2 5 | used |
| Floors | OSM building:levels | 2026 | footprint → 100 m grid | Spatial analysis | low | 2 11 | used |
| City growth extents | IGN MTN50 · AMS · JRC GHSL | 1932–2020 | ≈ 30–100 m | Historical data | medium | 2 | used |
| Aerial photographs | IGN PNOA histórico (WMS) | 1956–2024 | 0.5–1 m | Historical data | high | 2 5 | used |
| Climate normals, hot days, wind, rain | ERA5 (Open-Meteo) | 1991–2024 | 0.25° (≈ 25 km) | Official data | medium | 3 | used |
| Climate projection | CMIP6 HighResMIP (Open-Meteo) | 1950–2050 | ≈ 25–50 km | Projection | low | 3 14 | used |
| Surface temperature, NDVI | USGS Landsat 8/9 | 2024–2026 | 90 m | Spatial analysis | medium | 3 13 | used |
| Tree cover | ESA WorldCover | 2021 | 10 m | Spatial analysis | medium | 3 5 13 | used |
| Air quality (model) | CAMS Europe (Open-Meteo) | 2023–2025 | ≈ 10 km | Estimate / model | low | 3 | used |
| Noise (roads, rail, city) | MITECO SICA (WMS) | 2017–2022 | model grid | Estimate / model | medium | 3 11 | used |
| Flood zones T10–T500, DPH | MITECO SNCZI (WFS) | study dates vary | 1:5,000 | Official data | high | 4 12 | used |
| Waterways and acequias | OSM | 2026 | line | Official data | medium | 4 | used |
| Terrain flow paths | IGN MDT25 (computed) | 2026 | 25 m | Spatial analysis | medium | 4 | used |
| Land use | OSM landuse | 2026 | polygon | Spatial analysis | medium | 4 5 9 12 | used |
| Population grid | JRC GHS-POP | 2020 | 100 m | Estimate / model | medium | 7 | used |
| Schools, health | OSM (Overpass) | 2026 | point | Official data | medium | 8 | used |
| Shops, food, services | OSM (Overpass) | 2026 | point | Official data | medium | 8 | used |
| Squares, parks, playgrounds | OSM (Overpass) | 2026 | polygon / point | Official data | medium | 8 | used |
| Tourist accommodation | OSM (Overpass) | 2026 | point | Official data | medium | 6 | used |
| Bus stops and trips | City file + CTAN | 2026 | stop | Official data | medium | 10 13 | used |
| Metro 2026, tram 1931 | OSM · IGN MTN50 | 1931 / 2026 | line | Historical data | high | 10 | used |
| Walking routes, dead ends | OSM streets (computed) | 2026 | network | Spatial analysis | medium | 10 | used |
| 300 m band (1981) | BOE 1981 · OSM | 1981 / 2026 | polygon | Official data | medium | 11 | used |
| Places (Overture) | Overture Maps | 2026 | point | Official data | medium | — | not used in the tour |
| Trees (points) | OSM | 2026 | point | Official data | low | — | not used in the tour |
| Contours 10/20 m, slope, hillshade | IGN MDT25 | 2026 | 25 m | Official data | high | — | not used in the tour |
| MODIS surface temperature (live) | NASA GIBS | 2025 | 1 km | Spatial analysis | low | — | not used in the tour |
| Exercise 1.3 frames (city, Escúzar) | GHSL · Landsat · OSM | 2020–2026 | 50–100 m | Spatial analysis | medium | — | not used in the tour |
| Escúzar pole | OSM · operators | 2026 | polygon | Official data | medium | — | not used in the tour |
| Granada barrios | OSM admin | 2026 | polygon | Official data | high | 7 | used |

## Sources of the figures in research.json (source · year · kind · method)

- **pop** — INE — Cifras oficiales de población de los municipios (padrón), table 2871 · 1996–2025 · Official data · residents on 1 January each year (1997 not published) · <https://www.ine.es/jaxiT3/Tabla.htm?t=2871> · INE, free reuse with attribution
- **pyr** — INE — Estadística del Padrón Continuo, table 33570 (sex × 5-year age group) · 2012, 2022 · Official data · residents on 1 January; the latest year INE publishes by municipality and age · <https://www.ine.es/jaxiT3/Tabla.htm?t=33570> · INE
- **foreign** — INE — Padrón Continuo, table 33571 (nationality) · 2022 · Official data · residents with a foreign nationality ÷ all residents · <https://www.ine.es/jaxiT3/Tabla.htm?t=33571> · INE
- **demo** — INE — Atlas de distribución de renta de los hogares (ADRH), demographic indicators, table 31033 · 2024 · Official data · tax-register based; mean age, shares under 18 and 65+, mean household size, one-person households · <https://www.ine.es/jaxiT3/Tabla.htm?t=31033> · INE
- **incsrc** — INE — ADRH, income by source, table 31026 · 2024 · Official data · share of gross income from each source · <https://www.ine.es/jaxiT3/Tabla.htm?t=31026> · INE
- **vut** — INE — Viviendas turísticas en España (experimental statistics), tables 39363 / 39366 · 2026 · Official data · listings on Airbnb, Booking and Vrbo matched to the census of dwellings; experimental statistics · <https://www.ine.es/jaxiT3/Tabla.htm?t=39363> · INE
- **jobs** — INE — Censo de Población (annual), table 69992: employed residents by activity · 2024 · Official data · where the residents work by sector (place of residence, not of work) · <https://www.ine.es/jaxiT3/Tabla.htm?t=69992> · INE
- **act** — INE — Censo de Población (annual), table 67078: relation to activity · 2024 · Official data · unemployed ÷ (employed + unemployed), residents 16 and over (census definition, not the EPA rate, not SEPE registrations) · <https://www.ine.es/jaxiT3/Tabla.htm?t=67078> · INE
- **outline** — IGN — WFS unidades administrativas (au:AdministrativeUnit) · 2026 · Official data · official municipal limits, simplified to 5 m for display · <https://www.ign.es/wfs-inspire/unidades-administrativas> · CC BY 4.0 — © IGN
- **sp_outline** — IGN outlines × repository layers · 2026 · Spatial analysis · areas measured in EPSG:25830 inside the official outline
- **ghs** — JRC GHSL — GHS-POP R2023A, 2020, 100 m · 2020 · Estimate / model · modelled residents per 100 m cell, summed by cell centre inside the outline · <https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php> · CC BY 4.0
- **lst** — USGS Landsat 8/9 Collection 2 surface temperature (ST_B10), June–August 2024–2026, 30 clear scenes · 2024–2026 · Spatial analysis · median of the summer-median 90 m cells whose centre is inside the outline (≥ 60 % of the municipality inside the frame) · <https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature> · public domain
- **wc** — ESA WorldCover 2021 v200, 10 m, class 10 tree cover · 2021 · Spatial analysis · tree cells ÷ cells with data inside the outline (sampled every 30 m) · <https://esa-worldcover.org> · CC BY 4.0
- **lu** — OpenStreetMap landuse (supplied extract, 23 Oct 2026) · 2026 · Spatial analysis · mapped land-use polygons intersected with the outline; unmapped land is not counted · ODbL 1.0
- **reach** — GHS-POP 2020 × OpenStreetMap schools / health facilities · 2020 / 2026 · Spatial analysis · share of modelled residents within 500 m straight-line distance of a mapped facility — a spatial measure of proximity, not observed behaviour · CC BY 4.0 / ODbL
- **bus** — Bus stops and weekday trips (city file + CTAN consortium, Monday 26 Oct 2026) · 2026 · Official data · scheduled trips per day summed over the stops inside the outline (a trip is counted at every stop it serves) · see layer sources
- **periods** — OSM footprints + Catastro year of construction (INSPIRE Buildings, 2026) · 2026 · Historical data · buildings counted per 100 m cell by construction period; buildings without a year are shown as unknown
- **floors** — OpenStreetMap building:levels · 2026 · Spatial analysis · median floor count per 100 m cell; most footprints in the five towns have no floor count — those cells stay unknown
- **rain** — ERA5 reanalysis via Open-Meteo, cell 37.25 N 3.5 W · 1991–2020 · Official data · mean monthly precipitation over 30 years (a 0.25° reanalysis cell, not a rain gauge) · <https://open-meteo.com> · CC BY 4.0
- **wind** — ERA5 reanalysis via Open-Meteo, hourly 10 m wind · 2015–2024 · Official data · share of hours by direction the wind blows from (8 sectors); calm = below 1 m/s · <https://open-meteo.com> · CC BY 4.0
- **temp** — ERA5 reanalysis via Open-Meteo, daily 2 m temperature at the base · 1991–2020 (normals) · 1991–2024 (hot days) · Official data · monthly means of the daily maximum, mean and minimum; hot days = daily maximum ≥ 35 °C; tropical nights = minimum ≥ 20 °C. A 0.25° reanalysis cell: regional, not street-level · <https://open-meteo.com> · CC BY 4.0
- **cmip6** — CMIP6 HighResMIP (7 models) via Open-Meteo Climate API — daily maximum temperature at the base · 1950–2050 · Projection · annual mean of the daily maximum per model, high-emission forcing (HighResMIP, SSP5-8.5 after 2015); the band is the spread of the models. No downscaled series to 2076 was available to the atlas · <https://open-meteo.com/en/docs/climate-api> · CC BY 4.0
- **air** — CAMS European air-quality model via Open-Meteo (PM2.5, PM10, NO2) · 2023–2025 · Estimate / model · monthly mean of hourly model values at the base and at the city centre — a model on a ~10 km grid, NOT a measurement; no official monitoring station stands in the five towns · <https://open-meteo.com/en/docs/air-quality-api> · CC BY 4.0
- **sepe** — SEPE — Paro registrado por municipios (open data, first half of 2026) · 2026-06 · Official data · people registered as job seekers without work at the public employment service at the end of each month — registrations, not an unemployment rate · <https://sede.sepe.gob.es/es/portaltrabaja/resources/sede/datos_abiertos/datos/Paro_por_municipios_primer_semestre_2026_xls.xls> · open data (SEPE)
- **rd1989** — Real Decreto 511/1989, de 28 de abril — servidumbres aeronáuticas del Aeródromo Militar de Armilla (BOE 13 May 1989, pp. 14325–14326) · 1989 · Official data · reference point, runway 18-36 thresholds and helicopter area transcribed from the annex (geographic coordinates) · <https://www.boe.es/boe/dias/1989/05/13/pdfs/A14325-14326.pdf> · BOE (public)
- **flood** — MITECO — Sistema Nacional de Cartografía de Zonas Inundables (SNCZI), WFS gis.miteco.gob.es/geoserver/agua · 2026 (studies of different dates) · Official data · modelled flood extents for return periods of 10, 100 and 500 years, the preferential-flow zone and ARPSI reaches; buildings counted by footprint centre inside each extent (OSM, simplified) · <https://www.miteco.gob.es/es/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html> · MITECO open data

## Missing data (searched for, not found in an open, usable form)

- **Historic floods with dates and damages** — Searched: MITECO WFS (no historical-flood layer), BOE, university studies (no machine-readable catalogue).
- **Official aeronautical easement plans of the aerodrome** — RD 511/1989 gives the points; the plans were sent to the town halls and are not published.
- **Aircraft noise map** — SICA: no map for Armilla; the airports noise dataset covers Málaga, not Armilla.
- **Measured air quality in the five towns** — No monitoring station in the five towns; the CAMS model is used instead.
- **Municipal plans (PGOU) as GIS data** — Not available to the atlas as open data; the official expansion areas are therefore not drawn.
- **Housing sale prices by municipality** — Not collected in this build; the rent index (INE) is used.
- **Moves from the city to the towns (origin–destination)** — Without migration flows it cannot be shown that tourism pushes residents to the suburbs.
- **Daily travel behaviour** — No travel survey for the towns; access is shown as spatial analysis, not behaviour.
- **Drainage and water-supply capacity** — The operators’ network data are not open.
- **Jobs by place of work (including the base)** — The census counts workers where they live.
- **Buildings, heights and surfaces inside the base** — A military site: not mapped in detail in open data.
- **Crops by parcel** — SIGPAC parcels were not processed in this build.
- **Downscaled climate projection to 2076** — The open CMIP6 series used here ends in 2050.

## Chapters

1. Introduction — 4 slides (i2*, i1, i3*, i4)
2. Historical and urban evolution — 4 slides (h1, h2, h3, h4)
3. Climate and environment — 5 slides (c1, c2, c3, c4, c5)
4. Flooding and water — 4 slides (f1, f2, f3, f4)
5. Agriculture and landscape — 3 slides (a1, a2, a3)
6. Tourism and suburbanisation — 4 slides (t1*, t2, t3*, t4)
7. Population and demographics — 5 slides (p1, p2, p3, p4*, p5*)
8. Everyday life and services — 3 slides (e1, e2, e3)
9. Employment and economy — 2 slides (j1, j2)
10. Mobility and connectivity — 6 slides (m1*, m2*, m3*, m4*, m5, m6*)
11. Military air base and restrictions — 4 slides (b1, b2*, b3, b4)
12. Urban planning and infrastructure — 1 slides (u1)
13. The five towns compared — 2 slides (k1, k2)
14. The next 50 years, 2026–2076 — 3 slides (n1, n2, n3)

* a slide of builds 5.27–5.51, kept unchanged.
