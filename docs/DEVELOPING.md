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
type and style option. If you change one, change both — the test will tell
you if you forget.

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
| Verdict badge list (`reaction:`) — **retired, see below** | `src/lib/reactions.ts` |
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
reaction: fox                      # RETIRED — optional, drawn nowhere
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
| block `alt` non-empty | It's what a screen reader announces; "optional but please" produces empty strings |
| `hotspots` require a `cover` | They're percentages of a photo that would otherwise not exist |

## Two icon systems, deliberately

| | Verdict badge (**retired**) | Inline emotion |
|---|---|---|
| Written as | `reaction: fox` in frontmatter | `:collie-smiling:` in the body |
| How many | Exactly one per review | As many as the prose wants |
| Shows up | **Nowhere — no longer drawn** | Mid-sentence, inline |
| Defined in | `src/lib/reactions.ts` | `src/lib/emotions.mjs` |
| Bad name | Fails the build | Stays literal + terminal warning |

The verdict badge was one fixed stamp per review, chosen from a list. The
Sunday Table has its own reaction stickers, placed in the page where they
mean something, so the site stopped drawing this one — see **Publishing a
Sunday Table review** at the bottom. Everything below about it describes a
field nothing reads.

Both read their art from `public/icons/`. Details in
[public/icons/README.md](../public/icons/README.md).

**To add an emotion:** add the entry to `emotions.mjs` *and* drop a matching
PNG in `public/icons/`. (Reactions no longer need this — nothing renders
them, and the CMS no longer offers the field.)

## Blocks

`blocks:` is an ordered list rendered by `Blocks.astro`. Six types: text,
image, gallery, annotated, quote, dishes.

A block either FLOWS (stacked, the default) or is PLACED via `layout` — see
**The canvas editor** below. `Blocks.astro` decides where things go;
`BlockContent.astro` renders one block regardless of where it sits.

Positioning is grid coordinates rather than pixels, which is what lets the
canvas offer genuine drag-anywhere — including overlap — without pages
breaking at other widths or surviving a font-size change badly. Absolute
pixel positioning would do neither.

Style options are fixed lists (`block-options.mjs`), not pickers. See the
comment at the top of that file.

**To add a block type**, four places: a variant in `src/lib/blocks.ts`, a
name in `block-options.mjs`, a branch in `BlockContent.astro`, and a
`types:` entry in `public/admin/config.yml`. The CMS test fails until the
first and
last agree. The canvas dock in `src/scripts/arrange.ts` also lists the
types, with starting values using the schema's field names — note most
types still need real content (an image path, alt text, a dish) before the
schema accepts them, which is why the canvas's save warns about unfinished
blocks (`unfinished()` there mirrors the schema's hard requirements; keep
the two in step).

Text blocks render through `src/lib/markdown.ts`, which uses the same remark
pipeline as the review body — that's what makes `:collie-smiling:` work
inside a block. If you add a remark plugin to `astro.config.mjs`, add it
there too, or shortcodes will work in the body and silently not in blocks.

## The canvas editor

`/admin/arrange` (`src/pages/admin/arrange.astro` + `src/scripts/arrange.ts`)
positions blocks on a grid. A block with no `layout` flows as before; one
with `layout.desktop` is placed.

Placement is grid COORDINATES, never pixels — 24 columns on desktop, 8 on
phone, rows `minmax(24px, auto)` so a block whose content overflows grows its
row instead of colliding. Mobile is derived from desktop reading order unless
`layout.mobile` is set.

**`src/lib/layout.mjs` is shared by the editor and the published page.** That
is the whole reason the editor is an Astro page rather than a static file in
`public/` — a second copy of the grid maths would eventually disagree with
the site about where a block sits, and an editor you can't trust is worse
than none.

It lives outside Sveltia because `registerFieldType` is unimplemented
upstream. Saving copies the arrangement out rather than committing; wiring it
to GitHub would mean a second OAuth flow and pull-request path beside the one
Sveltia already runs.

`/admin/reviews.json` feeds it, and is the ONE place `getCollection` is
called directly rather than through `getPublishedReviews()` — the editor
needs drafts. Those files are already public in the repo, so it exposes
nothing new.

