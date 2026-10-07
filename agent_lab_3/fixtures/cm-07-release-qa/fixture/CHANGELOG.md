# r2 — release notes (dev)

- Nav: "Blog" renamed to "Journal"; the section now lives at /journal/ (old /blog/ URLs redirect at the edge).
- CSS variables renamed from `--brand*` to `--color-brand*` for consistency with the design tokens; all usages updated.
- Product images converted from PNG to WebP (same dimensions and alt text); ~60 % smaller.
- Analytics snippet moved from the head to the end of the body so it no longer blocks rendering; leftover console.log calls removed.
- Newsletter form now submits JSON to the subscribe endpoint instead of a form post.
- Tidied the product grid CSS.
