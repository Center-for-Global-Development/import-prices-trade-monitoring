# Tracker input data

The two CSVs in this folder are the tracker's only data inputs. They come
straight out of the researcher's R workflow (CGD, first delivered August 2026)
and are the canonical handoff format: when a new drop arrives, replace both
files here with the new versions, keeping the same file names, and rebuild.

```bash
npm run data     # validates the CSVs and writes src/data/prices.json + countries.json
npm run build    # runs `data` first, then the normal app build
```

The converter (`scripts/build_app_data.mjs`) fails loudly on structural
problems and prints warnings for softer inconsistencies worth passing back to
the researcher. Read its output after every drop.

## PRICE_DATA.csv

One row per HS4 × month. Product-level BLS import price index for **all** U.S.
imports of the HS4 (BLS does not publish by origin country), rebased so
**March 2025 = 100**.

| column | notes |
|---|---|
| `date` | first of the month, `YYYY-MM-DD` |
| `hs4` | 4-digit HS code, text (leading zeros matter) |
| `product` | HS4 display name |
| `price_index` | index value, Mar 2025 = 100 |

## COUNTRY_PRODUCT_DATA.csv

One long file; `record_type` says how a row is used and which columns are
populated. Blank cells are intentional. Percentages are already percentages
(33.2 = 33.2%). Dollar fields are raw USD. `cty_code`, `hs2`, `hs4` are text.
`country_iso3` is the country key.

**`country_summary`** — one row per country, feeds the overview tiles.

| column | notes |
|---|---|
| `us_imports_2024` | total U.S. goods imports from the country in 2024, USD |
| `qualifying_products_n` | HS4s where ≥10% of the country's exports go to the U.S. (OEC 2024), before requiring BLS data |
| `tracked_products_n` | qualifying products that also have a BLS series = number of `country_product` rows |
| `tariffed_products_n` | qualifying products with no Annex II exemption |
| `exempt_products_n` | qualifying products fully exempt under Annex II (partials sit in neither bucket) |
| `latest_import_yoy_pct` | latest cumulative-YTD YoY change in total imports from the country, % |
| `latest_import_period` | month that value runs through |

**`country_month`** — one row per country × month, feeds the import-value chart.

| column | notes |
|---|---|
| `date` | month |
| `import_yoy_pct` | cumulative YTD imports (Jan..M) vs the same months a year earlier, %. Precomputed; the site does not recompute YoY. |

**`country_product`** — one row per country × HS4, feeds the tracked-products
table and the price-chart product picker. Already filtered upstream to the
≥10% share threshold **and** to HS4s with usable BLS data.

| column | notes |
|---|---|
| `hs2`, `hs4`, `product` | chapter, product code (the join key to `PRICE_DATA.csv`), display name |
| `us_share_pct` | share of the country's exports of the HS4 going to the U.S., % (OEC 2024, capped at 100) |
| `exempt_share_pct` | share of the HS4's U.S. import value exempt under Annex II, % |
| `tariff_status` | preformatted: `Tariffed`, `Exempt`, or e.g. `80% exempt` |
| `price_date` | latest BLS month behind the price change |
| `price_change_since_mar2025` | latest index − 100, % |
| `us_imports_ytd` | U.S. imports of the HS4 from the country, Jan through `imports_ytd_date`, USD (0 is a real zero) |
| `imports_ytd_date` | last month included in `us_imports_ytd`; drives the table heading |

## Methodology constants not in the files

Set at the top of `scripts/build_app_data.mjs`: the share year (2024, OEC),
the 10% threshold, and the March 2025 = 100 base. Change them only when the
researcher's methodology changes.

## Known quirks in the August 2026 drop

- Countries with zero qualifying products (12 small territories) are dropped
  by the converter; 7 more have qualifying products but none with BLS data
  and appear with an empty table.
- Norfolk Island's monthly series ends Dec 2024, so its latest-YoY tile says
  so. Heard and McDonald Islands has a summary row with no data.
- The researcher still intends to subset to Tariff Tracker countries; until
  then small islands are present.
