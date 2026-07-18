# restaurant-blog

Astro + Leaflet/OpenStreetMap restaurant review blog. Reviews are Markdown
files with typed frontmatter — no CMS, no database, no accounts.

- **[EDITING.md](EDITING.md)** — how to write, draft, and publish a review
- **[ANALYTICS.md](ANALYTICS.md)** — what you can (and can't) learn about readers

## Where things live

One obvious place per kind of thing:

| Kind of thing | Location |
|---|---|
| Reviews (content) | `src/content/reviews/*.md` |
| Review schema (the contract) | `src/content/config.ts` |
| Review queries — **the only place that calls `getCollection`** | `src/lib/reviews.ts` |
| Verdict badge list (`reaction:`) | `src/lib/reactions.ts` |
| Inline emotion list (`:collie-smiling:`) | `src/lib/emotions.mjs` |
| The `:shortcode:` → `<img>` plugin | `src/lib/remark-emotion-icons.mjs` |
| Reusable components | `src/components/` |
| Icons — **all of them, one folder** | `public/icons/*.png` |
| Page shell, `<head>`, analytics slot | `src/layouts/BaseLayout.astro` |
| Global styles | `src/styles/global.css` |
| Routes | `src/pages/` |
| Cover photos | `public/images/reviews/` |

### The one rule worth keeping

**Pages don't call `getCollection('reviews')` — they call
`getPublishedReviews()` from `src/lib/reviews.ts`.**

That helper decides drafts are hidden in production. If each page fetched
its own reviews, that decision would live in four files, and the day one
drifts you'd publish an unfinished review. Adding a new page that lists
reviews? Use the helper.

## Two icon systems, deliberately

| | Verdict badge | Inline emotion |
|---|---|---|
| Written as | `reaction: fox` in frontmatter | `:collie-smiling:` in the body |
| How many | Exactly one per review | As many as the prose wants |
| Shows up | Homepage card, review page | Mid-sentence, inline with text |
| Defined in | `src/lib/reactions.ts` | `src/lib/emotions.mjs` |
| Bad name | Fails the build | Stays literal + terminal warning |

Both read their art from `public/icons/`. Details in
[public/icons/README.md](public/icons/README.md).

## Commands

```bash
npm install
npm run dev      # http://localhost:4321 — drafts visible
npm run build    # type-checks + builds to dist/ — drafts stripped
npm run preview  # serve the production build locally
```

## Routes

| Path | What |
|---|---|
| `/` | Card grid, newest first |
| `/map` | Every review as a map pin |
| `/reviews/<slug>` | One review |
| `/rss.xml` | Feed (hand-rolled, no dependency) |
| `/sitemap.xml` | For search engines — submit this to Search Console |

## Deploying

Static site, no adapter needed. Point Netlify or Vercel at the repo; both
auto-detect Astro. Build command `npm run build`, output dir `dist`.

**Set `site:` in `astro.config.mjs` to your real domain first** — canonical
URLs, RSS links, the sitemap and social previews all derive from it and
currently point at `example.com`.

## Dependencies

Two runtime: `astro`, `leaflet`. That's deliberate — RSS and the sitemap
are hand-rolled endpoints (~40 lines each) rather than `@astrojs/rss` and
`@astrojs/sitemap`.
