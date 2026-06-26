#!/usr/bin/env Rscript
# =============================================================================
# fetch_tracker_data.R
#
# Pulls the real data that backs the Import Prices & Trade Monitoring tracker,
# replacing the dummy data in src/data/seriesByCountry.ts.
#
# Three sources, mapped to the app's data model (src/data/seriesByCountry.ts):
#
#   1. BLS Import Price Index API   -> Product.priceSeries  (monthly index)
#        series EIUIP<HS4>, re-based so baseMonth = 100.
#        NOTE: BLS publishes these by HS good for ALL U.S. imports, not by
#        country of origin, so a given HS4 has the SAME price series for every
#        country. (The dummy data faked per-country variation that won't exist.)
#
#   2. U.S. Census Intl Trade API   -> CountryData.importValue (monthly $, by
#        country total) and Product.importValueYTD (YTD $, by country x HS4).
#
#   3. UN Comtrade API              -> Product.shareToUS
#        = (country's exports of HS4 to USA) / (country's exports of HS4 to World)
#        for the latest full year. Drives the >=10% product-selection filter.
#
# Inputs:
#   - src/data/products.json        (which countries / HS4 codes to pull)
#   - reference/apikey.txt          (BLS registration key, required)
#   - reference/census_apikey.txt   (optional; Census works keyless <=500/day)
#   - reference/comtrade_apikey.txt (optional; raises Comtrade rate limits)
#
# Output:
#   - src/data/tracker_data.json    (consumed by the app)
#   - scripts/output/*.csv          (tidy CSVs for researcher inspection)
#
# Run from the repo root:   Rscript scripts/fetch_tracker_data.R
# =============================================================================

suppressWarnings(suppressMessages({
  required_packages <- c("httr", "jsonlite")
  missing <- required_packages[!required_packages %in% installed.packages()[, "Package"]]
  if (length(missing) > 0) {
    message("Installing missing packages: ", paste(missing, collapse = ", "))
    install.packages(missing, repos = "https://cloud.r-project.org")
  }
  library(httr)
  library(jsonlite)
}))

# --- Resolve paths relative to the repo root (works from anywhere) -----------
this_file <- (function() {
  args <- commandArgs(trailingOnly = FALSE)
  m <- grep("^--file=", args, value = TRUE)
  if (length(m) > 0) return(normalizePath(sub("^--file=", "", m[1])))
  "scripts/fetch_tracker_data.R"
})()
REPO_ROOT    <- normalizePath(file.path(dirname(this_file), ".."))
PRODUCTS_FILE <- file.path(REPO_ROOT, "src", "data", "products.json")
OUTPUT_JSON   <- file.path(REPO_ROOT, "src", "data", "tracker_data.json")
OUTPUT_DIR    <- file.path(REPO_ROOT, "scripts", "output")
REFERENCE_DIR <- file.path(REPO_ROOT, "reference")
dir.create(OUTPUT_DIR, showWarnings = FALSE, recursive = TRUE)

BLS_URL      <- "https://api.bls.gov/publicAPI/v2/timeseries/data/"
CENSUS_HS    <- "https://api.census.gov/data/timeseries/intltrade/imports/hs"
COMTRADE_URL <- "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
USA_PARTNER  <- "842"   # Comtrade M49 code for the United States

`%||%` <- function(a, b) if (is.null(a)) b else a

read_key <- function(name, required = FALSE) {
  path <- file.path(REFERENCE_DIR, name)
  if (!file.exists(path)) {
    if (required) stop("Required key file not found: ", path)
    return(NULL)
  }
  trimws(readLines(path, n = 1, warn = FALSE))
}

# --- Load config -------------------------------------------------------------
cfg <- fromJSON(PRODUCTS_FILE, simplifyVector = FALSE)
base_month  <- cfg$baseMonth                     # e.g. "2025-01"
base_year   <- as.integer(substr(base_month, 1, 4))
base_mnum   <- as.integer(substr(base_month, 6, 7))
this_year   <- as.integer(format(Sys.Date(), "%Y"))
years       <- base_year:this_year
# Pull import-value months from the year before the base year too, so the
# import-value chart can show a real prior-year YoY (not a synthesized one).
census_value_years <- (base_year - 1):this_year
# Comtrade reports annual data with a lag; try most-recent-available first.
share_year_candidates <- (this_year - 2):(this_year - 4)   # e.g. 2024, 2023, 2022

