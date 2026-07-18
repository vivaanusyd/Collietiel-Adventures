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
