# SoundBench — "Best Wireless Headphones of 2026" page

This folder is the complete static site for one editorial product page: `index.html`,
`css/`, `js/`, `img/`, `fonts/` and `data/`. Marketing is unhappy with it: on a phone it
takes ages to show anything, the layout jumps around while it loads, and the Lighthouse
score is embarrassing.

## Your job

Make this page fast — LCP, CLS, TBT and the Lighthouse **performance** score (mobile)
are what will be checked — **without breaking anything**:

- Keep every feature working exactly as it does today: the comparison table with its
  sort control, filter box and compare checkboxes; the FAQ accordion; the newsletter
  form validation; the reader reviews; the hero image with its alt text.
- Do not remove content: headings, copy, product names, reviews, the promo banner.
  Assets may be re-encoded, resized, merged, split, inlined or dropped as long as the
  page still shows the same things.
- Keep the existing element ids, class names and `data-*` attributes in the markup and
  in what `js/app.js` renders. QA's automated regression suite hooks into them.
- The page must load without console errors or failed requests.

## Constraints

- The production host serves this folder as plain static files: no compression, no
  special headers, no server-side rendering. `serve.mjs` mirrors that. Only changes to
  the site files count; changes to `serve.mjs` will not ship.
- No CDN or external resources (the page must work offline on the host).
- Do not install packages and do not use the network. ImageMagick (`convert`), `cwebp`
  and Python 3 with Pillow are available on this machine if you need to re-encode images.
- Keep it to this folder.

## Working

- `node serve.mjs 8080` previews the page at http://127.0.0.1:8080/
- `npm test` runs the visible smoke test (serves the folder, checks the markup hooks and
  that every referenced asset resolves). Run it before you finish.
- Aim for under 20 minutes of work. Leave a short note of what you changed in `PERF.md`.
