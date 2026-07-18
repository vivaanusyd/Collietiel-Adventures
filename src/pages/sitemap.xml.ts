import type { APIRoute } from 'astro';
import { getCuisines, getPublishedReviews, REVIEWS_PER_PAGE } from '../lib/reviews';
import { escapeXml } from '../lib/xml';

// Tells search engines which pages exist. Also what you point Google Search
// Console at — see ANALYTICS.md, it's the free way to see which search terms
// bring readers in.
//
// If you add a new top-level page, add its path to STATIC_PATHS. This list is
// manual because these pages are hand-made and few; anything GENERATED from
// content (reviews, cuisine pages) is derived below from the same helpers
// that build the pages, so a generated page can't exist without being listed
// or be listed without existing.
//
// /admin/ is deliberately absent: it's the editor, it's marked noindex, and
// listing it would be asking search engines to crawl an app that requires a
// GitHub login to do anything.
const STATIC_PATHS = ['/', '/map', '/about'];

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://example.com');
  const reviews = await getPublishedReviews();
  const cuisines = await getCuisines();

  // Homepage pages 2..n. Page 1 is "/" and is already in STATIC_PATHS.
  // These are indexable, self-canonical pages, so leaving them out would
  // mean the sitemap disagreed with what the site actually publishes. Page
  // size is imported from the same constant the route paginates with, so
  // the count can't drift.
  const pageCount = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));
  const paginationPaths = Array.from({ length: pageCount - 1 }, (_, i) => `/${i + 2}`);

  const urls = [
    ...[...STATIC_PATHS, ...paginationPaths].map((p) => ({
      loc: new URL(p, base).href,
      lastmod: undefined as string | undefined,
    })),
    ...reviews.map((r) => ({
      loc: new URL(`/reviews/${r.slug}`, base).href,
      // Search engines use lastmod to decide whether to re-crawl — so an
      // edited review should advertise its `updated` date, not its original.
      lastmod: (r.data.updated ?? r.data.date).toISOString().split('T')[0],
    })),
    // A cuisine page is as current as its most recently touched review.
    // reviews are newest-first, so that's the first one in the group.
    ...cuisines.map((c) => {
      const newest = c.reviews[0];
      return {
        loc: new URL(`/cuisine/${c.slug}`, base).href,
        lastmod: (newest.data.updated ?? newest.data.date).toISOString().split('T')[0],
      };
    }),
  ];

  // Slugs can contain characters that are legal in a URL but not in XML text
  // (`&` most of all), and an unescaped one makes the whole sitemap
  // unparseable rather than just that entry wrong.
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
