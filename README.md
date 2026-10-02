# US Import Price and Value Tracker

A Center for Global Development (CGD) interactive that tracks how US tariffs
are showing up in import prices and trade flows, country by country.

The idea comes from Alberto Cavallo's work on tariff incidence. US importers
pay tariffs at the border. If the *border price* of a tariffed good falls, the
exporter is absorbing the tariff. If it holds steady, US importers and
consumers are paying. For each exporting country, the tracker shows the
evidence needed for that comparison. It is a monitoring tool, not a causal
estimate: prices also move with exchange rates, commodity prices and demand.

- **Research owners:** the CGD research team (research lead plus RA). They own
  the methodology, the data, and the policy dates shown on the charts.
- **Hosting:** a static site on Cloudflare Workers, embedded on cgdev.org in an
  iframe (see [Embedding on cgdev.org](#embedding-on-cgdevorg)).
- **Stack:** Vite, React 19, TypeScript, Tailwind 4, shadcn/ui (Radix), Recharts,
  React Router. There is no backend: all data is built into static JSON at
  build time.

## What the site shows

**Home (`/`)** has a searchable list of countries and a clickable world map.
The smallest territories appear only in the list.

**Country page (`/country/:iso`)**, from top to bottom:

| Section | What it shows | Source |
|---|---|---|
| Summary tiles | US imports from the country (YTD), counts of tariffed / partially exempt / exempt qualifying products, and the latest cumulative-YTD import change | `country_summary` rows |
| Price trends | BLS import price index lines for the country's tracked products, March 2025 = 100. Multi-select, with quick-selects by tariff status | `PRICE_DATA.csv` |
| Import value | Cumulative-YTD year-over-year change in all US goods imports from the country, one panel per year | `country_month` rows |
| Import value by product | The same measure for each tracked product, with the same picker as the price chart. Products above 500% get a separate chart so they don't flatten the main one | `country_product_month` rows |
| Tracked products | A sortable, searchable table with US export share, tariff status, average tariff rate and YTD imports, grouped by HS2 chapter | `country_product` rows |

Tariff-policy dates (`src/data/events.ts`) appear as dashed vertical lines on
every chart.

## Methodology

The researchers do all the analysis upstream in their R workflow. The site
only reshapes and displays their numbers and does no statistical work of its
own. Today the methodology is:

- **Qualifying product:** an HS4 product for which ≥10% of the country's
  exports go to the US (OEC bilateral data, 2024).
- **Tracked product:** a qualifying product that also has a BLS import price
  index. Only tracked products appear in the charts and table. The summary
  tiles count all qualifying products.
- **Prices:** BLS import price indexes by HS4, rebased to March 2025 = 100.
  They cover **all** US imports of the product, not just imports from one
  country, so a given HS4 shows the same line on every country's page.
- **Import values:** US Census data, shown as cumulative year-to-date change
  (Jan..M this year vs Jan..M last year), precomputed by the researchers.
- **Tariff status:** the import-value-weighted share of the HS4 exempt under
  the Executive Orders. 0% is *tariffed*, 100% is *exempt*, and anything in
  between is *partially exempt*. Reader-facing definitions are in
  `src/data/glossary.ts`.

The share year, the 10% threshold and the March 2025 base are constants at
the top of `scripts/build_app_data.mjs`. Change them only when the researchers
change the methodology.

## Updating the data

This is the most common maintenance task. The researchers deliver two CSVs.
Column-by-column documentation is in [`data/README.md`](data/README.md).

1. Replace `data/PRICE_DATA.csv` and `data/COUNTRY_PRODUCT_DATA.csv`, keeping
   the same file names.
2. Run `npm run data` and **read the output.** The converter stops with an
   error on structural problems: missing columns, duplicate keys, HS codes
   that lost their leading zeros, or a product with no price series. It
   prints warnings for softer inconsistencies to send back to the RA, such as
   counts that don't add up or labels that disagree with the numbers. A
   normal run ends with a summary line like
   `176 price series through 2026-07; 217 countries (210 with tracked products) …`.
3. Diff the input CSVs against the previous drop, even if the researchers
   didn't mention any changes. Past drops have renamed columns and reworked
   the tariff classification without notice. Check that the site's wording
   still matches what the numbers mean.
4. Run `npm run dev` and spot-check a few countries (for example, a large
   country like Mexico and a small one).
5. Commit the new CSVs together with the regenerated `src/data/prices.json`,
   then deploy.

Period labels such as "Jan–Jul 2026" and "through Jul 2026" come from the data,
so a routine drop needs no component edits. If the researchers add a column or
`record_type`, update the converter first, then `src/data/tracker.ts`.

## How the code fits together

```
data/PRICE_DATA.csv ───────────┐
data/COUNTRY_PRODUCT_DATA.csv ─┴─▶ scripts/build_app_data.mjs ─▶ src/data/
                                   (npm run data; also runs        ├─ directory.json   all countries' summaries (loaded on the home page)
                                    before dev and build)          ├─ details/ISO.json one file per country, fetched when its page opens
                                                                   └─ prices.json      shared BLS series, fetched once

src/data/tracker.ts   the only module that reads the JSON; exposes types,
                      loaders and period labels to the components
```

`directory.json` and `details/` are gitignored because they are rebuilt on
every dev or build run. Vite fingerprints every data file
(`assetsInlineLimit: 0`), so a new data deploy never mixes with cached old
data. Always deploy a complete `dist/`.

### Where things live

| Path | Purpose |
|---|---|
| `src/pages/Home.tsx`, `src/pages/CountryPage.tsx` | The two routes. The country page is lazy-loaded |
| `src/components/ChartCard.tsx` | Card with the expand/full-screen button used by every chart |
| `src/components/PriceTrendsChart.tsx`, `ImportValueChart.tsx`, `ProductImportChart.tsx` | The three chart types |
| `src/components/ProductPicker.tsx` | Shared product picker for the multi-select charts |
| `src/components/TopProductsTable.tsx` | Tracked products table (search, status filter, sorting, HS2 grouping) |
| `src/components/Term.tsx` + `src/data/glossary.ts` | Dotted-underline jargon terms with definition popovers |
| `src/components/SectionNav.tsx` | "Jump to" links on the country page |
| `src/components/WorldMap.tsx` + `src/data/world_map.json` | Home page map. Geometry is precomputed by `scripts/build_world_map.mjs` (see [`scripts/README.md`](scripts/README.md)) |
| `src/data/events.ts` | Tariff-policy dates drawn on the charts. Hand-maintained, and the researchers confirm each entry |
| `src/lib/tariffDash.ts` | Line dash per tariff status (T solid, E dashed, P dotted) |
| `src/lib/seriesColors.ts` | Stable colors for selected chart series |
| `src/index.css` | CGD brand tokens (`--cgd-*`), status colors, light and dark themes |
| `src/components/ui/` | shadcn/ui primitives. Edit them sparingly |

## Embedding on cgdev.org

The site runs inside an iframe on cgdev.org, and several features exist only
because of that. Test changes inside the embed, not just standalone.

- **Height:** an inline script in `index.html` posts the page's height to
  `https://www.cgdev.org` (`cgd-iframe-resize`, per the CGD Interactive
  Coding Standard). The iframe is as tall as the page and never scrolls
  itself.
- **So:** `#hash` links do nothing, which is why `SectionNav` uses
  `scrollIntoView`. A `position: fixed` overlay would be as tall as the whole
  page, and popovers near the bottom of the page get clipped. That is why the
  product picker opens inline and the definition popovers stay small.
- **Full screen:** the iframe doesn't grant `allow="fullscreen"`, and iPhone
  Safari doesn't support the Fullscreen API on elements, so `ChartCard`
  makes the chart taller in place instead. Expanded charts size themselves as
  `min(vh, px)` because inside the iframe `vh` is the whole page height.
- **Fonts:** Sofia Pro comes from CGD's Adobe Fonts kit, and Bitter from
  Google Fonts. If the kit is ever restricted to certain domains, text falls
  back to the system sans.

## Conventions

- **"US", never "U.S."** in site copy (CGD house style), except in direct
  quotes. This applies to copy the researchers send, too.
- Tariff status is labeled with words or the letters T/E/P, never color
  alone. Color and dash pattern only reinforce the label.
- Mark only the first use of a jargon term in each section with `<Term>`.
- Show missing values as "n/a".
- Write comments to explain *why* (researcher requests, iframe constraints),
  not what the code does.

## Running and deploying

```bash
npm install
npm run dev          # regenerate data, start the dev server
npm run build        # regenerate data, type-check, build dist/
npm run lint
npm run preview      # serve the built dist/ locally
npm run cf:preview   # build and run under wrangler (Workers runtime)
npm run deploy       # build and wrangler deploy to Cloudflare
```

Deploying needs Cloudflare access to the CGD account (`wrangler login`).
`wrangler.jsonc` serves `dist/` as a single-page app, so `/country/XXX`
falls back to `index.html`.

## Known data caveats

- 217 countries are shown. The converter drops 12 territories with no
  qualifying products. Seven countries have qualifying products but none with
  a BLS index, so their pages have an empty table and no product charts.
- 844 tracked products have no monthly import series because there were no
  imports in the year-earlier months to compare against. They don't appear in
  the "Import value by product" picker.
- Small product flows can swing by thousands of percent. That is why the
  >500% chart exists and why its note explains base effects.
- HS4 8708 has different names in the two CSVs. The converter uses the
  country file's name.
- The converter derives the partially exempt count as qualifying − tariffed −
  exempt. This assumes every qualifying product has an exemption share.

## Open questions with the researchers

- **Tariff classification:** the September 2026 drop changed many exempt
  shares, and the status now varies by country for the same HS4. Confirm that
  "exempt under Executive Orders" is still the right description.
- **Headline import figure:** `us_imports_2026` is read as year-to-date.
  Confirm that's the definition.
- **Not built yet, waiting on researcher input:** a price-change comparison to
  replace the dropped "price change since March 2025" table column (the field
  is still in the data as `priceChangePct`), the aggregate exempt-vs-tariffed
  price comparison, per-product tariff start/stop dates, and a designed
  tariff-status key (a placeholder ships today).

## Not in the repo

These are gitignored and kept only on the maintainer's machine:

- `researcher data/`: email attachments, the methodology doc
  (`Text for Website.docx`) and earlier data drops
- `reference/`: proposal docs and old API keys
- `scripts/*` other than the two `.mjs` scripts and the README: earlier
  Python and R pipelines that the app no longer uses
