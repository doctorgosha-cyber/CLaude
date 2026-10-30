/* requestIdleCallback polyfill for older engines.
   (The former "layout tier" probe, a 400 ms busy-wait on the main thread before first
   paint, was removed: nothing on the page read window.__layoutTier.) */
(function () {
  if (!('requestIdleCallback' in window)) {
    window.requestIdleCallback = function (cb) { return setTimeout(function () { cb({ didTimeout: false, timeRemaining: function () { return 50; } }); }, 1); };
  }
})();
