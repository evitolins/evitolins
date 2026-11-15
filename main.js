// @ts-check

const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/** @param {number} ms */
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TYPE_MS = 38;
const PAUSE_MS = 850;
const PAUSE_ROTATE = 5000;
const PAUSE_ROTATE_START = 350;

/**
 * Extra beat after punctuation, so clauses read as clauses.
 * @type {Record<string, number>}
 */
const PUNCT_MS = { ',': 620, ';': 260, ':': 260, '—': 260 };

/**
 * Reads a headline's text plus the pauses marked inline with `<i data-pause></i>`
 * (optionally `data-pause="ms"`). The markers are empty, so they're invisible without JS.
 * @param {Element} el
 * @returns {{ text: string, pauses: Map<number, number> }} pauses keyed by characters typed so far
 */
function parseLine(el) {
  let text = '';
  /** @type {Map<number, number>} */
  const pauses = new Map();
  for (const node of el.childNodes) {
    if (node instanceof HTMLElement && node.hasAttribute('data-pause')) {
      const ms = Number(node.dataset.pause) || PAUSE_MS;
      pauses.set(text.length, (pauses.get(text.length) ?? 0) + ms);
    } else {
      text += (node.textContent ?? '').replace(/\s+/g, ' ');
    }
  }
  return { text: text.trim(), pauses };
}

/**
 * Cycles through the `.rot-line` headlines inside `.rotator`, deleting and retyping each one.
 * The headlines live in index.html so they render without JS and can be edited in one place.
 * @param {HTMLElement} root
 */
async function rotate(root) {
  const parsed = [...root.querySelectorAll('.rot-line')].map(parseLine);
  const lines = parsed.map(p => p.text);
  const out = /** @type {HTMLElement} */ (root.querySelector('.rot-out'));
  // Nothing to rotate; leave the static first line in place.
  if (lines.length < 2 || !out) return;

  // Start fully typed so the first paint matches the no-JS headline.
  out.textContent = lines[0];
  root.classList.add('is-typing');

  for (let i = 0; ; i = (i + 1) % lines.length) {
    await sleep(PAUSE_ROTATE);
    for (let n = lines[i].length; n >= 0; n--) { out.textContent = lines[i].slice(0, n); await sleep(18); }
    await sleep(PAUSE_ROTATE_START);
    const { text: next, pauses } = parsed[(i + 1) % lines.length];
    for (let n = 1; n <= next.length; n++) {
      out.textContent = next.slice(0, n);
      await sleep(TYPE_MS + (PUNCT_MS[next[n - 1]] ?? 0) + (pauses.get(n) ?? 0));
    }
  }
}

const rotator = /** @type {HTMLElement | null} */ (document.querySelector('.rotator'));
// Respect reduced-motion users: they keep the static first headline.
if (rotator && !matchMedia('(prefers-reduced-motion: reduce)').matches) rotate(rotator);

/** @typedef {{ src: string, href: string, caption: string }} LensItem */

/**
 * Renders the Instagram tiles from the committed lens/lens.json (see scripts/update-lens.mjs).
 * The whole section stays hidden until the data exists (the script hasn't been run yet).
 * @param {HTMLElement} grid
 */
async function loadLens(grid) {
  const res = await fetch('lens/lens.json');
  if (!res.ok) throw new Error(`lens.json: HTTP ${res.status}`);
  /** @type {LensItem[]} */
  const items = await res.json();
  grid.replaceChildren(...items.map(({ src, href, caption }) => {
    const a = document.createElement('a');
    a.className = 'tile';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    const img = document.createElement('img');
    img.src = src;
    img.alt = caption;
    img.loading = 'lazy';
    a.append(img);
    if (caption) {
      const span = document.createElement('span');
      span.textContent = caption;
      a.append(span);
    }
    return a;
  }));
  const section = grid.closest('section');
  if (section) section.hidden = items.length === 0;
}

const lens = /** @type {HTMLElement | null} */ (document.querySelector('.lens'));
if (lens) loadLens(lens).catch(err => console.warn('Instagram section hidden; no lens data yet:', err));

const nav = document.querySelector('nav');
const navTrigger = document.getElementById('links');
if (nav && navTrigger) {
  nav.classList.add('auto-hide');
  // Show the nav only once the hero links have scrolled off the top, not while they're still below the fold.
  new IntersectionObserver(([e]) => {
    nav.classList.toggle('is-visible', !e.isIntersecting && e.boundingClientRect.top < 0);
  }).observe(navTrigger);
}
