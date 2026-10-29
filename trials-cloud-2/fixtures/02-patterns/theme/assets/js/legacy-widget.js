// Old partner widget embed (pre-2020). Still loaded on a few figure pages.
(function () {
  var x = window.NEXUS_WIDGET_HTML || '';
  if (x) {
    document.write(x);          // S6
  }
  var host = document.getElementById('partner-widget');
  if (host) host.setAttribute('data-ready', '1');
})();
