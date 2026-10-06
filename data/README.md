# Tracker input data

These two CSVs are the tracker's only data inputs. They come out of the
researchers' R workflow, already filtered and computed. The site only
reshapes them. This file explains what each column means. For how to load
a new drop, see [Updating the data](../README.md#updating-the-data) in the
main README.

General rules for both files:

- Percentages are already percentages (33.2 = 33.2%).
- Dollar amounts are raw USD.
- `cty_code`, `hs2` and `hs4` are text, and their leading zeros matter.
- Blank cells are intentional and mean "no value".

## PRICE_DATA.csv

One row per HS4 × month. Each row is the BLS import price index for **all**
US imports of that HS4, rebased so **March 2025 = 100**. BLS doesn't publish
these indexes by origin country.

| column | notes |
|---|---|
| `date` | first of the month, `YYYY-MM-DD` |
| `hs4` | 4-digit HS code |
| `product` | HS4 display name |
| `price_index` | index value, March 2025 = 100 |

## COUNTRY_PRODUCT_DATA.csv

One long file. The `record_type` column says what each row is and which
columns are filled in. `country_iso3` is the country key.

### `country_summary`

One row per country. These rows feed the summary tiles.

| column | notes |
|---|---|
| `us_imports_<YEAR>` | Total US goods imports from the country, USD. The year is part of the column name. If it matches the year of `latest_import_period`, the converter treats the value as year-to-date (Jan through that month). Otherwise it treats it as a full calendar year. The tile label follows automatically. |
| `qualifying_products_n` | Number of HS4s where ≥10% of the country's exports go to the US (OEC 2024), whether or not they have a BLS index |
| `tracked_products_n` | Number of qualifying products that also have a BLS index. Should equal the country's number of `country_product` rows |
| `tariffed_products_n` | Number of qualifying products with no exemption |
| `exempt_products_n` | Number of qualifying products that are fully exempt. The converter works out the partially exempt count as qualifying − tariffed − exempt, so the three tiles add up |
| `latest_import_yoy_pct` | Latest cumulative-YTD change in total imports from the country, % |
| `latest_import_period` | Month that value runs through |

### `country_month`

One row per country × month. These rows feed the "Import value" chart.

| column | notes |
|---|---|
| `date` | month |
| `import_yoy_pct` | Cumulative YTD imports (Jan..M) vs the same months a year earlier, %. The site doesn't recompute it |

### `country_product`

One row per country × HS4. These rows feed the tracked products table and
the chart pickers. They are already filtered to the ≥10% threshold **and**
to HS4s with a BLS index.

| column | notes |
|---|---|
| `hs2`, `hs4`, `product` | Chapter, product code (the join key to `PRICE_DATA.csv`) and display name |
| `us_share_pct` | Share of the country's exports of the HS4 that go to the US, % (OEC 2024, capped at 100) |
| `exempt_share_pct` | Share of the HS4's US import value that is exempt from the tariffs, %. Can differ by country for the same HS4. Blank when the pair is unclassified |
| `average_tariff_pct` | Average applied US tariff rate on the HS4 from this country, %: the mean of the HS10 rates within the HS4. Shown in the table. Blank when unclassified |
| `tariff_status` | Preformatted label: `Tariffed`, `Exempt`, or e.g. `80% exempt`. Shown as the table's status pill. Blank when unclassified |
| `price_date` | Latest BLS month behind the price change |
| `price_change_since_mar2025` | Latest index − 100, %. The converter carries it through as `priceChangePct`, but the site doesn't show it |
| `us_imports_ytd` | US imports of the HS4 from the country, Jan through `imports_ytd_date`, USD. 0 is a real zero |
| `imports_ytd_date` | Last month included in `us_imports_ytd`. Drives the table heading |

### `country_product_month`

One row per country × HS4 × month. These rows feed the "Import value by
product" chart. They use the same measure as `country_month`, per product.

| column | notes |
|---|---|
| `hs2`, `hs4`, `product` | As in `country_product` |
| `date` | Month |
| `import_yoy_pct` | Cumulative YTD US imports of the HS4 from the country (Jan..M) vs the same months a year earlier, % |

Rows exist only for months where the comparison is defined. A product with
no imports in the year-earlier months has no row for that month. So series
can start late or have gaps, and some tracked products have no rows at all.

## What to expect in the data

- **Countries with no qualifying products** get a summary row but nothing
  else. The converter drops them.
- **Tracked products without monthly rows:** several hundred tracked
  products, mostly with zero YTD imports, have no `country_product_month`
  rows. They don't appear in the "Import value by product" chart.
- **Unclassified products:** a few hundred `country_product` rows have blank
  `exempt_share_pct`, `average_tariff_pct` and `tariff_status`.
- **Short series:** some small territories' monthly series end well before
  the latest month (Norfolk Island stops in December 2024). The latest-change
  tile then shows that earlier month.
- **Rounding:** R rounds half to even, so a label like `12% exempt` can come
  from a share of 12.5. The converter allows half a point either way.
- **Name mismatches:** an HS4 can have slightly different names in the two
  files. The converter warns and uses the name from
  `COUNTRY_PRODUCT_DATA.csv`.
- **Tiny product flows** can swing by thousands of percent. The chart moves
  products above 500% into a separate panel.
