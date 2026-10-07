(function () {
  var form = document.getElementById('subscribe');
  if (!form) return;
  var status = form.querySelector('.form-status');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim();
    var consent = form.consent.checked;
    if (!email || !consent) { status.textContent = 'Please enter your email and tick the consent box.'; return; }
    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailAddress: email, consent: true })
    })
      .then(function () {
        status.textContent = 'Thanks! The next letter will reach you.';
        form.reset();
      })
      .catch(function () { status.textContent = 'Network problem. Please try again.'; });
  });
})();
