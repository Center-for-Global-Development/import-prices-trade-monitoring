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
//   COUNTRY_PRODUCT_DATA.csv  long file with three record_types:
//     country_summary   one row per country: 2024 import total, qualifying /
//                       tracked / tariffed / exempt product counts, latest
//                       cumulative-YTD import YoY and its month.
//     country_month     one row per country-month: cumulative YTD import YoY
//                       (Jan..M this year vs Jan..M a year earlier), %.
//     country_product   one row per country×HS4 already filtered to the
//                       tracker's basket (≥10% of the country's exports of
//                       the product went to the U.S., OEC 2024) AND having a
//                       usable BLS price series. Carries share, exemption
//                       share + preformatted tariff status, latest price
//                       change since Mar 2025, and YTD U.S. imports.
//
// Outputs (src/data/):
//   prices.json     { baseLabel, through, series: { hs4: { name, points: [[YYYY-MM, idx]] } } }
//   countries.json  { shareBasis, threshold, importsYtdThrough, priceThrough,
//                     hs4Names, productColumns, countries: { ISO3: {...} } }
//                   products are stored as compact rows in productColumns
//                   order to keep the bundle small; src/data/tracker.ts
//                   expands them.
//
// Exit code 1 on structural problems (missing files/columns, duplicate keys,
// products pointing at a price series that isn't in PRICE_DATA). Softer
// inconsistencies are printed as warnings so the RA can be told about them.

import { readFileSync, writeFileSync, existsSync } from "node:fs"
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
  "us_imports_2024", "qualifying_products_n", "tracked_products_n",
  "tariffed_products_n", "exempt_products_n", "latest_import_yoy_pct",
  "latest_import_period", "date", "import_yoy_pct", "hs2", "hs4", "product",
  "us_share_pct", "exempt_share_pct", "tariff_status", "price_date",
  "price_change_since_mar2025", "us_imports_ytd", "imports_ytd_date",
])

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
      c.summary = {
        usImports2024: num(r.us_imports_2024, ctx),
        qualifying: int(r.qualifying_products_n, ctx) ?? 0,
        tracked: int(r.tracked_products_n, ctx) ?? 0,
        tariffed: int(r.tariffed_products_n, ctx) ?? 0,
        exempt: int(r.exempt_products_n, ctx) ?? 0,
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
      if (exempt !== null) {
        const expect = exempt === 0 ? "Tariffed" : exempt === 100 ? "Exempt" : `${Math.round(exempt)}% exempt`
        if (r.tariff_status !== expect) warn(`${pctx} tariff_status "${r.tariff_status}" vs exempt_share_pct ${exempt}`)
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
      ])
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

const out = {}
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
  }
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
  hs4Names: Object.fromEntries(Object.entries(hs4Names).sort()),
  productColumns: ["hs4", "usSharePct", "exemptSharePct", "tariffStatus", "priceMonth", "priceChangePct", "usImportsYtd"],
  countries: out,
}
writeFileSync(join(OUT, "prices.json"), JSON.stringify(prices))
writeFileSync(join(OUT, "countries.json"), JSON.stringify(countriesJson))

const nProducts = Object.values(out).reduce((n, c) => n + c.products.length, 0)
const nPriced = Object.values(out).filter((c) => c.products.length > 0).length
console.log(
  `build_app_data: ${Object.keys(series).length} price series through ${priceThrough}; ` +
  `${Object.keys(out).length} countries (${nPriced} with tracked products), ` +
  `${nProducts} country-products; imports YTD through ${importsYtdThrough}`,
)
if (dropped.length) console.log(`  dropped ${dropped.length} countries with no qualifying products: ${dropped.join(" ")}`)
if (warnings.length) {
  console.log(`  ${warnings.length} warning(s):`)
  for (const w of warnings.slice(0, 40)) console.log(`   - ${w}`)
  if (warnings.length > 40) console.log(`   … ${warnings.length - 40} more`)
}
