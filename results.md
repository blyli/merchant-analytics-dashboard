# Acceptance Test Results

- **Live Preview URL:** https://merchant-analytics-dashboard-jnragy8dq-blylis-projects.vercel.app
- **Deployment ID:** `dpl_2KwC8baqBaezy777CXzACMys1pW6`
- **Reference Date:** Fixed at `2025-10-27` (dataset window: `2025-05-06` to `2025-10-27`)

## Summary

- **AQ-03:** Pass — resolved `"last week"` to `2025-10-20`–`2025-10-26` (return date), filtered to jackets, rendered return-reason chart and returned order lines (`Northridge Insulated Jacket`, S / Olive, Oct 23, Too small, $135.15, 1 unit).
- **AQ-07:** Pass — declined out-of-scope Meta ad spend without inventing a chart, noted available scope (orders, sales, customers, returns), and offered sales/returns alternatives.
- **Vague / Missing Date Sample (AQ-02, AQ-04, AQ-08, AQ-11, AQ-12):** All 5 rendered without crashing and applied concrete date windows (`2025-05-06` -> `2025-10-27` for AQ-02, AQ-04, AQ-08; `2025-10-27` for AQ-11; `2025-10-20` -> `2025-10-26` for AQ-12).

## Detailed Log

### AQ-03 — "which jackets came back the most last week"
- **Status:** Pass
- **Date Range Used:** `2025-10-20` – `2025-10-26` (last week relative to `2025-10-27`, filtered on return date)
- **Chart / Output:** Rendered *Refunds by return reason* (`Too small`, `$135.15`), *Returned order lines* table (`Northridge Insulated Jacket`, `S / Olive`, `Oct 23`, `Too small`, `$135.15`), and summary noting it was the sole jacket return (`1` unit).
- **Screenshot:** `screenshots/aq-03.png`

### AQ-07 — "what's my ad spend on Meta this month?"
- **Status:** Pass
- **Date Range Used:** N/A (out-of-scope metric)
- **Chart / Output:** No chart invented; clearly stated advertising/ad-spend data (Meta/Facebook spend, ROAS, CAC) is unavailable, listed available domains (orders, sales, customers, returns), and offered sales/returns metrics instead.
- **Screenshot:** `screenshots/aq-07.png`

### AQ-02 — "best sellers this season" (Vague date)
- **Date Range Used:** `2025-05-06` -> `2025-10-27` (full dataset window since `"this season"` is undefined)
- **Chart / Output:** Called `getSalesMetrics`, returned top products by net sales/units (`Selvedge Slim Jeans` $436.60 / 4 units, `Northridge Insulated Jacket` $332.31 / 4 units, etc.), and rendered *Net sales by day* and *Net sales by category and channel* charts.
- **Screenshot:** `screenshots/aq-02.png`

### AQ-04 — "are repeat customers growing since summer" (Vague date)
- **Date Range Used:** `2025-06-01` – `2025-10-27` (`2025-06-01` -> `2025-10-27`, interpreting "since summer" from June 1 through the reference date)
- **Chart / Output:** Rendered *Returning vs new buyers* donut chart (`17` buyers total; `41.2%` returning / `7` returning vs. `10` new; `1` multi-order vs. `16` single-order) and *Returning vs new buyers by month* stacked bar chart (`2025-06`: 1 buyer, 1 returning / 0 new, 100.0%; `2025-07`: 1 buyer, 0 returning / 1 new, 0%; `2025-08`: 1 buyer, 1 returning / 0 new, 100.0%; `2025-09`: 2 buyers, 1 returning / 1 new, 50%; `2025-10` partial through Oct 27: 12 buyers, 4 returning / 8 new, 33.3%), concluding repeat-customer share is not growing (returning share declined from 100% in June/August to 33.3% in October while new-buyer volume rose to 8, with small sample sizes prior to October).
- **Screenshots:** `screenshots/aq-04.1.png`, `screenshots/aq-04.2.png`

### AQ-08 — "how are returns doing" (Missing date)
- **Date Range Used:** `2025-05-06` – `2025-10-27` (`2025-05-06` -> `2025-10-27`, full dataset window)
- **Chart / Output:** Rendered *Refunds by return reason* horizontal bar chart (`$1,116.94` refunded across `8` returned items, filtered on return date) and *Returned order lines* table (`8` lines), plus summary stats (`$1,116.94` refunds vs. `$3,098.35` gross sales / `36%` share, led by `Alpine Down Parka`).
- **Screenshot:** `screenshots/aq-08.png`

### AQ-11 — "what's selling rn" (Vague date)
- **Date Range Used:** `2025-10-27` – `2025-10-27` (`2025-10-27`, fixed reference day for `"rn"`)
- **Chart / Output:** Rendered *Net sales by day* (`$182.20` net sales across `1` order on Oct 27) and *Net sales by category and channel* (`Online Store`: `Outerwear` $94.00 / `Harbor Rain Shell` 1 unit, `Knitwear` $88.20 / `Cable Knit Cardigan` 1 unit).
- **Screenshot:** `screenshots/aq-11.png`

### AQ-12 — "return rate on boots lately?" (Vague date)
- **Date Range Used:** `2025-10-20` – `2025-10-26` (last week relative to `2025-10-27` for `"lately"`, filtered to `"boot"`)
- **Chart / Output:** Rendered *Refunds by return reason* card without crash showing `0` items returned, `$0.00` refunded, `0` units sold, and `N/A` return rate (empty state / no bars plotted because there were no returns in the window).
- **Screenshot:** `screenshots/aq-12.png`