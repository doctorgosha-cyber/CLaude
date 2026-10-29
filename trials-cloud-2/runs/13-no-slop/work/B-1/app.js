// Anatomy of Things – landing section behaviour (ES2020, no dependencies)

const FALLBACK_LANG = 'en';

const select = document.querySelector('[data-testid="lang-select"]');
const list = document.querySelector('[data-film-list]');
const loadError = document.querySelector('[data-film-error]');
const nameEl = document.querySelector('[data-channel-name]');
const taglineEl = document.querySelector('[data-channel-tagline]');
const form = document.querySelector('[data-testid="newsletter-form"]');
const email = document.querySelector('[data-testid="newsletter-email"]');
const status = document.querySelector('[data-testid="newsletter-status"]');

/** 612 -> "10:12", 59 -> "0:59" */
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatLanguageCount(n) {
  return n === 1 ? '1 language' : `${n} languages`;
}

function pickTitle(film, lang) {
  const titles = film.titles || {};
  if (typeof titles[lang] === 'string' && titles[lang].trim()) return { text: titles[lang], lang };
  return { text: titles[FALLBACK_LANG] || '', lang: FALLBACK_LANG };
}

function renderLanguages(languages) {
  const fragment = document.createDocumentFragment();
  for (const { code, name } of languages) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    if (code === FALLBACK_LANG) option.selected = true;
    fragment.appendChild(option);
  }
  select.replaceChildren(fragment);
}

function renderFilms(films, lang) {
  const fragment = document.createDocumentFragment();
  films.forEach((film, index) => {
    const item = document.createElement('li');
    item.className = 'film';
    item.dataset.testid = 'film-card';
    item.dataset.filmId = film.id;

    const figure = document.createElement('div');
    figure.className = 'film__media';
    const img = document.createElement('img');
    img.className = 'film__thumb';
    img.src = film.thumbnail;
    img.alt = '';
    img.width = 320;
    img.height = 180;
    img.decoding = 'async';
    if (index > 1) img.loading = 'lazy';
    figure.appendChild(img);

    const index_ = document.createElement('span');
    index_.className = 'film__index';
    index_.setAttribute('aria-hidden', 'true');
    index_.textContent = String(index + 1).padStart(2, '0');

    const heading = document.createElement('h3');
    heading.className = 'film__heading';
    const link = document.createElement('a');
    link.className = 'film__link';
    link.dataset.testid = 'film-link';
    link.href = film.url;
    const title = document.createElement('span');
    title.className = 'film__title';
    title.dataset.testid = 'film-title';
    link.appendChild(title);
    heading.appendChild(link);

    const meta = document.createElement('p');
    meta.className = 'film__meta';
    const duration = document.createElement('span');
    duration.className = 'film__duration';
    duration.dataset.testid = 'film-duration';
    duration.textContent = formatDuration(film.durationSeconds);
    const langs = document.createElement('span');
    langs.className = 'film__langs';
    langs.dataset.testid = 'film-langs';
    langs.textContent = formatLanguageCount((film.languages || []).length);
    meta.append(duration, langs);

    item.append(figure, index_, heading, meta);
    fragment.appendChild(item);
  });
  list.replaceChildren(fragment);
  applyTitles(films, lang);
}

/** Updates titles in place; never rebuilds cards or the select. */
function applyTitles(films, lang) {
  document.documentElement.lang = lang;
  for (const film of films) {
    const card = list.querySelector(`[data-film-id="${CSS.escape(film.id)}"]`);
    if (!card) continue;
    const title = card.querySelector('[data-testid="film-title"]');
    const { text, lang: titleLang } = pickTitle(film, lang);
    title.textContent = text;
    if (titleLang !== lang) title.setAttribute('lang', titleLang);
    else title.removeAttribute('lang');
  }
}

function isValidEmail(value) {
  if (!value || /\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && domain.includes('.') && domain.length > 2;
}

function setStatus(state, message) {
  status.dataset.state = state;
  // Re-insert text so repeated identical messages are announced again.
  status.textContent = '';
  status.textContent = message;
}

function onSubmit(event) {
  event.preventDefault();
  const value = email.value.trim();
  email.value = value;
  if (isValidEmail(value)) {
    email.removeAttribute('aria-invalid');
    setStatus('success', `Thanks. We will email ${value} when the next film is up.`);
  } else {
    email.setAttribute('aria-invalid', 'true');
    const why = value === ''
      ? 'Enter your email address to subscribe.'
      : 'That address does not look right. Use the form name@example.com, with one @ and no spaces.';
    setStatus('error', why);
    email.focus();
  }
}

async function init() {
  form.addEventListener('submit', onSubmit);
  try {
    const response = await fetch('data/films.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.channel) {
      if (data.channel.name) nameEl.textContent = data.channel.name;
      if (data.channel.tagline) taglineEl.textContent = data.channel.tagline;
    }
    const languages = Array.isArray(data.languages) ? data.languages : [];
    const films = Array.isArray(data.films) ? data.films : [];
    renderLanguages(languages);
    renderFilms(films, select.value || FALLBACK_LANG);
    select.addEventListener('change', () => applyTitles(films, select.value));
  } catch (error) {
    loadError.hidden = false;
  } finally {
    list.removeAttribute('aria-busy');
  }
}

init();
