'use strict';

const FALLBACK_LANG = 'en';

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatLanguageCount(count) {
  return `${count} ${count === 1 ? 'language' : 'languages'}`;
}

function isValidEmail(raw) {
  const value = String(raw ?? '').trim();
  if (!value || /\s/.test(value)) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at !== value.lastIndexOf('@')) return false;
  const domain = value.slice(at + 1);
  return domain.length > 0 && domain.includes('.');
}

function titleFor(film, lang) {
  const titles = film.titles || {};
  if (typeof titles[lang] === 'string' && titles[lang] !== '') return { text: titles[lang], fallback: false };
  return { text: titles[FALLBACK_LANG] ?? film.id, fallback: lang !== FALLBACK_LANG };
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

function renderHero(data) {
  const { channel, languages, films } = data;
  const h1 = document.getElementById('channel-name');
  const tagline = document.getElementById('channel-tagline');
  const facts = document.getElementById('channel-facts');
  if (h1) h1.textContent = channel.name;
  if (tagline) tagline.textContent = channel.tagline;
  if (facts) facts.textContent = `${films.length} films, dubbed into ${languages.length} languages`;
  document.title = `${channel.name} – films about how everyday objects work`;
}

function renderLanguageOptions(select, languages) {
  select.replaceChildren(...languages.map(({ code, name }) => el('option', { value: code, text: name })));
  select.value = languages.some((l) => l.code === FALLBACK_LANG) ? FALLBACK_LANG : languages[0]?.code;
}

function renderFilms(list, films, lang) {
  const cards = films.map((film, index) => {
    const title = titleFor(film, lang);
    const count = Array.isArray(film.languages) ? film.languages.length : 0;
    const titleNode = el('span', { 'data-testid': 'film-title', text: title.text, lang: title.fallback ? FALLBACK_LANG : null });
    const link = el('a', { class: 'film__link', 'data-testid': 'film-link', href: film.url }, [titleNode]);
    const durationNode = el('span', { class: 'film__duration', 'data-testid': 'film-duration', text: formatDuration(film.durationSeconds) });
    const langsNode = el('span', { class: 'film__langs', 'data-testid': 'film-langs', text: formatLanguageCount(count) });
    const image = el('img', {
      class: 'film__thumb', src: film.thumbnail, alt: '', width: 320, height: 180,
      loading: index === 0 ? 'eager' : 'lazy', decoding: 'async',
    });
    return el('li', { class: 'film', 'data-testid': 'film-card', 'data-film-id': film.id }, [
      el('span', { class: 'film__index', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0') }),
      el('div', { class: 'film__media' }, [image]),
      el('h3', { class: 'film__title' }, [link]),
      el('p', { class: 'film__meta' }, [durationNode, el('span', { class: 'film__sep', 'aria-hidden': 'true', text: '·' }), langsNode]),
    ]);
  });
  list.replaceChildren(...cards);
}

// Update titles in place: cards and the <select> are never rebuilt.
function applyLanguage(list, films, lang) {
  document.documentElement.lang = lang;
  for (const film of films) {
    const card = list.querySelector(`[data-film-id="${CSS.escape(film.id)}"]`);
    const titleNode = card?.querySelector('[data-testid="film-title"]');
    if (!titleNode) continue;
    const title = titleFor(film, lang);
    titleNode.textContent = title.text;
    if (title.fallback) titleNode.setAttribute('lang', FALLBACK_LANG);
    else titleNode.removeAttribute('lang');
  }
}

function setupNewsletter() {
  const form = document.getElementById('newsletter-form');
  const input = document.getElementById('newsletter-email');
  const status = document.getElementById('newsletter-status');
  if (!form || !input || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    input.value = value;
    status.textContent = '';
    if (isValidEmail(value)) {
      input.removeAttribute('aria-invalid');
      status.dataset.state = 'success';
      status.textContent = `Thanks. We will email ${value} when the next film is out.`;
    } else {
      input.setAttribute('aria-invalid', 'true');
      status.dataset.state = 'error';
      status.textContent = value === ''
        ? 'Enter your email address, for example name@example.com.'
        : 'That does not look like an email address. Use the form name@example.com, with one @ and no spaces.';
      input.focus();
    }
  });

  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && isValidEmail(input.value)) input.removeAttribute('aria-invalid');
  });
}

async function init() {
  setupNewsletter();
  const select = document.getElementById('lang-select');
  const list = document.getElementById('film-list');
  if (!select || !list) return;

  let data;
  try {
    const response = await fetch('data/films.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    list.replaceChildren(el('li', { class: 'film-list__error', text: 'The film list could not be loaded. Reload the page to try again.' }));
    return;
  }

  const languages = Array.isArray(data.languages) ? data.languages : [];
  const films = Array.isArray(data.films) ? data.films : [];
  renderHero({ channel: data.channel || {}, languages, films });
  renderLanguageOptions(select, languages);
  renderFilms(list, films, select.value);
  document.documentElement.lang = select.value;
  select.addEventListener('change', () => applyLanguage(list, films, select.value));
}

init();
