// @ts-check
/**
 * Pulls 3 Instagram posts into `lens/` (images + lens.json) for the "Through the lens" section.
 * Run it locally and commit the result; the page only ever reads the committed files.
 *
 *   IG_TOKEN=... node scripts/update-lens.mjs            # 3 most liked of the recent posts
 *   IG_TOKEN=... node scripts/update-lens.mjs --latest   # 3 latest posts
 *
 * Requires Node 18+ and an Instagram API access token (Instagram Login) for a Business or Creator
 * account with the `instagram_business_basic` permission. Long-lived tokens expire after 60 days;
 * pass `--refresh` to exchange the current token for a fresh one (printed, not saved).
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';

const API = 'https://graph.instagram.com';
const OUT_DIR = new URL('../lens/', import.meta.url);
const COUNT = 3;
/** How many recent posts to consider when ranking by likes. */
const POOL = 50;

/**
 * @typedef {{ id: string, caption?: string, media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM',
 *   media_url?: string, thumbnail_url?: string, permalink: string, timestamp: string, like_count?: number }} Media
 */

const token = process.env.IG_TOKEN;
if (!token) {
  console.error('Set IG_TOKEN to an Instagram API access token.');
  process.exit(1);
}
const args = new Set(process.argv.slice(2));

/**
 * @param {string} path
 * @param {Record<string, string>} params
 */
async function api(path, params) {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries({ ...params, access_token: /** @type {string} */ (token) })) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${body?.error?.message ?? JSON.stringify(body)}`);
  return body;
}

if (args.has('--refresh')) {
  const { access_token, expires_in } = await api('/refresh_access_token', { grant_type: 'ig_refresh_token' });
  console.log(`New token (valid ${Math.round(expires_in / 86400)} days):\n${access_token}`);
  process.exit(0);
}

/** @type {Media[]} */
const media = [];
/** @type {string | undefined} */
let next = `${API}/me/media?${new URLSearchParams({
  fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count',
  limit: '25',
  access_token: token,
})}`;
while (next && media.length < POOL) {
  const res = await fetch(next);
  const body = await res.json();
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${body?.error?.message ?? JSON.stringify(body)}`);
  media.push(...body.data);
  next = body.paging?.next;
}

const picks = media
  // Videos only carry a poster frame in `thumbnail_url`; skip any post with no usable still.
  .filter(m => (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url))
  .sort((a, b) => args.has('--latest')
    ? b.timestamp.localeCompare(a.timestamp)
    : (b.like_count ?? 0) - (a.like_count ?? 0))
  .slice(0, COUNT);

if (picks.length === 0) throw new Error('No image posts found.');

/** First line of the caption, without hashtags, trimmed to fit a tile. */
const shortCaption = (/** @type {string | undefined} */ c) => {
  const line = (c ?? '').split('\n')[0].replace(/#\S+/g, '').replace(/\s+/g, ' ').trim();
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
};

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const items = [];
for (const [i, m] of picks.entries()) {
  const src = /** @type {string} */ (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Image download failed (${res.status}) for ${m.permalink}`);
  const file = `${i + 1}.jpg`;
  await writeFile(new URL(file, OUT_DIR), Buffer.from(await res.arrayBuffer()));
  items.push({ src: `lens/${file}`, href: m.permalink, caption: shortCaption(m.caption), likes: m.like_count ?? null, date: m.timestamp });
}

await writeFile(new URL('lens.json', OUT_DIR), `${JSON.stringify(items, null, 2)}\n`);
console.log(`Saved ${items.length} posts to lens/ (${args.has('--latest') ? 'latest' : 'most liked'}):`);
for (const it of items) console.log(`  ${it.src}  ${it.likes ?? '?'} likes  ${it.caption || '(no caption)'}`);
