# Fetch all BLS Harmonized System Import Price Index data.
#
# Reads the researcher's product list (OEC - BLS HS Translations.csv) and queries
# every HS code against the BLS API. BLS only publishes indices for a subset of
# HS codes, so non-existent series are silently skipped.
#
# Series format: EIUIP + zero-padded HS code (e.g. EIUIP0102, EIUIP8703)
# Survey: Import/Export Price Indexes (EI)
#
# The BLS API allows up to 50 series per POST request (v2 with registration).

## FOR MAC:
setwd("/Users/katebarnes/Library/CloudStorage/OneDrive-CenterforGlobalDevelopment/Mike Brown's files - LilianaShare/6 - Projects/Tariffs/APIs")

## FOR WINDOWS: 
#setwd("C:/Users/KateBarnes/OneDrive - Center for Global Development/Mike Brown's files - LilianaShare/6 - Projects/Tariffs/APIs")

required_packages <- c("httr", "jsonlite", "dplyr")
missing <- required_packages[!required_packages %in% installed.packages()[, "Package"]]
if (length(missing) > 0) {
  message("Installing missing packages: ", paste(missing, collapse = ", "))
  install.packages(missing, repos = "https://cloud.r-project.org")
}

library(httr)
library(jsonlite)
library(dplyr, warn.conflicts = FALSE)

API_KEY_FILE <- "apikey.txt"
BASE_URL <- "https://api.bls.gov/publicAPI/v2/timeseries/data/"
PRODUCT_LIST_FILE <- "OEC-BLS Translations for API.csv"
BATCH_SIZE <- 50

load_api_key <- function(path = API_KEY_FILE) {
  trimws(readLines(path, n = 1, warn = FALSE))
}

load_product_list <- function(path = PRODUCT_LIST_FILE) {
  raw <- read.csv(path, header = FALSE, stringsAsFactors = FALSE,
                  colClasses = "character")
  colnames(raw) <- c("label", "hs_code", "product_name")

  raw <- raw[grepl("^\\d+$", trimws(raw$hs_code)), ]
  raw$hs_code <- sprintf("%04s", trimws(raw$hs_code))
  raw$series_id <- paste0("EIUIP", raw$hs_code)
  raw$product_name <- trimws(raw$product_name)

  raw[, c("series_id", "hs_code", "product_name")]
}

fetch_series_batch <- function(series_ids, start_year, end_year, api_key) {
  payload <- list(
    seriesid = series_ids,
    startyear = start_year,
    endyear = end_year,
    registrationkey = api_key,
    catalog = TRUE
  )

  resp <- POST(BASE_URL,
               body = toJSON(payload, auto_unbox = TRUE),
               content_type_json())
  stop_for_status(resp)

  result <- content(resp, as = "parsed", simplifyVector = FALSE)

  if (!identical(result$status, "REQUEST_SUCCEEDED")) {
    warning("API warning: ", paste(result$message, collapse = "; "))
  }

  if (!is.null(result$Results$series)) result$Results$series else list()
}

