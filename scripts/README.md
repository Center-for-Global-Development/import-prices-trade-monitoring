# Data fetch pipeline

`fetch_tracker_data.R` pulls the real data that backs the tracker and writes
`src/data/tracker_data.json` (the shape the app consumes), replacing the dummy
data generated in `src/data/seriesByCountry.ts`.

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

- **Base period:** the app and this script use **Jan 2025 = 100**
  (`baseMonth` in `products.json`). The original proposal said Jan 2024 = 100 —
  change `baseMonth` if you want to match the proposal.
- **BLS coverage:** expect several HS4 codes to have no price index. Those
  products keep their import value/share but plot no price line.
- **Wiring:** the app currently still reads the synthetic data in
  `seriesByCountry.ts`. Switching it to read `tracker_data.json` is a separate
  step (not yet done).
- `legacy_fetch_harmonized_imports.R` is the original researcher script (BLS
  only), kept for reference.
