// Precomputes world-map SVG paths for the home-page country map, so the app
// ships no d3/topojson at runtime.
//
//   node scripts/build_world_map.mjs   ->  src/data/world_map.json
//
// Geometry: World Bank Official Boundaries (CC BY 4.0), low-resolution GeoJSON
// distribution. https://datacatalog.worldbank.org/search/dataset/0038272
// The zips are fetched into scripts/.cache/ (git-ignored) on first run.
//
// Why the World Bank set rather than Natural Earth (world-atlas): Natural
// Earth draws de facto control, so Crimea sat inside Russia and Somaliland,
// Northern Cyprus and Kosovo were separate features with no ISO code that
// fell out of the map as holes. The World Bank set follows UN cartographic
// practice — Crimea in Ukraine, Somaliland in Somalia, Northern Cyprus in
// Cyprus, Kosovo as its own feature — and ships the disputed areas (Western
// Sahara, Aksai Chin, Arunachal Pradesh, Abyei, Demchok, the UN buffer zone in
// Cyprus) as separate polygons plus dashed/dotted boundary lines. Those are
// emitted as non-clickable layers so the map can render them the same way.
//
// Taiwan: the World Bank set folds Taiwan into China's polygon. US trade data
// (and this tracker) report Taiwan separately, so its rings are lifted out of
// China by bounding box into a TWN feature that stays clickable.
//
// Simplification: topojson-simplify on a shared topology, so neighbouring
// borders stay coincident; the threshold targets a JSON roughly the size of
// the old 110m output while keeping enough detail for the map's ~8x zoom.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { geoArea, geoNaturalEarth1, geoPath } from "d3-geo"
import { topology } from "topojson-server"
import { feature } from "topojson-client"
import {
  filter,
  filterWeight,
  presimplify,
  simplify,
  sphericalRingArea,
  sphericalTriangleArea,
} from "topojson-simplify"

const CACHE = new URL("./.cache/wb_boundaries/", import.meta.url)
const BASE = "https://datacatalogfiles.worldbank.org/ddh-published/0038272/"
const ZIPS = {
  "wb_boundaries_geojson_lowres.zip": "DR0046667/",
}
const FILES = {
  countries: "WB_Boundaries_GeoJSON_lowres/WB_countries_Admin0_lowres.geojson",
  disputed: "WB_Boundaries_GeoJSON_lowres/WB_disputed_areas_Admin0_10m_lowres.geojson",
  lines: "WB_Boundaries_GeoJSON_lowres/WB_Adm0_boundary_lines_10m_lowres.geojson",
  disputedLines:
    "WB_Boundaries_GeoJSON_lowres/WB_Adm0_boundary_lines_disputed_areas_10m_lowres.geojson",
}

const WIDTH = 975
// Simplification thresholds, in steradians (1 px² at the base zoom is roughly
// 4e-5 sr; at the map's 6x maximum zoom it is about 1e-6 sr).
//   MIN_WEIGHT — Visvalingam triangle area below which a vertex is dropped.
//   MIN_RING   — ring (island) area below which the ring is dropped entirely;
//                such islets are a speck even fully zoomed in.
// Both can be overridden from the environment when tuning.
const MIN_WEIGHT = Number(process.env.MAP_MIN_WEIGHT ?? 6e-6)
const MIN_RING = Number(process.env.MAP_MIN_RING ?? 2e-6)
// Small islands would lose every interior vertex at MIN_WEIGHT and collapse.
// A ring standing alone as one arc instead keeps its ~RING_DETAIL heaviest
// vertices, so Malta or Mauritius stay a recognisable blob when zoomed.
const RING_DETAIL = 12

// The World Bank ISO_A3 is "-99" for a few features; WB_A3 fills the gap.
// Kosovo has no ISO code — XKX is the World Bank/IMF convention.
const WB_TO_ISO3 = { KSV: "XKX" }

