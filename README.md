# US Import Price and Value Tracker

A dashboard monitoring how US tariff policy is playing out in import prices and
trade flows, built for the Center for Global Development (working name in the
researcher's docs: "CGD Trade Tracker"). The approach follows Alberto Cavallo's
work on tariff incidence: tariffs are paid at the border by US importers, so
whether *border prices* of tariffed goods fall (exporters absorbing the cost)
or hold steady (US importers/consumers paying) is the story. The tracker puts
the ingredients of that comparison on screen for ~220 exporting countries.

**Status: exploratory.** Data is loaded from one-time researcher deliverables
plus ad-hoc API pulls — there is no automated refresh pipeline yet, by design.

## What it shows

Pick a country on the home page; its dashboard has three cards:

1. **Tracked products** — the country's HS4 products that (a) sent ≥10% of
   their exports to the US in 2024 and (b) have a BLS import price index.
   Columns: export share to the US, tariff status under the Annex II exemption
   lists, cumulative price change since March 2025, and US-bound export value.
   Grouped by HS2 chapter, collapsed to 20 rows by default.
2. **Price trends** — BLS import price indices for those products, monthly
   since Jan 2023, indexed to **March 2025 = 100**, multi-select to compare.
3. **Import value** — year-over-year change in monthly total US goods imports
   from the country, as small multiples (one panel per year, 2024–2026, shared
   y-scale). Tariff announcement dates are marked on both chart types — the
   "frontloading" surges ahead of announcements are usually visible.

## Methodology (short version)

Follows the researcher's write-up in `researcher data/Text for Website.docx`:

- **Product selection**: country×HS4 pairs where exports to the US ≥10% of the
  country's world exports of that product (OEC bilateral data, 2024).
- **Prices**: BLS Import Price Indexes by HS4. These cover *all* US imports of
  a product, not imports from one origin country — a given HS4 shows the same
  price line on every country's page (the UI says so).
- **Import values**: US Census monthly bilateral totals, shown as simple
  monthly YoY (each month vs the same month a year earlier — not cumulative).
- **Tariff status**: Annex II exemptions are defined at HS8; the import-value-
  weighted share of each HS4 that is exempt gives a continuous "exempt share"
  (0% = tariffed, 100% = exempt, in between = partial).
- The tracker is a **monitoring tool, not a causal estimate** — prices also
  move with exchange rates, commodity prices, and demand.

## Data flow

```
researcher data/                      one-time researcher deliverables (gitignored)
├── bls_indexed_mar2025.csv     ──┐
├── product_us_share.csv        ──┼─▶  scripts/build_app_data.py  ─▶  src/data/{bls_series,
├── exemptions_annex_ii_list.xlsx ─┘                                  products_by_country,
└── Text for Website.docx  (methodology; not parsed)                  exempt_share}.json

US Census Intl Trade API  ─▶  scripts/fetch_import_values.py  ─▶  src/data/import_values.json
                              (needs reference/census_apikey.txt)
```

- `src/data/tracker.ts` is the app's only data layer; everything reads through it.
- `src/data/events.ts` — hand-maintained list of tariff-policy dates rendered
  as chart markers. **Placeholder** — the researcher owns the canonical dates.
- `scripts/` and `researcher data/` are deliberately gitignored until the
  pipeline stabilizes; the generated `src/data/*.json` files are committed, so
  the app builds without either.
- Legacy: `scripts/fetch_tracker_data.R` (BLS/Census/Comtrade pull for the
  original 10-country pilot) still works but nothing reads its output anymore.
  See `scripts/README.md` for details.

## Running it

```bash
npm install
npm run dev        # local dev server
npm run build      # tsc + vite build to dist/
npm run deploy     # build + wrangler deploy (Cloudflare Workers)
```

Regenerating data (only needed when inputs change):

```bash
python3 scripts/build_app_data.py       # researcher files -> app JSON (stdlib only)
python3 scripts/fetch_import_values.py  # Census -> import_values.json
```

Stack: Vite + React + TypeScript, Tailwind, shadcn/ui, Recharts.

## Known caveats

- BLS covers 183 HS4 products; qualifying products without an index are
  filtered out of the UI (the data files keep them, so a toggle is cheap).
- Six countries have zero priced products (North Korea, Sudan, South Sudan,
  Tokelau, Saint Pierre and Miquelon, Wallis and Futuna); their pages show
  only the import-value chart.
- Saint Martin has no Census import series (Census doesn't split the French
  side of the island). Palestine is the sum of Census's Gaza Strip + West Bank.
- The exemptions workbook is a snapshot — no per-product tariff start/stop
  dates yet, so tariff status is "as of the latest Annex II list".
- The ~1MB products JSON compiles into the JS bundle (~530KB gzipped total).
  Fine for now; lazy-load it if that changes.

## Open items (waiting on researcher input)

- Canonical list of tariff moments for `events.ts` (incl. what "July 24" is).
- Per-product import *value* change column (needs a Census country×HS4 pull).
- The "compare vs China" price inset — not buildable from current data since
  BLS indices aren't by origin country; needs either a basket-weighted
  reframing or a China-specific price source.
- Per-product tariff start/stop dates for on-chart dots/dashed segments.
- Tariff-status key design (placeholder key ships under the products table).
- Exempt-vs-tariffed aggregate price comparison ("headline chart") — sketched,
  parked until the researcher weighs in on weighting (the exempt bucket is
  dominated by oil and pharma).
