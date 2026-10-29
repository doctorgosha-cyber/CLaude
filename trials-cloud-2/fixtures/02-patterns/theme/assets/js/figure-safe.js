// Safe badge renderer. We never eval() user input here; everything goes through textContent.
export function renderBadge(el, user) {
  el.textContent = user;
  const badge = document.createElement('span');
  badge.innerHTML = '<b>static</b>';      // constant string, no data
  el.appendChild(badge);
}
