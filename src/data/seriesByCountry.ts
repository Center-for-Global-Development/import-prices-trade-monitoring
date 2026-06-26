import trackerData from "./tracker_data.json"

export type PricePoint = { date: string; idx: number }
export type ImportPoint = { date: string; usdBn: number }

export type Product = {
  hs: string
  name: string
  // null = UN Comtrade has no recent export-share data for this product.
  shareToUS: number | null
  // empty = BLS does not publish an import price index for this HS4 code.
  priceSeries: PricePoint[]
  importValueYTD: number
}

export type HS2 = { code: string; name: string }

// HS2 chapter names for the HS4 codes referenced in the product library.
const HS2_NAMES: Record<string, string> = {
  "03": "Fish & crustaceans",
  "07": "Edible vegetables",
  "08": "Edible fruit & nuts",
  "09": "Coffee, tea & spices",
  "16": "Preparations of meat & fish",
  "17": "Sugars & confectionery",
  "22": "Beverages & spirits",
  "27": "Mineral fuels & oils",
  "30": "Pharmaceutical products",
  "31": "Fertilisers",
  "40": "Rubber & articles thereof",
  "42": "Leather goods & handbags",
  "44": "Wood & articles of wood",
  "62": "Apparel, woven",
  "64": "Footwear",
  "71": "Pearls, precious metals & jewellery",
  "72": "Iron & steel",
  "84": "Machinery & mechanical appliances",
  "85": "Electrical machinery & equipment",
  "87": "Vehicles",
  "90": "Optical & medical instruments",
  "94": "Furniture & bedding",
  "95": "Toys, games & sports equipment",
}

export function hs2For(hs: string): HS2 {
  const code = hs.slice(0, 2)
  return { code, name: HS2_NAMES[code] ?? "Other" }
}

export type CountryData = {
  iso: string
  products: Product[]
  importValue: ImportPoint[]
}

// Shape of src/data/tracker_data.json, produced by scripts/fetch_tracker_data.R.
// Fields are optional because real-world coverage is partial: shareToUS is
// absent when Comtrade has no data, importValueYTD when Census has none, and
// priceSeries is empty when BLS publishes no index for that HS4.
type RawProduct = {
  hs: string
  name: string
  shareToUS?: number | null
  importValueYTD?: number | null
  priceSeries?: PricePoint[]
}
type RawCountry = {
  iso: string
  products?: RawProduct[]
  importValue?: ImportPoint[]
}
type RawData = {
  generatedAt: string
  baseMonth: string
  countries: Record<string, RawCountry>
}

const RAW = trackerData as unknown as RawData

export const BASE_MONTH = RAW.baseMonth
export const GENERATED_AT = RAW.generatedAt

function normalizeProduct(p: RawProduct): Product {
  return {
    hs: p.hs,
    name: p.name,
    shareToUS: p.shareToUS ?? null,
    priceSeries: p.priceSeries ?? [],
    importValueYTD: p.importValueYTD ?? 0,
  }
}

const COUNTRY_DATA: Record<string, CountryData> = (() => {
  const out: Record<string, CountryData> = {}
  for (const [iso, c] of Object.entries(RAW.countries)) {
    out[iso] = {
      iso,
      products: (c.products ?? []).map(normalizeProduct),
      importValue: c.importValue ?? [],
    }
  }
  return out
})()

export function getCountryData(iso: string): CountryData | undefined {
  return COUNTRY_DATA[iso]
}

export const QUALIFYING_THRESHOLD = 0.1

// Products that meet the >=10% export-share rule, sorted by share (desc).
// Products with no share data (null) can't be evaluated against the rule, so
// they're kept but sorted last — hiding them would make the dashboard look
// empty for countries Comtrade doesn't cover (e.g. India).
export function qualifyingProducts(data: CountryData): Product[] {
  return data.products
    .filter((p) => p.shareToUS === null || p.shareToUS >= QUALIFYING_THRESHOLD)
    .sort((a, b) => (b.shareToUS ?? -1) - (a.shareToUS ?? -1))
}
