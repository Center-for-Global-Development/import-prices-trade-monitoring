// Data layer for the tracker, backed by the researcher's deliverables
// (researcher data/), converted to JSON by scripts/build_app_data.py.
//
//   bls_series.json           BLS import price indexes by HS4 (monthly,
//                             rebased to March 2025 = 100). BLS publishes
//                             these for ALL U.S. imports of an HS4, not by
//                             origin country, so a series is shared by every
//                             country that exports the product.
//   products_by_country.json  Country x HS4 pairs meeting the tracker's
//                             selection rule: >=10% of the country's 2024
//                             exports of the product went to the U.S. (OEC).
//   exempt_share.json         Import-value-weighted % of each HS4 exempt
//                             from tariffs under the Annex II lists.
//   tracker_data.json         Legacy R-script pull; still the source for
//                             monthly bilateral import values (U.S. Census),
//                             currently available for 10 pilot countries.

import blsRaw from "./bls_series.json"
import productsRaw from "./products_by_country.json"
import exemptRaw from "./exempt_share.json"
import legacyData from "./tracker_data.json"

export type PricePoint = { date: string; idx: number }
export type ImportPoint = { date: string; usdBn: number }

export type Product = {
  hs: string
  name: string
  shareToUS: number
  // Exports to the U.S. in the share year, USD (OEC, exporter-reported).
  usExports: number
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
  shareYear: number
  threshold: number
  hs4Names: Record<string, string>
  countries: Record<string, { name: string; products: { h: string; s: number; x: number }[] }>
}
type LegacyRaw = {
  countries: Record<string, { importValue?: ImportPoint[] }>
}

const BLS = blsRaw as unknown as BlsRaw
const PRODUCTS = productsRaw as ProductsRaw
const EXEMPT = exemptRaw as Record<string, number>
const LEGACY = legacyData as unknown as LegacyRaw

export const BASE_LABEL = BLS.baseLabel
export const SHARE_YEAR = PRODUCTS.shareYear
export const QUALIFYING_THRESHOLD = PRODUCTS.threshold

export type Country = {
  iso: string
  name: string
  productCount: number
  priceSeriesCount: number
}

export const COUNTRIES: Country[] = Object.entries(PRODUCTS.countries)
  .map(([iso, c]) => ({
    iso,
    name: c.name,
    productCount: c.products.length,
    priceSeriesCount: c.products.filter((p) => p.h in BLS.series).length,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

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
      usExports: p.x,
      exemptPct: EXEMPT[p.h] ?? null,
      hasPriceSeries: p.h in BLS.series,
    })),
    importValue: LEGACY.countries[iso]?.importValue ?? [],
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
