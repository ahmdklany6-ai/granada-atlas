# Granada Atlas — instructions for Claude Code

Read `HANDOFF.md` before changing anything: it holds the full requirements, history, open work and known issues.
`README.md` documents features, data and rendering rules for visitors and contributors.

## What this is
A static, trilingual (Arabic RTL · Hebrew RTL · English LTR) urban-analysis website for the Granada urban design
studio (exercises 1.1–1.3, sections, comparison, Miro deliverables). No build step, no server code, no API keys.
Live at https://ahmdklany6-ai.github.io/granada-atlas/ (GitHub Pages, repo `ahmdklany6-ai/granada-atlas`; publishing `main`
deploys). From 9 to 10 Nov 2026 the GitHub account was suspended and the site ran on GitLab Pages
(https://granada-atlas-597777.gitlab.io/, project `gitlab.com/ahmdklany6/granada-atlas`, frozen at 5.29 — no longer updated; HANDOFF §1).

## Non-negotiable rules (from the owner)
- Free hosting only; keep the same public URL. Never give the owner a `localhost` or `file://` link as a result.
- Never claim something is published until the public URL has been checked after the Pages run succeeds.
- No credentials or private API keys in the repo or the client. Keys, if ever needed, live on a server.
- Each visitor's work stays in their own browser (localStorage / IndexedDB). No collaborative editing unless asked.
- Never commit saved projects, backups, personal research files, QGIS projects (.qgz/.qgs), QML styles, NUMPOINTS
  layers, reports or PDFs supplied privately. Publish only open-data layers and material whose redistribution
  rights are established. `.gitignore` already blocks the usual file types.
- Layout (since 5.25, owner request): the map fills the screen in every language; one slim bar with a ☰ that opens the
  sidebar (research requirements, study areas, layers, historical maps, tools & pages, display, export) from the ☰
  side; the analysis panel floats bottom-left (bottom sheet on phones). Opening/closing anything never moves the map.
  The Analysis / Study-area panels still exist and open from the sidebar (`js/atlas.js`, HANDOFF §27).
  Since 5.29 (owner request): no zoom buttons (wheel / pinch / double-click / + − keys); Draw section + 3D in one row in
  the map's top-right corner; north arrow beside the scale bar bottom-left; three language buttons always in the top bar
  (end side); the five analyses + "no topic" always on screen (in the top bar ≥ 1200 px, a strip under it below).
- Opening page and story tour (since 5.27, owner request): the plain URL (no hash) always opens on the opening page
  (title, names, red "Start the tour", white "Open the map"; no "don't show again"); deep links skip it; `#/tour` reopens it.
  The tour (`js/tour.js`, HANDOFF §29) uses its own `tour-*` layers and never changes the visitor's saved layer state.
  Browser suites written before 5.27 import `tests/_nointro.py` (sets `window.__noIntro`); new suites that need the map
  first do the same (or open `?nointro`).
- City growth extents (since 5.28, owner request): a normal layer `city_growth` (Layers → History, `js/layers_growth.js`),
  OFF by default; nothing may start it by itself. Play / Pause / period / Hide everywhere go through `GA.growth` (one state).
- Visual identity: red `#992B2A` with the owner's mood-board palette (cream, muted blues, olives, burgundies — see
  HANDOFF §3); IBM Plex Sans / Arabic / Hebrew. Colours come ONLY from `js/palette.js` (CSS reads its `--c-*`); legends must be generated from the same class definitions as the map (never hard-coded twice).
- Every string in all three languages (`GA.i18n.add({ key: [ar, he, en] })`, newest file `js/i18n_v28.js`; add a new `i18n_vN.js` per build).
  Numbers, units and coordinates stay left-to-right inside RTL text.
- Honesty about data: never invent heights, roofs, materials, widths, trees or any value and present it as fact.
  Estimates are labelled, schematic elements are named, missing data is shown as missing (never as zero).
- "Exported" is never "Uploaded to Miro": uploads are confirmed by the user by hand (`js/submission.js`).
- Reference images the owner shares are inspiration for clarity only — never copy their composition or identity.

## Working conventions
- Every release: bump the build in `version.json` AND `index.html` (`window.GA_BUILD` and every `?v=` query) —
  `tests/ui_test_v4.py` checks they agree. Data changes also bump `dataVersion` in `data/manifest.json`.
- Run locally: `python3 -m http.server 8000` in the repo root (for your own testing only).
- Tests: `for t in tests/*.test.js; do node $t; done` and `python3 tests/ui_test_vN.py` (N = 2…28; Playwright +
  Chromium; v6 and v8 take 10–20 min). Run browser suites ONE AT A TIME (parallel runs crash the headless GPU).
- Check exports by opening them (pdfinfo/pdffonts/pdftoppm, Pillow, XML parse, sqlite, `tests/validate_export.py`).
- After publishing: wait for the GitHub Pages deployment, then verify the live URL with the `live-check` workflow
  (`workflow_dispatch`, script `live_atlas.py`; this sandbox cannot open *.github.io itself). Hard-reload; the build guard
  reloads returning visitors onto the newest build.
- Commit messages describe the user-visible change; one build per commit series.
- Keep the owner's saved work safe when testing on the live site (save/restore localStorage, never overwrite).
