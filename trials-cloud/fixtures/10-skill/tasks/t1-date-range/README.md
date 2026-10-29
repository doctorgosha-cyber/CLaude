# Bug report: price-history chart is missing the last day

Module: `src/date-range.mjs` (ES module, Node 22, no dependencies).

A reader wrote in: "Your thermos page says 'tracked for 30 days' but the chart runs 1–30 September, and 30 September is not on it." Our editor confirmed the chart for 2026-09-01 … 2026-09-30 ends on 29 September, and the counter says 29 days, not 30.

Please fix the bug. Keep the public functions (`datesBetween`, `trackedDays`, `fillPriceHistory`) and their signatures. You may add tests. Do not touch files outside this folder.
