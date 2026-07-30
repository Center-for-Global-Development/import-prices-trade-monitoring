// Data layer for the tracker, backed by the researcher's "data v2"
// deliverables (researcher data/data v2/), converted to JSON by
// scripts/build_app_data_v2.py.
//
//   bls_series.json           BLS import price indexes by HS4 (monthly,
//                             rebased to March 2025 = 100). BLS publishes
//                             these for ALL U.S. imports of an HS4, not by
//                             origin country, so a series is shared by every
//                             country that exports the product.
//   products_by_country.json  Country x HS4 pairs meeting the tracker's
//                             selection rule: >=10% of the country's
//                             estimated exports of the product went to the
//                             U.S. over the share period (Census YTD imports
//                             / OEC-estimated global exports; shares over
//                             100% are capped at 100%).
//   exempt_share.json         Import-value-weighted % of each HS4 exempt
//                             from tariffs under the Annex II lists.
//   import_values.json        Monthly total U.S. goods imports by partner
//                             country plus the researcher's cumulative (YTD)
//                             YoY growth (U.S. Census workbook).

import blsRaw from "./bls_series.json"
import productsRaw from "./products_by_country.json"
import exemptRaw from "./exempt_share.json"
import importValuesRaw from "./import_values.json"

export type PricePoint = { date: string; idx: number }
// cumYoy: cumulative year-to-date imports vs the same months a year earlier,
// % — the researcher's YoY definition (v2). Null when no prior-year data.
export type ImportPoint = { date: string; usdBn: number; cumYoy: number | null }

export type Product = {
  hs: string
  name: string
  // Capped at 1 in the pipeline (the global-exports denominator is
  // estimated, so raw shares can exceed 100%).
  shareToUS: number
  // U.S. imports of this HS4 from the country over the share period, USD
  // (Census, importer-reported).
  usImports: number
  // % of U.S. import value of this HS4 exempt from tariffs; null = HS4 not
  // in the exemptions workbook.
  exemptPct: number | null
  hasPriceSeries: boolean
}

export type CountryData = {
  iso: string
  name: string
  products: Product[]
  // Monthly total U.S. goods imports from this country, USD bn (Census).
  // Empty when we have no Census pull for the country yet.
  importValue: ImportPoint[]
}

type BlsRaw = {
  baseLabel: string
  series: Record<string, { name: string; points: [string, number][] }>
}
type ProductsRaw = {
  sharePeriod: string
  threshold: number
  hs4Names: Record<string, string>
  countries: Record<string, { name: string; products: { h: string; s: number; x: number }[] }>
}
const BLS = blsRaw as unknown as BlsRaw
const PRODUCTS = productsRaw as unknown as ProductsRaw
const EXEMPT = exemptRaw as Record<string, number>
const IMPORT_VALUES = importValuesRaw as unknown as Record<
  string,
  [string, number, number | null][]
>


export const BASE_LABEL = BLS.baseLabel
// e.g. "Jan–May 2026" — the YTD window the qualifying shares cover.
export const SHARE_PERIOD = PRODUCTS.sharePeriod
export const QUALIFYING_THRESHOLD = PRODUCTS.threshold

export type Country = {
  iso: string
  name: string
  productCount: number
  priceSeriesCount: number
  // Qualifying products fully tariffed (0% exempt) / fully exempt (100%)
  // under Annex II. Partially exempt and not-in-workbook products count in
  // neither bucket.
  tariffedCount: number
  exemptCount: number
}

export const COUNTRIES: Country[] = Object.entries(PRODUCTS.countries)
  .map(([iso, c]) => ({
    iso,
    name: c.name,
    productCount: c.products.length,
    priceSeriesCount: c.products.filter((p) => p.h in BLS.series).length,
    tariffedCount: c.products.filter((p) => EXEMPT[p.h] === 0).length,
    exemptCount: c.products.filter((p) => EXEMPT[p.h] === 100).length,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const COUNTRY_BY_ISO: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.iso, c]),
)

// Total U.S. goods imports from the country in a calendar year, USD bn.
// Null when the year is missing months (partial years would understate it).
export function importsInYear(points: ImportPoint[], year: number): number | null {
  const months = points.filter((p) => p.date.startsWith(`${year}-`))
  if (months.length < 12) return null
  return months.reduce((n, p) => n + p.usdBn, 0)
}

// The freshest cumulative (YTD) YoY value — the researcher's v2 YoY
// definition, taken directly from the Census workbook rather than computed.
export function latestImportYoY(
  points: ImportPoint[],
): { month: string; pct: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const { date, cumYoy } = points[i]
    if (cumYoy !== null) return { month: date, pct: cumYoy }
  }
  return null
}

