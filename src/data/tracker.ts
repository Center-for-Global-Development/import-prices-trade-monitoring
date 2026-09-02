// Data layer for the tracker, backed by the researcher's consolidated CSVs in
// data/ (the canonical handoff format since August 2026), converted to JSON
// by scripts/build_app_data.mjs. Everything analytical — product selection,
// tariff classification, cumulative YoY, latest-period handling — is done
// upstream in the researcher's R workflow; this module only reshapes.
//
//   prices.json     BLS import price indexes by HS4 (monthly, rebased to
//                   March 2025 = 100). BLS publishes these for ALL US
//                   imports of an HS4, not by origin country, so a series is
//                   shared by every country that exports the product.
//   countries.json  Per country: the summary tiles (2024 import total,
//                   qualifying / tracked / tariffed / exempt counts, latest
//                   cumulative-YTD import YoY), the monthly cumulative YoY
//                   series, and the tracked products — the country×HS4 pairs
//                   where ≥10% of the country's exports of the product went
//                   to the US (OEC 2024) AND a BLS price series exists —
//                   each with share, exemption status, latest price change
//                   and YTD US imports.

import pricesRaw from "./prices.json"
import countriesRaw from "./countries.json"

export type PricePoint = { date: string; idx: number }
// Cumulative year-to-date US imports vs the same months a year earlier, %.
// Null when the researcher's file has no comparison for that month.
export type ImportPoint = { date: string; cumYoy: number | null }

export type Product = {
  hs: string
  name: string
  // Share of the country's exports of this HS4 that went to the US, % (OEC
  // 2024, capped at 100 upstream).
  shareToUS: number | null
  // % of US import value of this HS4 exempt from tariffs under Annex II;
  // null = not classified.
  exemptPct: number | null
  // Preformatted by the researcher: "Tariffed", "Exempt" or "n% exempt".
  tariffStatus: string
  // Latest BLS index − 100, i.e. % change since March 2025, and the month it
  // refers to. Null when the series has no usable latest value.
  priceChangePct: number | null
  priceMonth: string | null
  // Cumulative US imports of this HS4 from the country, Jan through
  // IMPORTS_YTD_THROUGH, USD. A real zero is a real zero.
  usImportsYtd: number | null
}

export type CountryData = {
  iso: string
  name: string
  // Total US goods imports from the country in 2024, USD. Null when the
  // researcher's file has none.
  usImports2024: number | null
  // Basket counts over ALL qualifying products (with or without a BLS price
  // series). tariffed = no Annex II exemption; exempt = fully exempt.
  // Partially exempt products sit in neither, so they need not sum.
  qualifyingCount: number
  tariffedCount: number
  exemptCount: number
  // Freshest cumulative-YTD import YoY and the month it runs through.
  latestYoy: { month: string; pct: number } | null
  importValue: ImportPoint[]
  // Tracked products only (qualifying AND priced), sorted by share desc.
  products: Product[]
}

type PricesRaw = {
  baseLabel: string
  through: string
  series: Record<string, { name: string; points: [string, number][] }>
}
type ProductRow = [
  hs4: string,
  usSharePct: number | null,
  exemptSharePct: number | null,
  tariffStatus: string,
  priceMonth: string | null,
  priceChangePct: number | null,
  usImportsYtd: number | null,
]
type CountryRaw = {
  name: string
  ctyCode: string
  usImports2024: number | null
  qualifying: number
  tracked: number
  tariffed: number
  exempt: number
  latestYoy: { month: string; pct: number } | null
  months: [string, number | null][]
  products: ProductRow[]
}
type CountriesRaw = {
  shareBasis: string
  threshold: number
  importsYtdThrough: string
  priceThrough: string
  hs4Names: Record<string, string>
  countries: Record<string, CountryRaw>
}
const PRICES = pricesRaw as unknown as PricesRaw
const DATA = countriesRaw as unknown as CountriesRaw

export const BASE_LABEL = PRICES.baseLabel
// The year the export shares refer to (OEC bilateral trade), e.g. "2024".
export const SHARE_BASIS = DATA.shareBasis
export const QUALIFYING_THRESHOLD = DATA.threshold
// Latest month covered by the per-product YTD import values ("YYYY-MM") and
// by the BLS price series. Drive period wording from these, never hard-code.
export const IMPORTS_YTD_THROUGH = DATA.importsYtdThrough
export const PRICES_THROUGH = DATA.priceThrough

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// "2026-06" -> "Jun 2026"
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`
}
// "2026-06" -> "Jan–Jun 2026" (the YTD window ending that month).
export function ytdLabel(ym: string): string {
  const [y, m] = ym.split("-")
  const end = MONTHS[parseInt(m, 10) - 1]
  return end === "Jan" ? `Jan ${y}` : `Jan–${end} ${y}`
}

export type Country = {
  iso: string
  name: string
  qualifyingCount: number
  trackedCount: number
  tariffedCount: number
  exemptCount: number
}

export const COUNTRIES: Country[] = Object.entries(DATA.countries)
  .map(([iso, c]) => ({
    iso,
    name: c.name,
    qualifyingCount: c.qualifying,
    trackedCount: c.products.length,
    tariffedCount: c.tariffed,
    exemptCount: c.exempt,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const COUNTRY_BY_ISO: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.iso, c]),
)

export function getPriceSeries(hs: string): PricePoint[] {
  const s = PRICES.series[hs]
  if (!s) return []
  return s.points.map(([date, idx]) => ({ date, idx }))
}

export function getCountryData(iso: string): CountryData | undefined {
  const c = DATA.countries[iso]
  if (!c) return undefined
  return {
    iso,
    name: c.name,
    usImports2024: c.usImports2024,
    qualifyingCount: c.qualifying,
    tariffedCount: c.tariffed,
    exemptCount: c.exempt,
    latestYoy: c.latestYoy,
    importValue: c.months.map(([date, cumYoy]) => ({ date, cumYoy })),
    products: c.products.map(
      ([hs, share, exempt, tariffStatus, priceMonth, priceChangePct, usImportsYtd]) => ({
        hs,
        name: DATA.hs4Names[hs] ?? PRICES.series[hs]?.name ?? hs,
        shareToUS: share,
        exemptPct: exempt,
        tariffStatus,
        priceChangePct,
        priceMonth,
        usImportsYtd,
      }),
    ),
  }
}

export type HS2 = { code: string; name: string }

// HS chapter (HS2) names, abridged. The researcher's file carries the HS2
// code but not its description.
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
