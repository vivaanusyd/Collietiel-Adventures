import type { APIRoute } from 'astro';
import { getPublishedReviews, starString } from '../lib/reviews';
import { SITE, siteTitle } from '../lib/site';

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

  const feedUrl = new URL('/rss.xml', base).href;

  // Newest review's date, or now if there are none. Feed readers use this to
  // decide whether anything changed before re-downloading every item.
  const lastBuild = reviews[0]?.data.date ?? new Date();

  // The atom:link self-reference is the one thing RSS 2.0 validators reliably
  // complain about when it's missing. It tells a reader the feed's canonical
  // address, so a feed that gets mirrored or moved can still be traced back.
  // It's from the Atom spec, hence the extra namespace on <rss>.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(siteTitle())}</title>
    <link>${esc(base.href)}</link>
    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${esc(SITE.description)}</description>
    <language>en-au</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
