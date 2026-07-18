import type { APIRoute } from 'astro';
import { getPublishedReviews } from '../lib/reviews';

// Tells search engines which pages exist. Also what you point Google Search
// Console at — see ANALYTICS.md, it's the free way to see which search terms
// bring readers in.
//
// If you add a new top-level page (e.g. /about), add its path to STATIC_PATHS.
const STATIC_PATHS = ['/', '/map'];

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://example.com');
  const reviews = await getPublishedReviews();

  const urls = [
    ...STATIC_PATHS.map((p) => ({ loc: new URL(p, base).href, lastmod: undefined as string | undefined })),
    ...reviews.map((r) => ({
      loc: new URL(`/reviews/${r.slug}`, base).href,
      // Search engines use lastmod to decide whether to re-crawl — so an
      // edited review should advertise its `updated` date, not its original.
      lastmod: (r.data.updated ?? r.data.date).toISOString().split('T')[0],
    })),
  ];

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`
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
