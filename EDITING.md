# Editing & publishing

This site has two surfaces, and keeping them separate is the main design
idea in the codebase.

| | **Authoring surface** | **Reading surface** |
|---|---|---|
| Who it's for | You, writing | Everyone else |
| What it is | Markdown files + frontmatter | Rendered pages, map, RSS, social cards |
| Optimised for | Fast to write, hard to get wrong | Fast to load, accessible, shareable |
| Where it lives | `src/content/reviews/` | `src/pages/`, `src/layouts/` |

The **content schema** (`src/content/config.ts`) is the contract between
them. It's the reason you can write a review without thinking about HTML,
and the reason a malformed review fails the build instead of silently
rendering something broken.

---

## Writing a new review

1. Add the cover photo to `public/images/reviews/`.
2. Create `src/content/reviews/<slug>.md`. The filename becomes the URL.
3. Fill in the frontmatter (below).
4. `npm run dev` and look at it.

That's the whole workflow. The homepage card, the map pin, the review
page, the RSS entry and the sitemap entry all appear on their own.

### Frontmatter

```yaml
---
name: "Bang Bang Noodles"          # required
lat: -33.8908                      # required — map pin
lng: 151.1957                      # required
rating: 4                          # required — whole number 1-5
date: 2026-02-10                   # required — first published
cover: "/images/reviews/x.jpg"     # required — must start with /images/
blurb: "Numbing, tangy, ..."       # required — 20-160 chars
reaction: fox                      # required — see the animal list below
coverAlt: "A bowl of dan dan..."   # optional but write one
cuisine: "Sichuan"                 # optional
address: "12 King St, Newtown"     # optional
author: "Vivaan"                   # optional — defaults to Vivaan
draft: true                        # optional — defaults to false
updated: 2026-03-02                # optional — set when you revise
hotspots:                          # optional — dish call-outs on the cover
  - { x: 25, y: 70, label: "Galbi" }
---
```

### Cover hotspots (optional)

Leave `hotspots` off and the cover photo renders plainly — that's the
default, and usually the right one. Add it when a photo has specific things
worth naming:

```yaml
hotspots:
  - { x: 30, y: 60, label: "Galbi" }
  - { x: 70, y: 20, label: "Banchan" }
```

`x` and `y` are percentages from the **top-left of the photo**, so they hold
their position when the image is resized or cropped to fit the frame.
Readers click a dot to reveal the label. Both numbers are validated 0–100,
so a typo fails the build rather than parking a dot off-screen.

Keep it to two or three — the point is to name the thing you're about to
write about, not to inventory the table.

### The verdict badge (`reaction:`)

One per review, shown as a badge on the card and a line on the review page.
This is the at-a-glance summary — distinct from the inline emotion icons
you write into the prose (next section).

| Key | Means |
|---|---|
| `pig` | Go hungry |
| `bear` | Huge portions |
| `bee` | Sweet tooth territory |
| `crab` | Seafood done right |
| `owl` | Open late |
| `cat` | Cosy, lingerable |
| `fox` | Clever cooking |
| `snail` | Take your time |

To add one: add an entry to `src/lib/reactions.ts` and drop a matching PNG
in `public/icons/`. Two steps, nothing else. A typo like `reaction: dog`
fails the build and prints the valid list.

---

## Emotion icons in the writing

Inside the review body, type a shortcode and it becomes an inline icon.
This is the main expressive tool — use it as punctuation, mid-sentence.

```markdown
Six oysters for forty-two dollars :cockatiel-shocked: and they arrived on
a tray roughly the size of a coaster. Once I got past the bill, though,
the Sydney rocks themselves were excellent :collie-smiling: — briny,
properly cold, shucked without a single shell fragment.
```

Two characters covering the two ends of the register. The cockatiel's
crest carries its mood (up = alarmed, flat = bored); the collie's ears and
mouth carry its own.

| Shortcode | Reach for it when |
|---|---|
| `:cockatiel-shocked:` | Sticker shock, tiny portions, an absurd bill |
| `:cockatiel-unimpressed:` | Bland, forgettable, phoned in |
| `:cockatiel-suspicious:` | Something's off, proceed carefully |
| `:collie-smiling:` | This is good, straightforwardly |
| `:collie-delighted:` | Outstanding, the reason to come here |
| `:collie-hopeful:` | Would come back, want more of this |
| `:collie-sleepy:` | Cosy, unhurried, comfortable |

**Behaviour worth knowing:**

- A typo (`:colie-smiling:`) stays as literal text and warns in the
  terminal. It deliberately does *not* fail the build — dying on a stray
  colon in prose would be worse than a visible typo you can see and fix.
- Ordinary colons are safe: `12:30`, `3:1` and `note: this` are untouched.
- Shortcodes inside `` `backticks` `` are left alone, so you can write
  about the syntax.
- They carry alt text ("shocked cockatiel"), so a screen reader announces
  them properly mid-sentence.

**Two things to keep in mind while writing.** At inline size the character
is legible but fine emotional detail isn't — so let the *sentence* carry
the meaning and the icon reinforce it, not the other way round. And they
lose force if every sentence has one.

Size and baseline nudge are tunable in one place: `--emotion-icon-size` and
`--emotion-icon-nudge` in `src/styles/global.css`.

**To add an emotion:** add an entry to `src/lib/emotions.mjs` and drop a
matching PNG in `public/icons/`. The build fails if you do only the first.

---

## The draft workflow

Set `draft: true` and the review is:

- **visible** in `npm run dev`, with a red DRAFT badge, so you can read it
  in the real layout;
- **absent** from `npm run build` — no page, no map pin, no RSS entry, no
  sitemap entry.

There's no staging site and no publish button. Flip `draft` to `false`
(or delete the line), rebuild, and it's live.

`src/content/reviews/night-owl-dumplings.md` is a live example — delete it
whenever you like.

## Revising something already published

Set `updated:` to today's date. Readers see "Updated <date>" under the
byline, and the sitemap advertises the new date so search engines re-crawl
it. Leave `updated` off for typo fixes; use it when you've changed your
actual verdict, since that's the honest thing for a review.

Don't rename the file after publishing — the filename is the URL, and
renaming breaks every existing link to it.

---

## What the schema enforces, and why

Each of these is a mistake I'd rather you hit in the terminal than in
production:

| Rule | Reason |
|---|---|
| `blurb` 20–160 chars | Under 20 says nothing; over 160 visibly breaks the card grid and gets truncated in social previews |
| `rating` whole 1–5 | Keeps the star rendering honest — no half stars to render |
| `cover` starts with `/images/` | Catches a relative path that would 404 only in production |
| `lat`/`lng` in real ranges | Catches swapped coordinates, which otherwise put your pin in the ocean |
| `reaction` from a fixed list | Guarantees the icon file exists |

## Pre-publish checklist

- [ ] `coverAlt` describes the photo (it's what screen readers announce)
- [ ] `blurb` reads well standalone — it's the card, the popup, the RSS
      entry and the social preview
- [ ] Pin lands in the right spot on `/map`
- [ ] `draft` removed or set to `false`
- [ ] `npm run build` passes

## Before your first real deploy

Set `site:` in `astro.config.mjs` to your actual domain. Until you do,
canonical URLs, RSS links, the sitemap and social preview images all point
at `example.com` and won't work.
