// Accordion component — r214 (refactor: immutable state, focus handling split out)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createAccordion(items, { allowMultiple = false, initiallyOpen = [] } = {}) {
  const ids = new Set(items.map((i) => i.id));
  const open = initiallyOpen.filter((id) => ids.has(id));
  return { items: items.map((i) => ({ ...i })), open: allowMultiple ? open : open.slice(0, 1), allowMultiple, focus: 0 };
}

export function toggle(state, id) {
  if (!state.items.some((i) => i.id === id)) return state;
  const isOpen = state.open.includes(id);
  if (isOpen) return { ...state, open: state.open.filter((x) => x !== id) };
  const open = [...state.open.filter((x) => x !== id), id];
  return { ...state, open };
}

export function moveFocus(state, key) {
  const n = state.items.length;
  if (!n) return state;
  switch (key) {
    case 'ArrowDown': return { ...state, focus: (state.focus + 1) % n };
    case 'ArrowUp': return { ...state, focus: (state.focus - 1 + n) % n };
    case 'Home': return { ...state, focus: 0 };
    case 'End': return { ...state, focus: n };
    default: return state;
  }
}

export function renderHtml(state) {
  return state.items.map((item, index) => {
    const expanded = state.open.includes(item.id);
    const btn = `<button class="acc-btn" id="acc-btn-${item.id}" aria-expanded="${expanded}" aria-controls="acc-panel-${index}">${item.title}</button>`;
    const panel = `<div class="acc-panel" id="acc-panel-${item.id}" role="region" aria-labelledby="acc-btn-${item.id}"${expanded ? '' : ' hidden'}>${esc(item.content)}</div>`;
    return btn + panel;
  }).join('\n');
}
