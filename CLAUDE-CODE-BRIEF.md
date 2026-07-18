# Autonomous work brief — writer/editor platform

Paste this whole file into Claude Code as your first message, in the
`~/Desktop/restaurant-blog` folder.

---

You are working on **Collietiel Adventures**, a live Astro restaurant review
blog at https://collietiel-adventures.netlify.app, deployed from
https://github.com/vivaanusyd/Collietiel-Adventures via Netlify on push to
`main`.

Read `README.md`, `EDITING.md` and `ANALYTICS.md` first. They explain the
architecture and its reasoning. Match their standard: small, dependency-light,
commented with *why* rather than *what*.

There is uncommitted work in the tree. Commit it first, on its own:

    git add -A
    git commit -m "Set site URL, name the site, fix RSS and heading structure"
    git push

**The goal of this session:** turn this from a blog one person edits in a text
editor into a small publishing platform that non-technical writers can use,
with Vivaan as editor-in-chief. Content itself is explicitly NOT your job.

---

## Hard constraints

1. **Do not write review content.** Do not invent restaurants, meals, prices,
   opinions or verdicts. Your job is the machinery writers use, not the
   writing. See Task 4 — you are *removing* placeholder prose, not adding.
2. **Never commit secrets.** OAuth client secrets and API keys go in Netlify
   environment variables, never in the repo. No `.env` committed.
3. **Run the full check before every commit** (see Verification). Never commit
   a failing build.
4. **One logical change per commit**, message explaining *why*.
5. **If something in this brief turns out to be a bad idea, stop and write it
   down** in `NOTES-FOR-VIVAAN.md` instead of forcing it. Judgment beats
   compliance.
6. **Everything you cannot do yourself** (dashboard clicks, OAuth apps, buying
   things) goes in `docs/SETUP-CHECKLIST.md` as unambiguous numbered steps.

## Verification — before every commit

    npm run build              # astro check must pass, 0 errors
    python3 sitetest.py dist   # must report 0 failures

`sitetest.py` is in the repo root. Add to `package.json`:

    "test": "npm run build && python3 sitetest.py dist"

---

# Task 1 — The editing platform (the priority; most of your time)

## 1a. Authentication

Use **Sveltia CMS** with the **GitHub backend**. Sveltia is config-compatible
with Decap CMS but has a far better editor, proper drag-and-drop, and much
better media handling — all of which this brief depends on.

Login is delegated to GitHub OAuth, so the permission check happens on
GitHub's servers against real accounts.

**Do not build a password gate in the page.** A static site has no server to
check a password against, so any password you implement client-side ships its
own secret to the browser in plain text. It is not merely weak, it is
decorative — and worse than nothing, because it feels safe. This is
non-negotiable.

Configure two roles via GitHub repo permissions:

- **Writers** — submit changes as pull requests. Enable Sveltia's editorial
  workflow (`publish_mode: editorial_workflow`) so nothing they do reaches
  `main` directly.
- **Vivaan** — repo admin, merges PRs, can edit directly.

## 1b. "Add review" flow

A prominent **New Review** button that opens a short guided intake, *not* a
blank form. Collect only what the schema requires, one clear step at a time:

1. Restaurant name
2. Location — a **map picker**, not raw lat/lng fields. Writers must never
   type coordinates. Use Leaflet (already a dependency) with a draggable pin
   and an address search box; write `lat`/`lng`/`address` from the result.