async function ensureSources() {
  mkdirSync(CACHE, { recursive: true })
  for (const [zip, dir] of Object.entries(ZIPS)) {
    const target = new URL(zip, CACHE)
    if (existsSync(target)) continue
    console.log(`fetching ${zip} ...`)
    const res = await fetch(BASE + dir + zip)
    if (!res.ok) throw new Error(`${zip}: HTTP ${res.status}`)
    writeFileSync(target, Buffer.from(await res.arrayBuffer()))
    execFileSync("unzip", ["-o", "-q", target.pathname, "-d", CACHE.pathname])
  }
}

const loadGeo = (rel) => JSON.parse(readFileSync(new URL(rel, CACHE), "utf8"))

const polygonRings = (geom) =>
  geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates

// The World Bank GeoJSON follows RFC 7946 (counter-clockwise exteriors);
// d3-geo takes the opposite convention and reads such a ring as covering the
// whole globe except the country. Rewind so exteriors are clockwise and holes
// counter-clockwise in d3 terms.
const HEMISPHERE = 2 * Math.PI
function rewind(polys) {
  return polys.map((rings) =>
    rings.map((ring, i) => {
      const area = geoArea({ type: "Polygon", coordinates: [ring] })
      const wantSmall = i === 0
      return (area > HEMISPHERE) === wantSmall ? [...ring].reverse() : ring
    }),
  )
}

const ringBBox = (ring) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of ring) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}
const within = ([x0, y0, x1, y1], [X0, Y0, X1, Y1]) =>
  x0 >= X0 && x1 <= X1 && y0 >= Y0 && y1 <= Y1

// Taiwan main island plus offshore islands (Green, Orchid), and Penghu.
// Kinmen and Matsu — administered from Taipei but off the Fujian coast — are
// left with China because no box separates them from mainland islets.
const TAIWAN_BOXES = [
  [120.0, 21.8, 122.1, 25.35],
  [119.3, 23.1, 119.8, 23.9],
]

function countryKey(p) {
  const iso = p.ISO_A3 !== "-99" ? p.ISO_A3 : p.ISO_A3_EH !== "-99" ? p.ISO_A3_EH : p.WB_A3
  return WB_TO_ISO3[iso] ?? iso
}

await ensureSources()
const src = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, loadGeo(rel)]),
)

// ---- Countries: one MultiPolygon per ISO3, Taiwan lifted out of China -----
const byIso = new Map()
for (const f of src.countries.features) {
  if (!f.geometry) continue
  const iso = countryKey(f.properties)
  if (!iso || iso === "-99") {
    console.warn(`skipping ${f.properties.WB_NAME} (no ISO code)`)
    continue
  }
  let polys = rewind(polygonRings(f.geometry))
  if (iso === "CHN") {
    const taiwan = polys.filter((rings) =>
      TAIWAN_BOXES.some((box) => within(ringBBox(rings[0]), box)),
    )
    polys = polys.filter((p) => !taiwan.includes(p))
    byIso.set("TWN", { name: "Taiwan", polys: taiwan })
  }
  const cur = byIso.get(iso)
  if (cur) cur.polys.push(...polys)
  else byIso.set(iso, { name: f.properties.WB_NAME, polys })
}

const countryFeatures = [...byIso.entries()].map(([iso, { name, polys }]) => ({
  type: "Feature",
  id: iso,
  properties: { name },
  geometry: { type: "MultiPolygon", coordinates: polys },
}))

// ---- Disputed areas: neutral, non-clickable polygons -----------------------
const disputedFeatures = src.disputed.features
  .filter((f) => f.geometry && f.geometry.coordinates.length)
  .map((f) => ({
    type: "Feature",
    properties: { name: (f.properties.NAME_EN || f.properties.WB_NAME).trim() },
    geometry: { type: "MultiPolygon", coordinates: rewind(polygonRings(f.geometry)) },
  }))

