// Live price widget for product cards. `fetchPrice(sku)` is injected (returns a Promise of {sku, price, at}).

export class PriceFeed {
  #fetchPrice; #render; #current = new Map();
  constructor(fetchPrice, render) { this.#fetchPrice = fetchPrice; this.#render = render; }

  /**
   * Refresh the price of one SKU and render it. Safe to call repeatedly (e.g. on scroll and on timer).
   * Responses may arrive out of order; a quote whose server timestamp `at` is older than the one
   * already held for the SKU is discarded, so the widget never regresses to an older price.
   * Resolves with the quote the widget holds after this refresh (the fetched one, or the newer one kept).
   */
  async refresh(sku) {
    const result = await this.#fetchPrice(sku);
    const held = this.#current.get(sku);
    if (held && !(result.at > held.at)) return held; // stale (or duplicate) quote: keep what we have
    this.#current.set(sku, result);
    this.#render(sku, result);
    return result;
  }

  /** Refresh many SKUs; resolves when all have rendered. */
  async refreshAll(skus) { await Promise.all(skus.map(s => this.refresh(s))); }

  current(sku) { return this.#current.get(sku) ?? null; }
}
