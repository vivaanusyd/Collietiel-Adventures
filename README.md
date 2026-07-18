# Collietiel Adventures

Astro + Leaflet/OpenStreetMap restaurant review blog, with a Git-backed CMS
so non-technical writers can submit reviews without touching the code.

Live at <https://collietiel-adventures.netlify.app>.

## Start here

| You are | Read |
|---|---|
| Writing a review | **[EDITING.md](EDITING.md)** — the editor, the blocks, what happens when you submit |
| Setting this up | **[docs/SETUP-CHECKLIST.md](docs/SETUP-CHECKLIST.md)** — the dashboard steps, in order |
| Changing the code | **[docs/DEVELOPING.md](docs/DEVELOPING.md)** — architecture, schema, testing |
| Wondering about readers | **[ANALYTICS.md](ANALYTICS.md)** — what you can and can't learn |

## How it works

Reviews are Markdown files with typed frontmatter in
`src/content/reviews/`. There's no database and no reader accounts.

Writers use the CMS at `/admin/`, which commits to this repository on their
behalf. Sign-in is GitHub OAuth, so the permission check happens on GitHub's
servers against real accounts — access is granted and revoked in the repo's
collaborator list, and there is deliberately no password anywhere in the
site. Writers' work arrives as a pull request; nothing they do reaches the
live site directly.

The review body is an ordered list of **blocks** — text, image, gallery,
annotated photo, pull quote, dish list — each with its own settings. Style
options are fixed lists drawn from the site palette rather than free colour
and font pickers, so a redesign stays a stylesheet edit instead of a
migration across every review. Reasoning in
[`src/lib/blocks.ts`](src/lib/blocks.ts).

Reviews can still be written by hand as Markdown; the CMS is an additional
way in, not a replacement.

## Commands

```bash
npm install
npm run dev      # localhost:4321 — drafts visible
npm run build    # type-check + build to dist/ — drafts stripped
npm test         # build + sitetest.py + unit tests — what CI runs
npm run format   # prettier (code only)
```

## Routes

| Path | What |
|---|---|
| `/` | Card grid, newest first, paginated past 12 |
| `/map` | Every review as a map pin |
| `/reviews/<slug>` | One review |
| `/cuisine/<slug>` | Every review of one cuisine |
| `/about` | About — **structure only, prose not yet written** |
| `/admin/` | The editor (GitHub sign-in) |
| `/rss.xml` | Feed (hand-rolled, no dependency) |
| `/sitemap.xml` | For search engines — submit this to Search Console |

## Deploying

Static site, no adapter. Netlify builds on push to `main`; config is in
`netlify.toml`.

The editor's OAuth needs two environment variables set in the Netlify
dashboard — see [docs/SETUP-CHECKLIST.md](docs/SETUP-CHECKLIST.md). They are
never committed: a secret in Git is a secret published.

## Dependencies

Three runtime: `astro`, `leaflet`, `@astrojs/markdown-remark`. RSS and the
sitemap are hand-rolled endpoints (~40 lines each) rather than pulling in
`@astrojs/rss` and `@astrojs/sitemap`.
