// @ts-check

const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/** @param {number} ms */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Cycles through the `.rot-line` headlines inside `.rotator`, deleting and retyping each one.
 * The headlines live in index.html so they render without JS and can be edited in one place.
 * @param {HTMLElement} root
 */
async function rotate(root) {
  const lines = [...root.querySelectorAll('.rot-line')].map(el => el.textContent?.trim() ?? '');
  const out = /** @type {HTMLElement} */ (root.querySelector('.rot-out'));
  // Nothing to rotate; leave the static first line in place.
  if (lines.length < 2 || !out) return;

  // Start fully typed so the first paint matches the no-JS headline.
  out.textContent = lines[0];
  root.classList.add('is-typing');

  for (let i = 0; ; i = (i + 1) % lines.length) {
    await sleep(4600);
    for (let n = lines[i].length; n >= 0; n--) { out.textContent = lines[i].slice(0, n); await sleep(18); }
    await sleep(350);
    const next = lines[(i + 1) % lines.length];
    for (let n = 1; n <= next.length; n++) { out.textContent = next.slice(0, n); await sleep(38); }
  }
}

const rotator = /** @type {HTMLElement | null} */ (document.querySelector('.rotator'));
// Respect reduced-motion users: they keep the static first headline.
if (rotator && !matchMedia('(prefers-reduced-motion: reduce)').matches) rotate(rotator);
