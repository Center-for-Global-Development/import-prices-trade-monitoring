# Scripts

## build_app_data.mjs

Converts the CSVs in `data/` into the JSON the app loads. It runs
automatically before `npm run dev` and `npm run build`. See the main README
for [how to update the data](../README.md#updating-the-data) and
[how the output fits together](../README.md#how-the-code-fits-together), and
[`data/README.md`](../data/README.md) for the input columns.

## build_world_map.mjs — world-map geometry for the home page

Precomputes SVG paths for the clickable country map from the World Bank
Official Boundaries (CC BY 4.0, low-resolution GeoJSON distribution;
https://datacatalog.worldbank.org/search/dataset/0038272), keyed by ISO3.
Needs the dev deps `d3-geo topojson-server topojson-client topojson-simplify`
(in package.json). The source zip is fetched into `scripts/.cache/` (git-
ignored) on first run. Rerun only if the projection, geometry source or
simplification thresholds change.

```bash
node scripts/build_world_map.mjs   # writes src/data/world_map.json
```

Why the World Bank set: Natural Earth (the earlier world-atlas source) draws
de facto control, which put Crimea inside Russia and left Somaliland,
Northern Cyprus and Kosovo as holes because they carry no ISO code. The World
Bank set follows UN cartographic practice and ships disputed areas (Western
Sahara, Aksai Chin, Arunachal Pradesh, Abyei, Demchok) and dashed / dotted
boundary lines as separate layers; the output carries those through as
`disputed` and `borders` so the map renders them hatched and dashed, with a
source note and the standard "boundaries do not imply" disclaimer under the
map. Taiwan is lifted out of China's polygon (the World Bank folds it in) so
it stays clickable, matching how US trade statistics report it.

The output omits islets under ~80 km² and territories that simplify away
(microstates, small island dependencies, Hong Kong, Macao, Singapore) — those
countries are reachable through the searchable list only.
