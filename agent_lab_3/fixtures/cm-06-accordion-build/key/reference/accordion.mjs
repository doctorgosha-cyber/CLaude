// Reference solution for cm-06 (sealed). Passes tests/ and the hidden tests.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createAccordion(items, { allowMultiple = false, initiallyOpen = [] } = {}) {
  const ids = new Set(items.map((i) => i.id));
  const open = initiallyOpen.filter((id) => ids.has(id));
  return { items: items.map((i) => ({ ...i })), open: allowMultiple ? open : open.slice(0, 1), allowMultiple, focus: 0 };
}

export function toggle(state, id) {
  if (!state.items.some((i) => i.id === id)) return state;
  if (state.open.includes(id)) return { ...state, open: state.open.filter((x) => x !== id) };
  return { ...state, open: state.allowMultiple ? [...state.open, id] : [id] };
}

export function moveFocus(state, key) {
  const n = state.items.length;
  if (!n) return state;
  switch (key) {
    case 'ArrowDown': return { ...state, focus: (state.focus + 1) % n };
    case 'ArrowUp': return { ...state, focus: (state.focus - 1 + n) % n };
    case 'Home': return { ...state, focus: 0 };
    case 'End': return { ...state, focus: n - 1 };
    default: return state;
  }
}

export function renderHtml(state) {
  return state.items.map((item) => {
    const expanded = state.open.includes(item.id);
    const btn = `<button class="acc-btn" id="acc-btn-${item.id}" aria-expanded="${expanded}" aria-controls="acc-panel-${item.id}">${esc(item.title)}</button>`;
    const panel = `<div class="acc-panel" id="acc-panel-${item.id}" role="region" aria-labelledby="acc-btn-${item.id}"${expanded ? '' : ' hidden'}>${esc(item.content)}</div>`;
    return btn + panel;
  }).join('\n');
}
