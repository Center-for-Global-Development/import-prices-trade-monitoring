export type PricePoint = { date: string; idx: number }
export type ImportPoint = { date: string; usdBn: number }

export type Product = {
  hs: string
  name: string
  shareToUS: number
  priceSeries: PricePoint[]
}

export type CountryData = {
  iso: string
  products: Product[]
  importValue: ImportPoint[]
}

const MONTHS: string[] = (() => {
  const out: string[] = []
  for (let y = 2025; y <= 2026; y++) {
    const max = y === 2026 ? 3 : 12
    for (let m = 1; m <= max; m++) {
      out.push(`${y}-${String(m).padStart(2, "0")}`)
    }
  }
  return out
})()

function seedRand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function makePriceSeries(seed: number, drift: number, noise: number): PricePoint[] {
  const rand = seedRand(seed)
  let v = 100
  return MONTHS.map((date, i) => {
    if (i === 0) return { date, idx: 100 }
    v = v * (1 + drift / 100 + (rand() - 0.5) * (noise / 100))
    return { date, idx: Math.round(v * 10) / 10 }
  })
}

function makeImportSeries(seed: number, base: number, drift: number): ImportPoint[] {
  const rand = seedRand(seed)
  return MONTHS.map((date, i) => {
    const v = base * (1 + (drift / 100) * i + (rand() - 0.5) * 0.08)
    return { date, usdBn: Math.round(v * 100) / 100 }
  })
}

const PRODUCT_LIBRARY: Record<string, { hs: string; name: string }[]> = {
  VNM: [
    { hs: "8517", name: "Telephones & smartphones" },
    { hs: "6403", name: "Footwear, leather uppers" },
    { hs: "9401", name: "Seats & furniture" },
    { hs: "6204", name: "Women's apparel, woven" },
    { hs: "8471", name: "Computers & data-processing units" },
    { hs: "0901", name: "Coffee" },
    { hs: "4202", name: "Trunks, cases, handbags" },
  ],
  MEX: [
    { hs: "8703", name: "Passenger motor vehicles" },
    { hs: "8708", name: "Motor vehicle parts" },
    { hs: "2709", name: "Crude petroleum oils" },
    { hs: "8528", name: "Monitors & TVs" },
    { hs: "0702", name: "Tomatoes, fresh" },
    { hs: "2208", name: "Spirits (tequila etc.)" },
  ],
  CHN: [
    { hs: "8517", name: "Telephones & smartphones" },
    { hs: "8471", name: "Computers & data-processing units" },
    { hs: "9503", name: "Toys" },
    { hs: "9504", name: "Video game consoles" },
    { hs: "6404", name: "Footwear, textile uppers" },
  ],
  DEU: [
    { hs: "8703", name: "Passenger motor vehicles" },
    { hs: "3004", name: "Medicaments, packaged" },
    { hs: "9018", name: "Medical instruments" },
    { hs: "8479", name: "Industrial machinery" },
  ],
  CAN: [
    { hs: "2709", name: "Crude petroleum oils" },
    { hs: "4407", name: "Sawn wood" },
    { hs: "7108", name: "Gold, unwrought" },
    { hs: "8703", name: "Passenger motor vehicles" },
    { hs: "3102", name: "Mineral or chemical fertilisers" },
  ],
  JPN: [
    { hs: "8703", name: "Passenger motor vehicles" },
    { hs: "8708", name: "Motor vehicle parts" },
    { hs: "8479", name: "Industrial machinery" },
    { hs: "8542", name: "Electronic integrated circuits" },
  ],
  KOR: [
    { hs: "8542", name: "Electronic integrated circuits" },
    { hs: "8703", name: "Passenger motor vehicles" },
    { hs: "8517", name: "Telephones & smartphones" },
    { hs: "8528", name: "Monitors & TVs" },
  ],
  IND: [
    { hs: "3004", name: "Medicaments, packaged" },
    { hs: "7113", name: "Jewellery & parts" },
    { hs: "2710", name: "Refined petroleum oils" },
    { hs: "6204", name: "Women's apparel, woven" },
    { hs: "0306", name: "Crustaceans (shrimp etc.)" },
  ],
  BRA: [
    { hs: "2709", name: "Crude petroleum oils" },
    { hs: "7207", name: "Semi-finished iron/steel" },
    { hs: "0901", name: "Coffee" },
    { hs: "1701", name: "Cane or beet sugar" },
    { hs: "0805", name: "Citrus fruit, fresh" },
  ],
  THA: [
    { hs: "4001", name: "Natural rubber" },
    { hs: "8471", name: "Computers & data-processing units" },
    { hs: "8703", name: "Passenger motor vehicles" },
    { hs: "1604", name: "Prepared or preserved fish" },
    { hs: "9503", name: "Toys" },
  ],
}

const SHARE_OVERRIDES: Record<string, number> = {
  // Canada / Mexico products are nearly all destined for the US.
  "CAN:2709": 0.96,
  "CAN:8703": 0.92,
  "CAN:4407": 0.78,
  "CAN:3102": 0.85,
  "MEX:8703": 0.78,
  "MEX:8708": 0.81,
  "MEX:2709": 0.62,
  "MEX:0702": 0.92,
  "MEX:2208": 0.84,
  "VNM:6403": 0.41,
  "VNM:9401": 0.58,
  "VNM:8517": 0.22,
  "CHN:9503": 0.31,
  "CHN:9504": 0.28,
  "DEU:8703": 0.13,
  "DEU:3004": 0.22,
  "JPN:8703": 0.36,
  "KOR:8703": 0.34,
}

function shareFor(iso: string, hs: string, fallback: () => number): number {
  const key = `${iso}:${hs}`
  if (SHARE_OVERRIDES[key] !== undefined) return SHARE_OVERRIDES[key]
  return fallback()
}

const COUNTRY_DATA: Record<string, CountryData> = (() => {
  const out: Record<string, CountryData> = {}
  const isos = Object.keys(PRODUCT_LIBRARY)
  isos.forEach((iso, ci) => {
    const baseSeed = (ci + 1) * 1000
    const rand = seedRand(baseSeed + 7)
    const products: Product[] = PRODUCT_LIBRARY[iso].map((p, pi) => {
      const share = shareFor(iso, p.hs, () => 0.05 + rand() * 0.55)
      const drift = (rand() - 0.4) * 0.6
      const noise = 0.8 + rand() * 1.4
      return {
        hs: p.hs,
        name: p.name,
        shareToUS: Math.round(share * 100) / 100,
        priceSeries: makePriceSeries(baseSeed + pi * 11, drift, noise),
      }
    })
    const baseImports = 5 + ci * 3.5
    const importDrift = (rand() - 0.45) * 1.6
    out[iso] = {
      iso,
      products,
      importValue: makeImportSeries(baseSeed + 999, baseImports, importDrift),
    }
  })
  return out
})()

export function getCountryData(iso: string): CountryData | undefined {
  return COUNTRY_DATA[iso]
}

export const QUALIFYING_THRESHOLD = 0.1

export function qualifyingProducts(data: CountryData): Product[] {
  return data.products
    .filter((p) => p.shareToUS >= QUALIFYING_THRESHOLD)
    .sort((a, b) => b.shareToUS - a.shareToUS)
}
