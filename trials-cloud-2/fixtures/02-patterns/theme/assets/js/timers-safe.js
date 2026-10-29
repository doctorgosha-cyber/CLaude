// Deferred init (modern). Replaced the old eval( of the config string with JSON.parse.
function doIt() {
  document.body.classList.add('player-ready');
}
export function readConfig(str) {
  return JSON.parse(str);
}
window.addEventListener('load', () => {
  setTimeout(() => doIt(), 100);
  setInterval(doIt, 60000);
});
