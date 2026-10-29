// Anatomy of Things – landing section behaviour. ES2020, no dependencies.

const DEFAULT_LANG = 'en';

/** 612 → "10:12", 59 → "0:59", 1203 → "20:03" */
function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** 1 → "1 language", 7 → "7 languages" */
function formatLanguageCount(n) {
  return n === 1 ? '1 language' : `${n} languages`;
}

/**
 * Trimmed address is valid when it has exactly one "@", a non-empty local
 * part, a domain containing a dot, and no whitespace.
 */
function validateEmail(raw) {
  const value = String(raw ?? '').trim();
  if (value === '') return { ok: false, reason: 'Enter your email address.' };
  if (/\s/.test(value)) return { ok: false, reason: 'Remove the spaces from the email address.' };
  const at = value.indexOf('@');
  if (at === -1 || at !== value.lastIndexOf('@')) {
    return { ok: false, reason: 'An email address needs exactly one "@", like name@example.com.' };
  }
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!local) return { ok: false, reason: 'Add the part before the "@", like name@example.com.' };
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return { ok: false, reason: 'The part after the "@" needs a dot, like example.com.' };
  }
  return { ok: true, value };
}

/** Title for a film in `lang`, falling back to English. */
function pickTitle(film, lang) {
  const titles = film.titles || {};
  if (typeof titles[lang] === 'string' && titles[lang] !== '') return { text: titles[lang], lang };
  return { text: titles[DEFAULT_LANG] ?? '', lang: DEFAULT_LANG };
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children) node.append(child);
  return node;
}

function renderLanguages(select, languages) {
  select.replaceChildren(
    ...languages.map((l) => el('option', { value: l.code, selected: l.code === DEFAULT_LANG || null }, [l.name]))
  );
  select.value = DEFAULT_LANG;
}

function renderFilms(list, films, lang) {
  const items = films.map((film, index) => {
    const title = pickTitle(film, lang);
    const titleEl = el('span', { 'data-testid': 'film-title', class: 'film__title', lang: title.lang }, [title.text]);
    const link = el('a', { 'data-testid': 'film-link', class: 'film__link', href: film.url }, [titleEl]);
    const image = el('img', {
      class: 'film__thumb', src: film.thumbnail, alt: '', width: 320, height: 180, loading: index === 0 ? 'eager' : 'lazy', decoding: 'async',
    });
    const count = Array.isArray(film.languages) ? film.languages.length : 0;
    const meta = el('p', { class: 'film__meta' }, [
      el('time', { 'data-testid': 'film-duration', class: 'film__duration', datetime: `PT${Math.floor(film.durationSeconds)}S` }, [formatDuration(film.durationSeconds)]),
      el('span', { 'data-testid': 'film-langs', class: 'film__langs' }, [formatLanguageCount(count)]),
    ]);
    return el('li', { 'data-testid': 'film-card', 'data-film-id': film.id, class: 'film' }, [
      el('span', { class: 'film__index', 'aria-hidden': 'true' }, [String(index + 1).padStart(2, '0')]),
      el('div', { class: 'film__media' }, [image]),
      el('h3', { class: 'film__heading' }, [link]),
      meta,
    ]);
  });
  list.replaceChildren(...items);
}

/** Re-title the existing cards in place; the DOM around them is untouched. */
function retitleFilms(list, films, lang) {
  for (const film of films) {
    const card = list.querySelector(`[data-film-id="${CSS.escape(film.id)}"]`);
    if (!card) continue;
    const titleEl = card.querySelector('[data-testid="film-title"]');
    const title = pickTitle(film, lang);
    titleEl.textContent = title.text;
    titleEl.setAttribute('lang', title.lang);
  }
}

function setStatus(status, state, message) {
  // Clear first so repeated identical messages still count as an update.
  status.textContent = '';
  status.dataset.state = state;
  status.textContent = message;
}

function wireNewsletter() {
  const form = document.getElementById('newsletter-form');
  const input = document.getElementById('newsletter-email');
  const status = document.getElementById('newsletter-status');
  if (!form || !input || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validateEmail(input.value);
    if (!result.ok) {
      input.setAttribute('aria-invalid', 'true');
      setStatus(status, 'error', result.reason);
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    input.value = result.value;
    setStatus(status, 'success', `Thanks. We will email ${result.value} when a new film is out.`);
  });

  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && validateEmail(input.value).ok) {
      input.removeAttribute('aria-invalid');
    }
  });
}

async function init() {
  wireNewsletter();

  const select = document.getElementById('lang-select');
  const list = document.getElementById('film-list');
  const nameEl = document.getElementById('channel-name');
  const taglineEl = document.getElementById('channel-tagline');

  let data;
  try {
    const res = await fetch('data/films.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    list.replaceChildren(el('li', { class: 'films__error' }, ['The film list could not be loaded. Reload the page to try again.']));
    return;
  }

  if (data.channel) {
    if (data.channel.name) nameEl.textContent = data.channel.name;
    if (data.channel.tagline) taglineEl.textContent = data.channel.tagline;
  }

  const languages = Array.isArray(data.languages) ? data.languages : [];
  const films = Array.isArray(data.films) ? data.films : [];

  renderLanguages(select, languages);
  document.documentElement.lang = select.value || DEFAULT_LANG;
  renderFilms(list, films, select.value || DEFAULT_LANG);

  select.addEventListener('change', () => {
    const lang = select.value;
    document.documentElement.lang = lang;
    retitleFilms(list, films, lang);
  });
}

init();