// ---- Boundary lines that the World Bank draws dashed or dotted -------------
// The main line file marks disputed / indefinite / line-of-control segments
// in `featurecla`; the disputed-areas line file is entirely dashed or dotted
// (WB_STYLE). Solid international borders are not emitted: the map already
// shows them as the gap between adjacent country fills.
const DASHED = []
const DOTTED = []
for (const f of src.lines.features) {
  const cla = f.properties.featurecla ?? ""
  if (/line of control/i.test(cla)) DOTTED.push(f)
  else if (/disputed|indefinite/i.test(cla)) DASHED.push(f)
}
for (const f of src.disputedLines.features) {
  if (/dotted/i.test(f.properties.WB_STYLE)) DOTTED.push(f)
  else DASHED.push(f)
}
const lineCollection = (features) => ({
  type: "FeatureCollection",
  features: features.map((f) => ({ type: "Feature", properties: {}, geometry: f.geometry })),
})

// ---- Simplify all layers together so shared borders stay aligned -----------
let topo = topology(
  {
    countries: { type: "FeatureCollection", features: countryFeatures },
    disputed: { type: "FeatureCollection", features: disputedFeatures },
    dashed: lineCollection(DASHED),
    dotted: lineCollection(DOTTED),
  },
  1e5,
)
topo = presimplify(topo, sphericalTriangleArea)
for (const arc of topo.arcs) {
  const first = arc[0]
  const last = arc[arc.length - 1]
  if (arc.length < 4 || first[0] !== last[0] || first[1] !== last[1]) continue
  const ring = arc.map(([x, y]) => [x, y])
  const area = Math.min(sphericalRingArea(ring, true), sphericalRingArea(ring, false))
  const local = area / RING_DETAIL
  if (local >= MIN_WEIGHT) continue
  for (const p of arc) if (p[2] >= local) p[2] = Infinity
}
topo = simplify(topo, MIN_WEIGHT)
topo = filter(topo, filterWeight(topo, MIN_RING, sphericalRingArea))

// Simplification can leave a ring with too few distinct points to have an
// orientation (d3 then reads it as the whole globe), so drop degenerate rings
// and re-check winding on what survives.
function sanitize(fc) {
  for (const f of fc.features) {
    const polys = polygonRings(f.geometry)
      .map((rings) => rings.filter((r) => r.length >= 4))
      .filter((rings) => rings.length && rings[0].length >= 4)
    f.geometry = { type: "MultiPolygon", coordinates: rewind(polys) }
  }
  return fc
}
const countries = sanitize(feature(topo, topo.objects.countries))
const disputed = sanitize(feature(topo, topo.objects.disputed))
const dashed = feature(topo, topo.objects.dashed)
const dotted = feature(topo, topo.objects.dotted)

// ---- Project to SVG -------------------------------------------------------
const projection = geoNaturalEarth1().fitWidth(WIDTH, countries)
const path = geoPath(projection)
const [, [, maxY]] = path.bounds(countries)
const height = Math.ceil(maxY)

// Round path coordinates to 1 decimal to keep the JSON small.
const round = (d) => d.replace(/(\d+\.\d\d+)/g, (m) => Number(m).toFixed(1))
const pathOf = (obj) => {
  const d = path(obj)
  return d ? round(d) : null
}

const out = {
  width: WIDTH,
  height,
  countries: countries.features
    .map((f) => ({ iso: f.id, name: f.properties.name, d: pathOf(f) }))
    .filter((c) => c.d)
    .sort((a, b) => a.iso.localeCompare(b.iso)),
  disputed: disputed.features
    .map((f) => ({ name: f.properties.name, d: pathOf(f) }))
    .filter((c) => c.d),
  borders: {
    dashed: pathOf(dashed) ?? "",
    dotted: pathOf(dotted) ?? "",
  },
}

const outUrl = new URL("../src/data/world_map.json", import.meta.url)
writeFileSync(outUrl, JSON.stringify(out))
const kb = Math.round(Buffer.byteLength(JSON.stringify(out)) / 1024)
console.log(
  `world_map.json: ${out.countries.length} countries, ${out.disputed.length} disputed areas, ${WIDTH}x${height}, ${kb} KB`,
)
