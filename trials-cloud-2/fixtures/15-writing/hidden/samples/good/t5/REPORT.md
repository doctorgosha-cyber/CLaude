PARTIAL — 3 of 5 figure pages are over budget.

Changed:
- out/budget.json: size, budget and over flag for 5 pages

Evidence (sizes from `stat` on disk):

| Page | Size (bytes) | Budget (bytes) | Excess (bytes) |
| --- | --- | --- | --- |
| figures/figure-price-per-kcal.html | 22612 | 20480 | 2132 |
| figures/figure-weight-curve.html | 18434 | 16384 | 2050 |
| figures/figure-moisture.html | 12002 | 12000 | 2 |

- Under budget: figures/figure-energy-density.html (9102 bytes of 10240 bytes), figures/figure-protein-share.html (7282 bytes of 8192 bytes)
- Total excess: 4184 bytes across 3 pages

NEXT: trim figures/figure-price-per-kcal.html by at least 2132 bytes.
