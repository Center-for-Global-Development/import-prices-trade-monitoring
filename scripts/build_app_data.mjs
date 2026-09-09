#!/usr/bin/env node
// build_app_data.mjs — researcher CSVs (data/) → app JSON (src/data/).
//
// The canonical data handoff since the RA's August 2026 "v3" delivery: two
// CSVs straight out of the researcher's R workflow, with all filtering,
// country-name harmonization, tariff classification and cumulative YoY
// already done upstream. This script only validates, reshapes and writes.
// Drop fresh copies of the two files into data/ and rerun — it runs
// automatically as part of `npm run dev` and `npm run build`.
//
// Inputs (data/):
//   PRICE_DATA.csv            date, hs4, product, price_index
//                             BLS import price indexes by HS4, monthly,
//                             rebased so March 2025 = 100. Product-level
//                             (all U.S. imports of the HS4), not by country.
//   COUNTRY_PRODUCT_DATA.csv  long file with four record_types:
//     country_summary   one row per country: headline import total (column
//                       us_imports_<YEAR>; the September 2026 drop renamed
//                       it from us_imports_2024 = calendar 2024 to
//                       us_imports_2026 = Jan..latest_import_period YTD),
//                       qualifying / tracked / tariffed / exempt product
//                       counts, latest cumulative-YTD import YoY and its month.
//     country_month     one row per country-month: cumulative YTD import YoY
//                       (Jan..M this year vs Jan..M a year earlier), %.
//     country_product   one row per country×HS4 already filtered to the
//                       tracker's basket (≥10% of the country's exports of
//                       the product went to the U.S., OEC 2024) AND having a
//                       usable BLS price series. Carries share, exemption
//                       share + preformatted tariff status (+ average tariff
//                       rate since Sep 2026), latest price change since
//                       Mar 2025, and YTD U.S. imports.
//     country_product_month  (added Sep 2026) one row per country×HS4×month:
//                       cumulative YTD import YoY for that product from that
//                       country, same definition as country_month. Only
//                       months with a defined ratio are present, so series
//                       have gaps and not every tracked product has one.
//
// Outputs (src/data/):
//   prices.json     { baseLabel, through, series: { hs4: { name, points: [[YYYY-MM, idx]] } } }
//   countries.json  { shareBasis, threshold, importsYtdThrough, priceThrough,
//                     usImportsPeriod, hs4Names, productColumns,
//                     countries: { ISO3: {...} } }
//                   products are stored as compact rows in productColumns
//                   order to keep the bundle small; src/data/tracker.ts
//                   expands them.
//   product_months.json  { ISO3: { hs4: [firstMonth, [pct | null, ...]] } }
//                   per-product cumulative YoY, one slot per month from the
//                   first to the last observed month (null = no ratio).
//
// Exit code 1 on structural problems (missing files/columns, duplicate keys,
// products pointing at a price series that isn't in PRICE_DATA). Softer
// inconsistencies are printed as warnings so the RA can be told about them.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..")
const IN = join(REPO, "data")
const OUT = join(REPO, "src", "data")

// Methodology constants the files don't carry. Keep in step with the RA's
// "Text for Website" methodology note.
const SHARE_BASIS = "2024" // OEC bilateral trade, calendar 2024
const SHARE_THRESHOLD = 0.1 // ≥10% of the country's exports of the HS4 go to the U.S.
const BASE_LABEL = "March 2025 = 100"
const BASE_MONTH = "2025-03"

// ---------------------------------------------------------------- helpers

const warnings = []
const warn = (msg) => warnings.push(msg)
const fail = (msg) => {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

// Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF, UTF-8 BOM.
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = []
  let row = []
  let field = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      rows.push(row)
      row = []
    } else field += ch
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  const header = rows.shift().map((h) => h.trim())
  return rows
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])))
}

function readCsv(name, requiredCols) {
  const path = join(IN, name)
  if (!existsSync(path)) fail(`missing input ${path}`)
  const rows = parseCsv(readFileSync(path, "utf8"))
  if (rows.length === 0) fail(`${name} has no data rows`)
  const missing = requiredCols.filter((c) => !(c in rows[0]))
  if (missing.length) fail(`${name} is missing columns: ${missing.join(", ")}`)
  return rows
}

