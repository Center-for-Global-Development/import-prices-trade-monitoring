// Data layer for the tracker, backed by the researcher's consolidated CSVs in
// data/ (the canonical handoff format since August 2026), converted to JSON
// by scripts/build_app_data.mjs. Everything analytical — product selection,
// tariff classification, cumulative YoY, latest-period handling — is done
// upstream in the researcher's R workflow; this module only reshapes.
// Generated directory is eager; shared prices and country histories load on demand.
import directoryRaw from "./directory.json"
import pricesUrl from "./prices.json?url"

const countryUrls = import.meta.glob<string>("./details/*.json", {
  query: "?url", import: "default", eager: true,
})

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
  // refers to. Null when the series has no usable latest value. Carried
  // through but not shown since Sep 2026: the researcher dropped the table
  // column pending a better price-change comparison.
  priceChangePct: number | null
  priceMonth: string | null
  // Cumulative US imports of this HS4 from the country, Jan through
  // IMPORTS_YTD_THROUGH, USD. A real zero is a real zero.
  usImportsYtd: number | null
  // Average applied US tariff rate on the HS4 from this country, %: the mean
  // of the HS10 rates under the HS4 (added by the researcher in Sep 2026;
  // null in older drops or when unclassified).
  avgTariffPct: number | null
}

// One-letter tariff status used to tag products in chart legends/pickers so
// readers can compare tariffed vs exempt price paths at a glance. Mirrors the
// three-way badge in the products table: T = tariffed (0% exempt), E = exempt
// (100%), P = partially exempt (anything between). Null when unclassified.
export type TariffCode = "T" | "E" | "P"
export function tariffCode(p: Product): TariffCode | null {
  if (p.exemptPct === null) return null
  if (p.exemptPct === 0) return "T"
  if (p.exemptPct === 100) return "E"
  return "P"
}
export const TARIFF_CODE_LABEL: Record<TariffCode, string> = {
  T: "tariffed",
  E: "exempt",
  P: "partially exempt",
}

export type CountryData = {
  iso: string
  name: string
  // Headline US goods imports from the country, USD, over the period
  // US_IMPORTS_LABEL describes (calendar 2024 in the August 2026 drop,
  // Jan–Jul 2026 YTD since September). Null when the file has none.
  usImports: number | null
  // Basket counts over ALL qualifying products (with or without a BLS price
  // series). tariffed = no exemption (0%); exempt = fully exempt (100%);
  // partial = everything in between. The three sum to qualifyingCount.
  qualifyingCount: number
  tariffedCount: number
  partialCount: number
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
  avgTariffPct: number | null,
]
type CountryRaw = {
  name: string
  ctyCode: string
  usImports: number | null
  qualifying: number
  tracked: number
  tariffed: number
  partial: number
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
  // Year the headline import total covers, and the month it runs through
  // when it is a year-to-date figure (null = full calendar year).
  usImportsPeriod: { year: string; through: string | null }
  hs4Names: Record<string, string>
  baseLabel: string
  countries: Record<string, Omit<CountryRaw, "products" | "months">>
}
// ISO3 -> hs4 -> [firstMonth "YYYY-MM", values (null = no ratio that month)]
type ProductMonthsRaw = Record<string, Record<string, [string, (number | null)[]]>>
let PRICES: PricesRaw = { baseLabel: directoryRaw.baseLabel, through: directoryRaw.priceThrough, series: {} }
const DATA = directoryRaw as unknown as CountriesRaw
const PRODUCT_MONTHS: ProductMonthsRaw = {}
const DETAILS: Record<string, CountryRaw> = {}
let pricesRequest: Promise<void> | undefined
const requests = new Map<string, Promise<void>>()

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Data request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function loadCountryData(iso: string): Promise<void> {
  if (!DATA.countries[iso]) return
  if (!pricesRequest) {
    pricesRequest = readJson<PricesRaw>(pricesUrl).then((data) => { PRICES = data })
      .catch((error) => { pricesRequest = undefined; throw error })
  }
  if (!requests.has(iso)) {
    const url = countryUrls[`./details/${iso}.json`]
    if (!url) throw new Error("Country data is unavailable")
    requests.set(iso, readJson<{country: CountryRaw; productMonths: ProductMonthsRaw[string]}>(url)
      .then(({ country, productMonths }) => {
        DETAILS[iso] = country
        PRODUCT_MONTHS[iso] = productMonths
      }).catch((error) => { requests.delete(iso); throw error }))
  }
  await Promise.all([pricesRequest, requests.get(iso)])
}

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
// "2026-07" with day 24 -> "Jul 24, 2026"; without a day, same as monthLabel.
export function dateLabel(ym: string, day?: number): string {
  if (day === undefined) return monthLabel(ym)
  const [y, m] = ym.split("-")
  return `${MONTHS[parseInt(m, 10) - 1]} ${day}, ${y}`
}
// "2026-06" -> "Jan–Jun 2026" (the YTD window ending that month).
export function ytdLabel(ym: string): string {
  const [y, m] = ym.split("-")
  const end = MONTHS[parseInt(m, 10) - 1]
  return end === "Jan" ? `Jan ${y}` : `Jan–${end} ${y}`
}
// Product counts run past 1,000 for a handful of countries, so they get
// thousands separators wherever they're shown.
export function countLabel(n: number): string {
  return n.toLocaleString("en-US")
}
// Period the headline import tile covers, e.g. "2024" or "Jan–Jul 2026".
export const US_IMPORTS_LABEL = DATA.usImportsPeriod.through
  ? ytdLabel(DATA.usImportsPeriod.through)
  : DATA.usImportsPeriod.year

export type Country = {
  iso: string
  name: string
  qualifyingCount: number
  trackedCount: number
  tariffedCount: number
  partialCount: number
  exemptCount: number
}

export const COUNTRIES: Country[] = Object.entries(DATA.countries)
  .map(([iso, c]) => ({
    iso,
    name: c.name,
    qualifyingCount: c.qualifying,
    trackedCount: c.tracked,
    tariffedCount: c.tariffed,
    partialCount: c.partial,
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
  const c = DETAILS[iso]
  if (!c) return undefined
  return {
    iso,
    name: c.name,
    usImports: c.usImports,
    qualifyingCount: c.qualifying,
    tariffedCount: c.tariffed,
    partialCount: c.partial,
    exemptCount: c.exempt,
    latestYoy: c.latestYoy,
    importValue: c.months.map(([date, cumYoy]) => ({ date, cumYoy })),
    products: c.products.map(
      ([hs, share, exempt, tariffStatus, priceMonth, priceChangePct, usImportsYtd, avgTariffPct]) => ({
        hs,
        name: DATA.hs4Names[hs] ?? PRICES.series[hs]?.name ?? hs,
        shareToUS: share,
        exemptPct: exempt,
        tariffStatus,
        priceChangePct,
        priceMonth,
        usImportsYtd,
        avgTariffPct: avgTariffPct ?? null,
      }),
    ),
  }
}

// Monthly cumulative-YTD YoY of US imports of one product from one country,
// in month order, including null gaps where the file has no ratio. Empty when
// the researcher's file carries no series for the pair.
export function getProductImportSeries(iso: string, hs: string): ImportPoint[] {
  const packed = PRODUCT_MONTHS[iso]?.[hs]
  if (!packed) return []
  const [first, values] = packed
  let y = parseInt(first, 10)
  let m = parseInt(first.slice(5), 10)
  return values.map((cumYoy) => {
    const date = `${y}-${String(m).padStart(2, "0")}`
    if (++m > 12) {
      m = 1
      y++
    }
    return { date, cumYoy }
  })
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
