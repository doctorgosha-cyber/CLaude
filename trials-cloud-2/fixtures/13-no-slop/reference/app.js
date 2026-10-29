(async function () {
  const data = await (await fetch('data/films.json')).json();
  const select = document.getElementById('lang');
  const list = document.getElementById('films');
  const form = document.getElementById('newsletter');
  const email = document.getElementById('email');
  const status = document.getElementById('status');

  document.getElementById('tagline').textContent = data.channel.tagline;

  for (const l of data.languages) {
    const o = document.createElement('option');
    o.value = l.code; o.textContent = l.name; o.lang = l.code;
    select.append(o);
  }
  select.value = 'en';

  const duration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const langCount = (n) => `${n} ${n === 1 ? 'language' : 'languages'}`;

  const cards = data.films.map((f) => {
    const li = document.createElement('li');
    li.className = 'film';
    li.dataset.testid = 'film-card';
    li.dataset.filmId = f.id;
    li.innerHTML = `
      <a class="film__thumb" tabindex="-1" aria-hidden="true"><img alt="" width="320" height="180"></a>
      <h3><a class="film__title" data-testid="film-link"><span data-testid="film-title"></span></a></h3>
      <p class="film__meta"><span data-testid="film-duration"></span><span data-testid="film-langs"></span></p>`;
    for (const a of li.querySelectorAll('a')) a.href = f.url;
    li.querySelector('img').src = f.thumbnail;
    li.querySelector('[data-testid="film-duration"]').textContent = duration(f.durationSeconds);
    li.querySelector('[data-testid="film-langs"]').textContent = langCount(f.languages.length);
    return { film: f, li, title: li.querySelector('[data-testid="film-title"]') };
  });
  list.replaceChildren(...cards.map((c) => c.li));

  function applyLanguage(code) {
    document.documentElement.lang = code;
    for (const { film, title } of cards) {
      const t = film.titles[code];
      title.textContent = t || film.titles.en;
      if (t) title.removeAttribute('lang'); else title.setAttribute('lang', 'en');
    }
  }
  select.addEventListener('change', () => applyLanguage(select.value));
  applyLanguage('en');

  const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = email.value.trim();
    if (!valid(value)) {
      status.dataset.state = 'error';
      status.textContent = value ? `"${value}" is not an email address. Use the form name@example.com.` : 'Enter your email address to subscribe.';
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      return;
    }
    email.removeAttribute('aria-invalid');
    status.dataset.state = 'success';
    status.textContent = `Subscribed. The next film goes to ${value}.`;
    email.value = '';
  });
})();
