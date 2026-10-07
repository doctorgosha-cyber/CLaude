(function () {
  var form = document.getElementById('subscribe');
  if (!form) return;
  var status = form.querySelector('.form-status');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim();
    var consent = form.consent.checked;
    console.log('subscribe', email, consent);
    if (!email || !consent) { status.textContent = 'Please enter your email and tick the consent box.'; return; }
    var body = new URLSearchParams({ email: email, consent: 'true' });
    fetch('/api/subscribe', { method: 'POST', body: body })
      .then(function (r) {
        if (r.status === 409) { status.textContent = 'You are already on the list.'; return; }
        if (!r.ok) { status.textContent = 'Something went wrong. Please try again.'; return; }
        status.textContent = 'Thanks! The next letter will reach you.';
        form.reset();
      })
      .catch(function () { status.textContent = 'Network problem. Please try again.'; });
  });
})();
