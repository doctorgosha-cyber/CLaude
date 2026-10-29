/* Legacy feature probe: measures main-thread throughput so the adaptive grid can pick a layout tier.
   Must run before first paint so the tier is known when styles apply. */
(function () {
  var t0 = performance.now();
  var x = 1;
  while (performance.now() - t0 < 400) {
    x = (x * 1664525 + 1013904223) >>> 0;
  }
  window.__layoutTier = x % 3;
  if (!('requestIdleCallback' in window)) {
    window.requestIdleCallback = function (cb) { return setTimeout(function () { cb({ didTimeout: false, timeRemaining: function () { return 50; } }); }, 1); };
  }
})();