3. Cuisine, visit date
4. Star rating (1–5, whole numbers — enforce, don't just label)
5. Verdict badge — show the eight animal icons **as pictures with their
   meanings**, pick one. Never a text dropdown of raw keys like `fox`.
6. Cover photo (see 1c)
7. Blurb, with a **live character counter** showing the 20–160 limit and why
   it exists (it's the card, the map popup, the RSS entry and the social
   preview).

Then it creates the file and drops straight into the editor. The slug is
derived from the name; warn clearly that it becomes the URL and can't be
changed after publishing without breaking links.

Every field must mirror `src/content/config.ts` exactly — same names, same
validation, same required/optional split. If the CMS and the schema disagree,
a writer saves something that fails the build and they cannot fix it
themselves. Where the schema has a constraint, surface it in the UI *before*
submission, not as a build error afterwards.

## 1c. The editor — block-based, not freeform canvas

Vivaan asked for "put anything anywhere." Build a **block editor**, and read
this reasoning before deciding otherwise:

Every tool that feels freeform — Notion, Squarespace, Webflow, Medium — is
block-flow underneath, with constraints. True absolute positioning ("this
photo at x=340, y=1200") breaks the moment the browser is a different width,
which is most readers, since most are on phones. It also can't survive a font
size change, and it makes every page a bespoke layout nobody can restyle
later. Freeform positioning is the feature that feels most powerful in a demo
and causes the most damage in production.

So: writers add blocks, drag to reorder, and each block has its own settings
panel. That delivers the actual want — arrange the page however you like —
without producing layouts that shatter on a phone.

Implement via a variable-type list field. Block types:

- **Text** — rich text: bold, italic, links, headings, lists, blockquote.
  Plus a picker for the `:collie-smiling:` emotion icons that shows the
  **pictures**, not the shortcode names. Writers should never type `:` syntax.
- **Image** — full-width, or floated left/right with text wrapping, or inset.
  Caption and alt text fields. **Alt text is required** — block saving until
  it's filled, with a one-line explanation that it's what screen readers
  announce.
- **Gallery** — two or three images in a row, captions optional.
- **Annotated photo** — the existing `hotspots` feature. Writers click
  directly on the image preview to drop a labelled pin; do not make them type
  x/y percentages.
- **Pull quote** — for a line worth enlarging.
- **Dish list** — dish name, price, one-line note. Repeatable.

## 1d. Per-block styling — from the palette, not a colour picker

Vivaan asked for font and colour controls. Give **constrained** ones:

- Text size: Small / Normal / Large / Display (mapped to the existing type
  scale)
- Alignment: left / centre
- Emphasis colour: **only** the site palette — accent, muted, default — drawn
  from the CSS variables already in `src/styles/global.css`
- Image width: full-bleed / wide / normal / inset

**Do not add a free colour picker or a font-family dropdown.** Arbitrary
per-element colours and fonts are why most CMS-driven sites look
progressively worse over time — every writer makes locally reasonable choices
that collectively destroy the design, and it becomes unfixable because the
values are baked into hundreds of content files rather than a stylesheet. A
palette keeps a redesign possible: change the variable, every page follows.
Explain this in the editor UI in one short line so it reads as a design
decision rather than a missing feature.

## 1e. Preview

A live preview pane rendering the actual page as the writer types, with the
real stylesheet, and a mobile/desktop toggle. Writers must be able to see
their emotion icons, hotspots and image placements without publishing.

---

# Task 2 — Google Drive for images and drafts

Vivaan asked for Google Drive integration. Implement it, but **not as the
image host.**

**Why not:** Drive is not a CDN. Its image links are unstable and
rate-limited, it serves no responsive sizes, it can't set cache headers, and
a viral post will simply start returning errors. Serving a site's images from
Drive is the single fastest way to make a fast site slow.

**Implement instead — Drive as the *source*, repo as the *host*:**

- A **"Import from Google Drive"** button in the media picker. Writer signs in
  with Google, browses their Drive, selects photos.
- On selection, the image is **copied into the repo** at
  `public/images/reviews/`, resized and compressed on the way in (max 2000px
  wide, WebP + JPEG fallback). It is then served from Netlify's CDN like every
  other asset.
- **Import written drafts too:** let a writer pick a Google Doc and pull its
  text in as starting blocks. Map Doc headings to heading blocks, images to
  image blocks, paragraphs to text blocks. Many writers will draft in Docs and
  this removes the copy-paste step entirely.
- OAuth requires a serverless function to hold the client secret — a Netlify
  Function, secret in Netlify env vars, never in the repo. Client-side-only
  Google OAuth would expose it.
- Document every Google Cloud Console step (project, OAuth consent screen,
  scopes, credentials, authorised redirect URIs) in
  `docs/SETUP-CHECKLIST.md`. Request the **narrowest scope that works** —
  `drive.file` if it suffices, not full `drive` read access.

If Drive integration proves too large to finish well in this session, build
the media library and the import *interface* first, ship it working with
direct upload, and leave Drive as a documented, clearly-marked next step.
A half-wired OAuth flow is worse than none.

---

# Task 3 — Writer-facing documentation

Rewrite `EDITING.md` for someone who will **never see the code**. It currently
assumes you're editing Markdown files in a text editor. It should instead
explain: signing in, starting a review, the blocks and when to use each, the
emotion icons as an expressive tool, what happens when you submit, and what
"your review is awaiting review" means.

Keep the existing reasoning about *why* the icons and constraints exist — it's
good, and writers benefit from knowing the intent. Move the developer-facing
material to `docs/DEVELOPING.md`.

---

# Task 4 — Strip placeholder content

The four reviews in `src/content/reviews/` contain invented placeholder prose
("Placeholder review body — replace with the real writeup", plus invented
detail about oysters, noodles and brunch). **Remove all of it.**

- Keep each file, its filename, and its frontmatter — the real name, address,
  coordinates and cuisine are correct and worth keeping.
- Empty the body. Set `draft: true` on all four so the live site shows nothing
  unwritten.
- Clear invented `blurb` values too — but note the schema requires 20–160
  characters, so either relax the constraint for drafts or insert a single
  clearly-marked `NEEDS BLURB` placeholder. Say which you chose and why.
- Leave `night-owl-dumplings.md` in place as the draft-workflow demo, but
  strip its invented prose the same way.

Also purge the invented sample content from `public/images/reviews/` — all
four covers are generated placeholders. Replace with a single neutral
`placeholder.jpg` referenced by all four, or make `cover` optional in the
schema with a graceful fallback in `ReviewCard.astro` and `[slug].astro`.
Prefer the second — it's the honest fix, since a review genuinely may not have
a photo yet.

The result: a working site with a working editor and **zero invented content**
waiting for real writing.

---

# Task 5 — SEO and structure

- **JSON-LD structured data** on review pages: `Review` + `Restaurant`, from
  `name`, `address`, `lat`/`lng`, `rating`, `author`, `datePublished`. Highest
  -value SEO change available; all fields already exist.
- **Cuisine index pages** at `/cuisine/<slug>`, generated from `cuisine`. Add
  to `STATIC_PATHS` in `src/pages/sitemap.xml.ts` — it's a manual list.
- **`/about` page** — structure and layout only. Leave the prose as clearly
  marked empty sections for Vivaan. Add to the sitemap.
- **Pagination** on the homepage past 12 reviews.

# Task 6 — Quality

- **Prettier** + `prettier-plugin-astro`, `npm run format`.
- **Vitest** on the two functions most likely to break silently:
  - `src/lib/remark-emotion-icons.mjs` — unknown shortcode warns but doesn't
    throw; `12:30` and `3:1` untouched; backticked shortcodes untouched;
    multiple icons per paragraph.
  - `src/pages/rss.xml.ts` — escaper doesn't double-escape `&`.
- **GitHub Actions CI** — build + `sitetest.py` + tests on every PR. This
  matters much more now that writers submit PRs.
- **Dark mode** via `prefers-color-scheme`. Colours are already CSS variables;
  `.review-card` hardcodes `#fff` and needs fixing. Respect
  `prefers-reduced-motion` for card hover and caption transitions.
- Build-time check that every `cover:` file exists, mirroring
  `src/lib/icons.mjs`. A typo'd filename currently ships a broken image.
- Fill in `package.json`: `description`, `license`, `private`, `repository`.

---

## When you finish

Write `NOTES-FOR-VIVAAN.md`:

1. What you completed, commit by commit.
2. **Every manual step still required** — Google Cloud Console, GitHub OAuth
   app, Netlify env vars. Numbered, unambiguous, in the order they must
   happen.
3. How to add a writer to the site, start to finish.
4. Anything you chose not to build, and why.
5. Anything you're unsure about and want a second opinion on.

Push to `main`. Never deploy anything failing `npm run test`.
