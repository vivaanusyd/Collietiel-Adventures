# Developing

For editing the repository directly. If you're writing a review, you want
[EDITING.md](../EDITING.md) instead — this file assumes a terminal.

## The shape of it

This site has two surfaces, and keeping them separate is the main design
idea in the codebase.

| | **Authoring** | **Reading** |
|---|---|---|
| Who for | Writers | Everyone else |
| What | The CMS, or Markdown files | Rendered pages, map, RSS, social cards |
| Optimised for | Fast to write, hard to get wrong | Fast to load, accessible, shareable |
| Where | `public/admin/`, `src/content/reviews/` | `src/pages/`, `src/layouts/` |

`src/content/config.ts` is the contract between them. It's why a review can
be written without thinking about HTML, and why a malformed one fails the
build instead of rendering something broken.

**`public/admin/config.yml` is the same contract, restated for the editor.**
When the two disagree, a writer saves something that fails the build, sees
an error about zod, and cannot fix it themselves. That's the worst failure
mode here, so `test/cms-config.test.mjs` asserts they agree on every block
type, style option and verdict badge. If you change one, change both — the
test will tell you if you forget.

## Commands

```bash
npm install
npm run dev          # localhost:4321 — drafts visible
npm run build        # type-check + build to dist/ — drafts stripped
npm run preview      # serve the production build
npm test             # build + sitetest.py + unit tests — run before pushing
npm run format       # prettier (code only; Markdown is excluded on purpose)
```

`npm test` is what CI runs. One definition, so a green tick on a pull
request means the same thing as a green run locally.

## Where things live

| Kind of thing | Location |
|---|---|
| Reviews (content) | `src/content/reviews/*.md` |
| Review schema — **the contract** | `src/content/config.ts` |
| CMS config — the same contract, for writers | `public/admin/config.yml` |
| Review queries — **the only place that calls `getCollection`** | `src/lib/reviews.ts` |
| Block vocabulary + styling options | `src/lib/blocks.ts`, `src/lib/block-options.mjs` |
| Block renderer | `src/components/Blocks.astro` |
| Verdict badge list (`reaction:`) | `src/lib/reactions.ts` |
| Inline emotion list (`:collie-smiling:`) | `src/lib/emotions.mjs` |
| The `:shortcode:` → `<img>` plugin | `src/lib/remark-emotion-icons.mjs` |
| `public/` file lookups + existence checks | `src/lib/public-files.mjs`, `src/lib/icons.mjs` |
| Icons — **all of them, one folder** | `public/icons/*.png` |
| Page shell, `<head>`, analytics slot | `src/layouts/BaseLayout.astro` |
| Global styles + palette | `src/styles/global.css` |
| OAuth for the CMS | `netlify/functions/` |
| Routes | `src/pages/` |
| Cover photos and in-review images | `public/images/reviews/` |

### Rules worth keeping

**Pages don't call `getCollection('reviews')` — they call
`getPublishedReviews()`.** That helper decides drafts are hidden in
production. If each page fetched its own reviews, that decision would live
in five files, and the day one drifts you publish an unfinished review.

**Coordinates go through `reviewCoords()`.** A review carries either a CMS-
written GeoJSON `location` or hand-written `lat`/`lng`. One reader means the
map pin and the structured data can't disagree about where a restaurant is.
Note GeoJSON is `[lng, lat]` — reversed from how it's spoken.

**Colours come from the palette in `global.css`.** Not just a preference:
dark mode is implemented purely by redeclaring those variables, so a literal
colour anywhere is a thing that doesn't switch. This is the same constraint
the block editor imposes on writers, and it applies to us for the same
reason.

## The content schema

```yaml
---
name: 'Bang Bang Noodles'          # required
location: '{"type":"Point","coordinates":[151.1957,-33.8908]}'
                                   # required*  — CMS map picker writes this
lat: -33.8908                      # required*  — or these two by hand
lng: 151.1957                      #             (*exactly one form)
rating: 4                          # required — whole number 1-5
date: 2026-02-10                   # required
reaction: fox                      # required — see src/lib/reactions.ts
blurb: 'Numbing, tangy, ...'       # required to PUBLISH — 20-160 chars
cover: '/images/reviews/x.jpg'     # optional — must start with /images/
coverAlt: 'A bowl of dan dan...'   # optional but write one
cuisine: 'Sichuan'                 # optional — groups onto /cuisine/<slug>
address: '12 King St, Newtown'     # optional
author: 'Vivaan'                   # optional — defaults to Vivaan
draft: true                        # optional — defaults to false
updated: 2026-03-02                # optional — set when you revise
hotspots:                          # optional — needs a cover
  - { x: 25, y: 70, label: 'Galbi' }
blocks: []                         # optional — see src/lib/blocks.ts
---

Markdown body here. Optional — a review may use blocks, a body, or both.
```

