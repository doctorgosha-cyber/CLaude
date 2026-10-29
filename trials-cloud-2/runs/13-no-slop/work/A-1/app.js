'use strict';

const FALLBACK_LANG = 'en';

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatLanguageCount(count) {
  return count === 1 ? '1 language' : `${count} languages`;
}

function isValidEmail(raw) {
  const value = String(raw).trim();
  if (value === '' || /\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && domain.includes('.');
}

function emailProblem(raw) {
  const value = String(raw).trim();
  if (value === '') return 'Enter your email address.';
  if (/\s/.test(value)) return 'Remove the spaces from the email address.';
  const parts = value.split('@');
  if (parts.length < 2) return 'Add an @ to the email address, like name@example.com.';
  if (parts.length > 2) return 'Use only one @ in the email address.';
  if (parts[0].length === 0) return 'Add the part before the @, like name@example.com.';
  if (!parts[1].includes('.')) return 'Add a domain after the @, like name@example.com.';
  return null;
}

function titleFor(film, code) {
  const titles = film.titles || {};
  if (typeof titles[code] === 'string' && titles[code] !== '') return { text: titles[code], lang: code };
  return { text: titles[FALLBACK_LANG] || '', lang: FALLBACK_LANG };
}

function buildCard(film) {
  const li = document.createElement('li');
  li.className = 'film-card';
  li.dataset.testid = 'film-card';
  li.dataset.filmId = film.id;

  const img = document.createElement('img');
  img.className = 'film-thumb';
  img.src = film.thumbnail;
  img.alt = '';
  img.width = 320;
  img.height = 180;
  img.loading = 'lazy';
  img.decoding = 'async';

  const h3 = document.createElement('h3');
  h3.className = 'film-heading';
  const link = document.createElement('a');
  link.className = 'film-link';
  link.dataset.testid = 'film-link';
  link.setAttribute('href', film.url);
  const title = document.createElement('span');
  title.className = 'film-title';
  title.dataset.testid = 'film-title';
  link.append(title);
  h3.append(link);

  const meta = document.createElement('p');
  meta.className = 'film-meta';
  const durationLabel = document.createElement('span');
  durationLabel.className = 'visually-hidden';
  durationLabel.textContent = 'Duration ';
  const duration = document.createElement('time');
  duration.dataset.testid = 'film-duration';
  duration.dateTime = `PT${Math.floor(Number(film.durationSeconds) || 0)}S`;
  duration.textContent = formatDuration(film.durationSeconds);
  const sep = document.createElement('span');
  sep.className = 'film-meta-sep';
  sep.setAttribute('aria-hidden', 'true');
  sep.textContent = '·';
  const langs = document.createElement('span');
  langs.dataset.testid = 'film-langs';
  langs.textContent = formatLanguageCount(Array.isArray(film.languages) ? film.languages.length : 0);
  meta.append(durationLabel, duration, ' ', sep, ' ', langs);

  li.append(img, h3, meta);
  return li;
}

function applyLanguage(code, films, cards) {
  document.documentElement.lang = code;
  films.forEach((film, i) => {
    const titleEl = cards[i].querySelector('[data-testid="film-title"]');
    const { text, lang } = titleFor(film, code);
    titleEl.textContent = text;
    if (lang === code) titleEl.removeAttribute('lang');
    else titleEl.setAttribute('lang', lang);
  });
}

function setupNewsletter() {
  const form = document.getElementById('newsletter-form');
  const input = document.getElementById('newsletter-email');
  const status = document.getElementById('newsletter-status');
  if (!form || !input || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    // Clear first so repeated identical messages are still announced.
    status.textContent = '';
    status.removeAttribute('data-state');

    const problem = emailProblem(value);
    if (problem !== null || !isValidEmail(value)) {
      input.setAttribute('aria-invalid', 'true');
      status.dataset.state = 'error';
      status.textContent = problem || 'Enter a valid email address, like name@example.com.';
      input.focus();
      return;
    }

    input.value = value;
    input.removeAttribute('aria-invalid');
    status.dataset.state = 'success';
    status.textContent = `Thanks. We will send new films to ${value}.`;
  });

  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && isValidEmail(input.value)) {
      input.removeAttribute('aria-invalid');
    }
  });
}

async function init() {
  setupNewsletter();

  let data;
  try {
    const res = await fetch('data/films.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    const grid = document.getElementById('film-grid');
    if (grid) {
      const li = document.createElement('li');
      li.className = 'film-error';
      li.textContent = 'The film list could not be loaded. Please reload the page.';
      grid.append(li);
    }
    return;
  }

  const channel = data.channel || {};
  const languages = Array.isArray(data.languages) ? data.languages : [];
  const films = Array.isArray(data.films) ? data.films : [];

  const h1 = document.getElementById('channel-name');
  const tagline = document.getElementById('channel-tagline');
  if (h1 && channel.name) h1.textContent = channel.name;
  if (tagline && channel.tagline) tagline.textContent = channel.tagline;

  const select = document.getElementById('lang-select');
  select.textContent = '';
  for (const { code, name } of languages) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    if (code === FALLBACK_LANG) option.selected = true;
    select.append(option);
  }
  if (!select.value && languages.length) select.value = languages[0].code;

  const grid = document.getElementById('film-grid');
  grid.textContent = '';
  const cards = films.map(buildCard);
  grid.append(...cards);

  applyLanguage(select.value || FALLBACK_LANG, films, cards);
  select.addEventListener('change', () => applyLanguage(select.value, films, cards));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
