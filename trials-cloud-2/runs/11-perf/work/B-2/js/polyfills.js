/* Legacy feature probe: used to spin the main thread for 400 ms to pick an "adaptive grid"
   layout tier. Nothing in the CSS or JS reads window.__layoutTier, so the probe is gone and
   the tier is fixed; only the requestIdleCallback polyfill remains. */
(function () {
  window.__layoutTier = 0;
  if (!('requestIdleCallback' in window)) {
    window.requestIdleCallback = function (cb) { return setTimeout(function () { cb({ didTimeout: false, timeRemaining: function () { return 50; } }); }, 1); };
  }
})();
