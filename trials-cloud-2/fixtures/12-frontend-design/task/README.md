# Brief: product-comparison section for "Kibble & Co." (pet-food reviews)

We review pet food. Build the **comparison section** that sits on our review pages. It shows the six foods
in `data/products.json`, lets a reader filter and sort them, and lets them pick up to three to compare.

Aim for under 15 minutes of work. Do not install packages and do not use the network (there is none).
Do not modify anything under `data/` or `images/`. Run `npm test` if present.

## Deliverable

Exactly three files in this folder, which already exist as empty starters:

- `index.html` — the section (keep the existing `<head>`; put the section inside `<main>`)
- `styles.css` — all styling (no `<style>` blocks, no inline `style=` attributes in the HTML source)
- `app.js` — all behaviour (no inline event handlers such as `onclick=`, no inline `<script>` blocks)

No frameworks, no CDN or external scripts/stylesheets/fonts, no build step. Plain HTML, CSS and ES2020.
Load the data with `fetch('data/products.json')` (preview with `node serve.mjs` and open http://localhost:8080/).

## What the section does

- One card per product with: image (from `image`), name, brand, price, kcal per 100 g, protein %,
  rating, and the `badge` text when it is not null.
- **Filters** that apply immediately as the reader types or selects (no "Apply" button, and nothing may
  submit or reload the page): species (all / dog / cat), minimum price, maximum price.
- **Sort** by: featured (the order in the JSON file), price low to high, price high to low,
  rating high to low, protein high to low.
- **Compare**: each card has a toggle that adds it to a comparison; at most three can be selected.
  A compare bar stays visible (sticky or fixed) while at least one product is selected and shows how
  many are selected; it has a "Clear" control. The bar is hidden when nothing is selected.
- Responsive: it must work at 390 px wide (phones) and at 1280 px, with no horizontal scrolling at either.
- Accessible: every control has a label, everything works with the keyboard alone, focus is visible,
  text contrast meets WCAG AA, controls are at least 24 × 24 px.

## Details that our QA will check

Price is displayed as the currency symbol from the JSON (`currency.symbol`, never hard-coded) followed by the amount with exactly two decimals (`£9.90`, `£18.00`).
Rating is displayed with exactly one decimal (`4.0`, `4.5`), and kcal and protein as plain integers with their units.
Filters combine (all must match); the price bounds are inclusive at both ends; an empty price input means "no bound".
When no product matches, the card list is empty and a message with `data-testid="empty-results"` is shown; it is hidden or absent whenever at least one card is shown.
Sorting is stable with ties broken by product name A→Z, case-insensitively (so `bowl&co …` sorts before `Northcoast …`), and sorting applies to whatever the filters currently allow.
Filtering never changes the comparison selection: a selected product that is filtered out still counts and comes back selected when it reappears.
When three products are selected, the compare toggles of the other products get the `disabled` attribute; deselecting one re-enables them.
The compare toggle is a real `<button type="button">` with `aria-pressed` reflecting its state so that Enter and Space both toggle it.
The compare bar contains an element with `data-testid="compare-count"` whose text content is only the number (put the wording around it, not inside it).
Species values are exactly `all`, `dog`, `cat`; sort values are exactly `featured`, `price-asc`, `price-desc`, `rating-desc`, `protein-desc`.

## Test hooks (QA automation relies on these exact attributes)

| `data-testid`        | element                                                              |
|----------------------|----------------------------------------------------------------------|
| `comparison-section` | the `<section>` wrapping everything                                  |
| `filter-species`     | `<select>` with options `all`, `dog`, `cat`                          |
| `filter-price-min`   | `<input type="number">`                                              |
| `filter-price-max`   | `<input type="number">`                                              |
| `sort-select`        | `<select>` with the five sort values above                           |
| `product-card`       | each card; also carries `data-product-id="<id from JSON>"`           |
| `product-price`      | the price text inside a card                                         |
| `product-rating`     | the rating text inside a card                                        |
| `compare-toggle`     | the per-card `<button type="button" aria-pressed="…">`               |
| `compare-bar`        | the sticky/fixed bar                                                 |
| `compare-count`      | number of selected products (text is the number only)                |
| `compare-clear`      | button in the bar that clears the selection                          |
| `empty-results`      | the "nothing matches" message                                        |

Cards that are filtered out must not be visible (remove them or use `hidden`/`display:none`).
