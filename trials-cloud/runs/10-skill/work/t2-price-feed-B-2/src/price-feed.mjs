// Live price widget for product cards. `fetchPrice(sku)` is injected (returns a Promise of {sku, price, at}).

export class PriceFeed {
  #fetchPrice; #render; #current = new Map();
  constructor(fetchPrice, render) { this.#fetchPrice = fetchPrice; this.#render = render; }

  /**
   * Refresh the price of one SKU and render it. Safe to call repeatedly (e.g. on scroll and on timer).
   * Replies can arrive out of order, so a reply is only stored/rendered when its server timestamp `at`
   * is newer than the quote already held for that SKU; a stale reply is dropped and the newest quote
   * is returned instead.
   */
  async refresh(sku) {
    const result = await this.#fetchPrice(sku);
    const held = this.#current.get(sku);
    if (held && result.at < held.at) return held;
    this.#current.set(sku, result);
    this.#render(sku, result);
    return result;
  }

  /** Refresh many SKUs; resolves when all have rendered. */
  async refreshAll(skus) { await Promise.all(skus.map(s => this.refresh(s))); }

  current(sku) { return this.#current.get(sku) ?? null; }
}
