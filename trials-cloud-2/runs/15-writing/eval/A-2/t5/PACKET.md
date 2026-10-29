## Task
Byte-budget check for the figure pages before the host migration. For every page under `figures/`, compare its size on disk with its budget and flag the pages that are over.

## Inputs
- figures/*.html
- figures/targets.json

## Deliverables
- out/budget.json: an object keyed by file name, each value `{ "size_bytes": n, "budget_bytes": n, "over": true|false }`
- REPORT.md: which pages are over budget, by how much, and the total excess

## Notes
Budget: 10 minutes.