bls_key      <- read_key("apikey.txt", required = TRUE)
census_key   <- read_key("census_apikey.txt")
comtrade_key <- read_key("comtrade_apikey.txt")

countries <- cfg$countries
all_hs <- unique(unlist(lapply(countries, function(c) vapply(c$products, function(p) p$hs, ""))))

cat(sprintf("Repo: %s\n", REPO_ROOT))
cat(sprintf("Countries: %d | unique HS4 codes: %d | years: %d-%d | base: %s\n\n",
            length(countries), length(all_hs), base_year, this_year, base_month))
cat(sprintf("Keys -> BLS: yes | Census: %s | Comtrade: %s\n\n",
            ifelse(is.null(census_key), "keyless", "yes"),
            ifelse(is.null(comtrade_key), "keyless/preview", "yes")))

ym <- function(y, m) sprintf("%04d-%02d", y, as.integer(m))

# =============================================================================
# 1. BLS import price indices  ->  priceSeries (one series per unique HS4)
# =============================================================================
fetch_bls <- function(hs_codes, start_year, end_year) {
  series_ids <- paste0("EIUIP", sprintf("%04s", hs_codes))
  batches <- split(series_ids, ceiling(seq_along(series_ids) / 50))   # API max 50/req
  out <- list()
  for (i in seq_along(batches)) {
    cat(sprintf("  BLS batch %d/%d (%d series)...\n", i, length(batches), length(batches[[i]])))
    payload <- list(seriesid = batches[[i]], startyear = as.character(start_year),
                    endyear = as.character(end_year), registrationkey = bls_key)
    resp <- POST(BLS_URL, body = toJSON(payload, auto_unbox = TRUE), content_type_json())
    if (http_error(resp)) { warning("BLS HTTP error: ", status_code(resp)); next }
    res <- content(resp, as = "parsed", simplifyVector = FALSE)
    if (!identical(res$status, "REQUEST_SUCCEEDED")) {
      warning("BLS: ", paste(unlist(res$message), collapse = "; "))
    }
    for (s in res$Results$series) {
      hs <- sub("^EIUIP", "", s$seriesID)
      hs <- sub("^0+", "", hs)  # strip the zero-padding back to the app's HS form
      pts <- list()
      for (d in s$data) {
        if (!startsWith(d$period, "M")) next            # monthly only (skip M13 annual avg)
        if (d$period == "M13") next
        mnum <- as.integer(sub("^M", "", d$period))
        pts[[length(pts) + 1]] <- list(year = as.integer(d$year), month = mnum,
                                       date = ym(as.integer(d$year), mnum),
                                       value = as.numeric(d$value))
      }
      if (length(pts) > 0) out[[hs]] <- pts
    }
    if (i < length(batches)) Sys.sleep(0.5)
  }
  out
}

cat("[1/3] BLS import price indices...\n")
bls_raw <- tryCatch(fetch_bls(all_hs, base_year, this_year),
                    error = function(e) { warning("BLS failed: ", conditionMessage(e)); list() })

# Re-base each HS series so baseMonth = 100, return ordered list of {date, idx}.
price_series <- list()
for (hs in names(bls_raw)) {
  pts <- bls_raw[[hs]]
  pts <- pts[order(vapply(pts, function(p) p$date, ""))]
  base_val <- NA_real_
  for (p in pts) if (p$year == base_year && p$month == base_mnum) base_val <- p$value
  if (is.na(base_val) || base_val == 0) {
    base_val <- pts[[1]]$value   # fall back to first available month
    warning(sprintf("HS %s: no %s observation; re-based to first month %s.",
                    hs, base_month, pts[[1]]$date))
  }
  price_series[[hs]] <- lapply(pts, function(p)
    list(date = p$date, idx = round(p$value / base_val * 100, 1)))
}
cat(sprintf("  -> price series for %d/%d HS4 codes (BLS doesn't publish the rest)\n\n",
            length(price_series), length(all_hs)))

# =============================================================================
# 2. U.S. Census import values
#    a) monthly total imports per country  -> importValue
#    b) YTD imports per country x HS4       -> importValueYTD
# =============================================================================
if (is.null(census_key)) {
  warning("No reference/census_apikey.txt found. The Census API now REQUIRES a key ",
          "(free: https://api.census.gov/data/key_signup.html). Import values will be skipped.")
}

