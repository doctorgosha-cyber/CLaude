'use strict';

const $ = (id) => document.getElementById(id);

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function formatLangCount(n) {
  return n === 1 ? '1 language' : `${n} languages`;
}

function isValidEmail(raw) {
  const value = String(raw ?? '').trim();
  if (!value || /\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && domain.includes('.');
}

/* ---------- Films ---------- */

const cards = new Map(); // film id -> { film, title, link, img }

function buildCard(film) {
  const li = document.createElement('li');
  li.className = 'film-card';
  li.dataset.testid = 'film-card';
  li.dataset.filmId = film.id;

  const img = document.createElement('img');
  img.src = film.thumbnail;
  img.alt = '';
  img.width = 320;
  img.height = 180;
  img.decoding = 'async';

  const body = document.createElement('div');
  body.className = 'film-body';

  const h3 = document.createElement('h3');
  const link = document.createElement('a');
  link.href = film.url;
  link.dataset.testid = 'film-link';
  const title = document.createElement('span');
  title.dataset.testid = 'film-title';
  link.append(title);
  h3.append(link);

  const meta = document.createElement('p');
  meta.className = 'film-meta';
  const duration = document.createElement('span');
  duration.dataset.testid = 'film-duration';
  duration.textContent = formatDuration(film.durationSeconds);
  const sep = document.createElement('span');
  sep.className = 'sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '·';
  const langs = document.createElement('span');
  langs.dataset.testid = 'film-langs';
  langs.textContent = formatLangCount(Array.isArray(film.languages) ? film.languages.length : 0);
  meta.append(duration, sep, langs);

  body.append(h3, meta);
  li.append(img, body);
  cards.set(film.id, { film, title });
  return li;
}

function applyLanguage(code) {
  document.documentElement.lang = code;
  for (const { film, title } of cards.values()) {
    const titles = film.titles || {};
    const own = titles[code];
    if (own) {
      title.textContent = own;
      title.removeAttribute('lang');
    } else {
      title.textContent = titles.en || '';
      title.setAttribute('lang', 'en');
    }
  }
}

function renderFilms(data) {
  $('channel-name').textContent = data.channel.name;
  $('channel-tagline').textContent = data.channel.tagline;

  const select = $('lang-select');
  for (const { code, name } of data.languages) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    opt.lang = code;
    if (code === 'en') opt.selected = true;
    select.append(opt);
  }

  const grid = $('film-grid');
  const frag = document.createDocumentFragment();
  for (const film of data.films) frag.append(buildCard(film));
  grid.append(frag);
  $('films-note').textContent = '';

  applyLanguage(select.value || 'en');
  select.addEventListener('change', () => applyLanguage(select.value));
}

async function loadFilms() {
  try {
    const res = await fetch('data/films.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderFilms(await res.json());
  } catch (err) {
    $('films-note').textContent = 'The film list could not be loaded. Please try again later.';
    console.error(err);
  }
}

/* ---------- Newsletter ---------- */

function setupNewsletter() {
  const form = $('newsletter-form');
  const email = $('newsletter-email');
  const status = $('newsletter-status');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = email.value.trim();
    // Force a fresh announcement even when the message text is unchanged.
    status.textContent = '';
    status.removeAttribute('data-state');

    if (!isValidEmail(value)) {
      email.setAttribute('aria-invalid', 'true');
      status.dataset.state = 'error';
      status.textContent = value
        ? 'Enter a valid email address, like name@example.com, with one @ and a dot in the domain.'
        : 'Enter your email address to subscribe.';
      email.focus();
      return;
    }

    email.value = value;
    email.removeAttribute('aria-invalid');
    status.dataset.state = 'success';
    status.textContent = `Thanks! We'll send new films to ${value}.`;
  });

}

loadFilms();
setupNewsletter();
