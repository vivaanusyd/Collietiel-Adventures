import { getCollection, type CollectionEntry } from 'astro:content';

export type Review = CollectionEntry<'reviews'>;

// EVERY page that lists or looks up reviews goes through this file. Nothing
// else should call getCollection('reviews') directly.
//
// Why: the draft rule below is a publishing decision. If each page fetched
// its own reviews, "hide drafts" would live in index.astro, map.astro AND
// [slug].astro — three copies, and the day one drifts you publish a half
// -finished review. One helper = one place that decision can be wrong.

/**
 * Published reviews, newest first.
 *
 * Drafts are VISIBLE in `npm run dev` (so you can preview your own work in
 * the real layout) and STRIPPED from `npm run build` (so they can't ship).
 * That's the whole draft workflow — there's no separate staging site.
 */
export async function getPublishedReviews(): Promise<Review[]> {
  const all = await getCollection('reviews');
  const visible = import.meta.env.PROD ? all.filter((r) => !r.data.draft) : all;
  return visible.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/**
 * Reviews per page on the homepage.
 *
 * 12 because the card grid is 1–4 columns depending on width, and 12 divides
 * evenly by 1, 2, 3 and 4 — so the last row is never a single orphaned card
 * at any breakpoint.
 *
 * Lives here rather than in [...page].astro because the sitemap has to know
 * how many pages exist. Astro hoists getStaticPaths out of the component, so
 * it can't read a const declared beside it in the frontmatter — but it CAN
 * read an import, which is why this works from both callers.
 */
export const REVIEWS_PER_PAGE = 12;

/**
 * URL-safe form of a cuisine name. "Café" -> "cafe", "Modern Australian"
 * -> "modern-australian".
 *
 * Writers type cuisine as free text, so this has to be forgiving: strip
 * accents, lowercase, collapse anything that isn't a letter or digit into a
 * single hyphen. Two spellings that differ only by case or accent land on
 * the same page, which is the point — "Cafe" and "Café" are one cuisine.
 */
export function cuisineSlug(cuisine: string): string {
  return (
    cuisine
      .normalize('NFD') // splits "é" into "e" + a combining accent...
      // ...which this removes. Written as escapes rather than the literal
      // characters: combining marks are invisible in a source file and attach
      // themselves to whatever precedes them, so the literal form is
      // impossible to review and easy for tooling to mangle.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Every cuisine that has at least one published review, with its reviews.
 *
 * Drives both /cuisine/<slug> and those pages' sitemap entries, so a cuisine
 * page can't exist without being listed, or be listed without existing.
 *
 * The display label is taken from the first review's spelling. Where writers
 * disagree ("Cafe" vs "Café") they still share one page — the slug is what
 * groups them — and the newest review's spelling wins, since that's the one
 * most likely to reflect current house style.
 */
export async function getCuisines(): Promise<{ slug: string; label: string; reviews: Review[] }[]> {
  const reviews = await getPublishedReviews();
  const groups = new Map<string, { slug: string; label: string; reviews: Review[] }>();

  for (const review of reviews) {
    const cuisine = review.data.cuisine?.trim();
    if (!cuisine) continue;

    const slug = cuisineSlug(cuisine);
    if (!slug) continue;

    const existing = groups.get(slug);
    if (existing) existing.reviews.push(review);
    else groups.set(slug, { slug, label: cuisine, reviews: [review] });
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Where a review's pin goes, from either accepted spelling.
 *
 * The CMS map picker writes stringified GeoJSON to `location`; a file
 * written by hand uses `lat`/`lng`. Everything that needs coordinates — the
 * map, the sitemap, the JSON-LD — goes through here, so neither the pin nor
 * the structured data can disagree about where a restaurant is.
 *
 * Returns null when the review has neither, which the schema forbids, so in
 * practice this only guards against malformed GeoJSON.
 */
export function reviewCoords(review: Review): { lat: number; lng: number } | null {
  const { location, lat, lng } = review.data;

  if (location) {
    try {
      const parsed = JSON.parse(location);
      // GeoJSON is [longitude, latitude] — the reverse of how it's spoken,
      // and the one thing worth being explicit about at every read site.
      const [parsedLng, parsedLat] = parsed?.coordinates ?? [];
      if (typeof parsedLat === 'number' && typeof parsedLng === 'number') {
        return { lat: parsedLat, lng: parsedLng };
      }
      console.warn(
        `[reviews] ${review.slug}: \`location\` is not a GeoJSON Point — no pin will be shown.`
      );
    } catch {
      console.warn(`[reviews] ${review.slug}: \`location\` is not valid JSON.`);
    }
  }

  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  return null;
}

/**
 * Rough reading time in minutes, from every word on the page.
 *
 * 200 wpm is the usual published estimate for general-audience prose.
 * Hand-counted rather than pulling in a remark plugin — it's a few lines.
 *
 * Counts the Markdown body AND the `blocks:` list, because a review written
 * in the CMS has an empty body and all of its prose in blocks. Counting only
 * the body would report "1 min read" on every CMS-authored review no matter
 * how long it is.
 */
export function readingTimeMinutes(review: Review): number {
  const parts = [review.body];

  for (const block of review.data.blocks ?? []) {
    // Only prose counts. Captions, alt text and dish prices are label-sized
    // and don't change how long a page takes to read.
    if (block.type === 'text') parts.push(block.body);
    else if (block.type === 'quote') parts.push(block.text);
    else if (block.type === 'dishes') {
      parts.push(block.items.map((i) => i.note ?? '').join(' '));
    }
  }

  const words = parts.join(' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** "★★★★☆" — used on cards, review pages and the RSS feed. */
export function starString(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}
