# Data pipeline

## build_app_data.py (current: researcher deliverables → app JSON)

Since July 2026 the app's primary data comes from the researcher's files in
`researcher data/`. `build_app_data.py` (stdlib-only Python) converts them to
the JSON the app imports:

| Output (src/data/) | Source file | Contents |
|---|---|---|
| `bls_series.json` | `bls_indexed_mar2025.csv` | BLS import price indexes by HS4, monthly since Jan 2023, rebased to **March 2025 = 100** (183 series). |
| `products_by_country.json` | `product_us_share.csv` | Country × HS4 pairs meeting the ≥10% US-export-share rule (OEC 2024 data; 220 countries, ~28k pairs), with US-bound export values. |
| `exempt_share.json` | `exemptions_annex_ii_list.xlsx` | Import-value-weighted % of each HS4 exempt from tariffs (Annex II). |

```bash
python3 scripts/build_app_data.py
```

The app's data layer is `src/data/tracker.ts`.

## fetch_import_values.py (current: Census monthly imports, all countries)

Monthly total U.S. goods imports from every partner country (the country-level
YoY chart), via the Census International Trade API — one request per year,
Schedule C codes mapped to ISO3. Needs `reference/census_apikey.txt`.

```bash
python3 scripts/fetch_import_values.py   # writes src/data/import_values.json
```

## fetch_tracker_data.R (legacy: API pulls)

`fetch_tracker_data.R` pulls tracker data from the BLS/Census/Comtrade APIs and
writes `src/data/tracker_data.json`. The app no longer reads it — kept for
reference.

## What it pulls

| App field | Source | Notes |
|---|---|---|
| `Product.priceSeries` | **BLS** Import Price Index API (`EIUIP<HS4>`) | Monthly index, re-based so `baseMonth` = 100. Published by HS good for **all** U.S. imports, not by origin country — so a given HS4 has the same series for every country. BLS only publishes a subset of HS codes; the rest come back empty. |
| `CountryData.importValue` | **U.S. Census** Intl Trade API (`imports/ctry`) | Monthly total U.S. imports from the country, USD bn. |
| `Product.importValueYTD` | **U.S. Census** Intl Trade API (`imports/hs`, `COMM_LVL=HS4`) | YTD U.S. import value for that country × HS4, USD bn. |
| `Product.shareToUS` | **UN Comtrade** (annual HS exports) | `exports to USA / exports to World` for the latest available year. Drives the ≥10% product-selection filter. |

The list of countries and HS4 products comes from
[`../src/data/products.json`](../src/data/products.json) — the single source of
truth. Census Schedule-C and Comtrade M49 country codes live there too.

## API keys

Keys live in `../reference/` (git-ignored). One per file, key string on line 1:

| File | Service | Required? | Get one |
|---|---|---|---|
| `reference/apikey.txt` | BLS | **Yes** | https://data.bls.gov/registrationEngine/ (already present) |
| `reference/census_apikey.txt` | U.S. Census | **Yes for import values** | https://api.census.gov/data/key_signup.html (free, instant) |
| `reference/comtrade_apikey.txt` | UN Comtrade | Recommended for shares | https://comtradeplus.un.org/ → register → free subscription |

Behavior when a key is missing:
- **BLS** missing → script stops (it's the core series).
- **Census** missing → import values/YTD are skipped (warned), prices still pulled.
- **Comtrade** missing → falls back to the keyless *preview* endpoint, which is
  heavily rate-limited (~1 request every few seconds, so the run is slow) and
  only serves data the free tier exposes. A key uses the authenticated endpoint
  and is much faster/more reliable.

## Run

From the repo root:

```bash
Rscript scripts/fetch_tracker_data.R
```

Outputs:
- `src/data/tracker_data.json` — consumed by the app.
- `scripts/output/products_summary.csv` — tidy table for inspection (git-ignored).

## Notes / caveats

- **Base period:** the R script re-bases to Jan 2025 = 100, but the app now
  uses the researcher's March 2025 = 100 series from `bls_series.json`; the
  R script's `priceSeries` output is no longer read by the app.
- **BLS coverage:** expect several HS4 codes to have no price index. Those
  products keep their import value/share but plot no price line.
- `legacy_fetch_harmonized_imports.R` is the original researcher script (BLS
  only), kept for reference.
