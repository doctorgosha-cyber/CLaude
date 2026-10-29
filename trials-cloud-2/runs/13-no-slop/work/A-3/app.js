'use strict';

const FALLBACK_LANG = 'en';

const els = {
  name: document.getElementById('channel-name'),
  tagline: document.getElementById('channel-tagline'),
  select: document.getElementById('lang-select'),
  grid: document.getElementById('film-grid'),
  note: document.getElementById('films-note'),
  form: document.getElementById('newsletter-form'),
  email: document.getElementById('newsletter-email'),
  status: document.getElementById('newsletter-status'),
};

let films = [];
const cardRefs = new Map(); // film id -> { title, link }

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatLanguageCount(n) {
  return n === 1 ? '1 language' : `${n} languages`;
}

function pickTitle(film, lang) {
  const titles = film.titles || {};
  if (typeof titles[lang] === 'string' && titles[lang].length) {
    return { text: titles[lang], lang };
  }
  return { text: titles[FALLBACK_LANG] || film.id, lang: FALLBACK_LANG };
}

function buildCard(film, lang) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.testid = 'film-card';
  li.dataset.filmId = film.id;

  const img = document.createElement('img');
  img.className = 'card__thumb';
  img.src = film.thumbnail;
  img.alt = '';
  img.width = 320;
  img.height = 180;
  img.loading = 'lazy';
  img.decoding = 'async';

  const body = document.createElement('div');
  body.className = 'card__body';

  const h3 = document.createElement('h3');
  h3.className = 'card__title';
  const link = document.createElement('a');
  link.className = 'card__link';
  link.dataset.testid = 'film-link';
  link.href = film.url;
  const title = document.createElement('span');
  title.dataset.testid = 'film-title';
  link.appendChild(title);
  h3.appendChild(link);

  const meta = document.createElement('p');
  meta.className = 'card__meta';
  const duration = document.createElement('span');
  duration.dataset.testid = 'film-duration';
  duration.textContent = formatDuration(film.durationSeconds);
  const langs = document.createElement('span');
  langs.dataset.testid = 'film-langs';
  langs.textContent = formatLanguageCount((film.languages || []).length);
  meta.append(duration, langs);

  body.append(h3, meta);
  li.append(img, body);

  cardRefs.set(film.id, { title, link });
  applyTitle(film, lang);
  return li;
}

function applyTitle(film, lang) {
  const ref = cardRefs.get(film.id);
  if (!ref) return;
  const picked = pickTitle(film, lang);
  ref.title.textContent = picked.text;
  if (picked.lang !== lang) {
    ref.title.setAttribute('lang', picked.lang);
  } else {
    ref.title.removeAttribute('lang');
  }
}

function setLanguage(lang) {
  document.documentElement.lang = lang;
  for (const film of films) applyTitle(film, lang);
}

function renderLanguages(languages) {
  const frag = document.createDocumentFragment();
  for (const { code, name } of languages) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    if (code === FALLBACK_LANG) opt.selected = true;
    frag.appendChild(opt);
  }
  els.select.replaceChildren(frag);
  els.select.addEventListener('change', () => setLanguage(els.select.value));
}

function renderFilms(lang) {
  const frag = document.createDocumentFragment();
  for (const film of films) frag.appendChild(buildCard(film, lang));
  els.grid.replaceChildren(frag);
}

function showNote(text) {
  els.note.textContent = text;
  els.note.hidden = !text;
}

async function load() {
  try {
    const res = await fetch('data/films.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.channel) {
      if (data.channel.name) els.name.textContent = data.channel.name;
      if (data.channel.tagline) els.tagline.textContent = data.channel.tagline;
    }
    films = Array.isArray(data.films) ? data.films : [];
    renderLanguages(Array.isArray(data.languages) ? data.languages : [{ code: 'en', name: 'English' }]);
    const lang = els.select.value || FALLBACK_LANG;
    renderFilms(lang);
    setLanguage(lang);
    showNote(films.length ? '' : 'No films yet.');
  } catch (err) {
    showNote('The film list could not be loaded right now.');
  }
}

/* ---------- newsletter ---------- */

function validateEmail(raw) {
  const value = raw.trim();
  if (!value) return 'Enter your email address.';
  if (/\s/.test(value)) return 'Remove the spaces from the email address.';
  const parts = value.split('@');
  if (parts.length !== 2) return 'The address needs exactly one @ sign, like name@example.com.';
  const [local, domain] = parts;
  if (!local) return 'Add the part before the @ sign, like name@example.com.';
  if (!domain.includes('.')) return 'The part after the @ needs a dot, like example.com.';
  return null;
}

function setStatus(state, message) {
  els.status.dataset.state = state;
  // Clear first so repeated identical messages are still announced.
  els.status.textContent = '';
  els.status.textContent = message;
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const problem = validateEmail(els.email.value);
  if (problem) {
    els.email.setAttribute('aria-invalid', 'true');
    setStatus('error', problem);
    els.email.focus();
    return;
  }
  els.email.removeAttribute('aria-invalid');
  const address = els.email.value.trim();
  els.email.value = address;
  setStatus('success', `Thanks. We will email ${address} when a new film is out.`);
});

els.email.addEventListener('input', () => {
  if (els.email.getAttribute('aria-invalid') === 'true' && !validateEmail(els.email.value)) {
    els.email.removeAttribute('aria-invalid');
  }
});

load();
