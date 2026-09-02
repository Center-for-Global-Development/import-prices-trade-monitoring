// Precomputes world-map SVG paths for the home-page country map, so the app
// ships no d3/topojson at runtime.
//
//   node scripts/build_world_map.mjs   ->  src/data/world_map.json
//
// Geometry: world-atlas countries-110m (Natural Earth). Features are keyed by
// numeric ISO 3166-1 code; i18n-iso-countries converts those to the alpha-3
// codes the tracker data uses. Antarctica is dropped for vertical space, and
// 110m resolution omits the smallest islands — the searchable list remains the
// way in for countries too small to click.

import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { geoNaturalEarth1, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import countriesIso from "i18n-iso-countries"

const require = createRequire(import.meta.url)
const topo = JSON.parse(
  readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8"),
)

const WIDTH = 975
const world = feature(topo, topo.objects.countries)
world.features = world.features.filter((f) => f.id !== "010") // Antarctica

const projection = geoNaturalEarth1().fitWidth(WIDTH, world)
const path = geoPath(projection)
const [, [, maxY]] = path.bounds(world)
const height = Math.ceil(maxY)

const countries = []
for (const f of world.features) {
  const iso = f.id ? countriesIso.numericToAlpha3(f.id) : undefined
  const d = path(f)
  if (!iso || !d) continue
  // Round path coordinates to 1 decimal to keep the JSON small.
  countries.push({
    iso,
    name: f.properties.name,
    d: d.replace(/(\d+\.\d\d+)/g, (m) => Number(m).toFixed(1)),
  })
}

const out = { width: WIDTH, height, countries }
writeFileSync(
  new URL("../src/data/world_map.json", import.meta.url),
  JSON.stringify(out),
)
console.log(`world_map.json: ${countries.length} countries, ${WIDTH}x${height}`)
