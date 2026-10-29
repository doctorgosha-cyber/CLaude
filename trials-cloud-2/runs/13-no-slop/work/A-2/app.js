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

function pickTitle(film, lang) {
  const titles = film.titles || {};
  if (typeof titles[lang] === 'string' && titles[lang] !== '') return { text: titles[lang], lang };
  return { text: titles[FALLBACK_LANG] || '', lang: FALLBACK_LANG };
}

function isValidEmail(raw) {
  const value = raw.trim();
  if (value === '' || /\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local === '' || domain === '') return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

function renderHero(channel) {
  const title = document.getElementById('channel-name');
  const tagline = document.querySelector('.hero-tagline');
  if (title) title.textContent = channel.name;
  if (tagline) tagline.textContent = channel.tagline;
}

function renderLanguages(select, languages) {
  for (const { code, name } of languages) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    if (code === FALLBACK_LANG) option.selected = true;
    select.append(option);
  }
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
  img.decoding = 'async';

  const body = document.createElement('div');
  body.className = 'film-body';

  const h3 = document.createElement('h3');
  h3.className = 'film-title';
  const link = document.createElement('a');
  link.className = 'film-link';
  link.dataset.testid = 'film-link';
  link.href = film.url;
  const titleSpan = document.createElement('span');
  titleSpan.dataset.testid = 'film-title';
  link.append(titleSpan);
  h3.append(link);

  const meta = document.createElement('dl');
  meta.className = 'film-meta';

  const dtDuration = document.createElement('dt');
  dtDuration.textContent = 'Duration';
  const ddDuration = document.createElement('dd');
  ddDuration.dataset.testid = 'film-duration';
  ddDuration.textContent = formatDuration(film.durationSeconds);

  const dtLangs = document.createElement('dt');
  dtLangs.textContent = 'Available in';
  const ddLangs = document.createElement('dd');
  ddLangs.dataset.testid = 'film-langs';
  ddLangs.textContent = formatLanguageCount((film.languages || []).length);

  meta.append(dtDuration, ddDuration, dtLangs, ddLangs);
  body.append(h3, meta);
  li.append(img, body);
  return li;
}

function applyLanguage(films, cards, lang) {
  document.documentElement.lang = lang;
  films.forEach((film, i) => {
    const card = cards[i];
    const titleEl = card.querySelector('[data-testid="film-title"]');
    const { text, lang: titleLang } = pickTitle(film, lang);
    titleEl.textContent = text;
    if (titleLang !== lang) titleEl.setAttribute('lang', titleLang);
    else titleEl.removeAttribute('lang');
  });
}

function setupNewsletter() {
  const form = document.querySelector('[data-testid="newsletter-form"]');
  const email = document.querySelector('[data-testid="newsletter-email"]');
  const status = document.querySelector('[data-testid="newsletter-status"]');
  if (!form || !email || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = email.value.trim();
    email.value = value;

    // Clear first so repeated identical messages are still announced.
    status.textContent = '';

    if (!isValidEmail(value)) {
      status.dataset.state = 'error';
      status.textContent = value === ''
        ? 'Enter your email address, for example name@example.com.'
        : 'That email address is not valid. Use the form name@example.com, with one @ and no spaces.';
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      return;
    }

    status.dataset.state = 'success';
    status.textContent = `Thanks. We will email ${value} when the next film is out.`;
    email.removeAttribute('aria-invalid');
  });

  email.addEventListener('input', () => {
    if (email.getAttribute('aria-invalid') === 'true' && isValidEmail(email.value)) {
      email.removeAttribute('aria-invalid');
    }
  });
}

async function init() {
  setupNewsletter();

  let data;
  try {
    const response = await fetch('data/films.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    const grid = document.getElementById('film-grid');
    if (grid) {
      const li = document.createElement('li');
      li.textContent = 'The film list could not be loaded. Please try again later.';
      grid.append(li);
    }
    return;
  }

  renderHero(data.channel || {});

  const select = document.querySelector('[data-testid="lang-select"]');
  const languages = Array.isArray(data.languages) ? data.languages : [];
  renderLanguages(select, languages);

  const films = Array.isArray(data.films) ? data.films : [];
  const grid = document.getElementById('film-grid');
  const cards = films.map(buildCard);
  grid.append(...cards);

  const initial = languages.some((l) => l.code === FALLBACK_LANG) ? FALLBACK_LANG : (languages[0] && languages[0].code) || FALLBACK_LANG;
  select.value = initial;
  applyLanguage(films, cards, initial);

  select.addEventListener('change', () => applyLanguage(films, cards, select.value));
}

init();
