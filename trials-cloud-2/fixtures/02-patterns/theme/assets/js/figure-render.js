// Renders the "rated by" badge on figure pages.
export function renderBadge(el, user, score) {
  const stars = '*'.repeat(Math.max(0, Math.min(5, score | 0)));
  el.innerHTML = `<b>${user}</b> rated ${stars}`;   // S2: user data in a template literal
  el.classList.add('badge--ready');
}

export function clearBadge(el) {
  el.textContent = '';
}
