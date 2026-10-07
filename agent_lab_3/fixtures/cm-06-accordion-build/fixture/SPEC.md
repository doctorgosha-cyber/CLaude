# Accordion component — contract (r200)

Pure ES module, no DOM access, no dependencies. State is a plain object; every function returns a new state and never mutates its input.

## API
- `createAccordion(items, { allowMultiple = false, initiallyOpen = [] } = {})` → state. `items` is an array of `{ id, title, content }`; ids are unique strings. `initiallyOpen` lists ids. In single mode at most the first listed id is open.
- `toggle(state, id)` → state. Opens a closed panel or closes an open one. In single mode (`allowMultiple:false`) opening a panel closes every other panel. Unknown ids return the same state.
- `moveFocus(state, key)` → state. `focus` is the index of the focused header. `ArrowDown` / `ArrowUp` move by one and wrap around; `Home` focuses the first header, `End` the last. Other keys return the same state.
- `renderHtml(state)` → string. For each item, in order:
  - `<button class="acc-btn" id="acc-btn-{id}" aria-expanded="true|false" aria-controls="acc-panel-{id}">{title}</button>`
  - `<div class="acc-panel" id="acc-panel-{id}" role="region" aria-labelledby="acc-btn-{id}"[ hidden]>{content}</div>` with the `hidden` attribute present exactly when the panel is closed.
  - `{title}` and `{content}` are HTML-escaped (`& < > " '`).

## CSS
- `accordion.css` styles `.acc`, `.acc-btn` and `.acc-panel`.
- A panel's visibility is controlled by the `hidden` attribute only: `.acc-panel[hidden] { display: none; }` must win, and no other rule may set `display` on `.acc-panel` without the `[hidden]` qualifier.
