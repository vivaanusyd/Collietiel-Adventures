import type { APIRoute } from 'astro';
import { getPublishedReviews, starString } from '../lib/reviews';

// Hand-rolled rather than pulling in @astrojs/rss — the whole feed is one
// template string, and the only genuinely tricky part (escaping) is the
// five-character function below. Keeps the dependency list short.
//
// The five XML predefined entities. Done in ONE regex pass with a lookup so
// `&` can't be double-escaped (a sequential .replace() chain would turn
// "&" into "&amp;amp;").
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const GET: APIRoute = async ({ site }) => {
  const reviews = await getPublishedReviews();

  // Absolute URLs are required by the RSS spec — feed readers have no page
  // to resolve a relative path against. Needs `site:` set in astro.config.mjs.
  const base = site ?? new URL('https://example.com');

  const items = reviews
    .map((r) => {
      const url = new URL(`/reviews/${r.slug}`, base).href;
      const description = `${starString(r.data.rating)} — ${r.data.blurb}`;
      return `    <item>
      <title>${esc(r.data.name)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <description>${esc(description)}</description>
      <pubDate>${r.data.date.toUTCString()}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Blog — restaurant reviews</title>
    <link>${esc(base.href)}</link>
    <description>A small restaurant review blog.</description>
    <language>en-au</language>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