### What the schema enforces, and why

Each is a mistake better hit in the terminal than in production:

| Rule | Reason |
|---|---|
| `blurb` 20–160 chars **to publish** | Under 20 says nothing; over 160 breaks the card grid and truncates in social previews. Only enforced on publish, so a draft needn't invent one |
| `rating` whole 1–5 | No half stars to render |
| `cover` starts with `/images/` **and the file exists** | Catches both a relative path and a typo'd filename — `public/` bypasses Vite, so nothing else checks |
| exactly one of `location` / `lat`+`lng` | A review with neither builds fine and silently never appears on the map |
| `lat`/`lng` in real ranges | Catches swapped coordinates, which put the pin in the ocean |
| `reaction` from a fixed list | Guarantees the icon file exists |
| block `alt` non-empty | It's what a screen reader announces; "optional but please" produces empty strings |
| `hotspots` require a `cover` | They're percentages of a photo that would otherwise not exist |

## Two icon systems, deliberately

| | Verdict badge | Inline emotion |
|---|---|---|
| Written as | `reaction: fox` in frontmatter | `:collie-smiling:` in the body |
| How many | Exactly one per review | As many as the prose wants |
| Shows up | Card, review page | Mid-sentence, inline |
| Defined in | `src/lib/reactions.ts` | `src/lib/emotions.mjs` |
| Bad name | Fails the build | Stays literal + terminal warning |

Both read their art from `public/icons/`. Details in
[public/icons/README.md](../public/icons/README.md).

**To add either:** add the entry to its list file *and* drop a matching PNG
in `public/icons/`. For a reaction, also add it to the `options:` under
**Verdict badge** in `public/admin/config.yml`, or writers can't pick it —
the CMS test will fail until you do.

## Blocks

`blocks:` is an ordered list rendered by `Blocks.astro`. Six types: text,
image, gallery, annotated, quote, dishes.

Blocks rather than a freeform canvas, because absolute positioning breaks at
any other browser width — which is most readers, since most are on phones —
can't survive a font-size change, and makes every page a bespoke layout no
restyle can touch. Notion, Squarespace, Webflow and Medium are all
block-flow underneath for the same reasons.

Style options are fixed lists (`block-options.mjs`), not pickers. See the
comment at the top of that file.

**To add a block type**, four places: a variant in `src/lib/blocks.ts`, a
name in `block-options.mjs`, a `case` in `Blocks.astro`, and a `types:`
entry in `public/admin/config.yml`. The CMS test fails until the first and
last agree.

Text blocks render through `src/lib/markdown.ts`, which uses the same remark
pipeline as the review body — that's what makes `:collie-smiling:` work
inside a block. If you add a remark plugin to `astro.config.mjs`, add it
there too, or shortcodes will work in the body and silently not in blocks.

## The draft workflow

`draft: true` means: **visible** in `npm run dev` with a red DRAFT badge,
**absent** from `npm run build` — no page, no pin, no RSS entry, no sitemap
entry. There's no staging site.

The CMS defaults new reviews to draft, so nothing reaches the live site by
being forgotten.

## Testing

```
test/remark-emotion-icons.test.mjs   the shortcode plugin
test/xml.test.ts                     the feed escaper
test/cms-config.test.mjs             CMS config vs. schema
sitetest.py                          the built dist/ — links, meta, feeds, a11y
```

The first two exist because both functions **fail silently**: an unknown
shortcode warns rather than throwing, and a double-escaped feed still
parses. Neither turns the build red, so a test is the only thing that
catches a regression.

`sitetest.py` skips `noindex` pages for SEO and sitemap checks — the CMS at
`/admin/` is an application, not content.

## Deploying

Push to `main`; Netlify builds and deploys. Config is in `netlify.toml`,
including the OAuth functions.

The two OAuth environment variables live in the Netlify dashboard and never
in the repo — see [SETUP-CHECKLIST.md](SETUP-CHECKLIST.md). A secret in Git
is a secret published, and Git remembers it after a later commit removes it.

The domain is written in exactly two places: `site:` in `astro.config.mjs`
and the `Sitemap:` line in `public/robots.txt`. Changing domain means
changing both, plus the callback URL in the GitHub OAuth app.

## Dependencies

Three runtime: `astro`, `leaflet`, `@astrojs/markdown-remark`. RSS and the
sitemap are hand-rolled endpoints (~40 lines each) rather than `@astrojs/rss`
and `@astrojs/sitemap`.

`@astrojs/markdown-remark` ships inside Astro anyway, but is declared
explicitly — depending on someone else's transitive dependency is how builds
break on an unrelated upgrade. Same reasoning keeps the remark plugin from
importing `unist-util-visit`.