census_get <- function(url, query) {
  if (is.null(census_key)) return(NULL)
  query$key <- census_key
  resp <- GET(url, query = query)
  if (http_error(resp)) { warning("Census HTTP ", status_code(resp), " for ", url); return(NULL) }
  txt <- content(resp, as = "text", encoding = "UTF-8")
  if (!startsWith(trimws(txt), "[")) { warning("Census non-data response: ", substr(txt, 1, 120)); return(NULL) }
  m <- fromJSON(txt, simplifyVector = TRUE)        # array-of-arrays, row 1 = header
  if (is.null(dim(m)) || nrow(m) < 2) return(NULL)
  df <- as.data.frame(m[-1, , drop = FALSE], stringsAsFactors = FALSE)
  colnames(df) <- m[1, ]
  df
}

cat("[2/3] U.S. Census import values...\n")
country_import_value <- list()   # iso -> list of {date, usdBn}
product_ytd <- list()            # "iso|hs" -> usdBn (latest year YTD)

for (c in countries) {
  iso <- c$iso
  cat(sprintf("  %s (Census code %s)...\n", iso, c$censusCode))

  # (a) monthly country totals, all years.
  # I_COMMODITY="-" on the HS endpoint is the all-commodities total for the country.
  monthly <- list()
  for (y in census_value_years) {
    df <- census_get(CENSUS_HS, list(get = "CTY_NAME,GEN_VAL_MO,MONTH",
                                     time = as.character(y), CTY_CODE = c$censusCode,
                                     I_COMMODITY = "-"))
    if (is.null(df)) next
    df$GEN_VAL_MO <- suppressWarnings(as.numeric(df$GEN_VAL_MO))
    df$MONTH <- as.integer(df$MONTH)
    df <- df[!is.na(df$MONTH) & !is.na(df$GEN_VAL_MO), ]
    for (i in seq_len(nrow(df))) {
      monthly[[length(monthly) + 1]] <- list(date = ym(y, df$MONTH[i]),
                                             usdBn = df$GEN_VAL_MO[i] / 1e9)
    }
    Sys.sleep(0.2)
  }
  if (length(monthly) > 0) monthly <- monthly[order(vapply(monthly, function(x) x$date, ""))]
  country_import_value[[iso]] <- monthly

  # (b) YTD value per HS4 for the latest year present in the data
  ytd_year <- if (length(monthly) > 0) as.integer(substr(monthly[[length(monthly)]]$date, 1, 4)) else this_year
  for (p in c$products) {
    df <- census_get(CENSUS_HS, list(get = "I_COMMODITY,GEN_VAL_MO,MONTH",
                                     time = as.character(ytd_year), CTY_CODE = c$censusCode,
                                     COMM_LVL = "HS4", I_COMMODITY = p$hs))
    val <- 0
    if (!is.null(df)) {
      df$GEN_VAL_MO <- suppressWarnings(as.numeric(df$GEN_VAL_MO))
      val <- sum(df$GEN_VAL_MO, na.rm = TRUE)
    }
    product_ytd[[paste0(iso, "|", p$hs)]] <- val / 1e9
    Sys.sleep(0.2)
  }
}
cat("  -> Census import values collected\n\n")

# =============================================================================
# 3. UN Comtrade  ->  shareToUS  (exports to USA / exports to World, share_year)
# =============================================================================
# Authenticated endpoint (with key) lifts the brutal preview rate limit.
comtrade_endpoint <- if (!is.null(comtrade_key))
  "https://comtradeapi.un.org/data/v1/get/C/A/HS" else COMTRADE_URL
comtrade_wait <- if (!is.null(comtrade_key)) 0.5 else 6.0   # preview ~1 req / few sec

comtrade_get <- function(reporter, cmd_codes, partner, period) {
  # motCode/customsCode/partner2Code aggregates -> one row per cmd x partner.
  query <- list(reporterCode = reporter, period = as.character(period),
                partnerCode = partner, cmdCode = paste(cmd_codes, collapse = ","),
                flowCode = "X", motCode = "0", customsCode = "C00", partner2Code = "0")
  hdr <- if (!is.null(comtrade_key)) add_headers(`Ocp-Apim-Subscription-Key` = comtrade_key) else NULL
  resp <- GET(comtrade_endpoint, query = query, hdr)
  Sys.sleep(comtrade_wait)
  if (status_code(resp) == 429) { Sys.sleep(comtrade_wait * 2); return("RETRY") }
  if (http_error(resp)) { warning("Comtrade HTTP ", status_code(resp), " reporter ", reporter); return(NULL) }
  res <- content(resp, as = "parsed", simplifyVector = TRUE)
  if (is.null(res$data) || length(res$data) == 0) return(NULL)
  res$data
}

