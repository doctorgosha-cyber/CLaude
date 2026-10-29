# Brief: landing section for the "Anatomy of Things" explainer-film channel

Anatomy of Things is a channel of short films that take everyday objects apart (a zipper, a kettle, a lock)
and show how they work, dubbed into ten languages. Build the **landing section** of its website from
`data/films.json`.

Aim for under 15 minutes of work. Do not install packages and do not use the network (there is none).
Do not modify anything under `data/` or `images/`. Run `npm test` if present.

## Deliverable

Exactly three files in this folder, which already exist as empty starters:

- `index.html` — the section (keep the existing `<head>`; put everything inside `<main>`)
- `styles.css` — all styling (no `<style>` blocks, no inline `style=` attributes in the HTML source)
- `app.js` — all behaviour (no inline event handlers such as `onclick=`, no inline `<script>` blocks)

No frameworks, no CDN or external scripts/stylesheets/fonts, no build step. Plain HTML, CSS and ES2020.
Load the data with `fetch('data/films.json')` (preview with `node serve.mjs` and open http://localhost:8080/).

## What the section contains

- **Hero**: the channel name (`channel.name`) as the page's only `<h1>` and the tagline (`channel.tagline`).
- **Language switcher**: a `<select>` with one option per entry in `languages`, in that order, option value = `code`,
  option text = `name`; `en` selected on load. Changing it re-titles the four film cards.
- **Latest films**: one card per entry in `films`, in JSON order, each with: thumbnail (from `thumbnail`),
  title in the chosen language, duration, how many languages the film is available in, and a link to `url`.
- **Newsletter**: an email field, a submit button, and a status message area. Validation is done in `app.js`:
  an invalid address shows an error, a valid one shows a success message. Submitting must never navigate or reload.
- Responsive at 390 px and 1280 px with no horizontal scrolling at either. Accessible: labels on every control,
  keyboard operable, visible focus, WCAG AA contrast, 24 × 24 px minimum control size.

## Details that our QA will check

Duration is shown as `m:ss` with no leading zero on minutes and always two digits of seconds (612 → `10:12`, 59 → `0:59`, 1203 → `20:03`).
The language count reads `1 language` for one and `7 languages` otherwise (the count is `languages.length`, never the number of titles).
A film that has no title in the chosen language falls back to its English title, and in that case the title element (or an ancestor inside the card) carries `lang="en"` while the `<html>` element's `lang` attribute always equals the chosen language code.
Switching language updates titles in place: the cards keep their order and the `<select>` keeps keyboard focus (do not rebuild the control or the page around it).
The form has the `novalidate` attribute so that your own validation runs; the address is trimmed first; it is valid when it has exactly one `@`, a non-empty local part, a domain containing a dot, and no spaces (`a@b`, `user@@example.com` and an empty field are invalid; `  user@example.com  ` is valid).
On error: the status element gets `data-state="error"` and a message that says what to fix, the email input gets `aria-invalid="true"`, and keyboard focus moves to the email input; on success: `data-state="success"`, a confirmation message, and `aria-invalid` removed; the status must update on every submit.
The status element exists in the DOM from the start (empty) with `role="status"` or `aria-live="polite"`, so screen readers announce changes.
The film link's `href` is exactly the `url` from the JSON and its accessible name includes the film title.

## Test hooks (QA automation relies on these exact attributes)

| `data-testid`       | element                                                                  |
|---------------------|--------------------------------------------------------------------------|
| `hero`              | the hero block containing the `<h1>` and tagline                         |
| `lang-select`       | the language `<select>`                                                  |
| `film-card`         | each film card; also carries `data-film-id="<id from JSON>"`             |
| `film-title`        | the title text inside a card (only the title inside the element)         |
| `film-duration`     | the `m:ss` text inside a card (only the duration inside the element)     |
| `film-langs`        | the "N languages" text inside a card                                     |
| `film-link`         | the `<a>` to the film                                                    |
| `newsletter-form`   | the `<form novalidate>`                                                  |
| `newsletter-email`  | the `<input type="email">`                                               |
| `newsletter-submit` | the submit `<button>`                                                    |
| `newsletter-status` | the status/live-region element                                           |
