# Event Tracking: US Import Price and Value Tracker

`interactive_name`: `import-prices-trade-monitoring`

Tracking implemented per the CGD Interactive Analytics Tracking Standard.
Every call goes through `src/lib/tracking.ts`.

`interactive_view` fires once per page load. The tracker is one single-page
app in one iframe, so opening a country is a `navigate` engagement, not a new
view.

## Tracked Events

### Home page

| `action_type` | `action_label` | `action_value` | Notes |
|---|---|---|---|
| `navigate` | `country_list` | country ISO3, e.g. `MEX` | Country picked from the searchable list (217 possible values) |
| `navigate` | `country_map` | country ISO3 | Country clicked on the world map. Not sent when the click ends a drag |
| `external_link` | `map_boundaries_source` | | World Bank Official Boundaries link under the map |

### Country page

| `action_type` | `action_label` | `action_value` | Notes |
|---|---|---|---|
| `navigate` | `back_to_countries_top` | | "All countries" button at the top (also the error-state button) |
| `navigate` | `back_to_countries_bottom` | | "All countries" button at the foot of the page |
| `navigate` | `section_nav` | `price-trends`, `import-value`, `import-value-by-product`, `tracked-products` | "Jump to" links |
| `view_control` | `price_trends_expand`, `import_value_expand`, `import_value_by_product_expand` | `fullscreen`, `inline`, `collapse` | Chart expand button. `inline` means full screen was refused (e.g. inside the cgdev.org iframe or on iPhone) and the chart grew in place. Closing with Escape isn't tracked |
| `detail_open` | `glossary_term` | `hs4`, `qualifying`, `tracked`, `tariffed`, `exempt`, `partial` | Definition popover opened by click, tap or keyboard, including a click that pins a popover hover opened |

### Price trends and Import value by product charts

Both charts share the product picker. Labels start with `price_trends_` or
`product_imports_`.

| `action_type` | `action_label` | `action_value` | Notes |
|---|---|---|---|
| `detail_open` | `<chart>_product_picker` | | Product list opened |
| `detail_close` | `<chart>_product_picker` | | Product list closed (toggle button, Done, or Escape) |
| `filter` | `<chart>_product_add` | HS4 code, e.g. `0702` | Product checkbox ticked (176 possible values) |
| `filter` | `<chart>_product_remove` | HS4 code | Product checkbox unticked |
| `preset` | `<chart>_quick_select` | `tariffed`, `exempt`, `partially_exempt`, `clear` | Quick-select buttons that replace the whole selection |

### Tracked products table

| `action_type` | `action_label` | `action_value` | Notes |
|---|---|---|---|
| `filter` | `table_search` | | Sent once each time the search box goes from empty to non-empty. The search text is never sent |
| `filter` | `table_status_filter` | `all`, `tariffed`, `partially_exempt`, `exempt` | Status filter buttons. Not sent when clicking the filter that is already active |
| `view_control` | `table_sort` | `<column>_<asc\|desc>`, columns `hs`, `name`, `share`, `tariff`, `rate`, `imports` | Column header sort. The value is the resulting order |
| `detail_open` | `table_show_all` | | "Show all N products" |
| `detail_close` | `table_show_all` | | "Collapse" |

## Not Tracked

- **Chart tooltips and hover-opened definitions:** hover events, per the standard.
- **Map pan, drag, wheel zoom and the zoom and reset buttons:** map pan/zoom, per the standard.
- **Typing in the home page country search:** free text. The country the reader picks is tracked instead.
- **Retry button on a failed country load:** an error recovery, not reader behavior.
- **"Back to home" link on the country-not-found page:** reached only by a bad URL.
