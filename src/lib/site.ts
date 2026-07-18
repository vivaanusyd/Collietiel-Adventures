// Site-wide identity — the name, tagline and default description.
//
// These used to be typed out in seven places (nav brand, four page titles,
// the RSS channel, the <meta description>). Renaming the site meant finding
// all seven, and missing one meant a page quietly disagreeing with the rest
// about what the site is called. Same reasoning as src/lib/reviews.ts: one
// decision, one place it can be wrong.
//
// The URL is deliberately NOT here — that lives in `site:` in
// astro.config.mjs, because Astro needs it before this module is loaded, and
// two copies of a domain is exactly the kind of drift this file exists to
// prevent.

export const SITE = {
  name: 'Collietiel Adventures',

  /** Appended to the homepage title: "<name> — <tagline>". */
  tagline: 'restaurant reviews',

  /** Default <meta name="description"> and the RSS channel description. */
  description: 'A small restaurant review blog, mostly around Sydney.',

  /** Sits before the name in the nav. */
  mark: '🍽️',
} as const;

/** "Map — Collietiel Adventures" — for every page except the homepage. */
export function pageTitle(page: string): string {
  return `${page} — ${SITE.name}`;
}

/** "Collietiel Adventures — restaurant reviews" — homepage and RSS channel. */
export function siteTitle(): string {
  return `${SITE.name} — ${SITE.tagline}`;
}
