# Scripts

## build_app_data.mjs — the data pipeline

Converts the researcher's two CSVs in [`../data/`](../data/README.md) into
the JSON the app imports. Node only, no dependencies. Runs automatically at
the start of `npm run dev` and `npm run build`; run it by hand with
`npm run data`.

| Output (src/data/) | Source | Contents |
|---|---|---|
| `prices.json` | `data/PRICE_DATA.csv` | BLS import price indexes by HS4, monthly, March 2025 = 100. |
| `countries.json` | `data/COUNTRY_PRODUCT_DATA.csv` | Per country: summary tiles, monthly cumulative-YTD import YoY, and the tracked products (share, tariff status, average tariff, price change, YTD imports) as compact rows. Also the period the headline import total covers (`usImportsPeriod`). |
| `product_months.json` | `data/COUNTRY_PRODUCT_DATA.csv` (`country_product_month` rows) | Per country × HS4: monthly cumulative-YTD import YoY packed as `[firstMonth, [pct or null per month]]`. |

The app's data layer is `src/data/tracker.ts`; it is the only module that
reads these files.

It exits non-zero on structural problems (missing files or columns, duplicate
keys, a product whose HS4 has no price series) and prints warnings for
inconsistencies to raise with the researcher (counts that don't reconcile,
tariff labels that disagree with the numeric share, price changes that don't
match the series).

## build_world_map.mjs — world-map geometry for the home page

Precomputes SVG paths for the clickable country map from world-atlas
countries-110m (Natural Earth), keyed by ISO3. Needs the dev deps
`d3-geo topojson-client world-atlas i18n-iso-countries` (in package.json).
Rerun only if the projection or geometry source changes.

```bash
node scripts/build_world_map.mjs   # writes src/data/world_map.json
```

110m resolution omits microstates and small islands (plus city-states like
Singapore and Hong Kong) — those countries are reachable through the
searchable list only.

## Everything else in this folder is local-only and git-ignored

Earlier pipelines, kept on disk for reference but no longer used by the app:
`build_app_data.py` (July 2026 v1: OEC share CSV + BLS + exemptions
workbook), `build_app_data_v2.py` (July 30 2026 v2: Census-YTD share
experiment), `fetch_import_values.py` (Census API pull), and the original
R scripts `fetch_tracker_data.R` / `legacy_fetch_harmonized_imports.R`
(BLS/Census/Comtrade API pulls into `tracker_data.json`, which the app no
longer ships). API keys for those lived in `../reference/`.
