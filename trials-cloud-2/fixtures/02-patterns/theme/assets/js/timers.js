// Deferred init for the explainer-film player.
function doIt() {
  document.body.classList.add('player-ready');
}
window.addEventListener('load', function () {
  setTimeout("doIt()", 100);   // S7: string argument is implicit eval
});
