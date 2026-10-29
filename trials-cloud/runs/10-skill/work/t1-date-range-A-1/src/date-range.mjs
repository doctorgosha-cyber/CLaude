// Price-history helpers for the review site. Dates are ISO strings "YYYY-MM-DD" (UTC).

/** Return every date from start to end as ISO strings. */
export function datesBetween(startISO, endISO) {
  const start = Date.UTC(...splitISO(startISO));
  const end = Date.UTC(...splitISO(endISO));
  if (end < start) throw new RangeError('end before start');
  const out = [];
  for (let t = start; t <= end; t += 86400000) out.push(toISO(t));
  return out;
}

/** Number of days a price was tracked, from the first to the last sample, both counted. */
export function trackedDays(startISO, endISO) {
  return datesBetween(startISO, endISO).length;
}

/** Fill gaps in a sparse {date: price} map with the last known price, over the full range. */
export function fillPriceHistory(samples, startISO, endISO) {
  let last = null; const out = {};
  for (const d of datesBetween(startISO, endISO)) { if (d in samples) last = samples[d]; out[d] = last; }
  return out;
}

function splitISO(s) { const [y, m, d] = s.split('-').map(Number); return [y, m - 1, d]; }
function toISO(t) { return new Date(t).toISOString().slice(0, 10); }
