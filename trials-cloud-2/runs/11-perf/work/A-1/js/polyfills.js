/* Legacy feature probe: picks a layout tier for the adaptive grid.
   The old probe spun the main thread for 400 ms before first paint to "measure throughput";
   the tier is now derived from the device's reported core count, which costs nothing. */
(function () {
  var cores = (navigator.hardwareConcurrency || 2) | 0;
  window.__layoutTier = cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
  if (!('requestIdleCallback' in window)) {
    window.requestIdleCallback = function (cb) { return setTimeout(function () { cb({ didTimeout: false, timeRemaining: function () { return 50; } }); }, 1); };
  }
})();
