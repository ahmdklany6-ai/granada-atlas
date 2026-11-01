# Granada Atlas — instructions for Claude Code

Read `HANDOFF.md` before changing anything: it holds the full requirements, history, open work and known issues.
`README.md` documents features, data and rendering rules for visitors and contributors.

## What this is
A static, trilingual (Arabic RTL · Hebrew RTL · English LTR) urban-analysis website for the Granada urban design
studio (exercises 1.1–1.3, sections, comparison, Miro deliverables). No build step, no server code, no API keys.
Live at https://ahmdklany6-ai.github.io/granada-atlas/ (GitHub Pages, branch `main`, repo root). Pushing to `main` deploys.

## Non-negotiable rules (from the owner)
- Free hosting only; keep the same public URL. Never give the owner a `localhost` or `file://` link as a result.
- Never claim something is published until the public URL has been checked after the Pages run succeeds.
- No credentials or private API keys in the repo or the client. Keys, if ever needed, live on a server.
- Each visitor's work stays in their own browser (localStorage / IndexedDB). No collaborative editing unless asked.
- Never commit saved projects, backups, personal research files, QGIS projects (.qgz/.qgs), QML styles, NUMPOINTS
  layers, reports or PDFs supplied privately. Publish only open-data layers and material whose redistribution
  rights are established. `.gitignore` already blocks the usual file types.
- Desktop layout is fixed in every language: the map fills the workspace; floating panels over it — Analysis LEFT,
  Study area and Layers RIGHT (independent, all closed at start). Opening/closing a panel never moves the map.
- Visual identity: red `#992B2A` with the owner's mood-board palette (cream, muted blues, olives, burgundies — see
  HANDOFF §3); IBM Plex Sans / Arabic / Hebrew. Colours come ONLY from `js/palette.js` (CSS reads its `--c-*`); legends must be generated from the same class definitions as the map (never hard-coded twice).
- Every string in all three languages (`GA.i18n.add({ key: [ar, he, en] })`, newest file `js/i18n_v8.js`).
  Numbers, units and coordinates stay left-to-right inside RTL text.
- Honesty about data: never invent heights, roofs, materials, widths, trees or any value and present it as fact.
  Estimates are labelled, schematic elements are named, missing data is shown as missing (never as zero).
- "Exported" is never "Uploaded to Miro": uploads are confirmed by the user by hand (`js/submission.js`).
- Reference images the owner shares are inspiration for clarity only — never copy their composition or identity.

## Working conventions
- Every release: bump the build in `version.json` AND `index.html` (`window.GA_BUILD` and every `?v=` query) —
  `tests/ui_test_v4.py` checks they agree. Data changes also bump `dataVersion` in `data/manifest.json`.
- Run locally: `python3 -m http.server 8000` in the repo root (for your own testing only).
- Tests: `for t in tests/*.test.js; do node $t; done` and `python3 tests/ui_test_vN.py` (N = 2…9; Playwright +
  Chromium; v6 and v8 take 10–20 min). Run browser suites ONE AT A TIME (parallel runs crash the headless GPU).
- Check exports by opening them (pdfinfo/pdffonts/pdftoppm, Pillow, XML parse, sqlite, `tests/validate_export.py`).
- After pushing: wait for the "pages build and deployment" run, then verify the live URL (hard-reload; the build
  guard reloads returning visitors onto the newest build).
- Commit messages describe the user-visible change; one build per commit series.
- Keep the owner's saved work safe when testing on the live site (save/restore localStorage, never overwrite).
