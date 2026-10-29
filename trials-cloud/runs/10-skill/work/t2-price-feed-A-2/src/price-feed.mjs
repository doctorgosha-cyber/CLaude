// Live price widget for product cards. `fetchPrice(sku)` is injected (returns a Promise of {sku, price, at}).

export class PriceFeed {
  #fetchPrice; #render; #current = new Map();
  constructor(fetchPrice, render) { this.#fetchPrice = fetchPrice; this.#render = render; }

  /**
   * Refresh the price of one SKU and render it. Safe to call repeatedly (e.g. on scroll and on timer).
   * Responses can arrive out of order, so a quote is only stored/rendered if it is at least as new
   * (by server timestamp `at`) as the one already held; a stale quote is discarded and the newer
   * stored quote is returned instead.
   */
  async refresh(sku) {
    const result = await this.#fetchPrice(sku);
    const existing = this.#current.get(sku);
    if (existing && existing.at > result.at) return existing;
    this.#current.set(sku, result);
    this.#render(sku, result);
    return result;
  }

  /** Refresh many SKUs; resolves when all have rendered. */
  async refreshAll(skus) { await Promise.all(skus.map(s => this.refresh(s))); }

  current(sku) { return this.#current.get(sku) ?? null; }
}