const num = (v, ctx) => {
  if (v === "") return null
  const n = Number(v)
  if (!Number.isFinite(n)) fail(`non-numeric value "${v}" in ${ctx}`)
  return n
}
const int = (v, ctx) => {
  const n = num(v, ctx)
  return n === null ? null : Math.round(n)
}
// "2026-06-01" -> "2026-06"
const ym = (v, ctx) => {
  if (v === "") return null
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(v)) fail(`bad date "${v}" in ${ctx}`)
  return v.slice(0, 7)
}
const round = (n, d) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d)

// ---------------------------------------------------------------- prices

const priceRows = readCsv("PRICE_DATA.csv", ["date", "hs4", "product", "price_index"])
const series = {}
for (const r of priceRows) {
  if (!/^\d{4}$/.test(r.hs4)) fail(`PRICE_DATA hs4 "${r.hs4}" is not a 4-digit code (leading zeros lost?)`)
  const s = (series[r.hs4] ??= { name: r.product, points: new Map() })
  const month = ym(r.date, `PRICE_DATA ${r.hs4}`)
  const idx = num(r.price_index, `PRICE_DATA ${r.hs4} ${r.date}`)
  if (idx === null) continue
  if (s.points.has(month)) fail(`PRICE_DATA duplicate ${r.hs4} ${month}`)
  s.points.set(month, round(idx, 2))
}
let priceThrough = ""
for (const [hs4, s] of Object.entries(series)) {
  const base = s.points.get(BASE_MONTH)
  if (base === undefined) warn(`price series ${hs4} has no ${BASE_MONTH} observation`)
  else if (Math.abs(base - 100) > 0.005) warn(`price series ${hs4} is ${base} in ${BASE_MONTH}, expected 100`)
  s.points = [...s.points.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const last = s.points[s.points.length - 1][0]
  if (last > priceThrough) priceThrough = last
}

// ---------------------------------------------------------------- countries

const rows = readCsv("COUNTRY_PRODUCT_DATA.csv", [
  "record_type", "country_iso3", "cty_code", "cty_name",
  "qualifying_products_n", "tracked_products_n",
  "tariffed_products_n", "exempt_products_n", "latest_import_yoy_pct",
  "latest_import_period", "date", "import_yoy_pct", "hs2", "hs4", "product",
  "us_share_pct", "exempt_share_pct", "tariff_status", "price_date",
  "price_change_since_mar2025", "us_imports_ytd", "imports_ytd_date",
])

// The headline import total's column carries its year in its name
// (us_imports_2024 in the August 2026 drop, us_imports_2026 since
// September). Whether it is a full calendar year or a year-to-date figure is
// decided below from latest_import_period.
const usImportsCol = Object.keys(rows[0]).find((c) => /^us_imports_\d{4}$/.test(c))
if (!usImportsCol) fail("COUNTRY_PRODUCT_DATA.csv has no us_imports_<YEAR> column")
const usImportsYear = usImportsCol.slice(-4)
// Optional: not in the August 2026 drop, present since September.
const hasAvgTariff = "average_tariff_pct" in rows[0]
if (!hasAvgTariff) warn("COUNTRY_PRODUCT_DATA.csv has no average_tariff_pct column; products will carry null")

const countries = {}
const hs4Names = {}
const country = (r) => {
  if (!/^[A-Z]{3}$/.test(r.country_iso3)) fail(`bad country_iso3 "${r.country_iso3}" (${r.cty_name})`)
  return (countries[r.country_iso3] ??= {
    name: r.cty_name,
    ctyCode: r.cty_code,
    summary: null,
    months: new Map(),
    products: new Map(),
    productMonths: new Map(), // hs4 -> Map(YYYY-MM -> pct)
  })
}

let importsYtdThrough = ""
for (const r of rows) {
  const c = country(r)
  if (c.name !== r.cty_name) warn(`${r.country_iso3} has two names: "${c.name}" / "${r.cty_name}"`)
  const ctx = `${r.record_type} ${r.country_iso3}`
  switch (r.record_type) {
    case "country_summary": {
      if (c.summary) fail(`duplicate country_summary for ${r.country_iso3}`)
      const month = ym(r.latest_import_period, ctx)
      const pct = num(r.latest_import_yoy_pct, ctx)
      const qualifying = int(r.qualifying_products_n, ctx) ?? 0
      const tariffed = int(r.tariffed_products_n, ctx) ?? 0
      const exempt = int(r.exempt_products_n, ctx) ?? 0
      // The file gives tariffed (0% exempt) and fully exempt (100%) counts;
      // everything else in the qualifying basket is partially exempt. This
      // assumes every qualifying product has an exemption share (true for all
      // tracked products; the RA has been asked to confirm for unpriced ones,
      // or to add a partial count to the summary row).
      const partial = qualifying - tariffed - exempt
      if (partial < 0) warn(`${ctx}: tariffed (${tariffed}) + exempt (${exempt}) exceed qualifying (${qualifying})`)
      c.summary = {
        usImports: num(r[usImportsCol], ctx),
        qualifying,
        tracked: int(r.tracked_products_n, ctx) ?? 0,
        tariffed,
        partial: Math.max(0, partial),
        exempt,
        latestYoy: month && pct !== null ? { month, pct: round(pct, 2) } : null,
      }
      break
    }
    case "country_month": {
      const month = ym(r.date, ctx)
      if (c.months.has(month)) fail(`duplicate country_month ${r.country_iso3} ${month}`)
      c.months.set(month, round(num(r.import_yoy_pct, ctx), 2))
      break
    }
    case "country_product": {
      if (!/^\d{4}$/.test(r.hs4)) fail(`${ctx} hs4 "${r.hs4}" is not a 4-digit code (leading zeros lost?)`)
      if (c.products.has(r.hs4)) fail(`duplicate country_product ${r.country_iso3} ${r.hs4}`)
      if (!series[r.hs4]) fail(`${ctx} ${r.hs4} has no series in PRICE_DATA.csv`)
      if (r.hs2 && r.hs2 !== r.hs4.slice(0, 2)) warn(`${ctx} ${r.hs4}: hs2 "${r.hs2}" disagrees with hs4`)
      if (hs4Names[r.hs4] && hs4Names[r.hs4] !== r.product) warn(`hs4 ${r.hs4} has two names: "${hs4Names[r.hs4]}" / "${r.product}"`)
      hs4Names[r.hs4] ??= r.product
      const pctx = `${ctx} ${r.hs4}`
      const share = num(r.us_share_pct, pctx)
      const exempt = num(r.exempt_share_pct, pctx)
      const change = num(r.price_change_since_mar2025, pctx)
      const priceMonth = ym(r.price_date, pctx)
      const ytdMonth = ym(r.imports_ytd_date, pctx)
      if (ytdMonth && ytdMonth > importsYtdThrough) importsYtdThrough = ytdMonth
      if (share !== null && share < SHARE_THRESHOLD * 100 - 0.05) warn(`${pctx} share ${share}% is below the ${SHARE_THRESHOLD * 100}% threshold`)
      if (share !== null && share > 100) warn(`${pctx} share ${share}% exceeds 100`)
      // The preformatted status should agree with the numeric share.
      // R rounds 12.5 to 12 and JS to 13, so compare the label's number
      // to the share with half a point of tolerance.
      if (exempt !== null) {
        const m = /^(\d+)% exempt$/.exec(r.tariff_status)
        const ok = exempt === 0 ? r.tariff_status === "Tariffed"
          : exempt === 100 ? r.tariff_status === "Exempt"
          : m !== null && Math.abs(Number(m[1]) - exempt) <= 0.5
        if (!ok) warn(`${pctx} tariff_status "${r.tariff_status}" vs exempt_share_pct ${exempt}`)
      }
      // The file's price change should be the series' latest point − 100.
      if (change !== null && priceMonth) {
        const pt = series[r.hs4].points.find((p) => p[0] === priceMonth)
        if (!pt) warn(`${pctx} price_date ${priceMonth} not in the ${r.hs4} series`)
        else if (Math.abs(pt[1] - 100 - change) > 0.05) warn(`${pctx} price change ${change} vs series ${round(pt[1] - 100, 2)}`)
      }
      c.products.set(r.hs4, [
        r.hs4,
        round(share, 1),
        round(exempt, 2),
        r.tariff_status,
        priceMonth,
        round(change, 2),
        num(r.us_imports_ytd, pctx),
        hasAvgTariff ? round(num(r.average_tariff_pct, pctx), 2) : null,
      ])
      break
    }
    case "country_product_month": {
      if (!/^\d{4}$/.test(r.hs4)) fail(`${ctx} hs4 "${r.hs4}" is not a 4-digit code (leading zeros lost?)`)
      const month = ym(r.date, `${ctx} ${r.hs4}`)
      if (!month) fail(`${ctx} ${r.hs4} has no date`)
      const pct = num(r.import_yoy_pct, `${ctx} ${r.hs4} ${month}`)
      if (pct === null) break // no ratio for that month; leave the gap
      const pm = c.productMonths.get(r.hs4) ?? new Map()
      if (pm.has(month)) fail(`duplicate country_product_month ${r.country_iso3} ${r.hs4} ${month}`)
      pm.set(month, round(pct, 2))
      c.productMonths.set(r.hs4, pm)
      break
    }
    default:
      fail(`unknown record_type "${r.record_type}" (${r.country_iso3})`)
  }
}

// Fill in any HS4 name the country file didn't carry from the price file.
for (const [hs4, s] of Object.entries(series)) {
  hs4Names[hs4] ??= s.name
  if (hs4Names[hs4] !== s.name) warn(`hs4 ${hs4} named "${hs4Names[hs4]}" in COUNTRY_PRODUCT_DATA but "${s.name}" in PRICE_DATA (using the former)`)
}

// Headline import total: a full calendar year when the column's year is
// before the data's latest month, otherwise Jan..latest month of that year.
let latestPeriod = ""
for (const c of Object.values(countries)) {
  const m = c.summary?.latestYoy?.month
  if (m && m > latestPeriod) latestPeriod = m
}
const usImportsPeriod = {
  year: usImportsYear,
  through: latestPeriod.startsWith(usImportsYear) ? latestPeriod : null,
}

// "YYYY-MM" -> months since year 0, for laying gappy series into arrays.
const monthIndex = (m) => parseInt(m.slice(0, 4), 10) * 12 + parseInt(m.slice(5, 7), 10) - 1

const out = {}
const productMonthsOut = {}
let nProductMonths = 0
let nUnpriced = 0 // monthly series for a country×HS4 that isn't a tracked product
let nNoMonths = 0 // tracked products with no monthly series at all
let dropped = []
for (const [iso, c] of Object.entries(countries).sort()) {
  if (!c.summary) {
    warn(`${iso} (${c.name}) has no country_summary row — skipped`)
    continue
  }
  if (c.summary.tracked !== c.products.size) warn(`${iso} tracked_products_n=${c.summary.tracked} but ${c.products.size} country_product rows`)
  // Same rule as every earlier data version: a country is on the tracker
  // when at least one of its products meets the share threshold.
  if (c.summary.qualifying === 0 && c.products.size === 0) {
    dropped.push(iso)
    continue
  }
  const months = [...c.months.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const lastMonth = months.length ? months[months.length - 1][0] : null
  if (c.summary.latestYoy && lastMonth && c.summary.latestYoy.month !== lastMonth) warn(`${iso} latest_import_period ${c.summary.latestYoy.month} but months run to ${lastMonth}`)
  const products = [...c.products.values()].sort((a, b) => b[1] - a[1])
  for (const p of products) {
    if (p[4] && p[4] !== priceThrough) warn(`${iso} ${p[0]} price_date ${p[4]} lags the latest BLS month ${priceThrough}`)
    if (!c.productMonths.has(p[0])) nNoMonths++
  }
  // Per-product monthly YoY, packed as [firstMonth, [value|null per month]].
  const pmOut = {}
  for (const [hs4, pm] of [...c.productMonths.entries()].sort()) {
    if (!c.products.has(hs4)) {
      nUnpriced++
      continue
    }
    const keys = [...pm.keys()].sort()
    const first = monthIndex(keys[0])
    const values = Array(monthIndex(keys[keys.length - 1]) - first + 1).fill(null)
    for (const k of keys) values[monthIndex(k) - first] = pm.get(k)
    nProductMonths += keys.length
    pmOut[hs4] = [keys[0], values]
  }
  if (Object.keys(pmOut).length) productMonthsOut[iso] = pmOut
  out[iso] = {
    name: c.name,
    ctyCode: c.ctyCode,
    ...c.summary,
    months,
    products,
  }
}

// ---------------------------------------------------------------- write

const prices = {
  baseLabel: BASE_LABEL,
  through: priceThrough,
  series: Object.fromEntries(Object.entries(series).sort()),
}
const countriesJson = {
  shareBasis: SHARE_BASIS,
  threshold: SHARE_THRESHOLD,
  importsYtdThrough,
  priceThrough,
  usImportsPeriod,
  hs4Names: Object.fromEntries(Object.entries(hs4Names).sort()),
  productColumns: ["hs4", "usSharePct", "exemptSharePct", "tariffStatus", "priceMonth", "priceChangePct", "usImportsYtd", "avgTariffPct"],
  countries: out,
}
if (nUnpriced) warn(`${nUnpriced} country_product_month series belong to country×HS4 pairs with no country_product row — ignored`)
if (nNoMonths) warn(`${nNoMonths} tracked country×HS4 pairs have no country_product_month rows (no year-earlier imports to compare against)`)
writeFileSync(join(OUT, "prices.json"), JSON.stringify(prices))
writeFileSync(join(OUT, "countries.json"), JSON.stringify(countriesJson))
writeFileSync(join(OUT, "product_months.json"), JSON.stringify(productMonthsOut))

// Browser payloads: a tiny directory, shared prices, and one file per country.
// Vite fingerprints these assets, so a data rebuild also invalidates caches.
const detailDir = join(OUT, "details")
mkdirSync(detailDir, { recursive: true })
for (const file of readdirSync(detailDir)) {
  if (/^[A-Z]{3}\.json$/.test(file) && !out[file.slice(0, 3)]) unlinkSync(join(detailDir, file))
}
const directory = { ...countriesJson, baseLabel: BASE_LABEL, countries: {} }
for (const [iso, country] of Object.entries(out)) {
  const { products, months, ...summary } = country
  directory.countries[iso] = { ...summary, tracked: products.length }
  writeFileSync(join(detailDir, `${iso}.json`), JSON.stringify({
    country, productMonths: productMonthsOut[iso] ?? {},
  }))
}
writeFileSync(join(OUT, "directory.json"), JSON.stringify(directory))

const nProducts = Object.values(out).reduce((n, c) => n + c.products.length, 0)
const nPriced = Object.values(out).filter((c) => c.products.length > 0).length
console.log(
  `build_app_data: ${Object.keys(series).length} price series through ${priceThrough}; ` +
  `${Object.keys(out).length} countries (${nPriced} with tracked products), ` +
  `${nProducts} country-products with ${nProductMonths} product-months; imports YTD through ${importsYtdThrough}; ` +
  `headline imports ${usImportsPeriod.through ? `Jan..${usImportsPeriod.through}` : usImportsPeriod.year}`,
)
if (dropped.length) console.log(`  dropped ${dropped.length} countries with no qualifying products: ${dropped.join(" ")}`)
if (warnings.length) {
  console.log(`  ${warnings.length} warning(s):`)
  for (const w of warnings.slice(0, 40)) console.log(`   - ${w}`)
  if (warnings.length > 40) console.log(`   … ${warnings.length - 40} more`)
}