export function getPriceSeries(hs: string): PricePoint[] {
  const s = BLS.series[hs]
  if (!s) return []
  return s.points.map(([date, idx]) => ({ date, idx }))
}

export function getCountryData(iso: string): CountryData | undefined {
  const c = PRODUCTS.countries[iso]
  if (!c) return undefined
  return {
    iso,
    name: c.name,
    products: c.products.map((p) => ({
      hs: p.h,
      name: PRODUCTS.hs4Names[p.h] ?? p.h,
      shareToUS: p.s,
      usImports: p.x,
      exemptPct: EXEMPT[p.h] ?? null,
      hasPriceSeries: p.h in BLS.series,
    })),
    importValue: (IMPORT_VALUES[iso] ?? []).map(([date, usdBn, cumYoy]) => ({
      date,
      usdBn,
      cumYoy,
    })),
  }
}

export type HS2 = { code: string; name: string }

// HS chapter (HS2) names, abridged.
const HS2_NAMES: Record<string, string> = {
  "01": "Live animals",
  "02": "Meat",
  "03": "Fish & crustaceans",
  "04": "Dairy, eggs & honey",
  "05": "Other animal products",
  "06": "Live plants & flowers",
  "07": "Edible vegetables",
  "08": "Edible fruit & nuts",
  "09": "Coffee, tea & spices",
  "10": "Cereals",
  "11": "Milling products",
  "12": "Oil seeds & grains",
  "13": "Gums & resins",
  "14": "Other vegetable products",
  "15": "Fats & oils",
  "16": "Preparations of meat & fish",
  "17": "Sugars & confectionery",
  "18": "Cocoa",
  "19": "Cereal & flour preparations",
  "20": "Vegetable & fruit preparations",
  "21": "Misc. edible preparations",
  "22": "Beverages & spirits",
  "23": "Food residues & animal feed",
  "24": "Tobacco",
  "25": "Salt, sulphur, earths & stone",
  "26": "Ores, slag & ash",
  "27": "Mineral fuels & oils",
  "28": "Inorganic chemicals",
  "29": "Organic chemicals",
  "30": "Pharmaceutical products",
  "31": "Fertilisers",
  "32": "Dyes, pigments & paints",
  "33": "Perfumery & cosmetics",
  "34": "Soaps & waxes",
  "35": "Albuminoids & glues",
  "36": "Explosives & pyrotechnics",
  "37": "Photographic goods",
  "38": "Misc. chemical products",
  "39": "Plastics",
  "40": "Rubber & articles thereof",
  "41": "Raw hides & leather",
  "42": "Leather goods & handbags",
  "43": "Furskins & artificial fur",
  "44": "Wood & articles of wood",
  "45": "Cork",
  "46": "Straw & basketware",
  "47": "Wood pulp",
  "48": "Paper & paperboard",
  "49": "Printed books & media",
  "50": "Silk",
  "51": "Wool & animal hair",
  "52": "Cotton",
  "53": "Other vegetable fibres",
  "54": "Man-made filaments",
  "55": "Man-made staple fibres",
  "56": "Wadding, felt & ropes",
  "57": "Carpets",
  "58": "Special woven fabrics",
  "59": "Coated & industrial textiles",
  "60": "Knitted fabrics",
  "61": "Apparel, knitted",
  "62": "Apparel, woven",
  "63": "Other textiles",
  "64": "Footwear",
  "65": "Headgear",
  "66": "Umbrellas & sticks",
  "67": "Feathers & artificial flowers",
  "68": "Stone, plaster & cement articles",
  "69": "Ceramics",
  "70": "Glass & glassware",
  "71": "Pearls, precious metals & jewellery",
  "72": "Iron & steel",
  "73": "Articles of iron & steel",
  "74": "Copper",
  "75": "Nickel",
  "76": "Aluminium",
  "78": "Lead",
  "79": "Zinc",
  "80": "Tin",
  "81": "Other base metals",
  "82": "Tools & cutlery",
  "83": "Misc. metal articles",
  "84": "Machinery & mechanical appliances",
  "85": "Electrical machinery & equipment",
  "86": "Railway equipment",
  "87": "Vehicles",
  "88": "Aircraft & spacecraft",
  "89": "Ships & boats",
  "90": "Optical & medical instruments",
  "91": "Clocks & watches",
  "92": "Musical instruments",
  "93": "Arms & ammunition",
  "94": "Furniture & bedding",
  "95": "Toys, games & sports equipment",
  "96": "Misc. manufactured articles",
  "97": "Works of art & antiques",
}

export function hs2For(hs: string): HS2 {
  const code = hs.slice(0, 2)
  return { code, name: HS2_NAMES[code] ?? "Other" }
}