cat("[3/3] UN Comtrade export shares (latest available of ",
    paste(share_year_candidates, collapse = "/"), ")...\n", sep = "")
product_share <- list()   # "iso|hs" -> share 0..1
for (c in countries) {
  iso <- c$iso
  hs_codes <- vapply(c$products, function(p) p$hs, "")
  d <- NULL; used_year <- NA
  for (yr in share_year_candidates) {                 # most recent reported year wins
    attempt <- tryCatch(comtrade_get(c$comtradeCode, hs_codes, paste0(USA_PARTNER, ",0"), yr),
                        error = function(e) { warning(conditionMessage(e)); NULL })
    if (identical(attempt, "RETRY")) {                # one retry after backoff
      attempt <- tryCatch(comtrade_get(c$comtradeCode, hs_codes, paste0(USA_PARTNER, ",0"), yr),
                          error = function(e) NULL)
    }
    if (!is.null(attempt) && !identical(attempt, "RETRY") && nrow(attempt) > 0) {
      d <- attempt; used_year <- yr; break
    }
  }
  cat(sprintf("  %s (Comtrade reporter %s): %s\n", iso, c$comtradeCode,
              if (is.null(d)) "no data" else paste("year", used_year)))
  if (!is.null(d) && nrow(d) > 0) {
    d$cmdCode <- as.character(d$cmdCode)
    d$partnerCode <- as.character(d$partnerCode)
    d$primaryValue <- suppressWarnings(as.numeric(d$primaryValue))
    for (hs in hs_codes) {
      to_us    <- sum(d$primaryValue[d$cmdCode == hs & d$partnerCode == USA_PARTNER], na.rm = TRUE)
      to_world <- sum(d$primaryValue[d$cmdCode == hs & d$partnerCode == "0"], na.rm = TRUE)
      share <- if (is.finite(to_world) && to_world > 0) to_us / to_world else NA_real_
      product_share[[paste0(iso, "|", hs)]] <- if (is.na(share)) NA_real_ else round(min(share, 1), 4)
    }
  }
}
cat("  -> Comtrade shares collected\n\n")

# =============================================================================
# Assemble output JSON in the app's shape
# =============================================================================
out_countries <- list()
flat_rows <- list()   # for the tidy CSV
for (c in countries) {
  iso <- c$iso
  products <- lapply(c$products, function(p) {
    key   <- paste0(iso, "|", p$hs)
    share <- product_share[[key]]
    ytd   <- product_ytd[[key]]
    ps    <- price_series[[p$hs]]
    flat_rows[[length(flat_rows) + 1]] <<- data.frame(
      iso = iso, hs = p$hs, name = p$name,
      shareToUS = ifelse(is.null(share) || is.na(share), NA, share),
      importValueYTD = ifelse(is.null(ytd), NA, ytd),
      hasPriceSeries = !is.null(ps),
      stringsAsFactors = FALSE)
    list(hs = p$hs, name = p$name,
         shareToUS = if (is.null(share) || is.na(share)) NULL else share,
         importValueYTD = if (is.null(ytd)) NULL else round(ytd, 3),
         priceSeries = if (is.null(ps)) list() else ps)
  })
  out_countries[[iso]] <- list(iso = iso, products = products,
                               importValue = country_import_value[[iso]] %||% list())
}

output <- list(
  generatedAt = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"),
  baseMonth = base_month,
  shareYearCandidates = share_year_candidates,
  countries = out_countries
)

write(toJSON(output, auto_unbox = TRUE, pretty = TRUE, null = "null"), OUTPUT_JSON)
cat(sprintf("Wrote %s\n", OUTPUT_JSON))

if (length(flat_rows) > 0) {
  prod_csv <- do.call(rbind, flat_rows)
  write.csv(prod_csv, file.path(OUTPUT_DIR, "products_summary.csv"), row.names = FALSE)
  cat(sprintf("Wrote %s\n", file.path(OUTPUT_DIR, "products_summary.csv")))
}

cat("\nDone.\n")