fetch_all <- function(start_year, end_year) {
  api_key <- load_api_key()
  products <- load_product_list()
  series_ids <- products$series_id
  name_lookup <- setNames(products$product_name, products$series_id)

  cat(sprintf("Loaded %d HS codes from %s\n", length(series_ids), PRODUCT_LIST_FILE))
  cat(sprintf("Fetching %s-%s in batches of %d...\n\n", start_year, end_year, BATCH_SIZE))

  batches <- split(series_ids, ceiling(seq_along(series_ids) / BATCH_SIZE))
  n_batches <- length(batches)

  all_rows <- list()

  for (i in seq_along(batches)) {
    cat(sprintf("  Batch %d/%d (%d series)...\n", i, n_batches, length(batches[[i]])))
    series_data <- fetch_series_batch(batches[[i]], start_year, end_year, api_key)

    for (series in series_data) {
      sid <- series$seriesID
      data_points <- series$data
      if (is.null(data_points) || length(data_points) == 0) next

      catalog <- if (!is.null(series$catalog)) series$catalog else list()
      base_period <- if (!is.null(catalog$base_period)) catalog$base_period else ""
      product_name <- name_lookup[sid]
      if (is.na(product_name)) {
        product_name <- if (!is.null(catalog$series_title)) catalog$series_title else ""
      }

      for (point in data_points) {
        footnotes <- ""
        if (!is.null(point$footnotes) && length(point$footnotes) > 0) {
          fn_texts <- vapply(point$footnotes, function(f) {
            if (is.null(f) || is.null(f$text)) "" else f$text
          }, character(1))
          footnotes <- paste(fn_texts[fn_texts != ""], collapse = "; ")
        }

        all_rows[[length(all_rows) + 1]] <- data.frame(
          series_id = sid,
          hs_code = sub("^EIUIP", "", sid),
          product = product_name,
          base_period = base_period,
          year = point$year,
          period = point$period,
          month = sub("^M", "", point$period),
          value = point$value,
          footnotes = footnotes,
          stringsAsFactors = FALSE
        )
      }
    }

    if (i < n_batches) Sys.sleep(0.5)
  }

  if (length(all_rows) == 0) return(data.frame())

  result <- bind_rows(all_rows)
  
  if (nrow(result) == 0) {
    return(data.frame())
  }
  
  result <- result %>%
    mutate(
      value = as.numeric(value),
      month = as.integer(month),
      year = as.integer(year)
    )
  
  jan2025_lookup <- result %>%
    filter(year == 2025, month == 1) %>%
    select(series_id, jan2025_value = value)
  
  result <- result %>%
    left_join(jan2025_lookup, by = "series_id") %>%
    mutate(
      cumulative_price_index = ifelse(
        !is.na(jan2025_value),
        ((value / jan2025_value) - 1) * 100,
        NA_real_
      )
    ) %>%
    arrange(series_id, year, month)
}

save_csv <- function(df, path) {
  if (nrow(df) == 0) {
    cat("No data to save.\n")
    return(invisible(NULL))
  }
  write.csv(df, path, row.names = FALSE)
  cat(sprintf("Saved %s data points -> %s\n", format(nrow(df), big.mark = ","), path))
}

# --- Main ---
start_year <- "2025"
end_year <- as.character(as.integer(format(Sys.Date(), "%Y")))

rows <- fetch_all(start_year, end_year)
save_csv(rows, "harmonized_imports_2026.04.15.csv")

cat("\nSample rows:\n")
head(rows, 3) |>
  mutate(display = sprintf("  %s | %-40s | %s %s | %s",
                           series_id, substr(product, 1, 40), year, period, value)) |>
  pull(display) |>
  cat(sep = "\n")
cat("\n")






#### ADDING INDEX
library(dplyr)
library(readr)
library(lubridate)

# Read data
df2 <- read_csv("harmonized_imports_2026.04.15.csv")

# Index each product series to January 2025 = 100
df2_indexed <- df2 %>%
  mutate(
    date = ym(paste(year, month))
  ) %>%
  arrange(series_id, date) %>%
  group_by(series_id) %>%
  mutate(
    jan2025_value = if (any(date == ymd("2025-01-01"))) {
      first(value[date == ymd("2025-01-01")])
    } else {
      NA_real_
    },
    value_jan2025_100 = (value / jan2025_value) * 100
  ) %>%
  ungroup()

# Show any series missing Jan 2025
missing_base <- df2_indexed %>%
  group_by(series_id, hs_code, product) %>%
  summarise(
    missing_jan2025 = all(is.na(jan2025_value)),
    .groups = "drop"
  ) %>%
  filter(missing_jan2025)

print(missing_base)

# Check that Jan 2025 rows are exactly 100
check_base <- df2_indexed %>%
  filter(date == ymd("2025-01-01")) %>%
  select(series_id, hs_code, product, date, value, jan2025_value, value_jan2025_100)

print(check_base)

# Save output
write_csv(df2_indexed, "harmonized_imports_latest_indexed_jan2025_2026.04.15.csv")
