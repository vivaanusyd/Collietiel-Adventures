# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Collietiel Adventures — an Astro static restaurant review blog with a Git-backed CMS (Sveltia, at `/admin/`) so non-technical writers submit reviews as pull requests. Live at https://collietiel-adventures.netlify.app, deployed by Netlify on push to `main`. No database, no reader accounts, three runtime dependencies (`astro`, `leaflet`, `@astrojs/markdown-remark`) — keep it that way; RSS and the sitemap are hand-rolled endpoints on purpose.

Deeper docs, per audience: `docs/DEVELOPING.md` (architecture + schema, the most detailed), `EDITING.md` (writer-facing), `docs/SETUP-CHECKLIST.md` (dashboard/OAuth steps), `ANALYTICS.md`, `docs/ROADMAP.md`.

## Commands

Node 22 (`.nvmrc`); `sitetest.py` needs Python 3.

```bash
npm run dev            # localhost:4321 — drafts visible
npm run build          # astro check + build to dist/ — drafts stripped
npm test               # build + python3 sitetest.py dist + vitest — exactly what CI runs
npm run test:unit      # vitest only (no build)
npx vitest run test/search.test.mjs   # a single test file
npm run format         # prettier — Markdown and public/admin/config.yml excluded on purpose
```

Run `npm test` before every commit; never commit a failing build. `dev` and `prebuild` also run `scripts/sync-preview-css.mjs` and `scripts/optimize-images.mjs`.

## Hard constraints

- **Never write review content.** Do not invent restaurants, meals, prices, opinions or verdicts. The job is the machinery writers use, not the writing.
- **Never commit secrets.** OAuth secrets live in Netlify environment variables only.
- Anything requiring manual dashboard/console clicks goes in `docs/SETUP-CHECKLIST.md` as numbered steps.
- If an instruction turns out to be a bad idea, write it down in `NOTES-FOR-VIVAAN.md` rather than forcing it.
- One logical change per commit; commit messages and comments explain *why*, not *what*.
- No client-side password gates — a static site's "password" ships to the browser in plain text; auth is GitHub OAuth via the Netlify functions.

## Architecture

Two surfaces, kept separate: **authoring** (`public/admin/`, `src/content/reviews/`) and **reading** (`src/pages/`, `src/layouts/`). The contract between them is the review schema.

**The schema exists twice** — `src/content/config.ts` (zod, fails the build) and `public/admin/config.yml` (the CMS form, restated for writers). If they disagree, a writer saves something that fails a build they can't see or fix. `test/cms-config.test.mjs` asserts they agree on every block type, style option and verdict badge — change one, change both.

Invariants the code relies on:

- Pages fetch reviews through `getPublishedReviews()` in `src/lib/reviews.ts`, never `getCollection('reviews')` directly — that helper is what hides drafts in production. The single sanctioned exception is `src/pages/admin/reviews.json.ts`, which feeds the canvas editor and needs drafts.
- Coordinates go through `reviewCoords()` — a review carries either GeoJSON `location` (CMS map picker) or hand-written `lat`/`lng`. GeoJSON is `[lng, lat]`, reversed from speech order.
- Colours come from the CSS variables in `src/styles/global.css`. Dark mode is implemented purely by redeclaring those variables, so any literal colour is a thing that doesn't switch.
- `draft: true` → visible in `npm run dev` with a DRAFT badge, absent from the build (no page, pin, RSS or sitemap entry). The CMS defaults new reviews to draft.

### Blocks and the canvas editor

A review body is Markdown, an ordered `blocks:` list, or both. Six block types (text, image, gallery, annotated, quote, dishes) rendered by `src/components/Blocks.astro` (placement) + `BlockContent.astro` (one block's markup). Style options are fixed lists from the palette (`src/lib/block-options.mjs`), deliberately not free colour/font pickers.

**Adding a block type touches five places:** a variant in `src/lib/blocks.ts`, a name in `block-options.mjs`, a branch in `BlockContent.astro`, a `types:` entry in `public/admin/config.yml`, and schema-matching defaults in the canvas dock in `src/scripts/arrange.ts`.

The canvas editor (`/admin/arrange`) places blocks by **grid coordinates, never pixels** (24 columns desktop, 8 phone). `src/lib/layout.mjs` holds the grid maths and is shared by the editor and the published page — that sharing is the whole reason the editor is an Astro page instead of a static file; do not fork a second copy.

Text blocks render through `src/lib/markdown.ts`, which mirrors the remark pipeline in `astro.config.mjs`. A remark plugin added to one and not the other means shortcodes work in the body and silently not in blocks.

### Two icon systems, deliberately

`reaction: fox` (frontmatter verdict badge, exactly one, defined in `src/lib/reactions.ts`, bad name fails the build) vs `:collie-smiling:` (inline emotion in prose, defined in `src/lib/emotions.mjs`, bad name stays literal with a warning — which is why `test/remark-emotion-icons.test.mjs` exists). Both read PNGs from `public/icons/`; adding either means updating its list file *and* dropping the PNG, and for reactions also the `options:` in `public/admin/config.yml`.

### Images

Photos live in `public/images/reviews/` (the CMS writes there; the map's client JS needs plain URLs), which puts them outside Astro's image pipeline. `scripts/optimize-images.mjs` generates WebP + JPEG at five widths into `optimized/` (gitignored; Netlify regenerates). Use `<Picture>` (pass `sizes`) in templates, `imageUrl(src, width)` where a srcset can't go (map popups, OG images, JSON-LD).

### Other things that bite

- `STATIC_PATHS` in `src/pages/sitemap.xml.ts` is a manual list — new static routes must be added there.
- The site domain lives in exactly two places: `site:` in `astro.config.mjs` and the `Sitemap:` line in `public/robots.txt` (plus the GitHub OAuth callback URL).
- `test/xml.test.ts`'s escaper and the emotion-shortcode plugin both **fail silently** in production — the unit tests are the only regression net.
- Don't let Prettier touch Markdown or `public/admin/config.yml`; `.prettierignore` explains why (writers' content, hand-formatted YAML).
