# Scripts

## build_app_data.mjs — the data pipeline

Converts the researcher's two CSVs in [`../data/`](../data/README.md) into
the JSON used by the app. Node only, no dependencies. Runs automatically at
the start of `npm run dev` and `npm run build`; run it by hand with
`npm run data`.

| Output (src/data/) | Source | Contents |
|---|---|---|
| `prices.json` | `data/PRICE_DATA.csv` | BLS import price indexes by HS4, monthly, March 2025 = 100. |
| `countries.json` | `data/COUNTRY_PRODUCT_DATA.csv` | Per country: summary tiles, monthly cumulative-YTD import YoY, and the tracked products (share, tariff status, average tariff, price change, YTD imports) as compact rows. Also the period the headline import total covers (`usImportsPeriod`). |
| `product_months.json` | `data/COUNTRY_PRODUCT_DATA.csv` (`country_product_month` rows) | Per country × HS4: monthly cumulative-YTD import YoY packed as `[firstMonth, [pct or null per month]]`. |

| `directory.json` | Both CSVs | Small eager country directory, product names, and period metadata. |
| `details/ISO.json` | Country/product CSV | One country summary, products, and product-month histories, fetched only when that country opens. |

To update the data, replace `data/PRICE_DATA.csv` and
`data/COUNTRY_PRODUCT_DATA.csv`, then run `npm run build`. This validates and
regenerates all payloads and creates the deployable `dist/`. Use `npm run data`
for generation alone. Commit the source CSVs and existing consolidated JSON
outputs; `directory.json` and `details/` are generated and gitignored. Removed
countries are cleaned from the generated detail directory automatically.

Vite emits prices and country details as separate, content-fingerprinted JSON
assets (including small files). Deploy the complete build together so metadata,
prices, and country histories stay in sync. Data updates need no component edits
or hand-maintained file lists. Shared prices load once per session; country
requests are cached in memory, and failed requests can be retried.

The app's data layer is `src/data/tracker.ts`; it is the only module that
reads these files.

It exits non-zero on structural problems (missing files or columns, duplicate
keys, a product whose HS4 has no price series) and prints warnings for
inconsistencies to raise with the researcher (counts that don't reconcile,
tariff labels that disagree with the numeric share, price changes that don't
match the series).

## build_world_map.mjs — world-map geometry for the home page

Precomputes SVG paths for the clickable country map from the World Bank
Official Boundaries (CC BY 4.0, low-resolution GeoJSON distribution;
https://datacatalog.worldbank.org/search/dataset/0038272), keyed by ISO3.
Needs the dev deps `d3-geo topojson-server topojson-client topojson-simplify`
(in package.json). The source zip is fetched into `scripts/.cache/` (git-
ignored) on first run. Rerun only if the projection, geometry source or
simplification thresholds change.

```bash
node scripts/build_world_map.mjs   # writes src/data/world_map.json
```

Why the World Bank set: Natural Earth (the earlier world-atlas source) draws
de facto control, which put Crimea inside Russia and left Somaliland,
Northern Cyprus and Kosovo as holes because they carry no ISO code. The World
Bank set follows UN cartographic practice and ships disputed areas (Western
Sahara, Aksai Chin, Arunachal Pradesh, Abyei, Demchok) and dashed / dotted
boundary lines as separate layers; the output carries those through as
`disputed` and `borders` so the map renders them hatched and dashed, with a
source note and the standard "boundaries do not imply" disclaimer under the
map. Taiwan is lifted out of China's polygon (the World Bank folds it in) so
it stays clickable, matching how US trade statistics report it.

The output omits islets under ~80 km² and territories that simplify away
(microstates, small island dependencies, Hong Kong, Macao, Singapore) — those
countries are reachable through the searchable list only.

## Everything else in this folder is local-only and git-ignored

Earlier pipelines, kept on disk for reference but no longer used by the app:
`build_app_data.py` (July 2026 v1: OEC share CSV + BLS + exemptions
workbook), `build_app_data_v2.py` (July 30 2026 v2: Census-YTD share
experiment), `fetch_import_values.py` (Census API pull), and the original
R scripts `fetch_tracker_data.R` / `legacy_fetch_harmonized_imports.R`
(BLS/Census/Comtrade API pulls into `tracker_data.json`, which the app no
longer ships). API keys for those lived in `../reference/`.