## Images

Photos live in `public/images/reviews/` because the CMS writes there and the
map's client-side JS needs a plain URL — which puts them outside Astro's
image pipeline entirely. `scripts/optimize-images.mjs` runs on `prebuild`,
generating WebP + JPEG at five widths into `optimized/` plus a manifest.

- `<Picture>` emits the `<picture>`/srcset. Pass `sizes` — the browser picks
  from srcset before stylesheets apply, so it can only know the display width
  if told.
- `imageUrl(src, width)` for anywhere a srcset can't go: map popups, OG
  images, JSON-LD.
- Variants are gitignored; Netlify regenerates them per deploy.

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
test/search.test.mjs                 search ranking
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

## The design prototype (`/dev/editor`)

`layout-editor/` holds the Claude Design prototype the canvas editor's
chrome came from. `npm run dev` serves it at
[localhost:4321/dev/editor](http://localhost:4321/dev/editor) — dev server
only, via the `dev-design-editor` hook in `astro.config.mjs`; it never
reaches a build or the live site. It needs the network (its runtime loads
React from unpkg), and its free-pixel model is the *prototype's*, not the
site's — treat it as a design reference, not a spec.

## The Sunday Table editor (`/desk/`)

`functions-assets/desk.html` is the newer Claude Design prototype ("The
Sunday Table — Review Editor") served **verbatim** at `/desk/`.
It's a single self-contained bundle — React, the dc-runtime, the app and
all fonts inlined — served byte-for-byte precisely so it renders exactly
like the exported file; any processing (Prettier, template extraction,
wrapping it in a layout) is what breaks its visuals, so the file is never
edited or formatted (see `.prettierignore`). The only local additions are
the `<title>` and a `noindex` meta in the wrapper head, which keep
`sitetest.py` treating it as an application like `/admin/`.

Everything it saves lives in that browser's localStorage
(`sundayTableReviews_v1`); its Publish button flips a flag in that store
and does **not** create a real review on the site — wiring it to the
Git-backed content is future work (the path is written down in
`ROADMAP.md`, "Wiring the Sunday Table"). The grid canvas editor at
`/admin/arrange` is unaffected and remains the editor that writes real
blocks.

**Signing in at `/admin/` lands you here.** The CMS still loads — its
GitHub OAuth is the only sign-in this site has — but it is no longer the
destination: `public/admin/index.html` watches for an authenticated session
and hands the page over to `/desk/`. `/admin/?cms=1` still opens the CMS,
deliberately unlinked, because Sveltia remains the only machinery here that
can actually publish a review and sending every visit to the desk would
otherwise leave no URL that reaches it.

**The sign-in gate in front of `/desk/` is ON.** Three things make it work,
and all three are load-bearing:

- `netlify/functions/desk.mjs` — serves the page only to a valid session.
  Its `config.path` claims `/desk/`, which is what makes it live.
- `netlify/functions/desk-auth.mjs` + the desk branch in `callback.mjs` —
  the sign-in itself, reusing the CMS's OAuth app. `/api/desk-auth` sets an
  `oauth_flow=desk` cookie, and `callback.mjs` branches on it and asks
  GitHub whether the account has push access (`permissions.push`) before
  issuing a signed session. Both flows share `/api/callback` because a
  GitHub OAuth app permits only one registered callback URL — that is the
  whole reason for the cookie branch instead of a second endpoint.
- `netlify/lib/session.mjs` + `test/session.test.mjs` — the cookie signing,
  keyed by `DESK_SESSION_SECRET` (set in Netlify, never in the repo). A
  forged cookie that verifies is a silent, total failure, so it is tested
  rather than trusted.

**The part that actually does the work is the page's location.** It is in
`functions-assets/`, not `public/`, and `netlify.toml`'s `included_files`
is what carries it into the function's bundle from there. Everything in
`public/` is handed out by the CDN before any function runs, so a gated
page cannot live in it — move this file back and you get a lock on a door
with no wall, with nothing about the site looking any different.

Access is the repo's collaborator list and nothing else: no per-writer
secret, no accounts to create. `DESK_SESSION_SECRET` is one site-wide
signing key, not anybody's password; rotating it just signs everyone out.

`npm run dev` serves the page unauthenticated via the `devDesk` hook in
`astro.config.mjs` — Astro's dev server doesn't run Netlify Functions, so
the gate simply isn't there locally. That hook is `astro:server:setup`
only, so it cannot run during a build.

## Publishing a Sunday Table review (`desk:`)

A review written in the Sunday Table is stored **verbatim** — the editor's
own document, in a `desk:` field in the review's frontmatter — and drawn by
`src/components/DeskReview.astro`. It is not converted into the `blocks:`
vocabulary above, and that is the central decision here.

**Why not convert.** Blocks describe a review as a stack of known shapes. A
desk review isn't that: it's an arranged page, with rotated photos in the
margins, a shape behind a heading, a font chosen per paragraph. Converting
straightens all of it, which publishes a review that is not the one that was
written. Storing the document whole means nothing is translated, so nothing
is lost in translation.

**What it costs.** A second renderer. `src/lib/desk-render.mjs` is a
transcription of the editor's own layout maths — fonts, default text styles,
per-kind margins, the float offset correction — and everything visual reads
from it. That's the same trade `layout.mjs` makes for the canvas editor, with
the same defence: one file holds the numbers, and `test/desk-render.test.mjs`
pins them. **When the desk is re-exported from Claude Design, this is the file
to check against it.**

**How the floating photos work with no JavaScript.** The editor positions a
float by measuring where its anchor block landed and adding the stored
`dx`/`dy`. That measurement can't happen at build time — but it doesn't need
to, because the offset is already *relative to the anchor*. Rendering the
float as an absolutely-positioned child of that block reproduces the same
coordinates by construction: text reflows, the anchor moves, the float moves
with it. No measuring, no layout shift, works with JavaScript off.

Two details in that trick are load-bearing and look like noise:

- Text wrappers carry a **1.5px transparent border** in the editor. The
  editor stores offsets against the border box; CSS positions absolute
  children from the padding box. Hence `floatOffsetCorrection` — drop it and
  every float against a paragraph moves 1.5px.
- The paper paints its background on **its own `z-index: -2` layer** so that
  floats sent *behind* the words can sit at `-1`, between the background and
  the text. Put the background on the paper itself and "behind" floats
  vanish underneath it.

### Frontmatter is not duplication of the document

The document is what the page *draws*. The frontmatter beside it is what the
*site* reads — cards, map, search, RSS, structured data — none of which can be
answered by a page layout. They meet only at publish time, where the desk's
values are copied out into frontmatter, one direction, so there's never a
question about which is right.

### Three places the page knowingly differs from the desk

Worth knowing before someone reports them as bugs:

1. **Fonts.** The desk offers eight families; this site self-hosts only
   Fraunces and Inter and promises no third-party requests. A review set in
   Playfair renders in the fallback (Georgia) for most readers. Fixing it
   means self-hosting eight more families.
2. **Half stars.** The desk keeps `4.5`; the schema keeps whole stars on
   purpose. The arrangement shows four and a half, the card shows four.
   Fixing it is a decision about the star scale, not a bug in either file.
3. **Narrow screens.** A float is a pixel offset inside a 720px page, which a
   phone cannot honour — below 780px floats fall into the text as ordinary
   images in anchor order, and decorative shapes are dropped. The alternative
   is a horizontal scrollbar and photos cropped off the side.

### The verdict badge is retired

`reaction:` — one animal per review, stamped on the card — is no longer drawn
anywhere. The Sunday Table has its own reaction stickers, which the writer
places in the page where they mean something. The field stays optional in the
schema so existing reviews still validate, and `src/lib/reactions.ts` still
exists for the icons; nothing reads either. Delete both once no file in
`src/content/reviews/` mentions it.

### Not yet wired: Publish

The desk's Publish button still only flips a flag in that browser's
`localStorage`. Everything above is the *reading* half — the site can draw a
desk review, but nothing yet writes one into the repo. `docs/ROADMAP.md` has
what the writing half needs.
